// Lobby population layer: spawns >=10 persistent NPC peers that JOIN the in-world
// lobby (slug `tidewater-bay`) as REAL peers, wander the lobby grid, periodically
// emote, and chat using LLM banter on FREE OpenRouter models. They render with the
// same voxel avatar + nameplate + chat bubble pipeline as any human peer (handled
// entirely client-side in engine/world/47-worlds-room.js) — so this process needs
// NO rendering code; it only speaks the PartyKit world protocol.
//
// SECURITY / JOIN DECISION (verified against party/index.js):
//   In production the world room sets WORLDS_JOIN_SECRET, so an empty-token join is
//   downgraded to role `observe` (party/index.js:1039-1057). Observers CAN move
//   (handleMove gate at :1211-1212 allows observe; only `play` requires a profileId)
//   and CAN chat/emote (the `chat`/`emote` handlers gate on `admitted.has(id)`,
//   which is set for every role at :1080). So these bots join with an EMPTY token as
//   observers — no token minting, no weakening of join security. They cannot harvest
//   or touch the durable economy (harvest is play+profile gated at :1238), which is
//   exactly what we want for ambient NPCs. We send `role: 'observe'` explicitly so
//   the behaviour is identical whether the target runs in prod (secret set) or open
//   testing mode (no secret) — never an unintended `play` seat.
//
// NPC DISCLOSURE (not deceptive):
//   Each bot connects with a PartyKit conn id prefixed `bot-...`. The client detects
//   that (isBotPeer in 47-worlds-room.js) and shows the localized "(bot) joined"
//   toast (worlds.notify.botJoined). Combined with ambient NPC names, real visitors
//   can tell these are characters, not impersonated users.
//
// OFF BY DEFAULT IN THE APP: this is an external Node process. It is never imported
// by the browser build and does not touch the local-only engine/world/51-worlds-bots.js.
//
// Usage:
//   OPENROUTER_API_KEY=sk-or-... node tools/lobby-bots.mjs --origin https://<site>
//   npm run bots:lobby            # 10 bots -> prod lobby (set OPENROUTER_API_KEY + TW_ORIGIN)
//
// Flags (env fallback in parentheses):
//   --slug   <s>   lobby world slug (room id = world-<slug>)   [TW_LOBBY_SLUG] (tidewater-bay)
//   --bots   <n>   number of NPC peers (>=1)                   [BOTS_COUNT]    (10)
//   --host   <ws>  PartyKit ws base                            [PARTYKIT_HOST] (prod partykit)
//   --origin <url> https site for worldId discovery/cold-start [TW_ORIGIN]     ('')
//   --model  <id>  OpenRouter model id (use a :free model)     [OPENROUTER_MODEL]
//   --mode   <m>   ambient | react | both                      [BOTS_MODE]     (both)
//   --seconds <n>  auto-exit after N seconds (0 = forever)     [BOTS_SECONDS]  (0)
//   --verbose      also log every move
//
// The model call lives in ONE function (askLLM) so swapping model/provider is a
// one-spot change. The OpenRouter key is read from OPENROUTER_API_KEY (env or .env).
// If the key is unset, or a call fails / rate-limits / returns empty, the bot
// DEGRADES GRACEFULLY: it skips that chat turn and keeps wandering + emoting. It
// never crashes and never spams.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// ---- args / config ----
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}
function envOr(flag, envKey, def) {
  const a = arg(flag, undefined);
  if (a !== undefined) return a;
  if (process.env[envKey] !== undefined && process.env[envKey] !== '') return process.env[envKey];
  return def;
}

const DEFAULT_HOST = 'wss://tinyworld-shared-building.jasonkneen.partykit.dev';
const DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

const CFG = {
  slug: String(envOr('slug', 'TW_LOBBY_SLUG', 'tidewater-bay')).toLowerCase(),
  bots: Math.max(1, Math.min(40, parseInt(envOr('bots', 'BOTS_COUNT', '10'), 10) || 10)),
  host: String(envOr('host', 'PARTYKIT_HOST', DEFAULT_HOST)).replace(/\/+$/, ''),
  origin: String(envOr('origin', 'TW_ORIGIN', '')).replace(/\/+$/, ''),
  model: String(envOr('model', 'OPENROUTER_MODEL', DEFAULT_MODEL)),
  mode: String(envOr('mode', 'BOTS_MODE', 'both')),
  seconds: parseInt(envOr('seconds', 'BOTS_SECONDS', '0'), 10) || 0,
  verbose: !!arg('verbose', false),
};
const API_KEY = process.env.OPENROUTER_API_KEY || '';
const wantAmbient = CFG.mode === 'ambient' || CFG.mode === 'both';
const wantReact = CFG.mode === 'react' || CFG.mode === 'both';

