import { randomBytes } from 'node:crypto';
import { requireAuthUser } from './lib/auth.mjs';
import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse, readJson, sameOriginWriteGuard } from './lib/http.mjs';
import { ensureProfile, profileDto } from './lib/profiles.mjs';
import { emitCommunityEvent, screenMessage, suspendMember, activeSuspension, ensureSuspensionTable, unsuspendMember, deleteMessage, hideMessage, unhideMessage, SUSPENSION_HOURS, POLICY_NOTICE } from './lib/community-moderation.mjs';
import { issueChallenge, verifySubmission, HONEYPOT_FIELD } from './lib/human-verification.mjs';

export const config = { path: '/api/community' };

// -------- tunables --------
const MESSAGE_MAX_LENGTH = 2000;
const RATE_LIMIT_MAX = 5;            // max messages...
const RATE_LIMIT_WINDOW_SECONDS = 10; // ...per rolling window
const INVITE_CODE_BYTES = 9;
// Community super-owner: this account is made an owner of every room (existing
// and future). Overridable via env without a code change. Matched against a
// profile's username or display_name (case-insensitive).
const SUPER_OWNER_USERNAME = (process.env.TINYWORLD_COMMUNITY_OWNER || 'jasonkneen').toLowerCase();
// Community staff: usernames with global management permission (create/delete
// any room, ban globally). Always includes the super-owner. Extra staff can be
// added via a comma-separated TINYWORLD_COMMUNITY_STAFF env var.
const STAFF_USERNAMES = new Set(
  [SUPER_OWNER_USERNAME]
    .concat(String(process.env.TINYWORLD_COMMUNITY_STAFF || '').split(','))
    .map(s => s.trim().toLowerCase())
    .filter(Boolean),
);
const DEFAULT_ROOMS = [
  { slug: 'lobby',    name: 'lobby',    topic: 'Live with the in-game lobby — chat here or in the game, it is the same room.' },
  { slug: 'general',  name: 'general',  topic: 'Open chat for the whole tinyverse community.' },
  { slug: 'builders', name: 'builders', topic: 'Share builds, techniques, and works in progress.' },
  { slug: 'help',     name: 'help',     topic: 'Ask questions and help other builders out.' },
];
// The bridged room slug: messages in this community room and the in-game lobby
// chat are relayed to each other (see engine/world/64-lobby-chat-bridge.js).
const LOBBY_ROOM_SLUG = 'lobby';

const COMMUNITY_RELATIONS = [
  'community_rooms',
  'community_memberships',
  'community_messages',
  'community_bans',
  'community_blocks',
  'community_invites',
  'community_verifications',
  'community_roles',
  'community_suspensions',
  'community_reports',
];

function isMissingCommunitySchema(err) {
  return isMissingRelations(err, COMMUNITY_RELATIONS);
}

// -------- pure helpers (unit-testable, no DB) --------
function cleanText(value, limit) {
  return String(value == null ? '' : value).trim().slice(0, limit);
}

function cleanProfileId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Canonical DM key for an unordered pair of profile ids: "min-max".
export function dmKey(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x <= 0 || y <= 0 || x === y) return null;
  return Math.min(x, y) + '-' + Math.max(x, y);
}

// The other participant id encoded in a dm key, from the caller's perspective.
export function dmOtherId(key, selfId) {
  const parts = String(key || '').split('-').map(Number);
  if (parts.length !== 2) return null;
  const other = parts[0] === Number(selfId) ? parts[1] : parts[0];
  return Number.isInteger(other) && other > 0 ? other : null;
}

// Returns the SQL window start instant (ms epoch) for rate limiting. Pure math
// so it can be asserted in a smoke test without touching the clock indirectly.
export function rateWindowStart(nowMs, windowSeconds) {
  return Number(nowMs) - Number(windowSeconds) * 1000;
}

// True when `count` messages already exist inside the window and another would
// exceed the cap.
export function isRateLimited(countInWindow, max) {
  return Number(countInWindow) >= Number(max);
}

// Translate a requested ban duration (hours) into an absolute expiry Date, or
// null for a permanent ban. 0 / negative / non-finite => permanent.
export function banExpiry(nowMs, durationHours) {
  const h = Number(durationHours);
  if (!Number.isFinite(h) || h <= 0) return null;
  return new Date(Number(nowMs) + h * 3600 * 1000);
}

function inviteCode() {
  return randomBytes(INVITE_CODE_BYTES).toString('base64url');
}

// -------- social handles (pure, unit-testable) --------
// Normalize a Twitter/X or GitHub handle: strip a leading '@', a full URL
// (twitter.com/x.com/github.com/...), and any query/trailing slash, leaving the
// bare handle. Returns '' when nothing usable remains.
export function normalizeHandle(value) {
  let s = String(value == null ? '' : value).trim();
  if (!s) return '';
  // Strip a URL form: keep the last non-empty path segment.
  const urlMatch = s.match(/^(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com|github\.com)\/(.+)$/i);
  if (urlMatch) s = urlMatch[1];
  s = s.split(/[/?#]/)[0];   // drop anything after the handle
  s = s.replace(/^@+/, '');  // drop leading @
  return s.trim();
}

// Twitter/X: 1-15 chars, letters/numbers/underscore (X's rule). GitHub:
// 1-39 chars, alphanumeric or single hyphens (not leading/trailing).
const TWITTER_RE = /^[A-Za-z0-9_]{1,15}$/;
const GITHUB_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

export function isValidTwitter(handle) { return TWITTER_RE.test(String(handle || '')); }
export function isValidGithub(handle) { return GITHUB_RE.test(String(handle || '')); }

// -------- preset avatars (allowlist; no user uploads => no NSFW image risk) --------
// Keys map to same-origin PNGs under assets/avatars/. Editing the profile can
// only ever select one of these — arbitrary image URLs are rejected.
export const AVATAR_KEYS = ['knight', 'wizard', 'builder', 'explorer', 'knave', 'robot', 'fox', 'cat'];
const AVATAR_BASE = '/assets/avatars/';
export function avatarUrlForKey(key) {
  const k = String(key || '').trim().toLowerCase();
  return AVATAR_KEYS.includes(k) ? AVATAR_BASE + k + '.png' : '';
}
// Reverse-map a stored image URL back to a preset key (for pre-selecting in UI).
export function avatarKeyForUrl(url) {
  const m = String(url || '').match(/\/assets\/avatars\/([a-z]+)\.png$/i);
  return m && AVATAR_KEYS.includes(m[1].toLowerCase()) ? m[1].toLowerCase() : '';
}

// -------- content safety (pure, unit-testable) --------
// Block sexual, nudity, and abusive/hateful content in user-authored profile
// text (display name + about). Two-layer match to balance evasion-resistance
// against false positives. This is a first-line filter, not a guarantee — the
// moderation webhook + bans handle anything that slips through.

// Layer 1 — HARD substrings: terms that essentially never appear inside
// innocent English, so we can match them even across collapsed/leet/spacing
// evasion ("p0 r n" -> "porn"). Kept deliberately unambiguous.
const HARD_SUBSTRINGS = [
  'childporn', 'porn', 'pormo', 'hentai', 'masturbat', 'blowjob', 'handjob',
  'creampie', 'cumshot', 'cumming', 'dildo', 'onlyfans', 'jailbait', 'upskirt',
  'molest', 'bestiality', 'pedophile', 'pedophilia', 'nigger', 'faggot',
  'motherfucker', 'fuckyou', 'fuckme', 'incest', 'rapist',
];

// Layer 2 — WHOLE-WORD terms: short/ambiguous words that DO occur inside
// innocent words (sex/Essex, anal/analysis, tit/title, cum/document, cp/cpu),
// so they must match as standalone words only.
const WORD_BANNED = [
  'sex', 'xxx', 'nsfw', 'nude', 'nudes', 'naked', 'boob', 'boobs', 'tit', 'tits',
  'titty', 'cock', 'dick', 'penis', 'pussy', 'vagina', 'cum', 'orgasm', 'anal',
  'anus', 'cunt', 'clit', 'rape', 'fellatio', 'pedo', 'loli', 'lolita',
  'jailbait', 'escort', 'camgirl', 'fuck', 'shit', 'bitch', 'asshole', 'bastard',
  'whore', 'slut', 'fag', 'faggot', 'retard', 'kike', 'spic', 'chink', 'coon',
  'dyke', 'tranny', 'wetback', 'cp',
];
const WORD_BANNED_SET = new Set(WORD_BANNED);

const LEET_MAP = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's' };
function deLeet(s) {
  return String(s).toLowerCase().replace(/[013457 8@$]/g, ch => (LEET_MAP[ch] !== undefined ? LEET_MAP[ch] : ch));
}

// Fully collapse to a-z only (defeats spacing/punctuation evasion).
export function normalizeForSafety(text) {
  return deLeet(text).replace(/[^a-z]/g, '');
}

// Returns { ok: true } or { ok: false, reason }. `field` is for the message.
export function checkTextSafety(text, field = 'text') {
  const raw = String(text == null ? '' : text);
  // Layer 1: hard substrings against the fully-collapsed string.
  const collapsed = normalizeForSafety(raw);
  for (const bad of HARD_SUBSTRINGS) {
    if (collapsed.includes(bad)) {
      return { ok: false, reason: 'Your ' + field + ' contains content that is not allowed (sexual, abusive, or hateful).' };
    }
  }
  // Layer 2: whole-word match on de-leeted text (keeps word boundaries).
  const words = deLeet(raw).replace(/[^a-z]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (WORD_BANNED_SET.has(w)) {
      return { ok: false, reason: 'Your ' + field + ' contains language that is not allowed here.' };
    }
  }
  return { ok: true };
}

// -------- dtos --------
function memberDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    about: row.about || '',
    image: row.image || '',
    twitter: row.twitter || '',
    github: row.github || '',
    roles: Array.isArray(row.roles) ? row.roles : [],
    online: !!row.online,
    lastSeenAt: row.last_seen_at || null,
  };
}

