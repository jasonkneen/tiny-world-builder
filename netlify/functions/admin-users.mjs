import { requireAuthUser } from './lib/auth.mjs';
import { admin as identityAdmin } from '@netlify/identity';
import { getSql, isDatabaseUnavailable } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse, readJson, sameOriginWriteGuard } from './lib/http.mjs';
import { ensureProfile, normalizeProfileHandle, normalizeProfileImageUrl, normalizeUsername, profileDto } from './lib/profiles.mjs';
import { isWorldAdminEmail, worldAdminEmails } from './lib/worlds.mjs';
import { isTinyverseAccessEmail, tinyverseAccessEmails } from './lib/tinyverse-access.mjs';

export const config = { path: '/api/admin-users' };

function cleanText(value, limit) {
  return String(value == null ? '' : value).trim().slice(0, limit);
}

function cleanEmail(value) {
  return String(value == null ? '' : value).trim().toLowerCase().slice(0, 254);
}

function cleanProfileId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function looksLikeIdentityUserId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function cleanChoice(value, allowed, fallback) {
  const v = String(value || '').trim().toLowerCase();
  return allowed.includes(v) ? v : fallback;
}

function sinceIso(days) {
  if (!days) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function adminEmailsArray() {
  return Array.from(worldAdminEmails()).map(e => String(e || '').trim().toLowerCase()).filter(Boolean);
}

function tinyverseAccessEmailsArray() {
  return Array.from(tinyverseAccessEmails()).map(e => String(e || '').trim().toLowerCase()).filter(Boolean);
}

export function canAccessTinyverse(user) {
  if (!user || !user.id) return false;
  // Authorize on the VERIFIED auth-provider email ONLY — never the user-editable
  // profiles.email (a wallet user can set that to anything via /api/profile, which
  // would let them self-grant access). See plans/production-line/SECURITY-NOTES.md.
  const verifiedEmail = cleanEmail(user.email || '');
  return isTinyverseAccessEmail(verifiedEmail) || isWorldAdminEmail(verifiedEmail);
}

function adminUserDto(row) {
  const dto = profileDto(row);
  if (!dto) return null;
  dto.lobbyAccess = isTinyverseAccessEmail(row.email);
  dto.builtInAccess = isTinyverseAccessEmail(row.email);
  dto.legacyLobbyFlag = !!row.lobby_access;
  dto.lastSeenAt = row.last_seen_at || null;
  dto.totalCount = Number(row.total_count) || 0;
  return dto;
}

function validateAdminEdit(body) {
  const id = cleanProfileId(body && body.id);
  if (!id) return { error: 'Valid user id required' };
  const username = normalizeUsername(body && body.username);
  const displayName = cleanText(body && body.displayName, 80);
  const about = cleanText(body && body.about, 1000);
  const image = normalizeProfileImageUrl(body && body.image);
  const email = cleanEmail(body && body.email);
  const twitter = normalizeProfileHandle(body && body.twitter);
  const github = normalizeProfileHandle(body && body.github);
  const lobbyAccess = isTinyverseAccessEmail(email);
  if (!/^[a-z0-9_]{3,24}$/.test(username)) return { error: 'Username must be 3-24 lowercase letters, numbers, underscores' };
  if (!displayName) return { error: 'Display name required' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Email is invalid' };
  if (image && !/^https:\/\/[^\s]+$/i.test(image) && !/^http:\/\/localhost(:\d+)?\//i.test(image)) {
    return { error: 'Image must be an https URL' };
  }
  return { id, username, displayName, about, image, email, twitter, github, lobbyAccess };
}

async function netlifyIdentityAdminToken() {
  const token = String(process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_ACCESS_TOKEN || '').trim();
  const siteId = String(process.env.NETLIFY_SITE_ID || process.env.SITE_ID || '').trim();
  if (!token || !siteId) return null;
  return { token, siteId };
}

async function triggerIdentityPasswordReset(email) {
  const auth = await netlifyIdentityAdminToken();
  if (!email) return { sent: false, reason: 'missing_email' };
  if (!auth) {
    try {
      const res = await fetch('/.netlify/identity/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) return { sent: true };
      return { sent: false, reason: 'identity_' + res.status };
    } catch (_) {
      return { sent: false, reason: 'not_configured' };
    }
  }
  try {
    const endpoint = 'https://api.netlify.com/api/v1/sites/' + encodeURIComponent(auth.siteId) + '/identity/recover';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + auth.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    if (res.ok) return { sent: true };
    return { sent: false, reason: 'identity_' + res.status };
  } catch (_) {
    return { sent: false, reason: 'network' };
  }
}

async function confirmIdentityEmailUser(userId) {
  const id = String(userId || '').trim();
  if (!looksLikeIdentityUserId(id)) return { confirmed: false, reason: 'not_identity_user' };
  try {
    await identityAdmin.updateUser(id, { confirm: true });
    return { confirmed: true };
  } catch (err) {
    return { confirmed: false, reason: (err && err.message) || 'identity_confirm_failed' };
  }
}

async function confirmAllIdentityEmailUsers() {
  const perPage = 200;
  const result = { scanned: 0, confirmed: 0, skipped: 0, errors: [] };
  for (let page = 1; page <= 100; page++) {
    const users = await identityAdmin.listUsers({ page, perPage });
    if (!users.length) break;
    for (const identityUser of users) {
      result.scanned++;
      if (!identityUser || !identityUser.id || !String(identityUser.email || '').trim()) {
        result.skipped++;
        continue;
      }
      if (identityUser.confirmedAt) {
        result.skipped++;
        continue;
      }
      const confirmed = await confirmIdentityEmailUser(identityUser.id);
      if (confirmed.confirmed) result.confirmed++;
      else {
        result.skipped++;
        result.errors.push({ id: identityUser.id, email: identityUser.email || '', reason: confirmed.reason });
      }
    }
    if (users.length < perPage) break;
  }
  result.errors = result.errors.slice(0, 20);
  return result;
}

export default async function adminUsersFunction(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);

  const auth = await requireAuthUser(request, origin);
  if (auth.response) return auth.response;
  const user = auth.user;

  try {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.searchParams.get('action') === 'tinyverse-access') {
      try {
        const profile = await ensureProfile(user);
        return jsonResponse({ allowed: canAccessTinyverse(user), admin: isWorldAdminEmail(user && user.email) }, origin);
      } catch (err) {
        if (isDatabaseUnavailable(err)) {
          const allowed = canAccessTinyverse(user);
          return jsonResponse({ allowed, admin: isWorldAdminEmail(user && user.email) }, origin);
        }
        return jsonResponse({ allowed: false }, origin);
      }
    }

    await ensureProfile(user);
    if (!isWorldAdminEmail(user && user.email)) return errorResponse('Forbidden', 403, origin);

    const sql = getSql();
    if (request.method === 'GET') {
      const q = cleanText(url.searchParams.get('q') || '', 80).toLowerCase();
      const like = '%' + q + '%';
      const limit = clampInt(url.searchParams.get('limit'), 250, 25, 500);
      const offset = clampInt(url.searchParams.get('offset'), 0, 0, 1000000);
      const flag = cleanChoice(url.searchParams.get('flag'), ['all', 'tinyverse', 'no-access', 'legacy-flag', 'profile-incomplete', 'missing-email', 'missing-socials', 'reset', 'archived', 'wallet'], 'all');
      const created = cleanChoice(url.searchParams.get('created'), ['all', 'today', '7d', '30d', '90d'], 'all');
      const seen = cleanChoice(url.searchParams.get('seen'), ['all', 'online', '24h', '7d', '30d', 'never'], 'all');
      const sort = cleanChoice(url.searchParams.get('sort'), ['updated_desc', 'created_desc', 'created_asc', 'seen_desc', 'email_asc', 'username_asc'], 'updated_desc');
      const createdSince = created === 'today' ? sinceIso(1)
        : created === '7d' ? sinceIso(7)
        : created === '30d' ? sinceIso(30)
        : created === '90d' ? sinceIso(90)
        : null;
      const seenSince = seen === 'online' ? sinceIso(5 / (24 * 60))
        : seen === '24h' ? sinceIso(1)
        : seen === '7d' ? sinceIso(7)
        : seen === '30d' ? sinceIso(30)
        : null;
      const accessEmails = tinyverseAccessEmailsArray();
      const accessEmailList = accessEmails.length ? accessEmails : ['__tinyworld_no_access_email__'];
      const rows = await sql`
        WITH filtered AS (
          SELECT p.id, p.auth0_id, p.email, p.username, p.display_name, p.about, p.image,
                 p.twitter, p.github, p.lobby_access, p.password_reset_requested_at,
                 p.archived_at, p.merged_into_profile_id, p.created_at, p.updated_at,
                 pr.last_seen_at
          FROM profiles p
          LEFT JOIN player_presence pr ON pr.profile_id = p.id
          WHERE (${q} = ''
             OR LOWER(p.username) LIKE ${like}
             OR LOWER(p.display_name) LIKE ${like}
             OR LOWER(p.email) LIKE ${like}
             OR LOWER(p.twitter) LIKE ${like}
             OR LOWER(p.github) LIKE ${like}
             OR LOWER(p.auth0_id) LIKE ${like})
            AND (${createdSince}::timestamptz IS NULL OR p.created_at >= ${createdSince}::timestamptz)
            AND (${seen} <> 'never' OR pr.last_seen_at IS NULL)
            AND (${seen} = 'never' OR ${seenSince}::timestamptz IS NULL OR pr.last_seen_at >= ${seenSince}::timestamptz)
            AND (${flag} = 'all'
              OR (${flag} = 'tinyverse' AND LOWER(COALESCE(p.email, '')) IN ${sql(accessEmailList)})
              OR (${flag} = 'no-access' AND NOT (LOWER(COALESCE(p.email, '')) IN ${sql(accessEmailList)}))
              OR (${flag} = 'legacy-flag' AND p.lobby_access = TRUE)
              OR (${flag} = 'profile-incomplete' AND (
                COALESCE(NULLIF(TRIM(p.email), ''), '') = ''
                OR COALESCE(NULLIF(TRIM(p.display_name), ''), '') = ''
                OR COALESCE(NULLIF(TRIM(p.twitter), ''), '') = ''
                OR COALESCE(NULLIF(TRIM(p.github), ''), '') = ''
              ))
              OR (${flag} = 'missing-email' AND COALESCE(NULLIF(TRIM(p.email), ''), '') = '')
              OR (${flag} = 'missing-socials' AND (
                COALESCE(NULLIF(TRIM(p.twitter), ''), '') = ''
                OR COALESCE(NULLIF(TRIM(p.github), ''), '') = ''
              ))
              OR (${flag} = 'reset' AND p.password_reset_requested_at IS NOT NULL)
              OR (${flag} = 'archived' AND (p.archived_at IS NOT NULL OR p.merged_into_profile_id IS NOT NULL))
              OR (${flag} = 'wallet' AND (COALESCE(NULLIF(TRIM(p.email), ''), '') = '' OR LOWER(p.auth0_id) LIKE 'wallet%'))
            )
        )
        SELECT *, COUNT(*) OVER() AS total_count
        FROM filtered
        ORDER BY
          CASE WHEN ${sort} = 'created_desc' THEN created_at END DESC NULLS LAST,
          CASE WHEN ${sort} = 'created_asc' THEN created_at END ASC NULLS LAST,
          CASE WHEN ${sort} = 'seen_desc' THEN last_seen_at END DESC NULLS LAST,
          CASE WHEN ${sort} = 'email_asc' THEN LOWER(email) END ASC NULLS LAST,
          CASE WHEN ${sort} = 'username_asc' THEN LOWER(username) END ASC NULLS LAST,
          updated_at DESC NULLS LAST,
          id DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
      const users = rows.map(adminUserDto);
      const total = rows.length ? users[0].totalCount : 0;
      return jsonResponse({ users, total, limit, offset, adminEmails: adminEmailsArray(), tinyverseAccessEmails: accessEmails }, origin);
    }

    if (request.method === 'PUT') {
      if (!sameOriginWriteGuard(request)) return errorResponse('Forbidden', 403, origin);
      const body = await readJson(request, 64 * 1024);
      const input = validateAdminEdit(body);
      if (input.error) return errorResponse(input.error, 400, origin);
      const rows = await sql`
        UPDATE profiles
        SET email = ${input.email},
            username = ${input.username},
            display_name = ${input.displayName},
            about = ${input.about},
            image = ${input.image},
            twitter = ${input.twitter},
            github = ${input.github},
            lobby_access = ${input.lobbyAccess},
            updated_at = NOW()
        WHERE id = ${input.id}
        RETURNING id, auth0_id, email, username, display_name, about, image, twitter, github, lobby_access, password_reset_requested_at, created_at, updated_at
      `;
      if (!rows.length) return errorResponse('User not found', 404, origin);
      return jsonResponse({ user: adminUserDto(rows[0]) }, origin);
    }

    if (request.method === 'POST') {
      if (!sameOriginWriteGuard(request)) return errorResponse('Forbidden', 403, origin);
      const body = await readJson(request, 64 * 1024);
      if (!body || !body.action) return errorResponse('Unknown action', 400, origin);
      if (body.action === 'confirmAllEmails') {
        const confirm = await confirmAllIdentityEmailUsers();
        return jsonResponse({ confirm }, origin);
      }
      if (body.action === 'confirmEmail') {
        const id = cleanProfileId(body.id);
        if (!id) return errorResponse('Valid user id required', 400, origin);
        const rows = await sql`
          SELECT id, auth0_id, email, username, display_name, about, image, twitter, github, lobby_access, password_reset_requested_at, created_at, updated_at
          FROM profiles
          WHERE id = ${id}
          LIMIT 1
        `;
        if (!rows.length) return errorResponse('User not found', 404, origin);
        const confirm = await confirmIdentityEmailUser(rows[0].auth0_id);
        return jsonResponse({ user: adminUserDto(rows[0]), confirm }, origin);
      }
      if (body.action !== 'resetPassword') return errorResponse('Unknown action', 400, origin);
      const id = cleanProfileId(body.id);
      if (!id) return errorResponse('Valid user id required', 400, origin);
      const rows = await sql`
        SELECT id, auth0_id, email, username, display_name, about, image, twitter, github, lobby_access, password_reset_requested_at, created_at, updated_at
        FROM profiles
        WHERE id = ${id}
        LIMIT 1
      `;
      if (!rows.length) return errorResponse('User not found', 404, origin);
      const email = cleanEmail(rows[0].email);
      if (!email) return errorResponse('User has no email address', 400, origin);
      const reset = await triggerIdentityPasswordReset(email);
      const updated = await sql`
        UPDATE profiles
        SET password_reset_requested_at = NOW(), updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, auth0_id, email, username, display_name, about, image, twitter, github, lobby_access, password_reset_requested_at, created_at, updated_at
      `;
      return jsonResponse({ user: adminUserDto(updated[0]), reset }, origin);
    }

    return errorResponse('Method not allowed', 405, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err)) return errorResponse('Netlify Database is not available in this local session.', 503, origin);
    if (err && err.code === '23505') return errorResponse('Username or email is already taken', 409, origin);
    console.error('[admin-users]', err);
    return errorResponse('Admin users request failed', 500, origin);
  }
}
