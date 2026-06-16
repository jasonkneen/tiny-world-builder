#!/usr/bin/env node
// Headless multiplayer smoke test for local dev (netlify dev + party:dev).
// Spawns visible test players (Scout / Forge / Mira) so you can open the app
// in a browser and see peers moving + chatting.
//
// Prereqs (two terminals):
//   netlify dev          → http://localhost:8888  (DB + /api/worlds)
//   npm run party:dev:open   → ws://localhost:1999 (openMode — bots can play)
//
// Usage:
//   node tools/smoke-multiplayer.mjs
//   node tools/smoke-multiplayer.mjs --slug mixed-hollow --bots 3
//   node tools/smoke-multiplayer.mjs --with-ai-bots   # also spawns LLM bots (needs ANTHROPIC_API_KEY)
//
// Then open in a normal browser:
//   http://localhost:8888/tiny-world-builder?world=mixed-hollow

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

(function loadEnv() {
  try {
    const txt = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    for (const line of txt.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (k && process.env[k] === undefined) process.env[k] = v;
    }
  } catch (_) { /* no .env */ }
})();

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}

const CFG = {
  origin: String(arg('origin', 'http://localhost:8888')).replace(/\/+$/, ''),
  partyHost: String(arg('party-host', 'ws://localhost:1999')).replace(/\/+$/, ''),
  slug: String(arg('slug', 'mixed-hollow')),
  bots: Math.max(0, Math.min(5, parseInt(arg('bots', '3'), 10) || 3)),
  withAiBots: !!arg('with-ai-bots', false),
  seconds: parseInt(arg('seconds', '0'), 10) || 0,
  verbose: !!arg('verbose', false),
};

const BOT_DEFS = [
  { name: 'Scout', color: '#e05c5c', chatOffset: 0, avatar: { kind: 'voxel', seed: 101, body: 'Masc', fit: 'Scout', skin: 1, head: 'Wide', hair: 'Short' } },
  { name: 'Forge', color: '#5ac44e', chatOffset: 4, avatar: { kind: 'voxel', seed: 202, body: 'Masc', fit: 'Barbarian', skin: 3, head: 'Wide', hair: 'Mohawk' } },
  { name: 'Mira', color: '#b060e0', chatOffset: 8, avatar: { kind: 'voxel', seed: 303, body: 'Fem', fit: 'Archer', skin: 0, head: 'Slim', hair: 'Tail' } },
];

const CHAT_LINES = [
  'Anyone found good fishing spots?',
  'This ore deposit looks rich!',
  'Nice world!',
  'Watch out for the dense forest area.',
  "Let's gather resources together.",
  'Heading west to explore.',
];

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function fail(msg) {
  console.error('smoke-multiplayer: FAIL —', msg);
  process.exit(1);
}

function ok(msg) { console.log('smoke-multiplayer: ✓', msg); }

function compactCells(data) {
  const out = [];
  const cs = (data && Array.isArray(data.cells)) ? data.cells : [];
  for (const c of cs) {
    const x = Array.isArray(c) ? c[0] : c.x;
    const z = Array.isArray(c) ? c[1] : c.z;
    if (x == null || z == null) continue;
    const ter = (Array.isArray(c) ? c[2] : c.terrain) || 'grass';
    const k = Array.isArray(c) ? c[3] : c.kind;
    out.push(k ? [x, z, ter, k] : [x, z, ter]);
    if (out.length >= 1500) break;
  }
  return out;
}

