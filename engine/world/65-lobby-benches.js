// -------- lobby benches: online-but-not-playing members sit here --------
// When you're in the social LOBBY world, community members who are online (per
// /api/community presence) but NOT actively in the room are rendered as little
// voxel people sitting on benches — a cosy "hangout" area. Purely cosmetic and
// client-side; it reuses window.makeVoxelAvatar and its built-in 'sit' pose.
//
// Self-contained. Globals prefixed `_lbn` for the shared-scope unique-id rule.
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  const LBW = (window.__tinyworldWorlds = window.__tinyworldWorlds || {});
  const _lbnLobbyWorldSlug = (window.__TW_LOBBY_WORLD_SLUG || 'tidewater-bay').toLowerCase();
  const _lbnWalletKey = 'tinyworld:auth:wallet-session.v1';
  const _lbnPollMs = 12000;
  const _lbnMaxSeats = 8;

  let _lbnActive = false;
  let _lbnGroup = null;        // THREE.Group holding benches + seated avatars
  let _lbnRaf = null;
  let _lbnPollTimer = null;
  let _lbnLastT = 0;
  const _lbnSeated = new Map(); // profileId -> { av, seatIndex }
  let _lbnSeats = [];           // [{x,y,z,heading}] world-space (local to scene group)

  // ---- auth (same sources as the rest of the community client) ----
  function _lbnToken() {
    const A = window.TinyWorldAuth;
    const tryUser = async () => {
      if (A && typeof A.getUser === 'function') {
        try { const u = await A.getUser(); if (u) { if (typeof u.jwt === 'function') { try { return await u.jwt(); } catch (_) {} } if (u.token && u.token.access_token) return u.token.access_token; } } catch (_) {}
      }
      try { const w = localStorage.getItem(_lbnWalletKey); if (w) return w; } catch (_) {}
      try { const m = document.cookie.match(/(?:^|; )nf_jwt=([^;]*)/); if (m) return decodeURIComponent(m[1]); } catch (_) {}
      return '';
    };
    return tryUser();
  }
  async function _lbnApi(path) {
    const token = await _lbnToken();
    if (!token) return null;
    try {
      const r = await fetch(path, { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, credentials: 'same-origin' });
      if (!r.ok) return null;
      return await r.json();
    } catch (_) { return null; }
  }

  function _lbnScene() {
    if (typeof worldGroup !== 'undefined' && worldGroup) return worldGroup;
    if (typeof scene !== 'undefined' && scene) return scene;
    return null;
  }

  // ---- build a simple low-poly bench (wood slats on two stone legs) ----
  function _lbnMakeBench() {
    if (typeof THREE === 'undefined') return null;
    const g = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: 0x9c6b3f });
    const leg = new THREE.MeshLambertMaterial({ color: 0x6f6a60 });
    // Human-scale relative to the voxel avatars: enough for two sitters, but
    // intentionally much smaller than one terrain tile so it does not read like
    // a billboard/wall in the lobby.
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.055, 0.28), wood);
    seat.position.y = 0.24; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.24, 0.055), wood);
    back.position.set(0, 0.39, -0.12); g.add(back);
    for (const sx of [-0.38, 0.38]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.24, 0.22), leg);
      l.position.set(sx, 0.12, 0); g.add(l);
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  // Lay out a few benches in a friendly cluster near the lobby origin. Seats are
  // two per bench. Coordinates are local to the scene group (the lobby is small).
  function _lbnLayout() {
    _lbnSeats = [];
    if (!_lbnGroup) return;
    // Two benches facing each other, slightly off the spawn so they don't block it.
    const benches = [
      { x: -3.5, z: 2.6, rot: 0 },
      { x: -3.5, z: 4.4, rot: Math.PI },
      { x: 3.6, z: 2.6, rot: 0 },
      { x: 3.6, z: 4.4, rot: Math.PI },
    ];
    for (const b of benches) {
      const bench = _lbnMakeBench();
      if (!bench) continue;
      bench.position.set(b.x, 0, b.z);
      bench.rotation.y = b.rot;
      _lbnGroup.add(bench);
      // two seats per bench, offset along local x, facing the bench's forward (+z rotated)
      for (const ox of [-0.23, 0.23]) {
        const lx = b.x + Math.cos(b.rot) * ox;
        const lz = b.z + Math.sin(b.rot) * ox;
        _lbnSeats.push({ x: lx, y: 0.28, z: lz, heading: b.rot });
      }
    }
  }

  function _lbnClear() {
    if (_lbnGroup) {
      for (const { av } of _lbnSeated.values()) { try { av.dispose && av.dispose(); } catch (_) {} }
      try { _lbnGroup.parent && _lbnGroup.parent.remove(_lbnGroup); } catch (_) {}
    }
    _lbnSeated.clear();
    _lbnGroup = null;
    _lbnSeats = [];
  }

  // Set of profile ids currently live IN the room (so we don't double-render them
  // as both a walking peer and a bench-sitter).
  function _lbnLivePeerProfileIds() {
    const ids = new Set();
    try {
      const peers = (typeof LBW.getPeers === 'function') ? LBW.getPeers() : null;
      if (Array.isArray(peers)) for (const p of peers) { if (p && p.profileId) ids.add(p.profileId); }
    } catch (_) {}
    return ids;
  }

  async function _lbnSync() {
    if (!_lbnActive || !_lbnGroup) return;
    const d = await _lbnApi('/api/community?resource=bootstrap');
    if (!d || !Array.isArray(d.members)) return;
    const live = _lbnLivePeerProfileIds();
    const myId = d.me && d.me.id;
    // Online members, excluding self and anyone already live in the room.
    const online = d.members.filter(m => m && m.online && m.id !== myId && !live.has(m.id)).slice(0, Math.min(_lbnMaxSeats, _lbnSeats.length));
    const want = new Set(online.map(m => m.id));

    // Remove sitters who went offline / joined the room.
    for (const [pid, rec] of Array.from(_lbnSeated.entries())) {
      if (!want.has(pid)) {
        try { rec.av.dispose && rec.av.dispose(); } catch (_) {}
        try { _lbnGroup.remove(rec.av.group); } catch (_) {}
        _lbnSeated.delete(pid);
      }
    }
    // Seat newcomers in the first free seats.
    const usedSeats = new Set(Array.from(_lbnSeated.values()).map(r => r.seatIndex));
    for (const m of online) {
      if (_lbnSeated.has(m.id)) continue;
      let seatIndex = -1;
      for (let i = 0; i < _lbnSeats.length; i++) { if (!usedSeats.has(i)) { seatIndex = i; break; } }
      if (seatIndex < 0) break;
      usedSeats.add(seatIndex);
      if (typeof window.makeVoxelAvatar !== 'function') break;
      let av = null;
      try { av = window.makeVoxelAvatar({ seed: 'lobby-' + m.id, label: (m.displayName || m.username || 'Builder') }); } catch (_) { av = null; }
      if (!av || !av.group) continue;
      const s = _lbnSeats[seatIndex];
      av.group.position.set(s.x, s.y, s.z);
      try { av.setHeading && av.setHeading(s.heading); } catch (_) {}
      try { av.setState && av.setState('sit'); } catch (_) {}
      _lbnGroup.add(av.group);
      _lbnSeated.set(m.id, { av, seatIndex });
    }
  }

  function _lbnStartTick() {
    if (_lbnRaf) return;
    _lbnLastT = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - _lbnLastT) / 1000); _lbnLastT = now;
      for (const { av } of _lbnSeated.values()) { try { av.update && av.update(dt); } catch (_) {} }
      _lbnRaf = _lbnActive ? requestAnimationFrame(tick) : null;
    };
    _lbnRaf = requestAnimationFrame(tick);
  }
  function _lbnStop() {
    _lbnActive = false;
    if (_lbnRaf) { cancelAnimationFrame(_lbnRaf); _lbnRaf = null; }
    if (_lbnPollTimer) { clearInterval(_lbnPollTimer); _lbnPollTimer = null; }
    _lbnClear();
  }
  function _lbnStart() {
    const sc = _lbnScene();
    if (!sc || typeof THREE === 'undefined') return;
    _lbnClear();
    _lbnGroup = new THREE.Group();
    _lbnGroup.name = 'lobby-benches';
    sc.add(_lbnGroup);
    _lbnLayout();
    _lbnSync();
    _lbnStartTick();
    _lbnPollTimer = setInterval(_lbnSync, _lbnPollMs);
  }

  if (typeof LBW.on === 'function') {
    LBW.on('enter', function (e) {
      const slug = e && e.world && String(e.world.slug || '').toLowerCase();
      const nowActive = !!slug && slug === _lbnLobbyWorldSlug;
      if (nowActive && !_lbnActive) { _lbnActive = true; _lbnStart(); }
      else if (!nowActive && _lbnActive) { _lbnStop(); }
    });
    LBW.on('leave-room', _lbnStop);
  }

  window.__tinyworldLobbyBenches = { isActive: () => _lbnActive, seated: () => _lbnSeated.size, sync: _lbnSync };
})();
