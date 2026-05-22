---
name: tinyworld-render-performance
description: Use when changing Tiny World Builder renderer setup, shadows, smoke, voxel clouds, ghost board render cost, frame loop, or GPU performance.
---

# Tiny World Render Performance

Keep the renderer single-pass and predictable.

Current renderer contract:

- Default render path is single-pass: `renderer.render(scene, camera)` straight to the canvas. The only sanctioned post-process is the optional pixelation pass (low-res render target + depth/normal-edge fullscreen quad) gated behind the `Pixel size` / `Pixel depth edge` / `Pixel normal edge` render settings. When `renderPixelSize <= 1` or XR is presenting, that pass MUST bypass and fall back to direct rendering — do not introduce other always-on post passes (EffectComposer, screen shaders, additional render targets) without explicit approval.
- Cap DPR; do not return to uncapped `devicePixelRatio`.
- Main WebGL context uses `antialias: true`; the old smoothing/post pass has been removed.
- Brightness/saturation/contrast are lightweight CSS filters on the WebGL canvas, not shader uniforms.

GPU caches (introduced for low-end GPU + visible-distance scaling):

- `geomCache` memoizes `roundedSlab` / `roundedBox` ExtrudeGeometries by their numeric args. Geometries are tagged `userData.cached = true` and shared across every mesh that asks for the same shape. Disposal goes through `safeDisposeGeometry(geo)` — never call `geo.dispose()` directly on these. If you add a new geometry helper that's called more than a handful of times, cache it the same way.
- `getOpenBoxGeometry(w, h, d, skipTop, skipBottom, skipPX, skipNX, skipPZ, skipNZ)` returns a cached `BoxGeometry` with selected face groups removed from the index buffer (matIdx 2 = top, matIdx 3 = bottom). Use it for risers, terrain caps, and hidden-face optimizations. Terrain caps should remain clean flat box slabs rather than `roundedSlab` bevels: flat top surfaces plus vertical cap thickness provide depth/substance without the repeated chevron artifacts caused by chamfered per-tile bevels. Grass caps should overhang the dirt body so exposed edges read as green lip over dirt. Open-box geometries are still `userData.cached = true` — never mutate or dispose.
- Voxel terrain panels must stay batched inside each tile: bucket panels by cached open-box geometry and material, then emit one `THREE.InstancedMesh` per bucket. Strip panel bottoms, internal side faces, and neighbour-hidden edge sides with `getOpenBoxGeometry`; do not go back to one `THREE.Mesh` per small terrain panel at 8x8/12x12 resolutions.
- When voxel terrain is enabled, exposed riser/body sides under grass/path/water/etc should also be voxelized with instanced side panels aligned to the terrain voxel resolution. Keep same-or-higher neighbour side culling intact so shared internal sides are not rendered.
- The object/stamp voxel bevel is a persisted render setting (`tinyworld:render:voxelBevel`) applied inside `vbox()` through cached centered voxel box geometry. It is intentionally fine-grained (0.001 steps) so tiny voxels can keep only a slight softened edge. Keep it subtle and global; do not hand-bevel individual stamps unless they need a genuinely different silhouette.
- Voxel terrain top panels need a small width/depth overlap. Exact edge-to-edge panels produce sub-pixel cracks in the pixelated render path, especially on dark soil. Do not add a full top underlay to hide seams: terrain tile fade materials are transparent/depthWrite-off, so broad underlays can sort over the voxel panels and make the surface read flat.
- Terrain leak blockers belong under the dirt/riser body as bottom caps, not beneath the visible top surface. Mark those caps `userData.noShadow = true` and keep `castReceive()` respecting that flag so they block sky/background misses without adding shadow cost or flattening voxel tops.
- `fadeMatCache` shares fade materials in `FADE_BUCKETS = 16` opacity buckets keyed by (base material UUID, grayscale flag, bucket, keepFadeAtOpaque). `prepareFadeable` and `applyElementOpacity` look up via `pickFadeMaterial(baseMat, grayscale, displayOpacity, keepFadeAtOpaque)` instead of cloning per mesh. Terrain tile roots set `keepFadeAtOpaque` so they remain on the transparent/depthWrite-off fade material even at 100%; snapping terrain back to the base opaque material exposes diagonal face artifacts that are absent at 99% opacity. Cached materials are tagged `userData.cachedFade = true` and must never be mutated or disposed — they're shared by every mesh in their bucket. If you need a per-instance opacity (e.g. squash anim), clone the material yourself and tag it so it gets disposed individually.
- Ghost boards are built incrementally via `pendingGhostBoards` queue, drained inside `animate()` by `processGhostBoardQueue(budgetMs)` with a small per-frame budget. `ensureGhostBoardsAroundTarget` only enqueues — it must never build synchronously, or load/reset/visible-distance changes hitch the main thread.
- Per-frame object work is set-based: `animatedCellObjects` tracks swaying
  trees/tufts and `smokeHouseObjects` tracks chimney sources. Do not return to
  scanning every `cellMeshes` entry each frame for these effects.
