import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const shell = fs.readFileSync(path.join(root, 'island-viewer.html'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'scripts/island-viewer.js'), 'utf8');
const generator = fs.readFileSync(path.join(root, 'scripts/island-viewer-sequential-generator.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'scripts/island-viewer-engine-runtime.js'), 'utf8');
const prelude = fs.readFileSync(path.join(root, 'scripts/island-viewer-engine-prelude.js'), 'utf8');
const economyProfile = fs.readFileSync(path.join(root, 'engine/world/26b-random-island-economy-profile.js'), 'utf8');

function loadIslandGenerator() {
  const sandboxWindow = {};
  const economyPreamble = `
    const GRID = 8;
    function coerceGridSize(value, fallback) {
      const n = Number(value);
      return [8, 10, 12, 16, 20].includes(n) ? n : fallback;
    }
  `;
  const factory = new Function('window', economyPreamble + '\n' + economyProfile + '\n' + generator + '\nreturn window;');
  return factory(sandboxWindow);
}

function loadIslandRuntime() {
  const sandboxWindow = {};
  const factory = new Function('window', runtime + '\nreturn window;');
  return factory(sandboxWindow);
}

function cellAt(world, x, z) {
  return world.cells.find(cell => cell.x === x && cell.z === z) || null;
}

function isPath(cell) {
  return !!(cell && cell.terrain === 'path');
}

function isWater(cell) {
  return !!(cell && cell.terrain === 'water');
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}

function perpendicularPathCornerSides(world, cell) {
  const sides = [
    ['n', cellAt(world, cell.x, cell.z - 1)],
    ['e', cellAt(world, cell.x + 1, cell.z)],
    ['s', cellAt(world, cell.x, cell.z + 1)],
    ['w', cellAt(world, cell.x - 1, cell.z)],
  ].filter(([, neighbor]) => isPath(neighbor)).map(([side]) => side);
  if (sides.length !== 2) return null;
  if ((sides.includes('n') && sides.includes('s')) || (sides.includes('e') && sides.includes('w'))) return null;
  return sides;
}

function doorSideForCell(cell) {
  const value = Number(cell && cell.transform && cell.transform.rotationY);
  if (Math.abs(value - Math.PI) < 0.0001) return 'n';
  if (Math.abs(value - Math.PI / 2) < 0.0001) return 'e';
  if (Math.abs(value + Math.PI / 2) < 0.0001) return 'w';
  return 's';
}

function frontCell(world, cell) {
  const side = doorSideForCell(cell);
  if (side === 'n') return cellAt(world, cell.x, cell.z - 1);
  if (side === 'e') return cellAt(world, cell.x + 1, cell.z);
  if (side === 'w') return cellAt(world, cell.x - 1, cell.z);
  return cellAt(world, cell.x, cell.z + 1);
}

function connectedPathSize(world, start) {
  if (!isPath(start)) return 0;
  const queue = [start];
  const seen = new Set([start.x + ',' + start.z]);
  while (queue.length) {
    const current = queue.shift();
    for (const neighbor of [
      cellAt(world, current.x + 1, current.z),
      cellAt(world, current.x - 1, current.z),
      cellAt(world, current.x, current.z + 1),
      cellAt(world, current.x, current.z - 1),
    ]) {
      if (!isPath(neighbor)) continue;
      const key = neighbor.x + ',' + neighbor.z;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(neighbor);
    }
  }
  return seen.size;
}

function manorReservedKeys(world) {
  const keys = new Set();
  for (const manor of world.cells.filter(cell => cell.kind === 'house' && cell.buildingType === 'manor')) {
    const side = doorSideForCell(manor);
    const offsets = side === 'n' ? { back: [0, 1], lateral: [1, 0] }
      : side === 'e' ? { back: [-1, 0], lateral: [0, 1] }
        : side === 'w' ? { back: [1, 0], lateral: [0, 1] }
          : { back: [0, -1], lateral: [1, 0] };
    for (const lateral of [-1, 0, 1]) {
      for (const depth of [0, 1]) {
        const x = manor.x + offsets.lateral[0] * lateral + offsets.back[0] * depth;
        const z = manor.z + offsets.lateral[1] * lateral + offsets.back[1] * depth;
        keys.add(x + ',' + z);
      }
    }
  }
  return keys;
}

function isOrdinaryEmptyLand(cell) {
  return !!(cell
    && cell.terrain === 'grass'
    && cell.kind === null
    && (!Array.isArray(cell.extras) || cell.extras.length === 0));
}

const VIEWER_CROP_KINDS = ['wheat', 'corn', 'carrot', 'pumpkin', 'sunflower'];

test('Island Viewer is standalone and does not embed the builder runtime', () => {
  assert.doesNotMatch(shell, /<iframe\b/);
  assert.doesNotMatch(shell, /tiny-world-builder/);
  assert.doesNotMatch(shell, /tiny-world-builder\.html|engine\/world\/(?:18|19|20|21|22|24|25|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51|52|53|54|55|56|57|58|59|60|61|62|63|64|65|67|68|69|70|99)-/);
  assert.doesNotMatch(controller, /postMessage|contentWindow|iv-frame|tiny-world-builder/);
  assert.match(shell, /id="app"/);
  assert.match(shell, /scripts\/island-viewer-sequential-generator\.js/);
  assert.match(shell, /scripts\/island-viewer-engine-prelude\.js/);
  assert.match(shell, /scripts\/island-viewer-engine-runtime\.js/);
  assert.match(shell, /engine\/world\/17-tile-renderers\.js/);
  assert.doesNotMatch(shell, /scripts\/tinyworld-island-core\.js/);
  assert.doesNotMatch(shell, /scripts\/island-viewer-renderer\.js/);
  assert.doesNotMatch(shell, /09-model-stamp-loader\.js/);
  assert.doesNotMatch(shell, /14-editable-islands-moorings\.js/);
  assert.doesNotMatch(shell, /26-ai-generation\.js/);
  assert.match(prelude, /cellDisplayPointForCell/);
  assert.match(prelude, /cellRenderPositionForCell/);
  assert.match(prelude, /cellRenderParentForCell/);
  assert.match(prelude, /stampCellUserData/);
  assert.match(controller, /TinyWorldIslandRenderer\.mount\(el\.viewport/);
  assert.match(controller, /TinyWorldIslandGenerator\.generate/);
});

test('Island Viewer generated islands are locked to 8x8', () => {
  assert.match(controller, /const ISLAND_VIEWER_GRID_SIZE = 8;/);
  assert.match(controller, /gridSize: ISLAND_VIEWER_GRID_SIZE,/);
  assert.match(controller, /gridSize: ISLAND_VIEWER_GRID_SIZE \}/);
  assert.doesNotMatch(controller, /gridSize:\s*12/);

  assert.match(shell, /<option value="8">8 x 8<\/option>/);
  assert.doesNotMatch(shell, /<option value="(?:10|12|16|20)">/);

  const api = loadIslandGenerator().TinyWorldIslandGenerator;
  const world = api.generate({ seed: 'locked-grid', archetype: 'harbor', gridSize: 20 });
  assert.equal(world.gridSize, 8);
  assert.equal(world.cells.length, 64);
});

test('Island Viewer load/export normalization accepts wrapper and raw v4 JSON', () => {
  const api = loadIslandRuntime().TinyWorldIslandRenderer;
  const raw = { v: 4, gridSize: 20, cells: [[0, 0, 'water'], [1, 1, 'sand'], { x: 2, z: 2, terrain: 'grass', path: true }, [7, 7, 'stone', 'rock'], [12, 12, 'lava']] };
  const rawNormalized = api.normalizeWorld(raw);
  assert.equal(rawNormalized.v, 4);
  assert.equal(rawNormalized.gridSize, 8);
  assert.equal(rawNormalized.cells.length, 64);
  assert.ok(rawNormalized.cells.some(cell => cell.x === 0 && cell.z === 0 && cell.terrain === 'water'));
  assert.equal(rawNormalized.cells.find(cell => cell.x === 1 && cell.z === 1).terrain, 'grass');
  assert.equal(rawNormalized.cells.find(cell => cell.x === 2 && cell.z === 2).terrain, 'path');
  assert.equal(rawNormalized.cells.some(cell => cell.terrain === 'sand'), false);
  assert.ok(rawNormalized.cells.some(cell => cell.x === 7 && cell.z === 7 && cell.kind === 'rock'));
  assert.equal(rawNormalized.cells.some(cell => cell.x === 12 || cell.z === 12), false);

  const wrapped = api.normalizeWorld({
    type: 'tinyworld.islandViewerReveal',
    world: raw,
    viewerGraphics: { timeCycle: 'fixed', timeOfDay: 720 },
  });
  assert.deepEqual(wrapped, rawNormalized);
});

test('Island Viewer graphics defaults are viewer scoped and fixed high noon', () => {
  const api = loadIslandRuntime().TinyWorldIslandRenderer;
  const graphics = api.normalizeGraphics({ lighting: 9, directionalSun: 20, ambientFill: 7, timeCycle: 'fixed', timeOfDay: 720 });
  assert.equal(graphics.lighting, 5);
  assert.equal(graphics.directionalSun, 10);
  assert.equal(graphics.ambientFill, 5);
  assert.equal(api.defaults.graphics.timeCycle, 'fixed');
  assert.equal(api.defaults.graphics.timeOfDay, 720);
  assert.equal(api.defaults.graphics.viewerEffectsVersion, 2);
  assert.equal(api.defaults.graphics.directionalSun, 10);
  assert.equal(api.defaults.graphics.enhancedWater, false);
  assert.equal(api.defaults.graphics.cloudSea, false);
  assert.equal(api.defaults.graphics.distantWorlds, false);
  assert.equal(api.normalizeGraphics({ enhancedWater: true, cloudSea: true, distantWorlds: true }).enhancedWater, false);
  assert.equal(api.normalizeGraphics({ viewerEffectsVersion: 2, enhancedWater: true }).enhancedWater, true);

  assert.doesNotMatch(runtime, /function clearViewerWorld\(\)/);
  assert.doesNotMatch(runtime, /clearViewerWorld\(\)/);
  assert.match(runtime, /for \(const cell of normalized\.cells\) applyCell\(cell, false\);/);
  assert.match(runtime, /__tinyworldIslandViewerLoading/);
  assert.doesNotMatch(runtime, /forceTile: true/);
  assert.match(runtime, /if \(cell\.path === true && terrain !== 'water'\) terrain = 'path';/);
  assert.doesNotMatch(runtime, /path: cell\.path|path: false/);

  assert.match(controller, /const GRAPHICS_LS = 'tinyworld:island-viewer:graphics\.v1'/);
  assert.match(controller, /const VIEWER_LS = 'tinyworld:island-viewer:defaults\.v1'/);
  assert.match(controller, /const GRAPHICS_DEFAULTS_VERSION = 2;/);
  assert.match(controller, /enhancedWater: false/);
  assert.match(controller, /cloudSea: false/);
  assert.match(controller, /distantWorlds: false/);
  assert.match(controller, /generateIsland\(\{ seed: randomIslandSeed\(\) \}\)/);
  assert.doesNotMatch(controller, /tinyworld:render:|tinyworld:crowd:|tinyworld:view\.camera|localStorage\.setItem\('tinyworld:/);
});

test('Island Viewer sequential generator emits v4 islands without legacy bridge metadata', () => {
  assert.doesNotMatch(generator, /water-bridge|bridgeAxis/);
  const api = loadIslandGenerator().TinyWorldIslandGenerator;
  for (const archetype of ['pastoral', 'river', 'harbor', 'village']) {
    const world = api.generate({ seed: 'sequential-' + archetype, archetype, gridSize: 20 });
    const profile = api.profile(world, { seed: 'sequential-' + archetype, archetype });
    const serialized = JSON.stringify({ world, profile });
    assert.equal(world.v, 4);
    assert.equal(world.gridSize, 8);
    assert.equal(world.cells.length, 64);
    assert.equal(world.cells.some(cell => cell.terrain === 'water'), true);
    assert.equal(world.cells.some(cell => cell.terrain === 'path'), true);
    assert.equal(world.cells.some(cell => Object.prototype.hasOwnProperty.call(cell, 'path')), false);
    assert.doesNotMatch(serialized, /water-bridge|bridgeAxis/);
    assert.ok(profile && profile.name && profile.economy);
    assert.ok(profile.rawYield && profile.rawYield.scores && profile.rawYield.scores.rawYield >= 0);
    assert.equal(profile.economy.rarityScope, 'raw_yield');
    assert.equal(Object.prototype.hasOwnProperty.call(profile, 'stats'), false);
  }
});

test('Island Viewer bridge detector only marks path-water-path centers', () => {
  assert.match(generator, /function pathWaterPathBridgeAxis\(cells, index\)/);
  assert.match(generator, /function placePathWaterPathBridgesLayer\(cells\)/);
  assert.match(generator, /placePathWaterPathBridgesLayer\(cells\);/);
  const api = loadIslandGenerator().TinyWorldIslandGenerator;
  let sawBridge = false;
  for (let i = 0; i < 180; i++) {
    const seed = 'viewer-bridge-pattern-' + i;
    const world = api.generate({ seed, archetype: 'river', gridSize: 8 });
    for (const bridge of world.cells.filter(cell => cell.kind === 'bridge')) {
      sawBridge = true;
      assert.equal(bridge.terrain, 'water', 'bridge center must stay water for seed ' + seed);
      const west = cellAt(world, bridge.x - 1, bridge.z);
      const east = cellAt(world, bridge.x + 1, bridge.z);
      const north = cellAt(world, bridge.x, bridge.z - 1);
      const south = cellAt(world, bridge.x, bridge.z + 1);
      const eastWestBridge = isPath(west) && isPath(east) && isWater(north) && isWater(south);
      const northSouthBridge = isPath(north) && isPath(south) && isWater(west) && isWater(east);
      assert.equal(eastWestBridge !== northSouthBridge, true, 'bridge must be the center of one unambiguous path-water-path crossing for seed ' + seed + ' at ' + bridge.x + ',' + bridge.z);
      assert.equal(isPath(west) && isPath(east) && (isPath(north) || isPath(south)), false, 'east-west bridge must not have perpendicular path neighbors for seed ' + seed);
      assert.equal(isPath(north) && isPath(south) && (isPath(west) || isPath(east)), false, 'north-south bridge must not have perpendicular path neighbors for seed ' + seed);
    }
  }
  assert.equal(sawBridge, true, 'seed sample should include at least one detected path-water-path bridge');
});

test('Island Viewer lanterns only occupy sparse inside path corners', () => {
  assert.match(generator, /function placeStrategicLampLayer\(cells, seed\)/);
  assert.match(generator, /function lampCornerSides\(cells, index\)/);
  assert.match(generator, /placeStrategicLampLayer\(cells, seed\);/);
  assert.match(generator, /return placed\.every\(other => distanceBetween\(other, index\) > 3\);/);
  const api = loadIslandGenerator().TinyWorldIslandGenerator;
  let sawLamp = false;
  for (let i = 0; i < 180; i++) {
    const seed = 'viewer-lantern-corners-' + i;
    const world = api.generate({ seed, archetype: 'village', gridSize: 8 });
    const lamps = world.cells.filter(cell => cell.kind === 'lamp-post');
    if (lamps.length) sawLamp = true;
    for (const lamp of lamps) {
      assert.equal(lamp.terrain, 'grass', 'lamp must be placed on grass for seed ' + seed);
      assert.ok(perpendicularPathCornerSides(world, lamp), 'lamp must sit inside a perpendicular path corner for seed ' + seed + ' at ' + lamp.x + ',' + lamp.z);
    }
    for (let a = 0; a < lamps.length; a++) {
      for (let b = a + 1; b < lamps.length; b++) {
        assert.ok(manhattan(lamps[a], lamps[b]) > 3, 'lamps must not be within 3 spaces for seed ' + seed);
      }
    }
  }
  assert.equal(sawLamp, true, 'seed sample should include at least one strategic lantern');
});

test('Island Viewer manor is a rare connected footprint building', () => {
  assert.match(generator, /function manorFootprintIndexes\(anchorIndex, doorSide\)/);
  assert.match(generator, /function routeManorDoorToPath\(cells, startIndex, blocked\)/);
  assert.match(generator, /function placeManorLayer\(cells, seed\)/);
  assert.match(generator, /plainHouseIndexes\(cells\)\.length < 3/);
  assert.match(generator, /seededRandom\(String\(seed\) \+ '\|manor-chance'\)\(\) >= 0\.25/);
  assert.match(generator, /placeManorLayer\(cells, seed\);\s*placeFencedCropAreaLayer/);
  const api = loadIslandGenerator().TinyWorldIslandGenerator;
  let eligible = 0;
  let sawManor = false;
  for (let i = 0; i < 320; i++) {
    const seed = 'viewer-manor-footprint-' + i;
    const world = api.generate({ seed, archetype: 'village', gridSize: 8 });
    const plainHouses = world.cells.filter(cell => cell.kind === 'house' && !cell.buildingType);
    const manors = world.cells.filter(cell => cell.kind === 'house' && cell.buildingType === 'manor');
    if (plainHouses.length >= 3) eligible++;
    assert.ok(manors.length <= 1, 'manor should be at most one per island for seed ' + seed);
    for (const manor of manors) {
      sawManor = true;
      assert.ok(plainHouses.length >= 3, 'manor should only appear once three normal houses exist for seed ' + seed);
      assert.equal(manor.floors, 2);
      const front = frontCell(world, manor);
      assert.equal(isPath(front), true, 'manor door front must be path for seed ' + seed + ' at ' + manor.x + ',' + manor.z);
      assert.ok(connectedPathSize(world, front) > 1, 'manor door path must connect into the existing path network for seed ' + seed);
    }
  }
  assert.ok(eligible > 0, 'seed sample should include manor-eligible islands');
  assert.equal(sawManor, true, 'seed sample should include a rare manor');
});

test('Island Viewer fenced crop plot rolls empty and five crop kinds', () => {
  assert.match(generator, /const cropIds = \['wheat', 'corn', 'carrot', 'pumpkin', 'sunflower'\];/);
  assert.match(generator, /roll < 0\.25 \? null/);
  assert.match(generator, /crop-area-fill/);
  const api = loadIslandGenerator().TinyWorldIslandGenerator;
  const seen = new Map([['empty', 0], ...VIEWER_CROP_KINDS.map(kind => [kind, 0])]);
  let totalSlots = 0;
  for (let i = 0; i < 500; i++) {
    const seed = 'viewer-crop-plot-random-' + i;
    const world = api.generate({ seed, archetype: 'pastoral', gridSize: 8 });
    const plot = world.cells.filter(cell => cell.terrain === 'dirt'
      && Array.isArray(cell.extras)
      && cell.extras.some(extra => extra && extra.kind === 'fence'));
    assert.equal(plot.length, 4, 'fenced crop plot should stay four dirt cells for seed ' + seed);
    for (const cell of plot) {
      totalSlots++;
      if (cell.kind === null) {
        seen.set('empty', seen.get('empty') + 1);
      } else {
        assert.ok(VIEWER_CROP_KINDS.includes(cell.kind), 'unexpected crop kind ' + cell.kind + ' for seed ' + seed);
        seen.set(cell.kind, seen.get(cell.kind) + 1);
      }
    }
  }
  assert.ok(seen.get('empty') / totalSlots > 0.18 && seen.get('empty') / totalSlots < 0.32, 'empty crop slot rate should stay near 25%');
  for (const kind of VIEWER_CROP_KINDS) {
    assert.ok(seen.get(kind) > 0, 'crop plot sample should include ' + kind);
  }
});

test('Island Viewer tree, bush, and weighted infill layers fill remaining grass', () => {
  assert.match(generator, /function placeTreeBushLayer\(cells, seed\)/);
  assert.match(generator, /function treeCandidates\(cells, seed\)/);
  assert.match(generator, /function bushCandidates\(cells, seed\)/);
  assert.match(generator, /function placeStoneOutcropLayer\(cells, seed\)/);
  assert.match(generator, /function placeProbabilisticInfillLayer\(cells, seed\)/);
  assert.match(generator, /function weightedInfillOptions\(cells, index\)/);
  assert.match(generator, /placeStoneOutcropLayer\(cells, seed\);\s*placeTreeBushLayer\(cells, seed\);\s*placeProbabilisticInfillLayer\(cells, seed\);/);
  const api = loadIslandGenerator().TinyWorldIslandGenerator;
  let sawTree = false;
  let sawBush = false;
  let sawCrop = false;
  let sawOre = false;
  let sawPlainStone = false;
  let sawAnimal = false;
  for (let i = 0; i < 180; i++) {
    const seed = 'viewer-tree-bush-layer-' + i;
    const world = api.generate({ seed, archetype: 'forest', gridSize: 8 });
    const trees = world.cells.filter(cell => cell.kind === 'tree');
    const bushes = world.cells.filter(cell => cell.kind === 'bush');
    const crops = world.cells.filter(cell => VIEWER_CROP_KINDS.includes(cell.kind));
    const ores = world.cells.filter(cell => cell.kind === 'rock' && cell.terrain === 'stone' && cell.appearance && cell.appearance.oreMetal);
    const plainStones = world.cells.filter(cell => cell.kind === 'rock' && cell.terrain === 'stone' && !(cell.appearance && cell.appearance.oreMetal));
    const animals = world.cells.filter(cell => cell.kind === 'cow' || cell.kind === 'sheep');
    const reserved = manorReservedKeys(world);
    sawTree ||= trees.length > 0;
    sawBush ||= bushes.length > 0;
    sawCrop ||= crops.length > 4;
    sawOre ||= ores.length > 4;
    sawPlainStone ||= plainStones.length > 0;
    sawAnimal ||= animals.length > 0;
    for (const tree of trees) {
      assert.equal(tree.terrain, 'grass', 'tree must be placed on grass for seed ' + seed);
    }
    for (const bush of bushes) {
      assert.equal(bush.terrain, 'grass', 'bush must be placed on grass for seed ' + seed);
    }
    for (const cell of world.cells) {
      if (reserved.has(cell.x + ',' + cell.z)) continue;
      assert.equal(isOrdinaryEmptyLand(cell), false, 'ordinary empty land should be infilled for seed ' + seed + ' at ' + cell.x + ',' + cell.z);
    }
  }
  assert.equal(sawTree, true, 'seed sample should include trees');
  assert.equal(sawBush, true, 'seed sample should include bushes');
  assert.equal(sawCrop, true, 'seed sample should include extra crops');
  assert.equal(sawOre, true, 'seed sample should include extra ore');
  assert.equal(sawPlainStone, true, 'seed sample should include plain stone rocks');
  assert.equal(sawAnimal, true, 'seed sample should include extra animals');
});

test('Island Viewer quarry and stone outcrop layers emit stone plus all four ore metal variants', () => {
  assert.match(generator, /function compactRockPatch\(cells, seed\)/);
  assert.match(generator, /function stoneContextValue\(cells, index\)/);
  const api = loadIslandGenerator().TinyWorldIslandGenerator;
  const required = ['copper', 'iron', 'silver', 'gold'];
  for (let i = 0; i < 180; i++) {
    const seed = 'viewer-ore-variants-' + i;
    const world = api.generate({ seed, gridSize: 8 });
    const metals = new Set(world.cells
      .filter(cell => cell.kind === 'rock' && cell.appearance && cell.appearance.oreMetal)
      .map(cell => cell.appearance.oreMetal));
    const plainStones = world.cells.filter(cell => cell.kind === 'rock' && !(cell.appearance && cell.appearance.oreMetal));
    assert.ok(plainStones.length > 0, seed + ' should include plain Stone rock');
    for (const metal of required) {
      assert.equal(metals.has(metal), true, seed + ' should include ore metal ' + metal);
    }
  }
});

test('Island Viewer water carving crosses any path area through one cell only', () => {
  assert.match(generator, /function waterPathComponents\(cells\)/);
  assert.match(generator, /function waterRouteStateKey\(index, crossedComponents\)/);
  assert.match(generator, /return Number\.isFinite\(componentId\) && !crossedComponents\.has\(componentId\);/);
  assert.match(generator, /const crossedComponents = new Set\(current\.crossedComponents\);/);
  assert.match(generator, /if \(Number\.isFinite\(componentId\)\) crossedComponents\.add\(componentId\);/);
  const api = loadIslandGenerator().TinyWorldIslandGenerator;
  for (let i = 0; i < 80; i++) {
    const seed = 'viewer-water-crossing-' + i;
    const world = api.generate({ seed, archetype: 'river', gridSize: 8 });
    assert.equal(world.cells.some(cell => cell.terrain === 'water'), true);
    assert.equal(world.cells.some(cell => cell.terrain === 'path'), true);
  }
});
