  // -------- sub-object editing (reqs 6-9) --------
  // Slice 3: web-inspector-style hover highlight on the editable sub-parts of the
  // object currently in "edit parts" mode. The edited cell renders un-batched +
  // part-keyed (see makeVoxelBuildStamp editable path); here we raycast its child
  // meshes on pointermove and outline the hovered part. All gated by inspectorV2.
  //
  // Later slices grow this module: sub-part select+transform (9), explode (7),
  // voxel sculpt (8). Exposed via window.__tinyworldSubEdit.

  const subEditHoverGroup = new THREE.Group();
  subEditHoverGroup.name = 'sub-edit-hover';
  if (typeof xrWorldRoot !== 'undefined' && xrWorldRoot) xrWorldRoot.add(subEditHoverGroup);
  else if (typeof scene !== 'undefined' && scene) scene.add(subEditHoverGroup);

  const subEditHoverMat = new THREE.MeshBasicMaterial({
    color: 0x33e0ff, side: THREE.BackSide, transparent: true, opacity: 0.9,
    depthWrite: false, depthTest: true,
  });
  const SUBEDIT_HOVER_SCALE = 1.14;

  const subEditSelGroup = new THREE.Group();
  subEditSelGroup.name = 'sub-edit-selection';
  if (typeof xrWorldRoot !== 'undefined' && xrWorldRoot) xrWorldRoot.add(subEditSelGroup);
  else if (typeof scene !== 'undefined' && scene) scene.add(subEditSelGroup);
  const subEditSelMat = new THREE.MeshBasicMaterial({
    color: 0xff8a3c, side: THREE.BackSide, transparent: true, opacity: 0.95,
    depthWrite: false, depthTest: true,
  });
  const SUBEDIT_SEL_SCALE = 1.18;

  let subEditCellX = null, subEditCellZ = null;     // cell currently in edit mode
  let currentHoverPart = null;                       // { mesh, partKey, voxelCoord }
  let selectedPartKey = null;                        // locked-in selected part key
  const _subEditNdc = new THREE.Vector2();

  function subEditActive() {
    return !!(window.__tinyworldFlags && window.__tinyworldFlags.inspectorV2) && subEditCellX !== null;
  }

  // The rendered Object3D for the edited cell. Home board lives in cellMeshes;
  // (island support arrives in a later slice).
  function subEditObject() {
    if (subEditCellX === null) return null;
    const key = subEditCellX + ',' + subEditCellZ;
    if (typeof cellMeshes !== 'undefined' && cellMeshes[key] && cellMeshes[key].object) return cellMeshes[key].object;
    return null;
  }

  function clearHoverMeshes() {
    while (subEditHoverGroup.children.length) {
      const m = subEditHoverGroup.children.pop();
      if (m.geometry && m.userData && m.userData.ownGeometry) m.geometry.dispose();
    }
  }
  function clearHoverPart() {
    clearHoverMeshes();
    currentHoverPart = null;
  }

  // Inverted-hull outline of a part, placed in world space from each mesh's
  // world matrix (mirrors addObjectOutline so it works under any parent). The
  // part may be a single voxel mesh OR a group (e.g. a house window = 4 boxes);
  // in the group case we outline every child mesh.
  function addPartHulls(part, group, mat, scale, renderOrder) {
    if (!part) return;
    const meshes = [];
    if (part.isMesh && part.geometry) meshes.push(part);
    else part.traverse(o => { if (o.isMesh && o.geometry) meshes.push(o); });
    for (const m of meshes) {
      m.updateMatrixWorld(true);
      const hull = new THREE.Mesh(m.geometry, mat);
      hull.matrixAutoUpdate = false;
      hull.matrix.copy(m.matrixWorld).multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
      hull.renderOrder = renderOrder;
      group.add(hull);
    }
  }
  // Clears only the overlay meshes — the handler owns currentHoverPart state.
  function highlightPart(part) {
    clearHoverMeshes();
    addPartHulls(part, subEditHoverGroup, subEditHoverMat, SUBEDIT_HOVER_SCALE, 1000);
  }

  // Raycast the edited object's children; return the nearest hit mesh that
  // carries a partKey (skips the inverted-hull overlay + non-part helpers).
  function pickSubPart(clientX, clientY) {
    const obj = subEditObject();
    if (!obj || typeof raycaster === 'undefined' || typeof camera === 'undefined') return null;
    _subEditNdc.x = (clientX / window.innerWidth) * 2 - 1;
    _subEditNdc.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(_subEditNdc, camera);
    const hits = raycaster.intersectObject(obj, true);
    for (const h of hits) {
      let n = h.object;
      while (n && (!n.userData || !n.userData.partKey) && n !== obj) n = n.parent;
      if (n && n.userData && n.userData.partKey) return { mesh: n, partKey: n.userData.partKey, voxelCoord: n.userData.voxelCoord || null };
    }
    return null;
  }

  function onSubEditPointerMove(e) {
    if (!subEditActive()) { if (currentHoverPart) clearHoverPart(); return; }
    const hit = pickSubPart(e.clientX, e.clientY);
    if (!hit) { if (currentHoverPart) clearHoverPart(); return; }
    if (currentHoverPart && currentHoverPart.partKey === hit.partKey) return;
    currentHoverPart = hit;
    highlightPart(hit.mesh);
  }

  // --- part selection + transform (req 9) ---
  function clearSelMeshes() {
    while (subEditSelGroup.children.length) subEditSelGroup.children.pop();
  }
  function highlightSelectedMesh(partMesh) {
    clearSelMeshes();
    addPartHulls(partMesh, subEditSelGroup, subEditSelMat, SUBEDIT_SEL_SCALE, 1001);
  }
  function findPartMesh(partKey) {
    const obj = subEditObject();
    if (!obj) return null;
    let found = null;
    obj.traverse(o => { if (!found && o.userData && o.userData.partKey === partKey) found = o; });
    return found;
  }
  function reHighlightSelection() {
    if (!selectedPartKey) { clearSelMeshes(); return; }
    highlightSelectedMesh(findPartMesh(selectedPartKey));
  }
  function selectPart(partKey) {
    selectedPartKey = partKey || null;
    reHighlightSelection();
    // refresh inspector so per-part transform rows appear
    if (typeof renderSelection === 'function') { try { renderSelection(); } catch (_) {} }
  }

  // Mutate the selected part's override on the real cell appearance and re-render
  // (which reapplies overrides), then re-acquire + re-highlight the part.
  function mutateSelectedPart(fn) {
    if (selectedPartKey === null || subEditCellX === null) return false;
    if (typeof getWorldCell !== 'function' || typeof setCell !== 'function') return false;
    const cell = getWorldCell(subEditCellX, subEditCellZ);
    if (!cell) return false;
    const appearance = Object.assign({}, (typeof normalizeAppearance === 'function' ? normalizeAppearance(cell.appearance) : cell.appearance) || {});
    const parts = Object.assign({}, appearance.parts || {});
    const cur = Object.assign({ ox: 0, oy: 0, oz: 0, sx: 1, sy: 1, sz: 1 }, parts[selectedPartKey] || {});
    fn(cur);
    parts[selectedPartKey] = cur;
    appearance.parts = parts;
    setCell(subEditCellX, subEditCellZ, Object.assign({}, cell, { appearance, animate: false, impactDust: false }));
    reHighlightSelection();
    return true;
  }
  function movePart(dx, dy, dz) {
    return mutateSelectedPart(c => { c.ox += dx || 0; c.oy += dy || 0; c.oz += dz || 0; });
  }
  function scalePart(factor) {
    const f = Number(factor) || 1;
    return mutateSelectedPart(c => { c.sx *= f; c.sy *= f; c.sz *= f; });
  }

  // --- voxel sculpting (req 8, option a): add / remove / smooth on voxel-builds.
  // push = movePart, burst = scalePart (already implemented above). ---
  function parseVoxelKey(key) {
    const m = /^v:(-?\d+),(-?\d+),(-?\d+)$/.exec(key || '');
    return m ? { x: +m[1], y: +m[2], z: +m[3] } : null;
  }
  function sculptMutate(fn) {
    if (subEditCellX === null) return false;
    if (typeof getWorldCell !== 'function' || typeof setCell !== 'function') return false;
    const cell = getWorldCell(subEditCellX, subEditCellZ);
    if (!cell) return false;
    const appearance = Object.assign({}, (typeof normalizeAppearance === 'function' ? normalizeAppearance(cell.appearance) : cell.appearance) || {});
    fn(appearance);
    setCell(subEditCellX, subEditCellZ, Object.assign({}, cell, { appearance, animate: false, impactDust: false }));
    return true;
  }
  function removeSelectedVoxel() {
    const co = parseVoxelKey(selectedPartKey);
    if (!co) return false;
    const ok = sculptMutate(ap => {
      const rm = new Set(ap.voxelsRemoved || []);
      rm.add(co.x + ',' + co.y + ',' + co.z);
      ap.voxelsRemoved = Array.from(rm);
      // dropping a voxel also drops any per-part override for it
      if (ap.parts) { const p = Object.assign({}, ap.parts); delete p[selectedPartKey]; ap.parts = Object.keys(p).length ? p : undefined; }
    });
    selectedPartKey = null; clearSelMeshes();
    if (typeof renderSelection === 'function') { try { renderSelection(); } catch (_) {} }
    return ok;
  }
  function addVoxelFromSelected(dx, dy, dz) {
    const co = parseVoxelKey(selectedPartKey);
    if (!co) return false;
    const nc = { x: co.x + (dx || 0), y: co.y + (dy || 0), z: co.z + (dz || 0) };
    const rmKey = nc.x + ',' + nc.y + ',' + nc.z;
    const mesh = findPartMesh(selectedPartKey);
    let color = '#c8c8c8';
    if (mesh && mesh.material && mesh.material.color) color = '#' + mesh.material.color.getHexString();
    const ok = sculptMutate(ap => {
      const rm = new Set(ap.voxelsRemoved || []);
      if (rm.has(rmKey)) { rm.delete(rmKey); ap.voxelsRemoved = rm.size ? Array.from(rm) : undefined; return; }
      const add = (ap.voxelsAdded || []).slice();
      if (!add.some(v => v.x === nc.x && v.y === nc.y && v.z === nc.z)) add.push({ x: nc.x, y: nc.y, z: nc.z, color });
      ap.voxelsAdded = add;
    });
    // select the newly added voxel for chaining
    if (ok) selectPart('v:' + nc.x + ',' + nc.y + ',' + nc.z);
    return ok;
  }
  // Smooth: relax the selected voxel's offset toward the mean of its 6 neighbours'
  // offsets (neighbours without an override count as 0), pulling an out-of-place
  // voxel back into line.
  function smoothSelectedVoxel() {
    const co = parseVoxelKey(selectedPartKey);
    if (!co) return false;
    return mutateSelectedPart(c => {
      const cell = getWorldCell(subEditCellX, subEditCellZ);
      const parts = (normalizeAppearance(cell.appearance) || {}).parts || {};
      const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
      let ox = 0, oy = 0, oz = 0;
      for (const [dx, dy, dz] of dirs) {
        const nk = 'v:' + (co.x+dx) + ',' + (co.y+dy) + ',' + (co.z+dz);
        const n = parts[nk];
        if (n) { ox += n.ox; oy += n.oy; oz += n.oz; }
      }
      c.ox = ox / 6; c.oy = oy / 6; c.oz = oz / 6;
    });
  }

  // Recolor the selected part. hex null/undefined clears the override.
  function recolorPart(hex) {
    return mutateSelectedPart(c => { if (hex) c.col = hex; else delete c.col; });
  }

  function enterSubEdit(x, z) {
    if (typeof setVoxelSubEditCell !== 'function') return false;
    subEditCellX = x; subEditCellZ = z;
    setVoxelSubEditCell(x, z);
    clearHoverPart(); selectedPartKey = null; clearSelMeshes();
    explodeTarget = 0; explodeProgress = 0; explodeParts = [];
    if (typeof renderCellObject === 'function') renderCellObject(x, z, { animate: false });
    return true;
  }

  function exitSubEdit() {
    const hadX = subEditCellX, hadZ = subEditCellZ;
    subEditCellX = null; subEditCellZ = null;
    selectedPartKey = null; clearSelMeshes();
    explodeTarget = 0; explodeProgress = 0; explodeParts = [];
    if (typeof setVoxelSubEditCell === 'function') setVoxelSubEditCell(null, null);
    clearHoverPart();
    if (hadX !== null && typeof renderCellObject === 'function') renderCellObject(hadX, hadZ, { animate: false });
  }

  // --- explode view (req 7): push parts radially outward + up into a sphere
  // so every sub-part is visible/editable. Animated each frame; parts stay the
  // same meshes (hover/select/transform still work while exploded). ---
  const EXPLODE_OUT = 1.6;      // radial multiplier at full explode
  const EXPLODE_LIFT = 0.9;     // extra upward lift at full explode
  let explodeTarget = 0;        // 0 = collapsed, 1 = exploded
  let explodeProgress = 0;
  let explodeParts = [];        // [{ node, basePos:Vec3, baseCenter:Vec3 }]

  // A part may be a single voxel mesh OR a group (house window/door/roof = boxes
  // at origin). Pushing on group.position alone is a no-op for origin groups, so
  // we explode by each part's CENTROID (in its parent-local frame): direction
  // from the object centre, scaled by the centroid distance.
  function captureExplodeParts() {
    explodeParts = [];
    const obj = subEditObject();
    if (!obj) return;
    obj.updateMatrixWorld(true);
    obj.traverse(o => {
      if (!(o.userData && o.userData.partKey)) return;
      const box = new THREE.Box3().setFromObject(o);
      if (box.isEmpty()) return;
      const worldCenter = box.getCenter(new THREE.Vector3());
      const parent = o.parent || obj;
      const baseCenter = parent.worldToLocal(worldCenter.clone());
      explodeParts.push({ node: o, basePos: o.position.clone(), baseCenter });
    });
  }
  function applyExplode(amount) {
    for (const p of explodeParts) {
      if (!p.node.parent) continue;
      p.node.position.set(
        p.basePos.x + p.baseCenter.x * EXPLODE_OUT * amount,
        p.basePos.y + p.baseCenter.y * EXPLODE_OUT * amount + EXPLODE_LIFT * amount,
        p.basePos.z + p.baseCenter.z * EXPLODE_OUT * amount
      );
    }
    reHighlightSelection();
  }
  function setExplode(on) {
    // Capture base positions only from a fully-collapsed state, so toggling
    // mid-animation never records exploded coords as the base (avoids drift).
    if (on && explodeProgress < 0.01) captureExplodeParts();
    explodeTarget = on ? 1 : 0;
  }
  function isExploded() { return explodeTarget > 0.5; }
  function tickSubEditExplode(dt) {
    if (!subEditActive()) { if (explodeProgress > 0) { explodeProgress = 0; } return; }
    if (Math.abs(explodeProgress - explodeTarget) < 0.001) {
      if (explodeTarget === 0 && explodeParts.length) { applyExplode(0); explodeParts = []; }
      return;
    }
    const step = Math.min(1, (dt || 0.016) * 6);
    explodeProgress += (explodeTarget - explodeProgress) * step;
    if (Math.abs(explodeProgress - explodeTarget) < 0.002) explodeProgress = explodeTarget;
    if (!explodeParts.length && explodeTarget > 0) captureExplodeParts();
    const eased = explodeProgress * explodeProgress * (3 - 2 * explodeProgress); // smoothstep
    applyExplode(eased);
  }

  if (typeof renderer !== 'undefined' && renderer && renderer.domElement) {
    renderer.domElement.addEventListener('pointermove', onSubEditPointerMove);
    // NOTE: part SELECTION on click is handled in 20-input-place-erase.js's
    // pointerdown (dragMode 'subpart-select') so it isn't clobbered by the
    // pointerup cell-reselect. We only keep the hover listener here.
  }

  window.__tinyworldSubEdit = {
    enter: enterSubEdit,
    exit: exitSubEdit,
    isActive: subEditActive,
    hoverInfo: () => currentHoverPart ? { partKey: currentHoverPart.partKey, voxelCoord: currentHoverPart.voxelCoord } : null,
    selectPart,
    selectedInfo: () => selectedPartKey ? { partKey: selectedPartKey } : null,
    movePart,
    scalePart,
    recolorPart,
    removeVoxel: removeSelectedVoxel,
    addVoxel: addVoxelFromSelected,
    smoothVoxel: smoothSelectedVoxel,
    setExplode,
    isExploded,
    _tickExplode: tickSubEditExplode,
    _pick: pickSubPart,
    _object: subEditObject,
  };
