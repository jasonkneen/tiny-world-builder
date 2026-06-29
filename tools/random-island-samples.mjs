#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildEngineFns } from '../tests/helpers/extract-fn.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT_DIR = 'random-island-runs';
const DEFAULT_COUNT = 16;
const DEFAULT_GRID_SIZE = 8;
const DEFAULT_SEED_PREFIX = 'random-island-sample';

const ARCHETYPES = ['pastoral', 'forest', 'quarry', 'river', 'village', 'fortress', 'ruins', 'harbor'];
const CROP_KINDS = new Set(['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower']);
const ANIMAL_KINDS = new Set(['cow', 'sheep']);
const ARCHETYPE_MIXES = {
  pastoral: {
    biomes: { grass: 55, forest: 10, water: 8, dirt: 22, settlement: 5 },
    elevation: { plains: 70, hills: 24, mountains: 6 },
  },
  forest: {
    biomes: { grass: 35, forest: 44, water: 8, dirt: 10, settlement: 3 },
    elevation: { plains: 48, hills: 40, mountains: 12 },
  },
  quarry: {
    biomes: { grass: 18, forest: 10, water: 6, dirt: 26, settlement: 8 },
    elevation: { plains: 20, hills: 42, mountains: 38 },
  },
  river: {
    biomes: { grass: 35, forest: 14, water: 32, dirt: 14, settlement: 5 },
    elevation: { plains: 64, hills: 28, mountains: 8 },
  },
  village: {
    biomes: { grass: 30, forest: 12, water: 10, dirt: 16, settlement: 32 },
    elevation: { plains: 60, hills: 30, mountains: 10 },
  },
  fortress: {
    biomes: { grass: 20, forest: 8, water: 8, dirt: 20, settlement: 44 },
    elevation: { plains: 22, hills: 38, mountains: 40 },
  },
  ruins: {
    biomes: { grass: 26, forest: 20, water: 10, dirt: 24, settlement: 20 },
    elevation: { plains: 34, hills: 42, mountains: 24 },
  },
  harbor: {
    biomes: { grass: 24, forest: 8, water: 38, dirt: 10, settlement: 20 },
    elevation: { plains: 62, hills: 28, mountains: 10 },
  },
};

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

function safeTimestamp(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function cellKey(cell) {
  return cell.x + ',' + cell.z;
}

function adjacentCells(cells, cell) {
  const byCoord = new Map(cells.map(entry => [cellKey(entry), entry]));
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

function isTowerCell(cell) {
  return cell && cell.kind === 'house' && cell.buildingType === 'tower';
}

function cornerDistance(world, cell) {
  const max = world.gridSize - 1;
  return Math.min(
    Math.abs(cell.x - 0) + Math.abs(cell.z - 0),
    Math.abs(cell.x - max) + Math.abs(cell.z - 0),
    Math.abs(cell.x - max) + Math.abs(cell.z - max),
    Math.abs(cell.x - 0) + Math.abs(cell.z - max)
  );
}

function pathConnectedBuilding(world, cell) {
  return cell.terrain === 'path' || adjacentCells(world.cells, cell).some(neighbor => neighbor.terrain === 'path');
}

function pct(part, whole) {
  return whole ? Number((part / whole * 100).toFixed(2)) : 0;
}

function motifSummary(world) {
  const cropCells = world.cells.filter(cell => CROP_KINDS.has(cell.kind));
  const animalCells = world.cells.filter(cell => ANIMAL_KINDS.has(cell.kind));
  const buildingCells = world.cells.filter(cell => cell.kind === 'house' && cell.buildingType !== 'tower');
  const towerCells = world.cells.filter(isTowerCell);
  const fencedCropCells = cropCells.filter(cell => nearCell(world.cells, cell, neighbor => neighbor.kind === 'fence', 2));
  const pennedAnimalCells = animalCells.filter(cell => nearCell(world.cells, cell, neighbor => neighbor.kind === 'fence', 2));
  const pathConnectedBuildings = buildingCells.filter(cell => pathConnectedBuilding(world, cell));
  const cornerTowerCells = towerCells.filter(cell => cornerDistance(world, cell) <= 3);
  return {
    cropCells: cropCells.length,
    fencedCropCells: fencedCropCells.length,
    fencedCropPercent: pct(fencedCropCells.length, cropCells.length),
    animalCells: animalCells.length,
    pennedAnimalCells: pennedAnimalCells.length,
    pennedAnimalPercent: pct(pennedAnimalCells.length, animalCells.length),
    buildingCells: buildingCells.length,
    pathConnectedBuildings: pathConnectedBuildings.length,
    pathConnectedBuildingPercent: pct(pathConnectedBuildings.length, buildingCells.length),
    towerCells: towerCells.length,
    cornerTowerCells: cornerTowerCells.length,
    cornerTowerPercent: pct(cornerTowerCells.length, towerCells.length),
  };
}

function waterComponents(world) {
  const water = new Set(world.cells.filter(cell => cell.terrain === 'water').map(cellKey));
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
      touchesBottom = touchesBottom || z === world.gridSize - 1;
      touchesLeft = touchesLeft || x === 0;
      touchesRight = touchesRight || x === world.gridSize - 1;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        stack.push((x + dx) + ',' + (z + dz));
      }
    }
    components.push({
      size: cells.length,
      edge: touchesTop || touchesBottom || touchesLeft || touchesRight,
      river: (touchesTop && touchesBottom) || (touchesLeft && touchesRight),
      cells,
    });
  }
  return components.sort((a, b) => b.size - a.size);
}

