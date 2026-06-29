---
name: tinyworld-render-performance
description: Use when changing Tiny World Builder renderer setup, shadows, smoke, voxel clouds, ghost board render cost, frame loop, or GPU performance.
---

# Tiny World Render Performance

Keep the renderer single-pass and predictable.

Current renderer contract:

- Default render path is direct except for two explicit render-target systems:
  the optional pixelation pass (low-res render target + depth/normal-edge fullscreen quad)
  and the enhanced-water planar reflection pass. The reflection pass renders the scene once
  from a mirrored camera into `tw-water-planar-reflection`, hides reflective water during
  capture, clips below-water geometry, and is disabled in XR / when enhanced water is off.
  Do not introduce any other always-on post passes (EffectComposer, screen shaders,
  additional render targets) without explicit approval.
- Cap DPR; do not return to uncapped `devicePixelRatio`. Dynamic resolution (`renderDynamicResolution`) is an adaptive multiplier below the user's Resolution slider ceiling: it adjusts effective pixel ratio slowly toward Target FPS and never persists its transient scale.
- Warn on software WebGL renderers (SwiftShader/llvmpipe/softpipe/WARP/etc.) with the dismissible hardware-acceleration banner; many FPS complaints come from browser hardware acceleration being disabled.
- Main WebGL context uses `antialias: true`; the old smoothing/post pass has been removed.
- Brightness/saturation/contrast are lightweight CSS filters on the WebGL canvas, not shader uniforms.

GPU caches (introduced for low-end GPU + visible-distance scaling):

- `geomCache` memoizes `roundedSlab` / `roundedBox` ExtrudeGeometries by their numeric args. Geometries are tagged `userData.cached = true` and shared across every mesh that asks for the same shape. Disposal goes through `safeDisposeGeometry(geo)` — never call `geo.dispose()` directly on these. If you add a new geometry helper that's called more than a handful of times, cache it the same way.
- `getOpenBoxGeometry(w, h, d, skipTop, skipBottom, skipPX, skipNX, skipPZ, skipNZ)` returns a cached `BoxGeometry` with selected face groups removed from the index buffer (matIdx 2 = top, matIdx 3 = bottom). Use it for risers, terrain caps, and hidden-face optimizations. Terrain caps should remain clean flat box slabs rather than `roundedSlab` bevels: flat top surfaces plus vertical cap thickness provide depth/substance without the repeated chevron artifacts caused by chamfered per-tile bevels. Grass caps should overhang the dirt body so exposed edges read as green lip over dirt. Open-box geometries are still `userData.cached = true` — never mutate or dispose.
- `vbox()` accepts `skipTop` / `skipBottom` / side-skip options and routes those pieces through cached open-box geometry. Use these flags for buried voxel faces in authored assemblies, especially floating-island underside slabs and inverted roof layers; do not render closed boxes for the inside of the island mass.
- Voxel terrain panels must stay batched inside each tile: bucket panels by cached open-box geometry and material, then emit one `THREE.InstancedMesh` per bucket. Strip panel bottoms, internal side faces, and neighbour-hidden edge sides with `getOpenBoxGeometry`; do not go back to one `THREE.Mesh` per small terrain panel at 8x8/12x12 resolutions.
- Object-free, level-1 grass tiles use the simple flat-grass fast path even when voxel terrain is enabled. A blank island must not spend hundreds of draw calls on per-cell voxel grass panels/details; reserve voxel terrain detail for edited, raised, non-grass, or occupied cells.
- Simple blank-grass terrain is receive-only for shadows. Do not put empty grass slabs into the shadow-map pass; they receive object shadows but should not double the blank-island draw call count.
- Preview/ghost board rendering is forced off by default: Preview distance/window/opacities persist as zero and the Settings controls are removed. Do not let hidden Preview settings create ghost boards or fade traversal on a blank island.
- When voxel terrain is enabled, keep the top surface voxelized but render exposed riser/body sides as solid shader-textured walls. Avoid thousands of side panels: they create cracks/transparent-looking corners and waste draw/instance budget. Keep same-or-higher neighbour side culling intact so shared internal sides are not rendered.
- Mesh Terrain's real-material path may greedily merge flat same-material top
  rectangles, but keep exposed bevel/chamfer edges and sculpted drops visibly
  chunky. Future side-wall greedy strips should merge only contiguous faces with
  identical material, top height, and bottom height.
