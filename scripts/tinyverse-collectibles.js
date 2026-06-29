// -------- tinyverse collectibles (local preview economy) --------
// Shared between card_reveal.html and tiny-world-builder.html.
// Persists immutable island snapshots + preview GOLD balance in localStorage.
(function () {
  'use strict';

  const COLLECTIBLES_KEY = 'tinyworld:collectibles.v1';
  const GOLD_KEY = 'tinyworld:tinyverse-gold.v1';
  const PENDING_KEY = 'tinyworld:collectible-pending';
  const FREE_PACKS_KEY = 'tinyworld:free-packs-opened.v1';
  const PACK_COST = 250;
  const STARTING_GOLD = 500;
  const FREE_PACK_LIMIT = 3;
  let freePackUserKey = '';

  const ISLAND_CARD_ACCENTS = {
    pastoral: ['#7fd34f', '#3a6b22', 'tree'],
    forest: ['#4fbf6a', '#2a6b3a', 'tree'],
    quarry: ['#9aa7b3', '#536276', 'mountain'],
    river: ['#4f9fe0', '#1f5a8a', 'wave'],
    village: ['#e0b454', '#8a6a1f', 'compass'],
    fortress: ['#a069e0', '#5a2f8a', 'shield'],
    ruins: ['#b054e0', '#6a1f8a', 'orb'],
    harbor: ['#4fc3f0', '#1f6a8a', 'floating'],
  };

  const ARTIFACT_POOL = [
    {
      id: 'compass-of-return',
      kind: 'artifact',
      name: 'Compass of Return',
      rarity: 'Epic',
      backIndex: 1,
      accent: '#4f9fe0',
      rim: '#1f5a8a',
      icon: 'compass',
      description: 'Reveals a hidden path tile and improves pack luck for the next opening.',
      tags: ['artifact', 'navigation'],
      stats: { Build: 6, Luck: 8, Charge: 5 },
    },
    {
      id: 'lantern-charm',
      kind: 'artifact',
      name: 'Lantern Charm',
      rarity: 'Rare',
      backIndex: 3,
      accent: '#e0b454',
      rim: '#8a6a1f',
      icon: 'orb',
      description: 'Soft lantern glow that boosts charm tiles on your next island visit.',
      tags: ['artifact', 'charm'],
      stats: { Charm: 7, Light: 6, Luck: 4 },
    },
    {
      id: 'stone-sigil',
      kind: 'artifact',
      name: 'Stone Sigil',
      rarity: 'Uncommon',
      backIndex: 2,
      accent: '#9aa7b3',
      rim: '#536276',
      icon: 'shield',
      description: 'A carved marker that stiffens defenses on material-rich shores.',
      tags: ['artifact', 'stone'],
      stats: { Defense: 7, Materials: 5, Build: 4 },
    },
  ];

  const STICKER_POOL = [
    {
      id: 'builder-badge',
      kind: 'sticker',
      name: 'Builder Badge',
      rarity: 'Uncommon',
      backIndex: 5,
      accent: '#e0b454',
      rim: '#8a6a1f',
      icon: 'sticker',
      description: 'A foil sticker for marking favorite builds and featured islands.',
      tags: ['sticker', 'foil'],
      stats: { Style: 9, Shine: 7 },
    },
    {
      id: 'island-star',
      kind: 'sticker',
      name: 'Island Star',
      rarity: 'Common',
      backIndex: 4,
      accent: '#7fd34f',
      rim: '#3a6b22',
      icon: 'star',
      description: 'Pin this star on islands you want to revisit in your collection.',
      tags: ['sticker', 'star'],
      stats: { Style: 8, Shine: 6 },
    },
  ];

  const BONUS_POOL = [
    {
      id: 'bonus-cache',
      kind: 'bonus',
      name: 'Bonus Item Cache',
      rarity: 'Bonus',
      backIndex: 7,
      accent: '#e06a3a',
      rim: '#8a3a1f',
      icon: 'chest',
      description: 'Contains extra placement tokens and one premium terrain swatch.',
      tags: ['bonus', 'items'],
      reward: 'Terrain Swatch',
      quantity: 3,
      stats: { Items: 3, Boost: 2 },
      goldGrant: 0,
    },
    {
      id: 'gold-pouch',
      kind: 'bonus',
      name: 'Gold Pouch',
      rarity: 'Bonus',
      backIndex: 6,
      accent: '#e0a93a',
      rim: '#8a6a1f',
      icon: 'chest',
      description: 'A small cache of preview GOLD for your next pack purchase.',
      tags: ['bonus', 'gold'],
      reward: 'Preview GOLD',
      quantity: 1,
      stats: { Gold: 8, Boost: 3 },
      goldGrant: 120,
    },
  ];

  function hashSeed(value) {
    let h = 1779033703 ^ String(value).length;
    const str = String(value);
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function hash() {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function seededRandom(value) {
    let n = hashSeed(value)();
    return function random() {
      let t = (n += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(values, seed) {
    const rng = seededRandom(seed);
    return values[Math.floor(rng() * values.length)] || values[0];
  }

  function randomPackSeed() {
    return 'pack-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
  }

  function randomCollectibleId() {
    return 'col-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function getGold() {
    const stored = readJson(GOLD_KEY, null);
    if (stored === null || !Number.isFinite(Number(stored))) {
      writeJson(GOLD_KEY, STARTING_GOLD);
      return STARTING_GOLD;
    }
    return Math.max(0, Math.floor(Number(stored)));
  }

  function setGold(amount) {
    const next = Math.max(0, Math.floor(Number(amount) || 0));
    writeJson(GOLD_KEY, next);
    return next;
  }

  function addGold(amount) {
    return setGold(getGold() + Math.floor(Number(amount) || 0));
  }

  function spendGold(amount) {
    const cost = Math.floor(Number(amount) || 0);
    const balance = getGold();
    if (cost <= 0 || balance < cost) return false;
    setGold(balance - cost);
    return true;
  }

  function list() {
    const rows = readJson(COLLECTIBLES_KEY, []);
    return Array.isArray(rows) ? rows.slice() : [];
  }

  function get(id) {
    const key = String(id || '').trim();
    if (!key) return null;
    return list().find(row => row && row.id === key) || null;
  }

  function capturePreviewThumbnail(preview) {
    if (!preview) return '';
    try {
      const TP = typeof window !== 'undefined' ? window.TinyWorldPreview : null;
      if (!TP || typeof TP.captureThumbnail !== 'function') return '';
      return TP.captureThumbnail(preview) || '';
    } catch (_) {
      return '';
    }
  }

  function previewFromWorld(world) {
    if (!world) return null;
    return {
      gridSize: world.gridSize || 8,
      cells: Array.isArray(world.cells) ? world.cells : [],
    };
  }

  function ensureThumbnail(row) {
    if (!row || !row.id) return '';
    if (row.thumbnailUrl) return row.thumbnailUrl;
    const preview = row.preview || previewFromWorld(row.world);
    if (!preview || !preview.cells || !preview.cells.length) return '';
    const thumbnailUrl = capturePreviewThumbnail(preview);
    if (!thumbnailUrl) return '';
    const rows = list();
    const idx = rows.findIndex(entry => entry && entry.id === row.id);
    if (idx < 0) return thumbnailUrl;
    rows[idx] = Object.assign({}, rows[idx], { thumbnailUrl });
    writeJson(COLLECTIBLES_KEY, rows.slice(0, 200));
    return thumbnailUrl;
  }

  function save(record) {
    if (!record || !record.id || !record.world) return null;
    const rows = list();
    const idx = rows.findIndex(row => row && row.id === record.id);
    const frozen = Object.assign({}, record, {
      id: record.id,
      acquiredAt: record.acquiredAt || new Date().toISOString(),
      world: record.world,
      profile: record.profile || null,
    });
    if (idx >= 0) rows[idx] = frozen;
    else rows.unshift(frozen);
    writeJson(COLLECTIBLES_KEY, rows.slice(0, 200));
    return frozen;
  }

  function rawYieldToCardStats(rawYield) {
    const scores = rawYield && rawYield.scores ? rawYield.scores : {};
    const stats = {};
    [
      ['Raw Yield', scores.rawYield],
      ['Buildings', scores.buildings],
      ['Total Rank', scores.totalRank],
    ].forEach(([label, value]) => {
      const rounded = Math.max(0, Math.round(Number(value) || 0));
      if (rounded > 0) stats[label] = rounded;
    });
    return stats;
  }

  function rawYieldForRecord(record) {
    const row = record || {};
    const profile = row.profile || row;
    const world = row.world || null;
    const seed = row.seed || (profile && profile.seed) || '';
    const name = row.name || (profile && profile.name) || 'Island';
    const buildRawYield = window.__buildIslandRawYieldEconomy;
    if (typeof buildRawYield === 'function' && world && Array.isArray(world.cells)) {
      return buildRawYield(world, { seed, name });
    }
    return profile && profile.rawYield ? profile.rawYield : null;
  }

  function rawYieldLabel(record) {
    const rawYield = rawYieldForRecord(record);
    if (!rawYield || !rawYield.scores || !rawYield.rarity) return 'Raw Yield unavailable';
    const rarity = rawYield.rarity.label || 'Common';
    const score = Number(rawYield.scores.rawYield) || 0;
    return rarity + ' - Raw Yield ' + Math.max(0, Math.round(score));
  }

  function rawYieldCardTags(rawYield) {
    const tags = [];
    if (rawYield && rawYield.rarity && rawYield.rarity.label) tags.push(String(rawYield.rarity.label).toUpperCase());
    const leader = rawYield && rawYield.leader && rawYield.leader.label && rawYield.leader.label !== 'Raw Yield'
      ? String(rawYield.leader.label).toUpperCase()
      : '';
    if (leader) tags.push(leader);
    const score = rawYield && rawYield.scores ? Number(rawYield.scores.rawYield) : 0;
    if (Number.isFinite(score) && score > 0) tags.push('YIELD ' + Math.round(score));
    return tags.slice(0, 3);
  }

  function islandCardVisuals(seed) {
    const palettes = Object.values(ISLAND_CARD_ACCENTS);
    const palette = pick(palettes, String(seed || '') + '|island-card-visuals') || ISLAND_CARD_ACCENTS.pastoral;
    return {
      accent: palette[0],
      rim: palette[1],
      icon: palette[2],
    };
  }

  function generateIslandCard(seed, backIndex, packSeed) {
    const G = window.TinyWorldIslandGenerator;
    if (!G || typeof G.generate !== 'function' || typeof G.profile !== 'function') {
      return null;
    }
    const world = G.generate({ seed, gridSize: 8 });
    const profile = G.profile(world, { seed });
    const rawYield = rawYieldForRecord({ world, profile, seed, name: profile.name });
    const visuals = islandCardVisuals(seed);
    const rarity = rawYield && rawYield.rarity && rawYield.rarity.label || 'Common';
    const yieldLabel = rawYieldLabel({ world, profile, seed, name: profile.name });
    return {
      id: 'island-' + seed,
      kind: 'island',
      name: profile.name,
      displayName: profile.name,
      rarity,
      backIndex: Number.isFinite(backIndex) ? backIndex : 0,
      accent: visuals.accent,
      rim: visuals.rim,
      icon: visuals.icon,
      description: yieldLabel,
      tags: rawYieldCardTags(rawYield),
      stats: rawYieldToCardStats(rawYield),
      seed,
      world,
      profile,
      rawYield,
      preview: {
        gridSize: world.gridSize || 8,
        cells: Array.isArray(world.cells) ? world.cells : [],
      },
      packSeed,
      collectibleReady: true,
    };
  }

  function cloneStaticCard(card, packSeed) {
    return Object.assign({}, card, {
      packSeed,
      displayName: card.name,
    });
  }

  function setFreePackUser(email) {
    freePackUserKey = String(email || '').trim().toLowerCase();
  }

  function freePacksOpenedKey() {
    return freePackUserKey
      ? FREE_PACKS_KEY + ':' + freePackUserKey
      : FREE_PACKS_KEY;
  }

  function getFreePacksOpened() {
    const count = readJson(freePacksOpenedKey(), 0);
    return Math.max(0, Math.floor(Number(count) || 0));
  }

  function getFreePacksRemaining() {
    return Math.max(0, FREE_PACK_LIMIT - getFreePacksOpened());
  }

  function canOpenFreePack() {
    return getFreePacksRemaining() > 0;
  }

  function recordFreePackOpen() {
    const next = getFreePacksOpened() + 1;
    writeJson(freePacksOpenedKey(), next);
    return next;
  }

  function rollPack(packSeed) {
    const seed = String(packSeed || randomPackSeed());
    const cards = [];
    const islandSeed = seed + '|island|0';
    const island = generateIslandCard(islandSeed, 0, seed);
    if (island) cards.push(island);
    return {
      packSeed: seed,
      packTitle: 'Island Pack',
      packSubtitle: '1 procedural island',
      packLabel: '1 Island',
      cards,
      cost: 0,
      free: true,
    };
  }

  function saveIslandFromPackRoll(rolled) {
    if (!rolled || !Array.isArray(rolled.cards)) return null;
    const island = rolled.cards.find(card => card && card.kind === 'island');
    if (!island) return null;
    return saveIslandFromCard(island, { packSeed: rolled.packSeed });
  }

  function openPack(packDef) {
    if (!canOpenFreePack()) return null;
    recordFreePackOpen();
    const rolled = rollPack(randomPackSeed());
    if (packDef) {
      rolled.packId = packDef.id || '';
      rolled.packTitle = packDef.name || rolled.packTitle;
      rolled.packSubtitle = packDef.subtitle || rolled.packSubtitle;
      rolled.packLabel = packDef.cardsLabel || rolled.packLabel;
    }
    rolled.savedCollectible = saveIslandFromPackRoll(rolled);
    return rolled;
  }

  function buyPack(packDef) {
    return openPack(packDef);
  }

  function buyArtifact(artifact) {
    if (!artifact || !artifact.id) return { ok: false, reason: 'invalid' };
    const catalog = window.TinyverseStoreCatalog;
    if (catalog && typeof catalog.isOwned === 'function' && catalog.isOwned(artifact.id)) {
      return { ok: false, reason: 'owned' };
    }
    const cost = Math.floor(Number(artifact.cost) || 0);
    if (!spendGold(cost)) return { ok: false, reason: 'funds' };
    if (catalog && typeof catalog.markOwned === 'function') catalog.markOwned(artifact);
    return { ok: true, artifact };
  }

  function saveIslandFromCard(card, opts) {
    if (!card || card.kind !== 'island' || !card.world) return null;
    const existing = list().find(row => row && row.seed === card.seed && row.kind === 'island');
    if (existing) return existing;
    const id = randomCollectibleId();
    const preview = card.preview || previewFromWorld(card.world);
    const thumbnailUrl = capturePreviewThumbnail(preview);
    return save({
      id,
      kind: 'island',
      name: (card.profile && card.profile.name) || card.name,
      seed: card.seed,
      world: card.world,
      profile: card.profile || null,
      preview,
      thumbnailUrl: thumbnailUrl || '',
      card: {
        name: card.name,
        rarity: card.rarity,
        accent: card.accent,
        icon: card.icon,
      },
      packSeed: card.packSeed || (opts && opts.packSeed) || '',
      acquiredAt: new Date().toISOString(),
    });
  }

  function applyBonusGold(card) {
    if (!card || card.kind !== 'bonus') return 0;
    const grant = Math.floor(Number(card.goldGrant) || 0);
    if (grant > 0) addGold(grant);
    return grant;
  }

  function handoffToBuilder(collectibleId) {
    const id = String(collectibleId || '').trim();
    const rec = get(id);
    if (!rec || !rec.world) return false;
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({
        id,
        world: rec.world,
        profile: rec.profile || null,
      }));
    } catch (_) {}
    const path = '/tiny-world-builder.html';
    const url = path + '?collectible=' + encodeURIComponent(id);
    window.location.href = url;
    return true;
  }

  function consumePendingHandoff() {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      sessionStorage.removeItem(PENDING_KEY);
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.id || !parsed.world) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  window.TinyverseCollectibles = {
    COLLECTIBLES_KEY,
    GOLD_KEY,
    PENDING_KEY,
    FREE_PACKS_KEY,
    PACK_COST,
    STARTING_GOLD,
    FREE_PACK_LIMIT,
    setFreePackUser,
    getFreePacksOpened,
    getFreePacksRemaining,
    canOpenFreePack,
    getGold,
    setGold,
    addGold,
    spendGold,
    list,
    get,
    save,
    rollPack,
    openPack,
    buyPack,
    saveIslandFromPackRoll,
    buyArtifact,
    rawYieldToCardStats,
    rawYieldForRecord,
    rawYieldLabel,
    generateIslandCard,
    saveIslandFromCard,
    capturePreviewThumbnail,
    ensureThumbnail,
    previewFromWorld,
    applyBonusGold,
    handoffToBuilder,
    consumePendingHandoff,
    randomPackSeed,
  };
})();
