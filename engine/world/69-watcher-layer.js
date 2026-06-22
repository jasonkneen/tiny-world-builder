  // -------- watcher visual layer --------
  (function () {
    const WATCHER_SOURCE_URL = 'engine/world/assets/god-face_15.html';
    const WATCHER_OWNER_EMAILS = ['jason@bouncingfish.com', 'jason.kneen@bouncingfish.com', 'jason.kneen@gmail.com'];
    const WATCHER_LS = {
      enabled: 'tinyworld:watcher:enabled',
      size: 'tinyworld:watcher:size',
      faceWidth: 'tinyworld:watcher:faceWidth',
      faceHeight: 'tinyworld:watcher:faceHeight',
      posX: 'tinyworld:watcher:posX',
      posY: 'tinyworld:watcher:posY',
      posZ: 'tinyworld:watcher:posZ',
      tilt: 'tinyworld:watcher:tilt',
      zoom: 'tinyworld:watcher:zoom',
      smooth: 'tinyworld:watcher:smooth',
      faceOpacity: 'tinyworld:watcher:faceOpacity',
      handOpacity: 'tinyworld:watcher:handOpacity',
      cloudOpacity: 'tinyworld:watcher:cloudOpacity',
    };
    const watcherDefaults = {
      enabled: false,
      faceSize: 1.5,
      faceWidth: 1.15,
      faceHeight: 1,
      posX: 0,
      posY: 7,
      posZ: -28,
      tilt: 40,
      zoom: 1.4,
      smooth: 0,
      faceOpacity: 0.09,
      handOpacity: 0.4,
      cloudOpacity: 1,
    };
    const watcherSettings = Object.assign({}, watcherDefaults);
    const FACE_PTS = 468;
    const FACE_SCALE = 34;
    const FACE_CELL = 0.16;
    const FACE_SHELL = 1;
    const FACE_MAX_CUBES = 220000;
    const HAND_PTS = 21;
    const HAND_SCALE = 30;
    const HAND_VOX = 0.32;
    const HAND_SOURCE_Z = -16;
    const HAND_Y = 4;
    const HAND_BONES = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [5,9],[9,10],[10,11],[11,12],
      [9,13],[13,14],[14,15],[15,16],
      [13,17],[17,18],[18,19],[19,20],
      [0,17],
    ];
    const TIP_IDX = [4, 8, 12, 16, 20];
    const MAX_BONE_CUBES = 22000;
    const HAND_CELL = HAND_VOX;
    const FINGER_R = 0.6;
    const BONE_STEP = FINGER_R * 0.5;
    const WATCHER_SCENE_SCALE = 0.3;
    const WATCHER_FRAME_MS = 1000 / 24;
    const WATCHER_BROADCAST_MS = 220;
    const WATCHER_REMOTE_TIMEOUT = 3500;
    const watcherCross = [];
    const watcherM = new THREE.Matrix4();
    const watcherV = new THREE.Vector3();
    const watcherFaceLandmarks = new Float32Array(FACE_PTS * 3);
    const watcherFaceCols = new Map();
    const watcherHandCells = new Map();
    const watcherLocalJoints = Array.from({ length: HAND_PTS }, () => new THREE.Vector3());
    const watcherFlatScratch = [];
    let watcherFaceTris = null;
    let watcherFaceTrisPromise = null;
    let watcherVisionPromise = null;
    let watcherFaceLM = null;
    let watcherHandLM = null;
    let watcherVideo = null;
    let watcherRunning = false;
    let watcherTracking = false;
    let watcherFaceSmooth = null;
    let watcherRoot = null;
    let watcherContent = null;
    let watcherFaceGroup = null;
    let watcherCloudGroup = null;
    let watcherFaceVox = null;
    let watcherFaceVoxMat = null;
    let watcherHands = [];
    let watcherClouds = [];
    let watcherLastTrack = 0;
    let watcherLastBroadcast = 0;
    let watcherRemote = null;
    let watcherStatusEl = null;
    let watcherStartBtn = null;
    let watcherInitialized = false;
    let watcherSelfId = '';

    {
      const r = Math.max(1, Math.round(FINGER_R / HAND_CELL));
      const r2 = (r + 0.4) * (r + 0.4);
      for (let ox = -r; ox <= r; ox++) {
        for (let oy = -r; oy <= r; oy++) {
          for (let oz = -r; oz <= r; oz++) {
            if (ox * ox + oy * oy + oz * oz <= r2) watcherCross.push([ox, oy, oz]);
          }
        }
      }
    }

    function watcherLocalDevAllowed() {
      try {
        const h = location.hostname;
        return location.protocol === 'file:' || h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.endsWith('.local');
      } catch (_) {
        return false;
      }
    }

    function watcherOwnerAllowed() {
      if (window.__tinyworldOwnerToolsAreAllowed) return true;
      try {
        const test = typeof getTestUser === 'function' ? getTestUser() : null;
        if (test && test.loggedIn && (test.isAdmin || WATCHER_OWNER_EMAILS.indexOf(String(test.email || '').trim().toLowerCase()) !== -1)) return true;
      } catch (_) {}
      return watcherLocalDevAllowed();
    }

    function watcherBuildModeAllowed() {
      try {
        if (window.__tinyworldIsPlayMode && window.__tinyworldIsPlayMode()) return false;
      } catch (_) {}
      return !document.body.classList.contains('tw-play-mode') && !document.body.classList.contains('tw-worlds-play');
    }

    function watcherControlsAllowed() {
      return watcherOwnerAllowed() && watcherBuildModeAllowed();
    }

    function watcherToNum(v, fallback, min, max) {
      const n = Number(v);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    }

    function watcherLoadSettings() {
      try {
        watcherSettings.enabled = localStorage.getItem(WATCHER_LS.enabled) === '1';
        watcherSettings.faceSize = watcherToNum(localStorage.getItem(WATCHER_LS.size), watcherSettings.faceSize, 0.6, 12);
        watcherSettings.faceWidth = watcherToNum(localStorage.getItem(WATCHER_LS.faceWidth), watcherSettings.faceWidth, 0.5, 2.5);
        watcherSettings.faceHeight = watcherToNum(localStorage.getItem(WATCHER_LS.faceHeight), watcherSettings.faceHeight, 0.5, 2.5);
        watcherSettings.posX = watcherToNum(localStorage.getItem(WATCHER_LS.posX), watcherSettings.posX, -80, 80);
        watcherSettings.posY = watcherToNum(localStorage.getItem(WATCHER_LS.posY), watcherSettings.posY, -20, 80);
        watcherSettings.posZ = watcherToNum(localStorage.getItem(WATCHER_LS.posZ), watcherSettings.posZ, -120, 80);
        watcherSettings.tilt = watcherToNum(localStorage.getItem(WATCHER_LS.tilt), watcherSettings.tilt, -45, 45);
        watcherSettings.zoom = watcherToNum(localStorage.getItem(WATCHER_LS.zoom), watcherSettings.zoom, 0.6, 8);
        watcherSettings.smooth = watcherToNum(localStorage.getItem(WATCHER_LS.smooth), watcherSettings.smooth, 0, 0.95);
        watcherSettings.faceOpacity = watcherToNum(localStorage.getItem(WATCHER_LS.faceOpacity), watcherSettings.faceOpacity, 0.03, 1);
        watcherSettings.handOpacity = watcherToNum(localStorage.getItem(WATCHER_LS.handOpacity), watcherSettings.handOpacity, 0.03, 1);
        watcherSettings.cloudOpacity = watcherToNum(localStorage.getItem(WATCHER_LS.cloudOpacity), watcherSettings.cloudOpacity, 0, 1);
      } catch (_) {}
    }

    function watcherSave(key, value) {
      try { localStorage.setItem(key, String(value)); } catch (_) {}
    }

    function watcherCloneSettings(settings) {
      const src = settings || watcherSettings;
      return {
        faceSize: watcherToNum(src.faceSize, watcherDefaults.faceSize, 0.6, 12),
        faceWidth: watcherToNum(src.faceWidth, watcherDefaults.faceWidth, 0.5, 2.5),
        faceHeight: watcherToNum(src.faceHeight, watcherDefaults.faceHeight, 0.5, 2.5),
        posX: watcherToNum(src.posX, watcherDefaults.posX, -80, 80),
        posY: watcherToNum(src.posY, watcherDefaults.posY, -20, 80),
        posZ: watcherToNum(src.posZ, watcherDefaults.posZ, -120, 80),
        tilt: watcherToNum(src.tilt, watcherDefaults.tilt, -45, 45),
        zoom: watcherToNum(src.zoom, watcherDefaults.zoom, 0.6, 8),
        smooth: watcherToNum(src.smooth, watcherDefaults.smooth, 0, 0.95),
        faceOpacity: watcherToNum(src.faceOpacity, watcherDefaults.faceOpacity, 0.03, 1),
        handOpacity: watcherToNum(src.handOpacity, watcherDefaults.handOpacity, 0.03, 1),
        cloudOpacity: watcherToNum(src.cloudOpacity, watcherDefaults.cloudOpacity, 0, 1),
      };
    }

    function watcherSetStatus(text) {
      if (watcherStatusEl) watcherStatusEl.textContent = text || '';
    }

    async function watcherLoadSourceFaceTris() {
      if (watcherFaceTris) return watcherFaceTris;
      if (watcherFaceTrisPromise) return watcherFaceTrisPromise;
      watcherFaceTrisPromise = fetch(WATCHER_SOURCE_URL)
        .then(res => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        })
        .then(text => {
          const m = text.match(/const\s+FACE_TRIS\s*=\s*\[([\s\S]*?)\];/);
          if (!m) throw new Error('FACE_TRIS not found in watcher source');
          watcherFaceTris = m[1].split(',').map(s => parseInt(s, 10)).filter(n => Number.isFinite(n));
          if (!watcherFaceTris.length) throw new Error('FACE_TRIS was empty');
          return watcherFaceTris;
        });
      return watcherFaceTrisPromise;
    }

    function watcherEnsureVideo() {
      if (watcherVideo) return watcherVideo;
      watcherVideo = document.createElement('video');
      watcherVideo.id = 'watcher-cam';
      watcherVideo.autoplay = true;
      watcherVideo.muted = true;
      watcherVideo.playsInline = true;
      watcherVideo.className = 'watcher-cam-probe';
      document.body.appendChild(watcherVideo);
      return watcherVideo;
    }

    async function watcherInitVision() {
      if (watcherVisionPromise) return watcherVisionPromise;
      watcherVisionPromise = (async () => {
        watcherSetStatus('loading watcher source...');
        await watcherLoadSourceFaceTris();
        watcherSetStatus('loading MediaPipe...');
        const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/vision_bundle.mjs');
        const fileset = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm');
        watcherFaceLM = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        watcherHandLM = await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });
        watcherSetStatus('requesting camera...');
        const video = watcherEnsureVideo();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
        video.srcObject = stream;
        await new Promise(resolve => { video.onloadedmetadata = resolve; });
        await video.play();
        watcherSetStatus('watcher live');
      })();
      return watcherVisionPromise;
    }

    function watcherDisposeOwnedObject(obj) {
      if (!obj) return;
      obj.traverse(node => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach(mat => { if (mat.map) mat.map.dispose(); mat.dispose(); });
        }
      });
    }

    function watcherCloudTexture() {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    }

    function watcherMakeHand() {
      const group = new THREE.Group();
      const boneGeo = new THREE.BoxGeometry(HAND_VOX, HAND_VOX, HAND_VOX);
      const boneMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.7,
        metalness: 0,
        transparent: true,
        opacity: watcherSettings.handOpacity,
        depthWrite: false,
        depthTest: true,
      });
      const bones = new THREE.InstancedMesh(boneGeo, boneMat, MAX_BONE_CUBES);
      bones.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      bones.count = 0;
      group.add(bones);
      const joints = Array.from({ length: HAND_PTS }, () => new THREE.Vector3());
      group.visible = false;
      watcherContent.add(group);
      return { group, bones, joints, present: false, smooth: null, targetPos: new THREE.Vector3() };
    }

    function watcherEnsureScene() {
      if (watcherRoot) return;
      watcherRoot = new THREE.Group();
      watcherRoot.name = 'watcher-visual-layer';
      watcherRoot.visible = false;
      scene.add(watcherRoot);
      watcherContent = new THREE.Group();
      watcherContent.name = 'watcher-content';
      watcherRoot.add(watcherContent);
      watcherFaceGroup = new THREE.Group();
      watcherContent.add(watcherFaceGroup);
      watcherFaceVoxMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.7,
        metalness: 0,
        transparent: true,
        opacity: watcherSettings.faceOpacity,
        depthWrite: false,
        depthTest: true,
      });
      const faceVoxGeo = new THREE.BoxGeometry(FACE_CELL, FACE_CELL, FACE_CELL);
      watcherFaceVox = new THREE.InstancedMesh(faceVoxGeo, watcherFaceVoxMat, FACE_MAX_CUBES);
      watcherFaceVox.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      watcherFaceVox.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FACE_MAX_CUBES * 3), 3);
      watcherFaceVox.instanceColor.setUsage(THREE.DynamicDrawUsage);
      watcherFaceVox.count = 0;
      watcherFaceGroup.add(watcherFaceVox);
      watcherHands = [watcherMakeHand(), watcherMakeHand()];
      watcherCloudGroup = new THREE.Group();
      watcherRoot.add(watcherCloudGroup);
      const tex = watcherCloudTexture();
      for (let i = 0; i < 16; i++) {
        const mat = new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          opacity: 0.12 + Math.random() * 0.15,
          depthWrite: false,
          depthTest: true,
          fog: false,
        });
        const spr = new THREE.Sprite(mat);
        spr.userData.baseOpacity = mat.opacity;
        spr.userData.speed = 0.6 + Math.random() * 1.3;
        const s = 8 + Math.random() * 18;
        spr.scale.set(s, s * 0.55, 1);
        spr.position.set((Math.random() - 0.5) * 28, -2 + Math.random() * 14, -30 - Math.random() * 18);
        watcherCloudGroup.add(spr);
        watcherClouds.push(spr);
      }
    }

    function watcherPoint(lm, i) {
      if (!lm) return { x: 0.5, y: 0.5, z: 0 };
      if (Array.isArray(lm) && typeof lm[i] === 'object') return lm[i];
      const o = i * 3;
      return { x: Number(lm[o]) || 0.5, y: Number(lm[o + 1]) || 0.5, z: Number(lm[o + 2]) || 0 };
    }

    function watcherFaceAddColumn(x, y, z) {
      const gx = Math.round(x / FACE_CELL);
      const gy = Math.round(y / FACE_CELL);
      const gz = Math.round(z / FACE_CELL);
      const key = gx + ',' + gy;
      const c = watcherFaceCols.get(key);
      if (!c) watcherFaceCols.set(key, [gz, gz, gx, gy]);
      else {
        if (gz < c[0]) c[0] = gz;
        if (gz > c[1]) c[1] = gz;
      }
    }

    function watcherRebuildFaceVoxels(lm) {
      if (!watcherFaceVox || !watcherFaceTris) return;
      watcherFaceCols.clear();
      for (let i = 0; i < FACE_PTS; i++) {
        const p = watcherPoint(lm, i);
        const x = -(p.x - 0.5) * FACE_SCALE;
        const y = -(p.y - 0.5) * FACE_SCALE;
        const z = -p.z * FACE_SCALE * 1.6;
        const o = i * 3;
        watcherFaceLandmarks[o] = x;
        watcherFaceLandmarks[o + 1] = y;
        watcherFaceLandmarks[o + 2] = z;
        watcherFaceAddColumn(x, y, z);
      }
      const F = watcherFaceLandmarks;
      for (let t = 0; t < watcherFaceTris.length; t += 3) {
        const A = watcherFaceTris[t], B = watcherFaceTris[t + 1], C = watcherFaceTris[t + 2];
        const ia = A * 3, ib = B * 3, ic = C * 3;
        const ax = F[ia], ay = F[ia + 1], az = F[ia + 2];
        const bx = F[ib], by = F[ib + 1], bz = F[ib + 2];
        const cx = F[ic], cy = F[ic + 1], cz = F[ic + 2];
        const eMax = Math.max(
          Math.hypot(bx - ax, by - ay, bz - az),
          Math.hypot(cx - ax, cy - ay, cz - az),
          Math.hypot(cx - bx, cy - by, cz - bz)
        );
        const N = Math.max(1, Math.ceil(eMax / FACE_CELL));
        const inv = 1 / N;
        for (let i = 0; i <= N; i++) {
          for (let j = 0; j <= N - i; j++) {
            const u = i * inv, w = j * inv;
            watcherFaceAddColumn(
              ax + (bx - ax) * u + (cx - ax) * w,
              ay + (by - ay) * u + (cy - ay) * w,
              az + (bz - az) * u + (cz - az) * w
            );
          }
        }
      }
      const shellCells = Math.max(2, Math.round(FACE_SHELL / FACE_CELL));
      let count = 0;
      for (const [, c] of watcherFaceCols) {
        const minGz = c[0], maxGz = c[1], gx = c[2], gy = c[3];
        const span = maxGz - minGz;
        const depth = Math.min(span, shellCells);
        for (let d = 0; d <= depth; d++) {
          if (count >= FACE_MAX_CUBES) break;
          const gz = maxGz - d;
          watcherM.makeTranslation(gx * FACE_CELL, gy * FACE_CELL, gz * FACE_CELL);
          watcherFaceVox.setMatrixAt(count, watcherM);
          watcherFaceVox.instanceColor.setXYZ(count, 1, 1, 1);
          count++;
        }
        if (count >= FACE_MAX_CUBES) break;
      }
      watcherFaceVox.count = count;
      watcherFaceVox.instanceMatrix.needsUpdate = true;
      watcherFaceVox.instanceColor.needsUpdate = true;
    }

    function watcherRebuildHandVoxels(hand, localJoints) {
      watcherHandCells.clear();
      for (const [a, b] of HAND_BONES) {
        const pa = localJoints[a], pb = localJoints[b];
        const dist = pa.distanceTo(pb);
        const steps = Math.max(1, Math.ceil(dist / BONE_STEP));
        for (let s = 0; s <= steps; s++) {
          watcherV.lerpVectors(pa, pb, s / steps);
          const cx = Math.round(watcherV.x / HAND_CELL);
          const cy = Math.round(watcherV.y / HAND_CELL);
          const cz = Math.round(watcherV.z / HAND_CELL);
          for (const [ox, oy, oz] of watcherCross) {
            watcherHandCells.set((cx + ox) + ',' + (cy + oy) + ',' + (cz + oz), 1);
          }
        }
      }
      let c = 0;
      for (const key of watcherHandCells.keys()) {
        if (c >= MAX_BONE_CUBES) break;
        const parts = key.split(',');
        watcherM.makeTranslation(Number(parts[0]) * HAND_CELL, Number(parts[1]) * HAND_CELL, Number(parts[2]) * HAND_CELL);
        hand.bones.setMatrixAt(c++, watcherM);
      }
      hand.bones.count = c;
      hand.bones.instanceMatrix.needsUpdate = true;
    }

    function watcherFlatLandmarks(lm, count) {
      watcherFlatScratch.length = 0;
      const n = Math.min(count, lm && lm.length ? lm.length : 0);
      for (let i = 0; i < n; i++) {
        const p = lm[i];
        watcherFlatScratch.push(
          Math.round(Number(p.x || 0) * 10000) / 10000,
          Math.round(Number(p.y || 0) * 10000) / 10000,
          Math.round(Number(p.z || 0) * 10000) / 10000
        );
      }
      return watcherFlatScratch.slice();
    }

    function watcherApplyHandLandmarks(hand, lm, first) {
      if (!hand || !lm || lm.length < HAND_PTS * 3) {
        if (hand) { hand.group.visible = false; hand.present = false; }
        return;
      }
      let cx = 0, cy = 0;
      for (let i = 0; i < HAND_PTS; i++) {
        const p = watcherPoint(lm, i);
        cx += p.x;
        cy += p.y;
        watcherLocalJoints[i].set(
          -(p.x - 0.5) * HAND_SCALE,
          -(p.y - 0.5) * HAND_SCALE,
          -p.z * HAND_SCALE * 1.4
        );
      }
      cx /= HAND_PTS;
      cy /= HAND_PTS;
      hand.targetPos.set((cx - 0.5) * -30, HAND_Y + (0.5 - cy) * 16, HAND_SOURCE_Z - WATCHER_SOURCE_Z);
      if (first || !hand.present) hand.group.position.copy(hand.targetPos);
      watcherRebuildHandVoxels(hand, watcherLocalJoints);
      hand.group.visible = true;
      hand.present = true;
    }

    function watcherProcessVideo(now) {
      if (!watcherRunning || !watcherFaceLM || !watcherHandLM || !watcherVideo || watcherVideo.readyState < 2) return null;
      const frame = { face: null, hands: [], settings: watcherCloneSettings(), ts: Date.now() };
      const f = watcherFaceLM.detectForVideo(watcherVideo, now);
      if (f.faceLandmarks && f.faceLandmarks.length) {
        const raw = f.faceLandmarks[0];
        const a = Math.max(0.04, 1 - watcherSettings.smooth);
        if (!watcherFaceSmooth || watcherFaceSmooth.length !== raw.length) {
          watcherFaceSmooth = raw.map(p => ({ x: p.x, y: p.y, z: p.z }));
        } else {
          for (let i = 0; i < raw.length; i++) {
            const s = watcherFaceSmooth[i], r = raw[i];
            s.x += (r.x - s.x) * a;
            s.y += (r.y - s.y) * a;
            s.z += (r.z - s.z) * a;
          }
        }
        watcherRebuildFaceVoxels(watcherFaceSmooth);
        frame.face = watcherFlatLandmarks(watcherFaceSmooth, FACE_PTS);
        watcherTracking = true;
      } else {
        watcherTracking = false;
        watcherFaceSmooth = null;
        if (watcherFaceVox) {
          watcherFaceVox.count = 0;
          watcherFaceVox.instanceMatrix.needsUpdate = true;
        }
      }
      const h = watcherHandLM.detectForVideo(watcherVideo, now);
      const handCount = h.landmarks ? h.landmarks.length : 0;
      for (let hi = 0; hi < watcherHands.length; hi++) {
        const hand = watcherHands[hi];
        if (hi < handCount) {
          const fresh = !hand.present;
          const raw = h.landmarks[hi];
          const a = Math.max(0.04, 1 - watcherSettings.smooth);
          if (!hand.smooth || hand.smooth.length !== raw.length) {
            hand.smooth = raw.map(p => ({ x: p.x, y: p.y, z: p.z }));
          } else {
            for (let i = 0; i < raw.length; i++) {
              const s = hand.smooth[i], r = raw[i];
              s.x += (r.x - s.x) * a;
              s.y += (r.y - s.y) * a;
              s.z += (r.z - s.z) * a;
            }
          }
          const flat = watcherFlatLandmarks(hand.smooth, HAND_PTS);
          watcherApplyHandLandmarks(hand, flat, fresh);
          frame.hands.push(flat);
        } else {
          hand.group.visible = false;
          hand.present = false;
          hand.smooth = null;
        }
      }
      return frame.face ? frame : null;
    }

    function watcherBroadcastFrame(frame, now) {
      if (!frame || now - watcherLastBroadcast < WATCHER_BROADCAST_MS) return;
      if (!watcherControlsAllowed() || !watcherSettings.enabled) return;
      const mp = window.__tinyworldMultiplayer;
      if (!mp || typeof mp.send !== 'function') return;
      try {
        const p = typeof mp.presence === 'function' ? mp.presence() : null;
        watcherSelfId = p && p.id ? String(p.id) : watcherSelfId;
        mp.send({
          type: 'watcher',
          source: watcherSelfId || 'watcher-host',
          watcher: frame,
        });
        watcherLastBroadcast = now;
      } catch (_) {}
    }

    function watcherApplyRemote(source, data) {
      if (!data || !data.face || !Array.isArray(data.face) || data.face.length < FACE_PTS * 3) return;
      const mp = window.__tinyworldMultiplayer;
      try {
        const p = mp && typeof mp.presence === 'function' ? mp.presence() : null;
        if (p && source && String(source) === String(p.id)) return;
      } catch (_) {}
      watcherEnsureScene();
      watcherLoadSourceFaceTris().then(() => {
        watcherRemote = {
          source: String(source || 'remote-watcher'),
          face: data.face.slice(0, FACE_PTS * 3),
          hands: Array.isArray(data.hands) ? data.hands.slice(0, 2).map(h => Array.isArray(h) ? h.slice(0, HAND_PTS * 3) : null) : [],
          settings: watcherCloneSettings(data.settings),
          ts: Date.now(),
        };
        watcherRebuildFaceVoxels(watcherRemote.face);
        for (let i = 0; i < watcherHands.length; i++) {
          watcherApplyHandLandmarks(watcherHands[i], watcherRemote.hands[i], true);
        }
      }).catch(() => {});
    }

    function watcherRemoveRemote(source) {
      if (watcherRemote && (!source || String(source) === watcherRemote.source)) watcherRemote = null;
    }

    function watcherActiveSettings() {
      if (watcherControlsAllowed() && watcherSettings.enabled && watcherRunning) return watcherSettings;
      if (watcherRemote && Date.now() - watcherRemote.ts < WATCHER_REMOTE_TIMEOUT) return watcherRemote.settings;
      return watcherSettings;
    }

    function watcherUpdatePlacement(dt) {
      if (!watcherRoot || !camera) return;
      const settings = watcherActiveSettings();
      const remoteActive = !!(watcherRemote && Date.now() - watcherRemote.ts < WATCHER_REMOTE_TIMEOUT);
      const localActive = !!(watcherControlsAllowed() && watcherSettings.enabled && watcherRunning && watcherTracking);
      watcherRoot.visible = localActive || remoteActive;
      if (!watcherRoot.visible) return;
      watcherRoot.position.set(settings.posX, settings.posY, settings.posZ);
      watcherRoot.quaternion.copy(camera.quaternion);
      watcherContent.position.set(0, 0, 0);
      watcherContent.scale.setScalar(WATCHER_SCENE_SCALE * settings.zoom);
      watcherFaceGroup.scale.set(settings.faceSize * settings.faceWidth, settings.faceSize * settings.faceHeight, settings.faceSize);
      watcherFaceGroup.rotation.x = settings.tilt * Math.PI / 180;
      if (watcherFaceVoxMat) watcherFaceVoxMat.opacity = settings.faceOpacity;
      for (const hand of watcherHands) {
        hand.bones.material.opacity = settings.handOpacity;
        if (hand.present) hand.group.position.lerp(hand.targetPos, 0.35);
      }
      for (const c of watcherClouds) {
        c.material.opacity = c.userData.baseOpacity * settings.cloudOpacity;
        c.position.x += c.userData.speed * dt * 1.1;
        if (c.position.x > 18) c.position.x = -18;
      }
    }

    function watcherTick(t, dt) {
      watcherEnsureScene();
      const now = performance.now();
      if (watcherRunning && now - watcherLastTrack >= WATCHER_FRAME_MS) {
        watcherLastTrack = now;
        const frame = watcherProcessVideo(now);
        watcherBroadcastFrame(frame, now);
      }
      watcherUpdatePlacement(dt || 0);
    }

    function watcherSyncControlsVisibility() {
      const allowed = watcherControlsAllowed();
      document.body.classList.toggle('watcher-owner-enabled', allowed);
      document.querySelectorAll('[data-watcher-owner-control]').forEach(el => {
        el.hidden = !allowed;
        el.setAttribute('aria-hidden', allowed ? 'false' : 'true');
      });
      if (!allowed && watcherStartBtn) watcherStartBtn.disabled = true;
      else if (watcherStartBtn) watcherStartBtn.disabled = false;
    }

    function watcherBindRange(id, valueId, key, settingKey, format) {
      const input = document.getElementById(id);
      const value = document.getElementById(valueId);
      if (!input) return;
      input.value = String(watcherSettings[settingKey]);
      const update = () => {
        const n = parseFloat(input.value);
        watcherSettings[settingKey] = n;
        watcherSave(key, n);
        if (value) value.textContent = format(n);
      };
      input.addEventListener('input', update);
      update();
    }

    function watcherBindSettings() {
      if (watcherInitialized) return;
      watcherInitialized = true;
      watcherLoadSettings();
      const enabled = document.getElementById('watcher-enabled');
      watcherStartBtn = document.getElementById('watcher-start-camera');
      watcherStatusEl = document.getElementById('watcher-status');
      if (enabled) {
        enabled.checked = !!watcherSettings.enabled;
        enabled.addEventListener('change', () => {
          watcherSettings.enabled = !!enabled.checked;
          watcherSave(WATCHER_LS.enabled, watcherSettings.enabled ? '1' : '0');
          watcherEnsureScene();
        });
      }
      if (watcherStartBtn) {
        watcherStartBtn.addEventListener('click', async () => {
          watcherEnsureScene();
          watcherStartBtn.disabled = true;
          try {
            await watcherInitVision();
            watcherRunning = true;
            watcherSettings.enabled = true;
            watcherSave(WATCHER_LS.enabled, '1');
            if (enabled) enabled.checked = true;
            watcherStartBtn.textContent = 'Watcher live';
          } catch (err) {
            watcherSetStatus('failed: ' + ((err && err.message) || err || 'camera unavailable'));
            watcherStartBtn.disabled = false;
          }
        });
      }
      watcherBindRange('watcher-size', 'watcher-size-value', WATCHER_LS.size, 'faceSize', x => x.toFixed(2) + 'x');
      watcherBindRange('watcher-face-width', 'watcher-face-width-value', WATCHER_LS.faceWidth, 'faceWidth', x => x.toFixed(2) + 'x');
      watcherBindRange('watcher-face-height', 'watcher-face-height-value', WATCHER_LS.faceHeight, 'faceHeight', x => x.toFixed(2) + 'x');
      watcherBindRange('watcher-pos-x', 'watcher-pos-x-value', WATCHER_LS.posX, 'posX', x => x.toFixed(1));
      watcherBindRange('watcher-pos-y', 'watcher-pos-y-value', WATCHER_LS.posY, 'posY', x => x.toFixed(1));
      watcherBindRange('watcher-pos-z', 'watcher-pos-z-value', WATCHER_LS.posZ, 'posZ', x => x.toFixed(1));
      watcherBindRange('watcher-tilt', 'watcher-tilt-value', WATCHER_LS.tilt, 'tilt', x => Math.round(x) + 'deg');
      watcherBindRange('watcher-zoom', 'watcher-zoom-value', WATCHER_LS.zoom, 'zoom', x => x.toFixed(2) + 'x');
      watcherBindRange('watcher-smooth', 'watcher-smooth-value', WATCHER_LS.smooth, 'smooth', x => x.toFixed(2));
      watcherBindRange('watcher-face-opacity', 'watcher-face-opacity-value', WATCHER_LS.faceOpacity, 'faceOpacity', x => x.toFixed(2));
      watcherBindRange('watcher-hand-opacity', 'watcher-hand-opacity-value', WATCHER_LS.handOpacity, 'handOpacity', x => x.toFixed(2));
      watcherBindRange('watcher-cloud-opacity', 'watcher-cloud-opacity-value', WATCHER_LS.cloudOpacity, 'cloudOpacity', x => x.toFixed(2));
      watcherSyncControlsVisibility();
    }

    function watcherBoot() {
      watcherBindSettings();
      watcherEnsureScene();
      watcherSyncControlsVisibility();
    }

    window.__tinyworldWatcherLayer = {
      tick: watcherTick,
      applyRemote: watcherApplyRemote,
      removeRemote: watcherRemoveRemote,
      controlsAllowed: watcherControlsAllowed,
      start: async () => {
        watcherEnsureScene();
        await watcherInitVision();
        watcherRunning = true;
      },
      stop: () => {
        watcherRunning = false;
        watcherTracking = false;
        if (watcherFaceVox) watcherFaceVox.count = 0;
      },
      dispose: () => {
        if (watcherRoot && watcherRoot.parent) watcherRoot.parent.remove(watcherRoot);
        watcherDisposeOwnedObject(watcherRoot);
        watcherRoot = null;
      },
    };

    window.addEventListener('tinyworld:mode-changed', watcherSyncControlsVisibility);
    document.addEventListener('tinyworld:profile-loaded', watcherSyncControlsVisibility);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watcherBoot);
    else watcherBoot();
  })();
