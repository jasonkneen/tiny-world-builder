import { getSql, isDatabaseUnavailable, isMissingRelation } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse, readJson, sameOriginWriteGuard } from './lib/http.mjs';
import { getAuthUser } from './lib/auth.mjs';
import { isWorldAdminEmail } from './lib/worlds.mjs';

export const config = { path: '/api/roadmap' };

// Hardcoded fallback — shown when the DB is unavailable or the table doesn't exist yet.
const FALLBACK_MILESTONES = [
  { id: 1, status: 'done',    title: 'Tinyverse',           description: 'Buy, manage, and publish worlds on-chain. Explore as an avatar, harvest resources, and meet other players.', sort_order: 10 },
  { id: 2, status: 'done',    title: 'Flight sim',           description: 'Place the stunt-plane stamp, click to board, and fly your world from a rear chase-cam.', sort_order: 20 },
  { id: 3, status: 'done',    title: 'Mesh terrain sculptor',description: 'Paint per-voxel materials and push/pull flat-topped blocks to shape cliffs, rivers, and landscapes.', sort_order: 30 },
  { id: 4, status: 'done',    title: '3D model import',      description: 'Drag-drop GLB, FBX, OBJ, MagicaVoxel VOX, and VDB frame-sequence files directly into the scene.', sort_order: 40 },
  { id: 5, status: 'done',    title: 'Multiplayer rooms',    description: 'Join a world room via PartyKit. See other players as sprites and chat in real time.', sort_order: 50 },
  { id: 6, status: 'done',    title: 'Performance pass',     description: 'Shadow cadence at 30 Hz, scoped frustum culling, and static engine batching cut draw calls by 42%.', sort_order: 60 },
  { id: 13, status: 'done',   title: 'Voxel avatars',        description: 'Per-player humanoid voxel characters with a procedural walk cycle replace the old 2.5D sprite billboards in worlds rooms.', sort_order: 65 },
  { id: 7, status: 'active',  title: 'Battleworlds',         description: 'PvP arena mode built on top of the Tinyverse infrastructure.', sort_order: 70 },
  { id: 8, status: 'active',  title: 'Mesh bake',            description: 'Merge static ground tiles into region draw calls for a further 70% reduction in render overhead.', sort_order: 80 },
  { id: 9, status: 'active',  title: 'Day / night cycle',    description: 'Wire atmosphere time-progression to a UI scrubber and real-time sky colour transitions.', sort_order: 90 },
  { id: 14, status: 'active', title: 'Networked avatar identity', description: 'Send a per-player voxel avatar descriptor through join + presence so peers and bots render their own skin instead of the local default.', sort_order: 95 },
  { id: 10, status: 'planned', title: 'Pets',                description: 'Companion animals that follow your avatar and can be customised via the open-pets provider system.', sort_order: 100 },
  { id: 11, status: 'planned', title: 'World marketplace',   description: 'Browse, buy, and remix worlds created by the community directly from the tinyverse map.', sort_order: 110 },
  { id: 12, status: 'planned', title: 'Mobile',              description: 'Touch-first controls and a responsive layout so worlds can be built on any device.', sort_order: 120 },
  { id: 15, status: 'planned', title: 'Fly down to the surface', description: 'Descend from the floating islands to the sea-covered planet below — planet-aware flight collision, altitude-scaled camera, and a cloud-sea transition to land and splash down.', sort_order: 130 },
  { id: 16, status: 'planned', title: 'Settlements & voxel NPCs', description: 'Procedural land-island settlements on the planet surface populated with wandering voxel survivors who offer scavenge, trade, and artifact quests.', sort_order: 140 },
  { id: 17, status: 'planned', title: 'Crafting & inventory', description: 'An inventory item table, recipes, and an atomic resource-spend path so gathered resources can be crafted and spent on resource-gated building.', sort_order: 150 },
  { id: 18, status: 'planned', title: 'Server-authoritative battles', description: 'A dedicated battle-room type with server-owned HP, hit validation, kills, respawn, scoring, teams, and match lifecycle.', sort_order: 160 },
  { id: 19, status: 'planned', title: 'Community hub',       description: 'A lightweight Discord-style space: text rooms, direct messages, a member directory with profiles and avatars, invites, and moderation (rate limiting, blocking, timed bans).', sort_order: 170 },
  { id: 20, status: 'planned', title: 'Voice chat',          description: 'Proximity and party voice chat inside world rooms, built on the existing LiveKit token infrastructure.', sort_order: 180 },
  { id: 21, status: 'planned', title: 'Multi-agentic NPCs',  description: 'AI-driven agents inhabiting settlements and worlds as first-class voxel actors with their own behaviour, via the existing agent-generation seam.', sort_order: 190 },
];

