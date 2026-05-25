# tinyworld — CodeSurf Generated Memory

_Generated 2026-05-25. Do not edit by hand — overwritten on each dreaming run._

---

## Overview

**tinyworld** is a single-file browser app (`tiny-world-builder.html`) — a low-poly infinite-canvas 3D world builder on Three.js r128. No bundler, no npm runtime dependencies. All CSS and JS inline (~29k+ LoC). Static deploy via `publish.sh` → `dist/`, served by both Vercel (`vercel.json`) and Netlify (`netlify.toml`).

The workspace runs inside **CodeSurf** canvas with an **OpenClaw** agent infrastructure managing scheduled crons and heartbeat polling.

---

## Durable Facts

### App Architecture

- **Single source of truth**: `tiny-world-builder.html` — all code lives here
- **Two parallel data structures**: `world[x][z]` (intent) and `cellMeshes['x,z']` (render) — mutate only via `setCell(x, z, opts)`
- Three.js r128 pinned; materials in `M.*` are shared — clone before mutating color
- `userData.landing` guards drop-in animations; `disposeGroup` skips shared materials
- Grid: 8×8 default, up to 48×48; storage key `tinyworld:v1` schema v4
- Section comments `// -------- name --------` are structural — preserve grouping

### Procedural Texture System

- `makeMulberry32(seed)` seeded RNG — stable procedural textures across reloads
- Cottage deterministic canvas textures: `texCottageGrass`, `texCottageWood`, `texCottageGlass`, `texCottageStone`, `texCottageDirt`
- `texturedGrass` defaults **on** (`!== '0'`); UI label: "Cottage grass texture"

### Waterfall Effect

- Flat plane replaced with layered curtains, surface flows, and foam-puff system
- 16 puffs per exposed water edge, lanes `lip / fall / splash`; per-tick non-uniform scale pulse
- Puffs carry full position state (`baseX/Y/Z`, `acrossDrift`, `fallHeight`, salts)
- Single shared material: `M.waterfallFoamPuff`
- **Animation speeds slowed** — surface, curtains, foam, and falling cubes all reduced; `tinyworld-render-performance` skill reflects this

### Tower Building Variant

- **`makeVoxelStoneTower(floors, palette)`** — dedicated voxel factory for `buildingType === 'tower'`
- **`makeVoxelTurret`** now reserved exclusively for castle turrets
- `tinyworld-lowpoly-stylized-3d` SKILL.md updated to reflect this split

### Stamp Builder UI

- AI/prompt controls fully removed; only "Import build JSON" remains
- **No thumbnail preview pane** — controls visible immediately
- Part-specific texture fields: `bodyTexture/bodyTextureScale` and `topTexture/topTextureScale` alongside body/top colors
- Cards clickable to select; `selected` CSS state; `stampBuilderSelectionKey()` tracks selection
- **Multi-selection operations** apply to all selected targets (not refused when >1 selected)
- Compact layout: `86px` min col, `104px` min card height, `72×72` thumbnails; keyboard/role accessibility

### Thumbnail Render Hardening

- Toolbar thumbnails and stamp card thumbnails both have fallback guards
- A single preview render error no longer aborts the whole stamp/tool grid
- Cards still render (empty labeled swatch) even if `TOOLS` thumbnail generation throws

### Selection Pane & Object Transforms

- Selection pane exposes:
  - `Y-` / `Y+` movement (`offsetY`)
  - Separate `Scale X`, `Scale Y`, `Scale Z` sliders
  - **Material assignment**: default, brick, stone, rock, slate, wood, grass, dirt, sand — split into All / Body / Top with independent scale
- Object transforms save/load `offsetY`; appearance data supports per-axis scale and material texture
- Building brick/stone texture density tighter; roof slate/shingle texture density much tighter
- Extras (tuft, fence, tree on same tile) now advertised in selection summary; size control affects extras too

### Orbit Camera & Terrain

- `MIN_ORBIT_POLAR = 0.18` / `MAX_ORBIT_POLAR = Math.PI - 0.18` — camera can orbit below island
- Terrain gap fix: `positiveTerrainOffset = Math.max(0, terrainOffset)` fed into riser height

### LandscapeEngine

