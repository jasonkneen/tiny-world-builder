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
  dist/assets/*.png               Screenshots/assets
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
node <<'NODE'
const fs = require('fs');
const html = fs.readFileSync('tiny-world-builder.html', 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (!match) throw new Error('Could not find inline script in tiny-world-builder.html');
new Function(match[1]);
JSON.parse(fs.readFileSync('world.schema.json', 'utf8'));
console.log('✓ publish checks passed');
NODE

rm -rf "$DIST"
mkdir -p "$DIST/assets"

# Bundle the auth library for the browser
npx esbuild src/auth-bundle.js --bundle --format=iife --minify --outfile="$DIST/auth.js"

cp tiny-world-builder.html "$DIST/index.html"
cp tiny-world-builder.html "$DIST/tiny-world-builder.html"
cp world.schema.json "$DIST/world.schema.json"
cp README.md "$DIST/README.md"
cp LICENSE "$DIST/LICENSE"

for img in tinyworld-*.png; do
  [[ -e "$img" ]] || continue
  cp "$img" "$DIST/assets/$img"
done

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
