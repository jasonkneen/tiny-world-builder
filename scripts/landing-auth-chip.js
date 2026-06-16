// -------- landing account chip --------
// Passive signed-in indicator for the public landing header. Uses the same
// Netlify/Gotrue browser session as the community/app auth, but does not mount
// the full login UI on marketing pages.
(function () {
  'use strict';

  var chip = document.getElementById('landing-account-chip');
  if (!chip) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function initials(name) {
    var clean = String(name || '').trim();
    if (!clean) return '?';
    var parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  }

  function emailLabel(email) {
    if (!email || typeof email !== 'string') return '';
    var at = email.indexOf('@');
    return at > 0 ? email.slice(0, at) : email;
  }

  function readStoredUser() {
    try {
      var raw = window.localStorage && window.localStorage.getItem('gotrue.user');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function normaliseUser(user) {
    if (!user || typeof user !== 'object') return null;
    var meta = user.userMetadata || user.user_metadata || {};
    var appMeta = user.appMetadata || user.app_metadata || {};
    var email = user.email || '';
    var name = user.name || meta.full_name || meta.name || meta.display_name || emailLabel(email);
    var handle = meta.username || meta.handle || meta.twitter || appMeta.provider || emailLabel(email);
    var picture = user.pictureUrl || meta.avatar_url || meta.picture || meta.image || '';
    if (!name && !email && !handle) return null;
    return {
      name: String(name || 'Signed in'),
      sub: String(handle || email || 'Online'),
      picture: String(picture || ''),
    };
  }

  function render(user) {
    var u = normaliseUser(user);
    if (!u) {
      chip.hidden = true;
      if (chip.parentElement) chip.parentElement.classList.remove('has-account');
      return;
    }
    var avatar = u.picture
      ? '<img class="landing-account-avatar" src="' + esc(u.picture) + '" alt="" loading="lazy" referrerpolicy="no-referrer" />'
      : '<span class="landing-account-avatar">' + esc(initials(u.name)) + '</span>';
    chip.innerHTML =
      avatar +
      '<span class="landing-account-copy">' +
        '<strong>' + esc(u.name) + '</strong>' +
        '<small>' + esc(u.sub) + '</small>' +
      '</span>';
    chip.hidden = false;
    chip.setAttribute('aria-label', 'Signed in as ' + u.name + '. Open community profile.');
    if (chip.parentElement) chip.parentElement.classList.add('has-account');
    var img = chip.querySelector('img.landing-account-avatar');
    if (img) {
      img.addEventListener('error', function () {
        var span = document.createElement('span');
        span.className = 'landing-account-avatar';
        span.textContent = initials(u.name);
        img.replaceWith(span);
      }, { once: true });
    }
  }

  function refresh() {
    var Auth = window.TinyWorldAuth;
    if (Auth && typeof Auth.getUser === 'function') {
      Promise.resolve(Auth.getUser()).then(function (user) {
        render(user || readStoredUser());
      }).catch(function () {
        render(readStoredUser());
      });
      return;
    }
    render(readStoredUser());
  }

  window.addEventListener('storage', function (event) {
    if (!event || event.key === 'gotrue.user') refresh();
  });
  window.addEventListener('tinyworld:auth-change', refresh);
  setTimeout(refresh, 0);
  // Auth modules on other pages may hydrate shortly after this classic script.
  setTimeout(refresh, 600);
})();
