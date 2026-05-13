---
name: tinyworld-opacity-torch
description: Use when changing ghost boards, multiplayer preview boards, panning, ghost visibility, jigsaw reveal, or any visibility behavior around the active Tiny World board.
---

# Tiny World Visibility — Sticky Preview Reveal

The opacity *torch* is gone. The home board is always fully rendered;
Preview cells reveal one-by-one as the camera pans into them, and stay
revealed forever after that (a breadcrumb trail behind the user).

Mental model:

- Every user has one editable home board (size `GRID`, default 8).
- The home `GRID x GRID` region is **always** at full opacity, full
  color, full scale — never fades, never pops.
- Preview boards surround the home board and preview other users' content.
- Nothing is rendered in grayscale — all tiles use their full color.
- A Preview cell is hidden until it enters the visible square around
  `target.x/z` (`renderVisibleSize` wide). Once revealed, the cell is
  *sticky*: `root.userData.revealed = true` and it stays revealed for
  the rest of the session. Its final display opacity is controlled by the
  user-facing Preview opacity / floors / objects sliders.

Reveal rules:

- `opacityAtWorldPosition(x, z)` returns:
  - `1` inside the home GRID square,
  - `1` inside the visible window around the camera target,
  - `0` otherwise.
- `revealOpacityFor(root)` wraps `opacityAtWorldPosition` and adds
  stickiness. Once it sees a positive opacity for a root it sets
  `userData.revealed = true` and returns `1` from then on. Per-frame
  update loops (`updateGhostRenderBubble`, `updateHomeBoardFade`) call
  this instead of `opacityAtWorldPosition` directly so revealed cells
  don't disappear when the camera moves away.
- `updateHomeBoardFade` short-circuits in-grid cells to opacity `1` —
  they never go through the reveal path.
- `tickOpacityTransitions(dt)` eases each root's `currentOpacity` toward
  `targetOpacity` at rate `dt * 20` for a snappy snap-in.
- During the transition, root scale follows
  `0.6 + 0.4 * currentOpacity`, so revealed tiles grow from 60 % to
  full size in <200 ms. At opacity 1 the scale is exactly 1 — static
  home tiles and previously-revealed cells stay untouched.
- `userData.landing` (drop-in animator) takes priority — skip the scale
  pop while landing.
- `desaturateMaterial()` is now a no-op; all Preview / out-of-bounds tiles
  render in full color.

Interaction rules:

- Left-click edits only the central home board through `pickTile`.
- Preview board meshes must not set `userData.gx/gz` on their tile/object
  roots in a way that lets them be edited.
- Right-drag pans. Space+drag pans. Left-drag orbits.

The home board has a thin dark ground-line border (see
`buildHomeBorder()` in the *home board border* section) so the user can
always see where the editable region ends, regardless of how much of
the Preview world has been revealed around it.

Preview distance/window auto-scale from `GRID` on first load and whenever
board size changes: small boards can preview farther; large boards keep
neighbour preload distance/window tighter for performance. Users can still
override those settings from Settings → World.

Validation:

- The home `GRID x GRID` board never fades and never scale-pops.
- Panning forward should reveal new Preview pieces one cell at a time
  with a tiny scale-up pop.
- Panning back over previously-revealed territory should keep that
  territory at full opacity (no re-fade, no re-pop).
- Out-of-range cells the camera has never seen should be
  `root.visible = false`.
- No tile should appear washed-out / desaturated.
- `pickTile()` over a Preview board should still return `null`.
- Home board outline should remain visible at every grid size
  (8 / 12 / 16 / 20).
