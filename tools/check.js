#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'tiny-world-builder.html');
const schemaPath = path.join(root, 'world.schema.json');
const vercelPath = path.join(root, 'vercel.json');
const netlifyPath = path.join(root, 'netlify.toml');
const html = fs.readFileSync(htmlPath, 'utf8');

function fail(message) {
  console.error('check failed:', message);
  process.exit(1);
}

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (!scriptMatch) fail('inline app script missing');
try {
  new Function(scriptMatch[1]);
} catch (err) {
  fail('inline app script syntax error: ' + err.message);
}

let externalSchema;
try {
  externalSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
} catch (err) {
  fail('world.schema.json is not valid JSON: ' + err.message);
}

const schemaStart = html.indexOf('  const WORLD_SCHEMA = ');
const schemaEnd = html.indexOf('\n\n  // -------- AI generation --------', schemaStart);
if (schemaStart < 0 || schemaEnd < 0) fail('embedded WORLD_SCHEMA block missing');
let embeddedSource = html.slice(schemaStart + '  const WORLD_SCHEMA = '.length, schemaEnd).trim();
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
for (const match of html.matchAll(attrPattern)) {
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
if (!/function addVoxelTerrainRiserBacking/.test(html) || !/addVoxelTerrainRiserBacking\(g, terrain, riserSize, DIRT_H \+ rise/.test(html)) {
  fail('voxel terrain sides must include a solid backing behind detailed panels');
}
if (/addVoxelTerrainRiser\(g, terrain, x, z, rise, riserSize, DIRT_H \+ rise/.test(html)) {
  fail('voxel terrain sides must use solid shader-textured walls, not thousands of side panels');
}
if (!/function terrainSurfaceOffset/.test(html) || !/function addHeavyTerrainKerbStrips/.test(html) || !/addHeavyTerrainKerbStrips\(g, terrain, x, z, terrainN, topSize, topY\)/.test(html)) {
  fail('heavy terrain must render depressed surfaces with lightweight brick kerb strips');
}
if (!/addVoxelTerrainTop\(g, terrain, x, z, visualRise - seamOverlap \* 0\.5/.test(html) || !/function terrainVisualRiseForCell/.test(html)) {
  fail('heavy terrain visual drop must drive tile tops and object/surface heights');
}
if (!/terrain === 'water'\) return -0\.070/.test(html) || !/terrain === 'dirt'\) return 0\.034/.test(html)) {
  fail('terrain surface offsets must lower water channels and lift dirt/soil slightly');
}
if (!/waterfallFoamPuff/.test(html) || !/function getWaterfallFoamGeometry/.test(html) || !/kind: 'foam'/.test(html)) {
  fail('waterfalls must include animated translucent foam puffs');
}
if (!/function voxelInvertedSteppedRoof/.test(html) || !/voxelInvertedSteppedRoof\(homeBorderGroup, GRID \* TILE/.test(html)) {
  fail('home board must include the inverted stepped roof underside for floating-island depth');
}
if (!/sky-gradient-bubble/.test(html) || !/new THREE\.SphereGeometry\(120, 32, 16\)/.test(html) || !/THREE\.BackSide/.test(html)) {
  fail('background must include the inside-facing shader sphere gradient bubble');
}
if (!/under-island-clouds/.test(html) || !/function buildUnderIslandClouds/.test(html) || !/updateUnderIslandClouds\(dt\)/.test(html)) {
  fail('floating island must include a lightweight under-island cloud layer');
}
if (!/function makeSelectionPreviewObject/.test(html) || /makeVoxelBuild\(target\.cell\)/.test(html) || /makeGenericObject\(kind\)/.test(html)) {
  fail('selection preview must render real object factories instead of falling back to the blue cube');
}
if (/const useShaderAA = renderShaderAntialias > 0\.001 && !xrPresenting && !usePixelation/.test(html) || !/antialiasColor\(vUv, texel, col, edgeHint\)/.test(html)) {
  fail('shader antialiasing must work in pixel mode and be limited by edge detection');
}
if (/#include <encodings_pars_fragment>/.test(html) || !/#include <encodings_fragment>/.test(html)) {
  fail('pixel post shader must apply renderer output encoding so pixel mode does not darken the scene');
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
if (!/SELECTION_BODY_COLOR_OPTIONS[\s\S]*Bluewash/.test(html) || !/SELECTION_TOP_COLOR_OPTIONS[\s\S]*Teal/.test(html) || !/SELECTION_LEAF_COLOR_OPTIONS[\s\S]*Lilac/.test(html)) {
  fail('selection color controls must provide the expanded palette');
}
if (!/id="render-ambient-fill"/.test(html) || !/id="render-front-fill"/.test(html) || !/id="render-side-fill"/.test(html) || !/id="render-back-fill"/.test(html)) {
  fail('render settings must expose ambient, front, side, and back fill controls');
}
if (!/const frontFill = makeFillLight/.test(html) || !/sideFillA\.intensity = renderSideFill/.test(html) || !/backFill\.intensity = renderBackFill/.test(html)) {
  fail('lighting controls must drive non-shadowing directional fill lights');
}
if (!/function addWaterfallRiserEffects/.test(html) || !/terrain === 'water'[\s\S]*addWaterfallRiserEffects/.test(html)) {
  fail('exposed water risers must render lightweight waterfall effects');
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
  rendering: ['render-shadow', 'render-resolution', 'render-brightness', 'render-ambient-fill', 'render-front-fill', 'render-side-fill', 'render-back-fill', 'render-pixel-size', 'render-tilt-focus'],
  world: ['render-distance', 'render-visible-size', 'render-ghost-opacity', 'render-voxel-terrain', 'render-terrain-voxel-resolution'],
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
  ['Content-Security-Policy = "default-src', 'Netlify CSP header'],
  ['script-src \'self\'', 'Netlify self-hosted script policy'],
]) {
  if (!netlifyText.includes(needle)) fail('netlify.toml missing ' + label);
}

console.log('ok');
