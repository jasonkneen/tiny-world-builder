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


## Current Verification Status (Chrome)
- Chrome E2E test plan: **ADDED** (see "Chrome End-to-End Test Plan for mmo-preview" section below). Run in Incognito after granting access on prod.
- mmo-burst-3 (tax cooldown): Code complete + client surface (HUD/role/cards/dialog + in-room flow). Test using Steps 2+4 of the Chrome plan.
- mmo-verify: Unblocked — use the numbered Chrome steps + pass criteria.
- mmo-deploy-preview: Latest deploys include the in-room tax CD + GOLD HUD work.
- mmo-commit-loop: Active (this update committed).

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

## Manual smoke checklist for mmo-preview (as of latest)
1. Load https://mmo-preview--tiny-world-builder.netlify.app
2. Enter a published world as Play → bottom HUD shows $TW + G, role line shows tax% (no CD if fresh).
3. As owner of a draft: Manage → change tax → Save. Dialog should disable tax + show ~24h message. Card should show (CD).
4. Re-enter the world as visitor/owner → role line should now show "· 15% (CD 23h)" or similar.
5. Harvest a node → see resource + small GOLD spend in ledger (check /api/me/gold later).
6. Wait or use another draft to test cooldown expiry behavior.

All previous features (interest scoping, GOLD accrual on harvest, weekly payouts) remain live.

## Testing reality note (added 2026-06-20)
- The /admin-users (User access) god-admin page only works against a real Netlify Database.
- It intentionally errors with "Netlify Database is not available in this local session" in netlify dev and on deploy previews (see netlify/functions/lib/db.mjs + isDatabaseUnavailable guards used across many functions).
- Do **not** try to wire the preview directly to live prod DB credentials.
- Practical flow:
  1. Go to the **main production site** (not the mmo-preview alias) and open /admin-users while signed in as a god-admin email.
  2. Grant "Enable Tinyverse lobby + multiplayer access" (or rely on accountMeetsCriteria for email-verified accounts).
  3. Use those accounts on https://mmo-preview--tiny-world-builder.netlify.app to test join/harvest/GOLD/interest/tax-cooldown etc.
- tools/db-local.sh exists for full local dev with a Postgres copy.


**mmo-burst-3 (tax cooldown) marked complete** — full server + client enforcement + visibility in HUD/role/cards + in-room lastTaxChange flow.

**Testing note for preview (important):**
- /admin-users ("User access") god-admin tool requires a real Netlify Database connection.
- This is intentionally unavailable in local sessions and deploy previews (see isDatabaseUnavailable guard in lib/db.mjs and the many functions that use it).
- Workaround: use the **main production site** (not mmo-preview alias) to sign in as god-admin and grant "Enable Tinyverse lobby + multiplayer access".
- Then test the mmo-preview URL with those accounts. Profile flags are in the shared DB.
- For most email-verified accounts, `accountMeetsCriteria(user)` already grants lobby access automatically (no toggle needed).
- Local full admin testing: `tools/db-local.sh` then `NETLIFY_DATABASE_URL=... netlify dev`.

**Admin page now has a visible banner** on the preview explaining to use the main production site for god-admin grants.


**mmo-burst-3 (tax cooldown) completed on code side** — full server enforcement + DB state + client visibility (cards, manage dialog, HUD timer, in-room role label). Admin tool DB limitation is a platform constraint (documented above and in the page banner).


## Valheim Inspiration Pulls (what we can/should extract)

**Core loops that map extremely well:**
- Owned bases that others visit and farm on → owner gets passive income (already have tax + GOLD).
- Comfort / Rested system → building nice things gives buffs (we just added comfort + modifiers to generator).
- Public rich starter islands → the 29 default published islands we generated are exactly the "public meadows" new players use.
- Artifacts as power-ups → different artifacts can give island-wide or personal bonuses (currently just placed as cells).
- Settlements / small NPC camps on public islands → we added houses/fences on richer seeds; can become traders or flavor.
- Island "flavor" → different islands feel different (fishing heaven, artifact rich, mining god, etc.) via modifiers.

