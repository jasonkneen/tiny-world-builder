# First-Time Onboarding — Seams Map (read-only findings)

Investigation of `/Users/jkneen/Documents/GitHub/tinyworld` for planning a first-time
onboarding experience in the multiplayer lobby. All file:line refs verified against
current source (engine modules are served live via `netlify dev`; dist/ is prod only).

---

## 1. LOBBY ENTRY

**Renderer / entry module:** `engine/world/47-worlds-room.js` is the multiplayer world room.
The lobby is just a *world* rendered by this module — there is no separate "lobby renderer".
Lobby-specific furniture lives in sibling modules: `58-lobby-presentation.js` (slide screen),
`64-lobby-chat-bridge.js`, `65-lobby-benches.js`.

**Join flow / first-land entry point:**
- `enterRoom(w, joinToken, joinRole)` — `47-worlds-room.js:201`. Main entry when transitioning
  into a published world.
- `emit('enter', { world: w, role })` — `47-worlds-room.js:248`. Fires immediately, *before*
  the socket opens. Subscribe via `WS.on('enter', cb)`.
- WebSocket opens to PartyKit room `world-<slug>` — `47-worlds-room.js:249-251`, join message
  sent on `open` — `47-worlds-room.js:253-261`.
- First authoritative server state: `case 'world.state'` — `47-worlds-room.js:360-369`. This
  seeds peers/nodes, creates the self avatar, and fires `emit('state', snapshot())` (line 369).
- Self avatar spawns in `updateSelfAvatar()` — `47-worlds-room.js:2933-2942` (called from the
  `world.state` handler).

**Best onboarding hook:** `WS.on('state', ...)` (fires at `47-worlds-room.js:369`). At that point
the self avatar exists and is positioned, peers are rendered, grid is visible. Guard with a
one-shot flag so it only runs on the first state after an `enter`.
`WS.on('enter', ...)` is the earlier hook if you want to show a loading/intro before the world paints.

**How "lobby" is distinguished — IMPORTANT (corrects a looser first pass):**
- The canonical lobby signal is the global `window.__TW_LOBBY_WORLD_SLUG`, defaulting to
  `'tidewater-bay'`. Used by the lobby modules:
  - `65-lobby-benches.js:13` — `(window.__TW_LOBBY_WORLD_SLUG || 'tidewater-bay').toLowerCase()`
  - `64-lobby-chat-bridge.js:18` — same pattern (community room slug is `'lobby'`, line 19)
- `__TW_LOBBY_WORLD_SLUG` is **never assigned** anywhere in the codebase — it always resolves to
  `'tidewater-bay'`. (`64-lobby-chat-bridge.js:17,149` note it must be set *before* module load if
  it ever changes; nothing sets it.)
- `46-worlds-universe.js:206-209` — only `tidewater-bay` is unlocked/playable (`isDemo = w.slug === 'tidewater-bay'`,
  `locked = !isDemo`); every other world is greyed out. So today **lobby = demo world = `tidewater-bay`**.
- Do NOT gate onboarding on the terrain-bake check at `47-worlds-room.js:217`/`715`
  (`w.slug === 'tidewater-bay'`) — that's a perf special-case, not a lobby identity check. Mirror the
  lobby modules instead: `const LOBBY = (window.__TW_LOBBY_WORLD_SLUG || 'tidewater-bay').toLowerCase()`,
  then compare to the entered world's `w.slug`.

**URL / query param control of which world loads:**
- `getTinyverseSlugParam()` — `29-persistence-api.js:1011-1031`. Reads `?world=<slug>` (query) then
  `#world=<slug>` (hash); empty/absent → default `TINYVERSE_DEFAULT_SLUG = 'mixed-hollow'`
  (`29-persistence-api.js:1001`). Slug validation `/^[a-z0-9][a-z0-9-]{0,47}$/` — line 1005-1007.
- Auto-entry: `maybeAutoEnterDemoWorld()` — `46-worlds-universe.js:453-462`: waits for `enterRoom`,
  dismisses the welcome modal, calls `enterBySlug(slug)` (`46-worlds-universe.js:407`).
- Multiplayer/Tinyverse query params that change boot behavior: `party`, `room`, `collab`, `share`
  (see welcome-skip logic, §4).

---

