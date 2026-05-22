# Workspace Overview

**Project**: Tiny World Builder — a single-file browser app (`tiny-world-builder.html`, ~16k LoC) for painting low-poly 3D voxel worlds on a Three.js r128 scene. No bundler. No npm runtime dependencies. Deployed to Vercel/Netlify from `dist/` via `publish.sh`.

---

# Durable Facts

## App Architecture
- **Intent layer**: `world[x][z]` — `{ terrain, terrainFloors, kind, floors, buildingType, fenceSide, extras }`
- **Render layer**: `cellMeshes['x,z']` — `{ tile: Group, object: Group|null }`
- **Central mutation path**: `setCell(x, z, opts)` — normalizes, writes world, rebuilds meshes, refreshes adjacency neighbors, autosaves, fires webhooks. Never write `world[x][z]` directly outside of init.
- **Grid**: home grid starts 8×8, configurable up to 48×48. `HOME_GRID_MAX` is the ceiling constant.
- **Storage**: key `tinyworld:v1`, schema version 4. Cells serialized sparsely. `applyState()` accepts both tuple export and object-form schema cells.
- **Three.js**: r128 pinned. `MeshLambertMaterial`, `ExtrudeGeometry`, shadow setup all assume r128 semantics — do not bump.
- **Shared materials**: `M.*` are shared across many meshes. Clone before mutating color. `disposeGroup()` disposes geometries, not materials (shared).
- **Deploy**: `npm run build` → `publish.sh` → `dist/`. `npm test` = `check` (syntax) + `smoke`.

## Repo Skills (`.codex/skills/`)
- `tinyworld-single-file` — repo workflow, single-file constraints
- `tinyworld-auto-batching` — auto palette inference/cache behavior
- `tinyworld-opacity-torch` — ghost boards, panning, opacity torch
- `tinyworld-tile-variation` — repeat-click levels, terrain/object variation (updated with LandscapeEngine notes)
- `tinyworld-visual-qa` — browser checks, visual QA
- `tinyworld-render-performance` — renderer, shadows, clouds, GPU budget (updated with shadow/fog and low-poly shader preservation)
- `tinyworld-webxr` — WebXR AR/VR desk placement, floating boards, headset input
- `tinyworld-crowd-layer` — 2.5D people sprites at 3D map coordinates
- `tinyworld-lowpoly-world-prompt` — model prompting for coherent low-poly worlds
- `tinyworld-lowpoly-stylized-3d` — low-poly/stylized 3D asset design, imports, materials, scale, animation
- `tinyworld-integrations` — API, webhook, SSE, MCP, plugin, automation examples
- `tinyworld-ghost-world-gen` — ghost world generation
- `threejs-primitive-reconstructor` — Three.js scene reconstruction from primitives

## Known Schema / Docs Gaps
- `README.md` and `AGENTS.md` still describe ~1600-line app and 8×8-only assumptions; actual file is 16,095 lines with up to 48×48 grid.
- `world.schema.json` is stricter than runtime: no `gridSize`, tuple cells, `extras`, `transform`, `cameraMode: 'soft'/'fp'`, negative coordinates — all accepted at runtime.
- `publish.sh` does not copy `cluso/` directory; deployed `dist/` may 404 `cluso/cluso-embed.js`.
- Optional cloud profile/build save calls `/api/profile` and `/api/builds` — no API source in repo; hidden unless `window.TinyWorldAuth` is present.

---

# Active Subsystems

## LandscapeEngine (Recently Completed Major Feature)
A continuous terrain rendering mode (opt-in via `Terrain style = Landscape`). Key properties:
- Hidden logical board; no discrete base tile meshes render in this mode.
- `updateLandscapeClipBounds()` drives a clip window around camera target, linked to `renderVisibleDistance` setting.
- Auto-expand bounds on first pan (up to 48×48), reset on new generation/load via `applyState`.
- Legacy ghost/cheap preview boards suppressed when active (`landscapeGhostBoardsSuppressed`).
- Hover, selection overlays, ghost preview, picking, crowd height, objects, and extras all projected via `landscapeHeightAtCell(...)`.
- **Realistic mode**: native vertex-color Lambert material; near terrain/rocks/flora cast/receive shadows; far LOD stays non-shadowed for GPU budget; `scene.fog` atmosphere.
- **Low-poly mode**: original `sandMatLowPoly` cel shader preserved (shadow fix regression corrected).
- Gradient edge fading: `sandMatLowPoly`, `sandMat`, `terrainMat` (via `onBeforeCompile`), and `waterMat` all fade color/opacity near clip boundaries into sky/fog.
- Pixel outline normal-pass fix: `landscapeMeshEngine._clipPlanes` copied to `pixelState.normalMaterial.clippingPlanes` inside `renderScene`.
- Free camera panning enabled when `landscapeMeshMode` active.

