import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VERIFY_QUESTION_COUNT,
  VERIFY_MIN_ELAPSED_MS,
  VERIFY_MAX_ELAPSED_MS,
  HONEYPOT_FIELD,
  QUESTION_POOL,
  questionById,
  normalizeAnswer,
  checkAnswer,
  pickQuestionIds,
  isHumanTiming,
  gradeChallenge,
  issueChallenge,
  readChallengeToken,
  verifySubmission,
} from '../netlify/functions/lib/human-verification.mjs';

process.env.TINYWORLD_HUMAN_VERIFY_SECRET = 'human-verify-test-secret';

// Build a correct answer for a question id (each pool entry has one obvious one).
const CANONICAL = {
  feathers: 'the same', dog_legs: '4', sky_color: 'blue', water_wet: 'wet',
  after_nine: '10', spell_world_back: 'dlrow', third_word: 'tiny', colder: 'ice',
  tomorrow: 'tuesday', sun_time: 'morning', count_fingers: '5', opposite_up: 'down',
  fish_live: 'water', two_plus_two: '4',
};

test('every pool question has a working canonical answer', () => {
  for (const q of QUESTION_POOL) {
    assert.ok(CANONICAL[q.id] != null, 'missing canonical for ' + q.id);
    assert.equal(checkAnswer(q.id, CANONICAL[q.id]), true, 'canonical failed for ' + q.id);
  }
});

test('normalizeAnswer strips politeness and punctuation', () => {
  assert.equal(normalizeAnswer('  The answer is BLUE.  '), 'blue');
  assert.equal(normalizeAnswer('"Down!"'), 'down');
  assert.equal(normalizeAnswer("It's four"), 'four');
});

test('common-sense answers accept verbose human phrasing', () => {
  assert.equal(checkAnswer('feathers', 'they weigh the same'), true);
  assert.equal(checkAnswer('dog_legs', 'four'), true);
  assert.equal(checkAnswer('sky_color', 'light blue'), true);
  assert.equal(checkAnswer('two_plus_two', 'four'), true);
});

test('wrong answers are rejected', () => {
  assert.equal(checkAnswer('dog_legs', '3'), false);
  assert.equal(checkAnswer('sky_color', 'green'), false);
  assert.equal(checkAnswer('water_wet', 'dry'), false);
  assert.equal(checkAnswer('unknown_id', 'anything'), false);
});

test('pickQuestionIds is deterministic per seed and returns distinct ids', () => {
  const a = pickQuestionIds('seed-123', VERIFY_QUESTION_COUNT);
  const b = pickQuestionIds('seed-123', VERIFY_QUESTION_COUNT);
  assert.deepEqual(a, b);
  assert.equal(a.length, VERIFY_QUESTION_COUNT);
  assert.equal(new Set(a).size, a.length);
  for (const id of a) assert.ok(questionById(id), 'pool has ' + id);
  // Different seed should (very likely) differ.
  assert.notDeepEqual(a, pickQuestionIds('seed-999', VERIFY_QUESTION_COUNT));
});

test('timing window rejects too-fast and too-slow responses', () => {
  assert.equal(isHumanTiming(VERIFY_MIN_ELAPSED_MS - 1), false);
  assert.equal(isHumanTiming(VERIFY_MIN_ELAPSED_MS), true);
  assert.equal(isHumanTiming(VERIFY_MAX_ELAPSED_MS), true);
  assert.equal(isHumanTiming(VERIFY_MAX_ELAPSED_MS + 1), false);
  assert.equal(isHumanTiming(-5), false);
  assert.equal(isHumanTiming('not-a-number'), false);
});

function answersFor(ids) {
  const out = {};
  for (const id of ids) out[id] = CANONICAL[id];
  return out;
}

test('gradeChallenge passes a clean human submission', () => {
  const ids = pickQuestionIds('grade-pass');
  const r = gradeChallenge({ questionIds: ids, answers: answersFor(ids), honeypot: '', elapsedMs: 5000 });
  assert.equal(r.passed, true);
  assert.equal(r.correct, ids.length);
});

test('gradeChallenge fails when honeypot is filled', () => {
  const ids = pickQuestionIds('grade-honeypot');
  const r = gradeChallenge({ questionIds: ids, answers: answersFor(ids), honeypot: 'bot-was-here', elapsedMs: 5000 });
  assert.equal(r.passed, false);
  assert.ok(r.failures.includes('honeypot'));
});

test('gradeChallenge fails on bot-fast timing even with right answers', () => {
  const ids = pickQuestionIds('grade-fast');
  const r = gradeChallenge({ questionIds: ids, answers: answersFor(ids), honeypot: '', elapsedMs: 100 });
  assert.equal(r.passed, false);
  assert.ok(r.failures.includes('timing'));
});

test('gradeChallenge fails when any answer is wrong', () => {
  const ids = pickQuestionIds('grade-wrong');
  const answers = answersFor(ids);
  answers[ids[0]] = 'definitely wrong nonsense';
  const r = gradeChallenge({ questionIds: ids, answers, honeypot: '', elapsedMs: 5000 });
  assert.equal(r.passed, false);
  assert.ok(r.failures.some(f => f.startsWith('answer:')));
});

test('issueChallenge produces a verifiable token bound to the profile', () => {
  const challenge = issueChallenge(42);
  assert.equal(challenge.questions.length, VERIFY_QUESTION_COUNT);
  assert.equal(challenge.honeypotField, HONEYPOT_FIELD);
  const payload = readChallengeToken(challenge.token, 42);
  assert.ok(payload);
  assert.deepEqual(payload.q, challenge.questions.map(q => q.id));
  // Wrong profile id must not verify the token.
  assert.equal(readChallengeToken(challenge.token, 43), null);
  // Tampered token rejected.
  const bad = challenge.token.slice(0, -1) + (challenge.token.endsWith('a') ? 'b' : 'a');
  assert.equal(readChallengeToken(bad, 42), null);
});

test('verifySubmission end-to-end: correct human passes, bot fails', () => {
  const challenge = issueChallenge(7);
  const ids = challenge.questions.map(q => q.id);
  const good = verifySubmission({
    token: challenge.token, profileId: 7, answers: answersFor(ids), honeypot: '', elapsedMs: 6000,
  });
  assert.equal(good.passed, true);

  const fast = verifySubmission({
    token: challenge.token, profileId: 7, answers: answersFor(ids), honeypot: '', elapsedMs: 200,
  });
  assert.equal(fast.passed, false);

  const wrongProfile = verifySubmission({
    token: challenge.token, profileId: 999, answers: answersFor(ids), honeypot: '', elapsedMs: 6000,
  });
  assert.equal(wrongProfile.passed, false);
  assert.equal(wrongProfile.reason, 'expired');
});
