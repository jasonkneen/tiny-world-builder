#!/usr/bin/env node
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || process.argv[2] || 3000);

function loadEnvFile() {
  const envPath = path.resolve(root, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

loadEnvFile();

const types = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers,
  });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, {
    Location: location,
    'Cache-Control': 'no-store',
  });
  res.end();
}

function readJsonBody(req, maxBytes = 24 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function choose(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function numberInRange(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function voxelPartsSchema(allowedMaterials) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      notes: { type: 'string' },
      customParts: {
        type: 'array',
        maxItems: 180,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            kind: { type: 'string', enum: ['box', 'cylinder', 'cone'] },
            material: { type: 'string', enum: allowedMaterials.length ? allowedMaterials : ['stone'] },
            size: {
              type: 'array',
              minItems: 3,
              maxItems: 3,
              items: { type: 'number' },
            },
            pos: {
              type: 'array',
              minItems: 3,
              maxItems: 3,
              items: { type: 'number' },
            },
            scale: {
              type: 'array',
              minItems: 3,
              maxItems: 3,
              items: { type: 'number' },
            },
          },
          required: ['id', 'kind', 'material', 'size', 'pos', 'scale'],
        },
      },
    },
    required: ['notes', 'customParts'],
  };
}

function extractJsonText(response) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text;
  const chunks = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) chunks.push(content.text);
      if (content.type === 'text' && content.text) chunks.push(content.text);
    }
  }
  return chunks.join('\n');
}

function parseModelJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Model returned no text');
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1]);
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw err;
  }
}

function openaiRequest(payload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Promise.reject(new Error('OPENAI_API_KEY is not set in this dev server environment'));
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/responses',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (apiRes) => {
      let raw = '';
      apiRes.on('data', (chunk) => {
        raw += chunk;
      });
      apiRes.on('end', () => {
        let parsed;
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch (err) {
          reject(new Error(`OpenAI returned non-JSON response (${apiRes.statusCode})`));
          return;
        }
        if (apiRes.statusCode < 200 || apiRes.statusCode >= 300) {
          reject(new Error(parsed.error?.message || `OpenAI request failed with ${apiRes.statusCode}`));
          return;
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function handleReinterpretStamp(req, res) {
  try {
    const input = await readJsonBody(req);
    const model = String(input.model || 'gpt-5.5').trim();
    const allowedMaterials = Array.isArray(input.allowedMaterials) ? input.allowedMaterials : [];
    const reasoningEffort = choose(input.reasoningEffort, ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'], 'low');
    const reasoningSummary = choose(input.reasoningSummary, ['off', 'auto', 'concise', 'detailed'], 'off');
    const textVerbosity = choose(input.textVerbosity, ['low', 'medium', 'high'], 'low');
    const maxOutputTokens = numberInRange(input.maxOutputTokens, 12000, 1000, 128000);
    const schemaInstruction = [
      'You are generating geometry for a Three.js voxel stamp builder.',
      'Return ONLY valid JSON, no markdown.',
      'The JSON shape must be: {"customParts":[...], "notes":"short optional note"}.',
      'Each customParts item must be:',
      '{"id": string, "kind": "box"|"cylinder"|"cone", "material": one of allowedMaterials, "size": [x,y,z], "pos": [x,y,z], "scale": [1,1,1]}.',
      'Use semantic reinterpretation: do not merely stretch source parts.',
      'Increase detail with small trim blocks, windows, roof ribs, railings, bevel-like layered bands, doors, caps, and silhouette-defining parts.',
      'Keep total customParts under 180 and dimensions within a compact stamp footprint.',
    ].join('\n');
    const userText = JSON.stringify({
      allowedMaterials,
      selectedObject: input.selectedObject || null,
      sourceParts: input.sourceParts || [],
      desiredScale: input.desiredScale || [1, 1, 1],
      style: input.style || 'low-poly voxel diorama',
      imageInstruction: input.imageDataUrl ? 'Use the attached image as visual reference for the stamp.' : 'Use selectedObject/sourceParts as reference.',
    });
    const content = [
      { type: 'input_text', text: `${schemaInstruction}\n\nINPUT:\n${userText}` },
    ];
    if (input.imageDataUrl) content.push({ type: 'input_image', image_url: input.imageDataUrl, detail: 'high' });
    const requestPayload = {
      model,
      input: [{ role: 'user', content }],
      max_output_tokens: maxOutputTokens,
      reasoning: { effort: reasoningEffort },
      text: {
        verbosity: textVerbosity,
        format: {
          type: 'json_schema',
          name: 'voxel_stamp_parts',
          strict: true,
          schema: voxelPartsSchema(allowedMaterials),
        },
      },
    };
    if (reasoningSummary !== 'off') requestPayload.reasoning.summary = reasoningSummary;
    const response = await openaiRequest(requestPayload);
    const rawText = extractJsonText(response);
    const parsed = parseModelJson(rawText);
    send(res, 200, JSON.stringify({
      ok: true,
      model,
      reasoningEffort,
      reasoningSummary,
      textVerbosity,
      maxOutputTokens,
      imageUsed: Boolean(input.imageDataUrl),
      rawText,
      ...parsed,
    }), {
      'Content-Type': 'application/json; charset=utf-8',
    });
  } catch (err) {
    send(res, 500, JSON.stringify({ ok: false, error: err.message || String(err) }), {
      'Content-Type': 'application/json; charset=utf-8',
    });
  }
}

function routeForRequest(reqUrl) {
  const parsed = new URL(reqUrl, 'http://localhost');
  const pathname = decodeURIComponent(parsed.pathname);

  // Normal access: show the welcome menu (defaults to Farm)
  if (pathname === '/') return { redirect: '/tiny-world-builder' };
  if (pathname === '/tiny-world-builder') return { file: path.resolve(root, 'tiny-world-builder.html') };

  const resolved = path.resolve(root, '.' + pathname);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return null;
  return { file: resolved };
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, 'http://localhost');
  if (req.method === 'OPTIONS') {
    send(res, 204, '');
    return;
  }
  if (parsedUrl.pathname === '/api/reinterpret-stamp') {
    if (req.method !== 'POST') {
      send(res, 405, 'Method Not Allowed', { Allow: 'POST' });
      return;
    }
    handleReinterpretStamp(req, res);
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }
  const route = routeForRequest(req.url);
  if (!route) {
    send(res, 403, 'Forbidden');
    return;
  }
  if (route.redirect) {
    redirect(res, route.redirect);
    return;
  }
  const file = route.file;
  fs.stat(file, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      send(res, 404, 'Not Found');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': types[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(file).pipe(res);
  });
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Try: npm run dev -- ${port + 1}`);
  } else {
    console.error(err && err.stack ? err.stack : err);
  }
  process.exit(1);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Tiny World dev server: http://localhost:${port}/tiny-world-builder`);
  console.log(`  → Shows welcome menu (defaults to Farm preset)`);
  console.log(`  → Click "Vehicle Demo" button for cars/trucks`);
  console.log(`  Or append ?demo=vehicles to jump straight to vehicle demo`);
  console.log('Press Ctrl+C to stop.');
});
