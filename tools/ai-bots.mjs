// AI bot-runner: spawns LLM-driven bots that join a TinyWorld room as REAL play
// peers (same WS protocol as a human, openMode), wander the grass grid with
// goals, and converse with a real model — ambient chatter + reactive replies to
// nearby chat. NOT observers: they move and render like users.
//
// Usage:
//   node tools/ai-bots.mjs --slug lobby --bots 3 --mode both
// Flags:
//   --slug <s>      world room slug to join (room id = world-<slug>)   [default: ai-lobby]
//   --bots <n>      number of bots                                      [default: 3]
//   --mode <m>      ambient | react | both                             [default: both]
//   --model <id>    model id                                           [default: claude-haiku-4-5]
//   --provider <p>  anthropic | openai                                 [default: anthropic]
//   --host <url>    partykit ws base                                   [default: ws://localhost:1999]
//   --grid <n>      synthetic all-grass grid size if the room is new   [default: 12]
//   --seconds <n>   auto-exit after N seconds (0 = run forever)        [default: 0]
//   --verbose       log moves too
//
// The model call lives in ONE function (think) so swapping provider/SDK is a
// one-spot change. Key is read from process.env (loaded from .env if present).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---- tiny .env loader (only fills vars not already in the environment) ----
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
  } catch (_) { /* no .env — rely on real env */ }
})();

// ---- args ----
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}
const CFG = {
  slug: String(arg('slug', 'mixed-hollow')),
  origin: String(arg('origin', 'http://localhost:8888')).replace(/\/+$/, ''),
  bots: Math.max(1, Math.min(8, parseInt(arg('bots', '3'), 10) || 3)),
  mode: String(arg('mode', 'both')),
  model: String(arg('model', 'claude-haiku-4-5')),
  provider: String(arg('provider', 'anthropic')),
  host: String(arg('host', 'ws://localhost:1999')),
  grid: Math.max(4, Math.min(40, parseInt(arg('grid', '12'), 10) || 12)),
  seconds: parseInt(arg('seconds', '0'), 10) || 0,
  verbose: !!arg('verbose', false),
};

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

let WORLD_META = null;
async function loadWorldMeta() {
  try {
    const res = await fetch(`${CFG.origin}/api/worlds?slug=${encodeURIComponent(CFG.slug)}`);
    if (!res.ok) return null;
    const body = await res.json();
    if (!body || !body.world) return null;
    WORLD_META = body.world;
    CFG.grid = WORLD_META.gridSize || CFG.grid;
    return WORLD_META;
  } catch (_) {
    return null;
  }
}
const wantAmbient = CFG.mode === 'ambient' || CFG.mode === 'both';
const wantReact = CFG.mode === 'react' || CFG.mode === 'both';

// ---- personas ----
const PERSONAS = [
  { name: 'Scout', color: '#e05c5c', personality: 'curious and upbeat, loves mapping new ground', avatar: { seed: 101, body: 'Masc', fit: 'Scout', skin: 1, head: 'Wide', hair: 'Short' } },
  { name: 'Forge', color: '#5ac44e', personality: 'gruff, practical, always talking about resources and building', avatar: { seed: 202, body: 'Masc', fit: 'Barbarian', skin: 3, head: 'Wide', hair: 'Mohawk' } },
  { name: 'Mira', color: '#b060e0', personality: 'witty and friendly, asks others questions', avatar: { seed: 303, body: 'Fem', fit: 'Rogue', skin: 0, head: 'Slim', hair: 'Tail' } },
  { name: 'Pip', color: '#46b6d8', personality: 'excitable wanderer who narrates little discoveries', avatar: { seed: 404, body: 'Fem', fit: 'Casual', skin: 2, head: 'Wide', hair: 'Curls' } },
  { name: 'Bram', color: '#d8a23f', personality: 'calm storyteller, references the islands and the sea', avatar: { seed: 505, body: 'Masc', fit: 'Formal', skin: 4, head: 'Slim', hair: 'Bald' } },
];

