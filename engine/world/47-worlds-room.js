  // Worlds MMO — published-world room client. Connects to the authoritative
  // PartyKit room ('world-<slug>'), keeps the local mirror of you / peers / nodes /
  // animals, renders a 2D minimap, and turns input into server-validated move /
  // harvest requests. The 3D scene shows the world's tiles via applyState().
  //
  // Exposes window.__tinyworldWorlds.enterRoom/leaveRoom/harvest + a tiny event
  // emitter the HUD (48) subscribes to. IIFE-wrapped; no globals leak.
  (function wireWorldsRoom() {
    'use strict';
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
  
    const WS = (window.__tinyworldWorlds = window.__tinyworldWorlds || {});
    function T(k, p) { return typeof window.t === 'function' ? window.t(k, p) : k; }
    function toast(m) { if (typeof twToast === 'function') twToast(m); else console.log('[worlds]', m); }
  
    // ---- tiny event emitter ----
    const listeners = {};
    function on(ev, cb) { (listeners[ev] = listeners[ev] || []).push(cb); }
    function emit(ev, data) { (listeners[ev] || []).forEach(cb => { try { cb(data); } catch (_) {} }); }
    WS.on = on;
  
    // ---- room state ----
    let socket = null;
    let world = null;
    let token = '';
    let role = 'observe';
    let gridSize = 8;
    let taxPercent = null;
    let you = { x: 0, z: 0, hearts: 10, role: 'observe' };
    let myId = '';
    const peers = new Map();
    let nodes = {};
    let animals = [];
    let cells = [];           // tile cells for minimap (from world.data)
    let connected = false;
  
    function host() {
      const explicit = window.__TINY_WORLD_PARTYKIT_HOST__ || '';
      const h = String(explicit || '').trim().replace(/\/+$/, '');
      if (h) return h.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return 'ws://localhost:1999';
      return 'wss://tinyworld-shared-building.jasonkneen.partykit.dev';
    }
    function connToken() {
      try {
        let v = localStorage.getItem('tinyworld:multiplayer:client-id');
        if (!v) { v = 'u_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('tinyworld:multiplayer:client-id', v); }
        return v;
      } catch (_) { return 'u_' + Math.random().toString(36).slice(2, 10); }
    }
    function playerName() {
      try { return (localStorage.getItem('tinyworld:multiplayer:name') || '').slice(0, 48) || 'Player'; } catch (_) { return 'Player'; }
    }
  
    function send(obj) { if (socket && socket.readyState === 1) socket.send(JSON.stringify(obj)); }

    // Compact [x,z,terrain,kind?] tuples — small enough for the join envelope and
    // exactly what the server's deriveWorldState() consumes to seed nodes.
    function compactCells(data) {
      const out = [];
      const cs = (data && Array.isArray(data.cells)) ? data.cells : [];
      for (const c of cs) {
        const x = Array.isArray(c) ? c[0] : c.x, z = Array.isArray(c) ? c[1] : c.z;
        if (x == null || z == null) continue;
        const ter = (Array.isArray(c) ? c[2] : c.terrain) || 'grass';
        const k = Array.isArray(c) ? c[3] : c.kind;
        out.push(k ? [x, z, ter, k] : [x, z, ter]);
        if (out.length >= 1500) break;
      }
      return out;
    }

    let stateTimer = null, sawWorldState = false;
    function enterRoom(w, joinToken, joinRole) {
      leaveRoom();
      world = w; token = joinToken || ''; role = joinRole || 'observe';
      gridSize = w.gridSize || 8; taxPercent = w.taxPercent != null ? w.taxPercent : null;
      cells = w.data && Array.isArray(w.data.cells) ? w.data.cells : [];
      rebuildBlocked();
      if (w.data && typeof applyState === 'function') { try { applyState(w.data); } catch (_) {} }
      // One map: hide the builder's own minimap, and lock out builder tools.
      hideBaseMinimap(true);
      if (typeof WS.setPlayChrome === 'function') WS.setPlayChrome(true);
      emit('enter', { world: w, role });
      const roomId = 'world-' + w.slug;
      const url = host() + '/party/' + encodeURIComponent(roomId) + '?_pk=' + encodeURIComponent(connToken());
      try { socket = new WebSocket(url); } catch (_) { toast(T('worlds.error')); return; }
      sawWorldState = false;
      socket.addEventListener('open', () => {
        connected = true;
        send({
          type: 'world.join', token, worldId: w.id, name: playerName(), avatarId: myAvatarId(),
          role, profileId: (WS.myProfileId != null ? WS.myProfileId : null),
          gridSize, cells: compactCells(w.data), taxPercent: w.taxPercent, ownerProfileId: w.ownerProfileId,
        });
        emit('status', { connected: true });
        // If the room never answers with world.state, it's an un-upgraded server.
        if (stateTimer) clearTimeout(stateTimer);
        stateTimer = setTimeout(() => { if (!sawWorldState) { toast(T('worlds.serverOld')); WS.leaveRoom(); } }, 4000);
      });
      socket.addEventListener('close', () => { connected = false; emit('status', { connected: false }); });
      socket.addEventListener('message', (e) => { const d = safeParse(e.data); if (d) onMessage(d); });
      bindInput();
      showMinimap();
      startAvatars();
      maybePromptAvatar();
    }
    WS.enterRoom = enterRoom;
  
    function leaveRoom() {
      cancelWalk();
      stopAvatars();
      if (socket) { try { socket.close(); } catch (_) {} socket = null; }
      connected = false; peers.clear(); nodes = {}; animals = [];
      unbindInput(); hideMinimap();
      hideBaseMinimap(false);
      if (typeof WS.setPlayChrome === 'function') WS.setPlayChrome(false);
      emit('leave', {});
    }

    // Hide/restore the builder's own minimap so there's a single in-world map.
    let baseMapEl = null, baseMapPrevDisplay = '';
    function hideBaseMinimap(hide) {
      baseMapEl = baseMapEl || document.getElementById('minimap-wrap');
      if (!baseMapEl) return;
      if (hide) { baseMapPrevDisplay = baseMapEl.style.display; baseMapEl.style.display = 'none'; }
      else { baseMapEl.style.display = baseMapPrevDisplay || ''; }
    }
    WS.leaveRoom = function () {
      leaveRoom();
      if (typeof WS.restoreFreeform === 'function') WS.restoreFreeform();
    };
  
    function safeParse(s) { try { return JSON.parse(s); } catch (_) { return null; } }
  
    function onMessage(d) {
      switch (d.type) {
        case 'welcome':
          myId = d.id || myId; role = d.role || role; emit('status', { connected: true, role });
          // An upgraded world server flags the welcome; an old collab server does
          // not — bail out so the minimap/HUD don't linger over the builder.
          if (d.world !== true) { sawWorldState = true; toast(T('worlds.serverOld')); WS.leaveRoom(); }
          break;
        case 'world.state':
          sawWorldState = true;
          gridSize = d.gridSize || gridSize; taxPercent = d.taxPercent != null ? d.taxPercent : taxPercent;
          you = Object.assign(you, d.you || {});
          nodes = d.nodes || {}; animals = d.animals || [];
          peers.clear(); (d.peers || []).forEach(p => { if (p.id && p.id !== myId) peers.set(p.id, p); });
          role = (d.you && d.you.role) || role;
          emit('state', snapshot()); drawMinimap(); updateSelfAvatar(); updatePeerAvatars(); break;
        case 'presence': {
          const p = d.presence; if (!p || !p.id) break;
          if (p.id === myId) {
            // Our own presence echo carries the authoritative position + hearts.
            if (p.cursor) { you.x = p.cursor.x; you.z = p.cursor.z; }
            if (p.hearts != null) you.hearts = p.hearts;
            emit('you', you); updateSelfAvatar();
          } else {
            peers.set(p.id, p);
            emit('peers', Array.from(peers.values())); updatePeerAvatars();
          }
          drawMinimap(); break;
        }
        case 'leave': peers.delete(d.id); emit('peers', Array.from(peers.values())); updatePeerAvatars(); drawMinimap(); break;
        case 'node.update': if (d.node && d.node.id) { if (d.node.gone) delete nodes[d.node.id]; else nodes[d.node.id] = d.node; emit('nodes', nodes); drawMinimap(); } break;
        case 'animal.spawn': if (d.animal) { animals.push(d.animal); drawMinimap(); } break;
        case 'animal.remove': animals = animals.filter(a => a.id !== d.id); drawMinimap(); break;
        case 'harvest.progress': if (d.hearts != null) { you.hearts = d.hearts; emit('you', you); } emit('progress', d); break;
        case 'harvest.result':
          if (d.hearts != null) { you.hearts = d.hearts; emit('you', you); }
          emit('result', d);
          // Track local resource counts for the HUD (server is the bank of record).
          addLocalResource(d.resource, Math.floor((d.harvesterMilli || 0) / 1000));
          break;
        case 'harvest.deny': emit('deny', d); break;
        case 'chat': emit('chat', d); if (d && d.text != null) showChatBubble(d.id, d.text); break;
        case 'chat.typing': emit('typing', d); break;
        default: break;
      }
    }
  
    // Local optimistic resource tally (whole units). The authoritative balance is
    // in Postgres; this just gives the HUD immediate feedback.
    const localRes = { fish: 0, meat: 0, plants: 0, ore: 0 };
    function addLocalResource(r, n) { if (localRes[r] != null && n > 0) { localRes[r] += n; emit('resources', Object.assign({}, localRes)); } }
    WS.getResources = () => Object.assign({}, localRes);
  
    function myPresencePos() {
      // The server tracks our position and broadcasts it in presence.cursor; mirror
      // it from the latest 'you' we last saw plus presence echoes.
      return { x: you.x, z: you.z };
    }
  
    function snapshot() {
      return { world, role, gridSize, taxPercent, you, peers: Array.from(peers.values()), nodes, animals };
    }
    WS.getState = snapshot;
  
    // ---- movement + click-to-walk pathfinding ----
    const BLOCKED_KINDS = new Set(['house', 'tree', 'rock', 'fence', 'bush', 'voxel-build', 'model-stamp']);
    let blocked = new Set();   // 'x,z' cells you cannot stand on (mirrors server)
    function rebuildBlocked() {
      blocked = new Set();
      for (const c of cells) {
        const x = Array.isArray(c) ? c[0] : c.x, z = Array.isArray(c) ? c[1] : c.z;
        if (x == null || z == null) continue;
        const ter = Array.isArray(c) ? c[2] : c.terrain, k = Array.isArray(c) ? c[3] : c.kind;
        if (ter === 'water' || ter === 'lava' || ter === 'stone' || (k && BLOCKED_KINDS.has(k))) blocked.add(x + ',' + z);
      }
    }
    function standable(x, z) { return x >= 0 && z >= 0 && x < gridSize && z < gridSize && !blocked.has(x + ',' + z); }

    function step(dx, dz) {
      const nx = Math.max(0, Math.min(gridSize - 1, you.x + dx));
      const nz = Math.max(0, Math.min(gridSize - 1, you.z + dz));
      if (nx === you.x && nz === you.z) return;
      if (!standable(nx, nz)) return;
      you.x = nx; you.z = nz;       // optimistic; server presence will correct
      send({ type: 'move', x: nx, z: nz });
      emit('you', you); drawMinimap(); updateSelfAvatar();
    }

    // BFS over standable cells; returns the ordered list of steps to (tx,tz).
    function findPath(tx, tz) {
      if (!standable(tx, tz)) return null;
      const start = you.x + ',' + you.z, goal = tx + ',' + tz;
      if (start === goal) return [];
      const q = [[you.x, you.z]]; const prev = new Map([[start, null]]); let head = 0;
      while (head < q.length) {
        const [x, z] = q[head++];
        if (x + ',' + z === goal) break;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz, nk = nx + ',' + nz;
          if (prev.has(nk) || !standable(nx, nz)) continue;
          prev.set(nk, x + ',' + z); q.push([nx, nz]);
        }
      }
      if (!prev.has(goal)) return null;
      const path = []; let cur = goal;
      while (cur && cur !== start) { const [x, z] = cur.split(',').map(Number); path.push([x, z]); cur = prev.get(cur); }
      return path.reverse();
    }
    let walkTimer = null;
    function cancelWalk() { if (walkTimer) { clearTimeout(walkTimer); walkTimer = null; } }
    function walkTo(tx, tz) {
      cancelWalk();
      const path = findPath(tx, tz);
      if (!path || !path.length) return;
      let i = 0;
      const next = () => {
        if (i >= path.length) { walkTimer = null; return; }
        const [nx, nz] = path[i++];
        you.x = nx; you.z = nz; send({ type: 'move', x: nx, z: nz }); emit('you', you); drawMinimap(); updateSelfAvatar();
        walkTimer = setTimeout(next, 170);
      };
      next();
    }
  
    // ---- harvest ----
    function nodeKindToAction(type) { return type === 'fish' ? 'fish' : type === 'ore' ? 'mine' : 'gather'; }
    function reach(a, b) { return Math.abs(a.x - b.x) <= 1 && Math.abs(a.z - b.z) <= 1; }
    function nodeCellPos(n) { if (!n.cell) return null; const p = n.cell.split(',').map(Number); return { x: p[0], z: p[1] }; }
  
    // Find an in-reach node/animal that matches `action` and request a harvest.
    function harvest(action) {
      cancelWalk();
      if (role !== 'play') { toast(T('worlds.observing')); return; }
      if (action === 'hunt') {
        const a = animals.find(an => reach(you, an));
        if (!a) { toast(T('worlds.actionHunt') + ' — no animal nearby'); return; }
        send({ type: 'harvest.start', action: 'hunt', animalId: a.id }); return;
      }
      for (const id of Object.keys(nodes)) {
        const n = nodes[id];
        if (!n || nodeKindToAction(n.type) !== action) continue;
        const pos = nodeCellPos(n);
        if (!pos || !reach(you, pos)) continue;
        if ((n.charges || 0) < 1 || n.locked) continue;
        send({ type: 'harvest.start', action, x: pos.x, z: pos.z }); return;
      }
      toast('No ' + action + ' node in reach');
    }
    WS.harvest = harvest;
    WS.sendChat = (text) => { const t2 = String(text || '').slice(0, 280).trim(); if (t2) send({ type: 'chat', text: t2 }); };
  
    // ---- input ----
    function onKey(e) {
      if (!connected) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      let handled = true;
      const k = e.key.toLowerCase();
      // Movement is relative to the camera/player view (his up/down/left/right).
      if (k === 'arrowup' || k === 'w') { cancelWalk(); const [x, z] = worldStepFromScreen(0, 1); step(x, z); }
      else if (k === 'arrowdown' || k === 's') { cancelWalk(); const [x, z] = worldStepFromScreen(0, -1); step(x, z); }
      else if (k === 'arrowleft' || k === 'a') { cancelWalk(); const [x, z] = worldStepFromScreen(-1, 0); step(x, z); }
      else if (k === 'arrowright' || k === 'd') { cancelWalk(); const [x, z] = worldStepFromScreen(1, 0); step(x, z); }
      else if (k === ' ' || k === 'spacebar') startJump();
      else if (k === ATTACK_KEY) startAttack();
      else handled = false;
      if (handled) e.preventDefault();
    }
    function bindInput() { window.addEventListener('keydown', onKey); }
    function unbindInput() { window.removeEventListener('keydown', onKey); }
  
    // ---- minimap ----
    let mapWrap = null, canvas = null, ctx = null;
    const CELL = 16;
    function showMinimap() {
      if (mapWrap) { mapWrap.style.display = 'block'; drawMinimap(); return; }
      if (!document.getElementById('tw-worlds-map-style')) {
        const css = '.tw-worlds-map{position:fixed;right:12px;top:72px;z-index:65;background:#0c1424dd;border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:8px;box-shadow:0 10px 28px -10px rgba(0,0,0,.5)}'
          + '.tw-worlds-map h4{margin:0 0 6px;font:600 11px system-ui;color:#cfe0ff;text-transform:uppercase;letter-spacing:.05em;cursor:grab;user-select:none;display:flex;align-items:center;gap:6px}'
          + '.tw-worlds-map.dragging h4{cursor:grabbing}'
          + '.tw-worlds-map canvas{display:block;border-radius:6px;cursor:pointer;background:#13243f}';
        document.head.appendChild(Object.assign(document.createElement('style'), { id: 'tw-worlds-map-style', textContent: css }));
      }
      mapWrap = document.createElement('div'); mapWrap.className = 'tw-worlds-map';
      const h = document.createElement('h4'); h.textContent = T('worlds.minimap');
      canvas = document.createElement('canvas');
      canvas.addEventListener('click', onMapClick);
      mapWrap.appendChild(h); mapWrap.appendChild(canvas);
      document.body.appendChild(mapWrap);
      restoreMapPos();
      makeMapDraggable(h);
      ctx = canvas.getContext('2d');
      drawMinimap();
    }
    function hideMinimap() { if (mapWrap) mapWrap.style.display = 'none'; }

    function restoreMapPos() {
      try {
        const saved = JSON.parse(localStorage.getItem('tinyworld:worlds.map.pos') || 'null');
        if (saved && saved.left && saved.top) { mapWrap.style.left = saved.left; mapWrap.style.top = saved.top; mapWrap.style.right = 'auto'; mapWrap.style.bottom = 'auto'; }
      } catch (_) {}
    }
    function makeMapDraggable(handle) {
      let sx = 0, sy = 0, ox = 0, oy = 0, drag = false;
      handle.addEventListener('pointerdown', (e) => {
        drag = true; mapWrap.classList.add('dragging');
        try { handle.setPointerCapture(e.pointerId); } catch (_) {}
        const r = mapWrap.getBoundingClientRect(); ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
        mapWrap.style.right = 'auto'; mapWrap.style.bottom = 'auto'; mapWrap.style.left = ox + 'px'; mapWrap.style.top = oy + 'px';
        e.preventDefault();
      });
      handle.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const nx = Math.max(0, Math.min(window.innerWidth - 60, ox + e.clientX - sx));
        const ny = Math.max(0, Math.min(window.innerHeight - 40, oy + e.clientY - sy));
        mapWrap.style.left = nx + 'px'; mapWrap.style.top = ny + 'px';
      });
      const end = () => {
        if (!drag) return; drag = false; mapWrap.classList.remove('dragging');
        try { localStorage.setItem('tinyworld:worlds.map.pos', JSON.stringify({ left: mapWrap.style.left, top: mapWrap.style.top })); } catch (_) {}
      };
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    }
  
    function onMapClick(e) {
      const rect = canvas.getBoundingClientRect();
      const cx = Math.floor((e.clientX - rect.left) / CELL);
      const cz = Math.floor((e.clientY - rect.top) / CELL);
      if (cx < 0 || cz < 0 || cx >= gridSize || cz >= gridSize) return;
      // Walk (auto-path) to the clicked tile; the server still validates each
      // one-cell step. Arrow/WASD keys interrupt the walk.
      walkTo(cx, cz);
    }
  
    function terrainColor(t) {
      return t === 'water' ? '#2f6fb0' : t === 'stone' ? '#7d8794' : t === 'sand' ? '#cdb98a'
        : t === 'dirt' ? '#7a5a3a' : t === 'path' ? '#b9a06a' : t === 'lava' ? '#c0431f' : t === 'snow' ? '#e6eef6' : '#3f8f53';
    }

    // Shared top-down tile preview (used by the universe cards in 46). Draws the
    // grass base, terrain tiles, and a small marker for harvestable objects.
    const PREVIEW_PLANTS = new Set(['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower']);
    function renderPreview(cnv, preview) {
      if (!cnv || !preview) return;
      const g = Math.max(1, preview.gridSize || 8);
      const list = Array.isArray(preview.cells) ? preview.cells : [];
      const px = cnv.width || 200;
      const cell = Math.max(2, Math.floor(px / g));
      cnv.width = cell * g; cnv.height = cell * g;
      const c2 = cnv.getContext('2d');
      c2.fillStyle = '#3f8f53'; c2.fillRect(0, 0, cnv.width, cnv.height);
      const dot = (x, z, color) => { c2.fillStyle = color; c2.beginPath(); c2.arc(x * cell + cell / 2, z * cell + cell / 2, Math.max(1, cell * 0.26), 0, 7); c2.fill(); };
      for (const c of list) {
        const x = c[0], z = c[1], ter = c[2], kind = c[3];
        if (x == null || z == null || x < 0 || z < 0 || x >= g || z >= g) continue;
        c2.fillStyle = terrainColor(ter); c2.fillRect(x * cell, z * cell, cell, cell);
        if (kind === 'tree' || kind === 'bush') dot(x, z, '#1f6f3a');
        else if (PREVIEW_PLANTS.has(kind)) dot(x, z, '#d8e85a');
        else if (kind === 'cow' || kind === 'sheep') dot(x, z, '#f0c8a8');
      }
    }
    WS.renderPreview = renderPreview;

    // ---- in-world avatars: 3D character models (models/people/*.glb) ----
    // Each player picks a character; the choice is remembered. The models carry no
    // animation clips, so motion (facing, walk bob, idle breathe, jump) is procedural.
    // Every model is normalized to one height so different characters read at a
    // consistent size regardless of their source scale.
    const AVATARS = [
      { id: 'warrior', label: 'Warrior', url: 'models/people/warrior_hytale.glb' },
      { id: 'kozak',   label: 'Kozak',   url: 'models/people/kozak_hytale.glb' },
      { id: 'stepan',  label: 'Stepan',  url: 'models/people/stepan_hytale.glb' },
      { id: 'cartoon', label: 'Hero',    url: 'models/people/cartoon_guy.glb' },
      { id: 'optimus', label: 'Optimus', url: 'models/people/optimus.glb' },
      { id: 'robot',   label: 'Robot',   url: 'models/people/robot.glb' },
    ];
    const DEFAULT_AVATAR = 'warrior';
    const AVATAR_LS = 'tinyworld:worlds:avatarId';
    const AVATAR_TARGET_H = 1.7;      // world-units; all avatars normalized to this height
    const AVATAR_FORWARD_OFFSET = 0;  // radians — adjust if a model faces the wrong way
    const JUMP_MS = 460, ATTACK_KEY = 'f';
    let selfEnt = null;
    const peerEnts = new Map();
    let avatarRaf = null;
    let _gltfLoader = null;
    const _modelCache = new Map();    // url -> Promise<Object3D template>

    function avatarParent() {
      if (typeof worldGroup !== 'undefined' && worldGroup) return worldGroup;
      if (typeof xrWorldRoot !== 'undefined' && xrWorldRoot) return xrWorldRoot;
      return (typeof scene !== 'undefined') ? scene : null;
    }
    function hashId(s) { s = String(s); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
    function dirSector(dx, dz) { if (!dx && !dz) return null; return ((Math.round(Math.atan2(dx, dz) / (Math.PI / 4)) % 8) + 8) % 8; }
    // Camera-relative ground axes from the orbit azimuth (a classic-script global).
    function camGround() {
      const az = (typeof azimuth === 'number') ? azimuth : 0;
      return { f: { x: -Math.cos(az), z: -Math.sin(az) }, r: { x: Math.sin(az), z: -Math.cos(az) } };
    }
    // Facing relative to the player's view: rotate a world delta into screen space so
    // S = toward the camera, N = away, E = his right, W = his left.
    function screenSector(dx, dz) {
      const { f, r } = camGround();
      return dirSector(dx * r.x + dz * r.z, -(dx * f.x + dz * f.z));
    }
    // Screen input (right=+x, forward=+y) -> the single grid step that best matches it.
    function worldStepFromScreen(sxi, syi) {
      const { f, r } = camGround();
      const wx = r.x * sxi + f.x * syi, wz = r.z * sxi + f.z * syi;
      return (Math.abs(wx) >= Math.abs(wz)) ? [Math.sign(wx), 0] : [0, Math.sign(wz)];
    }
    function startJump() { if (selfEnt && !selfEnt.jumpStart) selfEnt.jumpStart = Date.now(); }
    function startAttack() { startJump(); }  // models carry no attack clip; the hop is the action feedback

    function avatarById(id) { return AVATARS.find(a => a.id === id) || AVATARS[0]; }
    function myAvatarId() { try { return localStorage.getItem(AVATAR_LS) || DEFAULT_AVATAR; } catch (_) { return DEFAULT_AVATAR; } }
    function setMyAvatarId(id) { try { localStorage.setItem(AVATAR_LS, id); } catch (_) {} }
    // Until the server relays each peer's choice, give every peer a stable model by id.
    function peerAvatarId(p) {
      if (p && typeof p.avatarId === 'string' && AVATARS.some(a => a.id === p.avatarId)) return p.avatarId;
      return AVATARS[hashId(String((p && p.id) || '')) % AVATARS.length].id;
    }
    function gltfLoader() {
      if (_gltfLoader) return _gltfLoader;
      if (typeof THREE === 'undefined' || !THREE.GLTFLoader) return null;
      _gltfLoader = new THREE.GLTFLoader();
      if (THREE.DRACOLoader && typeof _gltfLoader.setDRACOLoader === 'function') {
        const d = new THREE.DRACOLoader(); d.setDecoderPath('vendor/three/draco/');
        _gltfLoader.setDRACOLoader(d);
      }
      return _gltfLoader;
    }
    function loadAvatarTemplate(url) {
      if (_modelCache.has(url)) return _modelCache.get(url);
      const p = new Promise((resolve) => {
        const loader = gltfLoader();
        if (!loader) { resolve(null); return; }
        loader.load(url, (gltf) => {
          resolve((gltf && (gltf.scene || (gltf.scenes && gltf.scenes[0]))) || null);
        }, undefined, () => { try { console.error('[worlds] avatar model failed:', url); } catch (_) {} resolve(null); });
      });
      _modelCache.set(url, p);
      return p;
    }
    // Clone a template and normalize it: base at y=0, centered in x/z, scaled so its
    // height is AVATAR_TARGET_H. This is the per-character size normalization.
    function buildAvatarObject(template) {
      const inner = template.clone(true);
      inner.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(inner);
      const size = new THREE.Vector3(); box.getSize(size);
      const center = new THREE.Vector3(); box.getCenter(center);
      const scale = AVATAR_TARGET_H / Math.max(size.y, 0.01);
      inner.position.set(-center.x, -box.min.y, -center.z);
      const scaler = new THREE.Group(); scaler.add(inner); scaler.scale.setScalar(scale);
      const obj = new THREE.Group(); obj.add(scaler);
      obj.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
      return obj;
    }
    function createAvatar(avatarId) {
      const ent = {
        x: 0, z: 0, lastMove: 0, jumpStart: 0, bobT: 0,
        yaw: 0, targetYaw: 0, height: AVATAR_TARGET_H,
        avatarId: avatarId || DEFAULT_AVATAR, obj: null, disposed: false, bubble: null,
      };
      if (typeof THREE === 'undefined') return ent;
      loadAvatarTemplate(avatarById(ent.avatarId).url).then((tpl) => {
        if (ent.disposed || !tpl) return;
        ent.obj = buildAvatarObject(tpl);
        ent.obj.rotation.y = ent.yaw;
        const par = avatarParent(); if (par) par.add(ent.obj);
        placeEntity(ent);
      });
      return ent;
    }
    function placeEntity(ent) {
      if (!ent || !ent.obj || typeof tilePos !== 'function') return;
      const p = tilePos(ent.x, ent.z);
      ent.obj.position.set(p.x, ent.obj.position.y || 0, p.z);
    }
    function moveEntity(ent, x, z) {
      if (!ent) return;
      const dx = x - ent.x, dz = z - ent.z;
      if (dx || dz) { ent.lastMove = Date.now(); ent.targetYaw = Math.atan2(dx, dz) + AVATAR_FORWARD_OFFSET; }
      ent.x = x; ent.z = z; placeEntity(ent);
    }
    function disposeEntity(ent) {
      if (!ent) return; ent.disposed = true;
      removeBubble(ent);
      // Clones share geometry/materials with the cached template — just detach.
      if (ent.obj && ent.obj.parent) ent.obj.parent.remove(ent.obj);
    }
    function animEntity(ent, dt) {
      if (!ent.obj) { updateBubble(ent); return; }
      // Smoothly turn to face the last movement direction.
      let dyaw = ent.targetYaw - ent.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      ent.yaw += dyaw * Math.min(1, dt * 12);
      ent.obj.rotation.y = ent.yaw;
      // Procedural motion (no animation clips in the models): walk bob or idle breathe.
      const moving = (Date.now() - ent.lastMove) < 240;
      ent.bobT += dt * (moving ? 9 : 2.2);
      let y = moving ? Math.abs(Math.sin(ent.bobT)) * 0.12 : Math.sin(ent.bobT) * 0.03;
      if (ent.jumpStart) { const jt = (Date.now() - ent.jumpStart) / JUMP_MS; if (jt >= 1) ent.jumpStart = 0; else y += Math.sin(jt * Math.PI) * 0.8; }
      ent.obj.position.y = y;
      const scaler = ent.obj.children[0];
      if (scaler) scaler.rotation.x = moving ? Math.sin(ent.bobT * 2) * 0.035 : 0;
      updateBubble(ent);
    }

    // ---- speech bubbles: a chat line shown above an avatar in an 8-bit pixel
    // font (Press Start 2P, vendored). Rendered to a CanvasTexture on a billboard
    // sprite so it always faces the camera and rides the jump arc. Auto-fades. ----
    const BUBBLE_FONT = "'Press Start 2P'";
    const BUBBLE_MS = 5200;        // visible before fade
    const BUBBLE_FADE_MS = 700;    // fade-out tail
    const BUBBLE_MAX_CHARS = 90;   // cap the shown text
    const BUBBLE_HEAD_Y = 1.55;    // world-units above the avatar's feet
    let bubbleFontReady = false;
    (function preloadBubbleFont() {
      try {
        if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
          document.fonts.load('16px ' + BUBBLE_FONT).then(() => {
            bubbleFontReady = true;
            // Re-render any live bubble that was drawn with the fallback font.
            const redraw = (e) => { if (e && e.bubble && e.bubble.text != null) renderBubble(e, e.bubble.text); };
            if (selfEnt) redraw(selfEnt);
            peerEnts.forEach(redraw);
          }).catch(() => {});
        }
      } catch (_) {}
    })();

    function roundRectPath(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    function wrapBubbleLines(ctx, text, maxW) {
      const words = String(text).split(/\s+/).filter(Boolean);
      const lines = []; let line = '';
      for (const w of words) {
        const probe = line ? line + ' ' + w : w;
        if (ctx.measureText(probe).width > maxW && line) { lines.push(line); line = w; }
        else line = probe;
        if (lines.length >= 4) break;   // cap height at 4 lines
      }
      if (line && lines.length < 4) lines.push(line);
      return lines.length ? lines : [String(text)];
    }
    function renderBubble(ent, text) {
      if (!ent || !ent.bubble || typeof THREE === 'undefined') return;
      const S = 3;                 // device px per logical px (keeps the pixels crisp)
      const FS = 9 * S, LH = 15 * S, PAD = 9 * S, TAIL = 9 * S, MAXW = 150 * S, R = 7 * S, LW = 2 * S;
      const font = FS + "px " + BUBBLE_FONT + ", 'Courier New', monospace";
      const cv = ent.bubble.canvas, ctx = cv.getContext('2d');
      ctx.font = font;
      const lines = wrapBubbleLines(ctx, text, MAXW);
      let textW = 0; for (const l of lines) textW = Math.max(textW, ctx.measureText(l).width);
      const cw = Math.ceil(textW) + PAD * 2;
      const bodyH = lines.length * LH + PAD * 2;
      const ch = bodyH + TAIL;
      cv.width = cw; cv.height = ch;
      // Resizing the canvas resets the context state; re-set the font.
      ctx.font = font; ctx.textBaseline = 'top';
      ctx.clearRect(0, 0, cw, ch);
      ctx.fillStyle = '#fdfcf7'; ctx.strokeStyle = '#1b2a4a'; ctx.lineWidth = LW;
      roundRectPath(ctx, LW, LW, cw - LW * 2, bodyH - LW * 2, R);
      ctx.fill(); ctx.stroke();
      const cx = cw / 2;           // downward tail at center
      ctx.beginPath();
      ctx.moveTo(cx - TAIL, bodyH - LW);
      ctx.lineTo(cx + TAIL, bodyH - LW);
      ctx.lineTo(cx, bodyH - LW + TAIL);
      ctx.closePath();
      ctx.fillStyle = '#fdfcf7'; ctx.fill();
      ctx.strokeStyle = '#1b2a4a'; ctx.stroke();
      ctx.fillStyle = '#1b2a4a';
      for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], PAD, PAD + i * LH);
      if (ent.bubble.texture) ent.bubble.texture.dispose();
      const tex = new THREE.CanvasTexture(cv);
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      else if ('encoding' in tex && THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
      tex.needsUpdate = true;
      ent.bubble.sprite.material.map = tex;
      ent.bubble.sprite.material.needsUpdate = true;
      ent.bubble.texture = tex;
      const K = 0.011;             // logical px -> world units
      ent.bubble.sprite.scale.set((cw / S) * K, (ch / S) * K, 1);
    }
    function showChatBubble(id, rawText) {
      let text = String(rawText == null ? '' : rawText).trim();
      if (!text) return;
      if (text.length > BUBBLE_MAX_CHARS) text = text.slice(0, BUBBLE_MAX_CHARS - 1).trimEnd() + '…';
      const ent = (id != null && id === myId) ? selfEnt : (peerEnts ? peerEnts.get(id) : null);
      if (!ent) return;  // no such avatar — drop silently
      if (!ent.bubble) {
        if (typeof THREE === 'undefined') return;
        const canvas = document.createElement('canvas');
        const mat = new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false });
        const sprite = new THREE.Sprite(mat);
        sprite.center.set(0.5, 0);     // anchor at the tail tip; grows upward
        sprite.renderOrder = 12;       // above avatars (renderOrder 10)
        const par = avatarParent(); if (par) par.add(sprite);
        ent.bubble = { canvas: canvas, sprite: sprite, texture: null, text: null, start: 0 };
      }
      ent.bubble.text = text;
      ent.bubble.start = Date.now();
      ent.bubble.sprite.visible = true;
      ent.bubble.sprite.material.opacity = 1;
      renderBubble(ent, text);
    }
    function updateBubble(ent) {
      if (!ent || !ent.bubble || !ent.bubble.sprite) return;
      const b = ent.bubble;
      const age = Date.now() - b.start;
      if (age >= BUBBLE_MS) { removeBubble(ent); return; }
      if (ent.obj) {
        const hy = (ent.height || AVATAR_TARGET_H) + 0.25;
        b.sprite.position.set(ent.obj.position.x, ent.obj.position.y + hy, ent.obj.position.z);
      }
      const fadeIn = age > (BUBBLE_MS - BUBBLE_FADE_MS) ? Math.max(0, (BUBBLE_MS - age) / BUBBLE_FADE_MS) : 1;
      b.sprite.material.opacity = fadeIn;
    }
    function removeBubble(ent) {
      if (!ent || !ent.bubble) return;
      const b = ent.bubble; ent.bubble = null;
      if (b.sprite && b.sprite.parent) b.sprite.parent.remove(b.sprite);
      if (b.texture) b.texture.dispose();
      if (b.sprite && b.sprite.material) b.sprite.material.dispose();
    }
    WS.showChatBubble = showChatBubble;

    function updateSelfAvatar() {
      const id = myAvatarId();
      if (!selfEnt) selfEnt = createAvatar(id);
      else if (selfEnt.avatarId !== id) { disposeEntity(selfEnt); selfEnt = createAvatar(id); }
      moveEntity(selfEnt, you.x, you.z);
    }
    function updatePeerAvatars() {
      const seen = new Set();
      peers.forEach((p) => {
        if (!p || p.id == null || p.id === myId) return;   // never draw yourself as a peer
        const pos = p.cursor || p; if (pos.x == null) return;
        seen.add(p.id);
        const wantId = peerAvatarId(p);
        let ent = peerEnts.get(p.id);
        if (!ent || ent.avatarId !== wantId) { if (ent) disposeEntity(ent); ent = createAvatar(wantId); peerEnts.set(p.id, ent); }
        moveEntity(ent, pos.x, pos.z);
      });
      peerEnts.forEach((ent, id) => { if (!seen.has(id)) { disposeEntity(ent); peerEnts.delete(id); } });
    }
    function startAvatars() {
      if (avatarRaf || typeof requestAnimationFrame !== 'function') return;
      let prev = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const tick = () => {
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
        if (selfEnt) animEntity(selfEnt, dt);
        peerEnts.forEach((e) => animEntity(e, dt));
        // Follow camera: ease the orbit target onto the player so he stays centered.
        if (selfEnt && typeof tilePos === 'function' && typeof updateCamera === 'function' && typeof target !== 'undefined' && target) {
          const p = tilePos(selfEnt.x, selfEnt.z);
          target.x += (p.x - target.x) * 0.15;
          target.z += (p.z - target.z) * 0.15;
          updateCamera();
        }
        avatarRaf = requestAnimationFrame(tick);
      };
      avatarRaf = requestAnimationFrame(tick);
    }
    function stopAvatars() {
      if (avatarRaf) { cancelAnimationFrame(avatarRaf); avatarRaf = null; }
      disposeEntity(selfEnt); selfEnt = null;
      peerEnts.forEach((e) => disposeEntity(e)); peerEnts.clear();
    }

    // ---- avatar picker (shown once on first entry; choice remembered) ----
    function mkEl(tag, attrs, kids) {
      const n = document.createElement(tag);
      if (attrs) for (const k in attrs) {
        if (k === 'class') n.className = attrs[k];
        else if (k === 'text') n.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
        else n.setAttribute(k, attrs[k]);
      }
      if (kids) for (const c of [].concat(kids)) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
      return n;
    }
    function injectAvatarStyles() {
      if (document.getElementById('tw-avatar-style')) return;
      const css = ''
        + '.tw-avatar-back{position:fixed;inset:0;z-index:95;display:flex;align-items:center;justify-content:center;background:rgba(6,10,20,.72);backdrop-filter:blur(5px)}'
        + '.tw-avatar-modal{background:#10182b;border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:20px;width:min(520px,92vw);color:#eef3ff;font-family:system-ui,sans-serif}'
        + '.tw-avatar-modal h3{margin:0 0 4px;font-size:18px}'
        + '.tw-avatar-sub{margin:0 0 14px;opacity:.7;font-size:13px}'
        + '.tw-avatar-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}'
        + '.tw-avatar-card{display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 8px;border-radius:12px;cursor:pointer;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#eef3ff;font:600 12px system-ui}'
        + '.tw-avatar-card:hover{background:rgba(255,255,255,.12)}'
        + '.tw-avatar-card.sel{border-color:#4f8cff;box-shadow:0 0 0 2px rgba(79,140,255,.33)}'
        + '.tw-avatar-thumb{width:54px;height:54px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 22px system-ui;color:#fff;background:linear-gradient(135deg,#3a72c8,#7a4fd0)}';
      document.head.appendChild(mkEl('style', { id: 'tw-avatar-style', text: css }));
    }
    function pickAvatar(id) {
      setMyAvatarId(id);
      updateSelfAvatar();
      send({ type: 'avatar', avatarId: id });  // forward-compat: lets a future server relay tell peers
    }
    function showAvatarPicker() {
      if (document.getElementById('tw-avatar-picker')) return;
      injectAvatarStyles();
      const cur = myAvatarId();
      const grid = mkEl('div', { class: 'tw-avatar-grid' });
      let back = null;
      AVATARS.forEach((a) => {
        const card = mkEl('button', {
          type: 'button', class: 'tw-avatar-card' + (a.id === cur ? ' sel' : ''),
          onclick: () => { pickAvatar(a.id); if (back) back.remove(); },
        }, [mkEl('div', { class: 'tw-avatar-thumb', text: a.label.charAt(0) }), mkEl('div', { text: a.label })]);
        grid.appendChild(card);
      });
      back = mkEl('div', { class: 'tw-avatar-back', id: 'tw-avatar-picker' }, [
        mkEl('div', { class: 'tw-avatar-modal' }, [
          mkEl('h3', { text: T('worlds.avatarTitle') }),
          mkEl('p', { class: 'tw-avatar-sub', text: T('worlds.avatarSub') }),
          grid,
        ]),
      ]);
      back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });
      document.body.appendChild(back);
    }
    function maybePromptAvatar() {
      let chosen = false; try { chosen = !!localStorage.getItem(AVATAR_LS); } catch (_) {}
      if (!chosen) showAvatarPicker();
    }
    WS.chooseAvatar = showAvatarPicker;

    function drawMinimap() {
      if (!ctx || !canvas) return;
      canvas.width = gridSize * CELL; canvas.height = gridSize * CELL;
      ctx.fillStyle = '#13243f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      // base grass
      ctx.fillStyle = '#3f8f53'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      // tiles
      for (const c of cells) {
        const x = Array.isArray(c) ? c[0] : c.x, z = Array.isArray(c) ? c[1] : c.z, ter = Array.isArray(c) ? c[2] : c.terrain;
        if (x == null || z == null || x < 0 || z < 0 || x >= gridSize || z >= gridSize) continue;
        ctx.fillStyle = terrainColor(ter); ctx.fillRect(x * CELL, z * CELL, CELL, CELL);
      }
      // nodes
      for (const id of Object.keys(nodes)) {
        const n = nodes[id]; const pos = nodeCellPos(n); if (!pos && n.type !== 'fish') continue;
        const p = pos || null; if (!p) continue;
        ctx.fillStyle = n.charges > 0 ? (n.type === 'ore' ? '#d8c150' : '#9fe0ff') : '#555';
        ctx.beginPath(); ctx.arc(p.x * CELL + CELL / 2, p.z * CELL + CELL / 2, 4, 0, 7); ctx.fill();
      }
      // animals
      ctx.fillStyle = '#f0c0a0';
      for (const a of animals) { ctx.fillRect(a.x * CELL + 4, a.z * CELL + 4, CELL - 8, CELL - 8); }
      // peers
      for (const p of peers.values()) {
        const pos = p.cursor || p; if (pos.x == null) continue;
        ctx.fillStyle = p.color || '#ffd166';
        ctx.beginPath(); ctx.arc(pos.x * CELL + CELL / 2, pos.z * CELL + CELL / 2, 5, 0, 7); ctx.fill();
      }
      // you
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1f6feb'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(you.x * CELL + CELL / 2, you.z * CELL + CELL / 2, 5, 0, 7); ctx.fill(); ctx.stroke();
    }
  })();
