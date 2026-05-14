---
name: tinyworld-integrations
description: Use when changing Tiny World Builder API, webhook, SSE, MCP, plugin, or automation examples.
---

# Tiny World Integrations

The app has browser-local integration points, not a backend API:

- Outbound webhooks live in `tiny-world-builder.html` under
  `// -------- API / webhooks / SSE bridge --------`.
- `fireWebhook(event, payload)` batches editor mutations and POSTs
  `{ source: 'tiny-world-builder', events }` to the configured Developer-panel
  webhook URL.
- Inbound automation uses `EventSource` against the configured Developer-panel
  SSE URL. Each SSE `data:` payload must be one JSON command accepted by
  `applyRemoteCommand`.
- Supported inbound ops include `place` / `set_cell`, `clear`, `reset`, plus runtime-only vehicle controls: `vehicle_spawn`, `vehicle_set_goal`, `vehicle_controls`, `vehicle_remove`, and `vehicle_clear`.

Examples live under `plugins/examples/`:

- `webhook-receiver.js` captures outbound webhook batches.
- `sse-command-relay.js` exposes `/sse` for the browser and `/command` for
  external clients.
- `send-command.js` is a small CLI for the relay.
- `mcp-stdio-bridge.js` is a dependency-free MCP stdio server that calls the
  relay and reads the webhook log.

When changing command shape, update the app bridge and these examples together.
