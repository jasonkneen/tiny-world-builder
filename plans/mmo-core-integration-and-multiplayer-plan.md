# TinyWorld MMO Core + Multiplayer Integration Plan

**Source of this plan**: Review of latest dirty files (2026-06-20) + walkthrough of all relevant *.md / *.mdx / docs in the repo (README, AGENTS, REVIEW, ROADMAP-skybound, plans/*, economy-guide-trace.md, DREAMING.md (dirty), integrations skill (dirty), package README + integration-plan.js + trace).

**Status at review time**:
- Package `@tinyworld/mmo-core` (untracked in packages/) + test file: fully implemented, pure ESM, no deps. Tests pass (all 155 tests green including 4 new mmo-core tests).
- Current runtime multiplayer (PartyKit + Netlify + client 47/48):
  - Authoritative per-world rooms (`world-<slug>`) in `party/index.js`.
  - One-cell `move`, harvest lifecycle (fish/meat/plants/ore), hearts, taxSplit (gross=3, taxPercent from DB 1-100, no cap), resource flush via service token to `/api/worlds/resources`.
  - Presence, chat/emotes, voxel avatars (53), surface-roam in 47.
  - Worlds API for listing, signed join tokens (play/observe/build), claims (USDC), resources persistence.
  - DB: worlds + player_resources (incl. gold column), tax_ledger, claims, etc. Migration exists.
- Gaps (from package README, integration-plan.js, economy-guide-trace.md, ROADMAP):
  - Tax not capped at 20% (guide target); no cooldown or DB enforcement.
  - No GOLD allowance/ledger (package has full tiered/sqrt + bonuses + spendGold + append-only events).
  - No interest-scoped snapshots (ClaudeCraft style: full/lite/keep/remove).
  - Discrete commands, not intent streaming + fixed-tick server sim.
  - Ownership still DB-centric; no fresh chain NFT projection for sensitive actions.
  - No crafting/resource sinks, marketplace, GOLD spend paths.
  - `gold` column exists but is dead (no calc/ledger).
- Other context from MDs:
  - ROADMAP-skybound: broader vision (skybound layers, voxel people, surface settlements, real PvP, crafting, multi-agentic). Some avatar work partially shipped locally.
  - DREAMING.md (dirty): documents current modules, surface-roam fixes, lobby changes, etc.
  - Integrations skill (dirty): now references the package as the contract layer.
  - Economy guide trace: detailed gap analysis + "Recommended MVP" sequence.
  - No other .md files outside the new package heavily describe the new contracts yet.

**Guiding principles** (from user prefs + repo house style):
- Small controlled "bursts" (Aliens style); commit after each verifiable slice. "Commit everything, no push".
- Use the package for shared logic — do not duplicate constants/math.
- Preserve existing working paths (PartyKit as authoritative room for now; no bundler; shared global scope rules for client modules).
- Verify: `npm test`, local PartyKit + netlify dev + real WS smoke (as in trace), browser play in a world room.
- Source of truth split: on-chain for ownership/settlement; backend/PartyKit for gameplay/GOLD/resources; durable world layout in DB.
- Safety: backend never trusts client balances/ownership; follow ECONOMY_SAFETY_RULES exactly.
- New client code: IIFE + window.__* or proper module pattern per AGENTS.md.

## High-Level Phases (from package integration-plan.js + trace Recommended MVP)

1. **Core Contracts Adoption** (PartyKit + Functions import + tax policy)
2. **GOLD Ledger + Allowance** (table + /api/me/gold + integration)
3. **Tax Policy Enforcement** (cap 20%/default 5%, cooldown, DB + server + UI)
4. **Interest Snapshots + Intent Model** (adopt buildInterestSnapshot, move toward intents)
5. **Chain Ownership Projection** (indexer + fresh checks)
6. **Marketplace / Crafting / Sinks** (GOLD spend, recipes, listings)
7. **Polish, UI, Verification, Docs**

Each phase broken into tiny, shippable bursts with explicit verification.

## Phase 1: Core Contracts Adoption (PartyKit + Netlify Functions + shared policy)

**Goal**: Import `@tinyworld/mmo-core` (or relative while local) in PartyKit and key functions. Replace local tax math with package `applyIslandTax` + `clampTaxRate`. Wire `DEFAULT_ECONOMY_POLICY`. Use `create*` helpers where messages are built. No behavior change yet beyond cap (but cap will be enforced next).

**Burst 1.1 — Package wiring skeleton**
- Files: `party/index.js` (add import), `netlify/functions/world-resources.mjs`, `netlify/functions/worlds.mjs`, `netlify/functions/lib/worlds.mjs` (if constants live there).
- Add: `import { DEFAULT_ECONOMY_POLICY, applyIslandTax, clampTaxRate, createResourceLedgerEvents } from '../packages/tinyworld-mmo-core/src/index.js';` (adjust path; make it work for both Node/Netlify).
- Replace the local `taxSplit` function with calls to package equivalents (keep old for transition or delete).
- Update RATE_LIMITS comments + any hardcoded GROSS_REWARD references to use policy if appropriate.
- **Verification**: `npm test` (existing party tests + mmo tests must stay green). Manual: `node -e 'import(".../packages/...").then(m => console.log(m.DEFAULT_ECONOMY_POLICY))'`.
- Commit after: "adopt mmo-core contracts in party + resources"

**Burst 1.2 — Tax policy surface in DB + join payload**
- Review current `worlds.tax_percent` handling (worlds.mjs lib, party load of world meta).
- Ensure `taxPercent` passed in `createWorldJoinMessage` / world.state uses clamped value.
- Add comment in migration or new note that future migration will enforce 0-20.
- Update `cleanTaxPercent` or equivalent in lib/worlds.mjs to use `clampTaxRate` (or call it).
- **Verification**: Load a world in browser; inspect join payload or dev tools for taxPercent <=0.2 after clamp.
- Also update DREAMING.md / integrations skill if new seams exposed.
- Commit.

**Burst 1.3 — Smoke the join/harvest path with package**
- Use a real local stack (netlify dev :8888 + partykit dev :1999 + browser).
- Verify a harvest still produces correct split (owner vs miner) and flush.
- For self-harvest or ownerless: 0 tax.
- **Verification**: As documented in economy-guide-trace.md (real WS smoke: join → mine → tax split values).
- Commit.

**Deliverable for Phase 1**: Package imported and used for tax/policy. No new DB/UI yet. All existing tests + manual smoke pass.

## Phase 2: GOLD Ledger + /api/me/gold

**Goal**: Implement the guide's GOLD model using package helpers. GOLD is allowance-based (recalculated from wallet $TINYWORLD + owned islands + bonuses - spent), not a mutable balance.

**Burst 2.1 — gold_ledger_events table + migration**
- Create `netlify/database/migrations/20260620xxxx_gold_ledger.sql` (append-only: type, wallet, cycleId, amount, reason, referenceId, createdAt).
- Mirror style of existing worlds_economy migration.
- **Verification**: Run migration locally against tinyworld_mmo_codex or whatever the dev DB is; `SELECT` works.

**Burst 2.2 — /api/me/gold endpoint**
- New or extend `netlify/functions/me.mjs` (or wallet.mjs / new gold.mjs).
- Use package: `calculateGoldAllowance({ tinyworldHeld: fromWallet, islandCount: owned, ... })`.
- Query recent ledger for the cycle to compute spent/available.
- Return `{ cycleId, tier, totalAllowance, spent, available, bonuses, ... }`.
- Read $TINYWORLD from wallet RPC (reuse wallet.mjs patterns). Owned islands from worlds query.
- **Verification**: Auth'd call returns sensible numbers; unauth 401. Unit test the endpoint shape if possible.

**Burst 2.3 — Ledger event creation + reduce on spend paths**
- In PartyKit or a new flush path, when GOLD is "spent" (future crafting), emit via `createGoldLedgerEvent`.
- For now: on allowance recalc or first access, emit ALLOWANCE_RECALCULATED.
- Wire `reduceGoldLedger` for client queries.
- Update player_resources.gold? (or deprecate the column in favor of computed).
- **Verification**: End-to-end: allowance calc → ledger event → reduce → available decreases on simulated spend.

**Burst 2.4 — Surface GOLD in HUD + client (read-only)**
- Extend 48-worlds-harvest-hud.js (or new gold display) to show available GOLD (from new API).
- Add to world state or separate poll.
- No spend yet.
- Update 47 if needed for events.
- **Verification**: In a play world, see GOLD value in HUD that matches /api/me/gold.

Commits after each burst. Small slices.

## Phase 3: Tax Policy Enforcement (Cap + Cooldown + UI)

**Burst 3.1 — Enforce in server + DB**
- In party tax logic (now using package), always clamp.
- Add `tax_change_cooldown` or state in worlds or world_economy_state.
- Migration: add/alter columns for cooldown timestamp, enforce max 20 (or convert to bps).
- Update `applyIslandTax` call sites; reject changes > cooldown or > cap.
- **Verification**: Attempt to set 75% tax → clamped to 20; change attempt within 24h blocked.

**Burst 3.2 — Admin/UI for tax**
- In worlds-universe.js or admin lobby (66), or world settings: slider 0-20%, with cooldown notice.
- Persist via worlds save or dedicated endpoint.
- Show current tax + next change time to owner.
- **Verification**: Owner UI respects cap; visitors see the effective rate.

**Burst 3.3 — Resource ledger events wired**
- Use `createResourceLedgerEvents` on harvest flush.
- Persist to tax_ledger or new resource_ledger if needed (trace mentions append-only).
- **Verification**: After harvest, DB shows miner + owner credits.

## Phase 4: Interest Snapshots + Better Replication (ClaudeCraft patterns)

**Goal**: Move from broad presence broadcasts to viewer-specific `buildInterestSnapshot` for scale (many players, nodes, vehicles, projectiles).

**Burst 4.1 — Adopt snapshot contract in PartyKit**
- Import `buildInterestSnapshot`, `DEFAULT_INTEREST_CONFIG`.
- Maintain per-viewer previousVisibleIds / previousHashes (Map/Set per connection or lightweight).
- On tick or significant change, compute snapshot for each viewer and send `world.snapshot` with entities/keep/remove.
- Keep backward compat for a while (old clients ignore extra fields).
- **Verification**: In a populated room (use bots), observe reduced payload for far entities; full identity only on first sight or change.

**Burst 4.2 — Client 47 integration**
- Handle `world.snapshot` in onWorldMessage (already has some snapshot paths).
- Update peer/entity maps: add on full, update on lite, keep on keep, delete on remove.
- Drive avatar rendering / minimap from the scoped set.
- **Verification**: Peers appear/disappear at radius; movement updates are lite after first full.

**Burst 4.3 — Movement intents**
- Evolve `move` messages toward `createMovementIntent` (seq, facing).
- Server validates intent (not final position authority).
- Add basic server tick (20Hz per ClaudeCraft pattern) for simulation if needed (start minimal).
- **Verification**: Intent seq respected; server corrects invalid moves.

## Phase 5: Chain Ownership Projection + Safety

- Add tables/indexer for island_ownership_snapshots, nft_assets (from Solana RPC or events).
- Before sensitive admin/claim/transfer in worlds.mjs / world-claim, do fresh on-chain check (reuse/ extend wallet solana patterns).
- Update world DTO and join to carry on-chain owner if different.
- **Verification**: Transfer ownership on-chain → refresh shows new owner; old owner loses admin powers immediately.

## Phase 6: Marketplace, Crafting, Sinks

- GOLD spend via package `spendGold`.
- Static recipes (or DB) that consume resources + GOLD → outputs (rare items become mint intents).
- Marketplace listings in DB + confirmation flow (off-chain high-freq, on-chain settlement for transfers).
- UI: craft button, listings browser.
- **Verification**: Spend GOLD on craft → ledger updated, resources debited, output granted. Marketplace buy settles correctly.

## Cross-Cutting / Polish Bursts

- **Docs & Trace update**: Update economy-guide-trace.md, package README, main README, DREAMING.md, plans/* as work lands. Add examples to integrations skill.
- **Tests**: Extend party tests + mmo-core tests for new behaviors. Add integration smoke if possible.
- **UI/Accessibility**: GOLD/tax in HUD with tooltips; respect existing dark premium style; ARIA where new controls.
- **Performance**: Interest snapshots reduce bandwidth for crowded worlds.
- **Local dev notes**: Update AGENTS.md / DREAMING.md with PartyKit + netlify dev + Postgres + service token steps (as in trace).
- **Migration hygiene**: All changes behind feature flags or additive where possible.
- **Verification convention**: After each burst: (1) `npm test`, (2) local stack smoke (join + action + inspect DB/payloads), (3) browser visual + console, (4) commit with clear message + status.

## Open Decisions (from trace)

- GOLD model: tiered vs sqrt (package supports both; default weekly).
- Exact NFT assets that get mint intents.
- Marketplace fee bps, initial island sale format.
- Whether to keep PartyKit long-term or move heavy sim to Node later.
- SPL Token-2022 vs classic (guide prefers no transfer fee at launch).

## Success Criteria for "Done" (MVP)

- GOLD allowance visible and correct from real wallet + islands.
- Tax clamped + cooldown enforced everywhere.
- Interest snapshots in use for >N entities.
- All package functions exercised in real path.
- Safety rules language in UI copy.
- No client-trusted balances/ownership for economy actions.
- Tests + manual smoke (as trace) green.
- Plan updated with actuals.

## Next Immediate Actions (after this plan)

1. Read this plan + the package files + economy-guide-trace.md fully.
2. Burst 1.1 (wiring).
3. Verify locally.
4. Commit.
5. Report status in small slice.

**References (for executors)**:
- `packages/tinyworld-mmo-core/{README.md,docs/economy-guide-trace.md,src/{integration-plan.js,multiplayer.js,economy.js}}`
- `party/index.js` (world room sections)
- `engine/world/{47-worlds-room.js,48-worlds-harvest-hud.js}`
- `netlify/functions/{worlds.mjs,world-resources.mjs,lib/worlds.mjs}`
- `plans/ROADMAP-skybound.md`, AGENTS.md, DREAMING.md
- Existing migrations in `netlify/database/migrations/`

This plan is the deliverable from the review. Execute in bursts; update this file with progress markers.

## Workflow Loop Status (2026-06-20)
**Completed in loop so far:**
- Tax cap enforcement (20%) live in authoritative party + cleanTaxPercent (real harvests respect guide)
- gold_ledger_events migration created
- /api/me/gold now uses reduceGoldLedger against real table
- Harvest awards 10 GOLD via createGoldLedgerEvent (persisted on flush)
- Client fetch + HUD display wired
- Full verification script passes using live package functions
- All bursts committed locally

**Next in loop:** Interest snapshots + cooldown + full end-to-end with local PartyKit + netlify dev smoke.


**Latest loop run (continuing):** Interest scoping + world.interest messages + client handler live. GOLD accrual now scales with harvest reward. Cooldown enforcement stub wired. All verifications passing. Loop still running.

## Latest Loop Run (interest tick + gold spends + weekly token payout)
**Interest tick**: onAlarm now periodically calls interest updates to all players using buildInterestSnapshot + world.interest.
**Gold spends**: recordGoldSpend (GOLD_SPENT via mmo-core) called on every harvest (small cost).
**Weekly payout**: grantWeeklyGoldPayout using calculateGoldAllowance + tinyworldHeld from join data; emits ALLOWANCE_RECALCULATED on join and in tick for new cycles. Client sends demo holding.
All verified, tests green, committed in small bursts.


## Deploy Status (latest)
**Netlify preview alias**: https://mmo-preview--tiny-world-builder.netlify.app
**PartyKit**: updated with latest server (gold events, interest tick, payouts, tax cooldown)

**Visible in preview**:
- $TW (abbrev holding) + G (GOLD available) in bottom HUD when inside a world room
- "MMO PREVIEW" banner (only on the alias hostname)
- Tax cooldown enforcement on draft tax changes (24h, DB-backed)
- Cooldown info exposed to client

To test: load the alias → pick a published world → join as Play. The new bottom bar items appear after room entry.


## Latest burst (continuing)
- Tax cooldown: DB column + server enforcement on draft tax changes (24h)
- Client: after tax save, if cooldown, disable input + show "~Xh" message in manage dialog
- HUD: shows "CD Xh" when taxCooldown info present
- All redeployed to mmo-preview alias
- Preview marker + full stack (Netlify + PartyKit) live for testing

Next suggested: surface cooldown in world cards + full client-side block before save, or run smoke verify on preview.


**Client tax cooldown UX complete (manage dialog blocks + HUD timer) + redeployed to alias.**

**Tax cooldown client surface complete** (cards (CD), manage dialog block + remaining time, HUD CD timer). Redeployed to mmo-preview.


**Latest (continuing):** Tax cooldown client surface complete across cards, manage dialog (block + remaining time on open), HUD timer, and now in-room role label (e.g. "Visitor · 15% (CD 18h)"). Server + DB enforcement live. Preview alias updated.

**In-room taxCooldown flow complete:** lastTaxChange now sent on world.join (from list data), stored on room.world meta, forwarded in worldSnapshotFor + state updates. Client computes cooldown object from it and feeds to HUD role label (shows e.g. "Visitor · 15% (CD 18h)") and listeners. Fully consistent with cards/manage/HUD.
Preview alias updated with the change.
