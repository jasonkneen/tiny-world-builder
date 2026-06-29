  // -------- random island economy profile --------
  // Shared by builder reveal, island viewer, pack cards, and tests.
  // Requires global GRID + coerceGridSize (00-prelude or random-island-economy-prelude.js).
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
  window.__buildRandomIslandEconomyProfile = buildRandomIslandEconomyProfile;
