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
- Use flat/Lambert lighting semantics compatible with Three.js r128.
- Avoid glossy/PBR realism unless an imported asset already depends on it.

## Scale rules

- One grid tile is `1 x 1` world unit.
- Small props should fit comfortably inside a tile: ~0.2–0.8 units wide.
- Houses can occupy one or multiple tiles, but doors/windows must remain readable from the default camera.
- Flying ambient objects should be scaled to feel like toys above the board, not real-world aircraft; crop duster wingspan target is around 1–1.5 tiles.
- Always normalize imported model scale with `Box3` bounds, then apply a target span.
- Apply orientation fixes once at model root or a named wrapper; do not keep stacking ad-hoc rotations in the animation loop.

## Material and palette rules

- Prefer 2–4 materials per object: body, dark trim, highlight, accent.
- Never mutate shared `M.*` material colors for one instance; clone or create a new material. The one allowed global exception is `applySeasonFoliage()`, which centrally retints shared foliage/grass materials for season changes.
- For imported texture variants, create explicit material variants and swap them at the model mesh level.
- For toolbar thumbnails, increase contrast/saturation carefully so icons read against the white toolbar, but keep the in-world material natural.
- If a model comes with a texture atlas, set `texture.encoding = THREE.sRGBEncoding` and check `flipY` for GLTF compatibility.
- Wear-and-tear should stay stylized: global grime/desaturation plus small batched chips/scuffs/moss beats realistic noise-heavy shader work.
- Floating-board depth can reuse existing roof language by inverting a stepped roof form under the board: dark gray shingle-textured slabs, board-footprint width/depth, vertically compressed, and attached below the dirt body.

## Model import hygiene

- Keep assets under `models/` and ensure `publish.sh` copies them to `dist/models/`.
- Use `THREE.GLTFLoader` from the Three.js r128 examples CDN if loading GLB/GLTF in the single HTML file.
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
- For propellers: wrap or find the named prop mesh, spin around its local blade axis every frame, and add a translucent disc for high-RPM readability.
- For aircraft: use shallow easing, pitch with climb/descent slope, and bank during turns. Do not teleport or dive straight down into the board.
- Particle effects should be capped and use cheap cloned `MeshBasicMaterial`; dispose particle materials when particles die.

## Validation checklist

- Inline script passes: `perl -0ne 'print $1 if m#<script>\s*(.*?)\s*</script>#s' tiny-world-builder.html | node --check`.
- `./publish.sh` copies any new assets into `dist/`.
- Default camera shows the asset at the intended scale.
- Shadows are visible but not noisy; no huge new shadow casters.
- Toolbar thumbnail remains readable.
- No material mutation leaks into other objects.