- Pixelation shader AA should work in pixel mode, but only through edge/depth/normal detection. Do not use a broad fullscreen blur; it smears terrain texture and UI-like decals. Shader AA must not force the normal prepass by itself; only `Pixel normal edge` should allocate/render the normal target.
- Pixel post shaders are variant-built: the depth sampler uniform exists only
  when depth edge sampling is enabled, and the normal sampler uniform exists
  only when normal edge sampling is enabled. Depth edge sampling uses the
  separate RGBA-packed depth target; do not add unused sampler uniforms to the
  fullscreen material because WebGL warns when no target is bound.
- Pixel post shaders must preserve the renderer output color space. In Three r185 `ShaderMaterial` injects color-space helpers, so include/apply `colorspace_fragment` at the final `gl_FragColor` step; do not use the old `encodings_fragment`/`encodings_pars_fragment` chunks.
- Backdrop/game-screen vignette should remain a cheap CSS overlay variable, not another WebGL post pass. Keep it separate from scene brightness/lighting so it can frame the background without retuning materials.
- Sky/background colour controls are direct scene/CSS settings, not post passes: `Sky blue depth` darkens the shader sphere and CSS backdrop, `Sky blue saturation` pushes the same blue hue harder, and `Undercloud width` rebuilds the small under-island cloud ring. `Cloud height` also controls undercloud depth below the island, slightly farther than the upper cloud distance, so one height adjustment moves both cloud layers. Keep the undercloud layer as a handful of instanced cloud-puff groups attached below the floating island; do not make a full volumetric cloud field or reuse the full multi-mesh shadow-casting sky cloud factory there.
- Night star backgrounds use the single `star-vault-equirect-sphere` mesh and
  a procedural star-only canvas texture, blended only at dusk/night through
  `renderStarVaultStrength`. Keep it as a non-depth-writing sky sphere, not an
  EffectComposer/background pass. Do not load painted sky/land/cloud bitmaps
  into this sphere: equirect wrapping makes horizon imagery smear under/around
  the island. Keep the shader horizon mask so stars fade out below the island.
- Floating-island underside depth should use a small number of cached voxel/box slabs and cached utility cylinders attached to `homeBorderGroup`, not per-cell underside geometry. Treat underside/edge/rocket/utility dressing as decorative scenery: set `castShadow = false` and `receiveShadow = false` after building it so hundreds of tiny underside meshes do not enter the shadow-map pass.
- Floating-island shell sides must stay visible from underside/grazing angles, including secondary editable islands. Keep island underside materials double-sided, keep proxy side shells on double-sided cached material clones, and keep the persistent recessed side-backing ring behind edge greebles on home and duplicate island bases. Let the scene-level island culling hide/show the shell group; do not rely on per-mesh frustum culling for the shell slabs because it can clip side/back faces while the island itself is visible.
- Animated waterfall froth/chunks should stay batched as `THREE.InstancedMesh`
  pools per exposed water edge, not one mesh per puff/drop. Keep the instance
  matrix update inside `updateWaterfallEffects()` and mark the pools
  non-shadowing.
- Terrain/path storytelling details should be batched or rare. Wheel ruts,
  surface flecks, pavers, pebbles, grass-edge roots, and small path signs/crates
  belong in the voxel terrain surface-detail pass with cached geometries,
  `InstancedMesh` buckets where possible, and `noShadow` on decorative extras;
  do not scatter dozens of shadow-casting meshes per tile.
- Waterfall curtain/blade variety should come from the shared shader sheets
  (`getWaterfallCurtainMaterial()` / `getWaterfallSurfaceMaterial()`), so each
  exposed water edge uses one vertical sheet plus one surface-flow sheet instead
  of many blade/tail meshes. If a future pass merges whole rows of waterfalls,
  keep the same shader-sheet contract and aggregate spans above the per-cell
  tile factories.
- Voxel object factories that emit repeated `vbox()` pieces should finish with
  `optimizeVoxelObjectGroup(...)` so matching geometry/material pieces become
  local `THREE.InstancedMesh` buckets. Keep the legacy factory code intact; the
  optimization is a render-layer replacement for repeated live meshes, not a
  removal of the authored object.
- `customParts` sphere/ellipsoid primitives use the shared
  `getCustomPartEllipsoidGeometry(...)` cache and per-mesh scale. Do not create a
  fresh `SphereGeometry` for every generated rounded part; repeated domes,
  balloons, canopies, and tanks should share cached VBOs and be skipped by
  `safeDisposeGeometry`.
