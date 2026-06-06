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

## Follow-up: per-tile VOXEL sculpting (user feedback)

The first pass moved a whole tile as one flat slab. Per user feedback ("should be
voxels — 4×4/6×6/8×8/10×10 per tile … actually it's a mesh") the **Sculpt tool**
now edits a per-tile N×N voxel sub-grid (`voxels = { n, h[] }`) so the surface
becomes a blocky voxel mesh:

- Added `10×10` to the Voxel Resolution setting; sculpt grid follows that setting.
- New `addVoxelSculptTop` renderer (caps + strata step walls, cross-tile seamless,
  flat-neighbour capped). `sculptVoxelBrush` paints a small radius across tile
  borders; per-sub-cell stroke keys. Whole-tile `R/F` (`sculptCellElevation`) kept.
- `voxels` persisted through setCell/serialize/parser/schema; `setCell` re-renders
  neighbours on `voxelsChanged`.

## Still needs visual QA (no browser in this env)

- Sculpt tool (K): click/drag carves a voxel-stepped mesh within a tile (not a flat
  tower); craters/mounds flow across tile borders; Lower/Raise variants both work.
- Strata bands show on the cut walls; deeper cuts reveal rock/bedrock.
- Undug/unsculpted default island is unchanged; voxel resolution 4/6/8/10 all render.
- Sculpt + dig + whole-tile raise round-trip through save/reload, export, undo/redo.
