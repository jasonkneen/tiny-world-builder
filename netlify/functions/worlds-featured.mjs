import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse } from './lib/http.mjs';
import { normalizeWorldSelectionGateData, worldPreview, TINYVERSE_HUB_SLUG } from './lib/worlds.mjs';

export const config = { path: '/api/worlds/featured' };

// Public, unauthenticated discovery feed for the landing-page carousel.
// Returns ONLY published worlds (already public, joinable rooms) and ONLY the
// fields needed to render a preview card — no owner identity, no economy/price
// data, no draft/unclaimed plots. The auth-gated /api/worlds remains the source
// of truth for in-app management; this is a read-only shop window.
//
// ?templates=1 — returns ONLY worlds listed as remixable templates.
// Safe fields: id, slug, name, gridSize, preview, templatePrice, remixCount, authorName.
// authorName = profiles.display_name of the owner. NEVER returns email or other PII.
const isMissingWorldSchema = (err) => isMissingRelations(err, ['worlds']);
const isMissingProfileSchema = (err) => isMissingRelations(err, ['worlds', 'profiles']);

// Shared cell-slicing constants and preview helper reused for both modes.
const MAX_PREVIEW_CELLS = 1200;

function buildPreviewRow(r) {
  const gridSize = Math.max(1, Math.min(64, Number(r.grid_size) || 8));
  const rawCells = (r.data && Array.isArray(r.data.cells))
    ? r.data.cells.slice(0, MAX_PREVIEW_CELLS)
    : [];
  const previewData = normalizeWorldSelectionGateData({ ...r.data, cells: rawCells }, gridSize);
  return { gridSize, preview: { gridSize, cells: worldPreview(previewData, MAX_PREVIEW_CELLS) } };
}

export default async function worldsFeatured(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405, origin);

  const url = new URL(request.url);
  const isTemplates = url.searchParams.get('templates') === '1';

  // The landing page must never break if the DB is cold — degrade to an empty
  // feed (the carousel hides itself) rather than surfacing a 500.
  try {
    const sql = getSql();

    if (isTemplates) {
      // Template marketplace listing — public, unauthenticated.
      // Predicate matches the remix eligibility guard in world-remix.mjs:
      //   is_template = TRUE AND template_price IS NOT NULL AND status = 'published'
      // authorName: only display_name from profiles — never email or other PII.
      const limit = 24;
      const rows = await sql`
        SELECT
          w.id,
          w.slug,
          w.name,
          w.grid_size,
          w.data,
          w.template_price,
          w.remix_count,
          p.display_name AS author_name
        FROM worlds w
        LEFT JOIN profiles p ON p.id = w.owner_profile_id
        WHERE w.is_template = TRUE
          AND w.template_price IS NOT NULL
          AND w.status = 'published'
        ORDER BY w.remix_count DESC NULLS LAST, w.published_at DESC NULLS LAST, w.id DESC
        LIMIT ${limit}
      `;
      const templates = (rows || []).map((r) => {
        const { gridSize, preview } = buildPreviewRow(r);
        return {
          id: Number(r.id),
          slug: r.slug,
          name: r.name || 'Untitled world',
          gridSize,
          preview,
          templatePrice: Math.max(0, Math.floor(Number(r.template_price) || 0)),
          remixCount: Math.max(0, Number(r.remix_count) || 0),
          authorName: r.author_name || 'Unknown',
        };
      }).filter((w) => Array.isArray(w.preview.cells) && w.preview.cells.length > 0);
      return jsonResponse({ templates }, origin);
    }

    const limit = 12;
    const rows = await sql`
      SELECT id, slug, name, grid_size, data
      FROM worlds
      WHERE status = 'published' AND slug <> ${TINYVERSE_HUB_SLUG}
      ORDER BY published_at DESC NULLS LAST, id DESC
      LIMIT ${limit}
    `;
    // Bound the per-row work BEFORE normalization. A published world's `data` can be
    // up to 20MB; on an unauthenticated route we must not iterate/allocate the whole
    // blob. Clamp gridSize and slice the raw cell list to a small ceiling first — a
    // preview only ever needs the first ~grid^2 cells anyway. (worldPreview also caps,
    // but the cap must come before normalize, not after — Codex review finding.)
    const worlds = (rows || []).map((r) => {
      const { gridSize, preview } = buildPreviewRow(r);
      return {
        id: Number(r.id),
        slug: r.slug,
        name: r.name || 'Untitled world',
        gridSize,
        preview,
      };
    }).filter((w) => Array.isArray(w.preview.cells) && w.preview.cells.length > 0);

    return jsonResponse({ worlds }, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingWorldSchema(err) || isMissingProfileSchema(err)) {
      return isTemplates
        ? jsonResponse({ templates: [] }, origin)
        : jsonResponse({ worlds: [] }, origin);
    }
    return errorResponse('worlds-featured-failed', 500, origin);
  }
}
