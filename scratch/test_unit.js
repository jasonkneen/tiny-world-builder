const assert = require('assert');

// Mock localStorage
const storage = {
  'tinyworld:render:autoExpand': '1',
  'tinyworld:render:visibleSize': '9'
};
const localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); }
};

// Mock THREE
const THREE = {
  NearestFilter: 1,
  RepeatWrapping: 2,
  CanvasTexture: class {},
  Vector3: class {
    constructor() { this.x = 0; this.y = 0; this.z = 0; }
  },
  Map: Map
};

// Mock global variables
const GRID = 8;
const HOME_GRID_MAX = 48;
const FADE_BUCKETS = 16;
const fadeMatCache = new Map();
const customMaterialCache = new Map();

function coerceGridSize(grid, fallback) {
  return grid || fallback;
}

function renderBudgetForGrid(grid) {
  const g = coerceGridSize(grid, GRID);
  if (g >= 256) return { maxDistance: 0, ghostRadius: 0, visibleScale: 1.0, homeWindowMin: 16, homeWindowMax: 32, queueCap: 32 };
  if (g >= 128) return { maxDistance: 0, ghostRadius: 0, visibleScale: 1.0, homeWindowMin: 16, homeWindowMax: 32, queueCap: 32 };
  if (g >= 96)  return { maxDistance: 0, ghostRadius: 0, visibleScale: 1.0, homeWindowMin: 16, homeWindowMax: 32, queueCap: 32 };
  if (g >= 64)  return { maxDistance: 1, ghostRadius: 1, visibleScale: 1.05, homeWindowMin: 28, homeWindowMax: 96, queueCap: 96 };
  if (g >= 48)  return { maxDistance: 1, ghostRadius: 1, visibleScale: 1.05, homeWindowMin: 22, homeWindowMax: 36, queueCap: 128 };
  if (g >= 32)  return { maxDistance: 1, ghostRadius: 2, visibleScale: 1.08, homeWindowMin: 18, homeWindowMax: 26, queueCap: 128 };
  return { maxDistance: g <= 12 ? 4 : 2, ghostRadius: g <= 12 ? 4 : 2, visibleScale: 1.125, homeWindowMin: g, homeWindowMax: g, queueCap: 256 };
}

let landscapeMeshMode = false;

// 1. Test maxRenderVisibleSizeForGrid and TDZ / Initialization
let renderAutoExpand = localStorage.getItem('tinyworld:render:autoExpand') === '1';

function maxRenderVisibleSizeForGrid(grid) {
  const g = coerceGridSize(grid, GRID);
  if (landscapeMeshMode) {
    return Math.max(48, g * 4);
  }
  const budget = renderBudgetForGrid(g);
  return Math.max(g, Math.min(Math.round(HOME_GRID_MAX * 1.5), Math.ceil(g * budget.visibleScale)));
}

// 2. Test pickFadeMaterial copies onBeforeCompile
function fadeBucketFor(opacity) {
  return Math.round(opacity * FADE_BUCKETS);
}
function desaturateMaterial(mat) {}

function pickFadeMaterial(baseMat, grayscale, displayOpacity, keepFadeAtOpaque = false) {
  const bucket = fadeBucketFor(displayOpacity);
  if (bucket === FADE_BUCKETS && !grayscale && !keepFadeAtOpaque) return baseMat;
  const key = baseMat.uuid + '|' + (grayscale ? 1 : 0) + '|' + bucket + '|' + (keepFadeAtOpaque ? 1 : 0);
  const hit = fadeMatCache.get(key);
  if (hit) return hit;
  const mat = baseMat.clone();
  if (baseMat.onBeforeCompile) mat.onBeforeCompile = baseMat.onBeforeCompile;
  if (grayscale) desaturateMaterial(mat);
  const baseOp = baseMat.opacity === undefined ? 1 : baseMat.opacity;
  const factor = bucket / FADE_BUCKETS;
  mat.opacity = baseOp * factor;
  mat.transparent = keepFadeAtOpaque || factor < 1 || baseOp < 1;
  mat.depthWrite = keepFadeAtOpaque ? false : (factor >= 1 && baseOp >= 1);
  mat.userData = mat.userData || {};
  mat.userData.cachedFade = true;
  fadeMatCache.set(key, mat);
  return mat;
}

// 3. Test customMaterial copies onBeforeCompile
function normalizeHexColor(hex) {
  return hex;
}
function customMaterial(base, hex) {
  const clean = normalizeHexColor(hex);
  if (!base || !base.clone || !clean) return base;
  const key = (base.uuid || base.id || 'mat') + ':' + clean;
  if (!customMaterialCache.has(key)) {
    const mat = base.clone();
    if (base.onBeforeCompile) mat.onBeforeCompile = base.onBeforeCompile;
    if (mat.color) mat.color.set(clean);
    customMaterialCache.set(key, mat);
  }
  return customMaterialCache.get(key);
}

// --- RUN TESTS ---

console.log('Testing maxRenderVisibleSizeForGrid...');
// Autoexpand should keep the preview window close to the board size; neighbour
// board readiness is controlled by ghostPreloadRadius, not renderVisibleSize.
let sizeWithAutoExpand = maxRenderVisibleSizeForGrid(8);
console.log(`With Autoexpand (GRID=8): ${sizeWithAutoExpand} (Expected: 9)`);
assert.strictEqual(sizeWithAutoExpand, 9);

renderAutoExpand = false;
let sizeWithoutAutoExpand = maxRenderVisibleSizeForGrid(8);
console.log(`Without Autoexpand (GRID=8): ${sizeWithoutAutoExpand} (Expected: 9)`);
assert.strictEqual(sizeWithoutAutoExpand, 9);

landscapeMeshMode = true;
let landscapeSize = maxRenderVisibleSizeForGrid(8);
console.log(`With landscape mesh active (GRID=8): ${landscapeSize} (Expected: 48)`);
assert.strictEqual(landscapeSize, 48);
landscapeMeshMode = false;

console.log('\nTesting pickFadeMaterial copies onBeforeCompile...');
const dummyShaderCallback = () => {};
const baseMat = {
  uuid: 'base-mat-uuid',
  opacity: 1.0,
  clone: function() {
    return { uuid: 'cloned-mat-uuid', opacity: this.opacity };
  },
  onBeforeCompile: dummyShaderCallback
};

const fadedMat = pickFadeMaterial(baseMat, false, 0.5);
assert.strictEqual(fadedMat.onBeforeCompile, dummyShaderCallback, 'onBeforeCompile was not copied in pickFadeMaterial');
console.log('pickFadeMaterial passed: onBeforeCompile copied successfully.');

console.log('\nTesting customMaterial copies onBeforeCompile...');
const baseMatForCustom = {
  uuid: 'custom-mat-uuid',
  clone: function() {
    return { uuid: 'custom-cloned-uuid', color: { set: (c) => {} } };
  },
  onBeforeCompile: dummyShaderCallback
};

const customMat = customMaterial(baseMatForCustom, '#ff0000');
assert.strictEqual(customMat.onBeforeCompile, dummyShaderCallback, 'onBeforeCompile was not copied in customMaterial');
console.log('customMaterial passed: onBeforeCompile copied successfully.');

console.log('\nAll unit tests passed successfully!');
