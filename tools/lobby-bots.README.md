# Lobby population layer (`tools/lobby-bots.mjs`)

Always-on peers that make the in-world lobby (`tidewater-bay`) feel alive. They join
the live PartyKit world room as **real peers**, wander the lobby grid, emote, and chat
with LLM banter on **free OpenRouter models**. Rendering is handled entirely
client-side (voxel avatar + nameplate + chat bubble in
`engine/world/47-worlds-room.js`), so this process speaks only the world protocol —
there is no rendering code here.

They are designed to be **indistinguishable from human players**: ordinary
first-name / gamer-handle display names (e.g. *Alex*, *mia_k*, *Jordan*, *sam2200*,
*priya*), plain nameplates, casual chat, and **no "(bot)" label or toast**.

## Quick start

```bash
# 10 NPCs into the production lobby, with LLM chatter:
export OPENROUTER_API_KEY=sk-or-...
export TW_ORIGIN=https://<your-site>        # https origin that serves /api/worlds
npm run bots:lobby
```

Without `OPENROUTER_API_KEY` the bots still **wander and emote** — they just stay
silent (no chat). Nothing crashes.

## How it joins (observer, not a weakened seat)

Verified against `party/index.js`:

- In production the room sets `WORLDS_JOIN_SECRET`, so an **empty-token** join is
  downgraded to role `observe` (`party/index.js:1039-1057`).
- Observers **can move** (`handleMove` allows `observe`; only `play` needs a
  `profileId` — `:1211-1212`) and **can chat/emote** (those handlers gate on
  `admitted.has(id)`, set for every role at `:1080`).
- Observers **cannot** harvest or touch the durable economy (`:1238`) — exactly
  right for ambient NPCs.

So the bots join with an **empty token as observers**. No token minting, no change
to join security. They send `role: 'observe'` explicitly so behaviour is identical
in production (secret set) and in open testing mode (no secret).

## Identity (indistinguishable from humans)

The client tags a peer as a bot (`isBotPeer` in `47-worlds-room.js`) only when its
conn id starts with `bot-` **or** its profileId starts with `bot:`. These peers avoid
both:

- The conn id is a **guest-style `u_…` token** — exactly the shape a real
  not-logged-in visitor's `connToken` produces — so it never matches `bot-`.
- The join sends **`profileId: null`**, which the server maps to `guest:<id>` in open
  mode (or keeps null in production) — never a `bot:` value. (`presenceFor` in
  `party/index.js` doesn't even relay `profileId`, so the conn id is the marker that
  actually reaches the client; `profileId: null` is belt-and-suspenders.)

Result: neither `isBotPeer` branch fires. There is **no "(bot) joined" toast** — a
new peer fires the same plain join toast a human gets (`47-worlds-room.js:428`), with
a plain nameplate and normal chat. Combined with ordinary human display names, a
visitor cannot tell these apart from real players. (The `worlds.notify.botJoined`
i18n key is intentionally left in place — it is still used by the local-only
`engine/world/51-worlds-bots.js` path — these lobby peers simply never trigger it.)

## `TW_ORIGIN` is **required** (safety guard)

The runner **refuses to start unless `TW_ORIGIN` (or `--origin`) is set**, printing a
clear error and exiting. This is a safety guard: without an origin the runner cannot
resolve the real **numeric** `worldId`, and a join into a cold room would make the
server cold-load a **default empty board** (open mode: `setWorldStateFromData` with
`cells: []`) — which would clobber the live lobby. Requiring the origin guarantees the
runner only ever populates the real, already-correct world.

The server cold-loads the world (`ensureWorldLoaded`) via its own `SITE_URL`, but
**only when it receives a real NUMERIC `worldId`** — `/api/worlds?id=` ignores a slug
(`netlify/functions/worlds.mjs:35-37`). The runner resolves that numeric id from
`TW_ORIGIN/api/worlds?slug=<slug>` and forwards it **only if it is numeric**.

- **Numeric id resolves (normal case)**: a cold/hibernated lobby self-loads and the
  peers walk the *real* lobby before any human arrives.
