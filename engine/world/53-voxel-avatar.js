  // -------- voxel avatars (real 3D voxel people, not 2.5D sprite "stripes") --------
  // A self-contained humanoid voxel-character builder. Exposes ONE global:
  //   window.makeVoxelAvatar(opts) -> { group, setHeading, setHeadingFromDelta,
  //                                     setState, update, dispose, cfg }
  // The voxel geometry/skin builders (mesher, wardrobe, face/hair) are ported from
  // voxel-poser.html (Three.js r128) but encapsulated PER-INSTANCE so many distinct
  // people can render at once — the source renders exactly one global singleton.
  //
  // v1 scope: static voxel geometry built ONCE at construction, animated purely by
  // rotating limb Groups (sinusoidal walk / idle / attack). No IK, no ragdoll, no
  // articulated fingers, no networked identity (skins are seeded locally from id).
  // IIFE-wrapped so NO top-level identifiers leak into the shared global scope
  // (tools/check.js fails the build on any duplicate top-level name).
  (function voxelAvatarBoot() {
    'use strict';
    if (typeof window === 'undefined') return;
    if (typeof THREE === 'undefined') { window.makeVoxelAvatar = function () { return null; }; return; }

    // Build the skeleton at 1 unit / voxel, then scale the root to AVATAR_HEIGHT.
    const VS = 1;
    // World scale: TILE=1, a house door is 0.48 tall, wall-per-floor 0.55. A person
    // reads right at roughly door height. The old 1.7 sprite had transparent padding
    // so its drawn body was much smaller than 1.7; a solid voxel body at 1.7 dwarfed
    // the doors. Build at ~0.62 so the figure stands a touch above a 0.48 door.
    const AVATAR_HEIGHT = 0.5;
    const _col = new THREE.Color();
    const _avatarSharedGeos = Object.create(null);
    const _avatarSharedMats = Object.create(null);

    // ---- deterministic per-voxel hash (subtle color jitter so flat color reads textured) ----
    function hash3(x, y, z) {
      const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
      return s - Math.floor(s);
    }
    function makePrng(seed) {
      let s = ((seed >>> 0) ^ 0x9e3779b9) >>> 0;
      return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
    }
    function clampInt(value, fallback, min, max) {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, Math.round(n)));
    }
    function clampNum(value, fallback, min, max) {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    }

    // ---- planar 2-bone IK (sagittal Y-Z plane) -> {hip, knee} rotation.x angles ----
    // Law-of-cosines, identical in-plane to voxel-poser's twoBone but emitting the
    // X-hinge angles this FK rig consumes directly. `dy,dz` = foot target relative to
    // the hip pivot (dy negative: foot below hip). U/F = thigh/shin lengths.
    // At rest (dz=0, dy=-(U+F)) this returns hip≈0, knee≈0 (legs straight down).
    function legIK(dy, dz, U, F) {
      let d = Math.hypot(dy, dz);
      d = Math.max(Math.abs(U - F) + 1e-4, Math.min(U + F - 1e-4, d));
      // THIS rig's X-hinge convention (measured): +hip.rotation.x swings the foot toward
      // -Z. So solve in the rig frame by negating dz: a forward foot target (dz>0) must
      // yield a NEGATIVE hip angle. Without this flip the stance foot slides forward
      // (the "moonwalk"); with it, the planted foot pushes back as the body advances.
      const lineAng = Math.atan2(-dz, -dy);            // angle from straight-down, rig frame
      const cosHip = Math.max(-1, Math.min(1, (U * U + d * d - F * F) / (2 * U * d)));
      const hipInner = Math.acos(cosHip);
      const cosKnee = Math.max(-1, Math.min(1, (U * U + F * F - d * d) / (2 * U * F)));
      const kneeInner = Math.acos(cosKnee);
      // thigh leads the foot-line by hipInner; knee then bends the shin (positive = the
      // natural knee bend this rig already uses for its walk, so it folds the right way).
      const hipRot = lineAng + hipInner;
      const kneeRot = Math.PI - kneeInner;             // 0 = straight; >0 bends the shin
      return { hip: hipRot, knee: kneeRot };
    }

    // ---- voxel mesher: Map("x,y,z"->hex) -> BufferGeometry with baked vertex colors ----
    // Neighbor-aware beveled mesher ported verbatim from voxel-poser voxGeo; `bevel`
    // is a param (was global cfg.bevel). Output uses vertexColors materials.
    function voxGeo(map, cx, cy, cz, bevel) {
      const pos = [], nor = [], col = [], idx = [];
      const PK = (x, y, z) => ((x + 64) << 14) | ((y + 64) << 7) | (z + 64);
      const occ = new Set();
      const cells = [];
      for (const [k, hex] of map) {
        const p = k.split(',');
        const x = +p[0], y = +p[1], z = +p[2];
        occ.add(PK(x, y, z));
        cells.push(x, y, z, hex);
      }
      const has = (x, y, z) => occ.has(PK(x, y, z));
      const b = bevel ? 0.24 : 0;
      const quad = (pts, n, r, g, bl) => {
        const base = pos.length / 3;
        for (const p of pts) {
          pos.push(p[0] * VS, p[1] * VS, p[2] * VS);
          nor.push(n[0], n[1], n[2]);
          col.push(r, g, bl);
        }
        idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      };
      for (let ci = 0; ci < cells.length; ci += 4) {
        const x = cells[ci], y = cells[ci + 1], z = cells[ci + 2];
        _col.set(cells[ci + 3]).convertSRGBToLinear();
        const j = 0.94 + hash3(x, y, z) * 0.10;
        const r = _col.r * j, g = _col.g * j, bl = _col.b * j;
        const C = [x - cx, y - cy, z - cz];
        for (let a = 0; a < 3; a++) for (const s of [1, -1]) {
          const n = [0, 0, 0]; n[a] = s;
          if (has(x + n[0], y + n[1], z + n[2])) continue;
          const ua = (a + 1) % 3, va = (a + 2) % 3;
          const conv = (ax, ss) => { const e = [0, 0, 0]; e[ax] = ss; return !has(x + e[0], y + e[1], z + e[2]); };
          const corner = (su, sv) => {
            const p = [C[0], C[1], C[2]];
            p[a] += s * 0.5;
            p[ua] += su * (0.5 - (conv(ua, su) ? b : 0));
            p[va] += sv * (0.5 - (conv(va, sv) ? b : 0));
            return p;
          };
          quad([corner(-1, -1), corner(1, -1), corner(-1, 1), corner(1, 1)], n, r, g, bl);
        }
        if (b > 0) {
          for (let a = 0; a < 3; a++) for (const s of [1, -1])
            for (let a2 = a + 1; a2 < 3; a2++) for (const s2 of [1, -1]) {
              const n = [0, 0, 0]; n[a] = s;
              const e = [0, 0, 0]; e[a2] = s2;
              if (has(x + n[0], y + n[1], z + n[2]) || has(x + e[0], y + e[1], z + e[2])) continue;
              const w = 3 - a - a2;
              const endB = sw => { const t = [0, 0, 0]; t[w] = sw; return !has(x + t[0], y + t[1], z + t[2]) ? b : 0; };
              const P = (side, sw) => {
                const p = [C[0], C[1], C[2]];
                if (side === 0) { p[a] += s * 0.5; p[a2] += s2 * (0.5 - b); }
                else { p[a2] += s2 * 0.5; p[a] += s * (0.5 - b); }
                p[w] += sw * (0.5 - endB(sw));
                return p;
              };
              const nn = [0, 0, 0]; nn[a] = s * 0.7071; nn[a2] = s2 * 0.7071;
              quad([P(0, -1), P(0, 1), P(1, -1), P(1, 1)], nn, r * 1.05, g * 1.05, bl * 1.05);
            }
          for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
            if (has(x + sx, y, z) || has(x, y + sy, z) || has(x, y, z + sz)) continue;
            const base = pos.length / 3;
            const m = 0.5773;
            for (let axis = 0; axis < 3; axis++) {
              const p = [
                C[0] + (axis === 0 ? sx * 0.5 : sx * (0.5 - b)),
                C[1] + (axis === 1 ? sy * 0.5 : sy * (0.5 - b)),
                C[2] + (axis === 2 ? sz * 0.5 : sz * (0.5 - b)),
              ];
              pos.push(p[0] * VS, p[1] * VS, p[2] * VS);
              nor.push(sx * m, sy * m, sz * m);
              col.push(r * 1.05, g * 1.05, bl * 1.05);
            }
            idx.push(base, base + 1, base + 2);
          }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeBoundingBox();
      return geo;
    }

    // ---- wardrobe (ported from voxel-poser) ----
    const SKINS = ['#fcdca0', '#eab38f', '#c98a5f', '#9c6644', '#6e482e'];
    const HAIRC = ['#241f26', '#54371f', '#d9a441', '#b05f28', '#a83a2a', '#5a6fd1', '#cdd3dc'];
    const HAIRS = ['Buzz', 'Short', 'Spike', 'Mohawk', 'Curls', 'Page', 'Bob', 'Tail', 'Knot', 'Bald'];
    const OUTFITS = {
      Casual: { shirt: '#4f8ef7', sleeve: 'short', pants: '#39496b', shoes: '#e8e6e1', belt: '#262b38' },
      Formal: { shirt: '#262a33', sleeve: 'long', pants: '#262a33', shoes: '#16171c', belt: '#16171c', collar: '#f0efe9', tie: '#a8392a' },
      Scout: { shirt: '#5d8a4a', sleeve: 'long', pants: '#7a6248', shoes: '#4a3526', belt: '#a87f3f', boots: true },
      Sport: { shirt: '#e85d75', sleeve: 'long', pants: '#2c2f38', shoes: '#f2b441', belt: '#222630' },
      Rogue: { shirt: '#3f4b4e', sleeve: 'long', pants: '#320632', shoes: '#2c2c2c', belt: '#b05f28', boots: true, sash: '#c3cbdb', skirt: '#560b28' },
      Barbarian: { bare: true, sleeve: 'short', barelegs: true, shoes: '#9c4528', belt: '#5a3018', boots: true, bootTall: true, harness: '#7e8a96', emblem: '#b8341f', fur: '#8a4b2a', fur2: '#6e3a1f', brace: '#6b4226', skirt: '#6e3a1f', shirt: '#000', pants: '#000' },
      Knight: { shirt: '#526074', sleeve: 'long', pants: '#333a4d', shoes: '#202535', belt: '#3a2118', boots: true, harness: '#a8b0bd', emblem: '#d9b64b', brace: '#8d95a3' },
      Archer: { shirt: '#476f3a', sleeve: 'long', pants: '#584631', shoes: '#3b2d1d', belt: '#9b6b30', boots: true, sash: '#c6d16b', brace: '#73512b' },
      Mage: { shirt: '#47306f', sleeve: 'long', pants: '#281b43', shoes: '#211630', belt: '#d2ad54', collar: '#e8d993', tie: '#5aa6ff', skirt: '#2f1f55' },
      Miner: { shirt: '#c58a39', sleeve: 'long', pants: '#345064', shoes: '#2b2925', belt: '#53361e', boots: true, brace: '#6d7781' },
      Skyfarer: { shirt: '#5f86b6', sleeve: 'long', pants: '#6d4a34', shoes: '#2d2a28', belt: '#7c512d', boots: true, harness: '#dbc17a', emblem: '#f3e5a2', brace: '#c9a86a' },
      // Hooded rogue — a leather-tunic adventurer under a black hood + cloak.
      // `hood`/`cloak` are bespoke wardrobe layers (built in buildHeadMap / buildParts,
      // gated on these colors). `lace` draws a pale V at the neckline. `facePreset`
      // is applied in deriveCfg so the cheeky grin / brows / blush travel WITH the
      // outfit over the wire (the networked descriptor only carries `fit`, not the
      // local eyes/mouth), making every client render the same hooded look.
      HoodedRogue: {
        shirt: '#8a5a32', sleeve: 'long', pants: '#3a2c1d', shoes: '#2c2c2c',
        belt: '#4a3526', boots: true,
        hood: '#2b2d33', cloak: '#26282e', lace: '#cdbb94',
        facePreset: { eyes: 'Happy', mouth: 'Grin', brows: true, blush: true, hair: 'Short', hairC: 1, head: 'Wide' },
      },
    };
    const OUTFIT_KEYS = Object.keys(OUTFITS);
    const GEARS = ['None', 'Sword', 'Bow', 'Shield', 'SwordShield', 'Axe', 'Staff', 'Pickaxe'];
    const BUILD_PROFILES = [
      { x: 0.78, z: 0.84, hipX: 0.84, limbX: 0.78, footX: 0.88, shoulder: 0.88 }, // -2 thin
      { x: 0.9, z: 0.92, hipX: 0.92, limbX: 0.9, footX: 0.94, shoulder: 0.94 },  // -1 lean
      { x: 1, z: 1, hipX: 1, limbX: 1, footX: 1, shoulder: 1 },                  // 0 average
      { x: 1.13, z: 1.08, hipX: 1.1, limbX: 1.08, footX: 1.08, shoulder: 1.1 },   // 1 stocky
      { x: 1.28, z: 1.18, hipX: 1.22, limbX: 1.14, footX: 1.12, shoulder: 1.22 }, // 2 fat
    ];

    function fill(map, x0, x1, y0, y1, z0, z1, color) {
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++)
        map.set(x + ',' + y + ',' + z, color);
    }
    function shade(hex, f) {
      _col.set(hex).multiplyScalar(f);
      _col.r = Math.min(_col.r, 1); _col.g = Math.min(_col.g, 1); _col.b = Math.min(_col.b, 1);
      return '#' + _col.getHexString();
    }
    function buildProfile(build) {
      return BUILD_PROFILES[(clampInt(build, 0, -2, 2) + 2)] || BUILD_PROFILES[2];
    }
    function avatarSharedGeo(key, make) {
      if (!_avatarSharedGeos[key]) _avatarSharedGeos[key] = make();
      return _avatarSharedGeos[key];
    }
    function avatarSharedMat(key, color) {
      if (!_avatarSharedMats[key]) _avatarSharedMats[key] = new THREE.MeshLambertMaterial({ color });
      return _avatarSharedMats[key];
    }
    function avatarGearMesh(geoKey, makeGeo, matKey, color) {
      const mesh = new THREE.Mesh(avatarSharedGeo(geoKey, makeGeo), avatarSharedMat(matKey, color));
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData.sharedAvatarAsset = true;
      return mesh;
    }
    function gearBox(w, h, d, matKey, color) {
      return avatarGearMesh('box:' + w + ':' + h + ':' + d, () => new THREE.BoxGeometry(w, h, d), matKey, color);
    }
    function gearCylinder(r, h, seg, matKey, color) {
      return avatarGearMesh('cyl:' + r + ':' + h + ':' + seg, () => new THREE.CylinderGeometry(r, r, h, seg), matKey, color);
    }
    function gearCone(r, h, seg, matKey, color) {
      return avatarGearMesh('cone:' + r + ':' + h + ':' + seg, () => new THREE.ConeGeometry(r, h, seg), matKey, color);
    }
    function gearSphere(r, seg, matKey, color) {
      return avatarGearMesh('sphere:' + r + ':' + seg, () => new THREE.SphereGeometry(r, seg, Math.max(4, Math.floor(seg * 0.6))), matKey, color);
    }
    function gearTorus(r, tube, seg, arc, matKey, color) {
      return avatarGearMesh('torus:' + r + ':' + tube + ':' + seg + ':' + arc, () => new THREE.TorusGeometry(r, tube, 6, seg, arc), matKey, color);
    }

    // ---- head (skin + face + hair) ----  (ported; viseme/Talk simplified to a static mouth)
    function buildHeadMap(cfg, skin, hair) {
      const HW = cfg.head === 'Slim' ? 6 : 8;
      const X1 = HW - 1;
      const ex = HW === 8 ? [2, 5] : [1, 4];
      const ca = HW / 2 - 1, cb = HW / 2;
      const H = new Map();
      fill(H, 0, X1, 0, 7, 0, 7, skin);
      const cut = (x, y, z) => H.delete(x + ',' + y + ',' + z);
      for (let x = 0; x < HW; x++) for (let z = 0; z < 8; z++) {
        if (x === 0 || x === X1 || z === 0 || z === 7) { cut(x, 7, z); cut(x, 0, z); }
      }
      for (const x of [0, X1]) for (const z of [0, 7]) { cut(x, 6, z); cut(x, 1, z); }
      fill(H, ca, cb, -1, -1, 2, 5, shade(skin, 0.93));            // neck
      fill(H, -1, -1, 3, 4, 3, 4, shade(skin, 0.97));              // ears
      fill(H, HW, HW, 3, 4, 3, 4, shade(skin, 0.97));
      // ----- face: 2-wide x 3-tall eyes; a dark band slides within pale sclera.
      // Eye-state cases ported verbatim from voxel-poser.html (buildHeadMap, the
      // `switch(cfg.eyes)` at ~line 1041) so blink + the directional gaze ("saccade")
      // states render identically to the source rig. `Blink` hides the sclera (lids
      // closed) and drops a dark lid line. `eyes` is read fresh every rebuild, so
      // toggling cfg.eyes and re-meshing the head re-poses the gaze with no new code.
      const DARK = '#1d2028', LITE = '#dfe5ee';
      const eL = [ex[0] - 1, ex[0]], eR = [ex[1], ex[1] + 1];   // eye columns, extending outward
      const blink = cfg.eyes === 'Blink';
      for (const c of [...eL, ...eR]) for (const y of [3, 4, 5])
        H.set(c + ',' + y + ',7', blink ? skin : LITE);          // sclera (hidden when closed)
      const pup = (() => {
        switch (cfg.eyes) {
          case 'Happy': return [[eL[0], 4], [eL[1], 4], [eR[0], 4], [eR[1], 4]]; // wide band looks
          case 'Happy-Up': return [[eL[0], 5], [eL[1], 5], [eR[0], 5], [eR[1], 5]];
          case 'Happy-Dn': return [[eL[0], 3], [eL[1], 3], [eR[0], 3], [eR[1], 3]];
          case 'Up-C': return [[eL[1], 5], [eR[0], 5]];           // focused, looking up
          case 'Low-C': return [[eL[1], 3], [eR[0], 3]];          // focused, looking down
          case 'Up-L': return [[eL[1], 5], [eR[1], 5]];
          case 'Up-R': return [[eL[0], 5], [eR[0], 5]];
          case 'Mid-L': return [[eL[1], 4], [eR[1], 4]];
          case 'Mid-R': return [[eL[0], 4], [eR[0], 4]];
          case 'Low-L': return [[eL[1], 3], [eR[1], 3]];
          case 'Low-R': return [[eL[0], 3], [eR[0], 3]];
          case 'Blink': return [[eL[0], 3], [eL[1], 3], [eR[0], 3], [eR[1], 3]]; // closed slot, lids down
          default: return [[eL[1], 4], [eR[0], 4]];               // Focus: inner squares
        }
      })();
      for (const [c, y] of pup) H.set(c + ',' + y + ',7', DARK);
      // ----- eyebrows: a dark brow bar one row above each eye (gated cfg.brows).
      // Tinted from the hair color so brows match the fringe. The outer voxel sits
      // one row higher than the inner, giving the slightly angled, characterful brow
      // from the reference art.
      if (cfg.brows) {
        const BROW = shade(hair, 0.62);
        const brow = (c, y) => H.set(c + ',' + y + ',7', BROW);
        brow(ex[0] - 1, 6); brow(ex[0], 6);            // left brow (inner pair)
        brow(ex[1], 6); brow(ex[1] + 1, 6);            // right brow (inner pair)
        brow(ex[0] - 1, 7); brow(ex[1] + 1, 7);        // outer ends lifted a row
      }
      // ----- blush: two warm cheek voxels low on the face, outside the mouth (gated cfg.blush)
      if (cfg.blush) {
        const BLUSH = '#e58a86';
        H.set((ex[0] - 1) + ',2,7', BLUSH);
        H.set((ex[1] + 1) + ',2,7', BLUSH);
      }
      fill(H, ca, cb, 3, 3, 8, 8, shade(skin, 0.97));              // nose
      const m0 = ca - 1, m1 = cb + 1;
      const mouth = (x, y) => H.set(x + ',' + y + ',7', DARK);
      if (cfg.mouth === 'Grin') {
        // big toothy grin: a dark upper-lip line with lifted corners, a pale tooth
        // band below it, and a single dark gap voxel to read as separated teeth.
        const TEETH = '#f4f1e8';
        for (let x = m0; x <= m1; x++) mouth(x, 2);                // upper lip line
        mouth(m0, 3); mouth(m1, 3);                                // corners curl up
        for (let x = ca - 1; x <= cb + 1; x++) H.set(x + ',1,7', TEETH); // tooth band
        H.set(ca + ',1,7', DARK);                                  // center gap
      } else if (cfg.mouth === 'Smile') { mouth(m0, 2); mouth(m1, 2); for (let x = ca; x <= cb; x++) mouth(x, 1); }
      else if (cfg.mouth === 'Frown') { mouth(m0, 1); mouth(m1, 1); for (let x = ca; x <= cb; x++) mouth(x, 2); }
      else { for (let x = m0; x <= m1; x++) mouth(x, 2); for (let x = ca; x <= cb; x++) mouth(x, 1); } // Open/default
      // hair
      if (cfg.hair === 'Bald') return [H, (HW - 1) / 2, -0.5, 3.5];
      const paint = (x, y, z) => { const k = x + ',' + y + ',' + z; if (H.has(k)) H.set(k, hair); };
      for (let x = 0; x < HW; x++) for (let z = 0; z < 8; z++) paint(x, 7, z);
      if (cfg.hair !== 'Buzz') {
        for (let x = 0; x < HW; x++) for (let z = 0; z < 8; z++) paint(x, 6, z);
        for (let y = 3; y <= 5; y++) for (let x = 0; x < HW; x++) { paint(x, y, 0); paint(x, y, 1); }
        for (let y = 4; y <= 5; y++) for (let z = 0; z < 7; z++) { paint(0, y, z); paint(X1, y, z); }
      } else {
        for (let x = 0; x < HW; x++) for (let z = 0; z <= 2; z++) paint(x, 6, z);
      }
      if (cfg.hair === 'Bob') {
        fill(H, -1, -1, 2, 7, 0, 6, hair); fill(H, HW, HW, 2, 7, 0, 6, hair);
        fill(H, 0, X1, 2, 7, -1, -1, hair); fill(H, -1, HW, 8, 8, -1, 7, hair);
      } else if (cfg.hair === 'Tail') {
        fill(H, ca, cb, 2, 6, -1, -1, hair); fill(H, ca, cb, -3, 1, -2, -2, hair);
      } else if (cfg.hair === 'Knot') {
        fill(H, ca, cb, 8, 8, 2, 3, '#f2bf57'); fill(H, ca - 1, cb + 1, 9, 10, 1, 4, hair);
        fill(H, ca, cb, 3, 6, -1, -1, hair); fill(H, ca, cb, -2, 2, -2, -2, hair);
      } else if (cfg.hair === 'Spike') {
        const h3 = shade(hair, 1.12);
        fill(H, 0, X1, 8, 8, 1, 6, hair);
        for (let x = 0; x < HW; x++) { const fwd = (x % 2 === 0); fill(H, x, x, 9, 9, 4, 6, hair); if (fwd) fill(H, x, x, 10, 10, 5, 6, h3); }
        fill(H, 0, X1, 9, 9, 6, 6, h3);
      } else if (cfg.hair === 'Mohawk') {
        const h3 = shade(hair, 1.1);
        fill(H, ca, cb, 8, 9, 0, 7, hair); fill(H, ca, cb, 10, 10, 1, 6, hair); fill(H, ca, cb, 11, 11, 2, 5, h3);
      } else if (cfg.hair === 'Curls') {
        fill(H, -1, HW, 8, 9, -1, 7, hair); fill(H, -2, -2, 3, 8, 0, 6, hair); fill(H, HW + 1, HW + 1, 3, 8, 0, 6, hair);
        fill(H, -1, HW, 2, 8, -2, -2, hair); fill(H, -1, HW, 10, 10, 2, 5, hair);
      } else if (cfg.hair === 'Page') {
        fill(H, -1, -1, 3, 8, -1, 7, hair); fill(H, HW, HW, 3, 8, -1, 7, hair);
        fill(H, 0, X1, 2, 8, -1, -1, hair); fill(H, -1, HW, 8, 8, -1, 7, hair);
      }
      // ----- hood: a black cowl shell around the head, framing an open face (gated
      // by the outfit's `hood` color). Built as side walls + back + a domed top that
      // overhangs the brow, with the front (z>=6) left open so the face shows through.
      // Drawn LAST so it sits over hair. Uses negative/over-range coords (the voxGeo
      // mesher and bb handle them) to stand the cowl proud of the skin.
      const hoodC = (OUTFITS[cfg.fit] && OUTFITS[cfg.fit].hood) || null;
      if (hoodC) {
        const hShade = shade(hoodC, 0.86);
        // side walls (left at x=-2, right at x=HW+1) from cheek to crown, front-to-back
        for (const sx of [-2, HW + 1]) fill(H, sx, sx, 1, 9, -2, 6, hoodC);
        // inner side lining one column in, so the opening reads as thickness, not paper
        for (const sx of [-1, HW]) fill(H, sx, sx, 1, 8, -2, 1, hShade);
        // back wall behind the head
        fill(H, -2, HW + 1, 1, 9, -2, -2, hoodC);
        // domed top: two stacked caps, the upper one pulled back a row (the peak)
        fill(H, -2, HW + 1, 9, 9, -2, 6, hoodC);
        fill(H, -1, HW, 10, 10, -1, 4, hoodC);
        fill(H, 0, X1, 11, 11, -1, 2, hShade);
        // brow overhang: a short lip of hood reaching forward over the forehead
        fill(H, -1, HW, 8, 9, 6, 6, hoodC);
      }
      return [H, (HW - 1) / 2, -0.5, 3.5];
    }

    // ---- full body part maps (ported; articulated fingers dropped, hand = single block) ----
    function buildParts(cfg) {
      const skin = SKINS[cfg.skin];
      const hair = HAIRC[cfg.hairC];
      const fit = { ...OUTFITS[cfg.fit] };
      if (fit.bare) fit.shirt = skin;
      if (fit.barelegs) fit.pants = skin;
      const fem = cfg.body === 'Fem';
      const maps = {};
      maps.head = buildHeadMap(cfg, skin, hair);

      // chest
      const C = new Map();
      const topX0 = fem ? 0 : -1, topX1 = fem ? 7 : 8;
      if (fem) { fill(C, 0, 7, 0, 0, 0, 3, fit.shirt); fill(C, 1, 6, 1, 2, 0, 3, fit.shirt); fill(C, 0, 7, 3, 7, 0, 3, fit.shirt); }
      else { fill(C, 0, 7, 0, 2, 0, 3, fit.shirt); fill(C, topX0, topX1, 3, 7, 0, 3, fit.shirt); }
      if (fit.collar) {
        for (let x = topX0; x <= topX1; x++) for (let z = 0; z < 4; z++) { const k = x + ',7,' + z; if (C.has(k)) C.set(k, fit.collar); }
        fill(C, 3, 4, 4, 6, 3, 3, fit.tie);
      }
      if (fit.sash) {
        const pc = (x, y, z) => { const k = x + ',' + y + ',' + z; if (C.has(k)) C.set(k, fit.sash); };
        for (let y = 2; y <= 7; y++) { const xx = Math.round(1 + (y - 2) * (topX1 - 2) / 5); pc(xx, y, 3); pc(xx - 1, y, 3); pc(xx, y, 0); pc(xx - 1, y, 0); }
      }
      if (fit.harness) {
        const pc = (x, y, z, c) => { const k = x + ',' + y + ',' + z; if (C.has(k)) C.set(k, c); };
        for (const z of [3, 0]) { for (let x = 0; x < 8; x++) pc(x, 4, z, fit.harness); for (let y = 5; y <= 6; y++) { pc(1, y, z, fit.harness); pc(6, y, z, fit.harness); } }
        for (const x of [1, 6]) for (let z = 0; z < 4; z++) pc(x, 7, z, fit.harness);
        pc(3, 5, 3, fit.emblem); pc(4, 5, 3, fit.emblem); pc(3, 4, 3, fit.emblem); pc(4, 4, 3, fit.emblem);
        pc(3, 3, 3, fit.emblem); pc(4, 3, 3, fit.emblem); pc(2, 4, 3, fit.emblem); pc(5, 4, 3, fit.emblem);
      }
      // ----- cloak: a dark mantle over the shoulders and back, draping down the
      // sides (gated by the outfit's `cloak` color). Built proud of the shirt at the
      // back (z=-1) and wrapping the shoulder tops, with the chest front left open so
      // the leather tunic + laced collar show. `lace` draws a pale V at the neckline.
      if (fit.cloak) {
        const clShade = shade(fit.cloak, 0.88);
        // back panel behind the torso, full width, hanging the length of the chest
        fill(C, topX0, topX1, 0, 7, -1, -1, fit.cloak);
        // shoulder caps wrapping over the top, fore-and-aft
        fill(C, topX0, topX1, 7, 8, -1, 3, fit.cloak);
        // side drapes down the outer edges
        fill(C, topX0 - 1, topX0 - 1, 1, 7, -1, 3, clShade);
        fill(C, topX1 + 1, topX1 + 1, 1, 7, -1, 3, clShade);
      }
      if (fit.lace) {
        // pale laced collar: a shallow V opening at the chest front (z=3)
        const lc = (x, y) => { const k = x + ',' + y + ',3'; if (C.has(k)) C.set(k, fit.lace); };
        lc(3, 6); lc(4, 6); lc(2, 5); lc(5, 5); lc(3, 4); lc(4, 4); lc(3, 3); lc(4, 3);
      }
      maps.chest = [C, 3.5, -0.5, 1.5];

      // pelvis
      const P = new Map();
      const pw = fem ? 9 : 8, px1 = pw - 1;
      fill(P, 0, px1, 0, 3, 0, 3, fit.pants);
      // ----- butt: a small rounded seat at the lower rear of the pelvis. The pelvis
      // back face is z=0 (front/face side is +z); this stands one voxel proud at
      // z=-1 across the lower two rows (y=0..1), inset on x so it reads as a rounded
      // seat rather than a flat slab. Tinted a touch darker than the pants for a soft
      // shaded cheek. Skipped under a skirt (which buries it). Shape pass: applies to
      // every avatar. Fem pelvis is one voxel wider (px1=8) so the seat is a touch fuller.
      if (!fit.skirt) {
        const seatC = shade(fit.pants, 0.92);
        fill(P, 1, px1 - 1, 0, 1, -1, -1, seatC);
        // top row pulled in a column more so the cheek crowns/rounds at the top
        fill(P, 2, px1 - 2, 1, 1, -1, -1, shade(fit.pants, 0.97));
      }
      if (fit.fur) { fill(P, 0, px1, 0, 2, 0, 3, fit.fur); for (let x = 0; x <= px1; x++) for (let z = 0; z < 4; z++) if ((x + z) & 1) P.set(x + ',0,' + z, fit.fur2); }
      for (let x = 0; x <= px1; x++) for (let z = 0; z < 4; z++) P.set(x + ',3,' + z, fit.belt);
      if (fit.skirt) { for (let x = -1; x <= px1 + 1; x++) for (let z = -1; z <= 4; z++) { if (x > -1 && x < px1 + 1 && z > -1 && z < 4) continue; fill(P, x, x, -3, -1, z, z, fit.skirt); } }
      maps.pelvis = [P, (pw - 1) / 2, 1.5, 1.5];

      // arms (upper from shoulder, fore from elbow)
      const sleeveU = fit.shirt;
      const sleeveF = fit.sleeve === 'long' ? fit.shirt : skin;
      const AU = new Map(); fill(AU, 0, 2, -6, -1, 0, 2, sleeveU);
      const AF = new Map(); fill(AF, 0, 2, -4, -1, 0, 2, sleeveF);
      if (fit.brace) { fill(AF, 0, 2, -4, -3, 0, 2, fit.brace); fill(AF, 0, 2, -3, -3, 0, 2, shade(fit.brace, 1.2)); }
      maps.upperL = [AU, 1, -0.5, 1]; maps.upperR = [new Map(AU), 1, -0.5, 1];
      maps.foreL = [AF, 1, -0.5, 1]; maps.foreR = [new Map(AF), 1, -0.5, 1];

      // hands (single stubby block at wrist; origin at wrist)
      const HB = new Map(); fill(HB, 0, 2, -2, -1, 0, 2, skin);
      for (let z = 0; z < 3; z++) HB.set('1,-1,' + z, shade(skin, 0.92));
      maps.handL = [HB, 1, -0.5, 1]; maps.handR = [new Map(HB), 1, -0.5, 1];

      // legs (thigh from hip, shin from knee)
      const TH = new Map(); fill(TH, 0, 3, -7, -1, 0, 3, fit.pants);
      if (fit.fur) { fill(TH, 0, 3, -2, -1, 0, 3, fit.fur); for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) if ((x + z) & 1) TH.set(x + ',-3,' + z, fit.fur2); }
      const SH = new Map(); fill(SH, 0, 2, -7, -1, 0, 3, fit.pants);
      if (fit.boots) fill(SH, 0, 2, -7, fit.bootTall ? -4 : -5, 0, 3, fit.shoes);
      if (fit.bootTall) fill(SH, 0, 2, -4, -4, 0, 3, shade(fit.shoes, 1.25));
      maps.thighL = [TH, 1.5, -0.5, 1.5]; maps.thighR = [new Map(TH), 1.5, -0.5, 1.5];
      maps.shinL = [SH, 1, -0.5, 1.5]; maps.shinR = [new Map(SH), 1, -0.5, 1.5];

      // feet (origin: ankle, toe +z). Shifted FORWARD a voxel — heel pulled in to
      // z=-1 and toe pushed out to z=+4 (was -2..+3) so the foot sits ahead of the
      // ankle and the stance reads as planted/stepping forward rather than balanced
      // on a board centered under the leg. The dark sole underside follows the new span.
      const F = new Map();
      fill(F, 0, 3, -2, -1, -1, 4, fit.shoes);
      for (let x = 0; x < 4; x++) for (let z = -1; z <= 4; z++) F.set(x + ',-2,' + z, shade(fit.shoes, 0.7));
      maps.footL = [F, 1.5, -0.5, 0.5]; maps.footR = [new Map(F), 1.5, -0.5, 0.5];

      // survivor grime — deterministic per-seed so distinct avatars weather differently
      applyGrime(maps, cfg.seed >>> 0);
      return maps;
    }

    function applyGrime(maps, seed) {
      const HSH = (x, y, z, k) => { let h = (x * 374761 + y * 668265 + z * 9301 + ((seed * 10) | 0 + k) * 2654435761) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };
      const MUD = [0x6b, 0x57, 0x42];
      const ZONES = { shinL: 0.55, shinR: 0.55, thighL: 0.4, thighR: 0.4, footL: 0.6, footR: 0.6, chest: 0.2, pelvis: 0.3, upperL: 0.26, upperR: 0.26, foreL: 0.34, foreR: 0.34 };
      const amt = 0.6;
      for (const part in ZONES) {
        if (!maps[part]) continue;
        const map = maps[part][0];
        for (const [k, c] of map) {
          const p = k.split(','), x = +p[0], y = +p[1], z = +p[2];
          if (HSH(x >> 1, y >> 1, z >> 1, 11) > ZONES[part] * amt) continue;
          const f = 0.45 + HSH(x, y, z, 23) * 0.3;
          const r = (parseInt(c.slice(1, 3), 16) * (1 - f) + MUD[0] * f) | 0;
          const g2 = (parseInt(c.slice(3, 5), 16) * (1 - f) + MUD[1] * f) | 0;
          const bb = (parseInt(c.slice(5, 7), 16) * (1 - f) + MUD[2] * f) | 0;
          map.set(k, '#' + ((1 << 24) + (r << 16) + (g2 << 8) + bb).toString(16).slice(1));
        }
      }
    }

    // ---- descriptor: explicit opts win; anything unset is derived deterministically
    //      from the seed so peers/bots render as DISTINCT people pre-networked-identity ----
    function deriveCfg(opts) {
      opts = opts || {};
      let seed = opts.seed;
      if (typeof seed === 'string') { let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0; seed = h; }
      seed = (seed >>> 0) || 1;
      const r = makePrng(seed);
      const pick = (arr) => arr[(r() * arr.length) | 0];
      const body = (opts.body === 'Masc' || opts.body === 'Fem') ? opts.body : (r() < 0.5 ? 'Masc' : 'Fem');
      const skin = opts.skin != null ? clampInt(opts.skin, 0, 0, SKINS.length - 1) : ((r() * SKINS.length) | 0);
      const fit = OUTFIT_KEYS.includes(opts.fit) ? opts.fit : pick(OUTFIT_KEYS);
      // Outfit-bound face/hair preset (e.g. HoodedRogue's grin+brows+blush). Explicit
      // opts always win; otherwise the preset supplies the look, then the seed. Read
      // BEFORE hair/hairC/head so the preset can pin them (keeps the resolved descriptor
      // — which carries only `fit` over the wire — rendering identically on every peer).
      const preset = (OUTFITS[fit] && OUTFITS[fit].facePreset) || {};
      const hairC = opts.hairC != null ? clampInt(opts.hairC, 0, 0, HAIRC.length - 1)
        : (preset.hairC != null ? clampInt(preset.hairC, 0, 0, HAIRC.length - 1) : ((r() * HAIRC.length) | 0));
      const hair = HAIRS.includes(opts.hair) ? opts.hair : (HAIRS.includes(preset.hair) ? preset.hair : pick(HAIRS));
      const head = (opts.head === 'Wide' || opts.head === 'Slim') ? opts.head
        : ((preset.head === 'Wide' || preset.head === 'Slim') ? preset.head : (r() < 0.5 ? 'Wide' : 'Slim'));
      const height = Math.round((opts.height != null ? clampNum(opts.height, 1, 0.84, 1.22) : (0.88 + r() * 0.31)) * 100) / 100;
      const build = opts.build != null ? clampInt(opts.build, 0, -2, 2) : (((r() * 5) | 0) - 2);
      const gear = GEARS.includes(opts.gear) ? opts.gear : (r() < 0.42 ? 'None' : GEARS[1 + ((r() * (GEARS.length - 1)) | 0)]);
      return {
        body, skin, hairC, hair, fit, head, height, build, gear,
        bevel: opts.bevel != null ? opts.bevel : false,   // flat voxels: fewer verts, render-budget friendly
        eyes: opts.eyes || preset.eyes || 'Focus',
        mouth: opts.mouth || preset.mouth || 'Smile',
        brows: opts.brows != null ? !!opts.brows : !!preset.brows,
        blush: opts.blush != null ? !!opts.blush : !!preset.blush,
        seed,
      };
    }

    // ---- assemble a posed skeleton of limb Groups from the part meshes ----
    function makeVoxelAvatar(opts) {
      const cfg = deriveCfg(opts);
      const build = buildProfile(cfg.build);
      const maps = buildParts(cfg);
      // side: DoubleSide is REQUIRED — the ported voxGeo mesher emits inconsistent
      // face winding (voxel-poser's voxMat used DoubleSide too). With the default
      // FrontSide, wrong-wound faces get backface-culled and thin/carved parts
      // (slim heads, bare arms) render see-through.
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0, side: THREE.DoubleSide });
      const geos = [];                                   // own everything; dispose() frees it
      const meshPart = (name) => {
        const m = maps[name]; if (!m) return null;
        const g = voxGeo(m[0], m[1], m[2], m[3], cfg.bevel);
        geos.push(g);
        const mesh = new THREE.Mesh(g, mat);
        mesh.castShadow = true; mesh.receiveShadow = true;
        if (g.boundingBox) mesh.userData.bb = g.boundingBox.clone();
        return mesh;
      };
      const scalePart = (mesh, sx, sz) => { if (mesh) { mesh.scale.x = sx; mesh.scale.z = sz; } };
      const grp = (parent, x, y, z) => { const g = new THREE.Group(); if (x || y || z) g.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(g); return g; };

      const root = new THREE.Group();
      root.name = 'voxel-avatar';
      const body = grp(root, 0, 0, 0);                   // animated bob lives here
      const hips = grp(body, 0, 0, 0);
      // capture rig-local base positions so the natural-walk gait can apply deltas
      // (chest bob/sway, head bob/sway/chin) ON TOP of the rest layout, then restore.
      const BASE = { chestY: 0, chestX: 0, chestZ: 0, headY: 0, headX: 0, headZ: 0, hipPivotY: 0 };

      const pelvis = meshPart('pelvis'); hips.add(pelvis);
      scalePart(pelvis, build.hipX, build.z);
      const pbb = pelvis.userData.bb;

      const chest = grp(hips, 0, pbb.max.y, 0);
      const chestMesh = meshPart('chest'); chest.add(chestMesh);
      scalePart(chestMesh, build.x, build.z);
      const cbb = chestMesh.userData.bb;

      const head = grp(chest, 0, cbb.max.y, 0);
      const headMesh = meshPart('head'); head.add(headMesh);
      // Blink/gaze re-mesh the head ONLY (small ~8x8x8 map; everything else stays put).
      // skin/hair match buildParts so the re-meshed head keeps the same wardrobe colors.
      const headSkin = SKINS[cfg.skin], headHair = HAIRC[cfg.hairC];
      const remeshHead = (eyesState) => {
        cfg.eyes = eyesState;
        const m = buildHeadMap(cfg, headSkin, headHair);   // [map, cx, cy, cz]
        const g = voxGeo(m[0], m[1], m[2], m[3], cfg.bevel);
        const old = headMesh.geometry;
        const gi = geos.indexOf(old);                       // keep the owned-geometry list correct
        if (gi >= 0) geos[gi] = g; else geos.push(g);
        headMesh.geometry = g;
        try { old.dispose(); } catch (_) {}
      };

      // arms: shoulder pivots at the upper chest, just outside the torso edge
      const shY = cbb.max.y - 1.2;
      const shX = (cbb.max.x * build.shoulder) + 0.2;
      const ARM = { len: 0 };                            // total arm length, for swing-amp -> angle
      const arm = (side) => {
        const tag = side < 0 ? 'L' : 'R';
        const sh = grp(chest, side * shX, shY, 0); sh.name = 'arm' + tag + '_sh';
        const up = meshPart(side < 0 ? 'upperL' : 'upperR'); sh.add(up);
        scalePart(up, build.limbX, build.z);
        const elbow = grp(sh, 0, up.userData.bb.min.y, 0); elbow.name = 'arm' + tag + '_elbow';
        const fore = meshPart(side < 0 ? 'foreL' : 'foreR'); elbow.add(fore);
        scalePart(fore, build.limbX, build.z);
        const wrist = grp(elbow, 0, fore.userData.bb.min.y, 0);
        const hand = meshPart(side < 0 ? 'handL' : 'handR'); wrist.add(hand);
        scalePart(hand, build.limbX, build.z);
        ARM.len = -up.userData.bb.min.y + -fore.userData.bb.min.y;
        return { sh, elbow, wrist };
      };
      const armL = arm(-1), armR = arm(1);

      // legs: hip pivots under the pelvis
      const hipY = pbb.min.y;
      const hipX = Math.max(0.65, pbb.max.x * 0.5 * build.hipX);
      // segment lengths captured from the built bb's — fed to the planar leg IK so
      // strideCore's foot targets (ported V->1) solve against THIS rig's true limbs.
      const LEG = { U: 0, F: 0, ankleY: 0 };
      const leg = (side) => {
        const tag = side < 0 ? 'L' : 'R';
        const hip = grp(hips, side * hipX, hipY, 0); hip.name = 'leg' + tag + '_hip';
        const th = meshPart(side < 0 ? 'thighL' : 'thighR'); hip.add(th);
        scalePart(th, build.limbX, build.z);
        const kneeY = th.userData.bb.min.y;             // thigh extends down (negative Y)
        const knee = grp(hip, 0, kneeY, 0); knee.name = 'leg' + tag + '_knee';
        const shin = meshPart(side < 0 ? 'shinL' : 'shinR'); knee.add(shin);
        scalePart(shin, build.limbX, build.z);
        const ankleY = shin.userData.bb.min.y;
        const ankle = grp(knee, 0, ankleY, 0);
        const foot = meshPart(side < 0 ? 'footL' : 'footR'); ankle.add(foot);
        scalePart(foot, build.footX, build.z);
        LEG.U = -kneeY; LEG.F = -ankleY;                // upper/fore segment lengths (positive)
        return { hip, knee };
      };
      const legL = leg(-1), legR = leg(1);

      // ---- rocket pack (hidden until EARNED in the skyfall minigame) ----
      // Two thrusters mounted on the upper BACK (-z) of the chest + downward flame cones that
      // light only while thrusting. Built once, toggled via setRocketVisible/setThrusting (47
      // drives them). Sized in rig-local voxel units so it scales with the avatar. Makes the
      // "get a rocket pack" reward tangible/visible (was an invisible thrust mechanic).
      const rocketPack = new THREE.Group(); rocketPack.visible = false; chest.add(rocketPack);
      const packMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.55, metalness: 0.35 });
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa033 });
      const rocketFlames = [];
      const packY = cbb.max.y * 0.5, packZ = cbb.min.z - 1.2;
      for (const sx of [-1, 1]) {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 3.2, 8), packMat);
        cyl.position.set(sx * 1.9, packY, packZ);
        rocketPack.add(cyl); geos.push(cyl.geometry);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.4, 8), flameMat);
        flame.position.set(sx * 1.9, packY - 2.6, packZ);
        flame.rotation.x = Math.PI;                       // point the cone DOWN (thrust exhaust)
        flame.visible = false;
        rocketPack.add(flame); rocketFlames.push(flame); geos.push(flame.geometry);
      }

      function addSwordGear(parent) {
        // Sword scaled up ~1.5x (dimensions AND offsets together) so it reads clearly in the
        // hand — the old slim 0.36-wide blade was barely visible at avatar scale.
        const g = grp(parent, 0, -0.7, 1.35); g.name = 'avatar-gear-sword';
        const grip = gearBox(0.51, 1.72, 0.51, 'avatarGearLeather', 0x5c3a26);
        grip.position.y = -0.22; g.add(grip);
        const guard = gearBox(2.62, 0.36, 0.42, 'avatarGearGold', 0xd9a441);
        guard.position.y = -1.23; g.add(guard);
        const blade = gearBox(0.54, 6.75, 0.24, 'avatarGearSteel', 0xcfd8e6);
        blade.position.y = -4.72; g.add(blade);
        const tip = gearCone(0.51, 1.05, 4, 'avatarGearSteel', 0xcfd8e6);
        tip.position.y = -8.62; tip.rotation.z = Math.PI; g.add(tip);
      }
      function addStaffGear(parent) {
        const g = grp(parent, 0, -1.25, 1.1); g.name = 'avatar-gear-staff';
        const pole = gearCylinder(0.13, 7.2, 6, 'avatarGearWood', 0x6b4226);
        pole.position.y = -2.2; g.add(pole);
        const band = gearBox(0.62, 0.22, 0.62, 'avatarGearGold', 0xd9a441);
        band.position.y = 1.18; g.add(band);
        const gem = gearSphere(0.46, 8, 'avatarGearGem', 0x59c7ff);
        gem.position.y = 1.72; g.add(gem);
      }
      function addShieldGear(parent) {
        const g = grp(parent, 0, -1.25, 1.8); g.name = 'avatar-gear-shield';
        const shield = gearCylinder(1.08, 0.34, 8, 'avatarGearShield', 0x3f6fb7);
        shield.rotation.x = Math.PI / 2; shield.scale.y = 1.22; g.add(shield);
        const boss = gearCylinder(0.36, 0.42, 8, 'avatarGearGold', 0xd9a441);
        boss.rotation.x = Math.PI / 2; boss.position.z = 0.26; g.add(boss);
        const stripe = gearBox(0.22, 2.0, 0.08, 'avatarGearSteelDark', 0x273247);
        stripe.position.z = 0.45; g.add(stripe);
      }
      function addBowGear(parent) {
        const g = grp(parent, 0, -1.8, 1.15); g.name = 'avatar-gear-bow';
        const bow = gearTorus(1.22, 0.075, 20, Math.PI * 1.35, 'avatarGearWood', 0x6b4226);
        bow.rotation.z = -Math.PI * 0.68; bow.scale.y = 1.35; g.add(bow);
        const string = gearBox(0.05, 3.85, 0.05, 'avatarGearString', 0xe8dcc3);
        string.position.x = -0.36; g.add(string);
        const grip = gearBox(0.28, 0.8, 0.24, 'avatarGearLeather', 0x5c3a26);
        grip.position.x = -0.02; g.add(grip);
      }
      function addQuiverGear(parent) {
        const g = grp(parent, -2.2, cbb.max.y * 0.45, cbb.min.z - 1.2); g.name = 'avatar-gear-quiver';
        g.rotation.z = -0.22;
        const tube = gearCylinder(0.42, 3.3, 7, 'avatarGearLeather', 0x5c3a26);
        tube.position.y = -0.4; g.add(tube);
        for (const off of [-0.22, 0, 0.22]) {
          const shaft = gearBox(0.07, 3.6, 0.07, 'avatarGearArrow', 0xd8c18c);
          shaft.position.set(off, 0.9, 0.08); g.add(shaft);
          const head = gearCone(0.15, 0.38, 4, 'avatarGearSteel', 0xcfd8e6);
          head.position.set(off, 2.88, 0.08); g.add(head);
        }
      }
      function addAxeGear(parent) {
        const g = grp(parent, 0, -1.15, 1.18); g.name = 'avatar-gear-axe';
        const haft = gearCylinder(0.14, 5.6, 6, 'avatarGearWood', 0x6b4226);
        haft.position.y = -2.0; g.add(haft);
        const head = gearBox(1.35, 0.8, 0.22, 'avatarGearSteel', 0xcfd8e6);
        head.position.set(0.35, 0.55, 0); g.add(head);
        const bite = gearCone(0.52, 0.65, 4, 'avatarGearSteel', 0xcfd8e6);
        bite.position.set(1.15, 0.55, 0); bite.rotation.z = -Math.PI / 2; g.add(bite);
      }
      function addPickaxeGear(parent) {
        const g = grp(parent, 0, -1.1, 1.18); g.name = 'avatar-gear-pickaxe';
        const haft = gearCylinder(0.13, 5.4, 6, 'avatarGearWood', 0x6b4226);
        haft.position.y = -2.1; g.add(haft);
        const bar = gearBox(2.2, 0.24, 0.2, 'avatarGearSteel', 0xcfd8e6);
        bar.position.y = 0.58; g.add(bar);
        const pointL = gearCone(0.22, 0.7, 4, 'avatarGearSteel', 0xcfd8e6);
        pointL.position.set(-1.34, 0.58, 0); pointL.rotation.z = Math.PI / 2; g.add(pointL);
        const pointR = gearCone(0.22, 0.7, 4, 'avatarGearSteel', 0xcfd8e6);
        pointR.position.set(1.34, 0.58, 0); pointR.rotation.z = -Math.PI / 2; g.add(pointR);
      }
      function addAvatarGear() {
        if (cfg.gear === 'Sword' || cfg.gear === 'SwordShield') addSwordGear(armR.wrist);
        if (cfg.gear === 'Shield' || cfg.gear === 'SwordShield') addShieldGear(armL.wrist);
        if (cfg.gear === 'Bow') { addBowGear(armL.wrist); addQuiverGear(chest); }
        if (cfg.gear === 'Staff') addStaffGear(armR.wrist);
        if (cfg.gear === 'Axe') addAxeGear(armR.wrist);
        if (cfg.gear === 'Pickaxe') addPickaxeGear(armR.wrist);
      }

      // record rest-pose pivot bases (chest/head local positions, hip-pivot Y in `hips`)
      BASE.chestY = chest.position.y; BASE.chestX = chest.position.x; BASE.chestZ = chest.position.z;
      BASE.headY = head.position.y; BASE.headX = head.position.x; BASE.headZ = head.position.z;
      BASE.hipPivotY = hipY;
      // standing ankle height in `hips` frame (legs straight): the leg-IK datum.
      const GROUND_ANKLE_Y = hipY - LEG.U - LEG.F;

      // anchor feet to y=0 and scale the whole rig to AVATAR_HEIGHT
      const fullBB = new THREE.Box3().setFromObject(body);
      const bobBase = -fullBB.min.y;          // lift so lowest voxel sits at y=0
      body.position.y = bobBase;
      const rawH = (fullBB.max.y - fullBB.min.y) || 1;
      root.scale.setScalar((AVATAR_HEIGHT * cfg.height) / rawH);
      addAvatarGear();

      // ---- animation: rotate limb Groups only; geometry is never rebuilt ----
      const A = {                              // amplitudes (radians) — kept modest so
        // thin limbs don't fling far in z (which an iso camera projects as "scatter")
        walkLimb: 0.42, walkKnee: 0.55, idleArm: 0.05, attackArm: 1.3,
      };
      // strideCore cadence/intensity knob. NOT the world move-speed (the drive doesn't
      // pass one); a tuned constant — bots walk at a constant pace. Higher = faster
      // cadence + longer stride; ~0.9 reads as a brisk natural human walk.
      const WALK_SPD = 1.8;
      // Jump pose (radians). Crouch loads the legs (hips fold, knees deep bend) and
      // the arms swing back; launch throws the arms up and extends the legs; the
      // landing re-bends the knees to absorb. Bends arms AND legs, per spec.
      const JUMP_DUR = 0.46;                   // matches 47-worlds-room JUMP_MS (the vertical arc)
      // Crouch + Sit poses ported from voxel-poser.html (ratios/intent, NOT raw coords —
      // the poser is IK-on-world-positions at V=0.0175 scale; this rig is FK at 1u/voxel,
      // so the poser's literal targets don't transfer. What transfers is the SHAPE):
      //   CROUCH: poser locoStep (line 3839) standY=26*V, crouchY=18*V -> body height
      //     blends to 18/26 = 0.692 of stand; knees fold deeper; head "dips into the
      //     crouch" forward+down (poser lines 4020-4022). Feet stay planted at y=0.
      //   SIT: poser POSES.Sit (line 1666) chest [0,16.5,-2], head [0,24,1],
      //     foot [+-2.8,2,7] (forward), knee [+-2.8,18,8] (high+forward) vs Stand
      //     chest y=26, foot z=0, knee y=9 -> chest 16.5/26 = 0.635 of stand, hips
      //     folded ~90deg with feet forward, torso upright, slight back-lean (z=-2).
      //     Realized on THIS rig via legIK forward+raised foot targets (measured to
      //     fold cleanly, no clamp) + body group lowered to the 0.635 chest ratio.
      const CROUCH_RATIO = 18 / 26;            // 0.692 — poser crouchY/standY
      const SIT_RATIO = 16.5 / 26;             // 0.635 — poser Sit chest / Stand chest
      // restY = the body-group Y that keeps feet at world 0 (set during assembly = bobBase).
      // Lowering body.position.y lowers the whole figure; to keep feet planted in CROUCH
      // we instead RAISE the foot IK targets in the hips frame by the same drop so the
      // knees fold while the soles stay at y=0. SIT lets the feet leave straight-down
      // (they slide forward), so SIT lowers the body group directly.
      // Gaze states ported from voxel-poser: idle "saccades" pick a random look
      // direction between blinks (the source drives these from a look-at target;
      // worlds-room has no such target, so we wander idly — see report).
      const GAZE_STATES = ['Focus', 'Mid-L', 'Mid-R', 'Up-C', 'Low-C', 'Up-L', 'Up-R'];
      const inst = {
        group: root, cfg, _mat: mat, _geos: geos,
        _t: 0, _phase: 0, _state: 'idle', _attackT: 0, _swingType: -1, _jumpT: 0, _poseT: 0, _heading: 0, _bobBase: bobBase, _emoteT: 0,
        // strideCore gait phase + weight-sway tracker (mirrors voxel-poser st.gph/gswx)
        _gph: 0, _gswx: 0, _walkSpd: 0,
        // idle weight-shift desync: a random phase so a crowd of idle avatars rock on
        // their feet out of sync with each other (purely cosmetic, no wire impact).
        _idlePhase: Math.random() * Math.PI * 2,
        // ---- climb cycle ----
        // The climb is hand-over-hand and is driven by VERTICAL PROGRESS, not dt: the 47
        // mechanic calls climbAdvance(dPhase) each frame with an amount proportional to
        // how far up/down the avatar moved, so the limbs cycle while moving and HOLD a
        // static hang when not (dPhase 0 -> phase frozen). _climbPhase accumulates that.
        _climbPhase: 0, _climbAdv: 0,
        // --- blink/gaze (ported timing from voxel-poser gazeStep) ---
        _baseEyes: cfg.eyes,                   // the look to resume to after a blink
        _blinking: 0,                          // >0 while lids are down
        _nextBlink: 2.2 + Math.random() * 3.5, // first blink delay (source: 2.2 + rnd*3.5)
        _nextGaze: 1.5 + Math.random() * 2.5,  // idle saccade timer
        setHeading(yaw) { if (typeof yaw === 'number') { this._heading = yaw; root.rotation.y = yaw; } },
        setHeadingFromDelta(dx, dz) { if (dx || dz) this.setHeading(Math.atan2(dx, dz)); },
        // Freefall/parachute body pitch. Owned by the FALL CONTROLLER (47), never by a
        // per-frame state branch: it writes root.rotation.x ONLY, so it never fights
        // setHeading (root.rotation.y). 0 = upright; ~-1.4 = belly-to-earth face-down.
        // The skydive/parachute STATES pose limbs only; this orients the whole body.
        setBodyPitch(rad) { root.rotation.x = (typeof rad === 'number') ? rad : 0; },
        // Rocket pack: show/hide the back-mounted thrusters (on earn) and the flames (on thrust).
        setRocketVisible(on) { rocketPack.visible = !!on; if (!on) for (const f of rocketFlames) f.visible = false; },
        setThrusting(on) { for (const f of rocketFlames) f.visible = !!on; },
        // First-person: hide the local body entirely. Leaving arms/torso visible
        // clipped the camera into the voxel rig when zoomed in.
        setFirstPerson(on) { body.visible = !on; },
        // World-space eye position (top of the head group) for placing the FP camera.
        getEyeWorldPosition(out) {
          const v = out || new THREE.Vector3();
          head.getWorldPosition(v);
          return v;
        },
        getState() { return this._state; },
        // climb phase channel: 47 calls this each frame BEFORE update(dt) with a phase
        // delta proportional to vertical distance moved. Positive = climbing up, negative
        // = down; 0 = not moving (limbs hold the hang pose). Consumed once per update.
        climbAdvance(dPhase) { if (typeof dPhase === 'number') this._climbAdv += dPhase; },
        setState(s) {
          if (s === this._state) return;
          if (s === 'attack') { this._attackT = 0; this._swingType = (this._swingType + 1) % 3; }
          if (s === 'jump') this._jumpT = 0;
          if (s === 'wave') this._emoteT = 0;
          // crouch/sit are HOLD poses (not self-timed one-shots): the 47 drive keeps
          // re-asserting them while the key is held / sit toggle is on, and switches
          // to walk/idle to release. crouch blends in over _poseT so the squat eases
          // down instead of snapping.
          if (s === 'crouch' || s === 'sit' || s === 'skydive' || s === 'rocket' || s === 'dance') this._poseT = 0;
          this._state = (s === 'walk' || s === 'attack' || s === 'jump' || s === 'crouch' || s === 'sit' || s === 'climb' || s === 'skydive' || s === 'rocket' || s === 'wave' || s === 'dance') ? s : 'idle';
        },
        // blink runs on its own clock, independent of walk/idle/jump, and re-meshes
        // only the head (small map). Eyes also wander between blinks (idle saccade).
        _faceStep(dt) {
          if (this._blinking > 0) {
            this._blinking -= dt;
            if (this._blinking <= 0) remeshHead(this._baseEyes || 'Focus');  // open, resume gaze
            return;
          }
          this._nextBlink -= dt;
          if (this._nextBlink <= 0) {
            this._nextBlink = 2.2 + Math.random() * 3.5;
            this._blinking = 0.13;                          // source: GAZE.blinking = 0.13
            this._baseEyes = this.cfg.eyes;
            remeshHead('Blink');
            return;
          }
          this._nextGaze -= dt;
          if (this._nextGaze <= 0) {
            this._nextGaze = 1.5 + Math.random() * 2.5;
            const want = GAZE_STATES[(Math.random() * GAZE_STATES.length) | 0];
            if (want !== this.cfg.eyes) { this._baseEyes = want; remeshHead(want); }
          }
        },
        update(dt) {
          dt = Math.min(dt || 0, 0.05);
          this._t += dt;
          this._faceStep(dt);
          const st = this._state;
          // Neutralize the "extra" rotation axes that only SPECIAL poses touch (arm
          // abduction sh.y/z, torso rotation, leg splay hip.y/z). Every branch sets the
          // CORE axes (sh.x, elbow.x, hip.x, knee.x, body.y) itself, so those can't leak;
          // these extras could, so zero them here and let each branch re-set what it needs
          // AFTER (same frame). Without this, skydive leg-splay / arm-spread would persist
          // into crouch/jump/walk which never clear those axes.
          armL.sh.rotation.y = 0; armL.sh.rotation.z = 0;
          armR.sh.rotation.y = 0; armR.sh.rotation.z = 0;
          chest.rotation.set(0, 0, 0);
          legL.hip.rotation.y = 0; legL.hip.rotation.z = 0;
          legR.hip.rotation.y = 0; legR.hip.rotation.z = 0;
          if (st !== 'walk') {
            // restore the chest/head pivot deltas the natural walk applies, so idle/
            // attack/jump start from the rest layout (no leftover bob/sway/chin lean).
            chest.position.set(BASE.chestX, BASE.chestY, BASE.chestZ);
            head.position.set(BASE.headX, BASE.headY, BASE.headZ);
          }
          if (st === 'walk') {
            // ---- voxel-poser strideCore, transcribed (constants ported V->1; the rig
            // builds at 1 unit/voxel so poser's `*V` factors become bare numbers). The
            // gait CURVES are literal; the rig bridge is: chest/head -> group position
            // deltas, legs -> planar 2-bone IK angles, arms -> FK swing angles.
            // body.position.y stays at the foot anchor — the natural bob lives on the
            // CHEST so the planted feet don't float (poser bobs the upper mass).
            body.position.y = bobBase;
            const spd = WALK_SPD;                          // cadence/intensity knob (see note)
            this._walkSpd = spd;
            const flutter = 1 + 0.05 * Math.sin(this._gph * 0.31 + 1.7);
            this._gph += dt * (4.2 + 9 * spd) * flutter;
            const gph = this._gph;
            const spdF = Math.min(1, spd / 0.4);
            // chest bob: weighted (pow 1.3) NOT a plain sine — the natural signature
            const bob = -Math.pow(Math.abs(Math.sin(gph)), 1.3) * 0.75;
            chest.position.y = BASE.chestY + bob;
            // lateral weight-sway over the planted foot (chest; head inherits via parent)
            const swayA = 0.8 * spdF;
            const sway = Math.cos(gph) * swayA;
            chest.position.x = BASE.chestX + sway;
            chest.position.z = BASE.chestZ;     // clear any idle fore/aft rock leftover
            this._gswx = sway;
            // forward spine lean: realized by shifting the foot anchor BACK (poser does
            // az -= lean); the leg IK then angles the body forward. chest stays put.
            const lean = 1.7 * Math.min(1.5, spd / 0.4);
            // ---- legs: strideCore foot targets -> planar IK angles ----
            const stride = 4.5 * Math.min(1.45, spd / 1.5);
            const liftH = 3 * Math.min(1.35, Math.max(spd, spd / 1.5));
            for (const S of ['L', 'R']) {
              const leg = S === 'L' ? legL : legR;
              const p = gph + (S === 'L' ? 0 : Math.PI);
              // foot target in `hips` frame, relative to this leg's hip pivot:
              const dz = Math.sin(p) * stride - lean;     // forward/back + spine lean
              const footY = GROUND_ANKLE_Y + Math.max(0, Math.cos(p)) * liftH;
              const dy = footY - BASE.hipPivotY;          // negative: foot below hip
              const a = legIK(dy, dz, LEG.U, LEG.F);
              leg.hip.rotation.x = a.hip; leg.knee.rotation.x = a.knee;
            }
            // ---- arms: counter-swing (opposite the legs), L/R asymmetric amp.
            // poser amp is a positional hand target; FK bridge: angle ~= amp/armLen.
            for (const S of ['L', 'R']) {
              const armg = S === 'L' ? armL : armR;
              const p = gph + (S === 'L' ? Math.PI : 0);   // opposite phase to same-side leg
              const amp = (S === 'L' ? 3.3 : 2.8) * Math.min(1.6, spd / 1.5);
              // -sin: same X-hinge convention as the legs (+rotation.x swings toward -Z),
              // so a forward arm target maps to a negative angle. Without the minus the
              // arm swings WITH the same-side leg instead of counter-swinging.
              const ang = -(Math.sin(p) * amp) / ARM.len;
              armg.sh.rotation.x = ang;
              armg.elbow.rotation.x = -Math.max(0, ang) * 0.4;
            }
            // ---- head: chest bob+sway already reach it via parenting; ADD ONLY the
            // head-specific extra terms — vertical bob at 2x step freq, a small lateral
            // sway offset, and the chin pushed forward (+z). (Avoids double-counting.)
            head.position.y = BASE.headY + Math.sin(2 * gph + 0.6) * 0.45;
            head.position.x = BASE.headX + Math.cos(gph - 0.5) * 0.35;
            head.position.z = BASE.headZ + 0.8;            // chin ahead (forward = +z, yaw=0)
          } else if (st === 'attack') {
            // ---- SWORD SLASH: cycle 3 weighted swings on successive presses (the rig's
            // _swingType advances in setState). Each is a 3-phase WINDUP -> SWING (fast) ->
            // RECOVER, eased so the strike accelerates through impact (NOT a symmetric
            // sine). Axes chosen from MEASURED wrist-world deltas (see report):
            //   shoulder.z = lateral ABDUCTION (arm out to the side, +z = arm's-right)
            //   shoulder.x = forward/back raise (+x = up-and-BACK; -x = down-and-forward)
            //   chest.y    = torso TWIST (carries both arms across the body) -> horiz slash
            //   chest.x    = torso BEND forward (+x) -> overhead chop
            //   elbow.x    = -x extends the forearm through the strike
            // Recover returns EVERY extra axis to exactly 0; idle/setState also hard-zero
            // them, so no twist/abduction leaks into walk/idle after the swing.
            this._attackT += dt;
            const DUR = 0.45;
            const a = Math.min(this._attackT / DUR, 1);
            // phase weights: windup 0..0.30 (ease-in), swing 0.30..0.58 (fast), recover 0.58..1
            const ease = (t) => t * t * (3 - 2 * t);             // smoothstep
            // s = drive parameter 0(rest)->1(windup peak)->-1ish(strike)->0(rest), built
            // piecewise so velocity peaks during the SWING window, not the midpoint.
            let wph, sph;                                        // windup-amount, strike-amount (0..1)
            if (a < 0.30) { wph = ease(a / 0.30); sph = 0; }
            else if (a < 0.58) { wph = 1 - ease((a - 0.30) / 0.28); sph = ease((a - 0.30) / 0.28); }
            else { wph = 0; sph = 1 - ease((a - 0.58) / 0.42); }
            const ty = this._swingType;
            if (ty === 2) {
              // ---- OVERHEAD CHOP: arm up-and-back overhead -> down-and-forward; chest
              // bends forward into the chop; knees dip on impact. ----
              const shx = 2.55 * wph + (-0.55) * sph;            // +up/back overhead (windup, wrist above shoulder) -> -down/fwd (strike)
              armR.sh.rotation.x = shx; armR.sh.rotation.z = 0; armR.sh.rotation.y = 0;
              armR.elbow.rotation.x = (-0.25 * wph) + (-0.75 * sph); // tucked, then extends down
              armL.sh.rotation.x = -0.25 * wph + 0.15 * sph;     // off arm braces back a touch
              armL.sh.rotation.z = 0; armL.elbow.rotation.x = -0.2 * (wph + sph);
              chest.rotation.x = 0.05 * wph + 0.6 * sph;         // upright windup -> bend forward on chop
              chest.rotation.y = 0; chest.rotation.z = 0;
              const cHip = -0.18 * sph, dip = 0.9 * sph;        // knees dip as the chop lands
              legL.hip.rotation.x = cHip; legR.hip.rotation.x = cHip;
              legL.knee.rotation.x = dip; legR.knee.rotation.x = dip;
              // PLANT the feet during the dip: bending the knees while body.y is held
              // would LIFT the soles (measured: ankle Y +0.02). Pin the body to the bent
              // leg's ankle so the dip LOWERS the mass instead — same closed-form plant
              // the crouch branch uses (body falls as knees fold; soles stay at y=0).
              const aRelY = -LEG.U * Math.cos(cHip) - LEG.F * Math.cos(cHip + dip);
              body.position.y = bobBase - (LEG.U + LEG.F) - aRelY;
            } else {
              // ---- HORIZONTAL SLASH: across-the-body. dir = +1 (R->L) for slashRL,
              // -1 (L->R) for slashLR (mirrored twist). The lead (right) arm raises
              // up-and-out to the lead shoulder in windup, then the chest WHIPS across
              // (twist about y) sweeping the arm diagonally down to the far hip. ----
              const dir = (ty === 0) ? 1 : -1;                   // RL: forehand; LR: backhand (mirror)
              // The TORSO twist leads in both (wound to the lead side, whipped to the far
              // side). The ARM is also made dir-aware so the two read as true mirrors, not
              // the same swing with a flipped torso:
              //   FOREHAND (dir +1): arm raises high+OUT to the right (big abduction), then
              //     sweeps down-and-across; the chest whip carries it left.
              //   BACKHAND (dir -1): arm winds up CROSSED in front of the body (less
              //     abduction, raised forward), then the chest whip flings it out to the
              //     right. shz is smaller and shx more forward so it visibly crosses.
              const abdW = dir > 0 ? 1.35 : 0.55;                // backhand crosses (low abduction) vs forehand out-high
              const abdS = dir > 0 ? 0.5 : 1.15;                 // ...and ends opposite (forehand in, backhand out)
              armR.sh.rotation.z = (abdW * wph) + (abdS * sph);
              armR.sh.rotation.x = ((dir > 0 ? 0.65 : 0.15) * wph) + (-0.7 * sph); // forehand raised, backhand fwd-cross
              armR.sh.rotation.y = 0;
              armR.elbow.rotation.x = (-0.15 * wph) + (-0.25 * sph); // extends through the strike
              chest.rotation.y = dir * (0.5 * wph + (-0.75) * sph); // wound to lead side -> whipped across
              chest.rotation.x = 0; chest.rotation.z = 0;
              // off (left) arm counter-rotates slightly for balance.
              armL.sh.rotation.z = -(0.4 * wph + 0.2 * sph);
              armL.sh.rotation.x = -0.2 * wph + 0.1 * sph;
              armL.elbow.rotation.x = -0.15 * (wph + sph);
              legL.hip.rotation.x = 0; legR.hip.rotation.x = 0;
              legL.knee.rotation.x = 0; legR.knee.rotation.x = 0;
              body.position.y = bobBase;                         // horizontal: feet stay straight-down
            }
            // (overhead sets body.position.y itself to plant the dip — don't clobber it)
            if (a >= 1) {
              // hard-zero every axis the swing drove so nothing leaks into idle/walk.
              armR.sh.rotation.set(0, 0, 0); armL.sh.rotation.set(0, 0, 0);
              armR.elbow.rotation.x = 0; armL.elbow.rotation.x = 0;
              chest.rotation.set(0, 0, 0);
              legL.hip.rotation.x = 0; legR.hip.rotation.x = 0;
              legL.knee.rotation.x = 0; legR.knee.rotation.x = 0;
              body.position.y = bobBase;                         // restore body height (overhead lowered it)
              this.setState('idle');
            }
          } else if (st === 'jump') {
            // crouch (0..0.25) -> launch/air (0.25..0.8) -> land absorb (0.8..1)
            this._jumpT += dt;
            const a = Math.min(this._jumpT / JUMP_DUR, 1);
            let legBend, armSwing, kneeBend, bob;
            if (a < 0.25) {                                   // anticipation crouch
              const u = a / 0.25;
              legBend = -0.9 * u; kneeBend = 1.1 * u;         // fold hips back, deep knees
              armSwing = 0.9 * u;                             // arms swing back (behind)
              bob = -0.18 * u;                                // weight sinks
            } else if (a < 0.8) {                             // launch + tuck in the air
              const u = (a - 0.25) / 0.55;
              legBend = -0.9 + 0.6 * u;                       // legs extend then tuck
              kneeBend = 1.1 - 0.5 * u;
              armSwing = 0.9 - 1.9 * u;                       // arms throw UP overhead (negative = forward/up)
              bob = 0;
            } else {                                          // landing absorb
              const u = (a - 0.8) / 0.2;
              legBend = -0.3 - 0.5 * u;                       // re-fold to cushion
              kneeBend = 0.6 + 0.5 * u;
              armSwing = -1.0 + 1.0 * u;                      // arms settle
              bob = -0.12 * u;
            }
            legL.hip.rotation.x = legBend; legR.hip.rotation.x = legBend;
            legL.knee.rotation.x = kneeBend; legR.knee.rotation.x = kneeBend;
            armL.sh.rotation.x = armSwing; armR.sh.rotation.x = armSwing;
            armL.elbow.rotation.x = -Math.max(0, kneeBend) * 0.4; armR.elbow.rotation.x = -Math.max(0, kneeBend) * 0.4;
            body.position.y = bobBase + bob;
            if (a >= 1) this.setState('idle');
          } else if (st === 'crouch') {
            // ---- crouch: squat with feet PLANTED (poser locoStep, crouchY/standY) ----
            // The whole figure sinks: lower the body group by D (rig units), and RAISE
            // the foot IK targets toward the (now-lower) hip pivot by the SAME D so the
            // soles stay at world y=0 while the knees fold. D is derived per-instance
            // from this rig's own measured rest height (bobBase + chest-above-hips), not
            // a baked constant — pelvis height differs Masc/Fem so the drop must scale.
            // Verified by measurement: feet world-Y/X/Z unchanged idle->crouch; chest
            // world-Y -> 0.692 of idle. chest/head were reset to BASE above.
            // Bend the legs with DIRECT angles (NOT legIK: at deep folds legIK is non-
            // metric — its +knee compounds with +hip and tucks the ankle up-and-back, so
            // it can't keep feet planted; that defect never shows in walk because walk
            // stays near full extension. legIK is shared with the verified walk — left
            // untouched.) Feet are then planted EXACTLY by pinning body.y to wherever the
            // bent leg's ankle lands (closed-form), so planting can't drift with the bend.
            // CROUCH_HIP slightly negative -> knees forward (a squat, knees over feet);
            // CROUCH_KNEE tuned by measurement so chest world-Y -> 0.692 of idle.
            this._poseT = Math.min(1, this._poseT + dt * 6);
            const u = this._poseT;
            const CH = -0.5 * u, CK = 1.85 * u;                // hip/knee fold (rig X-hinge); CK tuned so chest->0.692
            legL.hip.rotation.x = CH; legR.hip.rotation.x = CH;
            legL.knee.rotation.x = CK; legR.knee.rotation.x = CK;
            // ankle Y below the hip for this fold (thigh down at rest; +rot folds it):
            const aRelY = -LEG.U * Math.cos(CH) - LEG.F * Math.cos(CH + CK);
            // pin body so the ankle sits back at the idle ground line (feet planted):
            body.position.y = bobBase - (LEG.U + LEG.F) - aRelY;
            // head dips forward+down into the crouch (poser: head.lerp toward +z, lower y)
            head.position.y = BASE.headY - 1.1 * u;
            head.position.z = BASE.headZ + 0.9 * u;            // chin forward (+z = forward at yaw 0)
            // arms: small forward rest, settle (no swing)
            armL.sh.rotation.x = 0.25 * u; armR.sh.rotation.x = 0.25 * u;
            armL.elbow.rotation.x = -0.35 * u; armR.elbow.rotation.x = -0.35 * u;
          } else if (st === 'sit') {
            // ---- sit: hips folded ~90deg, feet forward, torso upright (poser POSES.Sit) ----
            // legIK is locked to one branch and +hip swings the thigh BACKWARD (the walk
            // convention) — a forward-foot IK target folds the knee BEHIND/below the hip
            // (a kneel, not a sit). So the SEATED leg fold uses DIRECT sign-checked angles
            // (measured): hip = -PI/2 swings the thigh forward to horizontal (knee fwd,
            // level with the hip); knee = 1.6 drops the shin so the foot lands forward on
            // the ground. Verified: knee world-pos forward (+z) of the hip, ankle forward
            // + below. This realizes poser POSES.Sit's shape (chest~0.635, feet fwd, knees
            // up-forward, torso upright) on THIS FK rig.
            this._poseT = Math.min(1, this._poseT + dt * 5);
            const u = this._poseT;
            // lower the whole figure to the seated chest ratio (0.635). Feet leave the
            // straight-down line and slide forward (sit lets them), so lower the body
            // group directly rather than holding feet planted.
            const seatDrop = bobBase * (1 - SIT_RATIO) * u;
            body.position.y = bobBase - seatDrop;
            // torso upright but leaning slightly back (poser Sit chest z=-2): negative z.
            chest.position.z = BASE.chestZ - 0.6 * u;
            head.position.z = BASE.headZ + 0.4 * u;            // head looks slightly up/forward
            const SIT_HIP = -1.571, SIT_KNEE = 1.6;            // -90deg fold + shin drop (measured)
            legL.hip.rotation.x = SIT_HIP * u; legR.hip.rotation.x = SIT_HIP * u;
            legL.knee.rotation.x = SIT_KNEE * u; legR.knee.rotation.x = SIT_KNEE * u;
            // arms: FK approximation (this rig has NO arm IK) — hands rest toward the
            // lap: shoulders forward a touch, elbows bent. NOT the poser's IK hand
            // targets, which can't be reproduced without arm IK. See report.
            armL.sh.rotation.x = 0.5 * u; armR.sh.rotation.x = 0.5 * u;
            armL.elbow.rotation.x = -0.6 * u; armR.elbow.rotation.x = -0.6 * u;
          } else if (st === 'climb') {
            // ---- climb: vertical hand-over-hand up a ladder ----
            // Phase is driven by VERTICAL PROGRESS (climbAdvance from 47), NOT dt, so the
            // cycle loops while moving and FREEZES into a static hang when stopped. The
            // two diagonal pairs are 180deg out of phase: left arm + right leg reach/step
            // together, anti-phase to right arm + left leg (true ladder gait).
            // Axes confirmed from this rig's measured conventions:
            //   +shoulder.x raises the arm UP-and-back overhead (attack-overhead windup uses
            //     shx=2.55 = "wrist above shoulder"); a small value below rest is the pull.
            //   leg STEP-UP = -hip (thigh swings forward/up, as sit's -1.571 fold proves) +
            //     +knee (bends the shin, walk/crouch convention). Anti-phase leg hangs near
            //     straight (small bend) so one foot is always planted lower on a rung.
            this._climbPhase += this._climbAdv;                // advance by the vertical-progress delta
            this._climbAdv = 0;                                // consume it (hold pose if 47 sent 0)
            const ph = this._climbPhase;
            body.position.y = bobBase;                         // y is owned by 47 (group.position.y)
            // slight forward lean toward the ladder so it reads as gripping, not floating.
            chest.rotation.x = 0.12;
            // arms: shoulder.x oscillates between a high reach (overhead) and a low pull.
            // REACH amplitude is large (arm overhead), PULL brings it down past rest.
            const REACH = 2.0, PULL = 0.15;                    // shoulder.x at top / bottom of a stroke
            const mid = (REACH + PULL) / 2, amp = (REACH - PULL) / 2;
            // left arm leads (sin), right arm trails (sin shifted PI) -> alternating reach.
            const aL = mid + Math.sin(ph) * amp;
            const aR = mid + Math.sin(ph + Math.PI) * amp;
            armL.sh.rotation.x = aL; armR.sh.rotation.x = aR;
            armL.sh.rotation.z = 0; armR.sh.rotation.z = 0;
            armL.sh.rotation.y = 0; armR.sh.rotation.y = 0;
            // forearms bend more when the arm is high (pulling the body up), less when low.
            armL.elbow.rotation.x = -0.5 - 0.5 * Math.max(0, Math.sin(ph));
            armR.elbow.rotation.x = -0.5 - 0.5 * Math.max(0, Math.sin(ph + Math.PI));
            // legs: each leg steps UP (thigh forward/up + knee bend) on its own half-cycle,
            // anti-phase to its same-side arm so the diagonal pairs (L-arm/R-leg) move
            // together. legR steps with armL; legL steps with armR.
            const STEP = 0.95;                                 // peak knee/hip fold on a step-up
            const stepR = Math.max(0, Math.sin(ph));           // right leg steps with left arm
            const stepL = Math.max(0, Math.sin(ph + Math.PI)); // left leg steps with right arm
            legR.hip.rotation.x = -STEP * 0.8 * stepR; legR.knee.rotation.x = 0.4 + STEP * stepR;
            legL.hip.rotation.x = -STEP * 0.8 * stepL; legL.knee.rotation.x = 0.4 + STEP * stepL;
          } else if (st === 'skydive') {
            // ---- FREEFALL: belly-to-earth "box"/banana position. The FALL CONTROLLER
            // (47, via setBodyPitch) tips the whole body face-down + owns the falling Y;
            // THIS branch poses LIMBS ONLY (never the root) so it can't fight setHeading.
            // Geometric spec (visually unconfirmed — no poser source for this pose):
            //   arms ABDUCT out to the sides (sh.z, mirrored) + raise slightly fwd (sh.x)
            //        + forearms bend up ~60deg (elbow.x);
            //   legs SPLAY outward (hip.z, mirrored) + slight fwd (hip.x) + knees bent up;
            //   chest ARCHES back (chest.x negative).
            // A wind-buffet flutter keeps it alive instead of a frozen mannequin. Eases in.
            // Spec (per the user, viewed 3rd-person from BEHIND): arms straight OUT to the
            // sides, legs swept BACK/APART and bent up at the knee. The FALL CONTROLLER
            // pitches the whole body face-down (~-1.5), so legs-back (+hip.x,
            // toward body -z) + knees-bent read as the table legs pointing up; arms out = wings.
            this._poseT = Math.min(1, this._poseT + dt * 5);
            const u = this._poseT;
            body.position.y = bobBase;
            const buf = Math.sin(this._t * 9) * 0.06 + Math.sin(this._t * 5.3) * 0.04; // wind flutter
            // arms straight out to the sides (large abduction), elbows only slightly bent.
            armR.sh.rotation.z = (1.62 + buf) * u; armL.sh.rotation.z = -(1.62 + buf) * u;
            armR.sh.rotation.x = 0.08 * u;         armL.sh.rotation.x = 0.08 * u;
            armR.elbow.rotation.x = -0.12 * u;     armL.elbow.rotation.x = -0.12 * u;
            // legs swept back and spread so the knees/boots stay readable behind the torso.
            legR.hip.rotation.z = (0.46 + buf * 0.5) * u; legL.hip.rotation.z = -(0.46 + buf * 0.5) * u;
            legR.hip.rotation.x = 0.88 * u;        legL.hip.rotation.x = 0.88 * u;
            legR.knee.rotation.x = 1.48 * u;       legL.knee.rotation.x = 1.48 * u;
            chest.rotation.x = -0.22 * u;
          } else if (st === 'rocket') {
            // ---- ROCKET-PACK FLIGHT: upright stance, arms drawn down/back as if braced against
            // the pack's thrust, legs together with a soft bend trailing below. The FALL
            // CONTROLLER (47) keeps the body ~upright (setBodyPitch ~0) and SPACE-thrust is the
            // sim's job; this is the visual stance. Gentle sway = the pack's wobble. (Unconfirmed.)
            this._poseT = Math.min(1, this._poseT + dt * 5);
            const u = this._poseT;
            body.position.y = bobBase;
            const sway = Math.sin(this._t * 2.2) * 0.06;
            armR.sh.rotation.x = -0.35 * u; armL.sh.rotation.x = -0.35 * u;     // arms drawn back/down
            armR.sh.rotation.z = (0.2 + sway) * u; armL.sh.rotation.z = -(0.2 - sway) * u;
            armR.elbow.rotation.x = -0.5 * u; armL.elbow.rotation.x = -0.5 * u;
            legR.hip.rotation.x = 0.2 * u; legL.hip.rotation.x = 0.2 * u;       // legs trail slightly
            legR.knee.rotation.x = 0.35 * u; legL.knee.rotation.x = 0.35 * u;
            chest.rotation.x = -0.1 * u;
          } else if (st === 'wave') {
            // ---- WAVE: right arm raises to the side and the forearm oscillates a
            // few times, then auto-returns to idle (self-timed via _emoteT, the same
            // pattern jump/attack use). Left arm + legs hold the rest pose. Core axes
            // only: sh.x raises the upper arm, sh.z lifts it out to the side, elbow.x
            // bends the forearm, and a sine on the forearm is the wave itself.
            this._emoteT += dt;
            const DUR = 1.6;
            const a = Math.min(this._emoteT / DUR, 1);
            const ease = (t) => t * t * (3 - 2 * t);     // smoothstep raise/lower
            const lift = ease(Math.min(1, a / 0.2)) * (1 - ease(Math.max(0, (a - 0.85) / 0.15)));
            armR.sh.rotation.x = -1.9 * lift;            // upper arm up (negative = up/forward)
            armR.sh.rotation.z = 0.5 * lift;             // out to the side a touch
            armR.elbow.rotation.x = (-0.5 - 0.5 * Math.sin(this._t * 14)) * lift;  // forearm waves
            armL.sh.rotation.x = 0; armL.elbow.rotation.x = 0;
            legL.hip.rotation.x = 0; legR.hip.rotation.x = 0;
            legL.knee.rotation.x = 0; legR.knee.rotation.x = 0;
            body.position.y = bobBase;
            if (a >= 1) {                                // hard-zero, return to idle
              armR.sh.rotation.set(0, 0, 0); armR.elbow.rotation.x = 0;
              this.setState('idle');
            }
          } else if (st === 'dance') {
            // ---- DANCE: a looping groove — chest bob + lateral sway, alternating arm
            // pumps and a hip shift. Loops on this._t (the emote timer in 47 releases
            // it). Core axes only; eased-in via _poseT so it doesn't snap on entry.
            this._poseT = Math.min(1, this._poseT + dt * 5);
            const u = this._poseT;
            const beat = this._t * 6.5;                  // groove tempo
            const bob = Math.abs(Math.sin(beat)) * 0.4 * u;
            const sway = Math.sin(beat * 0.5) * 0.5 * u;
            chest.position.y = BASE.chestY - bob;
            chest.position.x = BASE.chestX + sway;
            chest.rotation.z = -sway * 0.12;             // lean into the sway
            head.position.y = BASE.headY + Math.sin(beat) * 0.2 * u;
            // arms pump alternately (one up while the other is down)
            armL.sh.rotation.x = (-1.1 + Math.sin(beat) * 0.8) * u;
            armR.sh.rotation.x = (-1.1 - Math.sin(beat) * 0.8) * u;
            armL.elbow.rotation.x = -0.7 * u; armR.elbow.rotation.x = -0.7 * u;
            // knees give a small bounce in time with the bob (feet stay planted)
            const bounce = Math.abs(Math.sin(beat)) * 0.12 * u;
            legL.knee.rotation.x = bounce; legR.knee.rotation.x = bounce;
            legL.hip.rotation.x = 0; legR.hip.rotation.x = 0;
            body.position.y = bobBase - bounce * 0.5;
          } else {                                             // idle: breathing + weight-shift / rock on feet
            // A relaxed standing idle: the body's mass shifts laterally from one foot to
            // the other (chest x + a slight roll toward the weighted foot), rocks a hair
            // fore/aft (chest z + tiny pitch), dips a touch as the weight rolls over a
            // foot, and breathes (vertical rise + soft arm sway). The head rides along via
            // its chest parenting. Periods are long (~6-10s) and desynced per avatar
            // (_idlePhase) so a crowd reads as people idly settling, never a metronome.
            // Feet stay planted: knees only WHISPER (too small to lift a heel), so nothing
            // floats — the read is "shifting weight", not "marching in place".
            const breath = Math.sin(this._t * 1.6);
            const ph = this._t * 0.66 + this._idlePhase;
            const shift = Math.sin(ph) + 0.18 * Math.sin(ph * 2.7 + 1.1);   // lateral weight (~-1.2..1.2)
            const rock = Math.sin(this._t * 0.9 + this._idlePhase * 1.7);    // gentle fore/aft
            armL.sh.rotation.x = breath * A.idleArm; armR.sh.rotation.x = -breath * A.idleArm;
            // hard-clear the slash-only axes so no torso twist / arm abduction leaks in.
            armL.sh.rotation.y = 0; armL.sh.rotation.z = 0;
            armR.sh.rotation.y = 0; armR.sh.rotation.z = 0;
            // torso leans/rolls toward the weighted foot and rocks a touch fore/aft
            chest.rotation.set(rock * 0.018, 0, -shift * 0.05);
            chest.position.x = BASE.chestX + shift * 0.32;
            chest.position.z = BASE.chestZ + rock * 0.10;
            legL.hip.rotation.x = 0; legR.hip.rotation.x = 0;
            // a whisper of knee softening on the UNWEIGHTED side — small enough that the
            // sole stays on the ground (no visible heel lift), just enough to feel alive.
            legL.knee.rotation.x = Math.max(0, -shift) * 0.05;
            legR.knee.rotation.x = Math.max(0, shift) * 0.05;
            armL.elbow.rotation.x = 0; armR.elbow.rotation.x = 0;
            body.position.y = bobBase + breath * 0.04 - Math.abs(shift) * 0.04;
          }
        },
        dispose() {
          root.traverse((o) => { if (o.isMesh && o.geometry && !(o.userData && o.userData.sharedAvatarAsset)) { try { o.geometry.dispose(); } catch (_) {} } });
          if (root.parent) root.parent.remove(root);
          try { mat.dispose(); } catch (_) {}
          try { packMat.dispose(); flameMat.dispose(); } catch (_) {}
          geos.length = 0;
        },
      };
      return inst;
    }

    window.makeVoxelAvatar = makeVoxelAvatar;

    // ---- networked descriptor: a strict, fully-RESOLVED subset of makeVoxelAvatar
    //      opts, safe to send over the wire so every client renders the SAME look.
    //      Returns { kind:'voxel', seed, body, skin, hairC, hair, fit, head, height, build, gear } with
    //      ALL look fields populated (deriveCfg fills any unset from seed). Storing
    //      the resolved form (not seed-only) is deliberate: deriveCfg derives later
    //      fields via short-circuit PRNG calls, so an under-specified descriptor
    //      reshuffles — a complete one makes deriveCfg do zero PRNG work and renders
    //      bit-identically on self and on peers. Field domains (keep in sync with the
    //      server's cleanAvatar in party/index.js): body Masc|Fem; skin int 0..4
    //      (SKINS.length); hairC int 0..6 (HAIRC.length); hair in HAIRS; fit in
    //      OUTFIT_KEYS; head Wide|Slim; height 0.84..1.22; build int -2..2; gear in GEARS.
    function voxelAvatarDescriptor(opts) {
      const c = deriveCfg(opts);
      return {
        kind: 'voxel',
        seed: c.seed >>> 0,
        body: c.body,
        skin: c.skin,
        hairC: c.hairC,
        hair: c.hair,
        fit: c.fit,
        head: c.head,
        height: c.height,
        build: c.build,
        gear: c.gear,
      };
    }
    // Expose the wardrobe option lists so the picker (49) can build preset/random
    // voxel looks without re-declaring them (single source of truth).
    voxelAvatarDescriptor.SKINS = SKINS.length;
    voxelAvatarDescriptor.HAIRC = HAIRC.length;
    voxelAvatarDescriptor.HAIRS = HAIRS.slice();
    voxelAvatarDescriptor.OUTFITS = OUTFIT_KEYS.slice();
    voxelAvatarDescriptor.GEARS = GEARS.slice();
    voxelAvatarDescriptor.BUILDS = [
      { value: -2, label: 'Thin' },
      { value: -1, label: 'Lean' },
      { value: 0, label: 'Average' },
      { value: 1, label: 'Stocky' },
      { value: 2, label: 'Fat' },
    ];
    voxelAvatarDescriptor.HEIGHTS = [
      { value: 0.88, label: 'Short' },
      { value: 1, label: 'Average' },
      { value: 1.13, label: 'Tall' },
    ];
    window.voxelAvatarDescriptor = voxelAvatarDescriptor;
  })();
