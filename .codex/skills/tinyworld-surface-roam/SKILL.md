# tinyworld-surface-roam

Surface-roam free movement on the Skybound procedural poser planet surface.

## What it does

When the player descends via J (module `54-fly-down.js`) and the fly-down animation finishes, module `47-worlds-room.js` automatically activates **surface roam mode**:

- **Camera-relative WASD** walk + **drag-look** mouse look (capture-phase so it beats grid handlers). Screen-right = `cross(forward, up)` = `(-cosYaw, sinYaw)` — pressing D moves screen-right.
- **Scroll wheel** zooms the chase cam (`_srCamDist`, range `SR_CAM_MIN`..`SR_CAM_MAX`). Zoom in past `SR_FP_THRESH` → **first-person**: camera at the eye (`_srEyeH`), `setFirstPerson(true)` hides the avatar head, arms/torso stay (Minecraft-style); pitch range widens (`SR_FP_PITCH_*`) so you can look up.
- **Space** = tap to **jump** (parabolic arc, rig `jump`); **double-tap** Space (`SR_DBL_MS`) toggles **fly mode**. In fly mode: Space = rise, **C** = sink.
- **F** = **attack/swing** (rig `attack`, cycles 3 swings). `_srStep` never stomps an in-flight `attack`/`jump` (the rig auto-reverts to idle).
- **Shift** doubles walk speed (sprint).
- **Stargate round-trip**: walk onto the **sky-edge gate** cell (`__tinyworldGateTransit.skyGateCell()`) → `FlyDown.descend()`; on the surface, walk into the **mainland gate** (placed at surface-local 0,0; you spawn `SR_GATE_SPAWN` in front of it) → `FlyDown.ascend()`. `SR_GATE_R` is the trigger radius; `_srGateArmed` blocks re-trigger until you've stepped clear. **J** still toggles descend/ascend as a shortcut.
- The floating-island edge is **solid** (the old walk-off-edge skyfall + its rings are retired — `startSkyfall()` returns false).
- A compact HUD (`#tw-surface-roam-hud`) shows the mode (SURFACE/FLYING/1ST-PERSON) and key hints.

## Polling pattern

`54-fly-down.js` exposes `window.__tinyworldFlyDown.state()` returning `{ down, transitioning, phase }`. `47-worlds-room.js` polls this every avatar RAF tick (`_srPollFlyDown()`) — no custom events needed. This avoids the closure problem where `finishEase` is inaccessible from outside the IIFE.

## Height sampling

`57-poser-surface.js` exposes `window.__tinyworldPoserSurface.sampleWorld(wx, wz)` returning `{ walkWorldY, localH, water }`. The surface group (`group`) is placed at `(target.x, -DROP, target.z)` by `show()` and does not move after that.

**Critical**: `sampleWorld` and `worldToLocal` read `group.position.x/z` (the stable anchor) NOT `target.x/z` (which moves every frame during camera updates). Using `target` creates a feedback loop: camera update writes `target`, then `sampleWorld` reads wrong origin, then avatar height oscillates.

```js
// correct — stable anchor
const gx = (group && group.position) ? group.position.x : 0;
// wrong — drifts every frame
const gx = target.x;
```

## State variables (all prefixed `_sr`)

Declared inside the `47-worlds-room.js` IIFE, never top-level globals:

| Variable | Purpose |
|---|---|
| `_srActive` | master flag; all guards check this |
| `_srYaw`, `_srPitch` | drag-look angles |
| `_srX`, `_srZ`, `_srY` | avatar world position |
| `_srVY` | vertical velocity (fly mode) |
| `_srFlying` | whether in fly/gravity-off mode |
| `_srKeys` | WASD/Space/C/Shift state |
| `_srWasDown` | previous poll result (edge detection) |
| `selfEnt._srActive` | per-entity flag — guards `updateSelfAvatar` presence echoes |

## Guards you must keep

```js
// step() — no grid moves during surface roam
if (selfEnt && (selfEnt._traveling || selfEnt._climb || selfEnt._skyfall || selfEnt._srActive)) return;

// updateSelfAvatar() — don't let presence echoes yank avatar back to grid
if (selfEnt._srActive) return;

// animVoxel / animEntity — delegate tick to _srStep
if (ent === selfEnt && ent._srActive) { _srStep(dt); updateBubble(ent); return; }

// updateAvatarCameraOrbit — delegate camera to _srUpdateCamera
if (selfEnt._srActive) { _srUpdateCamera(); return; }
```

## CSS

```css
body.surface-roam-active { cursor: crosshair; }
#tw-surface-roam-hud { /* fixed top-center compact HUD */ }
```

## Speed/camera constants

| Constant | Value | Meaning |
|---|---|---|
| `SR_WALK` | 3.2 | walk speed (units/s) |
| `SR_SPRINT` | 6.4 | sprint speed |
| `SR_FLY_V` | 4.0 | vertical fly velocity |
| `SR_CAM_DIST` | 5.0 | chase-cam distance behind avatar |
| `SR_CAM_UP` | 2.4 | chase-cam height offset |
| `SR_DRAG_SENS` | 0.005 | mouse drag sensitivity (rad/px) |

## Files

- `engine/world/47-worlds-room.js` — surface roam controller (`_sr*` functions and state)
- `engine/world/54-fly-down.js` — exposes `state()` on `window.__tinyworldFlyDown`
- `engine/world/57-poser-surface.js` — exposes `sampleWorld`, `worldToLocal` on `window.__tinyworldPoserSurface`
- `styles/tiny-world.css` — HUD styles and cursor
