# Session Status

## Goal

Adapt the UnrealSandboxTerrain destructible/sculptable voxel-terrain mechanic
(https://github.com/bw2012/UnrealSandboxTerrain) to Tiny World Builder's boards
**without breaking anything** — the boards stay grids of tiles, they just gain the
ability to dig/sculpt: carve a tile below the base plane into a pit/trench that
exposes geological strata, or raise it into a mound.

## Approach

- Additive per-cell `dig` field (0..`MAX_DIG`); a cell's signed render elevation is
  `terrainFloors - dig`, routed through the existing single hook `tileLevelForCell`.
- `terrainRiseForLevel` made signed (negative for dug cells); riser bottom
  generalised so a higher neighbour's cliff reaches the pit floor (no gaps) while
  undug grids stay byte-identical (verified numerically vs the old formula).
- Excavated walls render as stacked strata bands (soil→clay→rock→bedrock) reusing
  existing `M.*` materials — no new textures/passes.
- New **Sculpt** tool (K, Lower/Raise variants) + extended **R/F** continuous
  raise/dig + command palette. Full persistence (serialize/parse/undo/redo/schema).

## Completed

- `dig` data model + `MAX_DIG` (`10-world-data.js`), signed elevation +
  `cellDigDepth`/`tileLevelForCell`/strata helpers (`05-tile-factory.js`).
- Generalised riser depth + `strataWall` in `makeTile` (`06`), banded backing slabs.
- Threaded `dig` through `setCell` (`17`), `defaultCell`/`writeWorldIntentCell`
  (`12`), serialize (`05`) + parser/both apply paths (`29`).
- Sculpt tool + glyph + group + posType (`19`), dispatch + `sculptCellElevation` +
  drawable + R/F (`20`), palette hints (`30`).
- Optional `dig` in `world.schema.json` + embedded copy (`25`); updated the
  matching `check.js` riser-backing guard.
- Docs: README controls/tools/data-model, AGENTS.md mental model, new skill
  `.codex/skills/tinyworld-sandbox-terrain`.

## Validation

- `npm test` passes: `check` → ok (incl. schema parity + i18n 213×4), `smoke` →
  smoke ok, unit `# pass 45 # fail 0`.
- `node --check` clean on every changed engine module.
- Numeric invariant check: undug flat/hill/dirt cells produce IDENTICAL
  riserHeight/bottom to the old formula; dug + deep-pit-neighbour walls reach the
  pit floor with no gap.

## Still needs visual QA (no browser in this env)

- Browser-check digging with the Sculpt tool and R/F: pit lowers, neighbour walls
  show soil/clay/rock strata, objects on a dug cell ride down with it.
- Confirm shallow dig (1–2) on a flat grass board shows a clean dirt-rimmed dip and
  deep digs reveal rock/bedrock bands; undug default island looks unchanged.
- Confirm dig round-trips through save/reload, export/import, and undo/redo.
