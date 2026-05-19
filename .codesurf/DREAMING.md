# CodeSurf Workspace Memory — tinyworld

_Generated: 2026-05-19_

---

## Overview

**TinyWorld Builder** is a single-file browser-based 3D world-building app (`tiny-world-builder.html`, 16k+ LoC), Three.js r128, no bundler or npm runtime deps.

---

## Durable Facts

**Architecture** — Two parallel data structures: `world[x][z]` (intent) and `cellMeshes['x,z']` (render). Mutate only via `setCell(x, z, opts)`. Materials in `M.*` are shared — never mutate `.color` in place. Three.js r128 pinned; do not bump. `userData.landing` guards must stay in all per-frame loops.

**Build** — `npm test` (static checks), `npm run build` (dist/), `publish.sh` copies vendor files. Deployed via Vercel + Netlify from `dist/`.

**Style** — Semicolons required, 2-space indent, single quotes. Section headers `// -------- name --------`. No clever abstractions.

---

## Features Added in Latest Sessions (2026-05-19)

- **NPC System**: `npcs[]` array, chunky 3D sticker-style characters (big head, cel-shading outlines), delta-time lerp movement, water avoidance, `N` key spawn
- **NPC Character Card**: dark glass overlay on click, procedural SVG portrait matching 3D style, stat bars (seeded from id), mood bar, relationship badges
- **NPC Relationships**: symmetric `relationships` map (`ally/enemy/neutral`), mood drift influence wired
- **NPC Roster**: `Shift+R`, left panel, 🔍 Find button pans camera + highlights NPC
- **Town Pulse**: per-NPC `mood` 0–100, random walk drift, aggregate → town pulse HUD (cyan/yellow/red), ambient lighting responds
- **Lore System**: tile lore (plain textarea, auto-save, tags), NPC lore, town lore (`T` key) — all dark glass panels with consistent styling
- **Hub UI**: left icon rail (🗺️ Map / 👥 People / 📖 Lore / ⚙️ Settings), sub-panels slide in from left, full glassmorphism design system (blur, `rgba(10,10,20,0.85)`, cyan `#00d4ff`)
- **Keyboard map** (conflict-resolved): `R`=raise, `F`=lower, `N`=NPC, `P`=tile panel, `T`=town, `Shift+R`=roster, `E`=erase, `C`=clear, `Esc`=close

---

## Open Threads

- MC Gateway connection refused — persistent, root cause unknown
- x.com/Twitter inaccessible — tweet tracker blocked across sessions
- NPC Y jitter — bounding-box fix applied but slight jitter still reported; revisit if flagged again
- Hub 🗓️ Events slot reserved, not yet implemented
- Skill hygiene: update `.codex/skills/` when new durable patterns emerge
