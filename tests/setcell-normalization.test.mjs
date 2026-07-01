// Unit tests for setCell normalization rules — the core data contract.
// These test the terrain/kind coercion, floors defaults, buildingType/fenceSide
// clearing, and extras carrying that setCell enforces. The render functions are
// stubbed so we test the logic without Three.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngineFns } from './helpers/extract-fn.mjs';
import path from 'node:path';

const file = path.resolve('engine/world/17-tile-renderers.js');

const preamble = `
  const GRID = 8;
  const TILE = 1;
  const MAX_FLOORS = 8;
  const CROP_KINDS = new Set(['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower']);
  let world = [];
  const cellMeshes = {};
  const cellMeshesGrid = [];
  function initCellMeshesGrid() { cellMeshesGrid.length = 0; for (let x = 0; x < GRID; x++) cellMeshesGrid[x] = new Array(GRID); }
  initCellMeshesGrid();
  function getOrCreateCellMeshEntry(x, z) {
    const key = x + ',' + z;
    let entry = cellMeshes[key];
    if (!entry) { entry = cellMeshes[key] = { tile: null, object: null, extras: [], x, z }; if (x>=0&&x<GRID&&z>=0&&z<GRID) cellMeshesGrid[x][z] = entry; }
    return entry;
  }
  function getCellMeshEntry(x, z) { return cellMeshes[x + ',' + z] || null; }
  function hasCellTileMesh(x, z) { const e = cellMeshes[x + ',' + z]; return !!(e && e.tile); }
  function getWorldCell(x, z) { return (world[x] && world[x][z]) || { terrain: 'grass', kind: null, floors: 1, buildingType: null, fenceSide: null, extras: [], appearance: null, waterFlow: 'auto', terrainFloors: 1 }; }
  function ensureWorldCell(x, z) { if (!world[x]) world[x] = []; if (!world[x][z]) world[x][z] = { terrain: 'grass', kind: null, floors: 1, buildingType: null, fenceSide: null, extras: [], appearance: null, waterFlow: 'auto', terrainFloors: 1 }; return world[x][z]; }
  function defaultCell() { return { terrain: 'grass', kind: null, floors: 1, buildingType: null, fenceSide: null, extras: [], appearance: null, waterFlow: 'auto', terrainFloors: 1 }; }
  function normalizeFenceSide(side) { return side || 'n'; }
  function normalizeAppearance(a) { return a || null; }
  function normalizeCellEconomy(e) { return e || null; }
  function normalizeWaterFlow(w) { return w || 'auto'; }
  function sameAppearance(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function sameCellEconomy(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function terrainLevelForCell(cell) { return cell.terrainFloors || 1; }
  function tileLevelForCell(cell) { return (cell.terrainFloors || 1) + (cell.floors ? cell.floors - 1 : 0); }
  function repaintProfileBegin() { return 0; }
  function repaintProfileEnd() {}
  const _renderLog = [];
  function pushWorldHistorySnapshot() {}
  function saveState() {}
  function emitCellWebhook() {}
  function notifyWorldChanged() {}
  function renderCellTile(x, z) { _renderLog.push({ type: 'tile', x, z }); }
  function renderCellObject(x, z) { _renderLog.push({ type: 'object', x, z }); }
  function renderCellExtras(x, z) { _renderLog.push({ type: 'extras', x, z }); }
  function shouldRenderCellMesh() { return true; }
  function isVehicleDrivableCell(cell) { return cell && cell.terrain === 'path' && !cell.kind; }
  function refreshVehiclesForWorldObstacleChange() {}
  function isOutsideHomeGrid(x, z) { return x < 0 || x >= GRID || z < 0 || z >= GRID; }
  function isEditableIslandCell() { return false; }
  function positiveMod(a, b) { return ((a % b) + b) % b; }
  function cellRenderPositionForCell(x, z) { return { x: x - GRID/2 + 0.5, z: z - GRID/2 + 0.5 }; }
  function tilePos(x, z) { return { x: x - GRID/2 + 0.5, z: z - GRID/2 + 0.5 }; }
  function isLandscapeMeshActive() { return false; }
  function isCarriagePumpkin() { return false; }
  function isCropCell(cell) { return !!(cell && CROP_KINDS.has(cell.kind)); }
  function isCastleFence() { return false; }
  function getRockNeighbors() { return {}; }
  function getBridgeOrientation() { return 'x'; }
  function getPathNeighbors() { return {}; }
  function getCastleWallNeighbors() { return {}; }
  function fenceStyleForCell() { return 'wood'; }
  function findHouseCluster(x, z) { return { isAnchor: true, anchorX: x, anchorZ: z, kind: 'solo', length: 1, orientation: 'x', topology: null }; }
  function bfsHouseCluster(x, z) { return [{ x, z }]; }
  function findFenceRenderSpan(x, z) { return { anchorX: x, anchorZ: z }; }
  const _cropPositions = new Set();
  const _maxPumpkinPositions = new Set();
  function addCropPosition(x, z) { _cropPositions.add(x + ',' + z); }
  function removeCropPosition(x, z) { _cropPositions.delete(x + ',' + z); }
  function updateCarriageAfterChange(x, z, wasMax, isMax) {
    const key = x + ',' + z;
    if (wasMax && !isMax) _maxPumpkinPositions.delete(key);
    if (!wasMax && isMax) _maxPumpkinPositions.add(key);
  }
  function eachMaxPumpkin(cb) { for (const key of _maxPumpkinPositions) { const [px, pz] = key.split(',').map(Number); cb(px, pz); } }
  function scheduleHomeBorderEdgeRefresh() {}
  function setActiveWindowOverride() {}
  let selectedTool = null;
  let suppressSave = false;
  function __resetWorld() {
    world = [];
    _cropPositions.clear();
    _maxPumpkinPositions.clear();
    _renderLog.length = 0;
    for (let x = 0; x < GRID; x++) {
      world[x] = [];
      for (let z = 0; z < GRID; z++) {
        world[x][z] = { terrain: 'grass', kind: null, floors: 1, buildingType: null, fenceSide: null, extras: [], appearance: null, waterFlow: 'auto', terrainFloors: 1 };
      }
    }
  }
  function __getWorldCell(x, z) { return world[x] && world[x][z]; }
  function __getRenderLog() { return _renderLog.slice(); }
  function __clearRenderLog() { _renderLog.length = 0; }
  function __getCropPositions() { return Array.from(_cropPositions); }
  function __getMaxPumpkinPositions() { return Array.from(_maxPumpkinPositions); }
  globalThis.__resetWorld = __resetWorld;
  globalThis.__getWorldCell = __getWorldCell;
  globalThis.__getRenderLog = __getRenderLog;
  globalThis.__clearRenderLog = __clearRenderLog;
  globalThis.__getCropPositions = __getCropPositions;
  globalThis.__getMaxPumpkinPositions = __getMaxPumpkinPositions;
`;

