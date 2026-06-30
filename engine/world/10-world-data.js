  // -------- world data --------
  // world[x][z] stores intent: terrain + the kind of object on it (string or null).
  // cellMeshes[key] stores the rendered meshes (tile + object). The object mesh
  // is rebuilt from world state + neighbor context, so adjacency-aware kinds
  // (fences, houses) re-render when a neighbor changes.
  const world = [];
  const cellMeshes = {}; // 'x,z' -> { tile, object }
  const cellMeshesGrid = [];
  function initCellMeshesGrid() {
    cellMeshesGrid.length = 0;
    for (let x = 0; x < GRID; x++) {
      cellMeshesGrid[x] = new Array(GRID);
    }
  }
  initCellMeshesGrid();
  function getOrCreateCellMeshEntry(x, z) {
    const key = x + ',' + z;
    let entry = cellMeshes[key];
    if (!entry) {
      entry = cellMeshes[key] = { tile: null, object: null, extras: [], x, z };
      if (x >= 0 && x < GRID && z >= 0 && z < GRID) {
        cellMeshesGrid[x][z] = entry;
      }
    }
    return entry;
  }
  function hasCellTileMesh(x, z) {
    if (x >= 0 && x < GRID && z >= 0 && z < GRID) {
      const entry = cellMeshesGrid[x] ? cellMeshesGrid[x][z] : undefined;
      return !!(entry && entry.tile);
    }
    const entry = cellMeshes[x + ',' + z];
    return !!(entry && entry.tile);
  }
  // Unified read accessor: uses the grid for O(1) in-bounds lookups, falls
  // back to the dict for out-of-bounds (ghost boards, editable islands).
  // Replaces the pattern of `cellMeshes[x + ',' + z]` scattered across modules.
  function getCellMeshEntry(x, z) {
    if (x >= 0 && x < GRID && z >= 0 && z < GRID) {
      return (cellMeshesGrid[x] && cellMeshesGrid[x][z]) || null;
    }
    return cellMeshes[x + ',' + z] || null;
  }
  const animatedCellObjects = new Set();
  const smokeHouseObjects = new Set();
  const buildingWindowObjects = new Set();
  const buildingWindowBaseMaterials = new Set([M.windowB, M.manorWindow, M.skyGlass, M.castleSlit]);
  const windAnimatedPlantKinds = new Set(['tree', 'tuft', 'flower', 'bush', 'crop', 'corn', 'wheat', 'carrot', 'sunflower']);
  const cropPositions = new Set();        // 'x,z' strings for home-grid cells whose kind is in CROP_KINDS
  let carriagePumpkin = null;             // {x, z} | null — current lowest-index max-floor pumpkin (Cinderella rule)
  const maxPumpkinPositions = new Set();  // 'x,z' of all pumpkins with floors >= MAX_FLOORS (home grid)

  function registerRuntimeObject(obj) {
    if (!obj || !obj.userData) return;
    const kind = obj.userData.kind;
    if (windAnimatedPlantKinds.has(kind)) animatedCellObjects.add(obj);
    if (obj.userData.placeableLightSource && typeof registerPlaceableLightSource === 'function') {
      registerPlaceableLightSource(obj);
    }
    if (kind === 'house') {
      smokeHouseObjects.add(obj);
      buildingWindowObjects.add(obj);
    }
  }

  function unregisterRuntimeObject(root) {
    if (!root) return;
    animatedCellObjects.delete(root);
    smokeHouseObjects.delete(root);
    buildingWindowObjects.delete(root);
    if (root.userData && root.userData.placeableLightSource && typeof unregisterPlaceableLightSource === 'function') {
      unregisterPlaceableLightSource(root);
    }
    if (root.traverse) {
      root.traverse(o => {
        animatedCellObjects.delete(o);
        smokeHouseObjects.delete(o);
        buildingWindowObjects.delete(o);
      });
    }
  }

  function runtimeRootVisible(obj) {
    return !!(obj && obj.parent && obj.visible);
  }

  // -------- live index sets for hot-path queries (avoid O(GRID²) scans) --------
  function isCropCell(cell) { return !!(cell && CROP_KINDS.has(cell.kind)); }

  function addCropPosition(x, z) { cropPositions.add(x + ',' + z); }
  function removeCropPosition(x, z) { cropPositions.delete(x + ',' + z); }

  function rebuildCropPositions() {
    cropPositions.clear();
    for (let x = 0; x < GRID; x++) {
      if (!world[x]) continue;
      for (let z = 0; z < GRID; z++) {
        if (isCropCell(world[x][z])) cropPositions.add(x + ',' + z);
      }
    }
  }

  function rebuildMaxPumpkinCache() {
    maxPumpkinPositions.clear();
    carriagePumpkin = null;
    let best = null;
    for (let x = 0; x < GRID; x++) {
      if (!world[x]) continue;
      for (let z = 0; z < GRID; z++) {
        const c = world[x][z];
        if (c && c.kind === 'pumpkin' && (c.floors || 1) >= MAX_FLOORS) {
          const key = x + ',' + z;
          maxPumpkinPositions.add(key);
          if (!best || x < best.x || (x === best.x && z < best.z)) best = { x, z };
        }
      }
    }
    carriagePumpkin = best;
  }

  // Fast recompute of the carriage winner from the existing set (avoids O(GRID²)
  // scan when the current carriage pumpkin is lowered/erased — the set already
  // has the deleted entry removed by the caller).
  function recomputeCarriageFromSet() {
    let best = null;
    for (const key of maxPumpkinPositions) {
      const comma = key.indexOf(',');
      const x = Number(key.slice(0, comma));
      const z = Number(key.slice(comma + 1));
      if (!best || x < best.x || (x === best.x && z < best.z)) best = { x, z };
    }
    carriagePumpkin = best;
  }

  function updateCarriageAfterChange(x, z, wasMax, isMax) {
    const key = x + ',' + z;
    if (wasMax && !isMax) {
      maxPumpkinPositions.delete(key);
      if (carriagePumpkin && carriagePumpkin.x === x && carriagePumpkin.z === z) {
        // Winner left — recompute from the existing set (O(maxPumpkinCount), not O(GRID²)).
        recomputeCarriageFromSet();
      }
    }
    if (!wasMax && isMax) {
      maxPumpkinPositions.add(key);
      if (!carriagePumpkin || x < carriagePumpkin.x || (x === carriagePumpkin.x && z < carriagePumpkin.z)) {
        carriagePumpkin = { x, z };
      }
    }
  }

  // Keep world sparse. getWorldCell()/ensureWorldCell() provide virtual
  // default grass cells, which avoids allocating HOME_GRID_MAX² default
  // objects at startup as the home board cap changes.

  const MAX_FLOORS = 8;

  const worldGroup = new THREE.Group();
  xrWorldRoot.add(worldGroup);

  const mooringGroup = new THREE.Group();
  mooringGroup.name = 'mooring-cables';
  mooringGroup.userData.noPointerPick = true;
  worldGroup.add(mooringGroup);

  // Vehicle subsystem, window light system, and runtimeRootVisible were
  // extracted to 10b-window-lights.js and 10c-vehicles.js to keep this
  // module focused on the core world/cellMeshes data structures + index sets.
