# Lobby population layer (`tools/lobby-bots.mjs`)

Always-on NPC peers that make the in-world lobby (`tidewater-bay`) feel alive.
They join the live PartyKit world room as **real peers**, wander the lobby grid,
emote, and chat with LLM banter on **free OpenRouter models**. Rendering is handled
entirely client-side (voxel avatar + nameplate + chat bubble in
`engine/world/47-worlds-room.js`), so this process speaks only the world protocol —
there is no rendering code here.

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

## NPC disclosure (not deceptive)

Each bot connects with a PartyKit conn id prefixed `bot-…`. The client detects that
(`isBotPeer` in `47-worlds-room.js`) and shows the localized **"(bot) joined"** toast
(`worlds.notify.botJoined`, present in all locales). Combined with ambient NPC names
(e.g. *Marsh the Wanderer*, *Old Brine*, *Willow the Gardener*) a real visitor can
tell these are characters, not impersonated users.

## Cold start — `TW_ORIGIN` is required to populate a cold lobby

The server cold-loads the world (`ensureWorldLoaded`) via its own `SITE_URL`, but
**only when it receives a real NUMERIC `worldId`** — `/api/worlds?id=` ignores a
slug (`netlify/functions/worlds.mjs:35-37`). The runner resolves that numeric id
from `TW_ORIGIN/api/worlds?slug=<slug>` and forwards it **only if it is numeric**.

- **With `TW_ORIGIN` (recommended for always-on)**: the numeric id resolves, so a
  cold/hibernated lobby self-loads and bots walk the *real* lobby before any human
  arrives.
- **Without `TW_ORIGIN`** (or if the lookup fails): the runner does **not** send a
  worldId at all (it never sends a slug — that would silently pin the room to a
  wrong/default 8x8 board). So a **cold** room is **not** populated: bots join and
  render, but stay put (with a loud warning) until a real player loads the lobby,
  then begin wandering the correct board. Set `TW_ORIGIN` for reliable always-on
  population.

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
| `--origin`  | `TW_ORIGIN`       | *(none)*                                         | https site for worldId discovery / cold-start |
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
