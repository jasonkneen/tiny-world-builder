  // -------- floating agent panel + selection rendering (extracted from 28-generate-panel-agent.js) --------
  // Floating chat agent panel, preview staging, selection properties, and the
  // submit handler that ties AI generation to world mutation. Depends on globals
  // from earlier modules via the shared global scope.

  // -------- floating agent wiring --------
  (function wireFloatingAgent() {
    const form = document.getElementById('agent-input');
    const grip = document.getElementById('agent-grip');
    const targetChip = document.getElementById('agent-target-chip');
    const input = document.getElementById('agent-prompt');
    const send = document.getElementById('agent-send');
    const panel = document.getElementById('agent-panel');
    const toggle = document.getElementById('agent-panel-toggle');
    const resizer = document.getElementById('agent-panel-resizer');
    const messages = document.getElementById('agent-messages');
    if (!form || !grip || !input || !send || !panel || !toggle || !messages) return;

    const PANEL_POS_KEY = 'tinyworld:agent:panel-pos';
    const PANEL_DEFAULT_WIDTH = 388;
    const PANEL_MIN_WIDTH = 320;
    const PANEL_MAX_WIDTH = 560;
    const AUTO_HIDE_MS = 3500; // retained for placeholder decay timing only
    let pinnedOpen = false;
    let hasAgentActivity = false;
    let panelWidth = PANEL_DEFAULT_WIDTH;

    function markAgentActivity() {
      if (!hasAgentActivity) {
        hasAgentActivity = true;
        panel.classList.add('has-activity');
        updatePanelHandleVisibility();
      }
    }

    function updatePanelHandleVisibility() {
      const handle = document.getElementById('agent-panel-handle');
      if (!handle) return;
      handle.hidden = true;
    }

    function maxPanelWidth() {
      return Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, window.innerWidth - 36));
    }

    function clampPanelWidth(width) {
      const n = Number(width);
      if (!Number.isFinite(n)) return PANEL_DEFAULT_WIDTH;
      return Math.max(PANEL_MIN_WIDTH, Math.min(maxPanelWidth(), Math.round(n)));
    }

    function savePanelState() {
      try {
        localStorage.setItem(PANEL_POS_KEY, JSON.stringify({
          width: panelWidth,
          collapsed: panel.classList.contains('collapsed'),
          visible: !panel.classList.contains('hidden'),
        }));
      } catch (_) {}
    }

    function applyPanelWidth(width) {
      panelWidth = clampPanelWidth(width);
      panel.style.setProperty('--agent-panel-width', panelWidth + 'px');
    }

    const ROBOT_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>';
    function updateCollapseButton() {
      const collapsed = panel.classList.contains('collapsed');
      if (collapsed) toggle.innerHTML = ROBOT_ICON_SVG;
      else toggle.textContent = '×';
      toggle.setAttribute('aria-label', collapsed ? 'Expand AI chat' : 'Collapse AI chat');
      toggle.title = collapsed ? 'Expand AI chat' : 'Collapse AI chat';
      form.classList.toggle('conversation-open', !collapsed);
      document.body.classList.toggle('agent-conversation-open', !collapsed);
      updatePanelHandleVisibility();
    }

    function syncAgentPanelPosition() {
      applyPanelWidth(panelWidth);
      updateCollapseButton();
    }

    function syncAgentStackState() {
      syncAgentPanelPosition();
    }

    function clearTimers() {}

    function scheduleAutoFlow() {
      // The AI panel is now a persistent chat surface; do not auto-hide it.
    }

    function showPanel() {
      panel.classList.remove('hidden');
      syncAgentStackState();
      savePanelState();
    }

    function setPanelCollapsed(collapsed, opts) {
      if (!collapsed) panel.classList.remove('hidden');
      panel.classList.toggle('collapsed', !!collapsed);
      pinnedOpen = !collapsed;
      syncAgentStackState();
      if (!collapsed) messages.scrollTop = messages.scrollHeight;
      if (!(opts && opts.noSave)) savePanelState();
    }

    function hidePanel() {
      setPanelCollapsed(true);
    }

    // Progress placeholder helpers — during work, the chat input's
    // placeholder mirrors the latest assistant status. The toast pill
    // is reserved for the final result.
    const DEFAULT_PLACEHOLDER = input.placeholder || 'Ask the agent to change this world…';
    function setInputProgress(text) {
      input.placeholder = text || DEFAULT_PLACEHOLDER;
    }
    function clearInputProgress() {
      input.placeholder = DEFAULT_PLACEHOLDER;
    }

    function addAgentMessage(role, text) {
      const div = document.createElement('div');
      div.className = 'agent-msg ' + role;
      div.textContent = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
      updatePanelHandleVisibility();
      return div;
    }

    function pulseRgbFromHex(hex) {
      const clean = normalizeHexColor(hex);
      if (!clean) return '214, 169, 59';
      const n = parseInt(clean.slice(1), 16);
      return ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255);
    }

    function agentPulseHexForTarget(target, summary) {
      if (target && target.cell) {
        const cell = target.cell;
        const appearance = normalizeAppearance(cell.appearance);
        if (appearance && appearance.topColor) return appearance.topColor;
        if (appearance && appearance.bodyColor) return appearance.bodyColor;
        if (cell.kind === 'tree') return materialHex(M.leaves) || '#86d139';
        if (cell.kind === 'rock') return materialHex(M.rock) || '#9b9a8f';
        if (cell.kind === 'house') {
          if (cell.buildingType === 'manor') return materialHex(M.manorRoof) || '#403b3d';
          if (cell.buildingType === 'tower') return materialHex(M.towerRoof) || '#7563c9';
          if (cell.buildingType === 'castle') return materialHex(M.castleRoof) || '#6d5bc7';
          if (cell.buildingType === 'skyhouse') return materialHex(M.skyRoof) || '#70a8df';
          return materialHex(M.roofBlue) || '#2f8fe6';
        }
        if (cell.kind === 'voxel-build') return '#86d139';
        if (cell.kind === 'crop' || cell.kind === 'carrot' || cell.kind === 'pumpkin') return materialHex(M.cropLeaf) || '#96d943';
        if (cell.kind === 'sunflower' || cell.kind === 'corn' || cell.kind === 'wheat') return materialHex(M.sunflowerPetal) || '#f2c849';
      }
      if (summary && summary.cellCount > 0) return '#7fb03d';
      return '#d6a93b';
    }

    function syncAgentTargetChip(target, summary) {
      if (!targetChip) return;
      form.style.setProperty('--agent-pulse-rgb', pulseRgbFromHex(agentPulseHexForTarget(target, summary)));
      if (target) {
        const text = 'Selected: ' + selectedBoardObjectLabel(target);
        targetChip.textContent = text;
        targetChip.title = text + ' - click to clear';
        targetChip.hidden = false;
        form.classList.add('has-target');
      } else if (summary && summary.cellCount > 0) {
        targetChip.textContent = 'Selected: ' + summary.cellCount + (summary.cellCount === 1 ? ' tile' : ' tiles');
        targetChip.title = targetChip.textContent + ' - click to clear';
        targetChip.hidden = false;
        form.classList.add('has-target');
      } else {
        targetChip.textContent = '';
        targetChip.title = 'Selected object target';
        targetChip.hidden = true;
        form.classList.remove('has-target');
      }
      syncAgentPanelPosition();
    }

    function fireToast() {
      // The right-side chat stays open/pinned like a normal chat transcript.
      showPanel();
      panel.classList.remove('collapsed');
      pinnedOpen = true;
      syncAgentStackState();
      savePanelState();
      messages.scrollTop = messages.scrollHeight;
    }

    window.__tinyworldAgent = {
      open() { showPanel(); setPanelCollapsed(false, { pin: true }); },
      // Adds a message to the conversation history. Assistant text is
      // mirrored in the input placeholder as a live progress hint. No
      // toast is fired — that's reserved for `done()`.
      add(role, text) {
        if (role === 'assistant') setInputProgress(text);
        return addAgentMessage(role, text);
      },
      // Updates an existing message + the placeholder. No toast.
      update(node, text, role) {
        if (!node) return;
        if (role) node.className = 'agent-msg ' + role;
        node.textContent = text;
        messages.scrollTop = messages.scrollHeight;
        setInputProgress(text);
      },
      // Final / result. Records to history, slides the toast in, and
      // restores the default placeholder once the toast has decayed.
      done(text, role) {
        role = role || 'assistant';
        const node = addAgentMessage(role, text);
        setInputProgress(text);
        const keepOpen = pinnedOpen && !panel.classList.contains('collapsed');
        if (keepOpen) {
          showPanel();
          messages.scrollTop = messages.scrollHeight;
        } else {
          fireToast();
        }
        setTimeout(() => {
          if (input.placeholder === text) clearInputProgress();
        }, AUTO_HIDE_MS + 600);
        return node;
      },
    };

    function applyStoredPanelState() {
      let collapsed = true;
      let visible = false;
      try {
        const raw = localStorage.getItem(PANEL_POS_KEY);
        if (raw) {
          const p = JSON.parse(raw);
          if (Number.isFinite(p.width)) applyPanelWidth(p.width);
          if (typeof p.collapsed === 'boolean') collapsed = p.collapsed;
          if (typeof p.visible === 'boolean') visible = p.visible;
          else if (p.collapsed === false) visible = true;
        }
      } catch (_) {}
      if (visible) panel.classList.remove('hidden');
      else panel.classList.add('hidden');
      setPanelCollapsed(collapsed, { noSave: true });
    }

    // Collapse button in the panel header: keep conversation state intact.
    toggle.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      setPanelCollapsed(!panel.classList.contains('collapsed'));
    });

    // Clear conversation button: empties messages, resets activity flag so handle hides.
    const clearBtn = document.getElementById('agent-panel-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        messages.innerHTML = '';
        hasAgentActivity = false;
        panel.classList.remove('has-activity');
        syncAgentStackState();
      });
    }

    // Clicking the collapsed rail expands the panel.
    let suppressNextClick = false;
    panel.addEventListener('click', e => {
      if (suppressNextClick) { suppressNextClick = false; e.stopPropagation(); return; }
      if (e.target.closest('.agent-panel-toggle')) return;
      if (panel.classList.contains('collapsed')) setPanelCollapsed(false, { pin: true });
    });

    const panelHandle = document.getElementById('agent-panel-handle');
    if (panelHandle) {
      panelHandle.addEventListener('click', () => {
        setPanelCollapsed(false, { pin: true });
      });
    }

    applyStoredPanelState();
    syncAgentStackState();
    window.addEventListener('resize', () => {
      applyPanelWidth(panelWidth);
      savePanelState();
      syncAgentStackState();
    });

    // Up arrow in the chat input slides the panel in and expands it to
    // show the full conversation (pinned open).
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setPanelCollapsed(false, { pin: true });
      }
    });
    if (targetChip) {
      targetChip.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        if (window.__tinyworldSelection) window.__tinyworldSelection.clear();
        input.focus();
      });
    }

    // -- selection preview wiring --
    // When the canvas tells us the selection changed, refresh the preview
    // block inside the panel and slide the panel in if there's anything
    // selected. Clearing selection collapses the preview back.
    const previewBox = document.getElementById('agent-selection-preview');
    const previewCount = document.getElementById('agent-selection-count');
    const previewList = document.getElementById('agent-selection-list');
    const previewProps = document.getElementById('agent-selection-properties');
    const panelTitle = document.getElementById('agent-panel-title');
    const previewCanvas = document.getElementById('selection-preview-canvas');
    const SELECTION_PROP_COLLAPSED_LS = 'tinyworld:selection-props-collapsed.v1';
    const SELECTION_PROP_ACTIVE_TAB_LS = 'tinyworld:selection-props-active-tab.v1';

    function loadSelectionPropCollapsedSections() {
      try {
        const raw = JSON.parse(localStorage.getItem(SELECTION_PROP_COLLAPSED_LS) || '[]');
        return new Set(Array.isArray(raw) ? raw.filter(item => typeof item === 'string') : []);
      } catch (_) {
        return new Set();
      }
    }

    function saveSelectionPropCollapsedSections() {
      try {
        localStorage.setItem(SELECTION_PROP_COLLAPSED_LS, JSON.stringify(Array.from(selectionPropCollapsedSections)));
      } catch (_) {}
    }

    const selectionPropCollapsedSections = loadSelectionPropCollapsedSections();
    let selectionPropActiveTab = (() => {
      try { return localStorage.getItem(SELECTION_PROP_ACTIVE_TAB_LS) || 'transform'; }
      catch (_) { return 'transform'; }
    })();

    function saveSelectionPropActiveTab() {
      try { localStorage.setItem(SELECTION_PROP_ACTIVE_TAB_LS, selectionPropActiveTab); } catch (_) {}
    }
    function notifySelectionPropertiesRendered() {
      try { window.dispatchEvent(new CustomEvent('tinyworld:selection-properties-rendered')); } catch (_) {}
    }
    function openSelectionPropertiesInLayers() {
      if (typeof window.openLayersPropertiesPanel === 'function') window.openLayersPropertiesPanel();
    }

    // Preview rotator state (reused Three.js renderer)
    let previewRenderer = null;
    let previewScene = null;
    let previewCamera = null;
    let previewMesh = null;
    let previewRAF = null;

    function selectedWorldCoords() {
      const sel = window.__tinyworldSelection;
      return sel && sel.worldCoords ? sel.worldCoords() : [];
    }

    function makeSelectionPreviewObject(target) {
      if (!target || !target.cell || !target.cell.kind) return null;
      const cell = target.cell;
      const kind = cell.kind;
      const level = cell.floors || 1;
      const voxelRender = makeVoxelRenderForCell(kind, target.x || 0, target.z || 0, cell, level);
      if (voxelRender && !voxelRender.skip && voxelRender.mesh) return voxelRender.mesh;
      if (kind === 'model-stamp') return makeModelStamp(cell.appearance && cell.appearance.modelStampId, { appearance: cell.appearance });
      if (kind === 'house') return makeHouse(cell.floors || 2, cell.buildingType || 'cottage');
      if (kind === 'tree') return makeTree(level);
      if (kind === 'rock') return makeRock(null, level, target.x || 0, target.z || 0, cell.terrain === 'water');
      if (kind === 'bridge') return makeBridge('x', level);
      if (kind === 'fence') return makeFence(normalizeFenceSide(cell.fenceSide), level);
      if (kind === 'tuft') return makeTuft();
      if (kind === 'flower') return makeFlower();
      if (kind === 'bush') return makeBush();
      if (kind === 'crop') return makeCrop();
      if (kind === 'corn') return makeCorn();
      if (kind === 'wheat') return makeWheat();
      if (kind === 'pumpkin') return makePumpkin();
      if (kind === 'carrot') return makeCarrot();
      if (kind === 'sunflower') return makeSunflower();
      if (kind === 'cow') return makeCow();
      if (kind === 'sheep') return makeSheep();
      if (kind === 'pig') return makePig();
      return null;
    }

    function frameSelectionPreviewObject(obj) {
      if (!obj || !previewCamera) return;
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return;
      const center = box.getCenter(new THREE.Vector3());
      obj.position.x -= center.x;
      obj.position.z -= center.z;
      obj.position.y -= box.min.y;
      obj.updateMatrixWorld(true);
      const fitBox = new THREE.Box3().setFromObject(obj);
      const size = fitBox.getSize(new THREE.Vector3());
      const span = Math.max(0.65, size.x, size.y, size.z);
      const lookY = Math.max(0.24, size.y * 0.46);
      const r = Math.max(1.8, span * 2.05);
      previewCamera.near = 0.05;
      previewCamera.far = Math.max(20, r * 8);
      previewCamera.position.set(r, r * 0.78, r);
      previewCamera.lookAt(0, lookY, 0);
      previewCamera.updateProjectionMatrix();
    }

    function updateSelectionPreview(target) {
      if (!previewCanvas) return;
      if (target && previewBox && (previewBox.hidden || previewBox.classList.contains('selection-staging'))) {
        target = null;
      }
      if (!target || !target.cell) {
        // clear preview
        if (previewMesh) {
          if (previewScene) previewScene.remove(previewMesh);
          disposeGroup(previewMesh);
          previewMesh = null;
        }
        if (previewRAF) {
          cancelAnimationFrame(previewRAF);
          previewRAF = null;
        }
        const actionsEl = document.getElementById('selection-preview-actions');
        if (actionsEl) actionsEl.innerHTML = '';
        if (previewRenderer && previewCanvas) {
          const ctx = previewCanvas.getContext('2d');
          ctx && ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        }
        return;
      }
      // init renderer once
      if (!previewRenderer) {
        previewRenderer = new THREE.WebGLRenderer({ canvas: previewCanvas, antialias: true, alpha: true });
        previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        previewScene = new THREE.Scene();
        previewCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
        previewCamera.position.set(1.8, 1.6, 1.8);
        previewCamera.lookAt(0, 0.6, 0);
        const light = new THREE.DirectionalLight(0xffffff, 0.9);
        light.position.set(2, 4, 2);
        previewScene.add(light);
        previewScene.add(new THREE.AmbientLight(0xffffff, 0.6));
      }
      // remove old mesh
      if (previewMesh) {
        previewScene.remove(previewMesh);
        disposeGroup(previewMesh);
        previewMesh = null;
      }
      // create mesh from kind (reuse factories where possible)
      let obj = null;
      try {
        obj = makeSelectionPreviewObject(target);
      } catch (e) { /* fallback */ }
      if (!obj) {
        // simple fallback box
        const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const mat = new THREE.MeshLambertMaterial({ color: 0x88aaff });
        obj = new THREE.Mesh(geo, mat);
      }
      if (target.cell.kind !== 'model-stamp') applyAppearanceToObject(obj, target.cell.kind, target.cell.appearance);
      obj.scale.setScalar(0.95);
      frameSelectionPreviewObject(obj);
      previewScene.add(obj);
      previewMesh = obj;
      resizePreviewRenderer();
      populatePreviewActions(target);
      // kick a slow rotate loop if not running
      if (!previewRAF) startPreviewRotate();
    }

    function startPreviewRotate() {
      const tick = () => {
        if (!previewMesh) {
          previewRAF = null;
          return;
        }
        if (previewMesh) {
          previewMesh.rotation.y = (previewMesh.rotation.y || 0) + 0.012;
        }
        if (previewRenderer && previewScene && previewCamera) {
          previewRenderer.render(previewScene, previewCamera);
        }
        previewRAF = requestAnimationFrame(tick);
      };
      previewRAF = requestAnimationFrame(tick);
    }

    function resizePreviewRenderer() {
      if (!previewRenderer || !previewCanvas) return;
      const rect = previewCanvas.getBoundingClientRect();
      const w = Math.max(64, Math.floor(rect.width));
      const h = w; // square
      previewRenderer.setSize(w, h, false);
      if (previewCamera) {
        previewCamera.aspect = 1;
        previewCamera.updateProjectionMatrix();
      }
    }

    const SELECTION_BODY_COLOR_OPTIONS = [
      { label: 'Stone', value: '#a9a39a', color: '#a9a39a' },
      { label: 'Limestone', value: '#d8d0b8', color: '#d8d0b8' },
      { label: 'Cream', value: '#f2dfb0', color: '#f2dfb0' },
      { label: 'Whitewash', value: '#f4eee2', color: '#f4eee2' },
      { label: 'Brick', value: '#a84a3a', color: '#a84a3a' },
      { label: 'Terracotta', value: '#c46b3f', color: '#c46b3f' },
      { label: 'Ochre', value: '#c9a45b', color: '#c9a45b' },
      { label: 'Sage', value: '#8fa66b', color: '#8fa66b' },
      { label: 'Bluewash', value: '#8bb3c9', color: '#8bb3c9' },
      { label: 'Charcoal', value: '#55514d', color: '#55514d' },
      { label: 'Dark', value: '#77716a', color: '#77716a' },
    ];
    const SELECTION_TOP_COLOR_OPTIONS = [
      { label: 'Purple', value: '#6c55c7', color: '#6c55c7' },
      { label: 'Blue', value: '#2f74b7', color: '#2f74b7' },
      { label: 'Sky', value: '#66a6d9', color: '#66a6d9' },
      { label: 'Red', value: '#b84b38', color: '#b84b38' },
      { label: 'Terracotta', value: '#c8663d', color: '#c8663d' },
      { label: 'Green', value: '#4e8a49', color: '#4e8a49' },
      { label: 'Teal', value: '#3e8f8d', color: '#3e8f8d' },
      { label: 'Gold', value: '#d6a93b', color: '#d6a93b' },
      { label: 'Slate', value: '#3a3a40', color: '#3a3a40' },
      { label: 'Black', value: '#202329', color: '#202329' },
    ];
    const SELECTION_LEAF_COLOR_OPTIONS = [
      { label: 'Pine', value: '#4f8a2c', color: '#4f8a2c' },
      { label: 'Bright', value: '#86d139', color: '#86d139' },
      { label: 'Olive', value: '#7f9443', color: '#7f9443' },
      { label: 'Cypress', value: '#2f6f44', color: '#2f6f44' },
      { label: 'Autumn', value: '#c07a2f', color: '#c07a2f' },
      { label: 'Amber', value: '#d6a93b', color: '#d6a93b' },
      { label: 'Redleaf', value: '#a84a3a', color: '#a84a3a' },
      { label: 'Blossom', value: '#e9a3bd', color: '#e9a3bd' },
      { label: 'Lilac', value: '#b79ad8', color: '#b79ad8' },
      { label: 'Winter', value: '#7ba66d', color: '#7ba66d' },
    ];
    const SELECTION_TRUNK_COLOR_OPTIONS = [
      { label: 'Brown', value: '#5c3818', color: '#5c3818' },
      { label: 'Oak', value: '#8a5a2f', color: '#8a5a2f' },
      { label: 'Cedar', value: '#6d4325', color: '#6d4325' },
      { label: 'Redwood', value: '#8f4a34', color: '#8f4a34' },
      { label: 'Birch', value: '#d8c8a8', color: '#d8c8a8' },
      { label: 'Ash', value: '#a99b85', color: '#a99b85' },
      { label: 'Dark', value: '#3f2a18', color: '#3f2a18' },
    ];
    function selectionColorOptions(options) {
      return [{ label: 'Default', value: 'default' }].concat(options || []);
    }
    // Each material chip carries a small visual marker so the row is readable at
    // a glance (feedback #2 — chips were text-only). `swatch` is a representative
    // material colour and `glyph` is a tiny inline SVG (tinted via currentColor),
    // following the SVG-glyph pattern in 19-tools-toolbar.js (TOOL_GLYPH_SVG).
    // PROJECT RULE: SVG glyphs only — never PNG/baked icons.
    const SELECTION_MATERIAL_OPTIONS = [
      { label: 'Default', value: 'default', swatch: '#aab0b8', glyph: '<svg viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2"/></svg>' },
      { label: 'Brick', value: 'brick', swatch: '#b0563a', glyph: '<svg viewBox="0 0 16 16"><path d="M2 5h12M2 8h12M2 11h12M7 5v3M11 8v3M7 11v3M4 8v3" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>' },
      { label: 'Stone', value: 'cottage-stone', swatch: '#9a948a', glyph: '<svg viewBox="0 0 16 16"><path d="M2.5 4.5h5v3h-5zM8.5 4.5h5v3h-5zM2.5 8.5h5v3h-5zM8.5 8.5h5v3h-5z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>' },
      { label: 'Rock', value: 'rock-face', swatch: '#6f6a64', glyph: '<svg viewBox="0 0 16 16"><path d="M8 2.5 13.5 8 8 13.5 2.5 8Z M8 2.5 8 13.5 M2.5 8 13.5 8" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>' },
      { label: 'Slate', value: 'shingles', swatch: '#5a6b7d', glyph: '<svg viewBox="0 0 16 16"><path d="M3 5.5h10M3 9.5h10M3 13.5h10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' },
      { label: 'Wood', value: 'cottage-wood', swatch: '#9c6b3b', glyph: '<svg viewBox="0 0 16 16"><path d="M4 2.5v11M8 2.5v11M12 2.5v11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' },
      { label: 'Grass', value: 'cottage-grass', swatch: '#4f9a43', glyph: '<svg viewBox="0 0 16 16"><path d="M5 13.5C4 9.5 3.5 7 3.5 4.5M8 13.5V4M11 13.5c1-4 1.5-6.5 1.5-9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' },
      { label: 'Dirt', value: 'cottage-dirt', swatch: '#6f4a2c', glyph: '<svg viewBox="0 0 16 16"><g fill="currentColor"><circle cx="4.5" cy="5" r="1.2"/><circle cx="9" cy="7" r="1.2"/><circle cx="12" cy="4.5" r="1.2"/><circle cx="6" cy="11" r="1.2"/><circle cx="11" cy="11.5" r="1.2"/></g></svg>' },
      { label: 'Sand', value: 'sand', swatch: '#cdb267', glyph: '<svg viewBox="0 0 16 16"><path d="M2.5 6c1.5-2 3.5-2 5 0s3.5 2 6 0M2.5 11c1.5-2 3.5-2 5 0s3.5 2 6 0" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>' },
    ];
    const SELECTION_COLOR_EDITABLE_KINDS = new Set([
      'house', 'voxel-build', 'tree', 'rock', 'bridge', 'fence', 'crop',
      'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower', 'flower', 'bush',
      'cow', 'sheep', 'pig',
    ]);
    function isSelectionPartMaterialEditableCell(cell) {
      return !!(cell && cell.kind && cell.kind !== 'model-stamp');
    }
    const SELECTION_CROP_COLOR_KINDS = new Set(['crop', 'corn', 'wheat', 'pumpkin', 'carrot', 'sunflower', 'flower', 'bush']);
    function selectionColorConfig(kind) {
      if (kind === 'house' || kind === 'voxel-build') {
        return {
          kinds: new Set([kind]),
          rows: [
            { key: 'topColor', label: 'Top', options: selectionColorOptions(SELECTION_TOP_COLOR_OPTIONS) },
            { key: 'bodyColor', label: 'Body', options: selectionColorOptions(SELECTION_BODY_COLOR_OPTIONS) },
          ],
        };
      }
      if (kind === 'tree') {
        return {
          kinds: new Set(['tree']),
          rows: [
            { key: 'topColor', label: 'Leaves', options: selectionColorOptions(SELECTION_LEAF_COLOR_OPTIONS) },
            { key: 'bodyColor', label: 'Trunk', options: selectionColorOptions(SELECTION_TRUNK_COLOR_OPTIONS) },
          ],
        };
      }
      if (kind === 'rock') {
        return {
          kinds: new Set(['rock']),
          rows: [
            { key: 'topColor', label: 'Highlight', options: selectionColorOptions(SELECTION_BODY_COLOR_OPTIONS) },
            { key: 'bodyColor', label: 'Stone', options: selectionColorOptions(SELECTION_BODY_COLOR_OPTIONS) },
          ],
        };
      }
      if (kind === 'bridge' || kind === 'fence') {
        return {
          kinds: new Set([kind]),
          rows: [
            { key: 'bodyColor', label: kind === 'bridge' ? 'Wood' : 'Main', options: selectionColorOptions(SELECTION_TRUNK_COLOR_OPTIONS) },
            { key: 'topColor', label: 'Accent', options: selectionColorOptions(SELECTION_TOP_COLOR_OPTIONS) },
          ],
        };
      }
      if (SELECTION_CROP_COLOR_KINDS.has(kind)) {
        return {
          kinds: SELECTION_CROP_COLOR_KINDS,
          rows: [
            { key: 'topColor', label: kind === 'bush' ? 'Berries' : kind === 'flower' ? 'Bloom' : 'Harvest', options: selectionColorOptions(SELECTION_TOP_COLOR_OPTIONS) },
            { key: 'bodyColor', label: 'Stems', options: selectionColorOptions(SELECTION_LEAF_COLOR_OPTIONS) },
          ],
        };
      }
      if (kind === 'cow' || kind === 'sheep' || kind === 'pig') {
        const bodyLabel = kind === 'sheep' ? 'Wool' : kind === 'pig' ? 'Skin' : 'Coat';
        const topLabel = kind === 'sheep' ? 'Face' : kind === 'pig' ? 'Markings' : 'Markings';
        return {
          kinds: new Set([kind]),
          rows: [
            { key: 'bodyColor', label: bodyLabel, options: selectionColorOptions(SELECTION_BODY_COLOR_OPTIONS) },
            { key: 'topColor', label: topLabel, options: selectionColorOptions(SELECTION_TOP_COLOR_OPTIONS) },
          ],
        };
      }
      return null;
    }

    function populatePreviewActions(target) {
      const container = document.getElementById('selection-preview-actions');
      if (!container) return;
      container.innerHTML = '';
      if (!target || !target.cell) return;
      const kind = target.cell.kind;
      const colorConfig = selectionColorConfig(kind);
      const currentAppearance = normalizeAppearance(target.cell.appearance) || {};
      if (colorConfig) {
        colorConfig.rows.forEach(row => {
          const rowWrap = document.createElement('div');
          rowWrap.style.display = 'contents';
          row.options.forEach(c => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'selection-prop-chip color-chip';
            chip.title = row.label + ': ' + c.label;
            const activeColorValue = currentAppearance[row.key] || 'default';
            if (activeColorValue === c.value) {
              chip.classList.add('active');
              chip.setAttribute('aria-pressed', 'true');
            } else {
              chip.setAttribute('aria-pressed', 'false');
            }
            if (c.color) {
              const swatch = document.createElement('span');
              swatch.className = 'selection-prop-swatch';
              swatch.style.background = c.color;
              chip.appendChild(swatch);
            }
            chip.appendChild(document.createTextNode(c.label));
            chip.addEventListener('click', () => {
              applySelectionProperty(row.key, c.value);
              setTimeout(() => {
                const t = selectedBoardObjectTarget();
                if (t) updateSelectionPreview(t);
              }, 10);
            });
            rowWrap.appendChild(chip);
          });
          container.appendChild(rowWrap);
        });

        // Voxel / Normal style toggle
        if (kind === 'house') {
          const styleChip = document.createElement('button');
          styleChip.type = 'button';
          styleChip.className = 'selection-prop-chip';
          const isCurrentlyVoxel = target.cell.appearance?.objectStyle === 'voxel' ||
            (renderVoxelTerrain && target.cell.appearance?.objectStyle !== 'normal');
          styleChip.textContent = isCurrentlyVoxel ? 'Normal' : 'Voxel';
          styleChip.onclick = () => {
            const next = isCurrentlyVoxel ? 'normal' : 'voxel';
            applySelectionProperty('objectStyle', next);
            setTimeout(() => {
              const t = selectedBoardObjectTarget();
              if (t) updateSelectionPreview(t);
            }, 10);
          };
          container.appendChild(styleChip);
        }
      }
    }

    function setSelectionTab(targetTab) {
      if (!previewBox) return;
      previewBox.querySelectorAll('.selection-tab').forEach(t => {
        const active = t.getAttribute('data-tab') === targetTab;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      previewBox.querySelectorAll('.selection-tab-content').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-content') === targetTab);
      });
      if (targetTab === 'preview') {
        resizePreviewRenderer();
        if (previewRenderer && previewScene && previewCamera) {
          previewRenderer.render(previewScene, previewCamera);
        }
      }
    }

    // Tab switching for selection preview (Preview vs Properties)
    if (previewBox) {
      previewBox.addEventListener('click', (e) => {
        const tab = e.target.closest('.selection-tab');
        if (!tab) return;
        setSelectionTab(tab.getAttribute('data-tab'));
      });
    }

    function selectedEngineUiTarget() {
      return typeof selectedEditableIslandEngineTarget === 'function' ? selectedEditableIslandEngineTarget() : null;
    }

    function selectedPyramidUiTarget() {
      return typeof selectedEditableIslandPyramidTarget === 'function' ? selectedEditableIslandPyramidTarget() : null;
    }

    function applyEditableIslandEngineProperty(rowKey, value) {
      const target = selectedEngineUiTarget();
      if (!target) return false;
      if (typeof pushWorldHistorySnapshot === 'function') pushWorldHistorySnapshot();
      if (rowKey === 'islandEngineType') {
        updateEditableIslandEngine(target, { type: value, installed: true });
      } else if (rowKey === 'islandEngineLevel') {
        const current = Math.max(1, Math.min(3, Number(target.engine.level) || 1));
        const next = value === 'down' ? current - 1 : value === 'up' ? current + 1 : Number(value);
        updateEditableIslandEngine(target, { level: Math.max(1, Math.min(3, Math.round(next || current))), installed: true });
      } else if (rowKey === 'islandEngineSize') {
        const current = Math.max(0.4, Math.min(3, Number(target.engine.sizeScale) || 1));
        const step = 0.15;
        const next = value === 'down' ? current - step : value === 'up' ? current + step : Number(value);
        updateEditableIslandEngine(target, { sizeScale: Math.max(0.4, Math.min(3, Number.isFinite(next) ? next : current)) });
      } else if (rowKey === 'islandEngineAction') {
        updateEditableIslandEngine(target, { installed: value !== 'remove' });
      } else if (rowKey === 'islandEngineAdd') {
        const made = (typeof addEditableIslandEngine === 'function') ? addEditableIslandEngine(target.island) : null;
        if (made && typeof selectEditableIslandEngine === 'function') selectEditableIslandEngine(made);
      } else if (rowKey === 'islandEngineMount') {
        updateEditableIslandEngine(target, { mount: value, installed: true });
      } else if (rowKey === 'islandEngineFlip') {
        updateEditableIslandEngine(target, { flipped: value === 'flip', installed: true });
      } else if (rowKey === 'islandEngineMoveX' || rowKey === 'islandEngineMoveZ') {
        const axis = rowKey === 'islandEngineMoveX' ? 'posX' : 'posZ';
        const base = (typeof editableIslandEnginePlacement === 'function')
          ? editableIslandEnginePlacement(target.engine.slot || 0, { mount: 'under' }) : { x: 0, z: 0 };
        const cur = Number.isFinite(target.engine[axis]) ? target.engine[axis] : (axis === 'posX' ? base.x : base.z);
        const next = value === 'down' ? cur - 0.6 : value === 'up' ? cur + 0.6 : Number(value);
        updateEditableIslandEngine(target, { [axis]: Number.isFinite(next) ? next : cur, installed: true });
      } else {
        return false;
      }
      renderSelection();
      return true;
    }

    function renderEditableIslandEngineProperties(target) {
      if (!previewProps || !target || !target.engine) return;
      previewProps.innerHTML = '';
      const engine = target.engine;
      const rows = [
        { key: 'islandEngineType', label: 'Engine', currentValue: normalizeEditableIslandEngineType(engine.type), options: [
          { label: 'Lift', value: 'lift' },
          { label: 'Turbo', value: 'turbo' },
          { label: 'Heavy', value: 'heavy' },
        ] },
        { key: 'islandEngineLevel', label: 'Upgrade', currentValue: String(engine.level || 1), options: [
          { label: '1', value: '1' },
          { label: '2', value: '2' },
          { label: '3', value: '3' },
        ] },
        { key: 'islandEngineLevel', label: 'Tune', control: 'stepper', options: [
          { label: 'Down', value: 'down', disabled: (engine.level || 1) <= 1 },
          { label: 'Up', value: 'up', disabled: (engine.level || 1) >= 3 },
        ] },
        { key: 'islandEngineSize', label: 'Size', control: 'stepper', options: [
          { label: 'Down', value: 'down', disabled: (Number(engine.sizeScale) || 1) <= 0.4 + 1e-6 },
          { label: 'Up', value: 'up', disabled: (Number(engine.sizeScale) || 1) >= 3 - 1e-6 },
        ] },
        { key: 'islandEngineMount', label: 'Facing', currentValue: (engine.mount === 'side' ? 'side' : 'under'), options: [
          { label: 'Under', value: 'under' },
          { label: 'Side', value: 'side' },
        ] },
        { key: 'islandEngineFlip', label: 'Thrust', currentValue: (engine.flipped ? 'flip' : 'out'), options: [
          { label: 'Out', value: 'out', disabled: engine.mount !== 'side' },
          { label: 'Flip', value: 'flip', disabled: engine.mount !== 'side' },
        ] },
        { key: 'islandEngineMoveX', label: 'Move X', control: 'stepper', options: [
          { label: 'Down', value: 'down' }, { label: 'Up', value: 'up' },
        ] },
        { key: 'islandEngineMoveZ', label: 'Move Z', control: 'stepper', options: [
          { label: 'Down', value: 'down' }, { label: 'Up', value: 'up' },
        ] },
        { key: 'islandEngineAction', label: 'Mount', options: [
          { label: 'Restore', value: 'restore', disabled: engine.installed !== false },
          { label: 'Remove', value: 'remove', disabled: engine.installed === false },
        ] },
        { key: 'islandEngineAdd', label: 'Engines ' + ((target.island.engines || []).length) + '/' + ((typeof EDITABLE_ISLAND_ENGINE_MAX !== 'undefined') ? EDITABLE_ISLAND_ENGINE_MAX : 8), options: [
          { label: 'Add', value: 'add', disabled: (target.island.engines || []).length >= ((typeof EDITABLE_ISLAND_ENGINE_MAX !== 'undefined') ? EDITABLE_ISLAND_ENGINE_MAX : 8) },
        ] },
      ];
      const section = document.createElement('section');
      section.className = 'selection-prop-section';
      section.setAttribute('aria-label', 'Engine properties');
      const title = document.createElement('button');
      title.type = 'button';
      title.className = 'selection-prop-section-title';
      title.setAttribute('aria-expanded', 'true');
      title.innerHTML = '<span>Engine</span><span class="selection-prop-section-meta">' + rows.length + ' rows</span>';
      section.appendChild(title);
      rows.forEach(row => {
        const wrap = document.createElement('div');
        wrap.className = 'selection-prop-row';
        const label = document.createElement('div');
        label.className = 'selection-prop-label';
        label.textContent = row.label;
        const options = document.createElement('div');
        options.className = 'selection-prop-options';
        if (row.control === 'stepper') options.classList.add('control-stepper');
        row.options.forEach(opt => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'selection-prop-chip' + (row.control === 'stepper' ? ' icon-chip round-chip' : '');
          chip.dataset.action = String(opt.value);
          const isActive = row.currentValue !== undefined && String(row.currentValue) === String(opt.value);
          if (row.currentValue !== undefined) chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
          if (isActive) chip.classList.add('active');
          if (opt.disabled) chip.disabled = true;
          chip.title = row.label + ': ' + opt.label;
          chip.setAttribute('aria-label', chip.title);
          chip.textContent = row.control === 'stepper' ? (opt.value === 'down' ? '-' : '+') : opt.label;
          chip.addEventListener('click', e => {
            e.stopPropagation();
            if (!opt.disabled) applySelectionProperty(row.key, opt.value);
          });
          options.appendChild(chip);
        });
        wrap.append(label, options);
        section.appendChild(wrap);
      });
      previewProps.appendChild(section);
      previewProps.hidden = false;
      notifySelectionPropertiesRendered();
    }

    function applyEditableIslandPyramidProperty(rowKey, value) {
      const target = selectedPyramidUiTarget();
      if (!target || !target.pyramid) return false;
      const p = target.pyramid;
      const stepScale = (axisKey) => {
        const cur = Math.max(0.2, Math.min(3, Number(p[axisKey]) || 1));
        const next = value === 'down' ? cur - 0.15 : value === 'up' ? cur + 0.15 : Number(value);
        return Math.max(0.2, Math.min(3, Number.isFinite(next) ? next : cur));
      };
      const stepOffset = (axisKey) => {
        const cur = Number(p[axisKey]) || 0;
        const next = value === 'down' ? cur - 0.4 : value === 'up' ? cur + 0.4 : Number(value);
        return Number.isFinite(next) ? next : cur;
      };
      if (rowKey === 'islandPyramidAction') {
        if (value === 'remove') {
          if (typeof pushWorldHistorySnapshot === 'function') pushWorldHistorySnapshot();
          removeEditableIslandPyramid(target);
        } else if (value === 'duplicate') {
          if (typeof pushWorldHistorySnapshot === 'function') pushWorldHistorySnapshot();
          const made = (typeof duplicateEditableIslandPyramid === 'function') ? duplicateEditableIslandPyramid(target) : null;
          if (made && typeof selectEditableIslandPyramid === 'function') selectEditableIslandPyramid(made);
        } else return false;
        renderSelection();
        return true;
      }
      if (typeof pushWorldHistorySnapshot === 'function') pushWorldHistorySnapshot();
      if (rowKey === 'islandPyramidScaleAll') {
        const cur = Math.max(0.2, Math.min(3, Number(p.scaleX) || 1));
        const next = Math.max(0.2, Math.min(3, value === 'down' ? cur - 0.15 : cur + 0.15));
        updateEditableIslandPyramid(target, { scaleX: next, scaleY: next, scaleZ: next });
      } else if (rowKey === 'islandPyramidScaleX') updateEditableIslandPyramid(target, { scaleX: stepScale('scaleX') });
      else if (rowKey === 'islandPyramidScaleY') updateEditableIslandPyramid(target, { scaleY: stepScale('scaleY') });
      else if (rowKey === 'islandPyramidScaleZ') updateEditableIslandPyramid(target, { scaleZ: stepScale('scaleZ') });
      else if (rowKey === 'islandPyramidOffsetX') updateEditableIslandPyramid(target, { offsetX: stepOffset('offsetX') });
      else if (rowKey === 'islandPyramidOffsetZ') updateEditableIslandPyramid(target, { offsetZ: stepOffset('offsetZ') });
      else if (rowKey === 'islandPyramidRows') {
        const eff = (typeof editableIslandPyramidEffectiveRows === 'function') ? editableIslandPyramidEffectiveRows(p) : (p.rows || 7);
        const next = value === 'down' ? eff - 1 : value === 'up' ? eff + 1 : Number(value);
        updateEditableIslandPyramid(target, { rows: Math.max(2, Math.min(20, Number.isFinite(next) ? next : eff)) });
      }
      else return false;
      renderSelection();
      return true;
    }

    function renderEditableIslandPyramidProperties(target) {
      if (!previewProps || !target || !target.pyramid) return;
      previewProps.innerHTML = '';
      const p = target.pyramid;
      const island = target.island;
      const fmt = (v) => (Math.round((Number(v) || 1) * 100) / 100).toFixed(2);
      const sMin = (v) => (Number(v) || 1) <= 0.2 + 1e-6;
      const sMax = (v) => (Number(v) || 1) >= 3 - 1e-6;
      const rows = [
        { key: 'islandPyramidScaleAll', label: 'Size', control: 'stepper', options: [
          { label: 'Down', value: 'down', disabled: sMin(p.scaleX) && sMin(p.scaleY) && sMin(p.scaleZ) },
          { label: 'Up', value: 'up', disabled: sMax(p.scaleX) && sMax(p.scaleY) && sMax(p.scaleZ) },
        ] },
        { key: 'islandPyramidRows', label: 'Rows ' + ((typeof editableIslandPyramidEffectiveRows === 'function') ? editableIslandPyramidEffectiveRows(p) : (p.rows || 7)), control: 'stepper', options: [
          { label: 'Down', value: 'down', disabled: ((typeof editableIslandPyramidEffectiveRows === 'function') ? editableIslandPyramidEffectiveRows(p) : (p.rows || 7)) <= 2 },
          { label: 'Up', value: 'up', disabled: ((typeof editableIslandPyramidEffectiveRows === 'function') ? editableIslandPyramidEffectiveRows(p) : (p.rows || 7)) >= 20 },
        ] },
        { key: 'islandPyramidScaleX', label: 'Width ' + fmt(p.scaleX), control: 'stepper', options: [
          { label: 'Down', value: 'down', disabled: sMin(p.scaleX) }, { label: 'Up', value: 'up', disabled: sMax(p.scaleX) },
        ] },
        { key: 'islandPyramidScaleY', label: 'Height ' + fmt(p.scaleY), control: 'stepper', options: [
          { label: 'Down', value: 'down', disabled: sMin(p.scaleY) }, { label: 'Up', value: 'up', disabled: sMax(p.scaleY) },
        ] },
        { key: 'islandPyramidScaleZ', label: 'Depth ' + fmt(p.scaleZ), control: 'stepper', options: [
          { label: 'Down', value: 'down', disabled: sMin(p.scaleZ) }, { label: 'Up', value: 'up', disabled: sMax(p.scaleZ) },
        ] },
        { key: 'islandPyramidOffsetX', label: 'Move X', control: 'stepper', options: [
          { label: 'Down', value: 'down' }, { label: 'Up', value: 'up' },
        ] },
        { key: 'islandPyramidOffsetZ', label: 'Move Z', control: 'stepper', options: [
          { label: 'Down', value: 'down' }, { label: 'Up', value: 'up' },
        ] },
        { key: 'islandPyramidAction', label: 'Pyramid', options: [
          { label: 'Duplicate', value: 'duplicate' },
          { label: 'Remove', value: 'remove' },
        ] },
      ];
      const section = document.createElement('section');
      section.className = 'selection-prop-section';
      section.setAttribute('aria-label', 'Pyramid properties');
      const title = document.createElement('button');
      title.type = 'button';
      title.className = 'selection-prop-section-title';
      title.setAttribute('aria-expanded', 'true');
      title.innerHTML = '<span>Pyramid</span><span class="selection-prop-section-meta">' + rows.length + ' rows</span>';
      section.appendChild(title);
      rows.forEach(row => {
        const wrap = document.createElement('div');
        wrap.className = 'selection-prop-row';
        const label = document.createElement('div');
        label.className = 'selection-prop-label';
        label.textContent = row.label;
        const options = document.createElement('div');
        options.className = 'selection-prop-options';
        if (row.control === 'stepper') options.classList.add('control-stepper');
        row.options.forEach(opt => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'selection-prop-chip' + (row.control === 'stepper' ? ' icon-chip round-chip' : '');
          chip.dataset.action = String(opt.value);
          if (opt.disabled) chip.disabled = true;
          chip.title = row.label + ': ' + opt.label;
          chip.setAttribute('aria-label', chip.title);
          chip.textContent = row.control === 'stepper' ? (opt.value === 'down' ? '-' : '+') : opt.label;
          chip.addEventListener('click', e => {
            e.stopPropagation();
            if (!opt.disabled) applySelectionProperty(row.key, opt.value);
          });
          options.appendChild(chip);
        });
        wrap.append(label, options);
        section.appendChild(wrap);
      });
      previewProps.appendChild(section);
      previewProps.hidden = false;
      notifySelectionPropertiesRendered();
    }

    function applySelectionProperty(rowKey, value) {
      if (rowKey.indexOf('islandEngine') === 0 && applyEditableIslandEngineProperty(rowKey, value)) return;
      if (rowKey.indexOf('islandPyramid') === 0 && applyEditableIslandPyramidProperty(rowKey, value)) return;
      if (rowKey === 'historyAction') {
        if (value === 'undo') undoWorldEdit();
        else if (value === 'redo') redoWorldEdit();
        renderSelection();
        return;
      }
      if (rowKey === 'selectionAction') {
        let ok = true;
        if (value === 'copy') ok = copyActiveCellIntent();
        else if (value === 'cut') ok = cutActiveCellIntent();
        else if (value === 'delete') ok = deleteActiveCellIntent();
        else if (value === 'apply-tool') ok = applySelectedToolToSelection();
        else if (value === 'paste') ok = pasteClipboardAtActiveTarget();
        else if (value === 'duplicate') ok = duplicateActiveCellIntent();
        else if (value === 'save-template') ok = saveActiveSelectionTemplate();
        else if (value === 'paste-template') ok = pasteLatestTemplateAtActiveTarget();
        // Surface a no-op instead of swallowing it: a chip that returns false did
        // nothing, so tell the user why (feedback #5). Chips are also gated off in
        // the panel, but a keyboard/route can still reach a failing action.
        if (ok === false && typeof twToast === 'function') {
          const reason = value === 'apply-tool'
              ? ((typeof selectedTool !== 'undefined' && selectedTool && selectedTool.kind === 'asset-template') ? window.t('props.gate.emptyTemplate') : window.t('props.gate.needTool'))
            : value === 'paste' ? window.t('props.gate.nothingCopied')
            : value === 'paste-template' ? window.t('props.gate.noTemplate')
            : window.t('props.action.failed');
          twToast(reason, 'warn');
        }
        renderSelection();
        return;
      }
      if (rowKey === 'rotate') {
        const sel = window.__tinyworldSelection;
        if (sel && sel.rotate) sel.rotate(value === 'left' ? -Math.PI / 2 : Math.PI / 2);
        return;
      }
      if (rowKey === 'selectionMove') {
        if (value === 'west') shiftSelectedCellIntent(-1, 0);
        else if (value === 'east') shiftSelectedCellIntent(1, 0);
        else if (value === 'north') shiftSelectedCellIntent(0, -1);
        else if (value === 'south') shiftSelectedCellIntent(0, 1);
        renderSelection();
        return;
      }
      if (rowKey === 'objectScale') {
        scaleSelectedBoardObject(value === 'reset' ? 'reset' : value === 'down' ? 0.85 : 1.18);
        return;
      }
      if (rowKey === 'objectScaleX' || rowKey === 'objectScaleY' || rowKey === 'objectScaleZ') {
        const axis = rowKey === 'objectScaleX' ? 'x' : rowKey === 'objectScaleY' ? 'y' : 'z';
        scaleSelectedBoardObject(value === 'reset' ? 'reset' : value === 'down' ? 0.85 : 1.18, axis);
        return;
      }
      if (rowKey === 'objectMove') {
        const step = 0.08;
        if (value === 'x-') moveSelectedBoardObject(-step, 0, 0);
        else if (value === 'x+') moveSelectedBoardObject(step, 0, 0);
        else if (value === 'y-') moveSelectedBoardObject(0, -step, 0);
        else if (value === 'y+') moveSelectedBoardObject(0, step, 0);
        else if (value === 'z-') moveSelectedBoardObject(0, 0, -step);
        else if (value === 'z+') moveSelectedBoardObject(0, 0, step);
        else if (value === 'center') centerSelectedBoardObjectOffset();
        return;
      }
      if (rowKey === 'objectTransformReset') {
        resetSelectedBoardObjectTransform();
        return;
      }
      if (rowKey === 'posX') { setSelectedBoardObjectOffsetAxis('x', value); return; }
      if (rowKey === 'posY') { setSelectedBoardObjectOffsetAxis('y', value); return; }
      if (rowKey === 'posZ') { setSelectedBoardObjectOffsetAxis('z', value); return; }
      if (rowKey === 'rotDeg') { setSelectedBoardObjectRotation((Number(value) || 0) * Math.PI / 180); return; }
      if (rowKey === 'scaleAbs') { setSelectedBoardObjectScaleValue(value); return; }
      if (rowKey === 'baseColor' || rowKey === 'finish' || rowKey === 'emissiveColor' || rowKey === 'emissiveIntensity' || rowKey === 'opacity') {
        updateSelectedBoardObjects(target => {
          const appearance = Object.assign({}, normalizeAppearance(target.cell.appearance) || {});
          if (rowKey === 'baseColor') appearance.bodyColor = value;
          else if (rowKey === 'finish') { if (value === 'matte') delete appearance.finish; else appearance.finish = value; }
          else if (rowKey === 'emissiveColor') appearance.emissiveColor = value;
          else if (rowKey === 'emissiveIntensity') appearance.emissiveIntensity = Number(value) || 0;
          else if (rowKey === 'opacity') appearance.opacity = Number(value);
          return { appearance: Object.keys(appearance).length ? appearance : null };
        });
        return;
      }
      if (rowKey === 'windowGlassRatio' || rowKey === 'windowTint' || rowKey === 'windowDarkness' || rowKey === 'windowBrightness' || rowKey === 'windowReflect') {
        updateSelectedBoardObjects(target => {
          const appearance = Object.assign({}, normalizeAppearance(target.cell.appearance) || {});
          const w = Object.assign({}, appearance.window || {});
          if (rowKey === 'windowGlassRatio') w.glassRatio = Number(value);
          else if (rowKey === 'windowTint') w.tint = value;
          else if (rowKey === 'windowDarkness') w.darkness = Number(value);
          else if (rowKey === 'windowBrightness') w.brightness = Number(value);
          else if (rowKey === 'windowReflect') w.reflect = Number(value);
          appearance.window = w;
          return { appearance: Object.keys(appearance).length ? appearance : null };
        });
        return;
      }
      if (rowKey === 'subEdit') {
        const se = window.__tinyworldSubEdit;
        if (se) {
          if (se.isActive && se.isActive()) se.exit();
          else {
            const t = (typeof selectedBoardObjectTargets === 'function') ? (selectedBoardObjectTargets()[0] || null) : null;
            if (t) se.enter(t.x, t.z);
          }
        }
        renderSelection();
        return;
      }
      if (rowKey === 'subExplode') {
        const se = window.__tinyworldSubEdit;
        if (se && se.setExplode) se.setExplode(!(se.isExploded && se.isExploded()));
        renderSelection();
        return;
      }
      if (rowKey === 'partMove') {
        const s = 0.25; const se = window.__tinyworldSubEdit;
        if (se && se.movePart) {
          if (value === 'x-') se.movePart(-s, 0, 0);
          else if (value === 'x+') se.movePart(s, 0, 0);
          else if (value === 'y-') se.movePart(0, -s, 0);
          else if (value === 'y+') se.movePart(0, s, 0);
          else if (value === 'z-') se.movePart(0, 0, -s);
          else if (value === 'z+') se.movePart(0, 0, s);
        }
        return;
      }
      if (rowKey === 'partScale') {
        const se = window.__tinyworldSubEdit;
        if (se && se.scalePart) se.scalePart(value === 'down' ? 0.85 : 1.18);
        return;
      }
      if (rowKey === 'partRotate') {
        const se = window.__tinyworldSubEdit;
        const step = Math.PI / 18;
        if (se && se.rotatePart) {
          if (value === 'x-') se.rotatePart('x', -step);
          else if (value === 'x+') se.rotatePart('x', step);
          else if (value === 'y-') se.rotatePart('y', -step);
          else if (value === 'y+') se.rotatePart('y', step);
          else if (value === 'z-') se.rotatePart('z', -step);
          else if (value === 'z+') se.rotatePart('z', step);
        }
        return;
      }
      if (rowKey === 'voxelSculpt') {
        const se = window.__tinyworldSubEdit;
        let ok;
        if (se) { if (value === 'remove' && se.removeVoxel) ok = se.removeVoxel(); else if (value === 'smooth' && se.smoothVoxel) ok = se.smoothVoxel(); }
        // Same failure-feedback contract as the selectionAction dispatcher: a
        // voxel sculpt that no-ops (e.g. non-voxel part) surfaces a toast rather
        // than silently swallowing the false (feedback #5).
        if (ok === false && typeof twToast === 'function') twToast(window.t('props.action.failed'), 'warn');
        renderSelection();
        return;
      }
      if (rowKey === 'voxelAdd') {
        const se = window.__tinyworldSubEdit;
        let ok;
        if (se && se.addVoxel) {
          if (value === 'x-') ok = se.addVoxel(-1, 0, 0);
          else if (value === 'x+') ok = se.addVoxel(1, 0, 0);
          else if (value === 'y-') ok = se.addVoxel(0, -1, 0);
          else if (value === 'y+') ok = se.addVoxel(0, 1, 0);
          else if (value === 'z-') ok = se.addVoxel(0, 0, -1);
          else if (value === 'z+') ok = se.addVoxel(0, 0, 1);
        }
        if (ok === false && typeof twToast === 'function') twToast(window.t('props.action.failed'), 'warn');
        renderSelection();
        return;
      }
      if (rowKey === 'lightType' || rowKey === 'lightColor' || rowKey === 'lightIntensity' || rowKey === 'lightRange') {
        updateSelectedBoardObjects(target => {
          const appearance = Object.assign({}, normalizeAppearance(target.cell.appearance) || {});
          if (rowKey === 'lightType') {
            if (value === 'none') delete appearance.light;
            else appearance.light = Object.assign({ color: '#ffd9a0', intensity: 1, range: 6 }, appearance.light || {}, { type: value });
          } else if (appearance.light) {
            if (rowKey === 'lightColor') appearance.light = Object.assign({}, appearance.light, { color: value });
            else if (rowKey === 'lightIntensity') appearance.light = Object.assign({}, appearance.light, { intensity: Number(value) || 0 });
            else if (rowKey === 'lightRange') appearance.light = Object.assign({}, appearance.light, { range: Number(value) || 6 });
          }
          return { appearance: Object.keys(appearance).length ? appearance : null };
        });
        return;
      }
      if (rowKey === 'objectMaterial') {
        const nextTexture = normalizeMaterialTextureKey(value);
        updateSelectedBoardObjects(target => {
          const appearance = Object.assign({}, normalizeAppearance(target.cell.appearance) || {});
          if (nextTexture === 'default') {
            delete appearance.materialTexture;
            delete appearance.materialTextureScale;
          } else {
            appearance.materialTexture = nextTexture;
          }
          return { appearance };
        });
        return;
      }
      if (rowKey === 'bodyMaterial' || rowKey === 'topMaterial') {
        const textureKey = rowKey === 'bodyMaterial' ? 'bodyTexture' : 'topTexture';
        const scaleKey = rowKey === 'bodyMaterial' ? 'bodyTextureScale' : 'topTextureScale';
        const nextTexture = normalizeMaterialTextureKey(value);
        updateSelectedBoardObjects(target => {
          if (!isSelectionPartMaterialEditableCell(target.cell)) return null;
          const appearance = Object.assign({}, normalizeAppearance(target.cell.appearance) || {});
          if (nextTexture === 'default') {
            delete appearance[textureKey];
            delete appearance[scaleKey];
          } else {
            appearance[textureKey] = nextTexture;
          }
          return { appearance };
        });
        return;
      }
      if (rowKey === 'objectMaterialScale' || rowKey === 'bodyMaterialScale' || rowKey === 'topMaterialScale') {
        const key = rowKey === 'bodyMaterialScale' ? 'bodyTextureScale'
          : rowKey === 'topMaterialScale' ? 'topTextureScale'
            : 'materialTextureScale';
        updateSelectedBoardObjects(target => {
          if (rowKey !== 'objectMaterialScale' && !isSelectionPartMaterialEditableCell(target.cell)) return null;
          const appearance = Object.assign({}, normalizeAppearance(target.cell.appearance) || {});
          if (value === 'reset') {
            delete appearance[key];
          } else {
            const current = appearance[key] || 1;
            appearance[key] = Math.max(0.5, Math.min(4, current * (value === 'down' ? 0.8 : 1.25)));
            if (Math.abs(appearance[key] - 1) < 0.001) delete appearance[key];
          }
          return { appearance: Object.keys(appearance).length ? appearance : null };
        });
        return;
      }
      if (rowKey === 'objectStyle') {
        updateSelectedBoardObjects(target => {
          if (!target.cell || target.cell.kind === 'voxel-build') return null;
          const appearance = Object.assign({}, normalizeAppearance(target.cell.appearance) || {});
          appearance.objectStyle = value === 'normal' ? 'normal' : 'voxel';
          return { appearance };
        });
        return;
      }
      if (rowKey === 'objectEnhance') {
        input.value = 'enhance the selected object with more voxel detail';
        input.focus();
        renderSuggestions();
        return;
      }
      const selForMaterialize = window.__tinyworldSelection;
      if (selForMaterialize && selForMaterialize.materialize) selForMaterialize.materialize();
      const coords = selectedWorldCoords();
      if (!coords.length) return;
      coords.forEach(({ x, z }) => {
        const cell = getWorldCell(x, z);
        if (!cell) return;
        if (rowKey === 'bodyColor' || rowKey === 'topColor') {
          if (!SELECTION_COLOR_EDITABLE_KINDS.has(cell.kind)) return;
          const appearance = Object.assign({}, normalizeAppearance(cell.appearance) || {});
          if (value === 'default') delete appearance[rowKey];
          else appearance[rowKey] = value;
          setCell(x, z, { ...cell, appearance: Object.keys(appearance).length ? appearance : null, animate: false, impactDust: false });
        } else if (rowKey === 'buildingType') {
          if (cell.kind !== 'house') return;
          const floors = value === 'tower' ? Math.max(cell.floors || 1, 2)
            : value === 'skyscraper' ? Math.max(cell.floors || 1, 4)
            : (cell.floors || 1);
          setCell(x, z, { ...cell, buildingType: value, floors, animate: false, impactDust: false });
        } else if (rowKey === 'size') {
          const extraFloors = value === 'small' ? 1 : value === 'large' ? 4 : 2;
          const nextExtras = Array.isArray(cell.extras)
            ? cell.extras.map(extra => Object.assign({}, extra, { floors: extraFloors }))
            : cell.extras;
          if (cell.kind) {
            const floors = value === 'small' ? 1 : value === 'large' ? 4 : 2;
            setCell(x, z, { ...cell, floors, extras: nextExtras, animate: false, impactDust: false });
          } else {
            const terrainFloors = value === 'small' ? 1 : value === 'large' ? 4 : 2;
            setCell(x, z, { ...cell, terrainFloors, extras: nextExtras, animate: false, impactDust: false });
          }
        } else if (rowKey === 'terrain') {
          setCell(x, z, { ...cell, terrain: value, animate: false, impactDust: false });
        } else if (rowKey === 'waterFlow') {
          if (cell.terrain !== 'water') return;
          setCell(x, z, { ...cell, waterFlow: normalizeWaterFlow(value), animate: false, impactDust: false });
        } else if (rowKey === 'terrainHeight') {
          const next = value === 'down'
            ? Math.max(1, terrainLevelForCell(cell) - 1)
            : Math.min(MAX_FLOORS, terrainLevelForCell(cell) + 1);
          setCell(x, z, { ...cell, terrainFloors: next, animate: false, impactDust: false });
        }
      });
      notifySelectionChanged();
    }

    function renderSelectionProperties(summary, entries) {
      if (!previewProps) return;
      previewProps.innerHTML = '';
      if (!entries.length) {
        previewProps.hidden = true;
        notifySelectionPropertiesRendered();
        return;
      }
      const primary = entries[0][0];
      const sectionOrder = ['Edit', 'Transform', 'Appearance', 'Ground'];
      const rowsBySection = {};
      sectionOrder.forEach(section => { rowsBySection[section] = []; });
      const addRow = (section, row) => {
        if (!rowsBySection[section]) rowsBySection[section] = [];
        rowsBySection[section].push(row);
      };
      const addRows = (section, sectionRows) => {
        sectionRows.forEach(row => addRow(section, row));
      };
      const selectionCoords = selectedWorldCoords();
      const selectedCells = selectionCoords.map(({ x, z }) => getWorldCell(x, z)).filter(Boolean);
      const selectedTargets = selectedBoardObjectTargets();
      const objectCells = selectedTargets.map(target => target.cell).filter(Boolean);
      const scalableObjectCells = objectCells.filter(isObjectScaleEditableCell);
      const partMaterialCells = objectCells.filter(isSelectionPartMaterialEditableCell);
      const uniformValue = (items, getter) => {
        let hasValue = false;
        let firstValue = null;
        for (const item of items) {
          const value = getter(item);
          if (value === undefined || value === null) return null;
          if (!hasValue) {
            hasValue = true;
            firstValue = value;
          } else if (value !== firstValue) {
            return null;
          }
        }
        return hasValue ? firstValue : null;
      };
      const uniformAppearanceValue = (items, key) => {
        let hasValue = false;
        let firstValue = null;
        for (const item of items) {
          const appearance = normalizeAppearance(item && item.appearance) || {};
          const value = appearance[key] || 'default';
          if (!hasValue) {
            hasValue = true;
            firstValue = value;
          } else if (value !== firstValue) {
            return null;
          }
        }
        return hasValue ? firstValue : null;
      };
      const scaleResetValue = (items, key) => {
        if (!items.length) return null;
        return items.every(item => {
          const appearance = normalizeAppearance(item && item.appearance) || {};
          return !appearance[key] || Math.abs(appearance[key] - 1) < 0.001;
        }) ? 'reset' : null;
      };
      const sizeValueForCell = cell => {
        const level = cell && cell.kind ? (cell.floors || 1) : terrainLevelForCell(cell);
        return level <= 1 ? 'small' : level >= 4 ? 'large' : 'medium';
      };
      const currentTerrain = uniformValue(selectedCells, cell => cell.terrain || 'grass');
      const currentSize = uniformValue(selectedCells, sizeValueForCell);
      const currentObjectMaterial = uniformValue(objectCells, cell => {
        const appearance = normalizeAppearance(cell.appearance) || {};
        return normalizeMaterialTextureKey(appearance.materialTexture || 'default');
      });
      const currentBodyMaterial = uniformValue(partMaterialCells, cell => {
        const appearance = normalizeAppearance(cell.appearance) || {};
        return normalizeMaterialTextureKey(appearance.bodyTexture || 'default');
      });
      const currentTopMaterial = uniformValue(partMaterialCells, cell => {
        const appearance = normalizeAppearance(cell.appearance) || {};
        return normalizeMaterialTextureKey(appearance.topTexture || 'default');
      });
      addRow('Edit', { key: 'historyAction', label: 'History', control: 'history', options: [
        { label: 'Undo', value: 'undo', disabled: !worldUndoStack.length },
        { label: 'Redo', value: 'redo', disabled: !worldRedoStack.length },
      ] });
      // Context-gate the actions that silently no-op when their precondition is
      // not met (feedback #5): disable the chip + show the precondition as its
      // tooltip rather than leaving a dead button that does nothing on click.
      const applyToolDisabled = typeof canApplySelectedToolToSelection === 'function' && !canApplySelectedToolToSelection();
      const pasteDisabled = typeof clipboardHasContent === 'function' && !clipboardHasContent();
      const pasteTemplateDisabled = typeof latestTemplateAvailable === 'function' && !latestTemplateAvailable();
      // An asset-template tool with no/invalid template is disabled for a
      // different reason than "no placeable tool selected" — show the matching
      // precondition. (read-only check of the active tool kind)
      const applyToolReason = (typeof selectedTool !== 'undefined' && selectedTool && selectedTool.kind === 'asset-template')
        ? window.t('props.gate.emptyTemplate')
        : window.t('props.gate.needTool');
      addRows('Edit', [
        { key: 'selectionAction', label: 'Tool', control: 'actions', options: [
          { label: 'Apply tool', value: 'apply-tool', disabled: applyToolDisabled, disabledReason: applyToolReason },
          { label: 'Delete', value: 'delete' },
        ] },
        { key: 'selectionAction', label: 'Clipboard', control: 'actions', options: [
          { label: 'Copy', value: 'copy' },
          { label: 'Cut', value: 'cut' },
          { label: 'Paste', value: 'paste', disabled: pasteDisabled, disabledReason: window.t('props.gate.nothingCopied') },
          { label: 'Duplicate', value: 'duplicate' },
        ] },
        { key: 'selectionAction', label: 'Templates', control: 'actions', options: [
          { label: 'Save template', value: 'save-template' },
          { label: 'Paste latest', value: 'paste-template', disabled: pasteTemplateDisabled, disabledReason: window.t('props.gate.noTemplate') },
        ] },
      ]);
      addRow('Transform', { key: 'rotate', label: 'Rotate', control: 'rotate', options: [
        { label: 'Left', value: 'left' },
        { label: 'Right', value: 'right' },
      ] });
      addRow('Transform', { key: 'selectionMove', label: 'Shift', control: 'axis', options: [
        { label: 'West', value: 'west' },
        { label: 'East', value: 'east' },
        { label: 'North', value: 'north' },
        { label: 'South', value: 'south' },
      ] });
      if (selectedTargets.length) {
        const transformRows = [];
        if (scalableObjectCells.length === objectCells.length) {
          transformRows.push(
            { key: 'objectScale', label: 'Scale', control: 'stepper', currentValue: scaleResetValue(objectCells, 'objectScale'), options: [
              { label: 'Down', value: 'down' },
              { label: 'Reset', value: 'reset' },
              { label: 'Up', value: 'up' },
            ] },
            { key: 'objectScaleX', label: 'Scale X', control: 'stepper', currentValue: scaleResetValue(objectCells, 'scaleX'), options: [
              { label: 'Down', value: 'down' },
              { label: 'Reset', value: 'reset' },
              { label: 'Up', value: 'up' },
            ] },
            { key: 'objectScaleY', label: 'Scale Y', control: 'stepper', currentValue: scaleResetValue(objectCells, 'scaleY'), options: [
              { label: 'Down', value: 'down' },
              { label: 'Reset', value: 'reset' },
              { label: 'Up', value: 'up' },
            ] },
            { key: 'objectScaleZ', label: 'Scale Z', control: 'stepper', currentValue: scaleResetValue(objectCells, 'scaleZ'), options: [
              { label: 'Down', value: 'down' },
              { label: 'Reset', value: 'reset' },
              { label: 'Up', value: 'up' },
            ] },
          );
        }
        transformRows.push(
          { key: 'objectMove', label: 'Nudge', control: 'move', options: [
            { label: 'X-', value: 'x-' },
            { label: 'X+', value: 'x+' },
            { label: 'Y-', value: 'y-' },
            { label: 'Y+', value: 'y+' },
            { label: 'Z-', value: 'z-' },
            { label: 'Z+', value: 'z+' },
            { label: 'Center', value: 'center' },
          ] },
          { key: 'objectTransformReset', label: 'Reset', control: 'reset', options: [
            { label: 'Transform', value: 'transform' },
          ] },
        );
        addRows('Transform', transformRows);
        const appearanceRows = [
          { key: 'objectMaterial', label: 'All material', material: true, currentValue: currentObjectMaterial, options: SELECTION_MATERIAL_OPTIONS },
          { key: 'objectMaterialScale', label: 'All mat scale', control: 'stepper', currentValue: scaleResetValue(objectCells, 'materialTextureScale'), options: [
            { label: 'Smaller', value: 'down' },
            { label: 'Larger', value: 'up' },
            { label: 'Reset', value: 'reset' },
          ] },
        ];
        if (partMaterialCells.length) {
          appearanceRows.push(
            { key: 'bodyMaterial', label: 'Body material', material: true, currentValue: currentBodyMaterial, options: SELECTION_MATERIAL_OPTIONS },
            { key: 'bodyMaterialScale', label: 'Body mat scale', control: 'stepper', currentValue: scaleResetValue(partMaterialCells, 'bodyTextureScale'), options: [
              { label: 'Smaller', value: 'down' },
              { label: 'Larger', value: 'up' },
              { label: 'Reset', value: 'reset' },
            ] },
            { key: 'topMaterial', label: 'Top material', material: true, currentValue: currentTopMaterial, options: SELECTION_MATERIAL_OPTIONS },
            { key: 'topMaterialScale', label: 'Top mat scale', control: 'stepper', currentValue: scaleResetValue(partMaterialCells, 'topTextureScale'), options: [
              { label: 'Smaller', value: 'down' },
              { label: 'Larger', value: 'up' },
              { label: 'Reset', value: 'reset' },
            ] },
          );
        }
        addRows('Appearance', appearanceRows);
        if (selectedTargets.some(t => t.cell && t.cell.kind !== 'voxel-build')) {
          const currentObjectStyle = uniformValue(objectCells.filter(cell => cell.kind !== 'voxel-build'), cell => {
            const appearance = normalizeAppearance(cell.appearance) || {};
            return appearance.objectStyle === 'voxel' ? 'voxel' : 'normal';
          });
          addRow('Appearance', { key: 'objectStyle', label: 'Style', currentValue: currentObjectStyle, options: [
            { label: 'Normal', value: 'normal' },
            { label: 'Voxel', value: 'voxel' },
          ] });
        }
        {
          const ap = cell => normalizeAppearance(cell.appearance) || {};
          // Sub-object part editing works on home-board objects that expose keyed
          // parts through the voxel renderer. Island objects render outside the
          // home cellMeshes path, and model stamps stay separate from voxel parts.
          const subT = selectedTargets[0] || null;
          const onHome = !!(subT && (typeof isOutsideHomeGrid !== 'function' || !isOutsideHomeGrid(subT.x, subT.z)));
          const subSupported = onHome && !!(subT && typeof isVoxelSubEditableKind === 'function'
            && isVoxelSubEditableKind(subT.cell.kind, subT.cell));
          if (objectCells.length === 1 && subSupported) {
            const editing = !!(window.__tinyworldSubEdit && window.__tinyworldSubEdit.isActive && window.__tinyworldSubEdit.isActive());
            addRow('Edit', { key: 'subEdit', label: 'Parts', control: 'actions', options: [
              { label: editing ? 'Exit part edit' : 'Edit parts', value: 'toggle' },
            ] });
            const se = window.__tinyworldSubEdit;
            if (editing && se && se.setExplode) {
              const exploded = se.isExploded && se.isExploded();
              addRow('Edit', { key: 'subExplode', label: 'Explode', control: 'actions', options: [
                { label: exploded ? 'Collapse' : 'Explode', value: 'toggle' },
              ] });
            }
            if (editing && se && se.selectedInfo && se.selectedInfo()) {
              addRow('Transform', { key: 'partMove', label: 'Part move', control: 'move', options: [
                { label: 'X-', value: 'x-' }, { label: 'X+', value: 'x+' },
                { label: 'Y-', value: 'y-' }, { label: 'Y+', value: 'y+' },
                { label: 'Z-', value: 'z-' }, { label: 'Z+', value: 'z+' },
              ] });
              addRow('Transform', { key: 'partScale', label: 'Part size', control: 'stepper', options: [
                { label: 'Down', value: 'down' }, { label: 'Up', value: 'up' },
              ] });
              addRow('Transform', { key: 'partRotate', label: 'Part angle', control: 'move', options: [
                { label: 'Pitch-', value: 'x-' }, { label: 'Pitch+', value: 'x+' },
                { label: 'Yaw-', value: 'y-' }, { label: 'Yaw+', value: 'y+' },
                { label: 'Roll-', value: 'z-' }, { label: 'Roll+', value: 'z+' },
              ] });
              // Voxel sculpt/add only apply to voxel parts (key `v:x,y,z`); on a
              // named part they silently no-op, so disable them with a tooltip
              // when the selected part is not a voxel (feedback #5).
              const voxelReady = !!(se.isVoxelPartSelected && se.isVoxelPartSelected());
              const voxelReason = window.t('props.gate.voxelOnly');
              addRow('Edit', { key: 'voxelSculpt', label: 'Voxel', control: 'actions', options: [
                { label: 'Remove', value: 'remove', disabled: !voxelReady, disabledReason: voxelReason },
                { label: 'Smooth', value: 'smooth', disabled: !voxelReady, disabledReason: voxelReason },
              ] });
              addRow('Edit', { key: 'voxelAdd', label: 'Add voxel', control: 'move', options: [
                { label: 'X-', value: 'x-', disabled: !voxelReady, disabledReason: voxelReason }, { label: 'X+', value: 'x+', disabled: !voxelReady, disabledReason: voxelReason },
                { label: 'Y-', value: 'y-', disabled: !voxelReady, disabledReason: voxelReason }, { label: 'Y+', value: 'y+', disabled: !voxelReady, disabledReason: voxelReason },
                { label: 'Z-', value: 'z-', disabled: !voxelReady, disabledReason: voxelReason }, { label: 'Z+', value: 'z+', disabled: !voxelReady, disabledReason: voxelReason },
              ] });
            }
          }
          addRows('Transform', [
            { key: 'posX', label: 'Pos X', control: 'numeric', min: -0.5, max: 0.5, step: 0.01, currentValue: uniformValue(objectCells, c => +(c.offsetX || 0).toFixed(2)) },
            { key: 'posY', label: 'Pos Y', control: 'numeric', min: -0.5, max: 2, step: 0.01, currentValue: uniformValue(objectCells, c => +(c.offsetY || 0).toFixed(2)) },
            { key: 'posZ', label: 'Pos Z', control: 'numeric', min: -0.5, max: 0.5, step: 0.01, currentValue: uniformValue(objectCells, c => +(c.offsetZ || 0).toFixed(2)) },
            { key: 'rotDeg', label: 'Rot Y°', control: 'slider', min: 0, max: 360, step: 1, currentValue: uniformValue(objectCells, c => Math.round((((c.rotationY || 0) * 180 / Math.PI) % 360 + 360) % 360)) },
            { key: 'scaleAbs', label: 'Scale', control: 'slider', min: 0.25, max: 24, step: 0.05, currentValue: uniformValue(objectCells, c => +(ap(c).objectScale || 1).toFixed(2)) },
          ]);
          addRows('Appearance', [
            { key: 'baseColor', label: 'Base color', control: 'colorpicker', currentValue: uniformValue(objectCells, c => ap(c).bodyColor || null) },
            { key: 'finish', label: 'Finish', currentValue: uniformValue(objectCells, c => ap(c).finish || 'matte'), options: [
              { label: 'Matte', value: 'matte' }, { label: 'Satin', value: 'satin' }, { label: 'Glow', value: 'glow' } ] },
            { key: 'emissiveColor', label: 'Glow color', control: 'colorpicker', currentValue: uniformValue(objectCells, c => ap(c).emissiveColor || '#ffcc88') },
            { key: 'emissiveIntensity', label: 'Glow', control: 'slider', min: 0, max: 2, step: 0.05, currentValue: uniformValue(objectCells, c => +(ap(c).emissiveIntensity || 0).toFixed(2)) },
            { key: 'opacity', label: 'Opacity', control: 'slider', min: 0, max: 1, step: 0.05, currentValue: uniformValue(objectCells, c => +((ap(c).opacity === undefined ? 1 : ap(c).opacity)).toFixed(2)) },
          ]);
          const lightOf = c => ap(c).light || null;
          addRows('Appearance', [
            { key: 'lightType', label: 'Light', currentValue: uniformValue(objectCells, c => (lightOf(c) ? lightOf(c).type : 'none')), options: [
              { label: 'Off', value: 'none' }, { label: 'Point', value: 'point' }, { label: 'Spot', value: 'spot' } ] },
            { key: 'lightColor', label: 'Light color', control: 'colorpicker', currentValue: uniformValue(objectCells, c => (lightOf(c) ? lightOf(c).color : '#ffd9a0')) },
            { key: 'lightIntensity', label: 'Light int', control: 'slider', min: 0, max: 4, step: 0.1, currentValue: uniformValue(objectCells, c => (lightOf(c) ? lightOf(c).intensity : 0)) },
            { key: 'lightRange', label: 'Light range', control: 'slider', min: 1, max: 20, step: 0.5, currentValue: uniformValue(objectCells, c => (lightOf(c) ? lightOf(c).range : 6)) },
          ]);
          // Window glass — only meaningful for buildings (they have window panes).
          if (objectCells.some(c => c.kind === 'house' || c.kind === 'voxel-build')) {
            const WG = (typeof window !== 'undefined' && window.__tinyworldWindow) || {};
            const defTint = '#' + ((WG.tint != null ? WG.tint : 0xc4d6ea) & 0xffffff).toString(16).padStart(6, '0');
            const winOf = c => ap(c).window || null;
            const winVal = (c, k, dflt) => { const w = winOf(c); return (w && w[k] != null) ? w[k] : dflt; };
            addRows('Windows', [
              { key: 'windowGlassRatio', label: 'Glass size', control: 'slider', min: 0.4, max: 0.98, step: 0.02, currentValue: uniformValue(objectCells, c => +Number(winVal(c, 'glassRatio', WG.glassRatio != null ? WG.glassRatio : 0.86)).toFixed(2)) },
              { key: 'windowTint', label: 'Glass tint', control: 'colorpicker', currentValue: uniformValue(objectCells, c => winVal(c, 'tint', defTint)) },
              { key: 'windowDarkness', label: 'Darkness', control: 'slider', min: 0, max: 1, step: 0.05, currentValue: uniformValue(objectCells, c => +Number(winVal(c, 'darkness', WG.darkness != null ? WG.darkness : 0.04)).toFixed(2)) },
              { key: 'windowBrightness', label: 'Interior', control: 'slider', min: 0, max: 2, step: 0.05, currentValue: uniformValue(objectCells, c => +Number(winVal(c, 'brightness', WG.brightness != null ? WG.brightness : 1)).toFixed(2)) },
              { key: 'windowReflect', label: 'Reflection', control: 'slider', min: 0, max: 1, step: 0.05, currentValue: uniformValue(objectCells, c => +Number(winVal(c, 'reflect', WG.reflect != null ? WG.reflect : 0.5)).toFixed(2)) },
            ]);
          }
        }
      }
      addRows('Ground', [
        { key: 'terrain', label: 'Ground', currentValue: currentTerrain, options: [
          { label: 'Grass', value: 'grass' },
          { label: 'Path', value: 'path' },
          { label: 'Dirt', value: 'dirt' },
          { label: 'Water', value: 'water' },
          { label: 'Stone', value: 'stone' },
          { label: 'Sand', value: 'sand' },
          { label: 'Snow', value: 'snow' },
          { label: 'Lava', value: 'lava' },
        ] },
        { key: 'terrainHeight', label: 'Ground height', control: 'stepper', options: [
          { label: 'Down', value: 'down' },
          { label: 'Up', value: 'up' },
        ] },
      ]);
      const waterCells = selectedCells.filter(cell => cell.terrain === 'water');
      const hasWaterSelection = waterCells.length > 0;
      if (hasWaterSelection) {
        addRow('Ground', { key: 'waterFlow', label: 'Water flow', currentValue: uniformValue(waterCells, cell => normalizeWaterFlow(cell.waterFlow)), options: [
          { label: 'Auto', value: 'auto' },
          { label: 'North', value: 'n' },
          { label: 'South', value: 's' },
          { label: 'East', value: 'e' },
          { label: 'West', value: 'w' },
        ] });
      }
      const colorConfig = selectionColorConfig(primary);
      if (colorConfig) {
        const colorCells = selectedCells.filter(cell => colorConfig.kinds.has(cell.kind));
        addRows('Appearance', colorConfig.rows.map(row => ({
          key: row.key,
          label: row.label,
          color: true,
          currentValue: uniformAppearanceValue(colorCells, row.key),
          options: row.options,
        })));
        if (primary === 'house') {
          const houseCells = selectedCells.filter(cell => cell.kind === 'house');
          addRow('Appearance', { key: 'buildingType', label: 'Shape', currentValue: uniformValue(houseCells, cell => cell.buildingType || 'cottage'), options: [
            { label: 'Cottage', value: 'cottage' },
            { label: 'Manor', value: 'manor' },
            { label: 'Tower', value: 'tower' },
            { label: 'Castle', value: 'turret' },
            { label: 'High-rise', value: 'skyscraper' },
          ] });
        }
      }
      addRow('Transform', { key: 'size', label: 'Size', currentValue: currentSize, options: [
        { label: 'Small', value: 'small' },
        { label: 'Medium', value: 'medium' },
        { label: 'Large', value: 'large' },
      ] });
      const availableSectionNames = sectionOrder.filter(sectionName => (rowsBySection[sectionName] || []).length);
      if (!availableSectionNames.some(sectionName => sectionName.toLowerCase().replace(/\s+/g, '-') === selectionPropActiveTab)) {
        selectionPropActiveTab = (availableSectionNames[0] || 'Edit').toLowerCase().replace(/\s+/g, '-');
        saveSelectionPropActiveTab();
      }
      if (availableSectionNames.length > 1) {
        const tabbar = document.createElement('div');
        tabbar.className = 'selection-prop-category-tabs';
        tabbar.setAttribute('role', 'tablist');
        tabbar.setAttribute('aria-label', 'Property groups');
        availableSectionNames.forEach(sectionName => {
          const sectionKey = sectionName.toLowerCase().replace(/\s+/g, '-');
          const tab = document.createElement('button');
          tab.type = 'button';
          tab.className = 'selection-prop-category-tab' + (sectionKey === selectionPropActiveTab ? ' active' : '');
          tab.setAttribute('role', 'tab');
          tab.setAttribute('aria-selected', sectionKey === selectionPropActiveTab ? 'true' : 'false');
          tab.textContent = sectionName;
          tab.addEventListener('click', e => {
            e.stopPropagation();
            selectionPropActiveTab = sectionKey;
            saveSelectionPropActiveTab();
            renderSelectionProperties(summary, entries);
          });
          tabbar.appendChild(tab);
        });
        previewProps.appendChild(tabbar);
      }
      const optionGlyph = (row, opt) => {
        if (row.key === 'historyAction') return opt.value === 'undo' ? '↶' : '↷';
        if (row.key === 'rotate') return opt.value === 'left' ? '↺' : '↻';
        if (row.key === 'selectionMove') {
          if (opt.value === 'west') return 'W';
          if (opt.value === 'east') return 'E';
          if (opt.value === 'north') return 'N';
          if (opt.value === 'south') return 'S';
        }
        if (row.key === 'objectMove') {
          if (opt.value === 'x-') return 'X-';
          if (opt.value === 'x+') return 'X+';
          if (opt.value === 'y-') return 'Y-';
          if (opt.value === 'y+') return 'Y+';
          if (opt.value === 'z-') return 'Z-';
          if (opt.value === 'z+') return 'Z+';
          if (opt.value === 'center') return '•';
        }
        if (row.control === 'stepper') {
          if (opt.value === 'down') return '-';
          if (opt.value === 'up') return '+';
          if (opt.value === 'reset') return '0';
        }
        return opt.label;
      };
      const controlClassForRow = row => {
        if (row.control === 'move') return 'control-move';
        if (row.control === 'axis' || row.control === 'rotate' || row.control === 'history') return 'control-axis';
        if (row.control === 'stepper') return 'control-stepper';
        return '';
      };
      const chipClassForOption = (row, opt) => {
        const classes = ['selection-prop-chip'];
        if (row.color || row.material) classes.push('color-chip');
        if (row.control === 'stepper' || row.control === 'rotate' || row.control === 'move' || row.control === 'axis' || row.control === 'history') {
          classes.push('icon-chip');
        }
        if (row.control === 'stepper' || row.control === 'rotate' || row.control === 'move' || row.control === 'history') {
          classes.push('round-chip');
        }
        if (opt.value === 'reset' || opt.value === 'transform') classes.push('reset-chip');
        if (opt.value === 'delete' || opt.value === 'cut') classes.push('danger-chip');
        return classes.join(' ');
      };
      sectionOrder.forEach(sectionName => {
        const rows = rowsBySection[sectionName] || [];
        if (!rows.length) return;
        const sectionKey = sectionName.toLowerCase().replace(/\s+/g, '-');
        if (availableSectionNames.length > 1 && sectionKey !== selectionPropActiveTab) return;
        const isCollapsed = selectionPropCollapsedSections.has(sectionKey);
        const sectionWrap = document.createElement('section');
        sectionWrap.className = 'selection-prop-section' + (isCollapsed ? ' is-collapsed' : '');
        sectionWrap.dataset.section = sectionKey;
        sectionWrap.setAttribute('aria-label', sectionName + ' properties');
        const sectionTitle = document.createElement('button');
        sectionTitle.type = 'button';
        sectionTitle.className = 'selection-prop-section-title';
        sectionTitle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
        sectionTitle.setAttribute('aria-label', sectionName + ' properties, ' + rows.length + ' row' + (rows.length === 1 ? '' : 's') + ', ' + (isCollapsed ? 'collapsed' : 'expanded'));
        const sectionLabel = document.createElement('span');
        sectionLabel.textContent = sectionName;
        const sectionMeta = document.createElement('span');
        sectionMeta.className = 'selection-prop-section-meta';
        sectionMeta.textContent = rows.length + ' row' + (rows.length === 1 ? '' : 's');
        const sectionCue = document.createElement('span');
        sectionCue.className = 'selection-prop-section-cue';
        sectionCue.setAttribute('aria-hidden', 'true');
        sectionMeta.appendChild(sectionCue);
        sectionTitle.append(sectionLabel, sectionMeta);
        sectionTitle.addEventListener('click', e => {
          e.stopPropagation();
          if (selectionPropCollapsedSections.has(sectionKey)) selectionPropCollapsedSections.delete(sectionKey);
          else selectionPropCollapsedSections.add(sectionKey);
          saveSelectionPropCollapsedSections();
          renderSelectionProperties(summary, entries);
        });
        sectionWrap.appendChild(sectionTitle);
        rows.forEach(row => {
          const wrap = document.createElement('div');
          wrap.className = 'selection-prop-row';
          const label = document.createElement('div');
          label.className = 'selection-prop-label';
          label.textContent = row.label;
          const options = document.createElement('div');
          options.className = 'selection-prop-options';
          const controlClass = controlClassForRow(row);
          if (controlClass) options.classList.add(controlClass);
          if (row.control === 'numeric' || row.control === 'slider' || row.control === 'colorpicker') {
            const input = document.createElement('input');
            input.type = row.control === 'colorpicker' ? 'color' : (row.control === 'slider' ? 'range' : 'number');
            if (row.min !== undefined) input.min = row.min;
            if (row.max !== undefined) input.max = row.max;
            if (row.step !== undefined) input.step = row.step;
            if (row.currentValue !== undefined && row.currentValue !== null) {
              input.value = row.control === 'colorpicker' ? String(row.currentValue) : row.currentValue;
            } else if (row.control === 'colorpicker') {
              input.value = '#ffffff';
            }
            input.className = 'selection-prop-input control-' + row.control;
            input.setAttribute('aria-label', row.label);
            const handler = e => { e.stopPropagation(); applySelectionProperty(row.key, input.value); };
            input.addEventListener('change', handler);
            if (row.control === 'slider') input.addEventListener('input', handler);
            input.addEventListener('click', e => e.stopPropagation());
            options.appendChild(input);
            wrap.appendChild(label);
            wrap.appendChild(options);
            sectionWrap.appendChild(wrap);
            return;
          }
          (row.options || []).forEach(opt => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = chipClassForOption(row, opt);
            chip.dataset.action = String(opt.value);
            const hasCurrentValue = row.currentValue !== undefined && row.currentValue !== null;
            const isActive = hasCurrentValue && String(row.currentValue) === String(opt.value);
            if (hasCurrentValue) chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            if (isActive) chip.classList.add('active');
            if (opt.disabled) chip.disabled = true;
            chip.setAttribute('aria-label', row.label + ': ' + opt.label);
            chip.title = row.label + ': ' + opt.label;
            // When a chip is gated off, surface the precondition as its tooltip
            // (and aria-label) so the disabled state is explained, not mysterious.
            if (opt.disabled && opt.disabledReason) {
              chip.title = opt.disabledReason;
              chip.setAttribute('aria-label', row.label + ': ' + opt.label + ' — ' + opt.disabledReason);
            }
            if (row.color && opt.color) {
              const swatch = document.createElement('span');
              swatch.className = 'selection-prop-swatch';
              swatch.style.background = opt.color;
              chip.appendChild(swatch);
            } else if (row.material && (opt.glyph || opt.swatch)) {
              // Material marker: a small SVG glyph tinted with the material's
              // representative colour so each chip is distinguishable at a glance.
              const marker = document.createElement('span');
              marker.setAttribute('aria-hidden', 'true');
              marker.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;flex:0 0 auto;color:' + (opt.swatch || 'currentColor') + ';';
              if (opt.glyph) {
                marker.innerHTML = opt.glyph;
                const svgEl = marker.firstChild;
                if (svgEl && svgEl.style) { svgEl.style.width = '100%'; svgEl.style.height = '100%'; }
              } else {
                marker.style.background = opt.swatch;
                marker.style.borderRadius = '4px';
                marker.style.boxShadow = 'inset 0 0 0 1px rgba(0,0,0,0.12)';
              }
              chip.appendChild(marker);
            }
            chip.appendChild(document.createTextNode(optionGlyph(row, opt)));
            chip.addEventListener('click', e => {
              e.stopPropagation();
              if (opt.disabled) return;
              applySelectionProperty(row.key, opt.value);
            });
            options.appendChild(chip);
          });
          wrap.appendChild(label);
          wrap.appendChild(options);
          sectionWrap.appendChild(wrap);
        });
        previewProps.appendChild(sectionWrap);
      });
      previewProps.hidden = false;
      notifySelectionPropertiesRendered();
    }

    function renderSelection() {
      const sel = window.__tinyworldSelection;
      const summary = sel && sel.summary();
      const engineTarget = selectedEngineUiTarget();
      if (!summary) {
        if (engineTarget) {
          panel.classList.remove('has-selection');
          previewBox.hidden = true;
          syncAgentTargetChip(null, { cellCount: 1, kinds: { engine: 1 }, terrains: {} });
          previewCount.textContent = 'Selected: ' + (engineTarget.engine.type || 'lift') + ' engine L' + (engineTarget.engine.level || 1);
          previewList.innerHTML = '';
          [
            ['Island', engineTarget.island.id],
            ['Slot', String((engineTarget.engine.slot || 0) + 1)],
            ['Mount', engineTarget.engine.installed === false ? 'removed' : 'installed'],
          ].forEach(([nameValue, countValue]) => {
            const li = document.createElement('li');
            const name = document.createElement('span');
            name.textContent = nameValue;
            const count = document.createElement('span');
            count.className = 'count';
            count.textContent = countValue;
            li.append(name, count);
            previewList.appendChild(li);
          });
          renderEditableIslandEngineProperties(engineTarget);
          updateSelectionPreview(null);
          updateTransformGizmo(null);
          if (panelTitle) panelTitle.textContent = 'AI chat';
          openSelectionPropertiesInLayers();
          return;
        }
        const pyramidTarget = selectedPyramidUiTarget();
        if (pyramidTarget) {
          panel.classList.remove('has-selection');
          previewBox.hidden = true;
          syncAgentTargetChip(null, { cellCount: 1, kinds: { pyramid: 1 }, terrains: {} });
          const pc = (pyramidTarget.island.pyramids || []).length;
          previewCount.textContent = 'Selected: underside pyramid' + (pc > 1 ? ' (' + pc + ' total)' : '');
          previewList.innerHTML = '';
          [
            ['Island', pyramidTarget.island.id],
            ['Width', (Math.round((pyramidTarget.pyramid.scaleX || 1) * 100) / 100).toFixed(2) + 'x'],
            ['Height', (Math.round((pyramidTarget.pyramid.scaleY || 1) * 100) / 100).toFixed(2) + 'x'],
          ].forEach(([nameValue, countValue]) => {
            const li = document.createElement('li');
            const name = document.createElement('span');
            name.textContent = nameValue;
            const count = document.createElement('span');
            count.className = 'count';
            count.textContent = countValue;
            li.append(name, count);
            previewList.appendChild(li);
          });
          renderEditableIslandPyramidProperties(pyramidTarget);
          updateSelectionPreview(null);
          updateTransformGizmo(null);
          if (panelTitle) panelTitle.textContent = 'AI chat';
          openSelectionPropertiesInLayers();
          return;
        }
        panel.classList.remove('has-selection');
        previewBox.hidden = true;
        updateSelectionPreview(null);
        syncAgentTargetChip(null, null);
        if (previewProps) {
          previewProps.innerHTML = '';
          previewProps.hidden = true;
          notifySelectionPropertiesRendered();
        }
        updateTransformGizmo(null);
        if (panelTitle) panelTitle.textContent = 'AI chat';
        return;
      }
      panel.classList.remove('has-selection');
      previewBox.hidden = true;
      const selectedObject = selectedBoardObjectTarget();
      syncAgentTargetChip(selectedObject, summary);
      previewCount.textContent = selectedObject
        ? 'Selected: ' + selectedBoardObjectLabel(selectedObject)
        : summary.cellCount + (summary.cellCount === 1 ? ' tile selected' : ' tiles selected');
      previewList.innerHTML = '';
      const entries = Object.entries(summary.kinds).sort((a, b) => b[1] - a[1]);
      for (const [k, n] of entries) {
        const li = document.createElement('li');
        const name = document.createElement('span');
        name.textContent = k;
        const count = document.createElement('span');
        count.className = 'count';
        count.textContent = '×' + n;
        li.appendChild(name);
        li.appendChild(count);
        previewList.appendChild(li);
      }
      renderSelectionProperties(summary, entries);
      if (document.documentElement.classList.contains('ai-disabled')) openSelectionPropertiesInLayers();
      updateSelectionPreview(null);
      updateTransformGizmo(selectedObject);
      if (panelTitle) panelTitle.textContent = 'AI chat';
      // Properties now live in Layers / Properties. A single pick keeps the
      // canvas-first flow; multi-cell edits open the durable property surface.
      if (summary.cellCount > 1) openSelectionPropertiesInLayers();
    }
    // Exposed so the sub-object edit module (file 44) + radial menu can rebuild
    // the selection panel after a part select (renderSelection is otherwise
    // private to this IIFE).
    window.renderSelection = renderSelection;
    window.addEventListener('tinyworld:selection-changed', renderSelection);
    window.addEventListener('tinyworld:history-changed', () => {
      if (previewBox && !previewBox.hidden) renderSelection();
    });

    // -- suggestion chips below the input --
    const SUGGESTIONS = [
      'make it snowy',
      'add a river running across',
      'build a small village',
      'add a forest of trees',
      'make it nighttime',
      'place a castle in the middle',
      'add a path through it',
      'make it a desert',
      'add some sheep and cows',
      'build a farm with crops',
      'add a mountain in the corner',
      'create a town square with houses',
      'add a bridge over the water',
      'clear everything to grass',
      'add a lava lake',
      'make a snowy mountain village',
    ];
    const sugBox = document.getElementById('agent-suggestions');
    const MAX_CHIPS = 4;

    function renderSuggestions() {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        sugBox.hidden = true;
        sugBox.innerHTML = '';
        return;
      }
      const matches = SUGGESTIONS
        .filter(s => s.toLowerCase().includes(q))
        .slice(0, MAX_CHIPS);
      if (!matches.length) {
        sugBox.hidden = true;
        sugBox.innerHTML = '';
        return;
      }
      sugBox.innerHTML = '';
      matches.forEach(s => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'agent-suggestion-chip';
        chip.textContent = s;
        chip.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          input.value = s;
          input.focus();
          renderSuggestions();
        });
        sugBox.appendChild(chip);
      });
      sugBox.hidden = false;
    }
    input.addEventListener('input', renderSuggestions);
    input.addEventListener('focus', renderSuggestions);
    input.addEventListener('blur', () => {
      // Defer so a chip click still registers before we hide the list.
      setTimeout(() => { sugBox.hidden = true; }, 150);
    });

    function coerceAttachedModelStampsForGeneratedWorld(data, attachments) {
      const models = (Array.isArray(attachments) ? attachments : [])
        .filter(item => item && item.type === 'model' && typeof item.modelStampId === 'string' && item.modelStampId);
      if (models.length !== 1 || !data || !Array.isArray(data.cells)) return data;
      const modelStampId = models[0].modelStampId;
      let changed = false;
      const repairAppearance = raw => {
        const appearance = Object.assign({}, normalizeAppearance(raw) || {});
        if (appearance.modelStampId === modelStampId) return raw || appearance;
        appearance.modelStampId = modelStampId;
        changed = true;
        return appearance;
      };
      data.cells.forEach(cell => {
        if (Array.isArray(cell)) {
          if (cell[3] !== 'model-stamp') return;
          cell[10] = repairAppearance(cell[10]);
          return;
        }
        if (!cell || typeof cell !== 'object' || cell.kind !== 'model-stamp') return;
        cell.appearance = repairAppearance(cell.appearance);
      });
      if (changed) console.warn('[agent] repaired generated model-stamp cells to attached modelStampId:', modelStampId);
      return data;
    }
    window.__tinyworldCoerceAttachedModelStampsForGeneratedWorld = coerceAttachedModelStampsForGeneratedWorld;

    // Attachment button mirrors the existing drag/drop bridge used by model/image drops.
    const attachInput = document.createElement('input');
    attachInput.type = 'file';
    attachInput.multiple = true;
    attachInput.accept = '.glb,.gltf,.obj,.fbx,.vox,.vdb,.mtl,.png,.jpg,.jpeg,.webp,.gif,image/*';
    attachInput.hidden = true;
    form.appendChild(attachInput);
    function agentFileAttachAllowed() {
      return !!(window.__tinyworldOwnerToolsAllowed && window.__tinyworldOwnerToolsAllowed());
    }
    function agentFileAttachDenied() {
      if (typeof twToast === 'function') twToast('File attachments are limited to the owner account.', 'err');
    }
    grip.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!agentFileAttachAllowed()) { agentFileAttachDenied(); return; }
      attachInput.click();
    });
    attachInput.addEventListener('change', () => {
      const files = Array.from(attachInput.files || []);
      attachInput.value = '';
      if (!files.length) return;
      if (!agentFileAttachAllowed()) { agentFileAttachDenied(); return; }
      const bridge = window.__tinyworldAgentDropAttachments;
      if (bridge && typeof bridge.addFiles === 'function') bridge.addFiles(files);
    });

    let panelResize = null;
    function beginPanelResize(e) {
      if (!resizer || panel.classList.contains('collapsed')) return;
      e.preventDefault();
      e.stopPropagation();
      const r = panel.getBoundingClientRect();
      panelResize = { startX: e.clientX, startWidth: r.width };
      panel.classList.add('resizing');
      try { resizer.setPointerCapture && resizer.setPointerCapture(e.pointerId); } catch (_) {}
    }
    function movePanelResize(e) {
      if (!panelResize) return;
      e.preventDefault();
      const nextWidth = panelResize.startWidth + (panelResize.startX - e.clientX);
      applyPanelWidth(nextWidth);
    }
    function endPanelResize() {
      if (!panelResize) return;
      panelResize = null;
      panel.classList.remove('resizing');
      savePanelState();
    }
    if (resizer) {
      resizer.addEventListener('pointerdown', beginPanelResize);
      window.addEventListener('pointermove', movePanelResize);
      window.addEventListener('pointerup', endPanelResize);
      window.addEventListener('pointercancel', endPanelResize);
      resizer.addEventListener('mousedown', beginPanelResize);
      window.addEventListener('mousemove', movePanelResize);
      window.addEventListener('mouseup', endPanelResize);
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const userText = input.value.trim();
      if (!userText || send.disabled) return;
      const dropBridge = window.__tinyworldAgentDropAttachments || null;
      const dropAttachments = dropBridge && dropBridge.peek ? dropBridge.peek() : [];
      const attachmentPrompt = dropBridge && dropBridge.promptContext ? dropBridge.promptContext(dropAttachments) : '';
      const attachmentSummary = dropBridge && dropBridge.summaryText ? dropBridge.summaryText(dropAttachments) : '';
      const imageAttachment = dropAttachments.find(item => item && item.type === 'image' && item.dataUrl);
      const imageDataUrl = imageAttachment ? imageAttachment.dataUrl : null;
      const intent = floatingAgentIntent(userText);
      // If there's an active selection, prepend its context so the agent
      // scopes its work to those cells.
      const sel = window.__tinyworldSelection;
      const summary = sel && sel.summary();
      let selectionBounds = null;
      let prompt = intent.prompt || userText;
      if (attachmentPrompt) prompt += attachmentPrompt;
      let selectedObjectTarget = null;

      if (summary) {
        const cellsArray = sel.worldCoords ? sel.worldCoords() : [];
        const minX = Math.min(...cellsArray.map(c => c.x));
        const maxX = Math.max(...cellsArray.map(c => c.x));
        const minZ = Math.min(...cellsArray.map(c => c.z));
        const maxZ = Math.max(...cellsArray.map(c => c.z));

        selectionBounds = { minX, maxX, minZ, maxZ };
        selectedObjectTarget = selectedBoardObjectTarget();

        // The object label can derive from a user-named custom stamp, so clamp it
        // to a short single-line token before embedding it in the system prompt —
        // defuses prompt-injection via crafted stamp names. (The cell intent is
        // already injection-safe: cloneCellIntent allowlists only scalars/enums and
        // normalizeAppearance reduces appearance to hex colors + [a-z0-9_-] ids.)
        const safeObjectLabel = (lbl) => String(lbl || 'selected object').replace(/[\r\n]+/g, ' ').replace(/[^\w \-]/g, '').slice(0, 48);
        prompt =
          `You are ONLY allowed to modify the rectangular region from x=${minX} to x=${maxX}, z=${minZ} to z=${maxZ}. ` +
          `Do not output any changes outside this exact area. The user wants you to customize this specific region.\n\n` +
          (selectedObjectTarget
            ? `Selected object chip: ${safeObjectLabel(selectedBoardObjectLabel(selectedObjectTarget))} at x=${selectedObjectTarget.x}, z=${selectedObjectTarget.z}. Current cell intent: ${JSON.stringify(cloneCellIntent(selectedObjectTarget.cell))}\n\n`
            : '') +
          userText + attachmentPrompt;
      }
      setPanelCollapsed(false, { pin: true });
      sugBox.hidden = true;
      markAgentActivity();
      // User message lives only in the conversation history; no toast.
      addAgentMessage('user', attachmentSummary ? userText + '\n' + attachmentSummary : userText);
      input.value = '';
      // Progress flows through the placeholder while work runs.
      const thinking = addAgentMessage('assistant', 'Working on it…');
      setInputProgress('Working on it…');
      send.disabled = true;
      form.classList.add('busy');
      let submitSucceeded = false;
      try {
        if (intent.clearFirst && !intent.prompt) {
          doClear();
          thinking.textContent = 'World cleared.';
          window.__tinyworldAgent && window.__tinyworldAgent.done && window.__tinyworldAgent.done('World cleared.');
          submitSucceeded = true;
          return;
        }
        const cfg = getAIProviderState();
        const localOpenAIEnhance =
          /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname) &&
          (cfg.provider === 'openai' || !cfg.key);
        if (selectedObjectTarget && (shouldEnhanceSelectedObjectPrompt(userText) || (!cfg.key && localOpenAIEnhance))) {
          if (!cfg.key && !localOpenAIEnhance) throw new Error('Add an API key in Settings → AI first.');
          const stamp = await enhanceSelectedBoardObject(userText, { imageDataUrl, attachments: dropAttachments });
          if (!stamp) return; // superseded by a newer generation
          const doneText = 'Enhanced selected object into ' + stamp.name + '.';
          thinking.textContent = doneText;
          window.__tinyworldAgent && window.__tinyworldAgent.done && window.__tinyworldAgent.done(doneText);
          submitSucceeded = true;
          return;
        }
        if (!cfg.key) throw new Error('Add an API key in Settings → AI first.');
        if (intent.clearFirst) doClear();
        const requestPrompt = intent.mode === 'add' ? buildFloatingAdditionPrompt(prompt) : prompt;
        let data = await generateWorld(cfg.provider, cfg.model, cfg.key, requestPrompt, GRID, { imageDataUrl });
        if (!data) return; // superseded by a newer generation
        data = coerceAttachedModelStampsForGeneratedWorld(data, dropAttachments);

        // If user had a selection active, mask the result to only affect that region (powerful "customize this area" feature)
        if (selectionBounds && data && Array.isArray(data.cells)) {
          data = {
            ...data,
            cells: data.cells.filter(cell => {
              const cx = Array.isArray(cell) ? cell[0] : cell.x;
              const cz = Array.isArray(cell) ? cell[1] : cell.z;
              return cx >= selectionBounds.minX && cx <= selectionBounds.maxX &&
                     cz >= selectionBounds.minZ && cz <= selectionBounds.maxZ;
            })
          };
        }

        // With a selection mask active the cells are a region patch — never
        // route through full applyState, which would wipe everything outside
        // the selection even when the prompt says replace/rebuild/reset.
        const usePatch = intent.mode === 'add' || !!selectionBounds;
        const ok = usePatch ? applyStatePatch(data) : applyState(data);
        if (!ok) {
          throw new Error(intent.mode === 'add'
            ? 'The generated additions were rejected by the renderer.'
            : 'The generated world was rejected by the renderer.');
        }
        // Record final state in history + fire the toast.
        const doneText = intent.mode === 'add' ? 'Added to world.' : 'Building completed.';
        thinking.textContent = doneText;
        window.__tinyworldAgent && window.__tinyworldAgent.done && window.__tinyworldAgent.done(doneText);
        submitSucceeded = true;
      } catch (err) {
        if (err && (err.name === 'AbortError' || (err instanceof DOMException && err.name === 'AbortError'))) return;
        const msg = String(err.message || err).slice(0, 180);
        thinking.className = 'agent-msg error';
        thinking.textContent = msg;
        window.__tinyworldAgent && window.__tinyworldAgent.done && window.__tinyworldAgent.done(msg, 'error');
      } finally {
        send.disabled = false;
        form.classList.remove('busy');
        // Drop the active selection only after a successful submission. On
        // errors, keep the chip/target so the user can fix the prompt or
        // retry without reselecting the object.
        if (submitSucceeded && window.__tinyworldSelection) window.__tinyworldSelection.clear();
        if (submitSucceeded && dropBridge && dropBridge.clear) dropBridge.clear(dropAttachments);
      }
    });

    // Escape clears any active selection (mirrors deselect behaviour from
    // other tools).
    window.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
      if (window.__tinyworldSelection) window.__tinyworldSelection.clear();
    });
  })();
