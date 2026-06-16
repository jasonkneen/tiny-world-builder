// Headless DOM probe for the god-admin lobby editor (66-lobby-admin.js), using a
// minimal hand-rolled DOM shim (zero deps — the repo has no npm runtime deps and
// the module's DOM surface is tiny). We stub the worlds event bus, mode
// controller, auth, and cloud API, run the real IIFE module, then drive the
// lifecycle and assert: the admin bar shows for an allow-listed account, the Edit
// toggle flips body classes + play/build mode, Save posts adminSave with the live
// board, and a non-admin email never sees the bar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const moduleSrc = fs.readFileSync(path.resolve('engine/world/66-lobby-admin.js'), 'utf8');

// ---- minimal DOM shim ----
function makeClassList() {
  const set = new Set();
  return {
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    contains: (c) => set.has(c),
    toggle: (c, on) => { const has = set.has(c); const want = on == null ? !has : !!on; if (want) set.add(c); else set.delete(c); return want; },
  };
}
function makeEl(tag) {
  return {
    tagName: String(tag || '').toUpperCase(),
    className: '',
    textContent: '',
    id: '',
    disabled: false,
    children: [],
    attrs: {},
    handlers: {},
    classList: makeClassList(),
    style: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
    addEventListener(ev, cb) { (this.handlers[ev] = this.handlers[ev] || []).push(cb); },
    appendChild(c) { this.children.push(c); return c; },
    click() { (this.handlers.click || []).forEach((cb) => cb({})); },
  };
}
function makeDoc() {
  const byId = {};
  const head = makeEl('head');
  const body = makeEl('body');
  const all = [];
  const track = (node) => { all.push(node); if (node.id) byId[node.id] = node; return node; };
  const origHeadAppend = head.appendChild.bind(head);
  head.appendChild = (c) => { track(c); return origHeadAppend(c); };
  const origBodyAppend = body.appendChild.bind(body);
  body.appendChild = (c) => { track(c); return origBodyAppend(c); };
  return {
    head, body,
    createElement: (tag) => makeEl(tag),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
    getElementById: (id) => byId[id] || null,
    querySelector: (sel) => {
      if (sel && sel[0] === '.') {
        const cls = sel.slice(1);
        // The module sets classes via either el()'s className= or classList.add();
        // match on both so the probe finds elements regardless of which was used.
        return all.find((n) => {
          const inClassName = typeof n.className === 'string' && n.className.split(/\s+/).indexOf(cls) !== -1;
          const inClassList = n.classList && n.classList.contains(cls);
          return inClassName || inClassList;
        }) || null;
      }
      return null;
    },
  };
}

function makeEnv({ adminEmail = 'jason@bouncingfish.com', canAdminEdit = true } = {}) {
  const listeners = {};
  const apiCalls = [];
  const modeCalls = [];
  const window = {};
  window.window = window;
  window.document = makeDoc();
  window.Function = Function;
  window.t = (k) => k;
  window.twToast = () => {};
  // The module reads `buildWorldStateObject` as a bare global (window.* in the
  // browser). Mirror that by also defining it on globalThis for the probe.
  const buildWorldStateObject = () => ({ v: 4, gridSize: 8, cells: [[1, 1, 'water'], [2, 2, 'stone']] });
  window.buildWorldStateObject = buildWorldStateObject;
  globalThis.buildWorldStateObject = buildWorldStateObject;
  window.__tinyworldMode = {
    setBuild: () => modeCalls.push('build'),
    setPlay: () => modeCalls.push('play'),
  };
  window.__tinyworldCloudApiCall = async (p, method, body) => { apiCalls.push({ p, method, body }); return { world: { id: 42 }, admin: true }; };
  window.TinyWorldAuth = { getUser: async () => ({ email: adminEmail }) };
  window.__tinyworldWorlds = {
    canAdminEdit,
    adminWorldId: 42,
    on: (ev, cb) => { (listeners[ev] = listeners[ev] || []).push(cb); },
    adminBroadcastWorld: () => {},
  };
  const fire = (ev, data) => (listeners[ev] || []).forEach((cb) => cb(data));
  // Run the IIFE module with our window/document in scope (it references bare
  // `window`/`document`). The module guards on typeof, so plain refs resolve here.
  const runner = new Function('window', 'document', moduleSrc);
  runner(window, window.document);
  return { window, fire, apiCalls, modeCalls, WS: window.__tinyworldWorlds };
}

const flush = () => new Promise((r) => setTimeout(r, 10));

test('admin bar appears on enter for an allow-listed account and toggles editing', async () => {
  const { window, fire, modeCalls, WS } = makeEnv();
  fire('enter', { world: { slug: 'tidewater-bay', id: 42 }, role: 'play' });
  await flush(); // onEnter awaits the email check
  const bar = window.document.querySelector('.tw-admin-bar');
  assert.ok(bar, 'admin bar element exists');
  assert.ok(bar.classList.contains('open'), 'bar is shown for the admin');
  assert.equal(WS.lobbyAdmin.barOpen(), true);

  WS.lobbyAdmin.startEditing();
  assert.ok(window.document.body.classList.contains('tw-admin-editing'), 'editing body class set');
  assert.ok(modeCalls.includes('build'), 'switched to build mode for live edit');
  assert.equal(WS.lobbyAdmin.isEditing(), true);

  WS.lobbyAdmin.stopEditing();
  assert.ok(!window.document.body.classList.contains('tw-admin-editing'), 'editing class cleared');
  assert.ok(modeCalls.includes('play'), 'returned to play view');
});

test('Save posts adminSave with the live board to the world id', async () => {
  const { fire, apiCalls, WS } = makeEnv();
  fire('enter', { world: { slug: 'tidewater-bay', id: 42 }, role: 'play' });
  await flush();
  WS.lobbyAdmin.startEditing();
  await WS.lobbyAdmin.save();
  const save = apiCalls.find((c) => c.body && c.body.action === 'adminSave');
  assert.ok(save, 'adminSave was posted');
  assert.equal(save.method, 'POST');
  assert.match(save.p, /\/api\/worlds\?id=42$/, 'posts to the live world id');
  assert.ok(Array.isArray(save.body.data.cells), 'sends the serialized board');
  assert.equal(save.body.data.cells.length, 2);
});

test('non-admin account never sees the bar even if canAdminEdit slips through', async () => {
  const { window, fire, WS } = makeEnv({ adminEmail: 'someone@example.com', canAdminEdit: true });
  fire('enter', { world: { slug: 'tidewater-bay', id: 42 }, role: 'play' });
  await flush();
  const bar = window.document.querySelector('.tw-admin-bar');
  assert.ok(!bar || !bar.classList.contains('open'), 'bar stays hidden for non-admin email');
  assert.equal(WS.lobbyAdmin.barOpen(), false);
});

test('leaving the room hides the admin bar and clears editing', async () => {
  const { window, fire, WS } = makeEnv();
  fire('enter', { world: { slug: 'tidewater-bay', id: 42 }, role: 'play' });
  await flush();
  WS.lobbyAdmin.startEditing();
  assert.equal(WS.lobbyAdmin.barOpen(), true);
  fire('leave', {});
  assert.equal(WS.lobbyAdmin.barOpen(), false, 'bar closed on leave');
  assert.ok(!window.document.body.classList.contains('tw-admin-editing'), 'editing cleared on leave');
});
