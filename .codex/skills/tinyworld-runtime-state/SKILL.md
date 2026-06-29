---
name: tinyworld-runtime-state
description: Use when adding or changing persisted user state — settings defaults, audio, camera/orbit, panel positions, feature flags, and the in-app "Save Defaults" pipeline that snapshots localStorage into tinyworld-defaults.json. Also covers the inline-script regex gotcha that has burned us twice.
---

# Tiny World Runtime State

Most browser-local persisted user state lives in `localStorage` under the
`tinyworld:*` prefix. Read/write convention: stringified primitives or
`JSON.stringify` for objects. Never store credentials, local world saves, cloud
world saves, or per-viewport pixel positions in the shipped defaults file — see
exclusion list below.

Persisted render/material settings that affect shared Three materials must be
re-applied during late boot, not only from control `input` handlers. In
particular, material wear (`tinyworld:render:materialWear`) needs the
`applyPersistedMaterialSettingsOnBoot()` pass so saved wear is visible on first
render without toggling the slider.

Builder directional sun defaults to `10.0` (1000%) under
`tinyworld:render:directionalSun`. Keep the one-time migration narrow: upgrade
missing/old untouched `1.0` builder values to `10.0`, but preserve clearly
user-edited non-default values. Island Viewer has its own
`tinyworld:island-viewer:*` graphics keys and migrates its old `1.1` default
separately.

Cloud saves are separate from defaults/localStorage:

- The account modal posts full TinyWorld JSON to Netlify Functions
  (`/api/builds`) backed by Netlify Database.
- On authenticated boot, local named worlds from `tinyworld:worlds.v1` are
  uploaded to `/api/builds`; the active unslotted `tinyworld:v1` state gets a
  local slot first so it can be bound to a cloud row. Top-menu "My worlds" and
  account-modal "My Worlds" must read from the same cloud-aware list.
- The world menu's share action posts the same full state to `/api/share`;
  public share URLs load by resolving `?share=<id>` to same-origin
  `/api/share?id=<id>`.
- Local custom assets are also synced once authenticated. `/api/assets` stores
  custom voxel-build stamps and saved asset templates, then merges the remote
  library into localStorage before pushing the merged local copy back up.
- Keep `snapshotCurrentState()` in sync with `saveState()` so account saves and
  share URLs include grid size, islands, moorings, custom voxel stamps, camera,
  landscape settings, and cells outside the home board that the user edited.
- Top-bar JSON import should accept the app's own portability shapes: a bare
  world state (`cells` at the root), cloud/account envelopes (`data` or `state`
  containing a world), named-world/localStorage lists, and exported asset
  bundles. Imported worlds should be inserted into `tinyworld:worlds.v1` so the
  account DB sync can pick them up after login.
- The visible top-bar JSON import affordance should be a native
  `<label for="import-file">` trigger with an off-screen file input, not only a
  button that programmatically clicks a hidden input. Some browsers silently
  drop hidden-input file picker calls even when the click handler ran.
- Queued account syncs must not be dropped while a previous `/api/builds`
  request is in flight. Keep a pending retry flag around `twCloudWorldSyncing`
  so imports and saves made during bootstrap still reach the database.
- Live multiplayer rooms are ephemeral runtime state. Keep PartyKit presence
  (cursor, selected cells, active tool) out of saved world JSON and send durable
  edits as full `cell.set` snapshots, then apply them through `setCell()` so
  rendering and later account saves stay on the normal persistence path.

## Defaults pipeline (dev → all users)

There is a "Save Defaults" button in **Settings → Workspace** (visible only on
`localhost` / `127.0.0.1` / `file:`). When clicked:

1. The browser snapshots every `tinyworld:*` localStorage key (minus the
   exclusion list).
2. POSTs `{ settings: { key: value, ... } }` to `/api/save-defaults`.
3. `tools/dev-server.js` writes the result to `tinyworld-defaults.json` at the
   repo root.
4. `publish.sh` copies that file into `dist/` so it ships with the site.
5. On every page load, the first inline `<script id="tinyworld-defaults-bootstrap">`
   does a **synchronous** `XMLHttpRequest` for `tinyworld-defaults.json`. For
   each key the user does NOT already have in localStorage, it seeds the
   default. Existing user prefs win — defaults never overwrite.

The bootstrap script MUST have an attribute (e.g. `id="tinyworld-defaults-bootstrap"`)
so the `tools/check.js` regex doesn't grab it. See the inline-script gotcha
below.

### Exclusion list (must stay in sync, two copies)

Mirror these regexes in **both** `tools/dev-server.js` (server filter) and the
inline `setupDevSaveDefaults()` IIFE (client filter):

