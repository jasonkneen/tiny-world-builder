  // -------- AI generation --------
  // Prompts an LLM for a world description matching WORLD_SCHEMA, validates
  // the response, and feeds it through applyState. API keys live in
  // localStorage under tinyworld:ai:* — never sent anywhere except the chosen
  // provider. Three providers supported out of the box.
  const AI_DEFAULTS = {
    // Suggestions only. The input remains free text so users can type any
    // provider-side model that their key has access to.
    openai: {
      model: 'gpt-5.5',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      models: [
        'gpt-5.5', 'chat-latest',
        'gpt-5.2', 'gpt-5.2-chat-latest',
      ],
    },
    anthropic: {
      model: 'claude-opus-4-7',
      endpoint: 'https://api.anthropic.com/v1/messages',
      models: [
        'claude-opus-4-7',
        'claude-sonnet-4-6',
        'claude-opus-4-1-20250805',
        'claude-sonnet-4-20250514',
      ],
    },
    xai: {
      model: 'grok-4.3-latest',
      endpoint: 'https://api.x.ai/v1/chat/completions',
      models: [
        'grok-4.3-latest', 'grok-4.3',
        'grok-4.20-reasoning', 'grok-4.20',
      ],
    },
    gemini: {
      model: 'gemini-3.5-flash',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      models: [
        'gemini-3.5-flash',
        'gemini-3.1-pro',
        'gemini-3.1-flash-lite',
        'gemini-2.5-pro',
        'gemini-2.5-flash',
      ],
    },
  };
  const AI_LS = {
    provider: 'tinyworld:ai:provider',
    model:    p => 'tinyworld:ai:model:' + p,
    key:      p => 'tinyworld:ai:key:' + p,
    prompt:   'tinyworld:ai:prompt',
  };
  let openGenerateModal = null;

  function isImageOnlyModel(model) {
    return /^gpt-image(?:-|$)/i.test(String(model || '').trim());
  }

  function textModelForGeneration(provider, model) {
    const def = AI_DEFAULTS[provider] || AI_DEFAULTS.openai;
    return isImageOnlyModel(model) ? def.model : (model || def.model);
  }

  function imageDataUrlParts(dataUrl) {
    const match = String(dataUrl || '').match(/^data:([^;,]+);base64,(.+)$/);
    if (!match) return null;
    return {
      mimeType: match[1],
      base64: match[2],
    };
  }

  const AUTO_ACTION_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['terrain', 'kind', 'floors', 'buildingType'],
    properties: {
      terrain: {
        type: 'string',
        enum: ['grass', 'path', 'dirt', 'water', 'stone', 'lava', 'sand', 'snow'],
      },
      kind: {
        type: ['string', 'null'],
        enum: [null, 'house', 'tree', 'fence', 'rock', 'bridge', 'crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower', 'tuft', 'flower', 'bush', 'cow', 'sheep', 'lamp-post', 'spotlight'],
      },
      floors: {
        type: 'integer',
        minimum: 1,
        maximum: 8,
      },
      buildingType: {
        type: ['string', 'null'],
        enum: [null, 'cottage', 'manor', 'tower', 'skyscraper'],
      },
    },
  };
  const AUTO_SUGGESTIONS_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['suggestions'],
    properties: {
      suggestions: {
        type: 'array',
        minItems: 1,
        maxItems: AUTO_BATCH_SIZE,
        items: AUTO_ACTION_SCHEMA,
      },
    },
  };

  function snapshotCells() {
    const cells = [];
    for (let x = 0; x < GRID; x++) {
      if (!world[x]) continue;
      for (let z = 0; z < GRID; z++) {
        const c = world[x][z];
        if (c) {
          const entry = serializeCell(x, z, c);
          if (entry) cells.push(entry);
        }
      }
    }
    // Also save any cells outside the 8x8 home board
    for (let x = -GRID; x < GRID * 2; x++) {
      if (x >= 0 && x < GRID) continue; // already saved above
      if (!world[x]) continue;
      for (let z = -GRID; z < GRID * 2; z++) {
        const c = world[x][z];
        if (c) {
          const entry = serializeCell(x, z, c);
          if (entry) cells.push(entry);
        }
      }
    }
    return cells;
  }

  const PRIMITIVE_ASSEMBLY_PROMPT = [
    'Scene composition rules:',
    '- Compose the scene from the available Tiny World primitives when they are semantically right for the request: terrain cells, raised terrainFloors, houses/buildingType variants, trees, fences/fenceSide, rocks, bridges, crop kinds, and tufts.',
    '- Native primitives are scene components, not a ceiling. If the user asks for a distinct object with no native kind, author it directly as customParts instead of reducing it to rocks, houses, or terrain.',
    '- This is a real low-poly voxel builder, not a fixed clip-art set. Create bespoke hero/landmark models such as windmills, statues, spaceships, fountains, vehicles, robots, lighthouses, ships, glass greenhouses, domes, airships, market stalls, and signs with customParts.',
    '- Translate broad environments into readable low-poly tile assemblies. Example: skate park = path/dirt plaza + raised terrain ramps + rocks as boulders/ramps + fences as rails/edges + tufts/trees as landscaping.',
    '- Use terrain as the base primitive: grass=open space, path=paved/concrete, dirt=earth/fields, water=canals/ponds. Use terrainFloors for platforms, terraces, steps, banks, ramps, plinths, hills, mountains, and cliffs.',
    '- Use fences as line primitives: rails, walls, borders, pens, queue barriers, garden edging, pier rails, road gates, and castle-wall components. Set fenceSide deliberately.',
    '- Use rocks as sparse sculptural props only: boulders, monuments, rubble, stepping stones, and focal landmarks. Do not use rock props to represent broad hills or mountains.',
    '- Use houses and variants as massing primitives: cottages for small buildings, manors for civic buildings, towers/turrets for vertical landmarks, high-rise for modern tall structures. Adjacent null-buildingType houses assemble into larger footprints.',
    '- Buildings must sit directly on flat grass or dirt. Do not put houses on path, water, lava, raised terrain, decks, bridges, platforms, posts, or stilts.',
    '- Use crops/tufts/trees as texture primitives: fields, hedges, gardens, park planting, wild edges, orchards, and scale cues.',
    '- Prefer 3–5 clear assembled features over scattering many single unrelated cells. Make the construction legible from the default isometric camera.',
  ].join('\n');

  function customPartMaterialPrompt() {
    const fallback = [
      'wood', 'woodDark', 'woodLight', 'stone', 'stoneDark', 'metal', 'steel',
      'silver', 'brass', 'brassDark', 'copper', 'bronze', 'glass', 'glassBlue',
      'glassGreen', 'fabric', 'canvas', 'fabricRed', 'fabricOrange',
      'fabricYellow', 'fabricBlue', 'fabricPurple', 'fabricGreen', 'leather',
      'red', 'orange', 'yellow', 'blue', 'teal', 'purple', 'green', 'white',
      'cream', 'black', 'charcoal',
    ];
    const names = (typeof VOXEL_PART_COLORS !== 'undefined' && VOXEL_PART_COLORS)
      ? Object.keys(VOXEL_PART_COLORS).sort()
      : fallback;
    return [
      'customParts material palette: use exact material names from this list when possible: ' + names.join(', ') + '.',
      'Use semantic local color: brass/copper/bronze/metal/steel/silver for machinery and frames; glass/glassBlue/glassGreen for windows, greenhouses, and domes; fabric/canvas/fabricRed/fabricOrange/fabricYellow/fabricBlue/fabricPurple/fabricGreen for balloons, awnings, sails, and patchwork; wood/woodDark/woodLight/leather for hulls, decks, crates, ropes, ladders, and trim.',
      'Do not default customParts to stone or rock unless the requested object is actually stone. Use at least 3 distinct material families for complex bespoke objects.',
    ].join('\n');
  }

  function buildSystemPrompt(gridSize) {
    const size = coerceGridSize(gridSize, GRID);
    const maxCoord = size - 1;
    return [
      'You are a creative level designer and low-poly voxel model builder for the Tiny World Builder, a ' + size + 'x' + size + ' isometric voxel scene. You build ambitious scenes from native primitives and can create bespoke custom 3D voxel models directly in JSON.',
      'Output a JSON object that strictly matches the provided JSON Schema. Do not include prose, markdown fences, or explanations — only the JSON object.',
      'Required home board edge length: include "gridSize": ' + size + ' in the JSON object.',
      'Grid coordinates: x in 0..' + maxCoord + ' (left-right), z in 0..' + maxCoord + ' (front-back). Default cell is grass with no object.',
      'Only emit cells that differ from defaults — the renderer fills the rest.',
      'Houses cluster automatically when buildingType is null: adjacent houses merge into linear, L/T/+, or 2x2 forms. To force a single-cell variant set buildingType to cottage|manor|tower|skyscraper.',
      'Buildings must sit directly on flat grass or dirt. Do not put houses on path, water, lava, raised terrain, decks, bridges, platforms, posts, or stilts.',
      'Repeat-tapping the same object increases floors/intensity: houses grow upward; trees, rocks, bridges, fences, tufts, and crops become larger, denser, or more detailed.',
      'A fence is an edge overlay, not a full square. Set the primary fenceSide to n|s|e|w for one fenced edge, or add fence entries to extras when a square needs 2-4 fenced sides. center-x|center-z remain available for centre-line walls.',
      'Fences placed on two perpendicular sides of a house can promote it to a castle turret and turn connected fence cells into stone wall — use this for castles.',
      'Think like a low-poly diorama designer, not a random tile filler: start from a readable scene concept, use strong silhouettes, and leave negative space.',
      'Use low-poly worldbuilding cues: readable silhouettes, a few landmark cells, modular clusters, paths that lead the eye, and color-blocked terrain.',
      'Terrain should compose the scene: paths lead the eye, water creates crossings, dirt groups crops, grass creates breathing room, and raised terrain can imply mesas or Monument Valley-style landforms.',
      'Hills and mountains are raised terrain: use terrainFloors on mostly bare terrain cells. Do not cover mountain or hill regions with rock objects.',
      'Rock is a scenic landmark prop. Bridge may sit on water and auto-orients toward nearby path or land; other water cells should not host any kind.',
      'Crops (crop, corn, wheat, pumpkin, carrot, sunflower) imply terrain=dirt; the renderer enforces that, but you may set terrain explicitly.',
      'Trees and tufts read best on grass. Rocks work as edges, overlooks, or focal points.',
      'Use floors/intensity deliberately: terrain stacks into height, repeated objects gain size/detail, and fences vary from wood to wire/stone/steel wall styles.',
      'Avoid noise and full-grid filling. Aim for a coherent, readable scene — vary heights, leave breathing room, group related elements.',
      PRIMITIVE_ASSEMBLY_PROMPT,
      'Custom 3D objects: for a hero/landmark thing with no native kind, author it directly by setting kind:"voxel-build", floors:1, buildingType:null, fenceSide:null, a short "customName", optional "customFootprint", and "customParts" on that cell — an array of low-poly primitives ({kind:box|cylinder|cone|sphere|ellipsoid|cable, material color name, size [x,y,z], pos [x,y,z] in voxel units centered on the tile, optional scale}). Use sphere/ellipsoid for rounded envelopes, domes, tanks, and canopies. Sphere/ellipsoid parts may use phiStart/phiLength/thetaStart/thetaLength for curved slices. Use cable parts with from/to endpoints, radius, sag, and segments for ropes, tethers, rigging, or mooring-style connections. That cell then renders as your unique object. Build it from connected semantic parts, keep normal props around a 1.1-1.3 tile footprint, and use 1.5-1.8 only for deliberately larger hero objects. Use native houses, fences, rocks, bridges, trees, or crops only when those things are genuinely needed as components or surroundings.',
      'For custom bridges, platforms, decks, and docks, prefer compact customFootprint around 1.1-1.2 and use transform.offsetY around -0.08 when the deck should sit into the terrain/water rather than float high above it.',
      'Custom object examples: glass greenhouse = glassGreen/glass panels + metal/steel frame ribs + dirt/green planting beds; dome = glass/glassBlue ellipsoid/sphere shell parts + metal ribs + base ring; hot-air balloon = large rounded ellipsoid fabric envelope + curved ellipsoid colored panel slices using phiStart/phiLength, not square side plates + smaller wood basket + cable rigging from basket corners to envelope; steampunk airship = wood hull + brass/copper propellers + fabric patchwork ellipsoid balloon + cable rigging/ladders/railings + glass bridge.',
      customPartMaterialPrompt(),
      'Do NOT approximate requested bespoke objects as a pile of rocks, generic stone, or stock buildings. If the request names a specific model/object and the native tools do not already have it, make the customParts model.',
      'Use a neutral/global low-poly style — do NOT default to Japanese (pagoda/torii/sakura/machiya) or any single regional theme unless the user explicitly asks. Use customParts for a few standout objects; keep ordinary scenery as native primitives.',
      '',
      'JSON Schema:',
      JSON.stringify(WORLD_SCHEMA, null, 2),
    ].join('\n');
  }

  function buildAutoSystemPrompt() {
    return [
      'You are the Auto palette tool for Tiny World Builder, an 8x8 isometric voxel scene.',
      'Read the current home-board JSON and produce a ranked batch of candidate tile actions the player may place next.',
      'Do not choose coordinates and do not replace the whole world. The player will still choose the clicked tile locally.',
      'Base the suggestions on the current sparse world state, nearby patterns, and what would be coherent next manual placements.',
      'Act as a low-poly primitive assembler: suggest reusable primitive actions that help the player build larger requested forms from terrain, height, fences, rocks, buildings, crops, tufts, trees, and bridges.',
      'Prefer extending visible structures: paths continue, fences align as side/leaf wall runs, crops form fields, houses cluster, trees/rocks frame empty edges, bridges belong on water crossings.',
      'Use floors/intensity as variation: repeated fences can become taller wood, wire, stone wall, or steel wall; repeated rocks, trees, bridges, crops, and tufts gain size/detail.',
      'Return varied suggestions, ordered best first: include structural options, terrain/path options, nature/detail options, and intensify/repeat options when useful.',
      'Suggestions must be reusable across several placements, so avoid relying on a single exact coordinate.',
      'If the player asks for a thing with no native kind (skate park, playground, market, airport, quarry, garden, plaza), build it ambitiously from the closest existing primitive actions — do not refuse. Landmark objects can later be turned into bespoke custom 3D voxel models via the object AI, so suggest strong hero objects worth customizing.',
      'Return a JSON object that strictly matches the schema. Do not include prose, markdown fences, or explanations.',
      '',
      'JSON Schema:',
      JSON.stringify(AUTO_SUGGESTIONS_SCHEMA, null, 2),
    ].join('\n');
  }

  function getAIProviderState() {
    const storedProvider = localStorage.getItem(AI_LS.provider) || 'openai';
    const provider = AI_DEFAULTS[storedProvider] ? storedProvider : 'openai';
    const def = AI_DEFAULTS[provider];
    const models = def.models || [def.model];
    const storedModel = localStorage.getItem(AI_LS.model(provider));
    const model = isImageOnlyModel(storedModel)
      ? def.model
      : (models.includes(storedModel) ? storedModel : def.model);
    return {
      provider,
      model,
      key: localStorage.getItem(AI_LS.key(provider)) || '',
    };
  }

  function buildAutoUserPrompt() {
    return JSON.stringify({
      world: {
        v: STORAGE_VERSION,
        cells: snapshotCells(),
      },
      batchSize: AUTO_BATCH_SIZE,
      refreshPolicy: 'The browser will reuse these suggestions locally for several Auto placements before asking again.',
      availableTools: TOOLS.filter(t => !t.auto).map(t => ({
        id: t.id,
        terrain: t.terrain || null,
        kind: t.kind || null,
        erase: !!t.erase,
        terrainOverride: t.terrainOverride || null,
        variants: t.variants ? t.variants.map(v => ({
          id: v.id,
          buildingType: v.buildingType || null,
          fenceSide: v.fenceSide || null,
        })) : null,
      })),
    }, null, 2);
  }

  function floatingAgentIntent(text) {
    const raw = String(text || '').trim();
    if (/^\/clear\b/i.test(raw)) {
      return {
        mode: 'replace',
        clearFirst: true,
        prompt: raw.replace(/^\/clear\b\s*/i, '').trim(),
      };
    }
    const replaceRequested =
      /\b(replace|rebuild|redesign|reset|wipe)\b/i.test(raw) ||
      /\b(start over|from scratch|new world|new map|new board|full world|entire board)\b/i.test(raw) ||
      /\bclear (?:the )?(world|board|map)\b/i.test(raw);
    return {
      mode: replaceRequested ? 'replace' : 'add',
      clearFirst: false,
      prompt: raw,
    };
  }

  function buildFloatingAdditionPrompt(userPrompt) {
    const maxCoord = GRID - 1;
    return [
      'Mode: ADDITION PATCH.',
      'Treat the user request as an addition to the existing Tiny World. Do not replace, reset, clear, or redesign the world.',
      'Return a JSON object matching the schema with "gridSize": ' + GRID + ' and only the cells that should be added or changed.',
      'Do not emit unchanged existing cells. The app will merge your emitted cells into the current board and preserve every cell not mentioned.',
      'Every emitted cell must be the complete final state for that coordinate: x, z, terrain, kind, floors, terrainFloors, buildingType, fenceSide, and extras if needed.',
      'Choose empty or compatible nearby cells unless selected-cell context is provided, in which case only change cells needed for that selected scope.',
      'Coordinate bounds for emitted cells: x in 0..' + maxCoord + ', z in 0..' + maxCoord + '.',
      'Current world JSON:',
      JSON.stringify({
        v: STORAGE_VERSION,
        gridSize: GRID,
        cells: snapshotCells(),
      }, null, 2),
      '',
      'User request:',
      userPrompt,
    ].join('\n');
  }

  function normalizeWorldCells(data) {
    if (!data || !Array.isArray(data.cells)) return data;
    const byCoord = new Map();
    const order = [];
    for (const cell of data.cells) {
      let x, z;
      if (Array.isArray(cell)) [x, z] = cell;
      else if (cell && typeof cell === 'object') ({ x, z } = cell);
      const key = x + ',' + z;
      if (!Number.isInteger(x) || !Number.isInteger(z)) {
        const invalidKey = Symbol('invalid');
        order.push(invalidKey);
        byCoord.set(invalidKey, cell);
        continue;
      }
      if (!byCoord.has(key)) order.push(key);
      byCoord.set(key, cell);
    }
    if (byCoord.size === data.cells.length) return data;
    data.cells = order.map(key => byCoord.get(key));
    console.warn('[world] coalesced duplicate cells; last value wins');
    return data;
  }

  // Lightweight runtime validator. Not a full JSON-schema implementation —
  // checks the parts we care about: shape, enums, ranges. Returns null on
  // success or an error string.
  function validateWorld(data) {
    if (!data || typeof data !== 'object') return 'not an object';
    // Coerce v: accept missing (assume current), strings ('2'), and numbers.
    // We only need to reject obviously incompatible versions.
    if (data.v === undefined || data.v === null) data.v = STORAGE_VERSION;
    if (typeof data.v === 'string') data.v = parseInt(data.v, 10);
    if (data.v !== 1 && data.v !== 2 && data.v !== 3 && data.v !== 4) return 'unsupported v: ' + data.v;
    if (!Array.isArray(data.cells)) return 'cells must be an array';
    if (data.islands !== undefined && !Array.isArray(data.islands)) return 'islands must be an array';
    if (data.moorings !== undefined && !Array.isArray(data.moorings)) return 'moorings must be an array';
    if (data.cameraMode === 'soft') data.cameraMode = 'perspective';
    const okCameraMode = new Set(['ortho','topdown','perspective','tp','fp']);
    if (data.cameraMode !== undefined && !okCameraMode.has(data.cameraMode)) return 'cameraMode invalid: ' + data.cameraMode;
    if (data.gridSize !== undefined && !isValidGridSize(data.gridSize)) return 'gridSize invalid: ' + data.gridSize;
    if (Array.isArray(data.islands)) {
      const islandBoards = new Set();
      for (let i = 0; i < data.islands.length; i++) {
        const island = data.islands[i];
        if (!island || typeof island !== 'object') return 'islands[' + i + '] not object';
        if (!Number.isInteger(island.boardX) || !Number.isInteger(island.boardZ)) return 'islands[' + i + '] board invalid';
        if (Math.abs(island.boardX) > 1024 || Math.abs(island.boardZ) > 1024) return 'islands[' + i + '] board out of range';
        const key = island.boardX + ',' + island.boardZ;
        if (islandBoards.has(key)) return 'duplicate island board at ' + key;
        islandBoards.add(key);
        if (island.engines !== undefined) {
          if (!Array.isArray(island.engines)) return 'islands[' + i + '] engines invalid';
          if (island.engines.length > 8) return 'islands[' + i + '] too many engines';
          for (let j = 0; j < island.engines.length; j++) {
            const engine = island.engines[j];
            if (!engine || typeof engine !== 'object') return 'islands[' + i + '].engines[' + j + '] not object';
            if (engine.type !== undefined && !EDITABLE_ISLAND_ENGINE_TYPES.has(String(engine.type))) return 'islands[' + i + '].engines[' + j + '] type invalid';
            if (engine.slot !== undefined && (!Number.isInteger(engine.slot) || engine.slot < 0 || engine.slot > 7)) return 'islands[' + i + '].engines[' + j + '] slot invalid';
            if (engine.level !== undefined && (!Number.isInteger(engine.level) || engine.level < 1 || engine.level > 3)) return 'islands[' + i + '].engines[' + j + '] level invalid';
          }
        }
      }
    }
    if (Array.isArray(data.moorings)) {
      if (data.moorings.length > MOORING_CABLE_MAX) return 'too many moorings';
      function validMooringAnchorShape(anchor) {
        if (!anchor || typeof anchor !== 'object') return false;
        if (anchor.scope !== 'home' && anchor.scope !== 'island') return false;
        if (anchor.scope === 'island' && typeof anchor.islandId !== 'string') return false;
        const local = anchor.local;
        if (!local || typeof local !== 'object') return false;
        return ['x', 'y', 'z'].every(k => Number.isFinite(Number(local[k])) && Math.abs(Number(local[k])) < 2048);
      }
      for (let i = 0; i < data.moorings.length; i++) {
        const cable = data.moorings[i];
        if (!cable || typeof cable !== 'object') return 'moorings[' + i + '] not object';
        if (cable.id !== undefined && typeof cable.id !== 'string') return 'moorings[' + i + '] id invalid';
        if (!validMooringAnchorShape(cable.a) || !validMooringAnchorShape(cable.b)) return 'moorings[' + i + '] anchors invalid';
      }
    }
    // Optional landscape-engine fields (lifted from fork yuxiaoli@cfa5165; biome/
    // style sets mirror PLANET_LANDSCAPE_BIOMES/STYLES in 27-landscape-engine.js).
    if (data.useLandscapeEngine !== undefined && typeof data.useLandscapeEngine !== 'boolean') return 'useLandscapeEngine must be a boolean';
    if (data.landscapeMeshMode !== undefined && typeof data.landscapeMeshMode !== 'boolean') return 'landscapeMeshMode must be a boolean';
    if (data.landscapeMeshBiome !== undefined && !['grassland','desert','snow'].includes(data.landscapeMeshBiome)) return 'landscapeMeshBiome invalid: ' + data.landscapeMeshBiome;
    if (data.landscapeMeshStyle !== undefined && !['lowpoly','realistic'].includes(data.landscapeMeshStyle)) return 'landscapeMeshStyle invalid: ' + data.landscapeMeshStyle;
    if (data.landscapeEngineSeed !== undefined && typeof data.landscapeEngineSeed !== 'number' && typeof data.landscapeEngineSeed !== 'string' && data.landscapeEngineSeed !== null) return 'landscapeEngineSeed invalid';
    if (data.landscapeEngineBiome !== undefined && !['grassland','desert','snow',null].includes(data.landscapeEngineBiome)) return 'landscapeEngineBiome invalid: ' + data.landscapeEngineBiome;
    if (data.planetLandscape !== undefined && data.planetLandscape !== null) {
      if (typeof data.planetLandscape !== 'object') return 'planetLandscape invalid';
      if (data.planetLandscape.enabled !== undefined && typeof data.planetLandscape.enabled !== 'boolean') return 'planetLandscape.enabled invalid';
      if (data.planetLandscape.seed !== undefined && typeof data.planetLandscape.seed !== 'number' && typeof data.planetLandscape.seed !== 'string') return 'planetLandscape.seed invalid';
      if (data.planetLandscape.biome !== undefined && !['grassland','desert','snow'].includes(data.planetLandscape.biome)) return 'planetLandscape.biome invalid';
      if (data.planetLandscape.styleMode !== undefined && !['lowpoly','realistic'].includes(data.planetLandscape.styleMode)) return 'planetLandscape.styleMode invalid';
      if (data.planetLandscape.drop !== undefined && (typeof data.planetLandscape.drop !== 'number' || data.planetLandscape.drop < 20 || data.planetLandscape.drop > 300)) return 'planetLandscape.drop invalid';
    }
    const okTerrain = new Set(['grass','path','dirt','water','stone','lava','sand','snow']);
    const okKind = new Set([null,'house','tree','fence','rock','bridge','crop','corn','wheat','pumpkin','carrot','sunflower','tuft','flower','bush','cow','sheep','lamp-post','spotlight','chimney','ripple','shrub','stone','pebble','bridge-rail','voxel-build','model-stamp','blank-island','stargate','crystal','relic','totem','ruins','artifact']);
    const okBT = new Set([null,'cottage','manor','tower','turret','skyscraper']);
    const okFenceSide = new Set([null,'n','s','e','w','center-x','center-z']);
    const seen = new Set();
    for (let i = 0; i < data.cells.length; i++) {
      const c = data.cells[i];
      let x, z, terrain, kind, floors, buildingType, terrainFloors, fenceSide, extras, transform, appearance;
      if (Array.isArray(c)) {
        if (c.length < 3) return 'cells[' + i + '] tuple too short';
        [x, z, terrain, kind, floors, buildingType, terrainFloors, fenceSide, extras, transform, appearance] = c;
      } else if (c && typeof c === 'object') {
        ({ x, z, terrain, kind, floors, buildingType, terrainFloors, fenceSide, extras, transform, appearance } = c);
      } else {
        return 'cells[' + i + '] not object';
      }
      const coordLimit = 1024;
      if (!Number.isInteger(x) || x < -coordLimit || x > coordLimit) return 'cells[' + i + '].x out of range';
      if (!Number.isInteger(z) || z < -coordLimit || z > coordLimit) return 'cells[' + i + '].z out of range';
      const key = x + ',' + z;
      if (seen.has(key)) return 'duplicate cell at ' + key;
      seen.add(key);
      if (!okTerrain.has(terrain)) return 'cells[' + i + '].terrain invalid: ' + terrain;
      const k = (kind === undefined ? null : kind);
      if (!okKind.has(k)) return 'cells[' + i + '].kind invalid: ' + kind;
      const f = floors === undefined ? 1 : floors;
      if (!Number.isInteger(f) || f < 1 || f > 8) return 'cells[' + i + '].floors out of range';
      const tf = terrainFloors === undefined ? 1 : terrainFloors;
      if (!Number.isInteger(tf) || tf < 1 || tf > 8) return 'cells[' + i + '].terrainFloors out of range';
      const bt = k === 'house' ? (buildingType === undefined ? null : buildingType) : null;
      if (!okBT.has(bt)) return 'cells[' + i + '].buildingType invalid: ' + buildingType;
      const fs = fenceSide === undefined ? null : fenceSide;
      if (!okFenceSide.has(fs)) return 'cells[' + i + '].fenceSide invalid: ' + fenceSide;
      if (fs && k !== 'fence') return 'cells[' + i + '].fenceSide only allowed on fence';
      // extras/transform match the loader's accepted shapes in 29-persistence-api.js
      // (extras filtered to fence/tuft; transform = [rotationY,offsetX,offsetZ,offsetY?]
      // or {rotationY,offsetX,...}). Lifted from fork yuxiaoli@cfa5165.
      if (extras !== undefined && extras !== null) {
        if (!Array.isArray(extras)) return 'cells[' + i + '].extras must be an array';
        for (const extra of extras) {
          if (!extra || typeof extra !== 'object') return 'cells[' + i + '].extras item not object';
          const extraKind = extra.kind || extra.k;
          if (extraKind !== undefined && !['fence','tuft'].includes(extraKind)) return 'cells[' + i + '].extras item kind invalid: ' + extraKind;
        }
      }
      if (transform !== undefined && transform !== null) {
        if (Array.isArray(transform)) {
          if (transform.length < 3 || transform.length > 4) return 'cells[' + i + '].transform array invalid length';
          if (!transform.every(n => typeof n === 'number' && Number.isFinite(n))) return 'cells[' + i + '].transform array items must be finite numbers';
        } else if (typeof transform === 'object') {
          if (transform.rotationY !== undefined && typeof transform.rotationY !== 'number') return 'cells[' + i + '].transform.rotationY invalid';
          if (transform.offsetX !== undefined && typeof transform.offsetX !== 'number') return 'cells[' + i + '].transform.offsetX invalid';
          if (transform.offsetZ !== undefined && typeof transform.offsetZ !== 'number') return 'cells[' + i + '].transform.offsetZ invalid';
          if (transform.offsetY !== undefined && typeof transform.offsetY !== 'number') return 'cells[' + i + '].transform.offsetY invalid';
        } else {
          return 'cells[' + i + '].transform invalid type';
        }
      }
      if (appearance !== undefined && appearance !== null && !normalizeAppearance(appearance)) return 'cells[' + i + '].appearance invalid';
    }
    return null;
  }

  // Strip markdown fences, leading prose, etc. before JSON.parse.
  function extractJSON(text) {
    if (typeof text !== 'string') return null;
    let s = text.trim();
    // Strip ```json ... ``` fences if present
    const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```\s*$/);
    if (fence) s = fence[1].trim();
    // Find the first { and last } (the response should be a JSON object)
    const first = s.indexOf('{');
    const last  = s.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) return null;
    try { return JSON.parse(s.slice(first, last + 1)); } catch (_) { return null; }
  }

  async function callOpenAI(endpoint, key, model, system, user, opts = {}) {
    const isOpenAI = /api\.openai\.com/.test(endpoint);
    const imageData = opts && opts.imageDataUrl ? String(opts.imageDataUrl) : '';
    const userContent = imageData
      ? [
          { type: 'text', text: user },
          { type: 'image_url', image_url: { url: imageData } },
        ]
      : user;
    const body = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: userContent },
      ],
      response_format: { type: 'json_object' },
    };
    // OpenAI's newer GPT models can reject legacy/non-default generation
    // controls. Keep the OpenAI payload minimal and use the newer completion
    // cap; xAI keeps the older chat-completions controls.
    if (isOpenAI) {
      body.max_completion_tokens = 8000;
    } else {
      body.temperature = 0.6;
      body.max_tokens = 8000;
    }
    const _timeoutSig = aiFetchTimeoutSignal();
    let _fetchSig;
    if (opts && opts.signal && _timeoutSig) {
      try { _fetchSig = AbortSignal.any([opts.signal, _timeoutSig]); } catch (_) { _fetchSig = opts.signal; }
    } else {
      _fetchSig = (opts && opts.signal) || _timeoutSig;
    }
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + key,
      },
      body: JSON.stringify(body),
      signal: _fetchSig,
    });
    if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const j = await r.json();
    const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    return text;
  }

  // Hang guard for LLM calls: generous (worlds can take a while to generate)
  // but bounded, so a stalled connection surfaces as an error instead of a
  // spinner that never resolves.
  function aiFetchTimeoutSignal() {
    try { return AbortSignal.timeout(120000); } catch (_) { return undefined; }
  }

  async function callAnthropic(endpoint, key, model, system, user, toolSpec, opts = {}) {
    // Tool-use forces the model to emit JSON matching our schema.
    const toolName = (toolSpec && toolSpec.name) || 'emit_world';
    const image = imageDataUrlParts(opts && opts.imageDataUrl);
    const content = image
      ? [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: image.mimeType,
              data: image.base64,
            },
          },
          { type: 'text', text: user },
        ]
      : user;
    const _anthropicTimeoutSig = aiFetchTimeoutSignal();
    let _anthropicFetchSig;
    if (opts && opts.signal && _anthropicTimeoutSig) {
      try { _anthropicFetchSig = AbortSignal.any([opts.signal, _anthropicTimeoutSig]); } catch (_) { _anthropicFetchSig = opts.signal; }
    } else {
      _anthropicFetchSig = (opts && opts.signal) || _anthropicTimeoutSig;
    }
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        tools: [{
          name: toolName,
          description: (toolSpec && toolSpec.description) || 'Emit a Tiny World scene as JSON.',
          input_schema: (toolSpec && toolSpec.schema) || WORLD_SCHEMA,
        }],
        tool_choice: { type: 'tool', name: toolName },
        messages: [{ role: 'user', content }],
      }),
      signal: _anthropicFetchSig,
    });
    if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const j = await r.json();
    const block = (j.content || []).find(b => b.type === 'tool_use');
    if (!block) throw new Error('no tool_use block in response');
    return JSON.stringify(block.input);
  }

  async function callGemini(endpoint, key, model, system, user, opts = {}) {
    const m = model || AI_DEFAULTS.gemini.model;
    const safeModel = encodeURIComponent(m);
    const url = `${endpoint}/${safeModel}:generateContent?key=${encodeURIComponent(key)}`;
    const image = imageDataUrlParts(opts && opts.imageDataUrl);
    const parts = [{ text: user }];
    if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
    const _geminiTimeoutSig = aiFetchTimeoutSignal();
    let _geminiFetchSig;
    if (opts && opts.signal && _geminiTimeoutSig) {
      try { _geminiFetchSig = AbortSignal.any([opts.signal, _geminiTimeoutSig]); } catch (_) { _geminiFetchSig = opts.signal; }
    } else {
      _geminiFetchSig = (opts && opts.signal) || _geminiTimeoutSig;
    }
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: system }],
        },
        contents: [{
          role: 'user',
          parts,
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 8000,
        },
      }),
      signal: _geminiFetchSig,
    });
    if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const j = await r.json();
    const responseParts = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
    return (responseParts || []).map(part => part.text || '').join('\n');
  }

  // Item 4 — random island generator (offline, deterministic). This ports the
  // tiny-markov/island-lab prototype into TinyWorld's v=4 schema: first build a
  // connected island mask and archetype-specific prop plan, then translate lab
  // object tokens into native terrain/kind/buildingType/appearance fields.
  function generateRandomIslandWorld({ seed, biomes, elevation, gridSize, archetype }) {
    const size = coerceGridSize(gridSize, GRID);
    const effectiveSeed = String(seed || (typeof randomSeed === 'function' ? randomSeed() : 'tiny-1'));
    const biomeMix = Object.assign({ grass: 55, forest: 20, water: 10, dirt: 10, settlement: 5 }, biomes || {});
    const elevMix = Object.assign({ plains: 55, hills: 30, mountains: 15 }, elevation || {});

    function xmur3IslandSeed(str) {
      let h = 1779033703 ^ str.length;
      for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return function hash() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= h >>> 16) >>> 0;
      };
    }
    function islandMulberry32(n) {
      return function random() {
        let t = (n += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    function islandRngFromSeed(value) {
      return islandMulberry32(xmur3IslandSeed(String(value))());
    }
    function clampNumber(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }
    function clampIntLocal(value, min, max, fallback) {
      const n = Math.round(Number(value));
      return Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
    }
    function pct(source, key, fallback) {
      const n = Number(source && source[key]);
      return clampNumber(Number.isFinite(n) ? n : fallback, 0, 100);
    }
    function indexFor(x, y) {
      return y * size + x;
    }
    function xyFor(index) {
      return { x: index % size, y: Math.floor(index / size) };
    }
    function inBounds(x, y) {
      return x >= 0 && x < size && y >= 0 && y < size;
    }
    function neighbors(index, diagonal = false) {
      const { x, y } = xyFor(index);
      const steps = diagonal
        ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
        : [[1, 0], [-1, 0], [0, 1], [0, -1]];
      return steps
        .map(([dx, dy]) => [x + dx, y + dy])
        .filter(([nx, ny]) => inBounds(nx, ny))
        .map(([nx, ny]) => indexFor(nx, ny));
    }
    function cellRand(index, salt) {
      const { x, y } = xyFor(index);
      return islandRngFromSeed(effectiveSeed + '|cell|' + x + '|' + y + '|' + salt)();
    }
    function weightedPick(weights, rng, fallback) {
      const entries = Object.entries(weights || {}).filter(([, weight]) => Number(weight) > 0);
      const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
      if (!entries.length || total <= 0) return fallback;
      let roll = rng() * total;
      for (const [id, weight] of entries) {
        roll -= Number(weight);
        if (roll <= 0) return id;
      }
      return entries[entries.length - 1][0];
    }
    function smoothNoiseStep(t) {
      return t * t * (3 - 2 * t);
    }
    function makeValueNoiseLayer(cellsAcross, sourceRng) {
      const grid = [];
      const width = cellsAcross + 1;
      for (let i = 0; i < width * width; i++) grid.push(sourceRng());
      return { cellsAcross, grid, width };
    }
    function sampleValueNoiseLayer(layer, u, v) {
      const sx = u * layer.cellsAcross;
      const sy = v * layer.cellsAcross;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(layer.cellsAcross, x0 + 1);
      const y1 = Math.min(layer.cellsAcross, y0 + 1);
      const tx = smoothNoiseStep(sx - x0);
      const ty = smoothNoiseStep(sy - y0);
      const a = layer.grid[y0 * layer.width + x0];
      const b = layer.grid[y0 * layer.width + x1];
      const c = layer.grid[y1 * layer.width + x0];
      const d = layer.grid[y1 * layer.width + x1];
      return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }
    function makeFieldSampler(salt, baseCells, octaves, persistence) {
      const fieldRng = islandRngFromSeed(effectiveSeed + '|field|' + salt);
      const layers = [];
      let cellsAcross = Math.max(2, baseCells);
      for (let octave = 0; octave < octaves; octave++) {
        layers.push(makeValueNoiseLayer(cellsAcross, fieldRng));
        cellsAcross = Math.max(2, Math.floor(cellsAcross * 1.85));
      }
      return function sampleField(index) {
        const { x, y } = xyFor(index);
        const u = size <= 1 ? 0 : x / (size - 1);
        const v = size <= 1 ? 0 : y / (size - 1);
        let total = 0;
        let amp = 1;
        let ampTotal = 0;
        for (const layer of layers) {
          total += sampleValueNoiseLayer(layer, u, v) * amp;
          ampTotal += amp;
          amp *= persistence;
        }
        return ampTotal ? total / ampTotal : 0.5;
      };
    }

    const terrainIds = ['water', 'grass', 'prairie', 'path', 'dirt', 'stone', 'sand', 'cliff'];
    const objectDefs = [
      { id: 'watchtower', allowed: ['grass', 'stone', 'cliff', 'path'] },
      { id: 'house', allowed: ['grass', 'prairie', 'path', 'dirt'] },
      { id: 'manor', footprint: { w: 2, h: 1 }, allowed: ['grass', 'prairie', 'path', 'dirt'] },
      { id: 'manor-wing', hidden: true, footprintPart: true, allowed: [] },
      { id: 'tree', allowed: ['grass', 'prairie', 'dirt'] },
      { id: 'garden', allowed: ['grass', 'prairie', 'dirt', 'path'] },
      { id: 'stone', allowed: ['grass', 'stone', 'cliff', 'dirt'] },
      { id: 'ore', allowed: ['stone', 'cliff'] },
      { id: 'well', allowed: ['grass', 'prairie', 'path', 'dirt'] },
      { id: 'fence', allowed: ['grass', 'prairie', 'path', 'dirt'] },
      { id: 'castle', allowed: ['grass', 'stone', 'cliff', 'path'] },
      { id: 'bridge', allowed: ['path', 'grass', 'dirt', 'sand'] },
      { id: 'water-bridge', allowed: ['water'] },
      { id: 'crop', allowed: ['grass', 'prairie', 'dirt'] },
      { id: 'corn', allowed: ['grass', 'prairie', 'dirt'] },
      { id: 'wheat', allowed: ['grass', 'prairie', 'dirt'] },
      { id: 'pumpkin', allowed: ['grass', 'prairie', 'dirt'] },
      { id: 'carrot', allowed: ['grass', 'prairie', 'dirt'] },
      { id: 'sunflower', allowed: ['grass', 'prairie'] },
      { id: 'logs', allowed: ['grass', 'dirt', 'path'] },
      { id: 'flower', allowed: ['grass', 'prairie'] },
      { id: 'berries', allowed: ['grass', 'prairie', 'dirt'] },
      { id: 'cow', allowed: ['grass', 'prairie'] },
      { id: 'sheep', allowed: ['grass', 'prairie'] },
      { id: 'lamp', allowed: ['path', 'grass'] },
      { id: 'spotlight', allowed: ['path', 'stone', 'cliff'] },
      { id: 'ruins', allowed: ['grass', 'stone', 'cliff', 'dirt'] },
      { id: 'crystal', allowed: ['stone', 'cliff', 'grass'] },
      { id: 'totem', allowed: ['grass', 'prairie', 'stone'] },
    ];
    const objectById = new Map(objectDefs.map(object => [object.id, object]));
    const archetypes = {
      pastoral: {
        terrain: { grass: 5, prairie: 5, dirt: 1, path: 1, stone: 0.5, sand: 0.7 },
        objects: { sheep: 4, cow: 3, wheat: 2, corn: 1.5, garden: 1.6, flower: 1.5, house: 1.2, tree: 1, berries: 1 },
      },
      forest: {
        terrain: { grass: 6, prairie: 1, dirt: 2, stone: 0.8, cliff: 0.4, path: 0.4 },
        objects: { tree: 6, berries: 2, flower: 1.5, stone: 1, ore: 0.4, crystal: 0.4, house: 0.6, garden: 0.8 },
      },
      quarry: {
        terrain: { stone: 5, cliff: 3, dirt: 2, grass: 1.5, path: 1, sand: 0.3 },
        objects: { stone: 4, ore: 3, crystal: 1.3, watchtower: 1, ruins: 0.8, spotlight: 0.8, tree: 0.5 },
      },
      river: {
        terrain: { grass: 3, prairie: 2, sand: 2, path: 1.2, dirt: 1, stone: 0.8 },
        objects: { 'water-bridge': 3, bridge: 1.2, cow: 1.4, crop: 2, garden: 1.3, flower: 1.5, tree: 1.2, house: 1, lamp: 0.8 },
      },
      village: {
        terrain: { grass: 3, path: 3, prairie: 1.2, dirt: 1.4, stone: 0.8, sand: 0.4 },
        objects: { house: 4, manor: 1.6, lamp: 2, garden: 1.8, crop: 1.5, tree: 1.2, flower: 1.2, watchtower: 0.8 },
      },
      fortress: {
        terrain: { cliff: 3, stone: 3, path: 2, grass: 1.5, dirt: 1 },
        objects: { watchtower: 4, castle: 2.5, spotlight: 2, stone: 1.5, lamp: 1, house: 0.8 },
      },
      ruins: {
        terrain: { grass: 2.5, stone: 2.5, dirt: 2, cliff: 1, path: 0.8, prairie: 0.5 },
        objects: { ruins: 4, totem: 2, crystal: 1.5, stone: 2, ore: 0.8, berries: 1.2, tree: 1, flower: 0.8 },
      },
      harbor: {
        terrain: { sand: 3.5, grass: 2, path: 2, prairie: 1, stone: 0.8, dirt: 0.6 },
        objects: { 'water-bridge': 3, bridge: 1.8, house: 2, lamp: 1.6, crop: 1, garden: 1, flower: 1, tree: 0.8 },
      },
    };
    const economyResourceIds = ['food', 'materials', 'commerce', 'defense', 'charm'];
    const economyResourceBands = {
      default: {
        food: { min: 2, max: 7 },
        materials: { min: 2, max: 7 },
        commerce: { min: 1, max: 5 },
        defense: { min: 1, max: 5 },
        charm: { min: 2, max: 7 },
      },
      pastoral: {
        food: { min: 5, max: 10 },
        materials: { min: 2, max: 5 },
        commerce: { min: 1, max: 4 },
        defense: { min: 1, max: 4 },
        charm: { min: 3, max: 8 },
      },
      forest: {
        food: { min: 2, max: 6 },
        materials: { min: 4, max: 9 },
        commerce: { min: 1, max: 4 },
        defense: { min: 1, max: 4 },
        charm: { min: 5, max: 10 },
      },
      quarry: {
        food: { min: 2, max: 6 },
        materials: { min: 6, max: 11 },
        commerce: { min: 1, max: 4 },
        defense: { min: 2, max: 6 },
        charm: { min: 2, max: 6 },
      },
      river: {
        food: { min: 4, max: 9 },
        materials: { min: 2, max: 6 },
        commerce: { min: 2, max: 6 },
        defense: { min: 1, max: 4 },
        charm: { min: 4, max: 9 },
      },
      village: {
        food: { min: 3, max: 7 },
        materials: { min: 2, max: 6 },
        commerce: { min: 4, max: 9 },
        defense: { min: 1, max: 5 },
        charm: { min: 3, max: 7 },
      },
      fortress: {
        food: { min: 2, max: 6 },
        materials: { min: 3, max: 8 },
        commerce: { min: 1, max: 5 },
        defense: { min: 5, max: 10 },
        charm: { min: 2, max: 6 },
      },
      ruins: {
        food: { min: 2, max: 6 },
        materials: { min: 3, max: 8 },
        commerce: { min: 1, max: 4 },
        defense: { min: 2, max: 6 },
        charm: { min: 5, max: 10 },
      },
      harbor: {
        food: { min: 3, max: 7 },
        materials: { min: 2, max: 6 },
        commerce: { min: 4, max: 9 },
        defense: { min: 1, max: 5 },
        charm: { min: 4, max: 9 },
      },
    };

    function chooseArchetypeKey() {
      const explicit = String(archetype || '').trim().toLowerCase();
      if (explicit && explicit !== 'auto' && archetypes[explicit]) return explicit;
      const grass = pct(biomeMix, 'grass', 55);
      const forest = pct(biomeMix, 'forest', 20);
      const water = pct(biomeMix, 'water', 10);
      const dirt = pct(biomeMix, 'dirt', 10);
      const settlement = pct(biomeMix, 'settlement', 5);
      const hills = pct(elevMix, 'hills', 30);
      const mountains = pct(elevMix, 'mountains', 15);
      const weights = {
        pastoral: grass * 0.35 + dirt * 0.65 + Math.max(0, 25 - water) * 0.25,
        forest: forest * 1.45 + grass * 0.12,
        quarry: mountains * 0.75 + hills * 0.28,
        river: water * 0.7 + dirt * 0.18,
        village: settlement * 1.25 + grass * 0.12,
        fortress: settlement * 0.5 + mountains * 0.45,
        ruins: hills * 0.32 + mountains * 0.28 + forest * 0.12,
        harbor: water * 1.05 + settlement * 0.26,
      };
      return weightedPick(weights, islandRngFromSeed(effectiveSeed + '|archetype'), 'pastoral');
    }

    const archetypeKey = chooseArchetypeKey();
    const archetypeDef = archetypes[archetypeKey] || archetypes.pastoral;
    const waterPct = pct(biomeMix, 'water', 10);
    const waterArchetypeBias = archetypeKey === 'harbor' ? 0.055 : archetypeKey === 'river' ? 0.035 : 0;
    const waterLevel = clampNumber(
      0.095 + waterPct * 0.0024 + waterArchetypeBias,
      0.075,
      archetypeKey === 'harbor' ? 0.27 : archetypeKey === 'river' ? 0.22 : 0.18
    );
    const pathDensity = clampNumber(0.22 + pct(biomeMix, 'settlement', 5) * 0.0065 + pct(biomeMix, 'dirt', 10) * 0.0018 + pct(biomeMix, 'water', 10) * 0.0012, 0.08, 0.78);
    const featureDensity = clampNumber(
      0.26
      + pct(biomeMix, 'forest', 20) * 0.0038
      + pct(biomeMix, 'dirt', 10) * 0.0018
      + pct(biomeMix, 'settlement', 5) * 0.0034
      + pct(biomeMix, 'grass', 55) * 0.0012,
      0.24,
      0.74
    );
    const rng = islandRngFromSeed(effectiveSeed + '|' + archetypeKey + '|' + waterLevel.toFixed(3) + '|' + pathDensity.toFixed(3) + '|' + featureDensity.toFixed(3));
    const fieldScale = Math.max(2, Math.floor(size / 4));
    const terrainFields = {
      moisture: makeFieldSampler('moisture', fieldScale, 3, 0.58),
      meadow: makeFieldSampler('meadow', fieldScale, 3, 0.55),
      ridge: makeFieldSampler('ridge', Math.max(2, Math.floor(size / 5)), 4, 0.54),
      settlement: makeFieldSampler('settlement', fieldScale, 2, 0.62),
    };

    function fieldWeightForTerrain(terrain, index) {
      const moisture = terrainFields.moisture(index);
      const meadow = terrainFields.meadow(index);
      const ridge = terrainFields.ridge(index);
      const settlement = terrainFields.settlement(index);
      if (terrain === 'grass') return 0.74 + moisture * 0.42 + (1 - settlement) * 0.16;
      if (terrain === 'prairie') return 0.58 + meadow * 0.82 + (1 - Math.abs(moisture - 0.46) * 2) * 0.28;
      if (terrain === 'dirt') return 0.56 + (1 - moisture) * 0.34 + meadow * 0.34 + settlement * 0.18;
      if (terrain === 'stone') return 0.42 + ridge * 0.92 + (1 - moisture) * 0.18;
      if (terrain === 'cliff') return 0.32 + ridge * 1.15;
      if (terrain === 'path') return 0.25 + settlement * 0.62;
      if (terrain === 'sand') return 0.22 + (1 - moisture) * 0.34;
      return 1;
    }
    function terrainForBiomeField(index, options = {}) {
      let bestTerrain = 'grass';
      let bestScore = -Infinity;
      for (const [terrain, weight] of Object.entries(archetypeDef.terrain || {})) {
        let nextWeight = Number(weight) * fieldWeightForTerrain(terrain, index);
        if (options.noPath && terrain === 'path') nextWeight *= 0.25;
        const score = nextWeight + cellRand(index, 'terrain-jitter-' + terrain) * 0.1;
        if (score > bestScore) {
          bestScore = score;
          bestTerrain = terrain;
        }
      }
      return bestTerrain;
    }
    function replacementLandTerrain(index) {
      const terrain = terrainForBiomeField(index, { noPath: true });
      if (terrain === 'cliff') return 'stone';
      if (terrain === 'path') return 'grass';
      return terrain || 'grass';
    }

    function createLandMask() {
      const total = size * size;
      const maxLandRatio = archetypeKey === 'harbor' ? 0.82 : archetypeKey === 'river' ? 0.88 : 0.92;
      const minLandRatio = archetypeKey === 'harbor' ? 0.58 : archetypeKey === 'river' ? 0.62 : 0.68;
      const target = clampIntLocal(Math.round(total * (1 - waterLevel)), Math.ceil(total * minLandRatio), Math.floor(total * maxLandRatio), Math.round(total * 0.82));
      const centerA = Math.max(0, Math.min(size - 1, Math.floor((size - 1) / 2)));
      const centerB = Math.max(0, Math.min(size - 1, Math.ceil((size - 1) / 2)));
      const startX = rng() < 0.5 ? centerA : centerB;
      const startY = rng() < 0.5 ? centerA : centerB;
      const land = new Set([indexFor(startX, startY)]);
      const guardMax = Math.max(800, total * 80);
      const center = (size - 1) / 2;
      const radius = Math.max(1, (size - 1) * 0.72);
      let guard = 0;
      while (land.size < target && guard < guardMax) {
        guard++;
        const source = [...land][Math.floor(rng() * land.size)];
        const options = neighbors(source, true);
        const next = options[Math.floor(rng() * options.length)];
        const { x, y } = xyFor(next);
        const centerBias = 1 - Math.hypot(x - center, y - center) / radius;
        if (rng() < 0.38 + centerBias * 0.44) land.add(next);
      }
      return land;
    }

    function edgeIndexFor(side, n) {
      if (side === 0) return indexFor(n, 0);
      if (side === 1) return indexFor(size - 1, n);
      if (side === 2) return indexFor(size - 1 - n, size - 1);
      return indexFor(0, size - 1 - n);
    }
    function isEdgeIndex(index) {
      const { x, y } = xyFor(index);
      return x === 0 || y === 0 || x === size - 1 || y === size - 1;
    }
    function terrainCells(cells, terrain) {
      return cells
        .map((cell, index) => ({ cell, index }))
        .filter(({ cell }) => cell && cell.terrain === terrain)
        .map(({ index }) => index);
    }
    function terrainEdgeCount(cells, terrain) {
      return terrainCells(cells, terrain).filter(isEdgeIndex).length;
    }
    function clearMotifCell(cells, index, terrain) {
      if (!cells[index]) return;
      if (isProtectedEconomyCell(cells[index])) return false;
      cells[index].terrain = terrain;
      cells[index].object = null;
      cells[index].footprint = null;
      cells[index].footprintParent = null;
      cells[index].fenceEdges = null;
      cells[index].fenceGatePath = false;
      cells[index].fenceGateSides = null;
      return true;
    }
    function paintTerrainPatch(cells, centerIndex, terrain, count, options = {}) {
      if (centerIndex < 0 || !cells[centerIndex]) return [];
      const painted = [];
      const seen = new Set();
      const queue = [centerIndex];
      while (queue.length && painted.length < count) {
        const choice = Math.floor(rng() * queue.length);
        const index = queue.splice(choice, 1)[0];
        if (seen.has(index) || !cells[index]) continue;
        seen.add(index);
        if (!options.includeWater && cells[index].terrain === 'water' && terrain !== 'water') continue;
        if (!clearMotifCell(cells, index, terrain)) continue;
        painted.push(index);
        for (const next of neighbors(index, options.diagonal !== false)) {
          if (!seen.has(next) && rng() < (options.spread == null ? 0.68 : options.spread)) queue.push(next);
        }
      }
      return painted;
    }
    function paintTerrainWalk(cells, startIndex, terrain, count, options = {}) {
      if (startIndex < 0 || !cells[startIndex]) return [];
      const painted = [];
      const used = new Set();
      let index = startIndex;
      let direction = options.direction || null;
      for (let step = 0; step < count && index >= 0 && cells[index]; step++) {
        if (!options.includeWater && cells[index].terrain === 'water' && terrain !== 'water') break;
        if (!clearMotifCell(cells, index, terrain)) break;
        painted.push(index);
        used.add(index);
        const { x, y } = xyFor(index);
        if (!direction || rng() < (options.turnChance == null ? 0.34 : options.turnChance)) {
          direction = rng() < 0.5
            ? [rng() < 0.5 ? -1 : 1, 0]
            : [0, rng() < 0.5 ? -1 : 1];
        }
        let nx = clampIntLocal(x + direction[0], 0, size - 1, x);
        let ny = clampIntLocal(y + direction[1], 0, size - 1, y);
        let nextIndex = indexFor(nx, ny);
        if (used.has(nextIndex) || (!options.includeWater && cells[nextIndex].terrain === 'water' && terrain !== 'water')) {
          const candidates = neighbors(index)
            .filter(next => !used.has(next) && (options.includeWater || terrain === 'water' || cells[next].terrain !== 'water'));
          if (!candidates.length) break;
          nextIndex = candidates[Math.floor(rng() * candidates.length)];
        }
        index = nextIndex;
      }
      return painted;
    }
    function waterComponentKinds(cells) {
      const water = new Set(terrainCells(cells, 'water'));
      const seen = new Set();
      const kinds = { edge: 0, lake: 0, river: 0 };
      for (const start of water) {
        if (seen.has(start)) continue;
        const stack = [start];
        const component = [];
        let touchesTop = false;
        let touchesBottom = false;
        let touchesLeft = false;
        let touchesRight = false;
        while (stack.length) {
          const index = stack.pop();
          if (seen.has(index) || !water.has(index)) continue;
          seen.add(index);
          component.push(index);
          const { x, y } = xyFor(index);
          touchesTop = touchesTop || y === 0;
          touchesBottom = touchesBottom || y === size - 1;
          touchesLeft = touchesLeft || x === 0;
          touchesRight = touchesRight || x === size - 1;
          for (const next of neighbors(index)) if (!seen.has(next) && water.has(next)) stack.push(next);
        }
        const touchesEdge = touchesTop || touchesBottom || touchesLeft || touchesRight;
        if (touchesEdge) kinds.edge++;
        if (!touchesEdge && component.length >= Math.max(3, Math.floor(size * 0.36))) kinds.lake++;
        if ((touchesTop && touchesBottom) || (touchesLeft && touchesRight)) kinds.river++;
      }
      return kinds;
    }
    function waterBudgetRatio() {
      const base = 0.105 + pct(biomeMix, 'water', 10) * 0.0016;
      const bias = archetypeKey === 'harbor' ? 0.055 : archetypeKey === 'river' ? 0.04 : 0;
      return clampNumber(base + bias, 0.1, archetypeKey === 'harbor' ? 0.28 : archetypeKey === 'river' ? 0.24 : 0.19);
    }
    function protectedTouchesEdge(protectedWater) {
      for (const index of protectedWater) if (isEdgeIndex(index)) return true;
      return false;
    }
    function addProtectedWater(protectedWater, indexes) {
      for (const index of indexes || []) {
        if (index >= 0 && cellsInBoundsIndex(index)) protectedWater.add(index);
      }
    }
    function cellsInBoundsIndex(index) {
      return Number.isInteger(index) && index >= 0 && index < size * size;
    }
    function applyWaterEdgeMotif(cells, forceSize) {
      const side = Math.floor(rng() * 4);
      const minimum = archetypeKey === 'harbor' ? 3 : 2;
      const length = forceSize || Math.max(minimum, Math.floor(size * (archetypeKey === 'harbor' ? 0.4 : 0.18 + rng() * 0.18)));
      const start = Math.floor(rng() * Math.max(1, size - length + 1));
      const painted = [];
      for (let n = start; n < Math.min(size, start + length); n++) {
        const index = edgeIndexFor(side, n);
        clearMotifCell(cells, index, 'water');
        painted.push(index);
        for (const near of neighbors(index)) {
          if (cells[near].terrain !== 'water' && rng() < (archetypeKey === 'harbor' ? 0.44 : 0.2)) {
            clearMotifCell(cells, near, 'sand');
          }
        }
      }
      return painted;
    }
    function applyWaterLakeMotif(cells) {
      const center = nearestFeatureIndex(
        cells,
        (cell, index) => cell && cell.terrain !== 'water' && !isEdgeIndex(index),
        (size - 1) / 2 + (rng() < 0.5 ? -1 : 1),
        (size - 1) / 2 + (rng() < 0.5 ? -1 : 1)
      );
      const count = Math.max(3, Math.floor(size * (0.34 + rng() * 0.18)));
      const lake = paintTerrainPatch(cells, center, 'water', count, { spread: 0.7, includeWater: true, diagonal: false });
      for (const index of lake) {
        for (const near of neighbors(index)) {
          if (cells[near].terrain !== 'water' && rng() < 0.24) clearMotifCell(cells, near, rng() < 0.5 ? 'sand' : 'prairie');
        }
      }
      return lake;
    }
    function applyWaterRiverMotif(cells) {
      const vertical = rng() < 0.5;
      const startLane = 1 + Math.floor(rng() * Math.max(1, size - 2));
      let lane = startLane;
      const length = Math.max(size, Math.floor(size * (archetypeKey === 'river' ? 1.05 : 0.72)));
      const painted = [];
      for (let step = 0; step < length; step++) {
        const progress = Math.min(size - 1, step);
        const x = vertical ? lane : progress;
        const y = vertical ? progress : lane;
        const index = indexFor(x, y);
        clearMotifCell(cells, index, 'water');
        painted.push(index);
        if (rng() < 0.46) {
          const nextLane = clampIntLocal(lane + (rng() < 0.5 ? -1 : 1), 1, Math.max(1, size - 2), lane);
          if (nextLane !== lane) {
            const connector = vertical ? indexFor(nextLane, y) : indexFor(x, nextLane);
            clearMotifCell(cells, connector, 'water');
            painted.push(connector);
          }
          lane = nextLane;
        }
      }
      return painted;
    }
    function distanceToProtectedWater(index, protectedWater) {
      if (!protectedWater.size) return size * 2;
      const { x, y } = xyFor(index);
      let best = Infinity;
      for (const protectedIndex of protectedWater) {
        const point = xyFor(protectedIndex);
        best = Math.min(best, Math.abs(x - point.x) + Math.abs(y - point.y));
      }
      return best;
    }
    function pruneWaterToBudget(cells, protectedWater) {
      const waterIndexes = terrainCells(cells, 'water');
      const budget = Math.max(protectedWater.size, Math.round(cells.length * waterBudgetRatio()));
      const candidates = waterIndexes
        .filter(index => !protectedWater.has(index))
        .map(index => ({
          index,
          distance: distanceToProtectedWater(index, protectedWater),
          keepScore: distanceToProtectedWater(index, protectedWater)
            - (isEdgeIndex(index) ? 0.5 : 0)
            + cellRand(index, 'water-keep') * 0.35,
          pruneScore: distanceToProtectedWater(index, protectedWater)
            + (isEdgeIndex(index) ? 2.5 : 0)
            + cellRand(index, 'water-prune') * 0.4,
        }))
        .sort((a, b) => a.keepScore - b.keepScore);
      const extraLimit = Math.max(0, budget - protectedWater.size);
      const expansionLimit = archetypeKey === 'harbor' ? 2 : 1;
      const keepExtra = new Set(candidates
        .filter(entry => entry.distance <= expansionLimit)
        .slice(0, extraLimit)
        .map(entry => entry.index));
      let excess = Math.max(0, waterIndexes.length - budget);
      const pruneFirst = candidates
        .filter(entry => !keepExtra.has(entry.index))
        .sort((a, b) => b.pruneScore - a.pruneScore);
      for (const entry of pruneFirst) {
        clearMotifCell(cells, entry.index, isEdgeIndex(entry.index) && rng() < 0.55 ? 'sand' : replacementLandTerrain(entry.index));
      }
      excess = Math.max(0, terrainCells(cells, 'water').length - budget);
      if (excess <= 0) return;
      const overflow = candidates
        .filter(entry => keepExtra.has(entry.index))
        .sort((a, b) => b.pruneScore - a.pruneScore);
      for (const entry of overflow) {
        if (excess <= 0) break;
        clearMotifCell(cells, entry.index, isEdgeIndex(entry.index) && rng() < 0.55 ? 'sand' : replacementLandTerrain(entry.index));
        excess--;
      }
    }
    function choosePrimaryWaterMotif(waterChance) {
      if (archetypeKey === 'river') return 'river';
      if (archetypeKey === 'harbor') return 'edge';
      return weightedPick({
        lake: 0.44 + waterChance * 0.22,
        edge: 0.38,
        river: 0.12 + waterChance * 0.34,
      }, rng, 'edge');
    }
    function applyWaterComposition(cells, waterChance) {
      const protectedWater = new Set();
      const primary = choosePrimaryWaterMotif(waterChance);
      if (primary === 'river') addProtectedWater(protectedWater, applyWaterRiverMotif(cells));
      else if (primary === 'lake') addProtectedWater(protectedWater, applyWaterLakeMotif(cells));
      else addProtectedWater(protectedWater, applyWaterEdgeMotif(cells));
      if (!protectedTouchesEdge(protectedWater)) {
        addProtectedWater(protectedWater, applyWaterEdgeMotif(cells, Math.max(1, Math.floor(size * 0.14))));
      }
      if (terrainEdgeCount(cells, 'water') === 0) {
        addProtectedWater(protectedWater, applyWaterEdgeMotif(cells, Math.max(1, Math.floor(size * 0.14))));
      }
      pruneWaterToBudget(cells, protectedWater);
    }
    function ensureMinimumWaterTiles(cells, minWaterTiles = 5) {
      let waterCount = terrainCells(cells, 'water').length;
      if (waterCount >= minWaterTiles) return;
      const waterIndexes = terrainCells(cells, 'water');
      function nearestWaterDistance(index) {
        if (!waterIndexes.length) return isEdgeIndex(index) ? 0 : size;
        return waterIndexes.reduce((best, waterIndex) => Math.min(best, distanceBetweenIndexes(index, waterIndex)), size * 2);
      }
      const candidates = cells
        .map((cell, index) => ({ cell, index }))
        .filter(({ cell }) => {
          if (!cell || cell.terrain === 'water') return false;
          if (isProtectedEconomyCell(cell)) return false;
          if (cell.footprint || cell.footprintParent) return false;
          if (isBuildingObjectId(cell.object) || cell.object === 'bridge' || cell.object === 'water-bridge') return false;
          return true;
        })
        .map(entry => ({
          index: entry.index,
          score: nearestWaterDistance(entry.index)
            + (isEdgeIndex(entry.index) ? -0.65 : 0)
            + (entry.cell.object ? 1.25 : 0)
            + cellRand(entry.index, 'minimum-water') * 0.35,
        }))
        .sort((a, b) => a.score - b.score);
      for (const { index } of candidates) {
        if (waterCount >= minWaterTiles) break;
        if (clearMotifCell(cells, index, 'water')) waterCount++;
      }
    }
    function applyTerrainMotifs(cells) {
      const waterChance = pct(biomeMix, 'water', 10) / 100;
      const mountainChance = (pct(elevMix, 'mountains', 15) + pct(elevMix, 'hills', 30) * 0.45) / 100;
      const dirtChance = pct(biomeMix, 'dirt', 10) / 100;
      const forestChance = pct(biomeMix, 'forest', 20) / 100;
      const centerTarget = (size - 1) / 2;

      applyWaterComposition(cells, waterChance);

      const meadowAnchor = nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', centerTarget, centerTarget);
      if (meadowAnchor >= 0 && (archetypeKey === 'pastoral' || rng() < 0.2 + pct(biomeMix, 'grass', 55) / 240)) {
        paintTerrainPatch(cells, meadowAnchor, 'prairie', Math.max(4, Math.floor(size * 0.65)), { spread: 0.72 });
      }

      const dirtAnchor = nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', size * 0.28, size * 0.66);
      if (dirtAnchor >= 0 && (['pastoral', 'river', 'village'].indexOf(archetypeKey) !== -1 || rng() < 0.18 + dirtChance * 0.65)) {
        paintTerrainPatch(cells, dirtAnchor, 'dirt', Math.max(3, Math.floor(size * (0.36 + dirtChance))), { spread: 0.66 });
      }

      const stoneAnchor = nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', size * 0.72, size * 0.32);
      if (stoneAnchor >= 0 && (['quarry', 'fortress', 'ruins'].indexOf(archetypeKey) !== -1 || rng() < 0.16 + mountainChance * 0.7)) {
        const ridge = paintTerrainWalk(cells, stoneAnchor, rng() < 0.45 ? 'cliff' : 'stone', Math.max(4, Math.floor(size * (0.48 + mountainChance))), { turnChance: 0.28 });
        for (const index of ridge) {
          for (const near of neighbors(index)) {
            if (cells[near].terrain !== 'water' && rng() < 0.26) clearMotifCell(cells, near, 'stone');
          }
        }
      }

      if (archetypeKey === 'forest' || rng() < 0.12 + forestChance * 0.55) {
        const groveAnchor = nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', size * 0.25, size * 0.25);
        if (groveAnchor >= 0) paintTerrainPatch(cells, groveAnchor, 'grass', Math.max(4, Math.floor(size * 0.55)), { spread: 0.7 });
      }

      for (const waterIndex of terrainCells(cells, 'water')) {
        for (const near of neighbors(waterIndex)) {
          if (cells[near].terrain !== 'water' && rng() < (archetypeKey === 'harbor' ? 0.36 : 0.14)) {
            clearMotifCell(cells, near, 'sand');
          }
        }
      }

      return waterComponentKinds(cells);
    }

    function carvePaths(cells) {
      const landIndexes = cells
        .map((cell, index) => ({ cell, index }))
        .filter(({ cell }) => cell.terrain !== 'water')
        .map(({ index }) => index);
      if (!landIndexes.length) return;

      const center = landIndexes.reduce((best, index) => {
        const { x, y } = xyFor(index);
        const dist = Math.abs(x - (size - 1) / 2) + Math.abs(y - (size - 1) / 2);
        return dist < best.dist ? { index, dist } : best;
      }, { index: landIndexes[0], dist: Infinity }).index;

      const pathCount = archetypeKey === 'village' || archetypeKey === 'fortress' ? 3 : 1 + Math.round(pathDensity * 3);
      for (let route = 0; route < pathCount; route++) {
        const target = landIndexes[Math.floor(rng() * landIndexes.length)];
        let { x, y } = xyFor(center);
        const end = xyFor(target);
        let guard = 0;
        while ((x !== end.x || y !== end.y) && guard < size * 3) {
          guard++;
          const index = indexFor(x, y);
          if (cells[index].terrain !== 'water') cells[index].terrain = 'path';
          if (rng() < 0.5 && x !== end.x) x += Math.sign(end.x - x);
          else if (y !== end.y) y += Math.sign(end.y - y);
          else if (x !== end.x) x += Math.sign(end.x - x);
        }
      }

      for (const index of landIndexes) {
        if (cells[index].terrain !== 'water' && rng() < pathDensity * 0.08) cells[index].terrain = 'path';
      }
    }

    function objectAllowed(objectId, terrainId) {
      const object = objectById.get(objectId);
      return !!(object && !object.hidden && object.allowed.indexOf(terrainId) !== -1);
    }
    function isBuildingObjectId(objectId) {
      return objectId === 'house' || objectId === 'manor' || objectId === 'watchtower' || objectId === 'castle';
    }
    function isLargeBuildingObjectId(objectId) {
      return objectId === 'manor' || objectId === 'watchtower' || objectId === 'castle';
    }
    function isTowerObjectId(objectId) {
      return objectId === 'watchtower' || objectId === 'castle';
    }
    function isCropObjectId(objectId) {
      return ['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower'].indexOf(objectId) !== -1;
    }
    function isAnimalObjectId(objectId) {
      return objectId === 'cow' || objectId === 'sheep';
    }
    function isRelicObjectId(objectId) {
      return objectId === 'ruins' || objectId === 'totem';
    }
    function isScatterAccentObjectId(objectId) {
      return ['tree', 'garden', 'stone', 'berries', 'flower', 'lamp', 'spotlight'].indexOf(objectId) !== -1;
    }
    function isProtectedEconomyCell(cell) {
      return !!(cell && /^economy-/.test(String(cell.motif || '')));
    }
    function markEconomyCell(cells, index, resourceId) {
      if (cells[index]) cells[index].motif = 'economy-' + resourceId;
    }
    function economyBandFor(resourceId) {
      const byArchetype = economyResourceBands[archetypeKey] || economyResourceBands.default;
      return (byArchetype && byArchetype[resourceId]) || economyResourceBands.default[resourceId] || { min: 1, max: 4 };
    }
    function economyTargetFor(resourceId) {
      const band = economyBandFor(resourceId);
      const min = Math.max(0, Math.floor(band.min || 0));
      const max = Math.max(min, Math.floor(band.max || min));
      const targetRng = islandRngFromSeed(effectiveSeed + '|economy-target|' + archetypeKey + '|' + resourceId);
      return min + Math.floor(targetRng() * (max - min + 1));
    }
    function objectContributesToResource(objectId, resourceId) {
      if (!objectId || /-wing$/.test(objectId)) return false;
      if (resourceId === 'food') return isCropObjectId(objectId) || isAnimalObjectId(objectId) || objectId === 'berries';
      if (resourceId === 'materials') return objectId === 'tree' || objectId === 'stone' || objectId === 'ore' || objectId === 'crystal' || objectId === 'logs';
      if (resourceId === 'commerce') return objectId === 'house' || objectId === 'manor' || objectId === 'lamp' || objectId === 'bridge' || objectId === 'water-bridge';
      if (resourceId === 'defense') return isTowerObjectId(objectId) || objectId === 'totem' || objectId === 'spotlight' || objectId === 'castle';
      if (resourceId === 'charm') return objectId === 'flower' || objectId === 'berries' || objectId === 'tree' || objectId === 'crystal' || objectId === 'ruins' || objectId === 'totem';
      return false;
    }
    const generationSuppressedObjectIds = new Set(['spotlight']);
    function generationEconomyObjectIdForMapped(mapped) {
      if (!mapped || !mapped.kind) return null;
      if (mapped.kind === 'house') {
        if (mapped.buildingType === 'manor') return 'manor';
        if (mapped.buildingType === 'tower' || mapped.buildingType === 'turret') return 'watchtower';
        return 'house';
      }
      if (mapped.kind === 'lamp-post') return 'lamp';
      if (mapped.kind === 'rock' || mapped.kind === 'stone' || mapped.kind === 'pebble') return 'stone';
      if (mapped.kind === 'bush' || mapped.kind === 'shrub') return 'berries';
      if (mapped.kind === 'crystal') return 'crystal';
      if (mapped.kind === 'bridge') return 'bridge';
      return mapped.kind;
    }
    function mappedObjectContributesToGenerationEconomy(mapped) {
      const id = generationEconomyObjectIdForMapped(mapped);
      if (!id || generationSuppressedObjectIds.has(id)) return false;
      return economyResourceIds.some(resourceId => objectContributesToResource(id, resourceId));
    }
    function economyResourceCount(cells, resourceId) {
      return cells.reduce((count, cell) => count + (objectContributesToResource(cell && cell.object, resourceId) ? 1 : 0), 0);
    }
    function placementHasIndex(placement, index) {
      return placement && placement.indexOf(index) !== -1;
    }
    function spacingAllowsBuilding(cells, placement, objectId) {
      if (!isBuildingObjectId(objectId)) return true;
      const strict = isLargeBuildingObjectId(objectId);
      for (const index of placement) {
        const around = neighbors(index, strict);
        for (const near of around) {
          if (placementHasIndex(placement, near)) continue;
          const neighborObject = cells[near] && cells[near].object;
          if (!neighborObject || /-wing$/.test(neighborObject)) continue;
          if (isLargeBuildingObjectId(neighborObject)) return false;
          if (strict && isBuildingObjectId(neighborObject)) return false;
        }
      }
      return true;
    }
    function canUseCellForPlacement(cells, index, objectId) {
      const cell = cells[index];
      return cell && !cell.fenceGatePath && !cell.object && objectAllowed(objectId, cell.terrain);
    }
    function placementIndexesFor(cells, index, objectId) {
      const object = objectById.get(objectId);
      if (!object || object.hidden) return null;
      const footprint = object.footprint || { w: 1, h: 1 };
      if (footprint.w === 1 && footprint.h === 1) {
        if (!canUseCellForPlacement(cells, index, objectId)) return null;
        const placement = [index];
        return spacingAllowsBuilding(cells, placement, objectId) ? placement : null;
      }
      if (footprint.w === 2 && footprint.h === 1) {
        const { x, y } = xyFor(index);
        const candidates = [
          [index, inBounds(x + 1, y) ? indexFor(x + 1, y) : -1],
          [inBounds(x - 1, y) ? indexFor(x - 1, y) : -1, index],
        ];
        return candidates.find(pair => (
          pair.every(cellIndex => canUseCellForPlacement(cells, cellIndex, objectId))
          && spacingAllowsBuilding(cells, pair, objectId)
        )) || null;
      }
      return null;
    }
    function placeObjectAt(cells, index, objectId) {
      const placement = placementIndexesFor(cells, index, objectId);
      if (!placement) return false;
      const object = objectById.get(objectId);
      const footprint = object.footprint || { w: 1, h: 1 };
      const [root, ...parts] = placement;
      cells[root].object = objectId;
      cells[root].footprint = footprint;
      for (const partIndex of parts) {
        cells[partIndex].object = objectId + '-wing';
        cells[partIndex].footprintParent = root;
      }
      return true;
    }
    function clearObjectsWhere(cells, predicate) {
      for (let index = 0; index < cells.length; index++) {
        const cell = cells[index];
        if (!cell || !cell.object || !predicate(cell.object, cell, index)) continue;
        clearGeneratedObject(cells, index);
      }
    }
    function distanceBetweenIndexes(a, b) {
      const pa = xyFor(a);
      const pb = xyFor(b);
      return Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y);
    }
    function nearestPathIndex(cells, fromIndex) {
      let best = -1;
      let bestScore = Infinity;
      for (let index = 0; index < cells.length; index++) {
        if (!cells[index] || cells[index].terrain !== 'path') continue;
        const score = distanceBetweenIndexes(fromIndex, index) + rng() * 0.2;
        if (score < bestScore) {
          best = index;
          bestScore = score;
        }
      }
      return best;
    }
    function openNeighborForPath(cells, index) {
      const footprint = new Set([index]);
      for (let i = 0; i < cells.length; i++) {
        if (cells[i] && cells[i].footprintParent === index) footprint.add(i);
      }
      const options = [];
      for (const part of footprint) {
        for (const next of neighbors(part)) {
          if (footprint.has(next) || options.indexOf(next) !== -1) continue;
          if (cells[next] && cells[next].terrain !== 'water' && !cells[next].object) options.push(next);
        }
      }
      options
        .sort((a, b) => distanceBetweenIndexes(a, index) - distanceBetweenIndexes(b, index) + rng() * 0.2);
      return options.length ? options[0] : -1;
    }
    function connectFeatureToPath(cells, featureIndex) {
      if (featureIndex < 0 || !cells[featureIndex]) return;
      const target = nearestPathIndex(cells, featureIndex);
      if (target < 0) return;
      const start = cells[featureIndex].object ? openNeighborForPath(cells, featureIndex) : featureIndex;
      if (start < 0) return;
      setFeatureTerrain(cells, start, 'path');
      if (start !== target) carveFeaturePath(cells, start, target);
    }
    function placeFenceRing(cells, centerIndex, radius, limit, preferredTerrain) {
      const ring = featureRingIndexes(centerIndex, radius)
        .filter(index => cells[index] && cells[index].terrain !== 'water' && !cells[index].object);
      let placed = 0;
      for (const index of ring) {
        if (placed >= limit) break;
        if (forcePlaceObject(cells, index, 'spotlight', preferredTerrain || (cells[index].terrain === 'path' ? 'path' : 'stone'))) placed++;
      }
      return placed;
    }
    const generatedFenceSides = ['n', 'e', 's', 'w'];
    function neighborIndexForFenceSide(index, side) {
      const { x, y } = xyFor(index);
      if (side === 'n') return inBounds(x, y - 1) ? indexFor(x, y - 1) : -1;
      if (side === 's') return inBounds(x, y + 1) ? indexFor(x, y + 1) : -1;
      if (side === 'e') return inBounds(x + 1, y) ? indexFor(x + 1, y) : -1;
      if (side === 'w') return inBounds(x - 1, y) ? indexFor(x - 1, y) : -1;
      return -1;
    }
    function addGeneratedFenceEdge(cells, index, side, level, style) {
      if (!cells[index] || generatedFenceSides.indexOf(side) === -1) return false;
      if (!cells[index].fenceEdges) cells[index].fenceEdges = [];
      const fenceStyle = style === 'garden' || style === 'gate' ? style : 'wood';
      const fenceLevel = Math.max(1, Math.min(8, level || 1));
      const existing = cells[index].fenceEdges.find(edge => edge.side === side && edge.style === fenceStyle);
      if (existing) {
        existing.level = Math.max(existing.level || 1, fenceLevel);
        return false;
      }
      cells[index].fenceEdges.push({ side, level: fenceLevel, style: fenceStyle });
      return true;
    }
    function generatedGateLevelForCell(cell) {
      return isAnimalObjectId(cell && cell.object) ? 2 : 1;
    }
    function addGeneratedFenceGate(cells, index, side, level) {
      if (!cells[index]) return false;
      removeGeneratedFenceEdgeSide(cells[index], side);
      return addGeneratedFenceEdge(cells, index, side, level || generatedGateLevelForCell(cells[index]), 'gate');
    }
    function hasGeneratedFenceEdges(cell) {
      return !!(cell && Array.isArray(cell.fenceEdges) && cell.fenceEdges.length);
    }
    function hasGeneratedFenceEdgeSide(cell, side) {
      return !!(cell && Array.isArray(cell.fenceEdges) && cell.fenceEdges.some(edge => edge && edge.side === side));
    }
    function removeGeneratedFenceEdgeSide(cell, side) {
      if (!cell || !Array.isArray(cell.fenceEdges)) return false;
      const before = cell.fenceEdges.length;
      cell.fenceEdges = cell.fenceEdges.filter(edge => !(edge && edge.side === side));
      return cell.fenceEdges.length !== before;
    }
    function regionBoundaryFenceEdges(cells, indexes) {
      const region = new Set(indexes.filter(index => cells[index] && cells[index].terrain !== 'water'));
      const edges = [];
      for (const index of region) {
        for (const side of generatedFenceSides) {
          const neighbor = neighborIndexForFenceSide(index, side);
          if (neighbor < 0 || !region.has(neighbor)) edges.push({ index, side, neighbor });
        }
      }
      return edges;
    }
    function chooseGeneratedGateEdge(cells, edges) {
      const candidates = edges
        .filter(edge => edge.neighbor >= 0 && cells[edge.neighbor] && cells[edge.neighbor].terrain !== 'water' && !cells[edge.neighbor].object && !isProtectedEconomyCell(cells[edge.neighbor]))
        .map(edge => {
          const neighbor = cells[edge.neighbor];
          const pathScore = neighbor.terrain === 'path' ? -10 : 0;
          return Object.assign({ score: pathScore + distanceBetweenIndexes(edge.index, edge.neighbor) + cellRand(edge.index, 'fence-gate-' + edge.side) * 0.4 }, edge);
        })
        .sort((a, b) => a.score - b.score);
      return candidates.length ? candidates[0] : null;
    }
    function applyGeneratedFenceEnclosure(cells, indexes, opts = {}) {
      const region = indexes.filter(index => cells[index] && cells[index].terrain !== 'water' && cells[index].object);
      if (!region.length) return 0;
      const edges = regionBoundaryFenceEdges(cells, region);
      const gate = chooseGeneratedGateEdge(cells, edges);
      if (gate && cells[gate.neighbor] && cells[gate.neighbor].terrain !== 'path') {
        setFeatureTerrain(cells, gate.neighbor, 'path');
      }
      if (gate && cells[gate.neighbor]) {
        cells[gate.neighbor].fenceGatePath = true;
        if (!cells[gate.index].fenceGateSides) cells[gate.index].fenceGateSides = [];
        if (cells[gate.index].fenceGateSides.indexOf(gate.side) === -1) cells[gate.index].fenceGateSides.push(gate.side);
      }
      let added = 0;
      if (gate && addGeneratedFenceGate(cells, gate.index, gate.side, opts.level || 1)) added++;
      for (const edge of edges) {
        if (gate && edge.index === gate.index && edge.side === gate.side) continue;
        if (addGeneratedFenceEdge(cells, edge.index, edge.side, opts.level || 1, opts.style || 'wood')) added++;
      }
      return added;
    }
    function repairGeneratedFenceGatePaths(cells) {
      for (let index = 0; index < cells.length; index++) {
        const cell = cells[index];
        if (!cell || !Array.isArray(cell.fenceGateSides)) continue;
        for (const side of cell.fenceGateSides) {
          const neighbor = neighborIndexForFenceSide(index, side);
          if (neighbor < 0 || !cells[neighbor] || cells[neighbor].terrain === 'water') continue;
          if (cells[neighbor].object && !isProtectedEconomyCell(cells[neighbor])) clearGeneratedObject(cells, neighbor);
          if (!cells[neighbor].object && !isProtectedEconomyCell(cells[neighbor])) setFeatureTerrain(cells, neighbor, 'path');
          cells[neighbor].fenceGatePath = true;
          addGeneratedFenceGate(cells, index, side, generatedGateLevelForCell(cell));
        }
      }
    }
    function sameFenceResourceGroup(a, b) {
      if (!a || !b) return false;
      if (isCropObjectId(a.object) && isCropObjectId(b.object)) return true;
      if (isAnimalObjectId(a.object) && isAnimalObjectId(b.object)) return true;
      return false;
    }
    function repairGeneratedFenceOpenings(cells) {
      for (let index = 0; index < cells.length; index++) {
        const cell = cells[index];
        if (!cell || !hasGeneratedFenceEdges(cell)) continue;
        if (!isCropObjectId(cell.object) && !isAnimalObjectId(cell.object)) continue;
        for (const side of generatedFenceSides) {
          if (hasGeneratedFenceEdgeSide(cell, side)) continue;
          const neighbor = neighborIndexForFenceSide(index, side);
          if (neighbor < 0 || !cells[neighbor] || cells[neighbor].terrain === 'water') continue;
          if (sameFenceResourceGroup(cell, cells[neighbor])) continue;
          if (isCropObjectId(cells[neighbor].object) || isAnimalObjectId(cells[neighbor].object)) {
            addGeneratedFenceEdge(cells, index, side, isAnimalObjectId(cell.object) ? 2 : 1, isCropObjectId(cell.object) ? 'garden' : 'wood');
            continue;
          }
          if (isProtectedEconomyCell(cells[neighbor])) {
            addGeneratedFenceEdge(cells, index, side, isAnimalObjectId(cell.object) ? 2 : 1, isCropObjectId(cell.object) ? 'garden' : 'wood');
            continue;
          }
          if (cells[neighbor].object && !isProtectedEconomyCell(cells[neighbor])) clearGeneratedObject(cells, neighbor);
          if (!cells[neighbor].object && !isProtectedEconomyCell(cells[neighbor])) setFeatureTerrain(cells, neighbor, 'path');
          cells[neighbor].fenceGatePath = true;
          addGeneratedFenceGate(cells, index, side, generatedGateLevelForCell(cell));
        }
      }
    }
    function generatedResourceComponents(cells, predicate) {
      const components = [];
      const seen = new Set();
      for (let index = 0; index < cells.length; index++) {
        if (seen.has(index) || !predicate(cells[index]) || !hasGeneratedFenceEdges(cells[index])) continue;
        const component = [];
        const queue = [index];
        seen.add(index);
        while (queue.length) {
          const current = queue.shift();
          component.push(current);
          for (const next of neighbors(current)) {
            if (seen.has(next) || !predicate(cells[next]) || !hasGeneratedFenceEdges(cells[next])) continue;
            seen.add(next);
            queue.push(next);
          }
        }
        components.push(component);
      }
      return components;
    }
    function componentFenceBoundaryEdges(cells, component, predicate) {
      const edges = [];
      for (const index of component) {
        for (const side of generatedFenceSides) {
          const neighbor = neighborIndexForFenceSide(index, side);
          if (neighbor >= 0 && predicate(cells[neighbor])) continue;
          edges.push({ index, side, neighbor });
        }
      }
      return edges;
    }
    function ensureGateForGeneratedComponent(cells, component, predicate, opts) {
      const edges = componentFenceBoundaryEdges(cells, component, predicate);
      const existingPathGate = edges.find(edge => !hasGeneratedFenceEdgeSide(cells[edge.index], edge.side) && edge.neighbor >= 0 && cells[edge.neighbor] && cells[edge.neighbor].terrain === 'path');
      if (existingPathGate) {
        addGeneratedFenceGate(cells, existingPathGate.index, existingPathGate.side, opts && opts.level);
        return;
      }
      const candidates = edges
        .filter(edge => edge.neighbor >= 0 && cells[edge.neighbor] && cells[edge.neighbor].terrain !== 'water' && !isProtectedEconomyCell(cells[edge.neighbor]) && !isCropObjectId(cells[edge.neighbor].object) && !isAnimalObjectId(cells[edge.neighbor].object) && !predicate(cells[edge.neighbor]))
        .map(edge => {
          const neighbor = cells[edge.neighbor];
          const pathScore = neighbor.terrain === 'path' ? -12 : 0;
          const objectScore = neighbor.object ? 4 : 0;
          return Object.assign({ score: pathScore + objectScore + cellRand(edge.index, 'component-gate-' + edge.side) * 0.3 }, edge);
        })
        .sort((a, b) => a.score - b.score);
      const gate = candidates[0];
      if (!gate) return;
      if (cells[gate.neighbor].object) clearGeneratedObject(cells, gate.neighbor);
      setFeatureTerrain(cells, gate.neighbor, 'path');
      cells[gate.neighbor].fenceGatePath = true;
      addGeneratedFenceGate(cells, gate.index, gate.side, opts && opts.level);
    }
    function ensureGeneratedResourceComponentGates(cells) {
      for (const component of generatedResourceComponents(cells, cell => isCropObjectId(cell && cell.object))) {
        ensureGateForGeneratedComponent(cells, component, cell => isCropObjectId(cell && cell.object), { level: 1, style: 'garden' });
      }
      for (const component of generatedResourceComponents(cells, cell => isAnimalObjectId(cell && cell.object))) {
        ensureGateForGeneratedComponent(cells, component, cell => isAnimalObjectId(cell && cell.object), { level: 2, style: 'wood' });
      }
    }
    function towerCountForSeed() {
      const roll = islandRngFromSeed(effectiveSeed + '|corner-tower-count')();
      if (roll < 0.0625) return 0;
      if (roll < 0.5625) return 1;
      if (roll < 0.8125) return 2;
      if (roll < 0.9375) return 3;
      return 4;
    }
    function shuffledTowerCorners() {
      const list = [
        { x: 0, y: 0 },
        { x: size - 1, y: 0 },
        { x: size - 1, y: size - 1 },
        { x: 0, y: size - 1 },
      ];
      const cornerRng = islandRngFromSeed(effectiveSeed + '|corner-tower-order');
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(cornerRng() * (i + 1));
        const t = list[i];
        list[i] = list[j];
        list[j] = t;
      }
      return list;
    }
    function towerCandidatesForCorner(cells, corner) {
      const maxCornerReach = Math.max(3, Math.floor(size * 0.28));
      return cells
        .map((cell, index) => ({ cell, index, point: xyFor(index) }))
        .filter(({ cell, point }) => (
          cell
          && cell.terrain !== 'water'
          && Math.abs(point.x - corner.x) + Math.abs(point.y - corner.y) <= maxCornerReach
          && (!cell.object || (!isBuildingObjectId(cell.object) && cell.object !== 'bridge' && cell.object !== 'water-bridge'))
        ))
        .map(entry => {
          const dx = Math.abs(entry.point.x - corner.x);
          const dy = Math.abs(entry.point.y - corner.y);
          const edgeBonus = (entry.point.x === 0 || entry.point.y === 0 || entry.point.x === size - 1 || entry.point.y === size - 1) ? -0.75 : 0;
          const objectPenalty = entry.cell.object ? 0.65 : 0;
          return Object.assign(entry, { score: Math.max(dx, dy) * 2 + dx + dy + edgeBonus + objectPenalty + rng() * 0.2 });
        })
        .sort((a, b) => a.score - b.score)
        .map(entry => entry.index);
    }
    function towerDoorSideTowardPoint(index, target) {
      const point = xyFor(index);
      const dx = target.x - point.x;
      const dy = target.y - point.y;
      if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'e' : 'w';
      return dy >= 0 ? 's' : 'n';
    }
    function towerDoorTarget() {
      const center = (size - 1) / 2;
      return { x: center, y: center };
    }
    function towerDoorSideFor(cells, index) {
      return towerDoorSideTowardPoint(index, towerDoorTarget());
    }
    function towerRotationYForDoorSide(side) {
      if (side === 'n') return Math.PI;
      if (side === 'e') return Math.PI / 2;
      if (side === 'w') return -Math.PI / 2;
      return 0;
    }
    function placeTowerNearCorner(cells, corner) {
      for (const index of towerCandidatesForCorner(cells, corner)) {
        if (!spacingAllowsBuilding(cells, [index], 'watchtower')) continue;
        if (forcePlaceObject(cells, index, 'watchtower', cells[index].terrain === 'path' ? 'path' : 'stone')) {
          cells[index].motif = 'corner-tower';
          cells[index].doorSide = towerDoorSideFor(cells, index);
          return true;
        }
      }
      return false;
    }
    function applyCornerTowerMotif(cells) {
      clearObjectsWhere(cells, objectId => isTowerObjectId(objectId));
      const count = towerCountForSeed();
      const corners = shuffledTowerCorners();
      let placed = 0;
      for (const corner of corners) {
        if (placed >= count) break;
        if (placeTowerNearCorner(cells, corner)) placed++;
      }
    }
    function orientGeneratedTowers(cells) {
      for (let index = 0; index < cells.length; index++) {
        if (!cells[index] || !isTowerObjectId(cells[index].object)) continue;
        cells[index].doorSide = towerDoorSideFor(cells, index);
      }
    }
    function cropPlotAnchor(cells) {
      const preferred = archetypeKey === 'river'
        ? nearestWaterEdgePair(cells)
        : null;
      if (preferred && preferred.land >= 0) return preferred.land;
      const targetX = archetypeKey === 'pastoral' ? size * 0.36 : size * 0.32;
      const targetY = archetypeKey === 'pastoral' ? size * 0.58 : size * 0.62;
      return nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', targetX, targetY);
    }
    function chebyshevDistanceBetweenIndexes(a, b) {
      const pa = xyFor(a);
      const pb = xyFor(b);
      return Math.max(Math.abs(pa.x - pb.x), Math.abs(pa.y - pb.y));
    }
    function isMainHabitationObject(objectId) {
      return objectId === 'house' || objectId === 'manor';
    }
    function hasMainHabitationTooClose(cells, index) {
      for (let i = 0; i < cells.length; i++) {
        if (!cells[i] || !isMainHabitationObject(cells[i].object)) continue;
        if (chebyshevDistanceBetweenIndexes(index, i) <= 1) return true;
      }
      return false;
    }
    function clearGeneratedFoodAreaObjects(cells) {
      for (let index = 0; index < cells.length; index++) {
        const cell = cells[index];
        if (!cell || (!isCropObjectId(cell.object) && cell.object !== 'garden')) continue;
        cell.object = null;
        cell.footprint = null;
        cell.footprintParent = null;
        cell.fenceEdges = null;
        cell.fenceGatePath = false;
        cell.fenceGateSides = null;
        if (cell.motif === 'economy-food' || cell.motif === 'crop-plot') cell.motif = null;
      }
    }
    function cropObjectIdsForArchetype() {
      return archetypeKey === 'pastoral'
        ? ['wheat', 'corn', 'crop', 'sunflower', 'pumpkin']
        : archetypeKey === 'river'
          ? ['crop', 'wheat', 'carrot', 'flower']
          : ['crop', 'wheat', 'corn', 'pumpkin', 'carrot'];
    }
    function squareFoodPlotCandidates(cells, anchor, targetCount, options = {}) {
      if (anchor < 0) return [];
      const center = xyFor(anchor);
      const target = Math.max(1, Math.floor(targetCount || 1));
      function candidateAllowed(index) {
        if (index < 0) return false;
        const cell = cells[index];
        const foodObject = cell && (isCropObjectId(cell.object) || cell.object === 'garden');
        if (!cell || cell.terrain === 'water' || (cell.object && !(options.allowFoodObjects && foodObject)) || (cell.fenceGatePath && !options.allowFoodObjects) || (isProtectedEconomyCell(cell) && !(options.allowFoodObjects && foodObject))) return false;
        if (options.avoidMainHabitation && hasMainHabitationTooClose(cells, index)) return false;
        return true;
      }
      function plotSort(order) {
        return (a, b) => {
          const orderA = order.has(a) ? order.get(a) : 10000;
          const orderB = order.has(b) ? order.get(b) : 10000;
          if (orderA !== orderB) return orderA - orderB;
          const ca = xyFor(a);
          const cb = xyFor(b);
          const da = Math.max(Math.abs(ca.x - center.x), Math.abs(ca.y - center.y)) + distanceBetweenIndexes(a, anchor) * 0.08 + cellRand(a, 'food-square') * 0.05;
          const db = Math.max(Math.abs(cb.x - center.x), Math.abs(cb.y - center.y)) + distanceBetweenIndexes(b, anchor) * 0.08 + cellRand(b, 'food-square') * 0.05;
          return da - db;
        };
      }
      if (options.noFallback) {
        let best = [];
        let bestOrder = new Map();
        for (let side = Math.max(2, Math.ceil(Math.sqrt(target))); side <= Math.min(size, Math.max(2, Math.ceil(Math.sqrt(target)) + 3)); side++) {
          const local = [];
          const localOrder = new Map();
          const startX = clampIntLocal(Math.round(center.x - (side - 1) / 2), 0, Math.max(0, size - side), 0);
          const startY = clampIntLocal(Math.round(center.y - (side - 1) / 2), 0, Math.max(0, size - side), 0);
          for (let y = startY; y < startY + side; y++) {
            for (let x = startX; x < startX + side; x++) {
              const index = indexFor(x, y);
              if (!localOrder.has(index)) localOrder.set(index, localOrder.size);
              if (candidateAllowed(index)) local.push(index);
            }
          }
          if (local.length >= target) return local.sort(plotSort(localOrder));
          if (local.length > best.length) {
            best = local;
            bestOrder = localOrder;
          }
        }
        return best.sort(plotSort(bestOrder));
      }
      const seen = new Set();
      const squareOrder = new Map();
      const out = [];
      function consider(index) {
        if (index < 0 || seen.has(index)) return;
        seen.add(index);
        if (!candidateAllowed(index)) return;
        out.push(index);
      }
      for (let side = Math.max(2, Math.ceil(Math.sqrt(target))); side <= Math.min(size, Math.max(2, Math.ceil(Math.sqrt(target)) + 3)); side++) {
        const startX = clampIntLocal(Math.round(center.x - (side - 1) / 2), 0, Math.max(0, size - side), 0);
        const startY = clampIntLocal(Math.round(center.y - (side - 1) / 2), 0, Math.max(0, size - side), 0);
        for (let y = startY; y < startY + side; y++) {
          for (let x = startX; x < startX + side; x++) {
            const index = indexFor(x, y);
            if (!squareOrder.has(index)) squareOrder.set(index, squareOrder.size);
            consider(index);
          }
        }
        if (out.length >= target) break;
      }
      if (out.length < target && !options.noFallback) {
        for (const index of featureIndexesNear(anchor, Math.max(2, Math.floor(size * 0.28)))) consider(index);
      }
      return out.sort((a, b) => {
        return plotSort(squareOrder)(a, b);
      });
    }
    function bestSquareFoodPlotAnchor(cells, targetCount) {
      const preferred = cropPlotAnchor(cells);
      if (preferred < 0) return -1;
      const target = Math.max(1, Math.floor(targetCount || 1));
      const minimum = Math.min(target, 4);
      const candidates = featureIndexesNear(preferred, Math.max(2, Math.floor(size * 0.34)))
        .filter(index => cells[index] && cells[index].terrain !== 'water' && !hasMainHabitationTooClose(cells, index))
        .sort((a, b) => distanceBetweenIndexes(a, preferred) - distanceBetweenIndexes(b, preferred) + cellRand(a, 'food-anchor-square') * 0.08);
      for (const index of candidates) {
        if (squareFoodPlotCandidates(cells, index, target, { avoidMainHabitation: true, allowFoodObjects: true, noFallback: true }).length >= minimum) return index;
      }
      return preferred;
    }
    function consolidateGeneratedCropPlot(cells) {
      const existing = cells
        .map((cell, index) => ({ cell, index }))
        .filter(({ cell }) => cell && isCropObjectId(cell.object));
      if (existing.length < 4) return 0;
      const cropIds = cropObjectIdsForArchetype();
      const target = existing.length;
      const anchor = bestSquareFoodPlotAnchor(cells, target);
      if (anchor < 0) return 0;
      const plot = squareFoodPlotCandidates(cells, anchor, target, { avoidMainHabitation: true, allowFoodObjects: true, noFallback: true }).slice(0, target);
      if (plot.length < Math.min(target, 4)) return 0;
      clearGeneratedFoodAreaObjects(cells);
      const placedPlot = [];
      for (let i = 0; i < plot.length; i++) {
        const index = plot[i];
        if (!setFeatureTerrain(cells, index, 'dirt')) continue;
        if (forcePlaceObject(cells, index, cropIds[i % cropIds.length], 'dirt')) {
          cells[index].motif = 'crop-plot';
          placedPlot.push(index);
        }
      }
      connectFeatureToPath(cells, anchor);
      applyGeneratedFenceEnclosure(cells, placedPlot, { level: 1, style: 'garden' });
      return placedPlot.length;
    }
    function applyCropPlotMotif(cells) {
      clearGeneratedFoodAreaObjects(cells);
      const anchor = cropPlotAnchor(cells);
      if (anchor < 0) return false;
      const cropIds = cropObjectIdsForArchetype();
      const targetPlot = Math.max(4, Math.min(6, Math.ceil(size * 0.55)));
      const plot = squareFoodPlotCandidates(cells, anchor, targetPlot, { avoidMainHabitation: true }).slice(0, targetPlot);
      const placedPlot = [];
      for (let i = 0; i < plot.length; i++) {
        const index = plot[i];
        if (!setFeatureTerrain(cells, index, 'dirt')) continue;
        if (forcePlaceObject(cells, index, cropIds[i % cropIds.length], 'dirt')) {
          cells[index].motif = 'crop-plot';
          placedPlot.push(index);
        }
      }
      connectFeatureToPath(cells, anchor);
      applyGeneratedFenceEnclosure(cells, placedPlot, { level: 1, style: 'garden' });
      return placedPlot.length > 0;
    }
    function animalPenAnchor(cells) {
      return nearestFeatureIndex(
        cells,
        cell => cell && cell.terrain !== 'water',
        archetypeKey === 'pastoral' ? size * 0.65 : size * 0.72,
        archetypeKey === 'pastoral' ? size * 0.42 : size * 0.58
      );
    }
    function applyAnimalPenMotif(cells) {
      clearObjectsWhere(cells, objectId => isAnimalObjectId(objectId));
      const anchor = animalPenAnchor(cells);
      if (anchor < 0) return false;
      const herd = featureIndexesNear(anchor, 1)
        .filter(index => cells[index] && cells[index].terrain !== 'water')
        .slice(0, Math.max(3, Math.min(5, Math.ceil(size * 0.42))));
      const placedHerd = [];
      const targetHerd = Math.max(3, Math.min(5, Math.ceil(size * 0.42)));
      for (let i = 0; i < herd.length; i++) {
        const index = herd[i];
        if (!setFeatureTerrain(cells, index, 'prairie')) continue;
        if (forcePlaceObject(cells, index, i % 2 ? 'cow' : 'sheep', 'prairie')) {
          cells[index].motif = 'animal-pen';
          placedHerd.push(index);
        }
      }
      if (placedHerd.length < targetHerd) {
        const extraHerd = featureIndexesNear(anchor, Math.max(2, Math.floor(size * 0.22)))
          .filter(index => cells[index] && cells[index].terrain !== 'water' && !cells[index].object && !cells[index].fenceGatePath && !isProtectedEconomyCell(cells[index]));
        for (const index of extraHerd) {
          if (placedHerd.length >= targetHerd) break;
          if (!setFeatureTerrain(cells, index, 'prairie')) continue;
          if (forcePlaceObject(cells, index, placedHerd.length % 2 ? 'cow' : 'sheep', 'prairie')) {
            cells[index].motif = 'animal-pen';
            placedHerd.push(index);
          }
        }
      }
      connectFeatureToPath(cells, anchor);
      applyGeneratedFenceEnclosure(cells, placedHerd, { level: 2, style: 'wood' });
      return placedHerd.length > 0;
    }
    function offsetIndex(index, dx, dy) {
      const point = xyFor(index);
      const x = point.x + dx;
      const y = point.y + dy;
      return inBounds(x, y) ? indexFor(x, y) : -1;
    }
    function applySettlementBlockMotif(cells) {
      if (archetypeKey !== 'village') return false;
      clearObjectsWhere(cells, objectId => objectId === 'house' || objectId === 'manor');
      const anchor = nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', (size - 1) / 2, (size - 1) / 2);
      if (anchor < 0) return false;
      const plaza = featureIndexesNear(anchor, 1).filter(index => cells[index] && cells[index].terrain !== 'water').slice(0, Math.max(4, Math.floor(size * 0.5)));
      plaza.forEach(index => setFeatureTerrain(cells, index, 'path'));
      const houseOffsets = [[-1, -2], [0, -2], [1, -2], [-2, -1], [-2, 0]];
      let houses = 0;
      for (const [dx, dy] of houseOffsets) {
        const index = offsetIndex(anchor, dx, dy);
        if (index < 0 || !cells[index] || cells[index].terrain === 'water') continue;
        if (forcePlaceObject(cells, index, 'house', 'grass')) {
          cells[index].motif = 'settlement-block';
          houses++;
        }
        if (houses >= Math.max(3, Math.floor(size * 0.42))) break;
      }
      const manorOffsets = [[2, 1], [2, -1], [-1, 2], [1, 2]];
      for (const [dx, dy] of manorOffsets) {
        const index = offsetIndex(anchor, dx, dy);
        if (index < 0 || !cells[index] || cells[index].terrain === 'water') continue;
        if (forcePlaceObject(cells, index, 'manor', 'grass')) {
          cells[index].motif = 'settlement-block';
          break;
        }
      }
      plaza.slice(0, 2).forEach(index => {
        if (cells[index] && !cells[index].object) forcePlaceObject(cells, index, 'lamp', 'path');
      });
      return houses > 0;
    }
    function applyPathsideHomeMotif(cells) {
      if (archetypeKey !== 'river' && archetypeKey !== 'harbor') return false;
      if (cells.some(cell => cell && (cell.object === 'house' || cell.object === 'manor'))) return false;
      const paths = cells
        .map((cell, index) => ({ cell, index }))
        .filter(({ cell }) => cell && cell.terrain === 'path')
        .sort((a, b) => {
          const ca = xyFor(a.index);
          const cb = xyFor(b.index);
          const center = (size - 1) / 2;
          const da = Math.abs(ca.x - center) + Math.abs(ca.y - center) + rng() * 0.2;
          const db = Math.abs(cb.x - center) + Math.abs(cb.y - center) + rng() * 0.2;
          return da - db;
        });
      for (const { index } of paths) {
        const home = openNeighborForPath(cells, index);
        if (home >= 0 && forcePlaceObject(cells, home, 'house', 'grass')) {
          cells[home].motif = 'pathside-home';
          return true;
        }
      }
      return false;
    }
    function applyGroveMotif(cells) {
      if (archetypeKey !== 'forest' && archetypeKey !== 'ruins') return false;
      clearObjectsWhere(cells, objectId => objectId === 'tree' || objectId === 'berries');
      const anchor = nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', size * 0.28, size * 0.3);
      if (anchor < 0) return false;
      const grove = featureIndexesNear(anchor, Math.max(1, Math.floor(size * 0.16)))
        .filter(index => cells[index] && cells[index].terrain !== 'water')
        .slice(0, Math.max(5, Math.floor(size * 0.8)));
      for (let i = 0; i < grove.length; i++) {
        const index = grove[i];
        if (!setFeatureTerrain(cells, index, i % 4 === 0 ? 'dirt' : 'grass')) continue;
        if (forcePlaceObject(cells, index, i % 4 === 0 ? 'berries' : i % 5 === 0 ? 'flower' : 'tree', cells[index].terrain)) cells[index].motif = 'grove';
      }
      connectFeatureToPath(cells, anchor);
      return grove.length > 0;
    }
    function applyQuarrySeamMotif(cells) {
      if (archetypeKey !== 'quarry' && archetypeKey !== 'fortress') return false;
      clearObjectsWhere(cells, objectId => objectId === 'stone' || objectId === 'ore' || objectId === 'crystal');
      const anchor = nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', size * 0.65, size * 0.35);
      if (anchor < 0) return false;
      const seam = paintTerrainWalk(cells, anchor, rng() < 0.45 ? 'cliff' : 'stone', Math.max(5, Math.floor(size * 0.78)), { turnChance: 0.34 });
      for (let i = 0; i < seam.length; i++) {
        const index = seam[i];
        if (forcePlaceObject(cells, index, i % 4 === 0 ? 'crystal' : i % 3 === 0 ? 'ore' : 'stone', cells[index].terrain)) cells[index].motif = 'quarry-seam';
      }
      connectFeatureToPath(cells, anchor);
      return seam.length > 0;
    }
    function applyRelicSiteMotif(cells) {
      if (archetypeKey !== 'ruins') return false;
      clearObjectsWhere(cells, objectId => isRelicObjectId(objectId) || objectId === 'crystal');
      const anchor = nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', size * 0.58, size * 0.48);
      if (anchor < 0) return false;
      const site = featureIndexesNear(anchor, 1).filter(index => cells[index] && cells[index].terrain !== 'water').slice(0, Math.max(5, Math.floor(size * 0.65)));
      for (let i = 0; i < site.length; i++) {
        const index = site[i];
        if (!setFeatureTerrain(cells, index, i % 3 === 0 ? 'stone' : 'dirt')) continue;
        if (forcePlaceObject(cells, index, i % 3 === 0 ? 'totem' : i % 3 === 1 ? 'ruins' : 'crystal', cells[index].terrain)) cells[index].motif = 'relic-site';
      }
      connectFeatureToPath(cells, anchor);
      return site.length > 0;
    }
    function connectBuildingsToPaths(cells) {
      for (let index = 0; index < cells.length; index++) {
        const cell = cells[index];
        if (!cell || (cell.object !== 'house' && cell.object !== 'manor')) continue;
        if (neighbors(index).some(next => cells[next] && cells[next].terrain === 'path')) continue;
        connectFeatureToPath(cells, index);
        if (!neighbors(index).some(next => cells[next] && cells[next].terrain === 'path')) cell.terrain = 'path';
      }
    }
    function economyTargetPoint(resourceId) {
      const center = (size - 1) / 2;
      if (resourceId === 'food') {
        if (archetypeKey === 'quarry' || archetypeKey === 'fortress') return { x: size * 0.28, y: size * 0.68 };
        if (archetypeKey === 'river' || archetypeKey === 'harbor') return { x: size * 0.38, y: size * 0.58 };
        return { x: size * 0.34, y: size * 0.62 };
      }
      if (resourceId === 'materials') {
        if (archetypeKey === 'forest') return { x: size * 0.25, y: size * 0.28 };
        return { x: size * 0.68, y: size * 0.35 };
      }
      if (resourceId === 'commerce') return { x: center, y: center };
      if (resourceId === 'defense') return { x: size * 0.78, y: size * 0.24 };
      if (resourceId === 'charm') return { x: size * 0.28, y: size * 0.32 };
      return { x: center, y: center };
    }
    function economyAnchorFor(cells, resourceId) {
      const target = economyTargetPoint(resourceId);
      return nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water' && !isProtectedEconomyCell(cell), target.x, target.y);
    }
    function nearbyHabitationIndex(cells, fromIndex, distance) {
      let best = -1;
      let bestScore = Infinity;
      for (const index of featureIndexesNear(fromIndex, distance)) {
        const objectId = cells[index] && cells[index].object;
        if (objectId !== 'house' && objectId !== 'manor') continue;
        const score = distanceBetweenIndexes(fromIndex, index) + cellRand(index, 'economy-home-near') * 0.2;
        if (score < bestScore) {
          best = index;
          bestScore = score;
        }
      }
      return best;
    }
    function ensureEconomyHomeNear(cells, anchor) {
      if (anchor < 0 || !cells[anchor]) return -1;
      const existing = nearbyHabitationIndex(cells, anchor, 3);
      if (existing >= 0) return existing;
      const candidates = featureIndexesNear(anchor, Math.max(2, Math.floor(size * 0.18)))
        .filter(index => cells[index] && cells[index].terrain !== 'water' && !cells[index].object && !isProtectedEconomyCell(cells[index]))
        .sort((a, b) => distanceBetweenIndexes(anchor, a) - distanceBetweenIndexes(anchor, b) + cellRand(a, 'economy-home') * 0.2);
      for (const index of candidates) {
        if (forcePlaceObject(cells, index, 'house', cells[index].terrain === 'path' ? 'path' : 'grass')) {
          markEconomyCell(cells, index, 'commerce');
          connectFeatureToPath(cells, index);
          return index;
        }
      }
      return -1;
    }
    function economyPlacementCandidates(cells, anchor, radius, options = {}) {
      const preferredHome = options.homeIndex == null ? -1 : options.homeIndex;
      return featureIndexesNear(anchor, radius)
        .filter(index => {
          const cell = cells[index];
          if (!cell || cell.terrain === 'water' || cell.object || isProtectedEconomyCell(cell)) return false;
          if (preferredHome >= 0 && options.nearHome !== false && distanceBetweenIndexes(index, preferredHome) > (options.homeDistance || 3)) return false;
          return true;
        })
        .sort((a, b) => {
          const homeBiasA = preferredHome >= 0 ? distanceBetweenIndexes(a, preferredHome) : 0;
          const homeBiasB = preferredHome >= 0 ? distanceBetweenIndexes(b, preferredHome) : 0;
          return homeBiasA - homeBiasB + distanceBetweenIndexes(a, anchor) - distanceBetweenIndexes(b, anchor) + cellRand(a, 'economy-candidate') * 0.2;
        });
    }
    function placeFoodEconomy(cells, target) {
      let need = Math.max(0, target - economyResourceCount(cells, 'food'));
      if (!need) return 0;
      const anchor = cropPlotAnchor(cells);
      if (anchor < 0) return 0;
      const home = ensureEconomyHomeNear(cells, anchor);
      const plotAnchorCandidates = featureIndexesNear(anchor, Math.max(2, Math.floor(size * 0.24)))
        .filter(index => cells[index] && cells[index].terrain !== 'water' && !cells[index].object && !isProtectedEconomyCell(cells[index]) && !hasMainHabitationTooClose(cells, index))
        .sort((a, b) => {
          const homeScoreA = home >= 0 ? Math.abs(distanceBetweenIndexes(a, home) - 2) * 0.25 : 0;
          const homeScoreB = home >= 0 ? Math.abs(distanceBetweenIndexes(b, home) - 2) * 0.25 : 0;
          const da = distanceBetweenIndexes(a, anchor) + homeScoreA + cellRand(a, 'food-plot-anchor') * 0.1;
          const db = distanceBetweenIndexes(b, anchor) + homeScoreB + cellRand(b, 'food-plot-anchor') * 0.1;
          return da - db;
        });
      const plotAnchor = plotAnchorCandidates[0] == null ? anchor : plotAnchorCandidates[0];
      const cropIds = cropObjectIdsForArchetype();
      let placed = 0;
      const placedFood = [];
      const squareCandidates = squareFoodPlotCandidates(cells, plotAnchor, need, { avoidMainHabitation: true });
      const fallbackCandidates = economyPlacementCandidates(cells, plotAnchor, Math.max(2, Math.floor(size * 0.26)), { homeIndex: home, homeDistance: 4 })
        .filter(index => !hasMainHabitationTooClose(cells, index));
      const candidates = squareCandidates.concat(fallbackCandidates.filter(index => squareCandidates.indexOf(index) === -1));
      for (const index of candidates) {
        if (placed >= need) break;
        if (!setFeatureTerrain(cells, index, 'dirt')) continue;
        if (!forcePlaceObject(cells, index, cropIds[placed % cropIds.length], 'dirt')) continue;
        markEconomyCell(cells, index, 'food');
        placedFood.push(index);
        placed++;
      }
      if (placed > 0) {
        connectFeatureToPath(cells, home >= 0 ? home : plotAnchor);
        applyGeneratedFenceEnclosure(cells, placedFood, { level: 1, style: 'garden' });
      }
      return placed;
    }
    function placeMaterialsEconomy(cells, target) {
      let need = Math.max(0, target - economyResourceCount(cells, 'materials'));
      if (!need) return 0;
      const anchor = economyAnchorFor(cells, 'materials');
      if (anchor < 0) return 0;
      const rocky = archetypeKey === 'quarry' || archetypeKey === 'fortress' || archetypeKey === 'ruins';
      const materialIds = rocky ? ['stone', 'ore', 'crystal', 'stone'] : ['tree', 'tree', 'berries', 'stone'];
      let placed = 0;
      for (const index of economyPlacementCandidates(cells, anchor, Math.max(2, Math.floor(size * 0.22)), { nearHome: false })) {
        if (placed >= need) break;
        const objectId = materialIds[placed % materialIds.length];
        const terrain = rocky || objectId === 'stone' || objectId === 'ore' || objectId === 'crystal' ? 'stone' : 'grass';
        if (!setFeatureTerrain(cells, index, terrain)) continue;
        if (!forcePlaceObject(cells, index, objectId, terrain)) continue;
        markEconomyCell(cells, index, 'materials');
        placed++;
      }
      if (placed > 0) connectFeatureToPath(cells, anchor);
      return placed;
    }
    function placeCommerceEconomy(cells, target) {
      let need = Math.max(0, target - economyResourceCount(cells, 'commerce'));
      if (!need) return 0;
      const anchor = economyAnchorFor(cells, 'commerce');
      if (anchor < 0) return 0;
      let placed = 0;
      const paths = featureIndexesNear(anchor, Math.max(2, Math.floor(size * 0.22)))
        .filter(index => cells[index] && cells[index].terrain === 'path' && !cells[index].object && !isProtectedEconomyCell(cells[index]));
      for (const index of paths) {
        if (placed >= need) break;
        if (!forcePlaceObject(cells, index, 'lamp', 'path')) continue;
        markEconomyCell(cells, index, 'commerce');
        placed++;
      }
      need = Math.max(0, target - economyResourceCount(cells, 'commerce'));
      let placedHouses = 0;
      for (const index of economyPlacementCandidates(cells, anchor, Math.max(2, Math.floor(size * 0.24)), { nearHome: false })) {
        if (placedHouses >= need) break;
        if (!forcePlaceObject(cells, index, 'house', cells[index].terrain === 'path' ? 'path' : 'grass')) continue;
        markEconomyCell(cells, index, 'commerce');
        connectFeatureToPath(cells, index);
        placedHouses++;
      }
      return placed + placedHouses;
    }
    function placeDefenseEconomy(cells, target) {
      let need = Math.max(0, target - economyResourceCount(cells, 'defense'));
      if (!need) return 0;
      const anchor = economyAnchorFor(cells, 'defense');
      if (anchor < 0) return 0;
      let placed = 0;
      for (const index of economyPlacementCandidates(cells, anchor, Math.max(2, Math.floor(size * 0.26)), { nearHome: false })) {
        if (placed >= need) break;
        if (!forcePlaceObject(cells, index, 'totem', 'grass')) continue;
        markEconomyCell(cells, index, 'defense');
        placed++;
      }
      return placed;
    }
    function placeCharmEconomy(cells, target) {
      let need = Math.max(0, target - economyResourceCount(cells, 'charm'));
      if (!need) return 0;
      const anchor = economyAnchorFor(cells, 'charm');
      if (anchor < 0) return 0;
      const charmIds = archetypeKey === 'quarry' || archetypeKey === 'fortress'
        ? ['flower', 'crystal', 'flower', 'tree']
        : archetypeKey === 'ruins'
          ? ['flower', 'totem', 'berries', 'tree']
          : ['flower', 'berries', 'tree', 'flower'];
      let placed = 0;
      for (const index of economyPlacementCandidates(cells, anchor, Math.max(2, Math.floor(size * 0.24)), { nearHome: false })) {
        if (placed >= need) break;
        const objectId = charmIds[placed % charmIds.length];
        const terrain = objectId === 'crystal' || objectId === 'totem' ? 'stone' : 'grass';
        if (!setFeatureTerrain(cells, index, terrain)) continue;
        if (!forcePlaceObject(cells, index, objectId, terrain)) continue;
        markEconomyCell(cells, index, 'charm');
        placed++;
      }
      return placed;
    }
    function applyEconomyResourcePass(cells, resourceId, target) {
      if (resourceId === 'food') return placeFoodEconomy(cells, target);
      if (resourceId === 'materials') return placeMaterialsEconomy(cells, target);
      if (resourceId === 'commerce') return placeCommerceEconomy(cells, target);
      if (resourceId === 'defense') return placeDefenseEconomy(cells, target);
      if (resourceId === 'charm') return placeCharmEconomy(cells, target);
      return 0;
    }
    function applyEconomyViabilityPass(cells) {
      for (const resourceId of economyResourceIds) {
        applyEconomyResourcePass(cells, resourceId, economyTargetFor(resourceId));
      }
      connectBuildingsToPaths(cells);
    }
    function validateEconomyFloors(cells) {
      for (const resourceId of economyResourceIds) {
        applyEconomyResourcePass(cells, resourceId, economyBandFor(resourceId).min);
      }
      connectBuildingsToPaths(cells);
    }
    function applyArchetypeResourcePolish(cells) {
      applyCornerTowerMotif(cells);
      applySettlementBlockMotif(cells);
      if (['pastoral', 'river', 'village', 'harbor'].indexOf(archetypeKey) !== -1) applyCropPlotMotif(cells);
      if (archetypeKey === 'pastoral' || (archetypeKey === 'river' && rng() < 0.45)) applyAnimalPenMotif(cells);
      applyPathsideHomeMotif(cells);
      applyGroveMotif(cells);
      applyQuarrySeamMotif(cells);
      applyRelicSiteMotif(cells);
      connectBuildingsToPaths(cells);
    }

    function waterChannelUnderBridge(cells, index, axis) {
      if (!cells[index] || cells[index].terrain !== 'water') return false;
      const { x, y } = xyFor(index);
      if (axis === 'x') {
        return inBounds(x, y - 1) && inBounds(x, y + 1)
          && cells[indexFor(x, y - 1)].terrain === 'water'
          && cells[indexFor(x, y + 1)].terrain === 'water';
      }
      return inBounds(x - 1, y) && inBounds(x + 1, y)
        && cells[indexFor(x - 1, y)].terrain === 'water'
        && cells[indexFor(x + 1, y)].terrain === 'water';
    }
    function waterCrossingBanks(cells, index, requireChannel = false) {
      if (!cells[index] || cells[index].terrain !== 'water') return null;
      const { x, y } = xyFor(index);
      if (inBounds(x - 1, y) && inBounds(x + 1, y)) {
        const west = indexFor(x - 1, y);
        const east = indexFor(x + 1, y);
        if (cells[west].terrain !== 'water' && cells[east].terrain !== 'water' && (!requireChannel || waterChannelUnderBridge(cells, index, 'x'))) {
          return { axis: 'x', a: west, b: east };
        }
      }
      if (inBounds(x, y - 1) && inBounds(x, y + 1)) {
        const north = indexFor(x, y - 1);
        const south = indexFor(x, y + 1);
        if (cells[north].terrain !== 'water' && cells[south].terrain !== 'water' && (!requireChannel || waterChannelUnderBridge(cells, index, 'z'))) {
          return { axis: 'z', a: north, b: south };
        }
      }
      return null;
    }
    function waterRoadBridgeAxis(cells, index) {
      const banks = waterCrossingBanks(cells, index, true);
      if (!banks) return null;
      if (cells[banks.a].terrain === 'path' && cells[banks.b].terrain === 'path') return banks.axis;
      return null;
    }
    function setPathBank(cells, index) {
      if (!cells[index] || cells[index].terrain === 'water') return;
      setFeatureTerrain(cells, index, 'path');
    }
    function extendRoadAwayFromWater(cells, waterIndex, bankIndex) {
      if (!cells[waterIndex] || !cells[bankIndex]) return;
      const water = xyFor(waterIndex);
      const bank = xyFor(bankIndex);
      const dx = Math.sign(bank.x - water.x);
      const dy = Math.sign(bank.y - water.y);
      const nextX = bank.x + dx;
      const nextY = bank.y + dy;
      if (!inBounds(nextX, nextY)) return;
      const nextIndex = indexFor(nextX, nextY);
      if (cells[nextIndex] && cells[nextIndex].terrain !== 'water') setFeatureTerrain(cells, nextIndex, 'path');
    }
    function prepareRoadBridge(cells, waterIndex) {
      const banks = waterCrossingBanks(cells, waterIndex, true);
      if (!banks) return null;
      setPathBank(cells, banks.a);
      setPathBank(cells, banks.b);
      extendRoadAwayFromWater(cells, waterIndex, banks.a);
      extendRoadAwayFromWater(cells, waterIndex, banks.b);
      return banks;
    }
    function clearGeneratedObject(cells, index) {
      if (!cells[index]) return;
      if (isProtectedEconomyCell(cells[index])) return false;
      cells[index].object = null;
      cells[index].footprint = null;
      cells[index].footprintParent = null;
      cells[index].fenceEdges = null;
      cells[index].fenceGatePath = false;
      cells[index].fenceGateSides = null;
      return true;
    }
    function placeRoadBridgeAt(cells, index) {
      if (!waterRoadBridgeAxis(cells, index)) return false;
      clearGeneratedObject(cells, index);
      return placeObjectAt(cells, index, 'water-bridge');
    }
    function placeBridgeCandidates(cells, forceChance) {
      for (let index = 0; index < cells.length; index++) {
        if (cells[index].terrain !== 'water') continue;
        if (waterRoadBridgeAxis(cells, index) && rng() < forceChance) placeRoadBridgeAt(cells, index);
      }
    }
    function bridgeChannelPlan(centerIndex, axis) {
      const { x, y } = xyFor(centerIndex);
      if (axis === 'x') {
        if (!inBounds(x - 1, y) || !inBounds(x + 1, y) || !inBounds(x, y - 1) || !inBounds(x, y + 1)) return null;
        return {
          water: [centerIndex, indexFor(x, y - 1), indexFor(x, y + 1)],
          path: [indexFor(x - 1, y), indexFor(x + 1, y)],
        };
      }
      if (!inBounds(x, y - 1) || !inBounds(x, y + 1) || !inBounds(x - 1, y) || !inBounds(x + 1, y)) return null;
      return {
        water: [centerIndex, indexFor(x - 1, y), indexFor(x + 1, y)],
        path: [indexFor(x, y - 1), indexFor(x, y + 1)],
      };
    }
    function bridgePlanClearable(cells, plan) {
      if (!plan) return false;
      return plan.water.concat(plan.path).every(index => {
        const objectId = cells[index] && cells[index].object;
        return cells[index] && !isProtectedEconomyCell(cells[index]) && (!objectId || (!isBuildingObjectId(objectId) && objectId !== 'bridge' && objectId !== 'water-bridge'));
      });
    }
    function ensureRoadBridgeCrossing(cells) {
      if (archetypeKey !== 'river' && archetypeKey !== 'harbor') return false;
      const existing = firstFeatureWaterCrossing(cells);
      if (existing >= 0) {
        const banks = prepareRoadBridge(cells, existing);
        if (banks) return placeRoadBridgeAt(cells, existing);
      }
      const center = (size - 1) / 2;
      const water = terrainCells(cells, 'water');
      const candidates = cells
        .map((cell, index) => ({ cell, index, point: xyFor(index) }))
        .filter(({ cell, point }) => cell && point.x > 0 && point.y > 0 && point.x < size - 1 && point.y < size - 1)
        .map(entry => {
          const nearestWater = water.reduce((best, waterIndex) => Math.min(best, distanceBetweenIndexes(entry.index, waterIndex)), size * 2);
          const centerScore = Math.abs(entry.point.x - center) + Math.abs(entry.point.y - center);
          return Object.assign(entry, { score: nearestWater * 2 + centerScore + rng() * 0.2 });
        })
        .sort((a, b) => a.score - b.score);
      for (const { index } of candidates) {
        const axes = rng() < 0.5 ? ['x', 'z'] : ['z', 'x'];
        for (const axis of axes) {
          const plan = bridgeChannelPlan(index, axis);
          if (!bridgePlanClearable(cells, plan)) continue;
          for (const waterIndex of plan.water) clearMotifCell(cells, waterIndex, 'water');
          for (const pathIndex of plan.path) setFeatureTerrain(cells, pathIndex, 'path');
          return placeRoadBridgeAt(cells, index);
        }
      }
      return false;
    }
    function forceClearBridgePlanCell(cells, index, terrain) {
      if (!cells[index]) return false;
      const objectId = cells[index].object;
      if (objectId && (isBuildingObjectId(objectId) || objectId === 'bridge' || objectId === 'water-bridge')) return false;
      cells[index].terrain = terrain;
      cells[index].object = null;
      cells[index].footprint = null;
      cells[index].footprintParent = null;
      cells[index].fenceEdges = null;
      cells[index].fenceGatePath = false;
      cells[index].fenceGateSides = null;
      cells[index].motif = null;
      return true;
    }
    function forceRoadBridgeCrossing(cells) {
      if (archetypeKey !== 'river' && archetypeKey !== 'harbor') return false;
      if (cells.some(cell => cell && cell.object === 'water-bridge')) return true;
      const center = (size - 1) / 2;
      const candidates = cells
        .map((cell, index) => ({ cell, index, point: xyFor(index) }))
        .filter(({ cell, point }) => cell && point.x > 0 && point.y > 0 && point.x < size - 1 && point.y < size - 1)
        .sort((a, b) => {
          const da = Math.abs(a.point.x - center) + Math.abs(a.point.y - center) + cellRand(a.index, 'force-bridge') * 0.25;
          const db = Math.abs(b.point.x - center) + Math.abs(b.point.y - center) + cellRand(b.index, 'force-bridge') * 0.25;
          return da - db;
        });
      for (const { index } of candidates) {
        for (const axis of ['x', 'z']) {
          const plan = bridgeChannelPlan(index, axis);
          if (!plan) continue;
          const all = plan.water.concat(plan.path);
          if (all.some(cellIndex => {
            const objectId = cells[cellIndex] && cells[cellIndex].object;
            return !cells[cellIndex] || (objectId && (isBuildingObjectId(objectId) || objectId === 'bridge' || objectId === 'water-bridge'));
          })) continue;
          for (const waterIndex of plan.water) forceClearBridgePlanCell(cells, waterIndex, 'water');
          for (const pathIndex of plan.path) forceClearBridgePlanCell(cells, pathIndex, 'path');
          if (placeRoadBridgeAt(cells, index)) return true;
        }
      }
      return false;
    }
    function scrubInvalidWaterBridges(cells) {
      for (let index = 0; index < cells.length; index++) {
        if (!cells[index] || cells[index].object !== 'water-bridge') continue;
        if (!waterRoadBridgeAxis(cells, index)) clearGeneratedObject(cells, index);
      }
    }

    function featureIndexesNear(centerIndex, radius) {
      const center = xyFor(centerIndex);
      const out = [];
      for (let y = center.y - radius; y <= center.y + radius; y++) {
        for (let x = center.x - radius; x <= center.x + radius; x++) {
          if (!inBounds(x, y)) continue;
          const distance = Math.abs(x - center.x) + Math.abs(y - center.y);
          if (distance <= radius + 1) out.push(indexFor(x, y));
        }
      }
      return out.sort((a, b) => {
        const ca = xyFor(a);
        const cb = xyFor(b);
        const da = Math.abs(ca.x - center.x) + Math.abs(ca.y - center.y) + rng() * 0.2;
        const db = Math.abs(cb.x - center.x) + Math.abs(cb.y - center.y) + rng() * 0.2;
        return da - db;
      });
    }
    function featureRingIndexes(centerIndex, radius) {
      const center = xyFor(centerIndex);
      const out = [];
      for (let y = center.y - radius; y <= center.y + radius; y++) {
        for (let x = center.x - radius; x <= center.x + radius; x++) {
          if (!inBounds(x, y)) continue;
          if (Math.max(Math.abs(x - center.x), Math.abs(y - center.y)) !== radius) continue;
          out.push(indexFor(x, y));
        }
      }
      return out.sort(() => rng() - 0.5);
    }
    function nearestFeatureIndex(cells, predicate, targetX, targetY) {
      let best = -1;
      let bestScore = Infinity;
      for (let index = 0; index < cells.length; index++) {
        if (!predicate(cells[index], index)) continue;
        const { x, y } = xyFor(index);
        const score = Math.abs(x - targetX) + Math.abs(y - targetY) + rng() * 0.45;
        if (score < bestScore) {
          best = index;
          bestScore = score;
        }
      }
      return best;
    }
    function setFeatureTerrain(cells, index, terrain) {
      if (!cells[index]) return;
      if (isProtectedEconomyCell(cells[index])) return false;
      cells[index].terrain = terrain;
      cells[index].object = null;
      cells[index].footprint = null;
      cells[index].footprintParent = null;
      cells[index].fenceEdges = null;
      cells[index].fenceGatePath = false;
      cells[index].fenceGateSides = null;
      return true;
    }
    function forcePlaceObject(cells, index, objectId, preferredTerrain) {
      const object = objectById.get(objectId);
      if (!object || object.hidden || !cells[index]) return false;
      const terrain = preferredTerrain && object.allowed.indexOf(preferredTerrain) !== -1
        ? preferredTerrain
        : object.allowed.indexOf(cells[index].terrain) !== -1
          ? cells[index].terrain
          : object.allowed[0];
      if (!terrain) return false;
      const footprint = object.footprint || { w: 1, h: 1 };
      function prepare(cellIndex) {
        if (!cells[cellIndex]) return false;
        if (isProtectedEconomyCell(cells[cellIndex])) return false;
        cells[cellIndex].terrain = terrain;
        cells[cellIndex].object = null;
        cells[cellIndex].footprint = null;
        cells[cellIndex].footprintParent = null;
        cells[cellIndex].fenceEdges = null;
        cells[cellIndex].fenceGatePath = false;
        cells[cellIndex].fenceGateSides = null;
        return true;
      }
      if (footprint.w === 2 && footprint.h === 1) {
        const { x, y } = xyFor(index);
        const pairs = [
          [index, inBounds(x + 1, y) ? indexFor(x + 1, y) : -1],
          [inBounds(x - 1, y) ? indexFor(x - 1, y) : -1, index],
        ];
        for (const pair of pairs) {
          if (pair.some(cellIndex => cellIndex < 0 || !cells[cellIndex])) continue;
          if (pair.some(cellIndex => isProtectedEconomyCell(cells[cellIndex]))) continue;
          pair.forEach(prepare);
          if (placeObjectAt(cells, index, objectId)) return true;
        }
        return false;
      }
      if (!prepare(index)) return false;
      return placeObjectAt(cells, index, objectId);
    }
    function carveFeaturePath(cells, startIndex, endIndex) {
      if (startIndex < 0 || endIndex < 0) return;
      let { x, y } = xyFor(startIndex);
      const end = xyFor(endIndex);
      const waterCrossings = [];
      let guard = 0;
      while ((x !== end.x || y !== end.y) && guard < size * 4) {
        guard++;
        const index = indexFor(x, y);
        if (cells[index].terrain === 'water') waterCrossings.push(index);
        else setFeatureTerrain(cells, index, 'path');
        if (x !== end.x && (rng() < 0.58 || y === end.y)) x += Math.sign(end.x - x);
        else if (y !== end.y) y += Math.sign(end.y - y);
      }
      const endCell = cells[endIndex];
      if (endCell && endCell.terrain !== 'water') setFeatureTerrain(cells, endIndex, 'path');
      for (const index of waterCrossings) placeRoadBridgeAt(cells, index);
    }
    function firstFeatureWaterCrossing(cells) {
      for (let index = 0; index < cells.length; index++) {
        if (waterCrossingBanks(cells, index, true)) return index;
      }
      return -1;
    }
    function nearestWaterEdgePair(cells) {
      const center = (size - 1) / 2;
      let best = null;
      let bestScore = Infinity;
      for (let index = 0; index < cells.length; index++) {
        if (cells[index].terrain !== 'water') continue;
        for (const landIndex of neighbors(index)) {
          if (!cells[landIndex] || cells[landIndex].terrain === 'water') continue;
          const { x, y } = xyFor(landIndex);
          const score = Math.abs(x - center) + Math.abs(y - center) + rng() * 0.35;
          if (score < bestScore) {
            best = { water: index, land: landIndex };
            bestScore = score;
          }
        }
      }
      return best;
    }
    function applyArchetypeGrammar(cells) {
      const centerTarget = (size - 1) / 2;
      const anchor = nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', centerTarget, centerTarget);
      if (anchor < 0) return;
      const radius = Math.max(1, Math.floor(size * 0.18));
      const broadRadius = Math.max(2, Math.floor(size * 0.25));

      function applyPastoral() {
        const meadow = featureIndexesNear(anchor, broadRadius).filter(index => cells[index].terrain !== 'water').slice(0, Math.max(7, size));
        for (const index of meadow) setFeatureTerrain(cells, index, rng() < 0.68 ? 'prairie' : 'dirt');
        const cropIds = ['wheat', 'corn', 'crop', 'sunflower'];
        const cropIndexes = [];
        const animalIndexes = [];
        meadow.slice(0, Math.max(3, Math.floor(size * 0.45))).forEach((index, i) => {
          if (forcePlaceObject(cells, index, cropIds[i % cropIds.length], cells[index].terrain)) cropIndexes.push(index);
        });
        meadow.slice(Math.max(3, Math.floor(size * 0.45)), Math.max(6, Math.floor(size * 0.8))).forEach((index, i) => {
          if (forcePlaceObject(cells, index, i % 2 ? 'cow' : 'sheep', 'prairie')) animalIndexes.push(index);
        });
        applyGeneratedFenceEnclosure(cells, cropIndexes, { level: 1, style: 'garden' });
        applyGeneratedFenceEnclosure(cells, animalIndexes, { level: 2, style: 'wood' });
        const house = nearestFeatureIndex(cells, (cell, index) => cell && cell.terrain !== 'water' && meadow.indexOf(index) === -1, 1, centerTarget);
        if (house >= 0) {
          forcePlaceObject(cells, house, 'house', 'grass');
          carveFeaturePath(cells, house, anchor);
        }
      }

      function applyForest() {
        const grove = featureIndexesNear(anchor, broadRadius).filter(index => cells[index].terrain !== 'water').slice(0, Math.max(8, Math.floor(size * 1.2)));
        for (const index of grove) setFeatureTerrain(cells, index, rng() < 0.76 ? 'grass' : 'dirt');
        const trailStart = nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', 0, size - 1);
        carveFeaturePath(cells, trailStart, anchor);
        grove.slice(0, Math.max(5, Math.floor(size * 0.75))).forEach(index => forcePlaceObject(cells, index, 'tree', cells[index].terrain));
        grove.slice(Math.max(5, Math.floor(size * 0.75))).forEach((index, i) => forcePlaceObject(cells, index, i % 3 === 0 ? 'flower' : 'berries', cells[index].terrain));
        const stone = grove.find(index => !cells[index].object);
        if (stone >= 0) forcePlaceObject(cells, stone, rng() < 0.35 ? 'crystal' : 'stone', rng() < 0.35 ? 'stone' : 'grass');
      }

      function applyQuarry() {
        const pit = featureIndexesNear(anchor, broadRadius).filter(index => cells[index].terrain !== 'water').slice(0, Math.max(8, Math.floor(size * 1.1)));
        for (const index of pit) setFeatureTerrain(cells, index, rng() < 0.45 ? 'cliff' : 'stone');
        const seam = [anchor];
        while (seam.length < Math.max(5, Math.floor(size * 0.75))) {
          const last = seam[seam.length - 1];
          const next = neighbors(last)
            .filter(index => cells[index] && cells[index].terrain !== 'water' && seam.indexOf(index) === -1)
            .sort((a, b) => {
              const ca = xyFor(a);
              const cb = xyFor(b);
              const center = xyFor(anchor);
              const da = Math.abs(ca.x - center.x) + Math.abs(ca.y - center.y) + rng() * 0.4;
              const db = Math.abs(cb.x - center.x) + Math.abs(cb.y - center.y) + rng() * 0.4;
              return da - db;
            })[0];
          if (typeof next !== 'number') break;
          seam.push(next);
        }
        const access = nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', 0, centerTarget);
        carveFeaturePath(cells, access, anchor);
        seam.forEach((index, i) => {
          setFeatureTerrain(cells, index, i % 2 ? 'stone' : 'cliff');
          forcePlaceObject(cells, index, i % 3 === 0 ? 'ore' : i % 4 === 0 ? 'crystal' : 'stone', cells[index].terrain);
        });
        const lookout = featureRingIndexes(anchor, Math.min(broadRadius, 3)).find(index => cells[index] && cells[index].terrain !== 'water');
        if (lookout >= 0) forcePlaceObject(cells, lookout, rng() < 0.55 ? 'spotlight' : 'stone', 'stone');
      }

      function applyRiver() {
        const bridge = firstFeatureWaterCrossing(cells);
        const banks = bridge >= 0 ? prepareRoadBridge(cells, bridge) : null;
        const pair = banks ? { water: bridge, land: banks.a } : nearestWaterEdgePair(cells);
        if (!pair || pair.land < 0) return;
        const bank = featureIndexesNear(pair.land, broadRadius).filter(index => cells[index].terrain !== 'water').slice(0, Math.max(7, size));
        bank.slice(0, Math.max(4, Math.floor(size * 0.65))).forEach((index, i) => {
          setFeatureTerrain(cells, index, i % 2 ? 'dirt' : 'prairie');
          forcePlaceObject(cells, index, i % 3 === 0 ? 'garden' : 'crop', cells[index].terrain);
        });
        const house = bank.find(index => !cells[index].object);
        if (house >= 0) forcePlaceObject(cells, house, 'house', 'grass');
        const lamp = bank.find(index => cells[index] && !cells[index].object);
        if (lamp >= 0) forcePlaceObject(cells, lamp, 'lamp', 'path');
        if (banks) {
          carveFeaturePath(cells, banks.a, anchor);
          setPathBank(cells, banks.a);
          setPathBank(cells, banks.b);
          placeRoadBridgeAt(cells, bridge);
        }
      }

      function applyVillage() {
        const plaza = featureIndexesNear(anchor, radius).filter(index => cells[index].terrain !== 'water');
        plaza.slice(0, Math.max(4, Math.floor(size * 0.45))).forEach(index => setFeatureTerrain(cells, index, 'path'));
        const roads = [
          nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', 0, centerTarget),
          nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', size - 1, centerTarget),
          nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', centerTarget, 0),
        ];
        roads.forEach(road => carveFeaturePath(cells, road, anchor));
        const lots = featureRingIndexes(anchor, Math.min(broadRadius, 3)).filter(index => cells[index] && cells[index].terrain !== 'water');
        lots.slice(0, Math.max(5, Math.floor(size * 0.75))).forEach((index, i) => forcePlaceObject(cells, index, i === 0 ? 'manor' : 'house', i % 2 ? 'grass' : 'path'));
        plaza.slice(0, 2).forEach(index => forcePlaceObject(cells, index, 'lamp', 'path'));
        lots.slice(Math.max(5, Math.floor(size * 0.75)), Math.max(8, size)).forEach((index, i) => forcePlaceObject(cells, index, i % 2 ? 'garden' : 'flower', 'grass'));
      }

      function applyFortress() {
        const keep = featureIndexesNear(anchor, radius).filter(index => cells[index].terrain !== 'water').slice(0, Math.max(4, Math.floor(size * 0.45)));
        keep.forEach(index => setFeatureTerrain(cells, index, rng() < 0.6 ? 'cliff' : 'stone'));
        keep.slice(0, 3).forEach((index, i) => forcePlaceObject(cells, index, i === 0 ? 'spotlight' : 'stone', cells[index].terrain));
        const wall = featureRingIndexes(anchor, Math.min(broadRadius, 3)).filter(index => cells[index] && cells[index].terrain !== 'water');
        wall.slice(0, Math.max(8, size)).forEach((index, i) => forcePlaceObject(cells, index, i % 5 === 0 ? 'spotlight' : 'stone', 'stone'));
        const gate = nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', centerTarget, size - 1);
        carveFeaturePath(cells, gate, anchor);
        const light = wall.find(index => cells[index] && !cells[index].object);
        if (light >= 0) forcePlaceObject(cells, light, 'spotlight', 'stone');
      }

      function applyRuins() {
        const site = featureIndexesNear(anchor, broadRadius).filter(index => cells[index].terrain !== 'water').slice(0, Math.max(8, size));
        site.forEach((index, i) => setFeatureTerrain(cells, index, i % 3 === 0 ? 'stone' : i % 3 === 1 ? 'dirt' : 'grass'));
        site.slice(0, Math.max(4, Math.floor(size * 0.6))).forEach((index, i) => forcePlaceObject(cells, index, i % 3 === 0 ? 'totem' : i % 3 === 1 ? 'ruins' : 'crystal', cells[index].terrain === 'dirt' ? 'grass' : cells[index].terrain));
        site.slice(Math.max(4, Math.floor(size * 0.6))).forEach((index, i) => forcePlaceObject(cells, index, i % 2 ? 'tree' : 'berries', cells[index].terrain));
        const entry = nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', size - 1, 0);
        carveFeaturePath(cells, entry, anchor);
      }

      function applyHarbor() {
        const bridge = firstFeatureWaterCrossing(cells);
        const banks = bridge >= 0 ? prepareRoadBridge(cells, bridge) : null;
        const pair = banks ? { water: bridge, land: banks.a } : nearestWaterEdgePair(cells);
        if (!pair) return;
        const shore = featureIndexesNear(pair.land, broadRadius).filter(index => cells[index].terrain !== 'water').slice(0, Math.max(7, size));
        shore.forEach((index, i) => setFeatureTerrain(cells, index, i < 3 ? 'path' : 'sand'));
        shore.slice(0, Math.max(3, Math.floor(size * 0.5))).forEach((index, i) => forcePlaceObject(cells, index, i % 2 ? 'lamp' : 'house', i % 2 ? 'path' : 'sand'));
        shore.slice(Math.max(3, Math.floor(size * 0.5)), Math.max(6, Math.floor(size * 0.9))).forEach((index, i) => forcePlaceObject(cells, index, i % 2 ? 'lamp' : 'garden', i % 2 ? 'path' : cells[index].terrain));
        const inland = nearestFeatureIndex(cells, cell => cell && cell.terrain !== 'water', centerTarget, centerTarget);
        carveFeaturePath(cells, pair.land, inland);
        if (banks) {
          setPathBank(cells, banks.a);
          setPathBank(cells, banks.b);
          placeRoadBridgeAt(cells, bridge);
        }
      }

      const appliers = {
        pastoral: applyPastoral,
        forest: applyForest,
        quarry: applyQuarry,
        river: applyRiver,
        village: applyVillage,
        fortress: applyFortress,
        ruins: applyRuins,
        harbor: applyHarbor,
      };
      if (appliers[archetypeKey]) appliers[archetypeKey]();
    }

    function placeObjects(cells) {
      function logicalObjectCount() {
        return cells.filter(cell => cell && cell.object && !/-wing$/.test(cell.object)).length;
      }
      const scatterLimit = Math.max(8, Math.ceil(size * (
        archetypeKey === 'village' ? 1.75
          : archetypeKey === 'fortress' ? 1.7
            : archetypeKey === 'pastoral' ? 1.9
              : archetypeKey === 'river' || archetypeKey === 'harbor' ? 1.6
                : 1.45
      )));
      let placedCount = logicalObjectCount();
      for (let index = 0; index < cells.length; index++) {
        const cell = cells[index];
        if (cell.object || cell.terrain === 'water') continue;
        if (cell.fenceGatePath) continue;
        if (placedCount >= scatterLimit) continue;
        const densityBoost = cell.terrain === 'path' ? 0.18 : 0;
        if (rng() > (featureDensity * 0.34 + densityBoost * 0.55)) continue;
        let objectId = null;
        for (let attempt = 0; attempt < 8; attempt++) {
          const candidate = weightedPick(archetypeDef.objects, rng, null);
          if (candidate && isScatterAccentObjectId(candidate) && placementIndexesFor(cells, index, candidate)) {
            objectId = candidate;
            break;
          }
        }
        if (objectId && placeObjectAt(cells, index, objectId)) placedCount++;
      }

      if (archetypeKey === 'village' || archetypeKey === 'fortress') {
        const pathCells = cells
          .map((cell, index) => ({ cell, index }))
          .filter(({ cell }) => cell.terrain === 'path' && !cell.object);
        let coreCount = cells.filter(cell => cell && ['house', 'manor', 'watchtower', 'castle'].indexOf(cell.object) !== -1).length;
        const coreLimit = archetypeKey === 'fortress'
          ? Math.max(5, Math.ceil(size * 0.8))
          : Math.max(6, Math.ceil(size * 0.95));
        for (const { index } of pathCells.slice(0, Math.ceil(size * 0.7))) {
          if (coreCount >= coreLimit || placedCount >= scatterLimit + 2) break;
          if (!cells[index].object && rng() < 0.75) {
            if (placeObjectAt(cells, index, 'house')) {
              coreCount++;
              placedCount++;
            }
          }
        }
      }

      if (archetypeKey === 'pastoral') {
        const meadowCells = cells
          .map((cell, index) => ({ cell, index }))
          .filter(({ cell, index }) => cell.terrain === 'prairie' && !cell.object && neighbors(index).some(next => hasGeneratedFenceEdges(cells[next])));
        const placedHerd = [];
        for (const { index } of meadowCells.slice(0, Math.max(3, Math.ceil(size * 0.38)))) {
          if (rng() < 0.82 && placeObjectAt(cells, index, rng() < 0.55 ? 'sheep' : 'cow')) placedHerd.push(index);
        }
        applyGeneratedFenceEnclosure(cells, placedHerd, { level: 2, style: 'wood' });
      }
    }

    function limitLampPlacements(cells) {
      const lampIndexes = cells
        .map((cell, index) => ({ cell, index }))
        .filter(({ cell }) => cell && cell.object === 'lamp')
        .sort((a, b) => {
          const ar = cellRand(a.index, 'lamp-limit');
          const br = cellRand(b.index, 'lamp-limit');
          return ar === br ? a.index - b.index : ar - br;
        });
      const kept = [];
      for (const { index } of lampIndexes) {
        const adjacent = kept.some(keptIndex => neighbors(index).indexOf(keptIndex) !== -1);
        if (!adjacent && kept.length < 2) {
          kept.push(index);
        } else if (cells[index]) {
          cells[index].object = null;
          cells[index].footprint = null;
          cells[index].footprintParent = null;
        }
      }
    }

    function makeCells() {
      const land = createLandMask();
      const cells = Array.from({ length: size * size }, (_, index) => {
        if (!land.has(index)) return { terrain: 'water', object: null };
        return { terrain: terrainForBiomeField(index), object: null };
      });
      applyTerrainMotifs(cells);
      ensureMinimumWaterTiles(cells, 5);
      carvePaths(cells);
      applyEconomyViabilityPass(cells);
      applyArchetypeGrammar(cells);
      applyArchetypeResourcePolish(cells);
      validateEconomyFloors(cells);
      consolidateGeneratedCropPlot(cells);
      ensureRoadBridgeCrossing(cells);
      applyPathsideHomeMotif(cells);
      placeBridgeCandidates(cells, archetypeKey === 'river' || archetypeKey === 'harbor' ? 1 : 0.35);
      placeObjects(cells);
      limitLampPlacements(cells);
      repairGeneratedFenceGatePaths(cells);
      repairGeneratedFenceOpenings(cells);
      ensureGeneratedResourceComponentGates(cells);
      connectBuildingsToPaths(cells);
      ensureRoadBridgeCrossing(cells);
      forceRoadBridgeCrossing(cells);
      scrubInvalidWaterBridges(cells);
      ensureMinimumWaterTiles(cells, 5);
      orientGeneratedTowers(cells);
      return cells;
    }

    function terrainForLabCell(cell) {
      if (!cell || terrainIds.indexOf(cell.terrain) === -1) return 'grass';
      if (cell.terrain === 'prairie') return 'grass';
      if (cell.terrain === 'cliff') return 'stone';
      return cell.terrain;
    }
    function fenceSideFor(cells, index) {
      const { x, y } = xyFor(index);
      function sideToward(nextIndex) {
        const point = xyFor(nextIndex);
        if (point.x < x) return 'w';
        if (point.x > x) return 'e';
        if (point.y < y) return 'n';
        if (point.y > y) return 's';
        return null;
      }
      function enclosureObject(objectId) {
        return isCropObjectId(objectId)
          || isAnimalObjectId(objectId)
          || isBuildingObjectId(objectId)
          || objectId === 'garden'
          || objectId === 'flower'
          || objectId === 'berries';
      }
      function bestSideFor(predicate, salt) {
        const options = neighbors(index)
          .filter(i => cells[i] && predicate(cells[i], i))
          .map(i => ({ index: i, side: sideToward(i), score: cellRand(i, salt) }));
        options.sort((a, b) => a.score - b.score);
        return options.length ? options[0].side : null;
      }
      const enclosureSide = bestSideFor(cell => enclosureObject(cell.object), 'fence-enclosure-side');
      if (enclosureSide) return enclosureSide;
      const waterSide = bestSideFor(cell => cell.terrain === 'water', 'fence-water-side');
      if (waterSide && (archetypeKey === 'harbor' || archetypeKey === 'river')) return waterSide;
      const pathSide = bestSideFor(cell => cell.terrain === 'path', 'fence-path-side');
      if (pathSide && cellRand(index, 'fence-path-edge') < 0.72) return pathSide;
      const same = neighbors(index).filter(i => cells[i] && cells[i].object === 'fence');
      const eastWest = same.some(i => xyFor(i).y === y);
      const northSouth = same.some(i => xyFor(i).x === x);
      if (eastWest && !northSouth) return 'center-x';
      if (northSouth && !eastWest) return 'center-z';
      return cellRand(index, 'fence-side') < 0.5 ? 'center-x' : 'center-z';
    }
    function fenceEdgeSideFor(cells, index) {
      const side = fenceSideFor(cells, index);
      if (generatedFenceSides.indexOf(side) !== -1) return side;
      const { x, y } = xyFor(index);
      const center = (size - 1) / 2;
      const dx = center - x;
      const dy = center - y;
      if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'e' : 'w';
      if (Math.abs(dy) > 0) return dy >= 0 ? 's' : 'n';
      return cellRand(index, 'fence-edge-side') < 0.5 ? 'n' : 'e';
    }
    function labFenceExtrasForCell(cell) {
      if (!cell || !Array.isArray(cell.fenceEdges)) return [];
      return cell.fenceEdges
        .filter(edge => edge && generatedFenceSides.indexOf(edge.side) !== -1)
        .map(edge => {
          const extra = {
            kind: 'fence',
            fenceSide: edge.side,
            floors: Math.max(1, Math.min(8, edge.level || 1)),
          };
          if (edge.style === 'garden' || edge.style === 'gate') extra.appearance = { fenceStyle: edge.style };
          return extra;
        });
    }
    function mapLabObject(cells, index) {
      const objectId = cells[index] && cells[index].object;
      if (!objectId || /-wing$/.test(objectId)) {
        return { kind: null, floors: 1, buildingType: null, fenceSide: null, appearance: null };
      }
      const objectStyle = { objectStyle: 'voxel' };
      const floors = (min, max, salt) => min + Math.floor(cellRand(index, salt) * (max - min + 1));
      if (objectId === 'watchtower') return { kind: 'house', floors: floors(2, 3, 'watchtower'), buildingType: 'tower', fenceSide: null, appearance: objectStyle, rotationY: towerRotationYForDoorSide(cells[index].doorSide || towerDoorSideFor(cells, index)) };
      if (objectId === 'house') return { kind: 'house', floors: floors(1, 2, 'house'), buildingType: null, fenceSide: null, appearance: objectStyle };
      if (objectId === 'manor') return { kind: 'house', floors: floors(2, 3, 'manor'), buildingType: 'manor', fenceSide: null, appearance: objectStyle };
      if (objectId === 'castle') return { kind: 'house', floors: floors(4, 5, 'castle'), buildingType: 'tower', fenceSide: null, appearance: objectStyle, rotationY: towerRotationYForDoorSide(cells[index].doorSide || towerDoorSideFor(cells, index)) };
      if (objectId === 'tree') return { kind: 'tree', floors: floors(1, 3, 'tree'), buildingType: null, fenceSide: null, appearance: objectStyle };
      if (objectId === 'garden' || objectId === 'flower') return { kind: 'flower', floors: floors(1, 3, 'flower'), buildingType: null, fenceSide: null, appearance: objectStyle };
      if (objectId === 'stone') return { kind: 'rock', floors: floors(1, 3, 'stone'), buildingType: null, fenceSide: null, appearance: objectStyle };
      if (objectId === 'ore' || objectId === 'crystal') return { kind: 'crystal', floors: floors(2, 4, 'crystal'), buildingType: null, fenceSide: null, appearance: objectStyle };
      if (objectId === 'fence') {
        return {
          kind: null,
          floors: 1,
          buildingType: null,
          fenceSide: null,
          appearance: null,
          extras: [{
            kind: 'fence',
            fenceSide: fenceEdgeSideFor(cells, index),
            floors: floors(1, archetypeKey === 'fortress' ? 4 : 2, 'fence'),
          }],
        };
      }
      if (objectId === 'bridge' || objectId === 'water-bridge') return { kind: 'bridge', floors: 1, buildingType: null, fenceSide: null, appearance: objectStyle };
      if (objectId === 'crop' || objectId === 'corn' || objectId === 'wheat' || objectId === 'pumpkin' || objectId === 'carrot' || objectId === 'sunflower') {
        return { kind: objectId, floors: floors(1, 3, objectId), buildingType: null, fenceSide: null, appearance: objectStyle };
      }
      if (objectId === 'berries') return { kind: 'bush', floors: floors(1, 3, 'berries'), buildingType: null, fenceSide: null, appearance: objectStyle };
      if (objectId === 'cow' || objectId === 'sheep') return { kind: objectId, floors: 1, buildingType: null, fenceSide: null, appearance: objectStyle };
      if (objectId === 'lamp') return { kind: 'lamp-post', floors: 1, buildingType: null, fenceSide: null, appearance: objectStyle };
      if (objectId === 'spotlight') return { kind: 'spotlight', floors: 1, buildingType: null, fenceSide: null, appearance: objectStyle };
      if (objectId === 'ruins' || objectId === 'totem') return { kind: objectId, floors: floors(1, 3, objectId), buildingType: null, fenceSide: null, appearance: objectStyle };
      return { kind: null, floors: 1, buildingType: null, fenceSide: null, appearance: null };
    }
    function terrainFloorsFor(cell, index, mapped) {
      return 1;
    }
    function floorsByRand(index, min, max, salt) {
      return min + Math.floor(cellRand(index, salt) * (max - min + 1));
    }

    const labCells = makeCells();
    const out = { v: 4, gridSize: size, cells: [] };
    for (let index = 0; index < labCells.length; index++) {
      const { x, y } = xyFor(index);
      const cell = labCells[index];
      const mapped = mapLabObject(labCells, index);
      let terrain = terrainForLabCell(cell);
      if (terrain === 'water' && mapped.kind && mapped.kind !== 'bridge') {
        mapped.kind = null;
        mapped.floors = 1;
        mapped.buildingType = null;
        mapped.fenceSide = null;
        mapped.appearance = null;
      }
      if (mapped.kind && !mappedObjectContributesToGenerationEconomy(mapped)) {
        mapped.kind = null;
        mapped.floors = 1;
        mapped.buildingType = null;
        mapped.fenceSide = null;
        mapped.appearance = null;
        mapped.rotationY = null;
      }
      const fenceExtras = terrain === 'water' ? [] : (mapped.extras || []).concat(labFenceExtrasForCell(cell));
      const entry = {
        x,
        z: y,
        terrain,
        kind: mapped.kind,
        floors: mapped.floors || 1,
        terrainFloors: terrainFloorsFor(cell, index, mapped),
        buildingType: mapped.kind === 'house' ? (mapped.buildingType || null) : null,
        fenceSide: mapped.kind === 'fence' ? (mapped.fenceSide || 'center-x') : null,
      };
      if (mapped.appearance) entry.appearance = mapped.appearance;
      if (fenceExtras.length) entry.extras = fenceExtras;
      if (Number.isFinite(mapped.rotationY)) entry.transform = { rotationY: mapped.rotationY };
      out.cells.push(entry);
    }
    return out;
  }

  function buildRandomIslandEconomyProfile(data, options = {}) {
    const statDefs = [
      { id: 'food', label: 'Food', color: '#219963' },
      { id: 'materials', label: 'Materials', color: '#7b8794' },
      { id: 'commerce', label: 'Commerce', color: '#ce8a15' },
      { id: 'defense', label: 'Defense', color: '#536276' },
      { id: 'charm', label: 'Charm', color: '#2473e6' },
    ];
    const archetypes = {
      pastoral: { label: 'Pastoral', bestUse: 'Farming and wool', traits: ['Meadow Economy', 'Gentle Terrain'] },
      forest: { label: 'Forest', bestUse: 'Wood and charm', traits: ['Deep Grove', 'Wood Reserve'] },
      quarry: { label: 'Quarry', bestUse: 'Materials', traits: ['Stone Veins', 'Rough Ground'] },
      river: { label: 'River', bestUse: 'Food and trade', traits: ['River Crossing', 'Fresh Water'] },
      village: { label: 'Village', bestUse: 'Commerce', traits: ['House Cluster', 'Trade Footpaths'] },
      fortress: { label: 'Fortress', bestUse: 'Defense', traits: ['Watch Posts', 'Guarded Edge'] },
      ruins: { label: 'Ruins', bestUse: 'Rare traits', traits: ['Ancient Remains', 'Mystic Finds'] },
      harbor: { label: 'Harbor', bestUse: 'Trade and charm', traits: ['Coastal Trade', 'Open Shore'] },
    };
    const statWeights = Object.assign({
      food: 1,
      materials: 1,
      commerce: 1,
      defense: 1,
      charm: 1,
    }, options.economy || {});
    const cells = Array.isArray(data && data.cells) ? data.cells : [];
    const gridSize = coerceGridSize(data && data.gridSize, GRID);
    const seed = String(options.seed || (data && data.seed) || 'tiny-1');
    const explicitArchetype = String(options.archetype || options.archetypeKey || '').trim().toLowerCase();
    const archetypeKey = archetypes[explicitArchetype] ? explicitArchetype : inferRandomIslandArchetypeFromCells(cells);
    const archetype = archetypes[archetypeKey] || archetypes.pastoral;
    const byCoord = new Map();
    const stats = Object.fromEntries(statDefs.map(stat => [stat.id, 0]));
    const counts = {};
    const terrains = {};
    const statCells = Object.fromEntries(statDefs.map(stat => [stat.id, []]));
    const synergies = [];
    let synergyBonus = 0;

    function xmur3NameHash(str) {
      let h = 1779033703 ^ str.length;
      for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return function hash() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= h >>> 16) >>> 0;
      };
    }
    function nameRand(str) {
      let n = xmur3NameHash(str)();
      return function next() {
        let t = (n += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    function makeName() {
      const rng = nameRand(seed + '|name|' + archetypeKey);
      const prefixes = {
        pastoral: ['Moss', 'Meadow', 'Clover', 'Wool', 'Green'],
        forest: ['Pine', 'Fern', 'Oak', 'Moss', 'Canopy'],
        quarry: ['Stone', 'Granite', 'Slate', 'Iron', 'Cliff'],
        river: ['Brook', 'River', 'Moss', 'Willow', 'Bridge'],
        village: ['Hearth', 'Market', 'Lantern', 'Cottage', 'Moss'],
        fortress: ['Watch', 'Iron', 'Shield', 'High', 'Stone'],
        ruins: ['Relic', 'Moon', 'Elder', 'Totem', 'Crystal'],
        harbor: ['Shoal', 'Salt', 'Dock', 'Tide', 'Harbor'],
      };
      const suffixes = ['Hamlet', 'Shoal', 'Rise', 'Watch', 'Crossing', 'Haven', 'Crown', 'Hollow', 'Reach'];
      const prefixList = prefixes[archetypeKey] || prefixes.pastoral;
      const prefix = prefixList[Math.floor(rng() * prefixList.length)];
      const suffix = suffixes[Math.floor(rng() * suffixes.length)];
      return prefix + (suffix === 'Crossing' ? 'bridge' : '') + ' ' + suffix;
    }
    function addStats(target, source, factor, cell) {
      const f = Number.isFinite(Number(factor)) ? Number(factor) : 1;
      for (const stat of statDefs) {
        const v = (source && Number(source[stat.id])) || 0;
        if (!v) continue;
        target[stat.id] += v * f;
        if (cell) statCells[stat.id].push({ x: cell.x, z: cell.z });
      }
    }
    function terrainStats(cell) {
      const terrain = cell && cell.terrain;
      if (terrain === 'water') return { food: 0.4, charm: 0.8 };
      if (terrain === 'path') return { commerce: 0.5 };
      if (terrain === 'dirt') return { materials: 0.2 };
      if (terrain === 'stone') return { materials: 1.1, defense: (cell.terrainFloors || 1) >= 3 ? 0.5 : 0 };
      if (terrain === 'sand') return { charm: 0.2 };
      if (terrain === 'snow') return { charm: 0.2 };
      return { charm: 0.3 };
    }
    function cellHasFenceExtra(cell) {
      return !!(cell && Array.isArray(cell.extras) && cell.extras.some(extra => extra && extra.kind === 'fence'));
    }
    function economyObjectId(cell) {
      if (!cell) return null;
      if (!cell.kind) return cellHasFenceExtra(cell) ? 'fence' : null;
      if (cell.kind === 'house') {
        if (cell.buildingType === 'manor') return 'manor';
        if (cell.buildingType === 'tower' || cell.buildingType === 'turret') return 'watchtower';
        return 'house';
      }
      if (cell.kind === 'lamp-post') return 'lamp';
      if (cell.kind === 'rock' || cell.kind === 'stone' || cell.kind === 'pebble') return 'stone';
      if (cell.kind === 'crystal') return 'crystal';
      if (cell.kind === 'bush' || cell.kind === 'shrub') return 'berries';
      if (cell.kind === 'flower' || cell.kind === 'sunflower') return cell.kind;
      if (cell.kind === 'crop' || cell.kind === 'corn' || cell.kind === 'wheat' || cell.kind === 'pumpkin' || cell.kind === 'carrot') return cell.kind;
      if (cell.kind === 'bridge' || cell.kind === 'fence' || cell.kind === 'tree' || cell.kind === 'cow' || cell.kind === 'sheep' || cell.kind === 'spotlight' || cell.kind === 'ruins' || cell.kind === 'totem') return cell.kind;
      return null;
    }
    function objectStats(id) {
      if (id === 'watchtower') return { defense: 2.8, commerce: 0.4 };
      if (id === 'house') return { commerce: 1.8, charm: 0.8 };
      if (id === 'manor') return { commerce: 3.8, charm: 1.4, defense: 0.4 };
      if (id === 'tree') return { materials: 1.0, charm: 0.9 };
      if (id === 'stone') return { materials: 1.0 };
      if (id === 'crystal') return { materials: 0.8, charm: 2.0 };
      if (id === 'fence') return { defense: 1.1 };
      if (id === 'bridge') return { commerce: 1.2, charm: 0.6 };
      if (id === 'crop') return { food: 1.6 };
      if (id === 'corn') return { food: 2.0 };
      if (id === 'wheat') return { food: 1.9 };
      if (id === 'pumpkin') return { food: 1.5, charm: 0.4 };
      if (id === 'carrot') return { food: 1.5 };
      if (id === 'sunflower') return { food: 0.4, charm: 1.8 };
      if (id === 'flower') return { charm: 1.2 };
      if (id === 'berries') return { food: 0.7, charm: 0.8 };
      if (id === 'cow') return { food: 2.2, charm: 0.2 };
      if (id === 'sheep') return { food: 1.2, charm: 1.0 };
      if (id === 'lamp') return { commerce: 0.4, charm: 0.7 };
      if (id === 'spotlight') return { defense: 1.0, charm: 0.2 };
      if (id === 'ruins') return { materials: 0.5, defense: 0.4, charm: 1.2 };
      if (id === 'totem') return { defense: 0.8, charm: 1.2 };
      return null;
    }
    function cellAt(x, z) {
      return byCoord.get(x + ',' + z) || null;
    }
    function neighborsOf(cell, diagonal = false) {
      const steps = diagonal
        ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
        : [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const out = [];
      for (const [dx, dz] of steps) {
        const c = cellAt(cell.x + dx, cell.z + dz);
        if (c) out.push(c);
      }
      return out;
    }
    function waterAdjacent(cell) {
      return neighborsOf(cell).some(neighbor => neighbor.terrain === 'water');
    }
    function edgeCell(cell) {
      return cell.x === 0 || cell.z === 0 || cell.x === gridSize - 1 || cell.z === gridSize - 1;
    }
    function fenceHasDefensiveContext(cell) {
      if (!cell || economyObjectId(cell) !== 'fence') return false;
      if (edgeCell(cell) || cell.terrain === 'stone' || (cell.terrainFloors || 1) >= 3) return true;
      return neighborsOf(cell).some(neighbor => {
        const id = economyObjectId(neighbor);
        return id === 'watchtower' || id === 'spotlight';
      });
    }
    function pushUnique(list, value) {
      if (list.indexOf(value) === -1) list.push(value);
    }
    function addSynergy(label, bonus, source, extra) {
      synergyBonus += bonus;
      pushUnique(synergies, label);
      if (source) {
        for (const stat of statDefs) {
          if (extra && extra[stat.id]) statCells[stat.id].push({ x: source.x, z: source.z });
        }
      }
    }
    function sampleCells(predicate, limit) {
      return cells
        .filter(cell => cell && Number.isInteger(cell.x) && Number.isInteger(cell.z) && predicate(cell, economyObjectId(cell)))
        .slice(0, limit || 10)
        .map(cell => ({ x: cell.x, z: cell.z }));
    }
    function inferRandomIslandArchetypeFromCells(sourceCells) {
      const countsLocal = {};
      for (const c of sourceCells || []) {
        const id = economyObjectId(c);
        if (id) countsLocal[id] = (countsLocal[id] || 0) + 1;
      }
      if ((countsLocal.watchtower || 0) + (countsLocal.fence || 0) + (countsLocal.spotlight || 0) >= 4) return 'fortress';
      if ((countsLocal.bridge || 0) >= 2) return 'harbor';
      if ((countsLocal.crystal || 0) + (countsLocal.ruins || 0) + (countsLocal.totem || 0) >= 3) return 'ruins';
      if ((countsLocal.stone || 0) + (countsLocal.crystal || 0) >= 5) return 'quarry';
      if ((countsLocal.tree || 0) + (countsLocal.berries || 0) >= 5) return 'forest';
      if ((countsLocal.house || 0) + (countsLocal.manor || 0) >= 3) return 'village';
      if ((countsLocal.cow || 0) + (countsLocal.sheep || 0) >= 3) return 'pastoral';
      return 'river';
    }

    for (const cell of cells) {
      if (!cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.z)) continue;
      byCoord.set(cell.x + ',' + cell.z, cell);
      terrains[cell.terrain] = (terrains[cell.terrain] || 0) + 1;
      const id = economyObjectId(cell);
      if (id) counts[id] = (counts[id] || 0) + 1;
      addStats(stats, terrainStats(cell), 1, cell);
      addStats(stats, objectStats(id), Math.max(1, Number(cell.floors) || 1) > 1 && id !== 'cow' && id !== 'sheep' ? 1 + Math.min(0.6, ((Number(cell.floors) || 1) - 1) * 0.12) : 1, cell);
    }

    for (const cell of cells) {
      if (!cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.z)) continue;
      const id = economyObjectId(cell);
      const nearby = neighborsOf(cell);
      if (id === 'sheep' && nearby.some(neighbor => neighbor.terrain === 'grass')) {
        stats.food += 0.8;
        stats.charm += 0.5;
        addSynergy('Sheep Meadow', 1.2, cell, { food: 0.8, charm: 0.5 });
      }
      if (id === 'cow' && (waterAdjacent(cell) || cell.terrain === 'grass')) {
        stats.food += 1.0;
        addSynergy('Watered Pasture', 1.1, cell, { food: 1.0 });
      }
      if ((id === 'house' || id === 'manor') && nearby.some(neighbor => neighbor.terrain === 'path')) {
        const bonus = id === 'manor' ? 1.9 : 1.1;
        stats.commerce += bonus;
        addSynergy(id === 'manor' ? 'Manor Road' : 'Connected House', bonus, cell, { commerce: bonus });
      }
      if ((id === 'watchtower' || id === 'spotlight' || fenceHasDefensiveContext(cell)) && (edgeCell(cell) || cell.terrain === 'stone' || (cell.terrainFloors || 1) >= 3 || id === 'fence')) {
        stats.defense += 1.2;
        addSynergy('Guarded Edge', 1.0, cell, { defense: 1.2 });
      }
      if ((id === 'tree' || id === 'stone' || id === 'crystal') && nearby.some(neighbor => economyObjectId(neighbor) === id)) {
        const materials = id === 'crystal' ? 0.8 : 0.45;
        stats.materials += materials;
        if (id === 'tree') stats.charm += 0.3;
        addSynergy(id === 'tree' ? 'Wood Cluster' : 'Stone Cluster', 0.6, cell, { materials, charm: id === 'tree' ? 0.3 : 0 });
      }
      if ((id === 'flower' || id === 'sunflower') && waterAdjacent(cell)) {
        stats.charm += 0.9;
        addSynergy('Water Gardens', 0.7, cell, { charm: 0.9 });
      }
      if (id === 'bridge') {
        const horizontal = cellAt(cell.x - 1, cell.z) && cellAt(cell.x + 1, cell.z)
          && cellAt(cell.x - 1, cell.z).terrain !== 'water'
          && cellAt(cell.x + 1, cell.z).terrain !== 'water';
        const vertical = cellAt(cell.x, cell.z - 1) && cellAt(cell.x, cell.z + 1)
          && cellAt(cell.x, cell.z - 1).terrain !== 'water'
          && cellAt(cell.x, cell.z + 1).terrain !== 'water';
        if (horizontal || vertical) {
          stats.commerce += 1.4;
          stats.charm += 0.8;
          addSynergy('Bridge Crossing', 1.8, cell, { commerce: 1.4, charm: 0.8 });
        }
      }
      if (['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower'].indexOf(id) !== -1 && waterAdjacent(cell)) {
        stats.food += 0.9;
        addSynergy('Irrigated Crops', 0.8, cell, { food: 0.9 });
      }
      if (id === 'crystal' && cell.terrain === 'stone') {
        stats.materials += 0.8;
        addSynergy('Crystal Vein', 0.7, cell, { materials: 0.8 });
      }
    }

    const traits = archetype.traits.slice();
    if ((counts.sheep || 0) >= 2) traits.push('Sheep Meadows');
    if ((counts.cow || 0) >= 2) traits.push('Cattle Pasture');
    if ((counts.tree || 0) + (counts.berries || 0) >= 5) traits.push('Wood Lots');
    if ((counts.stone || 0) + (counts.crystal || 0) >= 5) traits.push('Rich Quarry');
    if ((counts.house || 0) >= 3) traits.push('House Cluster');
    if ((counts.manor || 0) >= 1) traits.push('Manor Estate');
    const defensiveFenceCount = cells.filter(cell => fenceHasDefensiveContext(cell)).length;
    if ((counts.watchtower || 0) + defensiveFenceCount + (counts.spotlight || 0) >= 4) traits.push('Defensive Ring');
    if ((counts.bridge || 0) >= 1 && (terrains.water || 0) >= 8) traits.push('Bridge Crossing');
    if ((counts.ruins || 0) + (counts.totem || 0) + (counts.crystal || 0) >= 3) traits.push('Ancient Mystery');
    if ((counts.flower || 0) + (counts.sunflower || 0) >= 3) traits.push('Bloom Gardens');
    if ((terrains.water || 0) >= Math.max(8, Math.round(cells.length * 0.22))) traits.push('Coastal Shape');
    if ((terrains.path || 0) >= Math.max(6, Math.round(cells.length * 0.11))) traits.push('Readable Roads');
    if (stats.defense < 4 && ((counts.house || 0) >= 2 || (counts.manor || 0) >= 1)) traits.push('Weak Walls');

    const roundedStats = Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, Number(value.toFixed(1))]));
    const weighted = (
      roundedStats.food * (Number(statWeights.food) || 0) * 1.05
      + roundedStats.materials * (Number(statWeights.materials) || 0) * 0.95
      + roundedStats.commerce * (Number(statWeights.commerce) || 0) * 0.9
      + Math.min(roundedStats.defense, 28) * (Number(statWeights.defense) || 0) * 0.65
      + roundedStats.charm * (Number(statWeights.charm) || 0) * 0.82
    );
    const finalTraits = [...new Set(traits)].slice(0, 6);
    const traitBonus = finalTraits.length * 1.2;
    const cappedSynergyBonus = Math.min(synergyBonus, 14);
    const potential = Math.max(1, Math.round(weighted + cappedSynergyBonus * 1.05 + traitBonus));
    const rarityScore = weighted + cappedSynergyBonus * 1.05 + traitBonus;
    const rarityThresholds = {
      pastoral: { uncommon: 111.5, rare: 116.8, epic: 121.4, legendary: 126.6 },
      forest: { uncommon: 80.0, rare: 86.9, epic: 93.6, legendary: 101.6 },
      quarry: { uncommon: 129.7, rare: 136.1, epic: 141.0, legendary: 145.6 },
      river: { uncommon: 102.1, rare: 111.4, epic: 118.4, legendary: 124.2 },
      village: { uncommon: 106.6, rare: 112.7, epic: 118.1, legendary: 123.7 },
      fortress: { uncommon: 124.4, rare: 130.3, epic: 135.3, legendary: 140.6 },
      ruins: { uncommon: 110.9, rare: 118.9, epic: 125.5, legendary: 131.2 },
      harbor: { uncommon: 100.2, rare: 108.6, epic: 114.8, legendary: 120.6 },
      global: { uncommon: 109.3, rare: 120.6, epic: 130.2, legendary: 138.8 },
    };
    const rarityBand = rarityThresholds[archetypeKey] || rarityThresholds.global;
    const rarity = rarityScore >= rarityBand.legendary ? 'Legendary'
      : rarityScore >= rarityBand.epic ? 'Epic'
        : rarityScore >= rarityBand.rare ? 'Rare'
          : rarityScore >= rarityBand.uncommon ? 'Uncommon'
            : 'Common';
    const topStats = statDefs
      .map(stat => ({ id: stat.id, label: stat.label, color: stat.color, value: roundedStats[stat.id] || 0 }))
      .sort((a, b) => b.value - a.value);
    const highlights = [
      {
        id: 'overview',
        stat: topStats[0].id,
        cells: sampleCells(() => true, 12),
      },
      {
        id: 'commerce',
        stat: 'commerce',
        cells: sampleCells((cell, id) => cell.terrain === 'path' || id === 'house' || id === 'manor' || id === 'lamp' || id === 'bridge', 10),
      },
      {
        id: 'food',
        stat: 'food',
        cells: sampleCells((cell, id) => ['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower', 'cow', 'sheep', 'berries'].indexOf(id) !== -1 || cell.terrain === 'water', 10),
      },
      {
        id: 'materials',
        stat: 'materials',
        cells: sampleCells((cell, id) => id === 'tree' || id === 'stone' || id === 'crystal' || cell.terrain === 'stone' || cell.terrain === 'dirt', 10),
      },
      {
        id: 'defense',
        stat: 'defense',
        cells: sampleCells((cell, id) => id === 'watchtower' || id === 'fence' || id === 'spotlight' || (cell.terrainFloors || 1) >= 3, 10),
      },
      {
        id: 'charm',
        stat: 'charm',
        cells: sampleCells((cell, id) => id === 'flower' || id === 'sunflower' || id === 'tree' || id === 'crystal' || id === 'totem' || id === 'ruins' || cell.terrain === 'water' || cell.terrain === 'sand', 10),
      },
      {
        id: 'summary',
        stat: topStats[0].id,
        cells: topStats.slice(0, 3).flatMap(stat => statCells[stat.id] || []).slice(0, 14),
      },
    ].map(step => ({
      id: step.id,
      stat: step.stat,
      cells: step.cells && step.cells.length ? step.cells : sampleCells(() => true, 10),
    }));

    return {
      seed,
      archetypeKey,
      archetype: archetype.label,
      bestUse: archetype.bestUse,
      name: makeName(),
      stats: roundedStats,
      statDefs,
      counts,
      terrains,
      synergyBonus: Number(synergyBonus.toFixed(1)),
      synergies: synergies.slice(0, 8),
      traits: finalTraits,
      economy: {
        weighted: Number(weighted.toFixed(1)),
        traitBonus: Number(traitBonus.toFixed(1)),
        potential,
        rarityScore: Number(rarityScore.toFixed(1)),
        rarity,
        rarityScope: 'archetype',
      },
      topStats,
      highlights,
    };
  }

  function generateProceduralWorld({ seed, biomes, elevation, gridSize, archetype }) {
    return generateRandomIslandWorld({ seed, biomes, elevation, gridSize, archetype });
  }
  // Expose for tests / command palette.
  window.__buildRandomIslandEconomyProfile = buildRandomIslandEconomyProfile;
  window.__generateRandomIslandWorld = generateRandomIslandWorld;
  window.__generateProceduralWorld = generateProceduralWorld;
