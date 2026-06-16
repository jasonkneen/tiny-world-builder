import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeHandle,
  isValidTwitter,
  isValidGithub,
  avatarUrlForKey,
  avatarKeyForUrl,
  AVATAR_KEYS,
  normalizeForSafety,
  checkTextSafety,
  capabilitiesFor,
} from '../netlify/functions/community.mjs';

// -------- social handles --------
test('normalizeHandle strips @, URLs, and query strings', () => {
  assert.equal(normalizeHandle('@jasonkneen'), 'jasonkneen');
  assert.equal(normalizeHandle('https://twitter.com/jasonkneen'), 'jasonkneen');
  assert.equal(normalizeHandle('https://x.com/jasonkneen?s=20'), 'jasonkneen');
  assert.equal(normalizeHandle('github.com/jasonkneen'), 'jasonkneen');
  assert.equal(normalizeHandle('  @Bob_99 '), 'Bob_99');
  assert.equal(normalizeHandle(''), '');
});

test('twitter validity follows X rules (<=15, word chars)', () => {
  assert.ok(isValidTwitter('jasonkneen'));
  assert.ok(isValidTwitter('a_b_123'));
  assert.ok(!isValidTwitter('waytoolonghandle12'));
  assert.ok(!isValidTwitter('has-dash'));
  assert.ok(!isValidTwitter(''));
});

test('github validity allows single non-edge hyphens', () => {
  assert.ok(isValidGithub('jason-kneen'));
  assert.ok(isValidGithub('jasonkneen'));
  assert.ok(!isValidGithub('-bad'));
  assert.ok(!isValidGithub('bad-'));
  assert.ok(!isValidGithub('a--b'));
});

// -------- preset avatars (allowlist) --------
test('avatar keys map to same-origin preset PNGs only', () => {
  for (const k of AVATAR_KEYS) {
    assert.equal(avatarUrlForKey(k), '/assets/avatars/' + k + '.png');
  }
  assert.equal(avatarUrlForKey('evil'), '');
  assert.equal(avatarUrlForKey('http://x/y.png'), '');
  assert.equal(avatarKeyForUrl('/assets/avatars/fox.png'), 'fox');
  assert.equal(avatarKeyForUrl('https://evil.example/x.png'), '');
});

// -------- content safety --------
test('safety filter allows innocent words containing banned substrings', () => {
  const innocent = [
    'Essex builder', 'Middlesex', 'analysis ninja', 'Title Master',
    'document guy', 'cpu wizard', 'Scunthorpe', 'grape farmer',
    'assassin', 'Dickson', 'classic', 'Saturn',
  ];
  for (const t of innocent) {
    assert.equal(checkTextSafety(t, 'name').ok, true, 'should allow: ' + t);
  }
});

test('safety filter blocks sexual / abusive / hateful content (incl. leet + spacing)', () => {
  const bad = [
    'porn star', 'p0rn', 'p o r n', 'xxx', 'sex', 's3x', 'f u c k you',
    'fuckyou', 'nigger', 'child porn', 'onlyfans link', 'rapist',
    'nudes here', 'naked pics', 'dildo',
  ];
  for (const t of bad) {
    assert.equal(checkTextSafety(t, 'name').ok, false, 'should block: ' + t);
  }
});

test('normalizeForSafety collapses leet + punctuation to a-z', () => {
  assert.equal(normalizeForSafety('p0.r n'), 'porn');
  assert.equal(normalizeForSafety('S3X!'), 'sex');
});

test('clean profile text passes', () => {
  assert.equal(checkTextSafety('Friendly world builder from Essex', 'bio').ok, true);
  assert.equal(checkTextSafety('', 'bio').ok, true);
});

// -------- community role capabilities --------
test('moderator role can moderate messages without becoming full admin', () => {
  const caps = capabilitiesFor(['moderator']);
  assert.equal(caps.canModerate, true);
  assert.equal(caps.canCreateChannels, true);
  assert.equal(caps.canManageRoles, false);
  assert.equal(caps.isAdmin, false);
});

test('super-admin capabilities imply moderation and role management', () => {
  const caps = capabilitiesFor([], true);
  assert.equal(caps.isAdmin, true);
  assert.equal(caps.canModerate, true);
  assert.equal(caps.canCreateChannels, true);
  assert.equal(caps.canManageRoles, true);
});
