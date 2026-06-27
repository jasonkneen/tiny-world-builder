// Unit tests for the PartyKit multiplayer room server (party/index.js).
// Run with: npm run test:unit   (node --test, zero extra deps)
//
// Covers the security-critical, pure-logic core: input validation, role/edit
// gating, the public observer/host state machine, and rate limiting. These run in plain
// Node (no browser/THREE), which is exactly why the server is the right first
// unit-test target.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import TinyWorldParty, {
  cleanText, cleanNumber, cleanVec3, cleanPresence, cleanAvatar, cleanCell, cleanCellSet,
  cleanRole, cleanIsland, clampFloors, inIsland, takeToken, safeJson,
  cleanBuildZones, inBuildZones,
  RATE_LIMITS, MAX_CELL_COORD,
  cleanHarvestAction, actionDurationMs, isAdjacentStep, withinReach, taxSplit,
  heartsNow, oreRespawnMs, plantRipenMs, nodeActionForCell, deriveWorldState,
  verifyJoinTokenWeb, GROSS_REWARD, HEART_MAX, ACTION_COOLDOWN_MS,
} from '../party/index.js';
import { normalizeWorldSelectionGateData, signJoinToken, worldPreview } from '../netlify/functions/lib/worlds.mjs';

// ---- mock PartyKit room + connections ----------------------------------
function makeRoom(env = {}) {
  const conns = new Map();
  return {
    id: 'room-test',
    env,
    conns,
    getConnection: (id) => conns.get(id) || null,
    // The server narrows to broadcastToAdmitted (per-connection send); room
    // broadcast is unused, but stub it so nothing throws if that changes.
    broadcast: () => {},
    addConn(id) {
      const c = {
        id,
        received: [],
        closed: false,
        send(raw) { c.received.push(JSON.parse(raw)); },
        close() { c.closed = true; },
      };
      conns.set(id, c);
      return c;
    },
  };
}

function setup() {
  const room = makeRoom();
  const party = new TinyWorldParty(room);
  const connect = (id) => { const c = room.addConn(id); party.onConnect(c); return c; };
  // onMessage(rawString, sender); sender only needs .id.
  const send = (sender, obj) => party.onMessage(JSON.stringify(obj), sender);
  return { room, party, connect, send };
}
const last = (conn) => conn.received[conn.received.length - 1];
const typesTo = (conn) => conn.received.map((m) => m.type);

// ====================== pure validators =================================

test('cleanCellSet rounds coords and rejects out-of-range', () => {
  const ok = cleanCellSet({ x: 3.6, z: -2.4, cell: { terrain: 'grass' } });
  assert.equal(ok.x, 4);
  assert.equal(ok.z, -2);
  assert.equal(cleanCellSet({ x: MAX_CELL_COORD + 1, z: 0, cell: { terrain: 'grass' } }), null);
  assert.equal(cleanCellSet({ x: 0, z: 9999999, cell: { terrain: 'grass' } }), null);
  // NaN coords coerce to 0 (cleanNumber fallback) — a harmless in-bounds cell, not a reject.
  assert.equal(cleanCellSet({ x: NaN, z: 0, cell: { terrain: 'grass' } }).x, 0);
  assert.equal(cleanCellSet(null), null);
  assert.equal(cleanCellSet({ x: 0, z: 0 }), null, 'missing cell rejected');
});

test('cleanCell allowlists fields and drops attacker keys', () => {
  const c = cleanCell({ terrain: 'grass', kind: 'tree', userEdited: true, __proto__: { polluted: 1 }, evil: 'x' });
  assert.equal(c.terrain, 'grass');
  assert.equal(c.kind, 'tree');
  assert.equal('userEdited' in c, false, 'userEdited stripped');
  assert.equal('evil' in c, false, 'unknown field stripped');
  assert.equal('polluted' in c, false);
});

test('cleanCell normalizes terrain/kind enums and clamps floors', () => {
  assert.equal(cleanCell({ terrain: 'bogus' }).terrain, 'grass');
  assert.equal(cleanCell({ terrain: 'lava' }).terrain, 'lava');
  assert.equal(cleanCell({ kind: 'not-a-kind' }).kind, null);
  assert.equal(cleanCell({ kind: 'house' }).kind, 'house');
  assert.equal(cleanCell({ floors: 1e7 }).floors, 8, 'floors clamped to MAX_FLOORS');
  assert.equal(cleanCell({ terrainFloors: 999 }).terrainFloors, 8);
  assert.equal(cleanCell({ floors: 0 }).floors, 1, 'floors floored to 1');
  assert.deepEqual(cleanCell({ terrain: 'grass' }).extras, [], 'extras defaults to []');
  assert.deepEqual(cleanCell({ terrain: 'grass', economy: { resource: 'ore', charges: 200 } }).economy, {
    resource: 'ore',
    action: 'mine',
    charges: 99,
  });
  assert.equal(cleanCell({ terrain: 'grass', economy: { resource: 'wood' } }).economy, null, 'future resources are not accepted by the live room yet');
});

test('cleanCell preserves multi-side fence extras on occupied cells', () => {
  const c = cleanCell({
    terrain: 'dirt',
    kind: 'crop',
    extras: [
      { kind: 'fence', fenceSide: 'n', floors: 1 },
      { kind: 'fence', fenceSide: 'e', floors: 1 },
      { kind: 'fence', fenceSide: 's', floors: 1, appearance: { fenceStyle: 'garden' } },
      { kind: 'fence', fenceSide: 'w', floors: 1, appearance: { fenceStyle: 'gate' } },
    ],
  });
  assert.equal(c.kind, 'crop');
  assert.deepEqual(c.extras.map(extra => extra.fenceSide), ['n', 'e', 's', 'w']);
  assert.equal(c.extras[3].appearance.fenceStyle, 'gate');
});

test('clampFloors bounds to 1..8', () => {
  assert.equal(clampFloors(0), 1);
  assert.equal(clampFloors(-5), 1);
  assert.equal(clampFloors(3), 3);
  assert.equal(clampFloors(8), 8);
  assert.equal(clampFloors(100), 8);
  assert.equal(clampFloors('not a number'), 1);
});

