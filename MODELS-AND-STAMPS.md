# TinyWorld — Models & Stamps Breakdown

A reference for everything placeable that ships with the app: the procedural
**built-in objects** (generated in code) and the external **model stamps**
(GLB assets loaded from `models/`). Covers formats, types, and how objects like
the cottage render in their **two view modes**.

---

## 1. The two view modes

Most built-in objects render through **two completely separate geometry
pipelines**. This is not a camera toggle — it is two different ways of building
the mesh, selected per object.

The per-cell property that controls it is `appearance.objectStyle`, whose schema
enum is exactly:

```json
"objectStyle": { "type": "string", "enum": ["normal", "voxel"] }
```
*(`world.schema.json:511`)*

| Mode | What it is | Builders live in |
|------|-----------|------------------|
| **normal** | Hand-crafted procedural geometry — rounded boxes, extruded pitched roofs, beveled trim. High-poly, smooth, detailed. | `engine/world/07-house-primitives.js`, `engine/world/06-history-object-factories.js` |
| **voxel** | Blocky voxel assembly — shapes built from many small cubes (`vbox`/`vcone`), batched & optimized. Low-poly, Minecraft-style. | `engine/world/09b-voxel-build-factories.js` |

### How the renderer picks a mode

`engine/world/17-tile-renderers.js:210-214`:

```js
const useVoxelRender = forceSubEditVoxelRender ||      // editing this cell's voxels
                       kind === 'voxel-build' ||        // always voxel
                       kind === 'model-stamp' ||        // always voxel path
                       (renderStyle === 'voxel') ||     // cell forced to voxel
                       (renderVoxelTerrain && renderStyle !== 'normal'); // global voxel mode on
```

- Per-object override wins: `objectStyle: 'normal'` always uses normal; `objectStyle: 'voxel'` always uses voxel.
- With no override, the global `renderVoxelTerrain` flag decides (localStorage-backed, `01-render-core.js`).

### Worked example — the cottage in each mode

`house:cottage` is the default house variant (`makeHouse(floors=1)`).

**Normal mode** — `makeHouse()` → `buildHouse()` (`07-house-primitives.js:339`, body from `:220`):
- Walls: `THREE.Mesh(roundedBox(...), M.wallCream)` — smooth rounded silhouette
- Roof: `Parts.pitchedRoof()` — two extruded angled slabs meeting at a ridge
- Door / windows: `Parts.door('gable')`, `Parts.window('gable')` — extruded shapes with trim & cross-mullions
- Chimney: precise box primitive
- Output: a `THREE.Group` of many distinct detailed meshes, shared materials (`M.wallCream`, `M.roofBlue`, `M.woodTrim`)

**Voxel mode** — `makeVoxelLinearHouse(1,'z',floors)` (`09b-voxel-build-factories.js:1704`):
- Walls: `vbox(house, bodyW, wallH, bodyD, ...)` — cuboid voxel body
- Roof: `voxelSteppedRoof()` — stepped pyramid of voxel blocks
- Door / windows: `voxelDoor()`, `voxelWindow()` — rows of small cubes
- Chimney: `voxelChimney()`
- Output: batched voxel meshes merged via `optimizeVoxelObjectGroup()`; sub-parts tagged (`userData.partKey = 'wall' | 'roof' | 'window:0' …`) so they stay individually editable

Tuning levers for voxel mode: `renderVoxelGap`, `renderVoxelBevel` (`01-render-core.js:181-182`).

---

## 2. Built-in procedural objects (stamps)

These ship as code, not files. Type ids come from `world.schema.json` and the
render dispatch in `17-tile-renderers.js`. "Dual" = supports both normal and
voxel modes; "Voxel-only" = always renders voxel regardless of mode.

### Buildings

| Type id | Variants (`house:*`) | Normal builder | Voxel builder | Mode |
|---------|----------------------|----------------|---------------|------|
| `house` | cottage, manor, tower, turret, skyscraper | `makeHouse`, `buildSquareHouse`, `buildCompositeHouse`, `makeManor`, `makeStoneTower`, `makeTurret`, `makeSkyscraper` (`07-house-primitives.js`) | `makeVoxelLinearHouse`, `makeVoxelSquareHouse`, `makeVoxelCompositeHouse`, `makeVoxelManor`, `makeVoxelStoneTower`, `makeVoxelTurret`, `makeVoxelSkyscraper` (`09b`) | Dual |

