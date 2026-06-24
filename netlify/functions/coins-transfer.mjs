import { createHash } from 'node:crypto';
import { requireAuthUser } from './lib/auth.mjs';
import { requireTinyverseAccess } from './lib/tinyverse-access.mjs';
import { ensureProfile } from './lib/profiles.mjs';
import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse, readJson, sameOriginWriteGuard } from './lib/http.mjs';
import { transferCoins, MAX_COIN_AMOUNT } from './lib/coins.mjs';

export const config = { path: '/api/me/coins/transfer' };

// Wallet-to-wallet Earned GOLD transfer. The atomic, ordered-lock, idempotent move lives
// in lib/coins.mjs transferCoins (verified by EC1); this endpoint authenticates, gates,
// resolves the recipient by username, and binds the idempotency ref to the full transfer
// body so a reused key with a different amount/recipient is a NEW transfer, while an
// identical retry is a no-op replay.
const isMissingSchema = (err) => isMissingRelations(err, ['profiles', 'coin_balances', 'coin_ledger']);

export default async function coinsTransfer(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405, origin);
  if (!sameOriginWriteGuard(request)) return errorResponse('Forbidden', 403, origin);

  const auth = await requireAuthUser(request, origin);
  if (auth.response) return auth.response;
  const tvGate = requireTinyverseAccess(auth.user, origin);
  if (tvGate) return tvGate;

  let body;
  try { body = await readJson(request); } catch (_) { return errorResponse('invalid-json', 400, origin); }

  const idempotencyKey = String((body && body.idempotencyKey) || '').trim();
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200) return errorResponse('invalid-idempotency-key', 400, origin);
  const toUsername = String((body && body.toUsername) || '').trim();
  if (!toUsername || toUsername.length > 64) return errorResponse('invalid-recipient', 400, origin);
  // Validate the RAW JSON value as a safe integer — never floor/coerce (1.9, true, "5"
  // must all be rejected, not silently accepted).
  const amount = body && body.amount;
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_COIN_AMOUNT) return errorResponse('invalid-amount', 400, origin);

  try {
    const sql = getSql();
    const me = await ensureProfile(auth.user);
    const fromProfileId = Number(me.id);

    // Deterministic resolution (ORDER BY id) so a given username always maps to the same
    // profile even if legacy case-variant rows exist.
    const canonicalRecipient = toUsername.toLowerCase();
    const rows = await sql`SELECT id, username FROM profiles WHERE lower(username) = ${canonicalRecipient} AND archived_at IS NULL ORDER BY id ASC LIMIT 1`;
    if (!rows.length) return jsonResponse({ ok: false, reason: 'recipient-not-found' }, origin, 404);
    const toProfileId = Number(rows[0].id);
    if (toProfileId === fromProfileId) return jsonResponse({ ok: false, reason: 'self-transfer' }, origin, 400);

    // Ref bound to the stable REQUEST body (sender, canonical recipient name, amount, key),
    // NOT the resolved profile id: an identical retry replays idempotently even if the
    // username was later reassigned; a different amount/recipient is a distinct transfer.
    const ref = 'xfer:' + createHash('sha256').update(`${fromProfileId}:${canonicalRecipient}:${amount}:${idempotencyKey}`).digest('hex').slice(0, 48);

    const result = await transferCoins(sql, { fromProfileId, toProfileId, amount, reason: 'transfer', referenceId: ref });
    if (!result.ok) {
      const status = result.reason === 'insufficient-coins' ? 409 : 400;
      return jsonResponse({ ok: false, reason: result.reason }, origin, status);
    }
    return jsonResponse({ ok: true, sent: amount, to: rows[0].username, balance: result.fromBalance, replayed: !!result.replayed }, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingSchema(err)) return jsonResponse({ ok: false, reason: 'unavailable' }, origin, 503);
    return errorResponse('coins-transfer-failed', 500, origin);
  }
}