- Async texture/resource callbacks must repaint through `renderSceneIfReady()`,
  not direct `renderScene()` calls. These callbacks can fire while classic
  scripts are still loading; `bootApp()` flips `setRenderSceneReady(true)` only
  after scene setup is complete and before the animation loop starts.
- Home and duplicate floating-island bases count as voxel object assemblies too:
  run `optimizeVoxelObjectGroup(...)` after underside/engine/edge dressing is
  authored so repeated clamps, boxes, and small slabs batch before LOD copies
  multiply their draw cost.
- After batching a floating-island base, run `mergeStaticBaseMeshesByMaterial(...)`
  for the fixed shell/underside/greeble meshes. Keep animated plumes, propellers,
  weather, waterfalls, and selectable editable-island engines out of that merge.
- Distant mini-world dressing is background scenery: merge it by material after
  build and keep it non-shadowing/non-pickable. It must not add hundreds of
  shadow-casting meshes to a blank board.
- Contiguous same-style voxel fence rows should render as span meshes through
  `findFenceRenderSpan()` / `makeVoxelFenceSpan()` while keeping per-cell
  `world` intent and tile picking unchanged. Refresh the full connected fence
  component after edits so old anchors/non-anchors do not linger.
- Fence edge posts belong on the true tile edge/corner coordinates (`±0.50`),
  not inset inside the cell. This lets perpendicular sides and neighboring
  cells visually share one corner post while preserving the same adjacency
  intent.
- Waterfall froth/foam should drift slowly. Keep `WATERFALL_FROTH_SPEED`
  conservative (currently `0.30`) so the white puff layer reads as moving foam,
  not flashing particles.
- Enhanced-water planar reflection should capture only when enhanced water is
  on, visible reflective water exists, and the viewer is not in a synchronous
  load. The mirror plane comes from the nearest rendered/known water tile to the
  camera target; `Y=0` is only a last-resort fallback when no water plane can be
  found.
- The object/stamp voxel bevel is a persisted render setting (`tinyworld:render:voxelBevel`) applied inside `vbox()` through cached centered voxel box geometry. It is intentionally fine-grained (0.001 steps) so tiny voxels can keep only a slight softened edge. Keep it subtle and global; do not hand-bevel individual stamps unless they need a genuinely different silhouette.
- Terrain tile geometry must stay inside the logical cell footprint. Do not use
  x/z overhangs on tile tops, risers, voxel top panels, riser panels, or cheap
  ghost terrain; every terrain tile should share the same `TILE` bounds in x/z.
  If cracks appear, solve them with material/shader treatment or camera/post
  tuning, not by overlapping neighbouring terrain vertices or faces.
- Terrain leak blockers belong under the dirt/riser body as bottom caps, not beneath the visible top surface. Mark those caps `userData.noShadow = true` and keep `castReceive()` respecting that flag so they block sky/background misses without adding shadow cost or flattening voxel tops.
- Terrain/island side and riser meshes must not receive projected shadows. Tag side-only risers/kerbs/rims with `userData.noReceiveShadow = true` and keep `groundReceiveOnly()` respecting it; otherwise sun shadows from top content draw large diagonal bands on vertical side materials that appear to rotate while orbiting the camera.
- Far zoom/VOD also disables terrain shadow receivers via `updateTerrainShadowReceiversForCamera()` so cap/top meshes that necessarily combine top + vertical side faces cannot show distant diagonal shadow bands. Preserve the near/far cutoff as a zoom-aware terrain-only shadow LOD; object shadows can read close-up, but distant terrain sides should stay clean.
- `fadeMatCache` shares fade materials in `FADE_BUCKETS = 16` opacity buckets keyed by (base material UUID, grayscale flag, bucket, keepFadeAtOpaque). `prepareFadeable` and `applyElementOpacity` look up via `pickFadeMaterial(baseMat, grayscale, displayOpacity, keepFadeAtOpaque)` instead of cloning per mesh. Home/active terrain must switch back to opaque depth-writing base materials at 100% opacity so island side shells cannot sort through the top at grazing angles; reserve `keepFadeAtOpaque` for preview/ghost terrain that still relies on fade blending. Cached materials are tagged `userData.cachedFade = true` and must never be mutated or disposed — they're shared by every mesh in their bucket. If you need a per-instance opacity (e.g. squash anim), clone the material yourself and tag it so it gets disposed individually.
- Ghost boards are built incrementally via `pendingGhostBoards` queue, drained inside `animate()` by `processGhostBoardQueue(budgetMs)` with a small per-frame budget. `ensureGhostBoardsAroundTarget` only enqueues — it must never build synchronously, or load/reset/visible-distance changes hitch the main thread.
- Per-frame object work is set-based: `animatedCellObjects` tracks swaying
  trees/tufts/crops and `smokeHouseObjects` tracks chimney sources. Do not
  return to scanning every `cellMeshes` entry each frame for these effects.
