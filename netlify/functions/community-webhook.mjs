// Community moderation webhook — server-to-server endpoint for the Hermes agent.
//
// Authenticated by a shared secret (HMAC-SHA256 of the raw body in
// `x-tinyworld-signature: sha256=<hex>`, or `x-webhook-secret: <secret>`), NOT by
// a logged-in user. This lets an autonomous moderation agent ban, unban, block,
// delete messages, purge spam, and delete rooms.
//
// POST /api/community/webhook
//   { "action": "ban", "target": { "username": "spammer" }, "durationHours": 24,
//     "reason": "spam", "roomId": { "slug": "general" } }
//
// GET /api/community/webhook?resource=context  -> recent messages + members so
//   the agent has material to reason over. (Also requires the webhook secret.)
//
// Supported actions: ban, unban, block, hideMessage, unhideMessage,
// deleteMessage, purgeMessages, deleteRoom, ping.

import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse } from './lib/http.mjs';
import {
  verifyWebhookAuth,
  resolveProfile,
  banMember,
  unbanMember,
  blockMember,
  hideMessage,
  unhideMessage,
  deleteMessage,
  purgeMemberMessages,
  deleteRoom,
  suspendMember,
  unsuspendMember,
  SUSPENSION_HOURS,
} from './lib/community-moderation.mjs';

export const config = { path: '/api/community/webhook' };

const COMMUNITY_RELATIONS = [
  'community_rooms', 'community_memberships', 'community_messages',
  'community_bans', 'community_blocks', 'community_invites',
];

function envValue(name) {
  try {
    if (globalThis.Netlify && Netlify.env && typeof Netlify.env.get === 'function') {
      const value = Netlify.env.get(name);
      if (value) return value;
    }
  } catch (_) {}
  return process.env[name] || '';
}

// Resolve the acting moderator profile id used for ban attribution and as the
// blocker for block actions. Defaults to the configured super-owner.
async function moderatorProfileId(sql) {
  const uname = (envValue('TINYWORLD_COMMUNITY_OWNER') || 'jasonkneen').toLowerCase();
  const rows = await sql`
    SELECT id FROM profiles WHERE LOWER(username) = ${uname} OR LOWER(display_name) = ${uname}
    ORDER BY id ASC LIMIT 1
  `;
  return rows.length ? rows[0].id : null;
}

// Recent context for the agent to reason over.
async function buildContext(sql, url) {
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit')) || 50));
  const roomSlug = String(url.searchParams.get('roomSlug') || '').trim().toLowerCase();
  let roomId = null;
  if (roomSlug) {
    const r = await sql`SELECT id FROM community_rooms WHERE LOWER(slug) = ${roomSlug} LIMIT 1`;
    roomId = r.length ? r[0].id : -1; // -1 => no match, returns empty set
  }
  const messages = await sql`
    SELECT m.id, m.room_id, m.dm_key, m.body, m.created_at,
           p.id AS author_id, p.username AS author_username, p.display_name AS author_display_name
    FROM community_messages m
    JOIN profiles p ON p.id = m.author_profile_id
    WHERE m.dm_key IS NULL
      AND (${roomId == null ? sql`TRUE` : sql`m.room_id = ${roomId}`})
    ORDER BY m.id DESC
    LIMIT ${limit}
  `;
  const rooms = await sql`SELECT id, slug, name, is_private FROM community_rooms ORDER BY created_at ASC LIMIT 200`;
  const activeBans = await sql`
    SELECT b.id, b.room_id, b.profile_id, p.username, b.reason, b.expires_at
    FROM community_bans b JOIN profiles p ON p.id = b.profile_id
    WHERE b.expires_at IS NULL OR b.expires_at > NOW()
    ORDER BY b.created_at DESC LIMIT 200
  `;
  return {
    rooms: rooms.map(r => ({ id: r.id, slug: r.slug, name: r.name, isPrivate: !!r.is_private })),
    messages: messages.reverse().map(m => ({
      id: m.id, roomId: m.room_id, body: m.body, createdAt: m.created_at,
      author: { id: m.author_id, username: m.author_username, displayName: m.author_display_name },
    })),
    activeBans: activeBans.map(b => ({
      id: b.id, roomId: b.room_id, profileId: b.profile_id, username: b.username,
      reason: b.reason, expiresAt: b.expires_at,
    })),
  };
}

