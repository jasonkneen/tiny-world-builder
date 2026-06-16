/**
 * LandscapeEngine — noise & height sampling mixin.
 *
 * Attaches math helpers (smoothstep, hash, value-noise, fbm), terrain
 * height sampling, and strata color lookup to LandscapeEngine.prototype.
 *
 * Depends on: LandscapeEngine being defined globally (loaded before this
 * script) and window.THREE.
 */
(function (global) {
  if (!global.LandscapeEngine) {
    throw new Error('engine/landscape/noise.js: LandscapeEngine must be loaded first.');
  }

  Object.assign(global.LandscapeEngine.prototype, {
    // --- Math Helpers ---
    _smoothstep(t) { return t * t * (3 - 2 * t); },
    _clamp01(t) { return Math.max(0, Math.min(1, t)); },
    _smoothstepRange(edge0, edge1, x) {
      const t = this._clamp01((x - edge0) / (edge1 - edge0));
      return this._smoothstep(t);
    },

    _hash2(x, y) {
      const s = Math.sin((x + this.SEED_OX) * 127.1 + (y + this.SEED_OY) * 311.7) * 43758.5453;
      return s - Math.floor(s);
    },

    _srand(a, b, salt = 0) {
      const s = Math.sin(a * 12.9898 + b * 78.233 + salt * 37.719 + this.seed * 0.1417) * 43758.5453;
      return s - Math.floor(s);
    },

    _vnoise(x, y) {
      const ix = Math.floor(x), iy = Math.floor(y);
      const fx = x - ix, fy = y - iy;
      const u = this._smoothstep(fx), v = this._smoothstep(fy);
      const a = this._hash2(ix, iy);
      const b = this._hash2(ix + 1, iy);
      const c = this._hash2(ix, iy + 1);
      const d = this._hash2(ix + 1, iy + 1);
      return a * (1 - u) * (1 - v) + b * u * (1 - v) +
             c * (1 - u) * v + d * u * v;
    },

    _fbm(x, y, oct) {
      let v = 0, a = 1, f = 1, tot = 0;
      for (let i = 0; i < oct; i++) {
        v += a * this._vnoise(x * f, y * f);
        tot += a;
        a *= 0.5; f *= 2;
      }
      return v / tot;
    },

    /**
     * Decides whether the island-cell at integer coords (cellX, cellZ) holds an
     * island, and if so returns its jittered world center, rotation, lobe
     * coefficients and a per-cell radius multiplier. Returns null for open-ocean
     * cells. Fully deterministic on (cellX, cellZ) via _srand (which folds in
     * this.seed) — so neighbouring streamed chunks agree on every island.
     *
     * Faithful to voxel-poser's satellite form: a round lobed boundary
     *   R_at(th) = R * (0.74 + 0.18*cos(2*th + k1) + 0.11*sin(th + k2))
     * Attempt-#2 flavour: the per-cell radius multiplier `v` and the lobe phases
     * (k1,k2) carry the variation, so islands differ in size and lumpiness while
     * staying simple round poser isles. NOTE: `v` rides the boundary radius ONLY;
     * the height-profile bands use the fixed nominal radius, so the shared profile
     * stays identical for every island (territory borders read continuously).
     */
    _floodIslandAt(cellX, cellZ, SPACING, R_world) {
      // Gate first on occupancy — cheapest possible reject (one sin), so most
      // ocean cells cost almost nothing.
      const OCCUPANCY = 0.6;                       // fraction of cells with land
      if (this._srand(cellX, cellZ, 11) >= OCCUPANCY) return null;

      // Jitter the center within the cell, kept small enough that an island's
      // total influence (radius + sea-slope) never escapes the 3x3 scan.
      const JITTER = 0.20 * SPACING;
      const baseX = (cellX + 0.5) * SPACING;
      const baseZ = (cellZ + 0.5) * SPACING;
      const cx = baseX + (this._srand(cellX, cellZ, 23) - 0.5) * 2 * JITTER;
      const cz = baseZ + (this._srand(cellX, cellZ, 31) - 0.5) * 2 * JITTER;

      // Per-cell variation: radius multiplier v in [0.85, 1.15], free rotation,
      // and lobe phase offsets so each isle's kidney shape is distinct.
      const v = 0.85 + this._srand(cellX, cellZ, 41) * 0.30;
      const rot = this._srand(cellX, cellZ, 53) * Math.PI * 2;
      const k1 = this._srand(cellX, cellZ, 67) * Math.PI * 2;
      const k2 = this._srand(cellX, cellZ, 83) * Math.PI * 2;

      return { cx, cz, rot, k1, k2, R: R_world * v };
    },

    /**
     * Flooded-planet height field (only used when this.flood is set; the home
     * builder's canyon terrain is left untouched). A faithful infinite-tiling
     * port of voxel-poser's island/sea system: open water EVERYWHERE, with a few
     * discrete rounded lobed islands rising from a sandy shore to a low flat green
     * heart. NOT an fbm noise field — land is a small set of discretely placed
     * isles (~8% of the domain). Returns ABSOLUTE world height (WATER_LEVEL units).
     * FREQ_SCALE zooms island spacing/size; HEIGHT_SCALE scales the relief.
     */
    _floodHeight(x, z) {
      const fs = this.FREQ_SCALE || 1;
      const hs = this.HEIGHT_SCALE || 1;

      // --- Horizontal scale (decoupled from vertical) ---
      // SPACING derives inversely from FREQ_SCALE so it only zooms the islands;
      // land fraction stays invariant. R_world is a fixed fraction of SPACING,
      // which (with the jitter/variation caps below) keeps the 3x3 scan complete.
      const SPACING = 7200 / fs;            // island-cell size in world units
      const R_world = 0.27 * SPACING;       // nominal lobed-boundary base radius
      const UNIT = R_world / 9.2;           // world units per poser unit (R=9.2)

      // --- Vertical scale (poser profile amplitudes, in world units) ---
      // HEIGHT_SCALE is applied to the amplitudes. Land must clear WATER_LEVEL by
      // >= ~60 (≈2-3 voxel steps) to read as land; the seabed floor must sit well
      // below WATER_LEVEL-step so the ocean plane reads as water at every LOD.
      const LAND_RISE = 200 * hs;           // land peak above WATER_LEVEL (≈ +90)
      const SEA_DEPTH = 300 * hs;           // sea drop below WATER_LEVEL (≈ -135)
      const SEABED = this.WATER_LEVEL - SEA_DEPTH;   // single shared sea floor

      // --- Find the most-positive signed distance over the 3x3 island block ---
      // sd > 0 = inside land; sd <= 0 = sea (linear slope to the seabed floor).
      const cellX = Math.floor(x / SPACING);
      const cellZ = Math.floor(z / SPACING);
      let sdMax = -Infinity;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const isle = this._floodIslandAt(cellX + dx, cellZ + dz, SPACING, R_world);
          if (!isle) continue;
          const px = x - isle.cx, pz = z - isle.cz;
          // atan2(0,0)=0 in JS (query exactly at center) -> inside, which is correct.
          const th = Math.atan2(pz, px) - isle.rot;
          const rAt = isle.R * (0.74 + 0.18 * Math.cos(2 * th + isle.k1)
                                       + 0.11 * Math.sin(th + isle.k2));
          const sd = rAt - Math.hypot(px, pz);     // world-unit signed distance
          if (sd > sdMax) sdMax = sd;
        }
      }

      // No island reaches this query -> flat open seabed (equals the sea floor,
      // so it joins the sea branch's clamp continuously: no ring seam).
      if (sdMax === -Infinity) return SEABED;

      // --- Map sd -> height with the poser profile, scaled into world units ---
      // The band thresholds use the FIXED nominal UNIT (not the per-island v), so
      // the profile is identical for every island and territory borders are smooth.
      if (sdMax <= 0) {
        // SEA: linear slope (poser sd*0.16, clamped to the seabed floor at sd=-3.4375).
        const t = this._clamp01(-sdMax / (3.4375 * UNIT));        // 0 at shore -> 1 at floor
        return this.WATER_LEVEL - t * SEA_DEPTH;
      }
      // LAND: gentle shore -> low flat green plateau, plus tiny meadow lumps.
      let h = this.WATER_LEVEL + this._smoothstepRange(0.1 * UNIT, 2.8 * UNIT, sdMax) * LAND_RISE;
      const lump = (Math.sin(x / UNIT * 1.1 + z / UNIT * 1.37)
                  + Math.sin(x / UNIT * 1.73 - z / UNIT * 0.61));
      h += lump * 0.013 * LAND_RISE * this._smoothstepRange(0.5 * UNIT, 1.4 * UNIT, sdMax);
      return h;
    },

    /**
     * Evaluates the absolute height of the canyon terrain at grid coordinates.
     * @param {number} x - X Coordinate
     * @param {number} z - Z Coordinate
     * @returns {number} Height
     */
    getHeight(x, z) {
      if (this.flood) return this._floodHeight(x, z);
      const runwayEllipse = Math.hypot(x * 1.45, z * 0.22);
      const runwayMask = this._smoothstepRange(220, 560, runwayEllipse);
      const corridorX = 1 - this._smoothstepRange(135, 360, Math.abs(x));
      const corridorZ = 1 - this._smoothstepRange(260, 1850, Math.abs(z));
      const approachCorridor = this._clamp01(corridorX * corridorZ);

      let h = 0, amp = 1, freq = 0.0018, tot = 0;
      for (let i = 0; i < 5; i++) {
        const n = this._vnoise(x * freq, z * freq);
        h += amp * (1 - Math.abs(n * 2 - 1)); // ridged
        tot += amp;
        amp *= 0.5; freq *= 2;
      }
      h = Math.pow(h / tot, 2.4) * 260;

      // Large-scale valleys
      h += (this._fbm(x * 0.0006, z * 0.0006, 3) - 0.4) * 120;
      h = Math.max(0, h);

      // Terracing mesas
      const step = 28;
      const t = h / step;
      const base = Math.floor(t);
      const frac = t - base;
      const tr = frac < 0.72 ? 0 : this._smoothstep((frac - 0.72) / 0.28);
      h = (base + tr) * step;

      // Carve runway corridor
      h *= Math.max(runwayMask, 1 - approachCorridor * 0.96);
      h = Math.max(0, h - approachCorridor * 22);

      // Airstrip basin details
      const basinRipple = (1 - runwayMask) * (this._fbm(x * 0.006, z * 0.006, 2) - 0.5) * 5.5;
      h = Math.max(0, h + basinRipple);

      // Airfield flatness exclusion
      const runwayPad = (1 - this._smoothstepRange(18, 42, Math.abs(x)))
        * (1 - this._smoothstepRange(215, 285, Math.abs(z)));
      const apronPad = (1 - this._smoothstepRange(8, 74, Math.abs(x - 34)))
        * (1 - this._smoothstepRange(92, 210, Math.abs(z - 150)));
      const taxiPad = (1 - this._smoothstepRange(6, 18, Math.abs(x - 17)))
        * (1 - this._smoothstepRange(62, 168, Math.abs(z - 116)));
      const airfieldPad = this._clamp01(Math.max(runwayPad, apronPad, taxiPad));
      h *= 1 - airfieldPad * 0.998;
      h = Math.max(0, h - airfieldPad * 3.5);

      return h;
    },

    _strataColor(h, out) {
      for (let i = 0; i < this.STRATA.length - 1; i++) {
        if (h <= this.STRATA[i + 1].h) {
          const t = (h - this.STRATA[i].h) / (this.STRATA[i + 1].h - this.STRATA[i].h);
          out.copy(this.STRATA[i].c).lerp(this.STRATA[i + 1].c, Math.max(0, Math.min(1, t)));
          return out;
        }
      }
      out.copy(this.STRATA[this.STRATA.length - 1].c);
      return out;
    },
  });
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
