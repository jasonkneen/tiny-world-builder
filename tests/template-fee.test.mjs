// tests/template-fee.test.mjs
// T2: the treasury-fee split applied when a template is remixed. The atomic
// debit/credit/duplicate composition is integration-tested (it needs the full
// worlds+builds+coin schema); this pins the money math.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { templateFeeSplit } from '../netlify/functions/world-remix.mjs';

test('splits price into a 5% treasury fee and the author remainder', () => {
  assert.deepEqual(templateFeeSplit(1000), { fee: 50, authorAmount: 950 });
  assert.deepEqual(templateFeeSplit(100), { fee: 5, authorAmount: 95 });
});

test('fee floors (never over-charges the buyer or over-credits the treasury)', () => {
  // 199 * 5% = 9.95 -> floor 9; author gets 190; fee + author == price (no leakage)
  const { fee, authorAmount } = templateFeeSplit(199);
  assert.equal(fee, 9);
  assert.equal(authorAmount, 190);
  assert.equal(fee + authorAmount, 199);
});

test('free templates split to nothing', () => {
  assert.deepEqual(templateFeeSplit(0), { fee: 0, authorAmount: 0 });
});

test('garbage prices coerce to a zero split, never negative', () => {
  assert.deepEqual(templateFeeSplit(-100), { fee: 0, authorAmount: 0 });
  assert.deepEqual(templateFeeSplit('abc'), { fee: 0, authorAmount: 0 });
  assert.deepEqual(templateFeeSplit(null), { fee: 0, authorAmount: 0 });
});

test('fee + author always reconstructs the price exactly (conservation)', () => {
  for (const p of [1, 7, 33, 250, 999, 12345, 1000000]) {
    const { fee, authorAmount } = templateFeeSplit(p);
    assert.equal(fee + authorAmount, p, `price ${p} must be conserved`);
  }
});
