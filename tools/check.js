#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'tiny-world-builder.html');
const schemaPath = path.join(root, 'world.schema.json');
const vercelPath = path.join(root, 'vercel.json');
const netlifyPath = path.join(root, 'netlify.toml');
const htmlRaw = fs.readFileSync(htmlPath, 'utf8');
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
    out.push({ file: 'LandscapeEngine.js', source: fs.readFileSync(landscape, 'utf8') });
  }
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.js')) {
        out.push({ file: path.relative(rootDir, full), source: fs.readFileSync(full, 'utf8') });
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

if (!/<script src="engine\/world\/[^"]+\.js">/.test(htmlRaw)) {
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
  fail('tinyworld-defaults.json is not valid JSON: ' + err.message);
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
// The page hard-depends on its external stylesheet. A build that does not copy
// styles/ into dist deploys an unstyled page (CSS 404 served as text/html), so
// guard both the <link> reference and the publish.sh copy step.
if (/<link[^>]+rel=["']stylesheet["'][^>]+href=["']styles\//.test(htmlRaw)) {
  if (!/dist\/styles/.test(fs.readFileSync(path.join(root, 'publish.sh'), 'utf8'))) {
    fail('referenced styles/ stylesheet must be copied to dist/styles by publish.sh');
  }
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
if (!/waterfallFoamPuff/.test(html) || !/function getWaterfallFoamGeometry/.test(html) || !/kind: 'foamBatch'/.test(html)) {
  fail('waterfalls must include batched translucent foam puffs');
}
if (!/function getWaterfallCurtainMaterial/.test(html) || !/function getWaterfallSurfaceMaterial/.test(html) || !/kind: 'shaderSheet'/.test(html)) {
  fail('waterfall curtains and surface flows must use shared shader sheets');
}
if (!/function optimizeVoxelObjectGroup/.test(html) || !/new THREE\.InstancedMesh\(bucket\.geometry, bucket\.material, bucket\.items\.length\)/.test(html)) {
  fail('voxel object factories must have a shared InstancedMesh batching helper');
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
if (!/optimizeVoxelObjectGroup\(homeBorderGroup, \{ reason: 'home-island-border' \}\)/.test(html) || !/optimizeVoxelObjectGroup\(g, \{ reason: 'editable-island-base' \}\)/.test(html)) {
  fail('home and duplicate island base dressing must route repeated voxel pieces through batching');
}
if (!/function findFenceRenderSpan/.test(html) || !/function makeVoxelFenceSpan/.test(html) || !/batchedSpan: true/.test(html)) {
  fail('voxel fences must collapse same-style contiguous rows into batched spans');
}
if (!/function getEditableIslandPropellerDiscMaterial/.test(html) || !/propellerDiscShader/.test(html) || !/propellerBlurDisc/.test(html)) {
  fail('editable island lift propellers must switch to a shared shader blur disc at high RPM');
}
if (!/const EDITABLE_ISLAND_PROP_LOCAL_Z = -2\.84/.test(html) || !/const EDITABLE_ISLAND_PROP_SPINDLE_LINK_Z = -2\.66/.test(html) || !/prop\.position\.set\(0,\s*0,\s*EDITABLE_ISLAND_PROP_LOCAL_Z - \(level - 1\) \* 0\.18\)/.test(html) || !/sourceCube\(body,\s*0,\s*0,\s*EDITABLE_ISLAND_PROP_SPINDLE_LINK_Z/.test(html) || !/prop\.userData\.spinRamp/.test(html)) {
  fail('editable island lift propellers must stay centered on the lift shaft and ramp into the blur disc');
}
if (!/showLegacyOuterCap = opts\.showOuterPropellerCap === true/.test(html) || !/showHubBlocks = opts\.showPropellerHubBlocks === true/.test(html) || !/legacyPropellerHubBlock/.test(html)) {
  fail('editable island lift propellers must hide old cap and hub blocks by default while keeping them opt-in');
}
if (!/uTint: \{ value: new THREE\.Color\(0x2d3235\) \}/.test(html) || !/uWarm: \{ value: new THREE\.Color\(0x5f4935\) \}/.test(html)) {
  fail('editable island lift propeller blur disc must stay dark enough to read at speed');
}
if (!/function getIslandRocketPlumeMaterial/.test(html) || !/rocketPlumeShader/.test(html) || !/rocketPlumeSheet/.test(html)) {
  fail('home island rocket plumes must use shared static shader sheets');
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
const islandSideBackingBody = sourceFunctionBody(html, 'addIslandSideBacking');
if (!/islandShellMaterial\(M\.boardSide\)/.test(islandSideBackingBody) || !/skipTop: true, skipBottom: true/.test(islandSideBackingBody)) {
  fail('floating island side backing must keep a cheap double-sided wall behind edge greebles');
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
if (!/addIslandSideBacking\(homeBorderGroup\)/.test(homeBorderBody) || !/addIslandSideBacking\(g\)/.test(editableIslandBaseBody)) {
  fail('home and duplicate island bases must include persistent side backing behind edge greebles');
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
if (/const useShaderAA = renderShaderAntialias > 0\.001 && !xrPresenting && !usePixelation/.test(html) || !/antialiasColor\(vUv, texel, col, edgeHint\)/.test(html)) {
  fail('shader antialiasing must work in pixel mode and be limited by edge detection');
}
if (/const wantNormals = usePixelation && \(renderPixelNormalEdge > 0\.001 \|\| renderShaderAntialias > 0\.001\)/.test(html) || !/function disposePixelNormalResources/.test(html)) {
  fail('shader antialiasing must not force the expensive normal pass when normal edges are disabled');
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
  rendering: ['render-shadow', 'render-resolution', 'render-brightness', 'render-ambient-fill', 'render-front-fill', 'render-side-fill', 'render-back-fill', 'render-pixel-size', 'render-tilt-focus'],
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
if (JSON.stringify(gridSizeEnum) !== JSON.stringify([8, 12, 16, 20])) {
  fail('gridSize enum must stay capped at 20');
}
if (!/const HOME_GRID_MAX = 20;/.test(html) || !/const HOME_GRID_OPTIONS = \[8, 12, 16, 20\];/.test(html)) {
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
const farmStartBody = sourceFunctionBody(html, 'startFarmWorld');
if (!/doReset\(\);/.test(farmStartBody)) {
  fail('welcome farm start must use the full reset lifecycle');
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
  ['Content-Security-Policy = "default-src', 'Netlify CSP header'],
  ['script-src \'self\'', 'Netlify self-hosted script policy'],
]) {
  if (!netlifyText.includes(needle)) fail('netlify.toml missing ' + label);
}

console.log('ok');
