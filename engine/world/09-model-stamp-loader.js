  // -------- repo model stamp loader --------
  const MODEL_STAMP_MANIFEST_URL = 'models/stamp-manifest.json';
  const MODEL_STAMP_DEFAULTS_LS = 'tinyworld:model-stamp-defaults.v1';
  const MODEL_STAMP_DROPPED_DB_NAME = 'tinyworld-model-stamps.v1';
  const MODEL_STAMP_DROPPED_DB_VERSION = 1;
  const MODEL_STAMP_DROPPED_STORE = 'dropped-model-files';
  const MODEL_STAMP_DROPPED_CLOUD_MAX_BYTES = 18 * 1024 * 1024;
  const MODEL_STAMP_SUPPORTED_FORMATS = new Set(['glb', 'gltf', 'obj', 'fbx', 'vox', 'vdb']);
  const MODEL_STAMP_DETECTED_FORMATS = new Set(['glb', 'gltf', 'obj', 'fbx', 'vox', 'vdb']);
  const MODEL_STAMP_TEXTURE_FORMATS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
  let MODEL_STAMP_ASSETS = [];
  let selectedModelStampId = null;
  let modelStampDefaults = loadModelStampDefaults();
  let modelStampScanMessage = 'Scanning models…';
  const modelStampAssetCache = new Map();
  const modelStampTextureCache = new Map();
  const modelStampDroppedObjectUrls = new Map();
  const modelStampDroppedShareRecords = new Map();
  let modelStampDroppedRestorePromise = null;
  let modelStampDracoLoader = null;
  let modelStampKtx2Loader = null;
  const CROWD_MODEL_CHARACTER_RE = /(character|person|people|human|man|woman|girl|boy|child|townie|avatar|npc|rig|skinned|walk|run|hitman|heisenberg)/i;
  const CROWD_MODEL_NEGATIVE_RE = /(building|house|tower|city|plane|aircraft|airplane|boat|ship|vessel|engine|prop|trap|terrain|tree|rock|vehicle|car|truck)/i;
  const MODEL_STAMP_FALLBACK_PALETTES = {
    building: [0xd7c092, 0xa84f3f, 0x365171, 0x2c3037, 0x7f8c64, 0xf0dec0],
    boat: [0x2f6f8c, 0xa75f3e, 0xf0d7a8, 0x324a5f, 0xe8efe8],
    plane: [0xd84a36, 0xf4e7c3, 0x2d6f93, 0x26364d, 0xf1c15e],
    generic: [0xd4b483, 0x8fb07a, 0x5d86a6, 0xbe6a4a, 0xf0d69c, 0x3b4458],
  };
  // Muted, natural tones used as a single coherent body colour for untextured
  // "generic" models. Banding many hues across one mesh (the old behaviour)
  // produced a rainbow-confetti look; picking one of these per model keeps the
  // result calm and clearly reads as "no material supplied".
  const MODEL_STAMP_GENERIC_SOLID = [0xb9b3a6, 0xa8b89a, 0xc7b29a, 0x9fb0bd, 0xc2a99a, 0xb1aab2];

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
      objectScale: +clampModelStampNumber(v.objectScale !== undefined ? v.objectScale : v.scale, 1, 0.2, 24).toFixed(3),
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
      const res = await fetch('/api/model-stamp-defaults?ts=' + Date.now(), { cache: 'no-store', signal: bootFetchTimeoutSignal() });
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

  function deleteDroppedModelStamp(id) {
    const safe = modelStampIdSafe(id);
    const asset = safe ? getModelStamp(safe) : null;
    if (!safe || !asset || !asset.dropped) return Promise.resolve(false);
    MODEL_STAMP_ASSETS = MODEL_STAMP_ASSETS.filter(item => item && item.id !== safe);
    modelStampAssetCache.delete(safe);
    modelStampDroppedShareRecords.delete(safe);
    delete modelStampDefaults[safe];
    try { localStorage.setItem(MODEL_STAMP_DEFAULTS_LS, JSON.stringify({ version: 1, stamps: modelStampDefaults })); } catch (_) {}
    if (selectedModelStampId === safe) selectedModelStampId = null;
    if (typeof refreshOpenStampBuilderCards === 'function') refreshOpenStampBuilderCards();
    if (typeof syncModelStampSettingsPanel === 'function') {
      syncModelStampSettingsPanel(typeof selectedTool !== 'undefined' ? selectedTool : null);
    }
    const deleteRecord = modelStampOpenDroppedDb()
      .then(db => new Promise(resolve => {
        const tx = db.transaction(MODEL_STAMP_DROPPED_STORE, 'readwrite');
        const store = tx.objectStore(MODEL_STAMP_DROPPED_STORE);
        store.delete(safe);
        tx.oncomplete = () => { try { db.close(); } catch (_) {} resolve(true); };
        tx.onerror = () => { try { db.close(); } catch (_) {} resolve(false); };
        tx.onabort = () => { try { db.close(); } catch (_) {} resolve(false); };
      }))
      .catch(() => false);
    if (typeof window.__tinyworldSyncAssetsToCloud === 'function') window.__tinyworldSyncAssetsToCloud();
    return deleteRecord;
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
      frames: Array.isArray(raw.frames) && raw.frames.length > 1
        ? raw.frames.map(f => ({ url: String((f && f.url) || '').trim(), name: String((f && f.name) || '').slice(0, 96) })).filter(f => f.url)
        : null,
      warnings: Array.isArray(raw.warnings) ? raw.warnings.map(item => String(item || '').slice(0, 120)).filter(Boolean) : [],
      dropped: !!raw.dropped,
      transient: !!raw.transient,
      localFiles: raw.localFiles && typeof raw.localFiles === 'object' ? raw.localFiles : null,
    };
  }

  function modelStampFileExtension(name) {
    const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : '';
  }

  function modelStampFileBaseName(path) {
    const clean = String(path || '').split(/[?#]/)[0].replace(/\\/g, '/').split('/').pop() || '';
    try { return decodeURIComponent(clean).toLowerCase(); } catch (_) { return clean.toLowerCase(); }
  }

  function modelStampSlug(name) {
    return String(name || 'model')
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 42) || 'model';
  }

  function modelStampLocalUrlForRef(asset, ref) {
    if (!asset || !asset.localFiles) return null;
    const key = modelStampFileBaseName(ref);
    return key ? asset.localFiles[key] || null : null;
  }

  function modelStampObjectUrlForFile(file) {
    const key = file && (file.name + ':' + file.size + ':' + file.lastModified);
    if (!key) return '';
    if (!modelStampDroppedObjectUrls.has(key)) modelStampDroppedObjectUrls.set(key, URL.createObjectURL(file));
    return modelStampDroppedObjectUrls.get(key);
  }

  function modelStampOpenDroppedDb() {
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
    return new Promise((resolve, reject) => {
      let req = null;
      try {
        req = indexedDB.open(MODEL_STAMP_DROPPED_DB_NAME, MODEL_STAMP_DROPPED_DB_VERSION);
      } catch (err) {
        reject(err);
        return;
      }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(MODEL_STAMP_DROPPED_STORE)) {
          db.createObjectStore(MODEL_STAMP_DROPPED_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Could not open dropped model store'));
      req.onblocked = () => reject(new Error('Dropped model store upgrade blocked'));
    });
  }

  function modelStampDroppedFileRecord(file) {
    if (!file || typeof file.name !== 'string') return null;
    return {
      name: file.name,
      type: String(file.type || ''),
      size: Number(file.size) || 0,
      lastModified: Number(file.lastModified) || Date.now(),
      file,
    };
  }

  function modelStampFileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Could not read model file'));
      reader.readAsDataURL(file);
    });
  }

  async function modelStampDroppedFileShareRecord(record) {
    if (!record) return null;
    if (typeof record.dataUrl === 'string' && record.dataUrl.startsWith('data:')) {
      return {
        name: String(record.name || 'model.glb'),
        type: String(record.type || ''),
        size: Number(record.size) || 0,
        lastModified: Number(record.lastModified) || Date.now(),
        dataUrl: record.dataUrl,
      };
    }
    const file = record.file || record.blob;
    if (!file) return null;
    const dataUrl = await modelStampFileToDataUrl(file);
    return {
      name: String(record.name || file.name || 'model.glb'),
      type: String(record.type || file.type || ''),
      size: Number(record.size || file.size) || 0,
      lastModified: Number(record.lastModified || file.lastModified) || Date.now(),
      dataUrl,
    };
  }

  function modelStampDroppedFileFromRecord(record) {
    if (record && typeof record.dataUrl === 'string' && record.dataUrl.startsWith('data:')) return null;
    const src = record && (record.file || record.blob);
    if (!src || typeof src !== 'object') return null;
    const name = String(record.name || src.name || 'model.glb');
    const lastModified = Number(record.lastModified || src.lastModified) || Date.now();
    if (typeof File === 'function' && !(src instanceof File)) {
      try {
        return new File([src], name, { type: record.type || src.type || '', lastModified });
      } catch (_) {}
    }
    try { if (!src.name) src.name = name; } catch (_) {}
    try { if (!src.lastModified) src.lastModified = lastModified; } catch (_) {}
    return src;
  }

  function modelStampCompactDroppedShareRecord(record) {
    const meta = record && record.asset && typeof record.asset === 'object' ? record.asset : record;
    const id = modelStampIdSafe(meta && (meta.id || record.id));
    if (!id || !Array.isArray(record.files)) return null;
    const files = record.files.map(file => {
      if (!file || typeof file.dataUrl !== 'string' || !file.dataUrl.startsWith('data:')) return null;
      return {
        name: String(file.name || 'model.glb').slice(0, 160),
        type: String(file.type || '').slice(0, 80),
        size: Number(file.size) || 0,
        lastModified: Number(file.lastModified) || Date.now(),
        dataUrl: file.dataUrl,
      };
    }).filter(Boolean);
    if (!files.length) return null;
    return {
      id,
      savedAt: Number(record.savedAt) || Date.now(),
      asset: modelStampSerializableDroppedAsset(meta),
      files,
    };
  }

  function modelStampReviveDroppedDataRecord(record) {
    const meta = record && record.asset && typeof record.asset === 'object' ? record.asset : record;
    const id = modelStampIdSafe(meta && (meta.id || record.id));
    if (!id) return null;
    const fileRecords = Array.isArray(record.files) ? record.files : [];
    const localFiles = {};
    const sidecars = { textures: [], mtl: [] };
    const mains = [];
    fileRecords.forEach(file => {
      if (!file || typeof file.dataUrl !== 'string' || !file.dataUrl.startsWith('data:')) return;
      const name = String(file.name || 'model.glb');
      const format = modelStampFileExtension(name);
      if (!format) return;
      const item = {
        name,
        path: name,
        url: file.dataUrl,
        format,
        exists: true,
        size: Number(file.size) || 0,
      };
      localFiles[modelStampFileBaseName(name)] = file.dataUrl;
      if (MODEL_STAMP_DETECTED_FORMATS.has(format)) mains.push(item);
      else if (format === 'mtl') sidecars.mtl.push(item);
      else if (MODEL_STAMP_TEXTURE_FORMATS.has(format)) sidecars.textures.push(item);
    });
    const mainRef = modelStampFileBaseName(meta.path || meta.name || meta.label);
    const main = mains.find(item => modelStampFileBaseName(item.path) === mainRef) || mains[0];
    if (!main) return null;
    const label = String(meta.label || meta.name || main.path || id).replace(/\.[^.]+$/, '').slice(0, 64) || id;
    return {
      id,
      label,
      name: label,
      path: main.path,
      url: main.url,
      format: main.format,
      supported: meta.supported !== false && MODEL_STAMP_SUPPORTED_FORMATS.has(main.format),
      size: Number(meta.size) || main.size || 0,
      mtimeMs: Number(meta.mtimeMs) || Date.now(),
      sidecars,
      dropped: true,
      transient: false,
      localFiles,
      warnings: Array.isArray(meta.warnings) ? meta.warnings.map(item => String(item || '').slice(0, 120)).filter(Boolean) : [],
    };
  }

  function modelStampBuildDroppedFileContext(files) {
    const localFiles = {};
    const sidecars = { textures: [], mtl: [] };
    const mains = [];
    files.forEach(file => {
      const format = modelStampFileExtension(file.name);
      const url = modelStampObjectUrlForFile(file);
      if (!format || !url) return;
      const record = {
        name: file.name,
        path: file.name,
        url,
        format,
        exists: true,
        size: file.size || 0,
      };
      localFiles[modelStampFileBaseName(file.name)] = url;
      if (MODEL_STAMP_DETECTED_FORMATS.has(format)) mains.push({ file, format, url });
      else if (format === 'mtl') sidecars.mtl.push(record);
      else if (MODEL_STAMP_TEXTURE_FORMATS.has(format)) sidecars.textures.push(record);
    });
    return { localFiles, sidecars, mains };
  }

  function modelStampSerializableDroppedAsset(asset) {
    if (!asset || !asset.id) return null;
    return {
      id: asset.id,
      label: asset.label,
      name: asset.name || asset.label,
      path: asset.path,
      format: asset.format,
      supported: asset.supported !== false,
      size: Number(asset.size) || 0,
      mtimeMs: Number(asset.mtimeMs) || 0,
      warnings: Array.isArray(asset.warnings) ? asset.warnings.slice(0, 8) : [],
    };
  }

  function persistDroppedModelStampAssets(assets, files) {
    const cleanAssets = (assets || []).map(modelStampSerializableDroppedAsset).filter(Boolean);
    const fileRecords = (files || []).map(modelStampDroppedFileRecord).filter(Boolean);
    if (!cleanAssets.length || !fileRecords.length) return Promise.resolve([]);
    const savedAt = Date.now();
    return Promise.all(fileRecords.map(modelStampDroppedFileShareRecord))
      .then(records => {
        const cloudFiles = records.filter(Boolean);
        const cloudBytes = cloudFiles.reduce((sum, file) => sum + String(file.dataUrl || '').length, 0);
        if (!cloudFiles.length || cloudBytes > MODEL_STAMP_DROPPED_CLOUD_MAX_BYTES) return null;
        return cleanAssets.map(asset => ({ id: asset.id, savedAt, asset, files: cloudFiles }));
      })
      .catch(err => {
        console.warn('[model-stamp] could not prepare portable dropped model records', err);
        return null;
      })
      .then(portableRecords => modelStampOpenDroppedDb()
      .then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(MODEL_STAMP_DROPPED_STORE, 'readwrite');
        const store = tx.objectStore(MODEL_STAMP_DROPPED_STORE);
        cleanAssets.forEach(asset => {
          const portable = portableRecords && portableRecords.find(record => record && record.id === asset.id);
          const record = portable || {
            id: asset.id,
            savedAt,
            asset,
            files: fileRecords,
          };
          store.put(record);
          if (portable) {
            const compact = modelStampCompactDroppedShareRecord(portable);
            if (compact) modelStampDroppedShareRecords.set(asset.id, compact);
          }
        });
        tx.oncomplete = () => {
          try { db.close(); } catch (_) {}
          if (portableRecords && typeof window.__tinyworldSyncAssetsToCloud === 'function') window.__tinyworldSyncAssetsToCloud();
          resolve(cleanAssets);
        };
        tx.onerror = () => {
          try { db.close(); } catch (_) {}
          reject(tx.error || new Error('Could not save dropped model files'));
        };
        tx.onabort = () => {
          try { db.close(); } catch (_) {}
          reject(tx.error || new Error('Dropped model save aborted'));
        };
      }))
      )
      .catch(err => {
        console.warn('[model-stamp] could not persist dropped model files', err);
        return [];
      });
  }

  function modelStampReviveDroppedAssetRecord(record) {
    if (record && Array.isArray(record.files) && record.files.some(file => file && typeof file.dataUrl === 'string')) {
      return modelStampReviveDroppedDataRecord(record);
    }
    const meta = record && record.asset && typeof record.asset === 'object' ? record.asset : record;
    const id = modelStampIdSafe(meta && (meta.id || record.id));
    if (!id) return null;
    const files = Array.isArray(record.files)
      ? record.files.map(modelStampDroppedFileFromRecord).filter(Boolean)
      : [];
    if (!files.length) return null;
    const ctx = modelStampBuildDroppedFileContext(files);
    const mainRef = modelStampFileBaseName(meta.path || meta.name || meta.label);
    const main = ctx.mains.find(item => modelStampFileBaseName(item.file.name) === mainRef) || ctx.mains[0];
    if (!main) return null;
    const label = String(meta.label || meta.name || main.file.name || id).replace(/\.[^.]+$/, '').slice(0, 64) || id;
    return {
      id,
      label,
      name: label,
      path: main.file.name,
      url: main.url,
      format: main.format,
      supported: meta.supported !== false && MODEL_STAMP_SUPPORTED_FORMATS.has(main.format),
      size: Number(meta.size) || main.file.size || 0,
      mtimeMs: Number(meta.mtimeMs) || main.file.lastModified || Date.now(),
      sidecars: ctx.sidecars,
      dropped: true,
      transient: false,
      localFiles: ctx.localFiles,
      warnings: Array.isArray(meta.warnings) ? meta.warnings.map(item => String(item || '').slice(0, 120)).filter(Boolean) : [],
    };
  }

  function restorePersistedDroppedModelStamps() {
    if (modelStampDroppedRestorePromise) return modelStampDroppedRestorePromise;
    modelStampDroppedRestorePromise = modelStampOpenDroppedDb()
      .then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(MODEL_STAMP_DROPPED_STORE, 'readonly');
        const store = tx.objectStore(MODEL_STAMP_DROPPED_STORE);
        const req = store.getAll();
        req.onsuccess = () => {
          try { db.close(); } catch (_) {}
          resolve(Array.isArray(req.result) ? req.result : []);
        };
        req.onerror = () => {
          try { db.close(); } catch (_) {}
          reject(req.error || new Error('Could not restore dropped model files'));
        };
      }))
      .then(records => {
        records.forEach(record => {
          const compact = modelStampCompactDroppedShareRecord(record);
          if (compact) modelStampDroppedShareRecords.set(compact.id, compact);
        });
        const assets = records.map(modelStampReviveDroppedAssetRecord).filter(Boolean);
        if (!assets.length) return [];
        mergeModelStampAssets(assets);
        modelStampScanMessage = 'Restored ' + assets.length + ' dropped model stamp' + (assets.length === 1 ? '' : 's');
        updateStampBuilderSummary();
        refreshOpenStampBuilderCards();
        assets.forEach(asset => scheduleModelStampRefresh(asset.id));
        if (typeof ensureCrowdModelCharacterAssetsLoading === 'function') ensureCrowdModelCharacterAssetsLoading();
        return assets;
      })
      .catch(err => {
        console.warn('[model-stamp] could not restore dropped model files', err);
        return [];
      });
    return modelStampDroppedRestorePromise;
  }

  // Strip a trailing frame number ("Frame_0", "smoke_012", "puff3") so VDB files
  // dropped together as a sequence collapse into one animated asset.
  function vdbSequenceKey(name) {
    const base = String(name || '').replace(/\.[^.]+$/, '');
    const m = base.match(/^(.*?)(\d+)\s*$/);
    return m ? { base: m[1].toLowerCase(), num: parseInt(m[2], 10) || 0 } : { base: base.toLowerCase(), num: 0 };
  }

  function registerDroppedModelStampFiles(fileList) {
    const files = Array.from(fileList || []).filter(file => file && typeof file.name === 'string');
    if (!files.length) return [];
    const ctx = modelStampBuildDroppedFileContext(files);
    const localFiles = ctx.localFiles;
    const sidecars = ctx.sidecars;
    const mains = ctx.mains;
    const batchId = Date.now().toString(36);
    let assetIndex = 0;
    function buildAssetSpec(main, frames) {
      const slug = modelStampSlug(main.file.name);
      const index = assetIndex++;
      let id = modelStampIdSafe('drop-' + batchId + '-' + index + '-' + slug);
      if (!id) id = 'drop-' + batchId + '-' + index;
      let suffix = 1;
      while (MODEL_STAMP_ASSETS.some(asset => asset.id === id)) {
        id = modelStampIdSafe('drop-' + batchId + '-' + index + '-' + suffix + '-' + slug) || ('drop-' + batchId + '-' + index + '-' + suffix);
        suffix++;
      }
      let label = String(main.file.name || id).replace(/\.[^.]+$/, '').slice(0, 64) || id;
      if (frames && frames.length > 1) {
        label = (label.replace(/[\s._-]*\d+$/, '') || label).slice(0, 56) + ' (' + frames.length + 'f)';
      }
      return {
        id,
        label,
        name: label,
        path: main.file.name,
        url: main.url,
        format: main.format,
        supported: MODEL_STAMP_SUPPORTED_FORMATS.has(main.format),
        size: main.file.size || 0,
        mtimeMs: main.file.lastModified || Date.now(),
        sidecars,
        frames: frames && frames.length > 1 ? frames : null,
        dropped: true,
        transient: true,
        localFiles,
        warnings: MODEL_STAMP_SUPPORTED_FORMATS.has(main.format) ? [] : [main.format.toUpperCase() + ' detected but not placeable in this build'],
      };
    }
    // Group dropped VDB frames by sequence; every other format is one asset each.
    const vdbGroups = new Map();
    const specs = [];
    mains.forEach(main => {
      if (main.format === 'vdb') {
        const key = vdbSequenceKey(main.file.name).base;
        if (!vdbGroups.has(key)) vdbGroups.set(key, []);
        vdbGroups.get(key).push(main);
      } else {
        specs.push(buildAssetSpec(main, null));
      }
    });
    vdbGroups.forEach(groupMains => {
      groupMains.sort((a, b) => vdbSequenceKey(a.file.name).num - vdbSequenceKey(b.file.name).num);
      const frames = groupMains.map(m => ({ url: m.url, name: m.file.name }));
      specs.push(buildAssetSpec(groupMains[0], frames));
    });
    const assets = specs.filter(Boolean);
    if (!assets.length) return [];
    mergeModelStampAssets(assets);
    persistDroppedModelStampAssets(assets, files);
    modelStampScanMessage = 'Imported ' + assets.length + ' dropped model' + (assets.length === 1 ? '' : 's');
    updateStampBuilderSummary();
    refreshOpenStampBuilderCards();
    return assets.map(asset => getModelStamp(asset.id)).filter(Boolean);
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

  function bootFetchTimeoutSignal() {
    // Bound boot-path fetches so a cold function start or stalled CDN edge
    // can't hang the stamp library indefinitely.
    try { return AbortSignal.timeout(5000); } catch (_) { return undefined; }
  }

  async function fetchModelStampList(url, opts) {
    const res = await fetch(url, Object.assign({ signal: bootFetchTimeoutSignal() }, opts || {}));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.models || data.stamps || []);
  }

  async function refreshModelStampManifest() {
    const endpoints = [];
    if (modelStampScanApiEnabled()) {
      // The scan API is a live filesystem scan — keep it deliberately fresh.
      endpoints.push('/api/model-stamps?ts=' + Date.now());
    }
    // Static manifest: rely on HTTP caching (etag revalidation via
    // netlify.toml) instead of a ?ts= cache-buster that forced a full
    // download on every boot.
    endpoints.push(MODEL_STAMP_MANIFEST_URL);
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
    if (typeof ensureCrowdModelCharacterAssetsLoading === 'function') ensureCrowdModelCharacterAssetsLoading();
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
    const localUrl = modelStampLocalUrlForRef(asset, clean);
    if (localUrl) return localUrl;
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
        if (typeof opts.onError === 'function') { try { opts.onError(err); } catch (_) {} }
      });
      tex.flipY = opts.flipY !== false;
      twSetTextureSRGB(tex);
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter || THREE.LinearFilter;
      tex.anisotropy = Math.min(8, renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
      modelStampTextureCache.set(key, tex);
    }
    return modelStampTextureCache.get(key);
  }

  function createModelStampLoadingManager(asset) {
    const manager = new THREE.LoadingManager();
    if (asset && asset.localFiles) {
      manager.setURLModifier(url => modelStampLocalUrlForRef(asset, url) || url);
    }
    return manager;
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
      ['map', 'emissiveMap'].forEach(key => {
        if (mat[key]) twSetTextureSRGB(mat[key]);
      });
      ['aoMap', 'lightMap', 'normalMap', 'metalnessMap', 'roughnessMap'].forEach(key => {
        if (mat[key]) twSetTextureLinear(mat[key]);
      });
      mat.needsUpdate = true;
    });
  }

  function modelStampTextureStats(texture) {
    if (!texture || !texture.image) return null;
    texture.userData = texture.userData || {};
    if (texture.userData.modelStampTextureStats) return texture.userData.modelStampTextureStats;
    const image = texture.image;
    const rawW = image.width || image.videoWidth || image.naturalWidth || 0;
    const rawH = image.height || image.videoHeight || image.naturalHeight || 0;
    if (!rawW || !rawH) return null;
    let data = null;
    let w = rawW;
    let h = rawH;
    let stride = 4;
    try {
      if (image.data && image.data.length) {
        data = image.data;
        stride = data.length >= rawW * rawH * 4 ? 4 : 3;
      } else {
        const sampleW = Math.max(1, Math.min(16, rawW));
        const sampleH = Math.max(1, Math.min(16, rawH));
        if (!modelStampTextureStats.canvas) modelStampTextureStats.canvas = document.createElement('canvas');
        const canvas = modelStampTextureStats.canvas;
        canvas.width = sampleW;
        canvas.height = sampleH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.clearRect(0, 0, sampleW, sampleH);
        ctx.drawImage(image, 0, 0, sampleW, sampleH);
        data = ctx.getImageData(0, 0, sampleW, sampleH).data;
        w = sampleW;
        h = sampleH;
        stride = 4;
      }
    } catch (_) {
      return null;
    }
    if (!data || !data.length) return null;
    const sampleW = Math.max(1, Math.min(16, w));
    const sampleH = Math.max(1, Math.min(16, h));
    let count = 0;
    let sumR = 0, sumG = 0, sumB = 0;
    let sumR2 = 0, sumG2 = 0, sumB2 = 0;
    let maxR = 0;
    let darkR = 0;
    const norm = value => {
      const n = Number(value) || 0;
      return n > 1 ? n / 255 : Math.max(0, Math.min(1, n));
    };
    for (let sy = 0; sy < sampleH; sy++) {
      const y = Math.floor(sy * (h - 1) / Math.max(1, sampleH - 1));
      for (let sx = 0; sx < sampleW; sx++) {
        const x = Math.floor(sx * (w - 1) / Math.max(1, sampleW - 1));
        const i = (y * w + x) * stride;
        const r = norm(data[i]);
        const g = norm(data[i + 1] !== undefined ? data[i + 1] : data[i]);
        const b = norm(data[i + 2] !== undefined ? data[i + 2] : data[i]);
        sumR += r; sumG += g; sumB += b;
        sumR2 += r * r; sumG2 += g * g; sumB2 += b * b;
        maxR = Math.max(maxR, r);
        if (r < 0.12) darkR++;
        count++;
      }
    }
    if (!count) return null;
    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;
    const stats = {
      avgR,
      avgG,
      avgB,
      maxR,
      darkR: darkR / count,
      varR: Math.max(0, sumR2 / count - avgR * avgR),
      varG: Math.max(0, sumG2 / count - avgG * avgG),
      varB: Math.max(0, sumB2 / count - avgB * avgB),
    };
    texture.userData.modelStampTextureStats = stats;
    return stats;
  }

  function modelStampTextureReference(texture, material) {
    const image = texture && texture.image;
    const source = texture && texture.source && texture.source.data;
    return [
      texture && texture.name,
      texture && texture.uuid,
      image && (image.currentSrc || image.src || image.name),
      source && (source.currentSrc || source.src || source.name),
      material && material.name,
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function modelStampShouldDropAoMap(texture, material) {
    const stats = modelStampTextureStats(texture);
    if (!stats) return false;
    const ref = modelStampTextureReference(texture, material);
    const taggedAo = /(^|[^a-z])(ao|occlusion|orm|occlusionroughnessmetallic|roughnessmetallic)([^a-z]|$)/i.test(ref);
    return stats.maxR < 0.08 || (stats.avgR < (taggedAo ? 0.18 : 0.12) && stats.darkR > 0.78);
  }

  function modelStampShouldDropNormalMap(texture, material) {
    const stats = modelStampTextureStats(texture);
    if (!stats) return false;
    const ref = modelStampTextureReference(texture, material);
    const uniform = stats.varR < 0.00035 && stats.varG < 0.00035 && stats.varB < 0.00035;
    const biased = Math.abs(stats.avgR - 0.5) > 0.12 || Math.abs(stats.avgG - 0.5) > 0.12 || stats.avgB < 0.62;
    return uniform && (biased || /normal|phong/i.test(ref));
  }

  function sanitizeModelStampMaterialLightingMaps(material, opts = {}) {
    let changed = 0;
    const mats = modelStampMaterialList(material);
    mats.forEach(mat => {
      if (!mat) return;
      mat.userData = mat.userData || {};
      if (mat.aoMap && (opts.dropAoMap === true || modelStampShouldDropAoMap(mat.aoMap, mat))) {
        mat.aoMap = null;
        mat.aoMapIntensity = 0;
        mat.userData.modelStampDroppedAOMap = true;
        changed++;
      }
      if (mat.normalMap && (opts.dropNormalMap === true || modelStampShouldDropNormalMap(mat.normalMap, mat))) {
        mat.normalMap = null;
        mat.normalScale = null;
        mat.userData.modelStampDroppedNormalMap = true;
        changed++;
      }
      if (changed) mat.needsUpdate = true;
    });
    return changed;
  }

  function modelStampMaterialNeedsTinyWorldLighting(material) {
    if (!material || !material.isMaterial) return false;
    if (material.userData && material.userData.modelStampTinyWorldLit) return false;
    // FBX defaults to MeshPhongMaterial, which washes out (often to white) under
    // TinyWorld's tuned exposure — the same reason GLB's PBR materials are
    // re-lit. Convert Phong to the TinyWorld Lambert material too, preserving
    // its diffuse colour and texture map.
    if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial || material.isMeshPhongMaterial) return true;
    const type = String(material.type || '');
    return /Mesh(Standard|Physical|Phong)Material/.test(type) || material.metalness !== undefined || material.roughness !== undefined || material.shininess !== undefined;
  }

  function createTinyWorldLitModelStampMaterial(source) {
    const sourceAoMap = source && source.aoMap && !modelStampShouldDropAoMap(source.aoMap, source) ? source.aoMap : null;
    const params = {
      color: source && source.color ? source.color.clone() : new THREE.Color(0xffffff),
      map: source && source.map ? source.map : null,
      vertexColors: !!(source && source.vertexColors),
      side: source && source.side !== undefined ? source.side : THREE.FrontSide,
      transparent: !!(source && source.transparent),
      opacity: source && source.opacity !== undefined ? source.opacity : 1,
      alphaTest: source && source.alphaTest !== undefined ? source.alphaTest : 0,
      depthTest: source && source.depthTest !== undefined ? source.depthTest : true,
      depthWrite: source && source.depthWrite !== undefined ? source.depthWrite : true,
      blending: source && source.blending !== undefined ? source.blending : THREE.NormalBlending,
      dithering: !!(source && source.dithering),
      fog: source && source.fog !== undefined ? source.fog : true,
    };
    if (source && source.emissive) {
      params.emissive = source.emissive.clone();
      params.emissiveIntensity = Math.max(0, Math.min(2, source.emissiveIntensity || 0));
    }
    const next = new THREE.MeshLambertMaterial(params);
    next.name = source && source.name ? source.name : 'TinyWorld lit GLB material';
    if (source) {
      if (source.alphaMap) next.alphaMap = source.alphaMap;
      if (sourceAoMap) {
        next.aoMap = sourceAoMap;
        next.aoMapIntensity = source.aoMapIntensity !== undefined ? source.aoMapIntensity : 1;
      }
      if (source.lightMap) {
        next.lightMap = source.lightMap;
        next.lightMapIntensity = source.lightMapIntensity !== undefined ? source.lightMapIntensity : 1;
      }
      if (source.emissiveMap) next.emissiveMap = source.emissiveMap;
      if (source.premultipliedAlpha !== undefined) next.premultipliedAlpha = source.premultipliedAlpha;
      if (source.polygonOffset !== undefined) next.polygonOffset = source.polygonOffset;
      if (source.polygonOffsetFactor !== undefined) next.polygonOffsetFactor = source.polygonOffsetFactor;
      if (source.polygonOffsetUnits !== undefined) next.polygonOffsetUnits = source.polygonOffsetUnits;
      if (source.skinning !== undefined) next.skinning = source.skinning;
      if (source.morphTargets !== undefined) next.morphTargets = source.morphTargets;
      if (source.morphNormals !== undefined) next.morphNormals = source.morphNormals;
    }
    next.userData = Object.assign({}, source && source.userData, {
      modelStampTinyWorldLit: true,
      modelStampSourceMaterialType: source && (source.type || source.constructor && source.constructor.name) || 'PBR',
      modelStampDroppedLightingMaps: [
        source && ((source.aoMap && !sourceAoMap) || (source.userData && source.userData.modelStampDroppedAOMap)) ? 'aoMap' : '',
        source && (source.normalMap || (source.userData && source.userData.modelStampDroppedNormalMap)) ? 'normalMap' : '',
      ].filter(Boolean).join(',') || undefined,
    });
    prepareModelStampTextureMaterial(next);
    return next;
  }

  function adaptModelStampMaterialForTinyWorld(material, cache = null) {
    if (Array.isArray(material)) {
      let adapted = 0;
      const next = material.map(mat => {
        const result = adaptModelStampMaterialForTinyWorld(mat, cache);
        adapted += result.adapted;
        return result.material;
      });
      return { material: next, adapted };
    }
    if (!material) return { material, adapted: 0 };
    sanitizeModelStampMaterialLightingMaps(material);
    prepareModelStampTextureMaterial(material);
    if (!modelStampMaterialNeedsTinyWorldLighting(material)) return { material, adapted: 0 };
    if (cache && cache.has(material)) return { material: cache.get(material), adapted: 0 };
    const next = createTinyWorldLitModelStampMaterial(material);
    if (cache) cache.set(material, next);
    return { material: next, adapted: 1 };
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
    // For unnamed/generic models, commit to a single body colour for the whole
    // mesh. Shading still comes from surface normals + a gentle vertical
    // gradient, so the model reads as solid-coloured rather than rainbow.
    const genericHex = MODEL_STAMP_GENERIC_SOLID[hash % MODEL_STAMP_GENERIC_SOLID.length];
    const shade = new THREE.Color(0x252a30);
    const color = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const yNorm = (y - minY) / spanY;
      const ny = normal ? normal.getY(i) : 0;
      const band = Math.floor((Math.atan2(z, x) + Math.PI) * 2.5) + Math.floor(yNorm * 9) + hash;
      let hex = genericHex;
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
      if (kind === 'generic') color.offsetHSL(0, 0, (yNorm - 0.5) * 0.08);
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
    let litMaterials = 0;
    const materialAdaptCache = new WeakMap();
    root.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      const adapted = adaptModelStampMaterialForTinyWorld(node.material, materialAdaptCache);
      node.material = adapted.material;
      litMaterials += adapted.adapted;
    });
    const textureRecord = pickModelStampSidecarTexture(asset);
    if (textureRecord) textured = applyModelStampSidecarTexture(root, asset, textureRecord, { flipY: opts.flipY });
    root.traverse(node => {
      if (node.isMesh) {
        const adapted = adaptModelStampMaterialForTinyWorld(node.material, materialAdaptCache);
        node.material = adapted.material;
        litMaterials += adapted.adapted;
      }
      if (modelStampMeshNeedsPalette(node) && applyModelStampVertexPalette(node, asset, palette)) palette++;
    });
    if (asset) {
      if (textured) asset.materialStatus = 'sidecar texture';
      else if (palette) asset.materialStatus = 'TinyWorld palette fallback';
      else if (litMaterials) asset.materialStatus = 'TinyWorld lit materials';
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
      const mat = new THREE.MeshLambertMaterial(params);
      mat.name = def.name;
      mat.userData.modelStampHydrated = def.map ? 'mtl texture' : 'mtl color';
      if (def.map) {
        const tex = loadModelStampTexture(asset, def.map, {
          baseUrl,
          flipY: true,
          modelStampId: asset && asset.id,
          // OBJ files are frequently shared without their referenced images. When
          // the map_Kd texture can't be loaded, drop back to the material's Kd
          // diffuse colour instead of leaving it forced to solid white.
          onError() {
            mat.map = null;
            mat.color.setHex(def.color);
            mat.userData.modelStampHydrated = 'mtl color (texture missing)';
            mat.needsUpdate = true;
            if (asset && asset.id) scheduleModelStampRefresh(asset.id);
          },
        });
        if (tex) mat.map = tex;
      }
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

  function configureModelStampGltfLoader(loader) {
    if (!loader) return loader;
    if (THREE.DRACOLoader && typeof loader.setDRACOLoader === 'function') {
      if (!modelStampDracoLoader) {
        modelStampDracoLoader = new THREE.DRACOLoader();
        modelStampDracoLoader.setDecoderPath('vendor/three/draco/');
        if (typeof modelStampDracoLoader.setWorkerLimit === 'function') modelStampDracoLoader.setWorkerLimit(2);
      }
      loader.setDRACOLoader(modelStampDracoLoader);
    }
    if (typeof MeshoptDecoder !== 'undefined' && MeshoptDecoder && typeof loader.setMeshoptDecoder === 'function') {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }
    if (window.__tinyworldKTX2LoaderClass && typeof loader.setKTX2Loader === 'function' && renderer) {
      if (!modelStampKtx2Loader) {
        modelStampKtx2Loader = new window.__tinyworldKTX2LoaderClass();
        modelStampKtx2Loader.setTranscoderPath('vendor/three/basis/');
        if (typeof modelStampKtx2Loader.setWorkerLimit === 'function') modelStampKtx2Loader.setWorkerLimit(2);
        if (typeof modelStampKtx2Loader.detectSupport === 'function') modelStampKtx2Loader.detectSupport(renderer);
      }
      loader.setKTX2Loader(modelStampKtx2Loader);
    }
    return loader;
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

  // Turn a parsed OpenVDB density field (active voxel coords) into a chunky,
  // stylised "voxel cloud" mesh: downsample to a coarse grid, emit culled cube
  // faces, and colour by height (warm fire at the base → cool smoke up top).
  // Returns a clone-safe plain Mesh wrapped in a Group, or null for empty grids.
  // Shared coarse-grid spec for one volume (or a whole frame sequence, when a
  // union bbox is passed so every frame downsamples into the same grid and the
  // plume grows in place instead of jumping around).
  function vdbGridSpec(min, max, targetRes) {
    const spanX = max[0] - min[0] + 1;
    const spanY = max[1] - min[1] + 1;
    const spanZ = max[2] - min[2] + 1;
    const target = Math.max(8, Math.min(48, targetRes || 30));
    const factor = Math.max(1, Math.ceil(Math.max(spanX, spanY, spanZ, 1) / target));
    return {
      origin: [min[0], min[1], min[2]],
      factor,
      dims: [Math.max(1, Math.ceil(spanX / factor)), Math.max(1, Math.ceil(spanY / factor)), Math.max(1, Math.ceil(spanZ / factor))],
    };
  }

  function buildVdbVoxelMesh(parsed, spec) {
    if (!parsed || !parsed.count || !parsed.coords || !parsed.coords.length) return null;
    spec = spec || vdbGridSpec(parsed.bbox.min, parsed.bbox.max);
    const coords = parsed.coords;
    const min = spec.origin;
    const factor = spec.factor;
    const gx = spec.dims[0];
    const gy = spec.dims[1];
    const gz = spec.dims[2];
    const occ = new Uint8Array(gx * gy * gz);
    const at = (x, y, z) => x + y * gx + z * gx * gy;
    for (let i = 0; i < coords.length; i += 3) {
      const cx = Math.min(gx - 1, (coords[i] - min[0]) / factor | 0);
      const cy = Math.min(gy - 1, (coords[i + 1] - min[1]) / factor | 0);
      const cz = Math.min(gz - 1, (coords[i + 2] - min[2]) / factor | 0);
      occ[at(cx, cy, cz)] = 1;
    }
    // VDB grid: x/y are horizontal, z is vertical (smoke rises in z), so colour
    // by the z layer and rotate the finished group so z maps to world-up.
    const FACES = [
      { n: [1, 0, 0], d: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
      { n: [-1, 0, 0], d: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
      { n: [0, 1, 0], d: [0, 1, 0], c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
      { n: [0, -1, 0], d: [0, -1, 0], c: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]] },
      { n: [0, 0, 1], d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
      { n: [0, 0, -1], d: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
    ];
    const positions = [];
    const colors = [];
    const normals = [];
    const cx0 = gx / 2, cy0 = gy / 2, cz0 = gz / 2;
    const base = new THREE.Color();
    const fire = new THREE.Color(0xff7a2e);
    const ember = new THREE.Color(0xffd166);
    const smoke = new THREE.Color(0xdfe3e8);
    const haze = new THREE.Color(0xa9b6c6);
    const tmp = new THREE.Color();
    for (let z = 0; z < gz; z++) {
      const t = gz > 1 ? z / (gz - 1) : 0;
      if (t < 0.28) base.copy(fire).lerp(ember, t / 0.28);
      else if (t < 0.55) base.copy(ember).lerp(smoke, (t - 0.28) / 0.27);
      else base.copy(smoke).lerp(haze, (t - 0.55) / 0.45);
      for (let y = 0; y < gy; y++) {
        for (let x = 0; x < gx; x++) {
          if (!occ[at(x, y, z)]) continue;
          for (const f of FACES) {
            const nx = x + f.d[0], ny = y + f.d[1], nz = z + f.d[2];
            const inside = nx >= 0 && ny >= 0 && nz >= 0 && nx < gx && ny < gy && nz < gz;
            if (inside && occ[at(nx, ny, nz)]) continue; // hidden interior face
            tmp.copy(base);
            const jitter = (((x * 73 + y * 19 + z * 37) % 7) - 3) * 0.012;
            tmp.offsetHSL(0, 0, jitter);
            const quad = f.c.map(o => [x - cx0 + o[0], y - cy0 + o[1], z - cz0 + o[2]]);
            const tri = [quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]];
            for (const v of tri) {
              positions.push(v[0], v[1], v[2]);
              normals.push(f.n[0], f.n[1], f.n[2]);
              colors.push(tmp.r, tmp.g, tmp.b);
            }
          }
        }
      }
    }
    if (!positions.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    mat.name = 'TinyWorld VDB cloud';
    mat.userData.modelStampHydrated = 'vdb';
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.add(mesh);
    group.rotation.x = -Math.PI / 2; // VDB z-up → world y-up
    return group;
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
    asset.loadState = 'loading';
    asset.loadError = '';
    function finish(scene, animations = []) {
      cache.state = 'ready';
      cache.scene = scene;
      cache.animations = Array.isArray(animations) ? animations : [];
      asset.loadState = 'ready';
      asset.loadError = '';
      cache.ready.splice(0).forEach(fn => { try { fn(scene); } catch (_) {} });
      scheduleModelStampRefresh(asset.id);
    }
    function fail(err) {
      cache.state = 'error';
      cache.errorMessage = String(err && err.message || err || 'load failed');
      asset.loadState = 'error';
      asset.loadError = cache.errorMessage;
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
      const loader = configureModelStampGltfLoader(new THREE.GLTFLoader(createModelStampLoadingManager(asset)));
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
    } else if (asset.format === 'fbx') {
      if (!THREE.FBXLoader) {
        fail(new Error('FBXLoader missing'));
        return cache;
      }
      const loader = new THREE.FBXLoader(createModelStampLoadingManager(asset));
      loader.load(asset.url, obj => {
        try {
          hydrateModelStampScene(obj, asset, { flipY: false });
          finish(obj, (obj && obj.animations) || []);
        } catch (err) { fail(err); }
      }, undefined, fail);
    } else if (asset.format === 'vox') {
      if (!THREE.VOXLoader || !THREE.VOXMesh) {
        fail(new Error('VOXLoader missing'));
        return cache;
      }
      const loader = new THREE.VOXLoader(createModelStampLoadingManager(asset));
      loader.load(asset.url, result => {
        try {
          const group = new THREE.Group();
          const chunks = Array.isArray(result) ? result : ((result && result.chunks) || []);
          chunks.forEach(chunk => {
            try {
              const voxMesh = typeof THREE.buildVOXMesh === 'function'
                ? THREE.buildVOXMesh(chunk)
                : new THREE.VOXMesh(chunk);
              // VOXMesh's constructor requires a chunk, so it is NOT clone-safe:
              // THREE's clone() calls `new VOXMesh()` with no args, which throws.
              // Placing a stamp clones the cached scene, so re-wrap the generated
              // geometry + material in a plain Mesh that clones cleanly.
              group.add(new THREE.Mesh(voxMesh.geometry, voxMesh.material));
            } catch (_) {}
          });
          if (!group.children.length) throw new Error('VOX file has no voxels');
          // VOX meshes already carry per-voxel vertex colours from the file's
          // own palette, so hydrate leaves them alone (no fallback palette).
          hydrateModelStampScene(group, asset, { flipY: false });
          finish(group);
        } catch (err) { fail(err); }
      }, undefined, fail);
    } else if (asset.format === 'vdb') {
      if (!THREE.VDBLoader) {
        fail(new Error('VDBLoader missing'));
        return cache;
      }
      const loader = new THREE.VDBLoader(createModelStampLoadingManager(asset));
      // A VDB stamp may be a single file or a dropped frame sequence (asset.frames).
      const frameUrls = (asset.frames && asset.frames.length) ? asset.frames.map(f => f.url) : [asset.url];
      Promise.all(frameUrls.map(url => new Promise((res, rej) => loader.load(url, res, undefined, rej))))
        .then(frames => {
          try {
            // Union bbox across all frames so every frame shares one coarse grid
            // (the plume then grows in place rather than re-centring each frame).
            const mn = [Infinity, Infinity, Infinity];
            const mx = [-Infinity, -Infinity, -Infinity];
            let any = false;
            frames.forEach(f => {
              if (!f || !f.count) return;
              any = true;
              for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], f.bbox.min[i]); mx[i] = Math.max(mx[i], f.bbox.max[i]); }
            });
            if (!any) throw new Error('VDB volume is empty (no active voxels in any frame)');
            const spec = vdbGridSpec(mn, mx);
            const group = new THREE.Group();
            frames.forEach((f, i) => {
              // Empty frames (e.g. the simulation start) become an empty placeholder
              // so the frame index stays aligned and the puff grows from nothing.
              const child = buildVdbVoxelMesh(f, spec) || new THREE.Group();
              child.visible = (i === 0);
              group.add(child);
            });
            if (frames.length > 1) {
              group.userData.vdbAnimation = {
                frameCount: frames.length,
                loopSeconds: Math.max(0.8, Math.min(4, frames.length / 12)),
                current: 0,
              };
            }
            // The cloud meshes already carry per-voxel vertex colours, so skip the
            // palette fallback; castReceive sets up shadows.
            castReceive(group);
            finish(group);
          } catch (err) { fail(err); }
        })
        .catch(fail);
    } else {
      fail(new Error(asset.format.toUpperCase() + ' is detected but not placeable in this build'));
    }
    return cache;
  }

  // Animated VDB clouds: every placed/ghost clone of a frame-sequence stamp keeps
  // its own copy of the userData.vdbAnimation block. A single ticker (driven from
  // the render loop) cycles each live clone's frame-mesh visibility by wall time.
  const vdbAnimatedNodes = new Set();
  function registerVdbAnimation(root) {
    if (!root || typeof root.traverse !== 'function') return;
    root.traverse(node => { if (node.userData && node.userData.vdbAnimation) vdbAnimatedNodes.add(node); });
  }
  function vdbNodeLive(node) {
    let top = node;
    while (top.parent) top = top.parent;
    if (typeof scene !== 'undefined' && scene) return top === scene;
    return !!node.parent;
  }
  window.__tinyworldVdbTick = function vdbTick(t) {
    if (!vdbAnimatedNodes.size) return;
    for (const node of vdbAnimatedNodes) {
      try {
        if (!vdbNodeLive(node)) { vdbAnimatedNodes.delete(node); continue; }
        const info = node.userData.vdbAnimation;
        const loop = info.loopSeconds || 1.5;
        const idx = Math.floor(((t % loop) / loop) * info.frameCount) % info.frameCount;
        if (idx !== info.current) {
          const kids = node.children;
          for (let i = 0; i < kids.length; i++) kids[i].visible = (i === idx);
          info.current = idx;
        }
      } catch (_) { vdbAnimatedNodes.delete(node); }
    }
  };

  function makeModelStamp(idOrAsset, opts = {}) {
    const asset = typeof idOrAsset === 'string' ? getModelStamp(idOrAsset) : idOrAsset;
    if (!asset) return makeModelStampPlaceholder(null, 'Model missing');
    const cache = loadModelStampAsset(asset);
    if (cache && cache.state === 'ready' && cache.scene) {
      const stamp = normalizeModelStampObject(cloneModelStampScene(cache.scene), asset);
      if (asset.format === 'vdb') registerVdbAnimation(stamp);
      return applyAppearanceToObject(stamp, 'model-stamp', opts.appearance);
    }
    const placeholder = makeModelStampPlaceholder(asset, cache && cache.errorMessage ? cache.errorMessage : 'Loading model');
    return applyAppearanceToObject(placeholder, 'model-stamp', opts.appearance);
  }

  window.__tinyworldRegisterDroppedModelStamps = registerDroppedModelStampFiles;
  window.__tinyworldRestoreDroppedModelStamps = restorePersistedDroppedModelStamps;
  window.__tinyworldDeleteDroppedModelStamp = deleteDroppedModelStamp;
  window.__tinyworldDroppedModelStamps = {
    collect() {
      return Array.from(modelStampDroppedShareRecords.values())
        .filter(Boolean)
        .map(record => JSON.parse(JSON.stringify(record)));
    },
    referenced(cells) {
      if (!Array.isArray(cells)) return undefined;
      const ids = new Set();
      for (const entry of cells) {
        let kind = null;
        let appearance = null;
        if (Array.isArray(entry)) {
          kind = entry[3];
          appearance = entry.find(item => item && typeof item === 'object' && !Array.isArray(item) && item.modelStampId);
        } else if (entry && typeof entry === 'object') {
          kind = entry.kind;
          appearance = entry.appearance;
        }
        if (kind !== 'model-stamp') continue;
        const id = modelStampIdSafe(appearance && appearance.modelStampId);
        if (id) ids.add(id);
      }
      const out = [];
      ids.forEach(id => {
        const record = modelStampDroppedShareRecords.get(id);
        if (record) out.push(JSON.parse(JSON.stringify(record)));
      });
      return out.length ? out : undefined;
    },
    apply(records) {
      const list = Array.isArray(records) ? records : [];
      if (!list.length) return false;
      const portable = [];
      const assets = [];
      for (const record of list) {
        const compact = modelStampCompactDroppedShareRecord(record);
        if (!compact) continue;
        portable.push(compact);
        modelStampDroppedShareRecords.set(compact.id, compact);
        const asset = modelStampReviveDroppedDataRecord(compact);
        if (asset) assets.push(asset);
      }
      if (!assets.length) return false;
      mergeModelStampAssets(assets);
      modelStampOpenDroppedDb()
        .then(db => new Promise(resolve => {
          const tx = db.transaction(MODEL_STAMP_DROPPED_STORE, 'readwrite');
          const store = tx.objectStore(MODEL_STAMP_DROPPED_STORE);
          portable.forEach(record => store.put(record));
          tx.oncomplete = tx.onerror = tx.onabort = () => {
            try { db.close(); } catch (_) {}
            resolve();
          };
        }))
        .catch(() => {});
      updateStampBuilderSummary();
      refreshOpenStampBuilderCards();
      assets.forEach(asset => scheduleModelStampRefresh(asset.id));
      if (typeof ensureCrowdModelCharacterAssetsLoading === 'function') ensureCrowdModelCharacterAssetsLoading();
      return true;
    },
  };
  window.__tinyworldPreloadModelStamp = function preloadModelStamp(id, callbacks = {}) {
    const asset = getModelStamp(id);
    if (!asset) return null;
    return loadModelStampAsset(asset, callbacks.ready, callbacks.error);
  };
  window.__tinyworldModelStampLoadState = function modelStampLoadState(id) {
    const asset = getModelStamp(id);
    if (!asset) return null;
    const cache = modelStampAssetCache.get(asset.id);
    return {
      id: asset.id,
      label: asset.label,
      format: asset.format,
      supported: asset.supported !== false,
      state: cache ? cache.state : (asset.loadState || 'idle'),
      errorMessage: cache ? cache.errorMessage : (asset.loadError || ''),
    };
  };

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

  restorePersistedDroppedModelStamps();

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