async function dispatchAction(sql, action, body) {
  switch (action) {
    case 'ping':
      return { ok: true, action: 'ping', pong: true };

    case 'ban':
      return banMember(sql, {
        target: body.target,
        roomId: body.roomId ?? null,
        durationHours: body.durationHours,
        reason: body.reason,
        actorProfileId: await moderatorProfileId(sql),
      });

    case 'unban':
      return unbanMember(sql, { target: body.target, roomId: body.roomId ?? null });

    case 'block': {
      // Default blocker is the moderator/super-owner unless one is named.
      const blocker = body.blocker || { profileId: await moderatorProfileId(sql) };
      return blockMember(sql, { blocker, blocked: body.target || body.blocked });
    }

    case 'hideMessage':
      return hideMessage(sql, {
        messageId: body.messageId,
        actorProfileId: await moderatorProfileId(sql),
        reason: body.reason || '',
      });

    case 'unhideMessage':
    case 'restoreMessage':
      return unhideMessage(sql, { messageId: body.messageId });

    case 'deleteMessage':
      return deleteMessage(sql, { messageId: body.messageId });

    case 'purgeMessages':
      return purgeMemberMessages(sql, { target: body.target, roomId: body.roomId ?? null, limit: body.limit });

    case 'deleteRoom':
      return deleteRoom(sql, { roomId: body.roomId });

    case 'suspend': {
      const target = await resolveProfile(sql, body.target);
      if (!target) return { ok: false, error: 'Member not found', status: 404 };
      const row = await suspendMember(sql, {
        profileId: target.id,
        hours: Number(body.hours) || SUSPENSION_HOURS,
        reason: body.reason || '',
        category: body.category || 'manual',
        actorProfileId: await moderatorProfileId(sql),
      });
      return { ok: true, action: 'suspend', profileId: target.id, username: target.username, expiresAt: row.expires_at };
    }

    case 'unsuspend':
      return unsuspendMember(sql, { target: body.target });

    default:
      return { ok: false, error: 'Unknown action: ' + action, status: 400 };
  }
}

export default async function communityWebhookFunction(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);

  // Read the raw body once so HMAC verification sees exactly what was sent.
  let rawBody = '';
  if (request.method === 'POST') {
    try { rawBody = await request.text(); } catch (_) { rawBody = ''; }
  }

  const authResult = verifyWebhookAuth(request.headers, rawBody);
  if (!authResult.ok) return errorResponse(authResult.error, authResult.status || 401, origin);

  try {
    const sql = getSql();
    const url = new URL(request.url);

    if (request.method === 'GET') {
      const resource = url.searchParams.get('resource') || 'context';
      if (resource === 'context') return jsonResponse(await buildContext(sql, url), origin);
      return errorResponse('Unknown resource', 400, origin);
    }

    if (request.method !== 'POST') return errorResponse('Method not allowed', 405, origin);

    let body = null;
    try { body = rawBody ? JSON.parse(rawBody) : {}; } catch (_) { return errorResponse('Invalid JSON body', 400, origin); }

    // A single action, or a batch of actions executed in order.
    const actions = Array.isArray(body && body.actions) ? body.actions : null;
    if (actions) {
      const results = [];
      for (const item of actions.slice(0, 50)) {
        const a = String(item && item.action || '').trim();
        try { results.push(await dispatchAction(sql, a, item || {})); }
        catch (err) { results.push({ ok: false, action: a, error: (err && err.message) || 'failed' }); }
      }
      return jsonResponse({ ok: true, results }, origin);
    }

    const action = String(body && body.action || '').trim();
    if (!action) return errorResponse('action is required', 400, origin);
    const result = await dispatchAction(sql, action, body || {});
    if (result && result.ok === false) return errorResponse(result.error || 'Action failed', result.status || 400, origin);
    return jsonResponse(result, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err)) return errorResponse('Netlify Database is not available in this session.', 503, origin);
    if (isMissingRelations(err, COMMUNITY_RELATIONS)) {
      return errorResponse('Community tables are missing. Open /community once to initialise them.', 503, origin);
    }
    console.error('[community-webhook]', err);
    return errorResponse('Webhook request failed', 500, origin);
  }
}
