#!/usr/bin/env node
// Generates the Worlds seed migration: a large collection of rich, playable
// Tinyverse starter islands.
//
//   node tools/gen-seed-worlds.mjs > netlify/database/migrations/20260620143000_rich_tinyverse_islands.sql
//
// All islands are published, owner-less "starter" islands for the Tinyverse MMO.
// They are intentionally dense with:
//   - Large connected water bodies (fish)
//   - Substantial stone clusters (ore)
//   - High crop density (plants/gather)
//   - 8–25+ artifacts per island (relics, crystals, totems, ruins)
//
// Artifacts use kind: 'artifact' (or subtypes) and are placed on grass/stone.
// This gives immediate rich harvesting, GOLD accrual, and artifact recovery
// loops for testing and default Tinyverse population.
//
// Deterministic via per-world seeds.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function growBlob(occupied, g, cx, cz, count, rng) {
  const out = [];
  const key = (x, z) => x + ',' + z;
  const frontier = [[cx, cz]];
  while (out.length < count && frontier.length) {
    const i = Math.floor(rng() * frontier.length);
    const [x, z] = frontier.splice(i, 1)[0];
    if (x < 0 || z < 0 || x >= g || z >= g || occupied.has(key(x, z))) continue;
    occupied.add(key(x, z));
    out.push([x, z]);
    const nbrs = [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]];
    for (const n of nbrs) if (rng() < 0.65) frontier.push(n);
  }
  return out;
}

function emptyGrassCell(occupied, g, rng) {
  for (let tries = 0; tries < 60; tries++) {
    const x = Math.floor(rng() * g), z = Math.floor(rng() * g);
    if (!occupied.has(x + ',' + z)) { occupied.add(x + ',' + z); return [x, z]; }
  }
  return null;
}

const PLANTS = ['corn', 'wheat', 'carrot', 'sunflower', 'pumpkin'];
const ARTIFACT_KINDS = ['artifact', 'relic', 'crystal', 'totem', 'ruins'];

function buildRichWorld(a) {
  const g = a.grid;
  const rng = mulberry32(hashSeed(a.slug));
  const occupied = new Set();
  const cells = [];

  // The Nexus is a pure through-port: a clean grass platform with ONLY
  // stargates to every other island. No water/stone/crops/trees/artifacts.
  if (a.isHub) {
    const dests = ARCHETYPES.filter(x => !x.isHub).map(x => x.slug);
    const cols = [3, 8, 11, 16];
    const rows = [1, 4, 7, 10, 13, 16, 19];
    let i = 0;
    for (const z of rows) {
      for (const x of cols) {
        if (i >= dests.length) break;
        cells.push({ x, z, terrain: 'grass', kind: 'stargate', dest: dests[i] });
        i++;
      }
    }
    const tile = g * g;
    return {
      slug: a.slug, name: a.name, status: 'published', kind: 'starter',
      grid: g, tile, stone: 0, grass: tile, water: 0, price: 0,
      data: { v: 4, gridSize: g, cells },
    };
  }

  // Big water bodies for fishing (rich)
  for (const size of a.water) {
    const cx = Math.floor(rng() * g), cz = Math.floor(rng() * g);
    for (const [x, z] of growBlob(occupied, g, cx, cz, size, rng)) {
      cells.push({ x, z, terrain: 'water' });
    }
  }

  // Substantial stone/ore clusters
  for (const size of a.stone) {
    const cx = Math.floor(rng() * g), cz = Math.floor(rng() * g);
    for (const [x, z] of growBlob(occupied, g, cx, cz, size, rng)) {
      cells.push({ x, z, terrain: 'stone' });
    }
  }

  // Dense crops for gathering
  for (let i = 0; i < a.crops; i++) {
    const c = emptyGrassCell(occupied, g, rng); if (!c) break;
    cells.push({ x: c[0], z: c[1], terrain: 'grass', kind: PLANTS[Math.floor(rng() * PLANTS.length)] });
  }

  // Some decorative trees
  for (let i = 0; i < a.trees; i++) {
    const c = emptyGrassCell(occupied, g, rng); if (!c) break;
    cells.push({ x: c[0], z: c[1], terrain: 'grass', kind: 'tree' });
  }

  // Rich artifacts scattered (the new "artikrfacts")
  for (let i = 0; i < a.artifacts; i++) {
    const c = emptyGrassCell(occupied, g, rng); if (!c) break;
    const kind = ARTIFACT_KINDS[Math.floor(rng() * ARTIFACT_KINDS.length)];
    const terrain = rng() < 0.25 ? "stone" : "grass";
    cells.push({ x: c[0], z: c[1], terrain, kind });
  }

  // Valheim-style small survivor settlements on richer islands
  if (a.artifacts > 14) {
    for (let s = 0; s < 2; s++) {
      const camp = emptyGrassCell(occupied, g, rng);
      if (camp) cells.push({ x: camp[0], z: camp[1], terrain: "grass", kind: "house" });
    }
    if (a.artifacts > 18) {
      const dock = emptyGrassCell(occupied, g, rng);
      if (dock) cells.push({ x: dock[0], z: dock[1], terrain: "grass", kind: "fence" });
    }
  }

  const water = cells.filter(c => c.terrain === 'water').length;
  const stone = cells.filter(c => c.terrain === 'stone').length;
  const tile = g * g;
  const grass = tile - water - stone;

  return {
    slug: a.slug,
    name: a.name,
    status: 'published',
    kind: 'starter',
    grid: g,
    tile,
    stone,
    grass,
    water,
    price: 0,
    data: { v: 4, gridSize: g, cells },
  };
}

