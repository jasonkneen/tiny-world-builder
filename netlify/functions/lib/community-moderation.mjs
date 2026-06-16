// Shared community moderation primitives + Hermes webhook bridge.
//
// These helpers are used by both the interactive `/api/community` endpoint and
// the server-to-server `/api/community/webhook` endpoint (driven by the Hermes
// agent) so moderation behaves identically no matter who triggers it.
//
// Every function takes an explicit `sql` (from getSql()) and uses parameterized
// queries. Profile resolution is intentionally flexible so an agent can target a
// member by profile id, username, display name, or wallet public key.

import { createHmac, timingSafeEqual } from 'node:crypto';

function envValue(name) {
  try {
    if (globalThis.Netlify && Netlify.env && typeof Netlify.env.get === 'function') {
      const value = Netlify.env.get(name);
      if (value) return value;
    }
  } catch (_) {}
  return process.env[name] || '';
}

// -------- duration / expiry --------
// Mirror of community.mjs banExpiry: hours -> absolute Date, or null = permanent.
export function banExpiry(nowMs, durationHours) {
  const h = Number(durationHours);
  if (!Number.isFinite(h) || h <= 0) return null;
  return new Date(Number(nowMs) + h * 3600 * 1000);
}

// -------- content policy screening (pure, unit-testable) --------
// Community rules enforced on every posted message:
//   1. No promoting / selling other coins, contract addresses (CAs), or memecoins.
//   2. No abuse, threats, or harassment.
//   3. No foul / hateful language.
//   4. No hostile negative-sentiment attacks on people.
// A violation => the message is rejected AND the author is suspended for
// SUSPENSION_HOURS (community + game access) so the consequence is real and
// immediate. Returns { ok: true } or { ok: false, category, reason }.
export const SUSPENSION_HOURS = 4;

// Collapse leet + spacing so "f u c k" / "sh1t" / "p.u.m.p" normalize.
const POLICY_LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's' };
function policyCollapse(text) {
  return String(text == null ? '' : text).toLowerCase().replace(/[013457 8@$]/g, c => (POLICY_LEET[c] !== undefined ? POLICY_LEET[c] : c)).replace(/[^a-z]/g, '');
}
function policyWords(text) {
  return String(text == null ? '' : text).toLowerCase().replace(/[013457 8@$]/g, c => (POLICY_LEET[c] !== undefined ? POLICY_LEET[c] : c)).replace(/[^a-z\s]+/g, ' ').split(/\s+/).filter(Boolean);
}

// 1) Crypto shilling / other coins / contract addresses.
const COIN_WORD = new Set([
  'memecoin', 'memecoins', 'shitcoin', 'altcoin', 'altcoins', 'presale', 'airdrop',
  'tokenomics', 'rugpull', 'degen', 'shill', 'shilling', 'pumpit', 'mooning',
]);
const COIN_PHRASES = [
  'buy my coin', 'buy this coin', 'my token', 'our token', 'new token', 'new coin',
  'contract address', 'pump and dump', 'to the moon', 'next 1000x', 'next 100x',
  '1000x gem', '100x gem', 'low cap gem', 'apein', 'aping in', 'dont miss out',
  'get in early', 'launching on pump', 'pumpfun', 'dexscreener', 'dextools',
];
// Solana-style base58 contract address (32-44 chars), or 0x EVM address.
const SOL_CA_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
const EVM_CA_RE = /\b0x[a-fA-F0-9]{40}\b/;
const TICKER_RE = /\$[A-Za-z]{2,15}\b/; // $DOGE, $WIF, etc. ($TINY-adjacent is fine to flag; team posts bypass screening)