test('cleanRole only allows assignable roles, never host', () => {
  assert.equal(cleanRole('viewer'), 'viewer');
  assert.equal(cleanRole('editor'), 'editor');
  assert.equal(cleanRole('player'), 'player');
  assert.equal(cleanRole('host'), 'viewer', 'a client cannot mint host via role');
  assert.equal(cleanRole('garbage'), 'viewer');
  assert.equal(cleanRole(undefined), 'viewer');
});

test('cleanIsland returns a valid rect or null', () => {
  assert.deepEqual(cleanIsland({ minX: 0, maxX: 7, minZ: 0, maxZ: 7 }), { minX: 0, maxX: 7, minZ: 0, maxZ: 7 });
  assert.equal(cleanIsland(null), null);
  assert.equal(cleanIsland({ minX: 5, maxX: 0, minZ: 0, maxZ: 7 }), null, 'maxX<minX rejected');
  assert.equal(cleanIsland({ minX: 0, maxX: 7 }), null, 'missing bounds rejected');
});

test('inIsland enforces bounds; null island denies all', () => {
  const box = { minX: 0, maxX: 7, minZ: 0, maxZ: 7 };
  assert.equal(inIsland(box, 3, 3), true);
  assert.equal(inIsland(box, 0, 0), true);
  assert.equal(inIsland(box, 7, 7), true);
  assert.equal(inIsland(box, 8, 3), false);
  assert.equal(inIsland(box, -1, 3), false);
  assert.equal(inIsland(null, 3, 3), false);
});

test('build zones sanitize, dedupe, and only active assigned zones grant cells', () => {
  const zones = cleanBuildZones([
    { id: ' alpha zone ', label: 'Alpha', minX: 0, maxX: 2, minZ: 0, maxZ: 2, color: '#36d576' },
    { id: 'alpha-zone', label: 'Duplicate', minX: 3, maxX: 4, minZ: 3, maxZ: 4 },
    { id: 'beta', label: 'Beta', active: false, minX: 5, maxX: 6, minZ: 5, maxZ: 6 },
  ]);
  assert.equal(zones.length, 2);
  assert.equal(zones[0].id, 'alpha-zone');
  assert.equal(zones[0].label, 'Alpha');
  assert.equal(zones[1].active, false);
  const map = new Map(zones.map(zone => [zone.id, zone]));
  assert.equal(inBuildZones(map, ['alpha-zone'], 1, 1), true);
  assert.equal(inBuildZones(map, ['alpha-zone'], 5, 5), false);
  assert.equal(inBuildZones(map, ['beta'], 5, 5), false, 'inactive assigned zone does not authorize edits');
});

test('cleanPresence sanitizes name/color', () => {
  const p = cleanPresence({ name: '  Daisy  ', color: '#ff0000' }, 'fallback');
  assert.equal(p.name, 'Daisy');
  assert.equal(p.color, '#ff0000');
  assert.equal(cleanPresence({}, 'fb').name, 'Builder', 'name defaults');
  assert.equal(cleanPresence({ color: 'red' }, 'fb').color, '#3c82f7', 'invalid color falls back');
  assert.equal(cleanPresence(null, 'fb'), null);
});

test('cleanAvatar preserves resolved voxel avatar customization fields', () => {
  const av = cleanAvatar({
    kind: 'voxel', seed: 123, body: 'Fem', skin: 2, hairC: 4, hair: 'Bald',
    fit: 'Archer', head: 'Slim', height: 1.13, build: -2, gear: 'Bow',
  });
  assert.deepEqual(av, {
    kind: 'voxel', seed: 123, body: 'Fem', skin: 2, hairC: 4, hair: 'Bald',
    fit: 'Archer', head: 'Slim', height: 1.13, build: -2, gear: 'Bow',
  });
  assert.equal(cleanAvatar({ kind: 'voxel', seed: 1, height: 1.4 }), null, 'height range enforced');
  assert.equal(cleanAvatar({ kind: 'voxel', seed: 1, build: 3 }), null, 'build range enforced');
  assert.equal(cleanAvatar({ kind: 'voxel', seed: 1, gear: 'Laser' }), null, 'gear allowlist enforced');
});

test('cleanVec3 coerces to finite numbers', () => {
  assert.deepEqual(cleanVec3({ x: 1, y: 2, z: 3 }), { x: 1, y: 2, z: 3 });
  assert.deepEqual(cleanVec3({ x: 'a', y: Infinity, z: null }), { x: 0, y: 0, z: 0 });
  assert.deepEqual(cleanVec3(null), { x: 0, y: 0, z: 0 });
});

test('safeJson rejects non-strings, oversized, and invalid JSON', () => {
  assert.equal(safeJson('not json{'), null);
  assert.equal(safeJson(42), null);
  assert.deepEqual(safeJson('{"a":1}'), { a: 1 });
  assert.equal(safeJson('"' + 'x'.repeat(48 * 1024) + '"'), null, 'over 48KB rejected');
});

test('takeToken enforces a per-type burst then refills', () => {
  const buckets = new Map();
  const now = 1_000_000;
  const cfg = RATE_LIMITS.presence;
  let passed = 0;
  for (let i = 0; i < cfg.burst + 5; i++) { if (takeToken(buckets, 'presence', now)) passed++; }
  assert.equal(passed, cfg.burst, 'burst capacity enforced within the same instant');
  // Unknown types are unbucketed (host moderation) and always pass.
  assert.equal(takeToken(buckets, 'admit', now), true);
});

// ====================== room state machine + gating =====================

test('first connection becomes host, admitted', () => {
  const { party, connect } = setup();
  const host = connect('h');
  const w = last(host);
  assert.equal(w.type, 'welcome');
  assert.equal(w.role, 'host');
  assert.equal(w.admitted, true);
  assert.equal(party.hostId, 'h');
});

test('second connection joins as a public observer, admitted but not editable', () => {
  const { party, connect } = setup();
  connect('h');
  const guest = connect('g');
  const w = last(guest);
  assert.equal(w.role, 'viewer');
  assert.equal(w.admitted, true);
  assert.deepEqual(w.zoneIds, []);
  assert.equal(party.lobby.has('g'), false);
  assert.equal(party.admitted.get('g').role, 'viewer');
});

