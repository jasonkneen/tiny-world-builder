---
name: tinyworld-single-file
description: Use when editing the Tiny World Builder repo, especially tiny-world-builder.html, to preserve the static classic-script Three.js r185 app structure and local edit/reload workflow.
---

# Tiny World Single-File Workflow

Work mainly in `tiny-world-builder.html`; also update `index.html`, `vendor/three/`, `publish.sh`, checks, docs, or skills when a change affects those durable contracts.

Core rules:

- Keep the builder app single-file at runtime: inline CSS, inline JS, no bundler, no npm runtime packages.
- Root `index.html` is a static landing page entry point; the builder remains available at `/tiny-world-builder` and `/tiny-world-builder.html`.
- `random-island-preview.html` is a standalone local-dev control shell for random-island reveal/card iteration. It embeds `/tiny-world-builder?randomIslandPreview=1` so the visible island is the real Three.js game renderer, then talks to the app by `postMessage` to generate, load, and export reveal/game JSON. Production Netlify shares it through the private `netlify/functions/random-island-preview.mjs` route instead of copying the HTML as a public static file.
- Do not touch `tiny-world-builder BACKUP.html` if present.
- Preserve style: 2-space indent, semicolons, single-quoted strings, section comments like `// -------- tools --------`.
- Mutate board state through `setCell(x, z, opts)`, not direct `world[x][z]` writes outside initialization.
- Keep Three.js pinned to r185 and self-hosted under `vendor/three/`; do not reintroduce CDN runtime scripts. The app consumes `vendor/three/tinyworld-three.r185.min.js`, a generated classic-global bundle made from `three@0.185.0`; regenerate it with `npm run vendor:three` after changing `three` or loader wiring.
- If browser stack traces point at `tiny-world-builder` / `dist/LandscapeEngine.js` line numbers after source edits, run `npm run build` so `dist/index.html`, `dist/tiny-world-builder.html`, and `dist/LandscapeEngine.js` are regenerated before judging the runtime.
- Cluso's in-page embed is allowed in LOCAL DEV ONLY, injected at runtime by
  `tools/dev-server.js` (never written into the committed HTML or `dist/`). The
  assets live under gitignored `cluso/` and `publish.sh` excludes that dir, so
  `tools/check.js` / `tools/smoke-static.js` (which scan the shipped HTML) stay
  green. Do NOT add `cluso/cluso-embed.{js,css}` references to
  `tiny-world-builder.html` or any committed/shipped HTML — production must never
  load it. (Owner-approved override of the prior "no Cluso, even local" rule.)
- Shared materials in `M.*` must not be mutated per instance; clone first for unique opacity/material behavior and dispose cloned materials in `disposeGroup`.

Validation:

- Run `npm test` (syntax-checks the inline app script, parses `world.schema.json`, verifies embedded schema parity, checks local script/link assets, and runs the no-browser smoke guard).
- For targeted parser checks, run `perl -0ne 'print $1 if m#<script>\s*(.*?)\s*</script>#s' tiny-world-builder.html | node --check`.
- Prefer browser validation at `http://localhost:3000/tiny-world-builder`.
- Check console errors after visual/UI changes.

## Inline `<script>` gotcha (has burned us twice)

`tools/check.js` extracts the main app script with this regex:

```js
html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
```

It greedily matches from the **first plain `<script>`** through to the last
`</script></body>`. If you add another inline `<script>` block above the main
app (e.g. a defaults bootstrap), it MUST carry an HTML attribute or `check.js`
conflates the two scripts plus the literal `</script><script>` separator into
one parse target and throws `Unexpected token '<'`.

```html
<script id="my-bootstrap">...</script>   <!-- ✓ regex skips this -->
<script>...</script>                     <!-- ✗ becomes part of main app -->
```

## Related durable systems

For persisted runtime state (defaults pipeline, audio, camera, panel
positions, feature flags) see `.codex/skills/tinyworld-runtime-state`.
For island layout, sponsor banner, plane/crop-duster flight paths see
`.codex/skills/tinyworld-island-and-planes`.
