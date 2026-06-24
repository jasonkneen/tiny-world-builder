import { createHash } from 'node:crypto';
import { requireAuthUser } from './lib/auth.mjs';
import { ensureProfile } from './lib/profiles.mjs';
import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse, readJson, sameOriginWriteGuard } from './lib/http.mjs';
import { coinsTransaction, creditCoins, isValidCoinRef } from './lib/coins.mjs';
import { generateAi, isAiKind, aiCost } from './lib/ai.mjs';

export const config = { path: '/api/ai/generate' };

// AI1 — paid AI generation, metered in Earned GOLD.
// RESERVE-FIRST: debit the cost AND create a pending operation row ATOMICALLY before
// the provider call (so a low-balance user can't fan out many provider calls and pay
// once). The provider runs once; on success the row is completed, on failure the cost
// is REFUNDED. Idempotent + request-bound: the (profile, key) op row gates retries and
// is bound to a (kind+input) fingerprint, so a key can't be reused for a different
// request, and concurrent same-key requests never double-call or double-charge.
const isMissingSchema = (err) => isMissingRelations(err, ['ai_generations', 'coin_balances', 'coin_ledger']);

function sha(s) { return createHash('sha256').update(String(s)).digest('hex'); }

export default async function aiGenerate(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405, origin);
  if (!sameOriginWriteGuard(request)) return errorResponse('Forbidden', 403, origin);

  const auth = await requireAuthUser(request, origin);
  if (auth.response) return auth.response;

  let body;
  try { body = await readJson(request); } catch (_) { return errorResponse('invalid-json', 400, origin); }
  body = body || {};
  const kind = String(body.kind || '').trim();
  const input = String(body.input == null ? '' : body.input).replace(/\s+/g, ' ').trim().slice(0, 280);
  const idempotencyKey = String(body.idempotencyKey || '').trim();
  if (!isAiKind(kind)) return errorResponse('invalid-kind', 400, origin);
  if (!isValidCoinRef(idempotencyKey)) return errorResponse('invalid-idempotency-key', 400, origin);
  const cost = aiCost(kind);
  const inputHash = sha(kind + '\n' + input);

  try {
    const sql = getSql();
    const profile = await ensureProfile(auth.user);
    const profileId = Number(profile.id);
    // Always-bounded coin ref derived from (profile, key) — independent of key length.
    const coinRef = 'ai:' + sha(profileId + ':' + idempotencyKey).slice(0, 48);

    // RESERVE: pre-check + debit + insert the pending op row, all under the buyer lock.
    const reserve = await coinsTransaction(sql, async ({ debit, tx }) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${'coin:' + profileId})::bigint)`;
      const prior = await tx`
        SELECT status, kind, cost, input_hash, result FROM ai_generations
        WHERE profile_id = ${profileId} AND idempotency_key = ${idempotencyKey} LIMIT 1
      `;
      if (prior.length) {
        const p = prior[0];
        if (String(p.input_hash) !== inputHash || String(p.kind) !== kind) return { state: 'reused' };
        if (p.status === 'completed') return { state: 'replay', result: p.result, cost: Number(p.cost) };
        if (p.status === 'failed') return { state: 'failed-prior' };
        return { state: 'in-progress' };
      }
      const d = await debit({ profileId, amount: cost, type: 'DEBIT', reason: `ai:${kind}`, referenceId: coinRef });
      if (!d.ok) return { state: d.reason }; // insufficient-coins / invalid-*
      await tx`
        INSERT INTO ai_generations (profile_id, idempotency_key, kind, cost, input_hash, status, result)
        VALUES (${profileId}, ${idempotencyKey}, ${kind}, ${cost}, ${inputHash}, 'pending', NULL)
      `;
      return { state: 'reserved', balance: d.balance };
    });

    if (reserve.state === 'replay') return jsonResponse({ ok: true, replayed: true, kind, cost: reserve.cost, result: reserve.result }, origin);
    if (reserve.state === 'in-progress') return jsonResponse({ ok: false, reason: 'in-progress' }, origin, 409);
    if (reserve.state === 'reused') return jsonResponse({ ok: false, reason: 'idempotency-key-reused' }, origin, 409);
    if (reserve.state === 'failed-prior') return jsonResponse({ ok: false, reason: 'prior-generation-failed' }, origin, 409);
    if (reserve.state === 'insufficient-coins') return jsonResponse({ ok: false, reason: 'insufficient-coins', cost }, origin, 402);
    if (reserve.state !== 'reserved') return jsonResponse({ ok: false, reason: 'reserve-failed' }, origin, 400);

    // The cost is now reserved. Run the provider exactly once.
    const gen = await generateAi({ kind, input });
    if (!gen.ok) {
      // Refund the reservation and mark the op failed.
      await creditCoins(sql, { profileId, amount: cost, type: 'CREDIT', reason: `ai-refund:${kind}`, referenceId: coinRef + ':r' }).catch(() => {});
      await sql`UPDATE ai_generations SET status = 'failed', updated_at = NOW() WHERE profile_id = ${profileId} AND idempotency_key = ${idempotencyKey}`.catch(() => {});
      return jsonResponse({ ok: false, reason: gen.error }, origin, 502);
    }
    await sql`
      UPDATE ai_generations SET result = ${gen.text}, status = 'completed', updated_at = NOW()
      WHERE profile_id = ${profileId} AND idempotency_key = ${idempotencyKey}
    `;
    return jsonResponse({ ok: true, kind, cost, result: gen.text, balance: reserve.balance }, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingSchema(err)) {
      return errorResponse('ai-generate-unavailable: schema not ready', 503, origin);
    }
    console.warn('[ai-generate] failed:', err && err.message);
    return errorResponse('ai-generate-failed', 500, origin);
  }
}
