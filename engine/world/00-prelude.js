  // -------- prelude (hoisted pure utils) --------
  // Inspector v2 (extended object inspector) — ON by default. The extended
  // material/colour/lighting/precise-transform rows + sub-object (parts/sculpt/
  // explode) editing are the editor; opt OUT with ?inspectorV2=0 or the stored
  // flag set to '0'.
  try {
    const qs = new URLSearchParams(location.search);
    const stored = localStorage.getItem('tinyworld:flags.inspectorV2');
    const optedOut = qs.get('inspectorV2') === '0' || stored === '0';
    window.__tinyworldFlags = window.__tinyworldFlags || {};
    window.__tinyworldFlags.inspectorV2 = !optedOut;
  } catch (_) {
    window.__tinyworldFlags = window.__tinyworldFlags || { inspectorV2: true };
  }

  // Relocated here from module 28 so they are defined before any later
  // module's top-level code runs. The god-file split turned one shared
  // <script> (where function declarations hoisted across the whole block)
  // into ordered <script src> units; these pure PRNG helpers are used by
  // module 04's load-time texture generation, so they must load first.
  // Mulberry32 — deterministic PRNG seeded from a string.
  function seedHash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function makeMulberry32(seedStr) {
    let a = seedHash(String(seedStr || ''));
    return function() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Three.js r152+ replaced Texture.encoding / renderer.outputEncoding with
  // explicit colorSpace properties. Keep these helpers centralized so generated
  // canvas/video/model textures stay correct on r185 while old proof pages still
  // work through the vendor compatibility aliases.
  function twTextureImageHasData(image) {
    if (!image) return false;
    if (Array.isArray(image)) return image.length > 0 && image.every(twTextureImageHasData);
    if (image.data && image.width && image.height) return true;
    if (image.videoWidth || image.videoHeight) return true;
    if (image.width || image.height || image.naturalWidth || image.naturalHeight) return true;
    return false;
  }
  function twTextureHasImageData(texture) {
    return twTextureImageHasData(texture && texture.image);
  }
  function twMarkTextureNeedsUpdateIfReady(texture) {
    if (twTextureHasImageData(texture)) texture.needsUpdate = true;
    return texture;
  }
  function twSetTextureColorSpace(texture, colorSpace) {
    if (!texture || !colorSpace) return texture;
    if ('colorSpace' in texture) texture.colorSpace = colorSpace;
    else texture.encoding = colorSpace;
    return twMarkTextureNeedsUpdateIfReady(texture);
  }
  function twSetTextureSRGB(texture) {
    return twSetTextureColorSpace(texture, THREE.SRGBColorSpace || THREE.sRGBEncoding);
  }
  function twSetTextureLinear(texture) {
    return twSetTextureColorSpace(texture, THREE.LinearSRGBColorSpace || THREE.LinearEncoding);
  }
  function twSetRendererOutputSRGB(targetRenderer) {
    if (!targetRenderer) return targetRenderer;
    const colorSpace = THREE.SRGBColorSpace || THREE.sRGBEncoding;
    if ('outputColorSpace' in targetRenderer) targetRenderer.outputColorSpace = colorSpace;
    else targetRenderer.outputEncoding = colorSpace;
    return targetRenderer;
  }

  // Lightweight self-contained toast (no CSS/HTML dependency) for surfacing
  // things the user must not miss — chiefly silent localStorage failures.
  let __twToastHost = null;
  function twToast(message, kind) {
    try {
      if (!__twToastHost) {
        __twToastHost = document.createElement('div');
        __twToastHost.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
        document.body.appendChild(__twToastHost);
      }
      const el = document.createElement('div');
      const bg = kind === 'err' ? '#c0392b' : (kind === 'ok' ? '#2e7d32' : (kind === 'warn' ? '#7a5b18' : '#333'));
      el.style.cssText = 'pointer-events:auto;max-width:min(92vw,420px);padding:10px 14px;border-radius:8px;color:#fff;font:500 13px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25);background:' + bg + ';opacity:0;transition:opacity .18s ease;';
      el.textContent = String(message);
      __twToastHost.appendChild(el);
      requestAnimationFrame(() => { el.style.opacity = '1'; });
      setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
      }, kind === 'err' ? 6000 : 3000);
    } catch (_) { /* DOM not ready — nothing we can do */ }
  }

  // localStorage.setItem that does NOT swallow quota/serialization failures.
  // Returns true on success, false on failure (and warns the user once-ish).
  // `label` names the thing being saved, for the failure message.
  let __twStorageWarnedAt = 0;
  function twSafeSetItem(key, value, label) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (err) {
      console.error('[tinyworld] localStorage save failed for', key, err);
      // Rate-limit the visible warning so a churning autosave can't spam it.
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (now - __twStorageWarnedAt > 8000) {
        __twStorageWarnedAt = now;
        const quota = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
        twToast(
          (label ? label + ' could not be saved' : 'Save failed') +
          (quota ? ' — browser storage is full. Export your assets/worlds to a file to avoid losing them.' : '.'),
          'err'
        );
      }
      return false;
    }
  }

  // Trigger a client-side download of a JSON object as `filename`.
  function twDownloadJSON(filename, obj) {
    try {
      const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (err) {
      console.error('[tinyworld] download failed', err);
      twToast(window.t ? window.t('toast.downloadFailed') : 'Download failed.', 'err');
      return false;
    }
  }

  // Prompt for a local .json file and resolve its parsed contents.
  function twPickJSONFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      let settled = false;
      const cleanup = () => {
        if (input.parentNode) input.parentNode.removeChild(input);
      };
      const finish = (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.style.display = 'none';
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) { finish(null); return; }
        const reader = new FileReader();
        reader.onload = () => {
          try { finish(JSON.parse(String(reader.result || ''))); }
          catch (_) { twToast(window.t ? window.t('toast.invalidJson') : 'That file is not valid JSON.', 'err'); finish(null); }
        };
        reader.onerror = () => { twToast(window.t ? window.t('toast.readFailed') : 'Could not read that file.', 'err'); finish(null); };
        reader.readAsText(file);
      });
      input.addEventListener('cancel', () => finish(null), { once: true });
      document.body.appendChild(input);
      input.click();
    });
  }

  const TW_RESOURCE_ACTIONS = Object.freeze({ fish: 'fish', meat: 'hunt', plants: 'gather', ore: 'mine' });
  const TW_RESOURCE_DEFAULT_CHARGES = Object.freeze({ fish: 4, meat: 1, plants: 1, ore: 1 });
  function normalizeCellEconomy(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const resource = String(value.resource || value.type || '').trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(TW_RESOURCE_ACTIONS, resource)) return null;
    const rawCharges = value.charges == null ? TW_RESOURCE_DEFAULT_CHARGES[resource] : value.charges;
    let charges = Math.round(Number(rawCharges));
    if (!Number.isFinite(charges)) charges = TW_RESOURCE_DEFAULT_CHARGES[resource] || 1;
    charges = Math.max(1, Math.min(99, charges));
    const out = { resource, action: TW_RESOURCE_ACTIONS[resource], charges };
    const label = String(value.label || '').trim();
    if (label) out.label = label.slice(0, 48);
    return out;
  }
  function sameCellEconomy(a, b) {
    const aa = normalizeCellEconomy(a);
    const bb = normalizeCellEconomy(b);
    return JSON.stringify(aa || null) === JSON.stringify(bb || null);
  }
