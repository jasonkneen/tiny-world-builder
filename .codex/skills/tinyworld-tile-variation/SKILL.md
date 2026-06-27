---
name: tinyworld-tile-variation
description: Use when adding or changing Tiny World Builder tile/object repeat-click behavior, terrain stacking, floors/intensity, fences, rocks, walls, crops, or Monument Valley-like height/detail growth.
---

# Tiny World Tile Variation

Use separate terrain and object layers:

- `terrainFloors`: ground height only.
- `floors`: object/building intensity only.

Expected behavior:

- Re-clicking the same object kind increases `floors` up to `MAX_FLOORS`.
- Terrain tools on empty terrain cells should stack height using `terrainFloors`.
- Raised terrain should lift the tile top and any object on that cell via `terrainRiseAt`.
- Terrain height changes must rebuild the visible tile mesh immediately, even when terrain/kind did not change.
- Object intensity changes must rebuild the object mesh, not the ground mesh.
- Object variations should remain the same `kind` unless a schema change is explicitly requested.
- Same-kind rock neighbours should blend by neighbour strength, not render as identical stamped cells.
- Terrain surface detail should stay batched/instanced per tile. Add grass blades, pavers, scuffs, pebbles, or flowers through lightweight instanced detail layers, not individual loose meshes per fleck.
- Stone terrain defaults to the masonry/castle-block surface, while rock props default to rock-face. Keep terrain defaults and linked model defaults separate so walkways do not inherit boulder texture treatment and rocks do not inherit walkway brickwork unless the user explicitly changes the linked surface texture.
- Heavy terrain such as path and stone can have a render-only kerb drop through `terrainVisualRiseForCell`; water sits one top-cap height lower via `WATER_SURFACE_DROP = TOP_H` while its rim/shore strips stay at the tile edge, and dirt can sit slightly raised through the same `terrainSurfaceOffset` path. Do not store these visual offsets in `terrainFloors` or saved world data.
- Heavy terrain kerb strips must render only on exposed paved edges. Use `sameTerrainEdgeFamily` for path/stone joins so continuous paths, roads, and plazas do not get brick strips across the travelled surface.
- Castle/tower/default stone wall textures should read as tight masonry
  courses. Avoid giant square procedural blocks or very low UV repeat scales;
  they read like repeated windows on tall walls.
- Waterfall curtains, surface sheets, falling cubes, and froth should start from the lowered water surface (`topY` after `terrainSurfaceOffset`), not from the tile rim height.
- Sunken water bank/rim strips should be suppressed on spill/waterfall sides; those edges must remain open so the water reads as falling over the edge rather than blocked by bricks.

Fence levels:

- `1`: normal wood fence.
- `2`: taller wood fence.
- `3`: wire fence.
- `4`: stone/rock wall.
- `5+`: steel wall.

Implementation guardrails:

- Do not add new saved fields unless necessary; prefer `floors`. Per-cell visual-only overrides may use `appearance` when the user explicitly needs immediate editable colours (e.g. tower `bodyColor` / `topColor`).
- If adding a new visual variation, route it through the factory for the existing `kind`.
- Rock and hill variants need visible contact skirts/talus at tile level so stacked or connected geometry reads grounded.
- Connected fence/wall rails should overlap tile boundaries slightly; never leave visible gaps in a run.
- Treat fences as square-edge overlays. New authored/generated fences live in
  `cell.extras` as `{ kind: 'fence', fenceSide: 'n|e|s|w' }`, so a square can
  have 0-4 fenced sides while keeping its terrain/object identity. Legacy
  primary `kind: 'fence'` cells may still render, but do not make them the new
  authoring path.
- Generated/random-island resource enclosures should fence the owning resource
  cells' boundary edges: crop plots use garden-style level-1 fence extras,
  animal pens use taller wood level-2 fence extras, and a gate is a visibly
  open two-leaf `appearance.fenceStyle: 'gate'` edge with taller posts and a
  red marker, facing a path. The gate hinge line belongs on the fenced cell
  border; only the open leaves swing inward. Crop and animal components stay
  separate; shared crop/animal boundaries should be fenced, not treated as
  gates. Do not let
  ordinary farm enclosures automatically score as a `Defensive Ring`; that trait
  belongs to edge, stone/high-ground, watchtower, or spotlight security context.
  Do not emit empty/random fence-only cells as field scatter or generic defense;
  fence extras should belong to the enclosed crop/animal cell unless the user is
  manually authoring a fence.
