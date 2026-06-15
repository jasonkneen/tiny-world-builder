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
- `53-voxel-avatar.js` — `window.makeVoxelAvatar`; replaces 2.5D sprite "stripes" for self + peers + bots; FK rig with named limb groups (`armL_sh`/`armR_sh`, `armL_elbow`/`armR_elbow`, `legL_hip`/`legR_hip`, `legL_knee`/`legR_knee`, chest, `head`); material MUST be `side:THREE.DoubleSide` (voxGeo winding inconsistent); `AVATAR_HEIGHT=0.5`; uses same LCG PRNG seeding pattern as `60-skyfall.js`; **new API added 2026-06-15**: `setFirstPerson(on)` hides `head` group (Minecraft-style), `getEyeWorldPosition(out)` returns world-space eye position
- `54-fly-down.js` — fly-down mechanic (key `j`); `window.__tinyworldFlyDown.{descend,ascend,toggle,isDown}`; eases camera to planet underlay; sets `window.__flyDownActive`; calls `window.__setPlanetLandscapeNearView(true/false)`; shows/hides home-island proxy (~4 draws) and force-hides the full board via `window.__hideHomeLayer`
- `55-stargate.js` — stargate object (key `G`); `window.__tinyworldStargate`; styles: nested/voyager/portal/rings; `nested` = voxel stone casing + recessed ring + white energy centre, sunk at ground level
- `56-gate-transit.js` — gate transit mechanic (key `h`); `window.__tinyworldGateTransit.{placeGate,enter,isOnSurface}`; `placeLobbyGates()` scatters 3 paired gates on enter; auto-travel loop every ~4–8s; CYBERGATE sign (`buildSign`) + maintenance climb rig + `climb-ladder` marker live on the lobby screen (58); **new accessors added 2026-06-15**: `skyGateCell/ensureSkyGate/flashSky/ensureLandGate/flashLand/landGateWorldPos`; sky-edge descend gate relabeled "GROUND LEVEL" with `rotation.y = Math.PI`
- `57-poser-surface.js` — `window.__tinyworldPoserSurface.{show,hide,build}`; VERBATIM lift of voxel-poser.html's SATS/ISLE/groundH geometry + banded water shader + foam ribbons; scaled (SCALE 1.6 / **Y_BOOST 1** — changed from 3 on 2026-06-15) at y=−60 under home board; fly-down (54) shows/hides on descend/ascend; sea animates on its own rAF; **do NOT reimplement — extract verbatim per feedback-extract-dont-reinvent**; perf fix committed (5160cc8): G 0.2→0.4, sea plane 80×80→8×8; **CRITICAL**: `sampleWorld`/`worldToLocal` must read `group.position.x/z` (stable, set once by `show()`) NOT `target.x/z` (camera rewrites it every frame) — wrong reference causes avatar height oscillation feedback loop; objects parented to the surface group inherit the `(SCALE, SCALE*Y_BOOST, SCALE)` stretch — counter it with `scale.set(NET/gs.x, NET/gs.y, NET/gs.z)`
- `58-lobby-presentation.js` — `window.__tinyworldLobby`; framed in-world screen at `z = -(GRID/2)-1`; 6×3.375 canvas-rendered slide deck (MeshBasicMaterial, unlit); built/shown on `WS.on('enter')`, hidden on `'leave'`; `[`/`]` keys + DOM bar for Prev/Next; multiplayer slide sync via `WS.present(idx)` → PartyKit `present` handler → broadcast to all admitted → `applySlide` (no echo loop — apply is local-only)
- `59-gate-travel-fx.js` — 5-stage gate-travel visual effect: magnetic pull → particle dissolve-in → portal flash → back-extrude → receiving edge-light+flash+emerge; THREE.Points (one draw call each); companion to `56-gate-transit.js`; particles read subtle at gameplay scale — tuning lever: bigger gates / particle size
- `60-skyfall.js` — freefall minigame; listens for `tinyworld:skyfall-start` event; contains position/vel simulation at 60fps, gravity + drag + lift, WASD/arrow-key steering, wind + turbulence, ring collision detection, ring-pass scoring, `_sfEndSkyfall()` callback; **wiring to `47-worlds-room.js` correct — verified 2026-06-12**; `startSkyfall()` now **early-returns false** (walk-off-edge trigger retired 2026-06-15); sim/ring scoring code untouched; tests still pass

