#!/usr/bin/env node
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { scanModelStamps } = require('./model-stamps');

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
  '.obj': 'model/obj',
  '.mtl': 'text/plain; charset=utf-8',
  '.fbx': 'application/octet-stream',
  '.vox': 'application/octet-stream',
  '.vdb': 'application/octet-stream',
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

const modelStampDefaultsFile = path.resolve(root, 'models', 'stamp-defaults.local.json');
const tinyworldDefaultsFile = path.resolve(root, 'tinyworld-defaults.json');

// Keys we never write to the shipped defaults file even if the dev's local
// browser has them set. This keeps world saves, credentials, and per-session
// state out of the committed JSON.
const EXCLUDED_DEFAULT_KEY_PATTERNS = [
  /^tinyworld:v\d+$/,                  // serialised home world
  /^tinyworld:worlds\.v\d+/,           // multi-world saves
  /^tinyworld:ai:key:/,                // API credentials
  /^tinyworld:ai:prompt$/,             // user prompt text
  /^tinyworld:vehicle-demo:/,          // session-only demo state
  /^tinyworld:audio:music-track$/,     // per-user manual music choice
  /^tinyworld:audio:music-mode$/,      // random vs manual music mode
  /^tinyworld:welcome:dismissedId$/,   // per-user welcome dismissal
  /:backup$/,                          // explicit backups
  // Panel/widget positions — inherently viewport-specific. Shipping a
  // dev's left:1525 position would land off-screen for users on narrower
  // displays. Each user keeps their own positions in localStorage.
  /\.pos$/,
  /-pos$/,
  /:pos$/,
];

function isExcludedDefaultKey(key) {
  if (typeof key !== 'string') return true;
  if (!key.startsWith('tinyworld:')) return true;
  for (const re of EXCLUDED_DEFAULT_KEY_PATTERNS) {
    if (re.test(key)) return true;
  }
  return false;
}

function sanitizeTinyworldDefaults(input) {
  const source = input && typeof input === 'object' ? input : {};
  const rawSettings = source.settings && typeof source.settings === 'object' ? source.settings : {};
  const settings = {};
  for (const [key, val] of Object.entries(rawSettings)) {
    if (isExcludedDefaultKey(key)) continue;
    // localStorage values are always strings. Coerce non-strings defensively.
    settings[key] = val == null ? '' : String(val);
  }
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    note: 'Generated by the in-app Settings → Workspace → Save Defaults button (dev only). Ships with the site and seeds localStorage for new users. Existing user preferences are never overwritten.',
    settings,
  };
}

function readTinyworldDefaults() {
  try {
    if (!fs.existsSync(tinyworldDefaultsFile)) return { version: 1, savedAt: null, settings: {} };
    const parsed = JSON.parse(fs.readFileSync(tinyworldDefaultsFile, 'utf8'));
    return {
      version: 1,
      savedAt: parsed && parsed.savedAt ? String(parsed.savedAt) : null,
      settings: parsed && parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {},
    };
  } catch (err) {
    return { version: 1, savedAt: null, settings: {}, error: err.message || String(err) };
  }
}

