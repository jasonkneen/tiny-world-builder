---
name: tinyworld-integrations
description: Use when changing Tiny World Builder API, webhook, SSE, MCP, plugin, or automation examples.
---

# Tiny World Integrations

The app has browser-local integration points plus a small Netlify account
backend:

- Account/profile/cloud-save functions live under `netlify/functions/`.
  `profile.mjs`, `builds.mjs`, `share.mjs`, and `assets.mjs` are routed to
  `/api/profile`, `/api/builds`, `/api/share`, and `/api/assets` via each
  function's exported `config.path`.
- Wallet/social functions also live under `netlify/functions/`: `wallet.mjs`
  verifies Phantom-signed Solana wallet challenges and reads `$TINYWORLD`
  balances/activity from RPC, `wallet-payments.mjs` creates Solana Pay payment
  intents, `players.mjs` tracks online presence/search/chat requests/parties,
  and `livekit-token.mjs` issues LiveKit room tokens when `LIVEKIT_URL`,
  `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` are configured.
- Community functions: `community.mjs` (`/api/community`) backs the `/community`
  Discord-lite page — rooms, DMs, members, bans, blocks, invites; tables
  auto-create + seed on first request. Channel names are forced lowercase and
  the super-owner (`TINYWORLD_COMMUNITY_OWNER`, default `jasonkneen`) is made an
  owner of every room each request via `ensureCommunityDefaults`. Only staff
  (super-owner / `TINYWORLD_COMMUNITY_STAFF`) or a room owner can create/delete
  channels and ban; the same `admin` flag gates every privileged action.
  Members must pass an anti-AI human check (`community_verifications`) AND have a
  mandatory **Twitter/X handle** on their profile (GitHub optional) before they
  can post/DM/join — `saveSocials` writes the bare handles to
  `profiles.twitter`/`profiles.github` (idempotent `ALTER TABLE ... ADD COLUMN`
  in `ensureTables`; migration `20260615020000_add_profile_socials.sql`).
  Bootstrap returns `me.profileComplete`; the page shows a forced
  "Complete your profile" modal until Twitter is set and renders both handles on
  profile cards. Members can fully **edit their profile** (display name, bio,
  avatar, handles) via `saveProfile` (alias `saveSocials`). Avatars are an
  **allowlisted preset set** under `assets/avatars/*.png` (keys in
  `AVATAR_KEYS`) — no user image uploads, so no NSFW image risk. All
  user-authored text (display name + bio) is run through `checkTextSafety`,
  a two-layer filter (hard substrings + whole-word, leet/spacing-normalized)
  that rejects sexual / nudity / abusive / hateful content. Tested in
  `tests/community-profile.test.mjs`. `community.html` signs users in **in-page** (no bounce to the
  builder): it loads `vendor/tinyworld-auth.js` via the import map for Netlify
  Identity email login/signup and calls `/api/wallet` for Phantom login, storing
  the session under the shared `tinyworld:auth:wallet-session.v1` key.
- Community moderation webhook: `community-webhook.mjs` (`/api/community/webhook`)
  is a server-to-server endpoint for an agent (Hermes) to ban/unban/block/hide or restore/delete
  messages/purge spam/delete rooms. Auth is a shared secret
  (`TINYWORLD_COMMUNITY_WEBHOOK_SECRET`) via `x-tinyworld-signature: sha256=<hmac
  of raw body>` (preferred) or `x-webhook-secret`. Shared primitives live in
  `lib/community-moderation.mjs`; `community.mjs` also emits outbound
  `message.created` events to `HERMES_COMMUNITY_WEBHOOK_URL` (signed, fire-and-
  forget) so the agent can observe and react. Full reference:
  `docs/community-webhook.md`.
- User auth is Netlify Identity. The browser bridge is self-hosted through
  `vendor/tinyworld-auth.js` with an import map to vendored
  `@netlify/identity` / `gotrue-js`; do not reintroduce a remote identity
  widget script.
- Profile image fields stored through `/api/profile`, `/api/admin-users`, or
  community preset-avatar saves must be absolute `http(s)` URLs. Preset avatar
  paths under `assets/avatars/*.png` are normalized with the trusted site origin
  from `TINYWORLD_SITE_URL` / Netlify `URL` / deploy URL envs before validation
  and persistence; already-absolute URLs are left unchanged.