- `/^tinyworld:v\d+$/` — serialised home world
- `/^tinyworld:worlds\.v\d+/` — multi-world saves
- `/^tinyworld:ai:key:/` — API credentials (SECURITY)
- `/^tinyworld:auth:/` — account/session credentials (SECURITY)
- `/^tinyworld:ai:prompt$/` — user prompt text
- `/^tinyworld:vehicle-demo:/` — session demo state
- `/^tinyworld:audio:music-track$/` — per-user manual music choice
- `/^tinyworld:audio:music-mode$/` — random vs manual music mode
- `/^tinyworld:welcome:dismissedId$/` — per-user welcome dismissal
- `/:backup$/` — any explicit backup
- `/\.pos$/`, `/-pos$/`, `/:pos$/` — panel/widget positions (viewport-specific)

If you persist a new value that should NOT ship as a default, add a matching
pattern to **both** lists in the same change.

## Panel/widget positions — RELATIVE, not pixels

Draggable panels (minimap, crowd panel, agent panel, future panels) MUST save
their position as percentage of viewport, not absolute pixels. Absolute pixels
saved on a wide monitor land off-screen for users on smaller displays.

Format:
```js
localStorage.setItem(KEY, JSON.stringify({
  topPct: +(r.top / window.innerHeight).toFixed(4),
  leftPct: +(r.left / window.innerWidth).toFixed(4),
}));
```

Read with backward compatibility for legacy absolute values:
```js
let top, left;
if (Number.isFinite(p.topPct) && Number.isFinite(p.leftPct)) {
  top = p.topPct * window.innerHeight;
  left = p.leftPct * window.innerWidth;
} else if (Number.isFinite(p.top) && Number.isFinite(p.left)) {
  top = p.top; left = p.left;
}
```

Always re-apply on `window.addEventListener('resize')` and clamp to
`[8, innerWidth - w - 8]` / `[8, innerHeight - h - 8]`.

The existing minimap implementation (`clampMinimapPosition` /
`setMinimapPosition` / `applyStoredMinimapPos` / `endMinimapDrag`) is the
reference pattern. Minimap collapse must shrink in place; do not use a
`translateX(...)` trick that pushes the map outside the viewport.

The AI chat panel is a fixed right-side rail, not a draggable bottom prompt.
Persist only width/collapse state under `tinyworld:agent:panel-pos` (the `-pos`
suffix keeps it out of shipped defaults). Do not restore absolute `left/top`
coordinates for the AI chat; it should stay anchored to the right edge, with a
left-edge resize grip and a compact collapsed rail.

## Audio system

Two layers:

1. **HTMLAudioElement** for music (looped) and one-shot SFX (cloned per play).
2. **Web Audio (PannerNode/StereoPannerNode)** for positional sources
   (engines, water) — distance attenuation + L/R pan based on
   `(sourceWorldPos - camera.position)` projected onto camera-right.

State keys (`AUDIO_LS`):
- `tinyworld:audio:music` / `music-muted` / `music-track` / `music-mode`
- `tinyworld:audio:sfx` / `sfx-muted`
- `tinyworld:audio:ambient` / `ambient-muted`
- `tinyworld:audio:engines` / `engines-muted`

Music tracks: `MUSIC_TRACKS` array (currently 6 horizon + 1 rising). Random
playback must use only `MUSIC_RANDOM_TRACKS` / the `music-horizon-*` files;
`music-rising-1.mp3` stays selectable manually but should not ship as a default
or be picked by automatic random playback. Avoid
prop engine files (`large-prop-engine-*`, `foley-propellers-*`) — the planes
have jet engines, use `foley-rocket-engines-1..4`. Water variants:
`foley-water-1..4`. Loop seams are hidden by **overlaying two variants at
different start offsets and per-source gains**.

UI: single `#sound-icon` button lives inside the toolbar (appended in
`buildToolbar()` near the audio panel reference). Click toggles the floating
`#sound-panel` with track list + 4 volume rows (Music, Effects, Ambient,
Engines). `currentMusicTrack()` resolves the persisted choice or random.

## Camera / view persistence

Single key `tinyworld:view.camera` holds:
```json
{ "mode": "perspective", "azimuth": 1.2, "polar": 0.9, "viewSize": 8.2,
  "target": { "x": 0, "y": 0, "z": 0 } }
```

`updateCamera()` schedules a throttled save (250ms debounce) every frame the
camera changes. On boot, the `let` declarations read this key and apply with
clamping (`clampViewSize`, `MIN_ORBIT_POLAR`/`MAX_ORBIT_POLAR`). Ships in
defaults — sets the welcome shot for new users.

## Feature flags

- `tinyworld:worlds.activeTinyverse.v1` is per-device navigation state for
  refreshing back into the last active Tinyverse world. It is not a world save,
  not account-synced, and must stay excluded from shipped defaults in both
  `tools/dev-server.js` and the client Save Defaults filter.
- Tinyverse room teardown and user-facing exit are separate concerns:
  `47-worlds-room.js` internal `leaveRoom()` should only tear down sockets/HUDs/
  avatars/minimaps. User-facing island exits should call `WS.exitToWorldPicker()`,
  which clears `tinyworld:worlds.activeTinyverse.v1`, restores the pre-room
  builder state through `WS.restoreFreeform()`, and opens the picker overlay.
  Do not hide picker navigation inside minimap or teardown helpers; that has
  previously exposed legacy multi-gate selector boards.
