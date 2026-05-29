  // -------- welcome dialog --------
  // Bump WELCOME_NOTICE_ID when the welcome content has a genuinely new
  // announcement worth re-showing to previously-dismissed users.
  const WELCOME_NOTICE_ID = '2026-05-11-jigsaw';
  const WELCOME_LS_KEY = 'tinyworld:welcome:dismissedId';
  function startFarmWorld() {
    doReset();
  }

  function startVehicleDemo() {
    // Launch a nice seeded vehicle showcase (roads + multiple cars/trucks)
    const seed = 424242;
    runSeededVehicleDemo(seed, { showBadge: true, large: false });
    if (typeof dismissWelcomeForDemo === 'function') dismissWelcomeForDemo();
  }

  function initWelcomeDialog() {
    const modal = document.getElementById('welcome-modal');
    const closeBtn = document.getElementById('welcome-close');
    const farmBtn = document.getElementById('welcome-farm');
    const vehicleBtn = document.getElementById('welcome-vehicle');
    if (!modal) return;

    const isDirectVehicleDemo = !!getVehicleDemoUrlRequest();
    const isDirectIslandStressDemo = !!getIslandStressDemoUrlRequest();

    // Show welcome unless the user came with ?demo=vehicles (direct jump to cars)
    if (!isDirectVehicleDemo && !isDirectIslandStressDemo) {
      openTinyModal(modal, farmBtn || closeBtn);
    } else {
      // Direct demo URL → auto-dismiss welcome and run the demo
      if (typeof dismissWelcomeForDemo === 'function') {
        setTimeout(dismissWelcomeForDemo, 50);
      }
    }

    function closeAndStart(startFn) {
      closeTinyModal(modal);
      if (typeof startFn === 'function') startFn();
    }

    modal.__closeModalHandler = () => closeTinyModal(modal);
    closeBtn.addEventListener('click', () => closeAndStart(startFarmWorld));

    if (farmBtn) farmBtn.addEventListener('click', () => closeAndStart(startFarmWorld));
    if (vehicleBtn) vehicleBtn.addEventListener('click', () => closeAndStart(startVehicleDemo));

    modal.addEventListener('click', e => {
      if (e.target === modal) closeAndStart(startFarmWorld);
    });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.hidden) closeAndStart(startFarmWorld);
    });
  }

  // -------- profile + saves --------
  function initAccountModal() {
    const Auth = window.TinyWorldAuth;
    const modal = document.getElementById('account-modal');
    const closeBtn = document.getElementById('account-close');
    const tabProfile = document.getElementById('tab-profile');
    const tabSaves = document.getElementById('tab-saves');
    const tabApi = document.getElementById('tab-api');
    const panelProfile = document.getElementById('panel-profile');
    const panelSaves = document.getElementById('panel-saves');
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
      if (tabApi) tabApi.classList.toggle('active', tab === 'api');
      panelProfile.hidden = tab !== 'profile';
      panelSaves.hidden   = tab !== 'saves';
      if (panelApi) panelApi.hidden = tab !== 'api';
      if (tab === 'saves') loadBuilds();
      if (tab === 'api' && typeof window.__renderApiPanel === 'function') window.__renderApiPanel();
    }
    // Initialise the API panel handlers once per account-modal lifetime.
    if (typeof window.__initApiPanel === 'function') window.__initApiPanel();
    tabProfile.addEventListener('click', () => showTab('profile'));
    tabSaves.addEventListener('click', () => showTab('saves'));
    if (tabApi) tabApi.addEventListener('click', () => showTab('api'));

    function openModal() { openTinyModal(modal, closeBtn); }
    function closeModal() { closeTinyModal(modal); }
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    async function getAccessToken() {
      const user = await Auth.getUser();
      if (!user) return null;
      if (user.token && user.token.access_token) return user.token.access_token;
      const m = document.cookie.match(/(?:^|; )nf_jwt=([^;]*)/);
      if (m) return decodeURIComponent(m[1]);
      return null;
    }

    async function apiCall(path, method, body) {
      try {
        const opts = {
          method,
          headers: { 'Content-Type': 'application/json' },
        };
        if (body) opts.body = JSON.stringify(body);
        const r = await fetch(path, opts);
        const text = await r.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch (_) {
          data = { error: text || r.statusText || ('HTTP ' + r.status) };
        }
        if (!r.ok) return data || { error: r.statusText || ('HTTP ' + r.status) };
        return data;
      } catch (err) {
        return { error: err.message || 'Network error' };
      }
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
      const list = await apiCall('/api/builds', 'GET');
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
            closeModal();
          }
        });
        const delBtn = document.createElement('button');
        delBtn.textContent = '×';
        delBtn.title = 'Delete';
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('Delete "' + b.name + '"?')) return;
          await apiCall('/api/builds?id=' + b.id, 'DELETE');
          loadBuilds();
        });
        actions.appendChild(loadBtn);
        actions.appendChild(delBtn);
        li.appendChild(info);
        li.appendChild(actions);
        savesList.appendChild(li);
      });
    }

    saveCurrent.addEventListener('click', async () => {
      if (!userProfile) { alert('Please save your profile first.'); showTab('profile'); return; }
      const name = saveName.value.trim() || ('Build ' + new Date().toLocaleDateString());
      const cells = snapshotCells();
      const data = {
        v: STORAGE_VERSION,
        gridSize: GRID,
        islands: serializeEditableIslands(),
        moorings: serializeMooringCables(),
        cells,
        cameraMode,
        toolId: selectedTool && selectedTool.id,
      };
      await apiCall('/api/builds', 'POST', { name, data });
      saveName.value = '';
      loadBuilds();
    });

    accountBtn.addEventListener('click', () => {
      openModal();
      loadProfile();
    });
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
  function initAuth() {
    const Auth = __isLocalDev() ? null : window.TinyWorldAuth;
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

    document.getElementById('auth-login-btn').dataset.label = 'Sign in';
    document.getElementById('auth-signup-btn').dataset.label = 'Create account';
    document.getElementById('auth-forgot-btn').dataset.label = 'Send reset link';
    document.getElementById('auth-reset-btn').dataset.label = 'Set new password';

    document.getElementById('auth-show-signup').addEventListener('click', () => showForm('signup'));
    document.getElementById('auth-show-forgot').addEventListener('click', () => showForm('forgot'));
    document.getElementById('auth-show-login').addEventListener('click', () => showForm('login'));
    document.getElementById('auth-back-login').addEventListener('click', () => showForm('login'));

    // Google OAuth
    document.getElementById('auth-google-login').addEventListener('click', () => Auth.oauthLogin('google'));
    document.getElementById('auth-google-signup').addEventListener('click', () => Auth.oauthLogin('google'));

    // Show Google buttons if the provider is enabled
    Auth.getSettings().then(settings => {
      if (settings && settings.providers && settings.providers.google) {
        document.getElementById('auth-oauth-login').hidden = false;
        document.getElementById('auth-oauth-signup').hidden = false;
      }
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
      bootApp();
      initAccountModal();
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
      try {
        await Auth.logout();
      } catch (_) {}
      setLoggedInState(false);
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
    twPerfMark('boot:welcome-ready');
    // Kick off PNG icon loading before the toolbar builds so buttons blit
    // bitmaps instead of spinning up the WebGL thumbnail renderer.
    preloadStaticIcons();
    buildToolbar();
    twPerfMark('boot:toolbar-built');
    selectTool(DEFAULT_TOOL);
    twPerfMark('boot:default-tool-selected');
    if (!loadState()) {
      twPerfMark('boot:load-state-empty');
      loadInitialScene();
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
    grass: 0x9ec74b,
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
    function toggleCollapsed() {
      wrap.classList.toggle('collapsed');
      try { localStorage.setItem('tinyworld:minimap.collapsed', wrap.classList.contains('collapsed') ? '1' : '0'); } catch (_) {}
    }
    const minimapToggle = document.getElementById('minimap-toggle');
    if (minimapToggle) minimapToggle.addEventListener('click', toggleCollapsed);
    // Keyboard shortcut: N toggles the minimap (matches OWB).
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'N') toggleCollapsed();
    });

    // -- draggable minimap --
    // Stored as top/left offsets so any viewport size resolves the same.
    const MINIMAP_POS_KEY = 'tinyworld:minimap.pos';
    function applyStoredMinimapPos() {
      try {
        const raw = localStorage.getItem(MINIMAP_POS_KEY);
        if (!raw) return;
        const p = JSON.parse(raw);
        const w = wrap.offsetWidth || 200;
        const h = wrap.offsetHeight || 200;
        const maxTop = Math.max(8, window.innerHeight - h - 8);
        const maxLeft = Math.max(8, window.innerWidth - w - 8);
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
        top = Math.max(8, Math.min(maxTop, top));
        left = Math.max(8, Math.min(maxLeft, left));
        wrap.style.top = top + 'px';
        wrap.style.left = left + 'px';
        wrap.style.right = 'auto';
        wrap.style.bottom = 'auto';
      } catch (_) {}
    }
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
      const w = wrap.offsetWidth;
      const h = wrap.offsetHeight;
      const top = Math.max(8, Math.min(window.innerHeight - h - 8, mmDrag.topAtStart + dy));
      const left = Math.max(8, Math.min(window.innerWidth - w - 8, mmDrag.leftAtStart + dx));
      wrap.style.top = top + 'px';
      wrap.style.left = left + 'px';
      wrap.style.right = 'auto';
      wrap.style.bottom = 'auto';
    });
    function endMinimapDrag() {
      if (!mmDrag) return;
      const moved = mmDrag.moved;
      mmDrag = null;
      wrap.classList.remove('dragging');
      if (moved) {
        const r = wrap.getBoundingClientRect();
        // Save as relative percentages so the map keeps the same proportional
        // spot across window resizes / different monitor widths.
        try {
          const W = Math.max(1, window.innerWidth);
          const H = Math.max(1, window.innerHeight);
          localStorage.setItem(MINIMAP_POS_KEY, JSON.stringify({
            topPct: +(r.top / H).toFixed(4),
            leftPct: +(r.left / W).toFixed(4),
          }));
        } catch (_) {}
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
      clampTargetToHomeBoard();
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
    function applyTod(min) {
      currentTodMinutes = min;
      document.body.classList.remove('tod-dawn','tod-day','tod-dusk','tod-night');
      document.body.classList.add(todClassFromMinutes(min));
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
      try {
        sun.intensity = Math.max(0, lightBase.sunI * (tod.sunI / 1.35) * wx.mul);
        const sc = wx.tint != null ? lerpColor(tod.sunC, wx.tint, 0.35) : tod.sunC;
        sun.color.setHex(sc);
        hemi.intensity = Math.max(0, lightBase.hemiI * (tod.hemiI / 0.90) * wx.hemiMul);
        if (hemi.intensity > 0.75) hemi.intensity = 0.75;
        hemi.color.setHex(tod.hemiSky);
        hemi.groundColor.setHex(lerpColor(tod.hemiGround, seasonGround, 0.45));
        const ambBoost = (tod.sunI < 0.5) ? 1.6 : 1.0;
        ambient.intensity = Math.max(0, lightBase.ambI * ambBoost);
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
        // Ink stays high contrast — flip to a light ink at night so the
        // brand title remains readable on a dark backdrop.
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
  // The brand title doubles as the popup trigger; the popup lets the user
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
    try { localStorage.setItem(WORLDS_LS.list, JSON.stringify(list)); } catch (_) {}
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
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
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
    if (!window.TinyWorldAuth && manageBtn) manageBtn.hidden = true;

    function paintLabel() {
      const active = findActiveWorld();
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
      const list = readWorldsMeta();
      const activeId = getActiveWorldId();
      listEl.innerHTML = '';
      if (list.length === 0) { emptyEl.hidden = false; return; }
      emptyEl.hidden = true;
      // Sort by updatedAt desc.
      list.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)).forEach(w => {
        const li = document.createElement('li');
        li.className = 'world-menu-slot' + (w.id === activeId ? ' active' : '');
        li.setAttribute('data-id', w.id);
        const name = document.createElement('span');
        name.className = 'slot-name';
        name.textContent = w.name || 'Untitled';
        const date = document.createElement('span');
        date.className = 'slot-date';
        date.textContent = relativeTime(w.ts);
        const del = document.createElement('button');
        del.className = 'slot-delete';
        del.setAttribute('data-tooltip', 'Delete');
        del.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
        del.addEventListener('click', e => {
          e.stopPropagation();
          const next = readWorldsMeta().filter(x => x.id !== w.id);
          writeWorldsMeta(next);
          if (getActiveWorldId() === w.id) setActiveWorldId('');
          paintList(); paintLabel();
        });
        li.appendChild(name); li.appendChild(date); li.appendChild(del);
        li.addEventListener('click', () => loadSlot(w.id));
        listEl.appendChild(li);
      });
    }

    function loadSlot(id) {
      const slot = readWorldsMeta().find(w => w.id === id);
      if (!slot || !slot.state) return;
      try {
        if (typeof applyState === 'function' && applyState(slot.state)) {
          setActiveWorldId(id);
          paintLabel(); paintList();
          close();
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
    }

    function updateActiveSnapshot() {
      // Keep the active slot's snapshot fresh as the world changes.
      const id = getActiveWorldId();
      if (!id) return;
      const list = readWorldsMeta();
      const idx = list.findIndex(w => w.id === id);
      if (idx === -1) return;
      list[idx].state = snapshotCurrentState();
      list[idx].ts = Date.now();
      writeWorldsMeta(list);
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
    }

    function open() {
      paintLabel(); paintList();

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
          const active = findActiveWorld();
          const baseName = (active && active.name) || 'World';
          saveAsNew(baseName + ' (copy)');
        } else if (action === 'generate') {
          if (typeof openGenerateModal === 'function') openGenerateModal();
          else { const g = document.getElementById('generate'); if (g) g.click(); }
          close();
        } else if (action === 'save-as') {
          const name = (nameInput.value.trim()) || ('World ' + (readWorldsMeta().length + 1));
          saveAsNew(name);
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
    setInterval(updateActiveSnapshot, 5000);

    paintLabel();
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
        items.push({ group: 'Account', label: 'Open account / My Builds', run: topBtnAction('account-btn') });
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
      filtered.forEach((e, i) => {
        if (e.group !== lastGroup) {
          html += '<div class="palette-group">' + e.group + '</div>';
          lastGroup = e.group;
        }
        const icon = e.swatch
          ? '<span class="swatch" style="background:' + e.swatch + '"></span>'
          : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/></svg>';
        const hint = e.hint ? '<div class="palette-item-hint">' + e.hint + '</div>' : '';
        const kbd  = e.kbd  ? '<span class="palette-item-kbd">' + e.kbd + '</span>' : '';
        html += '<div class="palette-item' + (i === cursor ? ' active' : '') +
                '" role="option" data-i="' + i + '">' +
                '<span class="palette-item-icon">' + icon + '</span>' +
                '<div class="palette-item-body">' +
                  '<div class="palette-item-label">' + e.label + '</div>' + hint +
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
      if (i !== cursor) { cursor = i; paint(); }
    });
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
