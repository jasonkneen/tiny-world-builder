  // -------- geometry helpers --------
  // roundedSlab / roundedBox are extruded geometries that get built many
  // thousands of times across home + ghost boards (every tile, every leaf,
  // every cloud puff). Cache them by their numeric args — the geometry has
  // no per-instance state, so the same VBO can back any number of meshes.
  // safeDisposeGeometry() skips disposal for cached entries, preserving the
  // shared VBO when an individual mesh is torn down.
  const geomCache = new Map();
  function safeDisposeGeometry(geo) {
    if (geo && !(geo.userData && geo.userData.cached)) geo.dispose();
  }

  // Shared plain BoxGeometry for the many tiny deterministic decals inside
  // makeTile (grass flecks, water insets/ripples, path bands/cap/scuffs).
  // Quantized to 0.01 to keep the cache bounded even when callers pass
  // continuous random lengths (ripples). 1 cm variation on a 1 m tile is
  // imperceptible; we still get ~26 distinct ripple lengths.
  function getBoxGeometry(w, h, d) {
    const qw = Math.round(w * 100) / 100;
    const qh = Math.round(h * 100) / 100;
    const qd = Math.round(d * 100) / 100;
    const key = 'boxflat|' + qw + '|' + qh + '|' + qd;
    const hit = geomCache.get(key);
    if (hit) return hit;
    const g = new THREE.BoxGeometry(qw, qh, qd);
    g.userData.cached = true;
    geomCache.set(key, g);
    return g;
  }

  function getCylinderGeometry(radius, height, segments = 12) {
    const qr = Math.round(radius * 1000) / 1000;
    const qh = Math.round(height * 100) / 100;
    const qs = Math.max(6, Math.min(18, Math.round(segments || 12)));
    const key = 'cylinder|' + qr + '|' + qh + '|' + qs;
    const hit = geomCache.get(key);
    if (hit) return hit;
    const g = new THREE.CylinderGeometry(qr, qr, qh, qs);
    g.userData.cached = true;
    geomCache.set(key, g);
    return g;
  }

  function getDodecahedronGeometry(r) {
    const qr = Math.round(r * 20) / 20;
    const key = 'dodecahedron|' + qr;
    const hit = geomCache.get(key);
    if (hit) return hit;
    const g = new THREE.DodecahedronGeometry(qr, 0);
    g.userData.cached = true;
    geomCache.set(key, g);
    return g;
  }

  function getCustomPartEllipsoidGeometry(segments = 12, verticalSegments = 8, phiStart = 0, phiLength = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI) {
    const ws = Math.max(6, Math.min(24, Math.round(segments || 12)));
    const hs = Math.max(4, Math.min(16, Math.round(verticalSegments || 8)));
    const ps = Math.round((Number.isFinite(phiStart) ? phiStart : 0) * 10000) / 10000;
    const pl = Math.round((Number.isFinite(phiLength) ? phiLength : Math.PI * 2) * 10000) / 10000;
    const ts = Math.round((Number.isFinite(thetaStart) ? thetaStart : 0) * 10000) / 10000;
    const tl = Math.round((Number.isFinite(thetaLength) ? thetaLength : Math.PI) * 10000) / 10000;
    const key = 'custom-ellipsoid|' + ws + '|' + hs + '|' + ps + '|' + pl + '|' + ts + '|' + tl;
    const hit = geomCache.get(key);
    if (hit) return hit;
    let geo = new THREE.SphereGeometry(0.5, ws, hs, ps, pl, ts, tl);
    if (typeof geo.toNonIndexed === 'function') {
      const nonIndexed = geo.toNonIndexed();
      geo.dispose();
      geo = nonIndexed;
    }
    if (geo.computeVertexNormals) geo.computeVertexNormals();
    geo.userData.cached = true;
    geomCache.set(key, geo);
    return geo;
  }

  function getVoxelBoxGeometry(w, h, d, bevel = 0) {
    const qw = Math.round(w * 100) / 100;
    const qh = Math.round(h * 100) / 100;
    const qd = Math.round(d * 100) / 100;
    const r = Math.round(Math.max(0, Math.min(bevel, Math.min(qw, qh, qd) * 0.22)) * 1000) / 1000;
    if (r < 0.001) return getBoxGeometry(qw, qh, qd);
    const key = 'voxelbox|' + qw + '|' + qh + '|' + qd + '|' + r;
    const hit = geomCache.get(key);
    if (hit) return hit;
    const g = roundedBox(qw, qh, qd, r).clone();
    // roundedBox is bottom-origin after extrusion; vbox positions from centre.
    g.translate(0, -qh / 2, 0);
    g.userData.cached = true;
    geomCache.set(key, g);
    return g;
  }

  // Variant of getBoxGeometry that omits selected faces from the index. Use
  // for risers, terrain caps, voxel terrain panels, and tile decals so we
  // don't render geometry the camera can't see. Cached the same way; never
  // mutate or dispose the returned geo.
  // BoxGeometry materialIndex per face: 0=+x, 1=-x, 2=+y (top), 3=-y (bottom),
  // 4=+z, 5=-z.
  function getOpenBoxGeometry(w, h, d, skipTop = false, skipBottom = false, skipPX = false, skipNX = false, skipPZ = false, skipNZ = false) {
    const qw = Math.round(w * 100) / 100;
    const qh = Math.round(h * 100) / 100;
    const qd = Math.round(d * 100) / 100;
    const tag = (skipTop ? 'T' : '_')
      + (skipBottom ? 'B' : '_')
      + (skipPX ? 'E' : '_')
      + (skipNX ? 'W' : '_')
      + (skipPZ ? 'S' : '_')
      + (skipNZ ? 'N' : '_');
    const key = 'boxopen|' + qw + '|' + qh + '|' + qd + '|' + tag;
    const hit = geomCache.get(key);
    if (hit) return hit;
    const g = new THREE.BoxGeometry(qw, qh, qd);
    const anySkip = skipTop || skipBottom || skipPX || skipNX || skipPZ || skipNZ;
    if (anySkip) {
      const oldIndex = g.getIndex().array;
      const keep = [];
      for (const grp of g.groups) {
        const mi = grp.materialIndex;
        if (skipPX && mi === 0) continue; // +x face
        if (skipNX && mi === 1) continue; // -x face
        if (skipTop && mi === 2) continue; // +y face
        if (skipBottom && mi === 3) continue; // -y face
        if (skipPZ && mi === 4) continue; // +z face
        if (skipNZ && mi === 5) continue; // -z face
        for (let i = grp.start; i < grp.start + grp.count; i++) keep.push(oldIndex[i]);
      }
      g.setIndex(keep);
      g.clearGroups();
    }
    g.userData.cached = true;
    geomCache.set(key, g);
    return g;
  }

  // A rounded extruded slab — used for tile pieces.
  function roundedSlab(size, height, radius = 0.07) {
    const key = 'slab|' + size + '|' + height + '|' + radius;
    const hit = geomCache.get(key);
    if (hit) return hit;
    const w = size / 2;
    const r = Math.min(radius, w - 0.01);
    const shape = new THREE.Shape();
    shape.moveTo(-w + r, -w);
    shape.lineTo(w - r, -w);
    shape.quadraticCurveTo(w, -w, w, -w + r);
    shape.lineTo(w, w - r);
    shape.quadraticCurveTo(w, w, w - r, w);
    shape.lineTo(-w + r, w);
    shape.quadraticCurveTo(-w, w, -w, w - r);
    shape.lineTo(-w, -w + r);
    shape.quadraticCurveTo(-w, -w, -w + r, -w);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.04,
      bevelThickness: 0.04,
      curveSegments: 4
    });
    geo.rotateX(-Math.PI / 2);
    // After rotation Y spans [0, height]
    geo.userData.cached = true;
    geomCache.set(key, geo);
    return geo;
  }

  // A rounded box — for some objects we want a softer cube look.
  function roundedBox(w, h, d, r = 0.05) {
    const key = 'box|' + w + '|' + h + '|' + d + '|' + r;
    const hit = geomCache.get(key);
    if (hit) return hit;
    const shape = new THREE.Shape();
    const hw = w / 2, hd = d / 2;
    const rr = Math.min(r, hw - 0.001, hd - 0.001);
    shape.moveTo(-hw + rr, -hd);
    shape.lineTo(hw - rr, -hd);
    shape.quadraticCurveTo(hw, -hd, hw, -hd + rr);
    shape.lineTo(hw, hd - rr);
    shape.quadraticCurveTo(hw, hd, hw - rr, hd);
    shape.lineTo(-hw + rr, hd);
    shape.quadraticCurveTo(-hw, hd, -hw, hd - rr);
    shape.lineTo(-hw, -hd + rr);
    shape.quadraticCurveTo(-hw, -hd, -hw + rr, -hd);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: h,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
      curveSegments: 3
    });
    geo.rotateX(-Math.PI / 2);
    geo.userData.cached = true;
    geomCache.set(key, geo);
    return geo;
  }

  // -------- materials --------
  // Lambert (not Standard): non-PBR diffuse only, much more direct color response.
  // Stylized low-poly looks better with flat shading than physical energy conservation.
  // Soft radial glow texture: white core fading to transparent. Additive light
  // haze sprites (lamps, window halos) map to this so they read as soft round
  // blooms instead of the hard SQUARE of an untextured sprite quad.
  const softGlowTexture = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  })();

  const M = {
    grass:     new THREE.MeshLambertMaterial({ color: 0x97bf41, side: THREE.FrontSide }),
    grassEdge: new THREE.MeshLambertMaterial({ color: 0x95c138, side: THREE.FrontSide }),
    grassHi:   new THREE.MeshLambertMaterial({ color: 0xb6dd55, side: THREE.FrontSide }),
    grassFlower: new THREE.MeshLambertMaterial({ color: 0xf2c849, side: THREE.FrontSide }),
    dirt:      new THREE.MeshLambertMaterial({ color: 0x7d4519, side: THREE.FrontSide }),
    dirtRich:  new THREE.MeshLambertMaterial({ color: 0x462b15, side: THREE.FrontSide }),
    path:      new THREE.MeshLambertMaterial({ color: 0xf2d29c, side: THREE.FrontSide }),
    pathTrim:  new THREE.MeshLambertMaterial({ color: 0xd9b780, side: THREE.FrontSide }),
    pathScuff: new THREE.MeshLambertMaterial({ color: 0xc9aa70, side: THREE.FrontSide }),
    wearGrime: new THREE.MeshLambertMaterial({ color: 0x5d533b, side: THREE.FrontSide }),
    wearChip:  new THREE.MeshLambertMaterial({ color: 0xd8d1bc, side: THREE.FrontSide }),
    wearMoss:  new THREE.MeshLambertMaterial({ color: 0x6f8732, side: THREE.FrontSide }),
    water:     new THREE.MeshLambertMaterial({ color: 0x3a8fcc, side: THREE.FrontSide }),
    waterDk:   new THREE.MeshLambertMaterial({ color: 0x2f77ad, side: THREE.FrontSide }),
    waterFoam: new THREE.MeshLambertMaterial({ color: 0xbbe9ff, transparent: true, opacity: 0.74, side: THREE.FrontSide }),
    waterfall: new THREE.MeshBasicMaterial({ color: 0x28b5f0, transparent: true, opacity: 0.56, depthWrite: true, side: THREE.FrontSide }),
    waterfallHi: new THREE.MeshBasicMaterial({ color: 0x96e7ff, transparent: true, opacity: 0.68, depthWrite: true, side: THREE.FrontSide }),
    waterfallFoamPuff: new THREE.MeshBasicMaterial({ color: 0xf4fdff, transparent: true, opacity: 0.82, depthWrite: true }),
    waterfallCube: new THREE.MeshBasicMaterial({ color: 0x078bd8, transparent: true, opacity: 0.82, depthWrite: true }),
    shore:     new THREE.MeshLambertMaterial({ color: 0xd8c18a, side: THREE.FrontSide }),

    rock:      new THREE.MeshLambertMaterial({ color: 0x9b9a8f, side: THREE.FrontSide }),
    rockDk:    new THREE.MeshLambertMaterial({ color: 0x707066, side: THREE.FrontSide }),
    rockHi:    new THREE.MeshLambertMaterial({ color: 0xc3c0b2, side: THREE.FrontSide }),
    rockMoss:  new THREE.MeshLambertMaterial({ color: 0x6f8a3a, side: THREE.FrontSide }),

    // New terrains (stone / lava / sand / snow).
    stone:     new THREE.MeshLambertMaterial({ color: 0x8f8a82, side: THREE.FrontSide }),
    stoneDk:   new THREE.MeshLambertMaterial({ color: 0x5e5a52 }),
    lava:      new THREE.MeshLambertMaterial({ color: 0xe7592b, emissive: 0xb02410, emissiveIntensity: 0.8 }),
    lavaCrust: new THREE.MeshLambertMaterial({ color: 0x3a201a }),
    sand:      new THREE.MeshLambertMaterial({ color: 0xe6cc7c }),
    sandDk:    new THREE.MeshLambertMaterial({ color: 0xc6a64b }),
    snow:      new THREE.MeshLambertMaterial({ color: 0xf2f5fa }),
    snowDk:    new THREE.MeshLambertMaterial({ color: 0xc9d1dc }),
    bridgeWood:  new THREE.MeshLambertMaterial({ color: 0x8b5a32 }),
    bridgeWoodD: new THREE.MeshLambertMaterial({ color: 0x5f3a20 }),

    trunk:     new THREE.MeshLambertMaterial({ color: 0x5c3818 }),
    leaves:    new THREE.MeshLambertMaterial({ color: 0x74b630 }),
    leavesDk:  new THREE.MeshLambertMaterial({ color: 0x4f9220 }),

    wallCream: new THREE.MeshLambertMaterial({ color: 0xf2dfb0 }),
    wallTrim:  new THREE.MeshLambertMaterial({ color: 0xe5cf99 }),
    roofBlue:  new THREE.MeshLambertMaterial({ color: 0x2a6dd1 }),
    roofBlueD: new THREE.MeshLambertMaterial({ color: 0x1d4d9c }),
    boardSide:  new THREE.MeshLambertMaterial({ color: 0x8b8d88, side: THREE.FrontSide }),
    islandUnder:  new THREE.MeshLambertMaterial({ color: 0x34373b, side: THREE.DoubleSide }),
    islandUnderD: new THREE.MeshLambertMaterial({ color: 0x202327, side: THREE.DoubleSide }),
    // Darkened (~0.45x) so the heavy/rocket engine reads as shaded under the
    // island instead of brightly lit — parity with the lift engine's under-island
    // shade (engine/world/09b UNDER_ISLAND_ENGINE_SHADE). Rocket-only materials.
    rocketSteel:  new THREE.MeshLambertMaterial({ color: 0x35383c, side: THREE.FrontSide }),
    rocketSteelD: new THREE.MeshLambertMaterial({ color: 0x15181b, side: THREE.FrontSide }),
    utilityPipe:  new THREE.MeshLambertMaterial({ color: 0x6f7881, side: THREE.FrontSide }),
    utilityPipeD: new THREE.MeshLambertMaterial({ color: 0x343a40, side: THREE.FrontSide }),
    utilityCable: new THREE.MeshLambertMaterial({ color: 0x171b20, side: THREE.FrontSide }),
    utilityCableB:new THREE.MeshLambertMaterial({ color: 0x244a72, side: THREE.FrontSide }),
    utilityClamp: new THREE.MeshLambertMaterial({ color: 0x9aa2a8, side: THREE.FrontSide }),
    rocketHeat:   new THREE.MeshLambertMaterial({ color: 0x5f1c16, emissive: 0x7a1c10, emissiveIntensity: 0.35 }),
    rocketFlameY: new THREE.MeshBasicMaterial({ color: 0xfff05a, transparent: true, opacity: 0.92, depthWrite: false }),
    rocketFlameO: new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.82, depthWrite: false }),
    rocketFlameR: new THREE.MeshBasicMaterial({ color: 0xe23a20, transparent: true, opacity: 0.66, depthWrite: false }),
    rocketSmoke:  new THREE.MeshBasicMaterial({ color: 0x8a8d8b, transparent: true, opacity: 0.34, depthWrite: false }),
    rocketSmokeD: new THREE.MeshBasicMaterial({ color: 0x4a4d4d, transparent: true, opacity: 0.26, depthWrite: false }),
    door:      new THREE.MeshLambertMaterial({ color: 0x7a4a2e }),
    woodTrim:  new THREE.MeshLambertMaterial({ color: 0x5c3818 }),
    windowB:   new THREE.MeshLambertMaterial({ color: 0x2a6dd1 }),
    windowLit: new THREE.MeshLambertMaterial({ color: 0xffe18a, emissive: 0xffb74a, emissiveIntensity: 0.72 }),
    windowNight: new THREE.MeshLambertMaterial({ color: 0x172139, emissive: 0x050813, emissiveIntensity: 0.08 }),
    chimney:   new THREE.MeshLambertMaterial({ color: 0xc9c4ba }),
    step:      new THREE.MeshLambertMaterial({ color: 0xa9a49a }),
    knob:      new THREE.MeshLambertMaterial({ color: 0xe8c050 }),
    lampMetal: new THREE.MeshLambertMaterial({ color: 0x2b2520 }),
    lampTrim:  new THREE.MeshLambertMaterial({ color: 0x6f5736 }),
    lampGlass: new THREE.MeshLambertMaterial({ color: 0xffdf91, emissive: 0xffb84a, emissiveIntensity: 0.84 }),
    lampGlow:  new THREE.MeshBasicMaterial({ color: 0xffc875, transparent: true, opacity: 0.46, depthWrite: false }),
    lampCone:  new THREE.MeshBasicMaterial({ color: 0xffc875, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
    lampPool:  new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        color: { value: new THREE.Color(0xffc875) },
        intensity: { value: 0.34 },
        voxelSteps: { value: 18 },
      },
      vertexShader: 'varying vec2 vUv;\nvoid main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: [
        'varying vec2 vUv;',
        'uniform vec3 color;',
        'uniform float intensity;',
        'uniform float voxelSteps;',
        'void main(){',
        '  vec2 uv=floor(vUv*voxelSteps)/voxelSteps;',
        '  vec2 p=vUv*2.0-1.0;',
        '  float d=length(p);',
        '  float edge=1.0-smoothstep(0.16,1.0,d);',
        '  float n=fract(sin(dot(uv,vec2(12.9898,78.233)))*43758.5453);',
        '  float a=edge*mix(0.82,1.13,n)*intensity;',
        '  gl_FragColor=vec4(color,a);',
        '}',
      ].join('\n'),
    }),
    spotPool:  new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        color: { value: new THREE.Color(0xffbd72) },
        intensity: { value: 0.38 },
        voxelSteps: { value: 16 },
      },
      vertexShader: 'varying vec2 vUv;\nvoid main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: [
        'varying vec2 vUv;',
        'uniform vec3 color;',
        'uniform float intensity;',
        'uniform float voxelSteps;',
        'void main(){',
        '  vec2 p=vUv*2.0-1.0;',
        '  float dFromSource=1.0-vUv.y;',
        '  float widthAtDistance=mix(0.22,1.0,dFromSource);',
        '  float side=1.0-smoothstep(widthAtDistance,widthAtDistance+0.16,abs(p.x));',
        '  float dist=1.0-smoothstep(0.08,1.0,dFromSource);',
        '  float center=1.0-smoothstep(0.0,0.95,abs(p.x/max(0.08,widthAtDistance)));',
        '  vec2 uv=floor(vUv*voxelSteps)/voxelSteps;',
        '  float n=fract(sin(dot(uv,vec2(19.19,44.71)))*17453.23);',
        '  float a=side*dist*center*mix(0.82,1.14,n)*intensity;',
        '  gl_FragColor=vec4(color,a);',
        '}',
      ].join('\n'),
    }),
    lampHazeSprite: new THREE.SpriteMaterial({
      map: softGlowTexture,
      color: 0xffc875,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    }),
    windowHalo: new THREE.SpriteMaterial({
      map: softGlowTexture,
      color: 0xffd989,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    }),
    windowGroundGlow: new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        color: { value: new THREE.Color(0xffc86a) },
        intensity: { value: 0.28 },
        voxelSteps: { value: 16 },
      },
      vertexShader: 'varying vec2 vUv;\nvoid main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: [
        'varying vec2 vUv;',
        'uniform vec3 color;',
        'uniform float intensity;',
        'uniform float voxelSteps;',
        'void main(){',
        '  vec2 p=vUv*2.0-1.0;',
        '  float dFromSource=1.0-vUv.y;',
        '  float widthAtDistance=mix(0.20,1.0,dFromSource);',
        '  float side=1.0-smoothstep(widthAtDistance,widthAtDistance+0.18,abs(p.x));',
        '  float distanceFade=1.0-smoothstep(0.08,1.0,dFromSource);',
        '  float center=1.0-smoothstep(0.0,0.90,abs(p.x/max(0.08,widthAtDistance)));',
        '  vec2 stepped=floor(vUv*voxelSteps)/voxelSteps;',
        '  float n=fract(sin(dot(stepped,vec2(12.9898,78.233)))*43758.5453);',
        '  float a=side*distanceFade*center*mix(0.85,1.15,n)*intensity;',
        '  gl_FragColor=vec4(color,a);',
        '}',
      ].join('\n'),
    }),
    windowWallGlow: new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        color: { value: new THREE.Color(0xffd88a) },
        intensity: { value: 0.22 },
      },
      vertexShader: 'varying vec2 vUv;\nvoid main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: [
        'varying vec2 vUv;',
        'uniform vec3 color;',
        'uniform float intensity;',
        'void main(){',
        '  vec2 p=vUv*2.0-1.0;',
        '  float horizontal=1.0-smoothstep(0.0,1.0,abs(p.x));',
        '  float vertical=1.0-smoothstep(-0.36,1.0,p.y);',
        '  gl_FragColor=vec4(color,horizontal*vertical*intensity);',
        '}',
      ].join('\n'),
    }),

    fence:     new THREE.MeshLambertMaterial({ color: 0x7d4519 }),
    fenceGarden: new THREE.MeshLambertMaterial({ color: 0x4c2d1b }),
    fenceGardenD:new THREE.MeshLambertMaterial({ color: 0x24160f }),
    fenceVine: new THREE.MeshLambertMaterial({ color: 0x24451f }),
    fenceFruit:new THREE.MeshLambertMaterial({ color: 0xf08a2a, emissive: 0x7a2606, emissiveIntensity: 0.18 }),
    fenceWire: new THREE.MeshLambertMaterial({ color: 0x777d7a }),
    fenceSteel:new THREE.MeshLambertMaterial({ color: 0x8d98a5 }),
    castleStone:  new THREE.MeshLambertMaterial({ color: 0xb8b1a5 }),
    castleStoneD: new THREE.MeshLambertMaterial({ color: 0x8a8378 }),
    castleSlit:   new THREE.MeshLambertMaterial({ color: 0x2a251f }),
    flagRed:      new THREE.MeshLambertMaterial({ color: 0xb84838 }),
    skyBody:   new THREE.MeshLambertMaterial({ color: 0x4a6680 }),
    skyGlass:  new THREE.MeshLambertMaterial({ color: 0x6db8e0 }),
    skyFrame:  new THREE.MeshLambertMaterial({ color: 0x2a3a4c }),
    skyRoof:   new THREE.MeshLambertMaterial({ color: 0x3a4a5c }),

    // Manor — Georgian brick + slate. Solo cluster-bypass (variant 'manor').
    manorBrick:    new THREE.MeshLambertMaterial({ color: 0xa84a3a }),
    manorBrickD:   new THREE.MeshLambertMaterial({ color: 0x7a3325 }),
    manorTrim:     new THREE.MeshLambertMaterial({ color: 0xf2ece0 }),
    manorRoof:     new THREE.MeshLambertMaterial({ color: 0x3a3a40 }),
    manorRoofD:    new THREE.MeshLambertMaterial({ color: 0x26262c }),
    manorWindow:   new THREE.MeshLambertMaterial({ color: 0xc8d8e8 }),

    // Stone Tower — taller fantasy tower (variant 'tower'). Distinct
    // from castleStone so the silhouette reads differently from a turret.
    towerStone:    new THREE.MeshLambertMaterial({ color: 0xa9a39a }),
    towerStoneD:   new THREE.MeshLambertMaterial({ color: 0x77716a }),
    towerRoof:     new THREE.MeshLambertMaterial({ color: 0x4a3a8c }),
    towerRoofD:    new THREE.MeshLambertMaterial({ color: 0x2f2660 }),
    cropLeaf:  new THREE.MeshLambertMaterial({ color: 0x96d943 }),
    cropStem:  new THREE.MeshLambertMaterial({ color: 0x5e9c2e }),

    cornStalk: new THREE.MeshLambertMaterial({ color: 0x6fa848 }),
    cornCob:   new THREE.MeshLambertMaterial({ color: 0xf2c849 }),
    cornLeaf:  new THREE.MeshLambertMaterial({ color: 0xa8c948 }),
    wheatStalk:new THREE.MeshLambertMaterial({ color: 0xc9b76e }),
    wheatHead: new THREE.MeshLambertMaterial({ color: 0xe6c354 }),
    pumpkin:   new THREE.MeshLambertMaterial({ color: 0xe07c2a }),
    pumpkinDk: new THREE.MeshLambertMaterial({ color: 0xb35a18 }),
    pumpkinStem: new THREE.MeshLambertMaterial({ color: 0x4d6a18 }),
    carrotBody:new THREE.MeshLambertMaterial({ color: 0xe06a2a }),
    sunflowerStalk:  new THREE.MeshLambertMaterial({ color: 0x4d8a2a }),
    sunflowerPetal:  new THREE.MeshLambertMaterial({ color: 0xf2c849 }),
    sunflowerCenter: new THREE.MeshLambertMaterial({ color: 0x5a3a18 }),

    cloud:     new THREE.MeshLambertMaterial({ color: 0xfdfcf8 }),
    cloudShade:new THREE.MeshLambertMaterial({ color: 0xdcd9d0 }),

    hover:     new THREE.MeshBasicMaterial({ color: 0x2a2722, transparent: true, opacity: 0.18, depthWrite: false }),
    hoverErase:new THREE.MeshBasicMaterial({ color: 0xb84838, transparent: true, opacity: 0.28, depthWrite: false }),
  };

  // Return a cached, darkened clone of a Lambert/standard material. Used to make
  // hardware that hangs in the island's shadow (engines, utility pipes, hanging
  // dressing cubes) read as occluded instead of brightly lit, without touching
  // the shared material used on the sunlit top surfaces. Keyed by source material
  // uuid + factor so darkened meshes still batch/merge by material. 1 = unchanged.
  const shadedMaterialCache = new Map();
  function shadeLambertMaterial(mat, factor) {
    if (!mat || !mat.color || !(factor >= 0) || factor === 1) return mat;
    const key = mat.uuid + ':' + factor;
    let out = shadedMaterialCache.get(key);
    if (!out) {
      out = mat.clone();
      out.color.multiplyScalar(factor);
      if (out.emissive) out.emissive.multiplyScalar(factor);
      out.userData = Object.assign({}, mat.userData, { underIslandShaded: true });
      shadedMaterialCache.set(key, out);
    }
    return out;
  }

  const islandShellMaterialCache = new Map();
  function syncIslandShellMaterial(baseMat, shellMat) {
    if (baseMat.isShaderMaterial && shellMat.isShaderMaterial) {
      shellMat.uniforms = baseMat.uniforms;
      shellMat.vertexShader = baseMat.vertexShader;
      shellMat.fragmentShader = baseMat.fragmentShader;
      shellMat.defines = baseMat.defines;
      shellMat.extensions = baseMat.extensions;
      shellMat.transparent = baseMat.transparent;
      shellMat.depthWrite = baseMat.depthWrite;
      shellMat.depthTest = baseMat.depthTest;
      shellMat.blending = baseMat.blending;
    } else {
      shellMat.map = baseMat.map || shellMat.map || null;
      shellMat.onBeforeCompile = baseMat.onBeforeCompile;
    }
    shellMat.userData = Object.assign({}, baseMat.userData || {}, shellMat.userData || {}, {
      islandShellMaterial: true,
    });
    shellMat.needsUpdate = true;
  }

  function islandShellMaterial(baseMat) {
    if (!baseMat || baseMat.side === THREE.DoubleSide) return baseMat;
    const key = baseMat.uuid;
    let hit = islandShellMaterialCache.get(key);
    if (hit) {
      syncIslandShellMaterial(baseMat, hit);
      return hit;
    }
    const mat = baseMat.clone();
    mat.side = THREE.DoubleSide;
    syncIslandShellMaterial(baseMat, mat);
    islandShellMaterialCache.set(key, mat);
    return mat;
  }
