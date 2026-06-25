  // -------- grazing animal animation --------
  // Cow/sheep meshes built by makeVoxelAnimal (09b) register here. Each frame the grazer
  // swings their legs, bobs the body and dips the head, and lets them amble a short
  // distance within their home tile before stopping to graze again — so a meadow of
  // animals feels alive. Movement is purely cosmetic (a small wander around the tile the
  // animal was placed on); the grid/harvest model is untouched.
  //
  // Driven from the main loop in 25-animation-loop-schema.js via window.__tinyworldAnimalTick.
  (function wireAnimalAnimation() {
    'use strict';
    if (typeof window === 'undefined') return;

    const herd = new Set();

    function register(group) {
      const st = group && group.userData && group.userData.anim;
      if (!st) return;
      st.homeSet = false;            // home captured lazily, after the tile renderer positions it
      st.phase = 'graze';
      st.timer = 0.4 + Math.random() * 1.8;
      st.walkPhase = Math.random() * Math.PI * 2;
      st.heading = group.rotation.y || 0;
      st.targetHeading = st.heading;
      st.tx = 0; st.tz = 0;
      st.dip = 0;
      herd.add(group);
    }

    const R = 0.26;       // wander radius in world units — keeps the animal inside its 1-unit tile
    const SPEED = 0.3;    // amble speed (units/sec)

    function tick(t, dt) {
      if (!dt || !herd.size) return;
      for (const g of herd) {
        const st = g && g.userData && g.userData.anim;
        if (!g.parent || !st) { herd.delete(g); continue; }   // mesh removed / re-rendered → drop it
        if (!st.homeSet) {
          st.homeX = g.position.x; st.homeZ = g.position.z;
          st.tx = g.position.x; st.tz = g.position.z;
          st.homeSet = true;
        }

        st.timer -= dt;
        if (st.phase === 'graze') {
          st.dip += (1 - st.dip) * Math.min(1, dt * 4);       // ease the head down to nibble
          if (st.timer <= 0) {                                 // pick a new spot to amble to
            const a = Math.random() * Math.PI * 2;
            const r = R * (0.35 + Math.random() * 0.65);
            st.tx = st.homeX + Math.cos(a) * r;
            st.tz = st.homeZ + Math.sin(a) * r;
            st.targetHeading = Math.atan2(st.tx - g.position.x, st.tz - g.position.z);
            st.phase = 'walk';
            st.timer = 1.0 + Math.random() * 1.6;
          }
        } else {                                               // walking
          st.dip += (0 - st.dip) * Math.min(1, dt * 6);        // lift the head back up
          const dx = st.tx - g.position.x, dz = st.tz - g.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.01) {
            const stepLen = Math.min(dist, SPEED * dt);
            g.position.x += (dx / dist) * stepLen;
            g.position.z += (dz / dist) * stepLen;
            st.walkPhase += dt * 9;
          }
          if (dist <= 0.02 || st.timer <= 0) {                 // arrived / gave up → graze
            st.phase = 'graze';
            st.timer = 1.6 + Math.random() * 2.6;
          }
        }

        // ease the facing toward the walk direction
        let dh = st.targetHeading - st.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        st.heading += dh * Math.min(1, dt * 5);
        g.rotation.y = st.heading;

        // pose the moving parts
        const walking = st.phase === 'walk';
        const swing = walking ? Math.sin(st.walkPhase) * 0.5 : 0;
        const legs = st.legs || [];
        for (let i = 0; i < legs.length; i++) {
          const diag = (i === 0 || i === 3) ? 1 : -1;          // diagonal gait
          legs[i].rotation.x = swing * diag;
        }
        if (st.body) st.body.position.y = walking ? Math.abs(Math.sin(st.walkPhase)) * 0.02 : 0;
        if (st.head) st.head.rotation.z = -st.dip * 0.7;
      }
    }

    window.__tinyworldRegisterAnimal = register;
    window.__tinyworldAnimalTick = tick;
  })();
