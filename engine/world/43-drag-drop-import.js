  // -------- drag/drop imports --------
  (function initTinyWorldDropImports() {
    const MODEL_DROP_EXT_RE = /\.(glb|gltf|obj|fbx|vox|vdb)$/i;
    const IMAGE_DROP_EXT_RE = /\.(png|jpe?g|webp|gif)$/i;
    // Material/texture files that ride along with a model (OBJ .mtl + its images).
    // Texture extensions stay in sync with MODEL_STAMP_TEXTURE_FORMATS in the model
    // stamp loader, which is what actually classifies/loads them.
    const MODEL_SIDECAR_EXT_RE = /\.(mtl|png|jpe?g|webp|gif)$/i;
    const MODEL_DROP_STATUS_MS = 2600;
    let agentAttachments = [];
    let dropStatusTimer = 0;
    let dropStatusEl = null;

    function droppedFiles(evt) {
      return Array.from((evt && evt.dataTransfer && evt.dataTransfer.files) || []);
    }

    function modelFiles(files) {
      return (files || []).filter(file => MODEL_DROP_EXT_RE.test(file.name || ''));
    }

    // A model plus any material/texture sidecars dropped alongside it. The model
    // registrar separates models from sidecars internally, but it only receives
    // what we pass it — so an OBJ's .mtl and texture images must be included here
    // or the model loads untextured (white).
    function modelBundleFiles(files) {
      if (!modelFiles(files).length) return [];
      return (files || []).filter(file =>
        MODEL_DROP_EXT_RE.test(file.name || '') || MODEL_SIDECAR_EXT_RE.test(file.name || ''));
    }

    function imageFiles(files) {
      return (files || []).filter(file => (file.type && /^image\//i.test(file.type)) || IMAGE_DROP_EXT_RE.test(file.name || ''));
    }

    function hasDropFiles(evt, kind) {
      const files = droppedFiles(evt);
      if (!files.length) {
        const types = Array.from((evt && evt.dataTransfer && evt.dataTransfer.types) || []);
        return types.includes('Files');
      }
      if (kind === 'model') return modelFiles(files).length > 0;
      if (kind === 'image') return imageFiles(files).length > 0;
      return modelFiles(files).length > 0 || imageFiles(files).length > 0;
    }

    function stripExt(name) {
      return String(name || 'asset').replace(/\.[^.]+$/, '') || 'asset';
    }

    function fileToDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
    }

    function showDropStatus(text, tone) {
      if (!dropStatusEl) {
        dropStatusEl = document.createElement('div');
        dropStatusEl.className = 'tinyworld-drop-status';
        document.body.appendChild(dropStatusEl);
      }
      dropStatusEl.textContent = text;
      dropStatusEl.dataset.tone = tone || 'ok';
      dropStatusEl.hidden = false;
      clearTimeout(dropStatusTimer);
      dropStatusTimer = setTimeout(() => { if (dropStatusEl) dropStatusEl.hidden = true; }, MODEL_DROP_STATUS_MS);
    }

    function registerDroppedModels(files) {
      const register = window.__tinyworldRegisterDroppedModelStamps;
      if (typeof register !== 'function') return [];
      return register(files);
    }

    function cleanModelLoadMessage(message) {
      let text = '';
      if (message && typeof message === 'object') {
        const target = message.target || message.currentTarget || null;
        const url = target && (target.responseURL || target._url || target.src);
        const status = target && target.status;
        text = message.message || (status ? 'HTTP ' + status : '') || (url ? 'Could not read ' + url : '') || '';
        if (!text && message.type) text = 'file load failed (' + message.type + ')';
      } else {
        text = String(message || '');
      }
      return String(text || 'loader failed')
        .replace(/^THREE\.(?:GLTFLoader|DRACOLoader):\s*/i, '')
        .replace(/^THREE\.\w+:\s*/i, '')
        .slice(0, 150);
    }

    function preloadDroppedModel(asset, opts = {}) {
      if (!asset || typeof window.__tinyworldPreloadModelStamp !== 'function') return null;
      const label = asset.label || stripExt(asset.path);
      const cache = window.__tinyworldPreloadModelStamp(asset.id, {
        ready() {
          if (opts.readyText) showDropStatus(opts.readyText);
        },
        error(message) {
          showDropStatus('Could not render ' + label + ': ' + cleanModelLoadMessage(message), 'error');
        },
      });
      if (cache && cache.state === 'ready' && opts.readyText) showDropStatus(opts.readyText);
      else if (cache && cache.state === 'error') {
        showDropStatus('Could not render ' + label + ': ' + cleanModelLoadMessage(cache.errorMessage), 'error');
      } else if (cache && cache.state === 'loading' && opts.loadingText) {
        showDropStatus(opts.loadingText, 'busy');
      }
      return cache;
    }

    function waitForDroppedModel(asset, opts = {}) {
      if (!asset) return Promise.resolve(false);
      if (typeof window.__tinyworldPreloadModelStamp !== 'function') return Promise.resolve(true);
      const label = asset.label || stripExt(asset.path);
      return new Promise(resolve => {
        let done = false;
        const finish = ok => {
          if (done) return;
          done = true;
          resolve(ok);
        };
        const cache = window.__tinyworldPreloadModelStamp(asset.id, {
          ready() {
            if (opts.readyText) showDropStatus(opts.readyText);
            finish(true);
          },
          error(message) {
            showDropStatus('Could not render ' + label + ': ' + cleanModelLoadMessage(message), 'error');
            finish(false);
          },
        });
        if (cache && cache.state === 'ready') {
          if (opts.readyText) showDropStatus(opts.readyText);
          finish(true);
        } else if (cache && cache.state === 'error') {
          showDropStatus('Could not render ' + label + ': ' + cleanModelLoadMessage(cache.errorMessage), 'error');
          finish(false);
        } else {
          showDropStatus(opts.loadingText || ('Loading ' + label + '…'), 'busy');
        }
      });
    }

    function selectedModelTool(asset) {
      if (!asset) return null;
      return {
        id: 'model-stamp:' + asset.id,
        label: asset.label || stripExt(asset.path),
        kind: 'model-stamp',
        modelStampId: asset.id,
        modelAsset: asset,
        isModelStamp: true,
        supported: asset.supported,
        color: '#8aa4b8',
        stampCategories: typeof stampBuilderCategoriesForModelAsset === 'function'
          ? stampBuilderCategoriesForModelAsset(asset)
          : ['models'],
      };
    }

    function selectDroppedModel(asset) {
      const tool = selectedModelTool(asset);
      if (!tool || tool.supported === false || typeof selectTool !== 'function') return false;
      selectTool(tool);
      if (typeof syncModelStampSettingsPanel === 'function') syncModelStampSettingsPanel(tool);
      if (typeof renderStampBuilderCards === 'function') renderStampBuilderCards();
      return true;
    }

    function modelPlacementTarget(evt) {
      if (typeof pickTile !== 'function') return null;
      const hit = pickTile(evt.clientX, evt.clientY);
      if (!hit) return null;
      if (typeof worldTargetFromHit === 'function') return worldTargetFromHit(hit, true);
      const bx = hit.boardX || 0;
      const bz = hit.boardZ || 0;
      return { x: hit.x + bx * GRID, z: hit.z + bz * GRID, cell: getWorldCell(hit.x + bx * GRID, hit.z + bz * GRID), userEdited: !!(bx || bz) };
    }

    function placeDroppedModel(asset, evt, targetOverride = null) {
      if (!asset || asset.supported === false || typeof setCell !== 'function') return false;
      if (window.__flightActive) return false;
      if (typeof mpEditAllowed === 'function' && !mpEditAllowed()) return false;
      const target = targetOverride || modelPlacementTarget(evt);
      if (!target) return false;
      const mp = window.__tinyworldMultiplayer;
      if (mp && typeof mp.canEdit === 'function' && !mp.canEdit(target.x, target.z)) return false;
      const cell = target.cell || getWorldCell(target.x, target.z);
      const cfg = typeof getModelStampSettings === 'function'
        ? getModelStampSettings(asset.id)
        : { objectScale: 1, offsetY: 0, rotationY: 0 };
      let terrain = (cell && cell.terrain) || 'grass';
      if (terrain === 'water' || terrain === 'lava') terrain = 'grass';
      setCell(target.x, target.z, {
        terrain,
        terrainFloors: cell ? terrainLevelForCell(cell) : 1,
        kind: 'model-stamp',
        floors: 1,
        rotationY: cfg.rotationY || 0,
        offsetY: cfg.offsetY || 0,
        appearance: { modelStampId: asset.id, objectScale: cfg.objectScale || 1 },
        userEdited: !!target.userEdited,
      });
      if (window.__tinyworldSelection && typeof window.__tinyworldSelection.replaceWorldCoords === 'function') {
        window.__tinyworldSelection.replaceWorldCoords([{ x: target.x, z: target.z }]);
      }
      selectDroppedModel(asset);
      return true;
    }

    function renderAgentAttachments() {
      const form = document.getElementById('agent-input');
      if (!form) return;
      let wrap = document.getElementById('agent-attachments');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'agent-attachments';
        wrap.className = 'agent-attachments';
        const suggestions = document.getElementById('agent-suggestions');
        form.insertBefore(wrap, suggestions || null);
      }
      wrap.innerHTML = '';
      wrap.hidden = !agentAttachments.length;
      agentAttachments.forEach(item => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'agent-attachment-chip';
        chip.title = item.name;
        chip.textContent = (item.type === 'image' ? 'Image: ' : 'Model: ') + item.name;
        chip.addEventListener('click', () => {
          agentAttachments = agentAttachments.filter(a => a.id !== item.id);
          renderAgentAttachments();
        });
        wrap.appendChild(chip);
      });
      form.classList.toggle('has-attachments', agentAttachments.length > 0);
    }

    async function attachFilesToAgent(files) {
      const models = registerDroppedModels(modelBundleFiles(files));
      models.forEach(asset => {
        preloadDroppedModel(asset);
        agentAttachments.push({
          id: 'model:' + asset.id,
          type: 'model',
          name: asset.label || stripExt(asset.path),
          modelStampId: asset.id,
        });
      });
      // When a model is dropped, accompanying images are its textures (already
      // consumed by the model bundle) — only attach images as references when no
      // model came with them.
      const images = models.length ? [] : imageFiles(files);
      for (const file of images) {
        const dataUrl = await fileToDataUrl(file);
        agentAttachments.push({
          id: 'image:' + Date.now().toString(36) + ':' + agentAttachments.length,
          type: 'image',
          name: stripExt(file.name),
          dataUrl,
        });
      }
      renderAgentAttachments();
      if (models.length || images.length) {
        showDropStatus('Attached ' + (models.length + images.length) + ' file' + ((models.length + images.length) === 1 ? '' : 's') + ' to chat');
      }
    }

    function setupDropTarget(el, opts) {
      if (!el) return;
      const kind = opts && opts.kind;
      el.addEventListener('dragover', e => {
        if (!hasDropFiles(e, kind)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = opts && opts.effect || 'copy';
        el.classList.add('drop-hot');
      });
      el.addEventListener('dragleave', e => {
        if (e.relatedTarget && el.contains(e.relatedTarget)) return;
        el.classList.remove('drop-hot');
      });
      el.addEventListener('drop', e => {
        const files = droppedFiles(e);
        if (!files.length || !hasDropFiles(e, kind)) return;
        e.preventDefault();
        el.classList.remove('drop-hot');
        opts.onDrop(files, e);
      });
    }

    function setupAgentDrops() {
      const form = document.getElementById('agent-input');
      const panel = document.getElementById('agent-panel');
      const onDrop = files => attachFilesToAgent(files).catch(err => showDropStatus(err.message || String(err), 'error'));
      setupDropTarget(form, { kind: 'any', effect: 'copy', onDrop });
      setupDropTarget(panel, { kind: 'any', effect: 'copy', onDrop });
    }

    function setupStampDrops() {
      const panel = document.getElementById('stamp-builder-panel');
      setupDropTarget(panel, {
        kind: 'model',
        effect: 'copy',
        onDrop(files) {
          const assets = registerDroppedModels(modelBundleFiles(files));
          if (!assets.length) {
            showDropStatus('Drop GLB, GLTF, OBJ, FBX, VOX, or VDB files for Stamps', 'error');
            return;
          }
          selectDroppedModel(assets[0]);
          preloadDroppedModel(assets[0], {
            loadingText: 'Importing ' + (assets[0].label || 'model') + '…',
            readyText: 'Imported ' + (assets[0].label || 'model'),
          });
          if (assets.length > 1) {
            showDropStatus('Importing ' + assets.length + ' model stamps…', 'busy');
            assets.slice(1).forEach(asset => preloadDroppedModel(asset));
          }
        },
      });
    }

    function setupCanvasDrops() {
      const canvas = (typeof renderer !== 'undefined' && renderer) ? renderer.domElement : null;
      setupDropTarget(canvas, {
        kind: 'model',
        effect: 'copy',
        async onDrop(files, evt) {
          const assets = registerDroppedModels(modelBundleFiles(files));
          if (!assets.length) {
            showDropStatus('Drop a GLB, GLTF, OBJ, FBX, VOX, or VDB model on the world', 'error');
            return;
          }
          const target = modelPlacementTarget(evt);
          if (!target) {
            showDropStatus('Pick an editable tile before dropping a model', 'error');
            return;
          }
          const ready = await waitForDroppedModel(assets[0], {
            loadingText: 'Loading ' + (assets[0].label || 'model') + '…',
            readyText: 'Rendered ' + (assets[0].label || 'model'),
          });
          if (!ready) return;
          const placed = placeDroppedModel(assets[0], evt, target);
          showDropStatus(placed ? 'Placed ' + (assets[0].label || 'model') : 'Pick an editable tile before dropping a model', placed ? 'ok' : 'error');
        },
      });
    }

    window.__tinyworldAgentDropAttachments = {
      peek() {
        return agentAttachments.slice();
      },
      clear() {
        agentAttachments = [];
        renderAgentAttachments();
      },
      promptContext(items) {
        const attachments = Array.isArray(items) ? items : agentAttachments;
        if (!attachments.length) return '';
        const lines = ['\n\nAttached file context:'];
        attachments.forEach(item => {
          if (item.type === 'model') {
            lines.push('- Model "' + item.name + '" is already imported. If the user asks to place or use this model, you MUST use this exact modelStampId "' + item.modelStampId + '" in every generated cell representing it: kind:"model-stamp", floors:1, buildingType:null, fenceSide:null, appearance:{ "modelStampId":"' + item.modelStampId + '", "objectScale":1 }. Do not omit appearance.modelStampId, do not invent another model id, and do not substitute a built-in object for this attached model.');
          } else if (item.type === 'image') {
            lines.push('- Image "' + item.name + '" is attached as visual reference. Match its subject, palette, or composition when relevant.');
          }
        });
        return lines.join('\n');
      },
      summaryText(items) {
        const attachments = Array.isArray(items) ? items : agentAttachments;
        if (!attachments.length) return '';
        return attachments.map(item => '[' + (item.type === 'image' ? 'image' : 'model') + ': ' + item.name + ']').join(' ');
      },
      addFiles(files) {
        return attachFilesToAgent(files);
      },
    };

    window.addEventListener('DOMContentLoaded', () => {
      setupAgentDrops();
      setupStampDrops();
      setupCanvasDrops();
      renderAgentAttachments();
    });
  }());
