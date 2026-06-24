// -------- home page community worlds carousel --------
// Fetches /api/home-worlds (public, unauthenticated — user-built builder worlds
// shared via the Tiny World Builder share system) and renders them as isometric
// canvas previews in a full-width strip directly under the hero. The preview
// renderer lives in scripts/world-preview.js (window.TinyWorldPreview), which
// must be loaded before this script.
// If the feed is empty or fails, the section stays hidden (hideFeed pattern).
(function () {
  'use strict';

  var section = document.getElementById('world-carousel');
  var track = document.getElementById('world-carousel-track');
  var dotsEl = document.getElementById('world-carousel-dots');
  var prevBtn = document.getElementById('world-carousel-prev');
  var nextBtn = document.getElementById('world-carousel-next');
  if (!section || !track || !dotsEl || !prevBtn || !nextBtn) return;

  function hideCarousel() {
    section.hidden = true;
  }

  var worlds = [];
  var current = 0;
  var timer = null;
  var INTERVAL = 5000;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Each share opens in the builder at /tiny-world-builder?share=<id>.
  // id is a TEXT (base64url) string — never numeric.
  function worldHref(w) {
    var id = String((w && w.id) || '').trim();
    if (!id) return '/tiny-world-builder';
    return '/tiny-world-builder?share=' + encodeURIComponent(id);
  }

  function buildSlide(w, idx) {
    var slide = document.createElement('div');
    slide.className = 'world-carousel-slide';
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-label', String(w.name || 'World'));
    slide.dataset.idx = String(idx);

    var cnv = document.createElement('canvas');
    cnv.className = 'world-carousel-canvas';
    // Explicit pixel dimensions so renderPreview works while the slide may
    // not yet be visible (clientWidth can be 0 before display:block).
    cnv.width = 280;
    cnv.height = 180;

    var info = document.createElement('div');
    info.className = 'world-carousel-info';

    var name = document.createElement('span');
    name.className = 'world-carousel-name';
    name.textContent = String(w.name || 'World');

    var link = document.createElement('a');
    link.className = 'world-carousel-open';
    link.href = worldHref(w);
    link.textContent = 'Open world';
    link.setAttribute('aria-label', 'Open ' + String(w.name || 'world'));

    info.appendChild(name);
    info.appendChild(link);
    slide.appendChild(cnv);
    slide.appendChild(info);

    // Render preview onto canvas via the shared renderer module.
    // Called synchronously (no rAF) so off-screen cards still render —
    // rAF is throttled in background tabs.
    try {
      window.TinyWorldPreview.renderPreview(cnv, w.preview);
    } catch (_) {}

    return slide;
  }

  function updateDots() {
    var dotEls = dotsEl.querySelectorAll('.world-carousel-dot');
    for (var i = 0; i < dotEls.length; i++) {
      var active = i === current;
      dotEls[i].classList.toggle('is-active', active);
      dotEls[i].setAttribute('aria-current', active ? 'true' : 'false');
    }
  }

  function cardStepPx() {
    // Advance by one card's width + gap so multi-card views scroll cleanly.
    var slide = track.querySelector('.world-carousel-slide');
    if (!slide) return 0;
    var slideW = slide.getBoundingClientRect().width || 290;
    var gap = parseFloat(getComputedStyle(track).gap) || 16;
    return slideW + gap;
  }

  function goTo(idx, skipTimer) {
    var n = worlds.length;
    if (!n) return;
    current = ((idx % n) + n) % n;
    track.style.transform = 'translateX(' + (-current * cardStepPx()) + 'px)';
    updateDots();
    if (!skipTimer) resetTimer();
  }

  function resetTimer() {
    if (timer) clearTimeout(timer);
    if (reducedMotion) return;
    timer = setTimeout(function () { goTo(current + 1); }, INTERVAL);
  }

  function render(wList) {
    if (!wList || !wList.length) { hideCarousel(); return; }
    worlds = wList;

    track.textContent = '';
    dotsEl.textContent = '';

    worlds.forEach(function (w, i) {
      track.appendChild(buildSlide(w, i));

      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'world-carousel-dot';
      dot.setAttribute('aria-label', 'Go to world ' + (i + 1));
      dot.setAttribute('aria-current', i === 0 ? 'true' : 'false');
      dot.addEventListener('click', function () { goTo(i); });
      dotsEl.appendChild(dot);
    });

    goTo(0, true);
    section.hidden = false;
    if (!reducedMotion) resetTimer();
  }

  // Pause auto-advance on hover/focus inside the carousel
  section.addEventListener('mouseenter', function () { if (timer) { clearTimeout(timer); timer = null; } });
  section.addEventListener('mouseleave', function () { if (!reducedMotion && worlds.length) resetTimer(); });
  section.addEventListener('focusin', function () { if (timer) { clearTimeout(timer); timer = null; } });
  section.addEventListener('focusout', function (e) {
    if (!section.contains(e.relatedTarget) && !reducedMotion && worlds.length) resetTimer();
  });

  prevBtn.addEventListener('click', function () { goTo(current - 1); });
  nextBtn.addEventListener('click', function () { goTo(current + 1); });

  section.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { goTo(current - 1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { goTo(current + 1); e.preventDefault(); }
  });

  function load() {
    // Community discovery feed: /api/home-worlds returns public user-built
    // worlds from world_shares — no auth required.
    fetch('/api/home-worlds', { headers: { Accept: 'application/json' } })
      .then(function (res) { return res && res.ok ? res.json() : null; })
      .then(function (data) {
        var all = data && Array.isArray(data.worlds) ? data.worlds : [];
        var ready = all.filter(function (w) {
          return w && w.preview && Array.isArray(w.preview.cells) && w.preview.cells.length > 0;
        }).slice(0, 8);
        render(ready);
      })
      .catch(hideCarousel);
  }

  hideCarousel();
  load();
})();