## 2. CONTROLS TO TEACH (verified bindings)

Keydown handler in the world room: `onKey()` — `47-worlds-room.js:1774-1786`. **WASD and arrow keys
both work.**

| Input | Action | File:line | Notes |
|-------|--------|-----------|-------|
| W / ↑ | Move forward (camera-relative) | 47-worlds-room.js:1774 | enters ladder-climb if near a ladder |
| S / ↓ | Move backward | 47-worlds-room.js:1775 | |
| A / ← | Move left | 47-worlds-room.js:1776 | |
| D / → | Move right | 47-worlds-room.js:1777 | |
| Click on minimap | Walk to tile (A* pathfind) | 47-worlds-room.js:1927-1936 | `walkTo()`→`findPath()`; 170ms/step; WASD cancels the walk |
| Space | Jump | 47-worlds-room.js:1778 | `startJump()` |
| F | Attack / swing | 47-worlds-room.js:1779 | `ATTACK_KEY='f'` (47:2150) |
| C (hold) | Crouch | 47-worlds-room.js:1783 | local-self only; released on keyup |
| X (toggle) | Sit | 47-worlds-room.js:1784 | local-self only; movement cancels |
| `[` | Prev avatar class | 47-worlds-room.js:1785 | `cycleAvatarClass(-1)` |
| `]` | Next avatar class | 47-worlds-room.js:1786 | `cycleAvatarClass(1)` |

**Click-to-move IS present** — but only on the **minimap canvas**, not the main 3D viewport.
`onMapClick` → `walkTo(cx,cz)` → A* `findPath` — `47-worlds-room.js:1927-1936`. There is no
click-on-3D-ground-to-move handler.

**Harvesting / mining — NOT keys, on-screen buttons only.**
`engine/world/48-worlds-harvest-hud.js` builds Fish / Mine / Gather / Hunt buttons →
`WS.harvest('fish'|'mine'|'gather'|'hunt')` (`48-worlds-harvest-hud.js:80,94-95`). `harvest()` is
defined at `47-worlds-room.js:1660`; it finds the nearest matching node/animal and sends
`harvest.start`. Node-kind→action routing (ore → "mine") at `47-worlds-room.js:1655`. **No keyboard
shortcut exists for harvest/mine** — onboarding should point at the HUD buttons.

**Emotes — chat slash-commands, not keys.** `/wave /dance /sit /crouch /jump /attack`
(`47-worlds-room.js:40-47`), submitted through the chat input (module `50-worlds-play-chat.js`),
relayed by the server. (See memory `tinyworld-chat-emotes`.)

**Slide deck (lobby presentation):** `[` / `]` also advance lobby slides AND there is a fixed
bottom-center Prev/Next bar — `58-lobby-presentation.js`. Note the `[`/`]` collision with avatar-class
cycling in `47` — both handlers fire; worth deciding intended behavior for onboarding copy.

**Surface-roam mode** (a different freeform 3D mode, not the lobby default) has its own bindings
incl. double-tap Space = fly, V = first-person, drag = look, scroll = zoom
(`47-worlds-room.js:1331-1382`, HUD string at 1326). Not relevant to lobby onboarding unless you
teach it.

---

## 3. UI OVERLAY CONVENTIONS

