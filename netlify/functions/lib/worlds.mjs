// Shared helpers for the Worlds economy: price computation, signed room join
// tokens (so the authoritative PartyKit room can trust a connecting client's
// role without a DB round-trip), and on-chain USDC payment verification.
//
// Kept dependency-light (only node:crypto + the existing solana helpers) so it is
// straightforward to unit test. Gameplay constants (hearts, cooldowns, node
// charges, regrowth) live in party/index.js, the authoritative simulation.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { solanaEnv, solanaRpc, isSolanaPublicKey } from './solana.mjs';

export const WORLD_RESOURCES = ['fish', 'meat', 'plants', 'ore'];
export const WORLD_STATUSES = ['unclaimed', 'draft', 'published'];
export const MAX_WORLD_NAME = 48;

// ---- god-admin gate ----
// A small set of accounts may edit ANY world live — including the published
// lobby/demo world that no single player "owns" — and save straight to the live
// record. Gated by the authenticated account EMAIL so it follows the person, not
// a browser or a draft's ownership row. Mirrors the client allowlist in
// engine/world/30-ui-boot-wiring.js (AI_ACCOUNT_ALLOWLIST / TINYVERSE_ALLOWLIST).
// Extra admins can be added via a comma-separated TINYWORLD_WORLD_ADMIN_EMAILS env.
const WORLD_ADMIN_DEFAULT_EMAILS = ['jason@bouncingfish.com'];
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

export function cleanTaxPercent(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 100) return null;
  return n;
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

// Derive tile/terrain counts from a world.schema.json v4 cells array so pricing
// and the regrowth simulation stay consistent with the actual build. Accepts the
// tuple form ([x,z,terrain,kind,...]) and the object form ({terrain,kind,...}).
export function deriveTerrainCounts(data, gridSize) {
  const size = Math.max(1, Math.round(Number(gridSize) || 8));
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

export function worldDto(row, { includeData = false } = {}) {
  if (!row) return null;
  const out = {
    id: Number(row.id),
    slug: row.slug,
    kind: row.kind,
    status: row.status,
    name: row.name || '',
    taxPercent: Number(row.tax_percent),
    priceUsdc: row.price_usdc != null ? String(row.price_usdc) : '0',
    gridSize: Number(row.grid_size),
    tileCount: Number(row.tile_count),
    activePlayers: Number(row.active_players) || 0,
    ownerProfileId: row.owner_profile_id != null ? Number(row.owner_profile_id) : null,
    ownerName: row.owner_name || '',
    publishedAt: row.published_at || null,
  };
  if (includeData) out.data = row.data;
  return out;
}
