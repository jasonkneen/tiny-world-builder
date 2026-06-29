---
name: tinyworld-island-viewer
description: Use when changing the first-class Island Viewer shell, sequential generated-island viewer routing, or viewer-scoped graphics defaults.
---

# TinyWorld Island Viewer

Island Viewer is the first-class generated-island viewing surface:

- Shell: `island-viewer.html`
- Styles: `styles/island-viewer.css`
- Generator: `scripts/island-viewer-sequential-generator.js`
- Renderer adapter: `scripts/island-viewer-engine-runtime.js`
- Controller: `scripts/island-viewer.js`
- Compatibility redirect: `random-island-preview.html`

Rules:

- Keep the active generator viewer-only and sequential. `island-viewer.html`
  should load `scripts/island-viewer-sequential-generator.js`, not the giant
  `scripts/tinyworld-island-core.js` copied random-island bundle.
- Keep the builder-engine renderer stack active for now. Do not load
  `scripts/island-viewer-renderer.js` on `island-viewer.html` while
  `scripts/island-viewer-engine-runtime.js` provides the current look.
- The sequential layer stack is: all grass, first house, corner towers, paths,
  extra houses, fenced crops, fenced animals, rock patch, then water route.
- The viewer sequential generator must emit schema-valid `v:4` world cells,
  use normal `terrain: "path"` cells for public path output, and expose
  `TinyWorldIslandGenerator.generate(...)` and `.profile(...)`.
- Do not emit `water-bridge` or `bridgeAxis` metadata from the active viewer
  generator. Bridges are allowed only through the new local detector: after
  water carving, scan local crossings with path cells on one axis and water
  cells on the perpendicular axis, then turn only the center water cell into a
  normal `kind: "bridge"`.
- Strategic lanterns are native `kind: "lamp-post"` cells placed after bridge
  detection. Keep them on empty grass cells that touch exactly two perpendicular
  path cells, and keep every pair more than 3 Manhattan spaces apart.
- A manor is a rare native `house` with `buildingType: "manor"`, not a promoted
  cottage. Only roll the 25% manor chance after at least three normal houses
  exist, reserve its footprint during generation, and connect a path from the
  cell in front of its door back into the existing path network before plots,
  rocks, water, or lanterns run.
- Trees and bushes are native `kind: "tree"` / `kind: "bush"` decoration placed
  after the functional path/water/bridge/lamp layers. Only use empty grass cells,
  keep trees spaced out, and let bushes fill smaller remaining border/garden
  opportunities without occupying paths.
- The initial fenced crop plot should keep its four dirt plot cells and fence
  gates, but each cell rolls independently: 25% empty, otherwise evenly between
  wheat, corn, carrot, pumpkin, and sunflower.
- After the sparse tree/bush pass, run a final weighted infill loop over normal
  empty buildable cells until none remain. The infill choices should stay within
  native economy objects: crops, ore, sheep/cow, bushes, and trees. Do not fill
  water, paths, fences, structures, or reserved manor footprint cells.
- Water route planning must treat path crossings as single-cell crossings per
  connected path area. Do not let water carve two adjacent path cells or run
  along the path before turning back into normal terrain.
- Keep normal viewer chrome minimal. It is not a build screen: visible controls
  should stay viewer actions such as New Island, Load, and Save.
- Put archetype/grid/seed and graphics controls in the local/developer defaults
  helper, not in the primary viewer toolbar.
- Generated Island Viewer islands are fixed at `8 x 8`.
- Persist viewer defaults only under `tinyworld:island-viewer:*`. Do not write
  viewer graphics into normal builder `tinyworld:render:*` keys.
- Use `npm run stats:island-viewer -- --count 1000` for on-demand sequential
  generator sweeps. The CLI loads the viewer generator directly, validates
  schema/invariants, and writes reports under
  `stats-runs/island-viewer-sequential/`.

Validation:

- `npm test`
- `npm run build`
- `npm run stats:island-viewer -- --count 1000`
- Check `/island-viewer` or `/island-viewer.html`: page loads through the
  builder-engine renderer, generated saves contain no legacy bridge metadata,
  and the shell does not request `scripts/tinyworld-island-core.js` or
  `scripts/island-viewer-renderer.js`.
