import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { buildEngineFns } from './helpers/extract-fn.mjs';

const file = path.resolve('engine/world/16-drop-anim-adjacency.js');
const preamble = `
  const GRID = 8;
  const CASTLE_AUTO_PROMOTION = false;
  let world = [];
  function normalizeFenceSide(side) { return side || 'n'; }
  function getWorldCell(x, z) {
    return (world[x] && world[x][z]) || { terrain: 'grass', kind: null, buildingType: null };
  }
  function __setHouseClusterWorld(cells) {
    world = Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => ({
      terrain: 'grass',
      kind: null,
      buildingType: null,
    })));
    for (const cell of cells) {
      world[cell.x][cell.z] = Object.assign({
        terrain: 'grass',
        kind: null,
        buildingType: null,
      }, cell);
    }
  }
  globalThis.__setHouseClusterWorld = __setHouseClusterWorld;
`;

const {
  findHouseCluster,
} = buildEngineFns(file, [
  'isTurretHouse',
  'tryComposite',
  'trySquare',
  'isClusterableHouseCell',
  'isClusterableHouseAt',
  'bfsHouseCluster',
  'findHouseCluster',
], preamble);

test('plain houses still merge into linear clusters', () => {
  globalThis.__setHouseClusterWorld([
    { x: 1, z: 2, kind: 'house' },
    { x: 2, z: 2, kind: 'house' },
    { x: 3, z: 2, kind: 'house' },
  ]);

  assert.deepEqual(findHouseCluster(1, 2), {
    kind: 'linear',
    isAnchor: true,
    length: 3,
    orientation: 'x',
    anchorX: 1,
    anchorZ: 2,
  });
  assert.equal(findHouseCluster(2, 2).isAnchor, false);
});

test('forced building variants are house-cluster boundaries', () => {
  globalThis.__setHouseClusterWorld([
    { x: 1, z: 2, kind: 'house' },
    { x: 2, z: 2, kind: 'house', buildingType: 'tower' },
    { x: 3, z: 2, kind: 'house' },
  ]);

  assert.deepEqual(findHouseCluster(1, 2), { kind: 'solo', isAnchor: true, anchorX: 1, anchorZ: 2 });
  assert.deepEqual(findHouseCluster(2, 2), { kind: 'solo', isAnchor: true, anchorX: 2, anchorZ: 2 });
  assert.deepEqual(findHouseCluster(3, 2), { kind: 'solo', isAnchor: true, anchorX: 3, anchorZ: 2 });
});
