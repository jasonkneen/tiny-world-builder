  // -------- crop duster --------
  const CROP_DUSTER_ASSET = 'models/stunt_plane.glb';
  const CROP_DUSTER_TEXTURES = [
    'models/Polygon_Plane_Texture_01.png',
    'models/Polygon_Plane_Texture_02.png',
    'models/Polygon_Plane_Texture_03.png',
  ];
  const CROP_DUSTER_WINGSPAN = 1.35;
  const cropDusterRoot = new THREE.Group();
  cropDusterRoot.name = 'cropDuster';
  cropDusterRoot.visible = false;
  xrWorldRoot.add(cropDusterRoot);
  const cropDusterMaterials = [];
  let cropDusterModel = null;
  let cropDusterLoadStarted = false;
  let cropDusterTime = 0;
  const cropDustParticles = [];
  const cropDustGeo = new THREE.SphereGeometry(0.055, 6, 6);
  const cropDustMat = new THREE.MeshBasicMaterial({ color: 0xf1dda1, transparent: true, opacity: 0.42, depthWrite: false });

  // Pre-created slots for planes to form formations without dynamic allocations
  const planes = [];
  for (let i = 0; i < 3; i++) {
    const pGroup = new THREE.Group();
    pGroup.visible = false;
    cropDusterRoot.add(pGroup);

    planes.push({
      group: pGroup,
      model: null,
      props: [],
      bannerMesh: null,
      bannerWire: null,
      bannerCanvas: null,
      bannerTexture: null,
      localOffset: new THREE.Vector3(),
      variantIndex: 0
    });
  }

  function hideCropDusterBanners() {
    for (const p of planes) {
      if (p.bannerMesh) p.bannerMesh.visible = false;
      if (p.bannerWire) p.bannerWire.visible = false;
    }
  }

  function clearCropDustParticles() {
    for (let i = cropDustParticles.length - 1; i >= 0; i--) {
      const p = cropDustParticles[i];
      if (p && p.parent) p.parent.remove(p);
      cropDustParticles.splice(i, 1);
    }
  }

  function stopCropDusterRuntime(opts = {}) {
    cropDusterRoot.visible = false;
    for (const p of planes) {
      p.group.visible = false;
    }
    hideCropDusterBanners();
    cropDusterState.phase = 'idle';
    cropDusterState.curve = null;
    cropDusterState.curveLen = 0;
    cropDusterState.travel = 0;
    cropDusterState.isBanner = false;
    cropDusterState.numActivePlanes = 0;
    if (opts.clearDust) clearCropDustParticles();
  }

  function setPlanesEnabled(enabled) {
    renderPlanesEnabled = !!enabled;
    try { localStorage.setItem(RENDER_LS.planesEnabled, renderPlanesEnabled ? '1' : '0'); } catch (_) {}
    if (!renderPlanesEnabled) {
      stopCropDusterRuntime({ clearDust: true });
      return;
    }
    if (!cropDusterModel) {
      loadCropDuster();
      return;
    }
    cropDusterState.phase = 'idle';
    cropDusterState.refuelTimer = 0;
    startNextRun();
  }

  // -------- crop duster route / state --------
  const FLIGHT_OFFSCREEN_DIST = 26;     // how far past the world edge the plane appears from
  const FLIGHT_DUST_SPEED = 2.45;       // m/s while spraying
  const FLIGHT_CRUISE_SPEED = 4.4;      // m/s while transiting / banner pass
  const FLIGHT_DUST_ALT = 2.05;
  const FLIGHT_CRUISE_ALT = 5.6;
  const FLIGHT_REFUEL_MIN = 2.0;        // increased frequency
  const FLIGHT_REFUEL_MAX = 5.0;         // increased frequency
  const FLIGHT_BANNER_CHANCE = 0.55;    // increased banner chance
  const BANNER_MESSAGES = [
    'TINY WORLD',
    'HELLO!',
    'NICE FARM',
    'EAT MORE PUMPKIN',
    'KEEP BUILDING',
    'GO TINY',
    'YEEHAW',
    'HAPPY HARVEST',
    'ADVERTISE HERE',
    'SPACE AVAILABLE',
    'WILL FLY FOR COINS',
    'YOUR AD HERE',
    'BUY COFFEE',
    'DRINK WATER',
    'TINY ADVERTISING CO.',
    'LOOK UP!',
    'HI MOM!',
    'MADE WITH THREE.JS'
  ];
  let activeSeason = 'summer';

  const cropDusterState = {
    phase: 'idle',          // 'idle' | 'flying' | 'banner' | 'refuel-wait'
    curve: null,
    curveLen: 0,
    travel: 0,
    speed: FLIGHT_CRUISE_SPEED,
    refuelTimer: 0,
    isBanner: false,
    numActivePlanes: 1
  };
  // Scratch vectors reused per frame to avoid allocations in the hot path.
  const _flightPos = new THREE.Vector3();
  const _flightTan = new THREE.Vector3();
  const _flightAhead = new THREE.Vector3();

  // -------- banner streamer --------
  const BANNER_LEN = 5.4;
  const BANNER_HEIGHT = 0.55;

  function ensurePlaneBanner(p) {
    if (p.bannerMesh) return;
    p.bannerCanvas = document.createElement('canvas');
    p.bannerCanvas.width = 2048;
    p.bannerCanvas.height = 224;
    p.bannerTexture = new THREE.CanvasTexture(p.bannerCanvas);
    p.bannerTexture.encoding = THREE.sRGBEncoding;
    p.bannerTexture.anisotropy = (renderer.capabilities.getMaxAnisotropy
      ? Math.min(8, renderer.capabilities.getMaxAnisotropy())
      : 1);
    const geo = new THREE.PlaneGeometry(BANNER_LEN, BANNER_HEIGHT, 36, 4);
    geo.translate(-BANNER_LEN / 2, 0, 0);
    const mat = new THREE.MeshBasicMaterial({
      map: p.bannerTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    p.bannerMesh = new THREE.Mesh(geo, mat);
    p.bannerMesh.visible = false;
    p.bannerMesh.castShadow = false;
    p.bannerMesh.receiveShadow = false;
    p.bannerMesh.renderOrder = 1;
    p.bannerMesh.userData.basePositions = geo.attributes.position.array.slice();
    xrWorldRoot.add(p.bannerMesh);

    // Tow wire
    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const wireMat = new THREE.LineBasicMaterial({ color: 0x1a1a1a, transparent: false });
    p.bannerWire = new THREE.Line(wireGeo, wireMat);
    p.bannerWire.visible = false;
    p.bannerWire.frustumCulled = false;
    p.bannerWire.castShadow = false;
    p.bannerWire.receiveShadow = false;
    xrWorldRoot.add(p.bannerWire);
  }

  function setPlaneBannerText(p, text) {
    ensurePlaneBanner(p);
    const ctx = p.bannerCanvas.getContext('2d');
    const W = p.bannerCanvas.width, H = p.bannerCanvas.height;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 130px ui-sans-serif, "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, H / 2 + 4);
    p.bannerTexture.needsUpdate = true;
  }

  function updatePlaneBannerFlap(p, time) {
    if (!p.bannerMesh) return;
    const pos = p.bannerMesh.geometry.attributes.position;
    const base = p.bannerMesh.userData.basePositions;
    const arr = pos.array;
    for (let i = 0; i < pos.count; i++) {
      const j = i * 3;
      const baseX = base[j];
      const baseY = base[j + 1];
      const t = Math.min(1, Math.max(0, -baseX / BANNER_LEN));
      const wave = Math.sin(baseX * 5.5 + time * 8.5) * 0.28 * t;
      const droop = -0.22 * t * t;
      const twist = baseY * 1.05 * Math.sin(time * 6.5 + baseX * 3.2) * t;
      arr[j]     = baseX;
      arr[j + 1] = baseY + droop;
      arr[j + 2] = wave + twist * 0.18;
    }
    pos.needsUpdate = true;
  }

  const AUTOINCENTIVE_BANNER_DATA_URL = 'data:image/jpeg;base64,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';

  // Wire the settings-panel sponsor logo to the same artwork.
  (function applyAutoincentiveSponsorLogo() {
    const img = document.getElementById('sponsor-logo-autoincentive');
    if (img && !img.src) img.src = AUTOINCENTIVE_BANNER_DATA_URL;
    const brand = document.getElementById('brand-banner-img');
    if (brand && !brand.src) brand.src = AUTOINCENTIVE_BANNER_DATA_URL;
  })();

  // -------- bottom-left keyboard/mouse tips --------
  // Compact reference card. Modifier glyphs swap based on platform so the
  // hint matches the user's real keyboard.
  (function setupTipsPanel() {
    const panel = document.getElementById('tips-panel');
    const showBtn = document.getElementById('tips-show');     // legacy floating ?-pill
    const closeBtn = document.getElementById('tips-close');
    const grid = document.getElementById('tips-grid');
    const appbarToggle = document.getElementById('tips-toggle'); // new appbar keyboard icon
    if (!panel || !grid || !closeBtn) return;

    const TIPS_LS = 'tinyworld:tips.dismissed';
    const ua = navigator.userAgent || '';
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || ua);
    const KEYS = isMac
      ? { mod: '⌘', alt: '⌥', shift: '⇧', enter: '⏎', leftClick: 'L-drag', rightClick: 'R-drag' }
      : { mod: 'Ctrl', alt: 'Alt', shift: 'Shift', enter: 'Enter', leftClick: 'L-drag', rightClick: 'R-drag' };

    // Inline kbd helper. Tokens with spaces become individual keys; `+` joins.
    function kbd(parts) {
      return parts.map(token => {
        if (token === '+') return '<span class="sep">+</span>';
        if (token === '·' || token === 'or') return '<span class="sep">' + (token === 'or' ? 'or' : '·') + '</span>';
        return '<kbd>' + token + '</kbd>';
      }).join('');
    }

    const ROWS = [
      ['Orbit',     [KEYS.leftClick]],
      ['Pan',       [KEYS.rightClick, '·', 'Space', '+', KEYS.leftClick, '·', '↑↓←→']],
      ['Zoom',      ['Scroll', '·', 'Pinch']],
      ['Select area', [KEYS.shift, '+', KEYS.leftClick]],
      ['Tools',     ['1', '–', '9', '·', 'V', '·', 'N map']],
      ['Reset view', ['C']],
    ];

    grid.innerHTML = '';
    for (const [label, keys] of ROWS) {
      const lbl = document.createElement('div');
      lbl.className = 'tips-label';
      lbl.textContent = label;
      const val = document.createElement('div');
      val.className = 'tips-keys';
      val.innerHTML = kbd(keys);
      grid.appendChild(lbl);
      grid.appendChild(val);
    }

    function show() {
      panel.hidden = false;
      if (showBtn) showBtn.hidden = true;
      if (appbarToggle) appbarToggle.classList.add('active');
      try { localStorage.setItem(TIPS_LS, '0'); } catch (_) {}
    }
    function hide() {
      panel.hidden = true;
      if (showBtn) showBtn.hidden = true; // appbar icon is the canonical re-open now
      if (appbarToggle) appbarToggle.classList.remove('active');
      try { localStorage.setItem(TIPS_LS, '1'); } catch (_) {}
    }
    function toggle() { if (panel.hidden) show(); else hide(); }

    // Default: visible on first load, remembered after.
    const dismissed = localStorage.getItem(TIPS_LS) === '1';
    if (dismissed) hide(); else show();

    closeBtn.addEventListener('click', hide);
    if (showBtn) showBtn.addEventListener('click', show);
    if (appbarToggle) appbarToggle.addEventListener('click', toggle);
  })();

  // -------- DEV: Save Defaults --------
  // Locally (localhost / 127.0.0.1 / file://) the dev can tune every visual
  // setting and panel layout, then snapshot them into tinyworld-defaults.json
  // which ships with the site and seeds localStorage for new users.
  (function setupDevSaveDefaults() {
    const host = (location.hostname || '').toLowerCase();
    const isDev = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '' || location.protocol === 'file:';
    if (!isDev) return;
    const section = document.getElementById('dev-defaults-section');
    const btn = document.getElementById('dev-save-defaults-btn');
    const status = document.getElementById('dev-save-defaults-status');
    if (!section || !btn) return;
    section.hidden = false;

    // Keys we never ship as defaults — match the server-side filter.
    const EXCLUDE = [
      /^tinyworld:v\d+$/,                // serialised home world
      /^tinyworld:worlds\.v\d+/,         // multi-world saves
      /^tinyworld:ai:key:/,              // API credentials
      /^tinyworld:ai:prompt$/,           // user prompt text
      /^tinyworld:vehicle-demo:/,        // session-only demo state
      /^tinyworld:audio:music-track$/,   // per-user manual music choice
      /^tinyworld:audio:music-mode$/,    // random vs manual music mode
      /^tinyworld:welcome:dismissedId$/, // per-user welcome dismissal
      /:backup$/,
      // Panel/widget positions are viewport-specific — never ship as defaults.
      /\.pos$/,
      /-pos$/,
      /:pos$/,
    ];
    function isExcluded(key) {
      if (!key || key.indexOf('tinyworld:') !== 0) return true;
      for (const re of EXCLUDE) if (re.test(key)) return true;
      return false;
    }

    function snapshotSettings() {
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (isExcluded(k)) continue;
        out[k] = localStorage.getItem(k);
      }
      return out;
    }

    function setStatus(msg, kind) {
      if (!status) return;
      status.textContent = msg || '';
      status.classList.remove('is-ok', 'is-err');
      if (kind === 'ok') status.classList.add('is-ok');
      if (kind === 'err') status.classList.add('is-err');
    }

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      setStatus('Saving…', null);
      const settings = snapshotSettings();
      try {
        const resp = await fetch('/api/save-defaults', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings }),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.ok) {
          setStatus(`Saved ${data.count} keys → ${data.path}`, 'ok');
        } else {
          setStatus(`Error: ${data.error || resp.status}`, 'err');
        }
      } catch (err) {
        setStatus(`Network error: ${err && err.message || err}. Is the dev server running?`, 'err');
      } finally {
        btn.disabled = false;
      }
    });
  })();

  // -------- island front banner (autoincentive drape) --------
  // Static cloth banner draped over the front-facing (+Z) side of the home
  // island. Top edge anchored at grass level, bottom hangs ~2 units down.
  // Flaps gently like a sideways flag in a light breeze.
  const ISLAND_BANNER_WIDTH = 2.8;
  const ISLAND_BANNER_HEIGHT = 1.12;       // 2.5:1 aspect to match logo art
  const ISLAND_BANNER_OFFSET = 0.35;       // outward gap from island face (clears edge dressing)
  const ISLAND_BANNER_TOP_Y = -0.32;       // below grass / dirt-line so edge tufts don't clip
  const ISLAND_BANNER_FLAP_INTERVAL = 1 / 12;
  let islandBannerEntry = null;            // { mesh, basePositions, height }
  let islandBannerLastFlapTime = -Infinity;

  function makeIslandBannerTexture() {
    const tex = new THREE.TextureLoader().load(AUTOINCENTIVE_BANNER_DATA_URL, () => {
      if (typeof renderScene === 'function') renderScene();
    });
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = (renderer.capabilities.getMaxAnisotropy
      ? Math.min(8, renderer.capabilities.getMaxAnisotropy())
      : 1);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  function buildIslandFrontBanner(parent) {
    if (islandBannerEntry && islandBannerEntry.mesh) {
      try { parent.add(islandBannerEntry.mesh); } catch (_) {}
      // Reposition for current GRID.
      const half = (GRID * TILE) * 0.5;
      islandBannerEntry.mesh.position.set(0, ISLAND_BANNER_TOP_Y, half + ISLAND_BANNER_OFFSET);
      islandBannerEntry.mesh.rotation.set(0, 0, 0);
      return;
    }
    const tex = makeIslandBannerTexture();
    const geo = new THREE.PlaneGeometry(
      ISLAND_BANNER_WIDTH,
      ISLAND_BANNER_HEIGHT,
      24,
      14
    );
    // Anchor top edge at y=0 so mesh.position controls the hang point.
    geo.translate(0, -ISLAND_BANNER_HEIGHT * 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 0;
    const half = (GRID * TILE) * 0.5;
    mesh.position.set(0, ISLAND_BANNER_TOP_Y, half + ISLAND_BANNER_OFFSET);
    // PlaneGeometry default normal is +Z, which already faces outward on the
    // +Z (front) side of the island.
    mesh.rotation.set(0, 0, 0);
    parent.add(mesh);
    islandBannerEntry = {
      mesh,
      basePositions: geo.attributes.position.array.slice(),
      height: ISLAND_BANNER_HEIGHT,
    };
  }

  function tickIslandBanners(time) {
    const b = islandBannerEntry;
    if (!b || !b.mesh || !b.mesh.parent) return;
    if (time - islandBannerLastFlapTime < ISLAND_BANNER_FLAP_INTERVAL) return;
    islandBannerLastFlapTime = time;
    const pos = b.mesh.geometry.attributes.position;
    const base = b.basePositions;
    const arr = pos.array;
    const H = b.height;
    for (let i = 0; i < pos.count; i++) {
      const j = i * 3;
      const bx = base[j];
      const by = base[j + 1];
      // t = 0 at top edge (anchored), 1 at bottom edge (free).
      const t = Math.min(1, Math.max(0, -by / H));
      // Side-to-side sway along the banner width.
      const sway = Math.sin(time * 1.5 + bx * 0.55) * 0.10 * t;
      // Forward/back ripple — wave travels top→bottom.
      const ripple = (
        Math.sin(time * 2.0 + by * 3.1 + bx * 0.7) * 0.18
        + Math.sin(time * 3.3 + by * 1.6) * 0.05
      ) * t;
      // Slight droop / stretch under gravity at the free edge.
      const droop = -0.05 * t * t;
      arr[j]     = bx + sway * 0.35;
      arr[j + 1] = by + droop;
      arr[j + 2] = ripple;
    }
    pos.needsUpdate = true;
  }


  function applyCropDusterMaterial(planeIdx, index) {
    const p = planes[planeIdx];
    if (!p.model || !cropDusterMaterials.length) return;
    const mat = cropDusterMaterials[index % cropDusterMaterials.length] || cropDusterMaterials[0];
    p.model.traverse(o => {
      if (o.isMesh && !o.userData.__propDisc) o.material = mat;
    });
    p.variantIndex = index % cropDusterMaterials.length;
  }

  function normalizeCropDusterModel(model) {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const span = Math.max(size.x, size.z, 0.001);
    const scale = CROP_DUSTER_WINGSPAN / span;
    model.position.sub(center);
    model.scale.setScalar(scale);
    model.rotation.y = 0;
    model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        o.frustumCulled = true;
      }
    });
  }

  function spinAllPropellers(dt) {
    const omega = 220;
    const dRot = omega * dt;
    const flicker = 0.20 + Math.max(0, Math.sin(performance.now() * 0.06)) * 0.16;
    for (let i = 0; i < planes.length; i++) {
      const p = planes[i];
      if (!p.group.visible) continue;
      for (const prop of p.props) {
        const axis = prop.userData.__propAxis || 'z';
        if (axis === 'x') prop.rotation.x += dRot;
        else if (axis === 'y') prop.rotation.y += dRot;
        else prop.rotation.z += dRot;
        if (prop.userData.__disc) prop.userData.__disc.material.opacity = flicker;
      }
    }
  }

  function loadCropDuster() {
    if (cropDusterLoadStarted || cropDusterModel || !THREE.GLTFLoader) return;
    cropDusterLoadStarted = true;
    const texLoader = new THREE.TextureLoader();
    CROP_DUSTER_TEXTURES.forEach(src => {
      const tex = texLoader.load(src);
      tex.flipY = false;
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
      cropDusterMaterials.push(new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff }));
    });
    const loader = new THREE.GLTFLoader();
    loader.load(CROP_DUSTER_ASSET, gltf => {
      cropDusterModel = gltf.scene;
      
      for (let i = 0; i < planes.length; i++) {
        const p = planes[i];
        p.model = gltf.scene.clone();
        normalizeCropDusterModel(p.model);
        p.group.add(p.model);
        
        // Setup propeller for this cloned model
        p.props = [];
        const propNames = /prop(eller)?|blade|spinner|rotor|fan/i;
        p.model.traverse(o => {
          if (!o.isMesh || !propNames.test(o.name || '')) return;
          if (o.material && typeof o.material.clone === 'function') {
            const parentMat = o.material;
            o.material = o.material.clone();
            if (parentMat.onBeforeCompile) o.material.onBeforeCompile = parentMat.onBeforeCompile;
          }
          o.userData.__propAxis = 'z';
          p.props.push(o);

          const box = new THREE.Box3().setFromObject(o);
          const size = box.getSize(new THREE.Vector3());
          const sweepR = Math.max(size.x, size.y) * 0.52;
          if (sweepR > 0.08 && !o.userData.__disc) {
            const disc = new THREE.Mesh(
              new THREE.CircleGeometry(sweepR, 32),
              new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
            );
            disc.name = 'crop_duster_prop_blur_disc';
            disc.userData.__propDisc = true;
            disc.renderOrder = 2;
            o.add(disc);
            o.userData.__disc = disc;
          }
        });
        
        applyCropDusterMaterial(i, i);
      }
      
      if (renderPlanesEnabled) cropDusterRoot.visible = true;
      else stopCropDusterRuntime({ clearDust: true });
    }, undefined, err => {
      cropDusterLoadStarted = false;
      console.warn('[crop-duster] failed to load model', err);
    });
  }

  function cropCellsForDusting() {
    const cells = [];
    for (const key of cropPositions) {
      const [x, z] = key.split(',').map(Number);
      if (x >= 0 && x < GRID && z >= 0 && z < GRID) {
        cells.push({ x, z });
      }
    }
    return cells;
  }

  let cropDusterPassAxis = 'x';
  function planDustingCurve() {
    const crops = cropCellsForDusting();
    if (!crops.length) return null;
    const dustY = FLIGHT_DUST_ALT;
    const cruiseY = Math.max(renderCloudHeight + 0.4, FLIGHT_CRUISE_ALT);

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const c of crops) {
      const p = tilePos(c.x, c.z);
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const extentX = maxX - minX;
    const extentZ = maxZ - minZ;
    const axis = extentX >= extentZ ? 'x' : 'z';
    cropDusterPassAxis = axis;
    const flip = Math.random() < 0.5 ? -1 : 1;

    const lead = FLIGHT_OFFSCREEN_DIST;
    let pts;
    if (axis === 'x') {
      const runZ = (minZ + maxZ) / 2;
      const x0 = flip > 0 ? minX : maxX;
      const x1 = flip > 0 ? maxX : minX;
      const margin = 2.0;
      pts = [
        new THREE.Vector3(x0 - flip * lead, cruiseY, runZ),
        new THREE.Vector3(x0 - flip * (lead * 0.4), cruiseY * 0.85 + dustY * 0.15, runZ),
        new THREE.Vector3(x0 - flip * margin, dustY + 0.55, runZ),
        new THREE.Vector3(x0, dustY, runZ),
        new THREE.Vector3(x1, dustY, runZ),
        new THREE.Vector3(x1 + flip * margin, dustY + 0.55, runZ),
        new THREE.Vector3(x1 + flip * (lead * 0.4), cruiseY * 0.85 + dustY * 0.15, runZ),
        new THREE.Vector3(x1 + flip * lead, cruiseY, runZ),
      ];
    } else {
      const runX = (minX + maxX) / 2;
      const z0 = flip > 0 ? minZ : maxZ;
      const z1 = flip > 0 ? maxZ : minZ;
      const margin = 2.0;
      pts = [
        new THREE.Vector3(runX, cruiseY, z0 - flip * lead),
        new THREE.Vector3(runX, cruiseY * 0.85 + dustY * 0.15, z0 - flip * (lead * 0.4)),
        new THREE.Vector3(runX, dustY + 0.55, z0 - flip * margin),
        new THREE.Vector3(runX, dustY, z0),
        new THREE.Vector3(runX, dustY, z1),
        new THREE.Vector3(runX, dustY + 0.55, z1 + flip * margin),
        new THREE.Vector3(runX, cruiseY * 0.85 + dustY * 0.15, z1 + flip * (lead * 0.4)),
        new THREE.Vector3(runX, cruiseY, z1 + flip * lead),
      ];
    }
    return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35);
  }

  function planFlyoverCurve(altBoost) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    const baseAlt = Math.max(renderCloudHeight + 0.5, FLIGHT_CRUISE_ALT) + (altBoost || 0);
    const z = target.z + (Math.random() - 0.5) * 4;
    const start = new THREE.Vector3(target.x + dir * FLIGHT_OFFSCREEN_DIST, baseAlt, z);
    const mid = new THREE.Vector3(target.x, baseAlt + 0.4, z + dir * 0.6);
    const end = new THREE.Vector3(target.x - dir * FLIGHT_OFFSCREEN_DIST, baseAlt, z);
    return new THREE.CatmullRomCurve3([start, mid, end], false, 'catmullrom', 0.25);
  }

  // Banner planes fly behind the island (~2 island-lengths back from the
  // camera-facing edge) and a touch lower so the trailing banner stays
  // visible against the sky rather than over the build area.
  function planBannerCurve() {
    const dir = Math.random() < 0.5 ? -1 : 1;
    // Lower than the standard cruise alt, but still above the tallest
    // structures + clouds.
    const baseAlt = Math.max(renderCloudHeight + 0.2, FLIGHT_CRUISE_ALT - 1.6);
    // Back side of the island is at -GRID/2 in world Z (front-facing side
    // is +Z). Push back another ~2 grid widths.
    const behindZ = target.z - (GRID * 0.5) - (GRID * 2);
    const start = new THREE.Vector3(target.x + dir * FLIGHT_OFFSCREEN_DIST, baseAlt, behindZ);
    const mid   = new THREE.Vector3(target.x,                                  baseAlt + 0.25, behindZ + dir * 0.4);
    const end   = new THREE.Vector3(target.x - dir * FLIGHT_OFFSCREEN_DIST, baseAlt, behindZ);
    return new THREE.CatmullRomCurve3([start, mid, end], false, 'catmullrom', 0.25);
  }

  function startDustingRun() {
    if (!renderPlanesEnabled || !cropDusterModel) return;
    const curve = planDustingCurve() || planFlyoverCurve(0);
    cropDusterState.curve = curve;
    cropDusterState.curveLen = curve.getLength();
    cropDusterState.travel = 0;
    cropDusterState.speed = FLIGHT_DUST_SPEED;
    cropDusterState.phase = 'flying';
    cropDusterState.isBanner = false;
    cropDusterState.numActivePlanes = 1;

    planes[0].group.visible = true;
    planes[0].localOffset.set(0, 0, 0);
    planes[0].group.position.copy(planes[0].localOffset);

    planes[1].group.visible = false;
    planes[2].group.visible = false;

    for (const p of planes) {
      if (p.bannerMesh) p.bannerMesh.visible = false;
      if (p.bannerWire) p.bannerWire.visible = false;
    }

    cropDusterRoot.visible = true;
  }

  function startBannerRun() {
    if (!renderPlanesEnabled || !cropDusterModel) return;
    cropDusterState.curve = planBannerCurve();
    cropDusterState.curveLen = cropDusterState.curve.getLength();
    cropDusterState.travel = 0;
    cropDusterState.speed = FLIGHT_CRUISE_SPEED * 0.85;
    cropDusterState.phase = 'banner';
    cropDusterState.isBanner = true;

    // 50% chance of V formation (3 planes) towing banners
    const isFormation = Math.random() < 0.5;
    cropDusterState.numActivePlanes = isFormation ? 3 : 1;

    // Setup lead plane
    planes[0].group.visible = true;
    planes[0].localOffset.set(0, 0, 0);
    planes[0].group.position.copy(planes[0].localOffset);

    const msgs = BANNER_MESSAGES.slice();
    const pickMsg = () => {
      const idx = Math.floor(Math.random() * msgs.length);
      const m = msgs[idx];
      msgs.splice(idx, 1);
      return m;
    };

    setPlaneBannerText(planes[0], pickMsg());
    if (planes[0].bannerMesh) planes[0].bannerMesh.visible = true;

    if (isFormation) {
      // Left wingman: offset left, slightly higher, and behind
      planes[1].group.visible = true;
      planes[1].localOffset.set(-2.2, 0.4, -2.2);
      planes[1].group.position.copy(planes[1].localOffset);
      setPlaneBannerText(planes[1], pickMsg());
      if (planes[1].bannerMesh) planes[1].bannerMesh.visible = true;

      // Right wingman: offset right, slightly lower, and behind
      planes[2].group.visible = true;
      planes[2].localOffset.set(2.2, -0.4, -2.2);
      planes[2].group.position.copy(planes[2].localOffset);
      setPlaneBannerText(planes[2], pickMsg());
      if (planes[2].bannerMesh) planes[2].bannerMesh.visible = true;
    } else {
      planes[1].group.visible = false;
      planes[2].group.visible = false;
      if (planes[1].bannerMesh) planes[1].bannerMesh.visible = false;
      if (planes[1].bannerWire) planes[1].bannerWire.visible = false;
      if (planes[2].bannerMesh) planes[2].bannerMesh.visible = false;
      if (planes[2].bannerWire) planes[2].bannerWire.visible = false;
    }

    cropDusterRoot.visible = true;
  }

  function startRefuel() {
    cropDusterRoot.visible = false;
    for (const p of planes) {
      if (p.bannerMesh) p.bannerMesh.visible = false;
      if (p.bannerWire) p.bannerWire.visible = false;
    }
    cropDusterState.phase = 'refuel-wait';
    cropDusterState.refuelTimer = FLIGHT_REFUEL_MIN
      + Math.random() * (FLIGHT_REFUEL_MAX - FLIGHT_REFUEL_MIN);
  }

  function startNextRun() {
    if (!renderPlanesEnabled || !cropDusterModel) return;
    const haveCrops = cropCellsForDusting().length > 0;
    if (activeSeason !== 'summer' || !haveCrops || Math.random() < FLIGHT_BANNER_CHANCE) {
      startBannerRun();
    } else {
      // Randomize materials for the lead plane
      const variantIdx = Math.floor(Math.random() * cropDusterMaterials.length);
      applyCropDusterMaterial(0, variantIdx);
      startDustingRun();
    }
  }

  function spawnCropDust(x, y, z) {
    if (cropDustParticles.length > 180) return;
    const initialOpacity = 0.52;
    const p = new THREE.Mesh(cropDustGeo, getCachedParticleMaterial(cropDustMat, initialOpacity));
    p.position.set(x + (Math.random() - 0.5) * 0.34, y, z + (Math.random() - 0.5) * 0.52);
    p.scale.setScalar(0.8 + Math.random() * 0.8);
    p.userData = {
      life: 0,
      maxLife: 1.8 + Math.random() * 0.8,
      vx: -0.22 - Math.random() * 0.28,
      vy: 0.03 + Math.random() * 0.05,
      vz: (Math.random() - 0.5) * 0.34,
    };
    setCachedParticleMaterial(p, cropDustMat, initialOpacity);
    xrWorldRoot.add(p);
    cropDustParticles.push(p);
  }

  function isOverCropCell(x, z) {
    const gx = Math.round(x + GRID / 2 - 0.5);
    const gz = Math.round(z + GRID / 2 - 0.5);
    return CROP_KINDS.has(getWorldCell(gx, gz).kind);
  }

  function updateCropDustParticles(dt) {
    for (let i = cropDustParticles.length - 1; i >= 0; i--) {
      const p = cropDustParticles[i];
      p.userData.life += dt;
      const u = p.userData.life / p.userData.maxLife;
      p.position.x += p.userData.vx * dt;
      p.position.y += p.userData.vy * dt;
      p.position.z += p.userData.vz * dt;
      setCachedParticleMaterial(p, cropDustMat, 0.52 * (1 - u));
      const s = 1 + u * 3.0;
      p.scale.set(s, s * 0.65, s);
      if (u >= 1) {
        if (p.parent) p.parent.remove(p);
        cropDustParticles.splice(i, 1);
      }
    }
  }

  function updateCropDuster(dt) {
    if (!renderPlanesEnabled) return;
    if (!cropDusterModel) {
      loadCropDuster();
      return;
    }
    updateCropDustParticles(dt);
    spinAllPropellers(dt);
    cropDusterTime += dt;

    if (cropDusterState.phase === 'idle') {
      startNextRun();
    }

    if (cropDusterState.phase === 'refuel-wait') {
      cropDusterState.refuelTimer -= dt;
      if (cropDusterState.refuelTimer <= 0) startNextRun();
      return;
    }

    const curve = cropDusterState.curve;
    if (!curve) return;
    cropDusterState.travel += cropDusterState.speed * dt;
    if (cropDusterState.travel >= cropDusterState.curveLen) {
      startRefuel();
      return;
    }

    const u = cropDusterState.travel / cropDusterState.curveLen;
    curve.getPointAt(u, _flightPos);
    curve.getTangentAt(u, _flightTan);

    const yaw = Math.atan2(_flightTan.x, _flightTan.z);
    const horiz = Math.hypot(_flightTan.x, _flightTan.z);
    const pitch = Math.max(-0.22, Math.min(0.22, Math.atan2(_flightTan.y, Math.max(0.001, horiz))));

    const uAhead = Math.min(1, u + 0.005);
    curve.getTangentAt(uAhead, _flightAhead);
    let dYaw = Math.atan2(_flightAhead.x, _flightAhead.z) - yaw;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    const bank = Math.max(-0.55, Math.min(0.55, -dYaw * 16))
      + Math.sin(cropDusterTime * 1.6) * 0.03;

    const bob = Math.sin(cropDusterTime * 3.0) * 0.04;
    cropDusterRoot.position.set(_flightPos.x, _flightPos.y + bob, _flightPos.z);
    cropDusterRoot.rotation.set(pitch, yaw, bank);

    if (cropDusterState.isBanner) {
      const tanX = _flightTan.x, tanZ = _flightTan.z;
      for (let i = 0; i < cropDusterState.numActivePlanes; i++) {
        const p = planes[i];
        if (!p.group.visible || !p.bannerMesh) continue;
        
        const worldPos = new THREE.Vector3();
        p.group.getWorldPosition(worldPos);

        const tailOffset = 0.55;
        const tailX = worldPos.x - tanX * tailOffset;
        const tailY = worldPos.y - 0.05;
        const tailZ = worldPos.z - tanZ * tailOffset;
        const wireLen = 1.25;
        const leadX = tailX - tanX * wireLen;
        const leadY = tailY - 0.35;
        const leadZ = tailZ - tanZ * wireLen;

        p.bannerMesh.position.set(leadX, leadY, leadZ);
        p.bannerMesh.rotation.set(0, yaw - Math.PI / 2, 0);
        updatePlaneBannerFlap(p, cropDusterTime);

        if (p.bannerWire) {
          p.bannerWire.visible = true;
          const wp = p.bannerWire.geometry.attributes.position;
          const arr = wp.array;
          arr[0] = tailX; arr[1] = tailY; arr[2] = tailZ;
          arr[3] = leadX; arr[4] = leadY; arr[5] = leadZ;
          wp.needsUpdate = true;
        }
      }
    }

    if (!cropDusterState.isBanner && _flightPos.y < FLIGHT_DUST_ALT + 0.55) {
      const planeX = cropDusterRoot.position.x;
      const planeZ = cropDusterRoot.position.z;
      const window = 0.6;
      for (const key of cropPositions) {
        const [x, z] = key.split(',').map(Number);
        if (x < 0 || x >= GRID || z < 0 || z >= GRID) continue;
        const c = getWorldCell(x, z);
        if (!CROP_KINDS.has(c.kind)) continue;
        const p = tilePos(x, z);
        const along = cropDusterPassAxis === 'x' ? p.x - planeX : p.z - planeZ;
        if (Math.abs(along) > window) continue;
        if (cropDustParticles.length > 220) break;
        spawnCropDust(
          p.x + (Math.random() - 0.5) * 0.34,
          0.72 + Math.random() * 0.10,
          p.z + (Math.random() - 0.5) * 0.34,
        );
      }
    }
  }

  if (renderPlanesEnabled) loadCropDuster();

