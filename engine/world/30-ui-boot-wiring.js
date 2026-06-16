  // -------- welcome dialog --------
  function initWelcomeDialog() {
    const modal = document.getElementById('welcome-modal');
    if (!modal) return;
    const tinyverseBtn = document.getElementById('welcome-tinyverse');
    const battleworldsBtn = document.getElementById('welcome-battleworlds');
    const buildBtn = document.getElementById('welcome-build');
    const playBtn = document.getElementById('welcome-play');
    const closeWelcome = () => {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('welcome-launch-open');
    };
    const setTinyverseLoading = (loading) => {
      if (!tinyverseBtn) return;
      tinyverseBtn.disabled = !!loading;
      tinyverseBtn.setAttribute('aria-busy', loading ? 'true' : 'false');
    };
    const getWorldsFrontend = () => {
      const worlds = window.__tinyworldWorlds;
      return worlds && typeof worlds.open === 'function' ? worlds : null;
    };
    const waitForWorldsFrontend = () => new Promise(resolve => {
      const ready = getWorldsFrontend();
      if (ready) { resolve(ready); return; }
      let done = false;
      let timer = null;
      const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener('tinyworld:worlds-ready', finish);
        if (timer) clearTimeout(timer);
        resolve(getWorldsFrontend());
      };
      window.addEventListener('tinyworld:worlds-ready', finish, { once: true });
      const readyPromise = window.__tinyworldWorldsReady;
      if (readyPromise && typeof readyPromise.then === 'function') readyPromise.then(finish, finish);
      const startedAt = Date.now();
      const poll = () => {
        if (getWorldsFrontend() || Date.now() - startedAt >= 2000) {
          finish();
          return;
        }
        timer = setTimeout(poll, 50);
      };
      timer = setTimeout(poll, 50);
    });
    const showTinyverseUnavailable = () => {
      const msg = typeof t === 'function'
        ? t('worlds.unavailable')
        : 'Tinyverse is still loading. Try again.';
      if (typeof twToast === 'function') twToast(msg);
      else console.warn('[welcome]', msg);
    };
    const chooseWelcomeMode = (mode) => {
      const wantsPlay = mode === 'play';
      let handledByModeApi = false;
      try {
        if (window.__tinyworldMode) {
          if (wantsPlay) window.__tinyworldMode.setPlay();
          else window.__tinyworldMode.setBuild();
          handledByModeApi = true;
        }
      } catch (_) {
        handledByModeApi = false;
      }
      if (!handledByModeApi) {
        try { localStorage.setItem('tinyworld:build-play-mode.v1', wantsPlay ? 'play' : 'build'); } catch (_) {}
        document.body.classList.toggle('tw-play-mode', wantsPlay);
      }
      closeWelcome();
    };
    // Flow: Tinyverse > Login > (if the account has no saved avatar) Select
    // Avatar > Worlds list. Login wires into the existing auth modal; the avatar
    // gate is account-scoped (GET /api/avatar) with a localStorage fallback so
    // local/no-auth dev and cloud outages never strand the flow.
    const AVATAR_LS_KEY = 'tinyworld:multiplayer:avatar-voxel';
    const localHasAvatar = () => {
      try { return !!localStorage.getItem(AVATAR_LS_KEY); } catch (_) { return false; }
    };
    // Resolve "does this account need to pick an avatar?". Authoritative server
    // read with a 4s timeout; any failure/unavailable falls back to localStorage
    // presence so the spinner never hangs.
    const accountNeedsAvatar = async () => {
      const api = window.__tinyworldCloudApiCall;
      if (!window.__loggedIn || typeof api !== 'function') return !localHasAvatar();
      let res;
      try {
        res = await Promise.race([
          api('/api/avatar', 'GET'),
          new Promise(resolve => setTimeout(() => resolve({ __timeout: true }), 4000)),
        ]);
      } catch (_) { res = null; }
      if (!res || res.__timeout || res.error || res.cloudUnavailable) return !localHasAvatar();
      if (res.avatar && typeof res.avatar === 'object') {
        // Hydrate the local look so the room renders the account's avatar.
        try { localStorage.setItem(AVATAR_LS_KEY, JSON.stringify(res.avatar)); } catch (_) {}
        return false;
      }
      return true;
    };
    // Open the avatar picker and resolve true on a deliberate Save, false if the
    // user closes it without saving. Guarded so the trailing close event that a
    // save also fires can't flip the result.
    const promptAvatarSelection = () => new Promise(resolve => {
      const WS = window.__tinyworldWorlds;
      if (!WS || typeof WS.openAvatarPicker !== 'function') { resolve(true); return; }
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        window.removeEventListener('tinyworld:avatar-saved', onSaved);
        window.removeEventListener('tinyworld:avatar-picker-closed', onClosed);
        resolve(ok);
      };
      const onSaved = () => finish(true);
      const onClosed = () => finish(false);
      window.addEventListener('tinyworld:avatar-saved', onSaved);
      window.addEventListener('tinyworld:avatar-picker-closed', onClosed);
      try { WS.openAvatarPicker(); } catch (_) { finish(true); }
    });
    // Tinyverse is invite-only for now: only these accounts get in; everyone else
    // sees the button as "Coming soon" (the Battleworlds treatment).
    const TINYVERSE_ALLOWLIST = ['jason@bouncingfish.com', 'jason.kneen@gmail.com'];
    async function tinyverseEmailAllowed() {
      try {
        const A = window.TinyWorldAuth;
        if (A && typeof A.getUser === 'function') {
          const u = await A.getUser();
          const email = ((u && u.email) || '').trim().toLowerCase();
          if (email) return TINYVERSE_ALLOWLIST.includes(email);
        }
      } catch (_) {}
      return null; // not logged in / unknown
    }
    async function applyTinyverseAccessGate() {
      if (!tinyverseBtn) return;
      const allowed = await tinyverseEmailAllowed();
      // Anyone who isn't a known-allowlisted account sees the "Coming soon" look.
      tinyverseBtn.classList.toggle('is-soon', allowed !== true);
      // Hard-disable only a KNOWN non-allowlisted account; leave it clickable when
      // logged out so an allowlisted user can still sign in through the login gate.
      if (allowed === false) tinyverseBtn.setAttribute('aria-disabled', 'true');
      else tinyverseBtn.removeAttribute('aria-disabled');
    }
    window.__applyTinyverseGate = applyTinyverseAccessGate;

    let tinyverseOpening = false;
    const openTinyverse = async () => {
      if (tinyverseOpening) return;
      tinyverseOpening = true;
      try {
        // 1. Login gate — defer entry until logged in, then resume (enterApp).
        if (!window.__loggedIn) {
          if (typeof window.__openLoginModal === 'function') {
            window.__tinyversePendingEntry = true;
            // Auth prompts stay in English per the i18n scope rules.
            window.__openLoginModal('Sign in to enter Tinyverse');
          } else {
            showTinyverseUnavailable();
          }
          return;
        }
        // 1b. Email allowlist gate — Tinyverse is invite-only for now.
        if ((await tinyverseEmailAllowed()) !== true) {
          applyTinyverseAccessGate();
          if (typeof twToast === 'function') twToast('Tinyverse is coming soon');
          return;
        }
        setTinyverseLoading(true);
        const worlds = await waitForWorldsFrontend();
        if (!worlds) { setTinyverseLoading(false); showTinyverseUnavailable(); return; }
        // 2. Avatar gate — first-timers pick a look before seeing the list.
        let needsAvatar = false;
        try { needsAvatar = await accountNeedsAvatar(); } catch (_) { needsAvatar = false; }
        if (needsAvatar) {
          setTinyverseLoading(false);
          const picked = await promptAvatarSelection();
          if (!picked) return; // closed without saving — stay on welcome
          setTinyverseLoading(true);
        }
        // 3. Worlds list.
        try {
          worlds.open();
          closeWelcome();
        } catch (err) {
          console.warn('[welcome] Tinyverse failed to open:', err);
          setTinyverseLoading(false);
          showTinyverseUnavailable();
        }
      } finally {
        tinyverseOpening = false;
      }
    };
    // Let the login-success path (enterApp, another closure) resume this flow.
    window.__tinyverseEnter = openTinyverse;
    const openBattleworlds = () => {
      const battleworlds = window.__tinyworldBattleworlds;
      if (battleworlds && typeof battleworlds.open === 'function') {
        closeWelcome();
        try {
          battleworlds.open();
          return;
        } catch (_) {}
      }
      chooseWelcomeMode('play');
    };

    const skipWelcomeForMultiplayer = (() => {
      try {
        const params = new URLSearchParams(location.search);
        if (params.get('party') || params.get('room') || params.get('collab') || params.get('share')) return true;
        if (typeof window.__tinyworldTinyverseSlugParam === 'function' && window.__tinyworldTinyverseSlugParam()) return true;
      } catch (_) {}
      return false;
    })();
    if (skipWelcomeForMultiplayer) {
      const tinyverseSlug = typeof window.__tinyworldTinyverseSlugParam === 'function'
        ? window.__tinyworldTinyverseSlugParam()
        : null;
      chooseWelcomeMode(tinyverseSlug ? 'play' : 'build');
      return;
    }
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('welcome-launch-open');
    if (tinyverseBtn) tinyverseBtn.addEventListener('click', openTinyverse);
    applyTinyverseAccessGate();   // reflect the email allowlist on the Tinyverse button
    if (battleworldsBtn) battleworldsBtn.addEventListener('click', openBattleworlds);
    if (buildBtn) buildBtn.addEventListener('click', () => chooseWelcomeMode('build'));
    if (playBtn) playBtn.addEventListener('click', () => chooseWelcomeMode('play'));
    requestAnimationFrame(() => {
      try { (tinyverseBtn || battleworldsBtn || buildBtn || playBtn).focus({ preventScroll: true }); } catch (_) {}
    });
  }

  // -------- cloud worlds / assets --------
  const TW_CLOUD_SLOT_PREFIX = 'cloud:';
  const TW_WORLD_CATALOG_SLOT_PREFIX = 'world:';
  const TW_WORLD_CATALOG_SLUG_PREFIX = 'world-slug:';
  const TW_WALLET_SESSION_KEY = 'tinyworld:auth:wallet-session.v1';
  let twCloudWorldCache = [];
  let twCloudWorldCacheAt = 0;
  let twWorldCatalogCache = [];
  let twWorldCatalogCacheAt = 0;
  let twCloudWorldSyncing = false;
  let twCloudWorldSyncPending = false;
  let twCloudWorldSyncTimer = null;
  let twCloudAssetSyncTimer = null;
  let twCloudAssetSyncing = false;
  let twCloudApplyingAssets = false;
  let twCloudPrefSyncTimer = null;
  let twCloudPrefSyncing = false;
  let twCloudApplyingPrefs = false;
  let twCloudDatabaseUnavailable = false;

  function twCloudWalletSessionToken() {
    try { return localStorage.getItem(TW_WALLET_SESSION_KEY) || ''; } catch (_) { return ''; }
  }

  function twCloudSetWalletSessionToken(token) {
    try {
      if (token) localStorage.setItem(TW_WALLET_SESSION_KEY, String(token));
      else localStorage.removeItem(TW_WALLET_SESSION_KEY);
    } catch (_) {}
  }

  function twCloudClearWalletSessionToken() {
    twCloudSetWalletSessionToken('');
  }

  function twCloudLoggedIn() {
    return !!(window.__tinyworldAuthEnabled && window.__loggedIn && (window.TinyWorldAuth || twCloudWalletSessionToken()));
  }

  function twCloudSlotId(buildId) {
    return TW_CLOUD_SLOT_PREFIX + String(buildId);
  }

  function twCloudBuildIdFromSlotId(id) {
    const value = String(id || '');
    if (!value.startsWith(TW_CLOUD_SLOT_PREFIX)) return null;
    const n = Number(value.slice(TW_CLOUD_SLOT_PREFIX.length));
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  function twCloudIdForSlot(slot) {
    const explicit = Number(slot && slot.cloudId);
    if (Number.isInteger(explicit) && explicit > 0) return explicit;
    return twCloudBuildIdFromSlotId(slot && slot.id);
  }

  function twCloudBuildTime(build) {
    if (!build) return 0;
    const raw = build.updatedAt || build.updated_at || build.createdAt || build.created_at;
    const t = raw ? Date.parse(raw) : 0;
    return Number.isFinite(t) ? t : 0;
  }

  function twCloudStateFingerprint(state) {
    try {
      return JSON.stringify(state || null);
    } catch (_) {
      return '';
    }
  }

  async function twCloudAccessToken() {
    const Auth = window.TinyWorldAuth;
    if (Auth) {
      try {
        const user = await Auth.getUser();
        if (user) {
          if (typeof user.jwt === 'function') {
            try { return await user.jwt(); } catch (_) {}
          }
          if (user.token && user.token.access_token) return user.token.access_token;
        }
      } catch (_) {}
    }
    const walletToken = twCloudWalletSessionToken();
    if (walletToken) return walletToken;
    try {
      const m = document.cookie.match(/(?:^|; )nf_jwt=([^;]*)/);
      return m ? decodeURIComponent(m[1]) : null;
    } catch (_) {
      return null;
    }
  }

  async function twCloudRestoreWalletSession() {
    const token = twCloudWalletSessionToken();
    if (!token) return false;
    const profile = await twCloudApiCall('/api/profile', 'GET');
    if (profile && !profile.error) return true;
    if (twCloudIsUnavailable(profile)) return true;
    twCloudClearWalletSessionToken();
    return false;
  }

  async function twCloudApiCall(path, method, body) {
    try {
      const token = await twCloudAccessToken();
      const opts = {
        method: method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      };
      if (token) opts.headers.Authorization = 'Bearer ' + token;
      if (body) opts.body = JSON.stringify(body);
      const r = await fetch(path, opts);
      const text = await r.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) {
        data = { error: text || r.statusText || ('HTTP ' + r.status) };
      }
      if (!r.ok) {
        const out = data || { error: r.statusText || ('HTTP ' + r.status) };
        out.status = r.status;
        out.cloudUnavailable = r.status === 503 && /Netlify Database is not available/i.test(String(out.error || ''));
        if (out.cloudUnavailable) {
          out.rawError = out.error;
          out.error = 'Cloud account features are unavailable in this Netlify session.';
          twCloudDatabaseUnavailable = true;
        }
        return out;
      }
      return data;
    } catch (err) {
      return { error: err.message || 'Network error' };
    }
  }

  function twCloudIsUnavailable(result) {
    return !!(result && result.cloudUnavailable);
  }

  async function twCloudLoadWorlds(force) {
    if (!twCloudLoggedIn()) {
      twCloudWorldCache = [];
      twCloudWorldCacheAt = 0;
      return [];
    }
    if (!force && twCloudWorldCacheAt && Date.now() - twCloudWorldCacheAt < 10_000) return twCloudWorldCache;
    const list = await twCloudApiCall('/api/builds', 'GET');
    if (Array.isArray(list)) {
      twCloudWorldCache = list;
      twCloudWorldCacheAt = Date.now();
    } else if (twCloudIsUnavailable(list)) {
      twCloudWorldCacheAt = Date.now();
    }
    return twCloudWorldCache;
  }

  function twCloudTouchWorldCache(build) {
    if (!build || !build.id) return;
    const row = {
      id: build.id,
      profileId: build.profileId,
      name: build.name,
      createdAt: build.createdAt || build.created_at,
      updatedAt: build.updatedAt || build.updated_at,
    };
    const idx = twCloudWorldCache.findIndex(w => Number(w.id) === Number(build.id));
    if (idx === -1) twCloudWorldCache.unshift(row);
    else twCloudWorldCache[idx] = Object.assign({}, twCloudWorldCache[idx], row);
    twCloudWorldCacheAt = Date.now();
  }

  function twCloudMergedWorlds(localList, cloudList) {
    const rows = [];
    const cloudById = new Map();
    (Array.isArray(cloudList) ? cloudList : []).forEach(build => {
      const id = Number(build && build.id);
      if (Number.isInteger(id) && id > 0) cloudById.set(id, build);
    });
    (Array.isArray(localList) ? localList : []).forEach(slot => {
      if (!slot) return;
      const cloudId = twCloudIdForSlot(slot);
      const cloud = cloudId ? cloudById.get(cloudId) : null;
      if (cloudId) cloudById.delete(cloudId);
      rows.push({
        id: slot.id,
        cloudId,
        local: true,
        cloud: !!cloudId,
        state: slot.state,
        name: (cloud && cloud.name) || slot.name || 'Untitled world',
        ts: Math.max(Number(slot.ts) || 0, twCloudBuildTime(cloud)),
      });
    });
    cloudById.forEach(build => {
      rows.push({
        id: twCloudSlotId(build.id),
        cloudId: Number(build.id),
        local: false,
        cloud: true,
        state: null,
        name: build.name || 'Untitled world',
        ts: twCloudBuildTime(build),
      });
    });
    return rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }

  function twWorldCatalogSlotId(world) {
    const id = Number(world && world.id);
    if (Number.isInteger(id) && id > 0) return TW_WORLD_CATALOG_SLOT_PREFIX + id;
    const slug = String((world && world.slug) || '').trim().toLowerCase();
    return slug ? TW_WORLD_CATALOG_SLUG_PREFIX + slug : '';
  }
  function twWorldCatalogIdFromSlotId(id) {
    if (!id || !String(id).startsWith(TW_WORLD_CATALOG_SLOT_PREFIX)) return null;
    const n = Number(String(id).slice(TW_WORLD_CATALOG_SLOT_PREFIX.length));
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  function twWorldCatalogSlugFromSlotId(id) {
    if (!id || !String(id).startsWith(TW_WORLD_CATALOG_SLUG_PREFIX)) return '';
    return String(id).slice(TW_WORLD_CATALOG_SLUG_PREFIX.length).trim().toLowerCase();
  }
  function twWorldCatalogKeyForWorld(world) {
    const id = Number(world && world.id);
    if (Number.isInteger(id) && id > 0) return 'id:' + id;
    const slug = String((world && world.slug) || '').trim().toLowerCase();
    return slug ? 'slug:' + slug : '';
  }
  function twWorldCatalogKeyForSlot(slot) {
    if (!slot) return '';
    const id = Number(slot.worldId || slot.world_id || twWorldCatalogIdFromSlotId(slot.id));
    if (Number.isInteger(id) && id > 0) return 'id:' + id;
    const slug = String(slot.worldSlug || slot.world_slug || twWorldCatalogSlugFromSlotId(slot.id) || '').trim().toLowerCase();
    return slug ? 'slug:' + slug : '';
  }
  function twWorldCatalogTime(world) {
    const raw = world && (world.updatedAt || world.updated_at || world.publishedAt || world.published_at || world.createdAt || world.created_at);
    const t = raw ? Date.parse(raw) : 0;
    return Number.isFinite(t) ? t : 0;
  }
  function twWorldCatalogDisplayName(world) {
    if (!world) return 'Untitled world';
    return world.name || world.slug || 'Untitled world';
  }
  function twWorldCatalogLiveRows() {
    const rows = Array.isArray(twWorldCatalogCache) ? twWorldCatalogCache.slice() : [];
    try {
      const WS = window.__tinyworldWorlds;
      const snap = WS && typeof WS.getState === 'function' ? WS.getState() : null;
      const live = snap && snap.world;
      const key = twWorldCatalogKeyForWorld(live);
      if (key && !rows.some(w => twWorldCatalogKeyForWorld(w) === key)) rows.unshift(live);
    } catch (_) {}
    return rows;
  }
  async function twWorldCatalogLoad(force) {
    if (!force && twWorldCatalogCacheAt && Date.now() - twWorldCatalogCacheAt < 15_000) return twWorldCatalogCache;
    const res = await twCloudApiCall('/api/worlds', 'GET');
    if (res && Array.isArray(res.worlds)) {
      twWorldCatalogCache = res.worlds;
      twWorldCatalogCacheAt = Date.now();
    } else if (res && res.error && !twCloudIsUnavailable(res)) {
      console.warn('[world-catalog] load failed:', res.error);
    }
    return twWorldCatalogCache;
  }
  function twWorldCatalogStateFromWorld(world) {
    if (!world) return null;
    let state = world.data || null;
    if (!state || typeof state !== 'object') return null;
    try { state = JSON.parse(JSON.stringify(state)); } catch (_) { state = Object.assign({}, state); }
    if (!Number.isFinite(Number(state.gridSize)) && Number.isFinite(Number(world.gridSize))) state.gridSize = Number(world.gridSize);
    if (!Array.isArray(state.cells)) state.cells = [];
    return state;
  }
  function twWorldCatalogCacheWorldLocally(world) {
    if (!world) return '';
    const id = twWorldCatalogSlotId(world);
    const state = twWorldCatalogStateFromWorld(world);
    if (!id || !state) return '';
    const list = readWorldsMeta();
    const worldId = Number(world.id);
    const row = {
      id,
      worldId: Number.isInteger(worldId) && worldId > 0 ? worldId : undefined,
      worldSlug: world.slug || '',
      worldStatus: world.status || '',
      worldKind: world.kind || '',
      name: twWorldCatalogDisplayName(world),
      ts: Date.now(),
      state,
    };
    const key = twWorldCatalogKeyForSlot(row);
    const idx = list.findIndex(slot => slot && (slot.id === id || twWorldCatalogKeyForSlot(slot) === key));
    if (idx === -1) list.push(row);
    else list[idx] = Object.assign({}, list[idx], row);
    writeWorldsMeta(list);
    return id;
  }
  function twWorldCatalogMergedWorlds(rows, catalogList) {
    const catalogByKey = new Map();
    (Array.isArray(catalogList) ? catalogList : []).forEach(world => {
      const key = twWorldCatalogKeyForWorld(world);
      if (key) catalogByKey.set(key, world);
    });
    const out = [];
    for (const row of (Array.isArray(rows) ? rows : [])) {
      if (!row) continue;
      const key = twWorldCatalogKeyForSlot(row);
      const catalog = key ? catalogByKey.get(key) : null;
      if (key) catalogByKey.delete(key);
      out.push(Object.assign({}, row, {
        catalog: !!(catalog || key),
        worldId: row.worldId || row.world_id || (catalog && catalog.id) || twWorldCatalogIdFromSlotId(row.id) || null,
        worldSlug: row.worldSlug || row.world_slug || (catalog && catalog.slug) || twWorldCatalogSlugFromSlotId(row.id) || '',
        worldStatus: row.worldStatus || row.world_status || (catalog && catalog.status) || '',
        worldKind: row.worldKind || row.world_kind || (catalog && catalog.kind) || '',
        name: row.name || twWorldCatalogDisplayName(catalog),
        ts: Math.max(Number(row.ts) || 0, twWorldCatalogTime(catalog)),
      }));
    }
    catalogByKey.forEach(world => {
      const id = twWorldCatalogSlotId(world);
      if (!id) return;
      out.push({
        id,
        worldId: Number(world.id) || null,
        worldSlug: world.slug || '',
        worldStatus: world.status || '',
        worldKind: world.kind || '',
        local: false,
        cloud: false,
        catalog: true,
        state: twWorldCatalogStateFromWorld(world),
        name: twWorldCatalogDisplayName(world),
        ts: twWorldCatalogTime(world),
      });
    });
    return out.sort((a, b) => (b.ts || 0) - (a.ts || 0) || String(a.name || '').localeCompare(String(b.name || '')));
  }

  async function twCloudSaveWorld(buildId, name, data) {
    if (!twCloudLoggedIn() || !data) return null;
    const n = Number(buildId);
    const hasBuildId = Number.isInteger(n) && n > 0;
    const path = hasBuildId ? '/api/builds?id=' + encodeURIComponent(String(n)) : '/api/builds';
    const result = await twCloudApiCall(path, hasBuildId ? 'PUT' : 'POST', {
      name: String(name || '').trim() || 'Untitled world',
      data,
    });
    if (result && result.id) twCloudTouchWorldCache(result);
    return result;
  }

  async function twCloudDeleteWorld(buildId) {
    const n = Number(buildId);
    if (!twCloudLoggedIn() || !Number.isInteger(n) || n < 1) return null;
    const result = await twCloudApiCall('/api/builds?id=' + encodeURIComponent(String(n)), 'DELETE');
    if (result && !result.error) {
      twCloudWorldCache = twCloudWorldCache.filter(w => Number(w.id) !== n);
      twCloudWorldCacheAt = Date.now();
    }
    return result;
  }

  function twCloudForgetLocalBuild(buildId) {
    const n = Number(buildId);
    if (!Number.isInteger(n) || n < 1) return;
    const activeId = getActiveWorldId();
    const list = readWorldsMeta();
    const activeSlot = list.find(slot => slot && slot.id === activeId);
    const next = list.filter(slot => twCloudIdForSlot(slot) !== n);
    writeWorldsMeta(next);
    if (twCloudBuildIdFromSlotId(activeId) === n || twCloudIdForSlot(activeSlot) === n) setActiveWorldId('');
  }

  function twCloudCacheBuildLocally(build) {
    if (!build || !build.id || !build.data) return '';
    const cloudId = Number(build.id);
    const id = twCloudSlotId(cloudId);
    const list = readWorldsMeta();
    const idx = list.findIndex(w => w && (w.id === id || Number(w.cloudId) === cloudId));
    const row = {
      id,
      cloudId,
      cloudSyncedAt: Date.now(),
      name: build.name || 'Untitled world',
      ts: twCloudBuildTime(build) || Date.now(),
      state: build.data,
    };
    if (idx === -1) list.push(row);
    else list[idx] = Object.assign({}, list[idx], row);
    writeWorldsMeta(list);
    return id;
  }

  function twCloudEnsureCurrentLocalSlot(list) {
    if (getActiveWorldId()) return false;
    const state = snapshotCurrentState();
    if (!state) return false;
    list.push({
      id: makeWorldId(),
      name: 'My world',
      ts: Date.now(),
      state,
    });
    setActiveWorldId(list[list.length - 1].id);
    return true;
  }

  async function twCloudSyncLocalWorldsToCloud(options = {}) {
    if (!twCloudLoggedIn()) return false;
    if (twCloudWorldSyncing) {
      twCloudWorldSyncPending = true;
      return false;
    }
    twCloudWorldSyncing = true;
    try {
      const list = readWorldsMeta();
      const includedCurrent = !!(options.includeCurrent && twCloudEnsureCurrentLocalSlot(list));
      // The includeCurrent slot is brand-new this call (not in persisted storage
      // yet); capture it so it survives the post-loop re-read below.
      const newSlot = includedCurrent ? list[list.length - 1] : null;
      let changed = includedCurrent;
      // Stable-identity -> cloud-metadata delta collected during the await loop.
      // Re-applied after the loop onto a fresh re-read so concurrent persisted
      // mutations (deletes/renames/new slots) are not clobbered.
      const cloudDeltas = new Map();
      const slotIdentity = (slot) => {
        if (slot && slot.id) return 'id:' + slot.id;
        const cid = twCloudIdForSlot(slot);
        return cid ? 'cloud:' + cid : null;
      };
      for (const slot of list) {
        if (!slot || !slot.state) continue;
        const cloudId = twCloudIdForSlot(slot);
        const slotTs = Number(slot.ts) || 0;
        if (cloudId && !options.force && Number(slot.cloudSyncedAt) >= slotTs) continue;
        const identity = slotIdentity(slot);
        const saved = await twCloudSaveWorld(cloudId, slot.name || 'Untitled world', slot.state);
        if (saved && saved.id) {
          const delta = {
            cloudId: Number(saved.id),
            cloudSyncedAt: Date.now(),
            cloudUpdatedAt: saved.updatedAt || saved.updated_at || null,
            // Only slots whose id is a cloud-prefix placeholder get re-keyed.
            renameId: (slot.id && slot.id.startsWith(TW_CLOUD_SLOT_PREFIX)) ? twCloudSlotId(saved.id) : null,
          };
          // Mutate the in-memory slot too so the captured newSlot reference and
          // any later identity lookups stay consistent.
          slot.cloudId = delta.cloudId;
          slot.cloudSyncedAt = delta.cloudSyncedAt;
          slot.cloudUpdatedAt = delta.cloudUpdatedAt;
          if (delta.renameId) slot.id = delta.renameId;
          if (identity) cloudDeltas.set(identity, delta);
          changed = true;
        } else if (saved && saved.error && !twCloudIsUnavailable(saved)) {
          console.warn('[cloud-worlds] sync failed:', saved.error);
        }
      }
      if (changed) {
        // Re-read current persisted meta and merge only the cloud deltas onto
        // matching slots. Slots deleted/renamed concurrently are absent here and
        // stay that way (no resurrection); concurrent edits are preserved.
        const fresh = readWorldsMeta();
        for (const slot of fresh) {
          const delta = cloudDeltas.get(slotIdentity(slot));
          if (!delta) continue;
          slot.cloudId = delta.cloudId;
          slot.cloudSyncedAt = delta.cloudSyncedAt;
          slot.cloudUpdatedAt = delta.cloudUpdatedAt;
          if (delta.renameId) slot.id = delta.renameId;
        }
        // The includeCurrent slot is genuinely new (created by this call) — append
        // it if a concurrent write has not already added an equivalent slot.
        if (newSlot && !fresh.some(s => s.id === newSlot.id)) fresh.push(newSlot);
        writeWorldsMeta(fresh);
      }
      if (!twCloudDatabaseUnavailable) await twCloudLoadWorlds(true);
      if (typeof window.__tinyworldWorldMenuRefresh === 'function') window.__tinyworldWorldMenuRefresh();
      if (typeof window.__tinyworldAccountWorldsRefresh === 'function') window.__tinyworldAccountWorldsRefresh();
      return changed;
    } finally {
      twCloudWorldSyncing = false;
      if (twCloudWorldSyncPending) {
        twCloudWorldSyncPending = false;
        twCloudQueueLocalWorldSync();
      }
    }
  }

  function twCloudQueueLocalWorldSync() {
    if (!twCloudLoggedIn()) return;
    if (twCloudWorldSyncing) {
      twCloudWorldSyncPending = true;
      return;
    }
    clearTimeout(twCloudWorldSyncTimer);
    twCloudWorldSyncTimer = setTimeout(() => {
      twCloudWorldSyncTimer = null;
      twCloudSyncLocalWorldsToCloud({ includeCurrent: false }).catch(err => {
        console.warn('[cloud-worlds] queued sync failed:', err);
      });
    }, 1200);
  }

  function twCloudCollectAssetLibrary() {
    return {
      version: 1,
      voxelBuilds: collectCustomVoxelBuilds(),
      assetTemplates: (typeof loadAssetTemplates === 'function') ? loadAssetTemplates() : [],
      modelStampDefaults: (window.__tinyworldModelStampDefaults && window.__tinyworldModelStampDefaults.collect)
        ? window.__tinyworldModelStampDefaults.collect() : {},
      updatedAt: new Date().toISOString(),
    };
  }

  function twCloudMergeAssetsIntoLocal(data) {
    if (!data || typeof data !== 'object') return false;
    let changed = false;
    twCloudApplyingAssets = true;
    try {
      const remoteBuilds = Array.isArray(data.voxelBuilds) ? data.voxelBuilds : [];
      if (remoteBuilds.length && typeof getVoxelBuildStamp === 'function' && typeof importVoxelBuildPayload === 'function') {
        const missing = remoteBuilds.filter(stamp => stamp && stamp.id && !getVoxelBuildStamp(stamp.id));
        if (missing.length) {
          importVoxelBuildPayload(missing, 'Cloud Asset');
          changed = true;
        }
      }

      const remoteTemplates = Array.isArray(data.assetTemplates) ? data.assetTemplates : [];
      if (remoteTemplates.length && typeof loadAssetTemplates === 'function' && typeof saveAssetTemplates === 'function') {
        const localTemplates = loadAssetTemplates();
        const seen = new Set(localTemplates.map(t => t && t.id).filter(Boolean));
        const merged = localTemplates.slice();
        for (const template of remoteTemplates) {
          if (!template || !template.id || seen.has(template.id)) continue;
          merged.push(template);
          seen.add(template.id);
          changed = true;
        }
        if (changed) saveAssetTemplates(merged);
      }

      const remoteDefaults = data.modelStampDefaults;
      if (remoteDefaults && typeof remoteDefaults === 'object'
          && window.__tinyworldModelStampDefaults && window.__tinyworldModelStampDefaults.apply) {
        if (window.__tinyworldModelStampDefaults.apply(remoteDefaults)) changed = true;
      }

      if (changed && typeof buildToolbar === 'function') {
        try { buildToolbar(); } catch (_) {}
      }
    } finally {
      twCloudApplyingAssets = false;
    }
    return changed;
  }

  async function twCloudPutAssetLibrary() {
    return twCloudApiCall('/api/assets', 'PUT', { data: twCloudCollectAssetLibrary() });
  }

  async function twCloudSyncAssetsToCloudNow() {
    if (!twCloudLoggedIn() || twCloudApplyingAssets || twCloudAssetSyncing) return null;
    twCloudAssetSyncing = true;
    try {
      return await twCloudPutAssetLibrary();
    } finally {
      twCloudAssetSyncing = false;
    }
  }

  async function twCloudSyncAssetsBothWays() {
    if (!twCloudLoggedIn() || twCloudAssetSyncing) return;
    twCloudAssetSyncing = true;
    try {
      const remote = await twCloudApiCall('/api/assets', 'GET');
      if (remote && !remote.error) twCloudMergeAssetsIntoLocal(remote);
      const saved = await twCloudPutAssetLibrary();
      if (saved && saved.error && !twCloudIsUnavailable(saved)) console.warn('[cloud-assets] sync failed:', saved.error);
    } finally {
      twCloudAssetSyncing = false;
    }
  }

  function twCloudQueueAssetsSync() {
    if (!twCloudLoggedIn() || twCloudApplyingAssets) return;
    clearTimeout(twCloudAssetSyncTimer);
    twCloudAssetSyncTimer = setTimeout(() => {
      twCloudSyncAssetsToCloudNow().catch(err => {
        console.warn('[cloud-assets] queued sync failed:', err);
      });
    }, 1200);
  }

  // -------- user preferences (settings that follow the account) --------
  // Synced: render/graphics, audio, crowd, world-gen, camera, weather/season,
  // UI theme + language, panel positions. NEVER synced: API keys / secrets
  // (ai:*, api:v1), user content (worlds/stamps/templates — synced elsewhere),
  // and device/ephemeral keys (multiplayer:client-id, *-changed events).
  const PREF_SYNC_PREFIXES = [
    'tinyworld:render:', 'tinyworld:audio:', 'tinyworld:crowd:', 'tinyworld:crowd.', 'tinyworld:gen:',
  ];
  const PREF_SYNC_KEYS = new Set([
    'tinyworld:view.camera', 'tinyworld:season.v1', 'tinyworld:weather.v1',
    'tinyworld:weather-intensity.v2', 'tinyworld:weather-splashes.v1', 'tinyworld:tod.v1',
    'tinyworld:uiTheme', 'tinyworld:lang', 'tinyworld:showGroups', 'tinyworld:tips.dismissed',
    'tinyworld:welcome:dismissedId', 'tinyworld:stamp-builder-recent.v1',
    'tinyworld:agent:input-pos', 'tinyworld:agent:panel-pos', 'tinyworld:minimap.pos',
    'tinyworld:toolPalette.pos', 'tinyworld:stamp-panel-pos', 'tinyworld:layers-panel-pos.v1',
    'tinyworld:layers-panel-open.v1', 'tinyworld:selection-props-active-tab.v1',
    'tinyworld:selection-props-collapsed.v1',
  ]);
  function twCloudIsSyncedPrefKey(key) {
    if (typeof key !== 'string') return false;
    // Hard exclusions first: secrets must never leave the device.
    if (key.startsWith('tinyworld:ai:') || key.startsWith('tinyworld:auth:') || key === 'tinyworld:api:v1') return false;
    if (PREF_SYNC_KEYS.has(key)) return true;
    return PREF_SYNC_PREFIXES.some(p => key.startsWith(p));
  }

  function twCloudCollectPreferences() {
    const prefs = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!twCloudIsSyncedPrefKey(key)) continue;
        const v = localStorage.getItem(key);
        if (typeof v === 'string') prefs[key] = v;
      }
    } catch (_) {}
    return { version: 1, prefs, updatedAt: new Date().toISOString() };
  }

  // Write remote preference values into localStorage (remote wins). Guarded by
  // twCloudApplyingPrefs so the setItem auto-sync hook below does not echo.
  // Note: applied values take effect on the next load (we do not re-run every
  // subsystem's setter live); a fresh device gets your settings after a reload.
  function twCloudApplyPreferences(remote) {
    if (!remote || typeof remote !== 'object' || !remote.prefs || typeof remote.prefs !== 'object') return false;
    let changed = false;
    twCloudApplyingPrefs = true;
    try {
      for (const [key, value] of Object.entries(remote.prefs)) {
        if (!twCloudIsSyncedPrefKey(key) || typeof value !== 'string') continue;
        if (localStorage.getItem(key) === value) continue;
        try { localStorage.setItem(key, value); changed = true; } catch (_) {}
      }
    } finally {
      twCloudApplyingPrefs = false;
    }
    return changed;
  }

  async function twCloudPutPreferences() {
    return twCloudApiCall('/api/preferences', 'PUT', { data: twCloudCollectPreferences() });
  }

  async function twCloudSyncPreferencesToCloudNow() {
    if (!twCloudLoggedIn() || twCloudApplyingPrefs || twCloudPrefSyncing) return null;
    twCloudPrefSyncing = true;
    try {
      return await twCloudPutPreferences();
    } finally {
      twCloudPrefSyncing = false;
    }
  }

  async function twCloudSyncPreferencesBothWays() {
    if (!twCloudLoggedIn() || twCloudPrefSyncing) return false;
    twCloudPrefSyncing = true;
    try {
      const remote = await twCloudApiCall('/api/preferences', 'GET');
      const pulled = (remote && !remote.error) ? twCloudApplyPreferences(remote) : false;
      const saved = await twCloudPutPreferences();
      if (saved && saved.error && !twCloudIsUnavailable(saved)) console.warn('[cloud-prefs] sync failed:', saved.error);
      return pulled;
    } finally {
      twCloudPrefSyncing = false;
    }
  }

  function twCloudQueuePreferencesSync() {
    if (!twCloudLoggedIn() || twCloudApplyingPrefs) return;
    clearTimeout(twCloudPrefSyncTimer);
    twCloudPrefSyncTimer = setTimeout(() => {
      twCloudSyncPreferencesToCloudNow().catch(err => {
        console.warn('[cloud-prefs] queued sync failed:', err);
      });
    }, 1500);
  }
  window.__tinyworldSyncPrefsToCloud = twCloudQueuePreferencesSync;

  // One Storage.prototype hook catches every setItem to a synced preference key,
  // so a setting change anywhere debounce-pushes to the account without touching
  // the ~120 scattered call sites. Patched on the prototype (not the instance,
  // which would create a bogus "setItem" storage entry).
  if (!Storage.prototype.__twPrefSyncPatched) {
    const _origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      _origSetItem.call(this, key, value);
      try {
        if (this === window.localStorage && !twCloudApplyingPrefs && twCloudIsSyncedPrefKey(key)) {
          twCloudQueuePreferencesSync();
        }
      } catch (_) {}
    };
    Storage.prototype.__twPrefSyncPatched = true;
  }

  // Pull the account's saved voxel avatar into localStorage so any entry path
  // (incl. share links that skip the welcome flow) renders the right look.
  async function twCloudHydrateAvatar() {
    if (!twCloudLoggedIn()) return;
    try {
      const res = await twCloudApiCall('/api/avatar', 'GET');
      if (res && !res.error && res.avatar && typeof res.avatar === 'object') {
        try { localStorage.setItem('tinyworld:multiplayer:avatar-voxel', JSON.stringify(res.avatar)); } catch (_) {}
      }
    } catch (_) {}
  }

  async function twCloudBootstrapSync() {
    if (!twCloudLoggedIn()) return;
    await Promise.all([
      twCloudSyncLocalWorldsToCloud({ includeCurrent: true }),
      twCloudSyncAssetsBothWays(),
      twCloudSyncPreferencesBothWays(),
      twCloudHydrateAvatar(),
    ]);
  }

  window.__tinyworldCloudApiCall = twCloudApiCall;
  window.__tinyworldCloudSyncNow = twCloudBootstrapSync;
  window.__tinyworldSyncAssetsToCloud = twCloudQueueAssetsSync;

  // -------- profile + saves --------
  function initAccountModal() {
    const Auth = window.TinyWorldAuth;
    const modal = document.getElementById('account-modal');
    const closeBtn = document.getElementById('account-close');
    const tabProfile = document.getElementById('tab-profile');
    const tabSaves = document.getElementById('tab-saves');
    const tabWallet = document.getElementById('tab-wallet');
    const tabPlayers = document.getElementById('tab-players');
    const tabApi = document.getElementById('tab-api');
    const panelProfile = document.getElementById('panel-profile');
    const panelSaves = document.getElementById('panel-saves');
    const panelWallet = document.getElementById('panel-wallet');
    const panelPlayers = document.getElementById('panel-players');
    const panelApi = document.getElementById('panel-api');
    const profileUsername = document.getElementById('profile-username');
    const profileDisplayName = document.getElementById('profile-display-name');
    const profileAbout = document.getElementById('profile-about');
    const profileImage = document.getElementById('profile-image');
    const profilePhotoFile = document.getElementById('profile-photo-file');
    const profilePhotoClear = document.getElementById('profile-photo-clear');
    const profileAvatarImg = document.getElementById('profile-avatar-img');
    const profileSaveBtn = document.getElementById('profile-save');
    const profileStatus = document.getElementById('profile-status');
    const saveCurrent = document.getElementById('save-current');
    const saveName = document.getElementById('save-name');
    const savesList = document.getElementById('saves-list');
    const savesEmpty = document.getElementById('saves-empty');
    const accountBtn = document.getElementById('account-btn');

    let userProfile = null;
    let userBuilds = [];

    function showTab(tab) {
      tabProfile.classList.toggle('active', tab === 'profile');
      tabSaves.classList.toggle('active',   tab === 'saves');
      if (tabWallet) tabWallet.classList.toggle('active', tab === 'wallet');
      if (tabPlayers) tabPlayers.classList.toggle('active', tab === 'players');
      if (tabApi) tabApi.classList.toggle('active', tab === 'api');
      panelProfile.hidden = tab !== 'profile';
      panelSaves.hidden   = tab !== 'saves';
      if (panelWallet) panelWallet.hidden = tab !== 'wallet';
      if (panelPlayers) panelPlayers.hidden = tab !== 'players';
      if (panelApi) panelApi.hidden = tab !== 'api';
      if (tab === 'saves') loadBuilds();
      if (tab === 'wallet' && typeof window.__renderWalletPanel === 'function') window.__renderWalletPanel();
      if (tab === 'players' && typeof window.__renderPlayersPanel === 'function') window.__renderPlayersPanel();
      if (tab === 'api' && typeof window.__renderApiPanel === 'function') window.__renderApiPanel();
    }
    // Initialise the API panel handlers once per account-modal lifetime.
    if (typeof window.__initApiPanel === 'function') window.__initApiPanel();
    if (typeof window.__initWalletPanel === 'function') window.__initWalletPanel();
    if (typeof window.__initPlayersPanel === 'function') window.__initPlayersPanel();
    tabProfile.addEventListener('click', () => showTab('profile'));
    tabSaves.addEventListener('click', () => showTab('saves'));
    if (tabWallet) tabWallet.addEventListener('click', () => showTab('wallet'));
    if (tabPlayers) tabPlayers.addEventListener('click', () => showTab('players'));
    if (tabApi) tabApi.addEventListener('click', () => showTab('api'));

    function openModal() { openTinyModal(modal, closeBtn); }
    function closeModal() { closeTinyModal(modal); }
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    async function apiCall(path, method, body) {
      return twCloudApiCall(path, method, body);
    }

    async function loadProfile() {
      const p = await apiCall('/api/profile', 'GET');
      if (p && p.id) {
        userProfile = p;
        profileUsername.value = p.username || '';
        profileDisplayName.value = p.displayName || p.username || '';
        profileAbout.value = p.about || '';
        profileImage.value = p.image || '';
        if (p.image) {
          profileAvatarImg.src = p.image;
          profileAvatarImg.hidden = false;
        }
      }
    }

    function syncAvatarPreview() {
      const image = profileImage.value.trim();
      if (image) { profileAvatarImg.src = image; profileAvatarImg.hidden = false; }
      else { profileAvatarImg.removeAttribute('src'); profileAvatarImg.hidden = true; }
    }

    profilePhotoFile.addEventListener('change', () => {
      const file = profilePhotoFile.files && profilePhotoFile.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        profileStatus.textContent = 'Please choose an image file';
        profilePhotoFile.value = '';
        return;
      }
      if (file.size > 500 * 1024) {
        profileStatus.textContent = 'Photo must be under 500KB';
        profilePhotoFile.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        profileImage.value = String(reader.result || '');
        syncAvatarPreview();
        profileStatus.textContent = 'Photo ready — save profile to keep it';
      };
      reader.readAsDataURL(file);
    });

    profilePhotoClear.addEventListener('click', () => {
      profileImage.value = '';
      profilePhotoFile.value = '';
      syncAvatarPreview();
    });

    profileSaveBtn.addEventListener('click', async () => {
      const username = profileUsername.value.trim().toLowerCase();
      const displayName = profileDisplayName.value.trim();
      if (!username) { profileStatus.textContent = 'Username required'; return; }
      if (!/^[a-z0-9_]{3,24}$/.test(username)) { profileStatus.textContent = 'Username must be 3-24 lowercase letters, numbers, underscores'; return; }
      if (!displayName) { profileStatus.textContent = 'Display name required'; return; }
      profileUsername.value = username;
      profileStatus.textContent = 'Saving...';
      const result = await apiCall('/api/profile', 'PUT', {
        username,
        displayName,
        about: profileAbout.value.trim(),
        image: profileImage.value.trim(),
      });
      if (result && (result.id || result.username)) {
        userProfile = result;
        profileStatus.textContent = 'Saved!';
        setTimeout(() => profileStatus.textContent = '', 2000);
      } else {
        profileStatus.textContent = (result && result.error) || 'Save failed';
      }
    });

    async function loadBuilds() {
      const list = await twCloudLoadWorlds(true);
      userBuilds = Array.isArray(list) ? list : [];
      renderBuilds();
    }

    function renderBuilds() {
      savesList.innerHTML = '';
      savesEmpty.hidden = userBuilds.length > 0;
      userBuilds.forEach(b => {
        const li = document.createElement('li');
        const info = document.createElement('div');
        const nameSpan = document.createElement('div');
        nameSpan.className = 'save-name';
        nameSpan.textContent = b.name;
        if (b.id) {
          const cloudMark = document.createElement('span');
          cloudMark.className = 'save-cloud-badge';
          cloudMark.textContent = 'Cloud';
          nameSpan.appendChild(cloudMark);
        }
        const dateSpan = document.createElement('div');
        dateSpan.className = 'save-date';
        dateSpan.textContent = new Date(b.updatedAt || b.created_at).toLocaleDateString();
        info.appendChild(nameSpan);
        info.appendChild(dateSpan);
        const actions = document.createElement('div');
        actions.className = 'save-actions';
        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Load';
        loadBtn.title = 'Load this build';
        loadBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const full = await apiCall('/api/builds?id=' + b.id, 'GET');
          if (full && full.data) {
            applyState(full.data);
            const localId = twCloudCacheBuildLocally(full);
            if (localId) setActiveWorldId(localId);
            if (typeof window.__tinyworldWorldMenuRefresh === 'function') window.__tinyworldWorldMenuRefresh();
            closeModal();
          }
        });
        const shareBtn = document.createElement('button');
        shareBtn.textContent = 'Share';
        shareBtn.title = 'Copy share URL';
        shareBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await shareSavedBuild(b);
        });
        const delBtn = document.createElement('button');
        delBtn.textContent = '×';
        delBtn.title = 'Delete';
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const confirmed = await window.twConfirm({
            title: 'Delete saved world?',
            message: 'Delete "' + b.name + '"?',
            details: 'This removes the saved copy from your TinyWorld cloud/library.',
            confirmLabel: 'Delete',
            intent: 'danger',
          });
          if (!confirmed) return;
          await twCloudDeleteWorld(b.id);
          twCloudForgetLocalBuild(b.id);
          if (typeof window.__tinyworldWorldMenuRefresh === 'function') window.__tinyworldWorldMenuRefresh();
          loadBuilds();
        });
        actions.appendChild(loadBtn);
        actions.appendChild(shareBtn);
        actions.appendChild(delBtn);
        li.appendChild(info);
        li.appendChild(actions);
        savesList.appendChild(li);
      });
    }

    saveCurrent.addEventListener('click', async () => {
      if (!userProfile) await loadProfile();
      if (!userProfile) { alert('Please save your profile first.'); showTab('profile'); return; }
      const name = saveName.value.trim() || ('World ' + new Date().toLocaleDateString());
      const data = snapshotCurrentState();
      if (!data) { alert('Could not snapshot this world.'); return; }
      const activeId = getActiveWorldId();
      const activeSlot = readWorldsMeta().find(w => w && w.id === activeId);
      const activeCloudId = twCloudBuildIdFromSlotId(activeId) || twCloudIdForSlot(activeSlot);
      const result = await twCloudSaveWorld(activeCloudId, name, data);
      if (result && result.id) {
        if (activeSlot && !activeCloudId) {
          const list = readWorldsMeta();
          const idx = list.findIndex(w => w && w.id === activeSlot.id);
          if (idx !== -1) {
            list[idx].cloudId = Number(result.id);
            list[idx].cloudSyncedAt = Date.now();
            list[idx].cloudUpdatedAt = result.updatedAt || result.updated_at || null;
            list[idx].name = result.name || name;
            list[idx].state = data;
            list[idx].ts = Date.now();
            writeWorldsMeta(list);
            setActiveWorldId(list[idx].id);
          }
        } else {
          const localId = twCloudCacheBuildLocally(Object.assign({}, result, { data }));
          if (localId) setActiveWorldId(localId);
        }
      }
      saveName.value = '';
      if (typeof window.__tinyworldWorldMenuRefresh === 'function') window.__tinyworldWorldMenuRefresh();
      loadBuilds();
    });

    function absoluteShareUrl(result) {
      if (!result) return '';
      if (result.url) return new URL(result.url, location.origin).href;
      if (result.id) return new URL('/tiny-world-builder?share=' + encodeURIComponent(result.id), location.origin).href;
      return '';
    }

    async function copyShareUrl(url) {
      if (!url) return false;
      try {
        await navigator.clipboard.writeText(url);
        return true;
      } catch (_) {
        window.prompt('Copy share URL', url);
        return false;
      }
    }

    async function shareSavedBuild(build) {
      const result = await apiCall('/api/share', 'POST', { buildId: build.id });
      if (result && result.error) {
        twToast(result.error, 'err');
        return;
      }
      const url = absoluteShareUrl(result);
      await copyShareUrl(url);
      twToast('Share URL copied.', 'ok');
    }

    accountBtn.addEventListener('click', () => {
      openModal();
      loadProfile();
      loadBuilds();
    });
    window.__tinyworldAccountWorldsRefresh = loadBuilds;
  }

  // -------- auth --------
  // Static deploy bypass: when no optional auth library is present, run the
  // existing "no auth library" branch so settings and AI generation stay
  // available on static hosts such as Vercel.
  function __isLocalDev() {
    try {
      const u = new URL(location.href);
      if (u.searchParams.has('dev')) return true;
      if (location.protocol === 'file:') return true;
      const h = location.hostname;
      return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.endsWith('.local');
    } catch (_) { return false; }
  }
  function __useLocalAuth() {
    try {
      const u = new URL(location.href);
      if (u.searchParams.get('auth') === '1') return true;
      if (u.searchParams.get('auth') === '0') return false;
      return u.hostname === 'localhost' && u.port === '8888';
    } catch (_) { return false; }
  }
  function initAuth() {
    const localDev = __isLocalDev();
    const wantsAuth = !localDev || __useLocalAuth();
    const Auth = wantsAuth ? window.TinyWorldAuth : null;
    if (wantsAuth && !Auth && window.__tinyworldAuthReady && !window.__tinyworldAuthBootWaited) {
      window.__tinyworldAuthBootWaited = true;
      window.__tinyworldAuthReady.then(() => initAuth()).catch(() => initAuth());
      return;
    }
    window.__tinyworldAuthEnabled = !!Auth;
    if (!Auth) {
      // No auth library — single-user local mode. Hide all auth UI
      // and treat the user as logged in so settings/AI aren't
      // permanently locked.
      window.__loggedIn = true;
      // Hide sign-in/out/account UI; unhide AI generate; clear locked badge.
      for (const id of ['auth-login-btn-top', 'auth-logout-btn', 'account-btn']) {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
      }
      const genBtn = document.getElementById('generate');
      if (genBtn) genBtn.hidden = false;
      const settingsBtn = document.getElementById('render-settings');
      if (settingsBtn) {
        settingsBtn.classList.remove('locked');
        settingsBtn.setAttribute('data-tooltip', 'Settings');
      }
      bootApp();
      return;
    }

    const modal = document.getElementById('auth-modal');
    const errorEl = document.getElementById('auth-error');
    const successEl = document.getElementById('auth-success');
    const loginForm = document.getElementById('auth-login');
    const signupForm = document.getElementById('auth-signup');
    const forgotForm = document.getElementById('auth-forgot');
    const resetForm = document.getElementById('auth-reset');
    const logoutBtn = document.getElementById('auth-logout-btn');
    const accountBtn = document.getElementById('account-btn');
    const walletLoginBtn = document.getElementById('auth-wallet-login');

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
      successEl.hidden = true;
    }

    function showSuccess(msg) {
      successEl.textContent = msg;
      successEl.hidden = false;
      errorEl.hidden = true;
    }

    function clearMessages() {
      errorEl.hidden = true;
      successEl.hidden = true;
    }

    function showForm(name) {
      clearMessages();
      loginForm.hidden = name !== 'login';
      signupForm.hidden = name !== 'signup';
      forgotForm.hidden = name !== 'forgot';
      resetForm.hidden = name !== 'reset';
      const subtitle = modal.querySelector('.auth-subtitle');
      if (name === 'login') subtitle.textContent = 'Sign in to start building';
      else if (name === 'signup') subtitle.textContent = 'Create your account';
      else if (name === 'forgot') subtitle.textContent = 'Reset your password';
      else if (name === 'reset') subtitle.textContent = 'Choose a new password';
    }

    function setLoading(btn, loading) {
      btn.disabled = loading;
      btn.textContent = loading ? 'Please wait…' : btn.dataset.label;
    }

    function setWalletLoginLoading(loading) {
      if (!walletLoginBtn) return;
      walletLoginBtn.disabled = !!loading;
      const label = walletLoginBtn.querySelector('.auth-wallet-label');
      if (label) label.textContent = loading ? 'Check your wallet...' : 'Sign in with Phantom';
    }

    function authPhantomProvider() {
      const provider = window.phantom && window.phantom.solana ? window.phantom.solana : window.solana;
      return provider && provider.isPhantom ? provider : null;
    }

    function authBytesToBase64(bytes) {
      const arr = Array.from(bytes || []);
      let bin = '';
      arr.forEach(b => { bin += String.fromCharCode(Number(b) & 0xff); });
      return btoa(bin);
    }

    async function walletLoginApiCall(body) {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body || {}),
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) {
        data = { error: text || res.statusText || ('HTTP ' + res.status) };
      }
      if (!res.ok) {
        const err = new Error((data && data.error) || res.statusText || ('HTTP ' + res.status));
        err.status = res.status;
        throw err;
      }
      return data;
    }

    async function signInWithWallet() {
      const provider = authPhantomProvider();
      if (!provider) {
        showError('Phantom wallet was not found. Install Phantom or unlock it, then try again.');
        return;
      }
      if (typeof provider.signMessage !== 'function') {
        showError('This Phantom provider cannot sign messages.');
        return;
      }
      setWalletLoginLoading(true);
      try {
        const connected = await provider.connect();
        const publicKey = connected && connected.publicKey
          ? connected.publicKey.toString()
          : (provider.publicKey && provider.publicKey.toString());
        if (!publicKey) throw new Error('Wallet did not return a public key.');
        const challenge = await walletLoginApiCall({ action: 'loginChallenge', publicKey });
        const signed = await provider.signMessage(new TextEncoder().encode(challenge.message), 'utf8');
        const signature = authBytesToBase64(signed.signature || signed);
        const result = await walletLoginApiCall({
          action: 'login',
          publicKey,
          message: challenge.message,
          challengeToken: challenge.challengeToken,
          signature,
        });
        if (!result || !result.sessionToken) throw new Error('Wallet login did not return a session.');
        twCloudSetWalletSessionToken(result.sessionToken);
        if (typeof window.__renderWalletPanel === 'function') {
          try { window.__renderWalletPanel(); } catch (_) {}
        }
        enterApp();
      } catch (err) {
        twCloudClearWalletSessionToken();
        showError((err && err.message) || 'Wallet login failed. Please try again.');
      } finally {
        setWalletLoginLoading(false);
      }
    }

    document.getElementById('auth-login-btn').dataset.label = 'Sign in';
    document.getElementById('auth-signup-btn').dataset.label = 'Create account';
    document.getElementById('auth-forgot-btn').dataset.label = 'Send reset link';
    document.getElementById('auth-reset-btn').dataset.label = 'Set new password';
    if (walletLoginBtn) walletLoginBtn.addEventListener('click', signInWithWallet);

    document.getElementById('auth-show-signup').addEventListener('click', () => showForm('signup'));
    document.getElementById('auth-show-forgot').addEventListener('click', () => showForm('forgot'));
    document.getElementById('auth-show-login').addEventListener('click', () => showForm('login'));
    document.getElementById('auth-back-login').addEventListener('click', () => showForm('login'));

    // OAuth providers: show only providers enabled in Netlify Identity settings.
    ['google', 'github'].forEach(provider => {
      const login = document.getElementById('auth-' + provider + '-login');
      const signup = document.getElementById('auth-' + provider + '-signup');
      if (login) login.addEventListener('click', () => Auth.oauthLogin(provider));
      if (signup) signup.addEventListener('click', () => Auth.oauthLogin(provider));
    });
    Auth.getSettings().then(settings => {
      const providers = settings && settings.providers ? settings.providers : {};
      const enabled = ['google', 'github'].filter(provider => providers[provider]);
      enabled.forEach(provider => {
        const login = document.getElementById('auth-' + provider + '-login');
        const signup = document.getElementById('auth-' + provider + '-signup');
        if (login) login.hidden = false;
        if (signup) signup.hidden = false;
      });
      document.getElementById('auth-oauth-login').hidden = enabled.length === 0;
      document.getElementById('auth-oauth-signup').hidden = enabled.length === 0;
    }).catch(() => {});

    // Tracks the live login state so gated controls can react to it.
    // Anonymous users get the app, settings/AI/cloud are locked.
    window.__loggedIn = false;
    function setLoggedInState(isLoggedIn) {
      window.__loggedIn = !!isLoggedIn;
      if (logoutBtn) logoutBtn.hidden = !isLoggedIn;
      if (accountBtn) accountBtn.hidden = !isLoggedIn;
      const loginBtnTop = document.getElementById('auth-login-btn-top');
      if (loginBtnTop) loginBtnTop.hidden = !!isLoggedIn;
      // Lock badges + tooltips for the gated buttons.
      const settingsBtn = document.getElementById('render-settings');
      const generateBtn = document.getElementById('generate');
      if (settingsBtn) {
        settingsBtn.classList.toggle('locked', !isLoggedIn);
        settingsBtn.setAttribute('data-tooltip', isLoggedIn ? 'Settings' : 'Sign in to use settings');
      }
      if (generateBtn) {
        generateBtn.hidden = !isLoggedIn;
      }
    }

    // AI interfaces are hidden on prod (the boot script adds html.ai-disabled
    // unless local / ?ai=1 / stored flag). Unlock them live for allow-listed
    // accounts when they sign in, and revert on sign-out, so the grant follows
    // the account rather than the browser.
    const AI_ACCOUNT_ALLOWLIST = ['jason@bouncingfish.com'];
    const aiBaseEnabled = !!window.__TWB_AI_INTERFACES_ENABLED__;
    let aiUnlockedByAccount = false;
    function setAiInterfacesEnabled(on) {
      window.__TWB_AI_INTERFACES_ENABLED__ = !!on;
      document.documentElement.classList.toggle('ai-disabled', !on);
    }
    async function applyAccountAiEntitlement() {
      if (aiBaseEnabled) return; // already enabled for everyone here (local/?ai=1/stored)
      const A = window.TinyWorldAuth;
      if (!A || typeof A.getUser !== 'function') return;
      let email = '';
      try { const u = await A.getUser(); email = ((u && u.email) || '').trim().toLowerCase(); } catch (_) { return; }
      if (email && AI_ACCOUNT_ALLOWLIST.indexOf(email) !== -1) {
        aiUnlockedByAccount = true;
        setAiInterfacesEnabled(true);
        setLoggedInState(!!window.__loggedIn); // refresh gated controls (Generate, etc.)
      }
    }
    function revertAccountAiEntitlement() {
      if (aiUnlockedByAccount && !aiBaseEnabled) {
        aiUnlockedByAccount = false;
        setAiInterfacesEnabled(false);
      }
    }

    function openLoginModal(reason) {
      clearMessages();
      const subtitle = modal.querySelector('.auth-subtitle');
      if (subtitle && reason) subtitle.textContent = reason;
      showForm('login');
      openTinyModal(modal, document.getElementById('auth-email'));
    }
    // Expose to gated handlers outside this closure.
    window.__openLoginModal = openLoginModal;

    function enterApp() {
      closeTinyModal(modal);
      setLoggedInState(true);
      if (typeof window.__applyTinyverseGate === 'function') window.__applyTinyverseGate();  // refresh Tinyverse access once email is known
      applyAccountAiEntitlement();
      bootApp();
      initAccountModal();
      twCloudBootstrapSync().catch(err => console.warn('[cloud-sync] bootstrap failed:', err));
      // Resume a pending Tinyverse entry that was waiting on login. Independent
      // of the bootstrap sync above; the avatar gate does its own server read.
      if (window.__tinyversePendingEntry) {
        window.__tinyversePendingEntry = false;
        if (typeof window.__tinyverseEnter === 'function') setTimeout(() => window.__tinyverseEnter(), 0);
      }
    }

    function enterAnonApp() {
      closeTinyModal(modal);
      setLoggedInState(false);
      bootApp();
    }

    // Login
    document.getElementById('auth-login-btn').addEventListener('click', async () => {
      const btn = document.getElementById('auth-login-btn');
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      if (!email || !password) { showError('Please enter your email and password.'); return; }
      setLoading(btn, true);
      try {
        await Auth.login(email, password);
        enterApp();
      } catch (err) {
        if (err instanceof Auth.AuthError) {
          showError(err.status === 401 ? 'Invalid email or password.' : err.message);
        } else if (err instanceof Auth.MissingIdentityError) {
          showError('Identity is not enabled on this site.');
        } else {
          showError('Something went wrong. Please try again.');
        }
      } finally {
        setLoading(btn, false);
      }
    });

    // Signup
    document.getElementById('auth-signup-btn').addEventListener('click', async () => {
      const btn = document.getElementById('auth-signup-btn');
      const username = document.getElementById('auth-signup-username').value.trim().toLowerCase();
      const name = document.getElementById('auth-signup-name').value.trim();
      const email = document.getElementById('auth-signup-email').value.trim();
      const password = document.getElementById('auth-signup-password').value;
      if (!/^[a-z0-9_]{3,24}$/.test(username)) { showError('Username must be 3-24 lowercase letters, numbers, underscores.'); return; }
      if (!name) { showError('Please enter a display name.'); return; }
      if (!email || !password) { showError('Please enter an email and password.'); return; }
      setLoading(btn, true);
      try {
        const user = await Auth.signup(email, password, { full_name: name, username, display_name: name });
        if (user.emailVerified) {
          enterApp();
        } else {
          showSuccess('Check your email to confirm your account, then sign in.');
          showForm('login');
        }
      } catch (err) {
        if (err instanceof Auth.AuthError) {
          showError(err.status === 403 ? 'Signups are not allowed.' : err.message);
        } else if (err instanceof Auth.MissingIdentityError) {
          showError('Identity is not enabled on this site.');
        } else {
          showError('Something went wrong. Please try again.');
        }
      } finally {
        setLoading(btn, false);
      }
    });

    // Forgot password
    document.getElementById('auth-forgot-btn').addEventListener('click', async () => {
      const btn = document.getElementById('auth-forgot-btn');
      const email = document.getElementById('auth-forgot-email').value.trim();
      if (!email) { showError('Please enter your email address.'); return; }
      setLoading(btn, true);
      try {
        await Auth.requestPasswordRecovery(email);
        showSuccess('Check your email for a password reset link.');
      } catch (err) {
        if (err instanceof Auth.AuthError) {
          showError(err.message);
        } else {
          showError('Something went wrong. Please try again.');
        }
      } finally {
        setLoading(btn, false);
      }
    });

    // Password reset
    document.getElementById('auth-reset-btn').addEventListener('click', async () => {
      const btn = document.getElementById('auth-reset-btn');
      const password = document.getElementById('auth-reset-password').value;
      if (!password) { showError('Please choose a new password.'); return; }
      setLoading(btn, true);
      try {
        await Auth.updateUser({ password });
        showSuccess('Password updated. You are now signed in.');
        setTimeout(enterApp, 1200);
      } catch (err) {
        if (err instanceof Auth.AuthError) {
          showError(err.message);
        } else {
          showError('Something went wrong. Please try again.');
        }
      } finally {
        setLoading(btn, false);
      }
    });

    // Logout — drop back to anonymous mode, no forced re-login.
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
      twCloudClearWalletSessionToken();
      try {
        await Auth.logout();
      } catch (_) {}
      setLoggedInState(false);
      revertAccountAiEntitlement();
    });

    // Top-bar Sign In button opens the login modal.
    const topLoginBtn = document.getElementById('auth-login-btn-top');
    if (topLoginBtn) topLoginBtn.addEventListener('click', () => openLoginModal('Sign in to unlock AI, settings & cloud saves'));

    // Handle auth callbacks (OAuth, recovery, confirmation, invite)
    async function processCallback() {
      try {
        const result = await Auth.handleAuthCallback();
        if (!result) return false;
        switch (result.type) {
          case 'oauth':
          case 'confirmation':
            enterApp();
            return true;
          case 'recovery':
            showForm('reset');
            openTinyModal(modal, document.getElementById('auth-reset-password'));
            return true;
          case 'invite':
            showSuccess('Set a password to accept your invite.');
            showForm('reset');
            openTinyModal(modal, document.getElementById('auth-reset-password'));
            return true;
          case 'email_change':
            showSuccess('Email address updated.');
            openTinyModal(modal, document.getElementById('auth-email'));
            return true;
        }
      } catch (err) {
        if (err instanceof Auth.AuthError) showError(err.message);
      }
      return false;
    }

    // Check existing session or callback
    (async () => {
      const handled = await processCallback();
      if (handled) return;
      const user = await Auth.getUser();
      if (user) {
        enterApp();
      } else if (await twCloudRestoreWalletSession()) {
        enterApp();
      } else {
        // Anonymous mode by default — boot the app, gate
        // settings / AI / cloud behind a sign-in prompt.
        enterAnonApp();
      }
    })();
  }

  // -------- boot --------
  let appBooted = false;
  function bootApp() {
    if (appBooted) return;
    twPerfMark('boot:start');
    appBooted = true;
    initWelcomeDialog();
    // Top-right home button -> back to the marketing landing page (full nav to "/").
    try {
      const homeBtn = document.getElementById('landing-home-btn');
      if (homeBtn && !homeBtn.__wired) {
        homeBtn.__wired = true;
        homeBtn.addEventListener('click', () => { window.location.href = '/'; });
      }
    } catch (_) {}
    twPerfMark('boot:welcome-ready');
    buildToolbar();
    twPerfMark('boot:toolbar-built');
    selectTool(DEFAULT_TOOL);
    twPerfMark('boot:default-tool-selected');
    const remoteWorldParam = sanitizeWorldUrl(getWorldUrlParam());
    if (remoteWorldParam) {
      // ?world=<same-origin-url>: show a placeholder scene now, then swap in the
      // fetched world when it arrives (fetch can't resolve synchronously here).
      twPerfMark('boot:load-world-url');
      loadInitialScene();
      resetCameraDefaults();
      loadWorldFromUrl(remoteWorldParam).then((ok) => {
        if (ok && worldHistoryReady) { refreshWorldHistoryUI(); ensureGhostBoardsAroundTarget(); }
      });
    } else if (!loadState()) {
      twPerfMark('boot:load-state-empty');
      // Fresh session: load the bundled default island; fall back to the
      // procedural starter scene only if default_island.json is unavailable.
      if (!(typeof applyDefaultIslandState === 'function' && applyDefaultIslandState())) loadInitialScene();
      resetCameraDefaults();
    } else {
      twPerfMark('boot:load-state-restored');
    }
    // Always open in the non-destructive Select tool, even when loadState
    // restored a world that had a build tool active — a fresh session should
    // never start hot, so a stray click can't begin building unexpectedly.
    selectTool(DEFAULT_TOOL);
    worldHistoryReady = true;
    refreshWorldHistoryUI();
    twPerfMark('boot:scene-ready');
    ensureGhostBoardsAroundTarget();
    twPerfMark('boot:ghost-boards-queued');
    initCrowdLayer();
    twPerfMark('boot:crowd-ready');
    onResize();
    twPerfMark('boot:resized');
    setRenderSceneReady(true);
    renderer.setAnimationLoop(animate);
    twPerfMark('boot:animation-loop');
    startToolThumbBuildQueue();
    startDeferredVisualStartupTasks();
    twPerfMark('boot:end');
    const vehicleDemoRequest = getVehicleDemoUrlRequest();
    const islandStressRequest = getIslandStressDemoUrlRequest();
    if (vehicleDemoRequest) {
      setTimeout(() => runSeededVehicleDemo(vehicleDemoRequest.seed, {
        fromUrl: true,
        variant: vehicleDemoRequest.variant,
        size: vehicleDemoRequest.size,
        carCount: vehicleDemoRequest.carCount,
      }), 0);
    }
    if (islandStressRequest) {
      setTimeout(() => runIslandStressDemo(islandStressRequest.count, {
        fromUrl: true,
        stats: true,
      }), vehicleDemoRequest ? 150 : 0);
    }
  }

  // -------- minimap (ported from OWB hud.js redrawMinimap) --------
  // Repaints a 2D top-down map window from world + generated preview-board
  // state. The map follows the current camera target, so panning away from
  // the home board keeps a useful 2D overview instead of a stale 8x8 tile.
  // Tile colour comes from the terrain palette (matches the 3D scene);
  // a per-kind silhouette is overlaid for any populated cell so trees,
  // houses, animals etc. read as the same shape they do in 3D.
  // Repainting is throttled: setCell + saveState + applyState all call
  // requestMinimapRepaint(), and the next animation frame consolidates.
  const MINIMAP_TERRAIN_MATERIALS = {
    grass: 'grass',
    path:  'path',
    dirt:  'dirtRich',
    water: 'water',
    stone: 'stone',
    lava:  'lava',
    sand:  'sand',
    snow:  'snow',
  };
  const MINIMAP_FALLBACK_COLORS = {
    grass: 0x6f9e30,
    path:  0xe8d5a8,
    dirt:  0x7d4519,
    water: 0x3a8fcc,
    stone: 0x8f8a82,
    lava:  0xe7592b,
    sand:  0xe6cc7c,
    snow:  0xf2f5fa,
  };
  function minimapHexToCss(hex) {
    return '#' + (hex & 0xffffff).toString(16).padStart(6, '0');
  }
  function minimapCssToHex(css, fallback = 0x9ec74b) {
    if (typeof css !== 'string' || css[0] !== '#') return fallback;
    const n = parseInt(css.slice(1), 16);
    return Number.isFinite(n) ? n : fallback;
  }
  function minimapMixHex(a, b, t) {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
  }
  function minimapMaterialHex(matName, fallback) {
    const mat = M[matName];
    return mat && mat.color ? mat.color.getHex() : fallback;
  }
  function minimapThemeHex(hex) {
    let out = hex;
    const body = document.body;
    if (body.classList.contains('tod-night')) out = minimapMixHex(out, 0x14213a, 0.38);
    else if (body.classList.contains('tod-dusk')) out = minimapMixHex(out, 0xd9784a, 0.14);
    else if (body.classList.contains('tod-dawn')) out = minimapMixHex(out, 0xffc794, 0.10);
    const mode = typeof weatherMode === 'string' ? weatherMode : 'clear';
    if (mode === 'cloudy') out = minimapMixHex(out, 0xaeb4b7, 0.16);
    else if (mode === 'rain') out = minimapMixHex(out, 0x607487, 0.12);
    else if (mode === 'storm') out = minimapMixHex(out, 0x364252, 0.22);
    else if (mode === 'snow') out = minimapMixHex(out, 0xeaf3ff, 0.18);
    return out;
  }
  function minimapTerrainHex(terrain) {
    const fallback = MINIMAP_FALLBACK_COLORS[terrain] || MINIMAP_FALLBACK_COLORS.grass;
    return minimapMaterialHex(MINIMAP_TERRAIN_MATERIALS[terrain] || 'grass', fallback);
  }
  function minimapColor(matName, fallbackCss) {
    const fallback = minimapCssToHex(fallbackCss, 0x9ec74b);
    return minimapHexToCss(minimapThemeHex(minimapMaterialHex(matName, fallback)));
  }
  function minimapThemeCss(css) {
    return minimapHexToCss(minimapThemeHex(minimapCssToHex(css, 0x9ec74b)));
  }
  var minimapRepaintQueued = false;
  let minimapState = null;
  function requestMinimapRepaint() {
    if (minimapRepaintQueued) return;
    minimapRepaintQueued = true;
    requestAnimationFrame(() => { minimapRepaintQueued = false; redrawMinimap(); });
  }
  window.__requestMinimapRepaint = requestMinimapRepaint;
  function minimapViewCellCount() {
    return Math.max(GRID, Math.min(HOME_GRID_MAX, Math.ceil(renderVisibleSize || GRID)));
  }
  function minimapDrawCellCount(logicalCells) {
    return logicalCells;
  }
  function minimapGlobalCell(gx, gz) {
    const bx = Math.floor(gx / GRID);
    const bz = Math.floor(gz / GRID);
    const lx = gx - bx * GRID;
    const lz = gz - bz * GRID;
    if (lx < 0 || lx >= GRID || lz < 0 || lz >= GRID) return null;
    if ((bx !== 0 || bz !== 0) && !ghostBoardsEnabledForGrid()) {
      return world[gx] && world[gx][gz] && world[gx][gz].userEdited ? world[gx][gz] : null;
    }
    return ghostCellAt(bx, bz, lx, lz);
  }
  function minimapWorldFromCanvasPoint(px, py) {
    if (!minimapState) return null;
    const { startGx, startGz, cells, width, height } = minimapState;
    const gx = startGx + (px / Math.max(1, width)) * cells;
    const gz = startGz + (py / Math.max(1, height)) * cells;
    return { x: gx - GRID / 2, z: gz - GRID / 2 };
  }
  function redrawMinimap() {
    const canvas = document.getElementById('minimap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const N = minimapViewCellCount();
    const S = minimapDrawCellCount(N);
    const W = canvas.width, H = canvas.height;
    const cw = W / S, ch = H / S;
    const sampleStep = N / S;
    const centerGx = Math.floor(target.x + GRID / 2);
    const centerGz = Math.floor(target.z + GRID / 2);
    const startGx = centerGx - Math.floor(N / 2);
    const startGz = centerGz - Math.floor(N / 2);
    minimapState = { startGx, startGz, cells: N, width: W, height: H };
    const sizeEl = document.getElementById('minimap-size');
    if (sizeEl) sizeEl.textContent = N + '×' + N + ' map';
    ctx.clearRect(0, 0, W, H);
    // Terrain pass.
    for (let x = 0; x < S; x++) {
      for (let z = 0; z < S; z++) {
        const gx = startGx + Math.floor(x * sampleStep);
        const gz = startGz + Math.floor(z * sampleStep);
        const cell = minimapGlobalCell(gx, gz);
        const terrain = (cell && cell.terrain) || 'grass';
        let colorHex = minimapTerrainHex(terrain);
        // Tint by terrainFloors so hills/mountains read as raised.
        const tf = cell ? (cell.terrainFloors || 1) : 1;
        if (tf > 1 && terrain !== 'water' && terrain !== 'lava') {
          const shade = Math.min(0.45, (tf - 1) * 0.08);
          colorHex = minimapMixHex(colorHex, 0x000000, shade);
        }
        ctx.fillStyle = minimapHexToCss(minimapThemeHex(colorHex));
        ctx.fillRect(x * cw, z * ch, cw + 0.5, ch + 0.5);
      }
    }
    // Kind silhouettes.
    for (let x = 0; x < S; x++) {
      for (let z = 0; z < S; z++) {
        const gx = startGx + Math.floor(x * sampleStep);
        const gz = startGz + Math.floor(z * sampleStep);
        const cell = minimapGlobalCell(gx, gz);
        if (!cell || !cell.kind) continue;
        drawMinimapProp(ctx, cell.kind, x * cw + cw / 2, z * ch + ch / 2, Math.min(cw, ch));
      }
    }
    // Home-board outline plus current camera target. The map can pan across
    // preview boards, so this keeps orientation obvious when the 2D window
    // drifts away from the saved home grid.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.70)';
    ctx.lineWidth = Math.max(1, W * 0.006);
    ctx.strokeRect((0 - startGx) * cw, (0 - startGz) * ch, GRID * cw, GRID * ch);
    const tx = (target.x + GRID / 2 - startGx) * cw;
    const tz = (target.z + GRID / 2 - startGz) * ch;
    ctx.strokeStyle = 'rgba(42,39,34,0.60)';
    ctx.lineWidth = Math.max(1, W * 0.004);
    ctx.beginPath();
    ctx.arc(tx, tz, Math.max(4, Math.min(cw, ch) * 0.28), 0, Math.PI * 2);
    ctx.moveTo(tx - Math.max(5, cw * 0.45), tz);
    ctx.lineTo(tx + Math.max(5, cw * 0.45), tz);
    ctx.moveTo(tx, tz - Math.max(5, ch * 0.45));
    ctx.lineTo(tx, tz + Math.max(5, ch * 0.45));
    ctx.stroke();
    ctx.restore();
  }
  function drawMinimapProp(ctx, kind, cx, cy, size) {
    const s = size;
    ctx.lineWidth = Math.max(0.4, s * 0.04);
    if (kind === 'tree') {
      ctx.fillStyle = minimapColor('leavesDk', '#3a7a25');
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.40);
      ctx.lineTo(cx - s * 0.32, cy + s * 0.26);
      ctx.lineTo(cx + s * 0.32, cy + s * 0.26);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'house') {
      ctx.fillStyle = minimapColor('roofBlue', '#3a72c8');
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.32, cy + s * 0.28);
      ctx.lineTo(cx - s * 0.32, cy - s * 0.04);
      ctx.lineTo(cx,            cy - s * 0.34);
      ctx.lineTo(cx + s * 0.32, cy - s * 0.04);
      ctx.lineTo(cx + s * 0.32, cy + s * 0.28);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'rock') {
      ctx.fillStyle = minimapColor('rockDk', '#5e5a52');
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.30, s * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'fence') {
      ctx.fillStyle = minimapColor('fence', '#8a5a3b');
      ctx.fillRect(cx - s * 0.34, cy - s * 0.06, s * 0.68, s * 0.12);
    } else if (kind === 'bridge') {
      ctx.fillStyle = minimapColor('bridgeWood', '#8b5a32');
      ctx.fillRect(cx - s * 0.40, cy - s * 0.10, s * 0.80, s * 0.20);
    } else if (kind === 'tuft' || kind === 'flower') {
      ctx.fillStyle = kind === 'flower' ? minimapThemeCss('#d24a4f') : minimapColor('leaves', '#86b53e');
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'bush') {
      ctx.fillStyle = minimapColor('leavesDk', '#5a8d2e');
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.24, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'cow' || kind === 'sheep') {
      ctx.fillStyle = minimapThemeCss(kind === 'cow' ? '#f2eee0' : '#e8e2d2');
      ctx.strokeStyle = minimapThemeCss('#2a2722');
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.30, s * 0.20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (kind === 'crop' || kind === 'corn' || kind === 'wheat' || kind === 'pumpkin' || kind === 'carrot' || kind === 'sunflower') {
      const col = {
        crop: '#86c544', corn: '#f2c849', wheat: '#e6c354',
        pumpkin: '#e07c2a', carrot: '#e06a2a', sunflower: '#f7b730',
      }[kind] || '#86c544';
      ctx.fillStyle = minimapThemeCss(col);
      const d = s * 0.10;
      for (const [ox, oy] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
        ctx.beginPath();
        ctx.arc(cx + ox * s, cy + oy * s, d, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = minimapThemeCss('#3a3a3a');
      ctx.fillRect(cx - s * 0.20, cy - s * 0.20, s * 0.40, s * 0.40);
    }
  }

  (function wireMinimap() {
    const wrap = document.getElementById('minimap-wrap');
    const canvas = document.getElementById('minimap-canvas');
    const sizeEl = document.getElementById('minimap-size');
    const fpsEl = document.getElementById('minimap-fps');
    const autoExpandEl = document.getElementById('minimap-autoexpand');
    if (!wrap) return;
    function paintSize() {
      if (!sizeEl) return;
      const n = (typeof minimapViewCellCount === 'function') ? minimapViewCellCount() : GRID;
      sizeEl.textContent = n + '×' + n + ' map';
    }
    paintSize();
    function syncAutoExpandControl() {
      if (autoExpandEl) autoExpandEl.checked = !!renderAutoExpand;
    }
    syncAutoExpandControl();
    if (autoExpandEl) {
      // Coming Soon — keep disabled and force unchecked even if something
      // tries to programmatically toggle it.
      autoExpandEl.disabled = true;
      autoExpandEl.checked = false;
      autoExpandEl.addEventListener('change', () => {
        if (autoExpandEl.disabled) {
          autoExpandEl.checked = false;
          renderAutoExpand = false;
          try { localStorage.setItem(RENDER_LS.autoExpand, '0'); } catch (_) {}
          return;
        }
        renderAutoExpand = !!autoExpandEl.checked;
        try { localStorage.setItem(RENDER_LS.autoExpand, renderAutoExpand ? '1' : '0'); } catch (_) {}
        if (renderAutoExpand) {
          expandVisibleSizeOnFirstMove();
          ensureGhostBoardsAroundTarget();
        } else {
          hasUserPanned = false;
          renderVisibleSize = GRID;
          try { localStorage.setItem(RENDER_LS.visibleSize, String(renderVisibleSize)); } catch (_) {}
          clampTargetToHomeBoard();
          updateCamera();
          clearGhostBoardsOnly();
        }
        updateLandscapeClipBounds();
        requestMinimapRepaint();
      });
    }
    // Restore collapsed state.
    try {
      if (localStorage.getItem('tinyworld:minimap.collapsed') === '1') wrap.classList.add('collapsed');
    } catch (_) {}
    // -- draggable minimap --
    // Stored as viewport-relative top/left percentages so any viewport size
    // resolves the same, then clamped so the map never leaves the screen.
    const MINIMAP_POS_KEY = 'tinyworld:minimap.pos';
    const MINIMAP_VIEWPORT_PAD = 8;
    function clampMinimapPosition(left, top) {
      const r = wrap.getBoundingClientRect();
      const w = Math.ceil(r.width || wrap.offsetWidth || 200);
      const h = Math.ceil(r.height || wrap.offsetHeight || 200);
      const maxTop = Math.max(MINIMAP_VIEWPORT_PAD, window.innerHeight - h - MINIMAP_VIEWPORT_PAD);
      const maxLeft = Math.max(MINIMAP_VIEWPORT_PAD, window.innerWidth - w - MINIMAP_VIEWPORT_PAD);
      const nextTop = Number.isFinite(top) ? top : r.top;
      const nextLeft = Number.isFinite(left) ? left : r.left;
      return {
        top: Math.max(MINIMAP_VIEWPORT_PAD, Math.min(maxTop, nextTop)),
        left: Math.max(MINIMAP_VIEWPORT_PAD, Math.min(maxLeft, nextLeft)),
      };
    }
    function setMinimapPosition(left, top) {
      const pos = clampMinimapPosition(left, top);
      wrap.style.top = pos.top + 'px';
      wrap.style.left = pos.left + 'px';
      wrap.style.right = 'auto';
      wrap.style.bottom = 'auto';
      return pos;
    }
    function saveCurrentMinimapPos() {
      const r = wrap.getBoundingClientRect();
      const pos = setMinimapPosition(r.left, r.top);
      try {
        const W = Math.max(1, window.innerWidth);
        const H = Math.max(1, window.innerHeight);
        localStorage.setItem(MINIMAP_POS_KEY, JSON.stringify({
          topPct: +(pos.top / H).toFixed(4),
          leftPct: +(pos.left / W).toFixed(4),
        }));
      } catch (_) {}
    }
    function applyStoredMinimapPos() {
      try {
        const raw = localStorage.getItem(MINIMAP_POS_KEY);
        if (!raw) {
          const r = wrap.getBoundingClientRect();
          setMinimapPosition(r.left, r.top);
          return;
        }
        const p = JSON.parse(raw);
        // Prefer the new relative format (topPct/leftPct), fall back to legacy
        // absolute pixels so existing users don't lose their position.
        let top, left;
        if (Number.isFinite(p.topPct) && Number.isFinite(p.leftPct)) {
          top = p.topPct * window.innerHeight;
          left = p.leftPct * window.innerWidth;
        } else if (Number.isFinite(p.top) && Number.isFinite(p.left)) {
          top = p.top;
          left = p.left;
        } else {
          return;
        }
        const pos = setMinimapPosition(left, top);
        if (Math.abs(pos.top - top) > 0.5 || Math.abs(pos.left - left) > 0.5) saveCurrentMinimapPos();
      } catch (_) {
        const r = wrap.getBoundingClientRect();
        setMinimapPosition(r.left, r.top);
      }
    }
    function toggleCollapsed() {
      wrap.classList.toggle('collapsed');
      try { localStorage.setItem('tinyworld:minimap.collapsed', wrap.classList.contains('collapsed') ? '1' : '0'); } catch (_) {}
      requestAnimationFrame(() => {
        applyStoredMinimapPos();
        saveCurrentMinimapPos();
      });
    }
    const minimapToggle = document.getElementById('minimap-toggle');
    if (minimapToggle) minimapToggle.addEventListener('click', toggleCollapsed);
    // Keyboard shortcut: N toggles the minimap (matches OWB).
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'N') toggleCollapsed();
    });
    // Keep the minimap on-screen if the window is resized — re-apply the
    // SAVED relative position so the map sticks to its proportional spot.
    window.addEventListener('resize', () => {
      applyStoredMinimapPos();
    });
    let mmDrag = null;
    wrap.addEventListener('pointerdown', e => {
      // Don't hijack clicks on the canvas/buttons inside if any are added later.
      if (e.target.closest('button, a, input, select, textarea')) return;
      const r = wrap.getBoundingClientRect();
      mmDrag = {
        startX: e.clientX,
        startY: e.clientY,
        topAtStart: r.top,
        leftAtStart: r.left,
        moved: false,
      };
      try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
    });
    wrap.addEventListener('pointermove', e => {
      if (!mmDrag) return;
      const dx = e.clientX - mmDrag.startX;
      const dy = e.clientY - mmDrag.startY;
      if (!mmDrag.moved && Math.hypot(dx, dy) < 4) return;
      mmDrag.moved = true;
      wrap.classList.add('dragging');
      setMinimapPosition(mmDrag.leftAtStart + dx, mmDrag.topAtStart + dy);
    });
    function endMinimapDrag() {
      if (!mmDrag) return;
      const moved = mmDrag.moved;
      mmDrag = null;
      wrap.classList.remove('dragging');
      if (moved) {
        // Save as relative percentages so the map keeps the same proportional
        // spot across window resizes / different monitor widths.
        saveCurrentMinimapPos();
      }
    }
    wrap.addEventListener('pointerup', endMinimapDrag);
    wrap.addEventListener('pointercancel', endMinimapDrag);
    applyStoredMinimapPos();

    // -- map panning --
    // Dragging the canvas pans the world/camera target. Drag the card chrome
    // or footer if you want to move the minimap widget itself.
    let mapPan = null;
    function panWorldFromMinimapEvent(e) {
      if (!canvas || !minimapState) return;
      const r = canvas.getBoundingClientRect();
      const px = Math.max(0, Math.min(r.width, e.clientX - r.left));
      const py = Math.max(0, Math.min(r.height, e.clientY - r.top));
      const worldPoint = minimapWorldFromCanvasPoint(
        px * (canvas.width / Math.max(1, r.width)),
        py * (canvas.height / Math.max(1, r.height)),
      );
      if (!worldPoint) return;
      target.x = worldPoint.x;
      target.z = worldPoint.z;
      expandVisibleSizeOnFirstMove();
      updateCamera();
      if (renderAutoExpand) ensureGhostBoardsAroundTarget();
      requestMinimapRepaint();
    }
    if (canvas) {
      canvas.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        mapPan = { id: e.pointerId };
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
        panWorldFromMinimapEvent(e);
      });
      canvas.addEventListener('pointermove', e => {
        if (!mapPan) return;
        e.preventDefault();
        e.stopPropagation();
        panWorldFromMinimapEvent(e);
      });
      const endMapPan = e => {
        if (!mapPan) return;
        e.stopPropagation();
        mapPan = null;
      };
      canvas.addEventListener('pointerup', endMapPan);
      canvas.addEventListener('pointercancel', endMapPan);
    }
    // FPS readout — own RAF sampler so it reflects real frame time
    // regardless of whether the dev stats overlay is enabled.
    if (fpsEl) {
      const samples = [];
      let last = 0;
      function tick(now) {
        if (last) {
          samples.push(now - last);
          if (samples.length > 60) samples.shift();
        }
        last = now;
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      setInterval(() => {
        if (!samples.length) return;
        const sum = samples.reduce((a, b) => a + b, 0);
        const avg = sum / samples.length;
        const fps = avg > 0 ? (1000 / avg) : 0;
        fpsEl.textContent = Math.round(fps) + ' fps';
      }, 500);
    }
    // Repaint on grid-size change.
    window.addEventListener('tinyworld:grid-resized', paintSize);
    // First paint.
    requestMinimapRepaint();
  })();

  (function wireCrowdPanel() {
    const panel = document.getElementById('crowd-panel');
    const toggle = document.getElementById('crowd-panel-toggle');
    const handle = document.getElementById('crowd-panel-handle');
    if (!panel) return;

    // --- Collapsibility ---
    const COLLAPSED_KEY = 'tinyworld:crowd.collapsed';

    function setPanelHidden(hidden) {
      if (hidden) {
        panel.classList.add('hidden');
      } else {
        panel.classList.remove('hidden');
      }
      if (handle) {
        handle.hidden = !hidden;
      }
      try { localStorage.setItem(COLLAPSED_KEY, hidden ? '1' : '0'); } catch (_) {}
    }

    // Restore collapsed state
    try {
      const isCollapsed = localStorage.getItem(COLLAPSED_KEY) === '1';
      setPanelHidden(isCollapsed);
    } catch (_) {
      setPanelHidden(false);
    }

    if (toggle) {
      toggle.addEventListener('click', () => {
        setPanelHidden(true);
      });
    }

    if (handle) {
      handle.addEventListener('click', () => {
        setPanelHidden(false);
      });
    }

    // --- Draggability ---
    const POS_KEY = 'tinyworld:crowd.pos';

    function applyStoredPos() {
      try {
        const raw = localStorage.getItem(POS_KEY);
        if (!raw) return;
        const p = JSON.parse(raw);
        if (!Number.isFinite(p.top) || !Number.isFinite(p.left)) return;

        const w = panel.offsetWidth || 248;
        const h = panel.offsetHeight || 300;
        const top = Math.max(8, Math.min(window.innerHeight - h - 8, p.top));
        const left = Math.max(8, Math.min(window.innerWidth - w - 8, p.left));

        panel.style.top = top + 'px';
        panel.style.left = left + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';

        if (handle) {
          const handleH = handle.offsetHeight || 72;
          const handleTop = Math.max(8, Math.min(window.innerHeight - handleH - 8, top + h / 2));
          handle.style.top = handleTop + 'px';
        }
      } catch (_) {}
    }

    let drag = null;
    panel.addEventListener('pointerdown', e => {
      // Don't drag when interacting with form controls or buttons
      if (e.target.closest('button, select, input, a, textarea')) return;

      const r = panel.getBoundingClientRect();
      drag = {
        startX: e.clientX,
        startY: e.clientY,
        topAtStart: r.top,
        leftAtStart: r.left,
        moved: false,
      };
      try { panel.setPointerCapture(e.pointerId); } catch (_) {}
    });

    panel.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      panel.classList.add('dragging');

      const w = panel.offsetWidth;
      const h = panel.offsetHeight;
      const top = Math.max(8, Math.min(window.innerHeight - h - 8, drag.topAtStart + dy));
      const left = Math.max(8, Math.min(window.innerWidth - w - 8, drag.leftAtStart + dx));

      panel.style.top = top + 'px';
      panel.style.left = left + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';

      if (handle) {
        const handleH = handle.offsetHeight || 72;
        const handleTop = Math.max(8, Math.min(window.innerHeight - handleH - 8, top + h / 2));
        handle.style.top = handleTop + 'px';
      }
    });

    function endDrag() {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      panel.classList.remove('dragging');
      if (moved) {
        const r = panel.getBoundingClientRect();
        try {
          localStorage.setItem(POS_KEY, JSON.stringify({
            top: Math.round(r.top),
            left: Math.round(r.left),
          }));
        } catch (_) {}
      }
    }

    panel.addEventListener('pointerup', endDrag);
    panel.addEventListener('pointercancel', endDrag);
    applyStoredPos();

    window.addEventListener('resize', applyStoredPos);
  })();

  // -------- view-modes / time-weather / dev-mode popups --------
  // Three independent popups anchored to the top-right controls. The view
  // popup binds directly to the existing 'setCameraMode' (declared in the
  // perspective section) — we look it up via window so the wiring stays
  // order-independent. Time/weather changes are CSS-only (tod-* / weather-*
  // body classes drive #tod-tint). Dev mode delegates to toggleStatsOverlay.
  (function wireTopbarPopups() {
    const viewBtn = document.getElementById('view-modes');
    const viewPopup = document.getElementById('view-popup');
    const timeBtn = document.getElementById('time-weather');
    const timePopup = document.getElementById('time-popup');
    const devBtn = document.getElementById('dev-mode');

    function closeAllPopups() {
      if (viewPopup) viewPopup.hidden = true;
      if (timePopup) timePopup.hidden = true;
    }
    function togglePopup(el) {
      if (!el) return;
      const wasOpen = !el.hidden;
      closeAllPopups();
      el.hidden = wasOpen;
    }

    // -- view modes --
    if (viewBtn && viewPopup) {
      function paintViewActive() {
        const mode = (typeof cameraMode !== 'undefined') ? cameraMode : 'ortho';
        // 'topdown' is a virtual mode (ortho + polar≈0). Detect it so the
        // bird's-eye row stays highlighted instead of the Isometric row.
        const isTopdown = (mode === 'ortho') && (typeof polar !== 'undefined') && polar < 0.05;
        viewPopup.querySelectorAll('.view-option').forEach(opt => {
          const v = opt.getAttribute('data-view');
          let active = (v === mode);
          if (v === 'topdown') active = isTopdown;
          if (v === 'ortho')   active = (mode === 'ortho' && !isTopdown);
          opt.classList.toggle('active', active);
        });
      }
      viewBtn.addEventListener('click', e => {
        e.stopPropagation();
        paintViewActive();
        togglePopup(viewPopup);
      });
      viewPopup.addEventListener('click', e => {
        e.stopPropagation();
        const opt = e.target.closest('.view-option');
        if (!opt) return;
        const target = opt.getAttribute('data-view');
        if (typeof setCameraMode === 'function') {
          try { setCameraMode(target); } catch (err) { console.warn('[view] setCameraMode failed:', err); }
        }
        paintViewActive();
        viewPopup.hidden = true;
      });
    }

    // -- time / weather --
    const TOD_LS = 'tinyworld:tod.v1';
    const SEASON_LS = 'tinyworld:season.v1';
    const WEATHER_LS = 'tinyworld:weather.v1';
    function todClassFromMinutes(min) {
      if (min < 360 || min >= 1260) return 'tod-night'; // 21:00 - 06:00
      if (min < 480) return 'tod-dawn';                  // 06:00 - 08:00
      if (min < 1080) return 'tod-day';                  // 08:00 - 18:00
      return 'tod-dusk';                                 // 18:00 - 21:00
    }
    function isUiAfterHours(min) {
      return min >= 1080 || min < 480;
    }
    function applyUiThemeMode() {
      const mode = ['auto', 'light', 'dark'].includes(uiThemeMode) ? uiThemeMode : 'auto';
      const afterHours = isUiAfterHours(currentTodMinutes);
      // Light mode intentionally still darkens after hours: white/grey chrome
      // disappears against bright night clouds and star maps.
      const dark = mode === 'dark' || afterHours;
      document.body.dataset.uiThemeMode = mode;
      document.body.classList.toggle('ui-theme-dark', dark);
      document.body.classList.toggle('ui-theme-light', !dark);
      document.body.classList.toggle('ui-theme-after-hours', afterHours);
    }
    window.__applyUiThemeMode = applyUiThemeMode;
    function applyTod(min) {
      currentTodMinutes = min;
      document.body.classList.remove('tod-dawn','tod-day','tod-dusk','tod-night');
      document.body.classList.add(todClassFromMinutes(min));
      applyUiThemeMode();
      applyLights();
      if (typeof updateAllBuildingWindowLights === 'function') updateAllBuildingWindowLights();
      if (typeof requestMinimapRepaint === 'function') requestMinimapRepaint();
    }
    function applySeason(seasonV) {
      document.body.classList.remove('season-spring','season-summer','season-autumn','season-winter');
      const normalized = seasonV === 'fall' ? 'autumn' : seasonV;
      activeSeason = normalized;
      document.body.classList.add('season-' + normalized);
      if (typeof applySeasonFoliage === 'function') applySeasonFoliage(normalized);
      // Snow is winter-only. If the user changes to any non-winter season,
      // clear snow immediately instead of leaving impossible summer snowfall.
      if (normalized !== 'winter' && weather === 'snow') {
        weather = 'clear';
        applyWeather(weather);
        try { localStorage.setItem(WEATHER_LS, weather); } catch (_) {}
      }
      applyLights();
      if (typeof requestMinimapRepaint === 'function') requestMinimapRepaint();
    }
    function applyWeather(weatherV) {
      document.body.classList.remove('weather-clear','weather-cloudy','weather-rain','weather-storm','weather-snow');
      document.body.classList.add('weather-' + weatherV);
      if (typeof setWeatherMode === 'function') setWeatherMode(weatherV);
      applyLights();
      if (typeof requestMinimapRepaint === 'function') requestMinimapRepaint();
    }

    // Capture light defaults the first time we run so we can modulate
    // around them without losing the baseline. Then every time a tod /
    // season / weather class is applied we recompute the live values.
    // This intentionally touches only intensity + colour — no positions,
    // no shadow params, no animation state.
    let lightBase = null;
    function captureLightBase() {
      if (lightBase) return;
      if (typeof sun === 'undefined' || typeof hemi === 'undefined' || typeof ambient === 'undefined') return;
      lightBase = {
        sunI:  sun.intensity,
        sunC:  sun.color.getHex(),
        hemiI: hemi.intensity,
        hemiSky: hemi.color.getHex(),
        hemiGround: hemi.groundColor.getHex(),
        ambI:  ambient.intensity,
        ambC:  ambient.color.getHex(),
      };
      if (typeof modelStampImportAmbientFill !== 'undefined' && typeof modelStampImportDirFill !== 'undefined') {
        lightBase.modelStampAmbI = modelStampImportAmbientFill.intensity;
        lightBase.modelStampAmbC = modelStampImportAmbientFill.color.getHex();
        lightBase.modelStampDirI = modelStampImportDirFill.intensity;
        lightBase.modelStampDirC = modelStampImportDirFill.color.getHex();
      }
    }
    function lerpColor(a, b, t) {
      const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
      const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
      const r = Math.round(ar + (br - ar) * t);
      const g = Math.round(ag + (bg - ag) * t);
      const bl = Math.round(ab + (bb - ab) * t);
      return (r << 16) | (g << 8) | bl;
    }
    function todProfile(min) {
      // Smooth blend across four anchor points: 00:00 night, 07:00 dawn,
      // 13:00 day, 19:30 dusk → 23:00 back to night.  Returns multipliers
      // and colour anchors.
      const ANCHORS = [
        { t:    0, sunI: 0.18, hemiI: 0.40, sunC: 0x6f8acf, hemiSky: 0x4760a8, hemiGround: 0x2a2522 }, // deep night
        { t:  420, sunI: 0.85, hemiI: 0.80, sunC: 0xffc794, hemiSky: 0xffd9a6, hemiGround: 0x6f4b2a }, // 07:00 dawn
        { t:  780, sunI: 1.35, hemiI: 0.90, sunC: 0xffffff, hemiSky: 0xffffff, hemiGround: 0xb39879 }, // 13:00 day
        { t: 1170, sunI: 0.95, hemiI: 0.80, sunC: 0xff9966, hemiSky: 0xff8a6a, hemiGround: 0x6f4b2a }, // 19:30 dusk
        { t: 1380, sunI: 0.22, hemiI: 0.42, sunC: 0x7a8fcc, hemiSky: 0x4760a8, hemiGround: 0x2a2522 }, // 23:00 night
        { t: 1440, sunI: 0.18, hemiI: 0.40, sunC: 0x6f8acf, hemiSky: 0x4760a8, hemiGround: 0x2a2522 },
      ];
      // Find bracketing anchors.
      for (let i = 0; i < ANCHORS.length - 1; i++) {
        const a = ANCHORS[i], b = ANCHORS[i + 1];
        if (min >= a.t && min <= b.t) {
          const t = (min - a.t) / Math.max(1, (b.t - a.t));
          return {
            sunI: a.sunI + (b.sunI - a.sunI) * t,
            hemiI: a.hemiI + (b.hemiI - a.hemiI) * t,
            sunC: lerpColor(a.sunC, b.sunC, t),
            hemiSky: lerpColor(a.hemiSky, b.hemiSky, t),
            hemiGround: lerpColor(a.hemiGround, b.hemiGround, t),
          };
        }
      }
      return ANCHORS[0];
    }
    function weatherProfile(w) {
      // Returns multipliers + tint that compose with the tod profile. Rain and
      // snow use intensity as severity: low = light shower/flurries, high =
      // storm / snowstorm with darker, heavier ambience.
      const heavy = (typeof weatherHeavyFactor === 'function') ? weatherHeavyFactor() : 0;
      if (w === 'storm') return { mul: 0.28, tint: 0x3f4858, hemiMul: 0.54 };
      if (w === 'rain')   return { mul: 0.72 - 0.42 * heavy, tint: heavy > 0.65 ? 0x4f5968 : 0x6a7a90, hemiMul: 0.82 - 0.22 * heavy };
      if (w === 'snow')   return { mul: 0.86 - 0.26 * heavy, tint: 0xc8d4e0, hemiMul: 0.96 - 0.20 * heavy };
      if (w === 'cloudy') return { mul: 0.68, tint: 0xa8a8a8, hemiMul: 0.85 };
      return { mul: 1.0, tint: null, hemiMul: 1.0 };
    }
    function seasonHemiGround(s) {
      // Subtly shift the ground (hemi.groundColor) palette by season.
      if (s === 'spring') return 0xa6c768;
      if (s === 'summer') return 0xb39879;
      if (s === 'autumn') return 0xb46a2a;
      if (s === 'winter') return 0xd8dee8;
      return 0xb39879;
    }
    // Sky-colour profile for the SCENE BACKGROUND (the cream behind the
    // canvas only ever showed at the very edges before).  Anchors per
    // tod state — pure 3D scene background, not a CSS layer.
    function bgColorForTod(min) {
      const ANCHORS = [
        { t: 0,    c: 0x0c1226 }, // deep night
        { t: 420,  c: 0xf2c2a0 }, // dawn
        { t: 780,  c: 0xc7e1f4 }, // bright day
        { t: 1170, c: 0xd9784a }, // dusk
        { t: 1380, c: 0x0e1330 },
        { t: 1440, c: 0x0c1226 },
      ];
      for (let i = 0; i < ANCHORS.length - 1; i++) {
        const a = ANCHORS[i], b = ANCHORS[i + 1];
        if (min >= a.t && min <= b.t) {
          const tt = (min - a.t) / Math.max(1, (b.t - a.t));
          return lerpColor(a.c, b.c, tt);
        }
      }
      return ANCHORS[0].c;
    }
    function applyLights() {
      captureLightBase();
      if (!lightBase) { console.warn('[lights] no baseline captured'); return; }
      const tod = todProfile(todMinutes);
      const wx  = weatherProfile(weather);
      const seasonGround = seasonHemiGround(season);
      const nightFill = (todMinutes >= 1260 || todMinutes < 360)
        ? 1
        : (todMinutes >= 1080 && todMinutes < 1260)
          ? (todMinutes - 1080) / 180
          : (todMinutes >= 360 && todMinutes < 480)
            ? 1 - (todMinutes - 360) / 120
            : 0;
      try {
        sun.intensity = Math.max(0, lightBase.sunI * (tod.sunI / 1.35) * wx.mul * (1 - nightFill * 0.44));
        const moonCloud = lerpColor(tod.sunC, 0x9fb4e5, nightFill * 0.42);
        const sc = wx.tint != null ? lerpColor(moonCloud, wx.tint, 0.35) : moonCloud;
        sun.color.setHex(sc);
        const hemiBase = Math.max(0, lightBase.hemiI * (tod.hemiI / 0.90) * wx.hemiMul);
        const hemiFloor = nightFill * (0.14 + renderAmbientFill * 0.18) * wx.hemiMul;
        hemi.intensity = Math.max(hemiBase, hemiFloor);
        if (hemi.intensity > 0.75) hemi.intensity = 0.75;
        hemi.color.setHex(lerpColor(tod.hemiSky, 0xb7c8ff, nightFill * 0.30));
        hemi.groundColor.setHex(lerpColor(lerpColor(tod.hemiGround, seasonGround, 0.45), 0x3f4250, nightFill * 0.36));
        const ambBoost = (tod.sunI < 0.5) ? 1.35 : 1.0;
        ambient.intensity = Math.max(lightBase.ambI * ambBoost, nightFill * (0.075 + renderAmbientFill * 0.065));
        if (typeof modelStampImportAmbientFill !== 'undefined' && lightBase.modelStampAmbI != null) {
          const importAmbBoost = (tod.sunI < 0.5) ? 1.12 : 1.0;
          modelStampImportAmbientFill.intensity = Math.max(
            lightBase.modelStampAmbI * importAmbBoost,
            nightFill * (0.16 + renderAmbientFill * 0.10),
          );
          modelStampImportAmbientFill.color.setHex(ambient.color.getHex());
        }
        if (typeof modelStampImportDirFill !== 'undefined' && lightBase.modelStampDirI != null) {
          const importSunMul = tod.sunI / 1.35;
          const importWeatherMul = Math.max(0.55, wx.mul);
          const importFloor = nightFill * (0.18 + renderLighting * 0.20);
          modelStampImportDirFill.intensity = Math.max(
            lightBase.modelStampDirI * importSunMul * importWeatherMul,
            importFloor,
          );
          modelStampImportDirFill.color.setHex(lerpColor(sc, lightBase.modelStampDirC || 0xefefff, 0.35));
        }
        // 3D scene background — drives the colour visible past the world
        // edge.  This is what makes 'night' actually look dark instead of
        // just the canvas darkening behind a static cream backdrop.
        let bgHex = bgColorForTod(todMinutes);
        if (wx.tint != null) bgHex = lerpColor(bgHex, wx.tint, 0.30);
        if (scene && scene.background) scene.background.setHex(bgHex);
        if (renderer && renderer.setClearColor) renderer.setClearColor(bgHex, 1);
        if (typeof applyDistanceMistSettings === 'function') applyDistanceMistSettings(bgHex);
        // Drive the CSS --bg variable so the page chrome around the
        // canvas (vignette, body backdrop) follows the same colour.
        document.documentElement.style.setProperty('--bg', '#' + bgHex.toString(16).padStart(6, '0'));
        // Ink stays high contrast — flip to a light ink at night so UI text
        // remains readable on a dark backdrop.
        const isDark = (tod.sunI < 0.55);
        document.documentElement.style.setProperty('--ink', isDark ? '#f4ede0' : '#2a2722');
        document.documentElement.style.setProperty('--muted', isDark ? '#d8ccb8' : '#6f695f');
      } catch (err) { console.warn('[lights] apply failed:', err); }
    }
    window.__applyLights = applyLights;
    window.__lightBase = () => lightBase;
    function formatTime(min) {
      const h = String(Math.floor(min / 60) % 24).padStart(2, '0');
      const m = String(min % 60).padStart(2, '0');
      return h + ':' + m;
    }

    let todMinutes = currentTodMinutes;
    let season = 'summer';
    let weather = 'clear';
    try {
      const t = parseInt(localStorage.getItem(TOD_LS), 10);
      if (Number.isFinite(t)) todMinutes = Math.max(0, Math.min(1439, t));
      const s = localStorage.getItem(SEASON_LS);
      if (s && ['spring','summer','autumn','winter'].includes(s)) season = s;
      const w = localStorage.getItem(WEATHER_LS);
      if (w && ['clear','cloudy','rain','storm','snow'].includes(w)) weather = w;
    } catch (_) {}
    applyTod(todMinutes);
    applySeason(season);
    applyWeather(weather);
    const uiThemeSelect = document.getElementById('ui-theme-mode');
    if (uiThemeSelect) {
      uiThemeSelect.value = ['auto', 'light', 'dark'].includes(uiThemeMode) ? uiThemeMode : 'auto';
      uiThemeSelect.addEventListener('change', () => {
        uiThemeMode = ['auto', 'light', 'dark'].includes(uiThemeSelect.value) ? uiThemeSelect.value : 'auto';
        try { localStorage.setItem(RENDER_LS.uiTheme, uiThemeMode); } catch (_) {}
        applyUiThemeMode();
      });
    }

    // i18n language switcher. Reflects the resolved locale; changing it persists
    // the choice and reloads (reload-on-switch — see engine/i18n/i18n-core.js).
    const uiLangSelect = document.getElementById('ui-lang-mode');
    if (uiLangSelect && window.TWI18N) {
      uiLangSelect.value = window.TWI18N.locale;
      uiLangSelect.addEventListener('change', () => {
        window.TWI18N.setLocale(uiLangSelect.value);
      });
    }

    // Quick language picker in the appbar. Same reload-on-switch path as the
    // settings select; the compact trigger mirrors the resolved locale.
    const languagePicker = document.getElementById('language-picker');
    const languageTrigger = document.getElementById('language-trigger');
    const languageMenu = document.getElementById('language-menu');
    const languageCurrentFlag = document.getElementById('language-current-flag');
    const languageCurrentLabel = document.getElementById('language-current-label');
    if (languagePicker && languageTrigger && languageMenu && window.TWI18N) {
      const languageOptions = Array.from(languageMenu.querySelectorAll('.language-option'));
      const closeLanguageMenu = () => {
        languagePicker.classList.remove('open');
        languageTrigger.setAttribute('aria-expanded', 'false');
        languageMenu.hidden = true;
      };
      const focusLanguageOption = (direction) => {
        if (!languageOptions.length) return;
        const activeElement = document.activeElement;
        const currentIndex = languageOptions.indexOf(activeElement);
        const nextIndex = currentIndex < 0
          ? Math.max(0, languageOptions.findIndex(btn => btn.classList.contains('is-active')))
          : (currentIndex + direction + languageOptions.length) % languageOptions.length;
        languageOptions[nextIndex].focus({ preventScroll: true });
      };
      const openLanguageMenu = () => {
        languagePicker.classList.add('open');
        languageTrigger.setAttribute('aria-expanded', 'true');
        languageMenu.hidden = false;
        focusLanguageOption(0);
      };
      const syncLanguagePicker = () => {
        const locale = window.TWI18N.locale || 'en';
        const active = languageOptions.find(btn => btn.getAttribute('data-lang') === locale) || languageOptions[0];
        languageOptions.forEach((btn) => {
          const isActive = btn === active;
          btn.classList.toggle('is-active', isActive);
          btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
          if (isActive) btn.setAttribute('aria-current', 'true');
          else btn.removeAttribute('aria-current');
        });
        if (!active) return;
        const flag = active.querySelector('.language-flag-svg');
        const label = active.querySelector('.language-label');
        const labelText = label ? label.textContent.trim() : locale;
        if (flag && languageCurrentFlag) languageCurrentFlag.innerHTML = flag.innerHTML;
        if (languageCurrentLabel) languageCurrentLabel.textContent = labelText;
        languageTrigger.setAttribute('aria-label', 'Language: ' + labelText);
        languageTrigger.setAttribute('data-tooltip', labelText);
      };
      syncLanguagePicker();
      languageTrigger.addEventListener('click', (event) => {
        event.stopPropagation();
        if (languageMenu.hidden) openLanguageMenu();
        else closeLanguageMenu();
      });
      languageTrigger.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          openLanguageMenu();
        }
      });
      languageOptions.forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.stopPropagation();
          const nextLocale = btn.getAttribute('data-lang');
          closeLanguageMenu();
          if (nextLocale && nextLocale !== window.TWI18N.locale) {
            window.TWI18N.setLocale(nextLocale);
          }
        });
        btn.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            closeLanguageMenu();
            languageTrigger.focus({ preventScroll: true });
            return;
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            focusLanguageOption(event.key === 'ArrowDown' ? 1 : -1);
          }
        });
      });
      document.addEventListener('click', (event) => {
        if (!languagePicker.contains(event.target)) closeLanguageMenu();
      });
      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeLanguageMenu();
      });
    }

    if (timeBtn && timePopup) {
      const range = document.getElementById('time-range');
      const readout = document.getElementById('time-readout');
      const seasonPills = document.getElementById('season-pills');
      const weatherPills = document.getElementById('weather-pills');
      const intensityRange = document.getElementById('weather-intensity');
      const intensityReadout = document.getElementById('weather-intensity-readout');
      const splashesRange = document.getElementById('weather-splashes');
      const splashesReadout = document.getElementById('weather-splashes-readout');

      function paintPills() {
        if (seasonPills) seasonPills.querySelectorAll('.pill').forEach(p => {
          p.classList.toggle('active', p.getAttribute('data-season') === season);
        });
        if (weatherPills) weatherPills.querySelectorAll('.pill').forEach(p => {
          p.classList.toggle('active', p.getAttribute('data-weather') === weather);
        });
      }
      function paintReadout() {
        if (range) range.value = String(todMinutes);
        if (readout) readout.textContent = formatTime(todMinutes);
        if (intensityRange) intensityRange.value = String(Math.round(weatherIntensity * 100));
        if (intensityReadout) intensityReadout.textContent = Math.round(weatherIntensity * 100) + '%';
        if (splashesRange) splashesRange.value = String(Math.round(weatherSplashIntensity * 100));
        if (splashesReadout) splashesReadout.textContent = Math.round(weatherSplashIntensity * 100) + '%';
      }
      paintPills(); paintReadout();

      timeBtn.addEventListener('click', e => {
        e.stopPropagation();
        togglePopup(timePopup);
        paintPills(); paintReadout();
      });
      timePopup.addEventListener('click', e => e.stopPropagation());
      if (range) {
        range.addEventListener('input', () => {
          todMinutes = Math.max(0, Math.min(1439, parseInt(range.value, 10) || 0));
          applyTod(todMinutes);
          paintReadout();
          try { localStorage.setItem(TOD_LS, String(todMinutes)); } catch (_) {}
        });
      }
      if (seasonPills) {
        seasonPills.addEventListener('click', e => {
          const p = e.target.closest('.pill');
          if (!p) return;
          season = p.getAttribute('data-season');
          const previousWeather = weather;
          applySeason(season);
          paintPills();
          paintReadout();
          try { localStorage.setItem(SEASON_LS, season); } catch (_) {}
          if (weather !== previousWeather) {
            try { localStorage.setItem(WEATHER_LS, weather); } catch (_) {}
          }
        });
      }
      if (weatherPills) {
        weatherPills.addEventListener('click', e => {
          const p = e.target.closest('.pill');
          if (!p) return;
          weather = p.getAttribute('data-weather');
          if (weather === 'storm' && typeof setWeatherIntensity === 'function') {
            setWeatherIntensity(3);
          }
          if (weather === 'snow' && season !== 'winter') {
            season = 'winter';
            applySeason(season);
            try { localStorage.setItem(SEASON_LS, season); } catch (_) {}
          }
          applyWeather(weather);
          paintPills();
          paintReadout();
          try { localStorage.setItem(WEATHER_LS, weather); } catch (_) {}
        });
      }
      if (intensityRange) {
        intensityRange.addEventListener('input', () => {
          const value = Math.max(25, Math.min(300, parseInt(intensityRange.value, 10) || 25));
          if (typeof setWeatherIntensity === 'function') setWeatherIntensity(value / 100);
          applyWeather(weather);
          paintReadout();
          try { localStorage.setItem(WEATHER_INTENSITY_LS, weatherIntensity.toFixed(2)); } catch (_) {}
        });
      }
      if (splashesRange) {
        splashesRange.addEventListener('input', () => {
          const value = Math.max(0, Math.min(300, parseInt(splashesRange.value, 10) || 0));
          if (typeof setWeatherSplashIntensity === 'function') setWeatherSplashIntensity(value / 100);
          paintReadout();
          try { localStorage.setItem(WEATHER_SPLASHES_LS, weatherSplashIntensity.toFixed(2)); } catch (_) {}
        });
      }
    }

    // -- dev mode (FPS overlay reuses existing stats overlay) --
    if (devBtn) {
      function syncDevState() {
        const on = !!statsOverlay;
        devBtn.classList.toggle('on', on);
      }
      devBtn.addEventListener('click', () => {
        if (typeof toggleStatsOverlay === 'function') toggleStatsOverlay();
        syncDevState();
      });
      syncDevState();
    }

    // -- Build / Play mode --
    // PLAY mode is not Showcase: it keeps camera/play interactions available
    // while hiding and disabling build/edit surfaces.
    const BUILD_PLAY_LS = 'tinyworld:build-play-mode.v1';
    const buildPlayBtn = document.getElementById('build-play-mode');
    const buildPlayLabel = document.getElementById('build-play-mode-label');
    let playModeActive = false;

    function syncBuildPlayButton() {
      if (buildPlayBtn) {
        buildPlayBtn.classList.toggle('on', playModeActive);
        buildPlayBtn.setAttribute('aria-pressed', playModeActive ? 'true' : 'false');
        buildPlayBtn.setAttribute('aria-label', playModeActive ? 'Switch to build mode' : 'Switch to play mode');
        buildPlayBtn.setAttribute('data-tooltip', playModeActive ? 'Switch to build mode' : 'Switch to play mode');
        buildPlayBtn.title = playModeActive ? 'Switch to build mode' : 'Switch to play mode';
      }
      if (buildPlayLabel) buildPlayLabel.textContent = playModeActive ? 'Play' : 'Build';
    }

    function setPlayModeActive(on, opts = {}) {
      playModeActive = !!on;
      document.body.classList.toggle('tw-play-mode', playModeActive);
      syncBuildPlayButton();
      try { localStorage.setItem(BUILD_PLAY_LS, playModeActive ? 'play' : 'build'); } catch (_) {}
      if (playModeActive && !opts.skipEditorCleanup) {
        try {
          if (window.__tinyworldSubEdit && window.__tinyworldSubEdit.exit) window.__tinyworldSubEdit.exit();
          if (window.__tinyworldSelection && window.__tinyworldSelection.clear) window.__tinyworldSelection.clear();
          if (window.__tinyworldLayersPanel && window.__tinyworldLayersPanel.close) window.__tinyworldLayersPanel.close();
          if (typeof selectTool === 'function' && typeof DEFAULT_TOOL !== 'undefined') selectTool(DEFAULT_TOOL);
        } catch (_) {}
      }
      window.dispatchEvent(new CustomEvent('tinyworld:mode-changed', {
        detail: { mode: playModeActive ? 'play' : 'build' },
      }));
    }

    try {
      playModeActive = localStorage.getItem(BUILD_PLAY_LS) === 'play';
    } catch (_) {
      playModeActive = false;
    }
    window.__tinyworldIsPlayMode = () => playModeActive;
    window.__tinyworldMode = {
      isPlay: () => playModeActive,
      isBuild: () => !playModeActive,
      setPlay: () => setPlayModeActive(true),
      setBuild: () => setPlayModeActive(false),
      toggle: () => setPlayModeActive(!playModeActive),
    };
    if (buildPlayBtn) buildPlayBtn.addEventListener('click', () => setPlayModeActive(!playModeActive));
    setPlayModeActive(playModeActive, { skipEditorCleanup: true });

    // -- raise / lower terrain (visible buttons matching R/F keys) --
    const raiseBtn = document.getElementById('raise-terrain');
    const lowerBtn = document.getElementById('lower-terrain');
    if (raiseBtn) raiseBtn.addEventListener('click', () => {
      if (typeof window.__adjustHoverTerrainHeight === 'function') window.__adjustHoverTerrainHeight(+1);
    });
    if (lowerBtn) lowerBtn.addEventListener('click', () => {
      if (typeof window.__adjustHoverTerrainHeight === 'function') window.__adjustHoverTerrainHeight(-1);
    });

    // -- showcase mode (hide chrome + auto-orbit) --
    // Toggles a body.showcase class that hides toolbars / chrome and
    // starts a slow camera orbit driven by per-frame azimuth advance.
    const showcaseBtn = document.getElementById('showcase-mode');
    const showcaseExit = document.getElementById('showcase-exit');
    let showcaseActive = false;
    function setShowcaseActive(on) {
      showcaseActive = !!on;
      document.body.classList.toggle('showcase', showcaseActive);
      if (showcaseBtn) showcaseBtn.classList.toggle('on', showcaseActive);
      if (showcaseActive) {
        // Pop to perspective for a more cinematic angle.
        if (typeof setCameraMode === 'function' && cameraMode === 'ortho') {
          try { setCameraMode('perspective'); } catch (_) {}
        }
      }
    }
    if (showcaseBtn) {
      showcaseBtn.addEventListener('click', () => {
        setShowcaseActive(!showcaseActive);
      });
      window.__showcaseTick = (dt) => {
        if (!showcaseActive) return;
        if (typeof azimuth === 'number') {
          azimuth += dt * 0.12;
          if (typeof updateCamera === 'function') updateCamera();
        }
      };
    }
    if (showcaseExit) showcaseExit.addEventListener('click', () => setShowcaseActive(false));
    window.__exitShowcase = () => setShowcaseActive(false);

    // Outside-click + escape close.
    document.addEventListener('click', () => closeAllPopups());
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (showcaseActive) setShowcaseActive(false);
        closeAllPopups();
      }
    });
  })();

  // -------- world-name popup menu (multi-world local slots) --------
  // Maintains an array of named local slots in localStorage keyed by id.
  // The world pill title doubles as the popup trigger; the popup lets the user
  // rename the current world, switch to another, create a new one,
  // duplicate, or open the AI generation modal.  The existing single
  // autosave (STORAGE_KEY = 'tinyworld:v1') stays the source of truth for
  // the live world; each slot is a snapshot copy.
  const WORLDS_LS = {
    list: 'tinyworld:worlds.v1',
    active: 'tinyworld:worlds.active.v1',
  };
  function readWorldsMeta() {
    try {
      const raw = localStorage.getItem(WORLDS_LS.list);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (_) { return []; }
  }
  function writeWorldsMeta(list) {
    twSafeSetItem(WORLDS_LS.list, JSON.stringify(list), 'Saved worlds');
  }
  function getActiveWorldId() {
    try { return localStorage.getItem(WORLDS_LS.active) || ''; } catch (_) { return ''; }
  }
  function setActiveWorldId(id) {
    try { localStorage.setItem(WORLDS_LS.active, id || ''); } catch (_) {}
  }
  function findActiveWorld() {
    const list = readWorldsMeta();
    const id = getActiveWorldId();
    return list.find(w => w.id === id) || null;
  }
  function makeWorldId() {
    return 'w_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  }
  function snapshotCurrentState() {
    // Delegates to the canonical serializer in 29-persistence-api.js — this
    // used to be a byte-for-byte duplicate of that cell walk, which meant the
    // world was serialized twice per edit burst (once for localStorage, once
    // for the world-menu slot).
    try { return buildWorldStateObject(); } catch (_) { return null; }
  }
  function relativeTime(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return Math.floor(diff / 60_000) + 'm ago';
    if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + 'h ago';
    if (diff < 7 * 86_400_000) return Math.floor(diff / 86_400_000) + 'd ago';
    try { return new Date(ts).toLocaleDateString(); } catch (_) { return ''; }
  }

  // Asset library backup: bundle the user's custom voxel builds + saved asset
  // templates into one portable JSON file (and restore from it). This is the
  // device-independent escape hatch from localStorage-only persistence.
  function collectCustomVoxelBuilds() {
    if (typeof VOXEL_BUILD_STAMPS === 'undefined') return [];
    return VOXEL_BUILD_STAMPS.filter(s => s.custom).map(s => ({
      id: s.id, name: s.name, voxels: s.voxels, customParts: s.customParts, footprint: s.footprint,
    }));
  }
  function exportAssetLibrary() {
    const voxelBuilds = collectCustomVoxelBuilds();
    const assetTemplates = (typeof loadAssetTemplates === 'function') ? loadAssetTemplates() : [];
    const count = voxelBuilds.length + assetTemplates.length;
    if (!count) { twToast('No custom assets to export yet.', null); return; }
    twDownloadJSON('tinyworld-assets.json', {
      tinyworldAssets: 1,
      exportedAt: new Date().toISOString(),
      voxelBuilds,
      assetTemplates,
    });
    twToast('Exported ' + count + ' asset' + (count === 1 ? '' : 's') + ' → tinyworld-assets.json', 'ok');
  }
  function importAssetLibrary(bundle) {
    if (!bundle || typeof bundle !== 'object') { twToast('Not a valid asset file.', 'err'); return; }
    const builds = Array.isArray(bundle.voxelBuilds) ? bundle.voxelBuilds
      : (Array.isArray(bundle.builds) ? bundle.builds : []);
    let voxelCount = 0;
    if (builds.length && typeof importVoxelBuildPayload === 'function') {
      voxelCount = importVoxelBuildPayload(builds, 'Imported Build').length;
    }
    let tplCount = 0;
    if (Array.isArray(bundle.assetTemplates) && bundle.assetTemplates.length
        && typeof loadAssetTemplates === 'function' && typeof saveAssetTemplates === 'function') {
      saveAssetTemplates(bundle.assetTemplates.concat(loadAssetTemplates()));
      tplCount = bundle.assetTemplates.length;
    }
    if (typeof buildToolbar === 'function') { try { buildToolbar(); } catch (_) {} }
    twToast('Imported ' + voxelCount + ' build' + (voxelCount === 1 ? '' : 's')
      + ' and ' + tplCount + ' template' + (tplCount === 1 ? '' : 's') + '.',
      (voxelCount + tplCount) ? 'ok' : null);
  }
  async function importAssetLibraryViaPicker() {
    const bundle = await twPickJSONFile();
    if (bundle) importAssetLibrary(bundle);
  }

  (function wireWorldMenu() {
    const trigger = document.getElementById('world-menu-btn');
    const menu = document.getElementById('world-menu');
    const labelEl = document.getElementById('world-menu-label');
    const nameInput = document.getElementById('world-menu-name');
    const renameBtn = document.getElementById('world-menu-rename');
    const listEl = document.getElementById('world-menu-list');
    const emptyEl = document.getElementById('world-menu-empty');
    if (!trigger || !menu || !labelEl || !nameInput || !listEl) return;
    const manageBtn = menu.querySelector('[data-action="manage"]');
    const shareBtn = menu.querySelector('[data-action="share"]');
    const collaborateBtn = menu.querySelector('[data-action="collaborate"]');
    if (!window.TinyWorldAuth && manageBtn) manageBtn.hidden = true;
    if (!window.TinyWorldAuth && shareBtn) shareBtn.hidden = true;
    if (!window.TinyWorldAuth && collaborateBtn) collaborateBtn.hidden = true;

    function menuWorlds() {
      return twWorldCatalogMergedWorlds(
        twCloudMergedWorlds(readWorldsMeta(), twCloudWorldCache),
        twWorldCatalogLiveRows()
      );
    }
    function findMenuActiveWorld() {
      const activeId = getActiveWorldId();
      if (!activeId) return null;
      return menuWorlds().find(w => w.id === activeId) || findActiveWorld();
    }
    function paintLabel() {
      const active = findMenuActiveWorld();
      const name = active && active.name ? active.name : 'My world';
      labelEl.innerHTML = escapeName(name);
      nameInput.value = (active && active.name) || '';
      nameInput.placeholder = (active && active.name) || 'Untitled world';
    }
    function escapeName(s) {
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }
    function paintList() {
      const list = menuWorlds();
      const activeId = getActiveWorldId();
      listEl.innerHTML = '';
      if (list.length === 0) { emptyEl.hidden = false; return; }
      emptyEl.hidden = true;
      // Sort by updatedAt desc.
      list.forEach(w => {
        const li = document.createElement('li');
        li.className = 'world-menu-slot' + (w.id === activeId ? ' active' : '');
        li.setAttribute('data-id', w.id);
        const name = document.createElement('span');
        name.className = 'slot-name';
        name.textContent = w.name || 'Untitled';
        if (w.cloud) {
          const cloud = document.createElement('span');
          cloud.className = 'slot-cloud-badge';
          cloud.textContent = 'Cloud';
          name.appendChild(cloud);
        }
        if (w.catalog) {
          const live = document.createElement('span');
          live.className = 'slot-cloud-badge';
          live.textContent = w.local ? 'Local' : 'Live';
          name.appendChild(live);
        }
        const date = document.createElement('span');
        date.className = 'slot-date';
        date.textContent = relativeTime(w.ts);
        const del = document.createElement('button');
        del.className = 'slot-delete';
        del.setAttribute('data-tooltip', w.catalog && w.local ? 'Forget local copy' : 'Delete');
        del.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
        const canDeleteSlot = !!(w.local || w.cloud);
        if (!canDeleteSlot) {
          del.hidden = true;
          del.disabled = true;
          del.setAttribute('aria-hidden', 'true');
        } else {
          del.addEventListener('click', e => {
            e.stopPropagation();
            const cloudId = twCloudIdForSlot(w);
            const catalogKey = twWorldCatalogKeyForSlot(w);
            const next = readWorldsMeta().filter(x => {
              if (!x) return false;
              if (x.id === w.id) return false;
              if (cloudId && twCloudIdForSlot(x) === cloudId) return false;
              if (catalogKey && twWorldCatalogKeyForSlot(x) === catalogKey) return false;
              return true;
            });
            writeWorldsMeta(next);
            if (cloudId) {
              twCloudDeleteWorld(cloudId).then(result => {
                if (result && result.error && !twCloudIsUnavailable(result)) twToast(result.error, 'err');
                paintList(); paintLabel();
                if (typeof window.__tinyworldAccountWorldsRefresh === 'function') window.__tinyworldAccountWorldsRefresh();
              }).catch(err => twToast((err && err.message) || 'Delete failed.', 'err'));
            }
            if (getActiveWorldId() === w.id) setActiveWorldId('');
            paintList(); paintLabel();
          });
        }
        li.appendChild(name); li.appendChild(date); li.appendChild(del);
        li.addEventListener('click', () => loadSlot(w.id));
        listEl.appendChild(li);
      });
    }

    function leaveWorldRoomForMenuLoad() {
      try {
        const WS = window.__tinyworldWorlds;
        if (WS && typeof WS.hideDraftBar === 'function') WS.hideDraftBar();
        if (WS && typeof WS.leaveRoom === 'function') WS.leaveRoom();
      } catch (_) {}
      try {
        if (window.__tinyworldMode && typeof window.__tinyworldMode.setBuild === 'function') window.__tinyworldMode.setBuild();
      } catch (_) {}
    }

    async function loadCatalogSlot(slot) {
      const worldId = Number(slot && (slot.worldId || slot.world_id || twWorldCatalogIdFromSlotId(slot.id)));
      const slug = String((slot && (slot.worldSlug || slot.world_slug || twWorldCatalogSlugFromSlotId(slot.id))) || '').trim().toLowerCase();
      const path = Number.isInteger(worldId) && worldId > 0
        ? '/api/worlds?id=' + encodeURIComponent(String(worldId))
        : (slug ? '/api/worlds?slug=' + encodeURIComponent(slug) : '');
      if (!path) return null;
      const full = await twCloudApiCall(path, 'GET');
      if (!full || full.error || !full.world) {
        if (full && full.error && !twCloudIsUnavailable(full)) twToast(full.error, 'err');
        return null;
      }
      const state = twWorldCatalogStateFromWorld(full.world);
      if (!state) {
        twToast('World data is not available for ' + (slot.name || full.world.name || full.world.slug || 'that world') + '.', 'err');
        return null;
      }
      const localId = twWorldCatalogCacheWorldLocally(full.world) || slot.id;
      // Keep the just-loaded full row warm for the current menu render; the list
      // endpoint only returns preview data, but this preserves the name/status
      // and lets the active slot merge back to the same catalog row.
      const key = twWorldCatalogKeyForWorld(full.world);
      if (key) {
        const idx = twWorldCatalogCache.findIndex(w => twWorldCatalogKeyForWorld(w) === key);
        if (idx === -1) twWorldCatalogCache.unshift(full.world);
        else twWorldCatalogCache[idx] = Object.assign({}, twWorldCatalogCache[idx], full.world);
        twWorldCatalogCacheAt = Date.now();
      }
      return { id: localId, state };
    }

    async function loadSlot(id) {
      const slot = menuWorlds().find(w => w.id === id);
      if (!slot) return;
      try {
        let state = slot.state;
        if (!state && slot.cloudId) {
          const full = await twCloudApiCall('/api/builds?id=' + encodeURIComponent(String(slot.cloudId)), 'GET');
          if (full && full.data) {
            state = full.data;
            const localId = twCloudCacheBuildLocally(full);
            if (localId) id = localId;
          } else if (full && full.error) {
            if (!twCloudIsUnavailable(full)) twToast(full.error, 'err');
            return;
          }
        }
        if (!state && (slot.catalog || slot.worldId || slot.worldSlug)) {
          const loaded = await loadCatalogSlot(slot);
          if (!loaded) return;
          state = loaded.state;
          id = loaded.id || id;
        }
        if (state && slot.catalog) {
          const localId = twWorldCatalogCacheWorldLocally({
            id: slot.worldId,
            slug: slot.worldSlug,
            status: slot.worldStatus,
            kind: slot.worldKind,
            name: slot.name,
            gridSize: state.gridSize || GRID,
            data: state,
          });
          if (localId) id = localId;
        }
        if (state && typeof applyState === 'function') {
          leaveWorldRoomForMenuLoad();
          if (applyState(state)) {
            setActiveWorldId(id);
            try {
              if (window.__tinyworldMode && typeof window.__tinyworldMode.setBuild === 'function') window.__tinyworldMode.setBuild();
            } catch (_) {}
            paintLabel(); paintList();
            close();
          }
        }
      } catch (err) { console.warn('[world-menu] load failed:', err); }
    }

    function saveAsNew(name) {
      const state = snapshotCurrentState();
      if (!state) return;
      const id = makeWorldId();
      const list = readWorldsMeta();
      list.push({ id, name: name || ('World ' + (list.length + 1)), ts: Date.now(), state });
      writeWorldsMeta(list);
      setActiveWorldId(id);
      paintLabel(); paintList();
      twCloudQueueLocalWorldSync();
    }

    async function worldMenuAccessToken() {
      const Auth = window.TinyWorldAuth;
      if (!Auth) return null;
      try {
        const user = await Auth.getUser();
        if (user && typeof user.jwt === 'function') {
          try { return await user.jwt(); } catch (_) {}
        }
        if (user && user.token && user.token.access_token) return user.token.access_token;
      } catch (_) {}
      const m = document.cookie.match(/(?:^|; )nf_jwt=([^;]*)/);
      return m ? decodeURIComponent(m[1]) : null;
    }

    function worldMenuAbsoluteShareUrl(result) {
      if (!result) return '';
      if (result.url) return new URL(result.url, location.origin).href;
      if (result.id) return new URL('/tiny-world-builder?share=' + encodeURIComponent(result.id), location.origin).href;
      return '';
    }

    function worldMenuCollaborateUrl(result) {
      const url = worldMenuAbsoluteShareUrl(result);
      if (!url || !result || !result.id) return url;
      const u = new URL(url);
      u.searchParams.set('party', result.id);
      return u.href;
    }

    async function copyWorldMenuShareUrl(url) {
      if (!url) return false;
      try {
        await navigator.clipboard.writeText(url);
        return true;
      } catch (_) {
        window.prompt('Copy share URL', url);
        return false;
      }
    }

    async function shareCurrentWorld(options = {}) {
      if (!window.TinyWorldAuth || !window.__loggedIn) {
        close();
        if (typeof window.__openLoginModal === 'function') window.__openLoginModal('Sign in to save and share worlds');
        return;
      }
      const state = snapshotCurrentState();
      if (!state) { twToast('Could not snapshot this world.', 'err'); return; }
      const active = findMenuActiveWorld();
      const name = (nameInput.value.trim()) || (active && active.name) || 'Tiny World';
      try {
        const result = await twCloudApiCall('/api/share', 'POST', { name, data: state });
        if (!result || result.error) {
          twToast(
            twCloudIsUnavailable(result) ? 'Cloud sharing is unavailable in this Netlify session.' : ((result && result.error) || 'Share failed.'),
            twCloudIsUnavailable(result) ? 'warn' : 'err'
          );
          return;
        }
        const url = options.collaborate ? worldMenuCollaborateUrl(result) : worldMenuAbsoluteShareUrl(result);
        await copyWorldMenuShareUrl(url);
        if (options.collaborate) {
          twToast('Collaborate room starting...', 'ok');
          close();
          setTimeout(() => { location.assign(url); }, 240);
          return;
        }
        twToast('Share URL copied.', 'ok');
        close();
      } catch (err) {
        twToast((err && err.message) || 'Share failed.', 'err');
      }
    }

    function updateActiveSnapshot() {
      // Keep the active slot's snapshot fresh as the world changes.
      const id = getActiveWorldId();
      if (!id) return;
      const list = readWorldsMeta();
      const idx = list.findIndex(w => w.id === id);
      const state = snapshotCurrentState();
      if (!state) return;
      if (idx === -1) {
        const cloudId = twCloudBuildIdFromSlotId(id);
        if (!cloudId) return;
        list.push({ id, cloudId, name: 'Untitled world', ts: Date.now(), state });
        writeWorldsMeta(list);
        twCloudQueueLocalWorldSync();
        return;
      }
      const previous = twCloudStateFingerprint(list[idx].state);
      const next = twCloudStateFingerprint(state);
      if (previous && next && previous === next) return;
      list[idx].state = state;
      list[idx].ts = Date.now();
      writeWorldsMeta(list);
      if (twCloudIdForSlot(list[idx])) twCloudQueueLocalWorldSync();
    }

    let activeSnapshotTimer = null;
    function queueActiveSnapshotUpdate() {
      clearTimeout(activeSnapshotTimer);
      activeSnapshotTimer = setTimeout(() => {
        activeSnapshotTimer = null;
        updateActiveSnapshot();
      }, 800);
    }

    function renameActive(name) {
      const id = getActiveWorldId();
      const list = readWorldsMeta();
      const idx = list.findIndex(w => w.id === id);
      if (idx === -1) {
        // No active world yet — create one with this name.
        saveAsNew(name);
        return;
      }
      list[idx].name = name;
      list[idx].ts = Date.now();
      writeWorldsMeta(list);
      paintLabel(); paintList();
      twCloudQueueLocalWorldSync();
    }

    function open() {
      paintLabel(); paintList();
      twWorldCatalogLoad(false).then(() => {
        if (!menu.hidden) { paintLabel(); paintList(); }
      }).catch(err => console.warn('[world-catalog] menu refresh failed:', err));
      if (twCloudLoggedIn()) {
        twCloudLoadWorlds(false).then(() => {
          if (!menu.hidden) { paintLabel(); paintList(); }
        }).catch(err => console.warn('[cloud-worlds] menu refresh failed:', err));
      }

      const r = trigger.getBoundingClientRect();
      const menuWidth = menu.offsetWidth || 340;
      const menuHeight = menu.offsetHeight || 420; // approximate before measuring

      // Horizontal: keep fully on screen
      let left = r.left;
      if (left + menuWidth > window.innerWidth - 12) {
        left = window.innerWidth - menuWidth - 12;
      }
      left = Math.max(12, left);
      menu.style.left = left + 'px';

      // Vertical: prefer below trigger, but flip above if not enough space
      const spaceBelow = window.innerHeight - r.bottom - 12;
      const spaceAbove = r.top - 12;

      menu.style.top = 'auto';
      menu.style.bottom = 'auto';

      if (spaceBelow >= menuHeight || spaceBelow > spaceAbove) {
        // Open downward
        menu.style.top = (r.bottom + 8) + 'px';
      } else {
        // Open upward
        menu.style.bottom = (window.innerHeight - r.top + 8) + 'px';
      }

      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    }
    function close() {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }
    function toggle() { if (menu.hidden) open(); else close(); }

    trigger.addEventListener('click', e => { e.stopPropagation(); toggle(); });
    menu.addEventListener('click', e => { e.stopPropagation(); });
    document.addEventListener('click', () => { if (!menu.hidden) close(); });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !menu.hidden) { close(); }
    });

    menu.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        if (action === 'new') {
          const clearBtn = document.getElementById('clear');
          if (clearBtn) clearBtn.click();
          setActiveWorldId('');
          paintLabel(); paintList();
        } else if (action === 'duplicate') {
          const active = findMenuActiveWorld();
          const baseName = (active && active.name) || 'World';
          saveAsNew(baseName + ' (copy)');
        } else if (action === 'generate') {
          if (typeof openGenerateModal === 'function') openGenerateModal();
          else { const g = document.getElementById('generate'); if (g) g.click(); }
          close();
        } else if (action === 'save-as') {
          const name = (nameInput.value.trim()) || ('World ' + (readWorldsMeta().length + 1));
          saveAsNew(name);
        } else if (action === 'share') {
          shareCurrentWorld();
        } else if (action === 'collaborate') {
          shareCurrentWorld({ collaborate: true });
        } else if (action === 'manage') {
          const acc = document.getElementById('account-btn');
          if (acc) acc.click();
          close();
        }
      });
    });

    if (renameBtn) {
      renameBtn.addEventListener('click', () => {
        const v = nameInput.value.trim();
        if (!v) return;
        renameActive(v);
      });
    }
    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); renameBtn && renameBtn.click(); }
    });

    // Cheap live update — periodically refresh the active slot snapshot
    // (every 5s) so the popup list reflects the user's current world.
    window.addEventListener('tinyworld:world-changed', queueActiveSnapshotUpdate);
    setInterval(updateActiveSnapshot, 5000);

    paintLabel();
    window.__tinyworldWorldMenuRefresh = () => {
      paintLabel();
      paintList();
    };
  })();

  // -------- command palette (⌘K) --------
  // Indexes tools, top-bar buttons, and settings tabs into a fuzzy-search
  // overlay. Selection routes through existing wiring (selectTool / .click()
  // on the underlying DOM nodes) so the palette stays a thin shortcut —
  // never duplicates business logic.
  (function wireCommandPalette() {
    const overlay = document.getElementById('palette-overlay');
    const input = document.getElementById('palette-search');
    const results = document.getElementById('palette-results');
    if (!overlay || !input || !results) return;

    function topBtnAction(id) {
      return () => {
        const el = document.getElementById(id);
        if (el && !el.hidden) el.click();
      };
    }
    function settingsTab(name) {
      return () => {
        const btn = document.getElementById('render-settings');
        if (btn) btn.click();
        // After modal opens, switch the tab.
        requestAnimationFrame(() => {
          const tab = document.querySelector('.settings-tab[data-settings-tab="' + name + '"]');
          if (tab) tab.click();
        });
      };
    }
    function shortcutLabel(shortcut) {
      if (!shortcut) return '';
      return shortcut.length === 1 ? shortcut.toUpperCase() : shortcut;
    }

    function buildEntries() {
      const items = [];
      // Tools (skip auto/hidden)
      try {
        if (Array.isArray(TOOLS)) {
          for (const t of TOOLS) {
            if (t.hidden) continue;
            const group = (t.group === 'tools') ? 'Tools'
                       : (t.group === 'terrain') ? 'Terrain'
                       : (t.group === 'build')   ? 'Build'
                       : (t.group === 'nature')  ? 'Nature'
                       : (t.group === 'crops')   ? 'Crops'
                       : 'Tools';
            items.push({
              group,
              label: 'Select ' + (t.label || t.id),
              hint: t.kind ? ('place ' + t.kind) : (t.terrain ? ('paint ' + t.terrain) : ''),
              kbd: shortcutLabel(t.shortcut),
              swatch: t.color || null,
              run: () => { try { selectTool(t); } catch (_) {} },
            });
          }
        }
      } catch (_) {}
      // Top-bar buttons
      items.push({ group: 'Camera', label: 'Toggle perspective', hint: 'orbit vs orthographic', kbd: 'P', run: topBtnAction('persp') });
      items.push({ group: 'Camera', label: 'Pick camera view…', hint: 'top-down / perspective / first-person', run: topBtnAction('view-modes') });
      items.push({ group: 'Camera', label: 'Center on home grid', hint: 'frame the home board', kbd: 'H', run: topBtnAction('home') });
      // Terrain — raise/lower the hovered cell
      items.push({ group: 'Terrain', label: 'Raise terrain at cursor', hint: 'terrainFloors +1 (max 8)', kbd: 'R', run: () => {
        if (typeof window.__adjustHoverTerrainHeight === 'function') window.__adjustHoverTerrainHeight(+1);
      } });
      items.push({ group: 'Terrain', label: 'Lower terrain at cursor', hint: 'terrainFloors -1 (min 1)', kbd: 'F', run: () => {
        if (typeof window.__adjustHoverTerrainHeight === 'function') window.__adjustHoverTerrainHeight(-1);
      } });
      // Scene
      items.push({ group: 'Scene', label: 'Time & weather…', hint: 'tint, season, weather', run: topBtnAction('time-weather') });
      items.push({ group: 'Scene', label: 'Toggle developer overlay', hint: 'FPS / draws / tris', kbd: '`', run: topBtnAction('dev-mode') });
      items.push({ group: 'World', label: 'Generate Canyon Landscape…', hint: 'infinite terraced canyon procedural mesh', run: () => {
        const btn = document.getElementById('ai-generate');
        if (btn) btn.click();
        requestAnimationFrame(() => {
          const proceduralEl = document.getElementById('gen-procedural');
          if (proceduralEl) {
            proceduralEl.checked = true;
            proceduralEl.dispatchEvent(new Event('change'));
          }
          const useLandscapeEl = document.getElementById('gen-use-landscape');
          if (useLandscapeEl) {
            useLandscapeEl.checked = true;
            useLandscapeEl.dispatchEvent(new Event('change'));
          }
        });
      } });
      items.push({ group: 'World', label: 'Reset world', hint: 'back to the starter scene', run: topBtnAction('reset') });
      items.push({ group: 'World', label: 'Clear to grass', hint: 'wipe to empty grass', run: topBtnAction('clear') });
      items.push({ group: 'Assets', label: 'Export assets to file', hint: 'back up custom voxel builds + templates as JSON', run: () => exportAssetLibrary() });
      items.push({ group: 'Assets', label: 'Import assets from file', hint: 'restore custom builds + templates from a .json', run: () => importAssetLibraryViaPicker() });
      items.push({ group: 'World', label: 'Clear all sky-islands', hint: 'remove every editable island (keeps the home world)', run: () => {
        if (typeof clearEditableIslands === 'function') {
          clearEditableIslands();
          if (typeof saveState === 'function') saveState();
          if (typeof twToast === 'function') twToast('Cleared all sky-islands.', 'ok');
        }
      } });
      items.push({ group: 'World', label: 'Run vehicle seed demo', hint: 'map + cars + targets from ' + VEHICLE_DEMO_DEFAULT_SEED, run: () => {
        runSeededVehicleDemo(VEHICLE_DEMO_DEFAULT_SEED);
      } });
      items.push({ group: 'World', label: 'Run large vehicle stress demo', hint: '20×20 roads, bridges, cul-de-sacs, 36 cars', run: () => {
        runSeededVehicleDemo(VEHICLE_DEMO_LARGE_SEED, {
          variant: 'large',
          size: VEHICLE_DEMO_LARGE_SIZE_DEFAULT,
          carCount: VEHICLE_DEMO_LARGE_CARS_DEFAULT,
        });
      } });
      items.push({ group: 'World', label: 'Run 50 island stress demo', hint: 'duplicate sky-island LOD + stats overlay', run: () => {
        runIslandStressDemo(ISLAND_STRESS_DEFAULT_COUNT, { stats: true });
      } });
      items.push({ group: 'World', label: 'Copy vehicle seed demo URL', hint: 'shareable cars-on-roads seed', run: async () => {
        const variant = activeVehicleDemoVariant === 'large' ? 'large' : 'standard';
        const url = vehicleDemoShareUrl(activeVehicleDemoSeed || (variant === 'large' ? VEHICLE_DEMO_LARGE_SEED : VEHICLE_DEMO_DEFAULT_SEED), {
          variant,
          size: variant === 'large' ? (activeVehicleDemoSize || VEHICLE_DEMO_LARGE_SIZE_DEFAULT) : null,
          carCount: variant === 'large' ? (activeVehicleDemoCarCount || VEHICLE_DEMO_LARGE_CARS_DEFAULT) : null,
        });
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(url);
          console.info('[vehicle-demo] copied share URL', url);
        } catch (_) {
          console.info('[vehicle-demo] share URL', url);
        }
      } });
      items.push({ group: 'World', label: 'Export world as JSON', run: topBtnAction('export') });
      items.push({ group: 'World', label: 'Import world from JSON', run: topBtnAction('import') });
      items.push({ group: 'World', label: 'Start collaborate room', hint: 'shared PartyKit room link', run: () => {
        const btn = document.querySelector('#world-menu [data-action="collaborate"]');
        if (btn) btn.click();
      } });
      items.push({ group: 'World', label: 'Generate from prompt…', hint: 'AI generation panel', kbd: '⌘G', run: () => {
        if (typeof openGenerateModal === 'function') openGenerateModal();
        else topBtnAction('generate')();
      } });
      items.push({ group: 'World', label: 'Generate procedurally (offline)', hint: 'seed + biomes, no LLM', run: () => {
        try {
          const state = (typeof window.__genState === 'function') ? window.__genState() : null;
          const seed = (state && state.seed) || randomSeed();
          const gridSize = (state && state.gridSize) || GRID;
          const biomes = (state && state.biomes) || { grass: 55, forest: 20, water: 10, dirt: 10, settlement: 5 };
          const elevation = (state && state.elevation) || { plains: 55, hills: 30, mountains: 15 };
          const data = generateProceduralWorld({ seed, biomes, elevation, gridSize });
          applyState(data);
        } catch (err) { console.warn('[palette] procedural failed:', err); }
      } });
      // Settings tabs (router into the Settings modal)
      items.push({ group: 'Settings', label: 'Settings — App',          run: settingsTab('app') });
      items.push({ group: 'Settings', label: 'Settings — Rendering',    run: settingsTab('rendering') });
      items.push({ group: 'Settings', label: 'Settings — World',        run: settingsTab('world') });
      items.push({ group: 'Settings', label: 'Settings — Materials',    run: settingsTab('materials') });
      items.push({ group: 'Settings', label: 'Settings — Environment',  run: settingsTab('environment') });
      items.push({ group: 'Settings', label: 'Settings — Crowd',        run: settingsTab('crowd') });
      items.push({ group: 'Settings', label: 'Settings — AI Config',    run: settingsTab('ai') });
      if (window.TinyWorldAuth) {
        items.push({ group: 'Account', label: 'Open account / My Worlds', run: topBtnAction('account-btn') });
        items.push({ group: 'Account', label: 'Sign in', run: topBtnAction('auth-login-btn-top') });
        items.push({ group: 'Account', label: 'Sign out', run: topBtnAction('auth-logout-btn') });
      }
      return items;
    }

    let entries = [];
    let filtered = [];
    let cursor = 0;

    function fuzzyScore(q, s) {
      // Lightweight subsequence + token-prefix scorer. Returns null if no match.
      if (!q) return 1;
      const Q = q.toLowerCase();
      const S = s.toLowerCase();
      if (S.includes(Q)) return 100 + (S.startsWith(Q) ? 50 : 0) - S.length * 0.1;
      let i = 0, score = 0;
      for (const ch of Q) {
        const idx = S.indexOf(ch, i);
        if (idx === -1) return null;
        score += (idx === i ? 2 : 1);
        i = idx + 1;
      }
      return score;
    }

    function refresh() {
      const q = input.value.trim();
      filtered = entries
        .map(e => {
          const hay = e.label + ' ' + (e.hint || '') + ' ' + (e.group || '');
          const s = fuzzyScore(q, hay);
          return s == null ? null : { e, s };
        })
        .filter(Boolean)
        .sort((a, b) => b.s - a.s)
        .slice(0, 80)
        .map(x => x.e);
      cursor = 0;
      paint();
    }

    function paint() {
      if (filtered.length === 0) {
        results.innerHTML = '<div class="palette-empty">No matches.</div>';
        return;
      }
      let html = '';
      let lastGroup = null;
      // Palette entry text can derive from user-named custom stamps, so escape every
      // interpolated field and only inline a swatch that is a strict CSS color
      // (so it can't break out of the style attribute).
      const safeColor = (c) => /^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : null;
      filtered.forEach((e, i) => {
        if (e.group !== lastGroup) {
          html += '<div class="palette-group">' + escapeName(e.group) + '</div>';
          lastGroup = e.group;
        }
        const sw = safeColor(e.swatch);
        const icon = sw
          ? '<span class="swatch" style="background:' + sw + '"></span>'
          : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/></svg>';
        const hint = e.hint ? '<div class="palette-item-hint">' + escapeName(e.hint) + '</div>' : '';
        const kbd  = e.kbd  ? '<span class="palette-item-kbd">' + escapeName(e.kbd) + '</span>' : '';
        html += '<div class="palette-item' + (i === cursor ? ' active' : '') +
                '" role="option" data-i="' + i + '">' +
                '<span class="palette-item-icon">' + icon + '</span>' +
                '<div class="palette-item-body">' +
                  '<div class="palette-item-label">' + escapeName(e.label) + '</div>' + hint +
                '</div>' + kbd +
                '</div>';
      });
      results.innerHTML = html;
      const active = results.querySelector('.palette-item.active');
      if (active && typeof active.scrollIntoView === 'function') {
        active.scrollIntoView({ block: 'nearest' });
      }
    }

    function open() {
      entries = buildEntries();
      input.value = '';
      refresh();
      overlay.hidden = false;
      setTimeout(() => input.focus(), 0);
    }
    function close() { overlay.hidden = true; }
    function pick(i) {
      const e = filtered[i];
      if (!e) return;
      close();
      try { e.run(); } catch (err) { console.warn('[palette] command failed:', err); }
    }

    input.addEventListener('input', refresh);
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { close(); e.preventDefault(); return; }
      if (e.key === 'ArrowDown') { cursor = Math.min(filtered.length - 1, cursor + 1); paint(); e.preventDefault(); return; }
      if (e.key === 'ArrowUp')   { cursor = Math.max(0, cursor - 1); paint(); e.preventDefault(); return; }
      if (e.key === 'Enter')     { pick(cursor); e.preventDefault(); return; }
    });
    results.addEventListener('click', e => {
      const item = e.target.closest('.palette-item');
      if (!item) return;
      pick(Number(item.getAttribute('data-i')) || 0);
    });
    results.addEventListener('mousemove', e => {
      const item = e.target.closest('.palette-item');
      if (!item) return;
      const i = Number(item.getAttribute('data-i')) || 0;
      if (i !== cursor) {
        // Swap the active class in place — a full paint() here rebuilt the
        // 80-item list's innerHTML on every mousemove across the palette.
        cursor = i;
        const prev = results.querySelector('.palette-item.active');
        if (prev) prev.classList.remove('active');
        item.classList.add('active');
      }
    }, { passive: true });
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    window.addEventListener('keydown', e => {
      const isK = (e.key === 'k' || e.key === 'K');
      if ((e.metaKey || e.ctrlKey) && isK) {
        if (overlay.hidden) open(); else close();
        e.preventDefault();
      }
    });

    window.__openCommandPalette = open;
  })();

  (function bootPlanetLandscapeQuery() {
    const params = new URLSearchParams(window.location.search || '');
    if (!params.has('planet')) return;
    const planetRaw = params.get('planet') || '';
    const planetKey = String(planetRaw).trim().toLowerCase().replace(/[\s_-]+/g, '');
    const planetStyleKey = planetKey === 'realistic' || planetKey === 'realism' || planetKey === 'real' || planetKey === 'lowpoly' || planetKey === 'cel' || planetKey === 'toon';
    const planetFlagKey = planetKey === '1' || planetKey === 'true' || planetKey === 'yes' || planetKey === 'on' || planetKey === 'underlay' || planetKey === 'below';
    const explicitBiome = params.get('planetBiome') || params.get('biome') || params.get('environment') || '';
    const biomeRaw = explicitBiome || (planetStyleKey || planetFlagKey ? 'grassland' : planetRaw) || 'grassland';
    let styleRaw = params.get('planetStyle') || params.get('planetRender') || params.get('render') || '';
    if (!styleRaw && planetStyleKey) styleRaw = planetRaw;
    if (!styleRaw) styleRaw = 'lowpoly';
    const seedRaw = params.get('seed') || params.get('planetSeed') || 'planet-underlay';
    const dropRaw = params.get('planetDrop') || params.get('planetDistance') || params.get('landDistance') || params.get('drop');
    const planetDrop = clampPlanetLandscapeDrop(dropRaw);
    const wantsProof = params.get('planetProof') === '1' || params.get('proof') === 'planet';
    requestAnimationFrame(() => {
      const planetState = planetLandscapeStateFromSelection(seedRaw, biomeRaw, styleRaw, planetDrop);
      initPlanetLandscape(planetState);
      if (wantsProof) {
        enablePlanetLandscapeProofChrome(planetState);
        const proofConfig = {
          ...planetState,
          viewSize: params.get('planetView') || 38,
          polar: params.get('planetPolar') || 0.82,
          azimuth: params.get('planetAzimuth') || -0.78,
        };
        if (params.has('planetTargetY')) proofConfig.targetY = params.get('planetTargetY');
        applyPlanetLandscapeProofView(proofConfig);
        setTimeout(() => applyPlanetLandscapeProofView(planetState), 650);
      } else if (typeof setCameraMode === 'function') {
        setCameraMode('perspective');
      }
    });
  })();

  initAuth();

  // Global "Building windows" controls (Settings → Materials). Isolated from the
  // big render-settings apply pipeline on purpose: each control writes the
  // global WINDOW defaults (engine/world/03), persists them, and only rebuilds
  // objects when the glass SIZE changes (tint/darkness/interior/reflection are
  // read by the shader every frame, so they update live). Called from late boot.
  function setupWindowGlobalSettings() {
    const W = (typeof window !== 'undefined' && window.__tinyworldWindow) || null;
    if (!W || typeof document === 'undefined') return;
    const ratio  = document.getElementById('render-window-glass');
    const tint   = document.getElementById('render-window-tint');
    const dark   = document.getElementById('render-window-darkness');
    const bright = document.getElementById('render-window-interior');
    const refl   = document.getElementById('render-window-reflect');
    const reset  = document.getElementById('render-window-reset');
    const clamp = (n, lo, hi, d) => { n = Number(n); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
    const toHex = n => '#' + (Number(n) & 0xffffff).toString(16).padStart(6, '0');

    try {
      const saved = JSON.parse(localStorage.getItem('tinyworld:windowStyle') || 'null');
      if (saved && typeof saved === 'object') {
        ['glassRatio', 'tint', 'darkness', 'brightness', 'reflect'].forEach(k => {
          if (typeof saved[k] === 'number') W[k] = saved[k];
        });
      }
    } catch (_) {}

    function syncInputs() {
      if (ratio)  ratio.value  = String(Math.round(W.glassRatio * 100));
      if (tint)   tint.value   = toHex(W.tint);
      if (dark)   dark.value   = String(Math.round(W.darkness * 100));
      if (bright) bright.value = String(Math.round(W.brightness * 100));
      if (refl)   refl.value   = String(Math.round(W.reflect * 100));
    }
    function persist() { try { localStorage.setItem('tinyworld:windowStyle', JSON.stringify(W)); } catch (_) {} }
    function commit(rebuild) {
      persist();
      if (rebuild && typeof rebuildObjectsRender === 'function') rebuildObjectsRender();
    }

    if (ratio)  ratio.addEventListener('input',  () => { W.glassRatio = clamp(ratio.value / 100, 0.4, 0.98, 0.86); commit(true); });
    if (tint)   tint.addEventListener('input',   () => { W.tint = parseInt(String(tint.value).replace('#', ''), 16) || W.tint; commit(false); });
    if (dark)   dark.addEventListener('input',   () => { W.darkness = clamp(dark.value / 100, 0, 1, 0.04); commit(false); });
    if (bright) bright.addEventListener('input', () => { W.brightness = clamp(bright.value / 100, 0, 2, 1); commit(false); });
    if (refl)   refl.addEventListener('input',   () => { W.reflect = clamp(refl.value / 100, 0, 1, 0.5); commit(false); });
    if (reset)  reset.addEventListener('click',  () => {
      W.glassRatio = 0.86; W.tint = 0xc4d6ea; W.darkness = 0.12; W.brightness = 1.0; W.reflect = 0.5;
      syncInputs(); commit(true);
    });

    syncInputs();
    // Reflect a persisted non-default glass SIZE in already-built objects on
    // boot (shader-only params don't need a rebuild — they're read each frame).
    if (Math.abs(W.glassRatio - 0.86) > 0.001 && typeof rebuildObjectsRender === 'function') rebuildObjectsRender();
  }
