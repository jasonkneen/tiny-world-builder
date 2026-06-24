# TinyWorld Economy + Wave 2 — Test Plans

Test plans for every economy/Wave-2 feature. Grounded in what's actually verified:
**238 automated unit tests** (`node --test tests/*.test.mjs`), **per-money-path live-DB
smokes** (guarded create→assert→cleanup), and **adversarial Codex review** on each money
path (the BLOCK findings became the negative test cases below). Legend: **[U]** covered by
a unit test, **[S]** covered by a live-DB smoke run this session, **[A]** adversarial case
(must stay rejected), **[M]** manual owner smoke (needs a signed-in session).

Build gate before any ship: `npm run check` (dup-identifier + i18n) AND `node --test tests/*.test.mjs` green.

---

## 0. Dark-launch gate (`requireTinyverseAccess`) — applies to ALL economy endpoints
| ID | Case | Expected |
|---|---|---|
| GATE-1 [U] | owner allowlist email (any case/whitespace) | allowed (gate returns null) |
| GATE-2 [U] | non-owner email / empty / missing `user.email` | 403 `tinyverse-access-required` |
| GATE-3 [U] | lookalike (`jason@bouncingfish.com.evil.com`, `notjason@…`) | rejected |
| GATE-4 [U] | `TINYVERSE_ACCESS_EMAILS` env adds an email | that email allowed; strangers still 403 |
| GATE-5 [M] | three-state on prod: signed-out → 401; signed-in non-owner → 403/empty; signed-in owner → works | as stated |
| GATE-6 [S] | every money endpoint (`coins/referral/ai-generate/world-remix/world-template/gold/gold-spend/stripe-checkout/resources-sell` + `featured?templates=1`) | all gated; public carousel/leaderboard open |

## 1. Allowance GOLD (E1 balance / E2 payout / E3 spend)
| ID | Case | Expected |
|---|---|---|
| GOLD-1 | `/api/me/gold` with real `$TINYWORLD` holdings | tier + allowance per mmo-core tiers |
| GOLD-2 [U] | tier boundaries (1k/10k/50k/100k) | Bronze/Silver/Gold/Mythic |
| PAY-1 [A] | weekly payout re-run within the freshness window | 409 abort, no stacked double-grant (`uq_gold_allowance_wallet_cycle`) |
| PAY-2 [A] | cap-exceeded batch | fail-closed (no over-grant) |
| PAY-3 | dry-run (GET) vs execute (POST), admin secret required | dry-run mutates nothing; missing/short secret → reject (hashed compare) |
| SPEND-1 [A] | spend with non-deterministic allowance ordering | deterministic ORDER BY; consistent available |
| SPEND-2 [A] | replay same idempotency key + different amount | rejected (idempotency bound to amount) |
| SPEND-3 [A] | a second concurrent GOLD writer | advisory lock serializes; no double-spend |

## 2. Earned GOLD / Coins (EC1)
| ID | Case | Expected |
|---|---|---|
| COIN-1 [S] | credit then read balance | balance reflects credit; ledger row written |
| COIN-2 [A][S] | replay same `reference_id` | no double credit (unique `(profile_id, reference_id)`) |
| COIN-3 [A] | transfer that half-applies (debit ok, credit fails) | whole tx rolls back |
| COIN-4 [A] | debit below zero / invalid amount / amount > `MAX_COIN_AMOUNT` | rejected, balance unchanged |
| COIN-5 [A] | ledger sign vs type mismatch (CREDIT with negative delta) | CHECK constraint rejects |

## 3. Template marketplace + remix (T2c — on user-built `world_shares`)
| ID | Case | Expected |
|---|---|---|
| TPL-1 [M] | builder "List" → share → price prompt → `/api/worlds/template` | world listed; appears on `/templates` |
| TPL-2 [A] | list a share you don't own | 403/no-rows (ownership in the UPDATE predicate) |
| RMX-1 [S] | remix a template (buyer ≠ author) | buyer −price, author +95%, build duplicated, `remix_count++` |
| RMX-2 [A][S] | replay same idempotency key (same share) | no double charge/duplicate (`share_remixes` unique) |
| RMX-3 [A] | reuse a key for a DIFFERENT share | 409 `idempotency-key-reused` |
| RMX-4 [A] | self-remix (buyer == author) | rejected |
| RMX-5 [A] | insufficient coins | rejected, nothing duplicated, no charge |
| RMX-6 [A] | concurrent remixes of the same template | advisory lock + `FOR UPDATE` serialize; no over/under-credit |
| RMX-7 [A] | deleted author (`profile_id` NULL) | `profile_id IS NOT NULL` guard excludes it |

