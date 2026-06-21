  // -------- seeded vehicle demo --------
  const VEHICLE_DEMO_DEFAULT_SEED = 'tide-ridge-428';
  const VEHICLE_DEMO_LARGE_SEED = 'metro-culdesac-20';
  const VEHICLE_DEMO_LARGE_SIZE_DEFAULT = 20;
  const VEHICLE_DEMO_LARGE_SIZE_MIN = 12;
  const VEHICLE_DEMO_LARGE_SIZE_MAX = 20;
  const VEHICLE_DEMO_LARGE_CARS_DEFAULT = 36;
  const VEHICLE_DEMO_LARGE_CARS_MAX = 120;
  const vehicleDemoTimers = [];
  let vehicleDemoInterval = 0;
  let activeVehicleDemoSeed = '';
  let activeVehicleDemoVariant = 'standard';
  let activeVehicleDemoSize = 0;
  let activeVehicleDemoCarCount = 0;

  function stopSeededVehicleDemo(opts = {}) {
    while (vehicleDemoTimers.length) clearTimeout(vehicleDemoTimers.pop());
    if (vehicleDemoInterval) {
      clearInterval(vehicleDemoInterval);
      vehicleDemoInterval = 0;
    }
    hideVehicleDemoBadge();
    if (opts.clearVehicles) clearVehicleRuntime();
  }

  function queueVehicleDemoStep(fn, delay) {
    const timer = setTimeout(() => {
      const idx = vehicleDemoTimers.indexOf(timer);
      if (idx >= 0) vehicleDemoTimers.splice(idx, 1);
      fn();
    }, delay);
    vehicleDemoTimers.push(timer);
    return timer;
  }

  function readVehicleDemoParam(params, names) {
    for (const name of names) {
      if (params.has(name)) return params.get(name);
    }
    return null;
  }

  function coerceLargeVehicleDemoSize(value, fallback = VEHICLE_DEMO_LARGE_SIZE_DEFAULT) {
    if (value === null || value === undefined || value === '') return fallback;
    const n = parseInt(value, 10);
    const allowed = HOME_GRID_OPTIONS.filter(size => size >= VEHICLE_DEMO_LARGE_SIZE_MIN && size <= VEHICLE_DEMO_LARGE_SIZE_MAX);
    if (isValidGridSize(n) && n >= VEHICLE_DEMO_LARGE_SIZE_MIN && n <= VEHICLE_DEMO_LARGE_SIZE_MAX) return n;
    let best = allowed.includes(fallback) ? fallback : VEHICLE_DEMO_LARGE_SIZE_DEFAULT;
    let bestDist = Infinity;
    for (const size of allowed) {
      const dist = Math.abs(size - n);
      if (dist < bestDist) {
        best = size;
        bestDist = dist;
      }
    }
    return best;
  }

  function coerceVehicleDemoCarCount(value, fallback = VEHICLE_DEMO_LARGE_CARS_DEFAULT, max = VEHICLE_DEMO_LARGE_CARS_MAX) {
    if (value === null || value === undefined || value === '') return fallback;
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.min(max, n));
  }

  function vehicleDemoShareUrl(seed = VEHICLE_DEMO_DEFAULT_SEED, opts = {}) {
    const url = new URL(window.location.href);
    for (const key of ['size', 'mapSize', 'grid', 'gridSize', 'cars', 'carCount', 'vehicles', 'vehicleCount']) {
      url.searchParams.delete(key);
    }
    if (opts.variant === 'large') {
      url.searchParams.set('demo', 'vehicles-large');
      if (opts.size) url.searchParams.set('size', String(opts.size));
      if (opts.carCount) url.searchParams.set('cars', String(opts.carCount));
    } else {
      url.searchParams.set('demo', 'vehicles');
    }
    url.searchParams.set('seed', String(seed || (opts.variant === 'large' ? VEHICLE_DEMO_LARGE_SEED : VEHICLE_DEMO_DEFAULT_SEED)));
    return url.href;
  }

  function getVehicleDemoUrlRequest() {
    const params = new URLSearchParams(window.location.search || '');
    const hash = String(window.location.hash || '').replace(/^#\??/, '');
    if (hash && hash.includes('=')) {
      const hashParams = new URLSearchParams(hash);
      hashParams.forEach((value, key) => { if (!params.has(key)) params.set(key, value); });
    }
    const demo = normalizeVehicleAction(params.get('demo') || params.get('twbDemo'));
    const scale = normalizeVehicleAction(params.get('scale') || params.get('vehicleScale'));
    const rawSize = readVehicleDemoParam(params, ['size', 'mapSize', 'grid', 'gridSize']);
    const rawCars = readVehicleDemoParam(params, ['cars', 'carCount', 'vehicles', 'vehicleCount']);
    const requestedSize = rawSize !== null ? coerceLargeVehicleDemoSize(rawSize) : null;
    const requestedCars = rawCars !== null ? coerceVehicleDemoCarCount(rawCars, null) : null;
    const large = demo === 'vehicles-large'
      || demo === 'large-vehicles'
      || demo === 'vehicle-large'
      || scale === 'large'
      || scale === 'stress'
      || requestedSize !== null
      || (requestedCars !== null && requestedCars > 3);
    const enabled = large
      || demo === 'vehicles'
      || demo === 'vehicle-demo'
      || params.get('vehicleDemo') === '1'
      || params.has('vehicleSeed');
    if (!enabled) return null;
    return {
      seed: params.get('seed') || params.get('vehicleSeed') || params.get('worldSeed') || (large ? VEHICLE_DEMO_LARGE_SEED : VEHICLE_DEMO_DEFAULT_SEED),
      variant: large ? 'large' : 'standard',
      size: large ? (requestedSize || VEHICLE_DEMO_LARGE_SIZE_DEFAULT) : null,
      carCount: large ? requestedCars : null,
    };
  }

  const ISLAND_STRESS_DEFAULT_COUNT = 50;
  const ISLAND_STRESS_MAX_COUNT = 120;

  function coerceIslandStressCount(value, fallback = ISLAND_STRESS_DEFAULT_COUNT) {
    if (value === null || value === undefined || value === '') return fallback;
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.min(ISLAND_STRESS_MAX_COUNT, n));
  }

  function getIslandStressDemoUrlRequest() {
    const params = new URLSearchParams(window.location.search || '');
    const hash = String(window.location.hash || '').replace(/^#\??/, '');
    if (hash && hash.includes('=')) {
      const hashParams = new URLSearchParams(hash);
      hashParams.forEach((value, key) => { if (!params.has(key)) params.set(key, value); });
    }
    const demo = String(params.get('demo') || params.get('twbDemo') || '').toLowerCase().replace(/_/g, '-');
    const enabled = demo === 'islands'
      || demo === 'island-stress'
      || demo === 'sky-islands'
      || params.get('islandStress') === '1';
    if (!enabled) return null;
    return {
      count: coerceIslandStressCount(params.get('islands') || params.get('islandCount') || params.get('count')),
    };
  }

  function islandStressDemoShareUrl(count = ISLAND_STRESS_DEFAULT_COUNT) {
    const url = new URL(window.location.href);
    url.searchParams.set('demo', 'island-stress');
    url.searchParams.set('islands', String(coerceIslandStressCount(count)));
    url.searchParams.set('stats', '1');
    return url.href;
  }

  function showVehicleDemoBadge(seed, vehicleCount, opts = {}) {
    if (!document || !document.body) return;
    document.body.classList.add('vehicle-demo-active');
    let badge = document.getElementById('vehicle-demo-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'vehicle-demo-badge';
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
    title.textContent = 'Vehicle demo running';

    const detail = document.createElement('span');
    const sizeText = opts.gridSize && opts.gridSize !== HOME_GRID_DEFAULT ? opts.gridSize + '×' + opts.gridSize + ' map · ' : '';
    detail.textContent = vehicleCount + ' delivery bots driving roads · ' + sizeText + 'seed ' + seed;

    badge.append(dot, title, detail);
  }

  function hideVehicleDemoBadge() {
    if (!document || !document.body) return;
    document.body.classList.remove('vehicle-demo-active');
    const badge = document.getElementById('vehicle-demo-badge');
    if (badge) badge.remove();
  }

  function buildLargeScaleVehicleDemo(seed = VEHICLE_DEMO_LARGE_SEED, opts = {}) {
    const rng = makeMulberry32('vehicle-demo-large:' + seed);
    const size = coerceLargeVehicleDemoSize(opts.size, VEHICLE_DEMO_LARGE_SIZE_DEFAULT);
    const roadCells = new Set();
    const waterCells = new Set();
    const culdesacEndpoints = [];
    const keyOf = (x, z) => x + ',' + z;
    const inBounds = (x, z) => x >= 0 && x < size && z >= 0 && z < size;
    const addRoad = (x, z) => {
      if (!inBounds(x, z)) return;
      roadCells.add(keyOf(x, z));
    };
    const addWater = (x, z) => {
      if (!inBounds(x, z)) return;
      waterCells.add(keyOf(x, z));
    };
    const pushEndpoint = (x, z) => {
      if (!inBounds(x, z)) return;
      const key = keyOf(x, z);
      if (roadCells.has(key)) culdesacEndpoints.push([x, z]);
    };
    const edgeInset = Math.max(4, Math.round(size * 0.03125));
    const firstArterial = Math.max(edgeInset, Math.round(size * 0.0625));
    const lastArterial = size - firstArterial;
    const arterialStep = Math.max(6, Math.round(size / 10.67));
    const arterials = [];
    for (let coord = firstArterial; coord <= lastArterial; coord += arterialStep) {
      arterials.push(coord);
    }
    if (!arterials.includes(lastArterial)) arterials.push(lastArterial);

    for (const z of arterials) {
      for (let x = edgeInset; x < size - edgeInset; x++) addRoad(x, z);
    }
    for (const x of arterials) {
      for (let z = edgeInset; z < size - edgeInset; z++) addRoad(x, z);
    }

    const addRectRoad = (x0, z0, x1, z1) => {
      for (let x = x0; x <= x1; x++) {
        addRoad(x, z0);
        addRoad(x, z1);
      }
      for (let z = z0; z <= z1; z++) {
        addRoad(x0, z);
        addRoad(x1, z);
      }
    };
    const addScaledRing = (lo, hi) => {
      const x0 = Math.max(edgeInset, Math.min(size - edgeInset - 4, Math.round(size * lo)));
      const z0 = x0;
      const x1 = Math.min(size - edgeInset - 1, Math.max(x0 + 4, Math.round(size * hi)));
      const z1 = x1;
      addRectRoad(x0, z0, x1, z1);
    };
    addScaledRing(0.109375, 0.8828125);
    addScaledRing(0.296875, 0.6953125);
    addScaledRing(0.40625, 0.5859375);

    const addCuldesac = (entryX, entryZ, dirX, dirZ, length) => {
      let endX = entryX;
      let endZ = entryZ;
      for (let i = 0; i <= length; i++) {
        endX = entryX + dirX * i;
        endZ = entryZ + dirZ * i;
        addRoad(endX, endZ);
      }
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > 2) continue;
          addRoad(endX + dx, endZ + dz);
        }
      }
      pushEndpoint(endX, endZ);
    };

    for (let xi = 0; xi < arterials.length - 1; xi++) {
      for (let zi = 0; zi < arterials.length - 1; zi++) {
        const x0 = arterials[xi];
        const x1 = arterials[xi + 1];
        const z0 = arterials[zi];
        const z1 = arterials[zi + 1];
        const midX = Math.floor((x0 + x1) / 2);
        const midZ = Math.floor((z0 + z1) / 2);
        const jitter = Math.max(1, Math.round(arterialStep * 0.17));
        const len = Math.max(3, Math.min(Math.max(4, Math.floor(size / 16)), Math.floor((x1 - x0) * 0.45)));
        if (rng() < 0.62) addCuldesac(x0, midZ, 1, 0, len);
        if (rng() < 0.48) addCuldesac(x1, midZ + (rng() < 0.5 ? -jitter : jitter), -1, 0, len);
        if (rng() < 0.54) addCuldesac(midX + (rng() < 0.5 ? -jitter : jitter), z0, 0, 1, len);
        if (rng() < 0.42) addCuldesac(midX, z1, 0, -1, len);
      }
    }

    const riverHalfWidth = size >= 96 ? 1 : 0;
    const verticalRiverX = Math.round(size * 0.5);
    const horizontalRiverZ = Math.round(size * 0.265625);
    const verticalCurveAmp = Math.max(1, Math.round(size * 0.0234375));
    const horizontalCurveAmp = Math.max(1, Math.round(size * 0.015625));
    for (let z = 0; z < size; z++) {
      const curve = Math.round(Math.sin(z * 0.18) * verticalCurveAmp);
      for (let w = -riverHalfWidth; w <= riverHalfWidth; w++) addWater(verticalRiverX + curve + w, z);
    }
    for (let x = 0; x < size; x++) {
      const curve = Math.round(Math.cos(x * 0.16) * horizontalCurveAmp);
      for (let w = -riverHalfWidth; w <= riverHalfWidth; w++) addWater(x, horizontalRiverZ + curve + w);
    }

    const cells = [];
    const seen = new Set();
    function pushCell(x, z, terrain, kind = null, floors = 1, terrainFloors = 1, extras = []) {
      if (!inBounds(x, z)) return;
      const key = keyOf(x, z);
      if (seen.has(key)) {
        const idx = cells.findIndex(c => c.x === x && c.z === z);
        if (idx >= 0) cells.splice(idx, 1);
      }
      seen.add(key);
      cells.push({
        x,
        z,
        terrain,
        kind,
        floors,
        terrainFloors,
        buildingType: null,
        fenceSide: null,
        extras,
      });
    }

    for (const key of waterCells) {
      const [x, z] = key.split(',').map(Number);
      pushCell(x, z, 'water', null);
    }
    for (const key of roadCells) {
      const [x, z] = key.split(',').map(Number);
      if (waterCells.has(key)) pushCell(x, z, 'water', 'bridge');
      else pushCell(x, z, 'path', null);
    }

    const occupied = new Set([...roadCells, ...waterCells]);
    const roadList = Array.from(roadCells).map(k => k.split(',').map(Number));
    const decorKinds = ['tree', 'tree', 'bush', 'tuft', 'flower', 'rock', 'sheep', 'cow'];
    const decorCount = Math.min(2400, Math.max(120, Math.round(720 * (size * size) / (VEHICLE_DEMO_LARGE_SIZE_DEFAULT * VEHICLE_DEMO_LARGE_SIZE_DEFAULT))));
    for (let i = 0; i < decorCount; i++) {
      const road = roadList[Math.floor(rng() * roadList.length)];
      if (!road) continue;
      const [rx, rz] = road;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const [dx, dz] = dirs[Math.floor(rng() * dirs.length)];
      const x = rx + dx * (1 + Math.floor(rng() * 3));
      const z = rz + dz * (1 + Math.floor(rng() * 3));
      const key = keyOf(x, z);
      if (!inBounds(x, z) || occupied.has(key)) continue;
      occupied.add(key);
      if (rng() < 0.34) {
        pushCell(x, z, 'grass', 'house', 1 + Math.floor(rng() * 2), 1, rng() < 0.35 ? [{ kind: 'tuft', floors: 1 }] : []);
      } else {
        pushCell(x, z, 'grass', decorKinds[Math.floor(rng() * decorKinds.length)], 1 + Math.floor(rng() * 2));
      }
    }

    const endpointKeys = new Set();
    const endpoints = [];
    for (const point of culdesacEndpoints) {
      const key = keyOf(point[0], point[1]);
      if (endpointKeys.has(key) || !roadCells.has(key)) continue;
      endpointKeys.add(key);
      endpoints.push(point);
    }
    const sampleIndexes = [0, 0.22, 0.44, 0.66, 0.88, 1]
      .map(t => Math.min(arterials.length - 1, Math.max(0, Math.round((arterials.length - 1) * t))));
    const sampleArterials = Array.from(new Set(sampleIndexes.map(i => arterials[i])));
    for (const z of sampleArterials) {
      for (const x of sampleArterials) {
        const key = keyOf(x, z);
        if (!endpointKeys.has(key) && roadCells.has(key)) {
          endpointKeys.add(key);
          endpoints.push([x, z]);
        }
      }
    }
    if (!endpoints.length && roadList.length) {
      const fallbackStep = Math.max(1, Math.floor(roadList.length / 24));
      for (let i = 0; i < roadList.length; i += fallbackStep) endpoints.push(roadList[i]);
    }

    const vehicles = [];
    const requestedCarCount = coerceVehicleDemoCarCount(opts.carCount, null, VEHICLE_DEMO_LARGE_CARS_MAX);
    const defaultVehicleCount = Math.min(VEHICLE_DEMO_LARGE_CARS_DEFAULT, Math.max(12, Math.floor(endpoints.length / 4)));
    const maxVehicleCount = Math.min(VEHICLE_DEMO_LARGE_CARS_MAX, Math.max(1, endpoints.length));
    const vehicleCount = Math.min(maxVehicleCount, Math.max(1, requestedCarCount || defaultVehicleCount));
    const endpointAt = (index) => endpoints[((index % endpoints.length) + endpoints.length) % endpoints.length];
    const usedStarts = new Set();
    const pickUniqueEndpoint = (index) => {
      for (let i = 0; i < endpoints.length; i++) {
        const point = endpointAt(index + i);
        const key = keyOf(point[0], point[1]);
        if (usedStarts.has(key)) continue;
        usedStarts.add(key);
        return point;
      }
      return endpointAt(index);
    };
    for (let i = 0; i < vehicleCount; i++) {
      const base = Math.floor(i * endpoints.length / vehicleCount) + i * 7;
      const start = pickUniqueEndpoint(base);
      const targets = [
        endpointAt(base + Math.floor(endpoints.length * 0.47)),
        endpointAt(base + Math.floor(endpoints.length * 0.63)),
        endpointAt(base + Math.floor(endpoints.length * 0.79)),
      ].filter(point => point && (point[0] !== start[0] || point[1] !== start[1]));
      vehicles.push({
        id: 'metro-' + String(i + 1).padStart(2, '0'),
        label: 'large route ' + (i + 1),
        start,
        targets,
        maxSpeed: 1.05 + (i % 5) * 0.12,
      });
    }

    return {
      seed,
      variant: 'large',
      renderOrigin: { x: size / 2, z: size / 2 },
      interval: 9000,
      spawnDelay: vehicleCount > 12 ? 45 : 140,
      world: {
        v: 4,
        gridSize: size,
        cameraMode: 'perspective',
        toolId: 'select',
        cells,
      },
      stats: {
        roadCells: roadCells.size,
        waterCells: waterCells.size,
        culdesacs: endpoints.length,
        requestedCars: requestedCarCount,
        cars: vehicleCount,
        size,
      },
      vehicles,
    };
  }

  function buildSeededVehicleDemo(seed = VEHICLE_DEMO_DEFAULT_SEED, opts = {}) {
    if (opts.variant === 'large') return buildLargeScaleVehicleDemo(seed || VEHICLE_DEMO_LARGE_SEED, opts);
    const rng = makeMulberry32('vehicle-demo:' + seed);
    const roadCells = new Set();
    const waterRow = 4;
    const bridgeCols = [1, 3, 5, 6];
    const addRoad = (x, z) => roadCells.add(x + ',' + z);
    for (let x = 1; x <= 6; x++) {
      addRoad(x, 1);
      addRoad(x, 3);
      addRoad(x, 6);
    }
    for (let z = 1; z <= 6; z++) {
      addRoad(1, z);
      addRoad(3, z);
      addRoad(5, z);
      addRoad(6, z);
    }
    addRoad(2, 2);
    addRoad(4, 2);
    addRoad(2, 5);
    addRoad(4, 5);

    const cells = [];
    const seen = new Set();
    function pushCell(x, z, terrain, kind = null, floors = 1, terrainFloors = 1, extras = []) {
      const key = x + ',' + z;
      if (seen.has(key)) {
        const idx = cells.findIndex(c => c.x === x && c.z === z);
        if (idx >= 0) cells.splice(idx, 1);
      }
      seen.add(key);
      cells.push({
        x,
        z,
        terrain,
        kind,
        floors,
        terrainFloors,
        buildingType: null,
        fenceSide: null,
        extras,
      });
    }

    for (let x = 0; x < 8; x++) pushCell(x, waterRow, 'water', null);
    for (const key of roadCells) {
      const [x, z] = key.split(',').map(Number);
      if (z === waterRow && bridgeCols.includes(x)) pushCell(x, z, 'water', 'bridge');
      else pushCell(x, z, 'path', null);
    }

    const occupied = new Set([...roadCells, ...Array.from({ length: 8 }, (_, x) => x + ',' + waterRow)]);
    const decorKinds = ['tree', 'tuft', 'flower', 'bush', 'sheep'];
    for (let x = 0; x < 8; x++) {
      for (let z = 0; z < 8; z++) {
        const key = x + ',' + z;
        if (occupied.has(key)) continue;
        const edge = x === 0 || z === 0 || x === 7 || z === 7;
        const roll = rng();
        if (edge && roll < 0.22) pushCell(x, z, 'grass', 'tree', 1 + Math.floor(rng() * 2));
        else if (!edge && roll < 0.16) pushCell(x, z, 'grass', decorKinds[Math.floor(rng() * decorKinds.length)]);
        else if (!edge && roll > 0.92) pushCell(x, z, 'grass', 'house', 1, 1, [{ kind: 'tuft', floors: 1 }]);
      }
    }

    return {
      seed,
      world: {
        v: 4,
        gridSize: 8,
        cameraMode: 'perspective',
        toolId: 'select',
        cells,
      },
      vehicles: [
        { id: 'seed-red', label: 'red loop', start: [1, 1], targets: [[6, 6], [1, 1], [6, 1], [1, 6]], maxSpeed: 1.35 },
        { id: 'seed-blue', label: 'blue loop', start: [6, 6], targets: [[1, 1], [6, 6], [1, 6], [6, 1]], maxSpeed: 1.18 },
        { id: 'seed-gold', label: 'bridge runner', start: [1, 6], targets: [[6, 1], [1, 6], [6, 6], [1, 1]], maxSpeed: 1.05 },
      ],
    };
  }

  function dismissWelcomeForDemo() {
    const modal = document.getElementById('welcome-modal');
    if (!modal || modal.hidden) return;
    if (typeof closeTinyModal === 'function') closeTinyModal(modal);
    else modal.hidden = true;
  }

  function applyVehicleDemoTargets(spec, cycle) {
    for (const vehicle of spec.vehicles) {
      const target = vehicle.targets[cycle % vehicle.targets.length];
      updateVehicleGoal(vehicle.id, target[0], target[1]);
    }
  }

  function runSeededVehicleDemo(seed = VEHICLE_DEMO_DEFAULT_SEED, opts = {}) {
    const spec = buildSeededVehicleDemo(seed || (opts.variant === 'large' ? VEHICLE_DEMO_LARGE_SEED : VEHICLE_DEMO_DEFAULT_SEED), opts);
    stopSeededVehicleDemo({ clearVehicles: true });
    activeVehicleDemoSeed = spec.seed;
    activeVehicleDemoVariant = spec.variant || 'standard';
    activeVehicleDemoSize = spec.world && spec.world.gridSize ? spec.world.gridSize : 0;
    activeVehicleDemoCarCount = spec.vehicles.length;
    try { localStorage.setItem('tinyworld:vehicle-demo:last-seed', spec.seed); } catch (_) {}
    dismissWelcomeForDemo();
    showVehicleDemoBadge(spec.seed, spec.vehicles.length, { gridSize: activeVehicleDemoSize });
    if (typeof setCameraMode === 'function') setCameraMode('perspective');
    if (typeof resetCameraDefaults === 'function') resetCameraDefaults();

    const startVehicles = () => {
      dismissWelcomeForDemo();
      if (typeof setCameraMode === 'function') setCameraMode('perspective');
      if (typeof resetCameraDefaults === 'function') resetCameraDefaults();
      clearVehicleRuntime();
      const spawnDelay = Number.isFinite(spec.spawnDelay) ? spec.spawnDelay : 280;
      spec.vehicles.forEach((vehicle, index) => {
        queueVehicleDemoStep(() => {
          spawnVehicle({
            id: vehicle.id,
            x: vehicle.start[0],
            z: vehicle.start[1],
            mode: 'manual',
            maxSpeed: vehicle.maxSpeed,
          });
        }, spawnDelay * index);
      });
      queueVehicleDemoStep(() => {
        let cycle = 0;
        applyVehicleDemoTargets(spec, cycle);
        vehicleDemoInterval = setInterval(() => {
          cycle += 1;
          applyVehicleDemoTargets(spec, cycle);
        }, opts.interval || spec.interval || 4500);
      }, 1100 + spec.vehicles.length * spawnDelay);
      window.__lastVehicleDemo = {
        seed: spec.seed,
        variant: spec.variant || 'standard',
        stats: spec.stats || null,
        gridSize: spec.world && spec.world.gridSize,
        carCount: spec.vehicles.length,
        shareUrl: vehicleDemoShareUrl(spec.seed, {
          variant: spec.variant,
          size: spec.world && spec.world.gridSize,
          carCount: spec.vehicles.length,
        }),
        vehicles: spec.vehicles.map(v => ({ id: v.id, start: v.start, targets: v.targets })),
      };
      console.info('[vehicle-demo] seed', spec.seed, window.__lastVehicleDemo.shareUrl);
    };

    const ok = applyState(spec.world, {
      sliced: true,
      renderOrigin: spec.renderOrigin || { x: 0, z: 0 },
      skipGhostBoards: spec.variant === 'large',
      onDone: startVehicles,
    });
    if (!ok) {
      console.warn('[vehicle-demo] failed to apply seeded world', spec);
      return false;
    }
    return true;
  }

  window.__runVehicleSeedDemo = runSeededVehicleDemo;
  window.__stopVehicleSeedDemo = stopSeededVehicleDemo;
  window.__vehicleDemoShareUrl = vehicleDemoShareUrl;
  window.__vehicleDemoDefaultSeed = VEHICLE_DEMO_DEFAULT_SEED;
  window.__getVehicleRuntimeSnapshot = getVehicleRuntimeSnapshot;

  function tilePos(x, z) {
    return new THREE.Vector3(x - GRID / 2 + 0.5, 0, z - GRID / 2 + 0.5);
  }

  // Write the same coordinates as tilePos() into a caller-supplied vector and
  // return it. Lets hot paths reuse a scratch Vector3 instead of allocating.
  function tilePosInto(out, x, z) {
    return out.set(x - GRID / 2 + 0.5, 0, z - GRID / 2 + 0.5);
  }

  // -------- crowd layer --------
  let crowdLayer = null;
  let crowdLoadStarted = false;
  let crowdCount = Math.round(storedNumber(RENDER_LS.crowdCount, 12, 0, 80));
  let crowdScale = storedNumber(RENDER_LS.crowdScale, 0.75, 0.25, 1.6);
  let crowdSpeedMul = storedNumber(RENDER_LS.crowdSpeed, 1, 0, 2);
  let crowdBob = storedNumber(RENDER_LS.crowdBob, 2.4, 0, 8);
  let crowdSway = storedNumber(RENDER_LS.crowdSway, 1.4, 0, 8);
  let crowdLean = storedNumber(RENDER_LS.crowdLean, 0.07, 0, 0.2);
  let crowdZoneRadius = storedNumber(RENDER_LS.crowdZoneRadius, 0.16, 0.04, 0.6);
  let crowdShowZones = localStorage.getItem(RENDER_LS.crowdShowZones) !== '0';
  let crowdPaused = localStorage.getItem(RENDER_LS.crowdPaused) === '1';
  let crowdDebug = localStorage.getItem(RENDER_LS.crowdDebug) !== '0';
  let crowdMode = localStorage.getItem(RENDER_LS.crowdMode) || 'wander';
  let crowdShowArrows = localStorage.getItem(RENDER_LS.crowdShowArrows) !== '0';
  let crowdEnabled = localStorage.getItem(RENDER_LS.crowdEnabled) !== '0';
  let crowdRuntimeVisible = true;
  const crowdModelActorGroup = new THREE.Group();
  crowdModelActorGroup.name = 'crowd-model-actors';
  worldGroup.add(crowdModelActorGroup);
  const crowdModelActors = new Map();
  const crowdModelAssetLoadIds = new Set();
  let crowdModelActiveAssetId = null;
  let crowdModelSpritesVisible = true;

  function persistCrowdSettings() {
    localStorage.setItem(RENDER_LS.crowdCount, String(crowdCount));
    localStorage.setItem(RENDER_LS.crowdScale, crowdScale.toFixed(2));
    localStorage.setItem(RENDER_LS.crowdSpeed, crowdSpeedMul.toFixed(2));
    localStorage.setItem(RENDER_LS.crowdBob, crowdBob.toFixed(1));
    localStorage.setItem(RENDER_LS.crowdSway, crowdSway.toFixed(1));
    localStorage.setItem(RENDER_LS.crowdLean, crowdLean.toFixed(2));
    localStorage.setItem(RENDER_LS.crowdZoneRadius, crowdZoneRadius.toFixed(2));
    localStorage.setItem(RENDER_LS.crowdShowZones, crowdShowZones ? '1' : '0');
    localStorage.setItem(RENDER_LS.crowdPaused, crowdPaused ? '1' : '0');
    localStorage.setItem(RENDER_LS.crowdDebug, crowdDebug ? '1' : '0');
    localStorage.setItem(RENDER_LS.crowdMode, crowdMode);
    localStorage.setItem(RENDER_LS.crowdShowArrows, crowdShowArrows ? '1' : '0');
    localStorage.setItem(RENDER_LS.crowdEnabled, crowdEnabled ? '1' : '0');
  }

  function crowdConfigOverride() {
    return {
      speed: 45 * crowdSpeedMul,
      bob: crowdBob,
      sway: crowdSway,
      lean: crowdLean,
      debug: crowdDebug,
      paused: crowdPaused,
    };
  }

  function crowdWorldConfigOverride() {
    return {
      doorHeight: 0.48,
      personDoorRatio: 0.86,
      zoneRadius: crowdZoneRadius,
      showZones: crowdShowZones,
      showArrows: crowdShowArrows,
      showSprites: crowdModelSpritesVisible,
    };
  }

  function crowdModelAssetSignature(asset) {
    return [asset && asset.id, asset && asset.label, asset && asset.path, asset && asset.url].filter(Boolean).join(' ');
  }

  function isCrowdModelCharacterCandidate(asset) {
    if (!asset || !asset.supported || !MODEL_STAMP_SUPPORTED_FORMATS.has(asset.format)) return false;
    const sig = crowdModelAssetSignature(asset);
    return CROWD_MODEL_CHARACTER_RE.test(sig) && !CROWD_MODEL_NEGATIVE_RE.test(sig);
  }

  function modelStampSceneHasSkinnedMesh(asset) {
    const cache = asset && modelStampAssetCache.get(asset.id);
    if (!cache || cache.state !== 'ready' || !cache.scene) return false;
    let found = false;
    cache.scene.traverse(node => {
      if (node && node.isSkinnedMesh) found = true;
    });
    return found;
  }

  function crowdModelCharacterScore(asset) {
    const sig = crowdModelAssetSignature(asset);
    const clips = modelStampAnimationClipsForAsset(asset);
    let score = String(asset && asset.label || '').length * 0.001;
    if (asset && (asset.format === 'glb' || asset.format === 'gltf')) score += 30;
    if (modelStampSceneHasSkinnedMesh(asset)) score += 80;
    if (clips.length) score += 60;
    if (/hitman/i.test(sig)) score += 24;
    if (/heisenberg/i.test(sig)) score += 18;
    if (/character|person|human|man|woman|rig|skinned/i.test(sig)) score += 10;
    return score;
  }

  function crowdModelCharacterCandidates() {
    return MODEL_STAMP_ASSETS
      .filter(isCrowdModelCharacterCandidate)
      .sort((a, b) => crowdModelCharacterScore(b) - crowdModelCharacterScore(a));
  }

  function modelStampAnimationClipsForAsset(asset) {
    const cache = asset && modelStampAssetCache.get(asset.id);
    return cache && cache.state === 'ready' && Array.isArray(cache.animations) ? cache.animations : [];
  }

  function modelStampHasRiggedCrowdAnimation(asset) {
    return modelStampSceneHasSkinnedMesh(asset) && modelStampAnimationClipsForAsset(asset).length > 0;
  }

  function ensureCrowdModelCharacterAssetsLoading() {
    for (const asset of crowdModelCharacterCandidates()) {
      if (crowdModelAssetLoadIds.has(asset.id)) continue;
      crowdModelAssetLoadIds.add(asset.id);
      loadModelStampAsset(asset, () => {
        if (crowdEnabled && crowdLayer) {
          crowdModelActiveAssetId = null;
          renderSceneIfReady();
        }
      }, err => {
        console.warn('[crowd-model] failed to load character model', asset.label || asset.id, err);
      });
    }
  }

  function selectCrowdModelCharacterAsset() {
    const candidates = crowdModelCharacterCandidates();
    let best = null;
    let bestScore = -1;
    for (const asset of candidates) {
      const cache = modelStampAssetCache.get(asset.id);
      if (!cache || cache.state !== 'ready' || !cache.scene) continue;
      if (!modelStampHasRiggedCrowdAnimation(asset)) continue;
      const score = crowdModelCharacterScore(asset);
      if (score > bestScore) {
        best = asset;
        bestScore = score;
      }
    }
    return best;
  }

  function pickRiggedCharacterAnimationClip(clips, mode) {
    const list = Array.isArray(clips) ? clips : [];
    const moveRe = /(walk|run|jog|move|locomotion)/i;
    const idleRe = /(idle|stand|breath)/i;
    if (mode === 'idle') return list.find(clip => idleRe.test(clip.name || '')) || null;
    return list.find(clip => moveRe.test(clip.name || ''))
      || list.find(clip => !idleRe.test(clip.name || ''))
      || list[0]
      || null;
  }

  function createRiggedCharacterRuntime(root, clips = [], opts = {}) {
    const moveClip = pickRiggedCharacterAnimationClip(clips, 'move');
    const idleClip = pickRiggedCharacterAnimationClip(clips, 'idle');
    const runtime = {
      root,
      mixer: null,
      moveAction: null,
      idleAction: null,
      procedural: !moveClip,
      phase: opts.phase || Math.random() * Math.PI * 2,
    };
    if (moveClip || idleClip) {
      runtime.mixer = new THREE.AnimationMixer(root);
      if (moveClip) {
        runtime.moveAction = runtime.mixer.clipAction(moveClip);
        runtime.moveAction.enabled = true;
        runtime.moveAction.setEffectiveWeight(1);
        runtime.moveAction.play();
      }
      if (idleClip && idleClip !== moveClip) {
        runtime.idleAction = runtime.mixer.clipAction(idleClip);
        runtime.idleAction.enabled = true;
        runtime.idleAction.setEffectiveWeight(0);
        runtime.idleAction.play();
      }
    }
    return runtime;
  }

  function updateRiggedCharacterRuntime(runtime, dt, state = {}) {
    if (!runtime || !runtime.root) return;
    const moving = !!state.moving;
    const speed = Math.max(0, Number(state.speed) || 0);
    const speedMul = Math.max(0, Number(state.speedMul) || 1);
    if (runtime.moveAction) {
      runtime.moveAction.paused = !moving;
      runtime.moveAction.setEffectiveWeight(moving ? 1 : (runtime.idleAction ? 0 : 1));
      runtime.moveAction.timeScale = Math.max(0.25, Math.min(2.5, speed * speedMul * 5.5));
    }
    if (runtime.idleAction) runtime.idleAction.setEffectiveWeight(moving ? 0 : 1);
    if (runtime.mixer) runtime.mixer.update(dt || 0);
    if (runtime.procedural) {
      const cadence = moving ? Math.max(2.2, Math.min(7.2, speed * speedMul * 18)) : 1.35;
      runtime.phase += (dt || 0) * cadence;
      const step = Math.sin(runtime.phase);
      const bounce = moving ? Math.abs(Math.sin(runtime.phase * 2)) * 0.030 : Math.sin(runtime.phase) * 0.006;
      const sway = moving ? step * 0.070 : Math.sin(runtime.phase * 0.7) * 0.016;
      runtime.root.position.y += bounce;
      runtime.root.rotation.z = sway;
      runtime.root.rotation.x = moving ? Math.cos(runtime.phase) * 0.035 : 0;
    } else {
      runtime.root.rotation.z = 0;
      runtime.root.rotation.x = 0;
    }
  }

  function disposeRiggedCharacterRuntime(runtime) {
    if (!runtime) return;
    if (runtime.mixer) runtime.mixer.stopAllAction();
    runtime.mixer = null;
    runtime.moveAction = null;
    runtime.idleAction = null;
  }

  function setCrowdSpritesVisible(visible) {
    crowdModelSpritesVisible = !!visible;
    if (!crowdLayer) return;
    if (typeof crowdLayer.setSpritesVisible === 'function') {
      crowdLayer.setSpritesVisible(crowdModelSpritesVisible);
    } else if (crowdLayer.people && crowdLayer.people.forEach) {
      crowdLayer.people.forEach(person => {
        if (person.sprite) person.sprite.visible = crowdModelSpritesVisible;
      });
    }
  }

  function disposeCrowdModelActor(actor) {
    if (!actor) return;
    disposeRiggedCharacterRuntime(actor.runtime);
    if (actor.root && actor.root.parent) actor.root.parent.remove(actor.root);
    if (actor.root) disposeGroup(actor.root);
  }

  function clearCrowdModelActors() {
    crowdModelActors.forEach(disposeCrowdModelActor);
    crowdModelActors.clear();
    crowdModelActiveAssetId = null;
    setCrowdSpritesVisible(true);
  }

  function setCrowdRuntimeVisible(visible) {
    crowdRuntimeVisible = !!visible;
    if (crowdLayer && crowdLayer.group) crowdLayer.group.visible = crowdRuntimeVisible;
    crowdModelActorGroup.visible = crowdRuntimeVisible;
    if (!crowdRuntimeVisible) {
      clearCrowdModelActors();
      setCrowdSpritesVisible(false);
    } else {
      setCrowdSpritesVisible(true);
    }
  }

  function makeCrowdModelActor(asset) {
    const cache = asset && modelStampAssetCache.get(asset.id);
    if (!cache || cache.state !== 'ready' || !cache.scene) return null;
    const root = normalizeModelStampObject(cloneModelStampScene(cache.scene), asset);
    root.name = 'crowd-model-' + asset.id;
    root.userData.crowdActor = true;
    root.userData.modelStampId = asset.id;
    const bounds = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    const actor = {
      root,
      assetId: asset.id,
      baseScale: root.scale.x || 1,
      baseHeight: Math.max(0.001, size.y || 1),
      runtime: null,
    };
    actor.runtime = createRiggedCharacterRuntime(root, modelStampAnimationClipsForAsset(asset));
    crowdModelActorGroup.add(root);
    return actor;
  }

  function updateCrowdModelActor(actor, person, dt) {
    const pos = tilePos(person.x, person.z);
    const groundY = crowdTerrainHeightAt(person.x, person.z) + (person.y || 0);
    const desiredHeight = crowdWorldConfigOverride().doorHeight
      * crowdWorldConfigOverride().personDoorRatio
      * crowdScale
      * (person.scale || 1)
      * (person.sizeMul || 1);
    const scale = actor.baseScale * desiredHeight / actor.baseHeight;
    const moving = !crowdPaused && !!(person.route && person.route.length > 1 && person.speed);
    actor.root.position.set(pos.x, groundY, pos.z);
    actor.root.rotation.y = Math.PI * 0.5 - person.heading;
    actor.root.scale.setScalar(scale);
    updateRiggedCharacterRuntime(actor.runtime, dt, {
      moving,
      speed: person.speed || 0.18,
      speedMul: person.speedMul || 1,
    });
  }

  function updateCrowdModelActors(dt) {
    if (!crowdRuntimeVisible) {
      clearCrowdModelActors();
      setCrowdSpritesVisible(false);
      return;
    }
    ensureCrowdModelCharacterAssetsLoading();
    const asset = selectCrowdModelCharacterAsset();
    if (!crowdEnabled || !crowdLayer || !asset) {
      clearCrowdModelActors();
      return;
    }
    if (crowdModelActiveAssetId !== asset.id) {
      clearCrowdModelActors();
      crowdModelActiveAssetId = asset.id;
    }
    setCrowdSpritesVisible(false);
    const people = typeof crowdLayer.getPeople === 'function'
      ? crowdLayer.getPeople()
      : Array.from(crowdLayer.people ? crowdLayer.people.values() : []);
    const liveIds = new Set();
    for (const person of people) {
      liveIds.add(person.id);
      let actor = crowdModelActors.get(person.id);
      if (!actor || actor.assetId !== asset.id) {
        disposeCrowdModelActor(actor);
        actor = makeCrowdModelActor(asset);
        if (actor) crowdModelActors.set(person.id, actor);
      }
      if (actor) updateCrowdModelActor(actor, person, dt);
    }
    for (const [id, actor] of crowdModelActors.entries()) {
      if (liveIds.has(id)) continue;
      disposeCrowdModelActor(actor);
      crowdModelActors.delete(id);
    }
  }

  function applyCrowdSettings({ reseed = false } = {}) {
    persistCrowdSettings();
    if (!crowdLayer) return;
    crowdLayer.scale = crowdScale;
    crowdLayer.configure(crowdConfigOverride(), crowdWorldConfigOverride());
    if (reseed || crowdLayer.people.size !== crowdCount) seedCrowdPeople();
  }

  function crowdTerrainHeightAt(x, z) {
    const cellX = Math.max(0, Math.min(GRID - 1, Math.round(x)));
    const cellZ = Math.max(0, Math.min(GRID - 1, Math.round(z)));
    if (window.__tinyworldMeshTerrain && typeof window.__tinyworldMeshTerrain.anchorForCell === 'function') {
      const s = window.__tinyworldMeshTerrain.anchorForCell(cellX, cellZ, { radius: 0.12 });
      if (s && Number.isFinite(s.y)) return s.y + 0.025;
    }
    if (isLandscapeMeshActive()) return landscapeHeightAtCell(cellX, cellZ) + 0.025;
    return TOP_H + terrainRiseAt(cellX, cellZ) + 0.025;
  }

  // Terrain a crowd person may walk on. Crowds now roam any walkable LAND;
  // paths/bridges are preferred routes (see path bias below). Water and lava are
  // impassable, and any placed object (house, tree, rock, …) blocks the cell.
  const CROWD_WALKABLE_TERRAIN = new Set(['grass', 'path', 'dirt', 'sand', 'snow', 'stone']);
  function isCrowdWalkableCell(x, z) {
    if (x < 0 || x >= GRID || z < 0 || z >= GRID) return false;
    const cell = getWorldCell(x, z);
    if (cell.kind === 'bridge') return true;   // bridges cross water
    if (cell.kind) return false;               // houses/trees/rocks/etc. block
    return CROWD_WALKABLE_TERRAIN.has(cell.terrain);
  }

  function isCrowdPathCell(x, z) {
    const cell = getWorldCell(x, z);
    return cell.kind === 'bridge' || (!cell.kind && cell.terrain === 'path');
  }

  // True when the straight line a→b stays entirely on walkable cells, so a
  // person walking it won't cut through a house, object, or water. Sampled at
  // ~3 points per tile. This is the lightweight stand-in for the fork's envelope
  // detours: we reject blocked segments rather than actively routing around them.
  function crowdSegmentWalkable(ax, az, bx, bz) {
    const steps = Math.max(3, Math.ceil(Math.hypot(bx - ax, bz - az) * 4));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const cx = Math.round(ax + (bx - ax) * t);
      const cz = Math.round(az + (bz - az) * t);
      if (!isCrowdWalkableCell(cx, cz)) return false;
    }
    return true;
  }

  function collectCrowdWalkableCells() {
    const walkable = [], paths = [];
    for (let x = 0; x < GRID; x++) {
      for (let z = 0; z < GRID; z++) {
        if (!isCrowdWalkableCell(x, z)) continue;
        const c = { x, z };
        walkable.push(c);
        if (isCrowdPathCell(x, z)) paths.push(c);
      }
    }
    return { walkable, paths };
  }

  // Back-compat: callers that just need somewhere to stand.
  function collectCrowdPathCells() {
    return collectCrowdWalkableCells().walkable;
  }

  const crowdJitterCell = cell => ({
    x: cell.x + (Math.random() - 0.5) * 0.22,
    z: cell.z + (Math.random() - 0.5) * 0.22,
  });

  // Path-biased free-space wander: chain up to ~8 waypoints, each reachable from
  // the previous by a walkable straight segment (so the route never crosses a
  // house or water). ~70% of waypoints are drawn from path cells when any exist,
  // so crowds favour roads but still roam onto open land. The route loops, so the
  // closing segment (last→seed) is validated too — trailing waypoints whose
  // return-to-start would cut a corner are trimmed.
  // BFS shortest path over walkable cells (4-connected) from a→b. Returns an
  // array of {x,z} cell centres, or null if unreachable. This is how crowds
  // actively route AROUND houses/water/objects through gaps (vs. the old
  // reject-blocked-segment approach), so they never cut through obstacles and
  // never get stuck — replacing the fork's envelope-detour + recovery machinery
  // with a robust grid path that needs no per-step vendor hooks.
  function crowdGridPath(ax, az, bx, bz) {
    ax = Math.round(ax); az = Math.round(az); bx = Math.round(bx); bz = Math.round(bz);
    if (!isCrowdWalkableCell(ax, az) || !isCrowdWalkableCell(bx, bz)) return null;
    if (ax === bx && az === bz) return [{ x: bx, z: bz }];
    const key = (x, z) => x + ',' + z;
    const goalKey = key(bx, bz);
    const came = new Map();
    came.set(key(ax, az), null);
    const queue = [[ax, az]];
    let head = 0;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (head < queue.length) {
      const [cx, cz] = queue[head++];
      if (cx === bx && cz === bz) break;
      for (let d = 0; d < 4; d++) {
        const nx = cx + dirs[d][0], nz = cz + dirs[d][1], k = key(nx, nz);
        if (came.has(k) || !isCrowdWalkableCell(nx, nz)) continue;
        came.set(k, key(cx, cz));
        queue.push([nx, nz]);
      }
    }
    if (!came.has(goalKey)) return null;
    const path = [];
    let k = goalKey;
    while (k) {
      const c = k.split(',');
      path.push({ x: +c[0], z: +c[1] });
      k = came.get(k);
    }
    return path.reverse();
  }

  // Drop collinear points so a straight corridor becomes two waypoints and the
  // route only keeps the turns (around obstacles), avoiding cell-by-cell zigzag.
  function crowdSimplifyPath(path) {
    if (!path || path.length <= 2) return path ? path.slice() : [];
    const out = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
      const a = path[i - 1], b = path[i], c = path[i + 1];
      if (Math.sign(b.x - a.x) !== Math.sign(c.x - b.x) || Math.sign(b.z - a.z) !== Math.sign(c.z - b.z)) out.push(b);
    }
    out.push(path[path.length - 1]);
    return out;
  }

  function crowdWanderRoute(seed, walkable, paths) {
    if (!walkable.length) return null;
    const route = [{ x: seed.x, z: seed.z }];
    let cur = { x: seed.x, z: seed.z };
    const HOPS = 4; // chained destinations, each reached via a grid path around obstacles
    const appendPath = (path, dropLast) => {
      const simp = crowdSimplifyPath(path);
      const end = dropLast ? simp.length - 1 : simp.length;
      for (let i = 1; i < end; i++) route.push(crowdJitterCell(simp[i]));
    };
    for (let n = 0; n < HOPS; n++) {
      const pool = (paths.length && Math.random() < 0.7) ? paths : walkable;
      let dest = null;
      for (let tries = 0; tries < 16; tries++) {
        const cand = pool[Math.floor(Math.random() * pool.length)];
        if (!cand) continue;
        if (Math.abs(cand.x - cur.x) + Math.abs(cand.z - cur.z) < 2) continue; // not too close
        dest = cand;
        break;
      }
      if (!dest) continue;
      const path = crowdGridPath(cur.x, cur.z, dest.x, dest.z);
      if (!path || path.length < 2) continue;
      appendPath(path, false);
      cur = { x: dest.x, z: dest.z };
    }
    // Close the loop back to the seed so the follower can cycle cleanly.
    const back = crowdGridPath(cur.x, cur.z, seed.x, seed.z);
    if (back && back.length >= 2) appendPath(back, true);
    return route.length > 1 ? route : null;
  }

  function crowdRouteAround(seed, walkable, paths, index) {
    if (crowdMode === 'static') return null;
    if (crowdMode === 'cross') {
      const far = walkable
        .map(cell => ({ cell, d: Math.abs(cell.x - seed.x) + Math.abs(cell.z - seed.z) }))
        .sort((a, b) => b.d - a.d)
        .slice(0, Math.max(1, Math.floor(walkable.length * 0.25)));
      const target = far[index % far.length].cell;
      if (crowdSegmentWalkable(seed.x, seed.z, target.x, target.z)) return [crowdJitterCell(seed), crowdJitterCell(target)];
      return crowdWanderRoute(seed, walkable, paths);
    }
    if (crowdMode === 'circle') {
      const cx = (GRID - 1) / 2;
      const cz = (GRID - 1) / 2;
      return walkable
        .slice()
        .sort((a, b) => Math.atan2(a.z - cz, a.x - cx) - Math.atan2(b.z - cz, b.x - cx))
        .filter((_, i) => i % Math.max(1, Math.floor(walkable.length / 10)) === index % Math.max(1, Math.floor(walkable.length / 10)))
        .slice(0, 10)
        .map(crowdJitterCell);
    }
    return crowdWanderRoute(seed, walkable, paths);
  }

  function seedCrowdPeople() {
    if (!crowdLayer || !crowdLayer.loaded) return;
    crowdLayer.clear();
    clearCrowdModelActors();
    if (!crowdEnabled) return;
    const { walkable, paths } = collectCrowdWalkableCells();
    // Spawn preferentially on paths so crowds start on roads, then wander out.
    const spawnCells = paths.length ? paths : walkable;
    const count = Math.min(crowdCount, walkable.length);
    if (!count) return;
    const characters = ['townie', 'little-girl', 'dad', 'grandfather', 'grandmother'];
    for (let i = 0; i < count; i++) {
      const seed = spawnCells[(i * 3) % spawnCells.length];
      const route = crowdRouteAround(seed, walkable, paths, i);
      crowdLayer.addPerson({
        id: 'ambient-' + i,
        x: seed.x + (Math.random() - 0.5) * 0.24,
        z: seed.z + (Math.random() - 0.5) * 0.24,
        heading: Math.random() * Math.PI * 2,
        character: characters[i % characters.length],
        speed: route ? 0.18 + Math.random() * 0.08 : 0,
        route,
        radius: crowdZoneRadius,
        scale: 0.92 + Math.random() * 0.18,
      });
    }
  }

  function initCrowdLayer() {
    if (crowdLayer || crowdLoadStarted || !window.TinyCrowdLayer || !crowdEnabled) return;
    crowdLoadStarted = true;
    crowdLayer = new window.TinyCrowdLayer({
      THREE,
      root: worldGroup,
      camera,
      textureBasePath: 'crowd/',
      tileToWorld: tilePos,
      getTerrainHeight: crowdTerrainHeightAt,
      scale: crowdScale,
      config: crowdConfigOverride(),
      worldConfig: crowdWorldConfigOverride(),
    });
    if (crowdLayer.group) crowdLayer.group.visible = crowdRuntimeVisible;
    ensureCrowdModelCharacterAssetsLoading();
    crowdLayer.load().then(seedCrowdPeople).catch(err => {
      console.warn('[crowd] failed to load sprites', err);
    });
  }

  window.__tinyworldCrowd = Object.assign(window.__tinyworldCrowd || {}, {
    setRuntimeVisible: setCrowdRuntimeVisible,
    runtimeVisible: () => crowdRuntimeVisible,
  });
