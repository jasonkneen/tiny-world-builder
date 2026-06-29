import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';

import { buildEngineFns } from './helpers/extract-fn.mjs';

const generatorPath = path.resolve('engine/world/26-ai-generation.js');
const economyProfilePath = path.resolve('engine/world/26b-random-island-economy-profile.js');
const economyProfileJs = readFileSync(economyProfilePath, 'utf8');
const preamble = `
  const GRID = 8;
  function coerceGridSize(value, fallback) {
    const n = Number(value);
    return [8, 10, 12, 16, 20].includes(n) ? n : fallback;
  }
  function randomSeed() { return 'tiny-1'; }
`;

const {
  generateRandomIslandWorld,
} = buildEngineFns(generatorPath, ['generateRandomIslandWorld'], preamble);
const {
  buildIslandRawYieldEconomy,
  buildRandomIslandEconomyProfile,
} = buildEngineFns(economyProfilePath, ['buildIslandRawYieldEconomy', 'buildRandomIslandEconomyProfile'], preamble);

const DEFAULT_BIOMES = { grass: 55, forest: 20, water: 10, dirt: 10, settlement: 5 };
const DEFAULT_ELEVATION = { plains: 55, hills: 30, mountains: 15 };
const ALLOWED_TERRAINS = new Set(['grass', 'path', 'dirt', 'water', 'stone', 'lava', 'sand', 'snow']);
const ALLOWED_KINDS = new Set([null, 'house', 'tree', 'fence', 'rock', 'bridge', 'crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower', 'tuft', 'flower', 'bush', 'cow', 'sheep', 'lamp-post', 'spotlight', 'voxel-build', 'model-stamp', 'artifact', 'relic', 'crystal', 'totem', 'ruins', 'stargate']);
const REQUIRED_CELL_KEYS = ['x', 'z', 'terrain', 'kind', 'floors', 'terrainFloors', 'buildingType', 'fenceSide'];
const CROP_KINDS = new Set(['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower']);
const ANIMAL_KINDS = new Set(['cow', 'sheep']);
const FENCE_EDGE_SIDES = new Set(['n', 'e', 's', 'w']);
const SIDE_DELTAS = {
  n: [0, -1],
  e: [1, 0],
  s: [0, 1],
  w: [-1, 0],
};
const OPPOSITE_SIDE = { n: 's', e: 'w', s: 'n', w: 'e' };

function makeIsland(overrides = {}) {
  return generateRandomIslandWorld({
    seed: 'mossbridge-12345',
    biomes: DEFAULT_BIOMES,
    elevation: DEFAULT_ELEVATION,
    gridSize: 8,
    ...overrides,
  });
}

test('random island generator is deterministic and emits complete v4 cells', () => {
  const first = makeIsland();
  const second = makeIsland();

  assert.deepEqual(first, second);
  assert.equal(first.v, 4);
  assert.equal(first.gridSize, 8);
  assert.equal(first.cells.length, 64);

  const seen = new Set();
  for (const cell of first.cells) {
    for (const key of REQUIRED_CELL_KEYS) assert.ok(Object.hasOwn(cell, key), 'missing ' + key);
    assert.ok(Number.isInteger(cell.x) && cell.x >= 0 && cell.x < 8);
    assert.ok(Number.isInteger(cell.z) && cell.z >= 0 && cell.z < 8);
    const coord = cell.x + ',' + cell.z;
    assert.equal(seen.has(coord), false, 'duplicate cell ' + coord);
    seen.add(coord);
    assert.ok(ALLOWED_TERRAINS.has(cell.terrain), 'terrain ' + cell.terrain);
    assert.ok(ALLOWED_KINDS.has(cell.kind), 'kind ' + cell.kind);
    assert.ok(Number.isInteger(cell.floors) && cell.floors >= 1 && cell.floors <= 8);
    assert.ok(Number.isInteger(cell.terrainFloors) && cell.terrainFloors >= 1 && cell.terrainFloors <= 8);
    if (cell.kind !== 'house') assert.equal(cell.buildingType, null);
    if (cell.kind !== 'fence') assert.equal(cell.fenceSide, null);
    if (cell.extras) {
      assert.ok(Array.isArray(cell.extras), 'extras should be an array');
      for (const extra of cell.extras) {
        assert.equal(extra.kind, 'fence', 'random island extras should be fence edges');
        assert.ok(FENCE_EDGE_SIDES.has(extra.fenceSide), 'extra fence side should be an edge');
      }
    }
    if (cell.appearance) assert.equal(cell.appearance.objectStyle, 'voxel');
  }
});

test('random island generator emits flat terrain and suppresses no-effect props', () => {
  for (const archetype of Object.keys(ARCHETYPE_MIXES)) {
    const island = makeIsland({
      seed: 'wave2-cleanup-' + archetype,
      archetype,
      biomes: ARCHETYPE_MIXES[archetype].biomes,
      elevation: ARCHETYPE_MIXES[archetype].elevation,
    });
    assert.ok(island.cells.every(cell => cell.terrainFloors === 1), archetype + ' should emit flat terrain');
    assert.equal(island.cells.some(cell => cell.kind === 'spotlight'), false, archetype + ' should suppress spotlight props');
  }
});

test('random island generator limits lamp posts to two non-adjacent cells', () => {
  for (const archetype of Object.keys(ARCHETYPE_MIXES)) {
    const island = makeIsland({
      seed: 'wave2-lamps-' + archetype,
      archetype,
      biomes: ARCHETYPE_MIXES[archetype].biomes,
      elevation: ARCHETYPE_MIXES[archetype].elevation,
    });
    const lamps = island.cells.filter(cell => cell.kind === 'lamp-post');
    assert.ok(lamps.length <= 2, archetype + ' should emit at most two lamp posts');
    for (const lamp of lamps) {
      assert.equal(
        adjacentCells(island.cells, lamp).some(neighbor => neighbor.kind === 'lamp-post'),
        false,
        archetype + ' lamp posts should not be adjacent'
      );
    }
  }
});

