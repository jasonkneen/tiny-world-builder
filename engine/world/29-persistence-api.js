  // -------- persistence --------
  // Saves world intent (cells with non-default state), camera mode, and active
  // tool to localStorage. Debounced so bursts of setCell calls (load / clear /
  // reset) only write once. Versioned key — bump VERSION when the cell schema
  // changes so old saves don't blow up.
  const STORAGE_KEY = 'tinyworld:v1';
  const STORAGE_VERSION = 4;
  let saveTimer = null;
  let suppressSave = false;

  // One-shot migration — strips terrainFloors > 1 from any cell whose
  // kind requires flat ground (everything except rock). Touches the live
  // autosave and every named slot in tinyworld:worlds.v1.  Gated on a
  // single flag so we never run it twice.  Idempotent if you do.
  (function migrateStiltedHouses() {
    const FLAG = 'tinyworld:migration:stilts.v1';
    try {
      if (localStorage.getItem(FLAG) === '1') return;
    } catch (_) { return; }
    const FLAT_REQUIRED = new Set([
      'house','fence','bridge','tree','tuft','flower','bush','cow','sheep',
      'crop','corn','wheat','pumpkin','carrot','sunflower','lamp-post','spotlight',
    ]);
    function fixCells(cells) {
      if (!Array.isArray(cells)) return 0;
      let touched = 0;
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (Array.isArray(c)) {
          // tuple form: [x,z,terrain,kind,floors,buildingType,terrainFloors,fenceSide]
          const kind = c[3], terrain = c[2];
          const tf = c[6];
          if (tf && tf > 1 && ((kind && FLAT_REQUIRED.has(kind)) || terrain === 'path' || terrain === 'dirt')) {
            c[6] = 1; touched++;
          }
        } else if (c && typeof c === 'object') {
          const kind = c.kind;
          const terrain = c.terrain;
          if (c.terrainFloors && c.terrainFloors > 1 &&
              ((kind && FLAT_REQUIRED.has(kind)) || terrain === 'path' || terrain === 'dirt')) {
            c.terrainFloors = 1; touched++;
          }
        }
      }
      return touched;
    }
    function fixStateBlob(raw) {
      if (!raw) return null;
      try {
        const data = JSON.parse(raw);
        const t = fixCells(data && data.cells);
        return t > 0 ? JSON.stringify(data) : null;
      } catch (_) { return null; }
    }
    let total = 0;
    try {
      const live = localStorage.getItem('tinyworld:v1');
      const fixed = fixStateBlob(live);
      if (fixed) { localStorage.setItem('tinyworld:v1', fixed); total += 1; }
    } catch (_) {}
    try {
      const raw = localStorage.getItem('tinyworld:worlds.v1');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          let any = false;
          for (const slot of list) {
            if (!slot || !slot.state) continue;
            const t = fixCells(slot.state.cells);
            if (t > 0) any = true;
          }
          if (any) { localStorage.setItem('tinyworld:worlds.v1', JSON.stringify(list)); total += 1; }
        }
      }
    } catch (_) {}
    try { localStorage.setItem(FLAG, '1'); } catch (_) {}
    if (total > 0) console.info('[stilts-migration] flattened houses-on-stilts in saved state');
  })();

  // Build the full world-state object (cells + islands + moorings +
  // landscape) and RETURN it. This is the single source of truth shared by
  // saveState (which JSON-stringifies + persists it) and the multiplayer
  // snapshot path (engine/world/38-multiplayer-partykit.js), which serializes
  // the SAME object to ship the host's world to a freshly-admitted peer.
  // Pure builder: no side effects, never persists, ignores suppressSave.
  function buildWorldStateObject() {
    const cells = [];
    // Walk every populated row + cell, including out-of-home
    // overrides from clicks on ghost boards. Cells with default
    // grass / no kind return null from serializeCell and are
    // skipped naturally.
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
        // Outside the home grid we only save cells the user has
        // actually edited — skips the 20x20 pre-allocated buffer.
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
      voxelBuildStamps: referencedVoxelBuildStamps(cells),
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
  // Cross-module access for the multiplayer snapshot builder (module 38).
  window.buildWorldStateObject = buildWorldStateObject;

  function saveState() {
    if (typeof window.__requestMinimapRepaint === 'function') window.__requestMinimapRepaint();
    if (suppressSave) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        twSafeSetItem(STORAGE_KEY, JSON.stringify(buildWorldStateObject()), 'World');
      } catch (_) {}
    }, 200);
  }

  // Apply a parsed state object to the world. Used by both localStorage
  // restore and JSON file import. Accepts schema v1/v2 cells where `floors`
  // was overloaded, v3 cells with separate terrainFloors, and v4 fence sides. Walks the FULL
  // grid so every cell gets a tile mesh, then layers in the saved overrides.
  // AI world-gen may author bespoke objects inline via cell.customParts. Turn
  // each into a registered voxel-build stamp and rewrite the cell to reference
  // it, BEFORE normalization/validation (which only know native fields). Runs
  // only for fresh AI output; saved worlds already carry voxelBuildId + no parts.
  function customPartCellFootprint(cell, name) {
    const explicit = Number(cell && (cell.customFootprint || cell.footprint || cell.renderFootprint));
    if (Number.isFinite(explicit)) return Math.max(0.6, Math.min(3.2, explicit));
    const sig = String(name || '').toLowerCase();
    if (/\b(bridge|walkway|footbridge|deck|platform|pier|dock|stairs|step)\b/.test(sig)) return 1.12;
    if (/\b(hot.?air|balloon|airship|zeppelin|spaceship|space\s*ship|ship|boat|submarine|train|greenhouse|glasshouse|dome|observatory|factory|workshop)\b/.test(sig)) return 1.65;
    if (/\b(tower|lighthouse|windmill|watermill|crane|statue|monument|portal|gatehouse)\b/.test(sig)) return 1.35;
    return 1.18;
  }

  function customPartCellDefaultOffsetY(cell, name) {
    const transform = cell && cell.transform;
    if (Array.isArray(transform) && transform.length >= 4 && Number.isFinite(Number(transform[3]))) return 0;
    if (transform && typeof transform === 'object' && Number.isFinite(Number(transform.offsetY))) return 0;
    const sig = String(name || '').toLowerCase();
    if (/\b(bridge|walkway|footbridge|deck|platform|pier|dock)\b/.test(sig)) return -0.08;
    return 0;
  }

  function applyCustomPartCellDefaultTransform(cell, offsetY) {
    if (!cell || !offsetY) return;
    if (Array.isArray(cell.transform)) {
      cell.transform = [
        Number(cell.transform[0]) || 0,
        Number(cell.transform[1]) || 0,
        Number(cell.transform[2]) || 0,
        offsetY,
      ];
      return;
    }
    const transform = cell.transform && typeof cell.transform === 'object' ? Object.assign({}, cell.transform) : {};
    transform.offsetY = offsetY;
    cell.transform = transform;
  }

  function materializeCustomPartCells(data) {
    if (!data || !Array.isArray(data.cells)) return;
    if (typeof normalizeVoxelBuildStamp !== 'function') return;
    for (const c of data.cells) {
      if (!c || Array.isArray(c) || typeof c !== 'object') continue;
      const parts = c.customParts;
      if (!Array.isArray(parts) || !parts.length) { if (c) { delete c.customParts; delete c.customName; } continue; }
      const name = (typeof c.customName === 'string' && c.customName.trim()) ? c.customName.trim() : 'Custom Object';
      const footprint = customPartCellFootprint(c, name);
      const offsetY = customPartCellDefaultOffsetY(c, name);
      delete c.customParts;
      delete c.customName;
      delete c.customFootprint;
      delete c.footprint;
      delete c.renderFootprint;
      let stamp = null;
      try { stamp = normalizeVoxelBuildStamp({ name, customParts: parts, custom: true, footprint }, 'Custom Object'); } catch (_) {}
      if (!stamp) continue;
      if (typeof VOXEL_BUILD_STAMPS !== 'undefined' && typeof getVoxelBuildStamp === 'function' && !getVoxelBuildStamp(stamp.id)) {
        VOXEL_BUILD_STAMPS.push(stamp);
      }
      c.kind = 'voxel-build';
      c.floors = 1;
      c.buildingType = null;
      c.fenceSide = null;
      const ap = (c.appearance && typeof c.appearance === 'object') ? Object.assign({}, c.appearance) : {};
      ap.voxelBuildId = stamp.id;
      c.appearance = ap;
      applyCustomPartCellDefaultTransform(c, offsetY);
    }
    if (typeof saveCustomVoxelBuildStamps === 'function') { try { saveCustomVoxelBuildStamps(); } catch (_) {} }
  }

  // Saved worlds/builds carry the definitions of any CUSTOM voxel-build stamps
  // they reference (see referencedVoxelBuildStamps below) so a world opened on
  // another browser/device isn't left with unresolved voxelBuildId references.
  // Register any we don't already have, then persist them locally.
  function registerEmbeddedVoxelBuildStamps(data) {
    const list = data && data.voxelBuildStamps;
    if (!Array.isArray(list) || !list.length) return;
    if (typeof normalizeVoxelBuildStamp !== 'function' || typeof VOXEL_BUILD_STAMPS === 'undefined') return;
    let added = 0;
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      if (item.id && getVoxelBuildStamp(item.id)) continue;
      let stamp = null;
      try { stamp = normalizeVoxelBuildStamp(Object.assign({}, item, { custom: true }), item.name); } catch (_) {}
      if (stamp && !getVoxelBuildStamp(stamp.id)) { VOXEL_BUILD_STAMPS.push(stamp); added++; }
    }
    if (added && typeof saveCustomVoxelBuildStamps === 'function') { try { saveCustomVoxelBuildStamps(); } catch (_) {} }
  }

  // Collect the CUSTOM voxel-build stamp definitions referenced by a serialized
  // cell list, so they can be embedded in the saved world. Built-in stamps are
  // omitted (they resolve from code). Returns undefined when there are none, so
  // the field is simply absent for worlds without custom builds.
  function referencedVoxelBuildStamps(cells) {
    if (typeof getVoxelBuildStamp !== 'function' || !Array.isArray(cells)) return undefined;
    const ids = new Set();
    for (const entry of cells) {
      let ap = null;
      if (Array.isArray(entry)) {
        // appearance is the lone plain-object tuple member carrying voxelBuildId
        ap = entry.find(e => e && typeof e === 'object' && !Array.isArray(e) && (e.voxelBuildId || e.voxelBuild));
      } else if (entry && typeof entry === 'object') {
        ap = entry.appearance;
      }
      const id = ap && (ap.voxelBuildId || ap.voxelBuild);
      if (id) ids.add(id);
    }
    if (!ids.size) return undefined;
    const out = [];
    ids.forEach(id => {
      const s = getVoxelBuildStamp(id);
      if (s && s.custom) out.push({ id: s.id, name: s.name, voxels: s.voxels, customParts: s.customParts, footprint: s.footprint });
    });
    return out.length ? out : undefined;
  }
  // Cross-module access (server-build + named-slot saves live in module 30).
  window.referencedVoxelBuildStamps = referencedVoxelBuildStamps;

  function applyState(data, opts = {}) {
    if (!data || !Array.isArray(data.cells)) return false;
    registerEmbeddedVoxelBuildStamps(data);
    materializeCustomPartCells(data);
    normalizeWorldCells(data);
    const err = validateWorld(data);
    if (err) {
      console.warn('[applyState] rejected world:', err, data);
      return false;
    }
    if (data.v !== 1 && data.v !== 2 && data.v !== 3 && data.v !== 4) return false;
    hasUserPanned = false;
    if (vehicleFleet.size) clearVehicleRuntime();
    // Planet land is OFF by default — strip any persisted planet-underlay
    // state on world load so users who previously enabled it come back to a
    // clean island. They can re-enable it via the Generate panel if wanted.
    const pendingPlanetLandscape = null;

    if (data.useLandscapeEngine) {
      disposePlanetLandscape();
      useLandscapeEngine = true;
      initLandscapeEngine(data.landscapeEngineSeed || '', data.landscapeEngineBiome || 'grassland');
    } else {
      useLandscapeEngine = false;
      landscapeEngineInstance = null;
      disposeLandscapeMesh();
    }

    // Defer landscape mesh init — we need cells painted first so
    // rebuildTerrainRender can hide them.
    if (PLANET_LANDSCAPE_BIOMES.has(data.landscapeMeshBiome)) landscapeMeshBiome = data.landscapeMeshBiome;
    if (data.landscapeMeshStyle) landscapeMeshStyle = normalizePlanetLandscapeStyle(data.landscapeMeshStyle, landscapeMeshStyle);
    const shouldRestoreLandscapeMesh = !!(data.landscapeMeshMode && landscapeEngineInstance);
    if (!shouldRestoreLandscapeMesh) {
      disposeLandscapeMesh();
    }

    // Restore the saved home grid size before painting cells so the new
    // tiles are framed correctly and ghost boards land in the right
    // position. Falls back to the current GRID if the save predates the
    // gridSize field.
    const restoredGridSize = coerceGridSize(data.gridSize, GRID);
    if (restoredGridSize !== GRID) {
      // The cell loop below repaints every tile, so skip the rebuild
      // step inside setHomeGridSize and just dispose old meshes.
      setHomeGridSize(restoredGridSize, { skipRebuild: true });
    }
    if (pendingPlanetLandscape) {
      initPlanetLandscape(pendingPlanetLandscape);
    } else {
      disposePlanetLandscape();
    }
    suppressSave = true;
    clearMooringCables();
    clearEditableIslands();
    if (Array.isArray(data.islands)) {
      for (const spec of data.islands) {
        if (!spec || !Number.isInteger(spec.boardX) || !Number.isInteger(spec.boardZ)) continue;
        createEditableIsland({
          id: typeof spec.id === 'string' ? spec.id : undefined,
          boardX: spec.boardX,
          boardZ: spec.boardZ,
          positionX: +spec.positionX || 0,
          positionY: +spec.positionY || 0,
          positionZ: +spec.positionZ || 0,
          rotationY: +spec.rotationY || 0,
          engines: Array.isArray(spec.engines) ? spec.engines : null,
          skipSave: true,
        });
      }
    }
    replaceMooringCables(data.moorings || []);
    const overrides = new Map();
    for (const entry of data.cells) {
      // Accept either tuple form [x,z,terrain,kind,floors,buildingType,terrainFloors,fenceSide]
      // (storage / export) or object form {x,z,terrain,kind,floors,buildingType,terrainFloors,fenceSide}
      // (canonical schema, AI generation output).
      let x, z, terrain, kind, floors, buildingType, terrainFloors, fenceSide, extras, transform, appearance, waterFlow;
      if (Array.isArray(entry)) {
        if (entry.length < 4) continue;
        [x, z, terrain, kind, floors, buildingType, terrainFloors, fenceSide, extras, transform, appearance, waterFlow] = entry;
      } else if (entry && typeof entry === 'object') {
        ({ x, z, terrain, kind, floors, buildingType, terrainFloors, fenceSide, extras, transform, appearance, waterFlow } = entry);
      } else {
        continue;
      }
      if (typeof x !== 'number' || typeof z !== 'number') continue;
      const normalizedKind = kind === 'blank-island' ? null : (kind || null);
      const normalizedFloors = floors || 1;
      let normalizedTerrainFloors = terrainFloors || (data.v === 3 ? 1 : (normalizedKind ? 1 : normalizedFloors));
      // Houses-on-stilts guard: any built / man-made / planted kind that
      // doesn't naturally sit on raised stone gets clamped to flat
      // ground.  Rock is the only kind permitted to ride elevation (it
      // reads as a mountain outcrop, not a table-top).  This catches both
      // AI-generated worlds (where the LLM sometimes emits
      // {kind:'house', terrainFloors:5}) and stale imports from the
      // earlier procedural generator that didn't enforce the rule.
      const FLAT_REQUIRED = new Set([
        'house','fence','bridge','tree','tuft','flower','bush','cow','sheep',
        'crop','corn','wheat','pumpkin','carrot','sunflower','lamp-post','spotlight',
        'chimney','shrub','stone','pebble','bridge-rail','voxel-build','model-stamp',
      ]);
      if (normalizedKind === 'house' && (terrain === 'water' || terrain === 'path' || terrain === 'lava')) {
        terrain = 'grass';
      }
      if (!useLandscapeEngine && normalizedKind && FLAT_REQUIRED.has(normalizedKind) && normalizedTerrainFloors > 1) {
        normalizedTerrainFloors = 1;
      }
      // Paths and farmland (dirt under crops) are also intrinsically flat.
      const flatTerrain = (terrain === 'path' || terrain === 'dirt');
      if (!useLandscapeEngine && flatTerrain && normalizedTerrainFloors > 1) {
        normalizedTerrainFloors = 1;
      }
      const normalizedExtras = Array.isArray(extras)
        ? extras.map(e => ({
            kind: e.kind || e.k || null,
            fenceSide: (e.fenceSide || e.s) ? normalizeFenceSide(e.fenceSide || e.s) : null,
            floors: e.floors || e.f || 1,
            appearance: normalizeAppearance(e.appearance || e.a),
          })).filter(e => e.kind === 'fence' || e.kind === 'tuft')
        : [];
      let rotationY = 0, offsetX = 0, offsetY = 0, offsetZ = 0;
      if (Array.isArray(transform) && transform.length >= 3) {
        rotationY = +transform[0] || 0;
        offsetX   = +transform[1] || 0;
        offsetZ   = +transform[2] || 0;
        offsetY   = +transform[3] || 0;
      } else if (transform && typeof transform === 'object') {
        rotationY = +transform.rotationY || 0;
        offsetX   = +transform.offsetX   || 0;
        offsetZ   = +transform.offsetZ   || 0;
        offsetY   = +transform.offsetY   || 0;
      }
      overrides.set(x + ',' + z, {
        terrain: terrain || 'grass',
        terrainFloors: normalizedTerrainFloors,
        kind: normalizedKind,
        floors: normalizedFloors,
        buildingType: buildingType || null,
        fenceSide: normalizedKind === 'fence' ? normalizeFenceSide(fenceSide) : null,
        extras: normalizedExtras,
        rotationY, offsetX, offsetY, offsetZ,
        appearance: normalizeAppearance(appearance),
        waterFlow: normalizeWaterFlow(waterFlow),
        __outOfHome: x < 0 || x >= GRID || z < 0 || z >= GRID,
        __x: x,
        __z: z,
      });
    }

    if (useWindowedHomeRendering()) {
      resetHomeWorldIntent();
      disposeAllCellMeshes();
      for (const o of overrides.values()) {
        writeWorldIntentCell(o.__x, o.__z, o, !!o.__outOfHome);
      }
      for (const o of overrides.values()) {
        if (!isEditableIslandCell(o.__x, o.__z)) continue;
        setCell(o.__x, o.__z, {
          terrain: o.terrain,
          terrainFloors: o.terrainFloors,
          kind: o.kind,
          floors: o.floors,
          buildingType: o.buildingType,
          fenceSide: o.fenceSide,
          extras: o.extras,
          rotationY: o.rotationY,
          offsetX: o.offsetX,
          offsetY: o.offsetY,
          offsetZ: o.offsetZ,
          appearance: o.appearance,
          userEdited: true,
          animate: false,
          forceTile: true,
          impactDust: false,
        });
      }
      // Bulk direct writes bypassed setCell — rebuild the live indices.
      rebuildCropPositions();
      rebuildMaxPumpkinCache();
      invalidateHomeFade();
      suppressSave = false;
      if (!opts.keepCamera) {
        const okCameraMode = new Set(['ortho','topdown','perspective','fp']);
        if (data.cameraMode && okCameraMode.has(data.cameraMode)) setCameraMode(data.cameraMode);
        else resetCameraDefaults();
      }
      requestHomeRenderWindowSync({ force: true });
      if (opts.skipGhostBoards) {
        renderVisibleDistance = 0;
        syncGhostRenderBudget();
        if (typeof clearGhostWorld === 'function') clearGhostWorld();
      } else if (typeof ensureGhostBoardsAroundTarget === 'function') ensureGhostBoardsAroundTarget();
      if (data.toolId) {
        const tool = TOOLS.find(t => t.id === data.toolId);
        if (tool) selectTool(tool);
      }
      if (shouldRestoreLandscapeMesh) {
        initLandscapeMesh();
        rebuildTerrainRender();
        rebuildObjectsRender();
      } else if (useLandscapeEngine && landscapeMeshStyle === 'realistic' && landscapeEngineInstance && typeof applyRealisticVoxelLandscape === 'function') {
        // Tiles are already painted; the voxel overlay just hides them.
        applyRealisticVoxelLandscape();
      }
      saveState();
      if (typeof opts.onDone === 'function') {
        try { opts.onDone(); } catch (_) {}
      }
      return true;
    }

    const TILE_STAGGER = opts.sliced ? 0.010 : 0.018;
    // Progressive build: process chunks through rAF so large grids stay
    // responsive. In sliced mode the first pass lays terrain only, then
    // the second pass drops objects/extras. Both passes are distance
    // ranked from the current camera target so nearby/central content
    // appears first instead of filling row-by-row.
    const cells = [];
    for (let x = 0; x < GRID; x++) for (let z = 0; z < GRID; z++) cells.push([x, z]);
    const renderOrigin = opts.renderOrigin || { x: target.x, z: target.z };
    const originX = Number.isFinite(renderOrigin.x) ? renderOrigin.x : (GRID - 1) / 2;
    const originZ = Number.isFinite(renderOrigin.z) ? renderOrigin.z : (GRID - 1) / 2;
    const rankedCells = cells.slice().sort((a, b) => {
      const ax = a[0] + 0.5 - originX;
      const az = a[1] + 0.5 - originZ;
      const bx = b[0] + 0.5 - originX;
      const bz = b[1] + 0.5 - originZ;
      const ad = ax * ax + az * az;
      const bd = bx * bx + bz * bz;
      return ad === bd ? (a[1] - b[1]) || (a[0] - b[0]) : ad - bd;
    });

    const buildItems = [];
    if (opts.sliced) {
      for (const [x, z] of rankedCells) buildItems.push({ x, z, phase: 'base' });
      for (const [x, z] of rankedCells) {
        const o = overrides.get(x + ',' + z);
        if (o && (o.kind || (o.extras && o.extras.length))) buildItems.push({ x, z, phase: 'detail' });
      }
    } else {
      for (const [x, z] of rankedCells) buildItems.push({ x, z, phase: 'full' });
    }

    const CHUNK = opts.sliced
      ? Math.max(8, Math.min(256, Math.floor(Math.max(1, GRID * GRID) / 24)))
      : Math.max(32, Math.min(384, Math.floor(Math.max(1, GRID * GRID) / 8)));
    function paintBuildItem(item, itemIndex) {
      const x = item.x, z = item.z;
      const o = overrides.get(x + ',' + z);
      const base = {
        terrain: o ? o.terrain : 'grass',
        terrainFloors: o ? o.terrainFloors : 1,
        tileDelay: (itemIndex % CHUNK) * TILE_STAGGER,
        objectDelay: (itemIndex % CHUNK) * TILE_STAGGER + 0.04,
        impactDust: false,
      };
      if (item.phase === 'base') {
        setCell(x, z, {
          ...base,
          kind: null,
          floors: 1,
          buildingType: null,
          fenceSide: null,
          extras: [],
          rotationY: 0,
          offsetX: 0,
          offsetZ: 0,
          animate: false,
          forceTile: true,
        });
        return;
      }
      if (item.phase === 'full') {
        setCell(x, z, {
          ...base,
          kind: null,
          floors: 1,
          buildingType: null,
          fenceSide: null,
          extras: [],
          rotationY: 0,
          offsetX: 0,
          offsetZ: 0,
          animate: false,
          forceTile: true,
        });
      }
      setCell(x, z, {
        ...base,
        kind: o ? o.kind : null,
        floors: o ? o.floors : 1,
        buildingType: o ? o.buildingType : null,
        fenceSide: o ? o.fenceSide : null,
        extras: o ? o.extras : [],
        rotationY: o ? o.rotationY : 0,
        offsetX: o ? o.offsetX : 0,
        offsetZ: o ? o.offsetZ : 0,
        appearance: o ? o.appearance : null,
        animate: item.phase !== 'full' || !!(o && (o.kind || (o.extras && o.extras.length))),
        forceTile: item.phase !== 'detail' && item.phase !== 'full',
      });
      if (item.phase === 'full' && o && !o.kind && o.extras && o.extras.length) {
        renderCellExtras(x, z, { animateFrom: 0 });
      }
    }

    function finishApplyState() {
      // Final pass: settle only adjacency-aware terrain. Rebuilding every
      // default grass tile doubles generation cost even though most cells
      // cannot gain path trims, shore lips, or bridge re-orientation.
      const settle = new Set();
      function markSettle(x, z) {
        if (x < 0 || x >= GRID || z < 0 || z >= GRID) return;
        settle.add(x + ',' + z);
      }
      for (let x = 0; x < GRID; x++) {
        for (let z = 0; z < GRID; z++) {
          const c = world[x][z];
          if (!c) continue;
          if (c.terrain === 'path' || c.terrain === 'water' || c.kind === 'bridge') {
            markSettle(x, z);
            markSettle(x + 1, z);
            markSettle(x - 1, z);
            markSettle(x, z + 1);
            markSettle(x, z - 1);
          }
        }
      }
      for (const key of settle) {
        const [x, z] = key.split(',').map(Number);
        renderCellTile(x, z, { animate: false });
        const c = world[x] && world[x][z];
        if (c && c.kind === 'bridge') renderCellObject(x, z, { animate: false });
      }

      // Replay out-of-home overrides — ghost board cells the user has
      // built / erased / modified. setCell handles any global coord via
      // tilePos, so the home cellMesh path renders them on top of (and in
      // place of) the regenerated ghost board.
      for (const o of overrides.values()) {
        if (!o.__outOfHome) continue;
        const x = o.__x, z = o.__z;
        if (!world[x]) world[x] = [];
        setCell(x, z, {
          terrain: o.terrain,
          terrainFloors: o.terrainFloors,
          kind: o.kind,
          floors: o.floors,
          buildingType: o.buildingType,
          fenceSide: o.fenceSide,
          extras: o.extras,
          rotationY: o.rotationY,
          offsetX: o.offsetX,
          offsetZ: o.offsetZ,
          appearance: o.appearance,
          userEdited: true,
          animate: false,
          forceTile: true,
        });
        // Re-tag as user-edited so future ghost board builds know to skip.
        if (world[x] && world[x][z]) world[x][z].userEdited = true;
      }

      suppressSave = false;
      if (!opts.keepCamera) {
        const okCameraMode = new Set(['ortho','topdown','perspective','fp']);
        if (data.cameraMode && okCameraMode.has(data.cameraMode)) setCameraMode(data.cameraMode);
        else resetCameraDefaults();
      }
      if (opts.skipGhostBoards) {
        renderVisibleDistance = 0;
        syncGhostRenderBudget();
        if (typeof clearGhostWorld === 'function') clearGhostWorld();
      } else if (typeof ensureGhostBoardsAroundTarget === 'function') ensureGhostBoardsAroundTarget();
      if (data.toolId) {
        const tool = TOOLS.find(t => t.id === data.toolId);
        if (tool) selectTool(tool);
      }
      // Restore landscape mesh mode after all tiles are painted
      if (shouldRestoreLandscapeMesh) {
        initLandscapeMesh();
        rebuildTerrainRender();
        rebuildObjectsRender();
      } else if (useLandscapeEngine && landscapeMeshStyle === 'realistic' && landscapeEngineInstance && typeof applyRealisticVoxelLandscape === 'function') {
        // Tiles are already painted; the voxel overlay just hides them.
        applyRealisticVoxelLandscape();
      }
      saveState();
      if (typeof syncControls === 'function') syncControls();
      if (typeof opts.onDone === 'function') {
        try { opts.onDone(); } catch (_) {}
      }
    }

    function buildOneChunk(start) {
      const end = Math.min(buildItems.length, start + CHUNK);
      for (let i = start; i < end; i++) {
        paintBuildItem(buildItems[i], i);
      }
      if (typeof opts.onProgress === 'function') {
        const last = buildItems[Math.max(0, end - 1)];
        try { opts.onProgress({ done: end, total: buildItems.length, phase: last && last.phase }); } catch (_) {}
      }
      if (end < buildItems.length) {
        // Yield to the event loop so animations + input keep firing.
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => buildOneChunk(end));
        } else {
          setTimeout(() => buildOneChunk(end), 0);
        }
      } else {
        finishApplyState();
      }
    }

    buildOneChunk(0);
    return true;
  }

  function cellPatchFromEntry(entry) {
    let x, z, terrain, kind, floors, buildingType, terrainFloors, fenceSide, extras, transform, appearance, waterFlow;
    if (Array.isArray(entry)) {
      [x, z, terrain, kind, floors, buildingType, terrainFloors, fenceSide, extras, transform, appearance, waterFlow] = entry;
    } else if (entry && typeof entry === 'object') {
      ({ x, z, terrain, kind, floors, buildingType, terrainFloors, fenceSide, extras, transform, appearance, waterFlow } = entry);
    }
    if (!Number.isInteger(x) || !Number.isInteger(z)) return null;
    if (x < 0 || x >= GRID || z < 0 || z >= GRID) return null;
    let rotationY = 0, offsetX = 0, offsetY = 0, offsetZ = 0;
    if (Array.isArray(transform) && transform.length >= 3) {
      rotationY = +transform[0] || 0;
      offsetX   = +transform[1] || 0;
      offsetZ   = +transform[2] || 0;
      offsetY   = +transform[3] || 0;
    } else if (transform && typeof transform === 'object') {
      rotationY = +transform.rotationY || 0;
      offsetX   = +transform.offsetX   || 0;
      offsetZ   = +transform.offsetZ   || 0;
      offsetY   = +transform.offsetY   || 0;
    }
    return {
      x, z,
      terrain: terrain || 'grass',
      terrainFloors: terrainFloors || 1,
      kind: kind || null,
      floors: floors || 1,
      buildingType: buildingType || null,
      fenceSide: kind === 'fence' ? normalizeFenceSide(fenceSide) : null,
      extras: Array.isArray(extras) ? extras.map(e => Object.assign({}, e, {
        appearance: normalizeAppearance(e && (e.appearance || e.a)),
      })) : [],
      rotationY, offsetX, offsetY, offsetZ,
      appearance: normalizeAppearance(appearance),
      waterFlow: normalizeWaterFlow(waterFlow),
    };
  }

  function applyStatePatch(data) {
    if (!data || !Array.isArray(data.cells)) return false;
    materializeCustomPartCells(data);
    normalizeWorldCells(data);
    const err = validateWorld(data);
    if (err) {
      console.warn('[applyStatePatch] rejected world patch:', err, data);
      return false;
    }
    let applied = 0;
    suppressSave = true;
    try {
      for (const entry of data.cells) {
        const c = cellPatchFromEntry(entry);
        if (!c) continue;
        setCell(c.x, c.z, {
          terrain: c.terrain,
          terrainFloors: c.terrainFloors,
          kind: c.kind,
          floors: c.floors,
          buildingType: c.buildingType,
          fenceSide: c.fenceSide,
          extras: c.extras,
          rotationY: c.rotationY,
          offsetX: c.offsetX,
          offsetZ: c.offsetZ,
          appearance: c.appearance,
          waterFlow: c.waterFlow,
          animate: true,
          impactDust: false,
        });
        applied++;
      }
    } finally {
      suppressSave = false;
    }
    saveState();
    return applied > 0;
  }

  // -------- API / webhooks / SSE bridge --------
  // Stored in localStorage so anon and logged-in users both have a place
  // to keep their config. Keys are generated client-side as v4-ish UUIDs.
  const API_LS = 'tinyworld:api:v1';
  const apiConfig = (function loadApiConfig() {
    try {
      const raw = localStorage.getItem(API_LS);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          keys: Array.isArray(parsed.keys) ? parsed.keys : [],
          webhookUrl: parsed.webhookUrl || '',
          sseUrl: parsed.sseUrl || '',
        };
      }
    } catch (_) {}
    return { keys: [], webhookUrl: '', sseUrl: '' };
  })();

  function persistApiConfig() {
    try { localStorage.setItem(API_LS, JSON.stringify(apiConfig)); } catch (_) {}
  }

  function generateApiKey() {
    // RFC4122 v4-ish UUID using crypto where available.
    const bytes = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return 'twb_' + hex.slice(0, 8) + '_' + hex.slice(8, 16) + hex.slice(16, 24) + hex.slice(24);
  }

  function pickPrimaryToken() {
    return apiConfig.keys.length ? apiConfig.keys[0].secret : '';
  }

  // ---- outbound webhooks ----
  // Coalesce bursts of mutations so a clear-board doesn't fire 64 webhooks.
  let webhookQueue = [];
  let webhookFlushTimer = null;
  function fireWebhook(event, payload) {
    if (!apiConfig.webhookUrl) return;
    webhookQueue.push({ event, payload, at: Date.now() });
    clearTimeout(webhookFlushTimer);
    webhookFlushTimer = setTimeout(flushWebhookQueue, 120);
  }
  function flushWebhookQueue() {
    if (!apiConfig.webhookUrl || !webhookQueue.length) return;
    const events = webhookQueue.splice(0, webhookQueue.length);
    const token = pickPrimaryToken();
    fetch(apiConfig.webhookUrl, {
      method: 'POST',
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        token ? { Authorization: 'Bearer ' + token } : {}
      ),
      body: JSON.stringify({ source: 'tiny-world-builder', events }),
      mode: 'cors',
      keepalive: true,
    }).catch(err => {
      // Fail silently — webhook downtime shouldn't kill the editor.
      // Log so devs can find it in the console.
      console.warn('[webhook]', err);
    });
  }

  // ---- inbound SSE relay ----
  let sseSource = null;
  function connectSseRelay() {
    if (sseSource) { try { sseSource.close(); } catch (_) {} sseSource = null; }
    const url = apiConfig.sseUrl;
    if (!url) return;
    // EventSource doesn't allow custom headers — append token as a query
    // param if there's room for one. The relay should accept either.
    const token = pickPrimaryToken();
    let target = url;
    if (token) {
      const sep = url.indexOf('?') >= 0 ? '&' : '?';
      target = url + sep + 'token=' + encodeURIComponent(token);
    }
    try {
      sseSource = new EventSource(target);
    } catch (err) {
      console.warn('[sse] failed to connect', err);
      return;
    }
    sseSource.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        applyRemoteCommand(msg);
      } catch (err) {
        console.warn('[sse] bad message', err, e.data);
      }
    };
    sseSource.onerror = (err) => {
      // Browser auto-reconnects; nothing to do.
      console.warn('[sse] error', err);
    };
  }

  function applyRemoteCommand(msg) {
    if (!msg || typeof msg !== 'object') return;
    const op = normalizeVehicleAction(msg.op || msg.event);
    if (!op) return;

    if (op.startsWith('vehicle')) {
      handleVehicleRemoteCommand(msg);
      return;
    }

    if (op === 'place' || op === 'set_cell') {
      const { x, z, terrain, kind, floors, buildingType, fenceSide, rotationY, offsetX, offsetZ } = msg;
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      if (x < 0 || x >= GRID || z < 0 || z >= GRID) return;
      const cell = getWorldCell(x, z);
      setCell(x, z, {
        terrain: terrain || cell.terrain || 'grass',
        terrainFloors: terrainLevelForCell(cell),
        kind: kind || null,
        floors: floors || 1,
        buildingType: buildingType || null,
        fenceSide: fenceSide || null,
        rotationY: rotationY || 0,
        offsetX: offsetX || 0,
        offsetZ: offsetZ || 0,
      });
    } else if (op === 'clear') {
      doClear();
    } else if (op === 'reset') {
      doReset();
    }
  }

  // ---- panel hooks ----
  function renderApiPanel() {
    const list = document.getElementById('api-keys-list');
    const urlField = document.getElementById('api-webhook-url');
    const sseField = document.getElementById('api-sse-url');
    if (!list || !urlField || !sseField) return;
    list.innerHTML = '';
    if (!apiConfig.keys.length) {
      const li = document.createElement('li');
      li.className = 'save-empty';
      li.style.justifyContent = 'center';
      li.textContent = 'No keys yet. Generate one to get started.';
      list.appendChild(li);
    } else {
      for (const k of apiConfig.keys) {
        const li = document.createElement('li');
        const left = document.createElement('div');
        const lbl = document.createElement('div');
        lbl.className = 'api-key-label';
        lbl.textContent = k.label || 'Untitled key';
        const meta = document.createElement('div');
        meta.className = 'api-key-meta';
        meta.textContent = 'twb_…' + k.secret.slice(-8) + ' · ' + new Date(k.created).toLocaleDateString();
        left.appendChild(lbl);
        left.appendChild(meta);
        const actions = document.createElement('div');
        actions.className = 'api-key-actions';
        const del = document.createElement('button');
        del.textContent = 'Revoke';
        del.title = 'Delete this key';
        del.addEventListener('click', () => {
          apiConfig.keys = apiConfig.keys.filter(x => x.id !== k.id);
          persistApiConfig();
          renderApiPanel();
        });
        actions.appendChild(del);
        li.appendChild(left);
        li.appendChild(actions);
        list.appendChild(li);
      }
    }
    urlField.value = apiConfig.webhookUrl || '';
    sseField.value = apiConfig.sseUrl || '';
  }

  function initApiPanel() {
    const genBtn = document.getElementById('api-key-generate');
    const labelInput = document.getElementById('api-key-label');
    const reveal = document.getElementById('api-key-reveal');
    const saveBtn = document.getElementById('api-save');
    const urlField = document.getElementById('api-webhook-url');
    const sseField = document.getElementById('api-sse-url');
    const status = document.getElementById('api-status');
    if (!genBtn || !saveBtn) return;
    genBtn.addEventListener('click', () => {
      const secret = generateApiKey();
      const entry = {
        id: Math.random().toString(36).slice(2, 10),
        label: (labelInput.value || '').trim() || 'API key',
        secret,
        created: Date.now(),
      };
      apiConfig.keys.unshift(entry);
      persistApiConfig();
      labelInput.value = '';
      reveal.hidden = false;
      reveal.innerHTML = '';
      const head = document.createElement('strong');
      head.textContent = 'Copy this token now — it won’t be shown in full again.';
      const body = document.createElement('div');
      body.textContent = secret;
      reveal.appendChild(head);
      reveal.appendChild(body);
      renderApiPanel();
    });
    saveBtn.addEventListener('click', () => {
      apiConfig.webhookUrl = (urlField.value || '').trim();
      apiConfig.sseUrl     = (sseField.value || '').trim();
      persistApiConfig();
      status.textContent = 'Saved.';
      status.className = 'success';
      setTimeout(() => { status.textContent = ''; status.className = ''; }, 1800);
      connectSseRelay();
    });
  }

  // Wire the API tab to its UI initialiser; expose renderApiPanel for the
  // tab switcher.
  window.__initApiPanel = initApiPanel;
  window.__renderApiPanel = renderApiPanel;
  // Connect the SSE relay (if configured) at startup so remote commands
  // can drive even an unattended browser.
  setTimeout(connectSseRelay, 0);

  // Raw ?world= value (query string, falling back to hash). Lifted from fork
  // yuxiaoli (60d6e89/b8c3364) and reshaped for our async-safe boot.
  function getWorldUrlParam() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      const shareId = params.get('share');
      if (shareId && /^[a-zA-Z0-9_-]{8,40}$/.test(shareId)) {
        return '/api/share?id=' + encodeURIComponent(shareId);
      }
      let world = params.get('world');
      if (!world) {
        const hash = String(window.location.hash || '').replace(/^#\??/, '');
        if (hash && hash.includes('=')) {
          const hashParams = new URLSearchParams(hash);
          const hashShareId = hashParams.get('share');
          if (hashShareId && /^[a-zA-Z0-9_-]{8,40}$/.test(hashShareId)) {
            return '/api/share?id=' + encodeURIComponent(hashShareId);
          }
          world = hashParams.get('world');
        }
      }
      return world;
    } catch (_) { return null; }
  }

  // True when ?world= holds inline JSON rather than a URL to fetch.
  function isInlineWorldParam(raw) {
    return typeof raw === 'string' && /^\s*[\[{]/.test(raw);
  }

  // Restrict remote ?world= fetches to same-origin so an attacker can't use the
  // param to pull (or, with credentials, exfiltrate to) an arbitrary host.
  // Relative paths like ?world=data/snowy.json are the intended use case.
  function sanitizeWorldUrl(raw) {
    if (!raw || isInlineWorldParam(raw)) return null;
    try {
      const u = new URL(raw, window.location.href);
      if (u.origin !== window.location.origin) { console.warn('Ignoring cross-origin ?world= URL:', raw); return null; }
      return u.href;
    } catch (_) { return null; }
  }

  // Async remote load for ?world=<same-origin-url>. Returns Promise<boolean>.
  // Boot shows a placeholder scene first, so this only needs to report success.
  async function loadWorldFromUrl(rawUrl) {
    const safe = sanitizeWorldUrl(rawUrl);
    if (!safe) return false;
    try {
      const r = await fetch(safe, { credentials: 'omit' });
      if (!r.ok) return false;
      const json = await r.json();
      const ok = applyState(json, { keepCamera: false });
      if (ok) resetCameraDefaults();
      return ok;
    } catch (err) {
      console.error('Failed to load world from URL:', err);
      return false;
    }
  }

  // Apply the bundled default island (default_island.json, cached on window by
  // the HTML bootstrap). Used for a fresh session + Reset. Returns false if the
  // file was missing/invalid so callers fall back to loadInitialScene().
  function applyDefaultIslandState(opts) {
    const d = window.__tinyworldDefaultIsland;
    if (!d || !Array.isArray(d.cells)) return false;
    return applyState(d, opts || { keepCamera: false });
  }

  function loadState() {
    let data;
    try {
      // ?world={...} inline JSON loads synchronously here; remote ?world=<url>
      // is handled asynchronously by loadWorldFromUrl() in the boot path.
      const worldParam = getWorldUrlParam();
      if (isInlineWorldParam(worldParam)) {
        data = JSON.parse(worldParam);
      } else {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        data = JSON.parse(raw);
      }
    } catch (_) { return false; }
    const ok = applyState(data, { keepCamera: true });
    if (ok) resetCameraDefaults();
    return ok;
  }
