  /* =====================================================================
     Tiny World Builder — single-file Three.js scene + tile editor
     ===================================================================== */

  // -------- constants --------
  // GRID is the home board edge length. Mutable: the user can resize it
  // from tiny 8×8 dioramas up to 20×20 worlds. Tiles outside the current
  // home grid are still tracked in world[][] (used by ghost boards and
  // export) but rendered grayscale; growing GRID brings those tiles into
  // the home area and rebuilds them in full colour.
  const HOME_GRID_DEFAULT = 8;
  const HOME_GRID_MIN = 8;
  const HOME_GRID_MAX = 20;
  const HOME_GRID_OPTIONS = [8, 10, 12, 16, 20];
  const HOME_GRID_OPTION_SET = new Set(HOME_GRID_OPTIONS);
  let GRID = HOME_GRID_DEFAULT;

  function isValidGridSize(n) {
    return Number.isInteger(n) && HOME_GRID_OPTION_SET.has(n);
  }

  function coerceGridSize(value, fallback = HOME_GRID_DEFAULT) {
    const n = parseInt(value, 10);
    if (isValidGridSize(n)) return n;
    return isValidGridSize(fallback) ? fallback : HOME_GRID_DEFAULT;
  }

  function fillGridSizeSelect(el) {
    if (!el) return;
    const prev = coerceGridSize(el.value, GRID);
    el.innerHTML = '';
    for (const size of HOME_GRID_OPTIONS) {
      const opt = document.createElement('option');
      opt.value = String(size);
      opt.textContent = size + ' × ' + size;
      el.appendChild(opt);
    }
    el.value = String(prev);
  }
  // Tooltips render in one fixed body-level element so they are never
  // clipped by scrolling toolbars, minimaps, or flyouts.
  (function wireFixedTooltips() {
    const tip = document.createElement('div');
    tip.className = 'ui-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    document.body.appendChild(tip);
    let active = null;
    let timer = 0;
    let hideTimer = 0;
    let lastPointer = { x: 0, y: 0 };

    function labelFor(el) {
      return String((el && el.getAttribute('data-tooltip')) || '').split('|')[0].trim();
    }
    function place(el) {
      if (!el || tip.hidden) return;
      const r = el.getBoundingClientRect();
      tip.style.left = '0px';
      tip.style.top = '0px';
      const tw = tip.offsetWidth || 80;
      const th = tip.offsetHeight || 24;
      let left = r.left + r.width / 2;
      let top = r.bottom + 8;
      if (el.closest('.controls')) {
        left = r.right + 10 + tw / 2;
        top = r.top + r.height / 2 - th / 2;
      } else if (top + th > window.innerHeight - 8) {
        top = r.top - th - 8;
      }
      left = Math.max(8 + tw / 2, Math.min(window.innerWidth - 8 - tw / 2, left));
      top = Math.max(8, Math.min(window.innerHeight - 8 - th, top));
      tip.style.left = Math.round(left) + 'px';
      tip.style.top = Math.round(top) + 'px';
    }
    function show(el) {
      const text = labelFor(el);
      if (!text) return;
      active = el;
      clearTimeout(timer);
      clearTimeout(hideTimer);
      timer = setTimeout(() => {
        tip.textContent = text;
        tip.hidden = false;
        tip.classList.add('visible');
        place(active);
      }, 500);
    }
    function hide() {
      clearTimeout(timer);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        const hovered = document.elementFromPoint(lastPointer.x, lastPointer.y);
        const hoveredTooltip = hovered && hovered.closest && hovered.closest('[data-tooltip]');
        if (active && (hoveredTooltip === active || document.activeElement === active || active.contains(document.activeElement))) {
          place(active);
          return;
        }
        active = null;
        tip.classList.remove('visible');
        tip.hidden = true;
      }, 50);
    }
    document.addEventListener('pointermove', e => {
      lastPointer = { x: e.clientX, y: e.clientY };
    }, { passive: true });
    document.addEventListener('mousemove', e => {
      lastPointer = { x: e.clientX, y: e.clientY };
    }, { passive: true });
    document.addEventListener('pointerover', e => {
      const el = e.target && e.target.closest && e.target.closest('[data-tooltip]');
      if (el) show(el);
    });
    document.addEventListener('mouseover', e => {
      const el = e.target && e.target.closest && e.target.closest('[data-tooltip]');
      if (el) show(el);
    });
    document.addEventListener('pointerout', e => {
      if (active && (!e.relatedTarget || !active.contains(e.relatedTarget))) hide();
    });
    document.addEventListener('mouseout', e => {
      if (active && (!e.relatedTarget || !active.contains(e.relatedTarget))) hide();
    });
    document.addEventListener('focusin', e => {
      const el = e.target && e.target.closest && e.target.closest('[data-tooltip]');
      if (el) show(el);
    });
    document.addEventListener('focusout', hide);
    window.addEventListener('scroll', () => place(active), true);
    window.addEventListener('resize', () => place(active));
  })();
  try {
    const stored = parseInt(localStorage.getItem('tinyworld:home-grid') || '', 10);
    GRID = coerceGridSize(stored, GRID);
  } catch (_) {}
  const TILE = 1;
  let currentTodMinutes = 720;
  const TOP_H = 0.18;     // grass slab thickness
  const WEATHER_SURFACE_PAD = 0.14;
  const WEATHER_DECAL_LIFT = 0.09;
  const WEATHER_RIPPLE_LIFT = 0.10;
  const DIRT_H = 0.55;    // dirt block height (visible side)
  const UNDERCLOUD_HEIGHT_MULTIPLIER = 1.08;
  const RENDER_LS = {
    resolution: 'tinyworld:render:resolution',
    saturation: 'tinyworld:render:saturation',
    contrast: 'tinyworld:render:contrast',
    brightness: 'tinyworld:render:brightness',
    uiTheme: 'tinyworld:uiTheme',
    shadow: 'tinyworld:render:shadow',
    lighting: 'tinyworld:render:lighting',
    ambientFill: 'tinyworld:render:ambientFill',
    frontFill: 'tinyworld:render:frontFill',
    sideFill: 'tinyworld:render:sideFill',
    backFill: 'tinyworld:render:backFill',
    visibleDistance: 'tinyworld:render:visibleDistance',
    visibleSize: 'tinyworld:render:visibleSize',
    clouds: 'tinyworld:render:clouds',
    cloudSpeed: 'tinyworld:render:cloudSpeed',
    cloudHeight: 'tinyworld:render:cloudHeight',
    cloudShadow: 'tinyworld:render:cloudShadow',
    planesEnabled: 'tinyworld:render:planesEnabled',
    distantWorlds: 'tinyworld:render:distantWorlds',
    cloudSea: 'tinyworld:render:cloudSea',
    cloudStyle: 'tinyworld:render:cloudStyle',
    starVault: 'tinyworld:render:starVault',
    starVaultStrength: 'tinyworld:render:starVaultStrength',
    cloudRimLight: 'tinyworld:render:cloudRimLight',
    accentLights: 'tinyworld:render:accentLights',
    underCloudSpread: 'tinyworld:render:underCloudSpread',
    skyBlueDepth: 'tinyworld:render:skyBlueDepth',
    skyBlueSaturation: 'tinyworld:render:skyBlueSaturation',
    distanceMist: 'tinyworld:render:distanceMist',
    backdrop: 'tinyworld:render:backdrop',
    backdropVignette: 'tinyworld:render:backdropVignette',
    tiltBlur: 'tinyworld:render:tiltBlur',
    tiltFocus: 'tinyworld:render:tiltFocus',
    ghostOpacity: 'tinyworld:render:ghostOpacity',
    floorOpacity: 'tinyworld:render:floorOpacity',
    objectOpacity: 'tinyworld:render:objectOpacity',
    voxelGap: 'tinyworld:render:voxelGap',
    voxelBevel: 'tinyworld:render:voxelBevel',
    voxelTerrain: 'tinyworld:render:voxelTerrain',
    texturedGrass: 'tinyworld:render:texturedGrass',
    surfaceLinkedMaterials: 'tinyworld:render:surfaceLinkedMaterials',
    terrainColors: 'tinyworld:render:terrainColors',
    terrainColorTarget: 'tinyworld:render:terrainColorTarget',
    materialParts: 'tinyworld:render:materialParts',
    materialTarget: 'tinyworld:render:materialTarget',
    materialWear: 'tinyworld:render:materialWear',
    enhancedWater: 'tinyworld:render:enhancedWater',
    landscapeMeshMode: 'tinyworld:render:landscapeMeshMode',
    terrainVoxelResolution: 'tinyworld:render:terrainVoxelResolution',
    showCrowns: 'tinyworld:render:showCrowns',
    autoExpand: 'tinyworld:render:autoExpand',
    pixelSize: 'tinyworld:render:pixelSize',
    pixelDepthEdge: 'tinyworld:render:pixelDepthEdge',
    pixelNormalEdge: 'tinyworld:render:pixelNormalEdge',
    shaderAntialias: 'tinyworld:render:shaderAntialias',
    crowdCount: 'tinyworld:crowd:count',
    crowdScale: 'tinyworld:crowd:scale',
    crowdSpeed: 'tinyworld:crowd:speed',
    crowdBob: 'tinyworld:crowd:bob',
    crowdSway: 'tinyworld:crowd:sway',
    crowdLean: 'tinyworld:crowd:lean',
    crowdZoneRadius: 'tinyworld:crowd:zoneRadius',
    crowdShowZones: 'tinyworld:crowd:showZones',
    crowdPaused: 'tinyworld:crowd:paused',
    crowdDebug: 'tinyworld:crowd:debug',
    crowdMode: 'tinyworld:crowd:mode',
    crowdShowArrows: 'tinyworld:crowd:showArrows',
    crowdEnabled: 'tinyworld:crowd:enabled',
    version: 'tinyworld:render:version',
  };
  const RENDER_SETTINGS_VERSION = '24';
  const RENDER_DEFAULTS = {
    // Defaults tuned from the light-mode render panel: lower internal
    // resolution, softer direct light, full ambient fill, and stronger colour
    // grade/tilt blur. Colour sliders are direct CSS filters on the canvas.
    resolution: '0.75',
    saturation: '1.09',
    contrast: '1.20',
    brightness: '0.80',
    uiTheme: 'auto',
    shadow: 'balanced',
    lighting: '0.50',
    ambientFill: '1.00',
    frontFill: '0.10',
    sideFill: '0.10',
    backFill: '0.10',
    visibleDistance: '0',
    visibleSize: '0',
    clouds: '0.4',
    cloudSpeed: '0.35',
    cloudHeight: '9.5',
    cloudShadow: '0',
    planesEnabled: '0',
    distantWorlds: '1',
    cloudSea: '1',
    cloudStyle: 'soft',
    starVault: '1',
    starVaultStrength: '0.92',
    cloudRimLight: '0.78',
    accentLights: '0.65',
    underCloudSpread: '1.35',
    skyBlueDepth: '0.58',
    skyBlueSaturation: '1',
    distanceMist: '0.36',
    backdrop: '0.78',
    backdropVignette: '0.24',
    tiltBlur: '10.5',
    tiltFocus: '21',
    ghostOpacity: '0',
    floorOpacity: '0',
    objectOpacity: '0',
    voxelGap: '0',
    voxelBevel: '0.018',
    voxelTerrain: '1',
    texturedGrass: '1',
    showCrowns: '0',
    surfaceLinkedMaterials: '1',
    terrainColors: '{}',
    terrainColorTarget: 'grass',
    materialParts: '{}',
    materialTarget: 'walls',
    materialWear: '0',
    enhancedWater: '1',
    landscapeMeshMode: '1',
    terrainVoxelResolution: 'mixed',
    autoExpand: '0',
    pixelSize: '1',
    // Keep the old-school mode as chunky colour pixels by default. The
    // depth/normal edge layers are optional because they outline real tile
    // bevels, risers and decals, which can read as terrain artifacts.
    pixelDepthEdge: '0',
    pixelNormalEdge: '0',
    shaderAntialias: '0',
    crowdCount: '12',
    crowdScale: '0.75',
    crowdSpeed: '1',
    crowdBob: '2.4',
    crowdSway: '1.4',
    crowdLean: '0.07',
    crowdZoneRadius: '0.16',
    crowdShowZones: '0',
    crowdPaused: '0',
    crowdDebug: '1',
    crowdMode: 'wander',
    crowdShowArrows: '1',
    crowdEnabled: '1',
  };
  const renderSettingsReset = localStorage.getItem(RENDER_LS.version) !== RENDER_SETTINGS_VERSION;
  if (renderSettingsReset) {
    for (const key of Object.values(RENDER_LS)) localStorage.removeItem(key);
    for (const [key, value] of Object.entries(RENDER_DEFAULTS)) localStorage.setItem(RENDER_LS[key], value);
    localStorage.setItem(RENDER_LS.version, RENDER_SETTINGS_VERSION);
  }
  try {
    for (const key of [
      'tinyworld:render:post',
      'tinyworld:render:smoothing',
      'tinyworld:render:gamma',
      'tinyworld:render:vignette',
      'tinyworld:render:warmth',
    ]) localStorage.removeItem(key);
    localStorage.setItem(RENDER_LS.visibleDistance, '0');
    localStorage.setItem(RENDER_LS.visibleSize, '0');
    localStorage.setItem(RENDER_LS.ghostOpacity, '0');
    localStorage.setItem(RENDER_LS.floorOpacity, '0');
    localStorage.setItem(RENDER_LS.objectOpacity, '0');
    localStorage.setItem(RENDER_LS.voxelGap, '0');
    localStorage.setItem(RENDER_LS.showCrowns, '0');
    localStorage.setItem(RENDER_LS.cloudShadow, '0');
  } catch (_) {}

  function storedNumber(key, fallback, min, max) {
    const n = parseFloat(localStorage.getItem(key));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  // -------- scene / renderer --------
  const container = document.getElementById('app');
  const canvasEl = document.createElement('canvas');
  canvasEl.setAttribute('role', 'img');
  canvasEl.setAttribute('aria-label', 'Interactive 3D tiny world editor. Use toolbar buttons or keyboard shortcuts to choose a tool, click cells to place items, drag to orbit, and press C to clear.');
  function stageSize() {
    return {
      w: Math.max(1, Math.round(window.innerWidth || document.documentElement.clientWidth || 1)),
      h: Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight || 1)),
    };
  }

  function applyStageSize() {
    const { w, h } = stageSize();
    container.style.width = w + 'px';
    container.style.height = h + 'px';
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    return { w, h };
  }
  const BASE_DPR_CAP = window.matchMedia && window.matchMedia('(max-width: 800px)').matches ? 1.5 : 2.0;
  let renderResolutionScale = storedNumber(RENDER_LS.resolution, parseFloat(RENDER_DEFAULTS.resolution), 0.25, 1.5);
  let renderBrightness = storedNumber(RENDER_LS.brightness, parseFloat(RENDER_DEFAULTS.brightness), 0.75, 1.3);
  let uiThemeMode = ['auto', 'light', 'dark'].includes(localStorage.getItem(RENDER_LS.uiTheme)) ? localStorage.getItem(RENDER_LS.uiTheme) : 'auto';
  let renderSaturation = storedNumber(RENDER_LS.saturation, parseFloat(RENDER_DEFAULTS.saturation), 0.8, 1.3);
  let renderContrast = storedNumber(RENDER_LS.contrast, parseFloat(RENDER_DEFAULTS.contrast), 0.85, 1.25);
  let renderShadowQuality = localStorage.getItem(RENDER_LS.shadow) || 'balanced';
  let renderLighting = storedNumber(RENDER_LS.lighting, parseFloat(RENDER_DEFAULTS.lighting), 0.5, 1.45);
  let renderAmbientFill = storedNumber(RENDER_LS.ambientFill, parseFloat(RENDER_DEFAULTS.ambientFill), 0, 1);
  let renderFrontFill = storedNumber(RENDER_LS.frontFill, parseFloat(RENDER_DEFAULTS.frontFill), 0, 1);
  let renderSideFill = storedNumber(RENDER_LS.sideFill, parseFloat(RENDER_DEFAULTS.sideFill), 0, 1);
  let renderBackFill = storedNumber(RENDER_LS.backFill, parseFloat(RENDER_DEFAULTS.backFill), 0, 1);
  function renderBudgetForGrid(grid) {
    const g = coerceGridSize(grid, GRID);
    return { maxDistance: g <= 12 ? 4 : 2, ghostRadius: g <= 12 ? 4 : 2, visibleScale: 1.125, homeWindowMin: g, homeWindowMax: g, queueCap: 256 };
  }

  function maxRenderVisibleDistanceForGrid(grid) {
    return renderBudgetForGrid(grid).maxDistance;
  }

  // -------- landscape mesh mode state (declared early to avoid TDZ errors) --------
  let useLandscapeEngine = false;
  let landscapeEngineInstance = null;
  let landscapeMeshMode = localStorage.getItem(RENDER_LS.landscapeMeshMode) !== '0';
  let landscapeMeshEngine = null;
  function isLandscapeMeshActive() {
    return !!(useLandscapeEngine && landscapeMeshMode && landscapeMeshEngine);
  }
  let landscapeMeshGroup = null;
  let landscapeCutCapsGroup = null;
  let landscapeMeshBiome = 'grassland';  // 'grassland', 'desert', or 'snow'
  let landscapeMeshStyle = 'lowpoly';    // 'realistic' or 'lowpoly'
  let planetLandscapeGroup = null;
  let planetLandscapeEngine = null;
  let planetLandscapeConfig = null;
  let planetAtmosphereGroup = null;
  // Last successful planet-underlay config — kept so the render-settings
  // checkbox can re-init the planet after the user toggled it off without
  // needing to re-open the Generate panel.
  let lastPlanetLandscapeConfig = null;
  function isPlanetLandscapeActive() {
    return !!(planetLandscapeGroup && planetLandscapeEngine);
  }

  // Autoexpand is temporarily disabled ("Coming Soon"). Force it off regardless
  // of any previously saved preference so users can't end up in a stuck state.
  let renderAutoExpand = false;
  try { localStorage.setItem(RENDER_LS.autoExpand, '0'); } catch (_) {}

  function maxRenderVisibleSizeForGrid(grid) {
    const g = coerceGridSize(grid, GRID);
    if (isLandscapeMeshActive()) {
      return Math.max(48, g * 4);
    }
    const budget = renderBudgetForGrid(g);
    // Preview window is the reveal bubble, not the full preloaded board
    // diameter. Autoexpand grows content by moving that small window while
    // ghostPreloadRadius controls how many neighbour boards are ready nearby.
    return Math.max(g, Math.min(Math.round(HOME_GRID_MAX * 1.5), Math.ceil(g * budget.visibleScale)));
  }

  function previewSettingsForGrid(grid, explored) {
    return { distance: 0, visibleSize: 0 };
  }
  const initialPreviewSettings = previewSettingsForGrid(GRID, false);
  let renderVisibleDistance = 0;
  let renderVisibleSize = 0;
  if (renderSettingsReset) {
    renderVisibleDistance = initialPreviewSettings.distance;
    renderVisibleSize = initialPreviewSettings.visibleSize;
    try {
      localStorage.setItem(RENDER_LS.visibleDistance, String(renderVisibleDistance));
      localStorage.setItem(RENDER_LS.visibleSize, String(renderVisibleSize));
    } catch (_) {}
  }
  let hasUserPanned = false;
  function visibleSizeForExplorer() {
    return 0;
  }
  function expandVisibleSizeOnFirstMove() {
    return false;
  }
  let renderCloudAmount = storedNumber(RENDER_LS.clouds, 0.61, 0, 1);
  let renderCloudSpeed = storedNumber(RENDER_LS.cloudSpeed, 0.35, 0, 1);
  let renderCloudHeight = storedNumber(RENDER_LS.cloudHeight, 9.5, 9, 16);
  // Cloud shadow strength — controls per-puff alphaTest so only the
  // denser parts of each cloud cast on the world below.
  let renderCloudShadow = storedNumber(RENDER_LS.cloudShadow, 0, 0, 1);
  let renderPlanesEnabled = localStorage.getItem(RENDER_LS.planesEnabled) === '1';
  // Enhanced water shader: animated reflections, sun glints and foam on water
  // surfaces (voxel water tiles + the LandscapeEngine ocean). On by default;
  // toggling rebuilds water materials so it applies in every environment.
  let renderEnhancedWater = localStorage.getItem(RENDER_LS.enhancedWater) !== '0';
  // Decorative background mini-worlds (distant-worlds group); on by default.
  let renderDistantWorlds = localStorage.getItem(RENDER_LS.distantWorlds) !== '0';
  // Soft sprite "cloud sea" below the islands; off by default (opt-in).
  let renderCloudSea = localStorage.getItem(RENDER_LS.cloudSea) === '1';
  // Cloud style for the clouds around/above the islands: 'voxel' or 'soft'.
  let renderCloudStyle = localStorage.getItem(RENDER_LS.cloudStyle) === 'soft' ? 'soft' : 'voxel';
  let renderStarVault = localStorage.getItem(RENDER_LS.starVault) !== '0';
  let renderStarVaultStrength = storedNumber(RENDER_LS.starVaultStrength, 0.92, 0, 1.2);
  let renderCloudRimLight = storedNumber(RENDER_LS.cloudRimLight, 0.78, 0, 1.2);
  let renderAccentLights = storedNumber(RENDER_LS.accentLights, 0.65, 0, 1.2);
  let renderUnderCloudSpread = storedNumber(RENDER_LS.underCloudSpread, 1.35, 0.7, 2.2);
  let renderSkyBlueDepth = storedNumber(RENDER_LS.skyBlueDepth, 0.58, 0, 1);
  let renderSkyBlueSaturation = storedNumber(RENDER_LS.skyBlueSaturation, 1, 0.25, 2.2);
  let renderDistanceMist = storedNumber(RENDER_LS.distanceMist, 0.28, 0, 2);
  let renderBackdrop = storedNumber(RENDER_LS.backdrop, 0.78, 0, 2);
  let renderBackdropVignette = storedNumber(RENDER_LS.backdropVignette, 0.18, 0, 3);
  // Pixelation post-process. pixelSize 1 = bypass (no post pass). 2-12 chunkier.
  let renderPixelSize = Math.round(storedNumber(RENDER_LS.pixelSize, 1, 1, 12));
  let renderPixelDepthEdge = storedNumber(RENDER_LS.pixelDepthEdge, 0, 0, 1);
  let renderPixelNormalEdge = storedNumber(RENDER_LS.pixelNormalEdge, 0, 0, 1);
  let renderShaderAntialias = storedNumber(RENDER_LS.shaderAntialias, 0, 0, 1);
  let renderTiltBlur = storedNumber(RENDER_LS.tiltBlur, 1.0, 0, 18);
  let renderTiltFocus = storedNumber(RENDER_LS.tiltFocus, 65, 15, 80);
  let renderGhostOpacity = 0;
  let renderFloorOpacity = 0;
  let renderObjectOpacity = 0;
  let renderVoxelGap = 0;
  let renderVoxelBevel = storedNumber(RENDER_LS.voxelBevel, parseFloat(RENDER_DEFAULTS.voxelBevel), 0, 0.06);
  let renderVoxelTerrain = localStorage.getItem(RENDER_LS.voxelTerrain) !== '0';
  let renderTexturedGrass = localStorage.getItem(RENDER_LS.texturedGrass) !== '0';
  let renderSurfaceLinkedMaterials = localStorage.getItem(RENDER_LS.surfaceLinkedMaterials) !== '0';
  let renderTerrainVoxelResolution = localStorage.getItem(RENDER_LS.terrainVoxelResolution) || 'mixed';
  let showCrowns = false;
  if (!['mixed', '4', '6', '8', '12'].includes(renderTerrainVoxelResolution)) renderTerrainVoxelResolution = 'mixed';
  if (!renderAutoExpand) renderVisibleSize = 0;
  function applyBackdropSettings() {
    const d = Math.max(0, Math.min(1, renderSkyBlueDepth || 0));
    const satMul = Math.max(0.25, Math.min(2.2, renderSkyBlueSaturation || 1));
    const strong = new THREE.Color().setHSL(0.585, Math.min(1, (0.54 + d * 0.30) * satMul), 0.48 - d * 0.08);
    const base = new THREE.Color().setHSL(0.585, Math.min(1, (0.44 + d * 0.18) * satMul), 0.66 - d * 0.08);
    const low = new THREE.Color().setHSL(0.565, Math.min(1, (0.34 + d * 0.14) * satMul), 0.86 - d * 0.10);
    const cssRgb = color => [
      Math.round(color.r * 255),
      Math.round(color.g * 255),
      Math.round(color.b * 255),
    ].join(', ');
    document.documentElement.style.setProperty('--backdrop-strength', renderBackdrop.toFixed(2));
    document.documentElement.style.setProperty('--backdrop-vignette', renderBackdropVignette.toFixed(2));
    document.documentElement.style.setProperty('--sky-blue-depth', renderSkyBlueDepth.toFixed(2));
    document.documentElement.style.setProperty('--sky-blue-strong-rgb', cssRgb(strong));
    document.documentElement.style.setProperty('--sky-blue-base-rgb', cssRgb(base));
    document.documentElement.style.setProperty('--sky-blue-low-rgb', cssRgb(low));
  }
  applyBackdropSettings();
  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, BASE_DPR_CAP) * renderResolutionScale);
  applyStageSize();
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // The scene is mostly static, and the post-processing path calls
  // renderer.render() up to three times per frame — with autoUpdate the
  // shadow pass re-renders on each call. Refresh on a fixed cadence from
  // renderScene() instead (plus on demand via requestShadowMapUpdate).
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.localClippingEnabled = true;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb9dcf4);
  let defaultSceneBackground = scene.background.clone();
  const xrWorldRoot = new THREE.Group();
  xrWorldRoot.name = 'xr-world-root';
  scene.add(xrWorldRoot);
  const cloudLayer = document.getElementById('cloud-layer');

  const skyBubble = new THREE.Mesh(
    new THREE.SphereGeometry(120, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: {
        blueTop: { value: new THREE.Color(0x5fa8f2) },
        blueLow: { value: new THREE.Color(0xc7e6fb) },
        warmLight: { value: new THREE.Color(0xffddaa) },
        haze: { value: new THREE.Color(0xf7efe0) },
      },
      vertexShader: [
        'varying vec3 vDir;',
        'void main() {',
        '  vDir = normalize(position);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vDir;',
        'uniform vec3 blueTop;',
        'uniform vec3 blueLow;',
        'uniform vec3 warmLight;',
        'uniform vec3 haze;',
        'void main() {',
        '  float heightMix = smoothstep(-0.32, 0.82, vDir.y);',
        '  vec3 col = mix(blueLow, blueTop, heightMix);',
        '  float warmCorner = pow(max(dot(normalize(vDir), normalize(vec3(0.70, 0.52, -0.44))), 0.0), 2.4);',
        '  float lowerGlow = smoothstep(-0.75, -0.12, -vDir.y) * 0.42;',
        '  col = mix(col, warmLight, warmCorner * 0.72);',
        '  col = mix(col, haze, lowerGlow);',
        '  gl_FragColor = vec4(col, 1.0);',
        '}',
      ].join('\n'),
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    })
  );
  skyBubble.name = 'sky-gradient-bubble';
  skyBubble.renderOrder = -1000;
  skyBubble.frustumCulled = false;
  scene.add(skyBubble);

  function updateSkyBubble() {
    if (!skyBubble || !camera) return;
    const xrPresenting = renderer.xr && renderer.xr.isPresenting;
    skyBubble.visible = !!scene.background && !xrPresenting;
    if (skyBubble.visible) skyBubble.position.copy(camera.position);
  }

  function applySkyBubbleSettings() {
    const d = Math.max(0, Math.min(1, renderSkyBlueDepth || 0));
    const satMul = Math.max(0.25, Math.min(2.2, renderSkyBlueSaturation || 1));
    const topSat = Math.min(1, (0.50 + d * 0.32) * satMul);
    const lowSat = Math.min(1, (0.38 + d * 0.18) * satMul);
    const uniforms = skyBubble.material && skyBubble.material.uniforms;
    if (!uniforms) return;
    uniforms.blueTop.value.setHSL(0.585, topSat, 0.80 - d * 0.24);
    uniforms.blueLow.value.setHSL(0.565, lowSat, 0.88 - d * 0.12);
    scene.background = new THREE.Color().setHSL(0.565, lowSat, 0.88 - d * 0.12);
    defaultSceneBackground = scene.background.clone();
  }
  applySkyBubbleSettings();

  const DISTANCE_MIST_NEUTRAL = new THREE.Color(0xf2eee4);
  const distanceMistFogColor = new THREE.Color();
  const distanceMistFog = new THREE.Fog(0xf2eee4, 1, 100);
  function distanceMistFogHex(colorHex) {
    const bgHex = Number.isFinite(colorHex)
      ? colorHex
      : (scene.background && scene.background.isColor ? scene.background.getHex() : 0xf4ede0);
    const d = Math.max(0, Math.min(1, renderSkyBlueDepth || 0));
    const satOver = Math.max(0, (renderSkyBlueSaturation || 1) - 1);
    const neutralBlend = Math.max(0.56, Math.min(0.82, 0.62 + d * 0.08 + satOver * 0.12));
    return distanceMistFogColor.setHex(bgHex).lerp(DISTANCE_MIST_NEUTRAL, neutralBlend).getHex();
  }

  function applyDistanceMistSettings(colorHex) {
    const amount = Math.max(0, Math.min(2, renderDistanceMist || 0));
    // Atmospheric perspective: fade distant scenery toward a warm neutral
    // haze derived from the live sky, not the fully saturated blue sky colour.
    // This is a colour fade, not per-object opacity or ground mist.
    // AR needs transparent passthrough, not opaque scene fog.
    if (amount <= 0 || !scene.background) {
      scene.fog = null;
      return;
    }
    const fogHex = distanceMistFogHex(colorHex);
    const camDistance = (typeof camera !== 'undefined' && camera && typeof target !== 'undefined')
      ? camera.position.distanceTo(target)
      : 48;
    const span = Math.max(GRID, renderVisibleSize || GRID, viewSize || GRID, DEFAULT_VIEW_SIZE);
    const zoomFade = Math.max(0, Math.min(1, ((viewSize || DEFAULT_VIEW_SIZE) - DEFAULT_VIEW_SIZE * 1.55) / (DEFAULT_VIEW_SIZE * 2.2)));
    const near = camDistance + span * (0.24 + (1 - amount) * 0.64) - span * zoomFade * (0.72 + amount * 0.58);
    const far = camDistance + span * (1.08 + (1 - amount) * 1.05) - span * zoomFade * 0.16;
    // Mutate a persistent Fog instance: updateCamera() calls this on every
    // orbit/pan/zoom and a fresh allocation per gesture frame churns GC.
    distanceMistFog.color.setHex(fogHex);
    distanceMistFog.near = near;
    distanceMistFog.far = Math.max(near + span * 0.45, far);
    if (scene.fog !== distanceMistFog) scene.fog = distanceMistFog;
  }

  function setRenderResolutionScale(value) {
    renderResolutionScale = Math.max(0.25, Math.min(1.5, value));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, BASE_DPR_CAP) * renderResolutionScale);
  }

  var landscapeGhostBoardsSuppressed = false;
  function ghostBoardsEnabledForGrid() {
    return false;
  }

  function clearGhostBoardsOnly() {
    for (const [, board] of ghostBoards) {
      worldGroup.remove(board);
      disposeGroup(board);
    }
    ghostBoards.clear();
    ghostBoardCells.clear();
    clearCheapGhostTerrain();
    clearPendingGhostBoards();
    setUnsavedBannerVisible(false);
  }

  function syncGhostRenderBudget() {
    if (typeof ghostPreloadRadius === 'undefined') return;
    const budget = renderBudgetForGrid(GRID);
    ghostPreloadRadius = ghostBoardsEnabledForGrid() ? Math.min(renderVisibleDistance, budget.ghostRadius) : 0;
    ghostOuterFadeTiles = ghostPreloadRadius > 0 ? 2 + ghostPreloadRadius * 2 : VIEW_EDGE_FADE_TILES;
  }

  function setRenderVisibleDistance(value) {
    renderVisibleDistance = 0;
    syncGhostRenderBudget();
    invalidateHomeFade();
  }

  function setRenderVisibleSize(value) {
    renderVisibleSize = 0;
    invalidateHomeFade();
  }

  function applyAutoPreviewSettingsForGrid(opts = {}) {
    const explored = renderAutoExpand && (opts.explored !== undefined ? opts.explored : hasUserPanned);
    const settings = previewSettingsForGrid(GRID, explored);
    if (opts.deferEnsure) {
      renderVisibleDistance = settings.distance;
      renderVisibleSize = settings.visibleSize;
      syncGhostRenderBudget();
      if (typeof requestHomeRenderWindowSync === 'function') requestHomeRenderWindowSync({ force: true });
    } else {
      setRenderVisibleDistance(settings.distance);
      setRenderVisibleSize(settings.visibleSize);
    }
    try {
      localStorage.setItem(RENDER_LS.visibleDistance, String(renderVisibleDistance));
      localStorage.setItem(RENDER_LS.visibleSize, String(renderVisibleSize));
    } catch (_) {}
  }

  function applyCloudSettings() {
    if (cloudLayer) {
      // Hide the old CSS cloud overlay — real voxel clouds replace it.
      cloudLayer.style.opacity = '0';
      cloudLayer.style.animationPlayState = 'paused';
    }
    // syncCloudPopulation no-ops if the cloud block hasn't run yet
    // (var-hoisted state — see comment near the cloud block).
    syncCloudPopulation();
  }

  function applyTiltShiftSettings() {
    const blur = Math.max(0, Math.min(18, renderTiltBlur));
    const focus = Math.max(15, Math.min(80, renderTiltFocus));
    const clearTop = (100 - focus) / 2;
    const clearBottom = 100 - clearTop;
    const soft = Math.min(18, clearTop);
    const edge = Math.min(28, clearTop);
    document.body.style.setProperty('--tilt-blur', blur.toFixed(1) + 'px');
    // blur(0) still pays for a full-viewport backdrop snapshot every
    // compositor frame — remove the overlay entirely when the effect is off.
    document.body.classList.toggle('tilt-blur-off', blur <= 0.01);
    document.body.style.setProperty('--tilt-clear-top', clearTop.toFixed(1) + '%');
    document.body.style.setProperty('--tilt-clear-bottom', clearBottom.toFixed(1) + '%');
    document.body.style.setProperty('--tilt-soft-top', Math.max(0, clearTop - soft).toFixed(1) + '%');
    document.body.style.setProperty('--tilt-soft-bottom', Math.min(100, clearBottom + soft).toFixed(1) + '%');
    document.body.style.setProperty('--tilt-edge-top', Math.max(0, clearTop - edge).toFixed(1) + '%');
    document.body.style.setProperty('--tilt-edge-bottom', Math.min(100, clearBottom + edge).toFixed(1) + '%');
  }

  function markCameraMoving() {
    // Keep the tilt-shift overlay active during movement. This hook remains
    // as a stable call site for pan/orbit/zoom/first-person code paths.
  }

  const deferredVisualStartupTasks = [];
  let deferredVisualStartupStarted = false;
  function enqueueDeferredVisualStartup(label, fn) {
    if (typeof fn !== 'function') return;
    deferredVisualStartupTasks.push({ label, fn });
  }
  function startDeferredVisualStartupTasks() {
    if (deferredVisualStartupStarted) return;
    deferredVisualStartupStarted = true;
    const runNext = () => {
      const task = deferredVisualStartupTasks.shift();
      if (!task) return;
      const runTask = () => {
        twPerfMark('deferred:' + task.label + ':start');
        try {
          task.fn();
        } catch (err) {
          console.warn('Deferred visual startup failed:', task.label, err);
        }
        twPerfMark('deferred:' + task.label + ':end');
        if (deferredVisualStartupTasks.length) setTimeout(runNext, 32);
      };
      if (window.requestIdleCallback) {
        window.requestIdleCallback(runTask, { timeout: 1200 });
      } else {
        setTimeout(runTask, 32);
      }
    };
    requestAnimationFrame(() => setTimeout(runNext, 120));
  }

  const twPerfEnabled = (() => {
    try { return new URLSearchParams(window.location.search).has('perf'); }
    catch (_) { return false; }
  })();
  const twPerfMarks = [];
  function twPerfMark(label) {
    if (!twPerfEnabled || typeof performance === 'undefined' || !performance.now) return;
    twPerfMarks.push({ label, t: Math.round(performance.now()) });
  }
  window.__tinyworldPerf = { marks: twPerfMarks };
  twPerfMark('script:deferred-queue-ready');

  // -------- repaint profiler --------
  // Event-level timing for mesh rebuild/repaint work. It stays dormant unless
  // the stats overlay is visible or ?repaint=1 / ?perf is set.
  let statsOverlay = null;
  let repaintProfileForce = twPerfEnabled;
  try {
    const params = new URLSearchParams(window.location.search);
    repaintProfileForce = repaintProfileForce || params.get('repaint') === '1';
  } catch (_) {}
  const REPAINT_PROFILE_WINDOW_MS = 1500;
  const REPAINT_PROFILE_TOP = 8;
  const repaintProfile = {
    buckets: new Map(),
    lastRows: [],
    lastReset: 0,
  };
  function repaintProfileActive() {
    return repaintProfileForce || !!statsOverlay;
  }
  function repaintProfileBegin() {
    if (!repaintProfileActive() || typeof performance === 'undefined' || !performance.now) return 0;
    return performance.now();
  }
  function repaintProfileAdd(label, ms, count = 1) {
    if (!repaintProfileActive() || !label || !(ms > 0)) return;
    let bucket = repaintProfile.buckets.get(label);
    if (!bucket) {
      bucket = { ms: 0, count: 0, max: 0 };
      repaintProfile.buckets.set(label, bucket);
    }
    bucket.ms += ms;
    bucket.count += count || 1;
    if (ms > bucket.max) bucket.max = ms;
  }
  function repaintProfileEnd(label, start, count = 1) {
    if (!start) return;
    repaintProfileAdd(label, performance.now() - start, count);
  }
  function repaintProfileBlock(label, fn, count = 1) {
    const start = repaintProfileBegin();
    try {
      return fn();
    } finally {
      repaintProfileEnd(label, start, count);
    }
  }
  function repaintProfileRowsFromBuckets(buckets) {
    return Array.from(buckets.entries())
      .sort((a, b) => b[1].ms - a[1].ms)
      .slice(0, REPAINT_PROFILE_TOP)
      .map(([label, bucket]) => ({
        label,
        ms: bucket.ms,
        count: bucket.count,
        avg: bucket.count ? bucket.ms / bucket.count : 0,
        max: bucket.max,
      }));
  }
  function repaintProfileSnapshot(now = performance.now(), rotateWindow = false) {
    if (!repaintProfile.lastReset) repaintProfile.lastReset = now;
    if (rotateWindow && now - repaintProfile.lastReset >= REPAINT_PROFILE_WINDOW_MS) {
      repaintProfile.lastRows = repaintProfileRowsFromBuckets(repaintProfile.buckets);
      repaintProfile.buckets.clear();
      repaintProfile.lastReset = now;
    }
    return {
      windowMs: REPAINT_PROFILE_WINDOW_MS,
      rows: repaintProfile.lastRows.length
        ? repaintProfile.lastRows.slice()
        : repaintProfileRowsFromBuckets(repaintProfile.buckets),
    };
  }
  function formatRepaintProfileLines(now) {
    if (!repaintProfileActive()) return '';
    const snap = repaintProfileSnapshot(now, true);
    if (!snap.rows.length) return 'repaint no rebuilds yet';
    const lines = ['repaint ' + (snap.windowMs / 1000).toFixed(1) + 's'];
    for (const row of snap.rows) {
      const label = row.label.length > 15 ? row.label.slice(0, 15) : row.label;
      lines.push(
        label.padEnd(15) + ' ' +
        row.ms.toFixed(1).padStart(6) + 'ms ' +
        String(row.count).padStart(3) + 'x ' +
        'avg ' + row.avg.toFixed(2).padStart(5)
      );
    }
    return lines.join('\n');
  }
  window.__tinyworldRepaintProfile = {
    setEnabled(value) {
      repaintProfileForce = !!value;
      if (repaintProfileForce) ensureStatsOverlay();
      return repaintProfileForce;
    },
    reset() {
      repaintProfile.buckets.clear();
      repaintProfile.lastRows = [];
      repaintProfile.lastReset = performance.now();
    },
    snapshot() {
      return repaintProfileSnapshot(performance.now(), false);
    },
  };

  // Disable auto-reset so we can read renderer.info totals, then reset once
  // per frame after the stats overlay samples them.
  renderer.info.autoReset = false;

  // -------- pixelation post-process --------
  // Mimics RenderPixelatedPass from r142+ without importing ES modules.
  // Scene renders to a low-res target with NearestFilter; a fullscreen quad
  // then samples colour + depth (+ optional normals) and inserts geometry
  // outlines. When pixelSize === 1 (or XR is presenting) we skip the post
  // pass entirely and render directly to the screen.
  const pixelState = {
    target: null,
    normalTarget: null,
    normalMaterial: null,
    quadScene: null,
    quadCam: null,
    quadMaterial: null,
    drawW: 0,
    drawH: 0,
    pixelSize: 0,
    wantNormals: false,
  };
  const renderBufferSizeVec = new THREE.Vector2();
  const PIXEL_ZOOM_MIN_RES_SCALE = 0.5;
  const PIXEL_ZOOM_MAX_RES_SCALE = 3.5;

  function disposePixelNormalResources() {
    if (pixelState.normalTarget) {
      pixelState.normalTarget.dispose();
      pixelState.normalTarget = null;
    }
    if (pixelState.normalMaterial) {
      pixelState.normalMaterial.dispose();
      pixelState.normalMaterial = null;
    }
  }

  function pixelZoomResolutionScale() {
    if (cameraMode === 'fp' || cameraMode === 'tp') return 1;
    const base = Math.max(0.001, DEFAULT_VIEW_SIZE);
    const zoomRatio = Math.max(0.05, viewSize / base);
    return Math.max(PIXEL_ZOOM_MIN_RES_SCALE, Math.min(PIXEL_ZOOM_MAX_RES_SCALE, Math.sqrt(zoomRatio)));
  }

  function effectivePixelSizeForZoom(pixelSize) {
    if (pixelSize <= 1) return 1;
    return Math.max(1, pixelSize / pixelZoomResolutionScale());
  }

  function ensurePixelResources(drawW, drawH, pixelSize, wantNormals, wantDepthEdge) {
    const targetW = Math.max(1, Math.floor(drawW / pixelSize));
    const targetH = Math.max(1, Math.floor(drawH / pixelSize));
    // The pixelation pass renders the scene to this low-res target and then
    // nearest-upscales it for the chunky look. Rendered with a single sample,
    // the dense voxel SILHOUETTES on the island sides alias and crawl into the
    // swimming diagonal "stripes" the user sees as the camera moves. MSAA
    // multisamples coverage so those edges resolve to smooth chunky pixels (the
    // NearestFilter upscale keeps the pixels crisp; surface texture/shader
    // detail is handled separately by mipmaps + fwidth AA). r128's multisample
    // target can't resolve a sampleable depth texture, and the depth-edge
    // outline option needs one — so fall back to the plain depth-texture target
    // only when depth edges are enabled (off by default).
    const canMSAA = !wantDepthEdge && !!(renderer.capabilities && renderer.capabilities.isWebGL2)
      && typeof THREE.WebGLMultisampleRenderTarget === 'function';
    const wantMode = canMSAA ? 'msaa' : 'depth';
    if (pixelState.target && pixelState.targetMode !== wantMode) {
      pixelState.target.dispose();
      pixelState.target = null;
    }
    if (!pixelState.target) {
      if (wantMode === 'msaa') {
        const t = new THREE.WebGLMultisampleRenderTarget(targetW, targetH, {
          minFilter: THREE.NearestFilter,
          magFilter: THREE.NearestFilter,
          format: THREE.RGBAFormat,
          depthBuffer: true,
        });
        const maxSamples = (renderer.capabilities && renderer.capabilities.maxSamples) || 4;
        t.samples = Math.max(2, Math.min(4, maxSamples));
        pixelState.target = t;
      } else {
        const depth = new THREE.DepthTexture(targetW, targetH);
        depth.format = THREE.DepthFormat;
        depth.type = THREE.UnsignedShortType;
        pixelState.target = new THREE.WebGLRenderTarget(targetW, targetH, {
          minFilter: THREE.NearestFilter,
          magFilter: THREE.NearestFilter,
          format: THREE.RGBAFormat,
          depthBuffer: true,
          depthTexture: depth,
        });
      }
      pixelState.targetMode = wantMode;
    } else if (pixelState.target.width !== targetW || pixelState.target.height !== targetH) {
      pixelState.target.setSize(targetW, targetH);
    }
    if (wantNormals) {
      if (!pixelState.normalTarget) {
        pixelState.normalTarget = new THREE.WebGLRenderTarget(targetW, targetH, {
          minFilter: THREE.NearestFilter,
          magFilter: THREE.NearestFilter,
          format: THREE.RGBAFormat,
        });
        pixelState.normalMaterial = new THREE.MeshNormalMaterial();
      } else if (pixelState.normalTarget.width !== targetW || pixelState.normalTarget.height !== targetH) {
        pixelState.normalTarget.setSize(targetW, targetH);
      }
    } else {
      disposePixelNormalResources();
    }
    if (!pixelState.quadScene) {
      pixelState.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      pixelState.quadMaterial = new THREE.ShaderMaterial({
        uniforms: {
          tColor: { value: null },
          tDepth: { value: null },
          tNormal: { value: null },
          resolution: { value: new THREE.Vector2(targetW, targetH) },
          depthEdgeStrength: { value: 0.0 },
          normalEdgeStrength: { value: 0.0 },
          antialiasStrength: { value: 0.0 },
          useNormals: { value: 0.0 },
        },
        vertexShader: [
          'varying vec2 vUv;',
          'void main() {',
          '  vUv = uv;',
          '  gl_Position = vec4(position.xy, 0.0, 1.0);',
          '}',
        ].join('\n'),
        fragmentShader: [
          'uniform sampler2D tColor;',
          'uniform sampler2D tDepth;',
          'uniform sampler2D tNormal;',
          'uniform vec2 resolution;',
          'uniform float depthEdgeStrength;',
          'uniform float normalEdgeStrength;',
          'uniform float antialiasStrength;',
          'uniform float useNormals;',
          'varying vec2 vUv;',
          'float readDepth(vec2 uv) { return texture2D(tDepth, uv).r; }',
          'vec3 readNormal(vec2 uv) { return normalize(texture2D(tNormal, uv).xyz * 2.0 - 1.0); }',
          'float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }',
          'vec3 antialiasColor(vec2 uv, vec2 texel, vec3 center, float edgeHint) {',
          '  if (antialiasStrength <= 0.001) return center;',
          '  vec3 cL = texture2D(tColor, uv - vec2(texel.x, 0.0)).rgb;',
          '  vec3 cR = texture2D(tColor, uv + vec2(texel.x, 0.0)).rgb;',
          '  vec3 cU = texture2D(tColor, uv - vec2(0.0, texel.y)).rgb;',
          '  vec3 cD = texture2D(tColor, uv + vec2(0.0, texel.y)).rgb;',
          '  vec3 cUL = texture2D(tColor, uv + vec2(-texel.x, -texel.y)).rgb;',
          '  vec3 cUR = texture2D(tColor, uv + vec2( texel.x, -texel.y)).rgb;',
          '  vec3 cDL = texture2D(tColor, uv + vec2(-texel.x,  texel.y)).rgb;',
          '  vec3 cDR = texture2D(tColor, uv + vec2( texel.x,  texel.y)).rgb;',
          '  float lC = luma(center);',
          '  float lo = min(lC, min(min(luma(cL), luma(cR)), min(luma(cU), luma(cD))));',
          '  float hi = max(lC, max(max(luma(cL), luma(cR)), max(luma(cU), luma(cD))));',
          '  float colorMask = smoothstep(0.035, 0.22, hi - lo);',
          '  float edgeMask = clamp(max(edgeHint, colorMask * 0.45) * antialiasStrength, 0.0, 0.86);',
          '  vec3 crossAvg = (center * 4.0 + cL + cR + cU + cD) * 0.125;',
          '  vec3 diagAvg = (cUL + cUR + cDL + cDR) * 0.25;',
          '  vec3 avg = mix(crossAvg, diagAvg, 0.18);',
          '  return mix(center, avg, edgeMask * 0.72);',
          '}',
          'float depthEdge(vec2 uv, vec2 texel) {',
          '  float d = readDepth(uv);',
          '  float dL = readDepth(uv - vec2(texel.x, 0.0));',
          '  float dR = readDepth(uv + vec2(texel.x, 0.0));',
          '  float dU = readDepth(uv - vec2(0.0, texel.y));',
          '  float dD = readDepth(uv + vec2(0.0, texel.y));',
          '  float diff = max(max(abs(d - dL), abs(d - dR)), max(abs(d - dU), abs(d - dD)));',
          '  return smoothstep(0.0008, 0.004, diff);',
          '}',
          'float normalEdge(vec2 uv, vec2 texel) {',
          '  vec3 n = readNormal(uv);',
          '  vec3 nL = readNormal(uv - vec2(texel.x, 0.0));',
          '  vec3 nR = readNormal(uv + vec2(texel.x, 0.0));',
          '  vec3 nU = readNormal(uv - vec2(0.0, texel.y));',
          '  vec3 nD = readNormal(uv + vec2(0.0, texel.y));',
          '  float dL = 1.0 - max(0.0, dot(n, nL));',
          '  float dR = 1.0 - max(0.0, dot(n, nR));',
          '  float dU = 1.0 - max(0.0, dot(n, nU));',
          '  float dD = 1.0 - max(0.0, dot(n, nD));',
          '  float diff = max(max(dL, dR), max(dU, dD));',
          '  return smoothstep(0.10, 0.40, diff);',
          '}',
          'void main() {',
          '  vec2 texel = 1.0 / resolution;',
          '  vec3 col = texture2D(tColor, vUv).rgb;',
          '  float deRaw = depthEdge(vUv, texel);',
          '  float neRaw = useNormals > 0.5 ? normalEdge(vUv, texel) : 0.0;',
          '  float edgeHint = clamp(max(deRaw, neRaw), 0.0, 1.0);',
          '  col = antialiasColor(vUv, texel, col, edgeHint);',
          '  float de = deRaw * depthEdgeStrength;',
          '  float ne = neRaw * normalEdgeStrength;',
          '  float edge = clamp(max(de, ne), 0.0, 1.0);',
          '  float edgeShade = mix(0.82, 0.62, clamp(max(depthEdgeStrength, normalEdgeStrength), 0.0, 1.0));',
          '  col = mix(col, col * edgeShade, edge * 0.72);',
          '  gl_FragColor = vec4(col, 1.0);',
          '  #include <encodings_fragment>',
          '}',
        ].join('\n'),
        depthTest: false,
        depthWrite: false,
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), pixelState.quadMaterial);
      pixelState.quadScene = new THREE.Scene();
      pixelState.quadScene.add(quad);
    }
    pixelState.quadMaterial.uniforms.resolution.value.set(targetW, targetH);
    pixelState.drawW = drawW;
    pixelState.drawH = drawH;
    pixelState.pixelSize = pixelSize;
    pixelState.wantNormals = wantNormals;
  }

  // -------- render culling --------
  // Three.js frustum-culls meshes, but it does not know our scene-level
  // occlusion rules: island top content is invisible from underneath, and
  // full island/cell roots should leave both the camera and shadow passes when
  // their board bounds are outside the active camera frustum.
  const renderCullFrustum = new THREE.Frustum();
  const renderCullMatrix = new THREE.Matrix4();
  const renderCullBox = new THREE.Box3();
  const renderCullIslandBox = new THREE.Box3();
  const renderCullMin = new THREE.Vector3();
  const renderCullMax = new THREE.Vector3();
  const renderCullWorldPos = new THREE.Vector3();
  // Per-frame ephemeral scratch for the cull loop's home-cell display point.
  // Read immediately into renderCullBoxVisible args; never retained.
  const renderCullCellScratch = new THREE.Vector3();
  const renderCullStats = { roots: 0, cells: 0, islands: 0, ghosts: 0, topHidden: 0 };
  const underOcclusionCloudWipe = document.getElementById('under-occlusion-cloud-wipe');
  let underOcclusionWipeOpacity = 0;
  let underOcclusionWipeActive = 0;
  let underOcclusionWipeDirection = 1;
  let underOcclusionWipeLastPhase = null;
  let underOcclusionWipeLastTime = 0;
  let renderSceneReady = false;

  function setRenderSceneReady(ready) {
    renderSceneReady = !!ready;
  }

  function renderSceneIfReady() {
    if (!renderSceneReady) return false;
    renderScene();
    return true;
  }

  // Shared async-load repaint callback: deduped across the texture loaders
  // in 04/09/24 (01 loads first, so the name is available to them).
  function repaintAfterTextureLoad() {
    if (typeof renderSceneIfReady === 'function') renderSceneIfReady();
  }

  function resetRenderCullStats() {
    renderCullStats.roots = 0;
    renderCullStats.cells = 0;
    renderCullStats.islands = 0;
    renderCullStats.ghosts = 0;
    renderCullStats.topHidden = 0;
  }

  function renderCullSmoothstep(edge0, edge1, value) {
    const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(0.0001, edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function renderCullTopContentOpacity(surfaceWorldY) {
    // Gradual fade: top content stays fully visible until the camera dips just
    // below the surface, then eases out over ~3.4 world units of further dip
    // before it stops rendering (opacity ~0). Wider window = slower, smoother.
    return renderCullSmoothstep(-2.85, 0.55, camera.position.y - surfaceWorldY);
  }

  function renderCullTopContentVisible(surfaceWorldY) {
    return renderCullTopContentOpacity(surfaceWorldY) > 0.001;
  }

  function topContentTransitionStrength(opacity) {
    const t = Math.max(0, Math.min(1, opacity));
    return Math.sin(t * Math.PI);
  }

  function updateUnderOcclusionCloudWipe(strength, phase) {
    if (!underOcclusionCloudWipe) return;
    const now = performance.now();
    const dt = underOcclusionWipeLastTime ? Math.min(0.08, Math.max(0.001, (now - underOcclusionWipeLastTime) / 1000)) : 0.016;
    underOcclusionWipeLastTime = now;
    const nextPhase = Math.max(0, Math.min(1, phase));
    const prevPhase = underOcclusionWipeLastPhase;
    if (prevPhase !== null) {
      const crossingDown = prevPhase < 0.42 && nextPhase >= 0.42;
      const crossingUp = prevPhase > 0.58 && nextPhase <= 0.58;
      if (strength > 0.20 && (crossingDown || crossingUp)) {
        underOcclusionWipeActive = 1;
        underOcclusionWipeDirection = crossingDown ? 1 : -1;
      }
    }
    underOcclusionWipeLastPhase = nextPhase;
    underOcclusionWipeActive = Math.max(0, underOcclusionWipeActive - dt * 1.15);
    const progress = 1 - underOcclusionWipeActive;
    const envelope = underOcclusionWipeActive > 0 ? Math.sin(progress * Math.PI) : 0;
    const target = Math.max(0, Math.min(0.72, envelope * Math.max(0.55, strength) * 0.72));
    underOcclusionWipeOpacity += (target - underOcclusionWipeOpacity) * 0.55;
    if (underOcclusionWipeOpacity < 0.01 && underOcclusionWipeActive <= 0) {
      underOcclusionWipeOpacity = 0;
      underOcclusionCloudWipe.style.opacity = '0';
      return;
    }
    const sweepProgress = underOcclusionWipeDirection > 0 ? progress : 1 - progress;
    const sweep = -64 + Math.max(0, Math.min(1, sweepProgress)) * 128;
    const bob = Math.sin(performance.now() * 0.0015 + azimuth) * 3.5;
    underOcclusionCloudWipe.style.opacity = underOcclusionWipeOpacity.toFixed(3);
    underOcclusionCloudWipe.style.transform = 'translate3d(' + sweep.toFixed(1) + 'vw, ' + bob.toFixed(1) + 'vh, 0) rotate(' + (-5 + polar * 2.4).toFixed(2) + 'deg)';
  }

  function renderCullBaseVisible(root) {
    if (!root) return false;
    const u = root.userData || {};
    if (u.currentOpacity !== undefined && u.fadeRole) {
      return displayOpacityForRole(root, u.currentOpacity, { ignoreRenderCull: true }) > 0.001;
    }
    if (u.renderCullActive && u.renderCullBaseVisible !== undefined) return !!u.renderCullBaseVisible;
    return root.visible !== false;
  }

  function setRenderCullVisible(root, visible, baseVisible) {
    if (!root) return;
    const u = root.userData || (root.userData = {});
    const base = baseVisible === undefined ? renderCullBaseVisible(root) : !!baseVisible;
    const nextVisible = base && !!visible;
    u.renderCullBaseVisible = base;
    u.renderCullActive = base && !visible;
    u.renderCullCulled = base && !visible;
    root.visible = nextVisible;
    if (u.renderCullCulled) renderCullStats.roots++;
  }

  function renderCullBoxVisible(minX, minY, minZ, maxX, maxY, maxZ, matrixWorld) {
    renderCullMin.set(minX, minY, minZ);
    renderCullMax.set(maxX, maxY, maxZ);
    renderCullBox.set(renderCullMin, renderCullMax);
    if (matrixWorld) renderCullBox.applyMatrix4(matrixWorld);
    return renderCullFrustum.intersectsBox(renderCullBox);
  }

  function renderCullBoardVisible(boardX, boardZ, matrixWorld) {
    const span = GRID * TILE;
    const half = span * 0.5;
    const pad = Math.max(1.25, span * 0.18);
    const x = (boardX || 0) * GRID * TILE;
    const z = (boardZ || 0) * GRID * TILE;
    const depth = Math.max(8, span * 0.80);
    const height = Math.max(10, span * 0.90);
    return renderCullBoxVisible(
      x - half - pad,
      -depth,
      z - half - pad,
      x + half + pad,
      height,
      z + half + pad,
      matrixWorld || worldGroup.matrixWorld,
    );
  }

  function setRenderCullOpacity(root, opacity) {
    if (!root || !root.userData || !root.userData.fadeRole) return;
    const next = Math.max(0, Math.min(1, opacity));
    const prev = root.userData.renderCullOpacity === undefined ? 1 : root.userData.renderCullOpacity;
    if (Math.abs(prev - next) < 0.001) return;
    if (next >= 0.999) delete root.userData.renderCullOpacity;
    else root.userData.renderCullOpacity = next;
    applyElementOpacity(root, root.userData.currentOpacity === undefined ? 1 : root.userData.currentOpacity);
  }

  function renderCullCellVisible(x, z, island) {
    const display = cellDisplayPointForCell(x, z, island, renderCullCellScratch);
    const cell = getWorldCell(x, z);
    const floors = Math.max(cell.floors || 1, cell.terrainFloors || 1);
    const radius = 0.92 + Math.max(0, floors - 1) * 0.10;
    const below = Math.max(1.1, DIRT_H + 1.1);
    const above = Math.max(2.4, floors * 0.86 + 1.25);
    return renderCullBoxVisible(
      display.x - radius,
      display.y - below,
      display.z - radius,
      display.x + radius,
      display.y + above,
      display.z + radius,
      xrWorldRoot.matrixWorld,
    );
  }

  function updateSceneVisibilityForCamera() {
    resetRenderCullStats();
    if (typeof worldGroup === 'undefined' || !worldGroup || typeof cellMeshes === 'undefined') return;
    // Non-forced: only dirty subtrees recompute their world matrices. Objects
    // with matrixAutoUpdate=false (selection hulls, XR reticle) set
    // matrixWorldNeedsUpdate themselves when they write .matrix directly.
    camera.updateMatrixWorld();
    scene.updateMatrixWorld();
    renderCullMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    renderCullFrustum.setFromProjectionMatrix(renderCullMatrix);

    worldGroup.getWorldPosition(renderCullWorldPos);
    const homeTopVisible = renderCullTopContentVisible(renderCullWorldPos.y);
    const homeTopOpacity = renderCullTopContentOpacity(renderCullWorldPos.y);
    let wipeStrength = topContentTransitionStrength(homeTopOpacity);
    let wipePhase = 1 - homeTopOpacity;
    const homeVisible = renderCullBoardVisible(0, 0);
    if (typeof homeBorderGroup !== 'undefined' && homeBorderGroup) setRenderCullVisible(homeBorderGroup, homeVisible, true);

    for (const key in cellMeshes) {
      const entry = cellMeshes[key];
      if (!entry) continue;
      const x = Number.isFinite(entry.x) ? entry.x : parseInt(key.split(',')[0], 10);
      const z = Number.isFinite(entry.z) ? entry.z : parseInt(key.split(',')[1], 10);
      if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
      const island = typeof editableIslandForWorldCell === 'function' ? editableIslandForWorldCell(x, z) : null;
      let topVisible = homeTopVisible;
      let topOpacity = homeTopOpacity;
      if (island && island.group) {
        island.group.getWorldPosition(renderCullWorldPos);
        topVisible = renderCullTopContentVisible(renderCullWorldPos.y);
        topOpacity = renderCullTopContentOpacity(renderCullWorldPos.y);
      }
      const transitionStrength = topContentTransitionStrength(topOpacity);
      if (transitionStrength > wipeStrength) {
        wipeStrength = transitionStrength;
        wipePhase = 1 - topOpacity;
      }
      if (topOpacity < 0.999) renderCullStats.topHidden++;
      const visible = renderCullCellVisible(x, z, island);
      if (!visible) renderCullStats.cells++;
      setRenderCullVisible(entry.tile, visible);
      // The plane currently being flown leaves its home cell's footprint; the
      // chase cam follows it off-board, so its cell would cull. Keep it shown.
      if (window.__flightActive && entry.object && entry.object === window.__flightJet) {
        setRenderCullOpacity(entry.object, 1);
        setRenderCullVisible(entry.object, true);
      } else {
        setRenderCullOpacity(entry.object, topOpacity);
        setRenderCullVisible(entry.object, visible && topVisible);
      }
      if (entry.extras) {
        for (const extra of entry.extras) {
          setRenderCullOpacity(extra, topOpacity);
          setRenderCullVisible(extra, visible && topVisible);
        }
      }
    }

    if (typeof ghostBoards !== 'undefined') {
      for (const board of ghostBoards.values()) {
        const bx = board.userData && board.userData.boardX || 0;
        const bz = board.userData && board.userData.boardZ || 0;
        const visible = renderCullBoardVisible(bx, bz);
        if (!visible) renderCullStats.ghosts++;
        setRenderCullVisible(board, visible, true);
      }
    }

    if (typeof editableIslands !== 'undefined') {
      const span = GRID * TILE;
      const half = span * 0.5;
      const pad = Math.max(1.25, span * 0.18);
      const depth = Math.max(8, span * 0.80);
      const height = Math.max(10, span * 0.90);
      renderCullBox.set(
        renderCullMin.set(-half - pad, -depth, -half - pad),
        renderCullMax.set( half + pad,  height,  half + pad),
      );
      for (const island of editableIslands) {
        if (!island || !island.group) continue;
        renderCullIslandBox.copy(renderCullBox).applyMatrix4(island.group.matrixWorld);
        const visible = renderCullFrustum.intersectsBox(renderCullIslandBox);
        const lod = island.lod || 'hidden';
        island.group.getWorldPosition(renderCullWorldPos);
        const topOpacity = renderCullTopContentOpacity(renderCullWorldPos.y);
        const transitionStrength = topContentTransitionStrength(topOpacity);
        if (transitionStrength > wipeStrength) {
          wipeStrength = transitionStrength;
          wipePhase = 1 - topOpacity;
        }
        if (!visible) renderCullStats.islands++;
        setRenderCullVisible(island.group, visible, lod !== 'hidden');
        setRenderCullVisible(island.baseGroup, visible && lod === 'full', lod === 'full');
        setRenderCullVisible(island.contentGroup, visible && lod === 'full', lod === 'full');
        setRenderCullVisible(island.proxyGroup, visible && lod === 'proxy', lod === 'proxy');
        if (topOpacity < 0.999 && lod === 'full') renderCullStats.topHidden++;
      }
    }
    // Group-cull the decorative distant-worlds ring. Its merged meshes have
    // frustumCulled=false (scene-spanning AABBs), so they otherwise submit every
    // frame even when the narrow home fov doesn't include them. Box-cull at the
    // group level instead (mirrors the editable-island cull above).
    if (typeof distantWorldGroup !== 'undefined' && distantWorldGroup) {
      const dwVisible = renderDistantWorlds &&
        renderCullBoxVisible(-44, -30, -44, 44, 40, 44, xrWorldRoot.matrixWorld);
      setRenderCullVisible(distantWorldGroup, dwVisible, renderDistantWorlds);
    }
    updateUnderOcclusionCloudWipe(wipeStrength, wipePhase);
  }

  let shadowUpdateCounter = 0;
  function requestShadowMapUpdate() {
    if (renderer && renderer.shadowMap) renderer.shadowMap.needsUpdate = true;
  }
  window.requestShadowMapUpdate = requestShadowMapUpdate;

  function renderScene() {
    renderer.info.reset();
    // Half-rate shadow refresh: swaying trees and moving vehicles keep their
    // shadows live at 30Hz, which is imperceptible, while the shadow pass
    // cost halves. The needsUpdate flag is consumed by the first render()
    // call below, so the normals/post passes never re-render shadows.
    if (++shadowUpdateCounter >= 2) {
      shadowUpdateCounter = 0;
      renderer.shadowMap.needsUpdate = true;
    }
    updateSceneVisibilityForCamera();
    const xrPresenting = renderer.xr && renderer.xr.isPresenting;
    const usePixelation = renderPixelSize > 1 && !xrPresenting;
    const useShaderAA = renderShaderAntialias > 0.001 && !xrPresenting;
    const usePost = usePixelation || useShaderAA;
    if (!usePost) {
      const renderStart = repaintProfileBegin();
      renderer.render(scene, camera);
      repaintProfileEnd('render.direct', renderStart);
      if (statsOverlay) sampleStats();
      return;
    }
    const size = renderer.getDrawingBufferSize(renderBufferSizeVec);
    const wantNormals = usePixelation && renderPixelNormalEdge > 0.001;
    const wantDepthEdge = usePixelation && renderPixelDepthEdge > 0.001;
    const postPixelSize = usePixelation ? effectivePixelSizeForZoom(renderPixelSize) : 1;
    const ensureStart = repaintProfileBegin();
    ensurePixelResources(size.x, size.y, postPixelSize, wantNormals, wantDepthEdge);
    repaintProfileEnd('post.ensure', ensureStart);
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(pixelState.target);
    renderer.clear();
    const sceneRenderStart = repaintProfileBegin();
    renderer.render(scene, camera);
    repaintProfileEnd('render.scene', sceneRenderStart);
    if (wantNormals && pixelState.normalTarget) {
      const prevOverride = scene.overrideMaterial;
      const prevBackground = scene.background;
      const prevFog = scene.fog;
      const prevSkyBubbleVisible = skyBubble ? skyBubble.visible : false;
      if (landscapeMeshEngine && landscapeMeshEngine._clipEnabled && landscapeMeshEngine._clipPlanes) {
        pixelState.normalMaterial.clippingPlanes = landscapeMeshEngine._clipPlanes;
      } else {
        pixelState.normalMaterial.clippingPlanes = null;
      }
      scene.overrideMaterial = pixelState.normalMaterial;
      scene.background = null;
      scene.fog = null;
      if (skyBubble) skyBubble.visible = false;
      renderer.setRenderTarget(pixelState.normalTarget);
      renderer.clear();
      const normalRenderStart = repaintProfileBegin();
      renderer.render(scene, camera);
      repaintProfileEnd('render.normals', normalRenderStart);
      scene.overrideMaterial = prevOverride;
      scene.background = prevBackground;
      scene.fog = prevFog;
      if (skyBubble) skyBubble.visible = prevSkyBubbleVisible;
      pixelState.normalMaterial.clippingPlanes = null;
    }
    const uniforms = pixelState.quadMaterial.uniforms;
    uniforms.tColor.value = pixelState.target.texture;
    // MSAA targets have no sampleable depth texture; depth edges are disabled in
    // that mode, so point the (unused) uniform at the colour texture as a dummy.
    uniforms.tDepth.value = pixelState.target.depthTexture || pixelState.target.texture;
    uniforms.tNormal.value = wantNormals && pixelState.normalTarget ? pixelState.normalTarget.texture : null;
    uniforms.depthEdgeStrength.value = usePixelation ? renderPixelDepthEdge : 0;
    uniforms.normalEdgeStrength.value = usePixelation ? renderPixelNormalEdge : 0;
    uniforms.antialiasStrength.value = useShaderAA ? renderShaderAntialias : 0;
    uniforms.useNormals.value = wantNormals && usePixelation ? 1.0 : 0.0;
    renderer.setRenderTarget(prevTarget);
    const postQuadStart = repaintProfileBegin();
    renderer.render(pixelState.quadScene, pixelState.quadCam);
    repaintProfileEnd('render.postQuad', postQuadStart);
    if (statsOverlay) sampleStats();
  }

  // -------- stats overlay --------
  // Toggle with backtick (`) or load with ?stats=1. Reads renderer.info to
  // show frame draw calls, triangles, geometries, programs, textures. Used
  // for measuring perf changes — keep zero cost when hidden.
  let statsFrameTimes = [];
  let statsLastSample = 0;
  let statsLastReport = 0;
  function ensureStatsOverlay() {
    if (statsOverlay) return statsOverlay;
    const el = document.createElement('div');
    el.id = 'stats-overlay';
    el.style.cssText = [
      'position:fixed','top:8px','right:8px','z-index:9999',
      'font:11px/1.35 ui-monospace,Menlo,monospace',
      'background:rgba(0,0,0,0.72)','color:#9be17a',
      'padding:6px 9px','border-radius:6px','pointer-events:none',
      'min-width:210px','white-space:pre','letter-spacing:0.02em',
    ].join(';');
    document.body.appendChild(el);
    statsOverlay = el;
    return el;
  }
  function removeStatsOverlay() {
    if (statsOverlay && statsOverlay.parentNode) statsOverlay.parentNode.removeChild(statsOverlay);
    statsOverlay = null;
  }
  function sampleStats() {
    const now = performance.now();
    if (statsLastSample) statsFrameTimes.push(now - statsLastSample);
    statsLastSample = now;
    if (statsFrameTimes.length > 60) statsFrameTimes.shift();
    if (now - statsLastReport < 250) return; // throttle DOM writes
    statsLastReport = now;
    const sum = statsFrameTimes.reduce((a, b) => a + b, 0);
    const avg = sum > 0 ? sum / statsFrameTimes.length : 0;
    const fps = avg > 0 ? (1000 / avg) : 0;
    const r = renderer.info.render;
    const m = renderer.info.memory;
    const programs = (renderer.info.programs && renderer.info.programs.length) || 0;
    const ghostQueue = (typeof pendingGhostBoards !== 'undefined') ? pendingGhostBoards.length : 0;
    const islandStats = (typeof editableIslandPerfStats === 'function') ? editableIslandPerfStats() : null;
    const cellMeshCount = Object.keys(cellMeshes).length;
    const repaintLines = formatRepaintProfileLines(now);
    statsOverlay.textContent =
      'fps     ' + fps.toFixed(1) + '\n' +
      'frame   ' + avg.toFixed(2) + 'ms\n' +
      'draws   ' + r.calls + '\n' +
      'tris    ' + r.triangles.toLocaleString() + '\n' +
      'geoms   ' + m.geometries + '\n' +
      'mats    ' + (typeof fadeMatCache !== 'undefined' ? fadeMatCache.size : '-') + '\n' +
      'progs   ' + programs + '\n' +
      'texs    ' + m.textures + '\n' +
      'culled  ' + (renderCullStats.roots || 0) +
        ' c' + (renderCullStats.cells || 0) +
        '/i' + (renderCullStats.islands || 0) +
        '/g' + (renderCullStats.ghosts || 0) +
        (renderCullStats.topHidden ? '/top' + renderCullStats.topHidden : '') + '\n' +
      'ghosts  ' + (typeof ghostBoards !== 'undefined' ? ghostBoards.size : 0) +
        (ghostQueue ? ' (+' + ghostQueue + ')' : '') + '\n' +
      'islands ' + (islandStats ? (islandStats.count + ' f' + islandStats.full + '/p' + islandStats.proxy + '/h' + islandStats.hidden + '/b' + islandStats.fullBudget) : '-') + '\n' +
      'cells   ' + cellMeshCount + (renderCullStats.cells ? ' v' + Math.max(0, cellMeshCount - renderCullStats.cells) : '') + '\n' +
      'crops   ' + (typeof cropPositions !== 'undefined' ? cropPositions.size : 0) + '\n' +
      'maxPump ' + (typeof maxPumpkinPositions !== 'undefined' ? maxPumpkinPositions.size : 0) +
      (repaintLines ? '\n\n' + repaintLines : '');
  }
  function toggleStatsOverlay() {
    if (statsOverlay) removeStatsOverlay();
    else ensureStatsOverlay();
  }
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('stats') === '1' || params.get('repaint') === '1') ensureStatsOverlay();
  } catch (_) {}
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
    if (e.key === '`' || e.key === '~') {
      e.preventDefault();
      toggleStatsOverlay();
    }
  });
