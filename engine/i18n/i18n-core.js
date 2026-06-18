/* TinyWorld i18n core.
 *
 * Loaded as a classic <script> BEFORE engine/world/00-prelude.js, and AFTER the
 * per-locale data files (engine/i18n/<code>.js), each of which registers its
 * dictionary onto window.TWI18N_DATA.<code>. Locale data ships as JS (not JSON
 * fetched at runtime) so the app keeps working from file:// with no network.
 *
 * Public surface (all global, because every engine module is a classic script
 * sharing one global scope):
 *   t(key, params)        -> translated string, with {name} interpolation,
 *                            falling back to English, then to the key itself.
 *   TWI18N.locale         -> active locale code ('en' | 'fr' | 'es' | 'zh' | 'th').
 *   TWI18N.supported      -> ['en','fr','es','zh','th'].
 *   TWI18N.names          -> endonyms for the language switcher.
 *   TWI18N.apply(root)    -> translate data-i18n* attributes under root.
 *   TWI18N.setLocale(code)-> persist + reload (reload-on-switch; see below).
 *
 * Language switching uses reload-on-switch: persist the choice, then
 * location.reload(). The whole app re-resolves the locale at boot and every
 * surface — static HTML and the many JS-generated panels (toolbar, command
 * palette, radial menu, layers tree) — renders correctly with zero re-render
 * wiring. The in-progress home grid survives because it autosaves to
 * localStorage 'tinyworld:v1' (engine/world/29-persistence-api.js) and is
 * restored on boot. Switching language is a rare, deliberate action, so the
 * reload cost is irrelevant.
 */
