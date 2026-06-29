---
name: tinyworld-tinyverse-collectibles
description: Tinyverse collectibles lane — pack reveal, frozen islands, play-mode visits. Universe carousel is archived but code stays in repo.
---

# TinyWorld Tinyverse collectibles

Two app routes:

1. **Build / Freeplay** — editable sandbox. World menu: Create new (blank grass), Create
   default (`default_island.json`). Generate-from-prompt stays. No pack economy, no
   collectible reveal, no gold scoring on this path.
2. **Tinyverse** — collectibles. Welcome **Tinyverse** goes straight to
   `card_reveal.html` after login + allowlist check (no profile form, no avatar
   picker, no `WS.open()` carousel). Island pulls use
   `scripts/island-viewer-sequential-generator.js` once, then save an immutable
   snapshot to the player's collection.

## Archived (do NOT delete core code)

The legacy universe carousel and MMO picker live in `engine/world/46-worlds-universe.js`.
Mark it **archived**: welcome Tinyverse no longer calls `WS.open()`, but the module
stays loaded in `tiny-world-builder.html`. Dev, tests, and deep links may still invoke
`window.__tinyworldWorlds.open()` / `enterWorld()`.

Related modules **stay loaded** (not archived for deletion):

- `47-worlds-room.js`, `48-worlds-harvest-hud.js` — PartyKit room client when entering
  a published world room
- `createRandomIslandWorldFromMenu`, `randomIslandPreviewGenerate` — kept; Build menu
  no longer calls random-island create
- `island-viewer.html` — dev/standalone shell; not the collectible visit surface

## Pack reveal + collection (`card_reveal.html`)

**Do not load without auth.** `scripts/tinyverse-auth-gate.js` blocks the page until
the user is signed in **and** `/api/admin-users?action=tinyverse-access` returns
`allowed: true` (same gate as welcome Tinyverse). Dark-launch allowlist lives in
`netlify/functions/lib/tinyverse-access.mjs` (default:
`jason@bouncingfish.com`, `simongarthfarmer@gmail.com`; extend via
`TINYVERSE_ACCESS_EMAILS` env). Non-allowlisted signed-in users see welcome
**COMING SOON** (`is-soon` on `#welcome-tinyverse`).

Canon Tinyverse entry. Loads:

- `scripts/island-viewer-sequential-generator.js` — one-shot island pull per card
- `engine/world/26b-random-island-economy-profile.js` — canonical Food/Materials/Commerce/Defense/Charm stats (pack card + island reveal share this module via `window.__buildRandomIslandEconomyProfile`)
- `scripts/world-preview.js` — isometric preview painted on island card faces
- `scripts/tinyverse-collectibles.js` — preview GOLD, pack purchase, immutable snapshots

**Release preview (tonight):** store hub → **3 free pack opens per signed-in email**
(`tinyworld:free-packs-opened.v1:<email>`, limit `FREE_PACK_LIMIT = 3`) → 3D theater
→ **1 island per pack** (no artifacts/stickers/bonus cards) → island auto-saved to
`tinyworld:collectibles.v1` on open → flip/visit in play mode.

Hub (`scripts/tinyverse-store-hub.js`): free-opens counter, open pack CTA, inline
**Your islands** grid with Visit. **Store** button in theater returns to hub.
Builder chrome on `card_reveal.html` via `scripts/tinyverse-chrome.js`: wordmark
top-left, language picker bottom-left (`styles/tiny-world.css` + i18n), home +
logout top-right. Chrome stays visible on hub and auth gate; hides during the
dark pack theater.

Hub layout (`scripts/tinyverse-store-hub.js`): two-column on wide screens — main
pack/collection card left, **Live opens** activity rail right with simulated
player names + island pulls (preview placeholder until real multiplayer opens).
Catalog is a single `island-pack` SKU in `scripts/tinyverse-store-catalog.js`.
Preview GOLD / artifact shop are paused for this release.

Preview GOLD lives in `tinyworld:tinyverse-gold.v1` (starts at 500). Server GOLD
can replace this later; do not delete the local path when wiring API spend.

Pack SFX reuse the repo `sounds/` foley library via `scripts/tinyverse-pack-audio.js`
(same clips as `engine/world/22-audio.js`: whoosh burst, knock purchase, rustle flip,
ripple focus). Ambient loop picks a random `music-horizon-*.mp3` after first gesture.
Respects builder mute/volume keys in `tinyworld:audio:*` localStorage when present.

## Collectible island visit

Use the builder in **play mode**, not a separate viewer shell:

```js
window.__tinyworldCollectible.enter({ id, world, profile });
```

Boot: `bootCollectibleHandoffFromQuery()` in `30-ui-boot-wiring.js` reads
`?collectible=<id>` plus `sessionStorage` `tinyworld:collectible-pending`, then
calls `enter()` after `applyState` is ready.

- Forces play mode; locks build/play toggle (`body.tinyverse-collectible`)
- Recomputes economy profile from the applied world (`recomputeRandomIslandProfile` in `30-ui-boot-wiring.js`) before `openNewWorldReveal(profile)` so card stats match the rendered island
- Blocks autosave onto the freeform build slot while active
- One-way fork: `importToBuildCopy(name)` → new editable draft in My Worlds; never
  write back to the collectible canonical snapshot

## Do not

- Delete `46-worlds-universe.js` or strip its script tag to "clean up"
- Remove generators (`26-ai-generation.js`, sequential generator) when hiding UI paths
- Replace collectible visits with `island-viewer.html` as the primary player surface