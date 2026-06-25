// @ts-check
/// <reference types="partykit/server" />

import {
  DEFAULT_ECONOMY_POLICY,
  clampTaxRate,
  applyIslandTax,
} from '../packages/tinyworld-mmo-core/src/index.js';

const MESSAGE_LIMIT = 48 * 1024;
const PRESENCE_KEYS = new Set(['id', 'name', 'color', 'cursor', 'selection', 'tool', 'ts']);
const OP_KEYS = new Set(['id', 'kind', 'x', 'z', 'cell', 'ts']);

// Generous finite ghost-board bound. The world.schema.json $defs/coord caps
// home/import cells at +/-1024, but sparse user-edited ghost-board cells and
// island-derived world coords (boardX * GRID + local) can legitimately reach
// further, so we do NOT clamp to the home grid. This cap only rejects clearly
// crafted coordinates (e.g. 9999999) that would grow world[x][z] without bound.
const MAX_CELL_COORD = 100000;

// Schema enums mirrored from world.schema.json $defs/terrain (line 89) and
// $defs/kind (line 94). The server cannot import the client schema, so these
// are hardcoded; keep them in sync if the schema changes.
const TERRAIN_ENUM = new Set(['grass', 'path', 'dirt', 'water', 'stone', 'lava', 'sand', 'snow']);
const KIND_ENUM = new Set([
  'house', 'tree', 'fence', 'rock', 'bridge', 'crop', 'corn', 'wheat', 'pumpkin',
  'carrot', 'sunflower', 'tuft', 'flower', 'bush', 'cow', 'sheep', 'lamp-post',
  'spotlight', 'voxel-build', 'model-stamp',
]);

// Mirror of MAX_FLOORS = 8 from engine/world/10-world-data.js:246 (the server
// cannot import it). Both floors and terrainFloors are capped at 8 in the
// schema (cellObject), so clamp both to block a 1e7-floor skyscraper DoS.
const MAX_FLOORS = 8;

// Explicit allowlist of cell fields the renderer actually consumes, taken from
// the live cell shape written in engine/world/29-persistence-api.js:388-402.
// Anything outside this set (including attacker-supplied flags like userEdited)
// is dropped. Custom objects ride in via kind:'voxel-build' + appearance, not
// raw customParts, so they replicate without being listed here.
const CELL_FIELDS = new Set([
  'terrain', 'kind', 'floors', 'terrainFloors', 'buildingType', 'fenceSide',
  'extras', 'rotationY', 'offsetX', 'offsetY', 'offsetZ', 'appearance', 'waterFlow',
]);

function clampFloors(value) {
  const n = Math.round(cleanNumber(value, 1));
  if (n < 1) return 1;
  if (n > MAX_FLOORS) return MAX_FLOORS;
  return n;
}

// Per-connection token buckets. Presence is throttled tighter (client maxes
// ~11/sec); cell.set is generous so a fast drag-paint burst is never dropped.
// refill = sustained tokens per second; burst = bucket capacity.
const RATE_LIMITS = {
  presence: { refill: 25, burst: 40 },
  'cell.set': { refill: 40, burst: 80 },
  // Live flight transform: client self-throttles to ~15/s; this bucket lets the
  // sustained stream through while a raw socket cannot flood it.
  entity: { refill: 20, burst: 40 },
  // Host build-zone edits are infrequent room-permission changes.
  'zones.set': { refill: 3, burst: 8 },
  // Admin watcher visual layer: host sends rounded MediaPipe landmark frames.
  // Kept lower than entity because a frame carries more numbers.
  watcher: { refill: 6, burst: 10 },
  // Chat messages: human typing rate, so a tight sustained cap with a small
  // burst is plenty. A raw socket cannot flood the room past this.
  chat: { refill: 4, burst: 10 },
  emote: { refill: 4, burst: 10 },
  // Typing indicator fires on keystrokes — needs its own bucket or it becomes a
  // spam vector. Generous enough for fast typing, capped against abuse.
  'chat.typing': { refill: 8, burst: 16 },
  // Combat hit reports: gun bursts ~9/s, two muzzles, plus missiles. Generous
  // sustained cap, bounded burst, so a socket cannot flood a victim.
  'combat.hit': { refill: 30, burst: 60 },
  // Worlds MMO: one-cell movement (human walking cadence), harvest actions, and
  // the one-shot join handshake. A raw socket cannot flood past these.
  move: { refill: 8, burst: 12 },
  'harvest.start': { refill: 3, burst: 6 },
  'harvest.cancel': { refill: 3, burst: 6 },
  'world.join': { refill: 2, burst: 4 },
  'world.avatar': { refill: 2, burst: 4 },
  // Lobby presentation: a presenter advancing slides is human-paced, like chat.
  present: { refill: 4, burst: 10 },
};

// Server-side allowlist for chat emotes (client EMOTES table in 47-worlds-room.js
// must stay in sync). Anything not in this set is rejected — no spoofed states.
export const EMOTE_CMDS = new Set(['wave', 'dance', 'jump', 'sit', 'crouch', 'attack']);

function takeToken(buckets, type, now) {
  const cfg = RATE_LIMITS[type];
  if (!cfg) return true;
  let bucket = buckets.get(type);
  if (!bucket) {
    bucket = { tokens: cfg.burst, last: now };
    buckets.set(type, bucket);
  }
  const elapsed = Math.max(0, now - bucket.last) / 1000;
  bucket.tokens = Math.min(cfg.burst, bucket.tokens + elapsed * cfg.refill);
  bucket.last = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

function safeJson(message) {
  if (typeof message !== 'string' || message.length > MESSAGE_LIMIT) return null;
  try {
    return JSON.parse(message);
  } catch (_) {
    return null;
  }
}

function cleanText(value, limit) {
  return String(value || '').trim().slice(0, limit);
}

function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanCursor(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    x: cleanNumber(value.x),
    z: cleanNumber(value.z),
    y: cleanNumber(value.y),
  };
}

function cleanVec3(value) {
  if (!value || typeof value !== 'object') return { x: 0, y: 0, z: 0 };
  return {
    x: cleanNumber(value.x),
    y: cleanNumber(value.y),
    z: cleanNumber(value.z),
  };
}

function cleanSelection(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 64).map(cell => {
    if (!cell || typeof cell !== 'object') return null;
    return {
      x: Math.round(cleanNumber(cell.x)),
      z: Math.round(cleanNumber(cell.z)),
    };
  }).filter(Boolean);
}

function cleanFloatArray(value, limit) {
  if (!Array.isArray(value)) return null;
  const out = [];
  const n = Math.min(value.length, limit);
  for (let i = 0; i < n; i++) {
    const v = cleanNumber(value[i], NaN);
    if (!Number.isFinite(v)) return null;
    out.push(Math.round(v * 10000) / 10000);
  }
  return out;
}

function cleanWatcherSettings(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    faceSize: Math.max(0.6, Math.min(12, cleanNumber(input.faceSize, 1.5))),
    faceWidth: Math.max(0.5, Math.min(2.5, cleanNumber(input.faceWidth, 1.15))),
    faceHeight: Math.max(0.5, Math.min(2.5, cleanNumber(input.faceHeight, 1))),
    posX: Math.max(-80, Math.min(80, cleanNumber(input.posX, 0))),
    posY: Math.max(-20, Math.min(80, cleanNumber(input.posY, 7))),
    posZ: Math.max(-120, Math.min(80, cleanNumber(input.posZ, -28))),
    tilt: Math.max(-45, Math.min(45, cleanNumber(input.tilt, 40))),
    zoom: Math.max(0.6, Math.min(8, cleanNumber(input.zoom, 1.4))),
    smooth: Math.max(0, Math.min(0.95, cleanNumber(input.smooth, 0))),
    faceOpacity: Math.max(0.03, Math.min(1, cleanNumber(input.faceOpacity, 0.09))),
    handOpacity: Math.max(0.03, Math.min(1, cleanNumber(input.handOpacity, 0.4))),
    cloudOpacity: Math.max(0, Math.min(1, cleanNumber(input.cloudOpacity, 1))),
  };
}

function cleanWatcherFrame(value) {
  if (!value || typeof value !== 'object') return null;
  const face = cleanFloatArray(value.face, 468 * 3);
  if (!face || face.length < 468 * 3) return null;
  const hands = Array.isArray(value.hands) ? value.hands.slice(0, 2).map(h => cleanFloatArray(h, 21 * 3)).filter(h => h && h.length >= 21 * 3) : [];
  return {
    face,
    hands,
    settings: cleanWatcherSettings(value.settings),
    ts: Date.now(),
  };
}

