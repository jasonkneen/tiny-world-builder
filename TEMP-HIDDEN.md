# Temporarily Hidden UI Items

Running log of UI elements hidden "for now". Each entry says exactly how to restore it.

## Hidden 2026-06-15

### 1. Mesh build button in the Terrain menu
- **What:** the `mesh-terrain` ("Mesh Terrain") entry in the bottom-toolbar **Terrain** flyout.
- **Where:** `engine/world/19-tools-toolbar.js` — `TOOL_GROUPS` `terrain` group.
- **How it's hidden:** `'mesh-terrain'` removed from the `terrain.toolIds` array (see `TEMP-HIDDEN` comment).
- **Restore:** add `'mesh-terrain'` back to that `toolIds` array.

### 2. Shield button (bottom toolbar)
- **What:** the `toolbar-shield-toggle` (Raise/Lower shield) utility button.
- **Where:** `styles/tiny-world.css` — `TEMP-HIDDEN` rule `#toolbar-shield-toggle { display: none !important; }`.
- **How it's hidden:** CSS only. The button is still built in `engine/world/19-tools-toolbar.js` (`buildToolbarUtilityButton('toolbar-shield-toggle', ...)`) so `npm run check` still passes.
- **Restore:** delete the `#toolbar-shield-toggle` rule.

### 3. Play button (main / welcome menu)
- **What:** the `welcome-play` ("Play") button on the launch screen.
- **Where:** `styles/tiny-world.css` — `TEMP-HIDDEN` rules next to `.welcome-actions`.
- **How it's hidden:** `#welcome-play { display: none !important; }`, and `#welcome-build { grid-column: 1 / -1; }` makes **Build** span the whole bottom row.
- **Restore:** delete those two rules.

### 4. Avatar picker categories — Pets / Warriors / Orcs
- **What:** the `pets`, `warriors`, and `orcs` avatar provider tabs in the avatar picker. Only **Voxel** remains (and it's the default).
- **Where:** `engine/world/49-worlds-avatar-picker.js` — the three `WS.registerAvatarProvider(...)` calls are commented out (`REMOVED:` notes). The `PETS` / `STRIP_PACKS` data is kept.
- **Also:** `renderTabs()` now hides the tab bar when only one visible category remains (goes straight to the Voxel customizer).
- **Restore:** un-comment the three registrations.

### 5. Edge portal + its sign (lobby/demo)
- **What:** the sky-edge stargate portal and the "GROUND LEVEL" sign placed next to it on world enter.
- **Where:** `engine/world/56-gate-transit.js` — the `on('enter')` auto-placement (`placeGate()/placeLobbyGates()/startAutoTravel()`) is commented out.
- **Kept in library:** `buildSign()` and `window.__tinyworldStargate.build()` factories are untouched — just not placed.
- **Restore:** un-comment the `on('enter')` line.

## Related items already hidden previously (not changed in this pass)

- **Mesh Terrain standalone toggle button** (`mesh-terrain-toggle`) — `engine/world/46-mesh-terrain.js`, `toggleBtn.style.display = 'none'` (commented "hidden for now"). Restore: remove that line.
- **Continuous landscape mesh** checkbox (`render-landscape-mesh-container`) — `tiny-world-builder.html`, inline `style="display: none;"`.

## Non-hidden UI changes made the same day (for reference)

- **Erase tool icon** changed from a trash-can glyph to an **eraser** glyph, and switched from the white-bodied fill treatment to line-art. `engine/world/19-tools-toolbar.js` (`toolbarIconSvg.erase`) + `styles/tiny-world.css` (`.tool[data-id="erase"] .tool-icon svg`).
- **Minimised AI launcher** changed from a tall vertical "AI" pill to a **rounded square with a robot icon**, matching the Sound/Layers buttons. `styles/tiny-world.css` (`.agent-panel.collapsed` block) + `engine/world/28-generate-panel-agent.js` (`ROBOT_ICON_SVG` in `updateCollapseButton`).