// ---- the brain (swappable seam) ----
let _anthropic = null;
async function think(kind, persona, ctx) {
  const sys = `You are ${persona.name}, a character living in TinyWorld, a cozy voxel multiplayer world of floating islands and a calm sea. `
    + `Personality: ${persona.personality}. Speak ONE short, casual, in-character line, max ~18 words. `
    + `No emojis. No quotation marks. No stage directions. Just what you say out loud to others in the lobby.`;
  const user = kind === 'react'
    ? (ctx.addressed
        ? `${ctx.speaker} is speaking directly to you (they used your name): "${ctx.text}"\nReply to them directly and personally in one short line.`
        : `Another explorer named ${ctx.speaker} just said: "${ctx.text}"\nReply naturally in one short line.`)
    : `Say a brief in-character line about what you are noticing or doing as you wander the lobby.`;
  if (CFG.provider === 'anthropic') {
    if (!_anthropic) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    const r = await _anthropic.messages.create({
      model: CFG.model, max_tokens: 60, system: sys,
      messages: [{ role: 'user', content: user }],
    });
    const txt = (r.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ');
    return clean(txt);
  }
  // openai (gpt-5-mini) — same shape, one extra branch
  if (CFG.provider === 'openai') {
    const { default: OpenAI } = await import('openai');
    const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await oai.chat.completions.create({
      model: CFG.model, max_tokens: 60,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    });
    return clean(r.choices?.[0]?.message?.content || '');
  }
  throw new Error('unknown provider ' + CFG.provider);
}
function clean(s) {
  return String(s || '').replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').slice(0, 160);
}

// ---- synthetic all-grass world (used only if the room is brand new) ----
function syntheticCells(n) {
  const cells = [];
  for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) cells.push([x, z, 'grass']);
  return cells;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const rnd = (n) => Math.floor(Math.random() * n);

class Bot {
  constructor(persona, i) {
    this.p = persona; this.i = i;
    this.id = null; this.x = 0; this.z = 0; this.grid = CFG.grid;
    this.grass = new Set(); this.goal = null;
    this.peers = new Map();          // id -> {name}
    this.connected = false; this.lastTalk = 0;
    this.timers = [];
    this.moves = 0; this.lines = 0; this.role = null;
  }
  log(...a) { console.log(`[${this.p.name}]`, ...a); }
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }

  connect() {
    const pk = 'aibot-' + this.p.name.toLowerCase() + '-' + rnd(0xffffff).toString(16);
    const url = `${CFG.host}/party/${encodeURIComponent('world-' + CFG.slug)}?_pk=${encodeURIComponent(pk)}`;
    this.ws = new WebSocket(url);
    this.ws.on('open', () => {
      const w = WORLD_META;
      this.send({
        type: 'world.join', token: '', worldId: w ? w.id : CFG.slug, name: this.p.name, color: this.p.color,
        role: 'play', profileId: 'bot:' + this.p.name.toLowerCase(),
        gridSize: w ? (w.gridSize || CFG.grid) : CFG.grid,
        cells: w && w.data ? compactCells(w.data) : syntheticCells(CFG.grid),
        taxPercent: w ? w.taxPercent : null, ownerProfileId: w ? w.ownerProfileId : null,
        avatar: Object.assign({ kind: 'voxel' }, this.p.avatar),
      });
    });
    this.ws.on('message', (buf) => { let d; try { d = JSON.parse(buf.toString()); } catch { return; } this.onMsg(d); });
    this.ws.on('close', () => { this.connected = false; });
    this.ws.on('error', (e) => this.log('ws error', e.message));
  }

  onMsg(d) {
    if (d.type === 'world.state') {
      this.connected = true;
      this.id = (d.you && d.you.id) || this.id;
      this.grid = d.gridSize || this.grid;
      this.role = d.you && d.you.role;
      if (d.you && d.you.x != null) { this.x = d.you.x; this.z = d.you.z; }
      for (const c of (d.grassCells || [])) this.grass.add(c);
      if (!this.grass.size) for (const c of syntheticCells(this.grid)) this.grass.add(c[0] + ',' + c[1]);
      for (const pr of (d.peers || [])) if (pr.id) this.peers.set(pr.id, { name: pr.name });
      this.log(`joined as role=${d.you && d.you.role} at (${this.x},${this.z}); ${this.grass.size} grass cells, ${this.peers.size} peers`);
      this.startMoving();
      if (wantAmbient) this.scheduleAmbient();
    } else if (d.type === 'presence' && d.presence) {
      const pr = d.presence;
      if (pr.id && pr.id !== this.id) this.peers.set(pr.id, { name: pr.name });
    } else if (d.type === 'leave') {
      this.peers.delete(d.id);
    } else if (d.type === 'chat' && d.id && d.id !== this.id) {
      this.onChat(d);
    }
  }

  // ---- movement: one grass step toward a wander goal ----
  startMoving() {
    const tick = () => {
      if (!this.connected) return;
      this.step();
      this.timers.push(setTimeout(tick, 1100 + rnd(1600)));
    };
    this.timers.push(setTimeout(tick, 600 + this.i * 300));
  }
  pickGoal() {
    const cells = [...this.grass];
    if (!cells.length) return;
    const [gx, gz] = cells[rnd(cells.length)].split(',').map(Number);
    this.goal = { x: gx, z: gz };
  }
  step() {
    if (!this.goal || (this.goal.x === this.x && this.goal.z === this.z)) this.pickGoal();
    if (!this.goal) return;
    // candidate grass steps, preferring ones that reduce distance to the goal
    const opts = DIRS.map(([dx, dz]) => ({ x: this.x + dx, z: this.z + dz }))
      .filter(c => this.grass.has(c.x + ',' + c.z));
    if (!opts.length) { this.pickGoal(); return; }
    opts.sort((a, b) => (Math.abs(a.x - this.goal.x) + Math.abs(a.z - this.goal.z)) - (Math.abs(b.x - this.goal.x) + Math.abs(b.z - this.goal.z)));
    const next = (Math.random() < 0.75) ? opts[0] : opts[rnd(opts.length)];   // mostly toward goal, sometimes wander
    this.x = next.x; this.z = next.z; this.moves++;
    this.send({ type: 'move', x: this.x, z: this.z });
    if (CFG.verbose) this.log(`-> (${this.x},${this.z})`);
  }

  // ---- conversation ----
  scheduleAmbient() {
    const delay = 18000 + this.i * 3000 + rnd(22000);   // staggered 18-43s
    this.timers.push(setTimeout(async () => {
      if (this.connected) await this.say('ambient', null);
      this.scheduleAmbient();
    }, delay));
  }
  async onChat(d) {
    if (!this.peers.has(d.id)) this.peers.set(d.id, { name: d.name });
    const text = String(d.text || '').toLowerCase();
    const name = this.p.name.toLowerCase();
    const addressed = text.includes('@' + name) || new RegExp('\\b' + name + '\\b').test(text);
    if (addressed) {                                       // directly addressed -> ALWAYS reply, bypass guards
      setTimeout(() => this.say('react', { speaker: d.name || 'someone', text: d.text, addressed: true }), 500 + rnd(1100));
      return;
    }
    if (!wantReact) return;
    if (Date.now() - this.lastTalk < 12000) return;        // per-bot cooldown (token + spam guard)
    if (Math.random() > 0.55) return;                      // not everyone replies to ambient chatter
    setTimeout(() => this.say('react', { speaker: d.name || 'someone', text: d.text }),
      700 + rnd(2600));                                    // human-ish reply latency, staggered
  }
  async say(kind, ctx) {
    if (!this.connected) return;
    this.lastTalk = Date.now();
    try {
      const line = await think(kind, this.p, ctx);
      if (line && this.connected) { this.send({ type: 'chat', text: line }); this.lines++; this.log(`says: ${line}`); }
    } catch (e) { this.log('think failed:', e.message); }
  }

  disconnect() { this.timers.forEach(clearTimeout); this.timers = []; try { this.ws && this.ws.close(); } catch {} }
}

// ---- boot ----
if (CFG.provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set (looked in .env and environment). Aborting.'); process.exit(1);
}

(async function boot() {
  const w = await loadWorldMeta();
  if (w) console.log(`ai-bots: loaded "${w.name}" from ${CFG.origin}`);
  else console.log(`ai-bots: no world at ${CFG.origin} — using synthetic ${CFG.grid}x${CFG.grid} grass`);
  console.log(`ai-bots: ${CFG.bots} bots -> ${CFG.host}/party/world-${CFG.slug} | mode=${CFG.mode} provider=${CFG.provider} model=${CFG.model}`);
  const bots = PERSONAS.slice(0, CFG.bots).map((p, i) => new Bot(p, i));
  bots.forEach((b, i) => setTimeout(() => b.connect(), i * 500));

  function shutdown() {
    console.log('\nai-bots: summary');
    for (const b of bots) console.log(`  ${b.p.name}: role=${b.role} moves=${b.moves} lines=${b.lines} peersSeen=${b.peers.size}`);
    bots.forEach(b => b.disconnect());
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  if (CFG.seconds > 0) setTimeout(shutdown, CFG.seconds * 1000);
})();


