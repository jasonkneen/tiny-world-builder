-- E2 weekly GOLD payout idempotency.
-- The weekly payout job writes exactly ONE authoritative ALLOWANCE_RECALCULATED row
-- per (wallet, cycle_id). gold_ledger_events had only non-unique indexes, so an
-- INSERT ... ON CONFLICT could not dedupe. This partial unique index makes the
-- payout idempotent: re-running the job within a cycle is a no-op, and each new
-- weekly cycle_id gets a fresh row. GOLD_SPENT / GOLD_REFUNDED stay append-only
-- (the partial predicate only covers the allowance type).
CREATE UNIQUE INDEX IF NOT EXISTS uq_gold_allowance_wallet_cycle
  ON gold_ledger_events (wallet, cycle_id)
  WHERE type = 'ALLOWANCE_RECALCULATED';
