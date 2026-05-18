#!/usr/bin/env node
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || process.argv[2] || 3000);
const aiLogDir = path.resolve(root, '.tinyworld-ai-logs');
const aiLogFile = path.resolve(aiLogDir, 'ai-debug.jsonl');

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

function createLogId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeForLog(value, depth = 0) {
  if (depth > 8) return '[depth-limit]';
  if (value == null) return value;
  if (typeof value === 'string') {
    if (/^data:image\//i.test(value)) return `[image-data-url ${value.length} chars]`;
    if (value.length > 4000) return value.slice(0, 4000) + `...[truncated ${value.length - 4000} chars]`;
    return value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    if (value.length > 2200) {
      return {
        truncatedArray: true,
        length: value.length,
        sample: value.slice(0, 2200).map(item => sanitizeForLog(item, depth + 1)),
      };
    }
    return value.map(item => sanitizeForLog(item, depth + 1));
  }
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (/authorization|api[_-]?key|token|secret|password/i.test(key)) {
      out[key] = '[redacted]';
      continue;
    }
    out[key] = sanitizeForLog(item, depth + 1);
  }
  return out;
}

function appendAiLog(entry) {
  try {
    fs.mkdirSync(aiLogDir, { recursive: true });
    const row = {
      id: entry.id || createLogId(entry.kind || 'ai'),
      at: new Date().toISOString(),
      ...sanitizeForLog(entry),
    };
    fs.appendFileSync(aiLogFile, JSON.stringify(row) + '\n');
    return row.id;
  } catch (err) {
    console.warn('[ai-log] failed to write log:', err.message || err);
    return entry.id || null;
  }
}

function readAiLog(limit = 40) {
  if (!fs.existsSync(aiLogFile)) return [];
  const lines = fs.readFileSync(aiLogFile, 'utf8').trim().split(/\n/).filter(Boolean);
  return lines.slice(-limit).map(line => {
    try { return JSON.parse(line); } catch (_) { return { parseError: true, line }; }
  });
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
  const logId = createLogId('reinterpret');
  try {
    const input = await readJsonBody(req);
    const model = String(input.model || 'gpt-5.5').trim();
    const allowedMaterials = Array.isArray(input.allowedMaterials) ? input.allowedMaterials : [];
    const reasoningEffort = choose(input.reasoningEffort, ['none', 'low', 'medium', 'high', 'xhigh'], 'low');
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
      'Preserve selectedObject.label, selectedObject.stamp, and the sourceCustomParts category exactly unless instruction explicitly asks for a different object.',
      'Do not introduce Japanese, pagoda, temple, shrine, torii, sakura, or garden styling unless the instruction or selectedObject explicitly asks for it.',
      'Keep all returned parts grounded, connected to the selected object, and inside allowedBounds when provided.',
      'Do not create detached floating rings, detached columns, orbiting blocks, crosses, or symbols.',
    ].join('\n');
    const userText = JSON.stringify({
      allowedMaterials,
      instruction: input.instruction || '',
      selectedObject: input.selectedObject || null,
      sourceParts: input.sourceParts || [],
      sourceCustomParts: input.sourceCustomParts || [],
      sourceBounds: input.sourceBounds || null,
      allowedBounds: input.allowedBounds || null,
      renderFootprint: input.renderFootprint || null,
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
    appendAiLog({
      id: logId,
      kind: 'reinterpret-stamp',
      phase: 'request',
      model,
      input,
      requestPayload,
    });
    const response = await openaiRequest(requestPayload);
    const rawText = extractJsonText(response);
    const parsed = parseModelJson(rawText);
    appendAiLog({
      id: logId,
      kind: 'reinterpret-stamp',
      phase: 'response',
      model,
      rawText,
      parsed,
      outputSummary: {
        customParts: Array.isArray(parsed.customParts) ? parsed.customParts.length : 0,
        notes: parsed.notes || '',
      },
    });
    send(res, 200, JSON.stringify({
      ok: true,
      logId,
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
    appendAiLog({
      id: logId,
      kind: 'reinterpret-stamp',
      phase: 'error',
      error: err.message || String(err),
    });
    send(res, 500, JSON.stringify({ ok: false, error: err.message || String(err) }), {
      'Content-Type': 'application/json; charset=utf-8',
    });
  }
}

function voxelBuildSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'voxels'],
    properties: {
      name: { type: 'string' },
      voxels: {
        type: 'array',
        minItems: 80,
        maxItems: 1800,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['x', 'y', 'z', 'color'],
          properties: {
            x: { type: 'integer' },
            y: { type: 'integer' },
            z: { type: 'integer' },
            color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
          },
        },
      },
    },
  };
}

