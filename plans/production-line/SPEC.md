# TinyWorld Wave 2 + Economy — Specification & Executable Roadmap

Canonical reference for the Wave 2 feature set and the in-app economy. Written from the
shipped system (every section below maps to code that exists in the repo). Source inputs:
the Wave 2 list on the website, the Economy Guide PDF (`docs/`), and owner direction in
this session. Status legend: **LIVE** (on prod), **GATED** (on prod, behind tinyverse
access — owner-only dark launch), **INERT** (shipped but needs credentials), **PENDING**
(not built / owner-blocked).

---

## 1. Economy model

Two distinct balances (owner decision **D2**, two-balance model):

| Balance | Table | Source | Transferable | Purpose |
|---|---|---|---|---|
| **Allowance GOLD** | `gold_ledger_events` | weekly, from `$TINYWORLD` holdings | No | a holdings-based stipend you can spend in-app |
| **Earned GOLD** (Coins) | `coin_balances` / `coin_ledger` | activities (sales, referrals, resource sales) | Yes | the spendable, transferable in-app currency |

Why two: allowance rewards holders without being a transferable asset (avoids it reading
as a security/payout); Earned GOLD is the working currency users gather and spend.

**Allowance tiers** (holdings → weekly allowance), from `packages/tinyworld-mmo-core`:
Bronze 1k→100, Silver 10k→500, Gold 50k→1500, Mythic 100k→2500. Holdings read fresh at
payout (owner decision **D1**, wallet-held fresh snapshot).

---

## 2. Data model (economy tables)

All additive, applied to the live DB; inert for non-economy code.

- `gold_ledger_events` — allowance GOLD ledger (ALLOWANCE_RECALCULATED / spend events); partial unique `uq_gold_allowance_wallet_cycle` for idempotent weekly grants.
- `coin_balances` (profile_id PK, balance) + `coin_ledger` (signed deltas, type/sign CHECK, unique `(profile_id, reference_id)` for idempotency) — Earned GOLD.
- `world_shares` + template columns (`is_template`, `template_price`, `template_author_id`, `remix_count`) — user-built worlds shared to home + listable as templates.
- `share_remixes` — durable remix op log, unique `(buyer_profile_id, idempotency_key)`.
- `referrals` + `referral_reward_counters` + `profiles.referral_code` — referral attribution + per-window cap counter.
- `ai_generations` (input_hash, status pending/completed/failed) — paid-AI op log, reserve-first.
- `stripe_payments` (session_id UNIQUE, status pending/completed/refunded) — buy-GOLD order/idempotency log.
- `resource_sales` — harvest→GOLD sale op log, unique `(profile_id, idempotency_key)`.
- `player_resources` (fish/meat/plants/ore/gold) — the harvest/farming/mining inventory (pre-existing).

---

## 3. API surface (economy — all GATED behind tinyverse access)

| Endpoint | Method | Purpose | Status |
|---|---|---|---|
| `/api/me/gold` | GET | allowance GOLD balance (live `$TINYWORLD` → tiers) | GATED |
| `/api/admin/gold-payout` | GET/POST | weekly allowance payout (dry-run / execute) | ADMIN-SECRET (`x-admin-secret`, not the tinyverse gate) |
| `/api/me/gold/spend` | POST | spend allowance GOLD (ledger-authoritative) | GATED |
| `/api/me/coins` | GET | Earned GOLD balance + recent ledger | GATED |
| `/api/worlds/template` | POST | list/unlist a `world_shares` world as a template | GATED |
| `/api/worlds/remix` | POST | pay GOLD → duplicate a template into your builds | GATED |
| `/api/worlds/featured?templates=1` | GET | template marketplace listing | GATED |
| `/api/me/referral` | GET | your referral code/link + counts | GATED |
| `/api/ai/generate` | POST | paid AI (world-idea/name/build-tips), metered in Earned GOLD | GATED |
| `/api/stripe/checkout` | POST | buy a GOLD pack (Checkout Session) | GATED + INERT |
| `/api/stripe/webhook` | POST | credit GOLD on paid order (signature-verified) | INERT |
| `/api/me/resources/sell` | POST | sell harvested resources → Earned GOLD | GATED |

Public (open) surface: `/api/worlds/featured` (home carousel), `/api/home-worlds`
(community worlds), `/api/leaderboard`, `/api/builder`.

---

## 4. Security model

- **Dark-launch gate**: `requireTinyverseAccess(user, origin)` (`lib/tinyverse-access.mjs`) returns 403 for non-allowlisted accounts; applied after auth on every money surface. The public carousel/leaderboard stay open. Allowlist = the owner's verified emails (env-overridable).
- **Authorization on verified email only** (PR #87, prod) — never the editable `profiles.email`.
- **Money-path invariants** (enforced + adversarially reviewed per slice): server-authoritative prices/amounts (client names only ids/quantities); idempotency bound to the operation body (not just a key); `pg_advisory_xact_lock` per actor; `FOR UPDATE` on sources; charge/credit only on full-transaction success; fixed-length hashed coin refs; amount caps (`MAX_COIN_AMOUNT`).
- **Review discipline**: every money path got an adversarial Codex pass; ~42 findings caught and fixed; the high-value flows (remix, coins, referral, Stripe credit, resource sale) were verified against the live DB with guarded create→test→cleanup smokes.

---

## 5. Wave 2 feature status

| Feature (from the brief) | Status | Where |
|---|---|---|
| In-app currency from coin holdings | GATED | E1/E2/E3 |
| Wallet/Earned GOLD + transfers | GATED | EC1 (`lib/coins.mjs`) |
| Weekly payout on holdings | GATED | E2 |
| Farming/mining/harvesting → currency | GATED | E5 (`/api/me/resources/sell`) |
| Share worlds to home + carousel | LIVE | PR #91 (`/api/home-worlds`, full-width strip) |
| List world as template for GOLD + remix | GATED | T2c (on `world_shares`) |
| Referral links earn GOLD (earned, anti-Sybil) | GATED | G1 |
| Leaderboard | LIVE | `/leaderboard` |
| Badges / pixel reward icons | LIVE | `/badges` (6 hand-crafted SVG; Codex retry = open polish) |
| Builder profiles | LIVE | `/builder` |
| Paid AI | GATED | AI1 |
| Stripe (buy GOLD) | INERT | P1 (needs keys) |

---

## 6. Launch plan

1. **Now**: economy dark-launched on prod, gated to the owner. Owner does the signed-in three-state smoke (out → blocked; non-owner → blocked; owner → works).
2. **Public launch**: relax `requireTinyverseAccess`. Pre-reqs: legal/risk-disclosure review (the Economy Guide flags this), and the signed-in smoke passing.
3. **Payments live**: add `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (restricted key recommended); point a Stripe webhook at `/api/stripe/webhook`.
4. **Automation**: X/Twitter keys → auto-post the queued news/tweets; optional autonomous hourly cron (owner go required).

---

## 7. Open decisions / follow-ups (owner)

- **Go public** (relax the gate) — yes/when.
- **Stripe keys** + **X/Twitter keys**.
- **Autonomous cron** yes/no.
- Polish: Codex pixel-badge redesign; a sell-resources + buy-GOLD UI panel on `/rewards`; surface "Share to home / list as template" controls in the builder.
- Economics tuning: referral amounts (referrer +50 / referee +25, cap 10/wk), treasury fee (5%), resource→GOLD rates (plants/fish 1, meat 2, ore 3).
