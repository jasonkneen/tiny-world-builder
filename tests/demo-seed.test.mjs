import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function loadSeeder() {
  const src = fs.readFileSync(path.resolve('engine/world/52-worlds-demo-seed.js'), 'utf8');
  const listeners = {};
  const window = { __tinyworldWorlds: { on: (ev, cb) => { (listeners[ev] = listeners[ev] || []).push(cb); } } };
  const document = {};
  const location = { hostname: 'localhost' };
  const runner = new Function('window', 'document', 'location', 'console', src);
  runner(window, document, location, { log: () => {} });
  return { WS: window.__tinyworldWorlds, listeners };
}

function has(cells, terrain, kind) {
  return cells.some(c => c[2] === terrain && (kind == null || c[3] === kind));
}

test('demo resource seeder creates visible test resources before room render/join', () => {
  const { WS } = loadSeeder();
  assert.equal(typeof WS.seedDemoResources, 'function');
  const world = { slug: 'empty-local-lobby', gridSize: 8, data: { v: 4, gridSize: 8, cells: [] } };
  const added = WS.seedDemoResources(world);
  assert.ok(Array.isArray(added) && added.length > 0, 'resources were added');
  assert.ok(has(world.data.cells, 'water'), 'fishable water is present');
  assert.ok(has(world.data.cells, 'stone'), 'mineable stone is present');
  assert.ok(has(world.data.cells, 'grass', 'crop') || has(world.data.cells, 'grass', 'wheat'), 'gatherable plants are present');
  assert.ok(has(world.data.cells, 'grass', 'cow') || has(world.data.cells, 'grass', 'sheep'), 'huntable animals are present');
});

test('demo resource seeder creates missing world.data and is idempotent', () => {
  const { WS } = loadSeeder();
  const world = { slug: 'missing-data', gridSize: 8 };
  const first = WS.seedDemoResources(world);
  const count = world.data.cells.length;
  const second = WS.seedDemoResources(world);
  assert.ok(first.length > 0, 'initial seed added resources');
  assert.equal(second, null, 'second seed no-ops once resources exist');
  assert.equal(world.data.cells.length, count, 'no duplicate resources added');
});
