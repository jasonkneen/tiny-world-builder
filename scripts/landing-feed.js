// -------- landing hero public collab feed --------
// Reads /api/collabs and renders currently active publicly viewable shared
// builds. Visitors enter as observers; edit access is granted in-room by host.
(function () {
  'use strict';

  var panel = document.getElementById('hero-feed');
  var list = document.getElementById('hero-feed-list');
  if (!panel || !list) return;

  function hideFeed() {
    list.textContent = '';
    panel.hidden = true;
  }

  function roomHref(room) {
    var href = String((room && room.href) || '').trim();
    if (href && href.charAt(0) === '/') return href;
    var roomId = String((room && room.roomId) || '').trim();
    if (!roomId) return '/tiny-world-builder';
    var params = new URLSearchParams();
    if (room.shareId) params.set('share', room.shareId);
    params.set('party', roomId);
    params.set('observe', '1');
    return '/tiny-world-builder?' + params.toString();
  }

  function qualityLabel(room) {
    var q = String((room && room.networkQuality) || 'unknown').toLowerCase();
    if (q === 'good') return 'Good network';
    if (q === 'fair') return 'Fair network';
    if (q === 'poor') return 'Poor network';
    return 'Network unknown';
  }

  function initials(text) {
    var parts = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'TW';
    if (parts.length > 1) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }

  function renderRoom(room) {
    var players = Number(room.playerCount) || 0;
    var observers = Number(room.observerCount) || 0;
    var editors = Number(room.editorCount) || 0;
    var name = String(room.name || 'Shared build');
    var host = String(room.host || 'Builder');
    var location = String(room.location || 'Unknown');

    var li = document.createElement('li');
    li.className = 'hero-feed-item';
    var a = document.createElement('a');
    a.className = 'hero-feed-link';
    a.href = roomHref(room);

    var badge = document.createElement('span');
    badge.className = 'hero-feed-map hero-feed-map-collab';
    badge.textContent = initials(name);

    var body = document.createElement('span');
    body.className = 'hero-feed-body';

    var title = document.createElement('span');
    title.className = 'hero-feed-name';
    title.textContent = name;

    var meta = document.createElement('span');
    meta.className = 'hero-feed-meta';
    meta.textContent = location + ' - hosted by ' + host;

    var stats = document.createElement('span');
    stats.className = 'hero-feed-stats';
    var live = document.createElement('span');
    live.className = 'hero-feed-stat is-live';
    var livePip = document.createElement('span');
    livePip.className = 'hero-feed-pip';
    live.appendChild(livePip);
    live.appendChild(document.createTextNode((players + observers + editors) + ' viewing'));
    var quality = document.createElement('span');
    quality.className = 'hero-feed-stat';
    quality.textContent = qualityLabel(room);
    stats.appendChild(live);
    stats.appendChild(quality);

    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(stats);
    a.appendChild(badge);
    a.appendChild(body);
    li.appendChild(a);
    return li;
  }

  function render(rooms) {
    list.textContent = '';
    if (!rooms || !rooms.length) {
      hideFeed();
      return;
    }
    rooms.slice(0, 5).forEach(function (room) {
      list.appendChild(renderRoom(room));
    });
    panel.hidden = false;
  }

  function load() {
    fetch('/api/collabs?limit=5', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (res) { return res && res.ok ? res.json() : null; })
      .then(function (data) { render(data && Array.isArray(data.rooms) ? data.rooms : []); })
      .catch(hideFeed);
  }

  hideFeed();
  load();
  setInterval(load, 30000);
})();
