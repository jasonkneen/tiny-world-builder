  // World-view notifications — in-view toasts + browser (web) notifications for
  // player joins / leaves / bot arrivals / chat. The worlds room (47) detects the
  // events and calls window.twNotify.event({kind,name,text}); this module owns the
  // opt-in toggle, permission flow, burst coalescing, and dispatch. IIFE-wrapped;
  // the only global it leaks is window.twNotify.
  //
  // Design notes:
  //  - Default-on: the bell toggle (mounted into the minimap header by 47) starts
  //    on for fresh visitors, while a saved "0" keeps returning users muted.
  //    Clicking back on requests OS permission once.
  //  - In-view toasts (via the existing window.twToast) fire for join/leave/bot-join.
  //    Chat is NOT toasted in-view because the room already shows a chat bubble — it
  //    only raises a web notification, and only when the tab is hidden.
  //  - Web notifications only fire when enabled AND permission granted AND the tab is
  //    hidden, so a focused player is never double-notified by the OS.
  //  - Join bursts coalesce within a short window into "N players joined".
  //  - Remote-controlled names/text are only ever set via textContent (twToast) or the
  //    Notification body string — never innerHTML.
  (function wireWorldNotifications() {
    'use strict';
    var PREF_KEY = 'tinyworld:worlds:notify';
    var JOIN_WINDOW_MS = 1500;
    var NAME_MAX = 48;
    var TEXT_MAX = 140;

    function T(k, p) { return typeof window.t === 'function' ? window.t(k, p) : k; }
    function supported() { return typeof window !== 'undefined' && 'Notification' in window; }
    function canToast() { return typeof window.twToast === 'function'; }

    var enabled = true;
    try {
      var storedPref = localStorage.getItem(PREF_KEY);
      enabled = storedPref === null ? true : storedPref === '1';
    } catch (_) { /* storage unavailable — stays on for this session */ }

    var joinBuf = [];          // [{name, bot}] accumulated within the burst window
    var joinTimer = null;
    var toggleBtns = [];       // mounted toggle buttons to keep visually in sync

    function savePref(v) {
      if (typeof window.twSafeSetItem === 'function') {
        window.twSafeSetItem(PREF_KEY, v ? '1' : '0', 'notification preference');
      } else {
        try { localStorage.setItem(PREF_KEY, v ? '1' : '0'); } catch (_) { /* best effort */ }
      }
    }

    function cleanName(name) {
      var s = (name != null) ? String(name).trim() : '';
      return s ? s.slice(0, NAME_MAX) : T('worlds.notify.someone');
    }

    function canWebNotify() {
      return enabled && supported() && Notification.permission === 'granted' && document.hidden;
    }

    function webNotify(title, body) {
      if (!canWebNotify()) return;
      try {
        var n = new Notification(String(title), { body: body ? String(body) : '', tag: 'tinyworld-world' });
        n.onclick = function () {
          try { window.focus(); } catch (_) {}
          try { n.close(); } catch (_) {}
        };
      } catch (_) { /* construction can throw on some platforms — ignore */ }
    }

    function flushJoins() {
      joinTimer = null;
      var buf = joinBuf; joinBuf = [];
      if (!buf.length) return;
      var msg, body;
      if (buf.length === 1) {
        var e = buf[0];
        msg = e.bot ? T('worlds.notify.botJoined', { name: e.name }) : T('worlds.notify.joined', { name: e.name });
        body = '';
      } else {
        msg = T('worlds.notify.joinedMany', { n: String(buf.length) });
        body = buf.map(function (x) { return x.name; }).join(', ');
      }
      if (canToast()) window.twToast(msg);
      webNotify(msg, body);
    }

    function event(ev) {
      if (!enabled || !ev || !ev.kind) return;
      var name = cleanName(ev.name);
      switch (ev.kind) {
        case 'join':
        case 'bot-join':
          joinBuf.push({ name: name, bot: ev.kind === 'bot-join' });
          if (!joinTimer) joinTimer = setTimeout(flushJoins, JOIN_WINDOW_MS);
          break;
        case 'leave': {
          var lmsg = T('worlds.notify.left', { name: name });
          if (canToast()) window.twToast(lmsg);
          webNotify(lmsg, '');
          break;
        }
        case 'chat': {
          // The room already shows an in-view bubble; only nudge backgrounded tabs.
          var text = (ev.text != null) ? String(ev.text).slice(0, TEXT_MAX) : '';
          webNotify(T('worlds.notify.chatFrom', { name: name }), text);
          break;
        }
        default:
          break;
      }
    }

    function reflect(btn) {
      if (!btn) return;
      btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      btn.classList.toggle('on', enabled);
      btn.title = T('worlds.notify.toggleLabel') + (enabled ? ' · on' : ' · off');
    }
    function reflectAll() { toggleBtns.forEach(reflect); }

    function requestPermissionIfNeeded() {
      if (!supported()) {
        if (canToast()) window.twToast(T('worlds.notify.unsupported'), 'warn');
        return;
      }
      if (Notification.permission === 'default') {
        try {
          var r = Notification.requestPermission();
          if (r && typeof r.then === 'function') {
            r.then(function (perm) {
              if (perm === 'denied' && canToast()) window.twToast(T('worlds.notify.blocked'), 'warn');
            }).catch(function () {});
          }
        } catch (_) { /* older callback-style API or blocked — ignore */ }
      } else if (Notification.permission === 'denied') {
        if (canToast()) window.twToast(T('worlds.notify.blocked'), 'warn');
      }
    }

    var BELL_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';

    function ensureStyle() {
      if (document.getElementById('tw-notify-style')) return;
      var css = '.tw-worlds-map .tw-notify-toggle{margin-left:6px;display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;padding:0;border:1px solid rgba(150,180,255,.2);border-radius:7px;background:rgba(150,180,255,.08);color:#8ea8d8;cursor:pointer;line-height:0;flex:none}'
        + '.tw-worlds-map .tw-notify-toggle:hover{color:#cfe0ff;border-color:rgba(150,180,255,.42)}'
        + '.tw-worlds-map .tw-notify-toggle.on{color:#7fe0a0;border-color:rgba(110,230,150,.5);background:rgba(110,230,150,.12)}';
      document.head.appendChild(Object.assign(document.createElement('style'), { id: 'tw-notify-style', textContent: css }));
    }

    // Called by 47-worlds-room when it builds the minimap header. Injects the bell
    // toggle so it lives next to the map and travels with it when dragged.
    function mountToggle(host) {
      if (!host || typeof host.appendChild !== 'function') return null;
      var existing = host.querySelector ? host.querySelector('.tw-notify-toggle') : null;
      if (existing) { reflect(existing); return existing; }
      ensureStyle();
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tw-notify-toggle';
      btn.innerHTML = BELL_SVG;  // static literal glyph — no remote/user data
      // The header is a drag handle; keep clicks/drags on the bell from moving the map.
      btn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
      btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        enabled = !enabled;
        savePref(enabled);
        if (enabled) requestPermissionIfNeeded();
        reflectAll();
      });
      host.appendChild(btn);
      toggleBtns.push(btn);
      reflect(btn);
      return btn;
    }

    window.twNotify = {
      event: event,
      mountToggle: mountToggle,
      isEnabled: function () { return enabled; }
    };
  })();
