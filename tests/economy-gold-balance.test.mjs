// tests/economy-gold-balance.test.mjs
// E1: converting on-chain atomic $TINYWORLD balances into whole-token holdings that
// feed the GOLD allowance. The precision risk is real — a 100M-token balance at 9
// decimals is 1e17 atomic units, well past Number.MAX_SAFE_INTEGER (~9e15).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  wholeTokensHeld,
  calculateGoldAllowance,
  DEFAULT_ECONOMY_POLICY,
} from '../packages/tinyworld-mmo-core/src/index.js';

test('floors atomic to whole tokens at the given decimals', () => {
  // 10,000.999999999 TINYWORLD at 9 decimals -> 10000 whole
  assert.equal(wholeTokensHeld('10000999999999', 9), '10000');
  // exact 1,000 at 9 decimals
  assert.equal(wholeTokensHeld('1000000000000', 9), '1000');
});

test('zero decimals returns the atomic value verbatim', () => {
  assert.equal(wholeTokensHeld('50000', 0), '50000');
  assert.equal(wholeTokensHeld('50000'), '50000');
});

test('no precision loss on whale balances beyond Number.MAX_SAFE_INTEGER', () => {
  // 100,000,000 tokens at 9 decimals = 1e17 atomic (Number would lose digits)
  const atomic = '100000000000000000';
  assert.equal(wholeTokensHeld(atomic, 9), '100000000');
  // a value Number cannot represent exactly still floors correctly
  assert.equal(wholeTokensHeld('9007199254740993000000000', 9), '9007199254740993');
});

test('garbage / negative / null inputs degrade to "0"', () => {
  assert.equal(wholeTokensHeld('', 9), '0');
  assert.equal(wholeTokensHeld(null, 9), '0');
  assert.equal(wholeTokensHeld('-5000000000', 9), '0');
  assert.equal(wholeTokensHeld('not-a-number', 9), '0');
});

test('a sub-1-token balance floors to "0" (no free tier from dust)', () => {
  assert.equal(wholeTokensHeld('999999999', 9), '0'); // 0.999999999 token
});

test('the converted holdings drive the real GOLD tier (end-to-end)', () => {
  // 10,000 TINYWORLD at 9 decimals should land on the Silver tier (500 GOLD), NOT
  // the old hardcoded display value. Proves the value actually feeds the calc.
  const held = wholeTokensHeld('10000000000000', 9);
  const out = calculateGoldAllowance(
    { tinyworldHeld: held, islandCount: 0, spentThisCycle: 0, now: new Date('2026-06-24T00:00:00Z') },
    DEFAULT_ECONOMY_POLICY,
  );
  assert.equal(out.tinyworldHeld, '10000');
  assert.equal(out.tier, 'silver');
  assert.equal(out.totalAllowance, 500);
});
