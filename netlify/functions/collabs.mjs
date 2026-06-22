import { getSql, isDatabaseUnavailable } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse, readJson, sameOriginWriteGuard } from './lib/http.mjs';

export const config = { path: '/api/collabs' };

const ACTIVE_WINDOW_SECONDS = 150;
const MAX_NAME = 100;
const MAX_HOST = 80;
const MAX_LOCATION = 80;

function cleanText(value, max = 80) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanId(value) {
  return String(value == null ? '' : value)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function cleanQuality(value) {
  const q = String(value || '').trim().toLowerCase();
  return ['good', 'fair', 'poor', 'unknown'].includes(q) ? q : 'unknown';
}

function cleanCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(9999, Math.round(n)));
}

function cleanRtt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(60_000, Math.round(n)));
}

function cleanPartyHost(value) {
  const raw = cleanText(value, 180);
  if (!raw) return '';
  if (!/^(wss?:)?\/\//i.test(raw)) return '';
  try {
    const url = new URL(raw.replace(/^\/\//, 'wss://'));
    if (!/^ws:|^wss:$/.test(url.protocol)) return '';
    return url.href.replace(/\/+$/, '');
  } catch (_) {
    return '';
  }
}

function observerHref(roomId, shareId, partyHost, request) {
  const params = new URLSearchParams();
  if (shareId) params.set('share', shareId);
  params.set('party', roomId);
  params.set('observe', '1');
  try {
    const reqUrl = new URL(request.url);
    const host = partyHost ? new URL(partyHost.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:')) : null;
    const devCaller = /^localhost$|^127\.0\.0\.1$/.test(reqUrl.hostname);
    if (host && devCaller && /^localhost$|^127\.0\.0\.1$/.test(host.hostname)) {
      params.set('partyHost', partyHost);
    }
  } catch (_) {}
  return '/tiny-world-builder?' + params.toString();
}

async function ensureCollabRooms(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS collab_rooms (
      room_id TEXT PRIMARY KEY,
      share_id TEXT,
      name TEXT NOT NULL DEFAULT 'Shared build',
      host_name TEXT NOT NULL DEFAULT 'Builder',
      location TEXT NOT NULL DEFAULT '',
      party_host TEXT NOT NULL DEFAULT '',
      observer_count INTEGER NOT NULL DEFAULT 0,
      player_count INTEGER NOT NULL DEFAULT 0,
      editor_count INTEGER NOT NULL DEFAULT 0,
      network_quality TEXT NOT NULL DEFAULT 'unknown',
      rtt_ms INTEGER,
      href TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS collab_rooms_last_seen_idx ON collab_rooms (last_seen DESC)`;
}

function collabDto(row) {
  return {
    roomId: row.room_id,
    shareId: row.share_id || '',
    name: row.name,
    host: row.host_name,
    location: row.location || 'Unknown',
    observerCount: Number(row.observer_count) || 0,
    playerCount: Number(row.player_count) || 0,
    editorCount: Number(row.editor_count) || 0,
    networkQuality: row.network_quality || 'unknown',
    rttMs: row.rtt_ms == null ? null : Number(row.rtt_ms),
    href: row.href,
    lastSeen: row.last_seen,
  };
}

export default async function collabsFunction(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);

  try {
    const sql = getSql();
    await ensureCollabRooms(sql);

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 50));
      const rows = await sql`
        SELECT *
        FROM collab_rooms
        WHERE last_seen > NOW() - (${ACTIVE_WINDOW_SECONDS} * INTERVAL '1 second')
        ORDER BY last_seen DESC
        LIMIT ${limit}
      `;
      return jsonResponse({ rooms: rows.map(collabDto), activeWindowSeconds: ACTIVE_WINDOW_SECONDS }, origin, 200, {
        'Cache-Control': 'no-store',
      });
    }

    if (request.method === 'POST') {
      if (!sameOriginWriteGuard(request)) return errorResponse('Forbidden', 403, origin);
      const body = await readJson(request, 16_384);
      if (!body || typeof body !== 'object') return errorResponse('Invalid JSON body', 400, origin);

      const roomId = cleanId(body.roomId || body.room || body.party);
      if (!roomId) return errorResponse('Missing room id', 400, origin);
      const shareId = cleanId(body.shareId || body.share || '');
      const partyHost = cleanPartyHost(body.partyHost || '');
      const network = body.network && typeof body.network === 'object' ? body.network : {};
      const quality = cleanQuality(body.networkQuality || network.quality);
      const rttMs = cleanRtt(body.rttMs == null ? network.rttMs : body.rttMs);
      const href = observerHref(roomId, shareId, partyHost, request);
      const name = cleanText(body.name, MAX_NAME) || 'Shared build';
      const hostName = cleanText(body.hostName || body.host, MAX_HOST) || 'Builder';
      const location = cleanText(body.location, MAX_LOCATION);
      const observerCount = cleanCount(body.observerCount || body.observers);
      const playerCount = cleanCount(body.playerCount || body.players);
      const editorCount = cleanCount(body.editorCount || body.editors);

      const rows = await sql`
        INSERT INTO collab_rooms (
          room_id, share_id, name, host_name, location, party_host,
          observer_count, player_count, editor_count, network_quality, rtt_ms, href,
          created_at, last_seen
        )
        VALUES (
          ${roomId}, ${shareId || null}, ${name}, ${hostName}, ${location}, ${partyHost},
          ${observerCount}, ${playerCount}, ${editorCount}, ${quality}, ${rttMs}, ${href},
          NOW(), NOW()
        )
        ON CONFLICT (room_id) DO UPDATE SET
          share_id = EXCLUDED.share_id,
          name = EXCLUDED.name,
          host_name = EXCLUDED.host_name,
          location = EXCLUDED.location,
          party_host = EXCLUDED.party_host,
          observer_count = EXCLUDED.observer_count,
          player_count = EXCLUDED.player_count,
          editor_count = EXCLUDED.editor_count,
          network_quality = EXCLUDED.network_quality,
          rtt_ms = EXCLUDED.rtt_ms,
          href = EXCLUDED.href,
          last_seen = NOW()
        RETURNING *
      `;
      return jsonResponse({ room: collabDto(rows[0]) }, origin, 200, { 'Cache-Control': 'no-store' });
    }

    return errorResponse('Method not allowed', 405, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err)) {
      return errorResponse('Netlify Database is not available in this local session.', 503, origin);
    }
    console.error('[collabs]', err);
    return errorResponse('Collab rooms request failed', 500, origin);
  }
}
