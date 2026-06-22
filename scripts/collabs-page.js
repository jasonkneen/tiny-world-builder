// -------- public collab worlds page --------
(function () {
  'use strict';

  var mount = document.getElementById('collab-worlds-list');
  var summary = document.getElementById('collab-worlds-summary');
  if (!mount || !summary) return;

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
    if (q === 'good') return 'Good';
    if (q === 'fair') return 'Fair';
    if (q === 'poor') return 'Poor';
    return 'Unknown';
  }

  function initials(text) {
    var parts = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'TW';
    if (parts.length > 1) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }

  function relativeTime(value) {
    var time = Date.parse(value || '');
    if (!Number.isFinite(time)) return 'just now';
    var seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
    if (seconds < 10) return 'just now';
    if (seconds < 60) return seconds + 's ago';
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    var hours = Math.round(minutes / 60);
    return hours + 'h ago';
  }

  function roomCard(room) {
    var name = String(room.name || 'Shared build');
    var host = String(room.host || 'Builder');
    var location = String(room.location || 'Unknown');
    var observers = Number(room.observerCount) || 0;
    var players = Number(room.playerCount) || 0;
    var editors = Number(room.editorCount) || 0;
    var total = observers + players + editors;
    var quality = String(room.networkQuality || 'unknown').toLowerCase();

    var article = document.createElement('article');
    article.className = 'collab-world-card';

    var badge = document.createElement('span');
    badge.className = 'collab-world-badge';
    badge.textContent = initials(name);

    var body = document.createElement('div');
    body.className = 'collab-world-body';

    var title = document.createElement('h3');
    title.textContent = name;

    var meta = document.createElement('dl');
    meta.className = 'collab-world-meta';
    [
      ['Location', location],
      ['Host', host],
      ['Viewing', String(total)],
      ['Players', String(players)],
      ['Editors', String(editors)],
      ['Updated', relativeTime(room.lastSeen)],
    ].forEach(function (pair) {
      var dt = document.createElement('dt');
      var dd = document.createElement('dd');
      dt.textContent = pair[0];
      dd.textContent = pair[1];
      meta.appendChild(dt);
      meta.appendChild(dd);
    });

    var actions = document.createElement('div');
    actions.className = 'collab-world-actions';
    var network = document.createElement('span');
    network.className = 'collab-network collab-network-' + (quality === 'good' || quality === 'fair' || quality === 'poor' ? quality : 'unknown');
    network.textContent = qualityLabel(room) + ' network';
    if (Number.isFinite(Number(room.rttMs))) network.textContent += ' - ' + Math.round(Number(room.rttMs)) + 'ms';
    var link = document.createElement('a');
    link.className = 'primary-action collab-world-enter';
    link.href = roomHref(room);
    link.textContent = 'Observe';
    actions.appendChild(network);
    actions.appendChild(link);

    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(actions);
    article.appendChild(badge);
    article.appendChild(body);
    return article;
  }

  function render(rooms) {
    mount.textContent = '';
    if (!rooms || !rooms.length) {
      summary.textContent = 'No public collab rooms are live right now.';
      var empty = document.createElement('div');
      empty.className = 'collab-world-empty';
      empty.textContent = 'Start a shared build from the editor and it will appear here while the host is online.';
      mount.appendChild(empty);
      return;
    }
    summary.textContent = rooms.length + (rooms.length === 1 ? ' public room is live.' : ' public rooms are live.');
    rooms.forEach(function (room) {
      mount.appendChild(roomCard(room));
    });
  }

  function load() {
    fetch('/api/collabs?limit=100', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (res) { return res && res.ok ? res.json() : null; })
      .then(function (data) { render(data && Array.isArray(data.rooms) ? data.rooms : []); })
      .catch(function () {
        summary.textContent = 'Could not load public rooms.';
        mount.textContent = '';
      });
  }

  load();
  setInterval(load, 30000);
})();
