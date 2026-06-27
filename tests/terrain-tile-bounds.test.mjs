import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function sliceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, 'missing start marker: ' + start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, 'missing end marker: ' + end);
  return source.slice(startIndex, endIndex);
}

const tileFactoryPath = path.resolve('engine/world/05-tile-factory.js');
const historyFactoryPath = path.resolve('engine/world/06-history-object-factories.js');
const ghostPath = path.resolve('engine/world/15-ghost-generation-fade.js');

test('terrain tile geometry stays inside one logical cell in x/z', () => {
  const tileFactory = readFileSync(tileFactoryPath, 'utf8');
  const historyFactory = readFileSync(historyFactoryPath, 'utf8');
  const ghost = readFileSync(ghostPath, 'utf8');

  const voxelTop = sliceBetween(tileFactory, 'function addVoxelTerrainTop', 'function addVoxelTerrainSurfaceDetails');
  assert.match(voxelTop, /const panelSize = cellSize;/);
  assert.doesNotMatch(voxelTop, /panelOverlap|cellSize \+/);

  const voxelRiser = sliceBetween(tileFactory, 'function addVoxelTerrainRiser', 'function addVoxelTerrainRiserBacking');
  assert.match(voxelRiser, /const panelW = cellSize;/);
  assert.match(voxelRiser, /const panelH = riserHeight \/ verticalCells;/);
  assert.match(voxelRiser, /-half \+ sideDepth \* 0\.5/);
  assert.match(voxelRiser, /half - sideDepth \* 0\.5/);
  assert.doesNotMatch(voxelRiser, /panelW = cellSize \+|panelH = riserHeight \/ verticalCells \+/);

  const edgeWeeds = sliceBetween(tileFactory, 'function addSurfaceEdgeWeeds', 'function getWaterfallFoamGeometry');
  assert.match(edgeWeeds, /Math\.max\(w \* 0\.5,/);
  assert.doesNotMatch(edgeWeeds, /const inset = 0\.018 \+|const inset = 0\.035 \+/);

  const makeTile = sliceBetween(historyFactory, 'function makeTile', '// -------- tile surface height --------');
  assert.match(makeTile, /let riserSize = TILE;/);
  assert.match(makeTile, /let topSize\s+= TILE;/);
  assert.match(makeTile, /riserSize\s+= TILE;/);
  assert.match(makeTile, /topSize\s+= TILE;/);
  assert.match(makeTile, /const seamOverlap = 0;/);
  assert.doesNotMatch(makeTile, /TILE \* 1\.04|TILE \* 0\.98|seamOverlap = 0\.006/);

  const cheapGhost = sliceBetween(ghost, 'function ensureCheapGhostGeoms', 'function getCheapGhostTerrainBucket');
  assert.match(cheapGhost, /const size = TILE;/);
  assert.doesNotMatch(cheapGhost, /TILE \* 1\.04/);

  const ghostTile = sliceBetween(ghost, 'function makeGhostTile', 'function buildGhostBoard');
  assert.match(ghostTile, /getBoxGeometry\(TILE, height, TILE\)/);
  assert.doesNotMatch(ghostTile, /TILE \* 1\.04/);
});