// A big collection of rich, varied Tinyverse starter islands.
// All published and dense with resources + artifacts for immediate MMO play
// (harvest, GOLD, tax, interest testing).
const ARCHETYPES = [
  { slug: "tinyverse-nexus", name: "Tinyverse Nexus (Hub)", grid: 20, water: [], stone: [], crops: 0, trees: 0, artifacts: 0, isHub: true },
  // Fishing heavy + artifacts
  { slug: 'tidewater-bay', name: 'Tidewater Bay', grid: 20, water: [55, 28, 14], stone: [6], crops: 22, trees: 8, artifacts: 18 },
  { slug: 'coral-reef', name: 'Coral Reef', grid: 18, water: [62, 19], stone: [5], crops: 14, trees: 7, artifacts: 14 },
  { slug: 'salt-marsh', name: 'Salt Marsh', grid: 16, water: [48, 22], stone: [4], crops: 19, trees: 9, artifacts: 16 },

  // Mining / stone rich + crystal artifacts
  { slug: 'iron-ridge', name: 'Iron Ridge', grid: 18, water: [7], stone: [28, 19, 11], crops: 11, trees: 6, artifacts: 21 },
  { slug: 'crystal-canyon', name: 'Crystal Canyon', grid: 20, water: [9], stone: [31, 17, 9], crops: 8, trees: 5, artifacts: 25 },
  { slug: 'quarry-flats', name: 'Quarry Flats', grid: 16, water: [5], stone: [24, 15, 8], crops: 10, trees: 4, artifacts: 13 },

  // Farming / crop heavy
  { slug: 'green-pastures', name: 'Green Pastures', grid: 18, water: [8], stone: [5], crops: 42, trees: 9, artifacts: 12 },
  { slug: 'meadow-plots', name: 'Meadow Plots', grid: 16, water: [6], stone: [3], crops: 38, trees: 11, artifacts: 15 },
  { slug: 'sunflower-plains', name: 'Sunflower Plains', grid: 20, water: [11], stone: [4], crops: 51, trees: 7, artifacts: 11 },

  // Mixed rich
  { slug: 'mixed-hollow', name: 'Mixed Hollow', grid: 22, water: [35, 18, 9], stone: [18, 11], crops: 27, trees: 12, artifacts: 19 },
  { slug: 'echo-valley', name: 'Echo Valley', grid: 18, water: [21, 11], stone: [14, 9], crops: 24, trees: 15, artifacts: 22 },
  { slug: 'ember-isle', name: 'Ember Isle', grid: 16, water: [14], stone: [12, 7], crops: 18, trees: 8, artifacts: 17 },

  // Forest / balanced with relics
  { slug: 'forest-glade', name: 'Forest Glade', grid: 18, water: [10], stone: [6], crops: 15, trees: 31, artifacts: 14 },
  { slug: 'mosswood', name: 'Mosswood', grid: 20, water: [16, 7], stone: [8], crops: 21, trees: 27, artifacts: 18 },
  { slug: 'ancient-grove', name: 'Ancient Grove', grid: 18, water: [12], stone: [5], crops: 13, trees: 29, artifacts: 23 },

  // More variety (coastal, highland, etc.)
  { slug: 'storm-coast', name: 'Storm Coast', grid: 20, water: [48, 15], stone: [9], crops: 17, trees: 10, artifacts: 16 },
  { slug: 'highland-basin', name: 'Highland Basin', grid: 18, water: [13, 6], stone: [17, 10], crops: 20, trees: 8, artifacts: 19 },
  { slug: 'golden-strand', name: 'Golden Strand', grid: 16, water: [22, 9], stone: [4], crops: 16, trees: 6, artifacts: 12 },
  { slug: 'obsidian-shore', name: 'Obsidian Shore', grid: 18, water: [27, 8], stone: [15], crops: 12, trees: 5, artifacts: 21 },
  { slug: 'fern-hollow', name: 'Fern Hollow', grid: 20, water: [18], stone: [7], crops: 29, trees: 18, artifacts: 15 },
  { slug: 'sable-ridge', name: 'Sable Ridge', grid: 16, water: [5], stone: [21, 12], crops: 9, trees: 7, artifacts: 18 },
  { slug: 'willow-bend', name: 'Willow Bend', grid: 18, water: [19, 10], stone: [3], crops: 23, trees: 14, artifacts: 13 },
  { slug: 'ember-falls', name: 'Ember Falls', grid: 20, water: [15, 7], stone: [11, 8], crops: 15, trees: 9, artifacts: 20 },
  { slug: 'jade-lagoon', name: 'Jade Lagoon', grid: 18, water: [41, 14], stone: [5], crops: 18, trees: 8, artifacts: 17 },
  { slug: 'thornfield', name: 'Thornfield', grid: 16, water: [4], stone: [6], crops: 27, trees: 12, artifacts: 14 },
  { slug: 'dawn-island', name: 'Dawn Island', grid: 20, water: [23, 9], stone: [8], crops: 25, trees: 11, artifacts: 22 },
  { slug: 'mist-veil', name: 'Mist Veil', grid: 18, water: [29, 12], stone: [4], crops: 14, trees: 13, artifacts: 19 },
  { slug: 'crimson-bay', name: 'Crimson Bay', grid: 16, water: [33, 8], stone: [7], crops: 11, trees: 6, artifacts: 15 },
  { slug: 'silver-glen', name: 'Silver Glen', grid: 20, water: [12], stone: [13, 6], crops: 22, trees: 10, artifacts: 18 },
];

