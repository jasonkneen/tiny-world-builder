  // -------- skyfall: walk off the floating island -> freefall -> rings -> parachute --------
  // The PURE simulation core for the freefall minigame. No THREE, no DOM, no globals other
  // than the one exposed object — so it is fully unit-testable headless (gravity integration,
  // ring-pass detection, parachute-earn, landing) independently of the live rendering/input,
  // which lives in 47-worlds-room.js (camera follow, torus ring meshes, steering keys, HUD).
  //
  // Coordinate frame: the sim works in the AVATAR-PARENT local frame (the same frame
  // selfEnt.sprite.position lives in), so 47 can seed it from the avatar's current position
  // and read positions straight back onto the sprite + ring meshes with no conversion. Y is
  // up; freefall decreases Y. IIFE-wrapped (tools/check.js forbids duplicate top-level names).
  (function skyfallBoot() {
    'use strict';
    if (typeof window === 'undefined') return;

    // deterministic PRNG (same LCG as 53) so a given seed yields the SAME ring course on
    // every client — important if the course is ever shared/raced in multiplayer.
    function makePrng(seed) {
      let s = ((seed >>> 0) ^ 0x9e3779b9) >>> 0;
      return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
    }

    // ---- tunables. These are the LIVE-TUNE knobs (feel must be judged in the running game):
    // fall speed, steer authority, ring spacing/size, and the earn threshold. Units = tiles.
    const CFG = {
      gravity: 5.8,          // downward accel in freefall (tiles/s^2)
      termVel: 7.2,          // freefall terminal velocity (tiles/s)
      thrustAccel: 16.0,     // ROCKET-PACK upward accel while SPACE is held (once earned)
      thrustMax: 3.4,        // max upward speed the rocket pack can reach (tiles/s)
      fuel: 3.0,             // seconds of thrust the pack holds — depletes while thrusting, so
                             // you can SLOW your descent for a soft landing but never hover
                             // forever (empty pack -> you fall and land; no stuck state)
      steer: 14.0,           // horizontal steer accel (tiles/s^2)
      steerMax: 7.0,         // max horizontal speed in freefall (tiles/s)
      drag: 1.55,            // horizontal damping (per s) so you can stop drifting
      ringCount: 6,          // rings in a course
      ringRadius: 2.05,      // pass radius (tiles) — generous so it's hittable
      ringTube: 0.18,        // visual tube thickness (used by 47's mesh; harmless here)
      ringGapY: 8.0,         // vertical spacing between rings (tiles)
      ringStep: 2.2,         // max horizontal move from the PREVIOUS ring (keeps the course
                             // reachable: must be clearable within ringGapY/termVel of fall)
      ringSpread: 5.2,       // overall horizontal bound of the course from the drop column
      firstRingDrop: 9.0,    // distance below the start to the first ring (tiles)
      firstRingLead: 1.35,   // first target leads the initial leap drift, not a random backtrack
      earnThreshold: 4,      // rings to pass to EARN the rocket pack
      groundDrop: 62.0,      // distance below the start that counts as "ground" — tuned to the
                             // poser-surface landscape (attached at worldGroup y=-60) so the
                             // fall lands ON the revealed islands, not in empty void
      launchOut: 2.2,        // initial OUTWARD speed off the edge (tiles/s) so the body clears
                             // the island and falls in open air rather than through the rim
    };

    // Build a seeded course of rings descending from a start column. Each ring is offset to
    // a fresh random direction so the faller must steer; the offsets are bounded by ringSpread
    // and reachable within steerMax over ringGapY of fall, so a skilled run can clear them.
    function clampCoursePoint(sx, sz, point) {
      const dxc = point.x - sx, dzc = point.z - sz, dc = Math.hypot(dxc, dzc);
      if (dc > CFG.ringSpread) { point.x = sx + dxc / dc * CFG.ringSpread; point.z = sz + dzc / dc * CFG.ringSpread; }
    }
    function buildCourse(sx, sz, startY, seed, opts) {
      opts = opts || {};
      const r = makePrng(seed || 1);
      const rings = [];
      let y = startY - CFG.firstRingDrop;
      let cx = sx, cz = sz;                       // current course column, walked step-by-step
      const dirLen = Math.hypot(opts.dirX || 0, opts.dirZ || 0);
      const outX = dirLen > 0 ? opts.dirX / dirLen : 0;
      const outZ = dirLen > 0 ? opts.dirZ / dirLen : 0;
      const sideX = outZ, sideZ = -outX;
      for (let i = 0; i < CFG.ringCount; i++) {
        if (i === 0 && dirLen > 0) {
          // The fall starts with outward launch velocity, so the first ring leads that drift
          // instead of spawning randomly behind the player before steering has taken effect.
          const lead = CFG.firstRingLead + r() * 0.55;
          const side = (r() - 0.5) * CFG.ringStep;
          cx += outX * lead + sideX * side;
          cz += outZ * lead + sideZ * side;
        } else {
          // step the column by a bounded REACHABLE delta in a random direction, so each ring
          // is clearable from the previous within the fall time between them (the no-path bug
          // was independent ±ringSpread offsets that could sit ~2*spread apart horizontally).
          const ang = r() * Math.PI * 2;
          const step = CFG.ringStep * (0.5 + 0.5 * r());
          cx += Math.cos(ang) * step;
          cz += Math.sin(ang) * step;
        }
        // keep the whole course within an overall spread so it never wanders off-camera.
        const pt = { x: cx, z: cz };
        clampCoursePoint(sx, sz, pt);
        cx = pt.x; cz = pt.z;
        rings.push({ x: cx, y, z: cz, r: CFG.ringRadius, passed: false, missed: false });
        y -= CFG.ringGapY;
      }
      return rings;
    }

    // Create a sim instance. opts: { x, z, y, seed, dirX, dirZ }. Returns { state, rings, tick, cfg }.
    function createSim(opts) {
      opts = opts || {};
      const startY = (opts.y != null) ? opts.y : 0;
      const sx = opts.x || 0, sz = opts.z || 0;
      const dirLen = Math.hypot(opts.dirX || 0, opts.dirZ || 0);
      const dirX = dirLen > 0 ? opts.dirX / dirLen : 0;
      const dirZ = dirLen > 0 ? opts.dirZ / dirLen : 0;
      const rings = buildCourse(sx, sz, startY, opts.seed, { dirX, dirZ });
      const st = {
        x: sx, y: startY, z: sz,
        vx: dirX * CFG.launchOut, vz: dirZ * CFG.launchOut, vy: 0,   // outward launch off the edge
        phase: 'freefall',         // 'freefall' | 'rocket' | 'landed'
        ringsPassed: 0, rocket: false, thrusting: false, fuel: CFG.fuel, done: false, landed: false,
        rings, startY, groundY: startY - CFG.groundDrop, _prevY: startY,
      };
      function tick(dt, input) {
        if (st.done) return st;
        dt = Math.min(dt || 0, 0.05);
        input = input || {};
        // horizontal steer + drag
        st.vx += (input.x || 0) * CFG.steer * dt;
        st.vz += (input.z || 0) * CFG.steer * dt;
        st.vx -= st.vx * Math.min(1, CFG.drag * dt);
        st.vz -= st.vz * Math.min(1, CFG.drag * dt);
        const hs = Math.hypot(st.vx, st.vz), hmax = CFG.steerMax;
        if (hs > hmax) { st.vx = st.vx / hs * hmax; st.vz = st.vz / hs * hmax; }
        st.x += st.vx * dt; st.z += st.vz * dt;
        // vertical: gravity always pulls down to terminal velocity; once the ROCKET PACK is
        // earned, holding thrust (space) fires it UPWARD to slow/arrest/reverse the descent.
        st.thrusting = !!(st.rocket && input.thrust && st.fuel > 0);
        if (st.thrusting) st.fuel = Math.max(0, st.fuel - dt);   // burn fuel; empty -> can't thrust
        st.vy -= CFG.gravity * dt;
        if (st.thrusting) st.vy += CFG.thrustAccel * dt;
        if (st.vy < -CFG.termVel) st.vy = -CFG.termVel;
        if (st.vy > CFG.thrustMax) st.vy = CFG.thrustMax;
        st._prevY = st.y;
        st.y += st.vy * dt;
        // ring pass: descended through a ring's Y plane this tick AND within its radius
        for (const rg of st.rings) {
          if (rg.passed) continue;
          if (st._prevY >= rg.y && st.y <= rg.y) {
            const dx = st.x - rg.x, dz = st.z - rg.z;
            if (Math.hypot(dx, dz) <= rg.r) { rg.passed = true; st.ringsPassed++; }
            else rg.missed = true;
          }
        }
        // earn the ROCKET PACK -> enables SPACE thrust (does NOT auto-slow; the player controls it)
        if (!st.rocket && st.ringsPassed >= CFG.earnThreshold) {
          st.rocket = true; st.phase = 'rocket';
        }
        // land
        if (st.y <= st.groundY) {
          st.y = st.groundY; st.landed = true; st.done = true; st.phase = 'landed'; st.vy = 0;
        }
        return st;
      }
      return { state: st, rings, tick, cfg: CFG };
    }

    window.__tinyworldSkyfall = { createSim, buildCourse, CFG };
  })();
