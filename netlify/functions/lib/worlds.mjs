// Shared helpers for the Worlds economy: price computation, signed room join
// tokens (so the authoritative PartyKit room can trust a connecting client's
// role without a DB round-trip), and on-chain USDC payment verification.
//
// Kept dependency-light (only node:crypto + the existing solana helpers) so it is
// straightforward to unit test. Gameplay constants (hearts, cooldowns, node
// charges, regrowth) live in party/index.js, the authoritative simulation.
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  DEFAULT_ECONOMY_POLICY,
  clampTaxRate,
  normalizeWorldResourceSpec,
} from '../../../packages/tinyworld-mmo-core/src/index.js';
import { solanaEnv, solanaRpc, isSolanaPublicKey } from './solana.mjs';

export const WORLD_RESOURCES = ['fish', 'meat', 'plants', 'ore'];
export const WORLD_STATUSES = ['unclaimed', 'draft', 'published'];
export const MAX_WORLD_NAME = 48;
export const TINYVERSE_HUB_SLUG = 'tinyverse-nexus';
const WORLD_SELECTION_GATE_DEST = '__world-picker';
const WORLD_RESOURCE_PLANT_KINDS = new Set(['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower']);
const WORLD_RESOURCE_ANIMAL_KINDS = new Set(['cow', 'sheep']);
const WORLD_RESOURCE_ANIMAL_MIN = 2;
export const WORLD_RESOURCE_PRICE_WEIGHTS = Object.freeze({
  fish: 0.35,
  ore: 0.08,
  plants: 0.04,
  meat: 0.12,
});

function worldCellX(cell) { return Array.isArray(cell) ? cell[0] : (cell && cell.x); }
function worldCellZ(cell) { return Array.isArray(cell) ? cell[1] : (cell && cell.z); }
function worldCellKind(cell) { return Array.isArray(cell) ? cell[3] : (cell && cell.kind); }
function worldCellTerrain(cell) { return Array.isArray(cell) ? cell[2] : (cell && cell.terrain); }
function worldCellEconomy(cell) { return Array.isArray(cell) ? null : normalizeWorldResourceSpec(cell && cell.economy); }
// Supported home-board sizes (mirrors the client HOME_GRID_OPTIONS / HOME_GRID_MAX).
// The client renderer is capped at 20x20 with this discrete set, so the server must
// not serve or persist a size outside it — older seeds shipped 18x18 / 22x22, which
// the client cannot render faithfully (board, movement, and stargate diverge). Snap
// any off-list size UP to the nearest legal option that covers it, capped at 20.
const WORLD_GRID_OPTIONS = [8, 10, 12, 16, 20];
const WORLD_GRID_MAX = 20;
export function snapWorldGridSize(n) {
  const v = Math.max(1, Math.round(Number(n) || 0));
  for (const size of WORLD_GRID_OPTIONS) if (size >= v) return size;
  return WORLD_GRID_MAX;
}
export function effectiveWorldGridSize(data, gridSizeHint) {
  const fromData = data && typeof data === 'object' ? Number(data.gridSize) : NaN;
  const fromHint = Number(gridSizeHint);
  const raw = Number.isFinite(fromData) && fromData > 0 ? fromData
    : (Number.isFinite(fromHint) && fromHint > 0 ? fromHint : 8);
  return snapWorldGridSize(raw);
}
function worldSelectionGateCell(gridSize) {
  const center = Math.floor(Math.max(1, gridSize) / 2);
  return { x: center, z: center, terrain: 'grass', kind: 'stargate', dest: WORLD_SELECTION_GATE_DEST };
}

function isResourceStandableObjectKind(kind) {
  if (!kind) return true;
  if (kind === 'stargate' || kind === 'bridge') return true;
  if (WORLD_RESOURCE_PLANT_KINDS.has(kind) || WORLD_RESOURCE_ANIMAL_KINDS.has(kind)) return true;
  return kind === 'bush' || kind === 'flower' || kind === 'tuft';
}