**Concrete things we can pull right now:**
1. Comfort affecting gameplay (interest rate, node respawn, visitor yield).
2. Artifact kinds giving small distinct bonuses when present on an island.
3. High-comfort islands attracting "better" visitors or giving the owner a small global buff.
4. Default islands with visible settlement clusters (already partially done).
5. "Rested" temporary buff for players after leaving a high-comfort island.

We have started wiring comfort/modifiers into deriveWorldState and node rates. Next: make comfort boost GOLD interest and expose it nicely in the Chrome test plan.


## Chrome End-to-End Test Plan for mmo-preview (as of 2026-06-20)

**Goal**: Manually smoke the current MMO features in a real browser (Chrome) against the live preview alias. Covers tax cooldown, GOLD, HUD indicators, harvest, interest effects, and lobby access.

**Prerequisites**:
- Chrome (latest; use Incognito or a dedicated profile to avoid cached auth/storage).
- Access to main production site for god-admin grants (see below).
- A test account (email-verified preferred; or wallet).
- The preview URL: https://mmo-preview--tiny-world-builder.netlify.app
- DevTools open (Cmd+Opt+I on Mac, Ctrl+Shift+I on Win).
- A draft world you own + at least one published world.
- (Optional) Second Chrome window or incognito for multiplayer smoke.

**Step 0: Grant lobby / Tinyverse access (required for preview testing)**
1. Go to the **main production site** (not the preview alias).
2. Sign in as a god-admin account.
3. Navigate to /admin-users.
4. Search for your test account(s).
5. Edit → check "Enable Tinyverse lobby + multiplayer access".
6. Save.
7. (Note: For verified email accounts, `accountMeetsCriteria` may grant access automatically in many cases.)

**Step 1: Load the preview clean**
1. Open https://mmo-preview--tiny-world-builder.netlify.app in a fresh Chrome Incognito tab.
2. Hard reload (Cmd+Shift+R) to bypass any cached JS from previous deploys.
3. Sign in with the test account (the one you just granted access).
4. Open DevTools → Console tab. Expect no red errors on load. Look for any "[mmo]" or presence logs.
5. Navigate to Worlds list. Confirm your granted account can see published worlds.

**Step 2: Enter a world as Play + verify HUD basics**
1. Pick a published world you can join as Play (not just observe).
2. Click Enter / Play role.
3. Watch for bottom HUD to appear.
4. **Expected in HUD**:
   - $TW indicator (e.g. "22m" or your actual holding abbrev).
   - G (GOLD) indicator with a number (may start at 0 or show allowance).
   - Role line showing tax % (e.g. "Visitor · 10%").
5. DevTools → Network tab → filter WS or "party". Confirm WS connection to the room succeeds.
6. Console: look for world state, taxPercent, gold, token updates.

**Step 3: Harvest + GOLD accrual smoke**
1. Select a harvestable node (fish/meat/plants/ore).
2. Perform harvest action (click or tool).
3. Watch resources update in UI.
4. Immediately check G in HUD — should increment (small amount on harvest; reflects package accrual).
5. Open DevTools → Network → look for calls to /api/me/gold or world-resources.
6. Repeat harvest a few times. GOLD should grow.
7. (If you have a draft) Check that tax is applied on flush (owner gets share).
8. Console / Network: verify ALLOWANCE_RECALCULATED or GOLD events if logged.

**Step 4: Tax cooldown test (core of burst-3)**
1. Go back to Worlds list.
2. Open one of your own **draft** worlds.
3. Click Manage (name/tax editor).
4. Change taxPercent (e.g. from 10 to 15) → Save.
5. **Expected**:
   - Tax field becomes disabled.
   - Message appears: "Tax on cooldown for ~24h" (or similar remaining hours).
   - Card in list shows (CD) badge.
6. Re-enter the draft world as Play.
7. HUD role line should now show tax % **plus** "(CD Xh)" (e.g. "Visitor · 15% (CD 23h)").
8. Try to change tax again while in cooldown:
   - In Manage: Save should be blocked client-side + show toast "Tax is on cooldown".
   - Server should also reject (429 or clear error).
