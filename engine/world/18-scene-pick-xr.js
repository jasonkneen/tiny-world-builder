  // -------- initial scene (matches the reference image) --------
  function loadInitialScene() {
    twPerfMark('initial:start');
    clearMooringCables();
    clearEditableIslands();
    // Wipe any existing meshes + animation state so a Reset re-plays the drop.
    for (const key in cellMeshes) {
      const e = cellMeshes[key];
      if (e.tile) { if (e.tile.parent) e.tile.parent.remove(e.tile); disposeGroup(e.tile); }
      if (e.object) { if (e.object.parent) e.object.parent.remove(e.object); disposeGroup(e.object); }
      if (e.extras) for (const m of e.extras) { if (m.parent) m.parent.remove(m); disposeGroup(m); }
    }
    for (const k of Object.keys(cellMeshes)) delete cellMeshes[k];
    initCellMeshesGrid();
    homeRenderQueue = [];
    homeRenderQueueCursor = 0;
    homeRenderQueued.clear();
    resetHomeWorldIntent();
    dropAnims.length = 0;
    cropPositions.clear();
    maxPumpkinPositions.clear();
    carriagePumpkin = null;

    // Build the layout in one shot so each cell only animates once.
    const layout = {};

    // Build a richer starter diorama: river + bridge, cottage lane, tiny
    // turret-wall, farm plots, and landmark rocks. It exercises the adjacency
    // systems instead of hiding most tools in the palette.
    for (let x = 0; x < GRID; x++) layout[x + ',2'] = { terrain: 'water', kind: null };
    for (let z = 0; z < GRID; z++) {
      if (z !== 2) layout['3,' + z] = { terrain: 'path', kind: null };
    }
    for (let x = 1; x <= 6; x++) layout[x + ',5'] = { terrain: 'path', kind: null };
    layout['3,2'] = { terrain: 'water', kind: 'bridge', floors: 1 };

    layout['1,4'] = { terrain: 'grass', kind: 'house' };
    layout['2,4'] = { terrain: 'grass', kind: 'house' };
    layout['5,4'] = { terrain: 'grass', kind: 'house', buildingType: 'manor', floors: 2 };
    layout['6,3'] = { terrain: 'grass', kind: 'house', buildingType: 'tower', floors: 3 };

    layout['0,0'] = { terrain: 'grass', kind: 'house', floors: 2 };
    layout['0,1'] = { terrain: 'grass', kind: 'fence' };
    layout['1,0'] = { terrain: 'grass', kind: 'fence' };
    layout['1,1'] = { terrain: 'grass', kind: 'fence' };

    layout['5,6'] = { terrain: 'dirt', kind: 'wheat' };
    layout['6,6'] = { terrain: 'dirt', kind: 'corn' };
    layout['7,6'] = { terrain: 'dirt', kind: 'sunflower' };
    layout['5,7'] = { terrain: 'dirt', kind: 'carrot' };
    layout['6,7'] = { terrain: 'dirt', kind: 'pumpkin' };
    layout['7,7'] = { terrain: 'dirt', kind: 'crop' };

    layout['0,6'] = { terrain: 'grass', kind: 'tree' };
    layout['1,7'] = { terrain: 'grass', kind: 'tree' };
    layout['5,0'] = { terrain: 'grass', kind: 'rock' };
    layout['5,1'] = { terrain: 'grass', kind: 'tree' };
    layout['6,1'] = { terrain: 'grass', kind: 'tree' };
    layout['7,0'] = { terrain: 'grass', kind: 'rock', floors: 3 };
    layout['7,1'] = { terrain: 'grass', kind: 'tree', floors: 2 };
    layout['6,0'] = { terrain: 'grass', kind: 'rock', floors: 2 };
    layout['0,3'] = { terrain: 'grass', kind: 'tuft' };
    layout['4,1'] = { terrain: 'grass', kind: 'tuft' };
    layout['7,3'] = { terrain: 'grass', kind: 'tuft' };

    // Board tiles are the stage: render them immediately. Props/buildings
    // still land in a diagonal sweep so initial load has motion without the
    // ground itself popping in cell by cell.
    const OBJECT_STAGGER = 0.035;
    for (let x = 0; x < GRID; x++) {
      for (let z = 0; z < GRID; z++) {
        const cell = layout[x + ',' + z];
        if (!cell) continue;
        if (!world[x]) world[x] = [];
        let terrain = cell.terrain || 'grass';
        let kind = cell.kind || null;
        if (kind === 'bridge') terrain = 'water';
        else if (CROP_KINDS.has(kind)) terrain = 'dirt';
        else if (terrain === 'water') kind = null;
        let buildingType = cell.buildingType || null;
        if (kind !== 'house') buildingType = null;
        const fenceSide = kind === 'fence' ? normalizeFenceSide(cell.fenceSide) : null;
        world[x][z] = {
          terrain,
          terrainFloors: cell.terrainFloors || 1,
          kind,
          floors: cell.floors || 1,
          buildingType,
          fenceSide,
        };
      }
    }

    // Rebuild live index sets after the direct world write (bypasses setCell).
    twPerfMark('initial:intent-ready');
    rebuildCropPositions();
    rebuildMaxPumpkinCache();
    invalidateHomeFade();

    if (useWindowedHomeRendering()) {
      requestHomeRenderWindowSync({ force: true });
      seedCrowdPeople();
      saveState();
      twPerfMark('initial:windowed-queued');
      twPerfMark('initial:end');
      return;
    }

    twPerfMark('initial:tiles-start');
    for (let x = 0; x < GRID; x++) {
      for (let z = 0; z < GRID; z++) {
        renderCellTile(x, z, {
          animate: false,
        });
      }
    }
    twPerfMark('initial:tiles-rendered');
    for (let x = 0; x < GRID; x++) {
      for (let z = 0; z < GRID; z++) {
        const baseDelay = (x + z) * OBJECT_STAGGER;
        renderCellObject(x, z, {
          animate: true,
          delay: baseDelay,
          impactDust: false,
        });
      }
    }
    twPerfMark('initial:objects-rendered');
    seedCrowdPeople();
    saveState();
    if (typeof window.__tinyworldRefreshWaterAudio === 'function') window.__tinyworldRefreshWaterAudio();
    twPerfMark('initial:end');
  }

  // -------- hover indicator --------
  const hoverGeo = roundedSlab(TILE * 1.0, 0.04, 0.07);
  const hoverMesh = new THREE.Mesh(hoverGeo, M.hover);
  hoverMesh.position.y = TOP_H + 0.01;
  hoverMesh.visible = false;
  xrWorldRoot.add(hoverMesh);

  let currentHover = null;

  // -------- ghost placement preview --------
  // A translucent live preview of the object that would be placed on
  // the hovered tile. Updates when the selected tool changes; follows
  // the cursor; can be rotated and nudged within the tile via the
  // arrow keys before the user commits with a click.
  let ghostPreview = null;       // current preview Group (or null)
  let ghostPreviewKey = null;    // tool signature this preview was built for
  let ghostRotation = 0;         // radians (added on top of any deterministic rotation)
  let ghostOffsetX = 0;          // within-tile x nudge
  let ghostOffsetZ = 0;          // within-tile z nudge
  const GHOST_ROT_STEP = Math.PI / 2;     // 90° per arrow press — snaps to cardinal facings
  const GHOST_OFFSET_STEP = 0.06;          // ~6% of a tile per arrow press
  const GHOST_OFFSET_LIMIT = 0.32;         // clamp so the ghost stays on the tile
  function snapRot(r) {
    // Snap to the nearest 90°, wrap into [-PI, PI). Keeps floating-point
    // drift from accumulating across many arrow presses and guarantees the
    // committed rotation matches one of four cardinal facings.
    const step = Math.PI / 2;
    let v = Math.round(r / step) * step;
    while (v >  Math.PI) v -= 2 * Math.PI;
    while (v <= -Math.PI) v += 2 * Math.PI;
    return v;
  }

  function ghostToolSignature(tool) {
    if (!tool || tool.erase || tool.auto || tool.mooring) return null;
    const v = tool.activeVariant;
    return tool.id + '|' + (v ? v.id : '') + '|' + (tool.kind || tool.terrain || '') + '|' + (tool.voxelBuildId || '');
  }

  // A flat, camera-facing icon used as the placement preview instead of a full
  // 3D mesh. Reuses the pre-baked PNG icon (loaded into the thumb cache), so
  // following the cursor costs a sprite update rather than rebuilding voxels.
  // Returns null when no baked icon exists (e.g. user-imported stamps) so the
  // caller falls back to the 3D mesh path.
  function buildGhostBillboard(tool) {
    if (!tool || !tool.kind) return null;
    if (typeof getStaticIconImage !== 'function' || typeof thumbCacheKeyForTool !== 'function') return null;
    const img = getStaticIconImage(thumbCacheKeyForTool(tool));
    if (!img) return null;
    const tex = new THREE.Texture(img);
    tex.needsUpdate = true;
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false });
    const sp = new THREE.Sprite(mat);
    sp.center.set(0.5, 0.06); // anchor near the bottom so the icon stands on the tile
    sp.scale.set(1.3, 1.3, 1);
    sp.userData.ghostPreview = true;
    sp.userData.iconBillboard = true;
    return sp;
  }

  function buildGhostMesh(tool) {
    if (!tool || tool.erase || tool.auto) return null;
    // Prefer the cheap icon billboard; only object tools have baked icons, so
    // terrain swatches and stamp-less tools fall through to the 3D path below.
    const billboard = buildGhostBillboard(tool);
    if (billboard) return billboard;
    const kind = tool.kind;
    let mesh = null;
    if      (kind === 'voxel-build') mesh = makeVoxelBuildStamp(tool.voxelBuildId);
    else if (kind === 'model-stamp') mesh = makeModelStamp(tool.modelStampId);
    else if (kind === 'tree')      mesh = makeTree();
    else if (kind === 'rock')      mesh = makeRock({ n: false, s: false, e: false, w: false }, 1, 0, 0);
    else if (kind === 'tuft')      mesh = makeTuft();
    else if (kind === 'flower')    mesh = makeFlower();
    else if (kind === 'bush')      mesh = makeBush();
    else if (kind === 'cow')       mesh = makeCow();
    else if (kind === 'sheep')     mesh = makeSheep();
    else if (kind === 'crop')      mesh = makeCrop();
    else if (kind === 'corn')      mesh = makeCorn();
    else if (kind === 'wheat')     mesh = makeWheat();
    else if (kind === 'pumpkin')   mesh = makePumpkin();
    else if (kind === 'carrot')    mesh = makeCarrot();
    else if (kind === 'sunflower') mesh = makeSunflower();
    else if (kind === 'bridge')    mesh = makeBridge('x');
    else if (kind === 'fence') {
      const v = tool.activeVariant;
      const side = (v && v.fenceSide && v.fenceSide !== 'auto') ? v.fenceSide : 'n';
      const level = Math.max(1, Math.min(MAX_FLOORS, (v && v.floors) || 1));
      mesh = makeFence(normalizeFenceSide(side), level);
    } else if (kind === 'house') {
      const v = tool.activeVariant;
      const bt = v && v.buildingType;
      if      (bt === 'manor')      mesh = makeManor(1);
      else if (bt === 'tower')      mesh = makeStoneTower(2);
      else if (bt === 'turret')     mesh = makeTurret(1);
      else if (bt === 'skyscraper') mesh = makeSkyscraper(4);
      else                          mesh = makeHouse(1);
    } else if (tool.terrain) {
      // For pure terrain tools, show a thin coloured swatch hovering
      // just above the tile so the user can still see what they'd paint.
      const matMap = { grass: M.grass, dirt: M.dirtRich, path: M.path, water: M.water };
      const mat = matMap[tool.terrain] || M.grass;
      const swatch = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.04, 0.88), mat);
      swatch.position.y = 0.02;
      mesh = new THREE.Group();
      mesh.add(swatch);
    }
    if (!mesh) return null;
    if (kind === 'model-stamp' && tool.modelStampId) {
      const cfg = getModelStampSettings(tool.modelStampId);
      if (cfg.objectScale !== 1) mesh.scale.multiplyScalar(cfg.objectScale);
      if (cfg.offsetY) mesh.position.y += cfg.offsetY;
    }
    // Translucent ghost look — clone materials so we don't tint the
    // shared M.* instances. Disable shadows to keep the preview cheap.
    mesh.traverse(o => {
      if (!o.isMesh || !o.material) return;
      if (Array.isArray(o.material)) {
        o.material = o.material.map(m => {
          const clone = m.clone();
          if (m.onBeforeCompile) clone.onBeforeCompile = m.onBeforeCompile;
          return clone;
        });
      } else {
        const parentMat = o.material;
        o.material = o.material.clone();
        if (parentMat.onBeforeCompile) o.material.onBeforeCompile = parentMat.onBeforeCompile;
      }
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => {
        m.transparent = true;
        m.opacity = 0.45;
        m.depthWrite = false;
      });
      o.castShadow = false;
      o.receiveShadow = false;
    });
    mesh.userData.ghostPreview = true;
    return mesh;
  }

  function ensureGhostPreview() {
    const sig = ghostToolSignature(selectedTool);
    if (sig === ghostPreviewKey && ghostPreview) return;
    if (ghostPreview) {
      if (ghostPreview.parent) ghostPreview.parent.remove(ghostPreview);
      if (ghostPreview.userData && ghostPreview.userData.iconBillboard) {
        // Sprites share an internal geometry — only dispose the per-ghost
        // material + texture, never the shared geometry via disposeGroup.
        if (ghostPreview.material) {
          if (ghostPreview.material.map) ghostPreview.material.map.dispose();
          ghostPreview.material.dispose();
        }
      } else {
        disposeGroup(ghostPreview);
      }
      ghostPreview = null;
    }
    ghostPreviewKey = sig;
    if (!sig) return;
    ghostPreview = buildGhostMesh(selectedTool);
    if (ghostPreview) {
      ghostPreview.visible = false;
      xrWorldRoot.add(ghostPreview);
    }
  }

  // Force a ghost rebuild — used when a pre-baked icon finishes loading so the
  // current tool's preview swaps from the 3D fallback to the cheap billboard.
  window.__twRefreshGhostPreview = function refreshGhostPreview() {
    ghostPreviewKey = null;
    ensureGhostPreview();
    updateGhostPlacement();
  };

  function updateGhostPlacement() {
    if (!ghostPreview) return;
    if (!currentHover) { ghostPreview.visible = false; return; }
    ghostPreview.visible = true;
    const baseY = hoverHeightForCell(currentHover) - 0.02;
    ghostPreview.position.set(
      currentHover.worldX + ghostOffsetX,
      baseY + 0.01,
      currentHover.worldZ + ghostOffsetZ
    );
    // Always render the preview at the snapped angle so it matches the
    // rotation that consumeGhostTransform will commit on click.
    const defaultModelRot = selectedTool && selectedTool.kind === 'model-stamp' && selectedTool.modelStampId
      ? getModelStampSettings(selectedTool.modelStampId).rotationY
      : 0;
    ghostPreview.rotation.y = defaultModelRot + snapRot(ghostRotation);
  }

  function resetGhostTransform() {
    ghostRotation = 0;
    ghostOffsetX = 0;
    ghostOffsetZ = 0;
    updateGhostPlacement();
  }

  // -------- raycaster --------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickRaycastRoots = [];

  function isPointerPickExcludedRoot(object) {
    return !!(
      object && (
        object === planetLandscapeGroup ||
        object === planetAtmosphereGroup ||
        (object.userData && object.userData.noPointerPick)
      )
    );
  }

  function getPickRaycastRoots() {
    pickRaycastRoots.length = 0;
    for (const child of worldGroup.children) {
      if (!isPointerPickExcludedRoot(child)) pickRaycastRoots.push(child);
    }
    return pickRaycastRoots;
  }

  function floorDiv(a, b) {
    return Math.floor(a / b);
  }

  function positiveMod(a, b) {
    return ((a % b) + b) % b;
  }

  const landscapePickPoint = new THREE.Vector3();
  const landscapePickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  function isLandscapeMeshHit(object) {
    if (!landscapeMeshGroup || !object) return false;
    let n = object;
    while (n) {
      if (n === landscapeMeshGroup) return true;
      n = n.parent;
    }
    return false;
  }

  function projectedLandscapeHitFromPoint(point) {
    landscapePickPoint.copy(point);
    xrWorldRoot.worldToLocal(landscapePickPoint);
    const gx = Math.floor(landscapePickPoint.x + GRID / 2);
    const gz = Math.floor(landscapePickPoint.z + GRID / 2);
    if (!renderAutoExpand && (gx < 0 || gx >= GRID || gz < 0 || gz >= GRID)) return null;
    const boardX = floorDiv(gx, GRID);
    const boardZ = floorDiv(gz, GRID);
    const x = positiveMod(gx, GRID);
    const z = positiveMod(gz, GRID);
    const p = (boardX || boardZ) ? ghostCellPos(boardX, boardZ, x, z) : tilePos(x, z);
    return {
      x,
      z,
      boardX,
      boardZ,
      worldX: p.x,
      worldZ: p.z,
      localX: landscapePickPoint.x - p.x,
      localZ: landscapePickPoint.z - p.z,
    };
  }

  function pickLandscapeVirtualCell() {
    if (!isLandscapeMeshActive()) return null;
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(landscapePickPlane, point)) return null;
    return projectedLandscapeHitFromPoint(point);
  }

  function resolveRaycastCell(h) {
    const localHitPoint = h.point.clone();
    xrWorldRoot.worldToLocal(localHitPoint);

    let n = h.object;
    if (n && n.userData && n.userData.ghostMerged) {
      const board = n.parent;
      if (board && board.userData && board.userData.ghostBoard) {
        if (!board.visible) return null;
        const boardX = board.userData.boardX;
        const boardZ = board.userData.boardZ;
        const gx = Math.floor(localHitPoint.x - boardX * GRID + GRID / 2);
        const gz = Math.floor(localHitPoint.z - boardZ * GRID + GRID / 2);
        if (gx >= 0 && gx < GRID && gz >= 0 && gz < GRID) {
          const p = ghostCellPos(boardX, boardZ, gx, gz);
          return {
            x: gx,
            z: gz,
            boardX,
            boardZ,
            worldX: p.x,
            worldZ: p.z,
            localX: localHitPoint.x - p.x,
            localZ: localHitPoint.z - p.z,
          };
        }
      }
    }

    let surfaceNode = h.object;
    while (surfaceNode && !(surfaceNode.userData && surfaceNode.userData.editableIslandSurface)) surfaceNode = surfaceNode.parent;
    if (surfaceNode && surfaceNode.userData) {
      const island = editableIslandById.get(surfaceNode.userData.editableIslandId);
      if (island && island.contentGroup && island.group && island.group.visible) {
        const local = h.point.clone();
        island.contentGroup.worldToLocal(local);
        const gx = Math.floor(local.x + GRID / 2);
        const gz = Math.floor(local.z + GRID / 2);
        if (gx >= 0 && gx < GRID && gz >= 0 && gz < GRID) {
          const p = editableIslandCellDisplayPoint(island, gx, gz);
          const pLocal = tilePos(gx, gz);
          return {
            x: gx,
            z: gz,
            boardX: island.boardX,
            boardZ: island.boardZ,
            editableIslandId: island.id,
            worldX: p.x,
            worldY: p.y,
            worldZ: p.z,
            localX: local.x - pLocal.x,
            localZ: local.z - pLocal.z,
          };
        }
      }
    }

    while (n && n.userData.gx === undefined) n = n.parent;
    if (n && n.userData.gx !== undefined) {
      if (!n.visible) return null;
      const boardX = n.userData.boardX || 0;
      const boardZ = n.userData.boardZ || 0;
      const island = n.userData.editableIslandId ? editableIslandById.get(n.userData.editableIslandId) : null;
      if (island) {
        const local = h.point.clone();
        island.contentGroup.worldToLocal(local);
        const pLocal = tilePos(n.userData.gx, n.userData.gz);
        const p = editableIslandCellDisplayPoint(island, n.userData.gx, n.userData.gz);
        return {
          x: n.userData.gx,
          z: n.userData.gz,
          boardX,
          boardZ,
          editableIslandId: island.id,
          worldX: p.x,
          worldY: p.y,
          worldZ: p.z,
          localX: local.x - pLocal.x,
          localZ: local.z - pLocal.z,
        };
      }
      const p = (boardX || boardZ)
        ? ghostCellPos(boardX, boardZ, n.userData.gx, n.userData.gz)
        : tilePos(n.userData.gx, n.userData.gz);
      return {
        x: n.userData.gx,
        z: n.userData.gz,
        boardX,
        boardZ,
        worldX: p.x,
        worldZ: p.z,
        localX: localHitPoint.x - p.x,
        localZ: localHitPoint.z - p.z,
      };
    }
    return null;
  }

  function resolveRaycastEditableIslandEngine(h) {
    let n = h && h.object;
    while (n && !(n.userData && n.userData.editableIslandEngineId)) n = n.parent;
    if (!n || !n.userData || !n.userData.editableIslandEngineId) return null;
    return editableIslandEngineTarget(n.userData.editableIslandId, n.userData.editableIslandEngineId);
  }

  function pickEditableIslandEngine(clientX, clientY) {
    ndc.x = (clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(getPickRaycastRoots(), true);
    for (const h of hits) {
      const target = resolveRaycastEditableIslandEngine(h);
      if (target) return target;
    }
    return null;
  }

  function pickTile(clientX, clientY) {
    // If the camera is below the playable surface (i.e. looking up at the
    // underside of the island), refuse all picks. Clicking on tops of cells
    // from below feels like the click is "going through" the island.
    if (camera.position.y < 0) return null;
    ndc.x = (clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(getPickRaycastRoots(), true);
    let landscapeHit = null;
    for (const h of hits) {
      if (!landscapeHit && isLandscapeMeshHit(h.object)) {
        landscapeHit = projectedLandscapeHitFromPoint(h.point);
      }
      const cellHit = resolveRaycastCell(h);
      if (cellHit) {
        // Only accept hits whose top is visible from the camera. If the ray
        // is travelling upward at the hit point, the camera is looking at
        // the underside — reject so we don't paint through the island.
        if (h.face && h.face.normal && raycaster.ray.direction.y > 0) {
          // World-space normal Y; underside faces have normal.y < 0
          const obj = h.object;
          const nWorld = h.face.normal.clone().transformDirection(obj.matrixWorld);
          if (nWorld.y < -0.2) continue;
        }
        return cellHit;
      }
    }
    return landscapeHit || pickLandscapeVirtualCell();
  }

  function hoverHeightForCell(cell) {
    if (cell && cell.editableIslandId) {
      const gx = cell.x + (cell.boardX || 0) * GRID;
      const gz = cell.z + (cell.boardZ || 0) * GRID;
      const intent = getWorldCell(gx, gz);
      return (cell.worldY || 0) + TOP_H + terrainVisualRiseForCell(intent) + 0.02;
    }
    if (isLandscapeMeshActive()) {
      return landscapeHeightAtCell(
        cell.x + (cell.boardX || 0) * GRID,
        cell.z + (cell.boardZ || 0) * GRID
      ) + 0.02;
    }
    if (cell.boardX || cell.boardZ) {
      if (isEditableIslandBoard(cell.boardX, cell.boardZ)) {
        const gx = cell.x + cell.boardX * GRID;
        const gz = cell.z + cell.boardZ * GRID;
        return TOP_H + terrainVisualRiseForCell(getWorldCell(gx, gz)) + 0.02;
      }
      const cells = makeGhostWorld(cell.boardX, cell.boardZ);
      return TOP_H + terrainVisualRiseForCell(cells[cell.x][cell.z]) + 0.02;
    }
    return TOP_H + terrainRiseAt(cell.x, cell.z) + 0.02;
  }

  function syncHoverVisibility() {
    if (!currentHover) return;
    if (currentHover.editableIslandId) return;
    if (opacityAtWorldPosition(currentHover.worldX, currentHover.worldZ) > 0.001) return;
    hoverMesh.visible = false;
    currentHover = null;
  }

  // -------- WebXR modes --------
  const xrStatusEl = document.getElementById('xr-status');
  const xrButtons = {
    surface: document.getElementById('xr-surface'),
    float: document.getElementById('xr-float'),
    inside: document.getElementById('xr-inside'),
  };
  const xrBoardScale = {
    surface: () => Math.max(0.012, Math.min(0.09, 0.72 / Math.max(1, GRID))),
    float: () => Math.max(0.018, Math.min(0.14, 1.1 / Math.max(1, GRID))),
    inside: () => 1,
  };
  const xrControllerRay = new THREE.Ray();
  const xrControllerDir = new THREE.Vector3();
  const xrControllerPos = new THREE.Vector3();
  const xrLocalPoint = new THREE.Vector3();
  const xrForward = new THREE.Vector3();
  const xrPosePos = new THREE.Vector3();
  const xrPoseQuat = new THREE.Quaternion();
  const xrPoseScale = new THREE.Vector3();
  let xrMode = null;
  let xrSession = null;
  let xrHitTestSource = null;
  let xrHitTestSourceRequested = false;
  let xrReticleHit = null;
  let xrAnchor = null;
  let xrBoardPlaced = true;
  let xrWasShowcase = false;

  const xrReticle = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.105, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x3a72c8, transparent: true, opacity: 0.88 })
  );
  xrReticle.name = 'xr-placement-reticle';
  xrReticle.matrixAutoUpdate = false;
  xrReticle.visible = false;
  scene.add(xrReticle);

  function setXRStatus(message) {
    if (xrStatusEl) xrStatusEl.textContent = message;
  }

  function setXRButtonsDisabled(disabled) {
    Object.keys(xrButtons).forEach(k => {
      if (xrButtons[k]) xrButtons[k].disabled = !!disabled;
    });
  }

  function resetXRWorldTransform() {
    xrWorldRoot.visible = true;
    xrWorldRoot.position.set(0, 0, 0);
    xrWorldRoot.quaternion.identity();
    xrWorldRoot.scale.set(1, 1, 1);
    xrWorldRoot.updateMatrixWorld(true);
    xrBoardPlaced = true;
  }

  function setXRRootFromPose(position, quaternion, scale) {
    xrWorldRoot.visible = true;
    xrWorldRoot.position.copy(position);
    xrWorldRoot.quaternion.copy(quaternion);
    xrWorldRoot.scale.setScalar(scale);
    xrWorldRoot.updateMatrixWorld(true);
    xrBoardPlaced = true;
  }

  function placeXRBoardAtReticle() {
    if (!xrReticle.visible) return false;
    xrReticle.matrix.decompose(xrPosePos, xrPoseQuat, xrPoseScale);
    setXRRootFromPose(xrPosePos, xrPoseQuat, xrBoardScale.surface());
    xrReticle.visible = false;
    setXRStatus('Board anchored. Aim/select a tile to edit it, or end XR from the headset menu.');
    if (xrReticleHit && xrReticleHit.createAnchor) {
      xrReticleHit.createAnchor().then(anchor => {
        xrAnchor = anchor;
      }).catch(() => {
        xrAnchor = null;
      });
    }
    return true;
  }

  function placeXRFloatingBoard() {
    camera.updateMatrixWorld(true);
    camera.getWorldPosition(xrPosePos);
    camera.getWorldDirection(xrForward);
    xrForward.normalize();
    xrPosePos.addScaledVector(xrForward, 1.35);
    if (xrMode === 'float') xrPosePos.y -= 0.32;
    const yaw = Math.atan2(xrForward.x, xrForward.z);
    xrPoseQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    setXRRootFromPose(xrPosePos, xrPoseQuat, xrBoardScale.float());
    setXRStatus('Tiny World is floating. Aim/select tiles with your controller or hand ray.');
  }

  function placeXRInsideWorld() {
    xrWorldRoot.visible = true;
    xrWorldRoot.position.set(0, 0, 0);
    xrWorldRoot.quaternion.identity();
    xrWorldRoot.scale.setScalar(xrBoardScale.inside());
    xrWorldRoot.updateMatrixWorld(true);
    xrBoardPlaced = true;
    setXRStatus('You are inside the environment. Walk/turn naturally; aim/select tiles to edit.');
  }

  function pickTileFromXRController(controller) {
    if (!controller) return null;
    controller.updateMatrixWorld(true);
    xrControllerPos.setFromMatrixPosition(controller.matrixWorld);
    xrControllerDir.set(0, 0, -1).transformDirection(controller.matrixWorld).normalize();
    xrControllerRay.origin.copy(xrControllerPos);
    xrControllerRay.direction.copy(xrControllerDir);
    raycaster.ray.copy(xrControllerRay);
    const hits = raycaster.intersectObjects(getPickRaycastRoots(), true);
    let landscapeHit = null;
    for (const h of hits) {
      if (!landscapeHit && isLandscapeMeshHit(h.object)) {
        landscapeHit = projectedLandscapeHitFromPoint(h.point);
      }
      const cellHit = resolveRaycastCell(h);
      if (cellHit) return cellHit;
    }
    return landscapeHit;
  }

  function updateXRControllerHover() {
    if (!xrSession || !xrBoardPlaced) return;
    const hit = pickTileFromXRController(renderer.xr.getController(0))
      || pickTileFromXRController(renderer.xr.getController(1));
    if (hit) {
      currentHover = hit;
      hoverMesh.position.set(hit.worldX, hoverHeightForCell(hit), hit.worldZ);
      hoverMesh.visible = true;
    } else {
      currentHover = null;
      hoverMesh.visible = false;
    }
    updateGhostPlacement();
  }

  function onXRSelect(event) {
    if (!xrSession) return;
    if (xrMode === 'surface' && !xrBoardPlaced) {
      placeXRBoardAtReticle();
      return;
    }
    if (xrMode === 'float' && !xrBoardPlaced) {
      placeXRFloatingBoard();
      return;
    }
    const hit = pickTileFromXRController(event.target) || currentHover;
    if (!hit || (selectedTool && selectedTool.select)) return;
    currentHover = hit;
    applyToolToCell(hit);
    hoverMesh.position.set(hit.worldX, hoverHeightForCell(hit), hit.worldZ);
    hoverMesh.visible = true;
    updateGhostPlacement();
  }

  const xrControllers = [renderer.xr.getController(0), renderer.xr.getController(1)];
  xrControllers.forEach(controller => {
    controller.addEventListener('select', onXRSelect);
    scene.add(controller);
  });

  async function isXRSupported(mode) {
    if (!navigator.xr || !navigator.xr.isSessionSupported) return false;
    try { return await navigator.xr.isSessionSupported(mode); }
    catch (_) { return false; }
  }

  async function preferredFloatingSessionMode() {
    if (await isXRSupported('immersive-ar')) return 'immersive-ar';
    if (await isXRSupported('immersive-vr')) return 'immersive-vr';
    return null;
  }

  function sessionInitForXRMode(mode, sessionMode) {
    if (mode === 'surface') {
      return {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['anchors', 'dom-overlay', 'local-floor'],
        domOverlay: { root: document.body },
      };
    }
    const optionalFeatures = ['local-floor', 'bounded-floor', 'hand-tracking', 'dom-overlay'];
    return sessionMode === 'immersive-ar'
      ? { optionalFeatures, domOverlay: { root: document.body } }
      : { optionalFeatures };
  }

  async function startXRMode(mode) {
    if (!navigator.xr || !navigator.xr.requestSession) {
      setXRStatus('WebXR is not available here. Use HTTPS and a WebXR headset browser.');
      return;
    }
    if (xrSession) {
      try { await xrSession.end(); } catch (_) {}
    }
    const sessionMode = mode === 'surface'
      ? 'immersive-ar'
      : (mode === 'inside' ? 'immersive-vr' : await preferredFloatingSessionMode());
    if (!sessionMode || !(await isXRSupported(sessionMode))) {
      setXRStatus(mode === 'inside' ? 'Immersive VR is not supported on this device.' : 'Immersive AR/VR is not supported on this device.');
      return;
    }
    setXRButtonsDisabled(true);
    setXRStatus('Starting XR…');
    try {
      renderer.xr.setReferenceSpaceType(mode === 'inside' ? 'local-floor' : 'local');
      const session = await navigator.xr.requestSession(sessionMode, sessionInitForXRMode(mode, sessionMode));
      await renderer.xr.setSession(session);
      xrMode = mode;
      xrSession = session;
      xrHitTestSource = null;
      xrHitTestSourceRequested = false;
      xrReticleHit = null;
      xrAnchor = null;
      xrWasShowcase = document.body.classList.contains('showcase');
      document.body.classList.add('xr-active');
      scene.background = sessionMode === 'immersive-ar' ? null : defaultSceneBackground.clone();
      applyDistanceMistSettings();
      if (mode === 'surface') {
        xrBoardPlaced = false;
        xrWorldRoot.visible = false;
        xrReticle.visible = false;
        setXRStatus('Look at a flat desk/table until the ring appears, then pinch/select to place the board.');
      } else if (mode === 'float') {
        xrBoardPlaced = false;
        xrWorldRoot.visible = false;
        setXRStatus('Pinch/select once to float the board in front of you.');
      } else {
        placeXRInsideWorld();
      }
      session.addEventListener('end', () => {
        xrSession = null;
        xrMode = null;
        xrHitTestSource = null;
        xrHitTestSourceRequested = false;
        xrReticleHit = null;
        xrAnchor = null;
        xrReticle.visible = false;
        scene.background = defaultSceneBackground.clone();
        applyDistanceMistSettings();
        document.body.classList.remove('xr-active');
        resetXRWorldTransform();
        setXRButtonsDisabled(false);
        setXRStatus('Exited XR. Use AR desk, Float, or Enter world to jump back in.');
        if (xrWasShowcase && !document.body.classList.contains('showcase')) {
          document.body.classList.add('showcase');
        }
      });
    } catch (err) {
      console.error('WebXR start failed:', err);
      resetXRWorldTransform();
      xrReticle.visible = false;
      scene.background = defaultSceneBackground.clone();
      applyDistanceMistSettings();
      document.body.classList.remove('xr-active');
      setXRButtonsDisabled(false);
      setXRStatus('Could not start XR: ' + String(err && err.message ? err.message : err).slice(0, 120));
    }
  }

  function updateXRFrame(frame) {
    if (!xrSession || !frame) return;
    if (xrMode === 'surface' && xrAnchor && frame.trackedAnchors && frame.trackedAnchors.has(xrAnchor)) {
      const anchorPose = frame.getPose(xrAnchor.anchorSpace, renderer.xr.getReferenceSpace());
      if (anchorPose) {
        xrPosePos.set(
          anchorPose.transform.position.x,
          anchorPose.transform.position.y,
          anchorPose.transform.position.z
        );
        xrPoseQuat.set(
          anchorPose.transform.orientation.x,
          anchorPose.transform.orientation.y,
          anchorPose.transform.orientation.z,
          anchorPose.transform.orientation.w
        );
        setXRRootFromPose(xrPosePos, xrPoseQuat, xrBoardScale.surface());
      }
    }
    if (xrMode === 'surface' && !xrBoardPlaced && !xrHitTestSourceRequested) {
      const session = renderer.xr.getSession();
      if (session && session.requestReferenceSpace && session.requestHitTestSource) {
        session.requestReferenceSpace('viewer').then(referenceSpace => {
          session.requestHitTestSource({ space: referenceSpace }).then(source => {
            xrHitTestSource = source;
          }).catch(() => {
            setXRStatus('Hit-test was unavailable; try Float mode instead.');
          });
        });
        xrHitTestSourceRequested = true;
      }
    }
    if (xrMode === 'surface' && !xrBoardPlaced && xrHitTestSource) {
      const hitTestResults = frame.getHitTestResults(xrHitTestSource);
      if (hitTestResults.length) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(renderer.xr.getReferenceSpace());
        if (pose) {
          xrReticle.visible = true;
          xrReticle.matrix.fromArray(pose.transform.matrix);
          xrReticleHit = hit;
        }
      } else {
        xrReticle.visible = false;
        xrReticleHit = null;
      }
    }
    updateXRControllerHover();
  }

  async function refreshXRSupportUI() {
    const xrPanel = document.getElementById('xr-panel');
    if (xrPanel) xrPanel.hidden = true;

    const hasXR = !!(navigator.xr && navigator.xr.isSessionSupported);
    if (!hasXR) {
      setXRStatus('WebXR unavailable: open over HTTPS in a compatible headset browser.');
      setXRButtonsDisabled(true);
      return;
    }

    const ar = await isXRSupported('immersive-ar');
    const vr = await isXRSupported('immersive-vr');

    const supported = ar || vr;

    if (xrPanel) {
      xrPanel.hidden = !supported;
    }

    if (xrButtons.surface) xrButtons.surface.disabled = !ar;
    if (xrButtons.float) xrButtons.float.disabled = !(ar || vr);
    if (xrButtons.inside) xrButtons.inside.disabled = !vr;

    setXRStatus(supported
      ? 'XR ready: AR desk pins the board to a surface; Float suspends it; Enter world scales it 1:1.'
      : 'No immersive WebXR session is supported on this device.');
  }

  if (xrButtons.surface) xrButtons.surface.addEventListener('click', () => startXRMode('surface'));
  if (xrButtons.float) xrButtons.float.addEventListener('click', () => startXRMode('float'));
  if (xrButtons.inside) xrButtons.inside.addEventListener('click', () => startXRMode('inside'));
  refreshXRSupportUI();