- **Airfield config injectable**: `_makeAirfieldConfig(airfield)`, pass `false` to disable; all constants data-driven
- Lives in `LandscapeEngine.js` — separate file, not inlined

### Git State (as of 2026-05-25)

- **3 commits ahead of `origin/main`** — not pushed
- Recent commits: waterfall foam-puff system, tower voxel factory split, stamp builder UI cleanup, orbit camera bounds, terrain gap fix, `cottage.html`, `context.md` deleted, `tinyworld-ghost-world-gen` skill added
- Working tree: clean (apart from dreaming file itself)

---

## Active OpenClaw Infrastructure

| Agent / Cron | Status |
|---|---|
| Ava heartbeat (lead board `c3f78d0c`) | **OK** — responding with HEARTBEAT_OK, no active board tasks |
| VibeClaw Article Generator | **FAILING** — assistant turns producing no content (3+ consecutive failures) |
| Codesurf Extension Skills Scout | **FAILING** — assistant turns producing no content |
| MC Gateway `894a3d5b` (`localhost:19789`) | **BROKEN** — connection refused; all assistant turns returning empty |
| Tom Doerr Tweet Tracker | **BROKEN** — X.com auth wall blocks browser and nitter; no content extracted |
| DGX image server | **UNREACHABLE** |

The VibeClaw Skills Scout and Article Generator failures appear to be an agent/provider-level issue (empty assistant turns), not a logic error — the cron prompts are well-formed and unchanged. MC Gateway failure is independent.

---

## Companion Repo: hermes-agent-core-rs

`/Users/jkneen/Documents/GitHub/hermes-agent/agent-core-rs` — frequently co-active.

- **TUI Gateway Config Fix**: `ui-tui/src/gatewayClient.ts` discovers parent Hermes checkout; prefers parent `.venv`/`venv`, falls back to `~/.hermes/hermes-agent/venv/bin/python`. Avoids Apple Python 3.9 crash.
- **Codex Provider Routing Split**: `src/main.rs` oneshot/manual CLI uses `CommandPrompt`; `src/gateway.rs` gateway uses `ApiServer`. Cargo check + clippy pass.
- **Crossterm Input Modals**: `/` opens slash command modal; `@` opens file mention modal with relative paths. Hermes-aware: local commands surface as `//command`.
- **Open**: SmallHarness → Hermes migration not executed; startup profiling incomplete; gateway connects but Hermes context loads without provider/skills state — root cause uninvestigated.

---

## Companion Repo: grok-cli

`/Users/jkneen/Documents/GitHub/grok-cli` — TUI terminal app using OpenTUI/React renderer.

- **TUI layout overlap fix**: transcript area made a bounded shrinkable column (`flexShrink={1}`, `minHeight={0}`, explicit column layout); `MessageList` scrollbox now shrinks below content height instead of pushing over the prompt
- Files changed: `src/ui/app.tsx`, `src/ui/components/message-list.tsx`
- Regression test added (narrow, avoids OpenTUI Vitest harness issue with `react-reconciler/constants`)
- Build passes; visual QA not yet confirmed in a write-capable session; inline-image patch still pending

---

## Companion Repo: CortexIDE (Electron app)

Security hardening pass completed; `npm test` passes (194 tests, 0 failures). Broader TypeScript debt intentionally deferred.

---

## Open Threads

- **3 commits not pushed** to `origin/main` (tinyworld)
- `cottage.html` integration decision pending
- `tinyworld-ghost-world-gen` skill contents unreviewed
- MC Gateway `894a3d5b` root cause not investigated — connection refused, all agent turns fail silently
- VibeClaw cron agents (Skills Scout, Article Generator) producing empty turns — likely needs provider/agent-level investigation, not prompt changes
- Tom Doerr Tweet Tracker needs authenticated browser session for X.com
- `grok-cli` inline-image patch needs a write-capable session; visual QA of layout overlap fix not yet confirmed
- LandscapeEngine browser QA (outlines, cel-shading, fog) backlogged
- openclicky build verification pending
- hermes-agent-core-rs: SmallHarness → Hermes migration not executed; startup profiling incomplete; gateway connects but Hermes context missing provider/skills state
