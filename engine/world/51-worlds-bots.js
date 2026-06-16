  // Tinyverse — local-dev bot simulation.
  // Spawns 3 deterministic bots via PartyKit when entering a world on localhost.
  // Bots are full participants: they connect via the same WS protocol as real
  // players, move around the grid, and send occasional chat messages.
  // Guard: ONLY runs on localhost / 127.0.0.1. Never runs in production.
  // IIFE-wrapped; no globals leak.
  (function wireWorldBots() {
    'use strict';
    if (typeof location === 'undefined') return;
    if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const WS = (window.__tinyworldWorlds = window.__tinyworldWorlds || {});
    function on(ev, cb) { if (typeof WS.on === 'function') WS.on(ev, cb); }

    // Seeded LCG PRNG — deterministic per bot so behavior is reproducible.
    function makePrng(seed) {
      let s = (seed ^ 0xdeadbeef) >>> 0;
      return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
    }

    // Each bot gets a DISTINCT networked voxel descriptor (sent in world.join) so
    // Scout/Forge/Mira render as visibly different people. `avatarSpec` is the partial
    // look; resolved to a full descriptor at join time via window.voxelAvatarDescriptor
    // (53) so it round-trips through the server exactly like a real player's pick.
    const BOT_DEFS = [
      { name: 'Scout', color: '#e05c5c', chatOffset: 0, avatarSpec: { seed: 101, body: 'Masc', fit: 'Scout', skin: 1, head: 'Wide', hair: 'Short', height: 1, build: -1, gear: 'Sword' } },
      { name: 'Forge', color: '#5ac44e', chatOffset: 4, avatarSpec: { seed: 202, body: 'Masc', fit: 'Barbarian', skin: 3, head: 'Wide', hair: 'Mohawk', height: 1.15, build: 2, gear: 'Axe' } },
      { name: 'Mira', color: '#b060e0', chatOffset: 8, avatarSpec: { seed: 303, body: 'Fem', fit: 'Archer', skin: 0, head: 'Slim', hair: 'Tail', height: 0.96, build: -2, gear: 'Bow' } },
    ];
    function botAvatar(spec) {
      if (typeof window.voxelAvatarDescriptor === 'function') return window.voxelAvatarDescriptor(spec);
      return Object.assign({ kind: 'voxel' }, spec);
    }

    const CHAT_LINES = [
      'Anyone found good fishing spots?',
      'This ore deposit looks rich!',
      'Nice world!',
      'Watch out for the dense forest area.',
      'Found some plants near the north edge.',
      "Let's gather resources together.",
      'Anyone tried hunting the animals?',
      "I'll check the eastern side.",
      'The fish are biting today!',
      'Found a great gathering spot!',
      'Heading west to explore.',
      'This terrain is really something.',
    ];

    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    function wsBase() {
      const explicit = typeof window.__TINY_WORLD_PARTYKIT_HOST__ === 'string' ? window.__TINY_WORLD_PARTYKIT_HOST__ : '';
      if (explicit) return explicit.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://').replace(/\/+$/, '');
      return 'ws://localhost:1999';
    }

    function compactCells(cells) {
      const out = [];
      for (const c of (cells || [])) {
        const x = Array.isArray(c) ? c[0] : c.x, z = Array.isArray(c) ? c[1] : c.z;
        if (x == null || z == null) continue;
        const ter = (Array.isArray(c) ? c[2] : c.terrain) || 'grass';
        const k = Array.isArray(c) ? c[3] : c.kind;
        out.push(k ? [x, z, ter, k] : [x, z, ter]);
        if (out.length >= 1500) break;
      }
      return out;
    }

    class Bot {
      constructor(def, index) {
        this.name = def.name;
        this.color = def.color;
        this.chatOffset = def.chatOffset;
        this.avatarSpec = def.avatarSpec;
        this.rng = makePrng(index * 0x9e3779b9 + 0x6c62272e);
        this.socket = null;
        this.connected = false;
        this.gridSize = 8;
        this.x = 0; this.z = 0;
        this.moveTimer = null;
        this.chatTimer = null;
        this.chatIndex = def.chatOffset;
      }

      connect(world) {
        const slug = (world && world.slug) || 'unknown';
        const pk = 'bot-' + this.name.toLowerCase() + '-' + Math.floor(this.rng() * 0xffffff).toString(16);
        const url = wsBase() + '/party/' + encodeURIComponent('world-' + slug) + '?_pk=' + encodeURIComponent(pk);
        try { this.socket = new WebSocket(url); } catch (_) { return; }

        this.socket.addEventListener('open', () => {
          this.connected = true;
          const joinMsg = {
            type: 'world.join', token: '', worldId: world && world.id, name: this.name, color: this.color,
            role: 'play', profileId: 'bot:' + this.name.toLowerCase(),
            gridSize: (world && world.gridSize) || 8,
            cells: compactCells(world && world.data && world.data.cells),
            taxPercent: world && world.taxPercent,
            ownerProfileId: world && world.ownerProfileId,
            avatar: botAvatar(this.avatarSpec), // distinct networked voxel look per bot
          };
          this.send(joinMsg);
        });

        this.socket.addEventListener('message', (e) => {
          let d; try { d = JSON.parse(e.data); } catch (_) { return; }
          if (d.type === 'world.state') {
            if (d.gridSize) this.gridSize = d.gridSize;
            // Read authoritative spawn position. world.state sends you:{x,z,hearts,role}
            // (NOT you.cursor); reading .cursor left bots at a random, server-rejected
            // position so they never moved or appeared as peers. Read x/z, fall back to
            // .cursor (presence shape), then random.
            const you = d.you || {};
            const sx = (you.x != null) ? you.x : (you.cursor && you.cursor.x);
            const sz = (you.z != null) ? you.z : (you.cursor && you.cursor.z);
            if (sx != null && sz != null) { this.x = sx; this.z = sz; }
            else { this.x = Math.floor(this.rng() * this.gridSize); this.z = Math.floor(this.rng() * this.gridSize); }
            this.scheduleMove();
            this.scheduleChat();
          }
        });

        this.socket.addEventListener('close', () => { this.connected = false; });
      }

      disconnect() {
        clearTimeout(this.moveTimer);
        clearTimeout(this.chatTimer);
        this.moveTimer = null; this.chatTimer = null;
        if (this.socket) { try { this.socket.close(); } catch (_) {} this.socket = null; }
        this.connected = false;
      }

      send(obj) {
        if (this.socket && this.socket.readyState === 1) this.socket.send(JSON.stringify(obj));
      }

      scheduleMove() {
        const delay = 900 + Math.floor(this.rng() * 2100);
        this.moveTimer = setTimeout(() => {
          if (!this.connected) return;
          // Pick a random adjacent direction; clamp to grid.
          const dir = DIRS[Math.floor(this.rng() * DIRS.length)];
          const nx = Math.max(0, Math.min(this.gridSize - 1, this.x + dir[0]));
          const nz = Math.max(0, Math.min(this.gridSize - 1, this.z + dir[1]));
          if (nx !== this.x || nz !== this.z) {
            this.x = nx; this.z = nz;
            this.send({ type: 'move', x: nx, z: nz });
          }
          this.scheduleMove();
        }, delay);
      }

      scheduleChat() {
        // 12-25 second intervals, offset per bot so they don't all talk at once.
        const baseDelay = 12000 + this.chatOffset * 1200;
        const delay = baseDelay + Math.floor(this.rng() * 13000);
        this.chatTimer = setTimeout(() => {
          if (!this.connected) return;
          const line = CHAT_LINES[this.chatIndex % CHAT_LINES.length];
          this.chatIndex++;
          this.send({ type: 'chat', text: line });
          this.scheduleChat();
        }, delay);
      }
    }

    let activeBots = [];

    on('enter', (d) => {
      // Canned-line bots are RETIRED: the LLM-driven AI bot-runner (tools/ai-bots.mjs)
      // is the real path now. These no longer auto-spawn (they were masquerading as the
      // AI bots and ignoring @mentions). Set window.__tinyworldCannedBots = true to revive.
      if (window.__tinyworldCannedBots !== true) return;
      const world = d && d.world;
      if (!world) return;
      activeBots.forEach(b => b.disconnect());
      activeBots = BOT_DEFS.map((def, i) => new Bot(def, i));
      // Stagger joins: 1.2s, 1.8s, 2.4s after the real player
      activeBots.forEach((bot, i) => setTimeout(() => bot.connect(world), 1200 + i * 600));
    });

    on('leave', () => {
      activeBots.forEach(b => b.disconnect());
      activeBots = [];
    });

    // Expose for debugging: window.__tinyworldWorlds.devBots()
    WS.devBots = () => activeBots.map(b => ({ name: b.name, connected: b.connected, x: b.x, z: b.z }));
  })();
