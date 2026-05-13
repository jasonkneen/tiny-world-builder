#!/usr/bin/env node
// Local webhook receiver for Cluso annotations.
// - Listens on http://localhost:7878
// - POST  /          → appends body to tools/cluso-events.jsonl
// - GET   /events    → returns the full log as a JSON array (newest last)
// - GET   /latest    → returns the most recent event (or 204 if empty)
// - GET   /clear     → truncates the log
// - GET   /health    → liveness probe
//
// Usage: node tools/cluso-webhook.js [port]
// Then in Cluso settings → Automations → Webhooks, paste:
//   http://localhost:7878/
// and enable webhooks. Hit Send (or any annotation action) to fire.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2] || process.env.CLUSO_WEBHOOK_PORT || 7878);
const LOG_FILE = path.join(__dirname, 'cluso-events.jsonl');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function readLog() {
  if (!fs.existsSync(LOG_FILE)) return [];
  return fs
    .readFileSync(LOG_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return { _raw: line }; }
    });
}

function appendEvent(obj) {
  fs.appendFileSync(LOG_FILE, JSON.stringify(obj) + '\n');
}

function send(res, status, body, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS, ...extraHeaders });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  const url = req.url || '/';

  if (req.method === 'POST') {
    let buf = '';
    req.on('data', (chunk) => { buf += chunk; });
    req.on('end', () => {
      let parsed = null;
      try { parsed = JSON.parse(buf); } catch { parsed = { _raw: buf }; }
      const stamped = { receivedAt: new Date().toISOString(), ...parsed };
      appendEvent(stamped);
      console.log(`[cluso-webhook] ${stamped.event || 'event'} ←`, JSON.stringify(parsed).slice(0, 240));
      send(res, 200, { ok: true });
    });
    return;
  }

  if (req.method === 'GET' && url.startsWith('/events')) {
    return send(res, 200, readLog());
  }

  if (req.method === 'GET' && url.startsWith('/latest')) {
    const log = readLog();
    if (!log.length) {
      res.writeHead(204, CORS);
      return res.end();
    }
    return send(res, 200, log[log.length - 1]);
  }

  if (req.method === 'GET' && url.startsWith('/clear')) {
    fs.writeFileSync(LOG_FILE, '');
    return send(res, 200, { ok: true, cleared: true });
  }

  if (req.method === 'GET' && url.startsWith('/health')) {
    return send(res, 200, { ok: true, port: PORT, logFile: LOG_FILE, count: readLog().length });
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[cluso-webhook] listening on http://localhost:${PORT}`);
  console.log(`[cluso-webhook] log: ${LOG_FILE}`);
  console.log(`[cluso-webhook] paste this in Cluso settings → Automations → Webhooks:`);
  console.log(`                http://localhost:${PORT}/`);
});
