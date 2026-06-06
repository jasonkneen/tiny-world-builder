---
name: tinyworld-sandbox-terrain
description: Use when changing Tiny World Builder terrain excavation / sandbox digging — the per-cell `dig` field, signed render elevation, pit walls, geological strata, the Sculpt tool, or R/F raise-dig. Adapts the UnrealSandboxTerrain "add/remove material with layers by depth" mechanic to the tile grid.
---

# Tiny World Sandbox Terrain (dig / sculpt)

The board stays a **grid of tiles**. The only new capability is that a cell can be
carved *below* the base plane, exposing geological strata on the resulting pit
walls — the [UnrealSandboxTerrain](https://github.com/bw2012/UnrealSandboxTerrain)
"remove material, layers by depth" idea, adapted additively.

## Data model

- New optional per-cell field **`dig`** (0..`MAX_DIG`, default 0). 0 = undug.
- `terrainFloors` (1..8) still raises the ground (hills). `dig` lowers it.
- The **signed render level** is the single hook:
  `tileLevelForCell(cell) = terrainLevelForCell(cell) - cellDigDepth(cell)`
  (`engine/world/05-tile-factory.js`). It can be `< 1` only when `dig > 0`.
- `terrainRiseForLevel(level)` is **signed** — it returns a negative rise for
  `level < 1`. Do NOT re-add a `Math.max(0, …)` clamp; every undug cell still
  passes `level >= 1`, so the result stays `>= 0` and the classic look is intact.

## Why it doesn't break undug worlds

`tileLevelForCell` feeds both a cell's own geometry and `getLevelNeighbors`
side-culling, so digging just makes a cell read as "lower" everywhere. In
`makeTile` (`engine/world/06-history-object-factories.js`) the riser bottom is
`cliffBottomY = min(-DIRT_H, topOfRiser - DIRT_H, deepest lower-neighbour floor)`.
For an undug grid every neighbour is equal-or-shallower, so it resolves to exactly
`-DIRT_H` and the riser geometry is **byte-identical** to before (verified
numerically: flat grass / hills / dirt all match the old `DIRT_H + rise` formula).

A higher neighbour automatically draws its cliff **down to the pit floor** (no gap),
because a lower (dug) neighbour fails the `hideSide` cull. Two equal-depth dug
cells hide their shared wall, so a wide pit floor reads as one surface.

## Strata walls

`addVoxelTerrainRiserBacking(…, bottomY, strata)` stacks thin per-band boxes
(soil → dirt → clay → rock → bedrock by depth below y=0) when `strata` is true.
`strataWall` is enabled for a cell that is dug OR borders a dug cell, so only pit
walls change; ordinary cliffs stay flat. Bands come from `strataBandsForTerrain`
and reuse existing `M.*` materials — no new textures, no extra render passes.
(The unused instanced-panel `addVoxelTerrainRiser` is strata-aware too, for parity.)

## Two elevation systems

1. **Whole-tile** (`terrainFloors` + `dig`): coarse, the whole slab moves. Driven
   by **`R`/`F`** and the command palette via `sculptCellElevation(x, z, up)`
   (raising fills a pit then stacks floors; lowering drops to base then digs).
2. **Per-tile voxel sculpt** (`voxels`): the **Sculpt tool** edits an N×N sub-grid
   so the surface becomes a blocky voxel *mesh* instead of a flat tower. This is
   what the user means by "should be voxels … per tile."

## Per-tile voxel sculpt (`voxels`)

- Field: `voxels = { n, h:[n*n] }` — `n` is the sub-grid resolution (the **Voxel
  Resolution** setting: 4/6/8/10, mixed→8 via `sculptResolutionNumeric()`), `h` is
  row-major signed integer height offsets in cubic-voxel steps (`vstep = TILE/n`),
  clamped to ±`MAX_VOX`. `null`/all-zero = flat (`normalizeVoxels` enforces this).
- Render: `addVoxelSculptTop` (parallel to `addVoxelTerrainTop`, called from
  `makeTile` only when `cellSculptData` is non-null, gated on voxel mode). It emits
  per-sub-cell top caps at `rise + h*vstep` plus strata step walls. Walls: the
  taller of two in-tile neighbours draws the wall down to the lower; at a tile edge
  it samples the **adjacent tile's** matching edge sub-cell (`neighborEdgeOffset`)
  so two equally-sculpted tiles meet seamlessly, and reconciles to the base plane
  against a flat/unsculpted neighbour (no see-through). `setCell` re-renders the 4
  neighbours on `voxelsChanged` so those edge walls stay in sync.
- Input: the **Sculpt tool** (id `sculpt`, `K`, Lower/Raise variants) routes to
  `sculptVoxelBrush(tileX, tileZ, localX, localZ, up)`. It maps the cursor
  (`currentHover.localX/localZ`, = hit point − tile centre, ±0.5) to a sub-cell,
  edits a small radius in *global* sub-cell space (spills across tile borders →
  continuous craters), and commits each touched tile. Strokes paint one step per
  sub-cell: `drawKeyForHit` returns a `x,z:vI,J` key and `applyDrawToolToHit`
  applies directly at the live cursor for sculpt (the tile-coord interpolation
  would skip within-tile voxels).
- Object/hover/picking Y still use the tile base (`tileLevelForCell`); per-sub-cell
  surface height is visual only in v1.

## Persistence (single chokepoint each way)

- Write: `serializeCell` (`05-tile-factory.js`) appends `dig` as the last optional
  tuple slot **and** materialises the earlier optional slots when `dig > 0` so the
  positional parser stays stable. A cell with only `dig > 0` is no longer "default".
- Read: the `applyState` parser (`29-persistence-api.js`) reads `dig` from tuple
  index 12 / object `.dig`, clamps it, and threads it through both apply paths and
  `writeWorldIntentCell`. Undo/redo + autosave + export all flow through these two.
- Schema: `dig` is an optional `0..6` integer on the **object** cell form in
  `world.schema.json` AND the embedded copy in `25-animation-loop-schema.js` — keep
  them byte-identical (the `check.js` parity guard compares the parsed JSON).

## Gotchas / follow-ups

- LandscapeEngine mode doesn't render discrete tiles, so `dig` has no visual effect
  there (data is still preserved).
- The pit **floor** currently keeps the cell's own terrain material; making it read
  as exposed earth/stratum is a deliberate v1 follow-up (would need a top-face
  material override in `addVoxelTerrainTop` without disturbing path/water adjacency).
- If you touch the riser call sites, the `check.js` guard expects
  `addVoxelTerrainRiserBacking(g, terrain, riserSize, riserHeight,` — update it
  together with the call, and never switch the wall to thousands of side panels.
