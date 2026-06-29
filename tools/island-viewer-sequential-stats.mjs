#!/usr/bin/env node
import fs from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT_DIR = 'stats-runs/island-viewer-sequential';
const DEFAULT_COUNT = 1000;
const DEFAULT_SEED_PREFIX = 'island-viewer-sequential';
const VIEWER_GRID_SIZE = 8;
const ARCHETYPES = ['pastoral', 'forest', 'quarry', 'river', 'village', 'fortress', 'ruins', 'harbor'];
const TERRAIN_IDS = ['grass', 'path', 'dirt', 'water', 'stone', 'lava', 'snow'];
const KIND_IDS = [null, 'house', 'tree', 'rock', 'bridge', 'wheat', 'corn', 'carrot', 'pumpkin', 'sunflower', 'cow', 'sheep', 'lamp-post', 'bush'];
const CROP_KINDS = ['wheat', 'corn', 'carrot', 'pumpkin', 'sunflower'];
const ANIMAL_KINDS = ['cow', 'sheep'];
const PROFILE_STATS = ['food', 'materials', 'commerce', 'defense', 'charm'];

function readArg(name, fallback) {
  const prefix = name + '=';
  const direct = process.argv.find(arg => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function intArg(name, fallback, min, max) {
  const n = Math.round(Number(readArg(name, fallback)));
  const value = Number.isFinite(n) ? n : fallback;
  return Math.min(max, Math.max(min, value));
}

function boolArg(name, fallback = false) {
  if (process.argv.includes(name)) return true;
  if (process.argv.includes('--no-' + name.replace(/^--/, ''))) return false;
  return fallback;
}

function safeTimestamp(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function pct(value, total) {
  return total ? Number((value / total * 100).toFixed(2)) : 0;
}

function increment(map, key, amount = 1) {
  map[String(key)] = (map[String(key)] || 0) + amount;
}

function sorted(values) {
  return values.slice().sort((a, b) => a - b);
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  return sortedValues[Math.min(sortedValues.length - 1, Math.floor(sortedValues.length * p))];
}

function summary(values) {
  const list = sorted(values);
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    min: Number((list[0] || 0).toFixed(2)),
    p05: Number(percentile(list, 0.05).toFixed(2)),
    p25: Number(percentile(list, 0.25).toFixed(2)),
    median: Number(percentile(list, 0.5).toFixed(2)),
    mean: Number((sum / Math.max(1, values.length)).toFixed(2)),
    p75: Number(percentile(list, 0.75).toFixed(2)),
    p90: Number(percentile(list, 0.9).toFixed(2)),
    p95: Number(percentile(list, 0.95).toFixed(2)),
    p99: Number(percentile(list, 0.99).toFixed(2)),
    max: Number((list[list.length - 1] || 0).toFixed(2)),
  };
}

function topEntries(map, total, limit = 12) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count, percent: pct(count, total) }));
}

function cellKey(cell) {
  return cell.x + ',' + cell.z;
}

function cellAt(world, x, z) {
  return world.cells.find(cell => cell.x === x && cell.z === z) || null;
}

function adjacentCells(world, cell) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .map(([dx, dz]) => cellAt(world, cell.x + dx, cell.z + dz))
    .filter(Boolean);
}

function isPath(cell) {
  return !!(cell && cell.terrain === 'path');
}

function isWater(cell) {
  return !!(cell && cell.terrain === 'water');
}

function isCrop(cell) {
  return !!(cell && CROP_KINDS.includes(cell.kind));
}

function isAnimal(cell) {
  return !!(cell && ANIMAL_KINDS.includes(cell.kind));
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
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
  const seen = new Set([cellKey(start)]);
  while (queue.length) {
    const current = queue.shift();
    for (const neighbor of adjacentCells(world, current)) {
      if (!isPath(neighbor)) continue;
      const key = cellKey(neighbor);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(neighbor);
    }
  }
  return seen.size;
}

function pathComponents(world) {
  const seen = new Set();
  const components = [];
  for (const cell of world.cells) {
    if (!isPath(cell) || seen.has(cellKey(cell))) continue;
    const queue = [cell];
    const keys = new Set([cellKey(cell)]);
    seen.add(cellKey(cell));
    while (queue.length) {
      const current = queue.shift();
      for (const neighbor of adjacentCells(world, current)) {
        const key = cellKey(neighbor);
        if (!isPath(neighbor) || seen.has(key)) continue;
        seen.add(key);
        keys.add(key);
        queue.push(neighbor);
      }
    }
    components.push(keys);
  }
  return components;
}

