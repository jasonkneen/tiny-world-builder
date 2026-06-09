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
      'A fence is a single side/leaf, not a full square. Set fenceSide to n|s|e|w for tile edges or center-x|center-z for centre-line walls.',
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
    const okCameraMode = new Set(['ortho','topdown','perspective','fp']);
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
      if (data.planetLandscape.biome !== undefined && !['grassland','desert','snow'].includes(data.planetLandscape.biome)) return 'planetLandscape.biome invalid';
      if (data.planetLandscape.styleMode !== undefined && !['lowpoly','realistic'].includes(data.planetLandscape.styleMode)) return 'planetLandscape.styleMode invalid';
      if (data.planetLandscape.drop !== undefined && (typeof data.planetLandscape.drop !== 'number' || data.planetLandscape.drop < 20 || data.planetLandscape.drop > 300)) return 'planetLandscape.drop invalid';
    }
    const okTerrain = new Set(['grass','path','dirt','water','stone','lava','sand','snow']);
    const okKind = new Set([null,'house','tree','fence','rock','bridge','crop','corn','wheat','pumpkin','carrot','sunflower','tuft','flower','bush','cow','sheep','lamp-post','spotlight','chimney','ripple','shrub','stone','pebble','bridge-rail','voxel-build','model-stamp','blank-island']);
    const okBT = new Set([null,'cottage','manor','tower','turret','skyscraper']);
    const okFenceSide = new Set([null,'n','s','e','w','center-x','center-z']);
    const seen = new Set();
    for (let i = 0; i < data.cells.length; i++) {
      const c = data.cells[i];
      let x, z, terrain, kind, floors, buildingType, terrainFloors, fenceSide, extras, transform, appearance;
      if (Array.isArray(c)) {
        if (c.length < 4) return 'cells[' + i + '] tuple too short';
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
        } else if (typeof transform === 'object') {
          if (transform.rotationY !== undefined && typeof transform.rotationY !== 'number') return 'cells[' + i + '].transform.rotationY invalid';
          if (transform.offsetX !== undefined && typeof transform.offsetX !== 'number') return 'cells[' + i + '].transform.offsetX invalid';
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
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + key,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const j = await r.json();
    const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    return text;
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
    });
    if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const j = await r.json();
    const responseParts = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
    return (responseParts || []).map(part => part.text || '').join('\n');
  }

  // Item 4 — procedural map generator (offline, deterministic). Emits a
  // v=4 world directly from seed + biome composition + elevation profile.
  // Ports the *concept* of OWB's biome / elevation / scatter pipeline
  // into tinyworld's selected grid schema without touching the render pipeline.
  // Algorithm:
  //   1. Two Mulberry32-derived noise fields (terrain & elevation) sampled
  //      per (x,z) on the home grid plus a small smoothing pass for
  //      coherence (4-neighbour average).
  //   2. Rank cells by terrain noise, slice by cumulative biome %, then
  //      paint terrain + kind per biome bucket.
  //   3. Rank cells by elevation noise, slice by cumulative elevation %,
  //      then assign terrainFloors (plains=1, hills=2..3, mountains=4..7).
  //   4. Place settlement cells with cluster-friendly hints so houses
  //      auto-promote when adjacent (handled by setCell's clustering).
  function generateProceduralWorld({ seed, biomes, elevation, gridSize }) {
    const size = coerceGridSize(gridSize, GRID);
    const rng = makeMulberry32(seed || randomSeed());

    // ---- fbm value noise (OWB-style coherent terrain) ----------------
    // Each octave is a low-frequency value-noise lattice; we accumulate
    // them with halving amplitude so the result is smooth large
    // features + small detail — the same recipe OWB uses for its
    // heightmap.  All sampling goes through the seeded `rng` so the
    // result is deterministic per seed.
    function makeValueLayer(cellsAcross) {
      const grid = new Float32Array((cellsAcross + 1) * (cellsAcross + 1));
      for (let i = 0; i < grid.length; i++) grid[i] = rng();
      return { grid, cellsAcross };
    }
    function smoothstep(t) { return t * t * (3 - 2 * t); }
    function sampleLayer(layer, u, v) {
      // u, v in [0..1] map to lattice coords
      const x = u * layer.cellsAcross;
      const z = v * layer.cellsAcross;
      const x0 = Math.floor(x), z0 = Math.floor(z);
      const x1 = Math.min(layer.cellsAcross, x0 + 1);
      const z1 = Math.min(layer.cellsAcross, z0 + 1);
      const tx = smoothstep(x - x0);
      const tz = smoothstep(z - z0);
      const w = layer.cellsAcross + 1;
      const a = layer.grid[x0 + z0 * w];
      const b = layer.grid[x1 + z0 * w];
      const c = layer.grid[x0 + z1 * w];
      const d = layer.grid[x1 + z1 * w];
      return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
    }
    function fbm(octaves, baseCells, persistence) {
      const layers = [];
      let cells = baseCells;
      for (let o = 0; o < octaves; o++) {
        layers.push(makeValueLayer(cells));
        cells = Math.max(2, Math.floor(cells * 2));
      }
      return (u, v) => {
        let total = 0, amp = 1, sum = 0;
        for (let o = 0; o < octaves; o++) {
          total += sampleLayer(layers[o], u, v) * amp;
          sum += amp;
          amp *= persistence;
        }
        return total / sum;
      };
    }

    // Three fields: heightmap (terrain shape), moisture (biome tint),
    // and decoration noise (where to scatter trees/flowers).
    const baseCells = Math.max(2, Math.floor(size / 6));
    const heightFn = fbm(4, baseCells, 0.55);
    const moistFn  = fbm(3, baseCells, 0.6);
    const decoFn   = fbm(2, Math.max(3, baseCells), 0.5);

    // ---- island falloff: drop heights at the edges so the world
    //      naturally rims with water like OWB.  Strength scales with
    //      the user-chosen water % — more water = sharper rim.
    const waterPct = Math.max(0, Math.min(80, Number(biomes.water) || 10));
    const rimStrength = 0.45 + waterPct * 0.012; // ~0.55 at 10% water, up to ~1.4 at 80%
    function islandShape(x, z) {
      const cx = (size - 1) / 2;
      const cz = (size - 1) / 2;
      const dx = (x - cx) / cx;
      const dz = (z - cz) / cz;
      // Squared distance in [0..2]; raise to a power for a softer plateau.
      const d2 = (dx * dx + dz * dz) / 2;
      return 1 - Math.pow(d2, 1.4) * rimStrength;
    }

    const heightField = [];
    const moistField  = [];
    const decoField   = [];
    for (let x = 0; x < size; x++) {
      heightField[x] = [];
      moistField[x]  = [];
      decoField[x]   = [];
      for (let z = 0; z < size; z++) {
        const u = x / (size - 1);
        const v = z / (size - 1);
        const h = heightFn(u, v) * islandShape(x, z);
        heightField[x][z] = h;
        moistField[x][z]  = moistFn(u, v);
        decoField[x][z]   = decoFn(u, v);
      }
    }
    // Backwards-compat shims for older code below that referenced
    // terrainNoise/elevNoise lookups.
    const terrainNoise = moistField;
    const elevNoise    = heightField;

    // Flatten + sort to bucket cells.
    const cellList = [];
    for (let x = 0; x < size; x++)
      for (let z = 0; z < size; z++)
        cellList.push({ x, z, n: terrainNoise[x][z], e: elevNoise[x][z] });

    const total = cellList.length;
    // Order biome buckets so water sits at the lowest noise and
    // settlement sits at the highest — produces water shores at the
    // bottom of "valleys" and towns on "highlands".
    const biomeOrder = ['water', 'dirt', 'grass', 'forest', 'settlement'];
    const sortedByNoise = cellList.slice().sort((a, b) => a.n - b.n);
    const biomeBuckets = {};
    let cursor = 0;
    for (const k of biomeOrder) {
      const pct = Math.max(0, Math.min(100, Number(biomes[k]) || 0));
      const count = Math.round(total * pct / 100);
      biomeBuckets[k] = sortedByNoise.slice(cursor, cursor + count);
      cursor += count;
    }
    // Round-off — push the remainder to grass (or the first non-empty
    // bucket) so 64 cells always get assigned.
    if (cursor < total) {
      const overflow = sortedByNoise.slice(cursor);
      (biomeBuckets.grass || biomeBuckets[biomeOrder.find(k => biomeBuckets[k].length > 0)] || []).push(...overflow);
    }

    // Elevation buckets — ranked by elev noise (independent of biome).
    const elevOrder = ['plains', 'hills', 'mountains'];
    const sortedByElev = cellList.slice().sort((a, b) => a.e - b.e);
    const elevBuckets = {};
    cursor = 0;
    for (const k of elevOrder) {
      const pct = Math.max(0, Math.min(100, Number(elevation[k]) || 0));
      const count = Math.round(total * pct / 100);
      elevBuckets[k] = new Set(sortedByElev.slice(cursor, cursor + count).map(c => c.x + ',' + c.z));
      cursor += count;
    }

    function elevTier(x, z) {
      const k = x + ',' + z;
      if (elevBuckets.mountains && elevBuckets.mountains.has(k)) return 'mountains';
      if (elevBuckets.hills && elevBuckets.hills.has(k)) return 'hills';
      return 'plains';
    }
    // Build a smoothed terrainFloors grid: pick a per-cell target based on
    // tier, then clamp every cell so it differs from its 4 neighbours by
    // at most 1.  Result is a continuous heightmap — no sawtooth edges
    // between plains and mountain cells.
    const tfGrid = [];
    for (let x = 0; x < size; x++) {
      tfGrid[x] = [];
      for (let z = 0; z < size; z++) {
        const tier = elevTier(x, z);
        tfGrid[x][z] = (tier === 'mountains') ? (4 + Math.floor(rng() * 3))
                     : (tier === 'hills')     ? (2 + Math.floor(rng() * 2))
                     : 1;
      }
    }
    // Several smoothing passes — each pass clamps every cell to be within
    // ±1 of its lowest neighbour so terraces appear naturally.
    for (let pass = 0; pass < 4; pass++) {
      for (let x = 0; x < size; x++) {
        for (let z = 0; z < size; z++) {
          let minN = Infinity;
          if (x > 0)        minN = Math.min(minN, tfGrid[x-1][z]);
          if (x < size - 1) minN = Math.min(minN, tfGrid[x+1][z]);
          if (z > 0)        minN = Math.min(minN, tfGrid[x][z-1]);
          if (z < size - 1) minN = Math.min(minN, tfGrid[x][z+1]);
          if (minN === Infinity) continue;
          if (tfGrid[x][z] > minN + 1) tfGrid[x][z] = minN + 1;
        }
      }
    }
    function elevFloors(x, z) {
      return tfGrid[x] && tfGrid[x][z] ? tfGrid[x][z] : 1;
    }

    const out = { v: 4, gridSize: size, cells: [] };

    function pushCell(x, z, terrain, kind, floors, terrainFloors, buildingType, fenceSide) {
      out.cells.push({
        x, z,
        terrain: terrain || 'grass',
        kind: kind || null,
        floors: floors || 1,
        terrainFloors: terrainFloors || 1,
        buildingType: buildingType || null,
        fenceSide: fenceSide || null,
      });
    }

    function biomeOfCell(x, z) {
      for (const k of biomeOrder) {
        if (biomeBuckets[k] && biomeBuckets[k].some(c => c.x === x && c.z === z)) return k;
      }
      return 'grass';
    }

    // Quick lookup map (avoid the .some loop above for every cell).
    const biomeLookup = {};
    for (const k of biomeOrder) {
      for (const c of (biomeBuckets[k] || [])) biomeLookup[c.x + ',' + c.z] = k;
    }
    function fastBiome(x, z) { return biomeLookup[x + ',' + z] || 'grass'; }

    // First pass — paint terrain by biome. Elevation is expressed through
    // terrainFloors, not by blanketing the board with rock props. Water cells
    // suppress hosted kinds (no kinds float, per the schema).
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const biome = fastBiome(x, z);
        const tier = elevTier(x, z);
        const tf = elevFloors(x, z);
        let terrain = 'grass';
        let kind = null;
        let floors = 1;
        let bType = null;

        if (biome === 'water') {
          terrain = 'water';
        } else if (biome === 'dirt') {
          terrain = 'dirt';
          // Sprinkle some crops at moderate density.
          if (rng() < 0.45) {
            const cropKinds = ['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower'];
            kind = cropKinds[Math.floor(rng() * cropKinds.length)];
            floors = 1 + Math.floor(rng() * 2);
          }
        } else if (biome === 'grass') {
          terrain = 'grass';
          // Occasional decoration on plains: tuft / flower / bush / animal.
          const roll = rng();
          if (tier === 'plains' && roll < 0.12)      { kind = 'tuft'; }
          else if (tier === 'plains' && roll < 0.18) { kind = 'flower'; }
          else if (tier === 'plains' && roll < 0.22) { kind = 'bush'; }
          else if (tier === 'plains' && roll < 0.26) { kind = 'cow'; }
          else if (tier === 'plains' && roll < 0.30) { kind = 'sheep'; }
        } else if (biome === 'forest') {
          terrain = 'grass';
          if (tier === 'plains' || (tier === 'hills' && rng() < 0.18)) {
            kind = 'tree';
            floors = 1 + Math.floor(rng() * 3);
          }
        } else if (biome === 'settlement') {
          terrain = (tier === 'mountains') ? 'grass' : 'path';
          if (rng() < 0.7) {
            kind = 'house';
            floors = 1 + Math.floor(rng() * 3);
            // Mountain-biome settlements turn into towers.
            if (tier === 'mountains') bType = 'tower';
          }
        }

        // Suppress kinds on water + lava (bridges are placed later if needed).
        if (terrain === 'water' || terrain === 'lava') { kind = null; bType = null; }

        // Stilts fix — any kind that isn't 'rock' sits on flat ground.
        // Elevation manifests as raised BARE terrain cells (grass / stone
        // hills, snow caps), not as pillars under objects.
        let effectiveTf = tf;
        if (kind && kind !== 'rock') effectiveTf = 1;

        // Promote mountain-tier bare grass cells to stone or snow caps so
        // hills actually read as different material, not just taller grass.
        if (!kind && tier === 'mountains' && terrain === 'grass') {
          terrain = (rng() < 0.65) ? 'stone' : 'snow';
        }
        if (!kind && tier === 'hills' && terrain === 'grass' && rng() < 0.22) {
          terrain = 'stone';
        }
        // Rare lava pockets inside mountain biomes — a small volcanic
        // accent, only on bare elevated cells.
        if (!kind && tier === 'mountains' && terrain === 'stone' && rng() < 0.08) {
          terrain = 'lava';
        }
        // Beach band: water-edge plains become sand cells.
        if (!kind && tier === 'plains' && terrain === 'grass') {
          if (biomeLookup[(x - 1) + ',' + z] === 'water'
           || biomeLookup[(x + 1) + ',' + z] === 'water'
           || biomeLookup[x + ',' + (z - 1)] === 'water'
           || biomeLookup[x + ',' + (z + 1)] === 'water') {
            if (rng() < 0.7) terrain = 'sand';
          }
        }

        pushCell(x, z, terrain, kind, floors, effectiveTf, bType, null);
      }
    }

    return out;
  }
  // Expose for tests / command palette.
  window.__generateProceduralWorld = generateProceduralWorld;