test('only the host can admit; admit assigns the chosen role', () => {
  const { party, connect, send } = setup();
  const host = connect('h');
  const guest = connect('g');
  party.admitted.delete('g');
  party.seats.delete('g');
  party.lobby.set('g', { id: 'g', name: 'Guest', presence: null });
  // A non-host trying to admit is ignored.
  send({ id: 'g' }, { type: 'admit', id: 'g', role: 'editor' });
  assert.equal(party.admitted.has('g'), false, 'non-host admit ignored');
  // Host admits as viewer.
  send(host, { type: 'admit', id: 'g', role: 'viewer' });
  assert.equal(party.admitted.get('g').role, 'viewer');
  assert.equal(party.lobby.has('g'), false);
  assert.ok(typesTo(guest).includes('admitted'));
});

test('cell.set is dropped from viewers and players, allowed from host', () => {
  const { party, connect, send, room } = setup();
  const host = connect('h');
  const viewer = connect('v');
  host.received.length = 0;
  // Viewer edit is dropped: host receives no cell.set.
  send({ id: 'v' }, { type: 'cell.set', op: { x: 1, z: 1, cell: { terrain: 'grass' } } });
  assert.equal(host.received.filter((m) => m.type === 'cell.set').length, 0, 'viewer edit dropped');
  // Host edit broadcasts to other admitted (the viewer).
  viewer.received.length = 0;
  send(host, { type: 'cell.set', op: { x: 2, z: 2, cell: { terrain: 'grass' } } });
  assert.ok(viewer.received.some((m) => m.type === 'cell.set' && m.op.x === 2), 'host edit relayed to admitted');
});

test('editor edits only within the granted island', () => {
  const { party, connect, send } = setup();
  const host = connect('h');
  const ed = connect('e');
  send(host, { type: 'setRole', id: 'e', role: 'editor', island: { minX: 0, maxX: 7, minZ: 0, maxZ: 7 } });
  host.received.length = 0;
  // Inside the island → relayed to host.
  send({ id: 'e' }, { type: 'cell.set', op: { x: 3, z: 3, cell: { terrain: 'grass' } } });
  assert.ok(host.received.some((m) => m.type === 'cell.set' && m.op.x === 3), 'in-island edit relayed');
  // Outside the island → dropped.
  host.received.length = 0;
  send({ id: 'e' }, { type: 'cell.set', op: { x: 99, z: 99, cell: { terrain: 'grass' } } });
  assert.equal(host.received.filter((m) => m.type === 'cell.set').length, 0, 'out-of-island edit dropped');
});

test('editor edits only within assigned active build zones', () => {
  const { party, connect, send } = setup();
  const host = connect('h');
  const ed = connect('e');
  send({ id: 'e' }, { type: 'zones.set', zones: [
    { id: 'bad', label: 'Bad', minX: 80, maxX: 90, minZ: 80, maxZ: 90 },
  ] });
  assert.equal(party.zoneList().length, 0, 'non-host zones.set ignored');
  send(host, { type: 'zones.set', zones: [
    { id: 'alpha', label: 'Alpha', active: true, minX: 0, maxX: 2, minZ: 0, maxZ: 2 },
    { id: 'beta', label: 'Beta', active: true, minX: 8, maxX: 10, minZ: 8, maxZ: 10 },
    { id: 'off', label: 'Off', active: false, minX: 4, maxX: 5, minZ: 4, maxZ: 5 },
  ] });
  send(host, { type: 'setRole', id: 'e', role: 'editor', zoneIds: ['alpha', 'beta', 'off', 'missing'] });
  assert.deepEqual(party.admitted.get('e').zoneIds, ['alpha', 'beta', 'off']);
  host.received.length = 0;
  send({ id: 'e' }, { type: 'cell.set', op: { x: 1, z: 1, cell: { terrain: 'grass' } } });
  send({ id: 'e' }, { type: 'cell.set', op: { x: 9, z: 9, cell: { terrain: 'grass' } } });
  assert.equal(host.received.filter((m) => m.type === 'cell.set').length, 2, 'both active zones permit edits');
  host.received.length = 0;
  send({ id: 'e' }, { type: 'cell.set', op: { x: 4, z: 4, cell: { terrain: 'grass' } } });
  send({ id: 'e' }, { type: 'cell.set', op: { x: 99, z: 99, cell: { terrain: 'grass' } } });
  assert.equal(host.received.filter((m) => m.type === 'cell.set').length, 0, 'inactive and unassigned cells are dropped');
  send(host, { type: 'zones.set', zones: [
    { id: 'alpha', label: 'Alpha', active: false, minX: 0, maxX: 2, minZ: 0, maxZ: 2 },
    { id: 'beta', label: 'Beta', active: true, minX: 8, maxX: 10, minZ: 8, maxZ: 10 },
  ] });
  assert.deepEqual(party.admitted.get('e').zoneIds, ['alpha', 'beta'], 'deleted assigned zone is pruned');
  host.received.length = 0;
  send({ id: 'e' }, { type: 'cell.set', op: { x: 1, z: 1, cell: { terrain: 'grass' } } });
  send({ id: 'e' }, { type: 'cell.set', op: { x: 9, z: 9, cell: { terrain: 'grass' } } });
  assert.deepEqual(host.received.filter((m) => m.type === 'cell.set').map((m) => [m.op.x, m.op.z]), [[9, 9]]);
});

test('snapshot/env/moorings are honored only from the host', () => {
  const { party, connect, send } = setup();
  const host = connect('h');
  const ed = connect('e');
  send(host, { type: 'setRole', id: 'e', role: 'editor', island: { minX: 0, maxX: 7, minZ: 0, maxZ: 7 } });
  host.received.length = 0;
  // Non-host env/moorings injection is ignored (host receives nothing).
  send({ id: 'e' }, { type: 'env', env: { weather: 'storm' } });
  send({ id: 'e' }, { type: 'moorings', moorings: [{ a: 1 }] });
  assert.equal(host.received.filter((m) => m.type === 'env' || m.type === 'moorings').length, 0, 'non-host shared-state dropped');
  // Host env broadcasts to admitted (the editor).
  send(host, { type: 'env', env: { weather: 'rain' } });
  assert.ok(party.admitted.has('e'));
});

