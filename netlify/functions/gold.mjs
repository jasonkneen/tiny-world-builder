import { requireAuthUser } from "./lib/auth.mjs";
import { getSql } from "./lib/db.mjs";
import { corsResponse, errorResponse, jsonResponse } from "./lib/http.mjs";
import {
  calculateGoldAllowance,
  DEFAULT_ECONOMY_POLICY,
  reduceGoldLedger,
  createGoldLedgerEvent,
} from "../../packages/tinyworld-mmo-core/src/index.js";

export const config = { path: "/api/me/gold" };

export default async function meGold(request) {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return corsResponse(origin);
  if (request.method !== "GET") return errorResponse("Method not allowed", 405, origin);

  try {
    const user = await requireAuthUser(request);
    if (!user) return errorResponse("Unauthorized", 401, origin);

    const sql = getSql();
    const profileId = user.profile.id;
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

    const base = calculateGoldAllowance({
      tinyworldHeld: "0",
      islandCount,
      spentThisCycle: 0,
      now: new Date(),
    }, DEFAULT_ECONOMY_POLICY);

    const summary = reduceGoldLedger(events, { wallet: walletKey, cycleId: base.cycleId });

    const final = {
      ...base,
      spent: summary.spent,
      available: Math.max(0, base.totalAllowance - summary.spent),
      tinyworldHeld: "22000000", // demo 22m: wire real SPL balance from wallet
      ledgerEvents: events.slice(-5),
      note: "LIVE mmo-core + gold_ledger_events. Full wallet balance + harvest accrual next burst.",
    };

    return jsonResponse(final, origin);
  } catch (err) {
    return errorResponse("gold-calc-failed: " + (err.message || err), 500, origin);
  }
}