export function normalizeWorldSelectionGateData(data, gridSizeHint) {
  const src = data && typeof data === 'object' ? data : { v: 4, cells: [] };
  const gridSize = effectiveWorldGridSize(src, gridSizeHint);
  const gate = worldSelectionGateCell(gridSize);
  const cells = Array.isArray(src.cells) ? src.cells : [];
  const nextCells = [];

  for (const cell of cells) {
    const x = Math.round(Number(worldCellX(cell)));
    const z = Math.round(Number(worldCellZ(cell)));
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    if (worldCellKind(cell) === 'stargate') {
      // Strip legacy multi-gates; the normalizer adds one center exit gate.
      const terrain = (Array.isArray(cell) ? cell[2] : (cell && cell.terrain)) || 'grass';
      if (terrain && terrain !== 'grass') nextCells.push(Array.isArray(cell) ? [x, z, terrain] : { x, z, terrain });
      continue;
    }
    nextCells.push(cell);
  }

  const normalizedCells = nextCells.filter(cell => {
    const x = Math.round(Number(worldCellX(cell)));
    const z = Math.round(Number(worldCellZ(cell)));
    return x !== gate.x || z !== gate.z;
  });
  normalizedCells.push(gate);

  return Object.assign({}, src, {
    v: src.v || 4,
    gridSize,
    cells: normalizedCells,
  });
}

