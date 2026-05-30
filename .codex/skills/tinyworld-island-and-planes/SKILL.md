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

The home island underside (slab + `voxelInvertedSteppedRoof`), the island
**edges** (`addIslandSideBacking`), and the underside **greebles**
(`addIslandUtilityUnderside` trays/clamps) now honour the **Voxel bevel**
setting (`renderVoxelBevel`): their `vbox` calls no longer pass `noBevel`/`skip*`
(which would route to the un-beveled `getOpenBoxGeometry`). `voxelInvertedSteppedRoof`
is shared, so editable islands and the new-island stamp underside bevel too.
Cost note: at max bevel (0.06) the merged homeBorder geometry grows ~13× (the
many tiny greebles each round), so keep bevel modest. The **distant ghost-island
dressing** (tiny far preview islands) intentionally stays `noBevel` for perf.

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
  pick the style. Verify pickability with 3D math (project tube vertices →
  raycast `mooringGroup`), not screenshots.
