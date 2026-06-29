---
name: tinyworld-lowpoly-stylized-3d
description: Use when adding, importing, designing, reviewing, or animating low-poly / stylized 3D assets in Tiny World Builder, including Three.js procedural meshes, GLB/GLTF assets, Poly Pizza models, material palettes, scale/orientation, silhouettes, clouds/planes/crop dusters, and toolbar thumbnails.
---

# Tiny World Low-Poly Stylized 3D

Use this together with:

- Project skill `.codex/skills/tinyworld-single-file/SKILL.md` for single-file constraints.
- Project skill `.codex/skills/tinyworld-render-performance/SKILL.md` for GPU/shadow/renderer limits.
- Installed skill `.agents/skills/3d-modeling/SKILL.md` for topology, UV, export, LOD, and GLB hygiene.
- Installed skill `.agents/skills/poly-pizza-api/SKILL.md` when sourcing low-poly models from Poly Pizza.
- Installed skill `.agents/skills/lightweight-3d-effects/SKILL.md` when adding decorative lightweight 3D effects.

## Tiny World art direction

- Low-poly, toy-like, readable at thumbnail size.
- Chunky primitives with bevels/rounded slabs, not realistic detail.
- Strong silhouettes beat micro-detail.
- Bright but not washed out: use saturated local color plus darker trim/shadow-side material.
- Keep texture use rare and intentional. Procedural `THREE.MeshLambertMaterial` colors should remain the default for built-in objects.
- Custom/generated voxel stamps should not render full bounding-cage trim by default; reserve bounds frames for explicit decorative-outline stamps.
- If generated voxel stamps include a broad ground/platform part, sink that base into the terrain rather than showing a raised tile under the object.
- Use flat/Lambert lighting semantics compatible with the vendored Three.js r185 global bundle.
- Avoid glossy/PBR realism unless an imported asset already depends on it.

## Scale rules

- One grid tile is `1 x 1` world unit.
- Small props should fit comfortably inside a tile: ~0.2–0.8 units wide.
- Houses can occupy one or multiple tiles, but doors/windows must remain readable from the default camera.
- Flying ambient objects should be scaled to feel like toys above the board, not real-world aircraft; crop duster wingspan target is around 1–1.5 tiles.
- Always normalize imported model scale with `Box3` bounds, then apply a target span.
- Apply orientation fixes once at model root or a named wrapper; do not keep stacking ad-hoc rotations in the animation loop.

## Voxel avatar descriptors

- Keep `window.voxelAvatarDescriptor` in `engine/world/53-voxel-avatar.js` and
  `cleanAvatar` in `party/index.js` in lockstep. The networked Tinyverse
  descriptor currently allows `kind`, `seed`, `body`, `skin`, `hairC`, `hair`,
  `fit`, `head`, `height`, `build`, and `gear`.
- Voxel avatar gear should use simple cached/shared geometries and materials
  where possible. Mark shared gear meshes with `userData.sharedAvatarAsset` so
  the avatar dispose path does not dispose shared assets while removing one
  avatar instance.

## Material and palette rules

- Prefer 2–4 materials per object: body, dark trim, highlight, accent.
- Bespoke generated voxel/custom-part models should use semantic material
  families rather than collapsing to the seed material. A greenhouse needs
  glass + frame + planting/base materials; an airship needs hull + brass/copper
  machinery + fabric/canvas balloon panels + cable/rope rigging + glass
  bridge/window accents.
- Generated custom-part renderers must keep those semantic families editable
  after creation. `voxelAppearanceMaterial()` should apply global
  `materialTexture` even when a part has no inferred body/top role, and body/top
  colours or textures should override only parts whose material/color maps to
  the matching role.
- Use the custom-part `cable` primitive for actual connections: balloon ropes,
  crane lines, tethers, rigging, moorings, bridge suspension lines, and other
  angled cords. Do not fake these as vertical stone/wood columns when endpoints
  are known.
- Use custom-part `sphere`/`ellipsoid` primitives for rounded balloon
  envelopes, domes, tanks, and soft canopies. Panel bands or ribs can be boxes
  only when they read as raised seams; colored balloon fabric panels should use
  curved ellipsoid slices (`phiStart`/`phiLength`) rather than square side
  plates.
- Default custom-part stamps should be board-scale on first creation. Compact
  bridges, decks, docks, and props should be about one tile wide and can use a
  small negative Y offset to sit into the terrain/water; only deliberate hero
  objects should claim 1.5+ tiles.
- Native TinyWorld objects can be used as parts of a scene, but they should not
  stand in for a requested model when `customParts` can express the model
  directly.
