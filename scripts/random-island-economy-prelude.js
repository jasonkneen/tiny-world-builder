// Minimal globals for 26b-random-island-economy-profile.js on lightweight pages
// (pack reveal, etc.) that do not load the full builder prelude.
var GRID = 8;
function coerceGridSize(value, fallback) {
  const n = parseInt(value, 10);
  const opts = [8, 10, 12, 16, 20];
  if (opts.includes(n)) return n;
  const fb = parseInt(fallback, 10);
  return opts.includes(fb) ? fb : 8;
}