- Pixel-drag panning must not call `ensureGhostBoardsAroundTarget()` directly
  on every pointer event. Route panning through `maybeEnsureGhostBoardsAroundTarget()`
  so preview-board enqueue/fade work only runs after a meaningful target move
  or a board-coordinate change; settings/reset/import paths may still force an
  immediate ensure when they deliberately change preview state.
- Ghost detail reevaluation is dormant by default because Preview boards are
  currently full-fidelity only. Keep `ghostDetailReevaluationActive` false unless
  a non-full-detail board exists; otherwise the animation loop should not scan
  every ghost board several times per second just to confirm `'full' === 'full'`.
- `applyElementOpacity()` caches the last display opacity applied to each root.
  Preserve that no-op guard so repeated fade/bubble updates do not traverse an
  unchanged tile/object subtree or redo fade-material bucket checks.
- Per-object appearance texture overrides are relative multipliers on top of
  the base material's `userData.worldTextureScale`, not absolute world scales.
  Keep `customTextureMaterial()` multiplying by the base material scale so roof
  shingles/slate and brick courses do not balloon when selected through the
  inspector/appearance path.
- `applyWorldUVs()` patches Lambert materials through `onBeforeCompile`, so it
  must also assign a matching `customProgramCacheKey()` (scale + seam/edge
  options). Any clone/fade/shaded/shell material that copies a world-UV
  `onBeforeCompile` hook must copy `customProgramCacheKey` too; otherwise Three
  Three may reuse a stock/local-UV program and side textures appear to rotate
  when the camera orbits.
- Generated/imported world application supports sliced progressive rendering. In sliced mode, `applyState(..., { sliced: true })` sorts terrain and object/detail passes by distance from `opts.renderOrigin` or the current camera `target`, so visible/nearby cells appear before farther cells. Preserve that distance-ranked ordering when changing generation rendering. Demo/stress routes may pass `skipGhostBoards: true` to keep a large home board from also preloading preview boards; in that mode `applyState` should zero the in-memory preview distance, sync the ghost budget, and clear ghost boards without persisting render settings.
- Generated random islands request a one-shot terrain bake through
  `window.__tinyworldRequestTerrainBake()` after the sliced apply pass finishes.
  This keeps merged terrain a render optimization: picking resolves baked cells
  from hit coordinates, and terrain edits unbake back to live per-cell tiles.
