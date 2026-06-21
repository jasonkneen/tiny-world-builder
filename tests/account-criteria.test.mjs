// Unit tests for accountMeetsCriteria() - the shared registered-account
// predicate. Tinyverse access is separately locked to the Jason allowlist.
// Run with: npm run test:unit
//
// The rule is intentionally narrow for now (registered, email-verified Identity
// account) because a wallet-access policy decision is still pending upstream.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accountMeetsCriteria,
  walletUserFromPublicKey,
} from '../netlify/functions/lib/auth.mjs';

test('verified Identity account (confirmedAt set) meets criteria', () => {
  const user = { id: 'abc-123', email: 'a@b.com', confirmedAt: '2026-01-02T03:04:05Z' };
  assert.equal(accountMeetsCriteria(user), true);
});

test('snake_case confirmed_at (bearer-fallback payload shape) meets criteria', () => {
  const user = { id: 'abc-123', email: 'a@b.com', confirmed_at: '2026-01-02T03:04:05Z' };
  assert.equal(accountMeetsCriteria(user), true);
});

test('unverified Identity account (no confirmation) does NOT meet criteria', () => {
  const user = { id: 'abc-123', email: 'a@b.com', confirmedAt: undefined };
  assert.equal(accountMeetsCriteria(user), false);
  assert.equal(accountMeetsCriteria({ id: 'abc-123', email: 'a@b.com', confirmedAt: '' }), false);
  assert.equal(accountMeetsCriteria({ id: 'abc-123', email: 'a@b.com', confirmedAt: null }), false);
});

test('wallet-only session does NOT meet criteria (even if a stray confirmedAt is present)', () => {
  const wallet = walletUserFromPublicKey('11111111111111111111111111111111');
  assert.equal(accountMeetsCriteria(wallet), false);
  assert.equal(accountMeetsCriteria({ id: 'wallet:xyz', confirmedAt: '2026-01-02T03:04:05Z' }), false);
});

test('anonymous / malformed accounts do NOT meet criteria', () => {
  assert.equal(accountMeetsCriteria(null), false);
  assert.equal(accountMeetsCriteria(undefined), false);
  assert.equal(accountMeetsCriteria({}), false);
  assert.equal(accountMeetsCriteria({ confirmedAt: '2026-01-02T03:04:05Z' }), false); // no id
});
