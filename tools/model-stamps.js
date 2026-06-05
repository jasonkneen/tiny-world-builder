#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const MODEL_EXTENSIONS = new Set(['.glb', '.gltf', '.obj', '.fbx', '.vox', '.vdb']);
const PLACEABLE_EXTENSIONS = new Set(['.glb', '.gltf', '.obj', '.fbx', '.vox', '.vdb']);
const TEXTURE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const SIDECAR_EXTENSIONS = new Set(['.mtl', ...TEXTURE_EXTENSIONS]);
const GENERATED_MODEL_FILES = new Set(['stamp-manifest.json', 'stamp-defaults.local.json']);

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function encodeUrlPath(relPath) {
  return relPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

function modelUrl(relPath) {
  return 'models/' + encodeUrlPath(relPath);
}

function titleize(name) {
  return String(name || 'Model')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase()) || 'Model';
}

function slugify(value) {
  return String(value || 'model')
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'model';
}

function scanFiles(dir, baseDir, out, acceptedExtensions) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.name !== '.DS_Store')
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanFiles(full, baseDir, out, acceptedExtensions);
      continue;
    }
    if (!entry.isFile()) continue;
    if (GENERATED_MODEL_FILES.has(entry.name)) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (acceptedExtensions && !acceptedExtensions.has(ext)) continue;
    const rel = toPosix(path.relative(baseDir, full));
    const stat = fs.statSync(full);
    out.push({
      rel,
      name: entry.name,
      ext,
      size: stat.size,
      mtimeMs: Math.round(stat.mtimeMs),
      full,
    });
  }
}

function safeRelativeSidecar(dir, ref) {
  const clean = String(ref || '').trim().replace(/\\/g, '/');
  if (!clean || clean.startsWith('/') || /^[a-z]+:/i.test(clean)) return null;
  const rel = path.posix.normalize(path.posix.join(dir, clean));
  if (!rel || rel === '.' || rel.startsWith('../')) return null;
  return rel;
}

function uniqueList(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function resolveSpaceAwareRefs(rawRef, dir, fileByRel, expectedExt) {
  const refs = [];
  const directRel = safeRelativeSidecar(dir, rawRef);
  const directFile = directRel && fileByRel.get(directRel);
  if (directFile && (!expectedExt || directFile.ext === expectedExt)) {
    return [directRel];
  }
  for (const ref of String(rawRef || '').trim().split(/\s+/)) {
    const rel = safeRelativeSidecar(dir, ref);
    const file = rel && fileByRel.get(rel);
    if (file && (!expectedExt || file.ext === expectedExt)) refs.push(rel);
  }
  return uniqueList(refs.length ? refs : [directRel]);
}

function extractMtlMapPath(line) {
  let rest = String(line || '').trim().replace(/^map_kd\s+/i, '').trim();
  if (!rest) return '';
  if ((rest[0] === '"' && rest[rest.length - 1] === '"') || (rest[0] === '\'' && rest[rest.length - 1] === '\'')) {
    return rest.slice(1, -1);
  }
  const tokens = rest.split(/\s+/);
  let i = 0;
  const optionArity = {
    '-blendu': 1,
    '-blendv': 1,
    '-boost': 1,
    '-mm': 2,
    '-o': 3,
    '-s': 3,
    '-t': 3,
    '-texres': 1,
    '-clamp': 1,
    '-bm': 1,
    '-imfchan': 1,
    '-type': 1,
  };
  while (i < tokens.length && tokens[i][0] === '-') {
    const arity = optionArity[tokens[i].toLowerCase()];
    if (arity === undefined) break;
    i += 1 + arity;
  }
  return tokens.slice(i).join(' ').trim();
}

function textureRecord(file) {
  return {
    path: file.rel,
    url: modelUrl(file.rel),
    name: file.name,
    format: file.ext.slice(1).toLowerCase(),
    size: file.size,
  };
}

function readObjMaterialLibraries(objPath) {
  try {
    const text = fs.readFileSync(objPath, 'utf8');
    const refs = [];
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed[0] === '#') continue;
      if (!trimmed.toLowerCase().startsWith('mtllib ')) continue;
      const rest = trimmed.slice(7).trim();
      if (!rest) continue;
      refs.push(rest);
    }
    return uniqueList(refs);
  } catch (_) {
    return [];
  }
}

function textureSidecarsFor(file, allFiles) {
  const dir = path.posix.dirname(file.rel) === '.' ? '' : path.posix.dirname(file.rel);
  const modelSlug = slugify(path.basename(file.rel));
  const relSlug = slugify(file.rel.replace(/\.[^.]+$/, ''));
  const planeLike = /(^|[-_/])(stunt|plane|aircraft|airplane|crop-duster)([-_/]|$)/i.test(file.rel);
  const sameDirTextures = allFiles.filter(candidate => {
    if (!TEXTURE_EXTENSIONS.has(candidate.ext)) return false;
    const candidateDir = path.posix.dirname(candidate.rel) === '.' ? '' : path.posix.dirname(candidate.rel);
    return candidateDir === dir;
  });
  const picked = sameDirTextures.filter(candidate => {
    const texSlug = slugify(candidate.name);
    if (texSlug.includes(modelSlug) || modelSlug.includes(texSlug)) return true;
    if (texSlug.includes(relSlug) || relSlug.includes(texSlug)) return true;
    if (planeLike && /polygon-plane-texture/.test(texSlug)) return true;
    return false;
  });
  return picked.map(textureRecord);
}

