import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse } from './lib/http.mjs';
import { normalizeWorldSelectionGateData, worldPreview } from './lib/worlds.mjs';

export const config = { path: '/api/home-worlds' };

// Public, unauthenticated discovery feed of user-built worlds shared via the
// Tiny World Builder. Returns recent public shares so the home-page carousel
// showcases community creations, NOT tinyverse/published worlds.
// NEVER returns profile_id, owner_auth_id, or any PII column.
// Cells are sliced IN SQL to bound data transfer — same pattern as builder.mjs.
const isMissingHomeWorldsSchema = (err) =>
  isMissingRelations(err, ['world_shares']);

const MAX_WORLDS = 12;
const MAX_PREVIEW_CELLS = 1200;

export default async function homeWorlds(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405, origin);

  try {
    const sql = getSql();

    // Select only safe public fields. gridSize is extracted as a scalar from
    // the JSONB data column (world_shares has no grid_size column). Cells are
    // sliced to MAX_PREVIEW_CELLS via WITH ORDINALITY so we never pull the
    // full data blob (up to 20 MB/row) over the wire.
    const rows = await sql`
      SELECT
        id,
        name,
        COALESCE((data->>'gridSize')::int, 8) AS grid_size,
        COALESCE((
          SELECT jsonb_agg(elem ORDER BY ord)
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(data->'cells') = 'array' THEN data->'cells' ELSE '[]'::jsonb END
          ) WITH ORDINALITY AS t(elem, ord)
          WHERE ord <= ${MAX_PREVIEW_CELLS}
        ), '[]'::jsonb) AS cells
      FROM world_shares
      ORDER BY updated_at DESC
      LIMIT ${MAX_WORLDS}
    `;

    const worlds = (rows || []).map((r) => {
      // id is TEXT (base64url) — keep as string; do NOT coerce to Number.
      const id = String(r.id || '');
      const gridSize = Math.max(1, Math.min(64, Number(r.grid_size) || 8));
      const rawCells = Array.isArray(r.cells) ? r.cells : [];
      const previewData = normalizeWorldSelectionGateData({ cells: rawCells }, gridSize);
      return {
        id,
        name: r.name || 'Untitled world',
        gridSize,
        preview: { gridSize, cells: worldPreview(previewData, MAX_PREVIEW_CELLS) },
      };
    }).filter((w) => Array.isArray(w.preview.cells) && w.preview.cells.length > 0);

    return jsonResponse({ worlds }, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingHomeWorldsSchema(err)) {
      return jsonResponse({ worlds: [] }, origin);
    }
    return errorResponse('home-worlds-failed', 500, origin);
  }
}
