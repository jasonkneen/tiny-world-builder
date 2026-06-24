  // Tinyverse — universe map, buying, and world management (playworlds-style).
  //
  // A NEW mode layered beside the freeform builder: a "🌍 Worlds" launcher opens
  // the universe map (world cards), where players enter owner-held early-preview islands
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
    const TINYVERSE_HUB_SLUG = 'tinyverse-nexus';
    const WORLD_SELECTION_GATE_DEST = '__world-picker';
    const ACTIVE_TINYVERSE_LS = 'tinyworld:worlds.activeTinyverse.v1';
    const WORLD_CLAIM_START_LABEL = 'CLAIMS STARTS 23-JUN-26';
    const WORLD_CLAIM_DEMO_SLUGS = new Set(['tidewater-bay', 'green-pastures']);
  
    function api(path, method, body) {
      if (typeof window.__tinyworldCloudApiCall === 'function') return window.__tinyworldCloudApiCall(path, method, body);
      return Promise.resolve({ error: 'Cloud API unavailable' });
    }
    function T(key, params) { return typeof window.t === 'function' ? window.t(key, params) : key; }
    function toast(msg) { if (typeof twToast === 'function') twToast(msg); else console.log('[worlds]', msg); }
    function loggedIn() { return !!(window.__loggedIn || (window.TinyWorldAuth && window.TinyWorldAuth.currentUser && window.TinyWorldAuth.currentUser())); }
    function validWorldSlug(slug) {
      const s = String(slug || '').trim().toLowerCase();
      return /^[a-z0-9][a-z0-9-]{0,47}$/.test(s) && s !== TINYVERSE_HUB_SLUG ? s : '';
    }
    function activeTinyverseSlug() {
      try {
        const raw = localStorage.getItem(ACTIVE_TINYVERSE_LS);
        if (!raw) return '';
        const data = JSON.parse(raw);
        return validWorldSlug(data && data.slug);
      } catch (_) { return ''; }
    }
    function clearActiveTinyverseSession() {
      try { localStorage.removeItem(ACTIVE_TINYVERSE_LS); } catch (_) {}
    }
    function isClaimDemoWorld(w) {
      return WORLD_CLAIM_DEMO_SLUGS.has(validWorldSlug(w && w.slug));
    }
    function isClaimLockedWorld(w) {
      return !!(w && !isClaimDemoWorld(w));
    }
    function worldSelectionGateCell(gridSize) {
      const center = Math.floor(Math.max(1, gridSize) / 2);
      return { x: center, z: center, terrain: 'grass', kind: 'stargate', dest: WORLD_SELECTION_GATE_DEST };
    }
    function isWorldSelectionGateCenterCell(cell, x, z) {
      const cx = Math.round(Number(Array.isArray(cell) ? cell[0] : cell.x));
      const cz = Math.round(Number(Array.isArray(cell) ? cell[1] : cell.z));
      return cx === x && cz === z;
    }
    function normalizeWorldSelectionGateData(data, gridSizeHint) {
      const src = data && typeof data === 'object' ? data : { v: 4, cells: [] };
      const gridSize = Math.max(1, Math.round(Number(src.gridSize || gridSizeHint) || 8));
      const gate = worldSelectionGateCell(gridSize);
      const sourceCells = Array.isArray(src.cells) ? src.cells : [];
      const nextCells = [];
      sourceCells.forEach(cell => {
        if (!cell) return;
        const x = Math.round(Number(Array.isArray(cell) ? cell[0] : cell.x));
        const z = Math.round(Number(Array.isArray(cell) ? cell[1] : cell.z));
        const kind = Array.isArray(cell) ? cell[3] : cell.kind;
        if (!Number.isFinite(x) || !Number.isFinite(z)) return;
        if (kind === 'stargate') {
          // Strip legacy multi-gates; the normalizer adds one center exit gate.
          const terrain = (Array.isArray(cell) ? cell[2] : cell.terrain) || 'grass';
          if (terrain && terrain !== 'grass') nextCells.push(Array.isArray(cell) ? [x, z, terrain] : { x, z, terrain });
          return;
        }
        nextCells.push(cell);
      });
      const cells = nextCells.filter(cell => !isWorldSelectionGateCenterCell(cell, gate.x, gate.z));
      cells.push(gate);
      return Object.assign({}, src, { v: src.v || 4, gridSize, cells });
    }
    function normalizeWorldForEntry(world) {
      if (!world || typeof world !== 'object') return world;
      const next = Object.assign({}, world);
      next.data = normalizeWorldSelectionGateData(world.data || { v: 4, cells: [] }, world.gridSize);
      next.gridSize = next.data.gridSize || world.gridSize || 8;
      return next;
    }

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
      reply: { p: ['M10 17l-5-5 5-5', 'M5 12h9a6 6 0 0 1 6 6v1'] },
      chevronLeft: { p: ['M15 18l-6-6 6-6'] },
      chevronRight: { p: ['M9 18l6-6-6-6'] },
      search: { p: ['M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z', 'M16 16l5 5'] },
      filters: { p: ['M4 7h16', 'M7 12h10', 'M10 17h4'] },
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
    background:
      radial-gradient(circle at 50% 42%,rgba(42,211,95,.22),transparent 0 22%,rgba(11,88,125,.16) 42%,transparent 72%),
      radial-gradient(circle at 20% 76%,rgba(60,115,220,.16),transparent 0 30%),
      linear-gradient(180deg,#040816 0%,#07101f 54%,#03060d 100%);
    overflow:hidden;color:#eef3ff;font-family:'Pixelify Sans',ui-monospace,monospace}
  .tw-worlds-overlay::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.72;
    background-image:
      radial-gradient(circle,#e9f0ff 0 1px,transparent 1.5px),
      linear-gradient(rgba(88,122,172,.12) 1px,transparent 1px),
      linear-gradient(90deg,rgba(88,122,172,.12) 1px,transparent 1px);
    background-size:131px 89px,64px 64px,64px 64px;
    background-position:17px 23px,50% 32%,50% 32%;
    mask-image:radial-gradient(circle at 50% 44%,rgba(0,0,0,.85),transparent 74%)}
  .tw-worlds-overlay::after{content:"";position:absolute;left:50%;top:73%;width:min(1840px,92vw);height:430px;transform:translate(-50%,-50%);pointer-events:none;
    border:1px solid rgba(92,150,231,.16);border-radius:50%;box-shadow:0 0 0 18px rgba(92,150,231,.025),0 0 0 42px rgba(25,210,89,.035),0 0 100px rgba(54,176,255,.1)}
  .tw-worlds-overlay.open{display:block}
  .tw-worlds-wrap{position:relative;z-index:1;min-height:100%;box-sizing:border-box;max-width:1480px;margin:0 auto;padding:48px 24px 34px;display:flex;flex-direction:column;align-items:center}
  .tw-worlds-head{width:100%;display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:8px}
  .tw-worlds-title{position:relative;margin:0;font-size:25px;text-transform:uppercase;letter-spacing:.12em;color:#cbd5e4;text-shadow:0 2px 18px rgba(0,0,0,.8)}
  .tw-worlds-title::before,.tw-worlds-title::after{content:"";position:absolute;top:50%;width:30px;height:2px;background:#28d84e;box-shadow:0 0 12px rgba(40,216,78,.8)}
  .tw-worlds-title::before{right:calc(100% + 22px)}
  .tw-worlds-title::after{left:calc(100% + 22px)}
  .tw-worlds-head p{display:none}
  .tw-worlds-head-actions{position:absolute;right:24px;top:34px;display:flex;gap:8px;align-items:center}
  .tw-worlds-x{background:rgba(30,40,80,.55);border:1px solid rgba(100,130,220,.22);color:#dfe6ff;cursor:pointer;
    font:700 12px 'Pixelify Sans',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.04em;
    border-radius:8px;padding:9px 13px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 2px 8px -2px rgba(0,0,0,.35);transition:filter .08s}
  .tw-worlds-x:hover{filter:brightness(1.18)}
  .tw-worlds-x:active{transform:translateY(1px)}
  .tw-worlds-stage{position:relative;width:100%;height:min(58vh,570px);min-height:500px;margin:48px auto 0;overflow:visible}
  .tw-worlds-grid{position:absolute;inset:0;perspective:1000px}
  .tw-worlds-card{position:absolute;left:50%;top:50%;width:min(520px,calc(100vw - 72px));min-height:388px;box-sizing:border-box;
    background:linear-gradient(180deg,rgba(13,24,48,.88),rgba(5,10,22,.9));border:1px solid rgba(114,150,225,.34);border-radius:8px;padding:14px 14px 18px;display:flex;flex-direction:column;gap:10px;
    backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);
    box-shadow:inset 0 1px 0 rgba(160,190,255,.18),0 28px 80px -24px rgba(0,0,0,.85),0 10px 24px -12px rgba(0,0,0,.62);
    transition:transform .34s cubic-bezier(.2,.72,.18,1),opacity .28s ease,filter .34s ease,box-shadow .34s ease;will-change:transform,opacity,filter;cursor:pointer}
  .tw-worlds-card[data-offset="0"]{transform:translate(-50%,-50%) translateX(0) translateY(58px) scale(1);opacity:1;z-index:6;cursor:default;
    border-color:rgba(78,230,80,.68);box-shadow:inset 0 1px 0 rgba(214,255,218,.22),0 0 0 1px rgba(78,230,80,.28),0 0 34px rgba(52,225,88,.36),0 36px 92px -26px rgba(0,0,0,.9)}
  .tw-worlds-card[data-offset="-1"]{transform:translate(-50%,-50%) translateX(-415px) translateY(100px) scale(.72);opacity:.82;z-index:4;filter:saturate(.9) brightness(.82)}
  .tw-worlds-card[data-offset="1"]{transform:translate(-50%,-50%) translateX(415px) translateY(100px) scale(.72);opacity:.82;z-index:4;filter:saturate(.9) brightness(.82)}
  .tw-worlds-card[data-offset="-2"]{transform:translate(-50%,-50%) translateX(-735px) translateY(130px) scale(.56);opacity:.44;z-index:2;filter:saturate(.72) brightness(.66)}
  .tw-worlds-card[data-offset="2"]{transform:translate(-50%,-50%) translateX(735px) translateY(130px) scale(.56);opacity:.44;z-index:2;filter:saturate(.72) brightness(.66)}
  .tw-worlds-card[data-hidden="true"]{opacity:0;pointer-events:none;transform:translate(-50%,-50%) scale(.45)}
  .tw-worlds-card[data-offset="0"]::before{content:"";position:absolute;left:50%;top:-145px;width:2px;height:138px;transform:translateX(-50%);
    background:linear-gradient(180deg,rgba(66,255,87,0),rgba(66,255,87,.94));box-shadow:0 0 18px rgba(66,255,87,.8)}
  .tw-worlds-card[data-offset="0"]::after{content:"";position:absolute;left:50%;bottom:-18px;width:92%;height:42px;transform:translateX(-50%);border-radius:50%;
    border:2px solid rgba(66,255,87,.68);box-shadow:0 0 34px rgba(66,255,87,.46),inset 0 0 28px rgba(66,255,87,.18);pointer-events:none}
  .tw-worlds-card:not([data-offset="0"]) .tw-worlds-actions{display:none}
  .tw-worlds-card.tw-worlds-locked{opacity:.42;filter:grayscale(.85) brightness(.72)}
  .tw-worlds-card.tw-worlds-locked[data-offset="0"]{opacity:.74}
  .tw-worlds-card.tw-worlds-locked[data-hidden="true"]{opacity:0;pointer-events:none}
  .tw-worlds-card.tw-worlds-claim-locked{filter:grayscale(.38) brightness(.78)}
  .tw-worlds-card.tw-worlds-claim-locked[data-offset="0"]{opacity:.88}
  .tw-worlds-claim-banner{position:absolute;left:14px;right:14px;top:18px;z-index:3;display:flex;align-items:center;justify-content:center;
    min-height:34px;border-radius:7px;border:1px solid rgba(255,224,115,.7);
    background:linear-gradient(180deg,rgba(46,37,15,.96),rgba(124,78,11,.94));color:#fff1a8;
    font:800 14px/1 'Pixelify Sans',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;
    box-shadow:0 0 22px rgba(255,204,67,.22),inset 0 1px 0 rgba(255,255,255,.22);pointer-events:none;text-align:center}
  .tw-worlds-card:not([data-offset="0"]) .tw-worlds-claim-banner{font-size:11px;min-height:26px;top:12px}
  .tw-worlds-card h3{margin:0;font-size:23px;text-transform:uppercase;letter-spacing:.04em;display:flex;justify-content:center;align-items:center;gap:10px;text-align:center}
  .tw-worlds-card:not([data-offset="0"]) h3{font-size:19px}
  .tw-worlds-prev{width:100%;aspect-ratio:16/9;border-radius:5px;background:#05070e;image-rendering:pixelated;display:block;
    box-shadow:0 18px 38px -20px rgba(0,0,0,.9),0 0 26px rgba(27,155,255,.14)}
  .tw-worlds-card[data-offset="0"] .tw-worlds-prev{box-shadow:0 20px 44px -20px rgba(0,0,0,.95),0 0 42px rgba(66,255,87,.3)}
  .tw-badge{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:3px 7px;border-radius:6px}
  .tw-badge.unclaimed{background:rgba(19,52,107,.7);color:#9cc0ff;border:1px solid rgba(80,130,230,.25)}
  .tw-badge.draft{background:rgba(90,64,18,.7);color:#ffd690;border:1px solid rgba(200,160,60,.2)}
  .tw-badge.published{background:rgba(20,83,42,.7);color:#95e6b3;border:1px solid rgba(60,200,100,.2)}
  .tw-worlds-meta{display:flex;justify-content:center;gap:20px;flex-wrap:wrap;font-size:13px;opacity:.9;font-family:'Space Grotesk',system-ui,sans-serif}
  .tw-worlds-card:not([data-offset="0"]) .tw-worlds-meta{display:none}
  .tw-worlds-meta b{opacity:.6;font-weight:400}
  .tw-worlds-resources,.tw-worlds-ready{flex-basis:100%;display:flex;justify-content:center;gap:6px;line-height:1.25}
  .tw-worlds-resources{color:#bdf3c9}
  .tw-worlds-ready{color:#9fb4cf;font-size:12px}
  .tw-worlds-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto}
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
  .tw-worlds-actions .tw-btn.go{min-height:48px;font-size:13px;border-radius:7px;box-shadow:inset 0 1px 0 rgba(255,255,255,.32),0 0 22px rgba(74,221,53,.38),0 8px 24px -10px rgba(74,221,53,.7)}
  .tw-worlds-nav{position:absolute;top:58%;z-index:8;width:58px;height:58px;border-radius:50%;border:1px solid rgba(133,164,221,.3);display:grid;place-items:center;
    background:linear-gradient(180deg,rgba(36,52,87,.9),rgba(19,30,55,.92));color:#eef5ff;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 14px 32px -16px rgba(0,0,0,.9)}
  .tw-worlds-nav:hover{filter:brightness(1.16)}
  .tw-worlds-prev-btn{left:calc(50% - 370px)}
  .tw-worlds-next-btn{right:calc(50% - 370px)}
  .tw-worlds-dots{display:flex;gap:13px;align-items:center;justify-content:center;min-height:26px;margin:6px 0 14px}
  .tw-worlds-dot{width:8px;height:8px;border-radius:50%;border:0;background:rgba(124,146,179,.46);cursor:pointer;padding:0}
  .tw-worlds-dot.active{width:17px;height:17px;background:#4bed59;box-shadow:0 0 18px rgba(75,237,89,.85)}
  .tw-worlds-controls{display:flex;align-items:center;justify-content:center;gap:10px;width:min(520px,calc(100vw - 48px))}
  .tw-worlds-search-wrap{position:relative;flex:1}
  .tw-worlds-search-wrap svg{position:absolute;left:15px;top:50%;transform:translateY(-50%);color:#8999b9;pointer-events:none}
  .tw-worlds-search{width:100%;box-sizing:border-box;height:46px;border-radius:8px;border:1px solid rgba(106,133,184,.32);
    background:rgba(5,11,24,.74);color:#eef5ff;padding:0 14px 0 44px;font:600 15px 'Space Grotesk',system-ui,sans-serif;outline:none}
  .tw-worlds-search::placeholder{color:#8290a8}
  .tw-worlds-search:focus{border-color:rgba(70,224,88,.62);box-shadow:0 0 0 3px rgba(70,224,88,.16)}
  .tw-worlds-filter{height:46px;border-radius:8px;border:1px solid rgba(106,133,184,.32);padding:0 15px;display:flex;gap:9px;align-items:center;
    background:rgba(13,23,43,.82);color:#bfcbe0;font:700 12px 'Pixelify Sans',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.06em;cursor:pointer}
  .tw-worlds-filter.active{color:#95f0a5;border-color:rgba(70,224,88,.5);box-shadow:0 0 18px rgba(70,224,88,.16)}
  .tw-worlds-empty{position:absolute;inset:0;display:grid;place-items:center;text-align:center;color:#b8c3d8;font:700 14px 'Space Grotesk',system-ui,sans-serif}
  @media (max-width:860px){
    .tw-worlds-wrap{padding:30px 14px 24px}
    .tw-worlds-overlay::after{top:76%;width:1180px;height:330px}
    .tw-worlds-head-actions{right:14px;top:18px}
    .tw-worlds-title{font-size:19px}
    .tw-worlds-title::before,.tw-worlds-title::after{width:18px}
    .tw-worlds-stage{min-height:450px;height:54vh;margin-top:40px}
    .tw-worlds-card{width:min(420px,calc(100vw - 36px));min-height:352px}
    .tw-worlds-card[data-offset="0"]{transform:translate(-50%,-50%) translateX(0) translateY(44px) scale(1)}
    .tw-worlds-card[data-offset="-1"],.tw-worlds-card[data-offset="1"],.tw-worlds-card[data-offset="-2"],.tw-worlds-card[data-offset="2"]{opacity:0;pointer-events:none}
    .tw-worlds-card h3{font-size:18px}
    .tw-worlds-meta{gap:10px;font-size:12px}
    .tw-worlds-prev-btn{left:12px}
    .tw-worlds-next-btn{right:12px}
    .tw-worlds-nav{width:46px;height:46px;top:53%}
    .tw-worlds-controls{flex-wrap:wrap}
    .tw-worlds-filter{width:100%;justify-content:center}
  }
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
    let overlay = null, gridEl = null, dotsEl = null, searchEl = null, filterEl = null;
    let worldsCache = [], selectedWorldSlug = '', worldSearch = '', publishedOnly = false;
    let pickerCards = new Map();
    let wheelAccum = 0, wheelResetTimer = 0, wheelCooldownUntil = 0;
    let me = null;
    let savedFreeform = null;   // freeform world to restore when leaving a world

    function stateCellKind(cell) { return Array.isArray(cell) ? cell[3] : (cell && cell.kind); }
    function looksLikeLegacyPickerBoard(state) {
      const cells = state && Array.isArray(state.cells) ? state.cells : [];
      let stargates = 0;
      for (const cell of cells) if (stateCellKind(cell) === 'stargate') stargates += 1;
      return stargates >= 4;
    }
  
    function ensureOverlay() {
      if (overlay) return overlay;
      injectStyles();
      gridEl = el('div', { class: 'tw-worlds-grid' });
      dotsEl = el('div', { class: 'tw-worlds-dots', role: 'tablist', 'aria-label': 'Worlds' });
      searchEl = el('input', {
        class: 'tw-worlds-search',
        type: 'search',
        placeholder: 'Search worlds...',
        autocomplete: 'off',
        'aria-label': 'Search worlds',
      });
      searchEl.addEventListener('input', () => {
        worldSearch = searchEl.value.trim().toLowerCase();
        selectedWorldSlug = '';
        renderPicker();
      });
      filterEl = el('button', {
        class: 'tw-worlds-filter',
        type: 'button',
        onclick: () => {
          publishedOnly = !publishedOnly;
          selectedWorldSlug = '';
          renderPicker();
        },
      }, [makeIcon('filters', 15), el('span', { text: 'Filters' })]);
      const stage = el('div', { class: 'tw-worlds-stage' }, [
        el('button', {
          class: 'tw-worlds-nav tw-worlds-prev-btn',
          type: 'button',
          'aria-label': 'Previous world',
          onclick: () => rotateWorldSelection(-1),
        }, [makeIcon('chevronLeft', 28)]),
        gridEl,
        el('button', {
          class: 'tw-worlds-nav tw-worlds-next-btn',
          type: 'button',
          'aria-label': 'Next world',
          onclick: () => rotateWorldSelection(1),
        }, [makeIcon('chevronRight', 28)]),
      ]);
      stage.addEventListener('wheel', handleWorldPickerWheel, { passive: false });
      const controls = el('div', { class: 'tw-worlds-controls' }, [
        el('label', { class: 'tw-worlds-search-wrap' }, [makeIcon('search', 17), searchEl]),
        filterEl,
      ]);
      const titleText = T('worlds.chooseWorld') === 'worlds.chooseWorld' ? 'Choose your world' : T('worlds.chooseWorld');
      const head = el('div', { class: 'tw-worlds-head' }, [
        el('h2', { class: 'tw-worlds-title', text: titleText }),
        el('div', { class: 'tw-worlds-head-actions' }, [
          el('button', { class: 'tw-worlds-x', title: T('worlds.avatarOpen'),
            onclick: () => { if (typeof WS.openAvatarPicker === 'function') WS.openAvatarPicker(); } },
            [makeIcon('person', 16), el('span', { text: T('worlds.avatarOpen'), style: 'margin-left:6px' })]),
          el('button', { class: 'tw-worlds-x', onclick: closeOverlay, text: T('worlds.close') }),
        ]),
      ]);
      overlay = el('div', { class: 'tw-worlds-overlay' }, [el('div', { class: 'tw-worlds-wrap' }, [head, stage, dotsEl, controls])]);
      overlay.addEventListener('wheel', handleWorldPickerWheel, { passive: false });
      document.body.appendChild(overlay);
      return overlay;
    }
  
    function openOverlay() { ensureOverlay().classList.add('open'); loadWorlds(); }
    function closeOverlay() { if (overlay) overlay.classList.remove('open'); }
  
    async function loadWorlds() {
      if (!gridEl) return;
      pickerCards.clear();
      gridEl.textContent = "";
      gridEl.appendChild(el("p", { class: 'tw-worlds-empty', text: T("worlds.loading") }));
      const res = await api("/api/worlds", "GET");
      if (!res || res.error) { worldsCache = []; gridEl.textContent = ""; gridEl.appendChild(el("p", { class: 'tw-worlds-empty', text: res && res.error ? res.error : T("worlds.empty") })); return; }
      me = res.me || null;
      const worlds = (Array.isArray(res.worlds) ? res.worlds : []).filter(w => validWorldSlug(w && w.slug));
      setWorlds(worlds);
    }

    function setWorlds(worlds) {
      worldsCache = Array.isArray(worlds) ? worlds.slice() : [];
      pickerCards.clear();
      if (gridEl) gridEl.textContent = '';
      if (!selectedWorldSlug) {
        const active = activeTinyverseSlug();
        const preferred = worldsCache.find(w => w.slug === active) || worldsCache.find(w => w.slug === 'tidewater-bay') || worldsCache.find(w => w.status === 'published') || worldsCache[0];
        selectedWorldSlug = preferred ? preferred.slug : '';
      }
      renderPicker();
    }

    function worldTitle(w) {
      const baseTitle = w.name || (w.kind === 'starter' ? w.slug : T('worlds.statusUnclaimed'));
      return baseTitle + (isClaimDemoWorld(w) ? ' (demo)' : '');
    }

    const RESOURCE_LABELS = [
      ['fish', 'worlds.resourceFish'],
      ['ore', 'worlds.resourceOre'],
      ['plants', 'worlds.resourcePlants'],
      ['meat', 'worlds.resourceMeat'],
    ];

    function resourceStatsText(stats) {
      const s = stats || {};
      const parts = RESOURCE_LABELS.map(([key, label]) => {
        const value = Math.max(0, Math.round(Number(s[key]) || 0));
        return value > 0 ? T(label) + ' ' + value : '';
      }).filter(Boolean);
      return parts.length ? parts.join(' · ') : T('worlds.noResources');
    }

    function visibleWorlds() {
      const q = worldSearch || '';
      return worldsCache.filter(w => {
        if (publishedOnly && w.status !== 'published') return false;
        if (!q) return true;
        const hay = [
          worldTitle(w),
          w.slug,
          w.status,
          w.ownerName,
          w.gridSize,
          w.tileCount,
          w.taxPercent,
          resourceStatsText(w.resourceStats),
          w.resourceStats && w.resourceStats.ready,
        ].join(' ').toLowerCase();
        return hay.includes(q);
      });
    }

    function selectedIndexFor(list) {
      if (!list.length) return -1;
      let idx = list.findIndex(w => w.slug === selectedWorldSlug);
      if (idx >= 0) return idx;
      idx = list.findIndex(w => w.status === 'published');
      return idx >= 0 ? idx : 0;
    }

    function carouselOffset(index, selectedIndex, count) {
      let offset = index - selectedIndex;
      if (count > 2) {
        const half = count / 2;
        if (offset > half) offset -= count;
        if (offset < -half) offset += count;
      }
      return offset;
    }

    function rotateWorldSelection(delta) {
      const worlds = visibleWorlds();
      if (!worlds.length) return;
      const idx = selectedIndexFor(worlds);
      const next = (idx + delta + worlds.length) % worlds.length;
      selectedWorldSlug = worlds[next].slug;
      renderPicker();
    }

    function selectWorldSlug(slug) {
      const next = validWorldSlug(slug);
      if (!next || next === selectedWorldSlug) return;
      selectedWorldSlug = next;
      renderPicker();
    }

    function handleWorldPickerWheel(e) {
      if (!overlay || !overlay.classList.contains('open')) return;
      const target = e.target;
      if (target && target.closest && target.closest('input,textarea,select,.tw-worlds-controls,.tw-worlds-head-actions')) return;
      const worlds = visibleWorlds();
      if (worlds.length < 2) return;
      const dx = Number(e.deltaX) || 0;
      const dy = Number(e.deltaY) || 0;
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (!delta) return;
      e.preventDefault();
      e.stopPropagation();
      wheelAccum += delta;
      clearTimeout(wheelResetTimer);
      wheelResetTimer = setTimeout(() => { wheelAccum = 0; }, 160);
      const threshold = e.deltaMode === 1 ? 2 : 36;
      const now = (window.performance && performance.now) ? performance.now() : Date.now();
      if (Math.abs(wheelAccum) < threshold || now < wheelCooldownUntil) return;
      const step = wheelAccum > 0 ? 1 : -1;
      wheelAccum = 0;
      wheelCooldownUntil = now + 120;
      rotateWorldSelection(step);
    }

    function renderPicker() {
      if (!gridEl) return;
      const worlds = visibleWorlds();
      if (dotsEl) dotsEl.textContent = '';
      if (filterEl) {
        filterEl.classList.toggle('active', !!publishedOnly);
        const span = filterEl.querySelector('span');
        if (span) span.textContent = publishedOnly ? 'Live only' : 'Filters';
      }
      if (!worlds.length) {
        pickerCards.clear();
        gridEl.textContent = '';
        gridEl.appendChild(el('p', { class: 'tw-worlds-empty', text: T('worlds.empty') }));
        return;
      }
      const selectedIndex = selectedIndexFor(worlds);
      selectedWorldSlug = worlds[selectedIndex].slug;
      const emptyEl = gridEl.querySelector('.tw-worlds-empty');
      if (emptyEl) emptyEl.remove();
      const liveSlugs = new Set(worlds.map(w => w.slug));
      for (const [slug, card] of pickerCards) {
        if (!liveSlugs.has(slug)) {
          card.remove();
          pickerCards.delete(slug);
        }
      }
      worlds.forEach((w, i) => {
        let card = pickerCards.get(w.slug);
        if (!card) {
          card = renderCard(w);
          pickerCards.set(w.slug, card);
          gridEl.appendChild(card);
        } else if (card.parentNode !== gridEl) {
          gridEl.appendChild(card);
        }
        updateCardPosition(card, w, i, selectedIndex, worlds.length);
      });
      if (dotsEl) {
        worlds.forEach((w, i) => dotsEl.appendChild(el('button', {
          class: 'tw-worlds-dot' + (i === selectedIndex ? ' active' : ''),
          type: 'button',
          role: 'tab',
          'aria-selected': i === selectedIndex ? 'true' : 'false',
          'aria-label': worldTitle(w),
          onclick: () => selectWorldSlug(w.slug),
        })));
      }
    }
  
    function statusBadge(status) {
      const map = { unclaimed: T('worlds.statusUnclaimed'), draft: T('worlds.statusDraft'), published: T('worlds.statusPublished') };
      return el('span', { class: 'tw-badge ' + status, text: map[status] || status });
    }
  
    function isMine(w) {
      return me && w && w.ownerProfileId != null && Number(w.ownerProfileId) === Number(me.id);
    }

    function isLockedWorld(w) {
      return w && ((isClaimLockedWorld(w) && !isMine(w)) || w.status === 'unclaimed' || (w.status === 'draft' && !isMine(w)));
    }

    function updateCardPosition(card, w, index, selectedIndex, count) {
      const offset = carouselOffset(index, selectedIndex, count);
      const hidden = Math.abs(offset) > 2;
      const shownOffset = Math.max(-2, Math.min(2, offset));
      const selected = index === selectedIndex;
      card.dataset.offset = String(shownOffset);
      card.dataset.hidden = hidden ? 'true' : 'false';
      card.tabIndex = hidden ? -1 : 0;
      card.setAttribute('aria-selected', selected ? 'true' : 'false');
      card.classList.toggle('tw-worlds-locked', !!isLockedWorld(w));
      card.classList.toggle('tw-worlds-claim-locked', !!isClaimLockedWorld(w));
    }

    function renderCard(w) {
      // Demo worlds stay playable before claims open; the rest show the
      // claim-start banner and refuse direct entry.
      const mine = isMine(w);
      const claimLocked = isClaimLockedWorld(w);
      const locked = isLockedWorld(w);
      const resources = w.resourceStats || {};
      const meta = el('div', { class: 'tw-worlds-meta' }, [
        el('div', {}, [el('b', { text: T('worlds.tiles') + ': ' }), document.createTextNode(String(w.tileCount))]),
        el('div', {}, [el('b', { text: T('worlds.players') + ': ' }), document.createTextNode(String(w.activePlayers || 0))]),
        el('div', {}, [el('b', { text: T('worlds.tax') + ': ' }), document.createTextNode(w.taxPercent + '%')]), (w.taxCooldown && !w.taxCooldown.canChange) ? el('span', { style: 'font-size:10px;color:#f66;margin-left:6px', text: '(CD)' }) : null,
        el('div', {}, [el('b', { text: T('worlds.owner') + ': ' }), document.createTextNode(w.ownerName || '—')]),
        el('div', { class: 'tw-worlds-resources' }, [el('b', { text: T('worlds.resources') + ': ' }), document.createTextNode(resourceStatsText(resources))]),
        el('div', { class: 'tw-worlds-ready' }, [el('b', { text: T('worlds.ready') + ': ' }), document.createTextNode(String(Math.max(0, Math.round(Number(resources.ready) || 0))) + ' ' + T('worlds.nodes'))]),
      ]);
      const actions = el('div', { class: 'tw-worlds-actions' });
      if (claimLocked) {
        actions.appendChild(el('button', { class: 'tw-btn alt', text: WORLD_CLAIM_START_LABEL, disabled: 'disabled' }));
        if (mine && w.status === 'draft') {
          actions.appendChild(el('button', { class: 'tw-btn', text: T('worlds.build'), onclick: (e) => { e.stopPropagation(); buildDraft(w); } }));
          actions.appendChild(el('button', { class: 'tw-btn alt', text: T('worlds.manage'), onclick: (e) => { e.stopPropagation(); manageFlow(w); } }));
        } else if (mine && w.status === 'published') {
          actions.appendChild(el('button', { class: 'tw-btn alt', text: T('worlds.manage'), onclick: (e) => { e.stopPropagation(); manageFlow(w); } }));
        }
      } else if (w.status === 'unclaimed' || w.status === 'published') {
        // Owner-held early-preview islands: players just ENTER and PLAY (resource
        // gathering). No claim, no buy, no ownership transfer, no currency.
        actions.appendChild(el('button', { class: 'tw-btn go', text: T('worlds.enter'), onclick: (e) => { e.stopPropagation(); enterWorld(w); } }));
        if (mine) actions.appendChild(el('button', { class: 'tw-btn alt', text: T('worlds.manage'), onclick: (e) => { e.stopPropagation(); manageFlow(w); } }));
      } else if (w.status === 'draft' && mine) {
        actions.appendChild(el('button', { class: 'tw-btn', text: T('worlds.build'), onclick: (e) => { e.stopPropagation(); buildDraft(w); } }));
        actions.appendChild(el('button', { class: 'tw-btn alt', text: T('worlds.manage'), onclick: (e) => { e.stopPropagation(); manageFlow(w); } }));
      }
      const prev = el('canvas', { class: 'tw-worlds-prev', width: '320', height: '200' });
      const card = el('article', { class: 'tw-worlds-card' + (locked ? ' tw-worlds-locked' : '') + (claimLocked ? ' tw-worlds-claim-locked' : ''), 'data-offset': '0', 'data-hidden': 'true' }, [
        claimLocked ? el('div', { class: 'tw-worlds-claim-banner', text: WORLD_CLAIM_START_LABEL }) : null,
        prev,
        el('h3', {}, [document.createTextNode(worldTitle(w)), statusBadge(w.status)]), meta, actions,
      ]);
      card.dataset.slug = w.slug;
      card.addEventListener('click', () => {
        selectWorldSlug(w.slug);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectWorldSlug(w.slug);
        }
      });
      if (locked) {
        card.setAttribute('aria-disabled', 'true');
        actions.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      }
      // Isometric 2D preview of the world's tiles.
      if (typeof WS.renderPreview === 'function') {
        const preview = Object.assign({ gridSize: w.gridSize, cells: [], slug: w.slug, name: w.name, id: w.id }, w.preview || {});
        preview.cells = normalizeWorldSelectionGateData({ v: 4, gridSize: preview.gridSize, cells: preview.cells }, preview.gridSize).cells;
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
  
  
    // ---- manage (name / tax / publish / unpublish) ----
    function manageFlow(w) {
  // taxCooldown support from server (after our updates)
  const cd = w.taxCooldown || null;
  const onCooldown = cd && !cd.canChange;
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
          if (res.world && res.world.taxCooldown && !res.world.taxCooldown.canChange) {
            taxI.disabled = true;
            const h = Math.ceil((res.world.taxCooldown.remainingMs || 0) / (1000*60*60));
            body.push(el('p', { style: 'font-size:11px;color:#f66;margin-top:4px', text: 'Tax on cooldown for ~' + h + 'h' }));
          }
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
      if (typeof WS.leaveRoom === 'function') {
        try { WS.leaveRoom(); } catch (_) {}
      } else if (typeof WS.setPlayChrome === 'function') {
        try { WS.setPlayChrome(false); } catch (_) {}
      }
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
      if (savedFreeform && typeof applyState === 'function') {
        try {
          applyState(looksLikeLegacyPickerBoard(savedFreeform) ? { v: 4, gridSize: 8, cells: [] } : savedFreeform);
        } catch (_) {}
      }
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
      if (isClaimLockedWorld(full.world)) { toast(WORLD_CLAIM_START_LABEL); return false; }
      if (full.world.status !== 'published') { toast(T('worlds.error')); return false; }
      if (!validWorldSlug(full.world.slug)) { toast(T('worlds.error')); return false; }
      full = Object.assign({}, full, { world: normalizeWorldForEntry(full.world) });
      WS.myProfileId = (full.me && full.me.id != null) ? full.me.id : (me && me.id != null ? me.id : null);
      // Multiplayer rooms are play/moderation surfaces only; building happens in
      // the dedicated draft/version flow, never inline in the room client.
      WS.canAdminEdit = false;
      WS.adminWorldId = null;
      rememberFreeform();
      closeOverlay();
      if (typeof WS.enterRoom === 'function') {
        // CCTV-only view (?view=cctv) forces a passive observer join.
        const role = window.__tinyworldForceRole === 'observe' ? 'observe' : 'play';
        WS.enterRoom(full.world, full.token || '', role);
        return true;
      }
      toast(T('worlds.error'));
      return false;
    }

    async function enterWorld(w) {
      const full = w && w.id != null
        ? await api("/api/worlds?id=" + w.id, "GET")
        : await api("/api/worlds?slug=" + encodeURIComponent(validWorldSlug(w && w.slug)), "GET");
      return enterWorldFull(full);
    }

    async function enterBySlug(slug) {
      const s = validWorldSlug(slug);
      if (!s) { toast(T("worlds.error")); return false; }
      const full = await api("/api/worlds?slug=" + encodeURIComponent(s), "GET");
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
      const resumeSlug = slug || activeTinyverseSlug();
      if (!resumeSlug) return;
      await waitForEnterRoom();
      dismissWelcomeForDemoEntry();
      const ok = await enterBySlug(resumeSlug);
      if (!ok) {
        clearActiveTinyverseSession();
        try {
          if (typeof window.__tinyworldShowWelcomeLaunch === 'function') window.__tinyworldShowWelcomeLaunch();
        } catch (_) {}
      }
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
    // enterPublished accepts a world row ({id,...}) OR a slug-only object ({slug}).
    // Stargate travel (47) passes { slug }, so route by slug when no id is present.
    WS.enterPublished = function (w) {
      if (w && w.slug && (w.id == null)) return enterBySlug(w.slug);
      return enterWorld(w);
    };
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

    if ((typeof window.__tinyworldTinyverseSlugParam === 'function' && window.__tinyworldTinyverseSlugParam()) || activeTinyverseSlug()) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeAutoEnterDemoWorld);
      else maybeAutoEnterDemoWorld();
    }
  })();