// ---- NPC personas (ambient characters, not impersonated users) -------------
// Seeded voxel avatars; `avatar` fields mirror the descriptor cleanAvatar accepts.
const PERSONAS = [
  { name: 'Marsh the Wanderer', color: '#6fae57', personality: 'a roaming naturalist who narrates the tide pools and reeds', avatar: { seed: 111, body: 'Masc', fit: 'Scout', skin: 2, head: 'Wide', hair: 'Short' } },
  { name: 'Pebble', color: '#c9a14a', personality: 'a small chatty tinkerer who collects shiny stones', avatar: { seed: 222, body: 'Fem', fit: 'Casual', skin: 1, head: 'Slim', hair: 'Curls' } },
  { name: 'Old Brine', color: '#4f8fb0', personality: 'a weathered fisher who speaks in calm sea proverbs', avatar: { seed: 333, body: 'Masc', fit: 'Formal', skin: 4, head: 'Wide', hair: 'Bald' } },
  { name: 'Fern the Forager', color: '#7bc46b', personality: 'a cheerful plant-gatherer pointing out herbs and blossoms', avatar: { seed: 444, body: 'Fem', fit: 'Rogue', skin: 0, head: 'Slim', hair: 'Tail' } },
  { name: 'Cobble', color: '#b87f4a', personality: 'a gruff stonemason always sizing up the lobby paths', avatar: { seed: 555, body: 'Masc', fit: 'Barbarian', skin: 3, head: 'Wide', hair: 'Mohawk' } },
  { name: 'Dewdrop', color: '#62c0d4', personality: 'a dreamy wanderer who marvels at mist and morning light', avatar: { seed: 666, body: 'Fem', fit: 'Casual', skin: 2, head: 'Slim', hair: 'Curls' } },
  { name: 'Tinder the Lamplighter', color: '#d8973f', personality: 'a warm keeper of lanterns who greets every passerby', avatar: { seed: 777, body: 'Masc', fit: 'Formal', skin: 1, head: 'Wide', hair: 'Short' } },
  { name: 'Reed', color: '#5aaf6e', personality: 'a quiet flute-player who hums about the water and birds', avatar: { seed: 888, body: 'Fem', fit: 'Scout', skin: 0, head: 'Slim', hair: 'Tail' } },
  { name: 'Barnacle', color: '#9a6cc4', personality: 'a curious dock-dweller asking newcomers where they wander from', avatar: { seed: 999, body: 'Masc', fit: 'Rogue', skin: 4, head: 'Wide', hair: 'Mohawk' } },
  { name: 'Willow the Gardener', color: '#8fb24a', personality: 'a gentle gardener tending imaginary window-boxes as she walks', avatar: { seed: 121, body: 'Fem', fit: 'Casual', skin: 3, head: 'Slim', hair: 'Curls' } },
  { name: 'Skiff', color: '#4fb0a0', personality: 'a restless little ferryman describing currents and far islands', avatar: { seed: 232, body: 'Masc', fit: 'Scout', skin: 2, head: 'Wide', hair: 'Short' } },
  { name: 'Maple the Storyteller', color: '#c46a5a', personality: 'a kindly elder weaving tiny tales about the bay', avatar: { seed: 343, body: 'Fem', fit: 'Formal', skin: 1, head: 'Slim', hair: 'Bald' } },
];