**Skybound roadmap lives at `plans/ROADMAP-skybound.md`.**

**Flooded planet (distant backdrop)**: LandscapeEngine flood config at `27-landscape-engine.js ~562`: `{waterLevel:150, heightScale:0.45, freqScale:6}` ≈ 13% land. Levers: waterLevel ↑ = less land; freqScale ↑ = smaller/more islands.

**Descended view (ground-up)**: reframed to low near-sea vantage gazing up (DESCEND_POLAR 1.5, VIEW_SIZE 26, toTargetY −drop×0.5). Home board is force-hidden via `window.__hideHomeLayer`.

**LandscapeEngine**
- `LandscapeEngine.js` is superseded monolith; `getHeight`/chunk-building live in `engine/landscape/*.js` mixins — edit the mixins, not the monolith
- Constructor stays live (hence `VOXEL:true` but old method body)

**Worlds MMO namespace**
- `window.__tinyworldWorlds` (alias `WS`) shared across all Worlds modules; all IIFE-wrapped — no top-level globals leak
- `/api/worlds` lives at `netlify/functions/worlds.mjs`
- Worlds gameplay runs on PartyKit room server (separate from Netlify); Netlify-only deploy does NOT update room behavior — use `partykit deploy` for server changes
- `party/index.js` now has: (1) `present` handler for slide sync (rate-limited, clamped 0–999, broadcast to all admitted); (2) `grassCells` included in `world.state` snapshot (bots/joiners know standable cells); water removed from `rebuildBlocked`; lava + stone still blocked
- `party/index.js` contains a **hardcoded descriptor allowlist** for avatar fields; any new descriptor fields MUST be added to the allowlist in `party/index.js` alongside any client-side changes in `49-worlds-avatar-picker.js` and `53-voxel-avatar.js` — otherwise new fields are stripped at the server; `tests/party.test.mjs` is the verification harness

**30-ui-boot-wiring.js**
- 3,434 lines — NOT a thin delegation file; contains full cloud sync logic
- Key welcome-dialog functions: `initWelcomeDialog`, `openTinyverse` (async, waits for `window.__tinyworldWorlds.open`), `openBattleworlds` (sync stub, falls back to `chooseWelcomeMode('play')` if `window.__tinyworldBattleworlds.open` absent)
- `waitForWorldsFrontend()` polls every 50 ms for up to 2 s; also listens to `tinyworld:worlds-ready` event and `window.__tinyworldWorldsReady` promise as dual signals

**Avatar animations**
- Voxel avatar states: `walk` (strideCore natural gait — pow-1.3 chest bob, lateral sway, forward lean, 2× head bob, counter-arm swing, planar law-of-cosines IK `legIK`), `jump`, `crouch`, `sit` (POSES.Sit — direct angles, NOT legIK), `climb` (face rungs: `setHeading(0)`), `attack` (3 cycling sword swings), `blink`; **skydive/parachute freefall postures** (`setBodyPitch` controller contract)
- Walk GOTCHA (cost hours twice): rig hinge convention is **+hip.rotation.x → foot −z**; wrong fore/aft sign = MOONWALK. Verify via foot-trajectory measurement on ONE foot while planted
- Adding a state requires whitelisting it in `setState` or it silently collapses to idle
- Drive (in `47-worlds-room.js`, local-self only, gated `ent===selfEnt`): c=crouch-hold, x=sit-toggle, W-into-`climb-ladder`=climb (up/down W/S), f=attack, j=fly-down; heading from `setHeadingFromDelta(dxw,dzw)`
- Water is WALKABLE (deliberate, confirmed): `rebuildBlocked` and server `setWorldStateFromData` both exclude water; do NOT revert to grass-only
- Gate travel: walk avatar onto lobby-gate cell → `47` `tryEnterGate()` → `56.travelPlayer(cell, selfEnt.voxel, onArrive)` → dissolve→emerge at paired gate
- Peer-sync of crouch/sit/climb deferred — `move` carries only x,z

