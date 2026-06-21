import { timingSafeEqual } from 'node:crypto';
import { getAuthUser } from './lib/auth.mjs';
import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse, readJson, sameOriginWriteGuard } from './lib/http.mjs';
import { ensureProfile, profileDto } from './lib/profiles.mjs';
import { activeSuspension } from './lib/community-moderation.mjs';
import { isTinyverseAccessEmail } from './lib/tinyverse-access.mjs';
import {
  cleanWorldName, cleanTaxPercent, computeWorldPrice, deriveTerrainCounts,
  worldDto, worldPreview, signJoinToken, isWorldAdminEmail, getTaxCooldownInfo,
  normalizeWorldSelectionGateData, TINYVERSE_HUB_SLUG,
} from './lib/worlds.mjs';

export const config = { path: '/api/worlds' };

const WORLD_RELATIONS = ['worlds', 'world_economy_state', 'profiles'];
const isMissingWorldSchema = (err) => isMissingRelations(err, WORLD_RELATIONS);
const TINYVERSE_OWNER_EMAIL = 'jason@bouncingfish.com';

function joinSecret() {
  return process.env.WORLDS_JOIN_SECRET || process.env.WORLDS_SERVICE_TOKEN || '';
}

function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function isWorldServiceRequest(request) {
  const serviceToken = process.env.WORLDS_SERVICE_TOKEN || '';
  const provided = request.headers.get('x-worlds-token') || '';
  return !!serviceToken && constantTimeEqual(provided, serviceToken);
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

function isTinyverseOwnerProfile(profile) {
  return String((profile && profile.email) || '').trim().toLowerCase() === TINYVERSE_OWNER_EMAIL;
}

async function ensureTinyverseStarterOwnership(sql, profile) {
  if (!profile || !isTinyverseOwnerProfile(profile)) return;
  await sql`
    UPDATE worlds
    SET owner_profile_id = ${profile.id}, updated_at = NOW()
    WHERE slug <> ${TINYVERSE_HUB_SLUG}
      AND (kind = 'starter' OR (owner_profile_id IS NULL AND status IN ('published', 'draft')))
      AND owner_profile_id IS DISTINCT FROM ${profile.id}
  `;
}

// World access role for a client. `build` is retained for draft owner/editing
// flows only; published multiplayer rooms downgrade stale build tokens to play.
// play = authenticated/allowlisted in a published world, observe = guest in a published world.
// null = no access.
function roleFor(world, profileId, canPlayPublished) {
  if (world.status === 'published') {
    return (profileId || canPlayPublished) ? 'play' : 'observe';
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
    await ensureTinyverseStarterOwnership(sql, profile);
    const isWorldService = isWorldServiceRequest(request);
    // World admin: a small email allowlist may inspect/administer worlds beyond
    // ownership. Live room editing is intentionally not part of this path.
    const isWorldAdmin = isWorldAdminEmail(user && user.email);
    const canAccessTinyverse = isTinyverseAccessEmail(user && (user.email || (profile && profile.email)));
    const worldId = worldIdFromRequest(request);
    const worldSlug = slugFromRequest(request);

    if (request.method === 'GET') {
      const economy = await loadEconomy(sql);

      if (worldId || worldSlug) {
        if (!canAccessTinyverse && !isWorldService) return errorResponse('Tinyverse access is invite-only', 403, origin);
        const rows = worldId
          ? await sql`
              SELECT w.*, p.display_name AS owner_name, p.email AS owner_email
              FROM worlds w
              LEFT JOIN profiles p ON p.id = w.owner_profile_id
              WHERE w.id = ${worldId}
              LIMIT 1
            `
          : await sql`
              SELECT w.*, p.display_name AS owner_name, p.email AS owner_email
              FROM worlds w
              LEFT JOIN profiles p ON p.id = w.owner_profile_id
              WHERE w.slug = ${worldSlug}
              LIMIT 1
            `;
        if (!rows.length) return errorResponse('World not found', 404, origin);
        const world = rows[0];
        if (world.slug === TINYVERSE_HUB_SLUG) return errorResponse('World not found', 404, origin);
        const isOwner = profile && Number(world.owner_profile_id) === Number(profile.id);
        // Drafts are private to their owner, except a world admin can inspect
        // them for moderation/support. Multiplayer editing stays outside rooms.
        if (world.status === 'draft' && !isOwner && !isWorldAdmin) {
          return jsonResponse({ world: withLivePrice(worldDto(world), economy) }, origin);
        }
        const includeData = isWorldService || world.status === 'published' || isOwner || isWorldAdmin;
        const dto = withLivePrice(worldDto(world, { includeData }), economy);
        let role = isWorldService ? null : roleFor(world, profile && profile.id, canAccessTinyverse || isWorldAdmin);
        // Community suspensions lock the player out of the game for their duration.
        let suspendedUntil = null;
        if (profile) {
          const susp = await activeSuspension(sql, profile.id);
          if (susp) {
            suspendedUntil = susp.expires_at;
            // Owners can still load their own draft to look, but cannot get a
            // play/build access token while suspended.
            role = null;
          }
        }
        let token = '';
        if (!isWorldService && role && joinSecret()) {
          token = signJoinToken({ w: dto.id, slug: dto.slug, p: profile ? Number(profile.id) : null, r: role }, joinSecret());
        }
        return jsonResponse({ world: dto, role, token, suspendedUntil, admin: isWorldAdmin, canAdminEdit: false, me: profile ? profileDto(profile) : null }, origin);
      }

      if (!profile) {
        return jsonResponse({ worlds: [], me: null, economy: {
          claimed: Number(economy.claimed_count) || 0,
          perTileBase: String(economy.per_tile_base || '0'),
        } }, origin);
      }
      if (!canAccessTinyverse) return errorResponse('Tinyverse access is invite-only', 403, origin);

      const rows = await sql`
        SELECT w.*, p.display_name AS owner_name, p.email AS owner_email
        FROM worlds w
        LEFT JOIN profiles p ON p.id = w.owner_profile_id
        WHERE w.slug <> ${TINYVERSE_HUB_SLUG}
        ORDER BY (w.kind = 'starter') DESC, w.id ASC
        LIMIT 500
      `;
      const worlds = rows.map(r => {
        const dto = withLivePrice(worldDto(r), economy);
        // A small top-down preview for the card. Other players' private drafts
        // are not previewed; everything else (incl. empty unclaimed plots) is.
        const isOwner = profile && r.owner_profile_id != null && Number(r.owner_profile_id) === Number(profile.id);
        const previewData = normalizeWorldSelectionGateData(r.data, dto.gridSize);
        dto.preview = { gridSize: dto.gridSize, cells: (r.status !== 'draft' || isOwner) ? worldPreview(previewData) : [] };
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
    if (!canAccessTinyverse) return errorResponse('Tinyverse access is invite-only', 403, origin);
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