// ---- shared, account-wide LLM throttle -------------------------------------
// OpenRouter free-tier limits are per ACCOUNT, not per bot, so 10+ bots sharing one
// key must not burst. One global min-interval gate + small jitter spaces calls out.
let _llmNextAt = 0;
let _llmDisabled = !API_KEY;     // flips on if the key is missing or repeatedly 401/403
const LLM_MIN_INTERVAL_MS = 4500;  // ~13 calls/min ceiling across ALL bots
function reserveLLMSlot() {
  // Returns ms to wait before the call, or -1 if the LLM is disabled.
  if (_llmDisabled) return -1;
  const now = Date.now();
  const start = Math.max(now, _llmNextAt);
  _llmNextAt = start + LLM_MIN_INTERVAL_MS;
  return (start - now) + Math.floor(Math.random() * 400);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

// ---- the brain (one swappable seam: OpenRouter, OpenAI-compatible) ---------
async function askLLM(kind, persona, ctx) {
  const wait = reserveLLMSlot();
  if (wait < 0) return null;             // disabled (no key) -> graceful skip
  await sleep(wait);
  const sys = `You are ${persona.name}, an ambient non-player character living in TinyWorld, a cozy voxel world of floating islands around a calm bay called Tidewater Bay. `
    + `Personality: ${persona.personality}. Speak ONE short, casual, in-character line, max ~18 words. `
    + `No emojis. No quotation marks. No stage directions. Just what you say out loud to others in the lobby.`;
  const user = kind === 'react'
    ? (ctx.addressed
        ? `${ctx.speaker} is speaking directly to you (they used your name): "${ctx.text}"\nReply to them directly and warmly in one short line.`
        : `A visitor named ${ctx.speaker} just said: "${ctx.text}"\nReply naturally in one short line.`)
    : `Say a brief in-character line about what you are noticing or doing as you wander the lobby.`;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Type': 'application/json',
        // Optional attribution headers OpenRouter recommends; harmless if ignored.
        'HTTP-Referer': 'https://github.com/jasonkneen/tiny-world-builder',
        'X-Title': 'TinyWorld lobby NPCs',
      },
      body: JSON.stringify({
        model: CFG.model,
        max_tokens: 60,
        temperature: 0.9,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      }),
    });
    if (res.status === 401 || res.status === 403) {
      _llmDisabled = true;               // bad/expired key -> stop trying, keep wandering
      return null;
    }
    if (res.status === 429) return null; // rate-limited -> skip this turn quietly
    if (!res.ok) return null;            // 4xx/5xx (incl. model-not-found) -> skip
    const body = await res.json().catch(() => null);
    const txt = body && body.choices && body.choices[0] && body.choices[0].message
      ? body.choices[0].message.content : '';
    return clean(txt);                   // empty content -> clean('') -> '' -> skip
  } catch (_) {
    return null;                         // network error -> graceful skip
  }
}
function clean(s) {
  return String(s || '').replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').slice(0, 160);
}

// ---- optional world meta lookup (for reliable cold-start worldId) ----------
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
  if (!CFG.origin) return null;          // no origin -> rely on a present peer to load the world
  try {
    const res = await fetch(`${CFG.origin}/api/worlds?slug=${encodeURIComponent(CFG.slug)}`);
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    if (!body || !body.world) return null;
    WORLD_META = body.world;
    return WORLD_META;
  } catch (_) {
    return null;
  }
}

// ---- movement helpers ------------------------------------------------------
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const rnd = (n) => Math.floor(Math.random() * n);
const EMOTES = ['wave', 'dance', 'jump', 'sit', 'crouch'];   // server allowlist (party EMOTE_CMDS)

class Bot {
  constructor(persona, i) {
    this.p = persona; this.i = i;
    this.id = null; this.x = 0; this.z = 0; this.grid = 8;
    this.grass = new Set(); this.goal = null;
    this.peers = new Map();
    this.connected = false; this.lastTalk = 0;
    this.timers = [];
    this.moves = 0; this.lines = 0; this.emotes = 0; this.role = null;
    this.warnedNoGrass = false;
  }
  log(...a) { console.log(`[${this.p.name}]`, ...a); }
  send(o) { if (this.ws && this.ws.readyState === 1) { try { this.ws.send(JSON.stringify(o)); } catch (_) {} } }

