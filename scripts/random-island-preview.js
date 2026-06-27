(function () {
  'use strict';

  const CONTROL_SOURCE = 'tinyworld-random-island-preview-control';
  const APP_SOURCE = 'tinyworld-random-island-preview';
  const ARCHETYPES = ['pastoral', 'forest', 'quarry', 'river', 'village', 'fortress', 'ruins', 'harbor'];
  const state = {
    ready: false,
    pendingExport: null,
    pendingLoad: null,
    current: null,
  };

  const el = {
    form: document.getElementById('rip-controls'),
    archetype: document.getElementById('rip-archetype'),
    gridSize: document.getElementById('rip-grid-size'),
    seed: document.getElementById('rip-seed'),
    saveReveal: document.getElementById('rip-save-reveal'),
    saveWorld: document.getElementById('rip-save-world'),
    loadButton: document.getElementById('rip-load-button'),
    loadFile: document.getElementById('rip-load-file'),
    status: document.getElementById('rip-status'),
    frame: document.getElementById('rip-frame'),
  };

  function randomChoice(values) {
    return values[Math.floor(Math.random() * values.length)];
  }

  function randomIslandSeed() {
    const labels = ['mossbridge', 'stonefall', 'cloverdock', 'pinewatch', 'saltmeadow', 'relicshoal', 'lanternbay', 'crownmeadow'];
    const n = Math.floor(Math.random() * 90000) + 10000;
    return randomChoice(labels) + '-' + n;
  }

  function slug(value) {
    const clean = String(value || 'island').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return clean || 'island';
  }

  function setStatus(text) {
    el.status.textContent = text || '';
  }

  function selectedArchetype() {
    const value = el.archetype.value;
    return value || 'random';
  }

  function frameUrl(seed, archetype, gridSize) {
    const params = new URLSearchParams();
    params.set('randomIslandPreview', '1');
    params.set('randomIslandSeed', seed);
    params.set('randomIslandArchetype', archetype);
    params.set('randomIslandGrid', String(gridSize));
    params.set('randomIslandNonce', String(Date.now()) + '-' + Math.floor(Math.random() * 1000000));
    params.set('ai', '0');
    return '/tiny-world-builder?' + params.toString();
  }

  function postToFrame(message) {
    if (!el.frame || !el.frame.contentWindow) return;
    el.frame.contentWindow.postMessage(Object.assign({ source: CONTROL_SOURCE }, message), window.location.origin);
  }

  function requestExport(kind) {
    state.pendingExport = kind;
    postToFrame({ command: 'export' });
  }

  function downloadJson(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 200);
  }

  function saveCurrent(kind, current) {
    if (!current || !current.world) {
      setStatus('The rendered island is not ready yet.');
      return;
    }
    const profile = current.profile || {};
    const name = profile.name || 'island';
    if (kind === 'world') {
      downloadJson('tinyworld-world-' + slug(name) + '.json', current.world);
      setStatus('Saved game JSON from the real rendered island.');
      return;
    }
    downloadJson('tinyworld-island-' + slug(name) + '-reveal.json', {
      type: 'tinyworld.randomIslandReveal',
      version: 1,
      savedAt: new Date().toISOString(),
      seed: current.seed || '',
      archetype: current.archetype || '',
      world: current.world,
      profile,
    });
    setStatus('Saved island reveal file from the real rendered island.');
  }

  function generateIsland() {
    el.archetype.value = 'random';
    const archetype = selectedArchetype();
    const gridSize = Number(el.gridSize.value || 8);
    const seed = randomIslandSeed();
    el.seed.value = seed;
    state.ready = false;
    state.current = null;
    state.pendingLoad = null;
    setStatus(archetype === 'random'
      ? 'Rendering a random island in TinyWorld...'
      : 'Rendering ' + archetype + ' island in TinyWorld...');
    el.frame.src = frameUrl(seed, archetype, gridSize);
  }

  function loadPayload(payload) {
    if (!state.ready) {
      state.pendingLoad = payload;
      return;
    }
    postToFrame({ command: 'load', payload });
    setStatus('Loading island into the TinyWorld renderer...');
  }

  function readSelectedFile(file) {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        loadPayload(JSON.parse(String(reader.result || '')));
      } catch (err) {
        console.error(err);
        setStatus(err && err.message ? err.message : 'Could not load island file.');
      }
    };
    reader.onerror = function () {
      setStatus('Could not read island file.');
    };
    reader.readAsText(file);
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;
    const msg = event.data || {};
    if (!msg || msg.source !== APP_SOURCE) return;
    if (msg.type === 'error') {
      if (msg.state) {
        state.ready = true;
        state.current = msg.state;
      }
      setStatus(msg.message || 'TinyWorld renderer reported an error.');
      return;
    }
    if (msg.type === 'ready' || msg.type === 'state') {
      state.ready = true;
      state.current = msg.state || state.current;
      const profile = state.current && state.current.profile;
      if (profile && profile.name) setStatus('Viewing ' + profile.name + ' in the real TinyWorld renderer.');
      else setStatus('TinyWorld renderer is ready.');
      if (state.pendingLoad) {
        const pending = state.pendingLoad;
        state.pendingLoad = null;
        loadPayload(pending);
        return;
      }
      if (state.pendingExport) {
        const kind = state.pendingExport;
        state.pendingExport = null;
        saveCurrent(kind, state.current);
      }
    }
  });

  el.form.addEventListener('submit', function (event) {
    event.preventDefault();
    generateIsland();
  });
  el.saveReveal.addEventListener('click', function () {
    requestExport('reveal');
  });
  el.saveWorld.addEventListener('click', function () {
    requestExport('world');
  });
  el.loadButton.addEventListener('click', function () {
    el.loadFile.click();
  });
  el.loadFile.addEventListener('change', function () {
    const file = el.loadFile.files && el.loadFile.files[0];
    if (file) readSelectedFile(file);
    el.loadFile.value = '';
  });

  el.seed.value = randomIslandSeed();
  generateIsland();
})();
