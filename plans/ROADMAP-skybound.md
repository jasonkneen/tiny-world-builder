# TinyWorld → Skybound: Multiplayer & Multi-Agentic Game Roadmap

_Authored 2026-06-14. Grounded in a 6-reader parallel deep-read of the live codebase + `voxel-poser.html`. Every seam below is a real file:line, verified against source. This is a multi-session plan; one vertical slice ships per session._

---

## 1. The Vision

The sea has taken over the planet. Scattered pockets of land survive — islands where survivors scavenge, forage, and build settlements. Some find **artifacts** that let them lift their island into the sky as a floating world. The game is the loop between the two layers:

- **Up in the sky:** your floating island(s) — build, defend, fly between worlds, battle other players (cannons, weapons), expand.
- **Down on the surface:** a sea-covered planet with land islands and NPC settlements — fly down, land, forage/mine, meet survivors (voxel NPCs), recover artifacts, recruit.
- **The people:** real voxel avatars (not 2.5D sprite "stripes") — for you, for every other player, and for NPCs/agents.
- **Multi-agentic:** NPCs and AI agents inhabit settlements and worlds as first-class voxel actors with their own behavior.

---

## 2. Current State (what already exists — do not rebuild)

| Pillar | Status | Where |
|---|---|---|
| Floating islands | **Solid.** `editableIslands[]`, free 3D placement, LOD, warp-in, moorings, undersides, engines | `14-editable-islands-moorings.js`, `13-distant-dressing-ghost.js`, `37-island-placement-holos.js` |
| **Sea+land planet surface** | **EXISTS** — streaming procedural terrain + ocean + biomes at `y=-drop` below islands | `27-landscape-engine.js` (`initPlanetLandscape`), `LandscapeEngine.js` |
| Flight | Arcade plane, sim-space physics, chase cam (FAR 600) | `34-flight-sim.js` |
| Multiplayer transport | **Solid.** PartyKit; presence/cells/chat/host-lobby-moderation; security-hardened | `38-multiplayer-partykit.js`, `party/index.js` |
| Worlds MMO (server-authoritative) | **Solid.** Server owns positions/hearts/nodes; 5s tick; signed-token join; Postgres flush | `party/index.js` (`onWorldMessage`), `47-worlds-room.js`, `netlify/functions/worlds*.mjs` |
| Harvest economy | **Solid.** fish/meat/plants/ore + land ownership + tax split | `party/index.js` (harvest lifecycle), `world-resources.mjs` |
| Combat | Plane guns + 6 homing missiles + destructible scenery + lock/HUD | `41-flight-combat.js`, `flight-combat-math.mjs` |
| People (avatars) | 2.5D **sprite billboards** ("stripes") for self/peers/bots + ambient crowd | `47-worlds-room.js` (`createAvatar`), `11-vehicle-crowd.js`, `vendor/tiny-crowd-layer.js` |
| Voxel character source | **Full voxel poser** — mesher, IK, ragdoll, skin/outfit/gear data, JSON serialization | `voxel-poser.html` (r128, standalone) |

**Build facts:** dev-server (`npm run dev`, :3000) serves **source** live — no build step to iterate locally. `publish.sh` → `dist/` is the prod artifact (Netlify). `tools/check.js` **fails the build on any duplicate top-level identifier** across `engine/world/*.js` (shared global scope) — new modules use an **IIFE** + `window.__*` exposure. New module = `engine/world/NN-*.js` + one `<script defer>` tag before `99-late-boot.js`.

---

## 3. The Gaps (what's missing for the vision)

1. **Voxel people.** No `makeVoxelAvatar()` exists. Everyone is a sprite. Per-player avatar identity is **not networked** (every peer/bot renders as the local default).
2. **Fly-down.** The planet exists but is unreachable: flight collision is planet-blind (`flightSurfaceAtScene` only tests island cells), main camera `far=200` clips the planet at `drop≥100`, orbit target is clamped to the home board. Only a dev "proof view" descends.
3. **Settlements / NPCs on the surface.** Planet is procedural but non-interactive — no settlements, no survivors, no landing/walking.
4. **Real battles.** PvP is client-authoritative honor-system (no shared HP — `isAlive()` hardcoded true; no kills/teams/modes/scoring/respawn). Shield "guns" are cosmetic.
5. **Crafting loop.** No inventory item table, no recipes, no resource *spend* path (resources are add-only), no resource-gated building. `gold` is declared but dead.
6. **Multi-agentic NPCs.** No AI-driven voxel actors; bots are headless peers rendering as the default sprite.

---

## 4. Key Architecture Decisions (forks + recommendations)