**AI bots (`tools/ai-bots.mjs`)**
- Run: `npm run bots:ai -- --slug <world> --bots 3 --mode both`
- Default brain: Anthropic Messages API with `claude-haiku-4-5`; `--provider openai --model gpt-5-mini` branch built-in
- Requires openMode (`WORLDS_JOIN_SECRET=` empty) — otherwise bots drop to observe
- Canned `51-worlds-bots.js` still auto-spawns on localhost alongside LLM bots — retirement deferred

**Test harnesses**
- `tests/party.test.mjs` — descriptor allowlist coverage for `party/index.js`
- `tests/flight-combat-math.test.mjs`, `tests/appearance-surface.test.mjs`, `tests/model-stamp-materials.test.mjs`, `tests/wallet-auth.test.mjs`, `tests/db-schema-errors.test.mjs` also exist
- `npm test` runs `tools/check.js` (static duplicate-identifier scan) + the test suite

---

## Surface Roam System (Shipped 2026-06-15)

The on-foot surface-camera gap is now closed. All state/funcs live inside `47-worlds-room.js` IIFE under `_sr*` prefix — never top-level globals.

**Core mechanics**
- Activates on J-descend: polls `window.__tinyworldFlyDown.state()` each rAF tick via `_srPollFlyDown` (no events); deactivates on J-ascend
- Camera-relative WASD walk + drag-look (hold LMB → `_srYaw`/`_srPitch`); Shift=sprint; Space/C=rise/sink in fly mode
- Ground height via `window.__tinyworldPoserSurface.sampleWorld(wx,wz)→{walkWorldY,localH,water}`
- Guards in `step()`/`updateSelfAvatar()`/`animVoxel`/`animEntity`/`updateAvatarCameraOrbit()` all check `selfEnt._srActive`
- HUD: `#tw-surface-roam-hud`; body class `surface-roam-fp` when first-person
- Speed consts: `SR_WALK`, `SR_SPRINT`, `SR_FLY_V`, `SR_CAM_DIST`, `SR_CAM_UP`, `SR_DRAG_SENS` in 47

**Enhancements shipped 2026-06-15**
- Wheel-zoom: `_srCamDist` now adjustable [SR_CAM_MIN 1.2 .. SR_CAM_MAX 14]; `_srOnWheel` bound with capture+passive:false
- Strafe fixed: right vector corrected to `(-cosY, sinY)` = cross(forward,up)
- First-person: zoom in past `SR_FP_THRESH` (1.6) or press **V** → `_srSetFirstPerson(true)`; widens `persCam.fov` to `SR_FP_FOV`=75 (was claustrophobic 28° telephoto), restores on exit; 53's `setFirstPerson(on)` hides head group (arms/torso visible Minecraft-style)
- Jump/fight: Space tap = jump arc (`SR_JUMP_H` 1.4 / `SR_JUMP_DUR` 0.46) + rig 'jump'; double-tap Space (`SR_DBL_MS` 320) = toggle fly; F = attack/swing; `_srStep` won't stomp 'attack'/'jump'
- Stargate round-trip: sky-edge gate (56 `placeGate`) → walk on = FlyDown.descend(); mainland gate (56 `ensureLandGate`) placed at surface-local 0,0 on `_srActivate`; proximity (`SR_GATE_R` 2.2) → FlyDown.ascend(); J still works as shortcut both directions

**Critical bug fixed**: `sampleWorld`/`worldToLocal` in 57 must read `group.position.x/z` (set once by `show()`) NOT `target.x/z` (camera overwrites every frame) — wrong ref caused avatar height oscillation

**Skill**: `.codex/skills/tinyworld-surface-roam/SKILL.md`

---

## Skyfall Minigame Status

Walk-off-edge freefall trigger **retired 2026-06-15** (user request). Islands now have solid edges:
- Off-rim freefall trigger removed from `47` `step()` (clamp no-ops past rim)
- `startSkyfall()` early-returns false — sim/ring scoring code kept but unreachable
- Debug 'k' leap removed
- Descent via stargate or J key only; ring course not accessible in current gameplay
- `60-skyfall.js` sim code untouched; tests still pass

---

## i18n System (as of 2026-06-14)

