// -------- landing hero "Live worlds" feed --------
// Reads the public /api/worlds list (the only feed that works for anonymous
// marketing visitors — community is auth-gated) and renders a compact panel
// overlaid on the right of the hero. No bundler, no deps — matches house style.
(function () {
  'use strict';

  var panel = document.getElementById('hero-feed');
  var list = document.getElementById('hero-feed-list');
  if (!panel || !list) return;

  var selectedSlug = null;
  var worldsCache = [];
  var cctvStops = [];

  // Tiny top-down swatch palette for the preview minimap.
  var TERRAIN_COLORS = {
    grass: '#6cc24a',
    water: '#3aa6e0',
    sand: '#e6d59a',
    stone: '#9aa0a8',
    dirt: '#a9794f',
    snow: '#eef3f7',
    path: '#cdb68a',
    crops: '#d8b13a',
    lava: '#e2562b',
  };

  var CCTV_GRAY = {
    grass: 150,
    water: 74,
    sand: 190,
    stone: 116,
    dirt: 102,
    snow: 216,
    path: 166,
    crops: 178,
    lava: 128,
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function slugOf(w) {
    return String((w && (w.slug || w.id || w.name)) || '').toLowerCase();
  }

  function worldHref(w) {
    return '/worlds?world=' + encodeURIComponent((w && w.slug) || '');
  }

  // Build a small canvas minimap from the sparse [x, z, terrain] preview tuples.
  function miniMap(preview) {
    var grid = (preview && Number(preview.gridSize)) || 20;
    var cells = (preview && Array.isArray(preview.cells)) ? preview.cells : [];
    var px = 4; // pixels per cell
    var size = grid * px;
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.className = 'hero-feed-map';
    var ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    // base ground
    ctx.fillStyle = '#bfe39a';
    ctx.fillRect(0, 0, size, size);
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var x = c[0], z = c[1];
      var terrain = c[2] || 'grass';
      if (x == null || z == null) continue;
      ctx.fillStyle = TERRAIN_COLORS[terrain] || '#6cc24a';
      ctx.fillRect(x * px, z * px, px, px);
    }
    return canvas;
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function stampTime(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function drawCctv(canvas, w, tick) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var W = canvas.width, H = canvas.height;
    var preview = w.preview || {};
    var grid = Number(preview.gridSize) || 20;
    var cells = Array.isArray(preview.cells) ? preview.cells : [];
    var slug = slugOf(w);
    var name = String(w.name || w.slug || 'Island');
    var players = Number(w.activePlayers) || 0;
    var px = Math.max(3, Math.floor(Math.min((W - 42) / grid, (H - 58) / grid)));
    var mapW = grid * px;
    var ox = Math.floor((W - mapW) / 2);
    var oy = 32;

    ctx.fillStyle = '#070a08';
    ctx.fillRect(0, 0, W, H);

    // Faint radial tube glow / old security-monitor falloff.
    var grad = ctx.createRadialGradient(W * 0.5, H * 0.45, 10, W * 0.5, H * 0.45, W * 0.65);
    grad.addColorStop(0, 'rgba(160,190,158,0.22)');
    grad.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgb(116,128,112)';
    ctx.fillRect(ox, oy, mapW, mapW);
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var x = c[0], z = c[1];
      if (x == null || z == null) continue;
      var terrain = c[2] || 'grass';
      var g = CCTV_GRAY[terrain] == null ? 148 : CCTV_GRAY[terrain];
      var wobble = ((x * 17 + z * 29 + tick) % 7) - 3;
      g = Math.max(40, Math.min(224, g + wobble));
      ctx.fillStyle = 'rgb(' + g + ',' + g + ',' + g + ')';
      ctx.fillRect(ox + x * px, oy + z * px, px, px);
    }

    // A few synthetic focus brackets / activity boxes so it reads as CCTV, not a static map.
    ctx.strokeStyle = 'rgba(222,242,208,0.68)';
    ctx.lineWidth = 1;
    var bx = ox + ((tick * 2) % Math.max(1, grid - 4)) * px;
    var bz = oy + ((tick * 3) % Math.max(1, grid - 4)) * px;
    ctx.strokeRect(bx, bz, px * 4, px * 3);
    if (players > 0) {
      for (var p = 0; p < Math.min(players, 6); p++) {
        var sx = ox + ((tick + p * 5) % grid) * px + Math.floor(px / 2);
        var sz = oy + ((tick * 2 + p * 7) % grid) * px + Math.floor(px / 2);
        ctx.fillStyle = 'rgba(238,255,220,0.9)';
        ctx.fillRect(sx - 1, sz - 1, 3, 3);
      }
    }

    // Rolling interference band.
    var bandY = (tick * 11) % H;
    var band = ctx.createLinearGradient(0, bandY - 14, 0, bandY + 18);
    band.addColorStop(0, 'rgba(255,255,255,0)');
    band.addColorStop(0.5, 'rgba(230,255,220,0.16)');
    band.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, bandY - 14, W, 32);

    // Scanlines + static speckle.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (var y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    for (var n = 0; n < 180; n++) {
      var nx = Math.floor(Math.random() * W);
      var ny = Math.floor(Math.random() * H);
      var a = Math.random() * 0.18;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,' + a + ')' : 'rgba(0,0,0,' + a + ')';
      ctx.fillRect(nx, ny, 1, 1);
    }

    // CRT vignette.
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 18;
    ctx.strokeRect(9, 9, W - 18, H - 18);

    ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = '#dff5d8';
    ctx.fillText('CAM ' + (slug ? slug.slice(0, 10).toUpperCase() : 'ISLAND') + ' // ISLAND CCTV', 12, 18);
    ctx.textAlign = 'right';
    ctx.fillText(stampTime(new Date()), W - 12, 18);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('REC', 22, H - 14);
    ctx.fillStyle = (tick % 2) ? '#ffeded' : '#ff4d4d';
    ctx.beginPath(); ctx.arc(13, H - 18, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dff5d8';
    ctx.textAlign = 'right';
    ctx.fillText((players > 0 ? players + ' SUBJECTS' : 'LOBBY ONLINE') + ' // SIGNAL ' + (96 - (tick % 5)) + '%', W - 12, H - 14);
    ctx.textAlign = 'left';
  }

  function cctvPreview(w) {
    var wrap = document.createElement('div');
    wrap.className = 'hero-feed-cctv';
    wrap.id = 'hero-feed-cctv-' + slugOf(w).replace(/[^a-z0-9_-]/g, '-');

    var canvas = document.createElement('canvas');
    canvas.className = 'hero-feed-cctv-canvas';
    canvas.width = 320;
    canvas.height = 180;
    wrap.appendChild(canvas);

    var players = Number(w.activePlayers) || 0;
    var name = w.name || w.slug || 'Untitled island';
    var status = players > 0 ? players + ' online' : 'Lobby online';
    var href = worldHref(w);
    var meta = document.createElement('div');
    meta.className = 'hero-feed-cctv-meta';
    meta.innerHTML =
      '<span><span class="hero-feed-cctv-dot"></span>' + esc(status) + '</span>' +
      '<strong>' + esc(name) + ' island feed</strong>' +
      '<a href="' + esc(href) + '">Open island →</a>';
    wrap.appendChild(meta);

    var tick = 0;
    drawCctv(canvas, w, tick);
    var timer = setInterval(function () {
      tick += 1;
      drawCctv(canvas, w, tick);
    }, 900);
    cctvStops.push(function () { clearInterval(timer); });
    return wrap;
  }

  function clearCctvTimers() {
    while (cctvStops.length) {
      try { cctvStops.pop()(); } catch (_) {}
    }
  }

  function worldRow(w) {
    var li = document.createElement('li');
    var slug = slugOf(w);
    var expanded = !!slug && slug === selectedSlug;
    li.className = 'hero-feed-item' + (expanded ? ' is-expanded' : '');

    var button = document.createElement('button');
    button.className = 'hero-feed-link';
    button.type = 'button';
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    if (slug) button.setAttribute('aria-controls', 'hero-feed-cctv-' + slug.replace(/[^a-z0-9_-]/g, '-'));
    button.setAttribute('data-world-slug', slug);

    button.appendChild(miniMap(w.preview));

    var body = document.createElement('div');
    body.className = 'hero-feed-body';

    var players = Number(w.activePlayers) || 0;
    var tiles = Number(w.tileCount) || 0;
    var meta = w.kind === 'starter' ? 'Starter world' : (w.ownerName ? 'by ' + esc(w.ownerName) : 'Published');

    body.innerHTML =
      '<span class="hero-feed-name">' + esc(w.name || w.slug || 'Untitled') + '</span>' +
      '<span class="hero-feed-meta">' + meta + '</span>' +
      '<span class="hero-feed-stats">' +
        '<span class="hero-feed-stat' + (players > 0 ? ' is-live' : '') + '">' +
          '<span class="hero-feed-pip"></span>' + players + ' online' +
        '</span>' +
        '<span class="hero-feed-stat">' + tiles.toLocaleString() + ' tiles</span>' +
      '</span>';

    button.appendChild(body);
    var cue = document.createElement('span');
    cue.className = 'hero-feed-expand-cue';
    cue.setAttribute('aria-hidden', 'true');
    cue.textContent = expanded ? '×' : 'CCTV';
    button.appendChild(cue);
    button.addEventListener('click', function () {
      selectedSlug = expanded ? null : slug;
      render(worldsCache);
    });
    li.appendChild(button);
    if (expanded) li.appendChild(cctvPreview(w));
    return li;
  }

  function render(worlds) {
    clearCctvTimers();
    list.textContent = '';
    worldsCache = Array.isArray(worlds) ? worlds.slice() : [];
    // Most active first, then starter worlds, cap to keep the panel tidy.
    var sorted = worldsCache.slice().sort(function (a, b) {
      return (Number(b.activePlayers) || 0) - (Number(a.activePlayers) || 0);
    }).slice(0, 5);
    if (!sorted.length) return false;
    var selectedStillVisible = false;
    for (var i = 0; i < sorted.length; i++) {
      if (slugOf(sorted[i]) === selectedSlug) selectedStillVisible = true;
    }
    if (selectedSlug && !selectedStillVisible) selectedSlug = null;
    panel.classList.toggle('is-expanded', !!selectedSlug);
    for (var j = 0; j < sorted.length; j++) list.appendChild(worldRow(sorted[j]));
    return true;
  }

  function load() {
    fetch('/api/worlds', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var worlds = data && Array.isArray(data.worlds) ? data.worlds : [];
        if (render(worlds)) panel.hidden = false;
      })
      .catch(function () { /* stay hidden on failure — never break the hero */ });
  }

  window.addEventListener('pagehide', clearCctvTimers);
  load();
  // Light refresh so player counts feel live without hammering the API.
  setInterval(load, 30000);
})();
