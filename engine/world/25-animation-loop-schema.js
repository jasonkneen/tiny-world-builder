  // -------- animation loop --------
  let prevT = 0;
  let smokeTimer = 0;
  // Item 5 — Page Visibility pause only. The earlier DPR backoff path
  // was removed because renderer.setPixelRatio reallocates the shadow
  // map and left it blank until the next click forced a re-render
  // (tinyworld's existing render-settings resolution slider already
  // covers manual perf tuning).
  let docHidden = false;
  document.addEventListener('visibilitychange', () => {
    docHidden = !!document.hidden;
  });

  function animate(now, xrFrame) {
    if (docHidden && !xrSession) {
      // Tab is backgrounded — keep the rAF heartbeat (browsers throttle
      // it anyway) but skip per-frame work + render. prevT reset so the
      // first frame after resume doesn't see a giant dt.
      prevT = 0;
      return;
    }
    const t = now / 1000;
    const dt = prevT ? Math.min(t - prevT, 0.05) : 0;
    prevT = t;

    // tile/object drop-in animations (load + placement)
    let tickStart = repaintProfileBegin();
    if (dropAnims.length) tickDropAnims(dt);
    if (typeof tickGhostHolo === 'function') tickGhostHolo(t);
    if (typeof tickIslandPlacementHolos === 'function') tickIslandPlacementHolos(t);
    if (typeof tickRadialMenu === 'function') tickRadialMenu();
    if (homeTween) tickHomeTween(dt);
    tickOpacityTransitions(dt);
    tickSquashAnims(dt);
    if (rippleAnims.length) tickRippleAnims(dt);
    if (fp.active) tickFP(dt);
    if (typeof window.__showcaseTick === 'function') window.__showcaseTick(dt);
    if (typeof window.__tinyworldVdbTick === 'function') window.__tinyworldVdbTick(t);
    if (window.__tinyworldSubEdit && typeof window.__tinyworldSubEdit._tickExplode === 'function') window.__tinyworldSubEdit._tickExplode(dt);
    if (window.__tinyworldWatcherLayer && typeof window.__tinyworldWatcherLayer.tick === 'function') {
      try { window.__tinyworldWatcherLayer.tick(t, dt); } catch (_) {}
    }
    repaintProfileEnd('tick.anim', tickStart);

    tickStart = repaintProfileBegin();
    tickWeather(dt);
    repaintProfileEnd('tick.weather', tickStart);

    tickStart = repaintProfileBegin();
    tickIslandRocketEngines(t, dt);
    updateEditableIslandLods();
    if (typeof tickEditableIslandWarpArrivals === 'function') tickEditableIslandWarpArrivals(dt);
    tickEditableIslandEngines(dt, t);
    repaintProfileEnd('tick.islands', tickStart);

    tickStart = repaintProfileBegin();
    tickUndersideDebris(dt);
    updateClouds(dt);
    if (typeof tickCloudSea === 'function') tickCloudSea(t, dt);
    if (typeof updateStarlitAtmosphere === 'function') updateStarlitAtmosphere(dt);
    if (typeof tickVoxelShield === 'function') tickVoxelShield(dt, t);
    tickWaterTextureFlow(dt);
    updateWaterfallEffects(t);
    if (typeof window.__tinyworldShaderFXTick === 'function') window.__tinyworldShaderFXTick(t, dt);
    repaintProfileEnd('tick.effects', tickStart);

    tickStart = repaintProfileBegin();
    tickVehicles(dt);
    if (window.__tinyworldRaceTrack && typeof window.__tinyworldRaceTrack._tick === 'function') window.__tinyworldRaceTrack._tick(dt);
    repaintProfileEnd('tick.vehicles', tickStart);

    tickStart = repaintProfileBegin();
    if (crowdEnabled && crowdLayer) {
      crowdLayer.update(dt, camera);
      updateCrowdModelActors(dt);
    } else {
      clearCrowdModelActors();
    }
    repaintProfileEnd('tick.crowd', tickStart);

    tickStart = repaintProfileBegin();
    updateCropDuster(dt);
    if (typeof tickIslandBanners === 'function') tickIslandBanners(t);
    if (typeof tickPositionalAudio === 'function') tickPositionalAudio();
    repaintProfileEnd('tick.ambient', tickStart);

    // Stream LandscapeEngine chunks when in landscape mesh mode. Auto-expand
    // reveals by moving the clip window, not by building ghost/base boards.
    tickStart = repaintProfileBegin();
    if (isLandscapeMeshActive()) {
      landscapeMeshEngine.update(landscapeMeshFocusPos(), dt);
      if (renderAutoExpand || hasUserPanned) updateLandscapeClipBounds();
    }
    if (isPlanetLandscapeActive()) {
      tickPlanetLandscapeStream(dt);
      updatePlanetAtmosphere(dt);
    } else if (planetAtmosphereGroup) {
      updatePlanetAtmosphere(dt);
    }
    repaintProfileEnd('tick.landscape', tickStart);

    tickStart = repaintProfileBegin();
    if (useWindowedHomeRendering()) {
      requestHomeRenderWindowSync();
      if (homeRenderQueue.length) processHomeRenderQueue(5);
    }
    repaintProfileEnd('tick.homeQueue', tickStart);

    // Drain the ghost-board build queue in small slices so visible-distance
    // changes and Reset don't lock up the frame.
    if (pendingGhostBoards.length) processGhostBoardQueue(6);

    // React to camera movement/zoom for progressive ghost quality
    tickStart = repaintProfileBegin();
    maybeReevaluateGhostDetails();
    repaintProfileEnd('tick.ghosts', tickStart);

    // Sway only the roots that can actually animate. Scanning every cell
    // every frame becomes noticeable once generated worlds get busy.
    tickStart = repaintProfileBegin();
    for (const obj of animatedCellObjects) {
      if (!runtimeRootVisible(obj)) {
        if (!obj || !obj.parent) animatedCellObjects.delete(obj);
        continue;
      }
      const k = obj.userData.kind;
      if (k === 'tree') {
        obj.rotation.z = Math.sin(t * 0.85 + obj.userData.swayPhase) * 0.022;
        obj.rotation.x = Math.cos(t * 0.65 + obj.userData.swayPhase) * 0.012;
      } else if (k === 'tuft') {
        obj.rotation.z = Math.sin(t * 1.2 + (obj.userData.gx + obj.userData.gz)) * 0.05;
      } else if (windAnimatedPlantKinds.has(k)) {
        const phase = (obj.userData.swayPhase || 0) + (obj.userData.gx || 0) * 0.41 + (obj.userData.gz || 0) * 0.23;
        const tall = k === 'corn' || k === 'sunflower' || k === 'wheat';
        const amp = tall ? 0.028 : 0.014;
        obj.rotation.z = Math.sin(t * (tall ? 1.15 : 0.82) + phase) * amp;
        obj.rotation.x = Math.cos(t * 0.72 + phase) * amp * 0.45;
      }
    }

    // chimney smoke — skip while the house is still landing (origin would be airborne)
    smokeTimer += dt;
    if (smokeTimer > 0.32) {
      smokeTimer = 0;
      let spawned = 0;
      for (const o of smokeHouseObjects) {
        if (!runtimeRootVisible(o)) {
          if (!o || !o.parent) smokeHouseObjects.delete(o);
          continue;
        }
        if (o && o.userData.kind === 'house' && !o.userData.landing) {
          spawnSmoke(o);
          spawned++;
          if (spawned >= 4 || smokeParticles.length >= MAX_SMOKE_PARTICLES) break;
        }
      }
    }
    updateSmoke(dt);
    if (typeof updatePipeEmitters === 'function') updatePipeEmitters(dt);
    updateXRFrame(xrFrame);
    repaintProfileEnd('tick.runtime', tickStart);

    if (window.tickFlight) window.tickFlight(dt);
    // CCTV/Truman feeds capture to their render targets BEFORE the main render so
    // the freshly-captured surveillance picture appears in the same frame.
    if (window.__tinyworldCCTV && typeof window.__tinyworldCCTV.tick === 'function') {
      try { window.__tinyworldCCTV.tick(t, dt); } catch (_) {}
    }
    // Lobby presentation screen: auto-advance slides and cut to the hottest cam feed.
    if (window.__tinyworldLobby && typeof window.__tinyworldLobby.tick === 'function') {
      try { window.__tinyworldLobby.tick(t, dt); } catch (_) {}
    }
    // CCTV-only view mode (?view=cctv): draw the feed wall to the canvas instead
    // of the world. Falls back to renderScene() until the feeds are mounted.
    const cv = window.__tinyworldCctvView;
    if (cv && cv.active) {
      let drew = false;
      try { drew = cv.renderWall(); } catch (_) {}
      if (!drew) renderScene();
    } else {
      renderScene();
    }
    if (window.__renderFlightInsetView) window.__renderFlightInsetView();
  }

  // -------- resize --------
  function onResize() {
    const { w, h } = applyStageSize();
    const aspect = w / h;

    orthoCam.left = -viewSize * aspect;
    orthoCam.right = viewSize * aspect;
    orthoCam.top = viewSize;
    orthoCam.bottom = -viewSize;
    orthoCam.updateProjectionMatrix();

    persCam.aspect = aspect;
    persCam.updateProjectionMatrix();

    updateCamera();
    // Reposition fly-out if visible (anchored to the active tool button).
    const fl = document.getElementById('flyout');
    if (fl && !fl.hidden && selectedTool && selectedTool.variants) {
      const btn = document.querySelector('.tool[data-id="' + selectedTool.id + '"]');
      if (btn) positionFlyout(btn, fl);
    }
    // renderer.setSize() resets the canvas drawing buffer (blanks it); re-render
    // immediately so the scene is visible during a live resize drag.
    renderScene();
  }
  window.addEventListener('resize', onResize);

  // -------- world schema (canonical) --------
  // Embedded copy of world.schema.json. Sent to AI providers as the contract
  // for generated worlds. The schema also defines the import format accepted
  // by applyState — exporting writes tuples for compactness, but applyState
  // accepts the object form too (so AI output drops in unchanged).
  const WORLD_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://tinyworld.local/world.schema.json",
    "title": "TinyWorld",
    "description": "Scene description for the Tiny World Builder. The renderer supports home grids from 8x8 to 20x20, plus sparse user-edited ghost-board cells outside the home grid. Each non-default cell has a terrain, optional object kind, separate object floors and terrainFloors counts, optional house buildingType, optional fenceSide, optional decorative extras, optional within-tile transform, and optional appearance overrides.",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "v",
      "cells"
    ],
    "properties": {
      "v": {
        "type": "integer",
        "enum": [
          4
        ],
        "description": "Schema version. Must be 4."
      },
      "gridSize": {
        "type": "integer",
        "enum": [
          8,
          10,
          12,
          16,
          20
        ],
        "description": "Optional home board edge length. Defaults to the current app grid when omitted."
      },
      "cells": {
        "type": "array",
        "description": "Sparse list of non-default cells. The app exports compact tuple cells but also accepts object cells for AI/tooling convenience. Coordinates may include user-edited ghost-board cells outside the home grid.",
        "items": {
          "$ref": "#/$defs/cell"
        }
      },
      "islands": {
        "type": "array",
        "description": "Optional editable duplicate island boards. Cells on these islands use world coordinates derived from boardX/boardZ and are saved in cells only when non-default.",
        "items": {
          "$ref": "#/$defs/island"
        }
      },
      "moorings": {
        "type": "array",
        "description": "Optional point-to-point cable ties between the home board and duplicate islands. Anchors are stored in home or island local coordinates so cables follow moved islands.",
        "maxItems": 96,
        "items": {
          "$ref": "#/$defs/mooring"
        }
      },
      "cameraMode": {
        "type": "string",
        "enum": [
          "ortho",
          "topdown",
          "perspective",
          "tp",
          "fp"
        ],
        "description": "Optional preferred camera. Saved worlds usually use ortho, perspective, third-person walk, or first-person walk; topdown is accepted for imports."
      },
      "toolId": {
        "type": "string",
        "description": "Optional tool to leave selected after load. Ignored if unknown."
      },
      "useLandscapeEngine": {
        "type": "boolean",
        "description": "Optional legacy/generated flag for discrete LandscapeEngine-derived worlds."
      },
      "landscapeMeshMode": {
        "type": "boolean",
        "description": "Optional flag that restores continuous LandscapeEngine terrain in place of home-board tile meshes."
      },
      "landscapeMeshBiome": {
        "type": "string",
        "enum": [
          "grassland",
          "desert",
          "snow"
        ],
        "description": "Optional biome used by continuous LandscapeEngine terrain."
      },
      "landscapeMeshStyle": {
        "type": "string",
        "enum": [
          "lowpoly",
          "realistic"
        ],
        "description": "Optional material style used by continuous LandscapeEngine terrain."
      },
      "landscapeEngineSeed": {
        "type": [
          "number",
          "string",
          "null"
        ],
        "description": "Optional LandscapeEngine seed for restored continuous or sampled terrain."
      },
      "landscapeEngineBiome": {
        "type": [
          "string",
          "null"
        ],
        "enum": [
          "grassland",
          "desert",
          "snow",
          null
        ],
        "description": "Optional LandscapeEngine biome for restored continuous or sampled terrain."
      },
      "planetLandscape": {
        "type": [
          "object",
          "null"
        ],
        "additionalProperties": false,
        "description": "Optional LandscapeEngine planet surface rendered below the floating home board.",
        "properties": {
          "enabled": {
            "type": "boolean"
          },
          "seed": {
            "type": [
              "number",
              "string"
            ]
          },
          "biome": {
            "type": "string",
            "enum": [
              "grassland",
              "desert",
              "snow"
            ]
          },
          "styleMode": {
            "type": "string",
            "enum": [
              "lowpoly",
              "realistic"
            ]
          },
          "drop": {
            "type": "number",
            "minimum": 20,
            "maximum": 300
          }
        }
      }
    },
    "$defs": {
      "coord": {
        "type": "integer",
        "minimum": -1024,
        "maximum": 1024
      },
      "terrain": {
        "type": "string",
        "enum": [
          "grass",
          "path",
          "dirt",
          "water",
          "stone",
          "lava",
          "sand",
          "snow"
        ],
        "description": "Tile material. Water and lava normally clear hosted kinds except bridge/rock handling in the renderer. Dirt is auto-applied under crops. Stone/snow read as mountain caps; sand as a water-edge beach."
      },
      "kind": {
        "type": [
          "string",
          "null"
        ],
        "enum": [
          null,
          "house",
          "tree",
          "fence",
          "rock",
          "bridge",
          "crop",
          "corn",
          "wheat",
          "pumpkin",
          "carrot",
          "sunflower",
          "tuft",
          "flower",
          "bush",
          "cow",
          "sheep",
          "lamp-post",
          "spotlight",
          "voxel-build",
          "model-stamp",
          "artifact",
          "relic",
          "crystal",
          "totem",
          "ruins",
          "stargate"
        ]
      },
      "island": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "boardX",
          "boardZ"
        ],
        "properties": {
          "id": {
            "type": "string"
          },
          "boardX": {
            "type": "integer",
            "minimum": -1024,
            "maximum": 1024
          },
          "boardZ": {
            "type": "integer",
            "minimum": -1024,
            "maximum": 1024
          },
          "positionX": {
            "type": "number"
          },
          "positionY": {
            "type": "number"
          },
          "positionZ": {
            "type": "number"
          },
          "rotationY": {
            "type": "number"
          },
          "engines": {
            "type": "array",
            "maxItems": 4,
            "items": {
              "$ref": "#/$defs/islandEngine"
            }
          }
        }
      },
      "islandEngine": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string"
          },
          "slot": {
            "type": "integer",
            "minimum": 0,
            "maximum": 3
          },
          "type": {
            "type": "string",
            "enum": [
              "lift",
              "turbo",
              "heavy"
            ]
          },
          "level": {
            "type": "integer",
            "minimum": 1,
            "maximum": 3
          },
          "installed": {
            "type": "boolean"
          }
        }
      },
      "mooring": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "a",
          "b"
        ],
        "properties": {
          "id": {
            "type": "string"
          },
          "a": {
            "$ref": "#/$defs/mooringAnchor"
          },
          "b": {
            "$ref": "#/$defs/mooringAnchor"
          }
        }
      },
      "mooringAnchor": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "scope",
          "local"
        ],
        "properties": {
          "scope": {
            "type": "string",
            "enum": [
              "home",
              "island"
            ]
          },
          "islandId": {
            "type": [
              "string",
              "null"
            ]
          },
          "local": {
            "$ref": "#/$defs/vector3"
          }
        }
      },
      "vector3": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "x",
          "y",
          "z"
        ],
        "properties": {
          "x": {
            "type": "number",
            "minimum": -2048,
            "maximum": 2048
          },
          "y": {
            "type": "number",
            "minimum": -2048,
            "maximum": 2048
          },
          "z": {
            "type": "number",
            "minimum": -2048,
            "maximum": 2048
          }
        }
      },
      "buildingType": {
        "type": [
          "string",
          "null"
        ],
        "enum": [
          null,
          "cottage",
          "manor",
          "tower",
          "turret",
          "skyscraper"
        ]
      },
      "fenceSide": {
        "type": [
          "string",
          "null"
        ],
        "enum": [
          null,
          "n",
          "s",
          "e",
          "w",
          "center-x",
          "center-z"
        ]
      },
      "extra": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "kind": {
            "type": "string",
            "enum": [
              "fence",
              "tuft"
            ]
          },
          "k": {
            "type": "string",
            "enum": [
              "fence",
              "tuft"
            ]
          },
          "fenceSide": {
            "$ref": "#/$defs/fenceSide"
          },
          "s": {
            "$ref": "#/$defs/fenceSide"
          },
          "floors": {
            "type": "integer",
            "minimum": 1,
            "maximum": 8
          },
          "f": {
            "type": "integer",
            "minimum": 1,
            "maximum": 8
          },
          "appearance": {
            "$ref": "#/$defs/appearance"
          },
          "a": {
            "$ref": "#/$defs/appearance"
          }
        },
        "anyOf": [
          {
            "required": [
              "kind"
            ]
          },
          {
            "required": [
              "k"
            ]
          }
        ]
      },
      "extras": {
        "type": [
          "array",
          "null"
        ],
        "items": {
          "$ref": "#/$defs/extra"
        }
      },
      "appearance": {
        "type": [
          "object",
          "null"
        ],
        "additionalProperties": false,
        "properties": {
          "bodyColor": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$"
          },
          "topColor": {
            "type": "string",
            "pattern": "^#[0-9a-fA-F]{6}$"
          },
          "voxelBuildId": {
            "type": "string",
            "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$"
          },
          "modelStampId": {
            "type": "string",
            "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$"
          },
          "objectScale": {
            "type": "number",
            "minimum": 0.2,
            "maximum": 24
          },
          "scaleX": {
            "type": "number",
            "minimum": 0.15,
            "maximum": 24
          },
          "scaleY": {
            "type": "number",
            "minimum": 0.15,
            "maximum": 24
          },
          "scaleZ": {
            "type": "number",
            "minimum": 0.15,
            "maximum": 24
          },
          "materialTexture": {
            "type": "string"
          },
          "materialTextureScale": {
            "type": "number",
            "minimum": 0.5,
            "maximum": 4
          },
          "bodyTexture": {
            "type": "string"
          },
          "bodyTextureScale": {
            "type": "number",
            "minimum": 0.5,
            "maximum": 4
          },
          "topTexture": {
            "type": "string"
          },
          "topTextureScale": {
            "type": "number",
            "minimum": 0.5,
            "maximum": 4
          },
          "objectStyle": {
            "type": "string",
            "enum": [
              "normal",
              "voxel"
            ]
          },
          "fenceStyle": {
            "type": "string",
            "enum": [
              "garden"
            ]
          }
        }
      },
      "transform": {
        "oneOf": [
          {
            "type": "array",
            "minItems": 3,
            "maxItems": 4,
            "prefixItems": [
              {
                "type": "number",
                "description": "rotationY in radians"
              },
              {
                "type": "number",
                "description": "offsetX in tile units"
              },
              {
                "type": "number",
                "description": "offsetZ in tile units"
              },
              {
                "type": "number",
                "description": "offsetY in tile units"
              }
            ],
            "items": false
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "rotationY": {
                "type": "number"
              },
              "offsetX": {
                "type": "number"
              },
              "offsetZ": {
                "type": "number"
              },
              "offsetY": {
                "type": "number"
              }
            }
          }
        ]
      },
      "cellObject": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "x",
          "z",
          "terrain",
          "kind",
          "floors",
          "terrainFloors",
          "buildingType",
          "fenceSide"
        ],
        "properties": {
          "x": {
            "$ref": "#/$defs/coord"
          },
          "z": {
            "$ref": "#/$defs/coord"
          },
          "terrain": {
            "$ref": "#/$defs/terrain"
          },
          "kind": {
            "$ref": "#/$defs/kind"
          },
          "floors": {
            "type": "integer",
            "minimum": 1,
            "maximum": 8,
            "description": "Object stack/intensity count. For houses it means floors; for non-house props/crops it is enhancement density from repeat taps. It must not be used to raise the ground."
          },
          "terrainFloors": {
            "type": "integer",
            "minimum": 1,
            "maximum": 8,
            "description": "Ground height stack for the terrain layer only. Terrain repeat taps raise this value. Object repeat taps raise floors instead."
          },
          "buildingType": {
            "$ref": "#/$defs/buildingType"
          },
          "fenceSide": {
            "$ref": "#/$defs/fenceSide"
          },
          "extras": {
            "$ref": "#/$defs/extras"
          },
          "transform": {
            "$ref": "#/$defs/transform"
          },
          "appearance": {
            "$ref": "#/$defs/appearance"
          },
          "customName": {
            "type": "string",
            "description": "Optional short name for a bespoke custom object authored via customParts."
          },
          "customFootprint": {
            "type": "number",
            "minimum": 0.6,
            "maximum": 3.2,
            "description": "Optional initial render footprint in tile units for customParts. Use about 1.1 for compact bridges/props, 1.2 for normal single-cell objects, and 1.5-1.8 only for deliberate hero objects."
          },
          "customParts": {
            "$ref": "#/$defs/customParts"
          }
        }
      },
      "customParts": {
        "type": "array",
        "description": "Optional bespoke custom 3D object authored inline as low-poly primitive parts. When present this cell becomes a unique voxel object (it overrides kind). Use for hero/landmark things with no native kind: windmill, statue, fountain, vehicle, robot, lighthouse, ship, glass greenhouse, dome, airship, sign, etc. Keep parts connected and roughly within a compact 1-cell footprint unless the object is explicitly a larger hero. Use native houses/fences/rocks/trees/terrain only when those components are actually needed.",
        "maxItems": 180,
        "items": {
          "$ref": "#/$defs/customPart"
        }
      },
      "customPart": {
        "type": "object",
        "additionalProperties": false,
        "required": ["kind", "material", "size", "pos"],
        "description": "One low-poly primitive of a custom object. Coordinates are voxel units centered on the tile (x left-right, y up, z front-back). Use sphere/ellipsoid for rounded envelopes, domes, canopies, and tanks. Sphere/ellipsoid parts may use phiStart/phiLength/thetaStart/thetaLength for curved slices, such as balloon fabric panels. Use cable for ropes, tethers, rigging, and mooring-style connections; cable parts must include from/to endpoints and should still include size/pos for compatibility.",
        "properties": {
          "kind": { "type": "string", "enum": ["box", "cylinder", "cone", "sphere", "ellipsoid", "cable"] },
          "material": { "type": "string", "description": "Color/material name. Prefer exact TinyWorld names such as wood, woodDark, woodLight, leather, rope, ropeLight, cable, stone, stoneDark, metal, steel, silver, brass, brassDark, copper, bronze, glass, glassBlue, glassGreen, fabric, canvas, fabricRed, fabricOrange, fabricYellow, fabricBlue, fabricPurple, fabricGreen, roof, roofEdge, white, cream, red, orange, yellow, blue, teal, purple, green, black, charcoal. Do not default to stone unless the part is stone." },
          "size": { "type": "array", "minItems": 3, "maxItems": 3, "items": { "type": "number" } },
          "pos": { "type": "array", "minItems": 3, "maxItems": 3, "items": { "type": "number" } },
          "scale": { "type": "array", "minItems": 3, "maxItems": 3, "items": { "type": "number" } },
          "from": { "type": "array", "minItems": 3, "maxItems": 3, "items": { "type": "number" } },
          "to": { "type": "array", "minItems": 3, "maxItems": 3, "items": { "type": "number" } },
          "radius": { "type": "number", "minimum": 0.006, "maximum": 0.3 },
          "sag": { "type": "number", "minimum": -8, "maximum": 8 },
          "segments": { "type": "integer", "minimum": 4, "maximum": 64 },
          "verticalSegments": { "type": "integer", "minimum": 3, "maximum": 24 },
          "phiStart": { "type": "number", "minimum": 0, "maximum": 6.28319 },
          "phiLength": { "type": "number", "minimum": 0.05, "maximum": 6.28319 },
          "thetaStart": { "type": "number", "minimum": 0, "maximum": 3.14159 },
          "thetaLength": { "type": "number", "minimum": 0.05, "maximum": 3.14159 }
        }
      },
      "cellTuple": {
        "type": "array",
        "minItems": 4,
        "maxItems": 11,
        "prefixItems": [
          {
            "$ref": "#/$defs/coord",
            "description": "x"
          },
          {
            "$ref": "#/$defs/coord",
            "description": "z"
          },
          {
            "$ref": "#/$defs/terrain"
          },
          {
            "$ref": "#/$defs/kind"
          },
          {
            "type": "integer",
            "minimum": 1,
            "maximum": 8,
            "description": "floors"
          },
          {
            "$ref": "#/$defs/buildingType"
          },
          {
            "type": "integer",
            "minimum": 1,
            "maximum": 8,
            "description": "terrainFloors"
          },
          {
            "$ref": "#/$defs/fenceSide"
          },
          {
            "$ref": "#/$defs/extras"
          },
          {
            "$ref": "#/$defs/transform"
          },
          {
            "$ref": "#/$defs/appearance"
          }
        ],
        "items": false
      },
      "cell": {
        "oneOf": [
          {
            "$ref": "#/$defs/cellObject"
          },
          {
            "$ref": "#/$defs/cellTuple"
          }
        ]
      }
    }
  };
