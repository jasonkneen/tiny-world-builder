#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'tiny-world-builder.html');
const islandViewerHtmlPath = path.join(root, 'island-viewer.html');
const islandViewerScriptPath = path.join(root, 'scripts', 'island-viewer.js');
const islandViewerGeneratorPath = path.join(root, 'scripts', 'island-viewer-sequential-generator.js');
const islandViewerPreludePath = path.join(root, 'scripts', 'island-viewer-engine-prelude.js');
const islandViewerRuntimePath = path.join(root, 'scripts', 'island-viewer-engine-runtime.js');
const islandViewerStatsPath = path.join(root, 'tools', 'island-viewer-sequential-stats.mjs');
const randomIslandPreviewPath = path.join(root, 'random-island-preview.html');
const cssPath = path.join(root, 'styles', 'tiny-world.css');
const schemaPath = path.join(root, 'world.schema.json');
const vercelPath = path.join(root, 'vercel.json');
const netlifyPath = path.join(root, 'netlify.toml');
const partykitPath = path.join(root, 'partykit.json');
const publishPath = path.join(root, 'publish.sh');
const readText = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const htmlRaw = readText(htmlPath);
const islandViewerHtmlRaw = fs.existsSync(islandViewerHtmlPath) ? readText(islandViewerHtmlPath) : '';
const islandViewerScriptRaw = fs.existsSync(islandViewerScriptPath) ? readText(islandViewerScriptPath) : '';
const islandViewerGeneratorRaw = fs.existsSync(islandViewerGeneratorPath) ? readText(islandViewerGeneratorPath) : '';
const islandViewerPreludeRaw = fs.existsSync(islandViewerPreludePath) ? readText(islandViewerPreludePath) : '';
const islandViewerRuntimeRaw = fs.existsSync(islandViewerRuntimePath) ? readText(islandViewerRuntimePath) : '';
const islandViewerStatsRaw = fs.existsSync(islandViewerStatsPath) ? readText(islandViewerStatsPath) : '';
const randomIslandPreviewRaw = fs.existsSync(randomIslandPreviewPath) ? readText(randomIslandPreviewPath) : '';
const cssRaw = readText(cssPath);
const publishRaw = fs.existsSync(publishPath) ? readText(publishPath) : '';
const defaultsPath = path.join(root, 'tinyworld-defaults.json');

// The app was split out of the old single-file HTML into external <script src>
// modules (LandscapeEngine.js + engine/**/*.js). The DOM markup still lives in
// the HTML, but the JS logic these checks inspect now lives in those modules.
// Reconstruct the equivalent combined source so every guard keeps working:
// HTML-structure patterns match the HTML portion, JS patterns match the modules.
function collectAppModules(rootDir) {
  const out = [];
  const landscape = path.join(rootDir, 'LandscapeEngine.js');
  if (fs.existsSync(landscape)) {
    out.push({ file: 'LandscapeEngine.js', source: readText(landscape) });
  }
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.js')) {
        out.push({ file: path.relative(rootDir, full), source: readText(full) });
      }
    }
  };
  const engineDir = path.join(rootDir, 'engine');
  if (fs.existsSync(engineDir)) walk(engineDir);
  return out;
}
const appModules = collectAppModules(root);
const html = htmlRaw + '\n' + appModules
  .map((m) => '\n/* === ' + m.file + ' === */\n' + m.source)
  .join('\n');

function fail(message) {
  console.error('check failed:', message);
  process.exit(1);
}

function sourceFunctionBody(source, name) {
  const needle = 'function ' + name + '(';
  const start = source.indexOf(needle);
  if (start < 0) fail('function missing: ' + name);
  const signatureEnd = source.indexOf(') {', start);
  if (signatureEnd < 0) fail('function signature malformed: ' + name);
  const open = source.indexOf('{', signatureEnd);
  if (open < 0) fail('function body malformed: ' + name);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  fail('function body unterminated: ' + name);
}

function pngDimensions(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
}

function readBasicPngRgba(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 33 || buf.toString('ascii', 1, 4) !== 'PNG') return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset + 12 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + len;
    if (dataEnd + 4 > buf.length) return null;
    if (type === 'IHDR') {
      width = buf.readUInt32BE(dataStart);
      height = buf.readUInt32BE(dataStart + 4);
      bitDepth = buf[dataStart + 8];
      colorType = buf[dataStart + 9];
    } else if (type === 'IDAT') {
      idat.push(buf.slice(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }
  if (!width || !height || bitDepth !== 8 || !idat.length || (colorType !== 6 && colorType !== 2)) return null;
  const bpp = colorType === 6 ? 4 : 3;
  const rowBytes = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rgba = Buffer.alloc(width * height * 4);
  const prev = Buffer.alloc(rowBytes);
  const row = Buffer.alloc(rowBytes);
  let inOffset = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[inOffset++];
    raw.copy(row, 0, inOffset, inOffset + rowBytes);
    inOffset += rowBytes;
    for (let i = 0; i < rowBytes; i++) {
      const left = i >= bpp ? row[i - bpp] : 0;
      const up = prev[i] || 0;
      const upLeft = i >= bpp ? prev[i - bpp] : 0;
      if (filter === 1) row[i] = (row[i] + left) & 255;
      else if (filter === 2) row[i] = (row[i] + up) & 255;
      else if (filter === 3) row[i] = (row[i] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) row[i] = (row[i] + paethPredictor(left, up, upLeft)) & 255;
      else if (filter !== 0) return null;
    }
    for (let x = 0; x < width; x++) {
      const si = x * bpp;
      const di = (y * width + x) * 4;
      rgba[di] = row[si];
      rgba[di + 1] = row[si + 1];
      rgba[di + 2] = row[si + 2];
      rgba[di + 3] = colorType === 6 ? row[si + 3] : 255;
    }
    row.copy(prev);
  }
  return { width, height, rgba };
}

function pngBrownBandAverage(file) {
  const png = readBasicPngRgba(file);
  if (!png) return null;
  let count = 0;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  for (let i = 0; i < png.rgba.length; i += 4) {
    const r = png.rgba[i], g = png.rgba[i + 1], b = png.rgba[i + 2], a = png.rgba[i + 3];
    if (a > 32 && r > 62 && g > 34 && b < 88 && r > g * 1.06 && g > b * 0.82 && (r - b) > 42 && (g - b) > 12) {
      count++;
      rSum += r;
      gSum += g;
      bSum += b;
    }
  }
  return count ? { count, r: rSum / count, g: gSum / count, b: bSum / count } : null;
}

if (!/<script (?:defer )?src="engine\/world\/[^"]+\.js">/.test(htmlRaw)) {
  fail('app module scripts missing: expected <script src="engine/world/*.js"> tags');
}
if (!appModules.length) fail('inline app script missing');
for (const mod of appModules) {
  try {
    new Function(mod.source);
  } catch (err) {
    fail('app script syntax error in ' + mod.file + ': ' + err.message);
  }
}

// -------- cross-file duplicate top-level declaration guard --------
// engine/world/*.js are classic <script>s sharing ONE global scope. A
// top-level const/let/function/class/var redeclared in two files throws a
// SyntaxError at load and silently kills the whole module while the others
// keep running. The per-module loop above validates each file in isolation,
// so it cannot catch a name that collides across files. This block does.
//
// We anchor on EXACTLY two leading spaces, which is the house indent for a
// top-level declaration in these files. IIFE-wrapped files (e.g. world 38/40,
// engine/landscape, engine/i18n) indent their bodies deeper, so their inner
// names are correctly ignored. We only scan engine/world/*.js, not the wrapped
// engine subtrees, to avoid false positives.
const worldDir = path.join(root, 'engine', 'world');
if (fs.existsSync(worldDir)) {
  const declPattern = /^  (?:const|let|var|function|class) ([A-Za-z0-9_$]+)/;
  const declOwners = new Map();
  for (const name of fs.readdirSync(worldDir).sort()) {
    if (!name.endsWith('.js')) continue;
    const source = readText(path.join(worldDir, name));
    for (const line of source.split('\n')) {
      const match = declPattern.exec(line);
      if (!match) continue;
      const declName = match[1];
      if (!declOwners.has(declName)) declOwners.set(declName, new Set());
      declOwners.get(declName).add(name);
    }
  }
  const collisions = [];
  for (const [declName, owners] of declOwners) {
    if (owners.size > 1) collisions.push(declName + ' in ' + [...owners].sort().join(', '));
  }
  if (collisions.length) {
    fail('duplicate top-level declaration across engine/world: ' + collisions.join('; '));
  }
}

let externalSchema;
try {
  externalSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
} catch (err) {
  fail('world.schema.json is not valid JSON: ' + err.message);
}

let shippedDefaults;
try {
  shippedDefaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'));
} catch (err) {
  if (err && err.code === 'ENOENT') {
    fail('tinyworld-defaults.json not found at ' + defaultsPath + ' (publish.sh treats it as optional, but check.js requires it for the settings assertions below).');
  } else {
    fail('tinyworld-defaults.json is not valid JSON: ' + err.message);
  }
}

const schemaDecl = '  const WORLD_SCHEMA = ';
const schemaStart = html.indexOf(schemaDecl);
// The schema is a top-level (2-space indented) const, so its object literal
// closes on a line that is exactly "  };". Inner objects close at deeper
// indentation, so this structural terminator is unambiguous.
const schemaEnd = schemaStart < 0 ? -1 : html.indexOf('\n  };', schemaStart);
if (schemaStart < 0 || schemaEnd < 0) fail('embedded WORLD_SCHEMA block missing');
let embeddedSource = html.slice(schemaStart + schemaDecl.length, schemaEnd + '\n  }'.length).trim();
if (embeddedSource.endsWith(';')) embeddedSource = embeddedSource.slice(0, -1);
let embeddedSchema;
try {
  embeddedSchema = JSON.parse(embeddedSource);
} catch (err) {
  fail('embedded WORLD_SCHEMA is not parseable JSON: ' + err.message);
}
if (JSON.stringify(embeddedSchema) !== JSON.stringify(externalSchema)) {
  fail('embedded WORLD_SCHEMA differs from world.schema.json');
}

