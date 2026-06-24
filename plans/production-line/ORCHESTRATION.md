# TinyWorld Autonomous Production Line

A continuous, multi-agent delivery system that ships a feature roughly every hour, every day this week, leading into Wave 2. Humans and agents co-develop the game and website. This document is the operating manual; `ROADMAP.md` is the prioritised work queue; `status.json` is the live machine-readable state (rendered by `mission-control.html`).

Authored 2026-06-24. Owner: Jason Kneen.

---

## 0. Operating principles (non-negotiable)

1. **Build live, in small pieces.** One vertical slice per delivery. Never a big-bang.
2. **Worktrees + PRs + adversarial review.** Every feature lands through a branch in a git worktree, opened as a PR, and is adversarially reviewed (Codex GPT + a Claude review agent) before merge. No feature reaches `main` unreviewed.
3. **Security is priority zero for anything touching the economy.** Server-authority, idempotency, no client-trusted balances, on-chain verification where money moves. We assume an attacker is reading the code.
4. **Reuse, don't rebuild.** The economy backend is ~70% built (see `ROADMAP.md` §"What already exists"). Extract and extend; never reimplement what works.
5. **Cost discipline via model tiering.** Opus only where it earns its keep; Sonnet for most building; Haiku for mechanical work. See §3.
6. **Every ship is visible.** A feature is not "done" until: PR merged → news post published → tweet drafted/posted → `status.json` updated. No silent ships.
7. **No emoji. SVG glyphs only. Verify in a real browser/runtime, not synthetic events.** (Project rules.)
8. **Surface blockers, don't stall.** If a feature needs a secret or a human decision, mark it `blocked` in `status.json`, build everything around the blocker, and keep moving down the queue.
9. **ECONOMY LAUNCH GATE (owner directive, 2026-06-24).** Nothing touching the tinyverse / proper economy (GOLD allowance, payouts, spend, wallet-to-wallet, templates-for-GOLD, referral GOLD, Stripe, paid-AI) ships to production until the owner says the economy is **preview-ready**. Build it, review it adversarially, open the PR, run the tests — but keep these as **draft / held PRs** (title prefix `[HOLD: economy preview]`). Non-economy work (news, the private dashboard, UI shells without live currency) ships normally. The orchestrator must NOT auto-merge any held economy PR.

---

## 1. The loop (overarching)

```
                 ┌─────────────────────────────────────────────┐
                 │  ORCHESTRATOR (Opus, this session)           │
                 │  - owns ROADMAP.md priority queue            │
                 │  - picks next unblocked feature              │
                 │  - runs the per-feature pipeline (§2)        │
                 │  - updates status.json after every stage     │
                 │  - re-arms hourly via ScheduleWakeup         │
                 └───────────────┬─────────────────────────────┘
                                 │ one feature at a time (or 2 in parallel if independent)
                                 ▼
        ┌────────────────────────────────────────────────────────┐
        │  PER-FEATURE PIPELINE (§2)                               │
        │  SPEC → BUILD → REVIEW(adversarial) → TEST → PR → MERGE  │
        │       → NEWS → TWEET → STATUS                            │
        └────────────────────────────────────────────────────────┘
```

**Cadence.** Target one shipped feature per hour during active hours. The orchestrator paces itself with `ScheduleWakeup` (dynamic `/loop`): after finishing a delivery it schedules the next wake-up so the line keeps moving even across idle periods. The hour is a *target*, not a deadline — a security-critical economy slice may take two cycles; that is acceptable. Quality and "not hackable" beat the clock.

**Loop exit.** The loop runs until the Wave 2 queue (`ROADMAP.md` priorities 1–3) is drained or the owner stops it. Priority 4 (Stripe, paid-AI) and continuous content (news/tweets) keep the line busy afterward.

---

## 2. Per-feature pipeline (the production stages)

Each feature in `ROADMAP.md` flows through these stages. `status.json.pipeline[].stage` tracks where it is.

