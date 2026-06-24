import { createHash, timingSafeEqual } from 'node:crypto';
import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse } from './lib/http.mjs';
import { computeWeeklyPayoutPlan } from '../../packages/tinyworld-mmo-core/src/index.js';

export const config = { path: '/api/admin/gold-payout' };

// E2 — weekly holdings-based GOLD payout.
// Snapshots each linked wallet's $TINYWORLD holdings + island count, computes the
// weekly GOLD allowance, and writes ONE authoritative ALLOWANCE_RECALCULATED ledger
// event per (wallet, cycle_id). The partial unique index uq_gold_allowance_wallet_cycle
// makes the write idempotent (re-runs within a cycle are no-ops).
//
// ADMIN-ONLY + ECONOMY-GATE-FRIENDLY:
//   GET  -> DRY RUN: compute and return the plan, write NOTHING (preview before launch).
//   POST -> EXECUTE: idempotently bulk-upsert the allowance events.
// Both require x-admin-secret (hash + timing-safe compare); 403 if the secret is unset.
//
// ===========================================================================
// PRE-LAUNCH SECURITY DECISION (REQUIRED before this is wired to a live cron):
// Holdings here come from wallet_accounts.token_balance_atomic, a cache the user can
// refresh. A weekly payout off a refreshable cache is vulnerable to BALANCE STACKING:
// fund wallet A, refresh it, move the tokens to wallet B, refresh B, ... then the
// payout credits every stale row. The freshness window below bounds (but does not
// eliminate) this. Before launch, pick ONE:
//   (a) LOCKED/STAKED $TINYWORLD — only locked tokens (un-moveable during the cycle)
//       count toward allowance (the economy guide lists this as an open decision); or
//   (b) a PAYOUT-OWNED on-chain snapshot/indexer that reads balances at the cycle
//       boundary, not a user-refreshable cache.
// Until (a) or (b) is implemented, do NOT schedule this to run live. It stays gated.
// ===========================================================================

const HOLDER_CAP = 5000;
// Only count a wallet's cached balance if it was refreshed within this window of the
// payout; staler rows are treated as 0 (fail closed) — defense-in-depth vs stacking.
const FRESHNESS_HOURS = Math.max(1, Number(process.env.GOLD_PAYOUT_FRESHNESS_HOURS) || 26);

function adminSecret() {
  return process.env.TINYWORLD_ADMIN_SECRET || '';
}

// Hash both sides to a fixed 32 bytes so the compare never leaks length and is always
// constant-time. Requires a configured, reasonably-long secret.
function isAdmin(request) {
  const secret = adminSecret();
  if (!secret || secret.length < 16) return false; // never run unguarded / weak
  const provided = request.headers.get('x-admin-secret') || '';
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
}

// Atomic token units -> whole tokens (floored), BigInt throughout. Independent of any
// other module so this does not collide with the E1 gold branch.
function wholeFromAtomic(atomicStr, decimals) {
  let a = 0n;
  const raw = String(atomicStr == null ? '0' : atomicStr).trim();
  if (/^[0-9]+$/.test(raw)) {
    try { a = BigInt(raw); } catch (_) { a = 0n; }
  }
  const d = Math.max(0, Math.min(36, Number(decimals) || 0));
  if (d === 0) return a.toString();
  return (a / (10n ** BigInt(d))).toString();
}

const isMissingSchema = (err) => isMissingRelations(err, ['profiles', 'wallet_accounts', 'gold_ledger_events', 'worlds']);