// 2/3) Abuse, threats, slurs, foul language.
const ABUSE_WORDS = new Set([
  'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bullshit', 'bitch', 'cunt',
  'asshole', 'dickhead', 'bastard', 'retard', 'retarded', 'idiot', 'moron', 'stupid',
  'loser', 'pathetic', 'scum', 'trash', 'garbage', 'kys', 'nigger', 'nigga', 'faggot',
  'fag', 'kike', 'spic', 'chink', 'tranny', 'whore', 'slut', 'dumbass',
]);
const ABUSE_PHRASES = [
  'kill yourself', 'kill urself', 'you suck', 'u suck', 'shut up', 'shut the',
  'i hate you', 'i hate this', 'you are worthless', 'youre worthless', 'go die',
  'piece of shit', 'hate this game', 'this game sucks', 'worst game', 'this is garbage',
  'this is trash', 'you people', 'screw you', 'screw this',
];

// 4) Hostile negative sentiment: a negativity signal AND a target/insult signal.
const NEGATIVE_TOKENS = ['hate', 'awful', 'terrible', 'worst', 'sucks', 'suck', 'horrible', 'disgusting', 'pathetic', 'useless', 'garbage', 'trash', 'lame', 'boring', 'broken', 'scam', 'ripoff'];
const TARGET_TOKENS = ['you', 'youre', 'u', 'ur', 'this', 'game', 'everyone', 'devs', 'team', 'mods', 'admin', 'people'];

export function screenMessage(text) {
  const raw = String(text == null ? '' : text);
  const collapsed = policyCollapse(raw);
  const words = policyWords(raw);
  const wordSet = new Set(words);
  const lower = raw.toLowerCase();

  // 1) Coin / CA / shilling.
  if (SOL_CA_RE.test(raw) || EVM_CA_RE.test(raw)) {
    return { ok: false, category: 'crypto', reason: 'Posting contract addresses or promoting other coins is not allowed.' };
  }
  if (TICKER_RE.test(raw)) {
    return { ok: false, category: 'crypto', reason: 'Promoting or selling other coins / tickers is not allowed.' };
  }
  for (const w of COIN_WORD) if (wordSet.has(w) || collapsed.includes(w)) {
    return { ok: false, category: 'crypto', reason: 'Promoting or selling other coins / memecoins is not allowed.' };
  }
  for (const p of COIN_PHRASES) if (lower.includes(p) || collapsed.includes(p.replace(/[^a-z]/g, ''))) {
    return { ok: false, category: 'crypto', reason: 'Shilling other coins or projects is not allowed.' };
  }

  // 2/3) Abuse / foul language / slurs.
  for (const w of ABUSE_WORDS) if (wordSet.has(w) || collapsed.includes(w)) {
    return { ok: false, category: 'abuse', reason: 'Abusive or foul language is not allowed.' };
  }
  for (const p of ABUSE_PHRASES) if (lower.includes(p) || collapsed.includes(p.replace(/[^a-z]/g, ''))) {
    return { ok: false, category: 'abuse', reason: 'Abuse, threats, or harassment are not allowed.' };
  }

  // 4) Hostile negative sentiment (needs both a negativity word and a target).
  const hasNeg = NEGATIVE_TOKENS.some(t => wordSet.has(t));
  const hasTarget = TARGET_TOKENS.some(t => wordSet.has(t));
  if (hasNeg && hasTarget) {
    return { ok: false, category: 'negativity', reason: 'Hostile or negative attacks on people or the game are not allowed.' };
  }

  return { ok: true };
}

// The exact, user-facing policy text shown in the UI and on suspension so
// members always know the rule and the consequence.
export const POLICY_NOTICE = 'Community rules: no selling or promoting other coins / contract addresses, no abuse, no foul language, no hostile negativity. Breaking these suspends you for ' + SUSPENSION_HOURS + ' hours — including game access.';


// -------- webhook auth --------
export function webhookSecret() {
  return envValue('TINYWORLD_COMMUNITY_WEBHOOK_SECRET');
}

// Constant-time compare of two short strings.
export function safeEqual(a, b) {
  const left = Buffer.from(String(a == null ? '' : a), 'utf8');
  const right = Buffer.from(String(b == null ? '' : b), 'utf8');
  if (left.length !== right.length) return false;
  try { return timingSafeEqual(left, right); } catch (_) { return false; }
}

