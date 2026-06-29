// -------- Tinyverse auth gate (card_reveal + standalone surfaces) --------
(function () {
  'use strict';

  const WALLET_KEY = 'tinyworld:auth:wallet-session.v1';
  const TINYVERSE_ALLOWLIST = new Set([
    'jason@bouncingfish.com',
    'simongarthfarmer@gmail.com',
  ]);

  let authEvalTimer = null;
  let authEvalInFlight = null;
  let authBootWaited = false;
  let gateUnlocked = false;
  let uiControlsWired = false;

  function isLocalDevHost() {
    const host = window.location.hostname;
    return window.location.protocol === 'file:'
      || host === 'localhost'
      || host === '127.0.0.1'
      || host === '[::1]'
      || host.endsWith('.local');
  }

  function isPreviewTest() {
    return location.hostname.includes('mmo-preview');
  }

  function getTestUser() {
    if (!isPreviewTest()) return null;
    try {
      const email = localStorage.getItem('tw:test-user-email');
      if (!email) return null;
      return {
        email,
        loggedIn: localStorage.getItem('tw:test-user-logged') === '1',
      };
    } catch (_) {
      return null;
    }
  }

  function cookieToken() {
    try {
      const m = document.cookie.match(/(?:^|; )nf_jwt=([^;]*)/);
      return m ? decodeURIComponent(m[1]) : '';
    } catch (_) {
      return '';
    }
  }

  function walletToken() {
    try {
      return localStorage.getItem(WALLET_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  async function getUserEmail() {
    const test = getTestUser();
    if (test && test.loggedIn && test.email) {
      return String(test.email).trim().toLowerCase();
    }
    const Auth = window.TinyWorldAuth;
    if (Auth && typeof Auth.getUser === 'function') {
      try {
        const user = await Auth.getUser();
        if (user && user.email) return String(user.email).trim().toLowerCase();
      } catch (_) {}
    }
    return '';
  }

  async function accessToken() {
    const Auth = window.TinyWorldAuth;
    if (Auth && typeof Auth.getUser === 'function') {
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
    return walletToken() || cookieToken() || '';
  }

  async function isLoggedIn() {
    const test = getTestUser();
    if (test && test.loggedIn) return true;
    const Auth = window.TinyWorldAuth;
    if (Auth && typeof Auth.getUser === 'function') {
      try {
        const user = await Auth.getUser();
        if (user) return true;
      } catch (_) {}
    }
    return !!(await accessToken());
  }

  function clientAllowlisted(email) {
    const e = String(email || '').trim().toLowerCase();
    return !!e && TINYVERSE_ALLOWLIST.has(e);
  }

  async function tinyverseAllowed() {
    const test = getTestUser();
    if (test && test.loggedIn) return true;
    try {
      const token = await accessToken();
      if (!token) return null;
      const res = await fetch('/api/admin-users?action=tinyverse-access', {
        headers: { Authorization: 'Bearer ' + token },
        credentials: 'same-origin',
      });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      const data = await res.json();
      return !!(data && data.allowed === true);
    } catch (_) {
      return null;
    }
  }

  async function ensureAuthBoot() {
    if (authBootWaited) return;
    authBootWaited = true;
    if (!window.__tinyworldAuthReady) return;
    try {
      await Promise.race([
        window.__tinyworldAuthReady,
        new Promise(function (resolve) { setTimeout(resolve, 4000); }),
      ]);
    } catch (_) {}
  }

  async function evaluate() {
    await ensureAuthBoot();
    // Match builder local preview: pack economy is localStorage-only on dev hosts.
    if (isLocalDevHost()) return { ok: true };
    if (!(await isLoggedIn())) return { ok: false, reason: 'login' };
    const allowed = await tinyverseAllowed();
    if (allowed === true) return { ok: true };
    if (allowed === false) return { ok: false, reason: 'access' };
    const email = await getUserEmail();
    if (clientAllowlisted(email)) return { ok: true };
    if (isLocalDevHost() && email) return { ok: true };
    if (isLocalDevHost() && getTestUser()?.loggedIn) return { ok: true };
    return { ok: false, reason: email ? 'access' : 'login' };
  }

  function overlayEl() {
    return document.getElementById('tinyverse-auth-gate');
  }

  function titleEl() {
    return document.getElementById('tinyverse-auth-gate-title');
  }

  function bodyEl() {
    return document.getElementById('tinyverse-auth-gate-body');
  }

  function syncChrome() {
    if (window.TinyverseChrome && typeof window.TinyverseChrome.syncAuthChrome === 'function') {
      window.TinyverseChrome.syncAuthChrome();
    }
  }

  function showBlocker(reason) {
    const overlay = overlayEl();
    const title = titleEl();
    const body = bodyEl();
    document.body.classList.add('tinyverse-gate-locked');
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.add('show');
    }
    if (reason === 'access') {
      if (title) title.textContent = 'Tinyverse is coming soon';
      if (body) body.textContent = 'Your account is signed in, but Tinyverse collectibles are invite-only right now. Enter from the builder welcome screen once access is enabled.';
    } else {
      if (title) title.textContent = 'Sign in to open packs';
      if (body) body.textContent = 'Tinyverse pack opening requires a signed-in account with Tinyverse access. Sign in to continue, or return to the builder.';
    }
    syncChrome();
  }

  function hideBlocker() {
    const overlay = overlayEl();
    document.body.classList.remove('tinyverse-gate-locked');
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove('show');
    }
    syncChrome();
  }

  function loginReturnPath() {
    try {
      const path = window.location.pathname + window.location.search;
      if (path && path !== '/') return path;
    } catch (_) {}
    return '';
  }

  function openLogin(reason) {
    try {
      const qs = new URLSearchParams();
      qs.set('auth', 'login');
      const returnPath = loginReturnPath();
      if (returnPath) qs.set('return', returnPath);
      if (reason) qs.set('reason', String(reason).slice(0, 120));
      window.location.href = '/tiny-world-builder.html?' + qs.toString();
      return true;
    } catch (_) {}
    return false;
  }

  function promptLogin(reason) {
    if (typeof window.__openLoginModal === 'function') {
      window.__openLoginModal(reason || 'Sign in to continue.');
      return true;
    }
    return openLogin(reason);
  }

  function handleUnauthorized(reason) {
    if (isLocalDevHost()) return false;
    return promptLogin(reason || 'Sign in to continue.');
  }

  async function require(opts) {
    if (authEvalInFlight) return authEvalInFlight;
    authEvalInFlight = (async () => {
      const result = await evaluate();
      if (result.ok) {
        if (!gateUnlocked) hideBlocker();
        gateUnlocked = true;
        if (opts && typeof opts.onReady === 'function') opts.onReady();
        return true;
      }
      gateUnlocked = false;
      if (result.reason === 'login') {
        if (opts && typeof opts.onBlocked === 'function') opts.onBlocked(result);
        promptLogin('Sign in to open Tinyverse packs');
        return false;
      }
      showBlocker(result.reason);
      if (opts && typeof opts.onBlocked === 'function') opts.onBlocked(result);
      return false;
    })();
    try {
      return await authEvalInFlight;
    } finally {
      authEvalInFlight = null;
    }
  }

  function scheduleRequire(opts) {
    clearTimeout(authEvalTimer);
    authEvalTimer = setTimeout(function () {
      require(opts);
    }, 150);
  }

  function schedulePackRevealReady() {
    scheduleRequire({
      onReady: function () {
        if (typeof window.__tinyversePackRevealStart === 'function') {
          window.__tinyversePackRevealStart();
        }
      },
    });
  }

  function wireAuthListener() {
    const Auth = window.TinyWorldAuth;
    if (!Auth || typeof Auth.onAuthChange !== 'function' || Auth.__tvAuthGateListener) return;
    Auth.__tvAuthGateListener = true;
    Auth.onAuthChange(function (event) {
      if (event === 'token_refresh' || event === 'user_updated') return;
      schedulePackRevealReady();
    });
  }

  function wireControls() {
    if (!uiControlsWired) {
      uiControlsWired = true;
      const signInBtn = document.getElementById('tinyverse-auth-signin');
      const backBtn = document.getElementById('tinyverse-auth-back');
      if (signInBtn) {
        signInBtn.addEventListener('click', function () {
          if (!openLogin()) {
            window.location.href = '/tiny-world-builder.html';
          }
        });
      }
      if (backBtn) {
        backBtn.addEventListener('click', function () {
          window.location.href = '/tiny-world-builder.html';
        });
      }
    }
    if (!window.TinyWorldAuth && window.__tinyworldAuthReady) {
      window.__tinyworldAuthReady.then(function () {
        wireAuthListener();
        schedulePackRevealReady();
      }).catch(function () {});
      return;
    }
    wireAuthListener();
    schedulePackRevealReady();
  }

  window.TinyverseAuthGate = {
    evaluate,
    require,
    isLoggedIn,
    tinyverseAllowed,
    accessToken,
    getUserEmail,
    showBlocker,
    hideBlocker,
    openLogin,
    promptLogin,
    handleUnauthorized,
    loginReturnPath,
    wireControls,
  };
  window.__tinyworldHandleUnauthorized = handleUnauthorized;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', wireControls);
    } else {
      wireControls();
    }
  }
})();