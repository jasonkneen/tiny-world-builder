  // -------- CCTV / "Truman Show" surveillance feeds --------
  // A set of in-world security cameras. Each camera renders the live scene from
  // its own viewpoint into a small low-res render target, then a CRT/VHS shader
  // turns that into a black-and-white surveillance picture with scanlines, a
  // rolling interference bar, static, vignette, and a baked caption (camera name +
  // live date/time + a blinking REC dot). Cameras idle-sweep until a subject
  // (avatar) moves nearby, then pan to LOOK AT the subject — the whole rig reads
  // like the hidden cameras in The Truman Show.
  //
  // The physical monitors flank the lobby presentation screen (both sides) plus a
  // "PUMPKINCAM" and a couple of "TREECAM"s out in the world. The big lobby screen
  // can also cut to these feeds between slides (see 58-lobby-presentation.js).
  //
  // Exposed as window.__tinyworldCCTV.{addCamera,removeCamera,buildMonitor,feeds,
  //   feed,setSubjectsProvider,setEnabled,tick,show,hide,clear,monitorMaterialFor}.
  // IIFE — no top-level identifiers leak into the shared global scope, and the
  // 4-space body indent keeps locals out of the duplicate-declaration guard.
  (function cctvTrumanBoot() {
    'use strict';
    if (typeof window === 'undefined' || typeof THREE === 'undefined') return;

    // ---- tunables ----
    const FEED_W = 224, FEED_H = 168;          // low-res CCTV capture (4:3)
    const CAP_W = 256, CAP_H = 192;            // caption overlay canvas
    const CAPTURES_PER_FRAME = 1;              // round-robin: how many feeds refresh per frame
    const FEED_FPS = 12;                       // each feed re-captures at most this often
    const TRACK_RANGE = 7.0;                   // subject must be within this (world units) to be watched
    const TRACK_LERP = 0.06;                   // how fast the camera swings to the subject
    const IDLE_LERP = 0.018;                   // idle sweep return speed
    const SIGNAL_RECOVER = 0.8;                // how fast signal health climbs back to 1
    const ACTIVITY_DECAY = 0.55;               // per-second decay of a feed's activity score

    const cams = [];                           // ordered feed list (round-robin capture)
    const camById = new Map();
    let enabled = false;
    let rrIndex = 0;
    let subjectsProvider = null;               // () => [{ pos:Vector3, name?:string }]
    const _v = new THREE.Vector3();
    const _v2 = new THREE.Vector3();
    const _target = new THREE.Vector3();

    function rendererRef() { return (typeof renderer !== 'undefined' && renderer) ? renderer : null; }
    function sceneRef() { return (typeof scene !== 'undefined' && scene) ? scene : null; }

    // ---- CRT / surveillance shader ----------------------------------------
    // Black-and-white, scanlines, rolling bar, static, vignette, signal dropout,
    // plus a caption overlay composited from a 2D canvas (name / date / REC).
    const CCTV_VERT = [
      'varying vec2 vUv;',
      'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    ].join('\n');

    const CCTV_FRAG = [
      'precision highp float;',
      'uniform sampler2D tFeed;',
      'uniform sampler2D tCaption;',
      'uniform float uTime;',
      'uniform float uSignal;',   // 0 = pure static, 1 = clean
      'uniform float uTint;',     // 0 = neutral grey, 1 = cool security-monitor tint
      'varying vec2 vUv;',
      'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }',
      'void main(){',
      '  vec2 uv = vUv;',
      '  float sig = clamp(uSignal, 0.0, 1.0);',
      '  // horizontal tracking jitter, worse when signal is weak',
      '  float line = floor(uv.y * 140.0);',
      '  float jitter = (hash(vec2(line, floor(uTime*14.0))) - 0.5) * 0.010 * (1.25 - sig);',
      '  uv.x += jitter;',
      '  vec3 c = texture2D(tFeed, uv).rgb;',
      '  float lum = dot(c, vec3(0.299, 0.587, 0.114));',
      '  lum = pow(clamp(lum, 0.0, 1.0), 0.90);',
      '  // scanlines',
      '  lum *= 0.82 + 0.18 * sin(vUv.y * 880.0);',
      '  // slow rolling interference bar',
      '  float roll = fract(vUv.y + uTime * 0.13);',
      '  float bar = smoothstep(0.0, 0.05, roll) * (1.0 - smoothstep(0.05, 0.11, roll));',
      '  lum += bar * 0.14;',
      '  // static noise',
      '  float n = hash(vUv * vec2(620.0, 470.0) + uTime * 57.0);',
      '  lum += (n - 0.5) * 0.13 * (1.35 - sig);',
      '  // signal dropout -> dissolve toward static',
      '  lum = mix(n, lum, sig);',
      '  // vignette + rounded-tube darkening',
      '  vec2 d = vUv - 0.5;',
      '  lum *= smoothstep(0.86, 0.33, length(d));',
      '  vec3 col = vec3(lum);',
      '  col *= mix(vec3(1.0), vec3(0.86, 0.95, 1.0), uTint);',
      '  // caption overlay (white text, premultiplied alpha in canvas)',
      '  vec4 cap = texture2D(tCaption, vUv);',
      '  col = mix(col, vec3(1.0), cap.a * 0.94);',
      '  gl_FragColor = vec4(col, 1.0);',
      '  #include <encodings_fragment>',
      '}',
    ].join('\n');

    function makeCaptionCanvas(name) {
      const cv = document.createElement('canvas');
      cv.width = CAP_W; cv.height = CAP_H;
      const cx = cv.getContext('2d');
      const tex = new THREE.CanvasTexture(cv);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      return { cv, cx, tex, name: name || 'CAM' };
    }

    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function drawCaption(cap, recOn) {
      const cx = cap.cx;
      cx.clearRect(0, 0, CAP_W, CAP_H);
      cx.font = '700 13px "Space Grotesk", monospace';
      cx.textBaseline = 'top';
      // thin frame brackets (corners) for that targeting-overlay feel
      cx.strokeStyle = 'rgba(255,255,255,0.85)';
      cx.lineWidth = 2;
      const m = 8, L = 16;
      const corner = (x, y, dx, dy) => {
        cx.beginPath();
        cx.moveTo(x + dx * L, y); cx.lineTo(x, y); cx.lineTo(x, y + dy * L);
        cx.stroke();
      };
      corner(m, m, 1, 1); corner(CAP_W - m, m, -1, 1);
      corner(m, CAP_H - m, 1, -1); corner(CAP_W - m, CAP_H - m, -1, -1);
      // camera name (top-left)
      cx.fillStyle = 'rgba(255,255,255,0.96)';
      cx.fillText(cap.name, m + 8, m + 4);
      // REC dot + label (top-right)
      const rx = CAP_W - m - 8;
      cx.textAlign = 'right';
      cx.fillStyle = recOn ? 'rgba(255,80,72,0.98)' : 'rgba(255,80,72,0.18)';
      cx.fillText('REC', rx, m + 4);
      if (recOn) { cx.beginPath(); cx.arc(rx - 34, m + 11, 4, 0, Math.PI * 2); cx.fill(); }
      cx.textAlign = 'left';
      // date / time (bottom-left), live
      const now = new Date();
      const date = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
      const time = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
      cx.font = '600 12px "Space Grotesk", monospace';
      cx.fillStyle = 'rgba(255,255,255,0.92)';
      cx.fillText(date + '  ' + time, m + 8, CAP_H - m - 16);
      cap.tex.needsUpdate = true;
    }

    function makeMonitorMaterial(feed) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          tFeed: { value: feed.rt.texture },
          tCaption: { value: feed.caption.tex },
          uTime: { value: 0 },
          uSignal: { value: 1 },
          uTint: { value: 1 },
        },
        vertexShader: CCTV_VERT,
        fragmentShader: CCTV_FRAG,
        toneMapped: false,
        depthWrite: true,
      });
      mat.userData.windowLightEffect = true;   // skip fade-material replacement (skill: render-perf)
      mat.userData.lightVisual = true;
      return mat;
    }

    // ---- camera + feed -----------------------------------------------------
    // opts: { id, name, pos:[x,y,z], look:[x,y,z], fov, sweep:{yaw,pitch,speed}, tint }
    function addCamera(opts) {
      opts = opts || {};
      const id = opts.id || ('cam' + (cams.length + 1));
      if (camById.has(id)) return camById.get(id);
      const cam = new THREE.PerspectiveCamera(opts.fov || 46, FEED_W / FEED_H, 0.05, 600);
      const pos = opts.pos || [0, 3, 0];
      cam.position.set(pos[0], pos[1], pos[2]);
      const look = opts.look || [0, 1, 0];
      const rt = new THREE.WebGLRenderTarget(FEED_W, FEED_H, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        depthBuffer: true,
        stencilBuffer: false,
      });
      rt.texture.generateMipmaps = false;
      const caption = makeCaptionCanvas(opts.name || id.toUpperCase());
      const feed = {
        id,
        name: caption.name,
        cam,
        rt,
        caption,
        homeLook: new THREE.Vector3(look[0], look[1], look[2]),
        curLook: new THREE.Vector3(look[0], look[1], look[2]),
        sweep: opts.sweep || { yaw: 0.55, pitch: 0.10, speed: 0.35 },
        tint: opts.tint == null ? 1 : opts.tint,
        signal: 1,
        activity: 0,
        watching: false,
        watchName: null,
        phase: Math.random() * Math.PI * 2,
        materials: [],          // monitor materials bound to this feed (for uniform updates)
        _capAccum: 999,         // force a capture on first tick
        _recT: 0,
      };
      cam.lookAt(feed.curLook);
      cams.push(feed);
      camById.set(id, feed);
      return feed;
    }

    function removeCamera(id) {
      const feed = camById.get(id);
      if (!feed) return;
      const i = cams.indexOf(feed);
      if (i >= 0) cams.splice(i, 1);
      camById.delete(id);
      try { feed.rt.dispose(); } catch (_) {}
      try { feed.caption.tex.dispose(); } catch (_) {}
      feed.materials.forEach((m) => { try { m.dispose(); } catch (_) {} });
    }

    function clear() { cams.slice().forEach((f) => removeCamera(f.id)); }

    function feed(id) { return camById.get(id) || null; }
    function feeds() { return cams.slice(); }

    // Build a physical monitor mesh (bezel + screen) bound to a feed. Returns a
    // THREE.Group you can position/rotate and add to any parent. width in world
    // units; height derives from the 4:3 feed.
    function buildMonitor(feedOrId, opts) {
      opts = opts || {};
      const f = (typeof feedOrId === 'string') ? feed(feedOrId) : feedOrId;
      if (!f) return null;
      const W = opts.width || 1.1;
      const H = W * FEED_H / FEED_W;
      const g = new THREE.Group();
      g.name = 'cctv-monitor-' + f.id;
      const bezel = new THREE.Mesh(
        new THREE.BoxGeometry(W + 0.12, H + 0.12, 0.10),
        new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.8, metalness: 0.2 }));
      bezel.position.z = -0.055;
      bezel.castShadow = false; bezel.receiveShadow = false;
      g.add(bezel);
      const mat = makeMonitorMaterial(f);
      mat.uniforms.uTint.value = f.tint;
      f.materials.push(mat);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
      screen.name = 'cctv-screen-' + f.id;
      g.add(screen);
      g.userData.cctvFeedId = f.id;
      return g;
    }

    // Material for an external surface (e.g. the big lobby screen) to show a feed.
    function monitorMaterialFor(feedOrId, opts) {
      const f = (typeof feedOrId === 'string') ? feed(feedOrId) : feedOrId;
      if (!f) return null;
      const mat = makeMonitorMaterial(f);
      mat.uniforms.uTint.value = (opts && opts.tint != null) ? opts.tint : f.tint;
      f.materials.push(mat);
      return mat;
    }

    function setSubjectsProvider(fn) { subjectsProvider = (typeof fn === 'function') ? fn : null; }
    function setEnabled(on) { enabled = !!on; }
    function show() { enabled = true; }
    function hide() { enabled = false; }

    // The feed with the most live activity (a moving subject in frame), or null if
    // everything is quiet. Used by the lobby screen to auto-cut to the "hot" cam.
    function activeFeed(minActivity) {
      const thresh = (minActivity == null) ? 0.25 : minActivity;
      let best = null;
      for (const f of cams) {
        if (f.activity >= thresh && (!best || f.activity > best.activity)) best = f;
      }
      return best;
    }
    // All feeds sorted by activity desc (for round-robin biasing).
    function feedsByActivity() { return cams.slice().sort((a, b) => b.activity - a.activity); }

    // ---- per-feed aim logic (idle sweep <-> look at nearest MOVING subject) -
    // "Truman" behaviour: a camera prefers the subject that is actually MOVING
    // near it. Each feed accumulates an activity score that decays over time and
    // spikes when its watched subject moves — so the lobby auto-cut can pick the
    // feed where something is happening.
    function aim(f, t, dt) {
      // gather candidate subjects; weight by proximity AND recent movement
      let best = null, bestScore = 0;
      if (subjectsProvider) {
        let subs = null;
        try { subs = subjectsProvider(); } catch (_) { subs = null; }
        if (subs && subs.length) {
          for (const s of subs) {
            if (!s || !s.pos) continue;
            const d = f.cam.position.distanceTo(s.pos);
            if (d > TRACK_RANGE) continue;
            // per-subject movement since last frame (tracked on the feed by name key)
            const key = s.name || ('s' + (subs.indexOf(s)));
            const prev = f._subPrev && f._subPrev[key];
            let moved = 0;
            if (prev) moved = Math.min(1.5, prev.distanceTo(s.pos) / Math.max(dt, 1e-3) * 0.25);
            const prox = 1 - (d / TRACK_RANGE);            // 0..1, nearer = higher
            const score = prox * 0.6 + moved * 1.0;        // movement dominates
            if (score > bestScore) { bestScore = score; best = s; }
          }
          // remember positions for next-frame movement detection
          f._subPrev = f._subPrev || {};
          const seen = {};
          for (const s of subs) {
            if (!s || !s.pos) continue;
            const key = s.name || ('s' + (subs.indexOf(s)));
            seen[key] = 1;
            if (!f._subPrev[key]) f._subPrev[key] = s.pos.clone();
            else f._subPrev[key].copy(s.pos);
          }
          for (const k in f._subPrev) if (!seen[k]) delete f._subPrev[k];
        }
      }
      if (best) {
        // Truman: swing to look at the subject (aim slightly above ground = torso/head)
        _target.copy(best.pos); _target.y += 0.7;
        f.curLook.lerp(_target, TRACK_LERP);
        f.watching = true;
        f.watchName = best.name || 'SUBJECT';
        // activity spikes with the winning score; clamped and smoothed
        f.activity = Math.min(1, Math.max(f.activity, bestScore));
      } else {
        // idle sweep around the home look direction
        f.phase += dt * (f.sweep.speed || 0.35);
        const yaw = Math.sin(f.phase) * (f.sweep.yaw || 0.5);
        const pitch = Math.sin(f.phase * 0.6) * (f.sweep.pitch || 0.1);
        _v.copy(f.homeLook).sub(f.cam.position);          // base direction
        const len = _v.length() || 1;
        _v.normalize();
        const yawAxis = new THREE.Vector3(0, 1, 0);
        _v.applyAxisAngle(yawAxis, yaw);
        // pitch around the camera's local right axis
        _v2.crossVectors(_v, yawAxis).normalize();
        _v.applyAxisAngle(_v2, pitch);
        _v.multiplyScalar(len).add(f.cam.position);
        f.curLook.lerp(_v, IDLE_LERP);
        f.watching = false;
        f.watchName = null;
      }
      // activity always decays so "hot" reflects what's happening NOW
      f.activity = Math.max(0, f.activity - dt * ACTIVITY_DECAY);
      f.cam.lookAt(f.curLook);
    }

    // ---- frame tick --------------------------------------------------------
    // Called from the animation loop BEFORE renderScene() so feeds captured this
    // frame appear in the same frame. Round-robins captures to spread GPU cost.
    function tick(t, dt) {
      if (!enabled || !cams.length) return;
      const r = rendererRef(), sc = sceneRef();
      // update shader uniforms + captions on every feed every frame (cheap)
      for (const f of cams) {
        f.signal = Math.min(1, f.signal + dt * SIGNAL_RECOVER);
        f._recT += dt;
        const recOn = (f._recT % 1.2) < 0.85;
        // caption text only needs ~2 Hz
        f._capAccum2 = (f._capAccum2 || 0) + dt;
        if (f._capAccum2 > 0.45) { f._capAccum2 = 0; drawCaption(f.caption, recOn); }
        for (const m of f.materials) {
          if (!m || !m.uniforms) continue;
          m.uniforms.uTime.value = t;
          m.uniforms.uSignal.value = f.signal;
        }
        aim(f, t, dt);
      }
      if (!r || !sc) return;
      // round-robin: re-capture a small number of feeds this frame
      const prevRT = r.getRenderTarget();
      let captured = 0;
      for (let k = 0; k < cams.length && captured < CAPTURES_PER_FRAME; k++) {
        const f = cams[rrIndex % cams.length];
        rrIndex++;
        f._capAccum += dt;
        if (f._capAccum < (1 / FEED_FPS)) continue;
        f._capAccum = 0;
        try {
          r.setRenderTarget(f.rt);
          r.render(sc, f.cam);
        } catch (_) {}
        captured++;
      }
      r.setRenderTarget(prevRT);
    }

    // Force a brief signal glitch (e.g. when a camera cuts in on the big screen).
    function glitch(id, amount) {
      const f = camById.get(id);
      if (f) f.signal = Math.max(0, Math.min(f.signal, 1 - (amount == null ? 0.7 : amount)));
    }

    window.__tinyworldCCTV = {
      addCamera, removeCamera, clear,
      buildMonitor, monitorMaterialFor,
      feed, feeds,
      setSubjectsProvider, setEnabled, show, hide,
      activeFeed, feedsByActivity,
      glitch, tick,
      FEED_W, FEED_H,
    };

    // ---- standalone visual-QA demo: ?cctv=demo ----------------------------
    // Drops a ring of monitors near origin watching a bobbing test subject, so the
    // CRT look can be verified without entering a multiplayer room.
    try {
      const q = new URLSearchParams(location.search);
      const demo = q.get('cctv');
      if (demo === 'demo' || demo === '1') {
        window.addEventListener('load', () => setTimeout(() => {
          const sc = sceneRef(); if (!sc) return;
          const subject = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 1.2, 0.5),
            new THREE.MeshStandardMaterial({ color: 0xff5544 }));
          subject.position.set(0, 0.6, 0);
          sc.add(subject);
          const specs = [
            { id: 'pumpkincam', name: 'PUMPKINCAM', pos: [3.2, 2.4, 3.2], look: [0, 0.7, 0] },
            { id: 'treecam-1', name: 'TREECAM 01', pos: [-3.5, 2.6, 2.6], look: [0, 0.7, 0] },
            { id: 'lobby-l', name: 'LOBBY-L', pos: [-2.4, 2.0, -3.4], look: [0, 0.7, 0] },
            { id: 'lobby-r', name: 'LOBBY-R', pos: [2.4, 2.0, -3.4], look: [0, 0.7, 0] },
          ];
          specs.forEach((s, i) => {
            const f = addCamera(s);
            const mon = buildMonitor(f, { width: 1.3 });
            const ang = (i / specs.length) * Math.PI * 2;
            mon.position.set(Math.cos(ang) * 1.8, 2.4, Math.sin(ang) * 1.8);
            mon.lookAt(new THREE.Vector3(0, 2.4, 0));
            sc.add(mon);
          });
          setSubjectsProvider(() => ([{ pos: subject.position, name: 'TEST-SUBJECT' }]));
          setEnabled(true);
          // bob the subject so tracking + activity response is visible
          let _t0 = 0;
          (function bob() {
            _t0 += 0.016;
            subject.position.x = Math.sin(_t0 * 0.7) * 2.2;
            subject.position.z = Math.cos(_t0 * 0.5) * 2.2;
            requestAnimationFrame(bob);
          })();
          // self-drive the tick in case the loop wiring isn't present yet
          let _pt = performance.now();
          (function driveTick() {
            const now = performance.now();
            const dt = Math.min(0.05, (now - _pt) / 1000); _pt = now;
            try { tick(now / 1000, dt); } catch (_) {}
            requestAnimationFrame(driveTick);
          })();
          console.log('[cctv] demo active — 4 feeds watching the test subject');
        }, 800));
      }
    } catch (_) {}
  })();
