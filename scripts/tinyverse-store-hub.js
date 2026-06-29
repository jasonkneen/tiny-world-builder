// -------- Tinyverse collectibles hub (release preview) --------
(function () {
  'use strict';

  const ROOT_ID = 'tinyverseStoreHub';
  const PACK_ART_URL = 'assets/pack-wrapper-foil.png';
  const ACTIVITY_MAX = 14;
  const ACTIVITY_PLAYERS = [
    'MossFern', 'CliffWalker', 'SkyLoom', 'PondMint', 'DuneHopper', 'PineRelay',
    'HarborLark', 'ReedPilot', 'StoneSail', 'BirchMoth', 'CoralNest', 'FrostLoom',
    'MapleVale', 'TideRook', 'GroveMint', 'AshPilot', 'LumenFern', 'QuarryBee',
  ];
  const ACTIVITY_ISLANDS = [
    { name: 'Moss Hollow', rarity: 'Legendary' },
    { name: 'Cliff Haven', rarity: 'Legendary' },
    { name: 'Sun Orchard', rarity: 'Rare' },
    { name: 'Reed Crossing', rarity: 'Rare' },
    { name: 'Pine Relay', rarity: 'Epic' },
    { name: 'Harbor Lark', rarity: 'Uncommon' },
    { name: 'Stone Sail', rarity: 'Epic' },
    { name: 'Birch Vale', rarity: 'Common' },
    { name: 'Coral Nest', rarity: 'Rare' },
    { name: 'Frost Loom', rarity: 'Legendary' },
    { name: 'Maple Rise', rarity: 'Uncommon' },
    { name: 'Tide Rook', rarity: 'Epic' },
  ];
  const ACTIVITY_RARITY_WEIGHTS = [
    ['Common', 42],
    ['Uncommon', 28],
    ['Rare', 18],
    ['Epic', 9],
    ['Legendary', 3],
  ];
  let root = null;
  let visible = false;
  let handlers = {};
  let refreshTimer = null;
  let activityEvents = [];
  let activityTicker = null;
  let activityAgeTicker = null;
  let activitySeq = 0;

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function TC() {
    return window.TinyverseCollectibles;
  }

  function freeOpensLabel() {
    const api = TC();
    if (!api || typeof api.getFreePacksRemaining !== 'function') return '—';
    const left = api.getFreePacksRemaining();
    const limit = api.FREE_PACK_LIMIT || 3;
    return left + ' of ' + limit + ' free opens';
  }

  function canOpenPack() {
    const api = TC();
    return api && typeof api.canOpenFreePack === 'function' && api.canOpenFreePack();
  }

  function islandRows() {
    const api = TC();
    if (!api || typeof api.list !== 'function') return [];
    return api.list().filter(row => row && row.kind === 'island');
  }

  function previewFromRow(row) {
    const api = TC();
    if (api && typeof api.previewFromWorld === 'function' && row && row.preview) {
      return row.preview;
    }
    if (!row) return null;
    if (row.preview && Array.isArray(row.preview.cells) && row.preview.cells.length) {
      return row.preview;
    }
    if (api && typeof api.previewFromWorld === 'function') {
      return api.previewFromWorld(row.world);
    }
    if (!row.world) return null;
    return {
      gridSize: row.world.gridSize || 8,
      cells: Array.isArray(row.world.cells) ? row.world.cells : [],
    };
  }

  function thumbnailFromRow(row) {
    if (!row) return '';
    if (row.thumbnailUrl) return row.thumbnailUrl;
    const api = TC();
    if (api && typeof api.ensureThumbnail === 'function') {
      return api.ensureThumbnail(row) || '';
    }
    return '';
  }

  function islandPreviewMarkup(row) {
    const thumb = thumbnailFromRow(row);
    if (thumb) {
      return '<img class="tv-island-thumb" src="' + esc(thumb) + '" alt="" loading="lazy" decoding="async">';
    }
    return '<canvas class="tv-island-preview" data-collectible-id="' + esc(row.id) + '" width="280" height="175" aria-hidden="true"></canvas>';
  }

  function randomPick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function weightedRarity() {
    const total = ACTIVITY_RARITY_WEIGHTS.reduce((sum, row) => sum + row[1], 0);
    let roll = Math.random() * total;
    for (const row of ACTIVITY_RARITY_WEIGHTS) {
      roll -= row[1];
      if (roll <= 0) return row[0];
    }
    return 'Common';
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function formatAgo(ts) {
    const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (sec < 12) return 'just now';
    if (sec < 60) return sec + 's ago';
    const min = Math.floor(sec / 60);
    if (min < 60) return min + 'm ago';
    const hr = Math.floor(min / 60);
    return hr + 'h ago';
  }

  function createActivityEvent(offsetSec) {
    const player = randomPick(ACTIVITY_PLAYERS);
    const island = randomPick(ACTIVITY_ISLANDS);
    const rarity = weightedRarity();
    const verbs = [
      'opened a free pack and pulled',
      'revealed',
      'unboxed',
      'cracked a pack for',
    ];
    activitySeq += 1;
    return {
      id: 'act-' + activitySeq,
      player,
      island: island.name,
      rarity,
      verb: randomPick(verbs),
      ts: Date.now() - (offsetSec * 1000),
    };
  }

  function seedActivityEvents() {
    activityEvents = [
      createActivityEvent(8),
      createActivityEvent(24),
      createActivityEvent(41),
      createActivityEvent(63),
      createActivityEvent(88),
      createActivityEvent(112),
      createActivityEvent(146),
      createActivityEvent(181),
    ];
  }

  function pushActivityEvent() {
    activityEvents.unshift(createActivityEvent(0));
    if (activityEvents.length > ACTIVITY_MAX) activityEvents.length = ACTIVITY_MAX;
  }

  function rarityClass(rarity) {
    const key = String(rarity || '').toLowerCase();
    if (key === 'legendary') return 'is-legendary';
    if (key === 'epic') return 'is-epic';
    if (key === 'rare') return 'is-rare';
    return '';
  }

  function activityItemHtml(evt) {
    return (
      '<li class="tv-activity-item ' + rarityClass(evt.rarity) + '" data-activity-id="' + esc(evt.id) + '">' +
        '<span class="tv-activity-avatar" aria-hidden="true">' + esc(initials(evt.player)) + '</span>' +
        '<div class="tv-activity-body">' +
          '<strong>' + esc(evt.player) + '</strong>' +
          '<p>' + esc(evt.verb) + ' <em>' + esc(evt.island) + '</em></p>' +
          '<span class="tv-activity-meta">' + esc(evt.rarity) + ' · ' + esc(formatAgo(evt.ts)) + '</span>' +
        '</div>' +
      '</li>'
    );
  }

  function createActivityItem(evt) {
    const wrap = document.createElement('div');
    wrap.innerHTML = activityItemHtml(evt);
    return wrap.firstElementChild;
  }

  function flipActivityPush(list, movedItems) {
    if (!list || !movedItems.length) return;
    const firstRects = movedItems.map(el => el.getBoundingClientRect());
    movedItems.forEach((el, i) => {
      const nextRect = el.getBoundingClientRect();
      const dy = firstRects[i].top - nextRect.top;
      if (!dy) return;
      el.classList.add('is-shifting');
      el.style.transform = 'translateY(' + dy + 'px)';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transform = '';
        });
      });
      const onEnd = () => {
        el.classList.remove('is-shifting');
        el.removeEventListener('transitionend', onEnd);
      };
      el.addEventListener('transitionend', onEnd);
    });
  }

  function removeActivityItem(item) {
    if (!item || !item.parentNode) return;
    item.classList.add('is-exiting');
    const remove = (e) => {
      if (e.animationName !== 'tv-activity-exit') return;
      item.removeEventListener('animationend', remove);
      if (item.parentNode) item.parentNode.removeChild(item);
    };
    item.addEventListener('animationend', remove);
  }

  function prependActivityItem(evt) {
    if (!root) return;
    const list = root.querySelector('#tvActivityList');
    if (!list) return;
    const movedItems = Array.from(list.children);
    const item = createActivityItem(evt);
    item.classList.add('is-entering');
    list.insertBefore(item, list.firstChild);
    flipActivityPush(list, movedItems);
    item.addEventListener('animationend', (e) => {
      if (e.animationName !== 'tv-activity-enter') return;
      item.classList.remove('is-entering');
    });
    while (list.children.length > ACTIVITY_MAX) {
      removeActivityItem(list.lastElementChild);
    }
  }

  function activityPanelHtml() {
    return (
      '<aside class="tv-hub-activity" aria-label="Recent pack openings">' +
        '<div class="tv-activity-card">' +
          '<div class="tv-activity-head">' +
            '<h2>Live opens</h2>' +
            '<span class="tv-activity-live">Live</span>' +
          '</div>' +
          '<p class="tv-activity-sub">Simulated activity for tonight\'s preview — real multiplayer opens land later.</p>' +
          '<ul class="tv-activity-list" id="tvActivityList">' +
            activityEvents.map(activityItemHtml).join('') +
          '</ul>' +
        '</div>' +
      '</aside>'
    );
  }

  function renderActivityList() {
    if (!root) return;
    const list = root.querySelector('#tvActivityList');
    if (!list) return;
    list.replaceChildren(...activityEvents.map(evt => createActivityItem(evt)));
  }

  function refreshActivityAges() {
    if (!root) return;
    root.querySelectorAll('.tv-activity-item').forEach((item) => {
      const id = item.getAttribute('data-activity-id');
      const evt = activityEvents.find(row => row.id === id);
      if (!evt) return;
      const meta = item.querySelector('.tv-activity-meta');
      if (meta) meta.textContent = evt.rarity + ' · ' + formatAgo(evt.ts);
    });
  }

  function stopActivityTicker() {
    if (activityTicker) {
      clearInterval(activityTicker);
      activityTicker = null;
    }
    if (activityAgeTicker) {
      clearInterval(activityAgeTicker);
      activityAgeTicker = null;
    }
  }

  function startActivityTicker() {
    stopActivityTicker();
    activityTicker = setInterval(() => {
      if (!visible) return;
      pushActivityEvent();
      prependActivityItem(activityEvents[0]);
    }, 9000 + Math.floor(Math.random() * 5000));
    activityAgeTicker = setInterval(() => {
      if (!visible) return;
      refreshActivityAges();
    }, 15000);
  }

  function rarityLabel(row) {
    const api = TC();
    if (api && typeof api.rawYieldLabel === 'function') {
      return api.rawYieldLabel(row);
    }
    const rarity = row.profile && row.profile.economy && row.profile.economy.rarity
      ? row.profile.economy.rarity
      : (row.card && row.card.rarity) || 'Common';
    return rarity;
  }

  function collectionGridHtml() {
    const rows = islandRows();
    if (!rows.length) {
      return '<p class="tv-collection-empty">No islands yet. Open a free pack to reveal your first collectible island.</p>';
    }
    return (
      '<div class="tv-collection-grid">' +
      rows.map(row => (
        '<article class="tv-island-card" data-collectible-id="' + esc(row.id) + '">' +
          '<div class="tv-island-preview-wrap" data-collectible-id="' + esc(row.id) + '">' +
            islandPreviewMarkup(row) +
          '</div>' +
          '<div class="tv-island-card-head">' +
            '<strong>' + esc(row.name || 'Island') + '</strong>' +
            '<span>' + esc(rarityLabel(row)) + '</span>' +
          '</div>' +
          '<button type="button" class="tv-cta tv-cta-sm" data-action="visit-island" data-collectible-id="' + esc(row.id) + '">Visit island</button>' +
        '</article>'
      )).join('') +
      '</div>'
    );
  }

  function featuredPackHtml(pack) {
    const opensLeft = canOpenPack();
    return (
      '<article class="tv-pack-hero" style="--pack-accent:' + esc(pack.accent) + ';--pack-rim:' + esc(pack.rim) + '">' +
        '<div class="tv-pack-visual">' +
          '<div class="tv-pack-art-wrap">' +
            '<img class="tv-pack-art" src="' + esc(PACK_ART_URL) + '" alt="" width="280" height="360" decoding="async">' +
            '<span class="tv-pack-title tv-pack-title-top" aria-hidden="true">?</span>' +
            '<span class="tv-pack-title tv-pack-title-mid" aria-hidden="true">?</span>' +
          '</div>' +
          '<span class="tv-pack-badge">' + esc(pack.badge) + '</span>' +
          '<span class="tv-pack-cards-label">' + esc(pack.cardsLabel) + '</span>' +
        '</div>' +
        '<div class="tv-pack-copy">' +
          '<p class="tv-eyebrow">Tonight\'s preview</p>' +
          '<h3>' + esc(pack.name) + '</h3>' +
          '<p class="tv-pack-sub">' + esc(pack.subtitle) + '</p>' +
          '<p class="tv-pack-desc">' + esc(pack.description) + '</p>' +
          '<div class="tv-pack-foot">' +
            '<span class="tv-free-opens" id="tvHubFreeOpens">' + esc(freeOpensLabel()) + '</span>' +
            '<button type="button" class="tv-cta' + (opensLeft ? '' : ' is-disabled') + '" data-action="open-pack" data-pack-id="' + esc(pack.id) + '"' + (opensLeft ? '' : ' disabled') + '>' +
              (opensLeft ? 'Open free pack' : 'No packs left') +
            '</button>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function shellHtml() {
    const catalog = window.TinyverseStoreCatalog;
    if (!catalog) return '<div class="tv-hub-empty">Store unavailable.</div>';
    const featured = catalog.getFeaturedPack();
    const islands = islandRows().length;

    return (
      '<div class="tv-hub-shell">' +
        '<div class="tv-hub-pills">' +
          '<span class="tv-pill" id="tvHubFreeOpensPill">' + esc(freeOpensLabel()) + '</span>' +
          '<span class="tv-pill tv-pill-collection">' + islands + ' island' + (islands === 1 ? '' : 's') + '</span>' +
        '</div>' +
        '<div class="tv-hub-layout">' +
          '<div class="tv-hub-main">' +
            '<div class="tv-hub-card">' +
              '<div class="tv-section-head">' +
                '<h1>Tinyverse</h1>' +
                '<p>Three free island packs per account tonight. Each pack adds one island to your collection below.</p>' +
              '</div>' +
              featuredPackHtml(featured) +
              '<section class="tv-collection-section">' +
                '<div class="tv-section-head">' +
                  '<h2>Your islands</h2>' +
                  '<p>Tap visit to explore any collectible island in play mode.</p>' +
                '</div>' +
                collectionGridHtml() +
              '</section>' +
            '</div>' +
          '</div>' +
          activityPanelHtml() +
        '</div>' +
        '<div class="tv-toast" id="tvHubToast" role="status" aria-live="polite"></div>' +
      '</div>'
    );
  }

  function renderHubPreviews(allowBackfillRepaint) {
    if (!root) return;
    const api = TC();
    let needsRepaint = false;
    islandRows().forEach(row => {
      if (!row || row.thumbnailUrl) return;
      if (api && typeof api.ensureThumbnail === 'function' && api.ensureThumbnail(row)) {
        needsRepaint = true;
      }
    });
    if (needsRepaint && allowBackfillRepaint !== false) {
      root.innerHTML = shellHtml();
      bindClicks();
      renderHubPreviews(false);
      return;
    }
    if (!window.TinyWorldPreview || typeof window.TinyWorldPreview.renderPreview !== 'function') {
      return;
    }
    const byId = new Map(islandRows().map(row => [row.id, row]));
    root.querySelectorAll('canvas.tv-island-preview[data-collectible-id]').forEach(cnv => {
      const id = cnv.getAttribute('data-collectible-id');
      const row = id ? byId.get(id) : null;
      const preview = previewFromRow(row);
      if (!preview || !preview.cells || !preview.cells.length) return;
      try {
        window.TinyWorldPreview.renderPreview(cnv, preview);
      } catch (_) {}
    });
  }

  function showToast(msg) {
    if (!root) return;
    const node = root.querySelector('#tvHubToast');
    if (!node) return;
    node.textContent = msg || '';
    node.classList.toggle('show', !!msg);
    if (msg) {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        node.classList.remove('show');
        node.textContent = '';
      }, 2800);
    }
  }

  function paint() {
    if (!root) return;
    root.innerHTML = shellHtml();
    bindClicks();
    renderHubPreviews();
  }

  function bindClicks() {
    if (!root) return;
    root.querySelectorAll('[data-action="open-pack"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-pack-id');
        const catalog = window.TinyverseStoreCatalog;
        const pack = catalog && typeof catalog.getPack === 'function' ? catalog.getPack(id) : null;
        if (!pack) return;
        if (!canOpenPack()) {
          showToast('You\'ve used all 3 free packs for tonight');
          return;
        }
        if (handlers.onOpenPack) handlers.onOpenPack(pack);
      });
    });
    root.querySelectorAll('[data-action="visit-island"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-collectible-id');
        const api = TC();
        if (!api || !id || typeof api.handoffToBuilder !== 'function') return;
        api.handoffToBuilder(id);
      });
    });
    root.querySelectorAll('.tv-island-preview-wrap').forEach(wrap => {
      wrap.addEventListener('click', () => {
        const card = wrap.closest('[data-collectible-id]');
        const id = card && card.getAttribute('data-collectible-id');
        const api = TC();
        if (!api || !id || typeof api.handoffToBuilder !== 'function') return;
        api.handoffToBuilder(id);
      });
    });
  }

  function ensureRoot() {
    if (root) return root;
    root = document.getElementById(ROOT_ID);
    return root;
  }

  function show(opts) {
    handlers = opts || {};
    const node = ensureRoot();
    if (!node) return;
    if (!activityEvents.length) seedActivityEvents();
    visible = true;
    node.hidden = false;
    node.classList.add('show');
    document.body.classList.add('tinyverse-hub-active');
    document.body.classList.remove('tinyverse-theater-active');
    document.body.style.background = '';
    paint();
    startActivityTicker();
  }

  function hide() {
    const node = ensureRoot();
    if (!node) return;
    visible = false;
    stopActivityTicker();
    node.hidden = true;
    node.classList.remove('show');
    document.body.classList.remove('tinyverse-hub-active');
  }

  function refresh() {
    if (!visible) return;
    paint();
  }

  window.TinyverseStoreHub = {
    show,
    hide,
    refresh,
    isVisible: () => visible,
    renderHubPreviews,
    previewFromRow,
  };
})();
