#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const DEFAULT_PORT = Number(process.env.TW_PERF_PORT || process.env.PORT || 3199);
const DEFAULT_PATH = process.env.TW_PERF_PATH || '/tiny-world-builder?perf=1&stats=1';
const PROBE_MS = Number(process.env.TW_PERF_MS || 12000);
const NAV_TIMEOUT_MS = Number(process.env.TW_PERF_NAV_TIMEOUT_MS || 18000);

function log(...args) {
  console.log('[perf-probe]', ...args);
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find(p => fs.existsSync(p));
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function get(url, timeout = 1500) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

async function waitForServer(url, timeoutMs = 8000) {
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const status = await get(url);
      if (status && status < 500) return;
    } catch (err) {
      lastErr = err;
    }
    await wait(150);
  }
  throw new Error('server did not respond at ' + url + (lastErr ? ': ' + lastErr.message : ''));
}

async function main() {
  const explicitUrl = process.env.TW_PERF_URL;
  const port = DEFAULT_PORT;
  const baseUrl = explicitUrl ? explicitUrl.replace(/\/?$/, '') : 'http://127.0.0.1:' + port;
  const url = explicitUrl || (baseUrl + DEFAULT_PATH);
  let server = null;

  if (!explicitUrl) {
    server = spawn(process.execPath, [path.join(root, 'tools', 'dev-server.js'), String(port)], {
      cwd: root,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', d => process.env.TW_PERF_VERBOSE && process.stdout.write('[dev] ' + d));
    server.stderr.on('data', d => process.stderr.write('[dev] ' + d));
    await waitForServer('http://127.0.0.1:' + port + '/tiny-world-builder');
  }

  const chromePath = findChrome();
  if (!chromePath) throw new Error('Chrome/Chromium executable not found. Set CHROME_PATH.');

  let chromium;
  try {
    const playwrightPath = path.join(root, 'tools', 'build-bridge', 'node_modules', 'playwright-core');
    ({ chromium } = require(playwrightPath));
  } catch (_) {
    console.error('[perf-probe] playwright-core not found. Install it with: npm i -D playwright-core');
    console.error('[perf-probe] Or ensure tools/build-bridge/node_modules/playwright-core exists.');
    process.exit(2);
  }
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: Number(process.env.TW_PERF_WIDTH || 1440), height: Number(process.env.TW_PERF_HEIGHT || 1000) },
    deviceScaleFactor: Number(process.env.TW_PERF_DPR || 1),
  });
  await context.addInitScript(() => {
    try {
      localStorage.removeItem('tinyworld_state_v1');
      localStorage.setItem('tinyworld:welcome:dismissedId', '2026-05-11-jigsaw');
    } catch (_) {}
  });

  const page = await context.newPage();
  page.setDefaultTimeout(3000);
  const messages = [];
  const pageErrors = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || type === 'warning') messages.push({ type, text: text.slice(0, 500) });
  });
  page.on('pageerror', err => pageErrors.push(String(err && err.stack || err).slice(0, 1000)));

  const navStart = Date.now();
  let nav = { ok: true, error: null, elapsedMs: 0 };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  } catch (err) {
    nav = { ok: false, error: err.message, elapsedMs: Date.now() - navStart };
  }
  nav.elapsedMs = Date.now() - navStart;

  await wait(PROBE_MS);

  async function safeEval(label, fn) {
    try {
      return { label, ok: true, value: await page.evaluate(fn) };
    } catch (err) {
      return { label, ok: false, error: err.message };
    }
  }

  const snapshot = await safeEval('snapshot', () => {
    const navEntry = performance.getEntriesByType('navigation')[0];
    const marks = (window.__tinyworldPerf && window.__tinyworldPerf.marks) || [];
    let app = null;
    try {
      app = {
        grid: typeof GRID !== 'undefined' ? GRID : null,
        cellMeshes: typeof cellMeshes !== 'undefined' ? Object.keys(cellMeshes).length : null,
        homeQueue: typeof homeRenderQueue !== 'undefined' ? Math.max(0, homeRenderQueue.length - (homeRenderQueueCursor || 0)) : null,
        ghostBoards: typeof ghostBoards !== 'undefined' ? ghostBoards.size : null,
        pendingGhostBoards: typeof pendingGhostBoards !== 'undefined' ? pendingGhostBoards.length : null,
        thumbScenes: typeof thumbScenes !== 'undefined' ? thumbScenes.size : null,
        thumbQueue: typeof toolThumbBuildQueue !== 'undefined' ? toolThumbBuildQueue.length : null,
        rendererInfo: typeof renderer !== 'undefined' && renderer ? {
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          pixelRatio: renderer.getPixelRatio(),
        } : null,
      };
    } catch (err) {
      app = { error: err.message };
    }
    return {
      readyState: document.readyState,
      now: Math.round(performance.now()),
      nav: navEntry ? {
        domContentLoaded: Math.round(navEntry.domContentLoadedEventEnd),
        loadEventEnd: Math.round(navEntry.loadEventEnd),
        duration: Math.round(navEntry.duration),
      } : null,
      marks,
      longTasks: performance.getEntriesByType('longtask').slice(-20).map(e => ({ name: e.name, start: Math.round(e.startTime), duration: Math.round(e.duration) })),
      app,
    };
  });

  const fps = await safeEval('fps', () => new Promise(resolve => {
    let frames = 0;
    const start = performance.now();
    function tick(now) {
      frames++;
      if (now - start >= 1000) {
        resolve({ frames, fps: +(frames * 1000 / (now - start)).toFixed(1), elapsed: Math.round(now - start) });
      } else {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  }));

  const metrics = await safeEval('browserMetrics', async () => {
    if (!performance.measureUserAgentSpecificMemory) return null;
    try { return await performance.measureUserAgentSpecificMemory(); }
    catch (_) { return null; }
  });

  const result = {
    url,
    probeMs: PROBE_MS,
    navigation: nav,
    console: messages.slice(-20),
    pageErrors,
    snapshot,
    fps,
    metrics,
  };
  console.log(JSON.stringify(result, null, 2));

  try {
    await Promise.race([browser.close(), wait(2500)]);
  } catch (_) {}
  if (server) server.kill('SIGTERM');

  const snap = snapshot.ok ? snapshot.value : null;
  if (!nav.ok || !snapshot.ok || !fps.ok || pageErrors.length) process.exitCode = 1;
  if (snap && snap.readyState !== 'complete' && snap.readyState !== 'interactive') process.exitCode = 1;
}

main().catch(err => {
  console.error('[perf-probe] failed:', err && err.stack || err);
  process.exitCode = 1;
});
