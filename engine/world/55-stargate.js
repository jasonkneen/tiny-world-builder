  // -------- stargate: the combo portal gate for the sky <-> land transition --------
  // A single composite 'nested' gate: a voxel STONE ring casing, a recessed metallic
  // lining, bright white energy hoops, and a glowing core. This is THE gate used on the
  // sky-island edge (placed by 56-gate-transit) and on the mainland surface.
  // API: window.__tinyworldStargate = { build(style), styles, current() }
  // IIFE — no top-level identifiers leak into the shared global scope.
  (function stargateBoot() {
    'use strict';
    if (typeof window === 'undefined' || typeof THREE === 'undefined') return;

    const _c = new THREE.Color();

    // ---- voxel mesher (vs-param, beveled) — ported from voxel-poser voxGeo ----
    function hash3(x, y, z) { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); }
    function vox(map, x, y, z, hex) { map.set(x + ',' + y + ',' + z, hex); }
    function voxGeo(map, cx, cy, cz, vs) {
      const pos = [], nor = [], col = [], idx = [];
      const PK = (x, y, z) => ((x + 128) << 16) | ((y + 128) << 8) | (z + 128);
      const occ = new Set(); const cells = [];
      for (const [k, hex] of map) { const p = k.split(','); const x = +p[0], y = +p[1], z = +p[2]; occ.add(PK(x, y, z)); cells.push(x, y, z, hex); }
      const has = (x, y, z) => occ.has(PK(x, y, z));
      const b = 0.22;
      const quad = (pts, n, r, g, bl) => { const base = pos.length / 3; for (const p of pts) { pos.push(p[0] * vs, p[1] * vs, p[2] * vs); nor.push(n[0], n[1], n[2]); col.push(r, g, bl); } idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3); };
      for (let ci = 0; ci < cells.length; ci += 4) {
        const x = cells[ci], y = cells[ci + 1], z = cells[ci + 2];
        _c.set(cells[ci + 3]).convertSRGBToLinear();
        const j = 0.94 + hash3(x, y, z) * 0.10; const r = _c.r * j, g = _c.g * j, bl = _c.b * j;
        const C = [x - cx, y - cy, z - cz];
        for (let a = 0; a < 3; a++) for (const s of [1, -1]) {
          const n = [0, 0, 0]; n[a] = s; if (has(x + n[0], y + n[1], z + n[2])) continue;
          const ua = (a + 1) % 3, va = (a + 2) % 3;
          const conv = (ax, ss) => { const e = [0, 0, 0]; e[ax] = ss; return !has(x + e[0], y + e[1], z + e[2]); };
          const corner = (su, sv) => { const p = [C[0], C[1], C[2]]; p[a] += s * 0.5; p[ua] += su * (0.5 - (conv(ua, su) ? b : 0)); p[va] += sv * (0.5 - (conv(va, sv) ? b : 0)); return p; };
          quad([corner(-1, -1), corner(1, -1), corner(-1, 1), corner(1, 1)], n, r, g, bl);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx); geo.computeBoundingBox();
      return geo;
    }
    function shade(hex, f) { _c.set(hex).multiplyScalar(f); _c.r = Math.min(_c.r, 1); _c.g = Math.min(_c.g, 1); _c.b = Math.min(_c.b, 1); return '#' + _c.getHexString(); }

    // ============================ STYLE: nested ============================
    // The composite: voxel STONE ring as the outer casing, the smooth metallic ring
    // lining the inside of its opening, the white energy hoops within that, and the
    // dark event-horizon recessed in the centre. Layers nest like a real ornate gate.
    function buildNested() {
      const vs = 0.025, g = new THREE.Group();
      const HJ = (x, y, z) => { let h = (x * 374761 + y * 668265 + z * 9301) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };
      const STONE = ['#8c8f96', '#7d818a', '#969aa2', '#85888f'];
      // CY = RAD SINKS the gate so the opening bottom is at ground (local y=0): the
      // lower stone arc is buried and a person walks straight in at ground level.
      const RAD = 15, RING = 5, TH = 3, CY = RAD; const OR = RAD * vs;
      const M = new Map();
      for (let y = -(RAD + RING + 1); y <= RAD + RING + 1; y++) for (let x = -(RAD + RING + 1); x <= RAD + RING + 1; x++) {
        if (y + CY < 0) continue;                 // don't bury the lower arc too deep below the base
        const rr = Math.hypot(x, y); if (rr < RAD || rr > RAD + RING) continue;
        const band = (rr - RAD) / RING; const prof = Math.sin(band * Math.PI); const dz = Math.max(1, Math.round(TH * (0.45 + 0.55 * prof)));
        for (let z = -dz; z <= dz; z++) {
          let c; const inner = rr < RAD + 1.2;
          const chevron = (Math.round(Math.atan2(y, x) / (Math.PI * 2) * 36) % 4 === 0) && band > 0.35 && band < 0.85;
          if (inner && Math.abs(z) <= 1) c = '#2b3138'; else if (chevron && z === 0) c = '#caa23a'; else c = STONE[(Math.abs(x * 7 + y * 13 + z * 3)) % 4];
          vox(M, x, y + CY, z, HJ(x, y, z) <= 0.5 ? shade(c, 0.78) : c);
        }
      }
      for (let q = 0; q < 6; q++) { const a = q / 6 * Math.PI * 2, rr = RAD + RING - 1; const cxv = Math.round(Math.cos(a) * rr), cyv = Math.round(Math.sin(a) * rr); if (cyv + CY < 0) continue; for (let k = 0; k < 3; k++) vox(M, cxv, cyv + CY + (k - 1), TH, '#7fe6ff'); }
      // (no raised base — the gate is sunk; the island ground is the walk-in floor)
      const frame = new THREE.Mesh(voxGeo(M, 0, 0, 0, vs), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.05, side: THREE.DoubleSide }));
      frame.castShadow = frame.receiveShadow = true; g.add(frame);
      const cyW = CY * vs;
      // smooth metal ring — RECESSED behind the stone front face so the voxel casing
      // covers its outer edge; a thin lining just inside the opening, not a big disc.
      const metal = new THREE.Mesh(new THREE.TorusGeometry(OR * 0.99, vs * 1.7, 18, 64), new THREE.MeshStandardMaterial({ color: 0x59697c, roughness: 0.28, metalness: 0.92, side: THREE.DoubleSide }));
      metal.position.set(0, cyW, -vs * 1.8); g.add(metal);
      // bright WHITE energy hoops — the visible centre of the gate
      const hoops = []; const hcols = [0xffffff, 0xd6f3ff, 0x8fe3ff];
      for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.TorusGeometry(OR * (0.7 - i * 0.2), vs * (0.55 - i * 0.1), 8, 56), new THREE.MeshBasicMaterial({ color: hcols[i], transparent: true, opacity: 0.95 - i * 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.position.set(0, cyW, vs * (0.5 - i * 0.25)); g.add(m); hoops.push(m); }
      // bright white-cyan core glow filling the centre (the "white in the middle")
      const core = new THREE.Mesh(new THREE.CircleGeometry(OR * 0.62, 40), new THREE.MeshBasicMaterial({ color: 0xcdefff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      core.position.set(0, cyW, vs * 0.2); g.add(core);
      // EDGE rim — a dim additive torus hugging the outer stone edge that the receiving
      // gate brightens ("ring lights up around its EDGES"). Sits at the front face.
      const RIMR = (RAD + RING * 0.5) * vs;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(RIMR, vs * 1.3, 10, 80), new THREE.MeshBasicMaterial({ color: 0x7fe6ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
      rim.position.set(0, cyW, TH * vs + vs * 0.2); g.add(rim);
      // subtle dark backing FAR recessed for depth (not a black donut)
      const back = new THREE.Mesh(new THREE.CircleGeometry(OR * 0.95, 40), new THREE.MeshBasicMaterial({ color: 0x0a1822, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
      back.position.set(0, cyW, -vs * 2.8); g.add(back);
      const light = new THREE.PointLight(0x9fe3ff, 1.0, 6); light.position.set(0, cyW, 0.3); g.add(light);
      // Transient FX levels (0..1), set by 56 and decayed each update() so a pulse
      // self-clears. _flash brightens the core/hoops/light; _edge brightens the rim.
      let _flash = 0, _edge = 0;
      return {
        group: g, centerY: cyW, openR: OR * 0.7, openWorldR: OR,
        // pulse the portal surface bright (stage 3). amt 0..1, additive on top of baseline.
        flash(amt) { _flash = Math.max(_flash, Math.min(1, amt == null ? 1 : amt)); },
        // light up the ring around its outer EDGES (stage 5 receiving gate). amt 0..1.
        edgeLight(amt) { _edge = Math.max(_edge, Math.min(1, amt == null ? 1 : amt)); },
        update(t) {
          hoops[0].rotation.z = t * 0.7; hoops[1].rotation.z = -t * 1.1; hoops[2].rotation.z = t * 1.5;
          const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
          const f = _flash;
          core.scale.setScalar(0.92 + pulse * 0.14 + f * 0.5);
          core.material.opacity = Math.min(1, 0.38 + pulse * 0.3 + f * 0.62);
          hoops.forEach((h, i) => { h.material.opacity = Math.min(1, (0.95 - i * 0.18) * (0.6 + pulse * 0.5) + f * 0.5); });
          light.intensity = 0.7 + pulse * 0.9 + f * 4.0;
          light.color.setRGB(0.62 + f * 0.38, 0.89 + f * 0.11, 1.0);   // whiten on flash
          rim.material.opacity = _edge * (0.55 + 0.45 * pulse);        // rim only visible when lit
          rim.scale.setScalar(1 + _edge * 0.04);
          _flash *= 0.90;  // ~decay over ~0.5s at 60fps
          _edge *= 0.94;   // edge lingers a touch longer
        },
      };
    }

    // Only the combo 'nested' gate remains. build() always returns it.
    const BUILDERS = { nested: buildNested };
    function build(style) { return (BUILDERS[style] || buildNested)(); }

    window.__tinyworldStargate = {
      styles: ['nested'],
      build,
      current: () => 'nested',
    };
  })();
