# AGENTS.md

Guidance for AI coding agents working in this repo. Read this before touching
`tiny-world-builder.html`.

## Project shape

- Main app: `tiny-world-builder.html` — a ~1.4k-line HTML shell (boot config,
  DOM, and the ordered `<script src>` tags at the bottom). It is **no longer a
  single file**: styles live in `styles/tiny-world.css` (~5.2k lines) and the
  logic is split into ordered modules under `engine/world/00..34 + 99-*.js`
  (~37k lines across 36 files), plus the LandscapeEngine (`LandscapeEngine.js`
  ~1.6k lines + `engine/landscape/*.js`). Total JS is ~40k lines.
- The `engine/world/*.js` modules are **plain classic `<script>`s that all share
  one global scope** (the 2-space indent is cosmetic, left over from the old
  god-file). Two consequences: (1) load **order** matters; (2) every top-level
  `const`/`let`/`function` name must be **unique across all modules** — a
  duplicate identifier throws `SyntaxError: Identifier 'X' has already been
  declared` and silently kills the *entire* module at instantiation (its globals
  never appear) while other modules keep loading. Prefix module-local scratch
  globals (e.g. flight uses `_fl…`).
- Three.js **r128** and GLTFLoader are self-hosted under `vendor/three/`.
  `publish.sh` copies the whole `engine/` tree, `styles/`, and `vendor/` into
  `dist/`. Vercel (`vercel.json`) and Netlify (`netlify.toml`) use that static
  build output.
- No bundler and no npm runtime dependencies. Use `npm test` for static checks,
  `npm run build` for dist generation, then reload the browser.
- If a `tiny-world-builder BACKUP.html` snapshot exists, don't auto-update it.

## Repo-local skills

- Local skills live in `.codex/skills/*/SKILL.md`. Read the relevant skill before
  changing the matching system.
- When a change creates a durable pattern, update the related skill in the
  same turn. If there is no related skill, create a new concise one.
- Current skill routing:
  - `.codex/skills/tinyworld-single-file` — repo workflow and single-file constraints.
  - `.codex/skills/tinyworld-auto-batching` — Auto palette inference/cache behavior.
  - `.codex/skills/tinyworld-opacity-torch` — ghost boards, panning, opacity torch.
  - `.codex/skills/tinyworld-tile-variation` — repeat-click levels and terrain/object variation.
  - `.codex/skills/tinyworld-asset-editing` — selection placement, freehand drawing, asset clipboard/templates, and Stamps navigation.
  - `.codex/skills/tinyworld-visual-qa` — browser checks and visual QA.
  - `.codex/skills/tinyworld-render-performance` — renderer, shadows, clouds, and GPU budget.
  - `.codex/skills/tinyworld-settings` — Settings modal sections, controls, tabs, and accessibility.
  - `.codex/skills/tinyworld-webxr` — WebXR AR desk placement, floating boards, VR immersion, and headset input.
  - `.codex/skills/tinyworld-crowd-layer` — 2.5D people sprites placed at 3D map coordinates.
  - `.codex/skills/tinyworld-lowpoly-world-prompt` — model prompting for coherent low-poly worlds.
  - `.codex/skills/tinyworld-lowpoly-stylized-3d` — low-poly/stylized 3D asset design, imports, materials, scale, and animation.
  - `.codex/skills/tinyworld-integrations` — API, webhook, SSE, MCP, plugin, and automation examples.
  - `.codex/skills/tinyworld-runtime-state` — persisted localStorage, defaults pipeline (`tinyworld-defaults.json` + `/api/save-defaults`), audio, camera, panel positions, inline-script gotcha.
  - `.codex/skills/tinyworld-island-and-planes` — home island layout, sponsor banner drape, plane/crop-duster flight curves, "front" side conventions.
  - `.codex/skills/tinyworld-tool-icons-and-modes` — mode indicator, boot-to-Select, Esc-to-Select.
  - `.codex/skills/tinyworld-block-button-style` — locked-in "block" button aesthetic: raised square, dark category-colored outline + inner white line, white-bodied outlined glyph. Use for any new icon button/tile.
  - `.codex/skills/tinyworld-mesh-terrain` — opt-in voxel-block landscape sculptor (paint per-voxel materials + pull/push-sculpt flat-topped blocks). Keeps the block mesh as a separate overlay persisted under `tinyworld:meshTerrain:*` (no `setCell` bake), hides the flat home tiles, and exposes sampler helpers for object/avatar grounding. Module `engine/world/46-mesh-terrain.js`.
  - `.codex/skills/tinyworld-flight-sim` — flyable plane. The plane is the existing **`stunt-plane` model-stamp** (`models/stunt_plane.glb`) placed via the **Stamps** system (NOT a bespoke tool/kind). A plain click on the placed stamp opens an Enter/Fly menu; flight uses a rear chase-cam + the ported ships physics (sim-space → scene similarity transform); Escape exits.
  - `.codex/skills/tinyworld-tinyverse-race-track` — Tinyverse ground-surface perimeter rally loop, poser-surface show/hide hook, static road/bridge merging, and local kart race HUD.
  - `.codex/skills/tinyworld-surface-roam` — Free WASD+mouse-look movement on the Skybound poser surface (J descend/ascend, Space/C fly, Shift sprint). Polling pattern for fly-down state, sampleWorld height helper, presence-echo guard, and _sr-prefixed state variables.
  - `.codex/skills/tinyworld-cctv-truman` — in-world CCTV / "Truman Show" surveillance cameras: render-to-texture B&W CRT/VHS monitor feeds with captions, lobby/pumpkin/tree camera placement, moving-subject tracking, and the lobby screen cutting to the hottest live feed. Modules `engine/world/62-cctv-truman.js` + `63-cctv-placement.js`.

