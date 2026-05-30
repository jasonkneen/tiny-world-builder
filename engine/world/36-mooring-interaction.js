  // -------- mooring interaction: hover highlight + style radial --------
  // Placed mooring cables are normally noPointerPick, so this module runs its
  // own raycast (against mooringGroup) to let the Select tool hover a cable
  // (highlights blue) and click it to open a radial that sets the connection
  // style: Power, Water, Waste, Data, Mooring.
  (function setupMooringInteraction() {
    const canvas = (typeof renderer !== 'undefined' && renderer) ? renderer.domElement : null;
    if (!canvas || typeof THREE === 'undefined') return;

    const _mrRay = new THREE.Raycaster();
    const _mrNdc = new THREE.Vector2();
    let hoveredRoot = null;
    const savedMats = new Map();
    let downX = 0, downY = 0, downOnCable = null;

    function selectModeActive() {
      return typeof selectedTool !== 'undefined' && selectedTool && selectedTool.select;
    }

    function cableRootFromObject(o) {
      let n = o;
      while (n) {
        if (n.userData && n.userData.mooringCableId) return n;
        n = n.parent;
      }
      return null;
    }

    function pickCableRoot(clientX, clientY) {
      if (typeof mooringGroup === 'undefined' || !mooringGroup || !mooringGroup.children.length) return null;
      _mrNdc.x = (clientX / window.innerWidth) * 2 - 1;
      _mrNdc.y = -(clientY / window.innerHeight) * 2 + 1;
      _mrRay.setFromCamera(_mrNdc, camera);
      const hits = _mrRay.intersectObjects(mooringGroup.children, true);
      for (const hit of hits) {
        const root = cableRootFromObject(hit.object);
        if (root) return root;
      }
      return null;
    }

    function setHover(root) {
      if (hoveredRoot === root) return;
      clearHover();
      hoveredRoot = root;
      if (root) {
        root.traverse(o => {
          if (o.isMesh) { savedMats.set(o, o.material); o.material = mooringHoverMaterial; }
        });
        canvas.style.cursor = 'pointer';
      }
    }
    function clearHover() {
      if (!hoveredRoot) return;
      savedMats.forEach((mat, mesh) => { if (mesh) mesh.material = mat; });
      savedMats.clear();
      hoveredRoot = null;
      canvas.style.cursor = '';
    }

    canvas.addEventListener('pointermove', e => {
      if (e.buttons) { return; }            // ignore while dragging/orbiting
      if (!selectModeActive() || radialOpen()) { if (!radialOpen()) clearHover(); return; }
      setHover(pickCableRoot(e.clientX, e.clientY));
    });
    canvas.addEventListener('pointerleave', () => clearHover());

    canvas.addEventListener('pointerdown', e => {
      if (!selectModeActive()) { downOnCable = null; return; }
      downX = e.clientX; downY = e.clientY;
      const root = pickCableRoot(e.clientX, e.clientY);
      downOnCable = root ? root.userData.mooringCableId : null;
    });
    canvas.addEventListener('pointerup', e => {
      if (!selectModeActive() || !downOnCable) return;
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moved > 6) { downOnCable = null; return; }
      const root = pickCableRoot(e.clientX, e.clientY);
      const id = root ? root.userData.mooringCableId : null;
      if (id && id === downOnCable) {
        e.preventDefault();
        e.stopPropagation();
        openMooringRadial(id, e.clientX, e.clientY);
      }
      downOnCable = null;
    });

    // ---- radial style picker ----
    let radialEl = null;
    function radialOpen() { return !!(radialEl && !radialEl.hidden); }

    function closeRadial() {
      if (radialEl) radialEl.hidden = true;
    }

    function openMooringRadial(cableId, cx, cy) {
      clearHover();
      if (!radialEl) {
        radialEl = document.createElement('div');
        radialEl.className = 'radial-menu mooring-radial';
        document.body.appendChild(radialEl);
      }
      radialEl.innerHTML = '';
      radialEl.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      radialEl.hidden = false;

      const styles = (typeof MOORING_STYLES !== 'undefined') ? MOORING_STYLES : [];
      const cable = (typeof mooringCables !== 'undefined') ? mooringCables.find(c => c.id === cableId) : null;
      const current = cable ? cable.style : 'mooring';

      // Centre close button.
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'radial-btn radial-top';
      close.style.left = '0px';
      close.style.top = '0px';
      close.innerHTML = '<span class="radial-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></span>';
      close.addEventListener('click', ev => { ev.stopPropagation(); closeRadial(); });
      radialEl.appendChild(close);

      // Style buttons spread across the bottom ~300° arc.
      const n = styles.length;
      const R = 104;
      const startA = 130, endA = 410;            // degrees (clockwise, screen space)
      styles.forEach((st, i) => {
        const a = (startA + (endA - startA) * (n === 1 ? 0.5 : i / (n - 1))) * Math.PI / 180;
        const x = Math.cos(a) * R;
        const y = Math.sin(a) * R;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'radial-btn' + (st.id === current ? ' pulse' : '');
        btn.style.left = x + 'px';
        btn.style.top = y + 'px';
        btn.style.setProperty('--d', (i * 0.03) + 's');
        const hex = '#' + st.color.toString(16).padStart(6, '0');
        btn.innerHTML =
          '<span class="radial-swatch" style="background:' + hex + '"></span>' +
          '<span class="radial-label">' + st.label + '</span>';
        btn.addEventListener('click', ev => {
          ev.stopPropagation();
          if (typeof setMooringCableStyle === 'function') setMooringCableStyle(cableId, st.id);
          closeRadial();
        });
        radialEl.appendChild(btn);
      });
    }

    // Dismiss on outside click or Escape.
    document.addEventListener('pointerdown', e => {
      if (radialOpen() && radialEl && !radialEl.contains(e.target)) closeRadial();
    }, true);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && radialOpen()) closeRadial();
    });
  })();