**Pattern: each overlay is a self-contained IIFE module that `document.createElement`s its DOM and
`document.body.appendChild`s it. There is NO shared HUD container** and **no shared CSS file** used
by these modules (`styles/tiny-world.css` exists but world modules don't use it).

- Shared `el(tag, attrs, kids)` DOM helper, copied per-module — e.g. `49-worlds-avatar-picker.js:26-36`.
- Styles: injected once via an `injectStyles()` function that appends a `<style id="...">` to
  `document.head`, guarded by an id-exists check. Examples:
  `49-worlds-avatar-picker.js:450-499`, `48-worlds-harvest-hud.js:27-78`, `46-mesh-terrain.js:816-845`.
- Append points: picker `49:515`, harvest HUD `48:109`, minimap `47:1840`, lobby bar `58:372`,
  mesh-terrain panel/toggle `46:872-950`.

**z-index ladder (observed):**

| z-index | Element | File:line |
|---------|---------|-----------|
| 99999 | global toast host | 00-prelude.js:48 |
| 96 | top sky/satellite HUD | 47-worlds-room.js:1024 |
| 95 | avatar-picker modal backdrop | 49-worlds-avatar-picker.js:453 |
| 68 | harvest HUD help/legend panel | 48-worlds-harvest-hud.js:68 |
| 67 | harvest reward popups | 48-worlds-harvest-hud.js:65 |
| 66 | harvest HUD bar | 48-worlds-harvest-hud.js:30 |
| 65 | minimap | 47-worlds-room.js:1819 |
| 60-61 | mesh-terrain toggle/panel | 46-mesh-terrain.js:816-825 |
| 60 | lobby slide control bar | 58-lobby-presentation.js:351 |

**Recommendation:** a non-modal corner coachmark panel → `z-index: 70` (above minimap, below the
harvest help panel). A full onboarding modal/slide sequence → `z-index: 92-94` (just below the
avatar picker's 95, above everything gameplay).

**Modal pattern to mirror (avatar picker):** two elements — a fixed full-viewport backdrop
(`position:fixed; inset:0; display:none; .open→display:flex` to center; semi-transparent dark bg) +
an inner panel that `stopPropagation`s clicks; backdrop click closes. Build in `buildPicker()`
(`49-worlds-avatar-picker.js:501-516`), open/close toggle the `.open` class
(`49:585-604`). Pixel-art panel chrome (inset box-shadows, `'Pixelify Sans'` font) at `49:455-463`.

**Corner panel pattern to mirror:** mesh-terrain toggle+panel (`46-mesh-terrain.js:872-950`) —
`position:fixed`, build once (`builtUI` guard), `injectStyles()`, append to body, toggle via
`[hidden]` attribute. Includes a `@media (max-width:700px)` mobile reflow at `46:844`.

**Name labels are 3D, not DOM:** `makeNameLabel()` in `47-worlds-room.js` is a `THREE.Sprite`
billboard (renderOrder 13), not an HTML overlay — not a template for HUD DOM. (memory `tinyworld-name-labels`.)

---

## 4. FIRST-TIME / PERSISTENCE

**localStorage key convention:** `tinyworld:` colon-namespaced (e.g. `tinyworld:render:*`,
`tinyworld:multiplayer:*`).

**Reusable show-once pattern (proven):** `tinyworld:tips.dismissed`
- `24-crop-duster-banners.js:230` (key), read at `:328` (`=== '1'`), gate at `:329`
  (`if (dismissed) hide(); else show();`). `'1'` = dismissed.
- It is cloud-synced: listed in `PREF_SYNC_KEYS` at `30-ui-boot-wiring.js:880`.

**Welcome modal** (`#welcome-modal`, `tiny-world-builder.html:803`; `initWelcomeDialog()` at
`30-ui-boot-wiring.js:2`, show logic `:248-250`): shown on **every** page load, **skipped** when
query params `party`/`room`/`collab`/`share` present or on Tinyverse deeplinks
(`30-ui-boot-wiring.js:233-246`). It writes the build/play choice to `tinyworld:build-play-mode.v1`.
There is currently **no "don't show again" gate** on it.

**No existing tutorial / coachmark / walkthrough code** — searches for tutorial/onboard/intro/
walkthrough/coachmark/firstTime found nothing beyond `tips.dismissed` and the welcome modal. This
is greenfield.

**Where the onboarding-complete flag should live (recommendation):**
- Simplest: localStorage key `tinyworld:onboarding.completed` (mirror `tips.dismissed`), and add it
  to `PREF_SYNC_KEYS` at `30-ui-boot-wiring.js:880-885` so it syncs across devices for logged-in users.
- Cloud-first alt: profile object from `window.__tinyworldAccount.profile()`
  (`30-ui-boot-wiring.js:1095-1108`); add a field + `PUT /api/profile`. More work; only helps logged-in users.
- Player identity already persists at `tinyworld:multiplayer:name|color|client-id|avatar-*`
  (`47-worlds-room.js:133-161, 2160-2173`) — onboarding can read name/avatar to personalize.

---

## 5. i18n — ADD-A-STRING RECIPE

**Locale files (flat dot-namespaced key→string maps):**
`engine/i18n/en.js` (authoritative) + `fr.js` / `zh.js` / `es.js`. Core lookup
`engine/i18n/i18n-core.js`: `t(key, params)` (`:101-111`, falls back active→English→key, with
`{name}` interpolation), `has(key)` / `tx(key, fallback)` (`:116-127`).

**To add a string (all four files required — no silent English fallback in the checker):**
1. `engine/i18n/en.js` — add `'onboarding.welcome': 'Welcome to TinyWorld',` (group under a new
   `// ---- onboarding ----` comment).
2. `engine/i18n/fr.js`, `engine/i18n/zh.js`, `engine/i18n/es.js` — add the same key with the translation.
3. Reference it: in JS `window.t('onboarding.welcome')`; in static HTML `data-i18n="onboarding.welcome"`
   (or `data-i18n-title=` for attributes), localized at boot.
4. `npm run i18n:check` (`tools/i18n-check.js`) — enforces locale parity (no missing/orphan keys),
   no empty values, and that every literal `t('key')`/`data-i18n` exists in en.js. Must pass.

**Use the project's i18n skill `tinyworld-i18n` to do the FR/ZH/ES translations** (no translation
API; Claude translates using the glossary).

**Opt-out pattern (only for optional/feature-gated strings):** module 49 uses a local
`trVoxel(key, fallback)` (`49-worlds-avatar-picker.js:181-186`) to avoid *requiring* new i18n keys,
keeping the `i18n:check` count stable. For a shipped, required onboarding flow, prefer adding real
keys to all four locales rather than this dodge — but if you want to land the feature without
touching i18n in v1, the `trVoxel`-style local-fallback wrapper is an accepted precedent.

---

## 6. BUILD / SERVE

- **Local dev/verify: run `netlify dev`, NOT bare `npm run dev` (:3000).** netlify dev serves the
  `/api/*` functions (worlds, AI, wallet) and injects env; the bare dev-server breaks worlds/Tinyverse.
  Port varies (user has run :3009/:8888) — check the running process. Source edits to
  `engine/world/*.js` are served **live** through netlify dev; no build step needed for local view checks.
  (memory `tinyworld-must-use-netlify-dev`.)
- **Prod is the built `dist/` copy.** The served entry is `dist/index.html` (a copy of
  `tiny-world-builder.html`) with copied `dist/styles|engine|models`. After any view-facing edit run
  `./publish.sh` to regenerate dist/ and verify the change landed in `dist/` (grep the built file).
  dist/ is not git-tracked. (memory `tinyworld-dist-build`.)
- **To view the lobby locally:** start `netlify dev`, open the served port with `?world=tidewater-bay`
  (the lobby/demo world). The welcome modal is skipped for multiplayer/deeplink params; otherwise
  dismiss it, then the world auto-enters via `maybeAutoEnterDemoWorld()`.
- **Verifying overlays without a live room:** the lobby screen verify recipe (memory
  `tinyworld-lobby-screen-verify-recipe`) shows how to drive module 58 manually; headless browsers
  have no WebGL so the 3D wall/avatars are deploy-verify-only — verify HUD DOM in a real browser.
- **Note:** `party/index.js` (PartyKit server) deploys via `partykit deploy`, NOT publish.sh. Pure
  client onboarding (modules + i18n + localStorage) needs no server change.

---

## Suggested implementation shape (not built — for the plan)

- New IIFE module e.g. `engine/world/69-worlds-onboarding.js` (next free number; 68 is taken by
  world-notifications).
- On `WS.on('enter')`, capture `world.slug`; on first `WS.on('state')` after that, if
  `slug === (window.__TW_LOBBY_WORLD_SLUG||'tidewater-bay')` AND
  `localStorage.getItem('tinyworld:onboarding.completed') !== '1'`, show the overlay.
- Overlay: either a `z-index:70` corner coachmark or a `z-index:92` modal slide sequence mirroring
  the avatar-picker modal; `injectStyles()` once; teach WASD/arrows + minimap click-to-walk +
  harvest/mine HUD buttons + the avatar picker (person button, module 48/49).
- On finish/skip: `localStorage.setItem('tinyworld:onboarding.completed','1')` and add that key to
  `PREF_SYNC_KEYS` (`30-ui-boot-wiring.js:880`).
- Strings via real i18n keys in all 4 locale files; `npm run i18n:check`.
- Verify in `netlify dev`; `./publish.sh` before considering it shipped.