- **D1 — Avatars: encapsulate, don't copy.** voxel-poser renders ONE character (global singleton state). Extract the *pure* primitives (`voxGeo`, `hash3`, `fill`, `shade`, skin palettes, `buildParts`/`buildHeadMap` parameterized by `cfg`) into a per-instance `makeVoxelAvatar(descriptor) → THREE.Group`. Cache geometry by skin-hash; clone-share geometry across identical avatars (the onion-skin pattern at `voxel-poser.html:2779`). **v1 ships a static-mesh humanoid with a procedural walk cycle (rotate limbs); IK/ragdoll is a later phase** — the priority is the voxel *look*, animated convincingly.
- **D2 — Surface: reuse the existing planet.** Do NOT port voxel-poser's flat 150×150 sea. Reuse `initPlanetLandscape` / `LandscapeEngine`. The work is the **fly-down** (camera far + descent + flight collision) and then **settlements/NPCs** placed on `LandscapeEngine.getHeight()`.
- **D3 — Battles: a third authoritative room type.** Model a `battle-<id>` room on `isWorldRoom` (server-owned HP/kills/respawn/scoring) rather than hardening the client-trusting `combat.hit` relay. Reuse the entity-ghost transport for positions.
- **D4 — Crafting: swap the inventory model first.** Add a `player_items(profile_id, item_key, qty)` table (or JSONB) + an atomic check-and-debit spend path. Recipes can start as a static server const. Decide auth: PartyKit-flushed (like harvest) vs. a new player-auth endpoint.
- **D5 — Networked avatar identity.** Add an `avatar` descriptor field to `world.join` + presence (`party/index.js`) so peers/bots render their own voxel skin. This unblocks D1 from "global style" to "per-player identity."

---

## 5. Phased Roadmap (each phase = one shippable vertical slice)

### Phase 1 — Voxel Avatars replace Stripes  ✅ SHIPPED (2026-06-14, local-only, not pushed)
*Foundation for everyone (players, NPCs, settlers, combatants).*

**Polish round 2 (2026-06-14):** see-through fixed via `side: THREE.DoubleSide` on the avatar material (user-confirmed; inconsistent voxGeo winding exposed at the iso angle). Height `0.62 → 0.5` (still read too tall). Grounding: `placeEntity` now plants voxel feet on the **actual per-cell tile top** (`voxelGroundY` reads `cellMeshes[x,z].tile` bbox) instead of a flat `y=0.02` (avatars were floating/sinking over varying terrain). **Tweening:** voxel avatars now GLIDE between tiles (`animVoxel` lerps toward a target at 1.8 u/s, walk cycle while moving + idle on arrival, heading faces travel), and the camera follows the rendered (tweened) position. **Other players visibility:** local dev needs the PartyKit server in **openMode** (no `WORLDS_JOIN_SECRET`/`WORLDS_SERVICE_TOKEN`) — otherwise the dev bots join as observers and never move/appear (see [[tinyworld-worlds-openmode-bots]]); run `npx partykit dev party/index.js --port 1999 --var WORLDS_JOIN_SECRET= --var WORLDS_SERVICE_TOKEN=`.

**Scale + motion tuning (2026-06-14):** `AVATAR_HEIGHT` 1.7 → **0.62** (a door is 0.48 tall, `TILE=1`, house ~1.4; 1.7 dwarfed the architecture). Walk amplitudes cut (`walkLimb` 0.85→0.42, `walkKnee` 0.9→0.55) — the old large stride flung the thin limbs far in z, which an isometric camera projects as "scatter" (the rig was always connected; verified contiguous). Verified: rest 0.62 (1.29× door), walk peak depth 0.27 (was 1.06).