const attrPattern = /<(script|link)\b[^>]*\s(?:src|href)=["']([^"']+)["']/gi;
const missing = [];
const remoteRuntime = [];
for (const match of htmlRaw.matchAll(attrPattern)) {
  const tag = match[1].toLowerCase();
  const ref = match[2];
  if (/^(?:https?:)?\/\//.test(ref)) {
    if (tag === 'script') remoteRuntime.push(ref);
    continue;
  }
  if (ref.startsWith('data:') || ref.startsWith('#')) continue;
  const clean = ref.split(/[?#]/)[0];
  if (!clean || clean.startsWith('/')) continue;
  if (!fs.existsSync(path.join(root, clean))) missing.push(ref);
}
if (missing.length) fail('missing referenced static files: ' + missing.join(', '));
if (remoteRuntime.length) fail('remote script runtime references are not allowed: ' + remoteRuntime.join(', '));
if (/cluso\/cluso-embed\.(js|css)/.test(html)) {
  fail('Cluso embed runtime must not be loaded by the app');
}
const modelStampScanBody = sourceFunctionBody(html, 'modelStampScanApiEnabled');
if (!/modelApi'\)\s*===\s*'1'/.test(modelStampScanBody) || !/return false;/.test(modelStampScanBody) || /return stored !== '0'/.test(modelStampScanBody)) {
  fail('model-stamp scan API must stay local or explicitly opted in');
}
if (!/tinyworld-three\.r185\.min\.js/.test(htmlRaw) || !/VDBLoader\.tinyworld\.js/.test(htmlRaw) || !/setDRACOLoader\(modelStampDracoLoader\)/.test(html) || !/setMeshoptDecoder\(MeshoptDecoder\)/.test(html) || !/setKTX2Loader\(modelStampKtx2Loader\)/.test(html)) {
  fail('model-stamp GLB imports must wire r185 Draco, Meshopt, and KTX2 decoder support');
}
if (!/function modelStampMaterialNeedsTinyWorldLighting\(material\)/.test(html) || !/function createTinyWorldLitModelStampMaterial\(source\)/.test(html) || !/new THREE\.MeshLambertMaterial\(params\)/.test(html) || !/modelStampTinyWorldLit/.test(html) || !/node\.material = adapted\.material/.test(html)) {
  fail('model-stamp GLB PBR materials must be adapted to TinyWorld Lambert lighting so imports do not render black');
}
const modelStampLitBody = sourceFunctionBody(html, 'createTinyWorldLitModelStampMaterial');
if (!/function modelStampTextureStats\(texture\)/.test(html) || !/function modelStampShouldDropAoMap\(texture, material\)/.test(html) || !/function modelStampShouldDropNormalMap\(texture, material\)/.test(html) || !/function sanitizeModelStampMaterialLightingMaps\(material/.test(html) || !/stats\.maxR < 0\.08/.test(html) || !/stats\.darkR > 0\.78/.test(html)) {
  fail('model-stamp material adaptation must detect black AO and broken normal textures');
}
if (!/sourceAoMap/.test(modelStampLitBody) || /next\.normalMap\s*=/.test(modelStampLitBody) || !/modelStampDroppedLightingMaps/.test(modelStampLitBody)) {
  fail('TinyWorld-lit model-stamp materials must not blindly copy AO or normal maps that can blacken GLBs');
}
if (!/window\.__tinyworldPreloadModelStamp/.test(html) || !/window\.__tinyworldModelStampLoadState/.test(html) || !/Could not render/.test(html) || !/function waitForDroppedModel/.test(html)) {
  fail('dropped model imports must expose load state and show loader failures');
}
if (!/await waitForDroppedModel\(assets\[0\]/.test(html) || !/placeDroppedModel\(assets\[0\], evt, target\)/.test(html)) {
  fail('canvas model drops must wait for the actual dropped GLB to load before placing');
}
const droppedModelRegisterBody = sourceFunctionBody(html, 'registerDroppedModelStampFiles');
const droppedModelPersistBody = sourceFunctionBody(html, 'persistDroppedModelStampAssets');
const droppedModelRestoreBody = sourceFunctionBody(html, 'restorePersistedDroppedModelStamps');
if (!/MODEL_STAMP_DROPPED_DB_NAME/.test(html) || !/indexedDB\.open\(MODEL_STAMP_DROPPED_DB_NAME/.test(html) || !/createObjectStore\(MODEL_STAMP_DROPPED_STORE,\s*\{\s*keyPath:\s*'id'\s*\}\)/.test(html)) {
  fail('dropped GLB model stamps must use IndexedDB for reload-safe file persistence');
}
if (!/persistDroppedModelStampAssets\(assets, files\)/.test(droppedModelRegisterBody) || !/store\.put/.test(droppedModelPersistBody) || !/fileRecords/.test(droppedModelPersistBody)) {
  fail('dropped GLB model stamp registration must persist the dropped files, not just blob URLs');
}
if (!/modelStampReviveDroppedAssetRecord/.test(droppedModelRestoreBody) || !/mergeModelStampAssets\(assets\)/.test(droppedModelRestoreBody) || !/scheduleModelStampRefresh\(asset\.id\)/.test(droppedModelRestoreBody)) {
  fail('dropped GLB model stamps must restore saved files and refresh model-stamp cells after reload');
}
if (!/MUST use this exact modelStampId/.test(html) || !/function coerceAttachedModelStampsForGeneratedWorld/.test(html) || !/coerceAttachedModelStampsForGeneratedWorld\(data, dropAttachments\)/.test(html)) {
  fail('chat model attachments must enforce the exact dropped modelStampId before rendering');
}

if (/\(1\s*\+\s*2\s*\*\s*maxPreloadRadius\)\s*\*\s*g/.test(html)) {
  fail('Autoexpand preview window must not use full preload-ring diameter');
}
if (!/revealDelay\s*=\s*Math\.random\(\)\s*\*\s*0\.55/.test(html) || !/Math\.exp\(-dt\s*\*\s*5\)/.test(html)) {
  fail('Preview reveal must keep the original staggered paint-in animation');
}
if (/role\s*!==\s*'tile'\s*&&\s*role\s*!==\s*'object'/.test(html) || /revealPadding/.test(html)) {
  fail('Preview merge must not collapse object/cell reveal roots into board-sized chunks');
}
if (/frustum\.intersectsBox\(boardBox\)/.test(html)) {
  fail('Autoexpand ghost board visibility must be controlled by the preview bubble, not render frustum culling');
}
if (/applyWorldUVs\(M\.manorTrim,\s*texBrick/.test(html)) {
  fail('manor window frames and portico columns must not use the brick procedural finish');
}
if (!/id="render-terrain-color-target"/.test(html) || !/id="render-terrain-tone"/.test(html)) {
  fail('settings must expose terrain tint and light/dark controls');
}
if (!/id="render-material-target"/.test(html) || !/id="render-material-texture"/.test(html)) {
  fail('settings must expose part material color and texture controls');
}
if (!/textures\/HJCliEjbEAA9Ah2\.jpeg/.test(html) || !/dist\/textures/.test(fs.readFileSync(path.join(root, 'publish.sh'), 'utf8'))) {
  fail('texture-folder material assets must be referenced by the app and copied to dist/textures');
}
const islandShellMaterialBody = sourceFunctionBody(html, 'syncIslandShellMaterial');
if (!/baseMat\.isShaderMaterial/.test(islandShellMaterialBody) || !/shellMat\.uniforms = baseMat\.uniforms/.test(islandShellMaterialBody) || !/shellMat\.vertexShader = baseMat\.vertexShader/.test(islandShellMaterialBody)) {
  fail('island shell material clones must preserve ShaderMaterial uniforms and shader source');
}
const islandStrataShaderBody = sourceFunctionBody(html, 'makeIslandSideStrataMaterial');
if (!/twStrataHash/.test(islandStrataShaderBody) || !/grassMask/.test(islandStrataShaderBody) || !/dirtToRock/.test(islandStrataShaderBody) || !/rockMask/.test(islandStrataShaderBody)) {
  fail('island side edge shader must procedurally mix grass, dirt, and noisy rock strata');
}
if (/uniform sampler2D uMap/.test(islandStrataShaderBody) || /texture2D\(uMap/.test(islandStrataShaderBody) || /uRepeatWidth/.test(islandStrataShaderBody)) {
  fail('island side edge shader must not sample the old brick-like strata image');
}
if (!/col = max\(col, vec3\(0\.14, 0\.13, 0\.11\)\)/.test(islandStrataShaderBody)) {
  fail('island side edge shader must keep a brightness floor so procedural rock cannot render black');
}
// Guard the structure (overlap constant + derived render top/height), not the
// exact overlap value — that's a tuning knob (commit 5d48469 changed it from
// 0.075 to 0.015 and this check went stale, blocking publish).
if (!/const ISLAND_SIDE_STRATA_TOP_OVERLAP = 0\.\d+/.test(html) || !/const ISLAND_SIDE_STRATA_RENDER_TOP_Y = ISLAND_SIDE_STRATA_TOP_Y \+ ISLAND_SIDE_STRATA_TOP_OVERLAP/.test(html) || !/const ISLAND_SIDE_STRATA_RENDER_HEIGHT = ISLAND_SIDE_STRATA_HEIGHT \+ ISLAND_SIDE_STRATA_TOP_OVERLAP/.test(html)) {
  fail('island side edge strata must define a raised render top and full render height for the texture carrier');
}
if (!/uTopY: \{ value: ISLAND_SIDE_STRATA_RENDER_TOP_Y \}/.test(islandStrataShaderBody) || !/uHeight: \{ value: ISLAND_SIDE_STRATA_RENDER_HEIGHT \}/.test(islandStrataShaderBody)) {
  fail('island side edge shader must sample from the raised carrier top so the side strata meets the grass cap');
}
// The page hard-depends on its external stylesheet. A build that does not copy
// styles/ into dist deploys an unstyled page (CSS 404 served as text/html), so
// guard both the <link> reference and the publish.sh copy step.
if (/<link[^>]+rel=["']stylesheet["'][^>]+href=["']styles\//.test(htmlRaw)) {
  if (!/dist\/styles/.test(fs.readFileSync(path.join(root, 'publish.sh'), 'utf8'))) {
    fail('referenced styles/ stylesheet must be copied to dist/styles by publish.sh');
  }
}
if (!islandViewerHtmlRaw || !islandViewerScriptRaw || !islandViewerGeneratorRaw || !islandViewerPreludeRaw || !islandViewerRuntimeRaw) {
  fail('island viewer shell, controller, generator, prelude, and runtime files must be present');
}
if (/<iframe\b/.test(islandViewerHtmlRaw) || /scripts\/tinyworld-island-core\.js|scripts\/island-viewer-renderer\.js/.test(islandViewerHtmlRaw)) {
  fail('island viewer must be standalone and must not load the old core bundle or temporary renderer');
}
if (!/scripts\/island-viewer-engine-prelude\.js/.test(islandViewerHtmlRaw)
    || !/scripts\/island-viewer-sequential-generator\.js/.test(islandViewerHtmlRaw)
    || !/scripts\/island-viewer-engine-runtime\.js/.test(islandViewerHtmlRaw)
    || !/scripts\/island-viewer\.js/.test(islandViewerHtmlRaw)
    || !/engine\/world\/17-tile-renderers\.js/.test(islandViewerHtmlRaw)) {
  fail('island viewer must load the sequential generator and builder-engine runtime stack');
}
if (!/TinyWorldIslandGenerator/.test(islandViewerScriptRaw) || !/TinyWorldIslandRenderer\.mount/.test(islandViewerScriptRaw)) {
  fail('island viewer controller must call the generator API and mount the renderer runtime');
}
if (/water-bridge|bridgeAxis/.test(islandViewerGeneratorRaw)
    || !/function pathWaterPathBridgeAxis\(cells, index\)/.test(islandViewerGeneratorRaw)
    || !/function placePathWaterPathBridgesLayer\(cells\)/.test(islandViewerGeneratorRaw)) {
  fail('island viewer generator must use local bridge detection without legacy bridge metadata');
}
if (!/function waterPathComponents\(cells\)/.test(islandViewerGeneratorRaw)
    || !/return Number\.isFinite\(componentId\) && !crossedComponents\.has\(componentId\);/.test(islandViewerGeneratorRaw)) {
  fail('island viewer water routing must limit crossings to one cell per connected path area');
}
if (!/if \(hasPath\(cell\)\) return 'path';/.test(islandViewerGeneratorRaw) || /entry\.path = true/.test(islandViewerGeneratorRaw)) {
  fail('island viewer generator must export public paths as terrain:path cells');
}
if (!/const cropIds = \['wheat', 'corn', 'carrot', 'pumpkin', 'sunflower'\];/.test(islandViewerGeneratorRaw)
    || !/roll < 0\.25 \? null/.test(islandViewerGeneratorRaw)
    || !/crop-area-fill/.test(islandViewerGeneratorRaw)) {
  fail('island viewer crop plot must roll 25% empty, then evenly across the five crop kinds');
}
if (!/function placeStrategicLampLayer\(cells, seed\)/.test(islandViewerGeneratorRaw)
    || !/function placeManorLayer\(cells, seed\)/.test(islandViewerGeneratorRaw)
    || !/function placeTreeBushLayer\(cells, seed\)/.test(islandViewerGeneratorRaw)
    || !/function placeProbabilisticInfillLayer\(cells, seed\)/.test(islandViewerGeneratorRaw)) {
  fail('island viewer generator must keep lantern, manor, tree/bush, and weighted infill layers');
}
if (!/if \(cell\.path === true && terrain !== 'water'\) terrain = 'path';/.test(islandViewerRuntimeRaw)
    || /function clearViewerWorld\(\)|clearViewerWorld\(\)|forceTile: true/.test(islandViewerRuntimeRaw)
    || !/__tinyworldIslandViewerLoading/.test(islandViewerRuntimeRaw)
    || /path: cell\.path|path: false/.test(islandViewerRuntimeRaw)) {
  fail('island viewer runtime must normalize legacy path booleans, apply a single settled pass, and export schema-native paths');
}
if (!islandViewerStatsRaw
    || !/DEFAULT_COUNT = 1000/.test(islandViewerStatsRaw)
    || !/scripts\/island-viewer-sequential-generator\.js/.test(islandViewerStatsRaw)
    || !/validateWorld\(world, profile\)/.test(islandViewerStatsRaw)
    || !/stats-runs\/island-viewer-sequential/.test(islandViewerStatsRaw)
    || !/"stats:island-viewer": "node tools\/island-viewer-sequential-stats\.mjs"/.test(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))) {
  fail('island viewer sequential stats CLI must run schema/invariant sweeps from npm');
}
if (!/meta http-equiv="refresh" content="0; url=island-viewer\.html"/.test(randomIslandPreviewRaw)
    || !/location\.replace\('island-viewer\.html' \+ location\.search \+ location\.hash\)/.test(randomIslandPreviewRaw)) {
  fail('random-island-preview.html must stay a compatibility redirect to island-viewer.html');
}
if (!/cp island-viewer\.html "\$DIST\/island-viewer\.html"/.test(publishRaw)
    || !/cp random-island-preview\.html "\$DIST\/random-island-preview\.html"/.test(publishRaw)) {
  fail('publish.sh must copy the island viewer shell and preview compatibility redirect');
}
if (/function makeCustomPartsStamp[\s\S]*?\n\s*addVoxelBuildTrimFrame\(g, trimBounds, voxelTrimMaterial\(trimBase\)\);\n\s*g\.userData/.test(html)) {
  fail('custom voxel part stamps must not render bounding trim frames by default');
}
if (/stamp\.custom\s*\|\|[\s\S]{0,140}addVoxelBuildTrimFrame/.test(html)) {
  fail('custom voxel stamp flag must not imply a visible bounding cage');
}
if (!/function customVoxelGroundPlatformSink/.test(html) || !/const platformSink = customVoxelGroundPlatformSink\(parts, b\) \* unit/.test(html)) {
  fail('custom voxel ground platforms must be sunk into the terrain');
}
if (!/function addVoxelTerrainSurfaceDetails/.test(html) || !/addVoxelTerrainSurfaceDetails\(g, terrain, x, z, topSize/.test(html)) {
  fail('voxel terrain surfaces must include the batched detail layer');
}
if (!/id="render-material-wear"/.test(html) || !/function applyWearToMaterialColor/.test(html) || !/renderMaterialWear/.test(html)) {
  fail('materials settings must expose and apply global wear-and-tear controls');
}
const pixelTextureBody = sourceFunctionBody(html, 'createPixelTexture');
if (/const block = Math\.max\(44/.test(pixelTextureBody) || !/type === 'castle-block'/.test(pixelTextureBody) || !/const rowH = Math\.max\(7, Math\.floor\(scale \/ 8\)\)/.test(pixelTextureBody) || !/applyWorldUVs\(M\.wallCream, texCastleBlock, 0\.86\)/.test(html) || !/applyWorldUVs\(M\.towerStone, texCastleBlock, 0\.86\)/.test(html) || !/if \(kind === 'castle-block'\) return 0\.86/.test(html)) {
  fail('default castle/stone wall texture must use tight masonry courses, not huge window-like block panels');
}
const materialBootBody = sourceFunctionBody(html, 'applyPersistedMaterialSettingsOnBoot');
if (!/hasPersistedMaterialSettings\(\)/.test(materialBootBody) || !/commitPartMaterialAdjustments\(\)/.test(materialBootBody) || !/rebuildTerrainRender\(\)/.test(materialBootBody) || !/rebuildObjectsRender\(\)/.test(materialBootBody) || !/applyPersistedMaterialSettingsOnBoot\(\)/.test(html)) {
  fail('persisted material wear/adjustments must be applied at late boot without needing slider movement');
}
if (!/function addVoxelTerrainRiserBacking/.test(html) || !/addVoxelTerrainRiserBacking\(g, terrain, riserSize, DIRT_H \+ rise/.test(html)) {
  fail('voxel terrain sides must include a solid backing behind detailed panels');
}
if (/addVoxelTerrainRiser\(g, terrain, x, z, rise, riserSize, DIRT_H \+ rise/.test(html)) {
  fail('voxel terrain sides must use solid shader-textured walls, not thousands of side panels');
}
if (!/function terrainSurfaceOffset/.test(html) || !/function addHeavyTerrainKerbStrips/.test(html) || !/addHeavyTerrainKerbStrips\(g, terrain, x, z, terrainN, topSize, topY\)/.test(html)) {
  fail('heavy terrain must render depressed surfaces with lightweight brick kerb strips');
}
const heavyTerrainKerbBody = sourceFunctionBody(html, 'addHeavyTerrainKerbStrips');
if (!/!sameTerrainEdgeFamily\(terrainN\[dir\], terrain\)/.test(heavyTerrainKerbBody)) {
  fail('heavy terrain kerb strips must only render on exposed paved edges, not across connected path/stone cells');
}
if (!/addVoxelTerrainTop\(g, terrain, x, z, visualRise - seamOverlap \* 0\.5/.test(html) || !/function terrainVisualRiseForCell/.test(html)) {
  fail('heavy terrain visual drop must drive tile tops and object/surface heights');
}
if (!/const WATER_SURFACE_DROP = TOP_H/.test(html) || !/terrain === 'water'\) return -WATER_SURFACE_DROP/.test(html) || !/terrain === 'dirt'\) return 0\.034/.test(html)) {
  fail('terrain surface offsets must lower water channels and lift dirt/soil slightly');
}
if (!/waterfallFoamPuff/.test(html) || !/function getWaterfallFoamGeometry/.test(html) || !/kind: 'foamBatch'/.test(html)) {
  fail('waterfalls must include batched translucent foam puffs');
}
if (!/function getWaterfallCurtainMaterial/.test(html) || !/function getWaterfallSurfaceMaterial/.test(html) || !/kind: 'shaderSheet'/.test(html)) {
  fail('waterfall curtains and surface flows must use shared shader sheets');
}
if (!/function optimizeVoxelObjectGroup/.test(html) || !/new THREE\.InstancedMesh\(bucket\.geometry, bucket\.material, bucket\.items\.length\)/.test(html)) {
  fail('voxel object factories must have a shared InstancedMesh batching helper');
}
const addCustomPartEllipsoidBody = sourceFunctionBody(html, 'addCustomPartEllipsoid');
if (!/function getCustomPartEllipsoidGeometry/.test(html) || /new THREE\.SphereGeometry/.test(addCustomPartEllipsoidBody)) {
  fail('customParts sphere/ellipsoid primitives must use cached shared geometry');
}
const normalizeVoxelCustomPartsBody = sourceFunctionBody(html, 'normalizeVoxelCustomParts');
if (!/out\.length < 180/.test(normalizeVoxelCustomPartsBody)) {
  fail('customParts normalizer must honor the 180-part schema cap');
}
if (!/optimizeVoxelObjectGroup\(g, \{ reason: 'voxel-build-stamp' \}\)/.test(html) || !/optimizeVoxelObjectGroup\(g, \{ reason: 'voxel-crop' \}\)/.test(html)) {
  fail('voxel stamps and crops must route repeated boxes through the batching helper');
}
if (!/window\.__tinyworldRepaintProfile/.test(html) || !/repaintProfileEnd\('render\.direct'/.test(html) || !/repaintProfileEnd\('setCell\.refresh'/.test(html) || !/repaintProfileEnd\('tick\.effects'/.test(html)) {
  fail('stats mode must expose repaint profiling across render, setCell refresh, and frame effect buckets');
}
const renderSceneBody = sourceFunctionBody(html, 'renderScene');
if (!/function updateSceneVisibilityForCamera/.test(html) || !/updateSceneVisibilityForCamera\(\);/.test(renderSceneBody) || !/function renderCullTopContentOpacity/.test(html) || !/'culled  '/.test(html)) {
  fail('render stats must include camera culling for off-frustum and underside-occluded roots');
}
const createMaterialImageTextureBody = sourceFunctionBody(html, 'createMaterialImageTexture');
const loadModelStampTextureBody = sourceFunctionBody(html, 'loadModelStampTexture');
const makeIslandBannerTextureBody = sourceFunctionBody(html, 'makeIslandBannerTexture');
if (!/function renderSceneIfReady/.test(html) || !/setRenderSceneReady\(true\);\s*renderer\.setAnimationLoop\(animate\)/.test(html)) {
  fail('resource-load render callbacks must be gated until the scene is fully booted');
}
if (/renderScene\(\)/.test(createMaterialImageTextureBody) || /renderScene\(\)/.test(loadModelStampTextureBody) || /renderScene\(\)/.test(makeIslandBannerTextureBody) || !/repaintAfterTextureLoad\(\)/.test(createMaterialImageTextureBody + loadModelStampTextureBody + makeIslandBannerTextureBody)) {
  fail('async texture callbacks must use the shared repaintAfterTextureLoad helper instead of repainting during partial boot');
}
const renderCullBody = sourceFunctionBody(html, 'updateSceneVisibilityForCamera');
if (!/setRenderCullVisible\(entry\.tile, visible\);/.test(renderCullBody) || !/setRenderCullOpacity\(entry\.object, topOpacity\);/.test(renderCullBody) || /renderCullCellVisible\(x, z, topVisible\)/.test(html)) {
  fail('underside camera occlusion must keep terrain side walls visible while fading top-side content');
}
if (!/id="under-occlusion-cloud-wipe"/.test(html) || !/function updateUnderOcclusionCloudWipe/.test(html) || !/topContentTransitionStrength/.test(html)) {
  fail('underside top-content culling must be masked by the 2D cloud wipe transition');
}
if (!/function editableIslandFullLodBudget/.test(html) || !/function editableIslandFullLodSet/.test(html) || !/islandStats\.fullBudget/.test(html)) {
  fail('duplicate editable islands must cap full-detail LODs and report the active full-island budget');
}
const createEditableIslandBody = sourceFunctionBody(html, 'createEditableIsland');
if (!/const EDITABLE_ISLAND_WARP_DURATION = 0\.94/.test(html) || !/function startEditableIslandWarpArrival/.test(html) || !/function tickEditableIslandWarpArrivals/.test(html) || !/THREE\.AdditiveBlending/.test(html) || !/new THREE\.TorusGeometry\(1, 0\.026/.test(html) || !/new THREE\.SphereGeometry\(1, 20, 10\)/.test(html)) {
  fail('editable islands must keep the high-speed blue-white warp arrival effect');
}
if (!/opts\.warpIn === true \|\| \(opts\.warpIn !== false && !opts\.skipSave\)/.test(createEditableIslandBody) || !/startEditableIslandWarpArrival\(island, opts\)/.test(createEditableIslandBody)) {
  fail('new editable islands must trigger warp arrival while restored skipSave islands do not');
}
if (!/updateEditableIslandLods\(\);\s*if \(typeof tickEditableIslandWarpArrivals === 'function'\) tickEditableIslandWarpArrivals\(dt\);\s*tickEditableIslandEngines\(dt, t\);/.test(html)) {
  fail('editable island warp arrivals must tick after LOD visibility and before engine animation');
}
if (!/optimizeVoxelObjectGroup\(homeBorderGroup, \{ reason: 'home-island-border' \}\)/.test(html) || !/optimizeVoxelObjectGroup\(g, \{ reason: 'editable-island-base' \}\)/.test(html)) {
  fail('home and duplicate island base dressing must route repeated voxel pieces through batching');
}
if (!/function findFenceRenderSpan/.test(html) || !/function makeVoxelFenceSpan/.test(html) || !/batchedSpan: true/.test(html)) {
  fail('voxel fences must collapse same-style contiguous rows into batched spans');
}
if (!/39-atmosphere-effects\.js/.test(htmlRaw) || !/function updateStarlitAtmosphere/.test(html) || !/function makeProceduralStarVaultTexture/.test(html) || !/aboveHorizon/.test(html)) {
  fail('starlit atmosphere must stay wired through the late-loaded procedural sky module with a horizon mask');
}
if (!/40-shield-system\.js/.test(htmlRaw) || !/class ShieldRing extends THREE\.Group/.test(html) || !/class BlastPanel extends THREE\.Group/.test(html) || !/class CornerKeystone extends THREE\.Group/.test(html) || !/window\.VoxelShield/.test(html) || !/tickVoxelShield\(dt, t\)/.test(html)) {
  fail('voxel blast shield must stay wired as the supplied VoxelShield class/API module and frame tick');
}
if (!/toolbar-shield-toggle/.test(html) || !/buildToolbarUtilityButton\('toolbar-home'/.test(html) || !/buildToolbarUtilityButton\('toolbar-shield-toggle'/.test(html) || !/window\.VoxelShield\.toggle\(\)/.test(html) || !/toolbar-shield-toggle', 'Raise shield', 'shield'/.test(html)) {
  fail('bottom toolbar must expose Home and VoxelShield toggle utility buttons next to each other');
}
if (!/function buttonPosTypeForTool/.test(html) || !/if \(t\.select\) return 'primary';/.test(html) || !/if \(t\.erase \|\| t\.eraser\) return 'neutral';/.test(html) || !/function posTypeForToolGroup/.test(html)) {
  fail('toolbar buttons must assign stable category data-pos-type values, including select and erase');
}
if (!/"mooring": "mooring"/.test(html) || !/TOOL_GLYPH_SVG[\s\S]*"mooring": "<svg viewBox/.test(html) || /t\.eraser \|\| t\.select \|\| t\.mooring/.test(html)) {
  fail('Connect tool must render a real flyout glyph instead of the old icon-only fallback');
}
if (!/Unified block buttons/.test(cssRaw) || !/\.toolbar \.tool-group-btn\[data-pos-type\]/.test(cssRaw) || !/\.flyout \.tool\.flyout-tool\[data-pos-type\]/.test(cssRaw) || !/body\.ui-theme-dark \.toolbar \.tool\[data-pos-type\]:not\(\.active\):not\(\[aria-pressed="true"\]\)/.test(cssRaw)) {
  fail('bottom toolbar and flyout buttons must share the category block-button border treatment');
}
const chromeBlockButtonIds = [
  'github-link', 'tips-toggle', 'render-settings', 'import', 'export', 'reset', 'dev-mode', 'account-btn', 'sound-icon', 'layers-toggle',
  'home', 'persp', 'view-modes', 'time-weather', 'showcase-mode', 'stamp-builder', 'generate', 'clear',
];
for (const id of chromeBlockButtonIds) {
  const idThenPos = new RegExp('id="' + id + '"[^>]*data-pos-type="(?:primary|tertiary|shield|neutral)"');
  const posThenId = new RegExp('data-pos-type="(?:primary|tertiary|shield|neutral)"[^>]*id="' + id + '"');
  if (!idThenPos.test(htmlRaw) && !posThenId.test(htmlRaw)) {
    fail('global chrome icon buttons must carry stable data-pos-type: ' + id);
  }
}
const controlsMarkup = (htmlRaw.match(/<div class="controls">([\s\S]*?)<\/div>\s*<div class="xr-panel"/) || [])[1] || '';
for (const id of ['tips-toggle', 'render-settings', 'import', 'export', 'reset', 'dev-mode', 'account-btn']) {
  if (!new RegExp('id="' + id + '"').test(controlsMarkup)) {
    fail('utility chrome icon must live in the left side rail: ' + id);
  }
}
if (/<div class="token-pill"/.test(htmlRaw) || !/<div class="token-corner"[\s\S]*id="github-link"[\s\S]*class="token-corner-text"[\s\S]*class="ticker"[\s\S]*\$TINYWORLD[\s\S]*class="ca"[\s\S]*CA:/.test(htmlRaw)) {
  fail('GitHub icon must sit beside simple $TINYWORLD corner text without a token pill panel');
}
if (!/<div class="appbar">\s*<div class="language-picker" id="language-picker"[\s\S]*id="language-trigger"[\s\S]*aria-controls="language-menu"[\s\S]*<div class="language-menu" id="language-menu"[\s\S]*role="menu"[\s\S]*class="language-option"[\s\S]*data-lang="zh"/.test(htmlRaw) || /id="lang-flags"|class="lang-flag"/.test(htmlRaw)) {
  fail('bottom-left appbar language switcher must be one trigger button with an expandable language menu');
}
if (!/\.language-menu\s*\{[\s\S]*bottom:\s*calc\(100% \+ 8px\)/.test(cssRaw) || !/@media \(max-width: 600px\)[\s\S]*\.language-menu\s*\{[\s\S]*left:\s*auto[\s\S]*right:\s*0/.test(cssRaw) || !/const languagePicker = document\.getElementById\('language-picker'\)/.test(html) || !/window\.TWI18N\.setLocale\(nextLocale\)/.test(html)) {
  fail('language picker must open upward, stay viewport-safe on mobile, and switch locale through the existing i18n setLocale path');
}
if (!/id="crowd-panel-handle"[^>]*data-feature-hidden="crowd-handle"/.test(htmlRaw) || !/\.crowd-panel-handle\s*\{[\s\S]*display:\s*none !important/.test(cssRaw)) {
  fail('crowd/crown handle must stay hidden');
}
if (!/Unified chrome icon buttons/.test(cssRaw) || !/\.token-corner \.btn\.icon\[data-pos-type\]/.test(cssRaw) || !/\.controls \.btn\.icon\[data-pos-type\]/.test(cssRaw) || !/\.language-trigger\[data-pos-type\]/.test(cssRaw) || !/\.sound-icon\[data-pos-type\]/.test(cssRaw) || !/\.layers-handle\[data-pos-type\]/.test(cssRaw) || !/\.world-pill\[data-pos-type\]/.test(cssRaw) || !/\.multiplayer-status\[data-pos-type\]/.test(cssRaw) || !/\.multiplayer-roster\[data-pos-type\]/.test(cssRaw) || !/\.mp-chat-toggle\[data-pos-type\]/.test(cssRaw)) {
  fail('language trigger, side rail controls, sound/layers, chat, and top pills must use the same category block-button chrome');
}
if (!/\.world-pill\[data-pos-type="primary"\]\s*\{[\s\S]*--chrome-bg:\s*rgba\(255, 255, 255, 0\.82\)[\s\S]*--chrome-hover-bg:\s*rgba\(255, 255, 255, 0\.94\)/.test(cssRaw)) {
  fail('world selector pill must keep the bright white chrome fill instead of the tinted primary fill');
}
if (!/\.world-pill\[data-pos-type\]:hover\s*\{\s*transform:\s*translateX\(-50%\);/.test(cssRaw)) {
  fail('world selector pill hover must preserve center anchoring instead of lifting or jumping');
}
if (!/<button class="showcase-exit" id="showcase-exit" type="button" aria-label="Exit showcase mode \(Esc\)" aria-keyshortcuts="Escape" title="Exit showcase mode \(Esc\)">\s*<svg viewBox="0 0 24 24" aria-hidden="true">\s*<path d="M6 6l12 12M18 6 6 18"><\/path>\s*<\/svg>\s*<\/button>/.test(htmlRaw) || /data-i18n="controls\.showcaseExit"/.test(htmlRaw)) {
  fail('showcase exit must be a simple icon-only X button with Escape announced');
}
if (!/\.showcase-exit\s*\{[\s\S]*top:\s*18px;[\s\S]*right:\s*18px;[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;[\s\S]*padding:\s*0;[\s\S]*border-radius:\s*999px;/.test(cssRaw) || !/body\.showcase \.showcase-exit\s*\{\s*display:\s*inline-flex;\s*\}/.test(cssRaw) || !/\.showcase-exit svg\s*\{[\s\S]*stroke:\s*currentColor;/.test(cssRaw) || /\.showcase-exit:hover\s*\{[^}]*transform:/.test(cssRaw)) {
  fail('showcase exit must be a fixed top-right circular X button without hover movement');
}
if (!/if \(showcaseExit\) showcaseExit\.addEventListener\('click', \(\) => setShowcaseActive\(false\)\);/.test(html) || !/window\.addEventListener\('keydown', e => \{[\s\S]*if \(e\.key === 'Escape'\) \{[\s\S]*if \(showcaseActive\) setShowcaseActive\(false\);/.test(html)) {
  fail('showcase exit must keep both click and Escape close behavior');
}
if (!/body\.ui-theme-dark \.controls \.btn\.icon\[data-pos-type\]\.on/.test(cssRaw) || !/body\.ui-theme-dark \.sound-icon\[data-pos-type\]\.open/.test(cssRaw) || !/body\.tod-night \.controls \.btn\.icon\[data-pos-type\]\.on/.test(cssRaw)) {
  fail('dark and after-hours themes must preserve chrome icon active/on block-button states');
}
const clearSelectionBody = sourceFunctionBody(html, 'clearSelection');
if (!/selectedEditableIsland\(\)/.test(clearSelectionBody) || !/selectEditableIsland\(null\)/.test(clearSelectionBody) || !/notifySelectionChanged\(\)/.test(clearSelectionBody)) {
  fail('selection clear must deselect whole editable islands as well as selected cells');
}
if (!/Esc first closes\/deselects the active edit target/.test(html) || !/if \(e\.key === 'Escape' && !\(typeof fp !== 'undefined' && fp\.active\)\) \{[\s\S]*const selApi = window\.__tinyworldSelection;[\s\S]*if \(hasSelectedCells \|\| selectedIsland \|\| selectedEditableIslandEngineRef[^)]*\) \{[\s\S]*selApi\.clear\(\);[\s\S]*lastSelectionAnchor = null;[\s\S]*selectTool\(selTool\);/.test(html)) {
  fail('Escape must close/deselect active selection before or while disarming tools');
}
if (!/if \(typeof clearSelection === 'function'\) clearSelection\(\);[\s\S]*root\.hidden = true;[\s\S]*currentLevel = 'root';/.test(html)) {
  fail('radial root X must clear selection and hide the radial immediately');
}
if (!/\.world-menu-foot\s*\{[\s\S]*overflow-x:\s*auto/.test(cssRaw) || !/\.world-menu-foot-btn\s*\{[\s\S]*white-space:\s*nowrap/.test(cssRaw) || !/\.world-menu-foot-btn span\s*\{[\s\S]*text-overflow:\s*ellipsis/.test(cssRaw)) {
  fail('world menu footer buttons must stay single-line and use horizontal overflow instead of wrapping');
}
if (!/<button type="button" class="brand brand-home-btn" id="brand-home-btn"[\s\S]*<img class="brand-logo" src="assets\/twlogo-wordmark\.png"[\s\S]*<\/button>\s*<a class="brand-banner" id="brand-banner"/.test(htmlRaw) || !/\.brand-logo\s*\{[\s\S]*width:\s*250px/.test(cssRaw) || !/\.brand-banner\s*\{[\s\S]*top:\s*28px[\s\S]*left:\s*294px[\s\S]*right:\s*auto/.test(cssRaw)) {
  fail('top-left brand must use the clickable logo-only Tiny World wordmark with the Autoincentive banner aligned beside it');
}
if (!fs.existsSync(path.join(root, 'assets', 'twlogo-wordmark.png'))) {
  fail('top-left brand logo-only wordmark asset must exist');
}
if (/\.minimap-wrap\.collapsed\s*\{[^}]*translateX/.test(cssRaw) || !/function clampMinimapPosition\(left, top\)/.test(html) || !/function setMinimapPosition\(left, top\)[\s\S]*clampMinimapPosition\(left, top\)/.test(html) || !/setMinimapPosition\(mmDrag\.leftAtStart \+ dx, mmDrag\.topAtStart \+ dy\)/.test(html)) {
  fail('minimap must clamp restored/dragged/collapsed positions without translating off-screen');
}
const renderDefaults = {
  'tinyworld:render:version': '28',
  'tinyworld:render:resolution': '0.75',
  'tinyworld:render:dynamicResolution': '1',
  'tinyworld:render:targetFps': '55',
  'tinyworld:render:brightness': '1.18',
  'tinyworld:render:lighting': '0.78',
  'tinyworld:render:ambientFill': '1.00',
  'tinyworld:render:frontFill': '0.48',
  'tinyworld:render:sideFill': '0.40',
  'tinyworld:render:backFill': '0.34',
  'tinyworld:render:saturation': '1.10',
  'tinyworld:render:contrast': '1.08',
  'tinyworld:render:tiltBlur': '2.1',
  'tinyworld:render:tiltFocus': '65',
  'tinyworld:render:planesEnabled': '0',
  'tinyworld:render:skyBlueDepth': '0.82',
  'tinyworld:render:skyBlueSaturation': '1.38',
  'tinyworld:render:materialWear': '1.00',
};
for (const [key, value] of Object.entries(renderDefaults)) {
  if (!shippedDefaults.settings || shippedDefaults.settings[key] !== value) {
    fail('shipped render default mismatch for ' + key);
  }
}
let shippedCamera;
try {
  shippedCamera = JSON.parse(shippedDefaults.settings['tinyworld:view.camera']);
} catch (err) {
  fail('shipped camera default is not valid JSON: ' + err.message);
}
if (!shippedCamera || !shippedCamera.target || shippedCamera.target.x !== 0 || shippedCamera.target.z !== 0 || !/const DEFAULT_TARGET = new THREE\.Vector3\(0, 0, 0\)/.test(html) || !/clampTargetToHomeBoard\(\);\s*updateCamera\(\);/.test(html)) {
  fail('camera defaults must start centered and clamp stale off-board targets before first render');
}
if (!/const RENDER_SETTINGS_VERSION = '28'/.test(html) || !/resolution:\s*'0\.75'/.test(html) || !/dynamicResolution:\s*'1'/.test(html) || !/targetFps:\s*'55'/.test(html) || !/brightness:\s*'1\.18'/.test(html) || !/skyBlueDepth:\s*'0\.82'/.test(html) || !/skyBlueSaturation:\s*'1\.38'/.test(html) || !/tiltBlur:\s*'2\.1'/.test(html) || !/tiltFocus:\s*'65'/.test(html) || !/materialWear:\s*'1'/.test(html)) {
  fail('hard-coded render defaults must match the shipped v28 defaults');
}
if (!/<div id="welcome-modal" class="modal launch-modal" hidden aria-hidden="true">[\s\S]*<img class="welcome-logo" src="assets\/twlogo\.png" alt="Tiny World Builder"[\s\S]*id="welcome-tinyverse"[^>]*>[\s\S]*Discover new Worlds[\s\S]*Explore the Tinyverse[\s\S]*<\/button>[\s\S]*id="welcome-battleworlds"[^>]*>BattleWorlds<\/button>[\s\S]*id="welcome-build"[^>]*>[\s\S]*Creative Mode[\s\S]*Build, share, collaborate[\s\S]*<\/button>[\s\S]*id="welcome-play"[^>]*>Play<\/button>[\s\S]*class="welcome-credit"[\s\S]*Created by Jason Kneen[\s\S]*https:\/\/x\.com\/jasonkneen[\s\S]*@jasonkneen[\s\S]*https:\/\/x\.com\/tinyworldsapp[\s\S]*@tinyworldsapp/.test(htmlRaw)) {
  fail('welcome launcher must render the Tiny World logo, Discover new Worlds/BattleWorlds/Creative Mode/Play buttons, creator credit, and social links');
}
const welcomeDialogBody = sourceFunctionBody(html, 'initWelcomeDialog');
if (!/modal\.hidden = false;/.test(welcomeDialogBody) || !/welcome-launch-open/.test(welcomeDialogBody) || !/__tinyworldMode/.test(welcomeDialogBody) || !/__tinyworldWorlds/.test(welcomeDialogBody) || !/__tinyworldBattleworlds/.test(welcomeDialogBody) || !/chooseWelcomeMode\('build'\)/.test(welcomeDialogBody) || !/chooseWelcomeMode\('play'\)/.test(welcomeDialogBody)) {
  fail('welcome launcher must open at boot and route choices through Tinyverse/Battleworlds/Build/Play mode');
}
if (!/\.launch-modal\s*\{[\s\S]*align-items:\s*center/.test(cssRaw) || !/\.welcome-logo\s*\{[\s\S]*border-radius:\s*20px/.test(cssRaw) || !/\.welcome-mode-btn\s*\{[\s\S]*border:\s*1\.5px solid var\(--welcome-outline\)/.test(cssRaw) || !/\.welcome-credit\s*\{[\s\S]*justify-content:\s*center/.test(cssRaw)) {
  fail('welcome launcher must be a centered rounded logo dialog with block-style mode buttons and footer credit');
}
if (!/body\.ui-theme-dark \.welcome-mode-btn\s*\{[\s\S]*--welcome-outline:\s*#e8f1ff[\s\S]*color:\s*var\(--welcome-outline\) !important[\s\S]*background:\s*var\(--welcome-fill\) !important/.test(cssRaw) || !/body\.ui-theme-dark \.welcome-tinyverse\s*\{[\s\S]*--welcome-outline:\s*#a9c6ff/.test(cssRaw) || !/body\.ui-theme-dark \.welcome-battleworlds\s*\{[\s\S]*--welcome-outline:\s*#9eeaff/.test(cssRaw) || !/body\.ui-theme-dark \.welcome-build\s*\{[\s\S]*--welcome-outline:\s*#ffd08a/.test(cssRaw)) {
  fail('welcome launcher game-type buttons must keep readable category text in dark mode');
}
if (!/body\.ui-theme-dark button\.corner-chrome-btn\s*\{[\s\S]*color:\s*#dcecff/.test(cssRaw) || !/body\.ui-theme-dark \.auth-btn\s*\{[\s\S]*background:\s*#dce7f8 !important[\s\S]*color:\s*#0e1724 !important/.test(cssRaw) || !/body\.ui-theme-dark \.auth-wallet-btn,\s*body\.ui-theme-dark \.auth-oauth-btn,\s*body\.ui-theme-dark \.auth-google-btn/.test(cssRaw) || !/body\.ui-theme-dark #account-modal \.tab-bar button/.test(cssRaw) || !/body\.ui-theme-dark #profile-photo-file::file-selector-button/.test(cssRaw)) {
  fail('dark mode must explicitly restyle hard-coded auth, account, and corner button surfaces');
}
if (!fs.existsSync(path.join(root, 'assets', 'twlogo.png')) || !/if \[\[ -d assets \]\]/.test(publishRaw) || !/\$DIST\/assets/.test(publishRaw)) {
  fail('welcome launcher logo must be shipped through the assets publish path');
}
if (!/#account-modal \.modal-card/.test(cssRaw) || !/#profile-photo-file::file-selector-button/.test(cssRaw) || !/#account-modal \.tab-bar button\.active/.test(cssRaw)) {
  fail('account modal must use scoped block-button styling, including the photo picker');
}
if (!/var CLOUD_OCCLUSION_RENDER_ORDER = 18/.test(html) || !/mesh\.renderOrder = CLOUD_OCCLUSION_RENDER_ORDER/.test(html) || !/foreground clouds veil full-opacity terrain/.test(html)) {
  fail('foreground clouds must render late enough to obscure terrain while keeping depth testing');
}
if (!/function queueActiveSnapshotUpdate/.test(html) || !/window\.addEventListener\('tinyworld:world-changed', queueActiveSnapshotUpdate\)/.test(html) || !/setInterval\(updateActiveSnapshot, 5000\)/.test(html)) {
  fail('cloud-backed world slots must queue autosave snapshots on world changes');
}
if (!/btn\.dataset\.posType = posType/.test(html) || !/close\.dataset\.posType = 'neutral'/.test(html) || !/btn\.dataset\.posType = 'tertiary'/.test(html)) {
  fail('radial action buttons must carry toolbar-compatible data-pos-type values');
}
if (!/\.radial-btn\[data-pos-type\]/.test(cssRaw) || !/border:\s*1\.5px solid var\(--radial-outline\)/.test(cssRaw) || !/body\.ui-theme-dark \.radial-btn\[data-pos-type\]/.test(cssRaw)) {
  fail('radial action buttons must keep circular toolbar-style category borders');
}
if (!/--radial-ink:\s*#143878/.test(cssRaw) || !/--radial-bg:\s*rgba\(232, 241, 255, 0\.96\)/.test(cssRaw) || !/color:\s*var\(--radial-ink\)/.test(cssRaw) || !/\.radial-btn\[data-pos-type\] \.radial-icon,\s*\.radial-btn\[data-pos-type\] \.radial-label/.test(cssRaw) || !/body\.ui-theme-dark \.radial-btn\[data-pos-type\] \.radial-label[\s\S]*color:\s*var\(--radial-ink\) !important/.test(cssRaw)) {
  fail('radial action labels/icons must use high-contrast adaptive ink on opaque button fills');
}
if (!/fenceStyle/.test(html) || !/Garden/.test(html) || !/makeVoxelFenceSpan\(span\.side, span\.level, span\.length, span\.style\)/.test(html)) {
  fail('garden fences must preserve style through placement/rendering while keeping span batching');
}
if (!/lamp-post/.test(html) || !/spotlight/.test(html) || !/placeableLightSource/.test(html) || !/registerPlaceableLightSource/.test(html)) {
  fail('lamp and spotlight stamps must render as capped placeable light sources');
}
if (!/function getEditableIslandPropellerDiscMaterial/.test(html) || !/propellerDiscShader/.test(html) || !/propellerBlurDisc/.test(html)) {
  fail('editable island lift propellers must switch to a shared shader blur disc at high RPM');
}
if (!/const FLIGHT_MODEL_FWD_FIX/.test(html) || !/function isFlyableStampCell/.test(html) || !/window\.tickFlight = tickFlight/.test(html)) {
  fail('flyable plane must stay wired as a Stamps model-stamp runtime, not a separate tool');
}
const flightSurfaceAtSceneBody = sourceFunctionBody(html, 'flightSurfaceAtScene');
if (/for \(const key in cellMeshes\)/.test(flightSurfaceAtSceneBody) || !/flightCollectSurfaceCandidates\(scenePos\)/.test(flightSurfaceAtSceneBody)) {
  fail('flight collision must use candidate cells instead of scanning all cellMeshes per frame');
}
if (!/const EDITABLE_ISLAND_PROP_LOCAL_Z = -2\.84/.test(html) || !/const EDITABLE_ISLAND_PROP_SPINDLE_LINK_Z = -2\.66/.test(html) || !/prop\.position\.set\(0,\s*0,\s*EDITABLE_ISLAND_PROP_LOCAL_Z - \(level - 1\) \* 0\.18\)/.test(html) || !/sourceCube\(body,\s*0,\s*0,\s*EDITABLE_ISLAND_PROP_SPINDLE_LINK_Z/.test(html) || !/prop\.userData\.spinRamp/.test(html)) {
  fail('editable island lift propellers must stay centered on the lift shaft and ramp into the blur disc');
}
if (!/showLegacyOuterCap = opts\.showOuterPropellerCap === true/.test(html) || !/showHubBlocks = opts\.showPropellerHubBlocks === true/.test(html) || !/legacyPropellerHubBlock/.test(html)) {
  fail('editable island lift propellers must hide old cap and hub blocks by default while keeping them opt-in');
}
const propellerDiscBody = sourceFunctionBody(html, 'getEditableIslandPropellerDiscMaterial');
if (!/uTint: \{ value: new THREE\.Color\(0x(?:2d3235|131517)\) \}/.test(propellerDiscBody) || !/uWarm: \{ value: new THREE\.Color\(0x(?:5f4935|4a3526)\) \}/.test(propellerDiscBody)) {
  fail('editable island lift propeller blur disc must stay dark enough to read at speed');
}
if (!/function getIslandRocketPlumeMaterial/.test(html) || !/rocketPlumeShader/.test(html) || !/rocketPlumeSheet/.test(html)) {
  fail('home island rocket plumes must use shared static shader sheets');
}
if (!/const ISLAND_ROCKET_PLUME_CAMERA_GATE_Y = 1\.15/.test(html) || !/function islandRocketPlumeVisibleFromCamera\(mesh\)/.test(html) || !/mesh\.visible = plumeVisible/.test(html) || !/if \(!plumeVisible\) continue;/.test(html)) {
  fail('home island rocket plume sheets must be hidden from above-surface camera views');
}
if (!/kind: 'flame', y: -1\.52, w: 0\.70, h: 1\.36/.test(html) || !/kind: 'smoke', y: -2\.12, w: 0\.78, h: 1\.00/.test(html)) {
  fail('home island rocket plume sheets must stay compact enough to avoid covering the board');
}
if (!/function updateIslandRocketPlumeFacing/.test(html) || !/mesh\.rotation\.y = Math\.atan2\(dx, dz\)/.test(html)) {
  fail('home island rocket plume sheets must yaw toward the camera so they do not render as flat slices');
}
if (/rocketPlumeSheet[\s\S]{0,900}quaternion\.copy\(camera\.quaternion\)/.test(html) || /rocketPlumeSheet[\s\S]{0,900}lookAt\(camera/.test(html)) {
  fail('home island rocket plume sheets must use constrained yaw-facing, not full camera quaternion/lookAt billboarding');
}
if (!/const LEGACY_ISLAND_ROCKET_PLUME_LAYERS = \[/.test(html) || !/function addLegacyIslandRocketVoxelPlume/.test(html) || !/function registerIslandRocketFlame/.test(html)) {
  fail('legacy home island rocket voxel plume objects must remain available for reuse');
}
const rocketEngineFactory = html.match(/function makeVoxelRocketEngine[\s\S]*?function addIslandRocketEngines/);
if (!rocketEngineFactory || !/addIslandRocketPlume\(g, seed\)/.test(rocketEngineFactory[0]) || /addLegacyIslandRocketVoxelPlume/.test(rocketEngineFactory[0])) {
  fail('home island rocket engine default must use the shader plume while keeping legacy voxel plumes inactive');
}
if (!/function voxelInvertedSteppedRoof/.test(html) || !/voxelInvertedSteppedRoof\(homeBorderGroup, GRID \* TILE/.test(html)) {
  fail('home board must include the inverted stepped roof underside for floating-island depth');
}
if (!/islandUnder:\s+new THREE\.MeshLambertMaterial\(\{ color: 0x34373b, side: THREE\.DoubleSide \}\)/.test(html) || !/islandUnderD: new THREE\.MeshLambertMaterial\(\{ color: 0x202327, side: THREE\.DoubleSide \}\)/.test(html)) {
  fail('island underside shell materials must be double-sided so secondary island sides do not vanish from underside views');
}
const islandProxyBody = sourceFunctionBody(html, 'makeEditableIslandProxy');
if (!/islandShellMaterial\(M\.grass\)/.test(islandProxyBody) || !/islandShellMaterial\(M\.dirtRich\)/.test(islandProxyBody) || !/node\.frustumCulled = false/.test(islandProxyBody)) {
  fail('editable island proxies must keep double-sided, group-culled side shells');
}
const prepareHomeBorderBody = sourceFunctionBody(html, 'prepareHomeBorderForRender');
if (!/c\.frustumCulled = false/.test(prepareHomeBorderBody)) {
  fail('floating island base shells must rely on group culling, not per-mesh clipping');
}
const vboxBody = sourceFunctionBody(html, 'vbox');
if (!/const hasHiddenFaces = opts\.skipTop \|\| opts\.skipBottom \|\| opts\.skipPX \|\| opts\.skipNX \|\| opts\.skipPZ \|\| opts\.skipNZ/.test(vboxBody) || !/getOpenBoxGeometry\(gw, gh, gd, opts\.skipTop, opts\.skipBottom, opts\.skipPX, opts\.skipNX, opts\.skipPZ, opts\.skipNZ\)/.test(vboxBody)) {
  fail('vbox must route hidden-face voxel pieces through cached open-box geometry');
}
const makeTileBody = sourceFunctionBody(html, 'makeTile');
const renderCellTileBody = sourceFunctionBody(html, 'renderCellTile');
if (!/const useVoxelTerrainForTile = renderVoxelTerrain && !\(opts && opts\.simpleTerrain\)/.test(makeTileBody) || !/shouldUseSimpleFlatGrassTile\(x, z, cell\)/.test(renderCellTileBody)) {
  fail('blank flat grass cells must bypass voxel terrain detail to keep empty islands cheap');
}
if (/<span>Preview distance<\/span>|<span>Preview window<\/span>|<span>Preview opacity<\/span>|<span>Preview floors<\/span>|<span>Preview objects<\/span>|<span>Voxel gap<\/span>|render-show-crowns/.test(html)) {
  fail('removed performance controls must stay out of Settings: preview, voxel gap, and show crowns are forced off');
}
if (!/visibleDistance:\s+'0'/.test(html) || !/visibleSize:\s+'0'/.test(html) || !/ghostOpacity:\s+'0'/.test(html) || !/floorOpacity:\s+'0'/.test(html) || !/objectOpacity:\s+'0'/.test(html) || !/showCrowns:\s+'0'/.test(html)) {
  fail('preview/crown render defaults must stay zeroed');
}
if (!/function mergeStaticBaseMeshesByMaterial/.test(html) || !/mergeStaticBaseMeshesByMaterial\(homeBorderGroup, \{ reason: 'home-island-border' \}\)/.test(html) || !/mergeStaticBaseMeshesByMaterial\(g, \{ reason: 'editable-island-base' \}\)/.test(html)) {
  fail('floating island bases must merge fixed shell and greeble meshes by material');
}
const distantWorldBody = sourceFunctionBody(html, 'buildDistantWorlds');
if (!/mergeStaticBaseMeshesByMaterial\(distantWorldGroup, \{ reason: 'distant-worlds' \}\)/.test(distantWorldBody) || !/o\.castShadow = false/.test(distantWorldBody)) {
  fail('distant worlds must be merged and non-shadowing so blank islands stay cheap');
}
if (!/let renderCloudShadow = storedNumber\(RENDER_LS\.cloudShadow, 0, 0, 1\)/.test(html)) {
  fail('cloud shadows must default to zero');
}
const invertedRoofBody = sourceFunctionBody(html, 'voxelInvertedSteppedRoof');
if (!/skipTop: true/.test(invertedRoofBody)) {
  fail('floating-island inverted roof layers must not render buried top faces');
}
const homeBorderBody = sourceFunctionBody(html, 'buildHomeBorder');
const editableIslandBaseBody = sourceFunctionBody(html, 'makeEditableIslandBase');
if (!/M\.islandUnderD, \{ noGap: true, skipTop: true \}/.test(homeBorderBody) || !/M\.islandUnderD, \{ noGap: true, skipTop: true \}/.test(editableIslandBaseBody)) {
  fail('home and duplicate island underside slabs must strip internal top faces');
}
if (!/sky-gradient-bubble/.test(html) || !/new THREE\.SphereGeometry\(120, 32, 16\)/.test(html) || !/THREE\.BackSide/.test(html)) {
  fail('background must include the inside-facing shader sphere gradient bubble');
}
if (!/under-island-clouds/.test(html) || !/function buildUnderIslandClouds/.test(html) || !/updateUnderIslandClouds\(dt\)/.test(html)) {
  fail('floating island must include a lightweight under-island cloud layer');
}
if (!/function makeUnderIslandCloud/.test(html) || !/new THREE\.InstancedMesh\(getDodecahedronGeometry\(1\)/.test(html)) {
  fail('under-island clouds must use lightweight instanced puffs');
}
if (!/mesh\.castShadow = renderCloudShadow > 0\.001/.test(html) || !/o\.castShadow = renderCloudShadow > 0\.001/.test(html)) {
  fail('clouds must leave the shadow pass when cloud shadow is disabled');
}
if (!/function maybeEnsureGhostBoardsAroundTarget/.test(html) || !/panCameraByPixels[\s\S]*maybeEnsureGhostBoardsAroundTarget\(\)/.test(html)) {
  fail('pixel-drag panning must throttle ghost preview work instead of rebuilding preview state on every pointer event');
}
if (!/ghostDetailReevaluationActive/.test(html) || !/if \(!ghostDetailReevaluationActive\) return;/.test(html)) {
  fail('ghost detail reevaluation must stay disabled unless a non-full-detail preview board exists');
}
if (!/_lastAppliedDisplayOpacity/.test(html)) {
  fail('opacity application must skip redundant root traversals when display opacity is unchanged');
}
if (!/function customTextureMaterial[\s\S]*base\.userData\.worldTextureScale[\s\S]*applyWorldUVs\(mat, tex, baseScale \* scale\)/.test(html)) {
  fail('custom appearance textures must inherit the base material world texture scale');
}
if (!/function makeSelectionPreviewObject/.test(html) || /makeVoxelBuild\(target\.cell\)/.test(html) || /makeGenericObject\(kind\)/.test(html)) {
  fail('selection preview must render real object factories instead of falling back to the blue cube');
}
const updateSelectionPreviewBody = sourceFunctionBody(html, 'updateSelectionPreview');
if (!/previewBox\.hidden \|\| previewBox\.classList\.contains\('selection-staging'\)/.test(updateSelectionPreviewBody)) {
  fail('hidden selection staging must not start the preview WebGL render loop');
}
const collectIslandCellsBody = sourceFunctionBody(html, 'collectIslandCells');
const renderChildRowBody = sourceFunctionBody(html, 'renderChildRow');
const renderLayersPanelBody = sourceFunctionBody(html, 'renderLayersPanel');
if (!/rowIsSelected\(x, z, selectedCoords\)/.test(collectIslandCellsBody) || /if \(!children\.length && !terrainOverride\) continue;/.test(collectIslandCellsBody)) {
  fail('Layers tree must include selected default cells instead of dropping them as empty grass');
}
if (!/activeLayerId === child\.id \|\| rowIsSelected\(x, z, selectedCoords\)/.test(renderChildRowBody)) {
  fail('Layers child rows must highlight when their world cell is selected from the canvas');
}
if (!/syncActiveLayerIdWithSelection\(selectedCoords\)/.test(renderLayersPanelBody) || !/scrollSelectedLayerIntoView\(\)/.test(renderLayersPanelBody)) {
  fail('Layers tree must sync stale active rows and keep selected rows visible');
}
const createWindowLightEffectsBody = sourceFunctionBody(html, 'createWindowLightEffects');
if (!/halo\.scale\.set\(windowW \* 2\.2, windowH \* 2\.0, 1\)/.test(createWindowLightEffectsBody)
    || /windowWallGlow/.test(createWindowLightEffectsBody)) {
  fail('house window lights must keep the visible halo bloom without reintroducing wall glow bleed');
}
if (/const useShaderAA = renderShaderAntialias > 0\.001 && !xrPresenting && !usePixelation/.test(html) || !/antialiasColor\(vUv, texel, col, edgeHint\)/.test(html)) {
  fail('shader antialiasing must work in pixel mode and be limited by edge detection');
}
if (/const wantNormals = usePixelation && \(renderPixelNormalEdge > 0\.001 \|\| renderShaderAntialias > 0\.001\)/.test(html) || !/function disposePixelNormalResources/.test(html)) {
  fail('shader antialiasing must not force the expensive normal pass when normal edges are disabled');
}
if (/#include <encodings_pars_fragment>/.test(html) || /#include <encodings_fragment>/.test(html) || !/#include <colorspace_fragment>/.test(html)) {
  fail('pixel post shader must apply renderer output color space so pixel mode does not darken the scene');
}
if (!/id="render-backdrop-vignette"/.test(html) || !/--backdrop-vignette/.test(html) || !/backdropVignette: 'tinyworld:render:backdropVignette'/.test(html)) {
  fail('environment settings must expose a persisted backdrop vignette control');
}
if (!/id="render-undercloud-spread"/.test(html) || !/underCloudSpread: 'tinyworld:render:underCloudSpread'/.test(html) || !/renderUnderCloudSpread/.test(html)) {
  fail('environment settings must expose a persisted undercloud width control');
}
if (!/id="render-sky-blue-depth"/.test(html) || !/id="render-sky-blue-saturation"/.test(html) || !/skyBlueSaturation: 'tinyworld:render:skyBlueSaturation'/.test(html) || !/--sky-blue-strong-rgb/.test(html)) {
  fail('environment settings must expose persisted blue depth and saturation controls');
}
const distanceMistBody = sourceFunctionBody(html, 'applyDistanceMistSettings');
if (!/distanceMistFogHex\(colorHex\)/.test(distanceMistBody) || !/DISTANCE_MIST_NEUTRAL/.test(html)) {
  fail('atmosphere fade must blend toward warm neutral haze, not raw blue sky');
}
if (!/SELECTION_BODY_COLOR_OPTIONS[\s\S]*Bluewash/.test(html) || !/SELECTION_TOP_COLOR_OPTIONS[\s\S]*Teal/.test(html) || !/SELECTION_LEAF_COLOR_OPTIONS[\s\S]*Lilac/.test(html)) {
  fail('selection color controls must provide the expanded palette');
}
if (!/id="render-ambient-fill"/.test(html) || !/id="render-front-fill"/.test(html) || !/id="render-side-fill"/.test(html) || !/id="render-back-fill"/.test(html)) {
  fail('render settings must expose ambient, front, side, and back fill controls');
}
if (!/const frontFill = makeFillLight/.test(html) || !/sideFillA\.intensity = renderSideFill/.test(html) || !/backFill\.intensity = renderBackFill/.test(html)) {
  fail('lighting controls must drive non-shadowing directional fill lights');
}
if (!/MODEL_STAMP_IMPORT_AMBIENT_BASE = [0-9.]+/.test(html) || !/MODEL_STAMP_IMPORT_DIRECTIONAL_BASE = [0-9.]+/.test(html) || !/var modelStampImportAmbientFill = new THREE\.AmbientLight/.test(html) || !/var modelStampImportDirFill = new THREE\.DirectionalLight/.test(html) || !/modelStampImportDirFill\.castShadow = false/.test(html) || !/modelStampImportDirFill\.position\.copy\(target\)\.add\(MODEL_STAMP_IMPORT_LIGHT_OFFSET\)/.test(html)) {
  fail('model-stamp import lighting must add the supplied ambient/directional safety fill without a shadow caster');
}
if (!/modelStampImportAmbientFill\.intensity = MODEL_STAMP_IMPORT_AMBIENT_BASE \* renderAmbientFill/.test(html) || !/modelStampImportDirFill\.intensity = MODEL_STAMP_IMPORT_DIRECTIONAL_BASE \* renderLighting/.test(html) || !/lightBase\.modelStampDirI/.test(html)) {
  fail('model-stamp import lighting must follow render controls and time-of-day modulation');
}
if (!/function addWaterfallRiserEffects/.test(html) || !/terrain === 'water'[\s\S]*addWaterfallRiserEffects/.test(html)) {
  fail('exposed water risers must render lightweight waterfall effects');
}
if (!/const WATERFALL_FROTH_SPEED = 0\.30/.test(html)) {
  fail('waterfall foam/froth animation must stay slow enough to read as drifting foam');
}
if (!/function updateWaterfallEffects/.test(html) || !/updateWaterfallEffects\(t\)/.test(html)) {
  fail('waterfall effects must animate in the main render loop');
}
if (/addWaterfallRiserEffects\(g, x, z, riserSize, topY - 0\.018, \{\s*e: !skipE,\s*w: !skipW,\s*s: !skipS,\s*n: !skipN,/s.test(html)) {
  fail('waterfalls must be limited to exposed or downhill water edges, not every same-level shoreline');
}
for (const section of ['app', 'rendering', 'world', 'materials', 'environment', 'crowd', 'ai']) {
  if (!new RegExp('data-settings-tab="' + section + '"').test(html)) fail('settings tab missing: ' + section);
  if (!new RegExp('data-settings-panel="' + section + '"').test(html)) fail('settings panel missing: ' + section);
}
for (const retiredSection of ['screen', 'sky']) {
  if (new RegExp('data-settings-(?:tab|panel)="' + retiredSection + '"').test(html)) {
    fail('retired settings section still present: ' + retiredSection);
  }
}
if (!/Settings — Rendering/.test(html) || !/Settings — Environment/.test(html) || /Settings — Screen/.test(html) || /Settings — Sky/.test(html)) {
  fail('command palette settings entries must match the reorganized settings sections');
}
function settingsPanelBody(section) {
  const marker = 'data-settings-panel="' + section + '"';
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) fail('settings panel missing: ' + section);
  const openStart = html.lastIndexOf('<section', markerIndex);
  const openEnd = html.indexOf('>', markerIndex);
  const closeIndex = html.indexOf('</section>', openEnd);
  if (openStart < 0 || openEnd < 0 || closeIndex < 0) fail('settings panel malformed: ' + section);
  return html.slice(openEnd + 1, closeIndex);
}
const settingsControlGroups = {
  app: ['render-home-grid'],
  rendering: ['render-shadow', 'render-resolution', 'render-dynamic-resolution', 'render-target-fps', 'render-brightness', 'render-ambient-fill', 'render-front-fill', 'render-side-fill', 'render-back-fill', 'render-pixel-size', 'render-tilt-focus'],
  world: ['render-voxel-terrain', 'render-terrain-voxel-resolution'],
  materials: ['render-material-wear', 'render-terrain-color-target', 'render-terrain-texture', 'render-material-target', 'render-material-texture'],
  environment: ['render-clouds', 'render-cloud-speed', 'render-undercloud-spread', 'render-sky-blue-depth', 'render-sky-blue-saturation', 'render-distance-mist', 'render-backdrop', 'render-backdrop-vignette'],
  crowd: ['crowd-count', 'crowd-enabled', 'crowd-reseed'],
  ai: ['gen-provider', 'gen-model', 'gen-key'],
};
for (const [section, ids] of Object.entries(settingsControlGroups)) {
  const body = settingsPanelBody(section);
  for (const id of ids) {
    if (!new RegExp('id="' + id + '"').test(body)) fail('settings control ' + id + ' is not in the ' + section + ' section');
  }
}

if (!externalSchema.properties || !externalSchema.properties.gridSize) fail('schema missing gridSize contract');
const gridSizeEnum = externalSchema.properties.gridSize.enum || [];
if (JSON.stringify(gridSizeEnum) !== JSON.stringify([8, 10, 12, 16, 20])) {
  fail('gridSize enum must stay capped at 20');
}
if (!/const HOME_GRID_MAX = 20;/.test(html) || !/const HOME_GRID_OPTIONS = \[8, 10, 12, 16, 20\];/.test(html)) {
  fail('home grid constants must stay capped at 20');
}
const homeGridResizeBody = sourceFunctionBody(html, 'setHomeGridSize');
if (!/clearMooringCables\(\);/.test(homeGridResizeBody)) {
  fail('home grid resize must reset stale mooring anchors');
}
const starterSceneBody = sourceFunctionBody(html, 'loadInitialScene');
if (!/clearMooringCables\(\);/.test(starterSceneBody) || !/clearEditableIslands\(\);/.test(starterSceneBody)) {
  fail('starter scene reload must clear mooring and editable-island topology');
}
const islandStressBody = sourceFunctionBody(html, 'runIslandStressDemo');
if (!/clearMooringCables\(\);\s*clearEditableIslands\(\);/.test(islandStressBody)) {
  fail('island stress demo must clear stale moorings when replacing islands');
}
if (shippedDefaults.settings && Object.prototype.hasOwnProperty.call(shippedDefaults.settings, 'tinyworld:audio:music-track')) {
  fail('shipped defaults must not pin a manual music track');
}
const cellDef = externalSchema.$defs && externalSchema.$defs.cell;
if (!cellDef || !Array.isArray(cellDef.oneOf)) fail('schema must accept tuple and object cells via $defs.cell.oneOf');

let vercel;
try {
  vercel = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
} catch (err) {
  fail('vercel.json is not valid JSON: ' + err.message);
}
const headers = ((vercel.headers || [])[0] || {}).headers || [];
if (!headers.some(h => h.key === 'Content-Security-Policy' && /script-src 'self'/.test(h.value || ''))) {
  fail('vercel.json missing self-hosted runtime CSP');
}

let netlifyText;
try {
  netlifyText = fs.readFileSync(netlifyPath, 'utf8');
} catch (err) {
  fail('netlify.toml missing or unreadable: ' + err.message);
}
for (const [needle, label] of [
  ['command = "./publish.sh"', 'Netlify build command'],
  ['publish = "dist"', 'Netlify publish directory'],
  ['NODE_VERSION = "22"', 'Netlify Node version'],
  ['directory = "netlify/functions"', 'Netlify functions directory'],
  ['from = "/island-viewer"', 'Island Viewer route'],
  ['to = "/island-viewer.html"', 'Island Viewer static shell target'],
  ['Content-Security-Policy = "default-src', 'Netlify CSP header'],
  ['script-src \'self\'', 'Netlify self-hosted script policy'],
]) {
  if (!netlifyText.includes(needle)) fail('netlify.toml missing ' + label);
}
if (!/id="tinyworld-auth-importmap"/.test(htmlRaw) || !/vendor\/tinyworld-auth\.js/.test(htmlRaw)) {
  fail('Netlify Identity browser bridge must be loaded from self-hosted vendor files');
}
if (!/window\.__tinyworldAuthReady/.test(html) || !/window\.__tinyworldAuthBootWaited/.test(html)) {
  fail('auth boot must wait for the module bridge before falling back to anonymous mode');
}
if (!/Authorization'?\]\s*=/.test(html) && !/opts\.headers\.Authorization\s*=/.test(html)) {
  fail('cloud account API calls must send the Netlify Identity bearer token');
}
if (!/data-action="share"/.test(htmlRaw) || !/\/api\/share/.test(html)) {
  fail('world menu must expose share URL creation through /api/share');
}
if (!/data-action="collaborate"/.test(htmlRaw) || !/worldMenuCollaborateUrl/.test(html) || !/searchParams\.set\('party'/.test(html)) {
  fail('world menu must expose collaborate URL creation through share id + PartyKit room id');
}
if (!/<div[^>]+id="wallet-payment-section"[^>]+hidden[^>]+data-feature-hidden="wallet-payment"/.test(htmlRaw)) {
  fail('wallet payment UI must remain hidden until payments are re-enabled');
}
if (!/<div[^>]+id="voice-section"[^>]+hidden[^>]+data-feature-hidden="livekit-voice"/.test(htmlRaw)) {
  fail('LiveKit voice UI must remain hidden until voice is re-enabled');
}
if (!/params\.get\('share'\)/.test(html) || !/\/api\/share\?id=/.test(html)) {
  fail('shared worlds must load from ?share= ids through the same-origin API');
}
if (!/ws: wss:/.test(netlifyText)) {
  fail('Netlify CSP must permit PartyKit websocket connections');
}
if (!/script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'/.test(netlifyText) || !/worker-src 'self' blob:/.test(netlifyText) || !/connect-src 'self' blob: data: https: http: ws: wss:/.test(netlifyText)) {
  fail('Netlify CSP must permit GLB blob URLs, Draco workers, and WASM decoders');
}
if (!/wasm-unsafe-eval/.test(JSON.stringify(headers)) || !/worker-src 'self' blob:/.test(JSON.stringify(headers)) || !/connect-src 'self' blob: data: https: http: ws: wss:/.test(JSON.stringify(headers))) {
  fail('Vercel CSP must permit GLB blob URLs, Draco workers, and WASM decoders');
}
if (!/function twCloudSyncLocalWorldsToCloud/.test(html) || !/function twCloudSyncAssetsBothWays/.test(html) || !/\/api\/assets/.test(html)) {
  fail('local worlds and asset libraries must sync to the authenticated DB APIs');
}
if (!/function queueActiveSnapshotUpdate/.test(html) || !/window\.addEventListener\('tinyworld:world-changed', queueActiveSnapshotUpdate\)/.test(html) || !/setInterval\(updateActiveSnapshot, 5000\)/.test(html)) {
  fail('cloud-backed worlds must regularly and edit-trigger sync their active snapshot');
}
if (!/engine\/world\/38-multiplayer-partykit\.js/.test(htmlRaw) || !/function wirePartyKitMultiplayer/.test(html)) {
  fail('PartyKit multiplayer browser module must be loaded');
}
if (!/tinyworld:world-changed/.test(html) || !/type: 'cell\.set'/.test(html) || !/new WebSocket/.test(html)) {
  fail('PartyKit multiplayer must broadcast cell edits over websocket');
}
if (!/function twImportJSONPayload/.test(html) || !/function twImportWorldEntriesFromJSON/.test(html) || !/twImportLooksLikeAssetLibrary/.test(html)) {
  fail('JSON import must accept world files, named-world lists, and asset-library bundles');
}
if (!/<label[^>]+id="import"[^>]+for="import-file"/.test(htmlRaw) || !/id="import-file"[^>]+class="file-input-proxy"/.test(htmlRaw)) {
  fail('JSON import must use native label activation, not a hidden-input click-only path');
}
const twPickJSONFileBody = sourceFunctionBody(html, 'twPickJSONFile');
if (/setTimeout\(\(\) => \{ if \(input\.parentNode\) input\.parentNode\.removeChild\(input\); \}, 1000\)/.test(twPickJSONFileBody) || !/input\.addEventListener\('cancel'/.test(twPickJSONFileBody)) {
  fail('dynamic JSON file pickers must not remove the input before the native picker returns');
}
for (const file of [
  'netlify/functions/profile.mjs',
  'netlify/functions/builds.mjs',
  'netlify/functions/share.mjs',
  'netlify/functions/assets.mjs',
  'netlify/functions/lib/auth.mjs',
  'netlify/functions/lib/db.mjs',
  'netlify/database/migrations/20260510230951_create_builds_and_profiles_tables/migration.sql',
  'netlify/database/migrations/20260510234708_familiar_penance/migration.sql',
  'netlify/database/migrations/20260531120000_tinyworld_accounts.sql',
  'netlify/database/migrations/20260531124500_tinyworld_asset_libraries.sql',
]) {
  if (!fs.existsSync(path.join(root, file))) fail('Netlify account backend missing: ' + file);
}
const buildsFunction = fs.readFileSync(path.join(root, 'netlify/functions/builds.mjs'), 'utf8');
if (!/request\.method === 'PUT'/.test(buildsFunction) || !/updated_at = NOW\(\)/.test(buildsFunction)) {
  fail('/api/builds must update existing cloud worlds for local world sync');
}
const shareFunction = fs.readFileSync(path.join(root, 'netlify/functions/share.mjs'), 'utf8');
if (!/export const config = \{ path: '\/api\/share' \}/.test(shareFunction) || !/world_shares/.test(shareFunction)) {
  fail('/api/share function must store public share records');
}
const assetsFunction = fs.readFileSync(path.join(root, 'netlify/functions/assets.mjs'), 'utf8');
if (!/export const config = \{ path: '\/api\/assets' \}/.test(assetsFunction) || !/asset_libraries/.test(assetsFunction)) {
  fail('/api/assets function must persist the authenticated asset library');
}
const accountMigration = fs.readFileSync(path.join(root, 'netlify/database/migrations/20260531120000_tinyworld_accounts.sql'), 'utf8');
for (const table of ['profiles', 'builds', 'world_shares']) {
  if (!new RegExp('CREATE TABLE IF NOT EXISTS ' + table).test(accountMigration)) {
    fail('account migration missing table: ' + table);
  }
}
const assetMigration = fs.readFileSync(path.join(root, 'netlify/database/migrations/20260531124500_tinyworld_asset_libraries.sql'), 'utf8');
if (!/CREATE TABLE IF NOT EXISTS asset_libraries/.test(assetMigration)) {
  fail('asset library migration missing table');
}
if (!fs.existsSync(partykitPath)) fail('partykit.json missing');
const partykitConfig = fs.readFileSync(partykitPath, 'utf8');
if (!/"main"\s*:\s*"party\/index\.js"/.test(partykitConfig) || !/"port"\s*:\s*1999/.test(partykitConfig)) {
  fail('partykit.json must point at party/index.js on port 1999');
}
const partyServerPath = path.join(root, 'party/index.js');
if (!fs.existsSync(partyServerPath)) fail('PartyKit room server missing');
const partyServer = fs.readFileSync(partyServerPath, 'utf8');
// Relays presence + cell.set to participants. Originally via this.room.broadcast;
// the lobby/roles work narrows world+presence to admitted peers only, so
// broadcastToAdmitted is now the sanctioned relay (lobby members must not
// receive world data). Accept either so the guard tracks the real architecture.
if (!/onConnect\(conn\)/.test(partyServer) || !(/this\.room\.broadcast/.test(partyServer) || /broadcastToAdmitted/.test(partyServer)) || !/cell\.set/.test(partyServer) || !/presence/.test(partyServer)) {
  fail('PartyKit room server must relay presence and cell.set messages');
}
const pkgText = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
if (!/"party:dev"\s*:\s*"partykit dev party\/index\.js --port 1999"/.test(pkgText)) {
  fail('package.json missing party:dev script');
}
const featureFlagsFunctionPath = path.join(root, 'netlify/functions/feature-flags.mjs');
if (!fs.existsSync(featureFlagsFunctionPath)) fail('Netlify feature flags function missing');
const featureFlagsFunction = fs.readFileSync(featureFlagsFunctionPath, 'utf8');
if (!/export const config = \{ path: '\/api\/feature-flags' \}/.test(featureFlagsFunction) || !/savePersistedFeatureFlags/.test(featureFlagsFunction)) {
  fail('/api/feature-flags must persist flags for production admin saves');
}
if (/const __dirname\s*=/.test(fs.readFileSync(path.join(root, 'netlify/functions/lib/feature-flags-store.mjs'), 'utf8'))) {
  fail('feature-flags-store must not declare __dirname (esbuild bundle collision)');
}
const featureFlagsClient = fs.readFileSync(path.join(root, 'engine/world/00b-feature-flags.js'), 'utf8');
if (/twSetElementsHidden\(\['#render-settings', '#render-modal'\]/.test(featureFlagsClient)) {
  fail('feature flags must not set render-modal.hidden=false on apply (auto-opens settings)');
}
if (!fs.existsSync(path.join(root, 'tinyworld-feature-flags.json'))) fail('tinyworld-feature-flags.json missing');
if (!fs.existsSync(path.join(root, 'netlify/database/migrations/20260629120000_site_feature_flags.sql'))) {
  fail('site_feature_flags migration missing');
}

// i18n: locale parity (en/fr/es/zh) + referenced-key validation. Runs as part
// of the publish gate so a missing or empty translation blocks the build.
try {
  require('child_process').execFileSync(
    process.execPath,
    [path.join(__dirname, 'i18n-check.js')],
    { stdio: 'inherit' }
  );
} catch (_) {
  fail('i18n check failed (see tools/i18n-check.js output above)');
}

console.log('ok');
