  // -------- cameras (orthographic + perspective) --------
  const DEFAULT_VIEW_SIZE = 8.2;
  const DEFAULT_CAMERA_MODE = 'perspective';
  const DEFAULT_AZIMUTH = Math.PI * 0.32;
  const DEFAULT_POLAR = Math.PI * 0.30;
  const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);
  const MIN_VIEW_SIZE = 1.55;
  const MAX_VIEW_SIZE_BASE = 64;

  // Persisted camera state — restored on next load, picked up by the
  // dev-side Save Defaults snapshot like any other tinyworld:* key.
  const CAMERA_LS_KEY = 'tinyworld:view.camera';
  function loadStoredCameraState() {
    try {
      const raw = localStorage.getItem(CAMERA_LS_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return null;
      return p;
    } catch (_) { return null; }
  }
  const _storedCamera = loadStoredCameraState();
  let viewSize = (_storedCamera && Number.isFinite(_storedCamera.viewSize))
    ? _storedCamera.viewSize : DEFAULT_VIEW_SIZE;
  let cameraMode = (_storedCamera && (_storedCamera.mode === 'ortho' || _storedCamera.mode === 'perspective'))
    ? _storedCamera.mode : DEFAULT_CAMERA_MODE; // 'ortho' | 'perspective'

  const aspect0 = window.innerWidth / window.innerHeight;
  const orthoCam = new THREE.OrthographicCamera(
    -viewSize * aspect0, viewSize * aspect0,
    viewSize, -viewSize,
    0.1, 200
  );
  const persCam = new THREE.PerspectiveCamera(28, aspect0, 0.1, 200);
  let camera = persCam;

  // orbit state
  let azimuth = (_storedCamera && Number.isFinite(_storedCamera.azimuth))
    ? _storedCamera.azimuth : DEFAULT_AZIMUTH;   // around Y
  let polar   = (_storedCamera && Number.isFinite(_storedCamera.polar))
    ? _storedCamera.polar : DEFAULT_POLAR;       // from +Y axis
  const MIN_ORBIT_POLAR = 0.18;
  const MAX_ORBIT_POLAR = Math.PI - 0.18;
  // Clamp restored polar so we don't load into an invalid orbit pole.
  polar = Math.max(MIN_ORBIT_POLAR, Math.min(MAX_ORBIT_POLAR, polar));
  const target = DEFAULT_TARGET.clone();
  if (_storedCamera && _storedCamera.target && typeof _storedCamera.target === 'object') {
    if (Number.isFinite(_storedCamera.target.x)) target.x = _storedCamera.target.x;
    if (Number.isFinite(_storedCamera.target.y)) target.y = _storedCamera.target.y;
    if (Number.isFinite(_storedCamera.target.z)) target.z = _storedCamera.target.z;
  }
  const panRight = new THREE.Vector3();
  const panForward = new THREE.Vector3();

  function maxViewSize() {
    return Math.max(MAX_VIEW_SIZE_BASE, DEFAULT_VIEW_SIZE * (GRID / HOME_GRID_DEFAULT) * 1.35);
  }

  function clampViewSize(value) {
    return Math.max(MIN_VIEW_SIZE, Math.min(maxViewSize(), value));
  }
  // Now that clamp helpers exist, sanitise the restored zoom.
  viewSize = clampViewSize(viewSize);

  function updateCamera() {
    const r = cameraMode === 'ortho' ? 14 : viewSize * 4.2;
    const isTopdown = cameraMode === 'ortho' && polar < 0.05;
    if (isTopdown) {
      camera.up.set(0, 0, -1);
      camera.position.set(target.x, target.y + r, target.z);
    } else {
      camera.up.set(0, 1, 0);
      camera.position.x = target.x + r * Math.sin(polar) * Math.cos(azimuth);
      camera.position.y = target.y + r * Math.cos(polar);
      camera.position.z = target.z + r * Math.sin(polar) * Math.sin(azimuth);
    }
    camera.lookAt(target);
    if (typeof updateSunFollow === 'function') updateSunFollow();
    if (typeof updateTerrainShadowReceiversForCamera === 'function') updateTerrainShadowReceiversForCamera();
    if (typeof updateSkyBubble === 'function') updateSkyBubble();
    applyDistanceMistSettings();
    scheduleCameraStateSave();
  }

  // Throttled persistence of orbit/zoom/target so the next page load resumes
  // at the same vantage point. Also flows through the Save Defaults snapshot.
  let _cameraSaveTimer = null;
  function scheduleCameraStateSave() {
    if (_cameraSaveTimer) return;
    _cameraSaveTimer = setTimeout(() => {
      _cameraSaveTimer = null;
      try {
        localStorage.setItem(CAMERA_LS_KEY, JSON.stringify({
          mode: cameraMode,
          azimuth: +azimuth.toFixed(4),
          polar: +polar.toFixed(4),
          viewSize: +viewSize.toFixed(3),
          target: {
            x: +target.x.toFixed(3),
            y: +target.y.toFixed(3),
            z: +target.z.toFixed(3),
          },
        }));
      } catch (_) {}
    }, 250);
  }
  // Far-plane ownership during a planet descent (module 54). The far value is
  // only ever set at construction (200) and by the proof view / descent, and
  // nothing in updateCamera/onResize touches it, so writing it here persists.
  // Exposed as a named helper so 54 extends the far plane through the camera
  // module (reversible) instead of hardcoding/clobbering persCam.far elsewhere.
  function setPersCamFarForDescent(far) {
    const next = Number(far);
    if (!Number.isFinite(next) || next <= 0) return;
    persCam.far = next;
    persCam.updateProjectionMatrix();
  }
  function clampTargetToHomeBoard() {
    // Relax the home-board pin while a fly-down descent is active/in progress
    // (window.__flyDownActive, set by module 54) — mirrors the landscape-mesh
    // early-return so the orbit target can travel down to the planet.
    if (renderAutoExpand || isLandscapeMeshActive() || window.__flyDownActive) return false;
    // In a Tinyverse world room the board pins to its edges by default, which
    // blocks panning ACROSS / around the island. Give it generous headroom there
    // so you can freely frame the whole island (still bounded so you can't get
    // lost in the void). The home builder keeps the tight board pin.
    const pad = window.__tinyworldInWorldRoom ? 8 : 0;
    const min = -GRID / 2 + 0.5 - pad;
    const max = GRID / 2 - 0.5 + pad;
    const beforeX = target.x;
    const beforeZ = target.z;
    target.x = Math.max(min, Math.min(max, target.x));
    target.z = Math.max(min, Math.min(max, target.z));
    return Math.abs(target.x - beforeX) > 0.0001 || Math.abs(target.z - beforeZ) > 0.0001;
  }
  function panCameraByPixels(dx, dy) {
    markCameraMoving();
    const scale = (viewSize * 2) / Math.max(1, window.innerHeight);
    camera.updateMatrixWorld();
    panRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    camera.getWorldDirection(panForward);
    panForward.y = 0;
    if (panForward.lengthSq() < 0.001) panForward.set(0, 0, -1);
    panForward.normalize();
    target.addScaledVector(panRight, -dx * scale);
    target.addScaledVector(panForward, dy * scale);
    expandVisibleSizeOnFirstMove();
    updateCamera();
    maybeEnsureGhostBoardsAroundTarget();
    updateLandscapeClipBounds();
    if (typeof requestMinimapRepaint === 'function') requestMinimapRepaint();
  }
  function panCameraByCells(dx, dz) {
    markCameraMoving();
    target.x += dx;
    target.z += dz;
    expandVisibleSizeOnFirstMove();
    updateCamera();
    maybeEnsureGhostBoardsAroundTarget(true);
    updateLandscapeClipBounds();
    if (typeof requestMinimapRepaint === 'function') requestMinimapRepaint();
  }
  clampTargetToHomeBoard();
  updateCamera();

  // -------- lighting --------
  // Three sources stack to give every cell the same look regardless of
  // how far the camera has panned:
  //   1. AmbientLight   — flat minimum fill so shadowed sides never read black.
  //   2. HemisphereLight — soft sky-vs-ground gradient on top of ambient.
  //   3. DirectionalLight (sun) — the only shadow caster. The light's
  //      offset is fixed in world space (so its angle is constant), but
  //      its position and shadow camera follow `target` every frame so
  //      shadows render correctly anywhere on the world, not just near
  //      the home board origin.
  // Low ambient floor — just enough so shadowed sides aren't pitch black.
  const ambient = new THREE.AmbientLight(0xffffff, 0.06);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xb39879, 0.30);
  scene.add(hemi);

  const fillTarget = new THREE.Object3D();
  scene.add(fillTarget);
  function makeFillLight(offset) {
    const light = new THREE.DirectionalLight(0xffffff, 0);
    light.position.copy(target).add(offset);
    light.target = fillTarget;
    light.castShadow = false;
    scene.add(light);
    return light;
  }
  const FRONT_FILL_OFFSET = new THREE.Vector3(-6, 5, 8);
  const SIDE_FILL_OFFSET_A = new THREE.Vector3(-9, 4, -1);
  const SIDE_FILL_OFFSET_B = new THREE.Vector3(9, 4, 1);
  const BACK_FILL_OFFSET = new THREE.Vector3(4, 5, -9);
  const frontFill = makeFillLight(FRONT_FILL_OFFSET);
  const sideFillA = makeFillLight(SIDE_FILL_OFFSET_A);
  const sideFillB = makeFillLight(SIDE_FILL_OFFSET_B);
  const backFill = makeFillLight(BACK_FILL_OFFSET);
  frontFill.color.setHex(0xffe3bf);
  sideFillA.color.setHex(0xcfe6ff);
  sideFillB.color.setHex(0xd9ecff);
  backFill.color.setHex(0xb8ccff);

  // Imported GLB/PBR assets can arrive with no usable indirect lighting. This
  // non-shadowing safety fill adapts the user-supplied Mugen87 StackOverflow
  // ambient + directional baseline (CC BY-SA 4.0) into the existing stack.
  const MODEL_STAMP_IMPORT_AMBIENT_BASE = 0.30;
  const MODEL_STAMP_IMPORT_DIRECTIONAL_BASE = 0.30;
  const MODEL_STAMP_IMPORT_LIGHT_OFFSET = new THREE.Vector3(10, 10, 10);
  var modelStampImportAmbientFill = new THREE.AmbientLight(0xffffff, 0);
  modelStampImportAmbientFill.name = 'model-stamp-import-ambient-fill';
  scene.add(modelStampImportAmbientFill);
  var modelStampImportDirFill = new THREE.DirectionalLight(0xefefff, 0);
  modelStampImportDirFill.name = 'model-stamp-import-directional-fill';
  modelStampImportDirFill.position.copy(target).add(MODEL_STAMP_IMPORT_LIGHT_OFFSET);
  modelStampImportDirFill.target = fillTarget;
  modelStampImportDirFill.castShadow = false;
  scene.add(modelStampImportDirFill);

  // Fixed sun direction relative to the camera target — same angle of
  // attack everywhere on the map.
  // Lower y → flatter sun angle → longer, more visible shadows.
  const SUN_OFFSET = new THREE.Vector3(8, 9, 6);
  const sun = new THREE.DirectionalLight(0xffffff, 1.35);
  sun.position.copy(target).add(SUN_OFFSET);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  // Shadow frustum sized to comfortably cover the visible window plus a
  // ring of ghost cells in every direction.
  const SHADOW_HALF = 20;
  sun.shadow.camera.left   = -SHADOW_HALF;
  sun.shadow.camera.right  =  SHADOW_HALF;
  sun.shadow.camera.top    =  SHADOW_HALF;
  sun.shadow.camera.bottom = -SHADOW_HALF;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 60;
  // Keep shadow offsets tight for small voxel pieces. Larger normalBias/radius
  // values reduce acne, but they also detach shadows from thin roofs, columns,
  // crop stems, and voxel trim so the sun appears to leak through edges.
  sun.shadow.bias = -0.00018;
  sun.shadow.normalBias = 0.007;
  sun.shadow.radius = 2.5;
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.copy(target);
  sun.target.updateMatrixWorld();

  // Keep the sun glued to the camera target so shadows are always
  // rendered around what the user is looking at. Declared as a `var`
  // assignment (hoisted to `undefined`) so updateCamera() — which may
  // be called before the lighting block has run — sees a falsy value
  // for `typeof` and skips the call safely.
  var updateSunFollow = function () {
    // Fixed sun direction in WORLD space — shadows cast from the same
    // angle regardless of how the camera is orbited or panned.  The sun
    // position translates with the target only so the shadow camera's
    // frustum (SHADOW_HALF wide) always covers what the user is looking
    // at; without that follow, panning past the home grid drops shadows
    // for everything outside the original frustum — that's the
    // "shadows don't appear all the time" report.
    sun.position.set(
      target.x + SUN_OFFSET.x,
      target.y + SUN_OFFSET.y,
      target.z + SUN_OFFSET.z,
    );
    sun.target.position.set(target.x, target.y, target.z);
    sun.target.updateMatrixWorld();
    fillTarget.position.set(target.x, target.y, target.z);
    fillTarget.updateMatrixWorld();
    frontFill.position.copy(target).add(FRONT_FILL_OFFSET);
    sideFillA.position.copy(target).add(SIDE_FILL_OFFSET_A);
    sideFillB.position.copy(target).add(SIDE_FILL_OFFSET_B);
    backFill.position.copy(target).add(BACK_FILL_OFFSET);
    modelStampImportDirFill.position.copy(target).add(MODEL_STAMP_IMPORT_LIGHT_OFFSET);
    // The shadow camera frustum constants are fixed; its projection matrix is
    // recomputed in setShadowQuality(). Recomputing it on every orbit/pan
    // frame here was pure waste — only the light *position* follows target.
  };

  function applyLightingSettings() {
    // Sun controls shadow direction and contrast. Fill lights are non-shadowing
    // so dark faces can be lifted without flattening the diorama into CSS
    // brightness.
    sun.intensity = 0.62 + renderLighting * 0.58;
    hemi.intensity = 0.08 + renderAmbientFill * 0.20;
    ambient.intensity = 0.025 + renderAmbientFill * 0.105;
    frontFill.intensity = renderFrontFill * 0.28;
    sideFillA.intensity = renderSideFill * 0.13;
    sideFillB.intensity = renderSideFill * 0.13;
    backFill.intensity = renderBackFill * 0.20;
    modelStampImportAmbientFill.intensity = MODEL_STAMP_IMPORT_AMBIENT_BASE * renderAmbientFill;
    modelStampImportDirFill.intensity = MODEL_STAMP_IMPORT_DIRECTIONAL_BASE * renderLighting;
  }

  function setShadowQuality(value) {
    renderShadowQuality = ['low', 'balanced', 'high'].includes(value) ? value : 'balanced';
    const size = renderShadowQuality === 'high' ? 2048 : (renderShadowQuality === 'low' ? 512 : 1024);
    sun.shadow.mapSize.set(size, size);
    // Use filtered shadows at every quality level. BasicShadowMap makes the
    // low-poly/isometric shadows stair-step harshly, especially in pixel mode.
    sun.shadow.radius = renderShadowQuality === 'high' ? 4 : (renderShadowQuality === 'low' ? 1.25 : 2.5);
    renderer.shadowMap.type = renderShadowQuality === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.needsUpdate = true;
    if (typeof window.requestShadowMapUpdate === 'function') window.requestShadowMapUpdate();
  }
  setShadowQuality(renderShadowQuality);
  applyLightingSettings();
  // applyCloudSettings() deferred to engine/world/99-late-boot.js — the cloud
  // system (module 23) hasn't loaded yet; calling it here was a guarded no-op
  // in the original single-script build and now throws on the forward ref.
  applyTiltShiftSettings();
