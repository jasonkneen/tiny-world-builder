#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$ROOT/dist"
ZIP=0

for arg in "$@"; do
  case "$arg" in
    --zip) ZIP=1 ;;
    -h|--help)
      cat <<'HELP'
Usage: ./publish.sh [--zip]

Creates a clean dist/ folder for publishing Tiny World Builder.

Outputs:
  dist/index.html                 Landing page entry point
  dist/tiny-world-builder.html    Original app filename
  dist/world.schema.json
  dist/README.md
  dist/LICENSE
  dist/assets/*                   Screenshots/assets
  dist/vendor/*                   Self-hosted runtime libraries
  dist/textures/*                 User-selectable material textures
  dist/sounds/*.mp3               Music + foley used by the app
  dist/models/stamp-manifest.json Auto-generated placeable model stamp index
  dist/.nojekyll                  GitHub Pages compatibility
  dist/VERSION.txt                Build metadata

Options:
  --zip   Also create tinyworld-dist.zip at repo root
HELP
      exit 0
      ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

cd "$ROOT"

if [[ ! -f tiny-world-builder.html ]]; then
  echo "Missing tiny-world-builder.html" >&2
  exit 1
fi
if [[ ! -f index.html ]]; then
  echo "Missing index.html" >&2
  exit 1
fi

# Lightweight sanity checks before publishing.
node tools/check.js
node tools/smoke-static.js
printf '✓ publish checks passed\n'

rm -rf "$DIST"
mkdir -p "$DIST/assets"

cp index.html "$DIST/index.html"
cp tiny-world-builder.html "$DIST/tiny-world-builder.html"
cp roadmap.html "$DIST/roadmap.html"
cp news.html "$DIST/news.html"
cp docs.html "$DIST/docs.html"
cp doc.html "$DIST/doc.html"
cp features.html "$DIST/features.html"
cp community.html "$DIST/community.html"
cp admin-users.html "$DIST/admin-users.html"
cp terms.html "$DIST/terms.html"
cp privacy.html "$DIST/privacy.html"
cp code-of-conduct.html "$DIST/code-of-conduct.html"
cp worlds.html "$DIST/worlds.html"
cp harvest.html "$DIST/harvest.html"
cp LandscapeEngine.js "$DIST/LandscapeEngine.js"
cp world.schema.json "$DIST/world.schema.json"

# Bootstrap defaults — written by the in-app "Save Defaults" button. Optional;
# if absent the app silently falls back to its hard-coded defaults.
if [[ -f tinyworld-defaults.json ]]; then
  cp tinyworld-defaults.json "$DIST/tinyworld-defaults.json"
fi

# Default island — the starter world loaded for a fresh session + Reset.
if [[ -f default_island.json ]]; then
  cp default_island.json "$DIST/default_island.json"
fi

# LandscapeEngine mixin modules referenced via engine/landscape/*.js script tags.
if [[ -d engine ]]; then
  mkdir -p "$DIST/engine"
  (cd engine && find . -type f ! -name '.DS_Store' -exec sh -c '
    for f do
      mkdir -p "../dist/engine/$(dirname "$f")"
      cp "$f" "../dist/engine/$f"
    done
  ' sh {} +)
fi

# Stylesheet referenced via <link rel="stylesheet" href="styles/tiny-world.css">.
# Without this the deployed page loads unstyled (the CSS 404s and is served as
# text/html), so keep it copied into dist.
if [[ -d styles ]]; then
  mkdir -p "$DIST/styles"
  (cd styles && find . -type f ! -name '.DS_Store' -exec sh -c '
    for f do
      mkdir -p "../dist/styles/$(dirname "$f")"
      cp "$f" "../dist/styles/$f"
    done
  ' sh {} +)
fi

# Small standalone page scripts for the landing/admin/community-adjacent pages.
if [[ -d scripts ]]; then
  mkdir -p "$DIST/scripts"
  (cd scripts && find . -type f ! -name '.DS_Store' -exec sh -c '
    for f do
      mkdir -p "../dist/scripts/$(dirname "$f")"
      cp "$f" "../dist/scripts/$f"
    done
  ' sh {} +)
fi

# Pre-baked tool icons (PNG + manifest) loaded by preloadStaticIcons().
# Regenerate with `npm run icons` after adding/changing a tool. Optional; the
# app falls back to inline SVGs when the icons are absent.
if [[ -d icons ]]; then
  mkdir -p "$DIST/icons"
  (cd icons && find . -type f ! -name '.DS_Store' -exec sh -c '
    for f do
      mkdir -p "../dist/icons/$(dirname "$f")"
      cp "$f" "../dist/icons/$f"
    done
  ' sh {} +)
fi

cp README.md "$DIST/README.md"
cp LICENSE "$DIST/LICENSE"

# Markdown docs rendered by doc.html (the styled in-site viewer).
if [[ -d docs ]]; then
  mkdir -p "$DIST/docs"
  for md in docs/*.md; do
    [[ -e "$md" ]] || continue
    cp "$md" "$DIST/$md"
  done
fi

for img in tinyworld-*.png plane-*.jpg perf-after.jpg; do
  [[ -e "$img" ]] || continue
  cp "$img" "$DIST/assets/$img"
done

# App UI assets referenced directly by HTML/CSS.
if [[ -d assets ]]; then
  mkdir -p "$DIST/assets"
  (cd assets && find . -type f ! -name '.DS_Store' -exec sh -c '
    dist="$1"
    shift
    for f do
      mkdir -p "$dist/assets/$(dirname "$f")"
      cp "$f" "$dist/assets/$f"
    done
  ' sh "$DIST" {} +)
fi

# Dev-only feedback tooling under cluso/ is intentionally not copied into dist.
# Production hosts must never load or display Cluso.

# Self-hosted runtime libraries referenced by vendor/<file> tags in the HTML.
if [[ -d vendor ]]; then
  mkdir -p "$DIST/vendor"
  (cd vendor && find . -type f ! -name '.DS_Store' -exec sh -c '
    for f do
      mkdir -p "../dist/vendor/$(dirname "$f")"
      cp "$f" "../dist/vendor/$f"
    done
  ' sh {} +)
fi

# Sounds — music + foley referenced by the app via sounds/<name>.mp3.
# The page expects this exact directory at the deploy root.
if [[ -d sounds ]]; then
  mkdir -p "$DIST/sounds"
  (cd sounds && find . -type f ! -name '.DS_Store' -exec sh -c '
    for f do
      mkdir -p "../dist/sounds/$(dirname "$f")"
      cp "$f" "../dist/sounds/$f"
    done
  ' sh {} +)
fi

# User-selectable material textures referenced by Settings → Materials.
if [[ -d textures ]]; then
  mkdir -p "$DIST/textures"
  (cd textures && find . -type f ! -name '.DS_Store' -exec sh -c '
    for f do
      mkdir -p "../dist/textures/$(dirname "$f")"
      cp "$f" "../dist/textures/$f"
    done
  ' sh {} +)
fi

# Published world JSON loadable via ?world=data/<name>.json (same-origin only).
# Optional; absent until world files are added under data/.
if [[ -d data ]]; then
  mkdir -p "$DIST/data"
  (cd data && find . -type f ! -name '.DS_Store' -exec sh -c '
    for f do
      mkdir -p "../dist/data/$(dirname "$f")"
      cp "$f" "../dist/data/$f"
    done
  ' sh {} +)
fi

# Crowd sprites referenced by the TinyCrowdLayer runtime.
if [[ -d crowd ]]; then
  mkdir -p "$DIST/crowd"
  (cd crowd && find . -type f ! -name '.DS_Store' -exec sh -c '
    for f do
      mkdir -p "../dist/crowd/$(dirname "$f")"
      cp "$f" "../dist/crowd/$f"
    done
  ' sh {} +)
fi

# 3D model assets referenced directly by the single-file app.
if [[ -d models ]]; then
  mkdir -p "$DIST/models"
  (cd models && find . -type f ! -name '.DS_Store' ! -name 'stamp-defaults.local.json' ! -name 'stamp-manifest.json' -exec sh -c '
    for f do
      mkdir -p "../dist/models/$(dirname "$f")"
      cp "$f" "../dist/models/$f"
    done
  ' sh {} +)
fi
node tools/model-stamps.js "$DIST/models/stamp-manifest.json"

: > "$DIST/.nojekyll"

{
  echo "Tiny World Builder dist"
  echo "Built: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Commit: $(git rev-parse --short HEAD)"
    if ! git diff --quiet -- tiny-world-builder.html world.schema.json README.md LICENSE publish.sh 2>/dev/null; then
      echo "Dirty: yes"
    else
      echo "Dirty: no"
    fi
  fi
} > "$DIST/VERSION.txt"

if [[ "$ZIP" -eq 1 ]]; then
  rm -f "$ROOT/tinyworld-dist.zip"
  (cd "$DIST" && zip -qr "$ROOT/tinyworld-dist.zip" .)
  echo "✓ Created tinyworld-dist.zip"
fi

echo "✓ Created dist/"
echo "  Open: dist/index.html"
