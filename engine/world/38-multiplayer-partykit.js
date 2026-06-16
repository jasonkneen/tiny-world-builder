  // -------- PartyKit shared building --------
  (function wirePartyKitMultiplayer() {
    const params = new URLSearchParams(location.search);
    const rawRoom = params.get('party') || params.get('room') || params.get('collab') || '';
    const shareId = params.get('share') || '';
    const roomId = sanitizeMultiplayerId((rawRoom === '1' || rawRoom === 'true') ? shareId : rawRoom);
    if (!roomId) return;

    const MP_CLIENT_ID_LS = 'tinyworld:multiplayer:client-id';
    const MP_CONN_SS_PREFIX = 'tinyworld:multiplayer:conn:';
    const MP_NAME_LS = 'tinyworld:multiplayer:name';
    const MP_HOST_LS = 'tinyworld:multiplayer:party-host';
    const peers = new Map();
    const peerRoot = new THREE.Group();
    peerRoot.name = 'multiplayer-peers';
    xrWorldRoot.add(peerRoot);
    let socket = null;
    let reconnectTimer = null;
    let reconnectDelay = 800;
    let connectAttempts = 0;
    let everConnected = false;
    let connected = false;
    let rosterEl = null;
    let statusEl = null;
    let serverClientId = '';
    let applyingRemote = false;
    // True while applying a remote ENV update (snapshot or live env message).
    // Mirrors applyingRemote for the non-cell environment path: the env-control
    // listeners check it so re-applying a received env never re-broadcasts.
    let applyingRemoteEnv = false;
    // Peer-side snapshot reassembly: chunks arrive { seq, total, chunk } and are
    // buffered until all `total` are present, then JSON.parse'd + applied.
    let snapshotBuf = null;          // { total, parts: string[], got }
    let snapshotApplying = false;    // guards against overlapping snapshot applies
    // Host-side env-broadcast throttle + dedupe (avoids flooding on slider drag).
    let envBroadcastTimer = null;
    let lastEnvKey = '';
    let lastPresenceSent = 0;
    let presenceTimer = null;
    let lastPresenceKey = '';
    let lastHoverKey = '';
    // Live flight ghosts: peer id -> { group, kind }. Built ONCE per id (entity
    // messages arrive ~15/s), thereafter only the transform is updated. Removed
    // on active:false, on the peer leaving (covers kick), and on socket close.
    const flightGhosts = new Map();
    // Host-side flight broadcast self-throttle (~15/s). active:false bypasses it.
    let lastFlightSent = 0;

    // -------- lobby / roles / moderation state --------
    // SAFETY INVARIANT: default to ADMITTED. An un-upgraded server sends no
    // role/admitted fields, so the client must behave exactly as today (open,
    // full edit). Only an explicit admitted:false from the server gates us.
    let admitted = true;
    let isHost = false;
    let myRole = null;            // null => un-upgraded/host-equivalent full rights.
    let myIsland = null;          // editor scope bounds { minX, maxX, minZ, maxZ }.
    let declined = false;         // declined/kicked => stop reconnecting.
    // Host-only: per-peer role tracking. Non-host clients have no wire path to
    // learn other peers' roles (presence is role-free by protocol), so only the
    // host renders role badges + the moderation menu from this map.
    const roleById = new Map();
    let lobbyOverlayEl = null;
    let admitPanelEl = null;
    const pendingLobby = new Map();   // id -> { id, name }
    const toastedLobby = new Set();   // ids we've already toasted for
    let moderationMenuEl = null;

    // -------- chat panel state --------
    // chatPanelEl: the glassy panel (built lazily). chatOpen: whether it is
    // visible. chatUnread: messages that arrived while closed (shown as a bubble
    // on the toggle). chatToggleEl: the floating launcher button. typingPeers:
    // id -> { name, timer } for peers currently composing (auto-expires so a
    // dropped typing:false never sticks). chatTypingSent/Timer: self-throttle
    // for our own chat.typing broadcast.
    let chatPanelEl = null;
    let chatToggleEl = null;
    let chatLogEl = null;
    let chatInputEl = null;
    let chatTypingEl = null;
    let chatBadgeEl = null;
    let chatOpen = false;
    let chatUnread = 0;
    const typingPeers = new Map();
    let chatTypingActive = false;
    let chatTypingTimer = null;

    function inIsland(island, x, z) {
      if (!island) return false;
      return x >= island.minX && x <= island.maxX && z >= island.minZ && z <= island.maxZ;
    }

    // Single source of truth for "may this client edit cell (x,z)?". Used by
    // both sendCellSnapshot (broadcast gate) and applyTool (local-mutation
    // gate, via window.__tinyworldMultiplayer). DENY-on-explicit-restriction:
    // null/host roles get full edit, so an un-upgraded server is unaffected.
    function canEdit(x, z) {
      if (!admitted) return false;
      if (myRole === 'viewer' || myRole === 'player') return false;
      if (myRole === 'editor') return inIsland(myIsland, Math.round(Number(x)), Math.round(Number(z)));
      return true;
    }

    // May this client interact with placed things (e.g. click a plane to fly)?
    // Player can; viewer cannot. Null/host/editor can.
    function canInteract() {
      if (!admitted) return false;
      if (myRole === 'viewer') return false;
      return true;
    }

    // True if this client may edit the world at all (host/editor/un-upgraded).
    // Gates keyboard/clipboard edit paths that are not per-cell.
    function canEditAny() {
      if (!admitted) return false;
      return myRole !== 'viewer' && myRole !== 'player';
    }

    const localClientId = (() => {
      try {
        const existing = localStorage.getItem(MP_CLIENT_ID_LS);
        if (existing) return existing;
        const next = 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        localStorage.setItem(MP_CLIENT_ID_LS, next);
        return next;
      } catch (_) {
        return 'u_' + Math.random().toString(36).slice(2, 10);
      }
    })();

    // Stable per-tab connection token keyed by roomId. Passed as PartyKit's _pk
    // so conn.id is reused across WS reconnects AND page reloads (server re-admits
    // a returning member from its seat memory). sessionStorage keeps it for this
    // tab+room without colliding across rooms or other tabs.
    const connToken = (() => {
      const key = MP_CONN_SS_PREFIX + roomId;
      try {
        const existing = sessionStorage.getItem(key);
        if (existing) return existing;
        const next = localClientId + '-' + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem(key, next);
        return next;
      } catch (_) {
        return localClientId + '-' + Math.random().toString(36).slice(2, 8);
      }
    })();

    function sanitizeMultiplayerId(value) {
      return String(value || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    }

    function hashNumber(text) {
      let h = 2166136261;
      const s = String(text || '');
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }

    function colorForId(id) {
      const hue = hashNumber(id) % 360;
      const c = new THREE.Color();
      c.setHSL(hue / 360, 0.72, 0.56);
      return '#' + c.getHexString();
    }

    function cssColorToHex(color) {
      const c = new THREE.Color(color || '#3c82f7');
      return c.getHex();
    }

    function multiplayerHost() {
      const explicit = params.get('partyHost')
        || window.__TINY_WORLD_PARTYKIT_HOST__
        || (() => { try { return localStorage.getItem(MP_HOST_LS); } catch (_) { return ''; } })();
      const host = String(explicit || '').trim().replace(/\/+$/, '');
      if (host) return host.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return 'ws://localhost:1999';
      // Deployed PartyKit room server — separate infra from the Netlify static
      // site. The previous `wss://' + location.host` default could never work:
      // the static host has no WebSocket server, so collab silently looped
      // "reconnecting" in production. Override via ?partyHost or
      // window.__TINY_WORLD_PARTYKIT_HOST__ / localStorage for other deploys.
      return 'wss://tinyworld-shared-building.jasonkneen.partykit.dev';
    }

    function multiplayerSocketUrl() {
      // _pk sets the PartyKit conn id; the stable per-page token lets the server
      // recognize this client across WS reconnects (seats re-admit, no re-lobby).
      return multiplayerHost() + '/party/' + encodeURIComponent(roomId) + '?_pk=' + encodeURIComponent(connToken);
    }

    function localName() {
      try {
        const stored = localStorage.getItem(MP_NAME_LS);
        if (stored) return stored.slice(0, 48);
      } catch (_) {}
      if (window.TinyWorldAuth && window.__loggedIn) return 'Builder';
      return 'Guest ' + localClientId.slice(-4).toUpperCase();
    }

    function ensureLocalName() {
      try {
        if ((localStorage.getItem(MP_NAME_LS) || '').trim()) return;
      } catch (_) {}
      const entered = window.prompt('Your name in this shared room:', '');
      if (!entered) return;
      const name = String(entered).trim().slice(0, 48);
      if (!name) return;
      try { localStorage.setItem(MP_NAME_LS, name); } catch (_) {}
    }

    function ensureStatus() {
      if (statusEl) return statusEl;
      statusEl = document.createElement('div');
      statusEl.className = 'multiplayer-status';
      statusEl.dataset.posType = 'primary';
      statusEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(statusEl);
      return statusEl;
    }

    function setStatus(state, text) {
      const el = ensureStatus();
      el.dataset.state = state;
      el.textContent = text;
    }

    function sendMessage(message) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      try {
        socket.send(JSON.stringify(message));
        return true;
      } catch (_) {
        return false;
      }
    }

    function localSelection() {
      const api = window.__tinyworldSelection;
      if (!api || typeof api.worldCoords !== 'function') return [];
      try {
        return api.worldCoords().slice(0, 64).map(c => ({ x: Math.round(c.x), z: Math.round(c.z) }));
      } catch (_) {
        return [];
      }
    }

    function localCursor() {
      if (!currentHover) return null;
      const x = Math.round(currentHover.x + (currentHover.boardX || 0) * GRID);
      const z = Math.round(currentHover.z + (currentHover.boardZ || 0) * GRID);
      let y = 0.05;
      try { y = hoverHeightForCell(currentHover) + 0.03; } catch (_) {}
      return { x, z, y };
    }

    function localToolLabel() {
      if (!selectedTool) return '';
      return selectedTool.label || selectedTool.id || selectedTool.kind || selectedTool.terrain || '';
    }

    function localPresence() {
      return {
        id: serverClientId || localClientId,
        name: localName(),
        color: colorForId(localClientId),
        cursor: localCursor(),
        selection: localSelection(),
        tool: localToolLabel(),
        ts: Date.now(),
      };
    }

    function schedulePresence(force = false) {
      if (presenceTimer) return;
      const wait = force ? 0 : Math.max(0, 90 - (Date.now() - lastPresenceSent));
      presenceTimer = setTimeout(() => {
        presenceTimer = null;
        publishPresence(force);
      }, wait);
    }

    function publishPresence(force = false) {
      const presence = localPresence();
      const key = JSON.stringify({
        cursor: presence.cursor,
        selection: presence.selection,
        tool: presence.tool,
      });
      if (!force && key === lastPresenceKey) return;
      lastPresenceKey = key;
      lastPresenceSent = Date.now();
      sendMessage({ type: 'presence', presence });
    }

    // -------- connected-user roster (top-center pill) --------
    function avatarInitials(name) {
      const t = String(name || '').trim();
      if (!t) return '?';
      const parts = t.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return t.slice(0, 2).toUpperCase();
    }

    function ensureRoster() {
      if (rosterEl) return rosterEl;
      rosterEl = document.createElement('div');
      rosterEl.className = 'multiplayer-roster';
      rosterEl.dataset.posType = 'neutral';
      rosterEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(rosterEl);
      return rosterEl;
    }

    // Inline SVG glyphs (no emoji, no PNG). Returns an <svg> element.
    function svgGlyph(kind) {
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '14');
      svg.setAttribute('height', '14');
      svg.setAttribute('aria-hidden', 'true');
      const paths = {
        // eye (viewer)
        viewer: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
        // pencil (editor)
        editor: ['M4 20h4l10-10-4-4L4 16v4z M14 6l4 4'],
        // play (player)
        player: ['M8 5l11 7-11 7z'],
        // crown (host)
        host: ['M4 18h16l-1.5-9-4 4-2.5-7-2.5 7-4-4z'],
        // check (admit)
        check: ['M5 13l4 4 10-10'],
        // x (decline / close)
        close: ['M6 6l12 12 M18 6L6 18'],
        // gear / dots (menu)
        menu: ['M5 12h.01 M12 12h.01 M19 12h.01'],
        // speech bubble (chat)
        chat: ['M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z'],
        // paper plane (send)
        send: ['M22 2 11 13 M22 2 15 22 11 13 2 9z'],
      };
      (paths[kind] || []).forEach(d => {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d);
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', 'currentColor');
        p.setAttribute('stroke-width', '2');
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(p);
      });
      return svg;
    }

    function roleLabel(role) {
      if (role === 'host') return 'Host';
      if (role === 'editor') return 'Editor';
      if (role === 'player') return 'Player';
      if (role === 'viewer') return 'Viewer';
      return '';
    }

    // Brief glassy toast bottom-center. textContent only (remote names).
    function showToast(text) {
      const t = document.createElement('div');
      t.className = 'mp-toast';
      t.textContent = String(text || '');
      document.body.appendChild(t);
      requestAnimationFrame(() => t.classList.add('visible'));
      setTimeout(() => {
        t.classList.remove('visible');
        setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
      }, 3200);
    }

    // Render is textContent-only (peer names are remote-controlled, so never
    // innerHTML) and colors are validated before hitting style. The host sees a
    // role badge + a moderation menu per peer; non-host clients see only their
    // own badge (no wire path to learn other peers' roles — see roleById note).
    function renderRoster() {
      const el = ensureRoster();
      el.textContent = '';
      if (!connected || !admitted) { el.classList.remove('visible'); return; }
      const meId = serverClientId || localClientId;
      const people = [{ id: meId, name: localName(), color: colorForId(localClientId), self: true, role: myRole }];
      peers.forEach((peer, id) => {
        if (id === meId) return;
        people.push({
          id,
          name: (peer.presence && peer.presence.name) || 'Builder',
          color: peer.color,
          role: isHost ? (roleById.get(id) || null) : null,
        });
      });
      const count = document.createElement('span');
      count.className = 'mp-count';
      count.textContent = String(people.length);
      count.title = people.length + (people.length === 1 ? ' person here' : ' people here');
      el.appendChild(count);
      const avatars = document.createElement('span');
      avatars.className = 'mp-avatars';
      const MAX_SHOWN = 8;
      people.slice(0, MAX_SHOWN).forEach((p) => {
        const a = document.createElement('span');
        a.className = 'mp-avatar' + (p.self ? ' mp-self' : '');
        a.style.background = /^#[0-9a-fA-F]{3,8}$/.test(String(p.color)) ? p.color : '#3c82f7';
        a.textContent = avatarInitials(p.name);
        const roleSuffix = p.role ? ' — ' + roleLabel(p.role) : '';
        a.title = (p.self ? p.name + ' (you)' : p.name) + roleSuffix;
        if (p.role) {
          const badge = document.createElement('span');
          badge.className = 'mp-role-badge mp-role-' + p.role;
          badge.appendChild(svgGlyph(p.role));
          a.appendChild(badge);
        }
        // Host can click any non-self peer to open a moderation menu.
        if (isHost && !p.self) {
          a.classList.add('mp-clickable');
          a.addEventListener('click', (ev) => {
            ev.stopPropagation();
            openModerationMenu(p.id, p.name, a);
          });
        }
        avatars.appendChild(a);
      });
      const overflow = people.length - Math.min(people.length, MAX_SHOWN);
      if (overflow > 0) {
        const m = document.createElement('span');
        m.className = 'mp-avatar mp-more';
        m.textContent = '+' + overflow;
        m.title = overflow + ' more';
        avatars.appendChild(m);
      }
      el.appendChild(avatars);
      el.classList.add('visible');
    }

    // MVP editor grant = the host's home board: world x,z in [0, GRID-1].
    // TODO: per-editable-island granularity (grant the bounds of the specific
    // island the host has selected, derived from boardX/boardZ * GRID).
    function homeIslandBounds() {
      const g = (typeof GRID === 'number' && GRID > 0) ? GRID : 16;
      return { minX: 0, maxX: g - 1, minZ: 0, maxZ: g - 1 };
    }

    // Segmented role picker (Viewer / Editor / Player) in the app style.
    // Returns { el, value() }. Default selection = 'viewer'.
    function makeRolePicker(initial) {
      const seg = document.createElement('div');
      seg.className = 'mp-segmented';
      let value = initial && /^(viewer|editor|player)$/.test(initial) ? initial : 'viewer';
      const options = [
        { id: 'viewer', label: 'Viewer' },
        { id: 'editor', label: 'Editor' },
        { id: 'player', label: 'Player' },
      ];
      const buttons = new Map();
      options.forEach(opt => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mp-seg-btn' + (opt.id === value ? ' is-active' : '');
        b.appendChild(svgGlyph(opt.id));
        const span = document.createElement('span');
        span.textContent = opt.label;
        b.appendChild(span);
        b.addEventListener('click', () => {
          value = opt.id;
          buttons.forEach((btn, id) => btn.classList.toggle('is-active', id === value));
        });
        buttons.set(opt.id, b);
        seg.appendChild(b);
      });
      return { el: seg, value: () => value };
    }

    // -------- lobby-wait overlay (shown to an un-admitted self) --------
    function showLobbyOverlay(show) {
      if (show) {
        if (!lobbyOverlayEl) {
          lobbyOverlayEl = document.createElement('div');
          lobbyOverlayEl.className = 'mp-lobby-overlay';
          const card = document.createElement('div');
          card.className = 'mp-lobby-card';
          const title = document.createElement('div');
          title.className = 'mp-lobby-title';
          title.textContent = 'Waiting for the host to let you in...';
          const sub = document.createElement('div');
          sub.className = 'mp-lobby-sub';
          sub.textContent = 'You will join the shared build as soon as the host admits you.';
          card.appendChild(title);
          card.appendChild(sub);
          lobbyOverlayEl.appendChild(card);
          document.body.appendChild(lobbyOverlayEl);
        }
        lobbyOverlayEl.classList.add('visible');
      } else if (lobbyOverlayEl) {
        lobbyOverlayEl.classList.remove('visible');
      }
    }

    // Show a brief, terminal notice (declined / kicked); stops reconnecting.
    function showLobbyNotice(text) {
      showLobbyOverlay(true);
      if (!lobbyOverlayEl) return;
      const card = lobbyOverlayEl.querySelector('.mp-lobby-card');
      if (!card) return;
      card.textContent = '';
      const title = document.createElement('div');
      title.className = 'mp-lobby-title';
      title.textContent = text;
      card.appendChild(title);
    }

    // -------- host admit panel (lists pending lobby members) --------
    function ensureAdmitPanel() {
      if (admitPanelEl) return admitPanelEl;
      admitPanelEl = document.createElement('div');
      admitPanelEl.className = 'mp-admit-panel';
      const head = document.createElement('div');
      head.className = 'mp-admit-head';
      const heading = document.createElement('span');
      heading.className = 'mp-admit-title';
      heading.textContent = 'Lobby';
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'mp-admit-close';
      close.setAttribute('aria-label', 'Hide lobby');
      close.appendChild(svgGlyph('close'));
      close.addEventListener('click', () => { admitPanelEl.classList.remove('visible'); });
      head.appendChild(heading);
      head.appendChild(close);
      const list = document.createElement('div');
      list.className = 'mp-admit-list';
      admitPanelEl.appendChild(head);
      admitPanelEl.appendChild(list);
      document.body.appendChild(admitPanelEl);
      return admitPanelEl;
    }

    // Upsert the panel rows from pendingLobby (keyed by id — no duplicates).
    function renderAdmitPanel() {
      if (!isHost) { if (admitPanelEl) admitPanelEl.classList.remove('visible'); return; }
      const panel = ensureAdmitPanel();
      const list = panel.querySelector('.mp-admit-list');
      list.textContent = '';
      if (pendingLobby.size === 0) {
        panel.classList.remove('visible');
        return;
      }
      pendingLobby.forEach((entry) => {
        const row = document.createElement('div');
        row.className = 'mp-admit-row';
        const av = document.createElement('span');
        av.className = 'mp-avatar';
        av.style.background = colorForId(entry.id);
        av.textContent = avatarInitials(entry.name || 'Guest');
        const nameEl = document.createElement('span');
        nameEl.className = 'mp-admit-name';
        nameEl.textContent = entry.name || 'Guest';
        const picker = makeRolePicker('viewer');
        const actions = document.createElement('div');
        actions.className = 'mp-admit-actions';
        const admitBtn = document.createElement('button');
        admitBtn.type = 'button';
        admitBtn.className = 'mp-btn mp-btn-admit';
        admitBtn.appendChild(svgGlyph('check'));
        const admitLabel = document.createElement('span');
        admitLabel.textContent = 'Admit';
        admitBtn.appendChild(admitLabel);
        admitBtn.addEventListener('click', () => {
          const role = picker.value();
          const island = role === 'editor' ? homeIslandBounds() : null;
          sendMessage({ type: 'admit', id: entry.id, role, island });
          roleById.set(entry.id, role);
          pendingLobby.delete(entry.id);
          renderAdmitPanel();
        });
        const declineBtn = document.createElement('button');
        declineBtn.type = 'button';
        declineBtn.className = 'mp-btn mp-btn-decline';
        declineBtn.appendChild(svgGlyph('close'));
        const declineLabel = document.createElement('span');
        declineLabel.textContent = 'Decline';
        declineBtn.appendChild(declineLabel);
        declineBtn.addEventListener('click', () => {
          sendMessage({ type: 'decline', id: entry.id });
          pendingLobby.delete(entry.id);
          renderAdmitPanel();
        });
        actions.appendChild(admitBtn);
        actions.appendChild(declineBtn);
        const top = document.createElement('div');
        top.className = 'mp-admit-rowtop';
        top.appendChild(av);
        top.appendChild(nameEl);
        row.appendChild(top);
        row.appendChild(picker.el);
        row.appendChild(actions);
        list.appendChild(row);
      });
      panel.classList.add('visible');
    }

    // -------- host moderation menu (change role / kick a peer) --------
    function closeModerationMenu() {
      if (moderationMenuEl && moderationMenuEl.parentNode) moderationMenuEl.parentNode.removeChild(moderationMenuEl);
      moderationMenuEl = null;
    }

    function openModerationMenu(id, name, anchorEl) {
      closeModerationMenu();
      const menu = document.createElement('div');
      menu.className = 'mp-mod-menu';
      const title = document.createElement('div');
      title.className = 'mp-mod-title';
      title.textContent = name || 'Builder';
      menu.appendChild(title);
      const picker = makeRolePicker(roleById.get(id) || 'viewer');
      menu.appendChild(picker.el);
      const apply = document.createElement('button');
      apply.type = 'button';
      apply.className = 'mp-btn mp-btn-admit';
      const applyLabel = document.createElement('span');
      applyLabel.textContent = 'Change role';
      apply.appendChild(applyLabel);
      apply.addEventListener('click', () => {
        const role = picker.value();
        const island = role === 'editor' ? homeIslandBounds() : null;
        sendMessage({ type: 'setRole', id, role, island });
        roleById.set(id, role);
        closeModerationMenu();
        renderRoster();
      });
      const kick = document.createElement('button');
      kick.type = 'button';
      kick.className = 'mp-btn mp-btn-decline';
      const kickLabel = document.createElement('span');
      kickLabel.textContent = 'Kick';
      kick.appendChild(kickLabel);
      kick.addEventListener('click', () => {
        sendMessage({ type: 'kick', id });
        roleById.delete(id);
        closeModerationMenu();
      });
      menu.appendChild(apply);
      menu.appendChild(kick);
      const rect = anchorEl.getBoundingClientRect();
      menu.style.top = (rect.bottom + 8) + 'px';
      menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 220)) + 'px';
      document.body.appendChild(menu);
      moderationMenuEl = menu;
      // Dismiss on outside click.
      setTimeout(() => {
        const onDoc = (ev) => {
          if (moderationMenuEl && !moderationMenuEl.contains(ev.target)) {
            closeModerationMenu();
            document.removeEventListener('pointerdown', onDoc, true);
          }
        };
        document.addEventListener('pointerdown', onDoc, true);
      }, 0);
    }

    // ============================================================
    // Chat: a draggable glassy panel matching the Layers/Properties design
    // language (drag-bar head + x close, segmented tab, block-style send button,
    // SVG glyphs, no emoji). Built lazily in-JS (createElement) like the other
    // mp-* panels so no HTML edits are needed. All remote-controlled strings
    // (peer names, message text) render via textContent ONLY — never innerHTML.
    // Chat is NOT host-gated: host and every admitted guest participate.
    // ------------------------------------------------------------

    function formatChatTime(ts) {
      try {
        const d = new Date(Number(ts) || Date.now());
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return hh + ':' + mm;
      } catch (_) { return ''; }
    }

    function updateChatBadge() {
      if (!chatBadgeEl) return;
      if (chatUnread > 0 && !chatOpen) {
        chatBadgeEl.textContent = chatUnread > 99 ? '99+' : String(chatUnread);
        chatBadgeEl.classList.add('visible');
      } else {
        chatBadgeEl.classList.remove('visible');
      }
    }

    // Floating launcher button (bottom-right). Visible only to an admitted peer;
    // clicking opens/closes the panel and clears the unread bubble.
    function ensureChatToggle() {
      if (chatToggleEl) return chatToggleEl;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mp-chat-toggle';
      btn.dataset.posType = 'primary';
      btn.setAttribute('aria-label', 'Open chat');
      btn.appendChild(svgGlyph('chat'));
      const badge = document.createElement('span');
      badge.className = 'mp-chat-badge';
      badge.setAttribute('aria-hidden', 'true');
      btn.appendChild(badge);
      btn.addEventListener('click', () => { toggleChat(); });
      document.body.appendChild(btn);
      chatToggleEl = btn;
      chatBadgeEl = badge;
      return btn;
    }

    function ensureChatPanel() {
      if (chatPanelEl) return chatPanelEl;
      const panel = document.createElement('section');
      panel.className = 'mp-chat-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Shared room chat');

      // Drag-bar head + close (matches .layers-panel-head).
      const head = document.createElement('div');
      head.className = 'mp-chat-head';
      head.setAttribute('aria-label', 'Drag to move chat');
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'mp-chat-close';
      close.setAttribute('aria-label', 'Close chat');
      close.appendChild(svgGlyph('close'));
      close.addEventListener('click', () => { closeChat(); });
      head.appendChild(close);

      // Segmented tab bar (single Chat tab, in the Layers/Properties style).
      const tabs = document.createElement('div');
      tabs.className = 'mp-chat-tabs';
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'mp-chat-tab is-active';
      const tabLabel = document.createElement('span');
      tabLabel.textContent = 'Chat';
      tab.appendChild(svgGlyph('chat'));
      tab.appendChild(tabLabel);
      tabs.appendChild(tab);

      const log = document.createElement('div');
      log.className = 'mp-chat-log';
      log.setAttribute('aria-live', 'polite');

      const typing = document.createElement('div');
      typing.className = 'mp-chat-typing';

      const form = document.createElement('form');
      form.className = 'mp-chat-form';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'mp-chat-input';
      input.maxLength = 1000;
      input.placeholder = 'Message...';
      input.setAttribute('aria-label', 'Chat message');
      input.autocomplete = 'off';
      const sendBtn = document.createElement('button');
      sendBtn.type = 'submit';
      sendBtn.className = 'mp-chat-send';
      sendBtn.setAttribute('aria-label', 'Send message');
      sendBtn.appendChild(svgGlyph('send'));
      form.appendChild(input);
      form.appendChild(sendBtn);

      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        sendChat(input.value);
        input.value = '';
        setLocalTyping(false);
      });
      // Typing indicator: announce while composing, stop on empty / blur.
      input.addEventListener('input', () => {
        setLocalTyping(input.value.trim().length > 0);
      });
      input.addEventListener('blur', () => { setLocalTyping(false); });

      panel.appendChild(head);
      panel.appendChild(tabs);
      panel.appendChild(log);
      panel.appendChild(typing);
      panel.appendChild(form);
      document.body.appendChild(panel);

      chatPanelEl = panel;
      chatLogEl = log;
      chatInputEl = input;
      chatTypingEl = typing;

      wireChatDrag(panel, head);
      return panel;
    }

    // Drag the panel by its head, mirroring the Layers panel behavior
    // (.dragging class, clamp to viewport, pointer capture).
    function wireChatDrag(panel, head) {
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let baseLeft = 0;
      let baseTop = 0;
      head.addEventListener('pointerdown', (ev) => {
        if (ev.target && ev.target.closest && ev.target.closest('.mp-chat-close')) return;
        dragging = true;
        const rect = panel.getBoundingClientRect();
        baseLeft = rect.left;
        baseTop = rect.top;
        startX = ev.clientX;
        startY = ev.clientY;
        panel.classList.add('dragging');
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.left = baseLeft + 'px';
        panel.style.top = baseTop + 'px';
        try { head.setPointerCapture(ev.pointerId); } catch (_) {}
      });
      head.addEventListener('pointermove', (ev) => {
        if (!dragging) return;
        const w = panel.offsetWidth;
        const h = panel.offsetHeight;
        let nx = baseLeft + (ev.clientX - startX);
        let ny = baseTop + (ev.clientY - startY);
        nx = Math.max(8, Math.min(nx, window.innerWidth - w - 8));
        ny = Math.max(8, Math.min(ny, window.innerHeight - h - 8));
        panel.style.left = nx + 'px';
        panel.style.top = ny + 'px';
      });
      const endDrag = (ev) => {
        if (!dragging) return;
        dragging = false;
        panel.classList.remove('dragging');
        try { head.releasePointerCapture(ev.pointerId); } catch (_) {}
      };
      head.addEventListener('pointerup', endDrag);
      head.addEventListener('pointercancel', endDrag);
    }

    function openChat() {
      if (!admitted) return;
      ensureChatPanel();
      chatPanelEl.classList.add('visible');
      chatOpen = true;
      chatUnread = 0;
      updateChatBadge();
      if (chatToggleEl) chatToggleEl.classList.add('is-open');
      if (chatLogEl) chatLogEl.scrollTop = chatLogEl.scrollHeight;
      if (chatInputEl) { try { chatInputEl.focus(); } catch (_) {} }
    }

    function closeChat() {
      if (chatPanelEl) chatPanelEl.classList.remove('visible');
      chatOpen = false;
      if (chatToggleEl) chatToggleEl.classList.remove('is-open');
      setLocalTyping(false);
    }

    function toggleChat() {
      if (chatOpen) closeChat();
      else openChat();
    }

    // Show/hide the chat launcher based on connection + admitted state. Hidden
    // while in the lobby (un-admitted), shown once admitted (host or guest).
    function updateChatAvailability() {
      const show = connected && admitted;
      ensureChatToggle();
      chatToggleEl.style.display = show ? 'inline-flex' : 'none';
      if (!show && chatOpen) closeChat();
    }

    // Append one message line. name + text are remote-controlled => textContent
    // ONLY (never innerHTML). `self` styles our own messages distinctly.
    function appendChatMessage(msg) {
      ensureChatPanel();
      const meId = serverClientId || localClientId;
      const self = String(msg.id || '') === meId;
      const row = document.createElement('div');
      row.className = 'mp-chat-msg' + (self ? ' is-self' : '');
      const metaEl = document.createElement('div');
      metaEl.className = 'mp-chat-meta';
      const nameEl = document.createElement('span');
      nameEl.className = 'mp-chat-name';
      nameEl.textContent = self ? 'You' : String(msg.name || 'Builder');
      nameEl.style.color = /^#[0-9a-fA-F]{3,8}$/.test(colorForId(String(msg.id || ''))) ? colorForId(String(msg.id || '')) : '#3c82f7';
      const timeEl = document.createElement('span');
      timeEl.className = 'mp-chat-time';
      timeEl.textContent = formatChatTime(msg.ts);
      metaEl.appendChild(nameEl);
      metaEl.appendChild(timeEl);
      const textEl = document.createElement('div');
      textEl.className = 'mp-chat-text';
      textEl.textContent = String(msg.text || '');
      row.appendChild(metaEl);
      row.appendChild(textEl);
      const nearBottom = chatLogEl.scrollHeight - chatLogEl.scrollTop - chatLogEl.clientHeight < 40;
      chatLogEl.appendChild(row);
      // Cap the log so a long session never grows unbounded.
      while (chatLogEl.children.length > 250) chatLogEl.removeChild(chatLogEl.firstChild);
      if (nearBottom || self || chatOpen) chatLogEl.scrollTop = chatLogEl.scrollHeight;
    }

    function handleRemoteChat(msg) {
      if (!admitted) return;
      const meId = serverClientId || localClientId;
      appendChatMessage(msg);
      // Unread bubble only for OTHERS' messages received while the panel is shut.
      if (!chatOpen && String(msg.id || '') !== meId) {
        chatUnread++;
        updateChatBadge();
      }
      // Any delivered message means that peer has stopped typing.
      clearTypingPeer(String(msg.id || ''));
    }

    // ---- typing indicator ----
    function renderTyping() {
      if (!chatTypingEl) return;
      const names = [];
      typingPeers.forEach(p => { if (p && p.name) names.push(p.name); });
      if (!names.length) {
        chatTypingEl.textContent = '';
        chatTypingEl.classList.remove('visible');
        return;
      }
      let label;
      if (names.length === 1) label = names[0] + ' is typing...';
      else if (names.length === 2) label = names[0] + ' and ' + names[1] + ' are typing...';
      else label = 'Several people are typing...';
      chatTypingEl.textContent = label;   // remote names => textContent only.
      chatTypingEl.classList.add('visible');
    }

    function clearTypingPeer(id) {
      const entry = typingPeers.get(id);
      if (!entry) return;
      if (entry.timer) clearTimeout(entry.timer);
      typingPeers.delete(id);
      renderTyping();
    }

    function handleRemoteTyping(msg) {
      if (!admitted) return;
      const id = String(msg.id || '');
      const meId = serverClientId || localClientId;
      if (!id || id === meId) return;
      if (msg.typing === true) {
        const prev = typingPeers.get(id);
        if (prev && prev.timer) clearTimeout(prev.timer);
        // Auto-expire so a dropped typing:false never leaves a stuck indicator.
        const timer = setTimeout(() => { typingPeers.delete(id); renderTyping(); }, 4000);
        typingPeers.set(id, { name: String(msg.name || 'Builder'), timer });
        renderTyping();
      } else {
        clearTypingPeer(id);
      }
    }

    // Our own typing state -> throttled chat.typing broadcast. Sends true once
    // when composing begins (refreshes a stop-timer), false when it ends.
    function setLocalTyping(active) {
      if (active) {
        if (!chatTypingActive) {
          chatTypingActive = true;
          sendMessage({ type: 'chat.typing', name: localName(), typing: true });
        }
        if (chatTypingTimer) clearTimeout(chatTypingTimer);
        chatTypingTimer = setTimeout(() => { setLocalTyping(false); }, 3500);
      } else {
        if (chatTypingTimer) { clearTimeout(chatTypingTimer); chatTypingTimer = null; }
        if (chatTypingActive) {
          chatTypingActive = false;
          sendMessage({ type: 'chat.typing', name: localName(), typing: false });
        }
      }
    }

    function sendChat(rawText) {
      if (!admitted) return;
      const text = String(rawText || '').trim().slice(0, 1000);
      if (!text) return;
      // Server stamps id + ts and echoes back to everyone (incl. us), so we do
      // NOT render locally here — the round-trip drives a single render path.
      sendMessage({ type: 'chat', name: localName(), text });
    }

    // ============================================================
    // Guest menu hide: when this client is an admitted NON-host with a real role
    // (viewer/player/editor), hide the world-management menu so a guest cannot
    // leave the host's world. Host / null role (un-upgraded server) / single
    // player keep the full menu. Single-player never reaches here (the whole IIFE
    // early-returns when there is no roomId). A body class drives the CSS so this
    // stays declarative and reversible if the host is promoted/demoted.
    // ------------------------------------------------------------
    function updateGuestMenuVisibility() {
      const isGuest = admitted && !isHost && (myRole === 'viewer' || myRole === 'player' || myRole === 'editor');
      // viewer/player have no edit rights at all: mp-noedit hides every editing
      // control (tools, panels, appbar, agent prompt). editor keeps them (scoped).
      const noEdit = admitted && !isHost && (myRole === 'viewer' || myRole === 'player');
      try {
        document.body.classList.toggle('mp-guest', !!isGuest);
        document.body.classList.toggle('mp-noedit', !!noEdit);
        // If a guest had the world menu open, close it so it cannot linger.
        if (isGuest) {
          const menu = document.getElementById('world-menu');
          const btn = document.getElementById('world-menu-btn');
          if (menu && !menu.hidden) menu.hidden = true;
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      } catch (_) {}
    }

    function makeNameSprite(name, color) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '700 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      const label = String(name || 'Builder').slice(0, 28);
      const width = Math.min(230, Math.max(72, ctx.measureText(label).width + 28));
      ctx.fillStyle = 'rgba(24, 28, 38, 0.84)';
      roundRect(ctx, (256 - width) / 2, 12, width, 36, 12);
      ctx.fill();
      ctx.fillStyle = color || '#3c82f7';
      ctx.beginPath();
      ctx.arc((256 - width) / 2 + 18, 30, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 128, 31);
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(1.55, 0.38, 1);
      sprite.renderOrder = 1500;
      return sprite;
    }

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    }

    function ensurePeer(id, presence) {
      let peer = peers.get(id);
      if (peer) return peer;
      const color = presence.color || colorForId(id);
      const group = new THREE.Group();
      group.name = 'multiplayer-peer-' + id;
      const ringMat = new THREE.MeshBasicMaterial({
        color: cssColorToHex(color),
        transparent: true,
        opacity: 0.92,
        depthTest: false,
      });
      // Square cell-footprint outline (not a circle) so the peer marker lines up
      // with the grid like the selection square does.
      const sqOuter = new THREE.Shape();
      sqOuter.moveTo(-0.5, -0.5); sqOuter.lineTo(0.5, -0.5); sqOuter.lineTo(0.5, 0.5); sqOuter.lineTo(-0.5, 0.5); sqOuter.lineTo(-0.5, -0.5);
      const sqHole = new THREE.Path();
      sqHole.moveTo(-0.4, -0.4); sqHole.lineTo(-0.4, 0.4); sqHole.lineTo(0.4, 0.4); sqHole.lineTo(0.4, -0.4); sqHole.lineTo(-0.4, -0.4);
      sqOuter.holes.push(sqHole);
      const ring = new THREE.Mesh(new THREE.ShapeGeometry(sqOuter), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 1400;
      group.add(ring);
      const beacon = new THREE.Mesh(
        new THREE.ConeGeometry(0.13, 0.34, 18),
        new THREE.MeshBasicMaterial({ color: cssColorToHex(color), transparent: true, opacity: 0.86, depthTest: false })
      );
      beacon.position.y = 0.34;
      beacon.renderOrder = 1401;
      group.add(beacon);
      const label = makeNameSprite(presence.name, color);
      label.position.y = 0.86;
      group.add(label);
      const selection = new THREE.Group();
      selection.name = 'multiplayer-selection-' + id;
      group.add(selection);
      peerRoot.add(group);
      peer = { id, group, ring, beacon, label, selection, presence: null, color };
      peers.set(id, peer);
      return peer;
    }

    function disposeObject3d(obj) {
      if (!obj) return;
      obj.traverse(node => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach(mat => {
            if (mat.map) mat.map.dispose();
            mat.dispose();
          });
        }
      });
    }

    function removePeer(id) {
      const peer = peers.get(id);
      if (!peer) return;
      peerRoot.remove(peer.group);
      disposeObject3d(peer.group);
      peers.delete(id);
      // A departed peer cannot still be "typing" — drop their indicator.
      clearTypingPeer(id);
      renderRoster();
    }

    function clearGroup(group) {
      while (group.children.length) {
        const child = group.children.pop();
        disposeObject3d(child);
      }
    }

    function cellY(x, z) {
      try { return hoverHeightForCell({ x, z, boardX: 0, boardZ: 0 }) + 0.012; } catch (_) { return 0.04; }
    }

    function updatePeerSelection(peer, selection) {
      clearGroup(peer.selection);
      const cells = Array.isArray(selection) ? selection.slice(0, 64) : [];
      if (!cells.length) return;
      const color = cssColorToHex(peer.color);
      const fillMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false, depthTest: false });
      const edgeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, depthWrite: false, depthTest: false });
      cells.forEach(cell => {
        const x = Math.round(Number(cell.x));
        const z = Math.round(Number(cell.z));
        if (!Number.isFinite(x) || !Number.isFinite(z)) return;
        const p = tilePos(x, z);
        const y = cellY(x, z);
        const fill = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.018, 0.92), fillMat);
        fill.position.set(p.x, y, p.z);
        fill.renderOrder = 1390;
        peer.selection.add(fill);
        const edgeN = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.025, 0.045), edgeMat);
        const edgeS = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.025, 0.045), edgeMat);
        const edgeW = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.025, 0.96), edgeMat);
        const edgeE = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.025, 0.96), edgeMat);
        edgeN.position.set(p.x, y + 0.018, p.z - 0.48);
        edgeS.position.set(p.x, y + 0.018, p.z + 0.48);
        edgeW.position.set(p.x - 0.48, y + 0.018, p.z);
        edgeE.position.set(p.x + 0.48, y + 0.018, p.z);
        [edgeN, edgeS, edgeW, edgeE].forEach(edge => { edge.renderOrder = 1391; peer.selection.add(edge); });
      });
    }

    function updatePeerPresence(presence) {
      if (!presence || !presence.id || presence.id === serverClientId) return;
      const peer = ensurePeer(presence.id, presence);
      peer.presence = presence;
      if (presence.color && presence.color !== peer.color) peer.color = presence.color;
      if (presence.cursor) {
        const p = tilePos(Math.round(Number(presence.cursor.x)), Math.round(Number(presence.cursor.z)));
        const y = Number.isFinite(Number(presence.cursor.y)) ? Number(presence.cursor.y) : cellY(presence.cursor.x, presence.cursor.z);
        peer.group.position.set(p.x, y + 0.015, p.z);
        peer.group.visible = true;
      } else {
        peer.group.visible = false;
      }
      updatePeerSelection(peer, presence.selection);
      renderRoster();
    }

    function cleanCellForSend(cell) {
      if (!cell || typeof cell !== 'object') return null;
      try { return JSON.parse(JSON.stringify(cell)); } catch (_) { return null; }
    }

    function sendCellSnapshot(x, z, cell) {
      // Gate on suppressSave too: it brackets the entire async bulk-apply
      // window (set before buildOneChunk, cleared in finishApplyState), so a
      // snapshot load no longer floods the room over peers' live edits.
      // Interactive single-click edits never set suppressSave, so they still
      // flow. suppressSave is a shared global declared at 29-persistence-api.js:9.
      if (applyingRemote || (typeof suppressSave !== 'undefined' && suppressSave) || !cell) return;
      // Role gate: viewers/players never broadcast; an editor only within its
      // granted island bounds. canEdit is the single source of truth shared
      // with applyTool. Un-upgraded server => myRole null => always permitted.
      if (!canEdit(x, z)) return;
      const copy = cleanCellForSend(cell);
      if (!copy) return;
      sendMessage({
        type: 'cell.set',
        op: {
          id: localClientId + ':' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2, 6),
          kind: 'cell.set',
          x: Math.round(Number(x)),
          z: Math.round(Number(z)),
          cell: copy,
          ts: Date.now(),
        },
      });
    }

    function applyRemoteCell(op) {
      if (!op || !op.cell) return;
      if (!admitted) return;
      const x = Math.round(Number(op.x));
      const z = Math.round(Number(op.z));
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      // Defense-in-depth: mirror the server's coordinate range check (party
      // index.js MAX_CELL_COORD) so a malicious/buggy server can't grow
      // world[x][z] without bound. Generous cap keeps sparse ghost-board cells.
      const maxRemoteCoord = 100000;
      if (Math.abs(x) > maxRemoteCoord || Math.abs(z) > maxRemoteCoord) return;
      applyingRemote = true;
      const oldHistoryMuted = typeof worldHistoryMuted !== 'undefined' ? worldHistoryMuted : false;
      try {
        if (typeof worldHistoryMuted !== 'undefined') worldHistoryMuted = true;
        setCell(x, z, Object.assign({}, op.cell, {
          animate: false,
          impactDust: false,
          forceTile: true,
        }));
      } catch (err) {
        console.warn('[multiplayer] remote cell failed:', err);
      } finally {
        if (typeof worldHistoryMuted !== 'undefined') worldHistoryMuted = oldHistoryMuted;
        applyingRemote = false;
      }
    }

    // Apply a granted role/island/admitted state to local self-state, then
    // refresh dependent UI. Called from welcome / admitted / role.
    function applySelfState(role, island, isAdmitted) {
      if (typeof role === 'string') {
        myRole = role;
        isHost = role === 'host';
      }
      myIsland = island && typeof island === 'object' ? island : (myRole === 'editor' ? myIsland : null);
      admitted = isAdmitted;
      showLobbyOverlay(!admitted);
      if (admitted) {
        publishPresence(true);
        renderRoster();
      }
      renderAdmitPanel();
      // Role/admitted just changed — refresh guest-menu hide + chat launcher.
      updateGuestMenuVisibility();
      updateChatAvailability();
    }

    function ingestPending(list) {
      if (!Array.isArray(list)) return;
      list.forEach(p => {
        if (!p || !p.id) return;
        pendingLobby.set(p.id, { id: p.id, name: String(p.name || '') });
      });
      renderAdmitPanel();
    }

    // ============================================================
    // Shared-state sync: snapshot-on-join, live environment, live moorings.
    // ------------------------------------------------------------
    // All names live INSIDE this IIFE (no new top-level globals — the
    // duplicate-declaration guard in tools/check.js scans engine/world/*.js
    // top-level scope, which this file's body is nested below).
    // ============================================================

    const SNAPSHOT_CHUNK = 12000;   // raw chars/chunk; after JSON-escaping into the
                                    // wire envelope this stays well under the 48KB cap.

    // ---- environment capture (host) ----
    // Reads the LIVE controls/globals so the snapshot + live-env messages carry
    // the host's actual environment. time-of-day, weatherIntensity and
    // weatherSplashIntensity are shared top-level globals (01/23); season +
    // weather are module-30 closure state, so we read them off the active pills.
    function activePillValue(containerId, attr) {
      try {
        const c = document.getElementById(containerId);
        if (!c) return '';
        const active = c.querySelector('.pill.active');
        return active ? String(active.getAttribute(attr) || '') : '';
      } catch (_) { return ''; }
    }

    function shieldIsOn() {
      try {
        const s = window.VoxelShield && window.VoxelShield.shield;
        return !!s && (s.targetProgress > 0.5 || s.progress > 0.05);
      } catch (_) { return false; }
    }

    function captureEnvState() {
      const env = {
        // shared top-level global (engine/world/01-render-core.js:137).
        timeOfDay: (typeof currentTodMinutes === 'number') ? currentTodMinutes : 720,
        weather: activePillValue('weather-pills', 'data-weather') || 'clear',
        season: activePillValue('season-pills', 'data-season') || 'summer',
        // shared top-level globals (engine/world/23-particles-clouds.js:650-651).
        weatherIntensity: (typeof weatherIntensity === 'number') ? weatherIntensity : 0.25,
        weatherSplashes: (typeof weatherSplashIntensity === 'number') ? weatherSplashIntensity : 1.5,
        shield: shieldIsOn(),
        // Placeable lights ride entirely in the world cells (lamp-post/spotlight
        // kinds register via module 10 -> module 39), so they replicate through
        // the snapshot cells + live cell.set. There is no non-cell light source,
        // so this stays [] for wire-shape compliance (no double-sync).
        lights: [],
      };
      return env;
    }

    // Stable string for dedupe (so a no-op slider tick never re-broadcasts).
    function envKey(env) {
      return [env.timeOfDay, env.weather, env.season,
        Number(env.weatherIntensity).toFixed(2), Number(env.weatherSplashes).toFixed(2),
        env.shield ? 1 : 0].join('|');
    }

    // ---- environment apply (peer) ----
    // Drive module 30's OWN controls so its closure season/weather/todMinutes
    // and the lighting recompute stay consistent: click the matching pill and
    // dispatch 'input' on the sliders. Wrapped in applyingRemoteEnv so our own
    // change listeners do not re-broadcast. Order: season -> weather ->
    // intensity -> splashes -> time -> shield.
    function clickPill(containerId, attr, value) {
      if (!value) return;
      try {
        const c = document.getElementById(containerId);
        if (!c) return;
        const target = c.querySelector('.pill[' + attr + '="' + String(value).replace(/[^a-z]/gi, '') + '"]');
        if (target && !target.classList.contains('active')) target.click();
      } catch (_) {}
    }

    function setRange(id, value, dispatch) {
      try {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = String(value);
        if (dispatch) el.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (_) {}
    }

    function applyEnvState(env) {
      if (!env || typeof env !== 'object') return;
      applyingRemoteEnv = true;
      try {
        if (typeof env.season === 'string') clickPill('season-pills', 'data-season', env.season);
        if (typeof env.weather === 'string') clickPill('weather-pills', 'data-weather', env.weather);
        // Intensity/splashes sliders are stored ×100 in the DOM (value/100 -> setter).
        if (Number.isFinite(Number(env.weatherIntensity))) {
          setRange('weather-intensity', Math.round(Number(env.weatherIntensity) * 100), true);
        }
        if (Number.isFinite(Number(env.weatherSplashes))) {
          setRange('weather-splashes', Math.round(Number(env.weatherSplashes) * 100), true);
        }
        if (Number.isFinite(Number(env.timeOfDay))) {
          setRange('time-range', Math.max(0, Math.min(1439, Math.round(Number(env.timeOfDay)))), true);
        }
        // Shield: drive the public API so the toolbar state + visuals follow.
        try {
          if (window.VoxelShield) {
            if (env.shield) { if (typeof window.VoxelShield.open === 'function') window.VoxelShield.open(); }
            else if (shieldIsOn() && typeof window.VoxelShield.close === 'function') window.VoxelShield.close();
          }
        } catch (_) {}
        // Sync the env dedupe key so the very next live-capture of our own
        // (now host-matched) state is not mistaken for a fresh local change.
        lastEnvKey = envKey(captureEnvState());
      } finally {
        applyingRemoteEnv = false;
      }
    }

    // ---- live environment broadcast (host only) ----
    function broadcastEnv() {
      if (!isHost || applyingRemoteEnv) return;
      const env = captureEnvState();
      const key = envKey(env);
      if (key === lastEnvKey) return;
      lastEnvKey = key;
      sendMessage({ type: 'env', env });
    }

    function scheduleEnvBroadcast() {
      // Host-only; debounced so a slider drag sends ~one trailing update.
      if (!isHost || applyingRemoteEnv) return;
      if (envBroadcastTimer) return;
      envBroadcastTimer = setTimeout(() => {
        envBroadcastTimer = null;
        broadcastEnv();
      }, 120);
    }

    // ---- live mooring broadcast (host only) ----
    function broadcastMoorings() {
      if (!isHost) return;
      if (typeof serializeMooringCables !== 'function') return;
      let list = [];
      try { list = serializeMooringCables() || []; } catch (_) { list = []; }
      sendMessage({ type: 'moorings', moorings: list });
    }

    function applyRemoteMoorings(list) {
      if (!admitted || !Array.isArray(list)) return;
      if (typeof replaceMooringCables !== 'function') return;
      // replaceMooringCables does NOT dispatch tinyworld:moorings-changed, so
      // applying a remote list cannot loop back into broadcastMoorings.
      applyingRemote = true;
      const prevSuppress = (typeof suppressSave !== 'undefined') ? suppressSave : false;
      try {
        if (typeof suppressSave !== 'undefined') suppressSave = true;
        replaceMooringCables(list);
      } catch (err) {
        console.warn('[multiplayer] remote moorings failed:', err);
      } finally {
        if (typeof suppressSave !== 'undefined') suppressSave = prevSuppress;
        applyingRemote = false;
      }
    }

    // ============================================================
    // Live flight ghosts: render a lightweight plane proxy for any peer who is
    // flying, at the transform they broadcast. No suppressSave/applyingRemote
    // wrapper here on purpose — rendering a ghost calls no setCell and dispatches
    // no event the broadcast wiring listens to, so there is no feedback loop
    // (that guard is only for the snapshot/env/moorings world-mutation paths).
    // ------------------------------------------------------------

    // Build the proxy ONCE per ghost. Reuse a flyable plane model-stamp if one
    // exists in the (post-snapshot) world so the ghost matches the real plane;
    // otherwise fall back to a cheap placeholder. The proxy lives under peerRoot
    // (a child of xrWorldRoot), the SAME content-local frame the broadcaster
    // captured the transform in (flightJet sits in scene space; in the flat view
    // xrWorldRoot is identity), so the transforms line up without conversion.
    function findFlyableStampId() {
      try {
        if (typeof world === 'undefined' || typeof isFlyableStampCell !== 'function') return '';
        for (const x in world) {
          const col = world[x];
          if (!col) continue;
          for (const z in col) {
            const cell = col[z];
            if (isFlyableStampCell(cell)) {
              const id = cell.appearance && cell.appearance.modelStampId;
              if (id) return id;
            }
          }
        }
      } catch (_) {}
      return '';
    }

    function buildFlightGhostModel() {
      // Prefer the real plane model; placeholder if makeModelStamp is unavailable.
      if (typeof makeModelStamp === 'function') {
        try {
          const stampId = findFlyableStampId();
          const model = stampId ? makeModelStamp(stampId) : null;
          if (model) return model;
        } catch (_) {}
      }
      // Minimal placeholder: a small translucent cone so a peer plane is visible
      // even before any model-stamp asset is loaded. No emoji, no PNG.
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.9, 12),
        new THREE.MeshBasicMaterial({ color: 0x9bb8e8, transparent: true, opacity: 0.85 })
      );
      body.rotation.x = -Math.PI / 2;
      g.add(body);
      return g;
    }

    function removeFlightGhost(id) {
      const ghost = flightGhosts.get(id);
      if (!ghost) return;
      peerRoot.remove(ghost.group);
      disposeObject3d(ghost.group);
      flightGhosts.delete(id);
    }

    function clearFlightGhosts() {
      flightGhosts.forEach((_, id) => removeFlightGhost(id));
    }

    function applyRemoteEntity(msg) {
      if (!msg || msg.kind !== 'plane') return;
      const id = String(msg.id || '');
      if (!id) return;
      // Never render our own ghost (the flyer sees the real plane). Defensive:
      // the server already excludes the sender from the broadcast.
      if (id === (serverClientId || localClientId)) return;
      if (msg.active === false) {
        removeFlightGhost(id);
        return;
      }
      let ghost = flightGhosts.get(id);
      if (!ghost) {
        const group = new THREE.Group();
        group.name = 'multiplayer-plane-' + id;
        const model = buildFlightGhostModel();
        group.add(model);
        peerRoot.add(group);
        ghost = { group };
        flightGhosts.set(id, ghost);
      }
      const p = msg.p || {};
      const r = msg.r || {};
      const px = Number(p.x), py = Number(p.y), pz = Number(p.z);
      if (Number.isFinite(px) && Number.isFinite(py) && Number.isFinite(pz)) {
        ghost.group.position.set(px, py, pz);
      }
      ghost.group.rotation.set(
        Number.isFinite(Number(r.x)) ? Number(r.x) : 0,
        Number.isFinite(Number(r.y)) ? Number(r.y) : 0,
        Number.isFinite(Number(r.z)) ? Number(r.z) : 0,
        'XYZ'
      );
      ghost.group.visible = true;
    }

    // ---- live flight broadcast (called from file-34's tickFlight/exitFlight) ----
    // Reads the real plane transform off the globals file-34 already exposes
    // (__flightJet / __flightActive). active:false is sent immediately (bypasses
    // the throttle) so peers drop the ghost the moment flight ends. active:true
    // self-throttles to ~15/s. No-ops gracefully if the socket is not open.
    const _flBroadcastPos = new THREE.Vector3();
    const _flBroadcastQuat = new THREE.Quaternion();
    const _flBroadcastEuler = new THREE.Euler();
    function broadcastFlight(active) {
      if (!admitted) return;
      if (active === false) {
        sendMessage({ type: 'entity', kind: 'plane', active: false,
          p: { x: 0, y: 0, z: 0 }, r: { x: 0, y: 0, z: 0 } });
        return;
      }
      const jet = window.__flightJet;
      if (!jet) return;
      const now = Date.now();
      if (now - lastFlightSent < 66) return;   // ~15/s
      lastFlightSent = now;
      // Capture in WORLD space, then convert into peerRoot's local frame so the
      // ghost lands in the same content-local frame peers render in (matches the
      // peer-cursor precedent). In the flat view xrWorldRoot is identity, so this
      // is a no-op; under an XR world transform it keeps the ghost aligned.
      // Both position and rotation are treated as peerRoot-local; in the flat
      // view peerRoot is identity so world == local and the ghost lands exactly
      // on the real plane. (The captured quaternion already includes the model
      // forward-fix, so a same-model ghost orients identically.)
      jet.getWorldPosition(_flBroadcastPos);
      peerRoot.worldToLocal(_flBroadcastPos);
      jet.getWorldQuaternion(_flBroadcastQuat);
      _flBroadcastEuler.setFromQuaternion(_flBroadcastQuat, 'XYZ');
      sendMessage({
        type: 'entity',
        kind: 'plane',
        active: true,
        p: { x: _flBroadcastPos.x, y: _flBroadcastPos.y, z: _flBroadcastPos.z },
        r: { x: _flBroadcastEuler.x, y: _flBroadcastEuler.y, z: _flBroadcastEuler.z },
      });
    }

    // ---- snapshot: host serializes + chunks the full world + env ----
    function sendSnapshotTo(forId) {
      if (!isHost || !forId) return;
      // Defer off the WebSocket message tick: serializing a dense world takes
      // tens of ms, and doing it inline stalled the frame in progress every
      // time a peer joined. The serialize itself still runs on the main
      // thread, but the current frame completes first.
      setTimeout(() => sendSnapshotNow(forId), 0);
    }

    function sendSnapshotNow(forId) {
      if (!isHost || !forId) return;
      if (typeof window.buildWorldStateObject !== 'function') return;
      let payload;
      try {
        const world = window.buildWorldStateObject();
        payload = JSON.stringify({ world, env: captureEnvState() });
      } catch (err) {
        console.warn('[multiplayer] snapshot build failed:', err);
        return;
      }
      const total = Math.max(1, Math.ceil(payload.length / SNAPSHOT_CHUNK));
      for (let seq = 0; seq < total; seq++) {
        sendMessage({
          type: 'snapshot',
          forId,
          seq,
          total,
          chunk: payload.slice(seq * SNAPSHOT_CHUNK, (seq + 1) * SNAPSHOT_CHUNK),
        });
      }
    }

    // ---- snapshot: peer reassembles chunks, parses, applies ----
    function handleSnapshotChunk(msg) {
      const total = Math.max(1, Math.round(Number(msg.total) || 0));
      if (total > 2000) return;   // bound the host-supplied chunk count (anti-OOM)
      const seq = Math.round(Number(msg.seq) || 0);
      if (!Number.isFinite(seq) || seq < 0 || seq >= total) return;
      // A fresh snapshot (seq 0 or a different total) resets the buffer so a
      // re-sync after reconnect cannot mix chunks from two snapshots.
      if (!snapshotBuf || snapshotBuf.total !== total || seq === 0) {
        snapshotBuf = { total, parts: new Array(total), got: 0 };
      }
      if (typeof snapshotBuf.parts[seq] === 'undefined' || snapshotBuf.parts[seq] === null) {
        snapshotBuf.parts[seq] = typeof msg.chunk === 'string' ? msg.chunk : '';
        snapshotBuf.got++;
      }
      if (snapshotBuf.got < snapshotBuf.total) return;
      const joined = snapshotBuf.parts.join('');
      snapshotBuf = null;
      let payload = null;
      try { payload = JSON.parse(joined); } catch (_) { return; }
      if (!payload || typeof payload !== 'object') return;
      applySnapshot(payload);
    }

    function applySnapshot(payload) {
      // Apply the host's world + environment WITHOUT echoing back. The world is
      // the subtle part: applyState's non-windowed path is ASYNC (rAF-chunked)
      // and brackets suppressSave from its start until finishApplyState. A
      // synchronous try/finally here would clear suppressSave BEFORE the paint
      // runs, so every painted cell would re-broadcast (the exact flood
      // sendCellSnapshot's suppressSave gate exists to stop). So we let
      // applyState own suppressSave on success and clear applyingRemote +
      // apply env in its onDone (fires at the END of both the sync and async
      // paths). Only on an early reject (applyState returns false, never
      // entering its suppressSave bracket) do we restore synchronously.
      if (snapshotApplying) return;   // a previous snapshot is still painting; one is enough
      const applyEnv = () => { if (payload && payload.env) applyEnvState(payload.env); };
      if (!payload.world || typeof applyState !== 'function') {
        applyEnv();
        return;
      }
      applyingRemote = true;
      snapshotApplying = true;
      if (typeof suppressSave !== 'undefined') suppressSave = true;
      let ok = false;
      try {
        // keepCamera: a joiner keeps their own viewpoint, just adopts the host's
        // world content (cells + islands + moorings + landscape). onDone runs
        // after the (possibly async) paint completes — there we drop the remote
        // guard (suppressSave is reset to false by applyState itself) and apply
        // the environment so it lands on top of the freshly painted world.
        ok = applyState(payload.world, {
          keepCamera: true,
          onDone: () => { applyingRemote = false; snapshotApplying = false; applyEnv(); },
        });
      } catch (err) {
        console.warn('[multiplayer] snapshot world apply failed:', err);
      }
      // Early reject (false) or a throw never reached applyState's suppressSave
      // bracket / onDone, so undo our guard here to avoid wedging future saves.
      if (!ok) {
        if (typeof suppressSave !== 'undefined') suppressSave = false;
        applyingRemote = false;
        snapshotApplying = false;
        applyEnv();
      }
    }

    function handleMessage(event) {
      let data = null;
      try { data = JSON.parse(String(event.data || '')); } catch (_) { return; }
      if (!data || !data.type) return;
      if (data.type === 'welcome') {
        serverClientId = data.id || serverClientId;
        // SAFETY INVARIANT: default to admitted. Only an explicit admitted:false
        // puts us in the lobby-wait state. An un-upgraded server omits these
        // fields => admitted stays true, myRole stays null => behaves as today.
        admitted = (data.admitted !== false);
        if (typeof data.role === 'string') { myRole = data.role; isHost = data.role === 'host'; }
        showLobbyOverlay(!admitted);
        (Array.isArray(data.peers) ? data.peers : []).forEach(updatePeerPresence);
        // Lobby clients still publish presence so the host learns their name.
        publishPresence(true);
        if (admitted) renderRoster();
        renderAdmitPanel();
        // welcome sets role inline (seat re-admit path bypasses applySelfState),
        // so refresh guest-menu hide + chat launcher here too.
        updateGuestMenuVisibility();
        updateChatAvailability();
      } else if (data.type === 'lobby.join') {
        if (!data.id) return;
        const name = String(data.name || '');
        const isNew = !toastedLobby.has(data.id);
        pendingLobby.set(data.id, { id: data.id, name });
        if (isNew && name) {
          toastedLobby.add(data.id);
          showToast(name + ' has entered the lobby');
        }
        renderAdmitPanel();
      } else if (data.type === 'lobby.leave') {
        if (!data.id) return;
        pendingLobby.delete(data.id);
        toastedLobby.delete(data.id);
        renderAdmitPanel();
      } else if (data.type === 'lobby.list') {
        ingestPending(data.pending);
      } else if (data.type === 'admitted') {
        applySelfState(data.role, data.island || null, true);
        (Array.isArray(data.peers) ? data.peers : []).forEach(updatePeerPresence);
      } else if (data.type === 'declined') {
        declined = true;
        admitted = false;
        showLobbyNotice('The host declined your request to join.');
      } else if (data.type === 'kicked') {
        declined = true;
        admitted = false;
        showLobbyNotice('You have been removed from the shared build.');
      } else if (data.type === 'role') {
        // An admitted peer's role changed, or we were promoted to host. There
        // is no id field by protocol => this is always about US.
        const wasAdmitted = admitted;
        applySelfState(data.role, data.island || null, data.admitted !== false);
        if (data.role === 'host' && Array.isArray(data.pending)) ingestPending(data.pending);
        if (!wasAdmitted && admitted) showToast('You are now ' + (roleLabel(myRole) || 'admitted'));
      } else if (data.type === 'presence') {
        updatePeerPresence(data.presence);
      } else if (data.type === 'leave') {
        removePeer(data.id);
        roleById.delete(data.id);
        // A departing/kicked peer's flight ghost must vanish too (entity has no
        // active:false on an abrupt disconnect).
        removeFlightGhost(data.id);
      } else if (data.type === 'entity') {
        // Live entity transform (flying peer's plane). Applies for EVERYONE
        // except our own id — the host must see a guest's ghost and vice versa.
        applyRemoteEntity(data);
      } else if (data.type === 'cell.set') {
        applyRemoteCell(data.op);
      } else if (data.type === 'snapshot.request') {
        // We are the host: a peer was just admitted and needs our world+env.
        // No-op for non-hosts (the server only sends this to the host).
        if (isHost && data.forId) sendSnapshotTo(String(data.forId));
      } else if (data.type === 'snapshot') {
        // We are a freshly-admitted peer receiving the host's world in chunks.
        handleSnapshotChunk(data);
      } else if (data.type === 'env') {
        // Host broadcast an environment change; apply it locally (echo-guarded).
        if (!isHost) applyEnvState(data.env);
      } else if (data.type === 'moorings') {
        // Host broadcast the full mooring-cable list; replace ours to match.
        if (!isHost) applyRemoteMoorings(data.moorings);
      } else if (data.type === 'chat') {
        // Multi-user chat. NOT host-gated — host and every admitted guest
        // receive. The server echoes our own message back too (it stamps id),
        // so this single path renders everyone's lines, ours included.
        handleRemoteChat(data);
      } else if (data.type === 'chat.typing') {
        // A peer's typing indicator (never our own — server excludes the sender).
        handleRemoteTyping(data);
      } else if (data.type === 'combat.hit') {
        // Targeted PvP damage. The server already routes only to us, but guard
        // on our own id for defense-in-depth. The victim owns its own health.
        if (data.to === (serverClientId || localClientId) &&
            window.__flightCombat && typeof window.__flightCombat.onIncomingHit === 'function') {
          window.__flightCombat.onIncomingHit(data);
        }
      }
    }

    function connect() {
      if (declined) return;
      clearTimeout(reconnectTimer);
      setStatus('connecting', 'Shared room: connecting');
      try {
        socket = new WebSocket(multiplayerSocketUrl());
      } catch (err) {
        setStatus('offline', 'Shared room: offline');
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(8000, reconnectDelay * 1.5);
        return;
      }
      socket.addEventListener('open', () => {
        reconnectDelay = 800;
        connectAttempts = 0;
        everConnected = true;
        connected = true;
        setStatus('online', 'Shared room: ' + roomId);
        publishPresence(true);
        renderRoster();
        updateChatAvailability();
      });
      socket.addEventListener('message', handleMessage);
      socket.addEventListener('close', () => {
        connected = false;
        peers.forEach((_, id) => removePeer(id));
        // Drop every flight ghost on disconnect; they re-arrive live on reconnect.
        clearFlightGhosts();
        // Hide the chat launcher + clear any lingering typing indicators while
        // disconnected; they refresh on reconnect / re-admit.
        updateChatAvailability();
        typingPeers.forEach((entry) => { if (entry && entry.timer) clearTimeout(entry.timer); });
        typingPeers.clear();
        renderTyping();
        // Declined or kicked: terminal. Do not reconnect; leave the notice up.
        if (declined) {
          setStatus('offline', 'Shared room: closed');
          return;
        }
        connectAttempts++;
        // Never opened a single connection after several tries => the host is
        // almost certainly misconfigured or down, not a transient blip. Say so
        // plainly instead of an endless, misleading "reconnecting". Keep retrying
        // (capped) so it still self-heals if the server comes back.
        const unreachable = !everConnected && connectAttempts >= 4;
        setStatus('offline', unreachable ? 'Shared building unavailable' : 'Shared room: reconnecting');
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(8000, reconnectDelay * 1.5);
      });
      socket.addEventListener('error', () => {
        setStatus('offline', 'Shared room: offline');
      });
    }

    window.addEventListener('tinyworld:world-changed', e => {
      const d = e && e.detail;
      if (!d || !Number.isFinite(Number(d.x)) || !Number.isFinite(Number(d.z))) return;
      sendCellSnapshot(d.x, d.z, d.cell);
    });
    window.addEventListener('tinyworld:selection-changed', () => schedulePresence(true));
    renderer.domElement.addEventListener('pointermove', () => {
      const c = localCursor();
      const key = c ? c.x + ',' + c.z : '';
      if (key !== lastHoverKey) {
        lastHoverKey = key;
        schedulePresence(false);
      }
    }, { passive: true });
    renderer.domElement.addEventListener('pointerleave', () => schedulePresence(true), { passive: true });
    // Non-forced: the lastPresenceKey dedupe suppresses sends while idle, so
    // a quiet room no longer fans out presence to every peer each 2.5s.
    setInterval(() => schedulePresence(false), 2500);
    // Slow forced keepalive so idle proxies don't reap the WebSocket and the
    // room still hears from quiet-but-alive peers.
    setInterval(() => schedulePresence(true), 25000);

    // -------- live environment + mooring broadcast wiring (host only) --------
    // The host watches its own env controls and re-broadcasts on change. Each
    // handler is gated (isHost + !applyingRemoteEnv) inside scheduleEnvBroadcast
    // / broadcastEnv, so a peer applying a remote env never re-emits. Listeners
    // attach unconditionally (cheap) and self-gate, so role changes are handled.
    (function wireEnvBroadcast() {
      const timeRange = document.getElementById('time-range');
      const intensity = document.getElementById('weather-intensity');
      const splashes = document.getElementById('weather-splashes');
      const seasonPills = document.getElementById('season-pills');
      const weatherPills = document.getElementById('weather-pills');
      if (timeRange) timeRange.addEventListener('input', scheduleEnvBroadcast);
      if (intensity) intensity.addEventListener('input', scheduleEnvBroadcast);
      if (splashes) splashes.addEventListener('input', scheduleEnvBroadcast);
      // Pills update season/weather synchronously on click; broadcast after the
      // module-30 handler has run (it shares the same click event).
      if (seasonPills) seasonPills.addEventListener('click', scheduleEnvBroadcast);
      if (weatherPills) weatherPills.addEventListener('click', scheduleEnvBroadcast);
      // Shield deploy/retract fires this event (engine/world/40-shield-system.js).
      window.addEventListener('tinyworld:shield-changed', scheduleEnvBroadcast);
    })();

    // Moorings are not cells: the host re-broadcasts the full serialized list
    // whenever a cable is added or restyled (engine/world/14 dispatches this).
    // applyRemoteMoorings uses replaceMooringCables, which does NOT dispatch
    // this event, so peers applying a remote list cannot loop.
    window.addEventListener('tinyworld:moorings-changed', () => {
      if (isHost) broadcastMoorings();
    });

    window.__tinyworldMultiplayer = {
      roomId,
      connect,
      presence: localPresence,
      peers: () => Array.from(peers.keys()),
      url: multiplayerSocketUrl,
      // Role gates consumed by the input layer (20-input-place-erase.js) so
      // viewer/player local mutations are blocked before they desync the view,
      // and an editor's edits are confined to the granted island bounds.
      canEdit,
      canInteract,
      canEditAny,
      role: () => myRole,
      isHost: () => isHost,
      // Sync-core hooks. broadcastEnv lets the host force an env re-broadcast
      // after a programmatic environment change (no DOM event); sendMessage is
      // the raw channel other live-sync features (flight/chat) broadcast over.
      broadcastEnv,
      // Flight live-sync hook for engine/world/34-flight-sim.js. Called every
      // tick while flying (self-throttled to ~15/s) and once with active:false
      // on exit so peers drop the ghost. Reads __flightJet itself.
      broadcastFlight,
      // Live remote-player flight ghosts for combat targeting (41-flight-combat).
      // Returns lightweight refs; consumers must not mutate the groups.
      flightGhosts: () => {
        const out = [];
        flightGhosts.forEach((ghost, id) => {
          if (ghost && ghost.group && ghost.group.visible) out.push({ id, group: ghost.group });
        });
        return out;
      },
      send: sendMessage,
      // Chat hooks (open/close the panel, post a line) for any caller that wants
      // to drive chat programmatically. No-ops gracefully until admitted.
      openChat,
      closeChat,
      sendChat,
    };

    ensureLocalName();
    connect();
  })();
