  // Worlds MMO — in-world HUD: hearts, resource tallies, role/tax, the four harvest
  // actions (fish/mine/gather/hunt) with cooldowns + progress, a "+N" reward popup,
  // and a how-to-play legend. NO emoji — all glyphs are SVG icons via WS.icon.
  // Chat REUSES the existing mp-chat panel component, driven by the world socket.
  // IIFE-wrapped; no globals leak.
  (function wireWorldsHud() {
    'use strict';
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
  
    const WS = (window.__tinyworldWorlds = window.__tinyworldWorlds || {});
    function T(k, p) { return typeof window.t === 'function' ? window.t(k, p) : k; }
    function on(ev, cb) { if (typeof WS.on === 'function') WS.on(ev, cb); }
    function ic(name, size) { return typeof WS.icon === 'function' ? WS.icon(name, size) : document.createElement('span'); }
  
    function el(tag, attrs, kids) {
      const n = document.createElement(tag);
      if (attrs) for (const k of Object.keys(attrs)) {
        if (k === 'class') n.className = attrs[k];
        else if (k === 'text') n.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
        else n.setAttribute(k, attrs[k]);
      }
      if (kids) for (const c of [].concat(kids)) if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      return n;
    }
  
    function injectStyles() {
      if (document.getElementById('tw-worlds-hud-style')) return;
      const css = `
  .tw-hud{position:fixed;left:50%;bottom:calc(14px + var(--tw-worlds-bottom-inset,0px));transform:translateX(-50%);z-index:66;display:none;
    align-items:center;gap:12px;background:#0c1424ee;border:1px solid rgba(255,255,255,.16);border-radius:14px;
    padding:10px 14px;color:#eef3ff;font:600 13px system-ui;box-shadow:0 10px 30px -10px rgba(0,0,0,.5)}
  .tw-hud.open{display:flex}
  .tw-hud .tw-hud-grp{display:flex;align-items:center;gap:6px}
  .tw-hud-hearts{color:#ff6b81;min-width:34px}
  .tw-hud-res{display:flex;gap:10px}
  .tw-res-item{display:flex;align-items:center;gap:4px;opacity:.92}
  .tw-res-item svg{opacity:.85}
  .tw-hud-role{font:600 11px system-ui;letter-spacing:.03em;opacity:.75;padding:0 4px;border-left:1px solid rgba(255,255,255,.14);border-right:1px solid rgba(255,255,255,.14)}
  .tw-hud-acts{display:flex;gap:6px}
  .tw-act{display:flex;align-items:center;gap:6px;border:0;border-radius:9px;padding:8px 11px;cursor:pointer;font:600 12px system-ui;color:#fff;background:#2b59d6}
  .tw-act:hover{background:#3568e6}
  .tw-act:disabled{opacity:.4;cursor:not-allowed}
  .tw-hud-icon{display:flex;align-items:center;justify-content:center;border:0;border-radius:9px;padding:8px;cursor:pointer;color:#fff;background:rgba(255,255,255,.12)}
  .tw-hud-icon:hover{background:rgba(255,255,255,.2)}
  .tw-hud-progress{position:absolute;left:10px;right:10px;bottom:4px;height:3px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden}
  .tw-hud-progress-fill{height:100%;width:0;background:#7bc230;border-radius:2px}
  .tw-hud-popup{position:fixed;left:50%;bottom:calc(74px + var(--tw-worlds-bottom-inset,0px));transform:translateX(-50%);z-index:67;
    display:flex;align-items:center;gap:6px;color:#bdf08a;font:800 18px system-ui;text-shadow:0 2px 8px rgba(0,0,0,.6);opacity:1;pointer-events:none;transition:transform .9s ease-out,opacity .9s ease-out}
  .tw-hud-popup.go{transform:translate(-50%,-44px);opacity:0}
  .tw-help-panel{position:fixed;left:50%;bottom:calc(74px + var(--tw-worlds-bottom-inset,0px));transform:translateX(-50%);z-index:68;display:none;
    width:min(420px,92vw);background:#10182b;border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:16px 18px;color:#eef3ff;font:400 13px/1.5 system-ui;box-shadow:0 16px 40px -12px rgba(0,0,0,.6)}
  .tw-help-panel.open{display:block}
  .tw-help-panel h4{margin:0 0 8px;font-size:14px}
  .tw-help-panel p{margin:0 0 6px;opacity:.85;white-space:pre-line}
  `;
      document.head.appendChild(el('style', { id: 'tw-worlds-hud-style', text: css }));
    }
  
    const ACTIONS = [['fish', 'worlds.actionFish', 'fish'], ['mine', 'worlds.actionMine', 'ore'], ['gather', 'worlds.actionGather', 'plant'], ['hunt', 'worlds.actionHunt', 'meat']];
    const RES_ICON = { fish: 'fish', meat: 'meat', plants: 'plant', ore: 'ore' };
  
    let hud = null, heartsEl = null, resEl = null, roleEl = null, progFill = null, helpPanel = null;
    const actBtns = {};
    const cooldowns = {};
  
    function buildHud() {
      if (hud) return;
      injectStyles();
      heartsEl = el('span', { class: 'tw-hud-hearts' });
      resEl = el('span', { class: 'tw-hud-res' });
      roleEl = el('span', { class: 'tw-hud-role' });
      const actGrp = el('div', { class: 'tw-hud-acts' });
      ACTIONS.forEach(([action, key, iconName]) => {
        const b = el('button', { class: 'tw-act', title: T(key), onclick: () => { if (typeof WS.harvest === 'function') WS.harvest(action); } }, [ic(iconName, 16), el('span', { text: T(key) })]);
        actBtns[action] = b; actGrp.appendChild(b);
      });
      progFill = el('div', { class: 'tw-hud-progress-fill' });
      hud = el('div', { class: 'tw-hud' }, [
        el('div', { class: 'tw-hud-grp' }, [ic('heart', 16), heartsEl]),
        el('div', { class: 'tw-hud-grp' }, [resEl]),
        roleEl,
        actGrp,
        el('button', { class: 'tw-hud-icon', title: T('worlds.help'), onclick: toggleHelp }, [ic('help', 16)]),
        el('button', { class: 'tw-hud-icon tw-hud-leave', title: T('worlds.leave'), onclick: () => { if (typeof WS.leaveRoom === 'function') WS.leaveRoom(); } }, [ic('leave', 16)]),
        el('div', { class: 'tw-hud-progress' }, [progFill]),
      ]);
      document.body.appendChild(hud);
    }
  
    // ---- how-to-play legend ----
    function toggleHelp() {
      if (!helpPanel) {
        helpPanel = el('div', { class: 'tw-help-panel' }, [
          el('h4', { text: T('worlds.help') }),
          el('p', { text: T('worlds.helpBody') }),
          el('button', { class: 'tw-hud-icon', style: 'margin-top:6px', onclick: () => helpPanel.classList.remove('open') }, [ic('close', 16)]),
        ]);
        document.body.appendChild(helpPanel);
      }
      helpPanel.classList.toggle('open');
    }
  
    // ---- chat: reuse the existing mp-chat panel component ----
    let chatToggle = null, chatPanel = null, chatLog = null, chatInput = null, chatOpen = false, chatUnread = 0, chatBadge = null;
  
    function buildChat() {
      if (chatPanel) return;
      chatBadge = el('span', { class: 'mp-chat-badge', style: 'position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;border-radius:8px;background:#e6483d;color:#fff;font:700 10px system-ui;display:none;align-items:center;justify-content:center;padding:0 4px' });
      chatToggle = el('button', { class: 'mp-chat-toggle', type: 'button', title: T('worlds.chat'), style: 'position:fixed', onclick: () => setChatOpen(!chatOpen) }, [ic('chat', 18), chatBadge]);
      const head = el('div', { class: 'mp-chat-head' }, [
        el('button', { class: 'mp-chat-close', type: 'button', 'aria-label': T('worlds.close'), onclick: () => setChatOpen(false) }, [ic('close', 14)]),
      ]);
      chatLog = el('div', { class: 'mp-chat-log', 'aria-live': 'polite' });
      chatInput = el('input', { type: 'text', class: 'mp-chat-input', maxlength: '280', placeholder: T('worlds.chat') + '…', autocomplete: 'off' });
      const form = el('form', { class: 'mp-chat-form' }, [chatInput, el('button', { type: 'submit', class: 'mp-chat-send', 'aria-label': T('worlds.send') }, [ic('send', 16)])]);
      form.addEventListener('submit', (e) => { e.preventDefault(); sendChat(); });
      chatPanel = el('div', { class: 'mp-chat-panel' }, [head, chatLog, form]);
      document.body.appendChild(chatToggle);
      document.body.appendChild(chatPanel);
    }
    function setChatOpen(open) {
      if (!chatPanel) return;
      chatOpen = !!open;
      chatPanel.classList.toggle('visible', chatOpen);
      if (chatToggle) chatToggle.classList.toggle('is-open', chatOpen);
      if (chatOpen) { chatUnread = 0; updateBadge(); if (chatInput) chatInput.focus(); chatLog.scrollTop = chatLog.scrollHeight; }
    }
    function updateBadge() { if (chatBadge) { chatBadge.textContent = chatUnread > 0 ? String(chatUnread) : ''; chatBadge.style.display = chatUnread > 0 ? 'flex' : 'none'; } }
    function sendChat() { const v = chatInput.value.trim(); if (v && typeof WS.sendChat === 'function') { WS.sendChat(v); chatInput.value = ''; } }
    function fmtTime(ts) { try { return new Date(ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } }
    function appendChat(d) {
      buildChat();
      const row = el('div', { class: 'mp-chat-msg' }, [
        el('div', { class: 'mp-chat-meta' }, [el('span', { class: 'mp-chat-name', text: String(d.name || 'Player') }), el('span', { class: 'mp-chat-time', text: fmtTime(d.ts) })]),
        el('div', { class: 'mp-chat-text', text: String(d.text || '') }),
      ]);
      chatLog.appendChild(row);
      while (chatLog.children.length > 250) chatLog.removeChild(chatLog.firstChild);
      chatLog.scrollTop = chatLog.scrollHeight;
      if (!chatOpen) { chatUnread++; updateBadge(); }
    }
  
    // ---- renderers ----
    function renderHearts(n) { buildHud(); const f = Math.max(0, Math.min(10, Math.round(n || 0))); heartsEl.textContent = f + '/10'; }
    function renderResources(r) {
      buildHud();
      r = r || (typeof WS.getResources === 'function' ? WS.getResources() : {});
      resEl.textContent = '';
      [['fish', r.fish], ['meat', r.meat], ['plants', r.plants], ['ore', r.ore]].forEach(([k, v]) => {
        resEl.appendChild(el('span', { class: 'tw-res-item' }, [ic(RES_ICON[k], 14), el('span', { text: String(v || 0) })]));
      });
    }
    function setRole() {
      buildHud();
      const s = (typeof WS.getState === 'function' ? WS.getState() : {}) || {};
      let label;
      if (s.role === 'observe') label = T('worlds.roleObserver');
      else {
        const owner = s.world && s.world.ownerProfileId != null && WS.myProfileId != null && Number(s.world.ownerProfileId) === Number(WS.myProfileId);
        label = owner ? T('worlds.roleOwner') : (T('worlds.roleVisitor') + (s.taxPercent != null ? ' · ' + s.taxPercent + '%' : ''));
      }
      roleEl.textContent = label;
      const playable = s.role === 'play';
      for (const a of Object.keys(actBtns)) actBtns[a].disabled = !playable;
    }
  
    function showProgress(ms) {
      if (!progFill) return;
      progFill.style.transition = 'none'; progFill.style.width = '0%';
      void progFill.offsetWidth;
      progFill.style.transition = 'width ' + ms + 'ms linear'; progFill.style.width = '100%';
      setTimeout(() => { if (progFill) { progFill.style.transition = 'none'; progFill.style.width = '0%'; } }, ms + 80);
    }
    function rewardPopup(whole, resource) {
      const p = el('div', { class: 'tw-hud-popup' }, [el('span', { text: '+' + whole }), ic(RES_ICON[resource] || 'coin', 18)]);
      document.body.appendChild(p);
      requestAnimationFrame(() => p.classList.add('go'));
      setTimeout(() => p.remove(), 1000);
    }
  
    function disableDuring(ms, only) {
      const until = Date.now() + ms;
      const targets = only ? [only] : Object.keys(actBtns);
      for (const a of targets) { cooldowns[a] = until; if (actBtns[a]) actBtns[a].disabled = true; }
      setTimeout(refreshCooldowns, ms + 30);
    }
    function refreshCooldowns() {
      const now = Date.now();
      const playable = (typeof WS.getState === 'function' && WS.getState().role) === 'play';
      for (const a of Object.keys(actBtns)) if ((cooldowns[a] || 0) <= now) actBtns[a].disabled = !playable;
    }
  
    function show() { buildHud(); buildChat(); hud.classList.add('open'); if (chatToggle) chatToggle.style.display = ''; renderResources(); }
    function hide() { if (hud) hud.classList.remove('open'); if (helpPanel) helpPanel.classList.remove('open'); setChatOpen(false); if (chatToggle) chatToggle.style.display = 'none'; }
  
    on('enter', () => { show(); });
    on('leave', () => { hide(); });
    on('status', () => setRole());
    on('state', (s) => { buildHud(); if (s && s.you) renderHearts(s.you.hearts); setRole(); renderResources(); });
    on('you', (y) => { if (y) renderHearts(y.hearts); });
    on('resources', (r) => renderResources(r));
    on('progress', (d) => { buildHud(); showProgress(d && d.durationMs ? d.durationMs : 3000); for (const a of Object.keys(actBtns)) actBtns[a].disabled = true; });
    on('result', (d) => {
      renderResources();
      const whole = Math.floor(((d && d.harvesterMilli) || 0) / 1000);
      if (whole > 0) rewardPopup(whole, d.resource);
      if (d && d.action) disableDuring(d.cooldownMs || 5000, d.action);
    });
    on('deny', (d) => {
      const reason = d && d.reason;
      if (reason === 'no-hearts') { if (typeof twToast === 'function') twToast(T('worlds.noHearts')); }
      else if (reason === 'cooldown') { if (typeof twToast === 'function') twToast(T('worlds.cooldown')); }
    });
    on('chat', (d) => { if (d) appendChat(d); });
  })();
