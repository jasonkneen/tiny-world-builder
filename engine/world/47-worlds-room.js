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
          type: 'world.join', token, worldId: w.id, name: playerName(),
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
          peers.clear(); (d.peers || []).forEach(p => { if (p.id) peers.set(p.id, p); });
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
        case 'chat': emit('chat', d); break;
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
      cancelWalk();   // manual key interrupts any auto-walk
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') step(0, -1);
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') step(0, 1);
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') step(-1, 0);
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') step(1, 0);
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

    // ---- in-world avatars: rigged 3D GLB model with a crowd-art sprite fallback ----
    const AVATAR_MODEL_URL = 'models/people/stepan_hytale.glb';
    const AVATAR_SELF = 'man-dad';
    const AVATAR_PEERS = ['little-girl', 'man-grandfather', 'woman-grandmother'];
    const _texCache = {};
    let _texLoader = null;
    let selfEnt = null;
    const peerEnts = new Map();
    let avatarRaf = null;

    function avatarParent() {
      if (typeof worldGroup !== 'undefined' && worldGroup) return worldGroup;
      if (typeof xrWorldRoot !== 'undefined' && xrWorldRoot) return xrWorldRoot;
      return (typeof scene !== 'undefined') ? scene : null;
    }
    function charTex(name, dir) {
      const key = name + '-' + dir;
      if (_texCache[key]) return _texCache[key];
      if (typeof THREE === 'undefined') return null;
      _texLoader = _texLoader || new THREE.TextureLoader();
      let t = null;
      try {
        t = _texLoader.load('crowd/charachters/' + name + '/' + name + '-' + dir + '.png');
        if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
        else if ('encoding' in t && THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
        t.magFilter = THREE.NearestFilter;
      } catch (_) { t = null; }
      _texCache[key] = t;
      return t;
    }
    function makeSprite(name) {
      if (typeof THREE === 'undefined') return null;
      const mat = new THREE.SpriteMaterial({ map: charTex(name, 'down') || null, transparent: true, depthWrite: false });
      const s = new THREE.Sprite(mat); s.scale.set(0.95, 1.35, 1); s.renderOrder = 10;
      s.userData.charName = name;
      const par = avatarParent(); if (par) par.add(s);
      return s;
    }
    function dirFrom(dx, dz) { if (!dx && !dz) return null; if (Math.abs(dx) >= Math.abs(dz)) return dx < 0 ? 'left' : 'right'; return dz < 0 ? 'up' : 'down'; }
    function dirYaw(dir) { return dir === 'up' ? Math.PI : dir === 'left' ? Math.PI / 2 : dir === 'right' ? -Math.PI / 2 : 0; }
    function hashId(s) { s = String(s); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

    function configureGltf(loader) {
      try {
        if (THREE.DRACOLoader && typeof loader.setDRACOLoader === 'function') { const d = new THREE.DRACOLoader(); if (d.setDecoderPath) d.setDecoderPath('vendor/three/draco/'); loader.setDRACOLoader(d); }
        if (typeof MeshoptDecoder !== 'undefined' && MeshoptDecoder && typeof loader.setMeshoptDecoder === 'function') loader.setMeshoptDecoder(MeshoptDecoder);
      } catch (_) {}
      return loader;
    }
    // Load a fresh GLB instance per avatar (no SkeletonUtils available to clone a
    // skinned mesh). Upgrades the entity from its sprite placeholder to the model;
    // on any failure the sprite stays as the fallback.
    function loadModelInto(ent) {
      if (typeof THREE === 'undefined' || !THREE.GLTFLoader) return;
      let loader;
      try { loader = configureGltf(new THREE.GLTFLoader()); } catch (_) { return; }
      loader.load(AVATAR_MODEL_URL, (gltf) => {
        try {
          const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (!root || ent.disposed) return;
          const size = new THREE.Vector3(); new THREE.Box3().setFromObject(root).getSize(size);
          root.scale.setScalar(1.7 / (size.y || 1));
          ent.yOff = -new THREE.Box3().setFromObject(root).min.y;
          root.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.frustumCulled = false; } });
          const par = avatarParent(); if (par) par.add(root);
          ent.model = root;
          if (gltf.animations && gltf.animations.length) {
            ent.mixer = new THREE.AnimationMixer(root);
            const pick = (re) => gltf.animations.find((c) => re.test(c.name || ''));
            const idle = pick(/idle|stand|breath/i) || gltf.animations[0];
            const walk = pick(/walk|move/i) || pick(/run|jog/i) || idle;
            if (idle) ent.actions.idle = ent.mixer.clipAction(idle);
            if (walk) ent.actions.walk = ent.mixer.clipAction(walk);
            playAction(ent, 'idle');
          }
          if (ent.sprite && ent.sprite.parent) ent.sprite.parent.remove(ent.sprite);
          ent.sprite = null;
          placeEntity(ent);
        } catch (_) {}
      }, undefined, () => { /* keep sprite fallback */ });
    }
    function createAvatar(spriteName) {
      const ent = { x: 0, z: 0, dir: 'down', lastMove: 0, bobPhase: Math.random() * 6, sprite: null, model: null, mixer: null, actions: {}, current: null, yOff: 0, disposed: false };
      ent.sprite = makeSprite(spriteName);
      loadModelInto(ent);
      return ent;
    }
    function playAction(ent, name) {
      if (!ent.mixer) return; const a = ent.actions[name]; if (!a || ent.current === a) return;
      if (ent.current) ent.current.fadeOut(0.18);
      a.reset().fadeIn(0.18).play(); ent.current = a;
    }
    function placeEntity(ent) {
      if (!ent || typeof tilePos !== 'function') return;
      const p = tilePos(ent.x, ent.z);
      if (ent.model) { ent.model.position.set(p.x, ent.yOff || 0, p.z); ent.model.rotation.y = dirYaw(ent.dir); }
      else if (ent.sprite) {
        ent.sprite.position.set(p.x, 0.9, p.z);
        const t = charTex(ent.sprite.userData.charName, ent.dir); if (t) { ent.sprite.material.map = t; ent.sprite.material.needsUpdate = true; }
      }
    }
    function moveEntity(ent, x, z) {
      if (!ent) return;
      const d = dirFrom(x - ent.x, z - ent.z); if (d) ent.dir = d;
      if (x !== ent.x || z !== ent.z) ent.lastMove = Date.now();
      ent.x = x; ent.z = z; placeEntity(ent);
    }
    function disposeEntity(ent) {
      if (!ent) return; ent.disposed = true;
      if (ent.model && ent.model.parent) ent.model.parent.remove(ent.model);
      if (ent.sprite && ent.sprite.parent) ent.sprite.parent.remove(ent.sprite);
    }

    function updateSelfAvatar() {
      if (!selfEnt) selfEnt = createAvatar(AVATAR_SELF);
      moveEntity(selfEnt, you.x, you.z);
    }
    function updatePeerAvatars() {
      const seen = new Set();
      peers.forEach((p) => {
        if (!p || p.id == null) return;
        const pos = p.cursor || p; if (pos.x == null) return;
        seen.add(p.id);
        let ent = peerEnts.get(p.id);
        if (!ent) { ent = createAvatar(AVATAR_PEERS[hashId(p.id) % AVATAR_PEERS.length]); peerEnts.set(p.id, ent); }
        moveEntity(ent, pos.x, pos.z);
      });
      peerEnts.forEach((ent, id) => { if (!seen.has(id)) { disposeEntity(ent); peerEnts.delete(id); } });
    }
    function startAvatars() {
      if (avatarRaf || typeof requestAnimationFrame !== 'function') return;
      let prev = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const tick = () => {
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const dt = Math.min(0.05, (now - prev) / 1000); prev = now; const t = now / 1000;
        const all = selfEnt ? [selfEnt] : [];
        peerEnts.forEach((e) => all.push(e));
        for (const ent of all) {
          if (ent.mixer) { ent.mixer.update(dt); playAction(ent, (Date.now() - ent.lastMove) < 250 ? 'walk' : 'idle'); }
          else if (ent.sprite) ent.sprite.position.y = 0.9 + Math.sin(t * 5 + ent.bobPhase) * 0.05;
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