// The signed-in user's own view, including whether their mandatory Twitter
// handle is on file (drives the "complete your profile" gate on the client).
function meDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    about: row.about || '',
    image: row.image || '',
    avatar: avatarKeyForUrl(row.image),
    twitter: row.twitter || '',
    github: row.github || '',
    profileComplete: !!(row.twitter && String(row.twitter).trim()),
  };
}

function roomDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    topic: row.topic || '',
    isPrivate: !!row.is_private,
    role: row.member_role || null,
    joined: !!row.member_role,
    createdAt: row.created_at,
  };
}

function messageDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    roomId: row.room_id || null,
    dmKey: row.dm_key || null,
    body: row.body,
    hidden: !!row.hidden_at,
    hiddenAt: row.hidden_at || null,
    hiddenBy: row.hidden_by || null,
    hiddenReason: row.hidden_reason || '',
    createdAt: row.created_at,
    author: {
      id: row.author_profile_id,
      username: row.author_username,
      displayName: row.author_display_name,
      image: row.author_image || '',
    },
  };
}

function dmDto(row, selfId) {
  const otherId = dmOtherId(row.dm_key, selfId);
  return {
    dmKey: row.dm_key,
    other: {
      id: otherId,
      username: row.other_username,
      displayName: row.other_display_name,
      image: row.other_image || '',
      online: !!row.other_online,
    },
    lastBody: row.last_body || '',
    lastAt: row.last_at || null,
  };
}

