---
name: tinyworld-webxr
description: Use when adding or modifying WebXR, AR placement, VR immersion, headset controller input, or XR rendering modes in Tiny World Builder.
---

# Tiny World WebXR

Tiny World uses the pinned global `THREE` r128 build, not module imports or `ARButton`/`VRButton` addons. Keep WebXR integration vanilla and single-file inside `tiny-world-builder.html`.

Platform split — WebXR covers "Google" AR (Android Chrome / Quest, via `immersive-ar` + `hit-test`), but Apple devices have no WebXR. iOS/iPadOS web AR is **AR Quick Look only**: an `<a rel="ar">` pointing at a `.usdz` opens the system viewer, which finds a surface, places the model, and lets the user walk around it. So both paths must exist for full coverage.

Patterns:

- For Apple AR, export the live world to USDZ on demand with `THREE.USDZExporter` (vendored as a classic global script `vendor/three/USDZExporter.r128.js`, which uses the global `fflate`). USDZExporter only understands `MeshStandardMaterial`, so snapshot `worldGroup` into a fresh group, convert each Lambert/Basic/Shader material to a Standard equivalent (preserving colour/emissive/map), recentre on the origin with the base at y=0, and scale to a tabletop size. Wrap the resulting `Uint8Array` in a `model/vnd.usdz+zip` Blob → object URL, and launch via an `<a rel="ar">` that contains a single `<img>` child (Safari's requirement) clicked programmatically.
- Gate the Apple AR button on `document.createElement('a').relList.supports('ar')`; gate the WebXR buttons on `navigator.xr` support. Show the XR panel if either is available so iOS users see just the Apple AR button.

- Enable WebXR with `renderer.xr.enabled = true` and drive the main loop with `renderer.setAnimationLoop(animate)` so desktop and headset frames share one path.
- Keep headset transforms on `xrWorldRoot`, a scene-level parent for board/runtime meshes. Do not scale/move `worldGroup` alone; hover, selection, clouds, weather, smoke, crop duster, and previews must stay in the same local world space.
- Keep controllers/reticles in `scene`, not `xrWorldRoot`; they are physical XR-space objects.
- For AR desk mode, request `immersive-ar` with required `hit-test`, optional `anchors`, and a `domOverlay` root. Use the reticle pose to set `xrWorldRoot` and use anchors when available, but gracefully fall back to the last hit-test pose.
- For floating mode, prefer `immersive-ar`, then fall back to `immersive-vr`; place the mini board in front of the current XR camera.
- For inside mode, use `immersive-vr` with `local-floor` and leave `xrWorldRoot` at meter scale (`scale = 1`) so one tile is walkable room scale.
- When picking tiles from controllers, raycast against `worldGroup.children`, then convert `h.point` through `xrWorldRoot.worldToLocal()` before deriving tile-local offsets. Desktop pointer picking can keep using screen-space raycasts.
- Restore `scene.background`, `xrWorldRoot` transform/visibility, reticle state, and UI state on XR session end or failure.

Validation:

- `npm test` and the inline script `node --check` must pass.
- Real AR hit-test/VR entry requires HTTPS plus a headset/browser with WebXR support; browser smoke tests can only verify non-XR fallback UI and syntax.
