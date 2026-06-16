---
name: tinyworld-tinyverse-race-track
description: Use when changing the Tinyverse ground-surface race track, perimeter bridge loop, rally karts, or poser-surface show/hide hook.
---

# Tinyverse Race Track

The race track lives in `engine/world/61-tinyverse-race-track.js`.

Rules:

- Keep the system isolated from avatar files. The track wraps
  `window.__tinyworldPoserSurface.{build,show,hide}` and attaches one root group
  under the poser-surface group.
- Respect sky-island vs ground-surface separation: do not add race-track meshes
  to `worldGroup` directly and do not mutate editable island or home-grid cells.
- The poser surface scales Y three times harder than X/Z. Keep
  `root.scale.y = 1 / 3` and multiply sampled terrain heights by `3` before
  placing track/kart geometry.
- Use existing TinyWorld material families (`M.path`, `M.pathTrim`,
  `M.bridgeWood`, `M.bridgeWoodD`, `M.castleStoneD`) instead of new texture
  assets. Clone them locally when the track needs `fog=false` readability, but
  never mutate shared `M.*` materials.
- Keep static road/bridge pieces in a static subgroup and run
  `mergeStaticBaseMeshesByMaterial(...)` after authoring. Dynamic karts should
  stay in their own subgroup and animate by transform only.
- The HUD should be visible only while the poser surface is visible.
  `PS.hide()` must hide it and clear active race state.
- Keep an obvious user-facing entry point. The `Play rally` launcher should call
  `watch()`, descend to the poser surface, frame the route from the ground
  layer, and start the race after the descent settles. Do not leave the rally as
  a console-only or hidden-key feature.
- Watch mode may set `body.tinyverse-rally-watch` to clear obstructive editor
  panels and use a lightweight follower camera. Keep this state scoped to
  `watch()` and clear it on hide.
- Do not create a local `requestAnimationFrame` loop. The module exposes
  `window.__tinyworldRaceTrack._tick(dt)`, and `25-animation-loop-schema.js`
  calls it from the main loop; `_tick` must stay a fast no-op while hidden.
- Public runtime hook: `window.__tinyworldRaceTrack` exposes `show()`,
  `hide()`, `watch()`, `startRace()`, `stopRace()`, `rebuild()`, `group()`, and
  `routeLength()`.

Validation:

- `node --check engine/world/61-tinyverse-race-track.js`
- `node tools/check.js`
- Visual check: click `Play rally` or call `window.__tinyworldRaceTrack.watch()`
  and confirm the app descends to the ground islands, frames the road loop, shows
  the HUD, and starts moving karts.
