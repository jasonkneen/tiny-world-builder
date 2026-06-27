# Voxel Assets, Economy Tags, And Terrain Welding

This guide describes how TinyWorld sections connect to the economy, how to author new voxel-style assets, and where mesh welding / texture blending should happen.

## Economy Fit

Tinyverse Worlds is the authoritative economy surface. Published worlds enter PartyKit rooms, which derive harvest nodes from saved world cells and flush whole resources to the server bank. The browser can show GOLD/resources, but it must not mint balances.

Economy-ready sections:

- Worlds picker, room entry, harvest HUD, PartyKit world rooms, `/api/me/gold`, `/api/me/gold/spend`, `/api/me/resources/sell`.
- Builder save/publish, because published v4 cells are the source used to derive resource nodes.
- Default resource cells: water creates fish nodes, stone creates ore, crop kinds create plants, and animal kinds create meat/hunt targets.

Visual-only unless bridged:

- Mesh Terrain and LandscapeEngine surfaces. They can ground avatars and objects, but they are not authoritative economy data unless projected into cells or explicit `economy` tags.
- Model stamps, custom voxel builds, flight, race, surface-roam, CCTV, weather, camera/render settings, and lobby presentation.

Use explicit resource tags for custom assets:

```json
{
  "x": 4,
  "z": 6,
  "terrain": "grass",
  "kind": "voxel-build",
  "floors": 1,
  "terrainFloors": 1,
  "buildingType": null,
  "fenceSide": null,
  "appearance": { "voxelBuildId": "crystal_drill" },
  "economy": { "resource": "ore", "charges": 3, "label": "Crystal drill" }
}
```

Supported live resources are `fish`, `ore`, `plants`, and `meat`. Future guide resources like wood/crystal/energy stay design-only until the resource bank and HUD support them.

## Asset Authoring

Use native TinyWorld assets first:

- `customParts` for semantic low-poly primitives: boxes, cylinders, cones, spheres/ellipsoids, and cables.
- `voxel-build` for editable block stamps that should stay TinyWorld-native.
- `model-stamp` / GLB only when the source mesh is clearly better than procedural parts.

Scale and composition:

- One board cell is one world unit. Keep most props within 0.2 to 0.8 units; normal single-cell custom assets around 1.1 to 1.3; hero objects only when deliberately larger.
- Pivot at bottom-center/contact point. Apply transforms before export.
- Use 2 to 4 semantic material families plus small accents: body, trim, highlight, glass/fabric/metal as needed.
- Prefer strong silhouettes over micro-detail. Cables are real cable parts, domes/tanks/balloons are sphere or ellipsoid parts, and broad base platforms should sink slightly into terrain.

GLB hygiene:

- Apply transforms, recalculate outward normals, remove non-manifold geometry, avoid n-gons, and keep texture dimensions power-of-two.
- Name assets and LODs predictably; keep imported files under `models/` so `publish.sh` ships them.
- TinyWorld adapts PBR imports to Lambert-style lighting, so base-color maps matter more than glossy/metallic detail.

## Mesh Welding

Use the right optimization level for the context:

- Editable builder mode: keep cell intent and selectable object parts intact; use cached geometries and `InstancedMesh`.
- Published/play mode: static terrain can be welded or baked by chunk while raycasting maps hits back to cells.
- Decorative static scenery: `mergeStaticBaseMeshesByMaterial(...)` is safe only for non-pickable, non-animated, non-transparent meshes.

Mesh Terrain now greedily merges flat same-material top rectangles before emitting per-voxel exposed bevels and walls. This reduces geometry on broad flat areas while preserving the chunky edge language.

Next welding candidates:

- Greedy vertical side strips for contiguous exposed drops with identical material, top, and bottom heights.
- Chunked dirty rebuilds, such as 16x16 or 24x24 voxel chunks, so sculpt/paint edits rebuild only touched chunks.
- Published-world terrain bake that merges same-material terrain by chunk while keeping cell metadata for movement and harvesting.

## Texture Blending

Keep economy identity separate from pixels. A blended grass-to-stone visual does not make a cell half ore; the authoritative source remains terrain/kind or explicit `economy` metadata.

Preferred rendering direction:

- Use world-space UVs so terrain textures continue across cell borders.
- Pack terrain textures into a padded atlas and drive material choice/weights through attributes.
- Use splat weights for border feathering between nearby terrain types.
- Use triplanar or side-axis projection on vertical faces to avoid stretched top UVs on cliffs and block sides.

For Three.js r128, an atlas plus attributes is safer than relying on texture arrays. Any cloned material that carries `applyWorldUVs` must preserve `onBeforeCompile` and `customProgramCacheKey`.