- Stamps panel card thumbnails share the toolbar thumbnail renderer/cache but should not synchronously build every 3D thumbnail during open/search/category renders. Keep fallback thumbs immediate, cancel stale card-thumb queues on panel re-render, and drain expensive card thumbs in small `requestAnimationFrame` batches.
- Home grids above the windowing threshold are **intent-full / render-windowed**: `world[][]` may hold the full 512×512 board, but `cellMeshes` must only hold the camera-centred home render window. Keep large-grid bulk load/clear paths on intent writes plus `requestHomeRenderWindowSync()`, not `GRID²` mesh rebuilds. Keep `world[][]` sparse: virtual default grass comes from `getWorldCell()`/`ensureWorldCell()`, not from preallocating `HOME_GRID_MAX²` cells. Any direct `world[x][z]` read on an editing/API path must either guard the row or use `getWorldCell()` so untouched large-grid rows still behave as default terrain.
- Duplicate editable islands follow the same sparse-intent rule: a new island gets one pickable default grass surface and only edited cells get materialized through `setCell()`. Do not restore per-island `GRID²` grass seeding; 50 islands must stay mostly proxies/sparse cells until edited.
- Use `?demo=island-stress&islands=50&stats=1` or `window.__runIslandStressDemo(50)` to measure duplicate-island scaling. The stats overlay reports island LOD counts (`full/proxy/hidden`) plus the active full-detail budget and live `cellMeshes`. Keep duplicate editable islands under a capped full-detail LOD budget; the selected island remains full and only the nearest in-budget islands keep full bases/engines/content, while the rest use proxies.
- Preview/ghost boards are full `GRID²` boards today. Until they are chunked/windowed too, clamp 96+ grids to `ghostRadius = 0` / preview distance 0, and keep 128+ boards preview-disabled. Otherwise a single neighbour at 128+ explodes into tens of thousands of meshes/instances per board. Do not degrade visible Preview objects into cheap proxy boxes/cones/pyramids; if full-fidelity preview is too expensive, reduce or disable preview rings instead. If the cheap ghost terrain instancing path is used, clear its global buckets when ghost boards are cleared/disabled/resized so stale instanced terrain cannot remain in the scene.
- To keep draw calls low on full-detail ghost boards, all terrain tiles and objects are merged by material and fade role (`'tile'` / `'object'`) into single meshes using `mergeGhostTerrainByMaterial(board)`. The merged meshes are centered at the board center to preserve distance-based fading via `opacityAtWorldPosition`. Raycasting resolves click/hover cell coordinates `(gx, gz)` using `resolveRaycastCell(h)` by mapping hit coordinates relative to the board bounds. When a ghost cell is materialized (clicked or edited), `removeGhostCellMesh` triggers `rebuildGhostBoard` to regenerate the merged meshes without the edited cell.
- Full-quality ghost tiles are `THREE.Group` roots with many static leaf meshes. `mergeGhostTerrainByMaterial(board)` must traverse those leaf meshes, merge by each leaf's base material, and skip special animated/effect meshes such as waterfall/weather children. Do not regress to only checking direct board children; that leaves the merge path effectively disabled.
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
- Stats overlay (`?stats=1` or backtick key) reads `renderer.info` and reports FPS, draws, tris, geoms, mats, programs, textures, ghost-board count + queue depth. It also shows the repaint profiler when visible: render submit buckets, frame tick buckets, `setCell` refresh/plan/save time, tile/object/extras rebuild time, queue drains, and dispose traversal. Use `?repaint=1` or `window.__tinyworldRepaintProfile.setEnabled(true)` for a focused repaint breakdown, and `window.__tinyworldRepaintProfile.snapshot()` to inspect the current top buckets.
- Camera culling runs immediately before `renderer.render()` in `updateSceneVisibilityForCamera()`. Keep this scene-level pass in addition to mesh `frustumCulled`: it hides off-frustum home/ghost/editable-island roots before the camera and shadow passes. For now, under-island top-content hiding is a hard cutoff: top-side objects/extras stay fully opaque until the camera is far enough below the island that the top side should not render at all. Do not reintroduce partial transparent fade/wipe without visual QA for grazing-angle transparency and side-shell sorting. The stats overlay `culled` row is the quick sanity check that draw/tris totals are responding to what is actually visible.
- Current default color grade is intentionally stylized: resolution 75%,
  brightness 108%, saturation 109%, contrast 116%, lighting 62%, ambient fill
  100%, front fill 34%, side fill 26%, back fill 22%, tilt blur 2.1px, and
  tilt focus 65%.
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
- Atmosphere fade should use native `scene.fog` (`THREE.Fog`) so distant scenery colour-fades inside the direct renderer path. Keep fog near/far recomputed from camera distance + visible span after camera updates, expose it as a persisted render setting, and disable it when `scene.background === null` for AR passthrough. The fog colour should be derived from the live sky/background but blended heavily toward a warm neutral haze, not the raw saturated sky blue, so distant islands do not wash out cyan.
- The Generate modal's landscape **"Realistic" option no longer uses the LandscapeEngine continuous mesh** — it now builds flat-top voxel blocks through the mesh-terrain system (`applyRealisticVoxelLandscape()` in `27-landscape-engine.js` → `window.__tinyworldMeshTerrain.generate(...)`, sampling the same `sampleLandscapeCell()` height/biome). Realistic keeps `landscapeMeshMode = false` (normal tiles + voxel overlay). **Low-poly still uses the LandscapeEngine** continuous mesh (`landscapeMeshMode = true` via `initLandscapeMesh()`), and planet-underlay still uses its realistic Lambert path. See `.codex/skills/tinyworld-mesh-terrain`.
- LandscapeEngine realistic terrain in TinyWorld may use built-in vertex-colour Lambert materials so native shadow maps and `scene.fog` work, but **do not replace low-poly LandscapeEngine terrain with Lambert**. Low-poly landscape must keep its custom cel `sandMatLowPoly` shader; otherwise the low-poly render option visually regresses into realistic terrain. Keep near realistic terrain receiving shadows and near rocks/flora casting shadows; far LOD terrain should stay non-shadow-receiving/casting to avoid wasting GPU. Low-poly LandscapeEngine clip bounds need opaque `landscapeCutCaps` retaining walls at the cutaway edges; don't disable those helper caps unless another solid side-fill replaces them. `LandscapeEngine.update()` should cache its near/far chunk signature and skip wanted-set rebuilds while the camera remains in the same streamed chunk; do not reintroduce per-frame Set/string churn in the steady state. Keep those caps shallow enough to stop around the island underside (`-DIRT_H`), colour them as dark cliff/soil (grassland caps must not use bright top-grass green), and do not fade clipped terrain/water edges to blue fog/glow — the opaque cap is the boundary treatment. For planet-underlay realistic terrain, keep the Lambert path but inject only the small `setPlanetFog()`/`terrainMat.onBeforeCompile` underlay haze uniforms; do not switch the low-poly planet to Lambert or add a global post blur. `setPlanetFog()` must defensively ensure those uniform holders exist before writing `.value`, because restore/query boot can call it before a compiled material has all underlay fields populated.
- When testing a planet/ground surface below floating islands, keep it as a separate lowered LandscapeEngine instance (`planetLandscapeEngine`) instead of flipping `useLandscapeEngine`/`landscapeMeshMode`. That preserves the editable floating board and ghost-board behavior while the underlay streams independently. Treat that underlay as backdrop, not an active play surface: keep enough terrain mesh fidelity and extent for the planet to read as a broad detailed surface (near radius 0, far radius about 2 with larger far chunks, far chunk size around 2600, far res around 24), but remove the expensive active-surface costs: no rock/flora scatter, no water plane by default, no shadow participation, one near/far chunk build per throttled stream tick, and only a couple of cheap transparent atmosphere sheets. If a proof route shows a clipped/partial horizon because the normal animation loop is paused or throttled, use a tiny setTimeout warmup drain that builds one pending chunk at a time and re-renders, rather than priming dozens of chunks synchronously. Patch both `LandscapeEngine.js` and the active `engine/landscape/chunks.js` mixin when changing chunk builders; the mixin overrides `_makeChunk()` at runtime. Planet distance is user-adjustable through the Generate modal / query `planetDrop`; changing it should move the lowered LandscapeEngine group and rescale the between-layer atmosphere sheets, not alter the floating board height. Add the island-to-planet atmosphere as cheap transparent world-space haze sheets between the board and underlay (`planetAtmosphereGroup`), not as a global post blur; depth testing keeps the editable island crisp while softening only the lower landscape behind it. The underlay should read as far below, not as wallpaper behind the island: use the planet distance uniforms (`planetDistanceEffect`, tint colour, desaturation, dimming) on low-poly/realistic/water shaders and tint/fade built-in rock/flora materials instead of adding a full-screen blur or global post pass. Mark non-editable underlay roots with `userData.noPointerPick` and exclude them from `pickTile()` raycast roots; otherwise every mouse move raycasts through all lowered terrain chunks/flora and causes visible app stalls. Do not set `material.needsUpdate = true` on recurring haze colour syncs unless transparency/depth-write mode actually changed.
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
  directional sun + non-shadowing front/side/back directional fill lights.
  Keep sun/shadow strength separate from fill controls so dark object faces
  can be lifted without increasing cast-shadow cost. Keep neutral/default
  lighting conservative now that there is no post pass; time-of-day
  hemisphere scaling should normalize against the day anchor (`0.90`), not
  the raw constructor value, or midday blows out.
