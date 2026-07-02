  // -------- ghost world generator --------
  // Deterministic — every (boardX, boardZ) produces identical content
  // every time, so panning away and back regenerates the same world.
  //
  // Connection rubric — paths and rivers route along whole rows/columns
  // of boards so they line up across edges:
  //   - A horizontal path's Z is determined by hash(boardZ) alone, so
  //     every board on that row of the world either has the path at the
  //     same Z or doesn't have one at all.
  //   - Vertical paths and rivers work the same way against boardX.
  //   - Where horizontal and vertical paths cross within a board you
  //     get a crossroads.
  //   - Where a river meets a horizontal path you get a bridge tile.
  //
  // Per-cell decoration (houses, trees, crops, rocks) uses cellRand on
  // GLOBAL coords (boardX * GRID + x, boardZ * GRID + z) so a given
  // world cell always renders the same content even if it's reached
  // from different boards or after a session restart.
  function ghostHash(a, b, salt) {
    // Mulberry-ish 32-bit mix of (a, b, salt). Always positive integer.
    let h = (a | 0) * 374761393 + (b | 0) * 668265263 + (salt | 0) * 2147483647;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }
  // Row-shared horizontal path: returns Z within a board, or -1 for none.
  function pathZForRow(boardZ) {
    const h = ghostHash(boardZ, 0, 0xa11ce);
    if ((h % 100) < 30) return -1;          // ~30 % of rows have no road
    return h % GRID;
  }
  // Col-shared vertical path: returns X within a board, or -1 for none.
  function pathXForCol(boardX) {
    const h = ghostHash(boardX, 0, 0xb0b);
    if ((h % 100) < 35) return -1;
    return h % GRID;
  }
  // Col-shared river: returns X within a board, or -1 for none. Rivers
  // are rarer than paths and prefer columns that don't already host a
  // vertical road so we don't bulldoze the road with water.
  function riverXForCol(boardX) {
    const h = ghostHash(boardX, 0, 0xfe11a);
    if ((h % 100) < 88) return -1;          // ~12 % of cols have a river
    let x = h % GRID;
    const px = pathXForCol(boardX);
    if (x === px) x = (x + 1) % GRID;
    return x;
  }

  function makeGhostWorld(boardX, boardZ) {
    const key = ghostBoardKey(boardX, boardZ);
    if (ghostBoardCells.has(key)) return ghostBoardCells.get(key);
    if (ghostBoardsBlank) {
      const blank = makeBlankBoardWorld();
      ghostBoardCells.set(key, blank);
      return blank;
    }

    if (useLandscapeEngine && landscapeEngineInstance) {
      const cells = [];
      const active = isLandscapeMeshActive();
      for (let x = 0; x < GRID; x++) {
        cells[x] = [];
        for (let z = 0; z < GRID; z++) {
          const cell = sampleLandscapeCell(boardX, boardZ, x, z, landscapeEngineInstance, GRID);
          if (active) {
            cell.terrainFloors = 1;
            cell.kind = null;
          }
          cells[x][z] = cell;
        }
      }
      cells.__seed = ghostHash(boardX, boardZ, 0xdec0);
      cells.__pathZ = -1;
      cells.__pathX = -1;
      cells.__riverX = -1;
      ghostBoardCells.set(key, cells);
      return cells;
    }

    const cells = makeBlankBoardWorld();

    // 1) Paths — row & column shared so they connect across board edges.
    const pathZ = pathZForRow(boardZ);
    const pathX = pathXForCol(boardX);
    if (pathZ >= 0) {
      for (let x = 0; x < GRID; x++) cells[x][pathZ].terrain = 'path';
    }
    if (pathX >= 0) {
      for (let z = 0; z < GRID; z++) cells[pathX][z].terrain = 'path';
    }

    // 2) Rivers — column shared so they flow vertically through every
    // board in the column. Where the river crosses a horizontal path,
    // drop a bridge so the road still works.
    const riverX = riverXForCol(boardX);
    if (riverX >= 0) {
      for (let z = 0; z < GRID; z++) {
        cells[riverX][z] = { terrain: 'water', kind: null, floors: 1, buildingType: null, fenceSide: null, extras: [] };
      }
      if (pathZ >= 0) {
        cells[riverX][pathZ] = { terrain: 'water', kind: 'bridge', floors: 1, buildingType: null, fenceSide: null, extras: [] };
      }
    }

    // 3) Decoration — keyed off GLOBAL world coords so every cell is
    // stable regardless of how it was reached.
    const boardSeed = ghostHash(boardX, boardZ, 0xdec0);
    const houseSpots = [
      [1 + (ghostHash(boardX, boardZ, 1) % 6), Math.max(1, (pathZ >= 0 ? pathZ : 3) - 1)],
      [1 + (ghostHash(boardX, boardZ, 2) % 6), Math.min(GRID - 2, (pathZ >= 0 ? pathZ : 3) + 1)],
    ];
    houseSpots.forEach(([x, z], i) => {
      if (x < 0 || x >= GRID || z < 0 || z >= GRID) return;
      if (cells[x][z].terrain === 'water') return;
      if (cells[x][z].terrain === 'path') return;
      cells[x][z] = {
        terrain: cells[x][z].terrain,
        kind: 'house',
        floors: 1 + (ghostHash(boardX, boardZ, 3 + i) % 3),
        buildingType: i % 2 ? 'cottage' : null,
        fenceSide: null,
        extras: [],
      };
    });

    const cropBaseX = ghostHash(boardX, boardZ, 0xc01) % Math.max(1, GRID - 3);
    const cropBaseZ = ghostHash(boardX, boardZ, 0xc11) % Math.max(1, GRID - 2);
    for (let x = cropBaseX; x < cropBaseX + 3 && x < GRID; x++) {
      for (let z = cropBaseZ; z < cropBaseZ + 2 && z < GRID; z++) {
        if (cells[x][z].kind || cells[x][z].terrain === 'water' || cells[x][z].terrain === 'path') continue;
        const cropKinds = ['crop', 'corn', 'wheat', 'pumpkin'];
        const gx = boardX * GRID + x, gz = boardZ * GRID + z;
        cells[x][z] = {
          terrain: 'dirt',
          kind: cropKinds[Math.floor(cellRand(gx, gz, 0xc121) * cropKinds.length)],
          floors: 1, buildingType: null, fenceSide: null, extras: [],
        };
      }
    }

    // Scatter trees / tufts / rocks using global coords so the same
    // patch of world always renders the same scenery.
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(cellRand(boardX * 11 + i, boardZ * 13, 0xa1) * GRID);
      const z = Math.floor(cellRand(boardX * 17, boardZ * 19 + i, 0xa2) * GRID);
      if (cells[x][z].kind || cells[x][z].terrain !== 'grass') continue;
      const gx = boardX * GRID + x, gz = boardZ * GRID + z;
      const r = cellRand(gx, gz, 0xa3);
      cells[x][z] = {
        terrain: 'grass',
        kind: r < 0.55 ? 'tree' : (r < 0.80 ? 'tuft' : 'rock'),
        floors: 1 + Math.floor(cellRand(gx, gz, 0xa4) * 3),
        buildingType: null,
        fenceSide: null,
        extras: [],
      };
    }

    cells.__seed = boardSeed;
    cells.__pathZ = pathZ;
    cells.__pathX = pathX;
    cells.__riverX = riverX;
    ghostBoardCells.set(key, cells);
    return cells;
  }

  // Resolve a cell at any (boardX, boardZ, x, z) — wrapping into the
  // neighbour board when x/z fall outside [0, GRID). Returns null if the
  // board generation is suppressed (e.g. blank ghost mode).
  function ghostCellAt(boardX, boardZ, x, z) {
    let bx = boardX, bz = boardZ;
    if (x < 0)      { bx -= 1; x += GRID; }
    else if (x >= GRID) { bx += 1; x -= GRID; }
    if (z < 0)      { bz -= 1; z += GRID; }
    else if (z >= GRID) { bz += 1; z -= GRID; }
    const gx = bx * GRID + x;
    const gz = bz * GRID + z;
    // Home board (0, 0): world[][] is always the truth, edited or not.
    if (bx === 0 && bz === 0) {
      if (x < 0 || z < 0 || x >= HOME_GRID_MAX || z >= HOME_GRID_MAX) return null;
      return getWorldCell(x, z);
    }
    // Non-home: prefer a USER-EDITED override; otherwise fall through
    // to the generated cells.
    if (world[gx] && world[gx][gz] && world[gx][gz].userEdited) {
      return world[gx][gz];
    }
    const neighbour = makeGhostWorld(bx, bz);
    return neighbour && neighbour[x] && neighbour[x][z] || null;
  }

  // Cross-board aware neighbour helpers. They take the local board coords
  // so they can peek into the neighbouring board when (x, z) sits on an
  // edge — that's how paths and rivers visually continue across boards.
  function getGhostNeighbors(cells, x, z, prop, value, boardX, boardZ) {
    const n = ghostCellAt(boardX, boardZ, x,     z - 1);
    const s = ghostCellAt(boardX, boardZ, x,     z + 1);
    const e = ghostCellAt(boardX, boardZ, x + 1, z);
    const w = ghostCellAt(boardX, boardZ, x - 1, z);
    return {
      n: !!(n && n[prop] === value),
      s: !!(s && s[prop] === value),
      e: !!(e && e[prop] === value),
      w: !!(w && w[prop] === value),
    };
  }

  function getGhostTerrainNeighbors(cells, x, z, boardX, boardZ) {
    const n = ghostCellAt(boardX, boardZ, x,     z - 1);
    const s = ghostCellAt(boardX, boardZ, x,     z + 1);
    const e = ghostCellAt(boardX, boardZ, x + 1, z);
    const w = ghostCellAt(boardX, boardZ, x - 1, z);
    return {
      n: n ? n.terrain : null,
      s: s ? s.terrain : null,
      e: e ? e.terrain : null,
      w: w ? w.terrain : null,
    };
  }

  function ghostBridgeOrientation(cells, x, z) {
    const eastPath = x < GRID - 1 && cells[x + 1][z].terrain === 'path';
    const westPath = x > 0 && cells[x - 1][z].terrain === 'path';
    const southPath = z < GRID - 1 && cells[x][z + 1].terrain === 'path';
    const northPath = z > 0 && cells[x][z - 1].terrain === 'path';
    if ((eastPath || westPath) && !(southPath || northPath)) return 'x';
    if (southPath || northPath) return 'z';
    return x < GRID - 1 || x > 0 ? 'x' : 'z';
  }

  // Cells outside the saved 8x8 home grid are rendered in grayscale so the
  // user can tell at a glance that those areas won't be saved.
  function isOutsideHomeGrid(x, z) {
    return x < 0 || x >= GRID || z < 0 || z >= GRID;
  }

  // Grayscale has been disabled — ghost / out-of-bounds tiles render in
  // their full color. Function kept as a no-op so existing call sites still
  // work without changes.
  function desaturateMaterial(_mat) {
    return;
  }

  // -------- fade material cache --------
  // Every faded mesh used to clone its own material. That meant tens of
  // thousands of unique materials across home + ghost boards, which kills
  // GPU batching and inflates memory. Instead we share a small pool of
  // materials keyed by (base material UUID, grayscale flag, opacity bucket).
  // applyElementOpacity now swaps mesh.material to the right bucket entry
  // rather than mutating opacity on a private clone.
  const FADE_BUCKETS = 16;
  const fadeMatCache = new Map();
  function fadeBucketFor(displayOpacity) {
    if (!(displayOpacity > 0)) return 0;
    if (displayOpacity >= 1) return FADE_BUCKETS;
    return Math.max(1, Math.min(FADE_BUCKETS - 1, Math.round(displayOpacity * FADE_BUCKETS)));
  }
  function pickFadeMaterial(baseMat, grayscale, displayOpacity, keepFadeAtOpaque = false) {
    const bucket = fadeBucketFor(displayOpacity);
    // Fully opaque, non-grayscale → use the shared base material directly.
    // Terrain tiles opt out because the 100% opaque/depth-write snap exposes
    // diagonal face artifacts that are absent at 99% in the fade path.
    if (bucket === FADE_BUCKETS && !grayscale && !keepFadeAtOpaque) return baseMat;
    const key = baseMat.uuid + '|' + (grayscale ? 1 : 0) + '|' + bucket + '|' + (keepFadeAtOpaque ? 1 : 0);
    const hit = fadeMatCache.get(key);
    if (hit) return hit;
    const mat = baseMat.clone();
    if (baseMat.onBeforeCompile) mat.onBeforeCompile = baseMat.onBeforeCompile;
    if (typeof baseMat.customProgramCacheKey === 'function') mat.customProgramCacheKey = baseMat.customProgramCacheKey;
    if (grayscale) desaturateMaterial(mat);
    const baseOp = baseMat.opacity === undefined ? 1 : baseMat.opacity;
    const factor = bucket / FADE_BUCKETS;
    mat.opacity = baseOp * factor;
    if (mat.isShaderMaterial && mat.uniforms && mat.uniforms.uGlobalOpacity) {
      mat.uniforms.uGlobalOpacity.value = mat.opacity;
    }
    mat.transparent = keepFadeAtOpaque || factor < 1 || baseOp < 1;
    mat.depthWrite = keepFadeAtOpaque ? false : (factor >= 1 && baseOp >= 1);
    mat.userData = mat.userData || {};
    mat.userData.cachedFade = true;
    fadeMatCache.set(key, mat);
    return mat;
  }

  const particleMatCache = new Map();
  function getCachedParticleMaterial(baseMat, opacity, colorHex) {
    const qOpacity = Math.round(opacity * 16) / 16;
    const key = baseMat.uuid + '|' + qOpacity + '|' + (colorHex !== undefined ? colorHex : 'default');
    let hit = particleMatCache.get(key);
    if (hit) return hit;
    const mat = baseMat.clone();
    if (baseMat.onBeforeCompile) mat.onBeforeCompile = baseMat.onBeforeCompile;
    if (typeof baseMat.customProgramCacheKey === 'function') mat.customProgramCacheKey = baseMat.customProgramCacheKey;
    if (colorHex !== undefined) {
      mat.color.setHex(colorHex);
    }
    mat.opacity = qOpacity;
    mat.userData = mat.userData || {};
    mat.userData.cached = true;
    particleMatCache.set(key, mat);
    return mat;
  }

  function setCachedParticleMaterial(mesh, baseMat, opacity, colorHex) {
    if (!mesh) return;
    const qOpacity = Math.round(opacity * 16) / 16;
    const key = baseMat.uuid + '|' + qOpacity + '|' + (colorHex !== undefined ? colorHex : 'default');
    if (mesh.userData && mesh.userData._particleMatKey === key) return;
    mesh.material = getCachedParticleMaterial(baseMat, opacity, colorHex);
    mesh.userData = mesh.userData || {};
    mesh.userData._particleMatKey = key;
  }


  function prepareFadeable(group, opts) {
    const { ghost = false, opacity = 1, grayscale = false } = opts || {};
    group.userData.preview = !!ghost;
    const displayOpacity = displayOpacityForRole(group, opacity);
    group.userData.currentOpacity = opacity;
    group.userData.targetOpacity = opacity;
    group.visible = displayOpacity > 0.001;
    opacityRoots.add(group);
    group.traverse(o => {
      if (!o.isMesh || !o.material) return;
      if (o.userData && (o.userData.windowLightEffect || o.userData.lightVisual)) return;
      // Ghost-board terrain neither casts nor receives shadows: the large flat
      // tile plates self-shadow into parallel-band acne under the voxel-tuned
      // shadow bias (sun.shadow.bias/normalBias in 02-cameras-lighting.js are
      // deliberately tight for small voxel pieces). Ghost objects still
      // cast/receive so Preview houses/trees/rocks drop shadows on each other.
      if (ghost) {
        if (group.userData.fadeRole === 'tile') {
          o.castShadow = false;
          o.receiveShadow = false;
        } else if (group.userData.fadeRole === 'object') {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      }
      // Array materials are vanishingly rare in this codebase, but stay safe.
      if (Array.isArray(o.material)) {
        o.material = o.material.map(m => {
          const clone = m.clone();
          if (m.onBeforeCompile) clone.onBeforeCompile = m.onBeforeCompile;
          if (typeof m.customProgramCacheKey === 'function') clone.customProgramCacheKey = m.customProgramCacheKey;
          return clone;
        });
        const mats = o.material;
        mats.forEach(m => {
          if (grayscale) desaturateMaterial(m);
          m.transparent = true;
          m.opacity = (m.opacity === undefined ? 1 : m.opacity) * displayOpacity;
          m.depthWrite = displayOpacity >= 1;
        });
        o.userData.baseOpacity = 1;
        return;
      }
      o.userData.baseMat = o.material;
      o.userData.grayMat = !!grayscale;
      o.userData.baseOpacity = o.material.opacity === undefined ? 1 : o.material.opacity;
      // Home/active terrain must write depth when fully opaque; otherwise the
      // island side shells can sort through it at grazing camera angles. Keep
      // the always-transparent opaque bucket only for preview/ghost tiles that
      // still rely on fade blending.
      o.userData.keepFadeAtOpaque = group.userData.fadeRole === 'tile' && group.userData.preview;
      o.userData._fadeBucket = fadeBucketFor(displayOpacity);
      o.material = pickFadeMaterial(o.material, !!grayscale, displayOpacity, o.userData.keepFadeAtOpaque);
    });
    return group;
  }

  function displayOpacityForRole(root, opacity, opts = {}) {
    if (opacity <= 0) return 0;
    const revealOpacity = Math.min(1, opacity);
    const renderCullOpacity = opts.ignoreRenderCull ? 1 : (root.userData.renderCullOpacity === undefined ? 1 : root.userData.renderCullOpacity);
    if (!root.userData.preview) return revealOpacity * renderCullOpacity;
    const roleOpacity = root.userData.fadeRole === 'tile' ? renderFloorOpacity : renderObjectOpacity;
    return Math.min(1, revealOpacity * renderGhostOpacity * roleOpacity * renderCullOpacity);
  }

  function applyElementOpacity(root, opacity) {
    const displayOpacity = displayOpacityForRole(root, opacity);
    const visible = displayOpacity > 0.001;
    if (root.userData._lastAppliedDisplayOpacity === displayOpacity && root.visible === visible) return;
    root.userData._lastAppliedDisplayOpacity = displayOpacity;
    // Hide invisible roots entirely so the renderer skips their draws.
    root.visible = visible;
    if (!root.visible) return;
    root.traverse(o => {
      if (!o.isMesh) return;
      // Array materials kept their private clones in prepareFadeable, mutate them.
      if (Array.isArray(o.material)) {
        const base = o.userData.baseOpacity === undefined ? 1 : o.userData.baseOpacity;
        o.material.forEach(m => {
          m.transparent = displayOpacity < 1 || base < 1;
          m.opacity = base * displayOpacity;
          m.depthWrite = displayOpacity >= 1 && base >= 1;
        });
        return;
      }
      if (!o.userData.baseMat) return;
      // Skip material swaps when the quantized bucket hasn't changed — most
      // frames this means a single int compare per mesh and no map lookup.
      const bucket = fadeBucketFor(displayOpacity);
      if (o.userData._fadeBucket === bucket) return;
      o.userData._fadeBucket = bucket;
      o.material = pickFadeMaterial(o.userData.baseMat, o.userData.grayMat, displayOpacity, !!o.userData.keepFadeAtOpaque);
    });
  }

  function setElementOpacity(root, opacity, immediate = false) {
    const prevTarget = root.userData.targetOpacity;
    root.userData.targetOpacity = opacity;
    opacityRoots.add(root);
    if (root.userData.currentOpacity === undefined || immediate) {
      root.userData.currentOpacity = opacity;
      root.userData.revealDelay = 0;
      applyElementOpacity(root, opacity);
      return;
    }
    // First time this root is asked to reveal — assign a small random
    // delay so neighbouring pieces stagger in rather than popping as a
    // single block. Also mark it so tickOpacityTransitions plays a
    // quiet rustle the moment it actually starts fading in.
    if (!immediate && opacity > 0 && (prevTarget === undefined || prevTarget <= 0) && (root.userData.currentOpacity || 0) <= 0) {
      root.userData.revealDelay = Math.random() * 0.55;
      root.userData.pendingRevealSfx = true;
    }
  }

  function tickOpacityTransitions(dt) {
    if (!opacityRoots.size) return;
    // Slower ramp than the snap version — gives the world a noticeable
    // "painting in" feel as the camera explores.
    const step = 1 - Math.exp(-dt * 5);

    // Budget the work so a sudden reveal of thousands of ghost boards
    // (e.g. user cranks visible distance on a 128+ grid) doesn't cause
    // a multi-hundred-millisecond frame. We process as many roots as fit
    // in ~3.5ms and leave the rest for subsequent frames.
    const budgetMs = 3.5;
    const start = performance.now();

    let count = 0;
    for (const root of opacityRoots) {
      const targetOpacity = root.userData.targetOpacity;
      if (targetOpacity === undefined) { opacityRoots.delete(root); continue; }
      const current = root.userData.currentOpacity === undefined ? targetOpacity : root.userData.currentOpacity;

      // Stagger: hold the cell at 0 until its random reveal delay
      // counts down.
      if ((root.userData.revealDelay || 0) > 0 && targetOpacity > current) {
        root.userData.revealDelay = Math.max(0, root.userData.revealDelay - dt);
        applyElementOpacity(root, current);
        if (!root.userData.landing) {
          const s = 0.6 + 0.4 * current;
          const baseVec = root.userData.objectScaleBaseVec;
          const baseScale = root.userData.objectScaleBase || 1;
          if (baseVec) root.scale.set(baseVec.x * s, baseVec.y * s, baseVec.z * s);
          else if (Math.abs(root.scale.x - s * baseScale) > 0.001) root.scale.setScalar(s * baseScale);
        }
        continue;
      }
      // Delay just elapsed — fire the reveal SFX exactly once per cell.
      // The internal SFX_MIN_GAP keeps cascades tasteful when many cells
      // start fading in at the same time.
      if (root.userData.pendingRevealSfx && targetOpacity > current && typeof playSfx === 'function') {
        const role = root.userData.fadeRole;
        if (role === 'object') playSfx('land', 0.22);
        else playSfx('rustle', 0.18);
        root.userData.pendingRevealSfx = false;
      }

      const next = current + (targetOpacity - current) * step;
      const settled = Math.abs(next - targetOpacity) < 0.003;
      root.userData.currentOpacity = settled ? targetOpacity : next;
      applyElementOpacity(root, root.userData.currentOpacity);

      // Jigsaw pop: scale follows opacity from 0.6 to 1 so newly revealed
      // pieces visibly punch into place. Skip while the drop-in animator
      // owns the transform.
      if (!root.userData.landing) {
        const t = root.userData.currentOpacity;
        const s = 0.6 + 0.4 * t;
        const baseVec = root.userData.objectScaleBaseVec;
        const baseScale = root.userData.objectScaleBase || 1;
        if (baseVec) root.scale.set(baseVec.x * s, baseVec.y * s, baseVec.z * s);
        else if (Math.abs(root.scale.x - s * baseScale) > 0.001) root.scale.setScalar(s * baseScale);
      }

      // Once the fade has settled and no further work is queued, take the
      // root out of the per-frame set. setElementOpacity will re-add it the
      // next time the target changes. Ghost-board population can grow into
      // the thousands; without this prune the per-frame traverse dominates
      // the CPU budget while every cell is sitting at its rest opacity.
      if (settled
          && !root.userData.landing
          && !(root.userData.revealDelay > 0)
          && !root.userData.pendingRevealSfx) {
        opacityRoots.delete(root);
      }

      count++;
      // Budget check — bail early if we've used our time slice.
      // The remaining roots will continue transitioning on the next frame.
      if (count % 16 === 0 && performance.now() - start > budgetMs) {
        break;
      }
    }
  }

  function fadeRamp(value, width) {
    if (value >= width) return 1;
    const t = Math.max(0, value) / Math.max(0.001, width);
    return renderGhostOpacity + (1 - renderGhostOpacity) * t;
  }

  function smoothstep(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }

  // Visibility model:
  //  - Home boards are capped at 20×20, but the render window still keeps
  //    neighbouring ghost boards from filling the draw list.
  //  - Outside the home board, cells are revealed once they enter the
  //    visible square around the camera target — and stay revealed
  //    afterwards (the user keeps the breadcrumb trail behind them).
  //    Reveal stickiness is tracked on each root's userData.revealed by
  //    revealOpacityFor() below; this raw function only answers the
  //    "is it currently in the visible window?" question.
  function opacityAtWorldPosition(x, z) {
    const homeHalf = GRID / 2;
    if (Math.abs(x) <= homeHalf && Math.abs(z) <= homeHalf) return 1;
    const visibleHalf = renderVisibleSize / 2;
    const dist = Math.max(Math.abs(x - target.x), Math.abs(z - target.z));
    return dist <= visibleHalf ? 1 : 0;
  }

  // Sticky reveal: once a non-home root has been seen, it stays at full
  // opacity for the rest of the session. Returns 1 if home, sticky, or
  // currently inside the visible window; otherwise 0.
  function revealOpacityFor(root) {
    if (!root) return 0;
    if (root.userData.revealed) return 1;
    const op = opacityAtWorldPosition(root.position.x, root.position.z);
    if (op > 0) root.userData.revealed = true;
    return op;
  }

  function makeGhostObject(cells, x, z) {
    const cell = cells[x][z];
    const level = cell.floors || 1;
    let mesh = null;
    if      (cell.kind === 'tree')      mesh = makeVoxelTree(level);
    else if (cell.kind === 'rock')      mesh = makeVoxelRock(getGhostRockNeighbors(cells, x, z), level, x + 1000, z + 1000);
    else if (cell.kind === 'bridge')    mesh = makeVoxelBridge(ghostBridgeOrientation(cells, x, z), cell.floors || 1);
    else if (cell.kind === 'tuft')      mesh = makeVoxelCropKind('tuft', level);
    else if (cell.kind === 'flower')    mesh = makeVoxelCropKind('flower', level);
    else if (cell.kind === 'bush')      mesh = makeVoxelCropKind('bush', level);
    else if (cell.kind === 'cow')       mesh = makeVoxelAnimal('cow');
    else if (cell.kind === 'sheep')     mesh = makeVoxelAnimal('sheep');
    else if (cell.kind === 'pig')       mesh = makeVoxelAnimal('pig');
    else if (cell.kind === 'crop')      mesh = makeVoxelCropKind('crop', level);
    else if (cell.kind === 'corn')      mesh = makeVoxelCropKind('corn', level);
    else if (cell.kind === 'wheat')     mesh = makeVoxelCropKind('wheat', level);
    else if (cell.kind === 'pumpkin')   mesh = makeVoxelCropKind('pumpkin', level);
    else if (cell.kind === 'carrot')    mesh = makeVoxelCropKind('carrot', level);
    else if (cell.kind === 'sunflower') mesh = makeVoxelCropKind('sunflower', level);
    else if (cell.kind === 'chimney' || cell.kind === 'ripple' || cell.kind === 'shrub' || cell.kind === 'stone' || cell.kind === 'pebble' || cell.kind === 'bridge-rail') mesh = makeVoxelMicroKind(cell.kind, level, x + 1000, z + 1000);
    else if (cell.kind === 'fence')     mesh = makeVoxelFence(normalizeFenceSide(cell.fenceSide), level, false, false, 'x', typeof fenceStyleForCell === 'function' ? fenceStyleForCell(cell) : 'wood');
    else if (cell.kind === 'house') {
      if (cell.buildingType === 'manor') mesh = makeVoxelManor(level);
      else if (cell.buildingType === 'tower') mesh = makeVoxelStoneTower(Math.max(level, 2));
      else if (cell.buildingType === 'turret') mesh = makeVoxelTurret(level, false);
      else if (cell.buildingType === 'skyscraper') mesh = makeVoxelSkyscraper(Math.max(level, 4));
      else mesh = makeVoxelLinearHouse(1, 'z', level);
    }
    return mesh;
  }

  // -------- cheap ghost instancing helpers --------
  function ensureCheapGhostGeoms() {
    if (cheapGhostGeomDirt) return;
    const size = TILE;
    cheapGhostGeomDirt = new THREE.BoxGeometry(size, DIRT_H, size);
    cheapGhostGeomDirt.translate(0, DIRT_H / 2, 0);
    cheapGhostGeomTop = new THREE.BoxGeometry(size, TOP_H, size);
    cheapGhostGeomTop.translate(0, TOP_H / 2, 0);
  }

  function getCheapGhostTerrainBucket(terrain) {
    let b = cheapGhostTerrainBuckets.get(terrain);
    if (b) return b;

    ensureCheapGhostGeoms();

    const topMat = (terrain === 'path')  ? M.path :
                   (terrain === 'water') ? M.water :
                   (terrain === 'dirt')  ? M.dirtRich :
                   (terrain === 'stone') ? M.stone :
                   (terrain === 'lava')  ? M.lava :
                   (terrain === 'sand')  ? M.sand :
                   (terrain === 'snow')  ? M.snow : M.grass;

    const riserMat = (terrain === 'path')  ? M.pathTrim :
                     (terrain === 'water') ? M.waterDk :
                     (terrain === 'dirt')  ? M.dirtRich :
                     (terrain === 'stone') ? M.stone :
                     (terrain === 'lava')  ? M.lava :
                     (terrain === 'sand')  ? M.sand :
                     (terrain === 'snow')  ? M.snow : M.dirt;

    const dirtMesh = new THREE.InstancedMesh(cheapGhostGeomDirt, riserMat, CHEAP_GHOST_CAPACITY);
    const topMesh  = new THREE.InstancedMesh(cheapGhostGeomTop, topMat, CHEAP_GHOST_CAPACITY);

    for (const m of [dirtMesh, topMesh]) {
      m.castShadow = false;
      m.receiveShadow = true;
      m.count = 0;
      m.frustumCulled = true;
      m.userData = { isCheapGhostTerrain: true, terrain, keyAt: [] };
      // Ensure depthWrite so we don't get the sorting artifacts we fixed earlier.
      if (m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach(mat => { mat.depthWrite = true; });
      }
    }
    topMesh.userData.keyAt = dirtMesh.userData.keyAt;

    worldGroup.add(dirtMesh);
    worldGroup.add(topMesh);

    b = {
      terrain,
      dirtMesh,
      topMesh,
      slots: new Map(), // 'boardX,boardZ|x,z' → idx
      keyAt: dirtMesh.userData.keyAt,
      count: 0
    };
    cheapGhostTerrainBuckets.set(terrain, b);
    return b;
  }

  function _writeCheapGhostTerrainInstance(b, idx, worldX, worldZ, rise) {
    const DUMMY = _writeCheapGhostTerrainInstance._dummy || (_writeCheapGhostTerrainInstance._dummy = new THREE.Object3D());
    // Dirt column: scale Y to account for elevation so the column reaches y=rise.
    const dirtHeight = DIRT_H + rise;
    const sy = dirtHeight / DIRT_H;
    DUMMY.scale.set(1, sy, 1);
    DUMMY.position.set(worldX, -DIRT_H, worldZ);
    DUMMY.updateMatrix();
    b.dirtMesh.setMatrixAt(idx, DUMMY.matrix);

    // Top cap sitting at y = rise.
    DUMMY.scale.set(1, 1, 1);
    DUMMY.position.set(worldX, rise, worldZ);
    DUMMY.updateMatrix();
    b.topMesh.setMatrixAt(idx, DUMMY.matrix);
  }

  function addCellToCheapGhostTerrain(boardX, boardZ, x, z, terrain, rise) {
    const b = getCheapGhostTerrainBucket(terrain);
    const key = `${boardX},${boardZ}|${x},${z}`;
    if (b.slots.has(key)) return;
    if (b.count >= CHEAP_GHOST_CAPACITY) return;

    const idx = b.count;
    const worldX = (boardX * GRID + x - GRID / 2 + 0.5) * TILE;
    const worldZ = (boardZ * GRID + z - GRID / 2 + 0.5) * TILE;

    _writeCheapGhostTerrainInstance(b, idx, worldX, worldZ, rise);

    b.slots.set(key, idx);
    b.keyAt[idx] = key;
    b.count++;

    b.dirtMesh.count = b.count;
    b.topMesh.count  = b.count;
    b.dirtMesh.instanceMatrix.needsUpdate = true;
    b.topMesh.instanceMatrix.needsUpdate = true;
  }

  function removeCellFromCheapGhostTerrain(boardX, boardZ, x, z, terrain) {
    const b = cheapGhostTerrainBuckets.get(terrain);
    if (!b) return;
    const key = `${boardX},${boardZ}|${x},${z}`;
    revealedCheapCells.delete(key);
    const idx = b.slots.get(key);
    if (idx === undefined) return;

    const lastIdx = b.count - 1;
    if (idx !== lastIdx) {
      // swap-pop
      const TMP = new THREE.Matrix4();
      b.dirtMesh.getMatrixAt(lastIdx, TMP);
      b.dirtMesh.setMatrixAt(idx, TMP);
      b.topMesh.getMatrixAt(lastIdx, TMP);
      b.topMesh.setMatrixAt(idx, TMP);
      const movedKey = b.keyAt[lastIdx];
      b.keyAt[idx] = movedKey;
      b.slots.set(movedKey, idx);
    }
    b.slots.delete(key);
    b.keyAt[lastIdx] = null;
    b.count--;

    b.dirtMesh.count = b.count;
    b.topMesh.count  = b.count;
    b.dirtMesh.instanceMatrix.needsUpdate = true;
    b.topMesh.instanceMatrix.needsUpdate = true;
  }

  function clearCheapGhostTerrain() {
    revealedCheapCells.clear();
    for (const b of cheapGhostTerrainBuckets.values()) {
      b.slots.clear();
      b.keyAt.length = 0;
      b.count = 0;
      b.dirtMesh.count = 0;
      b.topMesh.count = 0;
      b.dirtMesh.instanceMatrix.needsUpdate = true;
      b.topMesh.instanceMatrix.needsUpdate = true;
    }
  }

  // Unused Home world tile instancing pruned for performance and size optimization.

  // Cheap single-mesh version used for ghost/preview boards.
  // Full makeTile creates riser + top + decals (multiple meshes per tile).
  // For ghosts we use one slab with the top material + full height so the
  // visual layout is still readable when panned far, but element/draw call
  // count stays reasonable even at high preview distance.
  function makeGhostTile(terrain, level, worldX, worldZ) {
    const cell = { terrain, terrainFloors: level };
    const rise = terrainVisualRiseForCell(cell);
    const topY = rise + TOP_H;

    let mat = M.grass;
    if (terrain === 'path')  mat = M.path;
    if (terrain === 'water') mat = M.water;
    if (terrain === 'dirt')  mat = M.dirtRich;
    if (terrain === 'stone') mat = M.stone;
    if (terrain === 'lava')  mat = M.lava;
    if (terrain === 'sand')  mat = M.sand;
    if (terrain === 'snow')  mat = M.snow;

    const height = DIRT_H + rise + TOP_H;
    const slab = new THREE.Mesh(getBoxGeometry(TILE, height, TILE), mat);
    slab.position.y = -DIRT_H + height * 0.5;

    slab.userData = {
      kind: 'ghostTile',
      terrain,
      weatherSurfaceY: topY + WEATHER_SURFACE_PAD
    };
    return slab;
  }

  function buildGhostBoard(boardX, boardZ) {
    if (!ghostBoardsEnabledForGrid()) return;
    if (boardX === 0 && boardZ === 0) return;
    const key = ghostBoardKey(boardX, boardZ);
    if (ghostBoards.has(key)) return;
    const cells = makeGhostWorld(boardX, boardZ);
    const board = new THREE.Group();
    const detail = getDesiredGhostDetail(boardX, boardZ);
    if (detail !== 'full') ghostDetailReevaluationActive = true;
    board.userData = { ghostBoard: true, boardX, boardZ, detail };
    board.renderOrder = -5;

    for (let x = 0; x < GRID; x++) {
      for (let z = 0; z < GRID; z++) {
        // Only skip cells the user has explicitly edited (userEdited
        // flag). The pre-allocated world[0..HOME_GRID_MAX) rows are full
        // of default grass that must NOT mask the ghost board — they're
        // future home cells, not overrides.
        const gx = x + boardX * GRID;
        const gz = z + boardZ * GRID;
        if (world[gx] && world[gx][gz] && world[gx][gz].userEdited) {
          // User-edited preview cells are saved as real world cells and the
          // ghost board must not draw over them. If a stale save/session has
          // the userEdited flag but no live mesh yet, build the real mesh now
          // rather than leaving a see-through hole in the preview board.
          const editedKey = gx + ',' + gz;
          if (!cellMeshes[editedKey] || !cellMeshes[editedKey].tile) {
            renderCellTile(gx, gz, { animate: false });
            if (world[gx][gz].kind) renderCellObject(gx, gz, { animate: false, impactDust: false });
          }
          continue;
        }

        // Ghost terrain is now always full quality (makeTile) to match the restored quality objects.
        // No automatic quality reduction on ghosts — only progressive LOD when user zooms the camera out (to be implemented if needed).
        // In landscape mesh mode the engine renders the continuous terrain
        // so skip individual ghost tiles entirely.
        if (isLandscapeMeshActive()) {
          // no ghost tile needed — engine covers it
        } else {
          const tile = makeTile(cells[x][z].terrain, {
            path: getGhostNeighbors(cells, x, z, 'terrain', 'path', boardX, boardZ),
            terrain: getGhostTerrainNeighbors(cells, x, z, boardX, boardZ),
            levels: getGhostLevelNeighbors(cells, x, z),
          }, gx, gz, tileLevelForCell(cells[x][z]));
          tile.position.copy(ghostCellPos(boardX, boardZ, x, z));
          tile.userData.gx = x;
          tile.userData.gz = z;
          tile.userData.boardX = boardX;
          tile.userData.boardZ = boardZ;
          tile.userData.fadeRole = 'tile';
          applyWeatherTileEffect(tile);
          prepareFadeable(tile, { ghost: true, grayscale: true, opacity: opacityAtWorldPosition(tile.position.x, tile.position.z) });

          // Force depthWrite on ghost terrain tiles.
          tile.traverse(o => {
            if (o.isMesh && o.material) {
              const mats = Array.isArray(o.material) ? o.material : [o.material];
              mats.forEach(m => { m.depthWrite = true; });
            }
          });

          board.add(tile);
        }

        // Preview objects must always use the real Tinyworld asset factories.
        // The old box/cone proxy path made nearby preview boards look broken.
        const obj = makeGhostObject(cells, x, z);
        if (!obj) continue;
        obj.position.copy(ghostCellPos(boardX, boardZ, x, z));
        obj.position.y = isLandscapeMeshActive()
          ? landscapeHeightAtCell(gx, gz)
          : TOP_H + terrainVisualRiseForCell(cells[x][z]);
        obj.userData.gx = x;
        obj.userData.gz = z;
        obj.userData.boardX = boardX;
        obj.userData.boardZ = boardZ;
        obj.userData.fadeRole = 'object';
        prepareFadeable(obj, { ghost: true, grayscale: true, opacity: opacityAtWorldPosition(obj.position.x, obj.position.z) });
        board.add(obj);
      }
    }

    // Merge same-material ghost terrain into batched meshes.
    // This is the big win for "so many elements" at high preview distance.
    mergeGhostTerrainByMaterial(board);

    worldGroup.add(board);
    ghostBoards.set(key, board);
  }

  function destroyGhostBoard(boardX, boardZ) {
    const key = ghostBoardKey(boardX, boardZ);
    const board = ghostBoards.get(key);
    if (board) {
      const wasCheap = (board.userData.detail === 'cheap');
      if (wasCheap && ghostBoardCells.has(key)) {
        const cells = ghostBoardCells.get(key);
        for (let x = 0; x < GRID; x++) {
          for (let z = 0; z < GRID; z++) {
            const terrain = cells[x][z].terrain;
            removeCellFromCheapGhostTerrain(boardX, boardZ, x, z, terrain);
          }
        }
      }
      worldGroup.remove(board);
      disposeGroup(board);
      ghostBoards.delete(key);
    }
  }

  function rebuildGhostBoard(boardX, boardZ) {
    destroyGhostBoard(boardX, boardZ);
    buildGhostBoard(boardX, boardZ);
    updateGhostRenderBubble();
  }

  function rebuildExistingGhostBoards() {
    const coords = [...ghostBoards.values()].map(board => [board.userData.boardX, board.userData.boardZ]);
    for (const [boardX, boardZ] of coords) rebuildGhostBoard(boardX, boardZ);
    ensureGhostBoardsAroundTarget();
  }

  // Merge all static ghost terrain leaf meshes that share the same material
  // into one BufferGeometry. Full-quality ghost tiles are Groups containing
  // risers, caps, bevel strips, weeds, and other small meshes; merging only
  // direct board children misses almost all of that work.
  function mergeGhostTerrainByMaterial(board) {
    const byMat = new Map();
    const sourceMeshes = [];
    const rootStats = new Map();
    const mergedSources = new Set();
    const boardCenter = new THREE.Vector3(
      (board.userData.boardX || 0) * GRID,
      0,
      (board.userData.boardZ || 0) * GRID
    );
    const boardCenter2 = new THREE.Vector2(boardCenter.x, boardCenter.z);

    board.updateMatrixWorld(true);

    for (const root of board.children.slice()) {
      if (!root || !root.userData || root.userData.fadeRole !== 'tile') continue;
      const stats = { sources: [], unmergedMeshCount: 0 };
      root.traverse(o => {
        if (!o || !o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
        const material = o.userData && o.userData.baseMat ? o.userData.baseMat : o.material;
        const mergeable = !Array.isArray(o.material) &&
          material &&
          !(o.userData && (o.userData.waterfall || o.userData.weatherFx || o.userData.noMerge));
        if (!mergeable) {
          stats.unmergedMeshCount++;
          return;
        }
        if (!byMat.has(material)) byMat.set(material, []);
        const source = { mesh: o, root };
        byMat.get(material).push(source);
        sourceMeshes.push(source);
        stats.sources.push(source);
      });
      if (stats.sources.length || stats.unmergedMeshCount) rootStats.set(root, stats);
    }

    for (const [mat, sources] of byMat) {
      if (sources.length <= 1) continue;

      const posArr = [];
      const norArr = [];
      const uvArr = [];
      const tempPos = new THREE.Vector3();
      const tempNormal = new THREE.Vector3();
      const normalMatrix = new THREE.Matrix3();

      for (const source of sources) {
        const m = source.mesh;
        const g = m.geometry;
        const pos = g.attributes.position;
        const nor = g.attributes.normal || null;
        const uv = g.attributes.uv || null;
        const index = g.index ? g.index.array : null;
        normalMatrix.getNormalMatrix(m.matrixWorld);
        const count = index ? index.length : pos.count;

        for (let i = 0; i < count; i++) {
          const vi = index ? index[i] : i;
          tempPos.fromBufferAttribute(pos, vi);
          tempPos.applyMatrix4(m.matrixWorld);
          tempPos.x -= boardCenter.x;
          tempPos.z -= boardCenter.z;
          posArr.push(tempPos.x, tempPos.y, tempPos.z);
          if (nor) {
            tempNormal.fromBufferAttribute(nor, vi).applyMatrix3(normalMatrix).normalize();
            norArr.push(tempNormal.x, tempNormal.y, tempNormal.z);
          }
          if (uv) {
            uvArr.push(uv.getX(vi), uv.getY(vi));
          }
        }
      }

      if (posArr.length === 0) continue;

      const newGeo = new THREE.BufferGeometry();
      newGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(posArr), 3));
      if (norArr.length) newGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(norArr), 3));
      if (uvArr.length) newGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvArr), 2));
      newGeo.computeBoundingBox();
      newGeo.computeBoundingSphere();

      const mergedMesh = new THREE.Mesh(newGeo, mat);
      mergedMesh.position.set(boardCenter.x, 0, boardCenter.z);
      mergedMesh.frustumCulled = true;
      mergedMesh.userData = { fadeRole: 'tile', ghostMerged: true };
      prepareFadeable(mergedMesh, {
        ghost: true,
        grayscale: true,
        opacity: opacityAtWorldPosition(boardCenter2.x, boardCenter2.y),
      });
      board.add(mergedMesh);
      sources.forEach(source => mergedSources.add(source));
    }

    // Remove the original source meshes. Empty all-static tile roots are removed
    // wholesale; mixed roots keep their special unmerged children.
    const rootsToRemove = new Set();
    for (const [root, stats] of rootStats) {
      if (!stats.sources.length || stats.unmergedMeshCount) continue;
      if (stats.sources.every(source => mergedSources.has(source))) rootsToRemove.add(root);
    }
    for (const root of rootsToRemove) {
      board.remove(root);
      disposeGroup(root);
    }
    for (const source of sourceMeshes) {
      if (!mergedSources.has(source)) continue;
      const { mesh, root } = source;
      if (rootsToRemove.has(root)) continue;
      if (mesh.parent) mesh.parent.remove(mesh);
      safeDisposeGeometry(mesh.geometry);
    }
  }

  function updateGhostRenderBubble() {
    const cx = boardFromTargetCoord(target.x);
    const cz = boardFromTargetCoord(target.z);

    if (typeof cheapGhostTerrainBuckets !== 'undefined') {
      const radius = ghostPreloadRadius;
      const minX = (cx - radius - 0.5) * GRID * TILE;
      const maxX = (cx + radius + 0.5) * GRID * TILE;
      const minZ = (cz - radius - 0.5) * GRID * TILE;
      const maxZ = (cz + radius + 0.5) * GRID * TILE;
      const worldBox = new THREE.Box3(
        new THREE.Vector3(minX, -DIRT_H, minZ),
        new THREE.Vector3(maxX, 25, maxZ)
      );
      const worldSphere = worldBox.getBoundingSphere(new THREE.Sphere());
      for (const b of cheapGhostTerrainBuckets.values()) {
        b.dirtMesh.geometry.boundingBox = worldBox;
        b.dirtMesh.geometry.boundingSphere = worldSphere;
        b.topMesh.geometry.boundingBox = worldBox;
        b.topMesh.geometry.boundingSphere = worldSphere;
      }
    }

    // Safely destroy out-of-bounds ghost boards so they don't linger in memory or cheapGhostTerrainBuckets
    const toDestroy = [];
    for (const board of ghostBoards.values()) {
      const bx = board.userData.boardX;
      const bz = board.userData.boardZ;
      const boardDist = Math.max(Math.abs(bx - cx), Math.abs(bz - cz));
      if (boardDist > ghostPreloadRadius) {
        toDestroy.push([bx, bz]);
      }
    }
    for (const [bx, bz] of toDestroy) {
      destroyGhostBoard(bx, bz);
    }

    let anyUnsavedVisible = false;
    for (const board of ghostBoards.values()) {
      board.visible = true; // Any out-of-bounds boards are already destroyed
      for (const child of board.children) {
        const op = revealOpacityFor(child);
        setElementOpacity(child, op);
        if (op > 0.05) anyUnsavedVisible = true;
      }
    }

    // Scale/Hide unrevealed cheap terrain instances
    if (typeof cheapGhostTerrainBuckets !== 'undefined') {
      const DUMMY = updateGhostRenderBubble._dummy || (updateGhostRenderBubble._dummy = new THREE.Object3D());
      for (const b of cheapGhostTerrainBuckets.values()) {
        let changed = false;
        for (let idx = 0; idx < b.count; idx++) {
          const key = b.keyAt[idx];
          if (!key) continue;
          const parts = key.split('|');
          const [boardX, boardZ] = parts[0].split(',').map(Number);
          const [x, z] = parts[1].split(',').map(Number);
          const worldX = (boardX * GRID + x - GRID / 2 + 0.5) * TILE;
          const worldZ = (boardZ * GRID + z - GRID / 2 + 0.5) * TILE;

          let revealed = revealedCheapCells.has(key);
          if (!revealed) {
            const op = opacityAtWorldPosition(worldX, worldZ);
            if (op > 0) {
              revealed = true;
              revealedCheapCells.add(key);
            }
          }

          const cells = makeGhostWorld(boardX, boardZ);
          const cell = cells && cells[x] && cells[x][z];
          const rise = terrainVisualRiseForCell(cell);

          if (revealed) {
            const dirtHeight = DIRT_H + rise;
            const sy = dirtHeight / DIRT_H;
            DUMMY.scale.set(1, sy, 1);
          } else {
            DUMMY.scale.set(0, 0, 0);
          }
          DUMMY.position.set(worldX, -DIRT_H, worldZ);
          DUMMY.updateMatrix();
          b.dirtMesh.setMatrixAt(idx, DUMMY.matrix);

          if (revealed) {
            DUMMY.scale.set(1, 1, 1);
          } else {
            DUMMY.scale.set(0, 0, 0);
          }
          DUMMY.position.set(worldX, rise, worldZ);
          DUMMY.updateMatrix();
          b.topMesh.setMatrixAt(idx, DUMMY.matrix);
          changed = true;
        }
        if (changed) {
          b.dirtMesh.instanceMatrix.needsUpdate = true;
          b.topMesh.instanceMatrix.needsUpdate = true;
        }
      }
    }

    if (!anyUnsavedVisible) {
      for (const key in cellMeshes) {
        const [kx, kz] = key.split(',').map(Number);
        if (!isOutsideHomeGrid(kx, kz)) continue;
        const entry = cellMeshes[key];
        const root = entry.object || entry.tile;
        if (!root) continue;
        if (revealOpacityFor(root) > 0.05) {
          anyUnsavedVisible = true;
          break;
        }
      }
    }
    setUnsavedBannerVisible(anyUnsavedVisible);
    updateHomeBoardFade();
    syncHoverVisibility();
  }

  let unsavedBannerHideTimer = null;
  function setUnsavedBannerVisible(visible) {
    const banner = document.getElementById('unsaved-banner');
    if (!banner) return;
    banner.classList.remove('visible');
    banner.hidden = true;
  }

  function updateHomeBoardFade() {
    for (const key in cellMeshes) {
      const [kx, kz] = key.split(',').map(Number);
      const editableIsland = isEditableIslandCell(kx, kz);
      const insideHome = !isOutsideHomeGrid(kx, kz);
      const entry = cellMeshes[key];
      if (entry.tile) {
        const op = editableIsland ? 1 : (insideHome ? opacityAtWorldPosition(entry.tile.position.x, entry.tile.position.z) : revealOpacityFor(entry.tile));
        setElementOpacity(entry.tile, op, insideHome || editableIsland);
      }
      if (entry.object) {
        const op = editableIsland ? 1 : (insideHome ? opacityAtWorldPosition(entry.object.position.x, entry.object.position.z) : revealOpacityFor(entry.object));
        setElementOpacity(entry.object, op, insideHome || editableIsland);
      }
      if (entry.extras) {
        for (const extra of entry.extras) {
          const op = editableIsland ? 1 : (insideHome ? opacityAtWorldPosition(extra.position.x, extra.position.z) : revealOpacityFor(extra));
          setElementOpacity(extra, op, insideHome || editableIsland);
        }
      }
    }
  }

  // Build queue — adding boards synchronously stalls the main thread for
  // hundreds of ms on Reset / Clear / increasing visible distance. Instead
  // we enqueue and let the animation loop drain ~6ms of board builds per
  // frame, sorted nearest-first so the area around the camera fills in
  // visibly while distant boards trail in.
  const pendingGhostBoards = [];
  const pendingGhostBoardSet = new Set();
  function enqueueGhostBoard(bx, bz) {
    if (bx === 0 && bz === 0) return;
    const key = ghostBoardKey(bx, bz);
    if (ghostBoards.has(key) || pendingGhostBoardSet.has(key)) return;
    pendingGhostBoards.push([bx, bz, key]);
    pendingGhostBoardSet.add(key);
  }
  function sortPendingByDistance() {
    const cx = boardFromTargetCoord(target.x);
    const cz = boardFromTargetCoord(target.z);
    pendingGhostBoards.sort((a, b) => {
      const da = Math.max(Math.abs(a[0] - cx), Math.abs(a[1] - cz));
      const db = Math.max(Math.abs(b[0] - cx), Math.abs(b[1] - cz));
      return da - db;
    });
  }
  function clearPendingGhostBoards() {
    pendingGhostBoards.length = 0;
    pendingGhostBoardSet.clear();
  }

  // Rendered ghost boards are always full-fidelity. Large grids are protected
  // by renderBudgetForGrid() disabling preview rings rather than by swapping
  // visible objects to crude proxy boxes/cones.
  function getDesiredGhostDetail(_boardX, _boardZ) {
    return 'full';
  }

  let ghostDetailReevaluationActive = false;

  // Called when the user changes zoom (renderVisibleSize) or after significant
  // camera movement. Rebuilds stale boards if their detail marker differs from
  // the full-fidelity Preview contract.
  function reevaluateGhostDetailLevels() {
    let stillNeedsReevaluation = false;
    for (const board of ghostBoards.values()) {
      const bx = board.userData.boardX;
      const bz = board.userData.boardZ;
      const current = board.userData.detail || 'full';
      const desired = getDesiredGhostDetail(bx, bz);
      if (current !== desired) {
        rebuildGhostBoard(bx, bz);
        stillNeedsReevaluation = true;
      } else if (current !== 'full' || desired !== 'full') {
        stillNeedsReevaluation = true;
      }
    }
    ghostDetailReevaluationActive = stillNeedsReevaluation;
  }

  // Throttled re-evaluation on camera movement so stale cheap Preview boards
  // are rebuilt as full quality without doing that work every frame.
  let lastGhostDetailCheck = 0;
  function maybeReevaluateGhostDetails() {
    if (!ghostDetailReevaluationActive) return;
    const now = performance.now();
    if (now - lastGhostDetailCheck > 350) {   // ~3 times per second is plenty
      lastGhostDetailCheck = now;
      reevaluateGhostDetailLevels();
    }
  }

  function processGhostBoardQueue(budgetMs) {
    if (!pendingGhostBoards.length) return;
    if (!ghostBoardsEnabledForGrid()) { clearPendingGhostBoards(); return; }
    const profileStart = repaintProfileBegin();
    const start = performance.now();
    const frameCap = GRID >= 64 ? 1 : 3;
    let built = 0;
    while (pendingGhostBoards.length && performance.now() - start < budgetMs) {
      const [bx, bz, key] = pendingGhostBoards.shift();
      pendingGhostBoardSet.delete(key);
      if (ghostBoards.has(key)) continue;
      buildGhostBoard(bx, bz);
      built++;
      // Cap per-frame builds even if budget allows more — keeps GC from
      // bunching and lets renderScene actually paint between batches.
      if (built >= frameCap) break;
    }
    if (built) updateGhostRenderBubble();
    repaintProfileEnd('queue.ghost', profileStart, built || 1);
  }

  let lastGhostEnsureTargetX = null;
  let lastGhostEnsureTargetZ = null;
  let lastGhostEnsureBoardX = null;
  let lastGhostEnsureBoardZ = null;
  const GHOST_ENSURE_TARGET_DIST = 0.55;

  function noteGhostEnsureTarget() {
    lastGhostEnsureTargetX = target.x;
    lastGhostEnsureTargetZ = target.z;
    lastGhostEnsureBoardX = boardFromTargetCoord(target.x);
    lastGhostEnsureBoardZ = boardFromTargetCoord(target.z);
  }

  function maybeEnsureGhostBoardsAroundTarget(force = false) {
    if (!renderAutoExpand) return;
    const bx = boardFromTargetCoord(target.x);
    const bz = boardFromTargetCoord(target.z);
    const sameBoard = bx === lastGhostEnsureBoardX && bz === lastGhostEnsureBoardZ;
    const moved = lastGhostEnsureTargetX === null || lastGhostEnsureTargetZ === null
      ? Infinity
      : Math.hypot(target.x - lastGhostEnsureTargetX, target.z - lastGhostEnsureTargetZ);
    if (!force && sameBoard && moved < GHOST_ENSURE_TARGET_DIST) return;
    ensureGhostBoardsAroundTarget();
  }

  function ensureGhostBoardsAroundTarget() {
    noteGhostEnsureTarget();
    syncGhostRenderBudget();
    if (!ghostBoardsEnabledForGrid()) {
      clearPendingGhostBoards();
      clearCheapGhostTerrain();
      clearGhostBoardsOnly();
      updateGhostRenderBubble();
      return;
    }
    const cx = boardFromTargetCoord(target.x);
    const cz = boardFromTargetCoord(target.z);
    for (let bx = cx - ghostPreloadRadius; bx <= cx + ghostPreloadRadius; bx++) {
      for (let bz = cz - ghostPreloadRadius; bz <= cz + ghostPreloadRadius; bz++) {
        enqueueGhostBoard(bx, bz);
      }
    }
    sortPendingByDistance();
    updateGhostRenderBubble();

    // When panning the camera, nearby ghosts may need to upgrade to full quality
    // and far ones may need to drop to cheap versions (progressive LOD).
    maybeReevaluateGhostDetails();
  }