- Account API fetches must send `Authorization: Bearer <nf_jwt>` when possible
  and `credentials: 'same-origin'` so Netlify Functions can resolve the current
  Identity user. Wallet login uses the same bearer path with signed
  `tw-wallet-v1...` session tokens stored under `tinyworld:auth:*`.
- For local account/function work, run `npx netlify dev` and use
  `http://localhost:8888/tiny-world-builder`; that port keeps the auth/account
  UI enabled while the plain static dev server remains anonymous.
- Cloud worlds are stored as full TinyWorld JSON in Netlify Database `builds`
  rows. Existing rows update through `PUT /api/builds?id=<id>` so named
  localStorage worlds can stay bound to one cloud row instead of creating
  duplicates. Public share links create immutable-ish rows in `world_shares` and
  load through same-origin `?share=<id>` / `/api/share?id=<id>`.
- Multiplayer/shared building uses PartyKit separately from Netlify Functions.
  `partykit.json` points at `party/index.js`, local development runs with
  `npm run party:dev` on port `1999`, and browser rooms connect only when a URL
  includes `?party=`, `?room=`, or `?collab=`. Collaborate links should reuse a
  `/api/share` id as both the world snapshot id and the PartyKit room id:
  `/tiny-world-builder?share=<id>&party=<id>`.
- MMO economy/multiplayer extraction lives in `packages/tinyworld-mmo-core/`.
  It is a dependency-free ESM package for shared GOLD allowance, resource tax,
  ledger, join-command, and interest-snapshot contracts. Use it when wiring the
  TinyWorld economy guide into PartyKit or Netlify Functions instead of copying
  constants between runtime files.
- Tinyverse published-world navigation no longer uses the `tinyverse-nexus` hub.
  `/api/worlds` should hide that slug from lists and direct loads, published
  world data should normalize to one center `stargate` with
  `dest: '__world-picker'`, and PartyKit `safeSpawn()` should prefer that gate
  so players arrive where the in-world picker exit is.
- Tinyverse/lobby access is locked to the Jason account allowlist in
  `netlify/functions/lib/tinyverse-access.mjs`. Do not use
  `accountMeetsCriteria()` or a raw `profiles.lobby_access` flag as the
  authoritative gate; migrations should keep `lobby_access` default false and
  clear it for every non-allowlisted profile.
- Tinyverse room join/refresh payloads use compact cells. Terrain-only cells may
  be `[x,z,terrain]`; object/resource cells are `[x,z,terrain,kind]`. Keep the
  renderer validator and `applyState()` tolerant of both tuple lengths.
- Tinyverse multiplayer rooms are runtime/play/moderation surfaces only. Do not
  add live island building controls, `adminSave`, build-role seats, or
  `world.refresh` board replacement inside PartyKit rooms. Island editing and
  version publication must live in the dedicated draft/version flow.
- Local custom assets are account data too: `/api/assets` stores one
  `asset_libraries` row per profile containing custom voxel-build stamps and
  saved asset templates. Browser hooks in `saveCustomVoxelBuildStamps()` and
  `saveAssetTemplates()` queue a cloud sync after login.
- Local Netlify Database failures are expected in some `netlify dev` sessions.
  Translate 503 `Netlify Database is not available...` responses into a friendly
  account/cloud status or `warn` toast, never a red production-style error toast,
  raw database message, or visible `Local DB offline` wording.
- Wallet/player social functions rely on
  `netlify/database/migrations/20260602120000_wallet_players_social.sql`.
  If those tables are missing in local Netlify dev, classify Postgres `42P01`
  with `isMissingRelations(...)` and return a setup-oriented 503 instead of
  logging raw missing-relation errors as generic 500s.
