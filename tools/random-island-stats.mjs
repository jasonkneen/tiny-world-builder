#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildEngineFns } from '../tests/helpers/extract-fn.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT_DIR = 'stats-runs/random-island';
const DEFAULT_SAMPLES = 10000;
const DEFAULT_GRID_SIZE = 8;
const DEFAULT_SEED_PREFIX = 'random-island-stats';

const ARCHETYPES = ['pastoral', 'forest', 'quarry', 'river', 'village', 'fortress', 'ruins', 'harbor'];
const ARCHETYPE_MIXES = {
  pastoral: {
    biomes: { grass: 55, forest: 10, water: 8, dirt: 22, settlement: 5 },
    elevation: { plains: 70, hills: 24, mountains: 6 },
    signature: ['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower', 'cow', 'sheep', 'fence'],
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
    signature: ['house', 'fence', 'spotlight'],
  },
  ruins: {
    biomes: { grass: 26, forest: 20, water: 10, dirt: 24, settlement: 20 },
    elevation: { plains: 34, hills: 42, mountains: 24 },
    signature: ['ruins', 'totem', 'crystal', 'tree', 'bush'],
  },
  harbor: {
    biomes: { grass: 24, forest: 8, water: 38, dirt: 10, settlement: 20 },
    elevation: { plains: 62, hills: 28, mountains: 10 },
    signature: ['bridge', 'house', 'lamp-post', 'fence'],
  },
};
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
const CROP_KINDS = new Set(['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower']);
const ANIMAL_KINDS = new Set(['cow', 'sheep']);

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

function emptyRarityCounts() {
  return Object.fromEntries(RARITIES.map(rarity => [rarity, 0]));
}

function pct(value, total) {
  return total ? Number((value / total * 100).toFixed(2)) : 0;
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

function increment(map, key, amount = 1) {
  map[key] = (map[key] || 0) + amount;
}

function topEntries(map, total, limit = 10) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count, percent: pct(count, total) }));
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
    animalCells: animalCells.length,
    pennedAnimalCells: pennedAnimalCells.length,
    buildingCells: buildingCells.length,
    pathConnectedBuildings: pathConnectedBuildings.length,
    towerCells: towerCells.length,
    cornerTowerCells: cornerTowerCells.length,
  };
}

function makeBucket() {
  return {
    samples: 0,
    rawYield: [],
    rawYieldBuilding: [],
    rawYieldTotalRank: [],
    rarity: emptyRarityCounts(),
    rawYieldLeaders: {},
    rawYieldResources: {},
    terrain: {},
    kind: {},
    objectCells: 0,
    waterCells: 0,
    pathCells: 0,
    raisedCells: 0,
    houseCells: 0,
    bridgeCells: 0,
    signatureCells: 0,
    groupedSignatureCells: 0,
    cropCells: 0,
    fencedCropCells: 0,
    animalCells: 0,
    pennedAnimalCells: 0,
    buildingCells: 0,
    pathConnectedBuildings: 0,
    towerCells: 0,
    cornerTowerCells: 0,
    towerCounts: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
    motifSamples: {
      cropPlot: 0,
      animalPen: 0,
      pathBuildings: 0,
      cornerTowers: 0,
    },
    waterMotifs: {
      edge: 0,
      lake: 0,
      river: 0,
    },
  };
}

