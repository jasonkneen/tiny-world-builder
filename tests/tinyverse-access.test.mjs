import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTinyverseAccessEmail,
  tinyverseAccessEmails,
  tinyverseLobbyAccessForEmail,
} from '../netlify/functions/lib/tinyverse-access.mjs';
import { canAccessTinyverse } from '../netlify/functions/admin-users.mjs';

test('Tinyverse access is locked to the Jason account allowlist', () => {
  const set = tinyverseAccessEmails();
  assert.equal(set.has('jason@bouncingfish.com'), true);
  assert.equal(set.has('jason.kneen@bouncingfish.com'), true);
  assert.equal(set.has('jason.kneen@gmail.com'), true);
  assert.equal(isTinyverseAccessEmail('  Jason.Kneen@Gmail.com  '), true);
  assert.equal(isTinyverseAccessEmail('someone@example.com'), false);
  assert.equal(isTinyverseAccessEmail(''), false);
});

test('new profile lobby flag defaults to the Tinyverse allowlist only', () => {
  assert.equal(tinyverseLobbyAccessForEmail('jason.kneen@gmail.com'), true);
  assert.equal(tinyverseLobbyAccessForEmail('new-user@example.com'), false);
});

test('admin Tinyverse check ignores stale lobby flags for non-allowed users', () => {
  const user = { id: 'user-123', email: 'new-user@example.com' };
  const profile = { email: 'new-user@example.com', lobby_access: true };
  assert.equal(canAccessTinyverse(user, profile), false);
  assert.equal(canAccessTinyverse({ id: 'user-456', email: 'jason.kneen@gmail.com' }, null), true);
});
