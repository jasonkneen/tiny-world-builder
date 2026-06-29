// tests/appearance-surface.test.mjs
// Exercises the REAL normalizeAppearance from engine/world/04-textures.js for the
// inspector-v2 surface fields (emissive, opacity, finish, light): allowlist
// behaviour + clamping + enum guards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildEngineFns } from './helpers/extract-fn.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEXTURES = join(__dirname, '..', 'engine', 'world', '04-textures.js');
const RENDER_CORE = join(__dirname, '..', 'engine', 'world', '01-render-core.js');
const HISTORY_OBJECT_FACTORIES = join(__dirname, '..', 'engine', 'world', '06-history-object-factories.js');
const VOXEL_BUILD_FACTORIES = join(__dirname, '..', 'engine', 'world', '09b-voxel-build-factories.js');
const DEFAULTS = join(__dirname, '..', 'tinyworld-defaults.json');
const texturesJs = readFileSync(TEXTURES, 'utf8');
const renderCoreJs = readFileSync(RENDER_CORE, 'utf8');
const historyObjectFactoriesJs = readFileSync(HISTORY_OBJECT_FACTORIES, 'utf8');
const voxelBuildFactoriesJs = readFileSync(VOXEL_BUILD_FACTORIES, 'utf8');
const defaultsJson = JSON.parse(readFileSync(DEFAULTS, 'utf8'));

// materialTextureMap is a closure global used by normalizeMaterialTextureKey; an
// empty stub makes every key normalize to 'default', which is all we need here.
const { normalizeAppearance } = buildEngineFns(
  TEXTURES,
  ['normalizeHexColor', 'normalizeMaterialTextureKey', 'normalizeMaterialTextureScale', 'normalizeAppearance'],
  'const materialTextureMap = {};'
);

