# Tiny World Integration Examples

These scripts demonstrate the browser integration points in Tiny World Builder.
They use only Node built-ins.

## Browser Setup

1. Run the app:

```bash
npm run dev
```

2. Open `http://localhost:3000/tiny-world-builder.html`.
3. Open Settings, then Developer.
4. Generate an API key if you want webhook requests to include an
   `Authorization: Bearer ...` header.

## Outbound Webhooks

Start the webhook receiver:

```bash
node plugins/examples/webhook-receiver.js
```

In the app Developer panel, set:

```text
Outbound webhook URL: http://localhost:8787/webhook
```

Now place, clear, or reset cells in the app. The receiver logs batches like:

```json
{
  "source": "tiny-world-builder",
  "events": [
    {
      "event": "cell.set",
      "payload": { "x": 2, "z": 3, "cell": { "terrain": "grass", "kind": "tree" } },
      "at": 1778700000000
    }
  ]
}
```

Useful endpoints:

```bash
curl http://localhost:8787/health
curl http://localhost:8787/events
curl http://localhost:8787/latest
curl http://localhost:8787/clear
```

## Inbound SSE Commands

Start the relay:

```bash
node plugins/examples/sse-command-relay.js
```

In the app Developer panel, set:

```text
Inbound SSE relay URL: http://localhost:8788/sse
```

Then push commands into the relay:

```bash
node plugins/examples/send-command.js place --x 2 --z 2 --kind tree --terrain grass
node plugins/examples/send-command.js place --x 3 --z 2 --kind house --terrain grass --floors 2
node plugins/examples/send-command.js clear
node plugins/examples/send-command.js reset
```

The browser receives each command through `EventSource` and applies it locally.

Supported command shape:

```json
{ "op": "place", "x": 2, "z": 2, "terrain": "grass", "kind": "tree", "floors": 1 }
{ "op": "clear" }
{ "op": "reset" }
```

## MCP Bridge

`mcp-stdio-bridge.js` is a minimal MCP server over stdio. It exposes tools that
send commands to the SSE relay and read the webhook receiver log.

Example MCP server config:

```json
{
  "mcpServers": {
    "tinyworld-demo": {
      "command": "node",
      "args": ["/absolute/path/to/tinyworld/plugins/examples/mcp-stdio-bridge.js"],
      "env": {
        "TINYWORLD_RELAY_URL": "http://localhost:8788/command",
        "TINYWORLD_WEBHOOK_URL": "http://localhost:8787"
      }
    }
  }
}
```

Start `sse-command-relay.js` before calling mutation tools from MCP. Start
`webhook-receiver.js` if you want MCP to read outbound events.

## Watchable Vehicle Road Demo

For a shareable browser-only seeded demo, open:

```text
http://localhost:3000/tiny-world-builder?demo=vehicles&seed=tide-ridge-428
```

For a larger browser-only scale test, open:

```text
http://localhost:3000/tiny-world-builder?demo=vehicles-large&seed=metro-culdesac-128&stats=1
```

Param aliases for the large route:

- map size: `size=`, `mapSize=`, `grid=`, or `gridSize=` (nearest valid demo grid size from `12` through `256`: `12`, `16`, `20`, `32`, `48`, `64`, `96`, `128`, `256`)
- car count: `cars=`, `carCount=`, `vehicles=`, or `vehicleCount=` (`1..120`, capped by available starts)

```text
http://localhost:3000/tiny-world-builder?demo=vehicles-large&seed=ridge-loop-917&size=128&cars=18&stats=1
```

The large route uses arterial roads, bridge crossings, cul-de-sacs, and
autonomous vehicles on long routes. Neither path requires the SSE relay: the app
itself creates the seeded map, places delivery bots, assigns one or more targets per vehicle,
and starts them driving.

`vehicle-road-demo.js` is a no-dependency MCP client that talks to
`mcp-stdio-bridge.js`, paints a road/water/bridge network through the SSE relay,
spawns runtime vehicles, then keeps retargeting them so the browser stays
visibly active.

Terminal A:

```bash
npm run dev
```

Terminal B:

```bash
node plugins/examples/sse-command-relay.js
```

Optional webhook capture:

```bash
node plugins/examples/webhook-receiver.js
```

In the app Developer panel, set:

```text
Inbound SSE relay URL: http://localhost:8788/sse
Outbound webhook URL: http://localhost:8787/webhook
```

Then run:

```bash
npm run demo:vehicles
```

Useful variants:

```bash
# run exactly two retarget cycles, useful for smoke checks
node plugins/examples/vehicle-road-demo.js --cycles 2 --paint-delay 0

# keep the existing road layout and respawn/retarget vehicles only
node plugins/examples/vehicle-road-demo.js --skip-layout
```

The script waits for at least one connected browser SSE client by default. Use
`--no-wait-client` only when deliberately sending commands into an unattended
relay.
