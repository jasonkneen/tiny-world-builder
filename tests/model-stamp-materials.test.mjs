// tests/model-stamp-materials.test.mjs
// Regression guards for imported-model material handling in
// engine/world/09-model-stamp-loader.js:
//   - FBX comes in white: MeshPhongMaterial must be re-lit for TinyWorld.
//   - OBJ/MTL with a missing map_Kd image must fall back to the Kd diffuse
//     colour instead of forcing solid white.
//   - VOXMesh is not clone-safe, so the loader must hand back plain meshes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildEngineFns } from './helpers/extract-fn.mjs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const VENDOR = join(__dirname, '..', 'vendor', 'three');
const LOADER = join(__dirname, '..', 'engine', 'world', '09-model-stamp-loader.js');

// three.r128.min.js is a UMD module; expose it as the global the loaders expect.
global.self = global;
global.THREE = require(join(VENDOR, 'three.r128.min.js'));
require(join(VENDOR, 'VOXLoader.r128.js'));

test('Phong materials are flagged for TinyWorld re-lighting (FBX white fix)', () => {
  const { modelStampMaterialNeedsTinyWorldLighting } = buildEngineFns(
    LOADER, ['modelStampMaterialNeedsTinyWorldLighting']
  );
  assert.equal(modelStampMaterialNeedsTinyWorldLighting(new THREE.MeshPhongMaterial()), true);
  assert.equal(modelStampMaterialNeedsTinyWorldLighting(new THREE.MeshStandardMaterial()), true);
  // Lambert/Basic already render correctly under TinyWorld lighting.
  assert.equal(modelStampMaterialNeedsTinyWorldLighting(new THREE.MeshLambertMaterial()), false);
  assert.equal(modelStampMaterialNeedsTinyWorldLighting(new THREE.MeshBasicMaterial()), false);
  // Already-converted materials are not re-converted.
  const lit = new THREE.MeshPhongMaterial();
  lit.userData.modelStampTinyWorldLit = true;
  assert.equal(modelStampMaterialNeedsTinyWorldLighting(lit), false);
});

test('MTL texture failure falls back to Kd diffuse instead of white', () => {
  // Simulate a missing image: the texture loader reports an error and yields no
  // texture, exactly as it would for an OBJ imported without its .jpg sidecars.
  const preamble = `
    const loadModelStampTexture = (asset, ref, opts) => {
      if (opts && typeof opts.onError === 'function') opts.onError(new Error('404'));
      return null;
    };
    const prepareModelStampTextureMaterial = () => {};
    const modelStampResolveUrl = (a, r) => r;
    const scheduleModelStampRefresh = () => {};
  `;
  const { parseModelStampMTL } = buildEngineFns(
    LOADER,
    ['uniqueModelStampRefs', 'extractModelStampMapPath', 'parseModelStampMTL'],
    preamble
  );
  const mtl = [
    'newmtl skin',
    'Kd 0.64 0.64 0.64',
    'map_Kd skin_diffuse.jpg',
  ].join('\n');
  const mats = parseModelStampMTL(mtl, { id: 'm' }, 'blob:mtl');
  const mat = mats.skin;
  assert.ok(mat, 'material parsed');
  assert.equal(mat.map, null, 'broken map dropped');
  // 0.64 -> 163 -> 0xa3a3a3, not 0xffffff.
  assert.equal(mat.color.getHexString(), 'a3a3a3');
  assert.match(mat.userData.modelStampHydrated, /texture missing/);
});

test('MTL with a plain Kd colour (no texture) keeps that colour', () => {
  const preamble = `
    const loadModelStampTexture = () => null;
    const prepareModelStampTextureMaterial = () => {};
    const modelStampResolveUrl = (a, r) => r;
    const scheduleModelStampRefresh = () => {};
  `;
  const { parseModelStampMTL } = buildEngineFns(
    LOADER,
    ['uniqueModelStampRefs', 'extractModelStampMapPath', 'parseModelStampMTL'],
    preamble
  );
  const mats = parseModelStampMTL('newmtl red\nKd 1 0 0\n', { id: 'm' }, 'blob:mtl');
  assert.equal(mats.red.color.getHexString(), 'ff0000');
  assert.equal(mats.red.userData.modelStampHydrated, 'mtl color');
});

test('dropped OBJ keeps its .mtl + texture sidecars (so it imports textured)', () => {
  // The browser-only URL.createObjectURL is stubbed; we only assert the file
  // categorisation that lets an OBJ resolve its map_Kd image.
  let n = 0;
  global.URL = { createObjectURL: () => 'blob:fake/' + (++n) };
  const preamble = `
    const MODEL_STAMP_DETECTED_FORMATS = new Set(['glb','gltf','obj','fbx','vox']);
    const MODEL_STAMP_TEXTURE_FORMATS = new Set(['png','jpg','jpeg','webp','gif']);
    const modelStampDroppedObjectUrls = new Map();
  `;
  const { modelStampBuildDroppedFileContext } = buildEngineFns(
    LOADER,
    ['modelStampFileExtension', 'modelStampFileBaseName', 'modelStampObjectUrlForFile', 'modelStampBuildDroppedFileContext'],
    preamble
  );
  const ctx = modelStampBuildDroppedFileContext([
    { name: 'Air_Balloon.obj', size: 10, lastModified: 1 },
    { name: 'Air_Balloon.mtl', size: 10, lastModified: 2 },
    { name: 'Air_Balloon.png', size: 10, lastModified: 3 },
  ]);
  assert.deepEqual(ctx.mains.map(m => m.format), ['obj']);
  assert.deepEqual(ctx.sidecars.mtl.map(m => m.name), ['Air_Balloon.mtl']);
  assert.deepEqual(ctx.sidecars.textures.map(t => t.name), ['Air_Balloon.png']);
  // map_Kd references resolve case-insensitively by basename.
  assert.ok(ctx.localFiles['air_balloon.png'], 'png available to the MTL by basename');
});

