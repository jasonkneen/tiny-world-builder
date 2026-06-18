/* Live GitHub stars count for the landing hero pill.
 *
 * Robustness contract:
 * - The pill is a plain anchor to the repo, so it works with zero JS.
 * - We hydrate the count from localStorage first, so repeat visitors see a
 *   number instantly even when the API is rate-limited.
 * - Unauthenticated api.github.com is ~60 req/hr per IP. A rate-limited call
 *   RESOLVES with HTTP 403 (no stargazers_count), so we gate on res.ok and on
 *   a positive finite integer - we only ever render a real count, never
 *   undefined / 0 from a bad body / NaN. On any failure we keep the cached
 *   value or the plain "Star on GitHub" label.
 */
(function githubStars() {
  var REPO = 'jasonkneen/tiny-world-builder';
  var CACHE_KEY = 'tw:gh-stars';

  var pill = document.getElementById('gh-stars-pill');
  if (!pill) return;
  var countEl = pill.querySelector('[data-gh-stars-count]');
  var valueEl = pill.querySelector('[data-gh-stars-value]');
  if (!countEl || !valueEl) return;

  function render(n) {
    if (!Number.isFinite(n) || n <= 0) return;
    valueEl.textContent = Math.round(n).toLocaleString('en-US');
    countEl.hidden = false;
    pill.classList.add('has-count');
  }

  // 1) Hydrate immediately from cache (survives API rate limits).
  try {
    var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached) render(cached.count);
  } catch (err) { /* ignore malformed cache */ }

  // 2) Best-effort live refresh.
  fetch('https://api.github.com/repos/' + REPO, {
    headers: { Accept: 'application/vnd.github+json' },
  })
    .then(function (res) {
      if (!res.ok) throw new Error('github status ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var n = data && data.stargazers_count;
      if (!Number.isFinite(n) || n <= 0) throw new Error('missing stargazers_count');
      render(n);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ count: n, ts: Date.now() }));
      } catch (err) { /* storage may be unavailable */ }
    })
    .catch(function () { /* keep cached value or the plain anchor label */ });
})();
