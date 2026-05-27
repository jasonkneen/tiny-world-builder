# CodeSurf Workspace Memory — tinyworld

_Generated: 2026-05-27 (fifteenth pass)_

---

## Overview

Tiny World Builder is a single-file, no-bundler 3-D isometric world editor built on Three.js r128. The runtime is `tiny-world-builder.html` (inline CSS + JS; ~36,869 lines after latest commit). `LandscapeEngine.js` handles procedural continuous terrain; internals in `engine/landscape/` mixin modules (chunks.js, geometries.js, noise.js, shaders.js, water.js). Deployment is static: `publish.sh` → `dist/`. `npm test` runs ESLint + HTMLHint; all pass.

---

## Durable Architecture Facts

**Core data contract**
- `world[x][z]` — intent layer; `cellMeshes['x,z']` — render layer
- All mutations via `setCell(x, z, opts)`; sparse-safe reads via `getWorldCell()` / `ensureWorldCell()`
- Never write to `world[x][z]` directly outside init

**Committed, stable on main (HEAD `ed08603`):**
- Planet underlay
- Water flow system
- Ghost world generation
- Audio UI and defaults bootstrap
- Updated editing controls (latest commit — includes `.codex/config.toml`, skill update, and 539-line HTML diff)

**Properties Panel** — Preview/Properties tab split in place. "Details" tab renamed to "Properties". Panel stays visible without AI features. Row UI is chip-list based; controls not yet iconified or undo-aware.

**Three.js r128 pinned.** No bundler, no npm runtime deps. Materials in `M.*` are shared; clone before mutating color. Do not bump Three.js version — shadows and material color spaces differ in newer releases.

---

## Branch State

**main** — HEAD `ed08603` (working tree clean as of this pass):
- `ed08603` Updated editing controls ← **NEW** (committed `.codex/config.toml`, `.codex/skills/tinyworld-asset-editing/SKILL.md`, `tiny-world-builder.html`)
- `2e20a38` Add audio UI, defaults bootstrap, and assets
- `78a019f` Merge asset system improvements
- `c30bb6e` Finish asset move and stamp inventory
- `48bfd87` Batch stamp card thumbnails
- `7cfa92c` Improve stamp search keyboard flow
- `f40143b` Select drawn placement strokes
- `c394352` Clarify settings navigation

**Resolved since last pass:**
- Previously uncommitted `tiny-world-builder.html`, `.codex/skills/tinyworld-asset-editing/SKILL.md`, and `.codex/config.toml` are now committed in `ed08603`.

**Stale branches/worktrees to prune (still open):**
- `asset-system-slice` — behind main after merge; `/private/tmp/tinyworld-asset-system` worktree stale
- `worktree-agent-a17895f4`, `worktree-agent-a35bb1ef`, `worktree-agent-a6b44378` — local worktrees under `.claude/worktrees/`; all at `acfb18b`; safe to delete if no work in flight

---

## Skills Inventory

All 17 local skills confirmed present in `.codex/skills/`:
- `tinyworld-single-file`, `tinyworld-auto-batching`, `tinyworld-opacity-torch`, `tinyworld-tile-variation`, `tinyworld-asset-editing`, `tinyworld-visual-qa`, `tinyworld-render-performance`, `tinyworld-settings`, `tinyworld-webxr`, `tinyworld-crowd-layer`, `tinyworld-lowpoly-world-prompt`, `tinyworld-lowpoly-stylized-3d`, `tinyworld-integrations`, `tinyworld-runtime-state`, `tinyworld-island-and-planes`, `tinyworld-ghost-world-gen`, `threejs-primitive-reconstructor`

**AGENTS.md routing table gap:** `tinyworld-ghost-world-gen` and `threejs-primitive-reconstructor` exist in `.codex/skills/` but are not listed in the AGENTS.md skill routing section — still unresolved.

---

## Active In-Progress Work

### Properties Panel Overhaul (design decided, nothing committed)

Approach (Codex session, 2026-05-27):
- Keep existing single-file structure; durable property row keys unchanged
- Refactor UI to category tabs + compact icon-button rows (round +/- for scalars, icon buttons for rotate/position transforms)
- Add history stack capturing state before each `setCell` mutation; expose undo/redo
- Implement constrained in-scene transform gizmo — custom implementation, not TransformControls (r128 pinned, no bundler)
- Skills to consult: `tinyworld-single-file`, `tinyworld-asset-editing`, `tinyworld-visual-qa`

---

## Inspected Gaps (no patch committed)

- **`makeModelStamp()` ignores `opts.appearance`** — `makeVoxelRenderForCell()` passes it at ~line 13391; `makeModelStamp()` doesn't consume it at ~line 12272. Low-risk patch candidate.
- **Freehand fence extras** — may be subsumed by committed "avoid stacking drawn fence extras"; needs confirmation.
- **Settings modal regrouping** — `#render-modal` at ~line 4713; tab/panel switching via `active` class on `data-settings-tab`/`data-settings-panel`; safe regrouping plan exists, not implemented.

---

## OpenClaw / Cron Health (cross-workspace)

- **MC Gateway** (`894a3d5b-7faa-4c0a-a40f-69fbdee7b78d`) — repeated `[assistant turn failed before producing content]`; unresolved
- **VibeClaw Skills Scout**, **Article Generator**, **Wallpaper Generator** crons — all failing same way
- **Tom Doerr Tweet Tracker** cron — running, no failures
- **Lead heartbeats** (board `c3f78d0c-abf3-45d5-898e-27cd1d95c0d1`, agent Ava) — healthy, HEARTBEAT_OK

---

## Open Threads

- Implement and commit Properties Panel overhaul (category tabs, icon buttons, undo/redo, custom constrained gizmo)
- Confirm freehand fence extras gap is closed by existing commit
- Patch `makeModelStamp()` to consume `opts.appearance` (~line 12272)
- Add `tinyworld-ghost-world-gen` and `threejs-primitive-reconstructor` to AGENTS.md routing table
- Diagnose and fix OpenClaw MC Gateway / VibeClaw cron repeated assistant-turn failures
- Prune stale worktree branches (`worktree-agent-a17895f4`, `worktree-agent-a35bb1ef`, `worktree-agent-a6b44378`) and delete `/private/tmp/tinyworld-asset-system`
- LandscapeEngine visual QA; Stamp panel undo + rotation/flip; NPC memorySummary cap; Seasons `M.*` audit; `plugins/`/`tools/` skill docs