- The non-shadowing environment/fill stack is currently lifted by
  `ENVIRONMENT_LIGHT_MULTIPLIER = 2.0` in `02-cameras-lighting.js`; this
  brightens ambient/hemi/fill/model-stamp safety lights without increasing the
  shadow-casting sun.
- Imported GLB/model stamps also have named non-shadowing safety lights:
  `model-stamp-import-ambient-fill` and
  `model-stamp-import-directional-fill`. They are adapted from the
  user-supplied Mugen87 StackOverflow ambient/directional baseline, scaled by
  the render lighting/ambient sliders and time-of-day/weather code, and must
  follow the camera target without casting shadows.
- Accent lighting for the starlit look is limited to non-shadowing local
  `SpotLight`/`PointLight` instances that follow the camera target and fade in
  at dusk/night. Do not enable shadow maps on these lights; the directional sun
  remains the only shadow caster.
- Placeable lamp/spotlight stamps may include capped non-shadowing
  `PointLight`/`SpotLight` sources, but the visible falloff should be cheap:
  shared additive ground decals, wall/halo sprites, and haze meshes tagged
  `userData.lightVisual` so `prepareFadeable()` does not replace their shader
  materials. Keep the spotlight cone/decal source at the fixture and widen/fade
  it forward onto the ground, not back toward the object.
