import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const mockGenerator = {
  generate() {
    return { gridSize: 8, cells: [{ x: 0, z: 0, terrain: 'dirt', kind: 'wheat', floors: 1, terrainFloors: 1 }] };
  },
  profile() {
    return {
      name: 'Test Isle',
      rawYield: {
        aspect: 'raw_yield',
        label: 'Raw Yield',
        resources: {
          crops: { wheat: 1, corn: 0, carrot: 0, pumpkin: 0, sunflower: 0 },
          rockOre: { stone: 0, copper: 0, iron: 0, silver: 0, goldOre: 0 },
          animals: { sheep: 0, cow: 0 },
          nature: { trees: 0, berries: 0, water: 0, fish: 0 },
          buildings: { houses: 0, towers: 0, manor: 0 },
        },
        scores: { rawYield: 169, buildings: 0, totalRank: 169 },
        rarity: { id: 'common', label: 'Common', range: { min: 0, max: 169 } },
        leader: { id: 'crops', label: 'Crop-led' },
      },
      economy: { aspect: 'raw_yield', rarity: 'Common', rawYieldScore: 169, rarityScope: 'raw_yield' },
    };
  },
};

function loadCollectibles(storage, extras) {
  const store = new Map(Object.entries(storage || {}));
  const localStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
  };
  const context = {
    window: Object.assign({ TinyWorldIslandGenerator: mockGenerator }, extras || {}),
    localStorage,
    console,
  };
  context.window.window = context.window;
  const src = readFileSync(new URL('../scripts/tinyverse-collectibles.js', import.meta.url), 'utf8');
  vm.runInNewContext(src, context, { filename: 'tinyverse-collectibles.js' });
  return context.window.TinyverseCollectibles;
}

function createMemoryStorage(storage) {
  const store = new Map(Object.entries(storage || {}));
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
  };
}

function loadCollectiblesWithRealGenerator(storage) {
  const context = {
    console,
    localStorage: createMemoryStorage(storage),
    sessionStorage: createMemoryStorage({}),
  };
  context.window = context;
  for (const file of [
    '../scripts/random-island-economy-prelude.js',
    '../engine/world/26b-random-island-economy-profile.js',
    '../scripts/island-viewer-sequential-generator.js',
    '../scripts/tinyverse-collectibles.js',
  ]) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8');
    vm.runInNewContext(src, context, { filename: file });
  }
  return context.window.TinyverseCollectibles;
}

test('rollPack returns exactly one island card', () => {
  const TC = loadCollectibles({});
  const rolled = TC.rollPack('pack-test-seed');
  assert.equal(rolled.cards.length, 1);
  assert.equal(rolled.cards[0].kind, 'island');
  assert.equal(rolled.packLabel, '1 Island');
});

test('island pack cards show Raw Yield instead of gold per day', () => {
  const TC = loadCollectibles({});
  const rolled = TC.rollPack('pack-raw-yield');
  const card = rolled.cards[0];
  assert.equal(card.description, 'Common - Raw Yield 169');
  assert.doesNotMatch(card.description, /gold\/day/i);
  assert.doesNotMatch(card.description, /pastoral|explore/i);
  assert.equal(Object.prototype.hasOwnProperty.call(card, 'archetypeKey'), false);
  assert.equal(JSON.stringify(card.stats), JSON.stringify({ 'Raw Yield': 169, 'Total Rank': 169 }));
  assert.equal(JSON.stringify(card.tags), JSON.stringify(['COMMON', 'CROP-LED', 'YIELD 169']));
  assert.equal(TC.rawYieldLabel({ profile: card.profile, world: card.world, seed: card.seed }), 'Common - Raw Yield 169');
  assert.equal(TC.rawYieldLabel({}), 'Raw Yield unavailable');
});

test('island pack card stats do not expose zero score entries', () => {
  const TC = loadCollectibles({});
  assert.equal(JSON.stringify(TC.rawYieldToCardStats({
    scores: { rawYield: 12, buildings: 0, totalRank: 12 },
  })), JSON.stringify({ 'Raw Yield': 12, 'Total Rank': 12 }));
  assert.equal(JSON.stringify(TC.rawYieldToCardStats({
    scores: { rawYield: 0, buildings: 0, totalRank: 0 },
  })), JSON.stringify({}));
});

