---
name: tinyworld-island-and-planes
description: Use when changing the home island layout, edge dressing, undersides, autoincentive sponsor banner (now a bottom-right DOM banner), plane/crop-duster flight paths, banner streamers, or which side of the island is "front".
---

# Tiny World Island & Planes

## Coordinate system + camera-facing side

- The home island is centred at world origin. Top of grass = `y = 0`. Underside
  of dirt slab + inverted stepped underside extends down from there.
- `GRID` (default 8, max 20, ranges from `HOME_GRID_MIN` to `HOME_GRID_MAX`) ×
  `TILE` (=1) sets the edge length. Half-width = `(GRID * TILE) / 2`.
- `DIRT_H = 0.55` — visible dirt block height.
- Default camera: `DEFAULT_AZIMUTH = π * 0.32`, `DEFAULT_POLAR = π * 0.30`
  → camera sits in the +X +Z quadrant looking back at origin. The **+Z face is
  the "front" of the island** (most camera-facing side).

## `buildHomeBorder()` flow

Defined ~line 16340. Rebuilds the island's undersides and edge dressing every
time the home grid changes:

```
clear homeBorderGroup children
vbox(... underside slab ...)
voxelInvertedSteppedRoof(... cascading underside ...)
addIslandRocketEngines(homeBorderGroup)
addIslandEdgeDressing(homeBorderGroup)    // tufts, rocks, dirt accents
(island front drape removed — autoincentive now a DOM banner, bottom-right)
prepareHomeBorderForRender(homeBorderGroup)
buildDistantWorlds()
buildUnderIslandClouds() (if defined)
```

Anything you add that should live on the island should be appended inside
`buildHomeBorder()` so it rebuilds correctly when the user changes
`#render-home-grid` (the home board size selector).

Some of the round underside pipes emit a faint output from their outer
(side-facing) end — clear **water**, **murky** brown water, or **steam** — via
the pipe-emitter system in `23-particles-clouds.js` (`registerPipeEmitter` /
`updatePipeEmitters`, ticked next to `updateSmoke`). `addIslandUtilityUnderside`
(`13-distant-dressing-ghost.js`) registers ~32% of pipe runs (split
water/murky/steam) at their end; `buildHomeBorder` calls `clearPipeEmitters`
first. Emitter coords are local to `homeBorderGroup`; particles live in
`xrWorldRoot`, are capped at 140, and only spawn when `camera.position.y < 4`
(underside in view). Water/murky fall under gravity; steam rises and expands.

The home island underside (slab + `voxelInvertedSteppedRoof`), the island
**edges** (`addIslandSideBacking`), and the underside **greebles**
(`addIslandUtilityUnderside` trays/clamps) now honour the **Voxel bevel**
setting (`renderVoxelBevel`): their `vbox` calls no longer pass `noBevel`/`skip*`
(which would route to the un-beveled `getOpenBoxGeometry`). `voxelInvertedSteppedRoof`
is shared, so editable islands and the new-island stamp underside bevel too.
Cost note: at max bevel (0.06) the merged homeBorder geometry grows ~13× (the
many tiny greebles each round), so keep bevel modest. The **distant ghost-island
dressing** (tiny far preview islands) intentionally stays `noBevel` for perf.

Island shell materials (`M.boardSide`, `M.boardSideEdge`, `M.islandUnder`,
`M.islandUnderD`) opt into the world-UV shader pass in `04-textures.js`. Side
faces use the internal `island-side-blocks` texture for large pale stone
squares, while underside materials use
`textures/island-underside-voxel.png` (`texIslandUndersideVoxel`) so the bottom
reads as larger dark beveled voxel blocks; keep replacement shell art seamless
and power-of-two because Three.js r128 repeats it with mipmaps. The shader pass
darkens a coarse horizontal/vertical side grid and lightly modulates each
block/underside cell in the fragment shader. It uses world position/normal
varyings, so the large merged side slabs read as chunky voxel blocks without
adding geometry or draw calls. `islandShellMaterial()` in `03-geometry-materials.js`
copies the base material's `onBeforeCompile` hook so the side-backing clone keeps
the same coarse grid.