// Validate an UNTRUSTED networked voxel-avatar descriptor (client -> server ->
// other clients). Security boundary: whitelist fields, clamp the seed, reject
// anything not a 'voxel' descriptor or with any out-of-domain look field.
//
// Contract: PASS-THROUGH-VALID or NULL — never keep-some-drop-others. The client's
// deriveCfg (engine/world/53-voxel-avatar.js) fills unset look fields from the seed
// via SHORT-CIRCUIT PRNG calls, so a partially-stripped descriptor would RESHUFFLE
// every later field and make a peer render a coherent-but-WRONG look. Returning null
// instead lets the peer fall back to its id-seed (a clean, distinct look).
//
// Field domains MUST mirror 53-voxel-avatar.js (no shared import across client/server):
//   body  : 'Masc' | 'Fem'
//   skin  : int 0..4   (SKINS.length === 5)
//   hairC : int 0..6   (HAIRC.length === 7)
//   hair  : one of HAIRS
//   fit   : one of OUTFIT_KEYS
//   head  : 'Wide' | 'Slim'
//   height: number 0.84..1.22
//   build : int -2..2
//   gear  : one of GEARS
const VOXEL_HAIRS = ['Buzz', 'Short', 'Spike', 'Mohawk', 'Curls', 'Page', 'Bob', 'Tail', 'Knot', 'Bald'];
const VOXEL_OUTFITS = ['Casual', 'Formal', 'Scout', 'Sport', 'Rogue', 'Barbarian', 'Knight', 'Archer', 'Mage', 'Miner', 'Skyfarer', 'HoodedRogue'];
const VOXEL_GEARS = ['None', 'Sword', 'Bow', 'Shield', 'SwordShield', 'Axe', 'Staff', 'Pickaxe'];
function avatarSeedFromId(id) {
  const s = String(id == null ? 'player' : id);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function defaultAvatarForId(id) {
  return { kind: 'voxel', seed: avatarSeedFromId(id) };
}
function cleanAvatar(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  if (input.kind !== 'voxel') return null;
  // Cap object size — an honest descriptor has <= 11 keys; reject obvious bloat.
  if (Object.keys(input).length > 12) return null;
  const out = { kind: 'voxel' };
  // seed: always keep, coerced to a finite non-negative int (uint32).
  const seedN = Number(input.seed);
  out.seed = Number.isFinite(seedN) ? (seedN >>> 0) : 0;
  // Each optional look field: validate IF PRESENT; any present-and-invalid => reject whole.
  const intInRange = (v, max) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n < max ? n : undefined; };
  const signedIntInRange = (v, min, max) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : undefined; };
  if (Object.prototype.hasOwnProperty.call(input, 'body')) {
    if (input.body !== 'Masc' && input.body !== 'Fem') return null;
    out.body = input.body;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'skin')) {
    const v = intInRange(input.skin, 5); if (v === undefined) return null; out.skin = v;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'hairC')) {
    const v = intInRange(input.hairC, 7); if (v === undefined) return null; out.hairC = v;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'hair')) {
    if (!VOXEL_HAIRS.includes(input.hair)) return null; out.hair = input.hair;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'fit')) {
    if (!VOXEL_OUTFITS.includes(input.fit)) return null; out.fit = input.fit;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'head')) {
    if (input.head !== 'Wide' && input.head !== 'Slim') return null; out.head = input.head;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'height')) {
    const n = Number(input.height);
    if (!Number.isFinite(n) || n < 0.84 || n > 1.22) return null;
    out.height = Math.round(n * 100) / 100;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'build')) {
    const v = signedIntInRange(input.build, -2, 2); if (v === undefined) return null; out.build = v;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'gear')) {
    if (!VOXEL_GEARS.includes(input.gear)) return null; out.gear = input.gear;
  }
  return out;
}

function cleanPresence(input, fallbackId) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  for (const key of PRESENCE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) out[key] = input[key];
  }
  out.id = cleanText(out.id || fallbackId, 64) || fallbackId;
  out.name = cleanText(out.name || 'Builder', 48) || 'Builder';
  out.color = /^#[0-9a-f]{6}$/i.test(String(out.color || '')) ? String(out.color) : '#3c82f7';
  out.cursor = cleanCursor(out.cursor);
  out.selection = cleanSelection(out.selection);
  out.tool = cleanText(out.tool, 48);
  out.ts = Date.now();
  return out;
}

function cleanCell(cell) {
  if (!cell || typeof cell !== 'object') return null;
  const out = {};
  // Copy only allowlisted fields, then deep-clone the survivors so we never
  // forward attacker-controlled prototype/extra keys downstream.
  for (const key of CELL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(cell, key)) out[key] = cell[key];
  }
  let copy;
  try {
    copy = JSON.parse(JSON.stringify(out));
  } catch (_) {
    return null;
  }
  // Normalize terrain/kind against the schema enums; clamp the stack counts.
  copy.terrain = TERRAIN_ENUM.has(copy.terrain) ? copy.terrain : 'grass';
  if (copy.kind != null && !KIND_ENUM.has(copy.kind)) copy.kind = null;
  if (copy.floors != null) copy.floors = clampFloors(copy.floors);
  if (copy.terrainFloors != null) copy.terrainFloors = clampFloors(copy.terrainFloors);
  if (!Array.isArray(copy.extras)) copy.extras = [];
  return copy;
}

function cleanCellSet(input) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  for (const key of OP_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) out[key] = input[key];
  }
  out.id = cleanText(out.id, 96) || String(Date.now());
  out.kind = 'cell.set';
  out.x = Math.round(cleanNumber(out.x));
  out.z = Math.round(cleanNumber(out.z));
  // Range-check coordinates so a crafted op (e.g. x/z = 9999999) cannot grow
  // every peer's world[x][z] without bound. Reject (drop) rather than clamp:
  // clamping to the home grid would break legitimate sparse ghost-board cells.
  if (!Number.isFinite(out.x) || !Number.isFinite(out.z)) return null;
  if (Math.abs(out.x) > MAX_CELL_COORD || Math.abs(out.z) > MAX_CELL_COORD) return null;
  out.cell = cleanCell(out.cell);
  out.ts = Date.now();
  if (!out.cell) return null;
  return out;
}

// Valid lobby/admit roles. 'host' is assigned by promotion only, never by the
// wire `role` field on admit/setRole (a host cannot mint another host).
const ASSIGNABLE_ROLES = new Set(['viewer', 'player', 'editor']);

function cleanRole(value) {
  return ASSIGNABLE_ROLES.has(value) ? value : 'viewer';
}

// Editor scope bounds. Returns null when not a usable rectangle (so an editor
// granted no/invalid bounds is treated as having no scope -> all edits drop).
function cleanIsland(value) {
  if (!value || typeof value !== 'object') return null;
  const minX = Math.round(cleanNumber(value.minX, NaN));
  const maxX = Math.round(cleanNumber(value.maxX, NaN));
  const minZ = Math.round(cleanNumber(value.minZ, NaN));
  const maxZ = Math.round(cleanNumber(value.maxZ, NaN));
  if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) return null;
  if (maxX < minX || maxZ < minZ) return null;
  return { minX, maxX, minZ, maxZ };
}

function inIsland(island, x, z) {
  if (!island) return false;
  return x >= island.minX && x <= island.maxX && z >= island.minZ && z <= island.maxZ;
}

function cleanZoneColor(value, fallback) {
  const s = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(s) ? s : fallback;
}

function cleanBuildZone(value, index = 0) {
  if (!value || typeof value !== 'object') return null;
  const rect = cleanIsland(value);
  if (!rect) return null;
  const id = cleanText(value.id, 64).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!id) return null;
  const label = cleanText(value.label, 32) || ('Zone ' + (index + 1));
  const palette = ['#36d576', '#4d8dff', '#ffbe55', '#d86bff', '#ff6b76', '#5ed6d0'];
  return Object.assign({}, rect, {
    id,
    label,
    active: value.active !== false,
    color: cleanZoneColor(value.color, palette[index % palette.length]),
  });
}

function cleanBuildZones(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < value.length && out.length < 32; i++) {
    const zone = cleanBuildZone(value[i], out.length);
    if (!zone || seen.has(zone.id)) continue;
    seen.add(zone.id);
    out.push(zone);
  }
  return out;
}

function cleanZoneIds(value, zoneMap) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of value) {
    const id = cleanText(raw, 64).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!id || seen.has(id)) continue;
    if (zoneMap && !zoneMap.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= 32) break;
  }
  return out;
}

function inBuildZones(zoneMap, zoneIds, x, z) {
  if (!zoneMap || !Array.isArray(zoneIds) || !zoneIds.length) return false;
  for (const id of zoneIds) {
    const zone = zoneMap.get(id);
    if (zone && zone.active !== false && inIsland(zone, x, z)) return true;
  }
  return false;
}

function inEditorScope(seat, zoneMap, x, z) {
  if (!seat) return false;
  if (Array.isArray(seat.zoneIds) && seat.zoneIds.length) return inBuildZones(zoneMap, seat.zoneIds, x, z);
  return inIsland(seat.island, x, z);
}

// ===================== Worlds MMO (playworlds-style) =====================
// Rooms whose id starts with 'world-' are authoritative per-world game rooms
// (PLAY / OBSERVE in a published world). Draft "build mode" is handled entirely
// client-side (the existing builder + the /api/worlds saveDraft endpoint), so the
// room only simulates published worlds. Money/ownership are durable in Postgres;
// the room flushes WHOLE-unit resource + tax deltas to /api/worlds/resources with
// a service token. These constants mirror the playworlds docs + the client HUD.
const WORLD_ROOM_PREFIX = 'world-';
const GROSS_REWARD = 3;
const HEART_MAX = 10;
const HEART_REGEN_MS = 60 * 1000;
const ACTION_COOLDOWN_MS = 5 * 1000;
const WORLD_CHAT_MAX = 280;
const ACTION_MS = { fish: 3000, mine: 5000, gather: 3000, hunt: 1000 };
const HARVEST_ACTIONS = new Set(['fish', 'mine', 'gather', 'hunt']);
const PLANT_KINDS = new Set(['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower']);
const ANIMAL_KINDS = new Set(['cow', 'sheep']);
const FISH_REGEN_MS = 20 * 1000;        // per fish charge, per connected water body
const FISH_MAX_PER_BODY = 4;
const PLANT_RIPEN_BASE_MS = 120 * 1000; // shrinks as grass count rises
const ORE_RESPAWN_BASE_MS = 90 * 1000;  // shrinks as stone count rises
const ANIMAL_MIN = 2;
const ANIMAL_MAX = 4;
const WORLD_TICK_MS = 5 * 1000;         // alarm cadence while a room is occupied

function cleanHarvestAction(value) {
  const a = String(value || '');
  return HARVEST_ACTIONS.has(a) ? a : null;
}

function actionDurationMs(action) {
  return ACTION_MS[action] || 3000;
}

// Movement: one cell at a time (Chebyshev distance exactly 1).
function isAdjacentStep(from, to) {
  if (!from || !to) return false;
  const dx = Math.abs(Math.round(to.x) - Math.round(from.x));
  const dz = Math.abs(Math.round(to.z) - Math.round(from.z));
  return dx <= 1 && dz <= 1 && dx + dz >= 1;
}

// Harvest reach: on the node or any of its 8 neighbors.
function withinReach(a, b) {
  if (!a || !b) return false;
  return Math.abs(Math.round(a.x) - Math.round(b.x)) <= 1
    && Math.abs(Math.round(a.z) - Math.round(b.z)) <= 1;
}

