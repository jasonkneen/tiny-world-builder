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
- Bulk placement with a saved asset template should paste a one-shot template payload at each selected world coord and leave every placed template cell selected, not just the final paste.
- The selection properties `Actions` row can expose an `Apply tool` command; it should reuse the same bulk-placement helper rather than duplicating placement logic.
- Shift-drag rectangle fill with a placement tool should leave the filled region selected so users can immediately adjust properties, move, copy, template, or apply another tool.
- Freehand drawing uses `dragMode === 'draw'`, `drawVisitedCells`, `drawLastWorldCoord`, and `applyDrawToolToHit()`. Drawing should not repeatedly stack terrain, bridges, or same-kind objects while the pointer crosses the same cell.
- Successful freehand placement strokes should replace the active selection with the drawn world coords so the Properties panel, copy/duplicate, and template flows are immediately available for the stroke.
- Freehand fence/wall/boundary drawing should de-dupe by world cell plus resolved fence side, so repeated strokes of the same side no-op but corner strokes can add another side to the tile.
- Fence, wall, and boundary are still `kind: 'fence'`; use `fenceSide` plus `floors`. Wall starts at level 4, boundary at level 5. Drawing a higher-level fence over an existing same-side fence should upgrade to that base level, not silently no-op. This also applies when the fence is stored as an `extras` entry beside another occupant.
- Interpolated freehand fence/wall/boundary cells should derive auto `fenceSide` from each draw step direction, not from the final pointer edge copied onto every skipped cell. The fence tool is now a **single icon** with no variant flyout. The placement hologram previews the auto `fenceSide` from hover (nearest tile edge), and **repeat-clicking the same side levels it up** `1→2→3→4→5` (wood → taller → wire → stone **wall** → steel **boundary**), so Wall/Boundary are reached by re-clicking rather than separate tool variants. The old fixed-direction variants (`north`, `east`, `center-x`, …) and the Edge/Wall/Boundary type variants were removed; the underlying `fenceSide` values (`n`/`e`/`s`/`w`/`center-x`/`center-z`) and `floors` levels are still valid for stored/rendered cells.

Clipboard and templates:

- The asset clipboard shape is `{ version, origin, size, cells: [{ dx, dz, cell }] }`.
- Build clipboard cells with `cloneCellIntent()` so terrain, terrain height, kind, floors, building type, fence side, extras, rotation, `offsetX/Y/Z`, appearance, and `waterFlow` survive copy/paste and saved templates.
- Template saves live under `tinyworld:asset-templates.v1` in `localStorage`. Keep these world-intent templates separate from model stamps and voxel build stamps.
- Saving a template should build a one-shot clipboard payload from the active selection/hover target and must not overwrite the user's explicit copy/cut clipboard.
- Pasting or duplicating a multi-cell clipboard should call `replaceWorldCoords()` with placed cells so the pasted region stays selected for immediate follow-up edits.
- Duplicating selected cells should use a one-shot payload and must not overwrite the user's explicit copy/cut clipboard.
- Moving selected cells between board tiles should reuse the clipboard payload shape internally but must not overwrite the user's explicit copy/cut clipboard.
- Select-tool dragging from inside an active selection should move the selected cells cell-by-cell through the same internal move path, preserving selection and leaving the user's explicit copy/cut clipboard untouched.
- Paste actions should target the hovered cell first, then fall back to the selected region origin. Clear stale hover when the pointer leaves the canvas so this fallback remains reachable. The latest-template shortcut should paste a one-shot template payload, not overwrite the user's explicit copy/cut clipboard.
- Saved asset templates should also surface in the Stamps panel under `Templates`; selecting one should place from its one-shot template payload and preserve the user's explicit copy/cut clipboard.
- Template cards in Stamps should provide a delete control that removes the `localStorage` entry, refreshes Stamps counts/cards, and clears stale selected-template tool state.
- Saved template names should summarize their copied cell contents so template cards stay readable and searchable without a separate naming dialog.
- `Delete`/`Backspace` should clear the active selection or hovered cell without writing to the asset clipboard; keep this separate from cut/copy semantics.
- The selection properties `Actions` row should expose the same non-clipboard Delete path so mouse users can clear selected assets without using Cut.
- Keyboard tile moves should keep selection behavior consistent with the property panel: `Shift+Arrow` shifts selected cells through the internal move path without replacing the user's explicit clipboard, while arrows without an active selection keep camera/ghost behavior.

Selection properties:

