  // -------- undo / redo history --------
  const WORLD_HISTORY_LIMIT = 60;
  const WORLD_HISTORY_BATCH_MS = 450;
  const worldUndoStack = [];
  const worldRedoStack = [];
  let worldHistoryReady = false;
  let worldHistoryApplying = false;
  let worldHistoryMuted = false;
  let worldHistoryBatchTimer = 0;
  let worldHistoryBatchOpen = false;

  function snapshotWorldStateForHistory() {
    const cells = [];
    for (const xKey of Object.keys(world)) {
      const x = parseInt(xKey, 10);
      if (!Number.isFinite(x)) continue;
      const row = world[xKey];
      if (!row) continue;
      const insideHomeX = x >= 0 && x < GRID;
      for (const zKey of Object.keys(row)) {
        const z = parseInt(zKey, 10);
        if (!Number.isFinite(z)) continue;
        const c = row[zKey];
        if (!c) continue;
        const insideHome = insideHomeX && z >= 0 && z < GRID;
        if (!insideHome && !c.userEdited) continue;
        const entry = serializeCell(x, z, c);
        if (entry) cells.push(entry);
      }
    }
    return {
      v: STORAGE_VERSION,
      gridSize: GRID,
      islands: serializeEditableIslands(),
      moorings: serializeMooringCables(),
      cells,
      cameraMode,
      toolId: selectedTool && selectedTool.id,
      useLandscapeEngine,
      landscapeMeshMode,
      landscapeMeshBiome,
      landscapeMeshStyle,
      landscapeEngineSeed: landscapeEngineInstance ? landscapeEngineInstance.seed : null,
      landscapeEngineBiome: landscapeEngineInstance ? landscapeEngineInstance.currentBiomeName : null,
      planetLandscape: serializePlanetLandscapeState(),
    };
  }

  function worldHistorySignature(snapshot) {
    try {
      return JSON.stringify({
        cells: snapshot && snapshot.cells ? snapshot.cells : [],
        islands: snapshot && snapshot.islands ? snapshot.islands : [],
        moorings: snapshot && snapshot.moorings ? snapshot.moorings : [],
      });
    }
    catch (_) { return ''; }
  }

  function refreshWorldHistoryUI() {
    window.dispatchEvent(new CustomEvent('tinyworld:history-changed', {
      detail: { canUndo: worldUndoStack.length > 0, canRedo: worldRedoStack.length > 0 },
    }));
  }

  function closeWorldHistoryBatchSoon() {
    if (worldHistoryBatchTimer) clearTimeout(worldHistoryBatchTimer);
    worldHistoryBatchTimer = setTimeout(() => {
      worldHistoryBatchOpen = false;
      worldHistoryBatchTimer = 0;
    }, WORLD_HISTORY_BATCH_MS);
  }

  function pushWorldHistorySnapshot() {
    if (!worldHistoryReady || worldHistoryApplying || worldHistoryMuted || suppressSave) return false;
    if (worldHistoryBatchOpen) {
      closeWorldHistoryBatchSoon();
      return false;
    }
    const snapshot = snapshotWorldStateForHistory();
    const sig = worldHistorySignature(snapshot);
    const last = worldUndoStack[worldUndoStack.length - 1];
    if (last && last.sig === sig) {
      worldHistoryBatchOpen = true;
      closeWorldHistoryBatchSoon();
      return false;
    }
    worldUndoStack.push({ snapshot, sig });
    if (worldUndoStack.length > WORLD_HISTORY_LIMIT) worldUndoStack.shift();
    worldRedoStack.length = 0;
    worldHistoryBatchOpen = true;
    closeWorldHistoryBatchSoon();
    refreshWorldHistoryUI();
    return true;
  }

  function withWorldHistoryMuted(fn) {
    worldHistoryMuted = true;
    try { return fn(); }
    finally { worldHistoryMuted = false; }
  }

  function restoreWorldHistorySnapshot(entry) {
    if (!entry || !entry.snapshot) return false;
    worldHistoryApplying = true;
    if (worldHistoryBatchTimer) clearTimeout(worldHistoryBatchTimer);
    worldHistoryBatchTimer = 0;
    worldHistoryBatchOpen = false;
    const finish = () => {
      worldHistoryApplying = false;
      if (typeof notifySelectionChanged === 'function') notifySelectionChanged();
      refreshWorldHistoryUI();
    };
    const ok = applyState(entry.snapshot, { keepCamera: true, onDone: finish });
    if (!ok) finish();
    return ok;
  }

  function undoWorldEdit() {
    if (!worldUndoStack.length || worldHistoryApplying) return false;
    const current = snapshotWorldStateForHistory();
    const currentSig = worldHistorySignature(current);
    const previous = worldUndoStack.pop();
    worldRedoStack.push({ snapshot: current, sig: currentSig });
    if (worldRedoStack.length > WORLD_HISTORY_LIMIT) worldRedoStack.shift();
    return restoreWorldHistorySnapshot(previous);
  }

  function redoWorldEdit() {
    if (!worldRedoStack.length || worldHistoryApplying) return false;
    const current = snapshotWorldStateForHistory();
    const currentSig = worldHistorySignature(current);
    const next = worldRedoStack.pop();
    worldUndoStack.push({ snapshot: current, sig: currentSig });
    if (worldUndoStack.length > WORLD_HISTORY_LIMIT) worldUndoStack.shift();
    return restoreWorldHistorySnapshot(next);
  }

  function makeTile(terrain, neighbors, x = 0, z = 0, level = 1, opts = {}) {
    const g = new THREE.Group();
    g.userData = { kind: 'tile', terrain };
    const pathN = (neighbors && neighbors.path) || { n: false, s: false, e: false, w: false };
    const terrainN = (neighbors && neighbors.terrain) || { n: null, s: null, e: null, w: null };
    // Riser side-culling. A side faces a same-or-higher-level neighbour →
    // hidden by that neighbour's own riser, drop it. `levels.<dir>` is
    // `null` when there is no rendered neighbour in that direction; we then
    // keep the side so home-grid edges and ghost-board boundaries still
    // show their proper dirt cliffs. Convention: n = -z, s = +z, e = +x,
    // w = -x (matches getPathNeighbors / getTerrainNeighbors).
    const levelN = (neighbors && neighbors.levels) || { n: null, s: null, e: null, w: null };
    function hideSide(lv, dir) {
      if (typeof lv !== 'number' || lv < level) return false;
      const neighborTerrain = terrainN[dir];
      // Same terrain OR same hard-ground family (path/stone) → the shared riser
      // is hidden so adjacent stone/path cells form one continuous surface.
      const sameFamily = (typeof sameTerrainEdgeFamily === 'function')
        ? sameTerrainEdgeFamily(neighborTerrain, terrain)
        : neighborTerrain === terrain;
      if (!sameFamily) return false;
      return true;
    }
    const skipE = hideSide(levelN.e, 'e');
    const skipW = hideSide(levelN.w, 'w');
    const skipS = hideSide(levelN.s, 's');
    const skipN = hideSide(levelN.n, 'n');
    const rise = terrainRiseForLevel(level);
    const terrainOffset = terrainSurfaceOffset(terrain);
    const kerbDrop = Math.abs(Math.min(0, terrainOffset));
    const visualRise = rise + terrainOffset;
    const positiveTerrainOffset = Math.max(0, terrainOffset);
    const riserHeight = DIRT_H + rise + positiveTerrainOffset;
    const topY = visualRise + TOP_H;
    // Weather impact decals sit above the rounded/beveled slab, not at the
    // mathematical tile height, otherwise rain ripples and snow buildup hide
    // inside the top face at grazing camera angles.
    g.userData.weatherSurfaceY = topY + WEATHER_SURFACE_PAD;
    // Walkable top of the terrain cap, in the tile group's LOCAL frame. The tile
    // group's bounding box also encloses decorative edge weeds, kerb strips, and
    // cap bevels that poke ABOVE this surface — using that box for avatar ground
    // height made avatars bob up/down over "nothing". tileSurfaceWorldY() prefers
    // this recorded value.
    g.userData.surfaceY = topY;

    const skipTerrain = !!(opts && opts.skipTerrain);
    const skipSurfaceDetails = !!(opts && opts.skipSurfaceDetails);
    const useVoxelTerrainForTile = renderVoxelTerrain && !(opts && opts.simpleTerrain);

    // Dirt / riser block (sides + bottom of tile). Terrain tile geometry must
    // stay inside its logical cell footprint: no x/z overhang into neighbours,
    // and every terrain top/body uses the same TILE bounds.
    //
    // Hidden faces are stripped at geometry-build time: risers drop top/bottom
    // faces, caps/panels drop bottoms, and same-or-higher neighbours hide shared
    // side faces. FrontSide materials handle normal back-face culling on the
    // remaining visible faces.
    if (!skipTerrain) {
      let riserSize = TILE;
      let topSize   = TILE;
      let riserBevel = 0.04;
      let topBevel   = 0.06;

      if (terrain === 'grass' || terrain === 'path' || terrain === 'stone' || terrain === 'water') {
        // Keep the physical tile look through materials/details, not by
        // expanding the cap/body beyond the cell.
        riserSize  = TILE;
        topSize    = TILE;
        riserBevel = 0.02;
        topBevel   = 0.04;
      }

      const hasVisibleRiser = !(skipE && skipW && skipS && skipN);
      if (hasVisibleRiser) {
        const riserMat = terrainRiserMaterial(terrain);
        if (useVoxelTerrainForTile) {
          addVoxelTerrainRiserBacking(g, terrain, riserSize, DIRT_H + rise + positiveTerrainOffset, {
            e: skipE,
            w: skipW,
            s: skipS,
            n: skipN,
          });
          const bottom = new THREE.Mesh(getOpenBoxGeometry(riserSize, 0.012, riserSize, false, true, true, true, true, true), riserMat);
          bottom.position.y = -DIRT_H - 0.006;
          bottom.userData.noShadow = true;
          g.add(bottom);
        } else {
          const riserGeo = getOpenBoxGeometry(riserSize, riserHeight, riserSize, true, true, skipE, skipW, skipS, skipN);
          const riser = new THREE.Mesh(riserGeo, riserMat);
          riser.position.y = -DIRT_H + riserHeight * 0.5;
          riser.userData.noReceiveShadow = true;
          g.add(riser);
          const bottom = new THREE.Mesh(getOpenBoxGeometry(riserSize, 0.012, riserSize, false, true, true, true, true, true), riserMat);
          bottom.position.y = -DIRT_H - 0.006;
          bottom.userData.noShadow = true;
          g.add(bottom);
        }
      }

      let topMat = M.grass;
      if (terrain === 'path')  topMat = M.path;
      if (terrain === 'water') {
        const flow = waterFlowVectorForCell(x, z, terrainN);
        const waterMat = typeof terrainCellVariantMaterial === 'function'
          ? terrainCellVariantMaterial(M.water, 'water', 'water', x, z, 2)
          : M.water;
        topMat = waterFlowMaterial(waterMat, flow.dx, flow.dz);
      }
      if (terrain === 'dirt')  topMat = M.dirtRich;
      if (terrain === 'stone') topMat = M.stone;
      if (terrain === 'lava')  topMat = M.lava;
      if (terrain === 'sand')  topMat = M.sand;
      if (terrain === 'snow')  topMat = M.snow;
      if (terrain !== 'water' && typeof terrainCellVariantMaterial === 'function') {
        topMat = terrainCellVariantMaterial(topMat, terrain, terrain, x, z, 6);
      }

      // One whole logical tile panel: no artificial gaps inside a cell. The
      // voxel resolution belongs to objects/stamps; terrain/path cells must
      // still read as full panels aligned to the board grid.
      const seamOverlap = 0;
      const topHeight = TOP_H + seamOverlap;
      if (useVoxelTerrainForTile) {
        addVoxelTerrainTop(g, terrain, x, z, visualRise - seamOverlap * 0.5, topSize, topHeight, pathN, terrainN, {
          e: skipE,
          w: skipW,
          s: skipS,
          n: skipN,
        }, skipSurfaceDetails);
      } else {
        const topGeo = getOpenBoxGeometry(topSize, topHeight, topSize, false, true, skipE, skipW, skipS, skipN);
        const top = new THREE.Mesh(topGeo, topMat);
        top.position.y = visualRise + TOP_H * 0.5 - seamOverlap * 0.5;
        g.add(top);

        // Add a tiny bevel-like highlight only on the exposed outer cap edges.
        // This recreates the old softened slab edge/corner read without putting
        // diagonal bevel triangles across every tile top.
        const bevelMat = terrain === 'grass' ? M.grassHi : topMat;
        const bw = 0.045;
        const bh = 0.020;
        const bevelY = topY + 0.002;
        function addCapBevel(dir) {
          const alongX = dir === 'n' || dir === 's';
          const geo = alongX
            ? getBoxGeometry(topSize - bw * 1.5, bh, bw)
            : getBoxGeometry(bw, bh, topSize - bw * 1.5);
          const b = new THREE.Mesh(geo, bevelMat);
          const off = topSize * 0.5 - bw * 0.5;
          if (dir === 'n') b.position.set(0, bevelY, -off);
          if (dir === 's') b.position.set(0, bevelY,  off);
          if (dir === 'w') b.position.set(-off, bevelY, 0);
          if (dir === 'e') b.position.set( off, bevelY, 0);
          g.add(b);
        }
        function addCapCorner(xSign, zSign) {
          const c = new THREE.Mesh(getBoxGeometry(bw, bh, bw), bevelMat);
          c.position.set(xSign * (topSize * 0.5 - bw * 0.5), bevelY, zSign * (topSize * 0.5 - bw * 0.5));
          g.add(c);
        }
        if (!kerbDrop) {
          if (!skipN) addCapBevel('n');
          if (!skipS) addCapBevel('s');
          if (!skipW) addCapBevel('w');
          if (!skipE) addCapBevel('e');
          if (!skipN && !skipW) addCapCorner(-1, -1);
          if (!skipN && !skipE) addCapCorner( 1, -1);
          if (!skipS && !skipW) addCapCorner(-1,  1);
          if (!skipS && !skipE) addCapCorner( 1,  1);
        }
      }
      addHeavyTerrainKerbStrips(g, terrain, x, z, terrainN, topSize, topY);
      const waterfallSides = terrain === 'water' ? {
        e: !skipE && (typeof levelN.e !== 'number' || levelN.e < level),
        w: !skipW && (typeof levelN.w !== 'number' || levelN.w < level),
        s: !skipS && (typeof levelN.s !== 'number' || levelN.s < level),
        n: !skipN && (typeof levelN.n !== 'number' || levelN.n < level),
      } : null;
      addSunkenWaterRimStrips(g, terrain, x, z, terrainN, topSize, topY, waterfallSides);
      addSurfaceEdgeWeeds(g, terrain, x, z, terrainN, topSize, topY);
      if (terrain === 'water') {
        addWaterfallRiserEffects(g, x, z, riserSize, topY - 0.018, waterfallSides);
      }
    }

    // Keep terrain surfaces as single clean slabs. Previous decorative
    // micro-geometry here (grass flecks, shore strips, water ripple lines,
    // water insets, path trim bands, pavers, and scuffs) became visible as
    // chunky rectangular panels under pixel rendering.

    if (opts && opts.simpleTerrain) {
      g.traverse(c => {
        if (!c.isMesh) return;
        c.castShadow = false;
        c.receiveShadow = !(c.userData && c.userData.noShadow);
        c.frustumCulled = true;
      });
    } else {
      castReceive(g);
    }
    return g;
  }

  // -------- tile surface height --------
  // World-space Y of a tile's walkable cap. A tile group's bounding box also
  // encloses decorative edge weeds, kerb strips, and cap bevels that stick UP
  // above the cap, so using box.max.y as ground height makes avatars ride on
  // top of those decorations and bob up/down between cells. Prefer the recorded
  // cap height (userData.surfaceY, local) projected through the tile's world
  // matrix; fall back to the bounding box for tiles without it (e.g. baked).
  const _tileSurfaceVec = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
  const _tileSurfaceBox = (typeof THREE !== 'undefined') ? new THREE.Box3() : null;
  function tileSurfaceWorldY(tile) {
    if (!tile) return null;
    if (tile.userData && typeof tile.userData.surfaceY === 'number' && _tileSurfaceVec) {
      tile.updateWorldMatrix(true, false);
      _tileSurfaceVec.set(0, tile.userData.surfaceY, 0).applyMatrix4(tile.matrixWorld);
      if (isFinite(_tileSurfaceVec.y)) return _tileSurfaceVec.y;
    }
    if (_tileSurfaceBox) {
      _tileSurfaceBox.setFromObject(tile);
      if (isFinite(_tileSurfaceBox.max.y)) return _tileSurfaceBox.max.y;
    }
    return null;
  }

  // -------- object factories --------
  function makeTree(level = 1, seedX = 0, seedZ = 0) {
    const L = Math.max(1, Math.min(MAX_FLOORS, level));
    const g = new THREE.Group();
    const leanX = (cellRand(seedX, seedZ, 1010) - 0.5) * 0.12;
    const leanZ = (cellRand(seedX, seedZ, 1020) - 0.5) * 0.12;

    // Trunk grows in both height and thickness with level.
    const trunkH = 0.5 + (L - 1) * 0.12;
    const trunkW = 0.18 + (L - 1) * 0.018;
    const trunk = new THREE.Mesh(getBoxGeometry(trunkW, trunkH, trunkW), M.trunk);
    trunk.position.y = trunkH / 2;
    trunk.rotation.z = leanX * 0.18;
    trunk.rotation.x = -leanZ * 0.18;
    g.add(trunk);

    const branchCount = 2 + (L >= 4 ? 1 : 0);
    for (let i = 0; i < branchCount; i++) {
      const angle = cellRand(seedX + i, seedZ - i, 1030) * Math.PI * 2;
      const len = 0.16 + cellRand(seedX - i, seedZ + i, 1040) * 0.11;
      const branch = new THREE.Mesh(getBoxGeometry(0.050, 0.045, len), M.trunk);
      branch.position.set(
        Math.cos(angle) * len * 0.42,
        trunkH * (0.45 + i * 0.12),
        Math.sin(angle) * len * 0.42
      );
      branch.rotation.y = angle;
      g.add(branch);
    }

    // Lower canopy.
    const lowerW = 0.62 + (L - 1) * 0.06;
    const lowerH = 0.42 + (L - 1) * 0.04;
    const lower = new THREE.Mesh(roundedBox(lowerW, lowerH, lowerW, 0.08), M.leaves);
    const lowerY = trunkH + lowerH * 0.5 - 0.08;
    lower.position.set(leanX * 0.45, lowerY, leanZ * 0.45);
    g.add(lower);

    // Upper canopy.
    const upperW = 0.42 + (L - 1) * 0.04;
    const upperH = 0.32 + (L - 1) * 0.03;
    const upper = new THREE.Mesh(roundedBox(upperW, upperH, upperW, 0.06), M.leaves);
    const upperY = lowerY + lowerH * 0.5 + upperH * 0.5 - 0.05;
    upper.position.set(leanX, upperY, leanZ);
    g.add(upper);

    for (let i = 0; i < 3; i++) {
      const angle = cellRand(seedX + i, seedZ + i, 1050) * Math.PI * 2;
      const r = 0.18 + cellRand(seedX - i, seedZ + i, 1060) * 0.11;
      const s = 0.11 + cellRand(seedX + i, seedZ - i, 1070) * 0.055;
      const leaf = new THREE.Mesh(roundedBox(s, s * 0.82, s, 0.035), i % 2 ? M.leavesDk : M.grassHi);
      leaf.position.set(leanX * 0.55 + Math.cos(angle) * r, lowerY + 0.05 + i * 0.035, leanZ * 0.55 + Math.sin(angle) * r);
      g.add(leaf);
    }

    // At higher levels swap the wispy tip for a denser darker crown.
    if (L >= 3 && showCrowns) {
      const crown = new THREE.Mesh(roundedBox(0.30 + (L - 3) * 0.04, 0.28 + (L - 3) * 0.04, 0.30 + (L - 3) * 0.04, 0.06), M.leavesDk);
      crown.position.set(leanX * 1.2, upperY + upperH * 0.5 + 0.14, leanZ * 1.2);
      g.add(crown);
    } else {
      const tip = new THREE.Mesh(roundedBox(0.22, 0.18, 0.22, 0.04), M.leaves);
      tip.position.set(leanX * 1.2, upperY + upperH * 0.5 + 0.09, leanZ * 1.2);
      g.add(tip);
    }

    // Big, mature trees grow side bushes around the upper canopy for a
    // fuller silhouette.
    if (L >= 5) {
      const bushCount = L >= 7 ? 5 : (L >= 6 ? 4 : 3);
      for (let i = 0; i < bushCount; i++) {
        const ang = (i / bushCount) * Math.PI * 2;
        const r = 0.20 + (L - 5) * 0.04;
        const bw = 0.26 + (L - 5) * 0.04;
        const bh = 0.22 + (L - 5) * 0.03;
        const bush = new THREE.Mesh(roundedBox(bw, bh, bw, 0.05), i % 2 ? M.leaves : M.leavesDk);
        bush.position.set(Math.cos(ang) * r, lowerY + 0.10, Math.sin(ang) * r);
        g.add(bush);
      }
    }

    g.userData = { kind: 'tree', swayPhase: Math.random() * Math.PI * 2 };
    castReceive(g);
    return g;
  }

  function countNeighbors(n) {
    return (n.n ? 1 : 0) + (n.s ? 1 : 0) + (n.e ? 1 : 0) + (n.w ? 1 : 0);
  }

  function makeOreRock(neighbors, level = 1, seedX = 0, seedZ = 0, inWater = false, opts = {}, ore = null) {
    const mats = ore || (typeof tinyworldOreMaterialsFor === 'function' ? tinyworldOreMaterialsFor(opts && opts.appearance) : null);
    const g = makeRock(neighbors, level, seedX, seedZ, inWater, Object.assign({}, opts, { appearance: null }));
    const n = neighbors || { n: false, s: false, e: false, w: false };
    const links = countNeighbors(n);
    const extra = Math.max(0, Math.min(MAX_FLOORS, level || 1) - 1);
    const sink = inWater ? 0.07 : 0;
    const jitter = salt => cellRand(seedX, seedZ, 880 + salt) - 0.5;
    function oreCube(w, h, d, x, y, z, mat, salt) {
      const mesh = new THREE.Mesh(roundedBox(w, h, d, 0.018), mat);
      mesh.position.set(x, y - sink, z);
      mesh.rotation.set(jitter(salt) * 0.12, cellRand(seedX, seedZ, 900 + salt) * Math.PI * 0.5, jitter(salt + 1) * 0.12);
      g.add(mesh);
      return mesh;
    }
    const grow = 1 + extra * 0.035 + links * 0.012;
    oreCube(0.14 * grow, 0.050 + extra * 0.004, 0.12 * grow, -0.18, 0.26 + extra * 0.014, 0.02, mats.body, 1);
    oreCube(0.11 * grow, 0.045 + extra * 0.004, 0.10 * grow, 0.18, 0.24 + extra * 0.012, -0.12, mats.dark, 3);
    oreCube(0.10 * grow, 0.040 + extra * 0.004, 0.12 * grow, 0.04, 0.39 + extra * 0.014, 0.20, mats.body, 5);
    if (links >= 2) oreCube(0.095 * grow, 0.038, 0.090 * grow, -0.02, 0.46 + extra * 0.014, -0.08, mats.dark, 7);
    if (n.n) oreCube(0.10, 0.034, 0.08, 0, 0.10 + extra * 0.006, -0.38, mats.dark, 11);
    if (n.s) oreCube(0.10, 0.034, 0.08, 0, 0.10 + extra * 0.006, 0.38, mats.dark, 12);
    if (n.e) oreCube(0.08, 0.034, 0.10, 0.38, 0.10 + extra * 0.006, 0, mats.dark, 13);
    if (n.w) oreCube(0.08, 0.034, 0.10, -0.38, 0.10 + extra * 0.006, 0, mats.dark, 14);
    g.userData = Object.assign(g.userData || {}, { kind: 'rock', oreMetal: mats.id, neighborCount: links });
    castReceive(g);
    return g;
  }

  function makeRock(neighbors, level = 1, seedX = 0, seedZ = 0, inWater = false, opts = {}) {
    const ore = typeof tinyworldOreMaterialsFor === 'function' ? tinyworldOreMaterialsFor(opts && opts.appearance) : null;
    if (ore) return makeOreRock(neighbors, level, seedX, seedZ, inWater, opts, ore);
    const g = new THREE.Group();
    if (inWater) {
      // Rocks dropped in water sink slightly and get a darker ring
      // where they break the surface. The whole group is offset down
      // so the stones sit lower; the ring stays at tile-top y = 0.
      g.userData.waterSunk = true;
      const sink = 0.07;
      g.position.y -= 0; // ring math runs in local space below
      const ringInner = 0.18;
      const ringOuter = 0.46;
      const ringGeo = new THREE.RingGeometry(ringInner, ringOuter, 18);
      const ringMat = new THREE.MeshLambertMaterial({ color: 0x1c4a78, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.002; // just above tile top so it doesn't z-fight
      g.add(ring);
      // Shift the actual stone subgroup down so they appear partly submerged.
      g.userData.waterSinkY = sink;
    }
    const n = neighbors || { n: false, s: false, e: false, w: false };
    const links = countNeighbors(n);
    const extra = Math.max(0, Math.min(MAX_FLOORS, level || 1) - 1);
    const jitter = salt => cellRand(seedX, seedZ, 300 + salt) - 0.5;
    const grow = 1 + extra * 0.075;
    const stones = [
      { x: -0.12 + jitter(1) * 0.12, z:  0.04 + jitter(2) * 0.10, r: 0.27 + links * 0.014 + extra * 0.026, sy: 0.56 + links * 0.025 + extra * 0.040, mat: M.rock,   ry: 0.2 + jitter(3) * 0.9 },
      { x:  0.18 + jitter(4) * 0.14, z: -0.09 + jitter(5) * 0.12, r: 0.19 + links * 0.010 + extra * 0.020, sy: 0.66 + links * 0.022 + extra * 0.035, mat: M.rockDk, ry: 1.1 + jitter(6) * 0.9 },
      { x:  0.02 + jitter(7) * 0.14, z:  0.23 + jitter(8) * 0.12, r: 0.13 + links * 0.008 + extra * 0.014, sy: 0.54 + links * 0.020 + extra * 0.025, mat: M.rockHi, ry: 2.4 + jitter(9) * 0.9 },
    ];
    stones.forEach(s => {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s.r, 0), s.mat);
      m.scale.set(1.05 + jitter(10) * 0.10, s.sy, 0.86 + jitter(11) * 0.12);
      m.position.set(s.x, s.r * s.sy, s.z);
      m.rotation.set(-0.12 + jitter(12) * 0.18, s.ry, 0.08 + jitter(13) * 0.16);
      g.add(m);
    });

    function sideLevel(dir) {
      return typeof n[dir] === 'number' ? n[dir] : (n[dir] ? 1 : 0);
    }

    function addOutcrop(dir) {
      const alongX = dir === 'n' || dir === 's';
      const sideExtra = Math.max(0, sideLevel(dir) - 1);
      const sideGrow = 1 + (extra + sideExtra) * 0.045;
      const foot = new THREE.Mesh(
        roundedBox((alongX ? 0.42 : 0.26) * sideGrow, 0.07 + (extra + sideExtra) * 0.006, (alongX ? 0.26 : 0.42) * sideGrow, 0.03),
        M.rockDk
      );
      foot.position.set(
        (dir === 'w' ? -0.31 : dir === 'e' ? 0.31 : 0) + jitter(dir.charCodeAt(0)) * 0.08,
        0.03 + extra * 0.006,
        (dir === 'n' ? -0.31 : dir === 's' ? 0.31 : 0) + jitter(dir.charCodeAt(0) + 1) * 0.08
      );
      foot.rotation.set(0.04, alongX ? 0.18 : -0.22, dir === 'e' || dir === 's' ? 0.04 : -0.03);
      g.add(foot);

      const shelf = new THREE.Mesh(
        new THREE.BoxGeometry((alongX ? 0.48 : 0.34) * sideGrow, 0.16 + (extra + sideExtra) * 0.010, (alongX ? 0.36 : 0.48) * sideGrow),
        dir === 'n' || dir === 'w' ? M.rockDk : M.rock
      );
      shelf.position.set(
        dir === 'w' ? -0.36 : dir === 'e' ? 0.36 : 0,
        0.09 + (extra + sideExtra) * 0.009,
        dir === 'n' ? -0.36 : dir === 's' ? 0.36 : 0
      );
      shelf.rotation.set(0.08, alongX ? 0.18 : -0.22, dir === 'e' || dir === 's' ? 0.06 : -0.04);
      g.add(shelf);

      if (showCrowns) {
        const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + (extra + sideExtra) * 0.007, 0), dir === 'e' || dir === 'n' ? M.rockHi : M.rockDk);
        crown.scale.set(1.10 + jitter(30) * 0.18, 0.60 + (extra + sideExtra) * 0.024, 0.90 + jitter(31) * 0.18);
        crown.position.set(
          dir === 'w' ? -0.39 : dir === 'e' ? 0.39 : (dir === 'n' ? -0.10 : 0.10),
          0.20 + (extra + sideExtra) * 0.014,
          dir === 'n' ? -0.39 : dir === 's' ? 0.39 : (dir === 'w' ? 0.10 : -0.10)
        );
        crown.rotation.y = dir === 'n' ? 0.8 : dir === 's' ? -0.4 : dir === 'e' ? 1.6 : -1.1;
        g.add(crown);
      }
    }
    if (n.n) addOutcrop('n');
    if (n.s) addOutcrop('s');
    if (n.e) addOutcrop('e');
    if (n.w) addOutcrop('w');

    if (links >= 2) {
      const spine = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18 + links * 0.018, 0), M.rockDk);
      spine.scale.set(n.e || n.w ? 1.25 + extra * 0.05 : 0.90, 1.00 + links * 0.08 + extra * 0.08, n.n || n.s ? 1.25 + extra * 0.05 : 0.90);
      spine.position.set(0.02 + jitter(40) * 0.08, 0.32 + links * 0.030 + extra * 0.030, -0.02 + jitter(41) * 0.08);
      spine.rotation.set(-0.18, 0.7, 0.10);
      g.add(spine);
    }
    if (links >= 3) {
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.38, 5), M.rockHi);
      shard.position.set(-0.08, 0.62, 0.06);
      shard.rotation.set(0.18, 0.55, -0.10);
      g.add(shard);
    }
    if (links >= 4) {
      const moss = new THREE.Mesh(getBoxGeometry(0.34, 0.018, 0.22), M.rockMoss);
      moss.position.set(0.03, 0.50, -0.08);
      moss.rotation.y = -0.35;
      g.add(moss);
    }
    for (let i = 0; i < Math.min(extra, 5); i++) {
      const a = i * 1.73 + cellRand(seedX, seedZ, 460 + i) * 0.8;
      const radius = 0.24 + cellRand(seedX, seedZ, 480 + i) * (0.18 + extra * 0.015);
      const chip = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.055 + cellRand(seedX, seedZ, 500 + i) * 0.045 + extra * 0.004, 0),
        i % 3 === 0 ? M.rockHi : (i % 3 === 1 ? M.rockDk : M.rock)
      );
      chip.scale.set(1.10 + jitter(520 + i) * 0.35, 0.45 + jitter(540 + i) * 0.18, 0.85 + jitter(560 + i) * 0.30);
      chip.position.set(Math.cos(a) * radius, 0.035 + i * 0.006, Math.sin(a) * radius);
      chip.rotation.set(jitter(580 + i) * 0.5, a, jitter(600 + i) * 0.5);
      g.add(chip);
    }

    // Water rocks: sink every mesh (except the ring marker on top of
    // the water surface) by waterSinkY so they appear partly submerged.
    if (g.userData && g.userData.waterSunk) {
      const sink = g.userData.waterSinkY || 0.07;
      for (const child of g.children) {
        if (child.geometry && child.geometry.type === 'RingGeometry') continue;
        child.position.y -= sink;
      }
    }

    g.userData = Object.assign(g.userData || {}, { kind: 'rock', neighborCount: links });
    castReceive(g);
    return g;
  }

  // Bridge evolves with stacked clicks (cell.floors):
  //   L1 wood plank → L2 covered wood → L3 stone flat → L4 stone arch.
  // Higher levels clamp to the stone arch (visually maxed out).
  function makeBridgeWoodPlank() {
    const g = new THREE.Group();
    const deckY = 0.09;
    for (let i = -2; i <= 2; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.08), M.bridgeWood);
      plank.position.set(0, deckY, i * 0.10);
      plank.rotation.z = i % 2 === 0 ? 0.018 : -0.012;
      g.add(plank);
    }
    for (const z of [-0.31, 0.31]) {
      const rail = new THREE.Mesh(getBoxGeometry(0.96, 0.08, 0.05), M.bridgeWoodD);
      rail.position.set(0, deckY + 0.11, z);
      g.add(rail);
      const postGeo = getBoxGeometry(0.05, 0.22, 0.05);
      for (const x of [-0.36, 0, 0.36]) {
        const post = new THREE.Mesh(postGeo, M.bridgeWoodD);
        post.position.set(x, deckY + 0.03, z);
        g.add(post);
      }
    }
    const shadow = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.035, 0.50), M.bridgeWoodD);
    shadow.position.y = 0.025;
    g.add(shadow);
    return g;
  }

  function makeBridgeCoveredWood() {
    const g = new THREE.Group();
    const deckY = 0.09;
    // Deck planks
    for (let i = -2; i <= 2; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.08), M.bridgeWood);
      plank.position.set(0, deckY, i * 0.10);
      g.add(plank);
    }
    // Low side walls
    for (const z of [-0.32, 0.32]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.28, 0.05), M.bridgeWoodD);
      wall.position.set(0, deckY + 0.17, z);
      g.add(wall);
    }
    // Corner posts under the eaves
    const tallPost = getBoxGeometry(0.05, 0.46, 0.05);
    for (const x of [-0.44, 0.44]) {
      for (const z of [-0.32, 0.32]) {
        const post = new THREE.Mesh(tallPost, M.bridgeWoodD);
        post.position.set(x, deckY + 0.23, z);
        g.add(post);
      }
    }
    // Pitched roof — two angled panels meeting at a ridge.
    // Sign matters: positive rotation around X tips the panel's +z edge
    // DOWN, so the side at z=-0.17 needs a NEGATIVE rotation to push its
    // inner edge (toward the centre) UP to the ridge. Inverted signs here
    // produce a valley roof instead of a peak.
    const ridgeY = deckY + 0.52;
    const eaveY  = deckY + 0.42;
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.05, 0.42), M.bridgeWood);
      panel.position.set(0, (ridgeY + eaveY) / 2, side * 0.17);
      panel.rotation.x = side * 0.42;
      g.add(panel);
    }
    // Ridge cap sits along the apex line where the panels meet.
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.06, 0.07), M.bridgeWoodD);
    ridge.position.set(0, ridgeY + 0.02, 0);
    g.add(ridge);
    // Cast shadow on the water
    const shadow = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.035, 0.62), M.bridgeWoodD);
    shadow.position.y = 0.025;
    g.add(shadow);
    return g;
  }

  function makeBridgeStoneFlat() {
    const g = new THREE.Group();
    const deckY = 0.11;
    // Stone deck slab
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.10, 0.64), M.castleStone);
    deck.position.set(0, deckY, 0);
    g.add(deck);
    // Darker trim along the underside
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.00, 0.06, 0.66), M.castleStoneD);
    trim.position.set(0, deckY - 0.07, 0);
    g.add(trim);
    // Stone parapets along both long edges
    for (const z of [-0.30, 0.30]) {
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.20, 0.08), M.castleStone);
      parapet.position.set(0, deckY + 0.16, z);
      g.add(parapet);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.04, 0.10), M.castleStoneD);
      cap.position.set(0, deckY + 0.28, z);
      g.add(cap);
      // Small repeated balusters baked in as box pattern
      for (const bx of [-0.30, 0, 0.30]) {
        const pillar = new THREE.Mesh(getBoxGeometry(0.07, 0.08, 0.10), M.castleStoneD);
        pillar.position.set(bx, deckY + 0.06, z);
        g.add(pillar);
      }
    }
    // End abutments (chunky blocks at each end)
    for (const x of [-0.44, 0.44]) {
      const abut = new THREE.Mesh(getBoxGeometry(0.10, 0.22, 0.68), M.castleStoneD);
      abut.position.set(x, deckY - 0.04, 0);
      g.add(abut);
    }
    const shadow = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.035, 0.64), M.castleStoneD);
    shadow.position.y = 0.025;
    g.add(shadow);
    return g;
  }

  function makeBridgeStoneArch() {
    const g = new THREE.Group();
    // Arched deck — segments stepping up to a centre peak, parabolic profile.
    const baseDeckY = 0.12;
    const arcHeight = 0.18;
    const SEGS = 7;
    for (let i = 0; i < SEGS; i++) {
      const t = i / (SEGS - 1); // 0..1
      const x = -0.42 + t * 0.84;
      const arch = arcHeight * 4 * (t - t * t); // parabola peaking at t=0.5
      const y = baseDeckY + arch;
      const segW = 0.84 / SEGS + 0.02;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.10, 0.62), M.castleStone);
      seg.position.set(x, y, 0);
      g.add(seg);
      // Parapet segments tracking the deck height
      for (const sz of [-0.30, 0.30]) {
        const para = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.16, 0.07), M.castleStone);
        para.position.set(x, y + 0.13, sz);
        g.add(para);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(segW + 0.02, 0.03, 0.09), M.castleStoneD);
        cap.position.set(x, y + 0.23, sz);
        g.add(cap);
      }
    }
    // Visible arched underside — darker stones forming the load-bearing arch
    const UNDER_SEGS = 5;
    for (let i = 0; i < UNDER_SEGS; i++) {
      const t = i / (UNDER_SEGS - 1);
      const x = -0.34 + t * 0.68;
      const arch = arcHeight * 4 * (t - t * t) * 0.55;
      const y = 0.04 + arch;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.60), M.castleStoneD);
      seg.position.set(x, y, 0);
      g.add(seg);
    }
    // Chunky end piers anchoring the arch
    for (const x of [-0.46, 0.46]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.30, 0.68), M.castleStoneD);
      pier.position.set(x, 0.07, 0);
      g.add(pier);
    }
    const shadow = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.035, 0.62), M.castleStoneD);
    shadow.position.y = 0.025;
    g.add(shadow);
    return g;
  }

  function makeBridge(orientation, level) {
    const lv = Math.max(1, Math.min(4, level || 1));
    let g;
    if      (lv === 1) g = makeBridgeWoodPlank();
    else if (lv === 2) g = makeBridgeCoveredWood();
    else if (lv === 3) g = makeBridgeStoneFlat();
    else               g = makeBridgeStoneArch();
    if (orientation === 'z') g.rotation.y = Math.PI / 2;
    g.userData = { kind: 'bridge', level: lv };
    castReceive(g);
    return g;
  }

  function addEnhancementBits(g, kind, level) {
    level = Math.max(1, Math.min(MAX_FLOORS, level || 1));
    if (level <= 1) return g;
    const extra = Math.min(level - 1, 7);

    if (kind === 'tree') {
      const s = 1 + extra * 0.055;
      g.scale.set(s, 1 + extra * 0.075, s);
      if (level >= 4) {
        const sapling = new THREE.Mesh(roundedBox(0.24, 0.22, 0.24, 0.04), M.leavesDk);
        sapling.position.set(0.27, 0.20, -0.24);
        g.add(sapling);
      }
      if (level >= 6) {
        const sapling = new THREE.Mesh(roundedBox(0.20, 0.18, 0.20, 0.04), M.leaves);
        sapling.position.set(-0.30, 0.18, 0.22);
        g.add(sapling);
      }
    } else if (kind === 'rock') {
      const s = 1 + extra * 0.045;
      g.scale.set(s, 1 + extra * 0.035, s);
      for (let i = 0; i < Math.min(extra, 4); i++) {
        const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.055 + i * 0.008, 0), i % 2 ? M.rockDk : M.rockHi);
        const a = i * 1.7 + 0.4;
        pebble.scale.y = 0.55;
        pebble.position.set(Math.cos(a) * 0.34, 0.035, Math.sin(a) * 0.30);
        g.add(pebble);
      }
    } else if (kind === 'bridge') {
      const s = 1 + Math.min(extra, 3) * 0.025;
      g.scale.set(s, 1, s);
      if (level >= 3) {
        for (const x of [-0.28, 0.28]) {
          const lamp = new THREE.Mesh(getBoxGeometry(0.045, 0.24, 0.045), M.bridgeWoodD);
          lamp.position.set(x, 0.32, -0.31);
          g.add(lamp);
          const cap = new THREE.Mesh(getBoxGeometry(0.09, 0.06, 0.09), M.knob);
          cap.position.set(x, 0.46, -0.31);
          g.add(cap);
        }
      }
    } else if (kind === 'tuft' || kind === 'crop' || kind === 'corn' || kind === 'wheat' || kind === 'pumpkin' || kind === 'carrot' || kind === 'sunflower') {
      // Repeated clicks pack MORE crops onto the tile rather than
      // scaling the original up — level 1 is a single sprout, level 8
      // is a tight cluster of additional plants. Only a faint scale
      // boost so the patch reads as "more here", not "a giant plant".
      g.scale.set(1, 1, 1);
      const stemMat = (kind === 'corn')      ? M.cornStalk
                    : (kind === 'wheat')     ? M.wheatStalk
                    : (kind === 'pumpkin')   ? M.pumpkinStem
                    : (kind === 'carrot')    ? M.cornStalk
                    : (kind === 'sunflower') ? M.sunflowerStalk
                    : (kind === 'tuft')      ? M.leaves
                    : M.cropStem;
      // Pumpkin: instead of stems, drop a couple of mini pumpkins
      // around the main one so the patch feels like a pumpkin patch.
      if (kind === 'pumpkin') {
        const miniCount = Math.min(extra, 5);
        for (let i = 0; i < miniCount; i++) {
          const a = i * 1.05 + 0.3;
          const r = 0.32 + (i % 2 ? 0.04 : 0);
          const sz = 0.14 + Math.random() * 0.04;
          const mini = new THREE.Mesh(roundedBox(sz, sz * 0.85, sz, 0.04), i % 2 ? M.pumpkin : M.pumpkinDk);
          mini.position.set(Math.cos(a) * r, sz * 0.45, Math.sin(a) * r);
          mini.rotation.y = a;
          g.add(mini);
          const tinyStem = new THREE.Mesh(getBoxGeometry(0.025, 0.04, 0.025), M.pumpkinStem);
          tinyStem.position.set(Math.cos(a) * r, sz * 0.85 + 0.02, Math.sin(a) * r);
          g.add(tinyStem);
        }
      } else {
        // Inner ring + outer ring of additional stems. Two rings packed
        // tighter than before — denser per level, no scaling.
        const innerCount = Math.min(extra * 3, 12);
        for (let i = 0; i < innerCount; i++) {
          const blade = new THREE.Mesh(getBoxGeometry(0.04, 0.13 + (i % 3) * 0.02, 0.04), stemMat);
          const a = i * 0.55 + extra * 0.18;
          const r = 0.16 + (i % 2 ? 0.04 : 0);
          blade.position.set(Math.cos(a) * r, 0.06 + (i % 3) * 0.01, Math.sin(a) * r);
          blade.rotation.z = (i % 2 ? -1 : 1) * 0.16;
          g.add(blade);
        }
        if (extra >= 2) {
          const outerCount = Math.min((extra - 1) * 3, 12);
          for (let i = 0; i < outerCount; i++) {
            const blade = new THREE.Mesh(getBoxGeometry(0.035, 0.17 + (i % 3) * 0.02, 0.035), stemMat);
            const a = i * 0.55 + 0.27 + extra * 0.1;
            blade.position.set(Math.cos(a) * 0.34, 0.08 + (i % 3) * 0.01, Math.sin(a) * 0.34);
            blade.rotation.z = (i % 2 ? 1 : -1) * 0.20;
            g.add(blade);
          }
        }
      }
    } else if (kind === 'fence') {
      g.scale.y = 1 + Math.min(extra, 4) * 0.06;
    }
    g.userData.level = level;
    return g;
  }