- Generated corner towers use the existing cell transform path for door
  direction. The stone/voxel tower door is local `+z`; random-island towers
  should set `transform.rotationY` so that face points inward toward the island
  center/core rather than adding a separate saved door-side field.
- Do not let `addEnhancementBits` double-scale a kind that now handles its own levels internally.
- Do not use object `floors` to raise ground. Old saves may overload `floors`; migrate object cells to `terrainFloors: 1`.

Validation:

- Same-kind manual placement should visibly change detail/height.
- Repeated terrain placement on an empty cell should raise the tile.
- Repeated object placement should keep `terrainFloors` unchanged and alter only the object.
- Objects should sit on raised terrain when rendered.
- Selection-panel property chips should apply immediate local changes through `setCell` when the renderer supports the property; do not fake direct controls by only writing prompts.
- Houses placed on `path` or `water` must preserve that terrain and render on an underpass/stilt base; do not coerce those tiles back to grass.
- Same-terrain repeat placement should be visible before refresh/reload.
- House clusters only merge plain `kind: 'house'` cells with no `buildingType`.
  Forced variants such as `manor`, `tower`, `turret`, and `skyscraper` are
  visual cluster boundaries; do not let linear/composite/square cluster
  detection traverse through them, or the merged house mesh can overlap the
  separate forced-variant mesh.

## Terrain Styling Options (Low-poly vs Voxel)

The board can render terrain in two main visual styling modes:
- **Low-poly flat panels**: When `renderVoxelTerrain` is `false`, the ground renders as smooth flat-shaded panels.
- **Voxel columns**: When `renderVoxelTerrain` is `true`, the terrain is subdivided and rendered as voxel columns based on the resolution in `renderTerrainVoxelResolution` (e.g., `'4'`, `'6'`, `'8'`, `'12'`, or `'mixed'`).

The Generate Modal includes a "Terrain style" selector that maps these options to global rendering variables and persists them before generating the world, allowing the user to easily switch and view the generated world in their preferred style.

## LandscapeEngine Mesh Mode & Chunky Toggle

When `useLandscapeEngine` is true (the world data is generated from or compatible with the LandscapeEngine seed), the engine can render in two visual modes, toggleable via the "Continuous landscape mesh" setting:
1. **Continuous Mesh (`landscapeMeshMode = true`)**: The normal tile grid is hidden, and the high-fidelity continuous terrain mesh is rendered. Ray picking, objects, vehicles, and crowd sprites sit on the mesh using `landscapeHeightAtCell(globalX, globalZ)`.
2. **Chunky/Voxel Tiles (`landscapeMeshMode = false`)**: The terrain is rendered as standard discrete tiles (low-poly panels or voxel columns). To match the continuous mesh, vertical heights are scaled up: `terrainRiseForLevel(level)` returns `(level - 1) * 1.12` units per floor (matching the mesa levels of the LandscapeEngine) instead of the standard `0.20`. Object placement is not flattened (flattening guards are skipped when `useLandscapeEngine` is true), allowing all trees, houses, fences, and roads to render at their correct three-dimensional canyon elevations.


## Castle/turret auto-promotion (disabled)

Fences and houses must **not** change automatically based on neighbours.
`CASTLE_AUTO_PROMOTION = false` in `16-drop-anim-adjacency.js` gates
`isTurretHouse()` and `isCastleFence()` (both early-return `false`), so:

- A plain house never auto-becomes a turret at a fence corner.
- A fence never auto-becomes a connected castle-wall segment when a
  turret-house is nearby; it always renders via `makeFence(side, level)`.

Unaffected: the explicit **Castle** house variant (`buildingType: 'turret'`
-> `makeTurret`) and fence **levels** (1-2 wood, 3 wire, 4 stone wall,
5+ steel boundary) which come from `makeFence`, not the castle path. To
re-enable the old auto-castle behaviour, flip the flag to `true`.
