import { test } from 'node:test';
import assert from 'node:assert/strict';

// Import the handler directly — the auth check runs before getSql(), so
// unauthenticated and preflight tests do not require a database mock.
const { default: paymentsHandler } = await import('../netlify/functions/wallet-payments.mjs');

test('wallet-payments: unauthenticated request returns 401', async () => {
  const request = new Request('https://tinyworld.example.com/api/wallet/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', amount: '1' }),
  });
  const response = await paymentsHandler(request);
  assert.equal(response.status, 401);
});

test('wallet-payments: OPTIONS preflight returns 204', async () => {
  const request = new Request('https://tinyworld.example.com/api/wallet/payments', {
    method: 'OPTIONS',
    headers: { 'Origin': 'https://tinyworld.example.com' },
  });
  const response = await paymentsHandler(request);
  assert.equal(response.status, 204);
});

// Security invariant: supplying body.recipientWallet without valid auth still
// returns 401 (auth gate fires before any recipient lookup). This confirms the
// handler does not short-circuit auth when a recipient is provided in the body.
test('wallet-payments: body.recipientWallet does not bypass auth gate', async () => {
  const request = new Request('https://tinyworld.example.com/api/wallet/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', amount: '1', recipientWallet: '11111111111111111111111111111111' }),
  });
  const response = await paymentsHandler(request);
  assert.equal(response.status, 401);
});
