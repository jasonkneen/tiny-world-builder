#!/usr/bin/env node
'use strict';

// Pre-bake toolbar/ghost icons to PNG.
//
// The app's tool palette and placement ghost used to render every icon with a
// live off-DOM WebGL renderer. That is expensive at startup and on every
// cursor move. Instead we bake one transparent PNG per tool/variant here,
// once, and ship them in icons/. At runtime the app loads them straight into
// its thumbnail cache (see preloadStaticIcons in 19-tools-toolbar.js), so the
// WebGL thumbnail renderer is never created for any tool that has an icon.
//
// How it works: launch the real app in headless Chromium (software WebGL via
// SwiftShader), call the in-app window.__twBakeIcons() hook — which reuses the
// app's own voxel/model factories and framing — and write each returned data
// URL to disk. Run with:  npm run icons
//
// Requires Playwright + a Chromium build (already present in this repo's
// container). It is a dev/build tool only; production never imports it.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ICON_DIR = path.join(ROOT, 'icons');
const PORT = Number(process.env.ICON_BAKE_PORT || 3219);
const URL = `http://localhost:${PORT}/tiny-world-builder`;

function loadPlaywright() {
  const candidates = [
    'playwright',
    '/opt/node22/lib/node_modules/playwright',
    '/usr/lib/node_modules/playwright',
  ];
  for (const c of candidates) {
    try { return require(c); } catch (_) {}
  }
  throw new Error('Playwright not found. Install it (npm i -D playwright) to bake icons.');
}

function waitForServer(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: 'localhost', port, path: '/tiny-world-builder' }, res => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error('dev server did not start'));
        else setTimeout(tick, 150);
      });
    };
    tick();
  });
}

function safeFilename(key) {
  return key.replace(/[^a-z0-9_-]+/gi, '__').toLowerCase() + '.png';
}

async function main() {
  const { chromium } = loadPlaywright();

  // Start the project's static dev server so the app loads with all modules.
  const server = spawn('node', [path.join(ROOT, 'tools', 'dev-server.js'), String(PORT)], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const cleanup = () => { try { server.kill(); } catch (_) {} };
  process.on('exit', cleanup);

  try {
    await waitForServer(PORT, 15000);

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--ignore-gpu-blocklist',
        '--no-sandbox',
      ],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));

    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof window.__twBakeIcons === 'function', { timeout: 30000 });
    // Let textures/materials settle so first renders aren't blank.
    await page.waitForTimeout(1500);

    const icons = await page.evaluate(() => window.__twBakeIcons());
    if (!Array.isArray(icons) || !icons.length) {
      throw new Error('__twBakeIcons returned no icons');
    }

    fs.mkdirSync(ICON_DIR, { recursive: true });
    const manifest = { version: 1, generatedAt: new Date().toISOString(), icons: {} };
    for (const { key, url } of icons) {
      if (!key || !url || !url.startsWith('data:image/png;base64,')) continue;
      const file = safeFilename(key);
      const data = Buffer.from(url.slice('data:image/png;base64,'.length), 'base64');
      fs.writeFileSync(path.join(ICON_DIR, file), data);
      manifest.icons[key] = file;
    }
    fs.writeFileSync(
      path.join(ICON_DIR, 'manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    );

    await browser.close();

    const count = Object.keys(manifest.icons).length;
    console.log(`Baked ${count} icons -> ${path.relative(ROOT, ICON_DIR)}/`);
    if (pageErrors.length) {
      console.warn('Page errors during bake:\n  ' + pageErrors.slice(0, 5).join('\n  '));
    }
  } finally {
    cleanup();
  }
}

main().catch(err => {
  console.error('bake-icons failed:', err.message);
  process.exit(1);
});
