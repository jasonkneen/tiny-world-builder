  // -------- fly down to the planet surface (Phase 2) --------
  // Lets the orbit camera descend from the floating-island layer to the
  // procedural sea+land planet that already exists below (built by module 27's
  // initPlanetLandscape), then ascend back. This generalises the one-shot
  // applyPlanetLandscapeProofView (module 27) into a smooth, reversible
  // transition that keeps the editor UI visible (no proof/demo chrome).
  //
  // Wrapped in an IIFE (house pattern, see module 38) so nothing leaks into the
  // shared classic-script lexical scope. We reference shared globals directly
  // (persCam, target, updateCamera, planetLandscapeConfig, planetLandscapeEngine,
  // setCloudSeaEnabled, cloudSeaMesh, renderCloudSea, isPlanetLandscapeActive,
  // PLANET_LANDSCAPE_DROP) because all engine/world/*.js share that scope.
  (function flyDownBoot() {
    'use strict';

    // How far down to drop the planet when the player triggers a descent and no
    // planet is active yet. Kept shallower than the 100m proof default so the
    // surface is reachable/visible without an enormous far plane.
    const FLY_DOWN_DEFAULT_DROP = 60;
    // Ease durations (seconds).
    const FLY_DOWN_DURATION = 2.1;
    const FLY_UP_DURATION = 1.8;
    // Island-layer resting orbit (what we ease back to on ascend).
    const ISLAND_FAR = 200;
    const ISLAND_TARGET_Y = 0;
    // Descent framing, generalised from applyPlanetLandscapeProofView (module 27):
    // the wide orbit radius (viewSize*4.2) + lower polar is what actually pulls
    // the planet surface into frame below the islands. Easing only target.y/far
    // would tilt the gaze down into empty air.
    const DESCEND_VIEW_SIZE = 38;
    const DESCEND_POLAR = 0.82;

    // Transition state lives entirely inside the IIFE.
    let down = false;            // true once a descent has begun / completed
    let transitioning = false;   // an ease is currently running
    let rafId = 0;
    let phase = 'idle';          // 'descend' | 'ascend' | 'idle'
    let t0 = 0;
    let dur = FLY_DOWN_DURATION;
    // Snapshots captured at the start of an ease so we can interpolate.
    let fromTargetY = 0;
    let toTargetY = 0;
    let fromFar = ISLAND_FAR;
    let toFar = ISLAND_FAR;
    let fromCloud = 1;
    let toCloud = 0;
    let fromViewSize = ISLAND_FAR; // (re)captured per ease; init value unused
    let toViewSize = DESCEND_VIEW_SIZE;
    let fromPolar = DESCEND_POLAR;
    let toPolar = DESCEND_POLAR;
    // Island-layer orbit framing remembered at the first descent so ascend can
    // restore exactly what the user had.
    let savedViewSize = null;
    let savedPolar = null;
    // Cloud-sea preference we must NOT permanently clobber.
    let cloudSeaWasEnabled = false;
    let cloudVeilManaged = false;

    function easeInOut(x) {
      // Smooth cubic ease (smoothstep-ish) — pleasant accel/decel.
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }

    function activeDrop() {
      if (typeof planetLandscapeConfig === 'object' && planetLandscapeConfig &&
          Number.isFinite(Number(planetLandscapeConfig.drop))) {
        return Number(planetLandscapeConfig.drop);
      }
      if (typeof PLANET_LANDSCAPE_DROP === 'number') return PLANET_LANDSCAPE_DROP;
      return FLY_DOWN_DEFAULT_DROP;
    }

    function planetIsActive() {
      return typeof isPlanetLandscapeActive === 'function' && isPlanetLandscapeActive();
    }

    function currentCloudOpacity() {
      // Read-only probe via the named 31 helper (passes a non-finite value).
      if (typeof setCloudSeaVeilOpacity === 'function') return setCloudSeaVeilOpacity(NaN);
      return 0;
    }

    function setCloudOpacity(v) {
      if (typeof setCloudSeaVeilOpacity === 'function') setCloudSeaVeilOpacity(v);
    }

    // Extend the far plane through the camera module (keeps far ownership in 02,
    // reversible). Falls back to writing persCam directly if the helper is
    // absent (older build) — both reference the same shared persCam.
    function applyFar(far) {
      if (typeof setPersCamFarForDescent === 'function') {
        setPersCamFarForDescent(far);
      } else if (typeof persCam !== 'undefined' && persCam) {
        persCam.far = far;
        persCam.updateProjectionMatrix();
      }
    }

    function ensurePlanet() {
      if (planetIsActive()) return true;
      if (typeof window.__setPlanetLandscapeUnderlay !== 'function') return false;
      // Mirror the proof-view defaults but at the reachable fly-down drop.
      const biome = (typeof landscapeMeshBiome === 'string') ? landscapeMeshBiome : 'grassland';
      const styleMode = (typeof landscapeMeshStyle === 'string') ? landscapeMeshStyle : 'lowpoly';
      return !!window.__setPlanetLandscapeUnderlay({
        enabled: true,
        drop: FLY_DOWN_DEFAULT_DROP,
        biome,
        styleMode,
      });
    }

    function currentViewSize() {
      return (typeof viewSize === 'number') ? viewSize : DESCEND_VIEW_SIZE;
    }
    function applyViewSize(v) {
      if (typeof viewSize === 'undefined') return;
      viewSize = (typeof clampViewSize === 'function') ? clampViewSize(v) : v;
    }
    function currentPolar() {
      return (typeof polar === 'number') ? polar : DESCEND_POLAR;
    }
    function applyPolar(p) {
      if (typeof polar === 'undefined') return;
      const lo = (typeof MIN_ORBIT_POLAR === 'number') ? MIN_ORBIT_POLAR : 0.18;
      const hi = (typeof MAX_ORBIT_POLAR === 'number') ? MAX_ORBIT_POLAR : (Math.PI - 0.18);
      polar = Math.max(lo, Math.min(hi, p));
    }

    function beginEase(toPhase) {
      const drop = activeDrop();
      // A "fresh" descent is one that starts from the island layer (nothing
      // saved yet) — only then do we snapshot the user's framing + cloud pref.
      const freshDescent = (toPhase === 'descend' && savedViewSize === null);
      phase = toPhase;
      transitioning = true;
      t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      // Camera mode must be perspective for the descent (ortho has no far depth feel).
      if (toPhase === 'descend') {
        if (typeof setCameraMode === 'function' && cameraMode !== 'perspective') setCameraMode('perspective');
        if (typeof cameraMode !== 'undefined') cameraMode = 'perspective';
        if (typeof camera !== 'undefined' && typeof persCam !== 'undefined') camera = persCam;
        dur = FLY_DOWN_DURATION;
        fromTargetY = target.y;
        toTargetY = -drop * 0.42;
        fromFar = (typeof persCam !== 'undefined' && persCam) ? persCam.far : ISLAND_FAR;
        toFar = Math.max(260, drop * 4.8);
        // Framing: widen the orbit + lower the polar so the surface comes into
        // frame (the load-bearing levers from the proof view). Remember the
        // island-layer framing on the first descent only.
        if (freshDescent) {
          savedViewSize = currentViewSize();
          savedPolar = currentPolar();
        }
        fromViewSize = currentViewSize();
        toViewSize = DESCEND_VIEW_SIZE;
        fromPolar = currentPolar();
        toPolar = DESCEND_POLAR;
        // Cloud-sea veil: only enable/snapshot on a fresh descent so a
        // mid-transition re-descend can't clobber the user's real preference.
        if (freshDescent) {
          cloudSeaWasEnabled = (typeof renderCloudSea !== 'undefined') ? !!renderCloudSea : false;
          if (!cloudSeaWasEnabled && typeof setCloudSeaEnabled === 'function') {
            setCloudSeaEnabled(true);
            cloudVeilManaged = true;
          } else {
            cloudVeilManaged = false;
          }
        }
        fromCloud = currentCloudOpacity();
        // Thin to clear at the planet so it reads as breaking through a layer.
        toCloud = 0.0;
      } else {
        dur = FLY_UP_DURATION;
        fromTargetY = target.y;
        toTargetY = ISLAND_TARGET_Y;
        fromFar = (typeof persCam !== 'undefined' && persCam) ? persCam.far : toFar;
        toFar = ISLAND_FAR;
        fromViewSize = currentViewSize();
        toViewSize = (savedViewSize !== null) ? savedViewSize : currentViewSize();
        fromPolar = currentPolar();
        toPolar = (savedPolar !== null) ? savedPolar : currentPolar();
        fromCloud = currentCloudOpacity();
        // Restore the veil toward its original look on the way up.
        toCloud = cloudSeaWasEnabled ? 0.9 : currentCloudOpacity();
      }
      if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function finishEase() {
      transitioning = false;
      if (phase === 'descend') {
        down = true;
        // Far/target already at target values; clamp stays relaxed via the flag.
      } else if (phase === 'ascend') {
        down = false;
        window.__flyDownActive = false;
        // Put the cloud-sea back exactly how the user had it.
        if (cloudVeilManaged && typeof setCloudSeaEnabled === 'function') {
          setCloudSeaEnabled(cloudSeaWasEnabled);
          cloudVeilManaged = false;
        } else if (typeof cloudSeaWasEnabled === 'boolean' && !cloudSeaWasEnabled) {
          // veil was already off and we never managed it — leave as-is
        } else {
          setCloudOpacity(0.9);
        }
        // Back at the island layer — forget the saved framing so the next
        // descent re-snapshots from wherever the user is then.
        savedViewSize = null;
        savedPolar = null;
      }
      phase = 'idle';
    }

    function tick() {
      rafId = 0;
      if (!transitioning) return;
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const raw = Math.min(1, (now - t0) / (dur * 1000));
      const e = easeInOut(raw);

      target.y = fromTargetY + (toTargetY - fromTargetY) * e;
      applyFar(fromFar + (toFar - fromFar) * e);
      applyViewSize(fromViewSize + (toViewSize - fromViewSize) * e);
      applyPolar(fromPolar + (toPolar - fromPolar) * e);

      // Cloud veil: on descend, briefly bloom thicker around the midpoint, then
      // fade to clear; on ascend just lerp back toward the resting opacity.
      if (phase === 'descend') {
        const bloom = Math.sin(Math.PI * raw) * 0.35; // 0 -> ~0.35 -> 0
        setCloudOpacity(Math.max(0, fromCloud + (toCloud - fromCloud) * e + bloom));
      } else {
        setCloudOpacity(fromCloud + (toCloud - fromCloud) * e);
      }

      if (typeof updateCamera === 'function') updateCamera();

      if (raw >= 1) {
        finishEase();
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    function descend() {
      if (down && !transitioning) return false; // already at the surface
      if (!ensurePlanet()) {
        if (typeof twToast === 'function') twToast('Planet surface unavailable.', 'err');
        return false;
      }
      // Keep the clamp relaxed and far ownership ours for the whole time we are
      // down OR transitioning — flip the flag up front so the orbit target is
      // not yanked back to the home board mid-ease.
      window.__flyDownActive = true;
      // Crisp the planet (drop the distant-backdrop desaturation/fog) now that we're close.
      if (typeof window.__setPlanetLandscapeNearView === 'function') window.__setPlanetLandscapeNearView(true);
      // Show the actual voxel-poser island+sea surface (hides the streaming underlay).
      if (window.__tinyworldPoserSurface) window.__tinyworldPoserSurface.show();
      beginEase('descend');
      return true;
    }

    function ascend() {
      if (!down && !transitioning) return false; // already up top
      // Flag stays true until the ascend ease completes (finishEase clears it).
      window.__flyDownActive = true;
      // Restore the distant-backdrop look as we climb back to the island layer.
      if (typeof window.__setPlanetLandscapeNearView === 'function') window.__setPlanetLandscapeNearView(false);
      // Hide the poser surface + restore the streaming underlay.
      if (window.__tinyworldPoserSurface) window.__tinyworldPoserSurface.hide();
      beginEase('ascend');
      return true;
    }

    function toggle() {
      // While transitioning, reverse direction toward the opposite end.
      if (transitioning) {
        return phase === 'descend' ? ascend() : descend();
      }
      return down ? ascend() : descend();
    }

    function isDown() {
      return down;
    }

    function state() {
      return { down, transitioning, phase };
    }

    window.__tinyworldFlyDown = { descend, ascend, toggle, isDown, state };

    // -------- trigger: 'J' key (jump down / back up) --------
    // Bare 'j' is otherwise unused (see module 19 tool shortcuts + module 20/30
    // handlers). Bail while flying, on modifier combos, and on text inputs so we
    // never hijack typing or fight the flight-sim capture listener.
    window.addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (window.__flightActive) return;
      const tgt = e.target;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (e.key === 'j' || e.key === 'J') {
        toggle();
        e.preventDefault();
      }
    });
  })();