test('VDB voxel mesh: occupancy → coloured clone-safe cloud, empty → null', () => {
  const { buildVdbVoxelMesh } = buildEngineFns(LOADER, ['vdbGridSpec', 'buildVdbVoxelMesh']);
  // Empty volume (e.g. the simulation-start frame) yields no mesh.
  assert.equal(
    buildVdbVoxelMesh({ count: 0, coords: new Int32Array(), bbox: { min: [ 0, 0, 0 ], max: [ 0, 0, 0 ] } }),
    null
  );
  // A small solid block of active voxels.
  const coords = [];
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      for (let z = 0; z < 4; z++) coords.push(x, y, z);
    }
  }
  const parsed = { count: coords.length / 3, coords: new Int32Array( coords ), bbox: { min: [ 0, 0, 0 ], max: [ 2, 2, 3 ] } };
  const g = buildVdbVoxelMesh( parsed );
  assert.ok( g, 'mesh built' );
  const mesh = g.children[ 0 ];
  assert.ok( mesh.isMesh );
  assert.equal( mesh.material.vertexColors, true );
  assert.ok( mesh.geometry.attributes.position.count > 0, 'has geometry' );
  assert.equal(mesh.geometry.attributes.color.count, mesh.geometry.attributes.position.count, 'per-vertex colour');
  // Placing a stamp clones the cached scene — must not throw.
  assert.doesNotThrow( () => g.clone() );
});

test('VDB sequence: filenames group by frame number; frames share one grid', () => {
  const { vdbGridSpec, buildVdbVoxelMesh, vdbSequenceKey } = buildEngineFns(
    LOADER, ['vdbGridSpec', 'buildVdbVoxelMesh', 'vdbSequenceKey']
  );
  // Trailing frame number is stripped so a sequence collapses to one base key.
  assert.deepEqual(vdbSequenceKey('Frame_0.vdb'), { base: 'frame_', num: 0 });
  assert.deepEqual(vdbSequenceKey('smoke_012.vdb'), { base: 'smoke_', num: 12 });
  assert.deepEqual(vdbSequenceKey('puff3'), { base: 'puff', num: 3 });

  // Two frames with different bounding boxes share one union grid, so a given
  // voxel maps to the same local cell in every frame (the plume grows in place).
  const spec = vdbGridSpec([0, 0, 0], [9, 9, 9]);
  const f1 = { count: 1, coords: new Int32Array([0, 0, 0]), bbox: { min: [0, 0, 0], max: [0, 0, 0] } };
  const f2 = { count: 1, coords: new Int32Array([9, 9, 9]), bbox: { min: [9, 9, 9], max: [9, 9, 9] } };
  const m1 = buildVdbVoxelMesh(f1, spec);
  const m2 = buildVdbVoxelMesh(f2, spec);
  assert.ok(m1 && m2, 'both frames build a mesh');
  assert.doesNotThrow(() => { m1.clone(); m2.clone(); });
});

test('VOXMesh is not clone-safe; a plain Mesh wrapper clones cleanly', () => {
  // Minimal one-voxel .vox (version 150) coloured red via an RGBA palette.
  const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0, 0); return b; };
  const tag = s => Buffer.from(s, 'ascii');
  const size = Buffer.concat([tag('SIZE'), u32(12), u32(0), u32(1), u32(1), u32(1)]);
  const xyzi = Buffer.concat([tag('XYZI'), u32(4 + 4), u32(0), u32(1), Buffer.from([0, 0, 0, 1])]);
  const palette = Buffer.concat(Array.from({ length: 256 }, () => u32(0xff0000ff))); // ABGR red
  const rgba = Buffer.concat([tag('RGBA'), u32(palette.length), u32(0), palette]);
  const body = Buffer.concat([size, xyzi, rgba]);
  const main = Buffer.concat([tag('MAIN'), u32(0), u32(body.length)]);
  const vox = Buffer.concat([tag('VOX '), u32(150), main, body]);
  const ab = vox.buffer.slice(vox.byteOffset, vox.byteOffset + vox.byteLength);

  const chunks = new THREE.VOXLoader().parse(ab);
  assert.ok(chunks && chunks.length, 'vox parsed');
  const voxMesh = new THREE.VOXMesh(chunks[0]);

  // Cloning a VOXMesh directly throws, which is the original "VOX not working" bug.
  assert.throws(() => voxMesh.clone(), /data/);

  // The loader rewraps it in a plain Mesh, which clones without throwing and
  // keeps the per-voxel colour attribute.
  const plain = new THREE.Mesh(voxMesh.geometry, voxMesh.material);
  let clone;
  assert.doesNotThrow(() => { clone = plain.clone(); });
  assert.ok(clone.geometry.attributes.color, 'voxel colours preserved on clone');
  assert.equal(clone.material.vertexColors, true);
});
