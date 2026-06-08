---
name: tinyworld-i18n
description: Add, translate, or audit TinyWorld UI strings across English/French/Chinese/Spanish. Use when adding user-facing gameplay text, when `npm run i18n:check` fails, when a string shows up in English in a non-English locale, or when adding a new language. No translation API — Codex does the translating directly, using the established glossary for consistency.
---

# TinyWorld i18n workflow

TinyWorld localizes its **gameplay** UI into English (`en`), French (`fr`), Simplified
Chinese (`zh`), and Spanish (`es`). This skill is the repeatable process for keeping
those translations complete and consistent. There is no external API: you (Codex) are
the translator. The checker (`npm run i18n:check`) is the safety net.

Read `docs/i18n.md` first if you need the architecture. The short version:

- Locale dictionaries live in `engine/i18n/{en,fr,es,zh}.js` as flat key→string maps.
- **`en.js` is authoritative.** Every other locale must define exactly its key set.
- Static HTML uses `data-i18n` / `data-i18n-title` / `data-i18n-tooltip` /
  `data-i18n-placeholder` / `data-i18n-aria-label` attributes.
- JS uses the global `t('key')` (or `tx('key', fallback)` to keep a hard-coded English
  default). Tool/group/variant labels are localized by a single mutation block near the
  top of `engine/world/19-tools-toolbar.js`.
- Language switching is **reload-on-switch** (persist + `location.reload()`), so every
  surface re-renders correctly at boot. Don't add live re-render wiring.

## Adding or changing strings (the loop)

1. **Add the English string to `engine/i18n/en.js`** with a namespaced key
   (`panel.thing`, e.g. `time.season`). Keep keys grouped under their existing comment
   section; add a new section if it's a new surface.

2. **Reference it:**
   - Static HTML leaf element → add `data-i18n="key"`. For an element that also has
     child elements (e.g. a `<label>` wrapping a `<select>`), wrap just the text in a
     `<span data-i18n="key">…</span>` so `apply()` doesn't wipe the children.
   - Attribute → `data-i18n-title` / `-tooltip` / `-placeholder` / `-aria-label`. Leave
     the existing attribute as the English default; `apply()` overwrites it.
   - JS string shown to the user → `window.t('key')`. Use `window.t` (not bare `t`)
     inside functions that have a local variable named `t` (the toolbar module does).
   - A label living in a data array (tools, menus) → localize once via a mutation block
     guarded by `if (window.TWI18N)`, using `tx('prefix.' + item.id, item.label)`.

3. **See what's missing:** `npm run i18n:report`. It prints per-locale coverage and any
   used key that's absent from `en.js` (a typo).

4. **Translate the missing keys** into `fr.js`, `es.js`, `zh.js`. Do it yourself. Follow
   the **Glossary** and **Style** below. Match `en.js` key-for-key — no extra keys, no
   blanks. Preserve `{name}` interpolation placeholders verbatim.

5. **`npm run i18n:check`** until it passes (it also runs inside `npm run check` /
   `publish.sh`, so a gap blocks the build).

6. **Verify in the real app** — never claim done from files alone:
   `npm run dev`, then load `?lang=fr`, `?lang=zh`, `?lang=es`. Confirm the new strings
   render translated and the layout still fits (German-length / CJK glyph checks).

## Scope — what gets translated

**Translate:** toolbar/tools/variants, world menu, camera/view, time & weather, crowd
panel, sound, layers/properties, welcome/how-to, top-bar + control tooltips, settings
tab names + the Workspace section, the mode HUD, the radial menu, player-facing toasts.

**Leave in English:** account/auth, the AI/agent panel, API keys, the developer overlay,
credits/sponsors, the token ticker, and the dense technical settings sliders (Rendering /
Materials / Environment / Crowd-advanced / AI). These are not "gameplay" strings. If the
product owner later wants them, add their keys to `en.js` and run this loop.

## Style

- Match the source's tone: short, friendly, lowercase hints (`clear to grass`).
- Keep it terse — UI chrome, not prose. Prefer the shortest natural phrasing.
- Use the locale's own conventions (FR: `«  »` guillemets are fine; ZH: full-width
  punctuation 。，；（）; ES: inverted ¿¡ where applicable).
- Don't translate the brand name "Tiny World Builder", `$TINYWORLD`, or proper UI keys.
- Keyboard hints: localize the verb, keep the key name (`Échap`, `Esc`).

## Glossary (keep these consistent across new strings)

| English | fr | es | zh |
|---|---|---|---|
| world (the build) | monde | mundo | 世界 |
| grid / board | grille / plateau | cuadrícula / tablero | 网格 / 面板 |
| Grass | Herbe | Hierba | 草地 |
| Path | Chemin | Camino | 小路 |
| Water | Eau | Agua | 水 |
| House | Maison | Casa | 房屋 |
| Island | Île | Isla | 岛屿 |
| Fence | Clôture | Valla | 栅栏 |
| Bridge | Pont | Puente | 桥 |
| Crowd | Foule | Multitud | 人群 |
| Layers / Properties | Calques / Propriétés | Capas / Propiedades | 图层 / 属性 |
| Settings | Réglages | Ajustes | 设置 |
| Showcase mode | Mode présentation | Modo exhibición | 展示模式 |
| Reset | Réinitialiser | Reiniciar | 重置 |
| Clear | Effacer / remettre en herbe | Vaciar | 清空 |
| Select / Move | Sélection / Déplacer | Seleccionar / Mover | 选择 / 移动 |

## Adding a new language (e.g. German `de`)

1. `cp engine/i18n/en.js engine/i18n/de.js`, change `g.en` → `g.de`, translate all values.
2. Add `'de'` to `SUPPORTED` and a `de:` endonym to `NAMES` in `engine/i18n/i18n-core.js`.
3. Add `<script src="engine/i18n/de.js"></script>` before `i18n-core.js` in
   `tiny-world-builder.html` (the i18n block, right after `vendor/tinyworld-auth.js`).
4. Add a `<option value="de">Deutsch</option>` to `#ui-lang-mode` in the Workspace
   settings panel.
5. Add `'de'` to the `LOCALES` array in `tools/i18n-check.js`.
6. `npm run i18n:check`, then verify with `?lang=de`.
