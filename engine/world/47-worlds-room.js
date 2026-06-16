  // Tinyverse — published-world room client. Connects to the authoritative
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
    // Expose emit so sibling modules (e.g. 64-lobby-chat-bridge) can inject
    // synthetic events like a bridged 'chat' line into the same render path.
    WS.__emit = emit;
  
    // ---- room state ----
    let socket = null;
    let world = null;
    let token = '';
    let role = 'play';
    let gridSize = 8;
    let taxPercent = null;
    let restoreAmbientCrowdVisible = null;
    let you = { x: 0, z: 0, hearts: 10, role: 'play' };
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
    const PLAYER_COLORS = ['#e05c5c','#e08c3c','#d4c040','#5ac44e','#40b8d0','#5a78e0','#b060e0','#e060a0'];
    function playerColor() {
      try {
        let c = localStorage.getItem('tinyworld:multiplayer:color');
        if (!c || !/^#[0-9a-f]{6}$/i.test(c)) {
          c = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
          localStorage.setItem('tinyworld:multiplayer:color', c);
        }
        return c;
      } catch (_) { return '#5a78e0'; }
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
    let prevPlayMode = null;
    function enterRoom(w, joinToken, joinRole) {
      leaveRoom();
      world = w; token = joinToken || ''; role = joinRole || 'play';
      try { if (typeof WS.seedDemoResources === 'function') WS.seedDemoResources(w); } catch (_) {}
      try { window.__tinyworldInWorldRoom = true; } catch (_) {}   // relax camera pan clamp (02) for island exploration
      gridSize = w.gridSize || 8; taxPercent = w.taxPercent != null ? w.taxPercent : null;
      cells = w.data && Array.isArray(w.data.cells) ? w.data.cells : [];
      rebuildBlocked();
      if (w.data && typeof applyState === 'function') {
        // The lobby/demo world is static (visitors don't edit it), so bake its
        // ground tiles into merged meshes once it finishes rendering — big draw-call
        // cut on the larger 20x20 board. onDone fires after tiles paint + settle.
        const bakeOnDone = (w.slug === 'tidewater-bay')
          ? { onDone: () => { try { if (typeof window.__tinyworldSetTerrainBakeForced === 'function') window.__tinyworldSetTerrainBakeForced(true); } catch (_) {} } }
          : undefined;
        try { applyState(w.data, bakeOnDone); } catch (_) {}
      }
      // One map: hide the builder's own minimap, and lock out builder tools.
      hideBaseMinimap(true);
      setAmbientCrowdVisibleForRoom(false);
      if (typeof WS.setPlayChrome === 'function') WS.setPlayChrome(true);
      // Tilt-shift reads as a toy-diorama effect; turn it off for the immersive
      // tinyverse view. Remember prior state so leaving restores the build setting.
      try { window.__twTiltWasOff = document.body.classList.contains('tilt-blur-off'); document.body.classList.add('tilt-blur-off'); } catch (_) {}
      // Force play mode so all edit gates block building while in a tinyverse world.
      const mode = window.__tinyworldMode;
      if (mode) { prevPlayMode = mode.isPlay(); mode.setPlay(); }
      emit('enter', { world: w, role });
      const roomId = 'world-' + w.slug;
      const url = host() + '/party/' + encodeURIComponent(roomId) + '?_pk=' + encodeURIComponent(connToken());
      try { socket = new WebSocket(url); } catch (_) { toast(T('worlds.error')); return; }
      sawWorldState = false;
      socket.addEventListener('open', () => {
        connected = true;
        send({
          type: 'world.join', token, worldId: w.id, name: playerName(), color: playerColor(),
          role, profileId: (WS.myProfileId != null ? WS.myProfileId : null),
          gridSize, cells: compactCells(w.data), taxPercent: w.taxPercent, ownerProfileId: w.ownerProfileId,
          avatar: getSelfAvatarDescriptor(), // networked voxel identity (server validates via cleanAvatar)
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
      try { window.__tinyworldInWorldRoom = false; } catch (_) {}   // restore tight board pin for the home builder
      // Turn off the static terrain bake and restore live tiles before the world
      // tears down, so the next world / home builder never inherits a stale merged
      // mesh or a "baked" cell set that blocks re-baking.
      try {
        if (typeof window.__tinyworldSetTerrainBakeForced === 'function') window.__tinyworldSetTerrainBakeForced(false);
        if (typeof window.__tinyworldUnbakeTerrain === 'function') window.__tinyworldUnbakeTerrain();
      } catch (_) {}
      if (socket) { try { socket.close(); } catch (_) {} socket = null; }
      connected = false; peers.clear(); nodes = {}; animals = [];
      unbindInput(); hideMinimap();
      setAmbientCrowdVisibleForRoom(true);
      hideBaseMinimap(false);
      if (typeof WS.setPlayChrome === 'function') WS.setPlayChrome(false);
      try { if (!window.__twTiltWasOff) document.body.classList.remove('tilt-blur-off'); } catch (_) {}
      // Restore whichever build/play mode the user had before entering the room.
      const mode = window.__tinyworldMode;
      if (mode && prevPlayMode !== null) { if (prevPlayMode) mode.setPlay(); else mode.setBuild(); prevPlayMode = null; }
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

    function setAmbientCrowdVisibleForRoom(visible) {
      const api = window.__tinyworldCrowd;
      if (!api || typeof api.setRuntimeVisible !== 'function') return;
      if (!visible) {
        if (restoreAmbientCrowdVisible === null) {
          restoreAmbientCrowdVisible = typeof api.runtimeVisible === 'function' ? api.runtimeVisible() : true;
        }
        api.setRuntimeVisible(false);
        return;
      }
      if (restoreAmbientCrowdVisible !== null) {
        api.setRuntimeVisible(restoreAmbientCrowdVisible);
        restoreAmbientCrowdVisible = null;
      }
    }
    WS.leaveRoom = function () {
      leaveRoom();
      if (typeof WS.restoreFreeform === 'function') WS.restoreFreeform();
    };
  
    function safeParse(s) { try { return JSON.parse(s); } catch (_) { return null; } }
  
    function onMessage(d) {
      switch (d.type) {
        case 'welcome':
          myId = d.id || myId;
          if (typeof d.role === 'string') role = d.role;
          emit('status', { connected: true, role });
          // An upgraded world server flags the welcome; an old collab server does
          // not — bail out so the minimap/HUD don't linger over the builder.
          if (d.world !== true) { sawWorldState = true; toast(T('worlds.serverOld')); WS.leaveRoom(); }
          break;
        case 'world.state':
          sawWorldState = true;
          gridSize = d.gridSize || gridSize; taxPercent = d.taxPercent != null ? d.taxPercent : taxPercent;
          you = Object.assign(you, d.you || {});
          if (typeof you.role === 'string') role = you.role;
          nodes = d.nodes || {}; animals = d.animals || [];
          peers.clear(); (d.peers || []).forEach(p => { if (p.id && p.id !== myId) { p._t = Date.now(); peers.set(p.id, p); } });
          emit('state', snapshot()); drawMinimap(); updateSelfAvatar(); updatePeerAvatars(); break;
        case 'presence': {
          const p = d.presence; if (!p || !p.id) break;
          if (p.id === myId) {
            // Our own presence echo carries the authoritative position + hearts.
            if (p.cursor) { you.x = p.cursor.x; you.z = p.cursor.z; }
            if (p.hearts != null) you.hearts = p.hearts;
            emit('you', you); updateSelfAvatar();
          } else {
            p._t = Date.now(); peers.set(p.id, p);
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
        case 'present': emit('present', d); break;   // lobby slide sync (58-lobby-presentation)
        case 'world.refresh':
          // A god-admin saved the live world; the server relays the fresh board so
          // every connected client re-renders without a reload. Only the compact
          // cells are sent (capped); we rebuild the local tile view + blocked set.
          applyAdminWorldRefresh(d);
          break;
        default: break;
      }
    }
  
    // Local optimistic resource tally (whole units). The authoritative balance is
    // in Postgres; this just gives the HUD immediate feedback.
    const localRes = { fish: 0, meat: 0, plants: 0, ore: 0 };
    function addLocalResource(r, n) { if (localRes[r] != null && n > 0) { localRes[r] += n; emit('resources', Object.assign({}, localRes)); } }
    WS.getResources = () => Object.assign({}, localRes);
    // Lobby presentation: broadcast the current slide index to the room (58 listens
    // for the server's 'present' echo to apply it on every client).
    WS.present = function (slide) { send({ type: 'present', slide: slide | 0 }); };

    // ---- god-admin live world refresh ----
    // The admin editor (66) calls this after a successful adminSave. We send the
    // freshly-serialized board to the server, which relays a `world.refresh` to
    // every OTHER client in the room so the change appears live (no reload). The
    // admin's own client already shows the edit (it made it), so it skips re-apply.
    WS.adminBroadcastWorld = function (data) {
      if (!connected || !data || !Array.isArray(data.cells)) return;
      send({ type: 'world.refresh', cells: compactCells(data), gridSize: data.gridSize || gridSize });
    };

    // Apply an incoming admin world refresh on a peer: re-render the board tiles
    // from the relayed compact cells and rebuild the blocked/standable set so
    // movement respects the new layout immediately.
    let _appliedRefreshAt = 0;
    function applyAdminWorldRefresh(d) {
      const incoming = Array.isArray(d.cells) ? d.cells : null;
      if (!incoming) return;
      // De-dupe rapid repeats (a save can echo once); ignore bursts within 250ms.
      const now = Date.now();
      if (now - _appliedRefreshAt < 250) return;
      _appliedRefreshAt = now;
      cells = incoming;
      gridSize = d.gridSize || gridSize;
      rebuildBlocked();
      // Re-render the 3D tiles via the builder's applyState (same path used on
      // enter). Keep the lobby's terrain-bake behavior consistent.
      if (typeof applyState === 'function') {
        const data = { v: 4, gridSize, cells };
        const bakeOnDone = (world && world.slug === 'tidewater-bay')
          ? { onDone: () => { try { if (typeof window.__tinyworldSetTerrainBakeForced === 'function') window.__tinyworldSetTerrainBakeForced(true); } catch (_) {} } }
          : undefined;
        try {
          if (typeof window.__tinyworldUnbakeTerrain === 'function') window.__tinyworldUnbakeTerrain();
          if (typeof window.__tinyworldSetTerrainBakeForced === 'function') window.__tinyworldSetTerrainBakeForced(false);
        } catch (_) {}
        try { applyState(data, bakeOnDone); } catch (_) {}
      }
      drawMinimap();
    }
  
    function myPresencePos() {
      // The server tracks our position and broadcasts it in presence.cursor; mirror
      // it from the latest 'you' we last saw plus presence echoes.
      return { x: you.x, z: you.z };
    }
  
    function snapshot() {
      return { world, role, gridSize, taxPercent, you, peers: Array.from(peers.values()), nodes, animals };
    }
    WS.getState = snapshot;
    WS.getMyId = () => myId;
    WS.playerName = () => playerName();
    WS.playerColor = () => playerColor();
  
    // ---- movement + click-to-walk pathfinding ----
    const BLOCKED_KINDS = new Set(['house', 'tree', 'rock', 'fence', 'bush', 'voxel-build', 'model-stamp']);
    let blocked = new Set();   // 'x,z' cells you cannot stand on (mirrors server)
    function rebuildBlocked() {
      blocked = new Set();
      for (const c of cells) {
        const x = Array.isArray(c) ? c[0] : c.x, z = Array.isArray(c) ? c[1] : c.z;
        if (x == null || z == null) continue;
        const ter = Array.isArray(c) ? c[2] : c.terrain, k = Array.isArray(c) ? c[3] : c.kind;
        if (ter === 'lava' || ter === 'stone' || (k && BLOCKED_KINDS.has(k))) blocked.add(x + ',' + z);   // water walkable
      }
    }
    function standable(x, z) { return x >= 0 && z >= 0 && x < gridSize && z < gridSize && !blocked.has(x + ',' + z); }

    let lastStepAt = 0;
    function step(dx, dz) {
      if (selfEnt && (selfEnt._traveling || selfEnt._climb || selfEnt._skyfall || selfEnt._srActive)) return;   // no grid move mid-portal/climb/freefall/surface-roam
      const now = Date.now();
      if (now - lastStepAt < 175) return;   // one tile at a time: hold-to-move is capped to the glide
      // The island edge is SOLID: a step past the rim clamps to a no-op below (you can't walk
      // off and freefall). To descend to the surface, walk through a stargate (see tryEnterGate).
      const nx = Math.max(0, Math.min(gridSize - 1, you.x + dx));   // cadence so key-repeat can't skip tiles
      const nz = Math.max(0, Math.min(gridSize - 1, you.z + dz));
      if (nx === you.x && nz === you.z) return;
      if (!standable(nx, nz)) return;
      lastStepAt = now;
      you.x = nx; you.z = nz;       // optimistic; server presence will correct
      send({ type: 'move', x: nx, z: nz });
      emit('you', you); drawMinimap(); updateSelfAvatar();
      tryEnterGate();              // walked onto a lobby gate cell? -> use the portal
    }

    // If the player has just stepped onto a lobby-gate cell, run the gate-to-gate travel
    // on THEIR avatar (dissolve here, emerge at the paired gate) and teleport their grid
    // cell to the destination. animVoxel cedes control while _traveling (see its guard).
    function tryEnterGate() {
      if (!selfEnt || !selfEnt.voxel || selfEnt._traveling) return;
      const GT = window.__tinyworldGateTransit;
      if (!GT) return;
      // Sky-edge stargate -> descend to the mainland (replaces walk-off-the-edge). J still works.
      if (typeof GT.skyGateCell === 'function') {
        const sc = GT.skyGateCell();
        if (sc && sc.x === you.x && sc.z === you.z) {
          const FD = window.__tinyworldFlyDown;
          if (FD && !FD.isDown()) { if (GT.flashSky) GT.flashSky(); FD.descend(); }
          return;
        }
      }
      if (typeof GT.travelPlayer !== 'function') return;
      if (typeof GT.gateAtCell === 'function' && !GT.gateAtCell({ x: you.x, z: you.z })) return;
      selfEnt._traveling = true;
      const ok = GT.travelPlayer({ x: you.x, z: you.z }, selfEnt.voxel, (destCell) => {
        if (destCell) {
          you.x = destCell.x; you.z = destCell.z;
          moveEntity(selfEnt, destCell.x, destCell.z);   // settle avatar on the destination cell
          try { send({ type: 'move', x: destCell.x, z: destCell.z }); } catch (_) {}
          emit('you', you); if (typeof drawMinimap === 'function') drawMinimap();
        }
        selfEnt._traveling = false;
      });
      if (!ok) selfEnt._traveling = false;
    }

    // ---- skyfall: walk off the floating-island edge -> freefall -> fly through rings -> earn
    // a parachute. The PURE physics/course sim lives in 60-skyfall.js; THIS wires it to the
    // live avatar: posture (53 skydive/parachute + setBodyPitch — 47 owns pitch+Y, the rig
    // state poses limbs), torus ring meshes, continuous WASD steering, camera Y-follow, a small
    // HUD, and a safe landing back on the lobby. LOCAL-SELF only (peers see your grid cell
    // freeze until you land; full peer-sync of the fall is a follow-up — `move` carries x,z).
    // Feel knobs (fall speed, steer, ring spacing, earn threshold) live in 60-skyfall CFG.
    const skyKeys = { up: 0, down: 0, left: 0, right: 0, thrust: 0 };
    let skyRingMeshes = [];
    let skyHudEl = null;
    let skyYaw = 0;                          // chase-cam + steering frame = the launch heading
    const SKY_DIVE_BODY_PITCH = -1.52;       // belly-to-earth, readable from the chase cam
    const skySteerVec = { x: 0, z: 0, thrust: false };
    function resetSkyKeys() { skyKeys.up = 0; skyKeys.down = 0; skyKeys.left = 0; skyKeys.right = 0; skyKeys.thrust = 0; }
    function skyAngleLerp(a, b, t) {
      const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
      return a + d * Math.max(0, Math.min(1, t));
    }
    function skyActiveRing(sim, st) {
      if (!sim || !sim.rings || !sim.rings.length) return null;
      const y = st && typeof st.y === 'number' ? st.y : 9999;
      for (const rg of sim.rings) {
        if (rg.passed || rg.missed) continue;
        if (y >= rg.y - Math.max(1.0, rg.r * 0.6)) return rg;
      }
      for (const rg of sim.rings) {
        if (!rg.passed && !rg.missed) return rg;
      }
      return null;
    }
    function skyDesiredYaw(sim, st) {
      st = st || (sim && sim.state);
      if (!st) return skyYaw;
      const rg = skyActiveRing(sim, st);
      if (rg) {
        const dx = rg.x - st.x, dz = rg.z - st.z;
        if (Math.hypot(dx, dz) > 0.08) return Math.atan2(dx, dz);
      }
      const hs = Math.hypot(st.vx || 0, st.vz || 0);
      return hs > 0.12 ? Math.atan2(st.vx, st.vz) : skyYaw;
    }
    // Steering is CAMERA-RELATIVE (the 3rd-person cam sits behind skyYaw): W/up = forward
    // (away from the camera, toward the active ring), S = back toward camera, A/D = strafe.
    // The avatar faces skyYaw so the camera always sees its back. Reuses skySteerVec.
    function skySteer() {
      const fx = Math.sin(skyYaw), fz = Math.cos(skyYaw);    // forward (heading convention)
      const rxp = Math.cos(skyYaw), rzp = -Math.sin(skyYaw); // right = forward rotated -90deg
      let f = 0, s = 0;
      if (skyKeys.up) f += 1;
      if (skyKeys.down) f -= 1;
      if (skyKeys.right) s += 1;
      if (skyKeys.left) s -= 1;
      let x = fx * f + rxp * s, z = fz * f + rzp * s;
      const d = Math.hypot(x, z); if (d > 1) { x /= d; z /= d; }
      skySteerVec.x = x; skySteerVec.z = z;
      return skySteerVec;
    }
    // 3rd-person chase camera: sit BEHIND + above the falling avatar, looking forward+down so
    // the rings below stay in frame. Bypasses the orbit updateCamera while _skyfall is active.
    function updateSkyfallCamera() {
      if (!selfEnt || !selfEnt.sprite || typeof camera === 'undefined' || !camera) return;
      const sp = selfEnt.sprite.position;
      const sim = selfEnt._skyfall;
      const st = sim && sim.state;
      const rg = skyActiveRing(sim, st);
      const fx = Math.sin(skyYaw), fz = Math.cos(skyYaw);
      // A falling chase cam must look DOWN from ABOVE (not horizontally), or it buries in the
      // island's edge wall and the void/rings below never show. Sit high + slightly behind and
      // aim steeply down past the avatar to the rings below; the island recedes up out of frame
      // as you drop. (Tunables: BACK behind, UP height, AHEAD/DOWN where the gaze lands.)
      const BACK = 5.4, UP = 6.0, AHEAD = 1.5, DOWN = 7.0;
      let lx = sp.x + fx * AHEAD, ly = sp.y - DOWN, lz = sp.z + fz * AHEAD;
      if (rg) {
        lx = sp.x * 0.35 + rg.x * 0.65;
        ly = Math.min(sp.y - 4.0, rg.y);
        lz = sp.z * 0.35 + rg.z * 0.65;
      }
      camera.up.set(0, 1, 0);
      camera.position.set(sp.x - fx * BACK, sp.y + UP, sp.z - fz * BACK);
      camera.lookAt(lx, ly, lz);
      camera.updateMatrixWorld();
    }
    function startSkyfall(dx, dz) {
      // RETIRED: the walk-off-the-edge freefall (and its rings) is disabled — islands have
      // solid edges now and descent is via stargate. Sim/ring code below is kept but unreachable.
      return false;
      // eslint-disable-next-line no-unreachable
      const SF = window.__tinyworldSkyfall;
      if (!SF || typeof SF.createSim !== 'function') return false;
      if (!selfEnt || !selfEnt.sprite || selfEnt._skyfall) return false;
      const p = selfEnt.sprite.position;
      // Launch OFF the edge: aim along the step direction and start the fall already pushed
      // ~1.3 cells PAST the rim so the body clears the island and drops in open air (was
      // starting on the edge tile and dropping straight down -> "falls through the island").
      skyYaw = (dx || dz) ? Math.atan2(dx, dz) : ((selfEnt.voxel && selfEnt.voxel._heading) || 0);
      resetSkyKeys();
      const OUT = 1.3;
      const sx = p.x + dx * OUT, sz = p.z + dz * OUT;
      const seed = ((you.x * 73856093) ^ (you.z * 19349663) ^ (Date.now() & 0xffff)) >>> 0;
      const sim = SF.createSim({ x: sx, y: p.y, z: sz, seed, dirX: dx, dirZ: dz });
      if (sim.rings && sim.rings[0]) skyYaw = Math.atan2(sim.rings[0].x - sx, sim.rings[0].z - sz);
      selfEnt._skyfall = sim;
      if (selfEnt.voxel) {
        selfEnt.voxel.setBodyPitch(SKY_DIVE_BODY_PITCH);  // belly-to-earth (controller owns pitch)
        selfEnt.voxel.setHeading(skyYaw);                 // face forward; the chase cam sees the back
        selfEnt.voxel.setState('skydive');
      }
      // Reveal the LANDSCAPE below (the poser-surface islands attach to the shared worldGroup
      // at y=-60) so the player falls toward real terrain, not empty void.
      const PS = window.__tinyworldPoserSurface;
      if (PS) { try { if (typeof PS.build === 'function') PS.build(); if (typeof PS.show === 'function') PS.show(); } catch (_) {} }
      buildSkyRings(sim);
      skyHud(0, sim.cfg.ringCount, false, false);
      toast('Freefall! Fly through the rings to earn a rocket pack.');
      return true;
    }
    function buildSkyRings(sim) {
      disposeSkyRings();
      const parent = selfEnt && selfEnt.sprite && selfEnt.sprite.parent;
      if (!parent || typeof THREE === 'undefined') return;
      for (const rg of sim.rings) {
        const geo = new THREE.TorusGeometry(rg.r, sim.cfg.ringTube, 8, 28);
        const mat = new THREE.MeshStandardMaterial({ color: 0x49d6ff, emissive: 0x113344, roughness: 0.5, metalness: 0.1 });
        const m = new THREE.Mesh(geo, mat);
        m.position.set(rg.x, rg.y, rg.z);
        m.rotation.x = Math.PI / 2;            // lay the ring flat so you fall through the hole
        m.userData.ring = rg;
        m.userData.skyState = 'live';
        parent.add(m);
        skyRingMeshes.push(m);
      }
    }
    function refreshSkyRings() {
      for (const m of skyRingMeshes) {
        const rg = m.userData.ring;
        const next = rg && rg.passed ? 'passed' : (rg && rg.missed ? 'missed' : 'live');
        if (next === m.userData.skyState || !m.material || !m.material.color) continue;
        m.userData.skyState = next;
        if (next === 'passed') {
          m.material.color.setHex(0x46e36b); m.material.emissive.setHex(0x0a3315);   // passed -> green
        } else if (next === 'missed') {
          m.material.color.setHex(0xff8d4a); m.material.emissive.setHex(0x331206);   // missed -> orange
        } else {
          m.material.color.setHex(0x49d6ff); m.material.emissive.setHex(0x113344);
        }
      }
    }
    function disposeSkyRings() {
      for (const m of skyRingMeshes) {
        if (m.parent) m.parent.remove(m);
        try { m.geometry.dispose(); m.material.dispose(); } catch (_) {}
      }
      skyRingMeshes = [];
    }
    function stepSkyfall(ent, dt) {
      const sim = ent._skyfall; if (!sim) return;
      skyYaw = skyAngleLerp(skyYaw, skyDesiredYaw(sim, sim.state), (dt || 0) * 3.2);
      const steer = skySteer(); steer.thrust = !!skyKeys.thrust;   // SPACE fires the rocket pack
      const st = sim.tick(dt, steer);
      skyYaw = skyAngleLerp(skyYaw, skyDesiredYaw(sim, st), (dt || 0) * 4.0);
      ent.sprite.position.set(st.x, st.y, st.z);
      if (ent.voxel) {
        if (st.rocket && typeof ent.voxel.getState === 'function' && ent.voxel.getState() !== 'rocket') {
          ent.voxel.setBodyPitch(0); ent.voxel.setState('rocket');   // rocket pack: upright stance
          if (typeof ent.voxel.setRocketVisible === 'function') ent.voxel.setRocketVisible(true);  // show the pack
        }
        if (typeof ent.voxel.setThrusting === 'function') ent.voxel.setThrusting(!!st.thrusting);  // flames on thrust
        ent.voxel.setHeading(skyYaw);                     // stay facing forward (back to the chase cam)
      }
      refreshSkyRings();
      skyHud(st.ringsPassed, sim.cfg.ringCount, st.rocket, st.thrusting, st.fuel / sim.cfg.fuel);
      if (st.done) endSkyfall(ent);
    }
    function endSkyfall(ent) {
      const sim = ent._skyfall; ent._skyfall = null;
      resetSkyKeys();
      disposeSkyRings();
      const PS = window.__tinyworldPoserSurface;
      if (PS && typeof PS.hide === 'function') { try { PS.hide(); } catch (_) {} }   // hide the landscape again
      if (ent.voxel) {
        ent.voxel.setBodyPitch(0); ent.voxel.setState('idle');
        if (typeof ent.voxel.setThrusting === 'function') ent.voxel.setThrusting(false);
        if (typeof ent.voxel.setRocketVisible === 'function') ent.voxel.setRocketVisible(false);
      }
      // settle back onto the lobby: clamp to the nearest standable cell to the step-off point.
      let cx = Math.max(0, Math.min(gridSize - 1, you.x));
      let cz = Math.max(0, Math.min(gridSize - 1, you.z));
      if (!standable(cx, cz)) { cx = (gridSize / 2) | 0; cz = (gridSize / 2) | 0; }
      you.x = cx; you.z = cz;
      moveEntity(ent, cx, cz);
      try { send({ type: 'move', x: cx, z: cz }); } catch (_) {}
      emit('you', you); if (typeof drawMinimap === 'function') drawMinimap();
      const earned = sim && sim.state && sim.state.rocket;
      toast(earned ? 'Landed with a rocket pack!' : 'Landed.');
      skyHudHide();
    }
    function skyHud(passed, total, rocket, thrusting, fuelFrac) {
      if (typeof document === 'undefined') return;
      if (!skyHudEl) {
        skyHudEl = document.createElement('div');
        skyHudEl.id = 'tw-skyfall-hud';
        skyHudEl.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:96;' +
          "font:700 13px 'Pixelify Sans',ui-monospace,Menlo,monospace;letter-spacing:.06em;color:#eaf4ff;" +
          'background:rgba(8,14,26,.72);padding:8px 14px;border-radius:8px;box-shadow:inset 0 0 0 2px #2b59d6;text-transform:uppercase';
        document.body.appendChild(skyHudEl);
      }
      skyHudEl.style.display = '';
      if (rocket) {
        const pct = Math.max(0, Math.round((fuelFrac || 0) * 100));
        skyHudEl.textContent = pct > 0
          ? ('ROCKET PACK  ·  HOLD SPACE TO THRUST  ·  FUEL ' + pct + '%' + (thrusting ? '  ·  THRUSTING' : ''))
          : 'ROCKET PACK  ·  FUEL EMPTY';
      } else {
        skyHudEl.textContent = 'RINGS ' + passed + '/' + total + '  ·  ' + Math.max(0, total - passed) + ' MORE FOR A ROCKET PACK';
      }
    }
    function skyHudHide() { if (skyHudEl) skyHudEl.style.display = 'none'; }

    // ---- surface roam: descended free movement on the poser surface --------
    // Activated when fly-down (54) is fully descended and not in skyfall.
    // Uses camera-relative WASD + drag-look (hold LMB to rotate camera yaw/pitch).
    // Deactivates when J ascends back to the lobby. LOCAL-SELF only (no networked 3D pos yet).

    const _srKeys = { up: false, down: false, left: false, right: false, fly: false, sink: false, sprint: false };
    let _srActive = false;         // surface roam is live
    let _srYaw = 0;                // camera yaw (radians, same convention as skyYaw)
    let _srPitch = 0.35;           // look pitch (radians); positive = look DOWN (both cam modes)
    let _srX = 0, _srZ = 0;       // avatar world position (3D)
    let _srY = 0;                  // avatar Y (world units)
    let _srVY = 0;                 // vertical velocity (flying mode)
    let _srFlying = false;         // true while in air above surface
    let _srHudEl = null;
    // drag-look state
    let _srDragActive = false;
    let _srDragLX = 0, _srDragLY = 0;
    // fly-down poll state
    let _srWasDown = false;
    // saved grid position to restore on ascend
    let _srSavedYouX = 0, _srSavedYouZ = 0;
    // camera zoom + first-person
    let _srCamDist = 5.0;          // live chase-cam distance (wheel-adjustable)
    let _srFirstPerson = false;    // true once zoomed all the way in
    let _srEyeH = 1.6;             // eye height above feet (measured at activate)
    let _srPrevFov = 28;           // persCam fov to restore when leaving first-person
    let _srFovSaved = false;
    const SR_FP_FOV = 75;          // natural first-person field of view (game default is a 28° telephoto)
    // jump arc (visible hop while grounded)
    let _srJumping = false;
    let _srJumpT = 0;
    let _srLastSpace = 0;          // ms timestamp of last Space press (double-tap -> toggle fly)
    const _srEye = new THREE.Vector3();
    const _srTmp = new THREE.Vector3();
    // surface stargate (walk into it to ascend back up)
    let _srGatePos = null;         // world XZ of the mainland gate (THREE.Vector3) or null
    let _srGateArmed = false;      // true once you're clear of the gate (so emerging doesn't re-trigger)
    let _srAscending = false;      // guard so we fire ascend() once
    const SR_GATE_R = 2.2;         // trigger radius around the surface gate (world units)
    const SR_GATE_SPAWN = 3.4;     // spawn this far in front (+z) of the gate

    // speed tunables (world units/sec)
    const SR_WALK = 3.2;
    const SR_SPRINT = 6.4;
    const SR_FLY_V = 4.0;       // vertical fly speed
    const SR_CAM_UP = 2.4;      // chase-cam height above avatar
    const SR_DRAG_SENS = 0.005; // mouse drag sensitivity (rad/px)
    const SR_PITCH_MIN = 0.05;  // 3rd-person pitch floor (camera elevation)
    const SR_PITCH_MAX = 1.4;
    const SR_FP_PITCH_MIN = -1.30; // first-person: look up
    const SR_FP_PITCH_MAX = 1.30;  // first-person: look down
    const SR_CAM_MIN = 1.2;     // zoom-in limit (below this -> first person)
    const SR_CAM_MAX = 14.0;    // zoom-out limit
    const SR_FP_THRESH = 1.6;   // cam distance at/below which first-person engages
    const SR_JUMP_DUR = 0.46;   // matches voxel-avatar JUMP_DUR
    const SR_JUMP_H = 1.4;      // peak hop height (world units)
    const SR_DBL_MS = 320;      // double-tap window for Space -> fly toggle

    function _srActivate() {
      if (!selfEnt || !selfEnt.sprite) return;
      _srActive = true;
      window.__tinyworldSurfaceRoamActive = true;
      // Position the avatar at the surface centre (local 0,0 = under the island group)
      const PS = window.__tinyworldPoserSurface;
      const gx = (typeof target !== 'undefined' && target) ? target.x : 0;
      const gz = (typeof target !== 'undefined' && target) ? target.z : 0;
      // Place the mainland stargate (surface-local 0,0) and spawn just in FRONT of it (+z),
      // as if you stepped out of it. Walk back into it to ascend (see _srStep).
      _srGatePos = null; _srGateArmed = false; _srAscending = false;
      const GT = window.__tinyworldGateTransit;
      if (GT && typeof GT.ensureLandGate === 'function') {
        try {
          GT.ensureLandGate();
          if (typeof GT.landGateWorldPos === 'function') _srGatePos = GT.landGateWorldPos();
        } catch (_) {}
      }
      if (_srGatePos) {
        _srX = _srGatePos.x; _srZ = _srGatePos.z + SR_GATE_SPAWN;
        _srGateArmed = true;                 // spawned clear of the gate -> ready to re-enter
      } else {
        _srX = gx; _srZ = gz;
      }
      if (PS && typeof PS.sampleWorld === 'function') {
        const s = PS.sampleWorld(_srX, _srZ);
        _srY = s.walkWorldY;
      } else {
        _srY = -58; // fallback: approx ground level (DROP=60, slight isle height)
      }
      _srVY = 0; _srFlying = false;
      _srYaw = 0; _srPitch = 0.35;
      _srCamDist = 5.0; _srFirstPerson = false;
      _srJumping = false; _srJumpT = 0; _srLastSpace = 0;
      selfEnt._srActive = true;
      selfEnt.sprite.position.set(_srX, _srY, _srZ);
      selfEnt._yc = _srY; selfEnt.ty = _srY;
      selfEnt.tx = _srX; selfEnt.tz = _srZ;
      // measure rendered avatar height so the first-person eye sits near the head
      try {
        const box = new THREE.Box3().setFromObject(selfEnt.sprite);
        const h = box.max.y - box.min.y;
        if (isFinite(h) && h > 0.3) _srEyeH = Math.max(1.0, Math.min(2.6, h * 0.9));
      } catch (_) {}
      if (selfEnt.voxel) {
        selfEnt.voxel.setBodyPitch(0);
        selfEnt.voxel.setState('idle');
        selfEnt.voxel.setHeading(_srYaw);
        if (selfEnt.voxel.setFirstPerson) selfEnt.voxel.setFirstPerson(false);
      }
      document.body.classList.add('surface-roam-active');
      _srShowHud();
      _srBindInput();
    }

    function _srDeactivate() {
      if (!_srActive) return;
      _srActive = false;
      window.__tinyworldSurfaceRoamActive = false;
      if (selfEnt) {
        selfEnt._srActive = false;
        if (selfEnt.voxel) {
          selfEnt.voxel.setBodyPitch(0); selfEnt.voxel.setState('idle');
          if (selfEnt.voxel.setFirstPerson) selfEnt.voxel.setFirstPerson(false);
        }
      }
      _srFirstPerson = false;
      try { if (_srFovSaved && typeof persCam !== 'undefined' && persCam) { persCam.fov = _srPrevFov; persCam.updateProjectionMatrix(); } } catch (_) {}
      _srFovSaved = false;
      _srGatePos = null; _srGateArmed = false; _srAscending = false;
      document.body.classList.remove('surface-roam-fp');
      // restore grid position
      you.x = _srSavedYouX; you.z = _srSavedYouZ;
      if (selfEnt) moveEntity(selfEnt, you.x, you.z);
      document.body.classList.remove('surface-roam-active');
      _srHideHud();
      _srUnbindInput();
      // restore orbit camera
      if (typeof updateCamera === 'function') updateCamera();
    }

    function _srStep(dt) {
      if (!selfEnt || !selfEnt.sprite || !_srActive) return;
      const PS = window.__tinyworldPoserSurface;
      const speed = _srKeys.sprint ? SR_SPRINT : SR_WALK;
      // camera-relative WASD. forward = dir from camera into the screen; right =
      // cross(forward, up) = (-cosYaw, sinYaw) so D moves screen-RIGHT (was inverted).
      const fx = Math.sin(_srYaw), fz = Math.cos(_srYaw);   // forward (into screen)
      const rx = -Math.cos(_srYaw), rz = Math.sin(_srYaw);  // screen-right
      let mx = 0, mz = 0;
      if (_srKeys.up)    { mx += fx; mz += fz; }
      if (_srKeys.down)  { mx -= fx; mz -= fz; }
      if (_srKeys.right) { mx += rx; mz += rz; }
      if (_srKeys.left)  { mx -= rx; mz -= rz; }
      const md = Math.hypot(mx, mz);
      if (md > 0) { mx /= md; mz /= md; }
      _srX += mx * speed * dt;
      _srZ += mz * speed * dt;

      // clamp to sea-plane edge (~118 world units at SCALE=1.6, SURF_CLAMP=74)
      const SEA_EDGE = 74 * 1.6;
      const gx = (typeof target !== 'undefined' && target) ? target.x : 0;
      const gz = (typeof target !== 'undefined' && target) ? target.z : 0;
      _srX = Math.max(gx - SEA_EDGE, Math.min(gx + SEA_EDGE, _srX));
      _srZ = Math.max(gz - SEA_EDGE, Math.min(gz + SEA_EDGE, _srZ));

      // ---- stargate: walk into the mainland gate to ascend back to the sky island ----
      if (_srGatePos && !_srAscending) {
        const gd = Math.hypot(_srX - _srGatePos.x, _srZ - _srGatePos.z);
        if (!_srGateArmed) {
          if (gd > SR_GATE_R * 2) _srGateArmed = true;   // must clear the gate before it re-triggers
        } else if (gd < SR_GATE_R) {
          _srAscending = true;
          const GT = window.__tinyworldGateTransit;
          if (GT && GT.flashLand) GT.flashLand();
          const FD = window.__tinyworldFlyDown;
          if (FD && FD.isDown()) FD.ascend();
        }
      }

      // sample ground height
      let groundY = _srY;
      if (PS && typeof PS.sampleWorld === 'function') {
        const s = PS.sampleWorld(_srX, _srZ);
        groundY = s.walkWorldY;
      }

      // ---- vertical: fly mode (double-tap Space) or a grounded jump arc ----
      if (_srFlying) {
        let vy = 0;
        if (_srKeys.fly)  vy += SR_FLY_V;   // Space held = rise
        if (_srKeys.sink) vy -= SR_FLY_V;   // C held = sink
        _srY += vy * dt;
        if (_srY < groundY) { _srY = groundY; _srFlying = false; }  // touched down -> walk
        _srJumping = false;
      } else if (_srJumping) {
        _srJumpT += dt;
        const t = _srJumpT / SR_JUMP_DUR;
        if (t >= 1) { _srJumping = false; _srY = groundY; }
        else { _srY = groundY + SR_JUMP_H * Math.sin(Math.PI * t); }  // parabolic hop
      } else {
        _srY = groundY;
      }

      // ---- avatar facing + pose ----
      if (selfEnt.voxel) {
        // first-person faces where you LOOK (arms align with view); 3rd-person faces travel
        const heading = (md > 0) ? Math.atan2(mx, mz) : _srYaw;
        selfEnt.voxel.setHeading(_srFirstPerson ? _srYaw : heading);
        const cur = selfEnt.voxel.getState ? selfEnt.voxel.getState() : '';
        // don't stomp one-shot swings/hops — the rig auto-reverts to idle when each ends
        if (cur !== 'attack' && cur !== 'jump') {
          selfEnt.voxel.setState(_srFlying ? 'rocket' : (md > 0 ? 'walk' : 'idle'));
        }
        selfEnt.voxel.update(dt);
      }

      selfEnt.sprite.position.set(_srX, _srY, _srZ);
      selfEnt._yc = _srY; selfEnt.ty = _srY;
      selfEnt.tx = _srX; selfEnt.tz = _srZ;
    }

    function _srUpdateCamera() {
      if (!selfEnt || !selfEnt.sprite || typeof camera === 'undefined' || !camera) return;
      const sp = selfEnt.sprite.position;
      const sinY = Math.sin(_srYaw), cosY = Math.cos(_srYaw);
      const sinP = Math.sin(_srPitch), cosP = Math.cos(_srPitch);
      camera.up.set(0, 1, 0);
      if (_srFirstPerson) {
        // Through-the-eyes: camera at the head, looking along yaw/pitch (positive pitch = down).
        const eyeY = sp.y + _srEyeH;
        const dir = _srTmp.set(sinY * cosP, -sinP, cosY * cosP);
        camera.position.set(sp.x, eyeY, sp.z);
        camera.lookAt(sp.x + dir.x, eyeY + dir.y, sp.z + dir.z);
      } else {
        // Chase cam: behind + above the avatar; wheel adjusts _srCamDist.
        const back = _srCamDist * cosP;
        const up   = _srCamDist * sinP + SR_CAM_UP;
        camera.position.set(sp.x - sinY * back, sp.y + up, sp.z - cosY * back);
        camera.lookAt(sp.x, sp.y + 0.8, sp.z);
      }
      camera.updateMatrixWorld();
      // keep orbit target in sync so landing doesn't jerk
      if (typeof target !== 'undefined' && target) {
        target.x = sp.x; target.z = sp.z; target.y = sp.y;
      }
    }

    // Toggle first-person (zoomed all the way in). Hides the avatar head and lets the
    // pitch range cover looking up; restoring 3rd person re-clamps pitch to the elevation band.
    function _srSetFirstPerson(on) {
      if (on === _srFirstPerson) return;
      _srFirstPerson = on;
      if (selfEnt && selfEnt.voxel && selfEnt.voxel.setFirstPerson) selfEnt.voxel.setFirstPerson(on);
      if (typeof document !== 'undefined') document.body.classList.toggle('surface-roam-fp', on);
      // Widen the FOV: the game's persCam is a 28° telephoto (looks orthographic). At that FOV a
      // first-person view is a claustrophobic zoom; ~75° reads as natural through-the-eyes.
      try {
        if (typeof persCam !== 'undefined' && persCam) {
          if (on) { if (!_srFovSaved) { _srPrevFov = persCam.fov; _srFovSaved = true; } persCam.fov = SR_FP_FOV; }
          else if (_srFovSaved) { persCam.fov = _srPrevFov; _srFovSaved = false; }
          persCam.updateProjectionMatrix();
        }
      } catch (_) {}
      if (!on) _srPitch = Math.max(SR_PITCH_MIN, Math.min(SR_PITCH_MAX, _srPitch));
      _srUpdateHudText();
    }

    function _srShowHud() {
      if (typeof document === 'undefined') return;
      if (!_srHudEl) {
        _srHudEl = document.createElement('div');
        _srHudEl.id = 'tw-surface-roam-hud';
        _srHudEl.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:96;' +
          "font:700 12px 'Pixelify Sans',ui-monospace,Menlo,monospace;letter-spacing:.06em;color:#c8f0c8;" +
          'background:rgba(8,22,8,.78);padding:8px 16px;border-radius:8px;box-shadow:inset 0 0 0 2px #2b7a2b;text-transform:uppercase';
        document.body.appendChild(_srHudEl);
      }
      _srHudEl.style.display = '';
      _srUpdateHudText();
    }

    function _srUpdateHudText() {
      if (!_srHudEl) return;
      const view = _srFirstPerson ? '1ST-PERSON' : (_srFlying ? 'FLYING' : 'SURFACE');
      _srHudEl.textContent = view + '  ·  WASD Move  ·  Drag Look  ·  Scroll Zoom  ·  '
        + (_srFlying ? 'Space Up / C Down' : 'Space Jump (2× = Fly)')
        + '  ·  F Swing  ·  V 1st-Person  ·  Gate or J to Ascend';
    }

    function _srHideHud() { if (_srHudEl) _srHudEl.style.display = 'none'; }

    function _srOnKeyDown(e) {
      if (!_srActive) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      let handled = true;
      if (k === 'arrowup' || k === 'w')         _srKeys.up    = true;
      else if (k === 'arrowdown' || k === 's')  _srKeys.down  = true;
      else if (k === 'arrowleft' || k === 'a')  _srKeys.left  = true;
      else if (k === 'arrowright' || k === 'd') _srKeys.right = true;
      else if (k === ' ' || k === 'spacebar') {
        _srKeys.fly = true;                       // held = rise while flying
        if (!e.repeat) {
          const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
          const dbl = (now - _srLastSpace) < SR_DBL_MS;
          _srLastSpace = now;
          if (dbl) {                              // double-tap Space toggles fly mode
            _srFlying = !_srFlying; _srJumping = false; _srUpdateHudText();
          } else if (!_srFlying) {
            _srTryJump();                         // single tap on the ground = hop
          }
        }
      }
      else if (k === 'c')                        _srKeys.sink  = true;
      else if (k === 'shift')                    _srKeys.sprint = true;
      else if (k === 'f') { if (!e.repeat) _srTryAttack(); }  // swing / fight
      else if (k === 'v') {                                   // toggle first-person view
        if (!e.repeat) {
          if (_srFirstPerson) { _srCamDist = 5.0; _srSetFirstPerson(false); }
          else { _srCamDist = SR_CAM_MIN; _srSetFirstPerson(true); }
        }
      }
      else handled = false;
      if (handled) e.stopPropagation();
    }

    function _srTryJump() {
      if (_srFlying || _srJumping) return;
      const cur = (selfEnt && selfEnt.voxel && selfEnt.voxel.getState) ? selfEnt.voxel.getState() : '';
      if (cur === 'jump' || cur === 'attack') return;
      _srJumping = true; _srJumpT = 0;
      if (selfEnt && selfEnt.voxel) selfEnt.voxel.setState('jump');
    }

    function _srTryAttack() {
      const v = selfEnt && selfEnt.voxel;
      if (!v) return;
      const cur = v.getState ? v.getState() : '';
      if (cur === 'attack' || cur === 'jump') return;
      v.setState('attack');
    }

    function _srOnKeyUp(e) {
      if (!_srActive) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w')         _srKeys.up    = false;
      else if (k === 'arrowdown' || k === 's')  _srKeys.down  = false;
      else if (k === 'arrowleft' || k === 'a')  _srKeys.left  = false;
      else if (k === 'arrowright' || k === 'd') _srKeys.right = false;
      else if (k === ' ' || k === 'spacebar')   _srKeys.fly   = false;
      else if (k === 'c')                        _srKeys.sink  = false;
      else if (k === 'shift')                    _srKeys.sprint = false;
    }

    function _srOnPointerDown(e) {
      if (!_srActive) return;
      if (e.button !== 0) return;
      _srDragActive = true;
      _srDragLX = e.clientX; _srDragLY = e.clientY;
      e.stopPropagation();
    }

    function _srOnPointerMove(e) {
      if (!_srActive || !_srDragActive) return;
      const dx = e.clientX - _srDragLX;
      const dy = e.clientY - _srDragLY;
      _srDragLX = e.clientX; _srDragLY = e.clientY;
      _srYaw -= dx * SR_DRAG_SENS;
      const lo = _srFirstPerson ? SR_FP_PITCH_MIN : SR_PITCH_MIN;
      const hi = _srFirstPerson ? SR_FP_PITCH_MAX : SR_PITCH_MAX;
      _srPitch = Math.max(lo, Math.min(hi, _srPitch + dy * SR_DRAG_SENS));
      e.stopPropagation();
    }

    function _srOnPointerUp(e) {
      if (!_srActive) return;
      _srDragActive = false;
      e.stopPropagation();
    }

    function _srOnContextMenu(e) {
      if (!_srActive) return;
      e.stopPropagation(); e.preventDefault();
    }

    function _srOnWheel(e) {
      if (!_srActive) return;
      e.stopPropagation(); e.preventDefault();
      // scroll up (deltaY<0) = zoom in; clamp; cross SR_FP_THRESH -> first person
      const step = (e.deltaY > 0 ? 1 : -1) * 0.9;
      _srCamDist = Math.max(SR_CAM_MIN, Math.min(SR_CAM_MAX, _srCamDist + step));
      _srSetFirstPerson(_srCamDist <= SR_FP_THRESH);
    }

    function _srResetKeys() {
      _srKeys.up = false; _srKeys.down = false; _srKeys.left = false;
      _srKeys.right = false; _srKeys.fly = false; _srKeys.sink = false; _srKeys.sprint = false;
      _srDragActive = false;
    }

    function _srBindInput() {
      // capture-phase so surface keys intercept before regular 20/30 handlers
      window.addEventListener('keydown', _srOnKeyDown, true);
      window.addEventListener('keyup',   _srOnKeyUp,   true);
      const el = (typeof renderer !== 'undefined' && renderer && renderer.domElement) ? renderer.domElement : document;
      el.addEventListener('pointerdown',  _srOnPointerDown, true);
      el.addEventListener('pointermove',  _srOnPointerMove, true);
      el.addEventListener('pointerup',    _srOnPointerUp,   true);
      el.addEventListener('contextmenu',  _srOnContextMenu, true);
      el.addEventListener('wheel',        _srOnWheel, { capture: true, passive: false });
    }

    function _srUnbindInput() {
      _srResetKeys();
      window.removeEventListener('keydown', _srOnKeyDown, true);
      window.removeEventListener('keyup',   _srOnKeyUp,   true);
      const el = (typeof renderer !== 'undefined' && renderer && renderer.domElement) ? renderer.domElement : document;
      el.removeEventListener('pointerdown',  _srOnPointerDown, true);
      el.removeEventListener('pointermove',  _srOnPointerMove, true);
      el.removeEventListener('pointerup',    _srOnPointerUp,   true);
      el.removeEventListener('contextmenu',  _srOnContextMenu, true);
      el.removeEventListener('wheel',        _srOnWheel, true);
    }

    // Poll fly-down state each avatar tick — called from startAvatars tick
    function _srPollFlyDown() {
      const FD = window.__tinyworldFlyDown;
      if (!FD) return;
      const st = FD.state();
      const isNowDown = st.down && !st.transitioning;
      const isNowUp   = !st.down && !st.transitioning;
      if (isNowDown && !_srWasDown && !_srActive) {
        // just finished descending — activate
        _srSavedYouX = you.x; _srSavedYouZ = you.z;
        _srActivate();
        _srWasDown = true;
      } else if (isNowUp && _srWasDown && _srActive) {
        // just finished ascending — deactivate
        _srDeactivate();
        _srWasDown = false;
      } else if (!st.down && !st.transitioning) {
        _srWasDown = false;
      }
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
        tryEnterGate();
        if (selfEnt && selfEnt._traveling) { walkTimer = null; return; }   // portal took over
        walkTimer = setTimeout(next, 170);
      };
      next();
    }

    // ---- ladder climb (LOCAL-SELF only, v1) ----
    // A maintenance rig (58-lobby-presentation) tags its ladder with an Object3D named
    // 'climb-ladder' carrying userData = { baseY, topY, halfW, halfD, exitDX, exitDZ } in
    // the lobby group's LOCAL frame. The lobby group and the avatars share avatarParent()
    // (both resolve to worldGroup), but we still convert through world space so any future
    // scale/offset is honoured: marker world pos -> avatarParent local = the avatar frame
    // the rig's group.position lives in. Climbing is a LOCAL VISUAL mode (the server only
    // tracks grid x,z, like crouch/sit) — peers don't see it (peer sync deferred, see report).
    const CLIMB_SPEED = 1.4;          // world units/sec along the ladder (W up / S down)
    const CLIMB_ENTER_MARGIN = 0.85;  // horizontal slack: halfW=0.35 is sub-tile (TILE=1), so
    // the nearest standable tile centre can sit up to ~0.7 from the ladder centre; the margin
    // must reach a real tile or enter never fires. reach = halfW+margin = 1.2 > tile pitch 1.0,
    // so a tile geometrically lands in range. NOT yet measured against the live rig (room is
    // role-gated) — the live check must confirm a STANDABLE tile actually sits within ~1 unit
    // of the ladder base (the ladder is behind the lobby screen near the north edge; if the
    // rig/screen tiles are blocked, the enter tile/margin may need adjustment).
    const _v3a = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
    // Resolve the NEAREST ladder marker (if present + visible) into the avatar's frame.
    // Multiple rigs can each tag a 'climb-ladder' Object3D (e.g. the lobby screen catwalk
    // has one at each end); we pick whichever is closest to the self avatar in x/z so
    // "press up" enters the ladder you're standing at. Returns the resolved descriptor
    // { cx, cz, markerY, halfW, halfD, exitDX, exitDZ, _ud, _marker, _sc } or null.
    function findLadder() {
      const par = avatarParent();
      if (!par || !_v3a) return null;
      // collect all visible climb-ladder markers under the avatar parent
      const markers = [];
      par.traverse((o) => {
        if (!o || o.name !== 'climb-ladder') return;
        let p = o, vis = true;
        while (p) { if (p.visible === false) { vis = false; break; } p = p.parent; }
        if (vis) markers.push(o);
      });
      if (!markers.length) return null;
      const sp = selfEnt && selfEnt.sprite ? selfEnt.sprite.position : null;
      let marker = markers[0], bestD = Infinity;
      for (const m of markers) {
        m.getWorldPosition(_v3a);
        par.worldToLocal(_v3a);
        const d = sp ? ((_v3a.x - sp.x) ** 2 + (_v3a.z - sp.z) ** 2) : 0;
        if (d < bestD) { bestD = d; marker = m; }
      }
      const ud = marker.userData || {};
      marker.getWorldPosition(_v3a);
      par.worldToLocal(_v3a);                          // marker origin -> avatar/group frame
      // scale local userData distances by the marker's world scale so volume dims match.
      const sc = marker.getWorldScale(new THREE.Vector3()).x || 1;
      return {
        cx: _v3a.x, cz: _v3a.z,                        // ladder centre in the avatar frame
        markerY: _v3a.y,                               // marker origin (avatar-frame Y datum)
        halfW: (typeof ud.halfW === 'number' ? ud.halfW : 0.35) * sc,
        halfD: (typeof ud.halfD === 'number' ? ud.halfD : 0.35) * sc,
        exitDX: (typeof ud.exitDX === 'number' ? ud.exitDX : 0) * sc,
        exitDZ: (typeof ud.exitDZ === 'number' ? ud.exitDZ : 0) * sc,
        _ud: ud, _marker: marker, _sc: sc,
      };
    }
    // Convert a rig-local height (baseY/topY, heights ABOVE the rig origin) to the avatar
    // frame Y: marker origin's avatar-frame Y + (height * world scale).
    function resolveLadderY(L, hLocal) {
      return L.markerY + (hLocal || 0) * L._sc;
    }
    // Can the local self enter the ladder right now? (within footprint, near the base.)
    function ladderEnterable(L) {
      if (!L || !selfEnt || !selfEnt.sprite) return false;
      const p = selfEnt.sprite.position;
      const dx = p.x - L.cx, dz = p.z - L.cz;
      if (Math.abs(dx) > L.halfW + CLIMB_ENTER_MARGIN) return false;
      if (Math.abs(dz) > L.halfD + CLIMB_ENTER_MARGIN) return false;
      const baseY = resolveLadderY(L, L._ud.baseY || 0);
      return Math.abs(p.y - baseY) < 0.9;              // must be near the foot of the ladder
    }
    // Enter climb mode: snap x/z to the ladder centre, face the rungs, suspend grid move.
    function enterClimb(L) {
      if (!selfEnt || !selfEnt.voxel) return false;
      cancelWalk();
      const baseY = resolveLadderY(L, L._ud.baseY || 0);
      const topY = resolveLadderY(L, (typeof L._ud.topY === 'number' ? L._ud.topY : L._ud.baseY) || 0);
      selfEnt._climb = { cx: L.cx, cz: L.cz, baseY, topY, exitDX: L.exitDX, exitDZ: L.exitDZ, dir: 0 };
      const sp = selfEnt.sprite.position;
      sp.x = L.cx; sp.z = L.cz;                          // snap to centre
      selfEnt.tx = L.cx; selfEnt.tz = L.cz;              // kill any pending grid tween
      sp.y = Math.max(baseY, Math.min(topY, sp.y));
      selfEnt._yc = sp.y; selfEnt.ty = sp.y;
      // face the ladder: you climb facing the rungs (chest toward the ladder), not away.
      // The prior heading (PI) pointed the climber OUTWARD; flip it to face the rungs.
      selfEnt.voxel.setHeading(0);
      selfEnt.voxel.setState('climb');
      return true;
    }
    function exitClimbToGround() {
      if (!selfEnt) return;
      selfEnt._climb = null;
      if (selfEnt.voxel) selfEnt.voxel.setState('idle');
      // grid x,z unchanged (still the base tile); let placeEntity re-ground on next move.
    }
    function exitClimbToPlatform(c) {
      if (!selfEnt || !selfEnt.sprite) return;
      const sp = selfEnt.sprite.position;
      sp.x = c.cx + c.exitDX; sp.z = c.cz + c.exitDZ;    // step off onto the deck
      sp.y = c.topY;
      selfEnt.tx = sp.x; selfEnt.tz = sp.z; selfEnt.ty = c.topY; selfEnt._yc = c.topY;
      selfEnt._climb = null;
      if (selfEnt.voxel) selfEnt.voxel.setState('idle');
      // NOTE: the platform is not a grid tile (server tracks only x,z). The avatar rests at
      // platform height until the first grid move re-grounds it. Honest v1 limit (see report).
    }
    // Held-key vertical intent, set by onKey/onKeyUp while climbing (1 up, -1 down, 0 hold).
    let climbDir = 0;
    // Advance the climb each frame: move group.position.y toward top/bottom, feed the rig a
    // phase delta proportional to the distance moved (so limbs cycle while moving, hang when
    // still), and exit at either end. Called from animVoxel for the local self only.
    function stepClimb(ent, dt) {
      const c = ent._climb; if (!c) return;
      const sp = ent.sprite.position;
      const vy = climbDir * CLIMB_SPEED * dt;            // signed vertical move this frame
      let ny = sp.y + vy;
      let exited = false;
      if (ny >= c.topY) { ny = c.topY; if (climbDir > 0) { exitClimbToPlatform(c); exited = true; } }
      else if (ny <= c.baseY) { ny = c.baseY; if (climbDir < 0) { sp.y = ny; ent._yc = ny; ent.ty = ny; exitClimbToGround(); exited = true; } }
      if (exited) return;
      sp.x = c.cx; sp.z = c.cz;                          // stay locked to the ladder — no sideways fall-off
      sp.y = ny; ent._yc = ny; ent.ty = ny;
      // phase delta: 2*pi per ~0.5 world unit climbed -> a brisk hand-over-hand cadence.
      ent.voxel.climbAdvance(Math.abs(vy) * (Math.PI * 2 / 0.5));
      ent.voxel.setState('climb');                      // no-op if already climbing
      ent.voxel.update(dt);
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
    WS.sendTyping = (typing) => { send({ type: 'chat.typing', typing: !!typing }); };
  
    // ---- input ----
    function onKey(e) {
      if (!connected) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      let handled = true;
      const k = e.key.toLowerCase();
      // ---- climb intercept (LOCAL-SELF only) ----
      // While climbing, W/Up drives UP the ladder, S/Down drives DOWN; left/right and jump
      // drop off. When NOT climbing, pressing W/Up into a nearby ladder ENTERS climb mode
      // instead of taking the grid step.
      if (selfEnt && selfEnt._climb) {
        if (k === 'arrowup' || k === 'w') { climbDir = 1; e.preventDefault(); return; }
        if (k === 'arrowdown' || k === 's') { climbDir = -1; e.preventDefault(); return; }
        if (k === 'arrowleft' || k === 'a' || k === 'arrowright' || k === 'd' || k === ' ' || k === 'spacebar') {
          exitClimbToGround(); climbDir = 0; e.preventDefault(); return;   // hop off, resume grid movement
        }
      } else if ((k === 'arrowup' || k === 'w') && selfEnt) {
        const L = findLadder();
        if (L && ladderEnterable(L) && enterClimb(L)) { climbDir = 1; e.preventDefault(); return; }
      }
      // ---- freefall steering (LOCAL-SELF): WASD/arrows steer the skydive; no grid steps ----
      if (selfEnt && selfEnt._skyfall) {
        if (k === 'arrowup' || k === 'w') skyKeys.up = 1;
        else if (k === 'arrowdown' || k === 's') skyKeys.down = 1;
        else if (k === 'arrowleft' || k === 'a') skyKeys.left = 1;
        else if (k === 'arrowright' || k === 'd') skyKeys.right = 1;
        else if (k === ' ' || k === 'spacebar') skyKeys.thrust = 1;   // fire the rocket pack (once earned)
        else return;
        e.preventDefault(); return;
      }
      // Movement is relative to the camera/player view (his up/down/left/right).
      if (k === 'arrowup' || k === 'w') { cancelWalk(); const [x, z] = worldStepFromScreen(0, 1); step(x, z); }
      else if (k === 'arrowdown' || k === 's') { cancelWalk(); const [x, z] = worldStepFromScreen(0, -1); step(x, z); }
      else if (k === 'arrowleft' || k === 'a') { cancelWalk(); const [x, z] = worldStepFromScreen(-1, 0); step(x, z); }
      else if (k === 'arrowright' || k === 'd') { cancelWalk(); const [x, z] = worldStepFromScreen(1, 0); step(x, z); }
      else if (k === ' ' || k === 'spacebar') startJump();
      else if (k === ATTACK_KEY) startAttack();
      // crouch = HOLD 'c' (released on keyup, see onKeyUp); sit = TOGGLE 'x'. These set
      // local-self rig pose flags only; animVoxel reads them. Crouch/sit are v1
      // LOCAL-SELF only (peer sync would need an avatar-state party message — see report).
      else if (k === 'c') { if (selfEnt) selfEnt._crouchHeld = true; }
      else if (k === 'x') { if (selfEnt) selfEnt._sitToggle = !selfEnt._sitToggle; }
      else if (e.code === 'BracketLeft' || k === '[') cycleAvatarClass(-1);
      else if (e.code === 'BracketRight' || k === ']') cycleAvatarClass(1);
      else handled = false;
      if (handled) e.preventDefault();
    }
    function onKeyUp(e) {
      if (!connected) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key.toLowerCase() === 'c' && selfEnt) selfEnt._crouchHeld = false;  // release crouch hold
      // releasing the climb keys stops vertical motion -> the rig holds a static hang pose.
      const ku = e.key.toLowerCase();
      if (selfEnt && selfEnt._climb && (ku === 'w' || ku === 's' || ku === 'arrowup' || ku === 'arrowdown')) climbDir = 0;
      if (selfEnt && selfEnt._skyfall) {
        if (ku === 'arrowup' || ku === 'w') skyKeys.up = 0;
        else if (ku === 'arrowdown' || ku === 's') skyKeys.down = 0;
        else if (ku === 'arrowleft' || ku === 'a') skyKeys.left = 0;
        else if (ku === 'arrowright' || ku === 'd') skyKeys.right = 0;
        else if (ku === ' ' || ku === 'spacebar') skyKeys.thrust = 0;
      }
    }
    function bindInput() { window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp); }
    function unbindInput() { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); }
  
    // ---- minimap ----
    let mapWrap = null, canvas = null, ctx = null, mapResizeHandle = null, mapScaleBadge = null;
    const CELL = 16;
    const MAP_SCALE_LS = 'tinyworld:worlds.map.scale';
    const MAP_MIN_SCALE = 0.25;
    const MAP_MAX_SCALE = 1;
    let mapScale = readMapScale();
    function showMinimap() {
      if (mapWrap) { mapWrap.style.display = 'block'; drawMinimap(); return; }
      if (!document.getElementById('tw-worlds-map-style')) {
        const css = '.tw-worlds-map{position:fixed;right:12px;top:72px;z-index:65;background:rgba(8,11,28,.82);border:1px solid rgba(80,110,200,.22);border-radius:14px;padding:8px;backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);box-shadow:inset 0 1px 0 rgba(120,150,230,.12),0 16px 40px -12px rgba(0,0,20,.55)}'
          + '.tw-worlds-map h4{margin:0 0 6px;font:600 11px \'Space Grotesk\',system-ui,sans-serif;color:#cfe0ff;text-transform:uppercase;letter-spacing:.05em;cursor:grab;user-select:none;display:flex;align-items:center;gap:6px}'
          + '.tw-worlds-map .tw-map-scale{margin-left:auto;font:700 9px ui-monospace,SFMono-Regular,Menlo,monospace;color:#8ea8d8;background:rgba(150,180,255,.12);border:1px solid rgba(150,180,255,.18);border-radius:999px;padding:1px 5px}'
          + '.tw-worlds-map.dragging h4{cursor:grabbing}'
          + '.tw-worlds-map canvas{display:block;border-radius:8px;cursor:pointer;background:#0a1428;image-rendering:pixelated}'
          + '.tw-worlds-map .tw-map-resize{position:absolute;right:3px;bottom:3px;width:17px;height:17px;border-radius:6px 0 11px 0;cursor:nwse-resize;background:linear-gradient(135deg,transparent 0 45%,rgba(205,225,255,.20) 46% 58%,transparent 59%),linear-gradient(135deg,transparent 0 62%,rgba(205,225,255,.34) 63% 76%,transparent 77%);opacity:.82}'
          + '.tw-worlds-map .tw-map-resize:hover{opacity:1;background-color:rgba(120,160,255,.08)}';
        document.head.appendChild(Object.assign(document.createElement('style'), { id: 'tw-worlds-map-style', textContent: css }));
      }
      mapWrap = document.createElement('div'); mapWrap.className = 'tw-worlds-map';
      const h = document.createElement('h4');
      const title = document.createElement('span'); title.textContent = T('worlds.minimap');
      mapScaleBadge = document.createElement('span'); mapScaleBadge.className = 'tw-map-scale';
      h.appendChild(title); h.appendChild(mapScaleBadge);
      canvas = document.createElement('canvas');
      canvas.addEventListener('click', onMapClick);
      mapResizeHandle = document.createElement('div');
      mapResizeHandle.className = 'tw-map-resize';
      mapResizeHandle.title = 'Resize map';
      mapWrap.appendChild(h); mapWrap.appendChild(canvas); mapWrap.appendChild(mapResizeHandle);
      document.body.appendChild(mapWrap);
      restoreMapPos();
      makeMapDraggable(h);
      makeMapResizable(mapResizeHandle);
      ctx = canvas.getContext('2d');
      drawMinimap();
    }
    function hideMinimap() { if (mapWrap) mapWrap.style.display = 'none'; }

    function clampMapScale(v) {
      v = Number(v);
      if (!Number.isFinite(v)) v = 1;
      return Math.max(MAP_MIN_SCALE, Math.min(MAP_MAX_SCALE, v));
    }
    function readMapScale() {
      try { return clampMapScale(localStorage.getItem(MAP_SCALE_LS) || 1); } catch (_) { return 1; }
    }
    function writeMapScale(v) {
      mapScale = clampMapScale(v);
      try { localStorage.setItem(MAP_SCALE_LS, String(mapScale)); } catch (_) {}
      applyMapScale();
    }
    function applyMapScale() {
      if (!canvas) return;
      const base = Math.max(1, gridSize * CELL);
      const px = Math.max(1, Math.round(base * clampMapScale(mapScale)));
      canvas.style.width = px + 'px';
      canvas.style.height = px + 'px';
      if (mapScaleBadge) mapScaleBadge.textContent = Math.round(clampMapScale(mapScale) * 100) + '%';
    }
    function makeMapResizable(handle) {
      if (!handle || !mapWrap) return;
      let startX = 0, startY = 0, startW = 0, resizing = false;
      handle.addEventListener('pointerdown', (e) => {
        resizing = true;
        const r = canvas ? canvas.getBoundingClientRect() : mapWrap.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY; startW = Math.max(1, r.width);
        try { handle.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault(); e.stopPropagation();
      });
      handle.addEventListener('pointermove', (e) => {
        if (!resizing || !canvas) return;
        const base = Math.max(1, gridSize * CELL);
        const delta = Math.max(e.clientX - startX, e.clientY - startY);
        mapScale = clampMapScale((startW + delta) / base);
        applyMapScale();
        e.preventDefault(); e.stopPropagation();
      });
      const end = (e) => {
        if (!resizing) return;
        resizing = false;
        writeMapScale(mapScale);
        if (e) { e.preventDefault(); e.stopPropagation(); }
      };
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    }

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
      const sx = rect.width > 0 ? rect.width / Math.max(1, gridSize) : CELL;
      const sz = rect.height > 0 ? rect.height / Math.max(1, gridSize) : CELL;
      const cx = Math.floor((e.clientX - rect.left) / sx);
      const cz = Math.floor((e.clientY - rect.top) / sz);
      if (cx < 0 || cz < 0 || cx >= gridSize || cz >= gridSize) return;
      // Walk (auto-path) to the clicked tile; the server still validates each
      // one-cell step. Arrow/WASD keys interrupt the walk.
      walkTo(cx, cz);
    }
  
    function terrainColor(t) {
      return t === 'water' ? '#2f6fb0' : t === 'stone' ? '#7d8794' : t === 'sand' ? '#cdb98a'
        : t === 'dirt' ? '#7a5a3a' : t === 'path' ? '#b9a06a' : t === 'lava' ? '#c0431f' : t === 'snow' ? '#e6eef6' : '#3f8f53';
    }

    // Shared isometric 2D tile preview (used by the universe cards in 46). This
    // intentionally avoids Three.js so the Worlds screen can show many islands
    // as cheap pixel-style atlas thumbnails.
    const PREVIEW_PLANTS = new Set(['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower']);
    const PREVIEW_ISO_KIND_COLORS = {
      tree: '#1f6f3a',
      bush: '#2f8b49',
      rock: '#9ba8ae',
      house: '#c76e46',
      fence: '#7a4b2c',
      cow: '#f0d8b8',
      sheep: '#f7f1dc',
    };
    function previewShade(hex, amt) {
      const h = String(hex || '#000000').replace('#', '');
      const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
      const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
      const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
      const b = Math.max(0, Math.min(255, (n & 255) + amt));
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    function previewCellTuple(c) {
      if (!c) return null;
      if (Array.isArray(c)) return { x: c[0], z: c[1], terrain: c[2] || 'grass', kind: c[3] || '' };
      return { x: c.x, z: c.z, terrain: c.terrain || 'grass', kind: c.kind || '' };
    }
    function drawPreviewDiamond(ctx, cx, cy, hw, hh, fill, stroke) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - hh);
      ctx.lineTo(cx + hw, cy);
      ctx.lineTo(cx, cy + hh);
      ctx.lineTo(cx - hw, cy);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    }
    function drawPreviewSide(ctx, cx, cy, hw, hh, depth, side, fill) {
      ctx.beginPath();
      if (side === 'right') {
        ctx.moveTo(cx + hw, cy);
        ctx.lineTo(cx, cy + hh);
        ctx.lineTo(cx, cy + hh + depth);
        ctx.lineTo(cx + hw, cy + depth);
      } else {
        ctx.moveTo(cx - hw, cy);
        ctx.lineTo(cx, cy + hh);
        ctx.lineTo(cx, cy + hh + depth);
        ctx.lineTo(cx - hw, cy + depth);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }
    function drawPreviewObject(ctx, cx, cy, s, kind) {
      const k = PREVIEW_PLANTS.has(kind) ? 'plant' : kind;
      if (k === 'tree' || k === 'bush' || k === 'plant') {
        ctx.fillStyle = k === 'plant' ? '#d5df57' : PREVIEW_ISO_KIND_COLORS[k];
        ctx.beginPath();
        ctx.arc(cx, cy - s * 0.34, s * (k === 'tree' ? 0.22 : 0.16), 0, Math.PI * 2);
        ctx.fill();
        if (k === 'tree') {
          ctx.fillStyle = '#7b5434';
          ctx.fillRect(cx - s * 0.035, cy - s * 0.28, s * 0.07, s * 0.28);
        }
      } else if (k === 'rock') {
        ctx.fillStyle = PREVIEW_ISO_KIND_COLORS.rock;
        drawPreviewDiamond(ctx, cx, cy - s * 0.18, s * 0.16, s * 0.09, '#9ba8ae', '#65737b');
      } else if (k === 'house') {
        ctx.fillStyle = '#c76e46';
        ctx.fillRect(cx - s * 0.18, cy - s * 0.34, s * 0.36, s * 0.26);
        ctx.fillStyle = '#7b3340';
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.22, cy - s * 0.34);
        ctx.lineTo(cx, cy - s * 0.56);
        ctx.lineTo(cx + s * 0.22, cy - s * 0.34);
        ctx.closePath();
        ctx.fill();
      } else if (PREVIEW_ISO_KIND_COLORS[k]) {
        ctx.fillStyle = PREVIEW_ISO_KIND_COLORS[k];
        ctx.fillRect(cx - s * 0.08, cy - s * 0.28, s * 0.16, s * 0.16);
      }
    }
    function renderPreview(cnv, preview) {
      if (!cnv || !preview) return;
      const g = Math.max(1, preview.gridSize || 8);
      const suppliedList = Array.isArray(preview.cells) ? preview.cells : [];
      const list = suppliedList.map(previewCellTuple).filter(Boolean);
      const cssW = cnv.clientWidth || cnv.width || 320;
      const cssH = cnv.clientHeight || cnv.height || 200;
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      cnv.width = Math.round(cssW * dpr); cnv.height = Math.round(cssH * dpr);
      const c2 = cnv.getContext('2d');
      c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      c2.clearRect(0, 0, cssW, cssH);
      const bg = c2.createLinearGradient(0, 0, 0, cssH);
      bg.addColorStop(0, '#070911');
      bg.addColorStop(1, '#030509');
      c2.fillStyle = bg;
      c2.fillRect(0, 0, cssW, cssH);
      c2.fillStyle = 'rgba(169,199,255,.22)';
      for (let i = 0; i < 26; i++) {
        const sx = (i * 47 + g * 13) % Math.max(1, cssW);
        const sy = (i * 31 + g * 7) % Math.max(1, cssH);
        c2.fillRect(sx, sy, 1, 1);
      }
      const map = new Map();
      for (let z = 0; z < g; z++) for (let x = 0; x < g; x++) map.set(x + ',' + z, { x, z, terrain: 'grass', kind: '' });
      for (const cell of list) {
        const x = Number(cell.x), z = Number(cell.z);
        if (!Number.isFinite(x) || !Number.isFinite(z) || x < 0 || z < 0 || x >= g || z >= g) continue;
        map.set(x + ',' + z, cell);
      }
      const tileW = Math.max(14, Math.min(30, cssW / (g + 2.4)));
      const tileH = tileW * 0.5;
      const depth = Math.max(8, tileH * 0.9);
      const originX = cssW * 0.5;
      const originY = Math.max(18, (cssH - (g * tileH + depth)) * 0.38);
      const sorted = Array.from(map.values()).sort((a, b) => ((Number(a.x) + Number(a.z)) - (Number(b.x) + Number(b.z))) || (Number(a.z) - Number(b.z)));
      for (const cell of sorted) {
        const x = Number(cell.x), z = Number(cell.z);
        const cx = originX + (x - z) * tileW * 0.5;
        const cy = originY + (x + z) * tileH * 0.5;
        const top = terrainColor(cell.terrain);
        if (!map.has((x + 1) + ',' + z)) drawPreviewSide(c2, cx, cy, tileW * 0.5, tileH * 0.5, depth, 'right', previewShade(top, -62));
        if (!map.has(x + ',' + (z + 1))) drawPreviewSide(c2, cx, cy, tileW * 0.5, tileH * 0.5, depth, 'left', previewShade(top, -42));
      }
      for (const cell of sorted) {
        const x = Number(cell.x), z = Number(cell.z);
        const cx = originX + (x - z) * tileW * 0.5;
        const cy = originY + (x + z) * tileH * 0.5;
        const top = terrainColor(cell.terrain);
        drawPreviewDiamond(c2, cx, cy, tileW * 0.5, tileH * 0.5, top, 'rgba(3,5,9,.36)');
      }
      for (const cell of sorted) {
        if (!cell.kind) continue;
        const x = Number(cell.x), z = Number(cell.z);
        const cx = originX + (x - z) * tileW * 0.5;
        const cy = originY + (x + z) * tileH * 0.5;
        drawPreviewObject(c2, cx, cy, tileW, cell.kind);
      }
    }
    WS.renderPreview = renderPreview;

    // ---- in-world avatars: 2.5D animated sprite-sheet billboards (models/people/25D) ----
    // Each sheet is 8 direction-rows x N frame-cols of 64x64 cells. Facing comes from
    // the movement direction (8-way); state is idle vs walk. No fallback — if a sheet
    // fails to load we surface an error.
    const SHEET = {
      idle: { baseUrl: 'models/people/25D/idle/Sprite Sheet/idle full sprite sheet (transparent BG).png', sw: 768, sh: 512, frame: 64, cols: 12, fps: 8 },
      walk: { baseUrl: 'models/people/25D/walk/Sprite Sheet/walk complete sprite sheet (transparent BG).png', sw: 512, sh: 512, frame: 64, cols: 8, fps: 12 },
      attack: { baseUrl: 'models/people/25D/attack/Sprite Sheet/attack full sprite sheet (transparent BG).png', sw: 672, sh: 768, frame: 96, cols: 7, fps: 16 },
    };
    const AVATAR_CLASSES = ['knight', 'baird', 'wizard', 'knave', 'template'];
    // open-pets pets (vendored under models/pets/<id>/, @open-pets/pet-format atlas).
    // Mutually exclusive with classes: a selected pet renders as a billboard using its
    // idle / left / right animation frame ranges (not 8-directional). frame index ->
    // col = f % cols, row = floor(f / cols) within a cols x rows atlas.
    const PETS = {
      boba: {
        id: 'boba', sheet: 'models/pets/boba/spritesheet.webp', cols: 8, rows: 9, aspect: 192 / 208,
        anims: {
          idle: { f: [0, 1, 2, 3, 4, 5], fps: 5 },
          left: { f: [8, 9, 10, 11, 12, 13, 14, 15], fps: 10 },
          right: { f: [16, 17, 18, 19, 20, 21, 22, 23], fps: 10 },
        },
      },
    };
    // ---- side-view STRIP avatars (hybrid) ----
    // Texture storage like the class path (ent.tex = {idle,walk,run,attack}, swap
    // material.map per state); animation like the pet path (named anim, single facing,
    // flip L/R via scale.x sign). Sheets are 64px grids with animation frames in
    // columns and direction rows stacked vertically; sample one row, never the full
    // 256px column, or the avatar renders as four stacked bodies.
    const STRIPS = (function buildStrips() {
      const out = {};
      // Swordsman levels 1-6 (provider 'warriors'). lv1-3 use the long 'Swordsman_lvlN_'
      // prefix; lv4-6 use the short 'lvlN_' prefix. attack frames: lv1-3 = 8, lv4-6 = 7.
      const swDir = function (n) { return 'models/people/swordsman/PNG/Swordsman_lvl' + n + '/Without_shadow/'; };
      for (let n = 1; n <= 6; n++) {
        const pre = n <= 3 ? ('Swordsman_lvl' + n + '_') : ('lvl' + n + '_');
        const atkF = n <= 3 ? 8 : 7;
        out['swordsman-l' + n] = {
          id: 'swordsman-l' + n, aspect: 1, facing: 'right',
          anims: {
            idle: { sheet: swDir(n) + pre + 'Idle_without_shadow.png', fw: 64, fh: 64, frames: 12, rows: 4, row: 0, fps: 7 },
            walk: { sheet: swDir(n) + pre + 'Walk_without_shadow.png', fw: 64, fh: 64, frames: 6, rows: 4, row: 0, fps: 10 },
            run: { sheet: swDir(n) + pre + 'Run_without_shadow.png', fw: 64, fh: 64, frames: 8, rows: 4, row: 0, fps: 12 },
            attack: { sheet: swDir(n) + pre + 'attack_without_shadow.png', fw: 64, fh: 64, frames: atkF, rows: 4, row: 0, fps: 14 },
          },
        };
      }
      // Orcs 1-3 (provider 'orcs'). No 'run'. attack = 8 frames.
      for (let n = 1; n <= 3; n++) {
        const oDir = 'models/people/orcs/PNG/Orc' + n + '/Without_shadow/';
        out['orc-' + n] = {
          id: 'orc-' + n, aspect: 1, facing: 'right',
          anims: {
            idle: { sheet: oDir + 'orc' + n + '_idle_without_shadow.png', fw: 64, fh: 64, frames: 4, rows: 4, row: 0, fps: 7 },
            walk: { sheet: oDir + 'orc' + n + '_walk_without_shadow.png', fw: 64, fh: 64, frames: 6, rows: 4, row: 0, fps: 10 },
            attack: { sheet: oDir + 'orc' + n + '_attack_without_shadow.png', fw: 64, fh: 64, frames: 8, rows: 4, row: 0, fps: 12 },
          },
        };
      }
      return out;
    })();
    const JUMP_MS = 460, ATTACK_KEY = 'f';
    // Sheet row (top->bottom) for each movement sector. Sectors: 0=S 1=SE 2=E 3=NE
    // 4=N 5=NW 6=W 7=SW. If a character faces the wrong way, reorder this array.
    const SECTOR_TO_ROW = [0, 1, 2, 3, 4, 5, 6, 7];
    // 4-row side-view sheets use the common down/left/right/up order.
    const STRIP_SECTOR_TO_ROW = [0, 0, 2, 3, 3, 3, 1, 0];
    let selfEnt = null;
    const peerEnts = new Map();
    let avatarRaf = null;
    let avatarErrored = false;
    const AVATAR_CLASS_LS = 'tinyworld:multiplayer:avatar-class';
    function savedAvatarClass() { try { const v = localStorage.getItem(AVATAR_CLASS_LS); return v || 'knight'; } catch (_) { return 'knight'; } }
    let avatarClassName = savedAvatarClass();
    let avatarPetId = null; // non-null => pet mode (overrides class)
    let avatarStripId = null; // non-null => strip mode (overrides class). Mutually exclusive with avatarPetId.
    let _texLoader = null;
    // The player's NETWORKED voxel identity: a fully-resolved descriptor sent in
    // world.join so every other client renders THIS player's chosen look (not a
    // local id-seed). Defaults to a descriptor seeded from a stable per-browser id
    // (persisted like the class choice) so a fresh visitor still looks consistent
    // across reloads. myId is NOT available at join time (it arrives in `welcome`
    // AFTER the join envelope is sent), so the seed must be a local id.
    const AVATAR_VOXEL_LS = 'tinyworld:multiplayer:avatar-voxel-seed';
    const AVATAR_VOXEL_DESC_LS = 'tinyworld:multiplayer:avatar-voxel';
    function numericSeedFromString(s) {
      s = String(s == null ? 'avatar' : s);
      let h = 2166136261 >>> 0;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return h >>> 0;
    }
    function stableVoxelSeed() {
      try {
        let v = localStorage.getItem(AVATAR_VOXEL_LS);
        if (!v) { v = String(Math.floor(Math.random() * 0xffffffff) >>> 0); localStorage.setItem(AVATAR_VOXEL_LS, v); }
        const n = Number(v);
        if (Number.isFinite(n)) return n >>> 0;
        // Migrate older string seeds ("vabc123") to a numeric seed so the server
        // and voxel rig do not collapse every default avatar to seed 0.
        const migrated = numericSeedFromString(v);
        localStorage.setItem(AVATAR_VOXEL_LS, String(migrated));
        return migrated;
      } catch (_) { return Math.floor(Math.random() * 0xffffffff) >>> 0; }
    }
    function readStoredAvatarDescriptor() {
      try {
        const raw = localStorage.getItem(AVATAR_VOXEL_DESC_LS);
        if (!raw) return null;
        const desc = JSON.parse(raw);
        return desc && typeof desc === 'object' ? desc : null;
      } catch (_) { return null; }
    }
    function writeStoredAvatarDescriptor(desc) {
      if (!desc || typeof desc !== 'object') return;
      try { localStorage.setItem(AVATAR_VOXEL_DESC_LS, JSON.stringify(desc)); } catch (_) {}
    }
    // Resolved LAZILY: 53-voxel-avatar.js loads AFTER this file, so
    // window.voxelAvatarDescriptor is undefined at 47's module-load time. Resolving
    // eagerly here would collapse every player's default to a single seed. All read
    // sites fire at join/render time (post-load), so getSelfAvatarDescriptor() sees
    // the real 53 helper and seeds from the stable per-browser id => distinct defaults.
    let selfAvatarDescriptor = null;
    function getSelfAvatarDescriptor() {
      if (!selfAvatarDescriptor) {
        const stored = readStoredAvatarDescriptor();
        const source = stored || { seed: stableVoxelSeed() };
        selfAvatarDescriptor = (typeof window !== 'undefined' && typeof window.voxelAvatarDescriptor === 'function')
          ? window.voxelAvatarDescriptor(source)
          : Object.assign({ kind: 'voxel' }, source);
        if (stored) writeStoredAvatarDescriptor(selfAvatarDescriptor);
      }
      return selfAvatarDescriptor;
    }

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
    function startAttack() { if (selfEnt && selfEnt.sprite && !selfEnt.attacking) { selfEnt.attacking = true; selfEnt.state = 'attack'; selfEnt.frame = 0; selfEnt.frameTime = 0; if (selfEnt.voxel) { selfEnt.voxel.setState('attack'); } else if (selfEnt.sprite.material) { selfEnt.sprite.material.map = selfEnt.tex.attack; } } }
    function startJump() { if (selfEnt && !selfEnt.jumpStart) selfEnt.jumpStart = Date.now(); }
    // Preview the freefall/rocket postures on the local avatar without the full skyfall.
    // Console: __tinyworldWorlds.previewPose('skydive' | 'rocket' | 'idle'). The FALL
    // CONTROLLER owns body pitch (face-down for skydive, upright for rocket) per the rig's
    // ownership contract; the rig state poses limbs.
    function previewPose(state) {
      if (!selfEnt || !selfEnt.voxel) return false;
      const v = selfEnt.voxel;
      if (state === 'skydive') { v.setBodyPitch(SKY_DIVE_BODY_PITCH); v.setState('skydive'); if (v.setRocketVisible) v.setRocketVisible(false); }
      else if (state === 'rocket') { v.setBodyPitch(0); v.setState('rocket'); if (v.setRocketVisible) { v.setRocketVisible(true); v.setThrusting(true); } }
      else { v.setBodyPitch(0); v.setState('idle'); if (v.setRocketVisible) v.setRocketVisible(false); }
      return true;
    }
    WS.previewPose = previewPose;
    function avatarError(msg) {
      if (avatarErrored) return; avatarErrored = true;
      try { console.error('[worlds] avatar sprite failed:', msg); } catch (_) {}
      toast('Avatar sprites failed to load');
    }
    function avatarSheetUrl(action, className) {
      const s = SHEET[action];
      if (className && className !== 'template') return 'models/people/25D/classes/' + encodeURIComponent(className) + '/' + action + '.png';
      return s.baseUrl;
    }
    function loadSheetTexture(url) {
      _texLoader = _texLoader || new THREE.TextureLoader();
      const t = _texLoader.load(url, undefined, undefined, () => avatarError(url));
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
      if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      else if ('encoding' in t && THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
      return t;
    }
    function disposeAvatarTextures(ent) {
      if (!ent || !ent.tex) return;
      Object.keys(ent.tex).forEach(k => { if (ent.tex[k] && typeof ent.tex[k].dispose === 'function') ent.tex[k].dispose(); });
      ent.tex = {};
    }
    function loadAvatarTextures(ent, className) {
      if (!ent) return;
      disposeAvatarTextures(ent);
      ent.pet = null; // leaving pet mode
      ent.strip = null; // leaving strip mode
      ent.avatarClassName = className;
      for (const k of Object.keys(SHEET)) {
        const s = SHEET[k];
        const t = loadSheetTexture(avatarSheetUrl(k, className));
        t.repeat.set(s.frame / s.sw, s.frame / s.sh);
        t.offset.set(0, 1 - s.frame / s.sh);
        ent.tex[k] = t;
      }
      if (ent.sprite && ent.sprite.material) {
        ent.sprite.material.map = ent.tex[ent.state] || ent.tex.idle;
        ent.sprite.scale.set(1.7, 1.7, 1); // restore class sprite size (pet mode rescales)
      }
    }
    function setAvatarClass(name) {
      const next = AVATAR_CLASSES.includes(name) ? name : 'knight';
      avatarClassName = next;
      try { localStorage.setItem(AVATAR_CLASS_LS, next); } catch (_) {}
      avatarPetId = null; // class, pet and strip avatars are mutually exclusive
      avatarStripId = null;
      if (selfEnt) loadAvatarTextures(selfEnt, avatarClassName);
      return avatarClassName;
    }
    function cycleAvatarClass(delta) {
      const current = Math.max(0, AVATAR_CLASSES.indexOf(avatarClassName));
      return setAvatarClass(AVATAR_CLASSES[(current + delta + AVATAR_CLASSES.length) % AVATAR_CLASSES.length]);
    }
    // ---- pet avatars (open-pets billboards) ----
    function loadPetTextures(ent, pet) {
      if (!ent || !pet) return;
      disposeAvatarTextures(ent);
      ent.pet = pet; ent.strip = null; ent.avatarClassName = null; ent._petAnim = null; ent.frame = 0; ent.frameTime = 0;
      const t = loadSheetTexture(pet.sheet);
      t.repeat.set(1 / pet.cols, 1 / pet.rows);
      t.offset.set(0, 1 - 1 / pet.rows); // frame 0 (top-left)
      ent.tex = { pet: t };
      if (ent.sprite && ent.sprite.material) {
        ent.sprite.material.map = t; ent.sprite.material.needsUpdate = true;
        const s = 1.9; ent.sprite.scale.set(s * pet.aspect, s, 1);
      }
    }
    function setAvatarPet(petId) {
      const pet = PETS[petId];
      if (!pet) return null;
      avatarPetId = petId;
      avatarStripId = null; // pet and strip avatars are mutually exclusive
      if (selfEnt) loadPetTextures(selfEnt, pet);
      return avatarPetId;
    }
    // ---- strip avatars (side-view hybrid: class-style tex storage, pet-style anim) ----
    function loadStripTextures(ent, strip) {
      if (!ent || !strip) return;
      disposeAvatarTextures(ent);
      ent.strip = strip; ent.pet = null; ent.avatarClassName = null;
      ent.state = 'idle'; ent.frame = 0; ent.frameTime = 0;
      ent.tex = {};
      for (const k of Object.keys(strip.anims)) {
        const anim = strip.anims[k];
        const t = loadSheetTexture(anim.sheet);
        t.repeat.set(1 / anim.frames, 1 / (anim.rows || 1));
        setStripTextureFrame(t, anim, 0);
        ent.tex[k] = t;
      }
      if (ent.sprite && ent.sprite.material) {
        ent.sprite.material.map = ent.tex[ent.state] || ent.tex.idle;
        ent.sprite.material.needsUpdate = true;
        const s = 2.0; ent.sprite.scale.set(s * strip.aspect, s, 1);
      }
    }
    function setAvatarStrip(id) {
      const strip = STRIPS[id];
      if (!strip) return null;
      avatarStripId = id;
      avatarPetId = null; // strip and pet avatars are mutually exclusive
      if (selfEnt) loadStripTextures(selfEnt, strip);
      return avatarStripId;
    }
    function stripRowForSector(sector) {
      const idx = Number.isFinite(sector) ? Math.max(0, Math.min(7, sector | 0)) : 0;
      return STRIP_SECTOR_TO_ROW[idx] || 0;
    }
    function setStripTextureFrame(tex, anim, frame, sector) {
      if (!tex || !anim) return;
      const rows = Math.max(1, anim.rows || 1);
      const row = Math.max(0, Math.min(rows - 1, sector == null ? (anim.row || 0) : stripRowForSector(sector)));
      tex.offset.set((frame || 0) / anim.frames, 1 - (row + 1) / rows);
    }
    WS.setAvatarClass = setAvatarClass;
    WS.cycleAvatarClass = cycleAvatarClass;
    WS.avatarClasses = () => AVATAR_CLASSES.slice();
    WS.avatarClass = () => ((avatarPetId || avatarStripId) ? null : avatarClassName);
    WS.setAvatarPet = setAvatarPet;
    WS.avatarPet = () => avatarPetId;
    WS.pets = () => Object.keys(PETS);
    WS.setAvatarStrip = setAvatarStrip;
    WS.avatarStrip = () => avatarStripId;
    WS.strips = () => Object.keys(STRIPS);
    // ---- voxel avatar identity (networked) ----
    // Set the player's chosen voxel look. Unlike class/pet/strip (which swap textures
    // in place), a voxel body is BAKED at makeVoxelAvatar construction — there is no
    // in-place swap — so the self entity must be rebuilt. The descriptor is stored and
    // persisted for future joins and, when already connected, sent immediately so peers
    // rebuild the look in the current session.
    function setAvatarVoxel(desc) {
      if (!desc || typeof desc !== 'object') return null;
      const resolved = (typeof window !== 'undefined' && typeof window.voxelAvatarDescriptor === 'function')
        ? window.voxelAvatarDescriptor(desc)
        : desc;
      selfAvatarDescriptor = resolved;
      writeStoredAvatarDescriptor(resolved);
      // Persist to the logged-in account so the chosen look follows the player
      // across devices. Fire-and-forget — the local write above is the offline
      // source of truth; a failed save just isn't cross-device until next save.
      try {
        if (typeof window !== 'undefined' && window.__loggedIn && typeof window.__tinyworldCloudApiCall === 'function') {
          window.__tinyworldCloudApiCall('/api/avatar', 'PUT', { avatar: resolved }).catch(() => {});
        }
      } catch (_) {}
      if (selfEnt) { disposeEntity(selfEnt); selfEnt = null; updateSelfAvatar(); }
      try { if (connected && socket && socket.readyState === WebSocket.OPEN) send({ type: 'world.avatar', avatar: resolved }); } catch (_) {}
      return selfAvatarDescriptor;
    }
    WS.setAvatarVoxel = setAvatarVoxel;
    WS.avatarVoxel = () => getSelfAvatarDescriptor();
    // Voxel avatars (real 3D voxel people) replace the 2.5D sprite "stripes" when the
    // builder module is loaded. Opt out with ?voxel=0 to fall back to sprites.
    function voxelAvatarsOn() {
      if (typeof window === 'undefined' || typeof window.makeVoxelAvatar !== 'function') return false;
      try { return new URLSearchParams(location.search).get('voxel') !== '0'; } catch (_) { return true; }
    }
    // A fresh texture per avatar+sheet so each can hold its own frame/row offset.
    // `idOrDescriptor` is EITHER a networked voxel descriptor ({ kind:'voxel', ... } —
    // a player's chosen look) OR a string id (peer/self) used purely as a seed so each
    // person renders DISTINCT even with no chosen identity. A descriptor wins; a string
    // becomes { seed: id }. Backward compatible with the old seed-only call.
    function createAvatar(idOrDescriptor) {
      const isDesc = idOrDescriptor && typeof idOrDescriptor === 'object';
      const voxOpts = isDesc
        ? idOrDescriptor
        : { seed: numericSeedFromString(idOrDescriptor != null ? idOrDescriptor : ('a' + Math.floor(Math.random() * 1e9))) };
      const ent = { x: 0, z: 0, sector: 0, lastMove: 0, lastDx: 0, lastDz: 0, state: 'idle', frame: 0, frameTime: 0, tex: {}, sprite: null, voxel: null, disposed: false, avatarClassName };
      if (typeof THREE === 'undefined') { avatarError('THREE unavailable'); return ent; }
      if (voxelAvatarsOn()) {
        try {
          ent.voxel = window.makeVoxelAvatar(voxOpts);
          if (ent.voxel && ent.voxel.group) {
            ent.sprite = ent.voxel.group;            // alias so placeEntity/moveEntity/bubble keep working
            ent.sprite.renderOrder = 10;
            const par0 = avatarParent(); if (par0) par0.add(ent.sprite);
            return ent;
          }
          ent.voxel = null;
        } catch (e) { try { console.warn('[worlds] voxel avatar failed, using sprite:', e); } catch (_) {} ent.voxel = null; }
      }
      loadAvatarTextures(ent, avatarClassName);
      const mat = new THREE.SpriteMaterial({ map: ent.tex.idle, transparent: true, depthWrite: false, alphaTest: 0.2 });
      ent.sprite = new THREE.Sprite(mat);
      ent.sprite.center.set(0.5, 0.12);  // anchor near the feet (cells have transparent padding below)
      ent.sprite.scale.set(1.7, 1.7, 1);
      ent.sprite.renderOrder = 10;
      const par = avatarParent(); if (par) par.add(ent.sprite);
      return ent;
    }
    // Surface height for a cell's tile top (world Y). Sprites are billboards anchored
    // with center(0.5,0.12) so they used a flat 0.02; a solid voxel body must plant its
    // feet on the ACTUAL tile top, which varies with terrain/floors.
    const _wsGroundBox = (typeof THREE !== 'undefined') ? new THREE.Box3() : null;
    function voxelGroundY(x, z) {
      if (typeof cellMeshes === 'undefined' || !_wsGroundBox) return 0.02;
      const cm = cellMeshes[x + ',' + z];
      if (cm && cm.tile) {
        _wsGroundBox.setFromObject(cm.tile);
        if (isFinite(_wsGroundBox.max.y)) return _wsGroundBox.max.y;
      }
      // Tile baked away (static lobby): use the height cached at bake time.
      if (cm && typeof cm.bakedGroundY === 'number') return cm.bakedGroundY;
      return 0.02;
    }
    function placeEntity(ent) {
      if (!ent || !ent.sprite || typeof tilePos !== 'function') return;
      const p = tilePos(ent.x, ent.z);
      const gy = ent.voxel ? voxelGroundY(ent.x, ent.z) : 0.02;
      ent.groundY = gy;
      if (ent.voxel) {
        // Voxel avatars GLIDE to the new tile (animVoxel tweens toward this target);
        // snap only on first spawn so they don't moon-walk in from the origin.
        ent.tx = p.x; ent.tz = p.z; ent.ty = gy;
        if (!ent._placed) { ent.sprite.position.set(p.x, gy, p.z); ent._yc = gy; ent._placed = true; }
      } else {
        ent.sprite.position.set(p.x, gy, p.z);
      }
    }
    function moveEntity(ent, x, z) {
      if (!ent) return;
      const dx = x - ent.x, dz = z - ent.z;
      const s = screenSector(dx, dz); if (s != null) ent.sector = s;
      if (dx || dz) {
        ent.lastMove = Date.now();
        ent.lastDx = dx;
        ent.lastDz = dz;
      }
      ent.x = x; ent.z = z; placeEntity(ent);
    }
    function disposeEntity(ent) {
      if (!ent) return; ent.disposed = true;
      removeBubble(ent);
      if (ent.voxel) {
        try { ent.voxel.dispose(); } catch (_) {}        // disposes own geometry + material, removes from parent
        ent.voxel = null; ent.sprite = null;
      } else if (ent.sprite) {
        if (ent.sprite.parent) ent.sprite.parent.remove(ent.sprite);
        if (ent.sprite.material) ent.sprite.material.dispose();  // SpriteMaterial is per-entity, not shared
      }
      disposeAvatarTextures(ent);
    }
    // Pet billboards animate via named anims (idle / left / right), not 8-way sheets.
    function animPet(ent, dt) {
      const pet = ent.pet, tex = ent.tex && ent.tex.pet;
      if (!pet || !tex) return;
      const moving = (Date.now() - ent.lastMove) < 200;
      const name = moving ? (ent.lastDx < 0 ? 'left' : 'right') : 'idle';
      const anim = pet.anims[name] || pet.anims.idle;
      if (ent._petAnim !== name) { ent._petAnim = name; ent.frame = 0; ent.frameTime = 0; }
      ent.frameTime += dt;
      const fdur = 1 / (anim.fps || 6);
      while (ent.frameTime >= fdur) { ent.frameTime -= fdur; ent.frame = (ent.frame + 1) % anim.f.length; }
      const f = anim.f[ent.frame] | 0;
      const col = f % pet.cols, rw = (f / pet.cols) | 0;
      tex.offset.set(col / pet.cols, 1 - (rw + 1) / pet.rows);
      let py = 0.02;
      if (ent.jumpStart) { const jt = (Date.now() - ent.jumpStart) / JUMP_MS; if (jt >= 1) ent.jumpStart = 0; else py += Math.sin(jt * Math.PI) * 0.8; }
      ent.sprite.position.y = py;
    }
    // Strip billboards: hybrid. State (attack/walk/idle) drives which tex.map is bound
    // (class-style); a single horizontal row of frames is advanced (pet-style) and the
    // sprite is flipped L/R via scale.x SIGN (never negative repeat).
    function animStrip(ent, dt) {
      const strip = ent.strip;
      const s = 2.0;
      if (!strip || !ent.tex) return;
      const moving = (Date.now() - ent.lastMove) < 200;
      let state = ent.attacking ? 'attack' : (moving ? 'walk' : 'idle');
      if (state === 'walk' && !strip.anims.walk) state = 'idle';
      const anim = strip.anims[state] || strip.anims.idle;
      if (state !== ent.state) {
        ent.state = state; ent.frame = 0; ent.frameTime = 0;
        ent.sprite.material.map = ent.tex[state] || ent.tex.idle;
        ent.sprite.material.needsUpdate = true;
      }
      ent.frameTime += dt;
      const fdur = 1 / (anim.fps || 6);
      while (ent.frameTime >= fdur) {
        ent.frameTime -= fdur; ent.frame += 1;
        if (ent.frame >= anim.frames) { ent.frame = 0; if (ent.attacking) ent.attacking = false; } // attack plays once
      }
      const tex = ent.tex[ent.state] || ent.tex.idle;
      setStripTextureFrame(tex, anim, ent.frame, ent.sector);
      ent.sprite.scale.x = Math.abs(s * strip.aspect);
      let py = 0.02;
      if (ent.jumpStart) { const jt = (Date.now() - ent.jumpStart) / JUMP_MS; if (jt >= 1) ent.jumpStart = 0; else py += Math.sin(jt * Math.PI) * 0.8; }
      ent.sprite.position.y = py;
    }
    // Voxel avatars: glide (tween) toward the target tile, driving the walk cycle while
    // translating and idle on arrival. Heading faces the actual direction of travel.
    // Attack is one-shot inside the rig — do not re-trigger it.
    const VOXEL_WALK_SPEED = 1.8;   // world units/sec between tiles
    function animVoxel(ent, dt) {
      const pos = ent.sprite.position;
      // ---- climb mode (LOCAL-SELF only): owns position.y + the 'climb' rig pose, and
      // short-circuits the grid tween/state logic below so it can't yank the avatar back
      // to its base tile while it's on the ladder. ----
      if (ent === selfEnt && ent._skyfall) { stepSkyfall(ent, dt); updateBubble(ent); return; }
      if (ent === selfEnt && ent._srActive) { _srStep(dt); updateBubble(ent); return; }
      if (ent === selfEnt && ent._climb) { stepClimb(ent, dt); updateBubble(ent); return; }
      // portal travel (LOCAL-SELF): 56's travel() owns the avatar's position + pose during
      // the dissolve/emerge; cede the grid tween so it can't fight the effect.
      if (ent === selfEnt && ent._traveling) { updateBubble(ent); return; }
      const tx = (ent.tx != null) ? ent.tx : pos.x;
      const tz = (ent.tz != null) ? ent.tz : pos.z;
      const ty = (ent.ty != null) ? ent.ty : (ent.groundY != null ? ent.groundY : 0.02);
      const dxw = tx - pos.x, dzw = tz - pos.z;
      const dist = Math.hypot(dxw, dzw);
      let moving = false;
      if (dist > 2.5) {                          // teleport / respawn — snap, don't slide across the map
        pos.x = tx; pos.z = tz;
      } else if (dist > 0.012) {
        const step = Math.min(dist, VOXEL_WALK_SPEED * dt);
        pos.x += (dxw / dist) * step; pos.z += (dzw / dist) * step;
        moving = true;
        ent.voxel.setHeadingFromDelta(dxw, dzw);
      }
      // Jump: fire the rig's jump pose on the rising edge of ent.jumpStart (set by
      // startJump / a peer jump). The pose (crouch -> launch -> land, arms + legs
      // bending) is self-timed inside the rig and auto-returns to idle.
      if (ent.jumpStart && !ent._jumpPrev) ent.voxel.setState('jump');
      ent._jumpPrev = !!ent.jumpStart;
      const rigState = ent.voxel.getState();
      // attack and jump are one-shot poses owned by the rig — don't stomp them with
      // walk/idle each frame (the rig clears back to idle when the pose finishes).
      if (rigState !== 'attack' && rigState !== 'jump') {
        if (ent.attacking) ent.attacking = false;          // rig finished the swing
        // crouch (hold 'c') / sit (toggle 'x') are LOCAL-SELF only (v1). Precedence,
        // re-evaluated each frame: moving -> walk (this also clears the sit toggle so
        // you stand up when you move); else crouch-held; else sit-toggled; else idle.
        let want;
        if (moving) { want = 'walk'; if (ent === selfEnt) ent._sitToggle = false; }
        else if (ent === selfEnt && ent._crouchHeld) want = 'crouch';
        else if (ent === selfEnt && ent._sitToggle) want = 'sit';
        else want = 'idle';
        ent.voxel.setState(want); ent.state = want;
      }
      ent.voxel.update(dt);
      // vertical: ease toward the target tile's ground height, then add the jump arc
      ent._yc = (ent._yc != null) ? ent._yc + (ty - ent._yc) * Math.min(1, dt * 10) : ty;
      let y = ent._yc;
      if (ent.jumpStart) { const jt = (Date.now() - ent.jumpStart) / JUMP_MS; if (jt >= 1) ent.jumpStart = 0; else y = ent._yc + Math.sin(jt * Math.PI) * 0.3; }
      pos.y = y;
      updateBubble(ent);
    }
    function animEntity(ent, dt) {
      if (!ent.sprite) return;
      // Freefall takes over the local avatar regardless of render type (voxel/sprite/strip),
      // so dispatch it HERE — not inside animVoxel, which only runs for voxel avatars and
      // would leave a sprite-avatar skyfall frozen (HUD up, no fall). Posture is voxel-only
      // (stepSkyfall guards on ent.voxel); a sprite avatar still falls + threads rings.
      if (ent === selfEnt && ent._skyfall) { stepSkyfall(ent, dt); updateBubble(ent); return; }
      if (ent === selfEnt && ent._srActive) { _srStep(dt); updateBubble(ent); return; }
      if (ent.voxel) { animVoxel(ent, dt); return; }
      if (ent.strip) { animStrip(ent, dt); return; }
      if (ent.pet) { animPet(ent, dt); return; }
      const state = ent.attacking ? 'attack' : ((Date.now() - ent.lastMove) < 200 ? 'walk' : 'idle');
      if (state !== ent.state) { ent.state = state; ent.frame = 0; ent.frameTime = 0; ent.sprite.material.map = ent.tex[state]; }
      const sh = SHEET[state];
      ent.frameTime += dt;
      const fdur = 1 / sh.fps;
      while (ent.frameTime >= fdur) {
        ent.frameTime -= fdur; ent.frame += 1;
        if (ent.frame >= sh.cols) { ent.frame = 0; if (ent.attacking) ent.attacking = false; }   // attack plays once
      }
      const row = SECTOR_TO_ROW[ent.sector] || 0;
      ent.tex[ent.state].offset.set(ent.frame * (sh.frame / sh.sw), 1 - (row + 1) * (sh.frame / sh.sh));
      let y = 0.02;
      if (ent.jumpStart) { const jt = (Date.now() - ent.jumpStart) / JUMP_MS; if (jt >= 1) ent.jumpStart = 0; else y += Math.sin(jt * Math.PI) * 0.8; }
      ent.sprite.position.y = y;
      updateBubble(ent);
    }
    function avatarAngleLerp(a, b, t) {
      const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
      return a + d * t;
    }
    // Avatar's last rendered XZ — the camera follows only while it actually changes
    // (i.e. while walking), so a standing player can pan freely without snap-back.
    let _camFollowLastX = null, _camFollowLastZ = null;
    function updateAvatarCameraOrbit(dt) {
      if (!selfEnt || !selfEnt.sprite) return;
      // Freefall: hand the camera to the 3rd-person chase rig (behind + above the avatar).
      if (selfEnt._skyfall) {
        if (typeof target !== 'undefined' && target) {     // keep the orbit target sane for landing
          target.x = selfEnt.sprite.position.x; target.z = selfEnt.sprite.position.z; target.y = 0;
        }
        updateSkyfallCamera();
        return;
      }
      // Surface roam: use the drag-look chase cam.
      if (selfEnt._srActive) {
        _srUpdateCamera();
        return;
      }
      if (typeof updateCamera !== 'function' || typeof target === 'undefined' || !target) return;
      // Follow the RENDERED position (tweened for voxel) so the camera glides with the
      // avatar — BUT only while the avatar is actually MOVING. When it's idle, leave the
      // target wherever the player panned it so they can look around the island without
      // the view snapping back to the avatar. (Position only; the player owns the orbit.)
      const px = selfEnt.sprite.position.x, pz = selfEnt.sprite.position.z;
      const moving = _camFollowLastX === null
        || Math.hypot(px - _camFollowLastX, pz - _camFollowLastZ) > 0.0015;
      _camFollowLastX = px; _camFollowLastZ = pz;
      if (moving) {
        target.x += (px - target.x) * 0.15;
        target.z += (pz - target.z) * 0.15;
        target.y += (0 - target.y) * 0.18;                // restore ground level after a landing
      }
      updateCamera();
    }

    // ---- speech bubbles: a chat line shown above an avatar in an 8-bit pixel
    // font (Press Start 2P, vendored). Rendered to a CanvasTexture on a billboard
    // sprite so it always faces the camera and rides the jump arc. Auto-fades. ----
    const BUBBLE_FONT = "'Press Start 2P'";
    const BUBBLE_MS = 5200;        // visible before fade
    const BUBBLE_FADE_MS = 700;    // fade-out tail
    const BUBBLE_MAX_CHARS = 90;   // cap the shown text
    const BUBBLE_HEAD_Y = 1.24;    // world-units above the avatar's feet; tail sits just above the head
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
    function speechBubblePath(ctx, x, y, w, h, r, tailHalf, tailH) {
      r = Math.min(r, w / 2, h / 2);
      const right = x + w;
      const bottom = y + h;
      const cx = x + w / 2;
      // Body and pointer are one path, so neither the tail base nor the body
      // bottom stroke draws a visible seam between the arrow and the bubble.
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(right - r, y);
      ctx.quadraticCurveTo(right, y, right, y + r);
      ctx.lineTo(right, bottom - r);
      ctx.quadraticCurveTo(right, bottom, right - r, bottom);
      ctx.lineTo(cx + tailHalf, bottom);
      ctx.lineTo(cx, bottom + tailH);
      ctx.lineTo(cx - tailHalf, bottom);
      ctx.lineTo(x + r, bottom);
      ctx.quadraticCurveTo(x, bottom, x, bottom - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
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
      speechBubblePath(ctx, LW, LW, cw - LW * 2, bodyH - LW * 2, R, TAIL, TAIL);
      ctx.fill(); ctx.stroke();
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
      if (!ent || !ent.sprite) return;  // avatar not spawned yet — drop silently
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
      if (ent.sprite) b.sprite.position.set(ent.sprite.position.x, ent.sprite.position.y + BUBBLE_HEAD_Y, ent.sprite.position.z);
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

    // Live subject feed for the CCTV/Truman cameras: every avatar currently in the
    // room (self + peers) as { pos, name }. The cameras use this to pan and look at
    // whoever is moving — the hidden-camera "show" tracking its subject. Positions
    // are in the avatarParent() local frame, which is the same frame the cameras
    // live in (they are added under avatarParent too), so no conversion is needed.
    WS.subjects = function subjects() {
      const out = [];
      if (selfEnt && selfEnt.sprite && selfEnt.sprite.visible !== false) {
        out.push({ pos: selfEnt.sprite.position, name: (playerName ? playerName() : 'YOU') || 'YOU' });
      }
      if (peerEnts && peerEnts.size) {
        peerEnts.forEach((ent) => {
          if (ent && ent.sprite && ent.sprite.visible !== false) {
            out.push({ pos: ent.sprite.position, name: (ent.name || 'BUILDER').toUpperCase() });
          }
        });
      }
      return out;
    };
    // The parent the cameras should attach to (shared avatar/lobby frame).
    WS.avatarParent = function () { return avatarParent(); };

    function updateSelfAvatar() {
      if (!selfEnt) selfEnt = createAvatar(getSelfAvatarDescriptor());
      // Pet choice is SELF-ONLY and local (peers keep their class avatars; createAvatar
      // is shared with the peer path, so the pet must never be applied there).
      if (avatarPetId && PETS[avatarPetId] && (!selfEnt.pet || selfEnt.pet.id !== avatarPetId)) loadPetTextures(selfEnt, PETS[avatarPetId]);
      if (avatarStripId && STRIPS[avatarStripId] && (!selfEnt.strip || selfEnt.strip.id !== avatarStripId)) loadStripTextures(selfEnt, STRIPS[avatarStripId]);
      if (selfEnt._srActive) return;   // surface roam owns position; don't let presence echoes yank us back
      moveEntity(selfEnt, you.x, you.z);
    }
    const STALE_PEER_MS = 9000; // ~3 missed presence heartbeats => treat as gone
    function updatePeerAvatars() {
      // Drop ghost peers that stopped heartbeating (missed 'leave', hard refresh, or a
      // stale server session) so the player never sees phantom duplicate avatars.
      const nowMs = Date.now();
      peers.forEach((p, id) => { if (p && p._t && nowMs - p._t > STALE_PEER_MS) peers.delete(id); });
      const seen = new Set();
      peers.forEach((p) => {
        if (!p || p.id == null || p.id === myId) return;   // never draw yourself as a peer
        const pos = p.cursor || p; if (pos.x == null) return;
        seen.add(p.id);
        let ent = peerEnts.get(p.id);
        // Prefer the peer's NETWORKED voxel look (round-tripped via the server);
        // fall back to the id-seed so a peer with no descriptor still renders distinct.
        const avatarKey = p.avatar ? JSON.stringify(p.avatar) : String(p.id);
        if (!ent || ent._avatarKey !== avatarKey) {
          if (ent) disposeEntity(ent);
          ent = createAvatar(p.avatar || p.id);
          ent._avatarKey = avatarKey;
          peerEnts.set(p.id, ent);
        }
        moveEntity(ent, pos.x, pos.z);
      });
      peerEnts.forEach((ent, id) => { if (!seen.has(id)) { disposeEntity(ent); peerEnts.delete(id); } });
    }
    function startAvatars() {
      if (avatarRaf || typeof requestAnimationFrame !== 'function') return;
      let prev = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      let prunePrev = prev;
      const tick = () => {
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
        _srPollFlyDown();   // detect fly-down transitions, activate/deactivate surface roam
        if (selfEnt) animEntity(selfEnt, dt);
        peerEnts.forEach((e) => animEntity(e, dt));
        // Sweep stale/ghost peers ~every 1.5s even when no messages arrive, so a peer
        // that hard-disconnected (missed 'leave') stops rendering as a phantom avatar.
        if (now - prunePrev > 1500) { prunePrev = now; if (peerEnts.size) updatePeerAvatars(); }
        // Follow camera: keep the player centered (player controls the orbit).
        updateAvatarCameraOrbit(dt);
        avatarRaf = requestAnimationFrame(tick);
      };
      avatarRaf = requestAnimationFrame(tick);
    }
    function stopAvatars() {
      if (avatarRaf) { cancelAnimationFrame(avatarRaf); avatarRaf = null; }
      disposeSkyRings(); skyHudHide();
      try { const PS = window.__tinyworldPoserSurface; if (PS && PS.hide) PS.hide(); } catch (_) {}
      skyKeys.up = skyKeys.down = skyKeys.left = skyKeys.right = skyKeys.thrust = 0;
      if (_srActive) { _srUnbindInput(); _srHideHud(); _srActive = false; window.__tinyworldSurfaceRoamActive = false; document.body.classList.remove('surface-roam-active'); }
      disposeEntity(selfEnt); selfEnt = null;
      peerEnts.forEach((e) => disposeEntity(e)); peerEnts.clear();
      avatarErrored = false;
    }

    function drawMinimap() {
      if (!ctx || !canvas) return;
      canvas.width = gridSize * CELL; canvas.height = gridSize * CELL;
      applyMapScale();
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