// Split a gross reward into owner / harvester thousandths (milli).
// NOW INTEGRATED with @tinyworld/mmo-core for guide policy (max 20%, default 5%).
// Owner keeps nothing when harvesting their own world, or when the world has no owner.
// Sums exactly to gross * 1000.
function taxSplit(gross, taxPercent, isOwner) {
  const grossAmount = Math.max(0, Math.round(gross));
  const total = grossAmount * 1000;

  if (isOwner || taxPercent == null) {
    return { owner: 0, harvester: total };
  }

  // Use package clamp + split logic (self-owner and no-owner cases already handled above)
  const event = { grossAmount, minerWallet: 'visitor', resource: 'ore' };
  const island = { id: 'world', ownerWallet: 'owner', taxRate: Number(taxPercent) };

  const split = applyIslandTax(event, island, DEFAULT_ECONOMY_POLICY);
  const taxRate = split.taxRate; // 0..0.2 already clamped by policy

  const ownerMilli = Math.round(total * taxRate);
  return { owner: ownerMilli, harvester: total - ownerMilli };
}

// Hearts regenerate 1/min up to max. Pure: returns the regen result for `now`.
function heartsNow(hearts, lastRegenAt, now, max = HEART_MAX, regenMs = HEART_REGEN_MS) {
  let h = Math.max(0, Math.min(max, Math.round(Number(hearts))));
  let last = Number(lastRegenAt) || now;
  if (h >= max) return { hearts: max, lastRegenAt: now };
  const gained = Math.floor((now - last) / regenMs);
  if (gained > 0) { h = Math.min(max, h + gained); last += gained * regenMs; }
  if (h >= max) last = now;
  return { hearts: h, lastRegenAt: last };
}

function oreRespawnMs(stoneCount, mod = 1) {
  return Math.round(ORE_RESPAWN_BASE_MS / (1 + Math.max(0, stoneCount) / 8) / mod);
}
function plantRipenMs(grassCount, mod = 1) {
  return Math.round(PLANT_RIPEN_BASE_MS / (1 + Math.max(0, grassCount) / 40) / mod);
}

function cellTerrain(cell) { return Array.isArray(cell) ? cell[2] : (cell && cell.terrain); }
function cellKind(cell) { return Array.isArray(cell) ? cell[3] : (cell && cell.kind); }
function cellX(cell) { return Array.isArray(cell) ? cell[0] : (cell && cell.x); }
function cellZ(cell) { return Array.isArray(cell) ? cell[1] : (cell && cell.z); }

// Resource action a cell currently affords, from its top tile (server-authoritative).
function nodeActionForCell(terrain, kind) {
  if (kind && ANIMAL_KINDS.has(kind)) return 'hunt';
  if (kind && PLANT_KINDS.has(kind)) return 'gather';
  if (terrain === 'water') return 'fish';
  if (terrain === 'stone') return 'mine';
  return null;
}

function isStandableObjectKind(kind) {
  if (!kind) return true;
  if (kind === 'stargate' || kind === 'bridge') return true;
  if (PLANT_KINDS.has(kind) || ANIMAL_KINDS.has(kind)) return true;
  // Low ground cover is decorative and should not block avatars.
  return kind === 'bush' || kind === 'flower' || kind === 'tuft';
}

// Supported home-board sizes (mirrors client HOME_GRID_OPTIONS / HOME_GRID_MAX,
// capped at 20x20). The renderer only knows this discrete set; an off-list size
// (older 18x18 / 22x22 seeds) makes the client's board, movement clamp, and
// stargate diverge from the server's authoritative grid. Snap UP to the nearest
// legal option that covers the content (18 -> 20, 22 -> 20) so the server's move
// bounds and the broadcast gridSize match what the client can render.
function snapWorldGridSize(n) {
  const v = Math.max(1, Math.round(Number(n) || 0));
  for (const size of [8, 10, 12, 16, 20]) if (size >= v) return size;
  return 20;
}

// Build the authoritative world state (node map + water bodies + standable terrain)
// from a world.schema.json v4 cells array. `rng` lets tests make ore tiers
// deterministic. Empty cells (the default grid) are walkable grass.
function deriveWorldState(data, rng = Math.random) {
  const gridSize = snapWorldGridSize((data && data.gridSize) || 8);
  const cells = data && Array.isArray(data.cells) ? data.cells : [];
  const byXZ = new Map();
  for (const c of cells) {
    const x = cellX(c), z = cellZ(c);
    if (x == null || z == null) continue;
    byXZ.set(Math.round(x) + ',' + Math.round(z), c);
  }
  const nodes = {};
  const cellIndex = {};   // 'x,z' -> nodeId (for fish this is the water body id)
  const animalCells = [];
  let stoneCount = 0;
  let spawnCell = null;

  // Connected water bodies via 4-neighbor flood fill; one shared fish node each.
  const waterSeen = new Set();
  for (const [key, c] of byXZ) {
    if (cellTerrain(c) !== 'water' || waterSeen.has(key)) continue;
    const stack = [key];
    const members = [];
    while (stack.length) {
      const k = stack.pop();
      if (waterSeen.has(k)) continue;
      const cc = byXZ.get(k);
      if (!cc || cellTerrain(cc) !== 'water') continue;
      waterSeen.add(k);
      members.push(k);
      const px = Math.round(cellX(cc)), pz = Math.round(cellZ(cc));
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = (px + dx) + ',' + (pz + dz);
        if (!waterSeen.has(nk) && byXZ.has(nk)) stack.push(nk);
      }
    }
    const id = 'wb:' + members[0];
    nodes[id] = { type: 'fish', charges: FISH_MAX_PER_BODY, maxCharges: FISH_MAX_PER_BODY, regenAt: 0, lockedBy: null };
    for (const k of members) cellIndex[k] = id;
  }

  // Ore (stone) + ripe plant nodes.
  for (const [key, c] of byXZ) {
    const terrain = cellTerrain(c), kind = cellKind(c);
    if (kind === 'stargate' && !spawnCell) {
      const x = Math.round(cellX(c));
      const z = Math.round(cellZ(c));
      if (Number.isFinite(x) && Number.isFinite(z)) spawnCell = { x, z };
    }
    if (ANIMAL_KINDS.has(kind)) {
      const x = Math.round(cellX(c));
      const z = Math.round(cellZ(c));
      if (Number.isFinite(x) && Number.isFinite(z)) animalCells.push({ x, z, kind });
    }
    if (terrain === 'stone') {
      stoneCount++;
      const r = rng();
      const tier = r < 0.5 ? 1 : (r < 0.85 ? 2 : 3);
      nodes['ore:' + key] = { type: 'ore', cell: key, tier, charges: tier, maxCharges: tier, respawnAt: 0, lockedBy: null };
      cellIndex[key] = 'ore:' + key;
    } else if (PLANT_KINDS.has(kind)) {
      nodes['plant:' + key] = { type: 'plant', cell: key, ripe: true, charges: 1, ripenAt: 0, lockedBy: null };
      cellIndex[key] = 'plant:' + key;
    }
  }

  // Standable terrain: any in-bounds cell that is not lava and carries no blocking
  // object. Default (absent) cells are grass. Unknown object kinds are solid by
  // default so new buildings/models do not become walk-through props.
  // `grassCells` is a legacy non-stone spawn/economy list; movement validates
  // against `standableCells` so stone walkways can be walked on.
  const grassCells = [];
  const standableCells = [];
  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      const c = byXZ.get(x + ',' + z);
      const terrain = c ? cellTerrain(c) : 'grass';
      const kind = c ? cellKind(c) : null;
      if (terrain === 'lava') continue;   // water/stone are walkable surfaces
      if (!isStandableObjectKind(kind)) continue;
      standableCells.push(x + ',' + z);
      if (terrain !== 'stone') grassCells.push(x + ',' + z);
    }
  }
  const grassCount = grassCells.length;
  const comfort = data && data.comfort ? data.comfort : Math.round(10 + (stoneCount * 0.6) + (grassCount / 12));
  const modifiers = data && data.modifiers ? data.modifiers : { fishing:1, mining:1, artifacts:1, comfortBonus:1 };
  return { gridSize, nodes, cellIndex, stoneCount, grassCount, grassCells, standableCells, animalCells, comfort, modifiers, spawnCell };
}

