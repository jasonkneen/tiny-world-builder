  // -------- window light system (extracted from 10-world-data.js) --------
  // Building window glow + night-time lit windows. Depends on M (materials),
  // buildingWindowBaseMaterials, buildingWindowObjects, cellRand, and
  // currentTodMinutes — all defined in earlier modules via the shared global scope.

  function windowLightProbability(min) {
    if (min >= 1080 && min < 1260) return 0.36; // dusk: some lights pop on
    if (min >= 1260 || min < 60) return 0.68;   // evening / just after midnight
    if (min < 360) return 0.24;                 // late night: most are off
    return 0;
  }
  function windowLightRand(seed, bucket) {
    const n = Math.sin((seed + 1) * 127.1 + (bucket + 1) * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }
  const windowLightTmpWorld = new THREE.Vector3();
  const windowLightTmpLocal = new THREE.Vector3();
  const windowLightTmpSize = new THREE.Vector3();
  function orientWindowGlowPlane(mesh, normal) {
    if (!mesh || !normal) return;
    if (Math.abs(normal.x) > Math.abs(normal.z)) {
      mesh.rotation.y = normal.x > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else if (normal.z < 0) {
      mesh.rotation.y = Math.PI;
    }
  }
  function createWindowLightEffects(root, node) {
    if (!root || !node || node.userData.windowLightEffects) return;
    const geo = node.geometry;
    if (!geo) return;
    if (!geo.boundingBox && geo.computeBoundingBox) geo.computeBoundingBox();
    if (!geo.boundingBox) return;
    geo.boundingBox.getSize(windowLightTmpSize);
    root.updateMatrixWorld(true);
    node.updateMatrixWorld(true);
    node.getWorldPosition(windowLightTmpWorld);
    windowLightTmpLocal.copy(windowLightTmpWorld);
    root.worldToLocal(windowLightTmpLocal);
    const local = windowLightTmpLocal.clone();
    const size = windowLightTmpSize.clone();
    const xFacing = size.x <= size.z && size.x <= size.y;
    const normal = xFacing
      ? new THREE.Vector3(local.x >= 0 ? 1 : -1, 0, 0)
      : new THREE.Vector3(0, 0, local.z >= 0 ? 1 : -1);
    const windowW = Math.max(0.10, xFacing ? size.z : size.x);
    const windowH = Math.max(0.10, size.y);
    const effects = [];

    const length = Math.max(0.82, Math.min(1.45, windowH * 4.2));
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(windowW * 2.8, length), M.windowGroundGlow);
    spill.rotation.x = -Math.PI / 2;
    spill.rotation.z = Math.atan2(normal.x, normal.z);
    spill.position.set(local.x + normal.x * length * 0.38, 0.032, local.z + normal.z * length * 0.38);
    spill.visible = false;
    spill.renderOrder = 4;
    spill.userData.noShadow = true;
    spill.userData.windowLightEffect = true;
    root.add(spill);
    effects.push(spill);

    const halo = new THREE.Sprite(M.windowHalo);
    halo.position.set(local.x + normal.x * 0.045, local.y, local.z + normal.z * 0.045);
    halo.scale.set(windowW * 2.2, windowH * 2.0, 1);
    halo.visible = false;
    halo.renderOrder = 6;
    halo.userData.noShadow = true;
    halo.userData.windowLightEffect = true;
    root.add(halo);
    effects.push(halo);

    node.userData.windowLightEffects = effects;
  }
  function prepareBuildingWindowLights(root, x, z) {
    if (!root || !root.traverse) return;
    let i = 0;
    const windows = [];
    root.traverse(node => {
      if (!node.isMesh || !buildingWindowBaseMaterials.has(node.material)) return;
      node.userData.windowLightBase = node.material;
      node.userData.windowLightSeed = cellRand(x, z, 700 + i++);
      windows.push(node);
    });
    for (const node of windows) createWindowLightEffects(root, node);
    updateBuildingWindowLights(root);
  }
  function updateBuildingWindowLights(root) {
    if (!root || !root.traverse) return;
    const prob = windowLightProbability(currentTodMinutes);
    const bucket = Math.floor(currentTodMinutes / 24);
    const nightGlass = prob > 0 && (currentTodMinutes >= 1080 || currentTodMinutes < 480);
    root.traverse(node => {
      if (!node.isMesh || !node.userData.windowLightBase) return;
      const on = prob > 0 && windowLightRand(node.userData.windowLightSeed || 0, bucket) < prob;
      node.material = on ? M.windowLit : (nightGlass ? M.windowNight : node.userData.windowLightBase);
      if (node.userData.windowLightEffects) {
        for (const effect of node.userData.windowLightEffects) {
          if (effect) effect.visible = on;
        }
      }
    });
  }
  function updateAllBuildingWindowLights() {
    for (const obj of buildingWindowObjects) {
      if (!obj || !obj.parent) buildingWindowObjects.delete(obj);
      else updateBuildingWindowLights(obj);
    }
  }
