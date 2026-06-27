# Random Island Generation Asset Manifest

Manifest version: `2026-06-27.1`

Source: `engine/world/26-ai-generation.js`

Source digest: `sha256-b264f7982d0c6321`

Canonical path: `docs/random-island-generation-assets.md`

This is the canonical, versioned repository for the offline random island
generator's current asset vocabulary. It covers the assets and rules used by
`generateProceduralWorld()` / `generateRandomIslandWorld()`: terrain tokens, lab
object tokens, archetype weights, fence storage, economy preview buckets, motif
ownership, and lab-to-TinyWorld mapping.

Update this file in the same change whenever the generator's terrain tokens, lab
object tokens, archetype weights, economy resource buckets, motif ownership, or
lab-to-TinyWorld mapping changes. `tests/random-island-assets-manifest.test.mjs`
enforces that the manifest source digest stays aligned with the generator source
blocks.

This is not the full renderer asset catalog. It only covers assets the random
island generator currently knows about. Shipped GLB/texture/runtime assets stay
in `models/`, `textures/`, `assets/`, or `engine/world/assets/`; generated sample
and stats output stays ignored under `random-island-runs/` and
`stats-runs/random-island/`.

## Terrain Tokens

Lab terrain tokens:

```text
water, grass, prairie, path, dirt, stone, sand, cliff
```

Final TinyWorld terrain mapping:

| Lab terrain | Saved terrain |
| --- | --- |
| water | water |
| grass | grass |
| prairie | grass |
| path | path |
| dirt | dirt |
| stone | stone |
| sand | sand |
| cliff | stone |

The generator does not currently emit `lava` or `snow`.

## Lab Object Catalog

| Lab token | Allowed lab terrain | Status |
| --- | --- | --- |
| watchtower | grass, stone, cliff, path | Active corner landmark; maps to tower house. |
| house | grass, prairie, path, dirt | Active habitation / commerce token. |
| manor | grass, prairie, path, dirt | Active 2x1 estate token. |
| manor-wing | none | Hidden footprint part for manor only. |
| tree | grass, prairie, dirt | Active nature/materials/charm token. |
| garden | grass, prairie, dirt, path | Active garden token; maps to flower. |
| stone | grass, stone, cliff, dirt | Active rock/material token. |
| ore | stone, cliff | Active material token; maps to crystal. |
| well | grass, prairie, path, dirt | Dormant: defined in the lab catalog but not currently emitted or mapped. |
| fence | grass, prairie, path, dirt | Dormant standalone token: random islands should not emit fence-only cells. Fence visuals come from enclosure edge extras on occupied crop/animal cells. |
| castle | grass, stone, cliff, path | Map-supported tower token; not actively placed by the current corner pass. |
| bridge | path, grass, dirt, sand | Active land bridge token. |
| water-bridge | water | Active validated road crossing token; maps to bridge on water. |
| crop | grass, prairie, dirt | Active food token. |
| corn | grass, prairie, dirt | Active food token. |
| wheat | grass, prairie, dirt | Active food token. |
| pumpkin | grass, prairie, dirt | Active food token. |
| carrot | grass, prairie, dirt | Active food token. |
| sunflower | grass, prairie | Active food/charm token. |
| logs | grass, dirt, path | Dormant: resource bucket support exists, but no current output mapping. |
| flower | grass, prairie | Active charm token. |
| berries | grass, prairie, dirt | Active food/charm token; maps to bush. |
| cow | grass, prairie | Active food token. |
| sheep | grass, prairie | Active food/charm token. |
| lamp | path, grass | Active commerce/charm token; maps to lamp-post. |
| spotlight | path, stone, cliff | Active defense token. |
| ruins | grass, stone, cliff, dirt | Active relic/charm token. |
| crystal | stone, cliff, grass | Active materials/charm token. |
| totem | grass, prairie, stone | Active relic/charm token. |

## Lab To TinyWorld Mapping

All generated placed objects request voxel styling with
`appearance.objectStyle = "voxel"`.

