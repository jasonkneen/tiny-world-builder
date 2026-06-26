  // -------- drop-in animation system --------
  // Each tile/object that wants to "land" gets pushed into dropAnims with a delay,
  // then ticks toward its target Y per frame. While landing, obj.userData.landing
  // is set so other position-Y animations (crop bob, smoke origin) yield to it.
  const dropAnims = [];
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeOutBack = t => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  function animateDrop(obj, distance, dur, delay, easing, impactDust = false) {
    const baseY = obj.position.y;
    obj.position.y = baseY + distance;
    obj.userData.landing = true;
    // Weather tile overlays are intentionally flat decals. Hide them while a
    // tile is dropping in, otherwise they read as detached square panels until
    // the tile settles onto the board.
    if (obj.userData && obj.userData.weatherFx) obj.userData.weatherFx.visible = false;
    dropAnims.push({ obj, baseY, distance, t: -delay, dur, easing, impactDust });
  }
  function dustCountForMesh(obj) {
    if (!obj) return 3;
    const k = obj.userData && obj.userData.kind;
    let base = 3; // tiles + unknown
    if (k === 'tuft')                                                                        base = 1;
    else if (k === 'crop' || k === 'corn' || k === 'wheat' || k === 'carrot' || k === 'sunflower' || k === 'pumpkin') base = 2;
    else if (k === 'tree')                                                                   base = 3;
    else if (k === 'bridge')                                                                 base = 2;
    else if (k === 'fence')                                                                  base = 3;
    else if (k === 'rock')                                                                   base = 5;
    else if (k === 'house') {
      const bt = obj.userData.buildingType;
      if (bt === 'skyscraper')                                base = 12;
      else if (bt === 'manor' || bt === 'tower' || bt === 'turret') base = 8;
      else                                                    base = 5;
    }
    const floors = (obj.userData && (obj.userData.level || obj.userData.floors)) || 1;
    return Math.min(20, Math.max(1, base + Math.max(0, floors - 1)));
  }

  function emitImpactDust(obj) {
    if (!obj || !obj.userData || obj.userData.kind === 'tile') return;
    const n = dustCountForMesh(obj);
    if (n <= 0) return;
    spawnDustBurst(obj.position.x, obj.position.y, obj.position.z, n);
  }

  // Rough "mass" estimate used to size ripples and dust. Mirrors
  // dustCountForMesh but tuned so a tuft is ~0, a tree is ~2, and a
  // skyscraper is ~12+.
  function massForMesh(obj) {
    if (!obj || !obj.userData) return 0;
    const k = obj.userData.kind;
    let base = 0;
    if (k === 'tile' || k === 'tuft')                                                                  base = 0;
    else if (k === 'crop' || k === 'corn' || k === 'wheat' || k === 'carrot' || k === 'sunflower' || k === 'pumpkin') base = 1;
    else if (k === 'tree')                                                                              base = 2;
    else if (k === 'bridge')                                                                            base = 1.5;
    else if (k === 'fence')                                                                             base = 2;
    else if (k === 'rock')                                                                              base = 3.5;
    else if (k === 'house') {
      const bt = obj.userData.buildingType;
      if (bt === 'skyscraper') base = 11;
      else if (bt === 'manor' || bt === 'tower' || bt === 'turret') base = 7;
      else base = 4;
    }
    const floors = obj.userData.level || obj.userData.floors || 1;
    return base + Math.max(0, floors - 1) * 0.6;
  }

  // Surrounding-tile ripple when a heavy object lands. Tiles within
  // `radius` cells of the impact bob in a damped sine wave whose
  // amplitude falls off with distance and whose phase lags so the
  // shockwave propagates outward visibly.
  const rippleAnims = [];
  const rippleTileOwner = new Map(); // tile -> active rippleAnim entry
  function triggerRipple(originX, originZ, mass) {
    if (!mass || mass < 2) return;
    if (typeof playSfx === 'function') playSfx('ripple');
    const radius = Math.min(3, Math.max(1, Math.round(mass / 3)));
    const baseAmp = Math.min(0.12, 0.012 * mass);
    for (const key in cellMeshes) {
      const [kx, kz] = key.split(',').map(Number);
      if (kx === originX && kz === originZ) continue;
      const dx = kx - originX, dz = kz - originZ;
      const dist = Math.max(Math.abs(dx), Math.abs(dz));
      if (dist > radius) continue;
      const tile = cellMeshes[key].tile;
      if (!tile || (tile.userData && tile.userData.landing)) continue;
      // Inherit the true rest Y from any in-flight ripple on this
      // tile — otherwise we'd capture the displaced position and
      // leave the tile permanently offset when the new ripple ends.
      let restY = tile.position.y;
      const prev = rippleTileOwner.get(tile);
      if (prev) {
        restY = prev.baseY;
        const idx = rippleAnims.indexOf(prev);
        if (idx >= 0) rippleAnims.splice(idx, 1);
      }
      // Snap the tile to its rest position before kicking off the new wave.
      tile.position.y = restY;
      const falloff = 1 - (dist - 1) / Math.max(1, radius); // 1 at dist=1, decays outward
      const anim = {
        tile,
        baseY: restY,
        amp: baseAmp * Math.max(0.15, falloff),
        dur: 0.55 + dist * 0.10,
        t: 0,
        phaseDelay: dist * 0.04,
        freq: 11 - dist * 1.2,
      };
      rippleAnims.push(anim);
      rippleTileOwner.set(tile, anim);
    }
  }

  function tickRippleAnims(dt) {
    if (!rippleAnims.length) return;
    for (let i = rippleAnims.length - 1; i >= 0; i--) {
      const r = rippleAnims[i];
      r.t += dt;
      if (r.t >= r.dur || (r.tile.userData && r.tile.userData.landing)) {
        r.tile.position.y = r.baseY;
        rippleTileOwner.delete(r.tile);
        rippleAnims.splice(i, 1);
        continue;
      }
      const u = r.t / r.dur;
      const damp = (1 - u) * (1 - u);
      const phaseT = Math.max(0, r.t - r.phaseDelay);
      // Negative sine so the compression wave pushes tiles DOWN
      // first, then rebounds up — reads as a real impact.
      const wave = -Math.sin(phaseT * r.freq) * r.amp * damp;
      r.tile.position.y = r.baseY + wave;
    }
  }

  function tickDropAnims(dt) {
    for (let i = dropAnims.length - 1; i >= 0; i--) {
      const a = dropAnims[i];
      a.t += dt;
      if (a.t < 0) continue;
      const u = Math.min(1, a.t / a.dur);
      a.obj.position.y = a.baseY + a.distance * (1 - a.easing(u));

      // Fire the impact effects slightly BEFORE landing so the ripple's
      // initial dip and the dust burst peak at the exact moment the
      // object touches down — the "give" reads as part of the landing,
      // not as something that happens after.
      if (!a.preImpactFired && u >= 0.82 && a.obj.userData && a.obj.userData.kind !== 'tile') {
        a.preImpactFired = true;
        const mass = massForMesh(a.obj);
        const gx = a.obj.userData.gx;
        const gz = a.obj.userData.gz;
        const ox = (typeof gx === 'number') ? gx : Math.round(a.obj.position.x + GRID / 2 - 0.5);
        const oz = (typeof gz === 'number') ? gz : Math.round(a.obj.position.z + GRID / 2 - 0.5);
        if (typeof triggerUndersideDebrisBurstAt === 'function') {
          triggerUndersideDebrisBurstAt(a.obj.position.x, a.obj.position.z, Math.max(1, mass));
        }
        if (mass >= 2) {
          triggerRipple(ox, oz, mass); // also plays 'ripple' SFX
          if (mass >= 4 && typeof triggerIslandRocketSmokePuffs === 'function') {
            triggerIslandRocketSmokePuffs(Math.min(3, mass / 5));
          }
        } else if (typeof playSfx === 'function') {
          playSfx('land', 0.35);
        }
      }

      if (u >= 1) {
        a.obj.position.y = a.baseY;
        a.obj.userData.landing = false;
        if (a.obj.userData && a.obj.userData.weatherFx) a.obj.userData.weatherFx.visible = true;
        if (a.impactDust) emitImpactDust(a.obj);
        // For tiles or anything we didn't pre-fire (very short drops),
        // run the impact effects now as a fallback.
        if (!a.preImpactFired && a.obj.userData && a.obj.userData.kind !== 'tile') {
          const mass = massForMesh(a.obj);
          const gx = a.obj.userData.gx;
          const gz = a.obj.userData.gz;
          const ox = (typeof gx === 'number') ? gx : Math.round(a.obj.position.x + GRID / 2 - 0.5);
          const oz = (typeof gz === 'number') ? gz : Math.round(a.obj.position.z + GRID / 2 - 0.5);
          if (typeof triggerUndersideDebrisBurstAt === 'function') {
            triggerUndersideDebrisBurstAt(a.obj.position.x, a.obj.position.z, Math.max(1, mass));
          }
          if (mass >= 2) {
            triggerRipple(ox, oz, mass);
            if (mass >= 4 && typeof triggerIslandRocketSmokePuffs === 'function') {
              triggerIslandRocketSmokePuffs(Math.min(3, mass / 5));
            }
          }
          else if (typeof playSfx === 'function') playSfx('land', 0.35);
        }
        dropAnims.splice(i, 1);
      }
    }
  }

  // -------- adjacency helpers --------
  function getPathNeighbors(x, z) {
    return {
      n: getWorldCell(x, z - 1).terrain === 'path',
      s: getWorldCell(x, z + 1).terrain === 'path',
      e: getWorldCell(x + 1, z).terrain === 'path',
      w: getWorldCell(x - 1, z).terrain === 'path',
    };
  }

  function getTerrainNeighbors(x, z) {
    return {
      n: getWorldCell(x, z - 1).terrain,
      s: getWorldCell(x, z + 1).terrain,
      e: getWorldCell(x + 1, z).terrain,
      w: getWorldCell(x - 1, z).terrain,
    };
  }

  // Neighbor tile levels for riser side-culling. Always returns a level
  // (default 1 for cells we don't have data for / off-board), which lets
  // makeTile drop every same-or-higher-level riser side. Trade-off: at
  // the outermost edge of all rendered area there is no covering tile,
  // so the dirt cliff is dropped and a very-low-angle camera could see a
  // void past the perimeter. Acceptable for top-down play; the
  // alternative is dark dirt panels under every path/water/edge tile,
  // which the user explicitly does not want.
  function getLevelNeighbors(x, z) {
    // The "landmass" is the cell's own board: the home board is [0,GRID); an
    // editable island is its own GRID-aligned board. A neighbour OUTSIDE that
    // board is the physical perimeter (void/drop-off) -> null, which drops the
    // riser cliff and lets water fall there. Interior neighbours (incl. unpainted
    // default-grass island cells) return a real level, so risers cull and water
    // does NOT fall in the interior. (Before this, island cells used the home
    // [0,GRID) bounds, so every island neighbour read as off-board -> water fell
    // on every interior cell too.)
    const island = isEditableIslandCell(x, z);
    const bx0 = island ? Math.floor(x / GRID) * GRID : 0;
    const bz0 = island ? Math.floor(z / GRID) * GRID : 0;
    function probe(nx, nz) {
      if (nx < bx0 || nx >= bx0 + GRID || nz < bz0 || nz >= bz0 + GRID) return null;
      if (!shouldRenderCellMesh(nx, nz)) return null;
      return tileLevelForCell(getWorldCell(nx, nz));
    }
    return {
      n: probe(x, z - 1),
      s: probe(x, z + 1),
      e: probe(x + 1, z),
      w: probe(x - 1, z),
    };
  }

  function getGhostLevelNeighbors(cells, x, z) {
    function probe(nx, nz) {
      if (nx < 0 || nx >= GRID || nz < 0 || nz >= GRID) return null;
      return tileLevelForCell(cells[nx][nz]);
    }
    return {
      n: probe(x, z - 1),
      s: probe(x, z + 1),
      e: probe(x + 1, z),
      w: probe(x - 1, z),
    };
  }

  function getKindNeighbors(x, z, kind) {
    return {
      n: getWorldCell(x, z - 1).kind === kind,
      s: getWorldCell(x, z + 1).kind === kind,
      e: getWorldCell(x + 1, z).kind === kind,
      w: getWorldCell(x - 1, z).kind === kind,
    };
  }

  function getRockNeighbors(x, z) {
    function probe(nx, nz) {
      const c = getWorldCell(nx, nz);
      return c.kind === 'rock' ? (c.floors || 1) : 0;
    }
    return {
      n: probe(x, z - 1),
      s: probe(x, z + 1),
      e: probe(x + 1, z),
      w: probe(x - 1, z),
    };
  }

  function getGhostRockNeighbors(cells, x, z) {
    function probe(nx, nz) {
      if (nx < 0 || nx >= GRID || nz < 0 || nz >= GRID) return 0;
      return cells[nx][nz].kind === 'rock' ? (cells[nx][nz].floors || 1) : 0;
    }
    return {
      n: probe(x, z - 1),
      s: probe(x, z + 1),
      e: probe(x + 1, z),
      w: probe(x - 1, z),
    };
  }

  function getBridgeOrientation(x, z) {
    const westPath = getWorldCell(x - 1, z).terrain === 'path';
    const eastPath = getWorldCell(x + 1, z).terrain === 'path';
    const northPath = getWorldCell(x, z - 1).terrain === 'path';
    const southPath = getWorldCell(x, z + 1).terrain === 'path';
    const eastWestPath = westPath || eastPath;
    const northSouthPath = northPath || southPath;
    if (northSouthPath && !eastWestPath) return 'z';
    if (eastWestPath && !northSouthPath) return 'x';

    const westLand = getWorldCell(x - 1, z).terrain !== 'water';
    const eastLand = getWorldCell(x + 1, z).terrain !== 'water';
    const northLand = getWorldCell(x, z - 1).terrain !== 'water';
    const southLand = getWorldCell(x, z + 1).terrain !== 'water';
    if (northLand && southLand && !(westLand && eastLand)) return 'z';
    return 'x';
  }

  function getFenceNeighbors(x, z) {
    return {
      n: getWorldCell(x, z - 1).kind === 'fence',
      s: getWorldCell(x, z + 1).kind === 'fence',
      e: getWorldCell(x + 1, z).kind === 'fence',
      w: getWorldCell(x - 1, z).kind === 'fence',
    };
  }

  // Castle-wall neighbours: same shape as getFenceNeighbors, but each value is
  // 'fence' | 'turret' | null. Turret-houses count as connection points so the
  // wall segment toward them extends to meet the tower cylinder. Used only on
  // the castle render path; wood fences continue to use getFenceNeighbors.
  function getCastleWallNeighbors(x, z) {
    function probe(nx, nz) {
      if (getWorldCell(nx, nz).kind === 'fence') return 'fence';
      if (isTurretHouse(nx, nz)) return 'turret';
      return null;
    }
    return {
      n: probe(x, z - 1),
      s: probe(x, z + 1),
      e: probe(x + 1, z),
      w: probe(x - 1, z),
    };
  }

  // Castle promotion. A house becomes a turret when it sits at a fence corner —
  // i.e. has fences on 2+ perpendicular adjacent sides. A fence becomes a
  // castle wall when its connected fence component touches at least one
  // turret-house. Rules are purely local + component-local, so behaviour is
  // predictable as the player paints; cluster shapes update through the
  // existing setCell adjacency refresh, extended below to include the whole
  // fence component on changes.
  // Castle/turret AUTO-promotion. Disabled: placed fences and houses must not
  // morph into castle walls / turrets based on what's placed next to them.
  // The explicit Castle house variant (buildingType 'turret' -> makeTurret) and
  // fence wall/boundary levels (makeFence) are unaffected by this flag.
  const CASTLE_AUTO_PROMOTION = false;
  function isTurretHouse(x, z) {
    if (!CASTLE_AUTO_PROMOTION) return false;
    if (getWorldCell(x, z).kind !== 'house') return false;
    const n = getWorldCell(x, z - 1);
    const s = getWorldCell(x, z + 1);
    const e = getWorldCell(x + 1, z);
    const w = getWorldCell(x - 1, z);
    const fN = n.kind === 'fence' && normalizeFenceSide(n.fenceSide) === 's';
    const fS = s.kind === 'fence' && normalizeFenceSide(s.fenceSide) === 'n';
    const fE = e.kind === 'fence' && normalizeFenceSide(e.fenceSide) === 'w';
    const fW = w.kind === 'fence' && normalizeFenceSide(w.fenceSide) === 'e';
    return (fN && fE) || (fN && fW) || (fS && fE) || (fS && fW);
  }

  function isCastleFence(x, z) {
    if (!CASTLE_AUTO_PROMOTION) return false;
    if (getWorldCell(x, z).kind !== 'fence') return false;
    const seen = new Set();
    const stack = [[x, z]];
    seen.add(x + ',' + z);
    while (stack.length) {
      const [cx, cz] = stack.pop();
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz;
        if (isTurretHouse(nx, nz)) return true;
        const k = nx + ',' + nz;
        if (getWorldCell(nx, nz).kind === 'fence' && !seen.has(k)) {
          seen.add(k);
          stack.push([nx, nz]);
        }
      }
    }
    return false;
  }

  function isClusterableHouseCell(cell) {
    return !!(cell && cell.kind === 'house' && !cell.buildingType);
  }

  function isClusterableHouseAt(x, z) {
    return isClusterableHouseCell(getWorldCell(x, z));
  }

  // Detect a "composite" topology — a long main wing plus 1+ single-cell
  // perpendicular branches (L-shape, T-shape, +-shape). Returns null if the
  // cluster doesn't fit this shape (e.g. solid 2x2 square, multi-cell branches).
  function tryComposite(cluster) {
    if (cluster.length < 2) return null;
    const xs = cluster.map(c => c.x), zs = cluster.map(c => c.z);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const zMin = Math.min(...zs), zMax = Math.max(...zs);

    const rowCounts = {}, colCounts = {};
    for (const c of cluster) {
      rowCounts[c.z] = (rowCounts[c.z] || 0) + 1;
      colCounts[c.x] = (colCounts[c.x] || 0) + 1;
    }
    const maxRowCount = Math.max(...Object.values(rowCounts));
    const maxColCount = Math.max(...Object.values(colCounts));

    let mainOrientation, mainAxisCoord, mainCells;
    if (maxColCount >= maxRowCount && maxColCount >= 2) {
      mainOrientation = 'z';
      let bestX = null;
      for (const x of Object.keys(colCounts).map(Number).sort((a, b) => a - b)) {
        if (colCounts[x] === maxColCount) { bestX = x; break; }
      }
      mainAxisCoord = bestX;
      mainCells = cluster.filter(c => c.x === bestX).sort((a, b) => a.z - b.z);
    } else if (maxRowCount >= 2) {
      mainOrientation = 'x';
      let bestZ = null;
      for (const z of Object.keys(rowCounts).map(Number).sort((a, b) => a - b)) {
        if (rowCounts[z] === maxRowCount) { bestZ = z; break; }
      }
      mainAxisCoord = bestZ;
      mainCells = cluster.filter(c => c.z === bestZ).sort((a, b) => a.x - b.x);
    } else {
      return null;
    }

    // Main wing must be a contiguous run.
    for (let i = 1; i < mainCells.length; i++) {
      const prev = mainCells[i - 1], cur = mainCells[i];
      if (mainOrientation === 'z' && cur.z !== prev.z + 1) return null;
      if (mainOrientation === 'x' && cur.x !== prev.x + 1) return null;
    }

    // Side cells = everything not in the main run. Each must be a single-cell
    // branch attached to a main cell with no neighbouring side cell (no L-tail
    // or 2-cell branches in this version).
    const sideCells = cluster.filter(c =>
      mainOrientation === 'z' ? c.x !== mainAxisCoord : c.z !== mainAxisCoord
    );
    const branches = [];
    for (const sc of sideCells) {
      const adjacentMain = mainCells.find(mc =>
        Math.abs(mc.x - sc.x) + Math.abs(mc.z - sc.z) === 1
      );
      if (!adjacentMain) return null;
      const adjacentSide = sideCells.find(o =>
        o !== sc && Math.abs(o.x - sc.x) + Math.abs(o.z - sc.z) === 1
      );
      if (adjacentSide) return null;
      let axis;
      if      (sc.x === adjacentMain.x + 1) axis = '+x';
      else if (sc.x === adjacentMain.x - 1) axis = '-x';
      else if (sc.z === adjacentMain.z + 1) axis = '+z';
      else                                  axis = '-z';
      branches.push({ x: sc.x, z: sc.z, axis });
    }

    // Anchor: the cluster cell with smallest (x, then z). Used so only one
    // cell renders the composite mesh; others render nothing.
    const sorted = [...cluster].sort((a, b) => a.x - b.x || a.z - b.z);
    const anchorX = sorted[0].x, anchorZ = sorted[0].z;

    return {
      mainOrientation,
      mainCells,
      branches,
      bbox: { xMin, xMax, zMin, zMax },
      anchorX,
      anchorZ,
    };
  }

  // Walk ± along x and z from (x,z) over contiguous houses. Tries linear first,
  // then composite (L/T-shapes), then falls back to solo. Returns:
  // Returns a {stone, stoneD, roof, roofD} palette derived from a neighbour
  // house's buildingType, or null when the building should keep its native
  // palette. Used to make adjacent forced-variant houses (manor / skyscraper
  // / castle turret) blend into a single visual structure.
  function getMergedBuildingPalette(x, z, selfType) {
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (let i = 0; i < dirs.length; i++) {
      const nx = x + dirs[i][0], nz = z + dirs[i][1];
      if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
      const n = world[nx] && world[nx][nz];
      if (!n || n.kind !== 'house') continue;
      const bt = n.buildingType;
      if (!bt || bt === selfType) continue;
      if (bt === 'manor') {
        return {
          stone:  M.manorBrick,
          stoneD: M.manorBrickD,
          roof:   M.manorRoof,
          roofD:  M.manorRoofD,
        };
      }
      if (bt === 'turret') {
        return {
          stone:  M.castleStone,
          stoneD: M.castleStoneD,
          roof:   M.castleRoof || M.towerRoof,
          roofD:  M.castleRoofD || M.towerRoofD,
        };
      }
      if (bt === 'skyscraper') {
        return {
          stone:  M.skyGlass || M.towerStone,
          stoneD: M.skyGlassD || M.towerStoneD,
          roof:   M.towerRoof,
          roofD:  M.towerRoofD,
        };
      }
    }
    return null;
  }

  //   { kind: 'linear',    isAnchor, length, orientation, anchorX, anchorZ }
  //   { kind: 'composite', isAnchor, topology }
  //   { kind: 'solo',      isAnchor: true,   anchorX, anchorZ }
  function findHouseCluster(x, z) {
    if (!isClusterableHouseAt(x, z)) {
      return { kind: 'solo', isAnchor: true, anchorX: x, anchorZ: z };
    }
    if (isTurretHouse(x, z)) {
      return { kind: 'turret', isAnchor: true, anchorX: x, anchorZ: z };
    }
    let xMin = x, xMax = x;
    while (isClusterableHouseAt(xMin - 1, z)) xMin--;
    while (isClusterableHouseAt(xMax + 1, z)) xMax++;
    let zMin = z, zMax = z;
    while (isClusterableHouseAt(x, zMin - 1)) zMin--;
    while (isClusterableHouseAt(x, zMax + 1)) zMax++;
    const xLen = xMax - xMin + 1, zLen = zMax - zMin + 1;

    if (xLen > 1 && zLen === 1) {
      let pure = true;
      for (let i = xMin; i <= xMax && pure; i++) {
        if (isClusterableHouseAt(i, z - 1) ||
            isClusterableHouseAt(i, z + 1)) pure = false;
      }
      if (pure) return { kind: 'linear', isAnchor: x === xMin, length: xLen, orientation: 'x', anchorX: xMin, anchorZ: z };
    }
    if (zLen > 1 && xLen === 1) {
      let pure = true;
      for (let j = zMin; j <= zMax && pure; j++) {
        if (isClusterableHouseAt(x - 1, j) ||
            isClusterableHouseAt(x + 1, j)) pure = false;
      }
      if (pure) return { kind: 'linear', isAnchor: z === zMin, length: zLen, orientation: 'z', anchorX: x, anchorZ: zMin };
    }

    // Linear failed → try square (2x2) first, then L/T composite.
    const cluster = bfsHouseCluster(x, z);

    const square = trySquare(cluster);
    if (square) {
      return {
        kind: 'square',
        isAnchor: x === square.anchorX && z === square.anchorZ,
        anchorX: square.anchorX,
        anchorZ: square.anchorZ,
      };
    }

    const composite = tryComposite(cluster);
    if (composite) {
      return {
        kind: 'composite',
        isAnchor: x === composite.anchorX && z === composite.anchorZ,
        anchorX: composite.anchorX,
        anchorZ: composite.anchorZ,
        topology: composite,
      };
    }

    return { kind: 'solo', isAnchor: true, anchorX: x, anchorZ: z };
  }

  // Detect a 2x2 solid square cluster — 4 cells forming a perfect 2x2 block,
  // anchored at the (xMin, zMin) corner. Returns null otherwise.
  function trySquare(cluster) {
    if (cluster.length !== 4) return null;
    const xs = cluster.map(c => c.x), zs = cluster.map(c => c.z);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const zMin = Math.min(...zs), zMax = Math.max(...zs);
    if (xMax - xMin !== 1 || zMax - zMin !== 1) return null;
    const cells = new Set(cluster.map(c => c.x + ',' + c.z));
    for (let i = xMin; i <= xMax; i++) {
      for (let j = zMin; j <= zMax; j++) {
        if (!cells.has(i + ',' + j)) return null;
      }
    }
    return { anchorX: xMin, anchorZ: zMin };
  }

  // 4-neighbour flood fill over connected houses, used to find every cell
  // potentially affected when a placement adds/removes a connection.
  function bfsHouseCluster(x, z) {
    // Turret-houses act as cluster boundaries: they're not traversed through,
    // and they aren't included in clusters anchored at OTHER cells. They are
    // returned (alone) when the BFS starts on the turret cell itself, so refresh
    // logic still lights them up.
    const result = [];
    const seen = new Set();
    const queue = [{ x, z, isStart: true }];
    while (queue.length) {
      const c = queue.shift();
      const k = c.x + ',' + c.z;
      if (seen.has(k)) continue;
      seen.add(k);
      if (!isClusterableHouseAt(c.x, c.z)) continue;
      const turret = isTurretHouse(c.x, c.z);
      if (turret && !c.isStart) continue;
      result.push({ x: c.x, z: c.z });
      if (turret) continue; // don't expand through a turret
      queue.push({ x: c.x + 1, z: c.z });
      queue.push({ x: c.x - 1, z: c.z });
      queue.push({ x: c.x, z: c.z + 1 });
      queue.push({ x: c.x, z: c.z - 1 });
    }
    return result;
  }

  const FENCE_SIDES = new Set(['n', 's', 'e', 'w', 'center-x', 'center-z']);

  function normalizeFenceSide(side) {
    return FENCE_SIDES.has(side) ? side : 'n';
  }

  function fenceAxisForSide(side) {
    const normalized = normalizeFenceSide(side);
    return (normalized === 'n' || normalized === 's' || normalized === 'center-x') ? 'x' : 'z';
  }

  const FENCE_STYLES = new Set(['wood', 'garden']);

  function normalizeFenceStyle(style) {
    return FENCE_STYLES.has(style) ? style : 'wood';
  }

  function fenceStyleFromAppearance(appearance) {
    const normalized = (typeof normalizeAppearance === 'function') ? normalizeAppearance(appearance) : appearance;
    return normalizeFenceStyle(normalized && normalized.fenceStyle);
  }

  function fenceStyleForCell(cell) {
    return fenceStyleFromAppearance(cell && cell.appearance);
  }

  function fenceAppearanceBatchable(cell) {
    const appearance = (typeof normalizeAppearance === 'function') ? normalizeAppearance(cell && cell.appearance) : (cell && cell.appearance);
    if (!appearance) return true;
    return Object.keys(appearance).every(key => key === 'fenceStyle');
  }

  function fenceBatchSignatureForCell(x, z) {
    const cell = getWorldCell(x, z);
    if (!cell || cell.kind !== 'fence') return null;
    if (cell.terrain === 'path' || isCastleFence(x, z) || isEditableIslandCell(x, z)) return null;
    if (!fenceAppearanceBatchable(cell) || cell.rotationY || cell.offsetX || cell.offsetY || cell.offsetZ) return null;
    const side = normalizeFenceSide(cell.fenceSide);
    const level = Math.max(1, Math.min(MAX_FLOORS, cell.floors || 1));
    const style = fenceStyleForCell(cell);
    const axis = fenceAxisForSide(side);
    const tileLevel = tileLevelForCell(cell);
    return {
      key: [side, level, style, axis, cell.terrain || 'grass', tileLevel].join('|'),
      side,
      level,
      style,
      axis,
    };
  }

  function findFenceRenderSpan(x, z) {
    const sig = fenceBatchSignatureForCell(x, z);
    if (!sig) return null;
    const same = (sx, sz) => {
      const other = fenceBatchSignatureForCell(sx, sz);
      return other && other.key === sig.key;
    };
    let min = sig.axis === 'x' ? x : z;
    let max = min;
    while (sig.axis === 'x' ? same(min - 1, z) : same(x, min - 1)) min--;
    while (sig.axis === 'x' ? same(max + 1, z) : same(x, max + 1)) max++;
    const length = max - min + 1;
    const anchorX = sig.axis === 'x' ? min : x;
    const anchorZ = sig.axis === 'z' ? min : z;
    return {
      side: sig.side,
      level: sig.level,
      style: sig.style,
      axis: sig.axis,
      length,
      anchorX,
      anchorZ,
      isAnchor: x === anchorX && z === anchorZ,
    };
  }
