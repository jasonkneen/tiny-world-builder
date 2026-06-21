import { requireAuthUser } from './lib/auth.mjs';
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

function adminEmailsArray() {
  return Array.from(worldAdminEmails()).map(e => String(e || '').trim().toLowerCase()).filter(Boolean);
}

function tinyverseAccessEmailsArray() {
  return Array.from(tinyverseAccessEmails()).map(e => String(e || '').trim().toLowerCase()).filter(Boolean);
}

export function canAccessTinyverse(user, profile) {
  if (!user || !user.id) return false;
  const email = cleanEmail(user.email || (profile && profile.email) || '');
  return isTinyverseAccessEmail(email);
}

function adminUserDto(row) {
  const dto = profileDto(row);
  if (!dto) return null;
  dto.lobbyAccess = isTinyverseAccessEmail(row.email);
  dto.builtInAccess = isTinyverseAccessEmail(row.email);
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
        return jsonResponse({ allowed: canAccessTinyverse(user, profile), admin: isWorldAdminEmail(user && user.email) }, origin);
      } catch (err) {
        if (isDatabaseUnavailable(err)) {
          const allowed = isTinyverseAccessEmail(user && user.email);
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
      const rows = q
        ? await sql`
            SELECT id, auth0_id, email, username, display_name, about, image, twitter, github, lobby_access, password_reset_requested_at, created_at, updated_at
            FROM profiles
            WHERE LOWER(username) LIKE ${like}
               OR LOWER(display_name) LIKE ${like}
               OR LOWER(email) LIKE ${like}
               OR LOWER(twitter) LIKE ${like}
               OR LOWER(github) LIKE ${like}
               OR LOWER(auth0_id) LIKE ${like}
            ORDER BY updated_at DESC, id DESC
            LIMIT 100
          `
        : await sql`
            SELECT id, auth0_id, email, username, display_name, about, image, twitter, github, lobby_access, password_reset_requested_at, created_at, updated_at
            FROM profiles
            ORDER BY updated_at DESC, id DESC
            LIMIT 100
          `;
      return jsonResponse({ users: rows.map(adminUserDto), adminEmails: adminEmailsArray(), tinyverseAccessEmails: tinyverseAccessEmailsArray() }, origin);
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
      if (!body || body.action !== 'resetPassword') return errorResponse('Unknown action', 400, origin);
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
