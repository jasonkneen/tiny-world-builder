// Lobby population layer: spawns >=10 persistent peers that JOIN the in-world
// lobby (slug `tidewater-bay`) as REAL peers, wander the lobby grid, periodically
// emote, and chat using LLM banter on FREE OpenRouter models. They render with the
// same voxel avatar + nameplate + chat bubble pipeline as any human peer (handled
// entirely client-side in engine/world/47-worlds-room.js) — so this process needs
// NO rendering code; it only speaks the PartyKit world protocol.
//
// They are meant to be INDISTINGUISHABLE FROM HUMAN PLAYERS: ordinary first-name /
// gamer-handle display names, plain nameplates, and casual chat. See the IDENTITY
// note below for why they read as regular players, not labelled NPCs.
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
// IDENTITY (indistinguishable from humans):
//   The client tags a peer as a bot (isBotPeer in 47-worlds-room.js) only when its
//   conn id starts with `bot-` OR its profileId starts with `bot:`. To read as an
//   ordinary player, each peer connects with a guest-style conn id (`u_...`, exactly
//   like a real not-logged-in visitor's connToken) and sends profileId:null (the
//   server maps that to `guest:<id>` in open mode, or keeps it null in prod — never
//   a `bot:` value). So neither isBotPeer branch fires: no "(bot) joined" toast, just
//   the same plain join toast and plain nameplate a human gets. Note presenceFor()
//   (party/index.js) does not even relay profileId, so the conn-id is the marker that
//   actually matters; profileId:null is belt-and-suspenders.
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
  allowPaid: !!arg('allow-paid', false),
};
const API_KEY = process.env.OPENROUTER_API_KEY || '';

// Validate --mode (anything unknown falls back to 'both' with a loud warning).
if (!['ambient', 'react', 'both'].includes(CFG.mode)) {
  console.warn(`lobby-bots: unknown --mode "${CFG.mode}" — falling back to "both" (valid: ambient|react|both).`);
  CFG.mode = 'both';
}
const wantAmbient = CFG.mode === 'ambient' || CFG.mode === 'both';
const wantReact = CFG.mode === 'react' || CFG.mode === 'both';

// Enforce FREE OpenRouter models (Jason's hard constraint: ~zero cost). A `:free`
// model id is required unless the operator explicitly opts in with --allow-paid.
if (!CFG.model.endsWith(':free') && !CFG.allowPaid) {
  console.error(`lobby-bots: refusing to start — model "${CFG.model}" is not a :free OpenRouter model.\n` +
    `  Pass a free id (e.g. --model meta-llama/llama-3.3-70b-instruct:free or OPENROUTER_MODEL=...:free).\n` +
    `  See https://openrouter.ai/models?max_price=0 . To override deliberately, pass --allow-paid.`);
  process.exit(1);
}