function makePrng(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

class SmokeBot {
  constructor(def, index, world, partyHost) {
    this.def = def;
    this.rng = makePrng(index * 0x9e3779b9 + 0x6c62272e);
    this.world = world;
    this.partyHost = partyHost;
    this.ws = null;
    this.connected = false;
    this.role = null;
    this.gridSize = world.gridSize || 8;
    this.x = 0;
    this.z = 0;
    this.grass = new Set();
    this.moves = 0;
    this.lines = 0;
    this.chatIndex = def.chatOffset;
    this.timers = [];
  }

  log(...a) {
    if (CFG.verbose) console.log(`  [${this.def.name}]`, ...a);
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  connect() {
    const slug = this.world.slug;
    const pk = 'smoke-' + this.def.name.toLowerCase() + '-' + Math.floor(this.rng() * 0xffffff).toString(16);
    const url = `${this.partyHost}/party/${encodeURIComponent('world-' + slug)}?_pk=${encodeURIComponent(pk)}`;
    this.ws = new WebSocket(url);

    this.ws.addEventListener('open', () => {
      this.send({
        type: 'world.join',
        token: '',
        worldId: this.world.id,
        name: this.def.name,
        color: this.def.color,
        role: 'play',
        profileId: 'bot:' + this.def.name.toLowerCase(),
        gridSize: this.world.gridSize || 8,
        cells: compactCells(this.world.data),
        taxPercent: this.world.taxPercent,
        ownerProfileId: this.world.ownerProfileId,
        avatar: this.def.avatar,
      });
    });

    this.ws.addEventListener('message', (e) => {
      let d;
      try { d = JSON.parse(e.data); } catch (_) { return; }
      this.onMsg(d);
    });

    this.ws.addEventListener('close', () => { this.connected = false; });
    this.ws.addEventListener('error', () => { this.connected = false; });
  }

  onMsg(d) {
    if (d.type === 'world.state') {
      this.connected = true;
      this.gridSize = d.gridSize || this.gridSize;
      this.role = d.you && d.you.role;
      const you = d.you || {};
      if (you.x != null) this.x = you.x;
      if (you.z != null) this.z = you.z;
      for (const c of (d.grassCells || [])) this.grass.add(c);
      this.scheduleMove();
      this.scheduleChat();
      this.log(`joined role=${this.role} at (${this.x},${this.z})`);
    }
  }

  scheduleMove() {
    const delay = 900 + Math.floor(this.rng() * 2100);
    const t = setTimeout(() => {
      if (!this.connected || this.role !== 'play') return;
      const dir = DIRS[Math.floor(this.rng() * DIRS.length)];
      const nx = Math.max(0, Math.min(this.gridSize - 1, this.x + dir[0]));
      const nz = Math.max(0, Math.min(this.gridSize - 1, this.z + dir[1]));
      if (nx !== this.x || nz !== this.z) {
        this.x = nx;
        this.z = nz;
        this.moves++;
        this.send({ type: 'move', x: nx, z: nz });
      }
      this.scheduleMove();
    }, delay);
    this.timers.push(t);
  }

  scheduleChat() {
    const delay = 12000 + this.def.chatOffset * 1200 + Math.floor(this.rng() * 13000);
    const t = setTimeout(() => {
      if (!this.connected) return;
      const line = CHAT_LINES[this.chatIndex % CHAT_LINES.length];
      this.chatIndex++;
      this.lines++;
      this.send({ type: 'chat', text: line });
      this.scheduleChat();
    }, delay);
    this.timers.push(t);
  }

  disconnect() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    try { this.ws && this.ws.close(); } catch (_) {}
    this.connected = false;
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function probeParty(roomId) {
  return new Promise((resolve, reject) => {
    const url = `${CFG.partyHost}/party/${encodeURIComponent(roomId)}?_pk=smoke-probe`;
    const ws = new WebSocket(url);
    const timer = setTimeout(() => { try { ws.close(); } catch (_) {} reject(new Error('party WS timeout')); }, 8000);
    ws.addEventListener('open', () => {
      clearTimeout(timer);
      ws.close();
      resolve(true);
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('party WS connect failed'));
    });
  });
}

async function probeWorldJoin(world) {
  return new Promise((resolve, reject) => {
    const room = 'world-' + world.slug;
    const url = `${CFG.partyHost}/party/${encodeURIComponent(room)}?_pk=smoke-join-probe`;
    const ws = new WebSocket(url);
    const timer = setTimeout(() => { try { ws.close(); } catch (_) {} reject(new Error('world.join timeout')); }, 8000);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({
        type: 'world.join',
        token: '',
        worldId: world.id,
        name: 'SmokeProbe',
        color: '#5a78e0',
        role: 'play',
        profileId: 'bot:smoke-probe',
        gridSize: world.gridSize,
        cells: compactCells(world.data),
        taxPercent: world.taxPercent,
        ownerProfileId: world.ownerProfileId,
        avatar: { kind: 'voxel', seed: 999 },
      }));
    });
    ws.addEventListener('message', (e) => {
      let d;
      try { d = JSON.parse(e.data); } catch (_) { return; }
      if (d.type === 'world.state') {
        clearTimeout(timer);
        ws.close();
        resolve(d);
      }
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('world WS error'));
    });
  });
}

