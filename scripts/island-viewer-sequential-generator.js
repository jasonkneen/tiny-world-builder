(function () {
  'use strict';

  const VIEWER_GRID_SIZE = 8;
  const ARCHETYPES = ['pastoral', 'forest', 'quarry', 'river', 'village', 'fortress', 'ruins', 'harbor'];

  function randomSeed() {
    return 'tiny-' + Math.floor(Math.random() * 1000000).toString(36);
  }

  function hashSeed(value) {
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

  function seededRandom(value) {
    let n = hashSeed(value)();
    return function random() {
      let t = (n += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(values, seed) {
    const rng = seededRandom(seed);
    return values[Math.floor(rng() * values.length)] || values[0];
  }

  function normalizeArchetype(value, seed) {
    const raw = String(value || 'random').trim().toLowerCase();
    if (ARCHETYPES.includes(raw)) return raw;
    return pick(ARCHETYPES, String(seed || '') + '|viewer-archetype');
  }

  function indexFor(x, z) {
    return z * VIEWER_GRID_SIZE + x;
  }

  function xyFor(index) {
    return { x: index % VIEWER_GRID_SIZE, z: Math.floor(index / VIEWER_GRID_SIZE) };
  }

  function inBounds(x, z) {
    return x >= 0 && x < VIEWER_GRID_SIZE && z >= 0 && z < VIEWER_GRID_SIZE;
  }

  function sideNeighborIndex(index, side) {
    const point = xyFor(index);
    if (side === 'n') return inBounds(point.x, point.z - 1) ? indexFor(point.x, point.z - 1) : -1;
    if (side === 's') return inBounds(point.x, point.z + 1) ? indexFor(point.x, point.z + 1) : -1;
    if (side === 'e') return inBounds(point.x + 1, point.z) ? indexFor(point.x + 1, point.z) : -1;
    if (side === 'w') return inBounds(point.x - 1, point.z) ? indexFor(point.x - 1, point.z) : -1;
    return -1;
  }

  function cardinalNeighbors(index) {
    return ['n', 'e', 's', 'w']
      .map(side => sideNeighborIndex(index, side))
      .filter(next => next >= 0);
  }

  function distanceBetween(a, b) {
    const pa = xyFor(a);
    const pb = xyFor(b);
    return Math.abs(pa.x - pb.x) + Math.abs(pa.z - pb.z);
  }

  function sideTowardIndex(fromIndex, toIndex) {
    const from = xyFor(fromIndex);
    const to = xyFor(toIndex);
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 'e' : 'w';
    return dz >= 0 ? 's' : 'n';
  }

  function rotationYForSide(side) {
    if (side === 'n') return Math.PI;
    if (side === 'e') return Math.PI / 2;
    if (side === 'w') return -Math.PI / 2;
    return 0;
  }

  function cellRand(seed, index, salt) {
    const point = xyFor(index);
    return seededRandom(String(seed) + '|cell|' + point.x + '|' + point.z + '|' + salt)();
  }

  function makeBaseCells() {
    return Array.from({ length: VIEWER_GRID_SIZE * VIEWER_GRID_SIZE }, () => ({
      terrain: 'grass',
      object: null,
      path: false,
      doorSide: null,
      motif: null,
      fenceEdges: null,
    }));
  }

  function hasPath(cell) {
    return !!(cell && cell.terrain !== 'water' && cell.path === true);
  }

  function markPath(cells, index) {
    if (!cells[index] || cells[index].terrain === 'water') return false;
    cells[index].terrain = 'grass';
    cells[index].path = true;
    return true;
  }

  function hasFenceEdges(cell) {
    return !!(cell && Array.isArray(cell.fenceEdges) && cell.fenceEdges.length);
  }

  function addFenceEdge(cells, index, side, level, style) {
    if (!cells[index] || ['n', 'e', 's', 'w'].indexOf(side) === -1) return false;
    if (!cells[index].fenceEdges) cells[index].fenceEdges = [];
    const fenceStyle = style === 'garden' || style === 'gate' ? style : 'wood';
    const fenceLevel = Math.max(1, Math.min(8, Math.round(level || 1)));
    const existing = cells[index].fenceEdges.find(edge => edge.side === side && edge.style === fenceStyle);
    if (existing) {
      existing.level = Math.max(existing.level || 1, fenceLevel);
      return false;
    }
    cells[index].fenceEdges.push({ side, level: fenceLevel, style: fenceStyle });
    return true;
  }

  function firstHouseIndex(seed) {
    const inset = 2;
    const count = VIEWER_GRID_SIZE - inset * 2;
    const roll = Math.floor(seededRandom(String(seed) + '|first-house')() * count * count);
    return indexFor(inset + (roll % count), inset + Math.floor(roll / count));
  }

  function towerIndexes(seed, houseIndex) {
    const corners = [
      indexFor(0, 0),
      indexFor(VIEWER_GRID_SIZE - 1, 0),
      indexFor(VIEWER_GRID_SIZE - 1, VIEWER_GRID_SIZE - 1),
      indexFor(0, VIEWER_GRID_SIZE - 1),
    ];
    corners.sort((a, b) => {
      const distanceDelta = distanceBetween(b, houseIndex) - distanceBetween(a, houseIndex);
      if (distanceDelta) return distanceDelta;
      return cellRand(seed, a, 'tower-corner-tie') - cellRand(seed, b, 'tower-corner-tie');
    });
    const roll = seededRandom(String(seed) + '|tower-count')();
    const count = roll < 0.125 ? 4 : roll < 0.25 ? 3 : roll < 0.5 ? 2 : 1;
    return corners.slice(0, count);
  }

  function anchors(seed) {
    const house = firstHouseIndex(seed);
    const towers = towerIndexes(seed, house);
    return {
      house,
      tower: towers[0],
      towers,
    };
  }

  function placeFirstHouseLayer(cells, seed) {
    const a = anchors(seed);
    cells[a.house].object = 'house';
    cells[a.house].doorSide = sideTowardIndex(a.house, a.tower);
    return a.house;
  }

  function placeTowerLayer(cells, seed) {
    const a = anchors(seed);
    for (const tower of a.towers) {
      cells[tower].object = 'watchtower';
      cells[tower].doorSide = sideTowardIndex(tower, a.house);
    }
    return a.towers;
  }

  function isHouseSideCell(index, houseIndex) {
    return ['n', 'e', 's', 'w'].some(side => sideNeighborIndex(houseIndex, side) === index);
  }

  function pathRoute(cells, startIndex, endIndex, houseIndex) {
    if (startIndex < 0 || endIndex < 0) return [];
    const queue = [startIndex];
    const seen = new Set([startIndex]);
    const previous = new Map();
    while (queue.length) {
      const current = queue.shift();
      if (current === endIndex) {
        const route = [current];
        let cursor = current;
        while (previous.has(cursor)) {
          cursor = previous.get(cursor);
          route.push(cursor);
        }
        return route.reverse();
      }
      for (const next of cardinalNeighbors(current)) {
        if (seen.has(next)) continue;
        const cell = cells[next];
        if (!cell) continue;
        if (cell.object && next !== endIndex) continue;
        if (next !== startIndex && next !== endIndex && isHouseSideCell(next, houseIndex)) continue;
        seen.add(next);
        previous.set(next, current);
        queue.push(next);
      }
    }
    return [];
  }

  function carvePath(cells, startIndex, endIndex, houseIndex) {
    for (const index of pathRoute(cells, startIndex, endIndex, houseIndex)) {
      if (cells[index] && !cells[index].object) markPath(cells, index);
    }
  }

  function connectHouseTowerPathLayer(cells, seed) {
    const a = anchors(seed);
    const houseFront = sideNeighborIndex(a.house, cells[a.house].doorSide);
    for (const tower of a.towers) {
      const towerFront = sideNeighborIndex(tower, cells[tower].doorSide);
      carvePath(cells, houseFront, towerFront, a.house);
    }
  }

  function additionalHouseCount(seed) {
    let count = 0;
    if (seededRandom(String(seed) + '|extra-house-2')() < 0.5) {
      count++;
      if (seededRandom(String(seed) + '|extra-house-3')() < 0.25) {
        count++;
        if (seededRandom(String(seed) + '|extra-house-4')() < 0.125) count++;
      }
    }
    return count;
  }

  function houseIndexes(cells) {
    const indexes = [];
    for (let index = 0; index < cells.length; index++) {
      if (cells[index] && (cells[index].object === 'house' || cells[index].object === 'manor')) indexes.push(index);
    }
    return indexes;
  }

  function plainHouseIndexes(cells) {
    const indexes = [];
    for (let index = 0; index < cells.length; index++) {
      if (cells[index] && cells[index].object === 'house') indexes.push(index);
    }
    return indexes;
  }

  function houseSpacingOk(cells, index) {
    return houseIndexes(cells).every(houseIndex => {
      const a = xyFor(index);
      const b = xyFor(houseIndex);
      return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) >= 2;
    });
  }

  function extraHouseCandidates(cells, seed, ordinal) {
    const candidates = [];
    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index];
      if (!cell || cell.object || hasPath(cell) || cell.terrain === 'water') continue;
      if (cell.motif || hasFenceEdges(cell)) continue;
      if (!houseSpacingOk(cells, index)) continue;
      const pathSides = ['n', 'e', 's', 'w'].filter(side => {
        const neighbor = sideNeighborIndex(index, side);
        return neighbor >= 0 && hasPath(cells[neighbor]);
      });
      if (pathSides.length !== 1) continue;
      candidates.push({
        index,
        side: pathSides[0],
        score: cellRand(seed, index, 'extra-house-pick-' + ordinal + '-' + pathSides[0]),
      });
    }
    candidates.sort((a, b) => a.score - b.score);
    return candidates;
  }

  function cloneCells(cells) {
    return cells.map(cell => {
      if (!cell) return cell;
      return {
        ...cell,
        fenceEdges: Array.isArray(cell.fenceEdges) ? cell.fenceEdges.map(edge => ({ ...edge })) : null,
      };
    });
  }

  function plotCandidates(cells, seed, salt) {
    const candidates = [];
    for (let z = 0; z < VIEWER_GRID_SIZE - 1; z++) {
      for (let x = 0; x < VIEWER_GRID_SIZE - 1; x++) {
        const patch = [indexFor(x, z), indexFor(x + 1, z), indexFor(x, z + 1), indexFor(x + 1, z + 1)];
        if (!patch.every(index => cells[index]
          && !cells[index].object
          && !cells[index].motif
          && !hasPath(cells[index])
          && cells[index].terrain !== 'water'
          && !hasFenceEdges(cells[index]))) continue;
        const patchSet = new Set(patch);
        const pathEdges = [];
        for (const index of patch) {
          for (const side of ['n', 'e', 's', 'w']) {
            const neighbor = sideNeighborIndex(index, side);
            if (neighbor >= 0 && !patchSet.has(neighbor) && hasPath(cells[neighbor])) {
              pathEdges.push({ index, side });
            }
          }
        }
        if (!pathEdges.length) continue;
        candidates.push({ patch, pathEdges, score: seededRandom(String(seed) + '|' + salt + '|' + x + ',' + z)() });
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    return candidates;
  }

  function gateKey(candidate, seed, salt) {
    if (!candidate || !Array.isArray(candidate.pathEdges) || !candidate.pathEdges.length) return '';
    const gates = candidate.pathEdges
      .map(edge => ({
        edge,
        key: edge.index + ':' + edge.side,
        score: seededRandom(String(seed) + '|' + salt + '|gate|' + edge.index + ':' + edge.side)(),
      }))
      .sort((a, b) => a.score === b.score ? a.key.localeCompare(b.key) : a.score - b.score);
    return gates[0].key;
  }

  function cropCandidates(cells, seed) {
    return plotCandidates(cells, seed, 'crop-area');
  }

  function animalCandidates(cells, seed) {
    return plotCandidates(cells, seed, 'animal-area');
  }

  function placeFencedCropAreaLayer(cells, seed) {
    const candidate = cropCandidates(cells, seed)[0];
    if (!candidate) return [];
    const cropIds = ['wheat', 'corn', 'carrot', 'pumpkin', 'sunflower'];
    const patchSet = new Set(candidate.patch);
    const gate = gateKey(candidate, seed, 'crop-area');
    candidate.patch.forEach(index => {
      const roll = cellRand(seed, index, 'crop-area-fill');
      cells[index].object = roll < 0.25 ? null : cropIds[Math.min(cropIds.length - 1, Math.floor(((roll - 0.25) / 0.75) * cropIds.length))];
      cells[index].terrain = 'dirt';
      cells[index].motif = 'crop-area';
      for (const side of ['n', 'e', 's', 'w']) {
        const neighbor = sideNeighborIndex(index, side);
        if (neighbor >= 0 && patchSet.has(neighbor)) continue;
        addFenceEdge(cells, index, side, 1, gate === index + ':' + side ? 'gate' : 'garden');
      }
    });
    return candidate.patch;
  }

  function placeFencedAnimalAreaLayer(cells, seed) {
    const candidate = animalCandidates(cells, seed)[0];
    if (!candidate) return [];
    const patchSet = new Set(candidate.patch);
    const gate = gateKey(candidate, seed, 'animal-area');
    candidate.patch.forEach(index => {
      cells[index].terrain = 'grass';
      cells[index].motif = 'animal-area';
      if (cellRand(seed, index, 'animal-fill') < 0.5) {
        cells[index].object = cellRand(seed, index, 'animal-kind') < 0.75 ? 'sheep' : 'cow';
      }
      for (const side of ['n', 'e', 's', 'w']) {
        const neighbor = sideNeighborIndex(index, side);
        if (neighbor >= 0 && patchSet.has(neighbor)) continue;
        addFenceEdge(cells, index, side, 2, gate === index + ':' + side ? 'gate' : 'wood');
      }
    });
    return candidate.patch;
  }

  function keepsPlotCapacity(cells, seed, candidate) {
    if (!candidate) return false;
    const trial = cloneCells(cells);
    trial[candidate.index].object = 'house';
    trial[candidate.index].doorSide = candidate.side;
    if (!cropCandidates(trial, seed).length) return false;
    placeFencedCropAreaLayer(trial, seed);
    return animalCandidates(trial, seed).length > 0;
  }

  function placeAdditionalHousesLayer(cells, seed) {
    const placed = [];
    for (let i = 0; i < additionalHouseCount(seed); i++) {
      const candidate = extraHouseCandidates(cells, seed, i)
        .find(option => keepsPlotCapacity(cells, seed, option));
      if (!candidate) break;
      cells[candidate.index].object = 'house';
      cells[candidate.index].doorSide = candidate.side;
      placed.push(candidate.index);
    }
    return placed;
  }

  function sideOffsetsForSide(side) {
    if (side === 'n') return { forward: [0, -1], back: [0, 1], lateral: [1, 0] };
    if (side === 'e') return { forward: [1, 0], back: [-1, 0], lateral: [0, 1] };
    if (side === 'w') return { forward: [-1, 0], back: [1, 0], lateral: [0, 1] };
    return { forward: [0, 1], back: [0, -1], lateral: [1, 0] };
  }

  function manorFootprintIndexes(anchorIndex, doorSide) {
    const point = xyFor(anchorIndex);
    const offsets = sideOffsetsForSide(doorSide);
    const cells = [];
    for (const lateral of [-1, 0, 1]) {
      for (const depth of [0, 1]) {
        const x = point.x + offsets.lateral[0] * lateral + offsets.back[0] * depth;
        const z = point.z + offsets.lateral[1] * lateral + offsets.back[1] * depth;
        if (!inBounds(x, z)) return [];
        cells.push(indexFor(x, z));
      }
    }
    return [...new Set(cells)];
  }

  function doorFrontIndex(anchorIndex, doorSide) {
    return sideNeighborIndex(anchorIndex, doorSide);
  }

  function isHouseProtectedSideCell(cells, index) {
    for (let houseIndex = 0; houseIndex < cells.length; houseIndex++) {
      const cell = cells[houseIndex];
      if (!cell || (cell.object !== 'house' && cell.object !== 'watchtower' && cell.object !== 'manor')) continue;
      if (!['n', 'e', 's', 'w'].some(side => sideNeighborIndex(houseIndex, side) === index)) continue;
      if (doorFrontIndex(houseIndex, cell.doorSide || 's') === index) continue;
      return true;
    }
    return false;
  }

  function canRouteManorPathCell(cells, index, startIndex, blocked) {
    if (!cells[index] || blocked.has(index)) return false;
    if (hasPath(cells[index])) return true;
    if (isHouseProtectedSideCell(cells, index)) return false;
    return !!(cells[index]
      && !cells[index].object
      && !cells[index].motif
      && cells[index].terrain !== 'water'
      && !hasFenceEdges(cells[index]));
  }

  function routeManorDoorToPath(cells, startIndex, blocked) {
    if (startIndex < 0 || !cells[startIndex] || blocked.has(startIndex)) return [];
    if (hasPath(cells[startIndex])) return [startIndex];
    const queue = [startIndex];
    const seen = new Set([startIndex]);
    const previous = new Map();
    while (queue.length) {
      const current = queue.shift();
      for (const next of cardinalNeighbors(current)) {
        if (seen.has(next) || blocked.has(next)) continue;
        if (hasPath(cells[next])) {
          const route = [next, current];
          let cursor = current;
          while (previous.has(cursor)) {
            cursor = previous.get(cursor);
            route.push(cursor);
          }
          return route.reverse();
        }
        if (!canRouteManorPathCell(cells, next, startIndex, blocked)) continue;
        seen.add(next);
        previous.set(next, current);
        queue.push(next);
      }
    }
    return [];
  }

  function manorCandidates(cells, seed) {
    const candidates = [];
    for (let index = 0; index < cells.length; index++) {
      for (const side of ['n', 'e', 's', 'w']) {
        const footprint = manorFootprintIndexes(index, side);
        if (footprint.length !== 6) continue;
        if (!footprint.every(cellIndex => isEmptyBuildableCell(cells, cellIndex))) continue;
        const blocked = new Set(footprint);
        const front = doorFrontIndex(index, side);
        if (!canRouteManorPathCell(cells, front, front, blocked)) continue;
        const route = routeManorDoorToPath(cells, front, blocked);
        if (!route.length || !route.some(routeIndex => hasPath(cells[routeIndex]))) continue;
        candidates.push({
          index,
          side,
          footprint,
          route,
          score: route.length
            + (isEdgeIndex(index) ? 1 : 0)
            + cellRand(seed, index, 'manor-' + side) * 0.5,
        });
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    return candidates;
  }

  function placeManorLayer(cells, seed) {
    if (plainHouseIndexes(cells).length < 3) return null;
    if (seededRandom(String(seed) + '|manor-chance')() >= 0.25) return null;
    const candidate = manorCandidates(cells, seed)[0];
    if (!candidate) return null;
    for (const index of candidate.footprint) cells[index].motif = 'manor-footprint';
    cells[candidate.index].object = 'manor';
    cells[candidate.index].doorSide = candidate.side;
    cells[candidate.index].motif = 'manor';
    for (const index of candidate.route) {
      if (cells[index] && !cells[index].object) markPath(cells, index);
    }
    return candidate.index;
  }

  function isEmptyBuildableCell(cells, index) {
    const cell = cells[index];
    return !!(cell
      && !cell.object
      && !cell.motif
      && !hasPath(cell)
      && cell.terrain !== 'water'
      && !hasFenceEdges(cell));
  }

  function rockPatch(cells, seed) {
    const candidates = [];
    for (let z = 0; z < VIEWER_GRID_SIZE - 1; z++) {
      for (let x = 0; x < VIEWER_GRID_SIZE - 1; x++) {
        const patch = [indexFor(x, z), indexFor(x + 1, z), indexFor(x, z + 1), indexFor(x + 1, z + 1)];
        if (!patch.every(index => isEmptyBuildableCell(cells, index))) continue;
        candidates.push({ patch, score: seededRandom(String(seed) + '|rock-patch|' + x + ',' + z)() });
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    return candidates.length ? candidates[0].patch : [];
  }

  function compactRockPatch(cells, seed) {
    const emptyIndexes = [];
    for (let index = 0; index < cells.length; index++) {
      if (isEmptyBuildableCell(cells, index)) emptyIndexes.push(index);
    }
    const emptySet = new Set(emptyIndexes);
    const candidates = [];
    for (const startIndex of emptyIndexes) {
      const patch = [startIndex];
      const used = new Set(patch);
      while (patch.length < 4) {
        const nextOptions = [];
        for (const index of patch) {
          for (const neighbor of cardinalNeighbors(index)) {
            if (!emptySet.has(neighbor) || used.has(neighbor)) continue;
            nextOptions.push({
              index: neighbor,
              score: distanceBetween(startIndex, neighbor)
                + cellRand(seed, neighbor, 'rock-cluster-' + startIndex) * 0.35,
            });
          }
        }
        if (!nextOptions.length) break;
        nextOptions.sort((a, b) => a.score - b.score);
        patch.push(nextOptions[0].index);
        used.add(nextOptions[0].index);
      }
      if (patch.length !== 4) continue;
      candidates.push({
        patch,
        score: patch.reduce((sum, index) => sum + distanceBetween(startIndex, index), 0)
          + cellRand(seed, startIndex, 'rock-cluster-patch') * 0.5,
      });
    }
    candidates.sort((a, b) => a.score - b.score);
    return candidates.length ? candidates[0].patch : [];
  }

  function placeRockPatchLayer(cells, seed) {
    const patch = rockPatch(cells, seed);
    const quarryPatch = patch.length === 4 ? patch : compactRockPatch(cells, seed);
    const oreMetals = ['copper', 'iron', 'silver', 'gold'];
    quarryPatch.forEach((index, oreIndex) => {
      cells[index].terrain = 'stone';
      cells[index].object = 'ore';
      cells[index].oreMetal = oreMetals[oreIndex % oreMetals.length];
      cells[index].motif = 'quarry';
    });
    return quarryPatch;
  }

  function isEdgeIndex(index) {
    const point = xyFor(index);
    return point.x === 0 || point.z === 0 || point.x === VIEWER_GRID_SIZE - 1 || point.z === VIEWER_GRID_SIZE - 1;
  }

  function waterStarts(cells, seed) {
    const center = (VIEWER_GRID_SIZE - 1) / 2;
    const starts = [];
    for (let index = 0; index < cells.length; index++) {
      if (!isEmptyBuildableCell(cells, index) || isEdgeIndex(index)) continue;
      const point = xyFor(index);
      const inner = point.x >= 2 && point.z >= 2 && point.x <= VIEWER_GRID_SIZE - 3 && point.z <= VIEWER_GRID_SIZE - 3;
      starts.push({
        index,
        score: (inner ? 0 : 2)
          + Math.abs(point.x - center) * 0.35
          + Math.abs(point.z - center) * 0.35
          + cellRand(seed, index, 'water-start') * 0.4,
      });
    }
    starts.sort((a, b) => a.score - b.score);
    return starts;
  }

  function waterEdges(cells, seed) {
    const center = (VIEWER_GRID_SIZE - 1) / 2;
    const edges = [];
    for (let index = 0; index < cells.length; index++) {
      if (!isEdgeIndex(index) || !isEmptyBuildableCell(cells, index)) continue;
      const point = xyFor(index);
      edges.push({
        index,
        score: Math.min(Math.abs(point.x - center), Math.abs(point.z - center)) * 0.1
          + cellRand(seed, index, 'water-edge'),
      });
    }
    edges.sort((a, b) => a.score - b.score);
    return edges;
  }

  function waterPathComponents(cells) {
    const components = new Map();
    let nextId = 1;
    for (let index = 0; index < cells.length; index++) {
      if (components.has(index) || !hasPath(cells[index])) continue;
      const id = nextId++;
      const queue = [index];
      components.set(index, id);
      while (queue.length) {
        const current = queue.shift();
        for (const neighbor of cardinalNeighbors(current)) {
          if (components.has(neighbor) || !hasPath(cells[neighbor])) continue;
          components.set(neighbor, id);
          queue.push(neighbor);
        }
      }
    }
    return components;
  }

  function waterRouteStateKey(index, crossedComponents) {
    const crossed = Array.from(crossedComponents || []).sort((a, b) => a - b).join(',');
    return index + '|' + crossed;
  }

  function canWaterUseCell(cells, index, endIndex, pathComponents, crossedComponents) {
    if (!cells[index]) return false;
    if (index !== endIndex && isEdgeIndex(index)) return false;
    if (isEmptyBuildableCell(cells, index)) return true;
    if (index === endIndex || !hasPath(cells[index])) return false;
    const componentId = pathComponents.get(index);
    return Number.isFinite(componentId) && !crossedComponents.has(componentId);
  }

  function waterRoute(cells, seed, startIndex, endIndex) {
    const end = xyFor(endIndex);
    const pathComponents = waterPathComponents(cells);
    const startState = { index: startIndex, crossedComponents: new Set(), cost: 0, score: 0 };
    const startKey = waterRouteStateKey(startIndex, startState.crossedComponents);
    const frontier = [startState];
    const best = new Map([[startKey, 0]]);
    const previous = new Map();
    const states = new Map([[startKey, startState]]);
    while (frontier.length) {
      frontier.sort((a, b) => a.score - b.score);
      const current = frontier.shift();
      const currentKey = waterRouteStateKey(current.index, current.crossedComponents);
      if (best.has(currentKey) && best.get(currentKey) < current.cost) continue;
      if (current.index === endIndex) {
        const route = [endIndex];
        let cursor = currentKey;
        while (previous.has(cursor)) {
          cursor = previous.get(cursor);
          route.push(states.get(cursor).index);
        }
        return route.reverse();
      }
      for (const next of cardinalNeighbors(current.index)) {
        if (!canWaterUseCell(cells, next, endIndex, pathComponents, current.crossedComponents)) continue;
        const crossedComponents = new Set(current.crossedComponents);
        const componentId = pathComponents.get(next);
        if (Number.isFinite(componentId)) crossedComponents.add(componentId);
        const nextKey = waterRouteStateKey(next, crossedComponents);
        const stepCost = current.cost + 1 + (hasPath(cells[next]) ? 0.35 : 0);
        if (best.has(nextKey) && best.get(nextKey) <= stepCost) continue;
        best.set(nextKey, stepCost);
        previous.set(nextKey, currentKey);
        const point = xyFor(next);
        const heuristic = Math.abs(point.x - end.x) + Math.abs(point.z - end.z);
        const jitter = seededRandom(String(seed) + '|water-route|' + current.index + '>' + next + '|' + endIndex)() * 0.12;
        const nextState = { index: next, crossedComponents, cost: stepCost, score: stepCost + heuristic + jitter };
        states.set(nextKey, nextState);
        frontier.push(nextState);
      }
    }
    return [];
  }

  function waterPlan(cells, seed) {
    for (const start of waterStarts(cells, seed)) {
      for (const edge of waterEdges(cells, seed)) {
        const route = waterRoute(cells, seed, start.index, edge.index);
        if (Array.isArray(route) && route.length >= 2) return { route };
      }
    }
    return null;
  }

  function carveWaterCell(cells, index) {
    if (!cells[index]) return;
    cells[index].terrain = 'water';
    cells[index].path = false;
    cells[index].motif = 'water-route';
    cells[index].object = null;
  }

  function widenWaterEdge(cells, seed, endIndex) {
    const end = xyFor(endIndex);
    const horizontalEdge = end.z === 0 || end.z === VIEWER_GRID_SIZE - 1;
    const target = 1 + Math.floor(cellRand(seed, endIndex, 'water-edge-width') * 3);
    const offsets = [-1, 1, -2, 2];
    let count = 1;
    for (const offset of offsets) {
      if (count >= target) break;
      const x = horizontalEdge ? end.x + offset : end.x;
      const z = horizontalEdge ? end.z : end.z + offset;
      if (!inBounds(x, z)) continue;
      const index = indexFor(x, z);
      if (!isEmptyBuildableCell(cells, index)) continue;
      if (!cardinalNeighbors(index).some(next => cells[next] && cells[next].terrain === 'water')) continue;
      carveWaterCell(cells, index);
      count++;
    }
  }

  function placeWaterRouteLayer(cells, seed) {
    const plan = waterPlan(cells, seed);
    if (!plan) return [];
    for (const index of plan.route) carveWaterCell(cells, index);
    widenWaterEdge(cells, seed, plan.route[plan.route.length - 1]);
    return plan.route;
  }

  function pathWaterPathBridgeAxis(cells, index) {
    if (!cells[index] || cells[index].terrain !== 'water') return null;
    const west = sideNeighborIndex(index, 'w');
    const east = sideNeighborIndex(index, 'e');
    const north = sideNeighborIndex(index, 'n');
    const south = sideNeighborIndex(index, 's');
    const westPath = west >= 0 && hasPath(cells[west]);
    const eastPath = east >= 0 && hasPath(cells[east]);
    const northPath = north >= 0 && hasPath(cells[north]);
    const southPath = south >= 0 && hasPath(cells[south]);
    const westWater = west >= 0 && cells[west] && cells[west].terrain === 'water';
    const eastWater = east >= 0 && cells[east] && cells[east].terrain === 'water';
    const northWater = north >= 0 && cells[north] && cells[north].terrain === 'water';
    const southWater = south >= 0 && cells[south] && cells[south].terrain === 'water';
    if (westPath && eastPath && northWater && southWater && !northPath && !southPath) return 'x';
    if (northPath && southPath && westWater && eastWater && !westPath && !eastPath) return 'z';
    return null;
  }

  function placePathWaterPathBridgesLayer(cells) {
    const bridges = [];
    for (let index = 0; index < cells.length; index++) {
      const axis = pathWaterPathBridgeAxis(cells, index);
      if (!axis) continue;
      cells[index].object = 'bridge';
      cells[index].motif = 'path-water-path-bridge';
      bridges.push(index);
    }
    return bridges;
  }

  function isPerpendicularSidePair(a, b) {
    if (!a || !b || a === b) return false;
    return !((a === 'n' && b === 's')
      || (a === 's' && b === 'n')
      || (a === 'e' && b === 'w')
      || (a === 'w' && b === 'e'));
  }

  function lampCornerSides(cells, index) {
    const sides = ['n', 'e', 's', 'w'].filter(side => {
      const neighbor = sideNeighborIndex(index, side);
      return neighbor >= 0 && hasPath(cells[neighbor]);
    });
    if (sides.length !== 2 || !isPerpendicularSidePair(sides[0], sides[1])) return null;
    return sides;
  }

  function nearbyLampValue(cells, index) {
    let value = 0;
    for (let other = 0; other < cells.length; other++) {
      const cell = cells[other];
      if (!cell || distanceBetween(index, other) > 2) continue;
      if (cell.object === 'house') value += 3;
      else if (cell.object === 'watchtower') value += 2;
      else if (cell.object === 'bridge') value += 2;
      else if (cell.object === 'wheat' || cell.object === 'corn' || cell.object === 'carrot' || cell.object === 'pumpkin') value += 1;
      else if (cell.object === 'cow' || cell.object === 'sheep') value += 1;
      if (hasFenceEdges(cell)) value += 0.5;
    }
    return value;
  }

  function lampSpacingOk(placed, index) {
    return placed.every(other => distanceBetween(other, index) > 3);
  }

  function placeStrategicLampLayer(cells, seed) {
    const candidates = [];
    for (let index = 0; index < cells.length; index++) {
      if (!isEmptyBuildableCell(cells, index)) continue;
      const sides = lampCornerSides(cells, index);
      if (!sides) continue;
      candidates.push({
        index,
        score: -nearbyLampValue(cells, index)
          + (isEdgeIndex(index) ? 0.35 : 0)
          + cellRand(seed, index, 'strategic-lamp') * 0.25,
      });
    }
    candidates.sort((a, b) => a.score - b.score);

    const placed = [];
    for (const candidate of candidates) {
      if (!lampSpacingOk(placed, candidate.index)) continue;
      cells[candidate.index].object = 'lamp-post';
      cells[candidate.index].motif = 'path-lamp';
      placed.push(candidate.index);
      if (placed.length >= 4) break;
    }
    return placed;
  }

  function nearbyDecorationValue(cells, index) {
    let value = 0;
    for (let other = 0; other < cells.length; other++) {
      const cell = cells[other];
      const distance = distanceBetween(index, other);
      if (!cell || distance > 2) continue;
      if (hasPath(cell)) value += distance === 1 ? 2 : 0.8;
      if (cell.object === 'house' || cell.object === 'manor') value += distance === 1 ? 2 : 1;
      if (cell.object === 'watchtower') value += 0.8;
      if (hasFenceEdges(cell)) value += 1;
      if (cell.terrain === 'water') value += 0.7;
    }
    return value;
  }

  function placedSpacingOk(placed, index, minDistance) {
    return placed.every(other => distanceBetween(other, index) > minDistance);
  }

  function treeCandidates(cells, seed) {
    const candidates = [];
    const center = (VIEWER_GRID_SIZE - 1) / 2;
    for (let index = 0; index < cells.length; index++) {
      if (!isEmptyBuildableCell(cells, index)) continue;
      const point = xyFor(index);
      const edgeBias = isEdgeIndex(index) ? -0.8 : 0;
      const centerDistance = Math.abs(point.x - center) + Math.abs(point.z - center);
      candidates.push({
        index,
        score: edgeBias
          - centerDistance * 0.08
          + nearbyDecorationValue(cells, index) * 0.2
          + cellRand(seed, index, 'tree-layer') * 0.6,
      });
    }
    candidates.sort((a, b) => a.score - b.score);
    return candidates;
  }

  function bushCandidates(cells, seed) {
    const candidates = [];
    for (let index = 0; index < cells.length; index++) {
      if (!isEmptyBuildableCell(cells, index)) continue;
      candidates.push({
        index,
        score: -nearbyDecorationValue(cells, index)
          + (isEdgeIndex(index) ? 0.2 : 0)
          + cellRand(seed, index, 'bush-layer') * 0.4,
      });
    }
    candidates.sort((a, b) => a.score - b.score);
    return candidates;
  }

  function placeTreeBushLayer(cells, seed) {
    const placedTrees = [];
    const placedBushes = [];
    const treeTarget = 1 + Math.floor(seededRandom(String(seed) + '|tree-target')() * 3);
    const bushTarget = 2 + Math.floor(seededRandom(String(seed) + '|bush-target')() * 4);

    for (const candidate of treeCandidates(cells, seed)) {
      if (placedTrees.length >= treeTarget) break;
      if (!placedSpacingOk(placedTrees, candidate.index, 2)) continue;
      cells[candidate.index].object = 'tree';
      cells[candidate.index].motif = 'tree-grove';
      placedTrees.push(candidate.index);
    }

    for (const candidate of bushCandidates(cells, seed)) {
      if (placedBushes.length >= bushTarget) break;
      if (!placedSpacingOk(placedBushes, candidate.index, 1)) continue;
      cells[candidate.index].object = 'bush';
      cells[candidate.index].motif = 'shrub-border';
      placedBushes.push(candidate.index);
    }

    return placedTrees.concat(placedBushes);
  }

  function neighborObjectCount(cells, index, objects) {
    const allowed = new Set(objects || []);
    return cardinalNeighbors(index).filter(neighbor => cells[neighbor] && allowed.has(cells[neighbor].object)).length;
  }

  function neighborTerrainCount(cells, index, terrains) {
    const allowed = new Set(terrains || []);
    return cardinalNeighbors(index).filter(neighbor => cells[neighbor] && allowed.has(cells[neighbor].terrain)).length;
  }

  function weightedInfillOptions(cells, index) {
    const nearWater = neighborTerrainCount(cells, index, ['water']);
    const nearStone = neighborTerrainCount(cells, index, ['stone']) + neighborObjectCount(cells, index, ['stone', 'ore']);
    const nearCrops = neighborObjectCount(cells, index, ['wheat', 'corn', 'carrot', 'pumpkin', 'sunflower']);
    const nearAnimals = neighborObjectCount(cells, index, ['cow', 'sheep']);
    const nearGreenery = neighborObjectCount(cells, index, ['tree', 'bush']);
    const nearBuildings = neighborObjectCount(cells, index, ['house', 'manor', 'watchtower']);
    const nearPath = cardinalNeighbors(index).filter(neighbor => hasPath(cells[neighbor])).length;

    return [
      { id: 'crop', weight: 18 + nearWater * 8 + nearCrops * 5 + nearPath * 2 },
      { id: 'stone', weight: 16 + nearStone * 12 + (isEdgeIndex(index) ? 3 : 0) },
      { id: 'ore', weight: 4 + nearStone * 4 + (isEdgeIndex(index) ? 1 : 0) },
      { id: 'animal', weight: 12 + nearAnimals * 7 + nearWater * 3 },
      { id: 'bush', weight: 22 + nearBuildings * 5 + nearPath * 4 + nearGreenery * 2 },
      { id: 'tree', weight: 16 + (isEdgeIndex(index) ? 7 : 0) + Math.max(0, 2 - nearBuildings) * 2 + nearGreenery },
    ];
  }

  function stoneContextValue(cells, index) {
    let value = 0;
    for (let other = 0; other < cells.length; other++) {
      if (other === index) continue;
      const cell = cells[other];
      if (!cell || (cell.object !== 'stone' && cell.object !== 'ore' && cell.terrain !== 'stone')) continue;
      const distance = distanceBetween(index, other);
      if (distance < 1 || distance > 3) continue;
      value += (cell.object === 'ore' ? 2.4 : 1.4) / distance;
    }
    return value;
  }

  function stoneOutcropCandidates(cells, seed) {
    const candidates = [];
    for (let index = 0; index < cells.length; index++) {
      if (!isEmptyBuildableCell(cells, index)) continue;
      const context = stoneContextValue(cells, index);
      if (context <= 0) continue;
      candidates.push({
        index,
        score: cellRand(seed, index, 'stone-outcrop')
          - context * 0.55
          - (isEdgeIndex(index) ? 0.08 : 0),
      });
    }
    candidates.sort((a, b) => a.score - b.score);
    return candidates;
  }

  function placeStoneOutcropLayer(cells, seed) {
    const placed = [];
    const target = 2 + Math.floor(seededRandom(String(seed) + '|stone-outcrop-target')() * 2);
    for (const candidate of stoneOutcropCandidates(cells, seed)) {
      if (placed.length >= target) break;
      const cell = cells[candidate.index];
      cell.object = 'stone';
      cell.terrain = 'stone';
      cell.motif = 'stone-outcrop';
      placed.push(candidate.index);
    }
    return placed;
  }

  function weightedPick(options, roll) {
    const total = options.reduce((sum, option) => sum + Math.max(0, option.weight || 0), 0);
    if (total <= 0) return options[0] && options[0].id;
    let cursor = roll * total;
    for (const option of options) {
      cursor -= Math.max(0, option.weight || 0);
      if (cursor <= 0) return option.id;
    }
    return options[options.length - 1].id;
  }

  function applyInfillObject(cells, index, id, seed, iteration) {
    const cell = cells[index];
    if (!cell) return false;
    if (id === 'crop') {
      const crops = ['wheat', 'corn', 'carrot', 'pumpkin', 'sunflower'];
      cell.object = pick(crops, String(seed) + '|infill-crop|' + iteration + '|' + index);
      cell.terrain = 'dirt';
      cell.motif = 'infill-crop';
      return true;
    }
    if (id === 'ore') {
      cell.object = 'ore';
      cell.terrain = 'stone';
      cell.motif = 'infill-ore';
      return true;
    }
    if (id === 'stone') {
      cell.object = 'stone';
      cell.terrain = 'stone';
      cell.motif = 'infill-stone';
      return true;
    }
    if (id === 'animal') {
      cell.object = cellRand(seed, index, 'infill-animal-' + iteration) < 0.72 ? 'sheep' : 'cow';
      cell.terrain = 'grass';
      cell.motif = 'infill-animal';
      return true;
    }
    if (id === 'tree') {
      cell.object = 'tree';
      cell.terrain = 'grass';
      cell.motif = 'infill-tree';
      return true;
    }
    cell.object = 'bush';
    cell.terrain = 'grass';
    cell.motif = 'infill-bush';
    return true;
  }

  function placeProbabilisticInfillLayer(cells, seed) {
    const placed = [];
    for (let iteration = 0; iteration < cells.length; iteration++) {
      const candidates = [];
      for (let index = 0; index < cells.length; index++) {
        if (!isEmptyBuildableCell(cells, index)) continue;
        candidates.push({
          index,
          score: cellRand(seed, index, 'infill-order-' + iteration),
        });
      }
      if (!candidates.length) break;
      candidates.sort((a, b) => a.score - b.score);
      const index = candidates[0].index;
      const choice = weightedPick(
        weightedInfillOptions(cells, index),
        cellRand(seed, index, 'infill-choice-' + iteration)
      );
      if (applyInfillObject(cells, index, choice, seed, iteration)) placed.push(index);
    }
    return placed;
  }

  function terrainForCell(cell) {
    if (!cell) return 'grass';
    if (hasPath(cell)) return 'path';
    if (cell.terrain === 'water') return 'water';
    if (cell.object === 'stone' || cell.object === 'ore') return 'stone';
    if (cell.terrain === 'dirt' || ['wheat', 'corn', 'carrot', 'pumpkin', 'sunflower'].includes(cell.object)) return 'dirt';
    return 'grass';
  }

  function fenceExtras(cell) {
    if (!cell || !Array.isArray(cell.fenceEdges)) return [];
    return cell.fenceEdges.map(edge => {
      const extra = {
        kind: 'fence',
        fenceSide: edge.side,
        floors: Math.max(1, Math.min(8, edge.level || 1)),
      };
      if (edge.style === 'garden' || edge.style === 'gate') extra.appearance = { fenceStyle: edge.style };
      return extra;
    });
  }

  function objectForCell(cells, index, seed) {
    const cell = cells[index];
    const object = cell && cell.object;
    const objectStyle = { objectStyle: 'voxel' };
    const floors = (min, max, salt) => min + Math.floor(cellRand(seed, index, salt) * (max - min + 1));
    if (object === 'watchtower') {
      return {
        kind: 'house',
        floors: floors(2, 3, 'watchtower'),
        buildingType: 'tower',
        appearance: objectStyle,
        rotationY: rotationYForSide(cell.doorSide || 's'),
      };
    }
    if (object === 'house') {
      return {
        kind: 'house',
        floors: floors(1, 2, 'house'),
        buildingType: null,
        appearance: objectStyle,
        rotationY: rotationYForSide(cell.doorSide || 's'),
      };
    }
    if (object === 'manor') {
      return {
        kind: 'house',
        floors: 2,
        buildingType: 'manor',
        appearance: objectStyle,
        rotationY: rotationYForSide(cell.doorSide || 's'),
      };
    }
    if (object === 'stone' || object === 'ore') {
      const appearance = object === 'ore'
        ? { objectStyle: 'voxel', oreMetal: cell.oreMetal || pick(['copper', 'iron', 'silver', 'gold'], String(seed) + '|ore|' + index) }
        : objectStyle;
      return {
        kind: 'rock',
        floors: floors(object === 'ore' ? 2 : 1, object === 'ore' ? 4 : 3, object),
        buildingType: null,
        appearance,
      };
    }
    if (['wheat', 'corn', 'carrot', 'pumpkin', 'sunflower'].includes(object)) {
      return { kind: object, floors: floors(1, 3, object), buildingType: null, appearance: objectStyle };
    }
    if (object === 'cow' || object === 'sheep') {
      return { kind: object, floors: 1, buildingType: null, appearance: objectStyle };
    }
    if (object === 'bridge') {
      return { kind: 'bridge', floors: 1, buildingType: null, appearance: objectStyle };
    }
    if (object === 'lamp-post') {
      return { kind: 'lamp-post', floors: 1, buildingType: null, appearance: objectStyle };
    }
    if (object === 'tree') {
      return { kind: 'tree', floors: floors(1, 3, 'tree'), buildingType: null, appearance: objectStyle };
    }
    if (object === 'bush') {
      return { kind: 'bush', floors: floors(1, 2, 'bush'), buildingType: null, appearance: objectStyle };
    }
    return { kind: null, floors: 1, buildingType: null, appearance: null };
  }

  function generateRandomIslandWorld(options = {}) {
    const seed = String(options.seed || randomSeed());
    const archetypeKey = normalizeArchetype(options.archetype || options.archetypeKey, seed);
    const cells = makeBaseCells();
    placeFirstHouseLayer(cells, seed);
    placeTowerLayer(cells, seed);
    connectHouseTowerPathLayer(cells, seed);
    placeAdditionalHousesLayer(cells, seed);
    placeManorLayer(cells, seed);
    placeFencedCropAreaLayer(cells, seed);
    placeFencedAnimalAreaLayer(cells, seed);
    placeRockPatchLayer(cells, seed);
    placeWaterRouteLayer(cells, seed);
    placePathWaterPathBridgesLayer(cells);
    placeStrategicLampLayer(cells, seed);
    placeStoneOutcropLayer(cells, seed);
    placeTreeBushLayer(cells, seed);
    placeProbabilisticInfillLayer(cells, seed);

    const out = { v: 4, gridSize: VIEWER_GRID_SIZE, cells: [] };
    for (let index = 0; index < cells.length; index++) {
      const point = xyFor(index);
      const cell = cells[index];
      const mapped = objectForCell(cells, index, seed);
      const entry = {
        x: point.x,
        z: point.z,
        terrain: terrainForCell(cell),
        kind: mapped.kind,
        floors: mapped.floors || 1,
        terrainFloors: 1,
        buildingType: mapped.kind === 'house' ? (mapped.buildingType || null) : null,
        fenceSide: null,
      };
      if (mapped.appearance) entry.appearance = mapped.appearance;
      const extras = entry.terrain === 'water' ? [] : fenceExtras(cell);
      if (extras.length) entry.extras = extras;
      if (Number.isFinite(mapped.rotationY)) entry.transform = { rotationY: mapped.rotationY };
      out.cells.push(entry);
    }
    out.seed = seed;
    out.archetypeKey = archetypeKey;
    return out;
  }

  function objectIdForProfile(cell) {
    if (!cell) return null;
    if (!cell.kind) {
      return Array.isArray(cell.extras) && cell.extras.some(extra => extra && extra.kind === 'fence') ? 'fence' : null;
    }
    if (cell.kind === 'house') {
      if (cell.buildingType === 'tower') return 'watchtower';
      if (cell.buildingType === 'manor') return 'manor';
      return 'house';
    }
    if (cell.kind === 'rock') return 'stone';
    if (['wheat', 'corn', 'carrot', 'pumpkin', 'sunflower', 'cow', 'sheep', 'fence', 'bridge', 'lamp-post', 'tree', 'bush'].includes(cell.kind)) return cell.kind;
    return null;
  }

  function profileObjectStats(id) {
    if (id === 'watchtower') return { defense: 2.8, commerce: 0.4 };
    if (id === 'house') return { commerce: 1.8, charm: 0.8 };
    if (id === 'manor') return { commerce: 3.2, charm: 1.6, defense: 0.5 };
    if (id === 'stone') return { materials: 1.0 };
    if (id === 'fence') return { defense: 1.1 };
    if (id === 'bridge') return { commerce: 1.2, charm: 0.6 };
    if (id === 'lamp-post') return { commerce: 0.7, charm: 1.1, defense: 0.2 };
    if (id === 'tree') return { materials: 0.8, charm: 1.3 };
    if (id === 'bush') return { food: 0.4, charm: 0.9 };
    if (id === 'corn') return { food: 2.0 };
    if (id === 'wheat') return { food: 1.9 };
    if (id === 'pumpkin') return { food: 1.5, charm: 0.4 };
    if (id === 'carrot') return { food: 1.5 };
    if (id === 'sunflower') return { food: 0.8, charm: 1.4 };
    if (id === 'cow') return { food: 2.2, charm: 0.2 };
    if (id === 'sheep') return { food: 1.2, charm: 1.0 };
    return null;
  }

  function terrainStats(cell) {
    if (cell && cell.terrain === 'water') return { food: 0.4, charm: 0.8 };
    if (cell && cell.terrain === 'path') return { commerce: 0.5 };
    if (cell && cell.terrain === 'dirt') return { materials: 0.2 };
    if (cell && cell.terrain === 'stone') return { materials: 1.1 };
    return { charm: 0.3 };
  }

  function addStats(target, source, factor) {
    const f = Number.isFinite(Number(factor)) ? Number(factor) : 1;
    for (const key of ['food', 'materials', 'commerce', 'defense', 'charm']) {
      target[key] += ((source && Number(source[key])) || 0) * f;
    }
  }

  function cellKey(cell) {
    return cell.x + ',' + cell.z;
  }

  function buildRandomIslandEconomyProfile(data, options = {}) {
    const canonical = window.__buildRandomIslandEconomyProfile;
    if (typeof canonical === 'function' && canonical !== buildRandomIslandEconomyProfile) {
      return canonical(data, options);
    }
    const seed = String(options.seed || (data && data.seed) || 'tiny-1');
    const nameRng = seededRandom(seed + '|raw-yield-name');
    const prefixes = ['Moss', 'Stone', 'Clover', 'Pine', 'Salt', 'Relic', 'Lantern', 'Crown', 'Brook', 'Hearth'];
    const suffixes = ['Hamlet', 'Shoal', 'Rise', 'Watch', 'Crossing', 'Haven', 'Crown', 'Hollow', 'Reach'];
    const name = String(options.name || (data && data.name) || '').trim()
      || prefixes[Math.floor(nameRng() * prefixes.length)] + ' ' + suffixes[Math.floor(nameRng() * suffixes.length)];
    const buildRawYield = window.__buildIslandRawYieldEconomy;
    const rawYield = typeof buildRawYield === 'function'
      ? buildRawYield(data, { seed, name })
      : {
          aspect: 'raw_yield',
          label: 'Raw Yield',
          scoreV: 1,
          seed,
          name,
          resources: {
            crops: { wheat: 0, corn: 0, carrot: 0, pumpkin: 0, sunflower: 0 },
            rockOre: { stone: 0, copper: 0, iron: 0, silver: 0, goldOre: 0 },
            animals: { sheep: 0, cow: 0 },
            nature: { trees: 0, berries: 0, water: 0, fish: 0 },
            buildings: { houses: 0, towers: 0, manor: 0 },
          },
          scores: { crops: 0, rockOre: 0, animals: 0, nature: 0, rawYield: 0, buildings: 0, totalRank: 0 },
          rarity: { id: 'common', label: 'Common', range: { min: 0, max: 169 } },
          leader: { id: 'crops', label: 'Crop-led' },
        };
    return {
      seed,
      name,
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
  function generate(options) {
    return generateRandomIslandWorld(options || {});
  }

  function profile(world, options) {
    return buildRandomIslandEconomyProfile(world, options || {});
  }

  window.TinyWorldIslandGenerator = {
    generate,
    generateRandomIslandWorld,
    buildRandomIslandEconomyProfile,
    profile,
  };
})();
