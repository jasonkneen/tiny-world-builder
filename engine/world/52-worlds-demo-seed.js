  // Tinyverse — demo resource seeder for local development.
  // When entering a world on localhost that has no harvestable cells, injects a
  // compact set of resource cells (water, stone, plant, animal) so foraging works
  // out-of-the-box without the owner having to manually add terrain.
  // Mutates world.data.cells BEFORE the WebSocket opens, so the augmented cells
  // are sent in world.join and the server derives nodes from them.
  // Guard: ONLY runs on localhost / 127.0.0.1. Never runs in production.
  (function wireWorldsDemoSeed() {
    'use strict';
    if (typeof location === 'undefined') return;
    if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const WS = (window.__tinyworldWorlds = window.__tinyworldWorlds || {});
    function on(ev, cb) { if (typeof WS.on === 'function') WS.on(ev, cb); }

    const PLANT_KINDS = new Set(['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower']);
    const ANIMAL_KINDS = new Set(['cow', 'sheep']);

    function hasResources(cells) {
      for (const c of (cells || [])) {
        const ter = Array.isArray(c) ? c[2] : c.terrain;
        const k = Array.isArray(c) ? c[3] : c.kind;
        if (ter === 'water' || ter === 'stone') return true;
        if (k && (PLANT_KINDS.has(k) || ANIMAL_KINDS.has(k))) return true;
      }
      return false;
    }

    function usedPositions(cells) {
      const used = new Set();
      for (const c of (cells || [])) {
        const x = Array.isArray(c) ? c[0] : c.x;
        const z = Array.isArray(c) ? c[1] : c.z;
        if (x != null && z != null) used.add(x + ',' + z);
      }
      return used;
    }

    // Place `count` cells of given terrain/kind in a corner area, skipping used cells.
    function placeInCorner(existing, g, ox, oz, dx, dz, terrain, kind, count) {
      const added = [];
      let placed = 0;
      for (let step = 0; step < g && placed < count; step++) {
        const x = ox + dx * step;
        const z = oz + dz * step;
        if (x < 0 || x >= g || z < 0 || z >= g) continue;
        if (!existing.has(x + ',' + z)) {
          added.push(kind ? [x, z, terrain, kind] : [x, z, terrain]);
          existing.add(x + ',' + z);
          placed++;
        }
      }
      return added;
    }

    // Build a small water body (3 cells in an L-shape) at given origin.
    function placeWater(existing, g, ox, oz) {
      const added = [];
      const candidates = [[ox, oz], [ox + 1, oz], [ox, oz + 1]];
      for (const [x, z] of candidates) {
        if (x < 0 || x >= g || z < 0 || z >= g) continue;
        if (!existing.has(x + ',' + z)) {
          added.push([x, z, 'water']);
          existing.add(x + ',' + z);
        }
      }
      return added;
    }

    function seedResources(world) {
      if (!world) return null;
      if (!world.data || typeof world.data !== 'object') world.data = { v: 4, gridSize: world.gridSize || 8, cells: [] };
      const data = world.data;
      if (!Array.isArray(data.cells)) data.cells = [];
      const cells = data.cells;
      if (hasResources(cells)) return null;

      const g = world.gridSize || 8;
      const used = usedPositions(cells);
      const added = [];

      // Water body in top-left corner (fish node).
      added.push(...placeWater(used, g, 0, 0));

      // Stone cells along the bottom edge (ore nodes).
      added.push(...placeInCorner(used, g, 0, g - 1, 1, 0, 'stone', null, 3));

      // Crop cells in the top-right corner (plant nodes).
      added.push(...placeInCorner(used, g, g - 1, 0, 0, 1, 'grass', 'crop', 2));
      added.push(...placeInCorner(used, g, g - 2, 0, 0, 1, 'grass', 'wheat', 1));

      // Animals near center-right (hunt node).
      const cx = Math.max(0, g - 3), cz = Math.floor(g / 2);
      const animalSpots = [[cx, cz], [cx + 1, cz]];
      const animalKinds = ['cow', 'sheep'];
      animalSpots.forEach(([x, z], i) => {
        if (x >= g || z >= g || used.has(x + ',' + z)) return;
        added.push([x, z, 'grass', animalKinds[i % animalKinds.length]]);
        used.add(x + ',' + z);
      });

      if (added.length > 0) {
        data.cells = [...cells, ...added];
        console.log('[demo-seed] Seeded', added.length, 'resource cells into world', world.slug);
      }
      return added;
    }

    WS.seedDemoResources = seedResources;

    on('enter', (d) => {
      const world = d && d.world;
      if (!world) return;
      seedResources(world);
    });
  })();