// Compute the hex HMAC-SHA256 of `rawBody` with the shared secret.
export function signBody(rawBody, secret) {
  return createHmac('sha256', String(secret || '')).update(String(rawBody || ''), 'utf8').digest('hex');
}

// Verify an inbound webhook request. Accepts either:
//   - HMAC: header `x-tinyworld-signature: sha256=<hexdigest of the raw body>`
//   - Shared bearer: header `x-webhook-secret: <secret>` (simpler for quick
//     setups; HMAC is preferred because it also authenticates the body).
// Returns { ok: true } or { ok: false, error, status }.
export function verifyWebhookAuth(headers, rawBody) {
  const secret = webhookSecret();
  if (!secret) return { ok: false, error: 'Webhook is not configured (set TINYWORLD_COMMUNITY_WEBHOOK_SECRET).', status: 503 };

  const sigHeader = String(headers.get('x-tinyworld-signature') || '').trim();
  if (sigHeader) {
    const provided = sigHeader.replace(/^sha256=/i, '').trim();
    const expected = signBody(rawBody, secret);
    return safeEqual(provided, expected)
      ? { ok: true, method: 'hmac' }
      : { ok: false, error: 'Invalid signature', status: 401 };
  }

  const bearer = String(headers.get('x-webhook-secret') || '').trim();
  if (bearer) {
    return safeEqual(bearer, secret) ? { ok: true, method: 'bearer' } : { ok: false, error: 'Invalid webhook secret', status: 401 };
  }

  return { ok: false, error: 'Missing webhook signature', status: 401 };
}

// -------- profile resolution --------
// Resolve a target member from a flexible selector object:
//   { profileId } | { username } | { displayName } | { wallet }  (any one)
// Returns the profile row or null.
export async function resolveProfile(sql, selector) {
  if (!selector || typeof selector !== 'object') return null;
  const id = Number(selector.profileId);
  if (Number.isInteger(id) && id > 0) {
    const rows = await sql`SELECT id, username, display_name, image FROM profiles WHERE id = ${id} LIMIT 1`;
    return rows[0] || null;
  }
  const username = String(selector.username || '').trim().toLowerCase();
  if (username) {
    const rows = await sql`SELECT id, username, display_name, image FROM profiles WHERE LOWER(username) = ${username} LIMIT 1`;
    if (rows.length) return rows[0];
  }
  const displayName = String(selector.displayName || '').trim().toLowerCase();
  if (displayName) {
    const rows = await sql`SELECT id, username, display_name, image FROM profiles WHERE LOWER(display_name) = ${displayName} ORDER BY id ASC LIMIT 1`;
    if (rows.length) return rows[0];
  }
  const wallet = String(selector.wallet || selector.publicKey || '').trim();
  if (wallet) {
    const rows = await sql`
      SELECT p.id, p.username, p.display_name, p.image
      FROM profiles p JOIN wallet_accounts wa ON wa.profile_id = p.id
      WHERE wa.public_key = ${wallet} LIMIT 1
    `;
    if (rows.length) return rows[0];
  }
  return null;
}

async function roomIdFromSelector(sql, selector) {
  if (selector == null) return null;
  // Accept a numeric id directly, or { roomId } / { roomSlug }.
  const direct = Number(selector);
  if (Number.isInteger(direct) && direct > 0) return direct;
  const id = Number(selector.roomId);
  if (Number.isInteger(id) && id > 0) return id;
  const slug = String(selector.roomSlug || selector.slug || '').trim().toLowerCase();
  if (slug) {
    const rows = await sql`SELECT id FROM community_rooms WHERE LOWER(slug) = ${slug} LIMIT 1`;
    if (rows.length) return rows[0].id;
  }
  return null;
}

// -------- moderation actions --------
// Each returns a small result object describing what happened. They throw on DB
// errors; the caller maps those to an HTTP response.

