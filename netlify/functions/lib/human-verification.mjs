import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

// -------- human-safe anti-AI questionnaire --------
// New community members must clear a short, human-trivial challenge before they
// can post, DM, join, or create rooms. The questions are deliberately easy for a
// person and awkward for an automated sign-up bot: common-sense / perception /
// tiny-instruction questions graded with fuzzy matching, plus a hidden honeypot
// field and a response-time window. Everything here is PURE and unit-testable —
// the only stateful pieces are the HMAC sign/verify of the challenge token (so
// grading is stateless, no extra DB round-trips) mirroring the wallet challenge.

// Tunables (exported so tests and the handler agree on one source of truth).
export const VERIFY_QUESTION_COUNT = 3;       // questions shown per challenge
export const VERIFY_MIN_ELAPSED_MS = 2500;    // faster than this => almost certainly a script
export const VERIFY_MAX_ELAPSED_MS = 15 * 60 * 1000; // stale challenge / walked away
export const VERIFY_CHALLENGE_TTL_SECONDS = 20 * 60;
export const VERIFY_MAX_ANSWER_LEN = 120;

const TOKEN_PREFIX = 'tw-human-v1';
// The hidden honeypot input the real form keeps empty + offscreen. Bots that
// blindly fill every field will populate it and fail.
export const HONEYPOT_FIELD = 'middle_initial';

// Each question: id, prompt (shown to the human), and accept() — a pure matcher
// over the normalized answer. Keep prompts short, unambiguous, language-simple,
// and answerable by any human in a couple of seconds. Avoid trivia/knowledge.
export const QUESTION_POOL = [
  { id: 'feathers', prompt: 'Which weighs more: one kilogram of feathers, or one kilogram of bricks?',
    accept: a => /\b(same|equal|neither|identical|both)\b/.test(a) || a === 'they weigh the same' },
  { id: 'dog_legs', prompt: 'How many legs does a normal dog have? (use a number)',
    accept: a => a === '4' || a === 'four' },
  { id: 'sky_color', prompt: 'On a clear day, what colour is the sky?',
    accept: a => /\bblue\b/.test(a) },
  { id: 'water_wet', prompt: 'Is water wet or dry? (one word)',
    accept: a => a === 'wet' },
  { id: 'after_nine', prompt: 'What number comes right after nine?',
    accept: a => a === '10' || a === 'ten' },
  { id: 'spell_world_back', prompt: "Spell the word 'world' backwards.",
    accept: a => a.replace(/[^a-z]/g, '') === 'dlrow' },
  { id: 'third_word', prompt: 'Type the third word of this sentence: "Builders make tiny worlds."',
    accept: a => a.replace(/[^a-z]/g, '') === 'tiny' },
  { id: 'colder', prompt: 'Which is colder: ice, or fire?',
    accept: a => /\bice\b/.test(a) },
  { id: 'tomorrow', prompt: 'If today is Monday, what day is it tomorrow?',
    accept: a => /\btuesday\b/.test(a) },
  { id: 'sun_time', prompt: 'Does the sun come up in the morning or at night? (one word)',
    accept: a => /\bmorning\b/.test(a) },
  { id: 'count_fingers', prompt: 'How many fingers are on one normal human hand? (use a number)',
    accept: a => a === '5' || a === 'five' },
  { id: 'opposite_up', prompt: "What is the opposite of 'up'? (one word)",
    accept: a => a === 'down' },
  { id: 'fish_live', prompt: 'Do fish live in water or in trees? (one word)',
    accept: a => /\bwater\b/.test(a) },
  { id: 'two_plus_two', prompt: 'What is two plus two?',
    accept: a => a === '4' || a === 'four' },
];

const QUESTION_BY_ID = new Map(QUESTION_POOL.map(q => [q.id, q]));

export function questionById(id) {
  return QUESTION_BY_ID.get(String(id || '')) || null;
}

// Normalize a free-text answer for fuzzy matching: lowercase, strip surrounding
// punctuation/quotes, collapse whitespace, drop a leading polite "the/a/an" or
// "it is / the answer is" so verbose humans (and chatty AIs that DO answer
// correctly) still pass on the common-sense ones.
export function normalizeAnswer(value) {
  let s = String(value == null ? '' : value).slice(0, VERIFY_MAX_ANSWER_LEN).toLowerCase().trim();
  s = s.replace(/^["'`\s]+|["'`.!?\s]+$/g, '');
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/^(the answer is|answer:|it is|it's|i think|that('s| is)|the)\s+/i, '').trim();
  return s;
}

// True when a single answer satisfies its question.
export function checkAnswer(questionId, rawAnswer) {
  const q = questionById(questionId);
  if (!q) return false;
  return !!q.accept(normalizeAnswer(rawAnswer));
}

// Deterministically pick `count` distinct question ids from a numeric/string
// seed (so a test can assert selection and the same nonce reproduces the set).
export function pickQuestionIds(seed, count = VERIFY_QUESTION_COUNT) {
  const ids = QUESTION_POOL.map(q => q.id);
  // Simple seeded Fisher–Yates using a tiny LCG over a hashed seed.
  let h = 2166136261 >>> 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const rng = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = ids[i]; ids[i] = ids[j]; ids[j] = t;
  }
  return ids.slice(0, Math.max(1, Math.min(count, ids.length)));
}