  connect() {
    // `bot-...` conn id => the client tags us as an NPC ("(bot) joined" toast).
    const pk = 'bot-' + this.p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + rnd(0xffffff).toString(16);
    const url = `${CFG.host}/party/${encodeURIComponent('world-' + CFG.slug)}?_pk=${encodeURIComponent(pk)}`;
    let ws;
    try { ws = new WebSocket(url); } catch (e) { this.log('connect failed:', e.message); return; }
    this.ws = ws;
    ws.onopen = () => {
      const w = WORLD_META;
      // Empty token => observe in prod (secret set); role:'observe' keeps us an
      // observer in open testing mode too. worldId drives server-side cold-start
      // (ensureWorldLoaded); cells are a fallback only honored in open mode.
      this.send({
        type: 'world.join', token: '', role: 'observe',
        worldId: w ? w.id : (CFG.slug),
        name: this.p.name, color: this.p.color,
        profileId: 'bot:' + this.p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        gridSize: w ? (w.gridSize || this.grid) : this.grid,
        cells: w && w.data ? compactCells(w.data) : [],
        taxPercent: w ? w.taxPercent : null, ownerProfileId: w ? w.ownerProfileId : null,
        avatar: Object.assign({ kind: 'voxel' }, this.p.avatar),
      });
    };
    ws.onmessage = (ev) => {
      let d; try { d = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString()); } catch { return; }
      this.onMsg(d);
    };
    ws.onclose = () => { this.connected = false; };
    ws.onerror = (e) => { this.log('ws error', (e && e.message) || 'socket'); };
  }

  onMsg(d) {
    if (d.type === 'world.state') {
      this.connected = true;
      this.id = (d.you && d.you.id) || this.id;
      this.grid = d.gridSize || this.grid;
      this.role = d.you && d.you.role;
      if (d.you && d.you.x != null) { this.x = d.you.x; this.z = d.you.z; }
      this.grass.clear();
      for (const c of (d.grassCells || [])) this.grass.add(c);
      for (const pr of (d.peers || [])) if (pr.id) this.peers.set(pr.id, { name: pr.name });
      this.log(`joined as role=${this.role} at (${this.x},${this.z}); ${this.grass.size} walkable cells, ${this.peers.size} peers`);
      if (!this.grass.size && !this.warnedNoGrass) {
        this.warnedNoGrass = true;
        this.log('no walkable cells yet — world not loaded. Will idle until it loads.' +
          (CFG.origin ? '' : ' (pass --origin/TW_ORIGIN so a cold room can self-load via worldId.)'));
      }
      this.startMoving();
      if (wantAmbient) this.scheduleAmbient();
      this.scheduleEmote();
    } else if (d.type === 'presence' && d.presence) {
      const pr = d.presence;
      if (pr.id && pr.id !== this.id) {
        this.peers.set(pr.id, { name: pr.name });
        // Keep our local copy of the walkable set fresh if the world (re)loaded.
      }
    } else if (d.type === 'leave') {
      this.peers.delete(d.id);
    } else if (d.type === 'chat' && d.id && d.id !== this.id) {
      this.onChat(d);
    } else if (d.type === 'world.refresh' && Array.isArray(d.cells)) {
      // World board changed live: rebuild our walkable set from the relayed cells.
      this.grass.clear();
      for (const c of compactCells({ cells: d.cells })) if ((c[2] || 'grass') === 'grass') this.grass.add(c[0] + ',' + c[1]);
    }
  }

  // ---- movement: one walkable step toward a wander goal ----
  startMoving() {
    if (this._movingStarted) return;
    this._movingStarted = true;
    const tick = () => {
      if (this.connected) this.step();
      this.timers.push(setTimeout(tick, 1100 + rnd(1600)));
    };
    this.timers.push(setTimeout(tick, 600 + this.i * 300));
  }
  pickGoal() {
    const cells = [...this.grass];
    if (!cells.length) { this.goal = null; return; }
    const [gx, gz] = cells[rnd(cells.length)].split(',').map(Number);
    this.goal = { x: gx, z: gz };
  }
  step() {
    if (!this.grass.size) return;        // nothing walkable yet -> idle quietly
    if (!this.goal || (this.goal.x === this.x && this.goal.z === this.z)) this.pickGoal();
    if (!this.goal) return;
    const opts = DIRS.map(([dx, dz]) => ({ x: this.x + dx, z: this.z + dz }))
      .filter(c => this.grass.has(c.x + ',' + c.z));
    if (!opts.length) { this.pickGoal(); return; }
    opts.sort((a, b) => (Math.abs(a.x - this.goal.x) + Math.abs(a.z - this.goal.z)) - (Math.abs(b.x - this.goal.x) + Math.abs(b.z - this.goal.z)));
    const next = (Math.random() < 0.75) ? opts[0] : opts[rnd(opts.length)];
    this.x = next.x; this.z = next.z; this.moves++;
    this.send({ type: 'move', x: this.x, z: this.z });
    if (CFG.verbose) this.log(`-> (${this.x},${this.z})`);
  }

  // ---- emotes: an occasional ambient gesture ----
  scheduleEmote() {
    const delay = 25000 + this.i * 1500 + rnd(35000);   // staggered 25-60s+
    this.timers.push(setTimeout(() => {
      if (this.connected) {
        const cmd = EMOTES[rnd(EMOTES.length)];
        this.send({ type: 'emote', cmd });
        this.emotes++;
        if (CFG.verbose) this.log(`emote: ${cmd}`);
      }
      this.scheduleEmote();
    }, delay));
  }

  // ---- conversation ----
  scheduleAmbient() {
    const delay = 22000 + this.i * 3500 + rnd(28000);   // staggered 22-50s+
    this.timers.push(setTimeout(async () => {
      if (this.connected) await this.say('ambient', null);
      this.scheduleAmbient();
    }, delay));
  }
  onChat(d) {
    if (!this.peers.has(d.id)) this.peers.set(d.id, { name: d.name });
    const text = String(d.text || '').toLowerCase();
    const name = this.p.name.toLowerCase();
    const first = name.split(' ')[0];
    const addressed = text.includes('@' + first) || new RegExp('\\b' + first + '\\b').test(text);
    if (addressed) {                                     // directly addressed -> reply
      this.timers.push(setTimeout(() => this.say('react', { speaker: d.name || 'someone', text: d.text, addressed: true }), 600 + rnd(1400)));
      return;
    }
    if (!wantReact) return;
    if (Date.now() - this.lastTalk < 15000) return;      // per-bot cooldown (spam guard)
    if (Math.random() > 0.4) return;                     // not everyone reacts to chatter
    this.timers.push(setTimeout(() => this.say('react', { speaker: d.name || 'someone', text: d.text }), 800 + rnd(2800)));
  }
  async say(kind, ctx) {
    if (!this.connected) return;
    this.lastTalk = Date.now();
    const line = await askLLM(kind, this.p, ctx);
    if (line && this.connected) { this.send({ type: 'chat', text: line }); this.lines++; this.log(`says: ${line}`); }
  }

  disconnect() { this.timers.forEach(clearTimeout); this.timers = []; try { this.ws && this.ws.close(); } catch (_) {} }
}

