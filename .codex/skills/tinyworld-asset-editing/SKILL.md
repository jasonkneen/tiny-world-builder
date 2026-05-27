---
name: tinyworld-asset-editing
description: Use when changing Tiny World Builder selection placement, freehand drawing, asset clipboard, cut/copy/paste/duplicate, saved templates, or Stamps panel navigation.
---

# Tiny World Asset Editing

Use the existing board intent contract:

- `world[x][z]` is intent and `cellMeshes['x,z']` is render state.
- New asset edits must flow through `setCell(x, z, opts)` or helpers that call it.
- Selection state is exposed through `window.__tinyworldSelection`; use `worldCoords()`, `materialize()`, and `replaceWorldCoords()`. Do not parse raw `selectedCells` keys in new code.

Placement rules:

- Bulk placement over a selection should call the normal `applyTool()` path once per selected world coord with `{ skipSelectionBulk: true }`. This preserves tool variants, terrain overrides, ghost transforms, fence logic, model stamp settings, and existing `setCell` side effects.
- Freehand drawing uses `dragMode === 'draw'`, `drawVisitedCells`, `drawLastWorldCoord`, and `applyDrawToolToHit()`. Drawing should not repeatedly stack terrain, bridges, or same-kind objects while the pointer crosses the same cell.
- Fence, wall, and boundary are still `kind: 'fence'`; use `fenceSide` plus `floors`. Wall starts at level 4, boundary at level 5. Drawing a higher-level fence over an existing same-side fence should upgrade to that base level, not silently no-op.

Clipboard and templates:

- The asset clipboard shape is `{ version, origin, size, cells: [{ dx, dz, cell }] }`.
- Build clipboard cells with `cloneCellIntent()` so terrain, terrain height, kind, floors, building type, fence side, extras, rotation, `offsetX/Y/Z`, appearance, and `waterFlow` survive copy/paste and saved templates.
- Template saves live under `tinyworld:asset-templates.v1` in `localStorage`. Keep these world-intent templates separate from model stamps and voxel build stamps.
- Pasting or duplicating a multi-cell clipboard should call `replaceWorldCoords()` with placed cells so the pasted region stays selected for immediate follow-up edits.

Selection properties:

- Keep selection property controls grouped by durable sections (`Edit`, `Transform`, `Appearance`, `Ground`) so dense multi-selection actions stay scannable.
- Section changes should be presentation-only unless the edit contract changes; preserve existing row keys and route behavior through `applySelectionProperty()`.

Stamps panel:

- Stamps navigation is client-side. `stampBuilderAllTools()` builds model, voxel, and built-in stamp tools; filtering combines active category and search text.
- Category counts should reflect the current search. Status text should reflect the number of shown stamps and the active category/search.
- Model-stamp categories are inferred from labels, paths, formats, URLs, and sidecars. Do not add generator manifest fields unless a durable category contract is explicitly needed.

Validation:

- Run the inline script syntax check, `npm test`, and `npm run build`.
- Browser-check Stamps category plus search, selected bulk placement, draw wall/boundary behavior, copy/paste/templates, duplicate, `1`/`E`, `R`/`F`, clear, perspective toggle, and console errors.
