# tinyworld — CodeSurf Generated Memory

_Generated 2026-05-24. Do not edit by hand — overwritten on each dreaming run._

---

## Overview

**tinyworld** is a single-file browser app (`tiny-world-builder.html`) — a low-poly infinite-canvas 3D world builder built on Three.js r128. No bundler, no npm runtime dependencies. Inline CSS and JS in one file (~16k LoC). Deployed statically via `publish.sh` → `dist/`, served by both Vercel (`vercel.json`) and Netlify (`netlify.toml`).

The workspace runs inside **CodeSurf** canvas with an **OpenClaw** agent infrastructure handling scheduled crons and heartbeat polling.

Working tree is **clean** as of last dreaming run. Branch `main` is 2 commits ahead of `origin/main` (not yet pushed). Last commit: `4d467a2 Refresh workspace memory` — touched only `.codesurf/DREAMING.md` and `.mcp.json`.

---

## Durable Facts

### App Architecture

- **Single source of truth**: `tiny-world-builder.html` — all code lives here
- **Two parallel data structures** (never mix):
  - `world[x][z]` — intent layer: `{ terrain, terrainFloors, kind, floors }`
  - `cellMeshes['x,z']` — render layer: `{ tile: Group, object: Group|null }`
- **Only mutate via `setCell(x, z, opts)`** — direct writes to `world[x][z]` desync intent from rendering
- Three.js r128 pinned — `vendor/three/` self-hosted; do not bump version
- Materials in `M.*` are **shared**; never mutate `M.foo.color` in place — clone first
- `disposeGroup(group)` disposes geometries but **not** shared materials
- `userData.landing` checks guard drop-in animations — do not remove them
- Grid range: 8×8 default, up to 48×48 via settings; avoid broad synchronous rebuilds at large sizes
- Storage key: `tinyworld:v1`, schema version 4

### Procedural Material System (committed 2026-05-23)

- **Seeded RNG**: `makeMulberry32()` replaces `Math.random()` for texture generation — materials are stable across reloads
- Deterministic procedural pixel textures added for: `planks`, `stone`, `hay`, `dirt`
- **`voxelBuildMaterial(hex, textureKind)`** — infers and routes procedural texture maps for generated/custom voxel-build colors
- Trim geometry preferred over global outline passes for imported/custom voxel builds
- Skill file update for this pattern was **blocked by codex sandbox** (`.codex/skills/` treated as outside project in GPT-5.5 sessions) — durable rule exists only in code, not yet in a skill

### Pre-flight Checklist

- `npm test` passes (`npm run check` + `npm run smoke`)
- Page loads with no console errors
- Tool keyboard shortcuts `1`–`9`, `E` work
- `R`/`F` raise/lower hovered terrain; reset restores preset village; `C` clears to grass
- Perspective ↔ ortho toggles cleanly
- Fence placement updates neighbor geometry
- House clusters render as L/T/+/square where appropriate
- Smoke spawns from chimneys after landing

---

## Active Subsystem: LandscapeEngine (pending browser visual QA)

Substantially implemented; `npm test` passes; browser QA not yet fully verified. Persists across multiple dreaming cycles.

### What was built

- **`LandscapeEngine.js`** — separate module; `landscapeMeshMode` flag gates the feature throughout `tiny-world-builder.html`
- `landscapeHeightAtCell(x, z)` is the canonical height lookup for objects, overlays, crowd, hover, and picking in landscape mode
- Clip planes from `landscapeMeshEngine._clipPlanes` copy to `pixelState.normalMaterial.clippingPlanes` in `renderScene` (prevents outline-pass ghosting)
- Camera panning unlocked in landscape mode; dynamic bounds expand up to 48×48 on first pan, linked to `renderVisibleDistance` setting
- Switching away from Landscape disposes engine and rebuilds normal tile/object world
- Soft gradient edge fading applied to all terrain/water materials near clip boundaries
- Skills updated: `.codex/skills/tinyworld-tile-variation`, `.codex/skills/tinyworld-render-performance`, `.codex/skills/tinyworld-opacity-torch`
- Additional fixes (commit `1b37fd6`): placement snaps aligned to landscape height; vehicle hill travel; weather collision projection; ghost board restore; `scratch/visual_qa.js` + `chrome_debugger.js` + `chrome_debugger_autoexpand.js` + `test_unit.js` added

### Visual QA still needed (browser)

- Fixed boards: no hidden base/helper outlines
- Auto-expand while panning: terrain streams, no ghost/base boards
- Low-poly and voxel styles: legacy generation unaffected
- Low-poly Landscape: cel-shaded appearance preserved
- Realistic Landscape: shadows and fog active
- Pixel outline "Normal": no ghost outlines for clipped tiles/rocks/trees
- Clip boundaries: soft gradient fade into background sky/fog

