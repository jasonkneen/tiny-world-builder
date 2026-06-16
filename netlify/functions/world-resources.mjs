import { timingSafeEqual } from 'node:crypto';
import { requireAuthUser } from './lib/auth.mjs';
import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse, readJson } from './lib/http.mjs';
import { ensureProfile } from './lib/profiles.mjs';
import { WORLD_RESOURCES } from './lib/worlds.mjs';

function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}


export const config = { path: '/api/worlds/resources' };

const RES_RELATIONS = ['player_resources', 'tax_ledger', 'worlds'];
const isMissingResSchema = (err) => isMissingRelations(err, RES_RELATIONS);

function resourcesDto(row) {
  return {
    fish: Number(row && row.fish) || 0,
    meat: Number(row && row.meat) || 0,
    plants: Number(row && row.plants) || 0,
    ore: Number(row && row.ore) || 0,
    gold: Number(row && row.gold) || 0,
  };
}

// Coerce a {fish,meat,plants,ore} delta to non-negative bounded integers. Grants
// are monotonic (resources are only ever added by completed harvests).
function cleanDelta(input) {
  const out = { fish: 0, meat: 0, plants: 0, ore: 0 };
  if (!input || typeof input !== 'object') return out;
  for (const r of WORLD_RESOURCES) {
    const n = Math.floor(Number(input[r]) || 0);
    out[r] = n > 0 ? Math.min(n, 1_000_000) : 0;
  }
  return out;
}

function hasAny(delta) {
  return WORLD_RESOURCES.some(r => delta[r] > 0);
}

async function addResources(sql, profileId, delta) {
  await sql`
    INSERT INTO player_resources (profile_id, fish, meat, plants, ore)
    VALUES (${profileId}, ${delta.fish}, ${delta.meat}, ${delta.plants}, ${delta.ore})
    ON CONFLICT (profile_id) DO UPDATE SET
      fish = player_resources.fish + EXCLUDED.fish,
      meat = player_resources.meat + EXCLUDED.meat,
      plants = player_resources.plants + EXCLUDED.plants,
      ore = player_resources.ore + EXCLUDED.ore,
      updated_at = NOW()
  `;
}

export default async function worldResourcesFunction(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);

  try {
    const sql = getSql();

    // ---- service-token grant (from the authoritative PartyKit room only) ----
    if (request.method === 'POST') {
      const serviceToken = process.env.WORLDS_SERVICE_TOKEN || '';
      const provided = request.headers.get('x-worlds-token') || '';
      if (!serviceToken || !constantTimeEqual(provided, serviceToken)) return errorResponse('Forbidden', 403, origin);

      const body = await readJson(request);
      const resources = (body && body.resources) || {};
      const taxPayouts = (body && body.taxPayouts) || {};

      // Bound the batch so a single grant can't fan out into thousands of DB
      // round-trips (the caller holds the service token, but a shared/leaked
      // token shouldn't be a DoS lever).
      const MAX_GRANT_ENTRIES = 500;

      // Harvester (and self-harvest) whole-unit credits.
      for (const [pid, raw] of Object.entries(resources).slice(0, MAX_GRANT_ENTRIES)) {
        const profileId = Number(pid);
        if (!Number.isInteger(profileId) || profileId < 1) continue;
        const delta = cleanDelta(raw);
        if (hasAny(delta)) await addResources(sql, profileId, delta);
      }

      // Owner tax payouts: credit the owner's balance AND record tax history.
      for (const [wid, owners] of Object.entries(taxPayouts).slice(0, MAX_GRANT_ENTRIES)) {
        const worldId = Number(wid);
        if (!Number.isInteger(worldId) || worldId < 1 || !owners || typeof owners !== 'object') continue;
        for (const [oid, raw] of Object.entries(owners).slice(0, MAX_GRANT_ENTRIES)) {
          const ownerId = Number(oid);
          if (!Number.isInteger(ownerId) || ownerId < 1) continue;
          const delta = cleanDelta(raw);
          if (!hasAny(delta)) continue;
          await addResources(sql, ownerId, delta);
          for (const r of WORLD_RESOURCES) {
            if (delta[r] <= 0) continue;
            await sql`
              INSERT INTO tax_ledger (world_id, owner_profile_id, resource, paid_whole)
              VALUES (${worldId}, ${ownerId}, ${r}, ${delta[r]})
              ON CONFLICT (world_id, owner_profile_id, resource) DO UPDATE SET
                paid_whole = tax_ledger.paid_whole + EXCLUDED.paid_whole, updated_at = NOW()
            `;
          }
        }
      }

      return jsonResponse({ ok: true }, origin);
    }

    // ---- player reads own balances ----
    if (request.method !== 'GET') return errorResponse('Method not allowed', 405, origin);
    const auth = await requireAuthUser(request, origin);
    if (auth.response) return auth.response;
    const profile = await ensureProfile(auth.user);

    const rows = await sql`SELECT * FROM player_resources WHERE profile_id = ${profile.id} LIMIT 1`;
    const owned = await sql`
      SELECT id, slug, name, status, tax_percent, tile_count, active_players
      FROM worlds WHERE owner_profile_id = ${profile.id} ORDER BY updated_at DESC LIMIT 200
    `;
    const tax = await sql`
      SELECT world_id, resource, paid_whole FROM tax_ledger
      WHERE owner_profile_id = ${profile.id} ORDER BY updated_at DESC LIMIT 500
    `;
    return jsonResponse({
      resources: resourcesDto(rows[0]),
      ownedWorlds: owned.map(w => ({
        id: Number(w.id), slug: w.slug, name: w.name || '', status: w.status,
        taxPercent: Number(w.tax_percent), tileCount: Number(w.tile_count),
        activePlayers: Number(w.active_players) || 0,
      })),
      taxHistory: tax.map(t => ({ worldId: Number(t.world_id), resource: t.resource, paidWhole: Number(t.paid_whole) })),
    }, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err)) {
      return errorResponse('Netlify Database is not available in this local session.', 503, origin);
    }
    if (isMissingResSchema(err)) {
      return errorResponse('World resource tables are missing. Run the Netlify worlds_economy migration.', 503, origin);
    }
    console.error('[world-resources]', err);
    return errorResponse('Resource request failed', 500, origin);
  }
}