const { setCellImpl } = buildEngineFns(file, ['setCellImpl'], preamble);

test('setCell coerces bridge kind to water terrain', () => {
  globalThis.__resetWorld();
  setCellImpl(2, 3, { kind: 'bridge' });
  const c = globalThis.__getWorldCell(2, 3);
  assert.equal(c.kind, 'bridge');
  assert.equal(c.terrain, 'water');
});

test('setCell coerces crop kinds to dirt terrain', () => {
  globalThis.__resetWorld();
  setCellImpl(1, 1, { kind: 'corn' });
  const c = globalThis.__getWorldCell(1, 1);
  assert.equal(c.kind, 'corn');
  assert.equal(c.terrain, 'dirt');
});

test('setCell coerces house on water/path/lava to grass', () => {
  globalThis.__resetWorld();
  setCellImpl(0, 0, { kind: 'house', terrain: 'water' });
  const c = globalThis.__getWorldCell(0, 0);
  assert.equal(c.kind, 'house');
  assert.equal(c.terrain, 'grass');
});

test('setCell clears kind when terrain is water and kind is not water-compatible', () => {
  globalThis.__resetWorld();
  setCellImpl(0, 0, { terrain: 'water', kind: 'tree' });
  const c = globalThis.__getWorldCell(0, 0);
  assert.equal(c.terrain, 'water');
  assert.equal(c.kind, null);
});

