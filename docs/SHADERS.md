# Shaders & GPU FX

Tiny World Builder is stylized low-poly, so its shaders favour cheap,
fully-procedural effects (hash-noise / fbm) over physically-based realism. The
enhanced water reflection pass is the explicit exception: it uses one shared
planar render target so water can sample the real scene instead of a fake
highlight. The techniques are lifted and adapted
from [lettier/3d-game-shaders-for-beginners](https://github.com/lettier/3d-game-shaders-for-beginners)
(lighting, fog, normal mapping, posterization, dithering, outlining) and tuned to
sit next to the cel-shaded terrain.

## Map of shader systems

| System | File | Notes |
| --- | --- | --- |
| Terrain (sand / cel low-poly) | `engine/landscape/shaders.js` | `SAND_FS`, `LOWPOLY_FS`; ripple normals, sparkle, rim, hemi, fog/haze |
| Ocean water plane | `engine/landscape/water.js` | planar scene reflection, refractive bend, flowing ripples, foam, fresnel, Blinn-Phong glint, depth tint |
| Voxel-world waterfalls / water flow | `engine/world/05-tile-factory.js` | curtain + surface shader sheets, batched foam puffs |
| Reusable FX library | `engine/world/45-shader-fx.js` | `window.TinyShaderFX` — water, waterfall, foam, smoke, explosion, wear |
| Island side strata, propeller blur disc, shield | various `engine/world/*` | bespoke ShaderMaterials |

> **Override note:** `engine/landscape/shaders.js` and `water.js` `Object.assign`
> onto `LandscapeEngine.prototype` *after* the class is defined, so they override
> the now-dead inline copies still living in `LandscapeEngine.js`. Edit the split
> files.

## Ocean water (engine/landscape/water.js)

The ocean plane is a single quad shaded entirely in the fragment stage. Recent
upgrades, at roughly the same GPU cost as the old single-layer ripple:

- **Flowing, multi-directional ripples** — two value-noise layers scroll along
  `flowDir` and its perpendicular so the surface never visibly tiles.
- **Procedural surface normal** from finite differences of the combined field,
  feeding both lighting and reflection.
- **Blinn-Phong sun glint** (`specPower`) plus a soft broad sheen.
- **Fresnel sky reflection** mixing `skyBottom`→`skyTop`.
- **Planar scene reflection** from `tw-water-planar-reflection`, sampled through
  `reflectionMatrix`.
- **Refractive bend** using `refract(-viewDir, norm, 0.7502)` to steer local
  colour/caustic variation.
- **Foam** (`foamColor`, `foamAmount`) on animated wave crests and as a shoreline
  ring at the island runway edge.
- **Depth tint** with a hint of subsurface back-glow on the shallow colour.
- **Cel posterization** (`posterize`, default 12 levels) preserving the toy look.
- **Planet-distance tint** kept in parity with the terrain materials.

## Enhanced water surfaces (Settings → Environment → "Enhanced water")

The water you actually see on load is **voxel water tiles** using the `M.water` /
`M.waterDk` Lambert materials — not the LandscapeEngine ocean. Both are now
upgraded by a single Settings toggle (`render-enhanced-water`, default **on**,
persisted as `tinyworld:render:enhancedWater`) that works in **every** environment:

- **Voxel water tiles** (home island, generated worlds, rivers, lakes): the
  enhancement is injected at the one chokepoint every water material flows
  through — `applyFlowingWaterUVs` in `engine/world/04-textures.js`. It keeps the
  material a `MeshLambertMaterial` (so colour shades, flow direction, and the
  wear slider keep working) and, via `onBeforeCompile`, projects each water
  vertex into the shared planar reflection texture, then layers refractive bend,
  ripple-normal sheen, sharp Blinn-Phong sun glints, and crest foam — masked to
  upward-facing faces so the tile sides stay calm. The refractive map sample uses
  the same world-flow UV assigned to `vMapUv`, not raw mesh `vUv`. A shared
  `uWaterTime` uniform (advanced in `tickWaterTextureFlow`) drives the motion, and
  a `customProgramCacheKey` makes the toggle recompile cleanly at runtime.
- **LandscapeEngine ocean** (`engine/landscape/water.js`): the same toggle drives a
  `uEnhance` uniform that scales the foam / sheen / subsurface terms, so turning it
  off falls back toward the simpler original look.

Toggling rebuilds water materials (`refreshWaterShaderMaterials()` clears the flow
cache, then `rebuildTerrainRender()`), so it applies immediately. Waterfalls keep
their own dedicated shaders and are unaffected by this surface toggle.

## TinyShaderFX library (engine/world/45-shader-fx.js)

A small, dependency-free library exposed on `window.TinyShaderFX`. Every animated
material exposes a `uTime` uniform and self-registers with the frame ticker that
the animation loop calls, so you never wire a per-material clock.

```js
// Flowing river on a flat plane
const river = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 6).rotateX(-Math.PI / 2),
  TinyShaderFX.makeWaterFlowMaterial({ flow: new THREE.Vector2(1, 0.2), speed: 0.8 })
);
scene.add(river);

// Waterfall curtain on a vertical plane
const fall = new THREE.Mesh(
  new THREE.PlaneGeometry(4, 8),
  TinyShaderFX.makeWaterfallMaterial({ lanes: 11 })
);

// A worn, weathered crate — patches a stock Lambert material
const crate = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2),
  TinyShaderFX.applyWear(new THREE.MeshLambertMaterial({ color: 0xb8b0a0 }), { amount: 0.7 })
);
crate.material.setWear(0.9); // crank the damage later

// One-shot explosion: drive uProgress 0→1 yourself and scale the mesh up
const boom = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 16), TinyShaderFX.makeExplosionMaterial());
// in your update loop: boom.material.uniforms.uProgress.value = p; boom.scale.setScalar(0.4 + p * 1.6);
```

### Factories

| Factory | Purpose | Drive |
| --- | --- | --- |
| `makeWaterFlowMaterial(opts)` | flowing river/pond surface | auto (`uTime`) |
| `makeWaterfallMaterial(opts)` | vertical falling-water curtain | auto |
| `makeFoamMaterial(opts)` | shoreline / splash / wake foam ribbon | auto |
| `makeSmokeMaterial(opts)` | dissolving smoke billboard | `uAge` 0→1 |
| `makeExplosionMaterial(opts)` | expanding fireball → smoke | `uProgress` 0→1 + mesh scale |
| `applyWear(material, opts)` | procedural grime/cracks/scuffs on a stock material | `setWear(amount)` |

`TinyShaderFX.GLSL_NOISE` is a prependable GLSL chunk
(`fxHash/fxNoise/fxFbm/fxFresnel/fxPosterize`) for building your own materials.

### Showcase

Append `?shaderfx=demo` (or `?shaderfx=1`) to the URL to drop a gallery of the
effects near the origin, or call `TinyShaderFX.demo()` from the console. It's
opt-in, so default worlds are untouched.

## Performance principles

- Procedural only — no texture loads, no extra passes, no render targets. The
  single-pass `renderer.render(scene, camera)` contract is preserved (see
  `tinyworld-render-performance`).
- Value-noise taps are kept to a handful per fragment; the ocean upgrade is
  roughly cost-neutral versus the shader it replaced.
- Animated materials share one frame tick; disposed materials are pruned from the
  tracker automatically.
- Reuse `GLSL_NOISE` and batch with `InstancedMesh` rather than spawning many
  unique ShaderMaterials.
