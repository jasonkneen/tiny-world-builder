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
- Heavy terrain such as path and stone can have a render-only kerb drop through `terrainVisualRiseForCell`; water can sit lower and dirt can sit slightly raised through the same `terrainSurfaceOffset` path. Do not store these visual offsets in `terrainFloors` or saved world data.

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

## Terrain Styling Options (Low-poly vs Voxel)

The board can render terrain in two main visual styling modes:
- **Low-poly flat panels**: When `renderVoxelTerrain` is `false`, the ground renders as smooth flat-shaded panels.
- **Voxel columns**: When `renderVoxelTerrain` is `true`, the terrain is subdivided and rendered as voxel columns based on the resolution in `renderTerrainVoxelResolution` (e.g., `'4'`, `'6'`, `'8'`, `'12'`, or `'mixed'`).

The Generate Modal includes a "Terrain style" selector that maps these options to global rendering variables and persists them before generating the world, allowing the user to easily switch and view the generated world in their preferred style.

## LandscapeEngine Mesh Mode & Chunky Toggle

When `useLandscapeEngine` is true (the world data is generated from or compatible with the LandscapeEngine seed), the engine can render in two visual modes, toggleable via the "Continuous landscape mesh" setting:
1. **Continuous Mesh (`landscapeMeshMode = true`)**: The normal tile grid is hidden, and the high-fidelity continuous terrain mesh is rendered. Ray picking, objects, vehicles, and crowd sprites sit on the mesh using `landscapeHeightAtCell(globalX, globalZ)`.
2. **Chunky/Voxel Tiles (`landscapeMeshMode = false`)**: The terrain is rendered as standard discrete tiles (low-poly panels or voxel columns). To match the continuous mesh, vertical heights are scaled up: `terrainRiseForLevel(level)` returns `(level - 1) * 1.12` units per floor (matching the mesa levels of the LandscapeEngine) instead of the standard `0.20`. Object placement is not flattened (flattening guards are skipped when `useLandscapeEngine` is true), allowing all trees, houses, fences, and roads to render at their correct three-dimensional canyon elevations.
