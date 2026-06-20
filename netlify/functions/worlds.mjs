import { getAuthUser } from './lib/auth.mjs';
import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse, readJson, sameOriginWriteGuard } from './lib/http.mjs';
import { ensureProfile, profileDto } from './lib/profiles.mjs';
import { activeSuspension } from './lib/community-moderation.mjs';
import {
  cleanWorldName, cleanTaxPercent, computeWorldPrice, deriveTerrainCounts,
  worldDto, worldPreview, signJoinToken, isWorldAdminEmail,
} from './lib/worlds.mjs';

export const config = { path: '/api/worlds' };

const WORLD_RELATIONS = ['worlds', 'world_economy_state', 'profiles'];
const isMissingWorldSchema = (err) => isMissingRelations(err, WORLD_RELATIONS);

function joinSecret() {
  return process.env.WORLDS_JOIN_SECRET || process.env.WORLDS_SERVICE_TOKEN || '';
}

async function loadEconomy(sql) {
  const rows = await sql`SELECT * FROM world_economy_state WHERE id = 1 LIMIT 1`;
  return rows[0] || {};
}

// Unclaimed worlds show the LIVE price (size x current per-tile rate); owned
// worlds keep their stored record. This avoids rewriting old purchase history
// while making scarcity visible as supply disappears.
function withLivePrice(dto, economy) {
  if (dto.status === 'unclaimed') {
    dto.priceUsdc = String(computeWorldPrice(dto.tileCount, economy));
  }
  return dto;
}

function worldIdFromRequest(request) {
  const id = new URL(request.url).searchParams.get('id');
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function slugFromRequest(request) {
  const slug = new URL(request.url).searchParams.get('slug');
  if (!slug) return null;
  const s = String(slug).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(s)) return null;
  return s;
}

// Room join role for a connecting client. build = draft owner, play = logged-in
// in a published world, observe = guest in a published world. null = no access.
function roleFor(world, profileId) {
  if (world.status === 'published') {
    return profileId ? 'play' : 'observe';
  }
  if (world.status === 'draft') {
    return profileId && Number(world.owner_profile_id) === Number(profileId) ? 'build' : null;
  }
  return null;
}