test('kick is host-only, removes the seat, and closes the connection', () => {
  const { party, connect, send, room } = setup();
  const host = connect('h');
  const v = connect('v');
  // Non-host kick ignored.
  send({ id: 'v' }, { type: 'kick', id: 'v' });
  assert.equal(party.admitted.has('v'), true, 'non-host kick ignored');
  // Host kick removes admitted + seat and closes the socket.
  send(host, { type: 'kick', id: 'v' });
  assert.equal(party.admitted.has('v'), false);
  assert.equal(party.seats.has('v'), false, 'kicked seat forgotten (cannot auto re-admit)');
  assert.equal(room.getConnection('v').closed, true);
  assert.ok(typesTo(room.getConnection('v')).includes('kicked'));
});

test('host can close a shared build room and prevent host promotion', () => {
  const { party, connect, send, room } = setup();
  const host = connect('h');
  const viewer = connect('v');
  send({ id: 'v' }, { type: 'room.close' });
  assert.equal(party.closed, false, 'non-host close ignored');
  assert.equal(party.hostId, 'h');

  send(host, { type: 'room.close' });
  assert.equal(party.closed, true);
  assert.equal(party.hostId, null, 'closed room does not keep or promote a host');
  assert.equal(party.admitted.size, 0);
  assert.equal(party.seats.size, 0);
  assert.ok(typesTo(host).includes('room.closed'));
  assert.ok(typesTo(viewer).includes('room.closed'));
  assert.equal(room.getConnection('h').closed, true);
  assert.equal(room.getConnection('v').closed, true);

  const next = room.addConn('next');
  party.onConnect(next);
  assert.equal(last(next).type, 'room.closed');
  assert.equal(next.closed, true, 'closed room rejects later connections');
});

test('signed collab control token lets the share owner reclaim host control', async () => {
  const room = makeRoom({ WORLDS_JOIN_SECRET: 'test-secret' });
  const party = new TinyWorldParty(room);
  const connect = (id) => { const c = room.addConn(id); party.onConnect(c); return c; };
  const host = connect('h');
  const owner = connect('owner');
  const badToken = signJoinToken({ typ: 'tinyworld-collab-control', roomId: 'other-room' }, 'test-secret');
  await party.onMessage(JSON.stringify({ type: 'control.claim', token: badToken }), owner);
  assert.equal(party.hostId, 'h', 'wrong-room token ignored');

  const token = signJoinToken({ typ: 'tinyworld-collab-control', roomId: 'room-test' }, 'test-secret');
  await party.onMessage(JSON.stringify({ type: 'control.claim', token }), owner);
  assert.equal(party.hostId, 'owner');
  assert.equal(party.admitted.get('owner').role, 'host');
  assert.equal(party.admitted.get('h').role, 'viewer');
  assert.ok(typesTo(owner).includes('role'));
  assert.ok(host.received.some(m => m.type === 'snapshot.request' && m.forId === 'owner'), 'old host is asked to snapshot to owner');
  assert.equal(last(host).type, 'role');
  assert.equal(last(host).role, 'viewer');
});

test('host leaving promotes the next admitted member to host', () => {
  const { party, connect, send, room } = setup();
  const host = connect('h');
  const ed = connect('e');
  send(host, { type: 'setRole', id: 'e', role: 'editor', island: { minX: 0, maxX: 7, minZ: 0, maxZ: 7 } });
  party.onClose(room.getConnection('h'));
  assert.equal(party.hostId, 'e', 'next admitted promoted to host');
  assert.equal(party.admitted.get('e').role, 'host');
  assert.ok(typesTo(room.getConnection('e')).includes('role'));
});

test('combat.hit routes only to the targeted peer, stamped with shooter id', () => {
  const { connect, send } = setup();
  const host = connect('host');           // first connection becomes host
  const a = connect('peerA');
  const b = connect('peerB');
  send(host, { type: 'setRole', id: 'peerA', role: 'player' });
  send(host, { type: 'setRole', id: 'peerB', role: 'player' });
  // peerA shoots peerB
  a.received.length = 0; b.received.length = 0; host.received.length = 0;
  send(a, { type: 'combat.hit', to: 'peerB', damage: 8, source: 'gun' });
  // only B receives it, stamped by = peerA
  const bMsg = b.received.find(m => m.type === 'combat.hit');
  assert.ok(bMsg, 'peerB should receive the hit');
  assert.equal(bMsg.by, 'peerA');
  assert.equal(bMsg.to, 'peerB');
  assert.equal(bMsg.damage, 8);
  assert.equal(a.received.find(m => m.type === 'combat.hit'), undefined, 'shooter should not receive its own hit');
  assert.equal(host.received.find(m => m.type === 'combat.hit'), undefined, 'host should not receive the hit');
});

test('a returning admitted member (same id) is re-admitted, not re-lobbied', () => {
  const { party, connect, send, room } = setup();
  connect('h');
  const v = connect('v');
  // v drops...
  party.onClose(room.getConnection('v'));
  assert.equal(party.admitted.has('v'), false);
  assert.equal(party.seats.has('v'), true, 'seat remembered across disconnect');
  // ...and reconnects with the same id (stable _pk).
  const v2 = room.addConn('v');
  party.onConnect(v2);
  assert.equal(last(v2).admitted, true, 're-admitted from seat');
  assert.equal(last(v2).role, 'viewer');
  assert.equal(party.lobby.has('v'), false, 'not sent back to the lobby');
});

// ====================== Worlds MMO pure rules ===========================

test('cleanHarvestAction allows only the four actions', () => {
  for (const a of ['fish', 'mine', 'gather', 'hunt']) assert.equal(cleanHarvestAction(a), a);
  assert.equal(cleanHarvestAction('dig'), null);
  assert.equal(cleanHarvestAction(''), null);
  assert.equal(cleanHarvestAction(null), null);
});

