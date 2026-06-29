import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bootJs = readFileSync(new URL('../engine/world/30-ui-boot-wiring.js', import.meta.url), 'utf8');
const gateJs = readFileSync(new URL('../scripts/tinyverse-auth-gate.js', import.meta.url), 'utf8');

test('cloud API calls surface 401 responses through the shared auth prompt', () => {
  assert.match(bootJs, /if \(r\.status === 401\) \{/);
  assert.match(bootJs, /out\.authRequired = true/);
  assert.match(bootJs, /twCloudPromptAuthRequired/);
  assert.match(bootJs, /window\.__tinyworldHandleUnauthorized = \(message\) => \{/);
});

test('tinyverse auth gate exports a shared unauthorized handler', () => {
  assert.match(gateJs, /window\.__tinyworldHandleUnauthorized = handleUnauthorized/);
  assert.match(gateJs, /if \(result\.reason === 'login'\) \{/);
  assert.match(gateJs, /promptLogin\('Sign in to open Tinyverse packs'\)/);
});