# Island Viewer

`island-viewer.html` is the first-class shell for viewing generated TinyWorld
islands. It owns its own Three.js canvas and loads
`scripts/island-viewer-sequential-generator.js`, the builder-engine renderer
stack, `scripts/island-viewer-engine-runtime.js`, and `scripts/island-viewer.js`;
it must not iframe, boot, or depend on `tiny-world-builder.html`.

The normal viewer toolbar is intentionally small: New Island, Load, Save, and a
local-dev Defaults helper. Archetype, grid, seed, and graphics-template controls
live in the Defaults helper because the viewer is not a build screen.

Viewer defaults are stored separately from builder settings:

- `tinyworld:island-viewer:defaults.v1` for archetype/grid/seed defaults.
- `tinyworld:island-viewer:graphics.v1` for renderer defaults.
- `tinyworld:island-viewer:*` only. The viewer must not write normal builder
  keys such as `tinyworld:render:*`, `tinyworld:crowd:*`, or
  `tinyworld:view.camera`.

The standalone generation runtime exposes `TinyWorldIslandGenerator.generate(...)`
and `.profile(...)`. Generated viewer islands are fixed at 8 x 8 and come from
the sequential viewer-only layer stack, not the giant random-island generator
bundle. The public `v:4` output uses normal schema cells, including
`terrain: "path"` for paths.

Generation is intentionally layered: grass base, first house, towers, paths,
extra houses, optional manor, fenced crop plot, fenced animal plot, rock patch,
water route, bridge detection, lanterns, trees/bushes, then weighted infill.
The water route can cross a connected path area through only one path cell, so
it does not carve adjacent path cells in the same crossing.

The active viewer generator may emit normal `kind: "bridge"` cells only from
local crossing detection: path cells on one axis and water cells on the
perpendicular axis. It must not emit `water-bridge` or `bridgeAxis` metadata.
Generated viewer terrain should not emit sand; loaded legacy sand is normalized
to grass by the viewer runtime. Do not persist viewer defaults into
`tinyworld:render:*`, because that would let the viewer interfere with the
normal builder, worlds, or other scenes.

`random-island-preview.html` remains only as a compatibility redirect to
`island-viewer.html`.

## Sequential Generator Evaluation

Run statistical sweeps from the repo root:

```bash
npm run stats:island-viewer -- --count 1000
```

The evaluator loads `scripts/island-viewer-sequential-generator.js` directly,
runs 1,000 deterministic seeds across all viewer archetypes, validates the emitted
`v:4` schema shape and viewer invariants, then writes a timestamped report plus
`stats-runs/island-viewer-sequential/latest.json`.

Useful options:

- `--count 2500` changes the total number of generated islands.
- `--archetype river` evaluates all requested samples against one archetype
  instead of distributing them across all eight.
- `--seed-prefix my-run` changes the deterministic seed family.
- `--out-dir scratch/my-stats` writes reports somewhere else.
- `--strict` exits non-zero if any schema/invariant error is found.
