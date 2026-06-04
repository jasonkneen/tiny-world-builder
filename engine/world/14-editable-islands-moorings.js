  // -------- editable duplicate islands --------
  // Duplicate islands keep their own logical board coordinates so every tool
  // can keep using setCell(), while the island group can be positioned and
  // rotated independently in 3D.
  const editableIslands = [];
  const editableIslandById = new Map();
  const editableIslandByBoardKey = new Map();
  let selectedEditableIslandId = null;
  let selectedEditableIslandEngineRef = null;
  let editableIslandSerial = 1;

  function editableIslandBoardKey(boardX, boardZ) {
    return boardX + ',' + boardZ;
  }

  function editableIslandForBoard(boardX, boardZ) {
    return editableIslandByBoardKey.get(editableIslandBoardKey(boardX, boardZ)) || null;
  }

  function editableIslandForWorldCell(x, z) {
    return editableIslandForBoard(floorDiv(x, GRID), floorDiv(z, GRID));
  }

  function isEditableIslandBoard(boardX, boardZ) {
    return !!editableIslandForBoard(boardX, boardZ);
  }

  function isEditableIslandCell(x, z) {
    return !!editableIslandForWorldCell(x, z);
  }

  function localCoordForWorldCell(x, z) {
    return {
      boardX: floorDiv(x, GRID),
      boardZ: floorDiv(z, GRID),
      x: positiveMod(x, GRID),
      z: positiveMod(z, GRID),
    };
  }

  function selectedEditableIsland() {
    return selectedEditableIslandId ? editableIslandById.get(selectedEditableIslandId) || null : null;
  }

  function editableIslandEngineTarget(islandId, engineId) {
    const island = islandId ? editableIslandById.get(islandId) : null;
    if (!island || !Array.isArray(island.engines)) return null;
    const engine = island.engines.find(item => item && item.id === engineId) || null;
    return engine ? { island, engine } : null;
  }

  function selectedEditableIslandEngineTarget() {
    return selectedEditableIslandEngineRef
      ? editableIslandEngineTarget(selectedEditableIslandEngineRef.islandId, selectedEditableIslandEngineRef.engineId)
      : null;
  }

  // The HOME world is an island too (just flagged __home). It gets the SAME
  // engine system as editable islands so its engines are selectable + upgradeable
  // (propeller default -> jet). It lives ONLY in editableIslandById (so engine
  // picking resolves it) — NOT in the editableIslands array or board-key map, so
  // it still renders/behaves as home and is never moved/serialized as a sky island.
  let homeIslandRef = null;
  function ensureHomeIslandObject() {
    if (homeIslandRef) return homeIslandRef;
    homeIslandRef = {
      id: 'home', __home: true,
      boardX: 0, boardZ: 0,
      positionX: 0, positionY: 0, positionZ: 0, rotationY: 0,
      engines: (typeof defaultEditableIslandEngineStates === 'function') ? defaultEditableIslandEngineStates() : [],
      baseGroup: null, group: null, contentGroup: null, lod: 'full',
    };
    editableIslandById.set('home', homeIslandRef);
    return homeIslandRef;
  }
  // Build the home island's selectable lift engines into `parent` (the home
  // border group). Called by addIslandRocketEngines on each home-border (re)build;
  // engine STATES persist on homeIslandRef so upgrades survive a rebuild.
  function buildHomeIslandEngines(parent) {
    if (!parent || typeof buildEditableIslandEngineMesh !== 'function') return;
    const home = ensureHomeIslandObject();
    home.baseGroup = parent;
    home.group = parent;
    for (const engineState of home.engines) {
      engineState.mesh = null;
      engineState.propeller = null;
      const mesh = buildEditableIslandEngineMesh(home, engineState);
      if (mesh) parent.add(mesh);
    }
  }

  function stampEditableIslandSurface(root, island) {
    if (!root || !island) return;
    const data = {
      kind: 'editable-island-surface',
      editableIslandSurface: true,
      editableIslandId: island.id,
      boardX: island.boardX,
      boardZ: island.boardZ,
    };
    root.traverse(node => {
      node.userData = Object.assign({}, node.userData || {}, data);
    });
  }

  function makeEditableIslandDefaultSurface(island) {
    const span = GRID * TILE;
    const surface = new THREE.Mesh(
      getOpenBoxGeometry(span * 1.012, TOP_H, span * 1.012, false, true, false, false, false, false),
      M.grass
    );
    surface.name = 'editable-island-default-grass-surface';
    surface.position.y = TOP_H * 0.5 - 0.014;
    surface.castShadow = false;
    surface.receiveShadow = true;
    surface.frustumCulled = true;
    stampEditableIslandSurface(surface, island);
    return surface;
  }

  function makeEditableIslandProxy(island) {
    const g = new THREE.Group();
    g.name = (island && island.id ? island.id : 'editable-island') + '-proxy';
    g.userData = {
      kind: 'editable-island-proxy',
      noPointerPick: false,
      editableIslandId: island && island.id,
      boardX: island && island.boardX,
      boardZ: island && island.boardZ,
    };
    const span = GRID * TILE;
    const top = new THREE.Mesh(getOpenBoxGeometry(span, 0.12, span, false, true, false, false, false, false), islandShellMaterial(M.grass));
    top.position.y = 0.02;
    const dirt = new THREE.Mesh(getOpenBoxGeometry(span * 0.98, 0.40, span * 0.98, true, true, false, false, false, false), islandShellMaterial(M.dirtRich));
    dirt.position.y = -0.22;
    const under = new THREE.Mesh(getOpenBoxGeometry(span * 0.78, 0.28, span * 0.78, true, true, false, false, false, false), islandShellMaterial(M.islandUnderD));
    under.position.y = -0.58;
    g.add(top, dirt, under);
    stampEditableIslandSurface(top, island);
    g.traverse(node => {
      if (node.isMesh) {
        node.castShadow = false;
        node.receiveShadow = false;
        node.frustumCulled = false;
      }
    });
    g.visible = false;
    return g;
  }

  function rebuildEditableIslandSurface(island) {
    if (!island || !island.contentGroup) return;
    if (island.surfaceMesh && island.surfaceMesh.parent) island.surfaceMesh.parent.remove(island.surfaceMesh);
    if (island.surfaceMesh) disposeGroup(island.surfaceMesh);
    island.surfaceMesh = makeEditableIslandDefaultSurface(island);
    island.contentGroup.add(island.surfaceMesh);
  }

  function disposeEditableIslandSurface(island) {
    if (!island || !island.surfaceMesh) return;
    if (island.surfaceMesh.parent) island.surfaceMesh.parent.remove(island.surfaceMesh);
    disposeGroup(island.surfaceMesh);
    island.surfaceMesh = null;
  }

  function makeEditableIslandBase(island) {
    const g = new THREE.Group();
    vbox(g, GRID * TILE, 0.10, GRID * TILE, 0, -DIRT_H - 0.055, 0, M.islandUnderD, { noGap: true, skipTop: true });
    voxelInvertedSteppedRoof(g, GRID * TILE, GRID * TILE, -DIRT_H - 0.020, M.islandUnder, M.islandUnderD);
    addIslandSideBacking(g);
    addIslandUtilityUnderside(g);
    addEditableIslandLiftEngines(g, island);
    addIslandEdgeDressing(g);
    optimizeVoxelObjectGroup(g, { reason: 'editable-island-base' });
    mergeStaticBaseMeshesByMaterial(g, { reason: 'editable-island-base' });
    prepareHomeBorderForRender(g);
    return g;
  }

  function disposeEditableIslandBase(island) {
    if (!island || !island.baseGroup) return;
    if (Array.isArray(island.engines)) {
      island.engines.forEach(engine => {
        if (engine && engine.propeller) editableIslandEnginePropellers.delete(engine.propeller);
        if (engine) {
          engine.mesh = null;
          engine.propeller = null;
        }
      });
    }
    if (island.baseGroup.parent) island.baseGroup.parent.remove(island.baseGroup);
    disposeGroup(island.baseGroup);
    island.baseGroup = null;
  }

  function ensureEditableIslandFullVisuals(island) {
    if (!island || !island.group) return;
    if (!island.baseGroup) {
      island.baseGroup = makeEditableIslandBase(island);
      island.group.add(island.baseGroup);
    }
    // Parity with the home world: render the island's terrain PER-CELL (so
    // stone/dirt/sand/etc. show like home) instead of a flat grass slab that
    // buries painted terrain. The legacy slab is dropped.
    ensureEditableIslandCellTiles(island);
  }

  // Render every cell of the island board as a terrain tile, exactly like the
  // home board. Unpainted cells default to grass via getWorldCell. Rendered once
  // and kept (hidden with contentGroup at proxy LOD), so there's no per-frame or
  // per-LOD-transition churn. (Follow-up: dispose tiles at proxy LOD to cut the
  // 50-island stress-demo memory footprint.)
  function ensureEditableIslandCellTiles(island) {
    disposeEditableIslandSurface(island); // remove the legacy grass slab
    if (island.cellTilesRendered || typeof renderCellTile !== 'function') return;
    const bx = island.boardX * GRID, bz = island.boardZ * GRID;
    for (let lx = 0; lx < GRID; lx++) {
      for (let lz = 0; lz < GRID; lz++) {
        renderCellTile(bx + lx, bz + lz, { animate: false });
      }
    }
    island.cellTilesRendered = true;
  }

  function releaseEditableIslandFullVisuals(island) {
    disposeEditableIslandBase(island);
    disposeEditableIslandSurface(island);
  }

  function editableIslandFocusDistance(island) {
    if (!island || !island.group) return Infinity;
    const dx = (island.positionX || 0) - target.x;
    const dz = (island.positionZ || 0) - target.z;
    const dy = (island.positionY || 0) * 0.45;
    return Math.hypot(dx, dz, dy);
  }

  function editableIslandFullLodBudget() {
    // +8 full-LOD islands across every tier so a handful of sky islands all
    // render with their real base + per-cell surface instead of a flat proxy.
    const count = editableIslands.length;
    if (count <= 14) return count;
    if (count <= 24) return 12;
    if (count <= 40) return 11;
    return 10;
  }

  function editableIslandBaseDesiredLod(island) {
    if (!island) return 'hidden';
    if (selectedEditableIslandId && island.id === selectedEditableIslandId) return 'full';
    const span = GRID * TILE;
    const d = editableIslandFocusDistance(island);
    // Widened so a cluster of ~8 placed islands around the camera all keep their
    // real base + per-cell surface (paired with the +8 full-LOD count budget).
    const fullDistance = Math.max(40, span * 5.2);
    const proxyDistance = Math.max(72, span * 10.0);
    if (d <= fullDistance) return 'full';
    if (d <= proxyDistance) return 'proxy';
    return 'hidden';
  }

  function editableIslandFullLodSet() {
    const budget = editableIslandFullLodBudget();
    const full = new Set();
    if (budget <= 0) return full;
    const candidates = [];
    for (const island of editableIslands) {
      if (!island) continue;
      if (selectedEditableIslandId && island.id === selectedEditableIslandId) {
        full.add(island.id);
        continue;
      }
      if (editableIslandBaseDesiredLod(island) === 'full') {
        candidates.push({ island, d: editableIslandFocusDistance(island) });
      }
    }
    candidates.sort((a, b) => a.d - b.d);
    for (const item of candidates) {
      if (full.size >= budget) break;
      full.add(item.island.id);
    }
    return full;
  }

  function editableIslandDesiredLod(island, fullLodSet = null) {
    const base = editableIslandBaseDesiredLod(island);
    if (base !== 'full') return base;
    if (!fullLodSet) return base;
    return fullLodSet.has(island.id) ? 'full' : 'proxy';
  }

  function setEditableIslandLod(island, lod, force = false) {
    if (!island || (!force && island.lod === lod)) return;
    if (lod === 'full') ensureEditableIslandFullVisuals(island);
    else releaseEditableIslandFullVisuals(island);
    island.lod = lod;
    if (island.group) island.group.visible = lod !== 'hidden';
    if (island.baseGroup) island.baseGroup.visible = lod === 'full';
    if (island.contentGroup) island.contentGroup.visible = lod === 'full';
    if (island.proxyGroup) island.proxyGroup.visible = lod === 'proxy';
  }

  function updateEditableIslandLods(force = false) {
    const fullLodSet = editableIslandFullLodSet();
    for (const island of editableIslands) {
      const lod = editableIslandDesiredLod(island, fullLodSet);
      if (force || island.lod !== lod) setEditableIslandLod(island, lod, force);
    }
  }

  function editableIslandPerfStats() {
    const fullLodSet = editableIslandFullLodSet();
    const stats = { count: editableIslands.length, full: 0, proxy: 0, hidden: 0, fullBudget: editableIslandFullLodBudget() };
    for (const island of editableIslands) {
      const lod = island.lod || editableIslandDesiredLod(island, fullLodSet);
      if (lod === 'full') stats.full++;
      else if (lod === 'proxy') stats.proxy++;
      else stats.hidden++;
    }
    return stats;
  }

  function applyEditableIslandTransform(island) {
    if (!island || !island.group) return;
    island.group.position.set(island.positionX || 0, island.positionY || 0, island.positionZ || 0);
    island.group.rotation.set(0, island.rotationY || 0, 0);
    island.group.updateMatrixWorld(true);
    if (typeof rebuildMooringCables === 'function') rebuildMooringCables();
  }

  // -------- editable island warp-in arrival --------
  // Final-arrival pass inspired by capital ships exiting hyperspace: a fast
  // blue-white streak collapses into the destination, the island overshoots a
  // fraction, then eases back into its real saved transform.
  const EDITABLE_ISLAND_WARP_DURATION = 0.94;
  const EDITABLE_ISLAND_WARP_STREAKS = 18;
  const editableIslandWarpAnims = [];
  const editableIslandWarpTmpA = new THREE.Vector3();
  const editableIslandWarpTmpB = new THREE.Vector3();
  const editableIslandWarpTmpC = new THREE.Vector3();
  const editableIslandWarpTmpD = new THREE.Vector3();
  const editableIslandWarpTmpRight = new THREE.Vector3();
  const editableIslandWarpTmpUp = new THREE.Vector3();
  const editableIslandWarpDefaultAxis = new THREE.Vector3(0, 0, 1);

  function editableIslandWarpClamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function editableIslandWarpEaseOutExpo(t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function editableIslandWarpEaseOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function editableIslandWarpSetGroupPosition(group, point, scale) {
    if (!group) return;
    group.position.copy(point);
    group.scale.setScalar(scale);
    group.updateMatrixWorld(true);
  }

  function disposeEditableIslandWarpEffect(anim) {
    if (!anim || !anim.effectGroup) return;
    if (anim.effectGroup.parent) anim.effectGroup.parent.remove(anim.effectGroup);
    const disposedMaterials = new Set();
    anim.effectGroup.traverse(node => {
      if (node.geometry) node.geometry.dispose();
      if (node.material && node.material.dispose && !disposedMaterials.has(node.material)) {
        disposedMaterials.add(node.material);
        node.material.dispose();
      }
    });
    anim.effectGroup = null;
  }

  function makeEditableIslandWarpStreak(start, final, right, up, seed, material) {
    const jitterA = ((seedHash('warp-a-' + seed) % 1000) / 1000 - 0.5);
    const jitterB = ((seedHash('warp-b-' + seed) % 1000) / 1000 - 0.5);
    const spread = GRID * (0.16 + (seed % 5) * 0.035);
    const tail = editableIslandWarpTmpA.copy(start)
      .addScaledVector(right, jitterA * spread * 3.2)
      .addScaledVector(up, jitterB * spread * 2.0);
    const nose = editableIslandWarpTmpB.copy(final)
      .addScaledVector(right, jitterA * spread * 0.45)
      .addScaledVector(up, jitterB * spread * 0.28);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      tail.x, tail.y, tail.z,
      nose.x, nose.y, nose.z,
    ]), 3));
    const line = new THREE.Line(geo, material);
    line.userData.warpBaseOpacity = 0.16 + (seed % 7) * 0.035;
    line.userData.warpDelay = (seed % 6) * 0.022;
    line.frustumCulled = false;
    return line;
  }

  function startEditableIslandWarpArrival(island, opts = {}) {
    if (!island || !island.group) return;
    if (opts.warpIn === false) return;
    const final = new THREE.Vector3(island.positionX || 0, island.positionY || 0, island.positionZ || 0);
    const cam = (typeof camera !== 'undefined' && camera) ? camera : null;
    if (cam && cam.updateMatrixWorld) cam.updateMatrixWorld();
    const toCamera = editableIslandWarpTmpA.copy(cam ? cam.position : final.clone().add(new THREE.Vector3(0, 8, 18))).sub(final);
    if (toCamera.lengthSq() < 0.001) toCamera.set(0, 0.35, 1);
    toCamera.normalize();
    if (cam && cam.matrixWorld) {
      editableIslandWarpTmpRight.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
      editableIslandWarpTmpUp.setFromMatrixColumn(cam.matrixWorld, 1).normalize();
    } else {
      editableIslandWarpTmpRight.set(1, 0, 0);
      editableIslandWarpTmpUp.set(0, 1, 0);
    }
    const travel = Math.max(22, GRID * 3.4);
    const start = editableIslandWarpTmpB.copy(final)
      .addScaledVector(toCamera, travel)
      .addScaledVector(editableIslandWarpTmpRight, GRID * 0.75)
      .addScaledVector(editableIslandWarpTmpUp, GRID * 0.45);
    const overshoot = editableIslandWarpTmpC.copy(final).addScaledVector(toCamera, -Math.max(0.9, GRID * 0.13));
    const effectGroup = new THREE.Group();
    effectGroup.name = island.id + '-warp-arrival';
    effectGroup.userData.kind = 'editable-island-warp-arrival';
    effectGroup.frustumCulled = false;
    const streakMaterial = new THREE.LineBasicMaterial({
      color: 0xbbefff,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    for (let i = 0; i < EDITABLE_ISLAND_WARP_STREAKS; i++) {
      effectGroup.add(makeEditableIslandWarpStreak(start, final, editableIslandWarpTmpRight, editableIslandWarpTmpUp, i, streakMaterial));
    }
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xdffbff,
      transparent: true,
      opacity: 0.58,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0x75dbff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ringQuat = new THREE.Quaternion().setFromUnitVectors(editableIslandWarpDefaultAxis, toCamera);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.026 + i * 0.009, 8, 64), ringMaterial);
      ring.position.copy(final).addScaledVector(toCamera, -0.15 + i * 0.08);
      ring.quaternion.copy(ringQuat);
      ring.scale.setScalar(GRID * (0.10 + i * 0.05));
      ring.userData.warpRing = true;
      ring.userData.warpDelay = 0.45 + i * 0.08;
      ring.frustumCulled = false;
      effectGroup.add(ring);
    }
    const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), flashMaterial);
    flash.position.copy(final);
    flash.scale.setScalar(GRID * 0.18);
    flash.userData.warpFlash = true;
    flash.frustumCulled = false;
    effectGroup.add(flash);
    worldGroup.add(effectGroup);

    const anim = {
      island,
      group: island.group,
      final: final.clone(),
      start: start.clone(),
      overshoot: overshoot.clone(),
      toCamera: toCamera.clone(),
      effectGroup,
      streakMaterial,
      ringMaterial,
      flashMaterial,
      t: 0,
      dur: EDITABLE_ISLAND_WARP_DURATION,
      arrivalFired: false,
    };
    island.group.userData.warpArrival = true;
    island.group.visible = false;
    editableIslandWarpSetGroupPosition(island.group, start, 0.08);
    editableIslandWarpAnims.push(anim);
    if (typeof playSfx === 'function') playSfx('whoosh', 0.28);
  }

  function tickEditableIslandWarpArrivals(dt) {
    if (!editableIslandWarpAnims.length) return;
    for (let i = editableIslandWarpAnims.length - 1; i >= 0; i--) {
      const anim = editableIslandWarpAnims[i];
      if (!anim || !anim.group || !anim.group.parent) {
        disposeEditableIslandWarpEffect(anim);
        editableIslandWarpAnims.splice(i, 1);
        continue;
      }
      anim.t += dt;
      const u = editableIslandWarpClamp01(anim.t / anim.dur);
      const moveU = editableIslandWarpClamp01((u - 0.16) / 0.58);
      const settleU = editableIslandWarpClamp01((u - 0.70) / 0.30);
      if (u >= 0.14) anim.group.visible = true;
      if (settleU > 0) {
        editableIslandWarpTmpD.lerpVectors(anim.overshoot, anim.final, editableIslandWarpEaseOutCubic(settleU));
      } else {
        editableIslandWarpTmpD.lerpVectors(anim.start, anim.overshoot, editableIslandWarpEaseOutExpo(moveU));
      }
      const squash = settleU > 0
        ? 1 + Math.sin(settleU * Math.PI) * 0.035
        : 0.08 + editableIslandWarpEaseOutExpo(moveU) * 1.06;
      editableIslandWarpSetGroupPosition(anim.group, editableIslandWarpTmpD, Math.max(0.08, squash));
      anim.streakMaterial.opacity = Math.max(0, 0.80 * (1 - editableIslandWarpClamp01((u - 0.32) / 0.40)));
      anim.ringMaterial.opacity = Math.max(0, 0.66 * (1 - editableIslandWarpClamp01((u - 0.54) / 0.42)));
      anim.flashMaterial.opacity = Math.max(0, 0.24 * (1 - editableIslandWarpClamp01((u - 0.48) / 0.34)));
      if (anim.effectGroup) {
        anim.effectGroup.children.forEach(child => {
          if (child.userData && child.userData.warpRing) {
            const ru = editableIslandWarpClamp01((u - child.userData.warpDelay) / 0.32);
            const ringScale = GRID * (0.15 + editableIslandWarpEaseOutCubic(ru) * 0.82);
            child.scale.setScalar(ringScale);
          } else if (child.userData && child.userData.warpFlash) {
            const fu = editableIslandWarpClamp01((u - 0.43) / 0.24);
            child.scale.setScalar(GRID * (0.18 + editableIslandWarpEaseOutCubic(fu) * 1.35));
          } else if (child.userData && child.userData.warpBaseOpacity !== undefined) {
            child.visible = u >= child.userData.warpDelay && u <= 0.72;
          }
        });
      }
      if (!anim.arrivalFired && u >= 0.54) {
        anim.arrivalFired = true;
        if (typeof playSfx === 'function') playSfx('ripple', 0.22);
        if (typeof triggerUndersideDebrisBurstAt === 'function') {
          triggerUndersideDebrisBurstAt(anim.final.x, anim.final.z, 3);
        }
      }
      if (u >= 1) {
        anim.group.userData.warpArrival = false;
        anim.group.visible = true;
        editableIslandWarpSetGroupPosition(anim.group, anim.final, 1);
        anim.group.rotation.set(0, anim.island.rotationY || 0, 0);
        anim.group.updateMatrixWorld(true);
        disposeEditableIslandWarpEffect(anim);
        editableIslandWarpAnims.splice(i, 1);
      }
    }
  }
  window.tickEditableIslandWarpArrivals = tickEditableIslandWarpArrivals;

  function editableIslandCellDisplayPoint(island, localX, localZ) {
    const p = tilePos(localX, localZ);
    if (!island || !island.contentGroup) return p;
    island.contentGroup.localToWorld(p);
    xrWorldRoot.worldToLocal(p);
    return p;
  }

  function cellRenderParentForCell(x, z) {
    const island = editableIslandForWorldCell(x, z);
    return island ? island.contentGroup : worldGroup;
  }

  function cellRenderPositionForCell(x, z) {
    const island = editableIslandForWorldCell(x, z);
    if (island) {
      const c = localCoordForWorldCell(x, z);
      return tilePos(c.x, c.z);
    }
    return tilePos(x, z);
  }

  // island/out are optional hot-path hints. Pass a precomputed island (null is
  // a valid "no island" value; omit to recompute) and a scratch Vector3 in out
  // to avoid the per-cell editableIslandForWorldCell lookup and tilePos alloc.
  function cellDisplayPointForCell(x, z, island, out) {
    if (island === undefined) island = editableIslandForWorldCell(x, z);
    if (island) {
      const c = localCoordForWorldCell(x, z);
      return editableIslandCellDisplayPoint(island, c.x, c.z);
    }
    return out ? tilePosInto(out, x, z) : tilePos(x, z);
  }

  function stampCellUserData(root, x, z) {
    if (!root || !root.userData) return;
    const island = editableIslandForWorldCell(x, z);
    if (island) {
      const c = localCoordForWorldCell(x, z);
      root.userData.gx = c.x;
      root.userData.gz = c.z;
      root.userData.boardX = island.boardX;
      root.userData.boardZ = island.boardZ;
      root.userData.editableIslandId = island.id;
    } else {
      root.userData.gx = x;
      root.userData.gz = z;
      delete root.userData.boardX;
      delete root.userData.boardZ;
      delete root.userData.editableIslandId;
    }
  }

  // --- whole-island selection outline (box edges, child of the island group so
  // it follows move/rotate) ---
  let islandSelectionOutlineMesh = null;
  const islandSelectionOutlineMat = new THREE.LineBasicMaterial({
    color: 0x39c0ff, transparent: true, opacity: 0.95, depthTest: false,
  });
  function setIslandSelectionOutline(island) {
    if (islandSelectionOutlineMesh) {
      if (islandSelectionOutlineMesh.parent) islandSelectionOutlineMesh.parent.remove(islandSelectionOutlineMesh);
      if (islandSelectionOutlineMesh.geometry) islandSelectionOutlineMesh.geometry.dispose();
      islandSelectionOutlineMesh = null;
    }
    if (!island || island.__home || !island.group) return;
    const half = GRID * TILE * 0.5 + 0.08;
    const top = TOP_H + 0.2;
    const bottom = -(DIRT_H + 3.4);
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(half * 2, top - bottom, half * 2));
    const mesh = new THREE.LineSegments(geo, islandSelectionOutlineMat);
    mesh.position.y = (top + bottom) * 0.5;
    mesh.renderOrder = 999;
    mesh.frustumCulled = false;
    island.group.add(mesh);
    islandSelectionOutlineMesh = mesh;
  }

  function selectEditableIsland(island) {
    selectedEditableIslandId = island ? island.id : null;
    selectedEditableIslandEngineRef = null;
    updateTransformGizmo(null);
    updateEditableIslandLods(true);
    setIslandSelectionOutline(island && !island.__home ? island : null);
  }

  // Delete a single sky island (with undo: the history snapshot captures islands).
  function removeEditableIsland(island) {
    if (!island || island.__home) return false;
    if (typeof pushWorldHistorySnapshot === 'function') pushWorldHistorySnapshot();
    setIslandSelectionOutline(null);
    // Drop moorings anchored to this island.
    if (Array.isArray(mooringCables) && mooringCables.length) {
      let changed = false;
      for (let i = mooringCables.length - 1; i >= 0; i--) {
        const c = mooringCables[i];
        if ((c.a && c.a.scope === 'island' && c.a.islandId === island.id) ||
            (c.b && c.b.scope === 'island' && c.b.islandId === island.id)) {
          mooringCables.splice(i, 1); changed = true;
        }
      }
      if (changed && typeof rebuildMooringCables === 'function') rebuildMooringCables();
    }
    if (Array.isArray(island.engines)) {
      island.engines.forEach(eng => { if (eng && eng.propeller) editableIslandEnginePropellers.delete(eng.propeller); });
    }
    if (island.group && island.group.parent) island.group.parent.remove(island.group);
    disposeGroup(island.group);
    const startX = island.boardX * GRID, startZ = island.boardZ * GRID;
    for (let x = startX; x < startX + GRID; x++) {
      if (!world[x]) continue;
      for (let z = startZ; z < startZ + GRID; z++) {
        delete world[x][z];
        const key = x + ',' + z;
        const entry = cellMeshes[key];
        if (entry) {
          if (entry.tile) disposeGroup(entry.tile);
          if (entry.object) disposeGroup(entry.object);
          if (entry.extras) for (const m of entry.extras) disposeGroup(m);
          delete cellMeshes[key];
        }
      }
    }
    const idx = editableIslands.indexOf(island);
    if (idx >= 0) editableIslands.splice(idx, 1);
    editableIslandById.delete(island.id);
    editableIslandByBoardKey.delete(editableIslandBoardKey(island.boardX, island.boardZ));
    if (selectedEditableIslandId === island.id) selectedEditableIslandId = null;
    if (typeof selectedTransformGizmoIsland !== 'undefined' && selectedTransformGizmoIsland === island) selectedTransformGizmoIsland = null;
    if (typeof updateTransformGizmo === 'function') updateTransformGizmo(null);
    updateEditableIslandLods(true);
    if (typeof saveState === 'function') saveState();
    return true;
  }
  window.removeEditableIsland = removeEditableIsland;
  window.setIslandSelectionOutline = setIslandSelectionOutline;

  function nextEditableIslandBoard() {
    let boardX = 20 + editableIslandSerial;
    while (editableIslandForBoard(boardX, 0)) boardX++;
    return { boardX, boardZ: 0 };
  }

  function createEditableIsland(opts = {}) {
    const board = Number.isInteger(opts.boardX) && Number.isInteger(opts.boardZ)
      ? { boardX: opts.boardX, boardZ: opts.boardZ }
      : nextEditableIslandBoard();
    const serialMatch = typeof opts.id === 'string' ? opts.id.match(/^island-(\d+)$/) : null;
    let id = (typeof opts.id === 'string' && opts.id) ? opts.id : 'island-' + editableIslandSerial++;
    if (serialMatch) editableIslandSerial = Math.max(editableIslandSerial, parseInt(serialMatch[1], 10) + 1);
    if (editableIslandById.has(id)) id = 'island-' + editableIslandSerial++;
    while (editableIslandForBoard(board.boardX, board.boardZ)) {
      const fallbackBoard = nextEditableIslandBoard();
      board.boardX = fallbackBoard.boardX;
      board.boardZ = fallbackBoard.boardZ;
      break;
    }
    const engines = defaultEditableIslandEngineStates(opts.engines);
    const island = {
      id,
      boardX: board.boardX,
      boardZ: board.boardZ,
      group: null,
      baseGroup: null,
      contentGroup: null,
      surfaceMesh: null,
      proxyGroup: null,
      lod: 'full',
      engines,
      positionX: Number.isFinite(opts.positionX) ? opts.positionX : GRID + 1 + editableIslands.length * (GRID + 1),
      positionY: Number.isFinite(opts.positionY) ? opts.positionY : 0,
      positionZ: Number.isFinite(opts.positionZ) ? opts.positionZ : 0,
      rotationY: Number.isFinite(opts.rotationY) ? opts.rotationY : 0,
    };
    const group = new THREE.Group();
    const contentGroup = new THREE.Group();
    const proxyGroup = makeEditableIslandProxy(island);
    group.name = id;
    contentGroup.name = id + '-cells';
    group.userData = { editableIslandId: id, boardX: board.boardX, boardZ: board.boardZ };
    contentGroup.userData = { editableIslandId: id, boardX: board.boardX, boardZ: board.boardZ };
    group.add(contentGroup);
    group.add(proxyGroup);
    worldGroup.add(group);
    island.group = group;
    island.contentGroup = contentGroup;
    island.proxyGroup = proxyGroup;
    editableIslands.push(island);
    editableIslandById.set(id, island);
    editableIslandByBoardKey.set(editableIslandBoardKey(board.boardX, board.boardZ), island);
    destroyGhostBoard(board.boardX, board.boardZ);
    applyEditableIslandTransform(island);

    if (opts.select !== false) selectEditableIsland(island);
    updateEditableIslandLods(true);
    if (opts.warpIn === true || (opts.warpIn !== false && !opts.skipSave)) {
      startEditableIslandWarpArrival(island, opts);
    }
    if (!opts.skipSave) saveState();
    return island;
  }

  function rebuildEditableIslandEngine(island, engineState) {
    if (!island || !engineState || !island.baseGroup) return;
    if (engineState.propeller) editableIslandEnginePropellers.delete(engineState.propeller);
    if (engineState.mesh && engineState.mesh.parent) engineState.mesh.parent.remove(engineState.mesh);
    if (engineState.mesh) disposeGroup(engineState.mesh);
    engineState.mesh = null;
    engineState.propeller = null;
    const mesh = buildEditableIslandEngineMesh(island, engineState);
    if (mesh) island.baseGroup.add(mesh);
    if (selectedEditableIslandEngineRef && selectedEditableIslandEngineRef.islandId === island.id && selectedEditableIslandEngineRef.engineId === engineState.id) {
      notifySelectionChanged();
    }
  }

  function updateEditableIslandEngine(engineTarget, patch = {}) {
    if (!engineTarget || !engineTarget.island || !engineTarget.engine) return;
    const engine = engineTarget.engine;
    if (patch.type !== undefined) engine.type = normalizeEditableIslandEngineType(patch.type);
    if (patch.level !== undefined) engine.level = Math.max(1, Math.min(3, Math.round(Number(patch.level) || 1)));
    if (patch.installed !== undefined) engine.installed = patch.installed !== false;
    rebuildEditableIslandEngine(engineTarget.island, engine);
    saveState();
  }

  function serializeEditableIslands() {
    return editableIslands.map(island => ({
      id: island.id,
      boardX: island.boardX,
      boardZ: island.boardZ,
      positionX: island.positionX || 0,
      positionY: island.positionY || 0,
      positionZ: island.positionZ || 0,
      rotationY: island.rotationY || 0,
      engines: (island.engines || []).map(engine => ({
        id: engine.id,
        slot: engine.slot,
        type: normalizeEditableIslandEngineType(engine.type),
        level: Math.max(1, Math.min(3, Math.round(Number(engine.level) || 1))),
        installed: engine.installed !== false,
      })),
    }));
  }

  // -------- mooring cables --------
  const MOORING_CABLE_MAX = 96;
  const MOORING_CABLE_RADIUS = 0.026;
  const MOORING_CABLE_SEGMENTS = 42;
  const MOORING_ROUTE_SAMPLES = 48;
  const MOORING_HAZARD_CLEARANCE = 0.4; // extra margin when routing a cable around an engine
  const mooringCables = [];
  let mooringCableSerial = 1;
  // Mooring connection styles — each colours the cable; "mooring" is the
  // default plain tie. The list order also drives the radial style picker.
  const MOORING_STYLES = [
    { id: 'power',   label: 'Power',   color: 0xf2b417 },
    { id: 'water',   label: 'Water',   color: 0x2f8fd6 },
    { id: 'waste',   label: 'Waste',   color: 0x4f9a3a },
    { id: 'data',    label: 'Data',    color: 0x9a5ec8 },
    { id: 'mooring', label: 'Mooring', color: 0x0f1216 },
  ];
  const mooringStyleMaterials = {};
  function mooringStyleMaterial(style) {
    const def = MOORING_STYLES.find(s => s.id === style) || MOORING_STYLES[MOORING_STYLES.length - 1];
    if (!mooringStyleMaterials[def.id]) {
      mooringStyleMaterials[def.id] = new THREE.MeshLambertMaterial({ color: def.color, side: THREE.FrontSide });
    }
    return mooringStyleMaterials[def.id];
  }
  // Shared blue highlight swapped onto a cable's meshes while it is hovered.
  const mooringHoverMaterial = new THREE.MeshLambertMaterial({
    color: 0x3a86ff, emissive: 0x16407e, emissiveIntensity: 0.7, side: THREE.FrontSide,
  });
  function normalizeMooringStyleId(value) {
    return MOORING_STYLES.some(s => s.id === value) ? value : 'mooring';
  }
  let pendingMooringAnchor = null;
  let pendingMooringMarker = null;
  let mooringStatusTimer = 0;
  const mooringVecA = new THREE.Vector3();
  const mooringVecB = new THREE.Vector3();
  const mooringVecC = new THREE.Vector3();
  const mooringVecD = new THREE.Vector3();
  const mooringVecHazard = new THREE.Vector3();

  function mooringFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function mooringRound(value) {
    return Math.round(mooringFiniteNumber(value) * 1000) / 1000;
  }

  function normalizeMooringVec3(value) {
    if (!value || typeof value !== 'object') return null;
    return {
      x: mooringRound(value.x),
      y: mooringRound(value.y),
      z: mooringRound(value.z),
    };
  }

  function normalizeMooringAnchor(value) {
    if (!value || typeof value !== 'object') return null;
    const scope = value.scope === 'island' ? 'island' : 'home';
    const local = normalizeMooringVec3(value.local);
    if (!local) return null;
    if (scope === 'island') {
      const islandId = typeof value.islandId === 'string' ? value.islandId : '';
      if (!islandId) return null;
      return { scope, islandId, local };
    }
    return { scope: 'home', islandId: null, local };
  }

  function normalizeMooringCable(value) {
    if (!value || typeof value !== 'object') return null;
    const a = normalizeMooringAnchor(value.a || value.anchorA);
    const b = normalizeMooringAnchor(value.b || value.anchorB);
    if (!a || !b || sameMooringAnchor(a, b)) return null;
    const rawId = typeof value.id === 'string' && value.id ? value.id : 'mooring-' + mooringCableSerial++;
    const match = rawId.match(/^mooring-(\d+)$/);
    if (match) mooringCableSerial = Math.max(mooringCableSerial, parseInt(match[1], 10) + 1);
    return { id: rawId, a, b, style: normalizeMooringStyleId(value.style) };
  }

  function serializeMooringAnchor(anchor) {
    const normalized = normalizeMooringAnchor(anchor);
    return normalized ? {
      scope: normalized.scope,
      islandId: normalized.scope === 'island' ? normalized.islandId : null,
      local: normalized.local,
    } : null;
  }

  function serializeMooringCables() {
    return mooringCables.map(cable => {
      const a = serializeMooringAnchor(cable.a);
      const b = serializeMooringAnchor(cable.b);
      return a && b ? { id: cable.id, a, b, style: normalizeMooringStyleId(cable.style) } : null;
    }).filter(Boolean);
  }

  function sameMooringAnchor(a, b) {
    if (!a || !b || a.scope !== b.scope) return false;
    if ((a.islandId || null) !== (b.islandId || null)) return false;
    const la = a.local || {};
    const lb = b.local || {};
    return Math.abs(mooringFiniteNumber(la.x) - mooringFiniteNumber(lb.x)) < 0.04
      && Math.abs(mooringFiniteNumber(la.y) - mooringFiniteNumber(lb.y)) < 0.04
      && Math.abs(mooringFiniteNumber(la.z) - mooringFiniteNumber(lb.z)) < 0.04;
  }

  function mooringAnchorWorldPoint(anchor, out = new THREE.Vector3()) {
    const normalized = normalizeMooringAnchor(anchor);
    if (!normalized) return null;
    out.set(normalized.local.x, normalized.local.y, normalized.local.z);
    if (normalized.scope === 'island') {
      const island = editableIslandById.get(normalized.islandId);
      if (!island || !island.group) return null;
      island.group.updateMatrixWorld(true);
      island.group.localToWorld(out);
      worldGroup.worldToLocal(out);
    }
    return out;
  }

  // Push a control point out of any engine hazard so the cable routes AROUND
  // engines instead of being blocked by them.
  function avoidMooringHazards(point, hazards) {
    if (!hazards || !hazards.length) return point;
    for (const h of hazards) {
      const d = point.distanceTo(h.center);
      const minD = h.radius + MOORING_HAZARD_CLEARANCE;
      if (d > 1e-4 && d < minD) {
        mooringVecHazard.copy(point).sub(h.center).multiplyScalar((minD - d) / d);
        point.add(mooringVecHazard);
      }
    }
    return point;
  }

  function makeMooringCurve(start, end, hazards) {
    const haz = hazards || collectMooringHazards();
    const dist = Math.max(0.01, start.distanceTo(end));
    const sag = Math.min(5.6, Math.max(0.45, dist * 0.105));
    const side = mooringVecD.set(-(end.z - start.z), 0, end.x - start.x);
    if (side.lengthSq() > 0.0001) side.normalize().multiplyScalar(Math.min(0.55, dist * 0.025));
    const p0 = start.clone();
    const p1 = avoidMooringHazards(start.clone().lerp(end, 0.24).add(side).add(new THREE.Vector3(0, -sag * 0.36, 0)), haz);
    const p2 = avoidMooringHazards(start.clone().lerp(end, 0.58).addScaledVector(side, -0.35).add(new THREE.Vector3(0, -sag, 0)), haz);
    const p3 = avoidMooringHazards(start.clone().lerp(end, 0.83).addScaledVector(side, -0.15).add(new THREE.Vector3(0, -sag * 0.45, 0)), haz);
    const p4 = end.clone();
    return new THREE.CatmullRomCurve3([p0, p1, p2, p3, p4], false, 'catmullrom', 0.32);
  }

  function clearMooringMeshes() {
    for (const child of mooringGroup.children.slice()) {
      mooringGroup.remove(child);
      disposeGroup(child);
    }
    pendingMooringMarker = null;
  }

  function addMooringEndpointClamp(root, position, toward) {
    const clamp = new THREE.Group();
    clamp.position.copy(position);
    clamp.rotation.y = Math.atan2(toward.x, toward.z);
    clamp.userData.noPointerPick = true;
    const body = new THREE.Mesh(getBoxGeometry(0.26, 0.12, 0.18), M.utilityClamp);
    body.castShadow = true;
    body.receiveShadow = true;
    const strap = new THREE.Mesh(getBoxGeometry(0.32, 0.045, 0.07), M.utilityPipeD);
    strap.position.y = -0.075;
    strap.castShadow = true;
    strap.receiveShadow = true;
    clamp.add(body);
    clamp.add(strap);
    root.add(clamp);
  }

  function buildMooringCableMesh(cable) {
    const start = mooringAnchorWorldPoint(cable.a, mooringVecA);
    const end = mooringAnchorWorldPoint(cable.b, mooringVecB);
    if (!start || !end || start.distanceTo(end) < 0.18) return null;
    const root = new THREE.Group();
    root.name = 'mooring-cable-' + cable.id;
    root.userData = { kind: 'mooring-cable', mooringCableId: cable.id, noPointerPick: true };
    const curve = makeMooringCurve(start.clone(), end.clone());
    const geo = new THREE.TubeGeometry(curve, MOORING_CABLE_SEGMENTS, MOORING_CABLE_RADIUS, 5, false);
    const tube = new THREE.Mesh(geo, mooringStyleMaterial(cable.style));
    tube.castShadow = true;
    tube.receiveShadow = false;
    tube.userData.noPointerPick = true;
    root.add(tube);
    const dir = end.clone().sub(start);
    addMooringEndpointClamp(root, start, dir);
    addMooringEndpointClamp(root, end, dir.clone().multiplyScalar(-1));
    return root;
  }

  function syncMooringPendingMarker() {
    if (!pendingMooringAnchor) return;
    const p = mooringAnchorWorldPoint(pendingMooringAnchor, mooringVecC);
    if (!p) return;
    const marker = new THREE.Group();
    marker.name = 'pending-mooring-anchor';
    marker.position.copy(p);
    marker.userData.noPointerPick = true;
    const a = new THREE.Mesh(getBoxGeometry(0.30, 0.055, 0.09), M.utilityClamp);
    const b = new THREE.Mesh(getBoxGeometry(0.09, 0.055, 0.30), M.utilityClamp);
    a.castShadow = b.castShadow = true;
    marker.add(a);
    marker.add(b);
    mooringGroup.add(marker);
    pendingMooringMarker = marker;
  }

  function rebuildMooringCables() {
    clearMooringMeshes();
    for (const cable of mooringCables) {
      const mesh = buildMooringCableMesh(cable);
      if (mesh) mooringGroup.add(mesh);
    }
    syncMooringPendingMarker();
  }

  function clearMooringCables() {
    mooringCables.length = 0;
    pendingMooringAnchor = null;
    clearMooringMeshes();
  }

  function clearMooringsAnchoredToEditableIslands() {
    let changed = false;
    for (let i = mooringCables.length - 1; i >= 0; i--) {
      const cable = mooringCables[i];
      if ((cable.a && cable.a.scope === 'island') || (cable.b && cable.b.scope === 'island')) {
        mooringCables.splice(i, 1);
        changed = true;
      }
    }
    if (pendingMooringAnchor && pendingMooringAnchor.scope === 'island') {
      pendingMooringAnchor = null;
      changed = true;
    }
    if (changed) rebuildMooringCables();
  }

  function replaceMooringCables(list) {
    clearMooringCables();
    if (!Array.isArray(list)) return;
    for (const item of list.slice(0, MOORING_CABLE_MAX)) {
      const cable = normalizeMooringCable(item);
      if (cable) mooringCables.push(cable);
    }
    rebuildMooringCables();
  }

  function isMooringObjectVisible(object) {
    let n = object;
    while (n && n !== worldGroup) {
      if (n.visible === false) return false;
      n = n.parent;
    }
    return true;
  }

  function addMooringHazardSphere(list, object, localRadius, label) {
    if (!object || !object.parent || !isMooringObjectVisible(object)) return;
    object.getWorldPosition(mooringVecC);
    worldGroup.worldToLocal(mooringVecC);
    object.getWorldScale(mooringVecD);
    const scale = Math.max(Math.abs(mooringVecD.x), Math.abs(mooringVecD.y), Math.abs(mooringVecD.z), 0.1);
    list.push({
      center: mooringVecC.clone(),
      radius: Math.max(0.18, localRadius * scale + MOORING_CABLE_RADIUS + 0.12),
      label,
    });
  }

  function collectMooringHazards() {
    const hazards = [];
    editableIslandEnginePropellers.forEach(prop => {
      const disc = prop && prop.userData ? prop.userData.blurDisc : null;
      const radius = disc && disc.userData ? (disc.userData.baseRadius || 4.2) : 4.2;
      addMooringHazardSphere(hazards, prop, radius, 'propeller');
    });
    islandRocketEngines.forEach(engine => addMooringHazardSphere(hazards, engine, 0.85, 'jet engine'));
    islandRocketFlames.forEach(flame => {
      const label = flame && flame.userData && flame.userData.rocketSmoke ? 'jet smoke' : 'jet plume';
      addMooringHazardSphere(hazards, flame, 1.15, label);
    });
    return hazards;
  }

  function findMooringRouteBlocker(curve) {
    const hazards = collectMooringHazards();
    if (!hazards.length) return null;
    for (let i = 2; i <= MOORING_ROUTE_SAMPLES - 2; i++) {
      const t = i / MOORING_ROUTE_SAMPLES;
      const point = curve.getPoint(t);
      for (const hazard of hazards) {
        if (point.distanceTo(hazard.center) <= hazard.radius) return hazard;
      }
    }
    return null;
  }

  function validateMooringCableRoute(a, b) {
    const start = mooringAnchorWorldPoint(a, mooringVecA);
    const end = mooringAnchorWorldPoint(b, mooringVecB);
    if (!start || !end) return { ok: false, reason: 'Mooring anchor no longer exists' };
    if (start.distanceTo(end) < 0.45) return { ok: false, reason: 'Pick a second point farther away' };
    // Cables now route AROUND engine hazards (see makeMooringCurve/avoidMooringHazards)
    // instead of being blocked by them, so there's no hazard rejection here.
    return { ok: true };
  }

  function showMooringStatus(message, bad = false) {
    if (!document || !document.body) return;
    clearTimeout(mooringStatusTimer);
    let badge = document.getElementById('mooring-status-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'mooring-status-badge';
      badge.className = 'vehicle-demo-badge';
      badge.setAttribute('role', 'status');
      badge.setAttribute('aria-live', 'polite');
      document.body.appendChild(badge);
    }
    badge.textContent = '';
    const dot = document.createElement('i');
    dot.className = 'vehicle-demo-dot';
    dot.setAttribute('aria-hidden', 'true');
    const title = document.createElement('strong');
    title.textContent = bad ? 'Mooring blocked' : 'Mooring';
    const detail = document.createElement('span');
    detail.textContent = message;
    badge.append(dot, title, detail);
    mooringStatusTimer = setTimeout(() => {
      const live = document.getElementById('mooring-status-badge');
      if (live) live.remove();
    }, bad ? 3200 : 2300);
  }

  function addMooringCableFromAnchors(a, b) {
    if (mooringCables.length >= MOORING_CABLE_MAX) {
      return { ok: false, reason: 'Mooring cable limit reached' };
    }
    const route = validateMooringCableRoute(a, b);
    if (!route.ok) return route;
    const cable = normalizeMooringCable({ a, b });
    if (!cable) return { ok: false, reason: 'Mooring anchors are invalid' };
    pushWorldHistorySnapshot();
    mooringCables.push(cable);
    rebuildMooringCables();
    saveState();
    // Live multiplayer: moorings are not cells, so cell.set never carries them.
    // Notify the multiplayer layer (module 38) so the host can broadcast the
    // full serialized cable list. replaceMooringCables (the peer apply path)
    // does NOT dispatch this event, so applying a remote update cannot loop.
    try { window.dispatchEvent(new CustomEvent('tinyworld:moorings-changed')); } catch (_) {}
    return { ok: true };
  }

  function setMooringCableStyle(id, style) {
    const cable = mooringCables.find(c => c.id === id);
    if (!cable) return false;
    const next = normalizeMooringStyleId(style);
    if (cable.style === next) return false;
    cable.style = next;
    rebuildMooringCables();
    saveState();
    try { window.dispatchEvent(new CustomEvent('tinyworld:moorings-changed')); } catch (_) {}
    return true;
  }

  function clearPendingMooringAnchor() {
    pendingMooringAnchor = null;
    rebuildMooringCables();
  }

  function handleMooringAnchorPick(anchor) {
    const normalized = normalizeMooringAnchor(anchor);
    if (!normalized) {
      showMooringStatus('Pick a visible island surface', true);
      return false;
    }
    if (!pendingMooringAnchor) {
      pendingMooringAnchor = normalized;
      rebuildMooringCables();
      showMooringStatus('Start pinned. Pick the island point to tie to.');
      return true;
    }
    if (sameMooringAnchor(pendingMooringAnchor, normalized)) {
      clearPendingMooringAnchor();
      showMooringStatus('Start pin cleared.');
      return true;
    }
    const result = addMooringCableFromAnchors(pendingMooringAnchor, normalized);
    if (!result.ok) {
      showMooringStatus(result.reason || 'Cable cannot pass through engines', true);
      return false;
    }
    pendingMooringAnchor = null;
    rebuildMooringCables();
    showMooringStatus('Cable tied between islands.');
    return true;
  }

  function objectHasMooringHazardUserData(object) {
    const u = object && object.userData;
    return !!(u && (
      u.isEditableIslandEnginePropeller ||
      u.propellerBlurDisc ||
      u.rocketPlumeSheet ||
      u.rocketFlame
    ));
  }

  function hitContainsMooringHazard(hit) {
    let n = hit && hit.object;
    while (n && n !== worldGroup) {
      if (objectHasMooringHazardUserData(n)) return true;
      n = n.parent;
    }
    return false;
  }

  function editableIslandForHitObject(object) {
    let n = object;
    while (n && n !== worldGroup) {
      const islandId = n.userData && n.userData.editableIslandId;
      if (islandId && editableIslandById.has(islandId)) return editableIslandById.get(islandId);
      n = n.parent;
    }
    return null;
  }

  function mooringAnchorFromHit(hit) {
    if (!hit || !hit.object || hitContainsMooringHazard(hit)) return null;
    if (isLandscapeMeshHit(hit.object)) return null;
    const island = editableIslandForHitObject(hit.object);
    const local = hit.point.clone();
    if (island && island.group) {
      island.group.worldToLocal(local);
      return normalizeMooringAnchor({
        scope: 'island',
        islandId: island.id,
        local,
      });
    }
    worldGroup.worldToLocal(local);
    return normalizeMooringAnchor({
      scope: 'home',
      local,
    });
  }

  function pickMooringAnchor(clientX, clientY) {
    ndc.x = (clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(getPickRaycastRoots(), true);
    for (const hit of hits) {
      const anchor = mooringAnchorFromHit(hit);
      if (anchor) return anchor;
    }
    return null;
  }

  function nextEditableIslandPosition(anchorHit) {
    const current = selectedEditableIsland();
    if (current) {
      return {
        positionX: (current.positionX || 0) + GRID + 1,
        positionY: current.positionY || 0,
        positionZ: current.positionZ || 0,
      };
    }
    if (anchorHit && anchorHit.editableIslandId && Number.isFinite(anchorHit.worldX) && Number.isFinite(anchorHit.worldZ)) {
      return {
        positionX: anchorHit.worldX + GRID + 1,
        positionY: Number.isFinite(anchorHit.worldY) ? anchorHit.worldY : 0,
        positionZ: anchorHit.worldZ,
      };
    }
    return { positionX: GRID + 1 + editableIslands.length * (GRID + 1), positionY: 0, positionZ: 0 };
  }

  function clearEditableIslands() {
    if (typeof clearMooringsAnchoredToEditableIslands === 'function') clearMooringsAnchoredToEditableIslands();
    selectedEditableIslandId = null;
    selectedEditableIslandEngineRef = null;
    selectedTransformGizmoIsland = null;
    if (!selectedTransformGizmoTarget) transformGizmoGroup.visible = false;
    for (const island of editableIslands) {
      if (Array.isArray(island.engines)) {
        island.engines.forEach(engine => {
          if (engine && engine.propeller) editableIslandEnginePropellers.delete(engine.propeller);
        });
      }
      if (island.group && island.group.parent) island.group.parent.remove(island.group);
      disposeGroup(island.group);
      const startX = island.boardX * GRID;
      const startZ = island.boardZ * GRID;
      for (let x = startX; x < startX + GRID; x++) {
        if (!world[x]) continue;
        for (let z = startZ; z < startZ + GRID; z++) {
          delete world[x][z];
          const key = x + ',' + z;
          const entry = cellMeshes[key];
          if (entry) {
            if (entry.tile) disposeGroup(entry.tile);
            if (entry.object) disposeGroup(entry.object);
            if (entry.extras) for (const m of entry.extras) disposeGroup(m);
            delete cellMeshes[key];
          }
        }
      }
    }
    editableIslands.length = 0;
    editableIslandById.clear();
    editableIslandByBoardKey.clear();
  }

  function runIslandStressDemo(count = ISLAND_STRESS_DEFAULT_COUNT, opts = {}) {
    const total = coerceIslandStressCount(count);
    stopSeededVehicleDemo({ clearVehicles: true });
    dismissWelcomeForDemo();
    if (opts.clearExisting !== false) {
      clearMooringCables();
      clearEditableIslands();
    }
    const cols = Math.max(5, Math.ceil(Math.sqrt(total)));
    const spacing = GRID * TILE + 2.4;
    const rows = Math.ceil(total / cols);
    const startX = -((cols - 1) * spacing) * 0.5;
    const startZ = -GRID * 1.7 - ((rows - 1) * spacing) * 0.5;
    const oldSuppressSave = suppressSave;
    suppressSave = true;
    const created = [];
    try {
      for (let i = 0; i < total; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const stagger = row % 2 ? spacing * 0.35 : 0;
        const island = createEditableIsland({
          id: 'stress-island-' + String(i + 1).padStart(3, '0'),
          boardX: 240 + i,
          boardZ: 12 + Math.floor(i / 64),
          positionX: startX + col * spacing + stagger,
          positionY: (i % 5) * 0.34,
          positionZ: startZ + row * spacing,
          rotationY: ((i % 8) - 3.5) * 0.05,
          skipSave: true,
          select: false,
        });
        if (island) created.push(island);
      }
    } finally {
      suppressSave = oldSuppressSave;
    }
    if (created.length) selectEditableIsland(created[0]);
    updateEditableIslandLods(true);
    if (opts.stats !== false) ensureStatsOverlay();
    window.__lastIslandStressDemo = {
      count: created.length,
      gridSize: GRID,
      shareUrl: islandStressDemoShareUrl(total),
      lod: editableIslandPerfStats(),
    };
    console.info('[island-stress] islands', created.length, window.__lastIslandStressDemo.shareUrl);
    return window.__lastIslandStressDemo;
  }

  window.__runIslandStressDemo = runIslandStressDemo;
  window.__islandStressDemoShareUrl = islandStressDemoShareUrl;
