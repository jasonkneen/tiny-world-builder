import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isWorldAdminEmail,
  worldAdminEmails,
  deriveTerrainCounts,
  deriveResourceStats,
  worldDto,
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
  // An 8x8 board (smallest legal size): a couple of water + stone cells, rest implied grass.
  const data = { v: 4, cells: [
    [0, 0, 'water'], [1, 0, 'water'], [2, 2, 'stone'], [3, 3, 'grass', 'tree'],
  ] };
  const counts = deriveTerrainCounts(data, 8);
  assert.equal(counts.tileCount, 64);
  assert.equal(counts.water, 2);
  assert.equal(counts.stone, 1);
  // grass = total - nonGrass(water+stone) ; the tree cell is grass terrain.
  assert.equal(counts.grass, 64 - 3);
});

test('deriveResourceStats mirrors world room resource node seeding', () => {
  const data = { v: 4, gridSize: 4, cells: [
    [0, 0, 'water'], [1, 0, 'water'], [3, 3, 'water'],
    [2, 2, 'stone'], [2, 3, 'stone', 'relic'],
    [0, 2, 'grass', 'corn'],
  ] };
  const stats = deriveResourceStats(data, 4);
  assert.equal(stats.fish, 2);
  assert.equal(stats.ore, 2);
  assert.equal(stats.plants, 1);
  assert.equal(stats.meat, 2);
  assert.equal(stats.mineable, 2);
  assert.equal(stats.ready, 7);
  assert.ok(stats.spawnable > 0);
});

test('worldDto includes owner email and resource stats for cards', () => {
  const dto = worldDto({
    id: 42,
    slug: 'iron-ridge',
    kind: 'starter',
    status: 'published',
    name: 'Iron Ridge',
    tax_percent: 10,
    price_usdc: '0',
    grid_size: 4,
    tile_count: 16,
    active_players: 0,
    owner_profile_id: 7,
    owner_name: 'Jason Kneen',
    owner_email: 'jason@bouncingfish.com',
    data: { v: 4, gridSize: 4, cells: [[1, 1, 'stone']] },
    published_at: '2026-06-21T09:00:00.000Z',
  }, { includeOwnerEmail: true });
  assert.equal(dto.ownerEmail, 'jason@bouncingfish.com');
  assert.equal(dto.resourceStats.ore, 1);
  assert.equal(dto.resourceStats.mineable, 1);
});
