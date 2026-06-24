import { requireAuthUser } from "./lib/auth.mjs";
import { ensureProfile } from "./lib/profiles.mjs";
import { getSql } from "./lib/db.mjs";
import { corsResponse, errorResponse, jsonResponse } from "./lib/http.mjs";
import {
  calculateGoldAllowance,
  DEFAULT_ECONOMY_POLICY,
  reduceGoldLedger,
  createGoldLedgerEvent,
  wholeTokensHeld,
} from "../../packages/tinyworld-mmo-core/src/index.js";

export const config = { path: "/api/me/gold" };

export default async function meGold(request) {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return corsResponse(origin);
  if (request.method !== "GET") return errorResponse("Method not allowed", 405, origin);

  // requireAuthUser returns { response } (401) or { user }; resolve the profile via the
  // shared ensureProfile helper, matching every other authenticated endpoint. (The old
  // `const user = await requireAuthUser(...)` shape dereferenced a wrapper and 500'd.)
  const auth = await requireAuthUser(request, origin);
  if (auth.response) return auth.response;

  try {
    const sql = getSql();
    const profile = await ensureProfile(auth.user);
    const profileId = profile.id;
    const walletKey = "profile:" + profileId;

    let islandCount = 0;
    try {
      const owned = await sql`SELECT COUNT(*)::int as cnt FROM worlds WHERE owner_profile_id = ${profileId} AND status = 'published'`;
      islandCount = owned[0] ? owned[0].cnt || 0 : 0;
    } catch (e) {}

    let events = [];
    try {
      const rows = await sql`
        SELECT type, wallet, cycle_id as "cycleId", amount, reason, reference_id as "referenceId", created_at as "createdAt"
        FROM gold_ledger_events
        WHERE wallet = ${walletKey}
        ORDER BY created_at ASC
      `;
      events = rows || [];
    } catch (e) {}

    // Real $TINYWORLD holdings from the profile's verified, server-written wallet cache.
    // token_balance_atomic is refreshed by wallet.mjs via an on-chain read against
    // TINYWORLD_TOKEN_MINT; the client can never set it. Sum across linked wallets in
    // BigInt (a whale balance overflows Number), then floor to whole tokens for tiering.
    // Degrades honestly to "0" (no-tier) when no wallet is linked or the mint is unset.
    let tinyworldHeld = "0";
    let walletLinked = false;
    let balanceAsOf = null;
    try {
      const wallets = await sql`
        SELECT token_balance_atomic, token_decimals, updated_at
        FROM wallet_accounts
        WHERE profile_id = ${profileId} AND verified_at IS NOT NULL
      `;
      walletLinked = (wallets || []).length > 0;
      // Convert each wallet to whole tokens with ITS OWN decimals, then sum — correct
      // regardless of any per-row decimals inconsistency across linked wallets.
      let wholeSum = 0n;
      for (const w of wallets || []) {
        // Reject hostile/garbled atomic strings rather than letting a wild value through.
        const raw = String(w.token_balance_atomic || "0").trim();
        if (/^[0-9]{1,40}$/.test(raw)) {
          try { wholeSum += BigInt(wholeTokensHeld(raw, Number(w.token_decimals) || 0)); } catch (_) {}
        }
        if (w.updated_at && (!balanceAsOf || w.updated_at > balanceAsOf)) balanceAsOf = w.updated_at;
      }
      if (wholeSum > 0n) tinyworldHeld = wholeSum.toString();
    } catch (e) {}

    const base = calculateGoldAllowance({
      tinyworldHeld,
      islandCount,
      spentThisCycle: 0,
      now: new Date(),
    }, DEFAULT_ECONOMY_POLICY);

    const summary = reduceGoldLedger(events, { wallet: walletKey, cycleId: base.cycleId });

    const final = {
      ...base,
      spent: summary.spent,
      available: Math.max(0, base.totalAllowance - summary.spent),
      ledgerEvents: events.slice(-5),
      walletLinked,
      balanceAsOf,
      // INVARIANT (security): this allowance is a PROJECTION from the last cached wallet
      // balance, shown for UX. It does NOT grant spendable GOLD. The authoritative,
      // spendable allowance is the ledger sum of ALLOWANCE_RECALCULATED events written by
      // the weekly snapshot job (E2, which does its own fresh on-chain read) minus
      // GOLD_SPENT. The spend endpoint (E3) MUST validate against the ledger, never against
      // this projection — so a stale cache can never be turned into durable spend power.
      projection: true,
      note: walletLinked
        ? "Projected allowance from your verified wallet's $TINYWORLD balance + island bonus, net of this cycle's spend. Weekly snapshot is authoritative."
        : "No verified wallet linked (or token mint unset) — link a wallet to earn a GOLD allowance from your $TINYWORLD holdings.",
    };

    return jsonResponse(final, origin);
  } catch (err) {
    return errorResponse("gold-calc-failed: " + (err.message || err), 500, origin);
  }
}
