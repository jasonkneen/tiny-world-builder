import { requireAuthUser } from './lib/auth.mjs';
import { getSql } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse, readJson, sameOriginWriteGuard } from './lib/http.mjs';
import { ensureProfile } from './lib/profiles.mjs';

export const config = { path: '/api/assets' };

function normalizeAssetLibrary(body) {
  const data = body && body.data ? body.data : body;
  const voxelBuilds = Array.isArray(data && data.voxelBuilds) ? data.voxelBuilds.slice(0, 200) : [];
  const assetTemplates = Array.isArray(data && data.assetTemplates) ? data.assetTemplates.slice(0, 200) : [];
  // Per-model-stamp config (scale/offset/appearance tweaks), keyed by stamp id.
  // Small JSON; the 2MB cap below still guards the whole library.
  const rawDefaults = data && data.modelStampDefaults;
  const modelStampDefaults = (rawDefaults && typeof rawDefaults === 'object' && !Array.isArray(rawDefaults)) ? rawDefaults : {};
  const out = {
    version: 1,
    voxelBuilds,
    assetTemplates,
    modelStampDefaults,
    updatedAt: new Date().toISOString(),
  };
  if (JSON.stringify(out).length > 2_000_000) {
    return { error: 'Asset library JSON is too large' };
  }
  return { data: out };
}

export default async function assetsFunction(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);

  const auth = await requireAuthUser(request, origin);
  if (auth.response) return auth.response;

  try {
    const sql = getSql();
    const profile = await ensureProfile(auth.user);

    if (request.method === 'GET') {
      const rows = await sql`
        SELECT data, created_at, updated_at
        FROM asset_libraries
        WHERE profile_id = ${profile.id}
        LIMIT 1
      `;
      if (!rows.length) {
        return jsonResponse({
          version: 1,
          voxelBuilds: [],
          assetTemplates: [],
          modelStampDefaults: {},
          createdAt: null,
          updatedAt: null,
        }, origin);
      }
      return jsonResponse(Object.assign({}, rows[0].data, {
        createdAt: rows[0].created_at,
        updatedAt: rows[0].updated_at,
      }), origin);
    }

    if (request.method === 'PUT') {
      if (!sameOriginWriteGuard(request)) return errorResponse('Forbidden', 403, origin);
      const input = normalizeAssetLibrary(await readJson(request));
      if (input.error) return errorResponse(input.error, 400, origin);
      const rows = await sql`
        INSERT INTO asset_libraries (profile_id, data)
        VALUES (${profile.id}, ${sql.json(input.data)})
        ON CONFLICT (profile_id) DO UPDATE
          SET data = EXCLUDED.data,
              updated_at = NOW()
        RETURNING data, created_at, updated_at
      `;
      return jsonResponse(Object.assign({}, rows[0].data, {
        createdAt: rows[0].created_at,
        updatedAt: rows[0].updated_at,
      }), origin);
    }

    return errorResponse('Method not allowed', 405, origin);
  } catch (err) {
    console.error('[assets]', err);
    return errorResponse('Asset library request failed', 500, origin);
  }
}
