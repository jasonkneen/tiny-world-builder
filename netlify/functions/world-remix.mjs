import { requireAuthUser } from './lib/auth.mjs';
import { ensureProfile } from './lib/profiles.mjs';
import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse, readJson, sameOriginWriteGuard } from './lib/http.mjs';
import { coinsTransaction, isValidCoinRef } from './lib/coins.mjs';

export const config = { path: '/api/worlds/remix' };

// T2 — pay Earned GOLD to remix a template world into your own editable copy.
// ATOMIC (one transaction via coinsTransaction): debit buyer -> credit author (price
// minus treasury fee) -> duplicate the world's data into a new build owned by the
// buyer -> bump remix_count. Either it all happens or none of it does. Idempotent on
// a client key so a retry never double-charges or double-duplicates.

const TREASURY_FEE_BPS = 500; // 5% — matches DEFAULT_ECONOMY_POLICY.officialMarketplaceFeeBps
const MAX_BUILDS_PER_PROFILE = 500;
const isMissingSchema = (err) => isMissingRelations(err, ['worlds', 'builds', 'coin_balances', 'coin_ledger']);

export function templateFeeSplit(price) {
  const p = Math.max(0, Math.floor(Number(price) || 0));
  const fee = Math.floor((p * TREASURY_FEE_BPS) / 10000);
  return { fee, authorAmount: p - fee };
}

export default async function worldRemix(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405, origin);
  if (!sameOriginWriteGuard(request)) return errorResponse('Forbidden', 403, origin);

  const auth = await requireAuthUser(request, origin);
  if (auth.response) return auth.response;

  let body;
  try { body = await readJson(request); } catch (_) { return errorResponse('invalid-json', 400, origin); }
  body = body || {};
  const worldId = Number(body.worldId);
  const idempotencyKey = String(body.idempotencyKey || '').trim();
  if (!Number.isInteger(worldId) || worldId < 1) return errorResponse('invalid-world', 400, origin);
  if (!isValidCoinRef(idempotencyKey)) return errorResponse('invalid-idempotency-key', 400, origin);

  try {
    const sql = getSql();
    const buyer = await ensureProfile(auth.user);

    const rows = await sql`
      SELECT id, owner_profile_id, name, is_template, template_price, data
      FROM worlds WHERE id = ${worldId} LIMIT 1
    `;
    if (!rows.length) return errorResponse('world-not-found', 404, origin);
    const world = rows[0];
    if (!world.is_template || world.template_price == null) return errorResponse('not-a-template', 400, origin);
    const author = Number(world.owner_profile_id);
    if (author === Number(buyer.id)) return errorResponse('cannot-remix-own', 400, origin);

    const price = Math.max(0, Math.floor(Number(world.template_price) || 0));
    const { fee, authorAmount } = templateFeeSplit(price);

    const result = await coinsTransaction(sql, async ({ debit, credit, tx }) => {
      // Buyer's build cap (the duplicated world becomes a build they own).
      const cnt = await tx`SELECT count(*)::int AS n FROM builds WHERE profile_id = ${Number(buyer.id)}`;
      if (Number(cnt[0].n) >= MAX_BUILDS_PER_PROFILE) return { ok: false, reason: 'build-limit' };

      // Free templates skip the coin movement entirely.
      let debitBalance = null;
      if (price > 0) {
        const d = await debit({ profileId: buyer.id, amount: price, type: 'DEBIT', reason: `remix:${worldId}`, referenceId: idempotencyKey, counterpartyProfileId: author });
        if (!d.ok) return d; // insufficient-coins / idempotency-key-reused (no writes)
        if (d.replayed) return { ok: true, replayed: true, balance: d.balance }; // already remixed — don't double-build
        debitBalance = d.balance;
        if (authorAmount > 0) {
          const c = await credit({ profileId: author, amount: authorAmount, type: 'CREDIT', reason: `remix-sale:${worldId}`, referenceId: idempotencyKey + ':author', counterpartyProfileId: Number(buyer.id) });
          if (!c.ok) throw new Error('author-credit-failed:' + c.reason); // rolls back the debit
        }
      }

      const name = ('Remix of ' + (world.name || 'world')).slice(0, 80);
      const build = await tx`INSERT INTO builds (profile_id, name, data) VALUES (${Number(buyer.id)}, ${name}, ${world.data}) RETURNING id`;
      await tx`UPDATE worlds SET remix_count = remix_count + 1 WHERE id = ${worldId}`;
      return { ok: true, replayed: false, buildId: Number(build[0].id), spent: price, fee, authorReceived: authorAmount, balance: debitBalance };
    });

    if (!result.ok) {
      const status = result.reason === 'insufficient-coins' ? 402
        : result.reason === 'idempotency-key-reused' ? 409
        : result.reason === 'build-limit' ? 409 : 400;
      return jsonResponse(result, origin, status);
    }
    return jsonResponse(result, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingSchema(err)) {
      return errorResponse('world-remix-unavailable: schema not ready', 503, origin);
    }
    return errorResponse('world-remix-failed: ' + (err.message || err), 500, origin);
  }
}
