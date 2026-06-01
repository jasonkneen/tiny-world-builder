  // -------- starlit atmosphere effects --------
  const STAR_VAULT_RADIUS = 118;
  const STAR_VAULT_RENDER_ORDER = -999;
  const STAR_VAULT_TOD_BUCKET = 12;
  const PLACEABLE_LIGHT_CAP = 8;
  const placeableLightSources = new Set();

  function starVaultNightFactor(minutes = currentTodMinutes) {
    const min = ((Math.round(minutes) % 1440) + 1440) % 1440;
    if (min >= 1260 || min < 360) return 1;
    if (min >= 1080 && min < 1260) return (min - 1080) / 180;
    if (min >= 360 && min < 480) return 1 - (min - 360) / 120;
    return 0;
  }

  function cloudRimLightStrength() {
    const duskBoost = currentTodMinutes >= 1020 && currentTodMinutes < 1260
      ? Math.sin(((currentTodMinutes - 1020) / 240) * Math.PI)
      : 0;
    const night = starVaultNightFactor(currentTodMinutes);
    return Math.max(0, Math.min(1.2, renderCloudRimLight || 0)) * Math.max(0.18, Math.max(duskBoost, night * 0.62));
  }

  function starVaultOpacity() {
    if (!renderStarVault) return 0;
    const night = starVaultNightFactor(currentTodMinutes);
    return Math.max(0, Math.min(0.98, night * (renderStarVaultStrength || 0)));
  }

  function makeProceduralStarVaultTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#02040d');
    bg.addColorStop(0.55, '#071028');
    bg.addColorStop(1, '#091125');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const rand = (typeof makeMulberry32 === 'function') ? makeMulberry32('tinyworld-star-vault') : Math.random;
    function drawWrappedDot(x, y, r, color, alpha) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      for (const px of [x, x - w, x + w]) {
        if (px < -r || px > w + r) continue;
        ctx.beginPath();
        ctx.arc(px, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = 0; i < 6400; i++) {
      const x = rand() * w;
      const y = Math.pow(rand(), 0.82) * h * 0.82;
      const milky = Math.abs(y - (h * 0.40 + Math.sin((x / w) * Math.PI * 2.0) * h * 0.14));
      const band = Math.max(0, 1 - milky / (h * 0.11));
      const r = (rand() < 0.985 ? 0.55 + rand() * 1.15 : 2.0 + rand() * 3.0) * (1 + band * 0.35);
      const blue = Math.floor(190 + rand() * 65);
      const alpha = Math.min(0.98, 0.28 + rand() * 0.58 + band * 0.36);
      drawWrappedDot(x, y, r, 'rgb(' + Math.floor(130 + rand() * 85) + ',' + blue + ',255)', alpha);
    }

    for (let n = 0; n < 3; n++) {
      const cx = w * (0.18 + n * 0.31);
      const cy = h * (0.28 + rand() * 0.24);
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * (0.10 + rand() * 0.08));
      grd.addColorStop(0, 'rgba(78, 88, 255, 0.24)');
      grd.addColorStop(0.42, 'rgba(80, 58, 170, 0.12)');
      grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  const starVaultSkyColor = new THREE.Color(0x0c1226);
  const starVaultMaterial = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: makeProceduralStarVaultTexture() },
      strength: { value: 0 },
      skyColor: { value: starVaultSkyColor },
    },
    vertexShader: [
      'varying vec2 vUv;',
      'varying vec3 vWorldDir;',
      'void main() {',
      '  vUv = uv;',
      '  vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;',
      '  vWorldDir = normalize(worldPos - cameraPosition);',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D map;',
      'uniform float strength;',
      'uniform vec3 skyColor;',
      'varying vec2 vUv;',
      'varying vec3 vWorldDir;',
      'void main() {',
      '  vec3 tex = texture2D(map, vUv).rgb;',
      '  float luma = max(max(tex.r, tex.g), tex.b);',
      '  vec3 crisp = mix(tex, pow(max(tex, vec3(0.0)), vec3(0.72)), smoothstep(0.42, 0.96, luma));',
      '  float hotCloud = smoothstep(0.70, 1.0, luma);',
      '  float blueStar = max(0.0, tex.b - max(tex.r, tex.g) * 0.78);',
      '  vec3 starPop = vec3(0.46, 0.58, 1.0) * smoothstep(0.035, 0.18, blueStar);',
      '  vec3 nightTex = crisp * (0.18 + hotCloud * 0.16) + starPop * 0.44;',
      '  float aboveHorizon = smoothstep(-0.06, 0.28, vWorldDir.y);',
      '  vec3 col = mix(skyColor, nightTex, clamp(strength, 0.0, 1.0) * aboveHorizon);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}',
    ].join('\n'),
    transparent: false,
    depthWrite: false,
    depthTest: false,
    side: THREE.BackSide,
    fog: false,
  });
  const starVaultSphere = new THREE.Mesh(
    new THREE.SphereGeometry(STAR_VAULT_RADIUS, 64, 32),
    starVaultMaterial
  );
  starVaultSphere.name = 'star-vault-equirect-sphere';
  starVaultSphere.renderOrder = STAR_VAULT_RENDER_ORDER;
  starVaultSphere.frustumCulled = false;
  starVaultSphere.raycast = function () {};
  scene.add(starVaultSphere);

  let _atmoLastBucket = null;
  function registerPlaceableLightSource(root) {
    if (root && root.userData && root.userData.placeableLightSource) {
      placeableLightSources.add(root);
      _atmoLastBucket = null;
      if (typeof applyPlaceableLightSourceSettings === 'function') applyPlaceableLightSourceSettings();
    }
  }
  function unregisterPlaceableLightSource(root) {
    if (root) {
      placeableLightSources.delete(root);
      _atmoLastBucket = null;
    }
  }
  function placeableLightSceneDistance(root) {
    if (!root) return Infinity;
    const dx = root.position.x - target.x;
    const dz = root.position.z - target.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
  function refreshPlaceableLightSourcesFromCells() {
    if (typeof cellMeshes === 'undefined' || !cellMeshes) return;
    for (const key in cellMeshes) {
      const obj = cellMeshes[key] && cellMeshes[key].object;
      if (obj && obj.userData && obj.userData.placeableLightSource) placeableLightSources.add(obj);
    }
  }
  function applyPlaceableLightSourceSettings() {
    refreshPlaceableLightSourcesFromCells();
    const night = starVaultNightFactor(currentTodMinutes);
    const dusk = currentTodMinutes >= 1020 && currentTodMinutes < 1260
      ? Math.sin(((currentTodMinutes - 1020) / 240) * Math.PI)
      : 0;
    const enabled = Math.max(0, Math.min(1.2, renderAccentLights || 0)) * Math.max(dusk * 0.72, night);
    if (M.lampPool && M.lampPool.uniforms && M.lampPool.uniforms.intensity) M.lampPool.uniforms.intensity.value = 0.12 + enabled * 0.26;
    if (M.spotPool && M.spotPool.uniforms && M.spotPool.uniforms.intensity) M.spotPool.uniforms.intensity.value = 0.14 + enabled * 0.30;
    if (M.lampHazeSprite) M.lampHazeSprite.opacity = 0.08 + enabled * 0.30;
    if (M.lampGlow) M.lampGlow.opacity = 0.16 + enabled * 0.38;
    if (M.lampCone) M.lampCone.opacity = 0.06 + enabled * 0.15;
    const activeRoots = [];
    for (const root of Array.from(placeableLightSources)) {
      if (!root || !root.parent) {
        placeableLightSources.delete(root);
        continue;
      }
      activeRoots.push(root);
    }
    activeRoots.sort((a, b) => placeableLightSceneDistance(a) - placeableLightSceneDistance(b));
    const live = new Set(activeRoots.slice(0, PLACEABLE_LIGHT_CAP));
    for (const root of activeRoots) {
      const active = live.has(root) && enabled > 0.01;
      root.traverse(o => {
        if ((o.isLight || o.isPointLight || o.isSpotLight) && o.userData && o.userData.placeableLight) {
          o.visible = active;
          o.intensity = active ? (o.userData.baseIntensity || 1) * enabled : 0;
        } else if (o.userData && o.userData.lightVisual) {
          o.visible = enabled > (o.material === M.lampCone || o.material === M.spotPool ? 0.12 : 0.04);
          if (!o.userData.lightVisualBaseScale && o.scale) o.userData.lightVisualBaseScale = o.scale.clone();
          if (o.userData.lightVisualBaseScale && (o.material === M.lampGlow || o.material === M.lampHazeSprite)) {
            const s = 0.72 + enabled * 0.58;
            o.scale.copy(o.userData.lightVisualBaseScale).multiplyScalar(s);
          }
        }
      });
    }
  }

  function applyAccentLightingSettings() {
    applyPlaceableLightSourceSettings();
  }

  function applyCloudRimLightSetting() {
    const strength = cloudRimLightStrength();
    const warm = new THREE.Color(0xff9a64);
    if (typeof clouds !== 'undefined' && clouds) {
      for (const c of clouds) {
        c.traverse(o => {
          const mat = o.material;
          if (!mat || !mat.userData || !mat.userData.cloudInstance || !mat.emissive) return;
          mat.emissive.copy(warm);
          mat.emissiveIntensity = strength * (mat.userData.cloudBright ? 0.26 : 0.15);
        });
      }
    }
    if (typeof setSoftCloudRimStrength === 'function') setSoftCloudRimStrength(strength);
  }

  function applyStarlitAtmosphereSettings() {
    const opacity = starVaultOpacity();
    starVaultSphere.visible = opacity > 0.002 && !!scene.background && !(renderer.xr && renderer.xr.isPresenting);
    if (starVaultMaterial.uniforms && starVaultMaterial.uniforms.strength) {
      starVaultMaterial.uniforms.strength.value = opacity;
      if (scene.background && scene.background.isColor) starVaultMaterial.uniforms.skyColor.value.copy(scene.background);
    }
    if (camera) starVaultSphere.position.copy(camera.position);
    applyAccentLightingSettings();
    applyCloudRimLightSetting();
  }

  function updateStarlitAtmosphere(dt) {
    if (camera) starVaultSphere.position.copy(camera.position);
    const bucket = Math.round((currentTodMinutes || 0) / STAR_VAULT_TOD_BUCKET) + ':' + renderStarVault + ':' + renderStarVaultStrength.toFixed(2) + ':' + renderCloudRimLight.toFixed(2) + ':' + renderAccentLights.toFixed(2);
    if (bucket !== _atmoLastBucket) {
      _atmoLastBucket = bucket;
      applyStarlitAtmosphereSettings();
    }
    if (starVaultSphere.visible && dt > 0) starVaultSphere.rotation.y += dt * 0.0016;
  }

  applyStarlitAtmosphereSettings();
