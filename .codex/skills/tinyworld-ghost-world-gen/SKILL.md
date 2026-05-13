---
name: tinyworld-ghost-world-gen
description: Use when changing ghost board generation, path / road / river continuity, deterministic regen, edge connections, or anything that runs inside makeGhostWorld in tiny-world-builder.html.
---

# Tiny World Ghost World Generation

`makeGhostWorld(boardX, boardZ)` produces the contents of a single
non-editable ghost board. It must be:

- **Deterministic.** Same `(boardX, boardZ)` always yields the same
  cells. Cached in `ghostBoardCells` keyed by `'bx,bz'`. Panning away
  and back must regenerate identically (we rely on this for the
  sticky-reveal jigsaw — if content shifted between regens the
  reveal cache would lie).
- **Connection-aware.** Paths and rivers must line up across board
  edges. The user should be able to walk a road from one ghost board
  into the next.

## The seeded RNG

`ghostHash(a, b, salt)` is a tiny mulberry-style 32-bit mix used for
all board-level decisions. Per-cell randomness goes through the older
`cellRand(x, z, salt)` but always with **global** coords
`(boardX * GRID + x, boardZ * GRID + z, salt)`, never local coords.
That guarantees a given world cell renders identically regardless of
which board it was sourced from.

## Connection rubric

- **Horizontal path Z is a function of `boardZ` only**
  (`pathZForRow(boardZ)`). Every board on that world row either has
  the path at the same Z or has no path on that row.
- **Vertical path X is a function of `boardX` only**
  (`pathXForCol(boardX)`). Every board in the column shares the same
  vertical-path X.
- Where horizontal and vertical paths coincide inside a board you
  get a crossroads "for free".
- **Rivers** are column-shared via `riverXForCol(boardX)` so they
  flow continuously down a column. A river that would collide with
  a vertical path is nudged one column over.
- **Bridges**: where a river crosses a horizontal path, drop a
  `kind: 'bridge'` tile so the path stays walkable.

Rough density knobs (tweak in the helpers themselves):

- ~30 % of world rows have no horizontal path
  (`(h % 100) < 30 → -1`).
- ~35 % of world cols have no vertical path.
- ~88 % of world cols have no river (so ~12 % do).

## Cross-board neighbours

The visual tile renderer needs to know what's on the *other side* of a
board edge — otherwise a path that exits east terminates with a stub
end-piece. The neighbour helpers handle this:

- `ghostCellAt(boardX, boardZ, x, z)` resolves any local coord. If
  `x` / `z` are out of `[0, GRID)` it walks into the adjacent board and
  pulls from its `makeGhostWorld(...)` result. If the wrap lands on
  board `(0, 0)` it reads from the home `world[][]` instead so user
  edits on the home board's edges feed the ghost adjacency too.
- `getGhostNeighbors(cells, x, z, prop, value, boardX, boardZ)` and
  `getGhostTerrainNeighbors(cells, x, z, boardX, boardZ)` use
  `ghostCellAt` so an edge tile sees the real neighbour, not `null`.

Always pass `boardX, boardZ` when calling these from inside
`buildGhostBoard`.

## Cells layout

The cell schema must match the home board so `setCell` /
`renderCellObject` work on ghost cells too. Always include the full
shape:

```
{ terrain, kind, floors, buildingType, fenceSide, extras }
```

Omitting fields (especially `extras: []`) caused subtle bugs in the
old generator when ghost data flowed through helpers that assumed the
full shape.

## Blank ghost boards

The Generate dialog can disable outside auto-fill. That path sets
`ghostBoardsBlank = true`, clears existing ghost boards, and lets
`makeGhostWorld(...)` return deterministic blank grass cells for every
off-home board. Keep this as an early return inside `makeGhostWorld` so
panning remains cheap and no generated scenery appears outside the
current generated board.

## Don't

- Don't make paths or rivers depend on both `boardX` and `boardZ` —
  that breaks edge continuity.
- Don't seed decoration with local coords. A tree at local (3,4) of
  board (1,2) must be identical to that same world cell reached from
  any other angle.
- Don't mutate `ghostBoardCells` from anywhere except
  `makeGhostWorld`. The reveal system relies on stable references.

## User overrides (exceptions)

Anything the user builds / erases on a ghost board is an *override* and
must survive map regeneration:

- The override lives in `world[gx][gz]` at **global** coords. There is
  no separate override map — `world[][]` is the single source of truth
  for user-built cells whether they sit on the home board or far out
  in ghost territory.
- `applyToolToCell` copies the generated ghost cell into
  `world[gx][gz]`, calls `removeGhostCellMesh(boardX, boardZ, lx, lz)`
  to strip the ghost board's mesh for that cell, then runs `applyTool`
  which calls `setCell` to render the home cellMesh at the global
  coord. The home cellMesh and the ghost board never both render at
  the same world position.
- `ghostCellAt(boardX, boardZ, x, z)` prefers `world[gx][gz]` over
  `makeGhostWorld(boardX, boardZ)[x][z]`. That keeps cross-board
  adjacency (paths joining, rivers continuing) correct even when the
  user has edited the joining tile.
- `buildGhostBoard` skips any local cell whose global coord exists in
  `world[][]` — those are owned by `setCell` / `cellMeshes`.

## Persistence

- `saveState` walks `Object.keys(world)` so every populated cell — home
  *and* far-flung overrides — is serialised, regardless of how far the
  user has panned.
- `applyState` restores both home cells (via the staggered drop-in
  loop) and out-of-home overrides (via a second `setCell` pass with
  `animate: false, forceTile: true`). The ghost boards regenerate
  deterministically around them and `ghostCellAt` + `buildGhostBoard`
  ensure overrides paint on top.

The contract: if a user can place / erase it, the world reloads with
that exact change re-applied, anywhere on the map, and the rest of the
ghost world regenerates around it.

## Validation

- Pan east across several boards — horizontal paths should run as a
  continuous strip; vertical paths and rivers should cross perfectly
  perpendicular.
- Pan a known board out of the preload radius then back — the same
  trees / houses / crops / rivers reappear in the same cells.
- A river crossing a horizontal path renders a bridge, not water.
- The home board (0, 0) is not affected — its content is the user's,
  not the generator's, and paths that line up with the generated row
  /col are coincidental.
