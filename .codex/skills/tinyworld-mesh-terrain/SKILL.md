---
name: tinyworld-mesh-terrain
description: Use when changing the Mesh Terrain sculptor — the opt-in voxel-block landscape designer that paints per-voxel materials and pull/push-sculpts flat-topped blocks, then keeps the block mesh as the rendered terrain. Module engine/world/46-mesh-terrain.js.
---

# Tiny World Mesh Terrain Sculptor

A self-contained, opt-in landscape designer in `engine/world/46-mesh-terrain.js`.
Lay a fine voxel grid over the home board, paint per-voxel materials, and
pull/push voxels up and down. The result is **flat-topped voxel blocks**, not a
smooth/curved surface, and it stays that way — Apply keeps the block mesh as the
terrain instead of baking into per-tile `setCell`.

## The model is per-voxel blocks (not a smooth heightfield)

- `cellH`: `Float32Array(N*N)` — the flat-top height of **each voxel**. There are
  no shared/interpolated vertices, so tops never slope into curves. Sculpting
  clamps `cellH` to `[0, MAX_HEIGHT]` — ground (0) is the floor, so you build up
  from the ground and cannot dig below it.
- `mats`: `Uint8Array(N*N)` — per-voxel material index into `MATERIALS`
  (ids match real terrain names: grass/sand/water/stone/dirt/snow/lava).
- `N = GRID * effVpt` voxels per side; `effVpt` is clamped so `N <= MAX_N` (96).
- Render (`rebuildGeometry`): each voxel writes a flat **top quad** at its height
  plus **vertical step-walls** only on edges where a neighbour (or the board
  boundary) is lower. Boundary walls drop to a base skirt below the lowest block.
  Geometry is non-indexed and writes from **scalars** via `quad()`/`wv()` (no
  per-quad array allocation). Sculpt/paint edits don't rebuild inline — they call
  `scheduleRebuild()`, which coalesces to **one rebuild per animation frame**
  (rAF); `flushRebuild()` forces the final frame on pointer-up and
  `cancelScheduledRebuild()` runs on teardown. This keeps a fast drag from
  forcing multiple full-board rewrites per frame (engine perf budget).
- Materials use the app's REAL terrain shaders. The geometry is laid out grouped
  by terrain (all tops, then all sides) and `surfaceMesh.material` is a parallel
  array: tops get `terrainVoxelMaterials(t).base`, sides get
  `terrainRiserMaterial(t)` (the soil/stone risers). Exception: `stone` reads as
  grainy NOISE rock via `rockNoiseMat` — a grey-tinted clone of the sand material
  (`M.sand`/`texSand`) — because both the masonry finish (`M.stone`) and the
  blocky stone pattern (`M.rock`/`texStone`) look like built walls, not rock. Those materials compute UVs
  from world position in-shader (`applyWorldUVs` `onBeforeCompile`), so the blocks
  pick up the same textures/shading as the rest of the world — **do not** hand-roll
  UVs. Materials are used via double-sided clones (`dsClone`) that copy
  `onBeforeCompile`/`userData`/`customProgramCacheKey` across (r128
  `Material.clone` drops `onBeforeCompile`), cached by uuid so there is no
  per-frame churn; clones are disposed on teardown. If `M`/`terrainVoxelMaterials`/
  `terrainRiserMaterial` are missing, it falls back to a single vertex-coloured
  `flatShading` mesh (fixed per-voxel stride + degenerate fill for absent walls).

## Sculpt / paint

- **Sculpt**: drag a voxel up/down. Screen dy maps to world units
  (`perPixelWorldY`, ortho vs perspective aware). The grabbed voxel and its
  neighbours move by `worldDy * falloff(dist/brushRadius)` (smoothstep
  "tension"), reapplied from a `startH` snapshot each move so it does not
  compound. Every voxel stays flat at its own height.
- **Paint**: drag to set every voxel whose centre is within `brushRadius`.

## Apply keeps blocks — it does NOT bake into world tiles

- Persistence is **Apply-only**. Edits (sculpt drags, paint, Flatten, resolution
  changes) mutate in-memory state and are NOT written to storage; `applyDesign()`
  is the only writer (`saveDesign()`), and it also snapshots the design in memory
  (`captureApplied()` -> `appliedSnap`). This is what lets Cancel truly discard.
- `applyDesign()` sets `applied = true`, snapshots + persists, hides the flat home
  **tiles** (`setHomeMeshesVisible(false)` toggles only `m.tile`, never `m.object`,
  so placed objects stay visible), and leaves the block mesh in the scene. There
  is **no** `setCell` bake, so there are no full GRID tiles afterward.
- `cancelEdit()` reverts from the in-memory `appliedSnap` (recovering correctly
  even if the resolution changed mid-edit); if nothing was ever applied it
  disposes the mesh, restores the flat tiles, and `clearDesign()`s any draft.
- `removeDesign()` deletes the block terrain, restores the flat tiles, clears
  `appliedSnap`, and `clearDesign()`s storage.