| Stage | Who | Output |
|---|---|---|
| **spec** | Codex GPT (architect/scope) + a Claude verification agent | A tight spec in `plans/production-line/specs/<ID>.md`: data model deltas, API contract, security model, acceptance criteria, test plan. Codex writes the first draft; a Claude sub-agent adversarially checks it against the codebase for correctness (does this table/field/endpoint already exist? does it match conventions?). |
| **build** | Sonnet (default) / Haiku (mechanical) / Opus (security-critical economy) in a **git worktree** | Working code on a feature branch `pl/<ID>-<slug>`. New backend = Netlify function + migration; new client module = `engine/world/NN-*.js` IIFE (shared global scope — `tools/check.js` fails on duplicate top-level identifiers). |
| **review** | **Adversarial**: Codex GPT (code/security reviewer) + Claude `code-review` | Both attack the diff. Codex via `codex exec` (see §4). For economy/auth/payment code, also the security-review pass. Findings either fixed or explicitly waived with rationale. A finding of "real bug" blocks merge. |
| **test** | Test Engineer sub-agent | A test plan doc + automated tests where feasible (`tests/*.test.mjs`, run with the repo's test runner). Manual/browser verification steps for UI. For economy: adversarial test cases (double-spend, replay, negative amounts, cross-profile, race). |
| **pr** | Orchestrator | `gh pr create` from the worktree branch. PR body links the spec, the review verdicts, and the test plan. |
| **merge** | Orchestrator (after review is green) | `gh pr merge`. Then `publish.sh` if the change is view-facing (the served app is built `dist/`, not source — see memory). |
| **news** | Haiku | A new `<li>` entry prepended to `news.html` timeline (and, once T-content lands, to a structured news source). |
| **tweet** | Haiku → owner | Draft a tweet for the TinyWorld account. Posting is **blocked** until X/Twitter API creds exist (see §5). Until then, drafts accumulate in `plans/production-line/tweets/` for the owner to post. |
| **status** | Orchestrator | Update `status.json`: bump stats, move the card to `shipped`, append to `feed`. |

**Parallelism.** Independent features (e.g. an economy backend slice + a gamification frontend slice) may run two pipelines at once via parallel sub-agents in separate worktrees. Features that touch the same files run sequentially (file-conflict rule). The orchestrator never lets two agents edit the same file.

---

## 3. Model assignment (token discipline)

| Tier | Used for |
|---|---|
| **Opus** (orchestrator + this session) | Orchestration, architecture decisions, security-critical economy/auth/payment code, final go/no-go on merges, adversarial review synthesis. |
| **Sonnet** | Most feature implementation, spec drafting, frontend, API endpoints, test authoring. The workhorse. |
| **Haiku** | Mechanical edits, news-post drafting, tweet drafting, `status.json` updates, i18n string additions, doc formatting. |
| **Codex (GPT)** | Spec first-drafts, design/graphics (pixel badges, icons), and the adversarial review/security pass. Invoked via `codex exec` (§4). |

Rule of thumb: if a task is "follow a clear pattern that already exists in the repo," it's Sonnet or Haiku. If it's "decide how money/ownership/state is protected," it's Opus.

---

## 4. Adversarial review with Codex

Codex is invoked from the CLI (the MCP tool is not reliably wired — see memory `how-to-ask-codex`):

```
codex exec -s read-only - <<'EOF'
You are an adversarial code+security reviewer. Here is a diff that changes the TinyWorld
in-game economy. Assume an attacker controls the client. Find every way to: mint GOLD,
double-spend, replay a payout, forge a balance, bypass server authority, or escape rate
limits. For each: severity, exact file:line, exploit, and fix. Be ruthless. If it is sound,
say so and explain why.
<diff or file contents>
EOF
```

For non-economy features, a lighter Codex code-review prompt plus the Claude `code-review` skill. The orchestrator synthesises both verdicts; **any unresolved "real bug / exploitable" finding blocks the merge.** This is the "be adversarial" mandate — we want this to be an example of how an agent ships safely.

---

## 5. Blockers (need the owner)

These do not stop the line; dependent features are marked `blocked` and we build around them.

- **X/Twitter API** — no creds in repo. Need `TWITTER_API_KEY/SECRET/ACCESS_TOKEN/ACCESS_TOKEN_SECRET` (or a Bearer for v2). Until then, tweets are drafted to `plans/production-line/tweets/` for manual posting.
- **Stripe** — no keys. Need `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs for GOLD packs / premium. P1 stays `blocked`.
- **GOLD economics numbers** — the tier table in `docs/economy.md` (Bronze/Silver/Gold/Mythic) is the working default; the owner can override rates. Referral payout strategy: **earn-on-verified-action, not on raw click** (anti-farming) — proposed in `ROADMAP.md` G1, needs sign-off on amounts.
- **$TINYWORLD token mint address** — needed to read real SPL balances (E1). If unset, GOLD stays demo-tiered.

Available now (no blocker): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY` (so paid-AI AI1 can be built), `NETLIFY_DATABASE_URL`, `WORLDS_SERVICE_TOKEN`, `TINYWORLD_PAYMENT_WALLET`, `TINYWORLD_ADMIN_SECRET`.

---

## 6. State files

- `ROADMAP.md` — prioritised feature queue + what already exists.
- `status.json` — live state; the loop writes it after every stage; `mission-control.html` renders it.
- `specs/<ID>.md` — per-feature spec (created at the spec stage).
- `tweets/<ID>.md` — drafted tweets awaiting the owner / API creds.
- `mission-control.html` (repo root) — the owner's helicopter-view dashboard.

---

## 7. Why this is novel

Few web apps + games have been built this way: a fully autonomous ideation→spec→build→adversarial-review→ship→announce loop, running multiple AI models in concert (Opus orchestrating, Sonnet building, Haiku on content, Codex/GPT speccing and red-teaming), delivering live to production for an audience of both humans and agents. That is the story we tell in the news posts.