// ---- boot ------------------------------------------------------------------
(async function boot() {
  if (typeof WebSocket !== 'function') {
    console.error('This runner needs a global WebSocket (Node 22+). Your Node:', process.version);
    process.exit(1);
  }
  if (!API_KEY) {
    console.warn('lobby-bots: OPENROUTER_API_KEY is unset — bots will WANDER and EMOTE but stay silent (no chat). Set it to enable LLM banter.');
  }
  const w = await loadWorldMeta();
  if (w) console.log(`lobby-bots: resolved "${w.name}" (id=${w.id}, grid=${w.gridSize}) from ${CFG.origin}`);
  else if (CFG.origin) console.log(`lobby-bots: could not resolve world at ${CFG.origin} — relying on a present peer to load it`);
  else console.log('lobby-bots: no --origin set — cold rooms cannot self-load; bots idle until a player loads the lobby');
  console.log(`lobby-bots: ${CFG.bots} NPCs -> ${CFG.host}/party/world-${CFG.slug} | mode=${CFG.mode} model=${CFG.model}${_llmDisabled ? ' (chat disabled)' : ''}`);

  const roster = [];
  for (let i = 0; i < CFG.bots; i++) roster.push(PERSONAS[i % PERSONAS.length]);
  const bots = roster.map((p, i) => {
    // Disambiguate names if count exceeds the persona pool.
    const persona = (i >= PERSONAS.length) ? Object.assign({}, p, { name: `${p.name} ${Math.floor(i / PERSONAS.length) + 1}` }) : p;
    return new Bot(persona, i);
  });
  bots.forEach((b, i) => setTimeout(() => b.connect(), i * 500));

  let down = false;
  function shutdown() {
    if (down) return; down = true;
    console.log('\nlobby-bots: summary');
    for (const b of bots) console.log(`  ${b.p.name}: role=${b.role} moves=${b.moves} emotes=${b.emotes} lines=${b.lines} peersSeen=${b.peers.size}`);
    bots.forEach(b => b.disconnect());
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  if (CFG.seconds > 0) setTimeout(shutdown, CFG.seconds * 1000);
})();
