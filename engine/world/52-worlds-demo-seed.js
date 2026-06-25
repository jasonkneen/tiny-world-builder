  // Tinyverse — demo world seeder for local development.
  // When entering a world on localhost that has no harvestable cells, lays out a
  // RICH scene so the demo feels alive out of the box: clustered voxel-stamp trees
  // (oak grove / pine cluster / cherry), bushes and flowers as undergrowth, a piled
  // rock highland on raised terrain, a low water pond beside it, a crop patch, and a
  // central meadow of grazing animals (which amble + swing their legs via 70-animal-anim).
  // Harvest still works: water = fish, stone = ore, crops = plants, animals = hunt.
  //
  // Layout keeps all BLOCKING props (trees/rocks/voxel-builds) in the four corners and
  // off the central cross, so the cells the player emerges onto from the selection gate
  // (see 47's settleAfterGateArrival) stay walkable.
  //
  // Mutates world.data.cells BEFORE the WebSocket opens, so the augmented cells are sent
  // in world.join and the server derives nodes from them.
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
      const cx = Math.floor(g / 2), cz = Math.floor(g / 2);

      const inBounds = (x, z) => x >= 0 && z >= 0 && x < g && z < g;
      // Place one cell. opts: { terrainFloors, floors, build } where `build` is a
      // voxel-build stamp id. Emits the most compact tuple the schema allows.
      function put(x, z, terrain, kind, opts) {
        x = Math.round(x); z = Math.round(z);
        if (!inBounds(x, z)) return false;
        const key = x + ',' + z;
        if (used.has(key)) return false;
        used.add(key);
        const tf = (opts && opts.terrainFloors) || 1;
        const floors = (opts && opts.floors) || 1;
        const build = opts && opts.build;
        if (build) {
          added.push([x, z, terrain, 'voxel-build', floors, null, tf, null, null, null, { voxelBuildId: build }]);
        } else if (tf > 1 || floors > 1) {
          added.push([x, z, terrain, kind || null, floors, null, tf]);
        } else if (kind) {
          added.push([x, z, terrain, kind]);
        } else {
          added.push([x, z, terrain]);
        }
        return true;
      }
      // Scatter a kind across a list of [x,z] offsets from an anchor.
      function scatter(ax, az, offsets, terrain, kind, opts) {
        for (const [dx, dz] of offsets) put(ax + dx, az + dz, terrain, kind, opts);
      }

      // ---------- TOP-LEFT: forest grove (voxel-stamp trees + undergrowth) ----------
      // The "nice" multi-tree voxel stamps, spaced so each reads as its own clump.
      put(1, 1, 'grass', null, { build: 'oak-grove-build' });
      put(Math.min(cx - 1, 3), 1, 'grass', null, { build: 'pine-cluster-build' });
      put(1, Math.min(cz - 1, 3), 'grass', null, { build: 'cherry-tree-build' });
      // Single voxel trees filling the canopy (taller via floors), then low cover.
      scatter(0, 0, [[2, 0], [0, 2], [2, 2]], 'grass', 'tree', { floors: 2 });
      scatter(0, 0, [[3, 0], [0, 3]], 'grass', 'tree');
      scatter(0, 0, [[1, 2], [2, 1], [3, 2], [2, 3]], 'grass', 'bush');
      scatter(0, 0, [[0, 1], [1, 0], [3, 3]], 'grass', 'flower');

      // ---------- TOP-RIGHT: crop patch (plant harvest) ----------
      const rx = g - 2;
      put(rx, 1, 'grass', null, { build: 'crop-patch-build' });
      scatter(rx, 0, [[0, 2], [1, 2]], 'grass', 'wheat');
      scatter(rx, 0, [[-1, 1], [0, 3]], 'grass', 'corn');
      put(rx, Math.min(cz - 1, 3), 'grass', 'pumpkin');
      put(rx - 1, 2, 'grass', 'sunflower');
      put(rx + 1 < g ? rx + 1 : rx, 0, 'grass', 'carrot');
      scatter(rx, 0, [[0, 0], [-1, 3]], 'grass', 'tuft');

      // ---------- BOTTOM-LEFT: rock highland (piled rock on RAISED terrain) ----------
      const bz = g - 2;
      // A small plateau of raised stone (water sits lower beside it for contrast).
      put(1, bz, 'stone', null, { terrainFloors: 3 });
      put(2, bz, 'stone', null, { terrainFloors: 3 });
      put(1, bz - 1, 'stone', null, { terrainFloors: 2 });
      put(2, bz - 1, 'stone', null, { terrainFloors: 2 });
      // Heaped rocks on top of / around the plateau — adjacency merges them into a pile.
      put(1, bz, 'stone', 'rock', { terrainFloors: 3 });
      put(2, bz, 'stone', 'rock', { terrainFloors: 3 });
      put(1, bz - 1, 'stone', 'rock', { terrainFloors: 2 });
      put(0, bz, 'grass', 'rock');
      put(0, bz - 1, 'grass', null, { build: 'rock-outcrop-build' });
      if (cx - 1 >= 3) put(3, bz, 'grass', 'rock');

      // ---------- BOTTOM-RIGHT: low water pond (fish) ----------
      const wx = cx + 1;
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1]]) {
        put(wx + dx, bz - 1 + dz, 'water', null);
      }
      // A few rocks at the waterline.
      put(wx - 1, bz, 'grass', 'rock');
      put(wx, bz - 2, 'grass', 'bush');

      // ---------- CENTRE: grazing meadow (animals + standable ground cover) ----------
      // Animals + tufts/flowers only here — all standable, so the spawn cross stays clear.
      const meadow = [
        [cx - 1, cz - 1, 'cow'], [cx + 1, cz, 'cow'],
        [cx, cz + 1, 'sheep'], [cx + 1, cz + 1, 'sheep'], [cx - 1, cz + 1, 'sheep'],
      ];
      for (const [x, z, kind] of meadow) {
        // never drop an animal on the centre gate cell itself
        if (x === cx && z === cz) continue;
        put(x, z, 'grass', kind);
      }
      scatter(cx, cz, [[-1, 0], [0, -1], [1, -1], [2, 0], [-2, 0]], 'grass', 'tuft');
      scatter(cx, cz, [[1, -1], [-1, -1], [0, 2]], 'grass', 'flower');

      if (added.length > 0) {
        data.cells = [...cells, ...added];
        console.log('[demo-seed] Seeded rich demo world (' + added.length + ' cells) into', world.slug);
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