function sqlString(obj) {
  return "'" + JSON.stringify(obj).replace(/'/g, "''") + "'";
}

function main() {
  const worlds = ARCHETYPES.map(buildRichWorld);
  const lines = [];
  lines.push('-- Rich default Tinyverse islands for MMO play.');
  lines.push('-- GENERATED by tools/gen-seed-worlds.mjs — do not edit by hand.');
  lines.push('-- All are published starter islands, deliberately dense with resources');
  lines.push('-- (water/fish, stone/ore, crops/plants) + many artifacts (relic/crystal/totem/ruins).');
  lines.push('-- Perfect for testing harvest, GOLD, tax, interest, and artifact recovery.');
  lines.push('');

  lines.push('-- Remove previous seed islands (owner-less starters).');
  lines.push("DELETE FROM worlds WHERE owner_profile_id IS NULL AND kind = 'starter';");
  lines.push('');

  for (const w of worlds) {
    lines.push('INSERT INTO worlds (slug, kind, status, name, tax_percent, grid_size, tile_count,');
    lines.push('                    stone_tile_count, grass_tile_count, water_tile_count, price_usdc, data, published_at)');
    lines.push('VALUES (' + [
      "'" + w.slug + "'",
      "'" + w.kind + "'",
      "'" + w.status + "'",
      "'" + w.name.replace(/'/g, "''") + "'",
      10,
      w.grid,
      w.tile,
      w.stone,
      w.grass,
      w.water,
      w.price,
      sqlString(w.data) + '::jsonb',
      'NOW()'
    ].join(', ') + ')');
    lines.push('ON CONFLICT (slug) DO NOTHING;');
    lines.push('');
  }

  process.stdout.write(lines.join('\n'));

  const summary = worlds.map(w => `${w.slug}: ${w.grid}x${w.grid} fish≈${w.water} ore≈${w.stone} crops≈${w.grass} artifacts≈${w.data.cells.filter(c=>c.kind&&c.kind.includes('artifact')||['relic','crystal','totem','ruins'].includes(c.kind)).length} [${w.status}]`).join('\n');
  process.stderr.write('\n' + summary + '\n');
}

main();