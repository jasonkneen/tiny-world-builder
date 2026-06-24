# Economy — decisions that unblock the gated half

The economy backend (E1 live GOLD, E2 weekly payout, E3 spend) is built, tested, and adversarially hardened — staged behind the launch gate. Everything else the owner asked for (template-purchasing, referrals, paid-AI, Stripe) sits on top of it and is blocked on a small number of **token-economics decisions only the owner can make**. This is the map. Each has a **recommended default the production line will proceed on (building, not launching) unless redirected.**

---

## D1 — How is the GOLD allowance sourced? (blocks E1/E2 going live)
The weekly allowance is computed from $TINYWORLD holdings. Paying off a user-refreshable balance cache is exploitable (stack one balance across many wallets — Codex caught this on E2).

- **Option A — Locked/staked $TINYWORLD.** Only tokens locked for the cycle count. Closes the exploit cleanly; rewards commitment. Cost: needs an on-chain lock/stake mechanism (none exists yet) — biggest build.
- **Option B (RECOMMENDED) — Wallet-held, fresh snapshot at a secret payout time.** The weekly payout reads each holder's balance **fresh on-chain at run time** (not the cache), at a time the attacker can't predict, capped + batched as a background job. Stacking becomes impractical (you'd have to fund every wallet at the unknown payout instant). No staking contract needed. Cost: RPC load (bounded by holder cap + batching).
- **Option C — Hybrid.** Wallet-held now (Option B) with a "lock for a bonus multiplier" added later (Option A as an upgrade).

**Default to proceed on:** B. Unblocks E1/E2 to preview-ready.

## D2 — Is GOLD transferable between players? (blocks template-remix payout + referral payout)
`docs/economy.md` defines GOLD as a **non-withdrawable, non-transferable allowance** (holdings → spending power). But "pay GOLD to remix a template, the author earns GOLD" and "referrals earn GOLD" both imply GOLD moving between players — which contradicts the allowance model.

- **Option A (RECOMMENDED) — Two balances.** Keep **Allowance GOLD** (holdings-based, non-transferable, the current ledger). Add a separate **Earned GOLD / Coins** balance that IS player-to-player transferable (template sales, referral rewards, spendable on the same things). This keeps the holdings model clean and gives a real reward currency. Modest schema add (a second ledger or a balance column).
- **Option B — Allowance bonus, no transfer.** The author/referrer doesn't receive GOLD; instead they get a one-time **bonus added to their next allowance** (`ALLOWANCE_RECALCULATED` + bonus). No transferable balance; simpler; but the reward is capped by the allowance model and feels less like "earning."
- **Option C — Make GOLD fully transferable.** Simplest UX, but abandons the "GOLD is not money" safety stance in economy.md (regulatory/messaging risk).

**Default to proceed on:** A (two balances). It satisfies "pay gold to remix, author earns" and "referrals earn gold" without breaking the holdings-allowance safety model.

## D3 — Referral reward amounts + anti-abuse (blocks G1)
Earn-on-**verified-action**, never on raw click (anti-farming). Referrer is credited only after the referee completes a meaningful action.

- **Trigger:** referee links a wallet AND publishes (or plays) their first world.
- **Amounts (RECOMMENDED default):** referrer +50 Earned GOLD, referee +25; cap **10 rewarded referrals / referrer / week**; block self-referral, same-IP, and throwaway/no-activity accounts.

**Default to proceed on:** the above; **owner sets the final numbers.**

## D4 — Template remix pricing (T1/T2)
- Owner lists a world as a template and sets its **price in Earned GOLD** (min 0, max e.g. 5000).
- On remix: buyer pays the price (E3 spend), **treasury fee 5%** (matches marketplace fee in `DEFAULT_ECONOMY_POLICY`), author receives 95%, the world's data is duplicated into a new draft owned by the buyer, `remix_count++`. Can't remix your own for credit; rate-limited.

**Default to proceed on:** 5% treasury fee, owner-set price within bounds.

## D5 — Stripe (P1) + paid-AI (AI1)
- **Stripe:** BLOCKED on keys — need `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and price IDs for the GOLD packs / premium. Code can be built test-mode-first and flipped live when keys arrive.
- **Paid-AI:** keys exist (`ANTHROPIC`/`OPENROUTER`). Decide the meter: charge **Earned GOLD per generation** (ties to D2-A) and/or a Stripe top-up. Need price points (e.g. 10 GOLD / world-idea generation).

**Default to proceed on:** build Stripe test-mode-first (await keys); build paid-AI metered in Earned GOLD.

---

## What each decision unblocks
| Decision | Unblocks |
|---|---|
| D1 | E1 + E2 → preview-ready (live allowance + weekly payout) |
| D2 | template-remix payout, referral rewards, paid-AI metering |
| D3 | G1 referral system |
| D4 | T1/T2 template marketplace |
| D5 | P1 Stripe, AI1 paid-AI |

**The single highest-leverage call is D2** (two-balance model) — it unblocks templates, referrals, and paid-AI at once. D1 unblocks the payout. With D1+D2 answered (or the defaults accepted), the entire economy half becomes buildable to preview-ready.

---

## DECIDED (owner, 2026-06-24)
- **D1 → Option B: Wallet-held, fresh snapshot.** The weekly payout (E2) must read each holder's balance **fresh on-chain at run time** (at a secret/randomized payout time), NOT the user-refreshable cache. → **Follow-up E2.1:** revise `gold-payout.mjs` to fetch balances via `tokenSummaryForOwner(pubkey, TINYWORLD_TOKEN_MINT)` at run time, fail-closed per holder on RPC error, batch + cap. The freshness-window guard already in E2 is the interim; fresh-read is the target.
- **D2 → Option A: Two balances.** Keep **Allowance GOLD** (holdings-based, non-transferable — the current `gold_ledger_events` ledger). Add a separate **Earned GOLD / Coins** balance that IS player-to-player transferable. → **New work EC1:** a `coin_ledger`/balance + an atomic transfer+spend primitive (same advisory-lock + idempotency discipline as E3). Template sales (T2), referral rewards (G1), and paid-AI (AI1) all credit/debit **Earned GOLD**, NOT Allowance GOLD.
- **D3/D4/D5:** proceeding on the recommended defaults (referrer +50 / referee +25 earned-gold, 10/week cap; 5% treasury fee on remix; Stripe test-mode-first awaiting keys; paid-AI metered in Earned GOLD). Owner can adjust amounts any time.

**Build order unblocked:** EC1 (Earned GOLD ledger + transfer/spend) → T1/T2 (template list + paid remix) and G1 (referrals) on top → E2.1 (fresh-snapshot payout) → AI1 (paid-AI in Earned GOLD) → P1 (Stripe, on keys). All staged behind the launch gate until preview-ready.

_Authored 2026-06-24 by the production line. Decisions captured; the line builds the rest on this model._
