import { requireAuthUser } from './lib/auth.mjs';
import { ensureProfile } from './lib/profiles.mjs';
import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse, readJson, sameOriginWriteGuard } from './lib/http.mjs';

export const config = { path: '/api/worlds/template' };

// T2 — list / unlist a world you OWN as a remixable template with an Earned GOLD price.
// Owner-only; the buyer-facing paid remix is /api/worlds/remix.
const MAX_TEMPLATE_PRICE = 1_000_000;
const isMissingSchema = (err) => isMissingRelations(err, ['worlds']);

export default async function worldTemplate(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405, origin);
  if (!sameOriginWriteGuard(request)) return errorResponse('Forbidden', 403, origin);

  const auth = await requireAuthUser(request, origin);
  if (auth.response) return auth.response;

  let body;
  try { body = await readJson(request); } catch (_) { return errorResponse('invalid-json', 400, origin); }
  body = body || {};
  const worldId = Number(body.worldId);
  const action = String(body.action || '').trim(); // 'list' | 'unlist'
  if (!Number.isInteger(worldId) || worldId < 1) return errorResponse('invalid-world', 400, origin);
  if (action !== 'list' && action !== 'unlist') return errorResponse('invalid-action', 400, origin);

  try {
    const sql = getSql();
    const profile = await ensureProfile(auth.user);

    const rows = await sql`SELECT id, owner_profile_id, status FROM worlds WHERE id = ${worldId} LIMIT 1`;
    if (!rows.length) return errorResponse('world-not-found', 404, origin);
    const world = rows[0];
    if (Number(world.owner_profile_id) !== Number(profile.id)) return errorResponse('not-your-world', 403, origin);
    if (world.status !== 'published') return errorResponse('world-must-be-published', 400, origin);

    if (action === 'unlist') {
      const upd = await sql`
        UPDATE worlds SET is_template = FALSE, updated_at = NOW()
        WHERE id = ${worldId} RETURNING id, is_template, template_price, remix_count
      `;
      return jsonResponse({ ok: true, template: upd[0] }, origin);
    }

    // list
    const price = Number(body.price);
    if (!Number.isInteger(price) || price < 0 || price > MAX_TEMPLATE_PRICE) return errorResponse('invalid-price', 400, origin);
    const upd = await sql`
      UPDATE worlds
      SET is_template = TRUE, template_price = ${price}, template_author_id = ${Number(profile.id)}, updated_at = NOW()
      WHERE id = ${worldId}
      RETURNING id, is_template, template_price, remix_count
    `;
    return jsonResponse({ ok: true, template: upd[0] }, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingSchema(err)) {
      return errorResponse('world-template-unavailable: schema not ready', 503, origin);
    }
    return errorResponse('world-template-failed: ' + (err.message || err), 500, origin);
  }
}
