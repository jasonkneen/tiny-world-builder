  // -------- distant world dressing --------
  const distantWorldGroup = new THREE.Group();
  distantWorldGroup.name = 'distant-worlds';
  xrWorldRoot.add(distantWorldGroup);

  function makeTinyCloudlet(seed) {
    const g = new THREE.Group();
    const count = 5 + Math.floor(cellRand(seed, GRID, 2320) * 4);
    for (let i = 0; i < count; i++) {
      const r = 0.16 + cellRand(seed + i, GRID, 2330) * 0.18;
      const mat = cellRand(seed - i, GRID, 2340) < 0.68 ? M.cloud : M.cloudShade;
      const m = new THREE.Mesh(getDodecahedronGeometry(r), mat);
      m.position.set(
        (cellRand(seed + i * 2, GRID, 2350) - 0.5) * 1.3,
        cellRand(seed - i * 3, GRID, 2360) * 0.30,
        (cellRand(seed + i * 5, GRID, 2370) - 0.5) * 0.9,
      );
      m.castShadow = false;
      m.receiveShadow = false;
      g.add(m);
    }
    return g;
  }

  function makeDistantMiniWorld(seed, variant) {
    const g = new THREE.Group();
    const span = 3.4 + cellRand(seed, GRID, 2400) * 0.8;
    const depth = 2.8 + cellRand(seed, GRID, 2410) * 0.8;
    vbox(g, span, 0.18, depth, 0, 0, 0, M.grass, { noGap: true, noBevel: true });
    vbox(g, span * 0.98, 0.46, depth * 0.98, 0, -0.32, 0, M.dirtRich, { noGap: true, noBevel: true });
    vbox(g, span * 0.92, 0.44, depth * 0.92, 0, -0.78, 0, M.boardSide, { noGap: true, noBevel: true });
    vbox(g, span * 0.70, 0.34, depth * 0.70, 0, -1.17, 0, M.islandUnderD, { noGap: true, noBevel: true });

    vbox(g, span * 0.68, 0.035, 0.22, 0, 0.115, 0, M.path, { noGap: true, noBevel: true });
    vbox(g, 0.20, 0.035, depth * 0.56, 0.28, 0.118, 0, M.path, { noGap: true, noBevel: true });
    if (variant % 3 === 0) {
      const water = vbox(g, 0.34, 0.030, depth * 0.75, -0.72, 0.122, 0, M.water, { noGap: true, noBevel: true });
      water.material = M.water;
    }

    const houseX = -0.55 + cellRand(seed, GRID, 2420) * 0.35;
    const houseZ = -0.55 + cellRand(seed, GRID, 2430) * 0.30;
    vbox(g, 0.42, 0.36, 0.38, houseX, 0.35, houseZ, variant % 2 ? M.wallCream : M.manorBrick, { noGap: true, noBevel: true });
    vbox(g, 0.52, 0.12, 0.48, houseX, 0.59, houseZ, variant % 2 ? M.roofBlue : M.manorRoof, { noGap: true, noBevel: true });
    vbox(g, 0.08, 0.16, 0.08, houseX + 0.14, 0.77, houseZ - 0.08, M.chimney, { noGap: true, noBevel: true });

    const towerX = 0.68;
    const towerZ = -0.35 + cellRand(seed, GRID, 2440) * 0.70;
    vbox(g, 0.42, 0.72, 0.42, towerX, 0.53, towerZ, M.towerStone, { noGap: true, noBevel: true });
    vbox(g, 0.58, 0.12, 0.58, towerX, 0.94, towerZ, M.towerStoneD, { noGap: true, noBevel: true });
    for (let i = 0; i < 4; i++) {
      const sx = towerX + (i < 2 ? -0.21 : 0.21);
      const sz = towerZ + (i % 2 ? -0.21 : 0.21);
      vbox(g, 0.12, 0.18, 0.12, sx, 1.09, sz, M.towerStone, { noGap: true, noBevel: true });
    }

    for (let i = 0; i < 7; i++) {
      const px = (cellRand(seed + i, GRID, 2450) - 0.5) * span * 0.78;
      const pz = (cellRand(seed - i, GRID, 2460) - 0.5) * depth * 0.78;
      if (Math.abs(px) < 0.35 && Math.abs(pz) < 0.28) continue;
      vbox(g, 0.10, 0.32, 0.10, px, 0.29, pz, M.trunk, { noGap: true, noBevel: true });
      vbox(g, 0.36, 0.26, 0.36, px, 0.60, pz, M.leaves, { noGap: true, noBevel: true });
      vbox(g, 0.24, 0.18, 0.24, px, 0.82, pz, M.leavesDk, { noGap: true, noBevel: true });
    }

    for (let i = 0; i < 10; i++) {
      const edge = Math.floor(cellRand(seed + i, GRID, 2470) * 4);
      const px = edge < 2 ? (cellRand(seed + i, GRID, 2480) - 0.5) * span : (edge === 2 ? -span * 0.53 : span * 0.53);
      const pz = edge >= 2 ? (cellRand(seed - i, GRID, 2490) - 0.5) * depth : (edge === 0 ? -depth * 0.53 : depth * 0.53);
      const s = 0.08 + cellRand(seed - i, GRID, 2500) * 0.08;
      vbox(g, s, s, s, px, -0.18 - cellRand(seed + i, GRID, 2510) * 0.55, pz, cellRand(seed + i, GRID, 2520) < 0.45 ? M.grassEdge : M.boardSide, { noGap: true, noBevel: true });
    }

    const cloud = makeTinyCloudlet(seed + 313);
    cloud.position.set(0.4, 2.0 + cellRand(seed, GRID, 2530) * 0.5, -0.9);
    cloud.scale.set(0.72, 0.44, 0.58);
    g.add(cloud);
    g.traverse(o => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        o.raycast = function () {};
      }
    });
    return g;
  }

  function buildDistantWorlds() {
    if (!distantWorldGroup) return;
    while (distantWorldGroup.children.length) {
      const c = distantWorldGroup.children.pop();
      distantWorldGroup.remove(c);
      disposeGroup(c);
    }
    // Setting off: leave the group empty + hidden (also reclaims merge/draw cost).
    if (!renderDistantWorlds) { distantWorldGroup.visible = false; return; }
    distantWorldGroup.visible = true;
    const placements = [
      { x: -20, z: -15, y: -1.2, s: 0.44, r: 0.25 },
      { x: 22, z: -13, y: -1.6, s: 0.36, r: -0.45 },
      { x: -26, z: 14, y: -1.9, s: 0.31, r: 0.72 },
      { x: 28, z: 18, y: -2.1, s: 0.28, r: -0.20 },
      { x: -33, z: -5, y: -2.6, s: 0.23, r: -0.80 },
      { x: 34, z: 4, y: -2.8, s: 0.22, r: 0.58 },
      { x: -13, z: 28, y: -2.5, s: 0.24, r: -0.34 },
      { x: 11, z: -28, y: -2.3, s: 0.25, r: 0.96 },
      { x: -39, z: 24, y: -3.2, s: 0.18, r: 0.18 },
      { x: 39, z: -24, y: -3.1, s: 0.18, r: -0.62 },
    ];
    placements.forEach((p, i) => {
      const w = makeDistantMiniWorld(900 + i * 97, i);
      w.position.set(p.x, p.y, p.z);
      w.rotation.y = p.r;
      w.scale.setScalar(p.s);
      distantWorldGroup.add(w);
    });
    mergeStaticBaseMeshesByMaterial(distantWorldGroup, { reason: 'distant-worlds' });
    distantWorldGroup.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = false;
      o.receiveShadow = false;
      o.frustumCulled = true;
      o.raycast = function () {};
    });
  }

  // Render-settings toggle: show/hide the decorative background mini-worlds.
  function setDistantWorldsVisible(on) {
    renderDistantWorlds = !!on;
    try { localStorage.setItem(RENDER_LS.distantWorlds, renderDistantWorlds ? '1' : '0'); } catch (_) {}
    // Rebuild handles both directions: populates when on, clears+hides when off.
    buildDistantWorlds();
  }

  function addIslandSideBacking(parent) {
    const span = GRID * TILE;
    const half = span * 0.5;
    const thickness = 0.16;
    const inset = thickness * 0.5 + 0.035;
    const wallH = DIRT_H + 0.035;
    const y = -DIRT_H * 0.5 - 0.018;
    const mat = islandShellMaterial(M.boardSide);
    const north = vbox(parent, span, wallH, thickness, 0, y, -half + inset, mat, { noGap: true, noBevel: true, noShadow: true, skipTop: true, skipBottom: true });
    const south = vbox(parent, span, wallH, thickness, 0, y,  half - inset, mat, { noGap: true, noBevel: true, noShadow: true, skipTop: true, skipBottom: true });
    const west  = vbox(parent, thickness, wallH, span, -half + inset, y, 0, mat, { noGap: true, noBevel: true, noShadow: true, skipTop: true, skipBottom: true });
    const east  = vbox(parent, thickness, wallH, span,  half - inset, y, 0, mat, { noGap: true, noBevel: true, noShadow: true, skipTop: true, skipBottom: true });
    for (const mesh of [north, south, west, east]) {
      mesh.name = 'island-side-backing';
      mesh.userData.islandSideBacking = true;
    }
  }

  function addIslandEdgeDressing(parent) {
    const span = GRID * TILE;
    const half = span * 0.5;
    const perEdge = Math.max(18, Math.min(56, GRID * 4));
    function addEdge(dir) {
      const alongX = dir === 'n' || dir === 's';
      const sign = dir === 's' || dir === 'e' ? 1 : -1;
      for (let i = 0; i < perEdge; i++) {
        const t = (i + 0.5) / perEdge;
        const along = -half + t * span + (cellRand(i, GRID, 2600 + dir.charCodeAt(0)) - 0.5) * 0.22;
        const out = half + 0.030 + cellRand(i, GRID, 2610 + dir.charCodeAt(0)) * 0.050;
        const px = alongX ? along : sign * out;
        const pz = alongX ? sign * out : along;
        const roll = cellRand(i, GRID, 2620 + dir.charCodeAt(0));
        if (roll < 0.78) {
          const w = 0.10 + cellRand(i, GRID, 2630 + dir.charCodeAt(0)) * 0.18;
          const h = 0.06 + cellRand(i, GRID, 2640 + dir.charCodeAt(0)) * 0.10;
          vbox(parent, alongX ? w : h, h, alongX ? h : w, px, -0.02 - h * 0.5, pz, roll < 0.42 ? M.grassEdge : M.grassHi, { noGap: true });
        }
        if (roll > 0.30) {
          const w = 0.12 + cellRand(i, GRID, 2650 + dir.charCodeAt(0)) * 0.22;
          const h = 0.16 + cellRand(i, GRID, 2660 + dir.charCodeAt(0)) * 0.34;
          const d = 0.10 + cellRand(i, GRID, 2670 + dir.charCodeAt(0)) * 0.16;
          vbox(parent, alongX ? w : d, h, alongX ? d : w, px, -0.16 - h * 0.5, pz, roll < 0.62 ? M.dirtRich : M.boardSide, { noGap: true });
        }
        if (roll > 0.72) {
          const s = 0.11 + cellRand(i, GRID, 2680 + dir.charCodeAt(0)) * 0.18;
          const drop = 0.62 + cellRand(i, GRID, 2690 + dir.charCodeAt(0)) * 1.25;
          const inset = 0.05 + cellRand(i, GRID, 2700 + dir.charCodeAt(0)) * 0.22;
          const dx = alongX ? (cellRand(i, GRID, 2710) - 0.5) * 0.12 : -sign * inset;
          const dz = alongX ? -sign * inset : (cellRand(i, GRID, 2720) - 0.5) * 0.12;
          vbox(parent, s, s, s, px + dx, -drop, pz + dz, cellRand(i, GRID, 2730) < 0.45 ? M.islandUnderD : M.boardSide, { noGap: true });
        }
      }
    }
    addEdge('n');
    addEdge('s');
    addEdge('w');
    addEdge('e');
  }

  function addIslandUtilityUnderside(parent) {
    const span = GRID * TILE;
    const half = span * 0.5;
    const pipeCount = Math.max(10, Math.min(24, Math.round(GRID * 2.0)));
    const trayCount = Math.max(7, Math.min(18, Math.round(GRID * 1.35)));
    const boxCount = Math.max(8, Math.min(18, Math.round(GRID * 1.3)));
    const dropCount = Math.max(5, Math.min(16, Math.round(GRID * 0.9)));

    function bandHalf(band) {
      return Math.max(0.45, half * (0.92 - band * 0.16));
    }
    function bandY(band, salt) {
      return -DIRT_H - 0.72 - band * 0.34 - cellRand(band + salt, GRID, 8810) * 0.10;
    }
    function coord(seed, range) {
      return (cellRand(seed, GRID, 8820) - 0.5) * range * 2;
    }
    function clampCoord(v, limit) {
      return Math.max(-limit, Math.min(limit, v));
    }
    function addClamp(x, y, z, alongX, pipeRadius, seed) {
      const t = 0.055 + cellRand(seed, GRID, 8830) * 0.025;
      vbox(
        parent,
        alongX ? t : pipeRadius * 2.8,
        pipeRadius * 1.75,
        alongX ? pipeRadius * 2.8 : t,
        x,
        y,
        z,
        M.utilityClamp,
        { noGap: true, noBevel: true, noShadow: true },
      );
    }
    function addRun(seed, alongX, band, length, x, y, z, radius, mat, segments = 8) {
      const pipe = vcylinder(
        parent,
        radius,
        length,
        x,
        y,
        z,
        mat,
        segments,
        { rz: alongX ? Math.PI / 2 : 0, rx: alongX ? 0 : Math.PI / 2, noShadow: true },
      );
      pipe.rotation.y = cellRand(seed, GRID, 8840) * 0.04;
      const clampN = Math.max(2, Math.min(5, Math.round(length / 1.6)));
      for (let j = 0; j < clampN; j++) {
        const p = (j + 0.5) / clampN - 0.5;
        addClamp(
          x + (alongX ? p * length : 0),
          y + radius * 0.12,
          z + (alongX ? 0 : p * length),
          alongX,
          radius,
          seed + j * 19 + band,
        );
      }
      return pipe;
    }

    for (let i = 0; i < pipeCount; i++) {
      const alongX = cellRand(i, GRID, 8850) < 0.52;
      const band = Math.floor(cellRand(i, GRID, 8860) * 4);
      const limit = bandHalf(band);
      const length = Math.max(0.95, Math.min(limit * 1.72, span * (0.24 + cellRand(i, GRID, 8870) * 0.46)));
      const x = clampCoord(coord(i * 3 + 1, limit * 0.78), limit - (alongX ? length * 0.5 : 0.10));
      const z = clampCoord(coord(i * 5 + 2, limit * 0.78), limit - (alongX ? 0.10 : length * 0.5));
      const y = bandY(band, i);
      const radius = 0.022 + cellRand(i, GRID, 8880) * 0.030;
      const mat = cellRand(i, GRID, 8890) < 0.58 ? M.utilityPipe : M.utilityPipeD;
      addRun(i + 500, alongX, band, length, x, y, z, radius, mat, 8);
    }

    for (let i = 0; i < trayCount; i++) {
      const alongX = cellRand(i, GRID, 8900) < 0.5;
      const band = Math.floor(cellRand(i, GRID, 8910) * 3);
      const limit = bandHalf(band);
      const length = Math.max(0.70, span * (0.16 + cellRand(i, GRID, 8920) * 0.28));
      const x = clampCoord(coord(i * 7 + 3, limit * 0.76), limit - (alongX ? length * 0.5 : 0.12));
      const z = clampCoord(coord(i * 11 + 4, limit * 0.76), limit - (alongX ? 0.12 : length * 0.5));
      const y = bandY(band, i + 91) - 0.06;
      const w = 0.052 + cellRand(i, GRID, 8930) * 0.040;
      const mat = cellRand(i, GRID, 8940) < 0.62 ? M.utilityCable : M.utilityCableB;
      vbox(
        parent,
        alongX ? length : w,
        0.026,
        alongX ? w : length,
        x,
        y,
        z,
        mat,
        { noGap: true, noBevel: true, noShadow: true },
      );
      if (cellRand(i, GRID, 8950) > 0.46) {
        vbox(
          parent,
          alongX ? length * 0.42 : w * 0.72,
          0.020,
          alongX ? w * 0.72 : length * 0.42,
          x + (alongX ? (cellRand(i, GRID, 8960) - 0.5) * length * 0.40 : 0),
          y - 0.024,
          z + (alongX ? 0 : (cellRand(i, GRID, 8960) - 0.5) * length * 0.40),
          M.utilityClamp,
          { noGap: true, noBevel: true, noShadow: true },
        );
      }
    }

    for (let i = 0; i < boxCount; i++) {
      const band = Math.floor(cellRand(i, GRID, 8970) * 4);
      const limit = bandHalf(band);
      const x = coord(i * 13 + 5, limit * 0.74);
      const z = coord(i * 17 + 6, limit * 0.74);
      const y = bandY(band, i + 211) - 0.07;
      const w = 0.16 + cellRand(i, GRID, 8980) * 0.22;
      const d = 0.14 + cellRand(i, GRID, 8990) * 0.20;
      const h = 0.07 + cellRand(i, GRID, 9000) * 0.10;
      vbox(parent, w, h, d, x, y, z, cellRand(i, GRID, 9010) < 0.52 ? M.utilityPipeD : M.rocketSteelD, { noGap: true, noShadow: true, ry: cellRand(i, GRID, 9020) * Math.PI });
      if (cellRand(i, GRID, 9030) > 0.35) {
        vbox(parent, w * 0.55, 0.018, d * 0.30, x, y - h * 0.50 - 0.012, z, M.utilityClamp, { noGap: true, noBevel: true, noShadow: true });
      }
    }

    for (let i = 0; i < dropCount; i++) {
      const band = Math.floor(cellRand(i, GRID, 9040) * 3);
      const limit = bandHalf(band);
      const x = coord(i * 19 + 7, limit * 0.68);
      const z = coord(i * 23 + 8, limit * 0.68);
      const length = 0.22 + cellRand(i, GRID, 9050) * 0.72;
      const y = bandY(band, i + 317) - length * 0.5;
      const cable = vcylinder(parent, 0.010 + cellRand(i, GRID, 9060) * 0.010, length, x, y, z, cellRand(i, GRID, 9070) < 0.72 ? M.utilityCable : M.utilityCableB, 6, { noShadow: true });
      cable.rotation.x = (cellRand(i, GRID, 9080) - 0.5) * 0.20;
      cable.rotation.z = (cellRand(i, GRID, 9090) - 0.5) * 0.20;
      if (cellRand(i, GRID, 9100) > 0.48) {
        vbox(parent, 0.055, 0.038, 0.055, x, y - length * 0.52, z, M.utilityClamp, { noGap: true, noBevel: true, noShadow: true });
      }
    }
  }

  function prepareHomeBorderForRender(obj) {
    obj.traverse(c => {
      if (c.isMesh) {
        // The island underside is decorative scenery below the editable board.
        // Keeping it out of the shadow map removes hundreds of tiny box draws
        // without changing placement/editing fidelity.
        c.castShadow = false;
        c.receiveShadow = false;
        // Scene-level island culling owns this group. Per-mesh frustum culling
        // can clip the side/back faces at low or grazing camera angles.
        c.frustumCulled = false;
      }
    });
    return obj;
  }

  // -------- home board border --------
  // No visible board marker. The old dark rectangle/outline under the start
  // board read as an artifact in pixel mode.
  const homeBorderGroup = new THREE.Group();
  homeBorderGroup.name = 'homeBorder';
  worldGroup.add(homeBorderGroup);
  function buildHomeBorder() {
    islandRocketFlames = new Set();
    islandRocketEngines = new Set();
    islandRocketSmokeTimer = 0;
    while (homeBorderGroup.children.length) {
      const c = homeBorderGroup.children.pop();
      disposeGroup(c);
    }
    vbox(homeBorderGroup, GRID * TILE, 0.10, GRID * TILE, 0, -DIRT_H - 0.055, 0, M.islandUnderD, { noGap: true, skipTop: true });
    voxelInvertedSteppedRoof(homeBorderGroup, GRID * TILE, GRID * TILE, -DIRT_H - 0.020, M.islandUnder, M.islandUnderD);
    addIslandSideBacking(homeBorderGroup);
    addIslandUtilityUnderside(homeBorderGroup);
    addIslandRocketEngines(homeBorderGroup);
    addIslandEdgeDressing(homeBorderGroup);
    optimizeVoxelObjectGroup(homeBorderGroup, { reason: 'home-island-border' });
    mergeStaticBaseMeshesByMaterial(homeBorderGroup, { reason: 'home-island-border' });
    prepareHomeBorderForRender(homeBorderGroup);
    buildDistantWorlds();
    if (typeof buildUnderIslandClouds === 'function') buildUnderIslandClouds();
  }
  enqueueDeferredVisualStartup('home-border-dressing', buildHomeBorder);

  // -------- ghost worlds --------
  // Non-editable neighbouring boards. They preview the multiplayer shape of
  // the world without changing the central board's world/cellMeshes contract.
  const ghostBoards = new Map(); // 'boardX,boardZ' -> THREE.Group
  const ghostBoardCells = new Map(); // 'boardX,boardZ' -> 8x8 local board cells
  let ghostBoardsBlank = false;
  const VIEW_EDGE_FADE_TILES = 2;
  let ghostPreloadRadius = ghostBoardsEnabledForGrid() ? Math.min(renderVisibleDistance, renderBudgetForGrid(GRID).ghostRadius) : 0;
  let ghostOuterFadeTiles = ghostPreloadRadius > 0 ? 2 + ghostPreloadRadius * 2 : VIEW_EDGE_FADE_TILES;
  const opacityRoots = new Set();

  // -------- dormant cheap ghost instancing helpers --------
  // Kept only for safe cleanup of stale sessions that may have created cheap
  // terrain buckets. New Preview boards use full-fidelity terrain/objects;
  // if full boards are too expensive, renderBudgetForGrid() reduces rings.
  const cheapGhostTerrainBuckets = new Map(); // terrain -> { dirtMesh, topMesh, slots, keyAt, count }
  const revealedCheapCells = new Set();
  const CHEAP_GHOST_CAPACITY = 65536; // generous ghost-preview pool
  let cheapGhostGeomDirt = null;
  let cheapGhostGeomTop = null;

  const ghostBoardKeyCache = new Map();
  function ghostBoardKey(boardX, boardZ) {
    const hash = (boardX << 16) | (boardZ & 0xFFFF);
    let key = ghostBoardKeyCache.get(hash);
    if (key === undefined) {
      key = boardX + ',' + boardZ;
      ghostBoardKeyCache.set(hash, key);
    }
    return key;
  }

  function makeBlankBoardWorld() {
    const cells = [];
    for (let x = 0; x < GRID; x++) {
      cells[x] = [];
      for (let z = 0; z < GRID; z++) {
        cells[x][z] = { terrain: 'grass', terrainFloors: 1, kind: null, floors: 1, buildingType: null, fenceSide: null, extras: [] };
      }
    }
    return cells;
  }

  function boardFromTargetCoord(v) {
    return Math.floor((v + GRID / 2) / GRID);
  }

  function ghostCellPos(boardX, boardZ, x, z) {
    const p = tilePos(x, z);
    p.x += boardX * GRID;
    p.z += boardZ * GRID;
    return p;
  }