// ---- signed join token verification (Web Crypto HMAC-SHA256) ----
// The Netlify side signs with node:crypto (lib/worlds.mjs); both compute the same
// HMAC over the base64url payload string, so verification matches byte-for-byte.
function b64urlToString(s) {
  const b64 = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(b64, 'base64').toString('utf8');
}
function b64urlFromBytes(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function verifyJoinTokenWeb(token, secret) {
  if (!token || !secret) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    if (b64urlFromBytes(new Uint8Array(mac)) !== sig) return null;
    const payload = JSON.parse(b64urlToString(data));
    if (!payload || !payload.exp || Date.now() > Number(payload.exp)) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

export default class TinyWorldParty {
  constructor(room) {
    this.room = room;
    this.presence = new Map();
    this.interestVisible = new Map(); // connId -> Set of visible peer ids (for buildInterestSnapshot)
    // sender.id -> Map(type -> token bucket). Per-connection rate limit state.
    this.rateLimits = new Map();
    // The first connection becomes host. Only host messages (admit/decline/
    // kick/setRole) are honored.
    this.hostId = null;
    // id -> { role, island, zoneIds }. Admitted participants (presence + edits flow).
    this.admitted = new Map();
    // id -> { id, name, presence }. Pending lobby members awaiting admit.
    this.lobby = new Map();
    // id -> { role, island, zoneIds }. Remembered seats so a WS reconnect (stable _pk
    // conn id) re-admits a returning member instead of re-lobbying them.
    // Cleared on kick/decline; kept across a normal disconnect.
    this.seats = new Map();
    // Host-defined build zones for collaborative build rooms. These are
    // transient room permission data, not saved world cells.
    this.buildZones = new Map();
    // Explicit host-close state. A closed shared build must not promote a
    // replacement host on socket teardown or admit later connections.
    this.closed = false;

    // ---- Worlds MMO room state (only for 'world-' rooms) ----
    this.isWorldRoom = String((room && room.id) || '').startsWith(WORLD_ROOM_PREFIX);
    this.env = (room && room.env) || {};
    this.world = null;            // { id, taxPercent, ownerProfileId, ... } durable meta
    this.worldState = null;       // { gridSize, nodes, cellIndex, stoneCount, grassCount, grassCells, standableCells }
    this.worldLoading = null;     // in-flight load promise (load-once)
    this.players = new Map();     // id -> { x, z, hearts, lastRegenAt, cooldowns, profileId, role, name, busyUntil, busyNode }
    this.animals = [];            // [{ id, x, z }]
    this.animalSeq = 0;
    this.pendingResources = new Map();  // profileId -> { fish, meat, plants, ore }
    this.pendingTax = new Map();        // 'worldId:ownerId' -> { fish, meat, plants, ore }
    this.fracResources = new Map();     // profileId -> { fish, meat, plants, ore } milli remainders
    this.fracTax = new Map();           // ownerId -> { ... } milli remainders
    this.tickArmed = false;
    this.lastTickAt = Date.now();
    // True once any client joins without a verifiable token (no join secret
    // configured). In this mode the durable economy is disabled.
    this.openMode = false;
  }

  sendTo(id, obj) {
    const c = this.room.getConnection(id);
    if (c) c.send(JSON.stringify(obj));
  }

  // Broadcast only to admitted participants (incl. host). Lobby/un-admitted
  // connections must never receive world or presence data until admitted.
  broadcastToAdmitted(obj, exceptId) {
    const msg = JSON.stringify(obj);
    for (const id of this.admitted.keys()) {
      if (id === exceptId) continue;
      const c = this.room.getConnection(id);
      if (c) c.send(msg);
    }
  }

  pendingList() {
    return Array.from(this.lobby.values()).map(e => ({ id: e.id, name: e.name }));
  }

  zoneList() {
    return Array.from(this.buildZones.values());
  }

  closeBuildRoom(reason = 'Host closed the room') {
    if (this.isWorldRoom || this.closed) return false;
    this.closed = true;
    const ids = new Set([...this.admitted.keys(), ...this.lobby.keys()]);
    if (this.hostId) ids.add(this.hostId);
    const msg = { type: 'room.closed', reason: cleanText(reason, 120) || 'Host closed the room' };
    for (const id of ids) this.sendTo(id, msg);
    for (const id of ids) {
      const c = this.room.getConnection(id);
      if (c) c.close();
    }
    this.hostId = null;
    this.presence.clear();
    this.rateLimits.clear();
    this.admitted.clear();
    this.lobby.clear();
    this.seats.clear();
    this.buildZones.clear();
    return true;
  }

  onConnect(conn) {
    if (this.isWorldRoom) {
      // World rooms have no host/lobby: everyone connects as a provisional
      // observer and upgrades to play (or confirmed observe) via world.join.
      this.admitted.set(conn.id, { role: 'observe', island: null, profileId: null });
      conn.send(JSON.stringify({
        type: 'welcome',
        room: this.room.id,
        id: conn.id,
        role: 'observe',
        admitted: true,
        world: true,
        peers: Array.from(this.presence.values()),
      }));
      return;
    }
    if (this.closed) {
      conn.send(JSON.stringify({ type: 'room.closed', reason: 'Host closed the room' }));
      conn.close();
      return;
    }
    if (!this.hostId) {
      // First in the room is host: full rights, no lobby gate.
      this.hostId = conn.id;
      this.admitted.set(conn.id, { role: 'host', island: null, zoneIds: [] });
      conn.send(JSON.stringify({
        type: 'welcome',
        room: this.room.id,
        id: conn.id,
        role: 'host',
        admitted: true,
        peers: Array.from(this.presence.values()),
        zones: this.zoneList(),
      }));
      return;
    }
    // Returning admitted member: a WS reconnect reuses the same _pk conn id, so
    // re-admit from the remembered seat instead of bouncing them to the lobby.
    const seat = this.seats.get(conn.id);
    if (seat) {
      this.admitted.set(conn.id, { role: seat.role, island: seat.island, zoneIds: seat.zoneIds || [] });
      conn.send(JSON.stringify({
        type: 'welcome',
        room: this.room.id,
        id: conn.id,
        role: seat.role,
        island: seat.island || null,
        zoneIds: seat.zoneIds || [],
        admitted: true,
        peers: Array.from(this.presence.values()),
        zones: this.zoneList(),
      }));
      // A returning admitted member re-syncs to the host's current world via a
      // fresh snapshot (their local copy may be stale after the disconnect).
      if (this.hostId && this.hostId !== conn.id) this.sendTo(this.hostId, { type: 'snapshot.request', forId: conn.id });
      return;
    }
    // Public collab rooms default to viewable: everyone after the host joins as
    // an admitted viewer/observer. The host can promote them later, but edit
    // rights still go through role + zone/island checks below.
    const viewerSeat = { role: 'viewer', island: null, zoneIds: [] };
    this.admitted.set(conn.id, viewerSeat);
    this.seats.set(conn.id, viewerSeat);
    conn.send(JSON.stringify({
      type: 'welcome',
      room: this.room.id,
      id: conn.id,
      role: 'viewer',
      island: null,
      zoneIds: [],
      admitted: true,
      peers: Array.from(this.presence.values()),
      zones: this.zoneList(),
    }));
    if (this.hostId && this.hostId !== conn.id) this.sendTo(this.hostId, { type: 'snapshot.request', forId: conn.id });
  }

  async onMessage(message, sender) {
    const data = safeJson(message);
    if (!data || typeof data.type !== 'string') return;

    // Per-connection rate limit, separate buckets per message type. A hostile
    // client opening a raw socket ignores the client-side throttle, so drop
    // (return, no broadcast) once a connection exceeds its sustained rate. Host
    // moderation types (admit/decline/kick/setRole) are unbucketed (unknown to
    // RATE_LIMITS, so takeToken passes) — host-only and low volume.
    let buckets = this.rateLimits.get(sender.id);
    if (!buckets) {
      buckets = new Map();
      this.rateLimits.set(sender.id, buckets);
    }
    if (!takeToken(buckets, data.type, Date.now())) return;

    // World rooms run a separate, authoritative message path.
    if (this.isWorldRoom) return this.onWorldMessage(data, sender);

    if (data.type === 'room.close') {
      if (sender.id !== this.hostId) return;
      this.closeBuildRoom('Host closed the room');
      return;
    }

    if (data.type === 'control.claim') {
      const secret = this.env.WORLDS_JOIN_SECRET || this.env.WORLDS_SERVICE_TOKEN || '';
      const payload = await verifyJoinTokenWeb(data.token, secret);
      if (!payload || payload.typ !== 'tinyworld-collab-control' || payload.roomId !== this.room.id) return;
      const previousHostId = this.hostId;
      if (previousHostId && previousHostId !== sender.id) {
        this.sendTo(previousHostId, { type: 'snapshot.request', forId: sender.id });
      }
      this.hostId = sender.id;
      this.admitted.set(sender.id, { role: 'host', island: null, zoneIds: [] });
      this.seats.set(sender.id, { role: 'host', island: null, zoneIds: [] });
      this.sendTo(sender.id, {
        type: 'role',
        role: 'host',
        island: null,
        zoneIds: [],
        zones: this.zoneList(),
        admitted: true,
      });
      if (previousHostId && previousHostId !== sender.id) {
        const oldSeat = { role: 'viewer', island: null, zoneIds: [] };
        this.admitted.set(previousHostId, oldSeat);
        this.seats.set(previousHostId, oldSeat);
        this.sendTo(previousHostId, {
          type: 'role',
          role: 'viewer',
          island: null,
          zoneIds: [],
          zones: this.zoneList(),
          admitted: true,
        });
      }
      return;
    }

    if (data.type === 'presence') {
      const presence = cleanPresence(data.presence, sender.id);
      if (!presence) return;
      presence.id = sender.id;
      if (this.admitted.has(sender.id)) {
        // Admitted: store and re-broadcast presence to the room as before.
        this.presence.set(sender.id, presence);
        this.broadcastToAdmitted({ type: 'presence', presence }, sender.id);
        return;
      }
      // Lobby client: never re-broadcast. Just learn their name so the host can
      // label the admit panel; notify the host only when the name first appears
      // or changes (avoids re-toasting on the ~2.5s presence heartbeat).
      const entry = this.lobby.get(sender.id);
      if (!entry) return;
      const prevName = entry.name;
      entry.presence = presence;
      entry.name = presence.name || '';
      if (this.hostId && entry.name && entry.name !== prevName) {
        this.sendTo(this.hostId, { type: 'lobby.join', id: entry.id, name: entry.name });
      }
      return;
    }

    if (data.type === 'cell.set') {
      const op = cleanCellSet(data.op);
      if (!op) return;
      // GATING: edits flow only from the host or an admitted editor. Viewers,
      // players, and lobby clients are dropped. Never trust the client to stay
      // in scope: an editor's op is bounds-checked against its granted island.
      if (sender.id === this.hostId) {
        // host: unrestricted.
      } else {
        const seat = this.admitted.get(sender.id);
        if (!seat || seat.role !== 'editor') return;
        if (!inEditorScope(seat, this.buildZones, op.x, op.z)) return;
      }
      op.userId = sender.id;
      this.broadcastToAdmitted({ type: 'cell.set', op }, sender.id);
      return;
    }

    if (data.type === 'entity') {
      // Live entity transform (currently the flyable plane). NOT host-gated: any
      // admitted peer who is flying may broadcast their plane so others see a
      // ghost. The server stamps id = sender.id (overwrite the client value) so
      // a peer cannot spoof another's ghost, and relays to admitted peers EXCEPT
      // the sender — the flyer renders the real plane and must never get its own
      // ghost back (this exclusion is the whole echo-prevention story).
      if (!this.admitted.has(sender.id)) return;
      const kind = cleanText(data.kind, 24);
      if (kind !== 'plane') return;
      this.broadcastToAdmitted({
        type: 'entity',
        kind: 'plane',
        id: sender.id,
        active: data.active !== false,
        p: cleanVec3(data.p),
        r: cleanVec3(data.r),
      }, sender.id);
      return;
    }

    if (data.type === 'watcher') {
      // Host-only transient visual layer. This never touches snapshots/cells.
      if (sender.id !== this.hostId || !this.admitted.has(sender.id)) return;
      const watcher = cleanWatcherFrame(data.watcher);
      if (!watcher) return;
      this.broadcastToAdmitted({ type: 'watcher', source: sender.id, watcher }, sender.id);
      return;
    }

    if (data.type === 'chat') {
      // Multi-user chat. NOT host-gated: any admitted peer may post. The server
      // is the source of truth for identity + ordering: it stamps id = sender.id
      // (so a peer cannot spoof another's message) and ts = now (client ts is not
      // trusted). Name is taken from the trusted presence record when available,
      // else the cleaned client value. Text is hard-capped (the 48KB envelope
      // limit only gates the transport, not the rendered line). Broadcast to ALL
      // admitted INCLUDING the sender so chat is server-ordered and every client
      // renders on receipt through one path (the sender's own line included).
      if (!this.admitted.has(sender.id)) return;
      const text = cleanText(data.text, 1000);
      if (!text) return;
      const known = this.presence.get(sender.id);
      const name = cleanText((known && known.name) || data.name || 'Builder', 48) || 'Builder';
      // Monotonic per-room message id so replies can reference a specific line
      // (sender id collides across messages; ts can collide within a ms).
      const mid = 'm' + (this.chatSeq = (this.chatSeq || 0) + 1);
      // Quote-reply: carry a DENORMALIZED snapshot of the parent (id + name +
      // snippet) so a reply renders even for a peer that never saw the original
      // (no history replay on join). All fields are length-capped server-side.
      let replyTo = null;
      if (data.replyTo && typeof data.replyTo === 'object') {
        const rid = cleanText(data.replyTo.id, 64);
        const rname = cleanText(data.replyTo.name, 48);
        const rsnip = cleanText(data.replyTo.snippet, 120);
        if (rid && (rname || rsnip)) replyTo = { id: rid, name: rname || 'Builder', snippet: rsnip };
      }
      const msg = { type: 'chat', mid, id: sender.id, name, text, ts: Date.now() };
      if (replyTo) msg.replyTo = replyTo;
      this.broadcastToAdmitted(msg);
      return;
    }

    if (data.type === 'chat.typing') {
      // Typing indicator. Admitted-only; stamped id = sender.id. Broadcast to
      // admitted EXCEPT the sender (you never want your own typing indicator).
      if (!this.admitted.has(sender.id)) return;
      const known = this.presence.get(sender.id);
      const name = cleanText((known && known.name) || data.name || 'Builder', 48) || 'Builder';
      this.broadcastToAdmitted({ type: 'chat.typing', id: sender.id, name, typing: data.typing === true }, sender.id);
      return;
    }

    if (data.type === 'combat.hit') {
      // PvP damage report. Admitted-only. Routed ONLY to the targeted peer (not
      // broadcast); the server stamps by = sender.id so a peer cannot spoof the
      // shooter. The victim's own client owns its health/death.
      if (!this.admitted.has(sender.id)) return;
      const to = cleanText(data.to, 96);
      if (!to || !this.admitted.has(to)) return;
      const damage = Math.max(0, Math.min(10000, cleanNumber(data.damage, 0)));
      const source = cleanText(data.source, 24) || 'gun';
      this.sendTo(to, { type: 'combat.hit', to, by: sender.id, damage, source });
      return;
    }

    // ---- Shared-state sync (snapshot / env / moorings). ----
    // The server never trusts the client: snapshot/env/moorings are honored
    // ONLY from the current host. snapshot.request is server-generated only
    // (emitted from admit / re-admit below); a client claiming to be the host
    // cannot inject world/env into other peers.
    if (data.type === 'snapshot') {
      // Host-only. Relayed opaquely (chunked JSON of the host's full state) to
      // exactly the requesting peer, never broadcast.
      if (sender.id !== this.hostId) return;
      const forId = cleanText(data.forId, 96);
      if (!forId || !this.admitted.has(forId)) return;
      this.sendTo(forId, {
        type: 'snapshot',
        forId,
        seq: cleanNumber(data.seq, 0),
        total: cleanNumber(data.total, 0),
        chunk: typeof data.chunk === 'string' ? data.chunk : '',
      });
      return;
    }

    if (data.type === 'env') {
      // Host-only environment broadcast (time/weather/season/intensities/
      // shield/lights). Relayed as-is to admitted peers; the env payload is
      // applied through the client's own setters/controls, not trusted blindly.
      if (sender.id !== this.hostId) return;
      const env = (data.env && typeof data.env === 'object') ? data.env : null;
      if (!env) return;
      this.broadcastToAdmitted({ type: 'env', env }, sender.id);
      return;
    }

    if (data.type === 'moorings') {
      // Host-only full mooring-cable list (moorings are not cells, so cell.set
      // never carries them). Relayed to admitted peers, who replace their list.
      if (sender.id !== this.hostId) return;
      const moorings = Array.isArray(data.moorings) ? data.moorings.slice(0, 256) : null;
      if (!moorings) return;
      this.broadcastToAdmitted({ type: 'moorings', moorings }, sender.id);
      return;
    }

    if (data.type === 'zones.set') {
      // Host-only transient build-zone definitions. The server stores the
      // sanitized list so reconnecting/admitted peers inherit current scopes,
      // and cell.set can enforce assigned active zones server-side.
      if (sender.id !== this.hostId) return;
      const zones = cleanBuildZones(data.zones);
      this.buildZones = new Map(zones.map(zone => [zone.id, zone]));
      for (const seat of this.admitted.values()) {
        if (Array.isArray(seat.zoneIds)) seat.zoneIds = cleanZoneIds(seat.zoneIds, this.buildZones);
      }
      for (const [id, seat] of this.seats) {
        if (Array.isArray(seat.zoneIds)) {
          this.seats.set(id, Object.assign({}, seat, { zoneIds: cleanZoneIds(seat.zoneIds, this.buildZones) }));
        }
      }
      this.broadcastToAdmitted({ type: 'zones', zones: this.zoneList() });
      return;
    }

    // ---- Host-only moderation. Honored only from the current host. ----
    if (data.type === 'admit') {
      if (sender.id !== this.hostId) return;
      const id = cleanText(data.id, 96);
      const entry = this.lobby.get(id);
      if (!entry) return;
      const role = cleanRole(data.role);
      const zoneIds = role === 'editor' ? cleanZoneIds(data.zoneIds || data.zones, this.buildZones) : [];
      const island = role === 'editor' && !zoneIds.length ? cleanIsland(data.island) : null;
      this.lobby.delete(id);
      this.admitted.set(id, { role, island, zoneIds });
      this.seats.set(id, { role, island, zoneIds });
      if (this.hostId) this.sendTo(this.hostId, { type: 'lobby.leave', id });
      this.sendTo(id, {
        type: 'admitted',
        role,
        island,
        zoneIds,
        zones: this.zoneList(),
        peers: Array.from(this.presence.values()),
      });
      // Ask the host to ship this newly-admitted peer a full snapshot (world +
      // environment) so they land in the host's world, not their own. No-op if
      // the host's client is un-upgraded (it simply ignores snapshot.request).
      if (this.hostId && this.hostId !== id) this.sendTo(this.hostId, { type: 'snapshot.request', forId: id });
      return;
    }

    if (data.type === 'decline') {
      if (sender.id !== this.hostId) return;
      const id = cleanText(data.id, 96);
      if (!this.lobby.has(id)) return;
      this.lobby.delete(id);
      if (this.hostId) this.sendTo(this.hostId, { type: 'lobby.leave', id });
      this.sendTo(id, { type: 'declined' });
      const c = this.room.getConnection(id);
      if (c) c.close();
      return;
    }

    if (data.type === 'kick') {
      if (sender.id !== this.hostId) return;
      const id = cleanText(data.id, 96);
      if (id === this.hostId || !this.admitted.has(id)) return;
      this.admitted.delete(id);
      this.presence.delete(id);
      this.seats.delete(id);
      this.sendTo(id, { type: 'kicked' });
      const c = this.room.getConnection(id);
      if (c) c.close();
      // The kicked peer's presence vanishes; tell everyone else to drop them.
      this.broadcastToAdmitted({ type: 'leave', id }, id);
      return;
    }

    if (data.type === 'setRole') {
      if (sender.id !== this.hostId) return;
      const id = cleanText(data.id, 96);
      if (id === this.hostId) return;
      const seat = this.admitted.get(id);
      if (!seat) return;
      const role = cleanRole(data.role);
      const zoneIds = role === 'editor' ? cleanZoneIds(data.zoneIds || data.zones, this.buildZones) : [];
      const island = role === 'editor' && !zoneIds.length ? cleanIsland(data.island) : null;
      seat.role = role;
      seat.island = island;
      seat.zoneIds = zoneIds;
      this.seats.set(id, { role, island, zoneIds });
      this.sendTo(id, { type: 'role', role, island, zoneIds, zones: this.zoneList(), admitted: true });
      return;
    }
  }

  onClose(conn) {
    if (this.isWorldRoom) {
      // Release any node this player was working, drop presence, tell the room.
      const p = this.players.get(conn.id);
      if (p && p.busyNode && this.worldState && this.worldState.nodes[p.busyNode]
        && this.worldState.nodes[p.busyNode].lockedBy === conn.id) {
        this.worldState.nodes[p.busyNode].lockedBy = null;
        this.broadcastToAdmitted({ type: 'node.update', node: this.nodeWire(p.busyNode) });
      }
      this.players.delete(conn.id);
      this.presence.delete(conn.id);
      this.rateLimits.delete(conn.id);
      this.admitted.delete(conn.id);
      this.broadcastToAdmitted({ type: 'leave', id: conn.id }, conn.id);
      return;
    }
    const wasLobby = this.lobby.has(conn.id);
    if (this.closed) {
      this.presence.delete(conn.id);
      this.rateLimits.delete(conn.id);
      this.admitted.delete(conn.id);
      this.lobby.delete(conn.id);
      return;
    }
    const wasHost = conn.id === this.hostId;
    this.presence.delete(conn.id);
    this.rateLimits.delete(conn.id);
    this.admitted.delete(conn.id);
    this.lobby.delete(conn.id);
    // Only an admitted peer's departure is meaningful to other participants;
    // a lobby member was never visible to them.
    if (!wasLobby) this.broadcastToAdmitted({ type: 'leave', id: conn.id }, conn.id);
    // A pending lobby member leaving removes a row from the host's admit panel.
    if (wasLobby && this.hostId) this.sendTo(this.hostId, { type: 'lobby.leave', id: conn.id });

    if (wasHost) {
      this.hostId = null;
      // Prefer the oldest still-admitted connection (Map insertion order = age).
      let next = null;
      for (const id of this.admitted.keys()) { next = id; break; }
      if (next) {
        const seat = this.admitted.get(next);
        seat.role = 'host';
        seat.island = null;
        seat.zoneIds = [];
        this.hostId = next;
        this.sendTo(next, {
          type: 'role',
          role: 'host',
          island: null,
          zoneIds: [],
          zones: this.zoneList(),
          admitted: true,
          pending: this.pendingList(),
        });
        this.sendTo(next, { type: 'lobby.list', pending: this.pendingList() });
        return;
      }
      // No admitted peers left: auto-promote + admit the oldest lobby member.
      let oldest = null;
      for (const id of this.lobby.keys()) { oldest = id; break; }
      if (oldest) {
        this.lobby.delete(oldest);
        this.admitted.set(oldest, { role: 'host', island: null, zoneIds: [] });
        this.hostId = oldest;
        this.sendTo(oldest, {
          type: 'role',
          role: 'host',
          island: null,
          zoneIds: [],
          zones: this.zoneList(),
          admitted: true,
          pending: this.pendingList(),
        });
        this.sendTo(oldest, { type: 'lobby.list', pending: this.pendingList() });
      }
    }
  }

  // ===================== Worlds MMO room methods =====================

  resourceForAction(action) {
    return action === 'fish' ? 'fish' : action === 'mine' ? 'ore' : action === 'gather' ? 'plants' : 'meat';
  }

  siteBase() {
    return this.env.SITE_URL || this.env.URL || this.env.DEPLOY_PRIME_URL || '';
  }

  // Load + derive authoritative world state once (published worlds are public).
  ensureWorldLoaded(worldId) {
    if (this.worldState) return Promise.resolve(this.worldState);
    if (this.worldLoading) return this.worldLoading;
    this.worldLoading = (async () => {
      let data = { v: 4, gridSize: 8, cells: [] };
      const base = this.siteBase();
      if (base && typeof fetch === 'function') {
        try {
          const token = this.env.WORLDS_SERVICE_TOKEN || '';
          const res = await fetch(
            base + '/api/worlds?id=' + encodeURIComponent(worldId),
            token ? { headers: { 'x-worlds-token': token } } : undefined,
          );
          if (res.ok) {
            const body = await res.json();
            if (body && body.world) {
              this.world = body.world;
      if (this.world && this.world.taxPercent != null) {
        const rate = this.world.taxPercent > 1 ? this.world.taxPercent / 100 : this.world.taxPercent;
        this.world.taxPercent = Math.round(clampTaxRate(rate, DEFAULT_ECONOMY_POLICY) * 100);
      }
              if (body.world.data) {
                data = Object.assign({}, body.world.data, {
                  gridSize: body.world.data.gridSize || body.world.gridSize || 8,
                });
              }
            }
          }
        } catch (_) { /* fall back to an empty walkable world */ }
      }
      this.worldState = deriveWorldState(data);
      this.lastTickAt = Date.now();
      this.seedWorldAnimals();
      this.maintainAnimals();
      return this.worldState;
    })();
    return this.worldLoading;
  }

  // Inject world data directly (used by tests + when the client already holds the
  // authoritative published snapshot). Does not trust client data for money.
  setWorldStateFromData(data, meta) {
    this.world = meta || this.world;
    this.worldState = deriveWorldState(data || { v: 4, cells: [] });
      this.worldComfort = this.worldState.comfort || 10;
      this.worldModifiers = this.worldState.modifiers || {};
      this.hasSettlement = (data && data.cells && data.cells.some(c => ["house","fence"].includes(c.kind))) || false;
    this.lastTickAt = Date.now();
    this.seedWorldAnimals();
    this.maintainAnimals();
    return this.worldState;
  }

  safeSpawn() {
    const spawn = this.worldState && this.worldState.spawnCell;
    if (spawn && this.worldState.standableCells && this.worldState.standableCells.indexOf(spawn.x + ',' + spawn.z) >= 0) {
      return { x: spawn.x, z: spawn.z };
    }
    const cells = this.worldState && (this.worldState.standableCells || this.worldState.grassCells);
    if (cells && cells.length) {
      const k = cells[Math.floor(Math.random() * cells.length)];
      const [x, z] = k.split(',').map(Number);
      return { x, z };
    }
    return { x: 0, z: 0 };
  }

  getPlayer(id) {
    let p = this.players.get(id);
    if (!p) {
      const spawn = this.safeSpawn();
      p = { x: spawn.x, z: spawn.z, hearts: HEART_MAX, lastRegenAt: Date.now(), cooldowns: {}, profileId: null, role: 'observe', name: 'Builder', color: '#3c82f7', avatar: defaultAvatarForId(id), busyUntil: 0, busyNode: null, busyAction: null, busySeq: 0 };
      this.players.set(id, p);
    }
    const reg = heartsNow(p.hearts, p.lastRegenAt, Date.now());
    p.hearts = reg.hearts;
    p.lastRegenAt = reg.lastRegenAt;
    return p;
  }

  
// Interest-scoped peers using mmo-core (ClaudeCraft pattern starter)
  interestPeersFor(viewerId) {
    const viewer = this.getPlayer(viewerId);
    if (!viewer) return [];
    const entities = Array.from(this.players.entries()).map(([id, p]) => ({
      id,
      x: p.x, z: p.z,
      identity: { kind: "player", name: p.name || "", role: p.role },
      dynamic: { x: p.x, z: p.z }
    }));
    const prev = this.interestVisible.get(viewerId) || new Set();
    const hashes = new Map(); // simple for first pass
    try {
      const snap = buildInterestSnapshot({
        viewer: { id: viewerId, x: viewer.x, z: viewer.z },
        entities,
        previousVisibleIds: prev,
        config: { visibleRadius: 18, dropRadius: 22 }
      });
      this.interestVisible.set(viewerId, snap.nextVisibleIds || new Set());
      return snap.entities || [];
    } catch (e) {
      // fallback to full list
      return entities.map(e => ({ id: e.id, x: e.x, z: e.z }));
    }
  }

  presenceFor(id) {
    const p = this.getPlayer(id);
    return { id, name: p.name, color: p.color, cursor: { x: p.x, y: 0, z: p.z }, hearts: p.hearts, role: p.role, avatar: p.avatar || null };
  }

  nodeWire(nodeId) {
    const n = this.worldState && this.worldState.nodes[nodeId];
    if (!n) return { id: nodeId, gone: true };
    return { id: nodeId, type: n.type, cell: n.cell || null, charges: n.charges, maxCharges: n.maxCharges, locked: !!n.lockedBy };
  }

  worldSnapshotFor(id) {
    const nodes = {};
    if (this.worldState) for (const k of Object.keys(this.worldState.nodes)) nodes[k] = this.nodeWire(k);
    const p = this.getPlayer(id);
    return {
      type: 'world.state',
      gridSize: this.worldState ? this.worldState.gridSize : 8,
      taxPercent: this.world ? this.world.taxPercent : null,
      lastTaxChange: this.world ? this.world.lastTaxChange : null,
      you: { x: p.x, z: p.z, hearts: p.hearts, role: p.role, avatar: p.avatar || null },
      nodes,
      animals: this.animals,
      peers: this.interestPeersFor(id),
      // Standable cells, so any joiner (incl. the AI bot-runner) knows where it can
      // walk without trial-and-error against the move validator. Bounded by grid size.
      grassCells: this.worldState ? this.worldState.grassCells : [],
      standableCells: this.worldState ? (this.worldState.standableCells || this.worldState.grassCells) : [],
    };
  }

  async onWorldMessage(data, sender) {
    const id = sender.id;
    const type = data.type;

    if (type === 'world.join') {
      let role = 'observe';
      let profileId = null;
      const secret = this.env.WORLDS_JOIN_SECRET || this.env.WORLDS_SERVICE_TOKEN || '';
      const slug = String(this.room.id || '').slice(WORLD_ROOM_PREFIX.length);
      if (secret) {
        // Production: trust ONLY a valid signed join token. Resources flush to the
        // durable bank, so the role/profile must be cryptographically verified.
        const payload = await verifyJoinTokenWeb(data.token, secret);
        // Fail closed: a signed token must name THIS world. (Previously a
        // slug-less token was accepted on any world — a latent cross-world replay.)
        if (payload && payload.slug === slug) {
          // Old 'build' tokens are deliberately downgraded: multiplayer rooms are
          // play surfaces, and island editing/version publishing lives elsewhere.
          role = (payload.r === 'play' || payload.r === 'build') ? 'play' : 'observe';
          profileId = role === 'play' ? (payload.p || null) : null;
          if (payload.w) await this.ensureWorldLoaded(payload.w);
        }
        if (!this.worldState && data.worldId) await this.ensureWorldLoaded(data.worldId);
      } else {
        // Open testing mode (no WORLDS_JOIN_SECRET configured): trust the client's
        // declared role so a plain `partykit deploy` is playable with zero env.
        // No durable economy is engaged here — flushPending() is disabled in this
        // mode — so a spoofed profile only affects this room's local tallies.
        this.openMode = true;
        role = data.role === 'observe' ? 'observe' : 'play';
        profileId = data.profileId != null ? data.profileId : ('guest:' + id);
        if (this.siteBase() && data.worldId) await this.ensureWorldLoaded(data.worldId);
        if (!this.worldState) {
          this.setWorldStateFromData(
            { v: 4, gridSize: data.gridSize || 8, cells: Array.isArray(data.cells) ? data.cells : [] },
            { id: data.worldId, taxPercent: data.taxPercent != null ? data.taxPercent : null, ownerProfileId: data.ownerProfileId != null ? data.ownerProfileId : null, lastTaxChange: data.lastTaxChange || null },
          );
        }
      }
      const seat = this.admitted.get(id) || { role: 'observe', island: null };
      seat.role = role;
      seat.profileId = profileId;
      seat.isAdmin = false;
      this.admitted.set(id, seat);
      const p = this.getPlayer(id);
      p.role = role;
      p.profileId = profileId;
      p.name = cleanText(data.name, 48) || p.name;
      if (/^#[0-9a-f]{6}$/i.test(String(data.color || ''))) p.color = data.color;
      // Networked avatar identity: validate the untrusted descriptor. If a fresh
      // visitor has not picked one yet, keep a deterministic non-null voxel default
      // so the lobby always renders a visible player avatar immediately.
      const av = cleanAvatar(data.avatar);
      p.avatar = av || p.avatar || defaultAvatarForId(profileId || id);
      // Weekly payout based on token holding (called on join)
      const held = Number(data.tinyworldHeld) || 0;
      if (role === "play" && profileId && typeof this.grantWeeklyGoldPayout === "function") {
        this.grantWeeklyGoldPayout(profileId, held, 1); // 1 island demo
      }
      const spawn = this.safeSpawn();
      p.x = spawn.x; p.z = spawn.z;
      this.presence.set(id, this.presenceFor(id));
      this.sendTo(id, this.worldSnapshotFor(id));
      this.broadcastToAdmitted({ type: 'presence', presence: this.presenceFor(id) }, id);
      this.scheduleTick();
    // Interest tick: push scoped updates to all admitted (mmo-core buildInterestSnapshot)
    for (const pid of this.players.keys()) {
      try { if (typeof this.sendInterestUpdate === "function") this.sendInterestUpdate(pid); } catch(e){}
    }
      return;
    }

    if (type === 'presence') {
      // Lightweight presence refresh (name/color only; position is server-owned).
      const p = this.getPlayer(id);
      const nm = cleanText(data.presence && data.presence.name, 48);
      if (nm) p.name = nm;
      this.presence.set(id, this.presenceFor(id));
      this.broadcastToAdmitted({ type: 'presence', presence: this.presenceFor(id) }, id);
      return;
    }

    if (type === 'world.avatar') {
      if (!this.admitted.has(id)) return;
      const av = cleanAvatar(data.avatar);
      if (!av) return;
      const p = this.getPlayer(id);
      p.avatar = av;
      this.presence.set(id, this.presenceFor(id));
      this.broadcastToAdmitted({ type: 'presence', presence: this.presenceFor(id) }, id);
      return;
    }

    if (type === 'move') return this.handleMove(id, data);
    if (type === 'harvest.start') return this.handleHarvestStart(id, data);
    if (type === 'harvest.cancel') return this.handleHarvestCancel(id);

    if (type === 'chat') {
      if (!this.admitted.has(id)) return;
      const text = cleanText(data.text, WORLD_CHAT_MAX);
      if (!text) return;
      const p = this.getPlayer(id);
      this.broadcastToAdmitted({ type: 'chat', id, name: p.name, text, ts: Date.now() });
      return;
    }
    if (type === 'emote') {
      if (!this.admitted.has(id)) return;
      const cmd = cleanText(data.cmd, 16);
      if (!EMOTE_CMDS.has(cmd)) return;
      const p = this.getPlayer(id);
      this.broadcastToAdmitted({ type: 'emote', id, name: p.name, cmd, ts: Date.now() });
      return;
    }
    if (type === 'chat.typing') {
      if (!this.admitted.has(id)) return;
      const p = this.getPlayer(id);
      this.broadcastToAdmitted({ type: 'chat.typing', id, name: p.name, typing: data.typing === true }, id);
      return;
    }
    if (type === 'present') {
      // Lobby presentation control: an admitted peer advances the shared slide and
      // the server relays the index to EVERYONE (incl. sender) so all clients show
      // the same slide, server-ordered like chat. Just a clamped integer — no
      // economy state — so a guest presenting only changes what's on the screen.
      if (!this.admitted.has(id)) return;
      const slide = Math.round(Number(data.slide));
      if (!Number.isFinite(slide) || slide < 0 || slide > 999) return;
      const p = this.getPlayer(id);
      this.broadcastToAdmitted({ type: 'present', slide, id, name: p.name });
      return;
    }
    if (type === 'entity') {
      // Live flight transform relayed through the world-room path. MUST live here
      // (not in onMessage) because world rooms early-return to onWorldMessage at
      // the top of onMessage before any entity branch there can fire. Rate limiting
      // for the 'entity' bucket is applied by onMessage before the early-return, so
      // no second takeToken is needed here. The server stamps id = sender's id so a
      // peer cannot spoof another's ghost, and excludes the sender from the relay.
      if (!this.admitted.has(id)) return;
      const kind = cleanText(data.kind, 24);
      if (kind !== 'plane') return;
      this.broadcastToAdmitted({
        type: 'entity',
        kind: 'plane',
        id,
        active: data.active !== false,
        p: cleanVec3(data.p),
        r: cleanVec3(data.r),
      }, id);
      return;
    }

  }

  handleMove(id, data) {
    const p = this.getPlayer(id);
    if (p.role !== 'play' && p.role !== 'observe') return;
    if (p.role === 'play' && !p.profileId) return;    // play requires a logged-in profile; observe guests may roam
    if (Date.now() < p.busyUntil) return;             // movement locked during a harvest
    if (!this.worldState) return;
    const to = { x: Math.round(Number(data.x)), z: Math.round(Number(data.z)) };
    if (!Number.isFinite(to.x) || !Number.isFinite(to.z)) return;
    if (to.x < 0 || to.z < 0 || to.x >= this.worldState.gridSize || to.z >= this.worldState.gridSize) return;
    if (!isAdjacentStep({ x: p.x, z: p.z }, to)) return;        // one cell at a time
    const standableCells = this.worldState.standableCells || this.worldState.grassCells;
    if (standableCells.indexOf(to.x + ',' + to.z) < 0) return; // standable only
    p.x = to.x; p.z = to.z;
    this.presence.set(id, this.presenceFor(id));
    this.broadcastToAdmitted({ type: 'presence', presence: this.presenceFor(id) }, id);
  }

  // Resolve the target node id for a harvest request. Returns nodeId or null.
  resolveTargetNode(action, data) {
    if (!this.worldState) return null;
    if (action === 'hunt') {
      const aid = String(data.animalId || '');
      return this.animals.some(a => a.id === aid) ? ('animal:' + aid) : null;
    }
    const key = Math.round(Number(data.x)) + ',' + Math.round(Number(data.z));
    return this.worldState.cellIndex[key] || null;
  }

  handleHarvestStart(id, data) {
    const p = this.getPlayer(id);
    if (p.role !== 'play' || !p.profileId) return;     // observers/guests cannot harvest
    if (Date.now() < p.busyUntil) return;               // already harvesting
    const action = cleanHarvestAction(data.action);
    if (!action) return;
    if (p.hearts < 1) { this.sendTo(id, { type: 'harvest.deny', reason: 'no-hearts' }); return; }
    const cd = p.cooldowns[action] || 0;
    if (Date.now() < cd) { this.sendTo(id, { type: 'harvest.deny', reason: 'cooldown' }); return; }

    if (action === 'hunt') {
      const aid = String(data.animalId || '');
      const animal = this.animals.find(a => a.id === aid);
      if (!animal) return;
      if (!withinReach({ x: p.x, z: p.z }, animal)) { this.sendTo(id, { type: 'harvest.deny', reason: 'range' }); return; }
      // Animals have no charges and no lock; begin the (short) hunt.
      return this.beginHarvest(id, action, 'animal:' + aid, animal);
    }

    const nodeId = this.resolveTargetNode(action, data);
    const node = nodeId && this.worldState.nodes[nodeId];
    if (!node) { this.sendTo(id, { type: 'harvest.deny', reason: 'no-node' }); return; }
    // The action must match the node type.
    const expected = node.type === 'fish' ? 'fish' : node.type === 'ore' ? 'mine' : 'gather';
    if (expected !== action) { this.sendTo(id, { type: 'harvest.deny', reason: 'wrong-action' }); return; }
    const target = node.cell ? { x: Number(node.cell.split(',')[0]), z: Number(node.cell.split(',')[1]) }
      : { x: Math.round(Number(data.x)), z: Math.round(Number(data.z)) };
    if (!withinReach({ x: p.x, z: p.z }, target)) { this.sendTo(id, { type: 'harvest.deny', reason: 'range' }); return; }
    if (node.lockedBy && node.lockedBy !== id) { this.sendTo(id, { type: 'harvest.deny', reason: 'locked' }); return; }
    if ((node.charges || 0) < 1) { this.sendTo(id, { type: 'harvest.deny', reason: 'empty' }); return; }
    node.lockedBy = id;
    this.broadcastToAdmitted({ type: 'node.update', node: this.nodeWire(nodeId) });
    return this.beginHarvest(id, action, nodeId, null);
  }

  beginHarvest(id, action, nodeId, animal) {
    const p = this.getPlayer(id);
    p.hearts = Math.max(0, p.hearts - 1);              // 1 heart per harvest
    const dur = actionDurationMs(action);
    p.busyUntil = Date.now() + dur;
    p.busyNode = nodeId;
    p.busyAction = action;
    p.busySeq = (p.busySeq || 0) + 1;
    const seq = p.busySeq;
    this.presence.set(id, this.presenceFor(id));
    this.broadcastToAdmitted({ type: 'presence', presence: this.presenceFor(id) }, id);
    this.sendTo(id, { type: 'harvest.progress', action, node: nodeId, durationMs: dur, hearts: p.hearts });
    if (typeof setTimeout === 'function') setTimeout(() => this.resolveHarvest(id, seq), dur);
    return seq;
  }

  handleHarvestCancel(id) {
    const p = this.players.get(id);
    if (!p || !p.busyNode) return;
    const node = this.worldState && this.worldState.nodes[p.busyNode];
    if (node && node.lockedBy === id) {
      node.lockedBy = null;
      this.broadcastToAdmitted({ type: 'node.update', node: this.nodeWire(p.busyNode) });
    }
    p.busyUntil = 0; p.busyNode = null; p.busyAction = null; p.busySeq = (p.busySeq || 0) + 1;
  }

  resolveHarvest(id, seq) {
    const p = this.players.get(id);
    if (!p || p.busySeq !== seq || !p.busyAction) return; // superseded / cancelled
    const action = p.busyAction;
    const nodeId = p.busyNode;
    const resource = this.resourceForAction(action);

    // Apply the world effect (decrement charge / remove animal).
    if (action === 'hunt') {
      const aid = String(nodeId || '').slice('animal:'.length);
      this.animals = this.animals.filter(a => a.id !== aid);
      this.broadcastToAdmitted({ type: 'animal.remove', id: aid });
    } else {
      const node = this.worldState && this.worldState.nodes[nodeId];
      if (node) {
        node.charges = Math.max(0, (node.charges || 0) - 1);
        node.lockedBy = null;
        if (node.type === 'ore' && node.charges === 0) node.respawnAt = Date.now() + oreRespawnMs(this.worldState.stoneCount);
        if (node.type === 'plant' && node.charges === 0) { node.ripe = false; node.ripenAt = Date.now() + plantRipenMs(this.worldState.grassCount); }
        if (node.type === 'fish' && node.charges < node.maxCharges && !node.regenAt) node.regenAt = Date.now() + FISH_REGEN_MS;
        this.broadcastToAdmitted({ type: 'node.update', node: this.nodeWire(nodeId) });
      }
    }

    // Tax split. Owner harvesting own world (or an ownerless starter) keeps all.
    const ownerId = this.world && this.world.ownerProfileId != null ? Number(this.world.ownerProfileId) : null;
    const taxPercent = this.world ? this.world.taxPercent : null;
    const isOwner = ownerId != null && Number(p.profileId) === ownerId;
    const split = taxSplit(GROSS_REWARD, taxPercent, isOwner);
    this.accrueResource(p.profileId, resource, split.harvester);
    if (split.owner > 0 && ownerId != null) this.accrueTax(this.world.id, ownerId, resource, split.owner);
    // GOLD via mmo-core (real)
    try {
      if (!this.pendingGold) this.pendingGold = new Map();
      const wkey = "profile:" + (p.profileId || id);
      const ev = {type:"ALLOWANCE_RECALCULATED", wallet:wkey, cycleId:"weekly:"+Math.floor(Date.now()/(7*86400000)), amount:10, reason:"harvest", referenceId:"h"+Date.now()};
      const arr = this.pendingGold.get(wkey)||[]; arr.push(ev); this.pendingGold.set(wkey, arr);
    } catch(e){}


    // Cooldown + clear busy.
    p.cooldowns[action] = Date.now() + ACTION_COOLDOWN_MS;
    p.busyUntil = 0; p.busyNode = null; p.busyAction = null;
    this.presence.set(id, this.presenceFor(id));
    this.broadcastToAdmitted({ type: 'presence', presence: this.presenceFor(id) }, id);
    this.sendTo(id, {
      type: 'harvest.result', action, resource,
      grossMilli: GROSS_REWARD * 1000, harvesterMilli: split.harvester, ownerMilli: split.owner,
      cooldownMs: ACTION_COOLDOWN_MS, hearts: p.hearts,
    });
    this.scheduleTick();
    // Interest tick: push scoped updates to all admitted (mmo-core buildInterestSnapshot)
    for (const pid of this.players.keys()) {
      try { if (typeof this.sendInterestUpdate === "function") this.sendInterestUpdate(pid); } catch(e){}
    }
  }

  accrueResource(profileId, resource, milli) {
    if (!profileId || milli <= 0) return;
    const pid = String(profileId);
    const frac = this.fracResources.get(pid) || { fish: 0, meat: 0, plants: 0, ore: 0 };
    frac[resource] += milli;
    const whole = Math.floor(frac[resource] / 1000);
    if (whole > 0) {
      frac[resource] -= whole * 1000;
      const pend = this.pendingResources.get(pid) || { fish: 0, meat: 0, plants: 0, ore: 0 };
      pend[resource] += whole;
      this.pendingResources.set(pid, pend);
    }
    this.fracResources.set(pid, frac);
  }

  accrueTax(worldId, ownerId, resource, milli) {
    if (!ownerId || milli <= 0) return;
    const oid = String(ownerId);
    const frac = this.fracTax.get(oid) || { fish: 0, meat: 0, plants: 0, ore: 0 };
    frac[resource] += milli;
    const whole = Math.floor(frac[resource] / 1000);
    if (whole > 0) {
      frac[resource] -= whole * 1000;
      const key = worldId + ':' + oid;
      const pend = this.pendingTax.get(key) || { fish: 0, meat: 0, plants: 0, ore: 0 };
      pend[resource] += whole;
      this.pendingTax.set(key, pend);
    }
    this.fracTax.set(oid, frac);
  }

  hasPending() {
    return this.pendingResources.size > 0 || this.pendingTax.size > 0 || (this.pendingGold && this.pendingGold.size > 0);
  }

  // Flush whole-unit resource + tax deltas to the durable bank. Cleared only on
  // a 2xx so a transient failure never loses grants.
  async flushPending() {
    if (this.openMode) return;          // testing mode never touches the durable bank
    if (!this.hasPending()) return;
    const base = this.siteBase();
    const token = this.env.WORLDS_SERVICE_TOKEN || '';
    if (!base || !token || typeof fetch !== 'function') return; // keep buffered until configured
    const resources = {};
    for (const [pid, d] of this.pendingResources) resources[pid] = d;
    const taxPayouts = {};
    for (const [key, d] of this.pendingTax) {
      const [wid, oid] = key.split(':');
      taxPayouts[wid] = taxPayouts[wid] || {};
      taxPayouts[wid][oid] = d;
    }
    try {
      const res = await fetch(base + '/api/worlds/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-worlds-token': token },
        body: JSON.stringify({ resources, taxPayouts, goldEvents: Object.fromEntries(this.pendingGold || new Map()) }),
      });
      if (res.ok) { this.pendingResources.clear(); this.pendingTax.clear(); this.pendingGold?.clear(); }
    } catch (_) { /* keep buffered for the next flush */ }
  }

  // Lazy time-delta regrowth: bring nodes/animals forward by elapsed time in one
  // pass so empty worlds are correct the instant anyone (re)enters.
  tickWorld(now = Date.now()) {
    if (!this.worldState) return;
    for (const id of Object.keys(this.worldState.nodes)) {
      const n = this.worldState.nodes[id];
      if (n.type === 'fish') {
        if (n.charges < n.maxCharges && n.regenAt && now >= n.regenAt) {
          const steps = 1 + Math.floor((now - n.regenAt) / FISH_REGEN_MS);
          n.charges = Math.min(n.maxCharges, n.charges + steps);
          n.regenAt = n.charges < n.maxCharges ? now + FISH_REGEN_MS : 0;
          this.broadcastToAdmitted({ type: 'node.update', node: this.nodeWire(id) });
        }
      } else if (n.type === 'ore') {
        if (n.charges === 0 && n.respawnAt && now >= n.respawnAt) {
          n.charges = n.maxCharges; n.respawnAt = 0;
          this.broadcastToAdmitted({ type: 'node.update', node: this.nodeWire(id) });
        }
      } else if (n.type === 'plant') {
        if (!n.ripe && n.ripenAt && now >= n.ripenAt) {
          n.ripe = true; n.charges = 1; n.ripenAt = 0;
          this.broadcastToAdmitted({ type: 'node.update', node: this.nodeWire(id) });
        }
      }
    }
    this.maintainAnimals();
    this.lastTickAt = now;
  }

  maintainAnimals() {
    if (!this.worldState) return;
    const cells = this.worldState.grassCells;
    if (!cells || !cells.length) return;
    while (this.animals.length < ANIMAL_MIN) this.spawnAnimal();
    // Opportunistically top up toward the max; never exceed it.
    if (this.animals.length < ANIMAL_MAX && Math.random() < 0.5) this.spawnAnimal();
  }

  seedWorldAnimals() {
    if (!this.worldState || this.animals.length) return;
    const seeded = Array.isArray(this.worldState.animalCells) ? this.worldState.animalCells : [];
    for (const cell of seeded.slice(0, ANIMAL_MAX)) {
      const id = 'an' + (++this.animalSeq);
      this.animals.push({ id, x: cell.x, z: cell.z, kind: cell.kind });
    }
  }

  spawnAnimal() {
    if (this.animals.length >= ANIMAL_MAX) return;
    const cells = this.worldState.grassCells;
    const k = cells[Math.floor(Math.random() * cells.length)];
    const [x, z] = k.split(',').map(Number);
    const id = 'an' + (++this.animalSeq);
    const animal = { id, x, z };
    this.animals.push(animal);
    this.broadcastToAdmitted({ type: 'animal.spawn', animal });
  }

  
  sendInterestUpdate(toId) {
    try {
      const scoped = this.interestPeersFor(toId);
      if (scoped && scoped.length) {
        this.sendTo(toId, { type: "world.interest", peers: scoped });
      }
    } catch (e) {}
  }

  scheduleTick() {
    if (this.tickArmed) return;
    const storage = this.room && this.room.storage;
    if (storage && typeof storage.setAlarm === 'function') {
      this.tickArmed = true;
      try { storage.setAlarm(Date.now() + WORLD_TICK_MS); } catch (_) { this.tickArmed = false; }
    }
  }

  async onAlarm() {
    this.tickArmed = false;
    if (!this.isWorldRoom) return;
    this.tickWorld(Date.now());
    await this.flushPending();
    // Keep ticking while anyone is connected.
    if (this.presence.size > 0) this.scheduleTick();
    // demo weekly payout tick for all (real cycle check inside grant)
    for (const [pid, seat] of this.admitted) {
      if (seat.profileId && typeof this.grantWeeklyGoldPayout === "function") this.grantWeeklyGoldPayout(seat.profileId, 10000, 1);
    }
    // Interest tick: push scoped updates to all admitted (mmo-core buildInterestSnapshot)
    for (const pid of this.players.keys()) {
      try { if (typeof this.sendInterestUpdate === "function") this.sendInterestUpdate(pid); } catch(e){}
    }
  }

  onError(conn) {
    this.onClose(conn);
  }
}

// Named exports for unit tests only. PartyKit consumes the default export (the
// room class); these pure helpers are inert at runtime and let
// tests/party.test.mjs exercise the validation / gating logic directly.
export {
  cleanText, cleanNumber, cleanVec3, cleanCursor, cleanSelection,
  cleanPresence, cleanAvatar, cleanCell, cleanCellSet, cleanRole, cleanIsland,
  cleanBuildZone, cleanBuildZones, cleanZoneIds, inBuildZones, inEditorScope,
  clampFloors, inIsland, takeToken, safeJson, RATE_LIMITS, MAX_CELL_COORD, MAX_FLOORS,
  // Worlds MMO pure helpers (authoritative game rules).
  cleanHarvestAction, actionDurationMs, isAdjacentStep, withinReach, taxSplit,
  heartsNow, oreRespawnMs, plantRipenMs, nodeActionForCell, deriveWorldState,
  verifyJoinTokenWeb, GROSS_REWARD, HEART_MAX, HEART_REGEN_MS, ACTION_COOLDOWN_MS,
  ACTION_MS, WORLD_CHAT_MAX,
};
