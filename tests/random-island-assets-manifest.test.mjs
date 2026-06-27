import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const generatorPath = path.resolve('engine/world/26-ai-generation.js');
const manifestPath = path.resolve('docs/random-island-generation-assets.md');

function sliceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, 'missing start marker: ' + start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, 'missing end marker: ' + end);
  return source.slice(startIndex, endIndex);
}

function currentAssetDigest(source) {
  const parts = [
    sliceBetween(source, '    const terrainIds = ', '    function chooseArchetypeKey() {'),
    sliceBetween(source, '    function objectContributesToResource', '    function economyResourceCount'),
    sliceBetween(source, '    function mapLabObject', '    function terrainFloorsFor'),
  ];
  return createHash('sha256').update(parts.join('\n---\n')).digest('hex').slice(0, 16);
}

test('random island asset manifest is versioned against generator asset source', () => {
  const source = readFileSync(generatorPath, 'utf8');
  const manifest = readFileSync(manifestPath, 'utf8');
  const digest = currentAssetDigest(source);

  assert.match(manifest, /Manifest version: `\d{4}-\d{2}-\d{2}\.\d+`/);
  assert.ok(
    manifest.includes('Canonical path: `docs/random-island-generation-assets.md`'),
    'random island asset manifest must name its canonical repo path'
  );
  assert.ok(
    manifest.includes('Source digest: `sha256-' + digest + '`'),
    'update docs/random-island-generation-assets.md when generator assets, weights, resource buckets, or mapping change'
  );
  assert.ok(
    manifest.includes('## Economy System Alignment'),
    'canonical asset manifest must compare preview stats to live economy resources'
  );
});
