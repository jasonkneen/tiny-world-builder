(function () {
  'use strict';

  const VIEWER_GRID_SIZE = 8;
  const GRAPHICS_DEFAULTS_VERSION = 2;
  const DEFAULT_GRAPHICS = {
    viewerEffectsVersion: GRAPHICS_DEFAULTS_VERSION,
    resolution: 0.85,
    shadow: 'balanced',
    lighting: 0.92,
    directionalSun: 10,
    directionalSunAngle: 37,
    timeCycle: 'fixed',
    timeOfDay: 720,
    ambientFill: 0.92,
    clouds: 0.34,
    cloudHeight: 10.5,
    enhancedWater: false,
    cloudSea: false,
    distantWorlds: false,
  };

  window.__tinyworldStandaloneIslandViewer = true;

  function clone(value) {
    return JSON.parse(JSON.stringify(value || null));
  }

  function clampNumber(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function normalizeTerrain(value) {
    if (value === 'sand') return 'grass';
    return ['grass', 'path', 'dirt', 'water', 'stone', 'lava', 'snow'].includes(value) ? value : 'grass';
  }

  function normalizeGraphics(value) {
    const raw = value || {};
    const source = Object.assign({}, DEFAULT_GRAPHICS, raw);
    const stableEffects = raw.viewerEffectsVersion === GRAPHICS_DEFAULTS_VERSION;
    const rawSun = Object.prototype.hasOwnProperty.call(raw, 'directionalSun')
      ? Number(raw.directionalSun)
      : NaN;
    if (Number.isFinite(rawSun) && Math.abs(rawSun - 1.1) < 0.0001) {
      source.directionalSun = DEFAULT_GRAPHICS.directionalSun;
    }
    return {
      viewerEffectsVersion: GRAPHICS_DEFAULTS_VERSION,
      resolution: clampNumber(source.resolution, DEFAULT_GRAPHICS.resolution, 0.5, 1.25),
      shadow: ['low', 'balanced', 'high'].includes(source.shadow) ? source.shadow : DEFAULT_GRAPHICS.shadow,
      lighting: clampNumber(source.lighting, DEFAULT_GRAPHICS.lighting, 0.5, 5),
      directionalSun: clampNumber(source.directionalSun, DEFAULT_GRAPHICS.directionalSun, 0, 10),
      directionalSunAngle: Math.round(clampNumber(source.directionalSunAngle, DEFAULT_GRAPHICS.directionalSunAngle, 0, 359)),
      timeCycle: ['live', 'fixed'].includes(source.timeCycle) ? source.timeCycle : DEFAULT_GRAPHICS.timeCycle,
      timeOfDay: Math.round(clampNumber(source.timeOfDay, DEFAULT_GRAPHICS.timeOfDay, 0, 1439)),
      ambientFill: clampNumber(source.ambientFill, DEFAULT_GRAPHICS.ambientFill, 0, 5),
      clouds: clampNumber(source.clouds, DEFAULT_GRAPHICS.clouds, 0, 1),
      cloudHeight: clampNumber(source.cloudHeight, DEFAULT_GRAPHICS.cloudHeight, 9, 16),
      enhancedWater: stableEffects && source.enhancedWater === true,
      cloudSea: stableEffects && source.cloudSea === true,
      distantWorlds: stableEffects && source.distantWorlds === true,
    };
  }

  function normalizeCell(raw, x, z) {
    const cell = Array.isArray(raw)
      ? {
        x: raw[0],
        z: raw[1],
        terrain: raw[2],
        kind: raw[3] === undefined ? null : raw[3],
        floors: raw[4],
        buildingType: raw[5],
        terrainFloors: raw[6],
        fenceSide: raw[7],
        extras: raw[8],
        transform: raw[9],
        appearance: raw[10],
      }
      : Object.assign({}, raw || {});
    let terrain = normalizeTerrain(cell.terrain);
    if (cell.path === true && terrain !== 'water') terrain = 'path';
    return {
      x: Number.isInteger(cell.x) ? cell.x : x,
      z: Number.isInteger(cell.z) ? cell.z : z,
      terrain,
      kind: cell.kind || null,
      floors: Math.max(1, Math.min(8, Math.round(Number(cell.floors) || 1))),
      terrainFloors: Math.max(1, Math.min(8, Math.round(Number(cell.terrainFloors) || 1))),
      buildingType: cell.buildingType || null,
      fenceSide: cell.fenceSide || null,
      extras: Array.isArray(cell.extras) ? cell.extras.filter(Boolean) : [],
      transform: cell.transform || null,
      appearance: cell.appearance || null,
    };
  }

  function normalizeWorld(input) {
    const source = input && input.type === 'tinyworld.islandViewerReveal' ? input.world
      : input && input.type === 'tinyworld.randomIslandReveal' ? input.world
        : input;
    if (!source || typeof source !== 'object' || !Array.isArray(source.cells)) {
      throw new Error('File is not a TinyWorld island reveal file or v:4 world JSON.');
    }
    const byCoord = new Map();
    for (const raw of source.cells) {
      const cell = normalizeCell(raw, 0, 0);
      if (cell.x < 0 || cell.x >= VIEWER_GRID_SIZE || cell.z < 0 || cell.z >= VIEWER_GRID_SIZE) continue;
      byCoord.set(cell.x + ',' + cell.z, cell);
    }
    const cells = [];
    for (let x = 0; x < VIEWER_GRID_SIZE; x++) {
      for (let z = 0; z < VIEWER_GRID_SIZE; z++) {
        cells.push(byCoord.get(x + ',' + z) || normalizeCell({ x, z, terrain: 'grass' }, x, z));
      }
    }
    return { v: 4, gridSize: VIEWER_GRID_SIZE, cells };
  }

  function setViewerGridSize() {
    if (typeof GRID !== 'undefined' && GRID !== VIEWER_GRID_SIZE) GRID = VIEWER_GRID_SIZE;
    if (typeof initCellMeshesGrid === 'function') initCellMeshesGrid();
  }

  function applyCell(cell, animate) {
    setCell(cell.x, cell.z, {
      terrain: cell.terrain,
      terrainFloors: cell.terrainFloors,
      kind: cell.kind,
      floors: cell.floors,
      buildingType: cell.buildingType,
      fenceSide: cell.fenceSide,
      extras: cell.extras,
      appearance: cell.appearance,
      rotationY: cell.transform && Number.isFinite(cell.transform.rotationY) ? cell.transform.rotationY : undefined,
      animate,
      impactDust: false,
      forceTile: false,
    });
  }

  function applyGraphics(settings, opts = {}) {
    const graphics = normalizeGraphics(settings);
    if (typeof setRenderResolutionScale === 'function') setRenderResolutionScale(graphics.resolution);
    if (typeof renderShadowQuality !== 'undefined') renderShadowQuality = graphics.shadow;
    if (typeof renderLighting !== 'undefined') renderLighting = graphics.lighting;
    if (typeof renderDirectionalSun !== 'undefined') renderDirectionalSun = graphics.directionalSun;
    if (typeof renderDirectionalSunAngle !== 'undefined') renderDirectionalSunAngle = graphics.directionalSunAngle;
    if (typeof renderAmbientFill !== 'undefined') renderAmbientFill = graphics.ambientFill;
    if (typeof renderCloudAmount !== 'undefined') renderCloudAmount = graphics.clouds;
    if (typeof renderCloudHeight !== 'undefined') renderCloudHeight = graphics.cloudHeight;
    if (typeof renderEnhancedWater !== 'undefined') renderEnhancedWater = !!graphics.enhancedWater;
    if (typeof renderCloudSea !== 'undefined') renderCloudSea = !!graphics.cloudSea;
    if (typeof renderDistantWorlds !== 'undefined') renderDistantWorlds = !!graphics.distantWorlds;
    if (typeof applyLightingSettings === 'function') applyLightingSettings();
    if (typeof applyCloudSettings === 'function') applyCloudSettings();
    if (typeof applyWaterMaterialSettings === 'function') applyWaterMaterialSettings();
    if (opts.render !== false && !window.__tinyworldIslandViewerLoading && typeof renderScene === 'function') renderScene();
    return graphics;
  }

  function mount(container, options) {
    const state = {
      world: { v: 4, gridSize: VIEWER_GRID_SIZE, cells: [] },
      profile: null,
      graphics: normalizeGraphics(options && options.graphics),
      raf: 0,
      disposed: false,
      loading: false,
    };

    function frame(now) {
      if (state.disposed) return;
      state.raf = requestAnimationFrame(frame);
      if (state.loading) return;
      const dt = 1 / 60;
      if (typeof tickDropAnims === 'function') tickDropAnims(dt);
      if (typeof tickRippleAnims === 'function') tickRippleAnims(dt);
      if (typeof updateClouds === 'function') updateClouds(dt);
      if (typeof tickWaterTextureFlow === 'function') tickWaterTextureFlow(dt);
      if (typeof updateWaterfallEffects === 'function') updateWaterfallEffects((now || performance.now()) / 1000);
      if (typeof updateAllBuildingWindowLights === 'function') updateAllBuildingWindowLights();
      if (typeof renderScene === 'function') renderScene();
    }

    function loadWorld(world, meta) {
      setViewerGridSize();
      const normalized = normalizeWorld(world);
      state.world = normalized;
      state.profile = meta && meta.profile || null;
      if (meta && meta.graphics) state.graphics = normalizeGraphics(meta.graphics);
      state.loading = true;
      window.__tinyworldIslandViewerLoading = true;
      try {
        for (const cell of normalized.cells) applyCell(cell, false);
        applyGraphics(state.graphics, { render: false });
        if (typeof target !== 'undefined' && target && target.set) target.set(0, 0, 0);
        if (typeof viewSize !== 'undefined') viewSize = 8.2;
        if (typeof cameraMode !== 'undefined') cameraMode = 'perspective';
        if (typeof updateCamera === 'function') updateCamera();
      } finally {
        state.loading = false;
        window.__tinyworldIslandViewerLoading = false;
      }
      if (typeof renderScene === 'function') renderScene();
      return exportWorld();
    }

    function exportWorld() {
      return clone(state.world);
    }

    function dispose() {
      state.disposed = true;
      if (state.raf) cancelAnimationFrame(state.raf);
    }

    applyGraphics(state.graphics);
    state.raf = requestAnimationFrame(frame);
    return {
      loadWorld,
      exportWorld,
      applyGraphics(nextGraphics) {
        state.graphics = applyGraphics(nextGraphics);
      },
      dispose,
      get profile() { return state.profile; },
    };
  }

  window.TinyWorldIslandRenderer = {
    mount,
    normalizeWorld,
    normalizeGraphics,
    defaults: {
      graphics: Object.assign({}, DEFAULT_GRAPHICS),
      gridSize: VIEWER_GRID_SIZE,
    },
  };
})();
