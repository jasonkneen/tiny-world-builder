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
const ANIMALS = ['cow', 'sheep'];
const ARTIFACT_KINDS = ['artifact', 'relic', 'crystal', 'totem', 'ruins'];
const WORLD_SELECTION_GATE_DEST = '__world-picker';
const RESOURCE_PRICE_WEIGHTS = { fish: 0.35, ore: 0.08, plants: 0.04, meat: 0.12 };

function roundUsdc(value) {
  return Math.round(Math.max(0, Number(value) || 0) * 1e6) / 1e6;
}

function resourcePrice(stats) {
  return roundUsdc(
    (stats.fish || 0) * RESOURCE_PRICE_WEIGHTS.fish
    + (stats.ore || 0) * RESOURCE_PRICE_WEIGHTS.ore
    + (stats.plants || 0) * RESOURCE_PRICE_WEIGHTS.plants
    + (stats.meat || 0) * RESOURCE_PRICE_WEIGHTS.meat
  );
}

function connectedWaterBodies(cells) {
  const water = new Set(cells.filter(c => c.terrain === 'water').map(c => c.x + ',' + c.z));
  const seen = new Set();
  let bodies = 0;
  for (const key of water) {
    if (seen.has(key)) continue;
    bodies++;
    const stack = [key];
    while (stack.length) {
      const k = stack.pop();
      if (seen.has(k) || !water.has(k)) continue;
      seen.add(k);
      const [x, z] = k.split(',').map(Number);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = (x + dx) + ',' + (z + dz);
        if (!seen.has(nk) && water.has(nk)) stack.push(nk);
      }
    }
  }
  return bodies;
}

// Supported home-board sizes (mirrors client HOME_GRID_OPTIONS / HOME_GRID_MAX,
// capped at 20x20). Seed authors may pick any nominal size; snap it UP to the
// nearest legal option so we never ship a world the renderer can't size faithfully
// (off-list 18/22 made the board, movement, and stargate diverge in-game).
const GRID_OPTIONS = [8, 10, 12, 16, 20];
function snapGrid(n) {
  const v = Math.max(1, Math.round(Number(n) || 0));
  for (const size of GRID_OPTIONS) if (size >= v) return size;
  return 20;
}

function buildRichWorld(a) {
  const g = snapGrid(a.grid);
  const rng = mulberry32(hashSeed(a.slug));
  const occupied = new Set();
  const cells = [];
  const gateX = Math.floor(g / 2);
  const gateZ = Math.floor(g / 2);
  occupied.add(gateX + ',' + gateZ);
  cells.push({ x: gateX, z: gateZ, terrain: 'grass', kind: 'stargate', dest: WORLD_SELECTION_GATE_DEST });

  // Big water bodies for fishing (rich)
  for (const size of a.water) {
    const cx = Math.floor(rng() * g), cz = Math.floor(rng() * g);
    for (const [x, z] of growBlob(occupied, g, cx, cz, size, rng)) {
      cells.push({ x, z, terrain: 'water' });
    }
  }

  // Substantial stone/ore clusters. We track stone cells so ore veins can be
  // seeded ON the rock (a textured ore mix) rather than floating on grass.
  const stoneCells = [];
  for (const size of a.stone) {
    const cx = Math.floor(rng() * g), cz = Math.floor(rng() * g);
    for (const [x, z] of growBlob(occupied, g, cx, cz, size, rng)) {
      cells.push({ x, z, terrain: 'stone' });
      stoneCells.push([x, z]);
    }
  }

  // Ore veins — a richer, textured ore mix embedded in the rock. We REPLACE a
  // fraction of plain stone tiles with mineral kinds (crystal/relic = the
  // ore-like recoverables) so every mining island reads as a varied deposit
  // instead of a flat grey blob. Count scales with how much stone the island has.
  const oreVeinCount = Math.round(stoneCells.length * (a.oreRichness != null ? a.oreRichness : 0.22));
  const ORE_KINDS = ['crystal', 'relic', 'crystal', 'artifact']; // crystal-weighted
  const oreSpots = [];
  for (let i = stoneCells.length - 1; i > 0; i--) { // Fisher–Yates (seeded) for spread
    const j = Math.floor(rng() * (i + 1));
    [stoneCells[i], stoneCells[j]] = [stoneCells[j], stoneCells[i]];
  }
  for (let i = 0; i < oreVeinCount && i < stoneCells.length; i++) {
    const [x, z] = stoneCells[i];
    // upgrade the existing stone cell in place to an ore-bearing tile
    const existing = cells.find(c => c.x === x && c.z === z && c.terrain === 'stone' && !c.kind);
    if (existing) {
      existing.kind = ORE_KINDS[Math.floor(rng() * ORE_KINDS.length)];
      oreSpots.push([x, z]);
    }
  }

  // Dense crops for gathering
  for (let i = 0; i < a.crops; i++) {
    const c = emptyGrassCell(occupied, g, rng); if (!c) break;
    cells.push({ x: c[0], z: c[1], terrain: 'grass', kind: PLANTS[Math.floor(rng() * PLANTS.length)] });
  }

  // Huntable animals are explicit so every world has visible hunting targets;
  // PartyKit also maintains transient animals at runtime for regrowth.
  const animalCount = Math.max(4, Math.round(a.animals || (g / 3)));
  for (let i = 0; i < animalCount; i++) {
    const c = emptyGrassCell(occupied, g, rng); if (!c) break;
    cells.push({ x: c[0], z: c[1], terrain: 'grass', kind: ANIMALS[i % ANIMALS.length] });
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
  const stats = {
    fish: connectedWaterBodies(cells),
    ore: stone,
    plants: cells.filter(c => PLANTS.includes(c.kind)).length,
    meat: cells.filter(c => ANIMALS.includes(c.kind)).length,
    oreVeins: cells.filter(c => c.terrain === 'stone' && ['crystal', 'relic', 'artifact'].includes(c.kind)).length,
  };
  const land = roundUsdc(tile * 0.01);
  const resources = resourcePrice(stats);

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
    resources,
    price: roundUsdc(land + resources),
    resourceStats: stats,
    data: { v: 4, gridSize: g, cells },
  };
}