function objSidecarsFor(file, allFiles, fileByRel) {
  const dir = path.posix.dirname(file.rel) === '.' ? '' : path.posix.dirname(file.rel);
  const warnings = [];
  const mtl = [];
  const textures = [];
  const seenTextures = new Set();
  for (const ref of readObjMaterialLibraries(file.full)) {
    const resolvedRefs = resolveSpaceAwareRefs(ref, dir, fileByRel, '.mtl');
    if (!resolvedRefs.length) continue;
    for (const rel of resolvedRefs) {
      if (!rel) continue;
      const found = fileByRel.get(rel);
      if (found && found.ext === '.mtl') {
        mtl.push({ path: found.rel, url: modelUrl(found.rel), name: found.name, exists: true, size: found.size });
        try {
          const mtlText = fs.readFileSync(found.full, 'utf8');
          for (const line of mtlText.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!/^map_kd\s+/i.test(trimmed)) continue;
            const texRef = extractMtlMapPath(trimmed);
            const texDir = path.posix.dirname(found.rel) === '.' ? '' : path.posix.dirname(found.rel);
            const texRel = resolveSpaceAwareRefs(texRef, texDir, fileByRel).find(candidate => {
              const candidateFile = candidate && fileByRel.get(candidate);
              return candidateFile && TEXTURE_EXTENSIONS.has(candidateFile.ext);
            });
            const texFile = texRel && fileByRel.get(texRel);
            if (texFile && TEXTURE_EXTENSIONS.has(texFile.ext) && !seenTextures.has(texFile.rel)) {
              seenTextures.add(texFile.rel);
              textures.push(textureRecord(texFile));
            }
          }
        } catch (_) {}
      } else {
        mtl.push({ path: rel, url: modelUrl(rel), name: path.posix.basename(rel), exists: false });
        warnings.push('Missing OBJ material library: ' + path.posix.basename(rel));
      }
    }
  }
  if (!mtl.length) warnings.push('OBJ has no material library; using TinyWorld palette fallback');
  return { mtl, textures, warnings };
}

function compactSidecars(sidecars) {
  const out = {};
  if (sidecars.mtl && sidecars.mtl.length) out.mtl = sidecars.mtl;
  if (sidecars.textures && sidecars.textures.length) out.textures = sidecars.textures;
  return out;
}

function scanModelStamps(projectRoot = root) {
  const modelsDir = path.resolve(projectRoot, 'models');
  const files = [];
  const allFiles = [];
  scanFiles(modelsDir, modelsDir, files, MODEL_EXTENSIONS);
  scanFiles(modelsDir, modelsDir, allFiles, new Set([...MODEL_EXTENSIONS, ...SIDECAR_EXTENSIONS]));
  const fileByRel = new Map(allFiles.map(file => [file.rel, file]));
  const used = new Map();
  return files.map(file => {
    const format = file.ext.slice(1).toLowerCase();
    const relNoExt = file.rel.replace(/\.[^.]+$/, '');
    const base = slugify(relNoExt);
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base;
    const sidecars = { textures: textureSidecarsFor(file, allFiles) };
    const warnings = [];
    if (format === 'obj') {
      const objSidecars = objSidecarsFor(file, allFiles, fileByRel);
      sidecars.mtl = objSidecars.mtl;
      sidecars.textures = sidecars.textures.concat(objSidecars.textures.filter(texture => !sidecars.textures.some(existing => existing.path === texture.path)));
      warnings.push(...objSidecars.warnings);
    }
    const record = {
      id,
      label: titleize(path.basename(file.name)),
      path: file.rel,
      url: modelUrl(file.rel),
      format,
      supported: PLACEABLE_EXTENSIONS.has(file.ext),
      size: file.size,
      mtimeMs: file.mtimeMs,
    };
    const compact = compactSidecars(sidecars);
    if (Object.keys(compact).length) record.sidecars = compact;
    if (warnings.length) record.warnings = Array.from(new Set(warnings));
    return record;
  });
}

function writeModelStampManifest(outPath, projectRoot = root) {
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'tools/model-stamps.js',
    models: scanModelStamps(projectRoot),
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (require.main === module) {
  const commandOrPath = process.argv[2];
  const maybePath = commandOrPath === 'write' ? process.argv[3] : commandOrPath;
  if (maybePath) {
    const manifest = writeModelStampManifest(path.resolve(process.cwd(), maybePath));
    console.log(`✓ Wrote ${maybePath} (${manifest.models.length} model stamp${manifest.models.length === 1 ? '' : 's'})`);
  } else {
    process.stdout.write(JSON.stringify({ version: 1, models: scanModelStamps(root) }, null, 2) + '\n');
  }
}

module.exports = {
  scanModelStamps,
  writeModelStampManifest,
};
