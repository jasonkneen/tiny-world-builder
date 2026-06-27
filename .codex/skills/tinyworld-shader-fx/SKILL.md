---
name: tinyworld-shader-fx
description: Use when adding or changing GLSL effects in Tiny World Builder — landscape water, waterfalls, foam, smoke, explosions, damage/wear overlays, or the reusable TinyShaderFX library. Covers where shaders live, the override relationship between LandscapeEngine.js and engine/landscape/*.js, and the procedural-noise toolkit.
---

# Tiny World Shader FX

Where the shaders live and how to extend them without breaking the guarded build.

## Authoritative shader files

- **Terrain:** `engine/landscape/shaders.js` — `SAND_VS`, `SAND_FS`, `LOWPOLY_FS`
  + the `sandMat` / `sandMatLowPoly` ShaderMaterials.
- **Water:** `engine/landscape/water.js` — the animated reflective ocean plane.
- These two files `Object.assign(LandscapeEngine.prototype, {...})` **after**
  `LandscapeEngine.js` defines the class, so they **override** the inline
  `_initSharedShaders` / `_initWater` copies still present in `LandscapeEngine.js`
  (lines ~302 / ~893). The split files are the live ones — edit those. The inline
  copies are dead but left in place; don't rely on them.
- The ocean `time` + `cameraPos` uniforms are advanced in `LandscapeEngine.update()`.
- **Voxel-world waterfalls/flow** are separate: `engine/world/05-tile-factory.js`
  (`getWaterfallCurtainMaterial`, `getWaterfallSurfaceMaterial`, foam puffs) driven
  by `updateWaterfallEffects(t)` / `tickWaterTextureFlow(dt)` in the animation loop.
  `check.js` guards these names — keep them.

## Ocean water shader (engine/landscape/water.js)

Stylized, cheap (~9 value-noise taps). Uniforms worth knowing:

- `flowDir` (vec2) — scroll direction; two layers flow along it and its perpendicular.
- `foamColor` / `foamAmount` — wave-crest + shoreline foam.
- `specPower` — Blinn-Phong sun-glint tightness.
- `posterize` — cel banding levels (12 reproduces the original look; 0 disables).
- `planetDistance*` — distance tint, kept in parity with the terrain materials.

Enhanced ocean water samples the shared planar reflection target from `01-render-core.js`
(`tw-water-planar-reflection`) via `reflectionMatrix`, then layers a localized refractive
bend: `refract(-viewDir, norm, 0.7502)`. Keep the `runwayR` discard, the clip-box block,
fog, and posterize tail intact.

## Enhanced water surfaces ("Enhanced water" toggle)

The default-visible water is **voxel tiles** (`M.water`/`M.waterDk`, Lambert), not
the landscape ocean. A Settings toggle upgrades water everywhere:

- Setting: `render-enhanced-water` checkbox (HTML, Environment panel) ↔
  `renderEnhancedWater` global (`01-render-core.js`, default on) ↔
  `tinyworld:render:enhancedWater`. Wired in `21-object-transform-voxel-build.js`
  (el ref, listener loop, `applyFromControls`, `persistSettings`, `syncControls`)
  exactly like the `planesEnabled` toggle. New key, no `RENDER_SETTINGS_VERSION` bump.
- Voxel water: injected in **`applyFlowingWaterUVs`** (`04-textures.js`) — the single
  `onBeforeCompile` chokepoint for every water material (base + flow clones). Stays
  Lambert; projects each water vertex into the shared planar reflection texture, then adds
  refractive bend, ripple-normal sheen, Blinn-Phong glint, and crest foam, masked by
  `vTwWaterNrm.y` so sides stay calm. The refractive sampler must use the derived
  world-flow UV (`vTwWaterSurfaceUv` / the same coordinates assigned to `vMapUv`), not
  raw mesh `vUv`. Shared `waterShaderTimeUniform` advanced in `tickWaterTextureFlow`.
  **`customProgramCacheKey` is mandatory** here — without it three.js would reuse the wrong
  program when the toggle flips (onBeforeCompile output isn't in the default cache key).
  Include the shader-variant string in both the program key and flow-material cache key
  when the injected shader source changes.
- Planar reflection capture: `twWaterReflectionCapture()` in `01-render-core.js` renders
  the scene from a mirrored camera into `tw-water-planar-reflection`, hides reflective
  water meshes during the pass, and clips below-water geometry so underside slabs do not
  pollute the reflection. Water materials opt in with `material.userData.twWaterReflective`.
- Landscape ocean: `uEnhance` uniform in `water.js` scales foam/sheen/subsurface and the
  material samples the same planar reflection uniforms.
- On toggle: `refreshWaterShaderMaterials()` (clears `waterFlowMaterialCache`, resets the
  base materials) then `rebuildTerrainRender()`; the handler also sets the live landscape
  `uEnhance`. Waterfalls are untouched (separate shaders).
- The water albedo texture named `ripples` is intentionally neutral/no-stripe.
  Do not re-add baked horizontal/wavy line decals there; visible motion should
  come from the reflective/refractive shader and shoreline/waterfall edge foam.

## TinyShaderFX library (engine/world/45-shader-fx.js)

IIFE exposing `window.TinyShaderFX`. **4-space body indent on purpose** — the
duplicate-declaration guard in `tools/check.js` only scans 2-space top-level
decls, so anything deeper is ignored. Keep new locals inside the IIFE.

Factories (all procedural, no textures/render targets):

- `makeWaterFlowMaterial(opts)` — flowing river/pond surface for flat planes.
- `makeWaterfallMaterial(opts)` — vertical falling-water curtain (UV.y = top→bottom).
- `makeFoamMaterial(opts)` — shoreline/splash/wake foam ribbon (foam near UV.y=0).
- `makeSmokeMaterial(opts)` — dissolving smoke billboard; drive `uAge` 0→1.
- `makeExplosionMaterial(opts)` — fireball; drive `uProgress` 0→1 and scale the mesh.
- `applyWear(material, opts)` — patches any **stock** Lambert/Standard/Phong/Basic
  material with procedural grime/cracks/scuffs via `onBeforeCompile`
  (anchors on `<project_vertex>` and `<dithering_fragment>`, present in every
  stock template). Returns the material with a `setWear(amount)` helper.

### Frame ticking
Animated materials expose `uTime` and self-register via `track()`. The loop calls
`window.__tinyworldShaderFXTick(t, dt)` (wired in `25-animation-loop-schema.js`,
`tick.effects` bucket). Materials you build elsewhere advance for free if their
uniform is named `uTime` and you pass them through `TinyShaderFX.track()`.

### Shared GLSL
`TinyShaderFX.GLSL_NOISE` is a prependable chunk of `fxHash/fxNoise/fxFbm/
fxFresnel/fxPosterize` (the `fx`-prefix avoids collisions with stock chunks).
Reuse it for new ShaderMaterials instead of re-deriving noise.

### Demo
`?shaderfx=demo` (or `=1`) drops a gallery near the origin; `TinyShaderFX.demo(scene)`
does the same on demand. It's opt-in so default scenes are untouched.

## Guard / gotchas
- New `engine/**` files are auto-collected by `check.js` (per-file `new Function`
  syntax check + cross-file duplicate-decl scan) and copied to `dist/` by
  `publish.sh` — no extra wiring beyond the `<script src>` tag in the HTML.
- ShaderMaterial fragments need `#include <colorspace_fragment>` at the end to match
  the app's r185 output color space (the waterfall + FX materials all do this).
- When patching stock materials that sample `material.map`, write map UVs to r185's
  `vMapUv` (guarded by `#ifdef USE_MAP`), not the old generic `vUv`. `vUv` only
  exists when `USE_UV` is defined; map sampling uses `<map_fragment>` → `vMapUv`.
- Keep fragment shaders compatible with the app's WebGLRenderer path: use
  `gl_FragColor`, constant-bound `for` loops, and `cameraPosition`
  (auto-injected) in ShaderMaterial.
- Don't convert the existing chimney-smoke `MeshBasicMaterial` pipeline to a
  ShaderMaterial — it's cached/cloned by `getCachedParticleMaterial`. Use
  `makeSmokeMaterial` for new emitters instead.