| Lab token | Saved TinyWorld output |
| --- | --- |
| watchtower | `kind: "house"`, `buildingType: "tower"`, floors 2-3, inward `transform.rotationY` |
| house | `kind: "house"`, `buildingType: null`, floors 1-2 |
| manor | `kind: "house"`, `buildingType: "manor"`, floors 2-3 |
| castle | `kind: "house"`, `buildingType: "tower"`, floors 4-5, inward `transform.rotationY` |
| tree | `kind: "tree"`, floors 1-3 |
| garden | `kind: "flower"`, floors 1-3 |
| flower | `kind: "flower"`, floors 1-3 |
| stone | `kind: "rock"`, floors 1-3 |
| ore | `kind: "crystal"`, floors 2-4 |
| crystal | `kind: "crystal"`, floors 2-4 |
| fence | Legacy/manual mapping only: fence edge entries in `extras`; current random islands should not emit standalone fence tokens |
| bridge | `kind: "bridge"`, floors 1 |
| water-bridge | `kind: "bridge"`, floors 1, terrain remains water |
| crop | `kind: "crop"`, floors 1-3 |
| corn | `kind: "corn"`, floors 1-3 |
| wheat | `kind: "wheat"`, floors 1-3 |
| pumpkin | `kind: "pumpkin"`, floors 1-3 |
| carrot | `kind: "carrot"`, floors 1-3 |
| sunflower | `kind: "sunflower"`, floors 1-3 |
| berries | `kind: "bush"`, floors 1-3 |
| cow | `kind: "cow"`, floors 1 |
| sheep | `kind: "sheep"`, floors 1 |
| lamp | `kind: "lamp-post"`, floors 1 |
| spotlight | `kind: "spotlight"`, floors 1 |
| ruins | `kind: "ruins"`, floors 1-3 |
| totem | `kind: "totem"`, floors 1-3 |

Dormant or hidden tokens with no current saved output branch:

```text
manor-wing, well, logs
```

## Fence Edge Enclosures

Generated crop plots and animal pens treat fences as square-edge overlays rather
than separate prop cells. A generated crop, cow, or sheep cell may carry
`extras` entries like:

```json
{ "kind": "fence", "fenceSide": "n", "floors": 1 }
```

One cell can have 1-4 fenced sides by combining multiple fence extras. Random
generation should attach these extras to the owned crop/cow/sheep cells being
enclosed. It should not create empty, fence-only cells in open fields. Primary
`kind: "fence"` cells are legacy render/load compatibility only.

Path-facing entry points use the same fence-extra shape with
`appearance.fenceStyle: "gate"`, which renders as an open two-leaf gate with
taller posts and a red marker instead of a normal rail. The gate hinges sit on
the fenced cell border; only the open leaves swing inward.

Current enclosure conventions:

| Enclosure | Fence storage | Visual style |
| --- | --- | --- |
| Crop plot | Fence extras on crop cells | `appearance.fenceStyle: "garden"`, level 1 |
| Animal pen | Fence extras on cow/sheep cells | Wood/tall fence, level 2 |
| Gate | Fence extra facing a path cell | `appearance.fenceStyle: "gate"` open-leaf marker gate |

Crop and animal components are fenced separately. If a crop and animal touch,
the shared boundary gets a fence edge instead of becoming a gate.

## Archetype Weights

These weights are selection weights, not exact counts. Motif passes and
validation rules can also place assets directly.

