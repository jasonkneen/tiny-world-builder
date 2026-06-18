  // -------- radial object menu (prototype) --------
  // A screen-space HTML ring of action buttons around the selected object.
  // It's a 2D DOM overlay anchored to the transform gizmo's projected screen
  // position, so it always faces the camera. Supports drill-down sub-rings
  // (e.g. Color → swatches) that "spin in", with the top slot as Close/Back.
  // tickRadialMenu() runs once per frame from the animation loop.
  (function initRadialMenu() {
    const ICONS = {
      palette: '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>',
      sparkles: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
      size: '<path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/>',
      copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
      move: '<path d="M12 2v20"/><path d="m15 19-3 3-3-3"/><path d="m19 9 3 3-3 3"/><path d="M2 12h20"/><path d="m5 9-3 3 3 3"/><path d="m9 5 3-3 3 3"/>',
      rotate: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
      more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
      close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
      back: '<path d="m15 18-6-6 6-6"/>',
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
      explode: '<path d="M12 2v5"/><path d="M12 17v5"/><path d="M2 12h5"/><path d="M17 12h5"/><path d="m4.9 4.9 3.5 3.5"/><path d="m15.6 15.6 3.5 3.5"/><path d="m19.1 4.9-3.5 3.5"/><path d="m8.4 15.6-3.5 3.5"/>',
      minus: '<path d="M5 12h14"/>',
      plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    };

    // Root ring — angles in screen degrees (0=right, 90=down, 270=up). The top
    // slot (270) is reserved for Close / Back.
    const ROOT = [
      { id: 'color',     label: window.t('radial.color'),     icon: 'palette',  angle: 225, submenu: 'color', posType: 'primary' },
      { id: 'style',     label: window.t('radial.style'),     icon: 'sparkles', angle: 315, action: 'style', posType: 'primary' },
      { id: 'size',      label: window.t('radial.size'),      icon: 'size',     angle: 0,   submenu: 'size', posType: 'primary' },
      { id: 'rotate',    label: window.t('radial.rotate'),    icon: 'rotate',   angle: 45,  action: 'rotate', posType: 'primary' },
      { id: 'more',      label: window.t('radial.more'),      icon: 'more',     angle: 90,  action: 'more', posType: 'primary' },
      { id: 'move',      label: window.t('radial.move'),      icon: 'move',     angle: 135, action: 'move', posType: 'primary' },
      { id: 'duplicate', label: window.t('radial.duplicate'), icon: 'copy',     angle: 180, action: 'duplicate', posType: 'primary' },
    ];
    const COLORS = [
      { label: window.t('radial.color.default'), hex: null },
      { label: window.t('radial.color.red'),     hex: '#d24a4f' },
      { label: window.t('radial.color.orange'),  hex: '#e07c2a' },
      { label: window.t('radial.color.gold'),    hex: '#e6c354' },
      { label: window.t('radial.color.green'),   hex: '#6fb442' },
      { label: window.t('radial.color.teal'),    hex: '#3aa6a0' },
      { label: window.t('radial.color.blue'),    hex: '#3a72c8' },
      { label: window.t('radial.color.purple'),  hex: '#8b5ec8' },
    ];
    const RADIUS = 116;
    const TOP_ANGLE = 270;
    const radialProjectPoint = new THREE.Vector3();
    const radialBoxCorners = [
      new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
      new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
    ];

    // Islands are transformed as a whole (move x/y/z + rotate-y via the gizmo),
    // so the cell-object actions (Color/Style/Size/Duplicate/More) don't apply.
    // Show only the actions the island gizmo actually supports.
    const ISLAND_ACTIONS = new Set(['move', 'rotate']);
    function selectedRadialIsland() {
      return (typeof selectedTransformGizmoIsland !== 'undefined' && selectedTransformGizmoIsland)
        ? selectedTransformGizmoIsland : null;
    }

    let currentLevel = 'root';
    let lastIslandMode = false;
    let lastEditPartKey = null;

    // While the user is actively working the ring (hovering or tapping a
    // button), freeze its screen position. Resizing/duplicating grows the
    // object's bounds, which would otherwise slide the ring out from under the
    // cursor between taps — so the next "+" tap lands on empty space. Hold the
    // last position until ~1.4s after the last interaction, then resume tracking
    // the (now larger) object. The root has pointer-events:none, so the freeze
    // is driven off the buttons (pointer-events:auto), not the root.
    const RADIAL_FREEZE_MS = 1400;
    let radialFreezeUntil = 0;
    let lastRadialCx = null, lastRadialCy = null;
    const extendRadialFreeze = () => { radialFreezeUntil = performance.now() + RADIAL_FREEZE_MS; };

    // Sub-object edit levels drill down: edit → edit-move/scale/color. Back goes
    // to the parent; backing out of 'edit' exits sub-edit mode.
    const LEVEL_PARENT = { edit: 'root', 'edit-move': 'edit', 'edit-scale': 'edit', 'edit-color': 'edit' };
    function subEdit() { return window.__tinyworldSubEdit || null; }
    function subEditTargetCell() {
      try { return (typeof selectedBoardObjectTargets === 'function') ? (selectedBoardObjectTargets()[0] || null) : null; }
      catch (_) { return null; }
    }
    function selectedRadialObject3D() {
      const se = subEdit();
      if (se && se.isActive && se.isActive() && se._object) return se._object();
      const island = selectedRadialIsland();
      if (island && island.contentGroup) return island.contentGroup;
      const t = subEditTargetCell();
      if (!t || typeof cellMeshes === 'undefined') return null;
      const entry = cellMeshes[t.x + ',' + t.z];
      return entry && entry.object ? entry.object : null;
    }
    // Mirrors the inspector gate (28): home-board objects with voxel/keyed parts.
    function subEditSupported() {
      const t = subEditTargetCell();
      if (!t || !t.cell) return false;
      if (typeof isOutsideHomeGrid === 'function' && isOutsideHomeGrid(t.x, t.z)) return false;
      if (typeof isVoxelSubEditableKind === 'function') return isVoxelSubEditableKind(t.cell.kind, t.cell);
      return false;
    }
    function enterEditMode() {
      const se = subEdit(); const t = subEditTargetCell();
      if (se && t) se.enter(t.x, t.z);
    }
    function exitEditMode() {
      const se = subEdit();
      if (se && se.isActive && se.isActive()) se.exit();
    }

    const root = document.createElement('div');
    root.className = 'radial-menu';
    root.hidden = true;
    document.body.appendChild(root);

    // Distribute n items across the bottom ~300° arc, leaving the top open.
    function arcAngles(n) {
      if (n <= 0) return [];
      if (n === 1) return [90];
      const span = 300, start = -60; // -60 → 240 (clockwise), gap centred on 270
      const out = [];
      for (let i = 0; i < n; i++) out.push(start + (span * i) / (n - 1));
      return out;
    }

    function makeBtn(cls, html, angle, idx, posType = 'primary') {
      const a = angle * Math.PI / 180;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'radial-btn ' + cls;
      if (posType) btn.dataset.posType = posType;
      btn.style.left = (Math.cos(a) * RADIUS) + 'px';
      btn.style.top = (Math.sin(a) * RADIUS) + 'px';
      btn.style.setProperty('--d', (idx * 0.035) + 's');
      btn.innerHTML = html;
      btn.addEventListener('pointerdown', e => { e.stopPropagation(); extendRadialFreeze(); });
      // Hovering toward a button also freezes the ring, so the very first tap
      // (and every one after) lands where the cursor already is.
      btn.addEventListener('pointerenter', extendRadialFreeze);
      return btn;
    }

    function iconHtml(name) {
      return '<span class="radial-icon" aria-hidden="true"><svg viewBox="0 0 24 24">' + ICONS[name] + '</svg></span>';
    }

    function renderLevel(level) {
      currentLevel = level;
      root.innerHTML = '';
      // Top Close (root) / Back (submenu).
      const top = makeBtn('radial-top', iconHtml(level === 'root' ? 'close' : 'back'), TOP_ANGLE, 0, 'neutral');
      top.title = level === 'root' ? window.t('radial.close') : window.t('radial.back');
      top.addEventListener('click', e => {
        e.stopPropagation();
        if (level === 'root') {
          exitEditMode();
          if (typeof clearSelection === 'function') clearSelection();
          root.hidden = true;
          currentLevel = 'root';
        } else {
          if (level === 'edit') exitEditMode(); // backing out of edit exits sub-edit
          renderLevel(LEVEL_PARENT[level] || 'root');
        }
      });
      root.appendChild(top);

      if (level === 'root') {
        const island = selectedRadialIsland();
        let items = island ? ROOT.filter(b => ISLAND_ACTIONS.has(b.id)) : ROOT.slice();
        // For editable objects (cottages / voxel-builds) the buried 'More' panel
        // slot becomes the 'Edit' entry to the sub-object radial.
        if (!island && subEditSupported()) {
          items = items.map(b => b.id === 'more'
            ? { id: 'edit', label: window.t('radial.edit'), icon: 'edit', angle: 90, posType: 'primary' }
            : b);
        }
        items.forEach((b, i) => {
          const btn = makeBtn('', iconHtml(b.icon) + '<span class="radial-label">' + b.label + '</span>', b.angle, i + 1, b.posType || 'primary');
          btn.title = b.label;
          btn.addEventListener('click', e => {
            e.stopPropagation();
            flash(btn);
            if (b.id === 'edit') { enterEditMode(); renderLevel('edit'); }
            else if (b.submenu) renderLevel(b.submenu);
            else runAction(b.action);
          });
          root.appendChild(btn);
        });
      } else if (level === 'edit') {
        const se = subEdit();
        const hasPart = !!(se && se.selectedInfo && se.selectedInfo());
        lastEditPartKey = hasPart ? se.selectedInfo().partKey : null;
        const exploded = !!(se && se.isExploded && se.isExploded());
        const items = [
          { label: window.t(exploded ? 'radial.edit.collapse' : 'radial.edit.explode'), icon: 'explode', act: () => { if (se) se.setExplode(!exploded); renderLevel('edit'); } },
          { label: window.t('radial.edit.move'),    icon: 'move',    sub: 'edit-move',  need: true },
          { label: window.t('radial.edit.scale'),   icon: 'size',    sub: 'edit-scale', need: true },
          { label: window.t('radial.edit.recolor'), icon: 'palette', sub: 'edit-color', need: true },
        ];
        const angles = arcAngles(items.length);
        items.forEach((it, i) => {
          const disabled = it.need && !hasPart;
          const btn = makeBtn(disabled ? 'is-disabled' : '', iconHtml(it.icon) + '<span class="radial-label">' + it.label + '</span>', angles[i], i + 1, 'primary');
          btn.title = disabled ? window.t('radial.edit.tapPart') : it.label;
          if (disabled) btn.style.opacity = '0.4';
          btn.addEventListener('click', e => {
            e.stopPropagation();
            if (disabled) return;
            flash(btn);
            if (it.act) it.act();
            else if (it.sub) renderLevel(it.sub);
          });
          root.appendChild(btn);
        });
      } else if (level === 'edit-move') {
        const se = subEdit(); const S = 0.25;
        const dirs = [
          ['X−', () => se && se.movePart(-S, 0, 0)], ['X+', () => se && se.movePart(S, 0, 0)],
          ['Y−', () => se && se.movePart(0, -S, 0)], ['Y+', () => se && se.movePart(0, S, 0)],
          ['Z−', () => se && se.movePart(0, 0, -S)], ['Z+', () => se && se.movePart(0, 0, S)],
        ];
        const angles = arcAngles(dirs.length);
        dirs.forEach((d, i) => {
          const btn = makeBtn('', '<span class="radial-label">' + d[0] + '</span>', angles[i], i + 1, 'primary');
          btn.title = d[0];
          btn.addEventListener('click', e => { e.stopPropagation(); flash(btn); d[1](); });
          root.appendChild(btn);
        });
      } else if (level === 'edit-scale') {
        const se = subEdit();
        const its = [['−', () => se && se.scalePart(0.85)], ['+', () => se && se.scalePart(1.18)]];
        const angles = arcAngles(its.length);
        its.forEach((d, i) => {
          const btn = makeBtn('', '<span class="radial-label">' + d[0] + '</span>', angles[i], i + 1, 'primary');
          btn.title = d[0];
          btn.addEventListener('click', e => { e.stopPropagation(); flash(btn); d[1](); });
          root.appendChild(btn);
        });
      } else if (level === 'edit-color') {
        const se = subEdit();
        const angles = arcAngles(COLORS.length);
        COLORS.forEach((c, i) => {
          const dot = c.hex
            ? '<span class="radial-swatch" style="background:' + c.hex + '"></span>'
            : '<span class="radial-swatch radial-swatch-reset"></span>';
          const btn = makeBtn('', dot + '<span class="radial-label">' + c.label + '</span>', angles[i], i + 1, c.hex ? 'primary' : 'neutral');
          btn.title = c.label;
          btn.addEventListener('click', e => { e.stopPropagation(); flash(btn); if (se && se.recolorPart) se.recolorPart(c.hex); });
          root.appendChild(btn);
        });
      } else if (level === 'size') {
        // Two-way scale for the whole selected object — explicit, labelled, no
        // hidden Shift modifier. Reuses scaleSelectedBoardObject() (universal:
        // basic kinds, buildings, voxel/asset-templates). 0.87 ≈ 1/1.15, so a
        // Shrink undoes a Grow tap-for-tap.
        const its = [
          { id: 'shrink', label: window.t('radial.size.shrink'), icon: 'minus', factor: 0.87 },
          { id: 'grow',   label: window.t('radial.size.grow'),   icon: 'plus',  factor: 1.15 },
        ];
        const angles = arcAngles(its.length);
        its.forEach((it, i) => {
          const btn = makeBtn('', iconHtml(it.icon) + '<span class="radial-label">' + it.label + '</span>', angles[i], i + 1, 'primary');
          btn.title = it.label;
          btn.addEventListener('click', e => {
            e.stopPropagation();
            flash(btn);
            if (typeof scaleSelectedBoardObject === 'function') scaleSelectedBoardObject(it.factor);
          });
          root.appendChild(btn);
        });
      } else if (level === 'color') {
        const angles = arcAngles(COLORS.length);
        COLORS.forEach((c, i) => {
          const dot = c.hex
            ? '<span class="radial-swatch" style="background:' + c.hex + '"></span>'
            : '<span class="radial-swatch radial-swatch-reset"></span>';
          const btn = makeBtn('', dot + '<span class="radial-label">' + c.label + '</span>', angles[i], i + 1, c.hex ? 'primary' : 'neutral');
          btn.title = c.label;
          btn.addEventListener('click', e => {
            e.stopPropagation();
            flash(btn);
            setSelectedColor(c.hex);
          });
          root.appendChild(btn);
        });
      }
    }

    function flash(btn) {
      if (!btn) return;
      btn.classList.add('pulse');
      setTimeout(() => btn.classList.remove('pulse'), 280);
    }

    function setSelectedColor(hex) {
      if (typeof updateSelectedBoardObjects !== 'function') return;
      updateSelectedBoardObjects(target => {
        const norm = (typeof normalizeAppearance === 'function') ? normalizeAppearance(target.cell.appearance) : target.cell.appearance;
        const ap = Object.assign({}, norm || {});
        if (hex) ap.bodyColor = hex; else delete ap.bodyColor;
        return { appearance: Object.keys(ap).length ? ap : null };
      });
    }

    function openSelectionPanel() {
      if (typeof window.openLayersPropertiesPanel === 'function') {
        window.openLayersPropertiesPanel();
        return;
      }
      const panel = document.getElementById('agent-panel');
      if (panel && panel.classList.contains('hidden')) {
        const t = document.getElementById('agent-panel-toggle');
        if (t) t.click();
      }
      const propTab = document.querySelector('.selection-tab[data-tab="properties"]');
      if (propTab) propTab.click();
    }

    function runAction(id) {
      try {
        if (id === 'duplicate') {
          if (typeof duplicateActiveCellIntent === 'function') duplicateActiveCellIntent();
        } else if (id === 'rotate') {
          const island = selectedRadialIsland();
          if (island) {
            island.rotationY = (island.rotationY || 0) + Math.PI / 2;
            if (typeof applyEditableIslandTransform === 'function') applyEditableIslandTransform(island);
          } else {
            const sel = window.__tinyworldSelection;
            if (sel && typeof sel.rotate === 'function') sel.rotate(Math.PI / 2);
            else if (typeof rotateSelectedCells === 'function') rotateSelectedCells(Math.PI / 2);
          }
        } else if (id === 'more' || id === 'style') {
          openSelectionPanel();
        } else if (id === 'move') {
          openSelectionPanel(); // until a dedicated move sub-ring lands
        }
      } catch (err) { console.warn('[radial] action failed', id, err); }
    }

    const radialBoundsBox = new THREE.Box3();
    function projectObjectBounds(obj, cam, rect) {
      if (!obj) return null;
      // Non-forced: dirty transforms (gizmo moves) still propagate, but a
      // clean subtree skips the full matrix re-multiply. Box3 is reused —
      // this runs every visible frame and allocated per call before.
      obj.updateMatrixWorld();
      const box = radialBoundsBox.setFromObject(obj);
      if (box.isEmpty()) return null;
      const min = box.min, max = box.max;
      radialBoxCorners[0].set(min.x, min.y, min.z);
      radialBoxCorners[1].set(min.x, min.y, max.z);
      radialBoxCorners[2].set(min.x, max.y, min.z);
      radialBoxCorners[3].set(min.x, max.y, max.z);
      radialBoxCorners[4].set(max.x, min.y, min.z);
      radialBoxCorners[5].set(max.x, min.y, max.z);
      radialBoxCorners[6].set(max.x, max.y, min.z);
      radialBoxCorners[7].set(max.x, max.y, max.z);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let visible = false;
      for (const p of radialBoxCorners) {
        p.project(cam);
        if (p.z > 1) continue;
        visible = true;
        const sx = rect.left + (p.x * 0.5 + 0.5) * rect.width;
        const sy = rect.top + (-p.y * 0.5 + 0.5) * rect.height;
        minX = Math.min(minX, sx); minY = Math.min(minY, sy);
        maxX = Math.max(maxX, sx); maxY = Math.max(maxY, sy);
      }
      if (!visible) return null;
      return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
    }

    function radialCenterAroundBounds(bounds, fallbackX, fallbackY, margin) {
      if (!bounds) return { x: fallbackX, y: fallbackY };
      const gap = RADIUS + 46;
      const candidates = [
        { x: bounds.maxX + gap, y: bounds.cy, clear: window.innerWidth - bounds.maxX, rank: 0 },
        { x: bounds.minX - gap, y: bounds.cy, clear: bounds.minX, rank: 1 },
        { x: bounds.cx, y: bounds.maxY + gap, clear: window.innerHeight - bounds.maxY, rank: 2 },
        { x: bounds.cx, y: bounds.minY - gap, clear: bounds.minY, rank: 3 },
      ];
      candidates.sort((a, b) => (b.clear - a.clear) || (a.rank - b.rank));
      for (const c of candidates) {
        if (c.x >= margin && c.x <= window.innerWidth - margin && c.y >= margin && c.y <= window.innerHeight - margin) {
          return c;
        }
      }
      return candidates[0] || { x: fallbackX, y: fallbackY };
    }

    function tickRadialMenu() {
      const gizmo = typeof transformGizmoGroup !== 'undefined' ? transformGizmoGroup : null;
      const cam = typeof camera !== 'undefined' ? camera : null;
      const dom = (typeof renderer !== 'undefined' && renderer) ? renderer.domElement : null;
      if (!gizmo || !cam || !dom || !gizmo.visible) {
        if (!root.hidden) { root.hidden = true; if (currentLevel !== 'root') exitEditMode(); currentLevel = 'root'; lastRadialCx = lastRadialCy = null; }
        return;
      }
      // Project against the *current* camera. updateCamera() (orbit) only sets
      // position + lookAt; it never refreshes matrixWorldInverse, so without
      // this the menu would project against last frame's camera and swim while
      // orbiting. Refresh here so the projection matches the frame being drawn.
      cam.updateMatrixWorld();
      const p = radialProjectPoint.copy(gizmo.position);
      p.y += 0.4;
      p.project(cam);
      if (p.z > 1) { if (!root.hidden) { root.hidden = true; currentLevel = 'root'; lastRadialCx = lastRadialCy = null; } return; }
      const rect = dom.getBoundingClientRect();
      const sx = rect.left + (p.x * 0.5 + 0.5) * rect.width;
      const sy = rect.top + (-p.y * 0.5 + 0.5) * rect.height;
      const m = RADIUS + 52;
      // Frozen while the user is on the ring — reuse the last position so the
      // buttons stay put under the cursor while scaling/duplicating. Otherwise
      // recompute around the (possibly resized) object's projected bounds.
      let cx, cy;
      if (lastRadialCx !== null && performance.now() < radialFreezeUntil) {
        cx = lastRadialCx; cy = lastRadialCy;
      } else {
        const bounds = projectObjectBounds(selectedRadialObject3D(), cam, rect);
        const around = radialCenterAroundBounds(bounds, sx, sy, m);
        cx = Math.max(m, Math.min(window.innerWidth - m, around.x));
        cy = Math.max(m, Math.min(window.innerHeight - m, around.y));
      }
      lastRadialCx = cx; lastRadialCy = cy;
      // translate3d (subpixel, GPU-composited) instead of left/top so the menu
      // tracks the object smoothly without per-frame layout or pixel snapping.
      root.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      const islandMode = !!selectedRadialIsland();
      if (root.hidden) {
        // Fresh appearance → reset to root ring and let the buttons spin in.
        renderLevel('root');
        lastIslandMode = islandMode;
        root.hidden = false;
      } else if (islandMode !== lastIslandMode) {
        // Selection type changed under an open menu (object ↔ island) — rebuild
        // the ring so the action set matches the new selection.
        renderLevel('root');
        lastIslandMode = islandMode;
      } else if (currentLevel === 'edit') {
        // Reactivity: when the user taps a part in the scene, flip Move/Scale/
        // Recolor from disabled → enabled by re-rendering the edit ring.
        const se = subEdit();
        const pk = (se && se.selectedInfo && se.selectedInfo()) ? se.selectedInfo().partKey : null;
        if (pk !== lastEditPartKey) renderLevel('edit');
      }
    }

    window.tickRadialMenu = tickRadialMenu;
  }());