function finishBucket(bucket) {
  const samples = Math.max(1, bucket.samples);
  const cellSamples = Math.max(1, bucket.samples);
  return {
    samples: bucket.samples,
    rawYield: summary(bucket.rawYield),
    rawYieldBuilding: summary(bucket.rawYieldBuilding),
    rawYieldTotalRank: summary(bucket.rawYieldTotalRank),
    rarity: Object.fromEntries(RARITIES.map(rarity => [rarity, pct(bucket.rarity[rarity], samples)])),
    rawYieldLeaders: topEntries(bucket.rawYieldLeaders, samples),
    rawYieldResources: Object.fromEntries(Object.entries(bucket.rawYieldResources).map(([id, group]) => [id, {
      averageCount: Number((group.count / samples).toFixed(2)),
      averageScore: Number((group.score / samples).toFixed(2)),
      activeSamples: pct(group.active, samples),
    }])),
    averageCells: {
      object: Number((bucket.objectCells / cellSamples).toFixed(2)),
      water: Number((bucket.waterCells / cellSamples).toFixed(2)),
      path: Number((bucket.pathCells / cellSamples).toFixed(2)),
      raised: Number((bucket.raisedCells / cellSamples).toFixed(2)),
      house: Number((bucket.houseCells / cellSamples).toFixed(2)),
      bridge: Number((bucket.bridgeCells / cellSamples).toFixed(2)),
      signature: Number((bucket.signatureCells / cellSamples).toFixed(2)),
    },
    waterMotifs: Object.fromEntries(Object.entries(bucket.waterMotifs).map(([kind, count]) => [kind, pct(count, samples)])),
    resourceMotifs: {
      cropPlotSamples: pct(bucket.motifSamples.cropPlot, samples),
      animalPenSamples: pct(bucket.motifSamples.animalPen, samples),
      pathBuildingSamples: pct(bucket.motifSamples.pathBuildings, samples),
      cornerTowerSamples: pct(bucket.motifSamples.cornerTowers, samples),
      fencedCropCells: pct(bucket.fencedCropCells, bucket.cropCells),
      pennedAnimalCells: pct(bucket.pennedAnimalCells, bucket.animalCells),
      pathConnectedBuildings: pct(bucket.pathConnectedBuildings, bucket.buildingCells),
      cornerTowerCells: pct(bucket.cornerTowerCells, bucket.towerCells),
    },
    towerCountDistribution: Object.fromEntries(Object.entries(bucket.towerCounts).map(([count, value]) => [count, pct(value, samples)])),
    groupedSignaturePercent: pct(bucket.groupedSignatureCells, bucket.signatureCells),
    topTerrain: topEntries(bucket.terrain, bucket.samples),
    topKinds: topEntries(bucket.kind, bucket.samples),
  };
}

function waterComponents(world) {
  const water = new Set(world.cells.filter(cell => cell.terrain === 'water').map(cell => cell.x + ',' + cell.z));
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
    });
  }
  return components;
}