- Boot `restoreApplied()` rebuilds an applied design and re-hides home tiles
  (with delayed retries + a `tinyworld:world-changed` listener, because world
  tiles can render slightly after this module boots).

## Programmatic generation (used by the "Realistic" landscape generator)

- `window.__tinyworldMeshTerrain.generate(sample, opts)` fills the voxel grid from
  an external per-voxel sampler and displays it as a **transient** block overlay
  (hides the flat home tiles like an applied design, but does NOT persist unless
  `opts.persist`). `sample(cellX, cellZ)` gets board-cell coords in `[0, gridAtEnter]`
  and returns `{ material: 'grass'|'sand'|…, level: 1.. }` (level → `cellH = (level-1)*opts.levelStep`)
  or `{ material, height }` (world-Y directly). It exits the manual editor if open.
- `clearGenerated()` tears the transient overlay down and restores the flat tiles
  (no-op if none, or if the user opened it for editing). `isGenerated()` reports state.
- `sampleWorld(wx, wz)`, `sampleCell(x, z, opts)`, and
  `anchorForCell(x, z, opts)` expose the visible block surface for runtime
  grounding. `anchorForCell` samples the center plus optional cardinal probes
  (`offsetX`, `offsetZ`, `radius`) and returns the highest support. Consumers must
  fall back to LandscapeEngine/tile heights when it returns `null` (for example
  over preserved water/stone holes or outside the home board).
- The Generate modal's **Realistic** landscape style routes here:
  `applyRealisticVoxelLandscape()` (in `engine/world/27-landscape-engine.js`) samples
  `sampleLandscapeCell()` (the same procedural height/biome the old realistic
  LandscapeEngine used) at voxel resolution, with `levelStep = LANDSCAPE_VOXEL_LEVEL_STEP`
  (1.12, matching the landscape-mode tile step so block tops align with the hidden
  tiles objects sit on). It is driven from the generate handler (module 28) and the
  reload path (module 29, when `useLandscapeEngine && landscapeMeshStyle==='realistic'`),
  and torn down by `disposeLandscapeMesh()` → `clearGenerated()`. Realistic keeps
  `landscapeMeshMode = false`; the world save (cells + seed + style) is the single
  source of truth, so reload regenerates the blocks deterministically — the overlay
  itself is not persisted in `tinyworld:meshTerrain:*`.
- A generated overlay is editable: opening the editor on top of it lets the user
  tweak and **Apply** (which turns it into a real persisted design; `generatedActive`
  clears).

## Why it is structured this way (do not regress)

- **One IIFE, no top-level names** → dodges the `tools/check.js` cross-file
  duplicate-declaration guard; keep new code inside the IIFE.
- **Own localStorage keys** (`tinyworld:meshTerrain:v2` design,
  `tinyworld:meshTerrain:prefs:v1` prefs). The world schema and embedded
  `WORLD_SCHEMA` are untouched, so schema parity stays green. Do not persist this
  feature in the world save.
- **Height consumers ask the mesh first, then fall back**. Current wired consumers
  include object/extras placement (`17-tile-renderers.js`), selection/hover
  height (`12-selection-tool.js`, `18-scene-pick-xr.js`), crowd/vehicle grounding
  (`11-vehicle-crowd.js`, `10-world-data.js`), and Tinyverse avatar grounding
  (`47-worlds-room.js`). Keep this one-way: consumers sample the overlay; they do
  not mutate or bake it.
- **CSS injected from JS**; guarded `styles/tiny-world.css` is never edited.
- **Window capture-phase pointer handling** that engages only when
  `e.target === renderer.domElement` and the ray hits the surface, then
  `stopPropagation()`. Otherwise events flow through so orbit/zoom and UI clicks
  keep working. Handlers attach on open, detach on leave.

## Known limitations / next steps

- The block terrain is still a separately persisted overlay. Object/avatar
  grounding can sample it, but the world save/version schema does not yet store a
  mesh-terrain payload for published islands.
- Home-tile hiding can race world (re)renders; it re-hides on
  `tinyworld:world-changed` and via short boot timers.

## QA checklist (needs a browser — npm test cannot verify rendering)

- Open the editor: a flat grid of grass blocks covers the board; flat tiles hide.
- Sculpt drag raises/lowers **flat-topped blocks** with vertical step-walls —
  no sloped/curved surfaces; neighbours taper with the brush.
- Tops use the real terrain textures/shaders (grass, water flow, stone masonry,
  etc.); side walls use the soil/stone riser materials. If they render as flat
  plain colours, the real-material wiring fell through to the fallback — check
  `M`/`terrainVoxelMaterials`/`terrainRiserMaterial` are defined at open time.
- Paint lays materials per voxel.
- Orbit/zoom still work on empty-space drag / scroll; toolbar clicks not hijacked.
- Apply keeps the blocks (no full tiles reappear); reload restores them.
- Cancel reverts; Remove deletes the blocks and restores the flat tiles.
