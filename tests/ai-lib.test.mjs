// tests/ai-lib.test.mjs
// AI1: pure parts of the paid-AI lib (kind allowlist, cost, message building). The
// network call + the charge/refund flow are integration-level (provider + EC1 coins).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_KINDS, isAiKind, aiCost, buildMessages } from '../netlify/functions/lib/ai.mjs';

test('only allowlisted kinds are accepted', () => {
  assert.equal(isAiKind('world-idea'), true);
  assert.equal(isAiKind('world-name'), true);
  assert.equal(isAiKind('build-tips'), true);
  assert.equal(isAiKind('rm -rf'), false);
  assert.equal(isAiKind(''), false);
  assert.equal(isAiKind(null), false);
  assert.equal(isAiKind('__proto__'), false); // not an own enumerable kind
});

test('cost is defined per kind and zero for unknown kinds', () => {
  assert.ok(aiCost('world-idea') > 0);
  assert.equal(aiCost('world-name'), AI_KINDS['world-name'].cost);
  assert.equal(aiCost('nope'), 0);
});

test('buildMessages includes the system prompt and a bounded user seed', () => {
  const msgs = buildMessages('world-idea', '  a spooky pirate cove  ');
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].role, 'system');
  assert.equal(msgs[0].content, AI_KINDS['world-idea'].system);
  assert.equal(msgs[1].role, 'user');
  assert.equal(msgs[1].content, 'a spooky pirate cove'); // trimmed/collapsed
});

test('empty seed becomes a surprise-me prompt; long seeds are truncated', () => {
  assert.match(buildMessages('world-name', '').at(-1).content, /surprise me/i);
  const long = 'x'.repeat(500);
  const user = buildMessages('build-tips', long).at(-1).content;
  assert.ok(user.length <= 280, `seed must be bounded, got ${user.length}`);
});
