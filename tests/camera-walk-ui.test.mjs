import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../tiny-world-builder.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/tiny-world.css', import.meta.url), 'utf8');
const inputJs = readFileSync(new URL('../engine/world/20-input-place-erase.js', import.meta.url), 'utf8');
const bootJs = readFileSync(new URL('../engine/world/30-ui-boot-wiring.js', import.meta.url), 'utf8');
const cameraJs = readFileSync(new URL('../engine/world/02-cameras-lighting.js', import.meta.url), 'utf8');

test('camera picker hides top-down and isometric, and runtime normalizes those legacy modes', () => {
  assert.match(html, /data-view="topdown" role="menuitem" hidden aria-hidden="true" tabindex="-1"/);
  assert.match(html, /data-view="ortho" role="menuitem" hidden aria-hidden="true" tabindex="-1"/);
  assert.match(css, /\.view-option\[hidden\] \{ display: none !important; \}/);
  assert.match(bootJs, /if \(opt\.hidden\) \{[\s\S]*opt\.classList\.remove\('active'\)/);
  assert.match(inputJs, /if \(effective === 'ortho' \|\| effective === 'topdown'\) effective = 'perspective'/);
  assert.match(cameraJs, /_storedCamera && _storedCamera\.mode === 'perspective'/);
});

test('first-person pointer lock releases for toolbar clicks without leaving walk mode', () => {
  assert.match(inputJs, /function requestFPPointerLock\(\)/);
  assert.match(inputJs, /document\.exitPointerLock/);
  assert.match(inputJs, /document\.body\.classList\.add\('fp-pointer-unlocked'\)/);
  assert.match(inputJs, /renderer\.domElement\.addEventListener\('click'[\s\S]*requestFPPointerLock\(\)/);
  assert.doesNotMatch(inputJs, /setCameraMode\('ortho'\)/);
});

test('home walk modes use solid-by-default collision while allowing paths and low cover', () => {
  assert.match(inputJs, /const FP_STANDABLE_OBJECT_KINDS = new Set\(\[/);
  assert.match(inputJs, /'stargate', 'bridge', 'bush', 'flower', 'tuft'/);
  assert.match(inputJs, /function fpCellWalkableAt\(worldX, worldZ\)/);
  assert.match(inputJs, /if \(terrain === 'lava'\) return false/);
  assert.match(inputJs, /if \(!fpStandableKind\(cell && cell\.kind\)\) return false/);
  assert.match(inputJs, /function fpWalkableAt\(worldX, worldZ\)/);
  assert.match(inputJs, /if \(fpWalkableAt\(nextX, fp\.pos\.z\)\) fp\.pos\.x = nextX/);
  assert.doesNotMatch(inputJs, /you can walk through props/);
});
