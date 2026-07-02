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
        enum: [null, 'house', 'tree', 'fence', 'rock', 'bridge', 'crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower', 'tuft', 'flower', 'bush', 'cow', 'sheep', 'pig', 'lamp-post', 'spotlight'],
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
    // Derive from the canonical persistence serializer so the AI prompt sees
    // the same cells saveState does. The old hand-rolled walk here silently
    // dropped boards directly north/south of home.
    return buildWorldStateObject().cells;
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
    const okKind = new Set([null,'house','tree','fence','rock','bridge','crop','corn','wheat','pumpkin','carrot','sunflower','tuft','flower','bush','cow','sheep','pig','lamp-post','spotlight','chimney','ripple','shrub','stone','pebble','bridge-rail','voxel-build','model-stamp','blank-island','stargate','crystal','relic','totem','ruins','artifact']);
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
        // Match the 8000-token output budget the other providers get; 4096
        // truncated large worlds mid-JSON.
        max_tokens: 8000,
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
    const url = `${endpoint}/${safeModel}:generateContent`;
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
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
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

  // -------- unified provider dispatch + latest-wins abort controller --------
  // Replaces the 4 copy-pasted if/else if/else provider switches and the 3
  // duplicated AbortController patterns across modules 26, 27, and 21.

  function makeLatestWinsController() {
    let ctrl = null;
    return {
      start() {
        if (ctrl) ctrl.abort();
        ctrl = new AbortController();
        return ctrl;
      },
      get current() { return ctrl; },
      get signal() { return ctrl ? ctrl.signal : null; },
      get aborted() { return ctrl ? ctrl.signal.aborted : false; },
    };
  }

  function callAIProvider(provider, key, model, system, user, opts = {}) {
    const def = AI_DEFAULTS[provider];
    if (!def) throw new Error('unknown provider: ' + provider);
    const callOpts = opts.signal ? { signal: opts.signal } : {};
    if (opts.imageDataUrl) callOpts.imageDataUrl = opts.imageDataUrl;
    const usedModel = model || def.model;
    if (provider === 'anthropic') {
      return callAnthropic(def.endpoint, key, usedModel, system, user, opts.toolSpec || null, callOpts);
    } else if (provider === 'gemini') {
      return callGemini(def.endpoint, key, usedModel, system, user, callOpts);
    } else {
      return callOpenAI(def.endpoint, key, usedModel, system, user, callOpts);
    }
  }


  // Island generator extracted to 26a-island-generator.js

  function generateProceduralWorld({ seed, biomes, elevation, gridSize, archetype }) {
    return generateRandomIslandWorld({ seed, biomes, elevation, gridSize, archetype });
  }
  window.__buildRandomIslandEconomyProfile = buildRandomIslandEconomyProfile;
  window.__generateRandomIslandWorld = generateRandomIslandWorld;
  window.__generateProceduralWorld = generateProceduralWorld;
