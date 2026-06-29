  // -------- random island economy profile --------
  // Shared by builder reveal, island viewer, pack cards, and tests.
  // Requires global GRID + coerceGridSize (00-prelude or random-island-economy-prelude.js).
  function buildIslandRawYieldEconomy(data, options = {}) {
    const cells = Array.isArray(data && data.cells) ? data.cells : [];
    const seed = String(options.seed || (data && data.seed) || 'tiny-1');
    const name = String(options.name || (data && data.name) || 'Island');
    const cropWeights = {
      wheat: 5,
      corn: 5,
      carrot: 5,
      pumpkin: 6,
      sunflower: 6,
    };
    const rockOreWeights = {
      stone: 1,
      copper: 6,
      iron: 7,
      silver: 10,
      goldOre: 13,
    };
    const animalWeights = {
      sheep: 6,
      cow: 9,
    };
    const natureWeights = {
      berries: 1,
      trees: 2,
      water: 1,
      fish: 7,
    };
    const buildingWeights = {
      houses: 8,
      towers: 10,
      manor: 35,
    };
    const resources = {
      crops: {
        wheat: 0,
        corn: 0,
        carrot: 0,
        pumpkin: 0,
        sunflower: 0,
      },
      rockOre: {
        stone: 0,
        copper: 0,
        iron: 0,
        silver: 0,
        goldOre: 0,
      },
      animals: {
        sheep: 0,
        cow: 0,
      },
      nature: {
        trees: 0,
        berries: 0,
        water: 0,
        fish: 0,
      },
      buildings: {
        houses: 0,
        towers: 0,
        manor: 0,
      },
    };

    function hashRawYieldSeed(value) {
      let h = 1779033703 ^ String(value).length;
      const str = String(value);
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

    function rawYieldRandom(value) {
      let n = hashRawYieldSeed(value)();
      return function random() {
        let t = (n += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function rawYieldAppearance(cell) {
      return cell && cell.appearance && typeof cell.appearance === 'object' ? cell.appearance : {};
    }

    function rawYieldCellFromEntry(entry) {
      if (Array.isArray(entry)) {
        return {
          x: entry[0],
          z: entry[1],
          terrain: entry[2] || 'grass',
          kind: entry[3] === 'blank-island' ? null : (entry[3] || null),
          floors: entry[4] || 1,
          buildingType: entry[5] || null,
          terrainFloors: entry[6] || 1,
          fenceSide: entry[7] || null,
          extras: Array.isArray(entry[8]) ? entry[8] : [],
          appearance: entry[10] && typeof entry[10] === 'object' ? entry[10] : null,
        };
      }
      return entry && typeof entry === 'object' ? entry : null;
    }

    function rawYieldBuildingId(cell) {
      if (!cell || cell.kind !== 'house') return null;
      if (cell.buildingType === 'manor') return 'manor';
      if (cell.buildingType === 'tower') return 'towers';
      return 'houses';
    }

    function rawYieldOreMetal(cell) {
      if (!cell || cell.kind !== 'rock') return null;
      const metal = String(rawYieldAppearance(cell).oreMetal || '').trim().toLowerCase();
      if (metal === 'copper' || metal === 'iron' || metal === 'silver') return metal;
      if (metal === 'gold') return 'goldOre';
      return 'stone';
    }

    function rawYieldScore(group, weights) {
      return Object.entries(weights).reduce((total, row) => total + (Number(group[row[0]]) || 0) * row[1], 0);
    }

    function rawYieldRarity(score) {
      if (score >= 231) return { id: 'legendary', label: 'Legendary', range: { min: 231, max: null } };
      if (score >= 212) return { id: 'epic', label: 'Epic', range: { min: 212, max: 230 } };
      if (score >= 193) return { id: 'rare', label: 'Rare', range: { min: 193, max: 211 } };
      if (score >= 170) return { id: 'uncommon', label: 'Uncommon', range: { min: 170, max: 192 } };
      return { id: 'common', label: 'Common', range: { min: 0, max: 169 } };
    }

    for (const entry of cells) {
      const cell = rawYieldCellFromEntry(entry);
      if (!cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.z)) continue;
      const kind = cell.kind || null;
      if (Object.prototype.hasOwnProperty.call(cropWeights, kind)) {
        resources.crops[kind] += 1;
      } else if (kind === 'cow' || kind === 'sheep') {
        resources.animals[kind] += 1;
      } else if (kind === 'tree') {
        resources.nature.trees += 1;
      } else if (kind === 'bush') {
        resources.nature.berries += 1;
      }
      if (cell.terrain === 'water') {
        resources.nature.water += 1;
        const fishRoll = rawYieldRandom(seed + '|fish|' + cell.x + ',' + cell.z)();
        if (fishRoll < 0.25) resources.nature.fish += 1;
      }
      const metal = rawYieldOreMetal(cell);
      if (metal) {
        resources.rockOre[metal] += 1;
      }
      const building = rawYieldBuildingId(cell);
      if (building) resources.buildings[building] += 1;
    }

    const cropScore = rawYieldScore(resources.crops, cropWeights);
    const rockOreScore = rawYieldScore(resources.rockOre, rockOreWeights);
    const animalScore = rawYieldScore(resources.animals, animalWeights);
    const natureScore = rawYieldScore(resources.nature, natureWeights);
    const rawYield = cropScore + rockOreScore + animalScore + natureScore;
    const buildingScore = rawYieldScore(resources.buildings, buildingWeights);
    const totalRank = rawYield + buildingScore;
    const rarity = rawYieldRarity(rawYield);
    const leader = [
      { id: 'crops', label: 'Crop-led', score: cropScore },
      { id: 'rockOre', label: 'Rock/Ore-led', score: rockOreScore },
      { id: 'animals', label: 'Animal-led', score: animalScore },
      { id: 'nature', label: 'Nature-led', score: natureScore },
    ].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))[0] || { id: 'rawYield', label: 'Raw Yield', score: 0 };
    return {
      aspect: 'raw_yield',
      label: 'Raw Yield',
      scoreV: 1,
      seed,
      name,
      resources,
      scores: {
        crops: cropScore,
        rockOre: rockOreScore,
        animals: animalScore,
        nature: natureScore,
        rawYield,
        buildings: buildingScore,
        totalRank,
      },
      rarity,
      leader: { id: leader.id, label: leader.label },
    };
  }

  function buildRandomIslandEconomyProfile(data, options = {}) {
    const cells = Array.isArray(data && data.cells) ? data.cells : [];
    const seed = String(options.seed || (data && data.seed) || 'tiny-1');
    const explicitName = String(options.name || (data && data.name) || '').trim();

    function profileNameRand(value) {
      let h = 1779033703 ^ String(value).length;
      const str = String(value);
      for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      let n = (h ^= h >>> 16) >>> 0;
      return function next() {
        let t = (n += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function profileNameFromSeed() {
      const rng = profileNameRand(seed + '|raw-yield-name');
      const prefixes = ['Moss', 'Stone', 'Clover', 'Pine', 'Salt', 'Relic', 'Lantern', 'Crown', 'Brook', 'Hearth'];
      const suffixes = ['Hamlet', 'Shoal', 'Rise', 'Watch', 'Crossing', 'Haven', 'Crown', 'Hollow', 'Reach'];
      return prefixes[Math.floor(rng() * prefixes.length)] + ' ' + suffixes[Math.floor(rng() * suffixes.length)];
    }

    function profileCellFromEntry(entry) {
      if (Array.isArray(entry)) {
        return {
          x: entry[0],
          z: entry[1],
          terrain: entry[2] || 'grass',
          kind: entry[3] === 'blank-island' ? null : (entry[3] || null),
        };
      }
      return entry && typeof entry === 'object' ? entry : null;
    }

    const counts = {};
    const terrains = {};
    for (const entry of cells) {
      const cell = profileCellFromEntry(entry);
      if (!cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.z)) continue;
      terrains[cell.terrain || 'unknown'] = (terrains[cell.terrain || 'unknown'] || 0) + 1;
      if (cell.kind) counts[cell.kind] = (counts[cell.kind] || 0) + 1;
    }

    const profileName = explicitName || profileNameFromSeed();
    const rawYield = buildIslandRawYieldEconomy(data, { seed, name: profileName });
    return {
      seed,
      name: profileName,
      counts,
      terrains,
      rawYield,
      economy: {
        aspect: 'raw_yield',
        rarityScope: 'raw_yield',
        rarity: rawYield.rarity.label,
        rawYieldScore: rawYield.scores.rawYield,
        buildingScore: rawYield.scores.buildings,
        totalRankScore: rawYield.scores.totalRank,
        leader: rawYield.leader,
      },
    };
  }
  window.__buildIslandRawYieldEconomy = buildIslandRawYieldEconomy;
  window.__buildRandomIslandEconomyProfile = buildRandomIslandEconomyProfile;
