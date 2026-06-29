import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function loadGate(extras) {
  const store = new Map();
  const localStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
  };
  const document = {
    readyState: 'complete',
    cookie: '',
    addEventListener() {},
    getElementById() { return null; },
    body: { classList: { add() {}, remove() {} } },
  };
  const defaultLocation = {
    hostname: 'prod.example.com',
    protocol: 'https:',
    pathname: '/card_reveal.html',
    search: '',
  };
  const location = (extras && extras.location) ? extras.location : defaultLocation;
  const context = {
    document,
    localStorage,
    setTimeout,
    clearTimeout,
    location,
    fetch: extras && extras.fetch,
    console,
    URLSearchParams,
  };
  Object.assign(context, extras || {});
  context.window = context;
  context.location = location;
  const src = readFileSync(new URL('../scripts/tinyverse-auth-gate.js', import.meta.url), 'utf8');
  vm.runInNewContext(src, context, { filename: 'tinyverse-auth-gate.js' });
  return context.window.TinyverseAuthGate;
}

test('evaluate allows allowlisted email when tinyverse-access API is unavailable', async () => {
  const gate = loadGate({
    fetch() {
      return Promise.reject(new Error('offline'));
    },
    TinyWorldAuth: {
      async getUser() {
        return { email: 'jason@bouncingfish.com' };
      },
    },
  });
  const result = await gate.evaluate();
  assert.equal(result.ok, true);
});

test('evaluate bypasses login on local dev hosts', async () => {
  const gate = loadGate({
    location: {
      hostname: 'localhost',
      protocol: 'http:',
      pathname: '/card_reveal.html',
      search: '',
    },
    fetch() {
      return Promise.reject(new Error('offline'));
    },
  });
  const result = await gate.evaluate();
  assert.equal(result.ok, true);
});

test('openLogin sends users to the builder login screen with a return path', () => {
  let href = '';
  const contextLocation = {
    hostname: 'prod.example.com',
    protocol: 'https:',
    pathname: '/card_reveal.html',
    search: '?pack=island-pack',
    get href() { return href; },
    set href(value) { href = String(value || ''); },
  };
  const gate = loadGate({
    location: contextLocation,
  });
  assert.equal(gate.openLogin('Sign in to open Tinyverse packs'), true);
  assert.match(href, /^\/tiny-world-builder\.html\?/);
  assert.match(href, /auth=login/);
  assert.match(href, /return=%2Fcard_reveal\.html/);
});

test('require blocks unauthenticated users with a login reason', async () => {
  const gate = loadGate({
    fetch() {
      return Promise.reject(new Error('offline'));
    },
  });
  const result = await gate.evaluate();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'login');
});

test('handleUnauthorized prefers the builder login modal when available', () => {
  let modalReason = '';
  const gate = loadGate({
    __openLoginModal(reason) {
      modalReason = reason;
      return true;
    },
  });
  assert.equal(gate.handleUnauthorized('Sign in to continue.'), true);
  assert.equal(modalReason, 'Sign in to continue.');
});

test('evaluate treats signed-in non-allowlisted users as access blocked, not login', async () => {
  const gate = loadGate({
    fetch() {
      return Promise.resolve({ status: 200, ok: true, json: async () => ({ allowed: false }) });
    },
    TinyWorldAuth: {
      async getUser() {
        return { email: 'new-user@example.com' };
      },
    },
  });
  const result = await gate.evaluate();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'access');
});