  // -------- lobby presentation: an in-world screen that shows slides --------
  // A framed "presentation screen" stands at the edge of the world, facing the
  // board center, so players can congregate in the lobby and watch slides. The
  // deck is plain canvas-rendered text (editable via setSlides); slide changes
  // sync across clients in a later pass — for now every client builds the same
  // screen and defaults to slide 0, so the welcome board is already watchable.
  //
  // Exposed as window.__tinyworldLobby.{show,hide,build,setSlides,next,prev,go,group}.
  // Built/shown when entering a world room (WS 'enter'), hidden on 'leave'.
  // IIFE — no top-level identifiers leak into the shared global scope.
  (function lobbyPresentationBoot() {
    'use strict';
    if (typeof window === 'undefined' || typeof THREE === 'undefined') return;

    const WS = (window.__tinyworldWorlds = window.__tinyworldWorlds || {});

    // ---- default deck (placeholders; replace via window.__tinyworldLobby.setSlides) ----
    let SLIDES = [
      { title: 'TinyWorld', sub: 'Build. Explore. Gather. Together.', bullets: [] },
      { title: 'Welcome to the Lobby', bullets: [
        'This is where players join and congregate',
        'Wander, chat, and meet others in real time',
        'Watch presentations right here on this screen',
      ] },
      { title: 'What You Can Do', bullets: [
        'Build worlds tile by tile',
        'Fly down to the islands and explore the surface',
        'Harvest, craft, and climb the tech tree',
      ] },
      { title: 'Roadmap', bullets: [
        'Multiplayer lobby + live presentations  (now)',
        'AI-driven companions you can actually talk to  (next)',
        'Shared events and scheduled live sessions',
      ] },
      { title: 'Get Started', bullets: [
        'Open the chat panel and say hello',
        'Move your avatar to gather near the screen',
        'A host can advance these slides for everyone',
      ] },
    ];

    let idx = 0, group = null, canvas = null, ctx = null, tex = null, built = false, controls = null;
    let screenMesh = null, slideMat = null;       // the display plane + its slide material
    // ---- live-feed cycling (Truman-style auto-cut between slides and cam feeds) ----
    // When cameras are mounted, the screen alternates: a run of slides, then it cuts
    // to whichever CCTV feed currently has the most ACTIVITY (a moving subject), then
    // back to slides. A brief signal glitch sells each cut.
    let cycleOn = true, cyclePhase = 'slides', cycleT = 0, liveFeedId = null, liveMat = null;
    const SLIDE_DWELL = 9.0;      // seconds of slides before considering a cam cut
    const FEED_DWELL = 6.0;       // seconds to hold a live cam feed
    let _autoAdvT = 0;
    const AUTO_ADVANCE = 7.0;     // auto-advance slides while presenting (host-free ambience)

    function parentNode() {
      if (typeof worldGroup !== 'undefined' && worldGroup) return worldGroup;
      if (typeof xrWorldRoot !== 'undefined' && xrWorldRoot) return xrWorldRoot;
      return (typeof scene !== 'undefined') ? scene : null;
    }
    function screenZ() {                                   // ON the board, a few rows in from the north edge
      const g = (typeof GRID !== 'undefined' && GRID) ? GRID : 8;
      return -(g / 2) + 1.0;                               // just inside the north edge so posts land on tiles
    }
    // Ground height under (x,z) so the rig plants on the board, not in mid-air.
    function groundYAt(x, z) {
      const cx = Math.round(x + ((typeof GRID !== 'undefined' && GRID) ? GRID : 8) / 2 - 0.5);
      const cz = Math.round(z + ((typeof GRID !== 'undefined' && GRID) ? GRID : 8) / 2 - 0.5);
      if (typeof voxelGroundY === 'function') { try { return voxelGroundY(cx, cz) || 0; } catch (_) {} }
      if (typeof cellMeshes !== 'undefined' && cellMeshes) {
        const cm = cellMeshes[cx + ',' + cz];
        if (cm && cm.tile && typeof THREE !== 'undefined') {
          try { return new THREE.Box3().setFromObject(cm.tile).max.y || 0; } catch (_) {}
        }
      }
      return 0;
    }

    // ---- canvas slide renderer ----
    const SW = 1024, SH = 576;
    function renderSlide() {
      if (!ctx) return;
      const s = SLIDES[idx] || { title: '', bullets: [] };
      const grad = ctx.createLinearGradient(0, 0, 0, SH);
      grad.addColorStop(0, '#10203a'); grad.addColorStop(1, '#0a1428');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, SW, SH);
      ctx.strokeStyle = 'rgba(120,170,255,0.45)'; ctx.lineWidth = 6;
      ctx.strokeRect(14, 14, SW - 28, SH - 28);
      ctx.fillStyle = '#7fb2ff'; ctx.fillRect(70, 150, 120, 8);   // accent underline

      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f2f6ff';
      ctx.font = '700 76px "Space Grotesk", system-ui, sans-serif';
      ctx.fillText(s.title || '', 68, 130);

      if (s.sub) {
        ctx.fillStyle = '#aec6ff';
        ctx.font = '500 34px "Space Grotesk", system-ui, sans-serif';
        ctx.fillText(s.sub, 70, 210);
      }
      ctx.fillStyle = '#dfe9ff';
      ctx.font = '400 36px "Space Grotesk", system-ui, sans-serif';
      let y = s.sub ? 300 : 250;
      for (const b of (s.bullets || [])) {
        ctx.fillStyle = '#7fb2ff'; ctx.fillText('–', 72, y);   // en-dash bullet
        ctx.fillStyle = '#dfe9ff'; ctx.fillText(b, 112, y);
        y += 64;
      }
      ctx.fillStyle = '#6f86b0';
      ctx.font = '500 26px "Space Grotesk", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText((idx + 1) + ' / ' + SLIDES.length, SW - 60, SH - 44);
      ctx.textAlign = 'left';
      if (tex) tex.needsUpdate = true;
      updateControls();
    }

    function build() {
      if (built) return group;
      group = new THREE.Group();
      group.name = 'lobbyPresentation';
      group.visible = false;

      canvas = document.createElement('canvas');
      canvas.width = SW; canvas.height = SH;
      ctx = canvas.getContext('2d');
      tex = new THREE.CanvasTexture(canvas);
      if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;

      const W = 6, H = W * SH / SW;                         // screen 6 x 3.375, 16:9
      const bottom = 1.0, cy = bottom + H / 2;

      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(W, H),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));  // unlit display, always legible
      screen.position.y = cy;
      screen.name = 'lobbyScreen';
      group.add(screen);
      screenMesh = screen;
      slideMat = screen.material;

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(W + 0.34, H + 0.34, 0.16),
        new THREE.MeshStandardMaterial({ color: 0x1b2434, roughness: 0.7, metalness: 0.1 }));
      frame.position.set(0, cy, -0.1);                      // behind the screen (toward -z)
      frame.castShadow = true;
      group.add(frame);

      const postMat = new THREE.MeshStandardMaterial({ color: 0x141b28, roughness: 0.8, metalness: 0.1 });
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, bottom, 0.18), postMat);
        post.position.set(sx * (W / 2 - 0.4), bottom / 2, -0.1);
        post.castShadow = true;
        group.add(post);
      }

      buildMaintenanceRig();   // climbable ladder + platforms + stairs up the screen's back
      renderSlide();
      built = true;
      return group;
    }

    // Industrial maintenance access up the BACK of the screen (the −z side): a single
    // railed top catwalk that runs the FULL WIDTH behind the screen, reached by a
    // vertical ladder at EACH end (left + right). The catwalk is lowered so its railing
    // just peeks over the top edge of the screen when viewed from the front. Both
    // ladders are climbable via the mechanic in 47 (each tagged 'climb-ladder'; the
    // nearest one is chosen). Added to `group` so it grounds/shows with the screen.
    function buildMaintenanceRig() {
      const steel = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.55, metalness: 0.55 });
      const grate = new THREE.MeshStandardMaterial({ color: 0x262d36, roughness: 0.8, metalness: 0.3 });
      const rig = new THREE.Group(); rig.name = 'screenMaintenanceRig';
      const box = (w, h, d, x, y, z, mat) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || steel);
        m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; rig.add(m); return m;
      };
      const PX = 2.6, BZ = -0.6;                       // leg x, behind-screen z
      // Catwalk height: lowered so the rail tops sit JUST above the screen's top edge
      // (screen top ≈ 4.375 in local Y) — deck 3.95 + 0.55 rail ≈ 4.50, ~0.12 peek.
      const TOP = 3.95, railH = 0.55;
      const deckZ = BZ - 0.45;                          // catwalk sits behind the screen
      const deckD = 0.95;                               // catwalk depth (z)
      const deckXL = -PX - 0.15, deckXR = PX + 0.15;    // full-width run, leg to leg
      const deckW = deckXR - deckXL, deckXC = (deckXL + deckXR) / 2;
      const backZ = deckZ - (deckD / 2 - 0.05);
      const frontZ = deckZ + (deckD / 2 - 0.05);
      // --- the catwalk deck + perimeter rails -------------------------------
      box(deckW, 0.08, deckD, deckXC, TOP, deckZ, grate);                       // deck
      box(deckW, 0.05, 0.05, deckXC, TOP + railH, backZ);                       // back rail (full length)
      box(deckW - 1.2, 0.05, 0.05, deckXC, TOP + railH, frontZ);                // front rail (gaps at the ladder landings)
      box(0.05, railH, deckD, deckXL, TOP + railH / 2, deckZ);                  // left end rail
      box(0.05, railH, deckD, deckXR, TOP + railH / 2, deckZ);                  // right end rail
      const step = deckW / 5;
      for (let x = deckXL; x <= deckXR + 1e-3; x += step) {                     // posts along both edges
        box(0.05, railH, 0.05, x, TOP + railH / 2, backZ);
        if (x > deckXL + 0.6 && x < deckXR - 0.6) box(0.05, railH, 0.05, x, TOP + railH / 2, frontZ);
      }
      // --- a vertical ladder at EACH end, ground -> catwalk ------------------
      const ladZ = deckZ + (deckD / 2) + 0.12;         // just in front of the deck edge
      const makeLadder = (lx) => {
        box(0.05, TOP, 0.05, lx - 0.2, TOP / 2 + 0.1, ladZ);                    // rails
        box(0.05, TOP, 0.05, lx + 0.2, TOP / 2 + 0.1, ladZ);
        for (let y = 0.35; y < TOP; y += 0.27) box(0.46, 0.045, 0.045, lx, y, ladZ);   // rungs
        // climb marker (47 picks the nearest of all 'climb-ladder' markers).
        const marker = new THREE.Object3D();
        marker.name = 'climb-ladder';
        marker.position.set(lx, 0, ladZ);
        marker.userData = { climbable: true, baseY: 0.1, topY: TOP, halfW: 0.35, halfD: 0.35, exitDX: 0, exitDZ: -(deckD / 2 + 0.12) };   // step north onto the deck
        rig.add(marker);
      };
      makeLadder(deckXL + 0.3);                         // left ladder
      makeLadder(deckXR - 0.3);                         // right ladder
      group.add(rig);
      return rig;
    }

    function show() {
      build();
      const par = parentNode();
      if (!par) return false;
      if (group.parent !== par) par.add(group);
      const zPos = screenZ();
      group.position.set(0, groundYAt(0, zPos), zPos);      // planted on the board, facing +z (center)
      group.rotation.y = 0;
      group.visible = true;
      ensureControls(true);
      return true;
    }
    function hide() { if (group) group.visible = false; ensureControls(false); showSlides(); }

    function clamp(i) { return Math.max(0, Math.min(SLIDES.length - 1, i)); }
    function applySlide(i) { idx = clamp(i); renderSlide(); }    // local render only (incoming sync path)
    function broadcast() { if (typeof WS.present === 'function') { try { WS.present(idx); } catch (_) {} } }
    function go(i) { showSlides(); _autoAdvT = 0; applySlide(i); broadcast(); }   // user action -> slides + apply + sync
    function next() { if (idx < SLIDES.length - 1) go(idx + 1); }
    function prev() { if (idx > 0) go(idx - 1); }
    function setSlides(arr) {
      if (Array.isArray(arr) && arr.length) { SLIDES = arr.slice(); idx = clamp(idx); renderSlide(); }
    }

    // ---- on-screen controls (only while in a room) ----
    function ensureControls(visible) {
      if (visible && !controls) {
        controls = document.createElement('div');
        controls.id = 'tw-lobby-controls';
        controls.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:60;'
          + 'display:flex;gap:8px;align-items:center;padding:6px 8px;border-radius:12px;'
          + 'background:rgba(12,20,38,0.82);border:1px solid rgba(120,170,255,0.28);'
          + 'font:600 12px "Space Grotesk",system-ui,sans-serif;color:#cfe0ff;backdrop-filter:blur(6px)';
        const mkBtn = (label, fn) => {
          const b = document.createElement('button');
          b.type = 'button'; b.textContent = label;
          b.style.cssText = 'cursor:pointer;border:0;border-radius:8px;padding:6px 12px;'
            + 'background:rgba(120,170,255,0.16);color:#eaf2ff;font:inherit';
          b.addEventListener('click', fn);
          return b;
        };
        const prevB = mkBtn('‹ Prev', prev);
        const label = document.createElement('span');
        label.id = 'tw-lobby-page'; label.style.cssText = 'min-width:74px;text-align:center;letter-spacing:.04em';
        const nextB = mkBtn('Next ›', next);
        // Settings access in tinyverse: the real button is hidden with the builder
        // toolbar, but clicking it programmatically still opens the (un-gated) modal.
        const setB = mkBtn('Settings', () => { const b = document.getElementById('render-settings'); if (b) b.click(); });
        setB.style.marginLeft = '6px';
        controls.appendChild(prevB); controls.appendChild(label); controls.appendChild(nextB); controls.appendChild(setB);
        document.body.appendChild(controls);
        updateControls();
      } else if (!visible && controls) {
        controls.remove(); controls = null;
      }
    }
    function updateControls() {
      const el = controls && controls.querySelector('#tw-lobby-page');
      if (el) el.textContent = 'Slide ' + (idx + 1) + ' / ' + SLIDES.length;
    }

    // keyboard: [ prev, ] next while a room is active
    window.addEventListener('keydown', (e) => {
      if (!group || !group.visible) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === '[') { prev(); } else if (e.key === ']') { next(); }
    });

    // ---- show slides vs. a live CCTV feed on the big screen ------------------
    function showSlides() {
      if (!screenMesh || !slideMat) return;
      if (screenMesh.material !== slideMat) screenMesh.material = slideMat;
      liveFeedId = null;
      cyclePhase = 'slides'; cycleT = 0;
    }
    function showFeed(feedId) {
      const cc = window.__tinyworldCCTV;
      if (!cc || !screenMesh) return false;
      const mat = cc.monitorMaterialFor(feedId, { tint: 1 });
      if (!mat) return false;
      if (liveMat) { try { liveMat.dispose(); } catch (_) {} }
      liveMat = mat;
      screenMesh.material = mat;
      liveFeedId = feedId;
      if (typeof cc.glitch === 'function') cc.glitch(feedId, 0.7);   // sell the cut
      cyclePhase = 'feed'; cycleT = 0;
      return true;
    }
    function setCycle(on) { cycleOn = !!on; if (!cycleOn) showSlides(); }

    // Called each frame from the animation loop (wired in 25). Auto-advances the
    // deck and, when cameras exist, cuts to the hottest feed then back to slides.
    function tick(t, dt) {
      if (!group || !group.visible) return;
      const cc = window.__tinyworldCCTV;
      const haveFeeds = cc && cc.feeds && cc.feeds().length;
      // gentle auto-advance of slides for host-free ambience (only in slides phase)
      if (cyclePhase === 'slides') {
        _autoAdvT += dt;
        if (_autoAdvT >= AUTO_ADVANCE) {
          _autoAdvT = 0;
          applySlide((idx + 1) % SLIDES.length);   // local-only advance; presenter sync still uses go()
        }
      }
      if (!cycleOn || !haveFeeds) { if (liveFeedId) showSlides(); return; }
      cycleT += dt;
      if (cyclePhase === 'slides') {
        if (cycleT >= SLIDE_DWELL) {
          // cut to the most active camera, or the live-feed material's own feed
          const hot = (typeof cc.activeFeed === 'function') ? cc.activeFeed(0.2) : null;
          const pick = hot || (cc.feedsByActivity ? cc.feedsByActivity()[0] : cc.feeds()[0]);
          if (pick) showFeed(pick.id); else cycleT = 0;
        }
      } else if (cyclePhase === 'feed') {
        // while on a feed, keep following the hottest camera if a hotter one appears
        const hot = (typeof cc.activeFeed === 'function') ? cc.activeFeed(0.35) : null;
        if (hot && hot.id !== liveFeedId) showFeed(hot.id);
        if (cycleT >= FEED_DWELL) showSlides();
      }
    }

    if (typeof WS.on === 'function') {
      WS.on('enter', () => { try { show(); } catch (_) {} });
      WS.on('leave', () => { try { hide(); } catch (_) {} });
      // Synced slide from the room (server echo of any presenter's advance) -> apply
      // locally WITHOUT rebroadcasting, so all clients converge without a feedback loop.
      WS.on('present', (d) => { if (d && typeof d.slide === 'number') applySlide(d.slide); });
    }

    window.__tinyworldLobby = { show, hide, build, setSlides, next, prev, go, group: () => group, slideCount: () => SLIDES.length, current: () => idx, tick, setCycle, showSlides, showFeed, liveFeed: () => liveFeedId };
  })();
