// tests/economy-weekly-payout.test.mjs
// E2: the pure weekly-payout planner that turns wallet holdings into authoritative
// ALLOWANCE_RECALCULATED ledger events. The DB write/idempotency is tested separately;
// this proves the holdings -> allowance -> event mapping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWeeklyPayoutPlan,
  currentCycleId,
  DEFAULT_ECONOMY_POLICY,
} from '../packages/tinyworld-mmo-core/src/index.js';

const NOW = new Date('2026-06-24T00:00:00Z');
const CYCLE = currentCycleId(NOW, DEFAULT_ECONOMY_POLICY.cycleCadence);

test('maps holders to one allowance event each, at the right tier', () => {
  const plan = computeWeeklyPayoutPlan([
    { wallet: 'profile:1', tinyworldHeld: '1000', islandCount: 0 },   // bronze -> 100
    { wallet: 'profile:2', tinyworldHeld: '10000', islandCount: 0 },  // silver -> 500
    { wallet: 'profile:3', tinyworldHeld: '100000', islandCount: 0 }, // mythic -> 2500
  ], { now: NOW });

  assert.equal(plan.cycleId, CYCLE);
  assert.equal(plan.events.length, 3);
  assert.equal(plan.skippedZero, 0);
  const byWallet = Object.fromEntries(plan.events.map(e => [e.wallet, e]));
  assert.equal(byWallet['profile:1'].amount, 100);
  assert.equal(byWallet['profile:2'].amount, 500);
  assert.equal(byWallet['profile:3'].amount, 2500);
  for (const e of plan.events) {
    assert.equal(e.type, 'ALLOWANCE_RECALCULATED');
    assert.equal(e.cycleId, CYCLE);
    assert.equal(e.reason, 'weekly-allowance');
  }
});

test('holders below the first tier get NO event (amount must be > 0)', () => {
  const plan = computeWeeklyPayoutPlan([
    { wallet: 'profile:1', tinyworldHeld: '0', islandCount: 0 },
    { wallet: 'profile:2', tinyworldHeld: '999', islandCount: 0 }, // below bronze (1000)
  ], { now: NOW });
  assert.equal(plan.events.length, 0);
  assert.equal(plan.skippedZero, 2);
});

test('island ownership adds the island bonus on top of the tier', () => {
  const base = computeWeeklyPayoutPlan([{ wallet: 'profile:1', tinyworldHeld: '10000', islandCount: 0 }], { now: NOW });
  const withIsland = computeWeeklyPayoutPlan([{ wallet: 'profile:1', tinyworldHeld: '10000', islandCount: 2 }], { now: NOW });
  assert.equal(base.events[0].amount, 500);
  // island bonus is positive and capped — strictly greater than the base allowance
  assert.ok(withIsland.events[0].amount > 500, `expected island bonus, got ${withIsland.events[0].amount}`);
});

test('ignores malformed holders without crashing', () => {
  const plan = computeWeeklyPayoutPlan([
    null,
    { islandCount: 1 },                 // no wallet -> skipped entirely
    { wallet: '', tinyworldHeld: '50000' }, // empty wallet -> skipped
    { wallet: 'profile:9', tinyworldHeld: '50000', islandCount: 0 }, // gold -> 1500
  ], { now: NOW });
  assert.equal(plan.events.length, 1);
  assert.equal(plan.events[0].wallet, 'profile:9');
  assert.equal(plan.events[0].amount, 1500);
});

test('empty / non-array input yields an empty plan for the current cycle', () => {
  assert.deepEqual(computeWeeklyPayoutPlan([], { now: NOW }).events, []);
  assert.deepEqual(computeWeeklyPayoutPlan(undefined, { now: NOW }).events, []);
  assert.equal(computeWeeklyPayoutPlan([], { now: NOW }).cycleId, CYCLE);
});

test('the same holders + same cycle produce identical events (idempotent input)', () => {
  const holders = [{ wallet: 'profile:1', tinyworldHeld: '10000', islandCount: 0 }];
  const a = computeWeeklyPayoutPlan(holders, { now: NOW });
  const b = computeWeeklyPayoutPlan(holders, { now: new Date('2026-06-24T23:59:00Z') }); // same week
  assert.equal(a.cycleId, b.cycleId);
  assert.equal(a.events[0].amount, b.events[0].amount);
  assert.equal(a.events[0].wallet, b.events[0].wallet);
});