test('collectible visit resource card is compact and skips zero rows', () => {
  const boot = readFileSync(new URL('../engine/world/30-ui-boot-wiring.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles/tiny-world.css', import.meta.url), 'utf8');
  assert.match(boot, /function randomIslandPositiveResourceRows[\s\S]*filter\(row => row\.value > 0\);/);
  assert.match(boot, /\.filter\(\(\[, value\]\) => value > 0\)/);
  assert.match(boot, /scoreline\.hidden = !scoreline\.children\.length;/);
  assert.match(css, /\.new-world-reveal-stack \{[\s\S]*overflow: visible;/);
  assert.match(css, /\.new-world-reveal-resources \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});

test('card reveal plays a rarity-aware island reveal sting', () => {
  const html = readFileSync(new URL('../card_reveal.html', import.meta.url), 'utf8');
  const audio = readFileSync(new URL('../scripts/tinyverse-pack-audio.js', import.meta.url), 'utf8');
  assert.match(audio, /rising: \['music-rising-1\.mp3'\]/);
  assert.match(audio, /function islandReveal\(card\)/);
  assert.match(audio, /rarity === 'rare' \|\| rarity === 'epic' \|\| rarity === 'legendary'/);
  assert.match(audio, /islandReveal,/);
  assert.match(html, /typeof PA\.islandReveal === 'function'/);
  assert.match(html, /PA\.islandReveal\(revealCard\)/);
});

test('real card reveal preview roll has nonzero Raw Yield stats', () => {
  const TC = loadCollectiblesWithRealGenerator({});
  const rolled = TC.rollPack('card-reveal-preview-fish-1');
  assert.equal(rolled.cards.length, 1);
  const card = rolled.cards[0];
  assert.equal(card.name, 'Clover Crown');
  assert.equal(card.description, 'Uncommon - Raw Yield 179');
  assert.equal(card.stats['Raw Yield'], 179);
  assert.equal(card.rawYield.scores.rawYield, 179);
  assert.equal(card.stats.Buildings, 18);
  assert.equal(card.stats['Total Rank'], 197);
  assert.equal(JSON.stringify(card.rawYield.resources.crops), JSON.stringify({ wheat: 0, corn: 3, carrot: 1, pumpkin: 0, sunflower: 2 }));
  assert.equal(JSON.stringify(card.rawYield.resources.rockOre), JSON.stringify({ stone: 11, copper: 1, iron: 1, silver: 1, goldOre: 4 }));
  assert.equal(JSON.stringify(card.rawYield.resources.animals), JSON.stringify({ sheep: 4, cow: 0 }));
  assert.equal(JSON.stringify(card.rawYield.resources.nature), JSON.stringify({ trees: 7, berries: 10, water: 6, fish: 1 }));
  assert.equal(JSON.stringify(card.rawYield.resources.buildings), JSON.stringify({ houses: 1, towers: 1, manor: 0 }));
  assert.doesNotMatch(card.description, /Raw Yield 0|gold\/day|archetype/i);
});

test('openPack enforces three free opens per user email', () => {
  const TC = loadCollectibles({});
  TC.setFreePackUser('player@example.com');
  assert.equal(TC.getFreePacksRemaining(), 3);
  assert.ok(TC.openPack({ id: 'island-pack', name: 'Island Pack' }));
  assert.ok(TC.openPack({ id: 'island-pack', name: 'Island Pack' }));
  assert.ok(TC.openPack({ id: 'island-pack', name: 'Island Pack' }));
  assert.equal(TC.getFreePacksRemaining(), 0);
  assert.equal(TC.openPack({ id: 'island-pack', name: 'Island Pack' }), null);
});

test('free pack counter is scoped per email', () => {
  const TC = loadCollectibles({});
  TC.setFreePackUser('alice@example.com');
  assert.ok(TC.openPack());
  assert.equal(TC.getFreePacksRemaining(), 2);
  TC.setFreePackUser('bob@example.com');
  assert.equal(TC.getFreePacksRemaining(), 3);
});
