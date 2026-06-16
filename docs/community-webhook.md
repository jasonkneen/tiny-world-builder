# Community Moderation Webhook

Server-to-server endpoint so an external agent (e.g. **Hermes**) can moderate the
TinyWorld community: ban / unban members, block, hide / restore messages, delete messages, purge spam, and
delete rooms. It is authenticated by a **shared secret**, not a logged-in user.

## Configuration (Netlify env)

| Variable | Purpose |
|---|---|
| `TINYWORLD_COMMUNITY_WEBHOOK_SECRET` | **Required.** Shared secret for inbound auth and outbound signing. Without it the webhook returns `503`. |
| `HERMES_COMMUNITY_WEBHOOK_URL` | Optional. URL the app POSTs community events to (outbound). Also accepts `TINYWORLD_COMMUNITY_EVENT_URL`. |
| `TINYWORLD_COMMUNITY_OWNER` | Optional. Username treated as super-owner / default moderator (default `jasonkneen`). |
| `TINYWORLD_COMMUNITY_STAFF` | Optional. Comma-separated extra staff usernames. |

## Inbound: trigger moderation

`POST /api/community/webhook`

**Auth** (either header):
- `x-tinyworld-signature: sha256=<hex HMAC-SHA256 of the raw body, key = secret>` *(preferred — authenticates the body too)*
- `x-webhook-secret: <secret>` *(simple shared-bearer)*

**Single action body:**
```json
{ "action": "ban", "target": { "username": "spammer" }, "durationHours": 24, "reason": "spam", "roomId": { "slug": "general" } }
```

**Batch (executed in order, max 50):**
```json
{ "actions": [
  { "action": "hideMessage", "messageId": 123, "reason": "spam review" },
  { "action": "deleteMessage", "messageId": 124 },
  { "action": "ban", "target": { "profileId": 42 }, "durationHours": 0 }
] }
```

### Targets & rooms (flexible selectors)
- `target` / `blocked` / `blocker`: `{ "profileId": N }` | `{ "username": "..." }` | `{ "displayName": "..." }` | `{ "wallet": "<solana pubkey>" }`
- `roomId`: a number, `{ "roomId": N }`, or `{ "slug": "general" }`. Omit (or `null`) for a **global** ban.

### Actions
| action | fields | effect |
|---|---|---|
| `ping` | — | health check, returns `{ pong: true }` |
| `ban` | `target`, `durationHours` (0 = permanent), `reason?`, `roomId?` | block posting (global or per-room) until expiry |
| `unban` | `target`, `roomId?` | lift matching ban |
| `block` | `target` (the blocked), `blocker?` (defaults to super-owner) | hide blocked member from blocker; blocks DMs |
| `hideMessage` | `messageId`, `reason?` | soft-hide one message from regular readers while preserving it for moderators |
| `unhideMessage` / `restoreMessage` | `messageId` | restore a hidden message |
| `deleteMessage` | `messageId` | hard-delete one message |
| `purgeMessages` | `target`, `roomId?`, `limit?` (≤500, default 50) | bulk-delete a member's recent messages (spam cleanup) |
| `deleteRoom` | `roomId` | delete a channel (cascades messages/bans/invites) |

`durationHours` semantics match the in-app ban: `0`/negative/blank ⇒ permanent.

### Read context (for the agent to reason over)
`GET /api/community/webhook?resource=context&limit=50&roomSlug=general` (same auth) →
```json
{ "rooms": [...], "messages": [{ "id", "roomId", "body", "createdAt", "author": { "id", "username", "displayName" } }], "activeBans": [...] }
```

## Outbound: events the app emits

When configured, the app POSTs to `HERMES_COMMUNITY_WEBHOOK_URL` (signed with the
same secret in `x-tinyworld-signature`) so the agent can observe and react:

```json
{ "source": "tinyworld-community", "event": "message.created", "sentAt": "…", "data": { "message": { … }, "room": { "id", "slug", "name" }, "recentCount": 3 } }
```

Currently emitted: `message.created` (room messages) plus moderation events
`message.hidden`, `message.unhidden`, and `message.deleted`. Fire-and-forget — a slow or
down agent never blocks the user posting or moderator action.

## Files
- `netlify/functions/community-webhook.mjs` — the endpoint (`config.path = /api/community/webhook`).
- `netlify/functions/lib/community-moderation.mjs` — shared primitives (auth verify, profile resolution, ban/unban/block/delete/purge, outbound emit). Imported by both the webhook and `community.mjs`.

## Example: Hermes flow
1. User posts spam → app emits `message.created` to Hermes.
2. Hermes classifies it as spam.
3. Hermes POSTs `{ "actions": [ { "action": "deleteMessage", "messageId": <id> }, { "action": "ban", "target": { "profileId": <author> }, "durationHours": 24, "reason": "spam" } ] }` back to `/api/community/webhook`, signed with the secret.
4. The message is removed and the author is banned for 24h.