export async function banMember(sql, { target, roomId = null, durationHours = 0, reason = '', actorProfileId = null }) {
  const profile = await resolveProfile(sql, target);
  if (!profile) return { ok: false, error: 'Member not found' };
  const room = await roomIdFromSelector(sql, roomId);
  const expires = banExpiry(Date.now(), durationHours);
  const rows = await sql`
    INSERT INTO community_bans (room_id, profile_id, banned_by, reason, expires_at)
    VALUES (${room}, ${profile.id}, ${actorProfileId}, ${String(reason || '').slice(0, 200)}, ${expires})
    RETURNING id, room_id, profile_id, reason, expires_at, created_at
  `;
  return { ok: true, action: 'ban', profileId: profile.id, username: profile.username, roomId: room, expiresAt: expires, ban: rows[0] };
}

export async function unbanMember(sql, { target, roomId = null }) {
  const profile = await resolveProfile(sql, target);
  if (!profile) return { ok: false, error: 'Member not found' };
  const room = await roomIdFromSelector(sql, roomId);
  await sql`
    DELETE FROM community_bans
    WHERE profile_id = ${profile.id} AND (room_id IS NOT DISTINCT FROM ${room})
  `;
  return { ok: true, action: 'unban', profileId: profile.id, username: profile.username, roomId: room };
}

// Agent-side block: hide `blocked` from `blocker`. When no blocker is given the
// super-owner (or any staff) profile id should be passed by the caller.
export async function blockMember(sql, { blocker, blocked }) {
  const a = await resolveProfile(sql, blocker);
  const b = await resolveProfile(sql, blocked);
  if (!a || !b) return { ok: false, error: 'Member not found' };
  if (a.id === b.id) return { ok: false, error: 'Cannot block self' };
  await sql`
    INSERT INTO community_blocks (blocker_profile_id, blocked_profile_id)
    VALUES (${a.id}, ${b.id})
    ON CONFLICT (blocker_profile_id, blocked_profile_id) DO NOTHING
  `;
  return { ok: true, action: 'block', blockerId: a.id, blockedId: b.id };
}

