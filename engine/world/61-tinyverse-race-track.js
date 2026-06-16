  // -------- tinyverse race track: perimeter roads + bridge loop on the ground surface --------
  // Adds a low-draw rally loop to the poser-surface ground islands. The track
  // lives under window.__tinyworldPoserSurface's group, so it appears only on
  // the land/planet layer and stays separate from the editable sky islands.
  // API: window.__tinyworldRaceTrack.{build,show,hide,watch,startRace,stopRace,rebuild,group}
  // IIFE-wrapped: no top-level declarations leak into shared classic-script scope.
  (function tinyverseRaceTrackBoot() {
    'use strict';
    if (typeof window === 'undefined' || typeof THREE === 'undefined') return;

    const PS = window.__tinyworldPoserSurface;
    const SURFACE_Y_BOOST = 3;
    const TRACK_WIDTH = 1.36;
    const ROAD_H = 0.050;
    const ROAD_Y = 0.038;
    const ROUTE_Y = 0.155;
    const BRIDGE_Y = 0.175;
    const LAP_COUNT = 3;
    const TWO_PI = Math.PI * 2;

    // Mirrors the satellite-island layout in 57-poser-surface.js. These are
    // geometry waypoints only; the live road is attached to the poser surface.
    const RACE_SATS = [
      { id: 'east', cx: 46, cz: 9, rot: 0.6, k1: 0.9, k2: 2.1 },
      { id: 'south', cx: 14, cz: -46, rot: 2.2, k1: 2.4, k2: 0.4 },
      { id: 'southwest', cx: -40, cz: -26, rot: 4.0, k1: 4.2, k2: 3.3 },
      { id: 'northwest', cx: -44, cz: 22, rot: 1.1, k1: 1.6, k2: 5.0 },
      { id: 'north', cx: 10, cz: 50, rot: 3.1, k1: 5.3, k2: 1.2 },
    ];
    const RACE_ISLE = {
      r: 9.2,
      sx: 2.6,
      sz: 1.54,
      rAt(th) {
        const base = this.r * (0.74 + 0.18 * Math.cos(2 * th) + 0.11 * Math.sin(th));
        return base * (this.sx * this.sz) / Math.hypot(this.sz * Math.cos(th), this.sx * Math.sin(th));
      },
    };

    let root = null;
    let staticGroup = null;
    let dynamicGroup = null;
    let built = false;
    let visible = false;
    let hud = null;
    let hudStatus = null;
    let hudButton = null;
    let launcher = null;
    let watchTimer = 0;
    let watchCamera = false;
    let hudT = 0;
    let raceActive = false;
    let raceWinner = null;
    let routeLength = 0;
    let routeSegments = [];
    let racers = [];
    let fallbackMat = null;
    const trackMats = {};
    const watchCameraPos = new THREE.Vector3();

    function satRAt(sat, th) {
      return 9.2 * (0.74 + 0.18 * Math.cos(2 * th + sat.k1) + 0.11 * Math.sin(th + sat.k2));
    }
    function satSd(sat, x, z) {
      const dx = x - sat.cx;
      const dz = z - sat.cz;
      return satRAt(sat, Math.atan2(dz, dx) - sat.rot) - Math.hypot(dx, dz);
    }
    function smoothstep(a, b, t) {
      t = Math.min(1, Math.max(0, (t - a) / (b - a)));
      return t * t * (3 - 2 * t);
    }
    function isleH(sd, x, z) {
      if (sd <= 0) return Math.max(-0.55, sd * 0.16);
      let h = smoothstep(0.1, 2.8, sd) * 0.3;
      h += (Math.sin(x * 1.1 + z * 1.37) + Math.sin(x * 1.73 - z * 0.61)) * 0.013 * smoothstep(0.5, 1.4, sd);
      return h;
    }
    function nearestIsle(x, z) {
      let bi = 0;
      let bsd = RACE_ISLE.rAt(Math.atan2(z, x)) - Math.hypot(x, z);
      for (let i = 0; i < RACE_SATS.length; i++) {
        const sd = satSd(RACE_SATS[i], x, z);
        if (sd > bsd) {
          bsd = sd;
          bi = i + 1;
        }
      }
      return [bi, bsd];
    }
    function groundH(x, z) {
      const nearest = nearestIsle(x, z);
      return isleH(nearest[1], x, z);
    }
    function groundY(x, z) {
      return Math.max(0, groundH(x, z));
    }
    function trackYForGround(y, pad) {
      return y * SURFACE_Y_BOOST + pad;
    }

    function normAngle(a) {
      a %= TWO_PI;
      return a < 0 ? a + TWO_PI : a;
    }
    function ccwDelta(a, b) {
      return normAngle(b - a);
    }
    function shortAngleDelta(a, b) {
      let d = (b - a) % TWO_PI;
      if (d > Math.PI) d -= TWO_PI;
      if (d < -Math.PI) d += TWO_PI;
      return d;
    }
    function angleOnCcwArc(a, b, t) {
      return ccwDelta(a, t) <= ccwDelta(a, b) + 0.0001;
    }
    function pointOnSat(sat, angle, scale) {
      const r = satRAt(sat, angle - sat.rot) * scale;
      const x = sat.cx + Math.cos(angle) * r;
      const z = sat.cz + Math.sin(angle) * r;
      const gy = groundY(x, z);
      return {
        x,
        z,
        groundY: gy,
        y: trackYForGround(gy, ROUTE_Y),
      };
    }
    function angleToSat(from, to) {
      return Math.atan2(to.cz - from.cz, to.cx - from.cx);
    }
    function islandOrder() {
      const sorted = RACE_SATS.slice().sort((a, b) => Math.atan2(a.cz, a.cx) - Math.atan2(b.cz, b.cx));
      const start = Math.max(0, sorted.findIndex(s => s.id === 'east'));
      return sorted.slice(start).concat(sorted.slice(0, start));
    }
    function arcPoints(sat, entryAngle, exitAngle) {
      const outer = Math.atan2(sat.cz, sat.cx);
      const ccw = angleOnCcwArc(entryAngle, exitAngle, outer);
      const delta = ccw ? ccwDelta(entryAngle, exitAngle) : -ccwDelta(exitAngle, entryAngle);
      const steps = Math.max(8, Math.ceil(Math.abs(delta) / (Math.PI / 12)));
      const out = [];
      for (let i = 0; i <= steps; i++) {
        const a = entryAngle + delta * (i / steps);
        out.push(pointOnSat(sat, a, 0.61));
      }
      return out;
    }

    function surfaceGroup() {
      return PS && typeof PS.group === 'function' ? PS.group() : null;
    }
    function getGeo(w, h, d) {
      return typeof getBoxGeometry === 'function' ? getBoxGeometry(w, h, d) : new THREE.BoxGeometry(w, h, d);
    }
    function fallbackMaterial() {
      if (!fallbackMat) {
        fallbackMat = new THREE.MeshLambertMaterial({ color: 0xf2d29c });
        fallbackMat.fog = false;
      }
      return fallbackMat;
    }
    function material(name, fallback) {
      return (typeof M !== 'undefined' && M && M[name]) ? M[name] : fallback;
    }
    function trackMaterial(name, fallbackName) {
      const key = name || fallbackName || 'fallback';
      if (trackMats[key]) return trackMats[key];
      const base = material(name, null) || (fallbackName ? trackMaterial(fallbackName, null) : fallbackMaterial());
      const mat = base && typeof base.clone === 'function' ? base.clone() : base;
      if (mat) {
        mat.fog = false;
        mat.needsUpdate = true;
      }
      trackMats[key] = mat || fallbackMaterial();
      return trackMats[key];
    }
    function addBox(parent, w, h, d, x, y, z, mat, ry) {
      const mesh = new THREE.Mesh(getGeo(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = ry || 0;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;
      mesh.userData.noPointerPick = true;
      mesh.raycast = function () {};
      parent.add(mesh);
      return mesh;
    }
    function addSegmentBox(parent, a, b, width, height, y, mat, offset, extraLen) {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.04) return null;
      const ry = -Math.atan2(dz, dx);
      const nx = -dz / len;
      const nz = dx / len;
      return addBox(
        parent,
        len + (extraLen || 0),
        height,
        width,
        (a.x + b.x) * 0.5 + nx * (offset || 0),
        y,
        (a.z + b.z) * 0.5 + nz * (offset || 0),
        mat,
        ry
      );
    }
    function registerRouteSegment(a, b, bridgeY) {
      const ay = bridgeY == null ? a.y : bridgeY;
      const by = bridgeY == null ? b.y : bridgeY;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dy = by - ay;
      const len = Math.hypot(dx, dz, dy);
      if (len < 0.04) return;
      routeSegments.push({
        ax: a.x,
        ay,
        az: a.z,
        bx: b.x,
        by,
        bz: b.z,
        len,
        start: routeLength,
      });
      routeLength += len;
    }
    function addPathSegment(a, b) {
      const pathMat = trackMaterial('path');
      const trimMat = trackMaterial('pathTrim', 'path');
      const y = trackYForGround((a.groundY + b.groundY) * 0.5, ROAD_Y);
      addSegmentBox(staticGroup, a, b, TRACK_WIDTH, ROAD_H, y, pathMat, 0, 0.04);
      addSegmentBox(staticGroup, a, b, 0.13, ROAD_H * 0.72, y + 0.018, trimMat, TRACK_WIDTH * 0.46, 0.02);
      addSegmentBox(staticGroup, a, b, 0.13, ROAD_H * 0.72, y + 0.018, trimMat, -TRACK_WIDTH * 0.46, 0.02);
      registerRouteSegment(a, b);
    }
    function addPathPolyline(points) {
      for (let i = 1; i < points.length; i++) addPathSegment(points[i - 1], points[i]);
    }
    function addBridge(a, b) {
      const deckMat = trackMaterial('bridgeWood', 'path');
      const trimMat = trackMaterial('bridgeWoodD', 'bridgeWood');
      const stoneMat = trackMaterial('castleStoneD', 'bridgeWoodD');
      const bridgeY = Math.max(a.y, b.y, trackYForGround(0, 0.28));
      const deckCenter = bridgeY - 0.060;
      addSegmentBox(staticGroup, a, b, 1.16, 0.080, deckCenter, deckMat, 0, 0.20);
      addSegmentBox(staticGroup, a, b, 1.32, 0.055, deckCenter - 0.060, trimMat, 0, 0.12);
      addSegmentBox(staticGroup, a, b, 0.080, 0.180, deckCenter + 0.135, trimMat, 0.65, 0.04);
      addSegmentBox(staticGroup, a, b, 0.080, 0.180, deckCenter + 0.135, trimMat, -0.65, 0.04);

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.01) {
        const ux = dx / len;
        const uz = dz / len;
        const nx = -uz;
        const nz = ux;
        const posts = Math.max(3, Math.min(13, Math.floor(len / 5.8)));
        for (let i = 0; i <= posts; i++) {
          const t = i / posts;
          const cx = a.x + dx * t;
          const cz = a.z + dz * t;
          for (const side of [-1, 1]) {
            addBox(staticGroup, 0.13, 0.42, 0.13, cx + nx * side * 0.65, deckCenter + 0.14, cz + nz * side * 0.65, trimMat, 0);
          }
        }
        for (const t of [0.05, 0.95]) {
          const cx = a.x + dx * t;
          const cz = a.z + dz * t;
          addBox(staticGroup, 0.62, 0.34, 0.62, cx, deckCenter - 0.13, cz, stoneMat, 0);
          addBox(staticGroup, 0.40, 0.52, 0.40, cx + nx * 0.52, deckCenter - 0.18, cz + nz * 0.52, stoneMat, 0);
          addBox(staticGroup, 0.40, 0.52, 0.40, cx - nx * 0.52, deckCenter - 0.18, cz - nz * 0.52, stoneMat, 0);
        }
      }
      registerRouteSegment(a, b, bridgeY + BRIDGE_Y);
    }
    function addStartLine() {
      if (!routeSegments.length) return;
      const seg = routeSegments[0];
      const dx = seg.bx - seg.ax;
      const dz = seg.bz - seg.az;
      const ry = -Math.atan2(dz, dx);
      const g = new THREE.Group();
      g.name = 'tinyverse-race-start';
      g.position.set(seg.ax, seg.ay - ROUTE_Y + 0.020, seg.az);
      g.rotation.y = ry;
      g.userData.noPointerPick = true;
      const black = trackMaterial('rockDk', 'pathTrim');
      const white = trackMaterial('snow', 'path');
      for (let i = 0; i < 8; i++) {
        const z = -0.70 + i * 0.20;
        addBox(g, 0.18, 0.032, 0.18, 0.02, 0.042, z, i % 2 ? black : white, 0);
      }
      const postMat = trackMaterial('castleStoneD', 'bridgeWoodD');
      const glow = trackMaterial('windowLit', 'snow');
      for (const z of [-0.90, 0.90]) {
        addBox(g, 0.12, 1.06, 0.12, -0.10, 0.55, z, postMat, 0);
        addBox(g, 0.18, 0.18, 0.18, -0.10, 1.15, z, glow, 0);
      }
      addBox(g, 0.12, 0.14, 1.92, -0.10, 1.10, 0, postMat, 0);
      staticGroup.add(g);
    }
    function buildRoute() {
      routeSegments = [];
      routeLength = 0;
      const order = islandOrder();
      const entryLandingById = new Map();
      for (let i = 0; i < order.length; i++) {
        const sat = order[i];
        const prev = order[(i - 1 + order.length) % order.length];
        const entryA = angleToSat(sat, prev);
        entryLandingById.set(sat.id, pointOnSat(sat, entryA, 0.87));
      }
      for (let i = 0; i < order.length; i++) {
        const sat = order[i];
        const prev = order[(i - 1 + order.length) % order.length];
        const next = order[(i + 1) % order.length];
        const entryA = angleToSat(sat, prev);
        const exitA = angleToSat(sat, next);
        const entryLanding = entryLandingById.get(sat.id);
        const entryRoad = pointOnSat(sat, entryA, 0.61);
        const exitRoad = pointOnSat(sat, exitA, 0.61);
        const exitLanding = pointOnSat(sat, exitA, 0.87);
        const arc = arcPoints(sat, entryA, exitA);
        addPathPolyline([entryLanding, entryRoad].concat(arc).concat([exitRoad, exitLanding]));
        addBridge(exitLanding, entryLandingById.get(next.id));
      }
      addStartLine();
    }

    function makeKart(mat, lane, offset, speed, name) {
      const g = new THREE.Group();
      g.name = name;
      g.userData.noPointerPick = true;
      const wheelMat = trackMaterial('rockDk', 'pathTrim');
      const trimMat = trackMaterial('bridgeWoodD', 'bridgeWood');
      addBox(g, 0.52, 0.16, 0.72, 0, 0.18, 0, mat, 0);
      addBox(g, 0.36, 0.12, 0.28, 0, 0.34, -0.10, mat, 0);
      addBox(g, 0.22, 0.08, 0.12, 0, 0.30, 0.40, trackMaterial('windowLit', 'snow'), 0);
      for (const x of [-0.32, 0.32]) {
        for (const z of [-0.27, 0.27]) addBox(g, 0.16, 0.18, 0.12, x, 0.10, z, wheelMat, 0);
      }
      addBox(g, 0.64, 0.05, 0.10, 0, 0.44, -0.30, trimMat, 0);
      dynamicGroup.add(g);
      return {
        group: g,
        lane,
        offset,
        speed,
        demoSpeed: speed * 0.72,
        dist: offset,
        laps: 0,
      };
    }
    function buildRacers() {
      racers = [
        makeKart(trackMaterial('windowB', 'path'), -0.34, 0, 12.8, 'rally-kart-blue'),
        makeKart(trackMaterial('pumpkin', 'bridgeWood'), 0.02, routeLength * 0.34, 12.2, 'rally-kart-orange'),
        makeKart(trackMaterial('cropLeaf', 'grassHi'), 0.34, routeLength * 0.67, 11.8, 'rally-kart-green'),
      ];
      racers.forEach(r => r.group.visible = !!routeLength);
    }
    function sampleRoute(distance, out) {
      if (!routeLength || !routeSegments.length) return false;
      let d = distance % routeLength;
      if (d < 0) d += routeLength;
      let seg = routeSegments[routeSegments.length - 1];
      for (let i = 0; i < routeSegments.length; i++) {
        const s = routeSegments[i];
        if (d >= s.start && d <= s.start + s.len) {
          seg = s;
          break;
        }
      }
      const u = Math.max(0, Math.min(1, (d - seg.start) / seg.len));
      const dx = seg.bx - seg.ax;
      const dz = seg.bz - seg.az;
      out.x = seg.ax + dx * u;
      out.y = seg.ay + (seg.by - seg.ay) * u;
      out.z = seg.az + dz * u;
      out.heading = Math.atan2(dx, dz);
      return true;
    }
    function applyRacerPosition(racer) {
      const p = racer._sample || (racer._sample = { x: 0, y: 0, z: 0, heading: 0 });
      if (!sampleRoute(racer.dist, p)) return;
      racer.group.position.set(
        p.x + Math.cos(p.heading) * racer.lane,
        p.y,
        p.z - Math.sin(p.heading) * racer.lane
      );
      racer.group.rotation.y = p.heading;
    }
    function leadRacer() {
      if (!racers.length) return null;
      return racers.reduce((best, r) => r.dist > best.dist ? r : best, racers[0]);
    }
    function routeBoundsWorld() {
      if (!routeSegments.length) return null;
      const sg = surfaceGroup();
      const sx = sg && sg.scale ? sg.scale.x : 1;
      const sz = sg && sg.scale ? sg.scale.z : 1;
      const ox = sg && sg.position ? sg.position.x : 0;
      const oz = sg && sg.position ? sg.position.z : 0;
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const s of routeSegments) {
        const ax = ox + s.ax * sx;
        const bx = ox + s.bx * sx;
        const az = oz + s.az * sz;
        const bz = oz + s.bz * sz;
        minX = Math.min(minX, ax, bx);
        maxX = Math.max(maxX, ax, bx);
        minZ = Math.min(minZ, az, bz);
        maxZ = Math.max(maxZ, az, bz);
      }
      return { minX, maxX, minZ, maxZ };
    }
    function applyPerspectiveCamera() {
      if (typeof setCameraMode === 'function' && typeof cameraMode !== 'undefined' && cameraMode !== 'perspective') {
        setCameraMode('perspective');
      } else if (typeof cameraMode !== 'undefined') {
        cameraMode = 'perspective';
        if (typeof camera !== 'undefined' && typeof persCam !== 'undefined') camera = persCam;
      }
    }
    function focusRaceCamera(close) {
      if (!routeLength || typeof target === 'undefined' || !target) return false;
      applyPerspectiveCamera();
      if (close) {
        const lead = leadRacer();
        if (lead && lead.group) {
          if (root && typeof root.updateMatrixWorld === 'function') root.updateMatrixWorld(true);
          lead.group.getWorldPosition(watchCameraPos);
          const heading = lead._sample && Number.isFinite(lead._sample.heading) ? lead._sample.heading : lead.group.rotation.y;
          target.x = watchCameraPos.x;
          target.y = watchCameraPos.y + 0.7;
          target.z = watchCameraPos.z;
          if (typeof viewSize !== 'undefined') viewSize = (typeof clampViewSize === 'function') ? clampViewSize(12.5) : 12.5;
          if (typeof polar !== 'undefined') {
            const lo = (typeof MIN_ORBIT_POLAR === 'number') ? MIN_ORBIT_POLAR : 0.18;
            const hi = (typeof MAX_ORBIT_POLAR === 'number') ? MAX_ORBIT_POLAR : Math.PI - 0.18;
            polar = Math.max(lo, Math.min(hi, 1.30));
          }
          if (typeof azimuth !== 'undefined') azimuth = -heading - Math.PI / 2;
          if (typeof updateCamera === 'function') updateCamera();
          if (typeof renderSceneIfReady === 'function') renderSceneIfReady();
          return true;
        }
      }
      const bounds = routeBoundsWorld();
      if (!bounds) return false;
      const sg = surfaceGroup();
      target.x = (bounds.minX + bounds.maxX) * 0.5;
      target.z = (bounds.minZ + bounds.maxZ) * 0.5;
      if (sg && sg.position) target.y = sg.position.y + 3.2;
      if (typeof viewSize !== 'undefined') {
        const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
        const desired = close ? Math.max(26, Math.min(48, span * 0.30)) : Math.max(34, Math.min(56, span * 0.36));
        viewSize = (typeof clampViewSize === 'function') ? clampViewSize(desired) : desired;
      }
      if (typeof polar !== 'undefined') {
        const lo = (typeof MIN_ORBIT_POLAR === 'number') ? MIN_ORBIT_POLAR : 0.18;
        const hi = (typeof MAX_ORBIT_POLAR === 'number') ? MAX_ORBIT_POLAR : Math.PI - 0.18;
        polar = Math.max(lo, Math.min(hi, close ? 1.10 : 1.02));
      }
      if (typeof azimuth !== 'undefined') azimuth = -0.62;
      if (typeof updateCamera === 'function') updateCamera();
      if (typeof renderSceneIfReady === 'function') renderSceneIfReady();
      return true;
    }
    function updateWatchCamera(dt) {
      if (!watchCamera || !visible || !root || typeof target === 'undefined' || !target) return;
      const lead = leadRacer();
      if (!lead || !lead.group) return;
      if (typeof root.updateMatrixWorld === 'function') root.updateMatrixWorld(true);
      lead.group.getWorldPosition(watchCameraPos);
      const a = Math.min(1, Math.max(0.05, (dt || 0.016) * 4.0));
      target.x += (watchCameraPos.x - target.x) * a;
      target.y += (watchCameraPos.y + 0.7 - target.y) * a;
      target.z += (watchCameraPos.z - target.z) * a;
      if (typeof viewSize !== 'undefined') {
        const next = (typeof clampViewSize === 'function') ? clampViewSize(12.5) : 12.5;
        viewSize += (next - viewSize) * a;
      }
      if (typeof polar !== 'undefined') {
        const lo = (typeof MIN_ORBIT_POLAR === 'number') ? MIN_ORBIT_POLAR : 0.18;
        const hi = (typeof MAX_ORBIT_POLAR === 'number') ? MAX_ORBIT_POLAR : Math.PI - 0.18;
        const nextPolar = Math.max(lo, Math.min(hi, 1.30));
        polar += (nextPolar - polar) * a;
      }
      if (typeof azimuth !== 'undefined') {
        const heading = lead._sample && Number.isFinite(lead._sample.heading) ? lead._sample.heading : lead.group.rotation.y;
        const nextAzimuth = -heading - Math.PI / 2;
        azimuth += shortAngleDelta(azimuth, nextAzimuth) * a;
      }
      if (typeof updateCamera === 'function') updateCamera();
    }
    function resetRacers(forRace) {
      racers.forEach((r, i) => {
        r.dist = forRace ? -i * 1.4 : r.offset;
        r.laps = 0;
        applyRacerPosition(r);
      });
    }
    function updateRacers(dt) {
      if (!routeLength) return;
      for (const r of racers) {
        const speed = raceActive ? r.speed : r.demoSpeed;
        const prevLap = Math.floor(Math.max(0, r.dist) / routeLength);
        r.dist += speed * dt;
        const nextLap = Math.floor(Math.max(0, r.dist) / routeLength);
        if (raceActive && nextLap > prevLap) {
          r.laps = nextLap;
          if (!raceWinner && r.laps >= LAP_COUNT) {
            raceWinner = r.group.name.replace('rally-kart-', '').toUpperCase();
            raceActive = false;
          }
        }
        applyRacerPosition(r);
      }
    }

    function ensureHud() {
      if (hud) return hud;
      hud = document.createElement('div');
      hud.id = 'tw-race-track-hud';
      hud.style.cssText = 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:61;'
        + 'display:none;gap:10px;align-items:center;padding:7px 9px;border-radius:12px;'
        + 'background:rgba(11,18,30,.82);border:1px solid rgba(242,210,156,.42);'
        + 'font:700 12px "Space Grotesk",system-ui,sans-serif;color:#fff4d6;backdrop-filter:blur(8px)';
      const label = document.createElement('span');
      label.textContent = 'Tinyverse Rally';
      label.style.cssText = 'text-transform:uppercase;letter-spacing:.05em';
      hudStatus = document.createElement('span');
      hudStatus.style.cssText = 'color:#dbe9ff;font-weight:600;min-width:126px';
      hudButton = document.createElement('button');
      hudButton.type = 'button';
      hudButton.textContent = 'Start race';
      hudButton.style.cssText = 'cursor:pointer;border:0;border-radius:8px;padding:6px 10px;'
        + 'background:rgba(242,210,156,.22);color:#fff7e3;font:inherit';
      hudButton.addEventListener('click', () => startRace());
      hud.appendChild(label);
      hud.appendChild(hudStatus);
      hud.appendChild(hudButton);
      document.body.appendChild(hud);
      updateHud(true);
      return hud;
    }
    function setHudVisible(on) {
      if (on) ensureHud();
      if (hud) hud.style.display = on ? 'flex' : 'none';
    }
    function ensureLauncher() {
      if (launcher || !document.body) return launcher;
      launcher = document.createElement('button');
      launcher.id = 'tw-race-track-launcher';
      launcher.type = 'button';
      launcher.textContent = 'Play rally';
      launcher.style.cssText = 'position:fixed;right:16px;bottom:92px;z-index:61;display:flex;'
        + 'align-items:center;justify-content:center;min-height:36px;padding:8px 13px;border-radius:12px;'
        + 'border:1px solid rgba(242,210,156,.52);background:rgba(11,18,30,.86);'
        + 'box-shadow:0 10px 24px rgba(4,7,16,.28);color:#fff4d6;'
        + 'font:800 12px "Space Grotesk",system-ui,sans-serif;text-transform:uppercase;'
        + 'letter-spacing:.05em;cursor:pointer;backdrop-filter:blur(8px)';
      launcher.addEventListener('click', () => watchRace());
      document.body.appendChild(launcher);
      return launcher;
    }
    function setLauncherVisible(on) {
      if (on) ensureLauncher();
      if (launcher) launcher.style.display = on ? 'flex' : 'none';
    }
    function setWatchUi(on) {
      document.body.classList.toggle('tinyverse-rally-watch', !!on);
    }
    function updateHud(force) {
      if (!hudStatus || (!force && hudT < 0.16)) return;
      hudT = 0;
      if (raceWinner) {
        hudStatus.textContent = raceWinner + ' wins';
        hudButton.textContent = 'Race again';
        return;
      }
      if (raceActive) {
        const lead = racers.reduce((best, r) => r.dist > best.dist ? r : best, racers[0] || { dist: 0, laps: 0 });
        hudStatus.textContent = 'Lap ' + Math.min(LAP_COUNT, lead.laps + 1) + '/' + LAP_COUNT;
        hudButton.textContent = 'Restart';
        return;
      }
      hudStatus.textContent = 'Loop ready';
      hudButton.textContent = 'Start race';
    }
    function dismissWelcomeForRace() {
      const modal = document.getElementById('welcome-modal');
      if (!modal || modal.hidden) return;
      if (typeof closeTinyModal === 'function') closeTinyModal(modal);
      else modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('welcome-launch-open');
    }

    function tickTinyverseRaceTrack(dt) {
      if (!visible) return;
      dt = Math.min(dt || 0, 0.05);
      hudT += dt;
      updateRacers(dt);
      updateWatchCamera(dt);
      updateHud(false);
    }
    function build() {
      if (built && root) return root;
      const parent = surfaceGroup();
      if (!parent) return null;
      root = new THREE.Group();
      root.name = 'tinyverse-race-track';
      root.scale.y = 1 / SURFACE_Y_BOOST;
      root.visible = false;
      root.userData.noPointerPick = true;
      staticGroup = new THREE.Group();
      staticGroup.name = 'tinyverse-race-track-static';
      dynamicGroup = new THREE.Group();
      dynamicGroup.name = 'tinyverse-race-track-racers';
      root.add(staticGroup);
      parent.add(root);
      buildRoute();
      if (typeof mergeStaticBaseMeshesByMaterial === 'function') {
        mergeStaticBaseMeshesByMaterial(staticGroup, { reason: 'tinyverse-race-track' });
      }
      root.add(dynamicGroup);
      buildRacers();
      root.traverse(o => {
        if (o.userData) o.userData.noPointerPick = true;
        if (o.isMesh) o.raycast = function () {};
      });
      resetRacers(false);
      built = true;
      return root;
    }
    function showTrack() {
      const g = build();
      if (!g) return false;
      if (g.parent !== surfaceGroup() && surfaceGroup()) surfaceGroup().add(g);
      g.visible = true;
      visible = true;
      raceWinner = null;
      setHudVisible(true);
      setLauncherVisible(false);
      if (typeof renderSceneIfReady === 'function') renderSceneIfReady();
      return true;
    }
    function hideTrack() {
      visible = false;
      raceActive = false;
      watchCamera = false;
      if (watchTimer) {
        clearTimeout(watchTimer);
        watchTimer = 0;
      }
      if (root) root.visible = false;
      setHudVisible(false);
      setLauncherVisible(true);
      setWatchUi(false);
      if (typeof renderSceneIfReady === 'function') renderSceneIfReady();
    }
    function startRace() {
      if (!root || !visible) {
        if (PS && typeof PS.show === 'function') PS.show();
        else showTrack();
      }
      if (!routeLength) return false;
      raceWinner = null;
      raceActive = true;
      resetRacers(true);
      updateHud(true);
      return true;
    }
    function watchRace() {
      dismissWelcomeForRace();
      const fly = window.__tinyworldFlyDown;
      let descending = false;
      if (fly && typeof fly.descend === 'function' && (!fly.isDown || !fly.isDown())) {
        descending = fly.descend() !== false;
      } else if (PS && typeof PS.show === 'function') {
        PS.show();
      } else {
        showTrack();
      }
      showTrack();
      focusRaceCamera(false);
      setWatchUi(true);
      if (watchTimer) clearTimeout(watchTimer);
      watchTimer = setTimeout(() => {
        watchTimer = 0;
        startRace();
        watchCamera = true;
        focusRaceCamera(true);
      }, descending ? 2200 : 80);
      return true;
    }
    function stopRace() {
      raceActive = false;
      raceWinner = null;
      updateHud(true);
    }
    function rebuild() {
      hideTrack();
      if (root && root.parent) root.parent.remove(root);
      if (root && typeof disposeGroup === 'function') disposeGroup(root);
      root = null;
      staticGroup = null;
      dynamicGroup = null;
      built = false;
      routeSegments = [];
      routeLength = 0;
      racers = [];
      return build();
    }

    window.__tinyworldRaceTrack = {
      build,
      show: () => {
        if (PS && typeof PS.show === 'function') return PS.show();
        return showTrack();
      },
      watch: watchRace,
      hide: () => {
        if (PS && typeof PS.hide === 'function') return PS.hide();
        hideTrack();
        return true;
      },
      startRace,
      stopRace,
      rebuild,
      group: () => root,
      routeLength: () => routeLength,
      _tick: tickTinyverseRaceTrack,
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureLauncher, { once: true });
    } else {
      ensureLauncher();
    }

    if (PS && !PS.__tinyworldRaceTrackWrapped) {
      const originalBuild = typeof PS.build === 'function' ? PS.build.bind(PS) : null;
      const originalShow = typeof PS.show === 'function' ? PS.show.bind(PS) : null;
      const originalHide = typeof PS.hide === 'function' ? PS.hide.bind(PS) : null;
      if (originalBuild) {
        PS.build = function raceTrackBuildWrapper() {
          const g = originalBuild();
          build();
          return g;
        };
      }
      if (originalShow) {
        PS.show = function raceTrackShowWrapper() {
          const ok = originalShow();
          if (ok !== false) showTrack();
          return ok;
        };
      }
      if (originalHide) {
        PS.hide = function raceTrackHideWrapper() {
          hideTrack();
          return originalHide();
        };
      }
      PS.__tinyworldRaceTrackWrapped = true;
    }
  })();