House variant is resolved by cluster/stamp id; cottage is the solo single-floor default.

### Terrain props

| Type id | Normal builder | Voxel builder | Mode |
|---------|----------------|---------------|------|
| `tree` | `makeTree` (`06-history-object-factories.js`) | `makeVoxelTree` | Dual |
| `rock` | `makeRock` (`06`) | `makeVoxelRock` | Dual |
| `fence` | `makeFence` + `makeRoadGate`, `makeCastleWallSegment` (`07`) | `makeVoxelFence`, `makeVoxelFenceSpan` | Dual |
| `bridge` | `makeBridge` → wood-plank / covered-wood / stone-flat / stone-arch (`06`) | `makeVoxelBridge` | Dual |

`fence` is directional (n/s/e/w/center). `fenceStyle` enum: `garden`.

### Crops & flora

| Type id | Normal builder | Voxel builder | Mode |
|---------|----------------|---------------|------|
| `crop` | `makeCrop` | `makeVoxelCropKind('crop')` | Dual |
| `corn` | `makeCorn` | `makeVoxelCropKind('corn')` | Dual |
| `wheat` | `makeWheat` | `makeVoxelCropKind('wheat')` | Dual |
| `pumpkin` | `makePumpkin` / `makePumpkinCarriage` (max level) | `makeVoxelCropKind('pumpkin')` / `makeVoxelPumpkinCarriage` | Dual |
| `carrot` | `makeCarrot` | `makeVoxelCropKind('carrot')` | Dual |
| `sunflower` | `makeSunflower` | `makeVoxelCropKind('sunflower')` | Dual |
| `tuft` | `makeTuft` | `makeVoxelCropKind('tuft')` | Dual |
| `flower` | `makeFlower` | `makeVoxelCropKind('flower')` | Dual |
| `bush` | `makeBush` | `makeVoxelCropKind('bush')` | Dual |

*(all `07-house-primitives.js` normal builders; voxel in `09b`)*

### Animals

| Type id | Normal builder | Voxel builder | Mode |
|---------|----------------|---------------|------|
| `cow` | `makeCow` (`07`) | `makeVoxelAnimal('cow')` | Dual |
| `sheep` | `makeSheep` (`07`) | `makeVoxelAnimal('sheep')` | Dual |

### Lighting (voxel-only)

| Type id | Builder | Mode |
|---------|---------|------|
| `lamp-post` | `makeVoxelLightSource('lamp-post')` (`09b`) | Voxel-only |
| `spotlight` | `makeVoxelLightSource('spotlight')` (`09b`) | Voxel-only |

### Treasures / collectibles (fallback render)

These reuse other primitives as their visual (`17-tile-renderers.js`):

| Type id | Renders as |
|---------|-----------|
| `crystal` | `makeRock` |
| `totem` | `makeRock` |
| `ruins` | `makeRock` |
| `artifact` | `makeBush` |
| `relic` | `makeBush` |

### Special

| Type id | Builder | Notes |
|---------|---------|-------|
| `stargate` | `window.__tinyworldStargate.build()` | Animated portal + label sprite |
| `voxel-build` | `makeVoxelBuildStamp(id)` | User-authored voxel objects; always voxel |
| `model-stamp` | `makeModelStamp(id)` | Imported GLB/etc. (see §3); always voxel path |

---

## 3. Model stamps (external 3D assets)

Files under `models/`, indexed by `models/stamp-manifest.json`, loaded by
`engine/world/09-model-stamp-loader.js`, placed as the `model-stamp` object kind.

### Supported formats

`09-model-stamp-loader.js:8`:
```js
const MODEL_STAMP_SUPPORTED_FORMATS = new Set(['glb', 'gltf', 'obj', 'fbx', 'vox', 'vdb']);
```

| Format | Loader | Notes |
|--------|--------|-------|
| `glb` / `gltf` | `THREE.GLTFLoader` (DRACO / meshopt / KTX2) | Primary path |
| `obj` | text fetch + MTL + texture sidecars | Scaled to 0.86 units |
| `fbx` | `THREE.FBXLoader` | |
| `vox` | `THREE.VOXLoader` (wrapped in plain Mesh) | |
| `vdb` | `THREE.VDBLoader` | Frame sequences → animations |

