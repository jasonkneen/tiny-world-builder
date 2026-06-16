  // Tinyverse — avatar picker: a pixel/retro gallery for choosing your in-world
  // avatar. It DRIVES the existing class system (WS.setAvatarClass / WS.avatarClasses
  // / WS.avatarClass, defined in 47-worlds-room.js) — it does NOT reimplement avatar
  // switching. Opened from the HUD's person button (48) via WS.openAvatarPicker().
  //
  // Extensible via a provider registry (WS.registerAvatarProvider). A provider mirrors
  // @open-pets/client's pet shape so open-pets pets can plug in as a second category
  // later without touching this file:
  //   provider = { id, label, list(): item[], current(): id|null, select(id) }
  //   item     = { id, displayName, builtIn?, broken?, thumb? }   // thumb: inline CSS
  // (item mirrors @open-pets/client OpenPetsPetListItem { id, displayName, builtIn,
  //  broken }; `thumb` is a background style string for the card preview. An open-pets
  //  provider would call createOpenPetsClient().listPets() in a desktop/Electron host
  //  and map pets -> items, then WS.registerAvatarProvider(it).)
  //
  // NO emoji — all glyphs are SVG via WS.icon. IIFE-wrapped; no globals leak.
  (function wireWorldsAvatarPicker() {
    'use strict';
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const WS = (window.__tinyworldWorlds = window.__tinyworldWorlds || {});
    function T(k, p) { return typeof window.t === 'function' ? window.t(k, p) : k; }
    function on(ev, cb) { if (typeof WS.on === 'function') WS.on(ev, cb); }
    function ic(name, size) { return typeof WS.icon === 'function' ? WS.icon(name, size) : document.createElement('span'); }

    function el(tag, attrs, kids) {
      const n = document.createElement(tag);
      if (attrs) for (const k of Object.keys(attrs)) {
        if (k === 'class') n.className = attrs[k];
        else if (k === 'text') n.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
        else n.setAttribute(k, attrs[k]);
      }
      if (kids) for (const c of [].concat(kids)) if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      return n;
    }
    function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

    // ---- provider registry ----
    // NOTE: picker UI state is declared up here (not lower down) because
    // WS.registerAvatarProvider references `picker`, and providers register at load
    // BEFORE the UI section runs — a `let` declared later would throw a TDZ
    // ReferenceError and silently abort this whole module (avatar button = no-op).
    let picker = null, gridEl = null, tabsEl = null, activeProviderId = 'classes', voxelPreview = null;
    const providers = [];
    WS.registerAvatarProvider = function (p) {
      if (!p || !p.id || typeof p.list !== 'function' || typeof p.select !== 'function') return null;
      const i = providers.findIndex(x => x.id === p.id);
      if (i >= 0) providers[i] = p; else providers.push(p);
      if (picker) renderTabs();
      return p;
    };

    // A sprite-sheet idle frame-0 as a pixel-art thumbnail. Matches 47's SHEET.idle:
    // 768x512, 12 cols x 8 rows, 64px cells; row 0 / col 0 = idle facing the camera.
    // 84px box × scale 84/64 → background 1008×672 so exactly one cell shows.
    function classThumb(className) {
      const url = (className && className !== 'template')
        ? 'models/people/25D/classes/' + encodeURIComponent(className) + '/idle.png'
        : 'models/people/25D/idle/Sprite Sheet/idle full sprite sheet (transparent BG).png';
      return "background-image:url('" + url + "');background-repeat:no-repeat;background-size:1008px 672px;background-position:0 0";
    }

    // Built-in "classes" provider over the existing 47 class API.
    WS.registerAvatarProvider({
      id: 'classes',
      label: T('worlds.avatarClasses'),
      list() {
        const names = (typeof WS.avatarClasses === 'function') ? WS.avatarClasses() : [];
        return names.map(n => ({ id: n, displayName: cap(n), builtIn: true, broken: false, thumb: classThumb(n) }));
      },
      current() { return (typeof WS.avatarClass === 'function') ? WS.avatarClass() : null; },
      select(id) { if (typeof WS.setAvatarClass === 'function') WS.setAvatarClass(id); },
    });

    // open-pets pets vendored under models/pets/<id>/ (pet.json + spritesheet, the
    // @open-pets/pet-format atlas). Add an entry here per vendored pet. Selecting one
    // drives WS.setAvatarPet (47) to render it in-world as a billboard.
    const PETS = [
      { id: 'boba', displayName: 'Boba', dir: 'models/pets/boba/', sheet: 'spritesheet.webp', fw: 192, fh: 208, cols: 8, rows: 9 },
    ];
    function petThumb(p) {
      // frame 0 (top-left) of the atlas scaled so one cell width fits the 84px box.
      const sc = 84 / p.fw;
      return "background-image:url('" + p.dir + p.sheet + "');background-repeat:no-repeat;background-size:" +
        Math.round(p.cols * p.fw * sc) + "px " + Math.round(p.rows * p.fh * sc) + "px;background-position:0 0";
    }
    // REMOVED: the 'pets' avatar category is hidden from the picker for now.
    // Re-enable by un-commenting this registration (PETS data above is kept).
    // if (PETS.length) {
    //   WS.registerAvatarProvider({
    //     id: 'pets',
    //     label: T('worlds.avatarPets'),
    //     list() { return PETS.map(p => ({ id: p.id, displayName: p.displayName, builtIn: false, broken: false, thumb: petThumb(p) })); },
    //     current() { return (typeof WS.avatarPet === 'function') ? WS.avatarPet() : null; },
    //     select(id) { if (typeof WS.setAvatarPet === 'function') WS.setAvatarPet(id); },
    //   });
    // }

    // Side-view STRIP packs (driven by WS.setAvatarStrip / WS.avatarStrip / WS.strips in
    // 47). Each `idle` sheet is a 64px grid: columns are frames, rows are
    // directions. `idleFrames` sizes the thumbnail so one 64px cell shows.
    // ids must match 47's STRIPS keys.
    const STRIP_PACKS = {
      warriors: [
        { id: 'swordsman-l1', displayName: 'Swordsman Lv 1', level: 1, idle: 'models/people/swordsman/PNG/Swordsman_lvl1/Without_shadow/Swordsman_lvl1_Idle_without_shadow.png', idleFrames: 12 },
        { id: 'swordsman-l2', displayName: 'Swordsman Lv 2', level: 2, idle: 'models/people/swordsman/PNG/Swordsman_lvl2/Without_shadow/Swordsman_lvl2_Idle_without_shadow.png', idleFrames: 12 },
        { id: 'swordsman-l3', displayName: 'Swordsman Lv 3', level: 3, idle: 'models/people/swordsman/PNG/Swordsman_lvl3/Without_shadow/Swordsman_lvl3_Idle_without_shadow.png', idleFrames: 12 },
        { id: 'swordsman-l4', displayName: 'Swordsman Lv 4', level: 4, idle: 'models/people/swordsman/PNG/Swordsman_lvl4/Without_shadow/lvl4_Idle_without_shadow.png', idleFrames: 12 },
        { id: 'swordsman-l5', displayName: 'Swordsman Lv 5', level: 5, idle: 'models/people/swordsman/PNG/Swordsman_lvl5/Without_shadow/lvl5_Idle_without_shadow.png', idleFrames: 12 },
        { id: 'swordsman-l6', displayName: 'Swordsman Lv 6', level: 6, idle: 'models/people/swordsman/PNG/Swordsman_lvl6/Without_shadow/lvl6_Idle_without_shadow.png', idleFrames: 12 },
      ],
      orcs: [
        { id: 'orc-1', displayName: 'Orc 1', level: null, idle: 'models/people/orcs/PNG/Orc1/Without_shadow/orc1_idle_without_shadow.png', idleFrames: 4 },
        { id: 'orc-2', displayName: 'Orc 2', level: null, idle: 'models/people/orcs/PNG/Orc2/Without_shadow/orc2_idle_without_shadow.png', idleFrames: 4 },
        { id: 'orc-3', displayName: 'Orc 3', level: null, idle: 'models/people/orcs/PNG/Orc3/Without_shadow/orc3_idle_without_shadow.png', idleFrames: 4 },
      ],
    };
    function stripThumb(p) {
      // frame 0 of a single-row 64x256 idle sheet, scaled so one 64px cell fits the 84px box.
      const sc = 84 / 64;
      return "background-image:url('" + p.idle + "');background-repeat:no-repeat;background-size:" +
        Math.round(p.idleFrames * 64 * sc) + "px " + Math.round(256 * sc) + "px;background-position:0 0";
    }
    // REMOVED: the 'warriors' and 'orcs' avatar categories are hidden from the
    // picker for now. Re-enable by un-commenting these registrations (the
    // STRIP_PACKS data above is kept).
    // WS.registerAvatarProvider({
    //   id: 'warriors',
    //   label: T('worlds.avatarWarriors'),
    //   list() { return STRIP_PACKS.warriors.map(p => ({ id: p.id, displayName: p.displayName, builtIn: false, broken: false, thumb: stripThumb(p) })); },
    //   current() { return (typeof WS.avatarStrip === 'function') ? WS.avatarStrip() : null; },
    //   select(id) { if (typeof WS.setAvatarStrip === 'function') WS.setAvatarStrip(id); },
    // });
    // WS.registerAvatarProvider({
    //   id: 'orcs',
    //   label: T('worlds.avatarOrcs'),
    //   list() { return STRIP_PACKS.orcs.map(p => ({ id: p.id, displayName: p.displayName, builtIn: false, broken: false, thumb: stripThumb(p) })); },
    //   current() { return (typeof WS.avatarStrip === 'function') ? WS.avatarStrip() : null; },
    //   select(id) { if (typeof WS.setAvatarStrip === 'function') WS.setAvatarStrip(id); },
    // });

    // ---- voxel avatars (real 3D voxel people — the networked identity) ----
    // Drives WS.setAvatarVoxel / WS.avatarVoxel (47), which stores a fully-resolved
    // descriptor and sends it on world.join so other clients render THIS look. A small
    // set of hand-tuned presets plus a "Randomize" tile (random seed -> fresh look).
    // Descriptors are resolved through window.voxelAvatarDescriptor (53) so the stored
    // form is complete and round-trips bit-identically to peers. Thumbs are simple CSS
    // color swatches (the voxel body is 3D — there's no sprite sheet to slice).
    const VOXEL_PRESETS = [
      { id: 'vx-scout', displayName: 'Scout', spec: { seed: 11, body: 'Masc', fit: 'Scout', skin: 1, hairC: 1, head: 'Wide', hair: 'Short', height: 1, build: -1, gear: 'Sword' }, swatch: '#5d8a4a' },
      { id: 'vx-knight', displayName: 'Knight', spec: { seed: 22, body: 'Masc', fit: 'Knight', skin: 2, hairC: 0, head: 'Wide', hair: 'Buzz', height: 1.08, build: 1, gear: 'SwordShield' }, swatch: '#526074' },
      { id: 'vx-archer', displayName: 'Archer', spec: { seed: 33, body: 'Fem', fit: 'Archer', skin: 0, hairC: 3, head: 'Slim', hair: 'Tail', height: 0.96, build: -2, gear: 'Bow' }, swatch: '#476f3a' },
      { id: 'vx-mage', displayName: 'Mage', spec: { seed: 44, body: 'Fem', fit: 'Mage', skin: 3, hairC: 5, head: 'Slim', hair: 'Page', height: 1.03, build: 0, gear: 'Staff' }, swatch: '#47306f' },
      { id: 'vx-miner', displayName: 'Miner', spec: { seed: 55, body: 'Masc', fit: 'Miner', skin: 4, hairC: 1, head: 'Wide', hair: 'Bald', height: 0.92, build: 2, gear: 'Pickaxe' }, swatch: '#c58a39' },
      { id: 'vx-rogue', displayName: 'Rogue', spec: { seed: 66, body: 'Fem', fit: 'Rogue', skin: 3, hairC: 0, head: 'Wide', hair: 'Bob', height: 0.98, build: -1, gear: 'Sword' }, swatch: '#3f4b4e' },
      { id: 'vx-barb', displayName: 'Barbarian', spec: { seed: 77, body: 'Masc', fit: 'Barbarian', skin: 4, hairC: 4, head: 'Wide', hair: 'Mohawk', height: 1.16, build: 2, gear: 'Axe' }, swatch: '#8a4b2a' },
      { id: 'vx-sky', displayName: 'Skyfarer', spec: { seed: 88, body: 'Masc', fit: 'Skyfarer', skin: 1, hairC: 6, head: 'Slim', hair: 'Curls', height: 1.04, build: 0, gear: 'Shield' }, swatch: '#5f86b6' },
      // Hooded rogue — the cheeky cowled adventurer (grin + brows + blush ride on the
      // HoodedRogue outfit's facePreset, so just naming the fit reproduces the look).
      { id: 'vx-hooded', displayName: 'Hooded Rogue', spec: { seed: 99, body: 'Masc', fit: 'HoodedRogue', skin: 1, height: 1, build: 0, gear: 'None' }, swatch: '#2b2d33' },
      { id: 'vx-random', displayName: 'Randomize', random: true, swatch: '#7bdc2e' },
    ];
    function voxelDesc(spec) {
      return (typeof window.voxelAvatarDescriptor === 'function')
        ? window.voxelAvatarDescriptor(spec)
        : Object.assign({ kind: 'voxel' }, spec);
    }
    function voxelThumb(p) {
      // a flat color swatch with a subtle inner shading so cards read as distinct.
      return 'background:linear-gradient(135deg,' + p.swatch + ' 0%,' + p.swatch + ' 60%,rgba(0,0,0,.35) 100%)';
    }
    // Register the voxel provider at LOAD time (no guard): this file loads BEFORE
    // 53-voxel-avatar.js, so window.voxelAvatarDescriptor is undefined here — a
    // load-time guard would permanently skip the tab. Both cross-file deps are
    // deferred to call-time (post-load): voxelDesc() falls back if 53 is missing, and
    // select() guards WS.setAvatarVoxel. list()/voxelThumb have no cross-file deps.
    // Track "current" by preset id (the room stores a full descriptor, not a preset
    // id); Randomize never stays "selected".
    let voxelCurrentId = null;
    // Use the i18n key if a locale defines one; otherwise a safe English fallback
    // (this file doesn't own engine/i18n/*, so it must not REQUIRE a new key).
    const trVoxel = (k, fb) => { const v = T(k); return (v && v !== k) ? v : fb; };
    WS.registerAvatarProvider({
      id: 'voxel',
      label: trVoxel('worlds.avatarVoxel', 'Voxel'),
      list() { return VOXEL_PRESETS.map(p => ({ id: p.id, displayName: p.displayName, builtIn: true, broken: false, thumb: voxelThumb(p) })); },
      current() { return voxelCurrentId; },
      select(id) {
        if (typeof WS.setAvatarVoxel !== 'function') return;
        const p = VOXEL_PRESETS.find(x => x.id === id);
        if (!p) return;
        if (p.random) {
          const VD = window.voxelAvatarDescriptor || {};
          const gears = (VD.GEARS && VD.GEARS.length) ? VD.GEARS : ['None', 'Sword', 'Bow', 'Shield', 'SwordShield', 'Axe', 'Staff', 'Pickaxe'];
          const heights = (VD.HEIGHTS && VD.HEIGHTS.length) ? VD.HEIGHTS : [{ value: 0.88 }, { value: 1 }, { value: 1.13 }];
          const builds = (VD.BUILDS && VD.BUILDS.length) ? VD.BUILDS : [{ value: -2 }, { value: -1 }, { value: 0 }, { value: 1 }, { value: 2 }];
          WS.setAvatarVoxel(voxelDesc({
            seed: (Math.random() * 0xffffffff) >>> 0,
            height: heights[(Math.random() * heights.length) | 0].value,
            build: builds[(Math.random() * builds.length) | 0].value,
            gear: gears[(Math.random() * gears.length) | 0],
          }));
          voxelCurrentId = null;
        }
        else { WS.setAvatarVoxel(voxelDesc(p.spec)); voxelCurrentId = id; }
      },
    });

    // ---- live 3D voxel customizer (per-attribute gear/clothes choice + rotating preview) ----
    // Built ONCE (lazily, first time the Voxel tab opens) and reused. Renders a single
    // makeVoxelAvatar (53) into a small WebGL canvas; changing any attribute disposes and
    // rebuilds that one avatar so you SEE the gear/clothes before committing. The working
    // descriptor reaches the real networked avatar only on "Use This Look" (WS.setAvatarVoxel).
    // Self-manages its rAF (start/stop) so no hidden WebGL loop runs when the tab/modal is
    // closed; dispose() frees the GL context on room-leave. Returns null (caller falls back
    // to preset cards) if THREE or 53 aren't available yet.
    function buildVoxelPreview() {
      if (voxelPreview) return voxelPreview;
      if (typeof THREE === 'undefined' || typeof window.makeVoxelAvatar !== 'function') return null;

      const VD = window.voxelAvatarDescriptor || {};
      const BODIES = ['Masc', 'Fem'];
      const HEADS = ['Wide', 'Slim'];
      const HAIRS = (VD.HAIRS && VD.HAIRS.length) ? VD.HAIRS.slice() : ['Buzz', 'Short', 'Spike', 'Mohawk', 'Curls', 'Page', 'Bob', 'Tail', 'Knot', 'Bald'];
      const OUTFITS = (VD.OUTFITS && VD.OUTFITS.length) ? VD.OUTFITS.slice() : ['Casual', 'Formal', 'Scout', 'Sport', 'Rogue', 'Barbarian', 'Knight', 'Archer', 'Mage', 'Miner', 'Skyfarer'];
      const GEARS = (VD.GEARS && VD.GEARS.length) ? VD.GEARS.slice() : ['None', 'Sword', 'Bow', 'Shield', 'SwordShield', 'Axe', 'Staff', 'Pickaxe'];
      const HEIGHTS = (VD.HEIGHTS && VD.HEIGHTS.length) ? VD.HEIGHTS.slice() : [
        { value: 0.88, label: 'Short' },
        { value: 1, label: 'Average' },
        { value: 1.13, label: 'Tall' },
      ];
      const BUILDS = (VD.BUILDS && VD.BUILDS.length) ? VD.BUILDS.slice() : [
        { value: -2, label: 'Thin' },
        { value: -1, label: 'Lean' },
        { value: 0, label: 'Average' },
        { value: 1, label: 'Stocky' },
        { value: 2, label: 'Fat' },
      ];
      const NSKIN = VD.SKINS || 5;
      const NHAIRC = VD.HAIRC || 7;

      // working look — seeded from the first preset so the tab opens on a sensible avatar.
      const base = (VOXEL_PRESETS[0] && VOXEL_PRESETS[0].spec) || {};
      const state = {
        seed: 0xC0FFEE, body: base.body || 'Masc', head: base.head || 'Wide',
        skin: base.skin || 0, hairC: base.hairC != null ? base.hairC : 0, hair: base.hair || 'Short', fit: base.fit || 'Casual',
        height: base.height != null ? base.height : 1, build: base.build != null ? base.build : 0, gear: base.gear || 'None',
      };

      // --- THREE preview scene ---
      const canvas = el('canvas', { class: 'tw-avp-vox-canvas' });
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(220, 240, false);
      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(30, 220 / 240, 0.01, 50);
      cam.position.set(0, 0.30, 1.35);
      cam.lookAt(0, 0.26, 0);
      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(0.6, 1.2, 0.8); scene.add(key);
      const rim = new THREE.DirectionalLight(0x9fc0ff, 0.4); rim.position.set(-0.8, 0.4, -0.6); scene.add(rim);
      const turn = new THREE.Group(); scene.add(turn);   // spins the avatar

      let avatar = null;
      function rebuild() {
        if (avatar) { try { avatar.dispose(); } catch (_) {} avatar = null; }
        avatar = window.makeVoxelAvatar({ ...state });
        if (avatar) { avatar.setState('idle'); turn.add(avatar.group); }
      }
      rebuild();

      // --- rAF loop (auto-rotate + the rig's idle breathing/blink) ---
      let raf = 0, last = 0, running = false;
      function frame(now) {
        if (!running) { raf = 0; return; }
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
        turn.rotation.y += dt * 0.7;
        if (avatar) avatar.update(dt);
        renderer.render(scene, cam);
        raf = requestAnimationFrame(frame);
      }
      function start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
      function stop() { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } }

      // --- per-attribute controls (cycle prev/next; each change rebuilds the preview) ---
      const valSpans = {};
      function itemLabel(list, value) {
        const item = list.find(x => x.value === value);
        if (item) return item.label;
        return Number.isFinite(value) ? Math.round(value * 100) + '%' : String(value);
      }
      function itemIndex(list, value) {
        const idx = list.findIndex(x => x.value === value);
        if (idx >= 0) return idx;
        if (Number.isFinite(value)) {
          let best = 0, bestD = Infinity;
          list.forEach((x, i) => {
            const d = Math.abs(Number(x.value) - value);
            if (Number.isFinite(d) && d < bestD) { best = i; bestD = d; }
          });
          return best;
        }
        return 0;
      }
      function applyResolved(desc) {
        if (!desc) return;
        state.seed = desc.seed;
        state.body = desc.body;
        state.head = desc.head;
        state.skin = desc.skin;
        state.hairC = desc.hairC;
        state.hair = desc.hair;
        state.fit = desc.fit;
        state.height = desc.height || 1;
        state.build = desc.build || 0;
        state.gear = desc.gear || 'None';
        refresh(); rebuild();
      }
      function valueOf(k) {
        if (k === 'skin') return trVoxel('worlds.avatarTone', 'Tone') + ' ' + (state.skin + 1);
        if (k === 'hairC') return trVoxel('worlds.avatarColour', 'Colour') + ' ' + (state.hairC + 1);
        if (k === 'height') return itemLabel(HEIGHTS, state.height);
        if (k === 'build') return itemLabel(BUILDS, state.build);
        if (k === 'gear') {
          if (state.gear === 'SwordShield') return 'Sword + Shield';
          if (state.gear === 'Bow') return 'Bow + Quiver';
          return cap(state.gear);
        }
        return cap(state[k]);
      }
      function refresh() { for (const k in valSpans) valSpans[k].textContent = valueOf(k); }
      function cycle(k, dir) {
        if (k === 'body') state.body = BODIES[(BODIES.indexOf(state.body) + dir + BODIES.length) % BODIES.length];
        else if (k === 'head') state.head = HEADS[(HEADS.indexOf(state.head) + dir + HEADS.length) % HEADS.length];
        else if (k === 'hair') state.hair = HAIRS[(HAIRS.indexOf(state.hair) + dir + HAIRS.length) % HAIRS.length];
        else if (k === 'fit') state.fit = OUTFITS[(OUTFITS.indexOf(state.fit) + dir + OUTFITS.length) % OUTFITS.length];
        else if (k === 'height') state.height = HEIGHTS[(itemIndex(HEIGHTS, state.height) + dir + HEIGHTS.length) % HEIGHTS.length].value;
        else if (k === 'build') state.build = BUILDS[(itemIndex(BUILDS, state.build) + dir + BUILDS.length) % BUILDS.length].value;
        else if (k === 'gear') state.gear = GEARS[(GEARS.indexOf(state.gear) + dir + GEARS.length) % GEARS.length];
        else if (k === 'skin') state.skin = (state.skin + dir + NSKIN) % NSKIN;
        else if (k === 'hairC') state.hairC = (state.hairC + dir + NHAIRC) % NHAIRC;
        refresh(); rebuild();
      }
      function row(k, label) {
        const v = el('span', { class: 'tw-avp-vox-val', text: valueOf(k) });
        valSpans[k] = v;
        return el('div', { class: 'tw-avp-vox-row' }, [
          el('span', { class: 'tw-avp-vox-lab', text: label }),
          el('button', { class: 'tw-avp-vox-arrow', 'aria-label': 'previous ' + label, onclick: () => cycle(k, -1) }, ['‹']),
          v,
          el('button', { class: 'tw-avp-vox-arrow', 'aria-label': 'next ' + label, onclick: () => cycle(k, 1) }, ['›']),
        ]);
      }
      const controls = el('div', { class: 'tw-avp-vox-controls' }, [
        row('body', trVoxel('worlds.avatarBody', 'Body')),
        row('height', trVoxel('worlds.avatarHeight', 'Height')),
        row('build', trVoxel('worlds.avatarBuild', 'Build')),
        row('head', trVoxel('worlds.avatarHead', 'Head')),
        row('skin', trVoxel('worlds.avatarSkin', 'Skin')),
        row('hair', trVoxel('worlds.avatarHair', 'Hair')),
        row('hairC', trVoxel('worlds.avatarHairColour', 'Hair Colour')),
        row('fit', trVoxel('worlds.avatarOutfit', 'Outfit')),
        row('gear', trVoxel('worlds.avatarGear', 'Gear')),
      ]);

      // preset quick-starts: seed the customizer from a hand-tuned look, then tweak.
      const quick = el('div', { class: 'tw-avp-vox-quick' },
        VOXEL_PRESETS.filter(p => !p.random).map(p => el('button', {
          class: 'tw-avp-vox-chip', title: p.displayName, style: 'background:' + p.swatch,
          onclick: () => { applyResolved(voxelDesc(p.spec)); },
        }, [p.displayName])));

      const useBtn = el('button', {
        class: 'tw-avp-vox-use', onclick: () => {
          if (typeof WS.setAvatarVoxel === 'function') WS.setAvatarVoxel(voxelDesc({ ...state }));
          voxelCurrentId = null;
          if (typeof window.twToast === 'function') window.twToast(trVoxel('worlds.avatarApplied', 'Avatar saved'));
          // Signal a deliberate save BEFORE closing so a pending entry flow
          // (Tinyverse gate) resolves on save, not on the trailing close event.
          try { window.dispatchEvent(new CustomEvent('tinyworld:avatar-saved')); } catch (_) {}
          closePicker();
        },
      }, [trVoxel('worlds.avatarUseLook', 'Save Avatar')]);
      const randBtn = el('button', {
        class: 'tw-avp-vox-rand', onclick: () => {
          applyResolved(voxelDesc({
            seed: (Math.random() * 0xffffffff) >>> 0,
            height: HEIGHTS[(Math.random() * HEIGHTS.length) | 0].value,
            build: BUILDS[(Math.random() * BUILDS.length) | 0].value,
            gear: GEARS[(Math.random() * GEARS.length) | 0],
          }));
        },
      }, [trVoxel('worlds.avatarRandom', 'Randomize')]);

      const root = el('div', { class: 'tw-avp-vox' }, [
        el('div', { class: 'tw-avp-vox-stage' }, [canvas]),
        el('div', { class: 'tw-avp-vox-side' }, [
          controls,
          el('div', { class: 'tw-avp-vox-btns' }, [randBtn, useBtn]),
          quick,
        ]),
      ]);

      injectVoxStyles();
      voxelPreview = {
        el: root, start, stop,
        dispose() {
          stop();
          if (avatar) { try { avatar.dispose(); } catch (_) {} avatar = null; }
          try { renderer.dispose(); } catch (_) {}
          voxelPreview = null;
        },
      };
      return voxelPreview;
    }

    function injectVoxStyles() {
      if (document.getElementById('tw-avp-vox-style')) return;
      const css = `
  .tw-avp-vox{display:flex;gap:14px;flex-wrap:wrap}
  .tw-avp-vox-stage{flex:0 0 auto;width:220px;height:240px;border-radius:6px;
    background:radial-gradient(120% 120% at 50% 30%,#1b2742 0%,#0a0f1c 100%);
    box-shadow:inset 2px 2px 0 #2b3350, inset -2px -2px 0 #05070e;display:flex;align-items:center;justify-content:center}
  .tw-avp-vox-canvas{width:220px;height:240px;display:block}
  .tw-avp-vox-side{flex:1 1 220px;min-width:200px;display:flex;flex-direction:column;gap:8px}
  .tw-avp-vox-controls{display:flex;flex-direction:column;gap:6px}
  .tw-avp-vox-row{display:grid;grid-template-columns:1fr auto auto auto;align-items:center;gap:6px;background:#0e1120;padding:5px 8px;border-radius:8px;
    box-shadow:inset 1px 1px 0 #2b3350, inset -1px -1px 0 #05070e}
  .tw-avp-vox-lab{text-transform:uppercase;letter-spacing:.05em;font-size:12px;color:#cfd8f5}
  .tw-avp-vox-val{min-width:108px;text-align:center;font-size:13px;color:#fff}
  .tw-avp-vox-arrow{border:0;cursor:pointer;color:#fff;background:#2b59d6;width:28px;height:28px;border-radius:6px;font-size:16px;line-height:1;
    box-shadow:inset 1px 1px 0 rgba(255,255,255,.25), inset -1px -1px 0 rgba(0,0,0,.45);transition:filter .08s,transform .04s}
  .tw-avp-vox-arrow:hover{filter:brightness(1.15)} .tw-avp-vox-arrow:active{transform:translateY(1px)}
  .tw-avp-vox-btns{display:flex;gap:8px;margin-top:2px}
  .tw-avp-vox-use{flex:1;border:0;cursor:pointer;color:#fff;background:#54bd37;padding:11px;border-radius:8px;text-transform:uppercase;letter-spacing:.06em;font-size:13px;
    box-shadow:inset 2px 2px 0 rgba(255,255,255,.30), inset -2px -2px 0 rgba(0,0,0,.40), 0 2px 0 0 rgba(0,0,0,.4);transition:filter .08s,transform .04s}
  .tw-avp-vox-use:hover{filter:brightness(1.12)} .tw-avp-vox-use:active{transform:translateY(1px)}
  .tw-avp-vox-rand{border:0;cursor:pointer;color:#fff;background:#222a42;padding:11px 14px;border-radius:8px;text-transform:uppercase;letter-spacing:.06em;font-size:13px;
    box-shadow:inset 2px 2px 0 rgba(255,255,255,.16), inset -2px -2px 0 rgba(0,0,0,.45);transition:filter .08s}
  .tw-avp-vox-rand:hover{filter:brightness(1.15)}
  .tw-avp-vox-quick{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
  .tw-avp-vox-chip{border:0;cursor:pointer;color:#fff;font-size:11px;padding:7px 10px;border-radius:6px;text-transform:uppercase;letter-spacing:.04em;
    text-shadow:0 1px 1px rgba(0,0,0,.6);box-shadow:inset 1px 1px 0 rgba(255,255,255,.18), inset -1px -1px 0 rgba(0,0,0,.5)}
  .tw-avp-vox-chip:hover{filter:brightness(1.15)}
  `;
      document.head.appendChild(el('style', { id: 'tw-avp-vox-style', text: css }));
    }

    function injectStyles() {
      if (document.getElementById('tw-avp-style')) return;
      const css = `
  .tw-avp-backdrop{position:fixed;inset:0;z-index:95;display:none;align-items:center;justify-content:center;background:rgba(5,7,14,.62)}
  .tw-avp-backdrop.open{display:flex}
  .tw-avp{width:min(760px,94vw);max-height:86vh;overflow:auto;background:#161a2b;color:#eef3ff;
    font:700 13px 'Pixelify Sans',ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.04em;padding:18px 18px 20px;border-radius:4px;
    box-shadow:0 0 0 2px #05070e, inset 2px 2px 0 #38415f, inset -2px -2px 0 #0a0d18}
  .tw-avp-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .tw-avp-title{font-size:15px;text-transform:uppercase;letter-spacing:.08em;text-shadow:1px 1px 0 #05070e}
  .tw-avp-close{display:flex;align-items:center;justify-content:center;border:0;cursor:pointer;color:#dfe6ff;padding:7px;border-radius:3px;background:#222a42;
    box-shadow:inset 2px 2px 0 rgba(255,255,255,.16), inset -2px -2px 0 rgba(0,0,0,.45), 0 3px 0 0 rgba(0,0,0,.4);transition:filter .08s,transform .04s}
  .tw-avp-close:hover{filter:brightness(1.18)}
  .tw-avp-close:active{transform:translateY(2px)}
  .tw-avp-tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
  .tw-avp-tab{border:0;cursor:pointer;color:#cfd8f5;background:#222a42;padding:7px 12px;border-radius:10px;
    font:700 11px 'Pixelify Sans',ui-monospace,'SF Mono',Menlo,monospace;text-transform:uppercase;letter-spacing:.06em;
    box-shadow:inset 2px 2px 0 rgba(255,255,255,.12), inset -2px -2px 0 rgba(0,0,0,.45);transition:filter .08s}
  .tw-avp-tab:hover{filter:brightness(1.15)}
  .tw-avp-tab.active{color:#fff;background:#2b59d6;box-shadow:inset 2px 2px 0 rgba(255,255,255,.30), inset -2px -2px 0 rgba(0,0,0,.40)}
  .tw-avp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px}
  .tw-avp-card{position:relative;cursor:pointer;background:#0e1120;padding:10px 10px 12px;border-radius:10px;
    box-shadow:inset 2px 2px 0 #2b3350, inset -2px -2px 0 #05070e;transition:filter .1s,transform .05s}
  .tw-avp-card:hover{filter:brightness(1.16)}
  .tw-avp-card.sel{box-shadow:inset 0 0 0 2px #7bdc2e, inset 2px 2px 0 #2b3350, inset -2px -2px 0 #05070e}
  .tw-avp-thumb{width:84px;height:84px;margin:0 auto;background:#05070e;border-radius:2px;image-rendering:pixelated;
    box-shadow:inset 1px 1px 0 #2b3350, inset -1px -1px 0 #05070e}
  .tw-avp-name{margin-top:8px;text-align:center;text-transform:uppercase;letter-spacing:.05em;font-size:11px}
  .tw-avp-pick{margin-top:8px;width:100%;border:0;cursor:pointer;color:#fff;background:#54bd37;padding:6px;border-radius:10px;
    font:700 10px 'Pixelify Sans',ui-monospace,'SF Mono',Menlo,monospace;text-transform:uppercase;letter-spacing:.06em;
    box-shadow:inset 2px 2px 0 rgba(255,255,255,.30), inset -2px -2px 0 rgba(0,0,0,.40), 0 2px 0 0 rgba(0,0,0,.4);transition:filter .08s,transform .04s}
  .tw-avp-pick:hover{filter:brightness(1.12)}
  .tw-avp-pick:active{transform:translateY(1px)}
  .tw-avp-card.sel .tw-avp-pick{background:#243a52;color:#9bf05a}
  .tw-avp-badge{position:absolute;top:8px;right:8px;font-size:8px;letter-spacing:.08em;text-transform:uppercase;color:#9bf05a;background:#05140a;padding:2px 5px;border-radius:2px}
  .tw-avp-empty{opacity:.7;text-align:center;padding:24px 8px;text-transform:uppercase;letter-spacing:.05em;font-size:11px}
  /* Roomier dialog + larger type on desktop. */
  @media (min-width:1024px){
    .tw-avp{width:min(920px,90vw);font-size:14px;padding:24px 24px 26px}
    .tw-avp-title{font-size:20px}
    .tw-avp-tab{font-size:13px;padding:9px 16px}
    .tw-avp-vox{gap:20px}
    .tw-avp-vox-lab{font-size:13px}
    .tw-avp-vox-val{font-size:14px;min-width:120px}
    .tw-avp-vox-use,.tw-avp-vox-rand{font-size:14px}
    .tw-avp-vox-chip{font-size:12px}
  }
  `;
      document.head.appendChild(el('style', { id: 'tw-avp-style', text: css }));
    }

    function buildPicker() {
      if (picker) return;
      injectStyles();
      tabsEl = el('div', { class: 'tw-avp-tabs' });
      gridEl = el('div', { class: 'tw-avp-grid' });
      const panel = el('div', { class: 'tw-avp', onclick: (e) => e.stopPropagation() }, [
        el('div', { class: 'tw-avp-head' }, [
          el('div', { class: 'tw-avp-title', text: T('worlds.avatarTitle') }),
          el('button', { class: 'tw-avp-close', title: T('worlds.close'), 'aria-label': T('worlds.close'), onclick: closePicker }, [ic('close', 16)]),
        ]),
        tabsEl,
        gridEl,
      ]);
      picker = el('div', { class: 'tw-avp-backdrop', onclick: closePicker }, [panel]);
      document.body.appendChild(picker);
    }

    function activeProvider() {
      return providers.find(p => p.id === activeProviderId) || providers[0] || null;
    }

    function renderTabs() {
      if (!tabsEl) return;
      tabsEl.textContent = '';
      // Only show the tab bar when more than one *visible* category exists.
      // 'classes' is never rendered as a tab, so a lone remaining category
      // (e.g. only 'voxel') shows no tab bar — straight to its customizer.
      const visibleTabs = providers.filter(p => p.id !== 'classes').length;
      tabsEl.style.display = visibleTabs > 1 ? '' : 'none';
      if (!activeProvider()) activeProviderId = (providers[0] && providers[0].id) || 'classes';
      providers.forEach(p => {
        if (p.id === 'classes') return;
        tabsEl.appendChild(el('button', {
          class: 'tw-avp-tab' + (p.id === activeProviderId ? ' active' : ''),
          onclick: () => { activeProviderId = p.id; renderTabs(); renderGrid(); },
        }, [p.label || cap(p.id)]));
      });
    }

    function renderGrid() {
      if (!gridEl) return;
      gridEl.textContent = '';
      const prov = activeProvider();
      // Voxel tab: render the live 3D customizer (rotating preview + per-attribute gear/
      // clothes controls) instead of a static card grid. Falls back to cards if THREE/53
      // aren't ready. Other tabs halt the preview's WebGL loop so it never runs hidden.
      if (prov && prov.id === 'voxel') {
        const pv = buildVoxelPreview();
        if (pv) { gridEl.style.display = 'block'; gridEl.appendChild(pv.el); pv.start(); return; }
      } else if (voxelPreview) {
        voxelPreview.stop();
      }
      gridEl.style.display = '';
      const items = (prov && prov.list()) || [];
      const current = prov && typeof prov.current === 'function' ? prov.current() : null;
      if (!items.length) {
        gridEl.appendChild(el('div', { class: 'tw-avp-empty', text: '—' }));
        return;
      }
      items.forEach(it => {
        const selected = it.id === current;
        const thumb = el('div', { class: 'tw-avp-thumb' });
        if (it.thumb) thumb.setAttribute('style', it.thumb);
        const card = el('div', {
          class: 'tw-avp-card' + (selected ? ' sel' : '') + (it.broken ? ' broken' : ''),
          title: it.displayName,
          onclick: () => pick(prov, it.id),
        }, [
          it.builtIn ? null : el('span', { class: 'tw-avp-badge', text: 'NEW' }),
          thumb,
          el('div', { class: 'tw-avp-name', text: it.displayName }),
          el('button', { class: 'tw-avp-pick', onclick: (e) => { e.stopPropagation(); pick(prov, it.id); } },
            [selected ? T('worlds.avatarSelected') : T('worlds.avatarSelect')]),
        ]);
        gridEl.appendChild(card);
      });
    }

    function pick(prov, id) {
      if (!prov) return;
      try { prov.select(id); } catch (_) {}
      renderGrid();
    }

    function openPicker() {
      buildPicker();
      // Default to the 3D Voxel tab (goal: choose the "3D version not sprites") whenever it's
      // registered — the picker otherwise opens on the 2.5D sprite "classes" tab.
      if (providers.some((p) => p.id === 'voxel')) activeProviderId = 'voxel';
      renderTabs();
      renderGrid();
      picker.classList.add('open');
    }
    function closePicker() {
      if (picker) picker.classList.remove('open');
      if (voxelPreview) voxelPreview.stop();
      try { window.dispatchEvent(new CustomEvent('tinyworld:avatar-picker-closed')); } catch (_) {}
    }

    WS.openAvatarPicker = openPicker;
    WS.closeAvatarPicker = closePicker;

    on('leave', () => { closePicker(); if (voxelPreview) voxelPreview.dispose(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && picker && picker.classList.contains('open')) closePicker(); });
  })();