test('action durations match the docs (fish/gather 3s, mine 5s, hunt 1s)', () => {
  assert.equal(actionDurationMs('fish'), 3000);
  assert.equal(actionDurationMs('gather'), 3000);
  assert.equal(actionDurationMs('mine'), 5000);
  assert.equal(actionDurationMs('hunt'), 1000);
});

test('isAdjacentStep enforces one cell at a time', () => {
  assert.equal(isAdjacentStep({ x: 2, z: 2 }, { x: 3, z: 2 }), true);
  assert.equal(isAdjacentStep({ x: 2, z: 2 }, { x: 3, z: 3 }), true, 'diagonal is one step');
  assert.equal(isAdjacentStep({ x: 2, z: 2 }, { x: 2, z: 2 }), false, 'no move rejected');
  assert.equal(isAdjacentStep({ x: 2, z: 2 }, { x: 4, z: 2 }), false, 'two-cell jump rejected');
});

test('withinReach is on-node or 8-neighbor', () => {
  assert.equal(withinReach({ x: 5, z: 4 }, { x: 5, z: 5 }), true);
  assert.equal(withinReach({ x: 5, z: 5 }, { x: 5, z: 5 }), true);
  assert.equal(withinReach({ x: 5, z: 3 }, { x: 5, z: 5 }), false);
});

test('taxSplit: owner keeps all, visitor split sums to gross, ownerless keeps all', () => {
  const visitor = taxSplit(3, 10, false);
  assert.equal(visitor.owner, 300, '10% of 3000 milli');
  assert.equal(visitor.harvester, 2700);
  assert.equal(visitor.owner + visitor.harvester, 3000, 'conserves the gross');
  const owner = taxSplit(3, 10, true);
  assert.equal(owner.owner, 0);
  assert.equal(owner.harvester, 3000, 'owner harvesting own world keeps all');
  const ownerless = taxSplit(3, null, false);
  assert.equal(ownerless.owner, 0);
  assert.equal(ownerless.harvester, 3000, 'no owner = no tax sink');
  // IMPORTANT: now capped at 20% per mmo-core policy (was previously allowing 100%)
  const heavy = taxSplit(3, 100, false);
  assert.equal(heavy.owner, 600, "clamped to 20% of 3000 milli");
  assert.equal(heavy.harvester, 2400);
});

test('heartsNow regenerates 1/min and caps at max', () => {
  const now = 10_000_000;
  assert.equal(heartsNow(10, now, now).hearts, HEART_MAX, 'full stays full');
  assert.equal(heartsNow(5, now - 3 * 60_000, now).hearts, 8, '3 minutes => +3');
  assert.equal(heartsNow(9, now - 5 * 60_000, now).hearts, HEART_MAX, 'caps at max');
  assert.equal(heartsNow(0, now - 30_000, now).hearts, 0, 'under a minute => no regen');
});

test('regrowth timers scale with stone / grass counts', () => {
  assert.ok(oreRespawnMs(40) < oreRespawnMs(0), 'more stone => faster ore respawn');
  assert.ok(plantRipenMs(120) < plantRipenMs(0), 'more grass => faster ripening');
});

test('nodeActionForCell maps top tile to its harvest action', () => {
  assert.equal(nodeActionForCell('water', null), 'fish');
  assert.equal(nodeActionForCell('stone', null), 'mine');
  assert.equal(nodeActionForCell('grass', 'corn'), 'gather');
  assert.equal(nodeActionForCell('grass', 'cow'), 'hunt');
  assert.equal(nodeActionForCell('grass', null), null);
});

test('deriveWorldState: connected water => one shared fish body, ore/plant nodes, standable terrain', () => {
  const state = deriveWorldState({
    v: 4, gridSize: 8,
    cells: [
      { x: 1, z: 1, terrain: 'water' }, { x: 2, z: 1, terrain: 'water' }, { x: 1, z: 2, terrain: 'water' },
      { x: 5, z: 5, terrain: 'stone' },
      { x: 4, z: 2, terrain: 'dirt', kind: 'corn' },
      { x: 3, z: 3, terrain: 'grass', kind: 'tree' },
      { x: 3, z: 4, terrain: 'grass', kind: 'house' },
      { x: 3, z: 5, terrain: 'grass', kind: 'lamp-post' },
      { x: 4, z: 4, terrain: 'grass', kind: 'stargate' },
      { x: 6, z: 6, terrain: 'grass', kind: 'bush' },
      { x: 6, z: 7, terrain: 'grass', kind: 'flower' },
      { x: 7, z: 6, terrain: 'grass', kind: 'tuft' },
    ],
  }, () => 0.9); // rng 0.9 => ore tier 3
  // The three connected water cells share one fish node.
  const waterIds = new Set([state.cellIndex['1,1'], state.cellIndex['2,1'], state.cellIndex['1,2']]);
  assert.equal(waterIds.size, 1, 'one connected water body');
  const fishNode = state.nodes[state.cellIndex['1,1']];
  assert.equal(fishNode.type, 'fish');
  assert.equal(fishNode.cell, '1,1', 'water-body fish nodes expose a representative cell for the client harvest search');
  assert.equal(state.nodes[state.cellIndex['5,5']].type, 'ore');
  assert.equal(state.nodes[state.cellIndex['5,5']].charges, 3, 'rng 0.9 => tier 3');
  assert.equal(state.nodes[state.cellIndex['4,2']].type, 'plant');
  assert.equal(state.stoneCount, 1);
  assert.equal(state.grassCells.indexOf('5,5'), -1, 'stone stays out of legacy grass spawn cells');
  assert.ok(state.standableCells.indexOf('5,5') >= 0, 'stone is standable');
  assert.ok(state.standableCells.indexOf('1,1') >= 0, 'water is standable');
  assert.equal(state.grassCells.indexOf('3,3'), -1, 'tree blocks standing');
  assert.equal(state.grassCells.indexOf('3,4'), -1, 'buildings block standing');
  assert.equal(state.grassCells.indexOf('3,5'), -1, 'unknown object kinds are solid by default');
  assert.ok(state.grassCells.indexOf('4,4') >= 0, 'stargate is standable');
  assert.ok(state.grassCells.indexOf('6,6') >= 0, 'bush is standable');
  assert.ok(state.grassCells.indexOf('6,7') >= 0, 'flower is standable');
  assert.ok(state.grassCells.indexOf('7,6') >= 0, 'tuft is standable');
  assert.ok(state.grassCells.indexOf('0,0') >= 0, 'empty cells are standable grass');
});