```js
pastoral.terrain = { grass: 5, prairie: 5, dirt: 1, path: 1, stone: 0.5, sand: 0.7 }
pastoral.objects = { sheep: 4, cow: 3, wheat: 2, corn: 1.5, garden: 1.6, flower: 1.5, house: 1.2, tree: 1, berries: 1 }

forest.terrain = { grass: 6, prairie: 1, dirt: 2, stone: 0.8, cliff: 0.4, path: 0.4 }
forest.objects = { tree: 6, berries: 2, flower: 1.5, stone: 1, ore: 0.4, crystal: 0.4, house: 0.6, garden: 0.8 }

quarry.terrain = { stone: 5, cliff: 3, dirt: 2, grass: 1.5, path: 1, sand: 0.3 }
quarry.objects = { stone: 4, ore: 3, crystal: 1.3, watchtower: 1, ruins: 0.8, spotlight: 0.8, tree: 0.5 }

river.terrain = { grass: 3, prairie: 2, sand: 2, path: 1.2, dirt: 1, stone: 0.8 }
river.objects = { "water-bridge": 3, bridge: 1.2, cow: 1.4, crop: 2, garden: 1.3, flower: 1.5, tree: 1.2, house: 1, lamp: 0.8 }

village.terrain = { grass: 3, path: 3, prairie: 1.2, dirt: 1.4, stone: 0.8, sand: 0.4 }
village.objects = { house: 4, manor: 1.6, lamp: 2, garden: 1.8, crop: 1.5, tree: 1.2, flower: 1.2, watchtower: 0.8 }

fortress.terrain = { cliff: 3, stone: 3, path: 2, grass: 1.5, dirt: 1 }
fortress.objects = { watchtower: 4, castle: 2.5, spotlight: 2, stone: 1.5, lamp: 1, house: 0.8 }

ruins.terrain = { grass: 2.5, stone: 2.5, dirt: 2, cliff: 1, path: 0.8, prairie: 0.5 }
ruins.objects = { ruins: 4, totem: 2, crystal: 1.5, stone: 2, ore: 0.8, berries: 1.2, tree: 1, flower: 0.8 }

harbor.terrain = { sand: 3.5, grass: 2, path: 2, prairie: 1, stone: 0.8, dirt: 0.6 }
harbor.objects = { "water-bridge": 3, bridge: 1.8, house: 2, lamp: 1.6, crop: 1, garden: 1, flower: 1, tree: 0.8 }
```

## Economy Viability Bands

Every generated island runs all five resource passes. Archetype changes the
min/max target range; it does not skip a resource.

| Archetype | Food | Materials | Commerce | Defense | Charm |
| --- | --- | --- | --- | --- | --- |
| default | 2-7 | 2-7 | 1-5 | 1-5 | 2-7 |
| pastoral | 5-10 | 2-5 | 1-4 | 1-4 | 3-8 |
| forest | 2-6 | 4-9 | 1-4 | 1-4 | 5-10 |
| quarry | 2-6 | 6-11 | 1-4 | 2-6 | 2-6 |
| river | 4-9 | 2-6 | 2-6 | 1-4 | 4-9 |
| village | 3-7 | 2-6 | 4-9 | 1-5 | 3-7 |
| fortress | 2-6 | 3-8 | 1-5 | 5-10 | 2-6 |
| ruins | 2-6 | 3-8 | 1-4 | 2-6 | 5-10 |
| harbor | 3-7 | 2-6 | 4-9 | 1-5 | 4-9 |

Resource bucket membership:

| Resource | Lab tokens counted |
| --- | --- |
| food | crop, corn, wheat, pumpkin, carrot, sunflower, cow, sheep, berries |
| materials | tree, stone, ore, crystal, logs |
| commerce | house, manor, lamp, bridge, water-bridge |
| defense | watchtower, spotlight, castle |
| charm | flower, berries, tree, crystal, ruins, totem |

## Economy System Alignment

TinyWorld currently has two separate economy layers:

| Layer | Code path | Resource vocabulary | Purpose |
| --- | --- | --- | --- |
| Collectible reveal preview | `buildRandomIslandEconomyProfile()` in `engine/world/26-ai-generation.js` | Food, Materials, Commerce, Defense, Charm | Island card readability, rarity, economic potential, highlight steps |
| Live world / harvest economy | `deriveWorldState()` in `party/index.js`, `deriveResourceStats()` in `netlify/functions/lib/worlds.mjs`, `normalizeWorldResourceSpec()` in `packages/tinyworld-mmo-core/src/economy.js` | fish, ore, plants, meat | Server-authoritative harvest nodes, resource taxes, world-card readiness and pricing |
| Economy design guide | `docs/economy.md` | wood, ore, crystal, energy, fish, meat, plants, GOLD | Future-facing product vocabulary; not all resources are live yet |

