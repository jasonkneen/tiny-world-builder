# Extended Object Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing selection inspector so every object exposes editable precise transform, Lambert-native material/finish/glow, and an optional capped real-light source — all persisted per cell and gated behind a feature flag.

**Architecture:** Additive only. New per-object fields flow through `normalizeAppearance` (the allowlist + material-cache signature). Material surface props apply at the existing `applyAppearanceToObject` chokepoint via a new clone+cache helper. Inspector gains numeric/slider/colorpicker control types and new Material/Light rows + a Precise transform block, all rendered only when `window.__tinyworldFlags.inspectorV2` is on. Real lights are served by a small fixed pool module.

**Tech Stack:** Vanilla JS engine modules (`engine/world/NN-*.js`), Three.js r128 (`MeshLambertMaterial`), Node `--test` unit tests (`tests/*.test.mjs`), `npm test` = check + smoke + unit.

---

## File Structure

- `engine/world/04-textures.js` — MODIFY: extend `normalizeAppearance` allowlist (new fields), add `surfaceMaterial()` helper, apply surface props in `applyAppearanceToObject.remap`.
- `engine/world/21-object-transform-voxel-build.js` — MODIFY: add absolute setters `setSelectedBoardObjectOffsetAxis`, `setSelectedBoardObjectRotation`, `setSelectedBoardObjectScaleValue`.
- `engine/world/28-generate-panel-agent.js` — MODIFY: render numeric/slider/colorpicker controls; add Material + Light rows and Precise transform block; extend `applySelectionProperty` handlers.
- `engine/world/44-object-light-pool.js` — CREATE: capped real-light pool keyed off `appearance.light`.
- `engine/world/00-prelude.js` (or earliest boot module) — MODIFY: initialise `window.__tinyworldFlags`.
- `tests/appearance-surface.test.mjs` — CREATE: unit tests for normalize/clamp of new fields.

The new fields (all optional): `emissiveColor` (hex), `emissiveIntensity` (0–2), `opacity` (0–1), `finish` (`matte|satin|glow`), `light` (`null | {type:'point'|'spot', color:hex, intensity:0–4, range:0–20}`).

---

## Task 1: Feature flag + appearance data model

**Files:**
- Modify: `engine/world/00-prelude.js` (top, after IIFE open)
- Modify: `engine/world/04-textures.js:1972-2034` (`normalizeAppearance`)
- Test: `tests/appearance-surface.test.mjs`

- [ ] **Step 1: Add the flag init** in `00-prelude.js` near other `window.__tinyworld*` setup:

```js
// Inspector v2 (extended object inspector) — opt-in while it stabilises.
try {
  const qs = new URLSearchParams(location.search);
  const stored = localStorage.getItem('tinyworld:flags.inspectorV2');
  window.__tinyworldFlags = window.__tinyworldFlags || {};
  window.__tinyworldFlags.inspectorV2 =
    qs.get('inspectorV2') === '1' || stored === '1';
} catch (_) {
  window.__tinyworldFlags = window.__tinyworldFlags || { inspectorV2: false };
}
```

- [ ] **Step 2: Extend `normalizeAppearance`** — add normalizers before `const out = {};` (line 2010) and emit guarded keys before `return`:

```js
    const clampNum = (raw, lo, hi) => {
      const n = Number(raw);
      return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null;
    };
    const emissiveColor = normalizeHexColor(value.emissiveColor || value.emissive || value.glowColor);
    const emissiveIntensity = clampNum(value.emissiveIntensity !== undefined ? value.emissiveIntensity : value.glow, 0, 2);
    const opacity = clampNum(value.opacity, 0, 1);
    const rawFinish = String(value.finish || '').toLowerCase();
    const finish = (rawFinish === 'matte' || rawFinish === 'satin' || rawFinish === 'glow') ? rawFinish : null;
    let light = null;
    if (value.light && typeof value.light === 'object') {
      const lt = String(value.light.type || '').toLowerCase();
      const type = (lt === 'point' || lt === 'spot') ? lt : null;
      if (type) {
        light = {
          type,
          color: normalizeHexColor(value.light.color) || '#ffd9a0',
          intensity: clampNum(value.light.intensity, 0, 4) ?? 1,
          range: clampNum(value.light.range, 0, 20) ?? 6,
        };
      }
    }
```

  Then before `return Object.keys(out).length ? out : null;`:

