# Tiny World Builder

<img width="1324" height="1016" alt="Screenshot 2026-05-11 at 07 09 24" src="https://github.com/user-attachments/assets/1b19a5f7-def5-42bf-b85f-01714f502afa" />

## Run

```bash
npm run dev
# serves http://localhost:3000/tiny-world-builder
# use another port with: npm run dev -- 3001

# or open directly
open tiny-world-builder.html
```

## Deploy

The app deploys as a static site on Vercel or Netlify. Both host configs run
`./publish.sh` and serve the generated `dist/` directory. Three.js r128 and
GLTFLoader are self-hosted from `vendor/three/` so deploys do not depend on
runtime CDNs.

```bash
npm test
npm run build

# Vercel
vercel deploy

# Netlify
netlify deploy --build
# or connect the repo in Netlify; netlify.toml supplies build/publish settings
```

## Controls

| Action            | Input                                  |
| ----------------- | -------------------------------------- |
| Place             | click a cell                           |
| Erase             | `E` then click, or pick the eraser     |
| Orbit             | drag                                   |
| Zoom              | scroll wheel                           |
| Stack/enhance item | click the same object tool on an existing object (max 8) |
| Raise/lower terrain | `R` / `F` over the hovered cell      |
| Switch tool       | `1`–`9`, then letter shortcuts shown in the toolbar |
| Toggle camera     | `P` or `I` (isometric ⇄ soft ⇄ perspective) |
| Reset to preset   | reset button                           |
| Clear to grass    | `C`                                    |

## Vehicle runtime (Road AI)

You can drive runtime vehicles through the same relay/API path used by `send-command.js`.

- `vehicle-spawn --x <n> --z <n> --mode auto|manual --goalX <n> --goalZ <n>`
- `vehicle-goal --id <id> --x <n> --z <n>`
- `vehicle-controls --id <id> [--forward] [--reverse] [--left] [--right]`
- `vehicle-remove --id <id|all>`
- `vehicle-clear`

Vehicles only move on `path` cells (or bridge cells used as road bridges). If no path exists between goal and start, the car idles.

## Tools

`Grass` · `Path` · `Dirt` · `Water` · `Stone` · `Lava` · `Sand` · `Snow` ·
`House` · `Tree` · `Fence` · `Rock` · `Bridge` · `Crop` · `Corn` · `Wheat` ·
`Pumpkin` · `Carrot` · `Sunflower` · `Tuft` · `Flower` · `Bush` · `Cow` ·
`Sheep` · `Erase`.

Terrain/object rules are normalized by the renderer: crops force dirt
underneath, bridges force water, and ordinary objects do not float on water.
Paths, shorelines, water foam, bridges, fences, castle walls, houses, and
rocks are adjacency-aware — placing a neighbor re-renders surrounding cells
so roads join, rivers get banks, bridge direction updates, fence walls connect,
house clusters form L/T/+/square buildings, and rock cells grow into craggy
outcrops.

## Architecture

Single `<script>` block, currently ~16k lines of vanilla JS, organised by section
comments (`// -------- xyz --------`). The model is split cleanly:

- **`world[x][z]`** — intent: `{ terrain, kind, floors }` per cell.
- **`cellMeshes['x,z']`** — rendered Three.js groups for each cell.
- **`setCell(x, z, opts)`** — single mutation entry point. Updates `world`,
  rebuilds the cell's tile/object meshes, and re-renders any neighbors that
  care about adjacency (fence/house clusters).

House clusters use BFS (`bfsHouseCluster`) plus `tryComposite` (L/T/+) and
`trySquare` to decide whether a group of house cells should render as a
unified structure or stretched rectangles.

A shared `dropAnims` queue ease-outs new tiles/objects into place. Other
per-frame animations (tree sway, crop bob, smoke origin) check
`obj.userData.landing` so they yield while a piece is still falling in.

Newer systems are still routed through that same contract:

- **Preview boards** lazily generate surrounding boards as the camera pans; preview distance/window/opacity settings auto-scale from board size but remain user-adjustable.
- **AI generation / Auto** validate sparse v4 worlds against the embedded schema.
- **Local world slots** keep multiple named saves in browser storage.
- **Weather, time, clouds, and crop duster** are decorative scene systems layered on the same renderer.
- **Command palette** indexes tools, views, settings, and terrain raise/lower actions.

## Validation

```bash
npm test        # syntax, schema parity, local assets, static smoke checks
npm run build   # publish checks + dist generation
```

Manual browser smoke checklist after visual changes: page loads with no console
errors; place/erase works; `C`, `P`/`I`, `R`/`F`, and tool shortcuts respond;
fence neighbors update; cloud shadow at 0% still leaves visible clouds.

See [AGENTS.md](./AGENTS.md) for guidance on extending the codebase.

## Files

```
tiny-world-builder.html          the app
README.md                        this file
AGENTS.md                        guidance for AI coding agents
world.schema.json                import/export schema mirrored into the app
tools/check.js                   static syntax/schema/asset check
tools/smoke-static.js            no-browser smoke guard for key app contracts
vendor/three/                    self-hosted Three.js r128 runtime files
```