// A big collection of rich, varied Tinyverse starter islands.
// All published and dense with resources + artifacts for immediate MMO play
// (harvest, GOLD, tax, interest testing).
// Early-preview reseed: deliberately denser + more textured than the prior seed.
// Stone is split into MORE, smaller clusters (varied veins read better than one
// grey blob), crops/artifacts bumped, and `oreRichness` sets the fraction of each
// island's stone that becomes an ore-bearing mineral tile (crystal/relic mix).
const ARCHETYPES = [
  // Fishing heavy + artifacts
  { slug: 'tidewater-bay', name: 'Tidewater Bay', grid: 20, water: [55, 28, 14], stone: [9, 6, 4], crops: 30, trees: 8, artifacts: 24, oreRichness: 0.30 },
  { slug: 'coral-reef', name: 'Coral Reef', grid: 18, water: [62, 19], stone: [7, 5, 3], crops: 20, trees: 7, artifacts: 20, oreRichness: 0.32 },
  { slug: 'salt-marsh', name: 'Salt Marsh', grid: 16, water: [48, 22], stone: [6, 4], crops: 24, trees: 9, artifacts: 21, oreRichness: 0.30 },

  // Mining / stone rich + crystal artifacts
  { slug: 'iron-ridge', name: 'Iron Ridge', grid: 18, water: [7], stone: [22, 16, 11, 7], crops: 16, trees: 6, artifacts: 27, oreRichness: 0.40 },
  { slug: 'crystal-canyon', name: 'Crystal Canyon', grid: 20, water: [9], stone: [24, 17, 12, 8], crops: 13, trees: 5, artifacts: 32, oreRichness: 0.45 },
  { slug: 'quarry-flats', name: 'Quarry Flats', grid: 16, water: [5], stone: [18, 13, 9, 6], crops: 15, trees: 4, artifacts: 19, oreRichness: 0.42 },

  // Farming / crop heavy
  { slug: 'green-pastures', name: 'Green Pastures', grid: 18, water: [8], stone: [7, 4], crops: 50, trees: 9, artifacts: 17, oreRichness: 0.25 },
  { slug: 'meadow-plots', name: 'Meadow Plots', grid: 16, water: [6], stone: [5, 3], crops: 44, trees: 11, artifacts: 20, oreRichness: 0.25 },
  { slug: 'sunflower-plains', name: 'Sunflower Plains', grid: 20, water: [11], stone: [6, 4], crops: 60, trees: 7, artifacts: 16, oreRichness: 0.25 },

  // Mixed rich
  { slug: 'mixed-hollow', name: 'Mixed Hollow', grid: 22, water: [35, 18, 9], stone: [16, 11, 7], crops: 34, trees: 12, artifacts: 26, oreRichness: 0.34 },
  { slug: 'echo-valley', name: 'Echo Valley', grid: 18, water: [21, 11], stone: [13, 9, 6], crops: 30, trees: 15, artifacts: 28, oreRichness: 0.34 },
  { slug: 'ember-isle', name: 'Ember Isle', grid: 16, water: [14], stone: [11, 7, 5], crops: 23, trees: 8, artifacts: 22, oreRichness: 0.36 },

  // Forest / balanced with relics
  { slug: 'forest-glade', name: 'Forest Glade', grid: 18, water: [10], stone: [7, 4], crops: 21, trees: 31, artifacts: 19, oreRichness: 0.28 },
  { slug: 'mosswood', name: 'Mosswood', grid: 20, water: [16, 7], stone: [9, 5], crops: 28, trees: 27, artifacts: 23, oreRichness: 0.28 },
  { slug: 'ancient-grove', name: 'Ancient Grove', grid: 18, water: [12], stone: [7, 4], crops: 19, trees: 29, artifacts: 29, oreRichness: 0.30 },

  // More variety (coastal, highland, etc.)
  { slug: 'storm-coast', name: 'Storm Coast', grid: 20, water: [48, 15], stone: [11, 7], crops: 24, trees: 10, artifacts: 21, oreRichness: 0.32 },
  { slug: 'highland-basin', name: 'Highland Basin', grid: 18, water: [13, 6], stone: [15, 10, 6], crops: 26, trees: 8, artifacts: 25, oreRichness: 0.38 },
  { slug: 'golden-strand', name: 'Golden Strand', grid: 16, water: [22, 9], stone: [6, 4], crops: 22, trees: 6, artifacts: 17, oreRichness: 0.28 },
  { slug: 'obsidian-shore', name: 'Obsidian Shore', grid: 18, water: [27, 8], stone: [13, 9, 5], crops: 17, trees: 5, artifacts: 27, oreRichness: 0.40 },
  { slug: 'fern-hollow', name: 'Fern Hollow', grid: 20, water: [18], stone: [9, 5], crops: 36, trees: 18, artifacts: 20, oreRichness: 0.28 },
  { slug: 'sable-ridge', name: 'Sable Ridge', grid: 16, water: [5], stone: [16, 11, 7], crops: 14, trees: 7, artifacts: 24, oreRichness: 0.40 },
  { slug: 'willow-bend', name: 'Willow Bend', grid: 18, water: [19, 10], stone: [6, 3], crops: 29, trees: 14, artifacts: 18, oreRichness: 0.26 },
  { slug: 'ember-falls', name: 'Ember Falls', grid: 20, water: [15, 7], stone: [11, 8, 5], crops: 21, trees: 9, artifacts: 26, oreRichness: 0.36 },
  { slug: 'jade-lagoon', name: 'Jade Lagoon', grid: 18, water: [41, 14], stone: [7, 4], crops: 24, trees: 8, artifacts: 22, oreRichness: 0.30 },
  { slug: 'thornfield', name: 'Thornfield', grid: 16, water: [4], stone: [8, 5], crops: 32, trees: 12, artifacts: 19, oreRichness: 0.30 },
  { slug: 'dawn-island', name: 'Dawn Island', grid: 20, water: [23, 9], stone: [11, 6], crops: 31, trees: 11, artifacts: 28, oreRichness: 0.32 },
  { slug: 'mist-veil', name: 'Mist Veil', grid: 18, water: [29, 12], stone: [6, 4], crops: 20, trees: 13, artifacts: 24, oreRichness: 0.30 },
  { slug: 'crimson-bay', name: 'Crimson Bay', grid: 16, water: [33, 8], stone: [9, 5], crops: 17, trees: 6, artifacts: 20, oreRichness: 0.34 },
  { slug: 'silver-glen', name: 'Silver Glen', grid: 20, water: [12], stone: [12, 8, 5], crops: 29, trees: 10, artifacts: 25, oreRichness: 0.38 },
];

