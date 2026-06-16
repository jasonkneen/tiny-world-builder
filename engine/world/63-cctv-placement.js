  // -------- CCTV placement: lobby side-cams, pumpkincam, treecams --------
  // Wires the surveillance system (62-cctv-truman.js) into the worlds room. When a
  // player enters a tinyverse room we mount physical monitors flanking BOTH sides of
  // the lobby presentation screen, add a "PUMPKINCAM" over the largest pumpkin patch
  // and one or two "TREECAM"s over trees, point the room's avatar feed at the cameras
  // so they track whoever's moving, and enable capture. On leave we tear it all down.
  //
  // All cameras + monitors live under avatarParent() (the same local frame the
  // avatars and lobby screen use), so subject positions need no conversion and the
  // rig inherits the tinyverse scale/offset automatically.
  //
  // 4-space body indent keeps locals out of the duplicate-declaration guard.
  (function cctvPlacementBoot() {
    'use strict';
    if (typeof window === 'undefined' || typeof THREE === 'undefined') return;

    const WS = (window.__tinyworldWorlds = window.__tinyworldWorlds || {});
    const mounted = [];            // { id, monitor } we added to the parent
    let active = false;
    let parentRef = null;

    // Monitor-wall layout (beside the lobby screen). The screen is 6 x 3.375 with its
    // bottom at 1.0 (see 58-lobby-presentation), so its centre sits ~2.69 above the
    // lobby group origin. Six monitors hang in two columns of three flanking it.
    const SCREEN_CY = 2.69;   // screen vertical centre above ground (matches 58 cy)
    const ROW_STEP = 1.12;    // vertical pitch between stacked monitors
    const COL_X = 3.85;       // |x| of each monitor column (just outside the screen edge)
    const MON_W = 1.25;       // monitor width (height derives 4:3)

    function CCTV() { return window.__tinyworldCCTV || null; }

    function gridSize() {
      return (typeof GRID !== 'undefined' && GRID) ? GRID : 8;
    }
    // Cell (x,z) -> world position in the avatar/lobby local frame (matches tilePos).
    function cellWorld(x, z) {
      const g = gridSize();
      return new THREE.Vector3(x - g / 2 + 0.5, 0, z - g / 2 + 0.5);
    }
    // Ground height at a cell, so cams sit a believable height above their subject.
    function groundY(x, z) {
      if (typeof voxelGroundY === 'function') { try { return voxelGroundY(x, z) || 0; } catch (_) {} }
      if (typeof cellMeshes !== 'undefined' && cellMeshes) {
        const cm = cellMeshes[x + ',' + z];
        if (cm && cm.tile) { try { return new THREE.Box3().setFromObject(cm.tile).max.y || 0; } catch (_) {} }
      }
      return 0;
    }

    // Scan world[][] for cells of a given kind; returns [{x,z,floors}] sorted by
    // floors desc (so "largest" pumpkin / tallest tree wins).
    function findKind(kind) {
      const out = [];
      const g = gridSize();
      if (typeof world === 'undefined' || !world) return out;
      for (let x = 0; x < g; x++) {
        if (!world[x]) continue;
        for (let z = 0; z < g; z++) {
          const c = world[x][z];
          if (c && c.kind === kind) out.push({ x, z, floors: c.floors || 1 });
        }
      }
      out.sort((a, b) => b.floors - a.floors);
      return out;
    }

    // North edge centre (where the lobby presentation screen stands) in local frame.
    function lobbyScreenAnchor() {
      const g = gridSize();
      return new THREE.Vector3(0, 0, -(g / 2) + 1.0);   // mirrors 58-lobby-presentation screenZ()
    }

    // Build a feature-cam spec { base, camPos, look, opts } from a world cell — a low
    // camera tucked near the subject and aimed up/out for hidden Truman-style framing.
    function cellCamSpec(base, cell, offX) {
      const wp = cellWorld(cell.x, cell.z);
      const gy = groundY(cell.x, cell.z);
      return {
        base,
        camPos: new THREE.Vector3(wp.x + offX, gy + 0.35, wp.z + 1.6),
        look: new THREE.Vector3(wp.x, gy + 2.6, wp.z),
        opts: { fov: 58, sweep: { yaw: 0.55, pitch: 0.14, speed: 0.34 } },
      };
    }

    // Mount one camera + its physical monitor. camPos/look in local frame.
    function mount(id, name, camPos, look, monPos, monLookAt, opts) {
      const cc = CCTV(); if (!cc) return;
      opts = opts || {};
      const feed = cc.addCamera({
        id, name,
        pos: [camPos.x, camPos.y, camPos.z],
        look: [look.x, look.y, look.z],
        fov: opts.fov || 50,
        sweep: opts.sweep || { yaw: 0.5, pitch: 0.08, speed: 0.3 },
      });
      const monitor = cc.buildMonitor(feed, { width: opts.width || 1.1 });
      if (!monitor) return;
      monitor.position.copy(monPos);
      if (monLookAt) monitor.lookAt(monLookAt);
      if (opts.rotY != null) monitor.rotation.y = opts.rotY;
      if (parentRef) parentRef.add(monitor);
      mounted.push({ id, monitor });
    }

    // Build low-impact cable conduit linking the monitors in a column to each other
    // and trunking into the main lobby screen — a bit of back-of-house realism.
    // Cheap: a handful of thin dark boxes, non-shadowing + non-pickable, parked just
    // behind the monitor backs (toward the screen at anchor.z) so they read as raceways
    // without adding draw/shadow cost. `col` = [{x,y}] monitor anchor points (same x),
    // `anchorZ` = screen plane z. All in the avatar/lobby local frame.
    function buildConnectors(columns, anchorZ) {
      if (!parentRef) return;
      const mat = new THREE.MeshStandardMaterial({ color: 0x0c0f15, roughness: 0.9, metalness: 0.15 });
      const grp = new THREE.Group();
      grp.name = 'cctv-cable-conduit';
      const strip = (w, h, d, x, y, z) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        m.castShadow = false; m.receiveShadow = false;
        m.userData.noShadow = true; m.userData.noReceiveShadow = true;
        m.userData.lightVisual = true;          // skip fade-material replacement (render-perf)
        m.raycast = function () {};              // non-pickable
        grp.add(m);
        return m;
      };
      const zBack = anchorZ + 0.04;             // just behind the monitor backs, toward the screen
      for (const col of columns) {
        if (!col.pts.length) continue;
        const xs = col.x;
        const ys = col.pts.map((p) => p.y).sort((a, b) => a - b);
        const yLo = ys[0], yHi = ys[ys.length - 1];
        // vertical riser down the back of the column linking stacked monitors
        if (yHi > yLo) strip(0.06, (yHi - yLo) + 0.3, 0.05, xs, (yLo + yHi) / 2, zBack);
        // short drop nipples at each monitor (where the cable "enters" the unit)
        for (const p of col.pts) strip(0.10, 0.06, 0.05, xs, p.y, zBack + 0.02);
        // horizontal trunk from the column's lowest monitor inward to the screen edge
        const innerX = (xs < 0) ? -0.45 : 0.45;
        const runW = Math.abs(xs - innerX);
        strip(runW, 0.055, 0.05, (xs + innerX) / 2, yLo, zBack);
        // small junction box where it meets the screen frame
        strip(0.18, 0.18, 0.10, innerX, yLo, anchorZ - 0.02);
      }
      parentRef.add(grp);
      mounted.push({ id: '__conduit', monitor: grp });   // tracked so teardown removes it
    }

    function setup() {
      const cc = CCTV(); if (!cc) return;
      teardown();   // idempotent
      parentRef = (typeof WS.avatarParent === 'function' && WS.avatarParent()) || (typeof scene !== 'undefined' ? scene : null);
      if (!parentRef) return;

      const g = gridSize();
      const anchor = lobbyScreenAnchor();                 // screen centre, north edge
      const screenY = groundY(Math.round(g / 2), 1);
      const crowd = new THREE.Vector3(0, screenY + 0.7, anchor.z + 3.0);  // where people gather

      // --- two crowd cams on poles either side of the screen (still aim at the
      //     audience to produce a useful feed; only the MONITORS are flat) ---
      const lobbyL = {
        id: 'lobby-l', name: 'LOBBY CAM L',
        camPos: new THREE.Vector3(-3.6, screenY + 2.6, anchor.z + 0.2), look: crowd,
        opts: { fov: 54, sweep: { yaw: 0.45, pitch: 0.07, speed: 0.28 } },
      };
      const lobbyR = {
        id: 'lobby-r', name: 'LOBBY CAM R',
        camPos: new THREE.Vector3(3.6, screenY + 2.6, anchor.z + 0.2), look: crowd,
        opts: { fov: 54, sweep: { yaw: 0.45, pitch: 0.07, speed: 0.28 } },
      };

      // --- 4 world-feature cams (pumpkins, trees, houses), padded with AREA CAMs
      //     so we always have exactly 6 monitors (3 per side) ---
      const feats = [];
      const grab = (kind, base, offX) => {
        for (const c of findKind(kind)) {
          if (feats.length >= 4) break;
          feats.push(cellCamSpec(base, c, offX));
        }
      };
      grab('pumpkin', 'PUMPKINCAM', 1.6);
      grab('tree', 'TREECAM', -1.6);
      grab('house', 'HOUSECAM', 1.8);
      while (feats.length < 4) {
        const i = feats.length;
        const ax = (i % 2 === 0 ? -1 : 1) * (g * 0.3);
        const az = anchor.z + g * (0.42 + 0.14 * Math.floor(i / 2));
        const agy = groundY(Math.round(ax + g / 2 - 0.5), Math.round(az + g / 2 - 0.5));
        // Same low, looking-out-and-up Truman framing as the feature cams.
        feats.push({
          base: 'AREA CAM',
          camPos: new THREE.Vector3(ax, agy + 0.35, az),
          look: new THREE.Vector3(ax * 0.2, agy + 2.6, az + g * 0.4),
          opts: { fov: 58, sweep: { yaw: 0.4, pitch: 0.14, speed: 0.3 } },
        });
      }
      // Number names that repeat (TREECAM 01/02, AREA CAM 01/02, …).
      const baseTotals = {};
      feats.forEach((f) => { baseTotals[f.base] = (baseTotals[f.base] || 0) + 1; });
      const baseSeen = {};
      feats.forEach((f, i) => {
        baseSeen[f.base] = (baseSeen[f.base] || 0) + 1;
        f.id = 'featcam-' + (i + 1);
        f.name = baseTotals[f.base] > 1 ? f.base + ' 0' + baseSeen[f.base] : f.base;
      });

      // --- lay them out: 3 in the left column, 3 in the right, all flat (rotY 0,
      //     no lookAt) and the same width; vertically centred on the screen ---
      const rows = [SCREEN_CY + ROW_STEP, SCREEN_CY, SCREEN_CY - ROW_STEP];
      const columns = [
        { sx: -1, specs: [lobbyL, feats[0], feats[1]] },
        { sx: 1, specs: [lobbyR, feats[2], feats[3]] },
      ];
      for (const col of columns) {
        for (let r = 0; r < 3; r++) {
          const spec = col.specs[r];
          if (!spec) continue;
          const monPos = new THREE.Vector3(col.sx * COL_X, screenY + rows[r], anchor.z + 0.15);
          mount(spec.id, spec.name, spec.camPos, spec.look, monPos, null,
            Object.assign({ width: MON_W, rotY: 0 }, spec.opts));
        }
      }

      // --- low-impact cable conduit linking each monitor column + into the screen ---
      // Each column has up to 3 monitors at screenY + rows[r]; the conduit runs a riser
      // down the column back, drops a nipple at each monitor, and trunks into the screen.
      const colPts = rows.map((rOff) => ({ y: screenY + rOff }));
      buildConnectors([
        { x: -COL_X, pts: colPts.slice() },
        { x: COL_X, pts: colPts.slice() },
      ], anchor.z);

      // Feed live avatar positions to the cameras so they track whoever moves.
      if (typeof WS.subjects === 'function') cc.setSubjectsProvider(() => WS.subjects());
      cc.setEnabled(true);
      active = true;
      // Expose mounted feed ids so the lobby screen can cycle through them (cams only).
      window.__tinyworldCCTVFeeds = mounted.map((m) => m.id).filter((id) => id !== '__conduit');
    }

    function teardown() {
      const cc = CCTV();
      if (cc) {
        mounted.forEach((m) => {
          try { cc.removeCamera(m.id); } catch (_) {}
          if (m.monitor && m.monitor.parent) m.monitor.parent.remove(m.monitor);
        });
        cc.setEnabled(false);
        cc.setSubjectsProvider(null);
      }
      mounted.length = 0;
      window.__tinyworldCCTVFeeds = [];
      active = false;
    }

    if (typeof WS.on === 'function') {
      // Build slightly after enter so the lobby screen + world cells exist.
      WS.on('enter', () => { setTimeout(() => { try { setup(); } catch (_) {} }, 350); });
      WS.on('leave', () => { try { teardown(); } catch (_) {} });
    }

    window.__tinyworldCCTVPlacement = {
      setup, teardown,
      isActive: () => active,
      mountedIds: () => mounted.map((m) => m.id),
    };
  })();
