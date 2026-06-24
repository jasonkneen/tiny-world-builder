import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse } from './lib/http.mjs';

export const config = { path: '/api/leaderboard' };

// Public, unauthenticated leaderboard of top builders ranked by number of
// published worlds. Returns ONLY safe public fields — never email, auth0_id,
// twitter, github, about, or any other private column. Columns are hand-picked
// in the SELECT; profileDto() is deliberately NOT used (it includes email).
const isMissingLeaderboardSchema = (err) =>
  isMissingRelations(err, ['profiles', 'worlds']);

export default async function leaderboard(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405, origin);

  // The leaderboard page must never break if the DB is cold or the schema is
  // missing — degrade to an empty list rather than surfacing a 500.
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT
        p.id,
        p.username,
        p.display_name,
        p.image,
        COUNT(w.id)::int AS published
      FROM profiles p
      JOIN worlds w ON w.owner_profile_id = p.id AND w.status = 'published'
      GROUP BY p.id, p.username, p.display_name, p.image
      ORDER BY published DESC, p.id ASC
      LIMIT 50
    `;

    const leaders = (rows || []).map((r, i) => ({
      rank: i + 1,
      username: String(r.username || ''),
      displayName: String(r.display_name || r.username || ''),
      image: r.image ? String(r.image) : null,
      worldsPublished: Number(r.published),
    }));

    return jsonResponse({ leaders }, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingLeaderboardSchema(err)) {
      return jsonResponse({ leaders: [] }, origin);
    }
    return errorResponse('leaderboard-failed', 500, origin);
  }
}
