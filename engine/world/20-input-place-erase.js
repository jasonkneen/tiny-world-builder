  // -------- click → place / erase --------
  // Remove the ghost board's mesh for a given local cell so a freshly
  // materialised home cellMesh doesn't render on top of the original
  // ghost tile/object at the same world position.
  function removeGhostCellMesh(boardX, boardZ, lx, lz) {
    rebuildGhostBoard(boardX, boardZ);
  }

  function applyToolToCell(cell, opts = {}) {
    if (window.__tinyworldIsPlayMode && window.__tinyworldIsPlayMode()) return;
    // Island tool: clicking a hovered placement hologram places there directly,
    // regardless of whatever island sits under the click ray.
    if (selectedTool && selectedTool.island && typeof islandPlacementHoloHoveredSlot === 'function') {
      const holoSlot = islandPlacementHoloHoveredSlot();
      if (holoSlot) {
        createEditableIsland({ positionX: holoSlot.positionX, positionY: holoSlot.positionY, positionZ: holoSlot.positionZ, select: false });
        onIslandToolSelected();
        return;
      }
    }
    const hitIsland = cell && cell.editableIslandId
      ? editableIslandById.get(cell.editableIslandId)
      : (cell ? editableIslandForBoard(cell.boardX || 0, cell.boardZ || 0) : null);
    if (hitIsland) {
      selectedEditableIslandId = hitIsland.id;
      updateEditableIslandLods(true);
    }
    selectedEditableIslandEngineRef = null;
    if (selectedTool && selectedTool.mooring) return;
    if (selectedTool && selectedTool.island) {
      if (hitIsland) {
        selectEditableIsland(hitIsland);
      } else {
        // Place into the chosen 8-grid slot around the anchor island. Falls
        // back to the legacy cursor-derived position for the first island
        // (no anchor) or when every neighbour slot is occupied.
        const slot = (currentHover && currentHover.__islandSlot) || islandHoverSlot(cell);
        // No board key → createEditableIsland assigns a fresh editable-island
        // board. select:false so placing an island does NOT grab the gizmo /
        // Move-Rotate menu — selection only happens when the user explicitly
        // clicks an island.
        if (slot) {
          createEditableIsland({ positionX: slot.positionX, positionY: slot.positionY, positionZ: slot.positionZ, select: false });
        } else {
          createEditableIsland(Object.assign({ select: false }, nextEditableIslandPosition(cell)));
        }
        // Re-anchor the hologram on the freshly placed island for the next one.
        onIslandToolSelected();
      }
      return;
    }
    if ((cell.boardX || cell.boardZ) && !hitIsland) {
      // Skip if the currently selected tool would no-op (e.g. auto mode
      // without an API key) — otherwise we'd materialise + remove the
      // ghost mesh for a click that produced no replacement, leaving a
      // hole. Same for any other tool that ends up doing nothing.
      if (selectedTool.auto) {
        if (!getAIProviderState().key) return;
      }
      // Ghost-board click — copy the generated cell into the user-edit
      // store, mark it as edited, strip the ghost mesh so we don't
      // double-render, then let applyTool / setCell render the home
      // cellMesh.
      const ghostCells = makeGhostWorld(cell.boardX, cell.boardZ);
      const ghostCell = ghostCells[cell.x][cell.z];
      const x = cell.x + (cell.boardX || 0) * GRID;
      const z = cell.z + (cell.boardZ || 0) * GRID;
      if (!world[x]) world[x] = [];
      world[x][z] = { ...ghostCell, userEdited: true };
      removeGhostCellMesh(cell.boardX, cell.boardZ, cell.x, cell.z);
      renderCellTile(x, z, { animate: false });
      if (world[x][z].kind) renderCellObject(x, z, { animate: false });
      // Mark the fresh meshes as revealed and force them visible — they
      // inherit no sticky-reveal state from the ghost mesh we removed,
      // so without this they'd start invisible whenever the cell sits
      // outside the small visible window (raw opacityAtWorldPosition
      // would return 0 and leave a hole).
      const _entry = cellMeshes[x + ',' + z];
      if (_entry) {
        if (_entry.tile)   { _entry.tile.userData.revealed = true;   setElementOpacity(_entry.tile, 1, true); }
        if (_entry.object) { _entry.object.userData.revealed = true; setElementOpacity(_entry.object, 1, true); }
      }
      applyTool(x, z, opts);
      // After setCell ran inside applyTool, re-stamp the override flag
      // AND re-force revealed/visible on whatever the latest mesh is.
      if (world[x] && world[x][z]) world[x][z].userEdited = true;
      const _entry2 = cellMeshes[x + ',' + z];
      if (_entry2) {
        if (_entry2.tile)   { _entry2.tile.userData.revealed = true;   setElementOpacity(_entry2.tile, 1, true); }
        if (_entry2.object) { _entry2.object.userData.revealed = true; setElementOpacity(_entry2.object, 1, true); }
      }
    } else {
      const boardX = cell.boardX || 0;
      const boardZ = cell.boardZ || 0;
      applyTool(cell.x + boardX * GRID, cell.z + boardZ * GRID, opts);
    }
    // Placement phase-in: release the live ghost as a fading holo echo so the
    // object "materialises" as the real mesh drops in. Skip during drag-paint
    // (opts.drawing) so we don't spawn an echo per cell.
    if (!opts.drawing && typeof releaseGhostPlacementEcho === 'function') releaseGhostPlacementEcho();
  }

  // Read the current ghost rotation/offset to attach to a fresh setCell.
  // Resets the live ghost transform so the next placement starts clean.
  function consumeGhostTransform() {
    // Snap one more time so the saved rotation matches the preview exactly
    // even if anything has nudged ghostRotation by a non-90° amount.
    const t = { rotationY: snapRot(ghostRotation), offsetX: ghostOffsetX, offsetZ: ghostOffsetZ };
    resetGhostTransform();
    return t;
  }

  function applySelectedToolToSelection() {
    if (window.__tinyworldIsPlayMode && window.__tinyworldIsPlayMode()) return false;
    const sel = window.__tinyworldSelection;
    if (!sel || !sel.cells || !sel.cells.size) return false;
    if (!selectedTool || selectedTool.select || selectedTool.auto || selectedTool.island || selectedTool.mooring) return false;
    const selectedCoords = sel.materialize
      ? sel.materialize()
      : (sel.worldCoords ? sel.worldCoords() : []);
    if (!selectedCoords.length) return false;
    if (selectedTool.kind === 'asset-template') {
      const template = selectedTool.assetTemplate || assetTemplateById(selectedTool.assetTemplateId || selectedAssetTemplateId);
      const clipboard = normalizeClipboardPayload(template && template.clipboard);
      if (!clipboard) return false;
      const placedCoords = [];
      selectedCoords.forEach(({ x: sx, z: sz }) => {
        const placed = pasteClipboardPayloadAtTarget(clipboard, { x: sx, z: sz, userEdited: isOutsideHomeGrid(sx, sz) }, {
          animate: true,
          impactDust: true,
          selectPlaced: false,
        });
        if (placed) {
          clipboard.cells.forEach(item => {
            placedCoords.push({ x: sx + item.dx, z: sz + item.dz });
          });
        }
      });
      if (!placedCoords.length) return false;
      if (sel.replaceWorldCoords) sel.replaceWorldCoords(placedCoords);
      else notifySelectionChanged();
      return true;
    }
    const ghostTransform = {
      rotation: ghostRotation,
      offsetX: ghostOffsetX,
      offsetZ: ghostOffsetZ,
    };
    selectedCoords.forEach(({ x: sx, z: sz }) => {
      ghostRotation = ghostTransform.rotation;
      ghostOffsetX = ghostTransform.offsetX;
      ghostOffsetZ = ghostTransform.offsetZ;
      applyTool(sx, sz, { skipSelectionBulk: true });
    });
    ghostRotation = ghostTransform.rotation;
    ghostOffsetX = ghostTransform.offsetX;
    ghostOffsetZ = ghostTransform.offsetZ;
    resetGhostTransform();
    notifySelectionChanged();
    return true;
  }

  // True unless a shared-room role forbids editing entirely (viewer/player).
  // Gates the non-per-cell edit paths (clipboard, keyboard shortcuts).
  function mpEditAllowed() {
    if (window.__tinyworldIsPlayMode && window.__tinyworldIsPlayMode()) return false;
    const mp = window.__tinyworldMultiplayer;
    return !mp || typeof mp.canEditAny !== 'function' || mp.canEditAny();
  }

  function applyTool(x, z, opts = {}) {
    if (window.__flightActive) return;
    if (window.__tinyworldIsPlayMode && window.__tinyworldIsPlayMode()) return;
    // Multiplayer role gate: in a shared room a viewer/player cannot edit at
    // all, and an editor only within its granted island bounds. We gate the
    // LOCAL mutation here (not just the broadcast) so a restricted client can't
    // desync its own view. Single-player and the host see no __tinyworldMultiplayer
    // gate (canEdit returns true), so this is a no-op outside shared rooms.
    const mp = window.__tinyworldMultiplayer;
    if (mp && typeof mp.canEdit === 'function' && !mp.canEdit(x, z)) return;
    if (selectedTool.mooring) return;
    if (selectedTool.island) {
      createEditableIsland(nextEditableIslandPosition(currentHover));
      return;
    }
    if (selectedTool.auto) {
      if (!getAIProviderState().key) return; // Can't auto-place without API key
      applyAutoTool(x, z);
      return;
    }
    if (selectedTool.select) {
      return;
    }
    if (selectedTool.sculpt) {
      // Sandbox terrain brush: edits the tile's N×N voxel sub-grid under the
      // cursor (a small radius, spilling across tile borders) so the surface
      // becomes a shaped voxel mesh — not a flat tower. Lower (dig) by default,
      // raise (mound) on the Raise variant. Drag paints one step per sub-cell.
      const variant = selectedTool.activeVariant;
      const up = !!(variant && variant.mode === 'raise');
      const lx = currentHover ? (currentHover.localX || 0) : 0;
      const lz = currentHover ? (currentHover.localZ || 0) : 0;
      sculptVoxelBrush(x, z, lx, lz, up);
      return;
    }
    if (selectedTool.kind === 'asset-template') {
      const template = selectedTool.assetTemplate || assetTemplateById(selectedTool.assetTemplateId || selectedAssetTemplateId);
      const clipboard = normalizeClipboardPayload(template && template.clipboard);
      if (!clipboard) return;
      pasteClipboardPayloadAtTarget(clipboard, { x, z, userEdited: isOutsideHomeGrid(x, z) }, { animate: true, impactDust: true });
      return;
    }

    // --- Bulk apply to active selection (Shift+select + tool) ---
    const sel = window.__tinyworldSelection;
    if (!opts.skipSelectionBulk && sel && sel.cells.size > 0) {
      const selectedCoords = sel.worldCoords ? sel.worldCoords() : [];
      if (selectedCoords.some(c => c.x === x && c.z === z)) {
        applySelectedToolToSelection();
        return;
      }
    }
    // ------------------------------------------------------------

    // Audible feedback for any user-initiated placement / erase. The
    // per-group rate limiter inside playSfx keeps drag-painting sane.
    if (typeof playSfxForTool === 'function') playSfxForTool(selectedTool);
    // Ensure world row exists
    if (!world[x]) world[x] = [];
    const cell = world[x][z] || { terrain: 'grass', terrainFloors: 1, kind: null, floors: 1, buildingType: null, fenceSide: null, extras: [] };
    if (selectedTool.erase) {
      // Peel decorations off first — tufts / fences sitting alongside
      // the main kind go before the main kind itself goes.
      if (cell.extras && cell.extras.length) {
        popCellExtra(x, z);
        return;
      }
      if (cell.kind) setCell(x, z, { terrain: cell.terrain, terrainFloors: terrainLevelForCell(cell), kind: null, floors: 1 });
      else if (cell.terrain !== 'grass') setCell(x, z, { terrain: 'grass', terrainFloors: terrainLevelForCell(cell), kind: null, floors: 1 });
      return;
    }
    if (selectedTool.kind === 'house') {
      if (cell.kind === 'house') {
        // Stack: clicking the house tool on an existing house adds a floor.
        const newFloors = Math.min((cell.floors || 1) + 1, MAX_FLOORS);
        if (newFloors === (cell.floors || 1)) return;
        // Floor stack preserves the existing buildingType (passing undefined).
        setCell(x, z, { terrain: cell.terrain, terrainFloors: terrainLevelForCell(cell), kind: 'house', floors: newFloors });
        return;
      }
      // Fresh placement — read buildingType from the active fly-out variant.
      const variant = selectedTool.activeVariant;
      const bType = (variant && variant.buildingType) || null;
      const terrainForHouse = cell.terrain || 'grass';
      const gt = consumeGhostTransform();
      setCell(x, z, { terrain: terrainForHouse, terrainFloors: terrainLevelForCell(cell), kind: 'house', buildingType: bType, rotationY: gt.rotationY, offsetX: gt.offsetX, offsetZ: gt.offsetZ });
      return;
    }
    if (selectedTool.kind === 'model-stamp') {
      const asset = getModelStamp(selectedTool.modelStampId);
      if (!asset || !asset.supported) return;
      const cfg = getModelStampSettings(asset.id);
      const gt = consumeGhostTransform();
      let newTerrain = cell.terrain || 'grass';
      if (newTerrain === 'water' || newTerrain === 'lava') newTerrain = 'grass';
      setCell(x, z, {
        terrain: newTerrain,
        terrainFloors: terrainLevelForCell(cell),
        kind: 'model-stamp',
        floors: 1,
        rotationY: cfg.rotationY + gt.rotationY,
        offsetX: gt.offsetX,
        offsetY: cfg.offsetY,
        offsetZ: gt.offsetZ,
        appearance: { modelStampId: asset.id, objectScale: cfg.objectScale },
      });
      return;
    }
    if (selectedTool.kind === 'voxel-build') {
      const stampId = selectedTool.voxelBuildId;
      if (!getVoxelBuildStamp(stampId)) return;
      const gt = consumeGhostTransform();
      let newTerrain = cell.terrain || 'grass';
      if (newTerrain === 'water' || newTerrain === 'lava') newTerrain = 'grass';
      setCell(x, z, {
        terrain: newTerrain,
        terrainFloors: terrainLevelForCell(cell),
        kind: 'voxel-build',
        floors: 1,
        rotationY: gt.rotationY,
        offsetX: gt.offsetX,
        offsetZ: gt.offsetZ,
        appearance: { voxelBuildId: stampId },
      });
      return;
    }
    if (selectedTool.kind === 'fence') {
      const side = fenceSideFromHover(currentHover);
      const baseLevel = fenceLevelFromSelectedTool();
      const fenceAppearance = typeof fenceAppearanceFromSelectedTool === 'function' ? fenceAppearanceFromSelectedTool() : null;
      const fenceStyle = typeof fenceStyleFromAppearance === 'function' ? fenceStyleFromAppearance(fenceAppearance) : 'wood';
      const cellFenceStyle = typeof fenceStyleForCell === 'function' ? fenceStyleForCell(cell) : 'wood';
      // Same-side fence on a fence cell → level it up in place.
      if (cell.kind === 'fence' && normalizeFenceSide(cell.fenceSide) === side && cellFenceStyle === fenceStyle) {
        if (opts.drawing) {
          if ((cell.floors || 1) >= baseLevel) return;
          setCell(x, z, { terrain: cell.terrain, terrainFloors: terrainLevelForCell(cell), kind: 'fence', floors: baseLevel, fenceSide: side, appearance: fenceAppearance });
          return;
        }
        const newLevel = Math.min(Math.max((cell.floors || 1) + 1, baseLevel), MAX_FLOORS);
        if (newLevel === (cell.floors || 1)) return;
        setCell(x, z, { terrain: cell.terrain, terrainFloors: terrainLevelForCell(cell), kind: 'fence', floors: newLevel, fenceSide: side, appearance: fenceAppearance });
        return;
      }
      // Same side but a different fence style → restyle the fence in place.
      if (cell.kind === 'fence' && normalizeFenceSide(cell.fenceSide) === side) {
        setCell(x, z, { terrain: cell.terrain, terrainFloors: terrainLevelForCell(cell), kind: 'fence', floors: baseLevel, fenceSide: side, appearance: fenceAppearance });
        return;
      }
      // Different-side fence on a fence cell → add the new side as an
      // extra so multiple fence sides co-exist on the same tile.
      if (cell.kind === 'fence') {
        addCellExtra(x, z, { kind: 'fence', fenceSide: side, floors: baseLevel, appearance: fenceAppearance }, { drawing: opts.drawing });
        return;
      }
      // Different main occupant → fence co-exists alongside it.
      if (cell.kind && cell.kind !== 'fence') {
        addCellExtra(x, z, { kind: 'fence', fenceSide: side, floors: baseLevel, appearance: fenceAppearance }, { drawing: opts.drawing });
        return;
      }
      // Empty cell → fence becomes the main kind.
      const gt2 = consumeGhostTransform();
      setCell(x, z, { terrain: cell.terrain, terrainFloors: terrainLevelForCell(cell), kind: 'fence', floors: baseLevel, fenceSide: side, rotationY: gt2.rotationY, offsetX: gt2.offsetX, offsetZ: gt2.offsetZ, appearance: fenceAppearance });
      return;
    }
    if (selectedTool.kind) {
      if (cell.kind === selectedTool.kind) {
        if (opts.drawing) return;
        // Bridges have only 4 visual styles (wood → covered → stone → arch),
        // so cap their stacking there instead of running up to MAX_FLOORS.
        const stackMax = selectedTool.kind === 'bridge' ? 4 : MAX_FLOORS;
        const newLevel = Math.min((cell.floors || 1) + 1, stackMax);
        if (newLevel === (cell.floors || 1)) return;
        setCell(x, z, { terrain: cell.terrain, terrainFloors: terrainLevelForCell(cell), kind: selectedTool.kind, floors: newLevel });
        return;
      }
      // Tufts are decorative — they go alongside another main kind
      // rather than replacing it.
      if (selectedTool.kind === 'tuft' && cell.kind && cell.kind !== 'tuft') {
        addCellExtra(x, z, { kind: 'tuft' });
        return;
      }
      // If the tile's current main is a fence or tuft, demote it to an
      // extra rather than squashing it so they can co-exist with the
      // new primary kind. Otherwise squash as usual (rocks etc.).
      const incomingPrimary = selectedTool.kind;
      const demote = (cell.kind === 'fence' || cell.kind === 'tuft') && incomingPrimary !== 'fence' && incomingPrimary !== 'tuft';
      let newTerrain = selectedTool.terrainOverride || cell.terrain;
      // Rocks keep the underlying terrain even on water; everything
      // else falls back to grass over water (existing behaviour).
      if (incomingPrimary !== 'rock' && incomingPrimary !== 'model-stamp' && newTerrain === 'water' && incomingPrimary !== 'bridge') newTerrain = 'grass';
      if (demote) {
        const carriedExtras = (cell.extras || []).slice();
        carriedExtras.push(cell.kind === 'fence'
          ? { kind: 'fence', fenceSide: cell.fenceSide || 'n', floors: cell.floors || 1, appearance: normalizeAppearance(cell.appearance) }
          : { kind: 'tuft', floors: cell.floors || 1 });
        const gtd = consumeGhostTransform();
        setCell(x, z, { terrain: newTerrain, terrainFloors: terrainLevelForCell(cell), kind: incomingPrimary, floors: 1, extras: carriedExtras, rotationY: gtd.rotationY, offsetX: gtd.offsetX, offsetZ: gtd.offsetZ });
        return;
      }
      if (cell.kind && cell.kind !== incomingPrimary && incomingPrimary === 'rock') {
        squashExistingObject(x, z);
      }
      const gtf = consumeGhostTransform();
      setCell(x, z, { terrain: newTerrain, terrainFloors: terrainLevelForCell(cell), kind: incomingPrimary, floors: 1, rotationY: gtf.rotationY, offsetX: gtf.offsetX, offsetZ: gtf.offsetZ });
      return;
    }
    if (selectedTool.terrain) {
      let nextKind = cell.kind;
      if (selectedTool.terrain === 'water' && nextKind !== 'bridge') nextKind = null;
      if (nextKind === 'bridge' && selectedTool.terrain !== 'water') nextKind = null;
      if (CROP_KINDS.has(nextKind) && selectedTool.terrain !== 'dirt') nextKind = null;
      const sameTerrain = selectedTool.terrain === cell.terrain;
      const nextTerrainFloors = nextKind
        ? terrainLevelForCell(cell)
        : (sameTerrain
          ? (opts.drawing ? terrainLevelForCell(cell) : Math.min(terrainLevelForCell(cell) + 1, MAX_FLOORS))
          : 1);
      setCell(x, z, {
        terrain: selectedTool.terrain,
        terrainFloors: nextTerrainFloors,
        kind: nextKind,
        floors: nextKind ? (cell.floors || 1) : 1,
        buildingType: nextKind === 'house' ? cell.buildingType : null,
      });
    }
  }

  async function applyAutoTool(x, z) {
    if (autoBusy) return;
    setAutoBusy(true);
    try {
      const action = await getNextAutoSuggestion();
      const normalized = adaptAutoSuggestionToCell(action, x, z);
      setCell(x, z, {
        terrain: normalized.terrain,
        kind: normalized.kind,
        floors: normalized.floors,
        buildingType: normalized.buildingType,
      });
      autoPlacementsSinceRefresh++;
    } catch (err) {
      console.error('auto failed:', err);
      const msg = String(err.message || err);
      if (msg.indexOf('API key') !== -1 && openGenerateModal) {
        openGenerateModal('enter an API key for Auto');
      } else {
        alert('Auto could not choose a cell: ' + msg.slice(0, 120));
      }
    } finally {
      setAutoBusy(false);
    }
  }

  // -------- input: drag-to-orbit + click-to-place + multi-touch --------
  let pointerDown = null;     // {x, y}
  let lastPointer = null;
  let didDrag = false;
  let dragMode = null;        // 'orbit' | 'pan' | 'pinch' | 'select-area' | 'draw' | 'move-selection' | 'transform-gizmo' | 'engine-select' | 'mooring'
  let selectionDragAnchor = null;
  let selectionMoveDragLastCoord = null;
  // Click-selection state (Select tool). lastSelectionAnchor is the last single
  // cell the user picked — the anchor for a Shift+click contiguous range.
  // pointerDownHit/Mods snapshot the press so we can resolve a click on pointerup
  // even if a modifier is released before mouseup.
  let lastSelectionAnchor = null;
  let pointerDownHit = null;
  let pointerDownMods = { shift: false, meta: false };
  let transformGizmoDrag = null;
  const drawVisitedCells = new Set();
  const drawChangedWorldCoords = new Map();
  let drawLastWorldCoord = null;
  let spaceDown = false;
  const DRAG_THRESHOLD = 5;
  const activePointers = new Map(); // pointerId -> {x, y, type}
  let pinchPrevDist = 0;
  let pinchPrevMid = null;
  let generationViewLocked = false;

  function setGenerationViewLocked(locked) {
    generationViewLocked = !!locked;
    document.body.classList.toggle('generation-locked', generationViewLocked);
    if (!generationViewLocked) return;
    activePointers.clear();
    pointerDown = null;
    lastPointer = null;
    didDrag = false;
    dragMode = null;
    worldHistoryMuted = false;
    transformGizmoDrag = null;
    drawVisitedCells.clear();
    drawChangedWorldCoords.clear();
    drawLastWorldCoord = null;
    spaceDown = false;
    pinchPrevDist = 0;
    pinchPrevMid = null;
    hoverMesh.visible = false;
    currentHover = null;
    renderer.domElement.classList.remove('dragging');
    updateGhostPlacement();
  }

  // -------- island placement (8-slot grid hologram) --------
  // When the Island tool is active and at least one editable island exists, the
  // blank-island hologram snaps to one of the 8 board-neighbour slots around the
  // anchor island (skipping occupied slots) instead of following the cursor, and
  // a click places the new island in that slot. The first island (no anchor)
  // still places via the normal cursor path.
  const ISLAND_SLOT_DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]; // S,N,E,W, then diagonals
  function islandToolActive() { return !!(selectedTool && selectedTool.island); }
  // Anchor to add an island AROUND: the selected sky-island, else the most
  // recent one, else the HOME world board (origin) so the first sky-island can
  // be positioned around the main world.
  function islandPlacementAnchor() {
    const sel = (typeof selectedEditableIsland === 'function' && selectedEditableIsland());
    if (sel) return sel;
    if (editableIslands.length) return editableIslands[editableIslands.length - 1];
    return { positionX: 0, positionY: 0, positionZ: 0, __home: true };
  }
  // 8 candidate visual positions around the anchor. Occupancy is by VISUAL
  // position (an existing island already sitting there), NOT board key — so this
  // works for the home anchor and for gizmo-moved islands. Placement assigns a
  // fresh editable-island board, so slots never collide with home/ghost boards.
  function islandPlacementSlots(anchor) {
    if (!anchor) return [];
    const gap = GRID + 1;
    return ISLAND_SLOT_DIRS.map(([dx, dz]) => {
      const positionX = (anchor.positionX || 0) + dx * gap;
      const positionZ = (anchor.positionZ || 0) + dz * gap;
      const positionY = (anchor.positionY || 0);
      const occupied = editableIslands.some(isl =>
        Math.abs((isl.positionX || 0) - positionX) < gap * 0.5 &&
        Math.abs((isl.positionZ || 0) - positionZ) < gap * 0.5);
      return { dx, dz, positionX, positionY, positionZ, free: !occupied };
    });
  }
  function freeIslandSlots(anchor) { return islandPlacementSlots(anchor).filter(s => s.free); }
  function defaultIslandSlot(anchor) { const f = freeIslandSlots(anchor); return f.length ? f[0] : null; }
  // Pure: nearest free slot to a world point (or first free when off-grid). Exposed for tests.
  function islandSlotForPoint(anchor, wx, wz) {
    const slots = freeIslandSlots(anchor);
    if (!slots.length) return null;
    if (!Number.isFinite(wx) || !Number.isFinite(wz)) return slots[0];
    let best = slots[0], bestD = Infinity;
    for (const s of slots) {
      const d = (s.positionX - wx) ** 2 + (s.positionZ - wz) ** 2;
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }
  function islandHoverSlot(cell) {
    const anchor = islandPlacementAnchor();
    if (!anchor) return null;
    if (cell && Number.isFinite(cell.worldX)) return islandSlotForPoint(anchor, cell.worldX, cell.worldZ);
    return defaultIslandSlot(anchor);
  }
  function islandSlotHoverCell(slot) {
    return {
      x: 0, z: 0,
      worldX: slot.positionX, worldY: slot.positionY, worldZ: slot.positionZ,
      __islandSlot: slot, __islandSlotY: slot.positionY,
    };
  }
  // Show the hologram at the default slot the moment the Island tool is picked
  // (or right after placing, to anchor the next one).
  function onIslandToolSelected() {
    if (!islandToolActive()) return;
    if (typeof refreshIslandPlacementHolos === 'function') { refreshIslandPlacementHolos(); return; }
    const slot = defaultIslandSlot(islandPlacementAnchor());
    if (slot) setHoverFromCell(islandSlotHoverCell(slot));
  }
  if (typeof window !== 'undefined') {
    window.__islandPlacement = {
      anchor: islandPlacementAnchor,
      slots: islandPlacementSlots,
      slotForPoint: islandSlotForPoint,
      defaultSlot: defaultIslandSlot,
    };
  }

  function setHoverFromCell(cell) {
    if (islandToolActive()) {
      const slot = islandHoverSlot(cell);
      if (slot) {
        hoverMesh.visible = false; // whole-island placement: no per-tile marker
        currentHover = islandSlotHoverCell(slot);
        updateGhostPlacement();
        return;
      }
      // Island tool but every slot is occupied: do NOT blanket the board with a
      // giant island ghost — hide it. Placement still works via the click path.
      hoverMesh.visible = false;
      currentHover = null;
      updateGhostPlacement();
      return;
    }
    if (cell) {
      hoverMesh.position.set(cell.worldX, hoverHeightForCell(cell), cell.worldZ);
      hoverMesh.visible = true;
      currentHover = cell;
    } else {
      hoverMesh.visible = false;
      currentHover = null;
    }
    updateGhostPlacement();
  }

  function updateHoverAt(x, y) {
    if (selectedTool && selectedTool.island && typeof updateIslandPlacementHolos === 'function') {
      updateIslandPlacementHolos(x, y);
      return;
    }
    if (typeof clearIslandPlacementHolos === 'function') clearIslandPlacementHolos();
    setHoverFromCell(pickTile(x, y));
  }

  function isDrawablePlacementTool(tool) {
    return !!(tool && !tool.auto && !tool.select && (
      tool.erase ||
      tool.terrain ||
      tool.sculpt ||
      tool.kind === 'fence' ||
      tool.kind === 'bridge'
    ));
  }

  function drawKeyForHit(hit) {
    if (!hit) return '';
    const bx = hit.boardX || 0;
    const bz = hit.boardZ || 0;
    const x = hit.x + bx * GRID;
    const z = hit.z + bz * GRID;
    if (selectedTool && selectedTool.kind === 'fence') {
      return x + ',' + z + ':' + fenceSideFromHover(hit);
    }
    if (selectedTool && selectedTool.sculpt) {
      // Per-sub-cell stroke key so a drag paints individual voxels within a tile
      // (not just once per tile), and revisiting the same voxel in one stroke
      // doesn't keep deepening it.
      const c = getWorldCell(x, z);
      const n = (c.voxels && c.voxels.n) || sculptResolutionNumeric();
      const lx = Number.isFinite(hit.localX) ? hit.localX : 0;
      const lz = Number.isFinite(hit.localZ) ? hit.localZ : 0;
      const li = Math.max(0, Math.min(n - 1, Math.floor((Math.max(-0.5, Math.min(0.5, lx)) + 0.5) * n)));
      const lj = Math.max(0, Math.min(n - 1, Math.floor((Math.max(-0.5, Math.min(0.5, lz)) + 0.5) * n)));
      return x + ',' + z + ':v' + li + ',' + lj;
    }
    return x + ',' + z;
  }

  function drawWorldCoordForHit(hit) {
    if (!hit) return null;
    const bx = hit.boardX || 0;
    const bz = hit.boardZ || 0;
    return { x: hit.x + bx * GRID, z: hit.z + bz * GRID };
  }

  function isSelectedWorldHit(hit) {
    const coord = drawWorldCoordForHit(hit);
    const sel = window.__tinyworldSelection;
    return !!(coord && sel && sel.containsWorldCoord && sel.containsWorldCoord(coord.x, coord.z));
  }

  function drawFenceSideForStep(from, to, sourceHit) {
    if (!from || !to) return null;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    if (!dx && !dz) return null;
    const localX = sourceHit && Number.isFinite(sourceHit.localX) ? sourceHit.localX : 0;
    const localZ = sourceHit && Number.isFinite(sourceHit.localZ) ? sourceHit.localZ : 0;
    if (Math.abs(dx) > Math.abs(dz)) return localZ < 0 ? 'n' : (localZ > 0 ? 's' : 'n');
    if (Math.abs(dz) > Math.abs(dx)) return localX < 0 ? 'w' : (localX > 0 ? 'e' : 'w');
    if (Math.abs(localX) > Math.abs(localZ)) return localX < 0 ? 'w' : 'e';
    return localZ < 0 ? 'n' : 's';
  }

  function drawHitFromWorldCoord(x, z, sourceHit, drawFenceSide = null) {
    const boardX = floorDiv(x, GRID);
    const boardZ = floorDiv(z, GRID);
    const lx = positiveMod(x, GRID);
    const lz = positiveMod(z, GRID);
    const island = editableIslandForBoard(boardX, boardZ);
    const p = island ? editableIslandCellDisplayPoint(island, lx, lz) : ((boardX || boardZ) ? ghostCellPos(boardX, boardZ, lx, lz) : tilePos(lx, lz));
    return {
      x: lx,
      z: lz,
      boardX,
      boardZ,
      editableIslandId: island ? island.id : undefined,
      worldX: p.x,
      worldY: p.y,
      worldZ: p.z,
      localX: sourceHit && Number.isFinite(sourceHit.localX) ? sourceHit.localX : 0,
      localZ: sourceHit && Number.isFinite(sourceHit.localZ) ? sourceHit.localZ : 0,
      drawFenceSide,
    };
  }

  function applyDrawToolToSingleHit(hit) {
    if (!hit) return false;
    const key = drawKeyForHit(hit);
    if (!key || drawVisitedCells.has(key)) return false;
    drawVisitedCells.add(key);
    setHoverFromCell(hit);
    applyToolToCell(hit, { skipSelectionBulk: true, drawing: true });
    if (!(selectedTool && selectedTool.erase)) {
      const coord = drawWorldCoordForHit(hit);
      if (coord) drawChangedWorldCoords.set(coord.x + ',' + coord.z, coord);
    }
    return true;
  }

  function applyDrawToolToHit(hit) {
    const coord = drawWorldCoordForHit(hit);
    if (!coord) return false;
    // Sculpt paints in sub-cell space; the per-tile coord interpolation below
    // would skip within-tile voxels, so apply directly at the live cursor (the
    // sub-cell stroke key still prevents re-hitting the same voxel).
    if (selectedTool && selectedTool.sculpt) {
      const changedSculpt = applyDrawToolToSingleHit(hit);
      drawLastWorldCoord = coord;
      return changedSculpt;
    }
    let changed = false;
    if (drawLastWorldCoord) {
      const dx = coord.x - drawLastWorldCoord.x;
      const dz = coord.z - drawLastWorldCoord.z;
      const steps = Math.max(Math.abs(dx), Math.abs(dz));
      let prevCoord = drawLastWorldCoord;
      for (let i = 1; i <= steps; i++) {
        const x = Math.round(drawLastWorldCoord.x + dx * (i / steps));
        const z = Math.round(drawLastWorldCoord.z + dz * (i / steps));
        const stepCoord = { x, z };
        const drawFenceSide = drawFenceSideForStep(prevCoord, stepCoord, hit);
        changed = applyDrawToolToSingleHit(drawHitFromWorldCoord(x, z, hit, drawFenceSide)) || changed;
        prevCoord = stepCoord;
      }
    } else {
      changed = applyDrawToolToSingleHit(hit);
    }
    drawLastWorldCoord = coord;
    return changed;
  }

  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

  renderer.domElement.addEventListener('pointerdown', e => {
    if (generationViewLocked) {
      e.preventDefault();
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) {}

    if (activePointers.size >= 2) {
      const pts = [...activePointers.values()];
      pinchPrevDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchPrevMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      dragMode = 'pinch';
      didDrag = true;
      pointerDown = null;
      hoverMesh.visible = false;
      currentHover = null;
      renderer.domElement.classList.add('dragging');
      return;
    }

    if (selectedTool && selectedTool.mooring && e.button === 0 && !spaceDown && !e.shiftKey && !e.metaKey && !e.ctrlKey && mpEditAllowed()) {
      const anchor = pickMooringAnchor(e.clientX, e.clientY);
      if (anchor) handleMooringAnchorPick(anchor);
      else showMooringStatus('Pick a visible island surface, away from engines', true);
      dragMode = 'mooring';
      pointerDown = { x: e.clientX, y: e.clientY };
      lastPointer = { x: e.clientX, y: e.clientY };
      didDrag = false;
      hoverMesh.visible = false;
      currentHover = null;
      renderer.domElement.classList.add('dragging');
      e.preventDefault();
      return;
    }

    const subGizmoActive = window.__tinyworldSubEdit && window.__tinyworldSubEdit.selectedGizmoTarget
      ? window.__tinyworldSubEdit.selectedGizmoTarget()
      : null;
    const gizmoHit = e.button === 0 && !spaceDown && !e.metaKey && !e.ctrlKey && mpEditAllowed() && (!e.shiftKey || subGizmoActive)
      ? pickTransformGizmo(e.clientX, e.clientY)
      : null;
    if (gizmoHit) {
      pushWorldHistorySnapshot();
      worldHistoryMuted = true;
      dragMode = 'transform-gizmo';
      transformGizmoDrag = { action: gizmoHit.action, x: e.clientX, y: e.clientY };
      pointerDown = { x: e.clientX, y: e.clientY };
      lastPointer = { x: e.clientX, y: e.clientY };
      didDrag = true;
      hoverMesh.visible = false;
      renderer.domElement.classList.add('dragging');
      e.preventDefault();
      return;
    }

    // Sub-object part pick: when an object is in part-edit mode, a plain click
    // selects the sub-part under the cursor (door/window/wall/roof/voxel) rather
    // than falling through to cell selection on pointerup. Runs before the
    // engine/cell paths and marks the drag so pointerup doesn't clobber it.
    const sub = window.__tinyworldSubEdit;
    const subPlainClick = e.button === 0 && !spaceDown && !e.shiftKey && !e.metaKey && !e.ctrlKey && mpEditAllowed()
      && sub && sub.isActive && sub.isActive();
    const subHit = (subPlainClick && sub._pick)
      ? sub._pick(e.clientX, e.clientY)
      : null;
    if (subHit) {
      sub.selectPart(subHit.partKey);
      dragMode = 'subpart-select';
      pointerDown = { x: e.clientX, y: e.clientY };
      lastPointer = { x: e.clientX, y: e.clientY };
      didDrag = false;
      hoverMesh.visible = false;
      currentHover = null;
      renderer.domElement.classList.add('dragging');
      e.preventDefault();
      return;
    }
    if (subPlainClick) {
      if (sub.exit) sub.exit();
      dragMode = 'subpart-cancel';
      pointerDown = { x: e.clientX, y: e.clientY };
      lastPointer = { x: e.clientX, y: e.clientY };
      didDrag = false;
      hoverMesh.visible = false;
      currentHover = null;
      renderer.domElement.classList.add('dragging');
      e.preventDefault();
      return;
    }

    const engineHit = e.button === 0 && !spaceDown && !e.shiftKey && !e.metaKey && !e.ctrlKey && mpEditAllowed()
      ? pickEditableIslandEngine(e.clientX, e.clientY)
      : null;
    if (engineHit) {
      selectEditableIslandEngine(engineHit);
      dragMode = 'engine-select';
      pointerDown = { x: e.clientX, y: e.clientY };
      lastPointer = { x: e.clientX, y: e.clientY };
      didDrag = false;
      hoverMesh.visible = false;
      currentHover = null;
      renderer.domElement.classList.add('dragging');
      e.preventDefault();
      return;
    }

    const pressHit = pickTile(e.clientX, e.clientY);
    const wantsDraw = e.button === 0 && !spaceDown && !e.shiftKey && !e.metaKey && mpEditAllowed() && isDrawablePlacementTool(selectedTool);
    const wantsSelectionMove = e.button === 0 && !spaceDown && !e.shiftKey && !e.metaKey && mpEditAllowed() && selectedTool && selectedTool.select && isSelectedWorldHit(pressHit);
    dragMode = wantsDraw ? 'draw' : wantsSelectionMove ? 'move-selection' : ((e.button === 2 || spaceDown) ? 'pan' : 'orbit');
    selectionMoveDragLastCoord = wantsSelectionMove ? drawWorldCoordForHit(pressHit) : null;
    // Rectangle drag (Shift+drag):
    //   - With Select tool → normal area selection
    //   - With any other tool → live preview rectangle; on release we fill the area with the current tool
    // Area selection triggers only on Shift+drag now. Cmd/Ctrl+drag used to
    // do the same — turned off so users don't accidentally rectangle-select
    // while reaching for a system shortcut.
    // Cmd/Ctrl+Shift+click is a discontiguous toggle (resolved on pointerup),
    // so keep the marquee on plain Shift only — otherwise it would clobber the
    // toggle. (Cmd/Ctrl alone stays off per the note above.)
    if (dragMode === 'orbit' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
      const hit = pressHit;
      if (hit) {
        dragMode = 'select-area';
        selectionDragAnchor = { hit };
        // No immediate replace: a Shift *drag* fills the marquee on pointermove,
        // while a Shift *click* (no drag) extends a range from lastSelectionAnchor
        // on pointerup. Selecting here would collapse the click to one cell.
      }
    }
    pointerDown = { x: e.clientX, y: e.clientY };
    lastPointer = { x: e.clientX, y: e.clientY };
    pointerDownHit = pressHit;
    pointerDownMods = { shift: !!e.shiftKey, meta: !!(e.metaKey || e.ctrlKey) };
    didDrag = false;
    drawVisitedCells.clear();
    drawChangedWorldCoords.clear();
    drawLastWorldCoord = null;
    // Touch devices don't have hover before contact, so prime currentHover
    // at the press location so a quick tap can place a tile.
    if (dragMode === 'draw') {
      const hit = pressHit;
      didDrag = !!applyDrawToolToHit(hit);
    } else if (e.pointerType !== 'mouse') {
      updateHoverAt(e.clientX, e.clientY);
    }
    renderer.domElement.classList.add('dragging');
  });

  renderer.domElement.addEventListener('pointermove', e => {
    if (generationViewLocked) {
      e.preventDefault();
      return;
    }
    if (activePointers.has(e.pointerId)) {
      const p = activePointers.get(e.pointerId);
      p.x = e.clientX; p.y = e.clientY;
    }

    if (dragMode === 'pinch' && activePointers.size >= 2) {
      markCameraMoving();
      const pts = [...activePointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      if (pinchPrevDist > 0 && dist > 0) {
        const ratio = pinchPrevDist / dist;
        viewSize = clampViewSize(viewSize * ratio);
        onResize();
      }
      if (pinchPrevMid) {
        panCameraByPixels(mid.x - pinchPrevMid.x, mid.y - pinchPrevMid.y);
      }
      pinchPrevDist = dist;
      pinchPrevMid = mid;
      return;
    }

    if (dragMode === 'transform-gizmo' && transformGizmoDrag) {
      const ddx = e.clientX - transformGizmoDrag.x;
      const ddy = e.clientY - transformGizmoDrag.y;
      if (Math.abs(ddx) + Math.abs(ddy) > 0) {
        applyTransformGizmoDrag(transformGizmoDrag.action, ddx, ddy, { shiftKey: e.shiftKey, altKey: e.altKey });
        transformGizmoDrag.x = e.clientX;
        transformGizmoDrag.y = e.clientY;
        didDrag = true;
      }
      lastPointer = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }

    // hover update for mouse devices (touch hover handled on press)
    if (e.pointerType === 'mouse' || !pointerDown) {
      updateHoverAt(e.clientX, e.clientY);
    }

    if (pointerDown) {
      const dx = e.clientX - pointerDown.x;
      const dy = e.clientY - pointerDown.y;
      if (!didDrag && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) didDrag = true;
      if (didDrag) {
        const ddx = e.clientX - lastPointer.x;
        const ddy = e.clientY - lastPointer.y;
        if (dragMode === 'pan') {
          panCameraByPixels(ddx, ddy);
        } else if (dragMode === 'draw') {
          applyDrawToolToHit(pickTile(e.clientX, e.clientY));
        } else if (dragMode === 'select-area') {
          // Extend the marquee rectangle to the cell under the cursor.
          const hit = pickTile(e.clientX, e.clientY);
          if (hit && selectionDragAnchor) {
            setRectangleSelection(selectionDragAnchor.hit, hit, 'replace');
          }
        } else if (dragMode === 'move-selection') {
          const hit = pickTile(e.clientX, e.clientY);
          const coord = drawWorldCoordForHit(hit);
          if (coord && selectionMoveDragLastCoord) {
            const moveDx = coord.x - selectionMoveDragLastCoord.x;
            const moveDz = coord.z - selectionMoveDragLastCoord.z;
            if ((moveDx || moveDz) && shiftSelectedCellIntent(moveDx, moveDz)) {
              selectionMoveDragLastCoord = coord;
            }
          }
        } else if (dragMode === 'engine-select') {
          // Engine clicks select the attachment; dragging should not orbit.
        } else if (dragMode === 'mooring') {
          // Mooring placement is a point-to-point click flow; dragging should not orbit.
        } else {
          markCameraMoving();
          // azimuth -= ddx * 0.008;
          azimuth += ddx * 0.008;
          polar = Math.max(MIN_ORBIT_POLAR, Math.min(MAX_ORBIT_POLAR, polar - ddy * 0.006));
          updateCamera();
        }
        // While dragging on touch, hide the hover marker so it doesn't lag.
        if (e.pointerType !== 'mouse' && dragMode !== 'draw') {
          hoverMesh.visible = false;
          currentHover = null;
        }
      }
      lastPointer = { x: e.clientX, y: e.clientY };
    }
  });

  renderer.domElement.addEventListener('pointerleave', () => {
    if (pointerDown || activePointers.size) return;
    setHoverFromCell(null);
  });

  renderer.domElement.addEventListener('pointerup', e => {
    if (generationViewLocked) {
      e.preventDefault();
      activePointers.delete(e.pointerId);
      renderer.domElement.classList.remove('dragging');
      return;
    }
    activePointers.delete(e.pointerId);
    renderer.domElement.classList.remove('dragging');

    if (dragMode === 'pinch') {
      if (activePointers.size === 1) {
        // Drop from pinch back to one-finger: continue as pan, no click.
        const [remaining] = [...activePointers.values()];
        pointerDown = { x: remaining.x, y: remaining.y };
        lastPointer = { x: remaining.x, y: remaining.y };
        didDrag = true;
        dragMode = 'pan';
        renderer.domElement.classList.add('dragging');
      } else {
        dragMode = null;
        pointerDown = null;
        lastPointer = null;
      }
      pinchPrevDist = 0;
      pinchPrevMid = null;
      return;
    }

    if (dragMode === 'transform-gizmo') {
      worldHistoryMuted = false;
      transformGizmoDrag = null;
      pointerDown = null;
      lastPointer = null;
      dragMode = null;
      notifySelectionChanged();
      e.preventDefault();
      return;
    }

    // Resolve a click (no drag). engine-select / transform-gizmo already
    // selected on press and return early, so exclude them; pan/draw/mooring/
    // pinch aren't clicks. Modifier clicks select on any tool; a plain click
    // selects with the Select tool, otherwise applies the active tool.
    if (pointerDown && !didDrag
        && dragMode !== 'pan' && dragMode !== 'draw' && dragMode !== 'mooring'
        && dragMode !== 'pinch' && dragMode !== 'engine-select' && dragMode !== 'transform-gizmo'
        && dragMode !== 'subpart-select' && dragMode !== 'subpart-cancel') {
      const hit = pointerDownHit;
      const mods = pointerDownMods;
      // A placed plane is interactive: a plain (unmodified) click on it opens
      // the Enter / Fly menu regardless of the active tool — you still remove it
      // with the eraser. This must come before the place/select branches so a
      // click on a plane never stacks/replaces it.
      const _planeWX = hit ? hit.x + (hit.boardX || 0) * GRID : 0;
      const _planeWZ = hit ? hit.z + (hit.boardZ || 0) * GRID : 0;
      // Multiplayer: viewers cannot interact with placed things (no fly);
      // players and editors/host can. Outside a shared room canInteract is
      // absent => unrestricted.
      const _mpInteract = window.__tinyworldMultiplayer;
      const _canInteract = !_mpInteract || typeof _mpInteract.canInteract !== 'function' || _mpInteract.canInteract();
      const _clickedPlane = _canInteract && hit && !mods.shift && !mods.meta
        && selectedTool && !selectedTool.erase
        && world[_planeWX] && world[_planeWX][_planeWZ]
        && typeof isFlyableStampCell === 'function'
        && isFlyableStampCell(world[_planeWX][_planeWZ]);
      if (_clickedPlane && typeof showFlightMenu === 'function') {
        showFlightMenu(_planeWX, _planeWZ, e.clientX, e.clientY);
        if (selectedTool.select && mpEditAllowed()) { setRectangleSelection(hit, hit, 'replace'); lastSelectionAnchor = hit; }
      } else if (!mpEditAllowed()) {
        // Multiplayer viewer/player: a plain click is camera-only — no select,
        // no radial, no place. (A plane click is the fly branch above for a
        // player; a viewer cannot interact at all.)
      } else if (mods.meta && mods.shift) {
        // Cmd/Ctrl+Shift+click → toggle one cell on/off (discontiguous).
        if (hit) { toggleCellSelection(hit); lastSelectionAnchor = hit; }
      } else if (mods.shift) {
        // Shift+click → contiguous range from the last anchor, added to the
        // current selection (or just this cell if there's no anchor yet).
        if (hit) {
          if (lastSelectionAnchor) setRectangleSelection(lastSelectionAnchor, hit, 'add');
          else setRectangleSelection(hit, hit, 'add');
          lastSelectionAnchor = hit;
        }
      } else if (selectedTool && selectedTool.select) {
        // Plain click with the Select tool. Resolve by the CLOSEST surface:
        // a top tile selects that cell; the island's side/base selects the
        // WHOLE island (outline + move gizmo). Empty space clears.
        const res = (typeof resolveIslandClick === 'function' && pointerDown)
          ? resolveIslandClick(pointerDown.x, pointerDown.y)
          : (hit ? { kind: 'cell', cell: hit } : null);
        if (res && res.kind === 'island') {
          clearSelection();
          selectEditableIsland(res.island);
          lastSelectionAnchor = null;
        } else if (res && res.kind === 'cell') {
          setRectangleSelection(res.cell, res.cell, 'replace'); lastSelectionAnchor = res.cell;
          if (typeof setIslandSelectionOutline === 'function') setIslandSelectionOutline(null);
        } else {
          clearSelection(); lastSelectionAnchor = null;
          if (typeof setIslandSelectionOutline === 'function') setIslandSelectionOutline(null);
        }
      } else if (currentHover) {
        // Plain click with any other tool → place/erase as before.
        applyToolToCell(currentHover);
      }
    }
    // After Shift+drag rectangle with a placement tool: fill the whole area
    if (dragMode === 'select-area' && didDrag && selectedTool && !selectedTool.select) {
      const sel = window.__tinyworldSelection;
      if (sel && sel.cells.size > 0) {
        // Trigger the bulk path inside applyTool by calling it on any selected cell.
        // Keep the selection active for immediate colour/material/transform edits.
        const firstCoord = sel.worldCoords && sel.worldCoords()[0];
        if (firstCoord) {
          applyTool(firstCoord.x, firstCoord.z);   // will hit the selection bulk logic
        }
      }
    }

    // (Shift+click + shift+drag are handled by setRectangleSelection
    // in pointerdown/pointermove respectively.)
    if (activePointers.size === 0) {
      if (dragMode === 'draw' && drawChangedWorldCoords.size && window.__tinyworldSelection && window.__tinyworldSelection.replaceWorldCoords) {
        window.__tinyworldSelection.replaceWorldCoords(Array.from(drawChangedWorldCoords.values()));
      }
      pointerDown = null;
      lastPointer = null;
      dragMode = null;
      selectionDragAnchor = null;
      selectionMoveDragLastCoord = null;
      drawVisitedCells.clear();
      drawChangedWorldCoords.clear();
      drawLastWorldCoord = null;
      // Touch devices: clear the hover marker after a tap so it doesn't linger.
      if (e.pointerType !== 'mouse') {
        hoverMesh.visible = false;
        currentHover = null;
      }
    }
  });

  renderer.domElement.addEventListener('pointercancel', e => {
    if (generationViewLocked) {
      e.preventDefault();
      activePointers.delete(e.pointerId);
      renderer.domElement.classList.remove('dragging');
      return;
    }
    activePointers.delete(e.pointerId);
    renderer.domElement.classList.remove('dragging');
    if (activePointers.size === 0) {
      pointerDown = null;
      lastPointer = null;
      dragMode = null;
      worldHistoryMuted = false;
      transformGizmoDrag = null;
      pinchPrevDist = 0;
      pinchPrevMid = null;
      selectionMoveDragLastCoord = null;
      drawVisitedCells.clear();
      drawChangedWorldCoords.clear();
      drawLastWorldCoord = null;
    }
  });

  renderer.domElement.addEventListener('wheel', e => {
    e.preventDefault();
    if (generationViewLocked) return;
    markCameraMoving();
    viewSize = clampViewSize(viewSize + e.deltaY * 0.005);
    onResize();
  }, { passive: false });

  const MODAL_FOCUS_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  function getFocusableInModal(modal) {
    return Array.from(modal.querySelectorAll(MODAL_FOCUS_SELECTOR))
      .filter(el => el.offsetParent !== null || el === document.activeElement);
  }
  function topOpenModal() {
    const open = Array.from(document.querySelectorAll('.modal:not([hidden]), .auth-modal:not([hidden])'));
    return open.length ? open[open.length - 1] : null;
  }
  function openTinyModal(modal, initialFocus) {
    if (!modal) return;
    modal.__returnFocus = document.activeElement && document.activeElement.focus ? document.activeElement : null;
    modal.hidden = false;
    const targetEl = initialFocus || getFocusableInModal(modal)[0] || modal.querySelector('[role="dialog"]') || modal;
    if (targetEl && !targetEl.hasAttribute('tabindex') && targetEl === modal) targetEl.setAttribute('tabindex', '-1');
    setTimeout(() => { try { targetEl && targetEl.focus && targetEl.focus(); } catch (_) {} }, 0);
  }
  function closeTinyModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    const returnFocus = modal.__returnFocus;
    modal.__returnFocus = null;
    if (returnFocus && returnFocus.isConnected && returnFocus.focus) {
      setTimeout(() => { try { returnFocus.focus(); } catch (_) {} }, 0);
    }
  }
  window.__openTinyModal = openTinyModal;
  window.__closeTinyModal = closeTinyModal;
  document.addEventListener('keydown', e => {
    const modal = topOpenModal();
    if (!modal) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (typeof modal.__closeModalHandler === 'function') modal.__closeModalHandler();
      else closeTinyModal(modal);
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = getFocusableInModal(modal);
    if (!focusable.length) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, true);

  function shortcutTargetBlocked(target) {
    if (!target) return false;
    if (target.closest && target.closest('.modal:not([hidden]), .auth-modal:not([hidden])')) return true;
    const tag = target.tagName;
    return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  const ASSET_TEMPLATES_LS = 'tinyworld:asset-templates.v1';
  let assetClipboard = null;
  let copiedHoverCell = null;
  function worldTargetFromHit(hit, materializeGhost) {
    if (!hit) return null;
    const bx = hit.boardX || 0;
    const bz = hit.boardZ || 0;
    const x = hit.x + bx * GRID;
    const z = hit.z + bz * GRID;
    const island = hit.editableIslandId ? editableIslandById.get(hit.editableIslandId) : editableIslandForBoard(bx, bz);
    if (island) {
      const cell = getWorldCell(x, z);
      return { x, z, cell, userEdited: true, editableIslandId: island.id };
    }
    if ((bx || bz) && materializeGhost) {
      const ghostCells = makeGhostWorld(bx, bz);
      const ghostCell = ghostCells[hit.x][hit.z];
      if (!world[x]) world[x] = [];
      if (!world[x][z]) world[x][z] = { ...ghostCell, userEdited: true };
      removeGhostCellMesh(bx, bz, hit.x, hit.z);
    }
    const cell = (bx || bz) && !materializeGhost
      ? makeGhostWorld(bx, bz)[hit.x][hit.z]
      : getWorldCell(x, z);
    return { x, z, cell, userEdited: !!(bx || bz) };
  }

  function hoverWorldTarget(materializeGhost) {
    return worldTargetFromHit(currentHover, materializeGhost);
  }

  function cloneCellIntent(cell) {
    if (!cell) return null;
    return {
      terrain: cell.terrain || 'grass',
      terrainFloors: terrainLevelForCell(cell),
      kind: cell.kind || null,
      floors: cell.floors || 1,
      buildingType: cell.buildingType || null,
      fenceSide: cell.fenceSide || null,
      extras: cloneExtras(cell.extras),
      rotationY: cell.rotationY || 0,
      offsetX: cell.offsetX || 0,
      offsetY: cell.offsetY || 0,
      offsetZ: cell.offsetZ || 0,
      appearance: normalizeAppearance(cell.appearance),
      waterFlow: normalizeWaterFlow(cell.waterFlow),
    };
  }

  function normalizeClipboardCells(cells) {
    return (Array.isArray(cells) ? cells : [])
      .map(item => {
        const dx = Number(item && item.dx);
        const dz = Number(item && item.dz);
        const cell = cloneCellIntent(item && item.cell);
        if (!Number.isFinite(dx) || !Number.isFinite(dz) || !cell) return null;
        return { dx: Math.round(dx), dz: Math.round(dz), cell };
      })
      .filter(Boolean);
  }

  function normalizeClipboardPayload(payload) {
    const cells = normalizeClipboardCells(payload && payload.cells);
    if (!cells.length) return null;
    return {
      version: 1,
      origin: payload.origin || { x: 0, z: 0 },
      size: payload.size || {
        x: Math.max(...cells.map(c => c.dx)) + 1,
        z: Math.max(...cells.map(c => c.dz)) + 1,
      },
      cells,
    };
  }

  function makeClipboardPayload(targets) {
    const valid = (targets || []).filter(t => t && Number.isFinite(t.x) && Number.isFinite(t.z) && t.cell);
    if (!valid.length) return null;
    const originX = Math.min(...valid.map(t => t.x));
    const originZ = Math.min(...valid.map(t => t.z));
    const cells = valid
      .sort((a, b) => (a.z - b.z) || (a.x - b.x))
      .map(t => ({
        dx: t.x - originX,
        dz: t.z - originZ,
        cell: cloneCellIntent(t.cell),
      }))
      .filter(t => t.cell);
    if (!cells.length) return null;
    return {
      version: 1,
      origin: { x: originX, z: originZ },
      size: {
        x: Math.max(...cells.map(c => c.dx)) + 1,
        z: Math.max(...cells.map(c => c.dz)) + 1,
      },
      cells,
    };
  }

  function selectedClipboardTargets(materialize) {
    const sel = window.__tinyworldSelection;
    if (!sel || !sel.cells || !sel.cells.size) return [];
    if (materialize && sel.materialize) {
      return sel.materialize().map(({ x, z }) => ({ x, z, cell: getWorldCell(x, z) }));
    }
    const targets = [];
    sel.cells.forEach(key => {
      const c = parseCellKey(key);
      const x = c.x + (c.bx || 0) * GRID;
      const z = c.z + (c.bz || 0) * GRID;
      targets.push({ x, z, cell: cellForKey(key) || getWorldCell(x, z) });
    });
    return targets;
  }

  function setAssetClipboard(payload) {
    const clipboard = normalizeClipboardPayload(payload);
    if (!clipboard) return false;
    assetClipboard = clipboard;
    copiedHoverCell = clipboard.cells.length === 1 ? cloneCellIntent(clipboard.cells[0].cell) : null;
    return true;
  }

  function copyActiveCellIntent() {
    const selectedTargets = selectedClipboardTargets(false);
    const payload = selectedTargets.length
      ? makeClipboardPayload(selectedTargets)
      : (() => {
        const target = hoverWorldTarget(false);
        return target && target.cell ? makeClipboardPayload([target]) : null;
      })();
    return !!(payload && setAssetClipboard(payload));
  }

  function activeTemplateClipboardPayload() {
    const selectedTargets = selectedClipboardTargets(false);
    if (selectedTargets.length) return makeClipboardPayload(selectedTargets);
    const target = hoverWorldTarget(false);
    return target && target.cell ? makeClipboardPayload([target]) : null;
  }

  function clearCellForCut(x, z) {
    if (!mpEditAllowed()) return;
    const cell = getWorldCell(x, z);
    if (!cell) return;
    const hadExtras = !!(cell.extras && cell.extras.length);
    if (cell.kind || (cell.extras && cell.extras.length)) {
      setCell(x, z, {
        terrain: cell.terrain,
        terrainFloors: terrainLevelForCell(cell),
        kind: null,
        floors: 1,
        extras: [],
        animate: false,
        impactDust: false,
      });
      if (hadExtras && typeof renderCellExtras === 'function') renderCellExtras(x, z);
    } else {
      setCell(x, z, {
        terrain: 'grass',
        terrainFloors: 1,
        kind: null,
        floors: 1,
        extras: [],
        animate: false,
        impactDust: false,
        forceTile: true,
      });
    }
  }

  function cutActiveCellIntent() {
    const selectedTargets = selectedClipboardTargets(true);
    if (selectedTargets.length) {
      const payload = makeClipboardPayload(selectedTargets);
      if (!payload || !setAssetClipboard(payload)) return false;
      selectedTargets.forEach(({ x, z }) => clearCellForCut(x, z));
      if (window.__tinyworldSelection) window.__tinyworldSelection.clear();
      return true;
    }
    const target = hoverWorldTarget(true);
    if (!target || !target.cell) return false;
    const payload = makeClipboardPayload([{ x: target.x, z: target.z, cell: target.cell }]);
    if (!payload || !setAssetClipboard(payload)) return false;
    clearCellForCut(target.x, target.z);
    return true;
  }

  function deleteActiveCellIntent() {
    const selectedTargets = selectedClipboardTargets(true);
    if (selectedTargets.length) {
      selectedTargets.forEach(({ x, z }) => clearCellForCut(x, z));
      if (window.__tinyworldSelection) window.__tinyworldSelection.clear();
      return true;
    }
    const target = hoverWorldTarget(true);
    if (!target || !target.cell) return false;
    clearCellForCut(target.x, target.z);
    return true;
  }

  function pasteClipboardPayloadAtTarget(payload, target, opts = {}) {
    if (!mpEditAllowed()) return false;
    const cells = normalizeClipboardCells(payload && payload.cells);
    if (!cells.length) return false;
    if (!target) return false;
    const placed = [];
    cells.forEach(item => {
      const x = target.x + item.dx;
      const z = target.z + item.dz;
      const next = cloneCellIntent(item.cell);
      if (!next) return;
      setCell(x, z, Object.assign({}, next, {
        userEdited: !!(target.userEdited || isOutsideHomeGrid(x, z)),
        animate: opts.animate !== false,
        impactDust: opts.impactDust !== false,
        forceTile: true,
      }));
      placed.push({ x, z });
    });
    if (opts.selectPlaced !== false && placed.length && window.__tinyworldSelection && window.__tinyworldSelection.replaceWorldCoords) {
      window.__tinyworldSelection.replaceWorldCoords(placed);
    }
    return placed.length > 0;
  }

  function pasteClipboardAtTarget(target, opts = {}) {
    if (!assetClipboard && copiedHoverCell) {
      setAssetClipboard(makeClipboardPayload([{ x: 0, z: 0, cell: copiedHoverCell }]));
    }
    if (!assetClipboard || !assetClipboard.cells || !assetClipboard.cells.length) return false;
    return pasteClipboardPayloadAtTarget(assetClipboard, target, opts);
  }

  function pasteHoveredCellIntent() {
    return pasteClipboardAtTarget(hoverWorldTarget(true), { animate: true, impactDust: true });
  }

  function selectedPasteFallbackTarget() {
    const sel = window.__tinyworldSelection;
    const coords = sel && sel.worldCoords ? sel.worldCoords() : [];
    if (!coords.length) return null;
    return {
      x: Math.min(...coords.map(c => c.x)),
      z: Math.min(...coords.map(c => c.z)),
      userEdited: coords.some(c => isOutsideHomeGrid(c.x, c.z)),
    };
  }

  function pasteClipboardAtActiveTarget() {
    return pasteHoveredCellIntent() || pasteClipboardAtTarget(selectedPasteFallbackTarget(), { animate: true, impactDust: true });
  }

  function pasteClipboardPayloadAtActiveTarget(payload) {
    return pasteClipboardPayloadAtTarget(payload, hoverWorldTarget(true), { animate: true, impactDust: true })
      || pasteClipboardPayloadAtTarget(payload, selectedPasteFallbackTarget(), { animate: true, impactDust: true });
  }

  function duplicateActiveCellIntent() {
    const selectedTargets = selectedClipboardTargets(true);
    if (!selectedTargets.length) {
      const target = hoverWorldTarget(false);
      if (!target || !target.cell) return false;
      const payload = makeClipboardPayload([target]);
      if (!payload) return false;
      return pasteClipboardPayloadAtTarget(payload, { x: target.x + 1, z: target.z, userEdited: isOutsideHomeGrid(target.x + 1, target.z) });
    }
    const payload = makeClipboardPayload(selectedTargets);
    if (!payload) return false;
    const maxX = Math.max(...selectedTargets.map(t => t.x));
    const minZ = Math.min(...selectedTargets.map(t => t.z));
    return pasteClipboardPayloadAtTarget(payload, { x: maxX + 1, z: minZ, userEdited: selectedTargets.some(t => isOutsideHomeGrid(t.x, t.z)) });
  }

  function shiftSelectedCellIntent(dx, dz) {
    const selectedTargets = selectedClipboardTargets(true);
    if (!selectedTargets.length) return false;
    const payload = makeClipboardPayload(selectedTargets);
    if (!payload || !payload.cells || !payload.cells.length) return false;
    selectedTargets.forEach(({ x, z }) => clearCellForCut(x, z));
    const target = {
      x: (payload.origin && Number.isFinite(payload.origin.x) ? payload.origin.x : Math.min(...selectedTargets.map(t => t.x))) + dx,
      z: (payload.origin && Number.isFinite(payload.origin.z) ? payload.origin.z : Math.min(...selectedTargets.map(t => t.z))) + dz,
      userEdited: selectedTargets.some(t => isOutsideHomeGrid(t.x, t.z) || isOutsideHomeGrid(t.x + dx, t.z + dz)),
    };
    return pasteClipboardPayloadAtTarget(payload, target, { animate: true, impactDust: true });
  }

  function arrowSelectionShiftDelta(key) {
    if (key === 'ArrowLeft') return { dx: -1, dz: 0 };
    if (key === 'ArrowRight') return { dx: 1, dz: 0 };
    if (key === 'ArrowUp') return { dx: 0, dz: -1 };
    if (key === 'ArrowDown') return { dx: 0, dz: 1 };
    return null;
  }

  function loadAssetTemplates() {
    try {
      const raw = JSON.parse(localStorage.getItem(ASSET_TEMPLATES_LS) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (_) {
      return [];
    }
  }

  function saveAssetTemplates(list) {
    let payload;
    try { payload = JSON.stringify((list || []).slice(0, 20)); } catch (_) { return; }
    twSafeSetItem(ASSET_TEMPLATES_LS, payload, 'Asset template');
    if (typeof window.__tinyworldSyncAssetsToCloud === 'function') window.__tinyworldSyncAssetsToCloud();
  }

  function assetTemplateCellLabel(cell) {
    if (!cell) return 'cell';
    if (cell.kind === 'house') {
      const shape = cell.buildingType || 'house';
      return shape === 'turret' ? 'castle' : shape;
    }
    if (cell.kind === 'model-stamp') {
      const asset = getModelStamp(cell.appearance && cell.appearance.modelStampId);
      return asset ? asset.label : 'model';
    }
    if (cell.kind === 'voxel-build') {
      const stamp = getVoxelBuildStamp(cell.appearance && cell.appearance.voxelBuildId);
      return stamp ? stamp.name : 'voxel build';
    }
    if (cell.kind) return cell.kind;
    return cell.terrain || 'terrain';
  }

  function assetTemplateNameForClipboard(clipboard) {
    const cells = normalizeClipboardCells(clipboard && clipboard.cells);
    if (!cells.length) return 'Template';
    const counts = new Map();
    cells.forEach(item => {
      const label = assetTemplateCellLabel(item.cell);
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    const labels = Array.from(counts.entries())
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([label, count]) => {
        const title = label.charAt(0).toUpperCase() + label.slice(1);
        return count > 1 ? count + ' ' + title : title;
      });
    const base = labels.join(' + ');
    const countPrefix = cells.length > 1 ? cells.length + '-cell ' : '';
    return countPrefix + base;
  }

  function saveActiveSelectionTemplate() {
    const payload = activeTemplateClipboardPayload();
    if (!payload) return false;
    const templates = loadAssetTemplates();
    templates.unshift({
      id: 'template-' + Date.now().toString(36),
      name: assetTemplateNameForClipboard(payload),
      createdAt: Date.now(),
      clipboard: payload,
    });
    saveAssetTemplates(templates);
    updateStampBuilderSummary();
    refreshOpenStampBuilderCards();
    return true;
  }

  function latestTemplateClipboardPayload() {
    const templates = loadAssetTemplates();
    const latest = templates[0] && templates[0].clipboard;
    return normalizeClipboardPayload(latest);
  }

  function pasteLatestTemplateAtActiveTarget() {
    const clipboard = latestTemplateClipboardPayload();
    return !!(clipboard && pasteClipboardPayloadAtActiveTarget(clipboard));
  }

  // keyboard shortcuts
  window.addEventListener('keydown', e => {
    if (shortcutTargetBlocked(e.target)) return;
    const comboKey = e.key.toLowerCase();
    // Viewers/players cannot mutate the world: block editing shortcuts (undo/
    // redo, cut/paste, delete, duplicate, clear, raise/lower, selection move).
    // Camera, tool-select, copy and escape stay available.
    if (!mpEditAllowed()) {
      const blockMutate = (e.metaKey || e.ctrlKey) && !e.altKey
        ? (comboKey === 'z' || comboKey === 'y' || comboKey === 'x' || comboKey === 'v')
        : (e.key === 'Backspace' || e.key === 'Delete'
           || comboKey === 'c' || comboKey === 'd' || comboKey === 'l'
           || comboKey === 'r' || comboKey === 'f'
           || (e.key.indexOf('Arrow') === 0 && e.shiftKey));
      if (blockMutate) { e.preventDefault(); return; }
    }
    if ((e.metaKey || e.ctrlKey) && !e.altKey && comboKey === 'z') {
      const didHistory = e.shiftKey ? redoWorldEdit() : undoWorldEdit();
      if (didHistory) e.preventDefault();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && !e.altKey && comboKey === 'y') {
      if (redoWorldEdit()) e.preventDefault();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && !e.altKey && comboKey === 'c') {
      if (copyActiveCellIntent()) e.preventDefault();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && !e.altKey && comboKey === 'x') {
      if (cutActiveCellIntent()) e.preventDefault();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && !e.altKey && comboKey === 'v') {
      if (pasteClipboardAtActiveTarget()) e.preventDefault();
      return;
    }
    // Never swallow OS-level keystrokes like Cmd+R (reload), Ctrl+R, Cmd+F, etc.
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (generationViewLocked) {
      if (e.code === 'Space' || e.key === 'Backspace' || e.key === 'Delete' || k === 'c' || k === 'p' || k === 'i' || k === 'r' || k === 'f' || e.key.indexOf('Arrow') === 0) {
        e.preventDefault();
      }
      return;
    }
    if (e.code === 'Space') {
      spaceDown = true;
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape' && pendingMooringAnchor) {
      clearPendingMooringAnchor();
      showMooringStatus('Start pin cleared.');
      e.preventDefault();
      return;
    }
    // Esc first closes/deselects the active edit target, then falls back to
    // disarming any hot build/paint/erase tool back to Select.
    if (e.key === 'Escape' && !(typeof fp !== 'undefined' && fp.active)) {
      let handledEscape = false;
      const sub = window.__tinyworldSubEdit;
      if (sub && sub.isActive && sub.isActive() && sub.exit) {
        sub.exit();
        handledEscape = true;
      }
      const selApi = window.__tinyworldSelection;
      const hasSelectedCells = !!(selApi && selApi.cells && selApi.cells.size);
      const selectedIsland = (typeof selectedEditableIsland === 'function') ? selectedEditableIsland() : null;
      if (hasSelectedCells || selectedIsland || selectedEditableIslandEngineRef) {
        if (selApi && typeof selApi.clear === 'function') selApi.clear();
        else if (typeof clearSelection === 'function') clearSelection();
        lastSelectionAnchor = null;
        handledEscape = true;
      }
      if (selectedTool && !selectedTool.select) {
        const selTool = TOOLS.find(t => t.id === 'select');
        if (selTool) {
          selectTool(selTool);
          handledEscape = true;
        }
      }
      if (handledEscape) {
        e.preventDefault();
        return;
      }
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selApi = window.__tinyworldSelection;
      const hasCells = !!(selApi && selApi.cells && selApi.cells.size);
      const selIsland = (typeof selectedEditableIsland === 'function') ? selectedEditableIsland() : null;
      if (!hasCells && selIsland && !selIsland.__home && typeof removeEditableIsland === 'function') {
        removeEditableIsland(selIsland);  // undoable via the world-history snapshot
        e.preventDefault();
        return;
      }
      deleteActiveCellIntent();
      e.preventDefault();
      return;
    }
    const selectionApi = window.__tinyworldSelection;
    const hasSelectedCells = !!(selectionApi && selectionApi.cells && selectionApi.cells.size);
    if (hasSelectedCells && e.shiftKey) {
      const delta = arrowSelectionShiftDelta(e.key);
      if (delta && shiftSelectedCellIntent(delta.dx, delta.dz)) {
        e.preventDefault();
        return;
      }
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && hasSelectedCells) {
      if (selectionApi.rotate(e.key === 'ArrowLeft' ? -Math.PI / 2 : Math.PI / 2)) {
        e.preventDefault();
        return;
      }
    }
    const shortcutTool = TOOLS.find(x => !x.hidden && x.shortcut && x.shortcut.toLowerCase() === k);
    if (shortcutTool) {
      if (window.__tinyworldIsPlayMode && window.__tinyworldIsPlayMode()) {
        e.preventDefault();
        return;
      }
      selectTool(shortcutTool);
      return;
    }
    if (k === 'c') doClear();
    else if (k === 'd') {
      if (duplicateActiveCellIntent()) e.preventDefault();
    }
    else if (k === 'l') {
      if (pasteLatestTemplateAtActiveTarget()) e.preventDefault();
    }
    else if (k === 'p' || k === 'i') togglePerspective();
    else if (k === 'r') { adjustHoverTerrainHeight(+1); }
    else if (k === 'f') { adjustHoverTerrainHeight(-1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      // Hold Shift to keep the original pan behaviour. Otherwise
      // arrows steer the live ghost: left/right rotate, up/down
      // nudge along Z, shift+left/right nudges along X.
      if (e.shiftKey || !ghostPreview) {
        if (e.key === 'ArrowLeft')       panCameraByCells(-1, 0);
        else if (e.key === 'ArrowRight') panCameraByCells(1, 0);
        else if (e.key === 'ArrowUp')    panCameraByCells(0, -1);
        else                              panCameraByCells(0, 1);
        return;
      }
      if (e.key === 'ArrowLeft')  ghostRotation = snapRot(ghostRotation - GHOST_ROT_STEP);
      if (e.key === 'ArrowRight') ghostRotation = snapRot(ghostRotation + GHOST_ROT_STEP);
      if (e.key === 'ArrowUp')    ghostOffsetZ = Math.max(-GHOST_OFFSET_LIMIT, ghostOffsetZ - GHOST_OFFSET_STEP);
      if (e.key === 'ArrowDown')  ghostOffsetZ = Math.min( GHOST_OFFSET_LIMIT, ghostOffsetZ + GHOST_OFFSET_STEP);
      updateGhostPlacement();
    }
  });

  window.addEventListener('keyup', e => {
    if (e.code === 'Space') {
      spaceDown = false;
      e.preventDefault();
    }
  });

  document.getElementById('reset').addEventListener('click', () => confirmReset());
  document.getElementById('clear').addEventListener('click', doClear);
  document.getElementById('home').addEventListener('click', flyHomeCamera);
  const perspBtn = document.getElementById('persp');
  perspBtn.addEventListener('click', togglePerspective);

  // Export current world to a downloadable JSON file. Same schema as the
  // localStorage save, so an exported file can be re-imported on any
  // machine and re-rendered through whatever the current rules are.
  document.getElementById('export').addEventListener('click', () => {
    const cells = [];
    for (const xKey of Object.keys(world)) {
      const x = parseInt(xKey, 10);
      if (!Number.isFinite(x)) continue;
      const row = world[xKey];
      if (!row) continue;
      const insideHomeX = x >= 0 && x < GRID;
      for (const zKey of Object.keys(row)) {
        const z = parseInt(zKey, 10);
        if (!Number.isFinite(z)) continue;
        const c = row[zKey];
        if (!c) continue;
        const insideHome = insideHomeX && z >= 0 && z < GRID;
        if (!insideHome && !c.userEdited) continue;
        const entry = serializeCell(x, z, c);
        if (entry) cells.push(entry);
      }
    }
    const data = {
      v: STORAGE_VERSION,
      gridSize: GRID,
      islands: serializeEditableIslands(),
      moorings: serializeMooringCables(),
      cells,
      voxelBuildStamps: (typeof referencedVoxelBuildStamps === 'function') ? referencedVoxelBuildStamps(cells) : undefined,
      cameraMode,
      toolId: selectedTool && selectedTool.id,
      useLandscapeEngine,
      landscapeMeshMode,
      landscapeMeshBiome,
      landscapeMeshStyle,
      landscapeEngineSeed: landscapeEngineInstance ? landscapeEngineInstance.seed : null,
      landscapeEngineBiome: landscapeEngineInstance ? landscapeEngineInstance.currentBiomeName : null,
      planetLandscape: serializePlanetLandscapeState(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tinyworld-' + ts + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });

  function twImportFileBaseName(file) {
    const raw = file && file.name ? String(file.name) : 'Imported world';
    const base = raw.replace(/\.[^.]+$/, '').trim();
    return base || 'Imported world';
  }

  function twImportSanitizeWorldId(id) {
    const raw = String(id || '').trim();
    const cleaned = raw.replace(/[^a-zA-Z0-9:_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72);
    if (!cleaned || cleaned.startsWith('cloud:')) {
      return (typeof makeWorldId === 'function') ? makeWorldId() : ('w_' + Date.now().toString(36));
    }
    return cleaned;
  }

  function twImportLooksLikeWorldState(value) {
    return !!(value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.cells));
  }

  function twImportWorldStateFromAny(value) {
    if (twImportLooksLikeWorldState(value)) return value;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    for (const key of ['data', 'state', 'world', 'build']) {
      if (twImportLooksLikeWorldState(value[key])) return value[key];
    }
    return null;
  }

  function twImportWorldStateIsValid(state) {
    if (!twImportLooksLikeWorldState(state)) return false;
    if (typeof validateWorld !== 'function') return true;
    let copy = null;
    try { copy = JSON.parse(JSON.stringify(state)); } catch (_) { return false; }
    if (typeof normalizeWorldCells === 'function') normalizeWorldCells(copy);
    return !validateWorld(copy);
  }

  function twImportWorldEntriesFromJSON(data, file) {
    const fallbackName = twImportFileBaseName(file);
    const direct = twImportWorldStateFromAny(data);
    if (direct) {
      return [{
        id: '',
        name: (data && data.name) || fallbackName,
        ts: Date.now(),
        state: direct,
      }];
    }

    let list = null;
    if (Array.isArray(data)) list = data;
    else if (data && typeof data === 'object') {
      if (Array.isArray(data.worlds)) list = data.worlds;
      else if (Array.isArray(data.slots)) list = data.slots;
      else if (Array.isArray(data.builds)) list = data.builds;
    }
    if (!list) return [];

    const entries = [];
    for (const item of list) {
      const state = twImportWorldStateFromAny(item);
      if (!state) continue;
      const name = (item && (item.name || item.title || item.label)) || fallbackName;
      const parsedDate = Date.parse((item && (item.updatedAt || item.updated_at || item.createdAt || item.created_at)) || '');
      entries.push({
        id: twImportSanitizeWorldId(item && item.id),
        name,
        ts: Number(item && item.ts) || (Number.isFinite(parsedDate) ? parsedDate : Date.now()),
        state,
      });
    }
    return entries;
  }

  function twImportLooksLikeAssetLibrary(data) {
    return !!(data && typeof data === 'object' && !Array.isArray(data)
      && (data.tinyworldAssets || Array.isArray(data.voxelBuilds) || Array.isArray(data.assetTemplates)));
  }

  function twImportStoreWorldEntries(entries) {
    if (!entries.length || typeof readWorldsMeta !== 'function' || typeof writeWorldsMeta !== 'function') return '';
    const list = readWorldsMeta();
    const usedIds = new Set(list.map(w => w && w.id).filter(Boolean));
    let firstId = '';
    for (const entry of entries) {
      let id = entry.id || ((typeof makeWorldId === 'function') ? makeWorldId() : ('w_' + Date.now().toString(36)));
      while (usedIds.has(id)) id = ((typeof makeWorldId === 'function') ? makeWorldId() : ('w_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)));
      usedIds.add(id);
      if (!firstId) firstId = id;
      list.push({
        id,
        name: String(entry.name || 'Imported world').slice(0, 80),
        ts: entry.ts || Date.now(),
        state: entry.state,
      });
    }
    writeWorldsMeta(list);
    if (firstId && typeof setActiveWorldId === 'function') setActiveWorldId(firstId);
    if (typeof twCloudQueueLocalWorldSync === 'function') twCloudQueueLocalWorldSync();
    if (typeof window.__tinyworldWorldMenuRefresh === 'function') window.__tinyworldWorldMenuRefresh();
    return firstId;
  }

  function twImportJSONPayload(data, file) {
    const worldEntries = twImportWorldEntriesFromJSON(data, file);
    if (worldEntries.length) {
      const validEntries = worldEntries.filter(entry => twImportWorldStateIsValid(entry.state));
      if (!validEntries.length) throw new Error('schema check failed');
      const first = validEntries[0];
      if (!applyState(first.state)) throw new Error('schema check failed');
      twImportStoreWorldEntries(validEntries);
      twToast('Imported ' + validEntries.length + ' world' + (validEntries.length === 1 ? '' : 's') + '.', 'ok');
      return true;
    }

    if (twImportLooksLikeAssetLibrary(data) && typeof importAssetLibrary === 'function') {
      importAssetLibrary(data);
      return true;
    }

    return false;
  }

  // Import TinyWorld JSON. Accepts exported world files, account/cloud build
  // envelopes, local named-world lists, and asset-library bundles.
  const importFile = document.getElementById('import-file');
  const importButton = document.getElementById('import');
  function twOpenImportFilePicker() {
    if (!importFile) return;
    importFile.value = '';
    try {
      if (typeof importFile.showPicker === 'function') {
        importFile.showPicker();
        return;
      }
    } catch (_) {}
    importFile.click();
  }
  if (importButton) {
    if (importButton.tagName !== 'LABEL') {
      importButton.addEventListener('click', twOpenImportFilePicker);
    }
    importButton.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      twOpenImportFilePicker();
    });
  }
  importFile.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!twImportJSONPayload(data, file)) throw new Error('schema check failed');
    } catch (err) {
      console.error('Import failed:', err);
      alert('Could not import that file — not a valid Tiny World JSON.');
    }
    e.target.value = '';
  });

  function togglePerspective() {
    const next = cameraMode === 'ortho' ? 'perspective' : 'ortho';
    setCameraMode(next);
  }

  // Sandbox sculpt: one continuous control from a deep pit up to a tall column.
  // Raising fills an excavation back in (dig -> 0) before stacking terrainFloors
  // up; lowering drops terrainFloors down to the base, then DIGS below it (the
  // UnrealSandboxTerrain "remove material" half). Returns true if it changed.
  function sculptCellElevation(x, z, up) {
    const cell = getWorldCell(x, z);
    let tf = terrainLevelForCell(cell);
    let dig = cellDigDepth(cell);
    if (up) {
      if (dig > 0) dig -= 1;
      else if (tf < MAX_FLOORS) tf += 1;
      else return false;
    } else {
      if (tf > 1) tf -= 1;
      else if (dig < MAX_DIG) dig += 1;
      else return false;
    }
    setCell(x, z, {
      terrain: cell.terrain,
      terrainFloors: tf,
      dig,
      kind: cell.kind || null,
      floors: cell.floors || 1,
      buildingType: cell.buildingType || null,
      fenceSide: cell.fenceSide || null,
      userEdited: isOutsideHomeGrid(x, z) || undefined,
    });
    return true;
  }

  // Per-tile voxel sculpt brush. Maps the cursor's within-tile position to a
  // sub-cell on the tile's N×N grid and nudges a small radius of sub-cells up or
  // down by one voxel step. The radius is computed in a global sub-cell space so
  // a brush near a tile edge spills into the neighbour tile and craters/mounds
  // stay continuous across the board. Each affected tile is committed via setCell
  // with its updated heightmap.
  let sculptBrushRadius = 1; // in sub-cells
  function sculptVoxelBrush(tileX, tileZ, localX, localZ, up) {
    const baseCell = getWorldCell(tileX, tileZ);
    const N = (baseCell.voxels && baseCell.voxels.n) || sculptResolutionNumeric();
    const delta = up ? 1 : -1;
    const r = sculptBrushRadius;
    // Brush centre in global sub-cell coordinates (tile index * N + within-tile).
    const fx = Math.max(0, Math.min(0.9999, Math.max(-0.5, Math.min(0.5, localX)) + 0.5));
    const fz = Math.max(0, Math.min(0.9999, Math.max(-0.5, Math.min(0.5, localZ)) + 0.5));
    const gcx = tileX * N + fx * N;
    const gcz = tileZ * N + fz * N;
    const edits = new Map(); // 'tx,tz' -> { tx, tz, h:Array(N*N) }
    function tileHeights(tx, tz) {
      const key = tx + ',' + tz;
      let e = edits.get(key);
      if (!e) {
        const c = getWorldCell(tx, tz);
        const h = new Array(N * N).fill(0);
        if (c.voxels && c.voxels.n === N && Array.isArray(c.voxels.h)) {
          for (let k = 0; k < N * N; k++) h[k] = c.voxels.h[k] || 0;
        }
        e = { tx, tz, h };
        edits.set(key, e);
      }
      return e;
    }
    const gi0 = Math.floor(gcx - r - 1), gi1 = Math.ceil(gcx + r + 1);
    const gj0 = Math.floor(gcz - r - 1), gj1 = Math.ceil(gcz + r + 1);
    for (let gi = gi0; gi <= gi1; gi++) {
      for (let gj = gj0; gj <= gj1; gj++) {
        const dist = Math.hypot((gi + 0.5) - gcx, (gj + 0.5) - gcz);
        if (dist > r + 0.5) continue;
        const tx = Math.floor(gi / N), tz = Math.floor(gj / N);
        const li = gi - tx * N, lj = gj - tz * N;
        if (li < 0 || li >= N || lj < 0 || lj >= N) continue;
        const e = tileHeights(tx, tz);
        const idx = li * N + lj;
        e.h[idx] = Math.max(-MAX_VOX, Math.min(MAX_VOX, e.h[idx] + delta));
      }
    }
    for (const e of edits.values()) {
      const c = getWorldCell(e.tx, e.tz);
      setCell(e.tx, e.tz, {
        terrain: c.terrain,
        terrainFloors: terrainLevelForCell(c),
        dig: cellDigDepth(c),
        voxels: { n: N, h: e.h },
        kind: c.kind || null,
        floors: c.floors || 1,
        buildingType: c.buildingType || null,
        fenceSide: c.fenceSide || null,
        userEdited: isOutsideHomeGrid(e.tx, e.tz) || undefined,
      });
    }
  }

  // Item 7 — raise/lower (now sculpt) terrain at the hovered cell. Acts on the
  // cell under the hover indicator. No-op if nothing is hovered.
  function adjustHoverTerrainHeight(delta) {
    if (window.__tinyworldIsPlayMode && window.__tinyworldIsPlayMode()) return;
    if (!currentHover) return;
    const x = currentHover.x + (currentHover.boardX || 0) * GRID;
    const z = currentHover.z + (currentHover.boardZ || 0) * GRID;
    sculptCellElevation(x, z, delta > 0);
  }
  // Expose for the command palette.
  window.__adjustHoverTerrainHeight = adjustHoverTerrainHeight;

  // Stash the user's last orbital polar so toggling out of true top-down
  // can return to a sensible angled view instead of getting stuck flat.
  let polarBeforeTopdown = null;
  function setCameraMode(mode) {
    const requested = mode === 'soft' ? 'perspective' : mode;
    const effective = ['ortho', 'topdown', 'perspective', 'fp'].includes(requested) ? requested : 'ortho';
    if (effective !== 'fp' && fp.active) exitFP();
    // 'topdown' is orthoCam with polar snapped to ~0 (straight down).
    // Internally we still store cameraMode='ortho' for everything that
    // branches on it (renderer, ghost-board code, persistence) — the
    // angle is the only thing that differs.
    if (effective === 'topdown') {
      if (cameraMode !== 'ortho' || polar > 0.05) polarBeforeTopdown = polar;
      polar = 0;
      cameraMode = 'ortho';
    } else if (effective === 'ortho') {
      // Returning to isometric from a true top-down — restore the
      // previous orbital polar so the user isn't dropped back flat.
      if (polar < 0.05 && polarBeforeTopdown != null) {
        polar = polarBeforeTopdown;
        polarBeforeTopdown = null;
      }
      cameraMode = 'ortho';
    } else {
      cameraMode = effective;
    }
    camera = cameraMode === 'ortho' ? orthoCam
           : persCam;
    const isTopdown = (effective === 'topdown') || (cameraMode === 'ortho' && polar < 0.05);
    perspBtn.classList.toggle('on', cameraMode !== 'ortho' || isTopdown);
    perspBtn.classList.remove('disabled');
    perspBtn.setAttribute('data-tooltip',
      isTopdown              ? 'Top-down (bird\'s eye)' :
      cameraMode === 'ortho' ? 'Isometric' :
      cameraMode === 'fp'    ? 'Walk (esc to exit)' : 'Perspective');
    if (effective === 'fp') enterFP();
    if (typeof updateCamera === 'function') updateCamera();
    onResize();
  }

  // ---------- first-person walk ----------
  // Ports OWB's src/main.js:194-343 ideas (eye-level camera, pointer-lock
  // mouse-look, WASD + space jump + shift sprint) but simplified for
  // tinyworld's 8×8 grid:
  //   - ground height is sampled directly from world[x][z].terrainFloors
  //     rather than via raycast (every cell is 1×1 with a known top Y).
  //   - collision is bound-clamping to the home grid; no obstacle box
  //     collisions (you can walk through props — keeps the diorama
  //     readable rather than turning into a maze).
  const FP_EYE_H = 0.5;          // eye sits 0.5 units above the cell top
  const FP_SPEED = 1.4;          // units / sec
  const FP_SPRINT_MULT = 2.2;
  const FP_FOV = 55;
  const FP_NEAR = 0.02;
  const PERS_NEAR_DEFAULT = persCam.near;
  const PERS_FOV_DEFAULT  = persCam.fov;
  const FP_JUMP_V0 = 3.2;
  const FP_GRAVITY = 10;
  const FP_FALL_THRESHOLD = 0.5;
  const FP_STEP_LERP = 14;
  const fp = {
    active: false,
    pos: new THREE.Vector3(0, TOP_H + FP_EYE_H, 0),
    yaw: 0,
    pitch: 0,
    vy: 0,
    grounded: true,
  };
  const fpKeys = new Set();

  function fpGroundYAt(worldX, worldZ) {
    // Convert world-space (x, z) back to grid indices.
    const gx = Math.round(worldX + GRID / 2 - 0.5);
    const gz = Math.round(worldZ + GRID / 2 - 0.5);
    const cell = (world[gx] && world[gx][gz]) ? world[gx][gz] : null;
    const rise = terrainVisualRiseForCell(cell);
    return rise + TOP_H + FP_EYE_H;
  }

  function enterFP() {
    if (fp.active) return;
    fp.active = true;
    // Spawn at home-board centre at ground height, facing toward the
    // negative Z axis so the user immediately sees the diorama.
    fp.pos.set(0, fpGroundYAt(0, GRID * 0.4), GRID * 0.4);
    fp.yaw = 0;
    fp.pitch = 0;
    fp.vy = 0;
    fp.grounded = true;
    persCam.fov = FP_FOV;
    persCam.near = FP_NEAR;
    persCam.updateProjectionMatrix();
    document.body.classList.add('fp-active');
    if (renderer.domElement.requestPointerLock) {
      try { renderer.domElement.requestPointerLock(); } catch (_) {}
    }
  }
  function exitFP() {
    if (!fp.active) return;
    fp.active = false;
    fpKeys.clear();
    persCam.fov = PERS_FOV_DEFAULT;
    persCam.near = PERS_NEAR_DEFAULT;
    persCam.updateProjectionMatrix();
    document.body.classList.remove('fp-active');
    if (document.pointerLockElement === renderer.domElement && document.exitPointerLock) {
      try { document.exitPointerLock(); } catch (_) {}
    }
  }
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && fp.active) {
      // User hit esc / clicked away — drop back to ortho.
      exitFP();
      setCameraMode('ortho');
    }
  });
  document.addEventListener('mousemove', e => {
    if (!fp.active || document.pointerLockElement !== renderer.domElement) return;
    markCameraMoving();
    fp.yaw -= e.movementX * 0.0022;
    fp.pitch = Math.max(-1.4, Math.min(1.4, fp.pitch - e.movementY * 0.0022));
  });
  window.addEventListener('keydown', e => {
    if (!fp.active) return;
    if (e.key === 'Escape') { setCameraMode('ortho'); return; }
    if (e.code === 'Space') {
      e.preventDefault();
      if (fp.grounded) { fp.vy = FP_JUMP_V0; fp.grounded = false; }
      return;
    }
    fpKeys.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', e => {
    if (!fp.active) return;
    fpKeys.delete(e.key.toLowerCase());
  });

  function tickFP(dt) {
    if (!fp.active) return;
    const sinY = Math.sin(fp.yaw), cosY = Math.cos(fp.yaw);
    let fx = 0, fz = 0;
    if (fpKeys.has('w') || fpKeys.has('arrowup'))    { fx -= sinY; fz -= cosY; }
    if (fpKeys.has('s') || fpKeys.has('arrowdown'))  { fx += sinY; fz += cosY; }
    if (fpKeys.has('a') || fpKeys.has('arrowleft'))  { fx -= cosY; fz += sinY; }
    if (fpKeys.has('d') || fpKeys.has('arrowright')) { fx += cosY; fz -= sinY; }
    const sprint = fpKeys.has('shift') ? FP_SPRINT_MULT : 1;
    const speed = FP_SPEED * sprint * dt;
    const len = Math.hypot(fx, fz);
    if (len > 0) {
      markCameraMoving();
      const ux = fx / len, uz = fz / len;
      fp.pos.x += ux * speed;
      fp.pos.z += uz * speed;
    }
    // Clamp to the home-grid bounds (small margin so eye doesn't peek
    // past the world edge).
    const bound = GRID / 2 - 0.3;
    fp.pos.x = Math.max(-bound, Math.min(bound, fp.pos.x));
    fp.pos.z = Math.max(-bound, Math.min(bound, fp.pos.z));
    // Ground-following + gravity.
    const groundY = fpGroundYAt(fp.pos.x, fp.pos.z);
    if (!fp.grounded) {
      markCameraMoving();
      fp.vy -= FP_GRAVITY * dt;
      fp.pos.y += fp.vy * dt;
      if (fp.pos.y <= groundY) {
        fp.pos.y = groundY;
        fp.vy = 0;
        fp.grounded = true;
      }
    } else if (fp.pos.y - groundY > FP_FALL_THRESHOLD) {
      fp.grounded = false;
    } else {
      const k = 1 - Math.exp(-FP_STEP_LERP * dt);
      fp.pos.y += (groundY - fp.pos.y) * k;
    }
    persCam.position.copy(fp.pos);
    const lookX = fp.pos.x - Math.sin(fp.yaw) * Math.cos(fp.pitch);
    const lookY = fp.pos.y + Math.sin(fp.pitch);
    const lookZ = fp.pos.z - Math.cos(fp.yaw) * Math.cos(fp.pitch);
    persCam.lookAt(lookX, lookY, lookZ);
  }

  function resetCameraDefaults() {
    // Scale the default view to the current home board so the whole
    // grid sits inside the frame regardless of size (8 / 12 / 16 / 20).
    viewSize = DEFAULT_VIEW_SIZE * (GRID / HOME_GRID_DEFAULT);
    azimuth = DEFAULT_AZIMUTH;
    polar = DEFAULT_POLAR;
    target.copy(DEFAULT_TARGET);
    setCameraMode(DEFAULT_CAMERA_MODE);
  }

  // Resize the home board between the allowed presets (8 through 20).
  // World data outside the previous board is preserved in world[][] —
  // growing the grid brings those tiles into the home area (so the
  // existing 'outside home' grayscale is no longer applied to them).
  // Shrinking is supported but the now-outside cells aren't re-rendered
  // in their outside-home form; expansion is the primary path.
  function setHomeGridSize(n, opts) {
    const skipRebuild = !!(opts && opts.skipRebuild);
    n = coerceGridSize(n, GRID);
    if (n === GRID) return;

    // Backup the full pre-resize state to localStorage so the user can
    // recover if a resize ever drops something we didn't preserve.
    // Stored under a dedicated key separate from the live save.
    try {
      const backupCells = [];
      for (const xKey of Object.keys(world)) {
        const x = parseInt(xKey, 10);
        if (!Number.isFinite(x)) continue;
        const row = world[xKey];
        if (!row) continue;
        for (const zKey of Object.keys(row)) {
          const z = parseInt(zKey, 10);
          if (!Number.isFinite(z)) continue;
          const c = row[zKey];
          if (!c) continue;
          const entry = serializeCell(x, z, c);
          if (entry) backupCells.push(entry);
        }
      }
      localStorage.setItem('tinyworld:home-grid:backup', JSON.stringify({
        v: STORAGE_VERSION,
        savedAt: Date.now(),
        fromGrid: GRID,
        toGrid: n,
        gridSize: GRID,
        cells: backupCells,
      }));
    } catch (_) {}

    GRID = n;
    // Mooring anchors store local points against the current board and island
    // surfaces, so a grid resize invalidates both existing cables and a pending pin.
    clearMooringCables();
    initCellMeshesGrid();
    // Grid size changed — old index entries may be out of range or stale.
    // Subsequent setCell / load will repopulate via incremental updates or rebuild.
    cropPositions.clear();
    maxPumpkinPositions.clear();
    carriagePumpkin = null;
    applyAutoPreviewSettingsForGrid({ explored: hasUserPanned, deferEnsure: true });
    try { localStorage.setItem('tinyworld:home-grid', String(GRID)); } catch (_) {}
    updateUnsavedCopyForGrid();
    if (typeof buildHomeBorder === 'function') buildHomeBorder();
    for (const island of editableIslands) {
      disposeEditableIslandBase(island);
      disposeEditableIslandSurface(island);
      if (island.proxyGroup) {
        if (island.proxyGroup.parent) island.proxyGroup.parent.remove(island.proxyGroup);
        disposeGroup(island.proxyGroup);
      }
      island.proxyGroup = makeEditableIslandProxy(island);
      island.group.add(island.proxyGroup);
    }
    updateEditableIslandLods(true);

    // Drop every ghost board — their world positions are anchored to GRID.
    for (const [key, board] of ghostBoards) {
      worldGroup.remove(board);
      disposeGroup(board);
    }
    ghostBoards.clear();
    ghostBoardCells.clear();
    clearCheapGhostTerrain();

    // Dispose every existing cell mesh; cellPos depends on GRID so all
    // tiles need to be re-positioned. setCell will rebuild from
    // world[x][z] which we never throw away.
    for (const key of Object.keys(cellMeshes)) {
      const entry = cellMeshes[key];
      if (entry.tile)   { if (entry.tile.parent) entry.tile.parent.remove(entry.tile); disposeGroup(entry.tile); }
      if (entry.object) { if (entry.object.parent) entry.object.parent.remove(entry.object); disposeGroup(entry.object); }
      if (entry.extras) for (const m of entry.extras) { if (m.parent) m.parent.remove(m); disposeGroup(m); }
      delete cellMeshes[key];
    }
    homeRenderQueue = [];
    homeRenderQueueCursor = 0;
    homeRenderQueued.clear();

    if (skipRebuild) {
      window.dispatchEvent(new CustomEvent('tinyworld:grid-changed', { detail: { grid: GRID } }));
      return;
    }

    if (useWindowedHomeRendering()) {
      resetCameraDefaults();
      requestHomeRenderWindowSync({ force: true });
      if (typeof ensureGhostBoardsAroundTarget === 'function') ensureGhostBoardsAroundTarget();
      saveState();
      window.dispatchEvent(new CustomEvent('tinyworld:grid-changed', { detail: { grid: GRID } }));
      return;
    }

    suppressSave = true;
    // Rebuild every home cell from the surviving world data.
    for (let x = 0; x < GRID; x++) {
      for (let z = 0; z < GRID; z++) {
        const c = getWorldCell(x, z);
        setCell(x, z, {
          terrain: c.terrain || 'grass',
          terrainFloors: c.terrainFloors || 1,
          kind: c.kind || null,
          floors: c.floors || 1,
          buildingType: c.buildingType || null,
          fenceSide: c.fenceSide || null,
          rotationY: c.rotationY || 0,
          offsetX: c.offsetX || 0,
          offsetZ: c.offsetZ || 0,
          animate: false,
          forceTile: true,
        });
        // Re-render extras (tufts/fences) without animating drops.
        if (Array.isArray(c.extras) && c.extras.length && typeof renderCellExtras === 'function') {
          renderCellExtras(x, z);
        }
      }
    }
    // Re-render any user-edited cells that now (or still) live OUTSIDE
    // the home grid. Without this, shrinking the grid would hide tiles
    // the user placed at higher indices, and growing wouldn't refresh
    // the outside cells that still exist past the new edge. The
    // grayscale 'outside home' look is applied automatically by setCell.
    for (const xKey of Object.keys(world)) {
      const x = parseInt(xKey, 10);
      if (!Number.isFinite(x) || x < 0 || x >= HOME_GRID_MAX) continue;
      const row = world[xKey];
      if (!row) continue;
      for (const zKey of Object.keys(row)) {
        const z = parseInt(zKey, 10);
        if (!Number.isFinite(z) || z < 0 || z >= HOME_GRID_MAX) continue;
        if (x < GRID && z < GRID) continue;
        const c = row[zKey];
        if (!c) continue;
        // Only re-render cells the user actually placed something on —
        // default-grass cells stay invisible to the cellMeshes layer
        // (ghost boards handle the procedural fill).
        if (!serializeCell(x, z, c)) continue;
        setCell(x, z, {
          terrain: c.terrain || 'grass',
          terrainFloors: c.terrainFloors || 1,
          kind: c.kind || null,
          floors: c.floors || 1,
          buildingType: c.buildingType || null,
          fenceSide: c.fenceSide || null,
          rotationY: c.rotationY || 0,
          offsetX: c.offsetX || 0,
          offsetZ: c.offsetZ || 0,
          animate: false,
          forceTile: true,
        });
        if (Array.isArray(c.extras) && c.extras.length && typeof renderCellExtras === 'function') {
          renderCellExtras(x, z);
        }
      }
    }
    suppressSave = false;

    // Re-create ghost boards around the freshly-sized home.
    if (typeof ensureGhostBoardsAroundTarget === 'function') ensureGhostBoardsAroundTarget();
    // Re-frame the camera so the new board centres correctly.
    resetCameraDefaults();
    saveState();
    window.dispatchEvent(new CustomEvent('tinyworld:grid-changed', { detail: { grid: GRID } }));
  }

  // Keep the unsaved-areas banner + reset confirm copy in sync with
  // the current home grid size. Called on init and after every resize.
  function updateUnsavedCopyForGrid() {
    const bannerText = document.getElementById('unsaved-banner-text');
    if (bannerText) bannerText.textContent = `Areas outside your ${GRID}×${GRID} grid aren't saved`;
    const confirmCopy = document.getElementById('confirm-reset-copy');
    if (confirmCopy) confirmCopy.textContent = `This replaces your current build with the preset village. You'll lose anything you've placed on the ${GRID}×${GRID} grid.`;
    const homeBtn = document.getElementById('home');
    if (homeBtn) homeBtn.setAttribute('aria-label', `Center on your ${GRID} by ${GRID} grid`);
  }
  updateUnsavedCopyForGrid();

  // Smoothly tween the camera target/zoom back to the current home grid
  // without touching world data — used by the Home button.
  let homeTween = null;
  function flyHomeCamera() {
    const start = {
      tx: target.x, tz: target.z, view: viewSize,
      az: azimuth, po: polar,
    };
    const end = {
      tx: DEFAULT_TARGET.x, tz: DEFAULT_TARGET.z, view: DEFAULT_VIEW_SIZE * (GRID / HOME_GRID_DEFAULT),
      az: DEFAULT_AZIMUTH, po: DEFAULT_POLAR,
    };
    homeTween = { start, end, t: 0, dur: 0.55 };
    if (typeof playSfx === 'function') playSfx('whoosh');
  }
  function tickHomeTween(dt) {
    if (!homeTween) return;
    markCameraMoving();
    homeTween.t = Math.min(1, homeTween.t + dt / homeTween.dur);
    const u = easeOutCubic(homeTween.t);
    const { start, end } = homeTween;
    target.x = start.tx + (end.tx - start.tx) * u;
    target.z = start.tz + (end.tz - start.tz) * u;
    viewSize = start.view + (end.view - start.view) * u;
    azimuth  = start.az + (end.az - start.az) * u;
    polar    = start.po + (end.po - start.po) * u;
    onResize();
    if (renderAutoExpand && typeof ensureGhostBoardsAroundTarget === 'function') ensureGhostBoardsAroundTarget();
    if (typeof requestMinimapRepaint === 'function') requestMinimapRepaint();
    if (homeTween.t >= 1) homeTween = null;
  }

  // Tear down everything outside the home board. Used by doReset and
  // on first load so the world genuinely starts as a single GRID x GRID
  // tile and grows outward as the user pans.
  function clearGhostWorld() {
    // Dispose every ghost board mesh + clear pending queue + cache.
    for (const [, board] of ghostBoards) {
      worldGroup.remove(board);
      disposeGroup(board);
    }
    ghostBoards.clear();
    ghostBoardCells.clear();
    clearCheapGhostTerrain();
    pendingGhostBoards.length = 0;
    pendingGhostBoardSet.clear();

    // Drop any out-of-home cellMeshes (user overrides on ghost cells)
    // and wipe the matching world[][] entries so buildGhostBoard
    // doesn't skip them next time.
    for (const key of Object.keys(cellMeshes)) {
      const [kx, kz] = key.split(',').map(Number);
      if (kx >= 0 && kx < GRID && kz >= 0 && kz < GRID) continue;
      if (isEditableIslandCell(kx, kz)) continue;
      const entry = cellMeshes[key];
      if (entry.tile)   { if (entry.tile.parent) entry.tile.parent.remove(entry.tile); disposeGroup(entry.tile); }
      if (entry.object) { if (entry.object.parent) entry.object.parent.remove(entry.object); disposeGroup(entry.object); }
      if (entry.extras) for (const m of entry.extras) { if (m.parent) m.parent.remove(m); disposeGroup(m); }
      delete cellMeshes[key];
    }
    for (const xKey of Object.keys(world)) {
      const x = parseInt(xKey, 10);
      if (!Number.isFinite(x)) continue;
      const row = world[xKey];
      if (!row) continue;
      const insideX = x >= 0 && x < GRID;
      for (const zKey of Object.keys(row)) {
        const z = parseInt(zKey, 10);
        if (!Number.isFinite(z)) continue;
        const inside = insideX && z >= 0 && z < GRID;
        if (inside) continue;
        if (isEditableIslandCell(x, z)) continue;
        delete row[zKey];
      }
    }
  }

  function doReset() {
    useLandscapeEngine = false;
    landscapeEngineInstance = null;
    disposeLandscapeMesh();
    disposePlanetLandscape();
    try {
      localStorage.setItem('tinyworld:gen:useLandscape', '0');
      const useLandscapeEl = document.getElementById('gen-use-landscape');
      if (useLandscapeEl) useLandscapeEl.checked = false;
    } catch (_) {}

    hasUserPanned = false;
    clearVehicleRuntime();
    renderVisibleSize = GRID;
    if (typeof requestHomeRenderWindowSync === 'function') requestHomeRenderWindowSync({ force: true });
    // Reset always returns to the original 8x8 grid, regardless of what
    // the user resized to. setHomeGridSize is a no-op if GRID is already
    // at the default. skipRebuild because loadInitialScene immediately
    // rebuilds every cell anyway.
    if (GRID !== HOME_GRID_DEFAULT && typeof setHomeGridSize === 'function') {
      setHomeGridSize(HOME_GRID_DEFAULT, { skipRebuild: true });
    }
    clearMooringCables();
    clearEditableIslands();
    clearGhostWorld();
    // Reset returns to the bundled default island; fall back to the procedural
    // starter scene only if default_island.json is unavailable.
    if (!(typeof applyDefaultIslandState === 'function' && applyDefaultIslandState())) loadInitialScene();
    resetCameraDefaults();
    // Re-enqueue ghost boards now that the world is fresh — they'll
    // build with all cells starting at opacity 0 (outside the visible
    // window) so the user only sees the home grid until they pan.
    if (typeof ensureGhostBoardsAroundTarget === 'function') {
      ensureGhostBoardsAroundTarget();
    }
    if (typeof playSfx === 'function') playSfx('whoosh');
    if (typeof fireWebhook === 'function') fireWebhook('world.reset', {});
    window.dispatchEvent(new CustomEvent('tinyworld:world-changed', { detail: { scope: 'world.reset' } }));
  }

  function confirmReset() {
    const modal = document.getElementById('confirm-reset-modal');
    if (!modal) { doReset(); return; }
    const okBtn = document.getElementById('confirm-reset-ok');
    openTinyModal(modal, okBtn);
  }
  (function setupResetConfirm() {
    const modal = document.getElementById('confirm-reset-modal');
    if (!modal) return;
    const close = () => { closeTinyModal(modal); };
    const ok = document.getElementById('confirm-reset-ok');
    const cancel = document.getElementById('confirm-reset-cancel');
    const closeBtn = document.getElementById('confirm-reset-close');
    ok.addEventListener('click', () => { close(); doReset(); });
    cancel.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    window.addEventListener('keydown', e => {
      if (modal.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Enter') { e.preventDefault(); close(); doReset(); }
    });
  })();
  function doClear() {
    useLandscapeEngine = false;
    landscapeEngineInstance = null;
    disposeLandscapeMesh();
    disposePlanetLandscape();
    try {
      localStorage.setItem('tinyworld:gen:useLandscape', '0');
      const useLandscapeEl = document.getElementById('gen-use-landscape');
      if (useLandscapeEl) useLandscapeEl.checked = false;
    } catch (_) {}

    if (typeof playSfx === 'function') playSfx('whoosh');
    clearVehicleRuntime();
    clearMooringCables();
    clearEditableIslands();
    if (useWindowedHomeRendering()) {
      resetHomeWorldIntent();
      cropPositions.clear();
      maxPumpkinPositions.clear();
      carriagePumpkin = null;
      disposeAllCellMeshes();
      requestHomeRenderWindowSync({ force: true });
      saveState();
      if (typeof fireWebhook === 'function') fireWebhook('world.clear', {});
      window.dispatchEvent(new CustomEvent('tinyworld:world-changed', { detail: { scope: 'world.clear' } }));
      return;
    }
    const TILE_STAGGER = 0.022;
    for (let x = 0; x < GRID; x++)
      for (let z = 0; z < GRID; z++)
        setCell(x, z, {
          terrain: 'grass',
          terrainFloors: 1,
          kind: null,
          floors: 1,
          buildingType: null,
          fenceSide: null,
          extras: [], // also drop any decorative tufts / fences
          rotationY: 0,
          offsetX: 0,
          offsetY: 0,
          offsetZ: 0,
          appearance: null,
          waterFlow: 'auto',
          tileDelay: (x + z) * TILE_STAGGER,
          impactDust: false,
          forceTile: true,
        });
    if (typeof fireWebhook === 'function') fireWebhook('world.clear', {});
    window.dispatchEvent(new CustomEvent('tinyworld:world-changed', { detail: { scope: 'world.clear' } }));
  }
