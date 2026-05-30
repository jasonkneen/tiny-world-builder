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
    };

    // Root ring — angles in screen degrees (0=right, 90=down, 270=up). The top
    // slot (270) is reserved for Close / Back.
    const ROOT = [
      { id: 'color',     label: 'Color',     icon: 'palette',  angle: 225, submenu: 'color' },
      { id: 'style',     label: 'Style',     icon: 'sparkles', angle: 315, action: 'style' },
      { id: 'size',      label: 'Size',      icon: 'size',     angle: 0,   action: 'size' },
      { id: 'rotate',    label: 'Rotate',    icon: 'rotate',   angle: 45,  action: 'rotate' },
      { id: 'more',      label: 'More',      icon: 'more',     angle: 90,  action: 'more' },
      { id: 'move',      label: 'Move',      icon: 'move',     angle: 135, action: 'move' },
      { id: 'duplicate', label: 'Duplicate', icon: 'copy',     angle: 180, action: 'duplicate' },
    ];
    const COLORS = [
      { label: 'Default', hex: null },
      { label: 'Red',     hex: '#d24a4f' },
      { label: 'Orange',  hex: '#e07c2a' },
      { label: 'Gold',    hex: '#e6c354' },
      { label: 'Green',   hex: '#6fb442' },
      { label: 'Teal',    hex: '#3aa6a0' },
      { label: 'Blue',    hex: '#3a72c8' },
      { label: 'Purple',  hex: '#8b5ec8' },
    ];
    const RADIUS = 116;
    const TOP_ANGLE = 270;

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

    function makeBtn(cls, html, angle, idx) {
      const a = angle * Math.PI / 180;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'radial-btn ' + cls;
      btn.style.left = (Math.cos(a) * RADIUS) + 'px';
      btn.style.top = (Math.sin(a) * RADIUS) + 'px';
      btn.style.setProperty('--d', (idx * 0.035) + 's');
      btn.innerHTML = html;
      btn.addEventListener('pointerdown', e => e.stopPropagation());
      return btn;
    }

    function iconHtml(name) {
      return '<span class="radial-icon" aria-hidden="true"><svg viewBox="0 0 24 24">' + ICONS[name] + '</svg></span>';
    }

    function renderLevel(level) {
      currentLevel = level;
      root.innerHTML = '';
      // Top Close (root) / Back (submenu).
      const top = makeBtn('radial-top', iconHtml(level === 'root' ? 'close' : 'back'), TOP_ANGLE, 0);
      top.title = level === 'root' ? 'Close' : 'Back';
      top.addEventListener('click', e => {
        e.stopPropagation();
        if (level === 'root') { if (typeof clearSelection === 'function') clearSelection(); }
        else renderLevel('root');
      });
      root.appendChild(top);

      if (level === 'root') {
        const island = selectedRadialIsland();
        const items = island ? ROOT.filter(b => ISLAND_ACTIONS.has(b.id)) : ROOT;
        items.forEach((b, i) => {
          const btn = makeBtn('', iconHtml(b.icon) + '<span class="radial-label">' + b.label + '</span>', b.angle, i + 1);
          btn.title = b.label;
          btn.addEventListener('click', e => {
            e.stopPropagation();
            flash(btn);
            if (b.submenu) renderLevel(b.submenu);
            else runAction(b.action);
          });
          root.appendChild(btn);
        });
      } else if (level === 'color') {
        const angles = arcAngles(COLORS.length);
        COLORS.forEach((c, i) => {
          const dot = c.hex
            ? '<span class="radial-swatch" style="background:' + c.hex + '"></span>'
            : '<span class="radial-swatch radial-swatch-reset"></span>';
          const btn = makeBtn('', dot + '<span class="radial-label">' + c.label + '</span>', angles[i], i + 1);
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
        } else if (id === 'size') {
          if (typeof scaleSelectedBoardObject === 'function') {
            scaleSelectedBoardObject((window.event && window.event.shiftKey) ? 0.87 : 1.15);
          }
        } else if (id === 'more' || id === 'style') {
          openSelectionPanel();
        } else if (id === 'move') {
          openSelectionPanel(); // until a dedicated move sub-ring lands
        }
      } catch (err) { console.warn('[radial] action failed', id, err); }
    }

    function tickRadialMenu() {
      const gizmo = typeof transformGizmoGroup !== 'undefined' ? transformGizmoGroup : null;
      const cam = typeof camera !== 'undefined' ? camera : null;
      const dom = (typeof renderer !== 'undefined' && renderer) ? renderer.domElement : null;
      if (!gizmo || !cam || !dom || !gizmo.visible) {
        if (!root.hidden) { root.hidden = true; currentLevel = 'root'; }
        return;
      }
      // Project against the *current* camera. updateCamera() (orbit) only sets
      // position + lookAt; it never refreshes matrixWorldInverse, so without
      // this the menu would project against last frame's camera and swim while
      // orbiting. Refresh here so the projection matches the frame being drawn.
      cam.updateMatrixWorld();
      const p = gizmo.position.clone();
      p.y += 0.4;
      p.project(cam);
      if (p.z > 1) { if (!root.hidden) { root.hidden = true; currentLevel = 'root'; } return; }
      const rect = dom.getBoundingClientRect();
      const sx = rect.left + (p.x * 0.5 + 0.5) * rect.width;
      const sy = rect.top + (-p.y * 0.5 + 0.5) * rect.height;
      const m = RADIUS + 52;
      // translate3d (subpixel, GPU-composited) instead of left/top so the menu
      // tracks the object smoothly without per-frame layout or pixel snapping.
      const cx = Math.max(m, Math.min(window.innerWidth - m, sx));
      const cy = Math.max(m, Math.min(window.innerHeight - m, sy));
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
      }
    }

    window.tickRadialMenu = tickRadialMenu;
  }());
