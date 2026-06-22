---
name: tinyworld-settings
description: Use when changing Tiny World Builder Settings modal tabs, panels, controls, rendering/world/material/crowd/AI settings, or settings accessibility.
---

# Tiny World Settings

Settings live in `tiny-world-builder.html` inside `#render-modal`.

Keep settings changes compatible with the existing static single-file app:

- Preserve `data-settings-tab` values (`app`, `rendering`, `world`, `materials`, `environment`, `crowd`, `ai`) unless every command-palette and settings caller is updated in the same change.
- Preserve existing control IDs. The settings setup code binds controls by `getElementById`, so moving controls between sections is safe but renaming IDs is not.
- `selectSettingsTab(name)` must guard unknown names and update all tab and panel state together: `.active`, `aria-selected`, tab `tabIndex`, panel `.active`, and panel `hidden`.
- Settings tabs should remain real `role="tab"` buttons inside a `role="tablist"` and support click plus Arrow/Home/End keyboard navigation.
- Panels should be `role="tabpanel"` with stable IDs and `aria-labelledby` pointing at the matching tab.
- Settings search should be a thin UI layer over the existing tab/panel wiring: never rename controls for search, keep hidden rows reversible when the query clears, and route automatic tab changes through `selectSettingsTab()`.
- Search result counts may be shown inside tab buttons, but keep the tab's `data-settings-tab` value, `role`, keyboard navigation, and accessible label in sync.

Structure rules:

- Keep settings grouped by user intent, not implementation variable names.
- Current top-level tabs are Workspace, Rendering, World, Materials, Environment, Crowd, and AI.
- Tabs should stay dense and scannable: desktop may show a short hint; mobile should keep a compact horizontal tab strip.
- Mobile/short-screen scroll: `.settings-card` is height-capped (`max-height: calc(100vh - 100px)`, `dvh` on phones) and the panels scroll internally (`.settings-panels { overflow-y: auto }`, layout `flex:1 1 auto; min-height:0`). Never let the card grow unbounded again — on a phone that pushes lower controls off-screen and they become unreachable. On phones the layout is `grid-template-rows: auto minmax(0,1fr)` so the panels row is the scroller.
- Add `data-settings-keywords` when a setting or panel should be discoverable by broader user language such as performance, mechanics, textures, weather, or model.
- Preserve the existing `data-settings-tab` / `data-settings-panel` wiring, ARIA roles, keyboard tab navigation, and search-count chips.
- Search should route broad category terms to the right panel without hiding the controls in that panel.

Organization guidance:

- App/Workspace owns the UI theme selector (`ui-theme-mode`). `Auto` follows
  live UK/BST time-of-day, `Dark` forces dark chrome, and `Light` forces light
  chrome without auto-darkening after-hours.
- Rendering: keep image/render-cost controls grouped by intent. `Quality` covers resolution and shadows; `Lighting` covers lighting and fill controls; `Image effects` covers brightness, saturation, contrast, pixelation, shader AA, and tilt-shift.
- World: preview/ghost controls are intentionally removed and forced to zero; do not reintroduce distance/window/opacity controls unless Preview rendering is explicitly brought back. Terrain style covers voxel bevel, landscape/planet toggles, voxel/cottage, and terrain voxel resolution. `Voxel gap` and `Show crowns` are also intentionally removed from the UI and forced off for render stability/performance.
- Environment owns the `Planes` checkbox (`render-planes-enabled`) because it
  controls ambient flyovers and towed banners. It defaults off for the current
  performance pass and should stay searchable by plane/crop-duster/banner terms.
- Environment owns the admin-only Watcher controls (`watcher-*`). The Watcher
  visual is sourced from `engine/world/assets/god-face_15.html`, rendered by
  `engine/world/69-watcher-layer.js`, and must stay a transient Three scene
  layer, not saved world data. Keep it world-anchored with X/Y/Z controls so it
  zooms/pans with the island; do not re-lock it to the camera. Leave depth
  testing enabled so a distant Watcher sits behind the island instead of
  painting over it.
- Material wear defaults to 100% (`materialWear: '1'` and shipped
  `tinyworld:render:materialWear` = `1.00`). When changing shipped render
  defaults that must override older browser localStorage, bump
  `RENDER_SETTINGS_VERSION` and update `tinyworld-defaults.json` together.
- Materials, Environment, Crowd, and AI can be improved independently, but keep their current control IDs and listener wiring intact.

Validation:

- Run the inline script syntax check, `npm test`, and `npm run build`.
- Browser-check Settings opens, every tab can be selected, only one panel is visible, search routes to matching sections and clears cleanly, Arrow/Home/End navigation works, command-palette-style tab clicks still work, and the console has no app errors.
- For responsive settings changes, also check desktop and mobile widths: no horizontal page overflow, tab text does not overflow, search switches to expected panels, and console has no fresh warnings/errors.