Island edge strata is shader-driven on the side backing only:
`addIslandSideBacking` uses the dedicated `M.boardSideEdge` shader material. Its
top is anchored to `ISLAND_SIDE_STRATA_TOP_Y = TOP_H`, the visible top of the
grass cap. The shader samples the internal image-style slice
`texIslandSideStrataReference`; do not rebuild this as normalized fragment math
or the grass/dirt/rock bands will stretch into tall green columns. The function
still keeps the cheap plain `M.boardSide` backing wall that the island needs
below the effect. The strata carrier itself is a very shallow top-edge slice:
`ISLAND_SIDE_STRATA_HEIGHT = TILE * 0.035`; do not stretch it to fit the full
side height. The carrier is a single wraparound `BufferGeometry` band whose
outer edge sits just proud of the grass cap edge (`TILE * 0.055`) so corners
meet cleanly and the layer reads through the edge dressing without becoming a
floating pane. Do not render the strata carrier as four thick boxes with
interior faces, because that creates corner gaps and green panes through the
island. Keep the side-carrier mesh out of static base merging so the shader
stays inspectable and continues to sit behind the current edge greebles/lumps;
do not add separate overlay panels or per-tile decal geometry for this effect.

Underside pipes and water details are material-driven: `M.utilityPipe`,
`M.utilityPipeD`, and `M.utilityClamp` use the internal `pipe-metal` canvas
texture; `M.waterFoam` and `M.waterfallFoamPuff` use the internal
`water-froth` canvas texture. Keep these procedural unless the user asks for a
specific bitmap, because they apply to many tiny utility meshes and particles.

## Editable-island LOD + whole-island select/delete

- Two gates decide an editable island's LOD: a **distance** gate
  (`editableIslandBaseDesiredLod`, full within `max(40, span*5.2)`) and a **count
  budget** (`editableIslandFullLodBudget`, now +8: all full up to 14 islands,
  then 12/11/10). Both were widened so a placed cluster of ~8 islands keeps its
  real base + per-cell surface instead of dropping to the flat `proxyGroup`
  (which is what "island without a base / different surface" was).
- **Click an island's side** (no cell/object there) with the Select tool to
  select the WHOLE island: `pickEditableIslandBody` (`18-scene-pick-xr.js`) walks
  up to `userData.editableIslandId` (excludes home). It outlines the island
  (`setIslandSelectionOutline`, a box-edges `LineSegments` child of `island.group`
  so it follows move/rotate) and raises the move gizmo.
- **Delete/Backspace** on a selected island (no cell selection) calls
  `removeEditableIsland` — undoable, because the world-history snapshot includes
  `serializeEditableIslands()`. It clears the island's board cells, moorings
  anchored to it, registries, and selection.

## Island placement: 4-side holograms

With the Island tool active, hovering an island shows a blank-island hologram on
each of its **4 free cardinal sides at once** (`37-island-placement-holos.js`,
reuses `islandPlacementSlots(anchor).slice(0,4)` + `makeBlankIsland` +
`makeGhostHoloMaterial`). Occupied sides and the home origin are filtered out
("minus blocked by anything"). Hovering a hologram highlights it (`uBase`
0.10->0.36, brighter blue, slight scale-up) via a per-frame raycast in
`updateIslandPlacementHolos(x,y)`; clicking a hologram places there. GOTCHA: hover-test the holos **first** and keep the anchor **sticky** — `pickTile` ignores the holos, so recomputing the anchor while hovering a hologram flips it to whatever (home/other island) sits behind it and rebuilds the holos out from under the cursor (they "disappear" on click). Only re-anchor when hovering a *different* island; keep holos over empty space
(`applyToolToCell` checks `islandPlacementHoloHoveredSlot()` first, before any
island-select). `selectTool` clears the holos when switching away; the holo
shader `uTime` ticks via `tickIslandPlacementHolos`. The single snap-to-slot
hologram path is bypassed for the Island tool. GOTCHA: when cloning the
ghost-outline hull, collect mesh nodes *before* `o.add(hull)` — adding during
`traverse` recurses into the new hull forever (stack overflow).

The **home island is not movable**: its editable surface lives in the shared
world grid (`worldGroup`, picked by logical gx/gz), while only `homeBorderGroup`
(the base) is its transform group — so dragging it would shift the base away from
the locked surface. `updateTransformGizmo` (`12-selection-tool.js`) refuses to
bind the move gizmo when `selectedEditableIsland().__home` is set (selecting a
home *engine* sets `selectedEditableIslandId = 'home'`, which previously let the
gizmo grab it). Sky/editable islands stay movable. Making the home island truly
relocatable as one piece would require re-parenting the home cells into a movable
group and routing their picking through that transform (as editable islands do).