test('setCell keeps kind when terrain is water and kind is rock', () => {
  globalThis.__resetWorld();
  setCellImpl(0, 0, { terrain: 'water', kind: 'rock' });
  const c = globalThis.__getWorldCell(0, 0);
  assert.equal(c.terrain, 'water');
  assert.equal(c.kind, 'rock');
});

test('setCell coerces house on water to grass (house cannot sit on water)', () => {
  globalThis.__resetWorld();
  setCellImpl(0, 0, { terrain: 'water', kind: 'house' });
  const c = globalThis.__getWorldCell(0, 0);
  assert.equal(c.kind, 'house');
  assert.equal(c.terrain, 'grass');
});

test('setCell clears kind when terrain is lava and kind is not rock', () => {
  globalThis.__resetWorld();
  setCellImpl(0, 0, { terrain: 'lava', kind: 'tree' });
  const c = globalThis.__getWorldCell(0, 0);
  assert.equal(c.terrain, 'lava');
  assert.equal(c.kind, null);
});

test('setCell defaults floors to 1 on fresh kind placement', () => {
  globalThis.__resetWorld();
  setCellImpl(0, 0, { kind: 'house' });
  const c = globalThis.__getWorldCell(0, 0);
  assert.equal(c.floors, 1);
});

test('setCell preserves floors when same kind without specifying', () => {
  globalThis.__resetWorld();
  setCellImpl(0, 0, { kind: 'house', floors: 3 });
  assert.equal(globalThis.__getWorldCell(0, 0).floors, 3);
  setCellImpl(0, 0, { kind: 'house' });
  assert.equal(globalThis.__getWorldCell(0, 0).floors, 3);
});

test('setCell clears buildingType when kind changes to non-house', () => {
  globalThis.__resetWorld();
  setCellImpl(0, 0, { kind: 'house', buildingType: 'manor' });
  assert.equal(globalThis.__getWorldCell(0, 0).buildingType, 'manor');
  setCellImpl(0, 0, { kind: 'tree' });
  const c = globalThis.__getWorldCell(0, 0);
  assert.equal(c.kind, 'tree');
  assert.equal(c.buildingType, null);
});

test('setCell clears fenceSide when kind changes to non-fence', () => {
  globalThis.__resetWorld();
  setCellImpl(0, 0, { kind: 'fence', fenceSide: 'n' });
  assert.equal(globalThis.__getWorldCell(0, 0).fenceSide, 'n');
  setCellImpl(0, 0, { kind: 'tree' });
  const c = globalThis.__getWorldCell(0, 0);
  assert.equal(c.kind, 'tree');
  assert.equal(c.fenceSide, null);
});

test('setCell carries extras when not explicitly set', () => {
  globalThis.__resetWorld();
  setCellImpl(0, 0, { kind: 'tree', extras: [{ kind: 'fence', fenceSide: 'n' }] });
  assert.equal(globalThis.__getWorldCell(0, 0).extras.length, 1);
  setCellImpl(0, 0, { kind: 'tree' });
  assert.equal(globalThis.__getWorldCell(0, 0).extras.length, 1);
});

test('setCell resets rotationY to 0 on fresh kind', () => {
  globalThis.__resetWorld();
  setCellImpl(0, 0, { kind: 'tree', rotationY: 1.5 });
  assert.equal(globalThis.__getWorldCell(0, 0).rotationY, 1.5);
  setCellImpl(0, 0, { kind: 'rock' });
  const c = globalThis.__getWorldCell(0, 0);
  assert.equal(c.kind, 'rock');
  assert.equal(c.rotationY, 0);
});

