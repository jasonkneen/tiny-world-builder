  // -------- weather tile effects --------
  // Rain/snow particles are local to the camera, but the weather state itself
  // should read across every rendered element through shared material tinting.
  // The old always-on tile overlay slabs are deliberately disabled below; only
  // real rain/snow impacts create visible surface marks.
  var tileWeatherMode = 'clear';
  let weatherTileAssets = null;
  function ensureWeatherTileAssets() {
    if (weatherTileAssets) return weatherTileAssets;
    const geo = new THREE.BoxGeometry(0.86, 0.012, 0.86);
    geo.userData.cached = true;
    weatherTileAssets = {
      geo,
      rain: new THREE.MeshBasicMaterial({ color: 0x6f8494, transparent: true, opacity: 0.16, depthWrite: false }),
      snow: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.26, depthWrite: false }),
    };
    applyWeatherTileOpacity();
    return weatherTileAssets;
  }
  function applyWeatherTileOpacity() {
    if (!weatherTileAssets) return;
    const k = Math.max(0.25, Math.min(1, weatherIntensity || 0.25));
    weatherTileAssets.rain.opacity = 0.06 + 0.14 * k;
    weatherTileAssets.snow.opacity = 0.10 + 0.22 * k;
  }
  function clearWeatherTileEffect(tile) {
    const fx = tile && tile.userData && tile.userData.weatherFx;
    if (!fx) return;
    tile.remove(fx);
    safeDisposeGeometry(fx.geometry);
    tile.userData.weatherFx = null;
    tile.userData.weatherFxMode = null;
  }
  function applyWeatherTileEffect(tile) {
    if (!tile || !tile.userData || tile.userData.fadeRole !== 'tile') return;
    // Do not attach per-tile weather panels. Weather should affect tiles via
    // shared material tinting, while only actual rain/snow impacts create
    // visible ripples/puddles/snow buildup on top of surfaces.
    clearWeatherTileEffect(tile);
  }
  function updateWeatherTileEffects() {
    for (const key in cellMeshes) {
      const entry = cellMeshes[key];
      if (entry && entry.tile) applyWeatherTileEffect(entry.tile);
    }
    if (typeof ghostBoards !== 'undefined') {
      for (const board of ghostBoards.values()) {
        board.traverse(o => {
          if (o && o.userData && o.userData.fadeRole === 'tile') applyWeatherTileEffect(o);
        });
      }
    }
  }

  function twRenderObjectSurfaceY(x, z, offsetX = 0, offsetZ = 0, radius = 0) {
    const onEditableIsland = (typeof isEditableIslandCell === 'function') && isEditableIslandCell(x, z);
    if (!onEditableIsland && window.__tinyworldMeshTerrain && typeof window.__tinyworldMeshTerrain.anchorForCell === 'function') {
      const s = window.__tinyworldMeshTerrain.anchorForCell(x, z, { offsetX, offsetZ, radius });
      if (s && Number.isFinite(s.y)) return s.y;
    }
    if (isLandscapeMeshActive()) return landscapeHeightAtCell(x, z);
    return TOP_H + terrainRiseAt(x, z);
  }

  // -------- low-level renderers (build the actual meshes from world state) --------
  function renderCellTile(x, z, opts) {
    if (!shouldRenderCellMesh(x, z)) return;
    const profileStart = repaintProfileBegin();
    const { animate = true, delay = 0 } = opts || {};
    const key = x + ',' + z;
    // If this cell is currently baked, drop the entire bake so the cell can be
    // rebuilt live. terrainBakeBusy guards against re-entrancy: unbakeAllTerrain
    // calls renderCellTile for each formerly-baked cell, but with the set already
    // cleared, so this branch is never re-entered.
    if (!terrainBakeBusy && bakedTerrainCells.has(key)) {
      unbakeAllTerrain();
      // unbakeAllTerrain already re-rendered every baked cell (including x,z)
      // from the current world data, so the current call is redundant — skip.
      repaintProfileEnd('tile.total', profileStart);
      return;
    }
    const entry = getOrCreateCellMeshEntry(x, z);
    if (entry.tile) {
      const disposeStart = repaintProfileBegin();
      if (entry.tile.parent) entry.tile.parent.remove(entry.tile);
      disposeGroup(entry.tile);
      repaintProfileEnd('tile.dispose', disposeStart);
      entry.tile = null;
    }
    // LandscapeEngine mode uses a hidden logical grass board for x/z
    // reference only. Do not build discrete base-tile meshes at all.
    if (isLandscapeMeshActive()) {
      repaintProfileEnd('tile.total', profileStart);
      return;
    }

    const cell = getWorldCell(x, z);
    const makeStart = repaintProfileBegin();
    const simpleTerrain = shouldUseSimpleFlatGrassTile(x, z, cell);
    // Ghost-board cells are faded/grayscale distant context. Skip the 5-9
    // surface-detail InstancedMeshes (grass blades, pebbles, pavers, etc.)
    // — they are invisible at that opacity and waste draw calls on a fill-bound app.
    const skipSurfaceDetails = isOutsideHomeGrid(x, z) && !isEditableIslandCell(x, z);
    const tile = makeTile(cell.terrain, {
      path: getPathNeighbors(x, z),
      terrain: getTerrainNeighbors(x, z),
      levels: getLevelNeighbors(x, z),
    }, x, z, tileLevelForCell(cell), { simpleTerrain, skipSurfaceDetails });
    repaintProfileEnd('tile.make', makeStart);

    const p = cellRenderPositionForCell(x, z);
    const display = cellDisplayPointForCell(x, z);
    tile.position.copy(p);
    groundReceiveOnly(tile);
    stampCellUserData(tile, x, z);
    tile.userData.fadeRole = 'tile';
    applyWeatherTileEffect(tile);
    prepareFadeable(tile, {
      opacity: isEditableIslandCell(x, z) ? 1 : opacityAtWorldPosition(display.x, display.z),
      grayscale: isOutsideHomeGrid(x, z) && !isEditableIslandCell(x, z),
    });
    cellRenderParentForCell(x, z).add(tile);
    entry.tile = tile;

    if (animate) animateDrop(tile, 2.4, 0.42, delay, easeOutCubic, false);
    repaintProfileEnd('tile.total', profileStart);
  }

  function rebuildTerrainRender() {
    // Drop any active bake before rebuilding; the settle timer will re-bake
    // after the rebuild completes.
    if (bakedTerrainCells.size > 0) unbakeAllTerrain();
    for (const key in cellMeshes) {
      const parts = key.split(',');
      const x = parseInt(parts[0], 10);
      const z = parseInt(parts[1], 10);
      if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
      renderCellTile(x, z, { animate: false });
    }
    if (typeof rebuildExistingGhostBoards === 'function') rebuildExistingGhostBoards();
    invalidateThumbCache();
    for (const id of Array.from(toolThumbCanvases.keys())) refreshToolThumb(id);
    refreshOpenStampBuilderCards();
  }

  function rebuildObjectsRender() {
    for (const key in cellMeshes) {
      const parts = key.split(',');
      const x = parseInt(parts[0], 10);
      const z = parseInt(parts[1], 10);
      if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
      renderCellObject(x, z, { animate: false });
    }
    if (typeof rebuildExistingGhostBoards === 'function') rebuildExistingGhostBoards();
  }

  function renderCellObject(x, z, opts) {
    if (!shouldRenderCellMesh(x, z)) return;
    const profileStart = repaintProfileBegin();
    try {
      return renderCellObjectImpl(x, z, opts);
    } finally {
      // Always clear the build-scoped window override, even on early returns.
      if (typeof setActiveWindowOverride === 'function') setActiveWindowOverride(null);
      repaintProfileEnd('object.total', profileStart);
    }
  }

  function renderCellObjectImpl(x, z, opts) {
    const { animate = false, delay = 0, impactDust = true } = opts || {};
    const key = x + ',' + z;
    const entry = getOrCreateCellMeshEntry(x, z);
    if (entry.object) {
      const disposeStart = repaintProfileBegin();
      if (entry.object.parent) entry.object.parent.remove(entry.object);
      disposeGroup(entry.object);
      repaintProfileEnd('object.dispose', disposeStart);
      entry.object = null;
    }
    // Landscape mode only renders central-board objects on the continuous
    // terrain. Never render out-of-home override/preview objects behind
    // the island fade.
    if (isLandscapeMeshActive() && isOutsideHomeGrid(x, z)) {
      const extrasStart = repaintProfileBegin();
      renderCellExtras(x, z);
      repaintProfileEnd('object.extras', extrasStart);
      return;
    }
    // Always rebuild extras when the main object is rebuilt — they
    // depend on world[x][z].extras and visually sit alongside.
    const extrasStart = repaintProfileBegin();
    renderCellExtras(x, z);
    repaintProfileEnd('object.extras', extrasStart);

    const cell = getWorldCell(x, z);
    const kind = cell.kind;
    if (!kind) return;
    const level = cell.floors || 1;
    const appearanceForRender = normalizeAppearance(cell.appearance);
    // Make this object's per-object window overrides visible to the deep window
    // builders (07 Parts.window / 09b voxelWindow) for the duration of the build.
    if (typeof setActiveWindowOverride === 'function') {
      setActiveWindowOverride(appearanceForRender && appearanceForRender.window);
    }
    const renderStyle = appearanceForRender && appearanceForRender.objectStyle;
    const forceSubEditVoxelRender = typeof isVoxelSubEditCell === 'function'
      && isVoxelSubEditCell(x, z)
      && typeof isVoxelSubEditableKind === 'function'
      && isVoxelSubEditableKind(kind, cell);
    const useVoxelRender = forceSubEditVoxelRender ||
                           kind === 'voxel-build' ||
                           kind === 'model-stamp' ||
                           (renderStyle === 'voxel') ||
                           (renderVoxelTerrain && renderStyle !== 'normal');

    let mesh = null;
    let posX = null, posZ = null;
    let setGridUserData = true;
    let stargatePortal = null;

    const buildStart = repaintProfileBegin();
    const voxelRender = useVoxelRender ? makeVoxelRenderForCell(kind, x, z, cell, level) : null;
    if (useVoxelRender && voxelRender && voxelRender.skip) {
      repaintProfileEnd('object.build', buildStart);
      return;
    }
    if (voxelRender) {
      mesh = voxelRender.mesh;
      posX = voxelRender.posX;
      posZ = voxelRender.posZ;
      setGridUserData = voxelRender.setGridUserData !== false;
    } else if (kind === 'tree')      mesh = makeTree(level, x, z);
    else if (kind === 'rock')      mesh = makeRock(getRockNeighbors(x, z), level, x, z, cell.terrain === 'water');
    else if (kind === 'bridge')    mesh = makeBridge(getBridgeOrientation(x, z), level);
    else if (kind === 'tuft')      mesh = makeTuft();
    else if (kind === 'flower')    mesh = makeFlower();
    else if (kind === 'bush')      mesh = makeBush();
    else if (kind === 'cow')       mesh = makeCow();
    else if (kind === 'sheep')     mesh = makeSheep();
    else if (kind === 'crop')      mesh = makeCrop();
    else if (kind === 'corn')      mesh = makeCorn();
    else if (kind === 'wheat')     mesh = makeWheat();
    else if (kind === 'pumpkin')   mesh = (level >= MAX_FLOORS && isCarriagePumpkin(x, z)) ? makePumpkinCarriage() : makePumpkin();
    else if (kind === 'carrot')    mesh = makeCarrot();
    else if (kind === 'sunflower') mesh = makeSunflower();
    else if (kind === 'stargate') {
      // Tinyverse portal: reuse the stargate factory (animated rings + glowing core).
      // Registered in a global tick list so 17 has no per-frame loop of its own.
      const SG = window.__tinyworldStargate;
      if (SG && typeof SG.build === 'function') {
        const portal = SG.build();
        stargatePortal = portal;
        mesh = portal.group;
        mesh.userData = Object.assign({}, mesh.userData, { kind: 'stargate', dest: cell.dest || null, isStargate: true });
        // Floating name label above the portal (cell.label).
        try {
          const labelText = cell.label || (cell.dest ? String(cell.dest).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '');
          if (labelText) {
            const cv = document.createElement('canvas');
            const pad = 24, fontPx = 64;
            const cx = cv.getContext('2d');
            cx.font = '700 ' + fontPx + "px 'Pixelify Sans', ui-monospace, monospace";
            const tw = Math.ceil(cx.measureText(labelText).width);
            cv.width = tw + pad * 2; cv.height = fontPx + pad * 2;
            const g = cv.getContext('2d');
            g.font = '700 ' + fontPx + "px 'Pixelify Sans', ui-monospace, monospace";
            g.textAlign = 'center'; g.textBaseline = 'middle';
            // pill background
            g.fillStyle = 'rgba(8,12,28,0.82)';
            const r = 28; const w = cv.width, h = cv.height;
            g.beginPath();
            g.moveTo(r, 0); g.lineTo(w - r, 0); g.arcTo(w, 0, w, r, r);
            g.lineTo(w, h - r); g.arcTo(w, h, w - r, h, r);
            g.lineTo(r, h); g.arcTo(0, h, 0, h - r, r);
            g.lineTo(0, r); g.arcTo(0, 0, r, 0, r); g.closePath(); g.fill();
            g.lineWidth = 4; g.strokeStyle = 'rgba(120,200,255,0.55)'; g.stroke();
            // text
            g.fillStyle = '#dff1ff';
            g.fillText(labelText, w / 2, h / 2 + 2);
            const tex = new THREE.CanvasTexture(cv);
            tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
            const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
            const aspect = cv.width / cv.height;
            const labelH = 0.42;
            spr.scale.set(labelH * aspect, labelH, 1);
            spr.position.set(0, (portal.centerY || 0.9) + 0.95, 0);
            spr.renderOrder = 999;
            mesh.add(spr);
          }
        } catch (_) {}
        try {
          const reg = (window.__twStargateAnimated = window.__twStargateAnimated || []);
          reg.push(portal);
          if (!window.__twStargateTicker) {
            window.__twStargateTicker = true;
            const t0 = performance.now();
            const tick = () => {
              const t = (performance.now() - t0) / 1000;
              const list = window.__twStargateAnimated || [];
              for (const p of list) { try { if (p && p.update) p.update(t); } catch (_) {} }
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        } catch (_) {}
      }
    }
    else if (kind === 'crystal' || kind === 'relic' || kind === 'totem' || kind === 'ruins' || kind === 'artifact') {
      // Artifact kinds (rich-island treasures). Map to existing primitives so
      // they render as visible props until bespoke meshes are authored.
      if (kind === 'crystal')      mesh = makeRock(getRockNeighbors(x, z), level, x, z, false);
      else if (kind === 'totem')   mesh = makeRock(getRockNeighbors(x, z), level, x, z, false);
      else if (kind === 'ruins')   mesh = makeRock(getRockNeighbors(x, z), level, x, z, false);
      else                          mesh = makeBush();   // relic / artifact -> small shrub-like marker
      if (mesh) mesh.userData = Object.assign({}, mesh.userData, { kind, artifact: true });
    }
    else if (kind === 'lamp-post' || kind === 'spotlight') mesh = makeVoxelLightSource(kind, level, { appearance: cell.appearance });
    else if (kind === 'fence') {
      const fenceStyle = typeof fenceStyleForCell === 'function' ? fenceStyleForCell(cell) : 'wood';
      if (cell.terrain === 'path') {
        // Pick orientation from neighbouring path cells so the gate
        // spans across the road, not along it.
        const pn = getPathNeighbors(x, z);
        const pathAxis = (pn.e || pn.w) ? 'x' : (pn.n || pn.s) ? 'z' : 'x';
        mesh = makeRoadGate(normalizeFenceSide(cell.fenceSide), level, pathAxis);
      } else {
        mesh = isCastleFence(x, z)
          ? makeCastleWallSegment(getCastleWallNeighbors(x, z))
          : makeFence(normalizeFenceSide(cell.fenceSide), level, fenceStyle);
      }
    }
    else if (kind === 'house') {
      const floors = cell.floors || 1;
      const bType = cell.buildingType || null;

      // Forced single-cell overrides — bypass cluster lookup so adjacent
      // forced-variant houses stay independent (no merging).
      if (bType === 'skyscraper') {
        mesh = makeSkyscraper(Math.max(floors, 4));
      } else if (bType === 'manor') {
        mesh = makeManor(floors);
      } else if (bType === 'tower') {
        // When a tower is adjacent to another house variant, adopt that
        // variant's palette so they read as one merged structure (e.g. a
        // tower next to a manor switches from grey stone to brick). Per-cell
        // appearance then overrides body/top colours for direct editing.
        mesh = makeStoneTower(Math.max(floors, 2), towerPaletteWithAppearance(getMergedBuildingPalette(x, z, 'tower'), cell.appearance));
      } else if (bType === 'turret') {
        mesh = makeTurret(floors);
      } else {
      const cluster = findHouseCluster(x, z);
      if (!cluster.isAnchor) {
        repaintProfileEnd('object.build', buildStart);
        return;
      }          // non-anchor cluster cells render nothing
      if (cluster.kind === 'turret') {
        mesh = makeTurret(floors);
      } else if (cluster.kind === 'solo') {
        // Residential / cottage houses keep their own look as you stack
        // floors — makeHouse handles tall counts. Skyscrapers are an
        // explicit variant from the flyout, not an auto-promotion.
        mesh = makeHouse(floors);
      } else if (cluster.kind === 'linear') {
        mesh = makeStretchedHouse(cluster.length, cluster.orientation, floors);
        // Position at cluster CENTRE (not the anchor cell), so the visible house
        // spans the run cleanly. Skip gx/gz so pickTile falls through to whichever
        // tile is actually under the cursor.
        const a = cellRenderPositionForCell(cluster.anchorX, cluster.anchorZ);
        posX = a.x; posZ = a.z;
        if (cluster.orientation === 'x') posX += (cluster.length - 1) * TILE / 2;
        else                              posZ += (cluster.length - 1) * TILE / 2;
        setGridUserData = false;
      } else if (cluster.kind === 'composite') {
        mesh = buildCompositeHouse(cluster.topology, floors);
        // Position at cluster bounding-box centre so wings fall in place.
        const t = cluster.topology;
        if (isEditableIslandCell(x, z)) {
          posX = (positiveMod(t.bbox.xMin, GRID) + positiveMod(t.bbox.xMax, GRID)) / 2 - GRID / 2 + 0.5;
          posZ = (positiveMod(t.bbox.zMin, GRID) + positiveMod(t.bbox.zMax, GRID)) / 2 - GRID / 2 + 0.5;
        } else {
          posX = (t.bbox.xMin + t.bbox.xMax) / 2 - GRID / 2 + 0.5;
          posZ = (t.bbox.zMin + t.bbox.zMax) / 2 - GRID / 2 + 0.5;
        }
        setGridUserData = false;
      } else if (cluster.kind === 'square') {
        mesh = buildSquareHouse(floors);
        // Centre the 2x2 mesh between the four cells.
        const sx = isEditableIslandCell(x, z) ? positiveMod(cluster.anchorX, GRID) : cluster.anchorX;
        const sz = isEditableIslandCell(x, z) ? positiveMod(cluster.anchorZ, GRID) : cluster.anchorZ;
        posX = (sx + 0.5) - GRID / 2 + 0.5;
        posZ = (sz + 0.5) - GRID / 2 + 0.5;
        setGridUserData = false;
      }
      } // close skyscraper-bypass else
    } else {
      repaintProfileEnd('object.build', buildStart);
      return;
    }

    if (!mesh) {
      repaintProfileEnd('object.build', buildStart);
      return;
    }
    repaintProfileEnd('object.build', buildStart);
    if (!voxelRender && kind !== 'house' && kind !== 'fence' && kind !== 'rock' && kind !== 'stargate') addEnhancementBits(mesh, kind, level);
    if (posX === null) {
      const p = cellRenderPositionForCell(x, z);
      posX = p.x; posZ = p.z;
    }
    // Uneven natural objects get a random 90° rotation per cell so the
    // same kind doesn't look identical in every tile. Deterministic on
    // (x, z) via cellRand so re-renders keep the same orientation.
    if (kind === 'rock' || kind === 'tree' || kind === 'tuft' || kind === 'flower' || kind === 'bush' || kind === 'cow' || kind === 'sheep') {
      const r = Math.floor(cellRand(x, z, 71) * 4); // 0..3
      mesh.rotation.y += r * (Math.PI / 2);
    }
    // Apply any user-supplied rotation / within-tile offset (set by
    // the ghost-preview arrow keys at placement time).
    if (kind === 'house' && isUnderpassTerrain(cell.terrain)) {
      mesh = wrapHouseForUnderpass(mesh, cell.terrain);
    }
    if (kind !== 'model-stamp') applyAppearanceToObject(mesh, kind, cell.appearance);
    if (typeof attachInspectorObjectLight === 'function') attachInspectorObjectLight(mesh, cell.appearance);
    const appearanceForTransform = appearanceForRender;
    const userScale = appearanceForTransform && appearanceForTransform.objectScale ? appearanceForTransform.objectScale : 1;
    const userScaleX = appearanceForTransform && appearanceForTransform.scaleX ? appearanceForTransform.scaleX : 1;
    const userScaleY = appearanceForTransform && appearanceForTransform.scaleY ? appearanceForTransform.scaleY : 1;
    const userScaleZ = appearanceForTransform && appearanceForTransform.scaleZ ? appearanceForTransform.scaleZ : 1;
    const userRot     = (cell.rotationY || 0);
    const userOffsetX = (cell.offsetX   || 0);
    const userOffsetY = (cell.offsetY   || 0);
    const userOffsetZ = (cell.offsetZ   || 0);
    if (userRot) mesh.rotation.y += userRot;
    if (userScale !== 1) mesh.scale.multiplyScalar(userScale);
    if (userScaleX !== 1 || userScaleY !== 1 || userScaleZ !== 1) {
      mesh.scale.set(mesh.scale.x * userScaleX, mesh.scale.y * userScaleY, mesh.scale.z * userScaleZ);
    }
    mesh.userData.objectScaleBase = userScale;
    mesh.userData.objectScaleBaseVec = mesh.scale.clone();
    const surfaceBase = cellRenderPositionForCell(x, z);
    const surfaceOffsetX = (Number.isFinite(posX) ? posX - surfaceBase.x : 0) + userOffsetX;
    const surfaceOffsetZ = (Number.isFinite(posZ) ? posZ - surfaceBase.z : 0) + userOffsetZ;
    const surfaceRadius = kind === 'house' ? 0.45 : (kind === 'fence' || kind === 'model-stamp' || kind === 'stargate') ? 0.35 : 0.22;
    const objectY = twRenderObjectSurfaceY(x, z, surfaceOffsetX, surfaceOffsetZ, surfaceRadius);
    mesh.position.set(posX + userOffsetX, objectY + userOffsetY, posZ + userOffsetZ);
    if (stargatePortal) {
      stargatePortal._cell = { x, z };
      stargatePortal._gy = mesh.position.y;
      stargatePortal._p = { x: mesh.position.x, z: mesh.position.z };
      stargatePortal._dest = cell.dest || null;
    }
    if (setGridUserData) {
      stampCellUserData(mesh, x, z);
    }
    if (kind === 'house') prepareBuildingWindowLights(mesh, x, z);
    mesh.userData.baseY = objectY + userOffsetY;
    mesh.userData.fadeRole = 'object';
    const display = cellDisplayPointForCell(x, z);
    prepareFadeable(mesh, {
      opacity: isEditableIslandCell(x, z) ? 1 : opacityAtWorldPosition(display.x, display.z),
      grayscale: isOutsideHomeGrid(x, z) && !isEditableIslandCell(x, z),
    });
    cellRenderParentForCell(x, z).add(mesh);
    entry.object = mesh;
    registerRuntimeObject(mesh);
    if (animate) animateDrop(mesh, 2.0, 0.5, delay, easeOutBack, impactDust);
  }

  // Build the secondary decorations (tufts / fences) that live alongside
  // the cell's main `kind`. Extras stay smaller and live near the edge
  // of the tile so they read as add-ons rather than the main occupant.
  //
  // opts.animateFrom: index of the first extra to drop-in. Extras
  // before this index appear instantly (used when an adjacency
  // re-render forces a full rebuild but we don't want existing
  // decorations to bounce again).
  function renderCellExtras(x, z, opts) {
    const profileStart = repaintProfileBegin();
    try {
      return renderCellExtrasImpl(x, z, opts);
    } finally {
      repaintProfileEnd('extras.total', profileStart);
    }
  }

  function renderCellExtrasImpl(x, z, opts) {
    const animateFrom = (opts && typeof opts.animateFrom === 'number') ? opts.animateFrom : Infinity;
    const key = x + ',' + z;
    const entry = getOrCreateCellMeshEntry(x, z);
    if (!entry.extras) entry.extras = [];
    // Dispose any previous extras.
    for (const m of entry.extras) {
      if (m.parent) m.parent.remove(m);
      disposeGroup(m);
    }
    entry.extras.length = 0;
    if (isLandscapeMeshActive() && isOutsideHomeGrid(x, z)) return;
    const cell = world[x] && world[x][z];
    if (!cell || !cell.extras || !cell.extras.length) return;
    const p = cellRenderPositionForCell(x, z);
    cell.extras.forEach((ex, i) => {
      let mesh = null;
      if (ex.kind === 'tuft') mesh = makeVoxelCropKind('tuft', ex.floors || 1);
      else if (ex.kind === 'fence') mesh = makeVoxelFence(normalizeFenceSide(ex.fenceSide), ex.floors || 1, false, false, 'x', typeof fenceStyleFromAppearance === 'function' ? fenceStyleFromAppearance(ex.appearance) : 'wood');
      if (!mesh) return;
      // Smaller, corner-offset extras so they sit alongside the main
      // kind without overlapping its silhouette.
      if (ex.kind === 'tuft') {
        const cornerOff = 0.30;
        const corners = [
          [-cornerOff, -cornerOff], [cornerOff, -cornerOff],
          [-cornerOff,  cornerOff], [cornerOff,  cornerOff],
        ];
        const [dx, dz] = corners[(i + Math.floor(cellRand(x, z, 90 + i) * 4)) % 4];
        mesh.position.set(p.x + dx, twRenderObjectSurfaceY(x, z, dx, dz, 0.1), p.z + dz);
        mesh.scale.set(0.7, 0.7, 0.7);
      } else {
        // Fences keep their full side geometry (they live on the tile edge).
        mesh.position.set(p.x, twRenderObjectSurfaceY(x, z, 0, 0, 0.35), p.z);
      }
      stampCellUserData(mesh, x, z);
      mesh.userData.fadeRole = 'object';
      mesh.userData.baseY = mesh.position.y;
      mesh.userData.extraSlot = i;
      const display = cellDisplayPointForCell(x, z);
      prepareFadeable(mesh, {
        opacity: isEditableIslandCell(x, z) ? 1 : opacityAtWorldPosition(display.x, display.z),
        grayscale: isOutsideHomeGrid(x, z) && !isEditableIslandCell(x, z),
      });
      cellRenderParentForCell(x, z).add(mesh);
      entry.extras.push(mesh);
      if (i >= animateFrom) animateDrop(mesh, 1.6, 0.42, 0.04 * (i - animateFrom), easeOutBack, false);
    });
  }

  function addCellExtra(x, z, extra, opts = {}) {
    if (!world[x] || !world[x][z]) return;
    pushWorldHistorySnapshot();
    const cell = world[x][z];
    if (!cell.extras) cell.extras = [];
    // De-dupe identical fence sides; level them up instead.
    if (extra.kind === 'fence') {
      const side = normalizeFenceSide(extra.fenceSide);
      const style = typeof fenceStyleFromAppearance === 'function' ? fenceStyleFromAppearance(extra.appearance) : 'wood';
      const existingIdx = cell.extras.findIndex(e => {
        const existingStyle = typeof fenceStyleFromAppearance === 'function' ? fenceStyleFromAppearance(e.appearance) : 'wood';
        return e.kind === 'fence' && normalizeFenceSide(e.fenceSide) === side && existingStyle === style;
      });
      if (existingIdx >= 0) {
        const requestedFloors = Math.max(1, Math.min(MAX_FLOORS, extra.floors || 1));
        const currentFloors = cell.extras[existingIdx].floors || 1;
        const nextFloors = opts.drawing
          ? Math.max(currentFloors, requestedFloors)
          : Math.min(Math.max(currentFloors + 1, requestedFloors), MAX_FLOORS);
        if (nextFloors === currentFloors) return;
        cell.extras[existingIdx].floors = nextFloors;
        // Animate just the one that changed — existing siblings stay put.
        renderCellExtras(x, z, { animateFrom: existingIdx });
        refreshVehiclesForWorldObstacleChange(x, z);
        saveState();
        notifyWorldChanged(x, z);
        return;
      }
    }
    const newIdx = cell.extras.length;
    cell.extras.push(Object.assign({ floors: 1 }, extra));
    // Animate only the newly-added entry; everything before it
    // re-mounts at its resting position without a drop.
    renderCellExtras(x, z, { animateFrom: newIdx });
    refreshVehiclesForWorldObstacleChange(x, z);
    saveState();
    notifyWorldChanged(x, z);
  }

  function popCellExtra(x, z) {
    if (!world[x] || !world[x][z] || !world[x][z].extras || !world[x][z].extras.length) return false;
    pushWorldHistorySnapshot();
    world[x][z].extras.pop();
    renderCellExtras(x, z); // no animation — surviving extras stay put
    refreshVehiclesForWorldObstacleChange(x, z);
    saveState();
    notifyWorldChanged(x, z);
    return true;
  }

  const CROP_KINDS = new Set(['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower']);

  function notifyWorldChanged(x, z) {
    window.dispatchEvent(new CustomEvent('tinyworld:world-changed', {
      detail: { x, z, cell: world[x] && world[x][z] ? world[x][z] : null }
    }));
  }

  function setCell(x, z, opts) {
    const profileStart = repaintProfileBegin();
    try {
      return setCellImpl(x, z, opts);
    } finally {
      repaintProfileEnd('setCell.total', profileStart);
    }
  }

  function setCellImpl(x, z, opts) {
    const { terrain, terrainFloors, kind = null, floors, buildingType, fenceSide, tileDelay = 0, objectDelay = 0, animate = true, impactDust = true, forceTile = false, rotationY, offsetX, offsetY, offsetZ, appearance, waterFlow, dest, label } = opts;
    const historyStart = repaintProfileBegin();
    pushWorldHistorySnapshot();
    repaintProfileEnd('state.history', historyStart);
    const prev = ensureWorldCell(x, z);
    const prevVehicleDrivable = isVehicleDrivableCell(prev);
    let nextTerrain = terrain || 'grass';
    let nextKind = kind || null;
    if (nextKind === 'bridge') nextTerrain = 'water';
    else if (CROP_KINDS.has(nextKind)) nextTerrain = 'dirt';
    else if (nextKind === 'house' && (nextTerrain === 'water' || nextTerrain === 'path' || nextTerrain === 'lava')) nextTerrain = 'grass';
    else if (nextTerrain === 'water' && nextKind !== 'house' && nextKind !== 'rock' && nextKind !== 'ripple' && nextKind !== 'bridge' && nextKind !== 'bridge-rail' && nextKind !== 'voxel-build' && nextKind !== 'model-stamp') nextKind = null;
    else if (nextTerrain === 'lava' && nextKind !== 'rock') nextKind = null;

    const terrainChanged = prev.terrain !== nextTerrain;
    const kindChanged    = (prev.kind || null) !== nextKind;
    // floors default: when placing a fresh kind, start at 1; when preserving the
    // same kind without specifying, keep the previous value.
    const newFloors = (floors !== undefined) ? floors
                    : (kindChanged ? 1 : (prev.floors || 1));
    const floorsChanged = (prev.floors || 1) !== newFloors;
    const newTerrainFloors = (terrainFloors !== undefined) ? terrainFloors : terrainLevelForCell(prev);
    const terrainFloorsChanged = terrainLevelForCell(prev) !== newTerrainFloors;
    // buildingType: when caller passes undefined, preserve previous unless the
    // kind is changing (a fresh kind clears any old building-type override).
    let newBType = (buildingType !== undefined) ? (buildingType || null)
                 : (kindChanged ? null : (prev.buildingType || null));
    if (nextKind !== 'house') newBType = null;
    const bTypeChanged = (prev.buildingType || null) !== newBType;
    let newFenceSide = (fenceSide !== undefined) ? (fenceSide || null)
                     : (kindChanged ? null : (prev.fenceSide || null));
    if (nextKind === 'fence') newFenceSide = normalizeFenceSide(newFenceSide);
    else newFenceSide = null;
    const fenceSideChanged = (prev.fenceSide || null) !== newFenceSide;
    const prevTileLevel = tileLevelForCell(prev);
    const nextTileLevel = tileLevelForCell({ terrain: nextTerrain, terrainFloors: newTerrainFloors, kind: nextKind, floors: newFloors, buildingType: newBType, fenceSide: newFenceSide });
    const tileHeightChanged = prevTileLevel !== nextTileLevel;
    // Preserve `extras` (decorative tufts / fences sitting alongside the
    // main kind) across setCell unless the caller explicitly clears them.
    const carriedExtras = opts && Object.prototype.hasOwnProperty.call(opts, 'extras')
      ? (opts.extras || [])
      : (prev.extras || []);
    // Rotation and within-tile offset for the main mesh. Cleared
    // whenever the kind changes so a fresh placement starts at the
    // default orientation.
    const kindIsNew = (prev.kind || null) !== nextKind;
    const newRotationY = (rotationY !== undefined) ? rotationY : (kindIsNew ? 0 : (prev.rotationY || 0));
    const newOffsetX   = (offsetX   !== undefined) ? offsetX   : (kindIsNew ? 0 : (prev.offsetX   || 0));
    const newOffsetY   = (offsetY   !== undefined) ? offsetY   : (kindIsNew ? 0 : (prev.offsetY   || 0));
    const newOffsetZ   = (offsetZ   !== undefined) ? offsetZ   : (kindIsNew ? 0 : (prev.offsetZ   || 0));
    const transformChanged = (prev.rotationY || 0) !== newRotationY
      || (prev.offsetX || 0) !== newOffsetX
      || (prev.offsetY || 0) !== newOffsetY
      || (prev.offsetZ || 0) !== newOffsetZ;
    const newAppearance = Object.prototype.hasOwnProperty.call(opts || {}, 'appearance')
      ? normalizeAppearance(appearance)
      : (kindIsNew ? null : normalizeAppearance(prev.appearance));
    const appearanceChanged = !sameAppearance(prev.appearance, newAppearance);
    const newWaterFlow = nextTerrain === 'water'
      ? normalizeWaterFlow(waterFlow !== undefined ? waterFlow : prev.waterFlow)
      : 'auto';
    const waterFlowChanged = normalizeWaterFlow(prev.waterFlow) !== newWaterFlow;
    const userEdited = !!(prev.userEdited || (opts && opts.userEdited));
    world[x][z] = { terrain: nextTerrain, terrainFloors: newTerrainFloors, kind: nextKind, floors: newFloors, buildingType: newBType, fenceSide: newFenceSide, extras: carriedExtras, rotationY: newRotationY, offsetX: newOffsetX, offsetY: newOffsetY, offsetZ: newOffsetZ, appearance: newAppearance, waterFlow: newWaterFlow };
    if (nextKind === 'stargate') {
      if (dest != null) world[x][z].dest = dest;
      if (label != null) world[x][z].label = label;
    }
    if (userEdited) world[x][z].userEdited = true;
    const vehicleDrivableChanged = prevVehicleDrivable !== isVehicleDrivableCell(world[x][z]);
    if (vehicleDrivableChanged) refreshVehiclesForWorldObstacleChange(x, z);

    // Maintain live index sets so hot paths (crop duster, pumpkin carriage)
    // never scan the full grid. Only home-grid cells (0..GRID) are tracked.
    const wasCrop = isCropCell(prev);
    const isCrop = isCropCell(world[x][z]);
    if (wasCrop && !isCrop) removeCropPosition(x, z);
    if (!wasCrop && isCrop) addCropPosition(x, z);

    const wasMaxPump = (prev.kind === 'pumpkin' && (prev.floors || 1) >= MAX_FLOORS);
    const isMaxPump = (world[x][z].kind === 'pumpkin' && (world[x][z].floors || 1) >= MAX_FLOORS);
    if (wasMaxPump !== isMaxPump) updateCarriageAfterChange(x, z, wasMaxPump, isMaxPump);

    const emitCellWebhook = () => {
      if (!suppressSave && typeof fireWebhook === 'function') fireWebhook('cell.set', { x, z, cell: world[x][z] });
    };

    // For house clusters, every cell shares the floors count. Propagate to all.
    if (nextKind === 'house' && floorsChanged) {
      for (const c of bfsHouseCluster(x, z)) {
        if (c.x !== x || c.z !== z) world[c.x][c.z].floors = newFloors;
      }
    }

    if (terrainChanged || tileHeightChanged || waterFlowChanged || forceTile) {
      renderCellTile(x, z, { animate, delay: tileDelay });
    } else if (!hasCellTileMesh(x, z)) {
      // Defensive: if for any reason this cell has no ground mesh
      // (e.g. user clicked a freshly materialised ghost cell with no
      // pre-rendered tile yet), render one before the object lands so
      // we never get a hole under the new object.
      renderCellTile(x, z, { animate: false });
    }

    // Terrain adjacency: path bands, shoreline lips, water foam, bridge
    // orientation all depend on 4-neighbour terrain; riser side-culling
    // depends on 4-neighbour tile levels. Either kind of change requires
    // re-rendering the immediate neighbours so faces don't go stale.
    if ((terrainChanged || tileHeightChanged) && !forceTile) {
      const neighborStart = repaintProfileBegin();
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        renderCellTile(nx, nz, { animate: false });
        if (getWorldCell(nx, nz).kind === 'bridge') renderCellObject(nx, nz, { animate: false });
      }
      if (getWorldCell(x, z).kind === 'bridge') renderCellObject(x, z, { animate: false });
      repaintProfileEnd('setCell.neighbors', neighborStart);
    }
    // A perimeter cell toggling water changes where the island's green edge cap
    // opens, so rebuild the home border (debounced) to keep the rim in sync.
    if (terrainChanged
        && (x === 0 || z === 0 || x === GRID - 1 || z === GRID - 1)
        && (prev.terrain === 'water') !== (nextTerrain === 'water')
        && typeof scheduleHomeBorderEdgeRefresh === 'function') {
      scheduleHomeBorderEdgeRefresh();
    }
    if (!kindChanged && !floorsChanged && !terrainFloorsChanged && !bTypeChanged && !fenceSideChanged && !appearanceChanged && !transformChanged && !waterFlowChanged) {
      if (terrainChanged || tileHeightChanged || waterFlowChanged || forceTile) {
        const saveStart = repaintProfileBegin();
        saveState();
        repaintProfileEnd('state.save', saveStart);
        emitCellWebhook();
        notifyWorldChanged(x, z);
      }
      return;
    }

    // The "primary" cell is whichever cell's mesh visually represents the change.
    // For house placements that join/extend a cluster, that's the cluster anchor —
    // not the click cell, since the click cell may render nothing.
    let primaryX = x, primaryZ = z;
    if (nextKind === 'house') {
      const c = findHouseCluster(x, z);
      primaryX = c.anchorX; primaryZ = c.anchorZ;
    } else if (nextKind === 'fence') {
      const span = findFenceRenderSpan(x, z);
      if (span) {
        primaryX = span.anchorX;
        primaryZ = span.anchorZ;
      }
    }

    // Collect every cell whose rendered mesh might need to change: this cell,
    // its 4 neighbours, AND every house connected to those (so a cluster split
    // across multiple cells refreshes correctly).
    const refreshPlanStart = repaintProfileBegin();
    const toRefresh = new Map();
    toRefresh.set(x + ',' + z, { x, z });
    if (getWorldCell(x, z).kind === 'house') {
      for (const c of bfsHouseCluster(x, z)) toRefresh.set(c.x + ',' + c.z, c);
    }
    // Pumpkin Cinderella rule: any pumpkin change can shift which tile
    // owns the carriage, so re-render every max-level pumpkin too.
    if (prev.kind === 'pumpkin' || nextKind === 'pumpkin') {
      eachMaxPumpkin((px, pz) => toRefresh.set(px + ',' + pz, { x: px, z: pz }));
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      const nk = getWorldCell(nx, nz).kind;
      if (nk === 'rock') {
        toRefresh.set(nx + ',' + nz, { x: nx, z: nz });
      } else if (nk === 'fence') {
        toRefresh.set(nx + ',' + nz, { x: nx, z: nz });
      } else if (nk === 'house') {
        for (const c of bfsHouseCluster(nx, nz)) toRefresh.set(c.x + ',' + c.z, c);
      }
    }

    // Castle promotion expansion: the changed cell or its 4-neighbours might
    // be part of a fence component whose castle status just flipped (a
    // turret-house appeared / disappeared, a fence joined / left the chain).
    // Walk every connected fence cell starting from this cell and its
    // 4-neighbours, and re-render all of them — plus their adjacent houses,
    // since a house's turret status depends on neighbouring fences.
    const fenceVisited = new Set();
    const fenceStack = [[x, z]];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      fenceStack.push([x + dx, z + dz]);
    }
    while (fenceStack.length) {
      const [cx, cz] = fenceStack.pop();
      const fk = cx + ',' + cz;
      if (fenceVisited.has(fk)) continue;
      if (getWorldCell(cx, cz).kind !== 'fence') continue;
      fenceVisited.add(fk);
      toRefresh.set(fk, { x: cx, z: cz });
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz;
        if (getWorldCell(nx, nz).kind === 'house') {
          for (const c of bfsHouseCluster(nx, nz)) {
            toRefresh.set(c.x + ',' + c.z, c);
            // Bridge the castle network: push every fence that touches any
            // cluster cell. Without this, a turret promotion only refreshes
            // the fence component the player just edited, leaving fences on
            // the cluster's *other* sides stuck on stale geometry.
            for (const [hdx, hdz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const hx = c.x + hdx, hz = c.z + hdz;
              if (getWorldCell(hx, hz).kind === 'fence') fenceStack.push([hx, hz]);
            }
          }
        } else if (getWorldCell(nx, nz).kind === 'fence') {
          fenceStack.push([nx, nz]);
        }
      }
    }
    repaintProfileEnd('setCell.plan', refreshPlanStart, toRefresh.size || 1);

    const refreshStart = repaintProfileBegin();
    for (const c of toRefresh.values()) {
      const isPrimary = c.x === primaryX && c.z === primaryZ;
      renderCellObject(c.x, c.z, {
        animate: animate && isPrimary,
        delay:   isPrimary ? objectDelay : 0,
        impactDust: impactDust && isPrimary,
      });
    }
    repaintProfileEnd('setCell.refresh', refreshStart, toRefresh.size || 1);
    const saveStart = repaintProfileBegin();
    saveState();
    repaintProfileEnd('state.save', saveStart);
    emitCellWebhook();
    notifyWorldChanged(x, z);
  }

  // Cinderella rule: only ONE pumpkin tile across the home grid is the
  // carriage at a time. The lowest-index (x,z) max-level pumpkin wins.
  // Uses the live maxPumpkinPositions + carriagePumpkin cache so repeated
  // renders and neighbor refreshes stay O(1) instead of O(GRID²).
  function isCarriagePumpkin(x, z) {
    return !!(carriagePumpkin && carriagePumpkin.x === x && carriagePumpkin.z === z);
  }

  function eachMaxPumpkin(callback) {
    for (const key of maxPumpkinPositions) {
      const [xx, zz] = key.split(',').map(Number);
      callback(xx, zz);
    }
  }

  function disposeGroup(group) {
    const profileStart = repaintProfileBegin();
    opacityRoots.delete(group);
    unregisterRuntimeObject(group);
    group.traverse(o => {
      if (o.userData && o.userData.waterfall) waterfallEffectMeshes.delete(o);
      if (o.userData && (o.userData.rocketPlumeSheet || o.userData.rocketFlame)) islandRocketFlames.delete(o);
      safeDisposeGeometry(o.geometry);
      // Materials are shared (M.* and the fadeMatCache buckets), so we never
      // dispose them here — same contract as before, just enforced via the
      // cachedFade flag now that prepareFadeable no longer clones.
    });
    repaintProfileEnd('dispose.traverse', profileStart);
  }

  // -------- home-grid terrain mesh bake --------
  // Merges the static base terrain tiles of the home grid into per-material
  // meshes at rest, dropping draw calls from ~400 to ~120 on a 20x20 world
  // (measured: -70% draws). Individual cells unbake back to live tiles when
  // edited, then re-bake after the world settles.
  //
  // Feature flag: ON iff localStorage 'tinyworld:renderTerrainBake' === '1'
  // OR URL param ?meshbake=1. Default OFF for safe rollout.

  const terrainBakeEnabled = (function () {
    try {
      const ls = localStorage.getItem('tinyworld:renderTerrainBake') === '1';
      const url = typeof location !== 'undefined' && new URLSearchParams(location.search).get('meshbake') === '1';
      return ls || url;
    } catch (_) { return false; }
  }());

  const bakedTerrainCells = new Set();   // Set<'x,z'> of currently-baked home-grid cells
  let terrainBakeRoot = null;            // THREE.Group holding merged bake meshes
  let terrainBakeSettleTimer = null;     // debounce handle
  let terrainBakeBusy = false;           // re-entrancy guard for renderCellTile hook
  // Runtime opt-in for non-home contexts (static lobby/demo world rooms) without
  // the global flag. Toggled by window.__tinyworldSetTerrainBakeForced.
  let terrainBakeForced = false;
  const _terrainBakeBox = new THREE.Box3();

  function terrainCellBakeEligible(x, z, entry) {
    if (!entry || !entry.tile) return false;
    if (x < 0 || x >= GRID || z < 0 || z >= GRID) return false;
    if (typeof isEditableIslandCell === 'function' && isEditableIslandCell(x, z)) return false;
    // Check that every mesh in the tile would pass canMergeStaticBaseMesh
    // after swapping to its preserved baseMat. A cell with any un-mergeable
    // mesh (water overlay, weather FX, animated part) stays live.
    //
    // Distinguishing the TWO kinds of transparent material on home tiles:
    //   1. prepareFadeable fade wrapper: o.userData.baseMat exists AND
    //      o.material !== o.userData.baseMat. The home tile is opaque but the
    //      fade system keeps a transparent wrapper (keepFadeAtOpaque). We swap
    //      back to baseMat at bake time — safe.
    //   2. Live animated/tinted material (water, weather FX): either no baseMat,
    //      or baseMat === current material. These must stay live.
    let allMergeable = false; // must have at least one mesh
    let anyUnmergeable = false;
    entry.tile.traverse(o => {
      if (!o.isMesh) return;
      const u = o.userData || {};
      const currentMat = o.material;
      const baseMat = u.baseMat;
      // Reject FX-flagged meshes regardless of material
      if (u.noBatch || u.noStaticBaseMerge || u.waterfall || u.weatherFx ||
          u.rocketPlumeSheet || u.rocketFlame || u.propellerBlurDisc) {
        anyUnmergeable = true; return;
      }
      // Determine the effective material we would use when baking
      const isFadeWrapper = baseMat && currentMat !== baseMat && currentMat && currentMat.transparent;
      const effectiveMat = isFadeWrapper ? baseMat : currentMat;
      if (!effectiveMat || effectiveMat.transparent || Array.isArray(effectiveMat)) {
        anyUnmergeable = true; return;
      }
      allMergeable = true;
    });
    return allMergeable && !anyUnmergeable;
  }

  function bakeHomeTerrainNow() {
    if (!terrainBakeEnabled && !terrainBakeForced) return;
    if (bakedTerrainCells.size > 0) return; // already baked
    if (typeof isLandscapeMeshActive === 'function' && isLandscapeMeshActive()) return;
    // Suppress during applyState bulk load (suppressSave flag from 29-persistence-api.js)
    if (typeof suppressSave !== 'undefined' && suppressSave) return;
    if (typeof worldGroup === 'undefined' || !worldGroup) return;
    if (typeof mergeStaticBaseMeshesByMaterial !== 'function') return;

    const t0 = performance.now();

    // Collect eligible cells
    const toAttach = [];
    for (let x = 0; x < GRID; x++) {
      for (let z = 0; z < GRID; z++) {
        const entry = cellMeshesGrid[x] && cellMeshesGrid[x][z];
        if (!entry || !entry.tile) continue;
        const key = x + ',' + z;
        if (!terrainCellBakeEligible(x, z, entry)) continue;
        toAttach.push({ x, z, key, entry });
      }
    }

    if (toAttach.length < 2) return; // not worth baking

    // Create bake root
    terrainBakeRoot = new THREE.Group();
    terrainBakeRoot.name = 'home-terrain-bake';
    terrainBakeRoot.userData.homeTerrainBake = true;
    worldGroup.add(terrainBakeRoot);

    // attach() reparents each tile group into bakeRoot while preserving world
    // transform — the merge then bakes world positions directly.
    for (const { x, z, key, entry } of toAttach) {
      terrainBakeRoot.attach(entry.tile);
      // Cache the tile-top world Y BEFORE the merge strips the tile's meshes, so
      // voxelGroundY (47-worlds-room) keeps avatars grounded once entry.tile is null.
      // Use the walkable cap height (not the raw bounding box, which encloses edge
      // weeds/kerbs/bevels that poke above the surface and make avatars bob).
      try {
        const gy = (typeof tileSurfaceWorldY === 'function') ? tileSurfaceWorldY(entry.tile) : null;
        if (typeof gy === 'number' && isFinite(gy)) entry.bakedGroundY = gy;
        else { _terrainBakeBox.setFromObject(entry.tile); if (isFinite(_terrainBakeBox.max.y)) entry.bakedGroundY = _terrainBakeBox.max.y; }
      } catch (_) {}
      // Swap transparent fade materials back to their preserved opaque baseMat.
      // prepareFadeable (15-ghost-generation-fade.js) sets keepFadeAtOpaque on
      // home tiles, meaning the material is transparent even at opacity 1.
      // canMergeStaticBaseMesh rejects transparent, so this swap is required.
      entry.tile.traverse(o => {
        if (o.isMesh && o.userData && o.userData.baseMat && o.material !== o.userData.baseMat) {
          o.material = o.userData.baseMat;
        }
      });
    }

    mergeStaticBaseMeshesByMaterial(terrainBakeRoot, { reason: 'home-terrain-bake' });

    // Dispose the now-empty original tile groups and null out entry.tile
    for (const { x, z, key, entry } of toAttach) {
      const tileGroup = entry.tile;
      if (tileGroup && tileGroup.parent === terrainBakeRoot) {
        terrainBakeRoot.remove(tileGroup);
        disposeGroup(tileGroup);
      }
      entry.tile = null;
      bakedTerrainCells.add(key);
    }

    if (typeof requestShadowMapUpdate === 'function') requestShadowMapUpdate();

    const ms = Math.round(performance.now() - t0);
    console.log('[terrain-bake] baked', bakedTerrainCells.size, 'cells in', ms + 'ms');
    if (ms > 50) console.warn('[terrain-bake] bake took', ms + 'ms (>50ms threshold; consider chunked v2)');
  }

  function unbakeAllTerrain() {
    if (bakedTerrainCells.size === 0) return;

    // Dispose merged bake meshes (geometries only — materials are shared)
    if (terrainBakeRoot) {
      terrainBakeRoot.traverse(o => {
        if (o.isMesh && o.userData && o.userData.staticBaseMerged && o.geometry) {
          o.geometry.dispose();
        }
      });
      worldGroup.remove(terrainBakeRoot);
      terrainBakeRoot = null;
    }

    // Copy and clear the set BEFORE re-rendering to prevent re-entrancy
    const cells = Array.from(bakedTerrainCells);
    bakedTerrainCells.clear();

    // Rebuild each formerly-baked cell as a live tile
    terrainBakeBusy = true;
    try {
      for (const key of cells) {
        const [x, z] = key.split(',').map(Number);
        renderCellTile(x, z, { animate: false });
      }
    } finally {
      terrainBakeBusy = false;
    }

    if (typeof requestShadowMapUpdate === 'function') requestShadowMapUpdate();

    // Schedule a re-bake after the world settles
    scheduleTerrainBakeOnSettle();
  }

  function scheduleTerrainBakeOnSettle() {
    if (!terrainBakeEnabled && !terrainBakeForced) return;
    if (terrainBakeSettleTimer !== null) clearTimeout(terrainBakeSettleTimer);
    terrainBakeSettleTimer = setTimeout(function () {
      terrainBakeSettleTimer = null;
      bakeHomeTerrainNow();
    }, 1200);
  }

  // World rooms (the static lobby/demo) opt into the bake at runtime: forced ON
  // after the world finishes rendering, OFF + unbaked on leave so the next world
  // (or the home builder) starts from live tiles.
  window.__tinyworldSetTerrainBakeForced = function (on) {
    terrainBakeForced = !!on;
    if (terrainBakeForced) scheduleTerrainBakeOnSettle();
  };
  window.__tinyworldUnbakeTerrain = function () { try { unbakeAllTerrain(); } catch (_) {} };