- Building windows can switch to `M.windowLit` at dusk/night via per-window deterministic seeds. Keep this set-based (`buildingWindowObjects`) and update on time-of-day changes, not by scanning every cell each frame. Window spill/wall glow/halo helpers should be tagged `userData.windowLightEffect` and skipped by fade-material traversal so their additive shader materials survive ghost/reveal opacity setup.
- Building light readability depends on the exterior halo and ground spill. Keep
  the window halo bloom broad enough to read from normal editor distance
  (`windowW * 2.2`, `windowH * 2.0` in `createWindowLightEffects()`), and do
  not reintroduce an unmasked wall-surface glow plane that paints light through
  surrounding brickwork.
- The blast shield is the supplied `VoxelShield` class/API port in
  `engine/world/40-shield-system.js`, not a replacement design. Preserve
  `VoxelKit`, `BlastPanel`, `CornerKeystone`, `ShieldRing`, `ShieldDemo`, and
  `window.VoxelShield`. Keep panel/keystone voxel pieces optimized with
  `optimizeVoxelObjectGroup(...)`, and cap actual `PointLight`s while retaining
  emissive rune/glow cubes.
- Ghost boards should participate in the shadow pass — same sun, same shadows everywhere. If Preview/ghost shadows disappear, first check that `prepareFadeable` has not forced ghost meshes to `castShadow = false`, and that any merged/batched ghost terrain explicitly preserves `receiveShadow`/`castShadow` after replacing source meshes. The factory-level `castReceive` / `groundReceiveOnly` choices should apply uniformly unless there is a deliberate, visible-quality-approved LOD exception.
- Voxel cloud visual opacity is independent from Cloud shadow. Do not drive visible cloud materials with `alphaTest`; cloud shadow breakup belongs on each puff's `customDepthMaterial` so lowering the shadow slider never hides the clouds themselves.
- Cloud rim lighting is material/shader tint only: voxel cloud material clones
  use a small warm emissive, while soft cloud shader quads use a `rimStrength`
  uniform. Keep rim lighting separate from `renderCloudShadow` so cloud shadow
  cost/visibility rules do not change.
- Sky clouds should stay above and around the active build plane, not directly
  over rooftops/buildings in overhead editor views. Keep the high visual minimum
  and no-fly/perimeter exclusion in `23-particles-clouds.js` and
  `31-cloud-sea.js` aligned with the Cloud height settings/defaults so clouds
  do not read as textures mapped onto buildings.
- The soft cloud sea is a transparent overdraw hotspot. Keep it as one merged
  billboard mesh, cap the puff count near ~1k rather than returning to the old
  1800-quad veil, and discard near-transparent texels in the shader. When
  `renderCloudStyle === 'soft'`, `updateClouds()` should not animate hidden
  voxel/under-island clouds; `tickCloudSea()` owns soft-cloud motion.
- When Cloud shadow is 0, cloud puffs should set `castShadow = false` so they leave the shadow-map pass entirely. Alpha-testing every cloud out in the depth material still costs draw calls.
- Cloud shadow defaults to 0. Visible clouds may remain, but they must not enter
  the shadow pass unless the user explicitly raises Cloud shadow.
- Smoke particles must be capped and must not cast/receive shadows.
- Per-particle opacity should use the shared quantized particle material cache and skip material assignment when the quantized bucket has not changed. Do not clone or assign particle materials every frame for smoke/dust.
- Ambient underside wear/debris should use a separate capped particle pool with
  cached tiny box geometry and the shared quantized particle material cache, so
  slow falling crumbs do not consume chimney/impact smoke capacity. Make them
  visible by tuning cap/rate/size within that pool before adding another effect
  path. Object landing bursts should also spawn through that same pool at the
  object's x/z instead of creating a second underside particle system.
