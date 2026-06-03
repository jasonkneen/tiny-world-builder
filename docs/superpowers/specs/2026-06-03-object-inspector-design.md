# Extended Object Inspector — Design

Date: 2026-06-03
Status: Implemented (slice 1 of the editing-system overhaul)

## Implementation notes (post-build)
- Verified live (real app, 3D-math probes, not screenshots): setting emissive/
  opacity/finish/light via the real `setCell` path renders correct
  `material.emissive`/`material.opacity` and attaches a registered pool light;
  the inspector renders all new controls with correct bound values; the Opacity
  slider + Light "Off" chip edit the world and re-render; values persist across a
  reload; with the flag OFF there are no new rows and no light attaches.
- Deviation from plan (justified by [[never-rebuild-existing]]): the codebase
  already had a capped, distance-culled accent-light pool (`placeableLightSources`
  + `PLACEABLE_LIGHT_CAP=8` in `39-atmosphere-effects.js`, auto-registered via
  `registerRuntimeObject` in `10-world-data.js`). Instead of the planned new
  `44-object-light-pool.js`, inspector lights attach to the object root via a new
  `attachInspectorObjectLight` helper in module 39 and ride that existing pool. No
  new module, no HTML/animation-loop edits. Consequence: inspector real-lights are
  accent lights (shine at dusk/night, like the existing voxel lamps); always-on
  glow is the separate emissive material path.
- Surface material rendering (emissive/opacity/finish) is intentionally NOT
  flag-gated — it renders saved appearance data unconditionally; only the inspector
  editing UI and the light attach are gated by `inspectorV2`.

## Background

This is the first slice of a larger editing-system overhaul. The full vision (9
requirements) was decomposed into dependency-ordered slices:

1. **Inspector panel (reqs 4 + 5)** — this spec. Per-object properties + materials +
   lighting, editable. Ships now, needs no new foundation.
2. Verify/fix cross-island selection + layers<->scene sync (reqs 1–3) — verify in the
   live app, fix broken cases (most likely ghost/unmaterialized islands).
3. Sub-object foundation — object IDs + sub-mesh raycasting. Gates 6/8/9.
4. Hover sub-parts (6) + sub-object transform with saved overrides (9) + explode view (7).
5. Sculpting (8) — voxels + mesh deform, all object types. Largest, last.

Locked scope decisions for the later slices (recorded so this slice's data model does
not box them out): sculpting covers voxels **and** mesh deform; sub-object editing
applies to **all** object types; lighting means **both** material glow and real light
sources.

## What already exists (do NOT rebuild)

The inspector is already implemented as `renderSelectionProperties(summary, entries)` in
`engine/world/28-generate-panel-agent.js:1767`, surfaced inside the layers dialog. It is
chip/preset-based and already covers:

- **Edit**: undo/redo, apply-tool/delete, copy/cut/paste/duplicate, save/paste template
- **Transform**: rotate L/R, shift N/S/E/W, scale (uniform + per-axis X/Y/Z), nudge
  XYZ + center, reset, size S/M/L
- **Appearance**: all/body/top material presets + texture-scale steppers, normal/voxel
  style, color swatches, building shape
- **Ground**: terrain type, height, water flow

Edits apply through `applySelectionProperty(rowKey, value)`
(`28-generate-panel-agent.js:1600`), which mutates cells via `updateSelectedBoardObjects`
/ `moveSelectedBoardObject` / `scaleSelectedBoardObject` / `sel.rotate`.

## Gaps this slice closes

1. No current-value readouts — everything is a relative chip/stepper; no way to see or
   type exact position / rotation / scale.
2. No material-finish/shading properties — only texture presets. No emissive, opacity.
3. No lighting — no glow, no light sources.

## Key constraints discovered

- **`normalizeAppearance` (`04-textures.js:1972`) is a strict allowlist.** It rebuilds the
  appearance object from known keys only and silently drops everything else. New fields
  MUST be registered here, or they will never persist or render. This is also the
  material-cache signature (via `sameAppearance`), so registering fields here gives PBR-
  style overrides cached material variants instead of per-object material leaks.