function waterCellsTouchingPathComponent(world, component) {
  const water = new Set();
  for (const key of component) {
    const [x, z] = key.split(',').map(Number);
    for (const neighbor of adjacentCells(world, { x, z })) {
      if (isWater(neighbor)) water.add(cellKey(neighbor));
    }
  }
  return water;
}

function bridgeCrossingValid(world, bridge) {
  const west = cellAt(world, bridge.x - 1, bridge.z);
  const east = cellAt(world, bridge.x + 1, bridge.z);
  const north = cellAt(world, bridge.x, bridge.z - 1);
  const south = cellAt(world, bridge.x, bridge.z + 1);
  const eastWest = isPath(west) && isPath(east) && isWater(north) && isWater(south);
  const northSouth = isPath(north) && isPath(south) && isWater(west) && isWater(east);
  return eastWest !== northSouth;
}

function lampCornerValid(world, lamp) {
  const sides = [
    ['n', cellAt(world, lamp.x, lamp.z - 1)],
    ['e', cellAt(world, lamp.x + 1, lamp.z)],
    ['s', cellAt(world, lamp.x, lamp.z + 1)],
    ['w', cellAt(world, lamp.x - 1, lamp.z)],
  ].filter(([, cell]) => isPath(cell)).map(([side]) => side);
  if (sides.length !== 2) return false;
  return !((sides.includes('n') && sides.includes('s')) || (sides.includes('e') && sides.includes('w')));
}

function fenceExtraCells(world) {
  return world.cells.filter(cell => Array.isArray(cell.extras) && cell.extras.some(extra => extra && extra.kind === 'fence'));
}

function cropPlotCells(world) {
  return fenceExtraCells(world).filter(cell => cell.terrain === 'dirt');
}

function animalPenCells(world) {
  return fenceExtraCells(world).filter(cell => cell.terrain === 'grass' && (cell.kind === null || isAnimal(cell)));
}

function countMap(items, getKey) {
  const out = {};
  for (const item of items) increment(out, getKey(item));
  return out;
}

function validateWorld(world, profile) {
  const errors = [];
  const allowedTerrain = new Set(TERRAIN_IDS);
  const allowedKinds = new Set(KIND_IDS);
  const keys = new Set();
  const serialized = JSON.stringify(world);
  if (!world || world.v !== 4) errors.push('world.v must be 4');
  if (!world || world.gridSize !== VIEWER_GRID_SIZE) errors.push('gridSize must be 8');
  if (!world || !Array.isArray(world.cells) || world.cells.length !== VIEWER_GRID_SIZE * VIEWER_GRID_SIZE) errors.push('world must contain 64 cells');
  if (/water-bridge|bridgeAxis/.test(serialized)) errors.push('world must not contain legacy bridge metadata');
  for (const cell of world.cells || []) {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.z)) errors.push('cell coordinates must be integers');
    if (cell.x < 0 || cell.x >= VIEWER_GRID_SIZE || cell.z < 0 || cell.z >= VIEWER_GRID_SIZE) errors.push('cell coordinate out of bounds: ' + cellKey(cell));
    if (keys.has(cellKey(cell))) errors.push('duplicate cell coordinate: ' + cellKey(cell));
    keys.add(cellKey(cell));
    if (!allowedTerrain.has(cell.terrain)) errors.push('unexpected terrain: ' + cell.terrain);
    if (cell.terrain === 'sand') errors.push('viewer output must not emit sand');
    if (!allowedKinds.has(cell.kind || null)) errors.push('unexpected kind: ' + cell.kind);
    if (Object.prototype.hasOwnProperty.call(cell, 'path')) errors.push('viewer output must use terrain:path, not path boolean');
    if (cell.kind === 'bridge' && cell.terrain !== 'water') errors.push('bridge must sit on water at ' + cellKey(cell));
    if (cell.kind === 'lamp-post' && cell.terrain !== 'grass') errors.push('lamp-post must sit on grass at ' + cellKey(cell));
    if ((cell.kind === 'tree' || cell.kind === 'bush') && cell.terrain !== 'grass') errors.push(cell.kind + ' must sit on grass at ' + cellKey(cell));
    if (isCrop(cell) && cell.terrain !== 'dirt') errors.push(cell.kind + ' must sit on dirt at ' + cellKey(cell));
  }
  for (const bridge of (world.cells || []).filter(cell => cell.kind === 'bridge')) {
    if (!bridgeCrossingValid(world, bridge)) errors.push('bridge crossing invalid at ' + cellKey(bridge));
  }
  const lamps = (world.cells || []).filter(cell => cell.kind === 'lamp-post');
  for (const lamp of lamps) {
    if (!lampCornerValid(world, lamp)) errors.push('lamp-post not at inside path corner: ' + cellKey(lamp));
  }
  for (let a = 0; a < lamps.length; a++) {
    for (let b = a + 1; b < lamps.length; b++) {
      if (manhattan(lamps[a], lamps[b]) <= 3) errors.push('lamp-post spacing <= 3 at ' + cellKey(lamps[a]) + ' and ' + cellKey(lamps[b]));
    }
  }
  for (const manor of (world.cells || []).filter(cell => cell.kind === 'house' && cell.buildingType === 'manor')) {
    const front = frontCell(world, manor);
    if (!isPath(front) || connectedPathSize(world, front) <= 1) errors.push('manor front path not connected at ' + cellKey(manor));
  }
  if (!profile || !profile.stats || !profile.economy || !profile.name) errors.push('profile missing required economy summary');
  return [...new Set(errors)];
}