function printPlaybook(slug) {
  const viewUrl = `${CFG.origin}/tiny-world-builder?world=${encodeURIComponent(slug)}`;
  console.log('');
  console.log('────────────────────────────────────────────────────────');
  console.log('  OPEN IN BROWSER to see test players:');
  console.log('  ' + viewUrl);
  console.log('');
  console.log('  You should see Scout, Forge, and Mira as voxel avatars');
  console.log('  wandering the map and posting chat bubbles.');
  console.log('');
  if (CFG.withAiBots) {
    console.log('  LLM bots (ai-bots.mjs) are also joining — they reply to @mentions.');
    console.log('  Try chatting: "@Scout what do you see?"');
  }
  console.log('  Press Ctrl+C here to disconnect smoke bots.');
  console.log('────────────────────────────────────────────────────────');
  console.log('');
}

function statusLine(bots) {
  const parts = bots.map((b) => `${b.def.name}@${b.x},${b.z} role=${b.role || '?'} moves=${b.moves}`);
  console.log('[bots]', parts.join(' | '));
}

async function main() {
  console.log('smoke-multiplayer: checking stack…');
  console.log(`  origin=${CFG.origin}  party=${CFG.partyHost}  slug=${CFG.slug}  bots=${CFG.bots}`);

  let worldsList;
  try {
    worldsList = await fetchJson(`${CFG.origin}/api/worlds`);
  } catch (e) {
    fail(`netlify dev not reachable at ${CFG.origin} — run: netlify dev\n  (${e.message})`);
  }
  ok(`netlify /api/worlds (${(worldsList.worlds || []).length} worlds)`);

  let bundle;
  try {
    bundle = await fetchJson(`${CFG.origin}/api/worlds?slug=${encodeURIComponent(CFG.slug)}`);
  } catch (e) {
    fail(`world slug "${CFG.slug}" not found — ${e.message}`);
  }
  const world = bundle.world;
  if (!world || world.status !== 'published') {
    fail(`world "${CFG.slug}" is not published (status=${world && world.status})`);
  }
  ok(`world "${world.name}" (${world.gridSize}x${world.gridSize})`);

  try {
    await probeParty('smoke-ping');
  } catch (e) {
    fail(`PartyKit not reachable at ${CFG.partyHost} — run: npm run party:dev:open\n  (${e.message})`);
  }
  ok('PartyKit WebSocket');

  let probeState;
  try {
    probeState = await probeWorldJoin(world);
  } catch (e) {
    fail(`world.join failed — ${e.message}`);
  }
  const probeRole = probeState.you && probeState.you.role;
  ok(`world.join → role=${probeRole} at (${probeState.you.x},${probeState.you.z})`);

  if (probeRole !== 'play') {
    console.error('');
    console.error('smoke-multiplayer: WARNING — bots joined as observe, not play.');
    console.error('  They will be INVISIBLE / frozen in the browser.');
    console.error('  Fix: restart PartyKit in open mode (no join secrets):');
    console.error('    npm run party:dev:open');
    console.error('  Or unset WORLDS_JOIN_SECRET and WORLDS_SERVICE_TOKEN in .env for party:dev.');
    console.error('');
    if (CFG.bots > 0) fail('cannot spawn visible bots without openMode play role');
  }

  const bots = BOT_DEFS.slice(0, CFG.bots).map((def, i) => new SmokeBot(def, i, world, CFG.partyHost));
  bots.forEach((b, i) => setTimeout(() => b.connect(), i * 600));

  let aiChild = null;
  if (CFG.withAiBots) {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
      fail('--with-ai-bots requires ANTHROPIC_API_KEY or OPENAI_API_KEY in .env');
    }
    const aiArgs = [
      path.join(ROOT, 'tools/ai-bots.mjs'),
      '--slug', CFG.slug,
      '--origin', CFG.origin,
      '--bots', String(Math.min(3, CFG.bots || 3)),
      '--host', CFG.partyHost,
      '--mode', 'both',
    ];
    console.log('smoke-multiplayer: spawning LLM bots →', 'node', aiArgs.join(' '));
    aiChild = spawn(process.execPath, aiArgs, { stdio: 'inherit', cwd: ROOT });
  }

  printPlaybook(CFG.slug);

  const statusTimer = setInterval(() => {
    if (bots.length) statusLine(bots);
  }, 15000);
  statusLine(bots);

  function shutdown() {
    clearInterval(statusTimer);
    console.log('\nsmoke-multiplayer: shutting down…');
    bots.forEach((b) => b.disconnect());
    if (aiChild) try { aiChild.kill('SIGTERM'); } catch (_) {}
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  if (CFG.seconds > 0) setTimeout(shutdown, CFG.seconds * 1000);
}

main().catch((e) => fail(e.message));