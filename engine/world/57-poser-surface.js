  // -------- poser surface: the ACTUAL voxel-poser island + sea system --------
  // Lifted verbatim from voxel-poser.html (the discrete kidney isles in a calm
  // banded sea, with foam ribbons) and transplanted as the flooded planet's
  // surface. This is NOT a re-derived height field — it is the poser's own
  // SATS / ISLE / groundH geometry, sand+meadow meshes, animated water shader
  // and foam, dropped under the floating islands so fly-down lands on it.
  //
  // Exposed as window.__tinyworldPoserSurface.{show,hide,build}. fly-down (54)
  // calls show()/hide() on descend/ascend; the sea animates on its own rAF.
  // IIFE — no top-level identifiers leak into the shared global scope.
  (function poserSurfaceBoot() {
    'use strict';
    if (typeof window === 'undefined' || typeof THREE === 'undefined') return;

    // ===== lifted from voxel-poser.html (lines ~432-497): island/sea geometry =====
    const SATS = [                                       // five satellite isles, ringed wide
      { cx: 46, cz: 9,  rot: 0.6, k1: 0.9, k2: 2.1 },
      { cx: 14, cz: -46, rot: 2.2, k1: 2.4, k2: 0.4 },
      { cx: -40, cz: -26, rot: 4.0, k1: 4.2, k2: 3.3 },
      { cx: -44, cz: 22, rot: 1.1, k1: 1.6, k2: 5.0 },
      { cx: 10, cz: 50, rot: 3.1, k1: 5.3, k2: 1.2 }];
    function satRAt(sat, th) {
      return 9.2 * (0.74 + 0.18 * Math.cos(2 * th + sat.k1) + 0.11 * Math.sin(th + sat.k2));
    }
    function satSd(sat, x, z) {
      const dx = x - sat.cx, dz = z - sat.cz;
      return satRAt(sat, Math.atan2(dz, dx) - sat.rot) - Math.hypot(dx, dz);
    }
    const ISLE = {
      r: 9.2, sx: 2.6, sz: 1.54, t: 0, sea: null, seaU: null, meadow: null,
      rAt(th) {
        const base = this.r * (0.74 + 0.18 * Math.cos(2 * th) + 0.11 * Math.sin(th));
        return base * (this.sx * this.sz) / Math.hypot(this.sz * Math.cos(th), this.sx * Math.sin(th));
      },
    };
    // wildflower spots: the meadow rises gently around each one
    const FLOWERS = (() => {
      const out = [];
      let h = 12345;
      const rnd = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
      for (let i = 0; i < 140 && out.length < 46; i++) {
        const th = rnd() * Math.PI * 2, rr = ISLE.rAt(th) * (0.12 + rnd() * 0.5);
        const x = Math.cos(th) * rr, z = Math.sin(th) * rr;
        const sd = ISLE.rAt(Math.atan2(z, x)) - Math.hypot(x, z);
        if (sd > 2.4) out.push({ x, z });
      }
      return out;
    })();
    const _ss = (a, b, t) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
    function isleH(sd, x, z, flowers) {
      if (sd <= 0) return Math.max(-0.55, sd * 0.16);       // sloping down to the seabed
      let h = _ss(0.1, 2.8, sd) * 0.3;                      // the raised green heart
      h += (Math.sin(x * 1.1 + z * 1.37) + Math.sin(x * 1.73 - z * 0.61)) * 0.013 * _ss(0.5, 1.4, sd);  // lumps
      if (flowers) for (const f of FLOWERS) {               // a swell of earth under each flower bed
        const fd = Math.hypot(x - f.x, z - f.z);
        if (fd < 0.42) { const k = 1 - fd / 0.42; h += k * k * 0.055; }
      }
      return h;
    }
    function nearestIsle(x, z) {                            // [isleIndex, sd] for the closest landmass
      let bi = 0, bsd = ISLE.rAt(Math.atan2(z, x)) - Math.hypot(x, z);
      for (let i = 0; i < SATS.length; i++) {
        const sd = satSd(SATS[i], x, z);
        if (sd > bsd) { bsd = sd; bi = i + 1; }
      }
      return [bi, bsd];
    }
    function groundH(x, z) {
      const [bi, sd] = nearestIsle(x, z);
      return isleH(sd, x, z, bi === 0);
    }

    // ===== textures (poser's sand gradient; a simple grass speckle for the meadow) =====
    function sandTexture() {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 512;
      const g = cv.getContext('2d');
      const grad = g.createRadialGradient(256, 256, 30, 256, 256, 256);
      grad.addColorStop(0, '#dcca9c'); grad.addColorStop(0.55, '#d2bd8a');
      grad.addColorStop(0.82, '#c7ad77'); grad.addColorStop(0.94, '#b89c66');
      grad.addColorStop(1, '#a98c55');
      g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
      g.globalAlpha = 0.05;
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = Math.random() < 0.5 ? '#b89f6e' : '#fff6dd';
        g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }
      g.globalAlpha = 1;
      return new THREE.CanvasTexture(cv);
    }
    function grassTexture() {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 256;
      const g = cv.getContext('2d');
      g.fillStyle = '#6f9d3c'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2200; i++) {
        const r = Math.random();
        g.fillStyle = r < 0.4 ? '#5c8a31' : r < 0.75 ? '#7fae47' : '#90b85a';
        g.fillRect(Math.random() * 256, Math.random() * 256, 2, 3);
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

    // ===== foliage: voxel mesher + treeVox + flower voxels lifted VERBATIM from
    // voxel-poser.html (lines ~315-1015, 6311-6390). The poser's own primitives —
    // only the SCATTER is adapted: seeded (so every client renders identical
    // foliage, matching the deterministic SATS/ISLE/FLOWERS) and extended across
    // all six islands instead of the poser's single home isle. =====
    const PV = 0.07;                 // poser prop voxel: 1 vox = 0.07 world units
    const V = 0.0175;                // rig voxel (voxGeo fallback only; unused here)
    function hash3(x, y, z) {
      const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
      return s - Math.floor(s);
    }
    const _col = new THREE.Color();
    const cfg = { bevel: false };    // poser default; trees use the un-beveled mesher
    const COLLIDERS = [];            // treeVox pushes trunk colliders here (unused on surface)
    function vox(M, x, y, z, c) { M.set(x + ',' + y + ',' + z, c); }
    const voxMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0, side: THREE.DoubleSide });
    function shade(hex, f) {
      _col.set(hex).multiplyScalar(f);
      _col.r = Math.min(_col.r, 1); _col.g = Math.min(_col.g, 1); _col.b = Math.min(_col.b, 1);
      return '#' + _col.getHexString();
    }
    function voxGeo(map, cx, cy, cz, vs) {
      const VS = vs || V;
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
      const b = cfg.bevel ? 0.24 : 0;
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
          const conv = (ax, ss) => {
            const e = [0, 0, 0]; e[ax] = ss;
            return !has(x + e[0], y + e[1], z + e[2]);
          };
          const corner = (su, sv) => {
            const p = [C[0], C[1], C[2]];
            p[a] += s * 0.5;
            p[ua] += su * (0.5 - (conv(ua, su) ? b : 0));
            p[va] += sv * (0.5 - (conv(va, sv) ? b : 0));
            return p;
          };
          quad([corner(-1, -1), corner(1, -1), corner(-1, 1), corner(1, 1)], n, r, g, bl);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      return geo;
    }
    function treeVox(wx, wz, seed, species) {
      // species: 0 oak (broad layered crown), 1 birch (pale, airy), 2 pine (cone), 3 bush
      const g = new THREE.Group();
      const M = new Map();
      const H = (a, b, c) => {
        let h = (a * 374761 + b * 668265 + c * 9301 + seed * 2654435761) | 0;
        h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296;
      };
      const sp = species === undefined ? (H(1, 2, 3) * 10) | 0 : species;
      const blob = (cx, cy, cz, r, shades, squash) => {
        const R = Math.ceil(r);
        for (let x = -R; x <= R; x++) for (let y = -R; y <= R; y++) for (let z = -R; z <= R; z++) {
          const d = Math.hypot(x, y * (squash || 1.25), z);
          if (d > r - H(cx + x, cy + y, cz + z) * 0.9) continue;
          const t = (y + R) / (2 * R);
          const c = shades[Math.min(shades.length - 1, (t * shades.length + H(x, y, z) * 0.8) | 0)];
          vox(M, cx + x, cy + y, cz + z, c);
        }
      };
      if (sp <= 4) {                                       // OAK family
        const h = 11 + (H(4, 5, 6) * 5) | 0;
        for (let y = 0; y < h; y++) vox(M, 0, y, 0, (y % 5 === 3) ? '#5e442a' : '#6e4f30');
        vox(M, 1, 0, 0, '#5e442a'); vox(M, -1, 0, 0, '#6e4f30'); vox(M, 0, 0, 1, '#5e442a');
        vox(M, 0, 1, -1, '#6e4f30');
        const G2 = ['#2f5e2a', '#3f7a34', '#4e8a3c', '#5d9c48', '#6fae57'];
        blob(0, h + 1, 0, 4.4 + H(7, 8, 9) * 0.9, G2);
        blob(3, h - 1, 1, 3.0, G2);
        blob(-3, h, -1, 3.2, G2);
        blob(1, h + 4, -2, 2.8, G2);
        blob(-1, h + 3, 2, 2.6, G2);
        vox(M, 1, h - 2, 0, '#6e4f30'); vox(M, -1, h - 1, -1, '#5e442a');
      } else if (sp <= 6) {                                // BIRCH
        const h = 15 + (H(4, 5, 6) * 4) | 0;
        for (let y = 0; y < h; y++) vox(M, 0, y, 0, H(0, y, 0) < 0.22 ? '#4a4640' : '#d8d2c4');
        const G2 = ['#4e8a3c', '#65a851', '#7cbf63', '#8fd072'];
        blob(0, h + 1, 0, 3.3, G2, 1.1);
        blob(2, h - 1, 1, 2.4, G2, 1.1);
        blob(-2, h, 0, 2.3, G2, 1.1);
        blob(0, h + 3, -1, 2.0, G2, 1.1);
      } else if (sp <= 8) {                                // PINE
        const h = 15 + (H(4, 5, 6) * 5) | 0;
        for (let y = 0; y < h; y++) vox(M, 0, y, 0, '#5a3f28');
        const G2 = ['#264a28', '#2d5230', '#36633a'];
        for (let tier = 0; tier < 6; tier++) {
          const r = 5.2 - tier * 0.95, cy = 4 + tier * ((h - 3) / 5.5);
          for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++)
            if (Math.hypot(x, z) <= r - H(x, tier, z) * 0.7)
              vox(M, x, cy | 0, z, G2[(tier + ((x + z) & 1)) % 3]);
        }
        vox(M, 0, h, 0, '#2d5230'); vox(M, 0, h + 1, 0, '#264a28');
      } else {                                             // BUSH
        const G2 = ['#3f7a34', '#4e8a3c', '#5d9c48'];
        blob(0, 1, 0, 1.7 + H(4, 5, 6), G2, 1.4);
      }
      const m = new THREE.Mesh(voxGeo(M, 0, -0.5, 0, PV), voxMat);
      m.castShadow = m.receiveShadow = true;
      m.scale.setScalar(sp > 8 ? 0.8 + H(9, 9, 9) * 0.3 : 1.25 + H(9, 9, 9) * 0.5);
      m.rotation.y = H(2, 7, 1) * Math.PI * 2;
      m.position.set(wx, Math.max(0, groundH(wx, wz)), wz);
      g.add(m);
      if (sp <= 8) COLLIDERS.push({ x: wx, z: wz, r: 0.15 });
      return g;
    }
    // flower bed lifted from poser flowerBeds() inner loop, but built per-bed at a
    // LOCAL origin (poser baked world groundH into voxel-y; we keep y relative so the
    // F-subgroup vertical correction applies cleanly, like trees).
    function flowerBed(fx, fz) {
      const g = new THREE.Group();
      const M = new Map();
      const VS = PV * 0.5;
      const bx = 0, bz = 0;
      const pc = ['#e8c44a', '#e87a8a', '#f0f0e2', '#d8884a'][(Math.abs(((fx * 1000) | 0) * 31 ^ ((fz * 1000) | 0) * 17)) % 4];
      vox(M, bx, 0, bz, '#3f7a34');
      vox(M, bx, 1, bz, pc);
      vox(M, bx + 1, 1, bz, pc); vox(M, bx - 1, 1, bz, pc);
      vox(M, bx, 1, bz + 1, pc); vox(M, bx, 1, bz - 1, pc);
      vox(M, bx, 2, bz, shade(pc, 1.12));
      const m = new THREE.Mesh(voxGeo(M, 0, 0, 0, VS), voxMat);
      m.castShadow = true;
      m.position.set(fx, Math.max(0, groundH(fx, fz)), fz);
      g.add(m);
      return g;
    }

    // Merge a list of voxGeo geometries (shared voxMat, indexed, pos/nor/col) into
    // one BufferGeometry so the whole forest is a single draw call (the app is
    // render-bound; ~440 separate tree meshes would tank the fly-down framerate).
    function mergeGeos(list) {
      let vtot = 0, itot = 0;
      for (const g of list) { vtot += g.attributes.position.count; itot += g.index ? g.index.count : g.attributes.position.count; }
      const pos = new Float32Array(vtot * 3), nor = new Float32Array(vtot * 3), col = new Float32Array(vtot * 3);
      const idx = new Uint32Array(itot);
      let vo = 0, io = 0;
      for (const g of list) {
        const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
        pos.set(p.array, vo * 3); nor.set(n.array, vo * 3); col.set(c.array, vo * 3);
        const gi = g.index ? g.index.array : null;
        if (gi) { for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo; io += gi.length; }
        else { for (let i = 0; i < p.count; i++) idx[io + i] = vo + i; io += p.count; }
        vo += p.count;
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      out.setAttribute('color', new THREE.BufferAttribute(col, 3));
      out.setIndex(new THREE.BufferAttribute(idx, 1));
      return out;
    }

    // Scatter trees + flower beds across all islands, then bake each element's
    // transform and merge into ONE mesh. Baked vertical scale is s/Y_BOOST so that
    // the surface group's scale.y (SCALE*Y_BOOST) renders foliage at the poser's
    // native isotropic proportions; baked y is native groundH so it sits flush on
    // the terrain. treeVox/flowerBed themselves are verbatim from the poser.
    function buildFoliage(parent) {
      const geos = [];
      const _q = new THREE.Quaternion(), _mat = new THREE.Matrix4(), _e = new THREE.Euler();
      let h = 0x1a2b3c4d;            // seeded LCG (same idiom as FLOWERS) -> identical on every client
      const rnd = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
      const placed = [];

      const bake = (g) => {          // g = group from treeVox/flowerBed; extract+bake its mesh geometry
        const m = g.children[0];
        _e.copy(m.rotation); _q.setFromEuler(_e);
        _mat.compose(m.position, _q, new THREE.Vector3(m.scale.x, m.scale.y / Y_BOOST, m.scale.z));
        geos.push(m.geometry.clone().applyMatrix4(_mat));
      };
      const addTree = (wx, wz, seed, sp) => { bake(treeVox(wx, wz, seed, sp)); placed.push([wx, wz]); };

      // home isle (centered, rot 0) + five satellites; each is a radius fn + a
      // signed-distance fn so we can keep trees inland on the green meadow heart.
      const ISLES = [{ rAt: th => ISLE.rAt(th), cx: 0, cz: 0, rot: 0, sd: (x, z) => ISLE.rAt(Math.atan2(z, x)) - Math.hypot(x, z) }];
      for (const sat of SATS) ISLES.push({ rAt: th => satRAt(sat, th), cx: sat.cx, cz: sat.cz, rot: sat.rot, sd: (x, z) => satSd(sat, x, z) });

      let seedCtr = 5;
      ISLES.forEach((isle, ii) => {
        const minSd = ii === 0 ? 3.0 : 2.4;                 // inland threshold (sats are smaller)
        const nGroves = ii === 0 ? 7 : 3;
        const groves = [];
        for (let tries = 0; groves.length < nGroves && tries < 400; tries++) {
          const th = rnd() * Math.PI * 2;
          const rr = isle.rAt(th) * (0.06 + rnd() * 0.5);
          const gx = isle.cx + Math.cos(th + isle.rot) * rr, gz = isle.cz + Math.sin(th + isle.rot) * rr;
          if (isle.sd(gx, gz) < minSd + 1.4) continue;       // grove centers well inland
          if (groves.some(o => Math.hypot(gx - o.x, gz - o.z) < 3.4)) continue;
          groves.push({ x: gx, z: gz, sp: (groves.length % 3) * 3 });
        }
        groves.forEach((gr) => {
          const nTrees = 7 + (rnd() * 4 | 0);
          for (let t = 0, guard = 0; t < nTrees && guard < 60; guard++) {
            const a = rnd() * Math.PI * 2, d = rnd() * 2.6;
            const wx = gr.x + Math.cos(a) * d, wz = gr.z + Math.sin(a) * d;
            if (isle.sd(wx, wz) < minSd) continue;
            if (placed.some(p => Math.hypot(wx - p[0], wz - p[1]) < 0.55)) continue;
            if (ii === 0 && FLOWERS.some(f => Math.hypot(wx - f.x, wz - f.z) < 0.8)) continue;
            addTree(wx, wz, seedCtr++ * 13 + 5, gr.sp + (rnd() * 3 | 0));
            t++;
          }
          for (let b = 0; b < 6; b++) {                      // undergrowth bushes between trunks
            const a = rnd() * Math.PI * 2, d = 0.6 + rnd() * 2.4;
            const wx = gr.x + Math.cos(a) * d, wz = gr.z + Math.sin(a) * d;
            if (isle.sd(wx, wz) < minSd - 0.6) continue;
            addTree(wx, wz, seedCtr++ * 7, 9);
          }
        });
        for (let l = 0, guard = 0; l < (ii === 0 ? 12 : 5) && guard < 120; guard++) {   // lone trees
          const th = rnd() * Math.PI * 2;
          const rr = isle.rAt(th) * (0.06 + rnd() * 0.55);
          const wx = isle.cx + Math.cos(th + isle.rot) * rr, wz = isle.cz + Math.sin(th + isle.rot) * rr;
          if (isle.sd(wx, wz) < minSd) continue;
          if (placed.some(p => Math.hypot(wx - p[0], wz - p[1]) < 0.9)) continue;
          if (ii === 0 && FLOWERS.some(f => Math.hypot(wx - f.x, wz - f.z) < 0.8)) continue;
          addTree(wx, wz, seedCtr++ * 53 + 11);
          l++;
        }
      });

      for (const f of FLOWERS) bake(flowerBed(f.x, f.z));   // home-isle wildflower beds

      if (!geos.length) return null;
      const merged = new THREE.Mesh(mergeGeos(geos), voxMat);
      merged.name = 'poserFoliage';
      merged.castShadow = merged.receiveShadow = true;
      merged.material.fog = true;   // foliage fades into the haze with the land
      parent.add(merged);
      ISLE.foliage = merged;
      return merged;
    }

    // ===== distant 360-degree mountain backdrop: hides the world-edge cutoff =====
    // The sea plane just ends at ~150u; beyond it is bare sky, so the horizon reads
    // as a hard line. A far inward-facing cylinder of layered, hazy mountain
    // silhouettes (fading into the sky color at top + base) rings the scene so the
    // distance dissolves into atmosphere instead of cutting off. Pure backdrop:
    // unlit, fog-off, drawn behind everything.
    function mountainTexture() {
      const W = 2048, H = 512;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d');
      g.clearRect(0, 0, W, H);
      const ridge = (x, layer) => {                       // continuous around the circle (wraps at W)
        const a = x / W * Math.PI * 2;
        return Math.sin(a * 3 + layer * 1.7) * 0.5 + Math.sin(a * 5 + layer * 3.1) * 0.28
          + Math.sin(a * 8 + layer * 0.6) * 0.16 + Math.sin(a * 13 + layer * 2.2) * 0.09;
      };
      const layers = [
        { base: 0.72, amp: 0.20, c: [124, 146, 180] },    // back ridge (hazy, tallest)
        { base: 0.56, amp: 0.24, c: [86, 108, 146] },     // mid
        { base: 0.40, amp: 0.26, c: [58, 80, 118] },      // front (dark, crisp silhouette)
      ];
      for (let li = 0; li < layers.length; li++) {
        const L = layers[li];
        g.beginPath(); g.moveTo(0, H);
        for (let x = 0; x <= W; x++) g.lineTo(x, H - (L.base + ridge(x, li) * L.amp) * H);
        g.lineTo(W, H); g.closePath();
        const grad = g.createLinearGradient(0, H * (1 - L.base - L.amp), 0, H);
        grad.addColorStop(0, `rgba(${L.c[0] + 24},${L.c[1] + 20},${L.c[2] + 14},0.96)`);
        grad.addColorStop(1, `rgba(${L.c[0]},${L.c[1]},${L.c[2]},0.98)`);
        g.fillStyle = grad; g.fill();
      }
      const hz = g.createLinearGradient(0, H * 0.90, 0, H);   // melt only the base into the sky haze (#b9dcf4)
      hz.addColorStop(0, 'rgba(185,220,244,0)');
      hz.addColorStop(1, 'rgba(185,220,244,0.85)');
      g.fillStyle = hz; g.fillRect(0, H * 0.90, W, H * 0.10);
      const tex = new THREE.CanvasTexture(cv);
      tex.wrapS = THREE.RepeatWrapping;
      if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }
    function buildBackdrop(parent) {
      const BD = new THREE.Group();
      BD.name = 'poserBackdrop';
      BD.scale.set(1, 1 / Y_BOOST, 1);                    // counter the surface group's vertical stretch
      const R = 135, H = 60;                              // local units -> x SCALE world (radius ~216, height ~96)
      const geo = new THREE.CylinderGeometry(R, R, H, 96, 1, true);
      geo.translate(0, H / 2, 0);                         // base at y=0 (sea level in group space)
      const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        map: mountainTexture(), transparent: true, side: THREE.BackSide, depthWrite: false, fog: false,
      }));
      ring.renderOrder = -1;                              // draw behind islands/foliage
      BD.add(ring);
      parent.add(BD);
      ISLE.backdrop = BD;
      return BD;
    }

    let group = null, foams = [], built = false, raf = null;

    function parentNode() {
      if (typeof worldGroup !== 'undefined' && worldGroup) return worldGroup;
      if (typeof xrWorldRoot !== 'undefined' && xrWorldRoot) return xrWorldRoot;
      return (typeof scene !== 'undefined') ? scene : null;
    }

    // ===== build the surface group (lifted from voxel-poser.html lines ~659-787) =====
    function build() {
      if (built) return group;
      group = new THREE.Group();
      group.name = 'poserSurface';
      group.visible = false;

      const sandTex = sandTexture();   // (kept for parity; vertex colors carry the sand)
      const grassTex = grassTexture();

      // voxel-finish heightfield: raised meadow heart, sloping sand, and a true seabed.
      // G is the cell size: the poser used 0.2 for a close-up camera, but at planet
      // scale (x1.6) seen from the fly-down orbit, 0.4 is visually identical and cuts
      // the island triangle count ~4x (the surface was ~300k tris at 0.2).
      const G = 0.4, pos = [], col = [], idx = [];
      const mpos = [], muv = [], midx = [];
      const SAND = [[0.80, 0.70, 0.51], [0.76, 0.66, 0.47], [0.84, 0.74, 0.55], [0.72, 0.62, 0.43]];
      const QH = (x, z) => Math.round(groundH(x, z) / 0.014) * 0.014;
      const quad = (x0, z0, x1, z1, c) => {
        const b = pos.length / 3;
        pos.push(x0, QH(x0, z0), z0, x1, QH(x1, z0), z0, x1, QH(x1, z1), z1, x0, QH(x0, z1), z1);
        for (let q = 0; q < 4; q++) col.push(c[0], c[1], c[2]);
        idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
      };
      const REGIONS = [{ x0: -29, x1: 29, z0: -21, z1: 21, sat: null }];
      for (const sat of SATS) REGIONS.push({ x0: sat.cx - 14.5, x1: sat.cx + 14.5, z0: sat.cz - 14.5, z1: sat.cz + 14.5, sat });
      for (const R of REGIONS)
        for (let gx = R.x0; gx <= R.x1; gx += G) {
          for (let gz = R.z0; gz <= R.z1; gz += G) {
            const cx = gx + G / 2, cz = gz + G / 2;
            const th = R.sat ? Math.atan2(cz - R.sat.cz, cx - R.sat.cx) - R.sat.rot : Math.atan2(cz, cx);
            const shoreD = R.sat ? satSd(R.sat, cx, cz) : ISLE.rAt(th) - Math.hypot(cx, cz);
            if (shoreD < -4.4) continue;                    // seabed levels off and ends
            const wob = (Math.sin(cx * 3.1 + cz * 1.7) + Math.sin(cx * 1.3 - cz * 2.6)) * 0.34;
            if (shoreD > 2.0 + wob) {                        // the grassy heart
              const u0 = cx * 0.55, v0 = cz * 0.55;
              const mb = mpos.length / 3;
              mpos.push(gx, QH(gx, gz) + 0.003, gz, gx + G, QH(gx + G, gz) + 0.003, gz,
                gx + G, QH(gx + G, gz + G) + 0.003, gz + G, gx, QH(gx, gz + G) + 0.003, gz + G);
              muv.push(u0, v0, u0 + G * 0.55, v0, u0 + G * 0.55, v0 + G * 0.55, u0, v0 + G * 0.55);
              midx.push(mb, mb + 2, mb + 1, mb, mb + 3, mb + 2);
              continue;
            }
            let c = SAND[(Math.abs((cx * 73856093 ^ cz * 19349663) | 0)) % 4];
            if (shoreD < 0) {                                // underwater sand, deepening blue
              const k = Math.min(1, -shoreD / 3.6);
              c = [c[0] * (1 - k) + 0.13 * k, c[1] * (1 - k) + 0.30 * k, c[2] * (1 - k) + 0.46 * k];
            } else if (shoreD < 0.55) {
              c = [c[0] * 0.92, c[1] * 0.92, c[2] * 0.95];   // damp band
            }
            quad(gx, gz, gx + G, gz + G, c);
          }
        }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      gg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      gg.setIndex(idx);
      gg.computeVertexNormals();
      const island = new THREE.Mesh(gg,
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
      island.receiveShadow = true;
      group.add(island);

      if (mpos.length) {
        const mg = new THREE.BufferGeometry();
        mg.setAttribute('position', new THREE.Float32BufferAttribute(mpos, 3));
        mg.setAttribute('uv', new THREE.Float32BufferAttribute(muv, 2));
        mg.setIndex(midx);
        mg.computeVertexNormals();
        const meadow = new THREE.Mesh(mg,
          new THREE.MeshStandardMaterial({ map: grassTex, color: 0xaecb66, roughness: 1, metalness: 0 }));
        meadow.receiveShadow = true;
        group.add(meadow);
        ISLE.meadow = meadow;
      }

      // sea: a soft-banded disc. The water shading is fully procedural in the
      // fragment shader (from world-XZ), so the plane needs almost no tessellation
      // (80x80 -> 8x8 drops ~12.6k tris with no visual change).
      const seaGeo = new THREE.PlaneGeometry(150, 150, 8, 8);
      seaGeo.rotateX(-Math.PI / 2);
      {
        const n = seaGeo.attributes.position.count;
        const sc = new Float32Array(n * 3);
        for (let i = 0; i < n * 3; i++) sc[i] = 1;
        seaGeo.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
      }
      const sea = new THREE.Mesh(seaGeo,
        new THREE.MeshStandardMaterial({
          color: 0x356f9e, vertexColors: true, roughness: 0.4, metalness: 0.05,
          transparent: true, opacity: 0.92,
        }));
      sea.material.onBeforeCompile = (sh) => {              // fully procedural water shading
        sh.uniforms.uT = { value: 0 };
        ISLE.seaU = sh.uniforms;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec2 vWp;')
          .replace('#include <begin_vertex>',
            '#include <begin_vertex>\nvWp = (modelMatrix*vec4(position,1.0)).xz;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', ['#include <common>',
            'varying vec2 vWp; uniform float uT;',
            'float vhash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }',
            'float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);',
            '  return mix(mix(vhash(i), vhash(i + vec2(1.0, 0.0)), f.x),',
            '             mix(vhash(i + vec2(0.0, 1.0)), vhash(i + vec2(1.0, 1.0)), f.x), f.y); }',
          ].join('\n'))
          .replace('#include <color_fragment>', ['#include <color_fragment>',
            '{',
            '  float n1 = vnoise(vWp*1.5 + vec2(uT*0.17, uT*0.11));',
            '  float n2 = vnoise(vWp*3.2 - vec2(uT*0.12, uT*0.19));',
            '  float ca = pow(clamp(1.0 - abs(sin(n1*6.2831) + sin(n2*6.2831))*0.5, 0.0, 1.0), 3.0);',
            '  diffuseColor.rgb += ca*vec3(0.2, 0.28, 0.3);',
            '  diffuseColor.rgb *= 0.95 + vnoise(vWp*0.6 + uT*0.05)*0.1;',
            '}',
          ].join('\n'));
      };
      sea.material.fog = true;    // the sea dissolves into the haze before its plane edge shows
      sea.position.y = -0.02;
      group.add(sea);
      ISLE.sea = sea;

      // foam ribbons hugging every shoreline, conforming to the terrain
      const foamMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false,
        side: THREE.DoubleSide, fog: true,
      });
      foams = [];
      const mkFoam = (rAtFn, ox, oz, rot) => {
        const fpos = [], fidx = [];
        for (let i = 0; i <= 160; i++) {
          const th = i / 160 * Math.PI * 2, r = rAtFn(th);
          const cx = Math.cos(th + rot), sz = Math.sin(th + rot);
          const ix = ox + cx * (r - 0.03), iz = oz + sz * (r - 0.03);
          const oxw = ox + cx * (r + 0.24), ozw = oz + sz * (r + 0.24);
          fpos.push(ix, Math.max(0, groundH(ix, iz)) + 0.006, iz, oxw, 0.006, ozw);
          if (i < 160) { const b = i * 2; fidx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3); }
        }
        const fg = new THREE.BufferGeometry();
        fg.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
        fg.setIndex(fidx);
        const foam = new THREE.Mesh(fg, foamMat);
        group.add(foam);
        foams.push(foam);
        return foam;
      };
      mkFoam(th => ISLE.rAt(th), 0, 0, 0);
      for (const sat of SATS) mkFoam(th => satRAt(sat, th), sat.cx, sat.cz, sat.rot);

      // land respects the surface's far haze fog (set in show()) so edges fade out;
      // the home scene's near mist is swapped out while the surface is shown.
      island.material.fog = true;
      if (ISLE.meadow) ISLE.meadow.material.fog = true;

      buildBackdrop(group);  // 360-degree distant mountain ring hides the world-edge cutoff
      buildFoliage(group);   // trees + flower beds (lifted from voxel-poser), on the green

      built = true;
      return group;
    }

    // World placement: native poser units (~150 wide, ~0.9 tall relief) are scaled
    // up and dropped to where fly-down points the descent gaze. Y is boosted only
    // slightly so the islands stay low + gentle like the poser (not tall cliffs).
    // Tune SCALE/Y_BOOST/DROP if the framing needs it.
    const SCALE = 1.6, Y_BOOST = 1, DROP = 60;   // Y_BOOST 1 = cubic voxels (was 3: terrain looked stretched when walking on it)
    const FAR_FOR_BACKDROP = 700;   // camera far plane while the surface (+ mountain ring) is shown
    // Distance fog so the sea + land dissolve into the haze BEFORE their hard edges
    // are visible, blending the world into the (unfogged) mountain backdrop. World
    // units: sea half-extent is 120, mountain ring 216 (fog:false so it stays). Fog
    // reaches full haze by FOG_FAR, hiding the sea's plane edge.
    const FOG_NEAR = 55, FOG_FAR = 150, FOG_HAZE = 0xc3d4e6;

    let _savedFar = null, _savedFog = null, _surfFog = null;
    function show() {
      build();
      const par = parentNode();
      if (!par) return false;
      if (group.parent !== par) par.add(group);
      const tx = (typeof target !== 'undefined' && target) ? target.x : 0;
      const tz = (typeof target !== 'undefined' && target) ? target.z : 0;
      group.scale.set(SCALE, SCALE * Y_BOOST, SCALE);
      group.position.set(tx, -DROP, tz);
      group.visible = true;
      // The mountain backdrop ring sits ~216u from centre; the surface camera's
      // default far plane (200) clips it (measured: ring NDC z==1 == far-clipped).
      // Raise far while the surface is shown; restored on hide().
      if (typeof camera !== 'undefined' && _savedFar === null) {
        _savedFar = camera.far;
        camera.far = Math.max(camera.far, FAR_FOR_BACKDROP);
        camera.updateProjectionMatrix();
      }
      // Far haze fog so sea/land fade out before their edges show (backdrop is fog:false).
      if (typeof scene !== 'undefined' && scene) {
        if (_savedFog === null) _savedFog = scene.fog || false;   // false marks "was null"
        _surfFog = new THREE.Fog(FOG_HAZE, FOG_NEAR, FOG_FAR);
        scene.fog = _surfFog;
      }
      startTick();
      return true;
    }

    function hide() {
      if (group) group.visible = false;
      if (typeof camera !== 'undefined' && _savedFar !== null) {
        camera.far = _savedFar; camera.updateProjectionMatrix(); _savedFar = null;
      }
      if (typeof scene !== 'undefined' && scene && _savedFog !== null) {
        scene.fog = _savedFog || null; _savedFog = null; _surfFog = null;
      }
      stopTick();
    }

    function startTick() {
      if (raf) return;
      let last = (performance && performance.now) ? performance.now() : Date.now();
      const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        ISLE.t += dt;
        if (ISLE.seaU && ISLE.seaU.uT) ISLE.seaU.uT.value = ISLE.t;
        const k = 0.5 + 0.18 * Math.sin(ISLE.t * 0.9);     // gentle foam shimmer
        for (const f of foams) if (f.material) f.material.opacity = k;
        // Re-assert the far plane in case fly-down/other camera code reset it while
        // the surface (and its distant mountain ring) is showing.
        if (typeof camera !== 'undefined' && camera.far < FAR_FOR_BACKDROP) {
          camera.far = FAR_FOR_BACKDROP; camera.updateProjectionMatrix();
        }
        // Re-assert our haze fog in case fly-down cleared it (it drops distant fog on descend).
        if (typeof scene !== 'undefined' && scene && _surfFog && scene.fog !== _surfFog) scene.fog = _surfFog;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    function stopTick() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    // ---- surface coordinate helpers (used by 47's surface-roam controller) ----
    // The surface group is positioned at worldGroup y=-DROP with scale SCALE*Y_BOOST on y.
    // These helpers convert between world-space (Three.js scene) and local poser space.
    const SURF_CLAMP = 74; // clamp x/z to just inside the sea-plane to avoid the fogged edge
    function clampSurf(v) { return Math.max(-SURF_CLAMP, Math.min(SURF_CLAMP, v)); }

    // World (Three.js) position -> poser-local position (the frame groundH works in).
    // Use group.position (set once in show()) not target (moves every camera frame during roam).
    function worldToLocal(wx, wy, wz) {
      const gx = (group && group.position) ? group.position.x : 0;
      const gz = (group && group.position) ? group.position.z : 0;
      const lx = (wx - gx) / SCALE;
      const lz = (wz - gz) / SCALE;
      const ly = (wy - (-DROP)) / (SCALE * Y_BOOST);
      return { x: clampSurf(lx), y: ly, z: clampSurf(lz) };
    }

    // Poser-local (x, z) -> world-space Y that the avatar should stand on.
    // walkY is the surface height in world units (sea level = 0 in local -> -DROP in world).
    // Use group.position (stable anchor set by show()) not target (moves every camera frame).
    function sampleWorld(wx, wz) {
      const gx = (group && group.position) ? group.position.x : 0;
      const gz = (group && group.position) ? group.position.z : 0;
      const lx = clampSurf((wx - gx) / SCALE);
      const lz = clampSurf((wz - gz) / SCALE);
      const [bi, sd] = nearestIsle(lx, lz);
      const localH = isleH(sd, lx, lz, bi === 0);
      // walkY: never below sea level (water is walkable, not sunken)
      const walkLocalY = Math.max(0, localH);
      // convert to world Y: localY * SCALE * Y_BOOST + (-DROP)
      const walkWorldY = walkLocalY * SCALE * Y_BOOST + (-DROP);
      return { wx, wz, walkWorldY, localH, water: localH < 0 };
    }

    window.__tinyworldPoserSurface = { show, hide, build, group: () => group, sampleWorld, worldToLocal };
  })();
