  // -------- gate travel FX: particle in-suck / back-extrude / emerge-reassemble --------
  // Particle systems for the gate-to-gate LOBBY travel effect driven by 56-gate-transit.
  // Three moments, all on ONE additive THREE.Points pool (render-bound app -> keep draws
  // low: a single Points object per active burst, modest count):
  //   1. dissolveInto(walker, gate)  -- sample points across the walker volume and stream
  //      them INTO the portal centre while the caller fades the walker out (the "in-suck",
  //      water-ish but a particle drain, not a shader).
  //   2. extrudeBack(gate)           -- a burst shot out the BACK of the gate (sent off).
  //   3. emergeFrom(gate, walker)    -- particles gather at the portal then resolve onto
  //      the walker volume as the caller fades the walker back in (reassembly).
  // All work in WORLD space (gate.group + walker.group live in the same lobby parent), so
  // the Points pool is added to the scene root and positions are world coords.
  //
  // API: window.__tinyworldGateTravelFX = { dissolveInto, extrudeBack, emergeFrom, _tick }
  // IIFE — no top-level identifiers leak into the shared global scope.
  (function gateTravelFxBoot() {
    'use strict';
    if (typeof window === 'undefined' || typeof THREE === 'undefined') return;

    // soft round additive sprite (white core -> cyan -> transparent), built once.
    let SPRITE = null;
    function sprite() {
      if (SPRITE) return SPRITE;
      const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
      const c = cv.getContext('2d');
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0.0, 'rgba(255,255,255,1)');
      g.addColorStop(0.45, 'rgba(224,248,255,0.95)');   // hotter, larger white-cyan core so it reads in daylight
      g.addColorStop(0.78, 'rgba(120,224,255,0.45)');
      g.addColorStop(1.0, 'rgba(120,224,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, s, s);
      SPRITE = new THREE.CanvasTexture(cv);
      return SPRITE;
    }

    function sceneRoot() {
      if (typeof worldGroup !== 'undefined' && worldGroup) return worldGroup;
      if (typeof scene !== 'undefined' && scene) return scene;
      return null;
    }

    // World-space centre of a gate's portal opening + its forward (+local z) normal.
    function gateFrame(gate) {
      const g = gate.group;
      g.updateWorldMatrix(true, false);
      const centre = new THREE.Vector3(0, gate.centerY, 0).applyMatrix4(g.matrixWorld);
      const fwd = new THREE.Vector3(0, 0, 1).transformDirection(g.matrixWorld).normalize();
      return { centre, fwd };
    }

    // Sample N world-space points spread across a walker's solid meshes' bounding box,
    // biased to fill the volume (not just the surface). Returns Vector3[].
    function sampleWalker(walker, n) {
      const grp = walker.group;
      grp.updateWorldMatrix(true, true);
      const bb = new THREE.Box3().setFromObject(grp);
      const pts = [];
      if (!isFinite(bb.min.x) || bb.isEmpty()) {                 // degenerate -> a small cloud at origin
        const o = grp.getWorldPosition(new THREE.Vector3());
        for (let i = 0; i < n; i++) pts.push(o.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 1.4, (Math.random() - 0.5) * 0.4)));
        return pts;
      }
      const sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z;
      for (let i = 0; i < n; i++) {
        // bias toward the vertical core column so the cloud reads as a body, not a cube
        const rx = (Math.random() - 0.5) * (0.55 + 0.45 * Math.random());
        const rz = (Math.random() - 0.5) * (0.55 + 0.45 * Math.random());
        pts.push(new THREE.Vector3(
          bb.min.x + (0.5 + rx) * sx,
          bb.min.y + Math.random() * sy,
          bb.min.z + (0.5 + rz) * sz,
        ));
      }
      return pts;
    }

    // active bursts: each is a self-animating Points object with a per-frame step()
    const bursts = [];

    function makePoints(positions, size) {
      const n = positions.length;
      const geo = new THREE.BufferGeometry();
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = positions[i].x; arr[i * 3 + 1] = positions[i].y; arr[i * 3 + 2] = positions[i].z; }
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const mat = new THREE.PointsMaterial({
        size: size || 0.14, map: sprite(), transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
        color: 0xeaf8ff,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      return pts;
    }

    function disposeBurst(b) {
      try { b.points.parent && b.points.parent.remove(b.points); b.points.geometry.dispose(); b.points.material.dispose(); } catch (_) {}
    }

    // ---- stage 2: PULL-IN DISSOLVE -> particles drain from the walker into the portal.
    function dissolveInto(walker, gate, opts) {
      const root = sceneRoot(); if (!root || !walker || !gate) return null;
      opts = opts || {};
      const N = opts.count || 520, dur = opts.dur || 0.85;
      const start = sampleWalker(walker, N);
      const { centre } = gateFrame(gate);
      const pts = makePoints(start, opts.size || 0.3);
      root.add(pts);
      const targets = start.map(() => centre.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.18, 0)));
      const delay = start.map(() => Math.random() * 0.5);     // wide stagger: a continuous stream over the whole drain
      const b = {
        points: pts, t: 0, dur, done: false, onDone: opts.onDone,
        step(dt) {
          this.t += dt; const a = this.points.geometry.attributes.position.array;
          let alive = 0;
          for (let i = 0; i < N; i++) {
            const lt = Math.max(0, this.t - delay[i]) / dur;
            const e = lt >= 1 ? 1 : Math.pow(lt, 1.25);        // near-linear ease-IN: a steady visible stream into the throat
            const s = start[i], tg = targets[i];
            a[i * 3] = s.x + (tg.x - s.x) * e;
            a[i * 3 + 1] = s.y + (tg.y - s.y) * e;
            a[i * 3 + 2] = s.z + (tg.z - s.z) * e;
            if (lt < 1) alive++;
          }
          this.points.geometry.attributes.position.needsUpdate = true;
          this.points.material.opacity = Math.max(0, 1 - Math.max(0, this.t - dur + 0.2) / 0.2);
          if (this.t >= dur + 0.05 || (alive === 0 && this.t > 0.1)) { this.done = true; if (this.onDone) try { this.onDone(); } catch (_) {} }
        },
      };
      bursts.push(b); return b;
    }

    // ---- stage 4: BACK EXTRUSION -> a streak burst shot out the REAR of the gate.
    function extrudeBack(gate, opts) {
      const root = sceneRoot(); if (!root || !gate) return null;
      opts = opts || {};
      const N = opts.count || 240, dur = opts.dur || 0.6;
      const { centre, fwd } = gateFrame(gate);
      const back = fwd.clone().multiplyScalar(-1);              // out the back face
      const start = []; for (let i = 0; i < N; i++) start.push(centre.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0)));
      const pts = makePoints(start, opts.size || 0.12); root.add(pts);
      const vel = start.map(() => {
        const spread = new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6);
        return back.clone().multiplyScalar(1.6 + Math.random() * 2.4).add(spread);
      });
      const b = {
        points: pts, t: 0, dur, done: false, onDone: opts.onDone,
        step(dt) {
          this.t += dt; const a = this.points.geometry.attributes.position.array;
          for (let i = 0; i < N; i++) {
            const v = vel[i]; const k = 1 - Math.pow(1 - Math.min(1, this.t / dur), 2);  // decelerate
            a[i * 3] = start[i].x + v.x * k * dur;
            a[i * 3 + 1] = start[i].y + v.y * k * dur;
            a[i * 3 + 2] = start[i].z + v.z * k * dur;
          }
          this.points.geometry.attributes.position.needsUpdate = true;
          this.points.material.opacity = Math.max(0, 1 - this.t / dur);
          if (this.t >= dur) { this.done = true; if (this.onDone) try { this.onDone(); } catch (_) {} }
        },
      };
      bursts.push(b); return b;
    }

    // ---- stage 5: EMERGE -> particles gather at the portal then resolve onto the
    // walker's volume (reassembly). The caller fades the walker IN over the same window.
    function emergeFrom(gate, walker, opts) {
      const root = sceneRoot(); if (!root || !gate || !walker) return null;
      opts = opts || {};
      const N = opts.count || 520, dur = opts.dur || 0.8;
      const end = sampleWalker(walker, N);                      // where the body will be
      const { centre, fwd } = gateFrame(gate);
      // start: a tight cloud just in front of the portal, drifting outward
      const start = []; for (let i = 0; i < N; i++) start.push(centre.clone().add(fwd.clone().multiplyScalar(0.1 + Math.random() * 0.3)).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.4, 0)));
      const pts = makePoints(start, opts.size || 0.3); root.add(pts);
      const delay = start.map(() => Math.random() * 0.2);
      const b = {
        points: pts, t: 0, dur, done: false, onDone: opts.onDone,
        step(dt) {
          this.t += dt; const a = this.points.geometry.attributes.position.array;
          for (let i = 0; i < N; i++) {
            const lt = Math.max(0, this.t - delay[i]) / dur;
            const e = lt >= 1 ? 1 : lt * lt * (3 - 2 * lt);    // smoothstep settle onto the body
            const s = start[i], tg = end[i];
            a[i * 3] = s.x + (tg.x - s.x) * e;
            a[i * 3 + 1] = s.y + (tg.y - s.y) * e;
            a[i * 3 + 2] = s.z + (tg.z - s.z) * e;
          }
          this.points.geometry.attributes.position.needsUpdate = true;
          this.points.material.opacity = Math.max(0, 1 - Math.max(0, this.t - dur + 0.25) / 0.25);
          if (this.t >= dur + 0.05) { this.done = true; if (this.onDone) try { this.onDone(); } catch (_) {} }
        },
      };
      bursts.push(b); return b;
    }

    // driven by 56's rAF loop (single shared tick, no second rAF here).
    function _tick(dt) {
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i]; b.step(dt);
        if (b.done) { disposeBurst(b); bursts.splice(i, 1); }
      }
    }

    window.__tinyworldGateTravelFX = { dissolveInto, extrudeBack, emergeFrom, _tick, _active: () => bursts.length };
  })();