- **Materials are `MeshLambertMaterial` (100×) + `MeshBasicMaterial` (13×). No PBR.**
  Lambert supports `emissive`/`emissiveIntensity` and `opacity`/`transparent`, but NOT
  metalness/roughness. Material model is therefore Lambert-native (decision below).
- **`customMaterial()` (`04-textures.js:1940`)** already clones + caches Lambert materials
  by a composed key. Emissive/opacity/finish extend this exact path.
- Per-cell `appearance` already serializes in `buildWorldStateObject`
  (`29-persistence-api.js`), so new appearance fields persist automatically once allowed.

## Design

### A. Principle
Extend the existing inspector + dispatch. New controls follow the existing row→handler
pattern. All new behavior is gated behind a feature flag (`window.__tinyworldFlags
.inspectorV2`) for auto-push-to-prod safety. Flag off => inspector renders exactly as
today.

### B. Data model (single integration point: `normalizeAppearance`)
New optional appearance fields, all defaulting to unset, all clamped:
- `emissiveColor` (hex), `emissiveIntensity` (0–2)
- `opacity` (0–1)
- `finish` (`matte` | `satin` | `glow`)
- `light` (`null` or `{ type: 'point'|'spot', color: hex, intensity: 0–4, range: 0–20 }`)

No `STORAGE_VERSION` bump — additive optional fields; old saves lack them and default safely.

### C. Transform — Precise (hybrid)
Keep existing chips. Add a collapsible **Precise** block under Transform:
- **Position**: editable within-tile offset X/Y/Z (numeric). Cell coordinate + island
  shown read-only. (We edit the offset — the real DOF — not absolute world coords, which
  fight the grid.)
- **Rotation Y**: degrees field + slider.
- **Scale**: uniform + per-axis X/Y/Z numeric.

Each precise control computes `desired − current` and calls the existing mutators
(`moveSelectedBoardObject`, `scaleSelectedBoardObject`, `sel.rotate`). No new write path.
Multi-select shows a value only when uniform; applying sets all selected.

### D. Material — Lambert-native
New **Material** section for any object cell:
- Base color (picker)
- **Finish** preset chips: matte / satin / glow
- Precise block: emissive color + glow intensity (slider), opacity (slider)

Rendering extends `customMaterial()`: add emissive/opacity/finish to the cache key and
apply to the cloned Lambert material. `transparent` set when opacity < 1. No
metalness/roughness.

### E. Lighting — emissive everywhere + capped real-light pool
- **Glow** = the emissive controls in D (cheap, any object).
- **Real light** (opt-in): a **Light** section sets type/color/intensity/range, stored in
  `appearance.light`. New module `engine/world/44-object-light-pool.js` keeps a fixed pool
  (~12 shadowless `PointLight`/`SpotLight`). Each throttled update it assigns pool slots to
  the nearest camera-active cells that declare a light; objects beyond the pool fall back
  to emissive glow so they still read as lit. Recompute throttled on camera move + on
  `tinyworld:world-changed`.

This is the riskiest component (per-frame assignment + render cost). It is bounded and
flag-gated.

### F. "Every object type"
Material + Light + Precise-transform rows appear for all object kinds (`objectCells`,
`selectedBoardObjectTargets`). Terrain-only cells keep ground controls. Per-kind hiding
stays as today.

### G. Feature flag
`window.__tinyworldFlags.inspectorV2`, resolved once at boot from localStorage
(`tinyworld:flags.inspectorV2`) or `?inspectorV2=1`. Default OFF for now.

### H. Testing
- Unit (`tests/*.test.mjs`): `normalizeAppearance` round-trips + clamps new fields;
  `sameAppearance` distinguishes them; `light` normalize/clamp; finish enum guard.
- `npm run check` + `npm run smoke` + `npm test` clean; `git diff --check` clean.
- Live-app verification (real app, 3D math — not screenshots/synthetic events): select
  objects across multiple islands; set emissive/opacity/finish/light; reload => values
  persist; probe material.emissive / material.opacity and pool-light world positions via
  3D math.

## Non-goals (this slice)
- No central selection-state refactor (existing event-driven sync works; extend additively).
- No sub-object / per-voxel addressing (later slices).
- No metalness/roughness / PBR material class swap.
- No absolute-world-position editing (offset-based only).
