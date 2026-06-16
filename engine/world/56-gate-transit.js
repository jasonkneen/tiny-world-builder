  // -------- stargate transit: walk a voxel person through the gate to swap layers --------
  // Plants the nested stargate on the sky island and lets a person walk THROUGH it to
  // transition between the floating island (sky) and the flooded land below. The walk-
  // through drives the existing fly-down (54): cross the event-horizon -> descend; cross
  // back -> ascend. A bright portal flash sells the moment.
  //
  // v1 mechanic: window.__tinyworldGateTransit.enter() walks the demo person through the
  // gate and triggers the layer swap; the 'h' key does the same. (Full free-roam avatar
  // control on the surface is a later step — this proves the gate-as-transition loop.)
  // IIFE — no top-level identifiers leak into the shared global scope.
  (function gateTransitBoot() {
    'use strict';
    if (typeof window === 'undefined' || typeof THREE === 'undefined') return;

    let gate = null;          // sky-island edge gate  { group, update, centerY, openR }
    let landGate = null;      // mainland destination gate (lives inside the surface group)
    let landWalker = null;    // avatar that emerges at the mainland gate
    let walker = null;        // voxel avatar that walks through the sky gate
    let raf = null, t0 = null;
    let busy = false;         // mid walk-through
    let onSurface = false;    // which layer the gate currently leads to

    // ---- gate-to-gate LOBBY travel (separate from the sky<->land transit above) ----
    let lobbyGates = [];      // scattered paired gates on the home board
    let lobbyWalker = null;   // the demo avatar that travels between them
    let travelStep = null;    // active travel state-machine step(dt), or null when idle
    let travelBusy = false;
    let manualDrive = false;  // when true, the live rAF stops driving travel/FX so _debugStep
                              //   is the SOLE driver (for deterministic capture in automation)

    function parent() {
      if (typeof worldGroup !== 'undefined' && worldGroup) return worldGroup;
      if (typeof xrWorldRoot !== 'undefined' && xrWorldRoot) return xrWorldRoot;
      return (typeof scene !== 'undefined') ? scene : null;
    }

    // Ground height at a home cell (tile top), so the gate + walker sit on the island.
    function groundYAt(x, z) {
      if (typeof cellMeshes !== 'undefined' && cellMeshes[x + ',' + z] && cellMeshes[x + ',' + z].tile) {
        const bb = new THREE.Box3().setFromObject(cellMeshes[x + ',' + z].tile);
        if (isFinite(bb.max.y)) return bb.max.y;
      }
      return 0.18;
    }

    // Place the gate near the edge of the home board, on the path, opening facing inward.
    // A cute mini version of the lobby slideshow screen, placed beside the gate:
    // a small framed panel reading CYBERGATE with a stylised Tesla-style T emblem.
    let sign = null;
    function buildSign() {
      const g = new THREE.Group();
      g.name = 'cybergate-sign';
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
      const c = cv.getContext('2d');
      const grad = c.createLinearGradient(0, 0, 0, 160);
      grad.addColorStop(0, '#10203a'); grad.addColorStop(1, '#0a1428');
      c.fillStyle = grad; c.fillRect(0, 0, 256, 160);
      c.strokeStyle = 'rgba(120,170,255,0.55)'; c.lineWidth = 4; c.strokeRect(6, 6, 244, 148);
      // stylised T emblem (Tesla-style): vertical stem + top bar + two angled flares
      c.fillStyle = '#eef4ff';
      c.fillRect(123, 44, 10, 52);
      c.fillRect(94, 30, 68, 9);
      c.save(); c.translate(98, 39); c.rotate(0.6); c.fillRect(0, 0, 7, 15); c.restore();
      c.save(); c.translate(158, 39); c.rotate(-0.6); c.fillRect(0, 0, 7, 15); c.restore();
      c.fillStyle = '#dfe9ff'; c.textAlign = 'center';
      c.font = '700 23px "Space Grotesk", system-ui, sans-serif';
      c.fillText('GROUND LEVEL', 128, 134);
      const tex = new THREE.CanvasTexture(cv);
      if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      const W = 0.7, H = W * 160 / 256, bottom = 0.55, cy = bottom + H / 2;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      panel.position.y = cy; g.add(panel);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, H + 0.06, 0.04), new THREE.MeshStandardMaterial({ color: 0x1b2434, roughness: 0.7, metalness: 0.1 }));
      frame.position.set(0, cy, -0.025); frame.castShadow = true; g.add(frame);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, bottom, 0.05), new THREE.MeshStandardMaterial({ color: 0x141b28, roughness: 0.8 }));
      post.position.set(0, bottom / 2, -0.02); post.castShadow = true; g.add(post);
      return g;
    }

    function placeGate() {
      if (gate) return gate;
      const SG = window.__tinyworldStargate;
      const par = parent();
      if (!SG || typeof SG.build !== 'function' || !par || typeof tilePos !== 'function') return null;
      const grid = (typeof GRID === 'number') ? GRID : 8;
      const ex = Math.max(0, Math.floor(grid / 2) - 1), ez = grid - 1;     // a back-edge cell
      const p = tilePos(ex, ez);
      const gy = groundYAt(ex, ez);
      gate = SG.build('nested');
      gate.group.position.set(p.x, gy, p.z);
      gate.group.rotation.y = Math.PI;                                     // opening faces -z (flipped per request)
      gate.group.userData.gateTransit = true;
      gate.group.userData.gateRole = 'sky-edge';
      gate.group.name = 'stargate-sky-edge';
      par.add(gate.group);
      gate._cellZ = ez; gate._cellX = ex; gate._gy = gy; gate._p = p;
      // a little CYBERGATE sign beside the gate (offset past the gate's own width)
      try {
        sign = buildSign();
        const bb = new THREE.Box3().setFromObject(gate.group);
        const halfW = isFinite(bb.max.x) ? (bb.max.x - bb.min.x) / 2 : 1.2;
        sign.position.set(p.x + halfW + 0.35, gy, p.z);
        sign.rotation.y = Math.PI;
        par.add(sign);
      } catch (_) {}
      startTick();
      return gate;
    }

    function ensureWalker() {
      if (walker) return walker;
      if (typeof window.makeVoxelAvatar !== 'function' || !gate) return null;
      walker = window.makeVoxelAvatar({ seed: 'gatewalker', fit: 'Scout', head: 'Wide' });
      parent().add(walker.group);
      return walker;
    }

    // Seat a point on the mainland (poser surface) by raycasting straight down onto
    // its ground meshes, in the surface group's LOCAL space (before the group's scale).
    // groundH() is private to 57, so we measure instead of guessing. Returns local y.
    //
    // Two gotchas measured in 57's geometry: (1) the heart of the island is a SEPARATE
    // meadow mesh, so we must ray against all wide ground meshes, not just one; (2) the
    // ground triangles are wound so a top-down ray hits their back faces — DoubleSide
    // probe materials are required or every ray misses. We probe throwaway meshes that
    // share 57's geometry at identity transform so we work purely in local space.
    function localGroundY(grp, lx, lz) {
      const probes = [];
      grp.traverse(o => {
        if (!(o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position)) return;
        o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox;
        if ((bb.max.x - bb.min.x) > 20 && (bb.max.z - bb.min.z) > 20) {   // ground-like (wide, near-flat)
          const p = new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
          p.matrixAutoUpdate = false; p.matrix.identity(); p.matrixWorld.identity();
          p.geometry.computeBoundingSphere();
          probes.push(p);
        }
      });
      if (probes.length) {
        const ray = new THREE.Raycaster(new THREE.Vector3(lx, 30, lz), new THREE.Vector3(0, -1, 0), 0, 200);
        const hits = ray.intersectObjects(probes, false);
        probes.forEach(p => p.material.dispose());
        if (hits.length) return hits[0].point.y;             // local-space hit (probes are identity-transformed)
      }
      return 0.3;   // fallback: the island heart sits ~0.3 above local 0 (measured)
    }

    // Place the matching combo gate on the mainland's main island, parented INTO the
    // poser surface group so it inherits the surface transform (and shows/hides with it).
    // Local origin (0,0) is the grassy heart of the main island — where the descended
    // orbit camera looks, so the emerging avatar is in frame.
    function placeLandGate() {
      if (landGate) return landGate;
      const SG = window.__tinyworldStargate;
      const PS = window.__tinyworldPoserSurface;
      if (!SG || typeof SG.build !== 'function' || !PS || typeof PS.build !== 'function') return null;
      PS.build();                                            // ensure the surface group + island mesh exist
      const grp = (typeof PS.group === 'function') ? PS.group() : null;
      if (!grp) return null;
      const lx = 0, lz = 0;
      const ly = localGroundY(grp, lx, lz);
      landGate = SG.build('nested');
      // The surface group is scaled (SCALE, SCALE*Y_BOOST, SCALE); a child gate inherits that
      // and renders huge + vertically stretched. Counter the parent scale so the gate is a
      // normal walk-through size (~1 world unit, matching the sky-edge gate) and circular.
      const gs = grp.scale;
      const NET = 1.0;
      landGate.group.scale.set(NET / (gs.x || 1), NET / (gs.y || 1), NET / (gs.z || 1));
      landGate.group.position.set(lx, ly, lz);
      landGate.group.userData.gateTransit = true;
      landGate.group.userData.gateRole = 'mainland';
      landGate.group.name = 'stargate-mainland';
      grp.add(landGate.group);
      landGate._local = { x: lx, y: ly, z: lz };
      startTick();
      return landGate;
    }

    // Stand an avatar at the mainland gate's local-front so it "emerges" there.
    function ensureLandWalker() {
      if (landWalker) return landWalker;
      if (typeof window.makeVoxelAvatar !== 'function' || !landGate) return null;
      const grp = window.__tinyworldPoserSurface && window.__tinyworldPoserSurface.group
        && window.__tinyworldPoserSurface.group();
      if (!grp) return null;
      landWalker = window.makeVoxelAvatar({ seed: 'gateemerge', fit: 'Scout', head: 'Wide' });
      grp.add(landWalker.group);                             // child of surface group: inherits its transform
      return landWalker;
    }

    function flashGate(g) {
      if (!g) return;
      // brief white bloom on the gate core (uses the gate's own additive materials)
      g.group.traverse(o => {
        if (o.isMesh && o.material && o.material.blending === THREE.AdditiveBlending && o.material.transparent) {
          o.material.opacity = Math.min(1, (o.material.opacity || 0.5) + 0.5);
        }
      });
    }
    function flash() { flashGate(gate); }

    function startTick() {
      if (raf) return;
      const tick = (now) => {
        if (t0 == null) t0 = now;
        const t = (now - t0) / 1000;
        if (gate) gate.update(t);
        if (landGate) landGate.update(t);
        if (walker) walker.update(0.016);
        if (landWalker) landWalker.update(0.016);
        for (let i = 0; i < lobbyGates.length; i++) lobbyGates[i].update(t);
        if (lobbyWalker) lobbyWalker.update(0.016);
        if (!manualDrive && travelStep) travelStep(0.016);
        if (!manualDrive && window.__tinyworldGateTravelFX) window.__tinyworldGateTravelFX._tick(0.016);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    // Make a walker appear out of the mainland gate. NOTE (honest scope): after the
    // fly-down descend the camera is an ORBIT view of the surface, not an on-foot
    // surface camera (that free-roam camera/avatar is a known existing gap). So this
    // places the destination gate + stands an avatar at its front and flashes it; it
    // does NOT simulate walking around the mainland on foot.
    function emergeOnMainland() {
      if (!placeLandGate()) return false;
      flashGate(landGate);
      const lw = ensureLandWalker(); if (!lw) return false;
      const lp = landGate._local || { x: 0, y: 0, z: 0 };
      lw.group.position.set(lp.x, lp.y, lp.z + 1.1);            // just in front of the gate opening
      lw.group.visible = true;
      if (lw.setHeading) lw.setHeading(0);                      // face out of the gate (+z)
      if (lw.setState) lw.setState('idle');
      return true;
    }

    // Walk the person from in front of the gate, THROUGH the opening, then swap layers
    // as they cross the event-horizon plane.
    function enter() {
      if (busy) return false;
      if (!gate) { if (!placeGate()) return false; }
      const av = ensureWalker(); if (!av) return false;
      busy = true;
      const p = gate._p, gy = gate._gy;
      const startZ = p.z + 1.1, endZ = p.z - 1.1, crossZ = p.z;   // approach +z -> exit -z
      av.group.position.set(p.x, gy, startZ);
      av.setHeading(Math.PI);                                     // face -z (into the gate)
      av.setState('walk');
      let crossed = false, et0 = null;
      const speed = 1.2;                                          // units/sec
      const step = (now) => {
        if (et0 == null) et0 = now;
        const dt = 0.016;
        const z = av.group.position.z;
        const nz = Math.max(endZ, z - speed * dt);
        av.group.position.z = nz;
        av.update(dt);
        if (!crossed && nz <= crossZ) {                          // crossed the event-horizon
          crossed = true;
          flash();
          if (!onSurface) {
            if (window.__tinyworldFlyDown) window.__tinyworldFlyDown.descend();
            onSurface = true;
            emergeOnMainland();                                  // appear out of the mainland gate
          } else {
            if (window.__tinyworldFlyDown) window.__tinyworldFlyDown.ascend();
            onSurface = false;
            if (landWalker) landWalker.group.visible = false;    // leave the surface: hide the emerged avatar
          }
        }
        if (nz > endZ) { requestAnimationFrame(step); }
        else { av.setState('idle'); busy = false; }
      };
      requestAnimationFrame(step);
      return true;
    }

    function disposeGroup(g) {
      try {
        g.parent && g.parent.remove(g);
        g.traverse(o => { if (o.isMesh) { o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); } });
      } catch (_) {}
    }

    function remove() {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      if (walker) { try { walker.dispose(); } catch (_) {} walker = null; }
      if (landWalker) { try { landWalker.dispose(); } catch (_) {} landWalker = null; }
      if (gate) { disposeGroup(gate.group); gate = null; }
      if (sign) { disposeGroup(sign); sign = null; }
      if (landGate) { disposeGroup(landGate.group); landGate = null; }
      busy = false; onSurface = false; t0 = null;
    }

    // ====================== gate-to-gate LOBBY travel ======================
    // Scatter a few gates on the home board, pair A<->B, and run the full 5-stage
    // travel effect walking the demo walker from one opening to emerge from another.
    // Lives in the SAME worldGroup parent as the board, so it's all one coord space
    // (no poser-surface transform gymnastics). Independent of the sky/land transit.

    // Set every material's opacity on a walker's meshes (fade in/out), remembering the
    // baseline so we can restore it (the figure is multi-material: skin/face/hair).
    function setWalkerOpacity(av, k) {
      if (!av || !av.group) return;
      av.group.traverse(o => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => {
          if (m.userData.__baseOpacity == null) { m.userData.__baseOpacity = (m.opacity == null ? 1 : m.opacity); }
          if (m.userData.__baseTransparent == null) { m.userData.__baseTransparent = !!m.transparent; }
          if (!m.transparent) { m.transparent = true; m.needsUpdate = true; }  // r128: recompile to honour opacity
          m.depthWrite = false;                                                // avoid sort artifacts while fading
          m.opacity = m.userData.__baseOpacity * k;
        });
      });
    }
    function restoreWalkerOpacity(av) {
      if (!av || !av.group) return;
      av.group.traverse(o => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => {
          if (m.userData.__baseOpacity != null) m.opacity = m.userData.__baseOpacity;
          if (m.userData.__baseTransparent != null && m.transparent !== m.userData.__baseTransparent) {
            m.transparent = m.userData.__baseTransparent; m.needsUpdate = true;
          }
          m.depthWrite = true;
        });
      });
    }

    // Scatter N lobby gates on the board, each on the ground, opening facing +z.
    function placeLobbyGates() {
      if (lobbyGates.length) return lobbyGates;
      const SG = window.__tinyworldStargate;
      const par = parent();
      if (!SG || typeof SG.build !== 'function' || !par || typeof tilePos !== 'function') return lobbyGates;
      const grid = (typeof GRID === 'number') ? GRID : 8;
      // three cells spread across the board (avoid the back-edge sky gate cell)
      const cells = [
        { x: 1, z: 1, ry: 0 },
        { x: Math.max(0, grid - 2), z: 2, ry: -Math.PI / 2 },
        { x: Math.floor(grid / 2), z: Math.max(0, grid - 3), ry: Math.PI },
      ];
      cells.forEach((cell, i) => {
        const p = tilePos(cell.x, cell.z);
        const gy = groundYAt(cell.x, cell.z);
        const lg = SG.build('nested');
        lg.group.position.set(p.x, gy, p.z);
        lg.group.rotation.y = cell.ry;
        lg.group.userData.gateLobby = true;
        lg.group.name = 'stargate-lobby-' + i;
        par.add(lg.group);
        lg._cell = cell; lg._p = p; lg._gy = gy;
        lobbyGates.push(lg);
      });
      startTick();
      return lobbyGates;
    }

    function ensureLobbyWalker() {
      if (lobbyWalker) return lobbyWalker;
      if (typeof window.makeVoxelAvatar !== 'function') return null;
      lobbyWalker = window.makeVoxelAvatar({ seed: 'gatetraveler', fit: 'Scout', head: 'Wide' });
      parent().add(lobbyWalker.group);
      lobbyWalker.update(0.016);                  // build the rig so bbox sampling is valid
      return lobbyWalker;
    }

    // World-space point a short distance OUT of a gate's opening (front, +local z),
    // at the gate's ground level. d>0 = in front, d<0 = behind.
    function gateFront(g, d) {
      g.group.updateWorldMatrix(true, false);
      const off = new THREE.Vector3(0, 0, d).applyMatrix4(g.group.matrixWorld);
      // y: keep the walker's feet on the board (gate sits at _gy)
      off.y = g._gy;
      return off;
    }
    function gateHeading(g) {
      // walker should FACE into the gate when approaching => face the gate's -z (back).
      // Heading is atan2(dx,dz) of the look direction.
      g.group.updateWorldMatrix(true, false);
      const into = new THREE.Vector3(0, 0, -1).transformDirection(g.group.matrixWorld);
      return Math.atan2(into.x, into.z);
    }

    // Run the full 5-stage travel from gate A to gate B with the demo walker.
    // Phases: APPROACH (magnetic pull) -> DISSOLVE (in-suck + flash) -> EXTRUDE (back)
    //         -> RECEIVE (edge-light + flash on B) -> EMERGE (reassemble + step out).
    function travel(a, b, opts) {
      if (travelBusy) return false;
      if (!a || !b) return false;
      opts = opts || {};
      const FX = window.__tinyworldGateTravelFX;
      const av = opts.avatar || ensureLobbyWalker(); if (!av) return false;   // player avatar or demo walker
      travelBusy = true;

      const aOpen = gateFront(a, 1.0);            // portal opening of A (just inside front)
      const aStart = gateFront(a, 3.2);           // where the walker begins its approach
      const aHead = gateHeading(a);
      const bOut = gateFront(b, 1.8);             // a few feet out of B (gentle emerge)

      restoreWalkerOpacity(av);
      let phase = opts.startPhase || 'approach', pt = 0, fired = false;
      if (phase === 'approach') {
        av.group.position.copy(aStart);
        av.setHeading(aHead);
        av.setState('walk');
      } else {                                    // player already at the gate -> begin dissolving
        av.group.position.copy(aOpen);
        av.setHeading(aHead);
        av.setState('idle');
      }
      av.group.visible = true;
      travelStep = (dt) => {
        pt += dt;
        if (phase === 'approach') {
          // magnetic pull: ease position toward the opening with an ACCELERATING factor
          // (gets stronger the closer it is) -> reads like a magnet regardless of speed.
          const pos = av.group.position;
          const to = aOpen;
          const dist = pos.distanceTo(to);
          const pull = 0.06 + 0.20 * (1 - Math.min(1, dist / 3.2));   // accelerate as it nears
          pos.lerp(to, pull);
          av.update(dt);
          if (dist < 0.12 || pt > 2.4) {            // centered on the portal
            pos.copy(to); av.setState('idle'); av.update(dt);
            phase = 'dissolve'; pt = 0; fired = false;
          }
        } else if (phase === 'dissolve') {
          if (!fired) {
            fired = true;
            if (a.flash) a.flash(0.4);             // surface starts to glow as it drains
            if (FX) FX.dissolveInto(av, a, { count: opts.count || 520, dur: 0.85 });
          }
          // fade the walker out in lockstep with the drain
          setWalkerOpacity(av, Math.max(0, 1 - pt / 0.85));
          if (pt > 0.7 && a.flash) a.flash(1.0);   // stage 3: PORTAL FLASH at peak drain
          if (pt >= 0.95) {
            av.group.visible = false; setWalkerOpacity(av, 0);
            phase = 'extrude'; pt = 0; fired = false;
          }
        } else if (phase === 'extrude') {
          if (!fired) { fired = true; if (FX) FX.extrudeBack(a, { count: 240, dur: 0.6 }); }
          if (pt >= 0.45) {
            // hand off to the receiving gate
            if (b.edgeLight) b.edgeLight(1.0);     // stage 5: ring lights up around EDGES
            phase = 'receive'; pt = 0; fired = false;
          }
        } else if (phase === 'receive') {
          if (b.edgeLight) b.edgeLight(0.9);       // keep the rim lit through the buildup
          if (pt >= 0.35) {
            if (b.flash) b.flash(1.0);             // receiving flash
            phase = 'emerge'; pt = 0; fired = false;
          }
        } else if (phase === 'emerge') {
          if (!fired) {
            fired = true;
            // place the walker at B's opening (hidden) so emerge particles target its volume
            av.group.position.copy(gateFront(b, 0.4));
            av.setHeading(gateHeading(b) + Math.PI);   // face OUT of B
            av.group.visible = true; setWalkerOpacity(av, 0);
            av.setState('idle'); av.update(dt);
            if (FX) FX.emergeFrom(b, av, { count: opts.count || 520, dur: 0.8 });
          }
          // fade the walker IN as the particles settle onto it
          setWalkerOpacity(av, Math.min(1, pt / 0.7));
          // gentle step a few feet out into the world
          const k = Math.min(1, pt / 0.9);
          const from = gateFront(b, 0.4), out = bOut;
          av.group.position.lerpVectors(from, out, k * k * (3 - 2 * k));
          if (pt > 0.15) av.setState('walk');
          av.update(dt);
          if (pt >= 1.0) {
            restoreWalkerOpacity(av);
            av.setState('idle'); av.update(dt);
            travelStep = null; travelBusy = false;
            if (opts.onArrive) { try { opts.onArrive(b._cell); } catch (_) {} }
          }
        }
      };
      return true;
    }

    // Trigger the whole sequence on the first pair of lobby gates (for capture/testing).
    function travelDemo(opts) {
      placeLobbyGates();
      if (lobbyGates.length < 2) return false;
      return travel(lobbyGates[0], lobbyGates[1], opts);
    }

    // Ambient auto-travel: the demo walker continuously walks into one lobby gate and
    // emerges from another, so travel is VISIBLY happening without a keypress (the user
    // wasn't seeing anything because travel only fired on 'g'). Real-player/bot travel
    // is the follow-up; this makes the gates feel alive + lets the effect be judged.
    let autoTravelTimer = null;
    function startAutoTravel() {
      stopAutoTravel();
      const loop = () => {
        autoTravelTimer = setTimeout(() => {
          if (lobbyGates.length >= 2 && !travelBusy) {
            const i = Math.floor(Math.random() * lobbyGates.length);
            let j = Math.floor(Math.random() * (lobbyGates.length - 1));
            if (j >= i) j++;                              // distinct destination
            try { travel(lobbyGates[i], lobbyGates[j]); } catch (_) {}
          }
          loop();
        }, 4000 + Math.random() * 4000);                 // every ~4-8s
      };
      loop();
    }
    function stopAutoTravel() { if (autoTravelTimer) { clearTimeout(autoTravelTimer); autoTravelTimer = null; } }

    // Run travel on the REAL player's avatar `av` when their grid cell sits on a lobby
    // gate: dissolve them there, emerge at the paired gate, and call onArrive(destCell)
    // so 47 can set the player's grid position. Interrupts any in-progress demo travel.
    function travelPlayer(playerCell, av, onArrive) {
      placeLobbyGates();
      if (!playerCell || !av || lobbyGates.length < 2) return false;
      const ai = lobbyGates.findIndex(g => g._cell && g._cell.x === playerCell.x && g._cell.z === playerCell.z);
      if (ai < 0) return false;                          // not standing on a gate cell
      travelStep = null; travelBusy = false;             // interrupt the demo travel if mid-run
      if (lobbyWalker) lobbyWalker.group.visible = false;
      const bi = (ai + 1) % lobbyGates.length;           // paired destination gate
      return travel(lobbyGates[ai], lobbyGates[bi], { avatar: av, startPhase: 'dissolve', onArrive });
    }
    // Is this grid cell on a lobby gate? (cheap check for 47's enter detection.)
    function gateAtCell(cell) {
      if (!cell) return false;
      return lobbyGates.some(g => g._cell && g._cell.x === cell.x && g._cell.z === cell.z);
    }

    function removeLobby() {
      stopAutoTravel();
      travelStep = null; travelBusy = false;
      if (lobbyWalker) { try { lobbyWalker.dispose(); } catch (_) {} lobbyWalker = null; }
      for (const lg of lobbyGates) disposeGroup(lg.group);
      lobbyGates = [];
    }

    window.__tinyworldGateTransit = {
      placeGate, placeLandGate, enter, remove,
      placeLobbyGates, travel, travelDemo, travelPlayer, gateAtCell, removeLobby,
      isOnSurface: () => onSurface,
      // --- player stargate round-trip (47 surface-roam wires these) ---
      // The sky-edge gate cell: walk onto it to descend to the mainland.
      skyGateCell: () => gate ? { x: gate._cellX, z: gate._cellZ } : null,
      ensureSkyGate: () => placeGate(),
      flashSky: () => flash(),
      // The mainland gate (surface-local 0,0): walk into it to ascend back up.
      ensureLandGate: () => placeLandGate(),
      flashLand: () => flashGate(landGate),
      landGateWorldPos: (out) => {
        if (!landGate || !landGate.group) return null;
        const v = out || new THREE.Vector3();
        landGate.group.getWorldPosition(v);
        return v;
      },
      gate: () => gate,
      landGate: () => landGate,
      lobbyGates: () => lobbyGates,
      isTraveling: () => travelBusy,
      _walker: () => lobbyWalker,
      // debug: when manual, the live rAF stops driving travel/FX so _debugStep is the
      // SOLE driver (deterministic capture; otherwise a foregrounded tab races ahead).
      _setManual: (v) => { manualDrive = !!v; },
      // debug: drive the travel state-machine + FX one fixed step (for capture/testing
      // when rAF is throttled, e.g. a backgrounded automation tab). Not used in play.
      _debugStep: (dt) => {
        dt = dt || 0.016;
        for (const lg of lobbyGates) lg.update((performance.now() / 1000));
        if (lobbyWalker) lobbyWalker.update(dt);
        if (travelStep) travelStep(dt);
        if (window.__tinyworldGateTravelFX) window.__tinyworldGateTravelFX._tick(dt);
      },
    };

    // Auto-place the single combo edge gate when the player enters a world; tear it
    // down on leave so re-entering a world never strands a stale gate. A short delay
    // lets the home board's cellMeshes exist so the gate seats on the ground.
    if (window.__tinyworldWorlds && typeof window.__tinyworldWorlds.on === 'function') {
      // DISABLED: the edge portal + its sign are hidden for the lobby/demo. The
      // buildSign() / stargate factories stay in the library — just not placed.
      // Re-enable by restoring the placeGate()/placeLobbyGates()/startAutoTravel() calls.
      // window.__tinyworldWorlds.on('enter', () => { setTimeout(() => { try { placeGate(); placeLobbyGates(); startAutoTravel(); } catch (_) {} }, 600); });
      window.__tinyworldWorlds.on('leave', () => { try { remove(); removeLobby(); } catch (_) {} });
    }

    // 'h' = place the gate (first press) / walk through it to swap layers.
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'h' && e.key !== 'H') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement; if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (!gate) placeGate(); else enter();
    });

    // 'g' = run the gate-to-gate lobby travel effect on the demo walker.
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'g' && e.key !== 'G') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement; if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      travelDemo();
    });
  })();