// ---- personas (ordinary players — read as humans, not labelled NPCs) --------
// Names are believable first-name / gamer-handle display names so a visitor reads
// them as regular players. Each keeps a distinct seeded voxel avatar descriptor
// (`avatar` fields mirror what cleanAvatar accepts) so they all look different.
// `personality` is just a casual chatting vibe handed to the LLM — a normal person,
// never a fantasy narrator.
const PERSONAS = [
  { name: 'Alex', color: '#6fae57', personality: 'laid-back, friendly, into building cool stuff and chatting about it', avatar: { seed: 111, body: 'Masc', fit: 'Scout', skin: 2, head: 'Wide', hair: 'Short' } },
  { name: 'mia_k', color: '#c9a14a', personality: 'upbeat and curious, asks people what they are working on', avatar: { seed: 222, body: 'Fem', fit: 'Casual', skin: 1, head: 'Slim', hair: 'Curls' } },
  { name: 'Jordan', color: '#4f8fb0', personality: 'chill and dry-witted, drops the occasional one-liner', avatar: { seed: 333, body: 'Masc', fit: 'Formal', skin: 4, head: 'Wide', hair: 'Bald' } },
  { name: 'sam2200', color: '#7bc46b', personality: 'enthusiastic gamer, hyped about new worlds and updates', avatar: { seed: 444, body: 'Fem', fit: 'Rogue', skin: 0, head: 'Slim', hair: 'Tail' } },
  { name: 'priya', color: '#b87f4a', personality: 'warm and welcoming, likes saying hi to people who just joined', avatar: { seed: 555, body: 'Masc', fit: 'Barbarian', skin: 3, head: 'Wide', hair: 'Mohawk' } },
  { name: 'theo', color: '#62c0d4', personality: 'thoughtful and easygoing, into the little details of the place', avatar: { seed: 666, body: 'Fem', fit: 'Casual', skin: 2, head: 'Slim', hair: 'Curls' } },
  { name: 'Casey', color: '#d8973f', personality: 'sociable and chatty, always up for a quick conversation', avatar: { seed: 777, body: 'Masc', fit: 'Formal', skin: 1, head: 'Wide', hair: 'Short' } },
  { name: 'nico', color: '#5aaf6e', personality: 'quiet but friendly, comments now and then while wandering', avatar: { seed: 888, body: 'Fem', fit: 'Scout', skin: 0, head: 'Slim', hair: 'Tail' } },
  { name: 'devon', color: '#9a6cc4', personality: 'curious newcomer-energy, asks where people are from', avatar: { seed: 999, body: 'Masc', fit: 'Rogue', skin: 4, head: 'Wide', hair: 'Mohawk' } },
  { name: 'lena_b', color: '#8fb24a', personality: 'cheerful and creative, likes complimenting what others build', avatar: { seed: 121, body: 'Fem', fit: 'Casual', skin: 3, head: 'Slim', hair: 'Curls' } },
  { name: 'kofi', color: '#4fb0a0', personality: 'energetic explorer, talks about checking out the other islands', avatar: { seed: 232, body: 'Masc', fit: 'Scout', skin: 2, head: 'Wide', hair: 'Short' } },
  { name: 'rae', color: '#c46a5a', personality: 'mellow and kind, makes small talk and keeps things light', avatar: { seed: 343, body: 'Fem', fit: 'Formal', skin: 1, head: 'Slim', hair: 'Bald' } },
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
  if (_llmDisabled) return null;         // a 401/403 may have disabled us while we waited in the queue
  const sys = `You are ${persona.name}, a regular person hanging out in the lobby of TinyWorld, a voxel multiplayer game. `
    + `You are just another player chatting, not a narrator or character — talk like a normal person in a game chat. `
    + `Personality: ${persona.personality}. Write ONE short, casual chat line, max ~18 words. `
    + `Lowercase and relaxed is fine. No emojis. No quotation marks. No stage directions or roleplay asterisks.`;
  const user = kind === 'react'
    ? (ctx.addressed
        ? `${ctx.speaker} is talking to you directly (they used your name): "${ctx.text}"\nReply to them naturally in one short line.`
        : `Another player named ${ctx.speaker} just said in chat: "${ctx.text}"\nReply naturally in one short line.`)
    : `Say a brief, casual chat line — a quick hello, an observation, or something on your mind as you walk around the lobby.`;
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
// Strip emoji / pictographic chars before sending (no-emoji is a hard repo rule;
// prompting "No emojis" is not a guarantee). Removes pictographs, regional
// indicators, emoji variation selectors, ZWJ, and skin-tone modifiers.
const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}]/gu;
function clean(s) {
  return String(s || '')
    .replace(EMOJI_RE, '')
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 160)
    .trim();
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
let RESOLVED_WORLD_ID = null;            // a real NUMERIC world id, or null if unresolved
async function loadWorldMeta() {
  if (!CFG.origin) return null;          // no origin -> cannot resolve the numeric world id
  try {
    const res = await fetch(`${CFG.origin}/api/worlds?slug=${encodeURIComponent(CFG.slug)}`);
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    if (!body || !body.world) return null;
    WORLD_META = body.world;
    // The server only treats a NUMERIC id as a world id (worlds.mjs:35-37). A slug
    // sent as worldId would silently cold-load a WRONG/default board, so we only
    // ever forward a verified numeric id.
    const n = Number(WORLD_META.id);
    RESOLVED_WORLD_ID = Number.isFinite(n) && String(n) === String(WORLD_META.id) ? n : null;
    return WORLD_META;
  } catch (_) {
    return null;
  }
}

// ---- movement helpers ------------------------------------------------------
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const rnd = (n) => Math.floor(Math.random() * n);
const EMOTES = ['wave', 'dance', 'jump', 'sit', 'crouch'];   // server allowlist (party EMOTE_CMDS)
const RECONNECT_BASE_MS = 2000;          // first reconnect delay after a drop
const RECONNECT_CAP_MS = 30000;          // capped exponential backoff ceiling