- Keep selection property controls grouped by durable sections (`Edit`, `Transform`, `Appearance`, `Ground`) so dense multi-selection actions stay scannable.
- Selection properties must remain available when AI interfaces are disabled (`?ai=0` / `html.ai-disabled`); hide prompt/chat controls, not the selected-object properties surface, and open selected objects directly to Properties so the property rows are visible.
- Split dense edit actions into scannable rows when needed, but keep routing through durable row keys such as `selectionAction` so behavior remains centralized.
- Section changes should be presentation-only unless the edit contract changes; preserve existing row keys and route behavior through `applySelectionProperty()`.
- Property group tabs are presentation state only (`tinyworld:selection-props-active-tab.v1`); keep the durable row keys/actions intact underneath tabbed Edit/Transform/Appearance/Ground views.
- Collapsible property sections should persist in `tinyworld:selection-props-collapsed.v1`; toggling sections must not remove or rename underlying row keys/actions.
- Icon/round-button treatments for rotate, nudge, scale, and history controls should preserve full labels through `aria-label`/`title`; the glyph is visual shorthand, not the action contract.
- Use `currentValue` plus `aria-pressed`/`.active` on property chips when a selected value is uniform, and leave mixed selections unpressed.
- Colour rows and preview quick chips should route through `bodyColor`/`topColor` for any supported built-in kind, not just buildings. Expand `applyAppearanceToObject()` material buckets when exposing new colour rows so the world render and selection preview actually change.
- Colour rows should include a `Default` option that clears only the matching `bodyColor`/`topColor` override while preserving materials, style, transform, and the other colour row.
- Selected-object transform reset controls should clear rotation, offsets, object scale, and per-axis scale while preserving non-transform appearance fields like model/voxel stamp IDs, materials, colours, and style.
- Selected-object scale rows should also provide per-scale reset controls that clear only `objectScale`, `scaleX`, `scaleY`, or `scaleZ`, preserving materials, colours, model IDs, and style.
- Selected-object nudge controls should include a recenter path that clears only `offsetX/Y/Z`, preserving rotation, scale, materials, colours, model IDs, and style.
- Selected-object material scale controls should offer a reset path that clears only the matching texture-scale key and keeps the chosen texture/material, colours, model IDs, and style intact.
- The in-scene transform gizmo is constrained to selected object transforms: within-tile X/Z offset, lift, Y rotation, and object scale. It should update the same cell fields as the Properties panel and stay undoable as a single drag batch.
- Duplicate islands are board-level transforms, not selected object
  transforms. The `new-island` tool should select/create an editable island
  board and route gizmo movement/rotation to the island group, while normal
  object transform rows continue to operate on selected cells only.
- Selection overlays on duplicate islands must be drawn in island-local cell
  axes. When an island is rotated, transform both selected tile centers and
  edge-strip offsets through the island group instead of offsetting borders in
  world X/Z.
- The Layers panel is a read-only world hierarchy surface. It should select
  cells through `window.__tinyworldSelection.replaceWorldCoords()`, not by
  mutating selection internals, and should refresh from `tinyworld:selection-changed`,
  `tinyworld:world-changed`, and `tinyworld:grid-changed` events.
- The radial root X and the Escape key must close by exiting sub-edit when
  active, then clearing the active selection through
  `window.__tinyworldSelection.clear()` / `clearSelection()`. That clear path
  must deselect cells, editable-island engines, and whole editable islands
  (`selectEditableIsland(null)`), not merely hide the radial DOM.
- Sub-object editing is surfaced through `window.__tinyworldSubEdit`, not a
  parallel inspector state. Layers should show part rows from
  `__tinyworldSubEdit.hierarchy()`, select them with `selectPart(partKey)`, and
  refresh from `tinyworld:sub-selection-changed`. The shared transform gizmo can
  target `__tinyworldSubEdit.selectedGizmoTarget()`; use `movePart(..., { snap:
  !shiftKey })`, `scalePart()`, and `rotatePart()` so keyboard, Properties, and
  in-scene handles stay consistent.
- Sub-object edit eligibility is centralized in `isVoxelSubEditableKind()`.
  Radial menu and Properties must use that helper instead of maintaining
  separate kind lists. When a supported built-in object enters sub-edit,
  `renderCellObjectImpl()` forces the voxel renderer for that active cell so
  rock/fence/crop/animal/micro voxel objects get real part keys. Entering edit
  should not auto-explode; explicit Explode remains a user action. A plain
  canvas click that misses a selectable part exits sub-edit and must not fall
  through to cell selection or placement on the same click.
- Model stamps should expose All material / All mat scale controls, but Body/Top material controls should be limited to selected asset kinds with known Tiny World material buckets; mixed selections must not write part-material fields onto model stamps.
- Generated `voxel-build` / customParts objects are editable through the same
  Layers / Properties appearance rows as built-ins: All material, Body material,
  Top material, Body/Top colour, and matching material-scale resets. Keep
  `model-stamp` excluded from Body/Top material rows, but do not exclude
  `voxel-build`.

Stamps panel:

