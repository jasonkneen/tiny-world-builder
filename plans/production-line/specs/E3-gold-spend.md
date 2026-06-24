# E3 — Server-authoritative GOLD spend endpoint (spec)

Status: ready to implement (Sonnet build, Opus review). Economy launch gate: HELD.
Author: Opus, 2026-06-24. (Codex spec-draft was attempted but timed out repeatedly this session; authored directly. Re-run Codex review at build time.)

## Goal
The single server-authoritative path that debits a player's GOLD. Every gameplay/purchase that costs GOLD (template remix, upgrades, AI generations, etc.) calls this. Non-withdrawable currency; assume the client is hostile.

## Invariant (do not violate)
Spendable GOLD = the **ledger-derived** `available` for the **current weekly cycle** = `reduceGoldLedger(events,{wallet,cycleId})` → `allowance (from latest ALLOWANCE_RECALCULATED) − spent + refunded`. NEVER derive spendable GOLD from a live wallet-balance projection (that's `gold.mjs`'s display-only number; see E1). If no `ALLOWANCE_RECALCULATED` exists for the cycle yet, `available = 0` → spends are rejected. (E2 writes the allowance weekly.)

## Endpoint
- `POST /api/me/gold/spend` — `export const config = { path: '/api/me/gold/spend' }`.
- Auth: `requireAuthUser` → `ensureProfile` (canonical pattern). `sameOriginWriteGuard`. 401/403 on failure.
- Wallet key: `'profile:' + profile.id`.
- Request body (JSON):
  - `amount` (integer > 0, ≤ `MAX_SPEND_PER_REQUEST` e.g. 100000)
  - `action` (string, from an allowlist: `template-remix`, `upgrade`, `ai-generation`, …)
  - `idempotencyKey` (string, client-generated UUID; required) → stored as `reference_id`
  - `referenceId` optional domain reference (e.g. template id) — folded into `reason`/metadata, NOT the idempotency key
- Response 200: `{ ok: true, spent: amount, available: <new available>, cycleId, eventId }`.
- Response 4xx: `{ ok: false, reason }` — `insufficient-gold` (402), `invalid-amount` (400), `rate-limited` (429), `action-not-allowed` (400).

## Debit algorithm (atomic, race-safe)
GOLD_SPENT rows are append-only, so two concurrent spends could both read the same `available` and both insert → overspend. Prevent with a **per-wallet advisory lock inside a transaction**:

```
BEGIN;
  SELECT pg_advisory_xact_lock(hashtext($wallet));     -- serialize spends for THIS wallet
  -- idempotency short-circuit:
  SELECT id, amount FROM gold_ledger_events
    WHERE wallet=$wallet AND type='GOLD_SPENT' AND reference_id=$idempotencyKey;
  -- if found -> COMMIT and return ok with the existing row (idempotent replay)
  -- else:
  load all events for ($wallet,$cycleId); available = reduceGoldLedger(...).available;
  if available < amount -> ROLLBACK, return 402 insufficient-gold;
  INSERT INTO gold_ledger_events (wallet, cycle_id, type, amount, reason, reference_id)
    VALUES ($wallet,$cycleId,'GOLD_SPENT',$amount,$action,$idempotencyKey);
COMMIT;
```

The advisory xact lock guarantees serialization per wallet, so `available` cannot be double-read. Lock is released at COMMIT/ROLLBACK. Cross-wallet spends never contend.

## Idempotency
- Migration: partial unique index `uq_gold_spent_wallet_ref ON gold_ledger_events (wallet, reference_id) WHERE type='GOLD_SPENT' AND reference_id IS NOT NULL`.
- The advisory-lock check above + this index make retries safe even without the lock (the INSERT would conflict). Use `ON CONFLICT (wallet, reference_id) WHERE type='GOLD_SPENT' AND reference_id IS NOT NULL DO NOTHING RETURNING id`; if no row returned, fetch+return the prior spend.

## Validation & abuse
- `amount`: integer, `> 0`, `≤ MAX_SPEND_PER_REQUEST`. Reject non-integers/negatives/zero.
- `action`: must be in the server allowlist.
- `idempotencyKey`: required, length-bounded, charset-bounded.
- Rate limit per profile (token bucket; reuse the pattern used elsewhere, e.g. PartyKit RATE_LIMITS, or a lightweight per-function limiter): e.g. 30 spends/min/profile.
- `sameOriginWriteGuard`; auth required. Never read `amount`/balance from anything client-controlled beyond the requested spend amount (which is validated against the server-computed available).
- Cap total events scanned (a cycle's events per wallet are few; fine).

## Refund path (note, may be a sibling endpoint E3.1)
If a downstream action that consumed GOLD fails (e.g. remix duplication errors), issue a `GOLD_REFUNDED` event for the same `amount` referencing the original spend's `reference_id`, restoring `available`. Same advisory-lock + idempotency discipline.

## Consumption wiring
- `gold.mjs` (`GET /api/me/gold`) should, once E1+E2+E3 merge, report `available` from the ledger (`reduceGoldLedger`) as authoritative, with the live-balance figure marked `projection` (already done in E1). This unifies display and spend on the ledger.

## Acceptance criteria
1. A spend ≤ available succeeds, writes exactly one GOLD_SPENT, and the returned `available` decreases by `amount`.
2. A spend > available returns 402 and writes nothing.
3. Two concurrent spends that together exceed `available` → exactly one succeeds, one gets 402; never overspend.
4. The same `idempotencyKey` retried returns the same result and writes exactly one row.
5. Negative/zero/non-integer/oversized amount → 400, no write.
6. Unauthenticated / cross-origin → 401/403.
7. No `ALLOWANCE_RECALCULATED` for the cycle → `available=0` → all spends 402.

## Adversarial test plan
- **Double-spend race:** fire N concurrent spends of `available/2 + 1`; assert exactly one succeeds (integration test against a real/seeded DB, or a documented manual harness since unit tests can't exercise pg advisory locks).
- **Replay/idempotency:** same key ×5 → one row, identical responses.
- **Insufficient funds, cross-profile (spend on someone else's wallet — must be impossible: wallet derived from auth, not request), negative amount, cycle boundary (spend in cycle N doesn't affect N+1).**
- **Pure-unit:** extend the mmo-core tests for `spendGold`/`reduceGoldLedger` edge cases (already partly covered).

## Open questions for the owner
- `MAX_SPEND_PER_REQUEST` and per-minute rate limit values.
- Whether GOLD can be spent in player-to-player trades or only system actions (economy.md open decision).
- Refund policy: auto-refund on downstream failure vs manual.
