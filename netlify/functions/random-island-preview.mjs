import { getAuthUser } from './lib/auth.mjs';

export const config = { path: '/.netlify/functions/random-island-preview' };

const PREVIEW_OWNER_EMAILS = new Set([
  'jason@bouncingfish.com',
  'jason.kneen@bouncingfish.com',
  'jason.kneen@gmail.com',
]);

function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}

function gateHtml(message) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TinyWorld Island Reveal Preview</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      color: #172133;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(180deg, #eef5f6, #dfe9e4);
    }
    main {
      width: min(520px, calc(100vw - 32px));
      padding: 28px;
      border: 1px solid rgba(255, 255, 255, 0.78);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.86);
      box-shadow: 0 22px 70px -38px rgba(20, 32, 52, 0.72);
    }
    h1 { margin: 0 0 10px; font: 760 28px/1.05 Georgia, "Times New Roman", serif; }
    p { margin: 0 0 18px; color: #5a687a; line-height: 1.5; }
    a {
      display: inline-flex;
      min-height: 40px;
      align-items: center;
      padding: 0 14px;
      border-radius: 999px;
      color: #fff;
      background: #276ad8;
      text-decoration: none;
      font-weight: 760;
    }
  </style>
</head>
<body>
  <main>
    <h1>Jason-only island preview</h1>
    <p>${message}</p>
    <a href="/tiny-world-builder">Sign in to TinyWorld</a>
  </main>
</body>
</html>`;
}

function previewHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TinyWorld Island Reveal Preview</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="styles/random-island-preview.css">
</head>
<body>
  <main class="rip-shell">
    <section class="rip-toolbar" aria-label="Island reveal preview controls">
      <div class="rip-brand">
        <span class="rip-kicker">TinyWorld</span>
        <h1>Island Reveal</h1>
      </div>
      <form class="rip-controls" id="rip-controls">
        <label>
          <span>Archetype</span>
          <select id="rip-archetype">
            <option value="random">Random</option>
            <option value="pastoral">Pastoral</option>
            <option value="forest">Forest</option>
            <option value="quarry">Quarry</option>
            <option value="river">River</option>
            <option value="village">Village</option>
            <option value="fortress">Fortress</option>
            <option value="ruins">Ruins</option>
            <option value="harbor">Harbor</option>
          </select>
        </label>
        <label>
          <span>Grid</span>
          <select id="rip-grid-size">
            <option value="8">8 x 8</option>
            <option value="10">10 x 10</option>
            <option value="12">12 x 12</option>
            <option value="16">16 x 16</option>
            <option value="20">20 x 20</option>
          </select>
        </label>
        <label class="rip-seed-field">
          <span>Seed</span>
          <input id="rip-seed" type="text" autocomplete="off">
        </label>
        <button type="submit" class="rip-primary">Random</button>
        <button type="button" id="rip-save-reveal">Save Island File</button>
        <button type="button" id="rip-save-world">Save Game JSON</button>
        <button type="button" id="rip-load-button">Load</button>
        <input id="rip-load-file" type="file" accept=".json,application/json" hidden>
      </form>
      <div class="rip-status" id="rip-status" role="status">Starting real TinyWorld renderer...</div>
    </section>

    <section class="rip-frame-wrap" aria-label="Real TinyWorld island reveal">
      <iframe
        id="rip-frame"
        title="TinyWorld rendered island reveal"
        src="about:blank"
        allow="fullscreen"
      ></iframe>
    </section>
  </main>
  <script src="scripts/random-island-preview.js"></script>
</body>
</html>`;
}

export default async function randomIslandPreview(request) {
  const user = await getAuthUser(request);
  const email = String(user && user.email || '').trim().toLowerCase();
  if (!email) {
    return htmlResponse(gateHtml('This screen is a private preview. Sign in as Jason, then reopen the island preview link.'), 401);
  }
  if (!PREVIEW_OWNER_EMAILS.has(email)) {
    return htmlResponse(gateHtml('This private island preview is currently shared only with Jason.'), 403);
  }
  return htmlResponse(previewHtml());
}
