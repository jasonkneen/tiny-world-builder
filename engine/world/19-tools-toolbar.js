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
        { id: 'auto',       label: 'Auto',      buildingType: null,         hint: 'cluster + auto-promo' },
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
        { id: 'edge',    label: 'Edge',      fenceSide: 'auto',     hint: 'nearest clicked edge' },
        { id: 'wall',    label: 'Wall',      fenceSide: 'auto', floors: 4, hint: 'stone wall on nearest clicked edge' },
        { id: 'boundary', label: 'Boundary', fenceSide: 'auto', floors: 5, hint: 'steel boundary on nearest clicked edge' },
        { id: 'north',   label: 'North',     fenceSide: 'n',        hint: 'north tile edge' },
        { id: 'east',    label: 'East',      fenceSide: 'e',        hint: 'east tile edge' },
        { id: 'south',   label: 'South',     fenceSide: 's',        hint: 'south tile edge' },
        { id: 'west',    label: 'West',      fenceSide: 'w',        hint: 'west tile edge' },
        { id: 'center-x', label: 'Center X', fenceSide: 'center-x', hint: 'center rail east-west' },
        { id: 'center-z', label: 'Center Z', fenceSide: 'center-z', hint: 'center rail north-south' },
      ],
    },
    { id: 'rock',   label: 'Rock',   kind: 'rock',  color: '#9b9a8f', shortcut: '8', group: 'nature' },
    { id: 'bridge', label: 'Bridge', kind: 'bridge', terrainOverride: 'water', color: '#8b5a32', shortcut: '9', group: 'build' },
    { id: 'mooring', label: 'Mooring', mooring: true, color: '#171b20', shortcut: 'm', group: 'infra' },
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
    { id: 'terrain', label: 'Terrain', toolIds: ['grass', 'path', 'dirt', 'water', 'stone', 'lava', 'sand', 'snow', 'rock'], iconTool: 'grass' },
    { id: 'plants', label: 'Plants', toolIds: ['tree', 'tuft', 'flower', 'bush'], iconTool: 'tree' },
    { id: 'build', label: 'Build', toolIds: ['house', 'new-island'], iconTool: 'house' },
    { id: 'infra', label: 'Infra', toolIds: ['fence', 'bridge', 'mooring'], iconTool: 'fence' },
    { id: 'farm', label: 'Farm', toolIds: ['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower'], iconTool: 'wheat' },
    { id: 'life', label: 'Life', toolIds: ['cow', 'sheep'], iconTool: 'cow' },
  ];

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
      // A pre-baked PNG is on its way for this tool — wait for the image to
      // finish loading rather than spinning up the WebGL renderer. Bounded so
      // a missing/broken icon still falls back to a live render.
      if (hasOrExpectsStaticIcon(item.tool) === 'pending') {
        item._iconWaits = (item._iconWaits || 0) + 1;
        if (item._iconWaits < 40) {
          toolThumbBuildQueue.push(item);
          toolThumbQueuedCanvases.add(item.canvas);
          built++; // yield this pass; the scheduled retry picks it up once the PNG lands
          continue;
        }
      }
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
    if (k === 'fence') {
      const v = tool.activeVariant;
      const level = Math.max(1, Math.min(MAX_FLOORS, (v && v.floors) || 1));
      return makeVoxelFence('n', level);
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

  // Camera framing for a tool's thumbnail/icon. Buildings need a taller
  // frustum than cottages, and islands need a wider one — shared by the live
  // 3D thumbnail path and the offline icon baker so both frame identically.
  function thumbFrameFor(tool) {
    const houseType = tool.kind === 'house' && tool.activeVariant && tool.activeVariant.buildingType;
    if (tool.kind === 'house') {
      if (houseType === 'skyscraper') return { left: -1.7, right: 1.7, top: 2.6, bottom: -1.0, lookAtY: 1.0 };
      if (houseType === 'tower' || houseType === 'turret') return { left: -1.58, right: 1.58, top: 2.15, bottom: -0.95, lookAtY: 0.85 };
      if (houseType === 'manor') return { left: -1.48, right: 1.48, top: 1.9, bottom: -0.95, lookAtY: 0.68 };
      return { left: -1.36, right: 1.36, top: 1.65, bottom: -0.95, lookAtY: 0.56 };
    }
    if (tool.island) return { left: -2.15, right: 2.15, top: 1.62, bottom: -1.55, lookAtY: 0.12 };
    return { left: -1.3, right: 1.3, top: 1.3, bottom: -1.3, lookAtY: 0.4 };
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

    // Buildings need variant-specific framing (see thumbFrameFor).
    const thumbFrame = thumbFrameFor(tool);
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

  // -------- pre-baked PNG icons --------
  // The live 3D thumbnail renderer (buildToolThumb) is expensive: it spins up
  // an off-DOM WebGL context and renders a scene per tool. To avoid that at
  // runtime we ship pre-baked PNGs (see tools/bake-icons.js + icons/). At boot
  // we load them straight into thumbBitmapCache so every toolbar button, stamp
  // card, and ghost preview blits a bitmap instead of building a scene. The
  // WebGL path stays only as a fallback for user-imported stamps with no
  // pre-baked icon.
  const ICON_BAKE_SIZE = 256;          // logical px the baker renders each icon at
  const staticIconImages = new Map();  // cache key -> loaded HTMLImageElement (for ghost billboards)
  let staticIconManifest = null;       // { version, icons: { key: filename } } or null until loaded

  // Render a single tool to a transparent PNG data URL. Object tools are cut
  // out on alpha (no ground tile) so they read as clean icons and double as
  // ghost billboards; pure terrain tools keep their tile so the material shows.
  // Reuses the shared thumb renderer + framing so baked icons match the look
  // the live thumbnails used to produce.
  function bakeToolIcon(tool, opts) {
    if (!window.THREE) return null;
    ensureThumbRenderer();
    const size = (opts && opts.size) || ICON_BAKE_SIZE;
    const showTile = !tool.kind; // terrain/island tools keep ground context; objects are cut out
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.30));
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb39879, 0.42));
    const sun = new THREE.DirectionalLight(0xffffff, 1.18);
    sun.position.set(3, 6, 2);
    scene.add(sun);
    if (showTile && !tool.island) {
      scene.add(makeTile(thumbTerrainFor(tool), { path: {}, terrain: {} }, 0, 0, 1));
    }
    const obj = makeThumbObject(tool);
    if (obj) { obj.position.y = TOP_H; scene.add(obj); }
    scene.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    const f = thumbFrameFor(tool);
    const cam = new THREE.OrthographicCamera(f.left, f.right, f.top, f.bottom, 0.1, 30);
    const r = 3.4;
    const lookY = f.lookAtY != null ? f.lookAtY : 0.4;
    cam.position.set(Math.cos(THUMB_BASE_ANGLE) * r, 2.4 + lookY, Math.sin(THUMB_BASE_ANGLE) * r);
    cam.lookAt(0, lookY, 0);
    const prevAlpha = thumbRenderer.getClearAlpha();
    thumbRenderer.setClearColor(0x000000, 0); // transparent background
    thumbRenderer.setSize(size, size, false);
    thumbRenderer.render(scene, cam);
    let url = null;
    try { url = thumbRenderer.domElement.toDataURL('image/png'); } catch (_) {}
    thumbRenderer.setClearAlpha(prevAlpha);
    thumbRenderer.setSize(THUMB_SIZE, THUMB_SIZE, false); // restore for live thumbs
    try { scene.traverse(o => safeDisposeGeometry(o.geometry)); } catch (_) {}
    return url;
  }

  // Offline hook called by tools/bake-icons.js inside headless Chromium. Walks
  // every paintable tool + variant and returns [{ key, url }] so the baker can
  // write one PNG per cache key. Guarded behind the global so production never
  // calls it accidentally.
  window.__twBakeIcons = function bakeAllToolIcons(opts) {
    const out = [];
    const seen = new Set();
    const emit = (tool) => {
      const key = thumbCacheKeyForTool(tool);
      if (!key || seen.has(key)) return;
      const url = bakeToolIcon(tool, opts);
      if (url) { seen.add(key); out.push({ key, url }); }
    };
    for (const t of TOOLS) {
      if (t.select || t.auto || t.erase || t.mooring) continue; // no object to render
      emit(Object.assign({}, t, { activeVariant: null }));
      if (t.variants && t.variants.length) {
        for (const v of t.variants) emit(Object.assign({}, t, { activeVariant: v }));
      }
    }
    return out;
  };

  function getStaticIconImage(key) {
    const img = staticIconImages.get(key);
    return img && img.complete && img.naturalWidth ? img : null;
  }

  function repaintToolThumbsForKey(key) {
    toolThumbCanvases.forEach(({ tool, canvas }) => {
      if (canvas && canvas.isConnected && thumbCacheKeyForTool(tool) === key) drawCachedThumb(canvas, key);
    });
  }

  // Fetch the manifest and load each PNG into thumbBitmapCache. Because the
  // existing thumb pipeline already checks that cache first, populating it here
  // means the WebGL renderer is never created for any tool that has an icon.
  function preloadStaticIcons() {
    if (staticIconManifest) return;
    fetch('icons/manifest.json', { cache: 'force-cache' })
      .then(r => (r && r.ok ? r.json() : null))
      .then(manifest => {
        if (!manifest || !manifest.icons) return;
        staticIconManifest = manifest;
        Object.keys(manifest.icons).forEach(key => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            try {
              c.getContext('2d').drawImage(img, 0, 0);
              thumbBitmapCache.set(key, c);
              repaintToolThumbsForKey(key);
              // If the held tool just gained its icon, upgrade the live ghost.
              if (selectedTool && thumbCacheKeyForTool(selectedTool) === key &&
                  typeof window.__twRefreshGhostPreview === 'function') {
                window.__twRefreshGhostPreview();
              }
            } catch (_) {}
          };
          img.src = 'icons/' + manifest.icons[key];
          staticIconImages.set(key, img);
        });
      })
      .catch(() => {});
  }

  // True when the tool has (or is expected to have) a pre-baked icon, so the
  // WebGL build queue can wait for the PNG instead of rendering a scene.
  function hasOrExpectsStaticIcon(tool) {
    const key = thumbCacheKeyForTool(tool);
    if (thumbBitmapCache.has(key)) return 'ready';
    if (staticIconManifest && staticIconManifest.icons && staticIconManifest.icons[key]) return 'pending';
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
      ['infra', /(^|[^a-z0-9])(fence|bridge|road|rail|path|street|wall|boundary|dock|pier)(?=[^a-z0-9]|$)/],
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
      grass: '#93c66b',
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
      'house', 'tree', 'rock', 'bridge', 'fence',
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
        if (status) status.textContent = (asset ? asset.format.toUpperCase() : 'Model') + ' detected, but only GLB/GLTF/OBJ are placeable right now';
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
          : 'No stamps yet. Drop GLB/OBJ files into models/ or import a voxel build JSON.';
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
        deleteBtn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          if (!confirm('Delete template "' + tool.label + '"?')) return;
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
      select: '<svg viewBox="0 0 24 24"><path d="M4 3.5 18.8 11l-6.2 1.6-3.1 6.2Z"/></svg>',
      erase: '<svg viewBox="0 0 24 24"><path d="M4 6.5h16"/><path d="M9 6.5V4.7c0-.9.7-1.6 1.6-1.6h2.8c.9 0 1.6.7 1.6 1.6v1.8"/><path d="m18.5 6.5-.8 13.1c-.1.8-.8 1.4-1.6 1.4H7.9c-.8 0-1.5-.6-1.6-1.4L5.5 6.5"/><path d="M10 11v5.5"/><path d="M14 11v5.5"/></svg>',
      terrain: '<svg viewBox="0 0 24 24"><path d="M3 19.5 9.2 7.7l4.1 7.1 2.3-3.2 5.4 7.9Z"/><path d="m9.2 7.7 2.2 3.7"/></svg>',
      plants: '<svg viewBox="0 0 24 24"><path d="M12 21V11"/><path d="M12 11C8.2 10.7 6 8.4 5.4 4.5 9.2 4.8 11.4 7.1 12 11Z"/><path d="M12 13c3.7-.3 5.9-2.6 6.5-6.5-3.8.3-6 2.6-6.5 6.5Z"/><path d="M7 21h10"/></svg>',
      build: '<svg viewBox="0 0 24 24"><path d="M3.5 10.2 12 3.8l8.5 6.4"/><path d="M5.8 9.4v10.1h12.4V9.4"/><path d="M10 19.5v-5.2h4v5.2"/></svg>',
      infra: '<svg viewBox="0 0 24 24"><circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="6" r="2.6"/><path d="M8.6 18H16a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h7.4"/></svg>',
      mooring: '<svg viewBox="0 0 24 24"><circle cx="5.6" cy="17.8" r="2.3"/><circle cx="18.4" cy="6.2" r="2.3"/><path d="M7.8 17.6c4.8-.6 8.8-4.2 10.2-9.2"/><path d="M4.2 15.8 7 18.9"/><path d="M17 4.1 20.1 7"/></svg>',
      farm: '<svg viewBox="0 0 24 24"><path d="M12 21V5"/><path d="M7.2 8.1 12 12.9l4.8-4.8"/><path d="M7.2 13.2 12 18l4.8-4.8"/><path d="M5 20h14"/></svg>',
      life: '<svg viewBox="0 0 24 24"><circle cx="7.5" cy="10" r="2.2"/><circle cx="12" cy="7" r="2.2"/><circle cx="16.5" cy="10" r="2.2"/><path d="M6.6 17.6c0-3.2 2.4-5.4 5.4-5.4s5.4 2.2 5.4 5.4c0 1.5-.9 2.4-2.2 2.4-1.1 0-1.8-.8-3.2-.8s-2.1.8-3.2.8c-1.3 0-2.2-.9-2.2-2.4Z"/></svg>',
    };
    return icons[id] || '';
  }

  function buildToolButton(t, opts) {
    const btn = document.createElement('button');
    btn.className = 'tool' + ((opts && opts.flyout) ? ' flyout-tool' : '') + ((t.eraser || t.select || t.mooring) ? ' icon-only' : '');
    btn.dataset.id = t.id;
    btn.type = 'button';
    const toolTip = t.label + (t.shortcut ? ' (' + t.shortcut.toUpperCase() + ')' : '');
    btn.title = toolTip;
    btn.setAttribute('data-tooltip', toolTip);

    if (t.eraser || t.select || t.mooring) {
      const icon = document.createElement('span');
      icon.className = 'tool-icon';
      icon.innerHTML = toolbarIconSvg(t.eraser ? 'erase' : (t.mooring ? 'mooring' : 'select'));
      btn.appendChild(icon);
    } else if (t.auto) {
      const swatch = document.createElement('div');
      swatch.className = 'swatch auto';
      btn.appendChild(swatch);
    } else {
      const canvas = document.createElement('canvas');
      canvas.className = 'tool-thumb';
      canvas.width = THUMB_SIZE;
      canvas.height = THUMB_SIZE;
      canvas.style.width = ((opts && opts.flyout) ? 42 : 30) + 'px';
      canvas.style.height = ((opts && opts.flyout) ? 42 : 30) + 'px';
      btn.appendChild(canvas);
      scheduleToolThumbBuild(t, canvas, { priority: !!(opts && opts.flyout) });
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
        selectTool(t);
      });
    }
    if (!t.eraser && !t.auto) {
      btn.addEventListener('pointerenter', e => {
        if (e.pointerType === 'mouse') startThumbHover(t.id);
      });
      btn.addEventListener('pointerleave', e => {
        if (e.pointerType === 'mouse') stopThumbHover(t.id);
      });
    }
    if (t === selectedTool) btn.classList.add('active');
    return btn;
  }

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
    const worldBtn = document.getElementById('world-menu-btn');
    if (worldBtn) {
      const slot = document.createElement('div');
      slot.className = 'toolbar-world-slot';
      slot.appendChild(worldBtn);
      bar.appendChild(slot);
    }
    const select = TOOLS.find(t => t.id === 'select');
    if (select) bar.appendChild(buildToolButton(select));

    TOOL_GROUPS.forEach(group => {
      const rep = TOOLS.find(t => t.id === group.iconTool) || TOOLS.find(t => t.id === group.toolIds[0]);
      const btn = document.createElement('button');
      btn.className = 'tool-group-btn';
      btn.type = 'button';
      btn.dataset.group = group.id;
      btn.title = group.label;
      btn.setAttribute('data-tooltip', group.label);
      const icon = document.createElement('span');
      icon.className = 'group-icon';
      icon.innerHTML = toolbarIconSvg(group.id);
      btn.appendChild(icon);
      if (rep && !rep.eraser && !rep.auto) {
        const canvas = document.createElement('canvas');
        canvas.className = 'tool-thumb';
        canvas.width = THUMB_SIZE;
        canvas.height = THUMB_SIZE;
        canvas.style.width = '30px';
        canvas.style.height = '30px';
        btn.appendChild(canvas);
        const thumbTool = Object.assign({}, rep, { id: 'group-' + group.id, label: group.label });
        scheduleToolThumbBuild(thumbTool, canvas);
      }
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
    const soundIcon = document.getElementById('sound-icon');
    if (soundIcon) bar.appendChild(soundIcon);
    updateToolActiveStates();
    twPerfMark('toolbar:end');
  }

  function updateToolActiveStates() {
    document.querySelectorAll('.tool').forEach(b => {
      const variantId = selectedTool.activeVariant && selectedTool.activeVariant.id;
      const matchesTool = b.dataset.id === selectedTool.id;
      const matchesVariant = !b.dataset.variant || b.dataset.variant === variantId;
      b.classList.toggle('active', matchesTool && matchesVariant);
    });
    const group = groupForTool(selectedTool);
    document.querySelectorAll('.tool-group-btn').forEach(b => {
      b.classList.toggle('active', !!group && b.dataset.group === group.id);
    });
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
    updateSuggestions(t);
    twPerfMark('selectTool:end:' + (t && t.id ? t.id : 'unknown'));
  }

  // -------- mode indicator --------
  // A persistent HUD chip that names the current mode so a click never starts
  // building by surprise. Select/Move reads calm; any build/paint/erase tool
  // reads "armed" (coloured) so it's obvious the canvas is hot.
  function modeDescriptor(t) {
    if (!t || t.select) return { cls: 'select', label: 'Select / Move', sub: 'Click to inspect — drag to orbit' };
    if (t.erase) return { cls: 'erase', label: 'Erasing', sub: 'Click a cell to remove' };
    if (t.auto) return { cls: 'build', label: 'Auto', sub: 'AI suggests placements' };
    if (t.island) return { cls: 'build', label: 'New Island', sub: 'Click empty space to add land' };
    if (t.mooring) return { cls: 'build', label: 'Mooring', sub: 'Pin two anchors to link' };
    const variant = t.activeVariant && t.activeVariant.label ? ' · ' + t.activeVariant.label : '';
    const noun = t.terrain ? 'Painting' : 'Building';
    return { cls: 'build', label: noun + ': ' + t.label + variant, sub: 'Esc to return to Select' };
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

  // -------- deterministic next-item suggestions --------
  // A fixed rule map: given the tool you're holding, what do builders usually
  // reach for next? Rules are deterministic (no AI) so the "Next" strip is
  // predictable. The first entry is usually "continue with the same tool"
  // (e.g. keep laying wall segments). { id, variant } resolves to a tool +
  // optional variant id.
  const SUGGESTION_RULES = {
    grass:  [{ id: 'tree' }, { id: 'path' }, { id: 'house' }, { id: 'flower' }],
    path:   [{ id: 'path' }, { id: 'house' }, { id: 'tree' }, { id: 'grass' }],
    dirt:   [{ id: 'crop' }, { id: 'wheat' }, { id: 'fence' }],
    water:  [{ id: 'bridge' }, { id: 'water' }, { id: 'rock' }],
    stone:  [{ id: 'house', variant: 'turret' }, { id: 'fence', variant: 'wall' }, { id: 'rock' }],
    sand:   [{ id: 'water' }, { id: 'rock' }, { id: 'tuft' }],
    snow:   [{ id: 'tree' }, { id: 'rock' }, { id: 'house', variant: 'cottage' }],
    house:  [{ id: 'path' }, { id: 'fence' }, { id: 'tree' }, { id: 'house' }],
    fence:  [{ id: 'fence' }, { id: 'house' }, { id: 'path' }, { id: 'tree' }],
    bridge: [{ id: 'bridge' }, { id: 'path' }, { id: 'house' }],
    tree:   [{ id: 'tree' }, { id: 'bush' }, { id: 'flower' }, { id: 'tuft' }],
    bush:   [{ id: 'bush' }, { id: 'tree' }, { id: 'flower' }],
    flower: [{ id: 'flower' }, { id: 'tuft' }, { id: 'bush' }],
    tuft:   [{ id: 'tuft' }, { id: 'flower' }, { id: 'tree' }],
    rock:   [{ id: 'rock' }, { id: 'tree' }, { id: 'tuft' }],
    crop:   [{ id: 'crop' }, { id: 'corn' }, { id: 'wheat' }, { id: 'fence' }],
    corn:   [{ id: 'corn' }, { id: 'wheat' }, { id: 'pumpkin' }],
    wheat:  [{ id: 'wheat' }, { id: 'corn' }, { id: 'sunflower' }],
    pumpkin:[{ id: 'pumpkin' }, { id: 'carrot' }, { id: 'crop' }],
    carrot: [{ id: 'carrot' }, { id: 'pumpkin' }, { id: 'crop' }],
    sunflower:[{ id: 'sunflower' }, { id: 'wheat' }, { id: 'flower' }],
    cow:    [{ id: 'cow' }, { id: 'sheep' }, { id: 'fence' }],
    sheep:  [{ id: 'sheep' }, { id: 'cow' }, { id: 'fence' }],
    'new-island': [{ id: 'grass' }, { id: 'house' }, { id: 'tree' }],
  };

  function resolveSuggestion(spec, currentTool) {
    const base = TOOLS.find(t => t.id === spec.id);
    if (!base || base.hidden) return null;
    // "Continue" suggestions (same tool) keep the variant the user is holding;
    // explicit variant ids override.
    let variant = null;
    if (spec.variant && base.variants) {
      variant = base.variants.find(v => v.id === spec.variant) || null;
    } else if (base.variants) {
      const keep = currentTool && currentTool.id === base.id ? currentTool.activeVariant : null;
      variant = keep || base.activeVariant || base.variants[0];
    }
    return { tool: base, variant };
  }

  function computeSuggestions(tool) {
    if (!tool || tool.select || tool.erase || tool.auto || tool.mooring) return [];
    const rules = SUGGESTION_RULES[tool.id];
    if (!rules) return [];
    const out = [];
    const seen = new Set();
    for (const spec of rules) {
      const r = resolveSuggestion(spec, tool);
      if (!r) continue;
      const sig = r.tool.id + ':' + (r.variant ? r.variant.id : '');
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(r);
      if (out.length >= 4) break;
    }
    return out;
  }

  function suggestionButton(entry, isContinue) {
    const btn = document.createElement('button');
    btn.className = 'suggestion' + (isContinue ? ' suggestion-continue' : '');
    const label = entry.variant && entry.variant.label && entry.tool.variants
      ? entry.tool.label + ' · ' + entry.variant.label
      : entry.tool.label;
    btn.title = (isContinue ? 'Keep placing: ' : 'Next: ') + label;
    const canvas = document.createElement('canvas');
    canvas.className = 'suggestion-icon';
    canvas.width = 48; canvas.height = 48;
    // A throwaway tool object carrying the suggested variant so the icon and
    // the click select the same thing.
    const iconTool = Object.assign({}, entry.tool, { activeVariant: entry.variant || entry.tool.activeVariant || null });
    scheduleToolThumbBuild(iconTool, canvas, { priority: true });
    const text = document.createElement('span');
    text.className = 'suggestion-label';
    text.textContent = isContinue ? 'Continue' : label;
    btn.appendChild(canvas);
    btn.appendChild(text);
    btn.addEventListener('click', () => {
      if (entry.variant) entry.tool.activeVariant = entry.variant;
      selectTool(entry.tool);
    });
    return btn;
  }

  function updateSuggestions(tool) {
    const bar = document.getElementById('suggestion-bar');
    if (!bar) return;
    const list = computeSuggestions(tool);
    bar.innerHTML = '';
    if (!list.length) { bar.hidden = true; return; }
    const title = document.createElement('span');
    title.className = 'suggestion-title';
    title.textContent = 'Next';
    bar.appendChild(title);
    list.forEach((entry, i) => {
      const isContinue = i === 0 && entry.tool.id === (tool && tool.id) &&
        (!entry.variant || !tool.activeVariant || entry.variant === tool.activeVariant);
      bar.appendChild(suggestionButton(entry, isContinue));
    });
    bar.hidden = false;
  }

  // Called from the placement path after a successful drop so the strip stays
  // live as you build (deterministic, so it simply re-asserts the rule set).
  window.__twNotifyPlacement = function notifyPlacement() {
    updateSuggestions(selectedTool);
  };

  function renderToolGroupFlyout(el, group) {
    el.innerHTML = '';
    group.toolIds.forEach(id => {
      const tool = TOOLS.find(t => t.id === id);
      if (!tool || tool.hidden) return;
      // Don't bury the building types behind a second click: the Build
      // menu shows the house variants directly (Cottage / Manor / Tower /
      // Castle / High-rise), so no feature disappeared when the toolbar
      // was grouped.
      if (group.id === 'build' && tool.id === 'house' && tool.variants) {
        tool.variants.forEach(v => el.appendChild(buildVariantToolButton(tool, v)));
        return;
      }
      el.appendChild(buildToolButton(tool, { flyout: true }));
    });
    updateToolActiveStates();
  }

  function renderFlyout(el, tool) {
    el.innerHTML = '';
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