- Phantom wallet linking and wallet login must stay challenge/response based:
  the browser asks Phantom to sign the server-issued message and the function
  verifies the Ed25519 signature against the Solana public key before linking
  or minting a wallet session. Do not accept a posted wallet address as proof
  of ownership. Wallet login requires `TINYWORLD_WALLET_SESSION_SECRET` (or
  `TINYWORLD_AUTH_SECRET`) for HMAC-signed challenge/session tokens.
  `$TINYWORLD` mint/payment values come from env (`TINYWORLD_TOKEN_MINT`,
  `TINYWORLD_PAYMENT_WALLET`, optional `SOLANA_RPC_URL`) rather than client
  constants.
- Database schema changes belong in `netlify/database/migrations/*.sql`. Deploy
  previews get their own database branch, so use a preview deploy for real
  Identity + DB verification; local `netlify dev` is useful for functions but is
  not a complete Identity social-login test.

Browser-local integration points:

- Outbound webhooks live in `tiny-world-builder.html` under
  `// -------- API / webhooks / SSE bridge --------`.
- Optional browser-local probes must be opt-in so the static app stays console-clean:
  the Cluso in-page embed is LOCAL-DEV-ONLY, injected at runtime by `tools/dev-server.js`
  (assets in gitignored `cluso/`); it must never be referenced by committed/shipped HTML;
  model-stamp API endpoints load only with `?modelApi=1`, `?modelStampApi=1`,
  `window.__TWB_MODEL_STAMP_API_ENABLED__ = true`, or
  `localStorage['tinyworld:features:model-stamp-api']='1'`.
- `fireWebhook(event, payload)` batches editor mutations and POSTs
  `{ source: 'tiny-world-builder', events }` to the configured Developer-panel
  webhook URL.
- Inbound automation uses `EventSource` against the configured Developer-panel
  SSE URL. Each SSE `data:` payload must be one JSON command accepted by
  `applyRemoteCommand`.
- Supported inbound ops include `place` / `set_cell`, `clear`, `reset`, plus runtime-only vehicle controls: `vehicle_spawn`, `vehicle_set_goal`, `vehicle_controls`, `vehicle_remove`, and `vehicle_clear`.
- Runtime vehicles must not pass through each other. Keep traffic behavior in the runtime layer: collision radius + yield radius, brake when another vehicle is inside the envelope, and reroute around occupied road cells after a short blockage when an alternate road path exists.
- Placed objects on paths are live traffic blockers. `isVehicleDrivableCell` should allow path cells only when the main `kind`/extras do not occupy the tile, while bridge cells remain drivable. Call `refreshVehiclesForWorldObstacleChange` from world edit paths so active auto vehicles reroute immediately when the user drops or removes an obstacle.

Examples live under `plugins/examples/`:

- `webhook-receiver.js` captures outbound webhook batches.
- `sse-command-relay.js` exposes `/sse` for the browser and `/command` for
  external clients.
- `send-command.js` is a small CLI for the relay.
- `mcp-stdio-bridge.js` is a dependency-free MCP stdio server that calls the
  relay and reads the webhook log.
- `vehicle-road-demo.js` is a dependency-free MCP client/demo runner that talks
  to `mcp-stdio-bridge.js`, paints a visible road/water/bridge network, spawns
  runtime vehicles, and retargets them in a loop so the browser remains
  watchably active.
- The app also supports browser-native shareable vehicle demo URLs:
  - `?demo=vehicles&seed=tide-ridge-428` creates the small/default visible road demo.
  - `?demo=vehicles-large&seed=metro-culdesac-20&stats=1` creates the default 20×20 scale test with arterial/ring roads, bridge crossings, cul-de-sac endpoints, and 36 autonomous vehicles on long routes.
  - Large-demo params: `size=` / `mapSize=` / `grid=` / `gridSize=` accept the nearest valid demo grid size from `12` through `20` (`12`, `16`, `20`); `cars=` / `carCount=` / `vehicles=` / `vehicleCount=` accept `1..120` and are capped by available unique endpoints.
  Keep these demos visually self-identifying: show an active badge, hide overlays
  that cover the road network, and make vehicles obvious with beacons/markers.
  During local demo work, `tools/dev-server.js` should make bare
  `http://localhost:3000/` and no-query `http://localhost:3000/tiny-world-builder`
  redirect to the small seed so the user can simply open the port or remembered
  app URL and watch it. Use the large URL explicitly for scale/perf checks.

When changing command shape, update the app bridge and these examples together.