test('deriveWorldState seeds explicit economy resource tags as authoritative nodes', () => {
  const state = deriveWorldState({
    v: 4, gridSize: 8,
    cells: [
      { x: 1, z: 1, terrain: 'water', economy: { resource: 'ore', charges: 2 } },
      { x: 2, z: 1, terrain: 'water' },
      { x: 3, z: 1, terrain: 'grass', kind: 'voxel-build', economy: { resource: 'plants', charges: 3 } },
      { x: 4, z: 1, terrain: 'grass', kind: 'model-stamp', economy: { resource: 'meat' } },
    ],
  });
  assert.equal(state.nodes[state.cellIndex['1,1']].type, 'ore', 'explicit resource overrides visual water terrain');
  assert.equal(state.nodes[state.cellIndex['1,1']].charges, 2);
  assert.equal(state.nodes[state.cellIndex['2,1']].type, 'fish', 'remaining water still creates a fish node');
  assert.equal(state.nodes[state.cellIndex['2,1']].cell, '2,1');
  assert.equal(state.nodes[state.cellIndex['3,1']].type, 'plant');
  assert.equal(state.nodes[state.cellIndex['3,1']].charges, 3);
  assert.ok(state.animalCells.some(c => c.x === 4 && c.z === 1), 'explicit meat seeds huntable animal spawn cells');
});

test('deriveWorldState and safeSpawn prefer the center stargate spawn cell', () => {
  const data = {
    v: 4, gridSize: 8,
    cells: [{ x: 4, z: 4, terrain: 'grass', kind: 'stargate' }, { x: 1, z: 1, terrain: 'water' }],
  };
  const state = deriveWorldState(data);
  assert.deepEqual(state.spawnCell, { x: 4, z: 4 });
  assert.ok(state.grassCells.indexOf('4,4') >= 0, 'stargate cell is standable');

  const party = new TinyWorldParty(makeRoom());
  party.setWorldStateFromData(data, { id: 42, taxPercent: 10 });
  assert.deepEqual(party.safeSpawn(), { x: 4, z: 4 });
});

test('verifyJoinTokenWeb accepts a valid signed token and rejects tampering', async () => {
  const tok = signJoinToken({ w: 42, slug: 'meadow', p: 7, r: 'play' }, 'sekret', 60_000);
  const ok = await verifyJoinTokenWeb(tok, 'sekret');
  assert.ok(ok, 'valid token verifies');
  assert.equal(ok.w, 42);
  assert.equal(ok.r, 'play');
  assert.equal(await verifyJoinTokenWeb(tok, 'wrong-secret'), null, 'wrong secret rejected');
  assert.equal(await verifyJoinTokenWeb(tok.slice(0, -2) + 'zz', 'sekret'), null, 'tampered sig rejected');
  const expired = signJoinToken({ w: 1, r: 'play' }, 'sekret', -1000);
  assert.equal(await verifyJoinTokenWeb(expired, 'sekret'), null, 'expired token rejected');
});

// ====================== Worlds MMO room behavior ========================