- Tinyverse room play mode is temporary. Use `__tinyworldMode.setPlayTemporary()`
  when forcing multiplayer play chrome, do not persist that to
  `tinyworld:build-play-mode.v1`, and make room exit restore Build so the toolbar
  is not trapped hidden after refresh/exit.
- In-app Home controls should reopen the reusable welcome/launch modal through
  `window.__tinyworldShowWelcomeLaunch()` instead of navigating to `/` or
  logging the user out. That launch modal is the canonical route back to
  Tinyverse / Battleworlds / Build.
- World-selection stargates are real in-island travel points again, but only as
  one center gate per island. The `/api/worlds` normalization and the client
  universe overlay should strip legacy multi-gate cells, replace any center
  object with a single `{ kind: 'stargate', dest: '__world-picker' }`, and keep
  the picker itself as UI chrome rather than a Nexus board.
- Tinyverse world entry must use the real `/api/worlds` detail response and its
  signed join token, including deploy-preview/test hosts. Do not create
  tokenless client-only preview worlds for entry; a PartyKit world room with a
  join secret will correctly downgrade those joins to observer.
- PartyKit world-room walkability must be server-authoritative and solid by
  default: only empty tiles, water, bridges, stargates, plants/animals, and low
  ground cover are standable. Buildings, trees, rocks, fences, model stamps,
  voxel builds, and unknown future object kinds must block movement.
- `tinyworld:features:cluso` — legacy Cluso flag; no app runtime path reads this
  key. The Cluso embed is now injected local-dev-only by `tools/dev-server.js`
  (see tinyworld-single-file SKILL), not gated by this key.
- `tinyworld:features:ai` — AI panel. AI surfaces (`[data-ai-interface]`) are
  hidden on prod via `html.ai-disabled`, enabled by local host / `?ai=1` / this
  flag. Additionally, signed-in accounts whose email is in `AI_ACCOUNT_ALLOWLIST`
  (in `30-ui-boot-wiring.js`) unlock AI live on login (`applyAccountAiEntitlement`)
  and revert on logout — tied to the account, not persisted to this key.
- `tinyworld:features:model-stamp-api` — stamp-defaults dev endpoint.

## Inline `<script>` gotcha (read this!)

`tools/check.js` uses this regex to extract the main app script:
```js
html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
```

It matches the **first plain `<script>`** through to the last `</script></body>`.
If you add an extra inline `<script>` block (e.g. a bootstrap loader), it MUST
have an attribute so the regex skips it:

```html
<script id="my-bootstrap">...</script>   <!-- ✓ regex ignores -->
<script>...</script>                     <!-- ✗ would be conflated -->
```

Symptom when wrong: `npm test` fails with
`inline app script syntax error: Unexpected token '<'` because the regex
grabbed your bootstrap + the `</script><script>` separator + the main app.

## Validation

After any persistence change:

1. `node tools/check.js` — inline JS syntax + schema parity.
2. `node tools/smoke-static.js` — no-browser smoke.
3. Browser at `http://localhost:3000/tiny-world-builder` with **clean
   localStorage** in a fresh tab — confirm defaults seed correctly and the
   app doesn't error.
4. Then with existing localStorage — confirm user prefs are NOT overwritten.

## Common pitfalls

- Saving panel positions as absolute pixels (do RELATIVE %).
- Persisting an API key, prompt text, or world save into defaults (add to
  exclusion list in both server + client).
- Adding a new inline `<script>` without an attribute (breaks `npm test`).
- Forgetting to restart `npm run dev` after editing `tools/dev-server.js` —
  the running process won't have the new route, returns 405.
- Removing a temporary `<input type="file">` while the native file picker is
  still open. Dynamic JSON pickers should clean up after `change`/`cancel`, not
  via a short timeout.
- Letting a hard-coded camera default drift from `DEFAULT_AZIMUTH`/
  `DEFAULT_POLAR`/`DEFAULT_TARGET` — keep restored state clamped to those
  ranges.


## Export ↔ saveState parity (full portability)

The JSON **file export** (`#export` handler in `20-input-place-erase.js`) must
serialize the *same* payload as `saveState()` (`29-persistence-api.js`) so an
imported world is fully self-contained. Both include: `islands`
(`serializeEditableIslands`), `moorings` (`serializeMooringCables`, carries each
cable's `style`), `cells`, **`voxelBuildStamps`** (`referencedVoxelBuildStamps(cells)`
— inlines custom block `voxels`/`customParts`/`footprint`), camera, landscape,
and `planetLandscape`. `applyState()` restores `voxelBuildStamps` on import.
Model stamps are bundled manifest assets referenced by `appearance.modelStampId`
(no binary to embed). When adding any new persisted world concept, add it to
**both** `saveState` and the export object, and handle it in `applyState`.
