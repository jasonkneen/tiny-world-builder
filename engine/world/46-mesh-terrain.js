  // -------- mesh terrain sculptor (voxel paint + flat-top block sculpt) --------
  // An opt-in landscape designer. Lay a fine voxel grid over the home board,
  // paint per-voxel materials (grass/sand/water/stone/dirt/snow/lava), then grab
  // the surface and pull voxels up/down. Each voxel keeps a FLAT horizontal top
  // at its own height; vertical step-walls form between neighbours of different
  // heights, so the result reads as small flat-topped blocks depicting the
  // layout — never a smooth/curved surface. Pulling one voxel up drags its
  // neighbours up too, with a smoothstep "tension" falloff over the brush.
  //
  // Rendering uses the app's REAL terrain materials/shaders (via
  // terrainVoxelMaterials/terrainRiserMaterial), grouped per terrain: tops get
  // the terrain base material, side walls get the soil/stone riser material.
  // Those materials compute their UVs from world position in-shader
  // (applyWorldUVs), so the blocks pick up the same textures/shading as the rest
  // of the world. A plain-colour fallback is used if those helpers are missing.
  //
  // "Apply" keeps the block mesh as the rendered terrain (persisted under its own
  // localStorage key) and hides the underlying flat home tiles — it does NOT bake
  // back into per-tile terrain, so there are no full tiles afterwards.
  //
  // Self-contained: one IIFE (no top-level names -> no cross-file decl clashes),
  // own localStorage keys (world schema untouched), CSS injected from JS, and
  // zero scene/listener footprint until the editor is opened.
  (function meshTerrainSculptorBoot() {
    const STORE_KEY = 'tinyworld:meshTerrain:v2';
    const PREF_KEY = 'tinyworld:meshTerrain:prefs:v1';
    const MAX_N = 96;            // hard cap on voxels-per-side across the board
    const VPT_OPTIONS = [4, 6, 8, 10, 12];
    // Worst case per voxel (real-mats path): 1 top + 4 bevel chamfers + 4 bevel
    // corner fills + 4 grass-band strips + 4 dirt walls = 17 quads * 18 = 306 floats.
    // 360 leaves headroom; the fixed-stride fallback only writes its first 90 and
    // leaves the tail zero (degenerate tris = invisible), so the larger slot is safe.
    const FLOATS_PER_VOXEL = 360;
    // Top-edge bevel as a FRACTION of voxel spacing (scales with voxel size). Only
    // applied on EXPOSED edges so flat interiors stay seamless. Set to 0 to disable.
    const BEVEL = 0.05;
    // Grass voxels show a band of the grass TOP colour draping down each exposed
    // side before the dirt riser, like the home-island edge. World units; ~thick.
    const GRASS_BAND = 0.16;
    const BASE_SKIRT = 0.25;     // how far boundary walls drop below the lowest block
    const MAX_HEIGHT = 40;       // cap on how high a voxel can be pulled
    // Ground level is the floor: voxels cannot be pushed below 0 (no digging
    // below the ground), only built up from it.

    const MATERIALS = [
      { id: 'grass', label: 'Grass', color: 0x6fae4f },
      { id: 'sand',  label: 'Sand',  color: 0xe2cf95 },
      { id: 'water', label: 'Water', color: 0x4d8fd6 },
      { id: 'stone', label: 'Stone', color: 0x9a9ea6 },
      { id: 'dirt',  label: 'Dirt',  color: 0x9c6b43 },
      { id: 'snow',  label: 'Snow',  color: 0xeaf2f6 },
      { id: 'lava',  label: 'Lava',  color: 0xe2592a },
    ];

    // ---- editor prefs ----
    let vpt = 8;
    let toolMode = 'sculpt';
    let paintMatIndex = 0;
    let brushRadius = 1.5;

    // ---- session state ----
    let editing = false;
    let applied = false;
    let appliedSnap = null;      // in-memory last-applied { vpt, cellH, mats } for revert
    let generatedActive = false; // a transient design built programmatically (e.g. generated landscape)
    let gridAtEnter = 8;
    let half = 4;
    let N = 0;
    let spacing = 1;
    let surfaceY = 0.18;

    let cellH = null;            // Float32Array(N*N) per-voxel top height delta
    let mats = null;             // Uint8Array(N*N) per-voxel material index
    let positions = null, colors = null, normals = null;

    let surfaceMesh = null, brushRing = null, grabHandle = null, geom = null;
    let ray = null, drag = null, tmpColor = null, ndc = null, rebuildRAF = 0;

    // ---- real-material wiring ----
    let useRealMats = false;
    const termTopOrig = new Map();   // terrainIndex -> app top material (or null)
    const termSideOrig = new Map();  // terrainIndex -> app riser material (or null)
    const matClones = new Map();     // orig.uuid -> double-sided clone
    const solidFallback = new Map(); // key -> plain MeshLambertMaterial
    const rockMats = new Map();      // key -> grey-tinted sand-noise rock material

    // ---- DOM ----
    let toggleBtn = null, panel = null, builtUI = false;
    let modeSeg = null, resSeg = null, swatchWrap = null, brushInput = null, brushVal = null;

    function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
    function shown() { return !!surfaceMesh; }

    // ---- prefs persistence ----
    function loadPrefs() {
      try {
        const p = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
        if (!p) return;
        if (VPT_OPTIONS.includes(p.vpt)) vpt = p.vpt;
        if (p.toolMode === 'sculpt' || p.toolMode === 'paint') toolMode = p.toolMode;
        if (Number.isFinite(p.brushRadius)) brushRadius = clamp(p.brushRadius, 0.3, 12);
        if (Number.isInteger(p.paintMatIndex) && MATERIALS[p.paintMatIndex]) paintMatIndex = p.paintMatIndex;
      } catch (_) {}
    }
    function savePrefs() {
      try { localStorage.setItem(PREF_KEY, JSON.stringify({ vpt, toolMode, brushRadius, paintMatIndex })); } catch (_) {}
    }

    // ---- design persistence (own key; world schema untouched) ----
    function saveDesign() {
      if (!cellH || !mats) return;
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({
          v: 2, gridSize: gridAtEnter, vpt, applied,
          cellH: Array.from(cellH), mats: Array.from(mats),
        }));
      } catch (_) {}
    }
    function readDesign() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (_) { return null; } }
    function clearDesign() { try { localStorage.removeItem(STORE_KEY); } catch (_) {} }
    function loadDesignInto(d) {
      if (!d || d.gridSize !== gridAtEnter || d.vpt !== vpt) return false;
      if (!Array.isArray(d.cellH) || d.cellH.length !== cellH.length) return false;
      if (!Array.isArray(d.mats) || d.mats.length !== mats.length) return false;
      // Reject corrupt payloads element-by-element: a bad mats index would throw
      // at rebuild (MATERIALS[t].id) and a non-finite height would poison the buffers.
      for (let i = 0; i < d.cellH.length; i++) if (!Number.isFinite(d.cellH[i])) return false;
      for (let i = 0; i < d.mats.length; i++) if (!Number.isInteger(d.mats[i]) || !MATERIALS[d.mats[i]]) return false;
      cellH.set(d.cellH); mats.set(d.mats); return true;
    }
    // Snapshot the current design in memory as the last-applied state, so Cancel
    // can revert to it without relying on (or rewriting) localStorage mid-edit.
    function captureApplied() {
      appliedSnap = (cellH && mats) ? { vpt, cellH: cellH.slice(), mats: mats.slice() } : null;
    }

    // ---- sizing / buffers ----
    function recomputeDims() {
      gridAtEnter = (typeof GRID === 'number' && GRID > 0) ? GRID : 8;
      half = gridAtEnter / 2;
      surfaceY = (typeof TOP_H === 'number') ? TOP_H : 0.18;
      let effVpt = vpt;
      while (effVpt > 2 && gridAtEnter * effVpt > MAX_N) effVpt -= 1;
      N = gridAtEnter * effVpt;
      spacing = gridAtEnter / N;
    }
    function allocBuffers() {
      cellH = new Float32Array(N * N);
      mats = new Uint8Array(N * N);
      const f = N * N * FLOATS_PER_VOXEL;
      positions = new Float32Array(f);
      colors = new Float32Array(f);
      normals = new Float32Array(f);
    }
    function matColor(i) {
      if (!tmpColor) tmpColor = new THREE.Color();
      tmpColor.setHex(MATERIALS[i] ? MATERIALS[i].color : 0x6fae4f);
      return tmpColor;
    }
    function matIndexById(id) {
      for (let k = 0; k < MATERIALS.length; k++) if (MATERIALS[k].id === id) return k;
      return -1;
    }

    // ---- material selection (real app terrain materials) ----
    function detectRealMats() {
      useRealMats = (typeof M !== 'undefined' && typeof terrainVoxelMaterials === 'function' && typeof terrainRiserMaterial === 'function');
    }
    function topOrig(t) {
      if (termTopOrig.has(t)) return termTopOrig.get(t);
      let m = null;
      try { const tv = terrainVoxelMaterials(MATERIALS[t].id); m = (tv && tv.base) || null; } catch (_) { m = null; }
      termTopOrig.set(t, m); return m;
    }
    function sideOrig(t) {
      if (termSideOrig.has(t)) return termSideOrig.get(t);
      let m = null;
      try {
        m = terrainRiserMaterial(MATERIALS[t].id) || null;
        if (!m) { const tv = terrainVoxelMaterials(MATERIALS[t].id); m = (tv && tv.low) || null; }
      } catch (_) { m = null; }
      termSideOrig.set(t, m); return m;
    }
    // Rock should read as grainy NOISE, not the blocky cottage/castle masonry
    // (M.stone) or the blocky stone pattern (M.rock). Reuse the sand material's
    // fine-grain noise texture (texSand) tinted grey so it looks like gravelly
    // rock while keeping the world-UV shader.
    function rockNoiseMat(key, hex) {
      let m = rockMats.get(key);
      if (m) return m;
      const base = (typeof M !== 'undefined') ? M.sand : null;
      if (base) {
        m = base.clone();
        m.onBeforeCompile = base.onBeforeCompile;
        if (typeof base.customProgramCacheKey === 'function') m.customProgramCacheKey = base.customProgramCacheKey;
        m.userData = Object.assign({}, base.userData);
        m.color = new THREE.Color(hex);
        m.side = THREE.DoubleSide;
        m.needsUpdate = true;
      } else {
        m = new THREE.MeshLambertMaterial({ color: hex, side: THREE.DoubleSide });
      }
      rockMats.set(key, m);
      return m;
    }
    // Double-sided clone that preserves the world-UV shader (onBeforeCompile is
    // NOT copied by Material.clone in r128, so copy it across explicitly).
    function dsClone(orig) {
      if (!orig) return null;
      let c = matClones.get(orig.uuid);
      if (c) return c;
      c = orig.clone();
      c.onBeforeCompile = orig.onBeforeCompile;
      if (typeof orig.customProgramCacheKey === 'function') c.customProgramCacheKey = orig.customProgramCacheKey;
      c.userData = Object.assign({}, orig.userData);
      c.side = THREE.DoubleSide;
      c.needsUpdate = true;
      matClones.set(orig.uuid, c);
      return c;
    }
    function solidMat(key, hex) {
      let m = solidFallback.get(key);
      if (m) return m;
      m = new THREE.MeshLambertMaterial({ color: hex, side: THREE.DoubleSide });
      solidFallback.set(key, m);
      return m;
    }
    function topMatReady(t) {
      if (MATERIALS[t].id === 'stone') return rockNoiseMat('rockTop', 0x9c9b92);
      if (useRealMats) { const c = dsClone(topOrig(t)); if (c) return c; }
      return solidMat('t' + t, MATERIALS[t].color);
    }
    function sideMatReady(t) {
      if (MATERIALS[t].id === 'stone') return rockNoiseMat('rockSide', 0x6f6e66);
      if (useRealMats) { const c = dsClone(sideOrig(t)); if (c) return c; }
      const c = new THREE.Color(MATERIALS[t].color); c.multiplyScalar(0.7);
      return solidMat('s' + t, c.getHex());
    }
    function disposeMatCaches() {
      for (const c of matClones.values()) { try { c.dispose(); } catch (_) {} }
      for (const c of solidFallback.values()) { try { c.dispose(); } catch (_) {} }
      for (const c of rockMats.values()) { try { c.dispose(); } catch (_) {} }
      matClones.clear(); solidFallback.clear(); rockMats.clear(); termTopOrig.clear(); termSideOrig.clear();
    }

    // ---- low-level vertex/quad writers (scalars only -> no per-call alloc) ----
    function wv(o, x, y, z, nx, ny, nz, r, g, b) {
      positions[o] = x; positions[o + 1] = y; positions[o + 2] = z;
      normals[o] = nx; normals[o + 1] = ny; normals[o + 2] = nz;
      colors[o] = r; colors[o + 1] = g; colors[o + 2] = b;
    }
    function quad(o, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz, r, g, b) {
      wv(o, ax, ay, az, nx, ny, nz, r, g, b);
      wv(o + 3, bx, by, bz, nx, ny, nz, r, g, b);
      wv(o + 6, cx, cy, cz, nx, ny, nz, r, g, b);
      wv(o + 9, ax, ay, az, nx, ny, nz, r, g, b);
      wv(o + 12, cx, cy, cz, nx, ny, nz, r, g, b);
      wv(o + 15, dx, dy, dz, nx, ny, nz, r, g, b);
    }

    function presentTerrains() {
      const seen = new Uint8Array(MATERIALS.length);
      const out = [];
      for (let k = 0; k < mats.length; k++) if (!seen[mats[k]]) { seen[mats[k]] = 1; out.push(mats[k]); }
      out.sort((a, b) => a - b);
      return out;
    }
    function baseLevelY() {
      let gmin = Infinity;
      for (let k = 0; k < cellH.length; k++) if (cellH[k] < gmin) gmin = cellH[k];
      if (!isFinite(gmin)) gmin = 0;
      const skirted = surfaceY + Math.min(0, gmin) - BASE_SKIRT;
      // Drop the boundary skirt all the way to the home island's dirt-block bottom
      // (y = -DIRT_H) so the outer rim is a solid deep wall. With only BASE_SKIRT
      // the rim was a shallow lip floating above the island underside, leaving an
      // open gap you could see straight through ("see-through sides").
      const dirtBottom = (typeof DIRT_H === 'number') ? -DIRT_H : skirted;
      return Math.min(skirted, dirtBottom);
    }

    // Board cells the user painted water/stone are SUNKEN features they want kept when
    // the mesh is on. The mesh floor-clamps to ground (can't dig below it), so rather
    // than paving them over we (1) keep those home tiles visible (setHomeMeshesVisible)
    // and (2) skip mesh voxels sitting over them — leaving a hole so the sunken
    // water/stone shows through. Voxel grid is gridAtEnter * effVpt, aligned to the board.
    function preserveSunkenTerrain(tr) { return tr === 'water' || tr === 'stone'; }
    function boardTerrainForVoxel(i, j) {
      if (typeof world === 'undefined' || !world || !(gridAtEnter > 0) || !(N > 0)) return null;
      const bx = Math.min(gridAtEnter - 1, Math.max(0, Math.floor(i * gridAtEnter / N)));
      const bz = Math.min(gridAtEnter - 1, Math.max(0, Math.floor(j * gridAtEnter / N)));
      const col = world[bx];
      const cell = col ? col[bz] : null;
      return cell ? cell.terrain : null;
    }
    function voxelIsPreservedSunken(i, j) { return preserveSunkenTerrain(boardTerrainForVoxel(i, j)); }

    // Rebuild the block mesh. Real-material path lays voxels out grouped by
    // terrain (tops, then sides) so each group draws with the right shader.
    function rebuildGeometry() {
      const baseY = baseLevelY();
      if (!useRealMats) { rebuildVertexColored(baseY); return; }

      const present = presentTerrains();
      const grassT = matIndexById('grass');
      const matList = [];
      const groups = [];
      let fo = 0; // float cursor
      const cap = positions.length;            // hard ceiling — typed-array OOB writes are silently dropped
      const bevAbs = Math.min(BEVEL * spacing, spacing * 0.45);

      // Per-voxel geometry scratch (scalars only, no per-voxel allocation — matches the
      // low-level writer contract). vg() fills these from the heightfield + neighbours.
      let _topY, _nE, _nW, _nS, _nN, _eE, _eW, _eS, _eN, _bd, _wy, _x0b, _x1b, _z0b, _z1b;
      function vg(i, j, idx, x0, x1, z0, z1) {
        _topY = surfaceY + cellH[idx];
        _nE = (i + 1 < N) ? surfaceY + cellH[idx + 1] : baseY;
        _nW = (i - 1 >= 0) ? surfaceY + cellH[idx - 1] : baseY;
        _nS = (j + 1 < N) ? surfaceY + cellH[idx + N] : baseY;
        _nN = (j - 1 >= 0) ? surfaceY + cellH[idx - N] : baseY;
        _eE = _topY > _nE + 1e-6; _eW = _topY > _nW + 1e-6;
        _eS = _topY > _nS + 1e-6; _eN = _topY > _nN + 1e-6;
        let md = Infinity;
        if (_eE) md = Math.min(md, _topY - _nE);
        if (_eW) md = Math.min(md, _topY - _nW);
        if (_eS) md = Math.min(md, _topY - _nS);
        if (_eN) md = Math.min(md, _topY - _nN);
        _bd = isFinite(md) ? Math.min(bevAbs, md * 0.5) : 0; // never eat more than half the shortest exposed drop
        _wy = _topY - _bd;                                   // wall / chamfer-bottom height
        // inset the top rect ONLY on exposed edges → flat interiors stay seamless (no quilting)
        _x0b = x0 + (_eW ? bevAbs : 0); _x1b = x1 - (_eE ? bevAbs : 0);
        _z0b = z0 + (_eN ? bevAbs : 0); _z1b = z1 - (_eS ? bevAbs : 0);
      }

      // tops (+ bevel chamfers/corners on EXPOSED edges only)
      for (const t of present) {
        const vStart = fo / 3;
        for (let j = 0; j < N; j++) {
          const z0 = j * spacing - half, z1 = (j + 1) * spacing - half;
          for (let i = 0; i < N; i++) {
            const idx = j * N + i; if (mats[idx] !== t) continue;
            if (voxelIsPreservedSunken(i, j)) continue; // hole over board water/stone
            const x0 = i * spacing - half, x1 = (i + 1) * spacing - half;
            vg(i, j, idx, x0, x1, z0, z1);
            const c = matColor(t);
            if (fo + 18 > cap) break;
            quad(fo, _x0b, _topY, _z0b, _x0b, _topY, _z1b, _x1b, _topY, _z1b, _x1b, _topY, _z0b, 0, 1, 0, c.r, c.g, c.b); fo += 18;
            if (_bd > 1e-6) {
              if (_eE && fo + 18 <= cap) { quad(fo, _x1b, _topY, _z0b, _x1b, _topY, _z1b, x1, _wy, _z1b, x1, _wy, _z0b, 0.7071, 0.7071, 0, c.r, c.g, c.b); fo += 18; }
              if (_eW && fo + 18 <= cap) { quad(fo, _x0b, _topY, _z1b, _x0b, _topY, _z0b, x0, _wy, _z0b, x0, _wy, _z1b, -0.7071, 0.7071, 0, c.r, c.g, c.b); fo += 18; }
              if (_eS && fo + 18 <= cap) { quad(fo, _x0b, _topY, _z1b, _x1b, _topY, _z1b, _x1b, _wy, z1, _x0b, _wy, z1, 0, 0.7071, 0.7071, c.r, c.g, c.b); fo += 18; }
              if (_eN && fo + 18 <= cap) { quad(fo, _x1b, _topY, _z0b, _x0b, _topY, _z0b, _x0b, _wy, z0, _x1b, _wy, z0, 0, 0.7071, -0.7071, c.r, c.g, c.b); fo += 18; }
              // corner fills where two adjacent edges are exposed (closes the L-notch)
              if (_eE && _eS && fo + 18 <= cap) { quad(fo, _x1b, _topY, _z1b, x1, _wy, _z1b, x1, _wy, z1, _x1b, _wy, z1, 0.577, 0.577, 0.577, c.r, c.g, c.b); fo += 18; }
              if (_eW && _eS && fo + 18 <= cap) { quad(fo, _x0b, _topY, _z1b, _x0b, _wy, z1, x0, _wy, z1, x0, _wy, _z1b, -0.577, 0.577, 0.577, c.r, c.g, c.b); fo += 18; }
              if (_eE && _eN && fo + 18 <= cap) { quad(fo, _x1b, _topY, _z0b, x1, _wy, _z0b, x1, _wy, z0, _x1b, _wy, z0, 0.577, 0.577, -0.577, c.r, c.g, c.b); fo += 18; }
              if (_eW && _eN && fo + 18 <= cap) { quad(fo, _x0b, _topY, _z0b, _x0b, _wy, z0, x0, _wy, z0, x0, _wy, _z0b, -0.577, 0.577, -0.577, c.r, c.g, c.b); fo += 18; }
            }
          }
        }
        const count = fo / 3 - vStart;
        if (count > 0) { matList.push(topMatReady(t)); groups.push([vStart, count, matList.length - 1]); }
      }
      // grass bands: a strip of the grass TOP material draping down each exposed grass
      // side before the dirt riser (home-island edge look). Grass voxels only.
      if (grassT >= 0) {
        const vStart = fo / 3;
        const c = matColor(grassT);
        for (let j = 0; j < N; j++) {
          const z0 = j * spacing - half, z1 = (j + 1) * spacing - half;
          for (let i = 0; i < N; i++) {
            const idx = j * N + i; if (mats[idx] !== grassT) continue;
            if (voxelIsPreservedSunken(i, j)) continue; // hole over board water/stone
            const x0 = i * spacing - half, x1 = (i + 1) * spacing - half;
            vg(i, j, idx, x0, x1, z0, z1);
            let bb;
            if (_eE && fo + 18 <= cap) { bb = Math.max(_nE, _wy - GRASS_BAND); if (_wy > bb + 1e-6) { quad(fo, x1, bb, z0, x1, bb, z1, x1, _wy, z1, x1, _wy, z0, 1, 0, 0, c.r, c.g, c.b); fo += 18; } }
            if (_eW && fo + 18 <= cap) { bb = Math.max(_nW, _wy - GRASS_BAND); if (_wy > bb + 1e-6) { quad(fo, x0, bb, z1, x0, bb, z0, x0, _wy, z0, x0, _wy, z1, -1, 0, 0, c.r, c.g, c.b); fo += 18; } }
            if (_eS && fo + 18 <= cap) { bb = Math.max(_nS, _wy - GRASS_BAND); if (_wy > bb + 1e-6) { quad(fo, x0, bb, z1, x1, bb, z1, x1, _wy, z1, x0, _wy, z1, 0, 0, 1, c.r, c.g, c.b); fo += 18; } }
            if (_eN && fo + 18 <= cap) { bb = Math.max(_nN, _wy - GRASS_BAND); if (_wy > bb + 1e-6) { quad(fo, x1, bb, z0, x0, bb, z0, x0, _wy, z0, x1, _wy, z0, 0, 0, -1, c.r, c.g, c.b); fo += 18; } }
          }
        }
        const count = fo / 3 - vStart;
        if (count > 0) { matList.push(topMatReady(grassT)); groups.push([vStart, count, matList.length - 1]); }
      }
      // sides (dirt risers). For grass the wall stops below the grass band.
      for (const t of present) {
        const isGrass = (t === grassT);
        const vStart = fo / 3;
        for (let j = 0; j < N; j++) {
          const z0 = j * spacing - half, z1 = (j + 1) * spacing - half;
          for (let i = 0; i < N; i++) {
            const idx = j * N + i; if (mats[idx] !== t) continue;
            if (voxelIsPreservedSunken(i, j)) continue; // hole over board water/stone
            const x0 = i * spacing - half, x1 = (i + 1) * spacing - half;
            vg(i, j, idx, x0, x1, z0, z1);
            const c = matColor(t);
            let wt;
            if (_eE && fo + 18 <= cap) { wt = isGrass ? Math.max(_nE, _wy - GRASS_BAND) : _wy; if (wt > _nE + 1e-6) { quad(fo, x1, _nE, z0, x1, _nE, z1, x1, wt, z1, x1, wt, z0, 1, 0, 0, c.r, c.g, c.b); fo += 18; } }
            if (_eW && fo + 18 <= cap) { wt = isGrass ? Math.max(_nW, _wy - GRASS_BAND) : _wy; if (wt > _nW + 1e-6) { quad(fo, x0, _nW, z1, x0, _nW, z0, x0, wt, z0, x0, wt, z1, -1, 0, 0, c.r, c.g, c.b); fo += 18; } }
            if (_eS && fo + 18 <= cap) { wt = isGrass ? Math.max(_nS, _wy - GRASS_BAND) : _wy; if (wt > _nS + 1e-6) { quad(fo, x0, _nS, z1, x1, _nS, z1, x1, wt, z1, x0, wt, z1, 0, 0, 1, c.r, c.g, c.b); fo += 18; } }
            if (_eN && fo + 18 <= cap) { wt = isGrass ? Math.max(_nN, _wy - GRASS_BAND) : _wy; if (wt > _nN + 1e-6) { quad(fo, x1, _nN, z0, x0, _nN, z0, x0, wt, z0, x1, wt, z0, 0, 0, -1, c.r, c.g, c.b); fo += 18; } }
          }
        }
        const count = fo / 3 - vStart;
        if (count > 0) { matList.push(sideMatReady(t)); groups.push([vStart, count, matList.length - 1]); }
      }

      geom.clearGroups();
      for (const g of groups) geom.addGroup(g[0], g[1], g[2]);
      geom.setDrawRange(0, fo / 3);
      surfaceMesh.material = matList.length ? matList : [solidMat('empty', 0x6fae4f)];
      geom.attributes.position.needsUpdate = true;
      geom.attributes.normal.needsUpdate = true;
    }

    // Fallback: single vertex-coloured flat-shaded mesh (fixed per-voxel stride).
    function rebuildVertexColored(baseY) {
      for (let j = 0; j < N; j++) {
        const z0 = j * spacing - half, z1 = (j + 1) * spacing - half;
        for (let i = 0; i < N; i++) {
          const idx = j * N + i;
          if (voxelIsPreservedSunken(i, j)) { const oo = idx * FLOATS_PER_VOXEL; for (let k = 0; k < FLOATS_PER_VOXEL; k++) positions[oo + k] = 0; continue; }
          const x0 = i * spacing - half, x1 = (i + 1) * spacing - half;
          const topY = surfaceY + cellH[idx];
          const c = matColor(mats[idx]);
          const cr = c.r, cg = c.g, cb = c.b;
          const wr = cr * 0.78, wg = cg * 0.78, wb = cb * 0.78;
          let o = idx * FLOATS_PER_VOXEL;
          quad(o, x0, topY, z0, x0, topY, z1, x1, topY, z1, x1, topY, z0, 0, 1, 0, cr, cg, cb); o += 18;
          const nE = (i + 1 < N) ? surfaceY + cellH[idx + 1] : baseY;
          if (topY > nE + 1e-6) quad(o, x1, nE, z0, x1, nE, z1, x1, topY, z1, x1, topY, z0, 1, 0, 0, wr, wg, wb); else writeDegenerate(o); o += 18;
          const nW = (i - 1 >= 0) ? surfaceY + cellH[idx - 1] : baseY;
          if (topY > nW + 1e-6) quad(o, x0, nW, z1, x0, nW, z0, x0, topY, z0, x0, topY, z1, -1, 0, 0, wr, wg, wb); else writeDegenerate(o); o += 18;
          const nS = (j + 1 < N) ? surfaceY + cellH[idx + N] : baseY;
          if (topY > nS + 1e-6) quad(o, x0, nS, z1, x1, nS, z1, x1, topY, z1, x0, topY, z1, 0, 0, 1, wr, wg, wb); else writeDegenerate(o); o += 18;
          const nN = (j - 1 >= 0) ? surfaceY + cellH[idx - N] : baseY;
          if (topY > nN + 1e-6) quad(o, x1, nN, z0, x0, nN, z0, x0, topY, z0, x1, topY, z0, 0, 0, -1, wr, wg, wb); else writeDegenerate(o); o += 18;
        }
      }
      geom.attributes.position.needsUpdate = true;
      geom.attributes.normal.needsUpdate = true;
      if (geom.attributes.color) geom.attributes.color.needsUpdate = true;
    }
    function writeDegenerate(o) { for (let k = 0; k < 18; k++) positions[o + k] = 0; }

    function buildSceneMeshes() {
      detectRealMats();
      geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      if (!useRealMats) geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, surfaceY, 0), gridAtEnter * 1.1 + 80);
      const initialMat = useRealMats ? [] : new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
      surfaceMesh = new THREE.Mesh(geom, initialMat);
      surfaceMesh.userData = { kind: 'mesh-terrain-surface' };
      surfaceMesh.renderOrder = 1;
      scene.add(surfaceMesh);
      rebuildGeometry();

      const ringGeo = new THREE.RingGeometry(0.9, 1.0, 48);
      ringGeo.rotateX(-Math.PI / 2);
      brushRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide }));
      brushRing.renderOrder = 30; brushRing.visible = false; scene.add(brushRing);
      grabHandle = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xfff2c4, depthTest: false }));
      grabHandle.renderOrder = 31; grabHandle.visible = false; scene.add(grabHandle);
    }
    function disposeMeshes() {
      cancelScheduledRebuild();
      for (const m of [surfaceMesh, brushRing, grabHandle]) {
        if (!m) continue;
        scene.remove(m);
        if (m.geometry) m.geometry.dispose();
        if (m.material && !Array.isArray(m.material)) m.material.dispose();
      }
      surfaceMesh = brushRing = grabHandle = geom = null;
      disposeMatCaches();
    }

    // ---- picking ----
    function pointerNDC(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      if (!ndc) ndc = new THREE.Vector2();
      return ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    }
    function raycastSurface(clientX, clientY) {
      if (!surfaceMesh) return null;
      if (!ray) ray = new THREE.Raycaster();
      ray.setFromCamera(pointerNDC(clientX, clientY), camera);
      const hits = ray.intersectObject(surfaceMesh, false);
      return hits.length ? hits[0].point : null;
    }
    function voxelAt(point) {
      return { i: clamp(Math.floor((point.x + half) / spacing), 0, N - 1), j: clamp(Math.floor((point.z + half) / spacing), 0, N - 1) };
    }
    function voxelCenter(i, j) { return { x: (i + 0.5) * spacing - half, z: (j + 0.5) * spacing - half }; }
    function falloff(d) { const t = 1 - d / brushRadius; return t <= 0 ? 0 : t * t * (3 - 2 * t); }

    // Public surface sampler used by object placement and multiplayer avatars.
    // It samples the visible/applied/generated block mesh in scene/world coords.
    function sampleWorld(wx, wz) {
      if (!shown() || !cellH || !mats || !(N > 0) || !(spacing > 0)) return null;
      if (!Number.isFinite(wx) || !Number.isFinite(wz)) return null;
      if (wx < -half || wx > half || wz < -half || wz > half) return null;
      const i = clamp(Math.floor((wx + half) / spacing), 0, N - 1);
      const j = clamp(Math.floor((wz + half) / spacing), 0, N - 1);
      if (voxelIsPreservedSunken(i, j)) return null;
      const idx = j * N + i;
      const material = MATERIALS[mats[idx]] ? MATERIALS[mats[idx]].id : 'grass';
      return {
        x: wx,
        z: wz,
        y: surfaceY + cellH[idx],
        walkWorldY: surfaceY + cellH[idx],
        material,
        i,
        j,
        cellX: clamp(Math.floor(i * gridAtEnter / N), 0, gridAtEnter - 1),
        cellZ: clamp(Math.floor(j * gridAtEnter / N), 0, gridAtEnter - 1),
        applied,
        generated: generatedActive,
        solid: true,
      };
    }
    function sampleCell(x, z, opts) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
      opts = opts || {};
      const p = (typeof tilePos === 'function')
        ? tilePos(x, z)
        : { x: x - gridAtEnter / 2 + 0.5, z: z - gridAtEnter / 2 + 0.5 };
      const ox = Number.isFinite(opts.offsetX) ? opts.offsetX : 0;
      const oz = Number.isFinite(opts.offsetZ) ? opts.offsetZ : 0;
      return sampleWorld(p.x + ox, p.z + oz);
    }
    function anchorForCell(x, z, opts) {
      opts = opts || {};
      const ox = Number.isFinite(opts.offsetX) ? opts.offsetX : 0;
      const oz = Number.isFinite(opts.offsetZ) ? opts.offsetZ : 0;
      const radius = Number.isFinite(opts.radius) ? clamp(opts.radius, 0, 2) : 0;
      const probes = [[0, 0]];
      if (radius > 0) {
        probes.push([radius, 0], [-radius, 0], [0, radius], [0, -radius]);
      }
      let best = null;
      let supportCount = 0;
      for (const p of probes) {
        const s = sampleCell(x, z, { offsetX: ox + p[0], offsetZ: oz + p[1] });
        if (!s) continue;
        supportCount++;
        if (!best || s.y > best.y) best = s;
      }
      return best ? Object.assign({}, best, { supportCount }) : null;
    }

    function showBrushAt(point) {
      if (!brushRing) return;
      brushRing.scale.set(brushRadius, 1, brushRadius);
      // ride the actual surface (point.y is the raycast hit on the block top)
      brushRing.position.set(point.x, point.y + 0.02, point.z);
      brushRing.visible = true;
      const v = voxelAt(point), ctr = voxelCenter(v.i, v.j);
      const hs = clamp(spacing * 0.45, 0.05, 0.45);
      grabHandle.scale.set(hs, hs, hs);
      grabHandle.position.set(ctr.x, surfaceY + cellH[v.j * N + v.i] + hs, ctr.z);
      grabHandle.visible = (toolMode === 'sculpt');
    }
    function hideBrush() { if (brushRing) brushRing.visible = false; if (grabHandle) grabHandle.visible = false; }

    // ---- edits ----
    // Coalesce geometry rebuilds to at most one per animation frame, so a fast
    // sculpt/paint drag never forces multiple full-board rewrites per frame
    // (the engine perf budget warns against broad synchronous rebuilds).
    function scheduleRebuild() {
      if (rebuildRAF) return;
      rebuildRAF = requestAnimationFrame(() => { rebuildRAF = 0; if (geom) rebuildGeometry(); });
    }
    function flushRebuild() {
      if (rebuildRAF) { cancelAnimationFrame(rebuildRAF); rebuildRAF = 0; }
      if (geom) rebuildGeometry();
    }
    function cancelScheduledRebuild() {
      if (rebuildRAF) { cancelAnimationFrame(rebuildRAF); rebuildRAF = 0; }
    }
    function applySculpt(worldDy) {
      const gc = voxelCenter(drag.i0, drag.j0);
      const reach = Math.ceil(brushRadius / spacing) + 1;
      for (let dj = -reach; dj <= reach; dj++) {
        const j = drag.j0 + dj; if (j < 0 || j >= N) continue;
        for (let di = -reach; di <= reach; di++) {
          const i = drag.i0 + di; if (i < 0 || i >= N) continue;
          const ctr = voxelCenter(i, j);
          const w = falloff(Math.hypot(ctr.x - gc.x, ctr.z - gc.z));
          if (w <= 0) continue;
          // clamp at ground level (0) so you can't build below the ground
          cellH[j * N + i] = clamp(drag.startH[j * N + i] + worldDy * w, 0, MAX_HEIGHT);
        }
      }
      scheduleRebuild();
      grabHandle.position.y = surfaceY + cellH[drag.j0 * N + drag.i0] + grabHandle.scale.y;
    }
    function applyPaint(point) {
      const reach = Math.ceil(brushRadius / spacing) + 1;
      const v = voxelAt(point);
      let changed = false;
      for (let dj = -reach; dj <= reach; dj++) {
        const j = v.j + dj; if (j < 0 || j >= N) continue;
        for (let di = -reach; di <= reach; di++) {
          const i = v.i + di; if (i < 0 || i >= N) continue;
          const ctr = voxelCenter(i, j);
          if (Math.hypot(ctr.x - point.x, ctr.z - point.z) > brushRadius) continue;
          if (mats[j * N + i] !== paintMatIndex) { mats[j * N + i] = paintMatIndex; changed = true; }
        }
      }
      if (changed) scheduleRebuild();
    }
    function perPixelWorldY(atPoint) {
      const h = renderer.domElement.clientHeight || window.innerHeight || 800;
      if (camera.isOrthographicCamera) return ((camera.top - camera.bottom) / (camera.zoom || 1)) / h;
      const dist = camera.position.distanceTo(atPoint);
      const fov = (camera.fov || 45) * Math.PI / 180;
      return (2 * dist * Math.tan(fov / 2)) / h;
    }

    // ---- pointer handlers (window capture phase) ----
    function inPanel(t) { return (panel && panel.contains(t)) || (toggleBtn && toggleBtn.contains(t)); }
    function onDown(e) {
      if (!editing || inPanel(e.target)) return;
      if (e.target !== renderer.domElement) return;
      if (e.button !== 0) return;
      const point = raycastSurface(e.clientX, e.clientY);
      if (!point) return;
      e.stopPropagation(); e.preventDefault();
      try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) {}
      if (toolMode === 'sculpt') {
        const v = voxelAt(point);
        drag = { kind: 'sculpt', i0: v.i, j0: v.j, startClientY: e.clientY, perPixel: perPixelWorldY(point), startH: cellH.slice() };
        showBrushAt(point);
      } else {
        drag = { kind: 'paint' };
        applyPaint(point); showBrushAt(point);
      }
    }
    function onMove(e) {
      if (!editing || inPanel(e.target)) return;
      if (drag) {
        e.stopPropagation(); e.preventDefault();
        if (drag.kind === 'sculpt') {
          applySculpt((drag.startClientY - e.clientY) * drag.perPixel);
          const ctr = voxelCenter(drag.i0, drag.j0);
          brushRing.position.set(ctr.x, surfaceY + cellH[drag.j0 * N + drag.i0] + 0.02, ctr.z);
        } else {
          const p = raycastSurface(e.clientX, e.clientY);
          if (p) { applyPaint(p); showBrushAt(p); }
        }
        return;
      }
      if (e.target !== renderer.domElement) { hideBrush(); return; }
      const p = raycastSurface(e.clientX, e.clientY);
      if (p) showBrushAt(p); else hideBrush();
    }
    function onUp(e) {
      if (!editing) return;
      if (drag) {
        e.stopPropagation();
        try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (_) {}
        drag = null;
        flushRebuild(); // make sure the final edit is rendered this frame
        // No persistence here: edits stay in memory so Cancel can truly discard.
        // The design is only written to storage on Apply.
      }
    }
    function attachPointer() {
      window.addEventListener('pointerdown', onDown, true);
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
    }
    function detachPointer() {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
    }

    // ---- hide/show the flat home tiles under the block terrain ----
    // Only the ground TILE meshes are toggled; placed objects stay visible so
    // the block terrain replaces the ground without wiping the board.
    function setHomeMeshesVisible(visible) {
      if (typeof cellMeshes !== 'object' || !cellMeshes) return;
      for (let x = 0; x < gridAtEnter; x++) {
        for (let z = 0; z < gridAtEnter; z++) {
          const m = cellMeshes[x + ',' + z];
          if (!m || !m.tile) continue;
          // Keep sunken water/stone tiles visible under the block terrain so the mesh
          // (which leaves holes over them) doesn't erase those features.
          const col = (typeof world !== 'undefined' && world) ? world[x] : null;
          const cell = col ? col[z] : null;
          const keepSunken = !visible && cell && preserveSunkenTerrain(cell.terrain);
          m.tile.visible = visible || !!keepSunken;
        }
      }
    }
    function applyDisplayHiding() { if (shown()) setHomeMeshesVisible(false); }
    function repaint() { if (typeof renderScene === 'function') { try { renderScene(); } catch (_) {} } }

    // ---- open / commit / cancel / remove ----
    function openEditor() {
      if (editing) return;
      if (typeof scene === 'undefined' || typeof camera === 'undefined' || typeof renderer === 'undefined') return;
      if (!shown()) {
        recomputeDims();
        allocBuffers();
        const d = readDesign();
        // Only ever reopen a committed (applied) design; discard stale drafts
        // (e.g. left by an older persist-on-edit build) so Cancel stays durable.
        if (d && d.applied) { applied = true; if (!loadDesignInto(d)) applied = false; }
        else if (d) { clearDesign(); applied = false; }
        buildSceneMeshes();
        if (applied) captureApplied();
      }
      setHomeMeshesVisible(false);
      attachPointer();
      editing = true;
      document.body.classList.add('mesh-terrain-active');
      if (panel) panel.hidden = false;
      if (toggleBtn) toggleBtn.setAttribute('aria-pressed', 'true');
      repaint();
    }
    function leaveEditOnly() {
      detachPointer(); drag = null; hideBrush();
      editing = false;
      document.body.classList.remove('mesh-terrain-active');
      if (panel) panel.hidden = true;
      if (toggleBtn) toggleBtn.setAttribute('aria-pressed', 'false');
    }
    function applyDesign() {
      applied = true;
      generatedActive = false;   // committing turns a generated overlay into a real design
      captureApplied();   // remember this as the revert target
      saveDesign();       // the only place that writes to storage
      setHomeMeshesVisible(false);
      leaveEditOnly(); repaint();
    }
    function cancelEdit() {
      if (appliedSnap) {
        // revert to the last applied design (kept in memory, so this also
        // recovers correctly after a resolution change during the edit)
        if (appliedSnap.vpt !== vpt) {
          vpt = appliedSnap.vpt; savePrefs();
          if (resSeg) syncSeg(resSeg, () => vpt);
          recomputeDims(); allocBuffers();
          cellH.set(appliedSnap.cellH); mats.set(appliedSnap.mats);
          if (shown()) { disposeMeshes(); buildSceneMeshes(); }
        } else {
          cellH.set(appliedSnap.cellH); mats.set(appliedSnap.mats);
          rebuildGeometry();
        }
        applied = true;
        setHomeMeshesVisible(false);
        leaveEditOnly();
      } else {
        // nothing was ever applied -> discard the session entirely and make
        // sure no uncommitted draft is left in storage
        leaveEditOnly(); disposeMeshes();
        cellH = mats = positions = colors = normals = null;
        setHomeMeshesVisible(true); applied = false; generatedActive = false; clearDesign();
      }
      repaint();
    }
    function removeDesign() {
      leaveEditOnly(); disposeMeshes();
      cellH = mats = positions = colors = normals = null;
      setHomeMeshesVisible(true); applied = false; appliedSnap = null; generatedActive = false; clearDesign(); repaint();
    }
    function flatten() {
      if (!cellH) return;
      // in-memory only; persisted on Apply
      cellH.fill(0); mats.fill(0); rebuildGeometry();
    }

    // ---- programmatic generation (e.g. AI/procedural landscape) ----
    // Fill the voxel grid from an external per-voxel sampler. `sample(cellX, cellZ)`
    // receives board-cell coordinates in [0, gridAtEnter] and returns
    // { material: 'grass'|'sand'|..., level: 1..N } or { material, height: worldY }.
    // Builds + displays the block terrain as a transient overlay that hides the
    // flat home tiles (like an applied design) but is NOT persisted unless
    // opts.persist is set — generated terrain is rebuilt from its source instead.
    function generateFromSampler(sample, opts) {
      if (typeof sample !== 'function') return false;
      if (typeof scene === 'undefined' || typeof camera === 'undefined' || typeof renderer === 'undefined') return false;
      opts = opts || {};
      if (editing) {
        detachPointer(); drag = null; hideBrush(); editing = false;
        document.body.classList.remove('mesh-terrain-active');
        if (panel) panel.hidden = true;
        if (toggleBtn) toggleBtn.setAttribute('aria-pressed', 'false');
      }
      recomputeDims();
      if (shown()) disposeMeshes();
      allocBuffers();
      const stepH = Number.isFinite(opts.levelStep) ? opts.levelStep : 1.0;
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const cellX = (i + 0.5) * gridAtEnter / N;
          const cellZ = (j + 0.5) * gridAtEnter / N;
          const s = sample(cellX, cellZ) || {};
          const mi = matIndexById(s.material);
          mats[j * N + i] = mi >= 0 ? mi : 0;
          const h = Number.isFinite(s.height) ? s.height
                  : Number.isFinite(s.level) ? (s.level - 1) * stepH : 0;
          cellH[j * N + i] = clamp(h, 0, MAX_HEIGHT);
        }
      }
      buildSceneMeshes();
      setHomeMeshesVisible(false);
      generatedActive = true;
      if (opts.persist) { applied = true; captureApplied(); saveDesign(); }
      else { applied = false; appliedSnap = null; }
      repaint();
      return true;
    }
    // Tear down a transient generated terrain and restore the flat tiles. No-op
    // if there is no generated terrain, or if the user has opened it for editing.
    function clearGenerated() {
      if (!generatedActive || editing) return;
      generatedActive = false;
      disposeMeshes();
      cellH = mats = positions = colors = normals = null;
      setHomeMeshesVisible(true);
      applied = false; appliedSnap = null;
      repaint();
    }

    function changeResolution(newVpt) {
      if (!VPT_OPTIONS.includes(newVpt) || newVpt === vpt) return;
      const oldN = N, oldH = cellH, oldM = mats, oldGrid = gridAtEnter, wasShown = shown();
      vpt = newVpt; savePrefs();
      recomputeDims(); allocBuffers();
      if (oldH && oldGrid === gridAtEnter) {
        for (let j = 0; j < N; j++) {
          for (let i = 0; i < N; i++) {
            const oi = clamp(Math.floor(i / N * oldN), 0, oldN - 1);
            const oj = clamp(Math.floor(j / N * oldN), 0, oldN - 1);
            cellH[j * N + i] = oldH[oj * oldN + oi];
            mats[j * N + i] = oldM[oj * oldN + oi];
          }
        }
      }
      if (wasShown) { disposeMeshes(); buildSceneMeshes(); }
      repaint(); // in-memory only; persisted on Apply
    }

    function restoreApplied() {
      const d = readDesign();
      if (!d || !d.applied || typeof GRID !== 'number') return;
      gridAtEnter = GRID;
      if (d.gridSize !== gridAtEnter) return;
      if (VPT_OPTIONS.includes(d.vpt)) vpt = d.vpt;
      if (resSeg) syncSeg(resSeg, () => vpt); // keep the resolution control in sync
      recomputeDims(); allocBuffers();
      if (!loadDesignInto(d)) return;
      applied = true;
      buildSceneMeshes();
      captureApplied();
      setHomeMeshesVisible(false);
      setTimeout(applyDisplayHiding, 600);
      setTimeout(applyDisplayHiding, 1800);
      repaint();
    }

    // ---- UI ----
    function injectStyles() {
      if (document.getElementById('mesh-terrain-styles')) return;
      const css = `
.mesh-terrain-toggle{position:fixed;right:14px;top:50%;transform:translateY(-178px);z-index:60;
  display:inline-flex;align-items:center;gap:6px;padding:8px 11px;border-radius:12px;cursor:pointer;
  font:600 12px/1 system-ui,sans-serif;color:#143878;background:rgba(232,241,255,.96);
  border:1.5px solid #143878;box-shadow:inset 0 0 0 1px #fff, 0 4px 14px rgba(0,0,0,.18);}
.mesh-terrain-toggle[aria-pressed="true"]{background:#143878;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4),0 4px 14px rgba(0,0,0,.25);}
.mesh-terrain-toggle .glyph{font-size:14px;line-height:1;}
.mesh-terrain-panel{position:fixed;right:14px;top:50%;transform:translateY(-90px);z-index:61;width:236px;
  background:rgba(244,248,255,.98);color:#143878;border:1.5px solid #143878;border-radius:14px;
  box-shadow:inset 0 0 0 1px #fff,0 10px 30px rgba(0,0,0,.28);font:500 12px/1.35 system-ui,sans-serif;padding:10px 12px 12px;}
.mesh-terrain-panel[hidden]{display:none;}
.mesh-terrain-panel h4{margin:0 0 8px;font-size:13px;display:flex;align-items:center;justify-content:space-between;}
.mesh-terrain-panel .mt-close{cursor:pointer;border:none;background:none;color:#143878;font-size:16px;line-height:1;padding:0 2px;}
.mesh-terrain-panel .mt-row{margin:8px 0;}
.mesh-terrain-panel .mt-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;opacity:.7;margin-bottom:4px;}
.mesh-terrain-seg{display:flex;gap:4px;flex-wrap:wrap;}
.mesh-terrain-seg button{flex:1 1 auto;min-width:34px;padding:5px 6px;border-radius:8px;cursor:pointer;border:1.5px solid #143878;background:#fff;color:#143878;font:600 11px/1 system-ui,sans-serif;}
.mesh-terrain-seg button.on{background:#143878;color:#fff;}
.mesh-terrain-swatches{display:flex;flex-wrap:wrap;gap:5px;}
.mesh-terrain-swatches button{width:26px;height:26px;border-radius:7px;cursor:pointer;border:2px solid rgba(20,56,120,.35);}
.mesh-terrain-swatches button.on{border-color:#143878;box-shadow:0 0 0 2px rgba(20,56,120,.25);}
.mesh-terrain-panel input[type=range]{width:100%;}
.mesh-terrain-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
.mesh-terrain-actions button{flex:1 1 46%;padding:7px 6px;border-radius:9px;cursor:pointer;font:700 11px/1 system-ui,sans-serif;border:1.5px solid #143878;}
.mesh-terrain-actions .mt-apply{background:#1f7a3d;border-color:#0f4a24;color:#fff;}
.mesh-terrain-actions .mt-reset{background:#fff;color:#143878;}
.mesh-terrain-actions .mt-cancel{background:#fff;color:#8a2b2b;border-color:#8a2b2b;}
.mesh-terrain-actions .mt-remove{background:#fff;color:#8a2b2b;border-color:#8a2b2b;}
.mesh-terrain-hint{margin-top:8px;font-size:10.5px;opacity:.72;line-height:1.4;}
@media (max-width:700px){.mesh-terrain-toggle,.mesh-terrain-panel{top:auto;bottom:90px;transform:none;}.mesh-terrain-panel{right:8px;left:8px;width:auto;}}
`;
      const style = document.createElement('style');
      style.id = 'mesh-terrain-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }
    function makeSeg(options, getActive, onPick) {
      const wrap = document.createElement('div');
      wrap.className = 'mesh-terrain-seg';
      options.forEach(opt => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = opt.label; b.dataset.val = String(opt.val);
        b.addEventListener('click', () => { onPick(opt.val); syncSeg(wrap, getActive); });
        wrap.appendChild(b);
      });
      syncSeg(wrap, getActive);
      return wrap;
    }
    function syncSeg(wrap, getActive) {
      const cur = String(getActive());
      wrap.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === cur));
    }
    function syncPaintVisibility() {
      if (!panel) return;
      panel.querySelectorAll('.mt-paint-only').forEach(el => { el.style.display = (toolMode === 'paint') ? '' : 'none'; });
    }

    function buildUI() {
      if (builtUI) return;
      builtUI = true;
      injectStyles();

      toggleBtn = document.createElement('button');
      toggleBtn.type = 'button'; toggleBtn.id = 'mesh-terrain-toggle'; toggleBtn.className = 'mesh-terrain-toggle';
      toggleBtn.setAttribute('aria-pressed', 'false');
      toggleBtn.title = 'Mesh Terrain — sculpt & paint a voxel-block landscape';
      toggleBtn.innerHTML = '<span class="glyph">◰</span><span>Mesh Terrain</span>';
      toggleBtn.addEventListener('click', () => { editing ? cancelEdit() : openEditor(); });
      toggleBtn.style.display = 'none'; // hidden for now (temporary — remove this line to restore)
      document.body.appendChild(toggleBtn);

      panel = document.createElement('div');
      panel.id = 'mesh-terrain-panel'; panel.className = 'mesh-terrain-panel'; panel.hidden = true;

      const head = document.createElement('h4');
      head.innerHTML = '<span>Mesh Terrain</span>';
      const close = document.createElement('button');
      close.type = 'button'; close.className = 'mt-close'; close.textContent = '×';
      close.title = 'Close (revert this edit)'; close.setAttribute('aria-label', 'Close Mesh Terrain (revert this edit)');
      close.addEventListener('click', cancelEdit);
      head.appendChild(close); panel.appendChild(head);

      const resRow = document.createElement('div'); resRow.className = 'mt-row';
      const resLab = document.createElement('div'); resLab.className = 'mt-label'; resLab.textContent = 'Voxels / tile';
      resRow.appendChild(resLab);
      resSeg = makeSeg(VPT_OPTIONS.map(v => ({ label: v + '²', val: v })), () => vpt, v => changeResolution(v));
      resRow.appendChild(resSeg);
      panel.appendChild(resRow);

      const modeRow = document.createElement('div'); modeRow.className = 'mt-row';
      const modeLab = document.createElement('div'); modeLab.className = 'mt-label'; modeLab.textContent = 'Tool';
      modeSeg = makeSeg([{ label: 'Sculpt', val: 'sculpt' }, { label: 'Paint', val: 'paint' }], () => toolMode, v => { toolMode = v; savePrefs(); syncPaintVisibility(); });
      modeRow.appendChild(modeLab); modeRow.appendChild(modeSeg); panel.appendChild(modeRow);

      const swRow = document.createElement('div'); swRow.className = 'mt-row mt-paint-only';
      const swLab = document.createElement('div'); swLab.className = 'mt-label'; swLab.textContent = 'Material';
      swatchWrap = document.createElement('div'); swatchWrap.className = 'mesh-terrain-swatches';
      MATERIALS.forEach((m, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.title = m.label;
        b.setAttribute('aria-label', 'Paint material: ' + m.label);
        b.setAttribute('aria-pressed', String(i === paintMatIndex));
        b.style.background = '#' + m.color.toString(16).padStart(6, '0');
        b.classList.toggle('on', i === paintMatIndex);
        b.addEventListener('click', () => {
          paintMatIndex = i; savePrefs();
          swatchWrap.querySelectorAll('button').forEach((el, k) => { el.classList.toggle('on', k === i); el.setAttribute('aria-pressed', String(k === i)); });
        });
        swatchWrap.appendChild(b);
      });
      swRow.appendChild(swLab); swRow.appendChild(swatchWrap); panel.appendChild(swRow);

      const brushRow = document.createElement('div'); brushRow.className = 'mt-row';
      const brushLab = document.createElement('div'); brushLab.className = 'mt-label';
      brushLab.innerHTML = 'Brush size <span id="mt-brush-val"></span>';
      brushInput = document.createElement('input');
      brushInput.type = 'range'; brushInput.min = '0.3'; brushInput.max = '6'; brushInput.step = '0.1'; brushInput.value = String(brushRadius);
      brushVal = brushLab.querySelector('#mt-brush-val'); brushVal.textContent = '(' + brushRadius.toFixed(1) + ')';
      brushInput.addEventListener('input', () => { brushRadius = parseFloat(brushInput.value) || 1.5; brushVal.textContent = '(' + brushRadius.toFixed(1) + ')'; savePrefs(); });
      brushRow.appendChild(brushLab); brushRow.appendChild(brushInput); panel.appendChild(brushRow);

      const actions = document.createElement('div'); actions.className = 'mesh-terrain-actions';
      const apply = document.createElement('button'); apply.type = 'button'; apply.className = 'mt-apply'; apply.textContent = 'Apply'; apply.title = 'Keep these blocks as the terrain'; apply.addEventListener('click', applyDesign);
      const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'mt-reset'; reset.textContent = 'Flatten'; reset.title = 'Reset to flat grass blocks'; reset.addEventListener('click', flatten);
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'mt-cancel'; cancel.textContent = 'Cancel'; cancel.title = 'Revert this edit'; cancel.addEventListener('click', cancelEdit);
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'mt-remove'; remove.textContent = 'Remove'; remove.title = 'Delete the block terrain and restore flat tiles'; remove.addEventListener('click', removeDesign);
      actions.appendChild(apply); actions.appendChild(reset); actions.appendChild(cancel); actions.appendChild(remove);
      panel.appendChild(actions);

      const hint = document.createElement('div'); hint.className = 'mesh-terrain-hint';
      hint.textContent = 'Sculpt: drag a voxel up/down — flat-topped blocks, neighbours follow with tension. Paint: drag to lay material. Drag empty space to orbit. Apply keeps the blocks as the terrain.';
      panel.appendChild(hint);

      document.body.appendChild(panel);
      syncPaintVisibility();
    }

    function boot() {
      loadPrefs();
      buildUI();
      try { restoreApplied(); } catch (_) {}
      window.addEventListener('tinyworld:world-changed', applyDisplayHiding);
    }
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot); else boot();

    window.__tinyworldMeshTerrain = {
      open: openEditor, apply: applyDesign, cancel: cancelEdit, remove: removeDesign,
      generate: generateFromSampler, clearGenerated: clearGenerated,
      sampleWorld: sampleWorld, sampleCell: sampleCell, anchorForCell: anchorForCell,
      isEditing: () => editing, isApplied: () => applied, isGenerated: () => generatedActive,
      setTool: (m) => { if (m === 'sculpt' || m === 'paint') { toolMode = m; if (modeSeg) syncSeg(modeSeg, () => toolMode); syncPaintVisibility(); } },
    };
  })();