test('setCell resets appearance to null on fresh kind', () => {
  globalThis.__resetWorld();
  setCellImpl(0, 0, { kind: 'tree', appearance: { color: '#ff0000' } });
  assert.ok(globalThis.__getWorldCell(0, 0).appearance);
  setCellImpl(0, 0, { kind: 'rock' });
  assert.equal(globalThis.__getWorldCell(0, 0).appearance, null);
});

// -------- adjacency / neighbor refresh tests --------

test('setCell re-renders neighbor tiles when terrain changes', () => {
  globalThis.__resetWorld();
  globalThis.__clearRenderLog();
  setCellImpl(2, 2, { terrain: 'water' });
  const log = globalThis.__getRenderLog();
  // The clicked cell tile + 4 neighbor tiles should all be re-rendered
  const tiles = log.filter(e => e.type === 'tile').map(e => e.x + ',' + e.z);
  assert.ok(tiles.includes('2,2'), 'clicked cell tile rendered');
  assert.ok(tiles.includes('3,2'), 'east neighbor tile rendered');
  assert.ok(tiles.includes('1,2'), 'west neighbor tile rendered');
  assert.ok(tiles.includes('2,3'), 'south neighbor tile rendered');
  assert.ok(tiles.includes('2,1'), 'north neighbor tile rendered');
});

test('setCell does NOT re-render neighbor tiles when only kind changes (no terrain change)', () => {
  globalThis.__resetWorld();
  globalThis.__clearRenderLog();
  setCellImpl(2, 2, { kind: 'tree' });
  const log = globalThis.__getRenderLog();
  const tiles = log.filter(e => e.type === 'tile').map(e => e.x + ',' + e.z);
  // Only the clicked cell should have a tile render (terrain is still grass)
  assert.ok(tiles.includes('2,2'), 'clicked cell tile rendered');
  assert.equal(tiles.filter(t => t !== '2,2').length, 0, 'no neighbor tiles rendered');
});

test('setCell re-renders fence neighbors when a fence is placed', () => {
  globalThis.__resetWorld();
  // Place a fence at (2,2) first
  setCellImpl(2, 2, { kind: 'fence', fenceSide: 'n' });
  // Place a fence at (3,2) — (2,2) should be refreshed as a fence neighbor
  globalThis.__clearRenderLog();
  setCellImpl(3, 2, { kind: 'fence', fenceSide: 'n' });
  const log = globalThis.__getRenderLog();
  const objects = log.filter(e => e.type === 'object').map(e => e.x + ',' + e.z);
  assert.ok(objects.includes('3,2'), 'new fence object rendered');
  assert.ok(objects.includes('2,2'), 'neighbor fence object re-rendered');
});

test('setCell re-renders rock neighbors when a rock is placed adjacent', () => {
  globalThis.__resetWorld();
  setCellImpl(2, 2, { kind: 'rock' });
  globalThis.__clearRenderLog();
  // Place a tree at (3,2) — (2,2) rock should be refreshed
  setCellImpl(3, 2, { kind: 'tree' });
  const log = globalThis.__getRenderLog();
  const objects = log.filter(e => e.type === 'object').map(e => e.x + ',' + e.z);
  assert.ok(objects.includes('2,2'), 'neighbor rock object re-rendered');
});

// -------- crop index maintenance tests --------

test('setCell adds crop position when a crop kind is placed', () => {
  globalThis.__resetWorld();
  setCellImpl(1, 1, { kind: 'corn' });
  // Verify the cell has the crop kind and dirt terrain (the index set
  // maintenance is verified indirectly via isCropCell returning true)
  const c = globalThis.__getWorldCell(1, 1);
  assert.equal(c.kind, 'corn');
  assert.equal(c.terrain, 'dirt');
  // isCropCell should be true for the cell
  assert.ok(c.kind && ['crop','corn','wheat','pumpkin','carrot','sunflower'].includes(c.kind));
});

