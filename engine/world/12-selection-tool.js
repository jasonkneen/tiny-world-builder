  // -------- selection (select-tool) --------
  // Track a Set of "x,z" string keys for selected cells. A semi-transparent
  // overlay quad is rendered on top of each selected tile. Listeners are
  // notified via a CustomEvent so UI (the agent panel) can refresh.
  const selectedCells = new Set();
  const selectionGroup = new THREE.Group();
  selectionGroup.name = 'selection-highlights';
  xrWorldRoot.add(selectionGroup);
  const selectionMat = new THREE.MeshBasicMaterial({
    color: 0x3c82f7,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    depthTest: true,
  });
  const selectionEdgeMat = new THREE.MeshBasicMaterial({
    color: 0x1f5fd8,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    depthTest: true,
  });
  // Depth-tested so trees and tall objects in front of the selection
  // plane occlude the marquee naturally.
  function clearSelectionMeshes() {
    while (selectionGroup.children.length) {
      const m = selectionGroup.children.pop();
      if (m.geometry && !(m.userData && m.userData.sharedGeometry)) m.geometry.dispose();
    }
  }
  function addEdgeStrip(p, y, length, thickness, axis, rotationY = 0) {
    // axis 'x' = aligned along x; 'z' = along z.
    const g = axis === 'x'
      ? new THREE.BoxGeometry(length, 0.02, thickness)
      : new THREE.BoxGeometry(thickness, 0.02, length);
    const m = new THREE.Mesh(g, selectionEdgeMat);
    m.position.set(p.x, y, p.z);
    if (rotationY) m.rotation.y = rotationY;
    m.renderOrder = 999;
    selectionGroup.add(m);
  }
  // Inverted-hull outline material: render only back faces in a flat
  // colour so a slightly-scaled clone of the mesh appears as a thick
  // outline around the original. Beats LineSegments because GPU line
  // width is typically capped at 1px.
  // Intentionally shared and never disposed: one module-scope material reused by
  // every outline mesh for the whole session, so clearSelectionMeshes must NOT
  // dispose it (only the per-selection hull geometry is transient).
  const selectionOutlineMat = new THREE.MeshBasicMaterial({
    color: 0x1f5fd8,
    side: THREE.BackSide,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
  const OUTLINE_SCALE = 1.08;
  const transformGizmoGroup = new THREE.Group();
  transformGizmoGroup.name = 'selection-transform-gizmo';
  transformGizmoGroup.visible = false;
  xrWorldRoot.add(transformGizmoGroup);
  const transformGizmoMats = {
    x: new THREE.MeshBasicMaterial({ color: 0xe15a50, depthTest: false, transparent: true, opacity: 0.92 }),
    y: new THREE.MeshBasicMaterial({ color: 0x4fb06d, depthTest: false, transparent: true, opacity: 0.92 }),
    z: new THREE.MeshBasicMaterial({ color: 0x4c7fd9, depthTest: false, transparent: true, opacity: 0.92 }),
    rotate: new THREE.MeshBasicMaterial({ color: 0xf0b443, depthTest: false, transparent: true, opacity: 0.86 }),
    scale: new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.92 }),
  };
  let selectedTransformGizmoTarget = null;
  let selectedTransformGizmoIsland = null;

  function makeTransformGizmoHandle(action, mat, parts) {
    const g = new THREE.Group();
    g.userData.transformGizmoAction = action;
    parts.forEach(part => {
      part.userData.transformGizmoAction = action;
      part.renderOrder = 1200;
      g.add(part);
    });
    transformGizmoGroup.add(g);
    return g;
  }

  function rebuildTransformGizmoGeometry() {
    while (transformGizmoGroup.children.length) {
      const child = transformGizmoGroup.children.pop();
      child.traverse(node => {
        if (node.geometry) node.geometry.dispose();
      });
    }
    const shaftGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.58, 10);
    const coneGeo = new THREE.ConeGeometry(0.075, 0.18, 14);
    const xShaft = new THREE.Mesh(shaftGeo.clone(), transformGizmoMats.x);
    xShaft.rotation.z = -Math.PI / 2;
    xShaft.position.x = 0.34;
    const xCone = new THREE.Mesh(coneGeo.clone(), transformGizmoMats.x);
    xCone.rotation.z = -Math.PI / 2;
    xCone.position.x = 0.72;
    makeTransformGizmoHandle('move-x', transformGizmoMats.x, [xShaft, xCone]);

    const yShaft = new THREE.Mesh(shaftGeo.clone(), transformGizmoMats.y);
    yShaft.position.y = 0.34;
    const yCone = new THREE.Mesh(coneGeo.clone(), transformGizmoMats.y);
    yCone.position.y = 0.72;
    makeTransformGizmoHandle('move-y', transformGizmoMats.y, [yShaft, yCone]);

    const zShaft = new THREE.Mesh(shaftGeo.clone(), transformGizmoMats.z);
    zShaft.rotation.x = Math.PI / 2;
    zShaft.position.z = 0.34;
    const zCone = new THREE.Mesh(coneGeo.clone(), transformGizmoMats.z);
    zCone.rotation.x = Math.PI / 2;
    zCone.position.z = 0.72;
    makeTransformGizmoHandle('move-z', transformGizmoMats.z, [zShaft, zCone]);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.018, 10, 56), transformGizmoMats.rotate);
    ring.rotation.x = Math.PI / 2;
    makeTransformGizmoHandle('rotate-y', transformGizmoMats.rotate, [ring]);

    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), transformGizmoMats.scale);
    cube.position.set(0, 0.96, 0);
    makeTransformGizmoHandle('scale', transformGizmoMats.scale, [cube]);
  }
  rebuildTransformGizmoGeometry();

  function setTransformGizmoHandleVisible(action, visible) {
    transformGizmoGroup.children.forEach(child => {
      if (child && child.userData && child.userData.transformGizmoAction === action) {
        child.visible = !!visible;
      }
    });
  }

  function updateTransformGizmo(target) {
    const subGizmoTarget = window.__tinyworldSubEdit && window.__tinyworldSubEdit.selectedGizmoTarget
      ? window.__tinyworldSubEdit.selectedGizmoTarget()
      : null;
    if (subGizmoTarget && subGizmoTarget.position) {
      selectedTransformGizmoTarget = null;
      selectedTransformGizmoIsland = null;
      transformGizmoGroup.position.copy(subGizmoTarget.position);
      const s = Math.max(0.62, Math.min(1.10, viewSize / 11));
      transformGizmoGroup.scale.setScalar(s);
      setTransformGizmoHandleVisible('scale', true);
      transformGizmoGroup.visible = true;
      return;
    }
    selectedTransformGizmoTarget = target && target.cell && target.cell.kind ? target : null;
    selectedTransformGizmoIsland = null;
    if (typeof selectedEditableIslandEngineTarget === 'function' && selectedEditableIslandEngineTarget()) {
      transformGizmoGroup.visible = false;
      return;
    }
    if (typeof selectedEditableIslandPyramidTarget === 'function' && selectedEditableIslandPyramidTarget()) {
      transformGizmoGroup.visible = false;
      return;
    }
    if (!selectedTransformGizmoTarget) {
      const island = typeof selectedEditableIsland === 'function' ? selectedEditableIsland() : null;
      // The home island is never moved: its editable surface lives in the
      // shared world grid (not the island's group), so dragging it would only
      // shift the base away from the locked surface. Don't bind the gizmo to it.
      if (!island || island.__home) {
        selectedTransformGizmoIsland = null;
        transformGizmoGroup.visible = false;
        return;
      }
      selectedTransformGizmoIsland = island;
      transformGizmoGroup.position.set(
        island.positionX || 0,
        (island.positionY || 0) + TOP_H + 0.72,
        island.positionZ || 0
      );
      const s = Math.max(0.90, Math.min(1.45, viewSize / 9));
      transformGizmoGroup.scale.setScalar(s);
      setTransformGizmoHandleVisible('scale', false);
      transformGizmoGroup.visible = true;
      return;
    }
    const cell = selectedTransformGizmoTarget.cell;
    const base = tilePos(selectedTransformGizmoTarget.x, selectedTransformGizmoTarget.z);
    const y = TOP_H + terrainVisualRiseForCell(cell) + 0.62 + (cell.offsetY || 0);
    transformGizmoGroup.position.set(
      base.x + (cell.offsetX || 0),
      y,
      base.z + (cell.offsetZ || 0)
    );
    const s = Math.max(0.72, Math.min(1.25, viewSize / 10));
    transformGizmoGroup.scale.setScalar(s);
    setTransformGizmoHandleVisible('scale', isObjectScaleEditableCell(cell));
    transformGizmoGroup.visible = true;
  }

  function pickTransformGizmo(clientX, clientY) {
    const subGizmoTarget = window.__tinyworldSubEdit && window.__tinyworldSubEdit.selectedGizmoTarget
      ? window.__tinyworldSubEdit.selectedGizmoTarget()
      : null;
    if (!transformGizmoGroup.visible || (!selectedTransformGizmoTarget && !selectedTransformGizmoIsland && !subGizmoTarget)) return null;
    ndc.x = (clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(transformGizmoGroup.children, true);
    for (const hit of hits) {
      let n = hit.object;
      while (n && !n.userData.transformGizmoAction) n = n.parent;
      if (n && n.userData.transformGizmoAction) {
        return { action: n.userData.transformGizmoAction, point: hit.point.clone() };
      }
    }
    return null;
  }

  function applyTransformGizmoDrag(action, dx, dy, opts = {}) {
    const unit = Math.max(0.018, viewSize * 0.0032);
    const sub = window.__tinyworldSubEdit;
    const subGizmoTarget = sub && sub.selectedGizmoTarget ? sub.selectedGizmoTarget() : null;
    if (subGizmoTarget) {
      if (action === 'move-x') sub.movePart(dx * unit, 0, 0, { snap: !opts.shiftKey });
      else if (action === 'move-y') sub.movePart(0, -dy * unit, 0, { snap: !opts.shiftKey });
      else if (action === 'move-z') sub.movePart(0, 0, dx * unit, { snap: !opts.shiftKey });
      else if (action === 'rotate-y') sub.rotatePart(opts.altKey ? 'x' : 'y', dx * 0.018);
      else if (action === 'scale') sub.scalePart(Math.max(0.82, Math.min(1.22, 1 - dy * 0.006)));
      else return;
      updateTransformGizmo(null);
      return;
    }
    if (selectedTransformGizmoIsland) {
      const island = selectedTransformGizmoIsland;
      if (action === 'move-x') island.positionX += dx * unit;
      else if (action === 'move-y') island.positionY += -dy * unit;
      else if (action === 'move-z') island.positionZ += dx * unit;
      else if (action === 'rotate-y') island.rotationY += dx * 0.018;
      else return;
      applyEditableIslandTransform(island);
      updateTransformGizmo(null);
      saveState();
      return;
    }
    if (action === 'move-x') moveSelectedBoardObject(dx * unit, 0, 0);
    else if (action === 'move-y') moveSelectedBoardObject(0, -dy * unit, 0);
    else if (action === 'move-z') moveSelectedBoardObject(0, 0, dx * unit);
    else if (action === 'rotate-y') {
      const delta = dx * 0.018;
      updateSelectedBoardObjects(target => ({ rotationY: (target.cell.rotationY || 0) + delta }));
    } else if (action === 'scale') {
      if (!isObjectScaleEditableCell(selectedTransformGizmoTarget && selectedTransformGizmoTarget.cell)) return;
      const amount = Math.max(0.82, Math.min(1.22, 1 - dy * 0.006));
      scaleSelectedBoardObject(amount);
    }
    updateTransformGizmo(selectedBoardObjectTarget());
  }

  function addObjectOutline(rootObject) {
    if (!rootObject) return;
    rootObject.updateMatrixWorld(true);
    rootObject.traverse(node => {
      if (!node.isMesh || !node.geometry) return;
      try {
        // Reuse the mesh's geometry (shared, cheap). The hull is a fresh
        // Mesh with the outline material and a scaled-up world transform.
        const hull = new THREE.Mesh(node.geometry, selectionOutlineMat);
        hull.userData.sharedGeometry = true;
        // Apply the source mesh's full world transform, then bump scale.
        hull.matrix.copy(node.matrixWorld);
        hull.matrixAutoUpdate = false;
        // Scale around local origin by post-multiplying a scale matrix.
        // Geometry on these objects is already centered on their local
        // origin, so this produces a uniform fattening.
        const s = new THREE.Matrix4().makeScale(OUTLINE_SCALE, OUTLINE_SCALE, OUTLINE_SCALE);
        hull.matrix.multiply(s);
        // Scene matrix updates are non-forced; flag the manual matrix so the
        // next traversal computes this hull's matrixWorld.
        hull.matrixWorldNeedsUpdate = true;
        hull.renderOrder = 999;
        selectionGroup.add(hull);
      } catch (_) {}
    });
  }
  function parseCellKey(key) {
    const parts = key.split(',').map(Number);
    // Backwards-compatible: 2-part keys (x,z) refer to the home board.
    if (parts.length === 2) return { bx: 0, bz: 0, x: parts[0], z: parts[1] };
    return { bx: parts[0], bz: parts[1], x: parts[2], z: parts[3] };
  }
  function cellForKey(key) {
    const { bx, bz, x, z } = parseCellKey(key);
    if (bx === 0 && bz === 0) {
      return getWorldCell(x, z);
    }
    if (isEditableIslandBoard(bx, bz)) {
      return getWorldCell(x + bx * GRID, z + bz * GRID);
    }
    try {
      const ghost = makeGhostWorld(bx, bz);
      return (ghost && ghost[x] && ghost[x][z]) ? ghost[x][z] : null;
    } catch (_) { return null; }
  }
  function terrainSurfaceHeightForCell(bx, bz, x, z, cell) {
    const island = editableIslandForBoard(bx || 0, bz || 0);
    if (island) return (island.positionY || 0) + TOP_H + terrainVisualRiseForCell(cell || getWorldCell(x + island.boardX * GRID, z + island.boardZ * GRID));
    if (!(bx || bz) && window.__tinyworldMeshTerrain && typeof window.__tinyworldMeshTerrain.anchorForCell === 'function') {
      const s = window.__tinyworldMeshTerrain.anchorForCell(x, z, { radius: 0.25 });
      if (s && Number.isFinite(s.y)) return s.y;
    }
    if (isLandscapeMeshActive()) return landscapeHeightAtCell(x + (bx || 0) * GRID, z + (bz || 0) * GRID);
    if (cell) return TOP_H + terrainVisualRiseForCell(cell);
    return TOP_H + terrainRiseAt(x, z);
  }

  function islandSelectionPoint(island, x, z, offsetX = 0, offsetZ = 0) {
    const p = tilePos(x, z);
    p.x += offsetX;
    p.z += offsetZ;
    island.contentGroup.localToWorld(p);
    xrWorldRoot.worldToLocal(p);
    return p;
  }

  function rebuildSelectionMeshes() {
    clearSelectionMeshes();
    selectedCells.forEach(key => {
      const { bx, bz, x, z } = parseCellKey(key);
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      const cell = cellForKey(key);
      // Sit just above the real terrain surface. In landscape mesh mode the
      // hidden tile grid still defines x/z cells, but the highlight is
      // projected upward onto the generated landscape height.
      const y = terrainSurfaceHeightForCell(bx, bz, x, z, cell) + 0.05;
      const island = isEditableIslandBoard(bx, bz) ? editableIslandForBoard(bx, bz) : null;
      const p = island ? editableIslandCellDisplayPoint(island, x, z) : ((bx || bz) ? ghostCellPos(bx, bz, x, z) : tilePos(x, z));
      const selectionRotationY = island ? (island.rotationY || 0) : 0;
      // Translucent fill
      const fill = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.02, 0.96), selectionMat);
      fill.position.set(p.x, y, p.z);
      if (selectionRotationY) fill.rotation.y = selectionRotationY;
      fill.renderOrder = 998;
      selectionGroup.add(fill);
      // Thick, opaque-feeling tile border made of four edge strips.
      const T = 0.07;          // thickness
      const L = 1.02;          // strip length (slightly past tile edge)
      const yEdge = y + 0.005;
      const edgeN = island ? islandSelectionPoint(island, x, z, 0, -0.5) : { x: p.x, z: p.z - 0.5 };
      const edgeS = island ? islandSelectionPoint(island, x, z, 0, 0.5) : { x: p.x, z: p.z + 0.5 };
      const edgeW = island ? islandSelectionPoint(island, x, z, -0.5, 0) : { x: p.x - 0.5, z: p.z };
      const edgeE = island ? islandSelectionPoint(island, x, z, 0.5, 0) : { x: p.x + 0.5, z: p.z };
      addEdgeStrip(edgeN, yEdge, L, T, 'x', selectionRotationY);
      addEdgeStrip(edgeS, yEdge, L, T, 'x', selectionRotationY);
      addEdgeStrip(edgeW, yEdge, L, T, 'z', selectionRotationY);
      addEdgeStrip(edgeE, yEdge, L, T, 'z', selectionRotationY);
      // Outline the object on this cell (house / tree / rock / fence /
      // bridge / crop). Only home-board cells have entries in cellMeshes;
      // ghost-board outlines are skipped (those meshes live in a
      // per-board group).
      if (cell && cell.kind && (bx === 0 && bz === 0 || island)) {
        const entryKey = island ? (x + bx * GRID) + ',' + (z + bz * GRID) : x + ',' + z;
        const entry = cellMeshes[entryKey];
        if (entry && entry.object) addObjectOutline(entry.object);
      }
    });
    const engineTarget = typeof selectedEditableIslandEngineTarget === 'function' ? selectedEditableIslandEngineTarget() : null;
    if (engineTarget && engineTarget.engine && engineTarget.engine.mesh) addObjectOutline(engineTarget.engine.mesh);
    const pyramidTarget = typeof selectedEditableIslandPyramidTarget === 'function' ? selectedEditableIslandPyramidTarget() : null;
    if (pyramidTarget && pyramidTarget.pyramid && pyramidTarget.pyramid.mesh) addObjectOutline(pyramidTarget.pyramid.mesh);
  }
  function notifySelectionChanged() {
    rebuildSelectionMeshes();
    window.dispatchEvent(new CustomEvent('tinyworld:selection-changed', {
      detail: { cells: Array.from(selectedCells) }
    }));
  }
  function clearSelection() {
    const selectedIsland = (typeof selectedEditableIsland === 'function') ? selectedEditableIsland() : null;
    if (!selectedCells.size && !selectedEditableIslandEngineRef && !selectedEditableIslandPyramidRef && !selectedIsland) return;
    selectedCells.clear();
    selectedEditableIslandEngineRef = null;
    selectedEditableIslandPyramidRef = null;
    if (typeof selectEditableIsland === 'function') selectEditableIsland(null);
    else if (typeof setIslandSelectionOutline === 'function') setIslandSelectionOutline(null);
    notifySelectionChanged();
  }
  function makeKey(bx, bz, x, z) {
    return (bx || 0) + ',' + (bz || 0) + ',' + x + ',' + z;
  }
  function setRectangleSelection(aHit, bHit, mode) {
    // aHit, bHit: pickTile results {x, z, boardX, boardZ}. Rectangle is
    // built on whichever board the anchor (aHit) belongs to; if the
    // current cell is on a different board we just include that single
    // cell so the user can extend selections off-board with successive
    // shift-clicks.
    if (mode !== 'add') selectedCells.clear();
    selectedEditableIslandEngineRef = null;
    selectedEditableIslandPyramidRef = null;
    const ax = aHit.x, az = aHit.z;
    const abx = aHit.boardX || 0, abz = aHit.boardZ || 0;
    const bx = bHit.x, bz = bHit.z;
    const bbx = bHit.boardX || 0, bbz = bHit.boardZ || 0;
    if (abx !== bbx || abz !== bbz) {
      selectedCells.add(makeKey(abx, abz, ax, az));
      selectedCells.add(makeKey(bbx, bbz, bx, bz));
    } else {
      const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx);
      const z0 = Math.min(az, bz), z1 = Math.max(az, bz);
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          // No GRID clamp — selection works anywhere a tile actually
          // exists (home board OR ghost boards).
          selectedCells.add(makeKey(abx, abz, x, z));
        }
      }
    }
    notifySelectionChanged();
  }
  function toggleCellSelection(hit) {
    selectedEditableIslandEngineRef = null;
    selectedEditableIslandPyramidRef = null;
    const key = makeKey(hit.boardX, hit.boardZ, hit.x, hit.z);
    if (selectedCells.has(key)) selectedCells.delete(key);
    else selectedCells.add(key);
    notifySelectionChanged();
  }
  function selectedSelectionWorldCoords() {
    const out = [];
    selectedCells.forEach(key => {
      const c = parseCellKey(key);
      out.push({ x: c.x + (c.bx || 0) * GRID, z: c.z + (c.bz || 0) * GRID });
    });
    return out;
  }
  function replaceSelectionWithWorldCoords(coords) {
    selectedCells.clear();
    selectedEditableIslandEngineRef = null;
    selectedEditableIslandPyramidRef = null;
    (coords || []).forEach(({ x, z }) => {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      const gx = Math.round(x);
      const gz = Math.round(z);
      const bx = floorDiv(gx, GRID);
      const bz = floorDiv(gz, GRID);
      selectedCells.add(makeKey(bx, bz, positiveMod(gx, GRID), positiveMod(gz, GRID)));
    });
    notifySelectionChanged();
  }

  function selectEditableIslandEngine(engineTarget) {
    if (!engineTarget || !engineTarget.island || !engineTarget.engine) return;
    selectedCells.clear();
    selectedEditableIslandId = engineTarget.island.id;
    selectedEditableIslandEngineRef = { islandId: engineTarget.island.id, engineId: engineTarget.engine.id };
    selectedEditableIslandPyramidRef = null;
    notifySelectionChanged();
  }

  function selectEditableIslandPyramid(pyramidTarget) {
    if (!pyramidTarget || !pyramidTarget.island || !pyramidTarget.pyramid) return;
    selectedCells.clear();
    selectedEditableIslandId = pyramidTarget.island.id;
    selectedEditableIslandEngineRef = null;
    selectedEditableIslandPyramidRef = { islandId: pyramidTarget.island.id, pyramidId: pyramidTarget.pyramid.id };
    notifySelectionChanged();
  }
  function materializeSelectedCells() {
    if (!selectedCells.size) return [];
    const nextKeys = new Set();
    selectedCells.forEach(key => {
      const c = parseCellKey(key);
      const gx = c.x + (c.bx || 0) * GRID;
      const gz = c.z + (c.bz || 0) * GRID;
      if (c.bx || c.bz) {
        if (isEditableIslandBoard(c.bx, c.bz)) {
          nextKeys.add(makeKey(c.bx, c.bz, c.x, c.z));
          return;
        }
        try {
          const ghostCells = makeGhostWorld(c.bx, c.bz);
          const ghostCell = ghostCells[c.x] && ghostCells[c.x][c.z];
          if (ghostCell) {
            if (!world[gx]) world[gx] = [];
            removeGhostCellMesh(c.bx, c.bz, c.x, c.z);
            setCell(gx, gz, {
              ...ghostCell,
              appearance: normalizeAppearance(ghostCell.appearance),
              userEdited: true,
              animate: false,
              forceTile: true,
              impactDust: false,
            });
            if (world[gx] && world[gx][gz]) world[gx][gz].userEdited = true;
          }
        } catch (_) {}
        nextKeys.add(makeKey(0, 0, gx, gz));
      } else {
        nextKeys.add(key);
      }
    });
    selectedCells.clear();
    nextKeys.forEach(key => selectedCells.add(key));
    return selectedSelectionWorldCoords();
  }
  function rotateSelectedCells(delta) {
    if (!selectedCells.size) return false;
    let changed = false;
    materializeSelectedCells().forEach(({ x, z }) => {
      const cell = getWorldCell(x, z);
      if (!cell || !cell.kind) return;
      setCell(x, z, {
        ...cell,
        rotationY: snapRot((cell.rotationY || 0) + delta),
        animate: false,
        impactDust: false,
      });
      changed = true;
    });
    if (changed) notifySelectionChanged();
    return changed;
  }
  // Expose for cross-module access (form submit pulls this in to scope prompts).
  window.__tinyworldSelection = {
    get cells() { return new Set(selectedCells); },
    clear: clearSelection,
    rotate: rotateSelectedCells,
    materialize: materializeSelectedCells,
    worldCoords: selectedSelectionWorldCoords,
    replaceWorldCoords: replaceSelectionWithWorldCoords,
    containsWorldCoord(x, z) {
      return selectedSelectionWorldCoords().some(c => c.x === x && c.z === z);
    },
    summary() {
      if (!selectedCells.size) return null;
      const counts = {};
      const totalTerrain = {};
      selectedCells.forEach(key => {
        const cell = cellForKey(key) || defaultCell();
        const k = cell.kind || cell.terrain;
        counts[k] = (counts[k] || 0) + 1;
        if (Array.isArray(cell.extras)) {
          for (const extra of cell.extras) {
            if (!extra || !extra.kind) continue;
            const extraKey = 'extra ' + extra.kind;
            counts[extraKey] = (counts[extraKey] || 0) + 1;
          }
        }
        totalTerrain[cell.terrain] = (totalTerrain[cell.terrain] || 0) + 1;
      });
      return {
        cellCount: selectedCells.size,
        kinds: counts,
        terrains: totalTerrain,
      };
    },
  };

  function defaultCell() {
    return { terrain: 'grass', terrainFloors: 1, kind: null, floors: 1, buildingType: null, fenceSide: null, extras: [], appearance: null, waterFlow: 'auto' };
  }

  function cloneExtras(extras) {
    return Array.isArray(extras) ? extras.map(e => ({
      kind: e.kind || e.k || null,
      fenceSide: e.fenceSide || e.s || null,
      floors: e.floors || e.f || 1,
      appearance: normalizeAppearance(e.appearance || e.a),
    })) : [];
  }

  function writeWorldIntentCell(x, z, src, userEdited = false) {
    if (!world[x]) world[x] = [];
    const cell = {
      terrain: (src && src.terrain) || 'grass',
      terrainFloors: (src && src.terrainFloors) || 1,
      kind: (src && src.kind) || null,
      floors: (src && src.floors) || 1,
      buildingType: (src && src.buildingType) || null,
      fenceSide: (src && src.fenceSide) || null,
      extras: cloneExtras(src && src.extras),
      rotationY: (src && src.rotationY) || 0,
      offsetX: (src && src.offsetX) || 0,
      offsetY: (src && src.offsetY) || 0,
      offsetZ: (src && src.offsetZ) || 0,
      appearance: normalizeAppearance(src && src.appearance),
      waterFlow: normalizeWaterFlow(src && src.waterFlow),
    };
    if (cell.kind === 'stargate') {
      if (src && src.dest != null) cell.dest = src.dest;
      if (src && src.label != null) cell.label = src.label;
    }
    if (cell.kind !== 'house') cell.buildingType = null;
    if (cell.kind !== 'fence') cell.fenceSide = null;
    if (userEdited || (src && src.userEdited)) cell.userEdited = true;
    world[x][z] = cell;
    return cell;
  }

  function resetHomeWorldIntent() {
    for (const xKey of Object.keys(world)) {
      const x = parseInt(xKey, 10);
      if (!Number.isFinite(x) || x < 0 || x >= GRID) continue;
      const row = world[xKey];
      if (!row) continue;
      for (const zKey of Object.keys(row)) {
        const z = parseInt(zKey, 10);
        if (Number.isFinite(z) && z >= 0 && z < GRID) delete row[zKey];
      }
    }
  }

  function disposeCellMeshEntry(key) {
    const entry = cellMeshes[key];
    if (!entry) return;
    if (entry.tile)   { if (entry.tile.parent) entry.tile.parent.remove(entry.tile); disposeGroup(entry.tile); }
    if (entry.object) { if (entry.object.parent) entry.object.parent.remove(entry.object); disposeGroup(entry.object); }
    if (entry.extras) for (const m of entry.extras) { if (m.parent) m.parent.remove(m); disposeGroup(m); }
    delete cellMeshes[key];
    if (entry.x !== undefined && entry.z !== undefined) {
      if (cellMeshesGrid[entry.x]) {
        cellMeshesGrid[entry.x][entry.z] = undefined;
      }
    }
  }

  function disposeAllCellMeshes() {
    for (const key of Object.keys(cellMeshes)) disposeCellMeshEntry(key);
    homeRenderQueue = [];
    homeRenderQueueCursor = 0;
    homeRenderQueued.clear();
    dropAnims.length = 0;
  }

  function getWorldCell(x, z) {
    return (world[x] && world[x][z]) ? world[x][z] : defaultCell();
  }

  function ensureWorldCell(x, z) {
    if (!world[x]) world[x] = [];
    if (!world[x][z]) world[x][z] = defaultCell();
    return world[x][z];
  }

  const HOME_RENDER_WINDOW_THRESHOLD = 30;
  let homeRenderBounds = null;
  let homeRenderQueue = [];
  let homeRenderQueueCursor = 0;
  let homeRenderQueued = new Set();

  // Fade update throttling for large-grid panning: full updateHomeBoardFade
  // is expensive (walks every cellMesh + extras). We only need it when the
  // camera target has moved enough to meaningfully change ghost reveal opacity.
  let lastHomeFadeTargetX = null;
  let lastHomeFadeTargetZ = null;
  const HOME_FADE_UPDATE_DIST = 0.8; // tiles — full scan only when target drifts this far

  function invalidateHomeFade() {
    lastHomeFadeTargetX = null;
    lastHomeFadeTargetZ = null;
  }

  function useWindowedHomeRendering() {
    return GRID > HOME_RENDER_WINDOW_THRESHOLD;
  }

  function homeRenderWindowRadius() {
    const budget = renderBudgetForGrid(GRID);
    const baseView = DEFAULT_VIEW_SIZE * (GRID / HOME_GRID_DEFAULT);
    const zoomRatio = viewSize / Math.max(DEFAULT_VIEW_SIZE, baseView);
    const maxR = Math.max(budget.homeWindowMin, Math.floor(budget.homeWindowMax / 2));
    let radius = maxR;
    if (zoomRatio > 1.75) radius = Math.max(budget.homeWindowMin, Math.floor(maxR * 0.55));
    else if (zoomRatio > 1.20) radius = Math.max(budget.homeWindowMin, Math.floor(maxR * 0.75));
    else if (zoomRatio < 0.55) radius = Math.min(budget.homeWindowMax, Math.floor(maxR * 1.45));
    const maxSide = Math.max(1, Math.min(GRID, budget.homeWindowMax + 1));
    const maxRadius = Math.max(0, Math.floor((maxSide - 1) / 2));
    return Math.max(0, Math.min(radius, maxRadius));
  }

  function computeHomeRenderBounds() {
    const radius = homeRenderWindowRadius();
    const cx = Math.max(0, Math.min(GRID - 1, Math.round(target.x + GRID / 2 - 0.5)));
    const cz = Math.max(0, Math.min(GRID - 1, Math.round(target.z + GRID / 2 - 0.5)));
    return {
      x0: Math.max(0, cx - radius),
      x1: Math.min(GRID - 1, cx + radius),
      z0: Math.max(0, cz - radius),
      z1: Math.min(GRID - 1, cz + radius),
      cx,
      cz,
    };
  }

  function boundsEqual(a, b) {
    return !!a && !!b && a.x0 === b.x0 && a.x1 === b.x1 && a.z0 === b.z0 && a.z1 === b.z1;
  }

  function cellInBounds(x, z, b) {
    return !!b && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
  }

  function compactHomeRenderQueue() {
    if (homeRenderQueueCursor <= 0) return;
    homeRenderQueue = homeRenderQueue.slice(homeRenderQueueCursor);
    homeRenderQueueCursor = 0;
  }

  function isCellInHomeRenderWindow(x, z) {
    if (!useWindowedHomeRendering()) return true;
    if (!homeRenderBounds) homeRenderBounds = computeHomeRenderBounds();
    return cellInBounds(x, z, homeRenderBounds);
  }

  function pruneHomeRenderWindow(oldBounds, newBounds) {
    // Delta-aware prune: only look at cells in the old window that are
    // now outside the new window. Cost is O(perimeter) instead of O(area)
    // for typical 1-tile movements during panning.
    if (!oldBounds) {
      // First time or after invalidate — do a full (but rare) scan
      for (const key of Object.keys(cellMeshes)) {
        const [x, z] = key.split(',').map(Number);
        if (x < 0 || x >= GRID || z < 0 || z >= GRID) continue;
        if (!cellInBounds(x, z, newBounds)) disposeCellMeshEntry(key);
      }
      return;
    }

    if (boundsEqual(oldBounds, newBounds)) return;

    const toCheck = [];

    // Left strip that left
    if (oldBounds.x0 < newBounds.x0) {
      for (let x = oldBounds.x0; x < newBounds.x0; x++) {
        for (let z = oldBounds.z0; z <= oldBounds.z1; z++) toCheck.push(x + ',' + z);
      }
    }
    // Right strip that left
    if (oldBounds.x1 > newBounds.x1) {
      for (let x = newBounds.x1 + 1; x <= oldBounds.x1; x++) {
        for (let z = oldBounds.z0; z <= oldBounds.z1; z++) toCheck.push(x + ',' + z);
      }
    }
    // Bottom strip that left
    if (oldBounds.z0 < newBounds.z0) {
      for (let z = oldBounds.z0; z < newBounds.z0; z++) {
        for (let x = Math.max(oldBounds.x0, newBounds.x0); x <= Math.min(oldBounds.x1, newBounds.x1); x++) {
          toCheck.push(x + ',' + z);
        }
      }
    }
    // Top strip that left
    if (oldBounds.z1 > newBounds.z1) {
      for (let z = newBounds.z1 + 1; z <= oldBounds.z1; z++) {
        for (let x = Math.max(oldBounds.x0, newBounds.x0); x <= Math.min(oldBounds.x1, newBounds.x1); x++) {
          toCheck.push(x + ',' + z);
        }
      }
    }

    for (const key of toCheck) {
      if (cellMeshes[key]) disposeCellMeshEntry(key);
    }
  }

  function requestHomeRenderWindowSync(opts = {}) {
    if (!useWindowedHomeRendering()) return;
    const nextBounds = computeHomeRenderBounds();
    if (!opts.force && boundsEqual(homeRenderBounds, nextBounds) && homeRenderQueue.length) return;
    if (!opts.force && boundsEqual(homeRenderBounds, nextBounds)) return;
    const oldBounds = homeRenderBounds;
    const oldBoundsForPrune = homeRenderBounds;
    homeRenderBounds = nextBounds;
    pruneHomeRenderWindow(oldBoundsForPrune, homeRenderBounds);

    // Delta queue update for common small movements (1-2 tiles):
    // Instead of rebuilding the entire queue + full sort every frame,
    // only add the newly visible cells on the far side of the movement.
    // This keeps panning on busier grids much lighter.
    const movementX = nextBounds.cx - (oldBounds ? oldBounds.cx : nextBounds.cx);
    const movementZ = nextBounds.cz - (oldBounds ? oldBounds.cz : nextBounds.cz);

    const isSmallMove = Math.abs(movementX) <= 3 && Math.abs(movementZ) <= 3 && !opts.force;

    if (!isSmallMove || !oldBounds) {
      // Full rebuild (rare: big jump, first time, or forced)
      homeRenderQueue = [];
      homeRenderQueueCursor = 0;
      homeRenderQueued.clear();
      for (let x = homeRenderBounds.x0; x <= homeRenderBounds.x1; x++) {
        for (let z = homeRenderBounds.z0; z <= homeRenderBounds.z1; z++) {
          const entry = cellMeshesGrid[x] ? cellMeshesGrid[x][z] : undefined;
          if (entry && entry.tile) continue;
          const key = x + ',' + z;
          homeRenderQueue.push([x, z, key]);
          homeRenderQueued.add(key);
        }
      }
      homeRenderQueue.sort((a, b) => {
        const adx = a[0] - homeRenderBounds.cx, adz = a[1] - homeRenderBounds.cz;
        const bdx = b[0] - homeRenderBounds.cx, bdz = b[1] - homeRenderBounds.cz;
        return (adx * adx + adz * adz) - (bdx * bdx + bdz * bdz);
      });
    } else {
      // Small movement — only enqueue the new entering strips
      // (the cells that are in newBounds but were not in oldBounds)
      const entering = [];

      // New left strip
      if (nextBounds.x0 < oldBounds.x0) {
        for (let x = nextBounds.x0; x < oldBounds.x0; x++) {
          for (let z = nextBounds.z0; z <= nextBounds.z1; z++) {
            const entry = cellMeshesGrid[x][z];
            if (entry && entry.tile) continue;
            const key = x + ',' + z;
            if (!homeRenderQueued.has(key)) {
              entering.push([x, z, key]);
              homeRenderQueued.add(key);
            }
          }
        }
      }
      // New right strip
      if (nextBounds.x1 > oldBounds.x1) {
        for (let x = oldBounds.x1 + 1; x <= nextBounds.x1; x++) {
          for (let z = nextBounds.z0; z <= nextBounds.z1; z++) {
            const entry = cellMeshesGrid[x][z];
            if (entry && entry.tile) continue;
            const key = x + ',' + z;
            if (!homeRenderQueued.has(key)) {
              entering.push([x, z, key]);
              homeRenderQueued.add(key);
            }
          }
        }
      }
      // New bottom strip
      if (nextBounds.z0 < oldBounds.z0) {
        for (let z = nextBounds.z0; z < oldBounds.z0; z++) {
          for (let x = nextBounds.x0; x <= nextBounds.x1; x++) {
            const entry = cellMeshesGrid[x][z];
            if (entry && entry.tile) continue;
            const key = x + ',' + z;
            if (!homeRenderQueued.has(key)) {
              entering.push([x, z, key]);
              homeRenderQueued.add(key);
            }
          }
        }
      }
      // New top strip
      if (nextBounds.z1 > oldBounds.z1) {
        for (let z = oldBounds.z1 + 1; z <= nextBounds.z1; z++) {
          for (let x = nextBounds.x0; x <= nextBounds.x1; x++) {
            const entry = cellMeshesGrid[x][z];
            if (entry && entry.tile) continue;
            const key = x + ',' + z;
            if (!homeRenderQueued.has(key)) {
              entering.push([x, z, key]);
              homeRenderQueued.add(key);
            }
          }
        }
      }

      if (entering.length) {
        compactHomeRenderQueue();
        homeRenderQueue.push(...entering);
        // Light re-sort only the new entries + a few near the end is overkill;
        // just do a full sort occasionally or accept slightly suboptimal order.
        // For now we do a cheap sort — still much better than full rebuild.
        homeRenderQueue.sort((a, b) => {
          const adx = a[0] - homeRenderBounds.cx, adz = a[1] - homeRenderBounds.cz;
          const bdx = b[0] - homeRenderBounds.cx, bdz = b[1] - homeRenderBounds.cz;
          return (adx * adx + adz * adz) - (bdx * bdx + bdz * bdz);
        });
      }
    }
  }

  function processHomeRenderQueue(budgetMs) {
    if (!useWindowedHomeRendering() || homeRenderQueueCursor >= homeRenderQueue.length) {
      if (homeRenderQueueCursor >= homeRenderQueue.length && homeRenderQueue.length) {
        homeRenderQueue = [];
        homeRenderQueueCursor = 0;
        homeRenderQueued.clear();
      }
      return;
    }
    const profileStart = repaintProfileBegin();
    const start = performance.now();
    const cap = renderBudgetForGrid(GRID).queueCap;
    let built = 0;
    while (homeRenderQueueCursor < homeRenderQueue.length && performance.now() - start < budgetMs && built < cap) {
      const [x, z, key] = homeRenderQueue[homeRenderQueueCursor++];
      homeRenderQueued.delete(key);
      if (!isCellInHomeRenderWindow(x, z)) continue;
      renderCellTile(x, z, { animate: false });
      renderCellObject(x, z, { animate: false, impactDust: false });
      built++;
    }
    if (homeRenderQueueCursor >= homeRenderQueue.length) {
      homeRenderQueue = [];
      homeRenderQueueCursor = 0;
      homeRenderQueued.clear();
    } else if (homeRenderQueueCursor > 512 && homeRenderQueueCursor > homeRenderQueue.length / 2) {
      compactHomeRenderQueue();
    }
    if (built) {
      // Smart fade update for large grids:
      // - Newly built cells already received correct initial fade via prepareFadeable in renderCell*.
      // - We only need a full scan of all cellMeshes when the camera target has moved
      //   far enough that many existing ghost cells' distance-based reveal opacity changed.
      const tx = target.x;
      const tz = target.z;
      const needsFullFade =
        lastHomeFadeTargetX === null ||
        lastHomeFadeTargetZ === null ||
        Math.hypot(tx - lastHomeFadeTargetX, tz - lastHomeFadeTargetZ) > HOME_FADE_UPDATE_DIST;

      if (needsFullFade) {
        updateHomeBoardFade();
        lastHomeFadeTargetX = tx;
        lastHomeFadeTargetZ = tz;
      }
      // (If we didn't do a full pass, the new cells are still correctly faded because
      // renderCellTile/Object call prepareFadeable with the live opacityAtWorldPosition.)

      if (typeof window.__requestMinimapRepaint === 'function') window.__requestMinimapRepaint();
    }
    repaintProfileEnd('queue.home', profileStart, built || 1);
  }

  function shouldRenderCellMesh(x, z) {
    // Editable islands render EVERY cell per-cell like home (unpainted cells
    // default to grass), so terrain shows correctly instead of a flat grass slab.
    if (isEditableIslandCell(x, z)) return true;
    if (x >= 0 && x < GRID && z >= 0 && z < GRID) return isCellInHomeRenderWindow(x, z);
    if (cellMeshes[x + ',' + z]) return true;
    return !!(world[x] && world[x][z] && world[x][z].userEdited);
  }

  function shouldUseSimpleFlatGrassTile(x, z, cell) {
    if (isLandscapeMeshActive()) return false;
    if (!cell || cell.terrain !== 'grass' || cell.kind || (cell.extras && cell.extras.length)) return false;
    if (terrainLevelForCell(cell) !== 1) return false;
    if (cell.appearance || cell.waterFlow && cell.waterFlow !== 'auto') return false;
    return true;
  }
