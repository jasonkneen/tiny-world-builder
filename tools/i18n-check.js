#!/usr/bin/env node
/*
 * TinyWorld i18n checker — no network, no API.
 *
 *   node tools/i18n-check.js            verify (used by `npm run check`)
 *   node tools/i18n-check.js --report   print full coverage report
 *
 * Verifies:
 *   1. Locale parity — fr/es/zh/th define EXACTLY the keys en.js defines
 *      (no missing keys = no silent English leakage; no extra/orphan keys).
 *   2. No empty translations.
 *   3. Every data-i18n* key used in the HTML, and every LITERAL t()/tx() key
 *      used in engine JS, exists in en.js (catches typos). Dynamic keys built
 *      by concatenation, e.g. t('tool.' + id), are intentionally not checked
 *      here — en.js is the source of truth and check #1 guarantees the other
 *      locales match it.
 *
 * en.js is AUTHORITATIVE: to add a string, add it to en.js, reference it, then
 * run this. It will tell you exactly which keys each locale is missing — hand
 * that list to the tinyworld-i18n skill (or translate by hand). See docs/i18n.md.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const i18nDir = path.join(root, 'engine', 'i18n');
const LOCALES = ['en', 'fr', 'es', 'zh', 'th'];
const REPORT = process.argv.includes('--report');

// Load each locale file by executing its IIFE against a stub window.
function loadLocales() {
  const win = {};
  for (const code of LOCALES) {
    const file = path.join(i18nDir, code + '.js');
    if (!fs.existsSync(file)) throw new Error('missing locale file: engine/i18n/' + code + '.js');
    // eslint-disable-next-line no-new-func
    new Function('window', fs.readFileSync(file, 'utf8'))(win);
  }
  return win.TWI18N_DATA || {};
}

// Collect i18n keys referenced in the HTML (data-i18n* attributes) and in
// engine JS (literal t('...') / tx('...') calls only).
function collectUsedKeys() {
  const used = new Map(); // key -> [where...]
  const add = (key, where) => {
    if (!used.has(key)) used.set(key, []);
    used.get(key).push(where);
  };

  const html = fs.readFileSync(path.join(root, 'tiny-world-builder.html'), 'utf8');
  const attrRe = /data-i18n(?:-title|-tooltip|-placeholder|-aria-label)?="([^"]+)"/g;
  let m;
  while ((m = attrRe.exec(html))) add(m[1], 'tiny-world-builder.html');

  const engineDir = path.join(root, 'engine', 'world');
  const litRe = /\b(?:window\.)?(?:t|tx)\(\s*['"]([^'"]+)['"]/g;
  for (const name of fs.readdirSync(engineDir).sort()) {
    if (!name.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(engineDir, name), 'utf8');
    while ((m = litRe.exec(src))) {
      // A trailing dot means this literal is a concatenation prefix for a
      // dynamic key, e.g. t('tool.' + id) — not a real key, so skip it.
      if (m[1].endsWith('.')) continue;
      // Skip obvious non-i18n single-letter / numeric matches.
      if (m[1].indexOf('.') < 0 && m[1].indexOf(' ') >= 0) continue;
      add(m[1], 'engine/world/' + name);
    }
  }
  return used;
}

function main() {
  const data = loadLocales();
  const en = data.en || {};
  const enKeys = Object.keys(en).sort();
  const problems = [];

  if (!enKeys.length) problems.push('en.js defines no keys');

  // 1 + 2: parity and emptiness.
  for (const code of LOCALES.filter((code) => code !== 'en')) {
    const d = data[code] || {};
    const keys = Object.keys(d);
    const keySet = new Set(keys);
    const missing = enKeys.filter((k) => !keySet.has(k));
    const extra = keys.filter((k) => !(k in en));
    const empty = keys.filter((k) => d[k] == null || String(d[k]).trim() === '');
    if (missing.length) problems.push(code + '.js missing ' + missing.length + ' key(s): ' + missing.join(', '));
    if (extra.length) problems.push(code + '.js has ' + extra.length + ' orphan key(s) not in en.js: ' + extra.join(', '));
    if (empty.length) problems.push(code + '.js has ' + empty.length + ' empty value(s): ' + empty.join(', '));
    if (REPORT) {
      const translated = enKeys.length - missing.length;
      console.log('  ' + code + ': ' + translated + '/' + enKeys.length + ' keys'
        + (missing.length ? ' (' + missing.length + ' missing)' : ' ✓'));
    }
  }

  // 3: used literal keys must exist in en.
  const used = collectUsedKeys();
  const unknown = [];
  for (const [key, where] of used) {
    if (!(key in en)) unknown.push(key + '  ← ' + Array.from(new Set(where)).join(', '));
  }
  if (unknown.length) {
    problems.push('used i18n key(s) absent from en.js (typo?):\n    ' + unknown.join('\n    '));
  }

  if (REPORT) {
    const literalUsed = Array.from(used.keys()).filter((k) => k in en).length;
    console.log('  en: ' + enKeys.length + ' keys defined; ' + used.size + ' literal key(s) referenced in HTML/JS ('
      + literalUsed + ' resolve, ' + unknown.length + ' unknown)');
    console.log('  (tool.*/group.*/etc. are referenced dynamically and not counted as literals)');
  }

  if (problems.length) {
    console.error('i18n check failed:');
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
  }
  console.log('✓ i18n check passed (' + enKeys.length + ' keys × ' + LOCALES.length + ' locales)');
}

main();
