import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bootJs = readFileSync(new URL('../engine/world/30-ui-boot-wiring.js', import.meta.url), 'utf8');
const multiplayerJs = readFileSync(new URL('../engine/world/38-multiplayer-partykit.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../tiny-world-builder.html', import.meta.url), 'utf8');
const i18nEn = readFileSync(new URL('../engine/i18n/en.js', import.meta.url), 'utf8');

test('time of day is live UK/BST instead of saved local preference', () => {
  assert.match(bootJs, /const UK_TIME_ZONE = 'Europe\/London'/);
  assert.match(bootJs, /function ukClockParts\(now\) \{[\s\S]*timeZone: UK_TIME_ZONE/);
  assert.match(bootJs, /function ukTodMinutes\(now\) \{/);
  assert.match(bootJs, /let todMinutes = ukTodMinutes\(\)/);
  assert.match(bootJs, /setInterval\(syncTodToUkTime, TOD_UK_SYNC_INTERVAL_MS\)/);
  assert.match(bootJs, /readout\.textContent = formatTime\(todMinutes\) \+ ' BST'/);
  assert.match(bootJs, /range\.disabled = true/);
  assert.doesNotMatch(bootJs, /tinyworld:tod\.v1/);
  assert.doesNotMatch(bootJs, /localStorage\.(?:getItem|setItem)\(TOD_LS/);
  assert.match(html, /Time of day \(BST\)/);
  assert.match(i18nEn, /'time\.timeOfDay': 'Time of day \(BST\)'/);
});

test('multiplayer environment does not overwrite UK/BST time of day', () => {
  assert.match(multiplayerJs, /new clients ignore host time and follow live UK\/BST time/);
  assert.doesNotMatch(multiplayerJs, /setRange\('time-range'/);
  assert.doesNotMatch(multiplayerJs, /const timeRange = document\.getElementById\('time-range'\)/);

  const envKeyMatch = multiplayerJs.match(/function envKey\(env\) \{([\s\S]*?)\n    \}/);
  assert.ok(envKeyMatch, 'envKey function exists');
  assert.doesNotMatch(envKeyMatch[1], /timeOfDay/);
});