// ---- world admin gate ----
// A small set of accounts may inspect/administer worlds beyond ownership.
// Live multiplayer rooms are not build surfaces; island editing/version
// publication is handled outside the room flow. Gated by authenticated account
// EMAIL so it follows the person, not a browser or a draft's ownership row.
// Mirrors the client allowlist in engine/world/30-ui-boot-wiring.js.
// Extra admins can be added via a comma-separated TINYWORLD_WORLD_ADMIN_EMAILS env.
const WORLD_ADMIN_DEFAULT_EMAILS = ['jason@bouncingfish.com', 'jason.kneen@bouncingfish.com', 'jason.kneen@gmail.com'];
export function worldAdminEmails() {
  const extra = String(process.env.TINYWORLD_WORLD_ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return new Set(WORLD_ADMIN_DEFAULT_EMAILS.concat(extra));
}
export function isWorldAdminEmail(email) {
  const e = String(email == null ? '' : email).trim().toLowerCase();
  if (!e) return false;
  return worldAdminEmails().has(e);
}


// ---- name / tax sanitizers (mirrors worlds table CHECK constraints) ----
export function cleanWorldName(value) {
  return String(value == null ? '' : value).trim().slice(0, MAX_WORLD_NAME);
}

export function cleanTaxPercent(value, worldId = null) {
  if (worldId && !canChangeTax(worldId)) return null; // cooldown active

  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return null;
  // Use mmo-core policy: max 20%, default 5%. Accepts percent or decimal.
  const rate = n > 1 ? n / 100 : n;
  const clamped = clampTaxRate(rate, DEFAULT_ECONOMY_POLICY);
  if (clamped <= 0) return null;
  return Math.round(clamped * 100); // store as integer percent 1-20
}

// ---- universe price curve ----
// Each claimed world raises the live per-tile value of remaining land by a small
// fixed increment, capped at a ceiling. price = perTile * tileCount.
export function perTileRate(economy) {
  const base = Number(economy && economy.per_tile_base) || 0.01;
  const inc = Number(economy && economy.per_tile_increment) || 0;
  const ceil = Number(economy && economy.per_tile_ceiling) || base;
  const claimed = Math.max(0, Number(economy && economy.claimed_count) || 0);
  return Math.min(ceil, base + claimed * inc);
}

export function computeWorldPrice(tileCount, economy) {
  const tiles = Math.max(0, Math.round(Number(tileCount) || 0));
  const price = perTileRate(economy) * tiles;
  // 6dp matches the NUMERIC(20,6) price columns.
  return Math.round(price * 1e6) / 1e6;
}

function roundUsdc(value) {
  return Math.round(Math.max(0, Number(value) || 0) * 1e6) / 1e6;
}

export function computeWorldResourceValue(resourceStats) {
  const stats = resourceStats || {};
  let total = 0;
  for (const resource of WORLD_RESOURCES) {
    const count = Math.max(0, Math.round(Number(stats[resource]) || 0));
    total += count * (WORLD_RESOURCE_PRICE_WEIGHTS[resource] || 0);
  }
  return roundUsdc(total);
}

export function computeWorldPriceBreakdown(tileCount, economy, resourceStats) {
  const land = computeWorldPrice(tileCount, economy);
  const resources = computeWorldResourceValue(resourceStats);
  const total = roundUsdc(land + resources);
  return {
    landUsdc: String(land),
    resourcesUsdc: String(resources),
    totalUsdc: String(total),
    formula: 'land + fish*0.35 + ore*0.08 + plants*0.04 + meat*0.12',
  };
}

export function computeWorldPurchasePrice(tileCount, economy, resourceStats) {
  return Number(computeWorldPriceBreakdown(tileCount, economy, resourceStats).totalUsdc);
}

// Derive tile/terrain counts from a world.schema.json v4 cells array so pricing
// and the regrowth simulation stay consistent with the actual build. Accepts the
// tuple form ([x,z,terrain,kind,...]) and the object form ({terrain,kind,...}).
export function deriveTerrainCounts(data, gridSize) {
  const size = effectiveWorldGridSize(data, gridSize);
  const out = { tileCount: size * size, stone: 0, grass: 0, water: 0 };
  const cells = data && Array.isArray(data.cells) ? data.cells : [];
  let nonGrass = 0;
  for (const cell of cells) {
    const terrain = Array.isArray(cell) ? cell[2] : (cell && cell.terrain);
    if (terrain === 'water') { out.water++; nonGrass++; }
    else if (terrain === 'stone') { out.stone++; nonGrass++; }
    else if (terrain && terrain !== 'grass') { nonGrass++; }
  }
  out.grass = Math.max(0, out.tileCount - nonGrass);
  return out;
}

// Resource summary for world-picker cards. Mirrors the authoritative room's
// resource seeding rules in party/index.js: one fish node per connected water
// body, one ore node per stone cell, one plant node per crop cell, and wildlife
// is available when the room has non-stone standable spawn cells.
export function deriveResourceStats(data, gridSizeHint) {
  const gridSize = effectiveWorldGridSize(data, gridSizeHint);
  const cells = data && Array.isArray(data.cells) ? data.cells : [];
  const byXZ = new Map();
  for (const c of cells) {
    const x = Math.round(Number(worldCellX(c)));
    const z = Math.round(Number(worldCellZ(c)));
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    byXZ.set(x + ',' + z, c);
  }

  const out = { fish: 0, ore: 0, plants: 0, meat: 0, ready: 0, mineable: 0, spawnable: 0 };
  const explicitResources = new Map();
  for (const [key, c] of byXZ) {
    const spec = worldCellEconomy(c);
    if (!spec) continue;
    explicitResources.set(key, spec);
    out[spec.resource]++;
  }
  const waterSeen = new Set();
  for (const [key, c] of byXZ) {
    if (explicitResources.has(key) || worldCellTerrain(c) !== 'water' || waterSeen.has(key)) continue;
    const stack = [key];
    let members = 0;
    while (stack.length) {
      const k = stack.pop();
      if (waterSeen.has(k)) continue;
      const cc = byXZ.get(k);
      if (explicitResources.has(k)) continue;
      if (!cc || worldCellTerrain(cc) !== 'water') continue;
      waterSeen.add(k);
      members++;
      const px = Math.round(Number(worldCellX(cc)));
      const pz = Math.round(Number(worldCellZ(cc)));
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = (px + dx) + ',' + (pz + dz);
        if (!waterSeen.has(nk) && byXZ.has(nk)) stack.push(nk);
      }
    }
    if (members > 0) out.fish++;
  }

  for (const c of byXZ.values()) {
    const x = Math.round(Number(worldCellX(c)));
    const z = Math.round(Number(worldCellZ(c)));
    if (explicitResources.has(x + ',' + z)) continue;
    const terrain = worldCellTerrain(c) || 'grass';
    const kind = worldCellKind(c);
    if (terrain === 'stone') out.ore++;
    else if (WORLD_RESOURCE_PLANT_KINDS.has(kind)) out.plants++;
    if (terrain !== 'stone' && WORLD_RESOURCE_ANIMAL_KINDS.has(kind)) out.meat++;
  }

  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      const c = byXZ.get(x + ',' + z);
      const terrain = c ? (worldCellTerrain(c) || 'grass') : 'grass';
      const kind = c ? worldCellKind(c) : null;
      if (terrain === 'lava' || terrain === 'stone') continue;
      if (!isResourceStandableObjectKind(kind)) continue;
      out.spawnable++;
    }
  }
  if (out.spawnable > 0) out.meat = Math.max(out.meat, WORLD_RESOURCE_ANIMAL_MIN);
  out.mineable = out.ore;
  out.ready = out.fish + out.ore + out.plants + out.meat;
  return out;
}