---

## Active Investigation: Auto-Generate Panning Regression

Root cause identified; fix not yet applied.

### Root cause in `maxRenderVisibleSizeForGrid` (line 5082)

- When `isLandscapeMeshActive()` is true, returns `Math.max(48, g * 4)` — for grid ≥ 18 this produces 72, hitting the slider's hard `max="72"` ceiling
- When `renderAutoExpand` is true (non-landscape path), `(1 + 2 * maxPreloadRadius) * g` may also push to 72
- **Only affects non-realistic/non-landscape terrain modes**
- Fix not applied — session was read-only and `tiny-world-builder.html` had existing uncommitted texture/material edits to preserve

---

## Adjacent Project Activity

### Hermes Agent / hermes-agent-core-rs (`/Users/jkneen/Documents/GitHub/hermes-agent/agent-core-rs`)

Parity test suite is **passing** as of 2026-05-24:
- `HERMES_PARITY_RUN_OK` — confirmed multiple times across two batches
- `HERMES_PARITY_CHAT_OK` — confirmed
- `HERMES_PARITY_ONESHOT_OK` — confirmed
- Memory recall probe ("ultraviolet" / "remembered") — confirmed responding correctly

Backend: OpenAI-compatible at `POST 127.0.0.1:8642/v1/chat/completions`. Has local edits. AGENTS.md rules: verify model names from local codebase; no emoji unless explicitly requested.

### SmallHarness / Hermes Migration (`/Users/jkneen/Documents/GitHub/SmallHarness`)

- Rust CLI; TUI uses crossterm raw-mode prompt + JSONL input history + bordered/plain input styles + streaming renderer
- Key files: `src/input.rs`, `src/renderer.rs`, `src/main.rs`, `src/config.rs` — all have local edits
- Migration plan (not yet confirmed applied): port TUI to hermes-agent; add `hermes` backend suppressing SmallHarness tool schemas; renderer blank-line fix; schema suppression
- Hermes parity passing is consistent with migration work having proceeded, but application to SmallHarness not confirmed in session evidence

### ideation-canvas (`/Users/jkneen/Documents/GitHub/ideation-canvas`)

Realtime drawing smoothing: Catmull-Rom cubic SVG curves in `ScribbleNode.tsx`; `scribbleToPath()` shared between live overlay and saved strokes; `npm run build` passes.

### openclicky (`/Users/jkneen/Documents/GitHub/openclicky`)

Keychain-backed secret storage, bridge token gate, proxy feature flags implemented; live build verification still pending.

---

## Active Agent Infrastructure (OpenClaw)

### Healthy

- **Lead agent Ava** (`c3f78d0c-abf3-45d5-898e-27cd1d95c0d1`) — heartbeating `HEARTBEAT_OK` across multiple polls; `AGENT_ID: 9f5f3df9-2ed7-4efe-9d97-2114fe460a35`; no board task work this cycle
- **Urgent Email Alert cron** — first two attempts each cycle fail (assistant turn failure before content), third attempt recovers with `HEARTBEAT_OK`; functionally operational but flaky on first attempt
- **VibeClaw Article Generator** — 4+ articles published; recent: "The Invisible Architecture: How Context Windows Are Reshaping AI Reasoning" and "Neural Architecture Search: Teaching AI to Design Itself"
- **VibeClaw Skills Scout** — ran successfully at both 19:00 UTC and 02:00 UTC

### Degraded / Broken (persistent)

- **MC Gateway** (`894a3d5b-7faa-4c0a-a40f-69fbdee7b78d`) — **persistent across multiple dreaming cycles**: "connection refused" on every poll; target `localhost:19789`; multiple assistant turn failures before content; requires manual process restart investigation — this is unresolved and recurring
- **Lazar Memory Consolidation cron** — fails every run (6+ attempts); fix known: call `mcp__lazar__lazar_memory` with `{ tool: 'consolidate_memory' }` only — strip `parameters: {}` wrapper entirely; not yet applied at cron config level
- **Stale Branch Cleanup cron** — same 4 branches deleted locally each run; remote refs not removed; fix: add `git push origin --delete <branch>`; not yet applied
- **Tom Doerr Tweet Tracker** — no authenticated Chrome profile for X/Twitter; blocked

---

## Open Threads

- Browser visual QA for LandscapeEngine — unblocked, needs a human with a browser
- Auto-generate panning regression fix — root cause known, file edit not yet applied
- MC Gateway process restart — highest-priority infra issue; has been stuck for multiple cycles
- Lazar consolidation cron fix — one-line config change, not applied
- Stale branch cleanup cron fix — one-line addition, not applied
- SmallHarness migration changes — plan exists, application to SmallHarness not confirmed
- openclicky live build verification — pending
- Push `main` to `origin/main` — 2 commits ahead, not yet pushed