function writeTinyworldDefaults(input) {
  const clean = sanitizeTinyworldDefaults(input);
  fs.writeFileSync(tinyworldDefaultsFile, JSON.stringify(clean, null, 2) + '\n');
  return clean;
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizeModelStampDefaults(input) {
  const source = input && typeof input === 'object'
    ? (input.stamps && typeof input.stamps === 'object' ? input.stamps : input)
    : {};
  const stamps = {};
  for (const [rawId, raw] of Object.entries(source)) {
    if (!/^[a-z0-9][a-z0-9_-]{0,95}$/i.test(rawId)) continue;
    const cfg = raw && typeof raw === 'object' ? raw : {};
    stamps[rawId] = {
      objectScale: +clampNumber(cfg.objectScale ?? cfg.scale, 1, 0.2, 4).toFixed(3),
      offsetY: +clampNumber(cfg.offsetY, 0, -1, 2).toFixed(3),
      rotationY: +clampNumber(cfg.rotationY, 0, -Math.PI * 4, Math.PI * 4).toFixed(6),
    };
  }
  return { version: 1, stamps };
}

function readModelStampDefaults() {
  try {
    if (!fs.existsSync(modelStampDefaultsFile)) return { version: 1, stamps: {} };
    return sanitizeModelStampDefaults(JSON.parse(fs.readFileSync(modelStampDefaultsFile, 'utf8')));
  } catch (err) {
    return { version: 1, stamps: {}, error: err.message || String(err) };
  }
}

function writeModelStampDefaults(input) {
  const clean = sanitizeModelStampDefaults(input);
  fs.mkdirSync(path.dirname(modelStampDefaultsFile), { recursive: true });
  fs.writeFileSync(modelStampDefaultsFile, JSON.stringify(clean, null, 2) + '\n');
  return clean;
}

function sendJson(res, status, body) {
  send(res, status, JSON.stringify(body), { 'Content-Type': 'application/json; charset=utf-8' });
}

const DEFAULT_VOXEL_PART_MATERIALS = [
  'wood', 'woodDark', 'woodLight', 'leather', 'rope', 'ropeLight', 'cable', 'stone', 'stoneDark',
  'metal', 'steel', 'silver', 'brass', 'brassDark', 'copper', 'bronze',
  'glass', 'glassBlue', 'glassGreen', 'fabric', 'canvas', 'fabricRed',
  'fabricOrange', 'fabricYellow', 'fabricBlue', 'fabricPurple',
  'fabricGreen', 'roof', 'roofEdge', 'white', 'cream', 'red', 'orange',
  'yellow', 'blue', 'teal', 'purple', 'green', 'black', 'charcoal',
];

function voxelPartsSchema(allowedMaterials) {
  const materials = allowedMaterials.length ? allowedMaterials : DEFAULT_VOXEL_PART_MATERIALS;
  const vec3 = {
    type: 'array',
    minItems: 3,
    maxItems: 3,
    items: { type: 'number' },
  };
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
            kind: { type: 'string', enum: ['box', 'cylinder', 'cone', 'sphere', 'ellipsoid', 'cable'] },
            material: { type: 'string', enum: materials },
            size: vec3,
            pos: vec3,
            scale: vec3,
            from: vec3,
            to: vec3,
            radius: { type: 'number', minimum: 0.006, maximum: 0.3 },
            sag: { type: 'number', minimum: -8, maximum: 8 },
            segments: { type: 'integer', minimum: 4, maximum: 64 },
            verticalSegments: { type: 'integer', minimum: 3, maximum: 24 },
            phiStart: { type: 'number', minimum: 0, maximum: 6.28319 },
            phiLength: { type: 'number', minimum: 0.05, maximum: 6.28319 },
            thetaStart: { type: 'number', minimum: 0, maximum: 3.14159 },
            thetaLength: { type: 'number', minimum: 0.05, maximum: 3.14159 },
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
    const allowedMaterials = Array.isArray(input.allowedMaterials) && input.allowedMaterials.length
      ? input.allowedMaterials
      : DEFAULT_VOXEL_PART_MATERIALS;
    const reasoningEffort = choose(input.reasoningEffort, ['none', 'low', 'medium', 'high', 'xhigh'], 'low');
    const reasoningSummary = choose(input.reasoningSummary, ['off', 'auto', 'concise', 'detailed'], 'off');
    const textVerbosity = choose(input.textVerbosity, ['low', 'medium', 'high'], 'low');
    const maxOutputTokens = numberInRange(input.maxOutputTokens, 12000, 1000, 128000);
    const schemaInstruction = [
      'You are generating geometry for a Three.js voxel stamp builder.',
      'Return ONLY valid JSON, no markdown.',
      'The JSON shape must be: {"customParts":[...], "notes":"short optional note"}.',
      'Each customParts item must be:',
      '{"id": string, "kind": "box"|"cylinder"|"cone"|"sphere"|"ellipsoid"|"cable", "material": one of allowedMaterials, "size": [x,y,z], "pos": [x,y,z], "scale": [1,1,1]}.',
      'For ropes, tethers, rigging, or mooring-style connections use kind:"cable" with from [x,y,z], to [x,y,z], radius, sag, and segments. Cable parts should still include size/pos/scale for schema compatibility.',
      'For hot-air balloon envelopes, domes, rounded tanks, and canopies use sphere/ellipsoid, not a box. A hot-air balloon needs a large ellipsoid/sphere envelope plus curved ellipsoid panel slices/bands and a smaller basket.',
      'For colored balloon panels, use ellipsoid slices with phiStart/phiLength (and a slightly larger size if layered over a base envelope). Do not use flat rectangular side plates for the envelope colors.',
      'Use semantic reinterpretation: do not merely stretch source parts.',
      'If creativeRebuild is true or the instruction asks for a new/different object, build THAT requested object freely. Use selectedObject/sourceParts only for placement scale and bounds.',
      'Respect renderFootprint and allowedBounds. Do not make the initial model oversized; increase perceived resolution with smaller connected parts, not by enlarging the whole object.',
      'Native TinyWorld components are allowed only when semantically needed; do not substitute rocks or houses for glass, metal, fabric, or wood geometry.',
      'Increase detail with small trim blocks, windows, roof ribs, railings, bevel-like layered bands, doors, caps, and silhouette-defining parts.',
      'For hot-air balloons, airships, tents, cranes, docks, and bridges, replace fake rope columns with cable parts that physically connect endpoints. For balloons, the envelope must be rounded with ellipsoid/sphere parts rather than a cuboid.',
      'When source parts are empty, create a new original stamp from instruction and imageInstruction, using semantic construction rather than placeholder masses.',
      'Quality contract: produce a readable asset from the default isometric camera with distinct base, body, top, trim, and detail parts where those concepts apply.',
      'Use varied local colors and at least 3 distinct material families for complex bespoke objects. Do not default to stone/rock unless the requested object is actually stone.',
      'Use a richer part count for complex assets, but keep parts purposeful and connected; avoid noisy random cubes.',
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
      creativeRebuild: Boolean(input.creativeRebuild),
      style: input.style || 'low-poly voxel diorama',
      qualityTarget: 'semantic editable customParts first; layered detail; no broad one-block substitute; no detached decoration',
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
    const imageDataUrl = String(input.imageDataUrl || stamp.imageDataUrl || '').trim();
    const content = [{
      type: 'input_text',
      text: [
        'You enhance selected voxel stamps for Tiny World Builder.',
        'Return JSON only. Preserve the selected object category, footprint, scale, and readable chunky voxel look only when the user is asking to enhance the existing kind.',
        'If creativeRebuild is true or the instruction asks for a new/different object, build THAT requested object freely from scratch. The user instruction wins over selectedKind/sourceCell/source voxels.',
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
        'Use varied local colors and accents. Do not default to gray stone/rock unless the requested object is actually stone.',
        imageDataUrl ? 'An image reference is attached. Use it as a visual reference while respecting the TinyWorld voxel/rendering constraints.' : '',
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
          creativeRebuild: Boolean(stamp.creativeRebuild),
          sourceCell: stamp.sourceCell || null,
          sourceCoord: stamp.sourceCoord || null,
          desiredScale: stamp.desiredScale || 1,
          sourceVoxelCount: stamp.sourceVoxelCount || (Array.isArray(stamp.voxels) ? stamp.voxels.length : 0),
          targetVoxelCount: stamp.targetVoxelCount || 240,
          requirements: stamp.requirements || [],
          voxels: Array.isArray(stamp.voxels) ? stamp.voxels : [],
        }),
      ].filter(Boolean).join('\n'),
    }];
    if (imageDataUrl) content.push({ type: 'input_image', image_url: imageDataUrl, detail: 'high' });
    const requestPayload = {
      model,
      input: [{
        role: 'user',
        content,
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
      imageUsed: Boolean(imageDataUrl),
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
  if (parsedUrl.pathname === '/api/model-stamps') {
    if (req.method !== 'GET') {
      send(res, 405, 'Method Not Allowed', { Allow: 'GET' });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      source: 'dev-server',
      root: path.relative(root, path.resolve(root, 'models')) || 'models',
      models: scanModelStamps(root),
    });
    return;
  }
  if (parsedUrl.pathname === '/api/model-stamp-defaults') {
    if (req.method === 'GET') {
      const defaults = readModelStampDefaults();
      sendJson(res, 200, { ok: true, path: path.relative(root, modelStampDefaultsFile), ...defaults });
      return;
    }
    if (req.method === 'POST') {
      readJsonBody(req, 512 * 1024).then(input => {
        const defaults = writeModelStampDefaults(input);
        sendJson(res, 200, { ok: true, path: path.relative(root, modelStampDefaultsFile), ...defaults });
      }).catch(err => {
        sendJson(res, 500, { ok: false, error: err.message || String(err) });
      });
      return;
    }
    send(res, 405, 'Method Not Allowed', { Allow: 'GET, POST' });
    return;
  }
  if (parsedUrl.pathname === '/api/save-defaults') {
    if (req.method === 'GET') {
      const defaults = readTinyworldDefaults();
      sendJson(res, 200, { ok: true, path: path.relative(root, tinyworldDefaultsFile), ...defaults });
      return;
    }
    if (req.method === 'POST') {
      readJsonBody(req, 2 * 1024 * 1024).then(input => {
        const defaults = writeTinyworldDefaults(input);
        const count = Object.keys(defaults.settings).length;
        sendJson(res, 200, {
          ok: true,
          path: path.relative(root, tinyworldDefaultsFile),
          count,
          savedAt: defaults.savedAt,
        });
      }).catch(err => {
        sendJson(res, 500, { ok: false, error: err.message || String(err) });
      });
      return;
    }
    send(res, 405, 'Method Not Allowed', { Allow: 'GET, POST' });
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
