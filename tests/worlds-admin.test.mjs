import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isWorldAdminEmail,
  worldAdminEmails,
  deriveTerrainCounts,
} from '../netlify/functions/lib/worlds.mjs';

test('isWorldAdminEmail allows the default world-admin accounts (case/space-insensitive)', () => {
  delete process.env.TINYWORLD_WORLD_ADMIN_EMAILS;
  assert.equal(isWorldAdminEmail('jason@bouncingfish.com'), true);
  assert.equal(isWorldAdminEmail('  JASON@BouncingFish.com  '), true);
  assert.equal(isWorldAdminEmail('jason.kneen@bouncingfish.com'), true);
});

test('isWorldAdminEmail rejects non-admin and empty emails', () => {
  delete process.env.TINYWORLD_WORLD_ADMIN_EMAILS;
  assert.equal(isWorldAdminEmail('someone@example.com'), false);
  assert.equal(isWorldAdminEmail(''), false);
  assert.equal(isWorldAdminEmail(null), false);
  assert.equal(isWorldAdminEmail(undefined), false);
});

test('worldAdminEmails merges extra emails from env', () => {
  process.env.TINYWORLD_WORLD_ADMIN_EMAILS = 'co-admin@example.com, Second@Example.com';
  const set = worldAdminEmails();
  assert.equal(set.has('jason@bouncingfish.com'), true);
  assert.equal(set.has('jason.kneen@bouncingfish.com'), true);
  assert.equal(set.has('co-admin@example.com'), true);
  assert.equal(set.has('second@example.com'), true);
  assert.equal(isWorldAdminEmail('co-admin@example.com'), true);
  delete process.env.TINYWORLD_WORLD_ADMIN_EMAILS;
});

test('deriveTerrainCounts stays consistent for a world payload', () => {
  // A tiny 4x4 board: a couple of water + stone cells, rest implied grass.
  const data = { v: 4, cells: [
    [0, 0, 'water'], [1, 0, 'water'], [2, 2, 'stone'], [3, 3, 'grass', 'tree'],
  ] };
  const counts = deriveTerrainCounts(data, 4);
  assert.equal(counts.tileCount, 16);
  assert.equal(counts.water, 2);
  assert.equal(counts.stone, 1);
  // grass = total - nonGrass(water+stone) ; the tree cell is grass terrain.
  assert.equal(counts.grass, 16 - 3);
});