Unsupported formats show a placeholder: *"needs browser loader; convert to GLB or OBJ."*
The loader adapts PBR materials to TinyWorld's Lambert lighting, applies sidecar
textures or a vertex-color palette fallback, normalizes the bounding box, and
scales to ~0.92 units (0.86 for OBJ). `supported: true` in the manifest means the
format is loadable AND the file resolved.

### Integrated stamps (the 7 in the manifest)

Generated by `tools/model-stamps.js` → `models/stamp-manifest.json`.

| id | Label | Path | Format | Size |
|----|-------|------|--------|------|
| `people-cartoon-guy` | Cartoon Guy | `people/cartoon_guy.glb` | glb | 13.4 MB |
| `people-kozak-hytale` | Kozak Hytale | `people/kozak_hytale.glb` | glb | 70 KB |
| `people-optimus` | Optimus | `people/optimus.glb` | glb | 45.5 MB |
| `people-robot` | Robot | `people/robot.glb` | glb | 27.1 MB |
| `people-stepan-hytale` | Stepan Hytale | `people/stepan_hytale.glb` | glb | 80 KB |
| `people-warrior-hytale` | Warrior Hytale | `people/warrior_hytale.glb` | glb | 52 KB |
| `stunt-plane` | Stunt Plane | `stunt_plane.glb` | glb | 259 KB + 3 PNG texture sidecars |

`stunt-plane` sidecars: `Polygon_Plane_Texture_01/02/03.png` (~218–229 KB each).

**These 7 GLBs are the only placeable external models.** Everything else under
`models/` is raw, un-integrated asset packs.

---

## 4. Raw asset packs (shipped, NOT placeable)

Present in the repo but not wired into the stamp system — formats the loader
ignores, or empty pack folders.

| Location | Contents | Formats | Status |
|----------|----------|---------|--------|
| `models/people/{25D,orcs,swordsman}/` | 2D character sprite sheets (idle/run/walk/attack/death) | PNG, ASEPRITE, PSD, TMX (Tiled) | Not stamps |
| `models/animals/` | Animal sprite sheets | PNG (114), ASEPRITE (104), PSD (104), TMX | Not stamps |
| `models/pets/boba/` | Single pet | WEBP spritesheet (~1.8 MB) + JSON | Not stamps |
| `models/buttons/PNG/` | UI button graphics (shiny & simple) | PNG | UI asset |
| `models/loadingbars/` | Loading-bar textures + sources + fonts | PNG, PSD, TTF (Cambria, Iskoola Pota) | HUD asset |
| `models/3d/ui/craftpix-net-320288-rpg-and-mmo-ui-4/` | RPG/MMO UI kit | PSD (zip) | Not extracted |
| `models/3d/craftpix-*` (7 packs) | desert cactus/tree, stone, desert mountain, medieval props, farming crops, elf fortress, orc settlement | — | **Empty** (0 model files; two have empty `fbx/` subdirs) |

The 2D sprite formats (PNG/ASEPRITE/PSD/WEBP/TMX) are structurally excluded —
the manifest generator only scans `.glb/.gltf/.obj/.fbx/.vox/.vdb`. The craftpix
3D packs would qualify but ship empty, so no models from them exist.

---

## 5. Quick reference — where things live

| Concern | File |
|---------|------|
| Render dispatch / mode decision | `engine/world/17-tile-renderers.js` |
| Normal-mode buildings, fences, crops, animals | `engine/world/07-house-primitives.js` |
| Normal-mode trees, rocks, bridges | `engine/world/06-history-object-factories.js` |
| Voxel-mode builders (all) | `engine/world/09b-voxel-build-factories.js` |
| Shared materials & geometry helpers | `engine/world/03-geometry-materials.js` |
| Model-stamp loader | `engine/world/09-model-stamp-loader.js` |
| Manifest generator | `tools/model-stamps.js` |
| Stamp manifest (integrated models) | `models/stamp-manifest.json` |
| Object/appearance schema (type & style enums) | `world.schema.json` |
| Render flags (`renderVoxelTerrain`, gap, bevel) | `engine/world/01-render-core.js` |