## OpenClaw Automation (Cron Jobs, as of 2026-05-22)
- **Heartbeat** (cron `89c73c3d`): Runs hourly. Last result: `HEARTBEAT_OK`. All critical components functioning. Email alert script verified working.
- **Urgent Email Alert** (cron `4e55bac5`): Runs periodically. Last result: `HEARTBEAT_OK`.
- **Tom Doerr Tweet Tracker** (cron `59fa3a02` / `cebd05e0`): **BLOCKED** — browser automation down due to OpenClaw CLI version mismatch (CLI v2026.4.29 vs service v2026.5.16). State preserved: 20 tweets seen, tracking since 2025-11-25. Script at `/Users/jkneen/clawd/scripts/tom-doerr-tweet-tracker.sh`.
- **VibeClaw Skills Scout** (cron `c44fa8a6`): Runs hourly. At 10:00 found 9 new items (Opus 4/Sonnet 4/Haiku 4, Copilot Extensions GA, Cursor Rules repo, Windsurf Wave 9, MMLU-Pro, AutoCoder v3, GPT-4.1, Cursor background agents). At 11:00: nothing new. All 6 Nitter instances down — Twitter RSS fallback unavailable.

## Lead Agent / Canvas Board
- Agent name: **Ava**, ID `9f5f3df9-2ed7-4efe-9d97-2114fe460a35`
- Board ID: `c3f78d0c-abf3-45d5-898e-27cd1d95c0d1`
- Gateway: `localhost:19789`, heartbeat polls passing (`HEARTBEAT_OK`)
- MC Gateway (`894a3d5b-7faa-4c0a-a40f-69fbdee7b78d`): Multiple failed assistant turns — connection issues noted.

---

# Open Threads

## Visual QA Still Pending (LandscapeEngine)
The LandscapeEngine feature is code-complete and `npm test` passes, but browser visual QA has not been confirmed:
- Fixed boards: no hidden base/helper mesh outlines visible
- Auto-expand while panning: terrain streams/reveals, no ghost/base boards
- Low-poly and voxel terrain styles: legacy generation renders normally (not broken by landscape changes)
- Low-poly Landscape: looks cel-shaded again (not realistic)
- Realistic Landscape: receives shadows and fog
- Pixel outline `Normal` pass: no ghost outlines on clipped landscape tiles/rocks/trees
- Pan-driven terrain generation: matches visible distance setting exactly
- Clip boundary gradient: terrain and water fade softly into sky/fog

## OpenClaw CLI Version Mismatch — Action Required
- **Current CLI**: v2026.4.29 — **Service**: v2026.5.16
- Blocks all browser automation (tweet tracker, any future browser-based cron tasks)
- Update path: upgrade OpenClaw CLI to v2026.5.16 or higher
- Nitter instances all down; no RSS fallback for Twitter monitoring

## MC Gateway Stability
- Session `mc-gateway-894a3d5b` producing repeated `[assistant turn failed before producing content]` errors
- Root cause unknown; monitor for recurrence

---

# Key File Locations
- Main app: `tiny-world-builder.html` (inline CSS + JS, ~16k LoC)
- Landscape engine module: `LandscapeEngine.js`
- Build script: `publish.sh`
- Static checks: `npm test` (`npm run check` + `npm run smoke`)
- Dist output: `dist/`
- Skills: `.codex/skills/*/SKILL.md`
- Cron scripts: `/Users/jkneen/clawd/scripts/`
- Tweet tracker state: `/Users/jkneen/clawd/memory/tom-doerr-seen.json`
- Generated memory (this file): `.codesurf/DREAMING.md`
