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

  function windowLightProbability(min) {
    if (min >= 1080 && min < 1260) return 0.36; // dusk: some lights pop on
    if (min >= 1260 || min < 60) return 0.68;   // evening / just after midnight
    if (min < 360) return 0.24;                 // late night: most are off
    return 0;
  }
  function windowLightRand(seed, bucket) {
    const n = Math.sin((seed + 1) * 127.1 + (bucket + 1) * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }
  const windowLightTmpWorld = new THREE.Vector3();
  const windowLightTmpLocal = new THREE.Vector3();
  const windowLightTmpSize = new THREE.Vector3();
  function orientWindowGlowPlane(mesh, normal) {
    if (!mesh || !normal) return;
    if (Math.abs(normal.x) > Math.abs(normal.z)) {
      mesh.rotation.y = normal.x > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else if (normal.z < 0) {
      mesh.rotation.y = Math.PI;
    }
  }
  function createWindowLightEffects(root, node) {
    if (!root || !node || node.userData.windowLightEffects) return;
    const geo = node.geometry;
    if (!geo) return;
    if (!geo.boundingBox && geo.computeBoundingBox) geo.computeBoundingBox();
    if (!geo.boundingBox) return;
    geo.boundingBox.getSize(windowLightTmpSize);
    root.updateMatrixWorld(true);
    node.updateMatrixWorld(true);
    node.getWorldPosition(windowLightTmpWorld);
    windowLightTmpLocal.copy(windowLightTmpWorld);
    root.worldToLocal(windowLightTmpLocal);
    const local = windowLightTmpLocal.clone();
    const size = windowLightTmpSize.clone();
    const xFacing = size.x <= size.z && size.x <= size.y;
    const normal = xFacing
      ? new THREE.Vector3(local.x >= 0 ? 1 : -1, 0, 0)
      : new THREE.Vector3(0, 0, local.z >= 0 ? 1 : -1);
    const windowW = Math.max(0.10, xFacing ? size.z : size.x);
    const windowH = Math.max(0.10, size.y);
    const effects = [];

    const length = Math.max(0.82, Math.min(1.45, windowH * 4.2));
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(windowW * 2.8, length), M.windowGroundGlow);
    spill.rotation.x = -Math.PI / 2;
    spill.rotation.z = Math.atan2(normal.x, normal.z);
    spill.position.set(local.x + normal.x * length * 0.38, 0.032, local.z + normal.z * length * 0.38);
    spill.visible = false;
    spill.renderOrder = 4;
    spill.userData.noShadow = true;
    spill.userData.windowLightEffect = true;
    root.add(spill);
    effects.push(spill);

    const halo = new THREE.Sprite(M.windowHalo);
    halo.position.set(local.x + normal.x * 0.045, local.y, local.z + normal.z * 0.045);
    halo.scale.set(windowW * 2.2, windowH * 2.0, 1);
    halo.visible = false;
    halo.renderOrder = 6;
    halo.userData.noShadow = true;
    halo.userData.windowLightEffect = true;
    root.add(halo);
    effects.push(halo);

    node.userData.windowLightEffects = effects;
  }
  function prepareBuildingWindowLights(root, x, z) {
    if (!root || !root.traverse) return;
    let i = 0;
    const windows = [];
    root.traverse(node => {
      if (!node.isMesh || !buildingWindowBaseMaterials.has(node.material)) return;
      node.userData.windowLightBase = node.material;
      node.userData.windowLightSeed = cellRand(x, z, 700 + i++);
      windows.push(node);
    });
    for (const node of windows) createWindowLightEffects(root, node);
    updateBuildingWindowLights(root);
  }
  function updateBuildingWindowLights(root) {
    if (!root || !root.traverse) return;
    const prob = windowLightProbability(currentTodMinutes);
    const bucket = Math.floor(currentTodMinutes / 24);
    const nightGlass = prob > 0 && (currentTodMinutes >= 1080 || currentTodMinutes < 480);
    root.traverse(node => {
      if (!node.isMesh || !node.userData.windowLightBase) return;
      const on = prob > 0 && windowLightRand(node.userData.windowLightSeed || 0, bucket) < prob;
      node.material = on ? M.windowLit : (nightGlass ? M.windowNight : node.userData.windowLightBase);
      if (node.userData.windowLightEffects) {
        for (const effect of node.userData.windowLightEffects) {
          if (effect) effect.visible = on;
        }
      }
    });
  }
  function updateAllBuildingWindowLights() {
    for (const obj of buildingWindowObjects) {
      if (!obj || !obj.parent) buildingWindowObjects.delete(obj);
      else updateBuildingWindowLights(obj);
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

  function updateCarriageAfterChange(x, z, wasMax, isMax) {
    const key = x + ',' + z;
    if (wasMax && !isMax) {
      maxPumpkinPositions.delete(key);
      if (carriagePumpkin && carriagePumpkin.x === x && carriagePumpkin.z === z) {
        // Winner left — recompute (rare, only when the current carriage is lowered/erased)
        rebuildMaxPumpkinCache();
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

  const VEHICLE_BASE_WHEEL_RADIUS = 0.13;
  const VEHICLE_BODY_Y_GAP = 0.035;
  const VEHICLE_ACCEL = 8;
  const VEHICLE_BRAKE = 6.8;
  const VEHICLE_TURN_RATE = 3.1;
  const VEHICLE_WAYPOINT_EPSILON = 0.10;
  const VEHICLE_DEFAULT_SPEED = 1.6;
  const VEHICLE_VISUAL_SCALE_MIN = 0.20;
  const VEHICLE_VISUAL_SCALE_MAX = 1.8;
  const VEHICLE_COLLISION_RADIUS = 0.84;
  const VEHICLE_YIELD_RADIUS = 1.35;
  const VEHICLE_LANE_WIDTH = 0.42;
  const vehicleFleet = new Map();
  let nextVehicleId = 1;

  function clampVehicleNumber(v, lo, hi, fallback) {
    if (!Number.isFinite(v)) return fallback;
    return Math.max(lo, Math.min(hi, v));
  }

  function nextVehicleRuntimeId() {
    return 'vehicle-' + String(nextVehicleId++);
  }

  function worldToCellCoord(v) {
    return Math.round(v + GRID / 2 - 0.5);
  }

  function normalizeVehicleAction(action) {
    return String(action || '').trim().toLowerCase();
  }

  function vehicleCellFromWorld(x, z) {
    const cellX = worldToCellCoord(x);
    const cellZ = worldToCellCoord(z);
    return {
      cellX,
      cellZ,
      cell: getWorldCell(cellX, cellZ),
      inside: cellX >= 0 && cellX < GRID && cellZ >= 0 && cellZ < GRID,
    };
  }

  function hasVehicleBlockingKind(kind) {
    return !!kind && kind !== 'bridge';
  }

  function hasVehicleBlockingExtras(cell) {
    return !!(cell && cell.extras && cell.extras.some(extra => extra && hasVehicleBlockingKind(extra.kind)));
  }

  function isVehicleDrivableCell(cell) {
    if (!cell) return false;
    if (cell.kind === 'bridge') return true;
    if (hasVehicleBlockingKind(cell.kind)) return false;
    if (hasVehicleBlockingExtras(cell)) return false;
    return cell.terrain === 'path';
  }

  function isVehicleRoadCell(x, z) {
    if (x < 0 || x >= GRID || z < 0 || z >= GRID) return false;
    return isVehicleDrivableCell(getWorldCell(x, z));
  }

  function refreshVehiclesForWorldObstacleChange(x, z) {
    if (!vehicleFleet.size) return;
    for (const state of vehicleFleet.values()) {
      if (!state || state.remove || state.mode === 'manual') continue;
      const currentCell = vehicleCellFromWorld(state.x, state.z);
      if (currentCell.inside && !isVehicleRoadCell(currentCell.cellX, currentCell.cellZ)) {
        state.speed = 0;
        state.blockedBy = 'world:' + currentCell.cellX + ',' + currentCell.cellZ;
        state.collisionBrake = true;
        continue;
      }
      if (!state.pathGoal) continue;
      const pathTouchesEdit = state.path.some(wp => wp && wp.cellX === x && wp.cellZ === z);
      const pathHasObstacle = state.path.some(wp => !wp || !isVehicleRoadCell(wp.cellX, wp.cellZ));
      const blockedByWorld = typeof state.blockedBy === 'string' && state.blockedBy.startsWith('world:');
      if (!pathTouchesEdit && !pathHasObstacle && !blockedByWorld) continue;
      const rerouted = updateVehicleGoal(state.id, state.pathGoal.x, state.pathGoal.z);
      if (!rerouted || !state.path.length) {
        state.speed = 0;
        state.blockedBy = 'world:' + x + ',' + z;
        state.collisionBrake = false;
      } else {
        clearVehicleCollisionBrake(state);
      }
    }
  }

  function vehicleRoadHeightAtCell(x, z) {
    if (window.__tinyworldMeshTerrain && typeof window.__tinyworldMeshTerrain.anchorForCell === 'function') {
      const s = window.__tinyworldMeshTerrain.anchorForCell(Math.round(x), Math.round(z), { radius: 0.18 });
      if (s && Number.isFinite(s.y)) return s.y;
    }
    if (isLandscapeMeshActive()) {
      return landscapeHeightAtCell(x, z);
    }
    return TOP_H + terrainRiseAt(Math.round(x), Math.round(z));
  }

  function vehicleVisualScaleForGrid() {
    return 0.25;
  }

  function vehicleBodyYOffsetForScale(scale = 1) {
    return VEHICLE_BASE_WHEEL_RADIUS * Math.max(VEHICLE_VISUAL_SCALE_MIN, Math.min(VEHICLE_VISUAL_SCALE_MAX, scale)) + VEHICLE_BODY_Y_GAP;
  }

  function vehicleYAtCellForState(state, cellX, cellZ) {
    const yOffset = state && Number.isFinite(state.bodyYOffset)
      ? state.bodyYOffset
      : vehicleBodyYOffsetForScale(state && Number.isFinite(state.visualScale) ? state.visualScale : 1);
    return vehicleRoadHeightAtCell(cellX, cellZ) + yOffset;
  }

  function resolveRoadCellNearCell(cellX, cellZ, maxRadius = GRID * 2) {
    if (!Number.isFinite(cellX) || !Number.isFinite(cellZ)) return null;
    const sx = Math.round(cellX);
    const sz = Math.round(cellZ);
    if (isVehicleRoadCell(sx, sz)) return { x: sx, z: sz };

    if (maxRadius <= 0) return null;
    const queue = [[sx, sz, 0]];
    const seen = new Set([sx + ',' + sz]);
    let head = 0;

    while (head < queue.length) {
      const [cx, cz, d] = queue[head++];
      if (d > 0 && isVehicleRoadCell(cx, cz)) return { x: cx, z: cz };
      if (d >= maxRadius) continue;
      const neighbors = [
        [cx + 1, cz, d + 1],
        [cx - 1, cz, d + 1],
        [cx, cz + 1, d + 1],
        [cx, cz - 1, d + 1],
      ];
      for (const [nx, nz, nd] of neighbors) {
        const k = nx + ',' + nz;
        if (nx < -GRID || nx >= GRID * 2 || nz < -GRID || nz >= GRID * 2) continue;
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push([nx, nz, nd]);
      }
    }

    return null;
  }

  function resolveRoadCellFromCommand(x, z, maxRadius = GRID * 2) {
    return resolveRoadCellNearCell(Number(x), Number(z), maxRadius);
  }

  function resolveRoadCellFromWorld(x, z, maxRadius = GRID * 2) {
    const start = vehicleCellFromWorld(x, z);
    return resolveRoadCellNearCell(start.cellX, start.cellZ, maxRadius);
  }

  function normalizeVehicleControls(value) {
    return {
      forward: !!(value && value.forward),
      reverse: !!(value && value.reverse),
      left: !!(value && value.left),
      right: !!(value && value.right),
    };
  }

  function normalizeVehicleAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function pathKey(x, z) {
    return x + ',' + z;
  }

  function findVehiclePath(start, goal, blockedCells = null) {
    const s = resolveRoadCellFromWorld(start.x, start.z, 0);
    const g = resolveRoadCellFromWorld(goal.x, goal.z, 0);
    if (!s || !g) return [];
    if (s.x === g.x && s.z === g.z) return [];

    const startKey = pathKey(s.x, s.z);
    const goalKey = pathKey(g.x, g.z);

    const open = [{ x: s.x, z: s.z, g: 0, f: Math.abs(g.x - s.x) + Math.abs(g.z - s.z) }];
    const seen = new Set();
    const cameFrom = new Map();
    const gScore = new Map([[startKey, 0]]);

    while (open.length) {
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift();
      const curKey = pathKey(cur.x, cur.z);
      if (seen.has(curKey)) continue;
      seen.add(curKey);
      if (curKey === goalKey) break;

      const candidates = [
        [cur.x + 1, cur.z],
        [cur.x - 1, cur.z],
        [cur.x, cur.z + 1],
        [cur.x, cur.z - 1],
      ];
      for (const [nx, nz] of candidates) {
        if (!isVehicleRoadCell(nx, nz)) continue;
        const nk = pathKey(nx, nz);
        if (blockedCells && blockedCells.has(nk) && nk !== goalKey) continue;
        const tg = cur.g + 1;
        const prev = gScore.get(nk);
        if (prev !== undefined && tg >= prev) continue;
        gScore.set(nk, tg);
        cameFrom.set(nk, curKey);
        open.push({ x: nx, z: nz, g: tg, f: tg + Math.abs(g.x - nx) + Math.abs(g.z - nz) });
      }
    }

    if (!gScore.has(goalKey)) return [];

    const cells = [];
    let cursor = goalKey;
    while (cursor && cursor !== startKey) {
      const [cx, cz] = cursor.split(',').map(v => Number(v));
      cells.push({ x: cx, z: cz });
      cursor = cameFrom.get(cursor);
      if (cursor === undefined) return [];
    }

    cells.reverse();
    return cells.map(c => {
      const p = tilePos(c.x, c.z);
      return {
        x: p.x,
        z: p.z,
        cellX: c.x,
        cellZ: c.z,
      };
    });
  }

  function makeVehicleState(opts) {
    const rawId = (typeof opts.id === 'string' && opts.id.trim()) ? opts.id.trim() : '';
    if (rawId && vehicleFleet.has(rawId)) {
      removeVehicle(rawId);
    }
    const start = resolveRoadCellFromCommand(opts.x, opts.z);
    if (!start) return null;

    const id = rawId || nextVehicleRuntimeId();
    const visualScale = clampVehicleNumber(Number(opts.visualScale), VEHICLE_VISUAL_SCALE_MIN, VEHICLE_VISUAL_SCALE_MAX, vehicleVisualScaleForGrid(GRID));
    const mesh = makeVehicle({ visualScale });
    const p = tilePos(start.x, start.z);

    const state = {
      id,
      mesh,
      wheels: mesh.userData.wheels || [],
      flagPivots: mesh.userData.flagPivots || [],
      visualScale,
      bodyYOffset: vehicleBodyYOffsetForScale(visualScale),
      animOffset: Math.random() * Math.PI * 2,
      x: p.x,
      z: p.z,
      angle: clampVehicleNumber(Number(opts.angle), -Math.PI, Math.PI, 0),
      speed: 0,
      mode: normalizeVehicleAction(opts.mode) || 'manual',
      maxSpeed: clampVehicleNumber(Number(opts.maxSpeed), 0.2, 4.5, VEHICLE_DEFAULT_SPEED),
      maxReverseSpeed: clampVehicleNumber(Number(opts.maxReverseSpeed), 0.2, 2.2, 1.1),
      accel: clampVehicleNumber(Number(opts.accel), 0.5, 16, VEHICLE_ACCEL),
      brake: clampVehicleNumber(Number(opts.brake), 0.5, 22, VEHICLE_BRAKE),
      turnRate: clampVehicleNumber(Number(opts.turnRate), 1, 7, VEHICLE_TURN_RATE),
      controls: normalizeVehicleControls(opts.controls),
      goal: null,
      path: [],
      pathIndex: 0,
      pathGoal: null,
      blockedBy: null,
      blockedFor: 0,
      collisionBrake: false,
      trafficRerouteCooldown: 0,
      remove: false,
    };

    state.goal = Number.isFinite(opts.goalX) && Number.isFinite(opts.goalZ)
      ? { x: opts.goalX, z: opts.goalZ }
      : null;

    mesh.position.set(p.x, vehicleYAtCellForState(state, start.x, start.z), p.z);
    mesh.rotation.y = state.angle;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    worldGroup.add(mesh);

    registerRuntimeObject(mesh);
    vehicleFleet.set(id, state);

    if (state.mode !== 'manual' && state.goal) {
      const worldGoal = resolveRoadCellFromCommand(state.goal.x, state.goal.z, GRID);
      if (worldGoal) {
        const goalPoint = tilePos(worldGoal.x, worldGoal.z);
        const path = findVehiclePath({ x: p.x, z: p.z }, { x: goalPoint.x, z: goalPoint.z });
        state.path = path;
        state.pathGoal = { x: state.goal.x, z: state.goal.z };
        state.pathIndex = 0;
        if (path[0]) {
          state.angle = Math.atan2(path[0].x - state.x, path[0].z - state.z);
          mesh.rotation.y = state.angle;
        }
      }
    }

    return state;
  }

  function getVehicleById(idOrAll) {
    if (typeof idOrAll === 'string') return vehicleFleet.get(idOrAll) || null;
    for (const state of vehicleFleet.values()) return state;
    return null;
  }

  function clearVehicleRuntime() {
    for (const state of vehicleFleet.values()) {
      if (state.mesh) {
        if (state.mesh.parent) state.mesh.parent.remove(state.mesh);
        disposeGroup(state.mesh);
      }
    }
    vehicleFleet.clear();
  }

  function spawnVehicle(msg) {
    const state = makeVehicleState(msg);
    if (state) {
      return state;
    }
    return null;
  }

  function removeVehicle(idOrAll) {
    if (idOrAll === 'all' || idOrAll === '*') {
      clearVehicleRuntime();
      return true;
    }

    const state = getVehicleById(idOrAll);
    if (!state) return false;

    if (state.mesh) {
      if (state.mesh.parent) state.mesh.parent.remove(state.mesh);
      disposeGroup(state.mesh);
    }
    vehicleFleet.delete(state.id);
    return true;
  }

  function updateVehicleGoal(idOrAll, x, z) {
    const state = getVehicleById(idOrAll);
    if (!state) return false;

    const target = resolveRoadCellFromCommand(x, z, GRID);
    if (!target) return false;

    const goalPoint = tilePos(target.x, target.z);
    const path = findVehiclePath({ x: state.x, z: state.z }, {
      x: goalPoint.x,
      z: goalPoint.z,
    });

    state.path = path;
    state.pathIndex = 0;
    state.goal = target;
    state.pathGoal = { x, z };
    state.mode = 'auto';
    if (path[0] && Math.abs(state.speed) < 0.05) {
      state.angle = Math.atan2(path[0].x - state.x, path[0].z - state.z);
      state.mesh.rotation.y = state.angle;
    }
    return true;
  }

  function setVehicleControls(idOrAll, controls) {
    const state = getVehicleById(idOrAll);
    if (!state) return false;
    state.controls = normalizeVehicleControls(controls);
    if (state.controls.forward || state.controls.reverse || state.controls.left || state.controls.right) {
      state.mode = 'manual';
    }
    return true;
  }

  function vehicleDistanceSq(ax, az, bx, bz) {
    const dx = ax - bx;
    const dz = az - bz;
    return dx * dx + dz * dz;
  }

  function vehicleSegmentDistanceSq(px, pz, ax, az, bx, bz) {
    const vx = bx - ax;
    const vz = bz - az;
    const lenSq = vx * vx + vz * vz;
    if (lenSq <= 0.000001) return vehicleDistanceSq(px, pz, ax, az);
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / lenSq));
    const cx = ax + vx * t;
    const cz = az + vz * t;
    return vehicleDistanceSq(px, pz, cx, cz);
  }

  function vehiclePriorityKey(state) {
    return String(state && state.id ? state.id : '');
  }

  function vehicleHasPriority(state, other) {
    if (state.mode === 'manual' && other.mode !== 'manual') return true;
    if (other.mode === 'manual' && state.mode !== 'manual') return false;
    return vehiclePriorityKey(state) < vehiclePriorityKey(other);
  }

  function getVehicleTrafficBlockedCells(state) {
    const blocked = new Set();
    for (const other of vehicleFleet.values()) {
      if (other === state || other.remove) continue;
      const cell = vehicleCellFromWorld(other.x, other.z);
      if (cell.inside) blocked.add(pathKey(cell.cellX, cell.cellZ));
      const wp = other.path && other.path[other.pathIndex];
      if (wp && Number.isFinite(wp.cellX) && Number.isFinite(wp.cellZ)) blocked.add(pathKey(wp.cellX, wp.cellZ));
    }
    return blocked;
  }

  function rerouteVehicleAroundTraffic(state) {
    if (!state.pathGoal) return false;
    const target = resolveRoadCellFromCommand(state.pathGoal.x, state.pathGoal.z, GRID);
    if (!target) return false;
    const goalPoint = tilePos(target.x, target.z);
    const blockedCells = getVehicleTrafficBlockedCells(state);
    const path = findVehiclePath({ x: state.x, z: state.z }, {
      x: goalPoint.x,
      z: goalPoint.z,
    }, blockedCells);
    if (!path.length) return false;
    state.path = path;
    state.pathIndex = 0;
    state.goal = target;
    if (path[0]) {
      state.angle = Math.atan2(path[0].x - state.x, path[0].z - state.z);
      state.mesh.rotation.y = state.angle;
    }
    return true;
  }

  function getVehicleCollisionRisk(state, nextX, nextZ) {
    const hardSq = VEHICLE_COLLISION_RADIUS * VEHICLE_COLLISION_RADIUS;
    const yieldSq = VEHICLE_YIELD_RADIUS * VEHICLE_YIELD_RADIUS;
    const fx = Math.sin(state.angle);
    const fz = Math.cos(state.angle);

    for (const other of vehicleFleet.values()) {
      if (other === state || other.remove) continue;
      const currentSq = vehicleDistanceSq(state.x, state.z, other.x, other.z);
      const nextSq = vehicleDistanceSq(nextX, nextZ, other.x, other.z);
      const sweptSq = vehicleSegmentDistanceSq(other.x, other.z, state.x, state.z, nextX, nextZ);
      if (nextSq < hardSq || sweptSq < hardSq) {
        return { other, hard: true };
      }

      const relX = other.x - state.x;
      const relZ = other.z - state.z;
      const forward = relX * fx + relZ * fz;
      const lateral = Math.abs(relX * fz - relZ * fx);
      const directlyAhead = forward > 0 && forward < VEHICLE_YIELD_RADIUS && lateral < VEHICLE_LANE_WIDTH;
      const closing = nextSq < currentSq;
      if ((directlyAhead || (closing && nextSq < yieldSq)) && !vehicleHasPriority(state, other)) {
        return { other, hard: false };
      }
    }

    return null;
  }

  function applyVehicleCollisionBrake(state, risk, dt) {
    state.blockedBy = risk && risk.other ? risk.other.id : null;
    state.blockedFor += dt;
    state.collisionBrake = !!(risk && risk.hard);
    state.speed *= Math.max(0, 1 - state.brake * dt * (risk && risk.hard ? 2.6 : 1.4));
    if (risk && risk.hard) state.speed = 0;
    if (Math.abs(state.speed) < 0.04) state.speed = 0;
    if (state.blockedFor > 0.7 && state.trafficRerouteCooldown <= 0 && rerouteVehicleAroundTraffic(state)) {
      state.trafficRerouteCooldown = 1.4;
      state.blockedFor = 0;
    }
    if (state.mesh && state.mesh.userData) {
      state.mesh.userData.blockedBy = state.blockedBy;
      state.mesh.userData.collisionBrake = state.collisionBrake;
    }
  }

  function clearVehicleCollisionBrake(state) {
    state.blockedBy = null;
    state.blockedFor = 0;
    state.collisionBrake = false;
    if (state.mesh && state.mesh.userData) {
      state.mesh.userData.blockedBy = null;
      state.mesh.userData.collisionBrake = false;
    }
  }

  function getVehicleRuntimeSnapshot() {
    const vehicles = Array.from(vehicleFleet.values()).map(state => ({
      id: state.id,
      x: state.x,
      z: state.z,
      speed: state.speed,
      mode: state.mode,
      pathLength: state.path.length,
      pathIndex: state.pathIndex,
      blockedBy: state.blockedBy,
      blockedFor: state.blockedFor,
      collisionBrake: state.collisionBrake,
      trafficRerouteCooldown: state.trafficRerouteCooldown,
      visualScale: state.visualScale,
      gridSize: GRID,
      visible: !!(state.mesh && state.mesh.visible),
    }));
    let minDistance = null;
    for (let i = 0; i < vehicles.length; i++) {
      for (let j = i + 1; j < vehicles.length; j++) {
        const d = Math.hypot(vehicles[i].x - vehicles[j].x, vehicles[i].z - vehicles[j].z);
        if (minDistance === null || d < minDistance) minDistance = d;
      }
    }
    return {
      count: vehicles.length,
      collisionRadius: VEHICLE_COLLISION_RADIUS,
      yieldRadius: VEHICLE_YIELD_RADIUS,
      minDistance,
      vehicles,
    };
  }

  function tickVehicle(state, dt) {
    if (state.trafficRerouteCooldown > 0) {
      state.trafficRerouteCooldown = Math.max(0, state.trafficRerouteCooldown - dt);
    }
    const currentCell = vehicleCellFromWorld(state.x, state.z);
    if (currentCell.inside) {
      state.mesh.position.y = isLandscapeMeshActive()
        ? vehicleYAtCellForState(state, state.x + GRID / 2 - 0.5, state.z + GRID / 2 - 0.5)
        : vehicleYAtCellForState(state, currentCell.cellX, currentCell.cellZ);
    }

    if (!state.path.length && state.pathGoal && state.mode !== 'manual') {
      updateVehicleGoal(state.id, state.pathGoal.x, state.pathGoal.z);
    }

    let throttle = 0;
    let steer = 0;

    if (state.mode === 'manual') {
      throttle = state.controls.forward ? 1 : (state.controls.reverse ? -1 : 0);
      steer = (state.controls.left ? -1 : 0) + (state.controls.right ? 1 : 0);
    } else if (state.path.length) {
      const target = state.path[state.pathIndex];
      if (!target) {
        state.path = [];
        state.pathIndex = 0;
        state.pathGoal = null;
        state.mode = 'manual';
        state.speed = 0;
      } else {
        const dx = target.x - state.x;
        const dz = target.z - state.z;
        const dist = Math.hypot(dx, dz);

        if (dist < VEHICLE_WAYPOINT_EPSILON) {
          state.pathIndex += 1;
          if (state.pathIndex >= state.path.length) {
            state.path = [];
            state.pathIndex = 0;
            state.pathGoal = null;
            state.mode = 'manual';
            state.speed = 0;
          }
        } else if (state.pathIndex < state.path.length) {
          const desired = Math.atan2(dx, dz);
          const delta = normalizeVehicleAngle(desired - state.angle);
          const maxTurn = state.turnRate * dt;
          if (Math.abs(delta) > maxTurn) {
            state.angle += Math.sign(delta) * maxTurn;
          } else {
            state.angle = desired;
          }
          throttle = 1;
        }
      }
    }

    if (steer) {
      const steerAmount = Math.sign(steer) * state.turnRate * dt * (Math.abs(state.speed) > 0.1 ? 1 : 0.6);
      state.angle += steerAmount;
    }

    if (throttle > 0) state.speed += state.accel * throttle * dt;
    else if (throttle < 0) state.speed -= state.accel * Math.abs(throttle) * dt;
    else state.speed *= Math.max(0, 1 - state.brake * dt * 0.4);

    state.speed = clampVehicleNumber(state.speed, -state.maxReverseSpeed, state.maxSpeed, 0);

    if (!Number.isFinite(state.speed)) state.speed = 0;

    const dx = Math.sin(state.angle) * state.speed * dt;
    const dz = Math.cos(state.angle) * state.speed * dt;
    const nextX = state.x + dx;
    const nextZ = state.z + dz;

    const nextCell = vehicleCellFromWorld(nextX, nextZ);
    if (!nextCell.inside || !isVehicleRoadCell(nextCell.cellX, nextCell.cellZ)) {
      state.speed *= 0.15;
      if (state.path.length && state.pathGoal) {
        updateVehicleGoal(state.id, state.pathGoal.x, state.pathGoal.z);
      }
      return;
    }

    const collisionRisk = getVehicleCollisionRisk(state, nextX, nextZ);
    if (collisionRisk) {
      applyVehicleCollisionBrake(state, collisionRisk, dt);
      state.mesh.rotation.y = state.angle;
      return;
    }
    clearVehicleCollisionBrake(state);

    state.x = nextX;
    state.z = nextZ;
    state.mesh.position.x = state.x;
    state.mesh.position.z = state.z;
    state.mesh.rotation.y = state.angle;

    for (const w of state.wheels) {
      w.rotation.x += state.speed * dt * 0.4;
    }

    const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const flutter = Math.sin(nowMs * 0.005 + state.animOffset) * 0.22;
    for (const flagPivot of state.flagPivots) {
      flagPivot.rotation.y = flutter;
    }
  }

  function tickVehicles(dt) {
    if (!vehicleFleet.size) return;

    // Budget vehicle simulation so the Vehicle Demo (with 8–20+ cars) stays smooth
    // even on mid-range devices. We process as many as fit in ~4ms per frame.
    const budgetMs = 4.0;
    const start = performance.now();

    const remove = [];
    for (const [id, state] of vehicleFleet) {
      tickVehicle(state, dt);
      if (state.remove) remove.push(id);

      if (performance.now() - start > budgetMs) break;
    }

    for (const id of remove) removeVehicle(id);

    for (const state of vehicleFleet.values()) {
      if (state.path.length && state.pathIndex < state.path.length) {
        const wp = state.path[state.pathIndex];
        if (!wp || !isVehicleRoadCell(wp.cellX, wp.cellZ)) {
          if (state.pathGoal) updateVehicleGoal(state.id, state.pathGoal.x, state.pathGoal.z);
          else {
            state.path = [];
            state.pathIndex = 0;
          }
        }
      }
    }
  }

  function handleVehicleRemoteCommand(msg) {
    const raw = normalizeVehicleAction(msg.action || msg.op);
    if (!raw) return;
    const action = raw === 'vehicle' ? 'spawn' : raw.replace(/^vehicle[_-]/, '');

    if (action === 'spawn') {
      const state = spawnVehicle({
        id: msg.id,
        x: Number(msg.x),
        z: Number(msg.z),
        angle: Number(msg.angle),
        maxSpeed: Number(msg.maxSpeed),
        maxReverseSpeed: Number(msg.maxReverseSpeed),
        accel: Number(msg.accel),
        brake: Number(msg.brake),
        turnRate: Number(msg.turnRate),
        visualScale: Number(msg.visualScale || msg.scale),
        controls: msg.controls,
        mode: msg.mode || (Number.isFinite(Number(msg.goalX)) && Number.isFinite(Number(msg.goalZ)) ? 'auto' : 'manual'),
        goalX: Number(msg.goalX),
        goalZ: Number(msg.goalZ),
      });
      if (!state && typeof console !== 'undefined') {
        console.warn('[vehicle] failed to spawn', msg);
      }
      return;
    }

    if (action === 'set_goal') {
      const gx = Number.isFinite(Number(msg.x)) ? Number(msg.x) : Number(msg.goalX);
      const gz = Number.isFinite(Number(msg.z)) ? Number(msg.z) : Number(msg.goalZ);
      updateVehicleGoal(msg.id || msg.vehicleId, gx, gz);
      return;
    }

    if (action === 'controls' || action === 'set_controls') {
      setVehicleControls(msg.id || msg.vehicleId, normalizeVehicleControls(msg.controls || msg));
      return;
    }

    if (action === 'remove') {
      removeVehicle(msg.id || msg.vehicleId || 'all');
      return;
    }

    if (action === 'clear' || action === 'clear_all') {
      clearVehicleRuntime();
      return;
    }
  }
