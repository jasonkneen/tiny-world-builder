# TinyWorld Crowd Layer

Use this skill when changing TinyWorld's 2.5D crowd/person sprite system.

## Shape

- Runtime: `vendor/tiny-crowd-layer.js`, exposed as `window.TinyCrowdLayer`.
- Assets: `crowd/`, copied to `dist/crowd/` by `publish.sh`.
- Integration: `tiny-world-builder.html` creates one ambient crowd layer under `worldGroup`.

## Rules

- Keep people out of `world[x][z]` and `cellMeshes`; they are moving runtime entities, not terrain/object intent.
- Use `tilePos(x, z)` for map placement and a terrain-height callback for feet height.
- Preserve the original crowd demo's `P` config surface (`count`, `size`, `slices`, `bob`, `sway`, `headSway`, `leg`, `squash`, `lean`, `hipLine`, `cadence`, `speed`, etc.) when tuning animation.
- Render movement through the original slice-wave canvas animation, then upload that canvas into a `THREE.CanvasTexture` used by a `THREE.Sprite`.
- Size people against known TinyWorld model proportions: default door height is about `0.48` world units, and people should be below that.
- Choose `down/up/left/right` frames from the camera's horizontal angle relative to the person's heading; steep overhead views use a baked collapsed-body `top` frame.
- Each person has a circular zone (`radius`) around its 3D point for collision, hit testing, visibility, and later avoidance.
- Keep the crowd layer vanilla JS with no bundler and no npm runtime dependencies.

## Asset contract

- Character sets need four PNG views: `down`, `up`, `right`, and `left`.
- The imported source repo has a misspelled `charachters/` path; preserve it in copied asset URLs unless migrating all references at once.
- If a sprite fails to load, the layer should degrade to a visible fallback texture instead of breaking app boot.

## Integration checks

- `npm test`
- `npm run build`
- Browser page load has no console errors.
- Camera orbit changes swap the visible crowd angle without flickering.
- Reset/load reseeds ambience without saving crowd people into the world schema.
