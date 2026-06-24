import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse } from './lib/http.mjs';
import { normalizeWorldSelectionGateData, worldPreview } from './lib/worlds.mjs';

export const config = { path: '/api/builder' };

// Public, unauthenticated builder profile endpoint.
// Returns a single builder's public info + their published worlds.
// NEVER returns email, auth0_id, twitter, github, about, or any private column.
// Columns are hand-picked in the SELECT; profileDto() is deliberately NOT used.
const isMissingBuilderSchema = (err) =>
  isMissingRelations(err, ['profiles', 'worlds']);

const MAX_WORLDS = 24;
const MAX_PREVIEW_CELLS = 1200;

export default async function builder(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405, origin);

  const url = new URL(request.url);
  const username = (url.searchParams.get('username') || '').trim();
  if (!username) return errorResponse('username is required', 400, origin);

  try {
    const sql = getSql();

    // Fetch profile + rank in one shot.
    // Rank = count of builders with strictly MORE published worlds than this one, + 1.
    // Builders with zero published worlds are not on the leaderboard and get rank null.
    const profileRows = await sql`
      WITH ranked AS (
        SELECT
          p.id,
          p.username,
          p.display_name,
          p.image,
          COUNT(w.id)::int AS published
        FROM profiles p
        JOIN worlds w ON w.owner_profile_id = p.id AND w.status = 'published'
        GROUP BY p.id, p.username, p.display_name, p.image
      )
      SELECT
        r.id,
        r.username,
        r.display_name,
        r.image,
        r.published,
        (SELECT COUNT(*)::int FROM ranked r2 WHERE r2.published > r.published) + 1 AS rank
      FROM ranked r
      WHERE LOWER(r.username) = LOWER(${username})
      LIMIT 1
    `;

    // Also check if the profile exists at all (even with 0 published worlds).
    // If profileRows is empty, check whether the username exists.
    let profile = profileRows && profileRows[0] ? profileRows[0] : null;
    let worldsPublished = 0;
    let rank = null;

    if (!profile) {
      // Try to find the profile without requiring published worlds.
      const existsRows = await sql`
        SELECT id, username, display_name, image
        FROM profiles
        WHERE LOWER(username) = LOWER(${username})
        LIMIT 1
      `;
      if (!existsRows || !existsRows[0]) {
        return jsonResponse({ error: 'not-found' }, origin, 404);
      }
      profile = existsRows[0];
    } else {
      worldsPublished = Number(profile.published) || 0;
      rank = Number(profile.rank) || null;
    }

    // Fetch published worlds for this profile, bounded to MAX_WORLDS. The cell array
    // is sliced to MAX_PREVIEW_CELLS IN SQL so a public request can never force the
    // full data JSON (up to 20MB/world) over the wire — only a preview-sized slice.
    const worldRows = await sql`
      SELECT id, slug, name, grid_size,
        COALESCE((
          SELECT jsonb_agg(elem ORDER BY ord)
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(data->'cells') = 'array' THEN data->'cells' ELSE '[]'::jsonb END
          ) WITH ORDINALITY AS t(elem, ord)
          WHERE ord <= ${MAX_PREVIEW_CELLS}
        ), '[]'::jsonb) AS cells
      FROM worlds
      WHERE owner_profile_id = ${Number(profile.id)}
        AND status = 'published'
      ORDER BY published_at DESC NULLS LAST, id DESC
      LIMIT ${MAX_WORLDS}
    `;

    const worlds = (worldRows || []).map((r) => {
      const gridSize = Math.max(1, Math.min(64, Number(r.grid_size) || 8));
      const rawCells = Array.isArray(r.cells) ? r.cells : [];
      const previewData = normalizeWorldSelectionGateData({ cells: rawCells }, gridSize);
      return {
        slug: r.slug,
        name: r.name || 'Untitled world',
        gridSize,
        preview: { gridSize, cells: worldPreview(previewData, MAX_PREVIEW_CELLS) },
      };
    }).filter((w) => Array.isArray(w.preview.cells) && w.preview.cells.length > 0);

    return jsonResponse({
      username: String(profile.username || ''),
      displayName: String(profile.display_name || profile.username || ''),
      image: profile.image ? String(profile.image) : null,
      worldsPublished,
      rank,
      worlds,
    }, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingBuilderSchema(err)) {
      return jsonResponse({ error: 'not-found' }, origin, 404);
    }
    return errorResponse('builder-failed', 500, origin);
  }
}
