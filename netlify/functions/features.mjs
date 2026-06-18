import { getSql, isDatabaseUnavailable } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse, readJson, sameOriginWriteGuard } from './lib/http.mjs';
import { getAuthUser, requireAuthUser } from './lib/auth.mjs';
import { isWorldAdminEmail } from './lib/worlds.mjs';

export const config = { path: '/api/features' };

// Coin-holder gate: minimum token balance to submit a suggestion (server-enforced
// in a future step when Solana RPC is wired; for now the client enforces it).
const MIN_COIN_BALANCE = 100;

// WAVE launch taxonomy: constrain the label server-side to a small known set so
// arbitrary client strings can never be stored or filtered on. Anything else
// (incl. 'none'/'') normalizes to null = no wave.
const WAVES = ['WAVE1', 'WAVE2', 'WAVE3'];
function normalizeWave(value) {
  const s = String(value == null ? '' : value).trim().toUpperCase();
  return WAVES.includes(s) ? s : null;
}

// Curated idea pool harvested from the design docs, the Skybound roadmap
// (plans/ROADMAP-skybound.md), the fork-improvement harvest, and existing
// infra seams. These are intentionally broad — the team filters/triages them on
// the Suggest board. Every entry is attributed to 'admin' (renders as "Team").
const SEED_SUGGESTIONS = [
  // -------- world & gameplay --------
  { title: 'NPC companions', description: 'Add AI-driven NPCs that wander your world and interact with players — merchants, wanderers, quest-givers.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Weather system', description: 'Dynamic weather — rain, fog, storms, and sunshine — that affects crop growth and atmosphere.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'World portals', description: 'Place a portal in your world that links to another player\'s world. Teleport between tinyverses seamlessly.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Custom biomes', description: 'Choose from desert, tundra, jungle, or ocean biomes as the base environment for your world.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Player housing', description: 'Let visiting players claim a small plot inside a world and build a personal dwelling.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Day / night cycle', description: 'Wire atmosphere time-progression to a UI scrubber with real-time sky-colour transitions, lamps that light at dusk, and night ambience.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Pets', description: 'Companion animals that follow your avatar and can be customised via an open-pets provider system.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },

  // -------- Skybound vision (planet + survival loop) --------
  { title: 'Fly down to the planet surface', description: 'Make the sea-covered planet beneath the floating islands reachable: extend camera far-plane with altitude, planet-aware flight collision, and a cloud-sea descent transition so you can land and splash down.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Surface settlements & survivors', description: 'Procedurally place land-island settlements (huts, docks, fires) on the planet and populate them with voxel NPC survivors who offer scavenge, trade, and artifact quests.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Artifact quests & island lift lore', description: 'Recover artifacts on the surface that let you raise a land island into the sky as a new floating world — the core loop between the two layers.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Networked voxel avatar identity', description: 'Network a per-player voxel avatar descriptor (skin / outfit / gear) through join + presence so every peer and bot renders as their own character instead of the local default.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Avatar hit & death reactions', description: 'Port voxel-poser IK and optional per-instance ragdoll so avatars react to hits and deaths instead of snapping.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },

  // -------- crafting / economy --------
  { title: 'Mining, foraging & crafting loop', description: 'Add an inventory item table, static recipes, and an atomic resource-spend path so gathered resources can be crafted into tools and structures instead of being add-only.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Resource-gated building', description: 'Make placing objects cost inventory items — building draws down your crafted/gathered resources.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Tool tiers & variable yields', description: 'Better tools harvest faster and return more; tree→wood and richer node yields broaden the gather economy.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'World marketplace', description: 'Browse, buy, and remix worlds created by the community directly from the tinyverse map.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },

  // -------- combat / multiplayer --------
  { title: 'Server-authoritative PvP battles', description: 'A dedicated battle-room type with server-owned HP, hit validation, kills, respawn, and scoring — replacing the current client-trusting honor-system combat.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Game modes & teams', description: 'Match lifecycle (lobby → countdown → round → results) with team assignment, shared HP bars on ghosts, and a scoreboard.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Working cannons & turrets', description: 'Make the cosmetic island shield guns fire real projectiles registered as combat targets, with destructible scenery.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Voice chat in worlds', description: 'Proximity / party voice chat inside a world room, built on the existing LiveKit token infrastructure.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Community hub — rooms, DMs & profiles', description: 'A lightweight Discord-style community space: text rooms, direct messages, member directory with avatars and profiles, invites, and moderation (rate limiting, blocking, timed bans).', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Spectator mode', description: 'Drop into a published world or battle as a non-interacting spectator to watch the action.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },

  // -------- platform / UX --------
  { title: 'Mobile touch controls & responsive layout', description: 'Touch-first build controls and a responsive layout so worlds can be built and played on phones and tablets.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Share a world via link', description: 'Load a world directly from a shareable ?world= URL (inline or hosted JSON), with allowlisting so the fetch is safe.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'Crowd walk-trail toggle', description: 'An optional rendered trail showing where ambient crowd people have walked, with a show/hide setting.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
  { title: 'WebXR / VR world immersion', description: 'Step inside your world in VR or place it on your desk in AR via the existing WebXR seam.', wallet: 'admin', coin_balance: 100, vote_weight: 0, status: 'open' },
];

// Additive seeding: insert any curated suggestion whose title is not already
// present (matched case-insensitively). This lets newly-harvested ideas land on
// an already-populated board on the next deploy, instead of only seeding a
// brand-new empty table.
async function seedSuggestions(sql) {
  const existing = await sql`SELECT LOWER(title) AS title FROM feature_suggestions`;
  const have = new Set(existing.map(r => r.title));
  for (const s of SEED_SUGGESTIONS) {
    if (have.has(s.title.toLowerCase())) continue;
    await sql`
      INSERT INTO feature_suggestions (title, description, wallet, coin_balance, vote_weight, status)
      VALUES (${s.title}, ${s.description}, ${s.wallet}, ${s.coin_balance}, ${s.vote_weight}, ${s.status})
      ON CONFLICT DO NOTHING
    `;
  }
}

async function ensureTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS feature_suggestions (
      id            SERIAL PRIMARY KEY,
      title         TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      wallet        TEXT NOT NULL,
      coin_balance  BIGINT NOT NULL DEFAULT 0,
      vote_weight   BIGINT NOT NULL DEFAULT 0,
      status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','planned','done','rejected')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // WAVE launch label (Phase 2). Idempotent ALTER so fresh and older databases
  // — including prod where migrations lag — gain the column before any write
  // references it. Mirrors migration 20260618000000_wave_labels.sql.
  await sql`ALTER TABLE feature_suggestions ADD COLUMN IF NOT EXISTS wave TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS feature_votes (
      id            SERIAL PRIMARY KEY,
      suggestion_id INT  NOT NULL REFERENCES feature_suggestions(id) ON DELETE CASCADE,
      wallet        TEXT NOT NULL,
      coin_balance  BIGINT NOT NULL DEFAULT 0,
      vote          SMALLINT NOT NULL DEFAULT 1 CHECK (vote IN (1,-1)),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (suggestion_id, wallet)
    )
  `;
}

function suggestionDto(row) {
  return {
    id:           row.id,
    title:        row.title,
    description:  row.description,
    wallet:       row.wallet,
    vote_weight:  Number(row.vote_weight) || 0,
    status:       row.status,
    wave:         row.wave || null,
    created_at:   row.created_at,
  };
}

function envValue(name) {
  try {
    if (globalThis.Netlify && Netlify.env && typeof Netlify.env.get === 'function') {
      const value = Netlify.env.get(name);
      if (value) return value;
    }
  } catch (_) {}
  return process.env[name] || '';
}

// Admin authority is decided SERVER-SIDE from a verified account session.
// Prod path: the requester's Netlify Identity (or wallet) session resolves to an
// email on the world-admin allowlist (isWorldAdminEmail). No host check, so it
// works on production. Authority is the verified email only — never a client flag.
async function isAdmin(request) {
  try {
    const user = await getAuthUser(request);
    if (user && isWorldAdminEmail(user.email)) return true;
  } catch (_) {}
  return isLocalSecretAdmin(request);
}

// LOCALHOST-ONLY DEV FALLBACK: the legacy shared secret. Never grants admin off
// localhost — the host check fails closed on every non-local request.
function isLocalSecretAdmin(request) {
  try {
    const host = (request.headers.get('host') || '').toLowerCase();
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return false;
  } catch (_) { return false; }
  const secret = envValue('TINYWORLD_ADMIN_SECRET');
  if (!secret) return false;
  return (request.headers.get('x-admin-secret') || '') === secret;
}

export default async function featuresFunction(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);

  // ---- GET — public list ----
  if (request.method === 'GET') {
    try {
      const sql = getSql();
      await ensureTables(sql);
      await seedSuggestions(sql);
      const url = new URL(request.url);
      const status = url.searchParams.get('status') || 'open';
      // Public wave filter: ?wave=WAVE1. Unknown values normalize to null = no filter.
      const wave = normalizeWave(url.searchParams.get('wave'));
      const rows = await sql`
        SELECT * FROM feature_suggestions
        WHERE ${status === 'all' ? sql`TRUE` : sql`status = ${status}`}
          AND ${wave ? sql`wave = ${wave}` : sql`TRUE`}
        ORDER BY vote_weight DESC, created_at DESC
        LIMIT 200
      `;
      return jsonResponse({ suggestions: rows.map(suggestionDto), admin: await isAdmin(request) }, origin);
    } catch (err) {
      if (isDatabaseUnavailable(err)) return jsonResponse({ suggestions: [], source: 'unavailable' }, origin);
      console.error('[features] GET error:', err);
      return errorResponse('Database error', 500, origin);
    }
  }

  // ---- POST — submit a suggestion (requires wallet auth or admin) ----
  if (request.method === 'POST') {
    const isAdminReq = await isAdmin(request);
    // CSRF / same-origin guard, scoped to the admin-authenticated path only: admin
    // sessions are cookie-ambient, so a cross-site POST riding the admin cookie must
    // be rejected. The public wallet vote/suggest path is left untouched (Phase 3
    // tightens that separately).
    if (isAdminReq && !sameOriginWriteGuard(request)) return errorResponse('Forbidden', 403, origin);
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'suggest';

    const body = await readJson(request);
    const rawWallet = String(body && body.wallet || '').trim();
    const wallet = rawWallet || (isAdminReq ? 'admin' : '');
    if (!wallet) return errorResponse('wallet is required', 400, origin);

    const coinBalance = isAdminReq
      ? MIN_COIN_BALANCE
      : Math.max(0, Math.round(Number(body && body.coinBalance) || 0));

    if (action === 'vote') {
      const suggestionId = Number(body && body.suggestionId);
      const vote = Number(body && body.vote) === -1 ? -1 : 1;
      if (!suggestionId) return errorResponse('suggestionId is required', 400, origin);
      if (!isAdminReq && coinBalance < MIN_COIN_BALANCE) return errorResponse('Insufficient coin balance to vote', 403, origin);
      try {
        const sql = getSql();
        await ensureTables(sql);
        await sql`
          INSERT INTO feature_votes (suggestion_id, wallet, coin_balance, vote)
          VALUES (${suggestionId}, ${wallet}, ${coinBalance}, ${vote})
          ON CONFLICT (suggestion_id, wallet) DO UPDATE
            SET vote = ${vote}, coin_balance = ${coinBalance}, created_at = NOW()
        `;
        // Recompute vote_weight as sum of coin_balance * vote.
        await sql`
          UPDATE feature_suggestions
          SET vote_weight = (
            SELECT COALESCE(SUM(coin_balance * vote), 0)
            FROM feature_votes
            WHERE suggestion_id = ${suggestionId}
          ), updated_at = NOW()
          WHERE id = ${suggestionId}
        `;
        const rows = await sql`SELECT * FROM feature_suggestions WHERE id = ${suggestionId}`;
        return jsonResponse({ suggestion: rows.length ? suggestionDto(rows[0]) : null }, origin);
      } catch (err) {
        console.error('[features] vote error:', err);
        return errorResponse('Database error', 500, origin);
      }
    }

    // suggest
    const title = String(body && body.title || '').slice(0, 200).trim();
    const description = String(body && body.description || '').slice(0, 1000).trim();
    if (!title) return errorResponse('title is required', 400, origin);
    if (!isAdminReq && coinBalance < MIN_COIN_BALANCE) return errorResponse('You must hold at least ' + MIN_COIN_BALANCE + ' coins to suggest features', 403, origin);
    try {
      const sql = getSql();
      await ensureTables(sql);
      const rows = await sql`
        INSERT INTO feature_suggestions (title, description, wallet, coin_balance, vote_weight)
        VALUES (${title}, ${description}, ${wallet}, ${coinBalance}, ${coinBalance})
        RETURNING *
      `;
      return jsonResponse({ suggestion: suggestionDto(rows[0]) }, origin, 201);
    } catch (err) {
      console.error('[features] suggest error:', err);
      return errorResponse('Database error', 500, origin);
    }
  }

  // ---- PATCH — admin status update ----
  if (request.method === 'PATCH') {
    if (!(await isAdmin(request))) return errorResponse('Forbidden', 403, origin);
    if (!sameOriginWriteGuard(request)) return errorResponse('Forbidden', 403, origin);
    const url = new URL(request.url);
    const id = Number(url.searchParams.get('id'));
    if (!id) return errorResponse('id is required', 400, origin);
    const body = await readJson(request);
    const status = ['open','planned','done','rejected'].includes(body && body.status) ? body.status : null;
    // wave is set/cleared explicitly: a provided 'none'/'' normalizes to null (a real
    // clear) and bypasses COALESCE, which would treat null as "leave unchanged".
    const waveProvided = !!(body && Object.prototype.hasOwnProperty.call(body, 'wave'));
    const wave = waveProvided ? normalizeWave(body.wave) : null;
    if (!status && !waveProvided) return errorResponse('status or wave is required', 400, origin);
    try {
      const sql = getSql();
      const rows = await sql`
        UPDATE feature_suggestions SET
          status = COALESCE(${status}, status),
          wave = CASE WHEN ${waveProvided} THEN ${wave} ELSE wave END,
          updated_at = NOW()
        WHERE id = ${id} RETURNING *
      `;
      if (!rows.length) return errorResponse('Not found', 404, origin);
      return jsonResponse({ suggestion: suggestionDto(rows[0]) }, origin);
    } catch (err) {
      console.error('[features] PATCH error:', err);
      return errorResponse('Database error', 500, origin);
    }
  }

  return errorResponse('Method not allowed', 405, origin);
}