- **Origin set but lookup fails** (bad slug, site down): the runner does **not** send
  a worldId at all (it never sends a slug — that would silently pin the room to a
  wrong/default 8x8 board). The peers join but stay put (with a loud warning) until a
  real player loads the lobby, then begin wandering the correct board.

## Resilience (always-on)

On any socket drop (PartyKit restart, network blip) each bot auto-reconnects with
capped exponential backoff + jitter (2s → 30s ceiling), indefinitely; the backoff
resets on a clean re-join. Dead-socket timers are cleared before reconnecting so no
intervals leak. `SIGINT`/`SIGTERM` stop reconnects and shut down cleanly. Run it
under any supervisor (`Restart=always` is a backstop, not the primary mechanism).

## LLM (free OpenRouter models)

- Endpoint: `https://openrouter.ai/api/v1/chat/completions` (OpenAI-compatible),
  called via global `fetch` — no SDK dependency.
- Default model: `meta-llama/llama-3.3-70b-instruct:free`. Override with
  `--model` / `OPENROUTER_MODEL`. **Free-only is enforced**: the runner refuses to
  start unless the model id ends with `:free` (override deliberately with
  `--allow-paid`). Available free ids change over time — see
  https://openrouter.ai/models?max_price=0.
- **Graceful degradation**: a missing key, `401/403` (bad key), `429` (rate limit),
  any other non-2xx (incl. model-not-found), or empty content → the bot **skips that
  chat turn** and keeps wandering/emoting. It never crashes and never spams.
- **No emoji**: every generated line is stripped of emoji/pictographic characters
  before it is sent (repo no-emoji rule; prompting alone is not a guarantee).
- **Shared throttle**: free-tier limits are per *account*, not per bot. One global
  min-interval gate (~13 calls/min across all bots) plus jitter prevents 10+ bots
  from bursting the endpoint, on top of a per-bot 15s chat cooldown.

## Flags / env

| Flag        | Env               | Default                                          | Meaning |
|-------------|-------------------|--------------------------------------------------|---------|
| `--slug`    | `TW_LOBBY_SLUG`   | `tidewater-bay`                                  | Lobby world slug (room = `world-<slug>`) |
| `--bots`    | `BOTS_COUNT`      | `10`                                             | NPC count (1–40) |
| `--host`    | `PARTYKIT_HOST`   | `wss://tinyworld-shared-building.jasonkneen.partykit.dev` | PartyKit ws base |
| `--origin`  | `TW_ORIGIN`       | *(required — runner refuses to start without it)* | https site for worldId discovery / cold-start |
| `--model`   | `OPENROUTER_MODEL`| `meta-llama/llama-3.3-70b-instruct:free`         | OpenRouter model id; must end in `:free` |
| `--allow-paid` | —              | off                                              | Permit a non-`:free` model (deliberate override) |
| `--mode`    | `BOTS_MODE`       | `both`                                           | `ambient` \| `react` \| `both` (unknown → warns, uses `both`) |
| `--seconds` | `BOTS_SECONDS`    | `0`                                              | Auto-exit after N seconds (0 = forever) |
| `--verbose` | —                 | off                                              | Also log every move/emote |
| —           | `OPENROUTER_API_KEY` | *(required for chat)*                         | OpenRouter key; unset → silent bots |

## Always-on deployment

It is a plain long-running Node process. Run it under whatever supervisor you use
(systemd, pm2, a container, a small VM). Example systemd unit:

```ini
[Service]
Environment=OPENROUTER_API_KEY=sk-or-...
Environment=TW_ORIGIN=https://<your-site>
WorkingDirectory=/opt/tiny-world-builder
ExecStart=/usr/bin/node tools/lobby-bots.mjs --bots 10
Restart=always
```

## Not in the browser build

This is an external CLI process. It is never imported by the app and does not affect
the production web build. It does **not** touch the local-only
`engine/world/51-worlds-bots.js` (which hard-refuses production by design).
Requires Node 22+ (global `WebSocket` and `fetch`).