Island engines (home + editable, `userData.editableIslandEngineId`) can only be
selected **from underneath**: `pickEditableIslandEngine` (`18-scene-pick-xr.js`)
early-returns `null` when `camera.position.y >= 0`. Otherwise a pick ray from
above passes through the board and grabs the engine hanging behind it. Mirrors
`pickTile`'s "refuse picks from below the surface" convention, inverted.

Home-island rocket engines keep their chunky voxel casing, but the animated
jet plume is a small set of static or simply X-flipped shader sheets. Do not
rebuild it as many per-layer flame cubes; the sheet approach keeps the
underside readable while staying cheap for large-island scenes. Keep older
voxel object builders as inactive legacy helpers rather than deleting them;
they may be useful again for alternate engine styles or detail settings.

## Autoincentive sponsor banner

The PNG/JPG ships inline as `AUTOINCENTIVE_BANNER_DATA_URL` (~41 KB base64
JPEG) so there's no extra HTTP. Same data URL feeds:

1. A fixed DOM banner in the **bottom-right** of the screen
   (`<a id="brand-banner"><img id="brand-banner-img">`), src set by the
   `applyAutoincentiveSponsorLogo` IIFE. Clickable, opens
   `https://x.com/Autoincentiv3`. Hidden in showcase + XR via `.brand-banner`
   rules in `styles/tiny-world.css`.
2. The sponsor logo in the Workspace settings panel
   (`<img id="sponsor-logo-autoincentive">`, populated by the same IIFE).

The old 3D island front-facing drape (`buildIslandFrontBanner` /
`tickIslandBanners`, a flapping cloth mesh on the +Z side) has been **removed
from the scene**: the call in `buildHomeBorder()` (13-distant-dressing-ghost.js)
is gone, so the functions remain defined but inert (legacy). `tickIslandBanners`
still ticks but is a no-op while `islandBannerEntry` stays null.

If the user changes art, swap the data URL and the `2.5:1` aspect — width
fits ~`GRID * 0.7`.

## Plane / crop-duster system

Defined in the **crop duster route / state** section (~line 26200).

- 3-plane pool (`planes[]`), shown in formations or solo.
- Persisted setting `tinyworld:render:planesEnabled` controls the whole system
  and defaults off for now. When off, the GLB/textures are not loaded and
  hidden banners/crop-dust particles are cleared.
- Two run kinds chosen randomly each cycle:
  - `startDustingRun()` — uses `planDustingCurve()` to sweep over crop cells.
  - `startBannerRun()` — uses `planBannerCurve()` to fly **behind** the
    island so the towed text banner reads against the sky.
- `planBannerCurve()` places the path at `target.z - (GRID * 0.5) - (GRID * 2)`
  — i.e. ~2 island lengths behind the back edge. Altitude is
  `Math.max(renderCloudHeight + 0.2, FLIGHT_CRUISE_ALT - 1.6)` — a touch
  lower than the dusting cruise altitude.
- Engine sound is jet/rocket — use `foley-rocket-engines-1..4`, NOT
  `foley-propellers-*` or `large-prop-engine-*` (the model is a jet).

The towed banner cloth uses `updatePlaneBannerFlap` (per-vertex sine wave
travelling along the X axis). Banner messages come from `BANNER_MESSAGES`.

## When changing layout

- "Front" side of island = +Z. North/South/East/West correspond to ±X / ±Z;
  do not assume Y-up screen coordinates.
- The `new-island` tool creates an editable duplicate island board, not a
  cell object. It keeps its own logical board coordinates so normal tools keep
  using `setCell()`, while the island group handles X/Y/Z positioning and Y
  rotation through the gizmo. Do not expose scale for island-board transforms.
- New editable islands should not seed every default grass cell through
  `setCell()`. Keep default grass virtual, add one pickable default-surface
  mesh for the board, and materialize sparse per-cell meshes only after the
  user edits a cell.
- Duplicate island undersides use static voxel lift engines ported from
  `voxel_lift_engine.html`: propellers face downward and the thrust/plume/glow
  system remains off. Do not register these with `islandRocketFlames` or
  `islandRocketEngines`.