function sqlString(obj) {
  return "'" + JSON.stringify(obj).replace(/'/g, "''") + "'";
}

function main() {
  const worlds = ARCHETYPES.map(buildRichWorld);
  const lines = [];
  lines.push('-- Rich default Tinyverse EARLY-PREVIEW islands for MMO play.');
  lines.push('-- GENERATED by tools/gen-seed-worlds.mjs — do not edit by hand.');
  lines.push('-- All are published starter islands, deliberately dense + textured with resources');
  lines.push('-- (water/fish, stone/ore VEINS, crops/plants) + many artifacts (relic/crystal/totem/ruins).');
  lines.push('-- Early-preview: FREE to enter (price_usdc=0), NOT listed for sale as paid templates.');
  lines.push('-- Players harvest + sell resources here to earn Earned GOLD (and the Prospector badge).');
  lines.push('');

  lines.push('-- Upsert starter islands without changing existing owner_profile_id.');
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
      0, // price_usdc — early-preview worlds are FREE to enter (no land sale)
      sqlString(w.data) + '::jsonb',
      'NOW()'
    ].join(', ') + ')');
    lines.push('ON CONFLICT (slug) DO UPDATE SET');
    lines.push('  kind = EXCLUDED.kind, status = EXCLUDED.status, name = EXCLUDED.name, tax_percent = EXCLUDED.tax_percent,');
    lines.push('  grid_size = EXCLUDED.grid_size, tile_count = EXCLUDED.tile_count,');
    lines.push('  stone_tile_count = EXCLUDED.stone_tile_count, grass_tile_count = EXCLUDED.grass_tile_count, water_tile_count = EXCLUDED.water_tile_count,');
    lines.push('  price_usdc = EXCLUDED.price_usdc, data = EXCLUDED.data,');
    lines.push('  published_at = COALESCE(worlds.published_at, EXCLUDED.published_at), updated_at = NOW();');
    lines.push('');
  }

  lines.push('WITH owner AS (');
  lines.push("  SELECT id FROM profiles WHERE LOWER(COALESCE(email, '')) IN ('jason@bouncingfish.com', 'jason.kneen@bouncingfish.com', 'jason.kneen@gmail.com')");
  lines.push("  ORDER BY CASE LOWER(COALESCE(email, '')) WHEN 'jason@bouncingfish.com' THEN 0 WHEN 'jason.kneen@gmail.com' THEN 1 ELSE 2 END");
  lines.push('  LIMIT 1');
  lines.push(')');
  lines.push('UPDATE worlds');
  lines.push('SET owner_profile_id = owner.id, updated_at = NOW()');
  lines.push('FROM owner');
  lines.push("WHERE worlds.kind = 'starter'");
  lines.push("  AND worlds.slug <> 'tinyverse-nexus'");
  lines.push('  AND worlds.owner_profile_id IS DISTINCT FROM owner.id;');
  lines.push('');

  // Early-preview: starter islands are NOT for sale. Clear any paid-template
  // listing + zero the land price so they read as free early-preview worlds.
  // Idempotent; guarded so it only touches starters that still carry a listing.
  lines.push('-- Drop the for-sale / paid-template aspect on all starter islands (early-preview = free).');
  lines.push('UPDATE worlds');
  lines.push('SET is_template = FALSE, template_price = NULL, template_author_id = NULL, price_usdc = 0, updated_at = NOW()');
  lines.push("WHERE kind = 'starter'");
  lines.push('  AND (is_template = TRUE OR template_price IS NOT NULL OR template_author_id IS NOT NULL OR price_usdc <> 0);');
  lines.push('');

  process.stdout.write(lines.join('\n'));

  const summary = worlds.map(w => `${w.slug}: ${w.grid}x${w.grid} fish=${w.resourceStats.fish} ore=${w.resourceStats.ore} crops=${w.resourceStats.plants} meat=${w.resourceStats.meat} price=${w.price} artifacts=${w.data.cells.filter(c=>c.kind&&c.kind.includes('artifact')||['relic','crystal','totem','ruins'].includes(c.kind)).length} [${w.status}]`).join('\n');
  process.stderr.write('\n' + summary + '\n');
}

main();