function evaluateWorld(world, profile) {
  const terrain = countMap(world.cells, cell => cell.terrain);
  const kind = countMap(world.cells.filter(cell => cell.kind), cell => cell.kind);
  const crops = world.cells.filter(isCrop);
  const animals = world.cells.filter(isAnimal);
  const bridges = world.cells.filter(cell => cell.kind === 'bridge');
  const lamps = world.cells.filter(cell => cell.kind === 'lamp-post');
  const houses = world.cells.filter(cell => cell.kind === 'house' && !cell.buildingType);
  const towers = world.cells.filter(cell => cell.kind === 'house' && cell.buildingType === 'tower');
  const manors = world.cells.filter(cell => cell.kind === 'house' && cell.buildingType === 'manor');
  const cropPlot = cropPlotCells(world);
  const animalPen = animalPenCells(world);
  const pathCrossings = pathComponents(world).map(component => waterCellsTouchingPathComponent(world, component).size);
  return {
    terrain,
    kind,
    crops: crops.length,
    cropKinds: countMap(crops, cell => cell.kind),
    animals: animals.length,
    animalKinds: countMap(animals, cell => cell.kind),
    bridges: bridges.length,
    validBridges: bridges.filter(bridge => bridgeCrossingValid(world, bridge)).length,
    lamps: lamps.length,
    validLamps: lamps.filter(lamp => lampCornerValid(world, lamp)).length,
    houses: houses.length,
    towers: towers.length,
    manors: manors.length,
    trees: kind.tree || 0,
    bushes: kind.bush || 0,
    pathCells: terrain.path || 0,
    waterCells: terrain.water || 0,
    dirtCells: terrain.dirt || 0,
    stoneCells: terrain.stone || 0,
    emptyGrass: world.cells.filter(cell => cell.terrain === 'grass' && !cell.kind && (!cell.extras || !cell.extras.length)).length,
    cropPlotCells: cropPlot.length,
    cropPlotEmpty: cropPlot.filter(cell => cell.kind === null).length,
    cropPlotKinds: countMap(cropPlot, cell => cell.kind || 'empty'),
    animalPenCells: animalPen.length,
    animalPenAnimals: animalPen.filter(isAnimal).length,
    pathComponents: pathCrossings.length,
    maxWaterTouchesPerPathComponent: Math.max(0, ...pathCrossings),
    rarityScore: Number(profile && profile.economy && profile.economy.rarityScore) || 0,
    potential: Number(profile && profile.economy && profile.economy.potential) || 0,
    rarity: profile && profile.economy && profile.economy.rarity || 'Unknown',
    stats: Object.fromEntries(PROFILE_STATS.map(stat => [stat, Number(profile && profile.stats && profile.stats[stat]) || 0])),
    traits: Array.isArray(profile && profile.traits) ? profile.traits : [],
    synergies: Array.isArray(profile && profile.synergies) ? profile.synergies : [],
  };
}