class Bot {
  constructor(persona, i) {
    this.p = persona; this.i = i;
    // Guest-style conn id (reused across reconnects) mirroring a real not-logged-in
    // visitor's connToken (`u_<base36>`, see 47-worlds-room.js). It MUST NOT start
    // with `bot-`, or the client's isBotPeer would tag us and show a "(bot) joined"
    // toast — we want to read as an ordinary player. Random + opaque like a real id.
    this.pk = 'u_' + Math.random().toString(36).slice(2, 10);
    this.id = null; this.x = 0; this.z = 0; this.grid = 8;
    this.grass = new Set(); this.goal = null;
    this.peers = new Map();
    this.connected = false; this.lastTalk = 0;
    this.timers = [];                 // movement / emote / ambient timers (cleared on close)
    this.reconnectTimer = null;
    this.started = false;             // movement+emote+ambient schedulers armed?
    this.stopped = false;             // intentional shutdown -> no reconnect
    this.backoff = RECONNECT_BASE_MS; // current reconnect delay
    this.moves = 0; this.lines = 0; this.emotes = 0; this.role = null;
    this.warnedNoGrass = false;
  }
  log(...a) { console.log(`[${this.p.name}]`, ...a); }
  send(o) { if (this.ws && this.ws.readyState === 1) { try { this.ws.send(JSON.stringify(o)); } catch (_) {} } }

  connect() {
    if (this.stopped) return;
    const url = `${CFG.host}/party/${encodeURIComponent('world-' + CFG.slug)}?_pk=${encodeURIComponent(this.pk)}`;
    let ws;
    try { ws = new WebSocket(url); } catch (e) { this.log('connect failed:', e.message); this.scheduleReconnect(); return; }
    this.ws = ws;
    ws.onopen = () => {
      const w = WORLD_META;
      // Empty token => observe in prod (secret set); role:'observe' keeps us an
      // observer in open testing mode too. worldId (server cold-start via
      // ensureWorldLoaded) is sent ONLY when we hold a real NUMERIC id — a slug
      // would silently load a wrong/default board. cells are an open-mode fallback.
      const join = {
        type: 'world.join', token: '', role: 'observe',
        name: this.p.name, color: this.p.color,
        // profileId:null mirrors a real guest join. The server maps null to
        // `guest:<id>` in open mode (or keeps it null in prod) — never a `bot:`
        // value — so the client's isBotPeer never flags us. (presenceFor doesn't
        // even relay profileId, so the guest-style conn id is the real safeguard.)
        profileId: null,
        gridSize: w ? (w.gridSize || this.grid) : this.grid,
        cells: w && w.data ? compactCells(w.data) : [],
        taxPercent: w ? w.taxPercent : null, ownerProfileId: w ? w.ownerProfileId : null,
        avatar: Object.assign({ kind: 'voxel' }, this.p.avatar),
      };
      if (RESOLVED_WORLD_ID != null) join.worldId = RESOLVED_WORLD_ID;
      this.send(join);
    };
    ws.onmessage = (ev) => {
      let d; try { d = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString()); } catch { return; }
      this.onMsg(d);
    };
    ws.onclose = () => { this.handleDrop(); };
    ws.onerror = (e) => { if (CFG.verbose) this.log('ws error', (e && e.message) || 'socket'); };
  }

  // A socket drop: stop all activity, then reconnect with backoff (unless shutting
  // down). Clearing timers first prevents leaking the dead socket's intervals.
  handleDrop() {
    if (this.stopped) return;
    this.connected = false;
    this.timers.forEach(clearTimeout); this.timers = [];
    this.started = false;
    this.goal = null;
    this.scheduleReconnect();
  }
  scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    const delay = this.backoff + rnd(1000);   // jitter so 10+ bots don't reconnect in lockstep
    this.log(`disconnected — reconnecting in ${(delay / 1000).toFixed(1)}s`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.backoff = Math.min(RECONNECT_CAP_MS, this.backoff * 2);  // grows until a clean join resets it
      this.connect();
    }, delay);
  }

  onMsg(d) {
    if (d.type === 'welcome') {
      // World rooms deliver our own connection id here (party/index.js:577-585),
      // BEFORE any chat. world.state.you carries no id, so without this we'd never
      // learn our own id and would react to our OWN echoed chat (a feedback loop).
      if (d.id) this.id = d.id;
      return;
    }
    if (d.type === 'world.state') {
      this.connected = true;
      this.id = (d.you && d.you.id) || this.id || this.pk;   // fallbacks; welcome already set it
      this.grid = d.gridSize || this.grid;
      this.role = d.you && d.you.role;
      if (d.you && d.you.x != null) { this.x = d.you.x; this.z = d.you.z; }
      this.backoff = RECONNECT_BASE_MS;                       // clean join -> reset backoff
      this.grass.clear();
      for (const c of (d.grassCells || [])) this.grass.add(c);
      for (const pr of (d.peers || [])) if (pr.id) this.peers.set(pr.id, { name: pr.name });
      this.log(`joined as role=${this.role} at (${this.x},${this.z}); ${this.grass.size} walkable cells, ${this.peers.size} peers`);
      if (!this.grass.size && !this.warnedNoGrass) {
        this.warnedNoGrass = true;
        this.log('no walkable cells — the real lobby world is not loaded for us.' +
          (RESOLVED_WORLD_ID != null
            ? ' Idling until a player loads it.'
            : ' Could not resolve a numeric worldId (check TW_ORIGIN/slug), so a cold room cannot self-load; idling until a player loads it.'));
      }
      if (!this.started) {            // arm schedulers once per live connection (re-armed after a reconnect)
        this.started = true;
        this.startMoving();
        if (wantAmbient) this.scheduleAmbient();
        this.scheduleEmote();
      }
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
    }
  }

  // ---- movement: one walkable step toward a wander goal ----
  startMoving() {
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

  // Intentional shutdown: stop reconnecting and clear every timer.
  disconnect() {
    this.stopped = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.timers.forEach(clearTimeout); this.timers = [];
    try { this.ws && this.ws.close(); } catch (_) {}
  }
}