- For duplicate-island lift engines, the engine wrapper rotates local axes
  downward. Keep propeller local `X`/`Y` offsets at `0` so it stays centred on
  the visible lift shaft; use local `Z` (currently
  `EDITABLE_ISLAND_PROP_LOCAL_Z = -2.84`) for the lower shaft mount, and keep
  the short non-spinning spindle sleeve at `EDITABLE_ISLAND_PROP_SPINDLE_LINK_Z`
  so the propeller visibly connects to the shaft. Keep the legacy large outer
  hub cap and old two-cube hub blocks behind opt-in flags; the default propeller
  should not show block lumps on top of the shader/blur disc. High-RPM
  readability comes from the shared dark shader blur/strobe disc, while the
  voxel blade groups are a startup/slow-spin visual.
- Duplicate island lift engines are island attachments, not board cells.
  Persist their `engines` state on the island record, stamp engine meshes with
  `editableIslandEngineId` for raycast selection, and tick their propellers from
  the central animation loop.
- Mooring cables are point-to-point world decorations, not board cells. Store
  only anchor records in `moorings` (`scope: home|island`, optional
  `islandId`, and local `{x,y,z}`), rebuild their TubeGeometry under the
  non-pickable `mooringGroup`, and include them in undo/export/save state. When
  placing a cable, raycast exact surface points rather than `pickTile()` so
  underside picks work, and reject routes that pass through registered
  propeller, jet engine, or rocket plume hazard spheres.
- Mooring anchors are tied to the current board/island surface topology. Clear
  them with `clearMooringCables()` on home-grid changes, starter-scene resets,
  and demo paths that replace islands; imports can then restore valid saved
  cables with `replaceMooringCables()` after islands have been recreated.
- Number duplicate-island engine slots around the island. Slots 1 and 3 spin
  clockwise; slots 2 and 4 spin anticlockwise, so diagonal props match while
  adjacent props counter-rotate.
- Duplicate island bases should reuse the home-island greeble layers:
  `addIslandUtilityUnderside()` for underside pipes/cables/boxes and
  `addIslandEdgeDressing()` for grassy/dirt/rock edge chunks.
- Any new edge dressing must be added inside `addIslandEdgeDressing()` (per
  the existing per-edge loop with `cellRand` noise) so it stays consistent
  across all four sides.
- Anything anchored to the island that animates must be ticked from the
  central animation loop (call sites near `updateCropDuster(dt)` in
  `renderer.setAnimationLoop(animate)`).
- Duplicate islands use LOD: selected/near islands show full base/content,
  mid/far islands show cheap proxy slabs, and hidden islands skip content,
  underside detail, and engine propeller ticks. Preserve this before adding
  new per-island animation or decoration.

## Validation

After island/plane changes:
- `node tools/check.js`
- Visually check at default 8×8 grid and after toggling to 20×20 — sizes
  rebuild the island.
- Confirm planes fly behind the island, banner stays readable against the
  sky, and engine sound (if positional audio active) pans correctly L↔R as
  the plane crosses the camera.


## Mooring "Connect" cables — styles + interaction

- The infra tool is labelled **"Connect"** (id stays `mooring`, `t.mooring`).
- Each placed cable carries a `style` in `MOORING_STYLES`
  (`14-editable-islands-moorings.js`): power (amber), water (blue), waste
  (green), data (purple), mooring (default dark). `style` is normalized
  (`normalizeMooringStyleId`), persisted via `serializeMooringCables`, and
  drives the tube material (`mooringStyleMaterial`). Change it with the global
  `setMooringCableStyle(id, style)` (rebuilds + saveState).
- Cables stay `noPointerPick` for the placement raycast. `36-mooring-interaction.js`
  runs its **own** raycast against `mooringGroup` (only while the Select tool is
  active): hover swaps the cable's meshes to `mooringHoverMaterial` (blue);
  a click opens a radial (`.radial-menu.mooring-radial`, reuses radial CSS) to
  pick the style. While that radial is open a full-screen
  `.mooring-radial-backdrop` (z 45, below the buttons at z 46) `preventDefault`+
  `stopPropagation`s every pointer/wheel event and closes on outside click, so
  canvas pan/orbit cannot fire and the type buttons stay clickable. (The menu
  container is `pointer-events:none`, so without the backdrop a miss between
  buttons falls through to the canvas and pans.) Verify pickability with 3D math (project tube vertices →
  raycast `mooringGroup`), not screenshots.
