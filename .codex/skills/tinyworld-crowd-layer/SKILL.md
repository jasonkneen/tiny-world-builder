# TinyWorld Crowd Layer

Use this skill when changing TinyWorld's 2.5D crowd/person sprite system.

## Shape

- Runtime: `vendor/tiny-crowd-layer.js`, exposed as `window.TinyCrowdLayer`.
- Assets: `crowd/`, copied to `dist/crowd/` by `publish.sh`.
- Integration: `tiny-world-builder.html` creates one ambient crowd layer under `worldGroup`.

## Rules

- Keep people out of `world[x][z]` and `cellMeshes`; they are moving runtime entities, not terrain/object intent.
- If replacing 2.5D people with rigged/model characters, keep `TinyCrowdLayer` as the movement/zone simulation source and mirror its people into transient scene actors. Hide sprites through `showSprites` / `setSpritesVisible`, but do not persist the character actors into world state.
- Rigged/model crowd actors should route animation through the reusable `createRiggedCharacterRuntime()` / `updateRiggedCharacterRuntime()` helpers. GLTF/GLB clips drive `AnimationMixer` actions; do not cut or infer limbs from a T-pose mesh.
- Use `tilePos(x, z)` for map placement and a terrain-height callback for feet height.
- Preserve the original crowd demo's `P` config surface (`count`, `size`, `slices`, `bob`, `sway`, `headSway`, `leg`, `squash`, `lean`, `hipLine`, `cadence`, `speed`, etc.) when tuning animation.
- Render movement through the original slice-wave canvas animation, then upload that canvas into a `THREE.CanvasTexture` used by a `THREE.Sprite`.
- Size people against known TinyWorld model proportions: default door height is about `0.48` world units, and people should be below that.
- Choose `down/up/left/right` frames from the camera's horizontal angle relative to the person's heading; steep overhead views use a baked collapsed-body `top` frame.
- Each person has a circular zone (`radius`) around its 3D point for collision, hit testing, visibility, and later avoidance.
- Keep the crowd layer vanilla JS with no bundler and no npm runtime dependencies.
- **Toggling & State**: The crowd can be enabled/disabled via the global variable `crowdEnabled` (persisted in `localStorage` via `RENDER_LS.crowdEnabled`, starting from settings version `'21'`).
  - When `crowdEnabled` is false, `seedCrowdPeople()` clears the sprites and exits early, and the update loop is bypassed.
  - When toggled on, the layer is initialized lazily via `initCrowdLayer()` or populated/re-seeded via `seedCrowdPeople()`.
  - Toggles must be present in both the Settings Modal and the Live Crowd Panel, and synchronized via `syncControls()` and `applyFromControls()`.
  - Worlds room play temporarily suppresses ambient crowd visuals through `window.__tinyworldCrowd.setRuntimeVisible(false)` and restores the prior runtime-visible state on leave. Do not persist this as `crowdEnabled=false`; it is a room-lifecycle visibility guard so playable avatars are not mixed with ambient people. The lobby slug `tidewater-bay` is the exception and keeps ambient wanderers visible.
- **UI & Interaction**: The live Crowd Controls panel uses the same glassmorphism design parameters as the map panel (translucent background, thin white border, inset glow, saturate backdrop-blur filter).
  - The panel is draggable using pointer capture events on its header/chrome, clamping positions within the viewport and saving state to `localStorage` under `tinyworld:crowd.pos`.
  - The panel is collapsible off-screen to the right (via `transform: translateX(...)`), and triggers a `👥` right-edge handle button when closed. The collapsed state is persisted to `localStorage` under `tinyworld:crowd.collapsed`.

## Asset contract

- Character sets need four PNG views: `down`, `up`, `right`, and `left`.
- Animatable 3D character replacements must come from model stamps with real skins and animation clips. OBJ/MTL character stamps can replace sprites visually in other contexts, but they do not carry skeleton animation clips and should not be used as animated crowd actors.
- The imported source repo has a misspelled `charachters/` path; preserve it in copied asset URLs unless migrating all references at once.
- If a sprite fails to load, the layer should degrade to a visible fallback texture instead of breaking app boot.

## Integration checks

- `npm test`
- `npm run build`
- Browser page load has no console errors.
- Camera orbit changes swap the visible crowd angle without flickering.
- Reset/load reseeds ambience without saving crowd people into the world schema.
