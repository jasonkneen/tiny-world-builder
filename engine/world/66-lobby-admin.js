  // -------- god-admin LIVE lobby editor --------
  // A small allow-listed account ("god level admin", e.g. jason@bouncingfish.com)
  // may edit the live lobby island IN PLACE while inside the worlds room, and save
  // straight back to the published world record so every future visitor loads the
  // change. This module:
  //   1. detects the admin grant for the entered world (WS.canAdminEdit, set by 46
  //      from the server's email-verified /api/worlds response),
  //   2. surfaces an admin BUILD bar ABOVE the game HUD with an "Edit Lobby" toggle
  //      and a "Save to Live Lobby" button,
  //   3. when editing, flips the room out of play-mode so the real builder toolbar
  //      + palette come back (lifted above the HUD via the .tw-admin-editing body
  //      class), letting the admin place/erase tiles with the normal tools,
  //   4. on Save, serializes the live board (buildWorldStateObject) and POSTs the
  //      adminSave action to /api/worlds?id=<id> (server re-checks the email gate).
  //
  // IIFE-wrapped so no top-level identifiers leak into the shared global scope
  // (tools/check.js fails the build on any duplicate top-level name). All scratch
  // globals are prefixed `_la` to avoid collisions with other modules.
  (function wireLobbyAdmin() {
    'use strict';
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const WS = (window.__tinyworldWorlds = window.__tinyworldWorlds || {});
    function T(k, p) { return typeof window.t === 'function' ? window.t(k, p) : k; }
    function toast(m) { if (typeof twToast === 'function') twToast(m); else console.log('[lobby-admin]', m); }
    function api(path, method, body) {
      if (typeof window.__tinyworldCloudApiCall === 'function') return window.__tinyworldCloudApiCall(path, method, body);
      return Promise.resolve({ error: 'Cloud API unavailable' });
    }

    // Client-side mirror of the server email allow-list (netlify lib/worlds.mjs
    // worldAdminEmails). The server is authoritative — it re-checks on adminSave —
    // but we also confirm locally so the bar never flashes for a non-admin if a
    // stale WS.canAdminEdit ever slipped through. Keep in sync with the server list.
    const _laAdminEmails = ['jason@bouncingfish.com'];
    async function _laEmailIsAdmin() {
      try {
        const A = window.TinyWorldAuth;
        if (A && typeof A.getUser === 'function') {
          const u = await A.getUser();
          const email = ((u && u.email) || '').trim().toLowerCase();
          if (email) return _laAdminEmails.indexOf(email) !== -1;
        }
      } catch (_) {}
      return false;
    }

    let _laBar = null;
    let _laEditing = false;
    let _laWorldId = null;
    let _laToggleBtn = null;
    let _laSaveBtn = null;
    let _laStatusEl = null;

    function injectStyles() {
      if (document.getElementById('tw-lobby-admin-style')) return;
      // The bar sits centered, ABOVE the game HUD (.tw-hud bottom = 14px + inset,
      // height ~52px) so the two never overlap. When editing, lift the builder
      // toolbar + palette well clear of both the HUD and this bar.
      const css = `
  .tw-admin-bar{position:fixed;left:50%;bottom:calc(78px + var(--tw-worlds-bottom-inset,0px));transform:translateX(-50%);
    z-index:69;display:none;gap:8px;align-items:center;
    background:rgba(20,8,30,.86);border:1px solid rgba(190,120,230,.34);border-radius:12px;padding:8px 10px;
    backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);
    box-shadow:inset 0 1px 0 rgba(220,170,250,.18),0 16px 40px -12px rgba(20,0,30,.6)}
  .tw-admin-bar.open{display:flex}
  .tw-admin-bar .tw-admin-tag{font:700 10px/1 'Pixelify Sans',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;
    color:#e7b8ff;padding:0 4px;display:flex;align-items:center;gap:5px}
  .tw-admin-bar .tw-admin-dot{width:7px;height:7px;border-radius:50%;background:#bb63e6;box-shadow:0 0 8px #bb63e6}
  .tw-admin-bar button{border:0;border-radius:9px;padding:8px 12px;cursor:pointer;color:#fff;
    font:700 11px/1 'Pixelify Sans',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.05em;
    background:linear-gradient(180deg,#8a3fd0 0%,#6e2bb6 100%);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 4px 12px -4px rgba(120,40,180,.5);transition:filter .08s,transform .04s}
  .tw-admin-bar button:hover{filter:brightness(1.12)}
  .tw-admin-bar button:active{transform:translateY(1px)}
  .tw-admin-bar button.alt{background:rgba(40,20,60,.7);box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 2px 6px -2px rgba(0,0,0,.3)}
  .tw-admin-bar button.go{background:linear-gradient(180deg,#46c06e 0%,#2f9a4e 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 4px 12px -4px rgba(40,150,70,.5)}
  .tw-admin-bar button.on{background:linear-gradient(180deg,#e0913f 0%,#c4702b 100%)}
  .tw-admin-bar button:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(.4)}
  .tw-admin-bar .tw-admin-status{font:600 10px/1.2 'Space Grotesk',system-ui,sans-serif;color:#d9c0ee;opacity:.85;max-width:160px}
  /* While the admin is editing the live lobby, the room is in build mode: bring the
     real builder toolbar + block palette back and lift them clear of the HUD/bar so
     all three stack cleanly. The play-chrome rule hides tools under .tw-worlds-play;
     admin-editing re-shows them with !important and a raised bottom offset. */
  body.tw-admin-editing.tw-worlds-play .toolbar,
  body.tw-admin-editing.tw-worlds-play .tool-palette{display:flex !important}
  body.tw-admin-editing .toolbar{bottom:calc(132px + var(--tw-worlds-bottom-inset,0px)) !important}
  body.tw-admin-editing .tool-palette{bottom:calc(132px + var(--tw-worlds-bottom-inset,0px)) !important}
  `;
      const style = document.createElement('style');
      style.id = 'tw-lobby-admin-style';
      style.textContent = css;
      document.head.appendChild(style);
    }

    function el(tag, attrs, kids) {
      const node = document.createElement(tag);
      if (attrs) for (const k of Object.keys(attrs)) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
        else node.setAttribute(k, attrs[k]);
      }
      if (kids) for (const c of [].concat(kids)) { if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
      return node;
    }

    function ensureBar() {
      if (_laBar) return _laBar;
      injectStyles();
      _laToggleBtn = el('button', { class: 'alt', onclick: toggleEditing, text: T('lobbyAdmin.edit') });
      _laSaveBtn = el('button', { class: 'go', onclick: saveLive, text: T('lobbyAdmin.save') });
      _laSaveBtn.disabled = true;
      _laStatusEl = el('div', { class: 'tw-admin-status' });
      _laBar = el('div', { class: 'tw-admin-bar' }, [
        el('div', { class: 'tw-admin-tag' }, [el('span', { class: 'tw-admin-dot' }), document.createTextNode(T('lobbyAdmin.tag'))]),
        _laToggleBtn,
        _laSaveBtn,
        _laStatusEl,
      ]);
      document.body.appendChild(_laBar);
      return _laBar;
    }

    function setStatus(msg) { if (_laStatusEl) _laStatusEl.textContent = msg || ''; }

    function showBar(worldId) {
      ensureBar();
      _laWorldId = worldId != null ? worldId : (WS.adminWorldId != null ? WS.adminWorldId : null);
      _laBar.classList.add('open');
      _laEditing = false;
      _laSaveBtn.disabled = true;
      _laToggleBtn.classList.remove('on');
      _laToggleBtn.textContent = T('lobbyAdmin.edit');
      setStatus(T('lobbyAdmin.hintView'));
    }

    function hideBar() {
      if (_laEditing) stopEditing(true);
      if (_laBar) _laBar.classList.remove('open');
      _laWorldId = null;
    }

    function startEditing() {
      if (_laEditing) return;
      _laEditing = true;
      document.body.classList.add('tw-admin-editing');
      // Flip the room out of play-mode so the real builder tools edit the live
      // board. The room forced play on enter; build mode re-enables placement.
      try { if (window.__tinyworldMode && window.__tinyworldMode.setBuild) window.__tinyworldMode.setBuild(); } catch (_) {}
      _laToggleBtn.classList.add('on');
      _laToggleBtn.textContent = T('lobbyAdmin.editing');
      _laSaveBtn.disabled = false;
      setStatus(T('lobbyAdmin.hintEdit'));
    }

    function stopEditing(silent) {
      if (!_laEditing) return;
      _laEditing = false;
      document.body.classList.remove('tw-admin-editing');
      // Return to the immersive play view (tools hidden again).
      try { if (window.__tinyworldMode && window.__tinyworldMode.setPlay) window.__tinyworldMode.setPlay(); } catch (_) {}
      if (_laToggleBtn) { _laToggleBtn.classList.remove('on'); _laToggleBtn.textContent = T('lobbyAdmin.edit'); }
      if (_laSaveBtn) _laSaveBtn.disabled = true;
      if (!silent) setStatus(T('lobbyAdmin.hintView'));
    }

    function toggleEditing() { if (_laEditing) stopEditing(); else startEditing(); }

    async function saveLive() {
      if (_laWorldId == null) { toast(T('lobbyAdmin.noWorld')); return; }
      const collect = (typeof buildWorldStateObject === 'function') ? buildWorldStateObject : null;
      if (!collect) { toast(T('lobbyAdmin.error')); return; }
      let data;
      try { data = collect(); } catch (_) { toast(T('lobbyAdmin.error')); return; }
      if (!data || !Array.isArray(data.cells)) { toast(T('lobbyAdmin.error')); return; }
      _laSaveBtn.disabled = true;
      setStatus(T('lobbyAdmin.saving'));
      const res = await api('/api/worlds?id=' + encodeURIComponent(_laWorldId), 'POST', { action: 'adminSave', data });
      if (!res || res.error) {
        toast((res && res.error) || T('lobbyAdmin.error'));
        setStatus((res && res.error) || T('lobbyAdmin.error'));
        _laSaveBtn.disabled = !_laEditing;
        return;
      }
      toast(T('lobbyAdmin.saved'));
      setStatus(T('lobbyAdmin.savedAt') + ' ' + new Date().toLocaleTimeString());
      _laSaveBtn.disabled = !_laEditing;
      // Broadcast the fresh board to everyone currently in the room so their view
      // updates live without a reload (handled by the room client if available).
      try { if (typeof WS.adminBroadcastWorld === 'function') WS.adminBroadcastWorld(data); } catch (_) {}
    }

    // ---- room lifecycle hooks ----
    async function onEnter() {
      // Trust the server grant (WS.canAdminEdit) but also confirm the email locally.
      if (WS.canAdminEdit !== true) return;
      if (!(await _laEmailIsAdmin())) return;
      showBar(WS.adminWorldId);
    }
    function onLeave() { hideBar(); }

    if (typeof WS.on === 'function') {
      WS.on('enter', onEnter);
      WS.on('leave', onLeave);
    }

    // Expose a tiny control surface for tests / programmatic use.
    WS.lobbyAdmin = {
      isEditing: () => _laEditing,
      startEditing,
      stopEditing,
      save: saveLive,
      barOpen: () => !!(_laBar && _laBar.classList.contains('open')),
    };
  })();
