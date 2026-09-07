// -------- cors allowlist --------
const DEFAULT_SITE_ORIGIN = 'https://tinyworld.build';

export function siteOrigin() {
  const raw = process.env.TINYWORLD_SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || DEFAULT_SITE_ORIGIN;
  try {
    return new URL(raw).origin;
  } catch (_) {
    return DEFAULT_SITE_ORIGIN;
  }
}

export function absoluteSiteUrl(path) {
  const value = String(path == null ? '' : path).trim();
  if (!value || /^https?:\/\//i.test(value)) return value;
  return new URL(value.replace(/^\/+/, ''), siteOrigin() + '/').href;
}

function envOrigin(value) {
  if (!value) return '';
  try {
    return new URL(value).origin;
  } catch (_) {
    return '';
  }
}

// Reflect the caller Origin only when it matches the deployed site URL (prod +
// branch/deploy previews) or localhost for dev; otherwise omit the header. We
// never emit Access-Control-Allow-Credentials, so a missing ACAO simply blocks
// the cross-origin read rather than leaking it.
function isAllowedOrigin(origin) {
  if (!origin) return false;
  const siteOrigins = [process.env.TINYWORLD_SITE_URL, process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL].map(envOrigin).filter(Boolean);
  if (siteOrigins.includes(origin)) return true;
  return /^http:\/\/localhost(:\d+)?$/.test(origin);
}

export function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Vary': 'Origin',
  };
  if (isAllowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function corsResponse(origin) {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export function jsonResponse(body, origin, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: Object.assign(corsHeaders(origin), extraHeaders),
  });
}

export function errorResponse(message, status, origin) {
  return jsonResponse({ error: message }, origin, status);
}

function jsonDepth(value, depth = 0, maxDepth = 32) {
  if (depth > maxDepth || value === null || typeof value !== 'object') return depth;
  let max = depth;
  for (const key in value) {
    max = Math.max(max, jsonDepth(value[key], depth + 1, maxDepth));
    if (max > maxDepth) break;
  }
  return max;
}

export async function readJson(request, maxBytes = 1_048_576, maxDepth = 32) {
  // Reject oversized bodies before parsing so a large/deeply-nested payload can't
  // spike memory. Netlify caps requests ~6MB; this is a tighter per-call guard.
  const len = Number(request.headers.get('content-length') || 0);
  if (len && len > maxBytes) return null;
  try {
    const data = await request.json();
    // Reject pathologically deep structures (JSON "bombs") that can still cause
    // CPU/memory spikes or stack overflows in downstream recursive processing
    // even when the body itself is under maxBytes.
    if (jsonDepth(data, 0, maxDepth) > maxDepth) return null;
    return data;
  } catch (_) {
    return null;
  }
}

export function sameOriginWriteGuard(request) {
  const reqOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  if (origin) return origin === reqOrigin;
  // No Origin header: fail closed, but accept a same-origin Referer as a fallback
  // (some same-origin browser requests omit Origin) and allow localhost for dev
  // tooling / server-to-server calls that send neither.
  const referer = request.headers.get('referer');
  if (referer) {
    try { return new URL(referer).origin === reqOrigin; } catch (_) { return false; }
  }
  return /^http:\/\/localhost(:\d+)?$/.test(reqOrigin);
}
