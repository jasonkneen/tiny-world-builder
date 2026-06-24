// -------- landing hero featured worlds carousel --------
// Fetches /api/worlds and renders published worlds as isometric canvas previews
// that cycle in the home hero. The preview renderer is lifted verbatim from
// engine/world/47-worlds-room.js (renderPreview + helpers) so thumbnails look
// identical to the in-app world cards.
//
// NOTE: /api/worlds requires Tinyverse auth — anonymous visitors will receive
// {worlds:[]} and the section stays hidden (same hideFeed pattern as landing-feed.js).
// This is a known constraint; a public worlds feed endpoint is needed for the
// carousel to be visible to landing-page visitors.
(function () {
  'use strict';

  // ---- preview renderer: VERBATIM lift from engine/world/47-worlds-room.js ----
  // (terrainColor, previewShade, previewCellTuple, drawPreviewDiamond,
  //  drawPreviewSide, drawPreviewObject, renderPreview)

  function terrainColor(t) {
    return t === 'water' ? '#2f6fb0' : t === 'stone' ? '#7d8794' : t === 'sand' ? '#cdb98a'
      : t === 'dirt' ? '#7a5a3a' : t === 'path' ? '#b9a06a' : t === 'lava' ? '#c0431f' : t === 'snow' ? '#e6eef6' : '#3f8f53';
  }

  var PREVIEW_PLANTS = new Set(['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower']);
  var PREVIEW_ISO_KIND_COLORS = {
    tree: '#1f6f3a',
    bush: '#2f8b49',
    rock: '#9ba8ae',
    house: '#c76e46',
    fence: '#7a4b2c',
    cow: '#f0d8b8',
    sheep: '#f7f1dc',
    stargate: '#7fe6ff',
  };

  function previewShade(hex, amt) {
    var h = String(hex || '#000000').replace('#', '');
    var n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
    var r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    var b = Math.max(0, Math.min(255, (n & 255) + amt));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function previewCellTuple(c) {
    if (!c) return null;
    if (Array.isArray(c)) return { x: c[0], z: c[1], terrain: c[2] || 'grass', kind: c[3] || '' };
    return { x: c.x, z: c.z, terrain: c.terrain || 'grass', kind: c.kind || '' };
  }

  function drawPreviewDiamond(ctx, cx, cy, hw, hh, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  function drawPreviewSide(ctx, cx, cy, hw, hh, depth, side, fill) {
    ctx.beginPath();
    if (side === 'right') {
      ctx.moveTo(cx + hw, cy);
      ctx.lineTo(cx, cy + hh);
      ctx.lineTo(cx, cy + hh + depth);
      ctx.lineTo(cx + hw, cy + depth);
    } else {
      ctx.moveTo(cx - hw, cy);
      ctx.lineTo(cx, cy + hh);
      ctx.lineTo(cx, cy + hh + depth);
      ctx.lineTo(cx - hw, cy + depth);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawPreviewObject(ctx, cx, cy, s, kind) {
    var k = PREVIEW_PLANTS.has(kind) ? 'plant' : kind;
    if (k === 'tree' || k === 'bush' || k === 'plant') {
      ctx.fillStyle = k === 'plant' ? '#d5df57' : PREVIEW_ISO_KIND_COLORS[k];
      ctx.beginPath();
      ctx.arc(cx, cy - s * 0.34, s * (k === 'tree' ? 0.22 : 0.16), 0, Math.PI * 2);
      ctx.fill();
      if (k === 'tree') {
        ctx.fillStyle = '#7b5434';
        ctx.fillRect(cx - s * 0.035, cy - s * 0.28, s * 0.07, s * 0.28);
      }
    } else if (k === 'rock') {
      ctx.fillStyle = PREVIEW_ISO_KIND_COLORS.rock;
      drawPreviewDiamond(ctx, cx, cy - s * 0.18, s * 0.16, s * 0.09, '#9ba8ae', '#65737b');
    } else if (k === 'house') {
      ctx.fillStyle = '#c76e46';
      ctx.fillRect(cx - s * 0.18, cy - s * 0.34, s * 0.36, s * 0.26);
      ctx.fillStyle = '#7b3340';
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.22, cy - s * 0.34);
      ctx.lineTo(cx, cy - s * 0.56);
      ctx.lineTo(cx + s * 0.22, cy - s * 0.34);
      ctx.closePath();
      ctx.fill();
    } else if (PREVIEW_ISO_KIND_COLORS[k]) {
      ctx.fillStyle = PREVIEW_ISO_KIND_COLORS[k];
      ctx.fillRect(cx - s * 0.08, cy - s * 0.28, s * 0.16, s * 0.16);
    }
  }

  function renderPreview(cnv, preview) {
    if (!cnv || !preview) return;
    var g = Math.max(1, preview.gridSize || 8);
    var suppliedList = Array.isArray(preview.cells) ? preview.cells : [];
    var list = suppliedList.map(previewCellTuple).filter(Boolean);
    var cssW = cnv.clientWidth || cnv.width || 320;
    var cssH = cnv.clientHeight || cnv.height || 200;
    var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    cnv.width = Math.round(cssW * dpr); cnv.height = Math.round(cssH * dpr);
    var c2 = cnv.getContext('2d');
    c2.setTransform(dpr, 0, 0, dpr, 0, 0);
    c2.clearRect(0, 0, cssW, cssH);
    var bg = c2.createLinearGradient(0, 0, 0, cssH);
    bg.addColorStop(0, '#070911');
    bg.addColorStop(1, '#030509');
    c2.fillStyle = bg;
    c2.fillRect(0, 0, cssW, cssH);
    c2.fillStyle = 'rgba(169,199,255,.22)';
    for (var i = 0; i < 26; i++) {
      var sx = (i * 47 + g * 13) % Math.max(1, cssW);
      var sy = (i * 31 + g * 7) % Math.max(1, cssH);
      c2.fillRect(sx, sy, 1, 1);
    }
    var map = new Map();
    for (var z = 0; z < g; z++) for (var x = 0; x < g; x++) map.set(x + ',' + z, { x: x, z: z, terrain: 'grass', kind: '' });
    for (var ci = 0; ci < list.length; ci++) {
      var cell = list[ci];
      var cx2 = Number(cell.x), cz2 = Number(cell.z);
      if (!Number.isFinite(cx2) || !Number.isFinite(cz2) || cx2 < 0 || cz2 < 0 || cx2 >= g || cz2 >= g) continue;
      map.set(cx2 + ',' + cz2, cell);
    }
    var tileW = Math.max(14, Math.min(30, cssW / (g + 2.4)));
    var tileH = tileW * 0.5;
    var depth = Math.max(8, tileH * 0.9);
    var originX = cssW * 0.5;
    var originY = Math.max(18, (cssH - (g * tileH + depth)) * 0.38);
    var sorted = Array.from(map.values()).sort(function (a, b) {
      return ((Number(a.x) + Number(a.z)) - (Number(b.x) + Number(b.z))) || (Number(a.z) - Number(b.z));
    });
    for (var si = 0; si < sorted.length; si++) {
      var sc = sorted[si];
      var sx2 = Number(sc.x), sz2 = Number(sc.z);
      var scx = originX + (sx2 - sz2) * tileW * 0.5;
      var scy = originY + (sx2 + sz2) * tileH * 0.5;
      var stop = terrainColor(sc.terrain);
      if (!map.has((sx2 + 1) + ',' + sz2)) drawPreviewSide(c2, scx, scy, tileW * 0.5, tileH * 0.5, depth, 'right', previewShade(stop, -62));
      if (!map.has(sx2 + ',' + (sz2 + 1))) drawPreviewSide(c2, scx, scy, tileW * 0.5, tileH * 0.5, depth, 'left', previewShade(stop, -42));
    }
    for (var di = 0; di < sorted.length; di++) {
      var dc = sorted[di];
      var dx = Number(dc.x), dz = Number(dc.z);
      var dcx = originX + (dx - dz) * tileW * 0.5;
      var dcy = originY + (dx + dz) * tileH * 0.5;
      var dtop = terrainColor(dc.terrain);
      drawPreviewDiamond(c2, dcx, dcy, tileW * 0.5, tileH * 0.5, dtop, 'rgba(3,5,9,.36)');
    }
    for (var oi = 0; oi < sorted.length; oi++) {
      var oc = sorted[oi];
      if (!oc.kind) continue;
      var ox = Number(oc.x), oz = Number(oc.z);
      var ocx = originX + (ox - oz) * tileW * 0.5;
      var ocy = originY + (ox + oz) * tileH * 0.5;
      drawPreviewObject(c2, ocx, ocy, tileW, oc.kind);
    }
  }

  // ---- carousel ----

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

  function worldHref(w) {
    var slug = String((w && w.slug) || '').trim();
    if (!slug) return '/tiny-world-builder';
    return '/tiny-world-builder?world=' + encodeURIComponent(slug);
  }

  function buildSlide(w, idx) {
    var slide = document.createElement('div');
    slide.className = 'world-carousel-slide';
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-label', String(w.name || w.slug || 'World'));
    slide.dataset.idx = String(idx);

    var cnv = document.createElement('canvas');
    cnv.className = 'world-carousel-canvas';
    // Set explicit pixel dimensions as fallback for renderPreview when slide
    // is not yet visible (clientWidth may be 0 while display:none).
    cnv.width = 320;
    cnv.height = 200;

    var info = document.createElement('div');
    info.className = 'world-carousel-info';

    var name = document.createElement('span');
    name.className = 'world-carousel-name';
    name.textContent = String(w.name || w.slug || 'World');

    var link = document.createElement('a');
    link.className = 'world-carousel-open';
    link.href = worldHref(w);
    link.textContent = 'Open world';
    link.setAttribute('aria-label', 'Open ' + String(w.name || w.slug || 'world'));

    info.appendChild(name);
    info.appendChild(link);
    slide.appendChild(cnv);
    slide.appendChild(info);

    // Render preview onto canvas. We render immediately while the slide is
    // in the DOM (the track is visible even before the section shows).
    try {
      renderPreview(cnv, w.preview);
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

  function goTo(idx, skipTimer) {
    var n = worlds.length;
    if (!n) return;
    current = ((idx % n) + n) % n;
    // Slide via CSS transform on the track
    track.style.transform = 'translateX(' + (-current * 100) + '%)';
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

    // Build slides
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

  // Keyboard nav on the track wrapper
  section.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { goTo(current - 1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { goTo(current + 1); e.preventDefault(); }
  });

  function load() {
    fetch('/api/worlds', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (res) { return res && res.ok ? res.json() : null; })
      .then(function (data) {
        var all = data && Array.isArray(data.worlds) ? data.worlds : [];
        var published = all.filter(function (w) {
          return w.status === 'published' && w.preview && Array.isArray(w.preview.cells) && w.preview.cells.length > 0;
        }).slice(0, 8);
        render(published);
      })
      .catch(hideCarousel);
  }

  hideCarousel();
  load();
})();
