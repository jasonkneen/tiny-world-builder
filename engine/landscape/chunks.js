/**
 * LandscapeEngine — chunk streaming mixin.
 *
 * Builds high-detail terrain chunks (with instanced rocks/flora scatter)
 * and the cheaper far-LOD chunk tiles, plus the build-queue plumbing
 * that the update() loop drives each frame. Attaches `_makeChunk`,
 * `_makeFarChunk`, `_queueChunkBuild`, `_trimPendingChunkBuilds`, and
 * `_processChunkBuildQueues` to LandscapeEngine.prototype.
 *
 * Depends on: LandscapeEngine being defined globally and window.THREE.
 */
(function (global) {
  if (!global.LandscapeEngine) {
    throw new Error('engine/landscape/chunks.js: LandscapeEngine must be loaded first.');
  }
  const THREE = global.THREE;
  if (!THREE) {
    throw new Error('engine/landscape/chunks.js: THREE must be loaded first.');
  }

  Object.assign(global.LandscapeEngine.prototype, {
    // --- Terrain Chunk Builder ---
    _makeChunk(cx, cz) {
      const cxW = (cx + 0.5) * this.CHUNK_SIZE;
      const czW = (cz + 0.5) * this.CHUNK_SIZE;

      const group = new THREE.Group();
      group.position.set(cxW, 0, czW);

      const lowPoly = this.styleMode === 'lowpoly';
      const backdrop = this.BACKDROP_MODE === true;
      const sandM = lowPoly ? this.sandMatLowPoly : this.terrainMat;
      const rockM = lowPoly ? this.rockMatLowPoly : this.rockMat;

      const geo = new THREE.PlaneGeometry(this.CHUNK_SIZE, this.CHUNK_SIZE, this.CHUNK_RES, this.CHUNK_RES);
      geo.rotateX(-Math.PI / 2);

      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const tmp = new THREE.Color();

      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i);
        const lz = pos.getZ(i);
        const wx = cxW + lx;
        const wz = czW + lz;
        const h = this.getHeight(wx, wz);
        pos.setY(i, h);

        this._strataColor(h, tmp);

        // Cliff face tint
        const hN = this.getHeight(wx + 5, wz);
        const hE = this.getHeight(wx, wz + 5);
        const slope = Math.min(1, (Math.abs(hN - h) + Math.abs(hE - h)) * 0.045);
        if (slope > 0.25) {
          tmp.lerp(this.CLIFF_TINT, (slope - 0.25) * 0.55);
        }

        // Mottling noise
        const n1 = this._vnoise(wx * 0.045, wz * 0.045);
        const n2 = this._vnoise(wx * 0.011, wz * 0.011);
        tmp.multiplyScalar(0.78 + n1 * 0.22 + (n2 - 0.5) * 0.18);

        colors[i * 3] = tmp.r;
        colors[i * 3 + 1] = tmp.g;
        colors[i * 3 + 2] = tmp.b;
      }

      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, sandM);
      mesh.position.set(0, 0, 0);
      mesh.castShadow = false;
      mesh.receiveShadow = !backdrop;
      group.add(mesh);

      if (backdrop) {
        this.scene.add(group);
        return { group, geo, mesh };
      }

      // --- Scatter Instanced Rocks ---
      const ROCKS_PER_CHUNK = 50;
      const rocks = new THREE.InstancedMesh(this.rockGeo, rockM, ROCKS_PER_CHUNK);
      const dummy = new THREE.Object3D();
      let added = 0;

      for (let i = 0; i < ROCKS_PER_CHUNK * 2 && added < ROCKS_PER_CHUNK; i++) {
        const r1 = this._srand(cx, cz, i * 2);
        const r2 = this._srand(cx, cz, i * 2 + 1);
        const lxr = (r1 - 0.5) * this.CHUNK_SIZE;
        const lzr = (r2 - 0.5) * this.CHUNK_SIZE;
        const wx = cxW + lxr;
        const wz = czW + lzr;
        const dist = Math.sqrt(wx * wx + wz * wz);
        if (dist < 280) continue;
        const h = this.getHeight(wx, wz);
        if (h < 4) continue;
        const scl = 0.6 + this._srand(cx, cz, i + 100) * 3.2;
        dummy.position.set(lxr, h - scl * 0.3, lzr);
        dummy.rotation.set(
          this._srand(cx, cz, i + 200) * Math.PI,
          this._srand(cx, cz, i + 300) * Math.PI * 2,
          this._srand(cx, cz, i + 400) * Math.PI
        );
        dummy.scale.set(scl, scl * (0.7 + this._srand(cx, cz, i + 500) * 0.6), scl);
        dummy.updateMatrix();
        rocks.setMatrixAt(added, dummy.matrix);
        added++;
      }
      rocks.count = added;
      rocks.instanceMatrix.needsUpdate = true;
      rocks.castShadow = true;
      rocks.receiveShadow = true;
      group.add(rocks);

      // --- Scatter Flora Clutter ---
      const floraMaterial = lowPoly ? this.floraMatLow : this.floraMat;
      const CAP_PINE = 180, CAP_CACTUS = 100, CAP_SHRUB = 220, CAP_BOULDER = 60;

      const pines    = new THREE.InstancedMesh(this.pineGeo,    floraMaterial, CAP_PINE);
      const cacti    = new THREE.InstancedMesh(this.cactusGeo,  floraMaterial, CAP_CACTUS);
      const shrubs   = new THREE.InstancedMesh(this.shrubGeo,   floraMaterial, CAP_SHRUB);
      const boulders = new THREE.InstancedMesh(this.boulderGeo, floraMaterial, CAP_BOULDER);

      let nPine = 0, nCactus = 0, nShrub = 0, nBoulder = 0;
      const d = new THREE.Object3D();

      const samples = 600;
      for (let i = 0; i < samples; i++) {
        const rx = this._srand(cx, cz, i * 3);
        const rz = this._srand(cx, cz, i * 3 + 1);
        const pick = this._srand(cx, cz, i * 3 + 2);
        const lx = (rx - 0.5) * this.CHUNK_SIZE;
        const lz = (rz - 0.5) * this.CHUNK_SIZE;
        const wx = cxW + lx;
        const wz = czW + lz;

        const r2 = wx * wx + wz * wz;
        if (r2 < 240 * 240) continue;

        const h = this.getHeight(wx, wz);
        if (h < this.WATER_LEVEL + 0.5) continue;

        const hN = this.getHeight(wx + 6, wz);
        const hE = this.getHeight(wx, wz + 6);
        const slope = (Math.abs(hN - h) + Math.abs(hE - h)) * 0.05;
        if (slope > 0.44) continue;

        d.position.set(lx, h, lz);
        d.rotation.set(0, this._srand(cx, cz, i + 800) * Math.PI * 2, 0);

        if (this.currentBiome.hasCactus && pick < 0.35 && nCactus < CAP_CACTUS) {
          const s = 0.72 + this._srand(cx, cz, i + 900) * 0.92;
          d.scale.set(s, s, s);
          d.updateMatrix();
          cacti.setMatrixAt(nCactus++, d.matrix);
        } else if (pick < this.currentBiome.shrubChance && nShrub < CAP_SHRUB) {
          const s = 0.55 + this._srand(cx, cz, i + 1000) * 0.72;
          d.scale.set(s, s, s);
          d.updateMatrix();
          shrubs.setMatrixAt(nShrub++, d.matrix);
        }

        if (pick < this.currentBiome.pineChance && nPine < CAP_PINE) {
          const s = 0.68 + this._srand(cx, cz, i + 1100) * 1.5;
          d.scale.set(s, s * (0.85 + this._srand(cx, cz, i + 1200) * 0.3), s);
          d.updateMatrix();
          pines.setMatrixAt(nPine++, d.matrix);
        } else if (pick < 0.08 && nBoulder < CAP_BOULDER) {
          const s = 0.8 + this._srand(cx, cz, i + 1300) * 3.4;
          d.position.y -= s * 0.28;
          d.rotation.set(
            this._srand(cx, cz, i + 1400) * Math.PI,
            this._srand(cx, cz, i + 1500) * Math.PI * 2,
            this._srand(cx, cz, i + 1600) * Math.PI
          );
          d.scale.set(s, s * (0.6 + this._srand(cx, cz, i + 1700) * 0.5), s);
          d.updateMatrix();
          boulders.setMatrixAt(nBoulder++, d.matrix);
        }
      }

      pines.count = nPine;
      cacti.count = nCactus;
      shrubs.count = nShrub;
      boulders.count = nBoulder;

      pines.instanceMatrix.needsUpdate = true;
      cacti.instanceMatrix.needsUpdate = true;
      shrubs.instanceMatrix.needsUpdate = true;
      boulders.instanceMatrix.needsUpdate = true;
      for (const inst of [pines, cacti, shrubs, boulders]) {
        inst.castShadow = true;
        inst.receiveShadow = true;
      }

      if (nPine > 0) group.add(pines);
      if (nCactus > 0) group.add(cacti);
      if (nShrub > 0) group.add(shrubs);
      if (nBoulder > 0) group.add(boulders);

      this.scene.add(group);

      // Return the instanced scatter so chunk teardown can dispose each one's
      // per-chunk instanceMatrix buffer. Their geometry/material are engine-owned
      // and shared across chunks, so InstancedMesh.dispose() (which frees only the
      // instance buffers, not the shared geo/mat) is the correct teardown.
      return { group, geo, mesh, instanced: [rocks, pines, cacti, shrubs, boulders] };
    },

    // --- Far LOD Chunks ---
    _makeFarChunk(cx, cz) {
      const cxW = (cx + 0.5) * this.FAR_CHUNK_SIZE;
      const czW = (cz + 0.5) * this.FAR_CHUNK_SIZE;

      const group = new THREE.Group();
      group.position.set(cxW, 0, czW);

      const lowPoly = this.styleMode === 'lowpoly';
      const sandM = lowPoly ? this.sandMatLowPoly : this.terrainMat;

      const geo = new THREE.PlaneGeometry(this.FAR_CHUNK_SIZE, this.FAR_CHUNK_SIZE, this.FAR_CHUNK_RES, this.FAR_CHUNK_RES);
      geo.rotateX(-Math.PI / 2);

      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const tmp = new THREE.Color();

      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i);
        const lz = pos.getZ(i);
        const wx = cxW + lx;
        const wz = czW + lz;
        const h = this.getHeight(wx, wz);
        pos.setY(i, h);

        this._strataColor(h, tmp);

        const hN = this.getHeight(wx + 12, wz);
        const hE = this.getHeight(wx, wz + 12);
        const slope = Math.min(1, (Math.abs(hN - h) + Math.abs(hE - h)) * 0.018);
        if (slope > 0.1) {
          tmp.lerp(this.CLIFF_TINT, (slope - 0.1) * 0.65);
        }

        colors[i * 3] = tmp.r;
        colors[i * 3 + 1] = tmp.g;
        colors[i * 3 + 2] = tmp.b;
      }

      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, sandM);
      mesh.position.set(0, 0, 0);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      group.add(mesh);

      this.scene.add(group);
      return { group, geo, mesh };
    },

    // --- Voxel (blocky) chunk builder ---
    // Used when this.VOXEL is set (the flooded planet underlay). Builds flat-top
    // columns quantised to the cell size, with side walls down to lower neighbours
    // so the surface reads as stacked voxels rather than a smooth mesh. Heights are
    // snapped to `step`; anything below the waterline is clamped to a flat seabed.
    // Returns the same { group, geo, mesh } record (and adds to the scene) as the
    // smooth builders so the streamer can track + dispose it identically.
    _makeVoxelChunk(cx, cz, size, res, far) {
      const cxW = (cx + 0.5) * size, czW = (cz + 0.5) * size;
      const group = new THREE.Group();
      group.position.set(cxW, 0, czW);
      // fog:false — the scene's near distanceMistFog (far~100) would wash the
      // 1/25-scaled planet surface cream; the cloud-sea veil (faded to 0 on
      // descent, opaque up top) is what provides the sky<->surface separation,
      // so the voxel ground reads crisp + colourful like voxel-poser.
      if (!this.voxelMat) this.voxelMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
      const cell = size / res, step = cell, half = size / 2;
      const seabed = this.WATER_LEVEL - step;          // flat seabed one block under the waterline
      const N = res + 2;                               // +1-cell border for neighbour wall lookups
      const Hg = new Float32Array(N * N);
      for (let gz = 0; gz < N; gz++) for (let gx = 0; gx < N; gx++) {
        const wx = cxW - half + (gx - 0.5) * cell;
        const wz = czW - half + (gz - 0.5) * cell;
        let h = Math.round(this.getHeight(wx, wz) / step) * step;
        if (h < seabed) h = seabed;
        Hg[gz * N + gx] = h;
      }
      const pos = [], nor = [], col = [], tmp = new THREE.Color();
      const v = (x, y, z, n, r, g, b) => { pos.push(x, y, z); nor.push(n[0], n[1], n[2]); col.push(r, g, b); };
      const quad = (a, b, c, d, n, r, g, b2) => { v(a[0], a[1], a[2], n, r, g, b2); v(b[0], b[1], b[2], n, r, g, b2); v(c[0], c[1], c[2], n, r, g, b2); v(a[0], a[1], a[2], n, r, g, b2); v(c[0], c[1], c[2], n, r, g, b2); v(d[0], d[1], d[2], n, r, g, b2); };
      for (let gz = 1; gz <= res; gz++) for (let gx = 1; gx <= res; gx++) {
        const h = Hg[gz * N + gx];
        const x0 = -half + (gx - 1) * cell, x1 = x0 + cell, z0 = -half + (gz - 1) * cell, z1 = z0 + cell;
        this._strataColor(h, tmp);
        const n1 = this._vnoise((cxW + x0) * 0.045, (czW + z0) * 0.045);
        tmp.multiplyScalar(0.82 + n1 * 0.20);
        const tr = tmp.r, tg = tmp.g, tb = tmp.b;
        quad([x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0], [0, 1, 0], tr, tg, tb);   // flat top
        const sr = tr * 0.72, sg = tg * 0.72, sb = tb * 0.72;                              // shaded sides
        const nE = Hg[gz * N + gx + 1], nW = Hg[gz * N + gx - 1], nS = Hg[(gz + 1) * N + gx], nN = Hg[(gz - 1) * N + gx];
        if (h > nE) quad([x1, nE, z0], [x1, nE, z1], [x1, h, z1], [x1, h, z0], [1, 0, 0], sr, sg, sb);
        if (h > nW) quad([x0, nW, z1], [x0, nW, z0], [x0, h, z0], [x0, h, z1], [-1, 0, 0], sr, sg, sb);
        if (h > nS) quad([x0, nS, z1], [x1, nS, z1], [x1, h, z1], [x0, h, z1], [0, 0, 1], sr, sg, sb);
        if (h > nN) quad([x1, nN, z0], [x0, nN, z0], [x0, h, z0], [x1, h, z0], [0, 0, -1], sr, sg, sb);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const mesh = new THREE.Mesh(geo, this.voxelMat);
      mesh.castShadow = false;
      mesh.receiveShadow = !far;
      group.add(mesh);
      this.scene.add(group);
      return { group, geo, mesh };
    },

    // --- Chunk Queue Routing ---
    _queueChunkBuild(list, set, map, cx, cz, priority) {
      const key = `${cx},${cz}`;
      if (set.has(key) || map.has(key)) return;
      set.add(key);
      list.push({ key, cx, cz, priority });
    },

    _trimPendingChunkBuilds(list, set, wanted) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (wanted.has(list[i].key)) continue;
        set.delete(list[i].key);
        list.splice(i, 1);
      }
    },

    _processChunkBuildQueues(nearBudget = 1, farBudget = 1) {
      if (this.pendingChunkBuilds.length > 1) {
        this.pendingChunkBuilds.sort((a, b) => a.priority - b.priority);
      }
      while (nearBudget-- > 0 && this.pendingChunkBuilds.length) {
        const job = this.pendingChunkBuilds.shift();
        this.pendingChunkKeys.delete(job.key);
        if (!this.chunks.has(job.key)) {
          this.chunks.set(job.key, this.VOXEL
            ? this._makeVoxelChunk(job.cx, job.cz, this.CHUNK_SIZE, this.VOXEL_RES, false)
            : this._makeChunk(job.cx, job.cz));
        }
      }

      if (this.pendingFarChunkBuilds.length > 1) {
        this.pendingFarChunkBuilds.sort((a, b) => a.priority - b.priority);
      }
      while (farBudget-- > 0 && this.pendingFarChunkBuilds.length) {
        const job = this.pendingFarChunkBuilds.shift();
        this.pendingFarChunkKeys.delete(job.key);
        if (!this.farChunks.has(job.key)) {
          this.farChunks.set(job.key, this.VOXEL
            ? this._makeVoxelChunk(job.cx, job.cz, this.FAR_CHUNK_SIZE, this.FAR_VOXEL_RES, true)
            : this._makeFarChunk(job.cx, job.cz));
        }
      }
    },
  });
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