function terrainMap(world) {
  const terrainGlyph = {
    grass: 'g',
    path: 'p',
    dirt: 'd',
    water: 'w',
    stone: 's',
    sand: 'a',
    snow: 'n',
    lava: 'l',
  };
  const byCoord = new Map(world.cells.map(cell => [cellKey(cell), cell]));
  const rows = [];
  for (let z = 0; z < world.gridSize; z++) {
    let row = '';
    for (let x = 0; x < world.gridSize; x++) {
      const cell = byCoord.get(x + ',' + z);
      row += terrainGlyph[cell && cell.terrain] || '?';
    }
    rows.push(row);
  }
  return rows;
}

function terrainCounts(world) {
  const counts = {};
  for (const cell of world.cells) counts[cell.terrain] = (counts[cell.terrain] || 0) + 1;
  return counts;
}

const count = intArg('--count', DEFAULT_COUNT, 1, 1000);
const gridSize = intArg('--grid-size', DEFAULT_GRID_SIZE, 8, 20);
const seedPrefix = String(readArg('--seed-prefix', DEFAULT_SEED_PREFIX));
const archetypeInput = String(readArg('--archetype', 'all')).trim().toLowerCase();
const selectedArchetypes = archetypeInput === 'all'
  ? ARCHETYPES
  : ARCHETYPES.filter(archetype => archetype === archetypeInput);
if (!selectedArchetypes.length) throw new Error('unknown --archetype ' + archetypeInput);

const outDirInput = String(readArg('--out-dir', DEFAULT_OUT_DIR));
const outDir = path.isAbsolute(outDirInput) ? outDirInput : path.join(ROOT, outDirInput);
const generatedAt = new Date();
const generatorPath = path.join(ROOT, 'engine/world/26-ai-generation.js');
const economyProfilePath = path.join(ROOT, 'engine/world/26b-random-island-economy-profile.js');
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

const samples = [];
for (let i = 0; i < count; i++) {
  const archetype = selectedArchetypes[i % selectedArchetypes.length];
  const mix = ARCHETYPE_MIXES[archetype];
  const seed = seedPrefix + ':' + count + ':' + gridSize + ':' + i + ':' + archetype;
  const world = generateRandomIslandWorld({
    seed,
    archetype,
    biomes: mix.biomes,
    elevation: mix.elevation,
    gridSize,
  });
  const profile = buildRandomIslandEconomyProfile(world, { seed, archetype });
  const components = waterComponents(world);
  samples.push({
    seed,
    archetype,
    profile,
    terrainMap: terrainMap(world),
    terrainCounts: terrainCounts(world),
    motifs: motifSummary(world),
    water: {
      cells: world.cells.filter(cell => cell.terrain === 'water').length,
      percent: Number((world.cells.filter(cell => cell.terrain === 'water').length / world.cells.length * 100).toFixed(2)),
      components: components.map(component => ({
        size: component.size,
        edge: component.edge,
        river: component.river,
        cells: component.cells,
      })),
    },
    world,
  });
}

const result = {
  generatedAt: generatedAt.toISOString(),
  generator: {
    file: path.relative(ROOT, generatorPath),
    functions: ['generateRandomIslandWorld', 'buildRandomIslandEconomyProfile'],
  },
  config: {
    count,
    gridSize,
    seedPrefix,
    archetypes: selectedArchetypes,
  },
  legend: {
    terrainMap: 'g grass, p path, d dirt, w water, s stone, a sand, n snow, l lava',
  },
  samples,
};

await mkdir(outDir, { recursive: true });
const filename = 'random-island-samples-' + safeTimestamp(generatedAt) + '.json';
const outputPath = path.join(outDir, filename);
const latestPath = path.join(outDir, 'latest.json');
const json = JSON.stringify(result, null, 2) + '\n';
await writeFile(outputPath, json, 'utf8');
await writeFile(latestPath, json, 'utf8');

console.log('wrote ' + path.relative(ROOT, outputPath));
console.log('updated ' + path.relative(ROOT, latestPath));
for (const sample of samples.slice(0, Math.min(samples.length, 4))) {
  console.log(sample.archetype + ' ' + sample.seed + ' water=' + sample.water.percent + '%');
  console.log(sample.terrainMap.join('/'));
}
