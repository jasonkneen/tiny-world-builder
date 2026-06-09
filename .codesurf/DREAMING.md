# CodeSurf Workspace Memory — tinyworld

Generated: 2026-06-09

---

## Overview

Tiny World Builder is a vanilla ES6, no-bundler 3D world editor built on Three.js r128. The app shell lives in `tiny-world-builder.html` (~1.4k lines); business logic is split across 53+ `.js` modules under `engine/world/` plus `flight-combat-math.mjs` (ES module companion). Styles in `styles/tiny-world.css` (~5.2k lines). Deployed via Vercel and Netlify from `dist/` produced by `./publish.sh`.

---

## Durable Facts

**Architecture**
- Primary file: `tiny-world-builder.html` — HTML shell, boot config, ordered `<script src>` tags only
- Engine modules: 53+ numbered `.js` files sharing one global scope + `flight-combat-math.mjs` (ES module, not a classic script)
- Two modules share the `46-` prefix: `46-mesh-terrain.js` and `46-worlds-universe.js` — load order between them not formally documented
- Duplicate top-level identifiers silently kill the declaring module without affecting others; prefix module-local scratch globals (e.g. `_fl…` for flight)
- Three.js pinned to r128; `MeshLambertMaterial`, `ExtrudeGeometry`, shadows assume r128 semantics
- Materials in `M.*` are shared across meshes — clone before mutating color; `disposeGroup` disposes geometries but not materials
- `setCell(x, z, opts)` is the only sanctioned way to mutate world state; never write `world[x][z]` directly outside init
- No bundler, no npm runtime dependencies; `npm test` for static checks, `./publish.sh` for dist
- Netlify dev runs on port 8888; `NETLIFY_DATABASE_URL` must point to local `tinyworld` Postgres database
- Edits auto-commit to main and Netlify prod deploys immediately — branches do not guarantee isolation

**Module reference — modules 34 and above**
- `34-flight-sim.js` — flyable plane via existing `stunt-plane` model-stamp; click-to-Enter/Fly, rear chase-cam, Escape exits; `flight-combat-math.mjs` is its ES module companion
- `38-multiplayer-partykit.js` — multiplayer via PartyKit
- `39-atmosphere-effects.js` — atmosphere/day-night effects; time-progression not wired to any UI control
- `40-shield-system.js` / `41-flight-combat.js` — shield and combat systems
- `42-account-wallet-players.js` — JWT/cloud-save; subscription system fully removed 2026-05-31
- `43-drag-drop-import.js` — GLB/FBX/OBJ/VOX/VDB drag-drop pipeline
- `44-sub-object-edit.js` — part-level selection, hover hulls, transform delegation
- `45-shader-fx.js` — `window.TinyShaderFX`; GLSL effects (water, waterfalls, foam, smoke, explosions, wear overlay via `onBeforeCompile`)
- `46-mesh-terrain.js` — opt-in voxel-block landscape sculptor; persists under `tinyworld:meshTerrain:*`; no `setCell` bake
- `46-worlds-universe.js` — Worlds MMO universe map, world buying (USDC), world management/publish; hands off to 47/48
- `47-worlds-room.js` — Worlds MMO room client (PartyKit `world-<slug>`); sprite system uses `Without_shadow` sheets; movement sectors → front/right/back/left facing rows (no fake mirroring); exposes `WS.enterRoom/leaveRoom/harvest/setAvatarClass`
- `48-worlds-harvest-hud.js` — Worlds MMO in-world HUD (hearts, resources, harvest actions, cooldowns, reward popups); SVG glyphs only; chat reuses existing mp-chat panel
- `49-worlds-avatar-picker.js` — avatar picker gallery; drives `WS.setAvatarClass`; extensible via `WS.registerAvatarProvider` for future `@open-pets/client` pets

**Worlds MMO namespace**
- `window.__tinyworldWorlds` (alias `WS`) shared across all four Worlds modules (46-universe, 47-room, 48-hud, 49-picker); all four are IIFE-wrapped — no top-level globals leak

---

## Shipped Features

**Welcome dialog 4-mode rewrite (2026-06-09)**
- `tiny-world-builder.html` line 765: four mode buttons — Tinyverse, Battleworlds, Build, Play
- `engine/world/30-ui-boot-wiring.js` line 5: Tinyverse opens the Worlds overlay; Build/Play use existing mode API; Battleworlds calls `window.__tinyworldBattleworlds.open()` if it exists
- `window.__tinyworldBattleworlds` namespace referenced but no dedicated module confirmed; guard on `.open()` presence suggests it may be a future or optional module

**Voxel window interior-mapping glass (2026-06-06, PRs #24–#29)**
- `M.windowInterior` — `ShaderMaterial` parallax interior; per-pane uniforms `uTint/uDark/uBright/uReflect/uInteriorBright/uLit`
- Global config `window.__tinyworldWindow`; `setActiveWindowOverride` / `_activeWindowOverride`; `windowGlassRatio(override)`
- Settings → Materials → "Building windows"; per-object inspector controls; interior panes excluded from batcher
- Window frame occlusion and steep-angle ortho interior fix landed (f307e05)

**Model stamp import formats**
- `glb/gltf` (primary), `fbx` (`FBXLoader.r128.js`), `vox` (MagicaVoxel), `obj` (rainbow fallback), `vdb` (`VDBLoader.r128.js`; `vdbGridSpec()` + `vdbToMesh()`; frame sequence auto-detection via `vdbSequenceKey()`)

---

## Active Workflows

**Boot sequence (CodeSurf sessions)**
- `mcp__contex__peer_set_state` then `mcp__contex__peer_get_state` must be called before any work; Contex MCP tools may be absent in Codex sub-sessions (gracefully skip)

**UI wiring convention**
- New top-level mode entry points go through `30-ui-boot-wiring.js`; keep the boot file thin (delegation only, not logic)

**Pre-merge checklist**
- `npm test` passes; no console errors on load; keyboard shortcuts `1`–`9`, `E`, `R`, `F`, `C` work; perspective toggle; fence neighbor geometry updates; house cluster shapes; smoke from chimneys after landing

---

## Open Threads

- `window.__tinyworldBattleworlds` referenced from `30-ui-boot-wiring.js` but no corresponding module confirmed; guard is in place but system may be a stub
- AGENTS.md skill routing stale: modules 38–45, `46-worlds-universe`, `47-worlds-room`, `48-worlds-harvest-hud`, `49-worlds-avatar-picker` have no `.codex/skills/` routing entries
- `tinyworld-ghost-world-gen` and `threejs-primitive-reconstructor` skills exist on disk but absent from AGENTS.md routing
- Four liftable fork items remain unapplied: schema validation, URL param world loading, minimap touch-action, `publish.sh` data copy
- `39-atmosphere-effects.js` — day-night time-progression not wired to any UI control
- Window interior system has no `.codex/skills/` entry yet
- `49-worlds-avatar-picker.js` planned `@open-pets/client` provider integration not yet started
- OpenClaw gateway agent (`mc-gateway-894a3d5b`) is failing every heartbeat with connection refused — persistent across recent sessions; needs env/port check
- OpenClaw cron jobs (VibeClaw wallpaper/article/skills-scout generators, urgent-email-alert, Tom Doerr tweet tracker) are producing `[assistant turn failed before producing content]` on multiple consecutive runs — infrastructure issue unrelated to tinyworld codebase