## House style

- Vanilla ES6+, no semicolons would be wrong here — **this file uses
  semicolons**, follow the existing style.
- 2-space indent, trailing commas where present, single quotes for strings.
- Section comments are `// -------- name --------` and they matter — keep
  related code grouped under them. If you add a new system, give it its own
  section header.
- Boring obvious code over clever. The app is now feature-rich (~37k LoC of modular JS), so
  prefer small, well-sectioned changes over clever abstractions.

## Mental model

Two parallel data structures:

```
world[x][z]                  // intent  — { terrain, terrainFloors, kind, floors }
cellMeshes['x,z']            // render — { tile: Group, object: Group|null }
```

Mutate via **`setCell(x, z, opts)`**. It:

1. updates `world[x][z]`,
2. rebuilds the tile mesh if terrain / terrainFloors changed (or `forceTile` is set),
3. rebuilds the object mesh,
4. re-renders adjacency-sensitive neighbors (fences, house clusters).

Never write to `world[x][z]` directly outside of init — go through `setCell`,
or you will desync intent from rendering.

## Adding a new object kind

1. Add a factory: `function makeWidget(...)` returning a `THREE.Group`.
2. Add a tool entry to `TOOLS` (id, label, kind, color, optional
   `terrainOverride`).
3. Handle the `kind` in `renderCellObject` — call your factory, set
   `userData.kind`, push a drop-in animation if appropriate.
4. If the kind needs adjacency awareness, write a `getXxxNeighbors(x, z)`
   helper and re-render neighbors inside `setCell` (mirror the fence/house
   pattern at the bottom of `setCell`).
5. If the kind animates per-frame, add a branch inside the `for (const key in
   cellMeshes)` loop in `animate()` and **respect `obj.userData.landing`** so
   it doesn't fight the drop-in.

## Adding a new terrain

1. Add a material to `M`.
2. Add a tool entry with `terrain: 'name'`.
3. Handle the name inside `makeTile(terrain)` — pick `topMat` and any decals
   (flecks, scuffs, ripples).

## Three.js gotchas in this codebase

- **r128** is pinned. `MeshLambertMaterial`, `ExtrudeGeometry`, and the
  shadow setup all assume r128 semantics. Do not bump the version casually —
  shadows and material color spaces have changed in newer releases.
- Materials in `M.*` are **shared** across many meshes. Don't mutate
  `M.foo.color` in place; clone first.
- `disposeGroup(group)` disposes geometries but **not** materials, because
  materials are shared. Per-particle smoke clones its material and disposes
  on death — follow that pattern if you ever need a unique material per
  instance.
- Cameras: `orthoCam`, `softCam`, and `persCam` exist; `camera` is a reference
  swapped by `togglePerspective()` / `setCameraMode()`. `updateCamera()` writes
  to all camera projections/positions as needed.

## Performance budget

- Home grid starts at `8x8` but settings can expose up to `48x48`. Per-frame
  allocation is fine at small sizes; at larger grids, preserve progressive
  rendering and avoid broad synchronous rebuilds.

## Things to avoid

- Don't pull in npm packages or a bundler. The single-file constraint is the
  point.
- Don't rename `world` / `cellMeshes` / `setCell` — they're the public
  contract of the data layer.
- Don't remove the `userData.landing` checks. They prevent animations from
  fighting the drop-in queue.
- Don't "clean up" comments without asking.
- Don't touch `tiny-world-builder BACKUP.html` if that local snapshot exists.

## Quick checks before declaring done

- [ ] `npm test` passes.
- [ ] Page loads with no console errors.
- [ ] Tool keyboard shortcuts (`1`–`9`, `E`) still work.
- [ ] `R` / `F` raise and lower the hovered terrain; reset button restores the
      preset village; `C` clears to grass with the staggered drop-in.
- [ ] Perspective ⇄ ortho still toggles cleanly.
- [ ] Placing/erasing a fence updates its neighbors' geometry.
- [ ] Clusters of houses still render as L/T/+/square where appropriate.
- [ ] Smoke spawns from house chimneys after they finish landing.
