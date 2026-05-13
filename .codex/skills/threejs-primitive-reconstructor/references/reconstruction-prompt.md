# Three.js scene from static image — robust reusable prompt

Paste this into a new chat together with one reference image. The goal is to get a browser-runnable Three.js scene that reconstructs the image using only primitive geometry.

---

You are a Three.js scene builder specializing in low-poly voxel / isometric game art reconstruction from reference images.

## Input

A single static reference image of a low-poly, voxel, isometric, or stylized 3D game-art scene.

## Task

Create a single self-contained HTML file that renders a Three.js scene matching the reference as closely as possible using only primitive geometry.

Use only:

- `BoxGeometry`
- `CylinderGeometry`
- `ConeGeometry`
- `SphereGeometry`
- `Group`
- `MeshStandardMaterial`

Do not use GLTF / OBJ / FBX models, textures, image files, SVG, canvas drawings, postprocessing libraries, React, iframe wrappers, or build tools.

The output must be one plain `.html` file that opens directly in a browser.

## Critical rendering requirement

Use this import pattern exactly:

```html
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>

<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
```

Do not import from `esm.sh`, `cdn.jsdelivr`, or relative Three.js paths.
Do not put the Three.js code inside `srcDoc`, React, JSX, or markdown fences inside the actual deliverable.

## Analyze the image first

Before writing code, produce a short inventory and include the same inventory as a comment block at the top of the script.

1. Camera and framing: projection feel, recommended camera, azimuth/elevation, centering/crop.
2. Palette: 8-15 hex colors visible in the image.
3. Ground / podium: grid size, tile size, dirt base thickness, tile variation, water, paths.
4. Structures: type, grid position, footprint, height, wall/roof colors, distinguishing features.
5. Nature: trees, tufts, flowers, rocks, bushes, size variation.
6. Farm / details: crops, pumpkins, wheat, stairs, doors, window trim, fence rails.
7. Sky and atmosphere: sky color, fog, clouds or smoke.
8. Animation: optional slow rotation, drifting clouds, rising smoke, water shimmer.

## Reliability rules

1. Use the import map with `unpkg.com` shown above.
2. Use `import * as THREE from 'three'` and `OrbitControls` from `three/addons/...`.
3. Do not use React, JSX, iframe, or `srcDoc`.
4. Do not use `esm.sh` or `cdn.jsdelivr` module paths.
5. Do not use external assets.
6. Use `window.innerWidth` and `window.innerHeight` for renderer sizing.
7. Always append `renderer.domElement` to `document.body`.
8. Always include a resize listener.
9. Keep code under about 500 lines.
10. Use `MeshStandardMaterial` unless there is a strong reason not to.
11. Use `renderer.outputColorSpace = THREE.SRGBColorSpace`.
12. Avoid random placement unless seeded or used only for non-critical decoration.
13. Ensure camera target and object positions put the asset in frame immediately.

## For the attached cottage image specifically

Reconstruct the scene as a single focused asset:

- A 5 by 5 floating grass tile island.
- Brown dirt base underneath.
- Bright water strip at the front-left edge.
- One warm yellow cottage centered slightly back-left.
- Bright blue hipped roof with dark blue ridge/caps.
- Tall chimney on the left/rear roof slope.
- Four small smoke puffs rising from the chimney.
- Brown wooden door on the front.
- Small cyan windows with dark frames.
- Exterior stone stairs climbing the right side.
- Wooden fence around front/right/back of yard.
- Grass tufts and a few small white/yellow flowers.
- Solid saturated sky-blue background.
- Soft shadows and matte materials.
- Optional slow rotation, smoke rising, and subtle water bob.

Suggested camera:

```js
camera.position.set(7.5, 6.5, 7.5);
controls.target.set(0, 1, 0);
```

Suggested palette:

```js
const palette = {
  sky: 0x2299e8,
  grass: 0x81c934,
  grassLight: 0x9ce34b,
  grassDark: 0x5fa72c,
  dirt: 0x9b642f,
  water: 0x13a8ef,
  wall: 0xd8a65a,
  wallLight: 0xf1c777,
  roof: 0x006eea,
  roofDark: 0x004fb8,
  wood: 0x8b4a18,
  woodLight: 0xb7631c,
  door: 0x5a2e16,
  window: 0x2fc6ff,
  stone: 0xb7aa92,
  smoke: 0xedf4f8
};
```

## Deliverable

Return:

1. A brief note explaining interpretation choices.
2. One complete HTML file.

The HTML must be plain HTML and JavaScript, not React. The file must be directly runnable through a simple server such as:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/scene.html
```