- Floating-island rocket/engine smoke puffs should reuse the existing capped `smokeParticles` pool and cached particle materials. Impact-triggered puffs from heavy drop-ins should be brief, grey/dark-grey, non-shadowing particles rather than a second smoke system.
- Home-island rocket/jet plumes should be a few yaw-facing shader sheets using
  cached plane geometry and shared materials, not dozens of individual animated
  flame cubes per engine. Rotate the sheet only around the local Y axis so it
  reads from the camera without copying the full camera quaternion or moving the
  thrust off the nozzle. The tick path should update one shared time uniform plus
  light sheet scale/position pulses, while intermittent smoke stays on the capped
  particle pool. Keep the old voxel plume object builder available as an
  inactive legacy helper so those objects can be reused later without
  re-authoring them.
- Duplicate-island lift propellers should switch to one cached circle geometry
  plus one shared dark shader material for the high-RPM blur/strobe disc. Keep
  the physical blade groups visible only during startup/slow spin, keep bulky
  outer caps and old hub-block cubes opt-in rather than default, and avoid
  per-prop material clones or per-frame shader allocation.
- Under-island clouds and rocket plume/smoke effects must render before board/tile transparent fade materials (`UNDER_ISLAND_EFFECT_RENDER_ORDER`) so foreground grass, cliffs, fences, and buildings visually occlude them instead of sorting behind the puffs.
- Crop duster planes are behind the persisted `tinyworld:render:planesEnabled`
  switch and default off during the current performance pass. When off, do not
  load the GLB/textures, tick propellers, update plane banners, or leave crop
  dust particles alive. When on, planes remain ambient year-round: only
  crop-dusting passes are summer/crop-gated; non-summer or no-crop states
  should fall back to banner flyovers rather than hiding the plane system.
- Ghost board frustum culling: In `renderScene()`, active ghost boards must be dynamically frustum-culled using the camera view frustum. Apply a safety padding (e.g., `GRID * TILE * 0.5`) to the bounding boxes to prevent mountain shadow pop-out.
- Cheap ghost terrain bounds culling: Set `frustumCulled = true` on the instanced meshes of cheap ghost terrain. Update their geometry bounding boxes and spheres in `updateGhostRenderBubble()` to match the active preload area so they are culled as a single unit when the camera is panned away.
- Landscape chunk frustum culling: Position chunk groups at their world coordinates and place their child terrain mesh and instanced rocks/flora at local coordinates relative to the chunk center. Shared geometries (`rockGeo`, `pineGeo`, etc.) must have pre-calculated local bounding boxes spanning the chunk size so Three.js can correctly transform their bounds and frustum-cull instanced meshes.

Validation:

- Run the inline script syntax check.
- Open `http://localhost:3000/tiny-world-builder`.
- Confirm `renderer.getPixelRatio()` is at or below the cap.
- Confirm there are no `postTarget` / `postMaterial` / `postProcessingEnabled` references in `tiny-world-builder.html`.
- Confirm no console errors after reload.


## Under-occlusion top-content fade + cloud wipe

When the camera dips below an island surface, top content (cells/objects) fades
out then stops rendering, masked by a sweeping cloud. Tuning lives in
`01-render-core.js`:

- **Fade window**: `renderCullTopContentOpacity` =
  `renderCullSmoothstep(-2.85, 0.55, camera.y - surfaceWorldY)`. Wider window =
  more gradual fade before the cull (opacity ~0 → `setRenderCullVisible(false)`).
  Keep the upper edge just above the surface and the lower edge a few units down.
- **Cloud wipe** (`updateUnderOcclusionCloudWipe`, element
  `#under-occlusion-cloud-wipe`): triggers on a one-shot phase crossing
  (`prevPhase<0.42 && nextPhase>=0.42` down / `>0.58 -> <=0.58` up). Opacity cap
  ~`0.72`, decay `dt * 1.15` (lower = lingers longer, to cover the longer fade).
  The CSS band is ~80vh tall so it covers most of the viewport as it sweeps.
  Verify the time-based envelope with real frame dt — a synthetic instant loop
  can't ramp `underOcclusionWipeActive`.