- Stamps navigation is client-side. `stampBuilderAllTools()` builds model, voxel, and built-in stamp tools; filtering combines active category and search text.
- Include terrain/landscape tools in Stamps alongside objects so the panel can replace toolbar hunting for grass/path/dirt/water/stone/lava/sand/snow placement.
- Include every normal placeable tool in Stamps, including small plant tools like `tuft`; do not leave toolbar-only assets out of the searchable stamp library.
- Keep Tiny World's voxel-build stamp library aligned with the standalone voxel builder concepts where practical, especially tree/garden/utility stamps that users expect under Stamps.
- Category counts should reflect the current search. Search is token-based: every whitespace-separated term must match the tool search text. Status text should reflect the number of shown stamps and the active category/search.
- Stamps search should support fast keyboard selection: Enter activates the first selectable visible stamp, ArrowDown focuses the first selectable card, and Escape clears a non-empty search before closing the panel.
- Stamps card thumbnail rendering should stay responsive: draw cheap fallback thumbnails immediately, cancel stale thumbnail queues on re-render, and build expensive 3D card thumbs in small requestAnimationFrame batches.
- The `Recent` stamps category is derived from `tinyworld:stamp-builder-recent.v1` and should use the same `stampBuilderSelectionKey()` values as selected-card state. Keep it ordered by most recent selection and remove deleted template keys.
- Toolbar, flyout, and keyboard selections that correspond to stamp-builder tools should update `Recent`; ignore Select, Erase, Auto, hidden tools, and other non-stamps so stale keys do not crowd out real stamps.
- Model-stamp categories are inferred from labels, paths, formats, URLs, and sidecars. Do not add generator manifest fields unless a durable category contract is explicitly needed.
- Model-stamp OBJ/MTL support must preserve filenames with spaces in `mtllib` and `map_Kd` lines. VoxEdit-style `Tr 1.000000` should not make a textured model fully transparent; treat it as opaque unless a `d` dissolve value says otherwise.
- Rigged GLTF/GLB model stamps need a skinned-mesh-aware clone path. Plain `clone(true)` can leave skeletons tied to the cached source scene when multiple stamps are placed.
- Preserve `gltf.animations` in the model-stamp asset cache. Runtime systems such as crowd character replacements use those clips after cloning the cached scene.
- Drag/drop imports live in `43-drag-drop-import.js`. Model files register through
  `window.__tinyworldRegisterDroppedModelStamps`, including local sidecars and
  object URLs, while chat attachments expose `window.__tinyworldAgentDropAttachments`
  for image/model prompt context. Canvas model drops must still place via `setCell()`
  and keep selection sync through `window.__tinyworldSelection`.
- Chat-attached model imports must keep the exact dropped `modelStampId`: the
  prompt context should use MUST-level wording, and generated `model-stamp`
  cells should be repaired to the attached id before `applyState()` /
  `applyStatePatch()` when there is exactly one attached model.
- Dropped model loader failures must surface through the drop status and
  `window.__tinyworldModelStampLoadState`; do not leave the generic
  model-stamp placeholder as the only feedback.
- Canvas model drops should wait for the dropped model to reach loader `ready`
  before calling `setCell()`. If the GLB/GLTF fails, show the loader error and
  do not stamp the placeholder into the world.
- Dropped model stamps must persist their source files outside the world JSON
  (currently IndexedDB) and restore them into the model-stamp registry on boot.
  Saved cells may keep only `appearance.modelStampId`, but that id must resolve
  after reload and schedule a model-stamp refresh instead of staying on the
  generic placeholder.

Validation:

- Run the inline script syntax check, `npm test`, and `npm run build`.
- Browser-check Stamps category plus search, selected bulk placement, draw wall/boundary behavior, copy/paste/templates, duplicate, `1`/`E`, `R`/`F`, clear, perspective toggle, and console errors.


## Layers dialog (redesigned)

`32-layers-panel.js` + `#layers-panel`. Styled like the blocks panel: a grab-cue
**drag bar** (no title), a block-style **Layers / Properties** tab bar, glass +
`resize: both`. The tree is island-grouped — `collectIslands()` builds a top-level
`<details>` per board (**Home Island** + each `editableIslands` entry) whose
children are that board's terrain cells -> objects/extras (world coords as the
cell id). Clicking a tree item selects its cell and switches to the **Properties**
tab, which **relocates the shared `#agent-selection-properties` node** (rendered
by module 28) into `#layers-props-host`; switching back to Layers / closing the
panel restores that node to the agent panel (`selPropsHome`). Keep the tree dense
(small summary padding, 14px branch indent, 1px gaps).
The old agent-panel Preview/Properties selection dialog has been retired: module
28 renders the shared properties node as a hidden staging element, while radial
More/Style/Move and multi-cell selection should open `window.openLayersPropertiesPanel()`.
Because that staging element is hidden, `updateSelectionPreview(target)` must
clear the preview and avoid starting the preview WebGL `requestAnimationFrame`
loop unless the preview UI is genuinely visible again.
Canvas selection and Layers selection must stay visually synced. The tree should
derive selected rows from `window.__tinyworldSelection.worldCoords()`, include a
selected default grass tile even when it would otherwise be omitted as an empty
cell, highlight matching child object rows as well as the terrain parent, force
the selected branch open, and scroll the selected row into view when the panel is
open.
