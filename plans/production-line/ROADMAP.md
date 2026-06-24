# Production Line — Work Queue

Prioritised backlog for the autonomous production line (see `ORCHESTRATION.md`). The orchestrator picks the highest-priority unblocked feature, runs the pipeline, ships, and moves on. IDs match `status.json.pipeline[].id`.

---

## What already exists (do NOT rebuild — verified 2026-06-24 by 4 parallel scouts)

**Economy backend is ~70% built and secure:**
- `netlify/functions/gold.mjs` — `GET /api/me/gold`; real ledger + tier math via `mmo-core/economy.js`. **Gap: `tinyworldHeld` hardcoded `"22000000"` at line ~56 instead of reading the wallet's real SPL balance.**
- `netlify/functions/wallet.mjs` — wallet link, Ed25519 login/connect, live SPL balance read (`tokenSummaryForOwner`), 30-day sessions. Real.
- `netlify/functions/wallet-payments.mjs` — Solana Pay intents to treasury. Real (on-chain verify happens in world-claim).
- `netlify/functions/world-claim.mjs` — island purchase: server-side price re-validation, **on-chain USDC verification**, race-safe atomic ownership flip, txn-wrapped bookkeeping. Strong.
- `netlify/functions/world-resources.mjs` — service-token (PartyKit-only) resource/tax/gold crediting; server-clamped deltas, idempotent gold events. **Gap: `goldEvents` block nested inside the `resources` loop (wasteful, idempotent-safe) — fix in E4.**
- `packages/tinyworld-mmo-core/src/economy.js` — pure lib: `calculateGoldAllowance` (tiered + sqrt), `currentCycleId`, `reduceGoldLedger`, `spendGold`, `applyIslandTax`, `clampTaxRate`. `spendGold` is implemented but **no endpoint calls it** (E3).
- DB schema (Postgres): `profiles, wallet_accounts, wallet_payment_intents, worlds, player_resources, tax_ledger, world_claims, world_market_listings, world_economy_state, gold_ledger_events, builds, world_shares, asset_libraries`. Migrations in `netlify/database/migrations/`.

**Security already in place:** server-authority on credits, on-chain USDC verify (fail-closed), atomic ownership flips, `sameOriginWriteGuard`, Ed25519 verify, constant-time service-token compare, payment-intent↔profile binding, server-clamped deltas, batch caps, idempotent gold events. **Missing: per-function rate limiting.**

**Site/content:** news is hardcoded HTML in `news.html` (`<ol class="news-timeline">`). Roadmap + features are DB-driven (`roadmap_milestones`, `feature_suggestions`, both with a `wave` column) rendered by `roadmap.html`/`features.html` from `/api/roadmap` & `/api/features`. Home hero (`index.html` ~143-176) has a right-side `.hero-feed` aside (currently hidden) — natural slot for a template carousel. Deploy = `./publish.sh` → `dist/` → Netlify. No Twitter tooling.

**Worlds:** `worlds` table, `data` JSONB (world.schema v4 cells). Save=`saveDraft`, publish/unpublish actions in `worlds.mjs`. Previews computed on-the-fly from JSONB (`worldPreview`/`renderPreview`) — **no stored thumbnails**. No `template` kind, no remix/duplicate, no template gallery.

---

## Priority 1 — Economy backend (secure, "not hackable") — IN PROGRESS

