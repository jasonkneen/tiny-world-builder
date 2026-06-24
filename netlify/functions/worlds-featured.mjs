import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse } from './lib/http.mjs';
import { normalizeWorldSelectionGateData, worldPreview, TINYVERSE_HUB_SLUG } from './lib/worlds.mjs';

export const config = { path: '/api/worlds/featured' };

// Public, unauthenticated discovery feed for the landing-page carousel.
// Returns ONLY published worlds (already public, joinable rooms) and ONLY the
// fields needed to render a preview card — no owner identity, no economy/price
// data, no draft/unclaimed plots. The auth-gated /api/worlds remains the source
// of truth for in-app management; this is a read-only shop window.
const isMissingWorldSchema = (err) => isMissingRelations(err, ['worlds']);

export default async function worldsFeatured(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405, origin);

  // The landing page must never break if the DB is cold — degrade to an empty
  // feed (the carousel hides itself) rather than surfacing a 500.
  try {
    const sql = getSql();
    const limit = 12;
    const rows = await sql`
      SELECT id, slug, name, grid_size, data
      FROM worlds
      WHERE status = 'published' AND slug <> ${TINYVERSE_HUB_SLUG}
      ORDER BY published_at DESC NULLS LAST, id DESC
      LIMIT ${limit}
    `;
    const worlds = (rows || []).map((r) => {
      const gridSize = Number(r.grid_size) || 8;
      const previewData = normalizeWorldSelectionGateData(r.data, gridSize);
      return {
        id: Number(r.id),
        slug: r.slug,
        name: r.name || 'Untitled world',
        gridSize,
        preview: { gridSize, cells: worldPreview(previewData) },
      };
    }).filter((w) => Array.isArray(w.preview.cells) && w.preview.cells.length > 0);

    return jsonResponse({ worlds }, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingWorldSchema(err)) {
      return jsonResponse({ worlds: [] }, origin);
    }
    return errorResponse('worlds-featured-failed', 500, origin);
  }
}