// -------- schema --------
async function ensureTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS community_rooms (
      id          SERIAL PRIMARY KEY,
      slug        TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      topic       TEXT NOT NULL DEFAULT '',
      is_private  BOOLEAN NOT NULL DEFAULT FALSE,
      created_by  INT REFERENCES profiles(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS community_memberships (
      id          SERIAL PRIMARY KEY,
      room_id     INT NOT NULL REFERENCES community_rooms(id) ON DELETE CASCADE,
      profile_id  INT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','mod','member')),
      joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (room_id, profile_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS community_messages (
      id                 SERIAL PRIMARY KEY,
      room_id            INT REFERENCES community_rooms(id) ON DELETE CASCADE,
      dm_key             TEXT,
      author_profile_id  INT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      body               TEXT NOT NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (room_id IS NOT NULL OR dm_key IS NOT NULL)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS community_messages_room_idx ON community_messages (room_id, id)`;
  await sql`CREATE INDEX IF NOT EXISTS community_messages_dm_idx ON community_messages (dm_key, id)`;
  await sql`CREATE INDEX IF NOT EXISTS community_messages_author_time_idx ON community_messages (author_profile_id, created_at)`;
  // Soft moderation: moderators can hide a message from regular readers while
  // retaining it for audit/restore. Hard delete remains available separately.
  await sql`ALTER TABLE community_messages ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ`;
  await sql`ALTER TABLE community_messages ADD COLUMN IF NOT EXISTS hidden_by INT REFERENCES profiles(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE community_messages ADD COLUMN IF NOT EXISTS hidden_reason TEXT NOT NULL DEFAULT ''`;
  await sql`CREATE INDEX IF NOT EXISTS community_messages_hidden_idx ON community_messages (hidden_at)`;
  await sql`
    CREATE TABLE IF NOT EXISTS community_bans (
      id          SERIAL PRIMARY KEY,
      room_id     INT REFERENCES community_rooms(id) ON DELETE CASCADE,
      profile_id  INT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      banned_by   INT REFERENCES profiles(id) ON DELETE SET NULL,
      reason      TEXT NOT NULL DEFAULT '',
      expires_at  TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS community_bans_profile_idx ON community_bans (profile_id, room_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS community_blocks (
      id                  SERIAL PRIMARY KEY,
      blocker_profile_id  INT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      blocked_profile_id  INT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (blocker_profile_id, blocked_profile_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS community_invites (
      id          SERIAL PRIMARY KEY,
      code        TEXT NOT NULL UNIQUE,
      room_id     INT NOT NULL REFERENCES community_rooms(id) ON DELETE CASCADE,
      created_by  INT REFERENCES profiles(id) ON DELETE SET NULL,
      expires_at  TIMESTAMPTZ,
      max_uses    INT,
      uses        INT NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // One row per profile that has cleared (or attempted) the human-safe anti-AI
  // questionnaire. `verified_at` non-null === member is unlocked. `attempts`
  // throttles brute-forcing the trivial answers.
  await sql`
    CREATE TABLE IF NOT EXISTS community_verifications (
      profile_id   INT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      verified_at  TIMESTAMPTZ,
      attempts     INT NOT NULL DEFAULT 0,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Social handles on the profile. Twitter/X is mandatory for participation
  // (enforced at post/DM time); GitHub is optional. Stored as bare handles.
  // Idempotent so the community page works even before the SQL migration runs.
  await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitter TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github  TEXT NOT NULL DEFAULT ''`;
  // Global community roles granted to a profile by an admin (distinct from the
  // per-room community_memberships.role). One row per (profile, role).
  await sql`
    CREATE TABLE IF NOT EXISTS community_roles (
      profile_id  INT  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      role        TEXT NOT NULL CHECK (role IN ('admin','moderator','channel_creator')),
      granted_by  INT  REFERENCES profiles(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (profile_id, role)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS community_roles_role_idx ON community_roles (role)`;
  // Suspensions (community + game access) and self-reports.
  await ensureSuspensionTable(sql);
  await sql`
    CREATE TABLE IF NOT EXISTS community_reports (
      id           SERIAL PRIMARY KEY,
      message_id   INT REFERENCES community_messages(id) ON DELETE CASCADE,
      reporter_id  INT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      author_id    INT REFERENCES profiles(id) ON DELETE SET NULL,
      kind         TEXT NOT NULL DEFAULT 'report' CHECK (kind IN ('report','downvote')),
      reason       TEXT NOT NULL DEFAULT '',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (message_id, reporter_id, kind)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS community_reports_msg_idx ON community_reports (message_id)`;
}

// Additive seeding of the default public rooms — only inserts rooms whose slug
// is not already present, mirroring features.mjs / roadmap.mjs. Names/slugs are
// always lowercase.
async function seedRooms(sql) {
  const existing = await sql`SELECT LOWER(slug) AS slug FROM community_rooms`;
  const have = new Set(existing.map(r => r.slug));
  for (const r of DEFAULT_ROOMS) {
    const slug = r.slug.toLowerCase();
    const name = r.name.toLowerCase();
    if (have.has(slug)) continue;
    await sql`
      INSERT INTO community_rooms (slug, name, topic, is_private)
      VALUES (${slug}, ${name}, ${r.topic}, FALSE)
      ON CONFLICT (slug) DO NOTHING
    `;
  }
}

// Enforce two invariants on every request: (1) all channel names + slugs are
// lowercase, and (2) the community super-owner is an 'owner' of every room.
// Idempotent and cheap (a couple of set-based UPDATEs + one INSERT…SELECT).
async function ensureCommunityDefaults(sql) {
  // (1) Lowercase any channel name/slug that isn't already.
  await sql`UPDATE community_rooms SET name = LOWER(name) WHERE name <> LOWER(name)`;
  await sql`UPDATE community_rooms SET slug = LOWER(slug) WHERE slug <> LOWER(slug)`;

  // (2) Make the super-owner an owner of every room. Find their profile by
  // username or display_name (case-insensitive); if they don't exist yet,
  // there's nothing to grant — a later request once they have a profile will.
  const owners = await sql`
    SELECT id FROM profiles
    WHERE LOWER(username) = ${SUPER_OWNER_USERNAME}
       OR LOWER(display_name) = ${SUPER_OWNER_USERNAME}
    ORDER BY id ASC
    LIMIT 1
  `;
  if (!owners.length) return;
  const ownerId = owners[0].id;
  // Insert missing memberships as 'owner', and promote any existing membership
  // for this profile to 'owner'.
  await sql`
    INSERT INTO community_memberships (room_id, profile_id, role)
    SELECT r.id, ${ownerId}, 'owner' FROM community_rooms r
    ON CONFLICT (room_id, profile_id) DO UPDATE SET role = 'owner'
  `;
}

// -------- presence (shared with the players feature) --------
async function touchPresence(sql, profileId) {
  try {
    await sql`
      INSERT INTO player_presence (profile_id, status, room_id, last_seen_at)
      VALUES (${profileId}, 'online', 'community', NOW())
      ON CONFLICT (profile_id) DO UPDATE
        SET status = 'online', last_seen_at = NOW(), updated_at = NOW()
    `;
  } catch (_) {
    // player_presence is owned by the players feature; if it isn't migrated yet
    // the community page still works, members just show as offline.
  }
}

// -------- admin gate (LOCAL-DEV ONLY, mirrors features.mjs / roadmap.mjs) --------
function envValue(name) {
  try {
    if (globalThis.Netlify && Netlify.env && typeof Netlify.env.get === 'function') {
      const value = Netlify.env.get(name);
      if (value) return value;
    }
  } catch (_) {}
  return process.env[name] || '';
}

function isAdmin(request) {
  try {
    const host = (request.headers.get('host') || '').toLowerCase();
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return false;
  } catch (_) { return false; }
  const secret = envValue('TINYWORLD_ADMIN_SECRET');
  if (!secret) return false;
  return (request.headers.get('x-admin-secret') || '') === secret;
}

// True when this profile is community staff (super-owner or a configured staff
// username). Staff have global management permission in production — distinct
// from the local-dev-only isAdmin() secret gate.
function isStaffProfile(profile) {
  if (!profile) return false;
  const uname = String(profile.username || '').toLowerCase();
  const dname = String(profile.display_name || '').toLowerCase();
  return STAFF_USERNAMES.has(uname) || STAFF_USERNAMES.has(dname);
}

// -------- roles & capabilities --------
// Assignable global roles (admin can grant/revoke these from the UI).
export const COMMUNITY_ROLES = ['admin', 'moderator', 'channel_creator'];

// Map a set of held roles (+ super-admin flag) to a capability object. Pure and
// unit-testable. `isSuperAdmin` is true for env-staff / the local admin secret,
// who implicitly hold every capability.
export function capabilitiesFor(roles, isSuperAdmin = false) {
  const has = new Set(Array.isArray(roles) ? roles : []);
  const admin = isSuperAdmin || has.has('admin');
  const moderator = admin || has.has('moderator');
  const channelCreator = admin || moderator || has.has('channel_creator');
  return {
    isAdmin: admin,            // full control, incl. granting roles & global bans
    canModerate: moderator,    // ban / unban / block / delete messages & rooms
    canCreateChannels: channelCreator,
    canManageRoles: admin,     // only admins grant/revoke roles
    roles: Array.from(has),
  };
}

// Load the global roles a profile holds (DB-backed grants).
async function loadRoles(sql, profileId) {
  const rows = await sql`SELECT role FROM community_roles WHERE profile_id = ${profileId}`;
  return rows.map(r => r.role);
}


// -------- data access --------
async function listRooms(sql, profileId) {
  const rows = await sql`
    SELECT r.*, m.role AS member_role
    FROM community_rooms r
    LEFT JOIN community_memberships m
      ON m.room_id = r.id AND m.profile_id = ${profileId}
    WHERE r.is_private = FALSE OR m.profile_id IS NOT NULL
    ORDER BY r.is_private ASC, r.created_at ASC, r.id ASC
    LIMIT 200
  `;
  return rows.map(roomDto);
}

async function listMembers(sql, selfId) {
  const rows = await sql`
    SELECT p.id, p.username, p.display_name, p.about, p.image, p.twitter, p.github,
           pr.last_seen_at,
           (pr.last_seen_at > NOW() - INTERVAL '5 minutes') AS online,
           COALESCE(
             (SELECT array_agg(cr.role) FROM community_roles cr WHERE cr.profile_id = p.id),
             ARRAY[]::text[]
           ) AS roles
    FROM profiles p
    LEFT JOIN player_presence pr ON pr.profile_id = p.id
    WHERE p.id NOT IN (
      SELECT blocked_profile_id FROM community_blocks WHERE blocker_profile_id = ${selfId}
    )
    ORDER BY (pr.last_seen_at > NOW() - INTERVAL '5 minutes') DESC,
             pr.last_seen_at DESC NULLS LAST,
             p.display_name ASC
    LIMIT 100
  `;
  return rows.map(memberDto);
}

// Load the signed-in member's own socials (the shared ensureProfile() doesn't
// select these columns, so read them explicitly).
async function loadMe(sql, profileId) {
  const rows = await sql`
    SELECT id, username, display_name, about, image, twitter, github
    FROM profiles WHERE id = ${profileId} LIMIT 1
  `;
  return rows.length ? meDto(rows[0]) : null;
}

async function listBlocks(sql, selfId) {
  const rows = await sql`
    SELECT blocked_profile_id FROM community_blocks WHERE blocker_profile_id = ${selfId}
  `;
  return rows.map(r => Number(r.blocked_profile_id));
}

async function listRoomMessages(sql, roomId, selfId, includeHidden = false) {
  const rows = await sql`
    SELECT msg.id, msg.room_id, msg.dm_key, msg.body, msg.hidden_at, msg.hidden_by, msg.hidden_reason, msg.created_at, msg.author_profile_id,
           a.username AS author_username, a.display_name AS author_display_name, a.image AS author_image
    FROM community_messages msg
    JOIN profiles a ON a.id = msg.author_profile_id
    WHERE msg.room_id = ${roomId}
      AND (${includeHidden} OR msg.hidden_at IS NULL)
      AND msg.author_profile_id NOT IN (
        SELECT blocked_profile_id FROM community_blocks WHERE blocker_profile_id = ${selfId}
      )
    ORDER BY msg.id DESC
    LIMIT 100
  `;
  return rows.reverse().map(messageDto);
}

async function listDmMessages(sql, key, selfId, includeHidden = false) {
  const rows = await sql`
    SELECT msg.id, msg.room_id, msg.dm_key, msg.body, msg.hidden_at, msg.hidden_by, msg.hidden_reason, msg.created_at, msg.author_profile_id,
           a.username AS author_username, a.display_name AS author_display_name, a.image AS author_image
    FROM community_messages msg
    JOIN profiles a ON a.id = msg.author_profile_id
    WHERE msg.dm_key = ${key}
      AND (${includeHidden} OR msg.hidden_at IS NULL)
      AND msg.author_profile_id NOT IN (
        SELECT blocked_profile_id FROM community_blocks WHERE blocker_profile_id = ${selfId}
      )
    ORDER BY msg.id DESC
    LIMIT 100
  `;
  return rows.reverse().map(messageDto);
}

async function listDmConversations(sql, selfId) {
  const rows = await sql`
    SELECT DISTINCT ON (m.dm_key)
           m.dm_key, m.body AS last_body, m.created_at AS last_at,
           o.username AS other_username, o.display_name AS other_display_name, o.image AS other_image,
           (op.last_seen_at > NOW() - INTERVAL '5 minutes') AS other_online
    FROM community_messages m
    JOIN profiles o ON o.id = (
      CASE WHEN split_part(m.dm_key, '-', 1)::int = ${selfId}
           THEN split_part(m.dm_key, '-', 2)::int
           ELSE split_part(m.dm_key, '-', 1)::int END
    )
    LEFT JOIN player_presence op ON op.profile_id = o.id
    WHERE m.dm_key IS NOT NULL
      AND m.hidden_at IS NULL
      AND (split_part(m.dm_key, '-', 1)::int = ${selfId} OR split_part(m.dm_key, '-', 2)::int = ${selfId})
    ORDER BY m.dm_key, m.id DESC
    LIMIT 50
  `;
  // Re-sort by most recent conversation.
  return rows
    .map(r => dmDto(r, selfId))
    .sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || '')));
}

// Active ban lookup: global (room_id NULL) or for the specific room.
async function activeBan(sql, profileId, roomId) {
  const rows = await sql`
    SELECT id, room_id, reason, expires_at
    FROM community_bans
    WHERE profile_id = ${profileId}
      AND (room_id IS NULL OR room_id = ${roomId || null})
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY (expires_at IS NULL) DESC, expires_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

async function roomRole(sql, roomId, profileId) {
  const rows = await sql`
    SELECT role FROM community_memberships WHERE room_id = ${roomId} AND profile_id = ${profileId} LIMIT 1
  `;
  return rows.length ? rows[0].role : null;
}

async function messageModerationTarget(sql, messageId, profileId, caps) {
  const rows = await sql`
    SELECT id, room_id, dm_key, author_profile_id, body, hidden_at
    FROM community_messages
    WHERE id = ${messageId}
    LIMIT 1
  `;
  if (!rows.length) return { found: false, allowed: false, message: null };
  const message = rows[0];
  if (caps && caps.canModerate) return { found: true, allowed: true, message, role: 'moderator' };
  if (message.room_id) {
    const role = await roomRole(sql, message.room_id, profileId);
    if (role === 'owner' || role === 'mod') return { found: true, allowed: true, message, role };
  }
  return { found: true, allowed: false, message, role: null };
}

async function rateLimitCount(sql, profileId) {
  const rows = await sql`
    SELECT count(*)::int AS n
    FROM community_messages
    WHERE author_profile_id = ${profileId}
      AND created_at > NOW() - (${RATE_LIMIT_WINDOW_SECONDS} || ' seconds')::interval
  `;
  return Number(rows[0] && rows[0].n) || 0;
}

// -------- human-safe anti-AI verification gate --------
const VERIFY_MAX_ATTEMPTS = 8; // failed submissions before a short lockout

// True once a profile has cleared the questionnaire.
async function isMemberVerified(sql, profileId) {
  const rows = await sql`
    SELECT verified_at FROM community_verifications WHERE profile_id = ${profileId} LIMIT 1
  `;
  return !!(rows.length && rows[0].verified_at);
}

async function verificationRow(sql, profileId) {
  const rows = await sql`
    SELECT profile_id, verified_at, attempts FROM community_verifications WHERE profile_id = ${profileId} LIMIT 1
  `;
  return rows[0] || null;
}

async function recordVerifyAttempt(sql, profileId) {
  const rows = await sql`
    INSERT INTO community_verifications (profile_id, attempts, updated_at)
    VALUES (${profileId}, 1, NOW())
    ON CONFLICT (profile_id) DO UPDATE
      SET attempts = community_verifications.attempts + 1, updated_at = NOW()
    RETURNING attempts
  `;
  return Number(rows[0] && rows[0].attempts) || 0;
}

async function markVerified(sql, profileId) {
  await sql`
    INSERT INTO community_verifications (profile_id, verified_at, updated_at)
    VALUES (${profileId}, NOW(), NOW())
    ON CONFLICT (profile_id) DO UPDATE
      SET verified_at = NOW(), updated_at = NOW()
  `;
}

// -------- handler --------
export default async function communityFunction(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);

  const auth = await requireAuthUser(request, origin);
  if (auth.response) return auth.response;

  try {
    const sql = getSql();
    await ensureTables(sql);
    await seedRooms(sql);
    const profile = await ensureProfile(auth.user);
    await ensureCommunityDefaults(sql);
    const url = new URL(request.url);
    // Capability model. `superAdmin` = env-staff / local admin secret (implicit
    // full control). DB-granted roles (community_roles) layer on top. `caps`
    // resolves the effective permissions; `admin` stays true for any full admin
    // (super OR granted 'admin' role) so existing checks keep working.
    const superAdmin = isAdmin(request) || isStaffProfile(profile);
    const myRoles = await loadRoles(sql, profile.id);
    const caps = capabilitiesFor(myRoles, superAdmin);
    const staff = superAdmin;
    const admin = caps.isAdmin;
    // Staff are implicitly trusted; everyone else must clear the human-safe
    // anti-AI questionnaire before they can post / DM / join / create.
    const verified = admin || await isMemberVerified(sql, profile.id);

    // ---------------- GET ----------------
    if (request.method === 'GET') {
      const resource = url.searchParams.get('resource') || 'bootstrap';
      await touchPresence(sql, profile.id);

      if (resource === 'bootstrap') {
        const [me, rooms, members, dms, blocks, suspension] = await Promise.all([
          loadMe(sql, profile.id),
          listRooms(sql, profile.id),
          listMembers(sql, profile.id),
          listDmConversations(sql, profile.id),
          listBlocks(sql, profile.id),
          activeSuspension(sql, profile.id),
        ]);
        return jsonResponse({
          me, rooms, members, dms, blocks, admin, verified,
          avatars: AVATAR_KEYS, caps, roleOptions: COMMUNITY_ROLES,
          policyNotice: POLICY_NOTICE,
          suspendedUntil: suspension ? suspension.expires_at : null,
          suspensionReason: suspension ? suspension.reason : '',
        }, origin);
      }
      if (resource === 'verifyChallenge') {
        // Already-verified members don't need a challenge.
        if (verified) return jsonResponse({ verified: true, challenge: null }, origin);
        const row = await verificationRow(sql, profile.id);
        if (row && Number(row.attempts) >= VERIFY_MAX_ATTEMPTS) {
          return errorResponse('Too many failed attempts. Please try again later.', 429, origin);
        }
        return jsonResponse({ verified: false, challenge: issueChallenge(profile.id) }, origin);
      }
      if (resource === 'rooms') {
        return jsonResponse({ rooms: await listRooms(sql, profile.id) }, origin);
      }
      if (resource === 'members') {
        return jsonResponse({ members: await listMembers(sql, profile.id) }, origin);
      }
      if (resource === 'dms') {
        return jsonResponse({ dms: await listDmConversations(sql, profile.id) }, origin);
      }
      if (resource === 'messages') {
        const roomId = cleanProfileId(url.searchParams.get('roomId'));
        const dmWith = cleanProfileId(url.searchParams.get('dm'));
        if (roomId) {
          const roomRows = await sql`SELECT id, is_private FROM community_rooms WHERE id = ${roomId} LIMIT 1`;
          if (!roomRows.length) return errorResponse('Room not found', 404, origin);
          let role = null;
          if (roomRows[0].is_private) {
            role = await roomRole(sql, roomId, profile.id);
            if (!role && !admin) return errorResponse('This room is invite-only', 403, origin);
          } else {
            role = await roomRole(sql, roomId, profile.id);
          }
          const includeHidden = !!(caps.canModerate || role === 'owner' || role === 'mod');
          return jsonResponse({ messages: await listRoomMessages(sql, roomId, profile.id, includeHidden) }, origin);
        }
        if (dmWith) {
          const key = dmKey(profile.id, dmWith);
          if (!key) return errorResponse('Invalid DM target', 400, origin);
          return jsonResponse({ messages: await listDmMessages(sql, key, profile.id, !!caps.canModerate), dmKey: key }, origin);
        }
        return errorResponse('roomId or dm is required', 400, origin);
      }
      return errorResponse('Unknown resource', 400, origin);
    }

    // ---------------- writes ----------------
    if (request.method !== 'POST') return errorResponse('Method not allowed', 405, origin);
    if (!sameOriginWriteGuard(request)) return errorResponse('Forbidden', 403, origin);

    const body = await readJson(request);
    const action = cleanText(body && body.action, 32);
    await touchPresence(sql, profile.id);

    if (action === 'heartbeat') {
      return jsonResponse({ ok: true }, origin);
    }

    // ---- human-safe anti-AI questionnaire ----
    if (action === 'submitVerification') {
      if (verified) return jsonResponse({ verified: true }, origin);
      const row = await verificationRow(sql, profile.id);
      if (row && Number(row.attempts) >= VERIFY_MAX_ATTEMPTS) {
        return errorResponse('Too many failed attempts. Please try again later.', 429, origin);
      }
      const result = verifySubmission({
        token: cleanText(body && body.token, 1024),
        profileId: profile.id,
        answers: (body && body.answers) || {},
        honeypot: body && body[HONEYPOT_FIELD],
        elapsedMs: Number(body && body.elapsedMs),
      });
      if (!result.passed) {
        const attempts = await recordVerifyAttempt(sql, profile.id);
        const remaining = Math.max(0, VERIFY_MAX_ATTEMPTS - attempts);
        return jsonResponse({ verified: false, ok: false, remaining, reason: result.reason }, origin, 403);
      }
      await markVerified(sql, profile.id);
      return jsonResponse({ verified: true, ok: true }, origin);
    }

    // Every membership-changing / content-producing action below requires a
    // verified human. Read-only GETs above stay open so newcomers can look
    // around while they complete the questionnaire.
    const GATED_ACTIONS = new Set([
      'postMessage', 'joinRoom', 'leaveRoom', 'createRoom', 'deleteRoom',
      'createInvite', 'redeemInvite', 'block', 'unblock', 'ban', 'unban',
      'hideMessage', 'unhideMessage', 'deleteMessage',
      'reportMessage', 'downvoteMessage',
    ]);
    if (GATED_ACTIONS.has(action) && !verified) {
      return errorResponse('Please complete the human verification questionnaire before participating.', 403, origin);
    }

    // Edit your profile: display name, about/bio, preset avatar, and social
    // handles. Twitter/X is mandatory; GitHub optional. All user text is safety-
    // checked (no sexual / nudity / abusive / hateful content). Avatar is an
    // allowlisted preset key — no arbitrary image URLs. NOT gated on
    // profile-completeness (this is the action that completes it), but still
    // requires a verified human. `saveSocials` kept as a back-compat alias.
    if (action === 'saveProfile' || action === 'saveSocials') {
      if (!verified) return errorResponse('Please complete the human verification questionnaire first.', 403, origin);

      // Load current row so partial updates keep existing values.
      const cur = await sql`SELECT display_name, about, image, twitter, github FROM profiles WHERE id = ${profile.id} LIMIT 1`;
      if (!cur.length) return errorResponse('Profile not found', 404, origin);
      const row = cur[0];

      // ---- handles (twitter mandatory, github optional) ----
      const twitter = normalizeHandle(body && (body.twitter ?? body.twitterId));
      const github = normalizeHandle(body && (body.github ?? body.githubId));
      if (!twitter) return errorResponse('A Twitter/X handle is required.', 400, origin);
      if (!isValidTwitter(twitter)) return errorResponse('That Twitter/X handle is not valid (letters, numbers, underscore; up to 15 characters).', 400, origin);
      if (github && !isValidGithub(github)) return errorResponse('That GitHub username is not valid.', 400, origin);

      // ---- display name (optional update, safety-checked) ----
      let displayName = row.display_name;
      if (body && body.displayName != null) {
        displayName = cleanText(body.displayName, 80);
        if (!displayName) return errorResponse('Display name cannot be empty.', 400, origin);
        const safe = checkTextSafety(displayName, 'display name');
        if (!safe.ok) return errorResponse(safe.reason, 400, origin);
      }

      // ---- about / bio (optional update, safety-checked) ----
      let about = row.about || '';
      if (body && body.about != null) {
        about = cleanText(body.about, 1000);
        const safe = checkTextSafety(about, 'bio');
        if (!safe.ok) return errorResponse(safe.reason, 400, origin);
      }

      // ---- avatar (optional; preset allowlist only) ----
      let image = row.image || '';
      if (body && body.avatar != null) {
        const url = avatarUrlForKey(body.avatar);
        if (!url) return errorResponse('Pick one of the available avatars.', 400, origin);
        image = url;
      }

      const out = await sql`
        UPDATE profiles
        SET display_name = ${displayName}, about = ${about}, image = ${image},
            twitter = ${twitter}, github = ${github}, updated_at = NOW()
        WHERE id = ${profile.id}
        RETURNING id, username, display_name, about, image, twitter, github
      `;
      return jsonResponse({ me: out.length ? meDto(out[0]) : null }, origin);
    }

    // Mandatory-profile gate: members must have a Twitter/X handle on file before
    // they can post, DM, or otherwise produce content / join rooms.
    const PROFILE_GATED_ACTIONS = new Set([
      'postMessage', 'joinRoom', 'createRoom', 'redeemInvite',
    ]);
    if (PROFILE_GATED_ACTIONS.has(action)) {
      const meRow = await sql`SELECT twitter FROM profiles WHERE id = ${profile.id} LIMIT 1`;
      if (!meRow.length || !String(meRow[0].twitter || '').trim()) {
        return errorResponse('Add your Twitter/X handle to your profile before participating.', 403, origin);
      }
    }

    if (action === 'postMessage') {
      const text = cleanText(body && body.body, MESSAGE_MAX_LENGTH);
      if (!text) return errorResponse('Message cannot be empty', 400, origin);
      if (String(body && body.body || '').length > MESSAGE_MAX_LENGTH) {
        return errorResponse('Message exceeds ' + MESSAGE_MAX_LENGTH + ' characters', 400, origin);
      }

      // Rate limit (spam guard).
      const recent = await rateLimitCount(sql, profile.id);
      if (isRateLimited(recent, RATE_LIMIT_MAX)) {
        return errorResponse('You are sending messages too quickly. Slow down and try again.', 429, origin);
      }

      // Already-suspended members cannot post (community + game lockout).
      const susp = await activeSuspension(sql, profile.id);
      if (susp) {
        return jsonResponse({
          error: 'You are suspended until ' + new Date(susp.expires_at).toISOString() + '. ' + POLICY_NOTICE,
          suspendedUntil: susp.expires_at, reason: susp.reason, category: susp.category,
        }, origin, 403);
      }

      // Content policy: no coin/CA shilling, abuse, foul language, or hostile
      // negativity. A violation rejects the message AND suspends the author for
      // SUSPENSION_HOURS (community + game access). Staff/admins are exempt.
      if (!admin) {
        const verdict = screenMessage(text);
        if (!verdict.ok) {
          const s = await suspendMember(sql, { profileId: profile.id, hours: SUSPENSION_HOURS, reason: verdict.reason, category: verdict.category, actorProfileId: null });
          emitCommunityEvent('member.suspended', {
            profileId: profile.id, username: profile.username, category: verdict.category,
            reason: verdict.reason, expiresAt: s.expires_at, sample: text.slice(0, 280),
          }).catch(() => {});
          return jsonResponse({
            error: verdict.reason + ' You are suspended for ' + SUSPENSION_HOURS + ' hours, including game access. ' + POLICY_NOTICE,
            suspended: true, suspendedUntil: s.expires_at, category: verdict.category,
          }, origin, 403);
        }
      }

      const roomId = cleanProfileId(body && body.roomId);
      const dmProfileId = cleanProfileId(body && body.dmProfileId);

      if (roomId) {
        const roomRows = await sql`SELECT id, is_private, slug, name FROM community_rooms WHERE id = ${roomId} LIMIT 1`;
        if (!roomRows.length) return errorResponse('Room not found', 404, origin);
        // Timed-ban enforcement (global or per-room).
        const ban = await activeBan(sql, profile.id, roomId);
        if (ban) {
          const until = ban.expires_at ? ('until ' + new Date(ban.expires_at).toISOString()) : '(permanent)';
          return errorResponse('You are banned from posting ' + until, 403, origin);
        }
        if (roomRows[0].is_private) {
          const role = await roomRole(sql, roomId, profile.id);
          if (!role) return errorResponse('Join this room before posting', 403, origin);
        } else {
          // Auto-join public rooms on first post so they appear in the sidebar.
          await sql`
            INSERT INTO community_memberships (room_id, profile_id, role)
            VALUES (${roomId}, ${profile.id}, 'member')
            ON CONFLICT (room_id, profile_id) DO NOTHING
          `;
        }
        const rows = await sql`
          INSERT INTO community_messages (room_id, author_profile_id, body)
          VALUES (${roomId}, ${profile.id}, ${text})
          RETURNING id, room_id, dm_key, body, created_at, author_profile_id
        `;
        const out = Object.assign({}, rows[0], {
          author_username: profile.username,
          author_display_name: profile.display_name,
          author_image: profile.image,
        });
        // Notify the moderation agent (fire-and-forget; never blocks the post).
        const dto = messageDto(out);
        emitCommunityEvent('message.created', {
          message: dto,
          room: { id: roomId, slug: roomRows[0].slug, name: roomRows[0].name },
          recentCount: recent + 1,
        }).catch(() => {});
        return jsonResponse({ message: dto }, origin, 201);
      }

      if (dmProfileId) {
        if (dmProfileId === Number(profile.id)) return errorResponse('You cannot DM yourself', 400, origin);
        const target = await sql`SELECT id FROM profiles WHERE id = ${dmProfileId} LIMIT 1`;
        if (!target.length) return errorResponse('Member not found', 404, origin);
        // Global ban also blocks DMs.
        const ban = await activeBan(sql, profile.id, null);
        if (ban) return errorResponse('You are banned from posting', 403, origin);
        // Mutual-aware block check: either direction blocks the DM.
        const blocked = await sql`
          SELECT 1 FROM community_blocks
          WHERE (blocker_profile_id = ${dmProfileId} AND blocked_profile_id = ${profile.id})
             OR (blocker_profile_id = ${profile.id} AND blocked_profile_id = ${dmProfileId})
          LIMIT 1
        `;
        if (blocked.length) return errorResponse('You cannot message this member', 403, origin);
        const key = dmKey(profile.id, dmProfileId);
        const rows = await sql`
          INSERT INTO community_messages (dm_key, author_profile_id, body)
          VALUES (${key}, ${profile.id}, ${text})
          RETURNING id, room_id, dm_key, body, created_at, author_profile_id
        `;
        const out = Object.assign({}, rows[0], {
          author_username: profile.username,
          author_display_name: profile.display_name,
          author_image: profile.image,
        });
        return jsonResponse({ message: messageDto(out), dmKey: key }, origin, 201);
      }

      return errorResponse('roomId or dmProfileId is required', 400, origin);
    }

    if (action === 'joinRoom') {
      const roomId = cleanProfileId(body && body.roomId);
      if (!roomId) return errorResponse('roomId is required', 400, origin);
      const roomRows = await sql`SELECT id, is_private FROM community_rooms WHERE id = ${roomId} LIMIT 1`;
      if (!roomRows.length) return errorResponse('Room not found', 404, origin);
      if (roomRows[0].is_private) return errorResponse('This room is invite-only', 403, origin);
      await sql`
        INSERT INTO community_memberships (room_id, profile_id, role)
        VALUES (${roomId}, ${profile.id}, 'member')
        ON CONFLICT (room_id, profile_id) DO NOTHING
      `;
      return jsonResponse({ ok: true, rooms: await listRooms(sql, profile.id) }, origin);
    }

    if (action === 'leaveRoom') {
      const roomId = cleanProfileId(body && body.roomId);
      if (!roomId) return errorResponse('roomId is required', 400, origin);
      await sql`
        DELETE FROM community_memberships
        WHERE room_id = ${roomId} AND profile_id = ${profile.id} AND role <> 'owner'
      `;
      return jsonResponse({ ok: true, rooms: await listRooms(sql, profile.id) }, origin);
    }

    if (action === 'createRoom') {
      // Channel creation requires the channel-creator capability (admins,
      // moderators, and channel_creators have it).
      if (!caps.canCreateChannels) return errorResponse('You do not have permission to create channels', 403, origin);
      const name = cleanText(body && body.name, 80).toLowerCase();
      if (!name) return errorResponse('Room name is required', 400, origin);
      const isPrivate = !!(body && body.isPrivate);
      const topic = cleanText(body && body.topic, 200);
      const slugBase = name.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'room';
      const slug = (slugBase + '-' + randomBytes(3).toString('hex')).slice(0, 60);
      const rows = await sql`
        INSERT INTO community_rooms (slug, name, topic, is_private, created_by)
        VALUES (${slug}, ${name}, ${topic}, ${isPrivate}, ${profile.id})
        RETURNING *
      `;
      await sql`
        INSERT INTO community_memberships (room_id, profile_id, role)
        VALUES (${rows[0].id}, ${profile.id}, 'owner')
        ON CONFLICT (room_id, profile_id) DO NOTHING
      `;
      // Keep the community super-owner an owner of every room, including new ones.
      await ensureCommunityDefaults(sql);
      return jsonResponse({ room: roomDto(Object.assign({}, rows[0], { member_role: 'owner' })) }, origin, 201);
    }

    if (action === 'deleteRoom') {
      const roomId = cleanProfileId(body && body.roomId);
      if (!roomId) return errorResponse('roomId is required', 400, origin);
      // Permission: community moderators/admins, OR the room's owner.
      const role = await roomRole(sql, roomId, profile.id);
      if (!caps.canModerate && role !== 'owner') {
        return errorResponse('You do not have permission to delete this channel', 403, origin);
      }
      // Cascades to memberships, messages, bans, and invites via ON DELETE CASCADE.
      await sql`DELETE FROM community_rooms WHERE id = ${roomId}`;
      return jsonResponse({ ok: true, rooms: await listRooms(sql, profile.id) }, origin);
    }

    if (action === 'createInvite') {
      const roomId = cleanProfileId(body && body.roomId);
      if (!roomId) return errorResponse('roomId is required', 400, origin);
      const role = await roomRole(sql, roomId, profile.id);
      if (!role && !admin) return errorResponse('Only room members can create invites', 403, origin);
      const hours = Number(body && body.expiresInHours);
      const expires = banExpiry(Date.now(), hours); // reuse: 0/blank => no expiry
      const maxUses = cleanProfileId(body && body.maxUses);
      const code = inviteCode();
      const rows = await sql`
        INSERT INTO community_invites (code, room_id, created_by, expires_at, max_uses)
        VALUES (${code}, ${roomId}, ${profile.id}, ${expires}, ${maxUses})
        RETURNING code, room_id, expires_at, max_uses, uses, created_at
      `;
      const reqOrigin = origin || new URL(request.url).origin;
      const path = '/community?invite=' + encodeURIComponent(code);
      return jsonResponse({
        invite: rows[0],
        url: path,
        absoluteUrl: reqOrigin ? new URL(path, reqOrigin).href : path,
      }, origin, 201);
    }

    if (action === 'redeemInvite') {
      const code = cleanText(body && body.code, 64);
      if (!code) return errorResponse('Invite code is required', 400, origin);
      const rows = await sql`
        SELECT * FROM community_invites WHERE code = ${code} LIMIT 1
      `;
      if (!rows.length) return errorResponse('Invite not found', 404, origin);
      const invite = rows[0];
      if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
        return errorResponse('This invite has expired', 410, origin);
      }
      if (invite.max_uses != null && Number(invite.uses) >= Number(invite.max_uses)) {
        return errorResponse('This invite has been fully used', 410, origin);
      }
      await sql`
        INSERT INTO community_memberships (room_id, profile_id, role)
        VALUES (${invite.room_id}, ${profile.id}, 'member')
        ON CONFLICT (room_id, profile_id) DO NOTHING
      `;
      await sql`UPDATE community_invites SET uses = uses + 1 WHERE id = ${invite.id}`;
      const roomRows = await sql`
        SELECT r.*, m.role AS member_role
        FROM community_rooms r
        LEFT JOIN community_memberships m ON m.room_id = r.id AND m.profile_id = ${profile.id}
        WHERE r.id = ${invite.room_id} LIMIT 1
      `;
      return jsonResponse({ room: roomRows.length ? roomDto(roomRows[0]) : null, rooms: await listRooms(sql, profile.id) }, origin);
    }

    if (action === 'block') {
      const targetId = cleanProfileId(body && body.profileId);
      if (!targetId || targetId === Number(profile.id)) return errorResponse('Invalid block target', 400, origin);
      await sql`
        INSERT INTO community_blocks (blocker_profile_id, blocked_profile_id)
        VALUES (${profile.id}, ${targetId})
        ON CONFLICT (blocker_profile_id, blocked_profile_id) DO NOTHING
      `;
      return jsonResponse({ ok: true, blocks: await listBlocks(sql, profile.id) }, origin);
    }

    if (action === 'unblock') {
      const targetId = cleanProfileId(body && body.profileId);
      if (!targetId) return errorResponse('Invalid unblock target', 400, origin);
      await sql`
        DELETE FROM community_blocks
        WHERE blocker_profile_id = ${profile.id} AND blocked_profile_id = ${targetId}
      `;
      return jsonResponse({ ok: true, blocks: await listBlocks(sql, profile.id) }, origin);
    }

    if (action === 'ban') {
      const targetId = cleanProfileId(body && body.profileId);
      if (!targetId || targetId === Number(profile.id)) return errorResponse('Invalid ban target', 400, origin);
      const roomId = cleanProfileId(body && body.roomId); // null => global ban
      // Authorisation: a global ban needs the moderate capability; a room ban
      // needs that OR an owner/mod role in that room.
      if (roomId) {
        const role = await roomRole(sql, roomId, profile.id);
        if (!caps.canModerate && role !== 'owner' && role !== 'mod') {
          return errorResponse('Only room owners, moderators, or admins can ban here', 403, origin);
        }
      } else if (!caps.canModerate) {
        return errorResponse('Only moderators or admins can issue a global ban', 403, origin);
      }
      const expires = banExpiry(Date.now(), Number(body && body.durationHours));
      const reason = cleanText(body && body.reason, 200);
      const rows = await sql`
        INSERT INTO community_bans (room_id, profile_id, banned_by, reason, expires_at)
        VALUES (${roomId || null}, ${targetId}, ${profile.id}, ${reason}, ${expires})
        RETURNING id, room_id, profile_id, reason, expires_at, created_at
      `;
      return jsonResponse({ ban: rows[0] }, origin, 201);
    }

    if (action === 'unban') {
      const targetId = cleanProfileId(body && body.profileId);
      if (!targetId) return errorResponse('Invalid unban target', 400, origin);
      const roomId = cleanProfileId(body && body.roomId);
      if (roomId) {
        const role = await roomRole(sql, roomId, profile.id);
        if (!caps.canModerate && role !== 'owner' && role !== 'mod') {
          return errorResponse('Only room owners, moderators, or admins can unban here', 403, origin);
        }
      } else if (!caps.canModerate) {
        return errorResponse('Only moderators or admins can lift a global ban', 403, origin);
      }
      await sql`
        DELETE FROM community_bans
        WHERE profile_id = ${targetId} AND (room_id IS NOT DISTINCT FROM ${roomId || null})
      `;
      return jsonResponse({ ok: true }, origin);
    }

    if (action === 'hideMessage' || action === 'unhideMessage' || action === 'deleteMessage') {
      const messageId = cleanProfileId(body && body.messageId);
      if (!messageId) return errorResponse('messageId is required', 400, origin);
      const target = await messageModerationTarget(sql, messageId, profile.id, caps);
      if (!target.found) return errorResponse('Message not found', 404, origin);
      if (!target.allowed) return errorResponse('Only moderators, admins, or room owners/mods can moderate messages here', 403, origin);

      if (action === 'deleteMessage') {
        const result = await deleteMessage(sql, { messageId });
        if (!result.ok) return errorResponse(result.error || 'Could not delete message', 400, origin);
        emitCommunityEvent('message.deleted', {
          messageId,
          roomId: target.message.room_id || null,
          dm: !!target.message.dm_key,
          actor: { id: profile.id, username: profile.username },
        }).catch(() => {});
        return jsonResponse({ ok: true, messageId }, origin);
      }

      if (action === 'hideMessage') {
        const reason = cleanText(body && body.reason, 200);
        const result = await hideMessage(sql, { messageId, actorProfileId: profile.id, reason });
        if (!result.ok) return errorResponse(result.error || 'Could not hide message', 400, origin);
        emitCommunityEvent('message.hidden', {
          messageId,
          roomId: target.message.room_id || null,
          dm: !!target.message.dm_key,
          reason,
          actor: { id: profile.id, username: profile.username },
        }).catch(() => {});
        return jsonResponse({ ok: true, messageId, hidden: true }, origin);
      }

      const result = await unhideMessage(sql, { messageId });
      if (!result.ok) return errorResponse(result.error || 'Could not restore message', 400, origin);
      emitCommunityEvent('message.unhidden', {
        messageId,
        roomId: target.message.room_id || null,
        dm: !!target.message.dm_key,
        actor: { id: profile.id, username: profile.username },
      }).catch(() => {});
      return jsonResponse({ ok: true, messageId, hidden: false }, origin);
    }

    // ---- role management (admins only) ----
    if (action === 'grantRole' || action === 'revokeRole') {
      if (!caps.canManageRoles) return errorResponse('Only admins can manage roles', 403, origin);
      const targetId = cleanProfileId(body && body.profileId);
      const role = String(body && body.role || '').trim().toLowerCase();
      if (!targetId) return errorResponse('A target member is required', 400, origin);
      if (!COMMUNITY_ROLES.includes(role)) return errorResponse('Unknown role', 400, origin);
      const exists = await sql`SELECT id FROM profiles WHERE id = ${targetId} LIMIT 1`;
      if (!exists.length) return errorResponse('Member not found', 404, origin);

      if (action === 'grantRole') {
        await sql`
          INSERT INTO community_roles (profile_id, role, granted_by)
          VALUES (${targetId}, ${role}, ${profile.id})
          ON CONFLICT (profile_id, role) DO NOTHING
        `;
      } else {
        // Don't let an admin strip their OWN last admin role (avoid lockout);
        // env/staff super-admins are unaffected since their power isn't DB-based.
        if (role === 'admin' && targetId === Number(profile.id) && !superAdmin) {
          const others = await sql`SELECT COUNT(*)::int AS n FROM community_roles WHERE role = 'admin' AND profile_id <> ${profile.id}`;
          if (Number(others[0].n) === 0) return errorResponse('You are the only admin — promote someone else first.', 400, origin);
        }
        await sql`DELETE FROM community_roles WHERE profile_id = ${targetId} AND role = ${role}`;
      }
      const roles = await loadRoles(sql, targetId);
      return jsonResponse({ ok: true, profileId: targetId, roles }, origin);
    }

    // Self-reporting: members flag a message (report) or downvote it. Persists a
    // row and fires a webhook so the moderation agent (Hermes) can pick it up.
    if (action === 'reportMessage' || action === 'downvoteMessage') {
      const kind = action === 'downvoteMessage' ? 'downvote' : 'report';
      const messageId = cleanProfileId(body && body.messageId);
      if (!messageId) return errorResponse('messageId is required', 400, origin);
      const reason = cleanText(body && body.reason, 300);
      const msg = await sql`SELECT id, author_profile_id, room_id, dm_key, body FROM community_messages WHERE id = ${messageId} LIMIT 1`;
      if (!msg.length) return errorResponse('Message not found', 404, origin);
      const m = msg[0];
      await sql`
        INSERT INTO community_reports (message_id, reporter_id, author_id, kind, reason)
        VALUES (${messageId}, ${profile.id}, ${m.author_profile_id}, ${kind}, ${reason})
        ON CONFLICT (message_id, reporter_id, kind) DO UPDATE SET reason = EXCLUDED.reason, created_at = NOW()
      `;
      // Tally so the agent can act on thresholds.
      const counts = await sql`
        SELECT
          COUNT(*) FILTER (WHERE kind = 'report')::int   AS reports,
          COUNT(*) FILTER (WHERE kind = 'downvote')::int AS downvotes
        FROM community_reports WHERE message_id = ${messageId}
      `;
      const tally = counts[0] || { reports: 0, downvotes: 0 };
      emitCommunityEvent('message.reported', {
        kind,
        messageId,
        reason,
        reporter: { id: profile.id, username: profile.username },
        author: { id: m.author_profile_id },
        roomId: m.room_id || null,
        dm: !!m.dm_key,
        sample: String(m.body || '').slice(0, 280),
        totals: { reports: Number(tally.reports) || 0, downvotes: Number(tally.downvotes) || 0 },
      }).catch(() => {});
      return jsonResponse({ ok: true, kind, messageId, totals: { reports: Number(tally.reports) || 0, downvotes: Number(tally.downvotes) || 0 } }, origin);
    }

    // Moderators/admins can lift a suspension.
    if (action === 'unsuspend') {
      if (!caps.canModerate) return errorResponse('Only moderators or admins can lift suspensions', 403, origin);
      const targetId = cleanProfileId(body && body.profileId);
      if (!targetId) return errorResponse('A target member is required', 400, origin);
      const r = await unsuspendMember(sql, { target: { profileId: targetId } });
      if (!r.ok) return errorResponse(r.error || 'Could not lift suspension', 400, origin);
      return jsonResponse(r, origin);
    }

    return errorResponse('Unknown community action', 400, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err)) {
      return errorResponse('Netlify Database is not available in this local session.', 503, origin);
    }
    if (isMissingCommunitySchema(err)) {
      return errorResponse('Community database tables are missing. Run the Netlify database migrations for community features.', 503, origin);
    }
    console.error('[community]', err);
    return errorResponse('Community request failed', 500, origin);
  }
}
