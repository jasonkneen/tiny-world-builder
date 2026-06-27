  // -------- house primitives + assembler --------
  // The house is decomposed into reusable parts. A "house plan" describes
  // which face each cell of a cluster presents (gable door at one end,
  // side doors elsewhere) and the assembler builds the geometry from
  // primitive parts. Both solo and cluster houses go through the same path,
  // so adding new shapes (L-cluster, square, etc.) only needs new plans.

  const H = {
    WALL_W: 0.82,        // short-axis wall width
    WALL_H: 0.55,        // wall height to eaves
    PEAK_Y: 0.87,        // ridge apex
    T:      0.06,        // roof slab thickness
    ROOF_OVERHANG: 0.3,  // roof depth = WALL_D + this (extends past long-axis ends)
  };

  const Parts = {
    // Wall volume — rounded box covering the cluster's long-axis extent.
    walls(WALL_D) {
      return new THREE.Mesh(roundedBox(H.WALL_W, H.WALL_H, WALL_D, 0.04), M.wallCream);
    },

    // Gable facade (in XY plane, 0.04 thick in z). It reaches down over the
    // flat wall face instead of stopping at the eave line, avoiding a bright
    // horizontal edge above the door.
    gable(bottomY = 0) {
      const shape = new THREE.Shape();
      shape.moveTo(-H.WALL_W / 2, bottomY);
      shape.lineTo(-H.WALL_W / 2, H.WALL_H);
      shape.lineTo(0, H.PEAK_Y);
      shape.lineTo( H.WALL_W / 2, H.WALL_H);
      shape.lineTo( H.WALL_W / 2, bottomY);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false, curveSegments: 1 });
      return new THREE.Mesh(geo, M.wallCream);
    },

    // Pitched roof: two slabs whose bottom faces sit along the gable hypotenuse,
    // plus a ridge cap. Origin at house centre. Front/back overhang can be set
    // asymmetrically — composite wings pass backOverhang=0 so the wing's inside
    // end doesn't poke through the main wing's roof.
    pitchedRoof(WALL_D, frontOverhang = 0.15, backOverhang = 0.15) {
      const g = new THREE.Group();
      const halfW = H.WALL_W / 2;
      const ROOF_DEPTH = WALL_D + frontOverhang + backOverhang;
      const ROOF_Z     = (frontOverhang - backOverhang) / 2; // shift centre when asymmetric
      const rise = H.PEAK_Y - H.WALL_H;
      const slabLen   = Math.sqrt(halfW * halfW + rise * rise);
      const slabAngle = Math.atan2(rise, halfW);
      const sa = Math.sin(slabAngle), ca = Math.cos(slabAngle);
      const slabGeo = getBoxGeometryPrecise(slabLen, H.T, ROOF_DEPTH);

      const slabL = new THREE.Mesh(slabGeo, M.roofBlue);
      slabL.position.set(-halfW / 2 - (H.T / 2) * sa, (H.WALL_H + H.PEAK_Y) / 2 + (H.T / 2) * ca, ROOF_Z);
      slabL.rotation.z = slabAngle;
      g.add(slabL);

      const slabR = new THREE.Mesh(slabGeo, M.roofBlue);
      slabR.position.set( halfW / 2 + (H.T / 2) * sa, (H.WALL_H + H.PEAK_Y) / 2 + (H.T / 2) * ca, ROOF_Z);
      slabR.rotation.z = -slabAngle;
      g.add(slabR);

      const ridge = new THREE.Mesh(getBoxGeometryPrecise(0.10, 0.06, ROOF_DEPTH + 0.02), M.roofBlueD);
      ridge.position.set(0, H.PEAK_Y + (H.T / 2) * ca + 0.005, ROOF_Z);
      g.add(ridge);
      return g;
    },

    // Hipped (pyramidal) roof — 4 triangular slabs meeting at a central apex.
    // Used for square / 2x2 footprints. Origin at base centre, base at y=0,
    // apex at y=rise. Built as a BufferGeometry pyramid with computed normals.
    hippedRoof(width, depth, rise) {
      const halfW = width / 2;
      const halfD = depth / 2;
      const verts = new Float32Array([
        0,      rise, 0,        // 0: apex
        -halfW, 0,    -halfD,   // 1: NW
         halfW, 0,    -halfD,   // 2: NE
         halfW, 0,     halfD,   // 3: SE
        -halfW, 0,     halfD,   // 4: SW
      ]);
      // CCW winding from outside (verified by cross-product: each face's outward
      // normal points away from the apex with the correct sign).
      const indices = new Uint16Array([
        0, 2, 1,  // north face (apex, ne, nw) — outward normal -z
        0, 3, 2,  // east face  (apex, se, ne) — outward normal +x
        0, 4, 3,  // south face (apex, sw, se) — outward normal +z
        0, 1, 4,  // west face  (apex, nw, sw) — outward normal -x
      ]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
      geo.computeVertexNormals();
      return new THREE.Mesh(geo, M.roofBlue);
    },

    // Door + arches + knob. orientation:
    //   'gable' — door faces +z, outer face at z=0 of the part's local frame.
    //   'side'  — door faces +x, outer face at x=0.
    // Origin is at GROUND LEVEL beneath the door's outer face centre, so callers
    // place a door by setting its position to where the door's centre projects on the floor.
    door(orientation) {
      const g = new THREE.Group();
      if (orientation === 'gable') {
        const door = new THREE.Mesh(getBoxGeometryPrecise(0.2, 0.48, 0.04), M.door);
        door.position.set(0, 0.24, 0); g.add(door);
        const trimV = getBoxGeometry(0.04, 0.48, 0.04);
        const aL = new THREE.Mesh(trimV, M.woodTrim); aL.position.set(-0.10, 0.24, 0.01); g.add(aL);
        const aR = new THREE.Mesh(trimV, M.woodTrim); aR.position.set( 0.10, 0.24, 0.01); g.add(aR);
        const aT = new THREE.Mesh(getBoxGeometry(0.24, 0.04, 0.04), M.woodTrim); aT.position.set(0, 0.50, 0.01); g.add(aT);
        const knob = new THREE.Mesh(getSphereGeometry(0.022, 8, 8), M.knob);
        knob.position.set(0.08, 0.24, 0.03); g.add(knob);
      } else {
        const door = new THREE.Mesh(getBoxGeometryPrecise(0.04, 0.48, 0.2), M.door);
        door.position.set(0, 0.24, 0); g.add(door);
        const trimV = getBoxGeometry(0.04, 0.48, 0.04);
        const aL = new THREE.Mesh(trimV, M.woodTrim); aL.position.set(0.01, 0.24, -0.10); g.add(aL);
        const aR = new THREE.Mesh(trimV, M.woodTrim); aR.position.set(0.01, 0.24,  0.10); g.add(aR);
        const aT = new THREE.Mesh(getBoxGeometry(0.04, 0.04, 0.24), M.woodTrim); aT.position.set(0.01, 0.50, 0); g.add(aT);
        const knob = new THREE.Mesh(getSphereGeometry(0.022, 8, 8), M.knob);
        knob.position.set(0.03, 0.24, 0.05); g.add(knob);
      }
      return g;
    },

    // Window with frame, glass and cross trims, layered along the outer-face axis.
    // Origin at the FRAME CENTRE; callers place by setting position to where the
    // frame's centre should sit on the wall surface.
    window(orientation, size = 'large') {
      const g = new THREE.Group();
      const f = size === 'small' ? 0.20 : 0.24; // frame
      const p = f * windowGlassRatio();         // glass / cross length (bigger ratio = more glass, thinner wood)
      if (orientation === 'gable') {
        const wf = new THREE.Mesh(getBoxGeometry(f, f, 0.04), M.woodTrim); wf.position.set(0, 0, 0); g.add(wf);
        const wg = makeWindowPane(p, p, '+z', 0.03); g.add(wg);
        const cH = new THREE.Mesh(getBoxGeometry(p, 0.012, 0.04), M.woodTrim); cH.position.set(0, 0, 0.025); g.add(cH);
        const cV = new THREE.Mesh(getBoxGeometry(0.012, p, 0.04), M.woodTrim); cV.position.set(0, 0, 0.025); g.add(cV);
      } else {
        const wf = new THREE.Mesh(getBoxGeometry(0.04, f, f), M.woodTrim); wf.position.set(0, 0, 0); g.add(wf);
        const wg = makeWindowPane(p, p, '+x', 0.03); g.add(wg);
        const cH = new THREE.Mesh(getBoxGeometry(0.04, 0.012, p), M.woodTrim); cH.position.set(0.025, 0, 0); g.add(cH);
        const cV = new THREE.Mesh(getBoxGeometry(0.04, p, 0.012), M.woodTrim); cV.position.set(0.025, 0, 0); g.add(cV);
      }
      return g;
    },

    // Chimney stack. Origin at chimney CENTRE in y (so a position of y=0.85 puts
    // the bottom inside the wall and the top at y=1.15).
    chimney() {
      return new THREE.Mesh(getBoxGeometryPrecise(0.14, 0.6, 0.14), M.chimney);
    },

    // Doorstep slab. Origin at step CENTRE.
    step(orientation) {
      return orientation === 'side'
        ? new THREE.Mesh(getBoxGeometryPrecise(0.12, 0.06, 0.26), M.step)
        : new THREE.Mesh(getBoxGeometryPrecise(0.26, 0.06, 0.12), M.step);
    },

    // External staircase — chunky stylized stair climbing toward -z and +y
    // from the part's origin (placed at the bottom-front of the lowest step).
    // 6 steps; each step is full stepRise tall (no y overlap) but 1.4x wide
    // in depth so consecutive steps visually overlap in z.
    externalStairs(rise) {
      const g = new THREE.Group();
      const N = 6;
      const stepRise = rise / N;
      const stepRun  = 0.10;
      const width    = 0.22;
      for (let i = 0; i < N; i++) {
        const s = new THREE.Mesh(
          getBoxGeometryPrecise(width, stepRise, stepRun * 1.4),
          M.step
        );
        s.position.set(0, stepRise * (i + 0.5), -i * stepRun);
        g.add(s);
      }
      return g;
    },

    // Upper-floor door reached by external stairs. Same geometry as the side
    // door but smaller, intended to sit on a +x face.
    upperDoor() {
      const g = new THREE.Group();
      const door = new THREE.Mesh(getBoxGeometryPrecise(0.04, 0.42, 0.18), M.door);
      door.position.set(0, 0.21, 0); g.add(door);
      const trimV = getBoxGeometry(0.04, 0.42, 0.04);
      const aL = new THREE.Mesh(trimV, M.woodTrim); aL.position.set(0.01, 0.21, -0.09); g.add(aL);
      const aR = new THREE.Mesh(trimV, M.woodTrim); aR.position.set(0.01, 0.21,  0.09); g.add(aR);
      const aT = new THREE.Mesh(getBoxGeometry(0.04, 0.04, 0.22), M.woodTrim); aT.position.set(0.01, 0.44, 0); g.add(aT);
      const knob = new THREE.Mesh(getSphereGeometry(0.020, 8, 8), M.knob);
      knob.position.set(0.03, 0.21, 0.05); g.add(knob);
      return g;
    },
  };

  // A linear (1xN) plan: south-end cell uses the gable-end door, the rest use side
  // doors on the +x face, chimneys alternate forward/back per cell for visual rhythm.
  // For length 1 the chimney offset matches the original solo cottage.
  function linearHousePlan(length) {
    const cells = [];
    for (let i = 0; i < length; i++) {
      const isSouthEnd = (i === length - 1);
      const chimneyOffset = (length === 1) ? -0.05 : (i % 2 === 0 ? -0.15 : 0.15);
      cells.push({ face: isSouthEnd ? 'gable' : 'side', chimneyOffset });
    }
    return cells;
  }

  // Assemble a house from a cell plan. orientation: 'z' (long-axis along z, no
  // rotation) or 'x' (long-axis along x, geometry rotated +π/2 around Y).
  // floors: 1 (default), 2, 3 — walls stretch upward, per-floor windows added,
  // and at floors === 2 an exterior staircase appears against the +x face
  // leading to an upper door (floors >= 3 implies internal stairs and the
  // exterior set is removed). opts.{frontOverhang, backOverhang} let composite
  // wings trim the inside end of the roof so it doesn't poke through the main
  // wing's roof — pass backOverhang=0 to disable the inside overhang. opts.
  // suppressBackGable hides the -z gable triangle (used for composite wings,
  // since their back gable would be coplanar with the main wing's outer wall
  // and cause z-fighting / redundant geometry).
  function buildHouse(cells, orientation = 'z', floors = 1, opts = {}) {
    const { frontOverhang = 0.15, backOverhang = 0.15, suppressBackGable = false } = opts;
    const g = new THREE.Group();
    const length = cells.length;
    // Solo cottage keeps its original slimmer depth. Clusters fill the cells.
    const WALL_D = (length === 1) ? 0.7 : length * TILE - 0.18;
    const halfW = H.WALL_W / 2;
    const halfD = WALL_D / 2;
    const wallHTotal = H.WALL_H * floors;
    const roofLift   = (floors - 1) * H.WALL_H;

    // Walls — stretched in Y for upper floors. roundedBox extrudes from y=0
    // upward, so no y-shift is needed: bottom sits at ground, top at wallHTotal.
    const walls = new THREE.Mesh(roundedBox(H.WALL_W, wallHTotal, WALL_D, 0.04), M.wallCream);
    g.add(walls);

    // Gables sit above the top floor's wall top. Composite wings suppress the
    // back gable since it's coplanar with the main wing's outer wall.
    const gableBottomY = -roofLift;
    const gF = Parts.gable(gableBottomY); gF.position.set(0, roofLift, halfD - 0.035); g.add(gF);
    if (!suppressBackGable) {
      const gB = Parts.gable(gableBottomY); gB.position.set(0, roofLift, -halfD - 0.005); g.add(gB);
    }

    // Roof — pitched roof raised by roofLift. backOverhang/frontOverhang let
    // composite wings trim the inside end so it doesn't poke through the main
    // wing's roof.
    const roof = Parts.pitchedRoof(WALL_D, frontOverhang, backOverhang);
    roof.position.y = roofLift;
    g.add(roof);

    // Per-floor windows for any floor above the ground floor — small windows on
    // both long sides AND on both gable faces (so tall houses don't have blank
    // gable walls).
    for (let f = 1; f < floors; f++) {
      const yOff = f * H.WALL_H;
      for (let i = 0; i < length; i++) {
        const cellZ = -((length - 1) / 2) + i;
        const wR = Parts.window('side', 'small');
        wR.position.set( halfW + 0.005, 0.32 + yOff, cellZ); g.add(wR);
        const wL = Parts.window('side', 'small');
        wL.position.set(-halfW - 0.005, 0.32 + yOff, cellZ);
        wL.rotation.y = Math.PI;
        g.add(wL);
      }
      // Gable-face upper windows at cluster's two ends
      const wGF = Parts.window('gable', 'small');
      wGF.position.set(0, 0.32 + yOff, halfD + 0.005); g.add(wGF);
      const wGB = Parts.window('gable', 'small');
      wGB.position.set(0, 0.32 + yOff, -halfD - 0.005);
      wGB.rotation.y = Math.PI;
      g.add(wGB);
    }

    // Per-cell ground-floor decorations (door, window, chimney, step) — same as before.
    const chimneyTopsLocal = [];
    for (let i = 0; i < length; i++) {
      const cell = cells[i];
      const cellZ = -((length - 1) / 2) + i;

      if (cell.face === 'gable') {
        const door = Parts.door('gable');
        door.position.set(-0.12, 0, halfD + 0.01); g.add(door);
        const win = Parts.window('gable');
        win.position.set(0.2, 0.32, halfD + 0.01); g.add(win);
        const step = Parts.step('gable');
        step.position.set(-0.12, 0.03, halfD + 0.08); g.add(step);
      } else if (cell.face === 'side') {
        const dx = halfW + 0.005;
        const door = Parts.door('side');
        door.position.set(dx, 0, cellZ - 0.1); g.add(door);
        const win = Parts.window('side');
        win.position.set(dx, 0.32, cellZ + 0.18); g.add(win);
        const step = Parts.step('side');
        step.position.set(dx + 0.06, 0.03, cellZ - 0.1); g.add(step);
        const bwin = Parts.window('side', 'small');
        bwin.position.set(-halfW - 0.005, 0.32, cellZ);
        bwin.rotation.y = Math.PI;
        g.add(bwin);
      }

      // Chimney — bottom hides at the top floor's wall top, top sits 0.30
      // above the wall top regardless of floors.
      const chim = Parts.chimney();
      const chimX = -0.28;
      const chimZ = cellZ + (cell.chimneyOffset || 0);
      chim.position.set(chimX, wallHTotal + 0.30, chimZ); g.add(chim);
      chimneyTopsLocal.push(new THREE.Vector3(chimX, wallHTotal + 0.60, chimZ));
    }

    // External staircase + upper door — only when there's exactly 2 floors.
    // Stairs sit alongside the +x face, climbing from south (bottom) to north
    // (top); the upper door sits at the top, on the +x wall at floor 2 height.
    if (floors === 2) {
      const stairsBottomZ = halfD - 0.10;
      const stairsX = halfW + 0.13;
      const stairsTopZ = stairsBottomZ - 5 * 0.10; // 5 steps further north (z=-)
      const stairs = Parts.externalStairs(H.WALL_H);
      stairs.position.set(stairsX, 0, stairsBottomZ);
      g.add(stairs);
      const upd = Parts.upperDoor();
      upd.position.set(halfW + 0.005, H.WALL_H, stairsTopZ);
      g.add(upd);
    }

    castReceive(g);

    let chimneyTops;
    if (orientation === 'x') {
      g.rotation.y = Math.PI / 2;
      const ax = new THREE.Vector3(0, 1, 0);
      chimneyTops = chimneyTopsLocal.map(v => v.clone().applyAxisAngle(ax, Math.PI / 2));
    } else {
      chimneyTops = chimneyTopsLocal;
    }
    g.userData = { kind: 'house', chimneyTops };
    return g;
  }

  function makeHouse(floors = 1) {
    return buildHouse(linearHousePlan(1), 'z', floors);
  }

  function isUnderpassTerrain(terrain) {
    return false;
  }

  function wrapHouseForUnderpass(house, terrain) {
    const g = new THREE.Group();
    const clearance = terrain === 'water' ? 0.78 : 0.66;
    const box = new THREE.Box3().setFromObject(house);
    const w = Math.max(0.82, (box.max.x - box.min.x) + 0.12);
    const d = Math.max(0.82, (box.max.z - box.min.z) + 0.12);
    const halfW = w / 2;
    const halfD = d / 2;
    const mat = terrain === 'water' ? M.bridgeWoodD : M.castleStone;
    const trim = terrain === 'water' ? M.bridgeWood : M.castleStoneD;

    const deck = new THREE.Mesh(getBoxGeometryPrecise(w, 0.08, d), trim);
    deck.position.y = clearance - 0.04;
    g.add(deck);

    const postH = clearance;
    const postW = 0.11;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(getBoxGeometryPrecise(postW, postH, postW), mat);
        post.position.set(sx * (halfW - postW / 2), postH / 2, sz * (halfD - postW / 2));
        g.add(post);
      }
    }

    const archH = 0.10;
    const beamY = clearance - 0.18;
    const north = new THREE.Mesh(getBoxGeometryPrecise(w, archH, postW), mat);
    north.position.set(0, beamY, -halfD + postW / 2);
    g.add(north);
    const south = north.clone();
    south.position.z = halfD - postW / 2;
    g.add(south);
    const west = new THREE.Mesh(getBoxGeometryPrecise(postW, archH, d), mat);
    west.position.set(-halfW + postW / 2, beamY, 0);
    g.add(west);
    const east = west.clone();
    east.position.x = halfW - postW / 2;
    g.add(east);

    const lip = new THREE.Mesh(getBoxGeometryPrecise(w + 0.08, 0.04, d + 0.08), trim);
    lip.position.y = clearance + 0.02;
    g.add(lip);

    house.position.y = clearance;
    g.add(house);
    const tops = (house.userData.chimneyTops || []).map(v => new THREE.Vector3(v.x, v.y + clearance, v.z));
    g.userData = { kind: 'house', chimneyTops: tops };
    castReceive(g);
    return g;
  }

  function makeStretchedHouse(length, orientation, floors = 1) {
    return buildHouse(linearHousePlan(length), orientation, floors);
  }

  // Square (2x2) farmhouse — single rectangular footprint with a hipped
  // (pyramidal) roof. Door + window pair at the +z face, exterior stairs at
  // floors === 2 on the +x side.
  function buildSquareHouse(floors = 1) {
    const g = new THREE.Group();
    const SIDE = 2 * TILE - 0.18; // 1.82
    const halfSide = SIDE / 2;
    const wallH = H.WALL_H * floors;

    // Walls — roundedBox extrudes from y=0 upward, so no y-shift needed.
    const walls = new THREE.Mesh(roundedBox(SIDE, wallH, SIDE, 0.04), M.wallCream);
    g.add(walls);

    // Hipped roof at the top of the wall stack
    const roof = Parts.hippedRoof(SIDE, SIDE, 0.65);
    roof.position.y = wallH;
    g.add(roof);

    // Roof eave trim — a thin dark rim around the roof base for visual punch
    const eaveR = new THREE.Mesh(getBoxGeometryPrecise(SIDE + 0.04, 0.04, SIDE + 0.04), M.roofBlueD);
    eaveR.position.y = wallH + 0.02;
    g.add(eaveR);

    // Door + window pair on +z face
    const door = Parts.door('gable');
    door.position.set(0, 0, halfSide + 0.01); g.add(door);
    const winR = Parts.window('gable');
    winR.position.set( 0.45, 0.32, halfSide + 0.01); g.add(winR);
    const winL = Parts.window('gable');
    winL.position.set(-0.45, 0.32, halfSide + 0.01); g.add(winL);
    const step = Parts.step('gable');
    step.position.set(0, 0.03, halfSide + 0.08); g.add(step);

    // Side windows along -x and back -z faces (one per side, ground floor)
    const wB = Parts.window('side');
    wB.position.set(-halfSide - 0.005, 0.32, 0); g.add(wB);
    wB.rotation.y = Math.PI;
    const wRside = Parts.window('side');
    wRside.position.set( halfSide + 0.005, 0.32, -0.45); g.add(wRside);

    // Per-floor windows on all 4 faces for upper floors
    for (let f = 1; f < floors; f++) {
      const yOff = f * H.WALL_H;
      const upperWindows = [
        { x: -0.45, z:  halfSide + 0.005, rot: 0 },
        { x:  0.45, z:  halfSide + 0.005, rot: 0 },
        { x: -0.45, z: -halfSide - 0.005, rot: Math.PI },
        { x:  0.45, z: -halfSide - 0.005, rot: Math.PI },
        { x:  halfSide + 0.005, z:  0.45, rot: 0,        side: true },
        { x:  halfSide + 0.005, z: -0.45, rot: 0,        side: true },
        { x: -halfSide - 0.005, z:  0.45, rot: Math.PI,  side: true },
        { x: -halfSide - 0.005, z: -0.45, rot: Math.PI,  side: true },
      ];
      for (const p of upperWindows) {
        const w = Parts.window(p.side ? 'side' : 'gable', 'small');
        w.position.set(p.x, 0.32 + yOff, p.z);
        w.rotation.y = p.rot;
        g.add(w);
      }
    }

    // Two chimneys for visual interest, on opposite corners
    const chimneyTopsLocal = [];
    [
      { x: -0.55, z: -0.55 },
      { x:  0.55, z:  0.55 },
    ].forEach(c => {
      const chim = Parts.chimney();
      chim.position.set(c.x, wallH + 0.30, c.z); g.add(chim);
      chimneyTopsLocal.push(new THREE.Vector3(c.x, wallH + 0.60, c.z));
    });

    // External stairs on +x face when floors === 2
    if (floors === 2) {
      const stairsBottomZ = halfSide - 0.10;
      const stairsX = halfSide + 0.13;
      const stairsTopZ = stairsBottomZ - 5 * 0.10;
      const stairs = Parts.externalStairs(H.WALL_H);
      stairs.position.set(stairsX, 0, stairsBottomZ);
      g.add(stairs);
      const upd = Parts.upperDoor();
      upd.position.set(halfSide + 0.005, H.WALL_H, stairsTopZ);
      g.add(upd);
    }

    castReceive(g);
    g.userData = { kind: 'house', chimneyTops: chimneyTopsLocal };
    return g;
  }

  // Composite house — a main wing (linear stretched house) plus 1+ single-cell
  // perpendicular side wings. Each side wing is a length-1 house oriented and
  // rotated to face away from the main wing; positioned so the wing's gable
  // touches the main wing's outer wall (no visible gap). Junction geometry
  // overlaps slightly which is hidden by Z-buffer / matching wall material.
  function buildCompositeHouse(topology, floors = 1) {
    const { mainOrientation, mainCells, branches, bbox } = topology;
    const composite = new THREE.Group();
    const allChimneyTops = [];

    const bboxCX = (bbox.xMin + bbox.xMax) / 2;
    const bboxCZ = (bbox.zMin + bbox.zMax) / 2;

    // Main wing: positioned at its run's centre, in composite-local coords.
    const mainLength = mainCells.length;
    const first = mainCells[0], last = mainCells[mainCells.length - 1];
    const mainCX = mainOrientation === 'z' ? first.x          : (first.x + last.x) / 2;
    const mainCZ = mainOrientation === 'z' ? (first.z + last.z) / 2 : first.z;
    const mainOX = mainCX - bboxCX;
    const mainOZ = mainCZ - bboxCZ;

    const mainWing = buildHouse(linearHousePlan(mainLength), mainOrientation, floors);
    mainWing.position.set(mainOX, 0, mainOZ);
    composite.add(mainWing);
    for (const top of (mainWing.userData.chimneyTops || [])) {
      allChimneyTops.push(new THREE.Vector3(top.x + mainOX, top.y, top.z + mainOZ));
    }

    // Side wings (always 1 cell each, only render external stairs once on the
    // main wing — pass floors=floors but suppress stairs for wings by passing 1).
    const SHIFT = 0.18;
    const ax = new THREE.Vector3(0, 1, 0);
    for (const br of branches) {
      let wingX = br.x - bboxCX;
      let wingZ = br.z - bboxCZ;
      if      (br.axis === '+x') wingX -= SHIFT;
      else if (br.axis === '-x') wingX += SHIFT;
      else if (br.axis === '+z') wingZ -= SHIFT;
      else                       wingZ += SHIFT;

      const wingOrientation = (br.axis === '+x' || br.axis === '-x') ? 'x' : 'z';
      // Wings trim their inside-end overhang AND suppress their back gable so
      // the roof clips cleanly at the main wing's outer wall without redundant
      // / coplanar geometry. The "back" of a wing (pre-rotation -z gable, no
      // door) is always the side facing the main wing.
      const wing = buildHouse(linearHousePlan(1), wingOrientation, floors, {
        backOverhang: 0,
        suppressBackGable: true,
      });
      const flip = (br.axis === '-x' || br.axis === '-z');
      if (flip) wing.rotation.y += Math.PI;
      wing.position.set(wingX, 0, wingZ);
      composite.add(wing);

      for (const top of (wing.userData.chimneyTops || [])) {
        const r = flip ? top.clone().applyAxisAngle(ax, Math.PI) : top;
        allChimneyTops.push(new THREE.Vector3(r.x + wingX, r.y, r.z + wingZ));
      }
    }

    composite.userData = { kind: 'house', chimneyTops: allChimneyTops };
    return composite;
  }

  // Voxel stone keep with crenellations + arrow slits + flag. Replaces a
  // regular house render when isTurretHouse(x, z) is true. floors raises the
  // tower height the same way a house grows. userData.kind stays 'house' so
  // smoke loop and cluster refresh logic continues to find it; chimneyTops is
  // empty so no smoke spawns.
  function makeTurret(floors = 1) {
    return makeVoxelTurret(floors, false);
  }

  // Modern glass-sided high-rise. Auto-promoted from solo houses with 4+
  // floors, or chosen explicitly via the House fly-out menu (buildingType =
  // 'skyscraper'). Single-cell footprint regardless of clustering. floors
  // scales the height; min 4 floors for the high-rise look.
  function makeSkyscraper(floors = 4) {
    const g = new THREE.Group();
    const f = Math.max(4, floors);
    const W = 0.78, D = 0.78;
    const floorH = 0.30;
    const totalH = floorH * f;

    // Body — main steel/concrete column
    const body = new THREE.Mesh(roundedBox(W, totalH, D, 0.025), M.skyBody);
    body.position.y = totalH / 2;
    g.add(body);

    // Glass strips per floor, slightly recessed on each face — read as window bands.
    for (let i = 0; i < f; i++) {
      const yMid = (i + 0.5) * floorH;
      const glassH = 0.16;
      const sxe = new THREE.Mesh(getBoxGeometry(0.04, glassH, D - 0.18), M.skyGlass);
      sxe.position.set( W / 2 - 0.005, yMid, 0); g.add(sxe);
      const sxw = new THREE.Mesh(getBoxGeometry(0.04, glassH, D - 0.18), M.skyGlass);
      sxw.position.set(-W / 2 + 0.005, yMid, 0); g.add(sxw);
      const szs = new THREE.Mesh(getBoxGeometry(W - 0.18, glassH, 0.04), M.skyGlass);
      szs.position.set(0, yMid,  D / 2 - 0.005); g.add(szs);
      const szn = new THREE.Mesh(getBoxGeometry(W - 0.18, glassH, 0.04), M.skyGlass);
      szn.position.set(0, yMid, -D / 2 + 0.005); g.add(szn);
    }

    // Roof cap (slightly larger than body)
    const roof = new THREE.Mesh(getBoxGeometryPrecise(W + 0.04, 0.05, D + 0.04), M.skyRoof);
    roof.position.y = totalH + 0.025;
    g.add(roof);

    // Rooftop details — HVAC unit + antenna
    const hvac = new THREE.Mesh(getBoxGeometryPrecise(0.20, 0.10, 0.16), M.castleStoneD);
    hvac.position.set(-0.18, totalH + 0.10, 0.20);
    g.add(hvac);
    const ant = new THREE.Mesh(getBoxGeometry(0.03, 0.36, 0.03), M.skyFrame);
    ant.position.set(0.20, totalH + 0.23, -0.15);
    g.add(ant);

    // Ground-floor entrance — wood door for some warmth
    const door = new THREE.Mesh(getBoxGeometryPrecise(0.20, 0.32, 0.04), M.door);
    door.position.set(0, 0.16, D / 2 + 0.01);
    g.add(door);

    g.userData = { kind: 'house', chimneyTops: [] };
    castReceive(g);
    return g;
  }

  // Manor — wider brick house with a hipped slate roof, central portico,
  // symmetrical sash windows. Solo cluster-bypass (variant 'manor'). Renders
  // on a single grid cell but visually fills a touch more than a cottage.
  // Floors scales the wall stack the same way as a cottage.
  function makeManor(floors = 1) {
    const g = new THREE.Group();
    const f = Math.max(1, floors);
    const W = 1.86, D = 1.30;
    const halfW = W / 2, halfD = D / 2;
    const wallH = H.WALL_H * f;

    // Brick walls
    const walls = new THREE.Mesh(roundedBox(W, wallH, D, 0.04), M.manorBrick);
    g.add(walls);

    // White stone plinth (ground band)
    const plinth = new THREE.Mesh(getBoxGeometryPrecise(W + 0.06, 0.10, D + 0.06), M.manorTrim);
    plinth.position.y = 0.05;
    g.add(plinth);

    // Cornice trim at top of walls
    const cornice = new THREE.Mesh(getBoxGeometryPrecise(W + 0.06, 0.06, D + 0.06), M.manorTrim);
    cornice.position.y = wallH - 0.03;
    g.add(cornice);

    // Hipped slate roof
    const roof = Parts.hippedRoof(W, D, 0.55);
    roof.position.y = wallH;
    // Swap material: hippedRoof returns blue cottage roof — we want slate.
    roof.traverse(c => { if (c.isMesh) c.material = M.manorRoof; });
    g.add(roof);

    // Roof ridge accent
    const ridge = new THREE.Mesh(getBoxGeometryPrecise(W * 0.5, 0.04, 0.08), M.manorRoofD);
    ridge.position.y = wallH + 0.50;
    g.add(ridge);

    // Central portico — entry-scale columns + pediment on +z face. The
    // entrance stays one-storey so upper entrance windows sit above it.
    const porticoD = 0.28;
    const porticoW = 0.62;
    const porticoH = Math.min(wallH - 0.12, H.WALL_H - 0.10);
    // Floor slab
    const porchSlab = new THREE.Mesh(getBoxGeometryPrecise(porticoW + 0.12, 0.06, porticoD + 0.08), M.manorTrim);
    porchSlab.position.set(0, 0.06, halfD + porticoD / 2 - 0.01);
    g.add(porchSlab);
    const porchStep = new THREE.Mesh(getBoxGeometryPrecise(porticoW + 0.28, 0.05, 0.18), M.manorTrim);
    porchStep.position.set(0, 0.025, halfD + porticoD + 0.10);
    g.add(porchStep);
    const doorThreshold = new THREE.Mesh(getBoxGeometryPrecise(0.34, 0.035, 0.12), M.manorTrim);
    doorThreshold.position.set(0, 0.095, halfD + 0.07);
    g.add(doorThreshold);
    // Front columns plus wall-side pilasters make the portico read as attached.
    for (const u of [-0.5, 0.5]) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, porticoH, 8),
        M.manorTrim
      );
      col.position.set(u * (porticoW - 0.10), 0.06 + porticoH / 2, halfD + porticoD - 0.06);
      g.add(col);
      const pilaster = new THREE.Mesh(getBoxGeometryPrecise(0.09, porticoH, 0.035), M.manorTrim);
      pilaster.position.set(u * (porticoW - 0.10), 0.06 + porticoH / 2, halfD + 0.018);
      g.add(pilaster);
    }
    // Architrave
    const arch = new THREE.Mesh(getBoxGeometryPrecise(porticoW + 0.12, 0.08, porticoD + 0.10), M.manorTrim);
    arch.position.set(0, 0.06 + porticoH + 0.04, halfD + porticoD / 2 - 0.01);
    g.add(arch);
    const porticoCeiling = new THREE.Mesh(getBoxGeometryPrecise(porticoW + 0.04, 0.035, porticoD + 0.08), M.manorTrim);
    porticoCeiling.position.set(0, 0.06 + porticoH - 0.035, halfD + porticoD / 2 - 0.01);
    g.add(porticoCeiling);
    // Pediment (triangular front) — fake with a thin tilted box
    const ped = new THREE.Mesh(getBoxGeometryPrecise(porticoW + 0.06, 0.16, 0.04), M.manorTrim);
    ped.position.set(0, 0.06 + porticoH + 0.16, halfD + porticoD - 0.035);
    g.add(ped);

    // Front door (under the portico)
    const door = new THREE.Mesh(getBoxGeometryPrecise(0.26, 0.46, 0.04), M.door);
    door.position.set(0, 0.23, halfD + 0.005);
    g.add(door);
    const doorKnob = new THREE.Mesh(getSphereGeometry(0.018, 6, 6), M.knob);
    doorKnob.position.set(0.09, 0.23, halfD + 0.03);
    g.add(doorKnob);

    // Symmetrical sash windows on +z face — 2 left + 2 right of the portico,
    // repeated per floor.
    const sashXs = [-0.66, -0.40, 0.40, 0.66];
    function addFrontBackSash(x, y, z, front) {
      const s = front ? 1 : -1;
      const glass = makeWindowPane(0.14, 0.20, front ? '+z' : '-z', 0.03);
      glass.position.set(x, y, z + s * 0.03);
      g.add(glass);
      const zf = z + s * 0.034;
      const bars = [
        new THREE.Mesh(getBoxGeometry(0.18, 0.025, 0.024), M.manorTrim),
        new THREE.Mesh(getBoxGeometry(0.18, 0.025, 0.024), M.manorTrim),
        new THREE.Mesh(getBoxGeometry(0.025, 0.24, 0.024), M.manorTrim),
        new THREE.Mesh(getBoxGeometry(0.025, 0.24, 0.024), M.manorTrim),
        new THREE.Mesh(getBoxGeometry(0.15, 0.014, 0.026), M.manorTrim),
        new THREE.Mesh(getBoxGeometry(0.014, 0.19, 0.026), M.manorTrim),
      ];
      bars[0].position.set(x, y + 0.112, zf);
      bars[1].position.set(x, y - 0.112, zf);
      bars[2].position.set(x - 0.082, y, zf);
      bars[3].position.set(x + 0.082, y, zf);
      bars[4].position.set(x, y, zf + s * 0.002);
      bars[5].position.set(x, y, zf + s * 0.003);
      bars.forEach(b => g.add(b));
    }
    function addSideSash(x, y, z, sign) {
      const glass = makeWindowPane(0.12, 0.20, sign > 0 ? '+x' : '-x', 0.03);
      glass.position.set(x + sign * 0.03, y, z);
      g.add(glass);
      const xf = x + sign * 0.034;
      const bars = [
        new THREE.Mesh(getBoxGeometry(0.024, 0.025, 0.16), M.manorTrim),
        new THREE.Mesh(getBoxGeometry(0.024, 0.025, 0.16), M.manorTrim),
        new THREE.Mesh(getBoxGeometry(0.024, 0.22, 0.025), M.manorTrim),
        new THREE.Mesh(getBoxGeometry(0.024, 0.22, 0.025), M.manorTrim),
        new THREE.Mesh(getBoxGeometry(0.026, 0.014, 0.13), M.manorTrim),
        new THREE.Mesh(getBoxGeometry(0.026, 0.18, 0.014), M.manorTrim),
      ];
      bars[0].position.set(xf, y + 0.102, z);
      bars[1].position.set(xf, y - 0.102, z);
      bars[2].position.set(xf, y, z - 0.072);
      bars[3].position.set(xf, y, z + 0.072);
      bars[4].position.set(xf + sign * 0.002, y, z);
      bars[5].position.set(xf + sign * 0.003, y, z);
      bars.forEach(b => g.add(b));
    }
    for (let fi = 0; fi < f; fi++) {
      const yBase = fi === 0 ? 0.34 : 0.34 + fi * H.WALL_H;
      // Skip ground-floor centre slots (door is there) — sashXs already avoids centre.
      for (const sx of sashXs) {
        addFrontBackSash(sx, yBase, halfD, true);
      }
      if (fi > 0) {
        for (const sx of [-0.16, 0.16]) addFrontBackSash(sx, yBase, halfD, true);
      }
    }

    // Side windows on -x and +x — 2 per floor
    for (let fi = 0; fi < f; fi++) {
      const yBase = 0.34 + fi * H.WALL_H;
      for (const sz of [-0.30, 0.30]) {
        for (const sxSign of [-1, 1]) {
          addSideSash(sxSign * halfW, yBase, sz, sxSign);
        }
      }
    }

    // Back windows (same as front sash positions, no portico)
    for (let fi = 0; fi < f; fi++) {
      const yBase = 0.34 + fi * H.WALL_H;
      for (const sx of sashXs) {
        addFrontBackSash(sx, yBase, -halfD, false);
      }
    }

    // Two chimneys at the gable ends
    const chimneyTopsLocal = [];
    [{ x: -halfW + 0.10, z: 0 }, { x: halfW - 0.10, z: 0 }].forEach(c => {
      const chim = Parts.chimney();
      chim.position.set(c.x, wallH + 0.30, c.z); g.add(chim);
      chimneyTopsLocal.push(new THREE.Vector3(c.x, wallH + 0.60, c.z));
    });

    castReceive(g);
    g.userData = { kind: 'house', chimneyTops: chimneyTopsLocal };
    return g;
  }

  // Stone tower — taller fantasy tower with conical roof, balcony walkway,
  // bigger door, and dormer windows up the shaft. Solo cluster-bypass
  // (variant 'tower'). Distinct silhouette from castle turret (which is
  // adjacency-driven and crenellated). floors scales height; min 2.
  function makeStoneTower(floors = 2, palette = null) {
    const g = new THREE.Group();
    const f = Math.max(2, Math.min(MAX_FLOORS, floors || 2));
    const wallH = H.WALL_H * f + 0.34;
    const radius = 0.43;
    // Allow callers to override the tower's wall + roof palette. When the
    // tower is merged with another building (e.g. an adjacent manor) the
    // caller passes that building's palette so the tower picks up matching
    // brick / roof colours.
    const matStone  = (palette && palette.stone)  || M.towerStone;
    const matStoneD = (palette && palette.stoneD) || M.towerStoneD;
    const matRoof   = (palette && palette.roof)   || M.towerRoof;
    const matRoofD  = (palette && palette.roofD)  || M.towerRoofD;

    // Broad foundation keeps the tower grounded on one tile.
    const base = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.12, radius + 0.15, 0.16, 16), matStoneD);
    base.position.y = 0.08;
    g.add(base);

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.07, radius + 0.10, 0.10, 16), matStone);
    plinth.position.y = 0.21;
    g.add(plinth);

    // Faceted stone shaft with subtle base flare.
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 1.08, wallH, 16),
      matStone
    );
    shaft.position.y = wallH / 2 + 0.14;
    g.add(shaft);

    // Balcony walkway just below the roof.
    const balconyY = wallH + 0.10;
    const balcony = new THREE.Mesh(
      new THREE.CylinderGeometry(radius + 0.12, radius + 0.12, 0.07, 16),
      matStoneD
    );
    balcony.position.y = balconyY;
    g.add(balcony);
    const railR = radius + 0.13;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const post = new THREE.Mesh(getBoxGeometry(0.04, 0.10, 0.04), matStone);
      post.position.set(Math.cos(a) * railR, balconyY + 0.09, Math.sin(a) * railR);
      post.rotation.y = -a;
      g.add(post);
    }
    const railTop = new THREE.Mesh(
      new THREE.CylinderGeometry(railR + 0.005, railR + 0.005, 0.025, 14, 1, true),
      matStoneD
    );
    railTop.position.y = balconyY + 0.16;
    g.add(railTop);

    // Purple slate roof: dark eave ring, faceted cone, and a tiny cap.
    const roofBase = new THREE.Mesh(
      new THREE.CylinderGeometry(radius + 0.17, radius + 0.20, 0.10, 16),
      matRoofD
    );
    roofBase.position.y = wallH + 0.24;
    g.add(roofBase);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(radius + 0.16, 0.58, 16),
      matRoof
    );
    cone.position.y = wallH + 0.58;
    g.add(cone);
    const roofCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 0.08, 8),
      matRoofD
    );
    roofCap.position.y = wallH + 0.86;
    g.add(roofCap);

    const finialBall = new THREE.Mesh(getSphereGeometry(0.05, 8, 8), M.knob);
    finialBall.position.y = wallH + 0.95;
    g.add(finialBall);
    const finialSpike = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.18, 6), matStoneD);
    finialSpike.position.y = wallH + 1.09;
    g.add(finialSpike);

    // Bigger arched front door on +z.
    const door = new THREE.Mesh(getBoxGeometryPrecise(0.28, 0.46, 0.04), M.door);
    door.position.set(0, 0.39, radius + 0.02);
    g.add(door);
    const archTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.05, 10, 1, false, 0, Math.PI),
      matStoneD
    );
    archTop.rotation.z = Math.PI / 2;
    archTop.rotation.y = Math.PI / 2;
    archTop.position.set(0, 0.62, radius + 0.03);
    g.add(archTop);
    const frameL = new THREE.Mesh(getBoxGeometry(0.04, 0.46, 0.05), matStoneD);
    frameL.position.set(-0.16, 0.39, radius + 0.015); g.add(frameL);
    const frameR = frameL.clone(); frameR.position.x = 0.16; g.add(frameR);

    // Slit windows climb the shaft on alternating faces.
    for (let i = 0; i < f; i++) {
      const y = (i + 0.70) * H.WALL_H + 0.22;
      const angle = i % 2 === 0 ? 0 : Math.PI;
      const win = new THREE.Mesh(getBoxGeometry(0.10, 0.18, 0.03), M.castleSlit);
      win.position.set(0, y, Math.cos(angle) * (radius + 0.015));
      win.rotation.y = angle;
      g.add(win);
    }
    const sideWin = new THREE.Mesh(getBoxGeometryPrecise(0.03, 0.20, 0.10), M.castleSlit);
    sideWin.position.set(radius + 0.015, wallH * 0.55 + 0.12, 0);
    g.add(sideWin);

    // Flag on top.
    const pole = new THREE.Mesh(getBoxGeometry(0.025, 0.30, 0.025), matStoneD);
    pole.position.y = wallH + 1.18;
    g.add(pole);
    const flag = new THREE.Mesh(getBoxGeometryPrecise(0.18, 0.10, 0.02), M.flagRed);
    flag.position.set(0.11, wallH + 1.26, 0);
    g.add(flag);
    const beaconCup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.055, 8), matRoofD);
    beaconCup.position.y = wallH + 1.40;
    g.add(beaconCup);
    const beacon = new THREE.Mesh(getSphereGeometry(0.065, 8, 8), M.windowLit);
    beacon.position.y = wallH + 1.46;
    g.add(beacon);
    for (const side of [-1, 1]) {
      const banner = new THREE.Mesh(getBoxGeometry(0.08, 0.34, 0.026), side < 0 ? M.flagRed : M.towerRoof);
      banner.position.set(side * (radius + 0.14), balconyY - 0.16, 0.10);
      banner.rotation.z = side * 0.06;
      g.add(banner);
    }

    // No chimneys — towers get magic, not fireplaces. Empty chimneyTops keeps
    // smoke loop happy.
    g.userData = { kind: 'house', chimneyTops: [] };
    castReceive(g);
    return g;
  }

  // Castle wall segment — replaces a regular fence when isCastleFence(x, z) is
  // true. Each neighbour value is 'fence' | 'turret' | null. Segments toward a
  // turret extend slightly past the cell boundary so the wall visually merges
  // with the turret cylinder (which is recessed inside its own cell with
  // radius 0.42, leaving a gap of ~0.08 to the cell edge if we stopped flush).
  function makeCastleWallSegment(neighbors) {
    const g = new THREE.Group();
    const wallH = 0.50;
    const wallT = 0.18;
    const TURRET_OVERRUN = 0.16; // extends past cell boundary into turret cell

    // Build directional segments. For 'turret' neighbours we lengthen the
    // segment and shift its centre so the far end overshoots into the next
    // cell, biting into the turret cylinder for a clean junction.
    const segs = [];
    function makeSeg(dir, kind) {
      if (!kind) return;
      const turret = (kind === 'turret');
      const half = 0.50 + (turret ? TURRET_OVERRUN : 0);
      const offset = (0.50 - half) / 2 + (half - 0.50) / 2; // centre shifts so far end is at ±(0.50 + overrun)
      const len = half;
      // simpler: place segment between centre (0) and far end (±0.50 ± overrun)
      const farEnd = 0.50 + (turret ? TURRET_OVERRUN : 0);
      const segLen = farEnd; // from 0 to farEnd
      const segCentre = farEnd / 2;
      if (dir === 'n') segs.push({ axis: 'z', x: 0,             z: -segCentre, w: wallT,   d: segLen, ext: turret, dir });
      if (dir === 's') segs.push({ axis: 'z', x: 0,             z:  segCentre, w: wallT,   d: segLen, ext: turret, dir });
      if (dir === 'w') segs.push({ axis: 'x', x: -segCentre,    z: 0,           w: segLen, d: wallT,  ext: turret, dir });
      if (dir === 'e') segs.push({ axis: 'x', x:  segCentre,    z: 0,           w: segLen, d: wallT,  ext: turret, dir });
    }
    makeSeg('n', neighbors.n);
    makeSeg('s', neighbors.s);
    makeSeg('w', neighbors.w);
    makeSeg('e', neighbors.e);

    // No neighbours — render a stub (orphan castle fence).
    if (segs.length === 0) {
      const stub = new THREE.Mesh(
        getBoxGeometryPrecise(wallT * 1.4, wallH, wallT * 1.4),
        M.castleStone
      );
      stub.position.y = wallH / 2;
      g.add(stub);
    }

    for (const s of segs) {
      const wall = new THREE.Mesh(getBoxGeometryPrecise(s.w, wallH, s.d), M.castleStone);
      wall.position.set(s.x, wallH / 2, s.z);
      g.add(wall);

      // Merlons: 3 evenly along the in-cell portion of the segment (length 0.50)
      // even when the segment overruns into a turret. This keeps merlon spacing
      // consistent across walls regardless of what they end on, and avoids
      // merlons popping out of the turret body.
      const merlonH = 0.10, merlonW = 0.09, merlonD = 0.09;
      const count = 3;
      const inCellLen = 0.50; // always merlon over the cell's own half
      // The in-cell portion runs from centre (0) toward the far cell edge at
      // ±0.50 (sign depends on dir). Compute its centre in local coords.
      const sign = (s.dir === 's' || s.dir === 'e') ? 1 : -1;
      const inCentreOffset = sign * 0.25; // midpoint of cell's own half-segment
      for (let i = 0; i < count; i++) {
        const u = (i / (count - 1)) - 0.5;
        const merlon = new THREE.Mesh(
          getBoxGeometry(merlonW, merlonH, merlonD),
          M.castleStone
        );
        if (s.axis === 'z') {
          merlon.position.set(s.x, wallH + merlonH / 2, inCentreOffset + u * (inCellLen - merlonD));
        } else {
          merlon.position.set(inCentreOffset + u * (inCellLen - merlonW), wallH + merlonH / 2, s.z);
        }
        g.add(merlon);
      }
    }

    // Corner cap — hides segment intersection at corners and gives a slightly
    // taller post feel at junctions.
    const nbrCount = (neighbors.n?1:0)+(neighbors.s?1:0)+(neighbors.e?1:0)+(neighbors.w?1:0);
    if (nbrCount >= 2) {
      const cap = new THREE.Mesh(
        getBoxGeometryPrecise(wallT * 1.15, wallH + 0.06, wallT * 1.15),
        M.castleStone
      );
      cap.position.y = (wallH + 0.06) / 2;
      g.add(cap);
      // Cap merlon (single block on top, slightly taller than wall merlons)
      const capMerlon = new THREE.Mesh(
        getBoxGeometryPrecise(wallT * 0.9, 0.12, wallT * 0.9),
        M.castleStone
      );
      capMerlon.position.y = wallH + 0.06 + 0.06;
      g.add(capMerlon);
    }

    g.userData = { kind: 'fence' };
    castReceive(g);
    return g;
  }

  // Road-aware fence variant — picked when the tile underneath is a
  // path. Level 1: speed bump + zebra stripes. Level 2: zebra crossing
  // with pillars at the sides. Level 3+: stone arch / gate spanning
  // the road. Always oriented across the path direction.
  function makeRoadGate(side = 'n', level = 1, pathOrientation = 'x') {
    const g = new THREE.Group();
    level = Math.max(1, Math.min(MAX_FLOORS, level || 1));
    // Determine which axis the road runs along (x or z) so the gate
    // spans across it. Default to span on the perpendicular axis.
    const spanAlongX = pathOrientation === 'x';

    if (level === 1) {
      // Level 1 is now an empty placeholder — no zebra stripes, no
      // bump. The fence just doesn't render anything on a path at
      // level 1.
    } else if (level === 2) {
      // Two short pillars flanking the crossing.
      const pillarMat = M.castleStone || M.fenceSteel;
      for (const s of [-1, 1]) {
        const pillar = new THREE.Mesh(getBoxGeometryPrecise(0.12, 0.34, 0.12), pillarMat);
        pillar.position.set(spanAlongX ? s * 0.42 : 0, 0.17, spanAlongX ? 0 : s * 0.42);
        g.add(pillar);
        const cap = new THREE.Mesh(getBoxGeometryPrecise(0.16, 0.05, 0.16), M.castleStoneD || M.fenceSteel);
        cap.position.set(spanAlongX ? s * 0.42 : 0, 0.36, spanAlongX ? 0 : s * 0.42);
        g.add(cap);
      }
    } else {
      // Stone arch / gate spanning the road. Two pillars + a crossbar.
      const pillarMat = M.castleStone || M.fenceSteel;
      const beamMat   = M.castleStoneD || M.fenceSteel;
      const pillarH   = 0.55 + Math.min(level - 3, 4) * 0.06;
      for (const s of [-1, 1]) {
        const pillar = new THREE.Mesh(getBoxGeometryPrecise(0.14, pillarH, 0.14), pillarMat);
        pillar.position.set(spanAlongX ? s * 0.42 : 0, pillarH / 2, spanAlongX ? 0 : s * 0.42);
        g.add(pillar);
      }
      const beam = new THREE.Mesh(
        getBoxGeometryPrecise(spanAlongX ? 1.00 : 0.16, 0.10, spanAlongX ? 0.16 : 1.00),
        beamMat
      );
      beam.position.y = pillarH + 0.05;
      g.add(beam);
      // Banner / keystone in the middle.
      const stone = new THREE.Mesh(getBoxGeometryPrecise(0.20, 0.18, 0.20), pillarMat);
      stone.position.y = pillarH + 0.20;
      g.add(stone);
      if (level >= 5) {
        const flag = new THREE.Mesh(getBoxGeometry(0.04, 0.22, 0.04), M.woodTrim || M.fenceSteel);
        flag.position.y = pillarH + 0.38;
        g.add(flag);
      }
    }

    g.userData = { kind: 'fence', roadGate: true, level };
    castReceive(g);
    return g;
  }

  function makeFence(side = 'n', level = 1, style = 'wood') {
    const g = new THREE.Group();
    level = Math.max(1, Math.min(MAX_FLOORS, level || 1));
    const normalized = FENCE_SIDES.has(side) ? side : 'n';
    const fenceStyle = typeof normalizeFenceStyle === 'function' ? normalizeFenceStyle(style) : 'wood';
    const alongX = normalized === 'n' || normalized === 's' || normalized === 'center-x';
    const offsetX = normalized === 'w' ? -0.43 : normalized === 'e' ? 0.43 : 0;
    const offsetZ = normalized === 'n' ? -0.43 : normalized === 's' ? 0.43 : 0;

    function endpointOffsets() {
      return alongX
        ? [[-0.50, offsetZ], [0.50, offsetZ]]
        : [[offsetX, -0.50], [offsetX, 0.50]];
    }

    if (fenceStyle === 'gate' && level < 4) {
      const fenceScale = level === 1 ? 1 : (level === 2 ? 1.10 : 1.20);
      const postH = 0.56 * fenceScale;
      const gateH = postH * 0.70;
      const postMat = M.fenceGarden || M.fence;
      const railMat = M.fenceGardenD || M.fence;
      const panelMat = M.fence || postMat;
      const latchMat = M.knob || M.fenceWire || railMat;
      const markerMat = M.flagRed || latchMat;
      const leafLen = 0.42;
      const leafHalf = leafLen / 2;
      const leafAngle = 0.62;
      const hingeInset = 0.43;
      function gateBox(w, h, d, x, y, z, mat, rot = {}) {
        const mesh = new THREE.Mesh(getBoxGeometry(w, h, d), mat);
        mesh.position.set(x, y, z);
        if (rot.ry) mesh.rotation.y = rot.ry;
        g.add(mesh);
        return mesh;
      }
      for (const [px, pz] of endpointOffsets()) {
        gateBox(0.14, postH, 0.14, px, postH / 2, pz, postMat);
        gateBox(0.18, 0.055, 0.18, px, postH + 0.03, pz, railMat);
      }
      if (alongX) {
        const inward = normalized === 'n' ? 1 : -1;
        const leaves = [
          { hingeX: -hingeInset, dir: 1, ry: -inward * leafAngle },
          { hingeX: hingeInset, dir: -1, ry: inward * leafAngle },
        ];
        leaves.forEach(leaf => {
          const leafX = leaf.hingeX + leaf.dir * Math.cos(leaf.ry) * leafHalf;
          const leafZ = offsetZ + leaf.dir * -Math.sin(leaf.ry) * leafHalf;
          for (const y of [0.13 * fenceScale, gateH * 0.82]) gateBox(leafLen, 0.05, 0.05, leafX, y, leafZ, railMat, { ry: leaf.ry });
          for (const dx of [-0.13, 0.13]) {
            gateBox(0.05, gateH * 0.66, 0.05, leafX + dx * Math.cos(leaf.ry), gateH * 0.43, leafZ - dx * Math.sin(leaf.ry), panelMat, { ry: leaf.ry });
          }
        });
        gateBox(0.22, 0.11, 0.045, 0, postH + 0.13, offsetZ, markerMat);
        gateBox(0.075, 0.075, 0.075, 0.12, gateH * 0.55, offsetZ + inward * 0.03, latchMat);
      } else {
        const inward = normalized === 'w' ? 1 : -1;
        const leaves = [
          { hingeZ: -hingeInset, dir: 1, ry: inward * leafAngle },
          { hingeZ: hingeInset, dir: -1, ry: -inward * leafAngle },
        ];
        leaves.forEach(leaf => {
          const leafX = offsetX + leaf.dir * Math.sin(leaf.ry) * leafHalf;
          const leafZ = leaf.hingeZ + leaf.dir * Math.cos(leaf.ry) * leafHalf;
          for (const y of [0.13 * fenceScale, gateH * 0.82]) gateBox(0.05, 0.05, leafLen, leafX, y, leafZ, railMat, { ry: leaf.ry });
          for (const dz of [-0.13, 0.13]) {
            gateBox(0.05, gateH * 0.66, 0.05, leafX + dz * Math.sin(leaf.ry), gateH * 0.43, leafZ + dz * Math.cos(leaf.ry), panelMat, { ry: leaf.ry });
          }
        });
        gateBox(0.045, 0.11, 0.22, offsetX, postH + 0.13, 0, markerMat);
        gateBox(0.075, 0.075, 0.075, offsetX + inward * 0.03, gateH * 0.55, 0.12, latchMat);
      }
    } else if (fenceStyle === 'garden' && level < 4) {
      const fenceScale = level === 1 ? 1 : (level === 2 ? 1.18 : 1.32);
      const postH = 0.38 * fenceScale;
      const postMat = M.fenceGarden || M.fence;
      const railMat = M.fenceGardenD || M.fence;
      const vineMat = M.fenceVine || M.cropStem || postMat;
      const fruitMat = M.fenceFruit || M.pumpkin || railMat;
      const postGeo = getBoxGeometry(0.10, postH, 0.10);
      for (const [px, pz] of endpointOffsets()) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(px, postH / 2, pz);
        g.add(post);
        const cap = new THREE.Mesh(getBoxGeometry(0.14, 0.045, 0.14), railMat);
        cap.position.set(px, postH + 0.025, pz);
        g.add(cap);
      }
      for (const y of [0.12 * fenceScale, 0.28 * fenceScale, ...(level >= 3 ? [0.42 * fenceScale] : [])]) {
        const rail = new THREE.Mesh(getBoxGeometry(alongX ? 1.08 : 0.05, 0.05, alongX ? 0.05 : 1.08), railMat);
        rail.position.set(offsetX, y, offsetZ);
        g.add(rail);
      }
      const vine = new THREE.Mesh(getBoxGeometry(alongX ? 0.82 : 0.035, 0.035, alongX ? 0.035 : 0.82), vineMat);
      vine.position.set(offsetX, postH * 0.82, offsetZ);
      g.add(vine);
      for (const a of [-0.30, 0.18]) {
        const fruit = new THREE.Mesh(getBoxGeometry(0.055, 0.055, 0.055), fruitMat);
        fruit.position.set(alongX ? a : offsetX, postH * 0.90, alongX ? offsetZ : a);
        fruit.castShadow = false;
        fruit.receiveShadow = false;
        g.add(fruit);
      }
    } else if (level >= 4) {
      const stone = level >= 5 ? M.fenceSteel : M.castleStone;
      const capMat = level >= 5 ? M.skyFrame : M.castleStoneD;
      const wallH = level >= 5 ? 0.58 : 0.46;
      const wallT = level >= 5 ? 0.14 : 0.18;
      const wall = new THREE.Mesh(
        getBoxGeometryPrecise(alongX ? 1.08 : wallT, wallH, alongX ? wallT : 1.08),
        stone
      );
      wall.position.set(offsetX, wallH / 2, offsetZ);
      g.add(wall);
      const cap = new THREE.Mesh(
        getBoxGeometryPrecise(alongX ? 1.12 : wallT + 0.04, 0.055, alongX ? wallT + 0.04 : 1.12),
        capMat
      );
      cap.position.set(offsetX, wallH + 0.027, offsetZ);
      g.add(cap);
    } else if (level === 3) {
      const postGeo = getBoxGeometry(0.07, 0.52, 0.07);
      for (const [px, pz] of endpointOffsets()) {
        const post = new THREE.Mesh(postGeo, M.fenceSteel);
        post.position.set(px, 0.26, pz);
        g.add(post);
      }
      for (const y of [0.15, 0.29, 0.43]) {
        const wire = new THREE.Mesh(
          getBoxGeometry(alongX ? 1.08 : 0.025, 0.025, alongX ? 0.025 : 1.08),
          M.fenceWire
        );
        wire.position.set(offsetX, y, offsetZ);
        g.add(wire);
      }
    } else {
      const fenceScale = level === 2 ? 1.28 : 1;
      const postH = 0.32 * fenceScale;
      const postGeo = getBoxGeometry(0.09, postH, 0.09);
      for (const [px, pz] of endpointOffsets()) {
        const post = new THREE.Mesh(postGeo, M.fence);
        post.position.set(px, 0.16 * fenceScale, pz);
        g.add(post);
      }
      const railH = 0.06;
      const railGeo = getBoxGeometry(alongX ? 1.08 : railH, railH, alongX ? railH : 1.08);
      for (const y of [0.08 * fenceScale, 0.24 * fenceScale]) {
        const rail = new THREE.Mesh(railGeo, M.fence);
        rail.position.set(offsetX, y, offsetZ);
        g.add(rail);
      }
    }

    g.userData = { kind: 'fence', level, side: normalized, fenceStyle };
    castReceive(g);
    return g;
  }

  function makeCrop() {
    // Leafy "cabbage" crop — the original. Now static (no bob animation).
    const g = new THREE.Group();
    const positions = [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]];
    positions.forEach(([x, z], i) => {
      const stem = new THREE.Mesh(getBoxGeometry(0.08, 0.12, 0.08), M.cropStem);
      stem.position.set(x, 0.06, z);
      g.add(stem);
      const leaf = new THREE.Mesh(roundedBox(0.18, 0.16, 0.18, 0.04), M.cropLeaf);
      leaf.position.set(x, 0.16, z);
      leaf.rotation.y = i * 0.4;
      g.add(leaf);
    });
    g.userData = { kind: 'crop' };
    castReceive(g);
    return g;
  }

  // Tall corn stalks with a yellow cob and tasseled top. 4 per cell.
  function makeCorn() {
    const g = new THREE.Group();
    const positions = [[-0.22, -0.20], [0.22, -0.22], [-0.20, 0.22], [0.22, 0.20]];
    positions.forEach(([x, z], i) => {
      const stalk = new THREE.Mesh(getBoxGeometry(0.05, 0.55, 0.05), M.cornStalk);
      stalk.position.set(x, 0.275, z);
      stalk.rotation.y = i * 0.55;
      g.add(stalk);
      // cob — slightly offset from the stalk
      const cob = new THREE.Mesh(roundedBox(0.07, 0.14, 0.07, 0.02), M.cornCob);
      const ang = i * 1.3;
      cob.position.set(x + Math.cos(ang) * 0.05, 0.32, z + Math.sin(ang) * 0.05);
      g.add(cob);
      // leafy tassel at top
      const tip = new THREE.Mesh(getBoxGeometry(0.06, 0.14, 0.06), M.cornLeaf);
      tip.position.set(x, 0.61, z);
      tip.rotation.y = i * 0.55;
      g.add(tip);
    });
    g.userData = { kind: 'corn' };
    castReceive(g);
    return g;
  }

  // Dense wheat field — 9 thin stalks with golden heads, slight jitter.
  function makeWheat() {
    const g = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const gx = (i % 3) - 1;
      const gz = Math.floor(i / 3) - 1;
      const x = gx * 0.20 + (Math.random() - 0.5) * 0.04;
      const z = gz * 0.20 + (Math.random() - 0.5) * 0.04;
      const h = 0.36 + Math.random() * 0.06;
      const stalk = new THREE.Mesh(getBoxGeometry(0.03, h, 0.03), M.wheatStalk);
      stalk.position.set(x, h / 2, z);
      g.add(stalk);
      const head = new THREE.Mesh(roundedBox(0.07, 0.11, 0.07, 0.02), M.wheatHead);
      head.position.set(x, h + 0.04, z);
      g.add(head);
    }
    g.userData = { kind: 'wheat' };
    castReceive(g);
    return g;
  }

  // 3 chunky pumpkins on the dirt — flattened spheres with a brown stem.
  function makePumpkin() {
    const g = new THREE.Group();
    const positions = [
      { x: -0.18, z:  0.10, s: 1.00, rot: 0.3 },
      { x:  0.20, z: -0.06, s: 1.12, rot: -0.5 },
      { x:  0.04, z:  0.24, s: 0.85, rot: 1.1 },
    ];
    positions.forEach(p => {
      const r = 0.16 * p.s;
      const pump = new THREE.Mesh(getSphereGeometry(r, 10, 8), M.pumpkin);
      pump.scale.y = 0.72;
      pump.position.set(p.x, r * 0.72, p.z);
      pump.rotation.y = p.rot;
      g.add(pump);
      // dark band suggestion — thin slice of darker pumpkin across the equator
      const band = new THREE.Mesh(getBoxGeometryPrecise(r * 2.05, 0.025, 0.04), M.pumpkinDk);
      band.position.set(p.x, r * 0.72, p.z);
      band.rotation.y = p.rot;
      g.add(band);
      const stem = new THREE.Mesh(getBoxGeometry(0.04, 0.08, 0.04), M.pumpkinStem);
      stem.position.set(p.x, r * 1.2, p.z);
      g.add(stem);
    });
    g.userData = { kind: 'pumpkin' };
    castReceive(g);
    return g;
  }

  // Cinderella carriage — fairytale variant a pumpkin grows into once
  // its tile hits MAX_FLOORS. The carriage replaces the regular three
  // pumpkin lumps: rounded coach body in pumpkin orange, ribbed bands
  // from the dark pumpkin material, four little wheels, a door window,
  // and a gold ornament on the roof.
  function makePumpkinCarriage() {
    const g = new THREE.Group();

    // Main coach body — flattened sphere standing on the dirt.
    const bodyR = 0.30;
    const body = new THREE.Mesh(getSphereGeometry(bodyR, 14, 10), M.pumpkin);
    body.scale.set(1.1, 0.95, 0.95);
    body.position.y = bodyR * 0.95;
    g.add(body);

    // Six ribbed bands wrapping the coach so it still reads as a pumpkin.
    const bandCount = 6;
    for (let i = 0; i < bandCount; i++) {
      const ang = (i / bandCount) * Math.PI;
      const band = new THREE.Mesh(getBoxGeometryPrecise(0.02, bodyR * 1.8, bodyR * 2.0), M.pumpkinDk);
      band.position.y = bodyR * 0.95;
      band.rotation.y = ang;
      g.add(band);
    }

    // Door panel + small window on the front face.
    const door = new THREE.Mesh(getBoxGeometryPrecise(0.18, 0.20, 0.04), M.pumpkinDk);
    door.position.set(0, bodyR * 0.95, bodyR * 0.95 + 0.01);
    g.add(door);
    const windowPane = new THREE.Mesh(getBoxGeometryPrecise(0.10, 0.08, 0.02), M.windowB);
    windowPane.position.set(0, bodyR * 1.15, bodyR * 0.95 + 0.03);
    g.add(windowPane);
    const doorKnob = new THREE.Mesh(getBoxGeometry(0.025, 0.025, 0.02), M.knob);
    doorKnob.position.set(0.06, bodyR * 0.92, bodyR * 0.95 + 0.04);
    g.add(doorKnob);

    // Curly green stem on top, then a gold finial — the storybook touch.
    const stem = new THREE.Mesh(getBoxGeometry(0.05, 0.10, 0.05), M.pumpkinStem);
    stem.position.y = bodyR * 1.85;
    g.add(stem);
    const finial = new THREE.Mesh(roundedBox(0.07, 0.07, 0.07, 0.02), M.knob);
    finial.position.y = bodyR * 2.0 + 0.04;
    g.add(finial);
    const finialTop = new THREE.Mesh(getBoxGeometry(0.025, 0.06, 0.025), M.knob);
    finialTop.position.y = bodyR * 2.0 + 0.12;
    g.add(finialTop);

    // Four wheels (axle along x, so cylinder lies on its side via z-rotation).
    const wheelGeo = new THREE.CylinderGeometry(0.10, 0.10, 0.045, 14);
    const wheelOffsets = [
      [ 0.22, -0.20], [ 0.22,  0.20],
      [-0.22, -0.20], [-0.22,  0.20],
    ];
    wheelOffsets.forEach(([x, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, M.woodTrim);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.10, z);
      g.add(wheel);
      // Gold hub centred on the wheel face.
      const hub = new THREE.Mesh(getBoxGeometry(0.055, 0.055, 0.05), M.knob);
      hub.position.set(x, 0.10, z);
      g.add(hub);
      // Spokes — three short bars across the face for a coach feel.
      for (let s = 0; s < 3; s++) {
        const spoke = new THREE.Mesh(getBoxGeometryPrecise(0.16, 0.018, 0.012), M.knob);
        spoke.position.set(x, 0.10, z);
        spoke.rotation.x = (s / 3) * Math.PI;
        g.add(spoke);
      }
    });

    // Tiny gold trim band where the wheels meet the body.
    const trim = new THREE.Mesh(getBoxGeometryPrecise(0.50, 0.025, 0.42), M.knob);
    trim.position.y = 0.20;
    g.add(trim);

    g.userData = { kind: 'pumpkin', carriage: true, swayPhase: Math.random() * Math.PI * 2 };
    castReceive(g);
    return g;
  }

  // Carrot rows — orange tips poking out of the dirt with green leafy tops.
  function makeCarrot() {
    const g = new THREE.Group();
    const positions = [
      [-0.22, -0.22], [0.0, -0.22], [0.22, -0.22],
      [-0.22,  0.0],  [0.0,  0.0],  [0.22,  0.0],
      [-0.22,  0.22], [0.0,  0.22], [0.22,  0.22],
    ];
    positions.forEach(([x, z]) => {
      // orange tip just above ground
      const tip = new THREE.Mesh(getBoxGeometry(0.06, 0.05, 0.06), M.carrotBody);
      tip.position.set(x, 0.025, z);
      g.add(tip);
      // 3 green leafy blades fanning out
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(getBoxGeometry(0.035, 0.13, 0.035), M.cropStem);
        blade.position.set(x + (i - 1) * 0.025, 0.10, z);
        blade.rotation.z = (i - 1) * 0.28;
        g.add(blade);
      }
    });
    g.userData = { kind: 'carrot' };
    castReceive(g);
    return g;
  }

  // Sunflowers — 3 tall stalks with yellow discs and brown centers.
  function makeSunflower() {
    const g = new THREE.Group();
    const positions = [
      { x: -0.20, z: -0.10, h: 0.62 },
      { x:  0.18, z:  0.06, h: 0.70 },
      { x: -0.04, z:  0.22, h: 0.55 },
    ];
    positions.forEach(p => {
      const stalk = new THREE.Mesh(getBoxGeometry(0.04, p.h, 0.04), M.sunflowerStalk);
      stalk.position.set(p.x, p.h / 2, p.z);
      g.add(stalk);
      // a leaf on the stalk
      const leaf = new THREE.Mesh(getBoxGeometry(0.12, 0.06, 0.04), M.sunflowerStalk);
      leaf.position.set(p.x + 0.07, p.h * 0.55, p.z);
      leaf.rotation.z = -0.3;
      g.add(leaf);
      // yellow petal disc (cylinder, thin), tilted slightly to face viewer
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 12), M.sunflowerPetal);
      disc.position.set(p.x, p.h + 0.02, p.z);
      disc.rotation.x = -0.25;
      g.add(disc);
      // brown center
      const center = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 10), M.sunflowerCenter);
      center.position.set(p.x, p.h + 0.04, p.z + 0.005);
      center.rotation.x = -0.25;
      g.add(center);
    });
    g.userData = { kind: 'sunflower' };
    castReceive(g);
    return g;
  }

  function makeTuft() {
    const g = new THREE.Group();
    const positions = [[0, 0], [0.08, 0.06], [-0.07, 0.04], [0.03, -0.08], [-0.04, -0.05]];
    positions.forEach(([x, z]) => {
      const blade = new THREE.Mesh(getBoxGeometry(0.05, 0.1 + Math.random() * 0.04, 0.05), M.leaves);
      blade.position.set(x, blade.geometry.parameters.height / 2, z);
      g.add(blade);
    });
    g.userData = { kind: 'tuft' };
    castReceive(g);
    return g;
  }

  // Item 6 — new kinds. Plant variants ride on existing tuft/leaves
  // materials but pick different palettes; animals are tiny box-stack
  // primitives so they render through the standard kind dispatch.
  const M_PLANT = {
    petalRed:    new THREE.MeshLambertMaterial({ color: 0xd24a4f }),
    petalYellow: new THREE.MeshLambertMaterial({ color: 0xf2c849 }),
    petalPurple: new THREE.MeshLambertMaterial({ color: 0x9d6ad1 }),
    petalWhite:  new THREE.MeshLambertMaterial({ color: 0xf3eee0 }),
    bushBerry:   new THREE.MeshLambertMaterial({ color: 0xc94a4f }),
  };
  const M_ANIMAL = {
    cowWhite:  new THREE.MeshLambertMaterial({ color: 0xf2eee0 }),
    cowSpot:   new THREE.MeshLambertMaterial({ color: 0x2a2722 }),
    cowMuzzle: new THREE.MeshLambertMaterial({ color: 0xeec7b0 }),
    sheepWool: new THREE.MeshLambertMaterial({ color: 0xe8e2d2 }),
    sheepFace: new THREE.MeshLambertMaterial({ color: 0x2a2722 }),
    hoof:      new THREE.MeshLambertMaterial({ color: 0x2a2722 }),
  };

  const M_VEHICLE = {
    shell:       new THREE.MeshLambertMaterial({ color: 0xf1eee7 }),
    dark:        new THREE.MeshLambertMaterial({ color: 0x1c1e21 }),
    tire:        new THREE.MeshLambertMaterial({ color: 0x141618 }),
    hub:         new THREE.MeshLambertMaterial({ color: 0xe6e2d8 }),
    light:       new THREE.MeshLambertMaterial({ color: 0xfff2c4, emissive: 0xffd96a, emissiveIntensity: 0.35 }),
    pole:        new THREE.MeshLambertMaterial({ color: 0x2a2c30 }),
    flag:        new THREE.MeshLambertMaterial({ color: 0xff7a1a, side: THREE.DoubleSide }),
    beacon:      new THREE.MeshBasicMaterial({ color: 0x20f7c7, transparent: true, opacity: 0.82, depthWrite: false }),
  };

  function makeFlower() {
    const g = new THREE.Group();
    // Small grass cluster at base.
    const base = new THREE.Mesh(getBoxGeometryPrecise(0.18, 0.05, 0.18), M.leaves);
    base.position.y = 0.025;
    g.add(base);
    const palettes = [M_PLANT.petalRed, M_PLANT.petalYellow, M_PLANT.petalPurple, M_PLANT.petalWhite];
    const positions = [[-0.05, -0.04], [0.05, 0.04], [0.0, 0.0]];
    positions.forEach(([x, z], i) => {
      const stem = new THREE.Mesh(getBoxGeometry(0.03, 0.14, 0.03), M.leavesDk);
      stem.position.set(x, 0.10, z);
      g.add(stem);
      const petals = new THREE.Mesh(getBoxGeometryPrecise(0.10, 0.05, 0.10), palettes[i % palettes.length]);
      petals.position.set(x, 0.20, z);
      g.add(petals);
      const heart = new THREE.Mesh(getBoxGeometry(0.04, 0.03, 0.04), M_PLANT.petalYellow);
      heart.position.set(x, 0.23, z);
      g.add(heart);
    });
    g.userData = { kind: 'flower' };
    castReceive(g);
    return g;
  }
  function makeBush() {
    const g = new THREE.Group();
    const positions = [
      [0,    0,   0.30, 0.24],
      [0.18, 0.06,0.22, 0.18],
      [-0.16,0.04,0.20, 0.16],
      [0.05,-0.16,0.18, 0.16],
    ];
    positions.forEach(([x, z, w, h], i) => {
      const lobe = new THREE.Mesh(getBoxGeometryPrecise(w, h, w), i % 2 ? M.leavesDk : M.leaves);
      lobe.position.set(x, h / 2, z);
      g.add(lobe);
    });
    // Optional berries on top.
    const b1 = new THREE.Mesh(getBoxGeometry(0.05, 0.05, 0.05), M_PLANT.bushBerry);
    b1.position.set(0.05, 0.26, 0.04);
    g.add(b1);
    const b2 = new THREE.Mesh(getBoxGeometry(0.045, 0.045, 0.045), M_PLANT.bushBerry);
    b2.position.set(-0.06, 0.22, -0.05);
    g.add(b2);
    g.userData = { kind: 'bush' };
    castReceive(g);
    return g;
  }
  function makeCow() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(getBoxGeometryPrecise(0.42, 0.26, 0.24), M_ANIMAL.cowWhite);
    body.position.set(0, 0.22, 0);
    g.add(body);
    // Spots
    const spot1 = new THREE.Mesh(getBoxGeometryPrecise(0.18, 0.05, 0.12), M_ANIMAL.cowSpot);
    spot1.position.set(0.06, 0.36, 0.06);
    g.add(spot1);
    const spot2 = new THREE.Mesh(getBoxGeometryPrecise(0.12, 0.05, 0.10), M_ANIMAL.cowSpot);
    spot2.position.set(-0.08, 0.36, -0.08);
    g.add(spot2);
    // Head
    const head = new THREE.Mesh(getBoxGeometryPrecise(0.18, 0.16, 0.16), M_ANIMAL.cowWhite);
    head.position.set(0.27, 0.30, 0);
    g.add(head);
    const muzzle = new THREE.Mesh(getBoxGeometry(0.08, 0.08, 0.10), M_ANIMAL.cowMuzzle);
    muzzle.position.set(0.36, 0.26, 0);
    g.add(muzzle);
    // Legs (4 short)
    [[0.13, -0.08], [0.13, 0.08], [-0.13, -0.08], [-0.13, 0.08]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(getBoxGeometry(0.07, 0.16, 0.07), M_ANIMAL.hoof);
      leg.position.set(x, 0.08, z);
      g.add(leg);
    });
    g.userData = { kind: 'cow' };
    castReceive(g);
    return g;
  }
  function makeSheep() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(getBoxGeometryPrecise(0.34, 0.24, 0.22), M_ANIMAL.sheepWool);
    body.position.set(0, 0.22, 0);
    g.add(body);
    // Wool puffs along the back
    [[-0.10, 0.05], [0.00, 0.00], [0.10, 0.05]].forEach(([x, z]) => {
      const puff = new THREE.Mesh(getBoxGeometryPrecise(0.10, 0.06, 0.10), M_ANIMAL.sheepWool);
      puff.position.set(x, 0.36, z);
      g.add(puff);
    });
    // Face
    const head = new THREE.Mesh(getBoxGeometryPrecise(0.14, 0.14, 0.12), M_ANIMAL.sheepFace);
    head.position.set(0.22, 0.28, 0);
    g.add(head);
    // Legs
    [[0.10, -0.08], [0.10, 0.08], [-0.10, -0.08], [-0.10, 0.08]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(getBoxGeometry(0.06, 0.14, 0.06), M_ANIMAL.hoof);
      leg.position.set(x, 0.07, z);
      g.add(leg);
    });
    g.userData = { kind: 'sheep' };
    castReceive(g);
    return g;
  }
