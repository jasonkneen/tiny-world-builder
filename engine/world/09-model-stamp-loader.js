  // -------- repo model stamp loader --------
  const MODEL_STAMP_MANIFEST_URL = 'models/stamp-manifest.json';
  const MODEL_STAMP_DEFAULTS_LS = 'tinyworld:model-stamp-defaults.v1';
  const MODEL_STAMP_SUPPORTED_FORMATS = new Set(['glb', 'gltf', 'obj']);
  const MODEL_STAMP_DETECTED_FORMATS = new Set(['glb', 'gltf', 'obj', 'fbx']);
  let MODEL_STAMP_ASSETS = [];
  let selectedModelStampId = null;
  let modelStampDefaults = loadModelStampDefaults();
  let modelStampScanMessage = 'Scanning models…';
  const modelStampAssetCache = new Map();
  const modelStampTextureCache = new Map();
  const CROWD_MODEL_CHARACTER_RE = /(character|person|people|human|man|woman|girl|boy|child|townie|avatar|npc|rig|skinned|walk|run|hitman|heisenberg)/i;
  const CROWD_MODEL_NEGATIVE_RE = /(building|house|tower|city|plane|aircraft|airplane|boat|ship|vessel|engine|prop|trap|terrain|tree|rock|vehicle|car|truck)/i;
  const MODEL_STAMP_FALLBACK_PALETTES = {
    building: [0xd7c092, 0xa84f3f, 0x365171, 0x2c3037, 0x7f8c64, 0xf0dec0],
    boat: [0x2f6f8c, 0xa75f3e, 0xf0d7a8, 0x324a5f, 0xe8efe8],
    plane: [0xd84a36, 0xf4e7c3, 0x2d6f93, 0x26364d, 0xf1c15e],
    generic: [0xd4b483, 0x8fb07a, 0x5d86a6, 0xbe6a4a, 0xf0d69c, 0x3b4458],
  };

  function modelStampApiEnabled() {
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return false;
    try {
      const flag = window.__TWB_MODEL_STAMP_API_ENABLED__;
      if (typeof flag === 'boolean') return flag;
      const qs = new URLSearchParams(window.location.search);
      if (qs.get('modelApi') === '1' || qs.get('modelStampApi') === '1') return true;
      if (qs.get('modelApi') === '0' || qs.get('modelStampApi') === '0') return false;
      const stored = window.localStorage && window.localStorage.getItem('tinyworld:features:model-stamp-api');
      return stored === '1';
    } catch (_) {
      return false;
    }
  }

  function modelStampScanApiEnabled() {
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return false;
    try {
      const flag = window.__TWB_MODEL_STAMP_API_ENABLED__;
      if (typeof flag === 'boolean') return flag;
      const qs = new URLSearchParams(window.location.search);
      if (qs.get('modelApi') === '1' || qs.get('modelStampApi') === '1') return true;
      if (qs.get('modelApi') === '0' || qs.get('modelStampApi') === '0') return false;
      const stored = window.localStorage && window.localStorage.getItem('tinyworld:features:model-stamp-api');
      if (stored === '1') return true;
      if (stored === '0') return false;
      return false;
    } catch (_) {
      return false;
    }
  }

  function modelStampIdSafe(id) {
    const clean = String(id || '').trim();
    return /^[a-z0-9][a-z0-9_-]{0,95}$/i.test(clean) ? clean : null;
  }

  function clampModelStampNumber(value, fallback, min, max) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  }

  function normalizeModelStampSettings(value) {
    const v = value && typeof value === 'object' ? value : {};
    return {
      objectScale: +clampModelStampNumber(v.objectScale !== undefined ? v.objectScale : v.scale, 1, 0.2, 4).toFixed(3),
      offsetY: +clampModelStampNumber(v.offsetY, 0, -1, 2).toFixed(3),
      rotationY: +clampModelStampNumber(v.rotationY, 0, -Math.PI * 4, Math.PI * 4).toFixed(6),
    };
  }

  function loadModelStampDefaults() {
    try {
      const raw = JSON.parse(localStorage.getItem(MODEL_STAMP_DEFAULTS_LS) || '{}');
      const src = raw && typeof raw === 'object' && raw.stamps ? raw.stamps : raw;
      const out = {};
      for (const [id, cfg] of Object.entries(src || {})) {
        const safe = modelStampIdSafe(id);
        if (safe) out[safe] = normalizeModelStampSettings(cfg);
      }
      return out;
    } catch (_) {
      return {};
    }
  }

  function persistModelStampDefaults() {
    const payload = { version: 1, stamps: modelStampDefaults };
    try { localStorage.setItem(MODEL_STAMP_DEFAULTS_LS, JSON.stringify(payload)); } catch (_) {}
    // Persist to the signed-in user's account (debounced) alongside their stamps.
    if (typeof window.__tinyworldSyncAssetsToCloud === 'function') window.__tinyworldSyncAssetsToCloud();
    if (modelStampApiEnabled()) {
      fetch('/api/model-stamp-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  }

  // Account-sync bridge: lets the cloud asset-library sync (engine/world/30)
  // read/write per-stamp config without reaching into module-09 internals.
  window.__tinyworldModelStampDefaults = {
    collect() { return modelStampDefaults; },
    apply(stamps) {
      if (!stamps || typeof stamps !== 'object') return false;
      let changed = false;
      for (const [id, cfg] of Object.entries(stamps)) {
        const safe = modelStampIdSafe(id);
        // Fill ids the local copy lacks; never clobber a local edit.
        if (safe && !modelStampDefaults[safe]) {
          modelStampDefaults[safe] = normalizeModelStampSettings(cfg);
          changed = true;
        }
      }
      if (changed) {
        try { localStorage.setItem(MODEL_STAMP_DEFAULTS_LS, JSON.stringify({ version: 1, stamps: modelStampDefaults })); } catch (_) {}
        try { syncModelStampSettingsPanel(selectedTool); } catch (_) {}
        try { refreshOpenStampBuilderCards(); } catch (_) {}
      }
      return changed;
    },
  };

  async function loadModelStampDefaultsConfig() {
    if (!modelStampApiEnabled()) return;
    try {
      const res = await fetch('/api/model-stamp-defaults?ts=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const src = data && data.stamps && typeof data.stamps === 'object' ? data.stamps : null;
      if (!src) return;
      for (const [id, cfg] of Object.entries(src)) {
        const safe = modelStampIdSafe(id);
        if (safe) modelStampDefaults[safe] = normalizeModelStampSettings(cfg);
      }
      try { localStorage.setItem(MODEL_STAMP_DEFAULTS_LS, JSON.stringify({ version: 1, stamps: modelStampDefaults })); } catch (_) {}
      syncModelStampSettingsPanel(selectedTool);
      refreshOpenStampBuilderCards();
    } catch (_) {}
  }

  function getModelStampSettings(id) {
    const safe = modelStampIdSafe(id);
    return normalizeModelStampSettings(safe && modelStampDefaults[safe]);
  }

  function setModelStampSettings(id, settings, persist = false) {
    const safe = modelStampIdSafe(id);
    if (!safe) return null;
    const normalized = normalizeModelStampSettings(settings);
    modelStampDefaults[safe] = normalized;
    if (persist) persistModelStampDefaults();
    return normalized;
  }

  function resetModelStampSettings(id) {
    const safe = modelStampIdSafe(id);
    if (!safe) return;
    delete modelStampDefaults[safe];
    persistModelStampDefaults();
  }

  function getModelStamp(id) {
    const safe = modelStampIdSafe(id);
    return safe ? MODEL_STAMP_ASSETS.find(asset => asset.id === safe) || null : null;
  }

  function normalizeModelStampSidecarFile(raw) {
    const src = typeof raw === 'string' ? { path: raw, url: raw } : raw;
    if (!src || typeof src !== 'object') return null;
    const url = String(src.url || '').trim();
    const sidecarPath = String(src.path || src.name || url).trim();
    if (!url && !sidecarPath) return null;
    const name = String(src.name || sidecarPath.split('/').pop() || 'sidecar').trim().slice(0, 96) || 'sidecar';
    const format = String(src.format || name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return {
      path: sidecarPath || url,
      url: url || sidecarPath,
      name,
      format,
      exists: src.exists !== false,
      size: Number(src.size) || 0,
    };
  }

  function normalizeModelStampSidecars(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const out = { textures: [], mtl: [] };
    if (Array.isArray(src.textures)) out.textures = src.textures.map(normalizeModelStampSidecarFile).filter(Boolean);
    if (Array.isArray(src.mtl)) out.mtl = src.mtl.map(normalizeModelStampSidecarFile).filter(Boolean);
    return out;
  }

  function modelStampAssetWarning(asset) {
    if (!asset) return '';
    if (asset.materialWarning) return asset.materialWarning;
    if (Array.isArray(asset.warnings) && asset.warnings.length) return String(asset.warnings[0] || '').slice(0, 96);
    return '';
  }

  function normalizeModelStampAsset(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const format = String(raw.format || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!MODEL_STAMP_DETECTED_FORMATS.has(format)) return null;
    const id = modelStampIdSafe(raw.id);
    const url = String(raw.url || '').trim();
    if (!id || !url) return null;
    const label = String(raw.label || raw.name || id).trim().slice(0, 64) || id;
    return {
      id,
      label,
      path: String(raw.path || url).trim(),
      url,
      format,
      supported: raw.supported !== false && MODEL_STAMP_SUPPORTED_FORMATS.has(format),
      size: Number(raw.size) || 0,
      mtimeMs: Number(raw.mtimeMs) || 0,
      sidecars: normalizeModelStampSidecars(raw.sidecars),
      warnings: Array.isArray(raw.warnings) ? raw.warnings.map(item => String(item || '').slice(0, 120)).filter(Boolean) : [],
    };
  }

  function mergeModelStampAssets(list) {
    const byId = new Map(MODEL_STAMP_ASSETS.map(asset => [asset.id, asset]));
    for (const raw of Array.isArray(list) ? list : []) {
      const asset = normalizeModelStampAsset(raw);
      if (asset) byId.set(asset.id, asset);
    }
    MODEL_STAMP_ASSETS = Array.from(byId.values()).sort((a, b) => {
      const formatRank = (a.supported === b.supported) ? 0 : (a.supported ? -1 : 1);
      return formatRank || a.label.localeCompare(b.label) || a.path.localeCompare(b.path);
    });
    return MODEL_STAMP_ASSETS;
  }

  async function fetchModelStampList(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.models || data.stamps || []);
  }

  async function refreshModelStampManifest() {
    const endpoints = [];
    if (modelStampScanApiEnabled()) {
      endpoints.push('/api/model-stamps?ts=' + Date.now());
    }
    endpoints.push(MODEL_STAMP_MANIFEST_URL + '?ts=' + Date.now());
    let loaded = false;
    let lastErr = null;
    for (const endpoint of endpoints) {
      try {
        const list = await fetchModelStampList(endpoint);
        mergeModelStampAssets(list);
        loaded = true;
        if (endpoint.indexOf('/api/') === 0) break;
      } catch (err) {
        lastErr = err;
      }
    }
    const supportedCount = MODEL_STAMP_ASSETS.filter(a => a.supported).length;
    const unsupportedCount = MODEL_STAMP_ASSETS.length - supportedCount;
    if (MODEL_STAMP_ASSETS.length) {
      modelStampScanMessage = 'Loaded ' + supportedCount + ' model stamp' + (supportedCount === 1 ? '' : 's') + (unsupportedCount ? ' · ' + unsupportedCount + ' detected but unsupported' : '');
    } else if (loaded) {
      modelStampScanMessage = 'No models found in models/ yet';
    } else {
      modelStampScanMessage = 'Could not scan models' + (lastErr ? ': ' + String(lastErr.message || lastErr).slice(0, 60) : '');
    }
    updateStampBuilderSummary();
    refreshOpenStampBuilderCards();
    ensureCrowdModelCharacterAssetsLoading();
    return MODEL_STAMP_ASSETS;
  }

  function updateStampBuilderSummary() {
    const summary = document.getElementById('stamp-builder-summary');
    if (!summary) return;
    const modelCount = MODEL_STAMP_ASSETS.filter(a => a.supported).length;
    const voxelCount = VOXEL_BUILD_STAMPS.length;
    let templateCount = 0;
    try {
      templateCount = loadAssetTemplates().filter(t => t && t.clipboard && normalizeClipboardCells(t.clipboard.cells).length).length;
    } catch (_) {}
    summary.innerHTML = '<span><strong>' + (modelCount + voxelCount + templateCount) + '</strong> stamp sources</span><span>' + modelStampScanMessage + (templateCount ? ' · ' + templateCount + ' saved template' + (templateCount === 1 ? '' : 's') : '') + '</span>';
  }

  function isStampBuilderPanelOpen() {
    const panel = document.getElementById('stamp-builder-panel');
    return !!(panel && !panel.hidden);
  }

  function refreshOpenStampBuilderCards() {
    if (isStampBuilderPanelOpen() && typeof renderStampBuilderCards === 'function') renderStampBuilderCards();
  }

  function modelStampSignature(asset) {
    return [asset && asset.id, asset && asset.label, asset && asset.path, asset && asset.url].filter(Boolean).join(' ').toLowerCase();
  }

  function modelStampHash(value) {
    let h = 2166136261;
    const text = String(value || 'model-stamp');
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return h >>> 0;
  }

  function modelStampPaletteKind(asset) {
    const sig = modelStampSignature(asset);
    if (/building|buildings|city|house|tower|cottage|villa|skyscraper/.test(sig)) return 'building';
    if (/boat|ship|vessel/.test(sig)) return 'boat';
    if (/plane|aircraft|airplane|stunt|crop-duster|jet/.test(sig)) return 'plane';
    return 'generic';
  }

  function modelStampResolveUrl(asset, ref, baseUrl = null) {
    const clean = String(ref || '').trim().replace(/\\/g, '/');
    if (!clean) return '';
    try {
      if (/^(https?:|data:|blob:|\/)/i.test(clean) || clean.startsWith('models/')) {
        return new URL(clean, window.location.href).href;
      }
      return new URL(clean, new URL(baseUrl || (asset && asset.url) || '', window.location.href)).href;
    } catch (_) {
      const root = String(baseUrl || (asset && asset.url) || '').split('/').slice(0, -1).join('/');
      return (root ? root + '/' : '') + clean;
    }
  }

  function loadModelStampTexture(asset, ref, opts = {}) {
    const raw = typeof ref === 'string' ? ref : (ref && (ref.url || ref.path));
    const url = modelStampResolveUrl(asset, raw, opts.baseUrl || null);
    if (!url) return null;
    const flipKey = opts.flipY === false ? 'noflip' : 'flip';
    const key = url + ':' + flipKey;
    if (!modelStampTextureCache.has(key)) {
      const tex = new THREE.TextureLoader().load(url, () => {
        tex.needsUpdate = true;
        if (opts.modelStampId || (asset && asset.id)) scheduleModelStampRefresh(opts.modelStampId || asset.id);
        repaintAfterTextureLoad();
      }, undefined, err => {
        if (opts.warn !== false) console.warn('[model-stamp] texture failed', url, err);
      });
      tex.flipY = opts.flipY !== false;
      tex.encoding = THREE.sRGBEncoding;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter || THREE.LinearFilter;
      tex.anisotropy = Math.min(8, renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
      modelStampTextureCache.set(key, tex);
    }
    return modelStampTextureCache.get(key);
  }

  function modelStampTextureSidecars(asset) {
    return asset && asset.sidecars && Array.isArray(asset.sidecars.textures) ? asset.sidecars.textures : [];
  }

  function pickModelStampSidecarTexture(asset) {
    const textures = modelStampTextureSidecars(asset).filter(item => item && item.exists !== false);
    if (!textures.length) return null;
    const sig = modelStampSignature(asset);
    if (/plane|aircraft|airplane|stunt|crop-duster|jet/.test(sig)) {
      return textures.find(item => /polygon[_-]?plane[_-]?texture[_-]?01|diffuse|albedo|base.?color/i.test(item.name || item.path)) || textures[0];
    }
    return textures.find(item => /diffuse|albedo|base.?color|color|palette/i.test(item.name || item.path)) || textures[0];
  }

  function modelStampMaterialList(material) {
    return Array.isArray(material) ? material.filter(Boolean) : (material ? [material] : []);
  }

  function prepareModelStampTextureMaterial(material) {
    if (!material) return;
    const mats = modelStampMaterialList(material);
    mats.forEach(mat => {
      if (!mat) return;
      ['map', 'emissiveMap', 'aoMap', 'lightMap'].forEach(key => {
        if (mat[key]) mat[key].encoding = THREE.sRGBEncoding;
      });
      mat.needsUpdate = true;
    });
  }

  function modelStampMaterialIsBlank(material) {
    if (!material) return true;
    if (material.map || material.vertexColors || (material.userData && material.userData.modelStampHydrated)) return false;
    const name = String(material.name || '').toLowerCase();
    if (/palette|default|white|blank|material_?0/.test(name)) return true;
    if (!material.color) return true;
    const r = material.color.r;
    const g = material.color.g;
    const b = material.color.b;
    const nearWhite = r > 0.84 && g > 0.84 && b > 0.84;
    const neutral = Math.abs(r - g) < 0.045 && Math.abs(g - b) < 0.045 && r > 0.62 && r < 0.88;
    return nearWhite || neutral;
  }

  function modelStampMeshNeedsPalette(mesh) {
    if (!mesh || !mesh.isMesh) return false;
    if (mesh.userData && mesh.userData.modelStampForcePalette) return true;
    if (mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.color) return false;
    const mats = modelStampMaterialList(mesh.material);
    return !mats.length || mats.every(modelStampMaterialIsBlank);
  }

  function createModelStampPaletteMaterial(asset) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    mat.name = 'TinyWorld palette fallback';
    mat.userData.modelStampHydrated = 'palette';
    mat.userData.modelStampPaletteKind = modelStampPaletteKind(asset);
    return mat;
  }

  function applyModelStampVertexPalette(mesh, asset, index = 0) {
    const geo = mesh && mesh.geometry;
    const pos = geo && geo.attributes && geo.attributes.position;
    if (!geo || !pos) return false;
    if (!geo.attributes.normal) geo.computeVertexNormals();
    geo.computeBoundingBox();
    const box = geo.boundingBox;
    const minY = box ? box.min.y : 0;
    const spanY = Math.max(0.001, box ? box.max.y - box.min.y : 1);
    const normal = geo.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    const kind = modelStampPaletteKind(asset);
    const palette = MODEL_STAMP_FALLBACK_PALETTES[kind] || MODEL_STAMP_FALLBACK_PALETTES.generic;
    const hash = modelStampHash((asset && asset.id) + ':' + (mesh.name || '') + ':' + index);
    const shade = new THREE.Color(0x252a30);
    const color = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const yNorm = (y - minY) / spanY;
      const ny = normal ? normal.getY(i) : 0;
      const band = Math.floor((Math.atan2(z, x) + Math.PI) * 2.5) + Math.floor(yNorm * 9) + hash;
      let hex = palette[Math.abs(band) % palette.length];
      if (kind === 'building') {
        if (yNorm > 0.72 || (ny > 0.48 && yNorm > 0.56)) hex = palette[1];
        else if (yNorm < 0.10) hex = palette[3];
        else if (yNorm > 0.24 && yNorm < 0.72 && Math.abs(ny) < 0.35 && band % 5 === 0) hex = 0x92b6c8;
        else hex = (band % 4 === 0) ? palette[5] : palette[0];
      } else if (kind === 'boat') {
        if (yNorm < 0.28) hex = palette[0];
        else if (yNorm > 0.72) hex = palette[2];
        else hex = (band % 3 === 0) ? palette[1] : palette[3];
      } else if (kind === 'plane') {
        if (yNorm > 0.58) hex = palette[1];
        else hex = (band % 4 === 0) ? palette[4] : palette[0];
      }
      color.setHex(hex);
      if (ny < -0.12) color.lerp(shade, 0.24);
      else if (Math.abs(ny) < 0.18) color.lerp(shade, 0.10);
      color.toArray(colors, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.attributes.color.needsUpdate = true;
    mesh.material = createModelStampPaletteMaterial(asset);
    mesh.userData.modelStampPaletteApplied = true;
    return true;
  }

  function applyModelStampSidecarTexture(root, asset, textureRecord, opts = {}) {
    const texture = loadModelStampTexture(asset, textureRecord, { flipY: opts.flipY, modelStampId: asset && asset.id });
    if (!texture) return 0;
    const force = /plane|aircraft|airplane|stunt|crop-duster|jet/.test(modelStampSignature(asset));
    let applied = 0;
    root.traverse(node => {
      if (!node.isMesh || !node.geometry || !node.geometry.attributes || !node.geometry.attributes.uv) return;
      const mats = modelStampMaterialList(node.material);
      if (!force && mats.length && !mats.every(modelStampMaterialIsBlank)) return;
      const hydrate = mat => {
        const next = mat && mat.clone ? mat.clone() : new THREE.MeshLambertMaterial({ color: 0xffffff });
        if (next.color) next.color.set(0xffffff);
        next.map = texture;
        next.vertexColors = false;
        next.userData = Object.assign({}, next.userData, { modelStampHydrated: 'texture' });
        next.needsUpdate = true;
        return next;
      };
      node.material = Array.isArray(node.material) ? node.material.map(hydrate) : hydrate(node.material);
      applied++;
    });
    return applied;
  }

  function hydrateModelStampScene(root, asset, opts = {}) {
    if (!root) return root;
    let textured = 0;
    let palette = 0;
    root.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      prepareModelStampTextureMaterial(node.material);
    });
    const textureRecord = pickModelStampSidecarTexture(asset);
    if (textureRecord) textured = applyModelStampSidecarTexture(root, asset, textureRecord, { flipY: opts.flipY });
    root.traverse(node => {
      if (modelStampMeshNeedsPalette(node) && applyModelStampVertexPalette(node, asset, palette)) palette++;
    });
    if (asset) {
      if (textured) asset.materialStatus = 'sidecar texture';
      else if (palette) asset.materialStatus = 'TinyWorld palette fallback';
      else asset.materialStatus = 'original materials';
      if (!asset.materialWarning && Array.isArray(asset.warnings) && asset.warnings.length) asset.materialWarning = asset.warnings[0];
    }
    return root;
  }

  function cloneModelStampScene(source) {
    const sourceNodes = [];
    source.traverse(node => sourceNodes.push(node));
    const clone = source.clone(true);
    const cloneNodes = [];
    clone.traverse(node => cloneNodes.push(node));
    const cloneBySource = new Map();
    sourceNodes.forEach((node, index) => {
      if (cloneNodes[index]) cloneBySource.set(node, cloneNodes[index]);
    });
    cloneNodes.forEach((node, index) => {
      const sourceNode = sourceNodes[index];
      if (!sourceNode || !sourceNode.isSkinnedMesh || !sourceNode.skeleton || !node.isSkinnedMesh) return;
      const bones = sourceNode.skeleton.bones.map(bone => cloneBySource.get(bone) || bone);
      const boneInverses = sourceNode.skeleton.boneInverses.map(inverse => inverse.clone());
      node.skeleton = new THREE.Skeleton(bones, boneInverses);
      if (sourceNode.bindMatrix) node.bindMatrix.copy(sourceNode.bindMatrix);
      if (sourceNode.bindMatrixInverse) node.bindMatrixInverse.copy(sourceNode.bindMatrixInverse);
      if (node.bind && node.bindMatrix) node.bind(node.skeleton, node.bindMatrix);
    });
    clone.traverse(node => {
      if (!node.isMesh) return;
      if (node.geometry && node.geometry.clone) node.geometry = node.geometry.clone();
      node.castShadow = true;
      node.receiveShadow = true;
      prepareModelStampTextureMaterial(node.material);
    });
    return clone;
  }

  function normalizeModelStampObject(root, asset) {
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const spanXZ = Math.max(size.x, size.z, 0.01);
    const visualSpan = Math.max(spanXZ, size.y * 0.42, 0.01);
    const target = asset && asset.format === 'obj' ? 0.86 : 0.92;
    const scale = target / visualSpan;
    root.position.set(-center.x, -box.min.y, -center.z);
    const wrapper = new THREE.Group();
    wrapper.add(root);
    wrapper.scale.setScalar(scale);
    wrapper.userData = { kind: 'model-stamp', modelStampId: asset && asset.id, name: asset && asset.label, chimneyTops: [] };
    castReceive(wrapper);
    return wrapper;
  }

  function makeModelStampPlaceholder(asset, message) {
    const g = new THREE.Group();
    const baseMat = new THREE.MeshLambertMaterial({ color: asset && asset.supported === false ? 0xb48c73 : 0xb5b8aa });
    const topMat = new THREE.MeshLambertMaterial({ color: asset && asset.format === 'obj' ? 0x8aa4b8 : 0x9b8bb8 });
    const base = new THREE.Mesh(getBoxGeometry(0.54, 0.12, 0.54), baseMat);
    base.position.y = 0.06;
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.30, 0), topMat);
    body.position.y = 0.34;
    body.scale.set(1.06, 0.72, 0.92);
    const cap = new THREE.Mesh(getBoxGeometry(0.34, 0.04, 0.18), M.wallTrim);
    cap.position.y = 0.61;
    g.add(base, body, cap);
    g.userData = { kind: 'model-stamp', modelStampId: asset && asset.id, placeholder: true, message: message || 'Loading model' };
    castReceive(g);
    return g;
  }

  function uniqueModelStampRefs(items) {
    return Array.from(new Set((items || []).filter(Boolean)));
  }

  function extractModelStampMapPath(line) {
    const raw = String(line || '').trim().replace(/^map_kd\s+/i, '').trim();
    if (!raw) return '';
    if ((raw[0] === '"' && raw[raw.length - 1] === '"') || (raw[0] === '\'' && raw[raw.length - 1] === '\'')) {
      return raw.slice(1, -1);
    }
    const tokens = raw.split(/\s+/);
    let i = 0;
    const optionArity = {
      '-blendu': 1,
      '-blendv': 1,
      '-boost': 1,
      '-mm': 2,
      '-o': 3,
      '-s': 3,
      '-t': 3,
      '-texres': 1,
      '-clamp': 1,
      '-bm': 1,
      '-imfchan': 1,
      '-type': 1,
    };
    while (i < tokens.length && tokens[i][0] === '-') {
      const arity = optionArity[String(tokens[i]).toLowerCase()];
      if (arity === undefined) break;
      i += 1 + arity;
    }
    return tokens.slice(i).join(' ').trim();
  }

  function parseOBJMaterialLibraries(text) {
    const refs = [];
    for (const line of String(text || '').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed[0] === '#' || !/^mtllib\s+/i.test(trimmed)) continue;
      const rest = trimmed.replace(/^mtllib\s+/i, '').trim();
      if (!rest) continue;
      refs.push(rest);
    }
    return uniqueModelStampRefs(refs);
  }

  function parseModelStampMTL(text, asset, baseUrl) {
    const defs = [];
    let current = null;
    const clampAlpha = value => Math.max(0, Math.min(1, Number(value) || 0));
    function flush() {
      if (current && current.name) defs.push(current);
      current = null;
    }
    for (const line of String(text || '').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed[0] === '#') continue;
      const parts = trimmed.split(/\s+/);
      const key = parts.shift().toLowerCase();
      if (key === 'newmtl') {
        flush();
        current = { name: parts.join(' '), color: 0xffffff, opacity: 1, map: null, hasDissolve: false };
      } else if (current && key === 'kd' && parts.length >= 3) {
        const r = Math.max(0, Math.min(1, Number(parts[0]) || 0));
        const g = Math.max(0, Math.min(1, Number(parts[1]) || 0));
        const b = Math.max(0, Math.min(1, Number(parts[2]) || 0));
        current.color = new THREE.Color(r, g, b).getHex();
      } else if (current && key === 'd' && parts.length) {
        current.opacity = clampAlpha(parts[0]);
        current.hasDissolve = true;
      } else if (current && key === 'tr' && parts.length) {
        const transparency = clampAlpha(parts[0]);
        if (!current.hasDissolve) current.opacity = transparency >= 0.999 ? 1 : 1 - transparency;
      } else if (current && key === 'map_kd') {
        current.map = extractModelStampMapPath(trimmed);
      }
    }
    flush();
    const out = {};
    defs.forEach(def => {
      const params = {
        color: def.map ? 0xffffff : def.color,
        transparent: def.opacity < 0.999,
        opacity: def.opacity,
      };
      if (def.map) params.map = loadModelStampTexture(asset, def.map, { baseUrl, flipY: true, modelStampId: asset && asset.id });
      const mat = new THREE.MeshLambertMaterial(params);
      mat.name = def.name;
      mat.userData.modelStampHydrated = def.map ? 'mtl texture' : 'mtl color';
      prepareModelStampTextureMaterial(mat);
      out[def.name] = mat;
    });
    return out;
  }

  function loadModelStampMTLMaterials(asset, objText) {
    const refs = parseOBJMaterialLibraries(objText);
    const manifestMtls = asset && asset.sidecars && Array.isArray(asset.sidecars.mtl) ? asset.sidecars.mtl : [];
    const existing = manifestMtls.filter(item => item && item.exists !== false && (item.url || item.path));
    if (!existing.length) {
      if (refs.length && asset && !asset.materialWarning) asset.materialWarning = 'Missing OBJ material library: ' + refs.join(', ');
      else if (asset && !asset.materialWarning) asset.materialWarning = 'OBJ has no material library; using TinyWorld palette fallback';
      return Promise.resolve({});
    }
    return Promise.all(existing.map(item => {
      const url = modelStampResolveUrl(asset, item.url || item.path);
      return fetch(url, { cache: 'no-store' })
        .then(res => {
          if (!res.ok) throw new Error('HTTP ' + res.status + ' loading ' + (item.name || item.path));
          return res.text();
        })
        .then(text => parseModelStampMTL(text, asset, url));
    })).then(list => Object.assign({}, ...list));
  }

  function parseOBJModel(text, asset = null, materialLib = {}) {
    const verts = [[0, 0, 0]];
    const normals = [[0, 1, 0]];
    const uvs = [[0, 0]];
    const groups = [];
    let current = null;
    function ensureGroup(name = 'default') {
      const key = String(name || 'default').trim() || 'default';
      current = groups.find(group => group.name === key);
      if (!current) {
        current = { name: key, positions: [], normals: [], uvs: [] };
        groups.push(current);
      }
      return current;
    }
    function parseIndex(value, listLength) {
      const n = parseInt(value, 10);
      if (!Number.isFinite(n)) return 0;
      return n < 0 ? listLength + n : n;
    }
    ensureGroup('default');
    const lines = String(text || '').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed[0] === '#') continue;
      const parts = trimmed.split(/\s+/);
      const key = parts[0].toLowerCase();
      if (key === 'v' && parts.length >= 4) {
        verts.push([Number(parts[1]) || 0, Number(parts[2]) || 0, Number(parts[3]) || 0]);
      } else if (key === 'vt' && parts.length >= 3) {
        uvs.push([Number(parts[1]) || 0, Number(parts[2]) || 0]);
      } else if (key === 'vn' && parts.length >= 4) {
        normals.push([Number(parts[1]) || 0, Number(parts[2]) || 1, Number(parts[3]) || 0]);
      } else if (key === 'usemtl') {
        ensureGroup(parts.slice(1).join(' ') || 'default');
      } else if (key === 'f' && parts.length >= 4) {
        const face = parts.slice(1).map(token => {
          const bits = token.split('/');
          return {
            v: parseIndex(bits[0], verts.length),
            t: bits[1] ? parseIndex(bits[1], uvs.length) : 0,
            n: bits[2] ? parseIndex(bits[2], normals.length) : 0,
          };
        }).filter(item => verts[item.v]);
        for (let i = 1; i < face.length - 1; i++) {
          for (const item of [face[0], face[i], face[i + 1]]) {
            const v = verts[item.v] || verts[0];
            const n = normals[item.n] || null;
            const uv = uvs[item.t] || null;
            current.positions.push(v[0], v[1], v[2]);
            if (n) current.normals.push(n[0], n[1], n[2]);
            if (uv) current.uvs.push(uv[0], uv[1]);
          }
        }
      }
    }
    const g = new THREE.Group();
    let meshCount = 0;
    groups.forEach((group, index) => {
      if (!group.positions.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(group.positions, 3));
      if (group.normals.length === group.positions.length) geo.setAttribute('normal', new THREE.Float32BufferAttribute(group.normals, 3));
      else geo.computeVertexNormals();
      if (group.uvs.length === (group.positions.length / 3) * 2) geo.setAttribute('uv', new THREE.Float32BufferAttribute(group.uvs, 2));
      const sourceMat = materialLib[group.name];
      const mat = sourceMat || new THREE.MeshLambertMaterial({ color: 0xffffff });
      if (!sourceMat) {
        mat.name = 'Missing MTL: ' + group.name;
        mat.userData.modelStampMissingMtl = true;
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = group.name || ('OBJ part ' + (index + 1));
      if (!sourceMat) mesh.userData.modelStampForcePalette = true;
      g.add(mesh);
      meshCount++;
    });
    if (!meshCount) throw new Error('OBJ has no faces');
    return g;
  }

  function loadModelStampAsset(asset, onReady, onError) {
    if (!asset) return null;
    let cache = modelStampAssetCache.get(asset.id);
    if (cache && cache.state === 'ready') {
      if (onReady) setTimeout(() => onReady(cache.scene), 0);
      return cache;
    }
    if (cache && cache.state === 'loading') {
      if (onReady) cache.ready.push(onReady);
      if (onError) cache.error.push(onError);
      return cache;
    }
    cache = { state: 'loading', scene: null, animations: [], errorMessage: '', ready: onReady ? [onReady] : [], error: onError ? [onError] : [] };
    modelStampAssetCache.set(asset.id, cache);
    function finish(scene, animations = []) {
      cache.state = 'ready';
      cache.scene = scene;
      cache.animations = Array.isArray(animations) ? animations : [];
      cache.ready.splice(0).forEach(fn => { try { fn(scene); } catch (_) {} });
      scheduleModelStampRefresh(asset.id);
    }
    function fail(err) {
      cache.state = 'error';
      cache.errorMessage = String(err && err.message || err || 'load failed');
      cache.error.splice(0).forEach(fn => { try { fn(cache.errorMessage); } catch (_) {} });
      scheduleModelStampRefresh(asset.id);
    }
    if (!asset.supported) {
      fail(new Error(asset.format.toUpperCase() + ' needs a browser loader; convert to GLB or OBJ for now'));
      return cache;
    }
    if (asset.format === 'glb' || asset.format === 'gltf') {
      if (!THREE.GLTFLoader) {
        fail(new Error('GLTFLoader missing'));
        return cache;
      }
      const loader = new THREE.GLTFLoader();
      loader.load(asset.url, gltf => {
        const scene = gltf.scene || (gltf.scenes && gltf.scenes[0]) || new THREE.Group();
        hydrateModelStampScene(scene, asset, { flipY: false });
        finish(scene, gltf.animations || []);
      }, undefined, fail);
    } else if (asset.format === 'obj') {
      let objText = '';
      fetch(asset.url, { cache: 'no-store' })
        .then(res => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        })
        .then(text => {
          objText = text;
          return loadModelStampMTLMaterials(asset, text);
        })
        .then(materials => {
          const scene = parseOBJModel(objText, asset, materials);
          hydrateModelStampScene(scene, asset, { flipY: true });
          finish(scene);
        })
        .catch(fail);
    } else if (asset.format === 'fbx' && THREE.FBXLoader) {
      const loader = new THREE.FBXLoader();
      loader.load(asset.url, obj => {
        hydrateModelStampScene(obj, asset, { flipY: true });
        finish(obj);
      }, undefined, fail);
    } else {
      fail(new Error(asset.format.toUpperCase() + ' is detected but not placeable in this build'));
    }
    return cache;
  }

  function makeModelStamp(idOrAsset, opts = {}) {
    const asset = typeof idOrAsset === 'string' ? getModelStamp(idOrAsset) : idOrAsset;
    if (!asset) return makeModelStampPlaceholder(null, 'Model missing');
    const cache = loadModelStampAsset(asset);
    if (cache && cache.state === 'ready' && cache.scene) {
      const stamp = normalizeModelStampObject(cloneModelStampScene(cache.scene), asset);
      return applyAppearanceToObject(stamp, 'model-stamp', opts.appearance);
    }
    const placeholder = makeModelStampPlaceholder(asset, cache && cache.errorMessage ? cache.errorMessage : 'Loading model');
    return applyAppearanceToObject(placeholder, 'model-stamp', opts.appearance);
  }

  function scheduleModelStampRefresh(modelStampId) {
    setTimeout(() => {
      for (const key in cellMeshes) {
        const parts = key.split(',');
        const x = parseInt(parts[0], 10);
        const z = parseInt(parts[1], 10);
        if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
        const cell = getWorldCell(x, z);
        const appearance = normalizeAppearance(cell.appearance);
        if (cell.kind === 'model-stamp' && appearance && appearance.modelStampId === modelStampId) {
          renderCellObject(x, z, { animate: false, impactDust: false });
        }
      }
      if (selectedTool && selectedTool.kind === 'model-stamp' && selectedTool.modelStampId === modelStampId) {
        ghostPreviewKey = null;
        ensureGhostPreview();
        updateGhostPlacement();
      }
      if (typeof rebuildExistingGhostBoards === 'function') rebuildExistingGhostBoards();
      refreshOpenStampBuilderCards();
    }, 0);
  }

  function syncModelStampSettingsPanel(tool) {
    const panel = document.getElementById('model-stamp-settings');
    if (!panel) return;
    const isModel = !!(tool && tool.kind === 'model-stamp' && tool.modelStampId);
    panel.hidden = !isModel;
    if (!isModel) return;
    selectedModelStampId = tool.modelStampId;
    const asset = getModelStamp(tool.modelStampId);
    const cfg = getModelStampSettings(tool.modelStampId);
    const name = document.getElementById('model-stamp-settings-name');
    const size = document.getElementById('model-stamp-size');
    const sizeOut = document.getElementById('model-stamp-size-value');
    const offsetY = document.getElementById('model-stamp-offset-y');
    const offsetYOut = document.getElementById('model-stamp-offset-y-value');
    const rotation = document.getElementById('model-stamp-rotation');
    const rotationOut = document.getElementById('model-stamp-rotation-value');
    if (name) name.textContent = asset ? asset.label : tool.label;
    if (size) size.value = String(Math.round(cfg.objectScale * 100));
    if (sizeOut) sizeOut.textContent = cfg.objectScale.toFixed(2) + '×';
    if (offsetY) offsetY.value = String(Math.round(cfg.offsetY * 100));
    if (offsetYOut) offsetYOut.textContent = (cfg.offsetY >= 0 ? '+' : '') + cfg.offsetY.toFixed(2);
    const deg = ((Math.round(cfg.rotationY * 180 / Math.PI / 15) * 15) % 360 + 360) % 360;
    if (rotation) rotation.value = String(deg);
    if (rotationOut) rotationOut.textContent = deg + '°';
  }

  function readModelStampSettingsPanel() {
    const size = document.getElementById('model-stamp-size');
    const offsetY = document.getElementById('model-stamp-offset-y');
    const rotation = document.getElementById('model-stamp-rotation');
    return normalizeModelStampSettings({
      objectScale: size ? Number(size.value) / 100 : 1,
      offsetY: offsetY ? Number(offsetY.value) / 100 : 0,
      rotationY: rotation ? Number(rotation.value) * Math.PI / 180 : 0,
    });
  }

  function updateSelectedModelStampDefaults(persist = false) {
    if (!selectedModelStampId) return;
    const cfg = setModelStampSettings(selectedModelStampId, readModelStampSettingsPanel(), persist);
    syncModelStampSettingsPanel(selectedTool);
    if (selectedTool && selectedTool.kind === 'model-stamp') {
      ghostPreviewKey = null;
      ensureGhostPreview();
      updateGhostPlacement();
    }
    const status = document.getElementById('stamp-builder-status');
    if (status && persist) status.textContent = 'Saved defaults for ' + (getModelStamp(selectedModelStampId)?.label || selectedModelStampId);
    return cfg;
  }

  loadModelStampDefaultsConfig();
  refreshModelStampManifest();

