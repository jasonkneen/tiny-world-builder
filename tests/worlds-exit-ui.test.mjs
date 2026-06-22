import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const universeJs = readFileSync(new URL('../engine/world/46-worlds-universe.js', import.meta.url), 'utf8');
const toolbarJs = readFileSync(new URL('../engine/world/19-tools-toolbar.js', import.meta.url), 'utf8');
const bootJs = readFileSync(new URL('../engine/world/30-ui-boot-wiring.js', import.meta.url), 'utf8');
const roomJs = readFileSync(new URL('../engine/world/47-worlds-room.js', import.meta.url), 'utf8');
const hudJs = readFileSync(new URL('../engine/world/48-worlds-harvest-hud.js', import.meta.url), 'utf8');
const playChatJs = readFileSync(new URL('../engine/world/50-worlds-play-chat.js', import.meta.url), 'utf8');
const worldsFunctionJs = readFileSync(new URL('../netlify/functions/worlds.mjs', import.meta.url), 'utf8');
const lobbyPresentationJs = readFileSync(new URL('../engine/world/58-lobby-presentation.js', import.meta.url), 'utf8');
const cctvPlacementJs = readFileSync(new URL('../engine/world/63-cctv-placement.js', import.meta.url), 'utf8');
const cctvViewJs = readFileSync(new URL('../engine/world/67-cctv-view.js', import.meta.url), 'utf8');
const builderJs = readFileSync(new URL('../engine/world/21-object-transform-voxel-build.js', import.meta.url), 'utf8');
const renderCoreJs = readFileSync(new URL('../engine/world/01-render-core.js', import.meta.url), 'utf8');
const stylesCss = readFileSync(new URL('../styles/tiny-world.css', import.meta.url), 'utf8');

test('explicit island exits open the world picker instead of exposing a restored selector board', () => {
  assert.match(roomJs, /WS\.exitToWorldPicker\s*=\s*function\s*\(\)/);
  assert.match(roomJs, /function openWorldPickerFromGate\(\)[\s\S]*WS\.exitToWorldPicker\(\)/);
  assert.match(hudJs, /WS\.exitToWorldPicker\(\)/);
});

test('island exit HUD does not reuse the account sign-out icon', () => {
  assert.match(hudJs, /tw-hud-back-worlds/);
  assert.match(hudJs, /T\('worlds\.backToWorlds'\)/);
  assert.match(hudJs, /ic\('reply', 16\)/);
  assert.doesNotMatch(hudJs, /tw-hud-leave[\s\S]*ic\('leave', 16\)/);
});

test('room teardown does not restore builder state as a minimap side effect', () => {
  const match = roomJs.match(/function hideBaseMinimap\(hide\) \{([\s\S]*?)\n    \}/);
  assert.ok(match, 'hideBaseMinimap function exists');
  assert.doesNotMatch(match[1], /restoreFreeform|clearActiveTinyverseSession/);
});

test('legacy multi-gate picker boards are not restored behind the world picker', () => {
  assert.match(universeJs, /function looksLikeLegacyPickerBoard\(state\)/);
  assert.match(universeJs, /stargates >= 4/);
  assert.match(universeJs, /applyState\(looksLikeLegacyPickerBoard\(savedFreeform\) \? \{ v: 4, gridSize: 8, cells: \[\] \} : savedFreeform\)/);
});

test('world minimap uses direct synced world grid coordinates for drawing and clicks', () => {
  assert.match(roomJs, /function mapCellRect\(x, z\)/);
  assert.match(roomJs, /return \{ x: x \* CELL, y: z \* CELL \}/);
  assert.match(roomJs, /function mapCanvasPointToCell\(px, py, width, height\)/);
  assert.match(roomJs, /const cx = Math\.floor\(px \/ sx\)/);
  assert.match(roomJs, /const cz = Math\.floor\(py \/ sy\)/);
  assert.doesNotMatch(roomJs, /gridSize - 1 - z/);
  assert.doesNotMatch(roomJs, /gridSize - 1 - col/);
  assert.doesNotMatch(roomJs, /fillRect\(x \* CELL, z \* CELL, CELL, CELL\)/);
});

