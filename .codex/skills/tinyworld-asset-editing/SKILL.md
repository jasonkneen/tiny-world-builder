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
- Fence, wall, and boundary are still `kind: 'fence'`; use `fenceSide` plus `floors`. Wall starts at level 4, boundary at level 5. Drawing a higher-level fence over an existing same-side fence should upgrade to that base level, not silently no-op. This also applies when the fence is stored as an `extras` entry beside another occupant.
- Interpolated freehand fence/wall/boundary cells should derive auto `fenceSide` from each draw step direction, not from the final pointer edge copied onto every skipped cell. Fixed side variants (`north`, `center-x`, etc.) should still win.

Clipboard and templates:

- The asset clipboard shape is `{ version, origin, size, cells: [{ dx, dz, cell }] }`.
- Build clipboard cells with `cloneCellIntent()` so terrain, terrain height, kind, floors, building type, fence side, extras, rotation, `offsetX/Y/Z`, appearance, and `waterFlow` survive copy/paste and saved templates.
- Template saves live under `tinyworld:asset-templates.v1` in `localStorage`. Keep these world-intent templates separate from model stamps and voxel build stamps.
- Pasting or duplicating a multi-cell clipboard should call `replaceWorldCoords()` with placed cells so the pasted region stays selected for immediate follow-up edits.
- Moving selected cells between board tiles should reuse the clipboard payload shape internally but must not overwrite the user's explicit copy/cut clipboard.
- Paste actions should target the hovered cell first, then fall back to the selected region origin. Clear stale hover when the pointer leaves the canvas so this fallback remains reachable. The latest-template shortcut should paste the loaded template, not just stage it in memory.
- Saved asset templates should also surface in the Stamps panel under `Templates`; selecting one loads its clipboard and clicking the board places it through the normal paste path.
- Template cards in Stamps should provide a delete control that removes the `localStorage` entry, refreshes Stamps counts/cards, and clears stale selected-template tool state.
- Saved template names should summarize their copied cell contents so template cards stay readable and searchable without a separate naming dialog.
- `Delete`/`Backspace` should clear the active selection or hovered cell without writing to the asset clipboard; keep this separate from cut/copy semantics.
- The selection properties `Actions` row should expose the same non-clipboard Delete path so mouse users can clear selected assets without using Cut.
- Keyboard tile moves should keep selection behavior consistent with the property panel: `Shift+Arrow` shifts selected cells through the internal move path without replacing the user's explicit clipboard, while arrows without an active selection keep camera/ghost behavior.

Selection properties:

- Keep selection property controls grouped by durable sections (`Edit`, `Transform`, `Appearance`, `Ground`) so dense multi-selection actions stay scannable.
- Section changes should be presentation-only unless the edit contract changes; preserve existing row keys and route behavior through `applySelectionProperty()`.
- Collapsible property sections should persist in `tinyworld:selection-props-collapsed.v1`; toggling sections must not remove or rename underlying row keys/actions.
- Use `currentValue` plus `aria-pressed`/`.active` on property chips when a selected value is uniform, and leave mixed selections unpressed.
- Colour rows and preview quick chips should route through `bodyColor`/`topColor` for any supported built-in kind, not just buildings. Expand `applyAppearanceToObject()` material buckets when exposing new colour rows so the world render and selection preview actually change.
- Selected-object transform reset controls should clear rotation, offsets, object scale, and per-axis scale while preserving non-transform appearance fields like model/voxel stamp IDs, materials, colours, and style.
- Selected-object material scale controls should offer a reset path that clears only the matching texture-scale key and keeps the chosen texture/material, colours, model IDs, and style intact.

Stamps panel:

- Stamps navigation is client-side. `stampBuilderAllTools()` builds model, voxel, and built-in stamp tools; filtering combines active category and search text.
- Include terrain/landscape tools in Stamps alongside objects so the panel can replace toolbar hunting for grass/path/dirt/water/stone/lava/sand/snow placement.
- Category counts should reflect the current search. Search is token-based: every whitespace-separated term must match the tool search text. Status text should reflect the number of shown stamps and the active category/search.
- The `Recent` stamps category is derived from `tinyworld:stamp-builder-recent.v1` and should use the same `stampBuilderSelectionKey()` values as selected-card state. Keep it ordered by most recent selection and remove deleted template keys.
- Model-stamp categories are inferred from labels, paths, formats, URLs, and sidecars. Do not add generator manifest fields unless a durable category contract is explicitly needed.

Validation:

- Run the inline script syntax check, `npm test`, and `npm run build`.
- Browser-check Stamps category plus search, selected bulk placement, draw wall/boundary behavior, copy/paste/templates, duplicate, `1`/`E`, `R`/`F`, clear, perspective toggle, and console errors.