(function () {
  'use strict';

  var SUPPORTED = ['en', 'fr', 'es', 'zh', 'th'];
  var DEFAULT = 'en';
  var LS_KEY = 'tinyworld:lang';

  // Endonyms (each language named in itself) for the switcher.
  var NAMES = {
    en: 'English',
    fr: 'Français',
    es: 'Español',
    zh: '中文',
    th: 'ไทย',
  };

  var DATA = (typeof window !== 'undefined' && window.TWI18N_DATA) || {};

  function normalize(code) {
    if (!code) return null;
    code = String(code).toLowerCase().trim();
    if (SUPPORTED.indexOf(code) >= 0) return code;
    // Match a region-tagged code to its base ('fr-FR' -> 'fr', 'zh-CN' -> 'zh').
    var base = code.split(/[-_]/)[0];
    if (SUPPORTED.indexOf(base) >= 0) return base;
    return null;
  }

  function detectFromNavigator() {
    try {
      var list = (navigator.languages && navigator.languages.length)
        ? navigator.languages
        : [navigator.language || navigator.userLanguage];
      for (var i = 0; i < list.length; i++) {
        var m = normalize(list[i]);
        if (m) return m;
      }
    } catch (_) {}
    return null;
  }

  // Resolution order: ?lang= -> stored choice -> navigator -> English.
  function resolveLocale() {
    var fromUrl = null;
    try {
      fromUrl = normalize(new URLSearchParams(window.location.search).get('lang'));
    } catch (_) {}
    if (fromUrl) {
      // An explicit URL choice becomes the persisted preference too, so it
      // sticks after the param is dropped on later navigations.
      try { window.localStorage.setItem(LS_KEY, fromUrl); } catch (_) {}
      return fromUrl;
    }
    var stored = null;
    try { stored = normalize(window.localStorage.getItem(LS_KEY)); } catch (_) {}
    if (stored) return stored;
    var auto = detectFromNavigator();
    if (auto) return auto;
    return DEFAULT;
  }

  var locale = resolveLocale();

  function interpolate(str, params) {
    if (!params || typeof str !== 'string' || str.indexOf('{') < 0) return str;
    return str.replace(/\{(\w+)\}/g, function (whole, name) {
      return Object.prototype.hasOwnProperty.call(params, name)
        ? String(params[name])
        : whole;
    });
  }

  // t(key) -> active locale, else English, else the key (so missing strings are
  // visible rather than blank). params interpolate {name} placeholders.
  function t(key, params) {
    if (key == null) return '';
    var active = DATA[locale];
    var val = active ? active[key] : undefined;
    if (val === undefined && locale !== DEFAULT) {
      var en = DATA[DEFAULT];
      val = en ? en[key] : undefined;
    }
    if (val === undefined) val = key;
    return interpolate(val, params);
  }

  // has(key) -> true if a real translation exists (active locale or English),
  // not merely the key echoed back. Lets callers translate data-defined labels
  // while keeping their hard-coded English fallback when no key is present.
  function has(key) {
    if (key == null) return false;
    var active = DATA[locale];
    if (active && active[key] !== undefined) return true;
    var en = DATA[DEFAULT];
    return !!(en && en[key] !== undefined);
  }

  // tx(key, fallback) -> translation if it exists, else the supplied fallback.
  function tx(key, fallback) {
    return has(key) ? t(key) : fallback;
  }

  // Attribute-driven translation for static HTML. Supported hooks:
  //   data-i18n            -> textContent
  //   data-i18n-title      -> title attribute
  //   data-i18n-tooltip    -> data-tooltip attribute (custom tooltip system)
  //   data-i18n-placeholder-> placeholder attribute
  //   data-i18n-aria-label -> aria-label attribute
  var ATTR_MAP = [
    ['data-i18n-title', 'title'],
    ['data-i18n-tooltip', 'data-tooltip'],
    ['data-i18n-placeholder', 'placeholder'],
    ['data-i18n-aria-label', 'aria-label'],
  ];

  function apply(root) {
    root = root || document;
    if (!root.querySelectorAll) return;
    var els = root.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = t(els[i].getAttribute('data-i18n'));
    }
    for (var a = 0; a < ATTR_MAP.length; a++) {
      var sel = '[' + ATTR_MAP[a][0] + ']';
      var attr = ATTR_MAP[a][1];
      var nodes = root.querySelectorAll(sel);
      for (var j = 0; j < nodes.length; j++) {
        nodes[j].setAttribute(attr, t(nodes[j].getAttribute(ATTR_MAP[a][0])));
      }
    }
  }

  function setLocale(code) {
    var norm = normalize(code) || DEFAULT;
    try { window.localStorage.setItem(LS_KEY, norm); } catch (_) {}
    if (norm === locale) return;
    // A ?lang= param outranks the stored choice in resolveLocale(), so a switch
    // while one is present would be undone on reload (the param re-forces the old
    // locale). Drop it — the persisted choice is now the source of truth — then
    // reload to re-resolve every surface from a clean boot.
    try {
      var url = new URL(window.location.href);
      if (url.searchParams.has('lang')) {
        url.searchParams.delete('lang');
        window.history.replaceState(null, '', url.toString());
      }
    } catch (_) {}
    try { window.location.reload(); } catch (_) { locale = norm; apply(document); }
  }

  // Reflect the locale on <html lang> immediately for correct font/hyphenation.
  try { document.documentElement.setAttribute('lang', locale); } catch (_) {}

  var api = {
    locale: locale,
    supported: SUPPORTED.slice(),
    names: NAMES,
    data: DATA,
    t: t,
    tx: tx,
    has: has,
    apply: apply,
    setLocale: setLocale,
  };

  window.TWI18N = api;
  // Bare t('key') / tx('key', fallback) work in every module via the global
  // scope chain (all engine modules are classic scripts sharing one scope).
  if (typeof window.t !== 'function') window.t = t;
  if (typeof window.tx !== 'function') window.tx = tx;

  // Translate static HTML once the DOM exists. JS-generated UI calls t()
  // directly at build time, which already sees the resolved locale.
  function boot() { apply(document); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}());
