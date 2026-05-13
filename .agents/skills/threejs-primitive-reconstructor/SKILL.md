---
name: threejs-primitive-reconstructor
description: create robust, browser-runnable three.js primitive reconstructions from static low-poly, voxel, isometric, or stylized game-art reference images. use when the user asks to turn an image or prompt into a three.js/html asset, generate a primitive-only scene, debug non-rendering three.js output, or produce a reusable prompt/template for low-poly three.js reconstruction.
---

# Three.js Primitive Reconstructor

## Core workflow

Use this skill to generate a reliable single-file Three.js HTML scene from a low-poly, voxel, isometric, or stylized 3D reference image.

1. Inspect the reference image visually before coding.
2. Produce a short analysis inventory in the response and include the same inventory as a comment block at the top of the script.
3. Generate one plain `.html` file, not React, JSX, iframe, or `srcDoc`.
4. Use only primitive geometry: `BoxGeometry`, `CylinderGeometry`, `ConeGeometry`, `SphereGeometry`, `Group`, and `MeshStandardMaterial`.
5. Use the import-map loading pattern from `assets/threejs-scene-template.html`.
6. Keep objects aligned to integer or half-integer tile coordinates when reconstructing grid-based scenes.
7. Add soft shadows, matte materials, and an immediate camera view where the asset is visible without user adjustment.
8. When the user reports a loading or rendering error, first replace CDN/import patterns and wrappers with the robust plain HTML template in `assets/threejs-scene-template.html`.

## Required analysis inventory

Before the code, summarize:

1. Camera and framing: projection feel, camera type, azimuth/elevation, crop/centering.
2. Palette: 8-15 hex colors visible in the reference.
3. Ground/podium: grid size, tile size, base thickness, grass variation, water/path positions.
4. Structures: type, grid position, footprint, height, wall/roof colors, distinguishing features.
5. Nature: trees, bushes, flowers, rocks, grass tufts, size variation.
6. Farm/details: crops, stairs, doors, windows, fence rails, small props.
7. Sky/atmosphere: sky color, fog, clouds/smoke.
8. Animation: optional rotation, drifting clouds, rising smoke, water shimmer.

## Coding rules

- Use one self-contained `.html` file.
- Use an import map with `unpkg.com` exactly as shown in `assets/threejs-scene-template.html`.
- Import with `import * as THREE from 'three'` and `OrbitControls` from `three/addons/controls/OrbitControls.js`.
- Do not use `esm.sh`, `cdn.jsdelivr`, relative Three.js module paths, React, JSX, iframe, or `srcDoc`.
- Do not use external assets, textures, GLTF, OBJ, FBX, SVG, or postprocessing.
- Use `MeshStandardMaterial` throughout; default `roughness: 1` and `metalness: 0`.
- Set `renderer.outputColorSpace = THREE.SRGBColorSpace`.
- Enable `renderer.shadowMap.enabled = true` and `THREE.PCFSoftShadowMap`.
- Add a resize listener.
- Append `renderer.domElement` directly to `document.body`.
- Keep comments sentence case.
- Keep the generated file under roughly 500 lines unless the user asks for more detail.

## Reference and template files

- Read `references/reconstruction-prompt.md` when the user wants the reusable prompt or prompt wording.
- Use `assets/threejs-scene-template.html` as the starting point for generated HTML.
- Use `scripts/write_scene_from_template.py` only when a quick local template copy is useful; customize the copied file afterward.

## Debugging non-rendering output

If a generated scene does not render:

1. Remove React, JSX, iframe, and `srcDoc` wrappers.
2. Replace module imports with the import-map pattern in the template.
3. Confirm the file is served through a local server, for example `python3 -m http.server 8000`, then opened at `http://localhost:8000/scene.html`.
4. Confirm `renderer.domElement` is appended to `document.body`.
5. Confirm the camera points at the asset and the object is near the origin.
6. Simplify animation until a static render works.

## Cottage reference shortcut

For the cropped cottage reference, reconstruct:

- A 5 by 5 floating grass tile island with a brown dirt base.
- A front-left water strip slightly below grass level.
- One warm yellow cottage centered slightly back-left.
- A bright blue hipped roof with dark blue ridge/caps.
- A tall chimney with four rising smoke puffs.
- A brown front door, cyan windows with dark frames, and exterior stone stairs on the right.
- A wooden fence around the front/right/back of the yard.
- Grass tufts, small white/yellow flowers, sky-blue background, soft shadows, and matte materials.