test('stone terrain and linked rock props default to supplied sheet crops', () => {
  assert.match(texturesJs, /stone:\s*\{\s*texture:\s*'terrain-sheet-stone-blocks-01',\s*scale:\s*2\.0,/);
  assert.match(texturesJs, /const SURFACE_LINKED_MODEL_MATERIAL_TEXTURES = \{\s*stone:\s*\{[\s\S]*rock:\s*'terrain-sheet-rock-cliff-01'[\s\S]*castleStone:\s*'terrain-sheet-stone-blocks-01'/);
});

test('material wear defaults to 100 percent for shipped and fresh settings', () => {
  assert.match(renderCoreJs, /const RENDER_SETTINGS_VERSION = '28'/);
  assert.match(renderCoreJs, /materialWear:\s*'1'/);
  assert.match(texturesJs, /let renderMaterialWear = storedNumber\(RENDER_LS\.materialWear,\s*1,\s*0,\s*1\)/);
  assert.equal(defaultsJson.settings['tinyworld:render:version'], '28');
  assert.equal(defaultsJson.settings['tinyworld:render:materialWear'], '1.00');
});

test('emissive + opacity round-trip and clamp', () => {
  const a = normalizeAppearance({ emissiveColor: '#ffcc88', emissiveIntensity: 5, opacity: -1 });
  assert.equal(a.emissiveColor, '#ffcc88');
  assert.equal(a.emissiveIntensity, 2);   // clamped to hi
  assert.equal(a.opacity, 0);             // clamped to lo
});

test('opacity of 1 and emissiveIntensity 0 are dropped (defaults)', () => {
  assert.equal(normalizeAppearance({ opacity: 1, emissiveIntensity: 0 }), null);
});

test('finish enum guard; matte is default-dropped', () => {
  assert.equal(normalizeAppearance({ finish: 'satin' }).finish, 'satin');
  assert.equal(normalizeAppearance({ finish: 'glow' }).finish, 'glow');
  assert.equal(normalizeAppearance({ finish: 'matte' }), null);
  assert.equal(normalizeAppearance({ finish: 'bogus' }), null);
});

test('fence style keeps garden and gate variants only', () => {
  assert.equal(normalizeAppearance({ fenceStyle: 'garden' }).fenceStyle, 'garden');
  assert.equal(normalizeAppearance({ fenceStyle: 'gate' }).fenceStyle, 'gate');
  assert.equal(normalizeAppearance({ fenceStyle: 'wire' }), null);
});

test('ore metal keeps the four generated ore variants only', () => {
  assert.equal(normalizeAppearance({ oreMetal: 'copper' }).oreMetal, 'copper');
  assert.equal(normalizeAppearance({ oreMetal: 'iron' }).oreMetal, 'iron');
  assert.equal(normalizeAppearance({ oreMetal: 'silver' }).oreMetal, 'silver');
  assert.equal(normalizeAppearance({ oreMetal: 'gold' }).oreMetal, 'gold');
  assert.equal(normalizeAppearance({ oreMetal: 'tin' }), null);
});

test('ore rocks keep stone bodies with small embedded metal cubes', () => {
  assert.match(historyObjectFactoriesJs, /const g = makeRock\(neighbors, level, seedX, seedZ, inWater, Object\.assign\(\{\}, opts, \{ appearance: null \}\)\);/);
  assert.match(voxelBuildFactoriesJs, /const g = makeVoxelRock\(neighbors, level, seedX, seedZ, inWater, Object\.assign\(\{\}, opts, \{ appearance: null \}\)\);/);
  assert.match(historyObjectFactoriesJs, /oreCube\(0\.14 \* grow/);
  assert.match(voxelBuildFactoriesJs, /oreBox\(0\.14,/);
  assert.doesNotMatch(historyObjectFactoriesJs, /oreCube\(0\.44/);
  assert.doesNotMatch(voxelBuildFactoriesJs, /oreBox\(0\.44/);
});

test('light normalizes type/color/intensity/range and clamps', () => {
  const a = normalizeAppearance({ light: { type: 'point', color: 'ffffff', intensity: 9, range: 99 } });
  assert.deepEqual(a.light, { type: 'point', color: '#ffffff', intensity: 4, range: 20 });
});

test('light defaults fill when omitted, invalid type drops whole spec', () => {
  const a = normalizeAppearance({ light: { type: 'spot' } });
  assert.deepEqual(a.light, { type: 'spot', color: '#ffd9a0', intensity: 1, range: 6 });
  assert.equal(normalizeAppearance({ light: { type: 'laser' } }), null);
});

test('unknown keys still dropped (allowlist intact)', () => {
  assert.equal(normalizeAppearance({ metalness: 0.5, roughness: 0.2 }), null);
});

test('parts: valid voxel-key override is kept + clamped', () => {
  const a = normalizeAppearance({ parts: { 'v:1,2,3': { ox: 0.5, oy: 99, sx: 0.05, sz: 2 } } });
  assert.deepEqual(a.parts['v:1,2,3'], { ox: 0.5, oy: 8, oz: 0, sx: 0.1, sy: 1, sz: 2 });
});

test('parts: rotations are kept only when non-default', () => {
  assert.deepEqual(
    normalizeAppearance({ parts: { head: { rx: 0.5, ry: 99, rz: -0.25 } } }).parts.head,
    { ox: 0, oy: 0, oz: 0, sx: 1, sy: 1, sz: 1, rx: 0.5, ry: +(Math.PI * 2).toFixed(3), rz: -0.25 }
  );
  assert.equal(normalizeAppearance({ parts: { head: { rx: 0, ry: 0, rz: 0 } } }), null);
});

test('parts: identity override is dropped, invalid keys rejected', () => {
  assert.equal(normalizeAppearance({ parts: { 'v:0,0,0': { ox: 0, sx: 1 } } }), null);
  assert.equal(normalizeAppearance({ parts: { 'bad key': { ox: 1 } } }), null);
  assert.equal(normalizeAppearance({ parts: { 'p:cable-1': { sx: 2 } } }).parts['p:cable-1'].sx, 2);
});

test('parts: house role keys (window:0, wall, door) are accepted', () => {
  const a = normalizeAppearance({ parts: { 'window:0': { oy: 0.5 }, 'wall': { sx: 1.2 }, 'door': { oz: 0.1 } } });
  assert.equal(a.parts['window:0'].oy, 0.5);
  assert.equal(a.parts['wall'].sx, 1.2);
  assert.equal(a.parts['door'].oz, 0.1);
  assert.equal(normalizeAppearance({ parts: { 'bad key': { ox: 1 } } }), null); // space still rejected
});

test('voxelsRemoved: dedups + filters malformed keys', () => {
  const a = normalizeAppearance({ voxelsRemoved: ['1,2,3', '1,2,3', 'nope', '4,5,6'] });
  assert.deepEqual(a.voxelsRemoved.sort(), ['1,2,3', '4,5,6']);
});

test('voxelsAdded: rounds coords, defaults+normalizes color, drops invalid', () => {
  const a = normalizeAppearance({ voxelsAdded: [{ x: 1.4, y: 2, z: -3, color: 'ff0000' }, { x: 'bad', y: 0, z: 0 }] });
  assert.equal(a.voxelsAdded.length, 1);
  assert.deepEqual(a.voxelsAdded[0], { x: 1, y: 2, z: -3, color: '#ff0000' });
});

test('window: keeps set keys, clamps, normalizes tint; empty/no-op drops', () => {
  const a = normalizeAppearance({ window: { glassRatio: 2, tint: 'ff8800', darkness: -1, brightness: 5, reflect: 0.3 } });
  assert.deepEqual(a.window, { glassRatio: 1, tint: '#ff8800', darkness: 0, brightness: 3, reflect: 0.3 });
  // only the keys the caller set are kept
  assert.deepEqual(normalizeAppearance({ window: { darkness: 0.5 } }).window, { darkness: 0.5 });
  // an empty / all-invalid window spec is dropped entirely
  assert.equal(normalizeAppearance({ window: {} }), null);
  assert.equal(normalizeAppearance({ window: { tint: 'not-a-color' } }), null);
});
