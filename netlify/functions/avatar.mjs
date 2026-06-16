import { requireAuthUser } from './lib/auth.mjs';
import { getSql, isDatabaseUnavailable } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse, readJson, sameOriginWriteGuard } from './lib/http.mjs';
import { ensureProfile } from './lib/profiles.mjs';

export const config = { path: '/api/avatar' };

// The voxel avatar descriptor is a small plain-object (body/head/skin/hair/gear
// + a seed). Accept any object, reject oversized blobs so a client can't stuff
// the column. null clears the saved avatar.
function normalizeAvatar(body) {
  const avatar = body && body.avatar;
  if (avatar == null) return { avatar: null };
  if (typeof avatar !== 'object' || Array.isArray(avatar)) return { error: 'Avatar must be an object' };
  let str;
  try { str = JSON.stringify(avatar); } catch (_) { return { error: 'Avatar is not serializable' }; }
  if (str.length > 20000) return { error: 'Avatar descriptor too large' };
  return { avatar };
}

export default async function avatarFunction(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);

  const auth = await requireAuthUser(request, origin);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    await ensureProfile(user);
    const sql = getSql();

    if (request.method === 'GET') {
      const rows = await sql`
        SELECT avatar, updated_at
        FROM profiles
        WHERE auth0_id = ${user.id}
        LIMIT 1
      `;
      if (!rows.length) return jsonResponse({ avatar: null }, origin);
      return jsonResponse({ avatar: rows[0].avatar || null, updatedAt: rows[0].updated_at }, origin);
    }

    if (request.method === 'PUT') {
      if (!sameOriginWriteGuard(request)) return errorResponse('Forbidden', 403, origin);
      const input = normalizeAvatar(await readJson(request));
      if (input.error) return errorResponse(input.error, 400, origin);
      const rows = await sql`
        UPDATE profiles
        SET avatar = ${input.avatar ? sql.json(input.avatar) : null},
            updated_at = NOW()
        WHERE auth0_id = ${user.id}
        RETURNING avatar, updated_at
      `;
      if (!rows.length) return errorResponse('Profile not found', 404, origin);
      return jsonResponse({ avatar: rows[0].avatar || null, updatedAt: rows[0].updated_at }, origin);
    }

    return errorResponse('Method not allowed', 405, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err)) {
      return errorResponse('Netlify Database is not available in this local session.', 503, origin);
    }
    console.error('[avatar]', err);
    return errorResponse('Avatar request failed', 500, origin);
  }
}
