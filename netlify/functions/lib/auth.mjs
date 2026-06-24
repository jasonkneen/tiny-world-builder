import { createHmac, timingSafeEqual } from 'node:crypto';
import { getUser } from '@netlify/identity';
import { errorResponse } from './http.mjs';

const WALLET_TOKEN_PREFIX = 'tw-wallet-v1';
const WALLET_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const WALLET_LOGIN_CHALLENGE_TTL_SECONDS = 10 * 60;

function bearerToken(request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function envValue(name) {
  try {
    if (globalThis.Netlify && Netlify.env && typeof Netlify.env.get === 'function') {
      const value = Netlify.env.get(name);
      if (value) return value;
    }
  } catch (_) {}
  return process.env[name] || '';
}

function walletAuthSecret() {
  return envValue('TINYWORLD_WALLET_SESSION_SECRET') || envValue('TINYWORLD_AUTH_SECRET');
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function fromBase64UrlJson(value) {
  try {
    return JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'));
  } catch (_) {
    return null;
  }
}

function signWalletPart(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function createWalletSignedToken(payload) {
  const secret = walletAuthSecret();
  if (!secret) throw new Error('Wallet login is not configured. Set TINYWORLD_WALLET_SESSION_SECRET.');
  const encoded = base64UrlJson(payload);
  const signature = signWalletPart(encoded, secret);
  return [WALLET_TOKEN_PREFIX, encoded, signature].join('.');
}

function readWalletSignedToken(token, expectedType) {
  const text = String(token || '');
  const parts = text.split('.');
  if (parts.length !== 3 || parts[0] !== WALLET_TOKEN_PREFIX) return null;
  const secret = walletAuthSecret();
  if (!secret) return null;
  const expectedSignature = signWalletPart(parts[1], secret);
  if (!constantTimeEqual(parts[2], expectedSignature)) return null;
  const payload = fromBase64UrlJson(parts[1]);
  if (!payload || typeof payload !== 'object') return null;
  if (expectedType && payload.typ !== expectedType) return null;
  const exp = Number(payload.exp) || 0;
  if (!exp || exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function looksLikeSolanaPublicKey(value) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(value || ''));
}

function shortWalletAddress(publicKey) {
  const text = String(publicKey || '');
  if (text.length <= 14) return text || 'Wallet';
  return text.slice(0, 6) + '...' + text.slice(-6);
}

function walletUsername(publicKey) {
  const suffix = String(publicKey || '').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(-12) || 'builder';
  return ('wallet_' + suffix).slice(0, 24);
}

function userFromIdentityPayload(payload) {
  if (!payload || typeof payload !== 'object' || !payload.id) return null;
  const userMetadata = payload.user_metadata || payload.userMetadata || {};
  const appMetadata = payload.app_metadata || payload.appMetadata || {};
  return {
    id: payload.id,
    email: payload.email,
    // GoTrue returns confirmed_at (snake_case); normalize to confirmedAt so this
    // bearer-fallback path matches the @netlify/identity getUser() shape that
    // accountMeetsCriteria() reads.
    confirmedAt: payload.confirmed_at || payload.confirmedAt || null,
    name: userMetadata.full_name || userMetadata.name || payload.email,
    pictureUrl: userMetadata.avatar_url || userMetadata.picture,
    userMetadata,
    appMetadata,
  };
}

async function userFromBearerTokenValue(token) {
  if (!token) return null;
  // Resolve the identity verify host from trusted deploy config rather than the
  // incoming request URL so the validation target can never come from request
  // data. Fail closed when the site URL is unset.
  const identityBase = process.env.TINYWORLD_SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL;
  if (!identityBase) return null;
  try {
    const identityUrl = new URL('/.netlify/identity/user', identityBase);
    const res = await fetch(identityUrl, {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) return null;
    return userFromIdentityPayload(await res.json());
  } catch (_) {
    return null;
  }
}

function userFromWalletSessionToken(token) {
  const payload = readWalletSignedToken(token, 'tinyworld-wallet-session');
  const publicKey = payload && String(payload.publicKey || '').trim();
  if (!looksLikeSolanaPublicKey(publicKey)) return null;
  if (payload.sub !== 'wallet:' + publicKey) return null;
  return walletUserFromPublicKey(publicKey);
}

export function walletSessionAuthConfigured() {
  return !!walletAuthSecret();
}

export function walletUserFromPublicKey(publicKey) {
  const key = String(publicKey || '').trim();
  if (!looksLikeSolanaPublicKey(key)) return null;
  const displayName = 'Wallet ' + shortWalletAddress(key);
  return {
    id: 'wallet:' + key,
    email: '',
    name: displayName,
    pictureUrl: '',
    userMetadata: {
      username: walletUsername(key),
      display_name: displayName,
      name: displayName,
      wallet_public_key: key,
      wallet_provider: 'phantom',
    },
    appMetadata: {
      provider: 'wallet',
      wallet_public_key: key,
      wallet_provider: 'phantom',
    },
  };
}

export function createWalletLoginChallengeToken(publicKey, message, nonce, issuedAt) {
  const now = Math.floor(Date.now() / 1000);
  return createWalletSignedToken({
    typ: 'tinyworld-wallet-login-challenge',
    publicKey,
    message,
    nonce,
    issuedAt,
    iat: now,
    exp: now + WALLET_LOGIN_CHALLENGE_TTL_SECONDS,
  });
}

export function verifyWalletLoginChallengeToken(token, publicKey, message) {
  const payload = readWalletSignedToken(token, 'tinyworld-wallet-login-challenge');
  if (!payload) return null;
  if (payload.publicKey !== publicKey || payload.message !== message) return null;
  if (!payload.nonce || !payload.issuedAt) return null;
  return payload;
}

export function createWalletSessionToken(publicKey) {
  const key = String(publicKey || '').trim();
  if (!looksLikeSolanaPublicKey(key)) throw new Error('Invalid Solana public key');
  const now = Math.floor(Date.now() / 1000);
  return createWalletSignedToken({
    typ: 'tinyworld-wallet-session',
    sub: 'wallet:' + key,
    publicKey: key,
    iat: now,
    exp: now + WALLET_SESSION_TTL_SECONDS,
  });
}

export async function getAuthUser(request) {
  try {
    const user = await getUser();
    if (user && user.id) return user;
  } catch (_) {}
  const token = bearerToken(request);
  const walletUser = userFromWalletSessionToken(token);
  if (walletUser) return walletUser;
  return userFromBearerTokenValue(token);
}

export async function requireAuthUser(request, origin) {
  const user = await getAuthUser(request);
  if (!user || !user.id) return { response: errorResponse('Unauthorized', 401, origin) };
  return { user };
}

// Centralized registered-account predicate. This is the SINGLE place that
// decides whether an Identity account is treated as a usable email account, so
// the rule can change in one spot (a wallet-policy decision is still pending
// upstream).
//
// Criterion: a registered Netlify Identity account with an email address.
// Wallet-only sessions (id prefixed `wallet:`) and anonymous/logged-out callers
// do NOT qualify. Email confirmation is intentionally not part of this app-side
// rule because existing Identity users can be missing confirmedAt in fallback
// payloads even when they are valid accounts.
export function accountMeetsCriteria(account) {
  if (!account || !account.id) return false;
  // Wallet sessions are separate from Identity email accounts; revisit when the
  // wallet-access policy is decided.
  if (String(account.id).startsWith('wallet:')) return false;
  return !!String(account.email || '').trim();
}