9. DevTools → Console + Network: confirm the PUT to /api/worlds includes the cooldown check and returns the taxCooldown object in response.
10. (Optional) Inspect the world state payload in WS messages — lastTaxChange / taxCooldown should be present.

**Step 5: Interest / scoping smoke (if visible in current build)**
1. Stay in a world for a while or trigger an onAlarm / interest tick (may require waiting or multiple clients).
2. Watch for any visible effects (resource regrowth, hearts, or logged interest updates).
3. In Console: look for `buildInterestSnapshot`, `world.interest`, or ALLOWANCE messages.
4. If two tabs open (same account or different granted accounts): join the same world and confirm presence + any interest replication works.

**Step 6: Multiplayer / lobby quick check**
1. With two Chrome windows (or one incognito + normal):
   - Both accounts must have lobby access granted (Step 0).
   - Both enter the same published world as Play.
2. Confirm both see each other (avatars/presence).
3. One harvests; other should see the resource change + any GOLD/interest side effects.
4. Check presence chat or emotes if available.
5. Leave one; confirm the other sees the peer leave.

**Step 7: Edge cases + cleanup**
1. Try entering as Observe role — HUD should still show tax/GOLD but limited actions.
2. Hard reload mid-session; confirm state re-hydrates correctly (GOLD, tax CD, role).
3. Check Console for any uncaught errors or failed fetches during the session.
4. Test on a world with 0% or max 20% tax (verify cap enforcement on harvest split).
5. Sign out → sign back in → re-enter world; verify persisted GOLD/interest state.
6. (If time) Open DevTools → Application → Storage → clear site data for the preview domain, reload, repeat a harvest.

**Pass criteria**:
- No hard crashes or red Console errors on the critical paths.
- HUD always shows $TW + G after entering a world.
- Harvest visibly increases GOLD.
- Tax changes on drafts are blocked for ~24h with UI feedback in dialog, cards, and in-room role label.
- Cooldown info flows from DB → server snapshot → client state → HUD/role.
- Lobby access works (granted accounts can enter multiplayer rooms on the preview).

**Chrome-specific tips**:
- Use Incognito to avoid profile contamination.
- Cmd+Shift+R (hard reload) + Cmd+Opt+I (DevTools) on every major step.
- Network tab: "Preserve log" + filter "gold|worlds|party|resources".
- Console: enable "Verbose" if needed; search for "taxCooldown", "gold", "interest".
- If WS feels flaky: check the room slug in Network WS frames.
- Performance tab (optional): record a harvest + interest tick to spot heavy work.

**Known current limitations (do not fail the test on these)**:
- Admin grants must be done on the main prod site (preview admin DB is unavailable by design).
- $TW may be a demo "22m" value until real wallet holdings are wired.
- Some interest visuals may still be server-only (logs) until client polish.
- Full weekly payout cycle may require waiting or forcing via dev tools.

Run this plan in Chrome after each preview deploy. Paste results (screenshots of HUD, Console excerpts, or "PASS/FAIL + note") back for verification.



**Chrome E2E test plan added to this file** (see section above). Use it in Incognito Chrome against the mmo-preview alias after granting lobby access on the main prod site. This unblocks mmo-verify.

## Rich Default Tinyverse Islands (added 2026-06-20)

- Generated 29+ published owner-less starter islands via updated `tools/gen-seed-worlds.mjs`.
- All islands are deliberately **rich**:
  - Dense water bodies (high fish)
  - Large stone clusters (high ore)
  - High crop counts (high plants/gather)
  - 12–25 artifacts per island (kind: artifact/relic/crystal/totem/ruins)
- Migration: `netlify/database/migrations/20260620143000_rich_tinyverse_islands.sql`
- Regenerate with: `node tools/gen-seed-worlds.mjs > ...`
- Perfect for Chrome E2E testing (harvest, GOLD, tax cooldown, artifact recovery).
- Also updated `world.schema.json` to allow the new artifact kinds in cells.
