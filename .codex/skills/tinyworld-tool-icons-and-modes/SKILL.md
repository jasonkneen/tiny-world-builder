---
name: tinyworld-tool-icons-and-modes
description: Use when changing Tiny World Builder tool icons/thumbnails, the placement ghost preview, the mode indicator, deterministic next-item suggestions, or boot tool selection.
---

# Tiny World Tool Icons, Mode Safety & Suggestions

## Pre-baked PNG icons (no runtime WebGL thumbs)

Tool icons are shipped as PNGs in `icons/`, not rendered live.

- `tools/bake-icons.js` (`npm run icons`) drives the real app in headless
  Chromium (SwiftShader software WebGL) and calls the in-app hook
  `window.__twBakeIcons()` in `19-tools-toolbar.js`. That hook walks `TOOLS` +
  variants and calls `bakeToolIcon(tool)` (reuses `makeThumbObject` +
  `thumbFrameFor`), writing one transparent PNG per `thumbCacheKeyForTool(tool)`
  plus `icons/manifest.json`.
- Object tools are cut out on alpha (no ground tile); terrain/island tools keep
  their tile. The cache key (e.g. `house:cottage`, `fence:north`, `grass`)
  becomes the filename with `:`/odd chars → `__`.
- At runtime `preloadStaticIcons()` fetches the manifest and loads each PNG
  straight into `thumbBitmapCache` (keyed by `thumbCacheKeyForTool`). The
  existing thumb pipeline checks that cache first, so the off-DOM WebGL
  thumbnail renderer is never created for any tool that has a baked icon. Only
  meta tools with no object (select/erase/mooring) still fall through to a
  one-time live render.
- `drainToolThumbBuildQueue` waits (bounded) for a *pending* static icon rather
  than rendering a scene for it — see `hasOrExpectsStaticIcon`.
- **After adding/renaming a tool or variant, re-run `npm run icons` and commit
  the new PNGs + manifest.** `publish.sh` copies `icons/` (and `styles/`) into
  `dist/`.

## Ghost placement preview is a billboard, not a mesh

`buildGhostMesh` (`18-scene-pick-xr.js`) first tries `buildGhostBillboard`: a
`THREE.Sprite` textured from the baked icon (via `getStaticIconImage`). This
replaces rebuilding a full 3D object every cursor move. Falls back to the 3D
mesh only for terrain swatches and user stamps with no baked icon. Dispose
billboards by hand (material + map) — never `disposeGroup` a sprite (shared
geometry). `window.__twRefreshGhostPreview()` rebuilds the ghost when an icon
arrives late.

## Mode safety

- Boot always ends on the Select tool: `bootApp` calls
  `selectTool(DEFAULT_TOOL)` *after* `loadState()`, so a restored world's saved
  `toolId` never leaves a fresh session "armed" for building.
- `#mode-indicator` (HUD chip, updated in `updateModeIndicator`) names the
  current mode and colours itself: calm `mode-select`, amber `mode-build`, red
  `mode-erase`. Keep it `pointer-events:none`.
- `Esc` disarms any build/paint/erase tool back to Select (handler in
  `20-input-place-erase.js`, skipped in first-person walk mode).

## Deterministic next-item suggestions

`SUGGESTION_RULES` in `19-tools-toolbar.js` maps a held tool id → ordered next
tools (rule-based, no AI). `updateSuggestions` renders the `#suggestion-bar`
strip; `window.__twNotifyPlacement()` (called from the placement commit) keeps
it live while building. The first entry is usually "continue" (same tool/
variant). To extend, add a rule entry — buttons reuse the icon pipeline.

## Gotcha

`npm test` (`tools/check.js` / `smoke-static.js`) is stale post-split: it
string-matches the old inline `<script>`/`setCell(` in
`tiny-world-builder.html` and fails regardless of these changes. Verify with a
headless boot (no new console errors) instead.
