import { requireAuthUser } from './lib/auth.mjs';
import { ensureProfile } from './lib/profiles.mjs';
import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse, readJson, sameOriginWriteGuard } from './lib/http.mjs';
import { coinsTransaction, getCoinBalance, isValidCoinRef } from './lib/coins.mjs';
import { generateAi, isAiKind, aiCost } from './lib/ai.mjs';

export const config = { path: '/api/ai/generate' };

// AI1 — paid AI generation, metered in Earned GOLD. The player is charged ONLY on a
// successful generation (charge + record happen atomically), so a provider failure
// never costs the player and a retry-after-failure can't yield a free result. A retry
// with the same key replays the stored result (no re-charge, no re-call).
const isMissingSchema = (err) => isMissingRelations(err, ['ai_generations', 'coin_balances', 'coin_ledger']);

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
  const input = String(body.input == null ? '' : body.input).slice(0, 280);
  const idempotencyKey = String(body.idempotencyKey || '').trim();
  if (!isAiKind(kind)) return errorResponse('invalid-kind', 400, origin);
  if (!isValidCoinRef(idempotencyKey)) return errorResponse('invalid-idempotency-key', 400, origin);
  const cost = aiCost(kind);

  try {
    const sql = getSql();
    const profile = await ensureProfile(auth.user);
    const profileId = Number(profile.id);

    // Replay: a prior generation with this key returns the stored result — no re-charge.
    const prior = await sql`
      SELECT kind, cost, result FROM ai_generations
      WHERE profile_id = ${profileId} AND idempotency_key = ${idempotencyKey} LIMIT 1
    `;
    if (prior.length) {
      return jsonResponse({ ok: true, replayed: true, kind: prior[0].kind, cost: Number(prior[0].cost), result: prior[0].result }, origin);
    }

    // Pre-flight balance check (fail fast before spending a provider call). The
    // authoritative check is the debit inside the success transaction below.
    const bal = await getCoinBalance(sql, profileId);
    if (bal < cost) return jsonResponse({ ok: false, reason: 'insufficient-coins', balance: bal, cost }, origin, 402);

    // Generate. On any failure, the player is NOT charged.
    const gen = await generateAi({ kind, input });
    if (!gen.ok) return jsonResponse({ ok: false, reason: gen.error }, origin, 502);

    // Charge + record atomically. If the balance changed since the pre-flight and the
    // debit now fails, nothing is recorded and the player is not charged (502-cost leak
    // is bounded by the pre-flight + rate limiting).
    const result = await coinsTransaction(sql, async ({ debit, tx }) => {
      const d = await debit({ profileId, amount: cost, type: 'DEBIT', reason: `ai:${kind}`, referenceId: `ai-${idempotencyKey}` });
      if (!d.ok) return d;
      const ins = await tx`
        INSERT INTO ai_generations (profile_id, idempotency_key, kind, cost, result)
        VALUES (${profileId}, ${idempotencyKey}, ${kind}, ${cost}, ${gen.text})
        ON CONFLICT (profile_id, idempotency_key) DO NOTHING
        RETURNING id
      `;
      return { ok: true, replayed: !ins.length, balance: d.balance };
    });

    if (!result.ok) {
      const status = result.reason === 'insufficient-coins' ? 402 : 400;
      return jsonResponse({ ok: false, reason: result.reason }, origin, status);
    }
    return jsonResponse({ ok: true, kind, cost, result: gen.text, balance: result.balance }, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingSchema(err)) {
      return errorResponse('ai-generate-unavailable: schema not ready', 503, origin);
    }
    return errorResponse('ai-generate-failed: ' + (err.message || err), 500, origin);
  }
}
