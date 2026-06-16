import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEngineFns } from './helpers/extract-fn.mjs';

const file = new URL('../engine/world/30-ui-boot-wiring.js', import.meta.url);
const fns = buildEngineFns(file, [
  'twWorldCatalogSlotId',
  'twWorldCatalogIdFromSlotId',
  'twWorldCatalogSlugFromSlotId',
  'twWorldCatalogKeyForWorld',
  'twWorldCatalogKeyForSlot',
  'twWorldCatalogTime',
  'twWorldCatalogDisplayName',
  'twWorldCatalogStateFromWorld',
  'twWorldCatalogMergedWorlds',
], `
const TW_WORLD_CATALOG_SLOT_PREFIX = 'world:';
const TW_WORLD_CATALOG_SLUG_PREFIX = 'world-slug:';
`);

test('public catalog worlds appear as My Worlds rows by name', () => {
  const rows = fns.twWorldCatalogMergedWorlds([], [{
    id: 5,
    slug: 'tidewater-bay',
    status: 'published',
    kind: 'starter',
    name: 'Tidewater Bay',
    publishedAt: '2026-06-01T00:00:00.000Z',
  }]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'world:5');
  assert.equal(rows[0].worldId, 5);
  assert.equal(rows[0].worldSlug, 'tidewater-bay');
  assert.equal(rows[0].name, 'Tidewater Bay');
  assert.equal(rows[0].catalog, true);
  assert.equal(rows[0].local, false);
});

test('local cached edits dedupe against the matching live catalog world', () => {
  const localState = { v: 4, gridSize: 8, cells: [[0, 0, 'water']] };
  const rows = fns.twWorldCatalogMergedWorlds([
    { id: 'world:5', worldId: 5, name: 'Tidewater Bay', ts: 1000, state: localState, local: true },
  ], [{
    id: 5,
    slug: 'tidewater-bay',
    status: 'published',
    kind: 'starter',
    name: 'Tidewater Bay live',
    publishedAt: '2026-06-01T00:00:00.000Z',
  }]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'world:5');
  assert.equal(rows[0].catalog, true);
  assert.equal(rows[0].local, true);
  assert.equal(rows[0].worldSlug, 'tidewater-bay');
  assert.deepEqual(rows[0].state, localState);
});

test('current/full catalog worlds carry state so they can be cached and edited offline', () => {
  const data = { v: 4, gridSize: 12, cells: [[2, 3, 'stone', 'rock']] };
  const rows = fns.twWorldCatalogMergedWorlds([], [{
    id: 9,
    slug: 'granite-test',
    status: 'published',
    kind: 'starter',
    name: 'Granite Test',
    gridSize: 12,
    data,
  }]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'world:9');
  assert.equal(rows[0].catalog, true);
  assert.deepEqual(rows[0].state, data);
});
