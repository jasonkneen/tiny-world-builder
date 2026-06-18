// Offline regression tests for tools/lobby-bots.mjs protocol logic.
// Importing the module does NOT connect or boot (guarded by _isMain); it only
// exposes Bot + clean for testing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Bot, clean } from '../tools/lobby-bots.mjs';

const persona = { name: 'Marsh the Wanderer', color: '#6fae57', personality: 'test', avatar: { seed: 1 } };

test('clean() strips emoji / pictographic characters', () => {
  // Inputs use codepoint escapes (no literal emoji glyphs in source) — leaf/wave,
  // wave-hand + skin tone, regional-indicator flag, and a keycap sequence.
  assert.equal(clean('the reeds whisper \u{1F33F}\u{1F30A}'), 'the reeds whisper');
  assert.equal(clean('hello \u{1F44B}\u{1F3FD} friend'), 'hello friend');
  assert.equal(clean('flags \u{1F1EB}\u{1F1F7} and digits 1\u{FE0F}\u{20E3}'), 'flags and digits 1');
  assert.equal(clean('plain calm line'), 'plain calm line');
});

test('clean() trims wrapping quotes/whitespace and collapses spaces', () => {
  assert.equal(clean('  "a   quiet  tide"  '), 'a quiet tide');
});

test('bot learns its own id from the welcome message', () => {
  const b = new Bot(persona, 0);
  assert.equal(b.id, null);
  b.onMsg({ type: 'welcome', room: 'world-tidewater-bay', id: b.pk, role: 'observe', world: true });
  assert.equal(b.id, b.pk);
});

test('bot ignores its OWN echoed chat (no self-reaction / feedback loop)', () => {
  const b = new Bot(persona, 0);
  let reacted = 0;
  b.onChat = () => { reacted++; };          // spy
  b.onMsg({ type: 'welcome', id: b.pk });   // learn own id first
  // server echoes our own chat back (broadcastToAdmitted includes the sender):
  b.onMsg({ type: 'chat', id: b.pk, name: 'Marsh the Wanderer', text: 'the reeds whisper today' });
  assert.equal(reacted, 0, 'must not react to its own chat');
  // a real peer chat still triggers a reaction:
  b.onMsg({ type: 'chat', id: 'peer-xyz', name: 'Visitor', text: 'hello there' });
  assert.equal(reacted, 1, 'must react to another speaker');
});

test('a chat carrying no id is ignored (cannot be matched/abused)', () => {
  const b = new Bot(persona, 0);
  let reacted = 0;
  b.onChat = () => { reacted++; };
  b.onMsg({ type: 'welcome', id: b.pk });
  b.onMsg({ type: 'chat', text: 'no id here' });
  assert.equal(reacted, 0);
});