test('world rooms keep chat scoped to the active island session', () => {
  assert.match(playChatJs, /function resetChatForWorld\(\)/);
  assert.match(playChatJs, /if \(logEl\) logEl\.textContent = ''/);
  assert.match(playChatJs, /on\('enter', \(\) => \{[\s\S]*resetChatForWorld\(\)/);
  assert.match(playChatJs, /on\('leave', \(\) => \{[\s\S]*resetChatForWorld\(\)/);
});

test('published world entry is playable unless explicitly forced to CCTV observe', () => {
  assert.match(universeJs, /const role = window\.__tinyworldForceRole === 'observe' \? 'observe' : 'play'/);
  assert.doesNotMatch(universeJs, /location\.hostname\.includes\("mmo-preview"\)[\s\S]*token: ""/);
  assert.match(worldsFunctionJs, /function roleFor\(world, profileId, canPlayPublished\)/);
  assert.match(worldsFunctionJs, /return \(profileId \|\| canPlayPublished\) \? 'play' : 'observe'/);
  assert.match(worldsFunctionJs, /roleFor\(world, profile && profile\.id, canAccessTinyverse \|\| isWorldAdmin\)/);
  assert.match(hudJs, /on\('status', \(d\) => \{ if \(!d \|\| !d\.connected\) setRole\(\); \}\)/);
});

test('world room play mode is temporary and exits back to build mode', () => {
  assert.match(bootJs, /if \(opts\.persist !== false\)/);
  assert.match(bootJs, /setPlayTemporary: \(\) => setPlayModeActive\(true, \{ persist: false \}\)/);
  assert.match(roomJs, /mode\.setPlayTemporary\(\)/);
  assert.match(roomJs, /mode && typeof mode\.setBuild === 'function'\) mode\.setBuild\(\)/);
  assert.match(universeJs, /function buildDraft\(w\) \{[\s\S]*WS\.leaveRoom\(\)/);
});

test('home controls reopen the same launch modal instead of navigating or signing out', () => {
  assert.match(bootJs, /window\.__tinyworldShowWelcomeLaunch = showWelcome/);
  assert.match(bootJs, /homeBtn\.addEventListener\('click', \(e\) => \{[\s\S]*__tinyworldShowWelcomeLaunch\(\)/);
  assert.doesNotMatch(bootJs, /window\.location\.href = '\/'/);
});

test('owned draft worlds remain buildable from the carousel picker', () => {
  assert.match(universeJs, /function isMine\(w\) \{[\s\S]*Number\(w\.ownerProfileId\) === Number\(me\.id\)/);
  assert.match(universeJs, /function isLockedWorld\(w\) \{[\s\S]*w\.status === 'draft' && !isMine\(w\)/);
  assert.doesNotMatch(universeJs, /const locked = w\.status !== 'published'/);
});

test('world room avatars use the room grid size and solid-by-default walkability', () => {
  assert.match(roomJs, /function worldRoomTilePos\(x, z\)/);
  assert.match(roomJs, /gridSize \|\| \(typeof GRID !== 'undefined' \? GRID : 8\)/);
  assert.match(roomJs, /const p = worldRoomTilePos\(ent\.x, ent\.z\)/);
  assert.match(roomJs, /function isWorldRoomStandableKind\(kind\)/);
  assert.match(roomJs, /return !kind \|\| STANDABLE_OBJECT_KINDS\.has\(kind\)/);
  assert.match(roomJs, /!isWorldRoomStandableKind\(k\)\) blocked\.add/);
  assert.doesNotMatch(roomJs, /ter === 'stone'/);
  assert.doesNotMatch(roomJs, /const p = tilePos\(ent\.x, ent\.z\)/);
});

test('world data normalization guarantees one center world-selection stargate', () => {
  assert.match(universeJs, /const WORLD_SELECTION_GATE_DEST = '__world-picker'/);
  assert.match(universeJs, /function worldSelectionGateCell\(gridSize\)/);
  assert.match(universeJs, /kind: 'stargate', dest: WORLD_SELECTION_GATE_DEST/);
  assert.match(universeJs, /const cells = nextCells\.filter\(cell => !isWorldSelectionGateCenterCell\(cell, gate\.x, gate\.z\)\)/);
  assert.match(universeJs, /cells\.push\(gate\)/);
});

test('lobby big screen and CCTV only mount in the configured lobby world', () => {
  for (const src of [lobbyPresentationJs, cctvPlacementJs]) {
    assert.match(src, /window\.__TW_LOBBY_WORLD_SLUG \|\| 'tidewater-bay'/);
    assert.match(src, /function isLobbyWorld\(w\)/);
    assert.match(src, /String\(w\.slug \|\| ''\)\.toLowerCase\(\) === LOBBY_WORLD_SLUG/);
    assert.doesNotMatch(src, /d\.world\.slug === 'tinyverse-nexus'/);
  }
  assert.match(lobbyPresentationJs, /if \(!activeLobbyRoom\) \{ hide\(\); return; \}/);
  assert.match(cctvPlacementJs, /if \(!currentWorldIsLobby\) return;/);
  assert.match(cctvViewJs, /requestedWorldSlug && requestedWorldSlug !== lobbyWorldSlug/);
});

test('world picker is a carousel overlay with search and filter controls', () => {
  assert.match(universeJs, /class: 'tw-worlds-stage'/);
  assert.match(universeJs, /class: 'tw-worlds-dots'/);
  assert.match(universeJs, /class: 'tw-worlds-search'/);
  assert.match(universeJs, /function renderPicker\(\)/);
  assert.match(universeJs, /function rotateWorldSelection\(delta\)/);
  assert.match(universeJs, /stage\.addEventListener\('wheel', handleWorldPickerWheel, \{ passive: false \}\)/);
  assert.match(universeJs, /function handleWorldPickerWheel\(e\)/);
  assert.match(universeJs, /let pickerCards = new Map\(\)/);
  assert.match(universeJs, /function updateCardPosition\(card, w, index, selectedIndex, count\)/);
  assert.match(universeJs, /pickerCards\.get\(w\.slug\)/);
  assert.match(universeJs, /WS\.renderPreview\(prev, preview\)/);
  assert.doesNotMatch(universeJs, /for \(const w of worlds\) gridEl\.appendChild\(renderCard\(w\)\)/);
  assert.doesNotMatch(universeJs, /gridEl\.textContent = '';\n      worlds\.forEach/);
});

test('world picker cards display owner-backed resource readiness stats', () => {
  assert.match(worldsFunctionJs, /p\.email AS owner_email/);
  assert.match(worldsFunctionJs, /function ensureTinyverseStarterOwnership\(sql, profile\)/);
  assert.match(universeJs, /function resourceStatsText\(stats\)/);
  assert.match(universeJs, /w\.resourceStats/);
  assert.match(universeJs, /class: 'tw-worlds-resources'/);
  assert.match(universeJs, /worlds\.resourceOre/);
  assert.match(universeJs, /worlds\.ready/);
});

test('mesh terrain is reachable from the Terrain flyout as an action tool', () => {
  assert.match(toolbarJs, /id: 'mesh-terrain'[\s\S]*action: 'mesh-terrain'[\s\S]*group: 'terrain'/);
  assert.match(toolbarJs, /toolIds: \[[^\]]*'rock', 'mesh-terrain'[^\]]*\]/);
  assert.match(toolbarJs, /function runToolAction\(t\)[\s\S]*__tinyworldMeshTerrain/);
  assert.doesNotMatch(toolbarJs, /TEMP-HIDDEN: 'mesh-terrain'/);
});

test('stamps are reachable from the main toolbar and keep the floating panel active', () => {
  assert.match(toolbarJs, /stamps: '<svg viewBox="0 0 24 24">/);
  assert.match(toolbarJs, /buildToolbarUtilityButton\('toolbar-stamps', 'Stamps', 'stamps'/);
  assert.match(toolbarJs, /window\.__tinyworldStampBuilder/);
  assert.match(toolbarJs, /function syncToolbarStampButton\(\)/);
  assert.match(builderJs, /window\.__tinyworldStampBuilder = \{[\s\S]*open,[\s\S]*close,[\s\S]*toggle,[\s\S]*isOpen:/);
  assert.match(builderJs, /function close\(\) \{[\s\S]*panel\.hidden = true;[\s\S]*syncStampBuilderToolbarButton\(\)/);
  assert.match(stylesCss, /body\.tw-play-mode #toolbar-stamps/);
  assert.match(stylesCss, /body\.tw-worlds-play #toolbar-stamps/);
});

test('mobile rendering and stamp thumbnails stay under compact-screen budgets', () => {
  assert.match(renderCoreJs, /function renderDprCapForViewport\(\) \{[\s\S]*return renderCompactViewportActive\(\) \? 1\.35 : 2\.0/);
  assert.match(renderCoreJs, /window\.addEventListener\('resize', \(\) => \{[\s\S]*applyRendererPixelRatio\(\);[\s\S]*applyStageSize\(\);/);
  assert.match(toolbarJs, /function toolbarThumbDprCap\(\) \{[\s\S]*return toolbarCompactViewportActive\(\) \? 1 : 2/);
  assert.match(toolbarJs, /function stampBuilderThumbBudget\(\) \{[\s\S]*maxPerFrame: 1, maxMs: 7, delayMs: 72/);
  assert.match(stylesCss, /@media \(max-width: 700px\) \{[\s\S]*\.stamp-panel \{[\s\S]*max-height: calc\(100dvh - 168px\)/);
  assert.match(stylesCss, /@media \(max-width: 600px\) and \(hover: none\), \(max-width: 600px\) and \(pointer: coarse\) \{[\s\S]*flex: 0 0 44px/);
});

test('multiplayer name tags scale to a fixed screen size across zoom levels', () => {
  assert.match(roomJs, /const NAME_TAG_SCREEN_HEIGHT = 30/);
  assert.match(roomJs, /function updateNameLabelScale\(sprite\)/);
  assert.match(roomJs, /camera\.isOrthographicCamera/);
  assert.match(roomJs, /camera\.isPerspectiveCamera/);
  assert.match(roomJs, /worldPerPixel \* NAME_TAG_SCREEN_HEIGHT/);
  assert.match(roomJs, /s\.position\.set\(ent\.sprite\.position\.x, ent\.sprite\.position\.y \+ NAME_HEAD_Y, ent\.sprite\.position\.z\)/);
  assert.match(roomJs, /updateNameLabelScale\(s\)/);
});