test('explicit archetypes map lab props to native TinyWorld assets', () => {
  const island = makeIsland({
    seed: 'test-village',
    archetype: 'village',
    biomes: { grass: 25, forest: 15, water: 10, dirt: 15, settlement: 35 },
  });
  const kinds = new Set(island.cells.map(cell => cell.kind).filter(Boolean));

  assert.ok(kinds.has('house'), 'village should place houses');
  assert.ok(kinds.has('lamp-post') || kinds.has('flower'), 'village should include mapped props');
  assert.ok(island.cells.some(cell => cell.appearance && cell.appearance.objectStyle === 'voxel'), 'mapped props should request voxel assets');
  for (const kind of kinds) assert.ok(ALLOWED_KINDS.has(kind), 'unexpected kind ' + kind);
});

test('random island generator respects supported app grid sizes', () => {
  const island = makeIsland({ gridSize: 16, seed: 'wide-harbor', archetype: 'harbor' });
  assert.equal(island.gridSize, 16);
  assert.equal(island.cells.length, 256);
  assert.ok(island.cells.some(cell => cell.terrain === 'water'), 'harbor should include water');
  assert.ok(island.cells.some(cell => cell.kind), 'harbor should include placed assets');
});

test('random island economy profile names and scores the loaded TinyWorld cells', () => {
  const island = makeIsland({
    seed: 'market-haven',
    archetype: 'village',
    biomes: { grass: 30, forest: 12, water: 10, dirt: 16, settlement: 32 },
  });
  const profile = buildRandomIslandEconomyProfile(island, { seed: 'market-haven', archetype: 'village' });

  assert.equal(profile.seed, 'market-haven');
  assert.match(profile.name, /\S+\s+\S+/);
  assert.equal(profile.rawYield.aspect, 'raw_yield');
  assert.equal(profile.rawYield.name, profile.name);
  assert.equal(profile.economy.aspect, 'raw_yield');
  assert.equal(profile.economy.rarityScope, 'raw_yield');
  assert.ok(profile.economy.rawYieldScore >= 0);
  assert.ok(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].includes(profile.economy.rarity));
  assert.equal(Object.prototype.hasOwnProperty.call(profile.economy, 'potential'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(profile.economy, 'rarityScore'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(profile, 'archetype'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(profile, 'bestUse'), false);
});

function rawYieldScoreCells(score) {
  const units = [
    { kind: 'rock', value: 13, terrain: 'stone', appearance: { oreMetal: 'gold' } },
    { kind: 'pumpkin', value: 6, terrain: 'dirt' },
    { kind: 'wheat', value: 5, terrain: 'dirt' },
    { kind: 'tree', value: 2, terrain: 'grass' },
    { kind: 'rock', value: 1, terrain: 'stone' },
  ];
  const memo = new Set();
  function solve(remaining) {
    if (remaining === 0) return [];
    if (remaining < 0 || memo.has(remaining)) return null;
    for (const unit of units) {
      const tail = solve(remaining - unit.value);
      if (tail) return [unit].concat(tail);
    }
    memo.add(remaining);
    return null;
  }
  const plan = solve(score);
  assert.ok(plan, 'test helper should hit exact raw yield score');
  return plan.map((unit, i) => ({
    x: i,
    z: 0,
    terrain: unit.terrain,
    kind: unit.kind,
    floors: 1,
    terrainFloors: 1,
    buildingType: null,
    fenceSide: null,
    appearance: unit.appearance,
  }));
}

function expectedFishRoll(value) {
  let h = 1779033703 ^ String(value).length;
  const str = String(value);
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  let n = (h ^= h >>> 16) >>> 0;
  let t = (n += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function expectedFishCount(seed, cells) {
  return cells.filter(cell => cell.terrain === 'water')
    .reduce((total, cell) => total + (expectedFishRoll(seed + '|fish|' + cell.x + ',' + cell.z) < 0.25 ? 1 : 0), 0);
}

test('raw yield economy counts resources, fish, buildings, and ore metals', () => {
  const world = {
    v: 4,
    gridSize: 8,
    cells: [
      { x: 0, z: 0, terrain: 'dirt', kind: 'wheat', floors: 2, terrainFloors: 1 },
      { x: 1, z: 0, terrain: 'dirt', kind: 'corn', floors: 1, terrainFloors: 1 },
      { x: 2, z: 0, terrain: 'stone', kind: 'rock', floors: 1, terrainFloors: 1, appearance: { oreMetal: 'gold' } },
      { x: 3, z: 0, terrain: 'stone', kind: 'rock', floors: 1, terrainFloors: 1, appearance: { oreMetal: 'iron' } },
      { x: 4, z: 0, terrain: 'grass', kind: 'cow', floors: 1, terrainFloors: 1 },
      { x: 5, z: 0, terrain: 'grass', kind: 'sheep', floors: 1, terrainFloors: 1 },
      { x: 6, z: 0, terrain: 'grass', kind: 'tree', floors: 1, terrainFloors: 1 },
      { x: 7, z: 0, terrain: 'grass', kind: 'bush', floors: 1, terrainFloors: 1 },
      { x: 0, z: 1, terrain: 'water', kind: null, floors: 1, terrainFloors: 1 },
      { x: 1, z: 1, terrain: 'water', kind: null, floors: 1, terrainFloors: 1 },
      { x: 2, z: 1, terrain: 'grass', kind: 'house', floors: 1, terrainFloors: 1, buildingType: null },
      { x: 3, z: 1, terrain: 'grass', kind: 'house', floors: 1, terrainFloors: 1, buildingType: 'tower' },
      { x: 4, z: 1, terrain: 'grass', kind: 'house', floors: 1, terrainFloors: 1, buildingType: 'manor' },
    ],
  };
  const profile = buildIslandRawYieldEconomy(world, { seed: 'raw-counts', name: 'Raw Counts' });
  const again = buildIslandRawYieldEconomy(world, { seed: 'raw-counts', name: 'Raw Counts' });
  const expectedFish = expectedFishCount('raw-counts', world.cells);

  assert.equal(profile.aspect, 'raw_yield');
  assert.equal(profile.label, 'Raw Yield');
  assert.equal(profile.resources.crops.wheat, 1);
  assert.equal(profile.resources.crops.corn, 1);
  assert.equal(profile.resources.rockOre.goldOre, 1);
  assert.equal(profile.resources.rockOre.iron, 1);
  assert.equal(profile.resources.animals.cow, 1);
  assert.equal(profile.resources.animals.sheep, 1);
  assert.equal(profile.resources.nature.trees, 1);
  assert.equal(profile.resources.nature.berries, 1);
  assert.equal(profile.resources.nature.water, 2);
  assert.equal(profile.resources.nature.fish, expectedFish);
  assert.equal(profile.resources.nature.fish, again.resources.nature.fish);
  assert.equal(world.cells.some(cell => cell.kind === 'fish'), false);
  assert.match(economyProfileJs, /rawYieldRandom\(seed \+ '\|fish\|' \+ cell\.x \+ ',' \+ cell\.z\)\(\)/);
  assert.match(economyProfileJs, /fishRoll < 0\.25/);
  assert.equal(profile.resources.buildings.houses, 1);
  assert.equal(profile.resources.buildings.towers, 1);
  assert.equal(profile.resources.buildings.manor, 1);
  assert.equal(profile.scores.crops, 10);
  assert.equal(profile.scores.rockOre, 20);
  assert.equal(profile.scores.animals, 15);
  assert.equal(profile.scores.nature, 5 + profile.resources.nature.fish * 7);
  assert.equal(profile.scores.rawYield, 50 + profile.resources.nature.fish * 7);
  assert.equal(profile.scores.buildings, 53);
  assert.equal(profile.scores.totalRank, profile.scores.rawYield + 53);
  assert.equal(Object.prototype.hasOwnProperty.call(profile.resources, 'GOLD'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(profile.scores, 'gold'), false);
});

test('raw yield economy counts compact builder tuple cells', () => {
  const objectWorld = {
    v: 4,
    gridSize: 8,
    cells: [
      { x: 0, z: 0, terrain: 'dirt', kind: 'wheat', floors: 1, terrainFloors: 1, buildingType: null, fenceSide: null },
      { x: 1, z: 0, terrain: 'dirt', kind: 'sunflower', floors: 1, terrainFloors: 1, buildingType: null, fenceSide: null },
      { x: 2, z: 0, terrain: 'stone', kind: 'rock', floors: 1, terrainFloors: 1, buildingType: null, fenceSide: null, appearance: { oreMetal: 'silver' } },
      { x: 3, z: 0, terrain: 'stone', kind: 'rock', floors: 1, terrainFloors: 1, buildingType: null, fenceSide: null, appearance: { oreMetal: 'gold' } },
      { x: 4, z: 0, terrain: 'grass', kind: 'sheep', floors: 1, terrainFloors: 1, buildingType: null, fenceSide: null },
      { x: 5, z: 0, terrain: 'grass', kind: 'cow', floors: 1, terrainFloors: 1, buildingType: null, fenceSide: null },
      { x: 6, z: 0, terrain: 'grass', kind: 'tree', floors: 1, terrainFloors: 1, buildingType: null, fenceSide: null },
      { x: 7, z: 0, terrain: 'grass', kind: 'bush', floors: 1, terrainFloors: 1, buildingType: null, fenceSide: null },
      { x: 0, z: 1, terrain: 'water', kind: null, floors: 1, terrainFloors: 1, buildingType: null, fenceSide: null },
      { x: 1, z: 1, terrain: 'grass', kind: 'house', floors: 1, terrainFloors: 1, buildingType: 'tower', fenceSide: null },
    ],
  };
  const tupleWorld = {
    v: 4,
    gridSize: 8,
    cells: objectWorld.cells.map(cell => [
      cell.x,
      cell.z,
      cell.terrain,
      cell.kind,
      cell.floors,
      cell.buildingType,
      cell.terrainFloors,
      cell.fenceSide,
      null,
      null,
      cell.appearance || null,
    ]),
  };
  const objectProfile = buildIslandRawYieldEconomy(objectWorld, { seed: 'tuple-counts', name: 'Tuple Counts' });
  const tupleProfile = buildIslandRawYieldEconomy(tupleWorld, { seed: 'tuple-counts', name: 'Tuple Counts' });

  assert.equal(tupleProfile.scores.rawYield, objectProfile.scores.rawYield);
  assert.equal(tupleProfile.scores.buildings, objectProfile.scores.buildings);
  assert.equal(JSON.stringify(tupleProfile.resources), JSON.stringify(objectProfile.resources));
  assert.equal(tupleProfile.resources.rockOre.silver, 1);
  assert.equal(tupleProfile.resources.rockOre.goldOre, 1);
  assert.equal(tupleProfile.resources.animals.sheep, 1);
  assert.equal(tupleProfile.resources.animals.cow, 1);
  assert.equal(tupleProfile.resources.buildings.towers, 1);
  assert.ok(tupleProfile.scores.rawYield > 0);
});

test('raw yield ignores paths, bridges, fences, and lanterns as economic producers', () => {
  const blank = buildIslandRawYieldEconomy({ v: 4, gridSize: 8, cells: [] }, { seed: 'infra' });
  const infra = buildIslandRawYieldEconomy({
    v: 4,
    gridSize: 8,
    cells: [
      { x: 0, z: 0, terrain: 'path', kind: null, floors: 1, terrainFloors: 1 },
      { x: 1, z: 0, terrain: 'grass', kind: 'bridge', floors: 1, terrainFloors: 1 },
      { x: 2, z: 0, terrain: 'grass', kind: 'fence', floors: 1, terrainFloors: 1, fenceSide: 'n' },
      { x: 3, z: 0, terrain: 'grass', kind: 'lamp-post', floors: 1, terrainFloors: 1 },
      { x: 4, z: 0, terrain: 'grass', kind: null, floors: 1, terrainFloors: 1, extras: [{ kind: 'fence', fenceSide: 'e' }] },
    ],
  }, { seed: 'infra' });

  assert.equal(infra.scores.rawYield, blank.scores.rawYield);
  assert.equal(infra.resources.buildings.houses, 0);
  assert.equal(infra.resources.buildings.towers, 0);
  assert.equal(infra.resources.buildings.manor, 0);
});

test('raw yield rarity thresholds use the canonical score bands', () => {
  const cases = [
    [169, 'Common'],
    [170, 'Uncommon'],
    [193, 'Rare'],
    [212, 'Epic'],
    [231, 'Legendary'],
  ];
  for (const [score, rarity] of cases) {
    const profile = buildIslandRawYieldEconomy({ v: 4, gridSize: 64, cells: rawYieldScoreCells(score) }, { seed: 'band-' + score });
    assert.equal(profile.scores.rawYield, score);
    assert.equal(profile.rarity.label, rarity);
    assert.equal(profile.label, 'Raw Yield');
  }
});

const ARCHETYPE_MIXES = {
  pastoral: {
    biomes: { grass: 55, forest: 10, water: 8, dirt: 22, settlement: 5 },
    elevation: { plains: 70, hills: 24, mountains: 6 },
    signature: ['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower', 'cow', 'sheep'],
  },
  forest: {
    biomes: { grass: 35, forest: 44, water: 8, dirt: 10, settlement: 3 },
    elevation: { plains: 48, hills: 40, mountains: 12 },
    signature: ['tree', 'bush', 'flower'],
  },
  quarry: {
    biomes: { grass: 18, forest: 10, water: 6, dirt: 26, settlement: 8 },
    elevation: { plains: 20, hills: 42, mountains: 38 },
    signature: ['rock', 'crystal'],
  },
  river: {
    biomes: { grass: 35, forest: 14, water: 32, dirt: 14, settlement: 5 },
    elevation: { plains: 64, hills: 28, mountains: 8 },
    signature: ['bridge', 'crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower', 'flower', 'house'],
  },
  village: {
    biomes: { grass: 30, forest: 12, water: 10, dirt: 16, settlement: 32 },
    elevation: { plains: 60, hills: 30, mountains: 10 },
    signature: ['house', 'lamp-post', 'flower'],
  },
  fortress: {
    biomes: { grass: 20, forest: 8, water: 8, dirt: 20, settlement: 44 },
    elevation: { plains: 22, hills: 38, mountains: 40 },
    signature: ['house', 'rock', 'crystal'],
  },
  ruins: {
    biomes: { grass: 26, forest: 20, water: 10, dirt: 24, settlement: 20 },
    elevation: { plains: 34, hills: 42, mountains: 24 },
    signature: ['ruins', 'totem', 'crystal', 'tree', 'bush'],
  },
  harbor: {
    biomes: { grass: 24, forest: 8, water: 38, dirt: 10, settlement: 20 },
    elevation: { plains: 62, hills: 28, mountains: 10 },
    signature: ['bridge', 'house', 'lamp-post', 'flower'],
  },
};

function adjacentCells(cells, cell) {
  const byCoord = new Map(cells.map(entry => [entry.x + ',' + entry.z, entry]));
  return [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .map(([dx, dz]) => byCoord.get((cell.x + dx) + ',' + (cell.z + dz)))
    .filter(Boolean);
}

function cellsWithin(cells, cell, distance) {
  return cells.filter(entry => (
    entry !== cell
    && Math.abs(entry.x - cell.x) + Math.abs(entry.z - cell.z) <= distance
  ));
}

function nearCell(cells, cell, predicate, distance = 1) {
  return cellsWithin(cells, cell, distance).some(predicate);
}

function chebyshevDistance(cell, other) {
  return Math.max(Math.abs(cell.x - other.x), Math.abs(cell.z - other.z));
}

function connectedCellGroups(cells, groupCells) {
  const groupKeys = new Set(groupCells.map(cell => cell.x + ',' + cell.z));
  const byCoord = cellByCoord(cells);
  const seen = new Set();
  const groups = [];
  for (const start of groupCells) {
    const startKey = start.x + ',' + start.z;
    if (seen.has(startKey)) continue;
    const stack = [start];
    const group = [];
    while (stack.length) {
      const cell = stack.pop();
      const key = cell.x + ',' + cell.z;
      if (seen.has(key) || !groupKeys.has(key)) continue;
      seen.add(key);
      group.push(cell);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const neighbor = byCoord.get((cell.x + dx) + ',' + (cell.z + dz));
        if (neighbor) stack.push(neighbor);
      }
    }
    groups.push(group);
  }
  return groups;
}

function boundingBoxForCells(cells) {
  const xs = cells.map(cell => cell.x);
  const zs = cells.map(cell => cell.z);
  return {
    width: Math.max(...xs) - Math.min(...xs) + 1,
    height: Math.max(...zs) - Math.min(...zs) + 1,
  };
}

function fenceSideFacesNeighbor(fence, neighbor) {
  if (!fence || !neighbor) return false;
  if (neighbor.x < fence.x) return fence.fenceSide === 'w';
  if (neighbor.x > fence.x) return fence.fenceSide === 'e';
  if (neighbor.z < fence.z) return fence.fenceSide === 'n';
  if (neighbor.z > fence.z) return fence.fenceSide === 's';
  return false;
}

function cellByCoord(cells) {
  return new Map(cells.map(entry => [entry.x + ',' + entry.z, entry]));
}

function neighborForSide(byCoord, cell, side) {
  const delta = SIDE_DELTAS[side];
  return byCoord.get((cell.x + delta[0]) + ',' + (cell.z + delta[1])) || null;
}

function fenceEdgeEntries(cell) {
  const entries = [];
  if (!cell) return entries;
  function styleFor(appearance) {
    const style = appearance && appearance.fenceStyle;
    return style === 'garden' || style === 'gate' ? style : 'wood';
  }
  if (cell.kind === 'fence' && FENCE_EDGE_SIDES.has(cell.fenceSide)) entries.push({ side: cell.fenceSide, source: 'primary', fenceStyle: styleFor(cell.appearance) });
  if (Array.isArray(cell.extras)) {
    for (const extra of cell.extras) {
      if (extra && extra.kind === 'fence' && FENCE_EDGE_SIDES.has(extra.fenceSide)) {
        entries.push({ side: extra.fenceSide, source: 'extra', fenceStyle: styleFor(extra.appearance) });
      }
    }
  }
  return entries;
}

function hasFenceEdge(cell, side) {
  return fenceEdgeEntries(cell).some(entry => entry.side === side);
}

function boundaryFenceStats(island, regionCells, sameRegion) {
  const byCoord = cellByCoord(island.cells);
  const stats = { boundary: 0, fenced: 0, pathGates: 0 };
  for (const cell of regionCells) {
    for (const side of FENCE_EDGE_SIDES) {
      const neighbor = neighborForSide(byCoord, cell, side);
      if (neighbor && sameRegion(neighbor)) continue;
      stats.boundary++;
      const edgeEntries = fenceEdgeEntries(cell).filter(entry => entry.side === side);
      if (edgeEntries.length) stats.fenced++;
      if (neighbor && neighbor.terrain === 'path' && edgeEntries.some(entry => entry.fenceStyle === 'gate')) stats.pathGates++;
    }
  }
  return stats;
}

function assertSeparatedResourceEdges(island) {
  const byCoord = cellByCoord(island.cells);
  for (const crop of island.cells.filter(cell => CROP_KINDS.has(cell.kind))) {
    for (const side of FENCE_EDGE_SIDES) {
      const neighbor = neighborForSide(byCoord, crop, side);
      if (!neighbor || !ANIMAL_KINDS.has(neighbor.kind)) continue;
      assert.ok(
        hasFenceEdge(crop, side) || hasFenceEdge(neighbor, OPPOSITE_SIDE[side]),
        'crop at ' + crop.x + ',' + crop.z + ' should be fenced off from animal at ' + neighbor.x + ',' + neighbor.z
      );
    }
  }
}

function isFenceEnclosureNeighbor(cell) {
  return !!cell && (
    CROP_KINDS.has(cell.kind)
    || ANIMAL_KINDS.has(cell.kind)
    || cell.kind === 'house'
    || cell.kind === 'flower'
    || cell.kind === 'bush'
  );
}

function waterComponents(island) {
  const water = new Set(island.cells.filter(cell => cell.terrain === 'water').map(cell => cell.x + ',' + cell.z));
  const seen = new Set();
  const components = [];
  for (const start of water) {
    if (seen.has(start)) continue;
    const stack = [start];
    const cells = [];
    let touchesTop = false;
    let touchesBottom = false;
    let touchesLeft = false;
    let touchesRight = false;
    while (stack.length) {
      const key = stack.pop();
      if (seen.has(key) || !water.has(key)) continue;
      seen.add(key);
      cells.push(key);
      const [x, z] = key.split(',').map(Number);
      touchesTop = touchesTop || z === 0;
      touchesBottom = touchesBottom || z === island.gridSize - 1;
      touchesLeft = touchesLeft || x === 0;
      touchesRight = touchesRight || x === island.gridSize - 1;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        stack.push((x + dx) + ',' + (z + dz));
      }
    }
    components.push({
      size: cells.length,
      edge: touchesTop || touchesBottom || touchesLeft || touchesRight,
      river: (touchesTop && touchesBottom) || (touchesLeft && touchesRight),
    });
  }
  return components;
}

function sameTerrainAdjacencyRatio(island) {
  let compared = 0;
  let matching = 0;
  for (const cell of island.cells) {
    if (cell.terrain === 'water') continue;
    for (const neighbor of adjacentCells(island.cells, cell)) {
      if (neighbor.terrain === 'water') continue;
      compared++;
      if (neighbor.terrain === cell.terrain) matching++;
    }
  }
  return compared ? matching / compared : 0;
}

function isLargeGeneratedBuilding(cell) {
  return cell && cell.kind === 'house' && ['manor', 'tower', 'turret', 'skyscraper'].includes(cell.buildingType);
}

function isTowerCell(cell) {
  return cell && cell.kind === 'house' && cell.buildingType === 'tower';
}

function isFoodCell(cell) {
  return !!cell && (CROP_KINDS.has(cell.kind) || ANIMAL_KINDS.has(cell.kind) || cell.kind === 'bush');
}

function resourceCells(island, resourceId) {
  return island.cells.filter(cell => {
    if (resourceId === 'food') return isFoodCell(cell);
    if (resourceId === 'materials') return cell.kind === 'tree' || cell.kind === 'rock' || cell.kind === 'crystal';
    if (resourceId === 'commerce') return cell.kind === 'lamp-post' || cell.kind === 'bridge' || (cell.kind === 'house' && cell.buildingType !== 'tower');
    if (resourceId === 'defense') return cell.kind === 'fence' || cell.kind === 'totem' || isTowerCell(cell);
    if (resourceId === 'charm') return ['flower', 'bush', 'tree', 'crystal', 'totem', 'ruins'].includes(cell.kind);
    return false;
  });
}

function rotationYForCell(cell) {
  const transform = cell && cell.transform;
  if (Array.isArray(transform)) return Number(transform[0]) || 0;
  if (transform && typeof transform === 'object') return Number(transform.rotationY) || 0;
  return 0;
}

function towerDoorDotToCenter(island, tower) {
  const rotationY = rotationYForCell(tower);
  const forwardX = Math.sin(rotationY);
  const forwardZ = Math.cos(rotationY);
  const center = (island.gridSize - 1) / 2;
  const inwardX = center - tower.x;
  const inwardZ = center - tower.z;
  const length = Math.hypot(inwardX, inwardZ) || 1;
  return (forwardX * inwardX + forwardZ * inwardZ) / length;
}

function cornerDistance(island, cell) {
  const max = island.gridSize - 1;
  return Math.min(
    Math.abs(cell.x - 0) + Math.abs(cell.z - 0),
    Math.abs(cell.x - max) + Math.abs(cell.z - 0),
    Math.abs(cell.x - max) + Math.abs(cell.z - max),
    Math.abs(cell.x - 0) + Math.abs(cell.z - max)
  );
}

function pathConnectedBuilding(island, cell) {
  return cell.terrain === 'path' || adjacentCells(island.cells, cell).some(neighbor => neighbor.terrain === 'path');
}

function waterBridgeHasRoadBanksAndChannel(island, cell) {
  const byCoord = new Map(island.cells.map(entry => [entry.x + ',' + entry.z, entry]));
  function terrainAt(x, z) {
    const entry = byCoord.get(x + ',' + z);
    return entry && entry.terrain;
  }
  const horizontal = terrainAt(cell.x - 1, cell.z) === 'path'
    && terrainAt(cell.x + 1, cell.z) === 'path'
    && terrainAt(cell.x, cell.z - 1) === 'water'
    && terrainAt(cell.x, cell.z + 1) === 'water';
  const vertical = terrainAt(cell.x, cell.z - 1) === 'path'
    && terrainAt(cell.x, cell.z + 1) === 'path'
    && terrainAt(cell.x - 1, cell.z) === 'water'
    && terrainAt(cell.x + 1, cell.z) === 'water';
  return horizontal || vertical;
}

test('explicit archetypes produce grouped signature features', () => {
  for (const [archetype, config] of Object.entries(ARCHETYPE_MIXES)) {
    const island = makeIsland({
      seed: 'grammar-' + archetype,
      archetype,
      biomes: config.biomes,
      elevation: config.elevation,
    });
    const signature = new Set(config.signature);
    const featureCells = island.cells.filter(cell => (
      signature.has(cell.kind)
      && !(cell.kind === 'house' && cell.buildingType === 'tower' && archetype !== 'fortress')
    ));
    const grouped = featureCells.filter(cell => adjacentCells(island.cells, cell).some(neighbor => (
      signature.has(neighbor.kind)
      || ((archetype === 'river' || archetype === 'harbor') && neighbor.terrain === 'water')
    )) || island.cells.some(neighbor => (
      neighbor !== cell
      && chebyshevDistance(cell, neighbor) <= 1
      && signature.has(neighbor.kind)
    )));

    assert.ok(featureCells.length >= 5, archetype + ' should emit enough signature features');
    assert.ok(grouped.length / featureCells.length >= 0.4, archetype + ' signature features should be spatially grouped');

    if (archetype === 'village') assert.ok(island.cells.filter(cell => cell.kind === 'house').length >= 4, 'village should include a house block');
    if (archetype === 'river') assert.ok(island.cells.some(cell => cell.kind === 'bridge'), 'river should include a crossing');
    if (archetype === 'harbor') {
      assert.ok(
        island.cells.some(cell => cell.terrain === 'path' && adjacentCells(island.cells, cell).some(neighbor => neighbor.terrain === 'water')),
        'harbor should include a waterfront road'
      );
    }
  }
});

test('water terrain motifs include edge bias plus lake and river variants', () => {
  let samples = 0;
  let edgeWater = 0;
  let lakeLike = 0;
  let riverLike = 0;

  for (const [archetype, config] of Object.entries(ARCHETYPE_MIXES)) {
    for (let i = 0; i < 8; i++) {
      const island = makeIsland({
        seed: 'water-motif-' + archetype + '-' + i,
        archetype,
        biomes: config.biomes,
        elevation: config.elevation,
      });
      const components = waterComponents(island);
      samples++;
      if (components.some(component => component.edge)) edgeWater++;
      if (components.some(component => !component.edge && component.size >= 3)) lakeLike++;
      if (components.some(component => component.river)) riverLike++;
    }
  }

  assert.ok(edgeWater >= Math.ceil(samples * 0.9), 'water should strongly prefer at least one edge cell');
  assert.ok(lakeLike >= 1, 'seed sweep should include at least one lake-like interior water motif');
  assert.ok(riverLike >= 1, 'seed sweep should include at least one river-like spanning water motif');
});

test('water composition stays readable instead of moat-like', () => {
  const caps = {
    river: 0.27,
    harbor: 0.31,
  };
  for (const [archetype, config] of Object.entries(ARCHETYPE_MIXES)) {
    for (let i = 0; i < 8; i++) {
      const island = makeIsland({
        seed: 'water-composition-' + archetype + '-' + i,
        archetype,
        biomes: config.biomes,
        elevation: config.elevation,
      });
      const waterCells = island.cells.filter(cell => cell.terrain === 'water');
      const components = waterComponents(island);
      const cap = caps[archetype] || 0.23;

      assert.ok(waterCells.length / island.cells.length <= cap, archetype + ' should not overfill with water');
      assert.ok(components.length <= 3, archetype + ' should keep water to one main motif plus a small edge touch');
    }
  }
});

test('biome terrain fields create smooth terrain neighborhoods', () => {
  for (const [archetype, config] of Object.entries(ARCHETYPE_MIXES)) {
    const island = makeIsland({
      seed: 'biome-smooth-' + archetype,
      archetype,
      biomes: config.biomes,
      elevation: config.elevation,
    });
    assert.ok(
      sameTerrainAdjacencyRatio(island) >= 0.34,
      archetype + ' should have visible same-terrain neighborhoods'
    );
  }
});

test('water bridges only appear when connecting path roads', () => {
  for (const [archetype, config] of Object.entries(ARCHETYPE_MIXES)) {
    for (let i = 0; i < 8; i++) {
      const island = makeIsland({
        seed: 'road-bridge-' + archetype + '-' + i,
        archetype,
        biomes: config.biomes,
        elevation: config.elevation,
      });
      for (const cell of island.cells) {
        if (cell.kind !== 'bridge' || cell.terrain !== 'water') continue;
        assert.ok(
          waterBridgeHasRoadBanksAndChannel(island, cell),
          archetype + ' water bridge at ' + cell.x + ',' + cell.z + ' should connect path on opposite banks over a visible water channel'
        );
      }
    }
  }
});

test('generated large building variants keep a buffer from house clusters', () => {
  for (const [archetype, config] of Object.entries(ARCHETYPE_MIXES)) {
    for (let i = 0; i < 8; i++) {
      const island = makeIsland({
        seed: 'building-buffer-' + archetype + '-' + i,
        archetype,
        biomes: config.biomes,
        elevation: config.elevation,
      });
      for (const cell of island.cells) {
        if (!isLargeGeneratedBuilding(cell)) continue;
        for (const neighbor of adjacentCells(island.cells, cell)) {
          assert.notEqual(
            neighbor.kind,
            'house',
            archetype + ' large building at ' + cell.x + ',' + cell.z + ' should not touch house at ' + neighbor.x + ',' + neighbor.z
          );
        }
      }
    }
  }
});

test('resource motif pass composes fenced crop plots and animal pens', () => {
  for (let i = 0; i < 12; i++) {
    const island = makeIsland({
      seed: 'resource-motif-pastoral-' + i,
      archetype: 'pastoral',
      biomes: ARCHETYPE_MIXES.pastoral.biomes,
      elevation: ARCHETYPE_MIXES.pastoral.elevation,
    });
    const cropCells = island.cells.filter(cell => CROP_KINDS.has(cell.kind));
    const animalCells = island.cells.filter(cell => ANIMAL_KINDS.has(cell.kind));
    const cropStats = boundaryFenceStats(island, cropCells, cell => CROP_KINDS.has(cell.kind));
    const animalStats = boundaryFenceStats(island, animalCells, cell => ANIMAL_KINDS.has(cell.kind));

    assert.ok(cropCells.length >= 4, 'pastoral should include a crop plot');
    assert.ok(animalCells.length >= 3, 'pastoral should include a herd');
    assert.ok(cropStats.boundary > 0, 'crop plots should have boundary edges');
    assert.ok(animalStats.boundary > 0, 'animal pens should have boundary edges');
    assert.ok(cropStats.fenced / cropStats.boundary >= 0.75, 'crop plot boundary edges should be fenced');
    assert.ok(animalStats.fenced / animalStats.boundary >= 0.75, 'animal pen boundary edges should be fenced');
    assert.ok(cropStats.pathGates >= 1, 'crop plot should have a path-side gate opening');
    assert.ok(animalStats.pathGates >= 1, 'animal pen should have a path-side gate opening');
    assertSeparatedResourceEdges(island);
  }
});

test('generated food plots prefer compact square-ish areas buffered from main houses', () => {
  for (const [archetype, config] of Object.entries(ARCHETYPE_MIXES)) {
    for (let i = 0; i < 4; i++) {
      const island = makeIsland({
        seed: 'food-plot-clarity-' + archetype + '-' + i,
        archetype,
        biomes: config.biomes,
        elevation: config.elevation,
      });
      const cropCells = island.cells.filter(cell => CROP_KINDS.has(cell.kind));
      const mainHomes = island.cells.filter(cell => cell.kind === 'house' && cell.buildingType !== 'tower');

      for (const crop of cropCells) {
        assert.equal(
          mainHomes.some(home => chebyshevDistance(crop, home) <= 1),
          false,
          archetype + ' crop at ' + crop.x + ',' + crop.z + ' should keep one block between it and the main house'
        );
      }

      if (cropCells.length < 4) continue;
      const largestPlot = connectedCellGroups(island.cells, cropCells)
        .sort((a, b) => b.length - a.length)[0];
      const bounds = boundingBoxForCells(largestPlot);
      const minimumGroupedFood = archetype === 'harbor' ? 2 : 3;
      assert.ok(largestPlot.length >= Math.min(minimumGroupedFood, cropCells.length), archetype + ' should keep a clear grouped food plot');
      if (largestPlot.length >= 4) {
        assert.ok(Math.abs(bounds.width - bounds.height) <= 3, archetype + ' food plot should be square-ish');
        assert.ok(bounds.width * bounds.height <= largestPlot.length + 6, archetype + ' food plot should avoid scattered thin lines');
      }
    }
  }
});

test('economy viability pass gives every archetype a resource floor', () => {
  const minimumCells = {
    food: 2,
    materials: 1,
    commerce: 1,
    defense: 1,
    charm: 2,
  };

  for (const [archetype, config] of Object.entries(ARCHETYPE_MIXES)) {
    for (let i = 0; i < 4; i++) {
      const island = makeIsland({
        seed: 'economy-floor-' + archetype + '-' + i,
        archetype,
        biomes: config.biomes,
        elevation: config.elevation,
      });
      const profile = buildRandomIslandEconomyProfile(island, { seed: 'economy-floor-' + archetype + '-' + i, archetype });

      for (const [resourceId, min] of Object.entries(minimumCells)) {
        assert.ok(
          resourceCells(island, resourceId).length >= min,
          archetype + ' should have at least ' + min + ' ' + resourceId + ' cells'
        );
      }
    }
  }
});

test('low-food quarry islands still place capped food near habitation', () => {
  for (let i = 0; i < 12; i++) {
    const island = makeIsland({
      seed: 'low-food-quarry-' + i,
      archetype: 'quarry',
      biomes: ARCHETYPE_MIXES.quarry.biomes,
      elevation: ARCHETYPE_MIXES.quarry.elevation,
    });
    const foodCells = island.cells.filter(isFoodCell);
    const foodNearHomes = foodCells.filter(cell => nearCell(
      island.cells,
      cell,
      neighbor => neighbor.kind === 'house' && neighbor.buildingType !== 'tower',
      4
    ));

    assert.ok(foodCells.length >= 2, 'quarry should still have a food floor');
    assert.ok(foodCells.length <= 6, 'quarry should keep food inside its low-food cap');
    assert.ok(foodNearHomes.length >= 2, 'quarry food should sit near a cottage/house');
  }
});

test('generated resource fences live on enclosed cell edges', () => {
  let checked = 0;
  let fenced = 0;
  for (let i = 0; i < 12; i++) {
    const island = makeIsland({
      seed: 'resource-fence-side-pastoral-' + i,
      archetype: 'pastoral',
      biomes: ARCHETYPE_MIXES.pastoral.biomes,
      elevation: ARCHETYPE_MIXES.pastoral.elevation,
    });
    const resourceCells = island.cells.filter(cell => CROP_KINDS.has(cell.kind) || ANIMAL_KINDS.has(cell.kind));
    const stats = boundaryFenceStats(island, resourceCells, cell => CROP_KINDS.has(cell.kind) || ANIMAL_KINDS.has(cell.kind));
    assert.ok(
      !island.cells.some(cell => cell.kind === 'fence'),
      'generated islands should store fences as side extras rather than primary fence props'
    );
    checked += stats.boundary;
    fenced += stats.fenced;
    for (const cell of resourceCells) {
      assert.ok(
        cell.kind !== 'fence',
        'resource enclosures should fence resource cell edges instead of replacing resources with fence props'
      );
    }
  }

  assert.ok(checked >= 24, 'seed sweep should include resource boundary edges');
  assert.ok(fenced / checked >= 0.7, 'most resource boundary edges should have fence overlays');
});

test('generated islands do not leave fence-only cells in open fields', () => {
  for (const [archetype, config] of Object.entries(ARCHETYPE_MIXES)) {
    for (let i = 0; i < 8; i++) {
      const island = makeIsland({
        seed: 'no-stray-fence-' + archetype + '-' + i,
        archetype,
        biomes: config.biomes,
        elevation: config.elevation,
      });
      const stray = island.cells.filter(cell => !cell.kind && fenceEdgeEntries(cell).length > 0);
      assert.equal(stray.length, 0, archetype + ' should not emit fence-only empty cells');
    }
  }
});

test('farm enclosure infrastructure does not affect Raw Yield', () => {
  const cells = [];
  for (let x = 0; x < 6; x++) {
    for (let z = 0; z < 6; z++) {
      cells.push({ x, z, terrain: 'grass', kind: null, floors: 1, terrainFloors: 1, buildingType: null, fenceSide: null });
    }
  }
  const byCoord = new Map(cells.map(cell => [cell.x + ',' + cell.z, cell]));
  function setKind(x, z, kind, fenceSide = null) {
    const cell = byCoord.get(x + ',' + z);
    cell.kind = kind;
    cell.fenceSide = kind === 'fence' ? fenceSide : null;
  }
  [[2, 2], [2, 3], [3, 2], [3, 3]].forEach(([x, z], i) => setKind(x, z, i % 2 ? 'wheat' : 'crop'));
  [[1, 2, 'e'], [1, 3, 'e'], [4, 2, 'w'], [4, 3, 'w'], [2, 1, 's'], [3, 1, 's'], [2, 4, 'n'], [3, 4, 'n']]
    .forEach(([x, z, side]) => setKind(x, z, 'fence', side));

  const profile = buildRandomIslandEconomyProfile({ v: 4, gridSize: 6, cells }, { seed: 'farm-enclosure' });

  assert.equal(profile.rawYield.scores.buildings, 0);
  assert.equal(profile.rawYield.resources.buildings.towers, 0);
  assert.equal(profile.rawYield.resources.nature.water, 0);
  assert.equal(Object.prototype.hasOwnProperty.call(profile, 'traits'), false);
});

test('generated homes and estates are path-connected', () => {
  for (const [archetype, config] of Object.entries(ARCHETYPE_MIXES)) {
    const island = makeIsland({
      seed: 'path-connected-buildings-' + archetype,
      archetype,
      biomes: config.biomes,
      elevation: config.elevation,
    });
    const buildings = island.cells.filter(cell => cell.kind === 'house' && cell.buildingType !== 'tower');
    if (!buildings.length) continue;
    const connected = buildings.filter(cell => pathConnectedBuilding(island, cell));

    assert.ok(
      connected.length / buildings.length >= 0.8,
      archetype + ' houses/manors should have visible path access'
    );
  }
});

test('generated towers are corner landmarks with the requested count profile', () => {
  const buckets = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  const samples = 640;
  const archetypes = Object.keys(ARCHETYPE_MIXES);
  for (let i = 0; i < samples; i++) {
    const archetype = archetypes[i % archetypes.length];
    const config = ARCHETYPE_MIXES[archetype];
    const island = makeIsland({
      seed: 'corner-tower-profile-' + i,
      archetype,
      biomes: config.biomes,
      elevation: config.elevation,
    });
    const towers = island.cells.filter(isTowerCell);
    assert.ok(towers.length <= 4, archetype + ' should never emit more than four towers');
    for (const tower of towers) {
      assert.ok(tower.transform && typeof tower.transform === 'object', archetype + ' tower should track its door-facing transform');
      assert.ok(
        towerDoorDotToCenter(island, tower) > 0,
        archetype + ' tower at ' + tower.x + ',' + tower.z + ' should face inward'
      );
      assert.ok(
        cornerDistance(island, tower) <= 3,
        archetype + ' tower at ' + tower.x + ',' + tower.z + ' should be a corner landmark'
      );
    }
    buckets[towers.length] = (buckets[towers.length] || 0) + 1;
  }

  assert.ok(buckets[0] / samples >= 0.03 && buckets[0] / samples <= 0.1, 'zero tower bucket should stay near 6.25%');
  assert.ok(buckets[1] / samples >= 0.42 && buckets[1] / samples <= 0.58, 'one tower bucket should stay near 50%');
  assert.ok(buckets[2] / samples >= 0.18 && buckets[2] / samples <= 0.32, 'two tower bucket should stay near 25%');
  assert.ok(buckets[3] / samples >= 0.08 && buckets[3] / samples <= 0.18, 'three tower bucket should stay near 12.5%');
  assert.ok(buckets[4] / samples >= 0.03 && buckets[4] / samples <= 0.1, 'four tower bucket should stay near 6.25%');
});
