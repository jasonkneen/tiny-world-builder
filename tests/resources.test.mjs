import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeResourceSale, RESOURCE_GOLD_RATES, isSellableResource } from '../netlify/functions/lib/resources.mjs';
import { goldForSale, TINYVERSE_GOLD_MULTIPLIER } from '../netlify/functions/resources-sell.mjs';

test('server-authoritative rates compute the right gold', () => {
  const r = computeResourceSale({ fish: 10, meat: 5, plants: 4, ore: 2 });
  // 10*1 + 5*2 + 4*1 + 2*3 = 10+10+4+6 = 30
  assert.equal(r.gold, 30);
  assert.equal(r.totalUnits, 21);
  assert.deepEqual(r.amounts, { fish: 10, meat: 5, plants: 4, ore: 2 });
});

test('unknown keys, negatives, fractions, and overflow are ignored/floored', () => {
  const r = computeResourceSale({ fish: -5, meat: 2.9, gold: 999, diamonds: 100, ore: 3 });
  assert.equal(r.amounts.fish, 0); // negative ignored
  assert.equal(r.amounts.meat, 2); // floored
  assert.equal(r.amounts.ore, 3);
  assert.equal(r.gold, 2 * RESOURCE_GOLD_RATES.meat + 3 * RESOURCE_GOLD_RATES.ore); // 4 + 9 = 13
});

test('empty / junk input yields nothing to sell', () => {
  for (const bad of [null, {}, { gold: 100 }, { fish: 0 }, 'x']) {
    const r = computeResourceSale(bad);
    assert.equal(r.totalUnits, 0);
    assert.equal(r.gold, 0);
  }
});

test('a single oversized amount is rejected (bounded)', () => {
  const r = computeResourceSale({ ore: 2_000_000_000 });
  assert.equal(r.amounts.ore, 0);
  assert.equal(r.gold, 0);
});

test('isSellableResource guards the type list', () => {
  assert.equal(isSellableResource('ore'), true);
  assert.equal(isSellableResource('gold'), false);
  assert.equal(isSellableResource('__proto__'), false);
});

// O multiplier — Tinyverse-access (lobby_access) accounts earn more GOLD per sale.
test('public (no lobby_access) earns base gold, multiplier 1', () => {
  const r = goldForSale(30, false);
  assert.equal(r.gold, 30);
  assert.equal(r.multiplier, 1);
});

test('Tinyverse-access earns the multiplier on the base gold', () => {
  const r = goldForSale(30, true);
  assert.equal(r.multiplier, TINYVERSE_GOLD_MULTIPLIER);
  assert.equal(r.gold, 30 * TINYVERSE_GOLD_MULTIPLIER);
});

test('multiplier math is integer-safe and never negative', () => {
  assert.deepEqual(goldForSale(0, true), { gold: 0, multiplier: TINYVERSE_GOLD_MULTIPLIER });
  assert.deepEqual(goldForSale(-50, true), { gold: 0, multiplier: TINYVERSE_GOLD_MULTIPLIER });
  assert.deepEqual(goldForSale(7.9, true), { gold: 7 * TINYVERSE_GOLD_MULTIPLIER, multiplier: TINYVERSE_GOLD_MULTIPLIER });
  assert.deepEqual(goldForSale('abc', false), { gold: 0, multiplier: 1 });
});