**Foundation built 2026-06-14 — JSON-based, English + Spanish**
- `engine/i18n/index.js` — `window.t(key, fallback)` resolver; locale detection via `sessionStorage` → `navigator.language` → `en`
- `engine/i18n/en.json` — namespaces: `toolbar` (7), `terrainEditor` (4), `worldsPanel` (20), `avatarPicker` (10), `partyChat` (6)
- `engine/i18n/es.json` — mirrors all en.json namespaces

**Wired modules**: `05-toolbar.js`, `19-terrain-editor.js`, `46-worlds-universe.js`, `47-worlds-room.js`, `49-worlds-avatar-picker.js`, `50-worlds-play-chat.js`

**Not yet wired**: settings panel, inspector/editing UI, flight UI, mesh terrain UI, skybound modules (53–60), majority of core modules (00–18, 20–33, 35–45, 48, 51–52, 99)

---

## Skybound Roadmap Status

Phases 1–9 shipped (verified 2026-06-12). Surface roam shipped 2026-06-15 (closes the on-foot gap from Phase 5/6).

- Phase 1 — Voxel Avatars (53) ✓
- Phase 2 — Fly-Down (54, key j) ✓
- Phase 3 — Stargate Object (55, key G) ✓
- Phase 4 — Gate Transit (56, key h) ✓
- Phase 5 — Poser Surface (57) ✓
- Phase 6 — Lobby Presentation (58) ✓
- Phase 7 — Gate Travel FX (59) ✓
- Phase 8 — Skyfall Minigame (60) ✓ (walk-off trigger retired; descent via gate/J only)
- Phase 9 — Flight Combat (41) ✓
- Surface Roam — `_sr*` in 47 ✓ (shipped 2026-06-15)
- **Phase 10 — Tinyverse Race Track — NEXT UP** (`plans/ROADMAP-skybound.md`, `.codex/skills/tinyworld-tinyverse-race-track`)

---

## Performance Findings (Committed)

- Frame is **render-bound not logic-bound** — `render.direct` ≈65ms/frame dominates, JS ticks <0.2ms; measure via `?perf=1&stats=1`; headless Chromium is SwiftShader (fill-rate-bound, ~10–17fps) — not representative
- **Shipped 2026-06-03**: merged engine static body + scoped frustum culling → draw calls 2880→1673 (−42%), frustum-cull-disabled 1360→61
- **Shipped 2026-06-09/10**: shadow map 30Hz cadence; VoxelShield flicker via intensity only (toggling `.visible` per-frame causes r128 shader recompile cascade — progs 27→260 measured); Shield materials Standard→Lambert; waterFoam opaque; ghost-board cells skip surface-detail instancing
- **Shipped (5160cc8)**: poser planet G 0.2→0.4, sea plane 80×80→8×8 → descended tris 673k→407k, render 66.8ms→19.9ms
- **Shipped (f11350f)**: cloud-sea veil fix — `cloudSeaMesh.visible` gates on opacity>0.003
- **Remaining unshipped lever**: per-region terrain mesh bake; measured −70% draws (144-cell world 399→117); BLOCKER: `prepareFadeable` keeps `transparent:true` even at opacity 1 (`keepFadeAtOpacity`); bake must swap each mesh to `userData.baseMat` first; `?meshbake=1` flag-gated prototype
- **Descended view**: home island still renders ~1600 draw calls (orbit-centred, frustum culling cannot remove); explicit hide/LOD-on-descend is the remaining fix
- **Skyfall ring constraint**: 6 rings acceptable; expanded multi-ring course should share one geometry/material pair

---

## Active Workflows and Capabilities