The reveal stats are economic potential. They must not be treated as live
balances or automatic token yield. Live harvest output is server-derived from
saved world cells or explicit `economy` metadata.

Current default live mapping:

| Generated asset or terrain | Reveal contribution | Live economy contribution |
| --- | --- | --- |
| Connected `water` terrain | Food / Charm potential | One `fish` node per connected water body |
| `crop`, `corn`, `wheat`, `pumpkin`, `carrot`, `sunflower` | Food potential, sometimes Charm | `plants` node |
| `cow`, `sheep` | Food potential, sometimes Charm | `meat` hunt target |
| `stone` terrain | Materials / Defense potential | `ore` node per stone cell |
| Explicit object `economy` metadata | Whatever the card scoring also sees from terrain/kind | Authoritative override for `fish`, `ore`, `plants`, or `meat` |

Gaps to keep visible:

- Materials preview is broader than live resources. It counts `tree`, `stone`,
  `ore`, `crystal`, and dormant `logs`, but the live economy currently exposes
  only `ore` for material extraction unless explicit `economy.resource: "ore"`
  metadata is attached.
- `berries` map to `kind: "bush"` and count as Food / Charm in the reveal card,
  but `bush` is not a live `plants` harvest kind.
- `crystal` is a visual/materials/charm asset in the reveal card. Live harvest
  does not have a `crystal` resource yet; a crystal on non-stone terrain needs
  explicit `economy.resource: "ore"` if it should be harvestable today.
- Commerce, Defense, and Charm currently have no direct live harvest resource.
  They are collector/readability stats and future hooks for GOLD/day, upgrades,
  Battleworlds, events, pricing modifiers, or social/showcase value.
- The generator does not currently emit explicit `economy` metadata for its
  native cells. It relies on live derivation from terrain/kind. That is fine for
  water, stone, crops, and animals, but custom or non-obvious resource assets
  should use explicit metadata.
- World-card purchase pricing uses live `fish`, `ore`, `plants`, and `meat`
  readiness. It does not use reveal `potential`, rarity, Commerce, Defense, or
  Charm yet.
- The design guide names future resources such as wood, crystal, and energy.
  Those should remain design-only until the resource bank, HUD, world stats, tax
  ledger, and sell/market rules support them.

Recommended next alignment step:

Add a `liveResource` column to this manifest if any generator asset should move
from preview-only value into the live harvest economy. Prefer explicit
`economy` metadata for custom/resource-special assets instead of inferring
economic output from visual material names, colors, or model shape.

## Current Motif Ownership

| Pass | Assets it owns or places |
| --- | --- |
| Terrain composition | water, sand, prairie, dirt, stone, cliff, grass |
| Road/path carving | path |
| Economy food floor | house anchor plus crop, wheat, corn, pumpkin, carrot, sunflower, flower, fence edge extras |
| Economy materials floor | tree, berries, stone, ore, crystal |
| Economy commerce floor | lamp, house |
| Economy defense floor | spotlight |
| Economy charm floor | flower, berries, tree, crystal, totem |
| Corner tower motif | watchtower |
| Crop plot motif | crop, wheat, corn, sunflower, pumpkin, carrot, fence edge extras |
| Animal pen motif | cow, sheep, fence edge extras |
| Settlement block motif | house, manor, lamp |
| Pathside home motif | house |
| Grove motif | tree, berries, flower |
| Quarry seam motif | stone, ore, crystal |
| Relic site motif | totem, ruins, crystal |
| Water bridge validation | water-bridge |
| Residual scatter | tree, garden, stone, berries, flower, lamp, spotlight |

Notes:

- `watchtower` and `castle` both map to TinyWorld tower houses, but the current
  corner tower pass places `watchtower`.
- `castle`, `well`, and `logs` should not be removed casually. They are useful
  version markers for planned or partially ported lab semantics.
- If a new token is added to `objectDefs`, it should also get a status here:
  active, hidden, map-supported, or dormant.
