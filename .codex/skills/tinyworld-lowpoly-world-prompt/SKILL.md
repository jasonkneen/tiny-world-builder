---
name: tinyworld-lowpoly-world-prompt
description: Use when editing Tiny World Builder prompts, model-generated worlds, Auto suggestions, or any model behavior that should create coherent low-poly 3D board scenes.
---

# Tiny World Low-Poly World Prompting

The built-in model should act like a compact low-poly diorama designer, not a random tile filler.

Prompt principles:

- Generate should be text-only by default: use OpenAI `gpt-5.5` for validated
  world JSON and do not add an image-generation topology prepass unless the
  user explicitly asks for images again.
- Honour the selected generation board size. The Generate dialog can request
  any `HOME_GRID_OPTIONS` size, so prompts must include the requested
  `gridSize` and coordinate bounds instead of assuming 8x8.
- Floating chat prompts are additive patches by default. Unless the prompt
  explicitly asks to replace/reset/rebuild or starts with `/clear`, preserve the
  existing board and return only complete final-state cells that should be
  added or changed.
- Start from a readable scene concept: village, farm, canal, ridge, market, castle, garden, or mixed landmark.
- Use strong silhouettes: tall/short contrast, clustered houses, towers, hills, trees, walls, and clear negative space.
- Make terrain do composition work: paths lead the eye, water creates crossings, dirt groups crops, grass gives breathing room.
- Treat hills and mountains as elevation/height through `terrainFloors`, not
  as a field of rock objects. Rocks are sparse landmarks or boulders only.
- Use adjacency intentionally: house clusters merge, fences connect, bridges belong on water crossings, crops form fields.
- Avoid noise: do not fill every board cell; leave open cells and visible paths.
- Use `floors` as variation/intensity, including terrain stacking and object detail.
- Use forced `buildingType` only when a distinct one-cell variant is wanted; otherwise leave houses as `buildingType: null` so cluster logic can work.
- Keep output strictly machine-parseable JSON matching the schema.

Primitive assembly prompting:

- Tell models they cannot invent new object kinds, meshes, labels, or custom geometry in JSON.
- Ask them to translate broad environments into available primitives: terrain, raised terrainFloors, houses/building variants, fences/fenceSide, rocks, bridges, crops, tufts, and trees.
- Treat native primitives as scene components, not the creativity ceiling. If the user asks for a distinct object with no native kind, author it as a `customParts` voxel-build hero cell instead of reducing it to rocks, houses, or terrain.
- Include concrete decompositions for non-native requests:
  - skate park = path/dirt plaza + raised terrain ramps + rocks as obstacles + fences as rails/edges + tufts/trees as landscaping.
  - market = path plaza + cottage/manor stalls + fences as queue rails + crops/pumpkins as goods.
  - playground = path/dirt base + rocks as play forms + fences as boundary + trees/tufts for park context.
  - quarry = raised dirt/grass terraces + rocks of varied floors + path access road + sparse tufts.
- Emphasize legibility from the default isometric camera: 3–5 clear assembled features beats many scattered cells.

Voxel stamp prompting:

- For new text/image-to-voxel stamps, prefer semantic `customParts` first instead
  of raw voxel clouds. This preserves editable object structure and avoids
  low-quality broad blocks.
- Include the allowed material list, selected/source object intent, source
  parts when available, image reference when present, `allowedBounds`, and a
  quality target that calls out connected layered detail.
- For bespoke requests such as glass greenhouse, dome, vehicle, robot, or
  airship, require semantic colored parts and at least several material
  families. Native houses/fences/rocks are allowed only when they are actual
  components or surroundings, not substitutes for the requested model.
- Use `customParts` `kind: "cable"` for ropes, balloon basket lines, tethers,
  rigging, and mooring-style connections. Cable parts need `from`/`to`
  endpoints, radius, sag, and the usual compatibility `size`/`pos`/`scale`.
- Use `sphere`/`ellipsoid` custom parts for rounded envelopes, domes, tanks,
  and canopies. A hot-air balloon should have a rounded ellipsoid/sphere
  envelope with colored fabric panel bands, not a box body. Use
  `phiStart`/`phiLength` ellipsoid slices for curved balloon panels instead of
  flat rectangular plates.
- Keep first-pass generated custom models to sane board scale. Use
  `customFootprint` around 1.1-1.3 for compact props, bridges, decks, and
  docks; reserve 1.5-1.8 for clear hero objects such as balloons, airships,
  domes, and greenhouses. For bridges/decks that need to sit into water or
  terrain, prefer a small negative `transform.offsetY` instead of making the
  geometry oversized.
- Explicitly tell models not to default `customParts` to stone/rock unless the
  requested object is stone. Prefer TinyWorld material names such as `wood`,
  `brass`, `copper`, `metal`, `steel`, `glass`, `glassGreen`, `fabric`,
  `canvas`, `rope`, `cable`, and accent colors.
- Use raw `{x,y,z,color}` voxels after a seed exists and the user asks to
  reinterpret/upscale/refine density; keep returned voxels bounded and omit
  hidden interior fill.
- Do not let a reference image or prior Japanese stamp bias unrelated objects
  into pagodas, gardens, torii, sakura, or shrine motifs unless explicitly
  requested.

For Auto suggestions:

- Return candidate actions, not coordinates.
- Suggestions should be reusable across several placements.
- Include a varied ranked batch: one structural option, one terrain/path option, one nature/detail option, and one intensify/repeat option when useful.

Offline random island generation:

- `generateProceduralWorld()` is the public entry point used by the Generate
  panel and command palette, but it delegates to `generateRandomIslandWorld()`.
