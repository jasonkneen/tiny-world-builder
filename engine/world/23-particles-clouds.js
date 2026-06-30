  // -------- chimney smoke --------
  const MAX_SMOKE_PARTICLES = 70;
  const MAX_DUST_PARTICLES = 40;
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0xd4cfc2, transparent: true, opacity: 0.65, depthWrite: false });
  const smokeGeo = new THREE.SphereGeometry(0.06, 6, 6);
  const smokeParticles = [];
  const dustParticles = [];
  const MAX_UNDERSIDE_DEBRIS_PARTICLES = 96;
  const undersideDebrisMat = new THREE.MeshBasicMaterial({ color: 0x8b8173, transparent: true, opacity: 0.64, depthWrite: false });
  const undersideDebrisGeo = getBoxGeometry(1, 1, 1);
  const undersideDebrisParticles = [];
  let undersideDebrisTimer = 0;

  function spawnSmoke(houseObj) {
    if (smokeParticles.length >= MAX_SMOKE_PARTICLES) return;
    const tops = houseObj.userData.chimneyTops
      || (houseObj.userData.chimneyTop ? [houseObj.userData.chimneyTop] : []);
    for (const top of tops) {
      if (smokeParticles.length >= MAX_SMOKE_PARTICLES) break;
      const initialOpacity = 0.65;
      const s = new THREE.Mesh(smokeGeo, getCachedParticleMaterial(smokeMat, initialOpacity));
      s.frustumCulled = true;
      s.castShadow = false;
      s.receiveShadow = false;
      s.position.set(
        houseObj.position.x + top.x + (Math.random() - 0.5) * 0.02,
        houseObj.position.y + top.y,
        houseObj.position.z + top.z + (Math.random() - 0.5) * 0.02
      );
      s.userData = {
        life: 0,
        maxLife: 2.4 + Math.random() * 0.6,
        vy: 0.45 + Math.random() * 0.2,
        vx: (Math.random() - 0.5) * 0.15,
        vz: (Math.random() - 0.5) * 0.15,
      };
      setCachedParticleMaterial(s, smokeMat, initialOpacity);
      xrWorldRoot.add(s);
      smokeParticles.push(s);
    }
  }

  function updateSmoke(dt) {
    for (let i = smokeParticles.length - 1; i >= 0; i--) {
      const s = smokeParticles[i];
      s.userData.life += dt;
      const t = s.userData.life / s.userData.maxLife;
      s.position.y += s.userData.vy * dt;
      s.position.x += s.userData.vx * dt;
      s.position.z += s.userData.vz * dt;
      const maxOp = s.userData.maxOpacity !== undefined ? s.userData.maxOpacity : 0.65;
      const op = maxOp * (1 - t);
      setCachedParticleMaterial(s, smokeMat, op, s.userData.colorHex);
      const sc = 1 + t * 1.4;
      s.scale.set(sc, sc, sc);
      if (t >= 1) {
        if (s.parent) s.parent.remove(s);
        smokeParticles.splice(i, 1);
      }
    }
  }

  function islandUndersideDebrisOrigin(targetX, targetZ, spread = 0.18) {
    const span = GRID * TILE;
    const half = span * 0.5;
    let x = Number.isFinite(targetX) ? targetX : 0;
    let z = Number.isFinite(targetZ) ? targetZ : 0;
    if (!Number.isFinite(targetX) || !Number.isFinite(targetZ)) {
      const side = Math.floor(Math.random() * 4);
      const across = (Math.random() - 0.5) * span * 0.86;
      const edge = half * (0.80 + Math.random() * 0.16);
      if (side === 0) { x = across; z = -edge; }
      else if (side === 1) { x = across; z = edge; }
      else if (side === 2) { x = -edge; z = across; }
      else { x = edge; z = across; }
      if (Math.random() >= 0.58) {
        x = (Math.random() - 0.5) * span * 0.72;
        z = (Math.random() - 0.5) * span * 0.72;
      }
    } else {
      const limit = half * 0.92;
      x = Math.max(-limit, Math.min(limit, x + (Math.random() - 0.5) * spread));
      z = Math.max(-limit, Math.min(limit, z + (Math.random() - 0.5) * spread));
    }
    const radial = half > 0 ? Math.min(1, Math.max(Math.abs(x), Math.abs(z)) / half) : 1;
    const centerDrop = Math.max(1.55, Math.min(5.4, GRID * 0.18));
    const undersideDrop = 0.24 + Math.pow(1 - radial, 0.82) * centerDrop + Math.random() * 0.32;
    return { x, y: -DIRT_H - undersideDrop, z };
  }

  function spawnUndersideDebris(count = 1, opts = {}) {
    if (!homeBorderGroup || !homeBorderGroup.children.length) return;
    const colors = [0x4f4c48, 0x665f55, 0x837866, 0xa08f78];
    const direct = Number.isFinite(opts.x) && Number.isFinite(opts.z);
    const spread = opts.spread === undefined ? (direct ? 0.46 : 0.18) : opts.spread;
    const chunkChance = opts.chunkChance === undefined ? 0.18 : opts.chunkChance;
    const speedBoost = opts.speedBoost === undefined ? 1 : opts.speedBoost;
    for (let i = 0; i < count; i++) {
      if (undersideDebrisParticles.length >= MAX_UNDERSIDE_DEBRIS_PARTICLES) break;
      const origin = islandUndersideDebrisOrigin(opts.x, opts.z, spread);
      const colorHex = colors[Math.floor(Math.random() * colors.length)];
      const initialOpacity = 0.50 + Math.random() * 0.28;
      const p = new THREE.Mesh(undersideDebrisGeo, getCachedParticleMaterial(undersideDebrisMat, initialOpacity, colorHex));
      const chunk = Math.random() < chunkChance;
      const size = chunk
        ? 0.055 + Math.random() * 0.050
        : 0.026 + Math.random() * 0.052;
      p.frustumCulled = true;
      p.renderOrder = UNDER_ISLAND_EFFECT_RENDER_ORDER;
      p.castShadow = false;
      p.receiveShadow = false;
      p.position.set(
        origin.x + (Math.random() - 0.5) * 0.18,
        origin.y,
        origin.z + (Math.random() - 0.5) * 0.18
      );
      p.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      p.scale.set(size * (0.68 + Math.random() * 0.58), size * (0.58 + Math.random() * 0.48), size * (0.68 + Math.random() * 0.58));
      p.userData = {
        life: 0,
        maxLife: (direct ? 1.28 : 1.70) + Math.random() * (direct ? 1.02 : 1.45),
        maxOpacity: initialOpacity,
        baseScaleX: p.scale.x,
        baseScaleY: p.scale.y,
        baseScaleZ: p.scale.z,
        vx: (Math.random() - 0.5) * (direct ? 0.16 : 0.075),
        vy: (-0.34 - Math.random() * 0.54) * speedBoost,
        vz: (Math.random() - 0.5) * (direct ? 0.16 : 0.075),
        spinX: (Math.random() - 0.5) * 2.0,
        spinY: (Math.random() - 0.5) * 2.4,
        spinZ: (Math.random() - 0.5) * 1.8,
        colorHex,
      };
      setCachedParticleMaterial(p, undersideDebrisMat, initialOpacity, colorHex);
      xrWorldRoot.add(p);
      undersideDebrisParticles.push(p);
    }
  }

  function triggerUndersideDebrisBurstAt(x, z, mass = 1) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const count = Math.max(5, Math.min(22, Math.round(5 + mass * 1.65)));
    spawnUndersideDebris(count, {
      x,
      z,
      spread: 0.34 + Math.min(0.62, mass * 0.035),
      chunkChance: Math.min(0.42, 0.16 + mass * 0.025),
      speedBoost: Math.min(1.65, 1.05 + mass * 0.045),
    });
  }

  function tickUndersideDebris(dt) {
    undersideDebrisTimer += dt;
    if (undersideDebrisTimer > 0.16) {
      undersideDebrisTimer = 0;
      if (Math.random() < 0.78) {
        const burst = Math.random() < 0.10 ? 4 : (Math.random() < 0.32 ? 3 : 2);
        spawnUndersideDebris(burst);
      }
    }
    for (let i = undersideDebrisParticles.length - 1; i >= 0; i--) {
      const p = undersideDebrisParticles[i];
      p.userData.life += dt;
      const u = p.userData.life / p.userData.maxLife;
      p.userData.vy -= 0.12 * dt;
      p.position.x += p.userData.vx * dt;
      p.position.y += p.userData.vy * dt;
      p.position.z += p.userData.vz * dt;
      p.rotation.x += p.userData.spinX * dt;
      p.rotation.y += p.userData.spinY * dt;
      p.rotation.z += p.userData.spinZ * dt;
      const fade = Math.max(0, 1 - u);
      const opacity = p.userData.maxOpacity * fade * fade;
      setCachedParticleMaterial(p, undersideDebrisMat, opacity, p.userData.colorHex);
      const s = Math.max(0.08, 1 - u * 0.62);
      p.scale.set(p.userData.baseScaleX * s, p.userData.baseScaleY * s, p.userData.baseScaleZ * s);
      if (u >= 1) {
        if (p.parent) p.parent.remove(p);
        undersideDebrisParticles.splice(i, 1);
      }
    }
  }

  // -------- squash-on-place dust + fade --------
  // When the user drops a rock or fence onto a tile that already has an
  // object on it, we don't silently swap meshes. Instead we:
  //  1. Detach the existing object mesh from cellMeshes (so setCell won't
  //     dispose it) and leave it parented to worldGroup.
  //  2. Snap it flat (scale.y → ~0), oversize XZ by 10%, and rotate
  //     5–10° (1° increments, random sign) on the y axis.
  //  3. Burst a quick dust ring out of the impact point.
  //  4. Fade the squashed remnant out over 2 s and dispose it.
  // The new rock/fence drops in on top during step 1/2 via setCell's
  // existing drop-in animation.
  const squashAnims = [];
  function spawnDustBurst(x, y, z, count = 14) {
    const colorHex = 0xcab38a;
    for (let i = 0; i < count; i++) {
      if (dustParticles.length >= MAX_DUST_PARTICLES) break;
      const initialOpacity = 0.95;
      const d = new THREE.Mesh(smokeGeo, getCachedParticleMaterial(smokeMat, initialOpacity, colorHex));
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const r = 0.05 + Math.random() * 0.08;
      d.position.set(x + Math.cos(a) * r, y + 0.04 + Math.random() * 0.03, z + Math.sin(a) * r);
      d.userData = {
        life: 0,
        maxLife: 0.55 + Math.random() * 0.25,
        maxOpacity: 0.85,
        vy: 0.35 + Math.random() * 0.35,
        vx: Math.cos(a) * (0.85 + Math.random() * 0.5),
        vz: Math.sin(a) * (0.85 + Math.random() * 0.5),
        colorHex: colorHex
      };
      setCachedParticleMaterial(d, smokeMat, initialOpacity, colorHex);
      xrWorldRoot.add(d);
      dustParticles.push(d);
    }
  }

  function updateDust(dt) {
    for (let i = dustParticles.length - 1; i >= 0; i--) {
      const d = dustParticles[i];
      d.userData.life += dt;
      const t = d.userData.life / d.userData.maxLife;
      d.position.y += d.userData.vy * dt;
      d.position.x += d.userData.vx * dt;
      d.position.z += d.userData.vz * dt;
      const maxOp = d.userData.maxOpacity !== undefined ? d.userData.maxOpacity : 0.85;
      const op = maxOp * (1 - t);
      setCachedParticleMaterial(d, smokeMat, op, d.userData.colorHex);
      const sc = 1 + t * 0.8;
      d.scale.set(sc, sc, sc);
      if (t >= 1) {
        if (d.parent) d.parent.remove(d);
        dustParticles.splice(i, 1);
      }
    }
  }

  function squashExistingObject(x, z) {
    // For house clusters the visible mesh sits on the cluster anchor,
    // not the clicked cell. Find the anchor so we squash the right
    // mesh; for everything else the clicked cell IS the mesh cell.
    let meshKey = x + ',' + z;
    const cell = world[x] && world[x][z];
    if (cell && cell.kind === 'house' && typeof findHouseCluster === 'function') {
      const cluster = findHouseCluster(x, z);
      if (cluster) meshKey = cluster.anchorX + ',' + cluster.anchorZ;
    }
    const entry = cellMeshes[meshKey];
    if (!entry || !entry.object) return;
    const old = entry.object;

    // Detach from cellMeshes — we own the mesh from here on; setCell's
    // renderCellObject won't try to dispose it.
    entry.object = null;

    // Remove from the opacity tick system so its baseOpacity *
    // displayOpacity doesn't reset our fade to 1 every frame.
    opacityRoots.delete(old);
    // Wipe baseOpacity + baseMat on every child so any stray opacity pass
    // leaves the material alone (applyElementOpacity skips when baseMat is
    // missing, and dispose code keys off _squashCloned now).
    old.traverse(o => {
      if (!o.isMesh) return;
      o.userData.baseOpacity = undefined;
      o.userData.baseMat = undefined;
    });
    // Make sure the mesh isn't still tweening downward from a drop-in.
    old.userData.landing = false;

    // Random 5–10° in 1° increments, with random sign.
    const deg = (5 + Math.floor(Math.random() * 6)) * (Math.random() < 0.5 ? -1 : 1);
    old.rotation.y += (deg * Math.PI) / 180;

    // Capture base scale, then squash flat with a 10% XZ oversize. A
    // tiny but visible Y so the pancake reads as a flattened remnant
    // (0.08 of original) — totally flat looks like a missing object.
    const baseSx = old.scale.x, baseSy = old.scale.y, baseSz = old.scale.z;
    old.scale.set(baseSx * 1.1, Math.max(0.04, baseSy * 0.08), baseSz * 1.1);
    // Nudge up slightly so the squashed pancake doesn't z-fight the tile top.
    old.position.y = (old.userData.baseY || old.position.y) + 0.005;

    // Make every material in the squashed mesh transparent + clone it so
    // we can fade without affecting other instances of the same shared
    // material. Record the base opacity so the fade preserves stylistic
    // partial-opacity materials (water foam, etc.).
    old.traverse(o => {
      if (!o.isMesh || !o.material) return;
      if (o.userData._squashCloned) return;
      if (Array.isArray(o.material)) {
        o.material = o.material.map(m => {
          const clone = m.clone();
          if (m.onBeforeCompile) clone.onBeforeCompile = m.onBeforeCompile;
          if (typeof m.customProgramCacheKey === 'function') clone.customProgramCacheKey = m.customProgramCacheKey;
          return clone;
        });
      } else {
        const parentMat = o.material;
        o.material = o.material.clone();
        if (parentMat.onBeforeCompile) o.material.onBeforeCompile = parentMat.onBeforeCompile;
        if (typeof parentMat.customProgramCacheKey === 'function') o.material.customProgramCacheKey = parentMat.customProgramCacheKey;
      }
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => {
        m.transparent = true;
        m.depthWrite = false;
      });
      o.userData._squashCloned = true;
      o.userData._squashBaseOp = mats[0].opacity === undefined ? 1 : mats[0].opacity;
    });

    spawnDustBurst(old.position.x, old.position.y, old.position.z);

    squashAnims.push({ mesh: old, t: 0, dur: 2.0 });
  }

  function tickSquashAnims(dt) {
    if (!squashAnims.length) return;
    for (let i = squashAnims.length - 1; i >= 0; i--) {
      const a = squashAnims[i];
      a.t += dt;
      const u = Math.min(1, a.t / a.dur);
      const fade = 1 - u;
      a.mesh.traverse(o => {
        if (!o.isMesh || !o.material) return;
        const base = o.userData._squashBaseOp === undefined ? 1 : o.userData._squashBaseOp;
        if (Array.isArray(o.material)) o.material.forEach(m => { m.opacity = base * fade; });
        else o.material.opacity = base * fade;
      });
      if (u >= 1) {
        worldGroup.remove(a.mesh);
        a.mesh.traverse(o => {
          safeDisposeGeometry(o.geometry);
          // Materials here are the private per-squash clones (see line ~6510),
          // so they are safe to dispose — but only if they're not the shared
          // fade-cache bucket. _squashCloned proves we cloned them ourselves.
          if (o.material && o.userData._squashCloned) {
            if (Array.isArray(o.material)) o.material.forEach(m => m.dispose && m.dispose());
            else if (o.material.dispose) o.material.dispose();
          }
        });
        squashAnims.splice(i, 1);
      }
    }
  }

  // -------- voxel clouds --------
  // Chunky clouds that drift slowly across the sky in world space, so they
  // sit naturally over both the home grid and ghost boards. Count and speed
  // come from the existing Clouds / Cloud-speed sliders in render settings.
  //
  // These are declared with var so they hoist to script-top as undefined,
  // letting applyCloudSettings() safely no-op when it's called before this
  // block runs (early-init order: applyCloudSettings runs at ~line 1545,
  // this block runs much later). syncCloudPopulation guards on `clouds`.
  var cloudGroup = new THREE.Group();
  cloudGroup.name = 'clouds';
  xrWorldRoot.add(cloudGroup);
  var clouds = [];
  var CLOUD_MAX = 14;
  var CLOUD_RANGE_X = 24; // wrap-around x extent (centred on 0)
  var CLOUD_Z_RANGE = 18;
  var SKY_CLOUD_MIN_HEIGHT = 9.5;
  var CLOUD_OCCLUSION_RENDER_ORDER = 18;

  function skyCloudHeight() {
    return Math.max(SKY_CLOUD_MIN_HEIGHT, renderCloudHeight || 0);
  }

  function keepSkyCloudOffBuildPlane(cloud) {
    if (!cloud) return;
    // In the editor's overhead/isometric cameras, clouds directly above the
    // active build area read like white textures mapped onto roofs. Keep sky
    // clouds in a soft perimeter around the camera target; under-island clouds
    // still provide the low mist layer below the board.
    const boardSpan = GRID * TILE;
    const noFlyX = Math.min(CLOUD_RANGE_X * 0.96, Math.max(14, boardSpan * 1.25 + 6, viewSize * 1.32));
    const noFlyZ = Math.min(CLOUD_Z_RANGE * 0.96, Math.max(12, boardSpan * 1.25 + 5, viewSize * 1.24));
    const dx = cloud.position.x - target.x;
    const dz = cloud.position.z - target.z;
    if (Math.abs(dx) < noFlyX && Math.abs(dz) < noFlyZ) {
      const pushX = noFlyX - Math.abs(dx);
      const pushZ = noFlyZ - Math.abs(dz);
      if (pushX < pushZ) {
        const sign = dx < 0 ? -1 : 1;
        cloud.position.x = target.x + sign * (noFlyX + Math.random() * 2.5);
      } else {
        const sign = dz < 0 ? -1 : 1;
        cloud.position.z = target.z + sign * (noFlyZ + Math.random() * 2.0);
      }
      return;
    }

    // The isometric camera can project a foreground cloud over a roof even
    // when its X/Z footprint is outside the board. Guard the same central
    // area in camera-facing space so buildings do not get veiled by sky puffs.
    const cam = (typeof camera !== 'undefined' && camera) ? camera : null;
    const camDx = cam ? cam.position.x - target.x : 0;
    const camDz = cam ? cam.position.z - target.z : 0;
    const camLen = Math.hypot(camDx, camDz);
    if (camLen > 0.001) {
      const frontX = camDx / camLen;
      const frontZ = camDz / camLen;
      const sideX = frontZ;
      const sideZ = -frontX;
      const side = dx * sideX + dz * sideZ;
      const front = dx * frontX + dz * frontZ;
      const noFlySide = Math.min(CLOUD_RANGE_X * 0.96, Math.max(14, boardSpan * 1.45 + 6, viewSize * 1.34));
      const noFlyFront = Math.min(CLOUD_Z_RANGE * 0.98, Math.max(12, boardSpan * 1.35 + 5, viewSize * 1.28));
      if (Math.abs(side) < noFlySide && Math.abs(front) < noFlyFront) {
        const pushSide = noFlySide - Math.abs(side);
        const pushFront = noFlyFront - Math.abs(front);
        const useSide = pushSide < pushFront;
        const sign = (useSide ? side : front) < 0 ? -1 : 1;
        const wanted = (useSide ? noFlySide : noFlyFront) + Math.random() * (useSide ? 2.5 : 2.0);
        const delta = sign * wanted - (useSide ? side : front);
        cloud.position.x += (useSide ? sideX : frontX) * delta;
        cloud.position.z += (useSide ? sideZ : frontZ) * delta;
      }
    }
  }

  // Build a per-puff cloned material so each piece of the cloud can sit
  // at its own opacity — gives the cloud a wispy, uneven feel instead of
  // a single solid silhouette. Tagged so syncCloudPopulation can dispose
  // them when the cloud is recycled.
  function cloneCloudMat(baseMat, opacity) {
    const m = baseMat.clone();
    m.transparent = true;
    m.opacity = opacity;
    if (m.emissive) {
      m.emissive.setHex(0xff9a64);
      m.emissiveIntensity = 0;
    }
    m.depthTest = true;
    m.depthWrite = false;
    // Keep visual cloud opacity independent from the shadow slider. Shadow
    // breakup is handled by per-mesh customDepthMaterial below; using
    // material.alphaTest here would also discard visible cloud puffs when
    // Cloud shadow is low.
    m.alphaTest = 0;
    m.userData = m.userData || {};
    m.userData.cloudInstance = true;
    m.userData.cloudOpacity = opacity;
    m.userData.cloudBright = baseMat === M.cloud;
    return m;
  }

  function cloudShadowAlphaTest() {
    // Higher renderCloudShadow → lower threshold → more puffs contribute to
    // the depth pass. At 0%, almost all puffs fail shadow casting, while
    // their regular materials still render visibly.
    return Math.max(0, Math.min(0.99, 1 - renderCloudShadow));
  }

  function configureCloudShadowMesh(mesh) {
    const mat = mesh.material;
    const opacity = mat && mat.userData && mat.userData.cloudOpacity !== undefined
      ? mat.userData.cloudOpacity
      : (mat && mat.opacity !== undefined ? mat.opacity : 1);
    const depthMat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      alphaTest: cloudShadowAlphaTest(),
      opacity,
    });
    depthMat.userData = depthMat.userData || {};
    depthMat.userData.cloudShadowDepth = true;
    mesh.customDepthMaterial = depthMat;
    mesh.castShadow = renderCloudShadow > 0.001;
  }

  function disposeCloudRoot(root) {
    if (!root) return;
    root.traverse(o => {
      safeDisposeGeometry(o.geometry);
      if (o.customDepthMaterial && o.customDepthMaterial.userData && o.customDepthMaterial.userData.cloudShadowDepth) {
        o.customDepthMaterial.dispose();
      }
      if (o.material && o.material.userData && o.material.userData.cloudInstance) {
        o.material.dispose();
      }
    });
  }

  function applyCloudShadowSetting() {
    if (!clouds) return;
    const at = cloudShadowAlphaTest();
    for (const c of clouds) {
      c.traverse(o => {
        if (o.customDepthMaterial && o.customDepthMaterial.userData && o.customDepthMaterial.userData.cloudShadowDepth) {
          o.customDepthMaterial.alphaTest = at;
          o.customDepthMaterial.needsUpdate = true;
        }
        if (o.isMesh) o.castShadow = renderCloudShadow > 0.001;
      });
    }
  }

  function makeCloud() {
    const g = new THREE.Group();
    // Dense faceted puff clusters: chunky enough to read like low-poly
    // clouds at distance without becoming flat wisps.
    const count = 14 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const core = i < 5;
      const r = core ? (0.42 + Math.random() * 0.34) : (0.22 + Math.random() * 0.36);
      const bright = core || Math.random() < 0.66;
      const opacity = bright ? (0.82 + Math.random() * 0.16) : (0.56 + Math.random() * 0.20);
      const mat = cloneCloudMat(bright ? M.cloud : M.cloudShade, opacity);
      const mesh = new THREE.Mesh(getDodecahedronGeometry(r), mat);
      mesh.renderOrder = CLOUD_OCCLUSION_RENDER_ORDER;
      mesh.position.set(
        (Math.random() - 0.5) * (core ? 1.4 : 3.5),
        core ? (0.18 + Math.random() * 0.48) : Math.random() * 0.95,
        (Math.random() - 0.5) * (core ? 1.0 : 2.3)
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      g.add(mesh);
    }
    // Clouds cast shadows on the world below but don't catch shadows
    // themselves (sky shouldn't show shadows from anything else). Shadow
    // alpha is driven by a custom depth material so lowering Cloud shadow
    // never makes the visible cloud puffs disappear.
    g.traverse(o => {
      if (o.isMesh) {
        configureCloudShadowMesh(o);
        o.receiveShadow = false;
      }
    });
    return g;
  }

  function makeUnderIslandCloud(seedBase) {
    const g = new THREE.Group();
    const puffCount = 8 + Math.floor(cellRand(seedBase, GRID, 610) * 5);
    const brightSpecs = [];
    const shadeSpecs = [];
    for (let i = 0; i < puffCount; i++) {
      const bright = cellRand(seedBase + i, GRID, 620) < 0.62;
      const spec = {
        x: (cellRand(seedBase + i, GRID, 630) - 0.5) * 3.2,
        y: cellRand(seedBase - i, GRID, 640) * 0.72,
        z: (cellRand(seedBase + i * 3, GRID, 650) - 0.5) * 2.0,
        r: 0.22 + cellRand(seedBase - i * 5, GRID, 660) * 0.34,
      };
      (bright ? brightSpecs : shadeSpecs).push(spec);
    }

    function addInstancedPuffs(specs, baseMat, opacity) {
      if (!specs.length) return;
      const mat = cloneCloudMat(baseMat, opacity);
      const mesh = new THREE.InstancedMesh(getDodecahedronGeometry(1), mat, specs.length);
      mesh.renderOrder = CLOUD_OCCLUSION_RENDER_ORDER;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;
      const dummy = makeUnderIslandCloud._dummy || (makeUnderIslandCloud._dummy = new THREE.Object3D());
      for (let i = 0; i < specs.length; i++) {
        const s = specs[i];
        dummy.position.set(s.x, s.y, s.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(s.r);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      g.add(mesh);
    }

    addInstancedPuffs(brightSpecs, M.cloud, 0.72);
    addInstancedPuffs(shadeSpecs, M.cloudShade, 0.48);
    return g;
  }

  // Vertical jitter applied on top of the height slider so a band of
  // clouds at the same setting doesn't all sit at the exact same y.
  var CLOUD_Y_JITTER = 1.5;
  // Permanent flatten on the Y axis — clouds read more "stretched"
  // and sky-like than puffy at half height.
  var CLOUD_FLATTEN = 0.62;

  function spawnCloud(initial) {
    const c = makeCloud();
    const scale = 0.7 + Math.random() * 0.8;
    c.scale.set(scale, scale * CLOUD_FLATTEN, scale);
    // Anchor the cloud field on the current camera target so clouds are
    // generated wherever the user is panning, not just over the home
    // board. `initial` clouds scatter across the full range; respawned
    // clouds enter from the west edge of the field.
    const cx = target.x;
    const cz = target.z;
    c.position.set(
      cx + (initial ? (Math.random() - 0.5) * CLOUD_RANGE_X * 2
                    : -CLOUD_RANGE_X - Math.random() * 4),
      skyCloudHeight() + (Math.random() - 0.5) * CLOUD_Y_JITTER,
      cz + (Math.random() - 0.5) * CLOUD_Z_RANGE
    );
    keepSkyCloudOffBuildPlane(c);
    c.userData.driftSpeed = 0.35 + Math.random() * 0.45; // base m/s, then multiplied by renderCloudSpeed
    c.userData.yOffset = (Math.random() - 0.5) * CLOUD_Y_JITTER;
    cloudGroup.add(c);
    clouds.push(c);
    return c;
  }

  function applyCloudHeight() {
    if (!clouds) return;
    for (const c of clouds) {
      const off = c.userData.yOffset || 0;
      c.position.y = skyCloudHeight() + off;
    }
  }

  function syncCloudPopulation() {
    // Bail when called before the cloud block has run — `clouds` is
    // hoisted as `undefined` until then.
    if (!clouds) return;
    const target = Math.round(Math.max(0, Math.min(1, renderCloudAmount)) * CLOUD_MAX);
    while (clouds.length > target) {
      const c = clouds.pop();
      cloudGroup.remove(c);
      disposeCloudRoot(c);
    }
    while (clouds.length < target) {
      spawnCloud(true);
    }
    if (typeof applyCloudRimLightSetting === 'function') applyCloudRimLightSetting();
  }

  var underIslandCloudGroup = new THREE.Group();
  underIslandCloudGroup.name = 'under-island-clouds';
  underIslandCloudGroup.renderOrder = UNDER_ISLAND_EFFECT_RENDER_ORDER;
  xrWorldRoot.add(underIslandCloudGroup);
  var underIslandClouds = [];

  function buildUnderIslandClouds() {
    if (!underIslandCloudGroup || typeof makeCloud !== 'function') return;
    while (underIslandClouds.length) {
      const c = underIslandClouds.pop();
      underIslandCloudGroup.remove(c);
      disposeCloudRoot(c);
    }
    const span = GRID * TILE;
    const spread = Math.max(0.7, Math.min(2.2, renderUnderCloudSpread || 1));
    const count = Math.max(6, Math.min(14, Math.round((GRID * 0.20 + 4) * Math.min(1.35, spread))));
    const depthFromCloudHeight = renderCloudHeight * UNDERCLOUD_HEIGHT_MULTIPLIER;
    const gridDepth = Math.min(7.4, GRID * 0.18);
    const cloudY = -DIRT_H - Math.max(3.2, gridDepth, depthFromCloudHeight);
    const ring = span * 0.58 * spread;
    for (let i = 0; i < count; i++) {
      const c = makeUnderIslandCloud(i + 37);
      const angle = (i / count) * Math.PI * 2 + cellRand(i, GRID, 910) * 0.62;
      const radius = ring * (0.52 + cellRand(i, GRID, 920) * 0.36);
      const scale = 0.55 + cellRand(i, GRID, 930) * 0.55;
      c.scale.set(scale * 1.36, scale * 0.58, scale * 0.96);
      c.position.set(
        Math.cos(angle) * radius,
        cloudY + (cellRand(i, GRID, 940) - 0.5) * 0.78,
        Math.sin(angle) * radius
      );
      c.rotation.y = angle + Math.PI * 0.5;
      c.userData.orbitAngle = angle;
      c.userData.orbitRadius = radius;
      c.userData.orbitSpeed = 0.012 + cellRand(i, GRID, 950) * 0.020;
      c.userData.baseY = c.position.y;
      c.traverse(o => {
        if (!o.isMesh) return;
        o.renderOrder = CLOUD_OCCLUSION_RENDER_ORDER;
        o.castShadow = false;
        o.receiveShadow = false;
        if (o.customDepthMaterial && o.customDepthMaterial.userData && o.customDepthMaterial.userData.cloudShadowDepth) {
          o.customDepthMaterial.dispose();
          o.customDepthMaterial = null;
        }
      });
      underIslandCloudGroup.add(c);
      underIslandClouds.push(c);
    }
    if (typeof applyCloudRimLightSetting === 'function') applyCloudRimLightSetting();
  }

  function updateUnderIslandClouds(dt) {
    if (!underIslandClouds || !underIslandClouds.length) return;
    const drift = 0.35 + renderCloudSpeed * 1.2;
    for (const c of underIslandClouds) {
      c.userData.orbitAngle += c.userData.orbitSpeed * drift * dt;
      c.position.x = Math.cos(c.userData.orbitAngle) * c.userData.orbitRadius;
      c.position.z = Math.sin(c.userData.orbitAngle) * c.userData.orbitRadius;
      c.position.y = c.userData.baseY + Math.sin(c.userData.orbitAngle * 1.7) * 0.10;
      c.rotation.y += dt * 0.04;
    }
  }

  // Initial under-island clouds are built by the deferred home-border task.

  // ---------- weather particles (rain + snow) ----------
  // Rain and snow mirror Open World Builder's chunky weather system:
  // instanced box particles fall through the scene, then emit flat instanced
  // splash/puff slabs on impact. This keeps precipitation in-world instead of
  // as a screen-space point overlay and costs one draw call per weather layer.
  const WEATHER_FLOOR = TOP_H + 0.05;
  const WEATHER_VOLUME = Math.max(Math.min(HOME_GRID_MAX, 96) * 0.75, 18);
  const WEATHER_CEIL = Math.max(renderCloudHeight + 6, 14);
  const WEATHER_INTENSITY_LS = 'tinyworld:weather-intensity.v2';
  const WEATHER_SPLASHES_LS = 'tinyworld:weather-splashes.v1';
  let weatherMode = 'clear';
  let weatherIntensity = storedNumber(WEATHER_INTENSITY_LS, 0.25, 0.25, 3);
  let weatherSplashIntensity = storedNumber(WEATHER_SPLASHES_LS, 1.5, 0, 3);
  function weatherHeavyFactor() {
    return Math.max(0, Math.min(3.6, (weatherIntensity - 0.25) / 0.75));
  }
  function weatherEffectFactor() {
    const heavy = weatherHeavyFactor();
    return weatherMode === 'storm' ? Math.max(1.8, heavy) : heavy;
  }
  function weatherScaledCount(light, heavy) {
    const k = weatherEffectFactor();
    return Math.round(light + (heavy - light) * k);
  }

  function makePrecip({ count, geometry, material, dropSpeed, drift, randomRot }) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const rotations = randomRot ? new Float32Array(count * 3) : null;
    for (let i = 0; i < count; i++) {
      respawnPrecipAt(mesh, i, true, positions);
      const ix = i * 3;
      velocities[ix] = (Math.random() - 0.5) * drift;
      velocities[ix + 1] = -dropSpeed * (0.7 + Math.random() * 0.6);
      velocities[ix + 2] = (Math.random() - 0.5) * drift;
      if (rotations) {
        rotations[ix] = Math.random() * Math.PI;
        rotations[ix + 1] = Math.random() * Math.PI;
        rotations[ix + 2] = Math.random() * Math.PI;
      }
    }
    mesh.userData = {
      positions, velocities, rotations, maxCount: count,
      _m: new THREE.Matrix4(),
      _q: new THREE.Quaternion(),
      _e: new THREE.Euler(),
      _p: new THREE.Vector3(),
      _s: new THREE.Vector3(1, 1, 1),
    };
    mesh.count = 0;
    mesh.visible = false;
    return mesh;
  }

  function respawnPrecipAt(mesh, i, spreadY, positionsOverride) {
    const pos = positionsOverride || (mesh && mesh.userData && mesh.userData.positions);
    if (!pos) return;
    const ix = i * 3;
    pos[ix] = target.x + (Math.random() - 0.5) * WEATHER_VOLUME * 2;
    pos[ix + 1] = spreadY ? WEATHER_FLOOR + Math.random() * (WEATHER_CEIL - WEATHER_FLOOR) : WEATHER_CEIL;
    pos[ix + 2] = target.z + (Math.random() - 0.5) * WEATHER_VOLUME * 2;
  }

  function setPrecipActive(mesh, n) {
    if (!mesh) return;
    mesh.count = Math.max(0, Math.min(n, mesh.userData.maxCount));
    mesh.visible = mesh.count > 0;
  }

  let rainGeo = null;
  let rainMat = null;
  let rainMesh = null;
  let snowGeo = null;
  let snowMat = null;
  let snowMesh = null;
  let rainSplash = null;
  let rainSurface = null;
  let snowSurface = null;

  function makeSplashPool(count, { color, size, life, opacity }) {
    const geo = new THREE.RingGeometry(size * 0.28, size * 0.62, 18);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = count;
    mesh.visible = false;
    const lives = new Float32Array(count).fill(-1);
    const xs = new Float32Array(count);
    const ys = new Float32Array(count);
    const zs = new Float32Array(count);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, zero);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.userData = {
      lives, xs, ys, zs, head: 0, lifeMax: life, decalRadius: size * 0.62,
      _m: new THREE.Matrix4(),
      _p: new THREE.Vector3(),
      _q: new THREE.Quaternion(),
      _s: new THREE.Vector3(),
    };
    return mesh;
  }

  function applyWeatherSplashOpacity() {
    const heavy = weatherEffectFactor();
    const splash = Math.max(0, Math.min(3, weatherSplashIntensity));
    if (rainSplash && rainSplash.material) rainSplash.material.opacity = Math.min(1, (0.55 + 0.28 * heavy) * splash);
    if (rainSurface && rainSurface.material) rainSurface.material.opacity = Math.min(0.95, (0.24 + 0.20 * heavy) * splash);
    if (snowSurface && snowSurface.material) snowSurface.material.opacity = Math.min(1, (0.34 + 0.20 * heavy) * splash);
  }

  function makeWeatherBuildPool(count, { color, size, opacity, shape = 'square' }) {
    const geo = shape === 'circle'
      ? new THREE.CircleGeometry(size * 0.5, 18)
      : new THREE.PlaneGeometry(size, size);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.visible = false;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, zero);
    mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.userData = {
      head: 0, visibleCount: 0, maxCount: count, baseHalfSize: size * 0.5,
      _m: new THREE.Matrix4(),
      _p: new THREE.Vector3(),
      _q: new THREE.Quaternion(),
      _s: new THREE.Vector3(),
      _axis: new THREE.Vector3(0, 1, 0),
    };
    return mesh;
  }

  function ensureWeatherResources() {
    if (rainMesh && snowMesh && rainSplash && rainSurface && snowSurface) return;
    if (!rainGeo) rainGeo = getBoxGeometry(0.018, 0.34, 0.018);
    if (!rainMat) {
      rainMat = new THREE.MeshBasicMaterial({
        color: 0xbcd0e4, transparent: true, opacity: 0.55, depthWrite: false,
      });
    }
    if (!rainMesh) {
      rainMesh = makePrecip({ count: 700, geometry: rainGeo, material: rainMat, dropSpeed: 14, drift: 0.5, randomRot: false });
      xrWorldRoot.add(rainMesh);
    }
    if (!snowGeo) snowGeo = new THREE.BoxGeometry(0.10, 0.10, 0.10);
    if (!snowMat) snowMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false });
    if (!snowMesh) {
      snowMesh = makePrecip({ count: 520, geometry: snowGeo, material: snowMat, dropSpeed: 1.4, drift: 0.9, randomRot: true });
      xrWorldRoot.add(snowMesh);
    }
    if (!rainSplash) {
      rainSplash = makeSplashPool(260, { color: 0xe6f3ff, size: 0.38, life: 0.46, opacity: 0.82 });
      rainSplash.renderOrder = 30;
      xrWorldRoot.add(rainSplash);
    }
    if (!rainSurface) {
      rainSurface = makeWeatherBuildPool(900, { color: 0x9ed1f0, size: 0.42, opacity: 0.20, shape: 'circle' });
      rainSurface.renderOrder = 28;
      xrWorldRoot.add(rainSurface);
    }
    if (!snowSurface) {
      snowSurface = makeWeatherBuildPool(1400, { color: 0xffffff, size: 0.48, opacity: 0.34 });
      snowSurface.renderOrder = 29;
      xrWorldRoot.add(snowSurface);
    }
    applyWeatherSplashOpacity();
  }

  function clampWeatherDecalToCell(x, z, radius) {
    const gx = Math.floor(x + GRID / 2);
    const gz = Math.floor(z + GRID / 2);
    const minX = gx - GRID / 2;
    const minZ = gz - GRID / 2;
    const margin = Math.max(0.12, Math.min(0.34, radius + 0.035));
    return {
      x: Math.max(minX + margin, Math.min(minX + 1 - margin, x)),
      z: Math.max(minZ + margin, Math.min(minZ + 1 - margin, z)),
    };
  }

  function emitSplash(pool, x, y, z) {
    if (!pool || weatherSplashIntensity <= 0 || Math.random() > Math.min(1, weatherSplashIntensity)) return;
    const u = pool.userData;
    const p = clampWeatherDecalToCell(x, z, u.decalRadius || 0.24);
    const i = u.head;
    u.head = (i + 1) % u.lives.length;
    u.lives[i] = 0;
    u.xs[i] = p.x;
    u.ys[i] = y;
    u.zs[i] = p.z;
    pool.visible = true;
  }

  function emitWeatherBuildSurface(pool, x, y, z, chance, minSize, maxSize) {
    if (!pool || chance <= 0 || Math.random() > chance) return;
    const u = pool.userData;
    const i = u.head;
    u.head = (i + 1) % u.maxCount;
    u.visibleCount = Math.min(u.maxCount, u.visibleCount + 1);
    const jitterX = (Math.random() - 0.5) * 0.12;
    const jitterZ = (Math.random() - 0.5) * 0.12;
    const size = Math.min(1.28, minSize + Math.random() * (maxSize - minSize));
    const aspect = 0.75 + Math.random() * 0.30;
    const radius = (u.baseHalfSize || 0.24) * Math.max(size, size * aspect);
    const p = clampWeatherDecalToCell(x + jitterX, z + jitterZ, radius);
    u._p.set(p.x, y + WEATHER_DECAL_LIFT, p.z);
    u._q.setFromAxisAngle(u._axis, Math.random() * Math.PI * 2);
    u._s.set(size, 1, size * aspect);
    u._m.compose(u._p, u._q, u._s);
    pool.setMatrixAt(i, u._m);
    pool.count = u.visibleCount;
    pool.visible = u.visibleCount > 0;
    pool.instanceMatrix.needsUpdate = true;
  }

  function emitRainSurface(x, y, z) {
    const heavy = weatherEffectFactor();
    const splash = Math.max(0, Math.min(3, weatherSplashIntensity));
    const chance = Math.min(1, splash * (0.34 + heavy * 0.34));
    emitWeatherBuildSurface(rainSurface, x, y, z, chance, 0.58 + heavy * 0.12, 1.20 + heavy * 0.42);
  }

  function emitSnowSurface(x, y, z) {
    const heavy = weatherHeavyFactor();
    const splash = Math.max(0, Math.min(3, weatherSplashIntensity));
    const chance = Math.min(1, splash * (0.58 + heavy * 0.22));
    emitWeatherBuildSurface(snowSurface, x, y, z, chance, 0.58 + heavy * 0.18, 1.05 + heavy * 0.42);
  }

  function tickSplashes(pool, dt) {
    if (!pool || !pool.visible) return;
    const u = pool.userData;
    const m = u._m, p = u._p, q = u._q, sc = u._s;
    const lifeMax = u.lifeMax;
    q.identity();
    let anyAlive = false;
    for (let i = 0; i < u.lives.length; i++) {
      const t = u.lives[i];
      if (t < 0) continue;
      const nt = t + dt;
      if (nt >= lifeMax) {
        u.lives[i] = -1;
        sc.set(0, 0, 0);
      } else {
        anyAlive = true;
        u.lives[i] = nt;
        const k = Math.sin((nt / lifeMax) * Math.PI);
        sc.set(k, k, k);
      }
      p.set(u.xs[i], u.ys[i] + WEATHER_RIPPLE_LIFT, u.zs[i]);
      m.compose(p, q, sc);
      pool.setMatrixAt(i, m);
    }
    pool.visible = anyAlive;
    if (anyAlive) pool.instanceMatrix.needsUpdate = true;
  }

  function weatherSurfaceAt(x, z) {
    if (isLandscapeMeshActive()) {
      return landscapeHeightAtCell(x + GRID / 2 - 0.5, z + GRID / 2 - 0.5) + WEATHER_SURFACE_PAD;
    }
    const gx = Math.floor(x + GRID / 2);
    const gz = Math.floor(z + GRID / 2);
    let homeEntry = null;
    if (gx >= 0 && gx < GRID && gz >= 0 && gz < GRID) {
      if (cellMeshesGrid[gx]) homeEntry = cellMeshesGrid[gx][gz];
    } else {
      homeEntry = cellMeshes[gx + ',' + gz];
    }
    if (homeEntry && homeEntry.tile && homeEntry.tile.visible) {
      return homeEntry.tile.position.y + (homeEntry.tile.userData.weatherSurfaceY || (TOP_H + WEATHER_SURFACE_PAD));
    }
    const bx = Math.floor(gx / GRID);
    const bz = Math.floor(gz / GRID);
    if (bx === 0 && bz === 0) return null;
    const board = ghostBoards.get(ghostBoardKey(bx, bz));
    if (!board || !board.visible || opacityAtWorldPosition(x, z) <= 0.05) return null;
    const lx = gx - bx * GRID;
    const lz = gz - bz * GRID;
    if (lx < 0 || lx >= GRID || lz < 0 || lz >= GRID) return null;

    const cells = makeGhostWorld(bx, bz);
    const cell = cells[lx][lz];
    return TOP_H + terrainVisualRiseForCell(cell) + WEATHER_SURFACE_PAD;
  }

  const WEATHER_TILT_AXIS = new THREE.Vector3(0, 0, 1);
  function tickPrecip(mesh, dt, biasX, tiltAngle, onLand) {
    if (!mesh || !mesh.visible || mesh.count === 0) return;
    const u = mesh.userData;
    const pos = u.positions, vel = u.velocities, rot = u.rotations;
    const m = u._m, q = u._q, e = u._e, p = u._p, sc = u._s;
    let sharedQ = null;
    if (!rot) {
      if (tiltAngle) q.setFromAxisAngle(WEATHER_TILT_AXIS, tiltAngle);
      else q.identity();
      sharedQ = q;
    }

    // Budget the precipitation simulation. Heavy rain/snow on large visible
    // distance + many ghost boards can otherwise eat a lot of frame time.
    const budgetMs = 3.0;
    const start = performance.now();

    for (let i = 0; i < mesh.count; i++) {
      const ix = i * 3;
      pos[ix] += (vel[ix] + biasX) * dt;
      pos[ix + 1] += vel[ix + 1] * dt;
      pos[ix + 2] += vel[ix + 2] * dt;
      if (Math.abs(pos[ix] - target.x) > WEATHER_VOLUME * 1.25 || Math.abs(pos[ix + 2] - target.z) > WEATHER_VOLUME * 1.25) {
        respawnPrecipAt(mesh, i, true);
      }
      if (pos[ix + 1] <= WEATHER_FLOOR + 2) {
        const surfaceY = weatherSurfaceAt(pos[ix], pos[ix + 2]);
        if (surfaceY !== null && pos[ix + 1] <= surfaceY) {
          if (onLand) onLand(pos[ix], surfaceY, pos[ix + 2]);
          respawnPrecipAt(mesh, i, false);
        } else if (pos[ix + 1] <= WEATHER_FLOOR - 1) {
          respawnPrecipAt(mesh, i, false);
        }
      }
      p.set(pos[ix], pos[ix + 1], pos[ix + 2]);
      if (rot) {
        rot[ix] += dt * 0.6;
        rot[ix + 2] += dt * 0.4;
        e.set(rot[ix], rot[ix + 1], rot[ix + 2]);
        q.setFromEuler(e);
        m.compose(p, q, sc);
      } else {
        m.compose(p, sharedQ, sc);
      }
      mesh.setMatrixAt(i, m);

      if (i % 16 === 0 && performance.now() - start > budgetMs) break;
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  function seedWeatherSurfaceMarks(mode, burst = 1) {
    if (weatherSplashIntensity <= 0 || (mode !== 'rain' && mode !== 'storm' && mode !== 'snow')) return;
    ensureWeatherResources();
    const heavy = weatherEffectFactor();
    const count = Math.round((mode === 'storm' ? 220 : mode === 'snow' ? 150 : 95) * Math.max(0.7, Math.min(2.2, weatherSplashIntensity)) * burst);
    let placed = 0;
    for (let attempt = 0; attempt < count * 5 && placed < count; attempt++) {
      const x = target.x + (Math.random() - 0.5) * WEATHER_VOLUME * 1.55;
      const z = target.z + (Math.random() - 0.5) * WEATHER_VOLUME * 1.55;
      const y = weatherSurfaceAt(x, z);
      if (y === null) continue;
      if (mode === 'snow') {
        emitWeatherBuildSurface(snowSurface, x, y, z, 1, 0.62 + heavy * 0.16, 1.16 + heavy * 0.34);
      } else {
        if (placed % 2 === 0) emitSplash(rainSplash, x, y, z);
        emitWeatherBuildSurface(rainSurface, x, y, z, 1, 0.64 + heavy * 0.10, 1.30 + heavy * 0.36);
      }
      placed++;
    }
  }

  function setWeatherMode(mode) {
    const previous = weatherMode;
    weatherMode = mode;
    tileWeatherMode = mode === 'storm' ? 'rain' : mode;
    const weatherActive = mode === 'rain' || mode === 'storm' || mode === 'snow';
    if (weatherActive) ensureWeatherResources();
    applyWeatherMaterialTint();
    updateWeatherTileEffects();
    const heavy = weatherEffectFactor();
    if (rainMat) rainMat.opacity = Math.min(1, 0.38 + 0.24 * heavy);
    if (snowMat) snowMat.opacity = Math.min(1, 0.78 + 0.12 * heavy);
    setPrecipActive(rainMesh, (mode === 'rain' || mode === 'storm') ? weatherScaledCount(180, 700) : 0);
    setPrecipActive(snowMesh, mode === 'snow' ? weatherScaledCount(120, 520) : 0);
    if (mode !== previous && weatherActive) seedWeatherSurfaceMarks(mode, 1);
  }
  function setWeatherIntensity(value) {
    weatherIntensity = Math.max(0.25, Math.min(3, Number.isFinite(value) ? value : 0.25));
    applyWeatherTileOpacity();
    applyWeatherSplashOpacity();
    applyWeatherMaterialTint();
    setWeatherMode(weatherMode);
    if (weatherMode === 'storm' || weatherIntensity > 1) seedWeatherSurfaceMarks(weatherMode, 0.35);
  }
  function setWeatherSplashIntensity(value) {
    weatherSplashIntensity = Math.max(0, Math.min(3, Number.isFinite(value) ? value : 1.5));
    applyWeatherSplashOpacity();
    seedWeatherSurfaceMarks(weatherMode, 0.35);
  }
  // Watch body class for weather changes — this is the integration with
  // the existing time-weather popup which writes body.weather-* classes.
  function syncWeatherFromBodyClass() {
    if (document.body.classList.contains('weather-storm')) setWeatherMode('storm');
    else if (document.body.classList.contains('weather-rain')) setWeatherMode('rain');
    else if (document.body.classList.contains('weather-snow')) setWeatherMode('snow');
    else setWeatherMode('clear');
  }
  const weatherObs = new MutationObserver(syncWeatherFromBodyClass);
  weatherObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  syncWeatherFromBodyClass();

  function tickWeather(dt) {
    if (weatherMode === 'clear') {
      tickSplashes(rainSplash, dt);
      return;
    }
    ensureWeatherResources();
    const heavy = weatherEffectFactor();
    const rainBiasX = (weatherMode === 'rain' || weatherMode === 'storm') ? 0.25 + heavy * 3.1 : 0;
    const rainTilt = rainBiasX ? Math.atan2(rainBiasX, 14) : 0;
    tickPrecip(rainMesh, dt, rainBiasX, rainTilt, (x, y, z) => {
      emitSplash(rainSplash, x, y, z);
      emitRainSurface(x, y, z);
    });
    tickPrecip(snowMesh, dt, 0, 0, (x, y, z) => emitSnowSurface(x, y, z));
    tickSplashes(rainSplash, dt);
  }

  function updateClouds(dt) {
    if (typeof updateSkyBubble === 'function') updateSkyBubble();
    // Soft cloud style uses the merged sprite system in 31-cloud-sea and hides
    // the voxel/under-island cloud groups. Do not keep animating hidden voxel
    // clouds every frame.
    if (typeof renderCloudStyle !== 'undefined' && renderCloudStyle === 'soft') return;
    updateUnderIslandClouds(dt);
    if (!clouds || !clouds.length) return;
    const baseSpeed = renderCloudSpeed * 2.4; // 0 → 2.4 m/s scalar
    const cx = target.x;
    const cz = target.z;
    for (const c of clouds) {
      if (baseSpeed > 0.0001) {
        c.position.x += c.userData.driftSpeed * baseSpeed * dt;
      }
      const dx = c.position.x - cx;
      const dz = c.position.z - cz;
      // East edge — wrap back to the west side of the camera.
      if (dx > CLOUD_RANGE_X) {
        c.position.x = cx - CLOUD_RANGE_X - Math.random() * 2;
        c.position.z = cz + (Math.random() - 0.5) * CLOUD_Z_RANGE;
        c.userData.yOffset = (Math.random() - 0.5) * CLOUD_Y_JITTER;
        c.position.y = skyCloudHeight() + c.userData.yOffset;
        keepSkyCloudOffBuildPlane(c);
        continue;
      }
      // The user panned far enough that this cloud is now outside the
      // field. Recycle it to a fresh position around the camera so the
      // sky stays populated wherever they go.
      if (dx < -CLOUD_RANGE_X * 1.4 || Math.abs(dz) > CLOUD_Z_RANGE * 1.4) {
        c.position.x = cx + (Math.random() - 0.5) * CLOUD_RANGE_X * 2;
        c.position.z = cz + (Math.random() - 0.5) * CLOUD_Z_RANGE;
        c.userData.yOffset = (Math.random() - 0.5) * CLOUD_Y_JITTER;
        c.position.y = skyCloudHeight() + c.userData.yOffset;
      }
      keepSkyCloudOffBuildPlane(c);
    }
  }

  enqueueDeferredVisualStartup('sky-clouds', syncCloudPopulation);


  // -------- underside pipe emitters (water / murky / steam) --------
  // Some of the round underside pipes spit a faint output from their outer end:
  // clear water, murky brown water, or steam. Registered by
  // addIslandUtilityUnderside; positions are local to homeBorderGroup.
  const MAX_PIPE_PARTICLES = 140;
  const pipeEmitters = [];
  const pipeParticles = [];
  const pipeDropGeo = new THREE.SphereGeometry(0.034, 5, 5);
  const pipeWaterMat = new THREE.MeshBasicMaterial({ color: 0x8fc4e6, transparent: true, opacity: 0.7, depthWrite: false });
  const pipeMurkyMat = new THREE.MeshBasicMaterial({ color: 0x7a5f37, transparent: true, opacity: 0.8, depthWrite: false });
  const pipeSteamMat = new THREE.MeshBasicMaterial({ color: 0xeceeec, transparent: true, opacity: 0.5, depthWrite: false });
  const _pipeVec = new THREE.Vector3();

  function clearPipeEmitters() { pipeEmitters.length = 0; }
  function registerPipeEmitter(x, y, z, dx, dz, type) {
    if (pipeEmitters.length > 48) return;
    pipeEmitters.push({ x, y, z, dx, dz, type, acc: Math.random() * 0.4 });
  }
  function pipeMatFor(type) {
    return type === 'murky' ? pipeMurkyMat : (type === 'steam' ? pipeSteamMat : pipeWaterMat);
  }

  function spawnPipeParticle(em) {
    if (pipeParticles.length >= MAX_PIPE_PARTICLES) return;
    if (typeof homeBorderGroup === 'undefined' || !homeBorderGroup) return;
    _pipeVec.set(em.x, em.y, em.z);
    homeBorderGroup.localToWorld(_pipeVec);
    xrWorldRoot.worldToLocal(_pipeVec);
    const steam = em.type === 'steam';
    const baseMat = pipeMatFor(em.type);
    const op = (steam ? 0.32 : 0.6) + Math.random() * 0.12;
    const p = new THREE.Mesh(pipeDropGeo, getCachedParticleMaterial(baseMat, op));
    p.frustumCulled = true;
    p.castShadow = false;
    p.receiveShadow = false;
    if (typeof UNDER_ISLAND_EFFECT_RENDER_ORDER !== 'undefined') p.renderOrder = UNDER_ISLAND_EFFECT_RENDER_ORDER;
    const j = 0.03;
    p.position.set(
      _pipeVec.x + em.dx * 0.06 + (Math.random() - 0.5) * j,
      _pipeVec.y + (Math.random() - 0.5) * j,
      _pipeVec.z + em.dz * 0.06 + (Math.random() - 0.5) * j,
    );
    p.userData = {
      pipeBaseMat: baseMat,
      maxOpacity: op,
      life: 0,
      maxLife: steam ? (1.5 + Math.random() * 0.8) : (1.1 + Math.random() * 0.5),
      vx: em.dx * (0.16 + Math.random() * 0.12) + (Math.random() - 0.5) * 0.04,
      vz: em.dz * (0.16 + Math.random() * 0.12) + (Math.random() - 0.5) * 0.04,
      vy: steam ? (0.22 + Math.random() * 0.14) : (-0.10 - Math.random() * 0.10),
      steam,
    };
    const sc = steam ? (0.9 + Math.random() * 0.6) : (0.65 + Math.random() * 0.4);
    p.scale.setScalar(sc);
    setCachedParticleMaterial(p, baseMat, op);
    xrWorldRoot.add(p);
    pipeParticles.push(p);
  }

  function updatePipeEmitters(dt) {
    // Only emit when the underside can be seen (camera not high above), but keep
    // updating live particles so they fade out cleanly when the view changes.
    const emit = typeof camera === 'undefined' || camera.position.y < 4;
    if (emit) {
      for (const em of pipeEmitters) {
        em.acc += dt;
        const interval = em.type === 'steam' ? 0.16 : 0.12; // faint stream
        while (em.acc >= interval) {
          em.acc -= interval;
          if (Math.random() < 0.82) spawnPipeParticle(em);
        }
      }
    }
    for (let i = pipeParticles.length - 1; i >= 0; i--) {
      const p = pipeParticles[i];
      const u = p.userData;
      u.life += dt;
      const t = u.life / u.maxLife;
      if (u.steam) { u.vx *= 0.985; u.vz *= 0.985; }
      else u.vy -= 0.95 * dt; // gravity for water/murky
      p.position.x += u.vx * dt;
      p.position.y += u.vy * dt;
      p.position.z += u.vz * dt;
      setCachedParticleMaterial(p, u.pipeBaseMat, u.maxOpacity * (1 - t));
      if (u.steam) p.scale.setScalar(0.9 + t * 1.4);
      if (t >= 1) {
        if (p.parent) p.parent.remove(p);
        pipeParticles.splice(i, 1);
      }
    }
  }
