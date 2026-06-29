(function tinyverseHubOnboarding() {
  const TOUR_KEY = 'tinyworld:tinyverse-hub:onboarding.v1';
  const TOUR_QUERY_KEYS = ['tour', 'onboarding', 'guide'];

  function queryValue() {
    try {
      const params = new URLSearchParams(window.location.search);
      for (const key of TOUR_QUERY_KEYS) {
        if (params.has(key)) return params.get(key) || '1';
      }
    } catch (_) {}
    return '';
  }

  function localDone() {
    try { return localStorage.getItem(TOUR_KEY) === 'done'; }
    catch (_) { return false; }
  }
  function markDone() {
    try { localStorage.setItem(TOUR_KEY, 'done'); } catch (_) {}
  }
  function resetDone() {
    try { localStorage.removeItem(TOUR_KEY); } catch (_) {}
  }

  function isElementUsable(selector) {
    const el = document.querySelector(selector);
    if (!el || el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
    const rects = el.getClientRects();
    if (!rects || !rects.length) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0;
  }

  // The hub is hidden behind the auth gate; only run once it is actually visible.
  function hubReady() {
    if (document.body.classList.contains('tinyverse-gate-locked')) return false;
    const hub = document.getElementById('tinyverseStoreHub');
    if (!hub || hub.hidden) return false;
    return isElementUsable('[data-action="open-pack"]');
  }

  function driverFactory() {
    return window.driver && window.driver.js && typeof window.driver.js.driver === 'function'
      ? window.driver.js.driver
      : null;
  }

  function step(selector, side, align, title, description) {
    return { element: selector, popover: { title, description, side, align } };
  }

  function buildSteps() {
    const raw = [
      step('[data-action="open-pack"]', 'top', 'start', 'Open a free pack',
        'Tap here to crack open a free island pack. Every pack reveals one collectible tiny world that is yours to keep.'),
      step('.tv-collection-section', 'top', 'center', 'Your islands',
        'Each world you open lands here under Your islands. Tap Visit on any of them to drop in and explore it in play mode.'),
      step('.tv-hub-activity', 'left', 'center', 'Live opens',
        'Watch packs other players crack open across the tinyverse, live, right here on the side.'),
    ];
    return raw.filter(item => isElementUsable(item.element));
  }

  let activeTour = null;
  function start(options = {}) {
    const force = !!options.force;
    if (activeTour && activeTour.isActive && activeTour.isActive()) activeTour.destroy();
    if (!force && localDone()) return false;
    if (!hubReady()) return false;
    const factory = driverFactory();
    if (!factory) return false;
    const steps = buildSteps();
    if (!steps.length) return false;
    activeTour = factory({
      steps,
      animate: true,
      allowClose: true,
      allowKeyboardControl: true,
      overlayOpacity: 0.58,
      overlayColor: '#020509',
      stagePadding: 8,
      stageRadius: 12,
      popoverOffset: 12,
      showProgress: true,
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Got it',
      popoverClass: 'tinyworld-driver-popover',
      onPopoverRender: (popover) => {
        try {
          const wrap = popover && popover.wrapper;
          if (!wrap || wrap.querySelector('.tw-tour-binky')) return;
          const img = document.createElement('img');
          img.className = 'tw-tour-binky';
          img.src = 'assets/binky_thumbs.png';
          img.alt = '';
          img.setAttribute('aria-hidden', 'true');
          wrap.appendChild(img);
        } catch (_) {}
      },
      onDestroyed: () => {
        activeTour = null;
        if (!force) markDone();
      },
    });
    activeTour.drive();
    return true;
  }

  function waitAndStart(options = {}) {
    const force = !!options.force;
    let attempts = 0;
    const tick = () => {
      attempts += 1;
      if (start(options)) return;
      if (attempts < 120 && (!localDone() || force)) window.setTimeout(tick, 300);
    };
    window.setTimeout(tick, options.delay || 800);
  }

  window.__tinyverseHubOnboarding = {
    start,
    waitAndStart,
    reset: resetDone,
    isDone: localDone,
    key: TOUR_KEY,
  };

  const requested = queryValue();
  if (requested === 'reset') resetDone();
  if (requested === '0' || requested === 'off') return;
  if (requested) waitAndStart({ force: true, delay: 600 });
  else waitAndStart({ force: false, delay: 1400 });
}());