- **E1 — Live $TINYWORLD → GOLD.** Replace the hardcoded `tinyworldHeld` in `gold.mjs` with the authenticated user's real SPL balance from `wallet_accounts.token_balance_atomic` (refresh via `tokenSummaryForOwner` against `TINYWORLD_TOKEN_MINT`). Snapshot the balance at read time; degrade gracefully to 0-tier if no wallet/mint. Security: never trust a client-supplied balance. **Opus.**
- **E2 — Weekly GOLD payout scheduler.** A scheduled job (Netlify scheduled function / cron) that at each weekly `currentCycleId` boundary snapshots each linked wallet's holdings and writes one `ALLOWANCE_RECALCULATED` gold-ledger event per wallet (idempotent on (wallet, cycle_id)). Holdings-based, per the economy guide. **Opus.**
- **E3 — GOLD-spend endpoint.** `POST /api/me/gold/spend` (authenticated, same-origin guarded, idempotent via a client-supplied idempotency key) that calls `spendGold()`, checks available allowance for the current cycle, and writes a `GOLD_SPENT` event atomically. The single server-authoritative debit path all gameplay/purchases use. **Sonnet** (Opus reviews — money path).
- **E4 — Fix `goldEvents` loop-nesting bug** in `world-resources.mjs`. Move the gold-events block out of the `resources` for-loop. Add a regression test. **Haiku.**
- **E5 — Rate limiting** on economy/auth endpoints (token-bucket keyed by profile+IP; reuse the PartyKit `RATE_LIMITS` pattern if portable, else a lightweight per-function limiter). **Sonnet.**

## Priority 2 — World templates & sharing (GOLD-earning)

- **T1 — Template schema + remix.** Add `is_template BOOLEAN`, `template_gold_cost BIGINT`, `template_author_id BIGINT`, `remix_count INT`, `thumbnail TEXT` to `worlds` (migration). Add `action:'listAsTemplate'` (owner sets a GOLD price) and `action:'remixTemplate'` (deep-copies the `data` JSONB into a new draft owned by the buyer). **Sonnet.**
- **T2 — Spend GOLD to remix.** Wire `remixTemplate` to the E3 spend path: debit buyer's GOLD by `template_gold_cost`, credit the author (minus a small treasury fee), increment `remix_count`. Atomic. Anti-abuse: can't remix your own for credit; rate-limited. **Sonnet** (Opus reviews).
- **T3 — Templates API + home carousel.** `GET /api/templates` (public, paginated, sorted by remix_count/recency). A cycling carousel in the `index.html` hero (`.hero-feed` slot) showing template previews; a `/templates` gallery page; "Remix for N GOLD" CTA. **Sonnet.**
- **T4 — Thumbnails.** Capture a real preview image when a world is listed as a template (client canvas → PNG upload, or server render) and store the URL in `worlds.thumbnail`. Falls back to the on-the-fly `renderPreview` if absent. **Sonnet.**

## Priority 3 — Gamification

- **G1 — Referrals (earned, not given).** Referral codes per profile; a referred user earns the referrer GOLD only after the referee completes a **verified meaningful action** (links a wallet AND publishes/plays a world), not on click. Caps per referrer per cycle; fraud checks (same-IP, self-referral, throwaway accounts). Owner signs off amounts. **Sonnet.**
- **G2 — Leaderboard.** `GET /api/leaderboard` (top users by a composite of worlds published, remixes earned, resources gathered, referrals) + a `/leaderboard` page in theme. Cached. **Sonnet.**
- **G3 — Achievements & pixel badges.** An achievements table + award path hooked to economy/world events; pixelized badge icons designed by **Codex** (graphics). Badge shelf on the profile. **Sonnet + Codex.**

## Priority 4 — Payments & AI

- **P1 — Stripe.** Buy GOLD packs / premium membership via Stripe Checkout + webhook → credits GOLD via E3 path. **BLOCKED on Stripe keys.** Build the code + test-mode wiring; flip live when keys arrive. **Sonnet.**
- **AI1 — Metered paid-AI features.** Pay (GOLD or Stripe) for AI generations (world ideas, NPC dialogue, build assists) metered server-side. Keys exist (`ANTHROPIC/OPENAI/OPENROUTER`). **Sonnet.**

## Continuous (every ship + daily)

- News post per ship (`news.html` → later a structured source). Tweet draft per ship (`tweets/`). Daily roundup post. `status.json` after every stage.

---

## Open decisions for the owner (don't block — sensible defaults applied)
1. GOLD tier amounts — using `docs/economy.md` defaults (100/500/1500/2500 weekly). Override?
2. Referral payout amounts + caps (G1).
3. Template remix treasury-fee % (T2) — default 5% to match marketplace fee.
4. Provide X/Twitter + Stripe creds when ready (see ORCHESTRATION §5).
