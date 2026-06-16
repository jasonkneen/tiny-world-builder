// -------- lobby chat bridge --------
// Bridges the in-game LOBBY world chat with the community "lobby" room so the two
// surfaces share one conversation:
//   * Game -> Community: every lobby chat line the local player sends is mirrored
//     into the community `lobby` room (POST /api/community).
//   * Community -> Game: community `lobby` posts are polled and injected into the
//     in-game chat log as bridged lines.
//
// Client-only and self-contained (no PartyKit server changes). All globals are
// prefixed `_lcb` to satisfy the shared-scope / unique-identifier rule.
(function () {
  'use strict';

  const WS = (window.__tinyworldWorlds = window.__tinyworldWorlds || {});

  // The in-game world that acts as the social lobby. Override with
  // window.__TW_LOBBY_WORLD_SLUG before this module loads if it ever changes.
  const _lcbLobbyWorldSlug = (window.__TW_LOBBY_WORLD_SLUG || 'tidewater-bay').toLowerCase();
  const _lcbCommunitySlug = 'lobby';
  const _lcbPollMs = 5000;
  const _lcbWalletKey = 'tinyworld:auth:wallet-session.v1';

  let _lcbActive = false;       // are we currently in the lobby world?
  let _lcbRoomId = null;        // numeric community room id for `lobby`
  let _lcbLastId = 0;           // highest community message id already shown in-game
  let _lcbPollTimer = null;
  const _lcbSeen = new Set();   // community message ids we've already rendered/own
  let _lcbMyProfileId = null;

  // ---- auth: same token sources the community page uses ----
  function _lcbWalletToken() {
    try { return localStorage.getItem(_lcbWalletKey) || ''; } catch (_) { return ''; }
  }
  function _lcbCookieToken() {
    try { const m = document.cookie.match(/(?:^|; )nf_jwt=([^;]*)/); return m ? decodeURIComponent(m[1]) : ''; } catch (_) { return ''; }
  }
  async function _lcbAccessToken() {
    const A = window.TinyWorldAuth;
    if (A && typeof A.getUser === 'function') {
      try {
        const u = await A.getUser();
        if (u) {
          if (typeof u.jwt === 'function') { try { return await u.jwt(); } catch (_) {} }
          if (u.token && u.token.access_token) return u.token.access_token;
        }
      } catch (_) {}
    }
    return _lcbWalletToken() || _lcbCookieToken() || '';
  }
  async function _lcbApi(path, method, body) {
    const token = await _lcbAccessToken();
    if (!token) return null; // not signed in — bridge silently stays game-only
    const opts = { method: method || 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' };
    opts.headers.Authorization = 'Bearer ' + token;
    if (body) opts.body = JSON.stringify(body);
    try {
      const r = await fetch(path, opts);
      const text = await r.text();
      let data = null; try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
      if (!r.ok) return null;
      return data || {};
    } catch (_) { return null; }
  }

  // ---- resolve the community lobby room id once ----
  async function _lcbResolveRoom() {
    if (_lcbRoomId) return _lcbRoomId;
    const d = await _lcbApi('/api/community?resource=bootstrap', 'GET');
    if (!d) return null;
    if (d.me && d.me.id) _lcbMyProfileId = d.me.id;
    const rooms = (d && d.rooms) || [];
    const room = rooms.find(r => String(r.slug || '').toLowerCase() === _lcbCommunitySlug);
    if (room) _lcbRoomId = room.id;
    return _lcbRoomId;
  }

  // ---- Community -> Game: poll + inject ----
  async function _lcbPoll() {
    if (!_lcbActive) return;
    const roomId = await _lcbResolveRoom();
    if (!roomId) return;
    const d = await _lcbApi('/api/community?resource=messages&roomId=' + roomId, 'GET');
    if (!d || !Array.isArray(d.messages)) return;
    for (const m of d.messages) {
      if (!m || _lcbSeen.has(m.id)) continue;
      _lcbSeen.add(m.id);
      if (m.id > _lcbLastId) _lcbLastId = m.id;
      // Skip our own messages (we already see them as our own game chat line).
      if (_lcbMyProfileId && m.author && m.author.id === _lcbMyProfileId) continue;
      // Inject into the in-game chat log via the same 'chat' event 50-* renders.
      const name = (m.author && (m.author.displayName || m.author.username)) || 'Builder';
      WS_emitChat({ id: 'community:' + m.id, name: name + ' (web)', text: String(m.body || ''), ts: Date.parse(m.createdAt) || Date.now(), color: '#6f7bd6', bridged: true });
    }
  }

  // Emit a synthetic 'chat' into the worlds-room emitter so the play-chat UI and
  // bubbles render it like any other message (47 exposes WS.__emit).
  function WS_emitChat(d) {
    if (typeof WS.__emit === 'function') WS.__emit('chat', d);
  }

  // ---- Game -> Community: mirror local lobby chat ----
  // Wrap WS.sendChat so the local player's lobby line is also posted to the
  // community room. We only mirror our OWN outbound chat (sendChat is local-only),
  // so there is no echo loop with the poller.
  function _lcbWrapSendChat() {
    if (WS.__lcbWrapped || typeof WS.sendChat !== 'function') return;
    const orig = WS.sendChat;
    WS.sendChat = function (text) {
      try { orig.call(WS, text); } finally {
        if (_lcbActive) {
          const t = String(text || '').slice(0, 1000).trim();
          if (t && _lcbRoomId != null) {
            _lcbApi('/api/community', 'POST', { action: 'postMessage', roomId: _lcbRoomId, body: t })
              .then(res => { if (res && res.message && res.message.id) { _lcbSeen.add(res.message.id); if (res.message.id > _lcbLastId) _lcbLastId = res.message.id; } })
              .catch(() => {});
          }
        }
      }
    };
    WS.__lcbWrapped = true;
  }

  // ---- activate / deactivate on room enter/leave ----
  function _lcbStart() {
    if (_lcbPollTimer) return;
    _lcbWrapSendChat();
    _lcbResolveRoom().then(() => { _lcbPoll(); });
    _lcbPollTimer = setInterval(_lcbPoll, _lcbPollMs);
  }
  function _lcbStop() {
    if (_lcbPollTimer) { clearInterval(_lcbPollTimer); _lcbPollTimer = null; }
  }

  if (typeof WS.on === 'function') {
    WS.on('enter', function (e) {
      const slug = e && e.world && String(e.world.slug || '').toLowerCase();
      _lcbActive = !!slug && slug === _lcbLobbyWorldSlug;
      if (_lcbActive) _lcbStart(); else _lcbStop();
    });
    WS.on('leave-room', function () { _lcbActive = false; _lcbStop(); });
  }

  // Expose for debugging / manual control.
  window.__tinyworldLobbyBridge = {
    isActive: () => _lcbActive,
    roomId: () => _lcbRoomId,
    poll: _lcbPoll,
    setLobbyWorld: (slug) => { /* no-op after load; set window.__TW_LOBBY_WORLD_SLUG before */ },
  };
})();
