  // Tinyverse — universe map, buying, and world management (playworlds-style).
  //
  // A NEW mode layered beside the freeform builder: a "🌍 Worlds" launcher opens
  // the universe map (world cards), where players buy unclaimed worlds with USDC,
  // name/tax/build/publish their drafts, and enter published worlds to play.
  //
  // Reuses existing globals: window.__tinyworldCloudApiCall (cloud API + auth),
  // window.t (i18n), twToast, buildWorldStateObject()/applyState() (tile JSON),
  // window.__tinyworldMode (build/play), and hands off to window.__tinyworldWorlds
  // (room + HUD live in 47/48). IIFE-wrapped so no globals leak.
  (function wireWorldsUniverse() {
    'use strict';
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
  
    const WS = (window.__tinyworldWorlds = window.__tinyworldWorlds || {});
  
    function api(path, method, body) {
      if (typeof window.__tinyworldCloudApiCall === 'function') return window.__tinyworldCloudApiCall(path, method, body);
      return Promise.resolve({ error: 'Cloud API unavailable' });
    }
    function T(key, params) { return typeof window.t === 'function' ? window.t(key, params) : key; }
    function toast(msg) { if (typeof twToast === 'function') twToast(msg); else console.log('[worlds]', msg); }
    function loggedIn() { return !!(window.__loggedIn || (window.TinyWorldAuth && window.TinyWorldAuth.currentUser && window.TinyWorldAuth.currentUser())); }

    // Shared SVG icon set for the whole Worlds UI (NO emoji). Stroke icons use
    // currentColor; a few are filled. Exposed on WS so 47/48 reuse one source.
    const ICONS = {
      globe: { p: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M2 12h20', 'M12 2c3.4 2.6 3.4 17.4 0 20', 'M12 2c-3.4 2.6-3.4 17.4 0 20'] },
      heart: { fill: true, p: ['M12 20.7l-1.5-1.4C5.3 14.6 2 11.6 2 7.9 2 5.1 4.1 3 6.8 3c1.6 0 3.1.7 4 1.9.9-1.2 2.4-1.9 4-1.9C21.4 3 23.5 5.1 23.5 7.9c0 .1 0 .1 0 0z'] },
      fish: { fill: true, p: ['M2 12c4-5 10-5 14 0-4 5-10 5-14 0z', 'M16 12l5-3v6l-5-3z'] },
      ore: { p: ['M12 2l8 6-8 14-8-14 8-6z', 'M4 8h16', 'M12 2v20'] },
      plant: { p: ['M12 22V9', 'M12 13C9 13 6 11 6 6c4 0 6 2 6 7z', 'M12 11c2.6 0 5-1.6 5-6-3.6 0-5 1.6-5 6z'] },
      meat: { fill: true, p: ['M14.6 8.4a4.5 4.5 0 1 0-6.3 6.3L4 19l1.5.4.4 1.5 4.4-4.4a4.5 4.5 0 0 0 6.3-6.3z'] },
      coin: { p: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v12', 'M14.6 8.6A3 3 0 0 0 11.6 7c-1.7 0-3 1-3 2.3 0 3 6 1.7 6 4.7 0 1.3-1.3 2.3-3 2.3a3 3 0 0 1-3-1.6'] },
      send: { p: ['M22 2 11 13', 'M22 2 15 22 11 13 2 9z'] },
      chat: { p: ['M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z'] },
      close: { p: ['M6 6l12 12', 'M18 6 6 18'] },
      leave: { p: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'] },
      help: { p: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M9.5 9.2A2.5 2.5 0 0 1 14 10.5c0 1.6-2 2-2 3.5', 'M12 17h.01'] },
      person: { p: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M5 21a7 7 0 0 1 14 0'] },
    };
    function makeIcon(name, size) {
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', String(size || 16));
      svg.setAttribute('height', String(size || 16));
      svg.setAttribute('aria-hidden', 'true');
      svg.style.flex = '0 0 auto';
      const def = ICONS[name] || { p: [] };
      (def.p || []).forEach(d => {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d);
        p.setAttribute('fill', def.fill ? 'currentColor' : 'none');
        p.setAttribute('stroke', 'currentColor');
        p.setAttribute('stroke-width', def.fill ? '0' : '2');
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(p);
      });
      return svg;
    }
    WS.icon = makeIcon;

    // Toggle builder chrome off while playing/observing a world so visitors can't
    // place/erase tiles. Owners editing a draft use the real builder (chrome on).
    WS.setPlayChrome = function (on) { document.body.classList.toggle('tw-worlds-play', !!on); };

    function el(tag, attrs, kids) {
      const node = document.createElement(tag);
      if (attrs) for (const k of Object.keys(attrs)) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        // No 'html'/innerHTML branch by design (it had no callers) — use 'text' or
        // appendChild so a future caller can't pipe untrusted data into innerHTML.
        else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
        else node.setAttribute(k, attrs[k]);
      }
      if (kids) for (const c of [].concat(kids)) { if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
      return node;
    }
  
    function injectStyles() {
      if (document.getElementById('tw-worlds-style')) return;
      const css = `
  .tw-worlds-launch{position:fixed;left:12px;bottom:calc(12px + var(--tw-worlds-bottom-inset,0px));z-index:60;display:flex;gap:6px;align-items:center;
    padding:9px 13px;border:0;cursor:pointer;border-radius:10px;
    background:linear-gradient(180deg,#3a6fe0 0%,#2b59d6 100%);color:#fff;font:700 12px/1 'Pixelify Sans',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.05em;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 4px 16px -4px rgba(43,89,214,.55),0 2px 6px -2px rgba(0,0,0,.3);transition:filter .08s,transform .04s}
  .tw-worlds-launch:hover{filter:brightness(1.12)}
  .tw-worlds-launch:active{transform:translateY(1px)}
  .tw-worlds-overlay{position:fixed;inset:0;z-index:80;display:none;
    background:rgba(4,6,18,.82);backdrop-filter:blur(6px) saturate(140%);-webkit-backdrop-filter:blur(6px) saturate(140%);
    overflow:auto;color:#eef3ff;font-family:'Pixelify Sans',ui-monospace,monospace}
  .tw-worlds-overlay.open{display:block}
  .tw-worlds-wrap{max-width:1320px;margin:0 auto;padding:24px 20px 60px}
  .tw-worlds-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:20px}
  .tw-worlds-head h2{margin:0;font-size:30px;text-transform:uppercase;letter-spacing:.06em;text-shadow:0 2px 12px rgba(0,0,0,.6)}
  .tw-worlds-head p{margin:6px 0 0;opacity:.72;font-size:13px;font-family:'Space Grotesk',system-ui,sans-serif}
  .tw-worlds-x{background:rgba(30,40,80,.55);border:1px solid rgba(100,130,220,.22);color:#dfe6ff;cursor:pointer;
    font:700 12px 'Pixelify Sans',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.04em;
    border-radius:10px;padding:9px 13px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 2px 8px -2px rgba(0,0,0,.35);transition:filter .08s}
  .tw-worlds-x:hover{filter:brightness(1.18)}
  .tw-worlds-x:active{transform:translateY(1px)}
  .tw-worlds-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
  .tw-worlds-card{background:rgba(12,16,38,.72);border:1px solid rgba(80,110,200,.22);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;
    backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);
    box-shadow:inset 0 1px 0 rgba(120,150,230,.14),0 20px 40px -16px rgba(0,0,20,.55),0 4px 8px -4px rgba(0,0,0,.28);transition:transform .06s,box-shadow .12s}
  .tw-worlds-card:hover{transform:translateY(-2px);box-shadow:inset 0 1px 0 rgba(120,150,230,.22),0 24px 48px -14px rgba(0,0,25,.65),0 6px 12px -4px rgba(0,0,0,.32)}
  /* Locked worlds — greyed out and non-interactive (only the demo world is playable for now). */
  .tw-worlds-card.tw-worlds-locked{opacity:.42;filter:grayscale(.9);pointer-events:none}
  .tw-worlds-card.tw-worlds-locked:hover{transform:none}
  .tw-worlds-prev{width:100%;aspect-ratio:16/10;border-radius:8px;background:#05070e;image-rendering:pixelated;display:block;
    box-shadow:0 2px 8px -2px rgba(0,0,0,.5)}
  .tw-worlds-card h3{margin:2px 0;font-size:15px;text-transform:uppercase;letter-spacing:.04em;display:flex;justify-content:space-between;align-items:center;gap:8px}
  .tw-badge{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:3px 7px;border-radius:6px}
  .tw-badge.unclaimed{background:rgba(19,52,107,.7);color:#9cc0ff;border:1px solid rgba(80,130,230,.25)}
  .tw-badge.draft{background:rgba(90,64,18,.7);color:#ffd690;border:1px solid rgba(200,160,60,.2)}
  .tw-badge.published{background:rgba(20,83,42,.7);color:#95e6b3;border:1px solid rgba(60,200,100,.2)}
  .tw-worlds-meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:11px;opacity:.85;font-family:'Space Grotesk',system-ui,sans-serif}
  .tw-worlds-meta b{opacity:.6;font-weight:400}
  .tw-worlds-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
  .tw-btn{flex:1;min-width:80px;border:0;border-radius:10px;padding:9px;cursor:pointer;color:#fff;
    font:700 11px/1 'Pixelify Sans',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.05em;
    background:linear-gradient(180deg,#3a6fe0 0%,#2b59d6 100%);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.24),0 4px 12px -4px rgba(43,89,214,.4),0 2px 4px -2px rgba(0,0,0,.25);
    transition:filter .08s,transform .04s}
  .tw-btn:hover{filter:brightness(1.12)}
  .tw-btn:active{transform:translateY(1px)}
  .tw-btn.alt{background:rgba(30,40,80,.6);box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 2px 6px -2px rgba(0,0,0,.3)}
  .tw-btn.go{background:linear-gradient(180deg,#62cc44 0%,#4aab2e 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.24),0 4px 12px -4px rgba(74,171,46,.4)}
  .tw-btn:disabled{opacity:.4;cursor:not-allowed;filter:grayscale(.5)}
  .tw-modal-back{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;
    background:rgba(3,5,16,.65);backdrop-filter:blur(10px) saturate(130%);-webkit-backdrop-filter:blur(10px) saturate(130%)}
  .tw-modal{background:rgba(8,11,28,.88);border:1px solid rgba(80,110,200,.26);border-radius:14px;padding:20px;width:min(420px,92vw);color:#eef3ff;
    font-family:'Pixelify Sans',ui-monospace,monospace;
    backdrop-filter:blur(22px) saturate(160%);-webkit-backdrop-filter:blur(22px) saturate(160%);
    box-shadow:inset 0 1px 0 rgba(120,150,230,.18),0 32px 64px -20px rgba(0,0,20,.7),0 8px 16px -8px rgba(0,0,0,.4)}
  .tw-modal h3{margin:0 0 12px;text-transform:uppercase;letter-spacing:.06em}
  .tw-modal label{display:block;font-size:11px;opacity:.8;margin:10px 0 4px;text-transform:uppercase;letter-spacing:.04em;font-family:'Space Grotesk',system-ui,sans-serif}
  .tw-modal input{width:100%;box-sizing:border-box;padding:9px;border-radius:8px;border:1px solid rgba(80,110,200,.25);background:rgba(4,6,20,.65);color:#fff;
    font:600 14px 'Space Grotesk',system-ui,sans-serif;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
  .tw-modal input:focus{outline:none;border-color:rgba(80,130,240,.5);box-shadow:0 0 0 3px rgba(43,89,214,.18)}
  .tw-modal-row{display:flex;gap:8px;margin-top:16px}
  .tw-draftbar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + var(--tw-worlds-bottom-inset,0px));z-index:70;display:flex;gap:8px;
    background:rgba(8,11,28,.82);border:1px solid rgba(80,110,200,.22);border-radius:12px;padding:9px;align-items:center;
    backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);
    box-shadow:inset 0 1px 0 rgba(120,150,230,.14),0 16px 40px -12px rgba(0,0,20,.5)}
  .tw-draftbar span{font:700 11px 'Pixelify Sans',ui-monospace,monospace;color:#ffd690;text-transform:uppercase;letter-spacing:.04em;padding:0 6px}
  body.tw-worlds-embed .toolbar{bottom:calc(28px + var(--tw-worlds-bottom-inset,0px)) !important}
  body.tw-worlds-embed .tool-palette{bottom:calc(28px + var(--tw-worlds-bottom-inset,0px)) !important}
  body.tw-worlds-embed .mp-chat-toggle{bottom:calc(24px + var(--tw-worlds-bottom-inset,0px)) !important}
  body.tw-worlds-embed .mp-chat-panel{bottom:calc(78px + var(--tw-worlds-bottom-inset,0px)) !important}
  body.tw-worlds-play .toolbar,body.tw-worlds-play .tool-palette,body.tw-worlds-play #raise-terrain,body.tw-worlds-play #lower-terrain{display:none !important}
  `;
      document.head.appendChild(el('style', { id: 'tw-worlds-style', text: css }));
    }
  
    // ---- state ----
    let overlay = null, gridEl = null;
    let me = null;
    let savedFreeform = null;   // freeform world to restore when leaving a world
  
    function ensureOverlay() {
      if (overlay) return overlay;
      injectStyles();
      gridEl = el('div', { class: 'tw-worlds-grid' });
      const head = el('div', { class: 'tw-worlds-head' }, [
        el('div', {}, [el('h2', { text: T('worlds.title') }), el('p', { text: T('worlds.subtitle') })]),
        el('div', { style: 'display:flex;gap:8px;align-items:center' }, [
          el('button', { class: 'tw-worlds-x', title: T('worlds.avatarOpen'),
            onclick: () => { if (typeof WS.openAvatarPicker === 'function') WS.openAvatarPicker(); } },
            [makeIcon('person', 16), el('span', { text: T('worlds.avatarOpen'), style: 'margin-left:6px' })]),
          el('button', { class: 'tw-worlds-x', onclick: closeOverlay, text: T('worlds.close') }),
        ]),
      ]);
      overlay = el('div', { class: 'tw-worlds-overlay' }, [el('div', { class: 'tw-worlds-wrap' }, [head, gridEl])]);
      document.body.appendChild(overlay);
      return overlay;
    }
  
    function openOverlay() { ensureOverlay().classList.add('open'); loadWorlds(); }
    function closeOverlay() { if (overlay) overlay.classList.remove('open'); }
  
    async function loadWorlds() {
      if (!gridEl) return;
      gridEl.textContent = '';
      gridEl.appendChild(el('p', { text: T('worlds.loading'), style: 'opacity:.6' }));
      const res = await api('/api/worlds', 'GET');
      if (!res || res.error) { gridEl.textContent = ''; gridEl.appendChild(el('p', { text: res && res.error ? res.error : T('worlds.empty') })); return; }
      me = res.me || null;
      const worlds = Array.isArray(res.worlds) ? res.worlds : [];
      gridEl.textContent = '';
      if (!worlds.length) { gridEl.appendChild(el('p', { text: T('worlds.empty') })); return; }
      for (const w of worlds) gridEl.appendChild(renderCard(w));
    }
  
    function statusBadge(status) {
      const map = { unclaimed: T('worlds.statusUnclaimed'), draft: T('worlds.statusDraft'), published: T('worlds.statusPublished') };
      return el('span', { class: 'tw-badge ' + status, text: map[status] || status });
    }
  
    function renderCard(w) {
      // Only the demo world (Tidewater Bay) is playable for now; everything else
      // is greyed out and non-interactive, and no costs are shown anywhere.
      const isDemo = w.slug === 'tidewater-bay';
      const locked = !isDemo;
      const mine = me && w.ownerProfileId != null && Number(w.ownerProfileId) === Number(me.id);
      const meta = el('div', { class: 'tw-worlds-meta' }, [
        el('div', {}, [el('b', { text: T('worlds.tiles') + ': ' }), document.createTextNode(String(w.tileCount))]),
        el('div', {}, [el('b', { text: T('worlds.players') + ': ' }), document.createTextNode(String(w.activePlayers || 0))]),
        el('div', {}, [el('b', { text: T('worlds.tax') + ': ' }), document.createTextNode(w.taxPercent + '%')]),
        el('div', {}, [el('b', { text: T('worlds.owner') + ': ' }), document.createTextNode(w.ownerName || '—')]),
      ]);
      const actions = el('div', { class: 'tw-worlds-actions' });
      if (w.status === 'unclaimed') {
        // Cost intentionally hidden.
        actions.appendChild(el('button', { class: 'tw-btn', text: T('worlds.buy'), onclick: () => buyFlow(w) }));
      } else if (w.status === 'published') {
        actions.appendChild(el('button', { class: 'tw-btn go', text: T('worlds.enter'), onclick: () => enterWorld(w) }));
        if (mine) actions.appendChild(el('button', { class: 'tw-btn alt', text: T('worlds.manage'), onclick: () => manageFlow(w) }));
      } else if (w.status === 'draft' && mine) {
        actions.appendChild(el('button', { class: 'tw-btn', text: T('worlds.build'), onclick: () => buildDraft(w) }));
        actions.appendChild(el('button', { class: 'tw-btn alt', text: T('worlds.manage'), onclick: () => manageFlow(w) }));
      }
      const baseTitle = w.name || (w.kind === 'starter' ? w.slug : T('worlds.statusUnclaimed'));
      const title = baseTitle + (isDemo ? ' (demo)' : '');
      const prev = el('canvas', { class: 'tw-worlds-prev', width: '320', height: '200' });
      const card = el('div', { class: 'tw-worlds-card' + (locked ? ' tw-worlds-locked' : '') }, [
        prev,
        el('h3', {}, [document.createTextNode(title), statusBadge(w.status)]), meta, actions,
      ]);
      if (locked) {
        card.setAttribute('aria-disabled', 'true');
        actions.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      }
      // Isometric 2D preview of the world's tiles.
      if (typeof WS.renderPreview === 'function') {
        const preview = Object.assign({ gridSize: w.gridSize, cells: [], slug: w.slug, name: w.name, id: w.id }, w.preview || {});
        WS.renderPreview(prev, preview);
      }
      return card;
    }
  
    function modal(titleText, bodyNodes, buttons) {
      const back = el('div', { class: 'tw-modal-back' });
      const close = () => back.remove();
      const row = el('div', { class: 'tw-modal-row' });
      for (const b of buttons) row.appendChild(el('button', { class: 'tw-btn ' + (b.cls || ''), text: b.label, onclick: () => b.onClick(close) }));
      back.appendChild(el('div', { class: 'tw-modal' }, [el('h3', { text: titleText })].concat(bodyNodes, [row])));
      back.addEventListener('click', (e) => { if (e.target === back) close(); });
      document.body.appendChild(back);
      return close;
    }
  
    // ---- buy with USDC (Solana Pay) ----
    async function buyFlow(w) {
      if (!loggedIn()) { toast(T('worlds.loginNeeded')); return; }
      const quote = await api('/api/worlds/claim', 'POST', { action: 'quote', worldId: w.id });
      if (!quote || quote.error) { toast(quote && quote.error ? quote.error : T('worlds.error')); return; }
      // Test mode: claim for real (records + ownership) without wallet/payment.
      if (quote.bypass) {
        modal(T('worlds.buy') + ' · ' + (w.name || w.slug), [
          el('p', { text: quote.priceUsdc + ' USDC', style: 'font-size:22px;font-weight:700;margin:0' }),
          el('p', { style: 'font-size:12px;opacity:.7;margin:8px 0', text: 'Test mode — payment is bypassed; ownership and records are written for real.' }),
        ], [
          { label: 'Claim (test — no payment)', cls: 'go', onClick: async (done) => {
              const res = await api('/api/worlds/claim', 'POST', { action: 'confirm', worldId: w.id });
              if (!res || res.error) { toast(res && res.error ? res.error : T('worlds.error')); return; }
              toast(T('worlds.bought')); done(); loadWorlds();
            } },
          { label: T('worlds.close'), cls: 'alt', onClick: (done) => done() },
        ]);
        return;
      }
      const info = el('p', { text: quote.priceUsdc + ' USDC', style: 'font-size:22px;font-weight:700;margin:0' });
      const linkWrap = el('div', { style: 'margin-top:12px;font-size:12px;opacity:.85' });
      const sig = el('input', { placeholder: 'Transaction signature (for verification)' });
      let intentId = 0;
      const close = modal(T('worlds.buy') + ' · ' + (w.name || w.slug), [
        info,
        el('p', { style: 'font-size:12px;opacity:.7;margin:8px 0', text: 'Pay in USDC on Solana, then confirm to claim the world as your draft.' }),
        linkWrap,
        el('label', { text: 'Transaction signature' }), sig,
      ], [
        { label: T('worlds.payOpen'), cls: 'alt', onClick: async () => {
            const pay = await api('/api/wallet/payments', 'POST', { action: 'create', amount: quote.priceUsdc, recipientWallet: quote.recipientWallet, tokenMint: quote.tokenMint });
            if (!pay || pay.error) { toast(pay && pay.error ? pay.error : T('worlds.error')); return; }
            intentId = pay.id;
            linkWrap.textContent = '';
            linkWrap.appendChild(el('a', { href: pay.solanaPayUrl, target: '_blank', rel: 'noopener', text: 'Open Solana Pay link', style: 'color:#9cc0ff' }));
          } },
        { label: T('worlds.buyConfirm'), onClick: async (done) => {
            if (!intentId) { toast('Create the payment first'); return; }
            const res = await api('/api/worlds/claim', 'POST', { action: 'confirm', worldId: w.id, paymentIntentId: intentId, signature: sig.value.trim() });
            if (!res || res.error) { toast(res && res.error ? res.error : T('worlds.error')); return; }
            toast(T('worlds.bought')); done(); loadWorlds();
          } },
      ]);
      void close;
    }
  
    // ---- manage (name / tax / publish / unpublish) ----
    function manageFlow(w) {
      const nameI = el('input', { value: w.name || '', maxlength: '48' });
      const taxI = el('input', { type: 'number', min: '1', max: '100', value: String(w.taxPercent || 10) });
      const draft = w.status === 'draft';
      const body = [el('label', { text: T('worlds.name') }), nameI, el('label', { text: T('worlds.taxPercent') }), taxI];
      if (!draft) { nameI.disabled = true; taxI.disabled = true; body.push(el('p', { style: 'font-size:12px;opacity:.6;margin-top:8px', text: 'Name and tax are locked while published.' })); }
      const buttons = [];
      if (draft) {
        buttons.push({ label: T('worlds.save'), cls: 'alt', onClick: async () => {
          const res = await api('/api/worlds?id=' + w.id, 'PUT', { name: nameI.value.trim(), taxPercent: Number(taxI.value) });
          if (!res || res.error) { toast(res && res.error ? res.error : T('worlds.error')); return; }
          toast(T('worlds.saved')); loadWorlds();
        } });
        buttons.push({ label: T('worlds.publish'), cls: 'go', onClick: async (done) => {
          await api('/api/worlds?id=' + w.id, 'PUT', { name: nameI.value.trim(), taxPercent: Number(taxI.value) });
          const res = await api('/api/worlds?id=' + w.id, 'POST', { action: 'publish' });
          if (!res || res.error) { toast(res && res.error ? res.error : T('worlds.error')); return; }
          toast(T('worlds.published')); done(); loadWorlds();
        } });
      } else {
        buttons.push({ label: T('worlds.unpublish'), cls: 'alt', onClick: async (done) => {
          const res = await api('/api/worlds?id=' + w.id, 'POST', { action: 'unpublish' });
          if (!res || res.error) { toast(res && res.error ? res.error : T('worlds.error')); return; }
          toast(T('worlds.unpublished')); done(); loadWorlds();
        } });
      }
      buttons.push({ label: T('worlds.close'), cls: 'alt', onClick: (done) => done() });
      modal(T('worlds.manage') + ' · ' + (w.name || w.slug), body, buttons);
    }
  
    // ---- build a draft (load its tiles into the existing builder) ----
    async function buildDraft(w) {
      const full = await api('/api/worlds?id=' + w.id, 'GET');
      const data = full && full.world && full.world.data ? full.world.data : { v: 4, cells: [] };
      rememberFreeform();
      if (typeof applyState === 'function') { try { applyState(data); } catch (_) {} }
      if (window.__tinyworldMode && window.__tinyworldMode.setBuild) window.__tinyworldMode.setBuild();
      closeOverlay();
      showDraftBar(w);
    }
  
    function rememberFreeform() {
      if (savedFreeform) return;
      if (typeof buildWorldStateObject === 'function') { try { savedFreeform = buildWorldStateObject(); } catch (_) {} }
    }
    function restoreFreeform() {
      if (savedFreeform && typeof applyState === 'function') { try { applyState(savedFreeform); } catch (_) {} }
      savedFreeform = null;
    }
    WS.rememberFreeform = rememberFreeform;
    WS.restoreFreeform = restoreFreeform;
  
    let draftBar = null;
    function showDraftBar(w) {
      hideDraftBar();
      const collect = () => (typeof buildWorldStateObject === 'function' ? buildWorldStateObject() : { v: 4, cells: [] });
      draftBar = el('div', { class: 'tw-draftbar' }, [
        el('span', { text: '✎ ' + (w.name || w.slug) }),
        el('button', { class: 'tw-btn alt', text: T('worlds.avatarOpen'), onclick: () => { if (typeof WS.openAvatarPicker === 'function') WS.openAvatarPicker(); } }),
        el('button', { class: 'tw-btn alt', text: T('worlds.save'), onclick: async () => {
          const res = await api('/api/worlds?id=' + w.id, 'POST', { action: 'saveDraft', data: collect() });
          toast(res && !res.error ? T('worlds.saved') : (res && res.error) || T('worlds.error'));
        } }),
        el('button', { class: 'tw-btn go', text: T('worlds.publish'), onclick: async () => {
          await api('/api/worlds?id=' + w.id, 'POST', { action: 'saveDraft', data: collect() });
          const res = await api('/api/worlds?id=' + w.id, 'POST', { action: 'publish' });
          toast(res && !res.error ? T('worlds.published') : (res && res.error) || T('worlds.error'));
        } }),
        el('button', { class: 'tw-btn alt', text: T('worlds.leave'), onclick: () => { hideDraftBar(); restoreFreeform(); } }),
      ]);
      document.body.appendChild(draftBar);
    }
    function hideDraftBar() { if (draftBar) { draftBar.remove(); draftBar = null; } }
    WS.hideDraftBar = hideDraftBar;
  
    // ---- enter a published world (hand off to the room client in 47) ----
    async function enterWorldFull(full) {
      if (!full || full.error || !full.world) { toast(full && full.error ? full.error : T('worlds.error')); return false; }
      if (full.world.status !== 'published') { toast(T('worlds.error')); return false; }
      WS.myProfileId = (full.me && full.me.id != null) ? full.me.id : (me && me.id != null ? me.id : null);
      // God-admin live-edit grant for THIS world (server-verified by account email).
      // The lobby-admin module (66) reads these to surface the live build controls.
      WS.canAdminEdit = full.canAdminEdit === true;
      WS.adminWorldId = full.world && full.world.id != null ? full.world.id : null;
      rememberFreeform();
      closeOverlay();
      if (typeof WS.enterRoom === 'function') {
        WS.enterRoom(full.world, full.token || '', full.role || 'play');
        return true;
      }
      toast(T('worlds.error'));
      return false;
    }

    async function enterWorld(w) {
      const full = await api('/api/worlds?id=' + w.id, 'GET');
      return enterWorldFull(full);
    }

    async function enterBySlug(slug) {
      const s = String(slug || '').trim().toLowerCase();
      if (!s) { toast(T('worlds.error')); return false; }
      const full = await api('/api/worlds?slug=' + encodeURIComponent(s), 'GET');
      return enterWorldFull(full);
    }

    function dismissWelcomeForDemoEntry() {
      try {
        const modal = document.getElementById('welcome-modal');
        if (modal && !modal.hidden) {
          modal.hidden = true;
          modal.setAttribute('aria-hidden', 'true');
          document.body.classList.remove('welcome-launch-open');
        }
        if (window.__tinyworldMode && typeof window.__tinyworldMode.setPlay === 'function') {
          window.__tinyworldMode.setPlay();
        } else {
          document.body.classList.add('tw-play-mode');
        }
      } catch (_) {}
    }

    function waitForEnterRoom() {
      return new Promise((resolve) => {
        if (typeof WS.enterRoom === 'function') { resolve(); return; }
        let done = false;
        let timer = null;
        const finish = () => {
          if (done) return;
          done = true;
          if (timer) clearTimeout(timer);
          resolve();
        };
        const startedAt = Date.now();
        const poll = () => {
          if (typeof WS.enterRoom === 'function' || Date.now() - startedAt >= 5000) {
            finish();
            return;
          }
          timer = setTimeout(poll, 50);
        };
        timer = setTimeout(poll, 50);
      });
    }

    async function maybeAutoEnterDemoWorld() {
      const slugFn = typeof window.__tinyworldTinyverseSlugParam === 'function'
        ? window.__tinyworldTinyverseSlugParam
        : null;
      const slug = slugFn ? slugFn() : null;
      if (!slug) return;
      await waitForEnterRoom();
      dismissWelcomeForDemoEntry();
      await enterBySlug(slug);
    }
  
    // Netlify deploy previews (and embeds) add a bottom bar/iframe chrome that
    // covers fixed bottom UI. Reserve clearance via a CSS var the worlds widgets
    // add to their bottom offset; 0 on the normal app.
    function applyBottomInset() {
      let inset = '0px';
      try {
        const host = location.hostname || '';
        const embedded = window.top !== window.self;
        if (embedded || /deploy-preview|--[a-z0-9-]+\.netlify\.app$|netlify\.live$/i.test(host)) inset = '64px';
      } catch (_) { inset = '64px'; }
      document.documentElement.style.setProperty('--tw-worlds-bottom-inset', inset);
      // Also lift the main app toolbar above the embed/preview bottom bar.
      document.body.classList.toggle('tw-worlds-embed', inset !== '0px');
    }

    // ---- launcher button ----
    // The Tinyverse entry lives inside the established bottom-left app chrome
    // (the .appbar icon pill) rather than as a separate floating button, so it
    // matches the other tools and doesn't stack a second pill in the corner.
    function addLauncher() {
      if (document.getElementById('tw-worlds-launch')) return;
      injectStyles();
      applyBottomInset();
      const label = T('worlds.launch');
      const appbar = document.querySelector('.appbar');
      if (appbar) {
        const btn = el('button', {
          type: 'button',
          id: 'tw-worlds-launch',
          class: 'btn icon',
          'data-pos-type': 'neutral',
          'data-tooltip': label,
          'data-i18n-tooltip': 'worlds.launch',
          'aria-label': label,
          onclick: openOverlay,
        }, [makeIcon('globe', 15)]);
        appbar.insertBefore(btn, appbar.firstChild);
      } else {
        // Fallback only if the app chrome isn't present (embeds/tests).
        document.body.appendChild(el('button', {
          id: 'tw-worlds-launch', class: 'tw-worlds-launch', title: label, onclick: openOverlay,
        }, [makeIcon('globe', 16), label]));
      }
    }
  
    WS.open = openOverlay;
    WS.close = closeOverlay;
    WS.refresh = loadWorlds;
    WS.enterPublished = enterWorld;
    WS.enterBySlug = enterBySlug;
    WS.ready = true;
    window.__tinyworldWorldsReady = Promise.resolve(WS);
    try {
      window.dispatchEvent(new CustomEvent('tinyworld:worlds-ready', { detail: WS }));
    } catch (_) {
      try { window.dispatchEvent(new Event('tinyworld:worlds-ready')); } catch (_) {}
    }
  
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addLauncher);
    else addLauncher();

    if (typeof window.__tinyworldTinyverseSlugParam === 'function' && window.__tinyworldTinyverseSlugParam()) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeAutoEnterDemoWorld);
      else maybeAutoEnterDemoWorld();
    }
  })();