async function handleEnhanceVoxelBuild(req, res) {
  const logId = createLogId('enhance-build');
  try {
    const input = await readJsonBody(req);
    const model = String(input.model || 'gpt-5.5').trim();
    const stamp = input.stamp || {};
    const instruction = String(input.instruction || stamp.instruction || 'Enhance this selected object as a richer voxel build.');
    const schema = voxelBuildSchema();
    const requestPayload = {
      model,
      input: [{
        role: 'user',
        content: [{
          type: 'input_text',
          text: [
            'You enhance selected voxel stamps for Tiny World Builder.',
            'Return JSON only. Preserve the selected object category, footprint, scale, and readable chunky voxel look.',
            'Follow selectedKind, sourceCell, style, and requirements in the payload over generic style assumptions.',
            'The source voxels are already upscaled onto a high-resolution coordinate grid. Keep that resolution.',
            'Every returned voxel must stay inside allowedBounds when allowedBounds is present.',
            'Do not create floating orbit rings, detached columns, detached symbols, or unsupported chunks. Decorative voxels must touch or visually attach to the source object/base.',
            'The renderer will place this stamp inside one selected tile by default, so keep the object compact and centered.',
            'Do not collapse the object into large rectangular blocks. Do not fill the whole bounding box solid.',
            'Add higher-resolution voxel detail appropriate to selectedKind. Rocks stay geological, trees stay organic, buildings stay architectural.',
            'Do not introduce Japanese garden, shrine, temple, pagoda, torii, sakura, roof, window, door, or lantern details unless the selected object or user instruction explicitly asks for them.',
            'For buildings, keep roof, walls, windows, door, base, trim, and details readable without changing the building into a different object type.',
            'Use many small voxels and visible silhouette breaks. Target at least the requested targetVoxelCount where possible.',
            'Do not return prose or markdown.',
            '',
            'Selected object payload:',
            JSON.stringify({
              instruction,
              name: stamp.name || 'selected object',
              selectedKind: stamp.selectedKind || 'voxel-build',
              selectedLabel: stamp.selectedLabel || stamp.name || 'selected object',
              seedId: stamp.seedId || null,
              style: stamp.style || 'Tiny World low-poly voxel diorama, readable chunky blocks',
              sourceCell: stamp.sourceCell || null,
              sourceCoord: stamp.sourceCoord || null,
              desiredScale: stamp.desiredScale || 1,
              sourceVoxelCount: stamp.sourceVoxelCount || (Array.isArray(stamp.voxels) ? stamp.voxels.length : 0),
              targetVoxelCount: stamp.targetVoxelCount || 240,
              requirements: stamp.requirements || [],
              voxels: Array.isArray(stamp.voxels) ? stamp.voxels : [],
            }),
          ].join('\n'),
        }],
      }],
      max_output_tokens: 12000,
      reasoning: { effort: 'low' },
      text: {
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: 'voxel_build',
          strict: true,
          schema,
        },
      },
    };
    appendAiLog({
      id: logId,
      kind: 'enhance-voxel-build',
      phase: 'request',
      model,
      input,
      requestPayload,
      before: input.before || input.stamp?.sourceCell || null,
      inputSummary: {
        selectedKind: stamp.selectedKind || 'voxel-build',
        selectedLabel: stamp.selectedLabel || stamp.name || 'selected object',
        seedId: stamp.seedId || null,
        sourceVoxelCount: Array.isArray(stamp.voxels) ? stamp.voxels.length : 0,
        sourceBounds: stamp.sourceBounds || null,
        allowedBounds: stamp.allowedBounds || null,
        renderFootprint: stamp.renderFootprint || null,
      },
    });
    const response = await openaiRequest(requestPayload);
    const rawText = extractJsonText(response);
    const parsed = parseModelJson(rawText);
    appendAiLog({
      id: logId,
      kind: 'enhance-voxel-build',
      phase: 'response',
      model,
      rawText,
      parsed,
      outputSummary: {
        name: parsed.name,
        voxels: Array.isArray(parsed.voxels) ? parsed.voxels.length : 0,
      },
    });
    send(res, 200, JSON.stringify({
      ok: true,
      logId,
      model,
      rawText,
      name: parsed.name,
      voxels: parsed.voxels,
    }), {
      'Content-Type': 'application/json; charset=utf-8',
    });
  } catch (err) {
    appendAiLog({
      id: logId,
      kind: 'enhance-voxel-build',
      phase: 'error',
      error: err.message || String(err),
    });
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
  if (parsedUrl.pathname === '/api/enhance-voxel-build') {
    if (req.method !== 'POST') {
      send(res, 405, 'Method Not Allowed', { Allow: 'POST' });
      return;
    }
    handleEnhanceVoxelBuild(req, res);
    return;
  }
  if (parsedUrl.pathname === '/api/ai-debug-log') {
    if (req.method === 'GET') {
      const limit = numberInRange(parsedUrl.searchParams.get('limit'), 40, 1, 200);
      send(res, 200, JSON.stringify({ ok: true, file: path.relative(root, aiLogFile), entries: readAiLog(limit) }), {
        'Content-Type': 'application/json; charset=utf-8',
      });
      return;
    }
    if (req.method === 'POST') {
      readJsonBody(req).then(input => {
        const logId = appendAiLog({
          id: input.id || createLogId('client-ai'),
          kind: input.kind || 'client-ai',
          phase: input.phase || 'client',
          input,
        });
        send(res, 200, JSON.stringify({ ok: true, logId }), {
          'Content-Type': 'application/json; charset=utf-8',
        });
      }).catch(err => {
        send(res, 500, JSON.stringify({ ok: false, error: err.message || String(err) }), {
          'Content-Type': 'application/json; charset=utf-8',
        });
      });
      return;
    }
    send(res, 405, 'Method Not Allowed', { Allow: 'GET, POST' });
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
