  // -------- LandscapeEngine integration --------

  // Scale factor: builder tiles are 1 unit apart; sampleLandscapeCell
  // maps them to engine coords via `scale = 25`, so we shrink the
  // engine's meshes by 1/25 so one engine sample-step = 1 builder unit.
  const LANDSCAPE_MESH_SCALE = 1 / 25;
  // Keep landscape sampling in the established terrain region. The embedded
  // LandscapeEngine airfield is disabled for Tiny World's continuous terrain.
  const LANDSCAPE_MESH_OFFSET = 800;

  function landscapeMeshFocusPos(out = new THREE.Vector3()) {
    // Convert the builder camera target to LandscapeEngine world coords.
    return out.set(
      (target.x + LANDSCAPE_MESH_OFFSET + GRID / 2 - 0.5) * 25,
      0,
      (target.z + LANDSCAPE_MESH_OFFSET + GRID / 2 - 0.5) * 25
    );
  }

  function landscapeHeightAtCell(x, z) {
    if (!landscapeMeshEngine) return 0;
    const wx = (x + LANDSCAPE_MESH_OFFSET) * 25;
    const wz = (z + LANDSCAPE_MESH_OFFSET) * 25;
    return landscapeMeshEngine.getHeight(wx, wz) * LANDSCAPE_MESH_SCALE;
  }

  // Per-terrace block height for generated voxel-block landscapes. Matches the
  // landscape-mode tile step (terrainRiseForLevel uses 1.12 when useLandscapeEngine)
  // so the voxel block tops line up with the hidden tiles objects sit on.
  const LANDSCAPE_VOXEL_LEVEL_STEP = 1.12;

  // The "realistic" landscape render no longer uses the flight-sim continuous
  // LandscapeEngine mesh. Instead it samples the same procedural height/biome and
  // builds flat-top voxel blocks through the mesh-terrain system. Low-poly still
  // uses the LandscapeEngine via initLandscapeMesh().
  function applyRealisticVoxelLandscape() {
    const api = window.__tinyworldMeshTerrain;
    const engine = landscapeEngineInstance;
    if (!api || typeof api.generate !== 'function' || !engine) return false;
    const built = api.generate(function (cellX, cellZ) {
      const c = sampleLandscapeCell(0, 0, cellX, cellZ, engine, GRID);
      return { material: c.terrain, level: c.terrainFloors };
    }, { levelStep: LANDSCAPE_VOXEL_LEVEL_STEP });
    if (built) landscapeMeshMode = false;
    return built;
  }
  window.__applyRealisticVoxelLandscape = applyRealisticVoxelLandscape;

  function initLandscapeMesh() {
    disposeLandscapeMesh();
    disposePlanetLandscape();
    if (!window.LandscapeEngine) return;
    if (!landscapeEngineInstance) return;

    landscapeMeshGroup = new THREE.Group();
    const s = LANDSCAPE_MESH_SCALE;
    landscapeMeshGroup.scale.set(s, s, s);
    // Align engine world-space with builder grid: engine pos (x+800)*25
    // maps to builder tilePos (x - GRID/2 + 0.5) after scaling.
    landscapeMeshGroup.position.set(
      -LANDSCAPE_MESH_OFFSET - GRID / 2 + 0.5,
      0,
      -LANDSCAPE_MESH_OFFSET - GRID / 2 + 0.5
    );
    worldGroup.add(landscapeMeshGroup);

    landscapeMeshEngine = new window.LandscapeEngine({
      scene: landscapeMeshGroup,
      seed: landscapeEngineInstance.seed,
      initialBiome: landscapeMeshBiome || landscapeEngineInstance.currentBiomeName,
      styleMode: landscapeMeshStyle || 'lowpoly',
      airfield: false,
    });

    landscapeMeshMode = true;
    landscapeGhostBoardsSuppressed = true;
    removeLandscapeLegacyMeshes();
    updateLandscapeClipBounds();
  }

  const PLANET_LANDSCAPE_DROP = 100;
  const PLANET_LANDSCAPE_DROP_MIN = 20;
  const PLANET_LANDSCAPE_DROP_MAX = 300;
  const PLANET_LANDSCAPE_DROP_UI_MAX = 300;
  const PLANET_LANDSCAPE_NEAR_RADIUS = 0;
  const PLANET_LANDSCAPE_FAR_RADIUS = 2;
  const PLANET_LANDSCAPE_NEAR_RES = 28;
  const PLANET_LANDSCAPE_FAR_CHUNK_SIZE = 2600;
  const PLANET_LANDSCAPE_FAR_RES = 24;
  const PLANET_LANDSCAPE_PRIME_TICKS = 2;
  const PLANET_LANDSCAPE_STREAM_INTERVAL = 0.20;
  const PLANET_LANDSCAPE_WARMUP_INTERVAL_MS = 48;
  const PLANET_LANDSCAPE_STREAM_MOVE = 150;
  const PLANET_ATMOSPHERE_RADIUS = 180;
  const PLANET_ATMOSPHERE_LAYERS = [
    { y: -30, radius: 0.88, alpha: 0.155, drift: 0.008, noise: 4.7 },
    { y: -78, radius: 1.16, alpha: 0.145, drift: -0.006, noise: 5.6 },
  ];
  const PLANET_LANDSCAPE_BIOMES = new Set(['grassland', 'desert', 'snow']);
  const PLANET_LANDSCAPE_STYLES = new Set(['lowpoly', 'realistic']);
  const planetLandscapeFocusScratch = new THREE.Vector3();
  const planetLandscapeLastStreamFocus = new THREE.Vector3(NaN, 0, NaN);
  let planetLandscapeStreamElapsed = 0;
  let planetLandscapeWarmupTimer = 0;

  function normalizePlanetLandscapeBiome(raw, fallback = 'grassland') {
    const key = String(raw || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (PLANET_LANDSCAPE_BIOMES.has(key)) return key;
    if (key === 'grass' || key === 'green' || key === 'temperate' || key === 'forest') return 'grassland';
    if (key === 'sand' || key === 'dune' || key === 'dunes' || key === 'arid') return 'desert';
    if (key === 'ice' || key === 'icy' || key === 'winter' || key === 'snowy' || key === 'arctic') return 'snow';
    return PLANET_LANDSCAPE_BIOMES.has(fallback) ? fallback : 'grassland';
  }

  function normalizePlanetLandscapeStyle(raw, fallback = 'lowpoly') {
    const key = String(raw || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (key === 'realistic' || key === 'realism' || key === 'real') return 'realistic';
    if (key === 'lowpoly' || key === 'cel' || key === 'toon' || key === 'stylized') return 'lowpoly';
    return PLANET_LANDSCAPE_STYLES.has(fallback) ? fallback : 'lowpoly';
  }

  function clampPlanetLandscapeDrop(raw, fallback = PLANET_LANDSCAPE_DROP) {
    const value = Number(raw);
    const base = Number.isFinite(value) ? value : fallback;
    return Math.max(PLANET_LANDSCAPE_DROP_MIN, Math.min(PLANET_LANDSCAPE_DROP_MAX, Math.round(base)));
  }

  function normalizePlanetLandscapeConfig(config) {
    if (!config || typeof config !== 'object' || config.enabled === false) return null;
    const biome = normalizePlanetLandscapeBiome(config.biome);
    const styleMode = normalizePlanetLandscapeStyle(config.styleMode || config.style || config.render);
    const drop = clampPlanetLandscapeDrop(config.drop);
    const rawSeed = config.seed;
    const seed = typeof rawSeed === 'number' && Number.isFinite(rawSeed)
      ? rawSeed
      : seedHash(String(rawSeed || 'planet-underlay'));
    return { enabled: true, seed, biome, styleMode, drop };
  }

  function serializePlanetLandscapeState() {
    return planetLandscapeConfig ? { ...planetLandscapeConfig } : null;
  }

  function planetUnderlayFogColor(engine) {
    const sky = (scene && scene.background && scene.background.isColor)
      ? scene.background.clone()
      : new THREE.Color(0xc7e6fb);
    const hazeHex = engine && engine.currentBiome ? engine.currentBiome.fogColor : 0xe8e4d2;
    return new THREE.Color(hazeHex).lerp(sky, 0.48);
  }

  function planetUnderlayDistanceColor(engine) {
    const sky = (scene && scene.background && scene.background.isColor)
      ? scene.background.clone()
      : new THREE.Color(0xc7e6fb);
    const hazeHex = engine && engine.currentBiome ? engine.currentBiome.fogColor : 0xe8e4d2;
    return sky.lerp(new THREE.Color(hazeHex), 0.18);
  }

  function planetUnderlayDistanceSettings(engine, config, styleMode) {
    const drop = config && Number.isFinite(Number(config.drop)) ? Number(config.drop) : PLANET_LANDSCAPE_DROP;
    const dropT = Math.max(0, Math.min(1, (drop - PLANET_LANDSCAPE_DROP_MIN) / (PLANET_LANDSCAPE_DROP_MAX - PLANET_LANDSCAPE_DROP_MIN)));
    const lowPoly = styleMode === 'lowpoly';
    return {
      color: planetUnderlayDistanceColor(engine),
      effect: Math.max(lowPoly ? 0.50 : 0.56, Math.min(0.72, 0.42 + Math.sqrt(dropT) * 0.25 + (lowPoly ? 0.03 : 0.08))),
      desaturate: lowPoly ? 0.78 : 0.68,
      dim: lowPoly ? 0.78 : 0.82,
      propOpacity: lowPoly ? 0.62 : 0.68,
    };
  }

  function applyPlanetShaderDistanceMaterial(mat, settings) {
    if (!mat || !mat.uniforms || !settings) return;
    if (mat.uniforms.planetDistanceEffect) mat.uniforms.planetDistanceEffect.value = settings.effect;
    if (mat.uniforms.planetDistanceColor) mat.uniforms.planetDistanceColor.value.copy(settings.color);
    if (mat.uniforms.planetDistanceDesaturate) mat.uniforms.planetDistanceDesaturate.value = settings.desaturate;
    if (mat.uniforms.planetDistanceDim) mat.uniforms.planetDistanceDim.value = settings.dim;
  }

  function applyPlanetBuiltInDistanceMaterial(mat, settings) {
    if (!mat || !settings) return;
    mat.userData = mat.userData || {};
    let needsModeUpdate = false;
    if (mat.color) {
      if (!mat.userData.planetBaseColor) mat.userData.planetBaseColor = mat.color.clone();
      const tintAmount = Math.min(0.72, settings.effect + 0.08);
      const nextColor = mat.userData.planetBaseColor.clone().lerp(settings.color, tintAmount);
      nextColor.multiplyScalar(settings.dim);
      if (!mat.color.equals(nextColor)) mat.color.copy(nextColor);
    }
    if (mat.transparent !== true) {
      mat.transparent = true;
      needsModeUpdate = true;
    }
    if (mat.opacity !== settings.propOpacity) mat.opacity = settings.propOpacity;
    if (mat.depthWrite !== false) {
      mat.depthWrite = false;
      needsModeUpdate = true;
    }
    if (needsModeUpdate) mat.needsUpdate = true;
  }

  function configurePlanetLandscapeEngine(engine, config) {
    if (!engine) return;
    const drop = config && Number.isFinite(Number(config.drop)) ? Number(config.drop) : PLANET_LANDSCAPE_DROP;
    const styleMode = normalizePlanetLandscapeStyle(config && (config.styleMode || config.style || config.render));
    const fogNear = Math.max(95, drop * 1.12);
    const fogFar = Math.max(fogNear + 245, drop * 3.8);
    const chunkProfileChanged = !!(
      engine.chunks && engine.farChunks && (engine.chunks.size || engine.farChunks.size) && (
        engine.BACKDROP_MODE !== true ||
        engine.RENDER_RADIUS !== PLANET_LANDSCAPE_NEAR_RADIUS ||
        engine.FAR_RADIUS !== PLANET_LANDSCAPE_FAR_RADIUS ||
        engine.CHUNK_RES !== PLANET_LANDSCAPE_NEAR_RES ||
        engine.FAR_CHUNK_SIZE !== PLANET_LANDSCAPE_FAR_CHUNK_SIZE ||
        engine.FAR_CHUNK_RES !== PLANET_LANDSCAPE_FAR_RES
      )
    );
    engine.BACKDROP_MODE = true;
    engine.RENDER_RADIUS = PLANET_LANDSCAPE_NEAR_RADIUS;
    engine.FAR_RADIUS = PLANET_LANDSCAPE_FAR_RADIUS;
    engine.CHUNK_RES = PLANET_LANDSCAPE_NEAR_RES;
    engine.FAR_CHUNK_SIZE = PLANET_LANDSCAPE_FAR_CHUNK_SIZE;
    engine.FAR_CHUNK_RES = PLANET_LANDSCAPE_FAR_RES;
    engine.CHUNK_BUILD_BUDGET_NEAR = 1;
    engine.CHUNK_BUILD_BUDGET_FAR = 1;
    if (chunkProfileChanged) engine.clearChunks();
    if (engine.waterMesh) engine.waterMesh.visible = false;
    const distanceSettings = planetUnderlayDistanceSettings(engine, config, styleMode);
    for (const mat of [engine.sandMat, engine.sandMatLowPoly, engine.waterMat]) {
      if (!mat || !mat.uniforms) continue;
      if (mat.uniforms.fogNear) mat.uniforms.fogNear.value = fogNear;
      if (mat.uniforms.fogFar) mat.uniforms.fogFar.value = fogFar;
      if (mat.uniforms.hazeStrength) mat.uniforms.hazeStrength.value = Math.max(mat.uniforms.hazeStrength.value || 0, 1.36);
      applyPlanetShaderDistanceMaterial(mat, distanceSettings);
    }
    const planetFogColor = planetUnderlayFogColor(engine);
    if (typeof engine.setPlanetFog === 'function') {
      engine.setPlanetFog({
        enabled: styleMode === 'realistic',
        color: planetFogColor,
        near: Math.max(80, fogNear * 0.86),
        far: fogFar,
        strength: styleMode === 'realistic' ? 1.34 : 0,
        exponent: 1.36,
        distanceColor: distanceSettings.color,
        distanceEffect: distanceSettings.effect,
        distanceDesaturate: distanceSettings.desaturate,
        distanceDim: distanceSettings.dim,
      });
    }
    [engine.rockMat, engine.rockMatLowPoly, engine.floraMat, engine.floraMatLow].forEach(mat => applyPlanetBuiltInDistanceMaterial(mat, distanceSettings));
    engine.userData = {
      ...(engine.userData || {}),
      planetUnderlay: true,
      backdropProfile: true,
      styleMode,
      nearRadius: engine.RENDER_RADIUS,
      nearChunkRes: engine.CHUNK_RES,
      farRadius: engine.FAR_RADIUS,
      farChunkSize: engine.FAR_CHUNK_SIZE,
      farChunkRes: engine.FAR_CHUNK_RES,
      chunkBuildBudgetNear: engine.CHUNK_BUILD_BUDGET_NEAR,
      chunkBuildBudgetFar: engine.CHUNK_BUILD_BUDGET_FAR,
      waterVisible: !!(engine.waterMesh && engine.waterMesh.visible),
      fogNear,
      fogFar,
      planetFogColor: '#' + planetFogColor.getHexString(),
      planetDistanceColor: '#' + distanceSettings.color.getHexString(),
      planetDistanceEffect: distanceSettings.effect,
      realisticPlanetFog: styleMode === 'realistic',
    };
  }

  function planetAtmosphereColors() {
    const sky = (scene && scene.background && scene.background.isColor)
      ? scene.background.clone()
      : new THREE.Color(0xc7e6fb);
    const hazeHex = planetLandscapeEngine && planetLandscapeEngine.currentBiome
      ? planetLandscapeEngine.currentBiome.fogColor
      : 0xe8e4d2;
    const haze = sky.clone().lerp(new THREE.Color(hazeHex), 0.24);
    return { sky, haze };
  }

  function makePlanetAtmosphereMaterial(layer, index) {
    const colors = planetAtmosphereColors();
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        hazeColor: { value: colors.haze },
        skyColor: { value: colors.sky },
        alpha: { value: layer.alpha },
        noiseScale: { value: layer.noise },
        seed: { value: index * 19.37 + 3.11 },
        drift: { value: layer.drift },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float time;
        uniform vec3 hazeColor;
        uniform vec3 skyColor;
        uniform float alpha;
        uniform float noiseScale;
        uniform float seed;
        uniform float drift;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32 + seed);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          vec2 centered = vUv * 2.0 - 1.0;
          float r = length(centered);
          float edge = 1.0 - smoothstep(0.44, 1.0, r);
          float centreSoftness = smoothstep(0.02, 0.34, r);
          vec2 driftUv = vUv * noiseScale + vec2(time * drift + seed, -time * drift * 0.73);
          float n = noise(driftUv + seed * 0.017);
          float wisps = smoothstep(0.22, 0.84, n);
          float veil = edge * mix(0.52, 1.0, wisps) * mix(0.92, 1.0, centreSoftness);
          float horizonLift = smoothstep(-90.0, -18.0, -abs(vWorldPos.y));
          float a = alpha * veil * (0.82 + horizonLift * 0.28);
          if (a < 0.004) discard;
          vec3 col = mix(skyColor, hazeColor, 0.58 + wisps * 0.24);
          gl_FragColor = vec4(col, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
  }

  function samePlanetLandscapeSource(a, b) {
    return !!(a && b && a.seed === b.seed && a.biome === b.biome && a.styleMode === b.styleMode);
  }

  function syncPlanetAtmosphereColors() {
    if (!planetAtmosphereGroup) return;
    const colors = planetAtmosphereColors();
    if (planetLandscapeEngine && planetLandscapeConfig) {
      const styleMode = normalizePlanetLandscapeStyle(planetLandscapeConfig.styleMode);
      const distanceSettings = planetUnderlayDistanceSettings(planetLandscapeEngine, planetLandscapeConfig, styleMode);
      [planetLandscapeEngine.sandMat, planetLandscapeEngine.sandMatLowPoly, planetLandscapeEngine.waterMat].forEach(mat => applyPlanetShaderDistanceMaterial(mat, distanceSettings));
      [planetLandscapeEngine.rockMat, planetLandscapeEngine.rockMatLowPoly, planetLandscapeEngine.floraMat, planetLandscapeEngine.floraMatLow].forEach(mat => applyPlanetBuiltInDistanceMaterial(mat, distanceSettings));
      if (typeof planetLandscapeEngine.setPlanetFog === 'function') {
        planetLandscapeEngine.setPlanetFog({
          enabled: styleMode === 'realistic',
          color: planetUnderlayFogColor(planetLandscapeEngine),
          distanceColor: distanceSettings.color,
          distanceEffect: distanceSettings.effect,
          distanceDesaturate: distanceSettings.desaturate,
          distanceDim: distanceSettings.dim,
        });
      }
    }
    planetAtmosphereGroup.traverse(o => {
      const uniforms = o.material && o.material.uniforms;
      if (!uniforms) return;
      if (uniforms.hazeColor) uniforms.hazeColor.value.copy(colors.haze);
      if (uniforms.skyColor) uniforms.skyColor.value.copy(colors.sky);
    });
  }

  function disposePlanetAtmosphere() {
    if (!planetAtmosphereGroup) return;
    planetAtmosphereGroup.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
    if (planetAtmosphereGroup.parent) planetAtmosphereGroup.parent.remove(planetAtmosphereGroup);
    planetAtmosphereGroup = null;
  }

  function syncPlanetAtmosphereLayout(config) {
    if (!planetAtmosphereGroup) return;
    const next = normalizePlanetLandscapeConfig(config) || planetLandscapeConfig;
    if (!next) return;
    const radiusScale = Math.max(0.46, Math.min(1.42, Math.sqrt(next.drop / PLANET_LANDSCAPE_DROP)));
    planetAtmosphereGroup.children.forEach((mesh, index) => {
      const layer = PLANET_ATMOSPHERE_LAYERS[index];
      if (!layer) return;
      const layerDepth = Math.max(0.12, Math.min(0.92, Math.abs(layer.y) / PLANET_LANDSCAPE_DROP));
      const scaledY = -next.drop * layerDepth;
      mesh.position.y = Math.max(-next.drop + 5, Math.min(-6, scaledY));
      mesh.scale.set(radiusScale, radiusScale, 1);
    });
  }

  function initPlanetAtmosphere(config) {
    disposePlanetAtmosphere();
    const next = normalizePlanetLandscapeConfig(config) || planetLandscapeConfig;
    if (!next) return;
    planetAtmosphereGroup = new THREE.Group();
    planetAtmosphereGroup.name = 'planetAtmosphereBetweenLayers';
    planetAtmosphereGroup.position.set(target.x, 0, target.z);
    planetAtmosphereGroup.userData.noPointerPick = true;
    planetAtmosphereGroup.userData.elapsed = 0;
    PLANET_ATMOSPHERE_LAYERS.forEach((layer, index) => {
      const size = PLANET_ATMOSPHERE_RADIUS * layer.radius * 2;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size, 1, 1),
        makePlanetAtmosphereMaterial(layer, index)
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 24 + index;
      mesh.raycast = function () {};
      mesh.userData.noShadow = true;
      mesh.userData.planetAtmosphere = true;
      planetAtmosphereGroup.add(mesh);
    });
    syncPlanetAtmosphereLayout(next);
    worldGroup.add(planetAtmosphereGroup);
    syncPlanetAtmosphereColors();
  }

  function updatePlanetAtmosphere(dt) {
    if (!planetAtmosphereGroup) return;
    planetAtmosphereGroup.visible = isPlanetLandscapeActive();
    planetAtmosphereGroup.position.x = target.x;
    planetAtmosphereGroup.position.z = target.z;
    planetAtmosphereGroup.userData.elapsed = (planetAtmosphereGroup.userData.elapsed || 0) + dt;
    const elapsed = planetAtmosphereGroup.userData.elapsed;
    planetAtmosphereGroup.traverse(o => {
      const uniforms = o.material && o.material.uniforms;
      if (uniforms && uniforms.time) uniforms.time.value = elapsed;
    });
    if (!planetAtmosphereGroup.userData.lastColorSync || elapsed - planetAtmosphereGroup.userData.lastColorSync > 0.75) {
      syncPlanetAtmosphereColors();
      planetAtmosphereGroup.userData.lastColorSync = elapsed;
    }
  }

  function resetPlanetLandscapeStreamState() {
    if (planetLandscapeWarmupTimer) {
      clearTimeout(planetLandscapeWarmupTimer);
      planetLandscapeWarmupTimer = 0;
    }
    planetLandscapeStreamElapsed = PLANET_LANDSCAPE_STREAM_INTERVAL;
    planetLandscapeLastStreamFocus.set(NaN, 0, NaN);
  }

  function planetLandscapePendingCount() {
    if (!planetLandscapeEngine) return 0;
    const nearPending = planetLandscapeEngine.pendingChunkBuilds ? planetLandscapeEngine.pendingChunkBuilds.length : 0;
    const farPending = planetLandscapeEngine.pendingFarChunkBuilds ? planetLandscapeEngine.pendingFarChunkBuilds.length : 0;
    return nearPending + farPending;
  }

  function schedulePlanetLandscapeWarmup() {
    if (!planetLandscapeEngine || planetLandscapeWarmupTimer || !planetLandscapePendingCount()) return;
    planetLandscapeWarmupTimer = setTimeout(() => {
      planetLandscapeWarmupTimer = 0;
      if (!planetLandscapeEngine) return;
      tickPlanetLandscapeStream(PLANET_LANDSCAPE_STREAM_INTERVAL);
      if (typeof renderSceneIfReady === 'function') renderSceneIfReady();
      schedulePlanetLandscapeWarmup();
    }, PLANET_LANDSCAPE_WARMUP_INTERVAL_MS);
  }

  function tickPlanetLandscapeStream(dt) {
    if (!planetLandscapeEngine) return;
    const focus = landscapeMeshFocusPos(planetLandscapeFocusScratch);
    planetLandscapeStreamElapsed += dt;
    const nearPending = planetLandscapeEngine.pendingChunkBuilds ? planetLandscapeEngine.pendingChunkBuilds.length : 0;
    const farPending = planetLandscapeEngine.pendingFarChunkBuilds ? planetLandscapeEngine.pendingFarChunkBuilds.length : 0;
    const moved = !Number.isFinite(planetLandscapeLastStreamFocus.x)
      || planetLandscapeLastStreamFocus.distanceToSquared(focus) > PLANET_LANDSCAPE_STREAM_MOVE * PLANET_LANDSCAPE_STREAM_MOVE;
    const shouldStream = moved || ((nearPending || farPending) && planetLandscapeStreamElapsed >= PLANET_LANDSCAPE_STREAM_INTERVAL);
    if (shouldStream) {
      planetLandscapeEngine.update(focus, dt);
      planetLandscapeLastStreamFocus.copy(focus);
      planetLandscapeStreamElapsed = 0;
    } else if (planetLandscapeEngine.waterMesh && planetLandscapeEngine.waterMesh.visible !== false && planetLandscapeEngine.waterMat) {
      planetLandscapeEngine.waterMat.uniforms.time.value += dt;
      planetLandscapeEngine.waterMat.uniforms.cameraPos.value.copy(focus);
    }
  }

  function disposePlanetLandscape() {
    disposePlanetAtmosphere();
    if (planetLandscapeEngine) {
      planetLandscapeEngine.dispose();
      planetLandscapeEngine = null;
    }
    if (planetLandscapeGroup) {
      if (planetLandscapeGroup.parent) planetLandscapeGroup.parent.remove(planetLandscapeGroup);
      planetLandscapeGroup = null;
    }
    planetLandscapeConfig = null;
    resetPlanetLandscapeStreamState();
    syncPlanetUnderlayToggle();
  }

  function updatePlanetLandscapeDrop(drop) {
    if (!planetLandscapeConfig || !planetLandscapeGroup || !planetLandscapeEngine) return false;
    const next = normalizePlanetLandscapeConfig({ ...planetLandscapeConfig, drop });
    if (!next) return false;
    planetLandscapeConfig = next;
    lastPlanetLandscapeConfig = next;
    planetLandscapeGroup.position.y = -next.drop;
    configurePlanetLandscapeEngine(planetLandscapeEngine, next);
    syncPlanetAtmosphereLayout(next);
    syncPlanetAtmosphereColors();
    schedulePlanetLandscapeWarmup();
    if (document.body.classList.contains('planet-proof-active')) enablePlanetLandscapeProofChrome(next);
    return true;
  }

  function initPlanetLandscape(config) {
    const next = normalizePlanetLandscapeConfig(config);
    if (next && isPlanetLandscapeActive() && samePlanetLandscapeSource(planetLandscapeConfig, next)) {
      return updatePlanetLandscapeDrop(next.drop);
    }
    disposePlanetLandscape();
    if (!next) return false;
    if (!window.LandscapeEngine) {
      console.warn('LandscapeEngine.js is not loaded. Planet underlay disabled.');
      return false;
    }
    planetLandscapeConfig = next;
    planetLandscapeGroup = new THREE.Group();
    planetLandscapeGroup.name = 'planetLandscapeUnderlay';
    planetLandscapeGroup.userData.noPointerPick = true;
    const s = LANDSCAPE_MESH_SCALE;
    planetLandscapeGroup.scale.set(s, s, s);
    planetLandscapeGroup.position.set(
      -LANDSCAPE_MESH_OFFSET - GRID / 2 + 0.5,
      -next.drop,
      -LANDSCAPE_MESH_OFFSET - GRID / 2 + 0.5
    );
    worldGroup.add(planetLandscapeGroup);
    planetLandscapeEngine = new window.LandscapeEngine({
      scene: planetLandscapeGroup,
      seed: next.seed,
      initialBiome: next.biome,
      styleMode: next.styleMode,
      airfield: false,
    });
    configurePlanetLandscapeEngine(planetLandscapeEngine, next);
    resetPlanetLandscapeStreamState();
    initPlanetAtmosphere(next);
    planetLandscapeEngine.clearClipBounds();
    // Kick enough near/far chunks to establish a broad horizon immediately,
    // then let the normal frame loop keep streaming around camera movement.
    for (let i = 0; i < PLANET_LANDSCAPE_PRIME_TICKS; i++) {
      planetLandscapeEngine.update(landscapeMeshFocusPos(), 0);
    }
    schedulePlanetLandscapeWarmup();
    if (document.body.classList.contains('planet-proof-active')) enablePlanetLandscapeProofChrome(next);
    lastPlanetLandscapeConfig = next;
    syncPlanetUnderlayToggle();
    return true;
  }

  // Reflect planet-underlay live state into the render-settings checkbox.
  // Defined here so dispose/init can call it; the change handler is wired
  // inside setupRenderSettings further down.
  function syncPlanetUnderlayToggle() {
    const container = document.getElementById('render-planet-underlay-container');
    const checkbox = document.getElementById('render-planet-underlay-active');
    if (!container || !checkbox) return;
    const active = isPlanetLandscapeActive();
    const hasMemo = !!lastPlanetLandscapeConfig;
    container.style.display = (active || hasMemo) ? 'flex' : 'none';
    checkbox.checked = active;
    checkbox.disabled = !active && !hasMemo;
  }

  function planetLandscapeStateFromSelection(seed, biome, styleMode, drop = PLANET_LANDSCAPE_DROP) {
    return normalizePlanetLandscapeConfig({
      enabled: true,
      seed,
      biome,
      styleMode,
      drop,
    });
  }

  function planetLandscapeDebugInfo() {
    return {
      active: isPlanetLandscapeActive(),
      config: serializePlanetLandscapeState(),
      chunks: planetLandscapeEngine ? planetLandscapeEngine.chunks.size : 0,
      farChunks: planetLandscapeEngine ? planetLandscapeEngine.farChunks.size : 0,
      groupChildren: planetLandscapeGroup ? planetLandscapeGroup.children.length : 0,
      atmosphereLayers: planetAtmosphereGroup ? planetAtmosphereGroup.children.length : 0,
      atmosphereVisible: planetAtmosphereGroup ? planetAtmosphereGroup.visible : false,
      nearRadius: planetLandscapeEngine ? planetLandscapeEngine.RENDER_RADIUS : 0,
      nearChunkRes: planetLandscapeEngine ? planetLandscapeEngine.CHUNK_RES : 0,
      farRadius: planetLandscapeEngine ? planetLandscapeEngine.FAR_RADIUS : 0,
      farChunkSize: planetLandscapeEngine ? planetLandscapeEngine.FAR_CHUNK_SIZE : 0,
      farChunkRes: planetLandscapeEngine ? planetLandscapeEngine.FAR_CHUNK_RES : 0,
      backdropProfile: planetLandscapeEngine ? planetLandscapeEngine.BACKDROP_MODE === true : false,
      chunkBuildBudgetNear: planetLandscapeEngine ? planetLandscapeEngine.CHUNK_BUILD_BUDGET_NEAR : 0,
      chunkBuildBudgetFar: planetLandscapeEngine ? planetLandscapeEngine.CHUNK_BUILD_BUDGET_FAR : 0,
      waterVisible: planetLandscapeEngine && planetLandscapeEngine.waterMesh ? planetLandscapeEngine.waterMesh.visible !== false : false,
      pendingChunks: planetLandscapeEngine ? planetLandscapeEngine.pendingChunkBuilds.length : 0,
      pendingFarChunks: planetLandscapeEngine ? planetLandscapeEngine.pendingFarChunkBuilds.length : 0,
      fogNear: planetLandscapeEngine && planetLandscapeEngine.userData ? planetLandscapeEngine.userData.fogNear : null,
      fogFar: planetLandscapeEngine && planetLandscapeEngine.userData ? planetLandscapeEngine.userData.fogFar : null,
      planetFogColor: planetLandscapeEngine && planetLandscapeEngine.userData ? planetLandscapeEngine.userData.planetFogColor : null,
      realisticPlanetFog: planetLandscapeEngine && planetLandscapeEngine.userData ? planetLandscapeEngine.userData.realisticPlanetFog : false,
      groupPosition: planetLandscapeGroup ? planetLandscapeGroup.position.toArray() : null,
      cameraMode,
      cameraPosition: camera ? camera.position.toArray() : null,
      target: target ? target.toArray() : null,
    };
  }

  function applyPlanetLandscapeProofView(config = {}) {
    const hasConfig = config && typeof config === 'object' && Object.keys(config).length > 0;
    const next = planetLandscapeConfig || (hasConfig ? normalizePlanetLandscapeConfig(config) : null) || { drop: PLANET_LANDSCAPE_DROP };
    if (typeof dismissWelcomeForDemo === 'function') dismissWelcomeForDemo();
    if (typeof setCameraMode === 'function') setCameraMode('perspective');
    cameraMode = 'perspective';
    camera = persCam;
    viewSize = clampViewSize(Number(config.viewSize) || 38);
    const nextPolar = Number(config.polar);
    const nextAzimuth = Number(config.azimuth);
    polar = Number.isFinite(nextPolar) ? Math.max(MIN_ORBIT_POLAR, Math.min(MAX_ORBIT_POLAR, nextPolar)) : 0.82;
    azimuth = Number.isFinite(nextAzimuth) ? nextAzimuth : -0.78;
    const targetY = Number(config.targetY);
    const targetX = Number(config.targetX);
    const targetZ = Number(config.targetZ);
    target.set(
      Number.isFinite(targetX) ? targetX : 0,
      Number.isFinite(targetY) ? targetY : -next.drop * 0.42,
      Number.isFinite(targetZ) ? targetZ : 0
    );
    persCam.near = 0.1;
    persCam.far = Math.max(260, next.drop * 4.8);
    persCam.fov = 34;
    persCam.updateProjectionMatrix();
    updateCamera();
    return planetLandscapeDebugInfo();
  }

  function enablePlanetLandscapeProofChrome(config = {}) {
    const hasConfig = config && typeof config === 'object' && Object.keys(config).length > 0;
    const next = planetLandscapeConfig || (hasConfig ? normalizePlanetLandscapeConfig(config) : null) || { biome: 'grassland', styleMode: 'lowpoly', drop: PLANET_LANDSCAPE_DROP };
    document.body.classList.add('planet-proof-active');
    if (!document.getElementById('planet-proof-style')) {
      const style = document.createElement('style');
      style.id = 'planet-proof-style';
      style.textContent = `
        body.planet-proof-active > :not(canvas):not(.planet-proof-badge) {
          visibility: hidden !important;
          pointer-events: none !important;
        }
        body.planet-proof-active canvas {
          visibility: visible !important;
        }
        .planet-proof-badge {
          position: fixed;
          left: 24px;
          bottom: 22px;
          z-index: 99999;
          padding: 9px 12px;
          border-radius: 999px;
          background: rgba(18, 24, 32, 0.72);
          color: #fffaf0;
          font: 700 12px/1.2 Inter, system-ui, sans-serif;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          box-shadow: 0 16px 38px rgba(18, 24, 32, 0.22);
          backdrop-filter: blur(18px) saturate(150%);
          -webkit-backdrop-filter: blur(18px) saturate(150%);
        }
      `;
      document.head.appendChild(style);
    }
    let badge = document.getElementById('planet-proof-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'planet-proof-badge';
      badge.className = 'planet-proof-badge';
      document.body.appendChild(badge);
    }
    const styleLabel = next.styleMode === 'realistic' ? 'realistic' : 'low-poly';
    badge.textContent = `Floating city + ${styleLabel} ${next.biome} planet · ${next.drop}m below`;
  }

  window.__setPlanetLandscapeUnderlay = initPlanetLandscape;
  window.__setPlanetLandscapeDrop = updatePlanetLandscapeDrop;
  window.__clearPlanetLandscapeUnderlay = disposePlanetLandscape;
  window.__planetLandscapeInfo = planetLandscapeDebugInfo;
  window.__planetLandscapeProofView = applyPlanetLandscapeProofView;

  function removeLandscapeLegacyMeshes() {
    clearGhostBoardsOnly();
    for (const key of Object.keys(cellMeshes)) {
      const [x, z] = key.split(',').map(Number);
      const entry = cellMeshes[key];
      if (!entry) continue;
      if (entry.tile) {
        if (entry.tile.parent) entry.tile.parent.remove(entry.tile);
        disposeGroup(entry.tile);
        entry.tile = null;
      }
      if (isOutsideHomeGrid(x, z)) {
        if (entry.object) {
          if (entry.object.parent) entry.object.parent.remove(entry.object);
          disposeGroup(entry.object);
        }
        if (entry.extras) {
          for (const m of entry.extras) {
            if (m.parent) m.parent.remove(m);
            disposeGroup(m);
          }
        }
        delete cellMeshes[key];
      }
    }
  }

  function disposeLandscapeCutCaps() {
    if (!landscapeCutCapsGroup) return;
    const materials = new Set();
    landscapeCutCapsGroup.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) materials.add(o.material);
    });
    materials.forEach(material => material.dispose());
    if (landscapeCutCapsGroup.parent) landscapeCutCapsGroup.parent.remove(landscapeCutCapsGroup);
    landscapeCutCapsGroup = null;
  }

  function makeLandscapeCutCapMaterial() {
    const bg = (scene && scene.background && scene.background.isColor)
      ? scene.background.clone()
      : new THREE.Color(0xf4ede0);
    return new THREE.ShaderMaterial({
      uniforms: {
        fogColor: { value: bg },
      },
      vertexShader: `
        attribute vec3 color;
        attribute float alpha;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 fogColor;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec3 col = mix(fogColor, vColor, vAlpha);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      transparent: false,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
  }

  function makeLandscapeMistMaterial() {
    return new THREE.MeshBasicMaterial({
      color: 0xe4f1f8,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
  }

  function makeLandscapeCutCap(side, material) {
    const step = 25;
    const min = (LANDSCAPE_MESH_OFFSET - 0.5) * step;
    const max = (LANDSCAPE_MESH_OFFSET + GRID - 0.5) * step;
    const holdDepth = 14;
    const fadeDepth = 58;
    const positions = [];
    const colors = [];
    const alphas = [];
    const indices = [];
    const color = new THREE.Color();
    const fog = material.uniforms.fogColor.value;

    for (let i = 0; i <= GRID; i++) {
      const t = i / Math.max(1, GRID);
      const a = min + (max - min) * t;
      const wx = side === 'e' ? max : side === 'w' ? min : a;
      const wz = side === 's' ? max : side === 'n' ? min : a;
      const h = landscapeMeshEngine.getHeight(wx, wz);
      const holdY = h - holdDepth;
      const fadeY = h - fadeDepth;
      if (landscapeMeshEngine._strataColor) {
        landscapeMeshEngine._strataColor(h, color);
      } else {
        color.setHex(0x8a6a48);
      }
      // Three vertical samples: keep a little real terrain colour under the
      // cut line, then fade to scene background and stop. No bottom/base
      // plate is rendered below the fade edge.
      positions.push(wx, h, wz, wx, holdY, wz, wx, fadeY, wz);
      colors.push(
        color.r, color.g, color.b,
        color.r, color.g, color.b,
        fog.r, fog.g, fog.b
      );
      alphas.push(1.0, 1.0, 0.0);
    }

    for (let i = 0; i < GRID; i++) {
      const topA = i * 3;
      const fadeA = topA + 1;
      const botA = topA + 2;
      const topB = topA + 3;
      const fadeB = topA + 4;
      const botB = topA + 5;
      indices.push(
        topA, fadeA, topB, fadeA, fadeB, topB,
        fadeA, botA, fadeB, botA, botB, fadeB
      );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 20;
    mesh.raycast = function () {};
    mesh.userData.landscapeCutCap = true;
    return mesh;
  }

  function makeLandscapeMistCurtain(side, material) {
    const step = 25;
    const min = (LANDSCAPE_MESH_OFFSET - 0.5) * step;
    const max = (LANDSCAPE_MESH_OFFSET + GRID - 0.5) * step;
    const pad = 18;
    const bottomY = -18;
    const topY = 110;
    const fixed = side === 'e' ? max + pad : side === 'w' ? min - pad : side === 's' ? max + pad : min - pad;
    const a0 = min - pad * 3;
    const a1 = max + pad * 3;
    const positions = (side === 'e' || side === 'w')
      ? [fixed, bottomY, a0, fixed, topY, a0, fixed, bottomY, a1, fixed, topY, a1]
      : [a0, bottomY, fixed, a0, topY, fixed, a1, bottomY, fixed, a1, topY, fixed];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex([0, 2, 1, 2, 3, 1]);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 30;
    mesh.raycast = function () {};
    mesh.userData.landscapeMist = true;
    return mesh;
  }

  function makeLandscapeBottomMist(material) {
    const step = 25;
    const min = (LANDSCAPE_MESH_OFFSET - 0.5) * step;
    const max = (LANDSCAPE_MESH_OFFSET + GRID - 0.5) * step;
    const pad = 70;
    const geometry = new THREE.PlaneGeometry(max - min + pad * 2, max - min + pad * 2, 1, 1);
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set((min + max) * 0.5, -16, (min + max) * 0.5);
    mesh.renderOrder = 28;
    mesh.raycast = function () {};
    mesh.userData.landscapeMist = true;
    return mesh;
  }

  function rebuildLandscapeCutCaps() {
    disposeLandscapeCutCaps();
    if (!landscapeMeshEngine || !landscapeMeshGroup || ghostBoardsEnabledForGrid()) return;
    landscapeCutCapsGroup = new THREE.Group();
    landscapeCutCapsGroup.name = 'landscapeCutCaps';
    const capMaterial = makeLandscapeCutCapMaterial();
    ['n', 's', 'e', 'w'].forEach(side => {
      landscapeCutCapsGroup.add(makeLandscapeCutCap(side, capMaterial));
    });
    landscapeMeshGroup.add(landscapeCutCapsGroup);
  }

  // Recalculate and apply clip bounds based on ghost-board state.
  // When ghost boards are off, clip the landscape to the home grid and add
  // vertical cut caps so the board reads as a chunk sliced out of a larger map.
  function updateLandscapeClipBounds() {
    if (!landscapeMeshEngine) return;
    // Landscape mode never uses legacy ghost boards. Auto-expand is handled
    // by moving the LandscapeEngine clip window with the camera target while
    // the engine streams real terrain chunks underneath.
    const pad = 0.001;
    const half = (renderAutoExpand || hasUserPanned) ? (GRID / 2 + renderVisibleDistance * GRID) : GRID / 2;
    const cx = (renderAutoExpand || hasUserPanned) ? target.x : 0;
    const cz = (renderAutoExpand || hasUserPanned) ? target.z : 0;
    const requiredRadius = Math.ceil((half * 25) / landscapeMeshEngine.CHUNK_SIZE) + 1;
    if (landscapeMeshEngine.RENDER_RADIUS < requiredRadius) {
      landscapeMeshEngine.RENDER_RADIUS = requiredRadius;
    }
    landscapeMeshEngine.setClipBounds(
      new THREE.Vector3(cx - half - pad, -1e6, cz - half - pad),
      new THREE.Vector3(cx + half + pad,  1e6, cz + half + pad)
    );
    // Do not render synthetic base/cut-cap/fog geometry. Pixel edge mode sees
    // helper meshes, so landscape mode renders only the actual engine mesh plus
    // central-board objects placed onto it.
    disposeLandscapeCutCaps();
  }

  function disposeLandscapeMesh(opts) {
    clearGhostBoardsOnly();
    disposeLandscapeCutCaps();
    // Also tear down a generated voxel-block landscape (realistic style) so
    // switching styles / clearing restores the flat tiles.
    if (window.__tinyworldMeshTerrain && typeof window.__tinyworldMeshTerrain.clearGenerated === 'function') {
      window.__tinyworldMeshTerrain.clearGenerated();
    }
    if (landscapeMeshEngine) {
      landscapeMeshEngine.dispose();
      landscapeMeshEngine = null;
    }
    if (landscapeMeshGroup) {
      worldGroup.remove(landscapeMeshGroup);
      landscapeMeshGroup = null;
    }
    landscapeMeshMode = false;
    landscapeGhostBoardsSuppressed = false;
    if (opts && opts.rebuild && typeof rebuildTerrainRender === 'function') {
      rebuildTerrainRender();
      rebuildObjectsRender();
    }
  }

  function initLandscapeEngine(seed, biomeName) {
    if (!window.LandscapeEngine) {
      console.warn("LandscapeEngine.js is not loaded.");
      return null;
    }
    const dummyScene = new THREE.Scene();
    const numericSeed = typeof seed === 'number' ? seed : seedHash(String(seed || ''));
    landscapeEngineInstance = new window.LandscapeEngine({
      scene: dummyScene,
      seed: numericSeed,
      initialBiome: biomeName || 'grassland',
      styleMode: 'lowpoly',
      airfield: false,
    });
    return landscapeEngineInstance;
  }

  function sampleLandscapeCell(boardX, boardZ, x, z, engine, gridSize) {
    const size = gridSize || GRID;
    // Offset by 800 cells (20,000 meters in LandscapeEngine space) to preserve the established generated terrain region.
    const gx = boardX * size + x + 800;
    const gz = boardZ * size + z + 800;

    // Spacing scale: map grid cells to LandscapeEngine space
    const scale = 25;
    const wx = gx * scale;
    const wz = gz * scale;

    const h = engine.getHeight(wx, wz);
    const waterLevel = engine.WATER_LEVEL; // 4.0

    // Map height to terrainFloors (1 to 8, stepped by mesa terraces)
    let tf = Math.max(1, Math.min(8, 1 + Math.floor(h / 28)));

    let terrain = 'grass';
    let kind = null;
    let floors = 1;
    let buildingType = null;

    // Calculate slope to detect cliffs
    const hN = engine.getHeight(wx + 5, wz);
    const hE = engine.getHeight(wx, wz + 5);
    const slope = (Math.abs(hN - h) + Math.abs(hE - h)) * 0.05;

    // Deterministic hash based on global cell position
    function cellHash(gx, gz, salt) {
      const s = Math.sin(gx * 12.9898 + gz * 78.233 + salt * 37.719) * 43758.5453;
      return s - Math.floor(s);
    }

    if (h <= waterLevel + 1.0) {
      terrain = 'water';
      tf = 1;
    } else {
      const biome = engine.currentBiomeName;
      if (slope > 0.35) {
        terrain = 'stone';
      } else if (biome === 'desert') {
        terrain = 'sand';
        const pick = cellHash(gx, gz, 100);
        if (pick < 0.03) {
          kind = 'rock';
          floors = 1 + Math.floor(cellHash(gx, gz, 101) * 3);
        } else if (pick < 0.06) {
          kind = 'tuft';
        } else if (pick < 0.08) {
          kind = 'house';
          buildingType = 'cottage';
          floors = 1;
        }
      } else if (biome === 'snow') {
        if (tf >= 5) {
          terrain = 'snow';
        } else {
          terrain = 'stone';
        }
        const pick = cellHash(gx, gz, 100);
        if (pick < 0.08) {
          kind = 'tree';
          floors = 1 + Math.floor(cellHash(gx, gz, 102) * 3);
        } else if (pick < 0.12) {
          kind = 'rock';
          floors = 1 + Math.floor(cellHash(gx, gz, 101) * 2);
        } else if (pick < 0.14) {
          kind = 'house';
          buildingType = 'cottage';
          floors = 1;
        }
      } else {
        // grassland
        if (tf >= 6) {
          terrain = 'snow';
        } else if (tf >= 4) {
          terrain = 'stone';
        } else if (tf === 1 && h <= waterLevel + 4.0) {
          terrain = 'sand';
        } else {
          terrain = 'grass';
        }
        const pick = cellHash(gx, gz, 100);
        if (pick < 0.08) {
          kind = 'tree';
          floors = 1 + Math.floor(cellHash(gx, gz, 102) * 3);
        } else if (pick < 0.12) {
          kind = 'tuft';
        } else if (pick < 0.14) {
          kind = 'flower';
        } else if (pick < 0.16) {
          kind = 'rock';
        } else if (pick < 0.18) {
          kind = 'house';
          buildingType = (cellHash(gx, gz, 103) < 0.5) ? 'cottage' : null;
          floors = 1 + Math.floor(cellHash(gx, gz, 104) * 2);
        }
      }
    }

    // In Landscape worlds, items sit on the terraced canyon hills, not flat ground
    let effectiveTf = tf;

    return {
      x, z,
      terrain,
      kind,
      floors,
      terrainFloors: effectiveTf,
      buildingType,
      fenceSide: null,
      extras: []
    };
  }

  function generateLandscapeWorld({ seed, biomes, elevation, gridSize }) {
    const size = coerceGridSize(gridSize, GRID);

    let chosenBiome = 'grassland';
    const dirtVal = biomes ? (biomes.dirt || 0) : 0;
    const grassVal = biomes ? (biomes.grass || 0) : 0;
    const forestVal = biomes ? (biomes.forest || 0) : 0;
    const mountainsVal = elevation ? (elevation.mountains || 0) : 0;

    if (dirtVal > grassVal && dirtVal > forestVal) {
      chosenBiome = 'desert';
    } else if (mountainsVal > 40) {
      chosenBiome = 'snow';
    }

    useLandscapeEngine = true;
    try {
      localStorage.setItem('tinyworld:gen:useLandscape', '1');
    } catch (_) {}

    const engine = initLandscapeEngine(seed, chosenBiome);
    if (!engine) {
      console.warn("Could not load LandscapeEngine. Falling back to standard procedural.");
      useLandscapeEngine = false;
      return generateProceduralWorld({ seed, biomes, elevation, gridSize });
    }

    const out = { v: 4, gridSize: size, cells: [] };

    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const cell = sampleLandscapeCell(0, 0, x, z, engine, size);
        out.cells.push(cell);
      }
    }

    out.useLandscapeEngine = true;
    out.landscapeEngineSeed = seed;
    out.landscapeEngineBiome = chosenBiome;

    return out;
  }

  window.__generateLandscapeWorld = generateLandscapeWorld;

  async function generateWorld(provider, model, key, userPrompt, gridSize, opts = {}) {
    const requestedGridSize = coerceGridSize(gridSize, GRID);
    const system = buildSystemPrompt(requestedGridSize);
    const def = AI_DEFAULTS[provider];
    if (!def) throw new Error('unknown provider: ' + provider);
    let raw;
    if (provider === 'anthropic') {
      raw = await callAnthropic(def.endpoint, key, model || def.model, system, userPrompt, null, opts);
    } else if (provider === 'gemini') {
      raw = await callGemini(def.endpoint, key, model || def.model, system, userPrompt, opts);
    } else {
      // OpenAI + xAI share the chat-completions shape.
      raw = await callOpenAI(def.endpoint, key, model || def.model, system, userPrompt, opts);
    }
    const parsed = extractJSON(raw);
    if (!parsed) {
      console.warn('[generate] raw model output:', raw);
      throw new Error('response was not parseable JSON');
    }
    normalizeWorldCells(parsed);
    if (isValidGridSize(requestedGridSize)) parsed.gridSize = requestedGridSize;
    const err = validateWorld(parsed);
    if (err) {
      console.warn('[generate] failed schema check:', err, parsed);
      throw new Error('schema check: ' + err);
    }
    return parsed;
  }

  function normalizeAutoAction(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('schema check: response was not an object');
    }
    const okTerrain = new Set(['grass','path','dirt','water','stone','lava','sand','snow']);
    const okKind = new Set([null,'house','tree','fence','rock','bridge','crop','corn','wheat','pumpkin','carrot','sunflower','tuft','flower','bush','cow','sheep']);
    const okBT = new Set([null,'cottage','manor','tower','turret','skyscraper']);
    let kind = data.kind === undefined ? null : data.kind;
    let terrain = data.terrain;
    let floors = data.floors === undefined ? 1 : data.floors;
    let buildingType = data.buildingType === undefined ? null : data.buildingType;

    if (!okKind.has(kind)) throw new Error('schema check: invalid kind ' + kind);
    if (terrain === undefined || terrain === null) {
      terrain = kind === 'bridge' ? 'water' : (CROP_KINDS.has(kind) ? 'dirt' : 'grass');
    }
    if (!okTerrain.has(terrain)) throw new Error('schema check: invalid terrain ' + terrain);
    if (!Number.isInteger(floors) || floors < 1 || floors > 8) {
      throw new Error('schema check: invalid floors ' + floors);
    }
    if (buildingType === undefined) buildingType = null;
    if (!okBT.has(buildingType)) throw new Error('schema check: invalid buildingType ' + buildingType);
    if (kind !== 'house') buildingType = null;
    if (kind === 'bridge') terrain = 'water';
    else if (CROP_KINDS.has(kind)) terrain = 'dirt';
    else if (terrain === 'water') kind = null;

    return { terrain, kind, floors, buildingType };
  }

  function autoSnapshotSignature() {
    return JSON.stringify({ v: STORAGE_VERSION, cells: snapshotCells() });
  }

  function adaptAutoSuggestionToCell(action, x, z) {
    const normalized = normalizeAutoAction(action);
    const cell = getWorldCell(x, z);
    if (normalized.kind && cell.kind === normalized.kind) {
      normalized.floors = Math.min((cell.floors || 1) + 1, MAX_FLOORS);
      if (normalized.kind === 'house' && normalized.buildingType === null) {
        normalized.buildingType = cell.buildingType || null;
      }
    }
      if (normalized.kind === 'house' && (cell.terrain === 'water' || cell.terrain === 'path' || cell.terrain === 'lava')) normalized.terrain = 'grass';
    return normalized;
  }

  async function getNextAutoSuggestion() {
    const snapshot = autoSnapshotSignature();
    if (!autoSuggestionQueue.length ||
        autoPlacementsSinceRefresh >= AUTO_REFRESH_EVERY ||
        !autoSuggestionSnapshot) {
      autoSuggestionQueue = await generateAutoSuggestions(snapshot);
      autoSuggestionSnapshot = snapshot;
      autoPlacementsSinceRefresh = 0;
    }
    const next = autoSuggestionQueue.shift();
    if (!next) throw new Error('model returned no Auto suggestions');
    return next;
  }

  async function generateAutoSuggestions(snapshot) {
    const cfg = getAIProviderState();
    if (!cfg.key) throw new Error('API key required');
    const def = AI_DEFAULTS[cfg.provider];
    const system = buildAutoSystemPrompt();
    const user = buildAutoUserPrompt();
    let raw;
    if (cfg.provider === 'anthropic') {
      raw = await callAnthropic(def.endpoint, cfg.key, cfg.model, system, user, {
        name: 'choose_auto_suggestions',
        description: 'Choose a ranked batch of Tiny World tile actions for the Auto palette tool.',
        schema: AUTO_SUGGESTIONS_SCHEMA,
      });
    } else if (cfg.provider === 'gemini') {
      raw = await callGemini(def.endpoint, cfg.key, cfg.model, system, user);
    } else {
      raw = await callOpenAI(def.endpoint, cfg.key, cfg.model, system, user);
    }
    const parsed = extractJSON(raw);
    if (!parsed) {
      console.warn('[auto] raw model output:', raw);
      throw new Error('response was not parseable JSON');
    }
    if (!Array.isArray(parsed.suggestions)) throw new Error('schema check: suggestions must be an array');
    const suggestions = parsed.suggestions.slice(0, AUTO_BATCH_SIZE).map(normalizeAutoAction);
    if (!suggestions.length) throw new Error('schema check: suggestions empty');
    return suggestions;
  }
