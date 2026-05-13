---
name: tinyworld-render-performance
description: Use when changing Tiny World Builder renderer setup, shadows, smoke, voxel clouds, ghost board render cost, frame loop, or GPU performance.
---

# Tiny World Render Performance

Keep the renderer single-pass and predictable.

Current renderer contract:

- No post-processing pipeline: no EffectComposer, no render target, no screen shader. Render directly with `renderer.render(scene, camera)`.
- Cap DPR; do not return to uncapped `devicePixelRatio`.
- Main WebGL context uses `antialias: true`; the old smoothing/post pass has been removed.
- Brightness/saturation/contrast are lightweight CSS filters on the WebGL canvas, not shader uniforms.

GPU caches (introduced for low-end GPU + visible-distance scaling):

- `geomCache` memoizes `roundedSlab` / `roundedBox` ExtrudeGeometries by their numeric args. Geometries are tagged `userData.cached = true` and shared across every mesh that asks for the same shape. Disposal goes through `safeDisposeGeometry(geo)` — never call `geo.dispose()` directly on these. If you add a new geometry helper that's called more than a handful of times, cache it the same way.
- `fadeMatCache` shares fade materials in `FADE_BUCKETS = 16` opacity buckets keyed by (base material UUID, grayscale flag, bucket). `prepareFadeable` and `applyElementOpacity` look up via `pickFadeMaterial(baseMat, grayscale, displayOpacity)` instead of cloning per mesh. Cached materials are tagged `userData.cachedFade = true` and must never be mutated or disposed — they're shared by every mesh in their bucket. If you need a per-instance opacity (e.g. squash anim), clone the material yourself and tag it so it gets disposed individually.
- Ghost boards are built incrementally via `pendingGhostBoards` queue, drained inside `animate()` by `processGhostBoardQueue(budgetMs)` with a small per-frame budget. `ensureGhostBoardsAroundTarget` only enqueues — it must never build synchronously, or load/reset/visible-distance changes hitch the main thread.
- Generated/imported world application supports sliced progressive rendering. In sliced mode, `applyState(..., { sliced: true })` sorts terrain and object/detail passes by distance from `opts.renderOrigin` or the current camera `target`, so visible/nearby cells appear before farther cells. Preserve that distance-ranked ordering when changing generation rendering.
- Stats overlay (`?stats=1` or backtick key) reads `renderer.info` and reports FPS, draws, tris, geoms, mats, programs, textures, ghost-board count + queue depth. Use it to measure any rendering change.
- Default color grade should stay neutral: brightness 1, saturation 1, contrast 1.
- Render settings are user-adjustable and persisted in `localStorage` under `tinyworld:render:*`.
- Scene/screen controls must keep working in the direct-render path: resolution, shadow quality, lighting, visible distance, visible size, clouds, tilt-shift blur/focus, and ghost opacity.
- Preview window is the reveal square around the camera target in tile-width units. It auto-scales by board size (large boards get a tighter window for performance) and can be user-adjusted. Do not subtract half a tile from this radius, or the board edge starts fading inside the requested size.
- Preview opacity / floors / objects are user-adjustable display multipliers for surrounding preview boards. The home board stays fully opaque regardless of those controls.
- Do not reintroduce post-only shader controls unless the user explicitly asks for a post pipeline.
- Shadow maps should stay modest unless a visual defect proves otherwise.
- The sun is the only shadow caster. Its angle is fixed in world space
  (`SUN_OFFSET = (7, 12, 5)`) but its position and `sun.target` follow
  the camera `target` via `updateSunFollow()` (called from
  `updateCamera()`). The shadow frustum is `±SHADOW_HALF (20)` in light
  space so shadows stay correct wherever the user pans — never anchor
  the sun at the world origin again.
- Lighting stack: `AmbientLight` (flat fill so shadowed sides never go
  black) + `HemisphereLight` (warm sky/ground gradient) + the
  directional sun. All three are scaled by the lighting slider in
  `applyLightingSettings()`. Keep neutral/default lighting conservative
  now that there is no post pass; time-of-day hemisphere scaling should
  normalize against the day anchor (`0.90`), not the raw constructor value,
  or midday blows out.
- Ghost boards DO participate in the shadow pass — same sun, same shadows everywhere. `prepareFadeable` no longer forces castShadow/receiveShadow off on ghost meshes; the factory-level `castReceive` / `groundReceiveOnly` choices apply uniformly.
- Voxel cloud visual opacity is independent from Cloud shadow. Do not drive visible cloud materials with `alphaTest`; cloud shadow breakup belongs on each puff's `customDepthMaterial` so lowering the shadow slider never hides the clouds themselves.
- Smoke particles must be capped and must not cast/receive shadows.

Validation:

- Run the inline script syntax check.
- Open `http://localhost:3000/tiny-world-builder`.
- Confirm `renderer.getPixelRatio()` is at or below the cap.
- Confirm there are no `postTarget` / `postMaterial` / `postProcessingEnabled` references in `tiny-world-builder.html`.
- Confirm no console errors after reload.