```js
    if (emissiveColor) out.emissiveColor = emissiveColor;
    if (emissiveIntensity !== null && emissiveIntensity > 0.001) out.emissiveIntensity = +emissiveIntensity.toFixed(3);
    if (opacity !== null && opacity < 0.999) out.opacity = +opacity.toFixed(3);
    if (finish && finish !== 'matte') out.finish = finish;
    if (light) out.light = light;
```

- [ ] **Step 3: Write unit tests** `tests/appearance-surface.test.mjs`. Because `normalizeAppearance` is module-private inside an IIFE, the test extracts and evals just that function plus its small deps (`normalizeHexColor`, `normalizeMaterialTextureKey`, `normalizeMaterialTextureScale`) the same way other tests in `tests/` slice engine functions — mirror the existing extraction pattern used by a sibling test (inspect `tests/*.test.mjs` for the helper). Assertions:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
// load normalizeAppearance via the repo's existing engine-fn extraction helper

test('emissive + opacity round-trip and clamp', () => {
  const a = normalizeAppearance({ emissiveColor: '#ffcc88', emissiveIntensity: 5, opacity: -1 });
  assert.equal(a.emissiveColor, '#ffcc88');
  assert.equal(a.emissiveIntensity, 2);      // clamped to hi
  assert.equal(a.opacity, 0);                // clamped to lo
});

test('finish enum guard + matte is default-dropped', () => {
  assert.equal(normalizeAppearance({ finish: 'satin' }).finish, 'satin');
  assert.equal(normalizeAppearance({ finish: 'matte' }), null); // matte == default => no keys
  assert.equal(normalizeAppearance({ finish: 'bogus' }), null);
});

test('light normalizes type, drops invalid', () => {
  const a = normalizeAppearance({ light: { type: 'point', color: '#fff', intensity: 9, range: 99 } });
  assert.deepEqual(a.light, { type: 'point', color: '#ffffff', intensity: 4, range: 20 });
  assert.equal(normalizeAppearance({ light: { type: 'laser' } }), null);
});
```

- [ ] **Step 4: Run tests, expect FAIL then PASS**

Run: `node --test tests/appearance-surface.test.mjs`
Expected after Step 2: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add engine/world/00-prelude.js engine/world/04-textures.js tests/appearance-surface.test.mjs
git commit -m "Add inspector flag + emissive/opacity/finish/light appearance fields"
```

---

## Task 2: Lambert-native surface material rendering

**Files:**
- Modify: `engine/world/04-textures.js` (add `surfaceMaterial`, call in `applyAppearanceToObject.remap`)

- [ ] **Step 1: Add `surfaceMaterial` helper** near `customMaterial` (after line 1953):

```js
  function surfaceMaterial(base, a) {
    if (!base || !base.clone || !a) return base;
    const hasEmissive = !!(a.emissiveColor) || (a.finish && a.finish !== 'matte');
    const hasOpacity = a.opacity !== undefined && a.opacity < 0.999;
    if (!hasEmissive && !hasOpacity) return base;
    const emHex = a.emissiveColor || (base.color ? '#' + base.color.getHexString() : '#000000');
    const finishBoost = a.finish === 'glow' ? 0.6 : a.finish === 'satin' ? 0.12 : 0;
    const emInt = Math.max(0, Math.min(2, (a.emissiveIntensity || 0) + finishBoost));
    const op = hasOpacity ? a.opacity : 1;
    const key = (base.uuid || base.id || 'mat') + ':surf:' + emHex + ':' + emInt.toFixed(3) + ':' + op.toFixed(3);
    if (!customMaterialCache.has(key)) {
      const mat = base.clone();
      if (base.onBeforeCompile) mat.onBeforeCompile = base.onBeforeCompile;
      if (mat.emissive && (hasEmissive)) { mat.emissive.set(emHex); mat.emissiveIntensity = emInt; }
      if (hasOpacity) { mat.transparent = true; mat.opacity = op; }
      customMaterialCache.set(key, mat);
    }
    return customMaterialCache.get(key);
  }
```

  Note: `MeshBasicMaterial` has no `.emissive`; the `if (mat.emissive ...)` guard skips it. Opacity still applies.