export default async function worldsFunction(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);

  try {
    const sql = getSql();
    // Browsing the universe is account-gated; writes require auth too.
    const user = await getAuthUser(request);
    const profile = (user && user.id) ? await ensureProfile(user) : null;
    // God-admin: a small email allowlist may edit ANY world live (incl. the
    // ownerless published lobby) and save to the live record. Follows the account.
    const isWorldAdmin = isWorldAdminEmail(user && user.email);
    const worldId = worldIdFromRequest(request);
    const worldSlug = slugFromRequest(request);

    if (request.method === 'GET') {
      const economy = await loadEconomy(sql);

      if (worldId || worldSlug) {
        const rows = worldId
          ? await sql`
              SELECT w.*, p.display_name AS owner_name
              FROM worlds w
              LEFT JOIN profiles p ON p.id = w.owner_profile_id
              WHERE w.id = ${worldId}
              LIMIT 1
            `
          : await sql`
              SELECT w.*, p.display_name AS owner_name
              FROM worlds w
              LEFT JOIN profiles p ON p.id = w.owner_profile_id
              WHERE w.slug = ${worldSlug}
              LIMIT 1
            `;
        if (!rows.length) return errorResponse('World not found', 404, origin);
        const world = rows[0];
        const isOwner = profile && Number(world.owner_profile_id) === Number(profile.id);
        // Drafts are private to their owner — except a god-admin, who may load and
        // edit any world (including the published lobby) live.
        if (world.status === 'draft' && !isOwner && !isWorldAdmin) {
          return jsonResponse({ world: withLivePrice(worldDto(world), economy) }, origin);
        }
        const includeData = world.status === 'published' || isOwner || isWorldAdmin;
        const dto = withLivePrice(worldDto(world, { includeData }), economy);
        let role = roleFor(world, profile && profile.id);
        // Community suspensions lock the player out of the game for their duration.
        let suspendedUntil = null;
        if (profile) {
          const susp = await activeSuspension(sql, profile.id);
          if (susp) {
            suspendedUntil = susp.expires_at;
            // Owners can still load their own draft to look, but cannot get a
            // play/build join token while suspended.
            role = null;
          }
        }
        // God-admin always gets a build-capable role so they can edit live, even
        // on the ownerless published lobby (where they'd otherwise be 'play').
        if (isWorldAdmin && !suspendedUntil) role = 'build';
        let token = '';
        if (role && joinSecret()) {
          token = signJoinToken({ w: dto.id, slug: dto.slug, p: profile ? Number(profile.id) : null, r: role }, joinSecret());
        }
        return jsonResponse({ world: dto, role, token, suspendedUntil, canAdminEdit: isWorldAdmin, me: profile ? profileDto(profile) : null }, origin);
      }

      if (!profile) {
        return jsonResponse({ worlds: [], me: null, economy: {
          claimed: Number(economy.claimed_count) || 0,
          perTileBase: String(economy.per_tile_base || '0'),
        } }, origin);
      }

      const rows = await sql`
        SELECT w.*, p.display_name AS owner_name
        FROM worlds w
        LEFT JOIN profiles p ON p.id = w.owner_profile_id
        ORDER BY (w.slug = 'tinyverse-nexus') DESC, (w.kind = 'starter') DESC, w.id ASC
        LIMIT 500
      `;
      const worlds = rows.map(r => {
        const dto = withLivePrice(worldDto(r), economy);
        // A small top-down preview for the card. Other players' private drafts
        // are not previewed; everything else (incl. empty unclaimed plots) is.
        const isOwner = profile && r.owner_profile_id != null && Number(r.owner_profile_id) === Number(profile.id);
        dto.preview = { gridSize: dto.gridSize, cells: (r.status !== draft || isOwner) ? worldPreview(r.data) : [] };
        dto.taxCooldown = getTaxCooldownInfo(r.last_tax_change);
        return dto;
      });
      return jsonResponse({
        worlds,
        me: profile ? profileDto(profile) : null,
        economy: {
          claimed: Number(economy.claimed_count) || 0,
          perTileBase: String(economy.per_tile_base || '0'),
        },
      }, origin);
    }

    // ---- writes require auth + same-origin ----
    if (!profile) return errorResponse('Unauthorized', 401, origin);
    if (!sameOriginWriteGuard(request)) return errorResponse('Forbidden', 403, origin);

    if (request.method === 'PUT') {
      if (!worldId) return errorResponse('Missing world id', 400, origin);
      const body = await readJson(request);
      const name = cleanWorldName(body && body.name);
      // fetch current last_tax_change for cooldown
      const cur = await sql`SELECT last_tax_change FROM worlds WHERE id = ${worldId} AND owner_profile_id = ${profile.id} AND status = 'draft' LIMIT 1`;
      const lastChange = cur[0] ? cur[0].last_tax_change : null;
      const cd = getTaxCooldownInfo(lastChange);
      if (!cd.canChange) {
        const h = Math.ceil(cd.remainingMs / (1000*60*60));
        return errorResponse("Tax changes are on cooldown (" + h + "h remaining)", 429, origin);
      }
      const tax = cleanTaxPercent(body && body.taxPercent, lastChange);
      if (tax == null) return errorResponse('Tax must be 1-100', 400, origin);
      // Name + tax are editable only while the world is a draft; locked on publish.
      const rows = await sql`
        UPDATE worlds
        SET name = ${name}, tax_percent = ${tax}, last_tax_change = NOW(), updated_at = NOW()
        WHERE id = ${worldId} AND owner_profile_id = ${profile.id} AND status = 'draft'
        RETURNING *
      `;
      if (!rows.length) return errorResponse('World not editable (must be your draft)', 409, origin);
      const dto = worldDto(rows[0], { includeData: true });
      dto.taxCooldown = getTaxCooldownInfo(rows[0].last_tax_change);
      return jsonResponse({ world: dto }, origin);
    }

    if (request.method === 'POST') {
      const body = await readJson(request);
      const action = String((body && body.action) || '').trim();
      if (!worldId) return errorResponse('Missing world id', 400, origin);

      // ---- god-admin live save: edit ANY world (incl. the ownerless published
      // lobby) and write straight to the live record. Email-allowlisted only.
      // Unlike saveDraft this does NOT require draft status or owner match, and it
      // preserves the world's current status (a published lobby stays published).
      if (action === 'adminSave') {
        if (!isWorldAdmin) return errorResponse('Forbidden', 403, origin);
        const data = body && body.data;
        if (!data || typeof data !== 'object' || !Array.isArray(data.cells)) {
          return errorResponse('World JSON must include a cells array', 400, origin);
        }
        if (JSON.stringify(data).length > 2_000_000) return errorResponse('World JSON is too large', 400, origin);
        const existing = await sql`SELECT grid_size FROM worlds WHERE id = ${worldId} LIMIT 1`;
        if (!existing.length) return errorResponse('World not found', 404, origin);
        const counts = deriveTerrainCounts(data, existing[0].grid_size);
        const rows = await sql`
          UPDATE worlds
          SET data = ${sql.json(data)}, tile_count = ${counts.tileCount},
              stone_tile_count = ${counts.stone}, grass_tile_count = ${counts.grass},
              water_tile_count = ${counts.water}, updated_at = NOW()
          WHERE id = ${worldId}
          RETURNING *
        `;
        if (!rows.length) return errorResponse('World save failed', 500, origin);
        return jsonResponse({ world: worldDto(rows[0], { includeData: true }), admin: true }, origin);
      }

      if (action === 'saveDraft') {
        const data = body && body.data;
        if (!data || typeof data !== 'object' || !Array.isArray(data.cells)) {
          return errorResponse('World JSON must include a cells array', 400, origin);
        }
        if (JSON.stringify(data).length > 2_000_000) return errorResponse('World JSON is too large', 400, origin);
        const owned = await sql`SELECT grid_size FROM worlds WHERE id = ${worldId} AND owner_profile_id = ${profile.id} AND status = 'draft' LIMIT 1`;
        if (!owned.length) return errorResponse('World not editable (must be your draft)', 409, origin);
        const counts = deriveTerrainCounts(data, owned[0].grid_size);
        const rows = await sql`
          UPDATE worlds
          SET data = ${sql.json(data)}, tile_count = ${counts.tileCount},
              stone_tile_count = ${counts.stone}, grass_tile_count = ${counts.grass},
              water_tile_count = ${counts.water}, updated_at = NOW()
          WHERE id = ${worldId} AND owner_profile_id = ${profile.id} AND status = 'draft'
          RETURNING *
        `;
        if (!rows.length) return errorResponse('World not editable', 409, origin);
        return jsonResponse({ world: worldDto(rows[0], { includeData: true }) }, origin);
      }

      if (action === 'publish') {
        const rows = await sql`
          UPDATE worlds
          SET status = 'published', published_at = NOW(), updated_at = NOW()
          WHERE id = ${worldId} AND owner_profile_id = ${profile.id} AND status = 'draft'
            AND char_length(name) >= 1
          RETURNING *
        `;
        if (!rows.length) return errorResponse('Cannot publish (need a name, and it must be your draft)', 409, origin);
        return jsonResponse({ world: worldDto(rows[0], { includeData: true }) }, origin);
      }

      if (action === 'unpublish') {
        const rows = await sql`
          UPDATE worlds
          SET status = 'draft', updated_at = NOW()
          WHERE id = ${worldId} AND owner_profile_id = ${profile.id} AND status = 'published'
          RETURNING *
        `;
        if (!rows.length) return errorResponse('Cannot unpublish (must be your published world)', 409, origin);
        return jsonResponse({ world: worldDto(rows[0], { includeData: true }) }, origin);
      }

      return errorResponse('Unknown world action', 400, origin);
    }

    return errorResponse('Method not allowed', 405, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err)) {
      return errorResponse('Netlify Database is not available in this local session.', 503, origin);
    }
    if (isMissingWorldSchema(err)) {
      return errorResponse('World database tables are missing. Run the Netlify worlds_economy migration.', 503, origin);
    }
    console.error('[worlds]', err);
    return errorResponse('World request failed', 500, origin);
  }
}
