  // -------- voxel blast shield system --------
  // Port of the supplied Voxel Blast Shield Core. Kept as the same reusable
  // classes/API, adapted only for TinyWorld's classic-script runtime and scene.
  (function () {
    const SHIELD_POINT_LIGHT_CAP = 12;
    const SHIELD_SOURCE_SIDE = 31.5;
    const SHIELD_DEFAULT_SPEED = 0.28;
    const SHIELD_TINYWORLD_CORNER_XZ_SCALE = 2 / 3;
    const SHIELD_TINYWORLD_CORNER_HEIGHT_SCALE = 1.20;
    const SHIELD_TINYWORLD_PANEL_WIDTH_SCALE = 1.20;
    const SHIELD_TINYWORLD_PANEL_HEIGHT_SCALE = 1.20;
    const SHIELD_TINYWORLD_PANEL_DEPTH_SCALE = 0.30;
    const SHIELD_TINYWORLD_EDGE_INSET = 0.08;
    let voxelShieldDemo = null;

    function shieldAssert(condition, message) {
      if (!condition) throw new Error(message);
    }

    function shieldClamp01(value) {
      return Math.max(0, Math.min(1, value));
    }

    function shieldSmoothstep(value) {
      const t = shieldClamp01(value);
      return t * t * (3 - 2 * t);
    }

    function shieldLerp(a, b, t) {
      return a + (b - a) * t;
    }

    function shieldHash(n) {
      const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
      return x - Math.floor(x);
    }

    function shieldFlickerSignal(time, seed) {
      const fast = shieldHash(Math.floor(time * 30) + seed * 13.37);
      const pulse = 0.55 + 0.45 * Math.sin(time * 36 + seed);
      const dropout = fast > 0.72 ? 0.12 : 1.0;
      return shieldClamp01((0.35 + fast * 0.75) * pulse * dropout);
    }

    function setModuleGlow(root, power, flicker = 1) {
      const p = shieldClamp01(power) * flicker;

      root.traverse(child => {
        if (child.isMesh && child.userData.isShieldLight) {
          child.material.emissiveIntensity = child.userData.baseEmissiveIntensity * p;
          child.material.opacity = shieldLerp(0.25, 1, p);
        }

        if ((child.isPointLight || child.type === 'PointLight') && child.userData.isShieldLight) {
          if (child.userData.shieldLightMuted) {
            child.visible = false;
            child.intensity = 0;
          } else {
            child.visible = p > 0.015;
            child.intensity = child.userData.baseIntensity * p;
          }
        }
      });
    }

    function notifyVoxelShieldChanged(shield) {
      if (typeof window.updateShieldToolbarState === 'function') window.updateShieldToolbarState();
      window.dispatchEvent(new CustomEvent('tinyworld:shield-changed', {
        detail: {
          progress: shield ? shield.progress : 0,
          targetProgress: shield ? shield.targetProgress : 0,
        },
      }));
    }

    class VoxelKit {
      constructor() {
        this.box = new THREE.BoxGeometry(1, 1, 1);
        this.box.userData.cached = true;

        this.materials = {
          stone: new THREE.MeshStandardMaterial({ color: 0x3e4248, roughness: 0.88, metalness: 0.05 }),
          stoneDark: new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.95, metalness: 0.03 }),
          edge: new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: 0.9 }),
          slot: new THREE.MeshStandardMaterial({ color: 0x121821, roughness: 0.95, metalness: 0.1 }),
          glowBase: new THREE.MeshStandardMaterial({
            color: 0x26c8ff,
            emissive: 0x19bfff,
            emissiveIntensity: 0,
            roughness: 0.25,
            transparent: true,
            opacity: 0.35,
          }),
          glowFaintBase: new THREE.MeshStandardMaterial({
            color: 0x2d8fb6,
            emissive: 0x0e8ece,
            emissiveIntensity: 0,
            roughness: 0.35,
            transparent: true,
            opacity: 0.35,
          }),
        };
      }

      cube(parent, x, y, z, sx = 1, sy = 1, sz = 1, material = this.materials.stone, castShadow = true) {
        const mesh = new THREE.Mesh(this.box, material);
        mesh.position.set(x, y, z);
        mesh.scale.set(sx, sy, sz);
        mesh.castShadow = castShadow;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
      }

      glowCube(parent, x, y, z, sx, sy, sz, faint = false, baseIntensity = 2.6) {
        const material = (faint ? this.materials.glowFaintBase : this.materials.glowBase).clone();
        material.emissiveIntensity = 0;

        const mesh = this.cube(parent, x, y, z, sx, sy, sz, material, false);
        mesh.userData.isShieldLight = true;
        mesh.userData.baseEmissiveIntensity = baseIntensity;
        mesh.userData.noBatch = true;
        mesh.userData.noStaticBaseMerge = true;
        return mesh;
      }

      addPointGlow(parent, x, y, z, baseIntensity = 1.5, distance = 6) {
        const light = new THREE.PointLight(0x2dd7ff, 0, distance);
        light.position.set(x, y, z);
        light.castShadow = false;
        light.userData.isShieldLight = true;
        light.userData.baseIntensity = baseIntensity;
        parent.add(light);
        return light;
      }

      addRuneStrip(parent, height, depth, x = 0, seed = 1) {
        const z = depth / 2 + 0.08;
        this.glowCube(parent, x, height * 0.52, z, 0.12, height * 0.72, 0.08, true, 1.0);

        for (let i = 0; i < 3; i++) {
          const y = 0.9 + i * (height - 1.8) / 2;
          this.glowCube(parent, x - 0.25, y, z + 0.02, 0.42, 0.08, 0.08, false, 2.4);
          this.glowCube(parent, x + 0.25, y + 0.28, z + 0.02, 0.42, 0.08, 0.08, false, 2.4);
          this.glowCube(parent, x, y + 0.14, z + 0.03, 0.08, 0.44, 0.08, false, 2.4);
        }
      }

      addEnergySeams(parent, width, height, depth) {
        const z = depth / 2 + 0.09;
        this.glowCube(parent, -width / 2 + 0.22, height / 2, z, 0.06, height * 0.76, 0.08, false, 2.7);
        this.glowCube(parent, width / 2 - 0.22, height / 2, z, 0.06, height * 0.76, 0.08, false, 2.7);
        this.glowCube(parent, 0, height - 0.14, z, width * 0.72, 0.06, 0.08, true, 1.25);
      }

      addVoxelDamage(parent, width, height, depth, seed, damage = 0.25) {
        const chipCount = Math.floor(4 + damage * 12);

        for (let i = 0; i < chipCount; i++) {
          const side = shieldHash(seed + i * 3.2) > 0.5 ? -1 : 1;
          const x = side * (width / 2 - 0.18 - shieldHash(seed + i) * 0.38);
          const y = 0.55 + shieldHash(seed + i * 5.4) * (height - 1.0);
          const s = 0.16 + shieldHash(seed + i * 8.3) * 0.34;
          this.cube(parent, x, y, depth / 2 + 0.09, s, s, 0.1, this.materials.stoneDark);
        }

        const scars = Math.floor(width * height * 0.065);
        for (let i = 0; i < scars; i++) {
          const x = -width / 2 + 0.4 + Math.floor(shieldHash(seed + i * 4.1) * width);
          const y = 0.4 + Math.floor(shieldHash(seed + i * 6.7) * height);
          const material = shieldHash(seed + i * 1.9) > 0.5 ? this.materials.stoneDark : this.materials.edge;
          this.cube(parent, x, y, depth / 2 + 0.06, 0.32, 0.32, 0.08, material);
        }
      }
    }

    class BlastPanel extends THREE.Group {
      constructor({
        kit,
        width = 3.6,
        height = 4.5,
        depth = 0.6,
        seed = 1,
        damage = 0.25,
        gap = 0.08,
      } = {}) {
        super();

        if (!kit) throw new Error('BlastPanel requires a VoxelKit instance');

        this.kit = kit;
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.seed = seed;
        this.damage = damage;
        this.gap = gap;

        this.userData.kind = 'blast-panel';
        this.userData.width = width;
        this.userData.height = height;
        this.userData.depth = depth;
        this.userData.gap = gap;
        this.userData.closedPos = new THREE.Vector3();
        this.userData.finalPos = new THREE.Vector3();
        this.userData.outwardNormal = new THREE.Vector3(0, 0, 1);
        this.userData.deployOrder = 0;
        this.userData.lightPower = 0;

        this.build();
        if (typeof optimizeVoxelObjectGroup === 'function') optimizeVoxelObjectGroup(this, { reason: 'shield-panel', minInstances: 2 });
        setModuleGlow(this, 0);
      }

      build() {
        const k = this.kit;
        const m = k.materials;
        const { width, height, depth, seed, damage } = this;

        k.cube(this, 0, height / 2, 0, width, height, depth, m.stone);
        k.cube(this, 0, height + 0.18, 0, width + 0.16, 0.32, depth + 0.12, m.edge);
        k.cube(this, 0, 0.12, 0, width + 0.1, 0.24, depth + 0.08, m.stoneDark);

        const ribCount = Math.max(2, Math.floor(width / 1.25));
        for (let i = 0; i <= ribCount; i++) {
          const x = -width / 2 + i * (width / ribCount);
          k.cube(this, x, height / 2, depth / 2 + 0.04, 0.09, height * 0.96, 0.09, m.edge);
        }

        const rows = Math.floor(height / 0.85);
        for (let r = 1; r < rows; r++) {
          const y = r * height / rows;
          const rowOffset = shieldHash(seed + r) * 0.08;
          k.cube(this, rowOffset, y, depth / 2 + 0.04, width * 0.86, 0.06, 0.14, m.stoneDark);
        }

        k.addVoxelDamage(this, width, height, depth, seed, damage);
        k.addRuneStrip(this, height, depth, 0, seed);
        k.addEnergySeams(this, width, height, depth);
        k.glowCube(this, 0, height + 0.42, depth / 2 + 0.04, 0.34, 0.16, 0.34, false, 2.8);
        k.addPointGlow(this, 0, height + 0.42, depth / 2 + 0.04, 1.25, 6);
      }
    }

    class CornerKeystone extends THREE.Group {
      constructor({
        kit,
        size = 1.1,
        height = 5.25,
        seed = 100,
      } = {}) {
        super();

        if (!kit) throw new Error('CornerKeystone requires a VoxelKit instance');

        this.kit = kit;
        this.size = size;
        this.height = height;
        this.seed = seed;

        this.userData.kind = 'corner-keystone';
        this.userData.width = size;
        this.userData.height = height;
        this.userData.depth = size;
        this.userData.finalPos = new THREE.Vector3();
        this.userData.closedY = -height - 0.3;
        this.userData.lightPower = 0;

        this.build();
        if (typeof optimizeVoxelObjectGroup === 'function') optimizeVoxelObjectGroup(this, { reason: 'shield-keystone', minInstances: 2 });
        setModuleGlow(this, 0);
      }

      build() {
        const k = this.kit;
        const m = k.materials;
        const { size, height, seed } = this;
        const o = size / 2 + 0.04;

        k.cube(this, 0, height / 2, 0, size, height, size, m.stoneDark);
        k.cube(this, 0, height + 0.18, 0, size + 0.24, 0.34, size + 0.24, m.edge);
        k.cube(this, 0, 0.12, 0, size + 0.12, 0.24, size + 0.12, m.edge);

        const pillarThickness = 0.11;
        k.cube(this, -o, height / 2, 0, pillarThickness, height * 0.95, size + 0.11, m.edge);
        k.cube(this, o, height / 2, 0, pillarThickness, height * 0.95, size + 0.11, m.edge);
        k.cube(this, 0, height / 2, -o, size + 0.11, height * 0.95, pillarThickness, m.edge);
        k.cube(this, 0, height / 2, o, size + 0.11, height * 0.95, pillarThickness, m.edge);

        k.addRuneStrip(this, height, size, 0, seed);

        const sideRuneFace = new THREE.Group();
        k.addRuneStrip(sideRuneFace, height, size, 0, seed + 5);
        sideRuneFace.rotation.y = Math.PI / 2;
        this.add(sideRuneFace);

        k.glowCube(this, 0, height + 0.42, 0, 0.38, 0.16, 0.38, false, 2.8);
        k.addPointGlow(this, 0, height + 0.44, 0, 2.2, 8);
      }
    }

    class ShieldRing extends THREE.Group {
      constructor({
        kit,
        side = 31.5,
        panelWidth = 3.55,
        baseHeight = 4.7,
        depth = 0.6,
        gap = 0.08,
        cornerSize = 1.1,
        panelsPerCornerSide = 4,
        deploymentSpeed = SHIELD_DEFAULT_SPEED,
        showSlots = true,
        emergeFromIsland = false,
      } = {}) {
        super();

        if (!kit) throw new Error('ShieldRing requires a VoxelKit instance');

        this.kit = kit;
        this.side = side;
        this.panelWidth = panelWidth;
        this.baseHeight = baseHeight;
        this.depth = depth;
        this.gap = gap;
        this.cornerSize = cornerSize;
        this.panelsPerCornerSide = panelsPerCornerSide;
        this.deploymentSpeed = deploymentSpeed;
        this.showSlots = showSlots;
        this.emergeFromIsland = emergeFromIsland;
        this.panels = [];
        this.keystones = [];
        this.slots = [];
        this.progress = 0;
        this.targetProgress = 0;
        this._settled = false;
        this.userData.kind = 'shield-ring';
        this.userData.noPointerPick = true;

        this.build();
        this.optimiseForTinyWorld();
        this.applyDeployment(0, 0);
      }

      build() {
        const half = this.side / 2;
        this.addDeploymentSlots(half);
        this.addCorners(half);
        this.addRussianDollPanelChains(half);
      }

      addDeploymentSlots(half) {
        const k = this.kit;
        const m = k.materials;
        const slotY = -0.08;
        const length = this.side + 1.2;
        const thickness = 0.1;
        const width = 0.85;

        this.slots.push(k.cube(this, 0, slotY, -half, length, thickness, width, m.slot, false));
        this.slots.push(k.cube(this, 0, slotY, half, length, thickness, width, m.slot, false));
        this.slots.push(k.cube(this, half, slotY, 0, width, thickness, length, m.slot, false));
        this.slots.push(k.cube(this, -half, slotY, 0, width, thickness, length, m.slot, false));
        if (!this.showSlots) {
          this.slots.forEach(slot => {
            slot.visible = false;
            slot.userData.noBatch = true;
          });
        }
      }

      addCorners(half) {
        const positions = [
          [-half, -half],
          [ half, -half],
          [ half,  half],
          [-half,  half],
        ];

        positions.forEach(([x, z], index) => {
          const keystone = new CornerKeystone({
            kit: this.kit,
            size: this.cornerSize,
            height: this.baseHeight + 0.85 + shieldHash(index + 88) * 0.35,
            seed: 200 + index,
          });

          keystone.userData.finalPos.set(x, 0, z);
          keystone.position.set(x, keystone.userData.closedY, z);
          keystone.rotation.y = index * Math.PI / 2;
          this.keystones.push(keystone);
          this.add(keystone);
        });
      }

      addRussianDollPanelChains(half) {
        const cornerPoints = [
          new THREE.Vector3(-half, 0, -half),
          new THREE.Vector3( half, 0, -half),
          new THREE.Vector3( half, 0,  half),
          new THREE.Vector3(-half, 0,  half),
        ];

        const sideDefs = [
          { sideIndex: 0, a: 0, b: 1, rotationY: Math.PI, outward: new THREE.Vector3(0, 0, -1) },
          { sideIndex: 1, a: 1, b: 2, rotationY: Math.PI / 2, outward: new THREE.Vector3(1, 0, 0) },
          { sideIndex: 2, a: 2, b: 3, rotationY: 0, outward: new THREE.Vector3(0, 0, 1) },
          { sideIndex: 3, a: 3, b: 0, rotationY: -Math.PI / 2, outward: new THREE.Vector3(-1, 0, 0) },
        ];

        sideDefs.forEach(side => {
          const start = cornerPoints[side.a];
          const end = cornerPoints[side.b];
          const direction = end.clone().sub(start).normalize();
          const inwardA = start.clone().add(direction.clone().multiplyScalar(this.cornerSize * 0.65));
          const inwardB = end.clone().add(direction.clone().multiplyScalar(-this.cornerSize * 0.65));
          const chainLength = inwardA.distanceTo(inwardB) / 2;
          const count = this.panelsPerCornerSide;
          const slotWidth = (chainLength - (count - 1) * this.gap) / count;

          this.addPanelChain({
            side,
            cornerIndex: side.a,
            cornerPosition: start,
            direction,
            rotationY: side.rotationY,
            outward: side.outward,
            slotWidth,
            chainSide: 'from-start',
          });

          this.addPanelChain({
            side,
            cornerIndex: side.b,
            cornerPosition: end,
            direction: direction.clone().multiplyScalar(-1),
            rotationY: side.rotationY,
            outward: side.outward,
            slotWidth,
            chainSide: 'from-end',
          });
        });
      }

      addPanelChain({ side, cornerIndex, cornerPosition, direction, rotationY, outward, slotWidth, chainSide }) {
        const inset = this.cornerSize * 0.65;
        const tinyNestedOffset = 0.12;

        for (let i = 0; i < this.panelsPerCornerSide; i++) {
          const height = this.baseHeight + (shieldHash(side.sideIndex * 31 + cornerIndex * 11 + i * 7) - 0.5) * 0.75;
          const width = slotWidth * (0.985 + (shieldHash(side.sideIndex * 47 + cornerIndex * 13 + i * 9) - 0.5) * 0.018);
          const damage = 0.15 + shieldHash(side.sideIndex * 91 + cornerIndex * 17 + i) * 0.45;

          const panel = new BlastPanel({
            kit: this.kit,
            width,
            height,
            depth: this.depth,
            seed: side.sideIndex * 100 + cornerIndex * 20 + i,
            damage,
            gap: this.gap,
          });

          const finalDistance = inset + slotWidth / 2 + i * (slotWidth + this.gap);
          const finalPos = cornerPosition.clone().add(direction.clone().multiplyScalar(finalDistance));
          const closedPos = cornerPosition.clone().add(direction.clone().multiplyScalar(inset * 0.25 + i * tinyNestedOffset));

          panel.userData.finalPos.copy(finalPos);
          panel.userData.closedPos.copy(closedPos);
          panel.userData.sideIndex = side.sideIndex;
          panel.userData.cornerIndex = cornerIndex;
          panel.userData.chainSide = chainSide;
          panel.userData.deployOrder = i;
          panel.userData.outwardNormal.copy(outward);
          panel.userData.finalHeight = height;
          panel.userData.lightSeed = side.sideIndex * 100 + cornerIndex * 10 + i;

          panel.rotation.y = rotationY;
          panel.position.copy(closedPos);
          panel.visible = false;
          panel.scale.x = 0.06;
          panel.scale.y = 0.04;
          panel.scale.z = 0.8;

          this.panels.push(panel);
          this.add(panel);
        }
      }

      optimiseForTinyWorld() {
        if (typeof optimizeVoxelObjectGroup === 'function') optimizeVoxelObjectGroup(this, { reason: 'shield-slots', minInstances: 2 });
        const liveLights = [];
        this.keystones.forEach(k => {
          k.traverse(o => {
            if ((o.isPointLight || o.type === 'PointLight') && o.userData.isShieldLight) liveLights.push(o);
          });
        });
        this.panels.forEach((panel, index) => {
          panel.traverse(o => {
            if ((o.isPointLight || o.type === 'PointLight') && o.userData.isShieldLight) {
              if (index % 4 === 0 || index % 4 === 3) liveLights.push(o);
              else o.userData.shieldLightMuted = true;
            }
          });
        });
        liveLights.forEach((light, index) => {
          light.userData.shieldLightMuted = index >= SHIELD_POINT_LIGHT_CAP;
        });
        this.userData.lightStats = {
          pointLights: liveLights.length,
          activeCap: SHIELD_POINT_LIGHT_CAP,
          muted: Math.max(0, liveLights.length - SHIELD_POINT_LIGHT_CAP),
        };
      }

      open() {
        this.targetProgress = 1;
        notifyVoxelShieldChanged(this);
      }

      close() {
        this.targetProgress = 0;
        notifyVoxelShieldChanged(this);
      }

      toggle() {
        this.targetProgress = this.targetProgress < 0.5 ? 1 : 0;
        notifyVoxelShieldChanged(this);
      }

      setProgress(progress) {
        this.progress = shieldClamp01(progress);
        this.targetProgress = this.progress;
        this.applyDeployment(this.progress, 0);
        notifyVoxelShieldChanged(this);
      }

      setSpeed(speed) {
        this.deploymentSpeed = Math.max(0.01, speed);
      }

      update(deltaTime, time) {
        this.progress = shieldLerp(this.progress, this.targetProgress, shieldClamp01(deltaTime * this.deploymentSpeed * 4));
        if (Math.abs(this.progress - this.targetProgress) < 0.001) this.progress = this.targetProgress;
        // Dirty-gate: animate only while moving toward target or inside the live-flicker band
        // (0.001 < progress < 0.986). Both settled states are time-independent and visually static
        // (closed => glow power 0; fully locked => flicker forced to 1), so once settled we apply one
        // final frame then skip subsequent frames. Mirrors the atmosphere dirty-flag in 39-atmosphere-effects.js.
        const active = this.progress !== this.targetProgress || (this.progress > 0.001 && this.progress < 0.986);
        if (!active && this._settled) return;
        this.applyDeployment(this.progress, time);
        this._settled = !active;
      }

      applyDeployment(progress, time) {
        const cornerPhase = shieldSmoothstep(progress / 0.28);
        const panelGlobal = shieldClamp01((progress - 0.18) / 0.82);
        const fullyLocked = progress > 0.985;
        const emergeFromIsland = this.emergeFromIsland === true;

        this.keystones.forEach((keystone, index) => {
          const final = keystone.userData.finalPos;
          const closedY = keystone.userData.closedY;
          const pop = Math.sin(cornerPhase * Math.PI) * 0.12;
          if (emergeFromIsland) {
            const heightScale = keystone.userData.tinyworldHeightScale || 1;
            keystone.position.set(final.x, final.y, final.z);
            keystone.scale.y = shieldLerp(0.02, heightScale, cornerPhase);
          } else {
            keystone.position.set(final.x, shieldLerp(closedY, final.y, cornerPhase) + pop, final.z);
          }
          keystone.visible = progress > 0.001;

          const keystonePower = shieldSmoothstep((progress - 0.78) / 0.18);
          const flicker = fullyLocked ? 1 : shieldFlickerSignal(time, index + 9);
          setModuleGlow(keystone, keystonePower, flicker);
          keystone.userData.lightPower = keystonePower * flicker;
        });

        this.panels.forEach(panel => {
          const order = panel.userData.deployOrder;
          const stagger = order * 0.16;
          const local = shieldSmoothstep((panelGlobal - stagger) / 0.38);
          const final = panel.userData.finalPos;
          const closed = panel.userData.closedPos;
          const emerge = shieldSmoothstep((panelGlobal - stagger * 0.85) / 0.22);
          const heightScale = panel.userData.tinyworldHeightScale || 1;
          const widthScale = panel.userData.tinyworldWidthScale || 1;
          const depthScale = panel.userData.tinyworldDepthScale || 1;
          const y = emergeFromIsland
            ? final.y
            : shieldLerp(-panel.height - 0.28, final.y, emerge);

          panel.visible = progress > 0.001 && local > 0.005;
          panel.position.set(
            shieldLerp(closed.x, final.x, local),
            y,
            shieldLerp(closed.z, final.z, local)
          );

          panel.scale.x = shieldLerp(0.06, widthScale, local);
          panel.scale.y = shieldLerp(emergeFromIsland ? 0.02 : 0.08, heightScale, emerge);
          panel.scale.z = shieldLerp(0.72 * depthScale, depthScale, local);
          if (!emergeFromIsland) panel.position.y += Math.sin(local * Math.PI) * 0.06;

          const almostConnected = shieldSmoothstep((local - 0.62) / 0.38);
          const rowStart = order / Math.max(1, this.panelsPerCornerSide - 1);
          const sideLockSpark = shieldSmoothstep((progress - (0.62 + rowStart * 0.08)) / 0.16);
          const power = shieldClamp01(almostConnected * sideLockSpark);
          const flicker = fullyLocked ? 1 : shieldFlickerSignal(time, panel.userData.lightSeed);

          setModuleGlow(panel, power, flicker);
          panel.userData.lightPower = power * flicker;
        });
      }
    }

    class ShieldDemo {
      constructor({
        side = SHIELD_SOURCE_SIDE,
        fitScale = defaultShieldFitScale(),
        autoStart = false,
        parent = worldGroup,
        deploymentSpeed = SHIELD_DEFAULT_SPEED,
        showSlots = false,
      } = {}) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.parent = parent;
        this.kit = new VoxelKit();
        this.isRunning = true;

        this.shield = new ShieldRing({
          kit: this.kit,
          side,
          panelWidth: 3.55,
          baseHeight: 4.7,
          gap: 0.08,
          depth: 0.6,
          cornerSize: 1.1,
          panelsPerCornerSide: 4,
          deploymentSpeed,
          showSlots,
          emergeFromIsland: true,
        });
        this.shield.name = 'voxel-blast-shield-ring';
        this.shield.scale.setScalar(fitScale);
        this.shield.position.y = TOP_H - 0.08;
        this.applyTinyWorldProportions();
        this.parent.add(this.shield);

        this.runSmokeTests();
        if (autoStart) this.open();
      }

      open() {
        this.shield.open();
      }

      close() {
        this.shield.close();
      }

      toggle() {
        this.shield.toggle();
      }

      setProgress(progress) {
        this.shield.setProgress(progress);
      }

      setSpeed(speed) {
        this.shield.setSpeed(speed);
      }

      applyTinyWorldProportions() {
        this.shield.keystones.forEach(keystone => {
          keystone.scale.x = SHIELD_TINYWORLD_CORNER_XZ_SCALE;
          keystone.scale.y = SHIELD_TINYWORLD_CORNER_HEIGHT_SCALE;
          keystone.scale.z = SHIELD_TINYWORLD_CORNER_XZ_SCALE;
          keystone.userData.tinyworldHeightScale = SHIELD_TINYWORLD_CORNER_HEIGHT_SCALE;
        });
        this.shield.panels.forEach(panel => {
          panel.userData.tinyworldWidthScale = SHIELD_TINYWORLD_PANEL_WIDTH_SCALE;
          panel.userData.tinyworldHeightScale = SHIELD_TINYWORLD_PANEL_HEIGHT_SCALE;
          panel.userData.tinyworldDepthScale = SHIELD_TINYWORLD_PANEL_DEPTH_SCALE;
        });
        this.shield.applyDeployment(this.shield.progress, 0);
      }

      update(deltaTime, time) {
        if (!this.isRunning) return;
        this.shield.update(deltaTime, time);
      }

      destroy() {
        // NOTE: disposeGroup frees geometries but deliberately NOT materials (shared-material contract).
        // The glow cubes carry per-mesh .clone()d MeshStandardMaterials (marked noBatch, see glowCube ~:116)
        // that are NOT shared, so they leak on destroy. Harmless today: no engine caller invokes destroy()/
        // rebuildVoxelShield() (the toolbar is toggle-only), so this path is dormant. IF a GRID-resize rebuild
        // is ever wired, add a material-dispose pass here that traverses and disposes only the non-shared,
        // non-cached glow clones before disposeGroup.
        this.isRunning = false;
        if (this.shield && this.shield.parent) this.shield.parent.remove(this.shield);
        if (this.shield && typeof disposeGroup === 'function') disposeGroup(this.shield);
      }

      runSmokeTests() {
        try {
          shieldAssert(typeof THREE !== 'undefined', 'THREE should be available');
          shieldAssert(renderer && renderer.domElement instanceof HTMLCanvasElement, 'TinyWorld renderer should expose a canvas');
          shieldAssert(this.shield instanceof ShieldRing, 'Shield should be a ShieldRing instance');
          shieldAssert(this.shield.keystones.length === 4, 'Expected 4 keystones, got ' + this.shield.keystones.length);
          shieldAssert(this.shield.panels.length === 32, 'Expected 32 panels, got ' + this.shield.panels.length);
          shieldAssert(this.shield.panels.every(panel => panel instanceof BlastPanel), 'Every panel should be a BlastPanel instance');
          shieldAssert(this.shield.keystones.every(keystone => keystone instanceof CornerKeystone), 'Every keystone should be a CornerKeystone instance');
          shieldAssert(this.shield.gap <= 0.1, 'Expected tight panel gaps');
          shieldAssert(this.shield.panels.every(panel => panel.depth === 0.6), 'Expected panels to be half depth');
          shieldAssert(this.shield.cornerSize === 1.1, 'Expected keystone width/depth to be halved');
          shieldAssert(this.shield.baseHeight < 5, 'Expected shield to be roughly half height');
          shieldAssert(this.shield.keystones.every(keystone => Math.abs(keystone.scale.x - SHIELD_TINYWORLD_CORNER_XZ_SCALE) < 0.001 && Math.abs(keystone.scale.z - SHIELD_TINYWORLD_CORNER_XZ_SCALE) < 0.001), 'Expected TinyWorld keystone width/depth scale to be doubled from the first island-fit pass');
          shieldAssert(this.shield.panels.every(panel => panel.userData.tinyworldHeightScale === SHIELD_TINYWORLD_PANEL_HEIGHT_SCALE && panel.userData.tinyworldDepthScale === SHIELD_TINYWORLD_PANEL_DEPTH_SCALE), 'Expected TinyWorld panel height/depth adaptation markers');
          shieldAssert(this.shield.panels.every(panel => panel.userData.lightPower === 0), 'Expected shield lights to start off');
          shieldAssert(this.shield.panels.every(panel => {
            const localFront = new THREE.Vector3(0, 0, 1).applyEuler(panel.rotation);
            return localFront.dot(panel.userData.outwardNormal) > 0.99;
          }), 'Expected blue rune face to point outward on every panel');
          console.info('Voxel shield smoke tests passed.');
        } catch (error) {
          console.error('Voxel shield smoke tests failed:', error);
        }
      }
    }

    function defaultShieldSide() {
      return SHIELD_SOURCE_SIDE;
    }

    function defaultShieldFitScale() {
      return Math.max(0.01, ((GRID * TILE) - SHIELD_TINYWORLD_EDGE_INSET) / SHIELD_SOURCE_SIDE);
    }

    function ensureVoxelShield(opts = {}) {
      if (voxelShieldDemo) return voxelShieldDemo;
      const autoStart = !!opts.autoStart || new URLSearchParams(window.location.search).get('shield') === '1';
      voxelShieldDemo = new ShieldDemo({
        side: Number.isFinite(opts.side) ? opts.side : defaultShieldSide(),
        fitScale: Number.isFinite(opts.fitScale) ? opts.fitScale : defaultShieldFitScale(),
        deploymentSpeed: Number.isFinite(opts.deploymentSpeed) ? opts.deploymentSpeed : SHIELD_DEFAULT_SPEED,
        showSlots: opts.showSlots === true,
        autoStart,
      });
      updateVoxelShieldApi();
      notifyVoxelShieldChanged(voxelShieldDemo.shield);
      return voxelShieldDemo;
    }

    function rebuildVoxelShield(opts = {}) {
      if (voxelShieldDemo) {
        voxelShieldDemo.destroy();
        voxelShieldDemo = null;
      }
      return ensureVoxelShield(opts);
    }

    function tickVoxelShield(deltaTime, time) {
      if (!voxelShieldDemo) return;
      voxelShieldDemo.update(deltaTime, time);
    }

    function updateVoxelShieldApi() {
      window.VoxelShield = {
        THREE,
        VoxelKit,
        BlastPanel,
        CornerKeystone,
        ShieldRing,
        ShieldDemo,
        demo: voxelShieldDemo,
        get shield() {
          return voxelShieldDemo ? voxelShieldDemo.shield : null;
        },
        ensure: opts => ensureVoxelShield(opts),
        rebuild: opts => rebuildVoxelShield(opts),
        open: () => ensureVoxelShield().open(),
        close: () => ensureVoxelShield().close(),
        toggle: () => ensureVoxelShield().toggle(),
        setProgress: value => ensureVoxelShield().setProgress(value),
        setSpeed: value => ensureVoxelShield().setSpeed(value),
        destroy: () => {
          if (voxelShieldDemo) voxelShieldDemo.destroy();
          voxelShieldDemo = null;
          updateVoxelShieldApi();
          notifyVoxelShieldChanged(null);
        },
      };
    }

    updateVoxelShieldApi();
    // Defer the heavy ShieldDemo build (32 panels + 4 keystones + 6 PBR materials + smoke tests) to
    // first use: the toolbar calls ensureVoxelShield().toggle() on first toggle (19-tools-toolbar.js).
    // Only build eagerly when the ?shield=1 autoStart URL flag is present (mirrors the check in
    // ensureVoxelShield). updateVoxelShieldApi() above keeps window.VoxelShield available regardless.
    if (new URLSearchParams(window.location.search).get('shield') === '1') ensureVoxelShield();

    window.tickVoxelShield = tickVoxelShield;
    window.ensureVoxelShield = ensureVoxelShield;
    window.rebuildVoxelShield = rebuildVoxelShield;
  })();
