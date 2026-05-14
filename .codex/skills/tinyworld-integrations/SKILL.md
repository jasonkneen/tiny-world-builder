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
  - `?demo=vehicles-large&seed=metro-culdesac-128&stats=1` creates the default 128×128 scale test with arterial/ring roads, bridge crossings, 200+ cul-de-sac endpoints, and 36 autonomous vehicles on long routes.
  - Large-demo params: `size=` / `mapSize=` / `grid=` / `gridSize=` accept the nearest valid demo grid size from `12` through `256` (`12`, `16`, `20`, `32`, `48`, `64`, `96`, `128`, `256`); `cars=` / `carCount=` / `vehicles=` / `vehicleCount=` accept `1..120` and are capped by available unique endpoints.
  Keep these demos visually self-identifying: show an active badge, hide overlays
  that cover the road network, and make vehicles obvious with beacons/markers.
  During local demo work, `tools/dev-server.js` should make bare
  `http://localhost:3000/` and no-query `http://localhost:3000/tiny-world-builder`
  redirect to the small seed so the user can simply open the port or remembered
  app URL and watch it. Use the large URL explicitly for scale/perf checks.

When changing command shape, update the app bridge and these examples together.