function addSample(bucket, world, profile, archetype) {
  bucket.samples++;
  const rawYield = profile.rawYield || {};
  const rawYieldScores = rawYield.scores || {};
  const rawYieldScore = Number(rawYieldScores.rawYield || profile.economy.rawYieldScore) || 0;
  bucket.rawYield.push(rawYieldScore);
  bucket.rawYieldBuilding.push(Number(rawYieldScores.buildings || profile.economy.buildingScore) || 0);
  bucket.rawYieldTotalRank.push(Number(rawYieldScores.totalRank || profile.economy.totalRankScore) || 0);
  bucket.rarity[profile.economy.rarity] = (bucket.rarity[profile.economy.rarity] || 0) + 1;
  if (rawYield.leader && rawYield.leader.label) increment(bucket.rawYieldLeaders, rawYield.leader.label);
  for (const [id, group] of Object.entries(rawYield.resources || {})) {
    if (!bucket.rawYieldResources[id]) bucket.rawYieldResources[id] = { count: 0, score: 0, active: 0 };
    const count = Object.values(group || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const score = Number(rawYieldScores[id]) || 0;
    bucket.rawYieldResources[id].count += count;
    bucket.rawYieldResources[id].score += score;
    if (count > 0 || score > 0) bucket.rawYieldResources[id].active++;
  }
  const waterMotifs = waterComponents(world);
  if (waterMotifs.some(component => component.edge)) bucket.waterMotifs.edge++;
  if (waterMotifs.some(component => !component.edge && component.size >= 3)) bucket.waterMotifs.lake++;
  if (waterMotifs.some(component => component.river)) bucket.waterMotifs.river++;
  const motifs = motifSummary(world);
  bucket.cropCells += motifs.cropCells;
  bucket.fencedCropCells += motifs.fencedCropCells;
  bucket.animalCells += motifs.animalCells;
  bucket.pennedAnimalCells += motifs.pennedAnimalCells;
  bucket.buildingCells += motifs.buildingCells;
  bucket.pathConnectedBuildings += motifs.pathConnectedBuildings;
  bucket.towerCells += motifs.towerCells;
  bucket.cornerTowerCells += motifs.cornerTowerCells;
  increment(bucket.towerCounts, String(Math.min(4, motifs.towerCells)));
  if (motifs.cropCells > 0 && motifs.fencedCropCells / motifs.cropCells >= 0.6) bucket.motifSamples.cropPlot++;
  if (motifs.animalCells > 0 && motifs.pennedAnimalCells / motifs.animalCells >= 0.6) bucket.motifSamples.animalPen++;
  if (motifs.buildingCells > 0 && motifs.pathConnectedBuildings / motifs.buildingCells >= 0.8) bucket.motifSamples.pathBuildings++;
  if (motifs.towerCells === 0 || motifs.cornerTowerCells === motifs.towerCells) bucket.motifSamples.cornerTowers++;

  const signature = new Set(ARCHETYPE_MIXES[archetype].signature);
  for (const cell of world.cells) {
    increment(bucket.terrain, cell.terrain || 'grass');
    if (cell.kind) {
      increment(bucket.kind, cell.kind);
      bucket.objectCells++;
    }
    if (cell.terrain === 'water') bucket.waterCells++;
    if (cell.terrain === 'path') bucket.pathCells++;
    if ((Number(cell.terrainFloors) || 1) > 1) bucket.raisedCells++;
    if (cell.kind === 'house') bucket.houseCells++;
    if (cell.kind === 'bridge') bucket.bridgeCells++;
    if (signature.has(cell.kind)) {
      bucket.signatureCells++;
      if (adjacentCells(world.cells, cell).some(neighbor => (
        signature.has(neighbor.kind)
        || ((archetype === 'river' || archetype === 'harbor') && neighbor.terrain === 'water')
      ))) {
        bucket.groupedSignatureCells++;
      }
    }
  }
}

const sampleCount = intArg('--samples', DEFAULT_SAMPLES, 1, 1000000);
const gridSize = intArg('--grid-size', DEFAULT_GRID_SIZE, 8, 20);
const seedPrefix = String(readArg('--seed-prefix', DEFAULT_SEED_PREFIX));
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

const overall = makeBucket();
const archetypeBuckets = Object.fromEntries(ARCHETYPES.map(archetype => [archetype, makeBucket()]));

for (let i = 0; i < sampleCount; i++) {
  const archetype = ARCHETYPES[i % ARCHETYPES.length];
  const mix = ARCHETYPE_MIXES[archetype];
  const seed = seedPrefix + ':' + sampleCount + ':' + gridSize + ':' + i + ':' + archetype;
  const world = generateRandomIslandWorld({
    seed,
    archetype,
    biomes: mix.biomes,
    elevation: mix.elevation,
    gridSize,
  });
  const profile = buildRandomIslandEconomyProfile(world, { seed, archetype });
  addSample(overall, world, profile, archetype);
  addSample(archetypeBuckets[archetype], world, profile, archetype);
}

const result = {
  generatedAt: generatedAt.toISOString(),
  generator: {
    file: path.relative(ROOT, generatorPath),
    functions: ['generateRandomIslandWorld', 'buildRandomIslandEconomyProfile'],
  },
  config: {
    samples: sampleCount,
    gridSize,
    seedPrefix,
    archetypes: ARCHETYPES,
    mixes: ARCHETYPE_MIXES,
  },
  overall: finishBucket(overall),
  byArchetype: Object.fromEntries(ARCHETYPES.map(archetype => [archetype, finishBucket(archetypeBuckets[archetype])])),
};

await mkdir(outDir, { recursive: true });
const filename = 'random-island-stats-' + safeTimestamp(generatedAt) + '.json';
const outputPath = path.join(outDir, filename);
const latestPath = path.join(outDir, 'latest.json');
const json = JSON.stringify(result, null, 2) + '\n';
await writeFile(outputPath, json, 'utf8');
await writeFile(latestPath, json, 'utf8');

console.log('wrote ' + path.relative(ROOT, outputPath));
console.log('updated ' + path.relative(ROOT, latestPath));
console.log('rarity ' + JSON.stringify(result.overall.rarity));
console.log('raw yield ' + JSON.stringify(result.overall.rawYield));