- Never mutate shared `M.*` material colors for one instance; clone or create a new material. The one allowed global exception is `applySeasonFoliage()`, which centrally retints shared foliage/grass materials for season changes.
- `MeshLambertMaterial` does not provide the same `flatShading` workflow as Standard/Phong; keep faceted model-stamp fallbacks through non-indexed/flat-normal geometry instead of unsupported material flags.
- Built-in material references should live in `engine/world/04-textures.js` as
  deterministic coarse canvas textures before adding per-object overrides.
  Current coarse material maps include `path-pavers`, `castle-block`,
  `brick-building`, `roof-shingles`, `window-lit`, `window-unlit`,
  `grass-voxel`, `grass-side`, `soil-side`, `fence-timber`, `crop-stalk`,
  `corn-cob`, sunflower maps, and `island-side-blocks`.
  Keep them intentionally large and calm from the default/top-down camera; if
  the whole island reads noisy, lower world-UV repeat before adding detail.
  Ground path is brick/paver blockwork, not rock chips or gravel: keep path
  terrain on `path-pavers` and avoid loose pebble overlays that make it read as
  stone rubble. Ground grass and ground stone default back to the older calm
  `cottage-grass`/`cottage-stone` maps; use the newer coarse maps on object
  materials, side panels, or explicit user-selected terrain texture overrides
  instead. Stone riser/side faces use a
  separate large-block material (`M.stoneSide`) so cliffs can scale up without
  changing the stone ground cap.
  Home island edge grass/soil/rock strata is not a texture-map option: it is
  the dedicated `M.boardSideEdge` shader material, aligned from `TOP_H` (the
  visible grass-cap top) down a shallow side backing behind the foreground
  greebles. It samples `textures/island-side-strata-gpt.png`, a fixed
  1024x192 horizontal strata slice; keep that slice image-driven and the same
  dimensions rather than rebuilding tall normalized procedural bands.
  Grass richness should stay FPS-safe through shared texture maps (`grass-voxel`
  or `grass-side` only when intentionally selected), not added blade meshes.
  Stone blocks should stay light cool gray like the stair/column references
  rather than tan or charcoal; fence timber should stay warm and use horizontal
  grain bands so rails read correctly.
- Cottage-style defaults remain part of the built-in material language:
  `texCottageGrass`, `texCottageWood`, and the texture-folder atlases are still
  useful for softer surfaces, but stone/path/roof/window/fence/crop references
  should use the newer coarse maps when the requested style is square voxel
  material.
- For imported texture variants, create explicit material variants and swap them at the model mesh level.
- For toolbar thumbnails, increase contrast/saturation carefully so icons read against the white toolbar, but keep the in-world material natural.
- If a model comes with a texture atlas, set its color data with `twSetTextureSRGB(texture)` / `texture.colorSpace = THREE.SRGBColorSpace` and check `flipY` for GLTF compatibility.
- Repo-backed model stamps must run a material hydration pass: preserve real embedded materials, apply known sidecar atlases (GLTF atlases use `flipY = false`), parse OBJ `.mtl` sidecars when present, warn when they are missing, and apply a deterministic TinyWorld palette fallback to blank `palette`/white materials so imports do not look like unpainted 3D prints.
- GLB/GLTF model stamps must adapt PBR `MeshStandardMaterial` /
  `MeshPhysicalMaterial` into TinyWorld-lit Lambert materials while preserving
  base-color maps, vertex colors, transparency, emissive maps, skinning, and
  morph flags. The app has no environment map, so metallic PBR GLBs otherwise
  render nearly black beside native Lambert objects. Do not blindly preserve
  occlusion or normal maps on that conversion path: black AO/ORM red channels
  remove indirect lighting in the glTF spec, and broken/uniform normal maps can
  dominate lighting. The model-stamp loader samples AO maps and drops black
  ones, keeps non-color maps linear, and does not copy normal maps into the
  TinyWorld-lit Lambert material. The scene also includes model-stamp import
  safety fill lights so converted GLBs are not dependent on the shadow-casting
  sun alone.
- Model stamp factories should apply `opts.appearance` themselves so world rendering, ghost previews, and selection previews share texture/color overrides; avoid applying the same model-stamp appearance again at the board render wrapper.
- If a custom/model asset should be harvestable in Tinyverse, add explicit
  object-cell `economy` metadata (`fish`, `ore`, `plants`, or `meat`) instead of
  relying on material names, colors, or visual shape. Keep the visual asset
  authoring separate from the authoritative economy tag.
- Native generated ore is a rock prop variant, not a new kind: keep
  `kind: "rock"` and use `appearance.oreMetal` (`copper`, `iron`, `silver`,
  `gold`). The built-in rock factories should render ore as natural stone
  boulders with small embedded beveled metallic cubes, roughly a third of the
  stone chunks' scale; do not turn the entire rock prop into metal.
- Wear-and-tear should stay stylized: global grime/desaturation plus small batched chips/scuffs/moss beats realistic noise-heavy shader work.
- Floating-board depth can reuse existing roof language by inverting a stepped roof form under the board: dark gray shingle-textured slabs, board-footprint width/depth, vertically compressed, and attached below the dirt body. Utility underside dressing should stay toy-like and readable: chunky pipe cylinders, cable trays, clamps, junction boxes, and short dangling cable drops in the existing steel/dark underside palette.
- Voxel lift/propeller engines use an explicit part palette inside
  `makeVoxelLiftEngine`: mottled stone body, `pipe-metal` steel hubs/shaft, wood
  crates/blades, and pale plank labels. Keep future engine material tweaks local
  to that factory so terrain/object materials do not drift globally.
