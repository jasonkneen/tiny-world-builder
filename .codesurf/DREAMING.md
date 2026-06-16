Let me now fetch the Anthropic docs and Latent Space newsletter:

A: I've gathered findings across all sources. Let me compile the scouting report:

---

**VibeClaw Skills Scout Report** — 2026-06-15

**New Skills on skills.sh / trending**
- site returned Cloudflare 1020 Access Denied (blocked). No new skills scraped from skills.sh this cycle.

**GitHub (agent-skills / mcp-server repos, last 7 days)**
- `mcp-server-chart` — Charts/visualization MCP server (⭐ trending, 3 days old)
- `claude-mcp-server` — Anthropic's official Claude MCP server reference impl
- `agents-sdk-python` — OpenAI Python Agents SDK (high traffic)
- Multiple Playwright/browser-automation MCP servers appearing (browser-use derivative…

### Session: I read DREAMING.md and my other memory files. The main poser surface calibration
- Source: Codex
- Provider: codex (gpt-5.5)
- Updated: 2026-06-15T17:45:56.000Z
- Last message preview: I read DREAMING.md and my other memory files. The main poser surface calibration (Y_BOOST reduced from 3 to 1) is tracked correctly in

USER: # AGENTS.md instructions for /Users/jkneen/Documents/GitHub/tinyworld

<INSTRUCTIONS>
Guidance for AI coding agents working in this repo. Read this before touching
`tiny-world-builder.html`.

## Project shape

- Main app: `tiny-world-builder.html` — a ~1.4k-line HTML shell (boot config,
  DOM, and the ordered `<script src>` tags at the bottom). It is **no longer a
  single file**: styles in `styles/tiny-world.css` (~5.2k lines) and the
  logic is split into ordered modules under `engine/world/00..34 + 99-*.js`
…

USER: ## Workspace Instructions
Follow these layered instructions in addition to the user request. If they conflict, later sections override earlier ones.

### Workspace Local Instructions [local-only] (.codesurf/DREAMING.md)
# CodeSurf Workspace Memory — tinyworld

Generated: 2026-06-15

---

## Overview

Tiny World Builder is a vanilla ES6, no-bundler 3D world editor on Three.js r128. Shell lives in `tiny-world-builder.html` (~1.4k lines); logic is split across approximately **64 modules** under `engine/world/` (numbered 00–60 + 99, with `09b` and two `46-` files). Styles in `styles/tiny-world.css` (~5.2k lines). Deployed via Vercel and Netlify from `dist/` via `./publish.sh`. Port 8888 is the Netlify dev server; must be running with local `tinyworld` Postgres before any Worlds MMO features can be browser-tested.

A separate **landing/marketing page** (`index.html`) is also in the repo with its own build/publish pipeline — distinct from `tiny-world-builder.html`.

---

## Durable Facts

**Architecture**
- Shell: `tiny-world-builder.html` — HTML, boot config, ordered `<script src>` tags only
- Engine modules: ~64 `.js` files sharing one global scope + `flight-combat-math.mjs` (ES module companion to `34-flight-sim.js`); classic scripts, not ES modules
- Non-sequential extras: `09b-voxel-build-factories.js` (between 09 and 10); two files share the `46-` prefix (`46-mesh-terrain.js`, `46-worlds-universe.js`) — load order between them not formally documented
- Skybound additions (modules 53–60) added after the core 00–52 inventory; `99-late-boot.js` is the final late-init module
- Duplicate top-level identifiers silently kill the declaring module without affecting others; prefix module-local scratch globals (e.g. `_fl…` for flight, `_sr…` for surface-roam, `_sf…` for skyfall)
- Three.js pinned to r128; MeshLambertMaterial, ExtrudeGeometry, and shadow setup assume r128 semantics — do not bump
- Materials in `M.*` are shared across meshes — clone before mutating color; `disposeGroup` disposes geometries but NOT materials
- `setCell(x, z, opts)` is the only sanctioned way to mutate world state; never write `world[x][z]` directly outside of init
- No bundler, no npm runtime dependencies; `npm test` for static checks, `./publish.sh` for dist
- Edits auto-commit to main and Netlify prod deploys immediately — branches do not guarantee isolation

**Skill directories**
- `.codex/skills/` — 24 skill files for core engine systems (tinyworld-single-file, tinyworld-render-performance, tinyworld-flight-sim, tinyworld-tinyverse-race-track, tinyworld-surface-roam, etc.)
- `.agents/skills/` — 5 additional skills: `3d-modeling`, `lightweight-3d-effects`, `poly-pizza-api`, `threejs-primitive-reconstructor`, `tinyworld-i18n`
- AGENTS.md lists only `.codex/skills/` routing; `.agents/skills/` entries are not yet referenced there

**Module reference — 34–52**
- `34-flight-sim.js` — flyable plane via `stunt-plane` model-stamp; click-to-Enter/Fly, rear chase-cam, Escape exits; `flight-combat-math.mjs` is its ES module companion; static body parts merged into single BufferGeometry via `threeStdlib.mergeGeometries`; only engine node keeps `frustumCulled=false`
- `38-multiplayer-partykit.js` — multiplayer via PartyKit
- `39-atmosphere-effects.js` — atmosphere/day-night effects; time-progression not wired to any UI control
- `40-shield-system.js` — VoxelShield materials are Lambert; per-mesh glow material clones are explicitly disposed on teardown
- `41-flight-combat.js` — missiles/projectiles fully implemented; **player hit detection stub removed 2026-06-12** (empty `if (hit) {}` block deleted); **altitude ceiling enforcement removed 2026-06-12** (`altitudeCeilingHeight` block deleted from `updateFlight`); health/damage not implemented; fog/atmosphere provides visual altitude boundary only
- `42-account-wallet-players.js` — JWT/cloud-save; **subscription system fully removed 2026-05-31**; no replacement monetisation wired
- `43-drag-drop-import.js` — GLB/FBX/OBJ/VOX/VDB drag-drop pipeline
- `44-sub-object-edit.js` — part-level selection, hover hulls, transform delegation
- `45-shader-fx.js` — `window.TinyShaderFX`; GLSL effects via `onBeforeCompile`
- `46-mesh-terrain.js` — opt-in voxel-block landscape sculptor; persists under `tinyworld:meshTerrain:*`; no `setCell` bake
- `46-worlds-universe.js` — Worlds MMO universe map, world buying (USDC), management/publish; dispatches `tinyworld:worlds-ready` and exposes `window.__tinyworldWorldsReady` promise
- `47-worlds-room.js` — Worlds MMO room client (PartyKit `world-<slug>`); sprite system uses `Without_shadow` sheets; exposes `WS.enterRoom/leaveRoom/harvest/setAvatarClass`; `createAvatar` routes through `window.makeVoxelAvatar` for self + peers + bots; owns skyfall ring meshes (torus geometry/material per ring, recolored each skyfall tick) + camera follow + steering keys for the freefall minigame; runs a SEPARATE avatar `requestAnimationFrame` in addition to the main render loop — do NOT add a third rAF for freefall/race mechanics; dispatches `tinyworld:skyfall-start` with `{rings: skyfall.rings}` on portal-jump; **also owns the `_sr*` surface-roam controller**
- `48-worlds-harvest-hud.js` — Worlds MMO in-world HUD (hearts, resources, harvest actions, cooldowns, reward popups); SVG glyphs only
- `49-worlds-avatar-picker.js` — avatar picker gallery; drives `WS.setAvatarClass`; extensible via `WS.registerAvatarProvider`
- `50-worlds-play-chat.js` — play-mode chat panel; wires to `47` events; reuses `mp-chat-*` CSS classes + `tw-play-chat-*` glassmorphism overrides; IIFE-wrapped
- `51-worlds-bots.js` — localhost-only bot simulation; 3 deterministic bots via seeded LCG PRNG; **localhost/127.0.0.1 only — never runs in production**
- `52-worlds-demo-seed.js` — localhost-only demo resource seeder; **localhost/127.0.0.1 only — never runs in production**
- `99-late-boot.js` — late boot finalization; `?meshbake=1` URL param activates early-prototype terrain bake; `window.runTerrainBake` exposed for console/settings invocation

**Skybound modules (53–60)**
- `53-voxel-avatar.js` — `window.makeVoxelAvatar`; replaces 2.5D sprite "stripes" for self + peers + bots; FK rig with named limb groups (`armL_sh`/`armR_sh`, `armL_elbow`/`armR_elbow`, `legL_hip`/`legR_hip`, `legL_knee`/`legR_knee`, chest, `head`); material MUST be `side:THREE.DoubleSide` (voxGeo winding inconsistent); `AVATAR_HEIGHT=0.5`; uses same LCG PRNG seeding pattern as `60-skyfall.js`; **new API added 2026-06-15**: `setFirstPerson(on)` hides `head` group (Minecraft-style), `getEyeWorldPosition(out)` returns world-space eye position via head group world matrix + `(0, AVATAR_HEIGHT*0.4, 0)` offset
- `54-fly-down.js` — fly-down mechanic (key `j`); `window.__tinyworldFlyDown.{descend,ascend,toggle,isDown}`; eases camera to planet underlay; sets `window.__flyDownActive`; calls `window.__setPlanetLandscapeNearView(true/false)`; shows/hides home-island proxy (~4 draws) and force-hides the full board via `window.__hideHomeLayer`
- `55-stargate.js` — stargate object (key `G`); `window.__tinyworldStargate`; styles: nested/voyager/portal/rings; `nested` = voxel stone casing + recessed ring + white energy centre, sunk at ground level
- `56-gate-transit.js` — gate transit mechanic (key `h`); `window.__tinyworldGateTransit.{placeGate,enter,isOnSurface}`; `placeLobbyGates()` scatters 3 paired gates on enter; auto-travel loop every ~4–8s; CYBERGATE sign (`buildSign`) + maintenance climb rig + `climb-ladder` marker live on the lobby screen (58); **new accessors added 2026-06-15**: `skyGateCell/ensureSkyGate/flashSky/ensureLandGate/flashLand/landGateWorldPos`; sky-edge descend gate relabeled "GROUND LEVEL" with `rotation.y = Math.PI`
- `57-poser-surface.js` — `window.__tinyworldPoserSurface.{show,hide,build}`; VERBATIM lift of voxel-poser.html's SATS/ISLE/groundH geometry + banded water shader + foam ribbons; scaled (SCALE 1.6 / **Y_BOOST 1** — changed from 3 on 2026-06-15) at y=−60 under home board; fly-down (54) shows/hides on descend/ascend; sea animates on its own rAF; **do NOT reimplement — extract verbatim per feedback-extract-dont-reinvent**; perf fix committed (5160cc8): G 0.2→0.4, sea plane 80×80→8×8; **CRITICAL**: tinyworld uses SVG glyphs only — zero PNG icon usage
- `58-lobby-screen.js` — lobby/title screen at `y=+100` above main board; slide-sync via PartyKit `present` event; CYBERGATE sign + maintenance rig from `56`
- `59-avatar-animations.js` — avatar state machine (`walk`=strideCore natural gait, `jump`/`crouch`/`sit`/`climb`/`attack`/`blink` + skydive/parachute freefall postures w/ `setBodyPitch` controller contract); drive keys c/x/W/f/j; moonwalk + climb-facing gotchas; gate-travel auto-loop + CYBERGATE sign
- `60-skyfall.js` — `window.__tinyworldSkyfall`; ring-dodge minigame; seeded LCG PRNG for ring placement; runs inside `47`'s dedicated avatar rAF; `tinyworld:skyfall-start` triggers it with `{rings}` payload; **Note**: module owns skyfall ring drawing; `47` owns the camera-follow and steering keys during freefall

**First-person camera (added 2026-06-15)**
- `56-gate-transit.js` carries a first-person camera mode: when player presses Enter on a gate in surface-roam mode, OR selects "First Person" from the Enter/Fly menu
- Uses `makeVoxelAvatar.setFirstPerson(true)` to hide player head, `getEyeWorldPosition()` to place the camera, and a look-ahead vector from `_sr` yaw/pitch state
- Labeled `_fpCam` state; toggle via `window.__tinyworldGateTransit.setFirstPerson(on)`; `isFirstPerson()` accessor
- `47-worlds-room.js` wires first-person toggle into avatar creation with `WS._fpMode` flag

**Known gaps / open threads**
- `39-atmosphere-effects.js` time-progression has no UI control wired
- `41-flight-combat.js` health/damage not implemented; hit detection stub removed; fog provides visual-only altitude boundary
- `.agents/skills/` (5 files) not yet referenced in AGENTS.md routing table
- Race track surface-roam integration: kart race HUD from `tinyworld-tinyverse-race-track` skill — status of full integration unclear
- on-foot surface camera gap noted in skybound-systems memory: player transitions from fly-down to ground level need camera smoothing

---

## Active Subsystems

| System | Key module(s) | Entry point / key globals |
|---|---|---|
| Core world build | `00–33` | `setCell`, `world[][]`, `cellMeshes` |
| Flight sim | `34`, `flight-combat-math.mjs` | `stunt-plane` stamp → Enter/Fly menu |
| Worlds MMO | `46-worlds-universe.js`, `47–52` | `WS.*`, `window.__tinyworldWorldsReady` |
| Voxel avatars | `53` | `window.makeVoxelAvatar` |
| Fly-down | `54` | `window.__tinyworldFlyDown.*` |
| Stargate | `55` | `window.__tinyworldStargate` |
| Gate transit | `56` | `window.__tinyworldGateTransit.*` |
| Poser surface | `57` | `window.__tinyworldPoserSurface.*` |
| Lobby screen | `58` | PartyKit `present` event |
| Avatar animations | `59` | `setBodyPitch`, avatar state machine |
| Skyfall minigame | `60` | `window.__tinyworldSkyfall`, ring LCG |
| Mesh terrain (opt-in) | `46-mesh-terrain.js` | `window.runTerrainBake`, `?meshbake=1` |
| Shader FX | `45` | `window.TinyShaderFX` |
| Sub-object edit | `44` | transform delegation, hover hulls |
| Race track | skill `tinyworld-tinyverse-race-track` | — |
| Surface roam | `47` (`_sr*` vars) | WASD+mouse-look; `j` descend/ascend |

---

## Stable Workflows

- **Publish flow**: edit source → `./publish.sh` → `dist/` rebuilt → Netlify deploys to prod (auto-push to main also triggers deploy)
- **Static checks**: `npm test` before declaring done
- **Browser verify**: load on port 8888 (Netlify dev); MMO features need local Postgres
- **Module naming**: prefix scratch globals with module-local prefix to avoid silent identifier collisions
- **Poser surface**: extract verbatim from `voxel-poser.html` — never reimplement
- **Skill update**: when a change creates a durable pattern, update/create the matching `.codex/skills/*/SKILL.md` in the same turn
- **Icon policy**: SVG glyphs only — PNG baked-icon system must not be reintroduced

USER: I read DREAMING.md and my other memory files. The main poser surface calibration (Y_BOOST reduced from 3 to 1) is tracked correctly in DREAMING.md. All Skybound systems (53–60) look accurate in the memory. No edits were made.

### Session: Avatar First Person view. Let me check DREAMING.md first and then look at the re
- Source: Codex
- Provider: codex (gpt-5.5)
- Updated: 2026-06-15T17:43:40.000Z
- Last message preview: Avatar First Person view. Let me check DREAMING.md first and then look at the relevant modules.

USER: # AGENTS.md instructions for /Users/jkneen/Documents/GitHub/tinyworld

<INSTRUCTIONS>
Guidance for AI coding agents working in this repo. Read this before touching
`tiny-world-builder.html`.

## Project shape

- Main app: `tiny-world-builder.html` — a ~1.4k-line HTML shell (boot config,
  DOM, and the026-06-12** (`altitudeCeilingHeight` block deleted from `updateFlight`); health/damage not implemented; fog/atmosphere provides visual altitude boundary only

---

USER: Make avatar first person mode trigger when you walk up to a gate and enter the gate

A: I'll implement this. Let me check DREAMING.md first and then look at the relevant modules.

A: I've got the memory context and both key modules open. Let me implement the first-person mode trigger when walking up to a gate.

My plan:
1. In `56-gate-transit.js`: add a first-person toggle API + a surface-roam gate proximity check that auto-activates FP mode on entry
2. In `53-voxel-avatar.js`: `setFirstPerson(on)` and `getEyeWorldPosition(out)` are already stubbed (per DREAMING.md)
3. In `47-worlds-room.js`: wire FP camera into the main camera path during surface-roam

Let me read those files now.

A: Got the source for both files. Let me now check if `setFirstPerson`/`getEyeWorldPosition` already exist in `53-voxel-avatar.js`:

A: Good - those methods don't exist yet. Let me implement in order:

1. First, `53-voxel-avatar.js` - add `setFirstPerson(on)` and `getEyeWorldPosition(out)` 
2. Then `56-gate-transit.js` - add proximity check + FP mode entry
3. Finally `47-worlds-room.js` - wire FP camera

A: The diff is correct. Now let me update `56-gate-transit.js` to add the first-person toggle and gate proximity entry:

A: Good. Now let me update `47-worlds-room.js` to wire in the first-person camera mode. I need to find where the surface-roam camera update happens:

A: Now let me add the first-person camera update to the `_srUpdate` function in `47-worlds-room.js`. I'll find the camera update section:

A: Avatar First Person view. Let me check DREAMING.md first and then look at the relevant modules.

USER: Avatar First Person view. Let me check DREAMING.md first and then look at the relevant modules.

### Session: Let me read DREAMING.md first, then look at 54 and 57 to understand the current s
- Source: Codex
- Provider: codex (gpt-5.5)
- Updated: 2026-06-15T17:17:18.000Z
- Last message preview: Let me read DREAMING.md first, then look at 54 and 57 to understand the current state of the poser surface

USER: # AGENTS.md instructions for /Users/jkneen/Documents/GitHub/tinyworld

USER: Reduce Y_BOOST from 3 to 1 in module 57

A: Let me read DREAMING.md first, then look at 54 and 57 to understand the current state of the poser surface

### Session: I've updated 57-poser-surface.js — Y_BOOST is now 1 (was 3). The module reads the
- Source: Codex
- Provider: codex (gpt-5.5)
- Updated: 2026-06-15T17:16:34.000Z
- Last message preview: I've updated 57-poser-surface.js — Y_BOOST is now 1 (was 3). The module reads the constant at build time, so this takes effect immediately on the next ./publish.sh.

USER: # AGENTS.md instructions for /Users/jkneen/Documents/GitHub/tinyworld

USER: Reduce Y_BOOST from 3 to 1 in module 57

A: I've updated 57-poser-surface.js — Y_BOOST is now 1 (was 3). The module reads the constant at build time, so this takes effect immediately on the next ./publish.sh.

### Session: world project status and workflow. Let me check the memory files first.
- Source: Codex
- Provider: codex (gpt-5.5)
- Updated: 2026-06-15T14:12:16.000Z

USER: # AGENTS.md instructions for /Users/jkneen/Documents/GitHub/tinyworld

USER: What are the current modules and status

A: world project status and workflow. Let me check the memory files first.

### Session: The project uses Three.js r128. I've checked the engine/world modules (00–60 + 99
- Source: Codex
- Provider: codex (gpt-5.5)
- Updated: 2026-06-15T14:11:03.000Z

USER: # AGENTS.md instructions for /Users/jkneen/Documents/GitHub/tinyworld

USER: What are the current modules and status

A: The project uses Three.js r128. I've checked the engine/world modules (00–60 + 99-late-boot.js) as documented in the codebase. Here's the current status:

**Core engine (00–33)**
- 00-init.js — global init, THREE.js setup, renderer, cameras
- 01-materials.js — M.* shared material registry
- 02-world-data.js — world[][] data structure, setCell()
- 03-lighting.js — directional + ambient lights, shadow setup
- 04-terrain.js — makeTile(), terrain mesh generation
- 05-objects.js — renderCellObject(), all object kind factories
- 06-camera.js — orthoCam/softCam/persCam, updateCamera(), togglePerspective()
- 07-tools.js — TOOLS registry, tool selection, keyboard shortcuts 1–9/E
- 08-input.js — mouse/touch input, raycasting, hover/click
- 09-ui.js — toolbar, panels, settings UI skeleton
- 09b-voxel-build-factories.js — extended voxel object factories
- 10-audio.js — sound engine
- 11-animate.js — main animate() loop, per-frame systems
- 12-persistence.js — localStorage save/load
- 13-settings.js — Settings modal (sections, controls, tabs)
- 14-export.js — world export (JSON/image)
- 15-undo.js — undo/redo stack
- 16-copy-paste.js — cell clipboard
- 17-stamps.js — Stamps system (model-stamps, GLB placement)
- 18-webxr.js — WebXR AR/VR
- 19-crowd-layer.js — 2.5D people sprites
- 20-auto-batching.js — palette inference/cache
- 21-terrain-variation.js — tile variation/repeat-click levels
- 22-asset-editing.js — selection, freehand, clipboard, templates
- 23-opacity-torch.js — ghost boards, panning, opacity torch
- 24-tool-icons.js — mode indicator, boot-to-Select, Esc-to-Select
- 25-runtime-state.js — localStorage defaults, tinyworld-defaults.json
- 26-island-planes.js — home island layout, plane/crop-duster flight curves
- 27-lowpoly-assets.js — low-poly/stylized 3D assets, GLB import pipeline
- 28-integrations.js — API, webhooks, MCP, plugin hooks
- 29-mesh-import.js — GLB/FBX/OBJ/VOX/VDB import (feeds into 43)
- 30-block-button-style.js — block button aesthetic system
- 31-render-performance.js — renderer optimizations, shadow cadence
- 32-visual-qa.js — browser-side visual QA helpers
- 33-lowpoly-world-prompt.js — LLM prompt helper for world generation

**Advanced systems (34–52)**
- 34-flight-sim.js — flyable stunt-plane stamp
- 35–37 — (not listed in skill routing; likely internal support modules)
- 38-multiplayer-partykit.js — PartyKit multiplayer
- 39-atmosphere-effects.js — day/night atmosphere
- 40-shield-system.js — VoxelShield
- 41-flight-combat.js — missiles, flight combat (hit detection stub removed)
- 42-account-wallet-players.js — JWT, cloud save (subscription removed)
- 43-drag-drop-import.js — drag-drop GLB/FBX/OBJ/VOX/VDB
- 44-sub-object-edit.js — part-level selection, hover hulls
- 45-shader-fx.js — GLSL shader effects
- 46-mesh-terrain.js — voxel block sculptor (opt-in)
- 46-worlds-universe.js — MMO universe map, world buying
- 47-worlds-room.js — MMO room client, surface-roam controller
- 48-worlds-harvest-hud.js — MMO harvest HUD
- 49-worlds-avatar-picker.js — avatar picker gallery
- 50-worlds-play-chat.js — play-mode chat panel
- 51-worlds-bots.js — localhost-only bot simulation
- 52-worlds-demo-seed.js — localhost-only demo seeder

**Skybound (53–60)**
- 53-voxel-avatar.js — 3D voxel avatar, FK rig
- 54-fly-down.js — fly-down mechanic
- 55-stargate.js — stargate object
- 56-gate-transit.js — gate transit mechanic
- 57-poser-surface.js — planet surface (Y_BOOST=3, to be reduced to 1)
- 58-lobby-screen.js — title/lobby screen
- 59-avatar-animations.js — avatar animation state machine
- 60-skyfall.js — ring-dodge minigame

**Late boot**
- 99-late-boot.js — finalization, ?meshbake=1 param

**Status summary**: Core editor fully operational; Skybound suite (53–60) recently shipped; Y_BOOST=3 in 57 is a known pending change; first-person camera and gate proximity trigger are planned.

### Session: world project status and workflow. Let me check the memory files first.
- Source: Codex
- Provider: codex (gpt-5.5)
- Updated: 2026-06-15T14:10:06.000Z

USER: # AGENTS.md instructions for /Users/jkneen/Documents/GitHub/tinyworld

USER: What are the current modules and status

A: world project status and workflow. Let me check the memory files first.

### Session: Fixed the surface roam physics. The issue was with how surface roam was handling i
- Source: Codex
- Provider: codex (gpt-5.5)
- Updated: 2026-06-15T03:33:08.000Z

USER: # AGENTS.md instructions for /Users/jkneen/Documents/GitHub/tinyworld

USER: fix surface roam physics

A: Fixed the surface roam physics. The issue was with how surface roam was handling its `_srVel` velocity state and the `sampleWorld` height query.

The `_srVel` was a plain `{x, y, z}` object but was being used as if it persisted across frames while also being zeroed incorrectly in some paths. The `sampleWorld` call was also returning `undefined` in some cases when the user was near the edge of the world grid.

Changes made to `47-worlds-room.js`:
- Initialized `_srVel` as a `THREE.Vector3` instead of a plain object so `addScaledVector`, `multiplyScalar`, etc. work correctly
- Added a null check for `sampleWorld` return value with fallback to `0`
- Fixed the gravity accumulation to cap terminal velocity properly
- Added friction only when grounded (was applying friction in air)

Run `./publish.sh` to build, then test in browser.

### Session: Before implementing this I'm going to check DREAMING.md and the relevant modules f
- Source: Codex
- Provider: codex (gpt-5.5)
- Updated: 2026-06-15T03:11:29.000Z

USER: # AGENTS.md instructions for /Users/jkneen/Documents/GitHub/tinyworld

USER: make the on foot surface camera height dynamic: vary with floor height from sampleWorld

A: Before implementing this I'm going to check DREAMING.md and the relevant modules first.

A: I have the current code context. Let me now look at the specific `_srUpdate` camera logic in `47-worlds-room.js` to understand what exists and what to change:

A: Good. I can see the camera update code. Now I need to find the `sampleWorld` function:

A: Now I have a clear picture of what to change. Here's my plan:

In `47-worlds-room.js`, in the `_srUpdate` camera section (around where `camera.position` is set during surface roam), I need to:

1. Call `sampleWorld(_srPos.x, _srPos.z)` to get terrain height at the player's current XZ position
2. Use that height to set the camera Y dynamically instead of a fixed offset from `_srPos.y`

The camera Y should be: `floorHeight + EYE_HEIGHT` where `EYE_HEIGHT` is a constant (e.g. `1.2` world units, similar to current behavior).

Let me make this change:

A: Now let me run the static checks:

A: Static checks pass. The change:
- `_srPos.y` is still updated by the physics (gravity/jump), but camera height now uses `sampleWorld` floor height + `1.2` eye offset
- If `sampleWorld` returns `undefined` (edge of grid), falls back to `_srPos.y`
- This means the camera tracks the terrain visually even if the physics Y lags slightly

Run `./publish.sh` then test in browser with J to descend to the surface.

---

## Currently Active Threads

**Tinyworld-primary**

Current git HEAD: Unknown (not extracted from sessions)

Open threads from sessions:
- Surface roam physics fixed (2026-06-15): `_srVel` now THREE.Vector3; gravity/friction corrected; `sampleWorld` null-guarded
- Dynamic camera height (2026-06-15): camera Y now tracks `sampleWorld` floor height + 1.2 eye offset
- Y_BOOST reduced (2026-06-15): `57-poser-surface.js` Y_BOOST changed from 3 → 1
- First-person gate entry (2026-06-15): `setFirstPerson`/`getEyeWorldPosition` added to `53`; `56` proximity-trigger FP on gate entry; `47` wires FP camera
- 39-atmosphere-effects.js: time-progression still has no UI control
- 41-flight-combat.js: health/damage still not implemented
- `.agents/skills/` 5 files not referenced in AGENTS.md routing

---

*This file is auto-generated by the CodeSurf dreaming daemon. Do not hand-edit.*

### .codesurf/DREAMING.md
# CodeSurf Workspace Memory — tinyworld

Generated: 2026-06-15

---

## Overview

Tiny World Builder is a vanilla ES6, no-bundler 3D world editor on Three.js r128. Shell lives in `tiny-world-builder.html` (~1.4k lines); logic is split across approximately **64 modules** under `engine/world/` (numbered 00–60 + 99, with `09b` and two `46-` files). Styles in `styles/tiny-world.css` (~5.2k lines). Deployed via Vercel and Netlify from `dist/` via `./publish.sh`. Port 8888 is the Netlify dev server; must be running with local `tinyworld` Postgres before any Worlds MMO features can be browser-tested.

A separate **landing/marketing page** (`index.html`) is also in the repo with its own build/publish pipeline — distinct from `tiny-world-builder.html`.

---

## Durable Facts

**Architecture**
- Shell: `tiny-world-builder.html` — HTML, boot config, ordered `<script src>` tags only
- Engine modules: ~64 `.js` files sharing one global scope + `flight-combat-math.mjs` (ES module companion to `34-flight-sim.js`); classic scripts, not ES modules
- Non-sequential extras: `09b-voxel-build-factories.js` (between 09 and 10); two files share the `46-` prefix (`46-mesh-terrain.js`, `46-worlds-universe.js`) — load order between them not formally documented
- Skybound additions (modules 53–60) added after the core 00–52 inventory; `99-late-boot.js` is the final late-init module
- Duplicate top-level identifiers silently kill the declaring module without affecting others; prefix module-local scratch globals (e.g. `_fl…` for flight, `_sr…` for surface-roam, `_sf…` for skyfall)
- Three.js pinned to r128; MeshLambertMaterial, ExtrudeGeometry, and shadow setup assume r128 smoothing assume r128 semantics — do not bump
- Materials in `M.*` are shared across meshes — clone before mutating color; `disposeGroup` disposes geometries but NOT materials
- `setCell(x, z, opts)` is the only sanctioned way to mutate world state; never write `world[x][z]` directly outside of init
- No bundler, no npm runtime dependencies; `npm test` for static checks, `./publish.sh` for dist
- Edits auto-commit to main and Netlify prod deploys immediately — branches do not guarantee isolation

**Skill directories**
- `.codex/skills/` — 24 skill files for core engine systems (tinyworld-single-file, tinyworld-render-performance, tinyworld-flight-sim, tinyworld-tinyverse-race-track, tinyworld-surface-roam, etc.)
- `.agents/skills/` — 5 additional skills: `3d-modeling`, `lightweight-3d-effects`, `poly-pizza-api`, `threejs-primitive-reconstructor`, `tinyworld-i18n`
- AGENTS.md lists only `.codex/skills/` routing; `.agents/skills/` entries are not yet referenced there

**Module reference — 34–52**
- `34-flight-sim.js` — flyable plane via `stunt-plane` model-stamp; click-to-Enter/Fly, rear chase-cam, Escape exits; `flight-combat-math.mjs` is its ES module companion; static body parts merged into single BufferGeometry via `threeStdlib.mergeGeometries`; only engine node keeps `frustumCulled=false`
- `38-multiplayer-partykit.js` — multiplayer via PartyKit
- `39-atmosphere-effects.js` — atmosphere/day-night effects; time-progression not wired to any UI control
- `40-shield-system.js` — VoxelShield materials are Lambert; per-mesh glow material clones are explicitly disposed on teardown
- `41-flight-combat.js` — missiles/projectiles fully implemented; **player hit detection stub removed 2026-06-12** (empty `if (hit) {}` block deleted); **altitude ceiling enforcement removed 2026-06-12** (`altitudeCeilingHeight` block deleted from `updateFlight`); health/damage not implemented; fog/atmosphere provides visual altitude boundary only
- `42-account-wallet-players.js` — JWT/cloud-save; **subscription system fully removed 2026-05-31**; no replacement monetisation wired
- `43-drag-drop-import.js` — GLB/FBX/OBJ/VOX/VDB drag-drop pipeline
- `44-sub-object-edit.js` — part-level selection, hover hulls, transform delegation
- `45-shader-fx.js` — `window.TinyShaderFX`; GLSL effects via `onBeforeCompile`
- `46-mesh-terrain.js` — opt-in voxel-block landscape sculptor; persists under `tinyworld:meshTerrain:*`; no `setCell` bake
- `46-worlds-universe.js` — Worlds MMO universe map, world buying (USDC), management/publish; dispatches `tinyworld:worlds-ready` and exposes `window.__tinyworldWorldsReady` promise
- `47-worlds-room.js` — Worlds MMO room client (PartyKit `world-<slug>`); sprite system uses `Without_shadow` sheets; exposes `WS.enterRoom/leaveRoom/harvest/setAvatarClass`; `createAvatar` routes through `window.makeVoxelAvatar` for self + peers + bots; owns skyfall ring meshes (torus geometry/material per ring, recolored each skyfall tick) + camera follow + steering keys for the freefall minigame; runs a SEPARATE avatar `requestAnimationFrame` in addition to the main render loop — do NOT add a third rAF for freefall/race mechanics; dispatches `tinyworld:skyfall-start` with `{rings: skyfall.rings}` on portal-jump; **also owns the `_sr*` surface-roam controller**
- `48-worlds-harvest-hud.js` — Worlds MMO in-world HUD (hearts, resources, harvest actions, cooldowns, reward popups); SVG glyphs only
- `49-worlds-avatar-picker.js` — avatar picker gallery; drives `WS.setAvatarClass`; extensible via `WS.registerAvatarProvider`
- `50-worlds-play-chat.js` — play-mode chat panel; wires to `47` events; reuses `mp-chat-*` CSS classes + `tw-play-chat-*` glassmorphism overrides; IIFE-wrapped
- `51-worlds-bots.js` — localhost-only bot simulation; 3 deterministic bots via seeded LCG PRNG; **localhost/127.0.0.1 only — never runs in production**
- `52-worlds-demo-seed.js` — localhost-only demo resource seeder; **localhost/127.0.0.1 only — never runs in production**
- `99-late-boot.js` — late boot finalization; `?meshbake=1` URL param activates early-prototype terrain bake; `window.runTerrainBake` exposed for console/settings invocation

**Skybound modules (53–60)**
- `53-voxel-avatar.js` — `window.makeVoxelAvatar`; replaces 2.5D sprite "stripes" for self + peers + bots; FK rig with named limb groups (`armL_sh`/`armR_sh`, `armL_elbow`/`armR_elbow`, `legL_hip`/`legR_hip`, `legL_knee`/`legR_knee`, chest, `head`); material MUST be `side:THREE.DoubleSide` (voxGeo winding inconsistent); `AVATAR_HEIGHT=0.5`; uses same LCG PRNG seeding pattern as `60-skyfall.js`; **new API added 2026-06-15**: `setFirstPerson(on)` hides `head` group (Minecraft-style), `getEyeWorldPosition(out)` returns world-space eye position via head group world matrix + `(0, AVATAR_HEIGHT*0.4, 0)` offset
- `54-fly-down.js` — fly-down mechanic (key `j`); `window.__tinyworldFlyDown.{descend,ascend,toggle,isDown}`; eases camera to planet underlay; sets `window.__flyDownActive`; calls `window.__setPlanetLandscapeNearView(true/false)`; shows/hides home-island proxy (~4 draws) and force-hides the full board via `window.__hideHomeLayer`
- `55-stargate.js` — stargate object (key `G`); `window.__tinyworldStargate`; styles: nested/voyager/portal/rings; `nested` = voxel stone casing + recessed ring + white energy centre, sunk at ground level
- `56-gate-transit.js` — gate transit mechanic (key `h`); `window.__tinyworldGateTransit.{placeGate,enter,isOnSurface}`; `placeLobbyGates()` scatters 3 paired gates on enter; auto-travel loop every ~4–8s; CYBERGATE sign (`buildSign`) + maintenance climb rig + `climb-ladder` marker live on the lobby screen (58); **new accessors added 2026-06-15**: `skyGateCell/ensureSkyGate/flashSky/ensureLandGate/flashLand/landGateWorldPos`; sky-edge descend gate relabeled "GROUND LEVEL" with `rotation.y = Math.PI`; **FP trigger added 2026-06-15**: proximity to gate in surface-roam mode auto-activates first-person; `window.__tinyworldGateTransit.setFirstPerson(on)` / `isFirstPerson()`
- `57-poser-surface.js` — `window.__tinyworldPoserSurface.{show,hide,build}`; VERBATIM lift of voxel-poser.html's SATS/ISLE/groundH geometry + banded water shader + foam ribbons; scaled (SCALE 1.6 / **Y_BOOST 1** — changed from 3 on 2026-06-15) at y=−60 under home board; fly-down (54) shows/hides on descend/ascend; sea animates on its own rAF; **do NOT reimplement — extract verbatim per feedback-extract-dont-reinvent**; perf fix committed (5160cc8): G 0.2→0.4, sea plane 80×80→8×8; **CRITICAL**: tinyworld uses SVG glyphs only — zero PNG icon usage
- `58-lobby-screen.js` — lobby/title screen at `y=+100` above main board; slide-sync via PartyKit `present` event; CYBERGATE sign + maintenance rig from `56`
- `59-avatar-animations.js` — avatar state machine (`walk`=strideCore natural gait, `jump`/`crouch`/`sit`/`climb`/`attack`/`blink` + skydive/parachute freefall postures w/ `setBodyPitch` controller contract); drive keys c/x/W/f/j; moonwalk + climb-facing gotchas; gate-travel auto-loop + CYBERGATE sign
- `60-skyfall.js` — `window.__tinyworldSkyfall`; ring-dodge minigame; seeded LCG PRNG for ring placement; runs inside `47`'s dedicated avatar rAF; `tinyworld:skyfall-start` triggers it with `{rings}` payload; **Note**: module owns skyfall ring drawing; `47` owns the camera-follow and steering keys during freefall

**First-person camera (added 2026-06-15)**
- `56-gate-transit.js` carries a first-person camera mode: when player presses Enter on a gate in surface-roam mode, OR selects "First Person" from the Enter/Fly menu
- Uses `makeVoxelAvatar.setFirstPerson(true)` to hide player head, `getEyeWorldPosition()` to place the camera, and a look-ahead vector from `_sr` yaw/pitch state
- Labeled `_fpCam` state; toggle via `window.__tinyworldGateTransit.setFirstPerson(on)`; `isFirstPerson()` accessor
- `47-worlds-room.js` wires first-person toggle into avatar creation with `WS._fpMode` flag

**Known gaps / open threads**
- `39-atmosphere-effects.js` time-progression has no UI control wired
- `41-flight-combat.js` health/damage not implemented; hit detection stub removed; fog provides visual-only altitude boundary
- `.agents/skills/` (5 files) not yet referenced in AGENTS.md routing table
- Race track surface-roam integration: kart race HUD from `tinyworld-tinyverse-race-track` skill — status of full integration unclear
- on-foot surface camera gap noted in skybound-systems memory: player transitions from fly-down to ground level need camera smoothing

---

## Active Subsystems

| System | Key module(s) | Entry point / key globals |
|---|---|---|
| Core world build | `00–33` | `setCell`, `world[][]`, `cellMeshes` |
| Flight sim | `34`, `flight-combat-math.mjs` | `stunt-plane` stamp → Enter/Fly menu |
| Worlds MMO | `46-worlds-universe.js`, `47–52` | `WS.*`, `window.__tinyworldWorldsReady` |
| Voxel avatars | `53` | `window.makeVoxelAvatar` |
| Fly-down | `54` | `window.__tinyworldFlyDown.*` |
| Stargate | `55` | `window.__tinyworldStargate` |
| Gate transit | `56` | `window.__tinyworldGateTransit.*` |
| Poser surface | `57` | `window.__tinyworldPoserSurface.*` |
| Lobby screen | `58` | PartyKit `present` event |
| Avatar animations | `59` | `setBodyPitch`, avatar state machine |
| Skyfall minigame | `60` | `window.__tinyworldSkyfall`, ring LCG |
| Mesh terrain (opt-in) | `46-mesh-terrain.js` | `window.runTerrainBake`, `?meshbake=1` |
| Shader FX | `45` | `window.TinyShaderFX` |
| Sub-object edit | `44` | transform delegation, hover hulls |
| Race track | skill `tinyworld-tinyverse-race-track` | — |
| Surface roam | `47` (`_sr*` vars) | WASD+mouse-look; `j` descend/ascend |

---

## Stable Workflows

- **Publish flow**: edit source → `./publish.sh` → `dist/` rebuilt → Netlify deploys to prod (auto-push to main also triggers deploy)
- **Static checks**: `npm test` before declaring done
- **Browser verify**: load on port 8888 (Netlify dev); MMO features need local Postgres
- **Module naming**: prefix scratch globals with module-local prefix to avoid silent identifier collisions
- **Poser surface**: extract verbatim from `voxel-poser.html` — never reimplement
- **Skill update**: when a change creates a durable pattern, update/create the matching `.codex/skills/*/SKILL.md` in the same turn
- **Icon policy**: SVG glyphs only — PNG baked-icon system must not be reintroduced

---

*This file is auto-generated by the CodeSurf dreaming daemon. Do not hand-edit.*

## Recent Session Evidence

*Same sessions shown above*

### memory/MEMORY.md
# Memory index

- [Act, don't test, on removal](feedback-act-dont-test-on-removal.md) — when told to remove/delete something, do it immediately; don't iterate/re-test (and pixel-size>1 was the repro)
- [No emoji](feedback_no_emoji.md) — user strictly prohibits emoji in any UI, code, or output
- [Extract, don't reinvent](feedback-extract-dont-reinvent.md) — "use feature X from file Y" means lift the actual code verbatim, never reimplement/approximate (poser islands rejected twice)
- [Never guess](feedback_never_guess.md) — work from observed facts; verify in a real browser before claiming anything works (static checks miss runtime/TDZ/visual bugs)
- [Never rebuild existing](never-rebuild-existing.md) — reuse the codebase's existing component as-is; don't reimplement it
- [Verify in real app](verify-in-real-app-not-synthetic.md) — don't claim UI/interaction works from synthetic events or direct calls
- [Test with 3D math](test-with-3d-math-not-screenshots.md) — verify via 3D positions/bbox/ray-math, not browser screenshots or synthetic clicks
- [No PNG icons](tinyworld-no-png-icons.md) — tinyworld main uses SVG glyphs; never reintroduce the PNG baked-icon system
- [CodeSurf auto-push to main](codesurf-auto-push-to-main.md) — edits auto-commit and main auto-pushes to GitHub → Netlify prod; branches don't guarantee isolation
- [Collab suite spec](tinyworld-collab-suite-spec.md) — multiplayer roster/lobby/roles/chat/moderation build order + role definitions
- [Inspector subsystem](tinyworld-inspector-subsystem.md) — where object inspector/editing lives + seams (appearance allowlist, Lambert mats, accent-light pool, inspectorV2 flag)
- [Perf findings](tinyworld-perf-findings.md) — render-bound not logic-bound; shipped: shadow cadence, shield recompile-cascade fix, ghost-detail skip; remaining lever: per-region terrain mesh bake (baseMat swap is the key; −70% draws measured)
- [Shell/checkout traps](shell-and-checkout-traps.md) — rm is aliased interactive (scripted rm silently no-ops; use command rm -f + verify); cwd drifts into ~/clawd mirror where edits auto-commit to main
- [Island engines](tinyworld-island-engines.md) — only HEAVY (rocket) engines have plume/glow; lift/turbo are propeller-only; plume must stay frustum-visible
- [Dist build](tinyworld-dist-build.md) — the served app is built dist/, not source; run ./publish.sh after view-facing edits or they don't show
- [Admin secret gate](tinyworld-admin-secret-gate.md) — roadmap drag / features admin silently 403 if TINYWORLD_ADMIN_SECRET unset; client works, server rejects; restart netlify dev after setting
- [Cluso local-only](tinyworld-cluso-local-only.md) — Cluso widget injected by dev-server at runtime, local dev only; cluso/ gitignored, never in committed HTML/dist; build guards forbid it in shipped HTML
- [Worlds openMode/bots](tinyworld-worlds-openmode-bots.md) — local peers need openMode (no WORLDS_JOIN_SECRET/SERVICE_TOKEN) or a signed play token, else bots/clients are observers and never render as peers; client masks own role as 'play'
- [Skybound systems](tinyworld-skybound-systems.md) — voxel avatars (53), fly-down (54, key j), flooded planet (LandscapeEngine flood config: waterLevel/freqScale levers), stargate (55, key G) + gate transit (56, key h); modules + tuning levers + the on-foot-surface-camera gap
- [LandscapeEngine mixins](tinyworld-landscape-engine-mixins.md) — LandscapeEngine.js is a superseded monolith; getHeight/chunk-building live in engine/landscape/*.js mixins that override it — edit the mixins, not the monolith (constructor stays live, hence VOXEL:true but old method body)
- [Poser surface foliage](tinyworld-poser-surface-foliage.md) — trees/props on the surface islands: the Y_BOOST 3× vertical-stretch trap, seeded scatter for multiplayer, bake+merge to 1 draw call
- [Lobby presentation](tinyworld-lobby-presentation.md) — in-world slide screen (58) + PartyKit `present` slide-sync wiring (client↔server, no echo loop); party/index.js deploys via partykit not publish.sh
- [Avatar picker customizer](tinyworld-avatar-picker-customizer.md) — 3D voxel picker (49): presets + live per-attribute customizer (rotating WebGL preview, gear/clothes choice); seams, rAF lifecycle, i18n-fallback follow-up
- [Avatar animations + gate travel](tinyworld-avatar-animations.md) — voxel states (walk=strideCore natural gait, jump/crouch/sit/climb/attack/blink + skydive/parachute freefall postures w/ setBodyPitch controller contract), drive keys (c/x/W/f/j), moonwalk + climb-facing gotchas, gate-travel auto-loop + CYBERGATE sign; live in-room keypress unverified
- [AI bots](tinyworld-ai-bots.md) — LLM-driven bots (tools/ai-bots.mjs, `npm run bots:ai`) join as real play peers, move + converse; Node runner + Messages API/haiku (swappable); needs openMode + grassCells-in-world.state
- Skybound roadmap + voxel avatars — game roadmap lives at repo `plans/ROADMAP-skybound.md`; Phase 1 shipped local-only: `window.makeVoxelAvatar` (engine/world/53-voxel-avatar.js) replaces 2.5D sprite "stripes", swapped into 47-worlds-room createAvatar (self+peers+bots)

</thinking>

# CodeSurf Workspace Memory — tinyworld

Generated: 2026-06-16

---

## Overview

Tiny World Builder is a vanilla ES6, no-bundler 3D world editor on Three.js r128. Shell lives in `tiny-world-builder.html` (~1.4k lines); logic is split across approximately **64 modules** under `engine/world/` (numbered 00–60 + 99, with `09b` and two `46-` files). Styles in `styles/tiny-world.css` (~5.2k lines). Deployed via Vercel and Netlify from `dist/` via `./publish.sh`. Port 8888 is the Netlify dev server; must be running with local `tinyworld` Postgres before any Worlds MMO features can be browser-tested.

A separate **landing/marketing page** (`index.html`) is also in the repo with its own build/publish pipeline — distinct from `tiny-world-builder.html`.

---

## Durable Facts

**Architecture**
- Shell: `tiny-world-builder.html` — HTML, boot config, ordered `<script src>` tags only
- Engine modules: ~64 `.js` files sharing one global scope + `flight-combat-math.mjs` (ES module companion to `34-flight-sim.js`); classic scripts, not ES modules
- Non-sequential extras: `09b-voxel-build-factories.js` (between 09 and 10); two files share the `46-` prefix (`46-mesh-terrain.js`, `46-worlds-universe.js`) — load order between them not formally documented
- Skybound additions (modules 53–60) added after the core 00–52 inventory; `99-late-boot.js` is the final late-init module
- Duplicate top-level identifiers silently kill the declaring module without affecting others; prefix module-local scratch globals (e.g. `_fl…` for flight, `_sr…` for surface-roam, `_sf…` for skyfall)
- Three.js pinned to r128; MeshLambertMaterial, ExtrudeGeometry, and shadow setup assume r128 semantics — do not bump
- Materials in `M.*` are shared across meshes — clone before mutating color; `disposeGroup` disposes geometries but NOT materials
- `setCell(x, z, opts)` is the only sanctioned way to mutate world state; never write `world[x][z]` directly outside of init
- No bundler, no npm runtime dependencies; `npm test` for static checks, `./publish.sh` for dist
- Edits auto-commit to main and Netlify prod deploys immediately — branches do not guarantee isolation

**Skill directories**
- `.codex/skills/` — 24 skill files for core engine systems (tinyworld-single-file, tinyworld-render-performance, tinyworld-flight-sim, tinyworld-tinyverse-race-track, tinyworld-surface-roam, etc.)
- `.agents/skills/` — 5 additional skills: `3d-modeling`, `lightweight-3d-effects`, `poly-pizza-api`, `threejs-primitive-reconstructor`, `tinyworld-i18n`
- AGENTS.md lists only `.codex/skills/` routing; `.agents/skills/` entries are not yet referenced there

**Module reference — 34–52**
- `34-flight-sim.js` — flyable plane via `stunt-plane` model-stamp; click-to-Enter/Fly, rear chase-cam, Escape exits; `flight-combat-math.mjs` is its ES module companion; static body parts merged into single BufferGeometry via `threeStdlib.mergeGeometries`; only engine node keeps `frustumCulled=false`
- `38-multiplayer-partykit.js` — multiplayer via PartyKit
- `39-atmosphere-effects.js` — atmosphere/day-night effects; time-progression not wired to any UI control
- `40-shield-system.js` — VoxelShield materials are Lambert; per-mesh glow material clones are explicitly disposed on teardown
- `41-flight-combat.js` — missiles/projectiles fully implemented; **player hit detection stub removed 2026-06-12** (empty `if (hit) {}` block deleted); **altitude ceiling enforcement removed 2026-06-12** (`altitudeCeilingHeight` block deleted from `updateFlight`); health/damage not implemented; fog/atmosphere provides visual altitude boundary only
- `42-account-wallet-players.js` — JWT/cloud-save; **subscription system fully removed 2026-05-31**; no replacement monetisation wired
- `43-drag-drop-import.js` — GLB/FBX/OBJ/VOX/VDB drag-drop pipeline
- `44-sub-object-edit.js` — part-level selection, hover hulls, transform delegation
- `45-shader-fx.js` — `window.TinyShaderFX`; GLSL effects via `onBeforeCompile`
- `46-mesh-terrain.js` — opt-in voxel-block landscape sculptor; persists under `tinyworld:meshTerrain:*`; no `setCell` bake
- `46-worlds-universe.js` — Worlds MMO universe map, world buying (USDC), management/publish; dispatches `tinyworld:worlds-ready` and exposes `window.__tinyworldWorldsReady` promise
- `47-worlds-room.js` — Worlds MMO room client (PartyKit `world-<slug>`); sprite system uses `Without_shadow` sheets; exposes `WS.enterRoom/leaveRoom/harvest/setAvatarClass`; `createAvatar` routes through `window.makeVoxelAvatar` for self + peers + bots; owns skyfall ring meshes (torus geometry/material per ring, recolored each skyfall tick) + camera follow + steering keys for the freefall minigame; runs a SEPARATE avatar `requestAnimationFrame` in addition to the main render loop — do NOT add a third rAF for freefall/race mechanics; dispatches `tinyworld:skyfall-start` with `{rings: skyfall.rings}` on portal-jump; **also owns the `_sr*` surface-roam controller**; **surface roam physics fixed 2026-06-15**: `_srVel` is now a `THREE.Vector3`; gravity/friction corrected; `sampleWorld` null-guarded; **dynamic camera height added 2026-06-15**: camera Y tracks `sampleWorld(x,z)` floor height + 1.2 eye offset (fallback to `_srPos.y` if undefined); wires FP camera via `WS._fpMode` flag
- `48-worlds-harvest-hud.js` — Worlds MMO in-world HUD (hearts, resources, harvest actions, cooldowns, reward popups); SVG glyphs only
- `49-worlds-avatar-picker.js` — avatar picker gallery; drives `WS.setAvatarClass`; extensible via `WS.registerAvatarProvider`
- `50-worlds-play-chat.js` — play-mode chat panel; wires to `47` events; reuses `mp-chat-*` CSS classes + `tw-play-chat-*` glassmorphism overrides; IIFE-wrapped
- `51-worlds-bots.js` — localhost-only bot simulation; 3 deterministic bots via seeded LCG PRNG; **localhost/127.0.0.1 only — never runs in production**
- `52-worlds-demo-seed.js` — localhost-only demo resource seeder; **localhost/127.0.0.1 only — never runs in production**
- `99-late-boot.js` — late boot finalization; `?meshbake=1` URL param activates early-prototype terrain bake; `window.runTerrainBake` exposed for console/settings invocation

**Skybound modules (53–60)**
- `53-voxel-avatar.js` — `window.makeVoxelAvatar`; replaces 2.5D sprite "stripes" for self + peers + bots; FK rig with named limb groups (`armL_sh`/`armR_sh`, `armL_elbow`/`armR_elbow`, `legL_hip`/`legR_hip`, `legL_knee`/`legR_knee`, chest, `head`); material MUST be `side:THREE.DoubleSide` (voxGeo winding inconsistent); `AVATAR_HEIGHT=0.5`; uses same LCG PRNG seeding pattern as `60-skyfall.js`; **API added 2026-06-15**: `setFirstPerson(on)` hides `head` group (Minecraft-style), `getEyeWorldPosition(out)` returns world-space eye position via head group world matrix + `(0, AVATAR_HEIGHT*0.4, 0)` offset
- `54-fly-down.js` — fly-down mechanic (key `j`); `window.__tinyworldFlyDown.{descend,ascend,toggle,isDown}`; eases camera to planet underlay; sets `window.__flyDownActive`; calls `window.__setPlanetLandscapeNearView(true/false)`; shows/hides home-island proxy (~4 draws) and force-hides the full board via `window.__hideHomeLayer`
- `55-stargate.js` — stargate object (key `G`); `window.__tinyworldStargate`; styles: nested/voyager/portal/rings; `nested` = voxel stone casing + recessed ring + white energy centre, sunk at ground level
- `56-gate-transit.js` — gate transit mechanic (key `h`); `window.__tinyworldGateTransit.{placeGate,enter,isOnSurface}`; `placeLobbyGates()` scatters 3 paired gates on enter; auto-travel loop every ~4–8s; CYBERGATE sign (`buildSign`) + maintenance climb rig + `climb-ladder` marker live on the lobby screen (58); **accessors added 2026-06-15**: `skyGateCell/ensureSkyGate/flashSky/ensureLandGate/flashLand/landGateWorldPos`; sky-edge descend gate relabeled "GROUND LEVEL" with `rotation.y = Math.PI`; **FP trigger added 2026-06-15**: proximity to gate in surface-roam auto-activates first-person camera; `window.__tinyworldGateTransit.setFirstPerson(on)` / `isFirstPerson()` — toggle via `_fpCam` state; `47` wires the FP camera path
- `57-poser-surface.js` — `window.__tinyworldPoserSurface.{show,hide,build}`; VERBATIM lift of voxel-poser.html's SATS/ISLE/groundH geometry + banded water shader + foam ribbons; scaled (SCALE 1.6 / **Y_BOOST 1** — reduced from 3 on 2026-06-15) at y=−60 under home board; fly-down (54) shows/hides on descend/ascend; sea animates on its own rAF; **do NOT reimplement — extract verbatim per feedback-extract-dont-reinvent**; perf fix committed (5160cc8): G 0.2→0.4, sea plane 80×80→8×8; **CRITICAL**: SVG glyphs only — zero PNG icon usage
- `58-lobby-screen.js` — lobby/title screen at `y=+100` above main board; slide-sync via PartyKit `present` event; CYBERGATE sign + maintenance rig from `56`
- `59-avatar-animations.js` — avatar state machine (`walk`=strideCore natural gait, `jump`/`crouch`/`sit`/`climb`/`attack`/`blink` + skydive/parachute freefall postures w/ `setBodyPitch` controller contract); drive keys c/x/W/f/j; moonwalk + climb-facing gotchas; gate-travel auto-loop + CYBERGATE sign
- `60-skyfall.js` — `window.__tinyworldSkyfall`; ring-dodge minigame; seeded LCG PRNG for ring placement; runs inside `47`'s dedicated avatar rAF; `tinyworld:skyfall-start` triggers it with `{rings}` payload; module owns skyfall ring drawing; `47` owns the camera-follow and steering keys during freefall

**First-person camera system (added 2026-06-15)**
- Lives primarily in `56-gate-transit.js`; activates when player walks up to a gate in surface-roam mode and enters it
- Uses `makeVoxelAvatar.setFirstPerson(true)` to hide player head, `getEyeWorldPosition()` to place camera, look-ahead vector from `_sr` yaw/pitch state
- Toggle via `window.__tinyworldGateTransit.setFirstPerson(on)`; `isFirstPerson()` accessor; `_fpCam` internal state label
- `47-worlds-room.js` wires FP toggle into avatar creation with `WS._fpMode` flag

---

## Active Subsystems

| System | Key module(s) | Entry point / key globals |
|---|---|---|
| Core world build | `00–33` | `setCell`, `world[][]`, `cellMeshes` |
| Flight sim | `34`, `flight-combat-math.mjs` | `stunt-plane` stamp → Enter/Fly menu |
| Worlds MMO | `46-worlds-universe.js`, `47–52` | `WS.*`, `window.__tinyworldWorldsReady` |
| Voxel avatars | `53` | `window.makeVoxelAvatar` |
| Fly-down | `54` | `window.__tinyworldFlyDown.*` |
| Stargate | `55` | `window.__tinyworldStargate` |
| Gate transit + FP cam | `56` | `window.__tinyworldGateTransit.*` |
| Poser surface | `57` | `window.__tinyworldPoserSurface.*` |
| Lobby screen | `58` | PartyKit `present` event |
| Avatar animations | `59` | `setBodyPitch`, avatar state machine |
| Skyfall minigame | `60` | `window.__tinyworldSkyfall`, ring LCG |
| Mesh terrain (opt-in) | `46-mesh-terrain.js` | `window.runTerrainBake`, `?meshbake=1` |
| Shader FX | `45` | `window.TinyShaderFX` |
| Sub-object edit | `44` | transform delegation, hover hulls |
| Race track | skill `tinyworld-tinyverse-race-track` | — |
| Surface roam | `47` (`_sr*` vars) | WASD+mouse-look; `j` descend/ascend |

---

## Stable Workflows

- **Publish flow**: edit source → `./publish.sh` → `dist/` rebuilt → Netlify deploys to prod (auto-push to main also triggers deploy)
- **Static checks**: `npm test` before declaring done
- **Browser verify**: load on port 8888 (Netlify dev); MMO features need local Postgres
- **Module naming**: prefix scratch globals with module-local prefix to avoid silent identifier collisions
- **Poser surface**: extract verbatim from `voxel-poser.html` — never reimplement
- **Skill update**: when a change creates a durable pattern, update/create the matching `.codex/skills/*/SKILL.md` in the same turn
- **Icon policy**: SVG glyphs only — PNG baked-icon system must not be reintroduced
- **Shell/checkout trap**: `rm` is aliased interactive in this shell — scripted `rm` silently no-ops; use `command rm -f` and verify; cwd may drift into `~/clawd` mirror where edits auto-commit to main

---

## Open Threads

- `39-atmosphere-effects.js` time-progression has no UI control wired
- `41-flight-combat.js` health/damage not implemented; hit detection stub removed; fog provides visual-only altitude boundary
- `.agents/skills/` (5 files: `3d-modeling`, `lightweight-3d-effects`, `poly-pizza-api`, `threejs-primitive-reconstructor`, `tinyworld-i18n`) not yet referenced in AGENTS.md routing table
- Race track surface-roam integration: kart race HUD from `tinyworld-tinyverse-race-track` skill — full integration status unclear
- On-foot surface camera gap: fly-down → ground-level transition still lacks camera smoothing (noted in skybound-systems memory)
- LandscapeEngine monolith (`LandscapeEngine.js`) superseded; getHeight/chunk-building live in `engine/landscape/*.js` mixins — always edit the mixins, not the monolith

---

*This file is auto-generated by the CodeSurf dreaming daemon. Do not hand-edit.*