## 4. Referrals (G1)
| ID | Case | Expected |
|---|---|---|
| REF-1 | referee joins via a valid code → publish | referrer +50, referee +25 (once) |
| REF-2 [A] | cap (10/window) under concurrency | atomic `referral_reward_counters`; never exceeds cap |
| REF-3 [A] | Sybil (unverified wallet) | reward withheld (verified-wallet gate) |
| REF-4 [A] | self-referral / re-attribution | rejected |

## 5. Paid AI (AI1)
| ID | Case | Expected |
|---|---|---|
| AI-1 [S] | generate with sufficient coins | provider call, coins debited once, result returned |
| AI-2 [A] | provider fails after reserve | atomic refund-and-fail; balance restored |
| AI-3 [A] | crash between reserve and completion | stale-pending resume (PENDING_TIMEOUT_MS); no lost/double charge |
| AI-4 [A] | rapid fan-out (same input_hash) | reserve-first prevents free griefing |

## 6. Stripe buy-GOLD (P1)
| ID | Case | Expected |
|---|---|---|
| STR-1 [U] | webhook signature valid/fresh | event parsed |
| STR-2 [A][U] | tampered body / wrong secret / expired ts / malformed header | rejected (no credit) |
| STR-3 [A][S] | webhook redelivery (same session) | credited once (pending→completed transition + coin ref) |
| STR-4 [A][S] | forged session with no pending order we created | NO credit (provenance) |
| STR-5 [A] | client tries to set coins/price | ignored — server pack catalog authoritative |
| STR-6 | async payment success event | credited (handles `async_payment_succeeded`) |
| STR-7 [M] | keys absent | `/checkout` 503, UI shows "coming soon" |

## 7. Harvest → GOLD (E5 resource sell)
| ID | Case | Expected |
|---|---|---|
| SELL-1 [U] | rate math (plants/fish 1, meat 2, ore 3) | gold = Σ amount·rate; unknown keys/negatives/fractions ignored |
| SELL-2 [S] | sell 10 fish+5 meat+2 ore (have ≥) | +26 GOLD, resources debited exactly, build of inventory correct |
| SELL-3 [A][S] | oversell (amount > held) | 409 insufficient; nothing debited/credited |
| SELL-4 [A][S] | replay same key (same body) | no double credit |
| SELL-5 [A] | same key + different body | 409 `idempotency-key-reused` |
| SELL-6 [A] | oversized sale (> `MAX_COIN_AMOUNT`) | 400 `sale-too-large` before the tx (not a 500) |

## 8. Public Wave 2 surfaces (no auth)
| ID | Case | Expected |
|---|---|---|
| PUB-1 | `/api/home-worlds`, `/api/worlds/featured` | 200, safe fields only (no email/PII), cells bounded in SQL |
| PUB-2 | `/api/leaderboard`, `/api/builder` | 200, no email/PII |
| PUB-3 [M] | home carousel renders user-built worlds full-width under hero | previews draw, cards open `?share=<id>` |
| PUB-4 [M] | `/badges` | 10 badges render (incl. 4 economy pixel badges) |

## 9. Manual owner end-to-end smoke (the golden path) [M]
1. Sign in (allowlisted) → `/rewards` shows Earned GOLD + referral link.
2. Harvest in a world → `/rewards` → "Sell all for N GOLD" → balance increases by N.
3. Builder → save a world → "List" → set price → confirm it appears on `/templates`.
4. From a second (allowlisted) account, remix it → GOLD moves buyer→author, a copy lands in builds.
5. Confirm a non-allowlisted account sees the public site only (economy 401/403, "private testing").

---

### Regression guard
Any new money path: add a `[U]` rate/validation test, run a guarded live-DB `[S]` smoke
(create→assert→cleanup), and an adversarial Codex pass; the BLOCK findings become new `[A]`
rows here before merge.