- Generated/imported world application supports sliced progressive rendering. In sliced mode, `applyState(..., { sliced: true })` sorts terrain and object/detail passes by distance from `opts.renderOrigin` or the current camera `target`, so visible/nearby cells appear before farther cells. Preserve that distance-ranked ordering when changing generation rendering. Demo/stress routes may pass `skipGhostBoards: true` to keep a large home board from also preloading preview boards; in that mode `applyState` should zero the in-memory preview distance, sync the ghost budget, and clear ghost boards without persisting render settings.
- Home grids above the windowing threshold are **intent-full / render-windowed**: `world[][]` may hold the full 512×512 board, but `cellMeshes` must only hold the camera-centred home render window. Keep large-grid bulk load/clear paths on intent writes plus `requestHomeRenderWindowSync()`, not `GRID²` mesh rebuilds. Keep `world[][]` sparse: virtual default grass comes from `getWorldCell()`/`ensureWorldCell()`, not from preallocating `HOME_GRID_MAX²` cells. Any direct `world[x][z]` read on an editing/API path must either guard the row or use `getWorldCell()` so untouched large-grid rows still behave as default terrain.
- Preview/ghost boards are full `GRID²` boards today. Until they are chunked/windowed too, clamp 96+ grids to `ghostRadius = 0` / preview distance 0, and keep 128+ boards preview-disabled. Otherwise a single neighbour at 128+ explodes into tens of thousands of meshes/instances per board. If the cheap ghost terrain instancing path is used, clear its global buckets when ghost boards are cleared/disabled/resized so stale instanced terrain cannot remain in the scene.
- To keep draw calls low on full-detail ghost boards, all terrain tiles and objects are merged by material and fade role (`'tile'` / `'object'`) into single meshes using `mergeGhostTerrainByMaterial(board)`. The merged meshes are centered at the board center to preserve distance-based fading via `opacityAtWorldPosition`. Raycasting resolves click/hover cell coordinates `(gx, gz)` using `resolveRaycastCell(h)` by mapping hit coordinates relative to the board bounds. When a ghost cell is materialized (clicked or edited), `removeGhostCellMesh` triggers `rebuildGhostBoard` to regenerate the merged meshes without the edited cell.
- The final generated/imported settle pass should only rebuild
  adjacency-sensitive terrain (paths, water/shore neighbours, bridges), not the
  entire board.
- Initial/full-scene render paths should render board tiles immediately and
  animate only props/buildings/extras. Do not reintroduce tile drop-in for the
  starter board, saved-state restore, import, or generated-world base pass; the
  terrain is the stage, not part of the entrance animation.
- If grass/water/path show tiny specks, pavers, ripples, or foam before the
  rest of a tile visually settles, inspect `makeTile()` decals and the reveal
  pipeline first: grass flecks, water insets/ripples/foam, and path
  pavers/scuffs are real geometry just above the tile top. During opacity
  reveal they can read as transient artifacts because faded materials use
  transparent/depthWrite-off buckets, and sliced builds may briefly render
  adjacency-sensitive path/water/shore details before the final settle pass.
- Stats overlay (`?stats=1` or backtick key) reads `renderer.info` and reports FPS, draws, tris, geoms, mats, programs, textures, ghost-board count + queue depth. Use it to measure any rendering change.
- Default color grade should stay neutral: brightness 1, saturation 1, contrast 1.
- Render settings are user-adjustable and persisted in `localStorage` under `tinyworld:render:*`.
- Tilt-shift blur stays active while the camera is moving, panning, zooming,
  home-tweening, or first-person walking/look-moving. Keep `markCameraMoving()`
  as a stable no-op hook for those movement paths, but do not hide or pause the
  tilt-shift pseudo-element during interaction unless the user explicitly asks.
