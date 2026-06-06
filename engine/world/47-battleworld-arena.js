  // -------- battleworld: solo combat slice -------- //
  // A self-contained arena layer active only in tw-mode-battle. It models a few
  // islands as factioned outposts with health + shields, lets the player assault
  // the targeted enemy island (depleting shield then health) until it is
  // CAPTURED (faction flips, ownership flips via the land registry), while enemy
  // outposts counter-attack the home island; losing the home island triggers a
  // timed RESPAWN. A home turret + tracers give the "fight from the ground"
  // read. Deferred to a later follow-up: piloting the island itself (fly-island)
  // and wiring this into live multiplayer + the flight-combat target list.
  // Everything is additive (own rAF, meshes parented under the world group and
  // disposed on exit) so Builder / Metaworld are untouched.
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
    const meshes = [];           // everything we add to the scene, for cleanup

    function freshIsland(faction, isHome) {
      return { faction, health: MAX_HEALTH, shield: MAX_SHIELD, isHome: !!isHome, beacon: null, lastHit: 0 };
    }

    // ---- 3D helpers (all guarded; arena still works headless via HUD) ----
    function mkMat(hex) { return has3D() ? new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.9 }) : null; }
    function factionColor(faction) { return faction === 'friendly' ? 0x2bb3a3 : 0xe0492f; }

    function buildBeacon(key, isl) {
      if (!has3D()) return;
      const c = boardCenter(key);
      const g = new THREE.Group();
      g.position.set(c.x, 0, c.z);
      const pillarGeo = new THREE.CylinderGeometry(0.35, 0.35, 7, 10);
      const pillar = new THREE.Mesh(pillarGeo, mkMat(factionColor(isl.faction)));
      pillar.position.y = 3.6;
      const ringGeo = new THREE.TorusGeometry(gridSize() * 0.42, 0.16, 8, 32);
      const ring = new THREE.Mesh(ringGeo, mkMat(factionColor(isl.faction)));
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
      const geo = new THREE.BoxGeometry(0.16, 0.16, len);
      const m = new THREE.Mesh(geo, mkMat(hex));
      m.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
      m.lookAt(to.x, to.y, to.z);
      const par = parent3D(); if (par) par.add(m);
      tracers.push({ mesh: m, life: 0.22, maxLife: 0.22 });
    }

    function disposeAll() {
      const par = parent3D();
      for (const m of meshes) {
        if (par && m.parent === par) par.remove(m);
        m.traverse && m.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      }
      meshes.length = 0;
      for (const t of tracers) {
        if (par && t.mesh.parent === par) par.remove(t.mesh);
        if (t.mesh.geometry) t.mesh.geometry.dispose();
      }
      tracers = [];
      homeTurret = null;
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
      if (isl.shield > 0) {
        const s = Math.min(isl.shield, dmg);
        isl.shield -= s; dmg -= s;
      }
      if (dmg > 0) isl.health = Math.max(0, isl.health - dmg);
    }

    function fire() {
      if (!battleActive() || downed) return;
      ensureTarget();
      if (!targetKey) { toast(tt('battle.toast.noTarget', 'No enemy islands left — you win!'), 'ok'); return; }
      const isl = islands[targetKey];
      const turretPos = homeTurret ? homeTurret.position : { x: boardCenter(HOME_KEY).x, y: 2, z: boardCenter(HOME_KEY).z };
      const tc = boardCenter(targetKey);
      if (homeTurret && homeTurret.userData.head) homeTurret.userData.head.lookAt(tc.x, 3, tc.z);
      spawnTracer({ x: turretPos.x, y: turretPos.y + 0.5, z: turretPos.z }, { x: tc.x, y: 3, z: tc.z }, 0x9fe8ff);
      applyDamage(isl, PLAYER_DAMAGE);
      if (typeof playSfx === 'function') { try { playSfx('whoosh', 0.6); } catch (_) {} }
      if (isl.health <= 0) captureIsland(targetKey);
      renderHud(true);
    }

    function captureIsland(key) {
      const isl = islands[key];
      isl.faction = 'friendly'; isl.health = MAX_HEALTH; isl.shield = Math.round(MAX_SHIELD * 0.5);
      recolorBeacon(isl);
      // Flip ownership in the shared land registry so captures persist across modes.
      try { if (window.__tinyworldLand && window.__tinyworldLand.captureForMe) window.__tinyworldLand.captureForMe(key); } catch (_) {}
      toast(tt('battle.toast.captured', 'Island captured!'), 'ok');
      targetKey = null; ensureTarget();
      if (!livingEnemies().length) toast(tt('battle.toast.win', 'All islands captured — you win!'), 'ok');
    }

    function enemyVolley() {
      const enemies = livingEnemies();
      if (!enemies.length) return;
      const home = islands[HOME_KEY];
      if (!home || downed || Date.now() < invulnUntil) return;
      const shooter = enemies[Math.floor(Math.random() * enemies.length)];
      const from = boardCenter(shooter), to = boardCenter(HOME_KEY);
      spawnTracer({ x: from.x, y: 3, z: from.z }, { x: to.x, y: 3, z: to.z }, 0xff7a5c);
      applyDamage(home, ENEMY_DAMAGE);
      if (home.health <= 0) goDown();
      renderHud(true);
    }

    function goDown() {
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

    // ---- per-frame loop (own rAF; runs only while battle is active) ----
    function frame(ts) {
      if (!battleActive()) { rafId = 0; return; }
      const now = Date.now();
      const dt = lastFrame ? Math.min(0.05, (ts - lastFrame) / 1000) : 0;
      lastFrame = ts;

      // shield regen
      for (const k in islands) {
        const isl = islands[k];
        if (isl.health > 0 && isl.shield < MAX_SHIELD && now - isl.lastHit > REGEN_DELAY_MS) {
          isl.shield = Math.min(MAX_SHIELD, isl.shield + SHIELD_REGEN * dt);
        }
      }
      // enemy fire cadence
      if (now - enemyTimer > ENEMY_FIRE_MS) { enemyTimer = now; enemyVolley(); }
      // respawn
      if (downed && now >= respawnAt) respawn();
      // beacon pulse + turret aim
      const pulse = 0.78 + 0.18 * Math.sin(ts * 0.004);
      for (const k in islands) {
        const b = islands[k].beacon;
        if (b && b.userData.ring && b.userData.ring.material) b.userData.ring.material.opacity = pulse;
      }
      if (homeTurret && homeTurret.userData.head && targetKey) {
        const tc = boardCenter(targetKey);
        homeTurret.userData.head.lookAt(tc.x, 3, tc.z);
      }
      // tracer fade
      for (let i = tracers.length - 1; i >= 0; i--) {
        const t = tracers[i]; t.life -= dt;
        if (t.life <= 0) {
          const par = parent3D();
          if (par && t.mesh.parent === par) par.remove(t.mesh);
          if (t.mesh.geometry) t.mesh.geometry.dispose();
          tracers.splice(i, 1);
        } else if (t.mesh.material) {
          t.mesh.material.opacity = Math.max(0, t.life / t.maxLife) * 0.9;
        }
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
        prev: hud.querySelector('[data-bw-prev]'),
        next: hud.querySelector('[data-bw-next]'),
      };
      if (els.fire) els.fire.addEventListener('click', (e) => { e.stopPropagation(); fire(); });
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
        targetKey && islands[targetKey] ? (islands[targetKey].health | 0) : -1, livingEnemies().length].join('|');
      if (!force && sig === lastSig) return;
      lastSig = sig;

      if (els.squad) {
        let sq = 'solo', role = 'pilot';
        try { sq = localStorage.getItem(SQUAD_LS) || 'solo'; role = localStorage.getItem(ROLE_LS) || 'pilot'; } catch (_) {}
        els.squad.textContent = sq + ' · ' + role;
      }
      setBar(els.homeHp, home.health / MAX_HEALTH, tt('battle.hud.hull', 'Hull') + ' ' + (home.health | 0));
      setBar(els.homeSh, home.shield / MAX_SHIELD, tt('battle.hud.shield', 'Shield') + ' ' + (home.shield | 0));
      if (els.status) {
        els.status.textContent = downed
          ? tt('battle.hud.respawning', 'Respawning…')
          : (livingEnemies().length ? '' : tt('battle.hud.victory', 'Victory'));
      }
      if (targetKey && islands[targetKey]) {
        const t = islands[targetKey];
        if (els.targetName) els.targetName.textContent = tt('battle.hud.enemy', 'Enemy island') + ' ' + targetKey;
        const capture = 1 - t.health / MAX_HEALTH;
        setBar(els.targetHp, t.health / MAX_HEALTH, tt('battle.hud.capture', 'Capture') + ' ' + Math.round(capture * 100) + '%');
      } else {
        if (els.targetName) els.targetName.textContent = tt('battle.hud.cleared', 'No enemies left');
        setBar(els.targetHp, 0, '');
      }
      if (els.fire) els.fire.disabled = downed || !targetKey;
    }

    // ---- lifecycle ----
    function enterBattle() {
      disposeAll();
      islands = {};
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
      fire, cycleTarget,
      state: () => ({ islands: Object.assign({}, islands), targetKey, downed }),
    };
  }());
