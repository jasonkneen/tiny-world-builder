---
name: tinyworld-cctv-truman
description: Use when changing the in-world CCTV / "Truman Show" surveillance cameras in Tiny World Builder — render-to-texture security feeds, the black-and-white CRT/VHS monitor shader, camera placement (lobby side-cams, pumpkincam, treecams), subject tracking, or the lobby screen cutting to live feeds.
---

# Tiny World CCTV / Truman Cameras

Low-res black-and-white security cameras that watch the lobby + world and feed
both physical monitors and the big lobby presentation screen. They idle-sweep,
then pan to look at whoever is MOVING nearby — like the hidden cameras in The
Truman Show.

## Files

- `engine/world/62-cctv-truman.js` — the core system. IIFE exposing
  `window.__tinyworldCCTV`. **4-space body indent on purpose** so the
  duplicate-declaration guard in `tools/check.js` (which only scans 2-space
  top-level decls) ignores its locals.
- `engine/world/63-cctv-placement.js` — mounts cams + monitors on room `enter`,
  tears down on `leave`. Exposes `window.__tinyworldCCTVPlacement`.
- `engine/world/58-lobby-presentation.js` — the big screen; its `tick()` cuts
  between slides and the hottest live feed.
- `scripts/landing-feed.js` + `styles/landing.css` — the public landing-page
  live-worlds panel. World rows are buttons: click once to expand an island
  CCTV preview (2D canvas from `/api/worlds.preview.cells`), click again to
  collapse. This is a lightweight marketing/front-door CCTV treatment, not a
  Three.js render target.
- Tick wiring: `engine/world/25-animation-loop-schema.js` calls
  `window.__tinyworldCCTV.tick(t,dt)` then `window.__tinyworldLobby.tick(t,dt)`
  **before** `renderScene()` so feeds captured this frame appear this frame.

## How it works

- Each camera owns a `PerspectiveCamera` + a small `WebGLRenderTarget`
  (`FEED_W×FEED_H`, 4:3). `tick()` round-robins captures (`CAPTURES_PER_FRAME`,
  capped at `FEED_FPS`) using `renderer.setRenderTarget(rt); renderer.render(scene, cam)`
  — **always save/restore the previous render target** (`getRenderTarget()`),
  and bail if `renderer`/`scene` aren't ready.
- The monitor material is a `ShaderMaterial` (CRT_FRAG): luminance B&W, scanlines,
  a rolling interference bar, hash static, vignette, and `uSignal` dropout that
  dissolves toward static. A second canvas texture (`tCaption`) bakes the camera
  name + live date/time + blinking REC and is composited in the shader. The
  material is tagged `userData.windowLightEffect = true` + `lightVisual = true`
  so `prepareFadeable()` does NOT swap it for a fade material (skill:
  tinyworld-render-performance).
- Must end the fragment with `#include <encodings_fragment>` (r128 output color
  space), like every other ShaderMaterial here.
- **Subjects**: `setSubjectsProvider(() => [{pos:Vector3, name}])`. The room
  feeds `WS.subjects()` (self + peer avatar sprite positions). Cameras + monitors
  live under `WS.avatarParent()` — the SAME local frame as the avatars and lobby
  screen — so subject positions need no conversion.
- **Truman tracking**: `aim()` scores each in-range subject by `prox*0.6 +
  moved*1.0` (movement dominates) using per-feed last-position memory; it lerps
  `curLook` toward the winner (`TRACK_LERP`) or idle-sweeps (`IDLE_LERP`). A
  per-feed `activity` score spikes on motion and decays (`ACTIVITY_DECAY`).
- **Hot feed**: `activeFeed(minActivity)` / `feedsByActivity()` let the lobby
  screen auto-cut to whichever camera has something happening. `glitch(id,amt)`
  drops `uSignal` briefly to sell a cut.

## Placement (63)

On `enter` (after a 350ms delay so cells + lobby screen exist) it mounts:
- `lobby-l` / `lobby-r` — flank both sides of the presentation screen, angled at
  the crowd (toward +z).
- `pumpkincam` — over the biggest `kind:'pumpkin'` cell (scans `world[][]`,
  sorts by floors).
- `treecam-1/2` — over the tallest `kind:'tree'` cells.
Monitors stack up the sides of the lobby screen. `window.__tinyworldCCTVFeeds`
lists mounted feed ids.

## Lobby cutting (58)

`build()` stashes `screenMesh` + `slideMat`. The state machine auto-advances
slides (`AUTO_ADVANCE`), then after `SLIDE_DWELL` swaps the screen material to a
`monitorMaterialFor(hotFeed)` for `FEED_DWELL`, then back. Manual presenter
`go()` and `hide()` snap back to slides. New API: `tick, setCycle, showSlides,
showFeed, liveFeed`.

## QA

- `?cctv=demo` (or `=1`) drops 4 monitors around origin watching a bobbing test
  subject and self-drives the tick — verifies the CRT look + tracking without a
  multiplayer room.
- Landing page QA for `scripts/landing-feed.js`: if local `/api/worlds` is not
  available, mock `window.fetch('/api/worlds')`, append a fresh copy of the
  script, click `.hero-feed-link`, and assert `.hero-feed.is-expanded`, one
  `.hero-feed-cctv-canvas`, and the `.hero-feed-cctv-meta` status/link render.
  The panel should anchor below the nav (`.hero-feed.is-expanded`) and scroll
  internally instead of overflowing the hero.
- Headless sanity: eval module 62 under a THREE stub, `addCamera` + `tick` a few
  frames with a moving subject, assert `activeFeed()` returns the feed and
  `activity > 0`.
- `npm run check` (duplicate-decl + i18n), `npm run smoke`, `./publish.sh`.

## Pitfalls

- Don't capture every feed every frame — round-robin, or the extra
  `renderer.render` passes tank FPS (the renderer contract is single-pass per
  feed; this is the only sanctioned extra-RT path here besides pixelation).
- Don't forget to restore the render target after capturing, or the main scene
  renders into the last feed's RT (black screen).
- Keep monitor materials off the fade pipeline via the `windowLightEffect` tag.
- Cameras + monitors MUST be added under `avatarParent()`, not `scene`, or they
  won't inherit the tinyverse scale/offset and subject tracking will be wrong.
