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
  dist/index.html                 Browser entry point
  dist/tiny-world-builder.html    Original app filename
  dist/world.schema.json
  dist/README.md
  dist/LICENSE
  dist/assets/*                   Screenshots/assets
  dist/vendor/*                   Self-hosted runtime libraries
  dist/textures/*                 User-selectable material textures
  dist/sounds/*.mp3               Music + foley used by the app
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

# Lightweight sanity checks before publishing.
node tools/check.js
node tools/smoke-static.js
printf '✓ publish checks passed\n'

rm -rf "$DIST"
mkdir -p "$DIST/assets"

cp tiny-world-builder.html "$DIST/index.html"
cp tiny-world-builder.html "$DIST/tiny-world-builder.html"
cp LandscapeEngine.js "$DIST/LandscapeEngine.js"
cp world.schema.json "$DIST/world.schema.json"
cp README.md "$DIST/README.md"
cp LICENSE "$DIST/LICENSE"

for img in tinyworld-*.png plane-*.jpg perf-after.jpg; do
  [[ -e "$img" ]] || continue
  cp "$img" "$DIST/assets/$img"
done

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
  (cd models && find . -type f ! -name '.DS_Store' -exec sh -c '
    for f do
      mkdir -p "../dist/models/$(dirname "$f")"
      cp "$f" "../dist/models/$f"
    done
  ' sh {} +)
fi

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
