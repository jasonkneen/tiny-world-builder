import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ECONOMY_POLICY,
  applyIslandTax,
  buildInterestSnapshot,
  calculateGoldAllowance,
  createGoldLedgerEvent,
  createMovementIntent,
  createResourceLedgerEvents,
  getTierAllowance,
  normalizeWorldResourceSpec,
  reduceGoldLedger,
  spendGold,
} from '../packages/tinyworld-mmo-core/src/index.js';

test('GOLD allowance uses guide tiers and subtracts spent amount', () => {
  const allowance = calculateGoldAllowance({
    tinyworldHeld: '10000',
    islandCount: 1,
    spentThisCycle: 125,
    now: new Date('2026-06-20T00:00:00Z'),
  });
  assert.equal(allowance.tier, 'silver');
  assert.equal(allowance.baseAllowance, 500);
  assert.equal(allowance.totalAllowance, 550);
  assert.equal(allowance.available, 425);
  assert.deepEqual(getTierAllowance(50_000n), { tier: 'gold', allowance: 1500 });
});

test('GOLD ledger is append-only and spend checks available balance', () => {
  const cycleId = 'weekly:test';
  const wallet = 'wallet-a';
  const grant = createGoldLedgerEvent('ALLOWANCE_RECALCULATED', {
    wallet,
    cycleId,
    amount: 500,
    reason: 'tiered allowance',
  }, new Date('2026-06-20T00:00:00Z'));
  const spend = createGoldLedgerEvent('GOLD_SPENT', {
    wallet,
    cycleId,
    amount: 120,
    action: 'craft',
    referenceId: 'recipe-ore-crate',
  }, new Date('2026-06-20T00:01:00Z'));
  const summary = reduceGoldLedger([grant, spend], { wallet, cycleId });
  assert.equal(summary.available, 380);
  assert.equal(spendGold(summary, 400, { wallet, action: 'upgrade' }).ok, false);
  const ok = spendGold(summary, 80, { wallet, action: 'upgrade', now: new Date('2026-06-20T00:02:00Z') });
  assert.equal(ok.ok, true);
  assert.equal(ok.available, 300);
  assert.equal(ok.event.type, 'GOLD_SPENT');
});

test('island tax follows guide cap and creates resource ledger credits', () => {
  const split = applyIslandTax(
    { minerWallet: 'miner-wallet', islandId: 'island-7', resource: 'ore', grossAmount: 100 },
    { id: 'island-7', ownerWallet: 'owner-wallet', taxRate: 0.75 },
  );
  assert.equal(split.taxRate, DEFAULT_ECONOMY_POLICY.maxTaxRate);
  assert.equal(split.miner.amount, 80);
  assert.equal(split.islandOwner.amount, 20);
  const events = createResourceLedgerEvents(split, { referenceId: 'harvest-1', now: new Date('2026-06-20T00:00:00Z') });
  assert.equal(events.length, 2);
  assert.equal(events[0].reason, 'harvest');
  assert.equal(events[1].reason, 'island_tax');

  const ownerHarvest = applyIslandTax(
    { minerWallet: 'owner-wallet', islandId: 'island-7', resource: 'ore', grossAmount: 100 },
    { id: 'island-7', ownerWallet: 'owner-wallet', taxRate: 0.2 },
  );
  assert.equal(ownerHarvest.islandOwner.amount, 0);
  assert.equal(ownerHarvest.miner.amount, 100);
});

test('explicit world resource specs normalize to current authoritative resources', () => {
  assert.deepEqual(normalizeWorldResourceSpec({ resource: 'ORE', charges: 150, label: 'Ancient drill node' }), {
    resource: 'ore',
    action: 'mine',
    charges: 99,
    label: 'Ancient drill node',
  });
  assert.deepEqual(normalizeWorldResourceSpec({ type: 'plants', charges: 2.6 }), {
    resource: 'plants',
    action: 'gather',
    charges: 3,
  });
  assert.equal(normalizeWorldResourceSpec({ resource: 'wood' }), null, 'future spec resources are not live bank resources yet');
  assert.equal(normalizeWorldResourceSpec(null), null);
});

test('interest snapshots send full, lite, keep, and remove records', () => {
  const viewer = { id: 'self', x: 0, z: 0 };
  const first = buildInterestSnapshot({
    viewer,
    tick: 1,
    entities: [
      { id: 'a', kind: 'player', x: 2, z: 0, dynamic: { x: 2, z: 0 }, identity: { kind: 'player', name: 'Alice' } },
      { id: 'b', kind: 'node', x: 50, z: 0, dynamic: { x: 50, z: 0 }, identity: { kind: 'node' } },
    ],
  });
  assert.equal(first.entities.length, 1);
  assert.equal(first.entities[0].full, true);
  assert.deepEqual(first.keep, []);
  assert.deepEqual(first.remove, []);

  const second = buildInterestSnapshot({
    viewer,
    tick: 2,
    previousVisibleIds: first.nextVisibleIds,
    previousHashes: first.nextHashes,
    entities: [
      { id: 'a', kind: 'player', x: 3, z: 0, dynamic: { x: 3, z: 0 }, identity: { kind: 'player', name: 'Alice' } },
    ],
  });
  assert.deepEqual(second.entities, [{ id: 'a', x: 3, z: 0 }]);

  const third = buildInterestSnapshot({
    viewer,
    tick: 3,
    previousVisibleIds: second.nextVisibleIds,
    previousHashes: second.nextHashes,
    entities: [
      { id: 'a', kind: 'player', x: 3, z: 0, dynamic: { x: 3, z: 0 }, identity: { kind: 'player', name: 'Alice' } },
    ],
  });
  assert.deepEqual(third.entities, []);
  assert.deepEqual(third.keep, ['a']);

  const fourth = buildInterestSnapshot({
    viewer,
    tick: 4,
    previousVisibleIds: third.nextVisibleIds,
    previousHashes: third.nextHashes,
    entities: [
      { id: 'a', kind: 'player', x: 80, z: 0, dynamic: { x: 80, z: 0 }, identity: { kind: 'player', name: 'Alice' } },
    ],
  });
  assert.deepEqual(fourth.remove, ['a']);
});

test('movement intent rounds cells and preserves sequencing', () => {
  assert.deepEqual(createMovementIntent({ x: 3.4, z: 5.6, seq: 9 }), {
    type: 'move',
    seq: 9,
    x: 3,
    z: 6,
  });
});