- The random island generator ports the `tiny-markov/island-lab` flow into
  TinyWorld schema cells: connected island mask, archetype terrain/object
  weights, water/bridge/path passes, then a deliberate token-to-native mapping.
- The current random-island terrain/object catalog, archetype weights, resource
  buckets, output mapping, motif ownership, and live-economy alignment notes are
  versioned in the canonical repository
  `docs/random-island-generation-assets.md`. Any change to those source blocks
  must update that manifest and its source digest in the same patch.
- Keep emitted cells complete v4 object cells: `x`, `z`, `terrain`, `kind`,
  `floors`, `terrainFloors`, `buildingType`, and `fenceSide`.
- Offline random islands currently emit a flat terrain surface:
  `terrainFloors: 1` for every generated cell. Keep island identity in terrain
  material, roads, water composition, object grouping, traits, and economy
  profile rather than generated height variation.
- Map lab-only tokens explicitly to real renderer support. Examples:
  watchtower/castle -> `kind:"house"` with `buildingType:"tower"`,
  manor -> `kind:"house"` with `buildingType:"manor"`, lamp -> `lamp-post`,
  berries -> `bush`, ore -> `crystal`, water-bridge -> `bridge` on water.
  Do not invent unsupported `kind` values just because the lab catalogue has
  a matching label.
- Generated random islands suppress props that have no generation economy
  effect before save output. `spotlight` is explicitly generation-suppressed
  even though legacy mapping/scoring still understands it for compatibility.
- Generated random islands may keep `lamp-post` as Commerce/Charm punctuation,
  but final output is capped at two lamps and lamps must not be adjacent.
- Generated placed objects should set `appearance.objectStyle = "voxel"` so
  the in-app test exercises the existing voxel asset factories instead of the
  standalone lab's flat preview tokens.
- Archetypes are authored through a deterministic feature-grammar pass before
  residual scatter. Preserve that meaning layer: pastoral = enclosed fields and
  pasture, forest = grove/trail, quarry = connected stone/ore seam, river =
  crossing plus irrigated bank, village = plaza/roads/house block, fortress =
  keep/wall/gate, ruins = relic cluster, harbor = shore/dock/inland path. Do
  not regress this to pure weighted random placement.
- Resource placement now starts with a pre-archetype economy viability pass:
  every generated island visits Food / Materials / Commerce / Defense / Charm
  with archetype-weighted min/max bands, so even low-food quarry/fortress-style
  islands still get a small food floor near habitation. Archetype resource
  polish runs after the identity grammar, and final validation repairs any
  displaced floors. Residual scatter is for small accents only, not the primary
  source of meaningful resources.
- Food areas should read as deliberate farm plots, not random sprinkles:
  generated crops prefer a compact square-ish region and avoid the immediate
  one-cell ring around main `house` / `manor` habitation when space allows.
  Tower houses are landmarks and do not count as the main-house food buffer.
- Towers are owned by the corner landmark pass, not by archetype scatter:
  generated `watchtower`/`castle` tokens should resolve to corner-adjacent
  `kind:"house", buildingType:"tower"` cells with the count profile
  0/1/2/3/4 = 6.25%/50%/25%/12.5%/6.25%. Tower doors are on local `+z`, so
  generated towers must emit a `transform.rotationY` that faces the door inward
  toward the island center/core.
- Terrain is also composed through motifs before paths and object placement:
  broad land terrain comes from deterministic smooth noise fields, then water
  gets one protected composition motif (edge inlet, lake, or river) plus a small
  edge-water bias instead of a moat-like fill. Stone gets ridge/seam walks,
  dirt/prairie get field/meadow patches, and sand grows from shoreline
  adjacency. Keep this motif layer ahead of archetype object grammar so terrain
  meaning supports the later props.
- Water bridges are a late validation layer, not a water decoration. Put rivers
  or lakes down first, carve/extend path roads next, then place `water-bridge`
  only when the water cell has `path` on opposite banks horizontally or
  vertically and water continues under the bridge on the perpendicular axis.
  A harbor edge/dock should use waterfront path/shore composition unless it is
  a true road crossing over a visible water channel.
- Keep generated large building variants spaced out. Lab tokens that map to
  forced TinyWorld house variants (`manor`, `watchtower`/`castle` -> tower-like
  houses) need a buffer from ordinary house clusters because their rendered
  meshes can occupy more visual footprint than one logical cell.
- The world menu's `New world` action is the in-app Tinyverse-style test path
  for the offline generator: it chooses a random archetype/seed, applies the
  generated TinyWorld state, saves it as a named local world slot, then opens
  the cinematic economy reveal. Keep economy scoring derived from the loaded
  TinyWorld cells, not from pre-mapping lab tokens, so the stats describe the
  real rendered assets.
- Economy reveal profile data comes from `buildRandomIslandEconomyProfile()`.
  It mirrors island-lab's Food / Materials / Commerce / Defense / Charm,
  gold/day, rarity, traits, synergies, and feature highlight groups, but it is
  presentation/runtime data rather than part of the saved world schema.
  Rarity is archetype-relative after normalized scoring so a strong forest or
  ruins island can be rare without needing village-level absolute commerce.
- Random-island statistical profiles should be produced with
  `npm run stats:random-island -- --samples=10000`. Each run writes a
  timestamped JSON artifact under ignored `stats-runs/random-island/` and
  refreshes `stats-runs/random-island/latest.json`.
- Random-island visual/aesthetic samples should be produced with
  `npm run sample:random-island -- --count=16`. Each run writes seeds, terrain
  glyph maps, water components, economy profile data, and full world JSON under
  ignored `random-island-runs/`.
