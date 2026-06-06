  // -------- tile factory --------
  function terrainStepHeight() {
    return useLandscapeEngine ? 1.12 : 0.20;
  }
  // Signed vertical offset of a cell's surface from the board base plane.
  // Levels above 1 raise the ground (hills); levels below 1 are excavated
  // (sandbox digging) and return a negative rise so the surface drops into a
  // pit. Undug worlds only ever pass level >= 1, so the result is >= 0 and the
  // classic terrain look is unchanged.
  function terrainRiseForLevel(level) {
    const step = terrainStepHeight();
    const lv = (level === undefined || level === null) ? 1 : level;
    return (Math.min(MAX_FLOORS, lv) - 1) * step;
  }

  const HEAVY_TERRAIN_KERB_DROP = 0.048;
  const WATER_SURFACE_DROP = TOP_H;

  function isHeavyKerbTerrain(terrain) {
    return terrain === 'path' || terrain === 'stone';
  }

  // Two terrains read as one continuous surface (no edge bricks / shared riser
  // between them) when they're the same terrain, or both hard paved ground
  // (path + stone) — so a stone cell next to a path cell doesn't draw a brick
  // strip across the path.
  function sameTerrainEdgeFamily(a, b) {
    if (a === b) return true;
    return isHeavyKerbTerrain(a) && isHeavyKerbTerrain(b);
  }

  function terrainSurfaceOffset(terrain) {
    if (isHeavyKerbTerrain(terrain)) return -HEAVY_TERRAIN_KERB_DROP;
    if (terrain === 'water') return -WATER_SURFACE_DROP;
    if (terrain === 'dirt') return 0.034;
    return 0;
  }

  function terrainLevelForCell(cell) {
    if (!cell) return 1;
    if (cell.terrainFloors !== undefined) return cell.terrainFloors || 1;
    return cell.kind ? 1 : (cell.floors || 1);
  }

  // How deep a cell is excavated below the base plane (0 = undug). Clamped so a
  // pit can never punch through the world's structural depth budget.
  function cellDigDepth(cell) {
    if (!cell || !cell.dig) return 0;
    return Math.max(0, Math.min(MAX_DIG, Math.round(cell.dig)));
  }

  // The signed render level used for tile geometry, riser side-culling, and
  // every "sits on the surface" Y lookup (objects, hover, crowd, vehicles).
  // = terrainFloors - dig, so digging lowers the cell and everything riding it.
  function tileLevelForCell(cell) {
    return terrainLevelForCell(cell) - cellDigDepth(cell);
  }

  function terrainVisualRiseForCell(cell) {
    if (!cell) return 0;
    return terrainRiseForLevel(tileLevelForCell(cell)) + terrainSurfaceOffset(cell.terrain);
  }

  function terrainRiseAt(x, z) {
    return terrainVisualRiseForCell(getWorldCell(x, z));
  }

  function materialHex(mat) {
    if (!mat || !mat.color) return null;
    return '#' + mat.color.getHexString();
  }

  function terrainShadeMaterial(base, amount) {
    const hex = materialHex(base);
    const shaded = amount ? shadeHexColor(hex, amount) : hex;
    return customMaterial(base, shaded) || base;
  }

  function voxelTreeLeafMaterials() {
    return [
      M.leaves,
      M.leavesDk,
      terrainShadeMaterial(M.leaves, 14),
      terrainShadeMaterial(M.leaves, -10),
      terrainShadeMaterial(M.leavesDk, 10),
      terrainShadeMaterial(M.leavesDk, -14),
    ];
  }

  function terrainVoxelMaterials(terrain, x = 0, z = 0, terrainN = null) {
    if (terrain === 'path') {
      return {
        base: M.path,
        hi: terrainShadeMaterial(M.path, 10),
        low: M.pathTrim,
        edge: M.pathTrim,
        scuff: M.pathScuff,
      };
    }
    if (terrain === 'water') {
      const flow = waterFlowVectorForCell(x, z, terrainN);
      return {
        base: waterFlowMaterial(M.water, flow.dx, flow.dz),
        hi: waterFlowMaterial(terrainShadeMaterial(M.water, 16), flow.dx, flow.dz),
        low: waterFlowMaterial(M.waterDk, flow.dx, flow.dz),
        edge: M.waterFoam,
        scuff: waterFlowMaterial(terrainShadeMaterial(M.waterDk, -10), flow.dx, flow.dz),
      };
    }
    if (terrain === 'dirt') {
      return {
        base: M.dirtRich,
        hi: terrainShadeMaterial(M.dirtRich, 18),
        low: M.dirtRich,
        edge: terrainShadeMaterial(M.dirtRich, -16),
        scuff: terrainShadeMaterial(M.dirtRich, 8),
      };
    }
    if (terrain === 'stone') {
      return {
        base: M.stone,
        hi: terrainShadeMaterial(M.stone, 14),
        low: M.stoneDk,
        edge: M.stoneDk,
        scuff: terrainShadeMaterial(M.stone, -8),
      };
    }
    if (terrain === 'lava') {
      return {
        base: M.lava,
        hi: terrainShadeMaterial(M.lava, 18),
        low: M.lavaCrust,
        edge: M.lavaCrust,
        scuff: terrainShadeMaterial(M.lavaCrust, 18),
      };
    }
    if (terrain === 'sand') {
      return {
        base: M.sand,
        hi: terrainShadeMaterial(M.sand, 12),
        low: M.sandDk,
        edge: M.sandDk,
        scuff: terrainShadeMaterial(M.sandDk, -8),
      };
    }
    if (terrain === 'snow') {
      return {
        base: M.snow,
        hi: terrainShadeMaterial(M.snow, 8),
        low: M.snowDk,
        edge: M.snowDk,
        scuff: terrainShadeMaterial(M.snowDk, -10),
      };
    }
    return {
      base: M.grass,
      hi: M.grassHi,
      low: terrainShadeMaterial(M.grass, -10),
      edge: M.grassEdge,
      scuff: terrainShadeMaterial(M.grassEdge, -10),
    };
  }

  function terrainRiserMaterial(terrain) {
    if (terrain === 'path') return M.pathTrim;
    if (terrain === 'water') return M.waterDk;
    if (terrain === 'dirt') return M.dirtRich;
    if (terrain === 'stone') return M.stoneSide || M.stone;
    if (terrain === 'lava') return M.lava;
    if (terrain === 'sand') return M.sand;
    if (terrain === 'snow') return M.snow;
    return M.boardSide;
  }

  function terrainRiserMaterials(terrain) {
    const base = terrainRiserMaterial(terrain);
    if (terrain === 'grass') {
      return {
        base,
        hi: terrainShadeMaterial(base, 10),
        low: terrainShadeMaterial(base, -12),
        edge: terrainShadeMaterial(base, -8),
      };
    }
    return {
      base,
      hi: terrainShadeMaterial(base, 10),
      low: terrainShadeMaterial(base, -12),
      edge: terrainShadeMaterial(base, -18),
    };
  }

  // Geological strata revealed on excavated (dug) pit walls — the
  // UnrealSandboxTerrain "layers by depth" look, adapted to the tile grid.
  // `depth` is how far below the board base plane (world y = 0) a wall panel
  // sits. The shallowest band keeps the cell's own terrain so the lip under the
  // surface still reads correctly; deeper bands transition soil → clay → rock →
  // bedrock. Materials are all existing shared `M.*` (no new textures/loads).
  const _strataBandCache = new Map();
  function strataBandsForTerrain(terrain) {
    if (_strataBandCache.has(terrain)) return _strataBandCache.get(terrain);
    const top = terrainRiserMaterials(terrain);
    const bands = [
      { maxDepth: 0.16, mats: top },
      { maxDepth: 0.52, mats: {
        base: M.dirtRich,
        hi: terrainShadeMaterial(M.dirtRich, 14),
        low: terrainShadeMaterial(M.dirtRich, -14),
        edge: terrainShadeMaterial(M.dirtRich, -8),
      } },
      { maxDepth: 0.98, mats: {
        base: terrainShadeMaterial(M.dirtRich, -20),
        hi: terrainShadeMaterial(M.sandDk, -6),
        low: terrainShadeMaterial(M.dirtRich, -30),
        edge: terrainShadeMaterial(M.dirtRich, -26),
      } },
      { maxDepth: 1.7, mats: {
        base: M.stone,
        hi: terrainShadeMaterial(M.stone, 12),
        low: M.stoneDk,
        edge: M.stoneDk,
      } },
      { maxDepth: Infinity, mats: {
        base: M.stoneDk,
        hi: terrainShadeMaterial(M.stone, -12),
        low: terrainShadeMaterial(M.stoneDk, -18),
        edge: terrainShadeMaterial(M.stoneDk, -22),
      } },
    ];
    _strataBandCache.set(terrain, bands);
    return bands;
  }
  function strataMatsForDepth(terrain, depth) {
    const bands = strataBandsForTerrain(terrain);
    for (const band of bands) {
      if (depth <= band.maxDepth) return band.mats;
    }
    return bands[bands.length - 1].mats;
  }

  function terrainVoxelCellCount(terrain) {
    const explicitCells = parseInt(renderTerrainVoxelResolution, 10);
    return Number.isFinite(explicitCells)
      ? explicitCells
      : ((terrain === 'path' || terrain === 'water' || terrain === 'dirt') ? 8 : 6);
  }

  // -------- per-tile voxel sculpting --------
  // A sculpted tile carries `voxels = { n, h:[n*n] }`: a signed integer height
  // offset per sub-cell, so the tile surface is a blocky N×N voxel mesh instead
  // of one flat slab. `n` is the sub-grid resolution (the Voxel Resolution
  // setting: 4/6/8/10). Heights are in cubic-voxel steps (one sub-cell wide).
  const MAX_VOX = 16; // clamp on a sub-cell height offset (± steps)
  function sculptResolutionNumeric() {
    const n = parseInt(renderTerrainVoxelResolution, 10);
    return Number.isFinite(n) ? Math.max(2, Math.min(16, n)) : 8;
  }
  // Normalised sculpt data, or null when the tile is flat (all-zero / absent).
  function cellSculptData(cell) {
    const v = cell && cell.voxels;
    if (!v) return null;
    const n = v.n | 0;
    if (n < 2 || n > 16 || !Array.isArray(v.h) || v.h.length !== n * n) return null;
    for (let k = 0; k < v.h.length; k++) { if (v.h[k]) return { n, h: v.h }; }
    return null;
  }
  // Clamp + dedupe a sculpt heightmap to a stored form; null when flat so a
  // flattened tile serialises like an ordinary one.
  function normalizeVoxels(v) {
    if (!v) return null;
    const n = v.n | 0;
    if (n < 2 || n > 16 || !Array.isArray(v.h) || v.h.length !== n * n) return null;
    const h = new Array(n * n);
    let any = false;
    for (let k = 0; k < h.length; k++) {
      const o = Math.max(-MAX_VOX, Math.min(MAX_VOX, Math.round(v.h[k]) || 0));
      h[k] = o;
      if (o) any = true;
    }
    return any ? { n, h } : null;
  }
  function sameVoxels(a, b) {
    const na = normalizeVoxels(a), nb = normalizeVoxels(b);
    if (!na && !nb) return true;
    if (!na || !nb || na.n !== nb.n) return false;
    for (let k = 0; k < na.h.length; k++) { if (na.h[k] !== nb.h[k]) return false; }
    return true;
  }

  const waterfallEffectMeshes = new Set();
  const waterfallTimeUniform = { value: 0 };

  function addVoxelTerrainTop(g, terrain, x, z, rise, topSize, topHeight, pathN, terrainN, hiddenSides) {
    const mats = terrainVoxelMaterials(terrain, x, z, terrainN);
    const cells = terrainVoxelCellCount(terrain);
    const cellSize = topSize / cells;
    const panelOverlap = Math.min(0.014, Math.max(0.006, cellSize * 0.06));
    const panelSize = cellSize + panelOverlap;
    const half = topSize * 0.5;
    const y = rise + topHeight * 0.5;
    const buckets = new Map();
    function queuePanel(geo, mat, px, pz) {
      const key = (geo.id || geo.uuid) + ':' + (mat.id || mat.uuid);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { geo, mat, positions: [] };
        buckets.set(key, bucket);
      }
      bucket.positions.push(px, pz);
    }
    for (let ix = 0; ix < cells; ix++) {
      for (let iz = 0; iz < cells; iz++) {
        const atN = iz === 0;
        const atS = iz === cells - 1;
        const atW = ix === 0;
        const atE = ix === cells - 1;
        const edgeToDifferentTerrain =
          (atN && terrainN.n && !sameTerrainEdgeFamily(terrainN.n, terrain)) ||
          (atS && terrainN.s && !sameTerrainEdgeFamily(terrainN.s, terrain)) ||
          (atW && terrainN.w && !sameTerrainEdgeFamily(terrainN.w, terrain)) ||
          (atE && terrainN.e && !sameTerrainEdgeFamily(terrainN.e, terrain));
        // Path trim shows at the path's outer boundary (no neighbour, or a
        // non-hard-ground neighbour) — but NOT against an adjacent stone cell.
        const hardN = dir => { const t = terrainN[dir]; return !!(t && isHeavyKerbTerrain(t)); };
        const pathEdge =
          terrain === 'path' &&
          ((atN && !pathN.n && !hardN('n')) || (atS && !pathN.s && !hardN('s')) ||
           (atW && !pathN.w && !hardN('w')) || (atE && !pathN.e && !hardN('e')));
        const waterEdge = terrain === 'water' && edgeToDifferentTerrain;
        const r = cellRand(x * cells + ix, z * cells + iz, terrain === 'path' ? 91 : 53);
        let mat = mats.base;
        if (pathEdge || waterEdge) {
          mat = mats.edge;
        } else if (edgeToDifferentTerrain && terrain !== 'path') {
          mat = mats.edge;
        } else if (r > 0.86) {
          mat = mats.hi;
        } else if (r < 0.16) {
          mat = mats.low;
        } else if (terrain !== 'water' && r > 0.68) {
          mat = mats.scuff;
        }
        const panelGeo = getOpenBoxGeometry(
          panelSize,
          topHeight,
          panelSize,
          false,
          true,
          !atE || (hiddenSides && hiddenSides.e),
          !atW || (hiddenSides && hiddenSides.w),
          !atS || (hiddenSides && hiddenSides.s),
          !atN || (hiddenSides && hiddenSides.n)
        );
        queuePanel(panelGeo, mat, -half + cellSize * (ix + 0.5), -half + cellSize * (iz + 0.5));
      }
    }
    const dummy = addVoxelTerrainTop._dummy || (addVoxelTerrainTop._dummy = new THREE.Object3D());
    for (const bucket of buckets.values()) {
      const count = bucket.positions.length / 2;
      const mesh = new THREE.InstancedMesh(bucket.geo, bucket.mat, count);
      for (let i = 0; i < count; i++) {
        dummy.position.set(bucket.positions[i * 2], y, bucket.positions[i * 2 + 1]);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      g.add(mesh);
    }
    addVoxelTerrainSurfaceDetails(g, terrain, x, z, topSize, rise + topHeight + 0.012, pathN, terrainN);
  }

  // Blocky voxel heightfield top for a sculpted tile. Each sub-cell gets its own
  // surface height (`rise + off*vstep`); vertical strata walls fill the steps
  // between differing sub-cells (and between a raised edge sub-cell and the tile
  // base, so the surface meets the outer riser). Self-contained per tile: equal-
  // height columns abut seamlessly within and across tiles, so a continuous
  // brush reads continuously. Only sculpted tiles run this path.
  function addVoxelSculptTop(g, terrain, x, z, rise, topSize, topHeight, pathN, terrainN, hiddenSides, vox) {
    const N = vox.n;
    const h = vox.h;
    const mats = terrainVoxelMaterials(terrain, x, z, terrainN);
    const cellSize = topSize / N;
    const vstep = cellSize; // cubic voxels
    const panelOverlap = Math.min(0.014, Math.max(0.006, cellSize * 0.06));
    const panelSize = cellSize + panelOverlap;
    const sideDepth = Math.min(0.03, Math.max(0.012, cellSize * 0.14));
    const half = topSize * 0.5;
    const offAt = (i, j) => (i >= 0 && i < N && j >= 0 && j < N) ? (h[i * N + j] || 0) : 0;
    const surfTop = o => rise + o * vstep + topHeight;        // world Y of a sub-cell surface
    const centerX = i => -half + cellSize * (i + 0.5);
    const centerZ = j => -half + cellSize * (j + 0.5);

    const buckets = new Map();
    function queue(geo, mat, m) {
      const key = (geo.id || geo.uuid) + ':' + (mat.id || mat.uuid);
      let b = buckets.get(key);
      if (!b) { b = { geo, mat, mats: [] }; buckets.set(key, b); }
      b.mats.push(m);
    }
    const dummy = addVoxelSculptTop._dummy || (addVoxelSculptTop._dummy = new THREE.Object3D());

    // --- top caps (thin slab under each sub-cell surface) ---
    const capGeo = getOpenBoxGeometry(panelSize, topHeight, panelSize, false, true, true, true, true, true);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const o = offAt(i, j);
        const r = cellRand(x * N + i, z * N + j, 53);
        let mat = mats.base;
        if (r > 0.86) mat = mats.hi;
        else if (r < 0.16) mat = mats.low;
        else if (terrain !== 'water' && r > 0.68) mat = mats.scuff;
        dummy.position.set(centerX(i), surfTop(o) - topHeight * 0.5, centerZ(j));
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        queue(capGeo, mat, dummy.matrix.clone());
      }
    }

    // --- strata step walls between a sub-cell and its lower neighbour ---
    // Unit-height, double-sided wall (scaled per instance) so heights vary freely.
    const wallGeoNS = getOpenBoxGeometry(panelSize, 1, sideDepth, true, true, false, false, false, false);
    const wallGeoEW = getOpenBoxGeometry(sideDepth, 1, panelSize, true, true, false, false, false, false);
    const DIRS = [['n', 0, -1], ['s', 0, 1], ['w', -1, 0], ['e', 1, 0]];
    // Sample the matching edge sub-cell of an adjacent tile so walls stay seamless
    // across two sculpted tiles, and cap cleanly against a flat (unsculpted) one.
    // Returns the neighbour offset, or null when the neighbour tile is flat/at a
    // different resolution (→ reconcile this tile's edge down to the base plane).
    function neighborEdgeOffset(dir, i, j) {
      if (typeof getWorldCell !== 'function') return null;
      let nx = x, nz = z, ni = i, nj = j;
      if (dir === 'e') { nx = x + 1; ni = 0; }
      else if (dir === 'w') { nx = x - 1; ni = N - 1; }
      else if (dir === 'n') { nz = z - 1; nj = N - 1; }
      else { nz = z + 1; nj = 0; }
      const nc = getWorldCell(nx, nz);
      const v = nc && nc.voxels;
      if (!v || v.n !== N || !Array.isArray(v.h)) return null;
      return v.h[ni * N + nj] || 0;
    }
    function drawWall(dir, i, j, loY, hiY) {
      const wallH = hiY - loY;
      if (wallH <= 1e-4) return;
      const midY = (loY + hiY) * 0.5;
      const depth = Math.max(0, -midY); // below the board base plane → strata
      const band = strataMatsForDepth(terrain, depth);
      const rr = cellRand(x * N + i, z * N + j, 200 + dir.charCodeAt(0));
      const wmat = rr > 0.8 ? band.hi : (rr < 0.22 ? band.low : band.base);
      const alongX = dir === 'n' || dir === 's';
      const px = alongX ? centerX(i) : (dir === 'w' ? centerX(i) - cellSize * 0.5 : centerX(i) + cellSize * 0.5);
      const pz = alongX ? (dir === 'n' ? centerZ(j) - cellSize * 0.5 : centerZ(j) + cellSize * 0.5) : centerZ(j);
      dummy.position.set(px, midY, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, wallH, 1);
      dummy.updateMatrix();
      queue(alongX ? wallGeoNS : wallGeoEW, wmat, dummy.matrix.clone());
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const o = offAt(i, j);
        for (const [dir, di, dj] of DIRS) {
          const ni = i + di, nj = j + dj;
          if (ni >= 0 && ni < N && nj >= 0 && nj < N) {
            // Interior step: the taller sub-cell draws the wall down to the lower.
            const no = offAt(ni, nj);
            if (no < o) drawWall(dir, i, j, surfTop(no), surfTop(o));
          } else {
            const nb = neighborEdgeOffset(dir, i, j);
            if (nb === null) {
              // Flat / unsculpted neighbour: reconcile this edge to the base
              // plane (offset 0) in both directions so there is no see-through.
              if (o !== 0) drawWall(dir, i, j, surfTop(Math.min(o, 0)), surfTop(Math.max(o, 0)));
            } else if (nb < o) {
              // Adjacent sculpted tile: only the taller side draws the wall, so
              // two equally-sculpted tiles meet seamlessly.
              drawWall(dir, i, j, surfTop(nb), surfTop(o));
            }
          }
        }
      }
    }

    for (const b of buckets.values()) {
      const mesh = new THREE.InstancedMesh(b.geo, b.mat, b.mats.length);
      for (let i = 0; i < b.mats.length; i++) mesh.setMatrixAt(i, b.mats[i]);
      mesh.instanceMatrix.needsUpdate = true;
      g.add(mesh);
    }
    // No flat surface flecks here — they would float over the sculpted relief.
  }

  function addVoxelTerrainSurfaceDetails(g, terrain, x, z, topSize, y, pathN = null, terrainN = null) {
    if (terrain === 'water' || terrain === 'lava' || terrain === 'snow') return;
    const half = topSize * 0.5;
    const wear = Math.max(0, Math.min(1, renderMaterialWear || 0));
    const dummy = addVoxelTerrainSurfaceDetails._dummy || (addVoxelTerrainSurfaceDetails._dummy = new THREE.Object3D());
    const buckets = [];
    function addBucket(mat, geo, count, place) {
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      for (let i = 0; i < count; i++) {
        place(i, dummy);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.userData.noShadow = true;
      g.add(mesh);
      buckets.push(mesh);
    }
    const dotGeo = getBoxGeometry(0.045, 0.010, 0.045);
    const bladeGeo = getBoxGeometry(0.028, 0.052, 0.028);
    const paverGeo = getBoxGeometry(0.18, 0.012, 0.055);
    const rutGeo = getBoxGeometry(0.045, 0.010, 0.66);
    const pebbleGeo = getBoxGeometry(0.055, 0.018, 0.040);
    const grimeGeo = getBoxGeometry(0.080, 0.006, 0.055);
    function scatter(i, seed, inset = 0.12) {
      const rx = cellRand(x * 13 + i, z * 17 - i, seed);
      const rz = cellRand(x * 19 - i, z * 11 + i, seed + 9);
      return [
        -half + inset + rx * (topSize - inset * 2),
        -half + inset + rz * (topSize - inset * 2),
      ];
    }
    if (terrain === 'grass') {
      addBucket(M.grassHi, bladeGeo, 5, (i, d) => {
        const [px, pz] = scatter(i, 410, 0.14);
        d.position.set(px, y + 0.020, pz);
        d.rotation.set(0, cellRand(x + i, z - i, 430) * Math.PI, 0);
        const s = 0.75 + cellRand(x - i, z + i, 440) * 0.75;
        d.scale.set(s, 0.75 + s * 0.35, s);
      });
      addBucket(M.leavesDk, dotGeo, 4, (i, d) => {
        const [px, pz] = scatter(i, 450, 0.10);
        d.position.set(px, y + 0.006, pz);
        d.rotation.set(0, cellRand(x + i, z + i, 460) * Math.PI, 0);
        const s = 0.70 + cellRand(x - i, z - i, 470) * 0.85;
        d.scale.set(s, 1, s * 0.75);
      });
      if (cellRand(x, z, 480) > 0.72) {
        addBucket(M.grassFlower, dotGeo, 1, (_, d) => {
          const [px, pz] = scatter(1, 490, 0.18);
          d.position.set(px, y + 0.018, pz);
          d.rotation.set(0, 0, 0);
          d.scale.set(0.65, 1, 0.65);
        });
      }
      if (wear > 0.02) {
        addBucket(M.wearGrime, grimeGeo, Math.max(1, Math.round(wear * 4)), (i, d) => {
          const [px, pz] = scatter(i, 610, 0.07);
          d.position.set(px, y + 0.004, pz);
          d.rotation.set(0, cellRand(x + i, z - i, 620) * Math.PI, 0);
          const s = 0.65 + cellRand(x - i, z + i, 630) * 0.95;
          d.scale.set(s, 1, 0.7 + s * 0.25);
        });
      }
    } else if (terrain === 'path') {
      const runsX = !!(pathN && (pathN.e || pathN.w) && !(pathN.n || pathN.s));
      addBucket(M.pathScuff, rutGeo, 2, (i, d) => {
        const offset = (i ? 1 : -1) * (0.13 + cellRand(x + i, z - i, 505) * 0.045);
        if (runsX) {
          d.position.set(0, y + 0.005, offset);
          d.rotation.set(0, Math.PI / 2, 0);
        } else {
          d.position.set(offset, y + 0.005, 0);
          d.rotation.set(0, 0, 0);
        }
        const s = 0.72 + cellRand(x - i, z + i, 507) * 0.32;
        d.scale.set(1, 1, s);
      });
      addBucket(M.pathTrim, paverGeo, 4, (i, d) => {
        const [px, pz] = scatter(i, 510, 0.08);
        d.position.set(px, y + 0.004, pz);
        d.rotation.set(0, (cellRand(x + i, z, 520) > 0.5 ? Math.PI / 2 : 0), 0);
        d.scale.set(0.75 + cellRand(x, z + i, 530) * 0.45, 1, 0.85);
      });
      addBucket(M.pathScuff, pebbleGeo, 4, (i, d) => {
        const [px, pz] = scatter(i, 540, 0.10);
        d.position.set(px, y + 0.008, pz);
        d.rotation.set(0, cellRand(x - i, z, 550) * Math.PI, 0);
        d.scale.set(0.80, 1, 0.80);
      });
      if (wear > 0.02) {
        addBucket(M.wearChip, grimeGeo, Math.max(1, Math.round(wear * 5)), (i, d) => {
          const [px, pz] = scatter(i, 640, 0.06);
          d.position.set(px, y + 0.010, pz);
          d.rotation.set(0, cellRand(x + i, z + i, 650) * Math.PI, 0);
          const s = 0.55 + cellRand(x - i, z, 660) * 0.70;
          d.scale.set(s, 1, 0.55 + s * 0.25);
        });
        addBucket(M.wearGrime, pebbleGeo, Math.max(1, Math.round(wear * 3)), (i, d) => {
          const [px, pz] = scatter(i, 670, 0.08);
          d.position.set(px, y + 0.009, pz);
          d.rotation.set(0, cellRand(x, z - i, 680) * Math.PI, 0);
          d.scale.set(0.85, 1, 0.70);
        });
      }
      const hasGrassEdge = terrainN && (terrainN.n === 'grass' || terrainN.s === 'grass' || terrainN.e === 'grass' || terrainN.w === 'grass');
      if (hasGrassEdge && cellRand(x, z, 734) > 0.86) {
        const grassSides = [];
        if (terrainN.n === 'grass') grassSides.push('n');
        if (terrainN.s === 'grass') grassSides.push('s');
        if (terrainN.w === 'grass') grassSides.push('w');
        if (terrainN.e === 'grass') grassSides.push('e');
        const side = grassSides[Math.min(grassSides.length - 1, Math.floor(cellRand(x, z, 735) * grassSides.length))] || 'n';
        const edge = topSize * 0.5 - 0.12;
        const along = (cellRand(x, z, 736) - 0.5) * topSize * 0.55;
        const px = side === 'e' ? edge : side === 'w' ? -edge : along;
        const pz = side === 's' ? edge : side === 'n' ? -edge : along;
        vbox(g, 0.035, 0.28, 0.035, px, y + 0.14, pz, M.trunk, { noGap: true, noBevel: true, noShadow: true });
        vbox(g, side === 'e' || side === 'w' ? 0.045 : 0.24, 0.11, side === 'e' || side === 'w' ? 0.24 : 0.045, px, y + 0.30, pz, M.bridgeWood, { noGap: true, noBevel: true, noShadow: true });
      } else if (cellRand(x, z, 742) > 0.92) {
        const [px, pz] = scatter(7, 744, 0.24);
        vbox(g, 0.16, 0.12, 0.14, px, y + 0.06, pz, M.bridgeWoodD, { noGap: true, noBevel: true, noShadow: true, ry: cellRand(x, z, 745) * Math.PI });
        vbox(g, 0.18, 0.035, 0.16, px, y + 0.138, pz, M.bridgeWood, { noGap: true, noBevel: true, noShadow: true, ry: cellRand(x, z, 745) * Math.PI });
      }
    } else if (terrain === 'dirt') {
      addBucket(M.dirt, pebbleGeo, 6, (i, d) => {
        const [px, pz] = scatter(i, 560, 0.08);
        d.position.set(px, y + 0.006, pz);
        d.rotation.set(0, cellRand(x, z + i, 570) * Math.PI, 0);
        const s = 0.70 + cellRand(x + i, z, 580) * 0.80;
        d.scale.set(s, 1, s);
      });
      if (wear > 0.02) {
        addBucket(M.wearMoss, dotGeo, Math.max(1, Math.round(wear * 3)), (i, d) => {
          const [px, pz] = scatter(i, 690, 0.09);
          d.position.set(px, y + 0.008, pz);
          d.rotation.set(0, cellRand(x + i, z, 700) * Math.PI, 0);
          d.scale.set(1.10, 1, 0.80);
        });
      }
    } else if (terrain === 'stone' || terrain === 'sand') {
      addBucket(terrain === 'stone' ? M.stoneDk : M.sandDk, pebbleGeo, 4, (i, d) => {
        const [px, pz] = scatter(i, 590, 0.10);
        d.position.set(px, y + 0.006, pz);
        d.rotation.set(0, cellRand(x, z - i, 600) * Math.PI, 0);
        d.scale.set(1.1, 1, 0.9);
      });
      if (wear > 0.02) {
        addBucket(terrain === 'stone' ? M.wearMoss : M.wearGrime, grimeGeo, Math.max(1, Math.round(wear * 4)), (i, d) => {
          const [px, pz] = scatter(i, 710, 0.07);
          d.position.set(px, y + 0.006, pz);
          d.rotation.set(0, cellRand(x - i, z + i, 720) * Math.PI, 0);
          d.scale.set(0.90, 1, 0.70);
        });
      }
    }
    return buckets;
  }

  function addVoxelTerrainRiser(g, terrain, x, z, rise, riserSize, riserHeight, hiddenSides, bottomY, strata) {
    if (bottomY === undefined) bottomY = -DIRT_H;
    const mats = terrainRiserMaterials(terrain);
    const cells = terrainVoxelCellCount(terrain);
    const cellSize = riserSize / cells;
    const verticalCells = Math.max(2, Math.min(8, Math.ceil(riserHeight / cellSize)));
    const panelW = cellSize + Math.min(0.012, cellSize * 0.05);
    const panelH = riserHeight / verticalCells + Math.min(0.008, (riserHeight / verticalCells) * 0.04);
    const sideDepth = Math.min(0.028, Math.max(0.016, cellSize * 0.12));
    const half = riserSize * 0.5;
    const buckets = new Map();
    function pickMat(ix, iy, dir, py) {
      const r = cellRand(x * cells + ix, z * verticalCells + iy, 180 + dir.charCodeAt(0));
      // Excavated walls: pick the geological band for this panel's depth so a
      // dug pit shows soil → clay → rock → bedrock instead of one flat colour.
      if (strata && py < -0.02) {
        const band = strataMatsForDepth(terrain, -py);
        if (r > 0.82) return band.hi;
        if (r < 0.20) return band.low;
        return band.base;
      }
      if (iy === verticalCells - 1 && terrain === 'grass' && r > 0.28) return mats.edge;
      if (r > 0.82) return mats.hi;
      if (r < 0.20) return mats.low;
      return mats.base;
    }
    function queuePanel(geo, mat, px, py, pz) {
      const key = (geo.id || geo.uuid) + ':' + (mat.id || mat.uuid);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { geo, mat, positions: [] };
        buckets.set(key, bucket);
      }
      bucket.positions.push(px, py, pz);
    }
    function sideGeo(dir) {
      const alongX = dir === 'n' || dir === 's';
      return alongX
        ? getOpenBoxGeometry(panelW, panelH, sideDepth, true, true, false, false, false, false)
        : getOpenBoxGeometry(sideDepth, panelH, panelW, true, true, false, false, false, false);
    }
    function addSide(dir) {
      const geo = sideGeo(dir);
      const alongX = dir === 'n' || dir === 's';
      for (let i = 0; i < cells; i++) {
        for (let j = 0; j < verticalCells; j++) {
          const px = alongX ? -half + cellSize * (i + 0.5) : (dir === 'w' ? -half : half);
          const pz = alongX ? (dir === 'n' ? -half : half) : -half + cellSize * (i + 0.5);
          const py = bottomY + panelH * 0.5 + (riserHeight / verticalCells) * j;
          queuePanel(geo, pickMat(i, j, dir, py), px, py, pz);
        }
      }
    }
    if (!(hiddenSides && hiddenSides.n)) addSide('n');
    if (!(hiddenSides && hiddenSides.s)) addSide('s');
    if (!(hiddenSides && hiddenSides.w)) addSide('w');
    if (!(hiddenSides && hiddenSides.e)) addSide('e');
    const dummy = addVoxelTerrainRiser._dummy || (addVoxelTerrainRiser._dummy = new THREE.Object3D());
    for (const bucket of buckets.values()) {
      const count = bucket.positions.length / 3;
      const mesh = new THREE.InstancedMesh(bucket.geo, bucket.mat, count);
      for (let i = 0; i < count; i++) {
        dummy.position.set(bucket.positions[i * 3], bucket.positions[i * 3 + 1], bucket.positions[i * 3 + 2]);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      g.add(mesh);
    }
  }

  function addVoxelTerrainRiserBacking(g, terrain, riserSize, riserHeight, hiddenSides, bottomY, strata) {
    if (bottomY === undefined) bottomY = -DIRT_H;
    const solidSize = Math.max(0.05, riserSize);
    const sideFlags = [
      hiddenSides && hiddenSides.e,
      hiddenSides && hiddenSides.w,
      hiddenSides && hiddenSides.s,
      hiddenSides && hiddenSides.n,
    ];
    const topY = bottomY + riserHeight;
    // Excavated walls: stack thin per-band boxes so the exposed cliff reads as
    // geological strata (soil → clay → rock → bedrock) by depth instead of one
    // flat colour. Only side faces draw (top/bottom culled), so it stays cheap.
    if (strata) {
      const bands = strataBandsForTerrain(terrain);
      let slabTop = topY;
      for (let i = 0; i < bands.length && slabTop > bottomY + 1e-4; i++) {
        const bandBottomY = (bands[i].maxDepth === Infinity) ? -Infinity : -bands[i].maxDepth;
        const slabBottom = Math.max(bottomY, bandBottomY);
        const h = slabTop - slabBottom;
        if (h > 1e-4) {
          const slabGeo = getOpenBoxGeometry(solidSize, h, solidSize, true, true, sideFlags[0], sideFlags[1], sideFlags[2], sideFlags[3]);
          const slab = new THREE.Mesh(slabGeo, bands[i].mats.base);
          slab.position.y = slabBottom + h * 0.5;
          g.add(slab);
        }
        slabTop = slabBottom;
      }
      return;
    }
    const geo = getOpenBoxGeometry(
      solidSize,
      riserHeight,
      solidSize,
      true,
      true,
      sideFlags[0],
      sideFlags[1],
      sideFlags[2],
      sideFlags[3]
    );
    const mesh = new THREE.Mesh(geo, terrainRiserMaterial(terrain));
    mesh.position.y = bottomY + riserHeight * 0.5;
    g.add(mesh);
  }

  function heavyTerrainKerbMaterials(terrain) {
    if (terrain === 'stone') {
      return [
        terrainShadeMaterial(M.stoneDk, -18),
        terrainShadeMaterial(M.stone, -24),
        terrainShadeMaterial(M.stoneDk, -6),
        terrainShadeMaterial(M.rockHi, -22),
      ];
    }
    return [
      terrainShadeMaterial(M.pathTrim, -18),
      terrainShadeMaterial(M.pathScuff, -14),
      terrainShadeMaterial(M.pathTrim, -28),
      terrainShadeMaterial(M.path, -20),
    ];
  }

  function addHeavyTerrainKerbStrips(g, terrain, x, z, terrainN, topSize, visualTopY) {
    if (!isHeavyKerbTerrain(terrain)) return;
    const drop = Math.abs(Math.min(0, terrainSurfaceOffset(terrain)));
    if (!drop) return;
    const mats = heavyTerrainKerbMaterials(terrain);
    const brickH = drop + 0.018;
    const brickD = 0.043;
    const brickY = visualTopY + brickH * 0.5 - 0.004;
    const off = topSize * 0.5 - brickD * 0.5;
    const segments = 6;
    const usable = Math.max(0.30, topSize - 0.13);
    const step = usable / segments;
    const buckets = new Map();

    function shouldEdge(dir) {
      return !sameTerrainEdgeFamily(terrainN[dir], terrain);
    }

    function queue(geo, mat, px, py, pz) {
      const key = (geo.id || geo.uuid) + ':' + (mat.id || mat.uuid);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { geo, mat, positions: [] };
        buckets.set(key, bucket);
      }
      bucket.positions.push(px, py, pz);
    }

    function pickMat(dir, i) {
      const r = cellRand(x * 23 + i, z * 29 - i, 780 + dir.charCodeAt(0));
      return mats[Math.min(mats.length - 1, Math.floor(r * mats.length))];
    }

    function addSide(dir) {
      if (!shouldEdge(dir)) return;
      const alongX = dir === 'n' || dir === 's';
      for (let i = 0; i < segments; i++) {
        const r = cellRand(x * 31 + i, z * 37 - i, 800 + dir.charCodeAt(0));
        const len = step * (0.74 + r * 0.16);
        const shift = (r - 0.5) * step * 0.12;
        const across = -usable * 0.5 + step * (i + 0.5) + shift;
        const py = brickY + (cellRand(x - i, z + i, 820 + dir.charCodeAt(0)) - 0.5) * 0.004;
        if (alongX) {
          const geo = getBoxGeometry(len, brickH, brickD);
          queue(geo, pickMat(dir, i), across, py, dir === 'n' ? -off : off);
        } else {
          const geo = getBoxGeometry(brickD, brickH, len);
          queue(geo, pickMat(dir, i), dir === 'w' ? -off : off, py, across);
        }
      }
    }

    addSide('n');
    addSide('s');
    addSide('w');
    addSide('e');

    const dummy = addHeavyTerrainKerbStrips._dummy || (addHeavyTerrainKerbStrips._dummy = new THREE.Object3D());
    for (const bucket of buckets.values()) {
      const count = bucket.positions.length / 3;
      const mesh = new THREE.InstancedMesh(bucket.geo, bucket.mat, count);
      for (let i = 0; i < count; i++) {
        dummy.position.set(bucket.positions[i * 3], bucket.positions[i * 3 + 1], bucket.positions[i * 3 + 2]);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      g.add(mesh);
    }
  }

  function waterRimMaterials() {
    return [
      M.shore,
      terrainShadeMaterial(M.shore, -10),
      terrainShadeMaterial(M.shore, -20),
      terrainShadeMaterial(M.stone, -18),
    ];
  }

  function addSunkenWaterRimStrips(g, terrain, x, z, terrainN, topSize, visualTopY, spillSides = null) {
    if (terrain !== 'water') return;
    const drop = Math.abs(Math.min(0, terrainSurfaceOffset(terrain)));
    if (!drop) return;
    const mats = waterRimMaterials();
    const rimH = drop + 0.014;
    const rimD = 0.068;
    const rimY = visualTopY + rimH * 0.5 - 0.007;
    const off = topSize * 0.5 - rimD * 0.5;
    const segments = 6;
    const usable = Math.max(0.30, topSize - 0.12);
    const step = usable / segments;
    const buckets = new Map();

    function shouldEdge(dir) {
      if (spillSides && spillSides[dir]) return false;
      return terrainN[dir] !== 'water';
    }

    function queue(geo, mat, px, py, pz) {
      const key = (geo.id || geo.uuid) + ':' + (mat.id || mat.uuid);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { geo, mat, positions: [] };
        buckets.set(key, bucket);
      }
      bucket.positions.push(px, py, pz);
    }

    function pickMat(dir, i) {
      const r = cellRand(x * 41 + i, z * 47 - i, 900 + dir.charCodeAt(0));
      return mats[Math.min(mats.length - 1, Math.floor(r * mats.length))];
    }

    function addSide(dir) {
      if (!shouldEdge(dir)) return;
      const alongX = dir === 'n' || dir === 's';
      for (let i = 0; i < segments; i++) {
        const r = cellRand(x * 53 + i, z * 59 - i, 920 + dir.charCodeAt(0));
        const len = step * (0.76 + r * 0.18);
        const shift = (r - 0.5) * step * 0.12;
        const across = -usable * 0.5 + step * (i + 0.5) + shift;
        const py = rimY + (cellRand(x - i, z + i, 940 + dir.charCodeAt(0)) - 0.5) * 0.004;
        if (alongX) {
          queue(getBoxGeometry(len, rimH, rimD), pickMat(dir, i), across, py, dir === 'n' ? -off : off);
        } else {
          queue(getBoxGeometry(rimD, rimH, len), pickMat(dir, i), dir === 'w' ? -off : off, py, across);
        }
        // Bright foam lip riding the water surface against the bank — only on
        // edges that border land (this loop already runs land-bordering sides).
        const fLen = step * (0.84 + r * 0.12);
        const fW = 0.11;
        const fOff = topSize * 0.5 - fW * 0.5 - 0.018;
        const fY = visualTopY + 0.008;
        if (alongX) {
          queue(getBoxGeometry(fLen, 0.014, fW), M.waterFoam, across, fY, dir === 'n' ? -fOff : fOff);
        } else {
          queue(getBoxGeometry(fW, 0.014, fLen), M.waterFoam, dir === 'w' ? -fOff : fOff, fY, across);
        }
      }
    }

    addSide('n');
    addSide('s');
    addSide('w');
    addSide('e');

    const dummy = addSunkenWaterRimStrips._dummy || (addSunkenWaterRimStrips._dummy = new THREE.Object3D());
    for (const bucket of buckets.values()) {
      const count = bucket.positions.length / 3;
      const mesh = new THREE.InstancedMesh(bucket.geo, bucket.mat, count);
      for (let i = 0; i < count; i++) {
        dummy.position.set(bucket.positions[i * 3], bucket.positions[i * 3 + 1], bucket.positions[i * 3 + 2]);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      g.add(mesh);
    }
  }

  function getWaterfallPlaneGeometry() {
    if (!getWaterfallPlaneGeometry.geo) {
      getWaterfallPlaneGeometry.geo = new THREE.PlaneGeometry(1, 1);
      getWaterfallPlaneGeometry.geo.userData.cached = true;
    }
    return getWaterfallPlaneGeometry.geo;
  }

  function getWaterfallCurtainMaterial() {
    if (!getWaterfallCurtainMaterial.mat) {
      getWaterfallCurtainMaterial.mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: waterfallTimeUniform,
          uGlobalOpacity: { value: 1 },
          uBaseColor: { value: new THREE.Color(0x28b5f0) },
          uHiColor: { value: new THREE.Color(0x96e7ff) },
        },
        transparent: true,
        depthWrite: true,
        side: THREE.FrontSide,
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vWorld;
          void main() {
            vUv = uv;
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorld = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uGlobalOpacity;
          uniform vec3 uBaseColor;
          uniform vec3 uHiColor;
          varying vec2 vUv;
          varying vec3 vWorld;
          float wfHash(float n) {
            return fract(sin(n) * 43758.5453123);
          }
          void main() {
            float worldSeed = floor(vWorld.x * 0.61 + vWorld.z * 0.73);
            float laneCount = 9.0;
            float laneX = vUv.x * laneCount;
            float laneId = floor(laneX);
            float laneUv = fract(laneX);
            float laneRand = wfHash(laneId * 13.17 + worldSeed * 7.11);
            float laneWidth = 0.32 + laneRand * 0.42;
            float blade = 1.0 - smoothstep(laneWidth, laneWidth + 0.10, abs(laneUv - 0.5) * 2.0);
            float tailCut = 0.04 + wfHash(laneId * 19.0 + worldSeed * 3.0) * 0.58;
            float tailFade = smoothstep(tailCut, tailCut + 0.18, vUv.y);
            float topFade = 1.0 - smoothstep(0.96, 1.0, vUv.y) * 0.10;
            float flow = fract((1.0 - vUv.y) * (2.8 + laneRand * 2.4) + uTime * (0.65 + laneRand * 0.55) + laneRand);
            float streamPulse = 0.72 + smoothstep(0.15, 0.0, flow) * 0.22 + smoothstep(0.92, 1.0, flow) * 0.18;
            float levelSeed = wfHash(floor(vUv.y * (5.0 + laneRand * 5.0)) + laneId * 5.1 + worldSeed);
            float blockBreak = mix(0.72, 1.0, step(0.18, levelSeed));
            float alpha = blade * tailFade * topFade * streamPulse * blockBreak * 0.54 * uGlobalOpacity;
            if (alpha < 0.025) discard;
            float hi = smoothstep(0.04, 0.22, laneUv) * (1.0 - smoothstep(0.58, 0.96, laneUv));
            vec3 color = mix(uBaseColor, uHiColor, 0.22 + hi * 0.58 + streamPulse * 0.10);
            gl_FragColor = vec4(color, alpha);
            #include <encodings_fragment>
          }
        `,
      });
      getWaterfallCurtainMaterial.mat.userData.waterfallShader = true;
    }
    return getWaterfallCurtainMaterial.mat;
  }

  function getWaterfallSurfaceMaterial() {
    if (!getWaterfallSurfaceMaterial.mat) {
      getWaterfallSurfaceMaterial.mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: waterfallTimeUniform,
          uGlobalOpacity: { value: 1 },
          uBaseColor: { value: new THREE.Color(0x96e7ff) },
          uFoamColor: { value: new THREE.Color(0xf4fdff) },
        },
        transparent: true,
        depthWrite: true,
        side: THREE.FrontSide,
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vWorld;
          void main() {
            vUv = uv;
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorld = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uGlobalOpacity;
          uniform vec3 uBaseColor;
          uniform vec3 uFoamColor;
          varying vec2 vUv;
          varying vec3 vWorld;
          float wfHash(float n) {
            return fract(sin(n) * 43758.5453123);
          }
          void main() {
            float seed = floor(vWorld.x * 0.71 + vWorld.z * 0.67);
            float laneCount = 8.0;
            float laneX = vUv.x * laneCount;
            float laneId = floor(laneX);
            float laneUv = fract(laneX);
            float r = wfHash(laneId * 9.7 + seed * 2.3);
            float streak = 1.0 - smoothstep(0.20 + r * 0.22, 0.40 + r * 0.18, abs(laneUv - 0.5) * 2.0);
            float flow = fract(vUv.y * (2.6 + r * 2.2) - uTime * (0.58 + r * 0.42) + r);
            float dash = 0.55 + smoothstep(0.72, 1.0, flow) * 0.34 + smoothstep(0.10, 0.0, flow) * 0.18;
            float lip = 1.0 - smoothstep(0.18, 0.92, vUv.y);
            float alpha = streak * dash * (0.16 + lip * 0.38) * uGlobalOpacity;
            if (alpha < 0.02) discard;
            vec3 color = mix(uBaseColor, uFoamColor, lip * 0.52 + streak * 0.16);
            gl_FragColor = vec4(color, alpha);
            #include <encodings_fragment>
          }
        `,
      });
      getWaterfallSurfaceMaterial.mat.userData.waterfallShader = true;
    }
    return getWaterfallSurfaceMaterial.mat;
  }

  function addSurfaceEdgeWeeds(g, terrain, x, z, terrainN, topSize, topY) {
    if (terrain === 'water' || terrain === 'lava' || terrain === 'snow') return;
    const dirs = [
      { key: 'n', gx: 0, gz: -1 },
      { key: 's', gx: 0, gz: 1 },
      { key: 'w', gx: -1, gz: 0 },
      { key: 'e', gx: 1, gz: 0 },
    ];
    if (terrain === 'grass') {
      for (const dir of dirs) {
        if (!terrainN || terrainN[dir.key] === 'grass') continue;
        const count = 1 + Math.floor(cellRand(x + dir.gx, z + dir.gz, 1810) * 3);
        for (let i = 0; i < count; i++) {
          const r = cellRand(x * 13 + i + dir.gx, z * 17 - i + dir.gz, 1820);
          const along = (r - 0.5) * topSize * 0.72;
          const inset = 0.018 + cellRand(x - i, z + i, 1830) * 0.030;
          const h = 0.10 + cellRand(x + i, z - i, 1840) * 0.16;
          const w = 0.018 + cellRand(x - i * 2, z + i * 3, 1850) * 0.020;
          let px = 0, pz = 0;
          if (dir.key === 'n') { px = along; pz = -topSize * 0.5 + inset; }
          if (dir.key === 's') { px = along; pz =  topSize * 0.5 - inset; }
          if (dir.key === 'w') { px = -topSize * 0.5 + inset; pz = along; }
          if (dir.key === 'e') { px =  topSize * 0.5 - inset; pz = along; }
          const mat = i % 3 === 0 ? M.dirtRich : M.trunk;
          vbox(g, w, h, w, px, topY - h * 0.5 + 0.004, pz, mat, {
            noGap: true,
            noBevel: true,
            noShadow: true,
            ry: cellRand(x + i, z - i, 1855) * Math.PI,
          });
        }
      }
      return;
    }
    for (const dir of dirs) {
      if (!terrainN || terrainN[dir.key] !== 'grass') continue;
      const count = 2 + Math.floor(cellRand(x + dir.gx, z + dir.gz, 1860) * 3);
      for (let i = 0; i < count; i++) {
        const r = cellRand(x * 17 + i + dir.gx, z * 19 - i + dir.gz, 1870);
        const along = (r - 0.5) * topSize * 0.76;
        const inset = 0.035 + cellRand(x - i, z + i, 1880) * 0.075;
        const h = 0.055 + cellRand(x + i, z - i, 1890) * 0.090;
        const w = 0.025 + cellRand(x - i * 2, z + i * 3, 1900) * 0.026;
        let px = 0, pz = 0;
        if (dir.key === 'n') { px = along; pz = -topSize * 0.5 + inset; }
        if (dir.key === 's') { px = along; pz =  topSize * 0.5 - inset; }
        if (dir.key === 'w') { px = -topSize * 0.5 + inset; pz = along; }
        if (dir.key === 'e') { px =  topSize * 0.5 - inset; pz = along; }
        const mat = (i % 3 === 0) ? M.grassHi : M.grassEdge;
        vbox(g, w, h, w * 0.72, px, topY + h * 0.5 + 0.003, pz, mat, {
          noGap: true,
          noBevel: true,
          ry: cellRand(x + i, z - i, 1910) * Math.PI,
        });
      }
    }
  }

  function getWaterfallFoamGeometry() {
    if (!getWaterfallFoamGeometry.geo) {
      getWaterfallFoamGeometry.geo = new THREE.DodecahedronGeometry(1, 0);
      getWaterfallFoamGeometry.geo.userData.cached = true;
    }
    return getWaterfallFoamGeometry.geo;
  }

  function getWaterfallCubeGeometry() {
    if (!getWaterfallCubeGeometry.geo) {
      getWaterfallCubeGeometry.geo = getBoxGeometry(1, 1, 1);
      getWaterfallCubeGeometry.geo.userData.cached = true;
    }
    return getWaterfallCubeGeometry.geo;
  }

  const WATERFALL_FROTH_SPEED = 0.30;
  const WATERFALL_DROP_CUBE_SPEED = 0.86;
  const WATERFALL_FROTH_OUTSET = 0.16;
  const WATERFALL_CURTAIN_MIN_DROP = 3.55;
  const WATERFALL_CURTAIN_EXTRA_DROP = 2.85;

  function addWaterfallRiserEffects(g, x, z, riserSize, topY, sides) {
    if (!sides || !(sides.n || sides.s || sides.e || sides.w)) return;
    const bottomY = -DIRT_H + 0.045;
    const height = Math.max(0.12, topY - bottomY);
    const half = riserSize * 0.5 + 0.018;
    const sideSpan = riserSize * 0.96;

    function sidePosition(dir, across, y, outward = 0.010) {
      if (dir === 'n') return { x: across, y, z: -half - outward };
      if (dir === 's') return { x: across, y, z: half + outward };
      if (dir === 'e') return { x: half + outward, y, z: across };
      return { x: -half - outward, y, z: across };
    }

    function orientCurtainSheet(mesh, dir, baseY, h) {
      mesh.scale.set(sideSpan * 0.98, h, 1);
      if (dir === 'n') {
        mesh.position.set(0, baseY, -half - 0.010);
        mesh.rotation.y = Math.PI;
      } else if (dir === 's') {
        mesh.position.set(0, baseY, half + 0.010);
      } else if (dir === 'e') {
        mesh.position.set(half + 0.010, baseY, 0);
        mesh.rotation.y = Math.PI / 2;
      } else {
        mesh.position.set(-half - 0.010, baseY, 0);
        mesh.rotation.y = -Math.PI / 2;
      }
    }

    function orientSurfaceSheet(mesh, dir, length) {
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.set(sideSpan * 0.92, length, 1);
      if (dir === 'n') {
        mesh.position.set(0, topY + 0.007, -half + length * 0.5);
      } else if (dir === 's') {
        mesh.position.set(0, topY + 0.007, half - length * 0.5);
      } else if (dir === 'e') {
        mesh.position.set(half - length * 0.5, topY + 0.007, 0);
        mesh.rotation.z = Math.PI / 2;
      } else {
        mesh.position.set(-half + length * 0.5, topY + 0.007, 0);
        mesh.rotation.z = Math.PI / 2;
      }
    }

    function placeCurtainSheet(dir, h) {
      const mesh = new THREE.Mesh(getWaterfallPlaneGeometry(), getWaterfallCurtainMaterial());
      mesh.userData.noShadow = true;
      mesh.userData.waterfall = { kind: 'shaderSheet' };
      mesh.renderOrder = 6;
      orientCurtainSheet(mesh, dir, topY - h * 0.5, h);
      g.add(mesh);
    }

    function placeSurfaceSheet(dir, salt) {
      const length = 0.36 + cellRand(x + salt, z - salt, 712) * 0.16;
      const mesh = new THREE.Mesh(getWaterfallPlaneGeometry(), getWaterfallSurfaceMaterial());
      mesh.userData.noShadow = true;
      mesh.userData.waterfall = { kind: 'shaderSheet' };
      mesh.renderOrder = 7;
      orientSurfaceSheet(mesh, dir, length);
      g.add(mesh);
    }

    function addFoamSpec(specs, dir, across, y, radius, salt, lane = 'fall') {
      const laneScale = lane === 'lip' ? 1.42 : (lane === 'splash' ? 1.12 : 1);
      const baseScale = radius * laneScale * (0.86 + cellRand(x + salt, z - salt, 430) * 0.38);
      const base = sidePosition(dir, across, y, WATERFALL_FROTH_OUTSET + (lane === 'lip' ? 0.004 : 0.012) + cellRand(x + salt, z + salt, 431) * (lane === 'lip' ? 0.016 : 0.026));
      specs.push({
        lane,
        baseX: base.x,
        baseY: base.y,
        baseZ: base.z,
        baseAcross: across,
        baseScale,
        phase: cellRand(x * 7 + salt, z * 9 - salt, 450),
        speed: ((lane === 'lip' ? 3.9 : lane === 'splash' ? 5.1 : 3.6) + cellRand(x - salt, z + salt, 470) * 2.45) * WATERFALL_FROTH_SPEED,
        drift: 0.045 + cellRand(x + salt, z + salt, 490) * 0.055,
        acrossDrift: sideSpan * ((lane === 'lip' ? 0.025 : 0.035) + cellRand(x - salt, z - salt, 491) * (lane === 'lip' ? 0.055 : 0.075)),
        fallHeight: height * (0.72 + cellRand(x + salt, z - salt, 492) * 0.28),
        rotY: cellRand(x + salt, z - salt, 493) * Math.PI,
      });
    }

    function addWaterCubeSpec(specs, dir, across, y, size, salt) {
      const baseScale = size * (0.64 + cellRand(x - salt, z + salt, 432) * 0.24);
      const base = sidePosition(dir, across, y, 0.020 + cellRand(x + salt, z + salt, 433) * 0.035);
      specs.push({
        baseX: base.x,
        baseY: base.y,
        baseZ: base.z,
        baseAcross: across,
        baseScale,
        phase: cellRand(x * 47 + salt, z * 53 - salt, 534),
        speed: (0.72 + cellRand(x - salt, z + salt, 535) * 0.58) * WATERFALL_DROP_CUBE_SPEED,
        drift: 0.045 + cellRand(x + salt, z + salt, 536) * 0.072,
        acrossDrift: sideSpan * (0.045 + cellRand(x - salt, z - salt, 537) * 0.10),
        fallHeight: Math.max(height * (1.22 + cellRand(x + salt, z - salt, 538) * 0.72), 1.85),
        rotX: cellRand(x + salt, z, 541) * Math.PI,
        rotY: cellRand(x, z + salt, 542) * Math.PI,
        rotZ: cellRand(x - salt, z - salt, 543) * Math.PI,
      });
    }

    function addFoamBatch(specs) {
      if (!specs.length) return;
      const mesh = new THREE.InstancedMesh(getWaterfallFoamGeometry(), M.waterfallFoamPuff, specs.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.userData.noShadow = true;
      mesh.userData.waterfall = { kind: 'foamBatch', specs };
      mesh.renderOrder = 8;
      for (let i = 0; i < specs.length; i++) setWaterfallFoamInstanceMatrix(mesh, specs[i], 0, i);
      mesh.instanceMatrix.needsUpdate = true;
      waterfallEffectMeshes.add(mesh);
      g.add(mesh);
    }

    function addCubeBatch(specs) {
      if (!specs.length) return;
      const mesh = new THREE.InstancedMesh(getWaterfallCubeGeometry(), M.waterfallCube, specs.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.userData.noShadow = true;
      mesh.userData.waterfall = { kind: 'cubeBatch', specs };
      mesh.renderOrder = 6;
      for (let i = 0; i < specs.length; i++) setWaterfallCubeInstanceMatrix(mesh, specs[i], 0, i);
      mesh.instanceMatrix.needsUpdate = true;
      waterfallEffectMeshes.add(mesh);
      g.add(mesh);
    }

    function addSide(dir) {
      const seed = dir.charCodeAt(0);
      const curtainBottomY = -DIRT_H - Math.max(WATERFALL_CURTAIN_MIN_DROP, GRID * 0.34);
      const curtainH = Math.max(height + WATERFALL_CURTAIN_EXTRA_DROP, topY - curtainBottomY);
      const foamSpecs = [];
      const cubeSpecs = [];
      placeCurtainSheet(dir, curtainH);
      placeSurfaceSheet(dir, seed);
      const puffCount = 38;
      for (let i = 0; i < puffCount; i++) {
        const r = cellRand(x * 41 + i, z * 43 - i, 520 + seed);
        const across = (-0.54 + i / (puffCount - 1) * 1.08 + (r - 0.5) * 0.060) * sideSpan;
        const lane = i % 2 === 0 || i === 1 || i === puffCount - 2 ? 'lip' : (i % 5 === 0 ? 'splash' : 'fall');
        const y = lane === 'lip'
          ? topY - 0.004 - cellRand(x + i, z - i, 540 + seed) * 0.024
          : lane === 'splash'
            ? bottomY + 0.035 + cellRand(x - i, z + i, 560 + seed) * 0.080
            : topY - height * (0.18 + cellRand(x + i * 3, z + i * 5, 580 + seed) * 0.66);
        const radius = lane === 'splash'
          ? 0.070 + cellRand(x + i, z + i, 590 + seed) * 0.045
          : lane === 'lip'
            ? 0.064 + cellRand(x - i, z + i, 600 + seed) * 0.060
            : 0.042 + cellRand(x - i, z + i, 600 + seed) * 0.045;
        addFoamSpec(foamSpecs, dir, across, y, radius, seed + i * 17, lane);
      }
      for (let i = 0; i < 24; i++) {
        const r = cellRand(x * 59 + i, z * 61 - i, 744 + seed);
        const across = (-0.46 + i / 23 * 0.92 + (r - 0.5) * 0.13) * sideSpan;
        const y = topY - height * (0.12 + cellRand(x + i * 5, z + i * 7, 746 + seed) * 0.92);
        const size = 0.038 + cellRand(x - i, z + i, 748 + seed) * 0.058;
        addWaterCubeSpec(cubeSpecs, dir, across, y, size, seed + i * 31);
      }
      addFoamBatch(foamSpecs);
      addCubeBatch(cubeSpecs);
    }

    if (sides.n) addSide('n');
    if (sides.s) addSide('s');
    if (sides.w) addSide('w');
    if (sides.e) addSide('e');
  }

  const waterfallBatchDummy = new THREE.Object3D();

  function setWaterfallFoamInstanceMatrix(mesh, cfg, t, index) {
    const flow = (t * cfg.speed + cfg.phase) % 1;
    const wave = Math.sin((t * cfg.speed + cfg.phase) * Math.PI * 2);
    const wobble = Math.cos((t * (cfg.speed * 1.37) + cfg.phase * 0.7) * Math.PI * 2);
    const burst = Math.sin((t * (cfg.speed * 1.9) + cfg.phase * 1.3) * Math.PI * 2);
    const fall = cfg.lane === 'fall' ? flow : 0;
    const splashBounce = cfg.lane === 'splash' ? Math.abs(wave) : 0;
    const lipBounce = cfg.lane === 'lip' ? wave * 0.018 : 0;
    const across = cfg.baseAcross + wobble * cfg.acrossDrift + burst * cfg.acrossDrift * 0.42;
    let px, pz;
    if (Math.abs(cfg.baseX) > Math.abs(cfg.baseZ)) {
      px = cfg.baseX + wobble * 0.018;
      pz = across;
    } else {
      px = across;
      pz = cfg.baseZ + wobble * 0.018;
    }
    let py = cfg.baseY - fall * cfg.fallHeight + splashBounce * cfg.drift + lipBounce;
    if (cfg.lane === 'fall' && py < -DIRT_H + 0.030) py += cfg.fallHeight;
    const merge = 1 + Math.max(0, wave) * 0.62 + Math.max(0, burst) * 0.26;
    const s = cfg.baseScale * merge;
    waterfallBatchDummy.position.set(px, py, pz);
    waterfallBatchDummy.rotation.set(0, cfg.rotY || 0, 0);
    waterfallBatchDummy.scale.set(s * (1.12 + wobble * 0.28), s * (0.72 + burst * 0.22), s * (1.04 - wobble * 0.18));
    waterfallBatchDummy.updateMatrix();
    mesh.setMatrixAt(index, waterfallBatchDummy.matrix);
  }

  function setWaterfallCubeInstanceMatrix(mesh, cfg, t, index) {
    const flow = (t * cfg.speed + cfg.phase) % 1;
    const wave = Math.sin((t * cfg.speed + cfg.phase) * Math.PI * 2);
    const wobble = Math.cos((t * (cfg.speed * 1.31) + cfg.phase * 0.7) * Math.PI * 2);
    const across = cfg.baseAcross + wobble * cfg.acrossDrift;
    let px, pz;
    if (Math.abs(cfg.baseX) > Math.abs(cfg.baseZ)) {
      px = cfg.baseX + wave * cfg.drift * 0.45;
      pz = across;
    } else {
      px = across;
      pz = cfg.baseZ + wave * cfg.drift * 0.45;
    }
    let py = cfg.baseY - flow * cfg.fallHeight + Math.max(0, wave) * cfg.drift;
    if (py < -DIRT_H - 1.05) py += cfg.fallHeight;
    const s = cfg.baseScale * (0.88 + Math.max(0, wave) * 0.32);
    waterfallBatchDummy.position.set(px, py, pz);
    waterfallBatchDummy.rotation.set(
      (cfg.rotX || 0) + t * 0.55 * cfg.speed,
      (cfg.rotY || 0) + t * 0.42 * cfg.speed,
      cfg.rotZ || 0
    );
    waterfallBatchDummy.scale.set(s * 1.06, s * 0.86, s);
    waterfallBatchDummy.updateMatrix();
    mesh.setMatrixAt(index, waterfallBatchDummy.matrix);
  }

  function updateWaterfallEffects(t) {
    waterfallTimeUniform.value = t || 0;
    if (!waterfallEffectMeshes.size) return;
    for (const mesh of Array.from(waterfallEffectMeshes)) {
      if (!mesh || !mesh.parent) {
        waterfallEffectMeshes.delete(mesh);
        continue;
      }
      const cfg = mesh.userData && mesh.userData.waterfall;
      if (!cfg) continue;
      if (cfg.kind === 'foamBatch') {
        for (let i = 0; i < cfg.specs.length; i++) setWaterfallFoamInstanceMatrix(mesh, cfg.specs[i], t, i);
        mesh.instanceMatrix.needsUpdate = true;
        continue;
      }
      if (cfg.kind === 'cubeBatch') {
        for (let i = 0; i < cfg.specs.length; i++) setWaterfallCubeInstanceMatrix(mesh, cfg.specs[i], t, i);
        mesh.instanceMatrix.needsUpdate = true;
        continue;
      }
      if (cfg.kind === 'shaderSheet') continue;
      const flow = (t * cfg.speed + cfg.phase) % 1;
      if (cfg.kind === 'surface') {
        const wave = Math.sin((t * cfg.speed + cfg.phase) * Math.PI * 2);
        const slide = (flow - 0.5) * cfg.drift;
        const cross = wave * cfg.drift * 0.38;
        if (cfg.dir === 'n') mesh.position.set(cfg.baseX + cross, cfg.baseY, cfg.baseZ - slide);
        else if (cfg.dir === 's') mesh.position.set(cfg.baseX + cross, cfg.baseY, cfg.baseZ + slide);
        else if (cfg.dir === 'e') mesh.position.set(cfg.baseX + slide, cfg.baseY, cfg.baseZ + cross);
        else mesh.position.set(cfg.baseX - slide, cfg.baseY, cfg.baseZ + cross);
        mesh.scale.set(cfg.baseScaleX * (0.95 + Math.abs(wave) * 0.22), cfg.baseScaleY * (0.82 + flow * 0.42), 1);
        continue;
      }
      if (cfg.kind === 'curtain') {
        const wave = Math.sin((t * cfg.speed + cfg.phase) * Math.PI * 2);
        const shimmer = Math.cos((t * cfg.speed * 1.7 + cfg.phase) * Math.PI * 2);
        const fadeWave = Math.sin((t * cfg.fadeSpeed + cfg.fadePhase) * Math.PI * 2);
        const fade = cfg.tail
          ? 0.64 + Math.max(0, fadeWave) * 0.36
          : 0.82 + Math.max(0, fadeWave) * 0.18;
        const opacity = Math.max(cfg.minOpacity, cfg.baseOpacity * fade);
        mesh.position.y = cfg.baseY - (flow - 0.5) * cfg.drift;
        if (cfg.dir === 'n' || cfg.dir === 's') mesh.position.x = cfg.baseAcross + wave * 0.022;
        else mesh.position.z = cfg.baseAcross + wave * 0.022;
        mesh.scale.set(cfg.baseScaleX * (0.82 + Math.abs(shimmer) * 0.34), cfg.baseScaleY * (0.96 + wave * cfg.lengthPulse), 1);
        setCachedParticleMaterial(mesh, cfg.baseMat || M.waterfall, opacity);
        continue;
      }
      if (cfg.kind === 'foam') {
        const wave = Math.sin((t * cfg.speed + cfg.phase) * Math.PI * 2);
        const wobble = Math.cos((t * (cfg.speed * 1.37) + cfg.phase * 0.7) * Math.PI * 2);
        const burst = Math.sin((t * (cfg.speed * 1.9) + cfg.phase * 1.3) * Math.PI * 2);
        const fall = cfg.lane === 'fall' ? flow : 0;
        const splashBounce = cfg.lane === 'splash' ? Math.abs(wave) : 0;
        const lipBounce = cfg.lane === 'lip' ? wave * 0.018 : 0;
        const across = cfg.baseAcross + wobble * cfg.acrossDrift + burst * cfg.acrossDrift * 0.42;
        if (Math.abs(cfg.baseX) > Math.abs(cfg.baseZ)) {
          mesh.position.x = cfg.baseX + wobble * 0.018;
          mesh.position.z = across;
        } else {
          mesh.position.x = across;
          mesh.position.z = cfg.baseZ + wobble * 0.018;
        }
        mesh.position.y = cfg.baseY - fall * cfg.fallHeight + splashBounce * cfg.drift + lipBounce;
        if (cfg.lane === 'fall' && mesh.position.y < -DIRT_H + 0.030) {
          mesh.position.y += cfg.fallHeight;
        }
        const merge = 1 + Math.max(0, wave) * 0.62 + Math.max(0, burst) * 0.26;
        const s = cfg.baseScale * merge;
        mesh.scale.set(s * (1.12 + wobble * 0.28), s * (0.72 + burst * 0.22), s * (1.04 - wobble * 0.18));
        continue;
      }
      if (cfg.kind === 'cube') {
        const wave = Math.sin((t * cfg.speed + cfg.phase) * Math.PI * 2);
        const wobble = Math.cos((t * (cfg.speed * 1.31) + cfg.phase * 0.7) * Math.PI * 2);
        const across = cfg.baseAcross + wobble * cfg.acrossDrift;
        if (Math.abs(cfg.baseX) > Math.abs(cfg.baseZ)) {
          mesh.position.x = cfg.baseX + wave * cfg.drift * 0.45;
          mesh.position.z = across;
        } else {
          mesh.position.x = across;
          mesh.position.z = cfg.baseZ + wave * cfg.drift * 0.45;
        }
        mesh.position.y = cfg.baseY - flow * cfg.fallHeight + Math.max(0, wave) * cfg.drift;
        if (mesh.position.y < -DIRT_H - 1.05) mesh.position.y += cfg.fallHeight;
        mesh.rotation.x += 0.55 * cfg.speed * 0.016;
        mesh.rotation.y += 0.42 * cfg.speed * 0.016;
        const s = cfg.baseScale * (0.88 + Math.max(0, wave) * 0.32);
        mesh.scale.set(s * 1.06, s * 0.86, s);
        continue;
      }
      mesh.position.y = cfg.baseY - (flow - 0.5) * cfg.drift;
      mesh.scale.y = cfg.baseScaleY * (0.96 + Math.sin((flow + cfg.phase) * Math.PI * 2) * 0.035);
    }
  }

  function serializeCell(x, z, c) {
    const f = c.floors || 1;
    const tf = terrainLevelForCell(c);
    const bt = c.buildingType || null;
    const fs = c.fenceSide || null;
    const extras = (c.extras && c.extras.length) ? c.extras.map(e => {
      const extra = { k: e.kind, s: e.fenceSide || null, f: e.floors || 1 };
      const appearance = normalizeAppearance(e.appearance);
      if (appearance) extra.appearance = appearance;
      return extra;
    }) : null;
    const ry = c.rotationY || 0;
    const ox = c.offsetX || 0;
    const oz = c.offsetZ || 0;
    const oy = c.offsetY || 0;
    const hasTransform = ry || ox || oz || oy;
    const appearance = normalizeAppearance(c.appearance);
    const wf = normalizeWaterFlow(c.waterFlow);
    const dig = cellDigDepth(c);
    const vox = normalizeVoxels(c.voxels);
    if (c.terrain !== 'grass' || c.kind || f !== 1 || tf !== 1 || bt || fs || extras || hasTransform || appearance || wf !== 'auto' || dig || vox) {
      const out = [x, z, c.terrain, c.kind, f, bt, tf, fs];
      // Always push extras (or null) before the transform / appearance so
      // tuple positions stay stable. Transform is [ry, ox, oz, oy].
      // `dig` (excavation depth) then `voxels` (per-tile sculpt heightmap) are
      // the last optional slots, so when a later one is present every earlier
      // optional slot is materialised to keep the array-parser positions stable.
      out.push(extras || null);
      out.push(hasTransform ? [ry, ox, oz, oy] : null);
      if (appearance || wf !== 'auto' || dig || vox) out.push(appearance || null);
      if (wf !== 'auto' || dig || vox) out.push(wf);
      if (dig || vox) out.push(dig);
      if (vox) out.push(vox);
      return out;
    }
    return null;
  }
