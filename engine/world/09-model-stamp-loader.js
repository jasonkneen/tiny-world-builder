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
      const qs = new URLSearchParams(window.location.search);
      if (qs.get('modelApi') === '0' || qs.get('modelStampApi') === '0') return false;
      const stored = window.localStorage && window.localStorage.getItem('tinyworld:features:model-stamp-api');
      return stored !== '0';
    } catch (_) {
      return true;
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
    if (modelStampApiEnabled()) {
      fetch('/api/model-stamp-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  }

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
        if (typeof renderScene === 'function') renderScene();
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

  function voxelBuildMaterial(hex, textureKind = null) {
    const clean = normalizeHexColor(hex) || '#ffffff';
    const kind = inferProceduralTextureKind(clean, textureKind);
    const key = clean + ':' + kind;
    if (!voxelBuildMaterialCache.has(key)) {
      const mat = new THREE.MeshLambertMaterial({ color: clean });
      const tex = proceduralPixelTextures[kind] || texNoise;
      applyWorldUVs(mat, tex, proceduralTextureScaleForKind(kind));
      mat.userData.voxelBuildMaterial = true;
      mat.userData.proceduralTextureKind = kind;
      voxelBuildMaterialCache.set(key, mat);
    }
    return voxelBuildMaterialCache.get(key);
  }

  function voxelPartMaterial(name) {
    const key = String(name || '').trim();
    return voxelBuildMaterial(VOXEL_PART_COLORS[key] || key || '#ffffff', proceduralTextureKindForMaterialName(key));
  }

  function voxelAppearanceRoleForMaterial(name) {
    const key = String(name || '').toLowerCase();
    if (!key) return null;
    if (/(roofedge|roof_edge|roof-dark|roofdark)/.test(key)) return 'topDark';
    if (/roof|green|pink|crop|leaf|leaves|foliage|blossom/.test(key)) return 'top';
    if (/(wooddark|stonedark|dirtdark|pathdark|waterdark|shadow)/.test(key)) return 'bodyDark';
    if (/wood|stone|cream|white|red|wall|body|trunk|dirt|path|water/.test(key)) return 'body';
    return null;
  }

  function voxelAppearanceRoleForColor(hex) {
    const clean = normalizeHexColor(hex);
    if (!clean) return null;
    for (const [name, value] of Object.entries(VOXEL_PART_COLORS)) {
      if (normalizeHexColor(value) === clean) return voxelAppearanceRoleForMaterial(name);
    }
    const n = parseInt(clean.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    if (g > r * 0.9 && g > b * 0.9) return 'top';
    if (r > 170 && b > 130 && g < 205) return 'top';
    if (r > 180 && g > 120 && b < 90) return 'top';
    if (Math.abs(r - g) < 24 && Math.abs(g - b) < 24) return 'body';
    if (r > g && g > b) return 'body';
    return null;
  }

  function voxelAppearanceMaterial(base, role, appearance) {
    const a = normalizeAppearance(appearance);
    if (!a || !role) return base;
    const baseKind = base && base.userData && base.userData.proceduralTextureKind;
    let mat = base;
    if (role === 'top' && a.topColor) mat = voxelBuildMaterial(a.topColor, baseKind);
    if (role === 'topDark' && a.topColor) mat = voxelBuildMaterial(shadeHexColor(a.topColor, -48), baseKind);
    if (role === 'body' && a.bodyColor) mat = voxelBuildMaterial(a.bodyColor, baseKind);
    if (role === 'bodyDark' && a.bodyColor) mat = voxelBuildMaterial(shadeHexColor(a.bodyColor, -42), baseKind);
    if ((role === 'top' || role === 'topDark') && a.topTexture) mat = customTextureMaterial(mat, a.topTexture, a.topTextureScale || 1);
    else if ((role === 'body' || role === 'bodyDark') && a.bodyTexture) mat = customTextureMaterial(mat, a.bodyTexture, a.bodyTextureScale || 1);
    else if (a.materialTexture) mat = customTextureMaterial(mat, a.materialTexture, a.materialTextureScale || 1);
    return mat;
  }

  function customPartsBounds(parts) {
    if (!Array.isArray(parts) || !parts.length) return null;
    const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (const part of parts) {
      const sx = (part.size[0] || 0) * (part.scale[0] || 1);
      const sy = (part.size[1] || 0) * (part.scale[1] || 1);
      const sz = (part.size[2] || 0) * (part.scale[2] || 1);
      b.minX = Math.min(b.minX, part.pos[0] - sx / 2);
      b.maxX = Math.max(b.maxX, part.pos[0] + sx / 2);
      b.minY = Math.min(b.minY, part.pos[1] - sy / 2);
      b.maxY = Math.max(b.maxY, part.pos[1] + sy / 2);
      b.minZ = Math.min(b.minZ, part.pos[2] - sz / 2);
      b.maxZ = Math.max(b.maxZ, part.pos[2] + sz / 2);
    }
    return b;
  }

  function isCustomVoxelGroundPlatformPart(part, bounds) {
    if (!part || part.kind !== 'box' || !bounds) return false;
    const sx = (part.size[0] || 0) * (part.scale[0] || 1);
    const sy = (part.size[1] || 0) * (part.scale[1] || 1);
    const sz = (part.size[2] || 0) * (part.scale[2] || 1);
    const spanX = Math.max(0.01, bounds.maxX - bounds.minX);
    const spanY = Math.max(0.01, bounds.maxY - bounds.minY);
    const spanZ = Math.max(0.01, bounds.maxZ - bounds.minZ);
    const bottomY = (part.pos[1] || 0) - sy * 0.5;
    const materialKey = String(part.material || '').toLowerCase();
    const idKey = String(part.id || '').toLowerCase();
    const looksLikeGround = /(grass|green|dirt|path|ground|terrain|moss|base|platform|tile)/.test(materialKey + ' ' + idKey);
    const broad = (sx / spanX > 0.52 && sz / spanZ > 0.52) || (sx * sz > spanX * spanZ * 0.34);
    const shallow = sy <= Math.max(0.45, spanY * 0.18);
    const sitsAtBottom = Math.abs(bottomY - bounds.minY) <= Math.max(0.08, sy * 0.35);
    return looksLikeGround && broad && shallow && sitsAtBottom;
  }

  function customVoxelGroundPlatformSink(parts, bounds) {
    if (!Array.isArray(parts) || !bounds) return 0;
    let sink = 0;
    for (const part of parts) {
      if (!isCustomVoxelGroundPlatformPart(part, bounds)) continue;
      const sy = (part.size[1] || 0) * (part.scale[1] || 1);
      sink = Math.max(sink, sy);
    }
    return sink;
  }

  function fitCustomPartsToBounds(parts, allowedBounds) {
    const clean = normalizeVoxelCustomParts(parts);
    const b = customPartsBounds(clean);
    if (!b || !allowedBounds) return clean;
    const allowedSpanX = Math.max(0.01, allowedBounds.maxX - allowedBounds.minX);
    const allowedSpanY = Math.max(0.01, allowedBounds.maxY - allowedBounds.minY);
    const allowedSpanZ = Math.max(0.01, allowedBounds.maxZ - allowedBounds.minZ);
    const spanX = Math.max(0.01, b.maxX - b.minX);
    const spanY = Math.max(0.01, b.maxY - b.minY);
    const spanZ = Math.max(0.01, b.maxZ - b.minZ);
    const scale = Math.min(1, allowedSpanX / spanX, allowedSpanY / spanY, allowedSpanZ / spanZ);
    const sourceCenter = [
      (b.minX + b.maxX) * 0.5,
      b.minY,
      (b.minZ + b.maxZ) * 0.5,
    ];
    const allowedCenter = [
      (allowedBounds.minX + allowedBounds.maxX) * 0.5,
      allowedBounds.minY,
      (allowedBounds.minZ + allowedBounds.maxZ) * 0.5,
    ];
    return clean.map(part => {
      const size = part.size.map(v => v * scale);
      const pos = [
        allowedCenter[0] + (part.pos[0] - sourceCenter[0]) * scale,
        allowedCenter[1] + (part.pos[1] - sourceCenter[1]) * scale,
        allowedCenter[2] + (part.pos[2] - sourceCenter[2]) * scale,
      ];
      return Object.assign({}, part, { size, pos });
    });
  }

  function voxelTrimMaterial(base, fallbackHex = '#2a2722') {
    const sourceHex = base && base.color ? ('#' + base.color.getHexString()) : fallbackHex;
    const kind = base && base.userData && base.userData.proceduralTextureKind;
    return voxelBuildMaterial(shadeHexColor(sourceHex, -58) || fallbackHex, kind || 'wood');
  }

  function addVoxelBuildTrimFrame(parent, bounds, mat) {
    if (!bounds) return;
    const spanX = Math.max(0.01, bounds.maxX - bounds.minX);
    const spanY = Math.max(0.01, bounds.maxY - bounds.minY);
    const spanZ = Math.max(0.01, bounds.maxZ - bounds.minZ);
    const t = Math.max(0.014, Math.min(0.045, Math.min(spanX, spanY, spanZ) * 0.08));
    const cx = (bounds.minX + bounds.maxX) * 0.5;
    const cz = (bounds.minZ + bounds.maxZ) * 0.5;
    const y0 = Math.max(t * 0.5, bounds.minY + t * 0.5);
    const y1 = bounds.maxY + t * 0.5;
    const trimOpts = { noGap: true, noBevel: true, noShadow: true };

    vbox(parent, spanX + t * 2, t, t, cx, y0, bounds.minZ - t * 0.5, mat, trimOpts);
    vbox(parent, spanX + t * 2, t, t, cx, y0, bounds.maxZ + t * 0.5, mat, trimOpts);
    vbox(parent, t, t, spanZ + t * 2, bounds.minX - t * 0.5, y0, cz, mat, trimOpts);
    vbox(parent, t, t, spanZ + t * 2, bounds.maxX + t * 0.5, y0, cz, mat, trimOpts);

    vbox(parent, spanX + t * 2, t, t, cx, y1, bounds.minZ - t * 0.5, mat, trimOpts);
    vbox(parent, spanX + t * 2, t, t, cx, y1, bounds.maxZ + t * 0.5, mat, trimOpts);
    vbox(parent, t, t, spanZ + t * 2, bounds.minX - t * 0.5, y1, cz, mat, trimOpts);
    vbox(parent, t, t, spanZ + t * 2, bounds.maxX + t * 0.5, y1, cz, mat, trimOpts);

    for (const x of [bounds.minX - t * 0.5, bounds.maxX + t * 0.5]) {
      for (const z of [bounds.minZ - t * 0.5, bounds.maxZ + t * 0.5]) {
        vbox(parent, t, spanY + t, t, x, bounds.minY + spanY * 0.5, z, mat, trimOpts);
      }
    }
  }

  function makeCustomPartsStamp(stamp, opts = {}) {
    const parts = normalizeVoxelCustomParts(stamp.customParts || stamp.parts);
    if (!parts.length) return null;
    const b = customPartsBounds(parts);
    if (!b) return null;
    const spanX = Math.max(0.01, b.maxX - b.minX);
    const spanZ = Math.max(0.01, b.maxZ - b.minZ);
    const footprint = opts.footprint || stamp.footprint || 0.96;
    const unit = footprint / Math.max(spanX, spanZ);
    const centerX = (b.minX + b.maxX) / 2;
    const centerZ = (b.minZ + b.maxZ) / 2;
    const floorY = Math.min(0, b.minY);
    const platformSink = customVoxelGroundPlatformSink(parts, b) * unit;
    const g = new THREE.Group();
    let trimBase = null;
    const trimBounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (const part of parts) {
      const role = voxelAppearanceRoleForMaterial(part.material);
      const mat = voxelAppearanceMaterial(voxelPartMaterial(part.material), role, opts.appearance);
      const w = part.size[0] * part.scale[0] * unit;
      const h = part.size[1] * part.scale[1] * unit;
      const d = part.size[2] * part.scale[2] * unit;
      const x = (part.pos[0] - centerX) * unit;
      const y = (part.pos[1] - floorY) * unit - platformSink;
      const z = (part.pos[2] - centerZ) * unit;
      trimBase = trimBase || mat;
      trimBounds.minX = Math.min(trimBounds.minX, x - w * 0.5);
      trimBounds.maxX = Math.max(trimBounds.maxX, x + w * 0.5);
      trimBounds.minY = Math.min(trimBounds.minY, y - h * 0.5);
      trimBounds.maxY = Math.max(trimBounds.maxY, y + h * 0.5);
      trimBounds.minZ = Math.min(trimBounds.minZ, z - d * 0.5);
      trimBounds.maxZ = Math.max(trimBounds.maxZ, z + d * 0.5);
      if (part.kind === 'cylinder') {
        vcylinder(g, Math.max(w, d) / 2, h, x, y, z, mat, part.segments || 8);
      } else if (part.kind === 'cone') {
        const mesh = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) / 2, h, part.segments || 4), mat);
        mesh.position.set(x, y, z);
        g.add(mesh);
      } else {
        vbox(g, w, h, d, x, y, z, mat);
      }
    }
    if (stamp.decorativeOutline || opts.decorativeOutline) {
      addVoxelBuildTrimFrame(g, trimBounds, voxelTrimMaterial(trimBase));
    }
    g.userData = { kind: 'voxel-build', voxelBuildId: stamp.id, name: stamp.name, chimneyTops: [] };
    castReceive(g);
    optimizeVoxelObjectGroup(g, { reason: 'voxel-build-custom' });
    return g;
  }

  function makeVoxelBuildStamp(idOrStamp, opts = {}) {
    const stamp = typeof idOrStamp === 'string' ? getVoxelBuildStamp(idOrStamp) : idOrStamp;
    if (!stamp) return null;
    if (Array.isArray(stamp.customParts) && stamp.customParts.length) return makeCustomPartsStamp(stamp, opts);
    if (!Array.isArray(stamp.voxels) || !stamp.voxels.length) return null;
    const g = new THREE.Group();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const v of stamp.voxels) {
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
    }
    const spanX = Math.max(1, maxX - minX + 1);
    const spanZ = Math.max(1, maxZ - minZ + 1);
    const footprint = opts.footprint || stamp.footprint || 1.6;
    const unit = opts.unit || stamp.unit || footprint / Math.max(spanX, spanZ);
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    let trimBase = null;
    for (const v of stamp.voxels) {
      const x = (v.x - centerX) * unit;
      const y = (v.y - minY) * unit + unit / 2;
      const z = (v.z - centerZ) * unit;
      const mat = voxelAppearanceMaterial(voxelBuildMaterial(v.color), voxelAppearanceRoleForColor(v.color), opts.appearance);
      trimBase = trimBase || mat;
      vbox(g, unit, unit, unit, x, y, z, mat);
    }
    if (stamp.decorativeOutline || opts.decorativeOutline) {
      addVoxelBuildTrimFrame(g, {
        minX: (minX - centerX) * unit - unit * 0.5,
        maxX: (maxX - centerX) * unit + unit * 0.5,
        minY: 0,
        maxY: (maxY - minY + 1) * unit,
        minZ: (minZ - centerZ) * unit - unit * 0.5,
        maxZ: (maxZ - centerZ) * unit + unit * 0.5,
      }, voxelTrimMaterial(trimBase));
    }
    g.userData = { kind: 'voxel-build', voxelBuildId: stamp.id, name: stamp.name, chimneyTops: [] };
    castReceive(g);
    optimizeVoxelObjectGroup(g, { reason: 'voxel-build-stamp' });
    return g;
  }

  function vbox(parent, w, h, d, x, y, z, mat, opts = {}) {
    const maxGap = Math.max(0, Math.min(w, h, d) * 0.45);
    const gap = opts.noGap ? 0 : Math.min(maxGap, Math.max(0, Math.min(0.14, renderVoxelGap || 0)));
    const gw = Math.max(0.006, w - gap);
    const gh = Math.max(0.006, h - gap);
    const gd = Math.max(0.006, d - gap);
    const bevel = opts.noBevel ? 0 : (renderVoxelBevel || 0);
    const hasHiddenFaces = opts.skipTop || opts.skipBottom || opts.skipPX || opts.skipNX || opts.skipPZ || opts.skipNZ;
    const geo = hasHiddenFaces
      ? getOpenBoxGeometry(gw, gh, gd, opts.skipTop, opts.skipBottom, opts.skipPX, opts.skipNX, opts.skipPZ, opts.skipNZ)
      : getVoxelBoxGeometry(gw, gh, gd, bevel);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x || 0, y || h / 2, z || 0);
    if (opts.ry) mesh.rotation.y = opts.ry;
    if (opts.rx) mesh.rotation.x = opts.rx;
    if (opts.rz) mesh.rotation.z = opts.rz;
    if (opts.noShadow) mesh.userData.noShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function vcylinder(parent, radius, height, x, y, z, mat, segments = 12, opts = {}) {
    const mesh = new THREE.Mesh(getCylinderGeometry(radius, height, segments), mat);
    mesh.position.set(x || 0, y || height / 2, z || 0);
    if (opts.ry) mesh.rotation.y = opts.ry;
    if (opts.rx) mesh.rotation.x = opts.rx;
    if (opts.rz) mesh.rotation.z = opts.rz;
    if (opts.noShadow) mesh.userData.noShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const VOXEL_OBJECT_BATCH_MIN_INSTANCES = 2;

  function optimizeVoxelObjectGroup(root, opts = {}) {
    if (!root || !root.children || root.userData && root.userData.noVoxelBatch) return root;
    const minInstances = Math.max(2, opts.minInstances || VOXEL_OBJECT_BATCH_MIN_INSTANCES);
    const buckets = new Map();
    const sourceChildren = root.children.slice();
    for (const child of sourceChildren) {
      if (!child || !child.isMesh || child.isInstancedMesh || !child.geometry || !child.material || Array.isArray(child.material)) continue;
      if (child.userData && (
        child.userData.noBatch ||
        child.userData.waterfall ||
        child.userData.weatherFx ||
        child.userData.rocketPlumeSheet ||
        child.userData.rocketFlame
      )) continue;
      child.updateMatrix();
      const key = [
        child.geometry.uuid,
        child.material.uuid,
        child.castShadow ? 1 : 0,
        child.receiveShadow ? 1 : 0,
        child.frustumCulled ? 1 : 0,
      ].join('|');
      if (!buckets.has(key)) {
        buckets.set(key, {
          geometry: child.geometry,
          material: child.material,
          castShadow: child.castShadow,
          receiveShadow: child.receiveShadow,
          frustumCulled: child.frustumCulled,
          items: [],
        });
      }
      buckets.get(key).items.push({ mesh: child, matrix: child.matrix.clone() });
    }

    let sourceMeshes = 0;
    let instancedMeshes = 0;
    let instances = 0;
    for (const bucket of buckets.values()) {
      if (bucket.items.length < minInstances) continue;
      const inst = new THREE.InstancedMesh(bucket.geometry, bucket.material, bucket.items.length);
      inst.castShadow = bucket.castShadow;
      inst.receiveShadow = bucket.receiveShadow;
      inst.frustumCulled = bucket.frustumCulled;
      inst.userData = {
        optimizedVoxelBatch: true,
        sourceCount: bucket.items.length,
        batchReason: opts.reason || 'voxel-object',
      };
      bucket.items.forEach((item, i) => {
        inst.setMatrixAt(i, item.matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
      if (typeof inst.computeBoundingSphere === 'function') inst.computeBoundingSphere();
      if (typeof inst.computeBoundingBox === 'function') inst.computeBoundingBox();
      else inst.frustumCulled = false;
      root.add(inst);
      for (const item of bucket.items) {
        if (item.mesh.parent) item.mesh.parent.remove(item.mesh);
      }
      sourceMeshes += bucket.items.length;
      instancedMeshes++;
      instances += bucket.items.length;
    }
    if (instancedMeshes) {
      root.userData = root.userData || {};
      root.userData.voxelBatchStats = { sourceMeshes, instancedMeshes, instances };
    }
    return root;
  }

  function canMergeStaticBaseMesh(mesh) {
    if (!mesh || !mesh.isMesh || !mesh.geometry || !mesh.material || Array.isArray(mesh.material)) return false;
    if (mesh.material.transparent) return false;
    const u = mesh.userData || {};
    if (
      u.noBatch ||
      u.noStaticBaseMerge ||
      u.waterfall ||
      u.weatherFx ||
      u.rocketPlumeSheet ||
      u.rocketFlame ||
      u.propellerBlurDisc
    ) return false;
    let n = mesh;
    while (n) {
      const data = n.userData || {};
      if (
        data.noStaticBaseMerge ||
        data.isEditableIslandEnginePropeller ||
        data.propellerBlurDisc ||
        data.editableIslandEngineId
      ) return false;
      n = n.parent;
    }
    return true;
  }

  function appendGeometryTriangles(target, geometry, matrix) {
    const posAttr = geometry && geometry.attributes && geometry.attributes.position;
    if (!posAttr) return 0;
    const normalAttr = geometry.attributes.normal;
    const uvAttr = geometry.attributes.uv;
    const indexAttr = geometry.index;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    let vertices = 0;
    const count = indexAttr ? indexAttr.count : posAttr.count;
    for (let i = 0; i < count; i++) {
      const idx = indexAttr ? indexAttr.getX(i) : i;
      p.fromBufferAttribute(posAttr, idx).applyMatrix4(matrix);
      target.positions.push(p.x, p.y, p.z);
      if (normalAttr) {
        n.fromBufferAttribute(normalAttr, idx).applyMatrix3(normalMatrix).normalize();
        target.normals.push(n.x, n.y, n.z);
      } else {
        target.normals.push(0, 1, 0);
      }
      if (uvAttr) target.uvs.push(uvAttr.getX(idx), uvAttr.getY(idx));
      else target.uvs.push(0, 0);
      vertices++;
    }
    return Math.floor(vertices / 3);
  }

  function mergeStaticBaseMeshesByMaterial(root, opts = {}) {
    if (!root || !root.traverse) return root;
    root.updateMatrixWorld(true);
    const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const sources = [];
    root.traverse(node => {
      if (!canMergeStaticBaseMesh(node)) return;
      sources.push(node);
    });
    if (sources.length < Math.max(2, opts.minMeshes || 2)) return root;

    const buckets = new Map();
    function bucketFor(mesh) {
      const mat = mesh.material;
      const key = [
        mat.uuid,
        mesh.castShadow ? 1 : 0,
        mesh.receiveShadow ? 1 : 0,
        mesh.frustumCulled ? 1 : 0,
      ].join('|');
      if (!buckets.has(key)) {
        buckets.set(key, {
          material: mat,
          castShadow: mesh.castShadow,
          receiveShadow: mesh.receiveShadow,
          frustumCulled: mesh.frustumCulled,
          positions: [],
          normals: [],
          uvs: [],
          meshes: 0,
          triangles: 0,
        });
      }
      return buckets.get(key);
    }

    const instanceMatrix = new THREE.Matrix4();
    const meshLocal = new THREE.Matrix4();
    const combined = new THREE.Matrix4();
    for (const mesh of sources) {
      const bucket = bucketFor(mesh);
      if (mesh.isInstancedMesh) {
        const count = Math.max(0, mesh.count || 0);
        for (let i = 0; i < count; i++) {
          mesh.getMatrixAt(i, instanceMatrix);
          meshLocal.multiplyMatrices(mesh.matrixWorld, instanceMatrix);
          combined.multiplyMatrices(rootInverse, meshLocal);
          bucket.triangles += appendGeometryTriangles(bucket, mesh.geometry, combined);
        }
      } else {
        combined.multiplyMatrices(rootInverse, mesh.matrixWorld);
        bucket.triangles += appendGeometryTriangles(bucket, mesh.geometry, combined);
      }
      bucket.meshes++;
    }

    let mergedMeshes = 0;
    let mergedSources = 0;
    let mergedTriangles = 0;
    for (const bucket of buckets.values()) {
      if (!bucket.positions.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(bucket.positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(bucket.normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(bucket.uvs, 2));
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      const merged = new THREE.Mesh(geo, bucket.material);
      merged.name = 'merged_static_base_' + (opts.reason || 'island');
      merged.castShadow = bucket.castShadow;
      merged.receiveShadow = bucket.receiveShadow;
      merged.frustumCulled = bucket.frustumCulled;
      merged.userData = {
        staticBaseMerged: true,
        mergeReason: opts.reason || 'island-base',
        sourceMeshes: bucket.meshes,
        triangles: bucket.triangles,
      };
      root.add(merged);
      mergedMeshes++;
      mergedSources += bucket.meshes;
      mergedTriangles += bucket.triangles;
    }

    if (!mergedMeshes) return root;
    for (const mesh of sources) {
      if (mesh.parent) mesh.parent.remove(mesh);
    }
    root.userData = root.userData || {};
    root.userData.staticBaseMergeStats = {
      sourceMeshes: mergedSources,
      mergedMeshes,
      triangles: mergedTriangles,
      reason: opts.reason || 'island-base',
    };
    return root;
  }

  function voxelWindow(parent, x, y, z, face = 'z', mat = M.windowB) {
    if (face === 'x') {
      vbox(parent, 0.034, 0.19, 0.17, x, y, z, M.woodTrim);
      vbox(parent, 0.038, 0.135, 0.120, x + Math.sign(x || 1) * 0.004, y, z, mat);
      vbox(parent, 0.042, 0.016, 0.120, x + Math.sign(x || 1) * 0.008, y, z, M.woodTrim);
      vbox(parent, 0.042, 0.135, 0.014, x + Math.sign(x || 1) * 0.009, y, z, M.woodTrim);
    } else {
      vbox(parent, 0.17, 0.19, 0.034, x, y, z, M.woodTrim);
      vbox(parent, 0.120, 0.135, 0.038, x, y, z + Math.sign(z || 1) * 0.004, mat);
      vbox(parent, 0.120, 0.016, 0.042, x, y, z + Math.sign(z || 1) * 0.008, M.woodTrim);
      vbox(parent, 0.014, 0.135, 0.042, x, y, z + Math.sign(z || 1) * 0.009, M.woodTrim);
    }
  }

  function voxelDoor(parent, x, z, face = 'z', h = 0.34) {
    const y = h / 2;
    if (face === 'x') {
      vbox(parent, 0.055, h, 0.21, x, y, z, M.door);
      vbox(parent, 0.064, 0.04, 0.27, x + Math.sign(x || 1) * 0.006, h + 0.02, z, M.woodTrim);
      vbox(parent, 0.030, 0.030, 0.030, x + Math.sign(x || 1) * 0.028, y, z + 0.055, M.knob);
    } else {
      vbox(parent, 0.21, h, 0.055, x, y, z, M.door);
      vbox(parent, 0.27, 0.04, 0.064, x, h + 0.02, z + Math.sign(z || 1) * 0.006, M.woodTrim);
      vbox(parent, 0.030, 0.030, 0.030, x + 0.055, y, z + Math.sign(z || 1) * 0.028, M.knob);
    }
  }

  function voxelSteppedRoof(parent, width, depth, y, roofMat = M.roofBlue, trimMat = M.roofBlueD, orientation = 'z') {
    const alongZ = orientation === 'z';
    const steps = [
      { w: width + 0.24, h: 0.10, d: depth + 0.24 },
      { w: width + 0.02, h: 0.10, d: depth + 0.18 },
      { w: Math.max(0.20, width - 0.24), h: 0.10, d: depth + 0.10 },
      { w: 0.16, h: 0.08, d: depth + 0.04 },
    ];
    steps.forEach((s, i) => {
      const mat = i === steps.length - 1 ? trimMat : roofMat;
      const w = alongZ ? s.w : s.d;
      const d = alongZ ? s.d : s.w;
      vbox(parent, w, s.h, d, 0, y + i * 0.085 + s.h / 2, 0, mat);
    });
  }

  function voxelInvertedSteppedRoof(parent, width, depth, topY, roofMat = M.islandUnder, trimMat = M.islandUnderD) {
    const layers = Math.max(7, Math.min(14, Math.round(Math.max(width, depth) * 0.65)));
    const totalDrop = Math.max(1.85, Math.min(6.2, Math.max(width, depth) * 0.30));
    const yStep = totalDrop / layers;
    const layerH = yStep * 1.08;
    for (let i = 0; i < layers; i++) {
      const t = i / Math.max(1, layers - 1);
      const w = Math.max(0.36, width * (1 - t * 0.78));
      const d = Math.max(0.36, depth * (1 - t * 0.78));
      const y = topY - i * yStep - layerH * 0.5;
      const mat = i % 3 === 0 ? trimMat : roofMat;
      vbox(parent, w, layerH, d, 0, y, 0, mat, { noGap: true });
    }
    vbox(parent, Math.max(0.30, width * 0.10), layerH * 1.1, Math.max(0.30, depth * 0.10), 0, topY - totalDrop - layerH * 0.55, 0, trimMat, { noGap: true });
  }

  function makeBlankIsland() {
    const g = new THREE.Group();
    const width = 2.75;
    const depth = 2.35;
    const grassH = 0.16;
    const dirtH = 0.34;
    vbox(g, width, grassH, depth, 0, grassH * 0.5, 0, M.grass, { noGap: true });
    vbox(g, width * 0.96, 0.055, depth + 0.05, 0, grassH + 0.018, 0, M.grassHi, { noGap: true, noBevel: true });
    vbox(g, width + 0.08, 0.055, 0.10, 0, grassH * 0.72, -depth * 0.5, M.grassEdge, { noGap: true, noBevel: true });
    vbox(g, width + 0.08, 0.055, 0.10, 0, grassH * 0.72,  depth * 0.5, M.grassEdge, { noGap: true, noBevel: true });
    vbox(g, 0.10, 0.055, depth + 0.08, -width * 0.5, grassH * 0.72, 0, M.grassEdge, { noGap: true, noBevel: true });
    vbox(g, 0.10, 0.055, depth + 0.08,  width * 0.5, grassH * 0.72, 0, M.grassEdge, { noGap: true, noBevel: true });
    vbox(g, width * 0.94, dirtH, depth * 0.94, 0, -dirtH * 0.5, 0, M.dirtRich, { noGap: true, skipTop: true });
    voxelInvertedSteppedRoof(g, width * 0.86, depth * 0.86, -dirtH - 0.02, M.islandUnder, M.islandUnderD);
    const tuftMat = M.grassHi;
    for (let i = 0; i < 10; i++) {
      const side = Math.floor(cellRand(i, 41, 8310) * 4);
      const along = cellRand(i, 42, 8320) * 2 - 1;
      const x = side < 2 ? along * width * 0.40 : (side === 2 ? -width * 0.45 : width * 0.45);
      const z = side < 2 ? (side === 0 ? -depth * 0.45 : depth * 0.45) : along * depth * 0.40;
      vbox(g, 0.07, 0.10 + cellRand(i, 43, 8330) * 0.08, 0.07, x, grassH + 0.05, z, tuftMat, { noGap: true });
    }
    g.userData.kind = 'new-island';
    castReceive(g);
    return g;
  }

  const ISLAND_ROCKET_FLAME_SPEED = 3;
  const UNDER_ISLAND_EFFECT_RENDER_ORDER = -24;
  let islandRocketFlames = new Set();
  let islandRocketEngines = new Set();
  let islandRocketSmokeTimer = 0;
  const islandRocketPlumeTimeUniform = { value: 0 };
  const islandRocketPlumeCameraLocal = new THREE.Vector3();

  function getIslandRocketPlumeGeometry() {
    if (!getIslandRocketPlumeGeometry.geo) {
      getIslandRocketPlumeGeometry.geo = new THREE.PlaneGeometry(1, 1);
      getIslandRocketPlumeGeometry.geo.userData.cached = true;
    }
    return getIslandRocketPlumeGeometry.geo;
  }

  function getIslandRocketPlumeMaterial(kind = 'flame') {
    if (!getIslandRocketPlumeMaterial.cache) getIslandRocketPlumeMaterial.cache = {};
    if (!getIslandRocketPlumeMaterial.cache[kind]) {
      const smoke = kind === 'smoke';
      const core = kind === 'core';
      const preset = smoke
        ? { a: 0x606464, b: 0x2d3031, opacity: 0.46, mode: 1 }
        : (core
          ? { a: 0xfff7aa, b: 0xffa632, opacity: 0.92, mode: 0 }
          : { a: 0xffa12b, b: 0xd44422, opacity: 0.74, mode: 0 });
      getIslandRocketPlumeMaterial.cache[kind] = new THREE.ShaderMaterial({
        uniforms: {
          uTime: islandRocketPlumeTimeUniform,
          uColorA: { value: new THREE.Color(preset.a) },
          uColorB: { value: new THREE.Color(preset.b) },
          uOpacity: { value: preset.opacity },
          uMode: { value: preset.mode },
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vWorld;
          void main() {
            vUv = uv;
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorld = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          uniform float uOpacity;
          uniform float uMode;
          varying vec2 vUv;
          varying vec3 vWorld;
          float plumeHash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }
          void main() {
            float down = 1.0 - vUv.y;
            float dist = abs(vUv.x - 0.5) * 2.0;
            vec2 block = floor(vUv * vec2(12.0, 20.0) + vec2(floor(vWorld.x * 3.0), floor(vWorld.z * 3.0)));
            float n = plumeHash(block + floor(uTime * vec2(6.0, 10.0)));
            float column = 0.5 + 0.5 * sin((vUv.x * 14.0) + uTime * 9.0 + n * 6.2831 + vWorld.x);
            float smoke = step(0.5, uMode);
            float midBulge = smoothstep(0.04, 0.36, down) * (1.0 - smoothstep(0.58, 1.0, down));
            float flameWidth = (0.18 + midBulge * 0.56 + down * 0.10) * (0.88 + column * 0.18);
            float smokeWidth = (0.36 + midBulge * 0.46 + down * 0.06) * (0.92 + n * 0.22);
            float width = mix(flameWidth, smokeWidth, smoke);
            float edge = 1.0 - smoothstep(width, width + 0.13, dist);
            float topFade = mix(1.0, smoothstep(0.06, 0.26, down), smoke);
            float bottomFade = 1.0 - smoothstep(mix(0.86, 0.74, smoke), 1.0, down);
            float hotCore = 1.0 - smoothstep(0.0, mix(0.44, 0.64, smoke), dist);
            float flicker = mix(0.78 + 0.34 * step(0.44, fract(uTime * 18.0 + n)), 0.66 + n * 0.34, smoke);
            float bands = 0.82 + 0.18 * step(0.34, plumeHash(block + floor(down * 7.0)));
            float alpha = edge * topFade * bottomFade * flicker * bands * uOpacity;
            alpha *= mix(0.70 + hotCore * 0.42, 0.44 + n * 0.42, smoke);
            if (alpha < 0.018) discard;
            vec3 color = mix(uColorB, uColorA, mix(hotCore, n * 0.72, smoke));
            gl_FragColor = vec4(color, alpha);
            #include <encodings_fragment>
          }
        `,
      });
      getIslandRocketPlumeMaterial.cache[kind].userData.rocketPlumeShader = true;
      getIslandRocketPlumeMaterial.cache[kind].userData.rocketPlumeKind = kind;
    }
    return getIslandRocketPlumeMaterial.cache[kind];
  }

  const LEGACY_ISLAND_ROCKET_PLUME_LAYERS = [
    { y: -0.92, s: 0.28, spread: 0.12, mat: () => M.rocketFlameY, count: 4, travel: 0.045 },
    { y: -1.12, s: 0.26, spread: 0.22, mat: () => M.rocketFlameO, count: 6, travel: 0.070 },
    { y: -1.36, s: 0.22, spread: 0.34, mat: () => M.rocketFlameR, count: 8, travel: 0.095 },
    { y: -1.66, s: 0.17, spread: 0.48, mat: () => M.rocketFlameO, count: 7, travel: 0.125 },
    { y: -1.98, s: 0.12, spread: 0.62, mat: () => M.rocketFlameR, count: 6, travel: 0.155 },
    { y: -1.54, s: 0.23, spread: 0.50, mat: () => M.rocketSmoke, count: 4, travel: 0.085, smoke: true },
    { y: -2.18, s: 0.18, spread: 0.76, mat: () => M.rocketSmokeD, count: 3, travel: 0.120, smoke: true, darkSmoke: true },
  ];

  function registerIslandRocketFlame(mesh, seed, travel = 0.08, opts = {}) {
    mesh.userData.rocketFlame = true;
    mesh.userData.rocketSmoke = !!opts.smoke;
    mesh.userData.rocketSmokeDark = !!opts.darkSmoke;
    mesh.userData.flamePhase = seed * 1.73;
    mesh.userData.baseX = mesh.position.x;
    mesh.userData.baseZ = mesh.position.z;
    mesh.userData.baseY = mesh.position.y;
    mesh.userData.baseScale = mesh.scale.x || 1;
    mesh.userData.travel = travel;
    mesh.userData.baseMat = mesh.material;
    mesh.renderOrder = UNDER_ISLAND_EFFECT_RENDER_ORDER;
    islandRocketFlames.add(mesh);
    return mesh;
  }

  function addLegacyIslandRocketVoxelPlume(parent, seed = 0) {
    LEGACY_ISLAND_ROCKET_PLUME_LAYERS.forEach((layer, layerIdx) => {
      for (let i = 0; i < layer.count; i++) {
        const angle = (i / layer.count) * Math.PI * 2 + cellRand(seed + i, GRID, 8000 + layerIdx) * 0.9;
        const radius = layerIdx === 0 ? cellRand(seed + i, GRID, 8010 + layerIdx) * layer.spread : layer.spread * (0.42 + cellRand(seed - i, GRID, 8020 + layerIdx) * 0.58);
        const size = layer.s * (0.78 + cellRand(seed + i, GRID, 8030 + layerIdx) * 0.40);
        const mesh = vbox(
          parent,
          size,
          size,
          size,
          Math.cos(angle) * radius,
          layer.y - cellRand(seed - i, GRID, 8040 + layerIdx) * 0.10,
          Math.sin(angle) * radius,
          layer.mat(),
          { noGap: true, noBevel: true, noShadow: true },
        );
        registerIslandRocketFlame(mesh, seed + layerIdx * 11 + i, layer.travel, layer);
      }
    });
  }

  function addIslandRocketPlume(parent, seed = 0) {
    const specs = [
      { kind: 'flame', y: -1.45, w: 0.92, h: 1.82, travel: 0.10, phase: 0.2 },
      { kind: 'core',  y: -1.28, w: 0.48, h: 1.42, travel: 0.07, phase: 1.7 },
      { kind: 'smoke', y: -2.05, w: 1.04, h: 1.32, travel: 0.16, phase: 3.1 },
    ];
    const xFlip = cellRand(seed, GRID, 8140) < 0.5 ? -1 : 1;
    specs.forEach((spec, index) => {
      const mesh = new THREE.Mesh(getIslandRocketPlumeGeometry(), getIslandRocketPlumeMaterial(spec.kind));
      mesh.name = 'island_rocket_plume_' + spec.kind;
      mesh.position.set(0, spec.y, 0);
      mesh.scale.set(spec.w * xFlip, spec.h, 1);
      mesh.renderOrder = UNDER_ISLAND_EFFECT_RENDER_ORDER + index;
      mesh.userData = Object.assign({}, mesh.userData || {}, {
        noShadow: true,
        rocketPlumeSheet: true,
        flamePhase: seed * 1.73 + spec.phase,
        baseY: spec.y,
        baseScaleX: spec.w,
        baseScaleY: spec.h,
        xFlip,
        travel: spec.travel,
        plumeKind: spec.kind,
      });
      islandRocketFlames.add(mesh);
      parent.add(mesh);
    });
  }

  function updateIslandRocketPlumeFacing(mesh) {
    if (!mesh || !mesh.parent || !mesh.userData || !mesh.userData.rocketPlumeSheet) return;
    islandRocketPlumeCameraLocal.copy(camera.position);
    mesh.parent.worldToLocal(islandRocketPlumeCameraLocal);
    const dx = islandRocketPlumeCameraLocal.x - mesh.position.x;
    const dz = islandRocketPlumeCameraLocal.z - mesh.position.z;
    if (Math.abs(dx) + Math.abs(dz) < 0.0001) return;
    mesh.rotation.y = Math.atan2(dx, dz);
  }

  function makeVoxelRocketEngine(seed = 0) {
    const g = new THREE.Group();

    vbox(g, 1.02, 0.14, 1.02, 0, -0.07, 0, M.rocketSteelD, { noGap: true, noBevel: true });
    vbox(g, 0.84, 0.16, 0.84, 0, -0.20, 0, M.rocketSteel, { noGap: true, noBevel: true });
    vbox(g, 0.66, 0.20, 0.66, 0, -0.38, 0, M.rocketSteel, { noGap: true });
    vbox(g, 0.54, 0.18, 0.54, 0, -0.57, 0, M.rocketSteelD, { noGap: true });
    vbox(g, 0.42, 0.14, 0.42, 0, -0.73, 0, M.rocketHeat, { noGap: true });

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        vbox(g, 0.12, 0.48, 0.12, sx * 0.40, -0.35, sz * 0.40, M.rocketSteelD, { noGap: true });
        vbox(g, 0.16, 0.10, 0.16, sx * 0.40, -0.63, sz * 0.40, M.rocketSteel, { noGap: true });
      }
    }

    addIslandRocketPlume(g, seed);

    g.userData.kind = 'island-rocket-engine';
    castReceive(g);
    return g;
  }

  function addIslandRocketEngines(parent) {
    const span = GRID * TILE;
    const half = span * 0.5;
    const inset = Math.max(0.95, Math.min(1.55, span * 0.15));
    const y = -DIRT_H - 0.74; // match editable-island engine offset (parity)
    const placements = [
      [-half + inset, -half + inset],
      [ half - inset, -half + inset],
      [-half + inset,  half - inset],
      [ half - inset,  half - inset],
    ];
    // Home engines use the SAME selectable + upgradeable lift-engine system as
    // editable islands (propeller default, jet upgrade). buildHomeIslandEngines
    // (module 14) registers the home island + builds stamped, pickable engines.
    if (typeof buildHomeIslandEngines === 'function') { buildHomeIslandEngines(parent); return; }
    // Fallback if module 14 isn't loaded yet: plain (non-selectable) propellers.
    placements.forEach(([x, z], i) => {
      const engine = makeVoxelLiftEngine(1200 + i * 97, { type: 'lift', level: 1 });
      engine.position.set(x, y, z);
      engine.rotation.y = Math.atan2(x, z);
      if (engine.userData.propeller) editableIslandEnginePropellers.add(engine.userData.propeller);
      parent.add(engine);
    });
  }

  const editableIslandEnginePropellers = new Set();
  const EDITABLE_ISLAND_ENGINE_TYPES = new Set(['lift', 'turbo', 'heavy']);
  const editableIslandPropellerDiscTimeUniform = { value: 0 };
  const EDITABLE_ISLAND_PROP_DISC_RAMP_IN = 0.44;
  const EDITABLE_ISLAND_PROP_BLADE_RAMP_OUT = 0.76;
  const EDITABLE_ISLAND_PROP_LOCAL_Z = -2.84;
  const EDITABLE_ISLAND_PROP_SPINDLE_LINK_Z = -2.66;

  function normalizeEditableIslandEngineType(value) {
    const clean = String(value || '').toLowerCase();
    return EDITABLE_ISLAND_ENGINE_TYPES.has(clean) ? clean : 'lift';
  }

  function normalizeEditableIslandEngineState(raw, slot = 0) {
    const src = raw && typeof raw === 'object' ? raw : {};
    return {
      id: typeof src.id === 'string' && src.id ? src.id : 'engine-' + slot,
      slot,
      type: normalizeEditableIslandEngineType(src.type),
      level: Math.max(1, Math.min(3, Math.round(Number(src.level) || 1))),
      installed: src.installed !== false,
      mesh: null,
      propeller: null,
    };
  }

  function defaultEditableIslandEngineStates(rawEngines = null) {
    const out = [];
    for (let i = 0; i < 4; i++) {
      const src = Array.isArray(rawEngines) ? rawEngines[i] : null;
      out.push(normalizeEditableIslandEngineState(src, i));
    }
    return out;
  }

  function getEditableIslandPropellerDiscGeometry() {
    if (!getEditableIslandPropellerDiscGeometry.geo) {
      getEditableIslandPropellerDiscGeometry.geo = new THREE.CircleGeometry(1, 48);
      getEditableIslandPropellerDiscGeometry.geo.userData.cached = true;
    }
    return getEditableIslandPropellerDiscGeometry.geo;
  }

  function getEditableIslandPropellerDiscMaterial() {
    if (!getEditableIslandPropellerDiscMaterial.mat) {
      getEditableIslandPropellerDiscMaterial.mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: editableIslandPropellerDiscTimeUniform,
          // Darker tint so the spinning disc reads against the bright sky.
          uTint: { value: new THREE.Color(0x131517) },
          uWarm: { value: new THREE.Color(0x4a3526) },
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uTint;
          uniform vec3 uWarm;
          varying vec2 vUv;
          void main() {
            vec2 p = vUv * 2.0 - 1.0;
            float r = length(p);
            if (r > 1.0) discard;
            float a = atan(p.y, p.x);
            float rim = 1.0 - smoothstep(0.88, 1.0, r);
            float hubCut = smoothstep(0.16, 0.30, r);
            float bladeGhost = pow(max(0.0, cos(a * 4.0 - uTime * 34.0)), 7.0);
            float secondary = pow(max(0.0, cos(a * 8.0 + uTime * 9.0)), 5.0) * 0.28;
            float radialBand = 0.72 + 0.28 * sin(r * 18.0 - uTime * 21.0);
            float strobe = 0.72 + 0.28 * step(0.46, fract(uTime * 18.0));
            float alpha = hubCut * rim * radialBand * strobe * (0.46 + bladeGhost * 0.46 + secondary * 0.30);
            if (alpha < 0.014) discard;
            vec3 color = mix(uTint, uWarm, 0.18 + bladeGhost * 0.30);
            gl_FragColor = vec4(color, alpha);
            #include <encodings_fragment>
          }
        `,
      });
      getEditableIslandPropellerDiscMaterial.mat.userData.propellerDiscShader = true;
    }
    return getEditableIslandPropellerDiscMaterial.mat;
  }

  function makeVoxelLiftEngine(seed = 0, opts = {}) {
    // Ported from voxel_lift_engine.html. The authored wrapper tips the fan
    // downward; the blue thrust/plume system is intentionally omitted here.
    const type = normalizeEditableIslandEngineType(opts.type);
    const level = Math.max(1, Math.min(3, Math.round(Number(opts.level) || 1)));
    const slot = Math.max(0, Math.min(3, Math.round(Number(opts.slot) || 0)));
    const spinDirection = slot % 2 === 0 ? 1 : -1;
    const root = new THREE.Group();
    root.name = 'voxel-lift-engine';
    root.userData.kind = 'voxel-lift-engine';
    root.userData.engineType = type;
    root.userData.engineLevel = level;
    const engine = new THREE.Group();
    engine.rotation.x = -Math.PI / 2;
    root.add(engine);
    const body = new THREE.Group();
    engine.add(body);

    function sourceCube(parent, x, y, z, sx = 1, sy = 1, sz = 1, mat = M.rock) {
      return vbox(parent, sx, sy, sz, x, y, z, mat, { noGap: true });
    }
    function sourceVox(parent, x, y, z, mat = M.rock, s = 0.34) {
      return sourceCube(parent, x * s, y * s, z * s, s * 0.96, s * 0.96, s * 0.96, mat);
    }

    for (let y = -3; y <= 3; y++) {
      for (let x = -4; x <= 4; x++) {
        for (let z = -3; z <= 3; z++) {
          const r = Math.sqrt((x / 4.2) ** 2 + (y / 3.8) ** 2 + (z / 3.3) ** 2);
          if (r < 1.03 && !(Math.abs(x) > 3 && Math.abs(y) > 2)) {
            const roll = cellRand(seed + x * 13 + y * 31 + z * 47, GRID, 8820);
            const mat = roll < 0.18 ? M.rocketSteelD : (roll < 0.38 ? M.rockHi : M.rock);
            sourceVox(body, x, y, z, mat);
          }
        }
      }
    }

    for (let x = -2; x <= 2; x++) for (let y = -1; y <= 1; y++) sourceVox(body, x, y, -4, M.rocketSteelD);
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) sourceVox(body, x, y, -5, M.rocketSteel);
    sourceVox(body, 0, 0, -6, M.rockHi);
    sourceVox(body, 0, 0, -7, M.rocketSteelD);
    // Non-spinning sleeve from the authored shaft into the prop hub. Without
    // this the small balanced hub cubes can read as floating below the spindle.
    sourceCube(body, 0, 0, EDITABLE_ISLAND_PROP_SPINDLE_LINK_Z, 0.36, 0.36, 0.56, M.rocketSteelD);

    sourceCube(body, -1.25, 1.95, 0, 0.32, 1.55, 0.32, M.rockHi);
    sourceCube(body,  1.25, 1.95, 0, 0.32, 1.55, 0.32, M.rockHi);
    sourceCube(body, 0, 2.78, 0, 3.25, 0.34, 0.58, M.rock);
    sourceCube(body, 0, 1.45, -0.55, 1.25, 0.32, 0.90, M.bridgeWood);
    sourceCube(body, 0, 1.78, -0.55, 0.75, 0.26, 0.65, M.bridgeWood);

    sourceCube(body, 0, 0.90, 1.35, 1.10, 0.90, 0.80, M.bridgeWood);
    sourceCube(body, -1.75, -0.15, 0.40, 0.68, 1.25, 1.05, M.rock);
    sourceCube(body,  1.75, -0.15, 0.40, 0.68, 1.25, 1.05, M.rock);
    sourceCube(body, -2.25, -0.35, -0.65, 0.75, 0.95, 0.55, M.bridgeWoodD);
    sourceCube(body,  2.25, -0.35, -0.65, 0.75, 0.95, 0.55, M.bridgeWoodD);
    sourceCube(body, -2.25, -0.35, -0.98, 0.28, 0.28, 0.12, M.wallTrim);
    sourceCube(body,  2.25, -0.35, -0.98, 0.28, 0.28, 0.12, M.wallTrim);

    sourceCube(body, 0, -1.65, 0, 1.60, 0.55, 1.45, M.rocketSteelD);
    sourceCube(body, 0, -2.05, 0, 1.10, 0.45, 1.00, M.rocketSteel);
    if (type === 'turbo' || level >= 2) {
      sourceCube(body, 0, -2.42, 0, 1.34, 0.28, 1.24, M.rocketHeat);
      sourceCube(body, -1.02, -2.36, 0, 0.18, 0.62, 1.34, M.wallTrim);
      sourceCube(body, 1.02, -2.36, 0, 0.18, 0.62, 1.34, M.wallTrim);
    }
    if (type === 'heavy' || level >= 3) {
      sourceCube(body, -0.82, -2.72, 0, 0.42, 0.34, 0.95, M.rocketSteelD);
      sourceCube(body, 0.82, -2.72, 0, 0.42, 0.34, 0.95, M.rocketSteelD);
      sourceCube(body, 0, -2.92, 0, 1.48, 0.20, 1.34, M.rockHi);
    }

    const prop = new THREE.Group();
    prop.name = 'down-facing-propeller';
    // Local X/Y must stay centred; local Z drops the fan to the lower shaft mount.
    prop.position.set(0, 0, EDITABLE_ISLAND_PROP_LOCAL_Z - (level - 1) * 0.18);
    prop.userData.isEditableIslandEnginePropeller = true;
    prop.userData.spinDirection = spinDirection;
    prop.userData.spinSpeed = spinDirection * ((type === 'heavy' ? 7.5 : type === 'turbo' ? 14 : 10) + level * 2.8);
    prop.userData.spinRamp = 0;
    prop.userData.spinRampRate = type === 'heavy' ? 0.72 : (type === 'turbo' ? 1.08 : 0.88);
    engine.add(prop);
    // turbo propeller is BIGGER than the default lift; heavy reuses this as the
    // jet-nozzle scale.
    const propScale = type === 'heavy' ? 1.18 : type === 'turbo' ? 1.12 : 1;
    const showLegacyOuterCap = opts.showOuterPropellerCap === true;
    const showHubBlocks = opts.showPropellerHubBlocks === true;
    if (showLegacyOuterCap) {
      const cap = sourceCube(prop, 0, 0, 0, 0.85 * propScale, 0.85 * propScale, 0.45, M.rocketSteelD);
      cap.userData.legacyPropellerOuterCap = true;
    }
    if (showHubBlocks) {
      const innerHub = sourceCube(prop, 0, 0, -0.25, 0.45 * propScale, 0.45 * propScale, 0.36, M.rocketSteelD);
      const outerHub = sourceCube(prop, 0, 0,  0.25, 0.45 * propScale, 0.45 * propScale, 0.36, M.rocketSteelD);
      innerHub.userData.legacyPropellerHubBlock = true;
      outerHub.userData.legacyPropellerHubBlock = true;
    }
    const bladeRoots = [];
    function makeBlade(angle) {
      const blade = new THREE.Group();
      blade.rotation.z = angle;
      prop.add(blade);
      bladeRoots.push(blade);
      for (let i = 0; i < 9; i++) {
        const w = (0.42 + i * 0.025) * propScale;
        sourceCube(blade, 0, (0.58 + i * 0.33) * propScale, 0, w, 0.34 * propScale, 0.28, i % 2 ? M.bridgeWood : M.bridgeWoodD);
      }
      sourceCube(blade, 0, 3.65 * propScale, 0, 0.55 * propScale, 0.38 * propScale, 0.31, M.wallTrim);
      sourceCube(blade, 0, 3.95 * propScale, 0, 0.46 * propScale, 0.32 * propScale, 0.28, M.bridgeWood);
    }
    for (let i = 0; i < 4; i++) makeBlade(i * Math.PI / 2 + Math.PI / 4);
    const blurDisc = new THREE.Mesh(
      getEditableIslandPropellerDiscGeometry(),
      getEditableIslandPropellerDiscMaterial()
    );
    blurDisc.name = 'editable_island_propeller_blur_disc';
    blurDisc.userData.noShadow = true;
    blurDisc.userData.propellerBlurDisc = true;
    blurDisc.userData.baseRadius = 4.18 * propScale;
    blurDisc.renderOrder = UNDER_ISLAND_EFFECT_RENDER_ORDER + 3;
    blurDisc.visible = false;
    blurDisc.scale.setScalar(4.18 * propScale);
    blurDisc.position.z = 0.04;
    prop.add(blurDisc);
    prop.userData.bladeRoots = bladeRoots;
    prop.userData.blurDisc = blurDisc;
    if (type === 'turbo') {
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const ring = sourceCube(prop, Math.cos(a) * 2.98, Math.sin(a) * 2.98, 0.06, 0.32, 0.72, 0.18, M.rocketSteelD);
        ring.rotation.z = a;
      }
    }

    root.userData.propeller = prop;
    root.scale.setScalar(0.32 + (level - 1) * 0.018 + (type === 'heavy' ? 0.025 : 0));
    castReceive(root);
    return root;
  }

  function stampEditableIslandEngineMesh(mesh, island, engineState) {
    if (!mesh || !island || !engineState) return;
    const data = {
      kind: 'editable-island-engine',
      editableIslandId: island.id,
      editableIslandEngineId: engineState.id,
      editableIslandEngineSlot: engineState.slot,
    };
    mesh.traverse(node => {
      node.userData = Object.assign({}, node.userData || {}, data);
    });
  }

  function editableIslandEnginePlacement(slot) {
    const span = GRID * TILE;
    const half = span * 0.5;
    const inset = Math.max(0.95, Math.min(1.55, span * 0.15));
    const y = -DIRT_H - 0.74;
    const placements = [
      [-half + inset, -half + inset],
      [ half - inset, -half + inset],
      [ half - inset,  half - inset],
      [-half + inset,  half - inset],
    ];
    const [x, z] = placements[slot] || placements[0];
    return { x, y, z, rotationY: Math.atan2(x, z) };
  }

  function buildEditableIslandEngineMesh(island, engineState) {
    if (!island || !engineState || engineState.installed === false) return null;
    const placement = editableIslandEnginePlacement(engineState.slot || 0);
    const seed = 4200 + (engineState.slot || 0) * 137;
    // Heavy tier IS the ORIGINAL jet/rocket engine (makeVoxelRocketEngine) used
    // unchanged — its nozzle + thrust plume, no propeller. lift/turbo = propeller.
    let engine;
    if (engineState.type === 'heavy') {
      engine = makeVoxelRocketEngine(seed); // original jet, native size — unchanged
    } else {
      engine = makeVoxelLiftEngine(seed, engineState);
    }
    engine.position.set(placement.x, placement.y, placement.z);
    engine.rotation.y = placement.rotationY;
    stampEditableIslandEngineMesh(engine, island, engineState);
    engineState.mesh = engine;
    engineState.propeller = engine.userData.propeller || null; // null for rocket -> no propeller / no spin
    if (engineState.propeller) editableIslandEnginePropellers.add(engineState.propeller);
    return engine;
  }

  function addEditableIslandLiftEngines(parent, island) {
    if (!island) return;
    island.engines.forEach(engineState => {
      const engine = buildEditableIslandEngineMesh(island, engineState);
      if (engine) parent.add(engine);
    });
  }

  function tickEditableIslandEngines(dt, t = 0) {
    editableIslandPropellerDiscTimeUniform.value = t || 0;
    editableIslandEnginePropellers.forEach(prop => {
      if (!prop || !prop.parent) {
        editableIslandEnginePropellers.delete(prop);
        return;
      }
      const islandId = prop.userData && prop.userData.editableIslandId;
      const island = islandId ? editableIslandById.get(islandId) : null;
      if (island && island.lod !== 'full') return;
      const ramp = Math.min(1, (prop.userData.spinRamp || 0) + dt * (prop.userData.spinRampRate || 0.9));
      prop.userData.spinRamp = ramp;
      const easedRamp = ramp * ramp * (3 - ramp * 2);
      prop.rotation.z += dt * (prop.userData.spinSpeed || 10) * easedRamp;
      const disc = prop.userData.blurDisc;
      const blades = prop.userData.bladeRoots || [];
      const discVisible = ramp >= EDITABLE_ISLAND_PROP_DISC_RAMP_IN;
      if (disc) {
        disc.visible = discVisible;
        const pulse = discVisible ? 0.98 + Math.sin((t || 0) * 38 + ramp * 4) * 0.018 : 1;
        disc.scale.setScalar((disc.userData.baseRadius || disc.scale.x || 1) * pulse);
      }
      const bladesVisible = ramp < EDITABLE_ISLAND_PROP_BLADE_RAMP_OUT;
      for (let i = 0; i < blades.length; i++) blades[i].visible = bladesVisible;
    });
  }

  const islandRocketSmokePoint = new THREE.Vector3();
  function spawnIslandRocketSmokePuff(engine, intensity = 1) {
    if (!engine || !engine.parent || typeof smokeGeo === 'undefined' || smokeParticles.length >= MAX_SMOKE_PARTICLES) return;
    engine.getWorldPosition(islandRocketSmokePoint);
    xrWorldRoot.worldToLocal(islandRocketSmokePoint);
    const baseCount = Math.max(1, Math.min(5, Math.round(1 + intensity * 2)));
    for (let i = 0; i < baseCount; i++) {
      if (smokeParticles.length >= MAX_SMOKE_PARTICLES) break;
      const colorHex = Math.random() < 0.42 ? 0x4d5052 : (Math.random() < 0.55 ? 0x7c7f7e : 0xa9aaa5);
      const initialOpacity = 0.42 + Math.random() * 0.18;
      const p = new THREE.Mesh(smokeGeo, getCachedParticleMaterial(smokeMat, initialOpacity, colorHex));
      p.frustumCulled = true;
      p.renderOrder = UNDER_ISLAND_EFFECT_RENDER_ORDER;
      p.castShadow = false;
      p.receiveShadow = false;
      const a = Math.random() * Math.PI * 2;
      const r = 0.14 + Math.random() * 0.30;
      p.position.set(
        islandRocketSmokePoint.x + Math.cos(a) * r,
        islandRocketSmokePoint.y - 1.35 - Math.random() * 0.55,
        islandRocketSmokePoint.z + Math.sin(a) * r
      );
      p.userData = {
        life: 0,
        maxLife: 1.0 + Math.random() * 0.65,
        maxOpacity: initialOpacity,
        vy: -0.20 - Math.random() * 0.22,
        vx: Math.cos(a) * (0.12 + Math.random() * 0.20),
        vz: Math.sin(a) * (0.12 + Math.random() * 0.20),
        colorHex,
      };
      const sc = 1.35 + Math.random() * 1.10;
      p.scale.set(sc, sc * 0.78, sc);
      setCachedParticleMaterial(p, smokeMat, initialOpacity, colorHex);
      xrWorldRoot.add(p);
      smokeParticles.push(p);
    }
  }

  function triggerIslandRocketSmokePuffs(intensity = 1) {
    if (!islandRocketEngines || !islandRocketEngines.size) return;
    for (const engine of islandRocketEngines) {
      if (!engine || !engine.parent) {
        islandRocketEngines.delete(engine);
        continue;
      }
      if (Math.random() < Math.min(0.85, 0.32 + intensity * 0.16)) {
        spawnIslandRocketSmokePuff(engine, intensity);
      }
    }
  }

  function tickIslandRocketEngines(t, dt) {
    islandRocketPlumeTimeUniform.value = t || 0;
    if (!islandRocketFlames || !islandRocketFlames.size) return;
    islandRocketSmokeTimer += dt;
    if (islandRocketSmokeTimer > 2.8) {
      islandRocketSmokeTimer = 0;
      if (Math.random() < 0.55) triggerIslandRocketSmokePuffs(0.65);
    }
    for (const mesh of islandRocketFlames) {
      if (!mesh || !mesh.parent) {
        islandRocketFlames.delete(mesh);
        continue;
      }
      const phase = mesh.userData.flamePhase || 0;
      if (mesh.userData && mesh.userData.rocketPlumeSheet) {
        const pulse = 0.5 + Math.sin(t * 10.5 * ISLAND_ROCKET_FLAME_SPEED + phase) * 0.5;
        const drift = Math.sin(t * 3.0 * ISLAND_ROCKET_FLAME_SPEED + phase * 0.37);
        const smoke = mesh.userData.plumeKind === 'smoke';
        const sx = mesh.userData.baseScaleX || 1;
        const sy = mesh.userData.baseScaleY || 1;
        const xFlip = mesh.userData.xFlip || 1;
        mesh.scale.set(sx * xFlip * (0.94 + pulse * (smoke ? 0.08 : 0.14)), sy * (0.96 + Math.abs(drift) * (smoke ? 0.10 : 0.08)), 1);
        mesh.position.x = drift * (smoke ? 0.045 : 0.025);
        mesh.position.z = Math.sin(t * 2.4 + phase) * (smoke ? 0.050 : 0.022);
        mesh.position.y = (mesh.userData.baseY || 0) - (mesh.userData.travel || 0.08) * (smoke ? (0.35 + pulse * 0.55) : pulse);
        updateIslandRocketPlumeFacing(mesh);
        continue;
      }
      const smoke = !!mesh.userData.rocketSmoke;
      const pulse = 0.5 + Math.sin(t * (smoke ? 3.2 : 10.5) * ISLAND_ROCKET_FLAME_SPEED + phase) * 0.5;
      const puff = smoke ? Math.max(0, Math.sin(t * 0.92 + phase * 0.31)) : 0;
      const flicker = smoke ? (0.82 + pulse * 0.16 + puff * 0.42) : (0.86 + pulse * 0.30);
      const baseScale = mesh.userData.baseScale || 1;
      const mirror = Math.sin(t * (smoke ? 1.5 : 3.4) * ISLAND_ROCKET_FLAME_SPEED + phase * 0.73);
      const stretch = smoke ? (1.08 + puff * 0.38) : (0.90 + Math.abs(mirror) * 0.22);
      mesh.scale.set(baseScale * flicker * stretch, baseScale * flicker * (smoke ? 0.76 : 1), baseScale * flicker * (smoke ? stretch : (1.16 - (stretch - 0.90))));
      mesh.position.x = (mesh.userData.baseX || 0) * (smoke ? (0.84 + mirror * 0.12) : mirror);
      mesh.position.z = (mesh.userData.baseZ || 0) * (smoke ? (0.84 - mirror * 0.10) : 1);
      mesh.position.y = mesh.userData.baseY - (mesh.userData.travel || 0.08) * (smoke ? (0.4 + puff) : pulse);
      if (smoke && mesh.userData.baseMat) {
        const maxOp = mesh.userData.rocketSmokeDark ? 0.32 : 0.42;
        setCachedParticleMaterial(mesh, mesh.userData.baseMat, maxOp * (0.45 + puff * 0.55));
      }
      mesh.rotation.y += (smoke ? 0.22 : 0.65) * ISLAND_ROCKET_FLAME_SPEED * (0.6 + pulse) * dt;
    }
  }

  function voxelChimney(parent, x, y, z, tops) {
    vbox(parent, 0.12, 0.38, 0.12, x, y + 0.19, z, M.chimney);
    vbox(parent, 0.16, 0.06, 0.16, x, y + 0.41, z, M.chimney);
    tops.push(new THREE.Vector3(x, y + 0.47, z));
  }

  function makeVoxelLinearHouse(length = 1, orientation = 'z', floors = 1, opts = {}) {
    const g = new THREE.Group();
    const f = Math.max(1, Math.min(MAX_FLOORS, floors || 1));
    const alongZ = orientation === 'z';
    const bodyW = 0.76;
    const bodyD = length === 1 ? 0.72 : length * TILE - 0.18;
    const wallH = 0.46 + (f - 1) * 0.34;
    const wallMat = opts.wallMat || M.wallCream;
    const wallDark = opts.wallDark || M.wallTrim;
    const roofMat = opts.roofMat || M.roofBlue;
    const roofDark = opts.roofDark || M.roofBlueD;
    const house = new THREE.Group();
    const chimneyTops = [];

    vbox(house, bodyW, wallH, bodyD, 0, wallH / 2, 0, wallMat);
    vbox(house, bodyW + 0.04, 0.06, bodyD + 0.04, 0, 0.03, 0, wallDark);
    voxelSteppedRoof(house, bodyW, bodyD, wallH, roofMat, roofDark, 'z');

    const frontZ = bodyD / 2 + 0.026;
    const backZ = -bodyD / 2 - 0.026;
    voxelDoor(house, -0.13, frontZ, 'z');
    voxelWindow(house, 0.20, 0.32, frontZ, 'z');
    voxelWindow(house, -0.20, 0.32, backZ, 'z');
    if (length > 1) {
      for (let i = 0; i < length; i++) {
        const cellZ = -((length - 1) / 2) + i;
        voxelWindow(house, bodyW / 2 + 0.024, 0.34, cellZ, 'x');
        voxelWindow(house, -bodyW / 2 - 0.024, 0.34, cellZ, 'x');
      }
    } else {
      voxelWindow(house, bodyW / 2 + 0.024, 0.34, 0.02, 'x');
      voxelWindow(house, -bodyW / 2 - 0.024, 0.34, -0.02, 'x');
    }
    for (let floor = 1; floor < f; floor++) {
      const y = 0.32 + floor * 0.34;
      voxelWindow(house, -0.18, y, frontZ, 'z');
      voxelWindow(house, 0.18, y, frontZ, 'z');
      voxelWindow(house, -0.18, y, backZ, 'z');
      voxelWindow(house, 0.18, y, backZ, 'z');
    }

    const chimneys = Math.max(1, Math.min(3, Math.ceil(length / 2)));
    for (let i = 0; i < chimneys; i++) {
      const z = length === 1 ? -0.08 : -bodyD / 2 + 0.35 + i * (bodyD - 0.7) / Math.max(1, chimneys - 1);
      voxelChimney(house, -0.24, wallH + 0.12, z, chimneyTops);
    }

    if (!alongZ) {
      house.rotation.y = Math.PI / 2;
      const ax = new THREE.Vector3(0, 1, 0);
      g.userData = { kind: 'house', chimneyTops: chimneyTops.map(v => v.clone().applyAxisAngle(ax, Math.PI / 2)) };
    } else {
      g.userData = { kind: 'house', chimneyTops };
    }
    g.add(house);
    castReceive(g);
    return g;
  }

  function makeVoxelSquareHouse(floors = 1) {
    const g = new THREE.Group();
    const f = Math.max(1, Math.min(MAX_FLOORS, floors || 1));
    const side = 1.82;
    const wallH = 0.48 + (f - 1) * 0.34;
    const half = side / 2;
    const chimneyTops = [];

    vbox(g, side, wallH, side, 0, wallH / 2, 0, M.wallCream);
    vbox(g, side + 0.08, 0.08, side + 0.08, 0, 0.04, 0, M.wallTrim);
    for (let i = 0; i < 5; i++) {
      const s = side + 0.30 - i * 0.32;
      vbox(g, Math.max(0.22, s), 0.10, Math.max(0.22, s), 0, wallH + 0.05 + i * 0.085, 0, i === 4 ? M.roofBlueD : M.roofBlue);
    }
    voxelDoor(g, 0, half + 0.028, 'z', 0.36);
    for (const x of [-0.48, 0.48]) voxelWindow(g, x, 0.34, half + 0.032, 'z');
    for (const z of [-0.45, 0.45]) {
      voxelWindow(g, half + 0.032, 0.34, z, 'x');
      voxelWindow(g, -half - 0.032, 0.34, z, 'x');
    }
    for (let floor = 1; floor < f; floor++) {
      const y = 0.32 + floor * 0.34;
      for (const x of [-0.48, 0.48]) {
        voxelWindow(g, x, y, half + 0.032, 'z');
        voxelWindow(g, x, y, -half - 0.032, 'z');
      }
    }
    voxelChimney(g, -0.54, wallH + 0.12, -0.54, chimneyTops);
    voxelChimney(g, 0.54, wallH + 0.12, 0.54, chimneyTops);
    g.userData = { kind: 'house', chimneyTops };
    castReceive(g);
    return g;
  }

  function makeVoxelCompositeHouse(topology, floors = 1) {
    const { mainOrientation, mainCells, branches, bbox } = topology;
    const composite = new THREE.Group();
    const allChimneyTops = [];
    const bboxCX = (bbox.xMin + bbox.xMax) / 2;
    const bboxCZ = (bbox.zMin + bbox.zMax) / 2;
    const first = mainCells[0], last = mainCells[mainCells.length - 1];
    const mainCX = mainOrientation === 'z' ? first.x : (first.x + last.x) / 2;
    const mainCZ = mainOrientation === 'z' ? (first.z + last.z) / 2 : first.z;
    const mainWing = makeVoxelLinearHouse(mainCells.length, mainOrientation, floors);
    mainWing.position.set(mainCX - bboxCX, 0, mainCZ - bboxCZ);
    composite.add(mainWing);
    (mainWing.userData.chimneyTops || []).forEach(top => allChimneyTops.push(new THREE.Vector3(top.x + mainWing.position.x, top.y, top.z + mainWing.position.z)));

    const SHIFT = 0.12;
    const ax = new THREE.Vector3(0, 1, 0);
    for (const br of branches) {
      const orientation = (br.axis === '+x' || br.axis === '-x') ? 'x' : 'z';
      const wing = makeVoxelLinearHouse(1, orientation, floors);
      const flip = br.axis === '-x' || br.axis === '-z';
      if (flip) wing.rotation.y += Math.PI;
      let wx = br.x - bboxCX;
      let wz = br.z - bboxCZ;
      if      (br.axis === '+x') wx -= SHIFT;
      else if (br.axis === '-x') wx += SHIFT;
      else if (br.axis === '+z') wz -= SHIFT;
      else                       wz += SHIFT;
      wing.position.set(wx, 0, wz);
      composite.add(wing);
      for (const top of (wing.userData.chimneyTops || [])) {
        const r = flip ? top.clone().applyAxisAngle(ax, Math.PI) : top.clone();
        allChimneyTops.push(new THREE.Vector3(r.x + wx, r.y, r.z + wz));
      }
    }
    composite.userData = { kind: 'house', chimneyTops: allChimneyTops };
    castReceive(composite);
    return composite;
  }

  function makeVoxelManor(floors = 1) {
    const f = Math.max(1, Math.min(MAX_FLOORS, floors || 1));
    const g = makeVoxelLinearHouse(2, 'x', floors, {
      wallMat: M.manorBrick,
      wallDark: M.manorTrim,
      roofMat: M.manorRoof,
      roofDark: M.manorRoofD,
    });
    vbox(g, 0.58, 0.08, 0.30, 0, 0.04, 0.53, M.manorTrim);
    vbox(g, 0.76, 0.05, 0.16, 0, 0.025, 0.76, M.manorTrim);
    voxelDoor(g, 0, 0.41, 'z', 0.36);
    for (const x of [-0.22, 0.22]) {
      vbox(g, 0.060, 0.46, 0.060, x, 0.27, 0.66, M.manorTrim);
      vbox(g, 0.075, 0.46, 0.035, x, 0.27, 0.405, M.manorTrim);
    }
    vbox(g, 0.66, 0.08, 0.34, 0, 0.54, 0.54, M.manorTrim);
    vbox(g, 0.56, 0.035, 0.28, 0, 0.485, 0.54, M.manorTrim);
    if (f > 1) {
      const upperY = 0.32 + 0.34;
      for (const x of [-0.50, 0.50]) voxelWindow(g, x, upperY, 0.405, 'z', M.manorWindow);
    }
    return g;
  }

  function makeVoxelSkyscraper(floors = 4) {
    const g = new THREE.Group();
    const f = Math.max(4, Math.min(16, floors || 4));
    const floorH = 0.24;
    const h = f * floorH;
    vbox(g, 0.78, h, 0.78, 0, h / 2, 0, M.skyBody);
    for (let i = 0; i < f; i++) {
      const y = i * floorH + floorH * 0.55;
      vbox(g, 0.045, 0.11, 0.58, 0.415, y, 0, M.skyGlass);
      vbox(g, 0.045, 0.11, 0.58, -0.415, y, 0, M.skyGlass);
      vbox(g, 0.58, 0.11, 0.045, 0, y, 0.415, M.skyGlass);
      vbox(g, 0.58, 0.11, 0.045, 0, y, -0.415, M.skyGlass);
      if (i % 2 === 0) vbox(g, 0.84, 0.025, 0.84, 0, i * floorH + 0.02, 0, M.skyFrame);
    }
    vbox(g, 0.88, 0.08, 0.88, 0, h + 0.04, 0, M.skyRoof);
    vbox(g, 0.18, 0.12, 0.16, -0.20, h + 0.14, 0.18, M.castleStoneD);
    vbox(g, 0.035, 0.42, 0.035, 0.20, h + 0.27, -0.16, M.skyFrame);
    voxelDoor(g, 0, 0.42, 'z', 0.32);
    g.userData = { kind: 'house', chimneyTops: [] };
    castReceive(g);
    return g;
  }

  function makeVoxelStoneTower(floors = 2, palette = null) {
    const g = new THREE.Group();
    const f = Math.max(2, Math.min(MAX_FLOORS, floors || 2));
    const wallH = H.WALL_H * f + 0.20;
    const stone = (palette && palette.stone) || M.towerStone;
    const stoneD = (palette && palette.stoneD) || M.towerStoneD;
    const roof = (palette && palette.roof) || M.towerRoof;
    const roofD = (palette && palette.roofD) || M.towerRoofD;

    vbox(g, 0.84, 0.10, 0.84, 0, 0.05, 0, stoneD);
    vbox(g, 0.74, 0.08, 0.74, 0, 0.14, 0, stone);

    const layerH = 0.14;
    const layers = Math.ceil(wallH / layerH);
    for (let i = 0; i < layers; i++) {
      const h = i === layers - 1 ? Math.max(0.08, wallH - i * layerH) : layerH;
      const y = 0.18 + i * layerH + h * 0.5;
      const mat = i % 2 ? stoneD : stone;
      vbox(g, 0.52, h, 0.52, 0, y, 0, mat);
      vbox(g, 0.18, h, 0.60, -0.30, y, 0, mat);
      vbox(g, 0.18, h, 0.60,  0.30, y, 0, mat);
      vbox(g, 0.60, h, 0.18, 0, y, -0.30, mat);
      vbox(g, 0.60, h, 0.18, 0, y,  0.30, mat);
    }

    for (let i = 1; i <= f; i++) {
      const y = 0.18 + i * (wallH / f);
      vbox(g, 0.74, 0.035, 0.74, 0, y, 0, stoneD);
    }

    voxelDoor(g, 0, 0.39, 'z', 0.42);
    vbox(g, 0.35, 0.055, 0.07, 0, 0.45, 0.42, stoneD);
    vbox(g, 0.055, 0.42, 0.07, -0.17, 0.25, 0.415, stoneD);
    vbox(g, 0.055, 0.42, 0.07,  0.17, 0.25, 0.415, stoneD);

    for (let i = 0; i < f; i++) {
      const y = 0.42 + i * (wallH / f);
      if (i % 2 === 0) {
        vbox(g, 0.11, 0.18, 0.035, 0, y, -0.405, M.castleSlit);
      } else {
        vbox(g, 0.035, 0.18, 0.11, 0.405, y, 0, M.castleSlit);
      }
    }

    const balconyY = wallH + 0.20;
    vbox(g, 0.88, 0.075, 0.88, 0, balconyY, 0, stoneD);
    for (const x of [-0.36, -0.12, 0.12, 0.36]) {
      vbox(g, 0.055, 0.12, 0.055, x, balconyY + 0.10, 0.42, stone);
      vbox(g, 0.055, 0.12, 0.055, x, balconyY + 0.10, -0.42, stone);
      vbox(g, 0.055, 0.12, 0.055, 0.42, balconyY + 0.10, x, stone);
      vbox(g, 0.055, 0.12, 0.055, -0.42, balconyY + 0.10, x, stone);
    }
    vbox(g, 0.92, 0.035, 0.08, 0, balconyY + 0.18, 0.44, stoneD);
    vbox(g, 0.92, 0.035, 0.08, 0, balconyY + 0.18, -0.44, stoneD);
    vbox(g, 0.08, 0.035, 0.92, 0.44, balconyY + 0.18, 0, stoneD);
    vbox(g, 0.08, 0.035, 0.92, -0.44, balconyY + 0.18, 0, stoneD);

    const roofY = wallH + 0.30;
    vbox(g, 0.90, 0.08, 0.90, 0, roofY, 0, roofD);
    const roofSteps = [
      [0.74, 0.12, 0.74],
      [0.58, 0.11, 0.58],
      [0.42, 0.10, 0.42],
      [0.26, 0.09, 0.26],
      [0.12, 0.08, 0.12],
    ];
    let y = roofY + 0.10;
    roofSteps.forEach((step, i) => {
      y += step[1] * 0.5;
      vbox(g, step[0], step[1], step[2], 0, y, 0, i === roofSteps.length - 1 ? roofD : roof);
      y += step[1] * 0.5;
    });
    vbox(g, 0.07, 0.07, 0.07, 0, y + 0.05, 0, M.knob);
    vbox(g, 0.025, 0.32, 0.025, 0, y + 0.23, 0, stoneD);
    vbox(g, 0.18, 0.10, 0.025, 0.10, y + 0.32, 0, M.flagRed);
    vbox(g, 0.13, 0.06, 0.13, 0, y + 0.42, 0, roofD);
    vbox(g, 0.10, 0.10, 0.10, 0, y + 0.50, 0, M.windowLit);
    for (const side of [-1, 1]) {
      vbox(g, 0.075, 0.30, 0.026, side * 0.48, balconyY - 0.18, 0.10, side < 0 ? M.flagRed : roof, {
        noGap: true,
        rz: side * 0.045,
      });
    }

    g.userData = { kind: 'house', chimneyTops: [] };
    castReceive(g);
    return g;
  }

  function makeVoxelTurret(floors = 1, roofed = false, palette = null) {
    const g = new THREE.Group();
    const f = Math.max(1, Math.min(MAX_FLOORS, floors || 1));
    const wallH = 0.84 + (f - 1) * 0.30;
    const stone = (palette && palette.stone) || (roofed ? M.towerStone : M.castleStone);
    const stoneD = (palette && palette.stoneD) || (roofed ? M.towerStoneD : M.castleStoneD);
    const roof = (palette && palette.roof) || M.towerRoof;
    const roofD = (palette && palette.roofD) || M.towerRoofD;
    const stoneHi = M.step || stone;

    vbox(g, 0.86, 0.10, 0.86, 0, 0.05, 0, stoneD);
    vbox(g, 0.76, 0.08, 0.76, 0, 0.14, 0, stone);

    const courseH = 0.095;
    const courseCount = Math.ceil(wallH / courseH);
    for (let i = 0; i < courseCount; i++) {
      const h = i === courseCount - 1 ? Math.max(0.065, wallH - i * courseH) : courseH;
      const y = 0.18 + i * courseH + h * 0.5;
      const inset = i % 2 ? 0.020 : 0;
      const mat = i % 3 === 1 ? stoneD : stone;
      vbox(g, 0.62 + inset, h, 0.62 - inset, 0, y, 0, mat);
    }

    for (let i = 0; i < courseCount; i++) {
      const y = 0.18 + i * courseH + courseH * 0.5;
      const mat = i % 2 ? stone : stoneD;
      const size = i % 2 ? 0.115 : 0.095;
      for (const x of [-0.355, 0.355]) {
        vbox(g, size, courseH * 0.94, size, x, y,  0.355, mat);
        vbox(g, size, courseH * 0.94, size, x, y, -0.355, mat);
      }
    }

    for (let i = 1; i < courseCount; i += 2) {
      const y = 0.18 + i * courseH + 0.012;
      vbox(g, 0.34, 0.018, 0.030, -0.16, y,  0.393, stoneHi);
      vbox(g, 0.26, 0.018, 0.030,  0.20, y,  0.393, stoneHi);
      vbox(g, 0.28, 0.018, 0.030,  0.14, y, -0.393, stoneHi);
      vbox(g, 0.030, 0.018, 0.28,  0.393, y, -0.10, stoneHi);
      vbox(g, 0.030, 0.018, 0.26, -0.393, y,  0.16, stoneHi);
    }

    vbox(g, 0.74, 0.065, 0.74, 0, wallH + 0.03, 0, stoneD);
    vbox(g, 0.86, 0.075, 0.86, 0, wallH + 0.10, 0, stone);
    vbox(g, 0.74, 0.045, 0.74, 0, wallH + 0.16, 0, stoneD);

    if (roofed) {
      for (let i = 0; i < 4; i++) {
        const s = 0.74 - i * 0.14;
        vbox(g, s, 0.11, s, 0, wallH + 0.23 + i * 0.10, 0, i === 3 ? roofD : roof);
      }
      vbox(g, 0.035, 0.26, 0.035, 0, wallH + 0.75, 0, stoneD);
    } else {
      for (const x of [-0.30, 0, 0.30]) {
        vbox(g, 0.12, 0.16, 0.12, x, wallH + 0.27,  0.36, x === 0 ? stoneD : stone);
        vbox(g, 0.12, 0.16, 0.12, x, wallH + 0.27, -0.36, x === 0 ? stoneD : stone);
        vbox(g, 0.12, 0.16, 0.12,  0.36, wallH + 0.27, x, x === 0 ? stoneD : stone);
        vbox(g, 0.12, 0.16, 0.12, -0.36, wallH + 0.27, x, x === 0 ? stoneD : stone);
      }
      vbox(g, 0.16, 0.12, 0.08, 0, wallH + 0.27, 0.36, M.flagRed);
      vbox(g, 0.025, 0.34, 0.025, 0.18, wallH + 0.43, 0.26, stoneD);
      vbox(g, 0.18, 0.10, 0.025, 0.29, wallH + 0.54, 0.26, M.flagRed);
    }
    voxelDoor(g, 0, 0.405, 'z', 0.36);
    vbox(g, 0.31, 0.055, 0.065, 0, 0.41, 0.415, stoneD);
    vbox(g, 0.055, 0.34, 0.065, -0.17, 0.23, 0.415, stoneD);
    vbox(g, 0.055, 0.34, 0.065,  0.17, 0.23, 0.415, stoneD);

    vbox(g, 0.13, 0.20, 0.034, 0, wallH * 0.58,  0.414, M.castleSlit);
    vbox(g, 0.034, 0.20, 0.13, 0.414, wallH * 0.53, 0, M.castleSlit);
    vbox(g, 0.034, 0.18, 0.12, -0.414, wallH * 0.40, 0, M.castleSlit);
    if (f > 1) vbox(g, 0.12, 0.18, 0.034, 0.19, wallH * 0.78, -0.414, M.castleSlit);

    g.userData = { kind: 'house', chimneyTops: [] };
    castReceive(g);
    return g;
  }

  function makeVoxelTree(level = 1, seedX = 0, seedZ = 0) {
    const g = new THREE.Group();
    const L = Math.max(1, Math.min(MAX_FLOORS, level || 1));
    const trunkH = 0.46 + (L - 1) * 0.08;
    const trunkW = 0.15 + (L - 1) * 0.014;
    const leanX = (cellRand(seedX, seedZ, 1110) - 0.5) * 0.10;
    const leanZ = (cellRand(seedX, seedZ, 1120) - 0.5) * 0.10;
    vbox(g, trunkW, trunkH, trunkW, 0, trunkH / 2, 0, M.trunk);
    for (let i = 0; i < 2; i++) {
      const angle = cellRand(seedX + i, seedZ - i, 1130) * Math.PI * 2;
      const len = 0.16 + cellRand(seedX - i, seedZ + i, 1140) * 0.10;
      vbox(g, 0.045, 0.045, len, Math.cos(angle) * len * 0.35, trunkH * (0.52 + i * 0.16), Math.sin(angle) * len * 0.35, M.trunk, {
        ry: angle,
        noGap: true,
      });
    }
    const y = trunkH;
    const leafMats = voxelTreeLeafMaterials();
    vbox(g, 0.62 + L * 0.04, 0.26 + L * 0.02, 0.62 + L * 0.04, leanX * 0.35, y + 0.12, leanZ * 0.35, leafMats[0]);
    vbox(g, 0.48 + L * 0.035, 0.24 + L * 0.018, 0.48 + L * 0.035, leanX * 0.80, y + 0.32, leanZ * 0.80, leafMats[1]);
    vbox(g, 0.30 + L * 0.025, 0.20, 0.30 + L * 0.025, leanX, y + 0.50, leanZ, leafMats[2]);
    const accents = [
      [0.28 + leanX, y + 0.20, -0.22 + leanZ, 0.18, leafMats[3]],
      [-0.26 + leanX * 0.6, y + 0.18, 0.24 + leanZ * 0.6, 0.16, leafMats[4]],
      [0.20 + leanX, y + 0.38, 0.22 + leanZ, 0.14, leafMats[5]],
      [-0.18 + leanX * 1.1, y + 0.40, -0.22 + leanZ * 1.1, 0.13, leafMats[2]],
    ];
    accents.forEach(([x, ay, z, s, mat]) => {
      vbox(g, s, Math.max(0.11, s * 0.82), s, x, ay, z, mat);
    });
    if (L >= 4) {
      vbox(g, 0.22, 0.18, 0.22, 0.30, y + 0.20, -0.24, leafMats[5]);
      vbox(g, 0.20, 0.16, 0.20, -0.28, y + 0.18, 0.24, leafMats[3]);
    }
    g.userData = { kind: 'tree', swayPhase: Math.random() * Math.PI * 2 };
    castReceive(g);
    optimizeVoxelObjectGroup(g, { reason: 'voxel-tree' });
    return g;
  }

  function makeVoxelRock(neighbors, level = 1, seedX = 0, seedZ = 0, inWater = false) {
    const g = new THREE.Group();
    const extra = Math.max(0, Math.min(MAX_FLOORS, level || 1) - 1);
    const count = 4 + Math.min(extra, 5);
    for (let i = 0; i < count; i++) {
      const a = i * 1.67 + cellRand(seedX, seedZ, 700 + i);
      const r = i === 0 ? 0 : 0.16 + cellRand(seedX, seedZ, 720 + i) * 0.22;
      const w = 0.16 + cellRand(seedX, seedZ, 740 + i) * 0.16 + extra * 0.012;
      const h = 0.12 + cellRand(seedX, seedZ, 760 + i) * 0.20 + extra * 0.018;
      const mat = i % 3 === 0 ? M.rockHi : (i % 3 === 1 ? M.rockDk : M.rock);
      vbox(g, w, h, w * (0.8 + cellRand(seedX, seedZ, 780 + i) * 0.4), Math.cos(a) * r, h / 2 - (inWater ? 0.05 : 0), Math.sin(a) * r, mat, { ry: a * 0.7 });
    }
    if (neighbors && (neighbors.n || neighbors.s || neighbors.e || neighbors.w)) {
      if (neighbors.n) vbox(g, 0.34, 0.10, 0.22, 0, 0.05, -0.36, M.rockDk);
      if (neighbors.s) vbox(g, 0.34, 0.10, 0.22, 0, 0.05, 0.36, M.rockDk);
      if (neighbors.e) vbox(g, 0.22, 0.10, 0.34, 0.36, 0.05, 0, M.rockDk);
      if (neighbors.w) vbox(g, 0.22, 0.10, 0.34, -0.36, 0.05, 0, M.rockDk);
    }
    g.userData = { kind: 'rock' };
    castReceive(g);
    optimizeVoxelObjectGroup(g, { reason: 'voxel-rock' });
    return g;
  }

  function makeVoxelBridge(orientation, level = 1) {
    const g = new THREE.Group();
    const lv = Math.max(1, Math.min(4, level || 1));
    const stone = lv >= 3;
    const deckMat = stone ? M.castleStone : M.bridgeWood;
    const trimMat = stone ? M.castleStoneD : M.bridgeWoodD;
    vbox(g, 0.98, 0.10 + lv * 0.015, 0.62, 0, 0.08 + lv * 0.01, 0, deckMat);
    for (const z of [-0.31, 0.31]) {
      vbox(g, 0.96, 0.12 + lv * 0.025, 0.08, 0, 0.20 + lv * 0.015, z, trimMat);
      for (const x of [-0.38, 0, 0.38]) vbox(g, 0.07, 0.25 + lv * 0.04, 0.07, x, 0.16 + lv * 0.02, z, trimMat);
    }
    if (lv >= 2) {
      voxelSteppedRoof(g, 0.92, 0.66, 0.42, stone ? M.castleStone : M.bridgeWood, trimMat, 'z');
    }
    if (orientation === 'z') g.rotation.y = Math.PI / 2;
    g.userData = { kind: 'bridge', level: lv };
    castReceive(g);
    optimizeVoxelObjectGroup(g, { reason: 'voxel-bridge' });
    return g;
  }

  function makeVoxelFence(side = 'n', level = 1, castle = false, roadGate = false, pathOrientation = 'x') {
    const g = new THREE.Group();
    const lv = Math.max(1, Math.min(MAX_FLOORS, level || 1));
    const normalized = FENCE_SIDES.has(side) ? side : 'n';
    const alongX = roadGate ? pathOrientation === 'x' : (normalized === 'n' || normalized === 's' || normalized === 'center-x');
    const offsetX = normalized === 'w' ? -0.43 : normalized === 'e' ? 0.43 : 0;
    const offsetZ = normalized === 'n' ? -0.43 : normalized === 's' ? 0.43 : 0;
    const mat = castle || lv >= 4 ? M.castleStone : (lv >= 3 ? M.fenceSteel : M.fence);
    const dark = castle || lv >= 4 ? M.castleStoneD : (lv >= 3 ? M.fenceWire : M.fence);

    if (roadGate && lv === 1) {
      g.userData = { kind: 'fence', level: lv, side: normalized };
      return g;
    }
    if (castle || lv >= 4 || roadGate) {
      const h = roadGate ? 0.62 + Math.max(0, lv - 3) * 0.05 : (castle ? 0.56 : 0.46);
      if (roadGate) {
        for (const s of [-1, 1]) vbox(g, 0.14, h, 0.14, alongX ? s * 0.42 : 0, h / 2, alongX ? 0 : s * 0.42, mat);
        vbox(g, alongX ? 1.02 : 0.16, 0.12, alongX ? 0.16 : 1.02, 0, h + 0.06, 0, dark);
      } else {
        vbox(g, alongX ? 1.08 : 0.18, h, alongX ? 0.18 : 1.08, offsetX, h / 2, offsetZ, mat);
        vbox(g, alongX ? 1.12 : 0.22, 0.06, alongX ? 0.22 : 1.12, offsetX, h + 0.03, offsetZ, dark);
        for (const a of [-0.35, 0, 0.35]) {
          vbox(g, 0.11, 0.12, 0.11, alongX ? a : offsetX, h + 0.12, alongX ? offsetZ : a, mat);
        }
      }
    } else {
      const postH = lv === 2 ? 0.40 : 0.32;
      const ends = alongX ? [[-0.50, offsetZ], [0.50, offsetZ]] : [[offsetX, -0.50], [offsetX, 0.50]];
      ends.forEach(([x, z]) => vbox(g, 0.09, postH, 0.09, x, postH / 2, z, mat));
      for (const y of [0.12, 0.26, ...(lv >= 3 ? [0.40] : [])]) {
        vbox(g, alongX ? 1.08 : 0.045, 0.055, alongX ? 0.045 : 1.08, offsetX, y, offsetZ, dark);
      }
    }
    g.userData = { kind: 'fence', level: lv, side: normalized };
    castReceive(g);
    optimizeVoxelObjectGroup(g, { reason: 'voxel-fence' });
    return g;
  }

  function makeVoxelFenceSpan(side = 'n', level = 1, length = 1) {
    const spanCells = Math.max(1, Math.floor(length || 1));
    if (spanCells <= 1) return makeVoxelFence(side, level, false, false);
    const g = new THREE.Group();
    const lv = Math.max(1, Math.min(MAX_FLOORS, level || 1));
    const normalized = FENCE_SIDES.has(side) ? side : 'n';
    const alongX = normalized === 'n' || normalized === 's' || normalized === 'center-x';
    const offsetX = normalized === 'w' ? -0.43 : normalized === 'e' ? 0.43 : 0;
    const offsetZ = normalized === 'n' ? -0.43 : normalized === 's' ? 0.43 : 0;
    const spanLen = spanCells * TILE;
    const mat = lv >= 4 ? M.castleStone : (lv >= 3 ? M.fenceSteel : M.fence);
    const dark = lv >= 4 ? M.castleStoneD : (lv >= 3 ? M.fenceWire : M.fence);

    const alongPos = i => -spanLen / 2 + i * TILE;
    if (lv >= 4) {
      const h = 0.46;
      vbox(g, alongX ? spanLen + 0.08 : 0.18, h, alongX ? 0.18 : spanLen + 0.08, offsetX, h / 2, offsetZ, mat);
      vbox(g, alongX ? spanLen + 0.12 : 0.22, 0.06, alongX ? 0.22 : spanLen + 0.12, offsetX, h + 0.03, offsetZ, dark);
      for (let i = 0; i <= spanCells; i++) {
        const p = alongPos(i);
        vbox(g, 0.11, 0.12, 0.11, alongX ? p : offsetX, h + 0.12, alongX ? offsetZ : p, mat);
      }
    } else {
      const postH = lv === 2 ? 0.40 : 0.32;
      for (let i = 0; i <= spanCells; i++) {
        const p = alongPos(i);
        vbox(g, 0.09, postH, 0.09, alongX ? p : offsetX, postH / 2, alongX ? offsetZ : p, mat);
      }
      for (const y of [0.12, 0.26, ...(lv >= 3 ? [0.40] : [])]) {
        vbox(g, alongX ? spanLen + 0.08 : 0.045, 0.055, alongX ? 0.045 : spanLen + 0.08, offsetX, y, offsetZ, dark);
      }
    }
    g.userData = { kind: 'fence', level: lv, side: normalized, batchedSpan: true, spanCells };
    castReceive(g);
    optimizeVoxelObjectGroup(g, { reason: 'voxel-fence-span' });
    return g;
  }

  function makeVoxelCropKind(kind, level = 1) {
    const g = new THREE.Group();
    const extra = Math.max(0, Math.min(MAX_FLOORS, level || 1) - 1);
    const positions = [
      [-0.24, -0.24], [0, -0.24], [0.24, -0.24],
      [-0.24, 0], [0, 0], [0.24, 0],
      [-0.24, 0.24], [0, 0.24], [0.24, 0.24],
    ];
    const count = kind === 'tuft' ? 5 : Math.min(positions.length, 3 + extra);
    for (let i = 0; i < count; i++) {
      const [x, z] = positions[(i * 2 + extra) % positions.length];
      if (kind === 'corn') {
        vbox(g, 0.045, 0.54, 0.045, x, 0.27, z, M.cornStalk);
        vbox(g, 0.07, 0.14, 0.07, x + 0.04, 0.34, z, M.cornCob);
        vbox(g, 0.10, 0.08, 0.045, x - 0.04, 0.44, z, M.cornLeaf);
      } else if (kind === 'wheat') {
        vbox(g, 0.030, 0.35, 0.030, x, 0.175, z, M.wheatStalk);
        vbox(g, 0.070, 0.10, 0.050, x, 0.40, z, M.wheatHead);
      } else if (kind === 'pumpkin') {
        vbox(g, 0.20, 0.14, 0.20, x, 0.07, z, i % 2 ? M.pumpkinDk : M.pumpkin);
        vbox(g, 0.04, 0.07, 0.04, x, 0.17, z, M.pumpkinStem);
      } else if (kind === 'carrot') {
        vbox(g, 0.065, 0.06, 0.065, x, 0.03, z, M.carrotBody);
        vbox(g, 0.035, 0.15, 0.035, x, 0.12, z, M.cropStem);
      } else if (kind === 'sunflower') {
        vbox(g, 0.04, 0.58, 0.04, x, 0.29, z, M.sunflowerStalk);
        vbox(g, 0.18, 0.14, 0.055, x, 0.63, z, M.sunflowerPetal);
        vbox(g, 0.08, 0.08, 0.06, x, 0.64, z + 0.01, M.sunflowerCenter);
      } else if (kind === 'flower') {
        vbox(g, 0.03, 0.16, 0.03, x, 0.08, z, M.leavesDk);
        vbox(g, 0.11, 0.06, 0.11, x, 0.19, z, [M_PLANT.petalRed, M_PLANT.petalYellow, M_PLANT.petalPurple][i % 3]);
      } else if (kind === 'bush') {
        vbox(g, 0.28, 0.22, 0.28, x, 0.11, z, i % 2 ? M.leavesDk : M.leaves);
        if (i % 3 === 0) vbox(g, 0.05, 0.05, 0.05, x + 0.06, 0.24, z, M_PLANT.bushBerry);
      } else if (kind === 'tuft') {
        vbox(g, 0.05, 0.12 + (i % 3) * 0.025, 0.05, x * 0.45, 0.06 + (i % 3) * 0.012, z * 0.45, M.leaves);
      } else {
        vbox(g, 0.07, 0.12, 0.07, x, 0.06, z, M.cropStem);
        vbox(g, 0.18, 0.16, 0.18, x, 0.17, z, M.cropLeaf);
      }
    }
    g.userData = { kind };
    castReceive(g);
    optimizeVoxelObjectGroup(g, { reason: 'voxel-crop' });
    return g;
  }

  function makeVoxelPumpkinCarriage() {
    const g = new THREE.Group();
    vbox(g, 0.56, 0.38, 0.46, 0, 0.25, 0, M.pumpkin);
    vbox(g, 0.62, 0.08, 0.50, 0, 0.42, 0, M.pumpkinDk);
    voxelWindow(g, 0, 0.28, 0.255, 'z', M.windowB);
    vbox(g, 0.05, 0.12, 0.05, 0, 0.52, 0, M.pumpkinStem);
    for (const x of [-0.26, 0.26]) {
      for (const z of [-0.24, 0.24]) {
        vbox(g, 0.13, 0.13, 0.07, x, 0.09, z, M.woodTrim);
        vbox(g, 0.06, 0.06, 0.08, x, 0.09, z, M.knob);
      }
    }
    g.userData = { kind: 'pumpkin', carriage: true, swayPhase: Math.random() * Math.PI * 2 };
    castReceive(g);
    optimizeVoxelObjectGroup(g, { reason: 'voxel-pumpkin-carriage' });
    return g;
  }

  function makeVoxelAnimal(kind) {
    const g = new THREE.Group();
    const sheep = kind === 'sheep';
    const bodyMat = sheep ? M_ANIMAL.sheepWool : M_ANIMAL.cowWhite;
    const faceMat = sheep ? M_ANIMAL.sheepFace : M_ANIMAL.cowWhite;
    vbox(g, sheep ? 0.34 : 0.42, sheep ? 0.24 : 0.26, sheep ? 0.22 : 0.24, 0, 0.22, 0, bodyMat);
    vbox(g, sheep ? 0.14 : 0.18, sheep ? 0.14 : 0.16, sheep ? 0.12 : 0.16, 0.24, 0.30, 0, faceMat);
    if (!sheep) {
      vbox(g, 0.16, 0.04, 0.12, 0.02, 0.36, 0.05, M_ANIMAL.cowSpot);
      vbox(g, 0.08, 0.08, 0.10, 0.36, 0.26, 0, M_ANIMAL.cowMuzzle);
    } else {
      for (const x of [-0.10, 0, 0.10]) vbox(g, 0.10, 0.06, 0.10, x, 0.36, 0.03, M_ANIMAL.sheepWool);
    }
    [[0.13, -0.08], [0.13, 0.08], [-0.13, -0.08], [-0.13, 0.08]].forEach(([x, z]) => {
      vbox(g, 0.06, 0.14, 0.06, x, 0.07, z, M_ANIMAL.hoof);
    });
    g.userData = { kind };
    castReceive(g);
    optimizeVoxelObjectGroup(g, { reason: 'voxel-animal' });
    return g;
  }

  function makeVoxelMicroKind(kind, level = 1, x = 0, z = 0) {
    const g = new THREE.Group();
    if (kind === 'chimney') {
      vbox(g, 0.16, 0.40, 0.16, 0, 0.20, 0, M.chimney);
      vbox(g, 0.20, 0.07, 0.20, 0, 0.44, 0, M.chimney);
      vbox(g, 0.11, 0.10, 0.11, 0, 0.53, 0, M.cloudWhite);
      g.userData = { kind: 'chimney', chimneyTops: [new THREE.Vector3(0, 0.50, 0)] };
    } else if (kind === 'ripple') {
      vbox(g, 0.44, 0.018, 0.08, 0, 0.018, 0, M.waterFoam);
      vbox(g, 0.26, 0.018, 0.06, 0.04, 0.038, 0.16, M.waterFoam);
      vbox(g, 0.22, 0.018, 0.05, -0.06, 0.038, -0.15, M.waterDk);
      g.userData = { kind: 'ripple' };
    } else if (kind === 'shrub') {
      const bush = makeVoxelCropKind('bush', Math.max(1, level));
      bush.scale.set(0.72, 0.72, 0.72);
      return bush;
    } else if (kind === 'pebble') {
      const pebble = makeVoxelRock(null, 1, x, z, false);
      pebble.scale.set(0.55, 0.55, 0.55);
      return pebble;
    } else if (kind === 'stone') {
      return makeVoxelRock(null, Math.max(1, level), x, z, false);
    } else if (kind === 'bridge-rail') {
      const rail = makeVoxelFence('center-x', Math.max(1, level), false, false);
      rail.scale.set(0.80, 0.80, 0.80);
      return rail;
    }
    castReceive(g);
    return g;
  }

  function makeVoxelRenderForCell(kind, x, z, cell, level) {
    let mesh = null;
    let posX = null;
    let posZ = null;
    let setGridUserData = true;

    if (kind === 'voxel-build') mesh = makeVoxelBuildStamp(cell.appearance && cell.appearance.voxelBuildId, { appearance: cell.appearance });
    else if (kind === 'model-stamp') mesh = makeModelStamp(cell.appearance && cell.appearance.modelStampId, { appearance: cell.appearance });
    else if (kind === 'tree') mesh = makeVoxelTree(level, x, z);
    else if (kind === 'rock') mesh = makeVoxelRock(getRockNeighbors(x, z), level, x, z, cell.terrain === 'water');
    else if (kind === 'bridge') mesh = makeVoxelBridge(getBridgeOrientation(x, z), level);
    else if (kind === 'tuft' || kind === 'flower' || kind === 'bush' || kind === 'crop' || kind === 'corn' || kind === 'wheat' || kind === 'carrot' || kind === 'sunflower') mesh = makeVoxelCropKind(kind, level);
    else if (kind === 'pumpkin') mesh = (level >= MAX_FLOORS && isCarriagePumpkin(x, z)) ? makeVoxelPumpkinCarriage() : makeVoxelCropKind('pumpkin', level);
    else if (kind === 'cow' || kind === 'sheep') mesh = makeVoxelAnimal(kind);
    else if (kind === 'chimney' || kind === 'ripple' || kind === 'shrub' || kind === 'stone' || kind === 'pebble' || kind === 'bridge-rail') mesh = makeVoxelMicroKind(kind, level, x, z);
    else if (kind === 'fence') {
      if (cell.terrain === 'path') {
        const pn = getPathNeighbors(x, z);
        const pathAxis = (pn.e || pn.w) ? 'x' : (pn.n || pn.s) ? 'z' : 'x';
        mesh = makeVoxelFence(normalizeFenceSide(cell.fenceSide), level, false, true, pathAxis);
      } else {
        const span = findFenceRenderSpan(x, z);
        if (span && !span.isAnchor) return { skip: true };
        if (span && span.length > 1) {
          mesh = makeVoxelFenceSpan(span.side, span.level, span.length);
          const a = cellRenderPositionForCell(span.anchorX, span.anchorZ);
          posX = a.x;
          posZ = a.z;
          if (span.axis === 'x') posX += (span.length - 1) * TILE / 2;
          else posZ += (span.length - 1) * TILE / 2;
          setGridUserData = false;
        } else {
          mesh = makeVoxelFence(normalizeFenceSide(cell.fenceSide), level, isCastleFence(x, z), false);
        }
      }
    } else if (kind === 'house') {
      const floors = cell.floors || 1;
      const bType = cell.buildingType || null;
      if (bType === 'skyscraper') {
        mesh = makeVoxelSkyscraper(Math.max(floors, 4));
      } else if (bType === 'manor') {
        mesh = makeVoxelManor(floors);
      } else if (bType === 'tower') {
        mesh = makeVoxelStoneTower(Math.max(floors, 2), towerPaletteWithAppearance(getMergedBuildingPalette(x, z, 'tower'), cell.appearance));
      } else if (bType === 'turret') {
        mesh = makeVoxelTurret(floors, false);
      } else {
        const cluster = findHouseCluster(x, z);
        if (!cluster.isAnchor) return { skip: true };
        if (cluster.kind === 'turret') {
          mesh = makeVoxelTurret(floors, false);
        } else if (cluster.kind === 'solo') {
          mesh = makeVoxelLinearHouse(1, 'z', floors);
        } else if (cluster.kind === 'linear') {
          mesh = makeVoxelLinearHouse(cluster.length, cluster.orientation, floors);
          const a = tilePos(cluster.anchorX, cluster.anchorZ);
          posX = a.x;
          posZ = a.z;
          if (cluster.orientation === 'x') posX += (cluster.length - 1) * TILE / 2;
          else posZ += (cluster.length - 1) * TILE / 2;
          setGridUserData = false;
        } else if (cluster.kind === 'composite') {
          mesh = makeVoxelCompositeHouse(cluster.topology, floors);
          const t = cluster.topology;
          posX = (t.bbox.xMin + t.bbox.xMax) / 2 - GRID / 2 + 0.5;
          posZ = (t.bbox.zMin + t.bbox.zMax) / 2 - GRID / 2 + 0.5;
          setGridUserData = false;
        } else if (cluster.kind === 'square') {
          mesh = makeVoxelSquareHouse(floors);
          posX = (cluster.anchorX + 0.5) - GRID / 2 + 0.5;
          posZ = (cluster.anchorZ + 0.5) - GRID / 2 + 0.5;
          setGridUserData = false;
        }
      }
    }

    return mesh ? { mesh, posX, posZ, setGridUserData } : null;
  }

  function makeVehicleUpperShellGeometry(w, l, h, insetX, insetZ) {
    const x1 = w / 2;
    const x2 = w / 2 - insetX;
    const z1 = l / 2;
    const z2 = l / 2 - insetZ;
    const vertices = [
      -x1, 0, -z1,  x1, 0, -z1,  x1, 0, z1,  -x1, 0, z1,
      -x2, h, -z2,  x2, h, -z2,  x2, h, z2,  -x2, h, z2,
    ];
    const indices = [
      0, 1, 2, 0, 2, 3,
      4, 6, 5, 4, 7, 6,
      0, 5, 1, 0, 4, 5,
      1, 6, 2, 1, 5, 6,
      2, 7, 3, 2, 6, 7,
      3, 4, 0, 3, 7, 4,
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  function makeVehicle(opts = {}) {
    const g = new THREE.Group();
    const wheels = [];
    const flagPivots = [];
    const visualScale = clampVehicleNumber(Number(opts.visualScale), VEHICLE_VISUAL_SCALE_MIN, VEHICLE_VISUAL_SCALE_MAX, vehicleVisualScaleForGrid());
    const WHEEL_R = VEHICLE_BASE_WHEEL_RADIUS;
    const BODY_W = 0.62;
    const BODY_L = 0.84;
    const BODY_LOWER_H = 0.24;
    const BODY_UPPER_H = 0.17;
    const BODY_Y0 = 0.04;

    const lower = new THREE.Mesh(new THREE.BoxGeometry(BODY_W, BODY_LOWER_H, BODY_L), M_VEHICLE.shell);
    lower.position.y = BODY_Y0 + BODY_LOWER_H / 2;
    g.add(lower);

    const upper = new THREE.Mesh(
      makeVehicleUpperShellGeometry(BODY_W, BODY_L, BODY_UPPER_H, 0.08, 0.10),
      M_VEHICLE.shell
    );
    upper.position.y = BODY_Y0 + BODY_LOWER_H;
    g.add(upper);

    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.24, BODY_LOWER_H * 0.52, 0.024), M_VEHICLE.dark);
    strip.position.set(0, BODY_Y0 + BODY_LOWER_H * 0.60, BODY_L / 2 + 0.006);
    g.add(strip);

    function addHeadlight(x) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.045, 0.024), M_VEHICLE.light);
      light.position.set(x, BODY_Y0 + 0.07, BODY_L / 2 + 0.012);
      g.add(light);
    }
    addHeadlight(-0.19);
    addHeadlight(0.19);

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(BODY_W * 0.96, 0.04, 0.026), M_VEHICLE.dark);
    bumper.position.set(0, BODY_Y0 + 0.02, BODY_L / 2 + 0.012);
    g.add(bumper);

    function addSideAccent(side) {
      const accent = new THREE.Mesh(getBoxGeometry(0.022, 0.028, BODY_L - 0.06), M_VEHICLE.dark);
      accent.position.set(side * (BODY_W / 2 + 0.002), BODY_Y0 + BODY_LOWER_H - 0.012, 0);
      g.add(accent);
    }
    addSideAccent(-1);
    addSideAccent(1);

    const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.11, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.115, 8);
    hubGeo.rotateZ(Math.PI / 2);
    const wx = BODY_W / 2 + 0.035;
    const wz = BODY_L / 2 - 0.20;

    function addWheel(x, z) {
      const tire = new THREE.Mesh(wheelGeo, M_VEHICLE.tire);
      tire.position.set(x, 0, z);
      g.add(tire);
      const hub = new THREE.Mesh(hubGeo, M_VEHICLE.hub);
      hub.position.copy(tire.position);
      g.add(hub);
      wheels.push(tire, hub);
    }
    addWheel(-wx, wz);
    addWheel(wx, wz);
    addWheel(-wx, -wz);
    addWheel(wx, -wz);

    const poleBaseY = BODY_Y0 + BODY_LOWER_H + BODY_UPPER_H;
    const poleX = BODY_W * 0.30;
    const poleZ = -BODY_L * 0.26;
    const poleH = 0.52;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, poleH, 6), M_VEHICLE.pole);
    pole.position.set(poleX, poleBaseY + poleH / 2, poleZ);
    g.add(pole);

    const flagPivot = new THREE.Group();
    flagPivot.position.set(poleX + 0.01, poleBaseY + poleH - 0.14, poleZ);
    g.add(flagPivot);
    flagPivots.push(flagPivot);

    const flagGeo = new THREE.BufferGeometry();
    flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0.14, 0,
      0.22, 0.04, 0,
      0, -0.08, 0,
    ], 3));
    flagGeo.setIndex([0, 1, 2]);
    flagGeo.computeVertexNormals();
    const flag = new THREE.Mesh(flagGeo, M_VEHICLE.flag);
    flagPivot.add(flag);

    const beacon = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.010, 8, 28), M_VEHICLE.beacon);
    beacon.position.set(0, BODY_Y0 + BODY_LOWER_H + 0.02, 0);
    beacon.rotation.x = Math.PI / 2;
    g.add(beacon);

    g.userData = { kind: 'vehicle', wheels, flagPivots, visualScale };
    g.scale.setScalar(visualScale);
    castReceive(g);
    beacon.castShadow = false;
    beacon.receiveShadow = false;
    return g;
  }