- [ ] **Step 2: Apply in `remap`** — in `applyAppearanceToObject`, change the end of `remap` (line 2087-2088) to run surface after color/texture:

```js
      if (a.materialTexture) next = customTextureMaterial(next, a.materialTexture, a.materialTextureScale || 1);
      next = surfaceMaterial(next, a);
      return next;
```

- [ ] **Step 3: Verify build + smoke**

Run: `npm run check && npm run smoke`
Expected: PASS, no errors.

- [ ] **Step 4: Commit**

```bash
git add engine/world/04-textures.js
git commit -m "Apply Lambert emissive/opacity/finish surface to objects"
```

---

## Task 3: Absolute transform setters

**Files:**
- Modify: `engine/world/21-object-transform-voxel-build.js` (after `moveSelectedBoardObject`, ~line 1082)

- [ ] **Step 1: Add absolute setters** mirroring the relative ones (reuse the same `limits` clamp pattern from `moveSelectedBoardObject`; read it from the existing function or replicate its `limits` computation):

```js
  function setSelectedBoardObjectOffsetAxis(axis, value) {
    updateSelectedBoardObjects(target => {
      const limits = boardObjectOffsetLimits(target); // factor out of moveSelectedBoardObject; returns {xz,yMin,yMax}
      const v = Number(value); if (!Number.isFinite(v)) return null;
      if (axis === 'x') return { offsetX: Math.max(-limits.xz, Math.min(limits.xz, v)) };
      if (axis === 'y') return { offsetY: Math.max(limits.yMin, Math.min(limits.yMax, v)) };
      if (axis === 'z') return { offsetZ: Math.max(-limits.xz, Math.min(limits.xz, v)) };
      return null;
    });
  }
  function setSelectedBoardObjectRotation(rad) {
    const v = Number(rad); if (!Number.isFinite(v)) return;
    updateSelectedBoardObjects(() => ({ rotationY: v }));
  }
  function setSelectedBoardObjectScaleValue(value, axis) {
    const v = Math.max(0.15, Math.min(5, Number(value) || 1));
    updateSelectedBoardObjects(target => {
      const appearance = Object.assign({}, normalizeAppearance(target.cell.appearance) || {});
      if (!axis) appearance.objectScale = v;
      else appearance['scale' + axis.toUpperCase()] = v;
      return { appearance };
    });
  }
```

  Refactor: extract the `limits` object currently computed inside `moveSelectedBoardObject` (line ~1073) into `boardObjectOffsetLimits(target)` and call it from both places. Keep `moveSelectedBoardObject` behaviour identical.

- [ ] **Step 2: Verify check**

Run: `npm run check`
Expected: PASS (no undefined refs).

- [ ] **Step 3: Commit**

```bash
git add engine/world/21-object-transform-voxel-build.js
git commit -m "Add absolute transform setters for precise inspector editing"
```

---

## Task 4: Inspector controls — numeric / slider / colorpicker

**Files:**
- Modify: `engine/world/28-generate-panel-agent.js` (`renderSelectionProperties` render loop ~2112-2151; `applySelectionProperty` ~1600)

- [ ] **Step 1: Render new control types.** In the `rows.forEach(row => {...})` loop, before the existing `row.options.forEach`, branch when `row.control` is `numeric|slider|colorpicker` and render an `<input>` instead of chips, wiring `change`/`input` to `applySelectionProperty(row.key, inputValue)`:

```js
          if (row.control === 'numeric' || row.control === 'slider' || row.control === 'colorpicker') {
            const input = document.createElement('input');
            input.type = row.control === 'colorpicker' ? 'color' : (row.control === 'slider' ? 'range' : 'number');
            if (row.min !== undefined) input.min = row.min;
            if (row.max !== undefined) input.max = row.max;
            if (row.step !== undefined) input.step = row.step;
            if (row.currentValue !== undefined && row.currentValue !== null) input.value = row.currentValue;
            input.className = 'selection-prop-input control-' + row.control;
            input.setAttribute('aria-label', row.label);
            const handler = e => { e.stopPropagation(); applySelectionProperty(row.key, input.value); };
            input.addEventListener('change', handler);
            if (row.control === 'slider') input.addEventListener('input', handler);
            options.appendChild(input);
            wrap.appendChild(label); wrap.appendChild(options); sectionWrap.appendChild(wrap);
            return; // skip chip rendering for this row
          }
```

- [ ] **Step 2: Add apply handlers** in `applySelectionProperty` (before the final fallthrough):

```js
      if (rowKey === 'posX') { setSelectedBoardObjectOffsetAxis('x', value); return; }
      if (rowKey === 'posY') { setSelectedBoardObjectOffsetAxis('y', value); return; }
      if (rowKey === 'posZ') { setSelectedBoardObjectOffsetAxis('z', value); return; }
      if (rowKey === 'rotDeg') { setSelectedBoardObjectRotation((Number(value) || 0) * Math.PI / 180); return; }
      if (rowKey === 'scaleAbs') { setSelectedBoardObjectScaleValue(value); return; }
      if (rowKey === 'emissiveColor' || rowKey === 'emissiveIntensity' || rowKey === 'opacity' || rowKey === 'finish' || rowKey === 'baseColor') {
        updateSelectedBoardObjects(target => {
          const appearance = Object.assign({}, normalizeAppearance(target.cell.appearance) || {});
          if (rowKey === 'baseColor') appearance.bodyColor = value;
          else if (rowKey === 'finish') { if (value === 'matte') delete appearance.finish; else appearance.finish = value; }
          else if (rowKey === 'emissiveColor') appearance.emissiveColor = value;
          else if (rowKey === 'emissiveIntensity') appearance.emissiveIntensity = Number(value) || 0;
          else if (rowKey === 'opacity') appearance.opacity = Number(value);
          return { appearance };
        });
        return;
      }
```

- [ ] **Step 3: Verify check + smoke**