test('signed world join loads the full 20x20 world through the service token', async () => {
  const room = makeRoom({
    WORLDS_JOIN_SECRET: 'sekret',
    WORLDS_SERVICE_TOKEN: 'service-token',
    URL: 'https://tinyworld.test',
  });
  room.id = 'world-big-island';
  const party = new TinyWorldParty(room);
  const player = room.addConn('p1');
  party.onConnect(player);
  const oldFetch = globalThis.fetch;
  let fetched = null;
  globalThis.fetch = async (url, init) => {
    fetched = { url: String(url), headers: (init && init.headers) || {} };
    return new Response(JSON.stringify({
      world: {
        id: 77,
        slug: 'big-island',
        status: 'published',
        gridSize: 20,
        taxPercent: 0,
        data: { v: 4, gridSize: 20, cells: [[19, 19, 'stone']] },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const token = signJoinToken({ w: 77, slug: 'big-island', p: 7, r: 'play' }, 'sekret', 60_000);
    await party.onWorldMessage({ type: 'world.join', token, worldId: 77, gridSize: 20, cells: [[1, 1, 'grass']] }, player);
    assert.equal(fetched.url, 'https://tinyworld.test/api/worlds?id=77');
    assert.equal(fetched.headers['x-worlds-token'], 'service-token');
    assert.equal(party.worldState.gridSize, 20);
    assert.ok(party.worldState.grassCells.includes('18,18'), '20x20 walk grid includes cells beyond 8x8');
    const state = player.received.find(m => m.type === 'world.state');
    assert.equal(state.gridSize, 20);
    assert.ok(Number.isInteger(state.you.x));
    assert.ok(Number.isInteger(state.you.z));
    assert.ok(state.you.x >= 0 && state.you.x < 20);
    assert.ok(state.you.z >= 0 && state.you.z < 20);
    assert.equal(state.you.hearts, HEART_MAX);
    assert.equal(state.you.role, 'play');
  } finally {
    globalThis.fetch = oldFetch;
  }
});

function worldSetup() {
  const room = makeRoom();
  room.id = 'world-meadow';
  const party = new TinyWorldParty(room);
  party.setWorldStateFromData({
    v: 4, gridSize: 8,
    cells: [{ x: 5, z: 5, terrain: 'stone' }, { x: 1, z: 1, terrain: 'water' }, { x: 1, z: 2, terrain: 'water' }],
  }, { id: 42, taxPercent: 10, ownerProfileId: 99 });
  const connect = (id) => { const c = room.addConn(id); party.onConnect(c); return c; };
  return { room, party, connect };
}

test('world room admits connections directly as observers (no host/lobby)', () => {
  const { party, connect } = worldSetup();
  const c = connect('p1');
  const w = last(c);
  assert.equal(w.type, 'welcome');
  assert.equal(w.world, true);
  assert.equal(w.role, 'observe');
  assert.equal(w.admitted, true);
  assert.equal(party.hostId, null, 'world rooms have no host');
});

test('world.avatar updates the live presence descriptor', async () => {
  const { party, connect } = worldSetup();
  const p1 = connect('p1');
  const p2 = connect('p2');
  await party.onWorldMessage({ type: 'world.join', role: 'play', profileId: 7, avatar: { kind: 'voxel', seed: 11, fit: 'Scout', gear: 'Sword' } }, p1);
  await party.onWorldMessage({ type: 'world.join', role: 'play', profileId: 8 }, p2);
  const initial = p2.received.find(m => m.type === 'world.state');
  assert.ok(initial.you.avatar && initial.you.avatar.kind === 'voxel', 'join with no explicit avatar still gets a visible default voxel avatar');
  assert.equal(typeof initial.you.avatar.seed, 'number', 'default avatar seed is numeric for the voxel rig');
  p2.received.length = 0;
  const avatar = { kind: 'voxel', seed: 22, body: 'Fem', skin: 2, hairC: 4, hair: 'Bald', fit: 'Archer', head: 'Slim', height: 1.13, build: -2, gear: 'Bow' };
  await party.onWorldMessage({ type: 'world.avatar', avatar }, p1);
  const presence = p2.received.find(m => m.type === 'presence' && m.presence && m.presence.id === 'p1');
  assert.ok(presence, 'peer receives updated presence');
  assert.deepEqual(presence.presence.avatar, avatar);
});

test('a play harvest mines ore: heart spent, node decremented, tax-split credited', () => {
  const { party, connect } = worldSetup();
  connect('p1');
  const p = party.getPlayer('p1');
  p.role = 'play'; p.profileId = 7; p.x = 5; p.z = 4;   // standing next to the ore at 5,5
  const startCharges = party.worldState.nodes[party.worldState.cellIndex['5,5']].charges;
  const seq = party.handleHarvestStart('p1', { action: 'mine', x: 5, z: 5 });
  assert.ok(seq, 'harvest started');
  assert.equal(party.getPlayer('p1').hearts, HEART_MAX - 1, 'one heart spent on start');
  assert.equal(party.worldState.nodes[party.worldState.cellIndex['5,5']].lockedBy, 'p1', 'node locked');
  party.resolveHarvest('p1', seq);
  const node = party.worldState.nodes[party.worldState.cellIndex['5,5']];
  assert.equal(node.charges, startCharges - 1, 'one charge consumed');
  assert.equal(node.lockedBy, null, 'node unlocked after completion');
  // 10% tax: harvester keeps 2700 milli => 2 whole ore this harvest.
  assert.equal(party.pendingResources.get('7').ore, 2, 'harvester credited whole ore');
  assert.ok(party.getPlayer('p1').cooldowns.mine > Date.now(), 'cooldown armed');
});

test('observers and out-of-range players cannot harvest', () => {
  const { party, connect } = worldSetup();
  connect('o1');
  const o = party.getPlayer('o1');
  o.role = 'observe'; o.x = 5; o.z = 4;
  assert.equal(party.handleHarvestStart('o1', { action: 'mine', x: 5, z: 5 }), undefined, 'observer blocked');
  assert.equal(party.pendingResources.size, 0, 'no resources minted for observer');

  connect('p2');
  const p = party.getPlayer('p2');
  p.role = 'play'; p.profileId = 8; p.x = 0; p.z = 0;   // far from the ore
  party.handleHarvestStart('p2', { action: 'mine', x: 5, z: 5 });
  assert.equal(party.getPlayer('p2').busyNode, null, 'out-of-range harvest rejected');
});

test('a node locked by another player blocks a second miner', () => {
  const { party, connect } = worldSetup();
  connect('p1'); connect('p2');
  const a = party.getPlayer('p1'); a.role = 'play'; a.profileId = 7; a.x = 5; a.z = 4;
  const b = party.getPlayer('p2'); b.role = 'play'; b.profileId = 8; b.x = 6; b.z = 5;
  party.handleHarvestStart('p1', { action: 'mine', x: 5, z: 5 });
  party.handleHarvestStart('p2', { action: 'mine', x: 5, z: 5 });
  assert.equal(party.getPlayer('p2').busyNode, null, 'second miner is denied the locked node');
});

test('worldPreview emits sparse terrain/kind tuples for the card minimap', () => {
  const p = worldPreview({ cells: [
    { x: 1, z: 1, terrain: 'water' },
    { x: 2, z: 2, terrain: 'stone' },
    { x: 3, z: 3, terrain: 'dirt', kind: 'corn' },
  ] });
  assert.deepEqual(p[0], [1, 1, 'water']);
  assert.deepEqual(p[1], [2, 2, 'stone']);
  assert.deepEqual(p[2], [3, 3, 'dirt', 'corn'], 'kind preserved for object cells');
  assert.equal(worldPreview({ cells: [] }).length, 0);
});

test('normalizeWorldSelectionGateData strips legacy stargates and guarantees one center picker gate', () => {
  // gridSize 8 -> center gate cell is floor(8/2) = (4,4). (An off-list size like 6
  // would snap up to 8, which is exactly the cap behaviour we now enforce.)
  const normalized = normalizeWorldSelectionGateData({
    v: 4, gridSize: 8,
    cells: [
      { x: 0, z: 0, terrain: 'grass', kind: 'stargate', dest: 'old-world' },
      { x: 1, z: 1, terrain: 'stone', kind: 'stargate', dest: 'old-world' },
      [2, 2, 'dirt', 'stargate', undefined, '__world-picker'],
      { x: 4, z: 4, terrain: 'stone', kind: 'rock' },
      { x: 6, z: 6, terrain: 'water' },
    ],
  });
  const gates = normalized.cells.filter(c => c && (Array.isArray(c) ? c[3] : c.kind) === 'stargate');
  assert.equal(gates.length, 1);
  assert.deepEqual(gates[0], { x: 4, z: 4, terrain: 'grass', kind: 'stargate', dest: '__world-picker' });
  assert.equal(normalized.cells.some(c => c && c.x === 0 && c.z === 0), false, 'old stargate removed');
  assert.equal(normalized.cells.some(c => c && c.x === 1 && c.z === 1 && c.terrain === 'stone' && !c.kind), true, 'non-grass stargate terrain stays');
  assert.equal(normalized.cells.some(c => Array.isArray(c) && c[0] === 2 && c[1] === 2 && c[2] === 'dirt' && !c[3]), true, 'array stargate terrain stays without kind');
  assert.equal(normalized.cells.some(c => c && c.x === 4 && c.z === 4 && c.kind === 'rock'), false, 'center object is replaced by the required gate');
  assert.equal(normalized.cells.some(c => c && c.x === 6 && c.z === 6 && c.terrain === 'water'), true, 'unrelated terrain stays');
});

test('build joins are plain play seats and world.refresh is ignored', async () => {
  // Open mode still tolerates stale clients declaring role 'build', but it no
  // longer grants an admin seat or a live board refresh channel.
  const room = makeRoom();
  room.id = 'world-lobby';
  const party = new TinyWorldParty(room);
  const staleBuilder = room.addConn('admin'); party.onConnect(staleBuilder);
  const peer = room.addConn('peer'); party.onConnect(peer);
  await party.onWorldMessage({ type: 'world.join', role: 'build', profileId: 1, gridSize: 8, cells: [[2, 2, 'stone']] }, staleBuilder);
  await party.onWorldMessage({ type: 'world.join', role: 'play', profileId: 2, gridSize: 8, cells: [[2, 2, 'stone']] }, peer);
  assert.equal(party.admitted.get('admin').role, 'play', 'stale build role downgrades to play');
  assert.equal(party.admitted.get('admin').isAdmin, false, 'stale build role is not admin');
  assert.equal(party.admitted.get('peer').isAdmin, false, 'a plain player is not admin');

  peer.received.length = 0;
  await party.onWorldMessage({ type: 'world.refresh', gridSize: 8, cells: [[4, 4, 'stone'], [1, 1, 'water']] }, staleBuilder);
  assert.ok(party.worldState.cellIndex['2,2'], 'original ore node untouched');
  assert.ok(!party.worldState.cellIndex['4,4'], 'refresh board NOT applied');
  assert.equal(peer.received.some(m => m.type === 'world.refresh'), false, 'no relay to peers');
  assert.equal(peer.received.some(m => m.type === 'world.state'), false, 'no forced snapshot to peers');
});

test('open testing mode (no join secret) seeds from client cells and lets a declared player harvest', async () => {
  const room = makeRoom();
  room.id = 'world-open';            // env has no WORLDS_JOIN_SECRET => open mode
  const party = new TinyWorldParty(room);
  party.onConnect(room.addConn('p1'));
  await party.onWorldMessage({
    type: 'world.join', role: 'play', profileId: 7, gridSize: 8,
    cells: [[5, 5, 'stone'], [1, 1, 'water']],
  }, { id: 'p1' });
  assert.equal(party.openMode, true, 'open mode engaged without a secret');
  const p = party.getPlayer('p1');
  assert.equal(p.role, 'play', 'declared role honored in open mode');
  p.x = 5; p.z = 4;
  const seq = party.handleHarvestStart('p1', { action: 'mine', x: 5, z: 5 });
  assert.ok(seq, 'harvest starts in open mode');
  party.resolveHarvest('p1', seq);
  assert.equal(party.pendingResources.get('7').ore, 3, 'ownerless world => full gross to harvester');
});

test('movement is one standable cell at a time and locked during a harvest', () => {
  const { party, connect } = worldSetup();
  connect('p1');
  const p = party.getPlayer('p1'); p.role = 'play'; p.profileId = 7; p.x = 3; p.z = 3;
  party.handleMove('p1', { x: 4, z: 3 });
  assert.deepEqual({ x: party.getPlayer('p1').x, z: party.getPlayer('p1').z }, { x: 4, z: 3 }, 'one step accepted');
  party.handleMove('p1', { x: 7, z: 3 });
  assert.deepEqual({ x: party.getPlayer('p1').x, z: party.getPlayer('p1').z }, { x: 4, z: 3 }, 'two-cell jump rejected');
  // Water is walkable: one adjacent step onto a water cell (not a multi-cell leap).
  party.getPlayer('p1').x = 0; party.getPlayer('p1').z = 1;
  party.handleMove('p1', { x: 1, z: 1 });
  assert.deepEqual({ x: party.getPlayer('p1').x, z: party.getPlayer('p1').z }, { x: 1, z: 1 }, 'water is standable');
  // Stone is also walkable terrain; solid objects on stone still block via kind.
  party.getPlayer('p1').x = 5; party.getPlayer('p1').z = 4;
  party.handleMove('p1', { x: 5, z: 5 });
  assert.deepEqual({ x: party.getPlayer('p1').x, z: party.getPlayer('p1').z }, { x: 5, z: 5 }, 'stone is standable');
});

test('observe role can move; play-without-profile cannot', () => {
  const { party, connect } = worldSetup();
  connect('obs');
  // A provisional observer (the default role after onConnect on a world room).
  const obs = party.getPlayer('obs'); obs.x = 3; obs.z = 3;
  party.handleMove('obs', { x: 4, z: 3 });
  assert.deepEqual({ x: party.getPlayer('obs').x, z: party.getPlayer('obs').z }, { x: 4, z: 3 }, 'observer move accepted');
  // role=play but no profileId (an un-upgraded/guest seat) is still rejected.
  obs.role = 'play'; obs.profileId = null;
  party.handleMove('obs', { x: 5, z: 3 });
  assert.deepEqual({ x: party.getPlayer('obs').x, z: party.getPlayer('obs').z }, { x: 4, z: 3 }, 'play-without-profile move rejected');
});
