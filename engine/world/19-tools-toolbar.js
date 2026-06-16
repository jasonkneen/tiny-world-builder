  // -------- tools --------
  const TOOLS = [
    { id: 'auto',   label: 'Auto',   auto: true, color: '#3a72c8', shortcut: '0', group: 'tools', hidden: true },
    { id: 'select', label: 'Select', select: true, color: '#c8b06f', shortcut: 'v', group: 'tools' },
    { id: 'grass',  label: 'Grass',  terrain: 'grass', color: '#9ec74b', shortcut: '1', group: 'terrain' },
    { id: 'path',   label: 'Path',   terrain: 'path',  color: '#e8d5a8', shortcut: '2', group: 'terrain' },
    { id: 'dirt',   label: 'Dirt',   terrain: 'dirt',  color: '#5a3b27', shortcut: '3', group: 'terrain' },
    { id: 'water',  label: 'Water',  terrain: 'water', color: '#4a90c2', shortcut: '4', group: 'terrain' },
    { id: 'stone',  label: 'Stone',  terrain: 'stone', color: '#8f8a82', group: 'terrain' },
    { id: 'lava',   label: 'Lava',   terrain: 'lava',  color: '#e7592b', group: 'terrain' },
    { id: 'sand',   label: 'Sand',   terrain: 'sand',  color: '#e6cc7c', group: 'terrain' },
    { id: 'snow',   label: 'Snow',   terrain: 'snow',  color: '#f2f5fa', group: 'terrain' },
    { id: 'new-island', label: 'Island', island: true, color: '#73a853', group: 'build' },
    { id: 'house',  label: 'House',  kind: 'house', color: '#3a72c8', shortcut: '5', group: 'build',
      variants: [
        { id: 'cottage',    label: 'Cottage',   buildingType: 'cottage',    hint: 'force cottage style' },
        { id: 'manor',      label: 'Manor',     buildingType: 'manor',      hint: 'brick + portico' },
        { id: 'tower',      label: 'Tower',     buildingType: 'tower',      hint: 'stone tower w/ conical roof' },
        { id: 'turret',     label: 'Castle',    buildingType: 'turret',     hint: 'castle turret / keep' },
        { id: 'highrise',   label: 'High-rise', buildingType: 'skyscraper', hint: 'glass tower' },
      ],
    },
    { id: 'tree',   label: 'Tree',   kind: 'tree',  color: '#6fb442', shortcut: '6', group: 'nature' },
    { id: 'fence',  label: 'Fence',  kind: 'fence', color: '#8a5a3b', shortcut: '7', group: 'build',
      variants: [
        { id: 'wood', label: 'Wood', fenceStyle: 'wood', hint: 'plain timber rails' },
        { id: 'garden', label: 'Garden', fenceStyle: 'garden', hint: 'dark orchard fence with vine and fruit' },
      ],
    },
    { id: 'rock',   label: 'Rock',   kind: 'rock',  color: '#9b9a8f', shortcut: '8', group: 'nature' },
    // Action tool (not a paint brush): opens the Mesh Terrain sculptor. Handled in
    // the tool-button click via t.action; never becomes the active paint tool.
    { id: 'mesh-terrain', label: 'Mesh Terrain', action: 'mesh-terrain', color: '#7a9a4f', group: 'nature' },
    { id: 'bridge', label: 'Bridge', kind: 'bridge', terrainOverride: 'water', color: '#8b5a32', shortcut: '9', group: 'build' },
    { id: 'lamp-post', label: 'Lamp', kind: 'lamp-post', color: '#f0b45a', group: 'infra' },
    { id: 'spotlight', label: 'Spotlight', kind: 'spotlight', color: '#ffd280', group: 'infra' },
    { id: 'mooring', label: 'Connect', mooring: true, color: '#171b20', shortcut: 'm', group: 'infra' },
    { id: 'crop',      label: 'Crop',      kind: 'crop',      terrainOverride: 'dirt', color: '#86c544', shortcut: 'g', group: 'crops' },
    { id: 'corn',      label: 'Corn',      kind: 'corn',      terrainOverride: 'dirt', color: '#f2c849', shortcut: 'n', group: 'crops' },
    { id: 'wheat',     label: 'Wheat',     kind: 'wheat',     terrainOverride: 'dirt', color: '#e6c354', shortcut: 'w', group: 'crops' },
    { id: 'pumpkin',   label: 'Pumpkin',   kind: 'pumpkin',   terrainOverride: 'dirt', color: '#e07c2a', shortcut: 'u', group: 'crops' },
    { id: 'carrot',    label: 'Carrot',    kind: 'carrot',    terrainOverride: 'dirt', color: '#e06a2a', shortcut: 'a', group: 'crops' },
    { id: 'sunflower', label: 'Sunflower', kind: 'sunflower', terrainOverride: 'dirt', color: '#f7b730', shortcut: 's', group: 'crops' },
    { id: 'tuft',   label: 'Tuft',   kind: 'tuft',  color: '#86b53e', shortcut: 't', group: 'nature' },
    { id: 'flower', label: 'Flower', kind: 'flower', color: '#d24a4f', group: 'nature' },
    { id: 'bush',   label: 'Bush',   kind: 'bush',  color: '#6fa030', group: 'nature' },
    { id: 'cow',    label: 'Cow',    kind: 'cow',   color: '#f2eee0', group: 'animals' },
    { id: 'sheep',  label: 'Sheep',  kind: 'sheep', color: '#e8e2d2', group: 'animals' },
    { id: 'erase',  label: 'Erase',  erase: true, color: 'transparent', eraser: true, shortcut: 'e', group: 'tools' },
  ];

  const TOOL_GROUPS = [
    // TEMP-HIDDEN: 'mesh-terrain' removed from the Terrain flyout for now. Re-add it to restore the mesh build button.
    { id: 'terrain', label: 'Terrain', toolIds: ['grass', 'path', 'dirt', 'water', 'stone', 'lava', 'sand', 'snow', 'rock'], iconTool: 'grass' },
    { id: 'plants', label: 'Plants', toolIds: ['tree', 'tuft', 'flower', 'bush'], iconTool: 'tree' },
    { id: 'build', label: 'Build', toolIds: ['house', 'new-island'], iconTool: 'house' },
    { id: 'infra', label: 'Infra', toolIds: ['fence', 'bridge', 'lamp-post', 'spotlight', 'mooring'], iconTool: 'fence' },
    { id: 'farm', label: 'Farm', toolIds: ['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower'], iconTool: 'wheat' },
    { id: 'life', label: 'Life', toolIds: ['cow', 'sheep'], iconTool: 'cow' },
  ];

  // i18n: localize tool/variant/group labels at boot from a single point so
  // every downstream render site (toolbar buttons, flyouts, status, stamp
  // browser) picks up the active locale without per-site changes. tx() keeps
  // the hard-coded English when no translation key exists. Language switching
  // is reload-on-switch, so localizing once here is sufficient.
  if (typeof window !== 'undefined' && window.TWI18N) {
    TOOLS.forEach((tool) => {
      tool.label = tx('tool.' + tool.id, tool.label);
      if (Array.isArray(tool.variants)) {
        tool.variants.forEach((v) => {
          v.label = tx('toolVariant.' + v.id, v.label);
          if (v.hint) v.hint = tx('toolHint.' + v.id, v.hint);
        });
      }
    });
    TOOL_GROUPS.forEach((group) => {
      group.label = tx('group.' + group.id, group.label);
    });
  }

  function groupForTool(tool) {
    return TOOL_GROUPS.find(g => g.toolIds.includes(tool.id)) || null;
  }

  const DEFAULT_TOOL = TOOLS.find(t => t.id === 'select') || TOOLS.find(t => t.id === 'tree');
  let selectedTool = DEFAULT_TOOL; // start on Select — non-destructive default
  let autoBusy = false;
  const AUTO_BATCH_SIZE = 8;
  const AUTO_REFRESH_EVERY = 6;
  let autoSuggestionQueue = [];
  let autoPlacementsSinceRefresh = AUTO_REFRESH_EVERY;
  let autoSuggestionSnapshot = '';

  // -------- toolbar 3D thumbnails --------
  // Each tool button gets a mini 3D render of its object/terrain via a
  // shared off-DOM renderer. On hover the camera orbits in place; on leave
  // it eases back to the resting angle.
  const THUMB_BASE_ANGLE = Math.PI / 4;
  const THUMB_SIZE = 96;
  let thumbRenderer = null;
  const thumbScenes = new Map();      // toolId -> { scene, camera, canvas, ctx, angle, baseAngle, returning }
  const hoverThumbs = new Set();
  let thumbTickRAF = 0;
  let thumbTickLast = 0;
  const toolThumbBuildQueue = [];
  const toolThumbQueuedCanvases = new WeakSet();
  let toolThumbBuildQueueStarted = false;
  let toolThumbBuildQueueTimer = 0;

  // Cached thumbnail bitmaps. Once a tool's 3D render is produced we copy the
  // pixels into an offscreen canvas keyed by tool identity so the toolbar /
  // stamp builder cards can blit instead of running another scene build. The
  // cache is in-memory only — bust it when palette/season change via
  // invalidateThumbCache().
  const thumbBitmapCache = new Map(); // key -> HTMLCanvasElement
  // Registry of mounted toolbar canvases so we can repaint them on cache bust.
  const toolThumbCanvases = new Map(); // tool.id -> { tool, canvas }

  function thumbCacheKeyForTool(tool) {
    if (!tool) return '';
    if (tool.kind === 'model-stamp' && tool.modelStampId) return 'model-stamp:' + tool.modelStampId;
    if (tool.kind === 'voxel-build' && tool.voxelBuildId) return 'voxel-build:' + tool.voxelBuildId;
    const variantId = tool.activeVariant && tool.activeVariant.id ? tool.activeVariant.id : '';
    const baseId = tool.baseTool ? tool.baseTool.id : (tool.id || '');
    // buildVariantToolButton appends "-<variantId>" to tool.id; strip it so
    // toolbar variant buttons and stamp builder cards share cache entries.
    const suffix = '-' + variantId;
    const cleanBase = variantId && baseId.endsWith(suffix) ? baseId.slice(0, -suffix.length) : baseId;
    return cleanBase + (variantId ? ':' + variantId : '');
  }

  function storeThumbBitmap(key, sourceCanvas) {
    if (!key || !sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) return;
    const off = document.createElement('canvas');
    off.width = sourceCanvas.width;
    off.height = sourceCanvas.height;
    try {
      off.getContext('2d').drawImage(sourceCanvas, 0, 0);
      thumbBitmapCache.set(key, off);
    } catch (_) {}
  }

  function drawCachedThumb(canvas, key) {
    if (!canvas || !key) return false;
    const cached = thumbBitmapCache.get(key);
    if (!cached) return false;
    if (canvas.width !== cached.width || canvas.height !== cached.height) {
      canvas.width = cached.width;
      canvas.height = cached.height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cached, 0, 0);
    return true;
  }

  function invalidateThumbCache() {
    thumbBitmapCache.clear();
  }

  function scheduleToolThumbBuild(tool, canvas, opts = {}) {
    if (!tool || !canvas) return;
    // Register the canvas so cache-busts can repaint it later.
    if (tool.id) toolThumbCanvases.set(tool.id, { tool, canvas });
    // Cache hit: blit the bitmap and skip the 3D scene entirely.
    if (drawCachedThumb(canvas, thumbCacheKeyForTool(tool))) return;
    drawFallbackThumb(canvas, tool.label, tool.color || '#9b9a8f');
    if (toolThumbQueuedCanvases.has(canvas)) return;
    toolThumbQueuedCanvases.add(canvas);
    toolThumbBuildQueue.push({ tool, canvas });
    if (toolThumbBuildQueueStarted || opts.priority) {
      scheduleToolThumbBuildQueue(opts.priority ? 16 : 120);
    }
  }

  function scheduleToolThumbBuildQueue(delay = 64) {
    if (!toolThumbBuildQueueStarted && delay > 16) return;
    if (toolThumbBuildQueueTimer) return;
    toolThumbBuildQueueTimer = setTimeout(() => {
      toolThumbBuildQueueTimer = 0;
      requestAnimationFrame(drainToolThumbBuildQueue);
    }, delay);
  }

  function drainToolThumbBuildQueue() {
    if (!toolThumbBuildQueue.length) return;
    let built = 0;
    while (toolThumbBuildQueue.length && built < 1) {
      const item = toolThumbBuildQueue.shift();
      if (!item || !item.canvas || !item.canvas.isConnected) continue;
      toolThumbQueuedCanvases.delete(item.canvas);
      try {
        buildToolThumb(item.tool, item.canvas);
        twPerfMark('thumb:' + item.tool.id);
      } catch (err) {
        drawFallbackThumb(item.canvas, item.tool.label, item.tool.color || '#9b9a8f');
      }
      built++;
    }
    if (toolThumbBuildQueue.length) scheduleToolThumbBuildQueue(48);
  }

  function startToolThumbBuildQueue() {
    if (toolThumbBuildQueueStarted) return;
    toolThumbBuildQueueStarted = true;
    twPerfMark('thumb-queue:start');
    scheduleToolThumbBuildQueue(160);
  }

  function ensureThumbRenderer() {
    if (thumbRenderer) return thumbRenderer;
    thumbRenderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power',
    });
    thumbRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    thumbRenderer.setSize(THUMB_SIZE, THUMB_SIZE, false);
    thumbRenderer.outputEncoding = THREE.sRGBEncoding;
    return thumbRenderer;
  }

  function makeThumbObject(tool) {
    if (tool.island) return makeBlankIsland();
    const k = tool.kind;
    if (!k) return null;
    if (k === 'voxel-build') return makeVoxelBuildStamp(tool.voxelBuildId);
    if (k === 'model-stamp') return makeModelStamp(tool.modelStampId);
    if (k === 'tree')      return makeVoxelTree();
    if (k === 'rock')      return makeVoxelRock({ n: false, s: false, e: false, w: false }, 1, 0, 0);
    if (k === 'bridge')    return makeVoxelBridge('x');
    if (k === 'tuft')      return makeVoxelCropKind('tuft');
    if (k === 'crop')      return makeVoxelCropKind('crop');
    if (k === 'corn')      return makeVoxelCropKind('corn');
    if (k === 'wheat')     return makeVoxelCropKind('wheat');
    if (k === 'pumpkin')   return makeVoxelCropKind('pumpkin');
    if (k === 'carrot')    return makeVoxelCropKind('carrot');
    if (k === 'sunflower') return makeVoxelCropKind('sunflower');
    if (k === 'flower')    return makeVoxelCropKind('flower');
    if (k === 'bush')      return makeVoxelCropKind('bush');
    if (k === 'cow')       return makeVoxelAnimal('cow');
    if (k === 'sheep')     return makeVoxelAnimal('sheep');
    if (k === 'lamp-post' || k === 'spotlight') return makeVoxelLightSource(k);
    if (k === 'fence') {
      const v = tool.activeVariant;
      const level = Math.max(1, Math.min(MAX_FLOORS, (v && v.floors) || 1));
      const style = v && v.fenceStyle ? v.fenceStyle : 'wood';
      return makeVoxelFence('n', level, false, false, 'x', style);
    }
    if (k === 'house') {
      const v = tool.activeVariant;
      const bType = v && v.buildingType;
      if (bType === 'manor')      return makeVoxelManor(2);
      if (bType === 'tower')      return makeVoxelStoneTower(2);
      if (bType === 'turret')     return makeVoxelTurret(2, false);
      if (bType === 'skyscraper') return makeVoxelSkyscraper(4);
      return makeVoxelLinearHouse(1, 'z', 2);
    }
    return null;
  }

  function thumbTerrainFor(tool) {
    if (tool.terrain) return tool.terrain;
    if (tool.kind === 'bridge') return 'water';
    if (CROP_KINDS && CROP_KINDS.has && CROP_KINDS.has(tool.kind)) return 'dirt';
    return 'grass';
  }

  function buildToolThumb(tool, canvas) {
    if (!window.THREE) return null;
    // Cache hit: blit and skip the scene build entirely.
    const cacheKey = thumbCacheKeyForTool(tool);
    if (drawCachedThumb(canvas, cacheKey)) return null;
    ensureThumbRenderer();
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.30));
    const hemi = new THREE.HemisphereLight(0xffffff, 0xb39879, 0.42);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.18);
    sun.position.set(3, 6, 2);
    scene.add(sun);

    const tile = makeTile(thumbTerrainFor(tool), { path: {}, terrain: {} }, 0, 0, 1);
    scene.add(tile);

    const obj = makeThumbObject(tool);
    if (obj) {
      obj.position.y = TOP_H;
      scene.add(obj);
    }
    // Strip shadows — the thumb renderer has no shadow maps.
    scene.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

    // Buildings need variant-specific framing: the skyscraper/towers need a
    // taller frustum, but using that same crop for cottages leaves a lot of
    // empty air above the icon in the flyout.
    const houseType = tool.kind === 'house' && tool.activeVariant && tool.activeVariant.buildingType;
    let thumbFrame = { left: -1.3, right: 1.3, top: 1.3, bottom: -1.3, lookAtY: 0.4 };
    if (tool.kind === 'house') {
      if (houseType === 'skyscraper') {
        thumbFrame = { left: -1.7, right: 1.7, top: 2.6, bottom: -1.0, lookAtY: 1.0 };
      } else if (houseType === 'tower' || houseType === 'turret') {
        thumbFrame = { left: -1.58, right: 1.58, top: 2.15, bottom: -0.95, lookAtY: 0.85 };
      } else if (houseType === 'manor') {
        thumbFrame = { left: -1.48, right: 1.48, top: 1.9, bottom: -0.95, lookAtY: 0.68 };
      } else {
        thumbFrame = { left: -1.36, right: 1.36, top: 1.65, bottom: -0.95, lookAtY: 0.56 };
      }
    } else if (tool.island) {
      thumbFrame = { left: -2.15, right: 2.15, top: 1.62, bottom: -1.55, lookAtY: 0.12 };
    }
    const cam = new THREE.OrthographicCamera(
      thumbFrame.left, thumbFrame.right, thumbFrame.top, thumbFrame.bottom, 0.1, 30,
    );
    const r = 3.4;
    const lookY = thumbFrame.lookAtY ?? 0.4;
    cam.position.set(Math.cos(THUMB_BASE_ANGLE) * r, 2.4 + lookY, Math.sin(THUMB_BASE_ANGLE) * r);
    cam.lookAt(0, lookY, 0);
    thumbRenderer.setSize(THUMB_SIZE, THUMB_SIZE, false);
    thumbRenderer.render(scene, cam);
    const dpr = thumbRenderer.getPixelRatio();
    const w = THUMB_SIZE * dpr;
    const h = THUMB_SIZE * dpr;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(thumbRenderer.domElement, 0, 0, canvas.width, canvas.height);
    // Snapshot into the bitmap cache so future toolbar/palette mounts skip
    // the scene build, then drop the scene so it doesn't sit in memory.
    storeThumbBitmap(cacheKey, canvas);
    try { scene.traverse(o => safeDisposeGeometry(o.geometry)); } catch (_) {}
    return null;
  }

  // Legacy helper kept for the hover tick loop — it now does nothing because
  // scenes are disposed after the first render.
  function renderToolThumb(id) {
    const t = thumbScenes.get(id);
    if (!t || !thumbRenderer) return;
  }

  function drawFallbackThumb(canvas, label, color) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = THUMB_SIZE * dpr;
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size;
      canvas.height = size;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color || '#9b9a8f';
    ctx.fillRect(size * 0.18, size * 0.18, size * 0.64, size * 0.64);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 ' + Math.round(size * 0.32) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label || '?').charAt(0).toUpperCase(), size / 2, size / 2);
  }

  function startThumbHover(id) {
    const t = thumbScenes.get(id);
    if (!t) return;
    t.returning = false;
    hoverThumbs.add(id);
    if (!thumbTickRAF) {
      thumbTickLast = performance.now();
      thumbTickRAF = requestAnimationFrame(tickThumbs);
    }
  }

  function stopThumbHover(id) {
    const t = thumbScenes.get(id);
    if (!t) return;
    hoverThumbs.delete(id);
    // Keep ticking until the angle eases back to base.
    t.returning = true;
    if (!thumbTickRAF) {
      thumbTickLast = performance.now();
      thumbTickRAF = requestAnimationFrame(tickThumbs);
    }
  }

  function tickThumbs(now) {
    const dt = Math.min(0.05, (now - thumbTickLast) / 1000);
    thumbTickLast = now;
    let stillTicking = false;
    for (const [id, t] of thumbScenes) {
      if (hoverThumbs.has(id)) {
        t.angle += dt * 1.6;
        renderToolThumb(id);
        stillTicking = true;
      } else if (t.returning) {
        const target = t.baseAngle;
        const TAU = Math.PI * 2;
        let delta = ((target - t.angle) % TAU + TAU) % TAU;
        if (delta > Math.PI) delta -= TAU;
        const step = Math.sign(delta) * Math.min(Math.abs(delta), dt * 3.2);
        t.angle += step;
        if (Math.abs(delta) < 0.01) {
          t.angle = target;
          t.returning = false;
        } else {
          stillTicking = true;
        }
        renderToolThumb(id);
      }
    }
    if (stillTicking) {
      thumbTickRAF = requestAnimationFrame(tickThumbs);
    } else {
      thumbTickRAF = 0;
    }
  }

  function refreshToolThumb(toolId) {
    // Rebuild a thumb in place — used when a tool's active variant changes
    // so the house thumb shows the chosen building type, etc.
    const entry = toolThumbCanvases.get(toolId);
    if (!entry || !entry.canvas || !entry.canvas.isConnected) return;
    const tool = TOOLS.find(t => t.id === toolId) || entry.tool;
    if (!tool) return;
    // Invalidate just this cache key so the next build re-renders.
    thumbBitmapCache.delete(thumbCacheKeyForTool(tool));
    try { buildToolThumb(tool, entry.canvas); }
    catch (_) { drawFallbackThumb(entry.canvas, tool.label, tool.color || '#9b9a8f'); }
  }

  let voxelStampRefreshTimer = 0;
  let selectedVoxelBuildId = VOXEL_BUILD_STAMPS[0] && VOXEL_BUILD_STAMPS[0].id;
  let selectedAssetTemplateId = null;
  const stampBuilderThumbQueue = [];
  const stampBuilderThumbQueuedCanvases = new WeakSet();
  let stampBuilderThumbQueueTimer = 0;
  let stampBuilderThumbQueueRunId = 0;
  const STAMP_BUILDER_RECENT_LS = 'tinyworld:stamp-builder-recent.v1';
  const STAMP_BUILDER_RECENT_MAX = 12;
  const STAMP_BUILDER_CATEGORY_DEFS = [
    { id: 'all', label: 'All' },
    { id: 'recent', label: 'Recent' },
    { id: 'templates', label: 'Templates' },
    { id: 'models', label: 'Models' },
    { id: 'voxel', label: 'Voxel' },
    { id: 'build', label: 'Build' },
    { id: 'infra', label: 'Infra' },
    { id: 'plants', label: 'Plants' },
    { id: 'farm', label: 'Farm' },
    { id: 'life', label: 'Life' },
    { id: 'terrain', label: 'Terrain' },
    { id: 'vehicles', label: 'Vehicles' },
    { id: 'detected', label: 'Detected' },
    { id: 'other', label: 'Other' },
  ];
  const STAMP_BUILDER_CATEGORY_IDS = new Set(STAMP_BUILDER_CATEGORY_DEFS.map(c => c.id));
  let activeStampBuilderCategory = 'all';

  function rebuildVoxelStampRender() {
    for (const key in cellMeshes) {
      const parts = key.split(',');
      const x = parseInt(parts[0], 10);
      const z = parseInt(parts[1], 10);
      if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
      renderCellObject(x, z, { animate: false, impactDust: false });
      renderCellExtras(x, z);
    }
    if (typeof rebuildExistingGhostBoards === 'function') rebuildExistingGhostBoards();
    invalidateThumbCache();
    for (const id of Array.from(toolThumbCanvases.keys())) refreshToolThumb(id);
    refreshOpenStampBuilderCards();
  }

  function scheduleVoxelStampRefresh() {
    if (voxelStampRefreshTimer) clearTimeout(voxelStampRefreshTimer);
    voxelStampRefreshTimer = setTimeout(() => {
      voxelStampRefreshTimer = 0;
      rebuildVoxelStampRender();
    }, 80);
  }

  function stampBuilderSearchQuery() {
    const input = document.getElementById('stamp-builder-search');
    return input ? String(input.value || '').trim().toLowerCase() : '';
  }

  function stampBuilderCategoryDef(id) {
    return STAMP_BUILDER_CATEGORY_DEFS.find(c => c.id === id) || STAMP_BUILDER_CATEGORY_DEFS[0];
  }

  function stampBuilderCategoryLabel(id) {
    return stampBuilderCategoryDef(id).label;
  }

  function loadRecentStampKeys() {
    try {
      const raw = JSON.parse(localStorage.getItem(STAMP_BUILDER_RECENT_LS) || '[]');
      return Array.isArray(raw) ? raw.filter(key => typeof key === 'string' && key) : [];
    } catch (_) {
      return [];
    }
  }

  function saveRecentStampKeys(keys) {
    try {
      localStorage.setItem(STAMP_BUILDER_RECENT_LS, JSON.stringify((keys || []).filter(Boolean).slice(0, STAMP_BUILDER_RECENT_MAX)));
    } catch (_) {}
  }

  function rememberRecentStampTool(tool) {
    const key = stampBuilderSelectionKey(tool);
    if (!key) return;
    const keys = loadRecentStampKeys().filter(item => item !== key);
    keys.unshift(key);
    saveRecentStampKeys(keys);
  }

  function removeRecentStampKey(key) {
    if (!key) return;
    const keys = loadRecentStampKeys().filter(item => item !== key);
    saveRecentStampKeys(keys);
  }

  function canRememberRecentStampTool(tool) {
    if (!tool || tool.select || tool.erase || tool.auto || tool.hidden) return false;
    if (tool.assetTemplateId || tool.modelStampId || tool.voxelBuildId) return true;
    return !!(tool.terrain || tool.kind);
  }

  function rememberSelectedStampTool(tool) {
    if (canRememberRecentStampTool(tool)) rememberRecentStampTool(tool);
  }

  function normalizeStampBuilderCategory(id) {
    return STAMP_BUILDER_CATEGORY_IDS.has(id) ? id : 'all';
  }

  function stampBuilderSemanticCategories(text) {
    const value = String(text || '').toLowerCase();
    const cats = new Set();
    const rules = [
      ['vehicles', /(^|[^a-z0-9])(plane|aircraft|airplane|stunt|crop[-_ ]?duster|jet|boat|boats|voxelboats?|ship|ships|vessel|car|cars|truck|trucks|train|trains|vehicle|vehicles|bus|buses|bike|bikes)(?=[^a-z0-9]|$)/],
      ['farm', /(^|[^a-z0-9])(crop|farm|corn|wheat|pumpkin|carrot|sunflower|field|barn)(?=[^a-z0-9]|$)/],
      ['build', /(^|[^a-z0-9])(building|buildings|city|house|tower|cottage|villa|skyscraper|castle|turret|manor|pagoda|temple|gate|machiya|hut|cabin)(?=[^a-z0-9]|$)/],
      ['infra', /(^|[^a-z0-9])(fence|bridge|road|rail|path|street|wall|boundary|dock|pier|lamp|lamps|light|lights|spotlight|spotlights|lantern)(?=[^a-z0-9]|$)/],
      ['plants', /(^|[^a-z0-9])(tree|plant|flower|bush|tuft|grass|garden|bamboo|cherry|shrub|forest|leaf|leaves)(?=[^a-z0-9]|$)/],
      ['life', /(^|[^a-z0-9])(cow|sheep|animal|person|people|human|crowd|character|horse)(?=[^a-z0-9]|$)/],
      ['terrain', /(^|[^a-z0-9])(rock|stone|terrain|mountain|outcrop|sand|snow|water|lava|dirt)(?=[^a-z0-9]|$)/],
    ];
    for (const [id, pattern] of rules) {
      if (pattern.test(value)) cats.add(id);
    }
    return cats;
  }

  function stampBuilderCategoryList(categories, fallback) {
    const out = [];
    for (const id of categories || []) {
      if (id !== 'all' && STAMP_BUILDER_CATEGORY_IDS.has(id) && !out.includes(id)) out.push(id);
    }
    if (!out.length && fallback) out.push(fallback);
    return out;
  }

  function stampBuilderCategoriesForBuiltIn(tool) {
    const categories = new Set();
    const baseTool = tool && tool.baseTool ? tool.baseTool : tool;
    const group = baseTool && groupForTool(baseTool);
    if (group && STAMP_BUILDER_CATEGORY_IDS.has(group.id)) categories.add(group.id);
    const variant = tool && tool.activeVariant;
    const text = [
      tool && tool.label,
      tool && tool.id,
      tool && tool.kind,
      variant && variant.label,
      variant && variant.hint,
    ].filter(Boolean).join(' ');
    stampBuilderSemanticCategories(text).forEach(id => categories.add(id));
    return stampBuilderCategoryList(categories, 'other');
  }

  function stampBuilderCategoriesForVoxelStamp(stamp) {
    const categories = new Set(['voxel']);
    const text = [stamp && stamp.name, stamp && stamp.id].filter(Boolean).join(' ');
    stampBuilderSemanticCategories(text).forEach(id => categories.add(id));
    return stampBuilderCategoryList(categories, 'voxel');
  }

  function stampBuilderCategoriesForModelAsset(asset) {
    const categories = new Set(['models']);
    if (asset && asset.supported === false) categories.add('detected');
    const sidecars = [];
    const rawSidecars = asset && asset.sidecars;
    if (rawSidecars && Array.isArray(rawSidecars.textures)) sidecars.push(...rawSidecars.textures);
    if (rawSidecars && Array.isArray(rawSidecars.mtl)) sidecars.push(...rawSidecars.mtl);
    const text = [
      asset && asset.label,
      asset && asset.id,
      asset && asset.path,
      asset && asset.url,
      asset && asset.format,
      sidecars.map(item => [item.name, item.path, item.format].filter(Boolean).join(' ')).join(' '),
    ].filter(Boolean).join(' ');
    stampBuilderSemanticCategories(text).forEach(id => categories.add(id));
    return stampBuilderCategoryList(categories, 'models');
  }

  function normalizedAssetTemplateTool(template, index) {
    const clipboard = normalizeClipboardPayload(template && template.clipboard);
    if (!clipboard) return null;
    const id = (typeof template.id === 'string' && template.id) ? template.id : 'template-' + index;
    return {
      id: 'asset-template:' + id,
      label: template.name || 'Template ' + (index + 1),
      kind: 'asset-template',
      assetTemplateId: id,
      assetTemplate: {
        id,
        name: template.name || 'Template ' + (index + 1),
        createdAt: Number(template.createdAt) || 0,
        clipboard,
      },
      isAssetTemplate: true,
      color: '#c98f54',
      stampCategories: ['templates'],
    };
  }

  function assetTemplateTools() {
    return loadAssetTemplates()
      .map(normalizedAssetTemplateTool)
      .filter(Boolean);
  }

  function assetTemplateById(id) {
    const match = assetTemplateTools().find(tool => tool.assetTemplateId === id);
    return match ? match.assetTemplate : null;
  }

  function deleteAssetTemplate(id) {
    if (!id) return false;
    const templates = loadAssetTemplates();
    let removed = null;
    const next = [];
    templates.forEach((template, index) => {
      const normalized = normalizedAssetTemplateTool(template, index);
      const templateId = normalized && normalized.assetTemplateId
        ? normalized.assetTemplateId
        : ((template && typeof template.id === 'string' && template.id) ? template.id : 'template-' + index);
      if (templateId === id) {
        removed = (normalized && normalized.assetTemplate) || template;
      } else {
        next.push(template);
      }
    });
    if (!removed) return false;
    saveAssetTemplates(next);
    if (selectedAssetTemplateId === id) selectedAssetTemplateId = null;
    if (selectedTool && selectedTool.kind === 'asset-template' && selectedTool.assetTemplateId === id) {
      selectTool(DEFAULT_TOOL);
    }
    removeRecentStampKey('asset-template:' + id);
    renderStampBuilderCards();
    const status = document.getElementById('stamp-builder-status');
    if (status) status.textContent = 'Deleted template: ' + (removed.name || id);
    return true;
  }

  function assetTemplateSearchText(tool) {
    const template = tool && tool.assetTemplate;
    const cells = template && template.clipboard ? normalizeClipboardCells(template.clipboard.cells) : [];
    return cells.map(item => {
      const cell = item.cell || {};
      const extras = Array.isArray(cell.extras) ? cell.extras.map(extra => extra && extra.kind).join(' ') : '';
      return [cell.terrain, cell.kind, cell.buildingType, cell.fenceSide, extras].filter(Boolean).join(' ');
    }).join(' ');
  }

  function renderAssetTemplateThumb(tool, canvas) {
    const template = tool && tool.assetTemplate;
    const cells = template && template.clipboard ? normalizeClipboardCells(template.clipboard.cells) : [];
    if (!cells.length) {
      drawFallbackThumb(canvas, tool && tool.label, tool && tool.color || '#c98f54');
      return;
    }
    const terrainColors = {
      grass: '#6f9e30',
      path: '#d7b77d',
      dirt: '#a56c45',
      water: '#66add6',
      stone: '#a9adb3',
      lava: '#e55b29',
      sand: '#e4cf8a',
      snow: '#edf3f4',
    };
    const kindColors = {
      house: '#c77446',
      tree: '#3f8b4c',
      rock: '#747b82',
      bridge: '#8f613c',
      fence: '#9b7049',
      crop: '#d2ab36',
      corn: '#d8bb35',
      wheat: '#d9b964',
      pumpkin: '#dd782d',
      carrot: '#df7b31',
      sunflower: '#e5bf36',
      flower: '#d2668f',
      bush: '#507d48',
      cow: '#4c5156',
      sheep: '#e8e0cf',
      'model-stamp': '#7fa0b8',
      'voxel-build': '#8f80c7',
    };
    const size = template.clipboard.size || {};
    const sizeX = Math.max(1, Number(size.x) || Math.max(...cells.map(c => c.dx)) + 1);
    const sizeZ = Math.max(1, Number(size.z) || Math.max(...cells.map(c => c.dz)) + 1);
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = THUMB_SIZE * dpr;
    canvas.height = THUMB_SIZE * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, THUMB_SIZE, THUMB_SIZE);
    ctx.fillStyle = '#f7edda';
    ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);
    const pad = 13;
    const gap = 2;
    const cellSize = Math.max(2, Math.min((THUMB_SIZE - pad * 2 - gap * (sizeX - 1)) / sizeX, (THUMB_SIZE - pad * 2 - gap * (sizeZ - 1)) / sizeZ));
    const totalW = sizeX * cellSize + Math.max(0, sizeX - 1) * gap;
    const totalH = sizeZ * cellSize + Math.max(0, sizeZ - 1) * gap;
    const startX = (THUMB_SIZE - totalW) / 2;
    const startY = (THUMB_SIZE - totalH) / 2;
    ctx.lineWidth = 1.25;
    for (const item of cells) {
      const cell = item.cell || {};
      const x = startX + item.dx * (cellSize + gap);
      const y = startY + item.dz * (cellSize + gap);
      ctx.fillStyle = terrainColors[cell.terrain] || terrainColors.grass;
      ctx.fillRect(x, y, cellSize, cellSize);
      ctx.strokeStyle = 'rgba(76, 61, 39, 0.18)';
      ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
      if (cell.kind) {
        ctx.fillStyle = kindColors[cell.kind] || '#8d6b4d';
        const inset = Math.max(3, cellSize * 0.22);
        ctx.fillRect(x + inset, y + inset, cellSize - inset * 2, cellSize - inset * 2);
      }
      if (Array.isArray(cell.extras) && cell.extras.length) {
        ctx.fillStyle = 'rgba(62, 47, 31, 0.54)';
        ctx.fillRect(x + 2, y + cellSize - 4, Math.max(3, cellSize - 4), 2);
      }
    }
  }

  function stampBuilderToolSearchText(tool) {
    const variant = tool && tool.activeVariant;
    const asset = tool && (tool.modelAsset || getModelStamp(tool.modelStampId));
    const stamp = tool && (tool.voxelStamp || getVoxelBuildStamp(tool.voxelBuildId));
    const templateText = tool && tool.isAssetTemplate ? assetTemplateSearchText(tool) : '';
    const categories = (tool && tool.stampCategories ? tool.stampCategories : [])
      .map(id => stampBuilderCategoryLabel(id))
      .join(' ');
    return [
      tool && tool.label,
      tool && tool.id,
      tool && tool.kind,
      categories,
      variant && variant.label,
      variant && variant.hint,
      asset && asset.format,
      asset && asset.path,
      asset && asset.url,
      stamp && stamp.name,
      stamp && stamp.id,
      templateText,
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function stampBuilderToolMatchesSearch(tool, q) {
    if (!q) return true;
    const text = stampBuilderToolSearchText(tool);
    return q.split(/\s+/).filter(Boolean).every(part => text.includes(part));
  }

  function stampBuilderToolMatchesCategory(tool, category) {
    if (category === 'all') return true;
    return !!(tool && tool.stampCategories && tool.stampCategories.includes(category));
  }

  function stampBuilderAllTools() {
    const tools = [];
    tools.push(...assetTemplateTools());
    for (const asset of MODEL_STAMP_ASSETS) {
      tools.push({
        id: 'model-stamp:' + asset.id,
        label: asset.label,
        kind: 'model-stamp',
        modelStampId: asset.id,
        modelAsset: asset,
        isModelStamp: true,
        supported: asset.supported,
        color: '#8aa4b8',
        stampCategories: stampBuilderCategoriesForModelAsset(asset),
      });
    }
    for (const stamp of VOXEL_BUILD_STAMPS) {
      tools.push({
        id: 'voxel-build:' + stamp.id,
        label: stamp.name,
        kind: 'voxel-build',
        voxelBuildId: stamp.id,
        voxelStamp: stamp,
        isVoxelBuild: true,
        stampCategories: stampBuilderCategoriesForVoxelStamp(stamp),
      });
    }
    const ids = [
      'grass', 'path', 'dirt', 'water', 'stone', 'lava', 'sand', 'snow',
      'house', 'tree', 'rock', 'bridge', 'fence', 'lamp-post', 'spotlight',
      'crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower',
      'tuft', 'flower', 'bush', 'cow', 'sheep',
    ];
    for (const id of ids) {
      const tool = TOOLS.find(t => t.id === id);
      if (!tool) continue;
      if (tool.variants && tool.variants.length) {
        for (const variant of tool.variants) {
          const stampTool = Object.assign({}, tool, {
            id: tool.id + ':' + variant.id,
            label: variant.label,
            activeVariant: variant,
            baseTool: tool,
            isBuiltInStamp: true,
          });
          stampTool.stampCategories = stampBuilderCategoriesForBuiltIn(stampTool);
          tools.push(stampTool);
        }
      } else {
        const stampTool = Object.assign({}, tool, { isBuiltInStamp: true });
        stampTool.stampCategories = stampBuilderCategoriesForBuiltIn(stampTool);
        tools.push(stampTool);
      }
    }
    return applyRecentStampCategories(tools);
  }

  function applyRecentStampCategories(tools) {
    const recentKeys = loadRecentStampKeys();
    if (!recentKeys.length) return tools;
    const recentIndex = new Map(recentKeys.map((key, index) => [key, index]));
    tools.forEach(tool => {
      const key = stampBuilderSelectionKey(tool);
      if (!recentIndex.has(key)) return;
      const categories = new Set(tool.stampCategories || []);
      categories.add('recent');
      tool.stampCategories = stampBuilderCategoryList(categories, null);
      tool.recentStampIndex = recentIndex.get(key);
    });
    return tools;
  }

  function stampBuilderTools(sourceTools) {
    const tools = Array.isArray(sourceTools) ? sourceTools : stampBuilderAllTools();
    const q = stampBuilderSearchQuery();
    const category = normalizeStampBuilderCategory(activeStampBuilderCategory);
    if (category !== activeStampBuilderCategory) activeStampBuilderCategory = category;
    const filtered = tools.filter(tool => {
      return stampBuilderToolMatchesCategory(tool, category) && stampBuilderToolMatchesSearch(tool, q);
    });
    if (category === 'recent') {
      filtered.sort((a, b) => (a.recentStampIndex ?? 9999) - (b.recentStampIndex ?? 9999));
    }
    return filtered;
  }

  function renderStampBuilderCategoryStrip(sourceTools) {
    const strip = document.getElementById('stamp-builder-categories');
    if (!strip) return;
    const tools = Array.isArray(sourceTools) ? sourceTools : stampBuilderAllTools();
    const q = stampBuilderSearchQuery();
    const counts = { all: 0 };
    for (const tool of tools) {
      if (!stampBuilderToolMatchesSearch(tool, q)) continue;
      counts.all++;
      for (const id of tool.stampCategories || []) {
        counts[id] = (counts[id] || 0) + 1;
      }
    }
    const active = normalizeStampBuilderCategory(activeStampBuilderCategory);
    activeStampBuilderCategory = active;
    strip.innerHTML = '';
    for (const def of STAMP_BUILDER_CATEGORY_DEFS) {
      const count = counts[def.id] || 0;
      if (def.id !== 'all' && !count && def.id !== active) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'stamp-category-btn' + (def.id === active ? ' active' : '');
      btn.dataset.category = def.id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', def.id === active ? 'true' : 'false');
      btn.setAttribute('aria-pressed', def.id === active ? 'true' : 'false');
      btn.textContent = def.label;
      const countEl = document.createElement('span');
      countEl.className = 'stamp-category-count';
      countEl.textContent = String(count);
      btn.appendChild(countEl);
      btn.addEventListener('click', () => {
        activeStampBuilderCategory = def.id;
        renderStampBuilderCards();
        const status = document.getElementById('stamp-builder-status');
        const shown = stampBuilderTools().length;
        const scope = def.id === 'all' ? '' : ' in ' + def.label.toLowerCase();
        if (status) status.textContent = 'Showing ' + shown + ' stamp' + (shown === 1 ? '' : 's') + scope;
      });
      strip.appendChild(btn);
    }
  }

  function renderStampBuilderThumb(tool, canvas) {
    if (tool && tool.isAssetTemplate) {
      renderAssetTemplateThumb(tool, canvas);
      return;
    }
    // Cache hit: blit and skip the 3D scene build. Cards on this panel re-mount
    // on every state change, so caching is the dominant win.
    const cacheKey = thumbCacheKeyForTool(tool);
    // Use a stamp-builder-specific prefix because the panel renders with a
    // wider frustum / different lookY than the toolbar — sharing pixels would
    // crop them. They share invalidation via the same cache map.
    const panelKey = cacheKey ? 'panel:' + cacheKey : '';
    if (drawCachedThumb(canvas, panelKey)) return;
    ensureThumbRenderer();
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.24));
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb39879, 0.38));
    const sun = new THREE.DirectionalLight(0xffffff, 0.94);
    sun.position.set(3, 6, 2);
    scene.add(sun);
    const tile = makeTile(thumbTerrainFor(tool), { path: {}, terrain: {} }, 0, 0, 1);
    scene.add(tile);
    const obj = makeThumbObject(tool);
    if (obj) {
      obj.position.y = TOP_H;
      scene.add(obj);
    }
    scene.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    const stamp = tool.voxelBuildId && getVoxelBuildStamp(tool.voxelBuildId);
    const isModel = tool.kind === 'model-stamp';
    const isBlankIsland = !!tool.island;
    const top = stamp ? 3.2 : (isModel ? 2.05 : (isBlankIsland ? 1.62 : 1.85));
    const bottom = stamp ? -1.05 : (isBlankIsland ? -1.55 : -0.95);
    const side = stamp ? 2.25 : (isModel ? 1.62 : (isBlankIsland ? 2.15 : 1.45));
    const lookY = stamp ? 1.15 : (isModel ? 0.70 : (isBlankIsland ? 0.12 : 0.55));
    const cam = new THREE.OrthographicCamera(-side, side, top, bottom, 0.1, 30);
    cam.position.set(Math.cos(THUMB_BASE_ANGLE) * 4.4, 3.3 + lookY, Math.sin(THUMB_BASE_ANGLE) * 4.4);
    cam.lookAt(0, lookY, 0);
    thumbRenderer.setSize(THUMB_SIZE, THUMB_SIZE, false);
    thumbRenderer.render(scene, cam);
    const dpr = thumbRenderer.getPixelRatio();
    canvas.width = THUMB_SIZE * dpr;
    canvas.height = THUMB_SIZE * dpr;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(thumbRenderer.domElement, 0, 0, canvas.width, canvas.height);
    storeThumbBitmap(panelKey, canvas);
    scene.traverse(o => safeDisposeGeometry(o.geometry));
  }

  function cancelStampBuilderThumbQueue() {
    stampBuilderThumbQueueRunId++;
    stampBuilderThumbQueue.length = 0;
    if (stampBuilderThumbQueueTimer) {
      clearTimeout(stampBuilderThumbQueueTimer);
      stampBuilderThumbQueueTimer = 0;
    }
  }

  function scheduleStampBuilderThumbQueue(delay = 0) {
    if (stampBuilderThumbQueueTimer) return;
    stampBuilderThumbQueueTimer = setTimeout(() => {
      stampBuilderThumbQueueTimer = 0;
      requestAnimationFrame(drainStampBuilderThumbQueue);
    }, delay);
  }

  function drainStampBuilderThumbQueue() {
    if (!stampBuilderThumbQueue.length) return;
    const start = performance.now();
    let built = 0;
    while (stampBuilderThumbQueue.length && built < 2 && performance.now() - start < 12) {
      const item = stampBuilderThumbQueue.shift();
      if (!item || item.runId !== stampBuilderThumbQueueRunId) continue;
      if (!item.canvas || !item.canvas.isConnected) continue;
      stampBuilderThumbQueuedCanvases.delete(item.canvas);
      if (item.canvas.dataset.stampKey !== item.key) continue;
      try {
        renderStampBuilderThumb(item.tool, item.canvas);
      } catch (_) {
        drawFallbackThumb(item.canvas, item.tool && item.tool.label, item.tool && item.tool.color || '#9b9a8f');
      }
      built++;
    }
    if (stampBuilderThumbQueue.length) scheduleStampBuilderThumbQueue(32);
  }

  function scheduleStampBuilderThumb(tool, canvas, key) {
    if (!tool || !canvas) return;
    const cacheKey = thumbCacheKeyForTool(tool);
    const panelKey = cacheKey ? 'panel:' + cacheKey : '';
    if (!tool.isAssetTemplate && drawCachedThumb(canvas, panelKey)) return;
    drawFallbackThumb(canvas, tool.label, tool.color || '#9b9a8f');
    if (tool.isAssetTemplate) {
      try { renderAssetTemplateThumb(tool, canvas); }
      catch (_) { drawFallbackThumb(canvas, tool.label, tool.color || '#c98f54'); }
      return;
    }
    if (stampBuilderThumbQueuedCanvases.has(canvas)) return;
    stampBuilderThumbQueuedCanvases.add(canvas);
    stampBuilderThumbQueue.push({
      runId: stampBuilderThumbQueueRunId,
      tool,
      canvas,
      key,
    });
    scheduleStampBuilderThumbQueue();
  }

  function stampBuilderSelectionKey(tool) {
    if (!tool) return '';
    if (tool.assetTemplateId) return 'asset-template:' + tool.assetTemplateId;
    if (tool.modelStampId) return 'model-stamp:' + tool.modelStampId;
    if (tool.voxelBuildId) return 'voxel-build:' + tool.voxelBuildId;
    const variant = tool.activeVariant && tool.activeVariant.id ? tool.activeVariant.id : '';
    return (tool.baseTool ? tool.baseTool.id : tool.id) + ':' + variant;
  }

  function currentStampBuilderSelectionKey() {
    if (!selectedTool) return '';
    if (selectedTool.kind === 'asset-template' && selectedTool.assetTemplateId) return 'asset-template:' + selectedTool.assetTemplateId;
    if (selectedTool.kind === 'model-stamp' && selectedTool.modelStampId) return 'model-stamp:' + selectedTool.modelStampId;
    if (selectedTool.kind === 'voxel-build' && selectedTool.voxelBuildId) return 'voxel-build:' + selectedTool.voxelBuildId;
    const variant = selectedTool.activeVariant && selectedTool.activeVariant.id ? selectedTool.activeVariant.id : '';
    return selectedTool.id + ':' + variant;
  }

  function stampCardChip(text, className) {
    const chip = document.createElement('span');
    chip.className = 'stamp-card-chip' + (className ? ' ' + className : '');
    chip.textContent = text;
    return chip;
  }

  function selectStampToolFromCard(tool) {
    if (tool.isAssetTemplate) {
      const template = tool.assetTemplate;
      const clipboard = normalizeClipboardPayload(template && template.clipboard);
      if (!template || !clipboard) return;
      rememberRecentStampTool(tool);
      selectedAssetTemplateId = template.id;
      selectTool({
        id: 'asset-template:' + template.id,
        label: template.name,
        kind: 'asset-template',
        assetTemplateId: template.id,
        assetTemplate: Object.assign({}, template, { clipboard }),
        isAssetTemplate: true,
        color: '#c98f54',
      });
      const status = document.getElementById('stamp-builder-status');
      const count = clipboard.cells.length;
      if (status) status.textContent = 'Selected template: ' + template.name + ' (' + count + ' cell' + (count === 1 ? '' : 's') + ')';
      return;
    }
    if (tool.isModelStamp) {
      const asset = tool.modelAsset || getModelStamp(tool.modelStampId);
      const status = document.getElementById('stamp-builder-status');
      if (!asset || !asset.supported) {
        if (status) status.textContent = (asset ? asset.format.toUpperCase() : 'Model') + ' detected, but only GLB/GLTF/OBJ/FBX/VOX/VDB are placeable right now';
        return;
      }
      rememberRecentStampTool(tool);
      selectedModelStampId = asset.id;
      selectTool({
        id: 'model-stamp:' + asset.id,
        label: asset.label,
        kind: 'model-stamp',
        modelStampId: asset.id,
        isModelStamp: true,
        color: '#8aa4b8',
      });
      const hint = modelStampAssetWarning(asset) || asset.materialStatus || '';
      if (status) status.textContent = 'Selected model stamp: ' + asset.label + (hint ? ' · ' + hint : '');
      return;
    }
    const realTool = tool.baseTool || tool;
    rememberRecentStampTool(tool);
    if (tool.baseTool && tool.activeVariant) realTool.activeVariant = tool.activeVariant;
    selectTool(realTool);
    if (tool.voxelBuildId) selectedVoxelBuildId = tool.voxelBuildId;
    const status = document.getElementById('stamp-builder-status');
    if (status) status.textContent = 'Selected ' + tool.label;
  }

  function renderStampBuilderCards() {
    const grid = document.getElementById('stamp-builder-grid');
    if (!grid) return;
    cancelStampBuilderThumbQueue();
    grid.innerHTML = '';
    updateStampBuilderSummary();
    const allTools = stampBuilderAllTools();
    renderStampBuilderCategoryStrip(allTools);
    const tools = stampBuilderTools(allTools);
    const status = document.getElementById('stamp-builder-status');
    if (status) {
      const q = stampBuilderSearchQuery();
      const category = normalizeStampBuilderCategory(activeStampBuilderCategory);
      const scope = category === 'all' ? '' : ' in ' + stampBuilderCategoryLabel(category).toLowerCase();
      const matchText = q ? ' matching "' + q + '"' : '';
      status.textContent = 'Showing ' + tools.length + ' stamp' + (tools.length === 1 ? '' : 's') + scope + matchText;
    }
    const selectedKey = currentStampBuilderSelectionKey();
    if (!tools.length) {
      const empty = document.createElement('div');
      empty.className = 'stamp-builder-empty';
      empty.textContent = stampBuilderSearchQuery()
        ? 'No stamps match that search.'
        : activeStampBuilderCategory !== 'all'
          ? 'No stamps in this category yet.'
          : 'No stamps yet. Drop GLB/GLTF/OBJ/FBX/VOX/VDB files into models/ or import a voxel build JSON.';
      grid.appendChild(empty);
      return;
    }
    for (const tool of tools) {
      const card = document.createElement('div');
      const key = stampBuilderSelectionKey(tool);
      const unsupported = tool.isModelStamp && tool.supported === false;
      card.className = 'stamp-card' + (key === selectedKey ? ' selected' : '') + (unsupported ? ' unsupported' : '');
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.dataset.stampKey = key;
      card.setAttribute('aria-pressed', key === selectedKey ? 'true' : 'false');
      if (tool.isAssetTemplate) {
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'stamp-card-delete';
        deleteBtn.title = 'Delete template';
        deleteBtn.setAttribute('aria-label', 'Delete template ' + tool.label);
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', async e => {
          e.preventDefault();
          e.stopPropagation();
          const confirmed = await window.twConfirm({
            title: 'Delete template?',
            message: 'Delete template "' + tool.label + '"?',
            details: 'This removes the reusable stamp template from this browser.',
            confirmLabel: 'Delete',
            intent: 'danger',
          });
          if (!confirmed) return;
          deleteAssetTemplate(tool.assetTemplateId);
        });
        card.appendChild(deleteBtn);
      }
      const canvas = document.createElement('canvas');
      canvas.dataset.stampKey = key;
      const title = document.createElement('strong');
      title.textContent = tool.label;
      const meta = document.createElement('div');
      meta.className = 'stamp-card-meta';
      if (tool.isModelStamp) {
        const fmt = (tool.modelAsset && tool.modelAsset.format ? tool.modelAsset.format : 'model').toUpperCase();
        const warning = modelStampAssetWarning(tool.modelAsset);
        const hasTexture = !!(tool.modelAsset && tool.modelAsset.sidecars && tool.modelAsset.sidecars.textures && tool.modelAsset.sidecars.textures.length);
        meta.appendChild(stampCardChip(fmt, unsupported ? 'warn' : 'model'));
        meta.appendChild(stampCardChip(unsupported ? 'detected' : 'model', unsupported ? 'warn' : 'model'));
        if (!unsupported && warning) meta.appendChild(stampCardChip('fallback', 'warn'));
        else if (!unsupported && hasTexture) meta.appendChild(stampCardChip('texture', 'model'));
      } else if (tool.isAssetTemplate) {
        const count = tool.assetTemplate && tool.assetTemplate.clipboard ? tool.assetTemplate.clipboard.cells.length : 0;
        const size = tool.assetTemplate && tool.assetTemplate.clipboard && tool.assetTemplate.clipboard.size;
        meta.appendChild(stampCardChip('template'));
        if (size) meta.appendChild(stampCardChip(size.x + 'x' + size.z));
        if (count) meta.appendChild(stampCardChip(count + ' cell' + (count === 1 ? '' : 's')));
      } else if (tool.isVoxelBuild) {
        meta.appendChild(stampCardChip('voxel'));
      } else if (tool.terrain) {
        meta.appendChild(stampCardChip('terrain'));
      } else {
        meta.appendChild(stampCardChip('built-in'));
      }
      function selectStampTool() { selectStampToolFromCard(tool); }
      card.addEventListener('click', selectStampTool);
      card.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        selectStampTool();
      });
      card.append(canvas, title, meta);
      grid.appendChild(card);
      scheduleStampBuilderThumb(tool, canvas, key);
    }
  }

  function toolbarIconSvg(id) {
    const icons = {
      select: '<svg viewBox="0 0 24 24"><path d="m4 4 7.07 17 2.51-7.39L21 11.07z"/></svg>',
      erase: '<svg viewBox="0 0 24 24"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 12 9 9"/></svg>',
      terrain: '<svg viewBox="0 0 24 24"><path d="M3 19.5 9.2 7.7l4.1 7.1 2.3-3.2 5.4 7.9Z"/><path d="m9.2 7.7 2.2 3.7"/></svg>',
      plants: '<svg viewBox="0 0 24 24"><path d="M12 21V11"/><path d="M12 11C8.2 10.7 6 8.4 5.4 4.5 9.2 4.8 11.4 7.1 12 11Z"/><path d="M12 13c3.7-.3 5.9-2.6 6.5-6.5-3.8.3-6 2.6-6.5 6.5Z"/><path d="M7 21h10"/></svg>',
      build: '<svg viewBox="0 0 24 24"><path d="M3.5 10.2 12 3.8l8.5 6.4"/><path d="M5.8 9.4v10.1h12.4V9.4"/><path d="M10 19.5v-5.2h4v5.2"/></svg>',
      infra: '<svg viewBox="0 0 24 24"><circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="6" r="2.6"/><path d="M8.6 18H16a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h7.4"/></svg>',
      mooring: '<svg viewBox="0 0 24 24"><circle cx="5.6" cy="17.8" r="2.3"/><circle cx="18.4" cy="6.2" r="2.3"/><path d="M7.8 17.6c4.8-.6 8.8-4.2 10.2-9.2"/><path d="M4.2 15.8 7 18.9"/><path d="M17 4.1 20.1 7"/></svg>',
      farm: '<svg viewBox="0 0 24 24"><path d="M12 21V5"/><path d="M7.2 8.1 12 12.9l4.8-4.8"/><path d="M7.2 13.2 12 18l4.8-4.8"/><path d="M5 20h14"/></svg>',
      life: '<svg viewBox="0 0 24 24"><circle cx="7.5" cy="10" r="2.2"/><circle cx="12" cy="7" r="2.2"/><circle cx="16.5" cy="10" r="2.2"/><path d="M6.6 17.6c0-3.2 2.4-5.4 5.4-5.4s5.4 2.2 5.4 5.4c0 1.5-.9 2.4-2.2 2.4-1.1 0-1.8-.8-3.2-.8s-2.1.8-3.2.8c-1.3 0-2.2-.9-2.2-2.4Z"/></svg>',
      home: '<svg viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/></svg>',
      shield: '<svg viewBox="0 0 24 24"><path d="M12 2.8 4.5 6.1v5.7c0 4.7 3.1 8.2 7.5 9.4 4.4-1.2 7.5-4.7 7.5-9.4V6.1Z"/><path d="M12 6.2v11.4"/><path d="M8.2 8.2h7.6"/><path d="M7.8 12h8.4"/></svg>',
    };
    return icons[id] || '';
  }

  // -------- flat tool glyphs (game-icons.net, CC BY 3.0) --------
  // Solid line-art icons replacing the old WebGL 3D tool thumbnails in the
  // toolbar + flyouts. fill:currentColor via the .tool-glyph CSS rule.
  const TOOL_GLYPH_SVG = {
    "berry-bush": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M59.88 52.08c-6.83.11-12.17 1.87-15.99 5.34C19.35 79.67 15.6 117.7 26.63 158c9.74 35.6 31.13 71.9 56.99 96.9c.48.2.98.4 1.47.6c-.84-11.8.74-23.3 6.28-36l16.43 7.2c-5 11.4-6 20-4.7 30.3c16.8-6 36.4 9 39.9 23.3c6 24.1-23.8 55.9-48.48 56.4c-15.43.3-32.55-12.6-41.23-28c-6.94 6.3-13.04 12.6-17.91 18.9c-13.01 16.8-17.27 31.4-9.21 46.8c6.62 12.8 17.27 20.9 31.47 26c14.19 5.1 31.84 6.8 50.56 5.8c23-1.3 47.5-6.7 69.5-13.9c-3.6-5.9-5.9-12.4-5.8-18.7c.3-15.7 11-36.2 28.7-30.7l-2.6-17.2l17.8-2.8l3 19.3c2.1-.7 4.3-1.1 6.5-1.1c11.8 0 23.9 9.7 27.3 19.8c2.9 8.6.9 18.7-3.8 27.9c17.9 8 37.7 15.8 58.3 22.3c2.9-9.8 11.4-20.1 21.8-20.3q4.05-.15 8.4 2.1c1.5-8.1 2.3-15.5 1.1-22.4l17.8-3c1.6 9.9.5 19.2-1.1 27.9c12-.1 23.3 11.5 24.6 21.6c.4 3.3 0 6.6-1.1 9.9c19.6 2.1 38.2 1.8 55-1.6c-5.9-5.7-10-12.8-10.4-19.9c-.8-12.8 7.2-30.4 22.8-28c-.5-6.1-1.2-12.2-2.2-18.1l17.6-3.4c1.3 6.5 2.1 13 2.6 19.3c2-.7 4.1-1.1 6.2-1.1c7.8-.2 15.8 3.8 20.7 9.2c.6-4.3.4-9.3-.5-14.9c-1.9-11.9-6.9-25.7-12.9-38.6c-6.2-13.4-13.2-25.8-18.6-34.6c-6.2 4.5-13.2 7.5-19.7 7.6c-17.5.4-37.8-21.1-35.9-38.5c1.3-11 9.4-24.3 21.1-24.7c2.2-.1 4.5.3 7 1.2c-.1-10-1-22.2-1.7-30.3l18-1.6c.7 8.3 2 20.8 1.9 32.4c4.2-.5 8.4.4 12.2 2.2c2.7-7.2 5.6-15.4 8.2-24.1c9-29.4 14.1-64.1 6.2-81.4c-4.7-10.3-11.9-20.1-20.7-28.8c2.6 4 4.4 8.2 4.9 12.3c3.3 24.6-29.8 52.8-54.4 50.5c-22.7-1.9-45.8-32.9-40.8-55.3c3.1-13.5 14.6-28.87 28.9-29.21c6.5-.15 13.6 2.8 20.7 10.43c8-5.62 16.7-5.55 24.3-2.35c-23.9-17.08-54.1-27.46-80.6-26c-10.4.56-28.7 12.65-42.8 25.62C301.6 108.2 291.2 121 291.2 121l-6.6 8.1l-7-7.7s-9.4-10.3-21.9-20.7c-12.5-10.44-28.7-20.12-37.2-20.6c-4.3-.24-15.8 4.57-24.7 10.46c-9 5.9-16 11.94-16 11.94l-5.6 4.9l-5.8-4.6s-24.3-18.72-52.6-33.46c-14.08-7.36-29.2-13.63-41.97-16.08c-3.19-.62-6.16-.99-8.93-1.13c-.52 0-1.03 0-1.53-.1h-1.49zm27.49 39.34c3.22 8.1 4.87 16.18 5.65 24.08c1.9-.6 4-1 6.1-1c9.68-.1 19.88 5.9 23.58 13.2c8.7 16.8-8 45.6-26.28 50.3c-16.96 4.4-41.65-11.9-43.79-29.3c-1.52-13.3 5.84-32 22.64-29.1c-.51-7.4-1.85-14.5-4.64-21.54zM234.8 169.2l17.8 2c-1 8.7-1.4 17.7-1 26.9c12.4-3 26.2 7.8 28.8 18.1c.4 1.6.6 3.3.6 5c4.7-3.9 10.5-5.5 17-2.6c1.8-12.1 6.6-23.6 11.7-34.5l16.4 7.6c-4.6 9.8-8.3 19-9.9 27.7c12.7-2.6 26.3 10.3 29 22.7c4.8 22.7-19.2 52.6-39 53c-18.3.5-39.5-26.1-37.6-47.6c0-.4.1-.7.1-1.1c-7.3 7.4-16.8 12.6-25.5 12.7c-17.5.4-37.8-21.1-35.9-38.5c1.3-10.9 9.4-24.2 21.1-24.6c1.7-.1 3.4.1 5.2.6c-.2-9.3.2-18.5 1.2-27.4m-80.6 248.4c-7.5 1.7-15.1 3.1-22.8 4.3c-5.5 21.6-12.4 45.8-29.8 68.3h86.5c-17.5-22-28.5-48-33.9-72.6m210.7 27.8c-8.2 6.6-18.4 10.8-27.2 9.9c-.8-.1-1.7-.2-2.5-.4c-2.9 11.9-7.3 24.2-14.4 36.3h79.5c-14.6-10.6-24.5-22.4-30.8-34.9c-1.8-3.6-3.3-7.3-4.6-10.9\"/></svg>",
    "big-wave": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M319.406 75.156c-50.542.49-104.39 20.876-150.094 72.844c-10.232 9.65-19.88 19.59-29.187 29.313c-20.516 21.433-39.694 41.877-60.22 56.468c-18.484 13.142-37.73 21.617-61 22.75v89.876c53.93-32.793 59.934-67.832 115.595-136.312c6.38-6.524 12.727-13.19 19.125-19.875c9.96-10.407 20.016-20.803 30.563-30.657c46.422-36.83 92.022-27.93 107.218 2.5c4.6-49.27 57.958-30.564 66.813 18.875c6.91-33.696 20.327-44.354 34.03-31.625c-28.136 49.585-26.61 110.87-8.406 164.937c20.51 60.915 61.743 114.13 110.344 133.75v-20.563c-38.34-19.194-74.662-65.71-92.657-119.156c-15.937-47.336-17.777-99.07 2.75-141.655c8.492 16.92 16.342 43.406 21.94 79.53c17.992-84.587 54.762-72.463 56.624-10.593c42.998-66.287-52.197-161.48-163.438-160.406zm-35.656 95.78C194.225 181.69 66.158 359.648 43.625 494.97h91.25c1.02-133.954 71.114-282.045 148.875-324.033zm32.406 13.69c-76.76 49.056-114.574 208.732-109.812 310.343h78.437c-41.213-80.74-23.207-252.666 31.376-310.345zm21.875 26.218c-34.686 82.23-25.705 191.077 25.158 284.125h78c-75.605-53.774-120.09-190.455-103.157-284.126z\"/></svg>",
    "bridge": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M255.063 18.25L209.97 140c-49.033 13.39-90.27 48.118-114.876 94.594h-56.25v93.125h112.5c3.17-59.343 48.313-106.44 103.72-106.44c55.404 0 100.547 47.1 103.717 106.44h112.5v-93.126h-56.25c-24.6-46.47-65.85-81.2-114.874-94.594zM38.843 344.313v150.25H151.47v-150.25zm319.813 0v150.25H471.28v-150.25z\"/></svg>",
    "carrot": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M228.063 16.72a9 9 0 0 0-2.47.5c-16.076 5.625-27.55 10.77-36.155 21.81c-6.477 8.313-10.984 18.854-16.063 34.407c-11.313-12.292-26.732-22.486-43.875-30.812c-23.817-11.568-51.083-19.46-76.156-22.78a9 9 0 0 0-6.282 16.343c21.685 14.934 40.525 29.268 53.407 43.687c9.964 11.155 16.21 22.01 18.436 33.53c-32.89-3.705-62.75 3.47-99.406 23.25a9 9 0 0 0 5.125 16.907c34.352-3.265 69.484-3.808 96.563.625c13.54 2.217 25.007 5.723 33.218 10.25c3.168 1.747 5.82 3.57 8 5.532c5.365-8.13 12.033-15.638 19.438-22.22c13.09-11.637 28.792-20.638 45.03-24.094c-11.326-18.24-14.138-30.23-12.843-41.5c1.588-13.813 10.567-28.893 22.564-52.344a9 9 0 0 0-8.53-13.093zm13.906 123.436c-.527-.003-1.062.016-1.595.03c-14.925.428-32.515 8.518-46.594 21.033c-16.088 14.3-26.977 33.817-26.78 50c.39 32.175 18.688 67.77 47.344 102.124c28.655 34.354 67.3 67.31 106.375 94.72c39.073 27.406 78.66 49.316 108.78 61.936c15.06 6.31 27.857 10.275 36.313 11.5c3.958.574 6.797.448 8.187.188c.065-.798.153-1.837.063-3.22c-.205-3.113-.814-7.504-1.844-12.75c-2.06-10.49-5.772-24.554-10.97-40.812c-10.397-32.516-26.75-73.9-47.688-114.937c-13.56-26.58-29.085-53.016-46.093-76.814c-14.193 17.317-12.034 17.985-49.72 36.72l-7.125-14.313c39.43-19.6 30.222-15.247 47.063-35.594c-6.235-8.066-12.65-15.74-19.22-22.907a286 286 0 0 0-9.937-10.344c-24.116 33.382-44.493 41.374-76.436 55.124l-7.125-16.53c32.963-14.19 47.585-18.322 70.218-50.814c-21.94-18.66-45.057-30.964-68.594-34.03a37 37 0 0 0-4.625-.314z\"/></svg>",
    "castle": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M254.25 15.344c-132.537 0-240.188 107.62-240.188 240.156c0 132.537 107.65 240.188 240.188 240.188S494.406 388.038 494.406 255.5S386.786 15.344 254.25 15.344m0 18.687c122.436 0 221.47 99.034 221.47 221.47c0 65.65-28.465 124.583-73.75 165.125V238.75l14-22.78h-7.595L364 101.5l-43.813 114.47h-8.156l14.595 22.78v33.875h-36.813v-88.188l14.625-22.78h-7.593l-44.406-114.47l-44.375 114.47h-7.594l14.03 22.78v123.22h-37.375v-18.094l14.594-22.782h-8.19l-43.78-114.467L95.344 266.78H87.75l14.03 22.783V416.25C59.25 375.9 32.75 318.83 32.75 255.5c0-122.436 99.064-221.47 221.5-221.47zm1.094 160.532h18.687v36.344h-18.686v-36.344zm110.156 87.97h18.688v36.312H365.5V282.53zm-246.656 22.03h18.687v36.344h-18.686v-36.344zm50.875 29.407h18.686v36.342H169.72V333.97zm170.81 30.5h18.69v36.342h-18.69z\"/></svg>",
    "corn": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"m130.543 39.226l13.316 66.134a609 609 0 0 1 8.384-11.048l17.066-21.885l-.974 27.736c-.69 19.64-1.247 39.345-1.49 58.973c6.94-3.547 14.11-7.24 21.494-11.108c14.69-7.69 29.31-15.51 41.242-22.017c-3-6.667-6.218-13.2-9.916-19.5c-15.624-26.61-39.145-50.258-89.123-67.284zm300.03 3.724a53 53 0 0 0-4.28.22c4.59 6.668 9.32 12.88 14.29 18.708l12.968-12.967c-6.443-3.9-14.258-6.046-22.978-5.96zm-22.645 4.828a82 82 0 0 0-8.586 4.07c-1.83.996-3.664 1.98-5.495 2.973q1.17 1.872 2.348 3.7c4.43-2.915 8.834-5.77 13.195-8.533c-.49-.726-.975-1.473-1.462-2.21m58.35 13.86L452.874 75.04c5.875 5.755 12.12 11.16 18.86 16.336c1.55-11.45-.575-21.67-5.458-29.738zm-88.18 1.705c-6.794 3.656-13.59 7.3-20.38 10.94q2.28 3.855 4.588 7.52a1107 1107 0 0 1 19.073-13.343a302 302 0 0 1-3.28-5.117zm41.884 1.25a868 868 0 0 0-13.488 8.7a217 217 0 0 0 10.156 12.52l11.403-11.404a241 241 0 0 1-8.07-9.817zm-78.05 18.178a3632 3632 0 0 0-22.594 12.27c2.482 4.546 4.97 8.91 7.482 13.096a1307 1307 0 0 1 21.006-15.828a328 328 0 0 1-5.893-9.537zm49.808.426a1090 1090 0 0 0-19.33 13.54c4.776 6.542 9.727 12.63 14.96 18.357l16.766-16.768a241 241 0 0 1-12.396-15.13zm48.656 4.323l-11.29 11.288a205 205 0 0 0 10.673 9.46c3.202-4.148 6.437-8.332 9.593-12.415c-3.074-2.71-6.07-5.48-8.977-8.334zM303.61 103.73a1596 1596 0 0 0-21.975 12.503c3.508 6.854 7.005 13.322 10.537 19.414a1492 1492 0 0 1 20.443-16.435a365 365 0 0 1-9.004-15.48zm54.442 3.437a1320 1320 0 0 0-21.445 16.195c5.945 8.62 12.127 16.47 18.762 23.73l19.507-19.507c-5.9-6.388-11.475-13.17-16.824-20.418m105.27.074c-3.028 3.92-6.133 7.937-9.207 11.92a270 270 0 0 0 5.432 3.702c1.267-2.337 2.52-4.68 3.795-7.015a84 84 0 0 0 3.095-6.287a260 260 0 0 1-3.115-2.32m-46.695 4.048l-16.532 16.53a211 211 0 0 0 14.946 12.417c4.7-6.056 9.32-12.013 13.925-17.97a231 231 0 0 1-12.338-10.977zM266.2 125.565c-.83.906-1.07.793-1.485 1.09c-.558.4-1.1.752-1.735 1.153c-1.268.8-2.864 1.753-4.828 2.892a620 620 0 0 1-8.904 5.033a954 954 0 0 0-8.074 5.125c3.755 8.345 8.797 16.637 15.002 25.17a1641 1641 0 0 1 22.025-18.8c-4.073-6.815-8.057-14.03-12-21.663zm-116.65 2.803C90.93 211.753 34.103 335.944 40.22 432.138c5.696 6.334 12.39 12.947 19.215 17.95c7.61 5.582 15.156 8.76 19.907 8.76h.45l139.268 13.926c-68.43-92.97-72.94-220.298-69.51-344.406m293.692 4.87c-4.444 5.752-8.902 11.505-13.44 17.357a306 306 0 0 0 11.106 6.87c3.373-6.288 6.746-12.58 10.13-18.874a282 282 0 0 1-7.796-5.353m-120.662 1.107a1469 1469 0 0 0-20.822 16.8c6.816 10.3 13.91 19.52 21.61 27.948l19.51-19.508c-7.19-7.783-13.896-16.15-20.298-25.24m65.023 5.966l-19.508 19.51c6.02 5.5 12.446 10.686 19.374 15.687a5328 5328 0 0 0 16.686-21.283c-5.807-4.458-11.314-9.074-16.553-13.912zm-162.52 8.6a2998 2998 0 0 1-20.3 10.802c4.492 10.944 11.093 22.845 19.223 35.006c6.07-5.553 12.16-11.05 18.27-16.48c-7.103-9.59-12.857-19.13-17.192-29.327zm62.9 13.685a1635 1635 0 0 0-20.638 17.658c7.596 9.074 16.32 18.562 26.073 28.79l17.46-17.458c-8.167-8.842-15.714-18.43-22.894-28.99zm130.845 2.115a5340 5340 0 0 1-16.346 20.865c5.56 3.47 11.445 6.88 17.672 10.28a3633 3633 0 0 0 12.254-22.602c-4.7-2.8-9.226-5.642-13.58-8.543m-230.043 3.377a2206 2206 0 0 1-20.463 10.51c3.642 13.868 11.777 30.123 22.885 46.923a1725 1725 0 0 1 19.158-18.193c-9.026-13.173-16.406-26.366-21.58-39.24m166.818 4.225l-19.508 19.507c7.207 6.583 14.993 12.72 23.534 18.624a3476 3476 0 0 0 16.823-20.994c-7.41-5.446-14.336-11.123-20.85-17.138zM253.58 192.354a1697 1697 0 0 0-19.02 17.184c8.084 10.67 17.152 21.326 26.858 31.506l19.263-19.264c-10.142-10.567-19.194-20.173-27.1-29.426zm137.777 7.317a3438 3438 0 0 1-16.48 20.595c7.44 4.473 15.463 8.87 24.092 13.287a1600 1600 0 0 0 12.49-21.973c-7.073-3.895-13.765-7.85-20.103-11.91zm-67.754 4.642l-17.46 17.458a373 373 0 0 0 25.783 22.417a2584 2584 0 0 0 16.447-19.91c-8.91-6.3-17.12-12.9-24.77-19.965M167.437 221.79c.31 8.662.715 17.282 1.262 25.836q4.577-4.59 9.198-9.145a255 255 0 0 1-10.46-16.69zm53.653.22a1685 1685 0 0 0-19.352 18.423c8.29 11.04 17.64 22.08 27.68 32.61l19.263-19.263c-9.95-10.366-19.25-21.02-27.59-31.77zm142.412 12.268a2580 2580 0 0 1-17.106 20.73c.95.67 1.9 1.326 2.848 1.98c11.135-5.043 21.08-9.175 29.514-11.823c.806-.253 1.553-.48 2.33-.723c-6.137-3.337-12.01-6.713-17.586-10.164m-70.094.23l-19.264 19.262a371 371 0 0 0 28.62 24.633a2046 2046 0 0 0 17.456-20.314c-9.126-7.32-18.12-15.24-26.812-23.583zM188.6 253.257a1662 1662 0 0 0-18.024 18.104q.12 1.26.242 2.514c8.02 10.558 16.996 21.096 26.6 31.168l19.263-19.264c-10.078-10.5-19.56-21.436-28.08-32.52zm207.175 6.792c1.045.547-4.21-.04-11.627 2.29c-7.62 2.39-17.802 6.602-29.472 11.934c-23.342 10.665-52.773 25.796-82.73 40.12c-29.96 14.327-60.4 27.873-86.608 35.478c-.61.177-1.208.335-1.815.506c9.725 39.354 24.64 75.796 47.09 107.666c10.53-.556 19.844-2.732 28.217-6.078c18.345-7.332 32.617-20.42 44.62-35.205c12.005-14.786 21.526-31.097 30.673-44.343c4.573-6.623 9.025-12.513 14.183-17.188c5.16-4.675 11.558-8.383 19.036-8.383c16.213 0 30.66 10.89 45.064 26.074c9.18 9.68 18.34 21.64 27.37 34.79c2.69-28.988 8.2-55.247 7.468-77.426c-.482-14.58-3.403-27.167-10.916-38.607c-7.486-11.398-19.84-22.032-40.553-31.627zm-134.367 6.457l-19.264 19.263a378 378 0 0 0 16.637 14.94c1.8-.852 3.6-1.694 5.4-2.555a2354 2354 0 0 0 21.275-10.324a403 403 0 0 1-24.047-21.323zm-32 32l-19.264 19.263a378 378 0 0 0 3.27 3.075c8.875-3.585 18.068-7.574 27.39-11.795a420 420 0 0 1-11.396-10.543m-54.406 8.834a526 526 0 0 0 2.922 17.198l6.757-6.758a421 421 0 0 1-9.678-10.44z\"/></svg>",
    "cow": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M468.958 108.958c-27.507 2.08-48.997 7.94-71.375 22.572c-5.333-2.214-12.62-17.738-16-16c-11.82 6.08-14.892 19.555-4.916 32.817l-59.084 9.916c-24.776 3.341-49.567 4.838-74.187 5.334c1.326 3.832 2.96 7.636 4.812 10.05c5.219 6.802 20.323 6.21 21.07 14.75c1.935 22.098-24.876 47.415-47.056 47.057c-15.401-.248-17.017-28.762-31.604-33.713c-19.097-6.482-41.62 18.77-59.699 9.832c-15.267-7.547-24.992-39.8-27.836-50.41c-10.213-.127-20.327-.142-30.316.035c-12.564.366-22.902 5.645-29.408 14.239c-8.676 11.458-11.652 26.658-13.254 42.925c-1.78 18.057 6.147 53.007 5.517 70.282c-.504 13.85-7.493 11.87-11.912 18.888c-13.52 21.47 8.894 20.83 17.014 5.56c12.482-23.473 4.253-63.11 7.195-92.974c1.855-35.76 10.597-23.937 15.664-24.588c-4.2 13.065-6.21 30.962-7 51.334c6.895-2.342 36.498-11.6 42.73-.174c6.872 12.598-27.802 22.016-23.878 35.819c2.464 8.666 22.95 2.378 24.582 11.238c3.322 18.035-32.13 38.713-42.236 44.209c.812 23.329 1.564 45.567 1.238 65.086H88.91c-4.234-16.543-12.038-49.944-4.06-55.084c21.425-18.091 29.836-37.484 42.732-56.428c8.755 2.556 16.92 4.787 24.782 6.672c3.553.972 7.244 1.771 10.984 2.44c24.859 4.967 61.553 5.678 90.783-.172c3.76 34.12 7.263 68.452 4.602 102.572h28.957c-12.375-26.902-4.263-65.044 13.892-86.27l44.934-33.462c24.881-16.384 42.93-37.996 55.982-63.38c30.402 3.413 57.086 3.29 77.192-.786l12.84-19.55c-24.257-17.857-43.3-36.585-62.948-58.13c10.063-14.533 25.027-22.765 39.375-32.506zm-39.375 54.572a8 8 0 1 1 0 16a8 8 0 0 1 0-16M366.2 183.481c5.029 9.822-26.17 10.808-24.933 21.772c.998 8.847 22.204 3.839 23.53 12.643c3.818 25.373-28.44 53.805-54.08 54.78c-14.262.544-34.902-14.06-32.308-28.093c2.605-14.092 34.551-1.657 40.383-14.748c4.724-10.603-18.352-22.01-12.992-32.307c6.264-12.032 30.364-22.553 41.934-22.646s15.606 3.347 18.466 8.6zm-26.585 126.346l-34.707 23.96l6.464 69.255h34.414c-11.783-22.454-15.58-55.506-6.171-93.215m-204.561 1.41c-6.047 12.184-14.147 21.97-22.174 31.242c5.97 3.235 11.648 5.414 17.154 6.614c11.218 2.443 21.636.333 29.948-4.408c10.056-5.737 17.521-14.452 24.115-23.368c-14.615-.869-32.96-2.962-49.043-10.08m24.252 52c-8.737 2.585-17.452 3.7-25.566 2.96c5.167 12.624 10.45 24.152 15.824 36.845h28.306c-10.393-18.48-16.148-29.285-18.564-39.805\"/></svg>",
    "daisy": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M212.83 35.623c-12.82 10.724-20.543 21.83-24.217 32.926a123 123 0 0 1 10.61 7.356c18.394 14.256 32.84 33.77 42.568 57.57c.972-.22 1.963-.41 2.964-.585c-2.212-21.11 3.236-40.853 14.096-57.337a103 103 0 0 1 4.863-6.758c-11.44-14.252-29.128-26.33-50.883-33.172zm125.287 6.354c-26.847 8.092-50.514 23.9-63.662 43.857c-9.01 13.676-13.484 29.048-11.176 46.25c4.738.386 9.173 1.22 13.27 2.428c12.39-24.598 34.287-41.71 59.39-52.16c5.786-2.41 11.758-4.485 17.843-6.29c-1.09-10.29-5.892-21.675-15.666-34.085zM116.123 67.334q-1.365-.01-2.746.004c-1.5.016-3.07.174-4.594.234c-.117 11.4 1.592 21.513 4.848 30.502c38.23 2.13 75.456 18.376 105.675 46.004a47 47 0 0 1 5.09-3.642c-8.563-21-21.034-37.68-36.62-49.758c-19.26-14.926-43.407-23.125-71.652-23.344zM422.81 85.48c-27.095.03-55.827 4.193-79.69 14.125c-22.266 9.27-40.026 22.904-49.92 43.176c3.183 2.446 5.876 5.22 8.032 8.238c27.672-18.518 58.118-30.99 88.71-35.586c10.19-1.532 20.412-2.172 30.538-1.852c2.562.08 5.117.23 7.665.434c5.175-8.07 8.955-17.33 11.046-27.987c-5.368-.328-10.815-.552-16.38-.547zM104.7 116.168c-22.183.178-44.555 5.983-65.792 17.78c9.143 9.83 19.125 18.12 29.762 24.94c14.156-5.566 29.43-8.977 45.142-10.386a196 196 0 0 1 15.782-.77c25.76-.224 52.377 4.47 77.63 13.495c.237-.727.51-1.442.797-2.153c-28.37-26.775-63.216-41.948-98.885-42.867q-2.216-.056-4.434-.04zm311.804 15.984c-7.835-.04-15.78.557-23.783 1.76c-27.66 4.157-55.845 15.743-81.618 33.08c24.37-5.826 48.43-8.58 71.13-7.785c11.106.388 21.887 1.623 32.22 3.76c15.675 3.242 30.358 8.704 43.413 16.46c11.013-6.62 20.737-15.16 28.772-25.755c-20.2-13.863-42.91-20.774-66.782-21.463a138 138 0 0 0-3.35-.058zM257.13 150.518c-22.345 0-32.115 11.656-32.796 19.69c-.34 4.015.887 7.646 5.518 11.255c4.63 3.61 13.214 6.853 26.773 6.853c12.317 0 20.56-3.133 25.43-6.884s6.607-7.93 6.588-11.97c-.04-8.076-7.755-18.944-31.514-18.944zm-127.386 15.914c-4.81.036-9.572.263-14.262.683c-33.576 3.012-63.03 15.752-82.605 39.364c17.717 7.944 35.93 13.317 54.13 15.97c11.21-11.392 24.728-20.34 39.485-26.915c23.284-10.375 49.654-15.345 75.932-16.09c-23.713-8.652-48.803-13.192-72.68-13.013zm246.81 11.388c-19.757-.16-40.94 2.546-62.544 7.815c23.82 3.452 48.044 10.302 68.724 21.763c15.92 8.824 29.708 20.93 38.948 36.178c21.276.118 42.66-3.086 62.81-9.41c-14.576-29.192-40.39-45.983-73.826-52.898c-9.192-1.902-18.933-3.005-29.082-3.344q-2.498-.083-5.03-.104m-169.427 20.268c-25.65.306-51.39 4.876-73.027 14.517c-27.956 12.457-48.87 32.61-56.768 63.96c21.466 1.763 43.832.622 64.572-3.913c1.705-12.368 6.455-23.946 13.725-34.168c12.202-17.157 30.626-30.815 52.446-40.396c-.316.002-.632-.004-.95 0zm91.437 4.652c20.04 12.812 36.38 29.854 45.06 49.475c4.064 9.19 6.334 19.062 6.25 29.096c20.956 6.728 44.18 10.073 65.216 10.665c2.086-33.004-14.98-53.578-41.416-68.23c-21.428-11.875-48.99-18.513-75.11-21.005zm-33.76 3.764c-17.39 19.093-19.03 41.607-10.767 63.982c8.28 22.426 27.31 43.556 50.207 55.633c13.745-10.66 21.566-21.53 24.875-31.948c3.663-11.537 2.477-22.944-2.59-34.397c-9.5-21.48-33.72-41.952-61.727-53.27zm-23.335.053c-30.815 7.842-56.89 23.47-70.61 42.76c-14.353 20.18-16.877 43.598 1.372 71.857c26.172-8.027 50.603-22.318 65.99-39.89c-.6-1.433-1.18-2.873-1.716-4.325c-8.413-22.785-8.062-48.412 4.963-70.403zm17.874 107.927c5.694 38.748-4.567 80.96-25.375 120.893c5.392 7.847 10.07 17.2 13.932 28.287c3.788-15.917 9.673-28.874 17.184-39.434c4.933-6.935 10.515-12.77 16.494-17.744c6.97-21.758 10.256-43.97 9.47-66.148c-11.907-6.877-22.667-15.703-31.706-25.854zm-72.496 25.49c-8.437 19.543-15.834 38.15-19.994 55.083c5.614 1.292 11.38 2.758 17.19 4.62c12.478 4.003 25.248 10.06 36.52 20.286c7.346-15.275 12.976-30.73 16.618-45.955c-4.204-2.083-8.448-4.198-12.737-6.46c-13.07-6.898-26.355-15.24-37.597-27.573zm167.007.887c-14.568 11.836-30.004 19.29-44.974 25.847a215 215 0 0 1-4 24.96c2.764-1.35 5.542-2.61 8.32-3.776c15.086-6.33 30.286-10.436 43.484-15c-.236-10.133-1.33-20.85-2.83-32.03zm42.967 32.417c-8.044 6.504-17.504 11.094-27.226 14.815c-16.096 6.16-33.432 10.43-49.164 17.03c-15.733 6.602-29.654 15.23-40.118 29.942c-9.41 13.232-16.26 31.88-18.03 59.622c68.802.31 104.793-16.823 122.09-40.94c15.153-21.125 17.282-49.698 12.448-80.47zm-285.867 23.5c-.722 28.213 4.302 52.75 19.178 69.725c17.094 19.505 48.977 31.41 106.346 27.035c-4.808-25.246-12.665-41.697-21.85-52.814c-10.345-12.518-22.577-18.85-36.296-23.248c-13.72-4.4-28.75-6.516-43.334-10.575c-8.268-2.3-16.524-5.418-24.045-10.123z\"/></svg>",
    "desert": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"m481.5 21.96l-45.6 12.33c2.6 5.3 4.3 11.14 4.9 17.3l45.3-12.25zm-279.3.67L200 40.51l143 17.04V56c0-5.7 1-11.17 2.8-16.26zM392 25c-17.2 0-31 13.77-31 31s13.8 31 31 31s31-13.77 31-31s-13.8-31-31-31m-43.8 52.81l-74.5 54.89l10.6 14.4L359 92.12c-4.5-4.05-8.1-8.9-10.8-14.31m73.9 16.81c-4.8 3.7-10.2 6.58-16.1 8.28l38.9 67.2l15.6-9zm-294.2.58c-.3.01-.5.02-.7.04c-3.3.32-7.7 3.47-11.8 8.76c-2.5 20.1-2.5 42.6.3 62.6l1.7 11.8l-11.9-1.7c-5.1-.7-7.11-.8-12.91-.4l-8.75.6l-.8-8.8c-.8-8.6-3.77-20.7-7.11-29.3c-3.41-2.9-5.73-3.4-7.78-3.2c-1.85.3-4.44 1.5-7.51 4.5c1.81 18.8 3.36 36.9 8.7 54.9c9.63 4.2 23.42 6.4 36.96 5.7l10-.5l-.6 10c-4.3 73.9-6.1 142.6-1 215.8c8.1 3.7 15.8 5.5 21.9 5.5c5.8 0 9.6-1.5 12-3.5c4.5-42.7.6-83.1-1.8-124.8l-.5-9.4l9.4-.1c10.7-.1 19.7-2.3 25.9-5.4c6-2.8 8.8-6.4 9.3-7.8c5.6-38.6 9.4-72.6 7.2-109.3c-.1-2.2-.7-2.9-1.8-3.8c-1-.9-3-1.7-5.2-1.8c-2.2-.2-4.6.3-6.1 1.1s-2 1.5-2.3 2.4c-9.4 31.1-17.3 62-18.6 94.7v.1l-18-.9v-.1c2.7-51 .6-104.7-2.6-156.2c-7.2-9.39-12.2-11.54-15.6-11.5m239.6 3.2l-53.9 142.9l16.8 6.4l54-143.3c-6-.9-11.8-3-16.9-6m66.4 111.7v47.8l-7.6-1.8l-4-28.2l-17.8 2.6l5.8 40.4l23.6 5.5V297h-233c-3.1 3-7.1 5.5-11.4 7.6c-6.8 3.2-15 5.6-24.2 6.6c2.5 39.2 5.8 78.9.9 121.7l-.2 2.4l-1.5 2c-6.4 8.5-17 12.2-27.9 12.2c-11 0-22.9-3.3-34.8-9.7l-4.41-2.3l-.36-4.9C93.6 386.2 93 341.8 94.04 297H25v190h462V297h-35.1v-38.5l23-5.3l4.8-24.8l-17.6-3.4l-2.6 13.2l-7.6 1.7v-29.8z\"/></svg>",
    "family-house": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"m55.379 25l-28.4 142H172.27L256 83.271L339.729 167H485.02l-28.4-142zM256 108.727L179.729 185H41v302h158v-87c0-18.25 7.166-33.077 18.021-42.727S242 343 256 343s28.123 4.624 38.979 14.273S313 381.75 313 400v87h158V185H332.271zm0 38.544l57 57V297H199v-92.729zm0 25.456l-39 39V279h78v-67.271zM71 199h98v98H71zm272 0h98v98h-98zM89 217v30h62v-30zm272 0v30h62v-30zM89 265v14h62v-14zm272 0v14h62v-14zM71 359h98v98H71zm272 0h98v98h-98zm-87 2c-10 0-19.877 3.376-27.021 9.727C221.834 377.077 217 386.25 217 400v87h78v-87c0-13.75-4.834-22.923-11.979-29.273S266 361 256 361M89 377v62h62v-62zm272 0v62h62v-62z\"/></svg>",
    "field": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M257.625 16.75c-132.32 0-239.78 107.46-239.78 239.78s107.46 239.783 239.78 239.783s239.78-107.462 239.78-239.782s-107.46-239.78-239.78-239.78zm0 17.906c58.24 0 111.19 22.37 150.75 59c-53.35-22.728-121.28 4.247-156.97-18.594c15.65 28.19 42.047 29.17 74.032 27.438c22.816 27.9 61.838 17.83 106.782 17a221 221 0 0 1 38.31 74.406c-23.755 6.825-72.6 4.008-92.374-.875c8.236 8.03 19.117 12.027 32.094 14.595c-48.222 1.067-94.365 5.457-124.375-11.688c8.84 14.213 20.115 23.206 33.28 28.625c-19.962-.433-38.48-3.21-54.905-11.093c26.83 30.444 69.098 30.62 114.47 26.28c31.063 11.3 66.71 13.98 100.717 12.375c.03 1.47.063 2.93.063 4.406c0 19.2-2.428 37.834-7 55.595c-9.933-2.477-20.396-4.745-31.313-6.78l6.907-25.44l-18.03-4.874l-7.377 27.126c-14.308-2.26-29.233-4.163-44.593-5.75l3.344-31.375l-18.594-2l-3.375 31.626c-17.664-1.49-35.795-2.55-54.095-3.22l1.375-34.623l-18.656-.75l-1.406 34.812c-11.082-.238-22.19-.33-33.282-.28c-6.816.03-13.623.142-20.406.28l-1.5-37.72l-18.656.75l1.5 37.47a1198 1198 0 0 0-52.03 2.938l-4.033-37.688l-18.56 1.97l3.968 37.342c-14.93 1.44-29.428 3.16-43.22 5.157l-8.812-32.5l-18.03 4.906l8.28 30.5c-13.984 2.39-27.106 5.07-39.187 8.063c-4.562-17.742-6.97-36.357-6.97-55.532c0-30.21 6.03-58.983 16.938-85.217c45.587 15.482 137.805-12.232 208.062 16.468c-13.577-12.7-29.093-20.01-45.53-24.53c42.76 4.614 101.767-13.058 162.343 11.688c-13.39-12.526-28.787-19.426-44.97-23.97c-31.258-26.39-71.34-28.437-109.812-27.437c-36.037-25.845-82.634-23.168-124.31-21.655c40.3-41.466 96.683-67.22 159.155-67.22zm-4.22 275.125c10.84-.048 21.707.064 32.532.283l-1 24.75a1361 1361 0 0 0-50.156.312l-1-25.094c6.533-.125 13.063-.22 19.626-.25zm-38.31.783l1 25.156c-16.37.62-32.73 1.506-49.064 2.655l-2.686-25.094c16.482-1.244 33.504-2.136 50.75-2.717m89.53.03c17.893.626 35.6 1.606 52.813 3l-2.563 23.97a1245 1245 0 0 0-51.22-2.407zm-158.906 4.25l2.655 24.97a1691 1691 0 0 0-36.47 3.375l-6.436-23.75c12.845-1.773 26.32-3.3 40.25-4.594zm230.343.438c14.38 1.44 28.335 3.135 41.687 5.158l-6.063 22.343a1175 1175 0 0 0-38.156-3.81l2.533-23.69zm-289.188 6.97l6.22 23a1913 1913 0 0 0-36.845 4.594a221 221 0 0 1-8.063-19.844c11.808-2.878 24.784-5.464 38.688-7.75m349.375 1.28c10.804 1.955 21.1 4.112 30.813 6.5a221 221 0 0 1-7.813 19.283a1121 1121 0 0 0-28.844-4.22z\"/></svg>",
    "grass": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"m18 494l36.35-330.4c6.728 107.62 4.086 231.82 35.556 295.67c11.205-84.926 15.707-168.18 10.562-249.01c15.225 71.69 35.543 141.68 39.468 217.14c7.395-55.935 12.667-111.52 31.798-169.41c-.76 65.19-17.16 124.9 12.677 157.47c14.433-51.01 28.992-101.9 31.46-164.88c21.27 61.862 18.342 135.82 24.948 205.02c8.417-68.06 15.28-257.84 46.907-318.17c-3.11 124.98-3.862 223.94 27.398 274.23c30.897-38.673 33.566-114.44 34.28-186.34c21.812 61.75 36.457 132.1 37.857 218.34c8.626-71.955 18.667-143.91 43.39-215.86c-5.748 88.29-1.284 156.95 19.525 194.17c13.76-55.55 25.504-111.1 29.12-166.66c18.42 82.78 13 159.59 16.706 238.69z\"/></svg>",
    "high-grass": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M461.563 38.938C313.435 165.053 232.49 371.144 210.313 492.5h77.218c31.597-122.495 51.135-263.494 174.033-453.563zM78.375 91.374c52.397 62.796 102.31 132.45 142.094 199.28a1188 1188 0 0 1 20.81 36.408a956 956 0 0 1 26.095-58.282c-51.817-71.23-113.464-135.005-189-177.405zm391.188 133.72c-51.588 46.498-78.856 114.453-90.594 190.655c13.775 25.835 26.704 51.295 38.936 75.875h39.375c-25.25-71.46-11.537-162.36 12.283-266.53M67 240.437c72.962 73.26 120.794 188.6 80.094 250.78h45c4.494-25.12 11.34-53.633 20.687-84.25C194.338 322.68 131.42 242.927 67 240.44zm-32.875 87.937C87.145 409.31 95.83 453.34 75.063 490.97h67.5c-13.1-72.02-31.444-116.305-108.438-162.595zm300.938 45.594c-10.65 41.36-19.188 80.437-28.813 118.25h91.72c-19.144-38.286-39.92-78.392-62.908-118.25z\"/></svg>",
    "house": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M256 19.27L25.637 249.638L19.27 256L32 268.73l6.363-6.367L256 44.727l217.637 217.636L480 268.73L492.73 256l-6.367-6.363zM96 48v107.273l64-64.002V48zm160 20.727l-192 192V486h64V320h96v166h224V260.727zM288 320h96v80h-96z\"/></svg>",
    "island": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M80.87 28.32c-10.027.162-20.065 3.47-29.706 11.055C79.26 31.458 116.008 60.67 128.582 94.5c-33.088 2.865-77.492 21.193-92.373 60.79c45.182-35.396 77.437-49.508 97.192-28.644c-20.36 20.232-37.693 49.855-34.722 77.06c8.497-19.502 30.642-47.206 53.763-56.956q-.026.37-.037.74c0 9.698 7.86 17.56 17.56 17.56a17.56 17.56 0 0 0 14.003-7.005c43.084 62.306 46.703 103.963 46.99 171.13c1.22 3.765 3.31 13.657 8.712 13.323c2.138-.15 7.886-4.198 9.24-14.906c-.658-72.08-6.662-120.87-59.648-192.89q.132-.654.244-1.335c12.77-25.514 63.138-12.534 85.207-7.342c-19.952-24.276-63.064-33.383-91.26-30.154c6.987-23.99 41.58-35.786 79.522-39.88c-35.283-14.532-83.623-2.6-108.498 18.582c-18.92-23.63-46.22-46.692-73.61-46.252zM316.444 88.3c-14.417-.27-30.606 5.297-47.838 19.68c55.587-9.758 66.225 13.936 65.26 41.247c-27.864-3.965-65.48 2.288-83.724 24.488c15.247-3.588 43.993-5.876 64.527 1.6a17.55 17.55 0 0 0-3.293 10.21c0 9.697 7.86 17.558 17.557 17.56a17.7 17.7 0 0 0 3.447-.36c-29.184 40.13-43.586 77.41-49.65 109.765a288 288 0 0 1 17.78 2.49c6.267-33.1 22.157-72.1 56.822-115.246a17.55 17.55 0 0 0 13.19 6.002a17.56 17.56 0 0 0 17.283-14.578c24.362 2.404 52.773 19.613 66.91 34.192c-6.48-25.342-31.1-46.236-56.117-58.325c20.007-20.112 64.557-27.84 85.123-26.85c-48.212-22.24-87.34-20.276-110.062-9.238c-9.94-21.647-30.544-42.133-57.213-42.636zM18 327v18h100.234c14.542-6.786 29.8-12.894 45.434-18zm330.69 0c15.736 5.106 31.102 11.213 45.736 18H494v-18zm-81.858 2.29c-1.966 17.012-11.84 30.178-25.898 31.165c-17.093-1.086-24.48-13.605-27.6-27.437c-33.38 5.94-67.274 18.015-97.31 33.033c-36.807 18.405-67.758 41.478-84.942 61.233c4.887 1.483 10.322 3.123 17 4.844c16.234 4.183 36.103 7.82 47.176 6.904c8.815-.73 18.05-5.583 28.39-11.27s21.82-12.22 35.834-13.026c19-1.092 36.012 5.71 51.84 12.04c15.828 6.332 30.557 12.207 44.69 12.226c8.875.012 18.36-3.293 28.83-7.22c10.47-3.925 21.902-8.468 34.943-8.778c30.896-.735 56.652 15.618 80.36 16c14.596.235 38.53-3.61 58.222-7.625c8.712-1.776 16.05-3.47 22.18-4.91c-16.61-19.392-47.196-42.19-83.774-60.38c-39.91-19.846-86.81-34.618-129.94-36.798zm-97.768 109.66c-17.693.86-35.45 8.61-51.22 16.005c-9.012 4.226-17.343 8.447-24.168 11.486C86.85 469.48 81.11 471 80 471c-25.66 0-48.943-12.707-62-21.492v21.472C33.352 479.837 55.207 489 80 489c7.268 0 13.51-2.78 20.998-6.115s15.8-7.56 24.488-11.633c17.376-8.147 36.382-15.234 49.875-14.275c8.73.62 17.46 6.266 27.45 13.51c9.993 7.246 21.062 16.013 35.75 18.396c21.05 3.416 40.977-2.01 59.72-7.215c18.745-5.204 36.403-10.194 52.91-8.705c6 .54 11.362 3.603 18.867 7.564C377.562 484.487 387.252 489 400 489c14.94 0 38.64-4.13 59.537-8.164c15.083-2.91 28.2-5.772 34.463-7.166v-18.39l-.012-.05c0-.002-17.313 3.968-37.863 7.934S411.277 471 400 471c-8.694 0-14.606-2.73-21.54-6.39c-6.936-3.66-14.852-8.6-25.65-9.573c-21.053-1.898-40.784 4.134-59.343 9.287s-35.852 9.418-52.026 6.793c-8.856-1.437-17.89-7.824-28.063-15.2c-10.174-7.378-21.676-15.823-36.738-16.894c-2.6-.177-5.16-.19-7.576-.074z\"/></svg>",
    "lava": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M257.188 45.875A44.867 44.867 0 0 0 211.28 91A44.867 44.867 0 1 0 301 91a44.867 44.867 0 0 0-43.813-45.125zM91.905 90.625A44.867 44.867 0 0 0 46 135.72a44.867 44.867 0 1 0 89.72 0a44.867 44.867 0 0 0-43.814-45.095zm330.281 0a44.867 44.867 0 0 0-45.906 45.094a44.867 44.867 0 1 0 89.72 0a44.867 44.867 0 0 0-43.813-45.095zM256.845 210.97A29.866 29.866 0 0 0 226.28 241a29.866 29.866 0 1 0 59.72 0a29.866 29.866 0 0 0-29.156-30.03zm-135 30A29.866 29.866 0 0 0 91.28 271a29.866 29.866 0 1 0 59.72 0a29.866 29.866 0 0 0-29.156-30.03zm270 0A29.866 29.866 0 0 0 361.28 271a29.866 29.866 0 1 0 59.72 0a29.866 29.866 0 0 0-29.156-30.03zm-135.5 89.81A15 15 0 0 0 241 345.876a15 15 0 1 0 30 0a15 15 0 0 0-14.656-15.094zm-120 15A15 15 0 0 0 121 360.876a15 15 0 1 0 30 0a15 15 0 0 0-14.656-15.094zm240 0A15 15 0 0 0 361 360.876a15 15 0 1 0 30 0a15 15 0 0 0-14.656-15.094zM76 375.876c-15 0-30 30-30 30c-30 0-30 0-30 30v30h480v-30c0-30 0-30-30-30c0 0-15-30-30-30c-30 0-30 45-60 45s-30-45-60-45s-30 45-60 45s-30-45-60-45s-30 45-60 45s-30-45-60-45\"/></svg>",
    "modern-city": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M217 25v30h30V25zm48 0v30h30V25zm48 0v30h30V25zm-96 48v46h30V73zm48 0v46h30V73zm48 0v46h30V73zm-96 64v46h30v-46zm48 0v46h30v-46zm48 0v46h30v-46zm174 6.508l-94 53.715V215h94zM217 201v46h30v-46zm48 0v46h30v-46zm48 0v46h30v-46zm80 32v110h94V233zM39 256v23h18v-23zm178 9v46h30v-46zm48 0v46h30v-46zm48 0v46h30v-46zM37.562 297l-7 14h146.875l-7-14zM25 329v158h23v-23h32v23h48v-23h32v23h23V329zm192 0v46h30v-46zm48 0v46h30v-46zm48 0v46h30v-46zM48 352h32v16H48zm80 0h32v16h-32zm265 9v126h31v-23h32v23h31V361zM48 384h32v16H48zm80 0h32v16h-32zm89 9v46h30v-46zm48 0v46h30v-46zm48 0v46h30v-46zM48 416h32v16H48zm80 0h32v16h-32zm89 41v30h30v-30zm48 0v30h30v-30zm48 0v30h30v-30z\"/></svg>",
    "path-tile": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M411.748 32.71v18h17.38v-18zm-93.326 10.68l-.236 17.998l37.9.496l.236-17.998zM90.426 56.057c-11.4 0-29.341 1.019-36.014 4.861s-9.066 7.926-9.066 11.072s8.188 13.902 14.861 17.744c6.529 3.76 16.45 6.487 27.553 6.604c2.346-3.682 5.705-6.728 9.398-8.98c9.823-4.72 18.875-6.877 28.274-6.368c.28-.816.416-1.598.416-2.328c0-3.146-2.394-7.23-9.067-11.072s-14.955-11.533-26.355-11.533m138.248 15.142l-.362 18l24.833.496l.359-17.998zM122.205 98.9c-6.469 0-12.202 1.71-15.676 3.828c-3.473 2.118-4.119 3.87-4.119 4.73s.646 2.614 4.12 4.732c3.473 2.119 9.206 3.827 15.675 3.827s12.204-1.708 15.678-3.827c3.473-2.118 4.119-3.872 4.119-4.732s-.646-2.612-4.12-4.73c-3.473-2.119-9.208-3.829-15.677-3.829zm152.31 20.728l-.665 17.988l13.408.496l.666-17.99zm145.854 19.115l-.36 17.998l24.833.496l.36-17.996zm-222.283 21.852l-.217 17.996l41.166.498l.219-17.998zm157.723 29.799l-.36 17.996l24.832.496l.36-17.996zm-284.098.75l-25.824.992l.691 17.986l25.824-.992zm71.543 7.195l-.36 17.996l24.83.496l.362-17.996zm278.414 40.72l-.229 18l38.989.497l.23-17.998l-38.99-.498zm-250.604.997l-.359 17.996l24.832.496l.36-17.996zm193.008 16.634v18h19.367v-18zm-86.73 7.204l-.346 17.322l-26.154-.219V265.63h-14.899v15.246l-11.888-.1l-.149 18l59.682.496l.142-17.248l18.084.362l.36-17.996zm-168.68 44.447l-.285 17.998l31.365.496l.285-18zm-2.006 51.896l-.21 17.998l42.255.496l.211-17.998zm331.95 3.973l-.237 17.998l37.9.498l.237-18zm-388.717 5.96l-.36 17.997l24.83.496l.362-17.996l-24.832-.496zm175.804 5.96l-.359 17.996l24.83.496l.361-17.996zm177.72 18.43c-9.345.074-26.338 6.446-35.243 8.128c-12.398 2.482-31.904 11.792-31.258 28.196c2.831 13.349 32.7 22.318 45.01 21.869c25.967-5.83 57.524-34.77 25.795-57.516c-1.106-.487-2.575-.691-4.305-.677zm-195.599 11.367l-.359 17.998l24.832.496l.36-17.996zm236.454 36.008l-.528 17.992l33.819.994l.527-17.992zm-409.555 18.38l-.799 17.983l22.348.992l.799-17.982z\"/></svg>",
    "pine-tree": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M249.28 19.188v.25c-18.114 38.634-45.065 72.36-77.686 102.937l37.72-3.938l-51.345 65.032l24.81-7.907l-33.624 54.875l16.53 9.843l-65.25 92.157l36.095.188l-51.686 83.594l63.562-8.126l12 32.094l66.438-25.282L215.5 493.28h52.938l-6.532-68.217l38.188 16.406l10.187-24.783l44.283 20.97l56.406-20.75l-37.064-64.094l-12.437-2.282l6.78 17.19l7.844 19.905l-19.938-7.78l-50.906-19.908v35.751l-14.156-8.594l-69.375-42l-21.595 21.25l-18.03 17.75l2.155-25.22l2.125-24.655l18.188 1.56l9.218-9.092l5.19-5.094l6.218 3.75l61.375 37.156v-29.906l12.75 4.97l43.718 17.092l-5.092-12.906l-6.157-15.656l16.533 3.03l45.468 8.345l-34.53-38.94l-23.625 14.033l-6.688 3.968l-5.125-5.874l-14.28-16.437l.218 1.217l-18.406 3.22l-5.97-34.313l-5.75-33.063l22 25.345l31.188 35.875l43.907-26.03c-24.67-19.543-39.507-33.87-49.658-48.814l.813 12.656l1.97 31l-18.75-24.75l-34.47-45.437l-22.25 46.813l-13.844 29.125l-3.843-32.032l-3.5-28.843l16.532-1.968l16.624-34.97l6.594-13.875l9.28 12.22l25 32.936l-.75-11.53l-.906-14.28l13.47 4.936L341.81 188l-26.125-35.156l-55.843-28.875l-8.938 20.218l-9.656 21.937l-7.72-22.688l-7.468-21.875l16.97-5.78l3.718-8.438l4-9.125l8.844 4.593l49.375 25.53l16.467-5.562c-43.42-34.31-64.63-68.886-76.156-103.593z\"/></svg>",
    "pumpkin": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M293.5 25.08c-19.9 21.16-44 43.18-75.6 51.3c9.6 13.18 16.6 28.02 22.6 40.22c4.7-.8 9.4-1.3 14.2-1.3c1.8 0 3.6.1 5.4.2c-4.6-8.7-7.1-17.98-8.3-25.81l-.7-4.73l3.5-3.23c15.3-14.1 36.1-22.27 57.8-30.82c-8.1-8.47-14.2-17.16-18.9-25.83M254.7 133.3c-27.1 0-52.6 18.2-71.9 50.1s-31.7 76.9-31.7 126.7s12.4 94.8 31.7 126.7s44.8 50.1 71.9 50.1s52.6-18.2 71.9-50.1s31.7-76.9 31.7-126.7s-12.4-94.8-31.7-126.7s-44.8-50.1-71.9-50.1m-98.5 12.1c-18.1 0-36.8 16-51.2 45.9c-14.42 29.8-23.69 72.2-23.69 119.1s9.27 89.3 23.69 119.1c14.4 29.9 33.1 45.9 51.2 45.9c8.3 0 16.8-3.4 24.9-9.9c-4.9-6-9.5-12.5-13.7-19.4c-21.4-35.3-34.3-83.2-34.3-136s12.9-100.7 34.3-136c4.1-6.8 8.6-13.2 13.4-19c-8-6.4-16.4-9.7-24.6-9.7m205.4 2.4c-9.6 0-19.3 4.5-28.5 13.1c3.1 4.2 6.1 8.6 8.9 13.2c21.4 35.3 34.3 83.2 34.3 136s-12.9 100.7-34.3 136c-3.5 5.8-7.2 11.2-11.2 16.3c9.8 10.1 20.4 15.4 30.8 15.4c18.1 0 36.8-16 51.2-45.9c14.4-29.8 23.7-72.2 23.7-119.1s-9.3-89.3-23.7-119.1c-14.4-29.9-33.1-45.9-51.2-45.9m-267.77.9c-17.89 0-36.02 14.8-50.05 42.4c-14.02 27.6-23.07 66.8-23.07 110.2s9.05 82.6 23.07 110.2c14.03 27.6 32.16 42.4 50.05 42.4c1.32 0 2.63-.1 3.95-.3c-3.22-5-6.23-10.5-9.01-16.3c-15.96-33.1-25.46-77.7-25.46-126.9s9.5-93.8 25.46-126.9c5.76-12 12.53-22.6 20.13-31.3c-5-2.3-10.06-3.5-15.07-3.5m324.37 1.5c-3.8 0-7.6.7-11.4 2c8.5 9.1 15.9 20.6 22.2 33.7c16 33.1 25.5 77.7 25.5 126.9S445 406.6 429 439.7c-2.6 5.5-5.5 10.7-8.5 15.6c17.1-1.2 34.3-15.9 47.7-42.3c14.1-27.6 23.1-66.8 23.1-110.2s-9-82.6-23.1-110.2c-14-27.6-32.1-42.4-50-42.4\"/></svg>",
    "rock": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M228.813 23L68.75 72.28L39.5 182.095l47.53-21.22l10.44-4.655l2.5 11.155l8.75 39.125l6.405 28.53l-21.75-19.53l-15.72-14.125l-28.218 32.344l140.657 136l9.656-40.69l7.53-31.874l10.407 31.063l54.72 163.592l159.936-26.31l45.75-202.938l-84.563-148.718L228.814 23zm-57.688 49.875l-27.813 39.906l-3.25 73.44l-27.187-88.94l58.25-24.405zm17.844 93.406l113.124 155.25L407 355.407l-107.375-.844l-110.656-128v-60.28zM79.312 330.25l140.125 153.125l-5.563-65.875z\"/></svg>",
    "seedling": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M383.9 23.46c-13.4 2.23-26.3 3-36.9 5.31c-14.8 3.18-24.2 7.59-29.8 22.41c-1.4 3.88-1 6 .4 8.61c1.4 2.62 4.5 5.52 8.5 7.8c4 2.29 8.8 3.93 12.9 4.62c4 .69 7.5 0 7.5 0h.1c17.9-8.16 30.2-27.83 37.3-48.75m-72.7 55.78c-3.4 20.1-13.5 38.56-25.2 56.26c-.4 2.2-.9 4.3-1.5 6.4c-2.7 9.3-7.5 18.2-14.3 25.8l.1.1c7.7-5.9 15.5-9.5 23.2-11.3c14.3-20.2 28.8-42.7 34.4-68.52c-3.7-1.19-7.3-2.76-10.8-4.75c-2-1.17-4-2.5-5.9-3.99m-85.7 8.61c-11.9-.1-25.5 2.26-40.4 6c-23.5 5.89-49 14.75-73.5 19.95c18.2 16.8 32.3 34.5 47.2 46.4c18.9 15 37.8 22.4 73.6 11.2c18.3-5.7 30.6-19.7 34.8-34.5c4.3-14.8 1.1-29.8-12.3-40.42c-7.6-6.01-17.6-8.53-29.4-8.63m81.2 84.35c-8.7-.1-17.4 3-27.8 11.8c-23.6 19.9-12.7 40.7-2.2 45.4h.1c2.4 1.1 8.6 1.5 16.5-.2c8-1.7 17.6-5.3 27.5-10.1c14.5-7 29.4-16.7 40.9-26.4c-13.2-5-25.1-12.2-36.4-16.3c-5.9-2.2-11.4-3.8-16.9-4.1c-.6 0-1.2-.1-1.7-.1M244.6 237c-48 .5-91.3 4.6-122.7 10.6c-16.9 3.2-30.51 7.1-39.1 11c-4.3 1.9-7.31 3.9-8.75 5.3c-.52.5-.62.6-.76.8c.14.2.24.3.76.8c1.44 1.4 4.45 3.4 8.75 5.3c8.59 3.9 22.2 7.8 39.1 11c33.9 6.5 81.5 10.6 134.1 10.6s100.2-4.1 134.1-10.6c16.9-3.2 30.5-7.1 39.1-11c4.3-1.9 7.3-3.9 8.8-5.3c.5-.5.6-.6.7-.8c-.1-.2-.2-.3-.7-.8c-1.5-1.4-4.5-3.4-8.8-5.3c-8.6-3.9-22.2-7.8-39.1-11c-19.3-3.7-43.1-6.6-69.7-8.5c-8 3.4-15.8 6.1-23.3 7.7c-9.9 2.1-19.2 2.8-27.7-1c-2.2-1-4.3-2.2-6.2-3.6c.9 8.8 2 17.6 3.2 26.5l-17.8 2.6c-1.7-11.4-3.1-22.7-4-34.3M80.33 289.3l7.89 39.4c10.2 8.7 32.98 17.4 61.98 23c30.7 5.8 68.3 8.8 105.8 8.8s75.1-3 105.8-8.8c29-5.6 51.8-14.3 62-23l7.9-39.4c-10.2 3.9-23.1 7.3-38.2 10.2c-35.6 6.8-84 10.9-137.5 10.9s-101.9-4.1-137.5-10.9c-15.1-2.9-27.98-6.3-38.17-10.2m44.57 75.2l11.7 93.4c6.5 8.1 21.9 16.5 42.7 21.9c22 5.7 49.3 8.7 76.7 8.7s54.7-3 76.7-8.7c20.8-5.4 36.2-13.8 42.7-21.9l11.7-93.4c-6.9 1.8-14.2 3.3-21.9 4.8c-32.3 6.2-70.7 9.2-109.2 9.2s-76.9-3-109.2-9.2q-11.55-2.1-21.9-4.8\"/></svg>",
    "sheep": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M392.8 107.5c9.3 5.3 25.8 9.3 40 9.2c7.7-.1 14.6-1.2 19.5-3.2c5-1.8 6.9-4.9 8.9-8.8c-9.2-6.08-22.1-12.27-31.8-12.87c-14.9.53-28.8 8.13-36.6 15.67m-253 20.2c-1.7 5.5-7.9 8.1-13 5.4c-26.5-14.5-50.46-6.9-67.71 8.7c-35.93 32.6-45.13 87.3-32.47 145.7c7.31 33.6 18.99 53 41.29 62.8c0 .1.1.1.15.1c2.22 1 4.21 1.9 6.09 2.8l4.61-22c1.02-4.9 5.8-8 10.66-7s7.98 5.8 6.96 10.7l-23.5 112c4.79 7.2 16.4 1.2 21.3-1.2l38.12-106.5c10.8-9.4 21.2-19 28.7-29.2c6.6-9.1 10.4-18.4 10.6-23.5c.2-5 4.4-8.9 9.4-8.7s9 4.6 8.6 9.6c-.6 11.2-6.2 22.4-14 33.2c-7.3 10-16.7 19.6-27.2 27.2l-3.3 8.9c6.9 8.7 13.4 13.8 19.6 16.8c8.8 4.1 17.7 4.6 28.5 3.3c16.4-1.9 34.6-12.9 43.5-37.2c2.8-7.7 13.6-8 16.8-.5c7.7 21.2 36.1 32.6 55.1 24l-3.9-23.3c-.8-4.9 2.5-9.6 7.4-10.4c4.9-.9 9.6 2.5 10.4 7.4l17.6 105.9c9.2 6.3 14.5 2.4 19.9-4.4l-13.8-114.4c-.7-5.3 3.3-10 8.6-10.2c4.8-.2 8.8 3.3 9.3 8l4.3 35.7c5.1-1.2 9.1-2.5 12.4-5c4.3-3.2 8.5-8.7 12.1-21.5c1.7-6 9-8.5 14.1-4.7c13.6 8.3 27.4-1.8 35.6-12.2c12.9-16.5 14.7-42.4 13.2-69.2q-3.15.45-6.3.6c-8.8.5-17.9-.9-25.7-4.4c-12.4-7-22-18.4-28.2-28.9c-3.9-6.8-7.3-13.7-10.5-20c-5.4 9.9-11 23.1-19.2 25c-12.5 2.1-23.9-3.7-29.8-12.7c-5.9-8.9-7.4-20.2-4.8-31.1c2.7-11.7 9.8-38.3 22.6-56.1c2.2-2.9 4.5-5.3 6.8-7.4c-7.5-3.1-16.2-3.8-22.9-3.8c-5.8 0-13.5 1.8-19.7 5c-6.2 3.3-10.7 7.8-12.2 11.8c-3.2 8.5-15.5 7.5-17.3-1.3c-3.8-22.78-53.9-17.8-65.6 2c-3.8 7-14.1 5.9-16.5-1.7c-8.1-22.61-62.7-21.3-66.7 5.9m345-1.5c1.7 16.4 3.5 32.2 4.2 45.6c1.8 6.5 6 18.9 8.7 7.3c.9-4.1.8-11-.4-18.6c-.1-7.1-14.5-47.3-12.5-34.3m-112.7-2.5c-11.9 15-19.2 37.4-23.3 53.7c-.6 5.8-.6 12.6 2.3 17.1c2.3 3.4 4.8 5.2 9.4 5c5.8-9.4 12.1-19.8 15.6-28.2c-1.2-7.9-2.8-19.9-3.6-31.4c-.4-5.8-.6-11.2-.4-16.2m94.4 2.4c-2.4 1.6-4.8 3.1-7.5 4.1c-7.8 3.2-16.8 4.4-26 4.5c-14.8.1-30.2-2.7-42.9-8.4c0 3.6.1 7.7.4 12.3c.9 12.6 3 27.2 4 33.5c10.5 16.6 19.9 44.4 36.8 52.5c5.8 2 11.9 3.1 17.2 2.9c6-.4 10.6-2.6 11.5-3.7c3.5-8 5.9-15.2 7.3-22.3c2.1-10.9 3.4-23.3 3.6-31.6c.3-6.4-.6-13.3-1.1-18.7c-1.4 4.1-5.7 6.6-10 5.9s-7.5-4.4-7.5-8.8c0-5.1 4.2-9.2 9.3-9c3 0 5.8 1.7 7.4 4.3c-.9-6.1-1.4-12-2.5-17.5m-58.3 16.5c4.9.2 8.7 4.2 8.7 9c0 5-4 9-9 9c-4.9 0-9-4-9-9s4.2-9.1 9.3-9m47.5 48.3c3.7-.1 6.5 1.9 6.5 6.2c0 7.8-5.8 15-12.7 19l-1-23.1c2.5-1.4 5-2.1 7.2-2.1m-24.1 2c1.8-.1 3.9.4 5.8 1.3l3.8 22.5c-6-3.7-15.4-3.6-16.5-16.1c-.5-5.2 2.8-7.7 6.9-7.7m-30.9 164.2c-3.7 5.1-7.6 9.1-12.6 12.1l16.6 62c7.6 1.5 15.9 1 19.2-5.1zm-241.2 33.7l1.5 46.8c7.9 7.9 12.9 4.8 19.7-3l-3.7-39.5c-6.3-.9-12.6-2.2-17.5-4.3\"/></svg>",
    "snowflake-1": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M316.28 19.063L211.19 47.25l36.625 67.78l-61.25 16.44L184 54.53L80.437 82.313L52.47 186.72l77 2.186L113 250.344l-67.875-36.22L17.22 318.19l75.843 75.843l40.593-65.56l45.25 45.25l-65.562 40.624l76.53 76.53l103.782-27.812l-36.5-68.03l61.53-16.47l2.377 77.157l104.687-28.064l27.97-104.437l-77.158-2.376L393 259.47l68.03 36.5l27.908-104.22l-77-77.03l-40.47 65.718l-44.624-44.657l65.406-40.75zM253.19 125l11.53 21.344l-22.874 69.72l-54.094-49.095l-.813-24.19l66.25-17.78zm64.062 16.75l48.28 48.313l-13 21.125l-71.81 15.062l15.467-71.375zm-176.438 47.47l23.75.686l48.938 54.656l-69.563 22.282L123 255.656l17.813-66.437zm221.094 53.56l21.125 11.345l-17.78 66.375l-23.97-.75l-48.5-53.938l69.126-23.03zm-139.25 41.5l-14.625 71.376l-19.53 12.094l-48.875-48.906l12.094-19.5zm40.438 11.064l54.5 48.344l.72 23.53l-66.533 17.844l-11.124-20.75l22.438-68.968z\"/></svg>",
    "stone-block": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"m209.875 44.156l-182 106.47l119.625 54.31l148.344 11.72l41.97-24.312l17.342 11.562L309 230.656V379.53l53.563-14.624l-64.625 51.97l-110.875-59.626l-2.157-1.53l-71.28 6.56l75.936-31.967l100.75 52.125v-147.5l-145.906-11.5l-1.625-.125l-1.5-.688l-121.093-55V391.47L44 423.186l82 20.97l21.875-21.282l11.156 29.72l131.282 33.592V434l4.25 2.28l5.47 2.94l4.812-3.908L309 431.97v52.155L491.375 377.78v-96.405L466.78 269.47l24.595-38.75V125l-90.25 52.28l-1.094 34.095l-88-58.688l84.97 5.375L476.5 112L291.562 64.937l1.625.563l-64.406 5.78l5.345-20.936l-24.25-6.188z\"/></svg>",
    "sunflower": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M274 26.5c-10.161 19.207-21.438 38.715-28.715 58.063c-8.69 23.102-11.63 44.996-1.693 67.173c13.223-1.447 27.547-.183 39.744 2.809c12.33-23.057 14.079-46.848 9.973-70.748C289.933 64.15 282.524 44.657 274 26.5M138.518 47.807c4.509 17.9 8.552 37.348 13.855 56.334c8.076 28.912 19.233 55.27 37.055 70.73a104.9 104.9 0 0 1 37.006-19.625c-6.189-20.148-23.477-43.439-44.252-65.334c-14.327-15.099-29.39-29.04-43.664-42.105m234.304 32.525c-17.615 14.32-33.925 25.364-46.11 36.711c-13.703 12.762-22.372 25.14-24.421 44.736a105.6 105.6 0 0 1 31.793 24.114c16.86-14.798 25.494-31.17 30.734-50.211c4.5-16.351 6.28-35.29 8.004-55.35M60.547 131.234c8.7 18.074 19.14 36.126 32.246 51.147c15.944 18.273 35.498 31.934 61.164 36.928c8.262-10.316 15.239-23.396 23.03-32.37c-10.91-21.855-29.799-33.447-53.284-41.32c-19.598-6.57-41.846-10.14-63.156-14.385m419.176 29.586c-18.258 2.726-38.008 4.836-57.424 8.244c-30.068 5.28-57.828 13.983-74.904 30.739l16.084 38.074c20.79-3.984 45.954-19.028 70.046-37.748c16.436-12.771 31.79-26.39 46.198-39.309M256 169c-48.155 0-87 38.845-87 87s38.845 87 87 87s87-38.845 87-87s-38.845-87-87-87m0 12.201c41.204 0 74.799 33.595 74.799 74.799S297.204 330.799 256 330.799S181.201 297.204 181.201 256s33.595-74.799 74.799-74.799m15.777 8.682l-4.222 17.496l14.402 3.476l4.223-17.496zm-40.351 8.687v18h18.873v-18zm-27.647 18.883l-8.94 15.395l15.567 9.039l8.94-15.395zm92.41 3.002l-16.884 1.49l1.582 17.932l16.884-1.49zm-39.587 9.732l-15.825 10.12l9.7 15.164l15.824-10.12zm-126.334 2.766c-19.262.194-39.851 5.321-54.51 11.799c-15.367 7.173-30.94 18.094-47.332 29.785c22.322 4.13 41.304 9.39 57.842 11.313c20.545 2.387 46.184-1.584 64.468-16.21l-1.918-35.103c-5.857-1.164-12.13-1.648-18.55-1.584m178.664 13.879l-6.383 16.828l14.4 5.463l6.383-16.828zm-100.077 2.397l-.546 17.992l16.388.498l.547-17.992zm172.834 4.457c-6.146.068-12.51.747-19.367 2.08c-1.959 15.376-6.896 31.081-9.855 43.84c18.294 14.066 38.106 17.06 61.488 14.693c20.415-2.067 43.486-8.631 67.697-15.301c-15.874-13.122-32.566-25.334-50.322-33.695c-17.507-7.256-31.706-11.345-47.02-11.61a93 93 0 0 0-2.62-.008zm-100.263 11.869l-20.362.498l.442 17.996l20.361-.498zM215.809 280.8l-4.52 17.424l18.676 4.177l4.52-17.424zm86.115.584l-12.912 9.931l10.972 14.27l12.912-9.932zm-145.2 15.838c-23.384 1.195-36.822 10.464-50.605 25.886c-11.52 12.892-28.695 33.236-43.455 51.936c21.769-.505 47.299-4.865 64.227-9.998c19.952-6.05 36.586-16.937 51.19-38.754c-8.307-10.52-13.16-18.75-21.356-29.07zm110.77 5.351l-15.892.496l.562 17.993l15.893-.497zm72.1 16.877c-5.326 12.205-30.778 23.962-35.227 31.528c27.547 39.306 81.094 54.027 126.317 56.8c-13.04-18.243-26.832-38.452-42.409-55.164c-14.764-15.84-30.642-28.043-48.681-33.164m-146.858 20.285c-13.155 15.84-23.681 41.258-31.543 68.727c-5.727 20.01-10.082 40.067-14.084 59c13.128-12.977 27.824-26.34 41.483-40.553c21.13-21.987 38.386-45.374 42.303-68.953a104.7 104.7 0 0 1-38.159-18.22zm97.137 21.35l-43.373 3.172c-7.303 45.857 19.494 90.883 47.504 119.898c11.935-41.049 20.331-92.31-4.131-123.07\"/></svg>",
    "watchtower": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"m256 32l-96 48h23v71h-32v50h30.945L155.36 440.244l-.653.477l.522.72l-4.175 37.566l-.994 8.945l17.89 1.99l.995-8.946L171.61 457h168.78l2.665 23.994l.994 8.945l17.89-1.99l-.995-8.944l-4.174-37.567l.523-.72l-.654-.476L330.054 201H361v-50h-32V80h23zm-48 64h32v48h-32zm64 0h32v48h-32zm-103 73h14v14h-14zm32 0h14v14h-14zm32 0h14v14h-14zm32 0h14v14h-14zm32 0h14v14h-14zm32 0h14v14h-14zm-113.328 32h80.656L256 236.848zm-16.65 9.283L240.33 247h-45.385l4.08-36.717zm113.955 0l4.08 36.717h-45.385zM192.945 265h31.383l-34.822 30.953l3.44-30.953zm58.477 0h9.156l51.75 46H199.672zm36.25 0h31.383l3.44 30.953L287.67 265zm-83.994 64h104.644L256 367.053zm-18.8 8.586L236.323 375h-55.6l4.157-37.414zm142.243 0L331.278 375h-55.6l51.444-37.414zM178.724 393h41.6l-45.26 32.914zm72.205 0h10.144l63.25 46H187.678l63.25-46zm40.75 0h41.6l3.658 32.914z\"/></svg>",
    "wheat": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M98.344 16.688C79.692 43.785 68.498 69.01 65.5 89.56l23.938 39.157l28.624-33.47c.868-21.213-5.49-48.677-19.718-78.563zM472.5 19.625C444.04 36.055 423.112 54 411.562 71.25l4.75 45.688L456.563 99c9.89-18.777 15.938-46.29 15.938-79.375zm-91.75 27.28c-10.153 21.036-16.8 40.84-20.156 58.314l18.375 57.686l19.78-34.25l-6.5-62.22h.03a277 277 0 0 0-11.53-19.53zM27.25 80.782c-.125 23.364 2.393 44.102 6.875 61.314L75.5 186.25l3.125-39.406L46 93.47l.03-.032a280 280 0 0 0-18.78-12.657zm132.844 10.532c-8.415 3.504-16.29 7.213-23.594 11.094l-39.25 45.97l-3.094 39.374l50.438-39.094c6.712-15.904 12.09-35.263 15.5-57.344m177.22 21.626c-24.024 58.09-16.16 97.86 7.873 108.5l21.157-36.625l-19.594-61.438a274 274 0 0 0-9.438-10.438zm146.03.218c-4.55-.028-8.97.084-13.28.28L414.935 138l-19.78 34.28l62.343-13.655c12.897-11.47 26.09-26.626 38.656-45.094c-4.358-.216-8.64-.348-12.812-.374zm-226.094 8.72c-23.24 23.238-38.832 46.003-45.53 65.655l16.436 42.907l34.22-27.75c4.695-20.704 3.436-48.856-5.126-80.812M16.406 159.06c3.28 62.77 27.482 95.31 53.75 94.594l3.344-42.22l-44.063-47a279 279 0 0 0-13.03-5.374zm143.22 11.375a272 272 0 0 0-18.5 4.563l-48.97 37.938l-3.312 41.75c26.492 7.51 57.16-20.567 70.78-84.25zm16.06 1.563c-4.36 22.935-5.65 43.762-4.374 61.5l32.688 51l10.22-38.188l-22.407-58.437h.03a277 277 0 0 0-16.155-15.875zm267.408 8.938l-60.563 13.218l-20.936 36.25c20.682 18.195 60.438 6.035 100.125-45.625a275 275 0 0 0-18.626-3.843m-138.688 25.53c-8.912 1.92-17.304 4.16-25.187 6.657l-46.97 38.03l-10.22 38.19l56.69-29.283c9.493-14.424 18.323-32.49 25.686-53.593zm155.125 25.063c-25.85 20.324-44.046 41.06-53.03 59.782l11.22 44.532l37.28-23.47c7.126-19.99 9.236-48.088 4.53-80.843zm-123.342 8.595c-34.435 77.573-59.394 159.06-62.97 253.03h18.72c3.558-90.792 27.573-169.428 61.312-245.436l-17.063-7.595zm-185.375 6.906c-8.173 62.347 9.714 98.713 35.687 102.75l10.97-40.874l-34.814-54.25a279 279 0 0 0-11.844-7.625zm221.75 24.532c-7.053 22.243-10.817 42.77-11.657 60.532l26.406 54.594L402 349.967l-15.28-60.687h.06c-4.3-5.848-9.033-11.76-14.217-17.717zm-302.47 1.532c-8.664 74.584-8.13 147.835 12.188 220.062h19.44c-20.877-70.772-21.764-143.02-13.064-217.906l-18.562-2.156zm219.47 11.094c-6.613.16-12.953.54-19.032 1.125L215.5 313.78l-10.844 40.408c24.69 12.23 59.938-9.82 84.906-70zm206.718 36.937c-9.072.844-17.664 2.052-25.78 3.594l-51.156 32.217l-14.688 36.657l59.75-22.313c11.14-13.193 22.055-30.075 31.875-50.155zm-157.31 22c-15.528 60.938-2.096 99.19 23.217 106.28l15.72-39.28l-28.094-58.03c-3.43-3-7.053-5.985-10.844-8.97zM183.25 368.72c-12.674 41.233-22.26 82.547-26.844 124.436h18.813c4.507-39.722 13.69-79.23 25.905-118.97l-17.875-5.467zm270 26.655l-58 21.688l-15.563 38.875c23.056 15.098 60.673-2.606 92.625-59.407a273 273 0 0 0-19.062-1.155zM356.5 469.03c-1.874 7.713-3.185 15.757-3.656 24.126h18.687c.45-6.686 1.55-13.206 3.126-19.687l-18.156-4.44z\"/></svg>",
    "wooden-fence": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M149.725 16.338L90.627 79.926v348.678l59.098 63.582l18.584-61.58h51.895l37.91 61.58l37.91-61.58h51.895l18.584 61.58l59.098-63.582V79.926l-59.098-63.588l-19.188 63.588v1.97h-50.058v-1.97l-39.143-63.588l-39.142 63.588v1.97h-50.06v-1.97zm19.187 84.244h50.06v142.486h-50.06zm128.346 0h50.058v142.486h-50.058zM168.912 261.756h50.06v150.162h-50.06zm128.346 0h50.058v150.162h-50.058z\"/></svg>",
    "lamp-post": "<svg viewBox=\"0 0 512 512\"><path d=\"M244 30h24v26h-24z\"/><path d=\"M256 52l66 104H190z\"/><path d=\"M186 156h140v34H186z\"/><path d=\"M240 190h32v266h-32z\"/><path d=\"M166 456h180v28H166z\"/></svg>",
    "spotlight": "<svg viewBox=\"0 0 512 512\"><path d=\"M104 122l152 70-36 78-152-70z\"/><path d=\"M230 178L470 270V152z\"/></svg>",
    "mooring": "<svg viewBox=\"0 0 512 512\"><path fill=\"currentColor\" d=\"M128 96a64 64 0 1 0 0 128a64 64 0 0 0 0-128zm256 192a64 64 0 1 0 0 128a64 64 0 0 0 0-128zM166 238c44 70 106 116 191 138l10-36c-75-20-126-58-167-124zm162-112c-80 11-141 48-184 112l31 20c37-55 87-85 159-96zM318 54l128 54l-98 96l-17-74l-74-17z\"/></svg>",
  };
  // tool id (or kind) -> glyph name
  const TOOL_GLYPH_NAME = {
      "grass": "grass",
      "path": "path-tile",
      "dirt": "field",
      "water": "big-wave",
      "stone": "stone-block",
      "lava": "lava",
      "sand": "desert",
      "snow": "snowflake-1",
      "new-island": "island",
      "house": "house",
      "tree": "pine-tree",
      "fence": "wooden-fence",
      "rock": "rock",
      "bridge": "bridge",
      "crop": "seedling",
      "corn": "corn",
      "wheat": "wheat",
      "pumpkin": "pumpkin",
      "carrot": "carrot",
      "sunflower": "sunflower",
      "tuft": "high-grass",
      "flower": "daisy",
      "bush": "berry-bush",
      "cow": "cow",
      "sheep": "sheep",
      "lamp-post": "lamp-post",
      "spotlight": "spotlight",
      "mooring": "mooring"
  };
  // House variants get distinct building glyphs so they stay easy to tell apart.
  const HOUSE_VARIANT_GLYPH = { cottage: 'house', manor: 'family-house', tower: 'watchtower', turret: 'castle', skyscraper: 'modern-city' };
  function glyphSvgForTool(t) {
    if (!t) return '';
    let name = null;
    if (t.kind === 'house') {
      const bt = t.activeVariant && t.activeVariant.buildingType;
      name = HOUSE_VARIANT_GLYPH[bt] || 'house';
    } else {
      name = TOOL_GLYPH_NAME[t.id] || (t.kind ? TOOL_GLYPH_NAME[t.kind] : null);
    }
    return (name && TOOL_GLYPH_SVG[name]) ? TOOL_GLYPH_SVG[name] : '';
  }
  // Positional type drives the tinted button background:
  //  terrain  = ground tile (grass/water/stone…)
  //  primary  = the one object that occupies a tile (house/tree/cow…)
  //  tertiary = overlays that stack onto a tile with a primary (fence/mooring)
  function posTypeForTool(t) {
    if (!t || t.select || t.erase || t.eraser || t.auto) return null;
    if (t.terrain) return 'terrain';
    if (t.id === 'fence' || t.kind === 'fence' || t.mooring) return 'tertiary';
    return 'primary';
  }

  function buttonPosTypeForTool(t) {
    if (!t) return null;
    if (t.select) return 'primary';
    if (t.erase || t.eraser) return 'neutral';
    return posTypeForTool(t);
  }

  function posTypeForToolGroup(group) {
    if (!group) return null;
    const iconTool = TOOLS.find(t => t.id === group.iconTool);
    const firstTool = TOOLS.find(t => group.toolIds.includes(t.id));
    return posTypeForTool(iconTool || firstTool) || 'primary';
  }

  // Action tools (e.g. mesh-terrain) fire a one-shot action on click instead of
  // becoming the active paint tool. Close any open flyout, then run the action.
  function runToolAction(t) {
    const flyoutEl = document.getElementById('flyout');
    if (flyoutEl) _hideFlyoutAnimated(flyoutEl);
    if (t.action === 'mesh-terrain') {
      const mt = window.__tinyworldMeshTerrain;
      if (mt && typeof mt.open === 'function') mt.open();
    }
  }

  function buildToolButton(t, opts) {
    const btn = document.createElement('button');
    btn.className = 'tool' + ((opts && opts.flyout) ? ' flyout-tool' : '') + ((t.eraser || t.select) ? ' icon-only' : '');
    btn.dataset.id = t.id;
    btn.type = 'button';
    const toolTip = t.label + (t.shortcut ? ' (' + t.shortcut.toUpperCase() + ')' : '');
    btn.title = toolTip;
    btn.setAttribute('data-tooltip', toolTip);
    const posType = buttonPosTypeForTool(t);
    if (posType) btn.dataset.posType = posType;

    if (t.eraser || t.select) {
      const icon = document.createElement('span');
      icon.className = 'tool-icon';
      icon.innerHTML = toolbarIconSvg(t.eraser ? 'erase' : 'select');
      btn.appendChild(icon);
    } else if (t.auto) {
      const swatch = document.createElement('div');
      swatch.className = 'swatch auto';
      btn.appendChild(swatch);
    } else {
      const glyph = document.createElement('span');
      glyph.className = 'tool-glyph';
      const svg = glyphSvgForTool(t);
      if (svg) glyph.innerHTML = svg;
      else { glyph.classList.add('tool-glyph-empty'); glyph.style.setProperty('--glyph-color', t.color || '#9b9a8f'); }
      btn.appendChild(glyph);
    }

    const lbl = document.createElement('span');
    lbl.textContent = t.label;
    btn.appendChild(lbl);
    if (t.shortcut) {
      const k = document.createElement('kbd');
      k.textContent = t.shortcut.toUpperCase();
      btn.appendChild(k);
    }
    if (t.variants && t.variants.length) {
      const chev = document.createElement('span');
      chev.className = 'chev';
      chev.textContent = '▾';
      btn.appendChild(chev);
    }
    if (!(opts && opts.noClick)) {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (t.action) { runToolAction(t); return; }
        selectTool(t);
      });
    }
    if (t === selectedTool) btn.classList.add('active');
    return btn;
  }

  function buildToolbarUtilityButton(id, label, iconId, onClick, opts = {}) {
    const btn = document.createElement('button');
    btn.className = 'tool icon-only toolbar-utility';
    btn.type = 'button';
    btn.id = id;
    btn.dataset.utility = id;
    if (opts.posType) btn.dataset.posType = opts.posType;
    btn.title = label;
    btn.setAttribute('data-tooltip', label);
    btn.setAttribute('aria-label', label);
    if (opts.pressed != null) btn.setAttribute('aria-pressed', opts.pressed ? 'true' : 'false');
    const icon = document.createElement('span');
    icon.className = 'tool-icon';
    icon.innerHTML = toolbarIconSvg(iconId);
    btn.appendChild(icon);
    const lbl = document.createElement('span');
    lbl.textContent = label;
    btn.appendChild(lbl);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      onClick(e, btn);
    });
    return btn;
  }

  function updateShieldToolbarState() {
    const btn = document.getElementById('toolbar-shield-toggle');
    if (!btn) return;
    const shield = window.VoxelShield && window.VoxelShield.shield;
    const active = !!shield && (shield.targetProgress > 0.5 || shield.progress > 0.05);
    const label = active ? 'Lower shield' : 'Raise shield';
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.setAttribute('aria-label', label);
    btn.setAttribute('data-tooltip', label);
    btn.title = label;
  }
  window.updateShieldToolbarState = updateShieldToolbarState;
  window.addEventListener('tinyworld:shield-changed', updateShieldToolbarState);

  function buildVariantToolButton(tool, variant) {
    const previewTool = Object.assign({}, tool, {
      id: tool.id + '-' + variant.id,
      label: variant.label,
      activeVariant: variant,
    });
    const btn = buildToolButton(previewTool, { flyout: true, noClick: true });
    btn.dataset.id = tool.id;
    btn.dataset.variant = variant.id;
    btn.title = tool.label + ': ' + variant.label + (variant.hint ? ' — ' + variant.hint : '');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      tool.activeVariant = variant;
      selectTool(tool);
    });
    return btn;
  }

  function buildToolbar() {
    twPerfMark('toolbar:start');
    const bar = document.getElementById('toolbar');
    bar.innerHTML = '';
    thumbScenes.forEach(t => { try { t.scene.traverse(o => safeDisposeGeometry(o.geometry)); } catch(_) {} });
    thumbScenes.clear();
    toolThumbCanvases.clear();
    toolThumbBuildQueue.length = 0;
    if (toolThumbBuildQueueTimer) {
      clearTimeout(toolThumbBuildQueueTimer);
      toolThumbBuildQueueTimer = 0;
    }
    bar.appendChild(buildToolbarUtilityButton('toolbar-home', 'Home', 'home', () => {
      if (typeof flyHomeCamera === 'function') flyHomeCamera();
    }, { posType: 'primary' }));
    bar.appendChild(buildToolbarUtilityButton('toolbar-shield-toggle', 'Raise shield', 'shield', () => {
      if (window.VoxelShield && typeof window.VoxelShield.toggle === 'function') window.VoxelShield.toggle();
      else if (typeof ensureVoxelShield === 'function') ensureVoxelShield().toggle();
      updateShieldToolbarState();
    }, { posType: 'shield', pressed: false }));
    const utilityDivider = document.createElement('div');
    utilityDivider.className = 'toolbar-divider toolbar-utility-divider';
    bar.appendChild(utilityDivider);

    const select = TOOLS.find(t => t.id === 'select');
    if (select) bar.appendChild(buildToolButton(select));

    TOOL_GROUPS.forEach(group => {
      const btn = document.createElement('button');
      btn.className = 'tool-group-btn';
      btn.type = 'button';
      btn.dataset.group = group.id;
      const posType = posTypeForToolGroup(group);
      if (posType) btn.dataset.posType = posType;
      btn.title = group.label;
      // Keep an accessible name even when the label text is visually hidden on
      // small screens (icon-only toolbar), so screen readers still announce it.
      btn.setAttribute('aria-label', group.label);
      btn.setAttribute('data-tooltip', group.label);
      const icon = document.createElement('span');
      icon.className = 'group-icon';
      icon.innerHTML = toolbarIconSvg(group.id);
      btn.appendChild(icon);
      const lbl = document.createElement('span');
      lbl.textContent = group.label;
      btn.appendChild(lbl);
      const chev = document.createElement('span');
      chev.className = 'chev';
      chev.textContent = '▴';
      btn.appendChild(chev);
      btn.addEventListener('click', e => {
        e.stopPropagation();
        showToolGroup(group, btn);
      });
      bar.appendChild(btn);
    });

    const divider = document.createElement('div');
    divider.className = 'toolbar-divider';
    bar.appendChild(divider);

    const erase = TOOLS.find(t => t.id === 'erase');
    if (erase) bar.appendChild(buildToolButton(erase));

    const audioPanel = document.getElementById('audio-panel');
    if (audioPanel) bar.appendChild(audioPanel);
    updateToolActiveStates();
    if (typeof rebuildToolPaletteIfActive === 'function') rebuildToolPaletteIfActive();
    twPerfMark('toolbar:end');
  }

  function updateToolActiveStates() {
    document.querySelectorAll('.tool:not(.toolbar-utility)').forEach(b => {
      const variantId = selectedTool.activeVariant && selectedTool.activeVariant.id;
      const matchesTool = b.dataset.id === selectedTool.id;
      const matchesVariant = !b.dataset.variant || b.dataset.variant === variantId;
      b.classList.toggle('active', matchesTool && matchesVariant);
    });
    const group = groupForTool(selectedTool);
    document.querySelectorAll('.tool-group-btn').forEach(b => {
      const isActive = !!group && b.dataset.group === group.id;
      b.classList.toggle('active', isActive);
      const iconEl = b.querySelector('.group-icon');
      if (!iconEl) return;
      // The active group button shows the *selected tool's* own glyph (so you
      // can see exactly what's selected); inactive groups show their line icon.
      if (isActive) {
        const g = glyphSvgForTool(selectedTool);
        if (g) {
          iconEl.innerHTML = g;
          iconEl.classList.add('group-icon-glyph');
        }
        const pos = posTypeForTool(selectedTool) || posTypeForToolGroup(group);
        if (pos) b.dataset.posType = pos; else b.removeAttribute('data-pos-type');
      } else if (iconEl.classList.contains('group-icon-glyph')) {
        iconEl.innerHTML = toolbarIconSvg(b.dataset.group);
        iconEl.classList.remove('group-icon-glyph');
        const pos = posTypeForToolGroup(group);
        if (pos) b.dataset.posType = pos; else b.removeAttribute('data-pos-type');
      }
    });
    updateShieldToolbarState();
  }

  // Cancel any pending hide so re-opening doesn't immediately stash the
  // flyout back behind a `hidden` attribute.
  let _flyoutHideTimer = 0;
  function _showFlyoutAnimated(flyoutEl) {
    if (_flyoutHideTimer) { clearTimeout(_flyoutHideTimer); _flyoutHideTimer = 0; }
    flyoutEl.hidden = false;
    document.body.classList.add('tool-flyout-open');
    // Force reflow so the next class change actually transitions.
    void flyoutEl.offsetHeight;
    flyoutEl.classList.add('open');
  }
  function _hideFlyoutAnimated(flyoutEl) {
    flyoutEl.classList.remove('open');
    if (_flyoutHideTimer) clearTimeout(_flyoutHideTimer);
    _flyoutHideTimer = setTimeout(() => {
      flyoutEl.hidden = true;
      document.body.classList.remove('tool-flyout-open');
      _flyoutHideTimer = 0;
    }, 260);
  }

  function showToolGroup(group, anchor) {
    const flyoutEl = document.getElementById('flyout');
    renderToolGroupFlyout(flyoutEl, group);
    flyoutEl.classList.add('tool-menu');
    positionFlyout(anchor, flyoutEl);
    _showFlyoutAnimated(flyoutEl);
  }

  function selectTool(t) {
    twPerfMark('selectTool:start:' + (t && t.id ? t.id : 'unknown'));
    selectedTool = t;
    if (!(t && t.mooring) && pendingMooringAnchor) clearPendingMooringAnchor();
    updateToolActiveStates();
    hoverMesh.material = t.erase ? M.hoverErase : M.hover;

    const flyoutEl = document.getElementById('flyout');
    if (t.variants && t.variants.length) {
      if (!t.activeVariant) t.activeVariant = t.variants[0];
      renderFlyout(flyoutEl, t);
      flyoutEl.classList.remove('tool-menu');
      const btn = document.querySelector('.tool[data-id="' + t.id + '"]');
      if (btn) positionFlyout(btn, flyoutEl);
      _showFlyoutAnimated(flyoutEl);
    } else {
      _hideFlyoutAnimated(flyoutEl);
    }
    // Rebuild the ghost preview for the new tool — reset any
    // user-applied rotation/offset so they don't bleed across tools.
    ensureGhostPreview();
    resetGhostTransform();
    rememberSelectedStampTool(t);
    syncModelStampSettingsPanel(t);
    refreshOpenStampBuilderCards();
    updateModeIndicator();
    // Island tool: snap the hologram to a default free 8-grid slot immediately,
    // so "add island" shows it in place rather than waiting for a click.
    if (t && t.island && typeof onIslandToolSelected === 'function') onIslandToolSelected();
    else if (typeof clearIslandPlacementHolos === 'function') clearIslandPlacementHolos();
    twPerfMark('selectTool:end:' + (t && t.id ? t.id : 'unknown'));
  }

  // -------- mode indicator --------
  // A persistent HUD chip that names the current mode so a click never starts
  // building by surprise. Select/Move reads calm; any build/paint/erase tool
  // reads "armed" (coloured) so it's obvious the canvas is hot.
  function modeDescriptor(t) {
    if (!t || t.select) return { cls: 'select', label: window.t('mode.select.label'), sub: window.t('mode.select.sub') };
    if (t.erase) return { cls: 'erase', label: window.t('mode.erase.label'), sub: window.t('mode.erase.sub') };
    if (t.auto) return { cls: 'build', label: window.t('mode.auto.label'), sub: window.t('mode.auto.sub') };
    if (t.island) return { cls: 'build', label: window.t('mode.island.label'), sub: window.t('mode.island.sub') };
    if (t.mooring) return { cls: 'build', label: window.t('mode.connect.label'), sub: window.t('mode.connect.sub') };
    const variant = t.activeVariant && t.activeVariant.label ? ' · ' + t.activeVariant.label : '';
    const noun = t.terrain ? window.t('mode.painting') : window.t('mode.building');
    return { cls: 'build', label: noun + ': ' + t.label + variant, sub: window.t('mode.build.sub') };
  }
  function updateModeIndicator() {
    const el = document.getElementById('mode-indicator');
    if (!el) return;
    const d = modeDescriptor(selectedTool);
    el.className = 'mode-indicator mode-' + d.cls;
    const labelEl = el.querySelector('.mode-label');
    const subEl = el.querySelector('.mode-sub');
    if (labelEl) labelEl.textContent = d.label;
    if (subEl) subEl.textContent = d.sub;
    el.setAttribute('aria-label', d.label + '. ' + d.sub);
  }

  function renderToolGroupFlyout(el, group) {
    el.innerHTML = '';
    group.toolIds.forEach(id => {
      const tool = TOOLS.find(t => t.id === id);
      if (!tool || tool.hidden) return;
      // Don't bury the building types behind a second click: the Build
      // menu shows the house variants directly (Cottage / Manor / Tower /
      // Castle / High-rise), so no feature disappeared when the toolbar
      // was grouped.
      if (((group.id === 'build' && tool.id === 'house') || (group.id === 'infra' && tool.id === 'fence')) && tool.variants) {
        tool.variants.forEach(v => el.appendChild(buildVariantToolButton(tool, v)));
        return;
      }
      el.appendChild(buildToolButton(tool, { flyout: true }));
    });
    // Lay the popout out as a compact 2-row block: columns = ceil(n / 2) so
    // the icons fill row-major across two rows instead of one long strip.
    const n = el.children.length;
    el.style.gridTemplateColumns = 'repeat(' + Math.max(1, Math.ceil(n / 2)) + ', auto)';
    updateToolActiveStates();
  }

  function renderFlyout(el, tool) {
    el.innerHTML = '';
    el.style.gridTemplateColumns = '';
    tool.variants.forEach(v => {
      const item = document.createElement('button');
      item.className = 'flyout-item' + (v === tool.activeVariant ? ' active' : '');
      item.textContent = v.label;
      if (v.hint) item.title = v.hint;
      item.addEventListener('click', e => {
        e.stopPropagation();
        tool.activeVariant = v;
        renderFlyout(el, tool);
        if (typeof refreshToolThumb === 'function') refreshToolThumb(tool.id);
        rememberSelectedStampTool(tool);
        refreshOpenStampBuilderCards();
        // Active variant changed → rebuild the ghost preview to match.
        ensureGhostPreview();
        resetGhostTransform();
      });
      el.appendChild(item);
    });
  }

  function positionFlyout(btn, flyoutEl) {
    const r = btn.getBoundingClientRect();
    const toolbarEl = btn.closest('.toolbar');
    const dockTop = toolbarEl ? toolbarEl.getBoundingClientRect().top : r.top;
    flyoutEl.style.left   = (r.left + r.width / 2) + 'px';
    flyoutEl.style.top    = 'auto';
    flyoutEl.style.bottom = (window.innerHeight - dockTop + 10) + 'px';
  }

  document.addEventListener('click', e => {
    const flyoutEl = document.getElementById('flyout');
    if (!flyoutEl || flyoutEl.hidden || !flyoutEl.classList.contains('tool-menu')) return;
    if (flyoutEl.contains(e.target) || e.target.closest('.tool-group-btn')) return;
    _hideFlyoutAnimated(flyoutEl);
  });

  function setAutoBusy(isBusy) {
    autoBusy = isBusy;
    const btn = document.querySelector('.tool[data-id="auto"]');
    if (!btn) return;
    btn.classList.toggle('busy', isBusy);
    btn.title = isBusy ? 'Auto is choosing' : 'Auto (0)';
  }

  function fenceSideFromHover(cell) {
    const variant = selectedTool.activeVariant;
    const requested = variant && variant.fenceSide;
    if (requested && requested !== 'auto') return normalizeFenceSide(requested);
    if (cell && cell.drawFenceSide) return normalizeFenceSide(cell.drawFenceSide);
    if (!cell || !Number.isFinite(cell.localX) || !Number.isFinite(cell.localZ)) return 'n';
    const d = [
      { side: 'w', value: Math.abs(cell.localX + 0.5) },
      { side: 'e', value: Math.abs(0.5 - cell.localX) },
      { side: 'n', value: Math.abs(cell.localZ + 0.5) },
      { side: 's', value: Math.abs(0.5 - cell.localZ) },
    ].sort((a, b) => a.value - b.value);
    return d[0].side;
  }

  function fenceLevelFromSelectedTool() {
    const variant = selectedTool && selectedTool.activeVariant;
    const level = variant && Number.isFinite(variant.floors) ? variant.floors : 1;
    return Math.max(1, Math.min(MAX_FLOORS, level || 1));
  }

  function fenceAppearanceFromSelectedTool() {
    const variant = selectedTool && selectedTool.activeVariant;
    const style = typeof normalizeFenceStyle === 'function' ? normalizeFenceStyle(variant && variant.fenceStyle) : 'wood';
    return style === 'garden' ? { fenceStyle: 'garden' } : null;
  }