- Scene/screen controls must keep working in the direct-render path: resolution, shadow quality, lighting, visible distance, visible size, backdrop glow, clouds, tilt-shift blur/focus, and ghost opacity.
- Preview window is the reveal square around the camera target in tile-width units. It auto-scales by board size and can be user-adjusted, but it must never be smaller than `GRID`. Do not subtract half a tile from this radius, or the board edge starts fading inside the requested size.
- Preview opacity / floors / objects are user-adjustable display multipliers for surrounding preview boards. The home board stays fully opaque regardless of those controls.
- Do not add new post-only shader controls beyond the existing pixelation/antialias controls unless the user explicitly asks for them. Pixelation/AA post-process targets/materials are constructed lazily inside `ensurePixelResources` and resize through `setSize`; do not pre-allocate them at startup, and do not leak the normal-target/override material when `renderPixelNormalEdge` is 0. Depth/normal edge strengths should default to 0: they outline real tile bevels, risers, overhangs, shore/path/water decals, and shadowed side geometry, which can read as terrain artifacts under pixelation. Shader antialias is a colour-only edge-aware smoothing pass; keep it separate from depth/normal outlines.
- Soft perspective has been removed from the app. Keep camera mode choices to top-down, isometric/orthographic, perspective, and first-person; normalize any legacy `cameraMode: "soft"` import/save data to `perspective`.
- Atmosphere fade should use native `scene.fog` (`THREE.Fog`) so distant scenery colour-fades toward the live sky/background inside the direct renderer path. Keep fog color matched to the current time/weather `scene.background`, recompute near/far from camera distance + visible span after camera updates, expose it as a persisted render setting, and disable it when `scene.background === null` for AR passthrough.
- LandscapeEngine realistic terrain in TinyWorld may use built-in vertex-colour Lambert materials so native shadow maps and `scene.fog` work, but **do not replace low-poly LandscapeEngine terrain with Lambert**. Low-poly landscape must keep its custom cel `sandMatLowPoly` shader; otherwise the low-poly render option visually regresses into realistic terrain. Keep near realistic terrain receiving shadows and near rocks/flora casting shadows; far LOD terrain should stay non-shadow-receiving/casting to avoid wasting GPU.
- Shadow maps should stay modest unless a visual defect proves otherwise.
- Keep shadow bias/normalBias/radius tight for voxel-scale geometry. Large `normalBias` or soft radius values make thin roofs, columns, crop stems, fences, and trim detach from their shadows, which reads as light leaking through the model in pixel mode. Do not force `material.shadowSide = THREE.FrontSide` globally: closed box roofs and voxel panels will self-shadow and show diagonal shadow-acne hatching that looks like an unwanted texture.
- Rain/snow should use in-world instanced box particles. Rain impacts use transient instanced ring-ripple splash pools plus heavy-rain/storm circular puddle buildup; snow impacts add persistent low-opacity square surface patches that visually build up. Snow is winter-only: selecting snow switches to winter, and changing to any non-winter season clears snow weather. Keep impact decals lifted above beveled tile tops (`WEATHER_SURFACE_PAD` + decal/ripple lift), but leave depth testing enabled so they cannot render through terrain sides, objects, or underside geometry. Do not reintroduce CSS/screen-space rain/snow overlays or always-on per-tile weather panels. Impacts should only appear on rendered tile surfaces. Weather state should affect every visible element through shared material tinting, including preview boards. Weather intensity is severity: low = light rain/flurries, high = storms/snowstorms with stronger slant, darker ambience, more active instances, global material tint strength, and water/snow buildup. Intensity and splash/buildup controls intentionally overdrive up to 300%; keep emission/opacity visibly obvious at max. Storm is an explicit rain mode that forces storm-strength rain visuals while preserving the same splash/buildup controls. Seed surface marks when weather or splash/intensity changes so puddles/snow are visible immediately, not only after waiting for random impacts. Clamp impact decals inside their tile footprint so rings/puddles/snow patches never overhang visible board edges.
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
- Building windows can switch to `M.windowLit` at dusk/night via per-window deterministic seeds. Keep this set-based (`buildingWindowObjects`) and update on time-of-day changes, not by scanning every cell each frame.
- Ghost boards should participate in the shadow pass — same sun, same shadows everywhere. If Preview/ghost shadows disappear, first check that `prepareFadeable` has not forced ghost meshes to `castShadow = false`, and that any merged/batched ghost terrain explicitly preserves `receiveShadow`/`castShadow` after replacing source meshes. The factory-level `castReceive` / `groundReceiveOnly` choices should apply uniformly unless there is a deliberate, visible-quality-approved LOD exception.
- Voxel cloud visual opacity is independent from Cloud shadow. Do not drive visible cloud materials with `alphaTest`; cloud shadow breakup belongs on each puff's `customDepthMaterial` so lowering the shadow slider never hides the clouds themselves.
- Smoke particles must be capped and must not cast/receive shadows.
- Crop duster planes should remain ambient year-round. Only crop-dusting passes are summer/crop-gated; non-summer or no-crop states should fall back to banner flyovers rather than hiding the plane system.
- Ghost board frustum culling: In `renderScene()`, active ghost boards must be dynamically frustum-culled using the camera view frustum. Apply a safety padding (e.g., `GRID * TILE * 0.5`) to the bounding boxes to prevent mountain shadow pop-out.
- Cheap ghost terrain bounds culling: Set `frustumCulled = true` on the instanced meshes of cheap ghost terrain. Update their geometry bounding boxes and spheres in `updateGhostRenderBubble()` to match the active preload area so they are culled as a single unit when the camera is panned away.
- Landscape chunk frustum culling: Position chunk groups at their world coordinates and place their child terrain mesh and instanced rocks/flora at local coordinates relative to the chunk center. Shared geometries (`rockGeo`, `pineGeo`, etc.) must have pre-calculated local bounding boxes spanning the chunk size so Three.js can correctly transform their bounds and frustum-cull instanced meshes.

Validation:

- Run the inline script syntax check.
- Open `http://localhost:3000/tiny-world-builder`.
- Confirm `renderer.getPixelRatio()` is at or below the cap.
- Confirm there are no `postTarget` / `postMaterial` / `postProcessingEnabled` references in `tiny-world-builder.html`.
- Confirm no console errors after reload.