// Pure timing gate: response must land inside the human window.
export function isHumanTiming(elapsedMs, now = VERIFY_MIN_ELAPSED_MS) {
  const ms = Number(elapsedMs);
  if (!Number.isFinite(ms) || ms < 0) return false;
  return ms >= VERIFY_MIN_ELAPSED_MS && ms <= VERIFY_MAX_ELAPSED_MS;
}

// Pure grader. Given the question ids, a map/obj of answers keyed by id, the
// honeypot value, and the elapsed time, decide pass/fail and report why. No I/O,
// no clock — everything needed is passed in.
export function gradeChallenge({ questionIds, answers, honeypot, elapsedMs }) {
  const failures = [];
  if (String(honeypot == null ? '' : honeypot).trim() !== '') failures.push('honeypot');
  if (!isHumanTiming(elapsedMs)) failures.push('timing');
  const ids = Array.isArray(questionIds) ? questionIds : [];
  if (!ids.length) failures.push('no-questions');
  let correct = 0;
  for (const id of ids) {
    const a = answers && (answers[id] != null ? answers[id] : answers['' + id]);
    if (checkAnswer(id, a)) correct++;
    else failures.push('answer:' + id);
  }
  // Require every question correct — they are individually trivial for a human.
  const passed = ids.length > 0 && correct === ids.length && !failures.includes('honeypot') && !failures.includes('timing');
  return { passed, correct, total: ids.length, failures };
}

// -------- stateless signed challenge token (HMAC, mirrors wallet auth) --------
function envValue(name) {
  try {
    if (globalThis.Netlify && Netlify.env && typeof Netlify.env.get === 'function') {
      const value = Netlify.env.get(name);
      if (value) return value;
    }
  } catch (_) {}
  return process.env[name] || '';
}

function verifySecret() {
  // Functional out-of-the-box: prefer a configured secret, fall back to the
  // shared auth secret, then a fixed dev constant so local sessions still work.
  return envValue('TINYWORLD_HUMAN_VERIFY_SECRET')
    || envValue('TINYWORLD_AUTH_SECRET')
    || envValue('TINYWORLD_WALLET_SESSION_SECRET')
    || 'tinyworld-human-verify-dev-secret';
}

function b64urlJson(v) { return Buffer.from(JSON.stringify(v), 'utf8').toString('base64url'); }
function fromB64urlJson(v) {
  try { return JSON.parse(Buffer.from(String(v || ''), 'base64url').toString('utf8')); }
  catch (_) { return null; }
}
function sign(part) { return createHmac('sha256', verifySecret()).update(part).digest('base64url'); }
function ctEqual(a, b) {
  const l = Buffer.from(String(a || ''), 'utf8');
  const r = Buffer.from(String(b || ''), 'utf8');
  return l.length === r.length && timingSafeEqual(l, r);
}

// Issue a fresh challenge: pick questions, bind them + the profile into a signed,
// expiring token. Returns the token plus the public prompts to render.
export function issueChallenge(profileId, count = VERIFY_QUESTION_COUNT) {
  const nonce = randomBytes(9).toString('base64url');
  const questionIds = pickQuestionIds(profileId + ':' + nonce, count);
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    typ: 'tinyworld-human-challenge',
    sub: Number(profileId) || 0,
    q: questionIds,
    nonce,
    iat: now,
    exp: now + VERIFY_CHALLENGE_TTL_SECONDS,
  };
  const encoded = b64urlJson(payload);
  const token = [TOKEN_PREFIX, encoded, sign(encoded)].join('.');
  return {
    token,
    honeypotField: HONEYPOT_FIELD,
    minElapsedMs: VERIFY_MIN_ELAPSED_MS,
    questions: questionIds.map(id => {
      const q = questionById(id);
      return { id, prompt: q ? q.prompt : '' };
    }),
  };
}

// Verify a challenge token belongs to this profile and is unexpired; returns the
// payload (with the bound question ids) or null.
export function readChallengeToken(token, profileId) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;
  if (!ctEqual(parts[2], sign(parts[1]))) return null;
  const payload = fromB64urlJson(parts[1]);
  if (!payload || payload.typ !== 'tinyworld-human-challenge') return null;
  if (Number(payload.sub) !== (Number(profileId) || 0)) return null;
  const exp = Number(payload.exp) || 0;
  if (!exp || exp < Math.floor(Date.now() / 1000)) return null;
  if (!Array.isArray(payload.q) || !payload.q.length) return null;
  return payload;
}

// Full server-side grade of a submitted challenge: validates the token then
// grades the answers. Returns { passed, reason?, correct, total }.
export function verifySubmission({ token, profileId, answers, honeypot, elapsedMs }) {
  const payload = readChallengeToken(token, profileId);
  if (!payload) return { passed: false, reason: 'expired', correct: 0, total: 0 };
  const result = gradeChallenge({ questionIds: payload.q, answers, honeypot, elapsedMs });
  return { passed: result.passed, reason: result.passed ? null : result.failures.join(','), correct: result.correct, total: result.total };
}