// ---- signed join tokens (HMAC-SHA256, base64url payload.sig) ----
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  return Buffer.from(String(str || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function signJoinToken(payload, secret, ttlMs = 10 * 60 * 1000) {
  if (!secret) return '';
  const body = Object.assign({}, payload, { exp: Date.now() + ttlMs });
  const json = JSON.stringify(body);
  const data = b64url(json);
  const sig = b64url(createHmac('sha256', secret).update(data).digest());
  return data + '.' + sig;
}

export function verifyJoinToken(token, secret) {
  if (!token || !secret) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = b64url(createHmac('sha256', secret).update(data).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(fromB64url(data).toString('utf8')); } catch (_) { return null; }
  if (!payload || typeof payload !== 'object') return null;
  if (!payload.exp || Date.now() > Number(payload.exp)) return null;
  return payload;
}

// ---- USDC mint / on-chain verification ----
export function worldsUsdcMint() {
  // Worlds buy with USDC specifically; fall back to the project token mint only
  // if a dedicated USDC mint is not configured.
  return solanaEnv('WORLDS_USDC_MINT', '') || solanaEnv('TINYWORLD_TOKEN_MINT', '');
}

export function onchainVerificationRequired() {
  // Real USDC by default; set WORLDS_VERIFY_ONCHAIN=0 to skip in environments
  // without a usable Solana RPC (e.g. local DB-only testing).
  return solanaEnv('WORLDS_VERIFY_ONCHAIN', '1') !== '0';
}

// Best-effort confirmation that `signature` is a confirmed, error-free transfer
// of >= minAmount of `mint` into a token account owned by `recipient`, and that
// `reference` is one of the transaction's account keys (Solana Pay convention).
// Returns { ok, reason }. Fails closed on any RPC / parse error.
export async function verifyUsdcTransfer({ signature, recipient, mint, minAmount, reference }) {
  if (!signature) return { ok: false, reason: 'missing signature' };
  if (!isSolanaPublicKey(recipient)) return { ok: false, reason: 'bad recipient' };
  let tx;
  try {
    tx = await solanaRpc('getTransaction', [
      String(signature),
      { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
    ]);
  } catch (err) {
    return { ok: false, reason: 'rpc error: ' + (err && err.message || 'unknown') };
  }
  if (!tx || !tx.meta) return { ok: false, reason: 'transaction not found' };
  if (tx.meta.err) return { ok: false, reason: 'transaction failed on chain' };

  // reference must appear among the account keys (Solana Pay attaches it as a
  // read-only key so the payment can be located on chain).
  if (reference) {
    const msg = tx.transaction && tx.transaction.message;
    const keys = (msg && Array.isArray(msg.accountKeys) ? msg.accountKeys : [])
      .map(k => (typeof k === 'string' ? k : (k && k.pubkey)) || '');
    if (!keys.includes(String(reference))) return { ok: false, reason: 'reference not in transaction' };
  }

  const pre = Array.isArray(tx.meta.preTokenBalances) ? tx.meta.preTokenBalances : [];
  const post = Array.isArray(tx.meta.postTokenBalances) ? tx.meta.postTokenBalances : [];
  const want = Math.max(0, Number(minAmount) || 0);
  const keyOf = (b) => b.accountIndex + ':' + b.mint + ':' + b.owner;
  const preMap = new Map(pre.map(b => [keyOf(b), Number((b.uiTokenAmount && b.uiTokenAmount.uiAmount) || 0)]));
  for (const b of post) {
    if (mint && b.mint !== mint) continue;
    if (b.owner !== recipient) continue;
    const before = preMap.get(keyOf(b)) || 0;
    const after = Number((b.uiTokenAmount && b.uiTokenAmount.uiAmount) || 0);
    if (after - before + 1e-9 >= want) return { ok: true, reason: '' };
  }
  return { ok: false, reason: 'no matching USDC credit to recipient' };
}

// Compact top-down preview for world cards: sparse [x, z, terrain, kind?] for
// the non-default cells, capped so the universe list payload stays small. The
// tuple shape is also what deriveWorldState() consumes, so it can seed a room.
export function worldPreview(data, max = 1500) {
  const cells = data && Array.isArray(data.cells) ? data.cells : [];
  const out = [];
  for (const c of cells) {
    const x = Array.isArray(c) ? c[0] : (c && c.x);
    const z = Array.isArray(c) ? c[1] : (c && c.z);
    if (x == null || z == null) continue;
    const terrain = (Array.isArray(c) ? c[2] : (c && c.terrain)) || 'grass';
    const kind = Array.isArray(c) ? c[3] : (c && c.kind);
    out.push(kind ? [x, z, terrain, kind] : [x, z, terrain]);
    if (out.length >= max) break;
  }
  return out;
}

// ownerEmail is PII and is OPT-IN only (includeOwnerEmail) — never expose it on paths a
// non-owner/non-admin can reach (e.g. the now-public early-preview starter worlds).
export function worldDto(row, { includeData = false, includeOwnerEmail = false } = {}) {
  if (!row) return null;
  const gridSize = effectiveWorldGridSize(row.data, row.grid_size);
  const out = {
    id: Number(row.id),
    slug: row.slug,
    kind: row.kind,
    status: row.status,
    name: row.name || '',
    taxPercent: Number(row.tax_percent),
    priceUsdc: row.price_usdc != null ? String(row.price_usdc) : '0',
    gridSize,
    tileCount: Number(row.tile_count),
    activePlayers: Number(row.active_players) || 0,
    ownerProfileId: row.owner_profile_id != null ? Number(row.owner_profile_id) : null,
    ownerName: row.owner_name || '',
    ownerEmail: includeOwnerEmail ? (row.owner_email || '') : '',
    resourceStats: deriveResourceStats(row.data, gridSize),
    publishedAt: row.published_at || null,
  };
  if (includeData) out.data = normalizeWorldSelectionGateData(row.data, gridSize);
  return out;
}


// Tax change cooldown (guide: 24h). Simple in-memory + DB hook for now.
const TAX_CHANGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function canChangeTax(worldId, lastTaxChangeAt, now = Date.now()) {
  if (!worldId) return true;
  if (!lastTaxChangeAt) return true;
  const last = new Date(lastTaxChangeAt).getTime();
  return (now - last) > TAX_CHANGE_COOLDOWN_MS;
}

export function getTaxCooldownInfo(lastTaxChangeAt, now = Date.now()) {
  if (!lastTaxChangeAt) return { canChange: true, remainingMs: 0 };
  const last = new Date(lastTaxChangeAt).getTime();
  const remaining = Math.max(0, TAX_CHANGE_COOLDOWN_MS - (now - last));
  return { canChange: remaining === 0, remainingMs: remaining };
}
