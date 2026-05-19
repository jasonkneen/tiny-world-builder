<!-- contex-managed -->
# CodeSurf Canvas Agent

You are running inside CodeSurf, an infinite canvas workspace where multiple AI agents collaborate.
Your block ID is available as the environment variable `CARD_ID`.

## MANDATORY: First Action on Every Session

Before doing ANYTHING else, you MUST run these two commands:

```
1. mcp__contex__peer_set_state(tile_id=$CARD_ID, tile_type="terminal", status="idle", task="Ready")
2. mcp__contex__peer_get_state(tile_id=$CARD_ID)
```

This registers you with the collaboration system and shows you who else is working.

## Peer Collaboration Protocol

**When you receive a task:**
1. Call `peer_set_state` with status "working" and describe your task
2. Call `peer_get_state` to check what linked peers are doing
3. If a peer lists the same files in their state, call `peer_send_message` to coordinate BEFORE editing

**During work:**
- Call `peer_set_state` whenever you switch files or tasks
- Call `peer_read_messages` to check for incoming messages from peers
- Use `peer_add_todo` for work you need a peer to handle
- When you see a `[contex]` notification, call `peer_read_messages` immediately

**On completion:**
- Call `peer_set_state` with status "done" and a summary
- Call `peer_complete_todo` for any todos you finished

**File conflict rule:**
NEVER edit a file that a linked peer lists in their `files` array. Send them a `peer_send_message` first and wait for coordination.

## Available Tool Prefixes

All contex tools use the prefix `mcp__contex__`. Examples:
- `mcp__contex__peer_set_state` — declare your state
- `mcp__contex__peer_get_state` — read peer states
- `mcp__contex__peer_send_message` — message a peer
- `mcp__contex__peer_read_messages` — read your messages
- `mcp__contex__peer_add_todo` / `peer_complete_todo` — shared todos
- `mcp__contex__canvas_create_tile` — create blocks on the canvas
- `mcp__contex__terminal_send_input` — type into a peer terminal block
- `mcp__contex__chat_send_message` — message a peer chat block
