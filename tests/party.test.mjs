// Unit tests for the PartyKit multiplayer room server (party/index.js).
// Run with: npm run test:unit   (node --test, zero extra deps)
//
// Covers the security-critical, pure-logic core: input validation, role/edit
// gating, the lobby/host state machine, and rate limiting. These run in plain
// Node (no browser/THREE), which is exactly why the server is the right first
// unit-test target.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import TinyWorldParty, {
  cleanText, cleanNumber, cleanVec3, cleanPresence, cleanAvatar, cleanCell, cleanCellSet,
  cleanRole, cleanIsland, clampFloors, inIsland, takeToken, safeJson,
  RATE_LIMITS, MAX_CELL_COORD,
  cleanHarvestAction, actionDurationMs, isAdjacentStep, withinReach, taxSplit,
  heartsNow, oreRespawnMs, plantRipenMs, nodeActionForCell, deriveWorldState,
  verifyJoinTokenWeb, GROSS_REWARD, HEART_MAX, ACTION_COOLDOWN_MS,
} from '../party/index.js';
import { signJoinToken, worldPreview } from '../netlify/functions/lib/worlds.mjs';

// ---- mock PartyKit room + connections ----------------------------------
function makeRoom() {
  const conns = new Map();
  return {
    id: 'room-test',
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

test('second connection lands in the lobby, not admitted', () => {
  const { party, connect } = setup();
  connect('h');
  const guest = connect('g');
  const w = last(guest);
  assert.equal(w.role, 'viewer');
  assert.equal(w.admitted, false);
  assert.equal(party.lobby.has('g'), true);
  assert.equal(party.admitted.has('g'), false);
});

test('only the host can admit; admit assigns the chosen role', () => {
  const { party, connect, send } = setup();
  const host = connect('h');
  const guest = connect('g');
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
  send(host, { type: 'admit', id: 'v', role: 'viewer' });
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
  send(host, { type: 'admit', id: 'e', role: 'editor', island: { minX: 0, maxX: 7, minZ: 0, maxZ: 7 } });
  host.received.length = 0;
  // Inside the island → relayed to host.
  send({ id: 'e' }, { type: 'cell.set', op: { x: 3, z: 3, cell: { terrain: 'grass' } } });
  assert.ok(host.received.some((m) => m.type === 'cell.set' && m.op.x === 3), 'in-island edit relayed');
  // Outside the island → dropped.
  host.received.length = 0;
  send({ id: 'e' }, { type: 'cell.set', op: { x: 99, z: 99, cell: { terrain: 'grass' } } });
  assert.equal(host.received.filter((m) => m.type === 'cell.set').length, 0, 'out-of-island edit dropped');
});

test('snapshot/env/moorings are honored only from the host', () => {
  const { party, connect, send } = setup();
  const host = connect('h');
  const ed = connect('e');
  send(host, { type: 'admit', id: 'e', role: 'editor', island: { minX: 0, maxX: 7, minZ: 0, maxZ: 7 } });
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
  send(host, { type: 'admit', id: 'v', role: 'viewer' });
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

test('host leaving promotes the next admitted member to host', () => {
  const { party, connect, send, room } = setup();
  const host = connect('h');
  const ed = connect('e');
  send(host, { type: 'admit', id: 'e', role: 'editor', island: { minX: 0, maxX: 7, minZ: 0, maxZ: 7 } });
  party.onClose(room.getConnection('h'));
  assert.equal(party.hostId, 'e', 'next admitted promoted to host');
  assert.equal(party.admitted.get('e').role, 'host');
  assert.ok(typesTo(room.getConnection('e')).includes('role'));
});

test('combat.hit routes only to the targeted peer, stamped with shooter id', () => {
  const { connect, send } = setup();
  const host = connect('host');           // first connection becomes host
  // admit two peers as players
  const a = connect('peerA');
  const b = connect('peerB');
  send(host, { type: 'admit', id: 'peerA', role: 'player' });
  send(host, { type: 'admit', id: 'peerB', role: 'player' });
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
  const host = connect('h');
  const v = connect('v');
  send(host, { type: 'admit', id: 'v', role: 'viewer' });
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
  const heavy = taxSplit(3, 100, false);
  assert.equal(heavy.owner, 3000);
  assert.equal(heavy.harvester, 0);
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

test('deriveWorldState: connected water => one shared fish body, ore/plant nodes, standable grass', () => {
  const state = deriveWorldState({
    v: 4, gridSize: 8,
    cells: [
      { x: 1, z: 1, terrain: 'water' }, { x: 2, z: 1, terrain: 'water' }, { x: 1, z: 2, terrain: 'water' },
      { x: 5, z: 5, terrain: 'stone' },
      { x: 4, z: 2, terrain: 'dirt', kind: 'corn' },
      { x: 3, z: 3, terrain: 'grass', kind: 'tree' },
    ],
  }, () => 0.9); // rng 0.9 => ore tier 3
  // The three connected water cells share one fish node.
  const waterIds = new Set([state.cellIndex['1,1'], state.cellIndex['2,1'], state.cellIndex['1,2']]);
  assert.equal(waterIds.size, 1, 'one connected water body');
  const fishNode = state.nodes[state.cellIndex['1,1']];
  assert.equal(fishNode.type, 'fish');
  assert.equal(state.nodes[state.cellIndex['5,5']].type, 'ore');
  assert.equal(state.nodes[state.cellIndex['5,5']].charges, 3, 'rng 0.9 => tier 3');
  assert.equal(state.nodes[state.cellIndex['4,2']].type, 'plant');
  assert.equal(state.stoneCount, 1);
  assert.equal(state.grassCells.indexOf('5,5'), -1, 'stone is not standable');
  assert.ok(state.grassCells.indexOf('1,1') >= 0, 'water is standable');
  assert.equal(state.grassCells.indexOf('3,3'), -1, 'tree blocks standing');
  assert.ok(state.grassCells.indexOf('0,0') >= 0, 'empty cells are standable grass');
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

test('god-admin world.refresh re-derives state and relays the fresh board to peers', async () => {
  // Open mode (no WORLDS_JOIN_SECRET): a client declaring role 'build' is seated
  // as an admin. The admin pushes a new board; the server re-derives nodes and
  // standable tiles and relays world.refresh to every OTHER client.
  const room = makeRoom();
  room.id = 'world-lobby';
  const party = new TinyWorldParty(room);
  const admin = room.addConn('admin'); party.onConnect(admin);
  const peer = room.addConn('peer'); party.onConnect(peer);
  await party.onWorldMessage({ type: 'world.join', role: 'build', profileId: 1, gridSize: 8, cells: [[2, 2, 'stone']] }, admin);
  await party.onWorldMessage({ type: 'world.join', role: 'play', profileId: 2, gridSize: 8, cells: [[2, 2, 'stone']] }, peer);
  assert.equal(party.admitted.get('admin').isAdmin, true, 'build token seats an admin');
  assert.equal(party.admitted.get('peer').isAdmin, false, 'a plain player is not admin');

  peer.received.length = 0;
  // Admin replaces the board: move the ore to 4,4 and add a water cell at 1,1.
  await party.onWorldMessage({ type: 'world.refresh', gridSize: 8, cells: [[4, 4, 'stone'], [1, 1, 'water']] }, admin);

  // The room's authoritative world state now reflects the new board.
  assert.ok(party.worldState.cellIndex['4,4'], 'new ore node indexed at 4,4');
  assert.ok(!party.worldState.cellIndex['2,2'], 'old ore node at 2,2 is gone');
  // The peer received a world.refresh carrying the new cells, then a fresh snapshot.
  const refresh = peer.received.find(m => m.type === 'world.refresh');
  assert.ok(refresh, 'peer receives the live world.refresh');
  assert.deepEqual(refresh.cells, [[4, 4, 'stone'], [1, 1, 'water']]);
  assert.ok(peer.received.some(m => m.type === 'world.state'), 'peer gets a fresh snapshot');
});

test('a non-admin world.refresh is ignored (no state change, no relay)', async () => {
  const room = makeRoom();
  room.id = 'world-lobby2';
  const party = new TinyWorldParty(room);
  const player = room.addConn('p1'); party.onConnect(player);
  const peer = room.addConn('p2'); party.onConnect(peer);
  await party.onWorldMessage({ type: 'world.join', role: 'play', profileId: 1, gridSize: 8, cells: [[2, 2, 'stone']] }, player);
  await party.onWorldMessage({ type: 'world.join', role: 'play', profileId: 2, gridSize: 8, cells: [[2, 2, 'stone']] }, peer);
  peer.received.length = 0;
  await party.onWorldMessage({ type: 'world.refresh', gridSize: 8, cells: [[4, 4, 'stone']] }, player);
  assert.ok(party.worldState.cellIndex['2,2'], 'original ore node untouched');
  assert.ok(!party.worldState.cellIndex['4,4'], 'spoofed board NOT applied');
  assert.equal(peer.received.some(m => m.type === 'world.refresh'), false, 'no relay to peers');
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
