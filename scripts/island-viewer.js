(function () {
  'use strict';

  const GRAPHICS_LS = 'tinyworld:island-viewer:graphics.v1';
  const VIEWER_LS = 'tinyworld:island-viewer:defaults.v1';
  const GRAPHICS_SUN_MIGRATION_LS = 'tinyworld:island-viewer:directionalSunDefaultMigrated.v1';
  const ISLAND_VIEWER_GRID_SIZE = 8;
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
  const DEFAULT_VIEWER = {
    gridSize: ISLAND_VIEWER_GRID_SIZE,
    seed: '',
  };
  const state = {
    ready: false,
    current: null,
    renderer: null,
    graphics: loadGraphicsDefaults(),
    viewer: loadViewerDefaults(),
  };

  const el = {
    newButton: document.getElementById('iv-new'),
    saveReveal: document.getElementById('iv-save-reveal'),
    loadButton: document.getElementById('iv-load-button'),
    loadFile: document.getElementById('iv-load-file'),
    status: document.getElementById('iv-status'),
    viewport: document.getElementById('app'),
    devToggle: document.getElementById('iv-dev-toggle'),
    devPanel: document.getElementById('iv-dev-panel'),
    devClose: document.getElementById('iv-dev-close'),
    devForm: document.getElementById('iv-dev-form'),
    gridSize: document.getElementById('iv-grid-size'),
    seed: document.getElementById('iv-seed'),
    resolution: document.getElementById('iv-render-resolution'),
    resolutionValue: document.getElementById('iv-render-resolution-value'),
    shadow: document.getElementById('iv-shadow-quality'),
    lighting: document.getElementById('iv-lighting'),
    lightingValue: document.getElementById('iv-lighting-value'),
    sun: document.getElementById('iv-sun-strength'),
    sunValue: document.getElementById('iv-sun-strength-value'),
    sunAngle: document.getElementById('iv-sun-angle'),
    sunAngleValue: document.getElementById('iv-sun-angle-value'),
    timeCycle: document.getElementById('iv-time-cycle'),
    timeOfDay: document.getElementById('iv-time-of-day'),
    timeOfDayValue: document.getElementById('iv-time-of-day-value'),
    ambient: document.getElementById('iv-ambient-fill'),
    ambientValue: document.getElementById('iv-ambient-fill-value'),
    clouds: document.getElementById('iv-clouds'),
    cloudsValue: document.getElementById('iv-clouds-value'),
    cloudHeight: document.getElementById('iv-cloud-height'),
    cloudHeightValue: document.getElementById('iv-cloud-height-value'),
    enhancedWater: document.getElementById('iv-enhanced-water'),
    cloudSea: document.getElementById('iv-cloud-sea'),
    distantWorlds: document.getElementById('iv-distant-worlds'),
    applyDefaults: document.getElementById('iv-apply-defaults'),
    saveDefaults: document.getElementById('iv-save-defaults'),
    resetDefaults: document.getElementById('iv-reset-defaults'),
  };

  function randomChoice(values) {
    return values[Math.floor(Math.random() * values.length)];
  }

  function randomIslandSeed() {
    const labels = ['mossgate', 'stonefall', 'cloverdock', 'pinewatch', 'saltmeadow', 'relicshoal', 'lanternbay', 'crownmeadow'];
    const n = Math.floor(Math.random() * 90000) + 10000;
    return randomChoice(labels) + '-' + n;
  }

  function slug(value) {
    const clean = String(value || 'island').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return clean || 'island';
  }

  function clampNumber(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function formatTimeOfDay(value) {
    const total = Math.round(clampNumber(value, DEFAULT_GRAPHICS.timeOfDay, 0, 1439));
    const h = String(Math.floor(total / 60) % 24).padStart(2, '0');
    const m = String(total % 60).padStart(2, '0');
    return h + ':' + m;
  }

  function loadJsonStorage(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function normalizeGraphics(value, opts = {}) {
    const raw = value || {};
    const source = Object.assign({}, DEFAULT_GRAPHICS, raw);
    const stableEffects = raw.viewerEffectsVersion === GRAPHICS_DEFAULTS_VERSION;
    const rawSun = Object.prototype.hasOwnProperty.call(raw, 'directionalSun')
      ? Number(raw.directionalSun)
      : NaN;
    if (opts.migrateOldSun !== false && Number.isFinite(rawSun) && Math.abs(rawSun - 1.1) < 0.0001) {
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

  function normalizeViewer(value) {
    const source = Object.assign({}, DEFAULT_VIEWER, value || {});
    return {
      gridSize: ISLAND_VIEWER_GRID_SIZE,
      seed: String(source.seed || '').trim(),
    };
  }

  function loadGraphicsDefaults() {
    const raw = loadJsonStorage(GRAPHICS_LS, DEFAULT_GRAPHICS);
    const migrateOldSun = localStorage.getItem(GRAPHICS_SUN_MIGRATION_LS) !== '1';
    const graphics = normalizeGraphics(raw, { migrateOldSun });
    const rawSun = raw && Object.prototype.hasOwnProperty.call(raw, 'directionalSun')
      ? Number(raw.directionalSun)
      : NaN;
    if (migrateOldSun) {
      try { localStorage.setItem(GRAPHICS_SUN_MIGRATION_LS, '1'); } catch (_) {}
    }
    if (migrateOldSun && Number.isFinite(rawSun) && Math.abs(rawSun - 1.1) < 0.0001) {
      try { localStorage.setItem(GRAPHICS_LS, JSON.stringify(graphics)); } catch (_) {}
    }
    return graphics;
  }

  function loadViewerDefaults() {
    return normalizeViewer(loadJsonStorage(VIEWER_LS, DEFAULT_VIEWER));
  }

  function saveDefaults() {
    localStorage.setItem(GRAPHICS_LS, JSON.stringify(state.graphics));
    localStorage.setItem(VIEWER_LS, JSON.stringify(state.viewer));
  }

  function setStatus(text) {
    el.status.textContent = text || '';
  }

  function localDevEnabled() {
    const host = location.hostname;
    if (location.search.includes('viewerDev=1')) return true;
    return location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  }

  function syncDevForm() {
    if (!el.devForm) return;
    el.gridSize.value = String(state.viewer.gridSize);
    el.seed.value = state.viewer.seed || '';
    el.resolution.value = String(Math.round(state.graphics.resolution * 100));
    el.shadow.value = state.graphics.shadow;
    el.lighting.value = String(Math.round(state.graphics.lighting * 100));
    el.sun.value = String(Math.round(state.graphics.directionalSun * 100));
    el.sunAngle.value = String(Math.round(state.graphics.directionalSunAngle));
    el.timeCycle.value = state.graphics.timeCycle;
    el.timeOfDay.value = String(Math.round(state.graphics.timeOfDay));
    el.ambient.value = String(Math.round(state.graphics.ambientFill * 100));
    el.clouds.value = String(Math.round(state.graphics.clouds * 100));
    el.cloudHeight.value = String(state.graphics.cloudHeight);
    el.enhancedWater.checked = !!state.graphics.enhancedWater;
    el.cloudSea.checked = !!state.graphics.cloudSea;
    el.distantWorlds.checked = !!state.graphics.distantWorlds;
    paintDevReadouts();
  }

  function paintDevReadouts() {
    if (el.resolutionValue) el.resolutionValue.textContent = el.resolution.value + '%';
    if (el.lightingValue) el.lightingValue.textContent = el.lighting.value + '%';
    if (el.sunValue) el.sunValue.textContent = el.sun.value + '%';
    if (el.sunAngleValue) el.sunAngleValue.textContent = el.sunAngle.value + 'deg';
    if (el.timeOfDayValue) el.timeOfDayValue.textContent = formatTimeOfDay(el.timeOfDay.value);
    if (el.ambientValue) el.ambientValue.textContent = el.ambient.value + '%';
    if (el.cloudsValue) el.cloudsValue.textContent = el.clouds.value + '%';
    if (el.cloudHeightValue) el.cloudHeightValue.textContent = el.cloudHeight.value;
  }

  function readDevForm() {
    state.viewer = normalizeViewer({
      gridSize: ISLAND_VIEWER_GRID_SIZE,
      seed: el.seed.value,
    });
    state.graphics = normalizeGraphics({
      resolution: Number(el.resolution.value) / 100,
      shadow: el.shadow.value,
      lighting: Number(el.lighting.value) / 100,
      directionalSun: Number(el.sun.value) / 100,
      directionalSunAngle: Number(el.sunAngle.value),
      timeCycle: el.timeCycle.value,
      timeOfDay: Number(el.timeOfDay.value),
      ambientFill: Number(el.ambient.value) / 100,
      clouds: Number(el.clouds.value) / 100,
      cloudHeight: Number(el.cloudHeight.value),
      enhancedWater: el.enhancedWater.checked,
      cloudSea: el.cloudSea.checked,
      distantWorlds: el.distantWorlds.checked,
    });
    paintDevReadouts();
  }

  function ensureRenderer() {
    if (state.renderer) return state.renderer;
    if (!window.TinyWorldIslandRenderer || !window.TinyWorldIslandGenerator) {
      throw new Error('Island Viewer runtime did not load.');
    }
    state.renderer = window.TinyWorldIslandRenderer.mount(el.viewport, { graphics: state.graphics });
    return state.renderer;
  }

  function currentProfileFor(world, meta) {
    const G = window.TinyWorldIslandGenerator;
    const seed = String((meta && meta.seed) || (state.current && state.current.seed) || '').trim();
    if (G && typeof G.profile === 'function') {
      return G.profile(world, { seed });
    }
    return (meta && meta.profile) || null;
  }

  function applyGraphics() {
    if (!state.renderer) return;
    state.renderer.applyGraphics(state.graphics);
  }

  function commitDevDefaults(opts = {}) {
    const persist = opts.persist !== false;
    const apply = opts.apply !== false;
    readDevForm();
    if (persist) saveDefaults();
    if (apply) applyGraphics();
  }

  function downloadJson(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 200);
  }

  function saveCurrent() {
    if (!state.current || !state.current.world) {
      setStatus('The rendered island is not ready yet.');
      return;
    }
    const exported = state.renderer ? state.renderer.exportWorld() : state.current.world;
    const profile = state.current.profile || currentProfileFor(exported, {});
    const name = profile && profile.name || 'island';
    downloadJson('tinyworld-island-' + slug(name) + '-reveal.json', {
      type: 'tinyworld.islandViewerReveal',
      version: 1,
      savedAt: new Date().toISOString(),
      seed: state.current.seed || '',
      world: exported,
      profile,
      viewerGraphics: state.graphics,
    });
    setStatus('Saved island reveal file from the standalone viewer.');
  }

  function renderWorld(world, meta = {}) {
    const renderer = ensureRenderer();
    const profile = currentProfileFor(world, meta);
    renderer.loadWorld(world, { profile, graphics: state.graphics });
    state.ready = true;
    state.current = {
      seed: meta.seed || '',
      world: renderer.exportWorld(),
      profile,
    };
    const rawYield = profile && profile.rawYield;
    const rawYieldLabel = rawYield && rawYield.scores
      ? ' ' + (rawYield.rarity && rawYield.rarity.label || 'Common') + ' - Raw Yield ' + Math.max(0, Math.round(Number(rawYield.scores.rawYield) || 0)) + '.'
      : '';
    setStatus(profile && profile.name ? 'Viewing ' + profile.name + '.' + rawYieldLabel : 'Island Viewer is ready.');
  }

  function generateIsland(opts = {}) {
    if (el.devForm) readDevForm();
    const G = window.TinyWorldIslandGenerator;
    if (!G || typeof G.generate !== 'function') {
      setStatus('Random island generator is unavailable.');
      return;
    }
    const seed = opts.seed || state.viewer.seed || randomIslandSeed();
    state.viewer.seed = seed;
    syncDevForm();
    setStatus('Rendering a random island...');
    try { localStorage.setItem(GRAPHICS_LS, JSON.stringify(state.graphics)); } catch (_) {}
    const world = window.TinyWorldIslandGenerator.generate({ seed, gridSize: ISLAND_VIEWER_GRID_SIZE });
    const profile = G.profile(world, { seed });
    renderWorld(world, { seed, profile });
  }

  function loadPayload(payload) {
    if (payload && payload.viewerGraphics) {
      state.graphics = normalizeGraphics(payload.viewerGraphics);
      syncDevForm();
      saveDefaults();
    }
    const source = payload && payload.type === 'tinyworld.islandViewerReveal' ? payload.world
      : payload && payload.type === 'tinyworld.randomIslandReveal' ? payload.world
        : payload;
    const seed = String(payload && payload.seed || '').trim();
    renderWorld(source, {
      seed,
      profile: payload && payload.profile,
    });
  }

  function readSelectedFile(file) {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        loadPayload(JSON.parse(String(reader.result || '')));
      } catch (err) {
        console.error(err);
        setStatus(err && err.message ? err.message : 'Could not load island file.');
      }
    };
    reader.onerror = function () {
      setStatus('Could not read island file.');
    };
    reader.readAsText(file);
  }

  el.newButton.addEventListener('click', function () {
    generateIsland({ seed: randomIslandSeed() });
  });
  el.saveReveal.addEventListener('click', saveCurrent);
  el.loadButton.addEventListener('click', function () {
    el.loadFile.click();
  });
  el.loadFile.addEventListener('change', function () {
    const file = el.loadFile.files && el.loadFile.files[0];
    if (file) readSelectedFile(file);
    el.loadFile.value = '';
  });

  if (localDevEnabled() && el.devToggle && el.devPanel) {
    el.devToggle.hidden = false;
    el.devToggle.addEventListener('click', function () {
      el.devPanel.hidden = !el.devPanel.hidden;
      syncDevForm();
    });
  }
  if (el.devClose) {
    el.devClose.addEventListener('click', function () {
      el.devPanel.hidden = true;
    });
  }
  if (el.devForm) {
    const updateDevDefaults = function () {
      commitDevDefaults();
    };
    const liveDefaultsControls = [
      el.gridSize,
      el.seed,
      el.resolution,
      el.shadow,
      el.lighting,
      el.sun,
      el.sunAngle,
      el.timeCycle,
      el.timeOfDay,
      el.ambient,
      el.clouds,
      el.cloudHeight,
      el.enhancedWater,
      el.cloudSea,
      el.distantWorlds,
    ].filter(Boolean);
    liveDefaultsControls.forEach(control => {
      control.addEventListener('input', updateDevDefaults);
      control.addEventListener('change', updateDevDefaults);
    });
  }
  if (el.applyDefaults) {
    el.applyDefaults.addEventListener('click', function () {
      commitDevDefaults();
      setStatus('Applied island viewer graphics defaults.');
    });
  }
  if (el.saveDefaults) {
    el.saveDefaults.addEventListener('click', function () {
      commitDevDefaults();
      setStatus('Saved island viewer defaults for this browser.');
    });
  }
  if (el.resetDefaults) {
    el.resetDefaults.addEventListener('click', function () {
      state.graphics = normalizeGraphics(DEFAULT_GRAPHICS);
      state.viewer = normalizeViewer(DEFAULT_VIEWER);
      syncDevForm();
      saveDefaults();
      applyGraphics();
      setStatus('Reset island viewer defaults.');
    });
  }

  syncDevForm();
  if (!state.viewer.seed) state.viewer.seed = randomIslandSeed();
  generateIsland();
})();
