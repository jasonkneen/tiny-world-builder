  // -------- battleworld: solo combat slice + fly-island -------- //
  // A self-contained arena layer active only in tw-mode-battle. It models a few
  // islands as factioned outposts with health + shields, lets the player assault
  // the targeted enemy island (depleting shield then health) until it is
  // CAPTURED (faction flips, ownership flips via the land registry), while enemy
  // outposts counter-attack the home island; losing the home island triggers a
  // timed RESPAWN. A home turret + tracers give the "fight from the ground" read.
  //
  // Win-bonus: once you've captured an island, you can FLY YOUR ISLAND — a
  // pilotable airborne avatar (stronger shield + cannons) you steer with WASD to
  // blast and ram enemy outposts into capture. While airborne the home island is
  // lifted (its hull rides on the avatar) and enemy fire targets the avatar.
  //
  // Everything is additive: own rAF, meshes parented under the world group and
  // disposed on exit, key handling gated to fly mode. Builder / Metaworld are
  // untouched. Deferred: wiring this into live multiplayer + the flight-combat
  // target list, and relocating the real board geometry.
  (function battleworldArenaModule() {
    'use strict';

    const SQUAD_LS = 'tinyworld:battle-squad.v1';
    const ROLE_LS = 'tinyworld:battle-role.v1';
    const HOME_KEY = '0,0';
    const ENEMY_BOARDS = [[1, 0], [0, 1], [1, 1]];   // neighbour boards spun up as enemy outposts
    const MAX_HEALTH = 100;
    const MAX_SHIELD = 60;
    const PLAYER_DAMAGE = 20;        // per FIRE volley
    const ENEMY_DAMAGE = 9;          // per enemy salvo
    const ENEMY_FIRE_MS = 2600;
    const SHIELD_REGEN = 6;          // per second, when not recently hit
    const REGEN_DELAY_MS = 2500;
    const RESPAWN_MS = 3000;
    const INVULN_MS = 2000;
    // fly-island tuning
    const FLY_LIFT = 7;
    const FLY_SHIELD = 90;
    const FLY_SHIELD_REGEN = 10;
    const RAM_DAMAGE = 26;           // applied per ram tick when overlapping an enemy
    const RAM_TICK_MS = 420;

    function tt(key, fallback, params) {
      try { if (window.t && window.has && window.has(key)) return window.t(key, params); } catch (_) {}
      try { if (window.tx) return window.tx(key, fallback); } catch (_) {}
      return fallback;
    }
    function toast(msg, kind) { if (typeof twToast === 'function') twToast(msg, kind || 'ok'); }
    function gridSize() { return (typeof GRID === 'number' && GRID > 0) ? GRID : 8; }
    function tileSize() { return (typeof TILE === 'number' && TILE > 0) ? TILE : 1; }
    function has3D() { return typeof THREE !== 'undefined' && typeof scene !== 'undefined' && !!scene; }
    function parent3D() { return (typeof worldGroup !== 'undefined' && worldGroup) ? worldGroup : (typeof scene !== 'undefined' ? scene : null); }
    function battleActive() { return document.body.classList.contains('tw-mode-battle'); }

    function boardCenter(key) {
      const p = key.split(','); const g = gridSize() * tileSize();
      return { x: (parseInt(p[0], 10) || 0) * g, z: (parseInt(p[1], 10) || 0) * g };
    }

    // ---- arena state ----
    let islands = {};            // key -> { faction, health, shield, isHome, beacon, lastHit }
    let targetKey = null;
    let downed = false;
    let respawnAt = 0;
    let invulnUntil = 0;
    let enemyTimer = 0;
    let rafId = 0;
    let lastFrame = 0;
    let tracers = [];
    let homeTurret = null;
    let capturedCount = 0;
    const meshes = [];           // arena meshes (beacons + turret), for cleanup

    // ---- fly-island state ----
    let flyActive = false;
    let flyAvatar = null;
    let flyPos = { x: 0, z: 0 };
    let flyShield = FLY_SHIELD;
    let ramTimer = 0;
    const keysDown = Object.create(null);

    function freshIsland(faction, isHome) {
      return { faction, health: MAX_HEALTH, shield: MAX_SHIELD, isHome: !!isHome, beacon: null, lastHit: 0 };
    }

    // ---- 3D helpers (all guarded; arena still works headless via HUD) ----
    function mkMat(hex, opacity) { return has3D() ? new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: opacity == null ? 0.9 : opacity }) : null; }
    function factionColor(faction) { return faction === 'friendly' ? 0x2bb3a3 : 0xe0492f; }

    function buildBeacon(key, isl) {
      if (!has3D()) return;
      const c = boardCenter(key);
      const g = new THREE.Group();
      g.position.set(c.x, 0, c.z);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 7, 10), mkMat(factionColor(isl.faction)));
      pillar.position.y = 3.6;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(gridSize() * 0.42, 0.16, 8, 32), mkMat(factionColor(isl.faction)));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.4;
      g.add(pillar); g.add(ring);
      g.userData.pillar = pillar; g.userData.ring = ring;
      const par = parent3D(); if (par) par.add(g);
      meshes.push(g);
      isl.beacon = g;
    }

    function recolorBeacon(isl) {
      if (!isl.beacon) return;
      const col = factionColor(isl.faction);
      const u = isl.beacon.userData;
      if (u.pillar && u.pillar.material) u.pillar.material.color.setHex(col);
      if (u.ring && u.ring.material) u.ring.material.color.setHex(col);
    }

    function buildTurret() {
      if (!has3D()) return;
      const c = boardCenter(HOME_KEY);
      const g = new THREE.Group();
      const off = gridSize() * 0.3;
      g.position.set(c.x + off, 1.2, c.z + off);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.1), mkMat(0x35506a));
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 2.2), mkMat(0x9fb6cc));
      barrel.position.set(0, 0.45, 0.9);
      const head = new THREE.Group(); head.position.y = 0.4; head.add(barrel);
      g.add(base); g.add(head);
      g.userData.head = head;
      const par = parent3D(); if (par) par.add(g);
      meshes.push(g);
      homeTurret = g;
    }

    function spawnTracer(from, to, hex) {
      if (!has3D()) return;
      const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
      const len = Math.max(0.001, Math.sqrt(dx * dx + dy * dy + dz * dz));
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, len), mkMat(hex));
      m.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
      m.lookAt(to.x, to.y, to.z);
      const par = parent3D(); if (par) par.add(m);
      tracers.push({ mesh: m, life: 0.22, maxLife: 0.22 });
    }

    function disposeMesh(m) {
      const par = parent3D();
      if (par && m.parent === par) par.remove(m);
      m.traverse && m.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    function disposeAll() {
      for (const m of meshes) disposeMesh(m);
      meshes.length = 0;
      for (const t of tracers) disposeMesh(t.mesh);
      tracers = [];
      homeTurret = null;
      destroyFlyAvatar();
    }

    // ---- combat ----
    function livingEnemies() {
      const out = [];
      for (const k in islands) { if (islands[k].faction === 'enemy' && islands[k].health > 0) out.push(k); }
      return out;
    }
    function ensureTarget() {
      if (targetKey && islands[targetKey] && islands[targetKey].faction === 'enemy' && islands[targetKey].health > 0) return;
      const e = livingEnemies();
      targetKey = e.length ? e[0] : null;
    }
    function cycleTarget(dir) {
      const e = livingEnemies();
      if (!e.length) { targetKey = null; return; }
      let i = Math.max(0, e.indexOf(targetKey));
      i = (i + (dir > 0 ? 1 : e.length - 1)) % e.length;
      targetKey = e[i];
      renderHud(true);
    }

    function applyDamage(isl, amount) {
      isl.lastHit = Date.now();
      let dmg = amount;
      if (isl.shield > 0) { const s = Math.min(isl.shield, dmg); isl.shield -= s; dmg -= s; }
      if (dmg > 0) isl.health = Math.max(0, isl.health - dmg);
    }

    function shooterPos() {
      if (flyActive && flyAvatar) return { x: flyAvatar.position.x, y: flyAvatar.position.y, z: flyAvatar.position.z };
      if (homeTurret) return { x: homeTurret.position.x, y: homeTurret.position.y + 0.5, z: homeTurret.position.z };
      const c = boardCenter(HOME_KEY); return { x: c.x, y: 2, z: c.z };
    }

    function fire() {
      if (!battleActive() || downed) return;
      ensureTarget();
      if (!targetKey) { toast(tt('battle.toast.noTarget', 'No enemy islands left — you win!'), 'ok'); return; }
      const isl = islands[targetKey];
      const from = shooterPos();
      const tc = boardCenter(targetKey);
      if (!flyActive && homeTurret && homeTurret.userData.head) homeTurret.userData.head.lookAt(tc.x, 3, tc.z);
      spawnTracer({ x: from.x, y: from.y + 0.5, z: from.z }, { x: tc.x, y: 3, z: tc.z }, 0x9fe8ff);
      applyDamage(isl, PLAYER_DAMAGE);
      if (typeof playSfx === 'function') { try { playSfx('whoosh', 0.6); } catch (_) {} }
      if (isl.health <= 0) captureIsland(targetKey);
      renderHud(true);
    }

    function captureIsland(key) {
      const isl = islands[key];
      isl.faction = 'friendly'; isl.health = MAX_HEALTH; isl.shield = Math.round(MAX_SHIELD * 0.5);
      recolorBeacon(isl);
      capturedCount++;
      try { if (window.__tinyworldLand && window.__tinyworldLand.captureForMe) window.__tinyworldLand.captureForMe(key); } catch (_) {}
      toast(tt('battle.toast.captured', 'Island captured!'), 'ok');
      if (capturedCount === 1) toast(tt('battle.toast.flyUnlocked', 'Win bonus: you can now FLY YOUR ISLAND!'), 'ok');
      targetKey = null; ensureTarget();
      if (!livingEnemies().length) toast(tt('battle.toast.win', 'All islands captured — you win!'), 'ok');
    }

    // Damage routed to the player: while airborne it hits the flight shield then
    // the island's hull; on the ground it hits the home island normally.
    function damagePlayer(amount) {
      const home = islands[HOME_KEY];
      if (!home) return;
      home.lastHit = Date.now();
      let dmg = amount;
      if (flyActive) {
        if (flyShield > 0) { const s = Math.min(flyShield, dmg); flyShield -= s; dmg -= s; }
        if (dmg > 0) home.health = Math.max(0, home.health - dmg);
      } else {
        applyDamage(home, amount);
      }
      if (home.health <= 0) goDown();
    }

    function enemyVolley() {
      const enemies = livingEnemies();
      if (!enemies.length || downed || Date.now() < invulnUntil) return;
      const shooter = enemies[Math.floor(Math.random() * enemies.length)];
      const from = boardCenter(shooter);
      const to = (flyActive && flyAvatar) ? { x: flyAvatar.position.x, z: flyAvatar.position.z } : boardCenter(HOME_KEY);
      const toY = flyActive ? FLY_LIFT : 3;
      spawnTracer({ x: from.x, y: 3, z: from.z }, { x: to.x, y: toY, z: to.z }, 0xff7a5c);
      damagePlayer(ENEMY_DAMAGE);
      renderHud(true);
    }

    function goDown() {
      if (flyActive) landIsland(true);
      downed = true;
      respawnAt = Date.now() + RESPAWN_MS;
      toast(tt('battle.toast.downed', 'Home island down — respawning…'), 'err');
    }
    function respawn() {
      downed = false;
      invulnUntil = Date.now() + INVULN_MS;
      const home = islands[HOME_KEY];
      if (home) { home.health = MAX_HEALTH; home.shield = MAX_SHIELD; }
      toast(tt('battle.toast.respawn', 'Respawned on your island.'), 'ok');
      renderHud(true);
    }

    // ---- fly-island ----
    function arenaBounds() {
      let minX = 0, maxX = 0, minZ = 0, maxZ = 0;
      for (const k in islands) { const c = boardCenter(k); minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z); }
      const pad = gridSize() * 1.1;
      return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
    }
    function buildFlyAvatar() {
      if (!has3D()) return;
      const g = new THREE.Group();
      const r = gridSize() * 0.5;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.7, 0.8, 18), mkMat(0x6b8aa6, 0.95));
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 8, 28), mkMat(0x2bb3a3));
      rim.rotation.x = Math.PI / 2; rim.position.y = 0.45;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 0.95, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mkMat(0x59d6c6, 0.28));
      dome.position.y = 0.4;
      const gunL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 2), mkMat(0x9fb6cc));
      gunL.position.set(-r * 0.5, 0.5, r * 0.6);
      const gunR = gunL.clone(); gunR.position.x = r * 0.5;
      g.add(disc); g.add(rim); g.add(dome); g.add(gunL); g.add(gunR);
      g.userData.dome = dome; g.userData.rim = rim;
      const par = parent3D(); if (par) par.add(g);
      flyAvatar = g;
    }
    function destroyFlyAvatar() { if (flyAvatar) { disposeMesh(flyAvatar); flyAvatar = null; } }

    function enterFly() {
      if (flyActive || downed) return;
      if (capturedCount < 1) { toast(tt('battle.toast.flyLocked', 'Capture an island first to unlock flight.'), 'err'); return; }
      flyActive = true;
      flyShield = FLY_SHIELD;
      const c = boardCenter(HOME_KEY);
      flyPos = { x: c.x, z: c.z };
      buildFlyAvatar();
      if (flyAvatar) flyAvatar.position.set(flyPos.x, FLY_LIFT, flyPos.z);
      const home = islands[HOME_KEY];
      if (home && home.beacon) home.beacon.visible = false;   // island is airborne
      toast(tt('battle.toast.flying', 'Island airborne — pilot with WASD, FIRE to blast.'), 'ok');
      renderHud(true);
    }
    function landIsland(silent) {
      if (!flyActive) return;
      flyActive = false;
      destroyFlyAvatar();
      const home = islands[HOME_KEY];
      if (home && home.beacon) home.beacon.visible = true;
      for (const k in keysDown) delete keysDown[k];
      if (!silent) toast(tt('battle.toast.landed', 'Island landed.'), 'ok');
      renderHud(true);
    }
    function toggleFly() { if (flyActive) landIsland(false); else enterFly(); }

    function updateFly(dt) {
      if (!flyActive || !flyAvatar) return;
      const speed = gridSize() * 0.9;
      let vx = 0, vz = 0;
      if (keysDown['w'] || keysDown['arrowup']) vz -= 1;
      if (keysDown['s'] || keysDown['arrowdown']) vz += 1;
      if (keysDown['a'] || keysDown['arrowleft']) vx -= 1;
      if (keysDown['d'] || keysDown['arrowright']) vx += 1;
      if (vx || vz) { const m = Math.hypot(vx, vz) || 1; flyPos.x += (vx / m) * speed * dt; flyPos.z += (vz / m) * speed * dt; }
      const b = arenaBounds();
      flyPos.x = Math.max(b.minX, Math.min(b.maxX, flyPos.x));
      flyPos.z = Math.max(b.minZ, Math.min(b.maxZ, flyPos.z));
      const bob = Math.sin(Date.now() * 0.003) * 0.4;
      flyAvatar.position.set(flyPos.x, FLY_LIFT + bob, flyPos.z);
      flyAvatar.rotation.y += dt * 0.3;
      // shield regen
      const home = islands[HOME_KEY];
      if (home && Date.now() - home.lastHit > REGEN_DELAY_MS) flyShield = Math.min(FLY_SHIELD, flyShield + FLY_SHIELD_REGEN * dt);
      if (flyAvatar.userData.dome && flyAvatar.userData.dome.material) flyAvatar.userData.dome.material.opacity = 0.14 + 0.22 * (flyShield / FLY_SHIELD);
      // ram: overlapping an enemy outpost deals heavy damage on a cadence
      if (Date.now() - ramTimer > RAM_TICK_MS) {
        const ramR = gridSize() * 0.6;
        for (const k of livingEnemies()) {
          const c = boardCenter(k);
          if (Math.hypot(c.x - flyPos.x, c.z - flyPos.z) < ramR) {
            ramTimer = Date.now();
            applyDamage(islands[k], RAM_DAMAGE);
            spawnTracer({ x: flyPos.x, y: FLY_LIFT, z: flyPos.z }, { x: c.x, y: 3, z: c.z }, 0xffe08a);
            if (typeof playSfx === 'function') { try { playSfx('knock', 0.7); } catch (_) {} }
            if (islands[k].health <= 0) captureIsland(k);
            renderHud(true);
            break;
          }
        }
      }
    }

    function onKeyDown(e) {
      if (!flyActive) return;
      const k = (e.key || '').toLowerCase();
      if (k === 'w' || k === 'a' || k === 's' || k === 'd' || k.startsWith('arrow')) {
        keysDown[k] = true; e.preventDefault(); e.stopPropagation();
      } else if (k === ' ' || k === 'enter') {
        fire(); e.preventDefault();
      }
    }
    function onKeyUp(e) {
      const k = (e.key || '').toLowerCase();
      if (keysDown[k]) { delete keysDown[k]; }
    }
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);

    // ---- per-frame loop (own rAF; runs only while battle is active) ----
    function frame(ts) {
      if (!battleActive()) { rafId = 0; return; }
      const now = Date.now();
      const dt = lastFrame ? Math.min(0.05, (ts - lastFrame) / 1000) : 0;
      lastFrame = ts;

      for (const k in islands) {
        const isl = islands[k];
        if (isl.health > 0 && isl.shield < MAX_SHIELD && now - isl.lastHit > REGEN_DELAY_MS) {
          isl.shield = Math.min(MAX_SHIELD, isl.shield + SHIELD_REGEN * dt);
        }
      }
      if (now - enemyTimer > ENEMY_FIRE_MS) { enemyTimer = now; enemyVolley(); }
      if (downed && now >= respawnAt) respawn();
      updateFly(dt);

      const pulse = 0.78 + 0.18 * Math.sin(ts * 0.004);
      for (const k in islands) {
        const b = islands[k].beacon;
        if (b && b.userData.ring && b.userData.ring.material) b.userData.ring.material.opacity = pulse;
      }
      if (!flyActive && homeTurret && homeTurret.userData.head && targetKey) {
        const tc = boardCenter(targetKey);
        homeTurret.userData.head.lookAt(tc.x, 3, tc.z);
      }
      for (let i = tracers.length - 1; i >= 0; i--) {
        const t = tracers[i]; t.life -= dt;
        if (t.life <= 0) { disposeMesh(t.mesh); tracers.splice(i, 1); }
        else if (t.mesh.material) t.mesh.material.opacity = Math.max(0, t.life / t.maxLife) * 0.9;
      }
      rafId = requestAnimationFrame(frame);
    }
    function startLoop() { if (!rafId) { lastFrame = 0; enemyTimer = Date.now(); rafId = requestAnimationFrame(frame); } }

    // ---- HUD ----
    let hud = null, els = null, lastSig = '';
    function buildHud() {
      hud = document.getElementById('battleworld-hud');
      if (!hud) return;
      els = {
        squad: hud.querySelector('[data-bw-squad]'),
        homeHp: hud.querySelector('[data-bw-home-hp]'),
        homeSh: hud.querySelector('[data-bw-home-shield]'),
        status: hud.querySelector('[data-bw-status]'),
        targetName: hud.querySelector('[data-bw-target]'),
        targetHp: hud.querySelector('[data-bw-target-hp]'),
        fire: hud.querySelector('[data-bw-fire]'),
        fly: hud.querySelector('[data-bw-fly]'),
        prev: hud.querySelector('[data-bw-prev]'),
        next: hud.querySelector('[data-bw-next]'),
      };
      if (els.fire) els.fire.addEventListener('click', (e) => { e.stopPropagation(); fire(); });
      if (els.fly) els.fly.addEventListener('click', (e) => { e.stopPropagation(); toggleFly(); });
      if (els.prev) els.prev.addEventListener('click', (e) => { e.stopPropagation(); cycleTarget(-1); });
      if (els.next) els.next.addEventListener('click', (e) => { e.stopPropagation(); cycleTarget(1); });
    }
    function setBar(el, frac, label) {
      if (!el) return;
      const fill = el.querySelector('.bw-bar-fill');
      if (fill) fill.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
      const txt = el.querySelector('.bw-bar-label');
      if (txt) txt.textContent = label;
    }
    function renderHud(force) {
      if (!hud) buildHud();
      if (!hud) return;
      ensureTarget();
      const home = islands[HOME_KEY] || freshIsland('friendly', true);
      const sig = [home.health | 0, home.shield | 0, downed, targetKey,
        targetKey && islands[targetKey] ? (islands[targetKey].health | 0) : -1,
        livingEnemies().length, flyActive, flyShield | 0, capturedCount].join('|');
      if (!force && sig === lastSig) return;
      lastSig = sig;

      if (els.squad) {
        let sq = 'solo', role = 'pilot';
        try { sq = localStorage.getItem(SQUAD_LS) || 'solo'; role = localStorage.getItem(ROLE_LS) || 'pilot'; } catch (_) {}
        els.squad.textContent = sq + ' · ' + role;
      }
      if (flyActive) {
        setBar(els.homeHp, home.health / MAX_HEALTH, tt('battle.hud.hull', 'Hull') + ' ' + (home.health | 0));
        setBar(els.homeSh, flyShield / FLY_SHIELD, tt('battle.hud.flyShield', 'Fly shield') + ' ' + (flyShield | 0));
      } else {
        setBar(els.homeHp, home.health / MAX_HEALTH, tt('battle.hud.hull', 'Hull') + ' ' + (home.health | 0));
        setBar(els.homeSh, home.shield / MAX_SHIELD, tt('battle.hud.shield', 'Shield') + ' ' + (home.shield | 0));
      }
      if (els.status) {
        els.status.textContent = downed ? tt('battle.hud.respawning', 'Respawning…')
          : (flyActive ? tt('battle.hud.piloting', 'Piloting island — WASD to move')
            : (livingEnemies().length ? '' : tt('battle.hud.victory', 'Victory')));
      }
      if (targetKey && islands[targetKey]) {
        const t = islands[targetKey];
        if (els.targetName) els.targetName.textContent = tt('battle.hud.enemy', 'Enemy island') + ' ' + targetKey;
        setBar(els.targetHp, t.health / MAX_HEALTH, tt('battle.hud.capture', 'Capture') + ' ' + Math.round((1 - t.health / MAX_HEALTH) * 100) + '%');
      } else {
        if (els.targetName) els.targetName.textContent = tt('battle.hud.cleared', 'No enemies left');
        setBar(els.targetHp, 0, '');
      }
      if (els.fire) els.fire.disabled = downed || !targetKey;
      if (els.fly) {
        els.fly.textContent = flyActive ? tt('battle.hud.land', 'LAND') : tt('battle.hud.fly', 'FLY ISLAND');
        els.fly.disabled = downed || (!flyActive && capturedCount < 1);
        els.fly.classList.toggle('is-active', flyActive);
      }
    }

    // ---- lifecycle ----
    function enterBattle() {
      disposeAll();
      islands = {};
      capturedCount = 0; flyActive = false;
      islands[HOME_KEY] = freshIsland('friendly', true);
      for (const b of ENEMY_BOARDS) islands[b[0] + ',' + b[1]] = freshIsland('enemy', false);
      for (const k in islands) buildBeacon(k, islands[k]);
      buildTurret();
      targetKey = null; downed = false; invulnUntil = Date.now() + INVULN_MS;
      ensureTarget();
      renderHud(true);
      startLoop();
    }
    function exitBattle() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      flyActive = false;
      for (const k in keysDown) delete keysDown[k];
      disposeAll();
    }

    function onModeChanged(e) {
      const mode = e && e.detail && e.detail.mode;
      if (mode === 'battle') enterBattle();
      else exitBattle();
    }
    window.addEventListener('tinyworld:game-mode-changed', onModeChanged);
    window.addEventListener('DOMContentLoaded', () => { buildHud(); if (battleActive()) enterBattle(); });
    buildHud();
    if (battleActive()) enterBattle();

    // Small public surface for debugging / future multiplayer wiring.
    window.__tinyworldBattle = {
      fire, cycleTarget, toggleFly,
      state: () => ({ islands: Object.assign({}, islands), targetKey, downed, flyActive, capturedCount }),
    };
  }());