function makeBucket() {
  return {
    samples: 0,
    schemaErrorSamples: 0,
    schemaErrors: {},
    terrain: {},
    kind: {},
    cropKinds: {},
    animalKinds: {},
    cropPlotKinds: {},
    rarity: {},
    traits: {},
    synergies: {},
    values: {
      crops: [], animals: [], bridges: [], lamps: [], houses: [], towers: [], manors: [],
      trees: [], bushes: [], pathCells: [], waterCells: [], dirtCells: [], stoneCells: [],
      emptyGrass: [], cropPlotCells: [], cropPlotEmpty: [], animalPenCells: [],
      animalPenAnimals: [], pathComponents: [], maxWaterTouchesPerPathComponent: [],
      rarityScore: [], potential: [],
      validBridgesPercent: [], validLampsPercent: [],
      food: [], materials: [], commerce: [], defense: [], charm: [],
    },
  };
}

function addToBucket(bucket, result, errors) {
  bucket.samples++;
  if (errors.length) {
    bucket.schemaErrorSamples++;
    for (const error of errors) increment(bucket.schemaErrors, error);
  }
  for (const [key, value] of Object.entries(result.terrain)) increment(bucket.terrain, key, value);
  for (const [key, value] of Object.entries(result.kind)) increment(bucket.kind, key, value);
  for (const [key, value] of Object.entries(result.cropKinds)) increment(bucket.cropKinds, key, value);
  for (const [key, value] of Object.entries(result.animalKinds)) increment(bucket.animalKinds, key, value);
  for (const [key, value] of Object.entries(result.cropPlotKinds)) increment(bucket.cropPlotKinds, key, value);
  increment(bucket.rarity, result.rarity);
  for (const trait of result.traits) increment(bucket.traits, trait);
  for (const synergy of result.synergies) increment(bucket.synergies, synergy);
  for (const [key, values] of Object.entries(bucket.values)) {
    if (key === 'validBridgesPercent') values.push(result.bridges ? result.validBridges / result.bridges * 100 : 100);
    else if (key === 'validLampsPercent') values.push(result.lamps ? result.validLamps / result.lamps * 100 : 100);
    else if (Object.prototype.hasOwnProperty.call(result.stats, key)) values.push(result.stats[key]);
    else values.push(Number(result[key]) || 0);
  }
}

function finishBucket(bucket) {
  const cellSamples = Math.max(1, bucket.samples * VIEWER_GRID_SIZE * VIEWER_GRID_SIZE);
  const out = {
    samples: bucket.samples,
    schemaErrorSamples: bucket.schemaErrorSamples,
    schemaErrorRate: pct(bucket.schemaErrorSamples, bucket.samples),
    topSchemaErrors: topEntries(bucket.schemaErrors, Math.max(1, bucket.schemaErrorSamples), 20),
    terrainPercent: Object.fromEntries(TERRAIN_IDS.map(id => [id, pct(bucket.terrain[id] || 0, cellSamples)])),
    topKinds: topEntries(bucket.kind, cellSamples),
    cropKindPercent: Object.fromEntries(CROP_KINDS.map(id => [id, pct(bucket.cropKinds[id] || 0, Math.max(1, Object.values(bucket.cropKinds).reduce((a, b) => a + b, 0)))])),
    cropPlotKindPercent: Object.fromEntries(['empty', ...CROP_KINDS].map(id => [id, pct(bucket.cropPlotKinds[id] || 0, Math.max(1, Object.values(bucket.cropPlotKinds).reduce((a, b) => a + b, 0)))])),
    animalKindPercent: Object.fromEntries(ANIMAL_KINDS.map(id => [id, pct(bucket.animalKinds[id] || 0, Math.max(1, Object.values(bucket.animalKinds).reduce((a, b) => a + b, 0)))])),
    rarityPercent: Object.fromEntries(Object.keys(bucket.rarity).sort().map(id => [id, pct(bucket.rarity[id], bucket.samples)])),
    topTraits: topEntries(bucket.traits, bucket.samples),
    topSynergies: topEntries(bucket.synergies, bucket.samples),
    summaries: Object.fromEntries(Object.entries(bucket.values).map(([key, values]) => [key, summary(values)])),
  };
  return out;
}

