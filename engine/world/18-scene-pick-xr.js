  // -------- initial scene (matches the reference image) --------
  function loadInitialScene() {
    twPerfMark('initial:start');
    clearMooringCables();
    clearEditableIslands();
    // Wipe any existing meshes + animation state so a Reset re-plays the drop.
    for (const key in cellMeshes) {
      const e = cellMeshes[key];
      if (e.tile) { if (e.tile.parent) e.tile.parent.remove(e.tile); disposeGroup(e.tile); }
      if (e.object) { if (e.object.parent) e.object.parent.remove(e.object); disposeGroup(e.object); }
      if (e.extras) for (const m of e.extras) { if (m.parent) m.parent.remove(m); disposeGroup(m); }
    }
    for (const k of Object.keys(cellMeshes)) delete cellMeshes[k];
    initCellMeshesGrid();
    homeRenderQueue = [];
    homeRenderQueueCursor = 0;
    homeRenderQueued.clear();
    resetHomeWorldIntent();
    dropAnims.length = 0;
    cropPositions.clear();
    maxPumpkinPositions.clear();
    carriagePumpkin = null;

    // Build the layout in one shot so each cell only animates once.
    const layout = {};

    // Build a richer starter diorama: river + bridge, cottage lane, tiny
    // turret-wall, farm plots, and landmark rocks. It exercises the adjacency
    // systems instead of hiding most tools in the palette.
    for (let x = 0; x < GRID; x++) layout[x + ',2'] = { terrain: 'water', kind: null };
    for (let z = 0; z < GRID; z++) {
      if (z !== 2) layout['3,' + z] = { terrain: 'path', kind: null };
    }
    for (let x = 1; x <= 6; x++) layout[x + ',5'] = { terrain: 'path', kind: null };
    layout['3,2'] = { terrain: 'water', kind: 'bridge', floors: 1 };

    layout['1,4'] = { terrain: 'grass', kind: 'house' };
    layout['2,4'] = { terrain: 'grass', kind: 'house' };
    layout['5,4'] = { terrain: 'grass', kind: 'house', buildingType: 'manor', floors: 2 };
    layout['6,3'] = { terrain: 'grass', kind: 'house', buildingType: 'tower', floors: 3 };

    layout['0,0'] = { terrain: 'grass', kind: 'house', floors: 2 };
    layout['0,1'] = { terrain: 'grass', kind: 'fence' };
    layout['1,0'] = { terrain: 'grass', kind: 'fence' };
    layout['1,1'] = { terrain: 'grass', kind: 'fence' };

    layout['5,6'] = { terrain: 'dirt', kind: 'wheat' };
    layout['6,6'] = { terrain: 'dirt', kind: 'corn' };
    layout['7,6'] = { terrain: 'dirt', kind: 'sunflower' };
    layout['5,7'] = { terrain: 'dirt', kind: 'carrot' };
    layout['6,7'] = { terrain: 'dirt', kind: 'pumpkin' };
    layout['7,7'] = { terrain: 'dirt', kind: 'crop' };

    layout['0,6'] = { terrain: 'grass', kind: 'tree' };
    layout['1,7'] = { terrain: 'grass', kind: 'tree' };
    layout['5,0'] = { terrain: 'grass', kind: 'rock' };
    layout['5,1'] = { terrain: 'grass', kind: 'tree' };
    layout['6,1'] = { terrain: 'grass', kind: 'tree' };
    layout['7,0'] = { terrain: 'grass', kind: 'rock', floors: 3 };
    layout['7,1'] = { terrain: 'grass', kind: 'tree', floors: 2 };
    layout['6,0'] = { terrain: 'grass', kind: 'rock', floors: 2 };
    layout['0,3'] = { terrain: 'grass', kind: 'tuft' };
    layout['4,1'] = { terrain: 'grass', kind: 'tuft' };
    layout['7,3'] = { terrain: 'grass', kind: 'tuft' };

    // Board tiles are the stage: render them immediately. Props/buildings
    // still land in a diagonal sweep so initial load has motion without the
    // ground itself popping in cell by cell.
    const OBJECT_STAGGER = 0.035;
    for (let x = 0; x < GRID; x++) {
      for (let z = 0; z < GRID; z++) {
        const cell = layout[x + ',' + z];
        if (!cell) continue;
        if (!world[x]) world[x] = [];
        let terrain = cell.terrain || 'grass';
        let kind = cell.kind || null;
        if (kind === 'bridge') terrain = 'water';
        else if (CROP_KINDS.has(kind)) terrain = 'dirt';
        else if (terrain === 'water') kind = null;
        let buildingType = cell.buildingType || null;
        if (kind !== 'house') buildingType = null;
        const fenceSide = kind === 'fence' ? normalizeFenceSide(cell.fenceSide) : null;
        world[x][z] = {
          terrain,
          terrainFloors: cell.terrainFloors || 1,
          kind,
          floors: cell.floors || 1,
          buildingType,
          fenceSide,
        };
      }
    }

    // Rebuild live index sets after the direct world write (bypasses setCell).
    twPerfMark('initial:intent-ready');
    rebuildCropPositions();
    rebuildMaxPumpkinCache();
    invalidateHomeFade();

    if (useWindowedHomeRendering()) {
      requestHomeRenderWindowSync({ force: true });
      seedCrowdPeople();
      saveState();
      twPerfMark('initial:windowed-queued');
      twPerfMark('initial:end');
      return;
    }

    twPerfMark('initial:tiles-start');
    for (let x = 0; x < GRID; x++) {
      for (let z = 0; z < GRID; z++) {
        renderCellTile(x, z, {
          animate: false,
        });
      }
    }
    twPerfMark('initial:tiles-rendered');
    for (let x = 0; x < GRID; x++) {
      for (let z = 0; z < GRID; z++) {
        const baseDelay = (x + z) * OBJECT_STAGGER;
        renderCellObject(x, z, {
          animate: true,
          delay: baseDelay,
          impactDust: false,
        });
      }
    }
    twPerfMark('initial:objects-rendered');
    seedCrowdPeople();
    saveState();
    if (typeof window.__tinyworldRefreshWaterAudio === 'function') window.__tinyworldRefreshWaterAudio();
    twPerfMark('initial:end');
  }

  // -------- hover indicator --------
  const hoverGeo = roundedSlab(TILE * 1.0, 0.04, 0.07);
  const hoverMesh = new THREE.Mesh(hoverGeo, M.hover);
  hoverMesh.position.y = TOP_H + 0.01;
  hoverMesh.visible = false;
  xrWorldRoot.add(hoverMesh);

  let currentHover = null;

  // -------- ghost placement preview --------
  // A translucent live preview of the object that would be placed on
  // the hovered tile. Updates when the selected tool changes; follows
  // the cursor; can be rotated and nudged within the tile via the
  // arrow keys before the user commits with a click.
  let ghostPreview = null;       // current preview Group (or null)
  let ghostPreviewKey = null;    // tool signature this preview was built for
  let ghostRotation = 0;         // radians (added on top of any deterministic rotation)
  let ghostOffsetX = 0;          // within-tile x nudge
  let ghostOffsetZ = 0;          // within-tile z nudge
  const GHOST_ROT_STEP = Math.PI / 2;     // 90° per arrow press — snaps to cardinal facings
  const GHOST_OFFSET_STEP = 0.06;          // ~6% of a tile per arrow press
  const GHOST_OFFSET_LIMIT = 0.32;         // clamp so the ghost stays on the tile
  function snapRot(r) {
    // Snap to the nearest 90°, wrap into [-PI, PI). Keeps floating-point
    // drift from accumulating across many arrow presses and guarantees the
    // committed rotation matches one of four cardinal facings.
    const step = Math.PI / 2;
    let v = Math.round(r / step) * step;
    while (v >  Math.PI) v -= 2 * Math.PI;
    while (v <= -Math.PI) v += 2 * Math.PI;
    return v;
  }

  function ghostToolSignature(tool) {
    if (!tool || tool.erase || tool.auto || tool.mooring) return null;
    const v = tool.activeVariant;
    return tool.id + '|' + (v ? v.id : '') + '|' + (tool.kind || tool.terrain || '') + '|' + (tool.voxelBuildId || '');
  }

  // Animated blue "hologram" material: translucent blue body, fresnel rim glow
  // at silhouette edges, and scrolling horizontal scanlines + a faint flicker
  // driven by uTime (updated per-frame from the animation loop via tickGhostHolo).
  // Faint translucent holographic BODY: light blue, scrolling scanlines, gentle
  // flicker. Deliberately low-contrast — the thick blue line is the separate
  // inverted-hull outline below, not a darkening of the body.
  function makeGhostHoloMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x6fb6ff) },
        uBase:  { value: 0.10 },
        uTime:  { value: 0 },
      },
      vertexShader: [
        'varying float vWY;',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position, 1.0);',
        '  vWY = wp.y;',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor;',
        'uniform float uBase;',
        'uniform float uTime;',
        'varying float vWY;',
        'void main(){',
        '  float s = sin(vWY * 42.0 - uTime * 5.0) * 0.5 + 0.5;',
        '  float scan = mix(0.55, 1.0, s);',
        '  float flicker = 0.9 + 0.1 * sin(uTime * 2.3);',
        '  float a = uBase * scan * flicker;',
        '  gl_FragColor = vec4(uColor * (0.92 + 0.18 * scan), clamp(a, 0.0, 0.5));',
        '}',
      ].join('\n'),
      transparent: true,
      // Writes depth (front faces only) so the inverted-hull outline below is
      // occluded everywhere except its protruding rim → a thin line, not a fill.
      depthWrite: true,
      side: THREE.FrontSide,
    });
  }

  // Thick blue silhouette outline — inverted hull (BackSide, scaled up), same
  // technique as the selection outline. This is the "blue line" around the ghost.
  // Fresh per build so a fading placement echo can't dim the live ghost's line.
  function makeGhostOutlineMaterial() {
    return new THREE.MeshBasicMaterial({
      color: 0x2f8fff,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      depthTest: true,
    });
  }
  const GHOST_OUTLINE_SCALE = 1.12;

  // Placement "phase-in": on commit we release the live ghost as a fading echo
  // (holo → gone over ECHO_DUR) while the real object drops in underneath.
  const ghostEchoes = [];
  const ECHO_DUR = 0.4;

  function releaseGhostPlacementEcho() {
    if (!ghostPreview || !ghostPreview.visible) return;
    const body = ghostPreview.userData.ghostHoloMaterial || null;
    const outline = ghostPreview.userData.ghostOutlineMaterial || null;
    ghostEchoes.push({
      obj: ghostPreview,
      body, outline,
      baseBase: body ? body.uniforms.uBase.value : 0.1,
      baseOpacity: outline ? outline.opacity : 0.9,
      t0: null,
    });
    // Hand the mesh off to the echo list and build a fresh ghost for next hover.
    ghostPreview = null;
    ghostPreviewKey = null;
    ensureGhostPreview();
    if (ghostPreview) ghostPreview.visible = false;
  }

  // Advance the scanline scroll/flicker (live ghost) + fade any placement
  // echoes; called once per frame from animate() with t in seconds.
  function tickGhostHolo(t) {
    const m = ghostPreview && ghostPreview.visible && ghostPreview.userData.ghostHoloMaterial;
    if (m && m.uniforms && m.uniforms.uTime) m.uniforms.uTime.value = t;
    for (let i = ghostEchoes.length - 1; i >= 0; i--) {
      const e = ghostEchoes[i];
      if (e.t0 == null) e.t0 = t;
      const k = (t - e.t0) / ECHO_DUR;
      if (k >= 1) {
        if (e.obj.parent) e.obj.parent.remove(e.obj);
        disposeGroup(e.obj);
        ghostEchoes.splice(i, 1);
        continue;
      }
      const fade = 1 - k;
      if (e.body && e.body.uniforms) {
        e.body.uniforms.uBase.value = e.baseBase * fade;
        e.body.uniforms.uTime.value = t;
      }
      if (e.outline) e.outline.opacity = e.baseOpacity * fade;
    }
  }

  // Kinds whose final look depends on neighbours (so the ghost previews the
  // *merged* result: house clusters, joined rocks, connected fences / castle
  // walls, oriented bridges).
  const GHOST_MERGE_KINDS = { house: 1, rock: 1, fence: 1, bridge: 1 };

  function ghostHoverGrid() {
    if (!currentHover) return null;
    const hx = currentHover.x + (currentHover.boardX || 0) * GRID;
    const hz = currentHover.z + (currentHover.boardZ || 0) * GRID;
    if (!Number.isFinite(hx) || !Number.isFinite(hz)) return null;
    return { hx, hz };
  }

  // Signature of the hover neighbourhood for merge tools — when it changes we
  // rebuild the ghost so the merged shape stays accurate as the cursor moves.
  function ghostMergeContext(tool) {
    if (!tool || !GHOST_MERGE_KINDS[tool.kind]) return '';
    const g = ghostHoverGrid();
    if (!g) return 'nh';
    let s = g.hx + ',' + g.hz;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const c = getWorldCell(g.hx + dx, g.hz + dz);
        s += (c && c.kind) ? c.kind[0] : '.';
      }
    }
    if (tool.kind === 'fence' && typeof fenceSideFromHover === 'function') s += '|' + fenceSideFromHover(currentHover);
    return s;
  }

  // Build the would-be cell for a placement, matching applyTool's data.
  function wouldBeCellForTool(tool, existing) {
    const terrain = (existing && existing.terrain) || 'grass';
    const terrainFloors = existing
      ? (typeof terrainLevelForCell === 'function' ? terrainLevelForCell(existing) : (existing.terrainFloors || 1))
      : 1;
    const base = { terrain, terrainFloors, kind: null, floors: 1, buildingType: null, fenceSide: null, extras: [] };
    if (tool.kind === 'house') {
      const v = tool.activeVariant;
      return Object.assign(base, { kind: 'house', buildingType: (v && v.buildingType) || null, floors: 1 });
    }
    if (tool.kind === 'rock') return Object.assign(base, { kind: 'rock', floors: 1 });
    if (tool.kind === 'fence') {
      const side = (typeof fenceSideFromHover === 'function') ? fenceSideFromHover(currentHover) : 'n';
      const lvl = (typeof fenceLevelFromSelectedTool === 'function') ? fenceLevelFromSelectedTool() : 1;
      const appearance = typeof fenceAppearanceFromSelectedTool === 'function' ? fenceAppearanceFromSelectedTool() : null;
      return Object.assign(base, { kind: 'fence', fenceSide: side, floors: lvl, appearance });
    }
    if (tool.kind === 'bridge') return Object.assign(base, { terrain: 'water', kind: 'bridge', floors: 1 });
    return null;
  }

  // Temporarily inject the would-be cell into the world, build the object with
  // the same neighbour-aware makers the real renderer uses, restore the world,
  // and offset multi-cell house clusters to their anchor. Returns the raw mesh
  // (holo material applied by buildGhostMesh) or null to fall back to standalone.
  function buildMergedGhostObject(tool) {
    if (!tool || !GHOST_MERGE_KINDS[tool.kind]) return null;
    const g = ghostHoverGrid();
    if (!g) return null;
    const { hx, hz } = g;
    const hadRow = !!world[hx];
    const prev = hadRow ? world[hx][hz] : undefined;
    const wouldBe = wouldBeCellForTool(tool, prev || null);
    if (!wouldBe) return null;
    if (!world[hx]) world[hx] = [];
    world[hx][hz] = wouldBe;
    let mesh = null, posX = null, posZ = null;
    try {
      const cell = wouldBe, level = cell.floors || 1, kind = cell.kind;
      if (kind === 'rock') {
        mesh = makeRock(getRockNeighbors(hx, hz), level, hx, hz, cell.terrain === 'water');
      } else if (kind === 'bridge') {
        mesh = makeBridge(getBridgeOrientation(hx, hz), level);
      } else if (kind === 'fence') {
        if (cell.terrain === 'path') {
          const pn = getPathNeighbors(hx, hz);
          const axis = (pn.e || pn.w) ? 'x' : (pn.n || pn.s) ? 'z' : 'x';
          mesh = makeRoadGate(normalizeFenceSide(cell.fenceSide), level, axis);
        } else {
          mesh = isCastleFence(hx, hz)
            ? makeCastleWallSegment(getCastleWallNeighbors(hx, hz))
            : makeFence(normalizeFenceSide(cell.fenceSide), level, typeof fenceStyleForCell === 'function' ? fenceStyleForCell(cell) : 'wood');
        }
      } else if (kind === 'house') {
        const floors = cell.floors || 1, bType = cell.buildingType || null;
        if (bType === 'skyscraper')   mesh = makeSkyscraper(Math.max(floors, 4));
        else if (bType === 'manor')   mesh = makeManor(floors);
        else if (bType === 'tower')   mesh = makeStoneTower(Math.max(floors, 2), towerPaletteWithAppearance(getMergedBuildingPalette(hx, hz, 'tower'), cell.appearance));
        else if (bType === 'turret')  mesh = makeTurret(floors);
        else {
          const cluster = findHouseCluster(hx, hz);
          if (cluster.kind === 'turret') mesh = makeTurret(floors);
          else if (cluster.kind === 'solo') mesh = makeHouse(floors);
          else if (cluster.kind === 'linear') {
            mesh = makeStretchedHouse(cluster.length, cluster.orientation, floors);
            const a = cellRenderPositionForCell(cluster.anchorX, cluster.anchorZ);
            posX = a.x; posZ = a.z;
            if (cluster.orientation === 'x') posX += (cluster.length - 1) * TILE / 2;
            else                              posZ += (cluster.length - 1) * TILE / 2;
          } else if (cluster.kind === 'composite') {
            mesh = buildCompositeHouse(cluster.topology, floors);
            const t = cluster.topology;
            posX = (t.bbox.xMin + t.bbox.xMax) / 2 - GRID / 2 + 0.5;
            posZ = (t.bbox.zMin + t.bbox.zMax) / 2 - GRID / 2 + 0.5;
          } else if (cluster.kind === 'square') {
            mesh = buildSquareHouse(floors);
            posX = (cluster.anchorX + 0.5) - GRID / 2 + 0.5;
            posZ = (cluster.anchorZ + 0.5) - GRID / 2 + 0.5;
          }
        }
      }
    } catch (_) { mesh = null; }
    finally {
      if (prev === undefined) { try { delete world[hx][hz]; } catch (_) {} }
      else world[hx][hz] = prev;
    }
    if (!mesh) return null;
    // Offset a multi-cell cluster so it sits at its anchor relative to the
    // hovered tile (the ghost group itself is positioned on the hover cell).
    if (posX !== null) {
      const hp = cellRenderPositionForCell(hx, hz);
      mesh.position.x += (posX - hp.x);
      mesh.position.z += (posZ - hp.z);
    }
    return mesh;
  }

  function buildGhostMesh(tool) {
    if (!tool || tool.erase || tool.auto) return null;
    const kind = tool.kind;
    // Merge-aware preview first (house clusters, rock/fence/bridge joins).
    let mesh = buildMergedGhostObject(tool);
    const isMerged = !!mesh;
    if (!mesh) {
    if      (kind === 'voxel-build') mesh = makeVoxelBuildStamp(tool.voxelBuildId);
    else if (kind === 'model-stamp') mesh = makeModelStamp(tool.modelStampId);
    else if (kind === 'tree')      mesh = makeTree();
    else if (kind === 'rock')      mesh = makeRock({ n: false, s: false, e: false, w: false }, 1, 0, 0);
    else if (kind === 'tuft')      mesh = makeTuft();
    else if (kind === 'flower')    mesh = makeFlower();
    else if (kind === 'bush')      mesh = makeBush();
    else if (kind === 'cow')       mesh = makeCow();
    else if (kind === 'sheep')     mesh = makeSheep();
    else if (kind === 'crop')      mesh = makeCrop();
    else if (kind === 'corn')      mesh = makeCorn();
    else if (kind === 'wheat')     mesh = makeWheat();
    else if (kind === 'pumpkin')   mesh = makePumpkin();
    else if (kind === 'carrot')    mesh = makeCarrot();
    else if (kind === 'sunflower') mesh = makeSunflower();
    else if (kind === 'bridge')    mesh = makeBridge('x');
    else if (kind === 'fence') {
      const v = tool.activeVariant;
      const side = (v && v.fenceSide && v.fenceSide !== 'auto') ? v.fenceSide : 'n';
      const level = Math.max(1, Math.min(MAX_FLOORS, (v && v.floors) || 1));
      const style = typeof normalizeFenceStyle === 'function' ? normalizeFenceStyle(v && v.fenceStyle) : 'wood';
      mesh = makeFence(normalizeFenceSide(side), level, style);
    } else if (kind === 'house') {
      const v = tool.activeVariant;
      const bt = v && v.buildingType;
      if      (bt === 'manor')      mesh = makeManor(1);
      else if (bt === 'tower')      mesh = makeStoneTower(2);
      else if (bt === 'turret')     mesh = makeTurret(1);
      else if (bt === 'skyscraper') mesh = makeSkyscraper(4);
      else                          mesh = makeHouse(1);
    } else if (tool.terrain) {
      // For pure terrain tools, show a thin coloured swatch hovering
      // just above the tile so the user can still see what they'd paint.
      const matMap = { grass: M.grass, dirt: M.dirtRich, path: M.path, water: M.water };
      const mat = matMap[tool.terrain] || M.grass;
      const swatch = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.04, 0.88), mat);
      swatch.position.y = 0.02;
      mesh = new THREE.Group();
      mesh.add(swatch);
    } else if (tool.island) {
      // Whole-island placement hologram (snaps to an 8-grid slot via setHoverFromCell).
      mesh = makeBlankIsland();
    }
    } // end standalone build (skipped when a merged mesh was produced)
    if (!mesh) return null;
    if (!isMerged && kind === 'model-stamp' && tool.modelStampId) {
      const cfg = getModelStampSettings(tool.modelStampId);
      if (cfg.objectScale !== 1) mesh.scale.multiplyScalar(cfg.objectScale);
      if (cfg.offsetY) mesh.position.y += cfg.offsetY;
    }
    // Blue holographic look: swap every mesh material for one shared fresnel
    // holo material (so the rim glow is consistent across the whole preview)
    // and drop shadows. We don't keep the real materials — the ghost reads as
    // a projection, then phases into real colours on placement.
    const holo = makeGhostHoloMaterial();
    const outlineMat = makeGhostOutlineMaterial();
    const meshNodes = [];
    mesh.traverse(o => { if (o.isMesh) meshNodes.push(o); });
    meshNodes.forEach(o => {
      o.material = holo;
      o.castShadow = false;
      o.receiveShadow = false;
      o.renderOrder = 3;
      // Thick blue outline: a back-faced, scaled-up hull of the same geometry.
      if (o.geometry) {
        const hull = new THREE.Mesh(o.geometry, outlineMat);
        hull.userData.sharedGeometry = true;  // teardown must not dispose shared geom
        hull.scale.setScalar(GHOST_OUTLINE_SCALE);
        hull.castShadow = false;
        hull.receiveShadow = false;
        hull.renderOrder = 4;  // after the body (3) so body depth occludes the fill
        o.add(hull);
      }
    });
    mesh.userData.ghostPreview = true;
    mesh.userData.ghostHoloMaterial = holo;
    mesh.userData.ghostOutlineMaterial = outlineMat;
    mesh.userData.mergedPreview = isMerged;
    return mesh;
  }

  function ensureGhostPreview() {
    const sig = ghostToolSignature(selectedTool);
    // Merge-aware tools rebuild as the hovered neighbourhood changes so the
    // previewed merged shape stays accurate.
    const fullSig = sig == null ? null : (sig + '::' + ghostMergeContext(selectedTool));
    if (fullSig === ghostPreviewKey && ghostPreview) return;
    if (ghostPreview) {
      if (ghostPreview.parent) ghostPreview.parent.remove(ghostPreview);
      disposeGroup(ghostPreview);
      ghostPreview = null;
    }
    ghostPreviewKey = fullSig;
    if (sig == null) return;
    ghostPreview = buildGhostMesh(selectedTool);
    if (ghostPreview) {
      ghostPreview.visible = false;
      xrWorldRoot.add(ghostPreview);
    }
  }

  function updateGhostPlacement() {
    // Rebuild if the tool or hovered neighbourhood changed (keeps the merged
    // preview accurate as the cursor moves between tiles).
    ensureGhostPreview();
    if (!ghostPreview) return;
    if (!currentHover) { ghostPreview.visible = false; return; }
    ghostPreview.visible = true;
    const baseY = hoverHeightForCell(currentHover) - 0.02;
    // A merged preview is already positioned at its cluster anchor + auto-
    // oriented, so skip the within-tile nudge and manual rotation for it.
    const merged = !!ghostPreview.userData.mergedPreview;
    const ox = merged ? 0 : ghostOffsetX;
    const oz = merged ? 0 : ghostOffsetZ;
    ghostPreview.position.set(
      currentHover.worldX + ox,
      baseY + 0.01,
      currentHover.worldZ + oz
    );
    // Always render the preview at the snapped angle so it matches the
    // rotation that consumeGhostTransform will commit on click.
    const defaultModelRot = selectedTool && selectedTool.kind === 'model-stamp' && selectedTool.modelStampId
      ? getModelStampSettings(selectedTool.modelStampId).rotationY
      : 0;
    ghostPreview.rotation.y = merged ? 0 : (defaultModelRot + snapRot(ghostRotation));
  }

  function resetGhostTransform() {
    ghostRotation = 0;
    ghostOffsetX = 0;
    ghostOffsetZ = 0;
    updateGhostPlacement();
  }

  // -------- raycaster --------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickRaycastRoots = [];

  function isPointerPickExcludedRoot(object) {
    return !!(
      object && (
        object === planetLandscapeGroup ||
        object === planetAtmosphereGroup ||
        (object.userData && object.userData.noPointerPick)
      )
    );
  }

  function getPickRaycastRoots() {
    pickRaycastRoots.length = 0;
    for (const child of worldGroup.children) {
      if (!isPointerPickExcludedRoot(child)) pickRaycastRoots.push(child);
    }
    return pickRaycastRoots;
  }

  function floorDiv(a, b) {
    return Math.floor(a / b);
  }

  function positiveMod(a, b) {
    return ((a % b) + b) % b;
  }

  const landscapePickPoint = new THREE.Vector3();
  const landscapePickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  function isLandscapeMeshHit(object) {
    if (!landscapeMeshGroup || !object) return false;
    let n = object;
    while (n) {
      if (n === landscapeMeshGroup) return true;
      n = n.parent;
    }
    return false;
  }

  function projectedLandscapeHitFromPoint(point) {
    landscapePickPoint.copy(point);
    xrWorldRoot.worldToLocal(landscapePickPoint);
    const gx = Math.floor(landscapePickPoint.x + GRID / 2);
    const gz = Math.floor(landscapePickPoint.z + GRID / 2);
    if (!renderAutoExpand && (gx < 0 || gx >= GRID || gz < 0 || gz >= GRID)) return null;
    const boardX = floorDiv(gx, GRID);
    const boardZ = floorDiv(gz, GRID);
    const x = positiveMod(gx, GRID);
    const z = positiveMod(gz, GRID);
    const p = (boardX || boardZ) ? ghostCellPos(boardX, boardZ, x, z) : tilePos(x, z);
    return {
      x,
      z,
      boardX,
      boardZ,
      worldX: p.x,
      worldZ: p.z,
      localX: landscapePickPoint.x - p.x,
      localZ: landscapePickPoint.z - p.z,
    };
  }

  function pickLandscapeVirtualCell() {
    if (!isLandscapeMeshActive()) return null;
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(landscapePickPlane, point)) return null;
    return projectedLandscapeHitFromPoint(point);
  }

  function resolveRaycastCell(h) {
    const localHitPoint = h.point.clone();
    xrWorldRoot.worldToLocal(localHitPoint);

    let n = h.object;
    if (n && n.userData && n.userData.ghostMerged) {
      const board = n.parent;
      if (board && board.userData && board.userData.ghostBoard) {
        if (!board.visible) return null;
        const boardX = board.userData.boardX;
        const boardZ = board.userData.boardZ;
        const gx = Math.floor(localHitPoint.x - boardX * GRID + GRID / 2);
        const gz = Math.floor(localHitPoint.z - boardZ * GRID + GRID / 2);
        if (gx >= 0 && gx < GRID && gz >= 0 && gz < GRID) {
          const p = ghostCellPos(boardX, boardZ, gx, gz);
          return {
            x: gx,
            z: gz,
            boardX,
            boardZ,
            worldX: p.x,
            worldZ: p.z,
            localX: localHitPoint.x - p.x,
            localZ: localHitPoint.z - p.z,
          };
        }
      }
    }

    let surfaceNode = h.object;
    while (surfaceNode && !(surfaceNode.userData && surfaceNode.userData.editableIslandSurface)) surfaceNode = surfaceNode.parent;
    if (surfaceNode && surfaceNode.userData) {
      const island = editableIslandById.get(surfaceNode.userData.editableIslandId);
      if (island && island.contentGroup && island.group && island.group.visible) {
        const local = h.point.clone();
        island.contentGroup.worldToLocal(local);
        const gx = Math.floor(local.x + GRID / 2);
        const gz = Math.floor(local.z + GRID / 2);
        if (gx >= 0 && gx < GRID && gz >= 0 && gz < GRID) {
          const p = editableIslandCellDisplayPoint(island, gx, gz);
          const pLocal = tilePos(gx, gz);
          return {
            x: gx,
            z: gz,
            boardX: island.boardX,
            boardZ: island.boardZ,
            editableIslandId: island.id,
            worldX: p.x,
            worldY: p.y,
            worldZ: p.z,
            localX: local.x - pLocal.x,
            localZ: local.z - pLocal.z,
          };
        }
      }
    }

    // Merged terrain-bake meshes carry no gx/gz userData. Derive the cell from
    // the world-space hit point — same approach as the landscape virtual-cell path.
    let bakeMeshNode = h.object;
    while (bakeMeshNode && !(bakeMeshNode.userData && bakeMeshNode.userData.homeTerrainBake)) {
      bakeMeshNode = bakeMeshNode.parent;
    }
    if (bakeMeshNode && bakeMeshNode.userData && bakeMeshNode.userData.homeTerrainBake) {
      const gx = Math.floor(localHitPoint.x + GRID / 2);
      const gz = Math.floor(localHitPoint.z + GRID / 2);
      if (gx >= 0 && gx < GRID && gz >= 0 && gz < GRID) {
        const p = tilePos(gx, gz);
        return {
          x: gx,
          z: gz,
          boardX: 0,
          boardZ: 0,
          worldX: p.x,
          worldZ: p.z,
          localX: localHitPoint.x - p.x,
          localZ: localHitPoint.z - p.z,
        };
      }
    }

    while (n && n.userData.gx === undefined) n = n.parent;
    if (n && n.userData.gx !== undefined) {
      if (!n.visible) return null;
      const boardX = n.userData.boardX || 0;
      const boardZ = n.userData.boardZ || 0;
      const island = n.userData.editableIslandId ? editableIslandById.get(n.userData.editableIslandId) : null;
      if (island) {
        const local = h.point.clone();
        island.contentGroup.worldToLocal(local);
        const pLocal = tilePos(n.userData.gx, n.userData.gz);
        const p = editableIslandCellDisplayPoint(island, n.userData.gx, n.userData.gz);
        return {
          x: n.userData.gx,
          z: n.userData.gz,
          boardX,
          boardZ,
          editableIslandId: island.id,
          worldX: p.x,
          worldY: p.y,
          worldZ: p.z,
          localX: local.x - pLocal.x,
          localZ: local.z - pLocal.z,
        };
      }
      const p = (boardX || boardZ)
        ? ghostCellPos(boardX, boardZ, n.userData.gx, n.userData.gz)
        : tilePos(n.userData.gx, n.userData.gz);
      return {
        x: n.userData.gx,
        z: n.userData.gz,
        boardX,
        boardZ,
        worldX: p.x,
        worldZ: p.z,
        localX: localHitPoint.x - p.x,
        localZ: localHitPoint.z - p.z,
      };
    }
    return null;
  }

  function resolveRaycastEditableIslandEngine(h) {
    let n = h && h.object;
    while (n && !(n.userData && n.userData.editableIslandEngineId)) n = n.parent;
    if (!n || !n.userData || !n.userData.editableIslandEngineId) return null;
    return editableIslandEngineTarget(n.userData.editableIslandId, n.userData.editableIslandEngineId);
  }

  function resolveRaycastEditableIslandPyramid(h) {
    let n = h && h.object;
    while (n && !(n.userData && n.userData.editableIslandPyramidId)) n = n.parent;
    if (!n || !n.userData || !n.userData.editableIslandPyramidId) return null;
    return (typeof editableIslandPyramidTarget === 'function')
      ? editableIslandPyramidTarget(n.userData.editableIslandId, n.userData.editableIslandPyramidId)
      : null;
  }

  // Resolve the whole sky-island under the cursor (its base/side or surface),
  // walking up to the group that carries editableIslandId. Excludes the home
  // island. Used to select an island by clicking its side.
  function resolveRaycastEditableIslandBody(h) {
    let n = h && h.object;
    while (n) {
      if (n.userData && n.userData.editableIslandId && typeof editableIslandById !== 'undefined') {
        const isl = editableIslandById.get(n.userData.editableIslandId);
        if (isl && !isl.__home) return isl;
        return null;
      }
      n = n.parent;
    }
    return null;
  }
  // Resolve a Select-tool click by the CLOSEST surface: a top tile -> { kind:
  // 'cell' } (single-cell select); the island's side/base/underside -> { kind:
  // 'island' } (whole-island select). pickTile alone can't tell these apart
  // because the ray sees through the side and hits the top tile behind it.
  function resolveIslandClick(clientX, clientY) {
    ndc.x = (clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(getPickRaycastRoots(), true);
    for (const h of hits) {
      const cell = resolveRaycastCell(h);
      if (cell) return { kind: 'cell', cell };
      const isl = resolveRaycastEditableIslandBody(h);
      if (isl) return { kind: 'island', island: isl };
    }
    return null;
  }

  function pickEditableIslandBody(clientX, clientY) {
    ndc.x = (clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(getPickRaycastRoots(), true);
    for (const h of hits) {
      const isl = resolveRaycastEditableIslandBody(h);
      if (isl) return isl;
    }
    return null;
  }

  function pickEditableIslandEngine(clientX, clientY) {
    // Engines hang under the island, so they can only be selected from
    // underneath: refuse engine picks unless the camera is below the playable
    // surface (looking up at the underside). Otherwise a ray from above passes
    // through the board and grabs the engine behind it.
    if (camera.position.y >= 0) return null;
    ndc.x = (clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(getPickRaycastRoots(), true);
    for (const h of hits) {
      const target = resolveRaycastEditableIslandEngine(h);
      if (target) return target;
    }
    return null;
  }

  function pickEditableIslandPyramid(clientX, clientY) {
    // The pyramid hangs under the island, so (like engines) it is only pickable
    // from below — refuse picks unless the camera is under the playable surface.
    if (camera.position.y >= 0) return null;
    ndc.x = (clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(getPickRaycastRoots(), true);
    for (const h of hits) {
      const target = resolveRaycastEditableIslandPyramid(h);
      if (target) return target;
    }
    return null;
  }

  function pickTile(clientX, clientY) {
    // If the camera is below the playable surface (i.e. looking up at the
    // underside of the island), refuse all picks. Clicking on tops of cells
    // from below feels like the click is "going through" the island.
    if (camera.position.y < 0) return null;
    ndc.x = (clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(getPickRaycastRoots(), true);
    let landscapeHit = null;
    for (const h of hits) {
      if (!landscapeHit && isLandscapeMeshHit(h.object)) {
        landscapeHit = projectedLandscapeHitFromPoint(h.point);
      }
      const cellHit = resolveRaycastCell(h);
      if (cellHit) {
        // Only accept hits whose surface FACES the camera. If the ray is
        // travelling upward, the camera is below the island looking up — so a
        // top-surface tile is being hit on the BACK of its top face (the click
        // is passing through the island) and an underside face is its own
        // surface. Reject both: you can never select top tiles from below.
        if (h.face && h.face.normal && raycaster.ray.direction.y > 0) {
          // World-space normal Y: top faces have normal.y > 0, undersides < 0.
          const obj = h.object;
          const nWorld = h.face.normal.clone().transformDirection(obj.matrixWorld);
          if (nWorld.y > 0.2 || nWorld.y < -0.2) continue;
        }
        return cellHit;
      }
    }
    return landscapeHit || pickLandscapeVirtualCell();
  }

  function hoverHeightForCell(cell) {
    // Island-placement hologram carries its own float height (the slot's group Y).
    if (cell && cell.__islandSlotY !== undefined) return cell.__islandSlotY;
    if (cell && cell.editableIslandId) {
      const gx = cell.x + (cell.boardX || 0) * GRID;
      const gz = cell.z + (cell.boardZ || 0) * GRID;
      const intent = getWorldCell(gx, gz);
      return (cell.worldY || 0) + TOP_H + terrainVisualRiseForCell(intent) + 0.02;
    }
    if (!(cell.boardX || cell.boardZ) && window.__tinyworldMeshTerrain && typeof window.__tinyworldMeshTerrain.anchorForCell === 'function') {
      const s = window.__tinyworldMeshTerrain.anchorForCell(cell.x, cell.z, { radius: 0.25 });
      if (s && Number.isFinite(s.y)) return s.y + 0.02;
    }
    if (isLandscapeMeshActive()) {
      return landscapeHeightAtCell(
        cell.x + (cell.boardX || 0) * GRID,
        cell.z + (cell.boardZ || 0) * GRID
      ) + 0.02;
    }
    if (cell.boardX || cell.boardZ) {
      if (isEditableIslandBoard(cell.boardX, cell.boardZ)) {
        const gx = cell.x + cell.boardX * GRID;
        const gz = cell.z + cell.boardZ * GRID;
        return TOP_H + terrainVisualRiseForCell(getWorldCell(gx, gz)) + 0.02;
      }
      const cells = makeGhostWorld(cell.boardX, cell.boardZ);
      return TOP_H + terrainVisualRiseForCell(cells[cell.x][cell.z]) + 0.02;
    }
    return TOP_H + terrainRiseAt(cell.x, cell.z) + 0.02;
  }

  function syncHoverVisibility() {
    if (!currentHover) return;
    if (currentHover.editableIslandId) return;
    if (opacityAtWorldPosition(currentHover.worldX, currentHover.worldZ) > 0.001) return;
    hoverMesh.visible = false;
    currentHover = null;
  }

  // -------- WebXR modes --------
  const xrStatusEl = document.getElementById('xr-status');
  const xrQuickLookBtn = document.getElementById('xr-quicklook');
  let xrStatusHideTimer = null;
  let xrQuickLookBusy = false;
  const xrButtons = {
    surface: document.getElementById('xr-surface'),
    float: document.getElementById('xr-float'),
    inside: document.getElementById('xr-inside'),
  };
  const xrBoardScale = {
    surface: () => Math.max(0.012, Math.min(0.09, 0.72 / Math.max(1, GRID))),
    float: () => Math.max(0.018, Math.min(0.14, 1.1 / Math.max(1, GRID))),
    inside: () => 1,
  };
  const xrControllerRay = new THREE.Ray();
  const xrControllerDir = new THREE.Vector3();
  const xrControllerPos = new THREE.Vector3();
  const xrLocalPoint = new THREE.Vector3();
  const xrForward = new THREE.Vector3();
  const xrPosePos = new THREE.Vector3();
  const xrPoseQuat = new THREE.Quaternion();
  const xrPoseScale = new THREE.Vector3();
  let xrMode = null;
  let xrSession = null;
  let xrHitTestSource = null;
  let xrHitTestSourceRequested = false;
  let xrReticleHit = null;
  let xrAnchor = null;
  let xrBoardPlaced = true;
  let xrWasShowcase = false;

  const xrReticle = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.105, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x3a72c8, transparent: true, opacity: 0.88 })
  );
  xrReticle.name = 'xr-placement-reticle';
  xrReticle.matrixAutoUpdate = false;
  xrReticle.visible = false;
  scene.add(xrReticle);

  function setXRStatus(message) {
    if (!xrStatusEl) return;
    if (xrStatusHideTimer) { clearTimeout(xrStatusHideTimer); xrStatusHideTimer = null; }
    if (!message) {
      xrStatusEl.textContent = '';
      xrStatusEl.hidden = true;
      return;
    }
    xrStatusEl.textContent = message;
    xrStatusEl.hidden = false;
    // While an immersive session is live, status doubles as in-headset
    // guidance and must stay put. Outside a session (desktop hint, iOS AR
    // Quick Look progress, errors) auto-dismiss so it doesn't linger.
    if (!xrSession) {
      xrStatusHideTimer = setTimeout(() => {
        xrStatusEl.hidden = true;
        xrStatusEl.textContent = '';
        xrStatusHideTimer = null;
      }, 7000);
    }
  }

  function setXRButtonsDisabled(disabled) {
    Object.keys(xrButtons).forEach(k => {
      if (xrButtons[k]) xrButtons[k].disabled = !!disabled;
    });
  }

  function resetXRWorldTransform() {
    xrWorldRoot.visible = true;
    xrWorldRoot.position.set(0, 0, 0);
    xrWorldRoot.quaternion.identity();
    xrWorldRoot.scale.set(1, 1, 1);
    xrWorldRoot.updateMatrixWorld(true);
    xrBoardPlaced = true;
  }

  function setXRRootFromPose(position, quaternion, scale) {
    xrWorldRoot.visible = true;
    xrWorldRoot.position.copy(position);
    xrWorldRoot.quaternion.copy(quaternion);
    xrWorldRoot.scale.setScalar(scale);
    xrWorldRoot.updateMatrixWorld(true);
    xrBoardPlaced = true;
  }

  function placeXRBoardAtReticle() {
    if (!xrReticle.visible) return false;
    xrReticle.matrix.decompose(xrPosePos, xrPoseQuat, xrPoseScale);
    setXRRootFromPose(xrPosePos, xrPoseQuat, xrBoardScale.surface());
    xrReticle.visible = false;
    setXRStatus('Board anchored. Aim/select a tile to edit it, or end XR from the headset menu.');
    if (xrReticleHit && xrReticleHit.createAnchor) {
      xrReticleHit.createAnchor().then(anchor => {
        xrAnchor = anchor;
      }).catch(() => {
        xrAnchor = null;
      });
    }
    return true;
  }

  function placeXRFloatingBoard() {
    camera.updateMatrixWorld(true);
    camera.getWorldPosition(xrPosePos);
    camera.getWorldDirection(xrForward);
    xrForward.normalize();
    xrPosePos.addScaledVector(xrForward, 1.35);
    if (xrMode === 'float') xrPosePos.y -= 0.32;
    const yaw = Math.atan2(xrForward.x, xrForward.z);
    xrPoseQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    setXRRootFromPose(xrPosePos, xrPoseQuat, xrBoardScale.float());
    setXRStatus('Tiny World is floating. Aim/select tiles with your controller or hand ray.');
  }

  function placeXRInsideWorld() {
    xrWorldRoot.visible = true;
    xrWorldRoot.position.set(0, 0, 0);
    xrWorldRoot.quaternion.identity();
    xrWorldRoot.scale.setScalar(xrBoardScale.inside());
    xrWorldRoot.updateMatrixWorld(true);
    xrBoardPlaced = true;
    setXRStatus('You are inside the environment. Walk/turn naturally; aim/select tiles to edit.');
  }

  function pickTileFromXRController(controller) {
    if (!controller) return null;
    controller.updateMatrixWorld(true);
    xrControllerPos.setFromMatrixPosition(controller.matrixWorld);
    xrControllerDir.set(0, 0, -1).transformDirection(controller.matrixWorld).normalize();
    xrControllerRay.origin.copy(xrControllerPos);
    xrControllerRay.direction.copy(xrControllerDir);
    raycaster.ray.copy(xrControllerRay);
    const hits = raycaster.intersectObjects(getPickRaycastRoots(), true);
    let landscapeHit = null;
    for (const h of hits) {
      if (!landscapeHit && isLandscapeMeshHit(h.object)) {
        landscapeHit = projectedLandscapeHitFromPoint(h.point);
      }
      const cellHit = resolveRaycastCell(h);
      if (cellHit) return cellHit;
    }
    return landscapeHit;
  }

  function updateXRControllerHover() {
    if (!xrSession || !xrBoardPlaced) return;
    const hit = pickTileFromXRController(renderer.xr.getController(0))
      || pickTileFromXRController(renderer.xr.getController(1));
    if (hit) {
      currentHover = hit;
      hoverMesh.position.set(hit.worldX, hoverHeightForCell(hit), hit.worldZ);
      hoverMesh.visible = true;
    } else {
      currentHover = null;
      hoverMesh.visible = false;
    }
    updateGhostPlacement();
  }

  function onXRSelect(event) {
    if (!xrSession) return;
    if (xrMode === 'surface' && !xrBoardPlaced) {
      placeXRBoardAtReticle();
      return;
    }
    if (xrMode === 'float' && !xrBoardPlaced) {
      placeXRFloatingBoard();
      return;
    }
    const hit = pickTileFromXRController(event.target) || currentHover;
    if (!hit || (selectedTool && selectedTool.select)) return;
    currentHover = hit;
    applyToolToCell(hit);
    hoverMesh.position.set(hit.worldX, hoverHeightForCell(hit), hit.worldZ);
    hoverMesh.visible = true;
    updateGhostPlacement();
  }

  const xrControllers = [renderer.xr.getController(0), renderer.xr.getController(1)];
  xrControllers.forEach(controller => {
    controller.addEventListener('select', onXRSelect);
    scene.add(controller);
  });

  async function isXRSupported(mode) {
    if (!navigator.xr || !navigator.xr.isSessionSupported) return false;
    try { return await navigator.xr.isSessionSupported(mode); }
    catch (_) { return false; }
  }

  async function preferredFloatingSessionMode() {
    if (await isXRSupported('immersive-ar')) return 'immersive-ar';
    if (await isXRSupported('immersive-vr')) return 'immersive-vr';
    return null;
  }

  function sessionInitForXRMode(mode, sessionMode) {
    if (mode === 'surface') {
      return {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['anchors', 'dom-overlay', 'local-floor'],
        domOverlay: { root: document.body },
      };
    }
    const optionalFeatures = ['local-floor', 'bounded-floor', 'hand-tracking', 'dom-overlay'];
    return sessionMode === 'immersive-ar'
      ? { optionalFeatures, domOverlay: { root: document.body } }
      : { optionalFeatures };
  }

  async function startXRMode(mode) {
    if (!navigator.xr || !navigator.xr.requestSession) {
      setXRStatus('WebXR is not available here. Use HTTPS and a WebXR headset browser.');
      return;
    }
    if (xrSession) {
      try { await xrSession.end(); } catch (_) {}
    }
    const sessionMode = mode === 'surface'
      ? 'immersive-ar'
      : (mode === 'inside' ? 'immersive-vr' : await preferredFloatingSessionMode());
    if (!sessionMode || !(await isXRSupported(sessionMode))) {
      setXRStatus(mode === 'inside' ? 'Immersive VR is not supported on this device.' : 'Immersive AR/VR is not supported on this device.');
      return;
    }
    setXRButtonsDisabled(true);
    setXRStatus('Starting XR…');
    try {
      renderer.xr.setReferenceSpaceType(mode === 'inside' ? 'local-floor' : 'local');
      const session = await navigator.xr.requestSession(sessionMode, sessionInitForXRMode(mode, sessionMode));
      await renderer.xr.setSession(session);
      xrMode = mode;
      xrSession = session;
      xrHitTestSource = null;
      xrHitTestSourceRequested = false;
      xrReticleHit = null;
      xrAnchor = null;
      xrWasShowcase = document.body.classList.contains('showcase');
      document.body.classList.add('xr-active');
      scene.background = sessionMode === 'immersive-ar' ? null : defaultSceneBackground.clone();
      applyDistanceMistSettings();
      if (mode === 'surface') {
        xrBoardPlaced = false;
        xrWorldRoot.visible = false;
        xrReticle.visible = false;
        setXRStatus('Look at a flat desk/table until the ring appears, then pinch/select to place the board.');
      } else if (mode === 'float') {
        xrBoardPlaced = false;
        xrWorldRoot.visible = false;
        setXRStatus('Pinch/select once to float the board in front of you.');
      } else {
        placeXRInsideWorld();
      }
      session.addEventListener('end', () => {
        xrSession = null;
        xrMode = null;
        xrHitTestSource = null;
        xrHitTestSourceRequested = false;
        xrReticleHit = null;
        xrAnchor = null;
        xrReticle.visible = false;
        scene.background = defaultSceneBackground.clone();
        applyDistanceMistSettings();
        document.body.classList.remove('xr-active');
        resetXRWorldTransform();
        setXRButtonsDisabled(false);
        setXRStatus('Exited XR. Use AR desk, Float, or Enter world to jump back in.');
        if (xrWasShowcase && !document.body.classList.contains('showcase')) {
          document.body.classList.add('showcase');
        }
      });
    } catch (err) {
      console.error('WebXR start failed:', err);
      resetXRWorldTransform();
      xrReticle.visible = false;
      scene.background = defaultSceneBackground.clone();
      applyDistanceMistSettings();
      document.body.classList.remove('xr-active');
      setXRButtonsDisabled(false);
      setXRStatus('Could not start XR: ' + String(err && err.message ? err.message : err).slice(0, 120));
    }
  }

  function updateXRFrame(frame) {
    if (!xrSession || !frame) return;
    if (xrMode === 'surface' && xrAnchor && frame.trackedAnchors && frame.trackedAnchors.has(xrAnchor)) {
      const anchorPose = frame.getPose(xrAnchor.anchorSpace, renderer.xr.getReferenceSpace());
      if (anchorPose) {
        xrPosePos.set(
          anchorPose.transform.position.x,
          anchorPose.transform.position.y,
          anchorPose.transform.position.z
        );
        xrPoseQuat.set(
          anchorPose.transform.orientation.x,
          anchorPose.transform.orientation.y,
          anchorPose.transform.orientation.z,
          anchorPose.transform.orientation.w
        );
        setXRRootFromPose(xrPosePos, xrPoseQuat, xrBoardScale.surface());
      }
    }
    if (xrMode === 'surface' && !xrBoardPlaced && !xrHitTestSourceRequested) {
      const session = renderer.xr.getSession();
      if (session && session.requestReferenceSpace && session.requestHitTestSource) {
        session.requestReferenceSpace('viewer').then(referenceSpace => {
          session.requestHitTestSource({ space: referenceSpace }).then(source => {
            xrHitTestSource = source;
          }).catch(() => {
            setXRStatus('Hit-test was unavailable; try Float mode instead.');
          });
        });
        xrHitTestSourceRequested = true;
      }
    }
    if (xrMode === 'surface' && !xrBoardPlaced && xrHitTestSource) {
      const hitTestResults = frame.getHitTestResults(xrHitTestSource);
      if (hitTestResults.length) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(renderer.xr.getReferenceSpace());
        if (pose) {
          xrReticle.visible = true;
          xrReticle.matrix.fromArray(pose.transform.matrix);
          xrReticle.matrixWorldNeedsUpdate = true;
          xrReticleHit = hit;
        }
      } else {
        xrReticle.visible = false;
        xrReticleHit = null;
      }
    }
    updateXRControllerHover();
  }

  // -------- Apple AR Quick Look (iOS / iPadOS) --------
  // iOS Safari has no WebXR, so the WebXR surface/float/inside flow above never
  // runs on iPhone/iPad. Apple's only on-device web AR is AR Quick Look: open a
  // .usdz through an <a rel="ar"> and the system viewer finds a real surface,
  // drops the model on it, and lets the user walk around while it stays put —
  // exactly the "place the world on a surface and move around it" behaviour the
  // WebXR path gives Android/Quest. We build the USDZ from the live world on tap.
  const QUICKLOOK_TARGET_SIZE = 0.5; // metres for the longest horizontal edge at first placement

  function supportsARQuickLook() {
    // relList.supports('ar') is Safari's capability signal for AR Quick Look
    // (true on iOS/iPadOS, and on macOS Safari which previews the model).
    try {
      const a = document.createElement('a');
      return !!(a.relList && a.relList.supports && a.relList.supports('ar'));
    } catch (_) {
      return false;
    }
  }

  // USDZExporter only understands MeshStandardMaterial, and UsdPreviewSurface
  // connects diffuseColor *directly* to any texture (ignoring the base color it
  // is meant to multiply). TinyWorld paints flat-coloured Lambert materials and
  // then layers a grayscale detail/noise map on top, so exporting the maps would
  // wash every tinted surface (grass, paths, walls) to white. We therefore drop
  // maps and export the flat base colour, which also matches the low-poly look.
  // Colours are read once and cached so identical surfaces share one USD material.
  function averageVertexColor(geom) {
    const attr = geom && geom.attributes && geom.attributes.color;
    if (!attr || !attr.array || !attr.count) return null;
    const arr = attr.array, items = attr.itemSize || 3;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < attr.count; i++) {
      r += arr[i * items]; g += arr[i * items + 1]; b += arr[i * items + 2];
    }
    return new THREE.Color(r / attr.count, g / attr.count, b / attr.count);
  }

  function quickLookResolveColors(src, geom) {
    const base = Array.isArray(src) ? src[0] : src;
    let color = 0xffffff, emissive = 0x000000, opacity = 1, transparent = false;
    if (base) {
      if (base.vertexColors && geom) {
        // Vertex-coloured meshes (model stamps, some voxel builds) carry colour
        // in the geometry, not the material — average it so they aren't white.
        const avg = averageVertexColor(geom);
        if (avg) color = avg.getHex();
        else if (base.color && base.color.getHex) color = base.color.getHex();
      } else if (base.color && base.color.getHex) {
        color = base.color.getHex();
      } else if (base.uniforms) {
        // ShaderMaterials (water, sky): pull the first colour-valued uniform.
        const u = base.uniforms;
        const pick = (u.uColor && u.uColor.value) || (u.diffuse && u.diffuse.value) || (u.color && u.color.value);
        if (pick && pick.isColor) color = pick.getHex();
        else for (const k in u) { const v = u[k] && u[k].value; if (v && v.isColor) { color = v.getHex(); break; } }
      }
      if (base.emissive && base.emissive.getHex) emissive = base.emissive.getHex();
      if (typeof base.opacity === 'number') opacity = base.opacity;
      transparent = !!base.transparent;
    }
    return { color, emissive, opacity, transparent };
  }

  function quickLookStandardMaterial(src, geom, cache) {
    const { color, emissive, opacity, transparent } = quickLookResolveColors(src, geom);
    const key = color + '|' + emissive + '|' + opacity + '|' + (transparent ? 1 : 0);
    if (cache.has(key)) return cache.get(key);
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: emissive,
      roughness: 0.9,
      metalness: 0.0,
      transparent: transparent,
      opacity: opacity,
      // Double-sided so single-sided board/wall faces don't read as holes when
      // AR Quick Look's camera sees their back.
      side: THREE.DoubleSide,
    });
    cache.set(key, mat);
    return mat;
  }

  // Snapshot worldGroup into a fresh, self-contained group with USD-friendly
  // materials, expanding InstancedMeshes (batched voxel builds / crops / fences,
  // which the r128 exporter can't read) into individual meshes so nothing goes
  // missing. Then recentre on the origin (base at y=0) and scale to a tabletop
  // size. Source geometry is shared (not cloned) and never disposed; only the
  // temporary Standard materials are ours to free afterwards.
  const QUICKLOOK_MAX_MESHES = 24000; // safety cap so a huge world can't hang the export
  function buildQuickLookExportRoot() {
    if (typeof worldGroup === 'undefined' || !worldGroup) return null;
    const root = new THREE.Group();
    const matCache = new Map();
    const instMatrix = new THREE.Matrix4();
    const worldMatrix = new THREE.Matrix4();
    let truncated = false;
    worldGroup.updateMatrixWorld(true);
    const addClone = (geom, mat, matrix) => {
      const m = new THREE.Mesh(geom, mat);
      matrix.decompose(m.position, m.quaternion, m.scale);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      root.add(m);
    };
    worldGroup.traverse(obj => {
      if (truncated || !obj.visible || !obj.isMesh) return;
      const geom = obj.geometry;
      if (!geom || !geom.attributes || !geom.attributes.position) return;
      if (geom.attributes.position.isInterleavedBufferAttribute) return;
      if (obj.userData && (obj.userData.ghostPreview || obj.userData.noPointerPick)) return;
      const src = obj.material;
      const baseForAlpha = Array.isArray(src) ? src[0] : src;
      // Drop near-invisible helper overlays (selection hulls, faint holos, glow cones).
      if (baseForAlpha && baseForAlpha.transparent && typeof baseForAlpha.opacity === 'number' && baseForAlpha.opacity < 0.2) return;
      const mat = quickLookStandardMaterial(src, geom, matCache);
      if (obj.isInstancedMesh) {
        for (let i = 0; i < obj.count; i++) {
          if (root.children.length >= QUICKLOOK_MAX_MESHES) { truncated = true; break; }
          obj.getMatrixAt(i, instMatrix);
          worldMatrix.multiplyMatrices(obj.matrixWorld, instMatrix);
          addClone(geom, mat, worldMatrix);
        }
      } else {
        if (root.children.length >= QUICKLOOK_MAX_MESHES) { truncated = true; return; }
        addClone(geom, mat, obj.matrixWorld);
      }
    });
    if (!root.children.length) return null;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return null;
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const span = Math.max(size.x, size.z) || 1;
    const wrapper = new THREE.Group();
    root.position.set(-center.x, -box.min.y, -center.z);          // centre horizontally, base on the surface
    wrapper.add(root);
    wrapper.scale.setScalar(QUICKLOOK_TARGET_SIZE / span);
    wrapper.updateMatrixWorld(true);
    wrapper.userData.__matCache = matCache;
    wrapper.userData.__truncated = truncated;
    return wrapper;
  }

  // Safari only treats <a rel="ar"> as an AR launcher when it wraps a single
  // child (an <img>). A programmatic click then opens AR Quick Look in place.
  function openARQuickLookAnchor(url) {
    const anchor = document.createElement('a');
    anchor.setAttribute('rel', 'ar');
    anchor.href = url;
    anchor.style.display = 'none';
    const img = document.createElement('img');
    img.decoding = 'async';
    img.alt = '';
    // 1x1 transparent gif so the anchor is a valid AR launcher without any flash.
    img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
    anchor.appendChild(img);
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => { try { document.body.removeChild(anchor); } catch (_) {} }, 1500);
  }

  async function launchARQuickLook() {
    if (xrQuickLookBusy) return;
    if (!THREE.USDZExporter) {
      setXRStatus('AR export is unavailable (USDZ exporter failed to load).');
      return;
    }
    xrQuickLookBusy = true;
    if (xrQuickLookBtn) xrQuickLookBtn.disabled = true;
    setXRStatus('Preparing your world for AR…');
    let wrapper = null;
    try {
      wrapper = buildQuickLookExportRoot();
      if (!wrapper) { setXRStatus('Nothing to place in AR yet — build some world first.'); return; }
      const exporter = new THREE.USDZExporter();
      const usdz = await exporter.parse(wrapper);
      const blob = new Blob([usdz], { type: 'model/vnd.usdz+zip' });
      const url = URL.createObjectURL(blob);
      openARQuickLookAnchor(url);
      setXRStatus(wrapper.userData.__truncated
        ? 'Opening AR (large world — showing the first part). Point at a floor or table, tap to place, then walk around it.'
        : 'Opening AR — point your device at a floor or table, tap to place, then walk around your world.');
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 60000);
    } catch (err) {
      console.error('AR Quick Look export failed:', err);
      setXRStatus('Could not build the AR model: ' + String(err && err.message ? err.message : err).slice(0, 120));
    } finally {
      if (wrapper && wrapper.userData.__matCache) {
        wrapper.userData.__matCache.forEach(m => { try { m.dispose(); } catch (_) {} });
      }
      xrQuickLookBusy = false;
      if (xrQuickLookBtn) xrQuickLookBtn.disabled = false;
    }
  }

  async function refreshXRSupportUI() {
    const xrPanel = document.getElementById('xr-panel');
    if (xrPanel) xrPanel.hidden = true;

    // Apple AR Quick Look (iOS/iPadOS) is independent of WebXR — surface it
    // even when navigator.xr is absent, which is the normal case on iOS.
    const quickLook = supportsARQuickLook();
    if (xrQuickLookBtn) xrQuickLookBtn.hidden = !quickLook;

    const hasXR = !!(navigator.xr && navigator.xr.isSessionSupported);
    const ar = hasXR && await isXRSupported('immersive-ar');
    const vr = hasXR && await isXRSupported('immersive-vr');

    // WebXR buttons only make sense with a WebXR runtime (Android Chrome,
    // Quest, etc.). Hide them entirely where there is none so iOS users just
    // see the single Apple AR button.
    if (xrButtons.surface) { xrButtons.surface.hidden = !hasXR; xrButtons.surface.disabled = !ar; }
    if (xrButtons.float) { xrButtons.float.hidden = !hasXR; xrButtons.float.disabled = !(ar || vr); }
    if (xrButtons.inside) { xrButtons.inside.hidden = !hasXR; xrButtons.inside.disabled = !vr; }

    const anySupported = ar || vr || quickLook;
    if (xrPanel) xrPanel.hidden = !anySupported;
    // No persistent status on load — the buttons carry tooltips, and
    // setXRStatus is reserved for active AR flows and errors.
  }

  if (xrQuickLookBtn) xrQuickLookBtn.addEventListener('click', () => launchARQuickLook());
  if (xrButtons.surface) xrButtons.surface.addEventListener('click', () => startXRMode('surface'));
  if (xrButtons.float) xrButtons.float.addEventListener('click', () => startXRMode('float'));
  if (xrButtons.inside) xrButtons.inside.addEventListener('click', () => startXRMode('inside'));
  refreshXRSupportUI();