// ---- boot ------------------------------------------------------------------
async function boot() {
  if (typeof WebSocket !== 'function') {
    console.error('This runner needs a global WebSocket (Node 22+). Your Node:', process.version);
    process.exit(1);
  }
  // SAFETY GUARD: refuse to start without an origin. CFG.origin is set from either
  // --origin or TW_ORIGIN. Without it we cannot resolve the real NUMERIC worldId, so
  // a join into a cold room would make the server cold-load a DEFAULT empty board
  // (open mode: setWorldStateFromData with cells:[]) — corrupting the live lobby.
  // Requiring it guarantees we only ever populate the real, already-correct world.
  if (!CFG.origin) {
    console.error('lobby-bots: refusing to start — TW_ORIGIN (or --origin) is required.\n' +
      '  Without it the runner cannot resolve the real numeric worldId for the lobby, and\n' +
      '  joining a cold room could make the server load a wrong/default board over the live lobby.\n' +
      '  Set TW_ORIGIN=<https site serving /api/worlds> (e.g. https://your-site) and retry.');
    process.exit(1);
  }
  if (!API_KEY) {
    console.warn('lobby-bots: OPENROUTER_API_KEY is unset — bots will WANDER and EMOTE but stay silent (no chat). Set it to enable LLM banter.');
  }
  // CFG.origin is guaranteed set (guard above). If the numeric worldId still fails
  // to resolve (bad slug, site down), we DON'T cold-start the lobby — we idle until a
  // real player loads it, never forwarding a slug that would pin a wrong/default board.
  const w = await loadWorldMeta();
  if (w && RESOLVED_WORLD_ID != null) {
    console.log(`lobby-bots: resolved "${w.name}" (id=${RESOLVED_WORLD_ID}, grid=${w.gridSize}) from ${CFG.origin} — cold rooms self-load`);
  } else {
    console.warn(`lobby-bots: WARNING — could not resolve a numeric world id for "${CFG.slug}" at ${CFG.origin}. ` +
      `Bots will NOT cold-start the lobby; they idle until a real player loads it. Check TW_ORIGIN/slug.`);
  }
  console.log(`lobby-bots: ${CFG.bots} players -> ${CFG.host}/party/world-${CFG.slug} | mode=${CFG.mode} model=${CFG.model}${_llmDisabled ? ' (chat disabled)' : ''}`);

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
}

// Run only when invoked directly (`node tools/lobby-bots.mjs`), not when imported
// for tests. Exports below let the unit tests exercise the protocol logic offline.
const _isMain = (() => {
  try { return !!process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]); }
  catch (_) { return false; }
})();
if (_isMain) boot();

export { Bot, clean, CFG };