function loadGenerator() {
  const generatorPath = path.join(ROOT, 'scripts/island-viewer-sequential-generator.js');
  const source = fs.readFileSync(generatorPath, 'utf8');
  const sandboxWindow = {};
  new Function('window', source + '\nreturn window;')(sandboxWindow);
  if (!sandboxWindow.TinyWorldIslandGenerator) {
    throw new Error('TinyWorldIslandGenerator did not register from ' + generatorPath);
  }
  return sandboxWindow.TinyWorldIslandGenerator;
}

const count = intArg('--count', DEFAULT_COUNT, 1, 200000);
const seedPrefix = String(readArg('--seed-prefix', DEFAULT_SEED_PREFIX));
const archetypeInput = String(readArg('--archetype', 'all')).trim().toLowerCase();
const selectedArchetypes = archetypeInput === 'all'
  ? ARCHETYPES
  : ARCHETYPES.filter(archetype => archetype === archetypeInput);
if (!selectedArchetypes.length) throw new Error('unknown --archetype ' + archetypeInput);
const outDirInput = String(readArg('--out-dir', DEFAULT_OUT_DIR));
const outDir = path.isAbsolute(outDirInput) ? outDirInput : path.join(ROOT, outDirInput);
const strict = boolArg('--strict', false);
const generatedAt = new Date();
const api = loadGenerator();
const all = makeBucket();
const byArchetype = Object.fromEntries(selectedArchetypes.map(archetype => [archetype, makeBucket()]));
const examples = [];

for (let i = 0; i < count; i++) {
  const archetype = selectedArchetypes[i % selectedArchetypes.length];
  const seed = seedPrefix + ':' + count + ':' + i + ':' + archetype;
  let world;
  let profile;
  let errors = [];
  try {
    world = api.generate({ seed, archetype, gridSize: VIEWER_GRID_SIZE });
    profile = api.profile(world, { seed, archetype });
    errors = validateWorld(world, profile);
  } catch (err) {
    errors = ['exception: ' + (err && err.message || String(err))];
    world = { v: 4, gridSize: VIEWER_GRID_SIZE, cells: [] };
    profile = {};
  }
  const result = evaluateWorld(world, profile);
  addToBucket(all, result, errors);
  addToBucket(byArchetype[archetype], result, errors);
  if (errors.length && examples.length < 25) {
    examples.push({ seed, archetype, errors, world });
  }
}

const report = {
  generatedAt: generatedAt.toISOString(),
  generator: 'scripts/island-viewer-sequential-generator.js',
  samples: count,
  totalSamples: all.samples,
  archetypes: selectedArchetypes,
  seedPrefix,
  strict,
  all: finishBucket(all),
  byArchetype: Object.fromEntries(Object.entries(byArchetype).map(([key, bucket]) => [key, finishBucket(bucket)])),
  errorExamples: examples,
};

await mkdir(outDir, { recursive: true });
const reportPath = path.join(outDir, safeTimestamp(generatedAt) + '.json');
const latestPath = path.join(outDir, 'latest.json');
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
await writeFile(latestPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

console.log('Island Viewer sequential generator stats');
console.log('samples: ' + report.totalSamples + ' across ' + selectedArchetypes.length + ' archetype(s)');
console.log('schema error samples: ' + report.all.schemaErrorSamples + ' (' + report.all.schemaErrorRate + '%)');
console.log('terrain %:', JSON.stringify(report.all.terrainPercent));
console.log('top kinds:', report.all.topKinds.map(entry => entry.name + '=' + entry.percent + '%').join(', '));
console.log('crop plot %:', JSON.stringify(report.all.cropPlotKindPercent));
console.log('rarity %:', JSON.stringify(report.all.rarityPercent));
console.log('bridge count summary:', JSON.stringify(report.all.summaries.bridges));
console.log('lamp count summary:', JSON.stringify(report.all.summaries.lamps));
console.log('manor count summary:', JSON.stringify(report.all.summaries.manors));
console.log('wrote: ' + path.relative(ROOT, reportPath));
console.log('latest: ' + path.relative(ROOT, latestPath));

if (strict && report.all.schemaErrorSamples > 0) process.exit(1);