- Visual richness should come from selective density contrast: keep cliffs,
  walls, terrain bodies, and island masses chunky, then spend extra detail on
  roofs, windows, crops, trees, path storytelling, and hero landmarks. Prefer
  instanced/rule-based surface detail such as wheel ruts, edge roots, tiny
  signs/crates, and beacon/banners over globally raising voxel resolution.
- Garden fences are a style of the existing fence kind (`appearance.fenceStyle:
  "garden"`), not a separate object kind. They should stay dark timber with a
  simple vine rail and small warm fruit accents, and still flow through the
  contiguous fence span renderer for long runs.
- Lamp and spotlight stamps should read as physical voxel objects first:
  chunky metal bases/heads with warm emissive glass, plus a blurred haze and a
  fake ground spill decal. Spotlights point from the fixture outward/down; the
  light cone should be narrow at the head and wider/softer where it falls on
  the ground.
- Blast/shield art direction is locked to the supplied Voxel Blast Shield Core
  classes, adapted into TinyWorld rather than recreated. Keep the dark damaged
  metal panels, four rising corner keystones, panel chains extending from the
  corners, outward blue rune faces, and `window.VoxelShield` controls intact.
- The Tower house variant has paired factories: `makeStoneTower` is the normal faceted/conical design and `makeVoxelStoneTower` is the voxel counterpart. Keep their silhouettes aligned when changing tower roof, balcony, window, door, or flag details. Castle/turret rendering should stay block-built: `makeTurret` delegates to the square voxel keep in `makeVoxelTurret`.

## Model import hygiene

- Keep assets under `models/` and ensure `publish.sh` copies them to `dist/models/`.
- Use the vendored Three.js r185 GLTF stack from `vendor/three/tinyworld-three.r185.min.js` (`GLTFLoader`, `DRACOLoader`, `MeshoptDecoder`, and `KTX2Loader`) and configure the loader before loading imported model stamps.
  Surface remaining unsupported-extension errors instead of silently showing
  the generic placeholder.
- After loading:
  1. compute `Box3`, center model at origin,
  2. scale to target tile/world size,
  3. set cast/receive shadow intentionally,
  4. tag moving subparts in `userData`,
  5. dispose cloned materials/geometries if removed.
- Search named nodes before doing geometry surgery. Common names: `prop`, `propeller`, `blade`, `rotor`, `fan`, `wheel`, `flap`.

## Animation rules

- Animate only transforms and opacity.
- Respect the existing `userData.landing` pattern for placed cell objects.
- For propellers: wrap or find the named prop mesh, spin around its local blade axis every frame, and add a translucent disc for high-RPM readability. For TinyWorld-built lift engines, keep the fan plane centred on the lower shaft mount, prefer a shared dark shader blur/strobe disc, and hide physical blade groups once the spin ramp reaches speed.
- For rocket/jet flames: prefer chunky pixel/block shader sheets or capped
  particle pools over many animated micro-meshes. Preserve the toy-like
  silhouette with a plume that narrows toward the bottom, hard flicker bands,
  and warm core/outer colours rather than realistic volumetric fire. When
  replacing an object style, keep the older object factory as an inactive
  legacy helper instead of deleting it.
- For aircraft: use shallow easing, pitch with climb/descent slope, and bank during turns. Do not teleport or dive straight down into the board.
- Small world motion is preferred over heavy renderer tricks: tree asymmetry,
  crop/wheat/corn/sunflower sway, window glow, smoke, waterfalls, clouds, and
  engine movement should sell life while keeping object roots in the existing
  `animatedCellObjects`/runtime sets.
- Particle effects should be capped and use cheap cloned `MeshBasicMaterial`; dispose particle materials when particles die.

## Validation checklist

- Inline script passes: `perl -0ne 'print $1 if m#<script>\s*(.*?)\s*</script>#s' tiny-world-builder.html | node --check`.
- `./publish.sh` copies any new assets into `dist/`.
- Default camera shows the asset at the intended scale.
- Shadows are visible but not noisy; no huge new shadow casters.
- Toolbar thumbnail remains readable.
- No material mutation leaks into other objects.

## Procedural cow/sheep animation

- Built-in cow/sheep meshes are created by `makeVoxelAnimal()` in `engine/world/09b-voxel-build-factories.js` and animated by `engine/world/70-animal-anim.js`.
- Keep animal body/head/leg pivots live: set `userData.noVoxelBatch = true`, expose parts under `userData.anim`, and register with `window.__tinyworldRegisterAnimal(g)` after rendering.
- Animal movement is cosmetic only. The grazer moves the rendered group around its home tile; do not mutate `world[x][z]` or multiplayer harvest/resource state from this animation.
- When adding new animal poses, use local state inside the 70 module and preserve the `__tinyworldAnimalTick(t, dt)` hook from the main animation loop.