**Done:** `engine/world/53-voxel-avatar.js` (IIFE) → `window.makeVoxelAvatar({seed})` builds a per-instance humanoid voxel `THREE.Group` (ported `voxGeo` mesher + skin/outfit/face/hair + grime from voxel-poser; 15 part meshes; skeleton of limb Groups; sinusoidal walk/idle/attack; heading from movement; per-instance material; own-geometry dispose). Swapped into `47-worlds-room.js` `createAvatar(seed)` (serves self + peers + bots), with voxel branches in `animEntity`/`startAttack`/`disposeEntity`; seeded from `myId`/`p.id` so each person is distinct. Verified in a real browser with 3D math: builder (15 meshes, height 1.7, feet at y=0, animated limbs, distinct+deterministic, clean dispose) AND a live networked peer rendering as a second voxel avatar in the worlds room (2 voxel avatars, 0 sprites). Opt out with `?voxel=0`.
**Also fixed (real spawn bug, effect NOT separately verified):** `51-worlds-bots.js` read its spawn from `you.cursor` (nonexistent — `world.state` sends `you.x/z`), leaving bots at a random, server-rejected position. Now reads `you.x/z`. NOTE: bot rendering is still blocked downstream by the observer gate below (bots send empty tokens → `role: observe` → can't move → no presence), so a voxel **bot** was never observed live; the voxel **peer** path was proven via a synthetic signed-token client (`tester3`). NPCs-as-voxel (dev-bots + ambient crowd) is therefore NOT yet demonstrated — crowd swap is Phase 3.
**Local-dev gotcha found:** the PartyKit server treats `WORLDS_SERVICE_TOKEN` as a join secret (`party/index.js:934`), so with it set in `.env` the server is in token-required mode (not openMode) and unauthenticated clients/bots get `role: observe` (can't move → no presence → invisible peers). Unset `WORLDS_JOIN_SECRET`+`WORLDS_SERVICE_TOKEN`, or mint a signed `play` token, to exercise multi-peer locally.
- New module `engine/world/53-voxel-avatar.js` (IIFE) → `window.makeVoxelAvatar(descriptor)` returning a `THREE.Group` with `{parts, setHeading, setWalk, playAttack, dispose}`.
- Port pure mesher + skin/outfit data from voxel-poser; geometry cache by skin-hash.
- Swap at `47-worlds-room.js:793` `createAvatar` (covers self + peers + bots); drive facing+walk in `animEntity` (877); fix `disposeEntity` (826) to traverse-dispose.
- **Verify (3D math):** load worlds room → assert the entity object is a `THREE.Group` of `Mesh` (BoxGeometry voxels), positioned where the sprite was, feet on ground, faces heading.
- **Out of scope v1:** networked per-player skin (Phase 1b), full IK/ragdoll (Phase 6).

### Phase 1b — Network the avatar descriptor
- Add `avatar` to `world.join` (`47:108`) + presence echo on `party/index.js`; read `p.avatar` in `updatePeerAvatars` (`47:1057`); pass to `createAvatar(descriptor)`. Add a voxel category to the picker (`49`). Bots carry skins via `BOT_DEFS` (`51`).

### Phase 2 — Fly Down to the Surface
- New `engine/world/54-fly-down.js` (IIFE). Generalize `applyPlanetLandscapeProofView` (`27:640`) into a real descent: extend `persCam.far` with altitude, lower/raise `target.y`, relax `clampTargetToHomeBoard` (`02:107`) when planet active, cloud-sea wipe transition (`31-cloud-sea.js`).
- Add a planet branch to `flightSurfaceAtScene` (`34:162`) using `planetLandscapeEngine.getHeight()` + ocean `WATER_LEVEL` so the plane lands/splashes. `flightCam` FAR 600 already suffices.
- **Verify:** descend from island layer → camera reaches `y≈-drop`, plane reports `onGround` on the planet surface, no clip/z-fight.

### Phase 3 — Settlements & Voxel NPCs on the Surface
- Procedurally place land-island settlements (huts, docks, fires) on the planet using `LandscapeEngine.getHeight()`; populate with voxel NPCs (Phase 1 avatars) with simple wander/idle behavior. Survivors offer scavenge/trade hooks (ties to Phase 4) and artifact quests (ties to the lift-your-island lore).

### Phase 4 — Mining / Crafting / Foraging Loop
- `player_items` table + spend path (`world-resources.mjs` debit branch or new endpoint). Static `RECIPES` const + craft message in PartyKit. Resource-gated placement (hook `saveDraft` / a live-placement message). Generalize the 4-resource HUD (`48`) to N items. Add tool tiers / variable yields (`GROSS_REWARD` at `party/index.js:230`), tree→wood (`nodeActionForCell` at `306`).

### Phase 5 — Multiplayer Battles & Game Modes
- `battle-<id>` authoritative room (model on `isWorldRoom`): server-owned HP, hit validation, kills, respawn, scoring, teams. Shared HP bars on ghosts (replace hardcoded `isAlive()` at `41:44`). Match lifecycle (lobby→countdown→round→results) via a server tick. Real cannons/turrets (make the cosmetic shield guns at `40:689` fire projectiles registered as combat targets). Position interpolation for fast PvP.

### Phase 6 — Avatar Depth & Multi-Agentic NPCs
- Port voxel-poser IK (`twoBone`) + optional ragdoll per-instance for death/hit reactions. AI-driven agents inhabiting settlements/worlds as voxel actors (behavior trees / LLM hooks via the existing agent-generation seam `26/28`).

---

## 6. Risks & Constraints (carried forward every session)

- **Do NOT push live.** Local dev only. Never `git push`, never deploy. (No git hooks; `main-dev` has no upstream — verified.)
- **Shared global scope:** new modules MUST be IIFEs with unique `window.__*` exposure or `check.js` fails the build.
- **Three.js r128 pinned** — water/avatar shaders use exact r128 GLSL include strings; both app and voxel-poser are r128, so extraction is safe. Do not bump.
- **Shared materials** (`M.*`, `voxMat`): clone for per-instance tints; the repo has a history of GPU-buffer leak fixes — dispose per-instance materials.
- **Render/draw-bound** (per perf findings): cache avatar geometry by skin-hash; prefer static expressions for crowds; the planet is tuned as a distant backdrop (near-chunk profile needs enriching for close flight).
- **No emoji**, SVG glyphs only, verify in a real browser with 3D math (not screenshots/synthetic events).
- **Two per-frame drivers** for people: worlds-room has its own RAF (`47:1062`); ambient crowd ticks in the main loop (`25:69`). Don't edit `vendor/tiny-crowd-layer.js`.