Run: `npm run check && npm run smoke`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add engine/world/28-generate-panel-agent.js
git commit -m "Add numeric/slider/colorpicker inspector controls + apply handlers"
```

---

## Task 5: Precise transform block + Material section rows

**Files:**
- Modify: `engine/world/28-generate-panel-agent.js` (`renderSelectionProperties` row-building ~1877-1953)

- [ ] **Step 1: Gate behind flag + add rows.** Inside `if (selectedTargets.length) {` block, when `window.__tinyworldFlags?.inspectorV2`, push precise rows. Read current uniform values via existing `uniformValue` helper over `objectCells`:

```js
        if (window.__tinyworldFlags && window.__tinyworldFlags.inspectorV2) {
          const ap = cell => normalizeAppearance(cell.appearance) || {};
          addRows('Transform', [
            { key: 'posX', label: 'Pos X', control: 'numeric', min: -0.5, max: 0.5, step: 0.01, currentValue: uniformValue(objectCells, c => +(c.offsetX || 0).toFixed(2)) },
            { key: 'posY', label: 'Pos Y', control: 'numeric', min: -0.5, max: 2, step: 0.01, currentValue: uniformValue(objectCells, c => +(c.offsetY || 0).toFixed(2)) },
            { key: 'posZ', label: 'Pos Z', control: 'numeric', min: -0.5, max: 0.5, step: 0.01, currentValue: uniformValue(objectCells, c => +(c.offsetZ || 0).toFixed(2)) },
            { key: 'rotDeg', label: 'Rot Y°', control: 'slider', min: 0, max: 360, step: 1, currentValue: uniformValue(objectCells, c => Math.round(((c.rotationY || 0) * 180 / Math.PI) % 360)) },
            { key: 'scaleAbs', label: 'Scale', control: 'slider', min: 0.2, max: 4, step: 0.05, currentValue: uniformValue(objectCells, c => +(ap(c).objectScale || 1).toFixed(2)) },
          ]);
          addRows('Appearance', [
            { key: 'baseColor', label: 'Base color', control: 'colorpicker', currentValue: uniformValue(objectCells, c => ap(c).bodyColor || null) },
            { key: 'finish', label: 'Finish', currentValue: uniformValue(objectCells, c => ap(c).finish || 'matte'), options: [
              { label: 'Matte', value: 'matte' }, { label: 'Satin', value: 'satin' }, { label: 'Glow', value: 'glow' } ] },
            { key: 'emissiveColor', label: 'Glow color', control: 'colorpicker', currentValue: uniformValue(objectCells, c => ap(c).emissiveColor || '#ffcc88') },
            { key: 'emissiveIntensity', label: 'Glow', control: 'slider', min: 0, max: 2, step: 0.05, currentValue: uniformValue(objectCells, c => +(ap(c).emissiveIntensity || 0).toFixed(2)) },
            { key: 'opacity', label: 'Opacity', control: 'slider', min: 0, max: 1, step: 0.05, currentValue: uniformValue(objectCells, c => +(ap(c).opacity ?? 1).toFixed(2)) },
          ]);
        }
```

- [ ] **Step 2: Verify check + smoke**

Run: `npm run check && npm run smoke`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add engine/world/28-generate-panel-agent.js
git commit -m "Add Precise transform + Material rows to inspector (flag-gated)"
```

---

## Task 6: Light section + capped light pool module

**Files:**
- Create: `engine/world/44-object-light-pool.js`
- Modify: `engine/world/28-generate-panel-agent.js` (Light rows in `renderSelectionProperties`; `applySelectionProperty` light handlers)

- [ ] **Step 1: Create the pool module.** Build it on the established module pattern (read `engine/world/39-atmosphere-effects.js` header to match IIFE/registration style). Responsibilities:
  - `ensurePool(scene)` lazily creates ~12 `THREE.PointLight` (castShadow=false), parked off-screen, intensity 0.
  - `collectLitCells()` scans `world` for cells whose `normalizeAppearance(cell.appearance).light` is set, computes each one's world position (reuse the same cell→world transform the renderer uses).
  - `assignNearest(camera)` sorts lit cells by distance to camera, assigns the nearest N to pool slots (set position/color/intensity/distance), zeroes the rest.
  - Throttle `assignNearest` to ~4/sec and on `tinyworld:world-changed`. Only active when `window.__tinyworldFlags.inspectorV2`.
  - Hook the per-frame call into the existing animation loop (find the tick dispatch in `25-animation-loop-schema.js` / `99-late-boot.js` and add a guarded `tickObjectLightPool(camera)`), matching how other per-frame systems register.

- [ ] **Step 2: Add Light rows** (flag-gated, in the same inspectorV2 block as Task 5):

```js
          const lightOf = c => (normalizeAppearance(c.appearance) || {}).light || null;
          addRows('Appearance', [
            { key: 'lightType', label: 'Light', currentValue: uniformValue(objectCells, c => (lightOf(c) ? lightOf(c).type : 'none')), options: [
              { label: 'Off', value: 'none' }, { label: 'Point', value: 'point' }, { label: 'Spot', value: 'spot' } ] },
            { key: 'lightColor', label: 'Light color', control: 'colorpicker', currentValue: uniformValue(objectCells, c => (lightOf(c) ? lightOf(c).color : '#ffd9a0')) },
            { key: 'lightIntensity', label: 'Light int', control: 'slider', min: 0, max: 4, step: 0.1, currentValue: uniformValue(objectCells, c => (lightOf(c) ? lightOf(c).intensity : 0)) },
            { key: 'lightRange', label: 'Light range', control: 'slider', min: 1, max: 20, step: 0.5, currentValue: uniformValue(objectCells, c => (lightOf(c) ? lightOf(c).range : 6)) },
          ]);
```

- [ ] **Step 3: Add light apply handlers** in `applySelectionProperty`:

```js
      if (rowKey === 'lightType' || rowKey === 'lightColor' || rowKey === 'lightIntensity' || rowKey === 'lightRange') {
        updateSelectedBoardObjects(target => {
          const appearance = Object.assign({}, normalizeAppearance(target.cell.appearance) || {});
          if (rowKey === 'lightType') {
            if (value === 'none') delete appearance.light;
            else appearance.light = Object.assign({ color: '#ffd9a0', intensity: 1, range: 6 }, appearance.light || {}, { type: value });
          } else if (appearance.light) {
            if (rowKey === 'lightColor') appearance.light = Object.assign({}, appearance.light, { color: value });
            if (rowKey === 'lightIntensity') appearance.light = Object.assign({}, appearance.light, { intensity: Number(value) || 0 });
            if (rowKey === 'lightRange') appearance.light = Object.assign({}, appearance.light, { range: Number(value) || 6 });
          }
          return { appearance };
        });
        try { window.dispatchEvent(new CustomEvent('tinyworld:world-changed')); } catch (_) {}
        return;
      }
```

- [ ] **Step 4: Verify build + smoke + full test**

Run: `npm test && git diff --check`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add engine/world/44-object-light-pool.js engine/world/28-generate-panel-agent.js engine/world/25-animation-loop-schema.js engine/world/99-late-boot.js
git commit -m "Add per-object light section + capped light pool (flag-gated)"
```

---

## Task 7: Live-app verification

**Files:** none (verification only)

- [ ] **Step 1: Build + boot** (`npm run build`, serve `dist/` via `npm run dev`), open with `?inspectorV2=1`.
- [ ] **Step 2:** Select an object on the **home island** and one on a **sky island**; confirm Precise + Material + Light rows appear for both, and current values populate.
- [ ] **Step 3:** Set emissive glow, opacity 0.5, finish=glow, a point light; via console probe (3D math, NOT screenshots): find the object's mesh, assert `material.emissive.getHexString()`, `material.opacity`, `material.transparent`, and that a pool light exists near the object's world position.
- [ ] **Step 4:** Reload; confirm all values persist (localStorage world state) and re-render identically.
- [ ] **Step 5:** Set `inspectorV2` off (remove query param, clear flag); confirm inspector renders exactly as before (no new rows, no pool lights).
- [ ] **Step 6: Final commit** of any verification-driven fixes; update spec status to "Implemented".

```bash
git add -A
git commit -m "Verify extended inspector in live app; finalize slice 1"
```

---

## Self-Review notes
- Spec coverage: req 4 (color/size/position) → Tasks 3–5; req 5 (materials + lighting) → Tasks 2,5,6. Cross-island (1–3) explicitly deferred to slice 2 per spec.
- No metalness/roughness anywhere (Lambert-native decision honored).
- Function names consistent across tasks: `setSelectedBoardObjectOffsetAxis`, `setSelectedBoardObjectRotation`, `setSelectedBoardObjectScaleValue`, `surfaceMaterial`, `boardObjectOffsetLimits`, `tickObjectLightPool`.
- All new persisted fields registered in `normalizeAppearance` (Task 1) so persistence rides existing save path; no `STORAGE_VERSION` bump.
- Everything new flag-gated (`window.__tinyworldFlags.inspectorV2`).