export async function deleteMessage(sql, { messageId }) {
  const id = Number(messageId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Invalid messageId' };
  const rows = await sql`DELETE FROM community_messages WHERE id = ${id} RETURNING id, author_profile_id, room_id, dm_key`;
  if (!rows.length) return { ok: false, error: 'Message not found' };
  return { ok: true, action: 'deleteMessage', messageId: id, deleted: rows[0] };
}

export async function hideMessage(sql, { messageId, actorProfileId = null, reason = '' }) {
  const id = Number(messageId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Invalid messageId' };
  const rows = await sql`
    UPDATE community_messages
    SET hidden_at = COALESCE(hidden_at, NOW()),
        hidden_by = ${actorProfileId},
        hidden_reason = ${String(reason || '').slice(0, 200)}
    WHERE id = ${id}
    RETURNING id, author_profile_id, room_id, dm_key, hidden_at, hidden_by, hidden_reason
  `;
  if (!rows.length) return { ok: false, error: 'Message not found' };
  return { ok: true, action: 'hideMessage', messageId: id, hidden: rows[0] };
}

export async function unhideMessage(sql, { messageId }) {
  const id = Number(messageId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Invalid messageId' };
  const rows = await sql`
    UPDATE community_messages
    SET hidden_at = NULL,
        hidden_by = NULL,
        hidden_reason = ''
    WHERE id = ${id}
    RETURNING id, author_profile_id, room_id, dm_key
  `;
  if (!rows.length) return { ok: false, error: 'Message not found' };
  return { ok: true, action: 'unhideMessage', messageId: id, restored: rows[0] };
}

// Bulk-purge a member's recent messages (spam cleanup). `limit` caps how many.
export async function purgeMemberMessages(sql, { target, roomId = null, limit = 50 }) {
  const profile = await resolveProfile(sql, target);
  if (!profile) return { ok: false, error: 'Member not found' };
  const room = await roomIdFromSelector(sql, roomId);
  const cap = Math.max(1, Math.min(500, Number(limit) || 50));
  const rows = await sql`
    DELETE FROM community_messages
    WHERE id IN (
      SELECT id FROM community_messages
      WHERE author_profile_id = ${profile.id}
        AND (${room == null ? sql`TRUE` : sql`room_id = ${room}`})
      ORDER BY id DESC
      LIMIT ${cap}
    )
    RETURNING id
  `;
  return { ok: true, action: 'purgeMessages', profileId: profile.id, roomId: room, deletedCount: rows.length };
}

export async function deleteRoom(sql, { roomId }) {
  const room = await roomIdFromSelector(sql, roomId);
  if (!room) return { ok: false, error: 'Room not found' };
  const rows = await sql`DELETE FROM community_rooms WHERE id = ${room} RETURNING id, slug, name`;
  if (!rows.length) return { ok: false, error: 'Room not found' };
  return { ok: true, action: 'deleteRoom', room: rows[0] };
}

// -------- suspensions (community + game access) --------
// A suspension blocks BOTH community posting and game/world access until it
// expires. Used by the content-policy enforcer and callable by the agent.
export async function ensureSuspensionTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS community_suspensions (
      id          SERIAL PRIMARY KEY,
      profile_id  INT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      reason      TEXT NOT NULL DEFAULT '',
      category    TEXT NOT NULL DEFAULT '',
      created_by  INT REFERENCES profiles(id) ON DELETE SET NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS community_suspensions_active_idx ON community_suspensions (profile_id, expires_at)`;
}

// Returns the active suspension row for a profile, or null. Safe if the table
// doesn't exist yet (returns null) so it can be called from the game path.
export async function activeSuspension(sql, profileId) {
  try {
    const rows = await sql`
      SELECT id, reason, category, expires_at
      FROM community_suspensions
      WHERE profile_id = ${profileId} AND expires_at > NOW()
      ORDER BY expires_at DESC
      LIMIT 1
    `;
    return rows[0] || null;
  } catch (_) {
    return null;
  }
}

// Create a suspension lasting `hours` (default SUSPENSION_HOURS). Returns the row.
export async function suspendMember(sql, { profileId, hours = SUSPENSION_HOURS, reason = '', category = '', actorProfileId = null }) {
  await ensureSuspensionTable(sql);
  const expires = banExpiry(Date.now(), hours) || new Date(Date.now() + SUSPENSION_HOURS * 3600 * 1000);
  const rows = await sql`
    INSERT INTO community_suspensions (profile_id, reason, category, created_by, expires_at)
    VALUES (${profileId}, ${String(reason || '').slice(0, 300)}, ${String(category || '').slice(0, 40)}, ${actorProfileId}, ${expires})
    RETURNING id, profile_id, reason, category, expires_at, created_at
  `;
  return rows[0];
}

// Lift all active suspensions for a profile (agent/admin action).
export async function unsuspendMember(sql, { target }) {
  const profile = await resolveProfile(sql, target);
  if (!profile) return { ok: false, error: 'Member not found' };
  await sql`UPDATE community_suspensions SET expires_at = NOW() WHERE profile_id = ${profile.id} AND expires_at > NOW()`;
  return { ok: true, action: 'unsuspend', profileId: profile.id, username: profile.username };
}


// -------- outbound: notify Hermes of community events --------
// Fire-and-forget POST to the configured Hermes webhook URL. Never throws — a
// down webhook must not break the user-facing request. Signs the body with the
// same secret so Hermes can verify authenticity.
export async function emitCommunityEvent(event, payload) {
  const url = envValue('HERMES_COMMUNITY_WEBHOOK_URL') || envValue('TINYWORLD_COMMUNITY_EVENT_URL');
  if (!url) return { ok: false, skipped: 'no-url' };
  const body = JSON.stringify({
    source: 'tinyworld-community',
    event,
    sentAt: new Date().toISOString(),
    data: payload || {},
  });
  const headers = { 'Content-Type': 'application/json' };
  const secret = webhookSecret();
  if (secret) headers['x-tinyworld-signature'] = 'sha256=' + signBody(body, secret);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: (err && err.message) || 'emit failed' };
  }
}