function envValue(name) {
  try {
    if (globalThis.Netlify && Netlify.env && typeof Netlify.env.get === 'function') {
      const value = Netlify.env.get(name);
      if (value) return value;
    }
  } catch (_) {}
  return process.env[name] || '';
}

// WAVE launch taxonomy: constrain the label server-side to a small known set so
// arbitrary client strings can never be stored. Anything else (incl. 'none'/'')
// normalizes to null = no wave.
const WAVES = ['WAVE1', 'WAVE2', 'WAVE3'];
function normalizeWave(value) {
  const s = String(value == null ? '' : value).trim().toUpperCase();
  return WAVES.includes(s) ? s : null;
}

// Admin authority is decided SERVER-SIDE from a verified account session.
// Prod path: the requester's Netlify Identity (or wallet) session resolves to an
// email on the world-admin allowlist (isWorldAdminEmail). This branch has NO host
// check, so it works on production. Authority is the verified email only — never a
// client-supplied email or admin flag.
async function isAdmin(request) {
  try {
    const user = await getAuthUser(request);
    if (user && isWorldAdminEmail(user.email)) return true;
  } catch (_) {}
  return isLocalSecretAdmin(request);
}

// LOCALHOST-ONLY DEV FALLBACK: the legacy shared secret. Kept so local roadmap
// editing keeps working without an Identity session, but it can NEVER grant admin
// off localhost — the host check fails closed on every non-local request.
function isLocalSecretAdmin(request) {
  try {
    const host = (request.headers.get('host') || '').toLowerCase();
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return false;
  } catch (_) { return false; }
  const secret = envValue('TINYWORLD_ADMIN_SECRET');
  if (!secret) return false;
  const provided = request.headers.get('x-admin-secret') || '';
  return provided === secret;
}

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS roadmap_milestones (
      id           SERIAL PRIMARY KEY,
      status       TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('done','active','planned')),
      title        TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      sort_order   INT  NOT NULL DEFAULT 0,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // WAVE launch label (Phase 2). Idempotent ALTER so fresh and older databases
  // — including prod where migrations lag — gain the column before any write
  // references it. Mirrors migration 20260618000000_wave_labels.sql.
  await sql`ALTER TABLE roadmap_milestones ADD COLUMN IF NOT EXISTS wave TEXT`;
}

async function seedTable(sql) {
  // Additive seeding: insert any fallback milestone whose title is not already
  // present (case-insensitive). On a fresh table this seeds the full set with
  // their canonical ids; on an already-populated table it only adds the
  // newly-harvested milestones, leaving curated/edited rows untouched.
  const existing = await sql`SELECT LOWER(title) AS title FROM roadmap_milestones`;
  const have = new Set(existing.map(r => r.title));
  const fresh = existing.length === 0;
  for (const m of FALLBACK_MILESTONES) {
    if (have.has(m.title.toLowerCase())) continue;
    if (fresh) {
      await sql`
        INSERT INTO roadmap_milestones (id, status, title, description, sort_order)
        VALUES (${m.id}, ${m.status}, ${m.title}, ${m.description}, ${m.sort_order})
        ON CONFLICT DO NOTHING
      `;
    } else {
      // Let the sequence assign a fresh id so we never collide with an
      // existing curated row that happens to occupy this fallback id.
      await sql`
        INSERT INTO roadmap_milestones (status, title, description, sort_order)
        VALUES (${m.status}, ${m.title}, ${m.description}, ${m.sort_order})
        ON CONFLICT DO NOTHING
      `;
    }
  }
  // Keep the sequence ahead of any explicitly-inserted ids.
  await sql`SELECT setval('roadmap_milestones_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM roadmap_milestones), 1))`;
}

function milestoneDto(row) {
  return {
    id:          row.id,
    status:      row.status,
    title:       row.title,
    description: row.description,
    sort_order:  row.sort_order,
    wave:        row.wave || null,
  };
}

