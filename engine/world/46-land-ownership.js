  // -------- metaworld: land ownership + soft economy -------- //
  // A client-side foundation for the Metaworld mode: the world is tiled into
  // board-sized parcels (one board === one parcel, keyed "boardX,boardZ").
  // Players claim free unowned parcels, buy/sell/list/rent owned ones with a
  // soft in-game currency (TinyCoins), and may only build on parcels they own
  // or rent (enforced by the build gate in 20-input-place-erase.js via
  // window.__tinyworldLand.canBuildCell). State persists to localStorage; the
  // same registry is the ownership base Battleworld island-capture will reuse.
  // A later follow-up backs this with the cloud API + $TINYWORLD settlement.
  (function metaworldLandModule() {
    'use strict';

    const COINS_LS = 'tinyworld:coins.v1';
    const LAND_LS = 'tinyworld:land.v1';
    const ME_LS = 'tinyworld:land:me.v1';
    const INCOME_LS = 'tinyworld:land:income-at.v1';
    const START_COINS = 500;
    const CLAIM_COST = 0;          // claiming unowned land is free
    const DEFAULT_BUY_PRICE = 100;
    const DEFAULT_RENT_PRICE = 10;
    const RENT_MS = 1000 * 60 * 30;        // a rental grants 30 min of build rights
    const INCOME_PER_PARCEL = 5;           // ground rent collected on entry
    const INCOME_THROTTLE_MS = 1000 * 60 * 5;
    const INCOME_MAX_PARCELS = 20;

    function tt(key, fallback, params) {
      try { if (window.t && window.has && window.has(key)) return window.t(key, params); } catch (_) {}
      try { if (window.tx) return window.tx(key, fallback); } catch (_) {}
      return fallback;
    }
    function toast(msg, kind) { if (typeof twToast === 'function') twToast(msg, kind || 'ok'); }

    // ---- identity ----
    function resolveMe() {
      try {
        const mp = window.__tinyworldMultiplayer;
        if (mp && mp.presence && mp.presence.id) return mp.presence.id;
      } catch (_) {}
      try {
        const cid = localStorage.getItem('tinyworld:multiplayer:client-id');
        if (cid) return cid;
      } catch (_) {}
      try {
        let id = localStorage.getItem(ME_LS);
        if (!id) { id = 'me-' + Math.random().toString(36).slice(2, 10); localStorage.setItem(ME_LS, id); }
        return id;
      } catch (_) { return 'me'; }
    }
    const ME = resolveMe();

    // ---- economy ----
    let coins = START_COINS;
    try { const v = parseInt(localStorage.getItem(COINS_LS), 10); if (Number.isFinite(v)) coins = v; } catch (_) {}
    function saveCoins() { try { localStorage.setItem(COINS_LS, String(coins | 0)); } catch (_) {} }
    function fmtCoins(n) { return '⊙' + (n | 0); }
    window.__tinyworldEconomy = {
      balance: () => coins,
      canAfford: (n) => coins >= (n | 0),
      credit: (n) => { coins += (n | 0); saveCoins(); scheduleHud(); return coins; },
      debit: (n) => { if (coins < (n | 0)) return false; coins -= (n | 0); saveCoins(); scheduleHud(); return true; },
      format: fmtCoins,
    };

    // ---- land registry ----
    // parcels[key] = { owner, forSale, price, rent, renter, rentUntil }
    let parcels = {};
    try { const raw = localStorage.getItem(LAND_LS); if (raw) parcels = JSON.parse(raw) || {}; } catch (_) {}
    function saveLand() { try { localStorage.setItem(LAND_LS, JSON.stringify(parcels)); } catch (_) {} }

    function gridSize() { return (typeof GRID === 'number' && GRID > 0) ? GRID : 8; }
    function parcelKeyForCell(x, z) {
      const g = gridSize();
      return Math.floor(x / g) + ',' + Math.floor(z / g);
    }
    function recOf(key) { return parcels[key] || null; }
    function ownerOf(key) { const r = recOf(key); return r ? r.owner : null; }
    function isMine(key) { return ownerOf(key) === ME; }
    function rentActive(r) { return !!r && r.renter === ME && (!r.rentUntil || r.rentUntil > Date.now()); }

    // The home board is the player's starting island — owned by default.
    function ensureHome() {
      if (!parcels['0,0']) {
        parcels['0,0'] = { owner: ME, forSale: false, price: DEFAULT_BUY_PRICE, rent: DEFAULT_RENT_PRICE };
        saveLand();
      }
    }
    ensureHome();

    function metaActive() { return document.body.classList.contains('tw-mode-meta'); }

    function canBuildCell(x, z) {
      if (!metaActive()) return true;                 // gating only in Metaworld
      const r = recOf(parcelKeyForCell(x, z));
      if (!r) return false;                           // unclaimed: claim it first
      return r.owner === ME || rentActive(r);
    }

    let lastBlockToast = 0;
    function notifyBlocked() {
      const now = Date.now();
      if (now - lastBlockToast < 1600) return;
      lastBlockToast = now;
      toast(tt('meta.toast.blocked', "You don't own this land — claim it first."), 'err');
    }

    // ---- actions (operate on a parcel key) ----
    function claim(key) {
      if (recOf(key)) return false;
      if (CLAIM_COST > 0 && !window.__tinyworldEconomy.debit(CLAIM_COST)) {
        toast(tt('meta.toast.poor', 'Not enough coins.'), 'err'); return false;
      }
      parcels[key] = { owner: ME, forSale: false, price: DEFAULT_BUY_PRICE, rent: DEFAULT_RENT_PRICE };
      saveLand(); scheduleHud();
      toast(tt('meta.toast.claimed', 'Land claimed!'), 'ok');
      return true;
    }
    function buy(key) {
      const r = recOf(key);
      if (!r || r.owner === ME || !r.forSale) return false;
      const price = r.price | 0;
      if (!window.__tinyworldEconomy.debit(price)) { toast(tt('meta.toast.poor', 'Not enough coins.'), 'err'); return false; }
      r.owner = ME; r.forSale = false; r.renter = null; r.rentUntil = 0;
      saveLand(); scheduleHud();
      toast(tt('meta.toast.bought', 'Land purchased!'), 'ok');
      return true;
    }
    function listForSale(key) {
      const r = recOf(key);
      if (!r || r.owner !== ME) return false;
      r.forSale = !r.forSale;
      if (r.forSale && !(r.price > 0)) r.price = DEFAULT_BUY_PRICE;
      saveLand(); scheduleHud();
      toast(r.forSale ? tt('meta.toast.listed', 'Listed for sale.') : tt('meta.toast.unlisted', 'Removed from sale.'), 'ok');
      return true;
    }
    function rent(key) {
      const r = recOf(key);
      if (!r || r.owner === ME) return false;
      const price = (r.rent | 0) || DEFAULT_RENT_PRICE;
      if (!window.__tinyworldEconomy.debit(price)) { toast(tt('meta.toast.poor', 'Not enough coins.'), 'err'); return false; }
      r.renter = ME; r.rentUntil = Date.now() + RENT_MS;
      saveLand(); scheduleHud();
      toast(tt('meta.toast.rented', 'Rented — you can build here for a while.'), 'ok');
      return true;
    }

    // Passive income: collect ground rent from owned parcels on entering
    // Metaworld, throttled so it isn't farmable by toggling modes.
    function collectEntryIncome() {
      let lastAt = 0;
      try { lastAt = parseInt(localStorage.getItem(INCOME_LS), 10) || 0; } catch (_) {}
      if (Date.now() - lastAt < INCOME_THROTTLE_MS) return;
      let owned = 0;
      for (const k in parcels) { if (parcels[k] && parcels[k].owner === ME) owned++; }
      if (owned <= 0) return;
      const amount = Math.min(owned, INCOME_MAX_PARCELS) * INCOME_PER_PARCEL;
      window.__tinyworldEconomy.credit(amount);
      try { localStorage.setItem(INCOME_LS, String(Date.now())); } catch (_) {}
      toast(tt('meta.toast.income', 'Collected {n} ground rent.', { n: fmtCoins(amount) }), 'ok');
    }

    // Force-assign a parcel to the local player. Used by Battleworld island
    // capture so a conquered island's ownership persists in the registry.
    function captureForMe(key) {
      const r = recOf(key);
      if (r) { r.owner = ME; r.forSale = false; r.renter = null; r.rentUntil = 0; }
      else parcels[key] = { owner: ME, forSale: false, price: DEFAULT_BUY_PRICE, rent: DEFAULT_RENT_PRICE };
      saveLand(); scheduleHud();
    }

    // ---- public API ----
    window.__tinyworldLand = {
      me: () => ME,
      parcelKeyForCell,
      ownerOf,
      isMine,
      canBuildCell,
      notifyBlocked,
      claim,
      buy,
      listForSale,
      rent,
      captureForMe,
      info: (key) => {
        const r = recOf(key);
        return r ? { owner: r.owner, mine: r.owner === ME, forSale: !!r.forSale, price: r.price | 0, rent: (r.rent | 0) || DEFAULT_RENT_PRICE, rented: rentActive(r) } : null;
      },
    };

    // ---- HUD ----
    let hud = null, coinEl = null, parcelEl = null, ownerEl = null, actionsEl = null;
    let lastRenderKey = '';

    function buildHud() {
      hud = document.getElementById('metaworld-hud');
      if (!hud) return;
      coinEl = hud.querySelector('[data-meta-coins]');
      parcelEl = hud.querySelector('[data-meta-parcel]');
      ownerEl = hud.querySelector('[data-meta-owner]');
      actionsEl = hud.querySelector('[data-meta-actions]');
    }

    function hoverParcelKey() {
      let h = null;
      try { h = window.__tinyworldGetHover && window.__tinyworldGetHover(); } catch (_) {}
      if (!h) return null;
      const bx = h.boardX || 0, bz = h.boardZ || 0;
      return bx + ',' + bz;
    }

    function mkBtn(label, cls, onClick) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'meta-action ' + (cls || '');
      b.textContent = label;
      b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); renderHud(true); });
      return b;
    }

    function renderHud(force) {
      if (!hud) buildHud();
      if (!hud) return;
      if (coinEl) coinEl.textContent = fmtCoins(coins);
      const key = hoverParcelKey();
      const sig = key + '|' + coins + '|' + (key ? JSON.stringify(parcels[key] || 0) : '-');
      if (!force && sig === lastRenderKey) return;
      lastRenderKey = sig;

      if (!key) {
        if (parcelEl) parcelEl.textContent = tt('meta.hud.point', 'Point at a parcel');
        if (ownerEl) ownerEl.textContent = '';
        if (actionsEl) actionsEl.innerHTML = '';
        return;
      }
      if (parcelEl) parcelEl.textContent = tt('meta.hud.parcel', 'Parcel') + ' ' + key;
      const info = window.__tinyworldLand.info(key);
      if (actionsEl) actionsEl.innerHTML = '';
      if (!info) {
        if (ownerEl) ownerEl.textContent = tt('meta.hud.unclaimed', 'Unclaimed');
        if (actionsEl) actionsEl.appendChild(mkBtn(tt('meta.hud.claim', 'Claim'), 'is-claim', () => claim(key)));
        return;
      }
      if (info.mine) {
        if (ownerEl) ownerEl.textContent = tt('meta.hud.you', 'You') + (info.forSale ? ' · ' + tt('meta.hud.forSale', 'For sale') : '');
        if (actionsEl) actionsEl.appendChild(mkBtn(info.forSale ? tt('meta.hud.unlist', 'Unlist') : (tt('meta.hud.list', 'List for sale') + ' ' + fmtCoins(info.price)), 'is-list', () => listForSale(key)));
      } else {
        if (ownerEl) ownerEl.textContent = tt('meta.hud.someone', 'Another player');
        if (actionsEl) {
          if (info.forSale) actionsEl.appendChild(mkBtn(tt('meta.hud.buy', 'Buy') + ' ' + fmtCoins(info.price), 'is-buy', () => buy(key)));
          actionsEl.appendChild(mkBtn(tt('meta.hud.rent', 'Rent') + ' ' + fmtCoins(info.rent), 'is-rent', () => rent(key)));
        }
      }
    }

    let hudTimer = 0;
    function scheduleHud() { if (!hudTimer) hudTimer = requestAnimationFrame(() => { hudTimer = 0; renderHud(false); }); }

    // Poll hover at a light cadence so the HUD tracks the parcel under the
    // pointer without hooking the hot render loop.
    let pollTimer = 0;
    function startPolling() { if (!pollTimer) pollTimer = setInterval(() => { if (metaActive()) renderHud(false); }, 250); }
    function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = 0; } }

    function onModeChanged(e) {
      const mode = e && e.detail && e.detail.mode;
      if (mode === 'meta') {
        ensureHome();
        renderHud(true);
        startPolling();
        collectEntryIncome();
      } else {
        stopPolling();
      }
    }
    window.addEventListener('tinyworld:game-mode-changed', onModeChanged);
    window.addEventListener('DOMContentLoaded', () => { buildHud(); if (metaActive()) { renderHud(true); startPolling(); } });
    // In case the module loads after DOMContentLoaded has already fired.
    buildHud();
    if (metaActive()) { renderHud(true); startPolling(); }
  }());