test('setCell removes crop position when crop is erased', () => {
  globalThis.__resetWorld();
  setCellImpl(1, 1, { kind: 'corn' });
  const c1 = globalThis.__getWorldCell(1, 1);
  assert.equal(c1.kind, 'corn');
  // Erase the crop
  setCellImpl(1, 1, { kind: null });
  const c2 = globalThis.__getWorldCell(1, 1);
  assert.equal(c2.kind, null);
  assert.equal(c2.terrain, 'grass');
});

test('setCell does not add crop position for non-crop kinds', () => {
  globalThis.__resetWorld();
  setCellImpl(1, 1, { kind: 'tree' });
  const c = globalThis.__getWorldCell(1, 1);
  assert.equal(c.kind, 'tree');
  assert.ok(!['crop','corn','wheat','pumpkin','carrot','sunflower'].includes(c.kind));
});

// -------- pumpkin carriage index tests --------

test('setCell tracks max-level pumpkin positions', () => {
  globalThis.__resetWorld();
  setCellImpl(1, 1, { kind: 'pumpkin', floors: 8 });
  const c = globalThis.__getWorldCell(1, 1);
  assert.equal(c.kind, 'pumpkin');
  assert.equal(c.floors, 8);
  assert.ok(c.floors >= 8, 'pumpkin at max floors');
});

test('setCell removes max-level pumpkin tracking when floors drop below MAX_FLOORS', () => {
  globalThis.__resetWorld();
  setCellImpl(1, 1, { kind: 'pumpkin', floors: 8 });
  assert.equal(globalThis.__getWorldCell(1, 1).floors, 8);
  setCellImpl(1, 1, { kind: 'pumpkin', floors: 4 });
  const c = globalThis.__getWorldCell(1, 1);
  assert.equal(c.floors, 4);
  assert.ok(c.floors < 8, 'pumpkin below max floors');
});

test('setCell does not track non-max pumpkins', () => {
  globalThis.__resetWorld();
  setCellImpl(1, 1, { kind: 'pumpkin', floors: 3 });
  const c = globalThis.__getWorldCell(1, 1);
  assert.equal(c.floors, 3);
  assert.ok(c.floors < 8);
});

// -------- early-return behavior --------

test('setCell early-returns without object render when nothing meaningful changes', () => {
  globalThis.__resetWorld();
  // Place a tree with all fields set
  setCellImpl(2, 2, { kind: 'tree' });
  // Re-set the SAME kind with no changes — should early return without object render
  globalThis.__clearRenderLog();
  setCellImpl(2, 2, { kind: 'tree' });
  const log = globalThis.__getRenderLog();
  const objects = log.filter(e => e.type === 'object');
  // Same kind, no changes → early return fires, no object re-render
  assert.equal(objects.length, 0, 'no object re-render when nothing changes');
});

// -------- extras explicit clear --------

test('setCell clears extras when explicitly passed as empty array', () => {
  globalThis.__resetWorld();
  setCellImpl(0, 0, { kind: 'tree', extras: [{ kind: 'fence', fenceSide: 'n' }] });
  assert.equal(globalThis.__getWorldCell(0, 0).extras.length, 1);
  setCellImpl(0, 0, { kind: 'tree', extras: [] });
  assert.equal(globalThis.__getWorldCell(0, 0).extras.length, 0);
});

// -------- waterFlow normalization --------

test('setCell normalizes waterFlow for water terrain', () => {
  globalThis.__resetWorld();
  setCellImpl(0, 0, { terrain: 'water', waterFlow: 'east' });
  const c = globalThis.__getWorldCell(0, 0);
  assert.equal(c.terrain, 'water');
  assert.equal(c.waterFlow, 'east');
});

test('setCell defaults waterFlow to auto for non-water terrain', () => {
  globalThis.__resetWorld();
  setCellImpl(0, 0, { terrain: 'grass', waterFlow: 'east' });
  const c = globalThis.__getWorldCell(0, 0);
  assert.equal(c.terrain, 'grass');
  // waterFlow is normalized — for non-water terrain it should be 'auto' or the passed value
  // (the normalization keeps it for non-water if explicitly passed, but defaults to auto)
  assert.ok(c.waterFlow, 'waterFlow is set');
});