export default async function goldPayout(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);
  if (request.method !== 'GET' && request.method !== 'POST') {
    return errorResponse('Method not allowed', 405, origin);
  }
  if (!isAdmin(request)) return errorResponse('Forbidden', 403, origin);

  const execute = request.method === 'POST';
  const freshnessCutoff = new Date(Date.now() - FRESHNESS_HOURS * 3600 * 1000);

  try {
    const sql = getSql();

    // Aggregate holdings per profile that has a verified wallet. Only numeric atomic
    // balances refreshed within the freshness window are summed (stale/junk -> 0).
    const rows = await sql`
      SELECT
        p.id AS profile_id,
        COALESCE((
          SELECT SUM((wa.token_balance_atomic)::numeric)
          FROM wallet_accounts wa
          WHERE wa.profile_id = p.id AND wa.verified_at IS NOT NULL
            AND wa.token_balance_atomic ~ '^[0-9]+$'
            AND wa.updated_at >= ${freshnessCutoff}
        ), 0)::text AS atomic_sum,
        COALESCE((
          SELECT MAX(wa.token_decimals)
          FROM wallet_accounts wa
          WHERE wa.profile_id = p.id AND wa.verified_at IS NOT NULL
            AND wa.updated_at >= ${freshnessCutoff}
        ), 0) AS decimals,
        COALESCE((
          SELECT COUNT(*) FROM worlds w
          WHERE w.owner_profile_id = p.id AND w.status = 'published'
        ), 0) AS island_count
      FROM profiles p
      WHERE EXISTS (
        SELECT 1 FROM wallet_accounts wa
        WHERE wa.profile_id = p.id AND wa.verified_at IS NOT NULL
      )
      ORDER BY p.id ASC
      LIMIT ${HOLDER_CAP + 1}
    `;

    // Fail CLOSED on overflow: if there are more eligible holders than we can process
    // in one pass, refuse to write a partial payout (an attacker could otherwise farm
    // dummy wallets to push real holders past the cap). Needs pagination before launch.
    if ((rows || []).length > HOLDER_CAP) {
      return errorResponse(
        `holder count exceeds cap (${HOLDER_CAP}); refusing partial payout — paginate before launch`,
        409, origin,
      );
    }

    const holders = (rows || []).map((r) => ({
      wallet: 'profile:' + Number(r.profile_id),
      tinyworldHeld: wholeFromAtomic(r.atomic_sum, r.decimals),
      islandCount: Number(r.island_count) || 0,
    }));

    const plan = computeWeeklyPayoutPlan(holders, { now: new Date() });
    const totalGold = plan.events.reduce((sum, e) => sum + Number(e.amount), 0);

    if (!execute) {
      return jsonResponse({
        mode: 'dry-run',
        cycleId: plan.cycleId,
        freshnessHours: FRESHNESS_HOURS,
        holders: holders.length,
        eventsToWrite: plan.events.length,
        skippedZeroAllowance: plan.skippedZero,
        totalGoldAllowance: totalGold,
        sample: plan.events.slice(0, 10),
      }, origin);
    }

    // EXECUTE — single bulk upsert (one round trip), idempotent via the partial index.
    let written = 0;
    if (plan.events.length) {
      const values = plan.events.map((e) => ({
        wallet: e.wallet,
        cycle_id: e.cycleId,
        type: 'ALLOWANCE_RECALCULATED',
        amount: e.amount,
        reason: e.reason,
        reference_id: null,
      }));
      const inserted = await sql`
        INSERT INTO gold_ledger_events ${sql(values, 'wallet', 'cycle_id', 'type', 'amount', 'reason', 'reference_id')}
        ON CONFLICT (wallet, cycle_id) WHERE type = 'ALLOWANCE_RECALCULATED'
        DO NOTHING
        RETURNING id
      `;
      written = (inserted || []).length;
    }

    return jsonResponse({
      mode: 'execute',
      cycleId: plan.cycleId,
      freshnessHours: FRESHNESS_HOURS,
      holders: holders.length,
      eventsComputed: plan.events.length,
      written,
      alreadyPresent: plan.events.length - written,
      skippedZeroAllowance: plan.skippedZero,
      totalGoldAllowance: totalGold,
    }, origin);
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingSchema(err)) {
      return errorResponse('gold-payout-unavailable: schema or DB not ready', 503, origin);
    }
    return errorResponse('gold-payout-failed: ' + (err.message || err), 500, origin);
  }
}