export default async function roadmapFunction(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);

  // ---- GET — public ----
  if (request.method === 'GET') {
    try {
      const sql = getSql();
      await ensureTable(sql);
      await seedTable(sql);
      const rows = await sql`SELECT * FROM roadmap_milestones ORDER BY sort_order ASC, id ASC LIMIT 500`;
      return jsonResponse({ milestones: rows.map(milestoneDto), source: 'db', admin: await isAdmin(request) }, origin);
    } catch (err) {
      if (isDatabaseUnavailable(err) || isMissingRelation(err, 'roadmap_milestones')) {
        return jsonResponse({ milestones: FALLBACK_MILESTONES, source: 'fallback' }, origin);
      }
      console.error('[roadmap] GET error:', err);
      return jsonResponse({ milestones: FALLBACK_MILESTONES, source: 'fallback' }, origin);
    }
  }

  // ---- writes require admin ----
  if (!(await isAdmin(request))) return errorResponse('Forbidden', 403, origin);
  // CSRF / same-origin guard: account sessions are cookie-ambient, so a verified
  // admin's browser could be driven cross-site. Reject writes that aren't same-origin.
  if (!sameOriginWriteGuard(request)) return errorResponse('Forbidden', 403, origin);

  // ---- POST — create ----
  if (request.method === 'POST') {
    const body = await readJson(request);
    const title = String(body && body.title || '').slice(0, 200).trim();
    const description = String(body && body.description || '').slice(0, 1000).trim();
    const status = ['done', 'active', 'planned'].includes(body && body.status) ? body.status : 'planned';
    const sort_order = Number.isFinite(Number(body && body.sort_order)) ? Math.round(Number(body.sort_order)) : 0;
    const wave = normalizeWave(body && body.wave);
    if (!title) return errorResponse('title is required', 400, origin);
    try {
      const sql = getSql();
      await ensureTable(sql);
      const rows = await sql`
        INSERT INTO roadmap_milestones (status, title, description, sort_order, wave)
        VALUES (${status}, ${title}, ${description}, ${sort_order}, ${wave})
        RETURNING *
      `;
      return jsonResponse({ milestone: milestoneDto(rows[0]) }, origin, 201);
    } catch (err) {
      console.error('[roadmap] POST error:', err);
      return errorResponse('Database error', 500, origin);
    }
  }

  // ---- PATCH — update ----
  if (request.method === 'PATCH') {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get('id'));
    if (!id) return errorResponse('id is required', 400, origin);
    const body = await readJson(request);
    const updates = {};
    if (body && body.title != null) updates.title = String(body.title).slice(0, 200).trim();
    if (body && body.description != null) updates.description = String(body.description).slice(0, 1000).trim();
    if (body && body.status != null && ['done', 'active', 'planned'].includes(body.status)) updates.status = body.status;
    if (body && body.sort_order != null && Number.isFinite(Number(body.sort_order))) updates.sort_order = Math.round(Number(body.sort_order));
    // wave is set/cleared explicitly: a provided value of 'none'/'' normalizes to
    // null (a real clear), so it must bypass COALESCE — which would otherwise treat
    // null as "leave unchanged". Tracked separately so a wave-only PATCH is allowed.
    const waveProvided = !!(body && Object.prototype.hasOwnProperty.call(body, 'wave'));
    const wave = waveProvided ? normalizeWave(body.wave) : null;
    if (!Object.keys(updates).length && !waveProvided) return errorResponse('No fields to update', 400, origin);
    try {
      const sql = getSql();
      const rows = await sql`
        UPDATE roadmap_milestones
        SET
          title       = COALESCE(${updates.title ?? null}, title),
          description = COALESCE(${updates.description ?? null}, description),
          status      = COALESCE(${updates.status ?? null}, status),
          sort_order  = COALESCE(${updates.sort_order ?? null}, sort_order),
          wave        = CASE WHEN ${waveProvided} THEN ${wave} ELSE wave END,
          updated_at  = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      if (!rows.length) return errorResponse('Not found', 404, origin);
      return jsonResponse({ milestone: milestoneDto(rows[0]) }, origin);
    } catch (err) {
      console.error('[roadmap] PATCH error:', err);
      return errorResponse('Database error', 500, origin);
    }
  }

  // ---- DELETE ----
  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get('id'));
    if (!id) return errorResponse('id is required', 400, origin);
    try {
      const sql = getSql();
      await sql`DELETE FROM roadmap_milestones WHERE id = ${id}`;
      return jsonResponse({ ok: true }, origin);
    } catch (err) {
      console.error('[roadmap] DELETE error:', err);
      return errorResponse('Database error', 500, origin);
    }
  }

  return errorResponse('Method not allowed', 405, origin);
}
