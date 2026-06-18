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

    // ---- "Latest Updates" feed --------------------------------------------------
    // A short, curated changelog drawn as its own slide. This is the SINGLE edit
    // point — add / trim entries here. Entries are CONTENT (English), mirroring the
    // default welcome deck above; each is wired through tx() with a *dynamic* key so
    // a translation can be added later (engine/i18n) without touching this file,
    // while the English text stays the always-available fallback. The slide header
    // itself is a real i18n string, t('lobby.updates.title').
    let UPDATES = [
      { id: 'lobby-live', title: 'Living Lobby', line: 'Ambient crowd plus join / leave notifications are live' },
      { id: 'cctv', title: 'World CCTV', line: 'Watch live camera feeds from active rooms right here' },
      { id: 'companions', title: 'AI Companions', line: 'Characters you can walk up to and actually talk with' },
      { id: 'avatars', title: 'Voxel Avatars', line: 'Pick a preset or customise your look in 3D' },
      { id: 'emotes', title: 'Chat Emotes', line: 'Type /wave /dance /sit to act out for everyone' },
    ];

    let idx = 0, group = null, canvas = null, ctx = null, tex = null, built = false, controls = null;
    let screenMesh = null, slideMat = null;       // the display plane + its slide material
    // ---- alternating rotation: CCTV camera <-> Latest Updates slide -------------
    // With cameras mounted (63-cctv-placement always mounts >=6 on enter) the screen
    // alternates strictly: a live cam feed, then the Latest Updates slide, then the
    // NEXT cam, then Updates again — cycling through every camera across the cam
    // turns. With NO cameras it falls back to a self-running deck (Latest Updates +
    // the default welcome slides) so the screen is never blank. A brief signal
    // glitch sells each cam cut.
    let cycleOn = true, cyclePhase = 'deck', cycleT = 0, liveFeedId = null, liveMat = null;
    let camCursor = -1;           // round-robin index into feeds(); advanced each camera turn
    let deckCursor = 0;           // 0 = Latest Updates; 1..N = default SLIDES[n-1] (fallback only)
    const FEED_DWELL = 6.0;       // seconds to hold a live cam feed
    const UPDATES_DWELL = 9.0;    // seconds to hold Latest Updates between cam cuts
    const AUTO_ADVANCE = 7.0;     // fallback deck (no cams): seconds per slide

    // ---- @lobby broadcast strip ----
    // A `@lobby <message>` chat line projects onto the screen as a banner strip pinned
    // to its lower edge (the sender's color+initials disc + name + message). Slides/feeds
    // keep playing underneath — the strip is a separate, always-on-top plane that fades
    // in, holds, then fades out. Concurrent posts queue.
    let lobbyCanvas = null, lobbyCtx = null, lobbyTex = null, lobbyMat = null, lobbyMesh = null;
    let lobbyQueue = [], lobbyShowing = false, lobbyT = 0;
    const LOBBY_DWELL = 7.0, LOBBY_FADE = 0.5;

    // ---- WAVE1 countdown strip ----
    let countdownCanvas = null, countdownCtx = null, countdownTex = null, countdownMat = null, countdownMesh = null;
    let countdownLastLabel = '', countdownNextPaintT = 0;

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

    // ---- "Latest Updates" slide (shares the slide canvas + matches the deck look) ----
    function renderUpdatesSlide() {
      if (!ctx) return;
      const grad = ctx.createLinearGradient(0, 0, 0, SH);
      grad.addColorStop(0, '#10203a'); grad.addColorStop(1, '#0a1428');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, SW, SH);
      ctx.strokeStyle = 'rgba(120,170,255,0.45)'; ctx.lineWidth = 6;
      ctx.strokeRect(14, 14, SW - 28, SH - 28);
      ctx.fillStyle = '#7fb2ff'; ctx.fillRect(70, 150, 120, 8);   // accent underline

      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f2f6ff';
      ctx.font = '700 76px "Space Grotesk", system-ui, sans-serif';
      ctx.fillText(t('lobby.updates.title'), 68, 130);

      let y = 224;
      for (const u of UPDATES.slice(0, 5)) {
        ctx.fillStyle = '#7fb2ff';
        ctx.beginPath(); ctx.arc(82, y - 11, 6, 0, Math.PI * 2); ctx.fill();   // bullet dot
        ctx.fillStyle = '#eaf2ff';
        ctx.font = '600 36px "Space Grotesk", system-ui, sans-serif';
        ctx.fillText(tx('lobby.update.' + u.id + '.title', u.title), 112, y);
        ctx.fillStyle = '#9fb6e6';
        ctx.font = '400 26px "Space Grotesk", system-ui, sans-serif';
        ctx.fillText(tx('lobby.update.' + u.id + '.line', u.line), 112, y + 30);
        y += 66;
      }
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

      // @lobby broadcast strip — its own plane just in front of the screen's lower edge,
      // independent of the slide/feed material so it shows over either.
      const OCW = 1024, OCH = 200;
      lobbyCanvas = document.createElement('canvas');
      lobbyCanvas.width = OCW; lobbyCanvas.height = OCH;
      lobbyCtx = lobbyCanvas.getContext('2d');
      lobbyTex = new THREE.CanvasTexture(lobbyCanvas);
      if ('colorSpace' in lobbyTex && THREE.SRGBColorSpace) lobbyTex.colorSpace = THREE.SRGBColorSpace;
      const OW = W, OH = OW * OCH / OCW;                 // strip plane, matches canvas aspect
      lobbyMat = new THREE.MeshBasicMaterial({ map: lobbyTex, transparent: true, opacity: 0, toneMapped: false, depthTest: false });
      const overlay = new THREE.Mesh(new THREE.PlaneGeometry(OW, OH), lobbyMat);
      overlay.position.set(0, bottom + OH / 2 + 0.06, 0.05);   // pinned at the screen's bottom, slightly in front
      overlay.renderOrder = 5;
      overlay.visible = false;
      overlay.name = 'lobbyBroadcast';
      group.add(overlay);
      lobbyMesh = overlay;

      const CCW = 1024, CCH = 132;
      countdownCanvas = document.createElement('canvas');
      countdownCanvas.width = CCW; countdownCanvas.height = CCH;
      countdownCtx = countdownCanvas.getContext('2d');
      countdownTex = new THREE.CanvasTexture(countdownCanvas);
      if ('colorSpace' in countdownTex && THREE.SRGBColorSpace) countdownTex.colorSpace = THREE.SRGBColorSpace;
      const CW = W, CH = CW * CCH / CCW;
      countdownMat = new THREE.MeshBasicMaterial({ map: countdownTex, transparent: true, opacity: 0.96, toneMapped: false, depthTest: false });
      const countdownStrip = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), countdownMat);
      countdownStrip.position.set(0, bottom + H - CH / 2 - 0.06, 0.055);
      countdownStrip.renderOrder = 5;
      countdownStrip.name = 'lobbyCountdown';
      group.add(countdownStrip);
      countdownMesh = countdownStrip;
      renderCountdownStrip();

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
      // Start the rotation fresh on the Latest Updates slide; the cycle takes over
      // from tick() (cameras mount ~350ms later, so Updates shows during the gap).
      camCursor = -1; showDeckAt(0);
      return true;
    }
    function hide() {
      if (group) group.visible = false;
      ensureControls(false);
      showSlides();
      lobbyQueue.length = 0; lobbyShowing = false;
      if (lobbyMesh) lobbyMesh.visible = false;
    }

    function clamp(i) { return Math.max(0, Math.min(SLIDES.length - 1, i)); }
    function applySlide(i) { idx = clamp(i); showDeckAt(idx + 1); }   // incoming sync -> show that deck slide locally
    function broadcast() { if (typeof WS.present === 'function') { try { WS.present(idx); } catch (_) {} } }
    function go(i) { idx = clamp(i); showDeckAt(idx + 1); broadcast(); }   // user action -> show + sync
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
    // The deck spans [0] = Latest Updates, [1..N] = the default welcome SLIDES.
    // showDeckAt renders the requested entry onto the shared slide canvas and binds
    // it to the screen (so it also un-does any live-feed material swap).
    function showDeckAt(n) {
      if (!screenMesh || !slideMat) return;
      const span = SLIDES.length + 1;
      deckCursor = ((n % span) + span) % span;
      if (deckCursor === 0) renderUpdatesSlide();
      else { idx = clamp(deckCursor - 1); renderSlide(); }
      if (screenMesh.material !== slideMat) screenMesh.material = slideMat;
      liveFeedId = null;
      cyclePhase = 'deck'; cycleT = 0;
    }
    function showUpdates() { showDeckAt(0); }
    function showSlides() { showDeckAt(idx + 1); }   // current welcome slide (host/hide reset)
    // Advance the round-robin and cut to the next camera; fall back to Updates if it fails.
    function cutToNextCamera(list) {
      if (!list || !list.length) { showDeckAt(0); return; }
      camCursor = (camCursor + 1) % list.length;
      const pick = list[camCursor];
      if (!pick || !showFeed(pick.id)) showDeckAt(0);
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

    // ---- @lobby broadcast strip ---------------------------------------------
    function lobbyInitials(name) {
      const parts = String(name || '?').trim().split(/\s+/);
      return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
    }
    function lobbyClip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
    function lobbyRRect(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }
    function renderLobbyStrip(d) {
      if (!lobbyCtx) return;
      const W2 = 1024, H2 = 200, c = lobbyCtx, col = d.color || '#5a78e0';
      c.clearRect(0, 0, W2, H2);
      c.fillStyle = 'rgba(6,10,24,0.82)'; lobbyRRect(c, 24, 24, W2 - 48, H2 - 48, 18); c.fill();   // panel
      c.fillStyle = col; lobbyRRect(c, 24, 24, 12, H2 - 48, 6); c.fill();                          // accent bar
      const cx = 122, cy = H2 / 2, r = 58;                                                          // avatar disc
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.closePath();
      c.fillStyle = col; c.fill();
      c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,0.35)'; c.stroke();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '700 46px "Space Grotesk", system-ui, sans-serif';
      c.fillText(lobbyInitials(d.name), cx, cy + 2);
      c.textAlign = 'left';                                                                          // name + message
      c.fillStyle = col; c.font = '700 34px "Space Grotesk", system-ui, sans-serif';
      c.fillText(lobbyClip(d.name || 'Player', 22), 214, 80);
      c.fillStyle = '#eaf2ff'; c.font = '500 40px "Space Grotesk", system-ui, sans-serif';
      c.fillText(lobbyClip(d.text || '', 40), 214, 140);
      if (lobbyTex) lobbyTex.needsUpdate = true;
    }

    function renderCountdownStrip() {
      const cd = window.TinyWorldCountdown;
      if (!cd || !countdownCtx) return;
      const formatted = cd.formatRemaining();
      if (formatted.label === countdownLastLabel) return;
      countdownLastLabel = formatted.label;
      cd.renderCanvas(countdownCtx, { formatted, width: countdownCanvas.width, height: countdownCanvas.height, skin: 'lobby' });
      if (countdownTex) countdownTex.needsUpdate = true;
    }
    function startNextLobby() {
      const d = lobbyQueue.shift();
      if (!d) { lobbyShowing = false; if (lobbyMesh) lobbyMesh.visible = false; return; }
      lobbyShowing = true; lobbyT = 0;
      renderLobbyStrip(d);
      if (lobbyMat) lobbyMat.opacity = 0;
      if (lobbyMesh) lobbyMesh.visible = true;
    }
    function showLobbyMessage(d) {
      if (!d || !String(d.text || '').trim()) return;
      lobbyQueue.push({ name: d.name, color: d.color, text: String(d.text).trim() });
      if (!lobbyShowing) startNextLobby();
    }
    // Parse `@lobby <message>` (the screen-broadcast keyword) out of a chat line.
    function parseLobbycast(text) {
      const m = String(text || '').match(/^\s*@lobby\b[:\s]*(.*)$/i);
      return m ? m[1].trim() : '';
    }

    // Called each frame from the animation loop (wired in 25). Drives the strict
    // alternation: live cam feed -> Latest Updates -> next cam -> Updates -> ...,
    // round-robining through every camera. With no cameras it self-runs the deck
    // (Updates + welcome slides) so the screen is never blank. Repaints are cheap
    // (the slide canvas only redraws on a phase change, never every frame).
    function tick(t, dt) {
      if (!group || !group.visible) return;
      if (t >= countdownNextPaintT) {
        countdownNextPaintT = t + 1;
        renderCountdownStrip();
      }
      // @lobby strip lifecycle — fade in, hold, fade out (runs regardless of phase).
      if (lobbyShowing && lobbyMat) {
        lobbyT += dt;
        const fIn = Math.min(1, lobbyT / LOBBY_FADE);
        const fOut = Math.min(1, Math.max(0, LOBBY_DWELL - lobbyT) / LOBBY_FADE);
        lobbyMat.opacity = Math.max(0, Math.min(fIn, fOut));
        if (lobbyT >= LOBBY_DWELL) startNextLobby();
      }
      if (!cycleOn) return;   // static mode: whatever was last shown stays

      const cc = window.__tinyworldCCTV;
      const feedList = (cc && typeof cc.feeds === 'function') ? (cc.feeds() || []) : [];
      const haveFeeds = feedList.length > 0;
      cycleT += dt;

      if (cyclePhase === 'feed') {
        if (!haveFeeds) { showDeckAt(0); return; }   // cameras vanished mid-feed -> Latest Updates
        if (cycleT >= FEED_DWELL) showDeckAt(0);     // cam -> Latest Updates
        return;
      }

      // 'deck' phase = Latest Updates (or a welcome slide in fallback / host nav).
      if (cyclePhase !== 'deck') { showDeckAt(0); return; }   // (re)initialise to a known view
      if (haveFeeds) {
        if (cycleT >= UPDATES_DWELL) cutToNextCamera(feedList);   // Updates -> next cam
      } else if (cycleT >= AUTO_ADVANCE) {
        showDeckAt(deckCursor + 1);                               // self-running deck, never blank
      }
    }

    if (typeof WS.on === 'function') {
      WS.on('enter', () => { try { show(); } catch (_) {} });
      WS.on('leave', () => { try { hide(); } catch (_) {} });
      // Synced slide from the room (server echo of any presenter's advance) -> apply
      // locally WITHOUT rebroadcasting, so all clients converge without a feedback loop.
      WS.on('present', (d) => { if (d && typeof d.slide === 'number') applySlide(d.slide); });
      // `@lobby <message>` chat lines project onto the screen. Chat is broadcast to every
      // client, so each one renders the strip locally (incl. the sender) — no server change.
      WS.on('chat', (d) => {
        try { const msg = parseLobbycast(d && d.text); if (msg) showLobbyMessage({ name: d.name, color: d.color, text: msg }); } catch (_) {}
      });
    }

    window.__tinyworldLobby = { show, hide, build, setSlides, next, prev, go, group: () => group, slideCount: () => SLIDES.length, current: () => idx, tick, setCycle, showSlides, showFeed, liveFeed: () => liveFeedId, showLobbyMessage };
  })();