- **Publish flow**: edit source → `./publish.sh` → `dist/` updated → Netlify serves updated prod; skipping publish.sh means changes invisible in browser
- **PartyKit deploy**: `partykit deploy` for `party/index.js` server changes — does NOT go through `./publish.sh`; locally workerd on :1999 hot-reloads on save
- **Admin gate**: `TINYWORLD_ADMIN_SECRET` env var must be set and `netlify dev` restarted; without it, roadmap drag and features admin silently 403
- **Cluso widget**: injected by dev-server at runtime only; `cluso/` gitignored; build guards forbid it in shipped HTML; never commit Cluso code
- **Shell/checkout traps**: `rm` is aliased interactive (scripted `rm` silently no-ops; use `command rm -f` and verify); cwd drifts into `~/clawd` mirror where edits auto-commit to main — always use absolute paths
- **Worlds MMO local dev**: port 8888 Netlify dev server + local `tinyworld` Postgres; `openMode` required for local peers or signed play token; without it bots/clients are observers only
- **CodeSurf multi-agent**: register with `mcp__contex__peer_set_state` + `peer_get_state` on every session start; coordinate before editing shared files via `peer_send_message`; `mcp__contex__peer_*` tools NOT available in all session types (Codex/GPT sessions may lack contex access)
- **Lobby presentation deploy**: `58-lobby-presentation.js` ships via `./publish.sh`; `party/index.js` `present` handler ships via `partykit deploy`
- **DGX GPU server** (`192.168.4.104:8003`) — unreachable as of 2026-06-15; VibeClaw wallpaper and article hero image generation skipped; check before scheduling image generation tasks

---

## Open Threads

- **Phase 10 — Tinyverse Race Track** — not started; see `plans/ROADMAP-skybound.md` and `.codex/skills/tinyworld-tinyverse-race-track`; must attach to `window.__tinyworldPoserSurface` group, must not add a third rAF or mutate editable-island cells
- **Surface-roam feel-tune** — `_srEyeH` (FP eye height multiplier), wheel zoom step, `SR_JUMP_H` are estimated values; need live user-channel tuning (browser automation flaky; user is the live channel per verify-in-real-app-not-synthetic)
- **Lobby gate repositioning** — user wants the inner lobby gate moved "up toward the tree"; `placeLobbyGates()` currently random-scatters 3 gates; needs specific target position from user before implementing
- **i18n coverage gaps** — settings panel, inspector/editing UI, flight UI, mesh terrain UI, skybound modules (53–60), and most core modules (00–18, 20–33, 35–45, 48, 51–52, 99) still use hardcoded English; only 6 modules wired
- **Skyfall end-of-run UX** — simulation + ring scoring complete; no end-of-run summary screen or persistent leaderboard; descent via gate/J only (walk-off trigger retired)
- **Flight combat health/damage** — missiles/projectiles implemented; player hit detection stub removed 2026-06-12; health/damage system not built
- **Altitude boundary** — ceiling enforcement removed 2026-06-12; fog/atmosphere provides visual boundary only; no soft speed-damping
- **Avatar descriptor extension** — MUST update `party/index.js` allowlist + `tests/party.test.mjs` + `49-worlds-avatar-picker.js` + `53-voxel-avatar.js` atomically when adding new descriptor fields
- **Subscription system removal** — removed from `42-account-wallet-players.js` 2026-05-31; no replacement monetisation wired
- **Poser surface perf — remaining** — per-region terrain mesh bake (baseMat swap, −70% draws measured); `userData.baseMat` swap prerequisite not automated; `?meshbake=1` is prototype only
- **Descended view draw calls** — home island still renders ~1600 calls at orbit-centre; explicit hide/LOD-on-descend not built
- **`.agents/skills/` not in AGENTS.md routing** — 5 skills exist under `.agents/skills/` but AGENTS.md only documents `.codex/skills/` routing
- **Party/index.js `grassCells` + `present` handler** — verified locally; `partykit deploy` needed to propagate to prod
- **`openBattleworlds`** — sync stub in `30-ui-boot-wiring.js`, falls back to `chooseWelcomeMode('play')`; Battleworlds mode not fully wired
- **Peer-sync of crouch/sit/climb** — deferred; `move` carries only x,z; peer avatars do not mirror these states
- **Gate-travel FX (59) particle tuning** — particles subtle at gameplay scale; open lever: bigger gates / scaled particle size
- **Lobby presentation admin** — any admitted peer can advance slides; no owner-only gate; follow-up via `ownerProfileId`
- **Canned `51-worlds-bots.js`** — still auto-spawns on localhost alongside LLM bots; retirement deferred
- **Time-progression in `39-atmosphere-effects.js`** — not wired to any UI control
- **`46-` prefix load-order** — `46-worlds-universe.js` and `46-mesh-terrain.js` share prefix; load order not formally documented in AGENTS.md
- **Distant sea hazes at grazing angles** — noted during surface roam; no fix yet
