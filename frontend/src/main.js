import './hud.css';
import { MapManager }      from './map/MapManager.js';
import { ScenarioEngine }  from './engine/ScenarioEngine.js';
import { NodeLayer }       from './map/NodeLayer.js';
import { LinkPacketLayer } from './map/LinkPacketLayer.js';
import { BaseCampInbox }   from './ui/Inbox.js';
import { ModalsManager }   from './ui/Modals.js';

// ─── Engine & Map ──────────────────────────────────────────────────────────────
const mapManager = new MapManager('map');
const engine     = new ScenarioEngine();

window.mapManager = mapManager;
window.engine     = engine;

mapManager.init().then(map => {
  console.log('[Dhruva Jaal] Map engine ready.');

  // Phase 4: Ground, Tower & Aerial Markers
  const nodeLayer = new NodeLayer(map);
  nodeLayer.init();

  // Phase 5: Dynamic 60fps Links & SOS Pulses
  const linkPacketLayer = new LinkPacketLayer(map);
  linkPacketLayer.init();

  // Phase 6: Base Camp Inbox (HQ Message Dispatch)
  const inbox = new BaseCampInbox(map, nodeLayer);
  inbox.init();

  // Phase 7: Context & Response Plan Modal + Mission Summary Overlay + Honesty Footer
  const modals = new ModalsManager(engine, map);
  modals.init();

  window.nodeLayer       = nodeLayer;
  window.linkPacketLayer = linkPacketLayer;
  window.inbox           = inbox;
  window.modals          = modals;

  // Compass widget removed to prevent control blocking and UI clutter

  // ─── Alert Banner ──────────────────────────────────────────────────────────
  const alertBanner = document.getElementById('network-alert-banner');
  const updateAlert = (state) => {
    if (alertBanner) alertBanner.classList.toggle('visible', !state.towersOnline);
  };

  // ─── Right Sidebar: live updates ───────────────────────────────────────────
  const logFeed   = document.getElementById('log-feed');
  const nodesList = document.getElementById('nodes-list');
  const seenSos   = new Set();

  const defaultRssi = {
    N1: -68, N2: -72, N3: -78, N4: -87,
    N5: -82, N6: -76, N7: -70, N8: -69
  };

  const rssiToWidth = (dbm) => {
    return Math.max(5, Math.min(100, Math.round(((dbm + 120) / 60) * 100)));
  };
  const rssiToClass = (dbm) => dbm >= -80 ? 'strong' : dbm >= -100 ? 'medium' : 'weak';

  function updateSidebar(state) {
    // ── 1. Message Log
    if (logFeed && state.sosStates) {
      state.sosStates.forEach(sos => {
        const key = `${sos.id}-${sos.state}`;
        if (seenSos.has(key)) return;
        if (sos.state === 'QUEUED') return; // silent — don't clutter
        seenSos.add(key);

        const stateLabels = {
          STORED:       { cls: 'state-stored',    text: 'STORED' },
          TRANSMITTING: { cls: 'state-transit',   text: 'TRANSMIT' },
          SENT_TO_MESH: { cls: 'state-transit',   text: 'SENT_TO_MESH' },
          DELIVERED:    { cls: 'state-delivered', text: 'DELIVERED' },
          FAILED:       { cls: 'state-failed',    text: 'FAILED' }
        };
        const lbl = stateLabels[sos.state] || { cls: '', text: sos.state };

        const item = document.createElement('div');
        item.className = 'log-item' + (sos.state === 'DELIVERED' ? ' log-item-delivered' : '');
        item.innerHTML = `
          <div class="log-meta">
            <span class="log-time">${sos.simClock || state.simClock || '--'}</span>
            <span class="log-tag ${lbl.cls}">${lbl.text}</span>
          </div>
          <div class="log-detail">${sos.id} · From ${sos.from} → ${sos.path?.[sos.path.length-1] || 'N8'}</div>
        `;
        logFeed.prepend(item);
        while (logFeed.children.length > 8) logFeed.removeChild(logFeed.lastChild);
      });
    }

    // ── 2. RSSI Node Bars
    if (nodesList && state.nodes) {
      nodesList.innerHTML = '';
      const groundNodes = state.nodes.filter(n =>
        ['dongle','relay','helper'].includes(n.role) &&
        !['DR1','DR2','BL1','BL2'].includes(n.id)
      );
      const aerials = state.nodes.filter(n =>
        (n.role === 'drone' || n.role === 'balloon') && n.visible
      );

      [...groundNodes, ...aerials].forEach(n => {
        const raw  = defaultRssi[n.id] || -78;
        const jitter = (Math.sin(Date.now() * 0.0005 + n.id.charCodeAt(0)) * 1.5);
        const dbm  = n.status === 'online' ? Math.round(raw + jitter) : null;
        const cls  = dbm !== null ? rssiToClass(dbm) : 'offline';
        const w    = dbm !== null ? rssiToWidth(dbm) : 5;
        let rolePrefix = 'relay';
        let roleName = 'Relay';
        let detail = n.sublabel || n.place?.split(' ')?.[0] || 'Community';
        if (n.role === 'dongle' || n.isDynamic) {
          rolePrefix = 'survivor';
          roleName = 'Survivor';
          detail = n.sublabel || 'Stranded';
        } else if (n.role === 'helper') {
          rolePrefix = 'base';
          roleName = 'Base Camp';
          detail = 'Safe Ground HQ';
        } else if (n.role === 'drone') {
          rolePrefix = 'drone';
          roleName = 'Drone';
          detail = '80m Relay';
        } else if (n.role === 'balloon') {
          rolePrefix = 'balloon';
          roleName = 'Balloon';
          detail = '100m Aerostat';
        }
        const labelHtml = `<span class="badge-dot dot-${rolePrefix}"></span><span class="node-id-tag">${n.id}</span> · ${roleName} (${detail})`;
        const titleStr = `${n.id} · ${roleName} (${detail})`;
        const valStr = dbm !== null ? `${dbm} dBm` : '— OFFLINE';
        nodesList.innerHTML += `
          <div class="node-row ${n.status !== 'online' ? 'node-row-down' : ''}">
            <div class="node-row-header">
              <span class="node-name ${n.role}" title="${titleStr}">${labelHtml}</span>
              <span class="node-val">${valStr}</span>
            </div>
            <div class="meter-track"><div class="meter-fill ${cls}" style="width:${w}%"></div></div>
          </div>`;
      });
    }

    // ── 3. Network Stats
    const onlineCount  = state.nodes?.filter(n => n.status === 'online' && n.visible !== false).length ?? 0;
    const totalCount   = state.nodes?.filter(n => n.visible !== false).length ?? 0;
    const lastSos      = state.sosStates?.filter(s => s.state === 'DELIVERED').slice(-1)[0];

    const el = (id) => document.getElementById(id);
    if (el('stat-hops'))  el('stat-hops').textContent  = lastSos?.path ? lastSos.path.length - 1 : '—';
    if (el('stat-rate'))  el('stat-rate').textContent  = totalCount > 0 ? `${Math.round((onlineCount/totalCount)*100)}%` : '—';
    if (el('stat-rssi'))  el('stat-rssi').textContent  = '-77 dBm';
    if (el('stat-nodes')) el('stat-nodes').textContent = `${onlineCount} / ${totalCount}`;
  }

  // ─── Engine Event Routing ──────────────────────────────────────────────────
  engine.on('state_update', (state) => {
    updateAlert(state);
    nodeLayer.update(state);
    linkPacketLayer.update(state);
    mapManager.updateFloodLevel(state.t || 0);
    updateSidebar(state);
    inbox.update(state);
    updateTimeline(state);
  });

  engine.on('state_reset', (state) => {
    updateAlert(state);
    nodeLayer.update(state);
    linkPacketLayer.update(state);
    mapManager.updateFloodLevel(0);
    seenSos.clear();
    if (logFeed) logFeed.innerHTML = '';
    updateSidebar(state);
    inbox.reset();
    updateTimeline(state);
  });

  // Real-time interactive packet transmission (animates live independent of timeline)
  engine.on('live_packet_launch', (packetConfig) => {
    linkPacketLayer.launchLivePacket(packetConfig);
  });

  engine.on('survivor_ack', (evt) => {
    if (logFeed) {
      const item = document.createElement('div');
      item.className = 'log-item log-item-delivered';
      item.innerHTML = `
        <div class="log-meta">
          <span class="log-time">TWO-WAY ACK</span>
          <span class="log-tag state-delivered" style="background:#10b981;color:#0b1220;font-weight:900">CONFIRMED</span>
        </div>
        <div class="log-detail" style="color:#10b981;font-weight:700">[ACK] ${evt.nodeId} received Base Camp Rescue ACK! Boat en route.</div>
      `;
      logFeed.prepend(item);
      while (logFeed.children.length > 8) logFeed.removeChild(logFeed.lastChild);
    }
  });

  engine.on('sos_stored', (evt) => {
    if (logFeed) {
      const item = document.createElement('div');
      item.className = 'log-item';
      item.innerHTML = `
        <div class="log-meta">
          <span class="log-time">STORE & FWD</span>
          <span class="log-tag state-stored">FLASH HOLD</span>
        </div>
        <div class="log-detail" style="color:#f5b942">[HOLD] Survivor ${evt.survivor.id} isolated · Held in flash (retrying every 16s)</div>
      `;
      logFeed.prepend(item);
      while (logFeed.children.length > 8) logFeed.removeChild(logFeed.lastChild);
    }
  });

  engine.on('node_status', (evt) => {
    if (logFeed && evt.status === 'down') {
      const item = document.createElement('div');
      item.className = 'log-item log-item-down';
      item.innerHTML = `
        <div class="log-meta">
          <span class="log-time">${evt.simClock || 'ALERT'}</span>
          <span class="log-tag state-failed">DOWN</span>
        </div>
        <div class="log-detail" style="color:#ff6b6b">[ALERT] Node ${evt.id} DOWN · ${evt.reason || 'Flooded'}</div>
      `;
      logFeed.prepend(item);
      while (logFeed.children.length > 8) logFeed.removeChild(logFeed.lastChild);
    }
  });

  engine.on('aerial', (evt) => {
    if (!logFeed) return;
    if (evt.type === 'drones_launch') {
      const item = document.createElement('div');
      item.className = 'log-item';
      item.innerHTML = `
        <div class="log-meta">
          <span class="log-time">${evt.simClock || 'DISPATCH'}</span>
          <span class="log-tag" style="background:#00f0ff22;color:#00f0ff;border:1px solid #00f0ff">SCRAMBLE</span>
        </div>
        <div class="log-detail" style="color:#00f0ff">[DISPATCH] Base Camp scrambled ${evt.ids.join(', ')} to flooded sector</div>
      `;
      logFeed.prepend(item);
      while (logFeed.children.length > 8) logFeed.removeChild(logFeed.lastChild);
    } else if (evt.type === 'drones_online') {
      const item = document.createElement('div');
      item.className = 'log-item';
      item.innerHTML = `
        <div class="log-meta">
          <span class="log-time">${evt.simClock || 'ACTIVE'}</span>
          <span class="log-tag" style="background:#00f0ff22;color:#00f0ff;border:1px solid #00f0ff">AERIAL LOCK</span>
        </div>
        <div class="log-detail" style="color:#00f0ff">[ACTIVE] ${evt.ids.join(', ')} hovering at 80m · Grid relay active!</div>
      `;
      logFeed.prepend(item);
      while (logFeed.children.length > 8) logFeed.removeChild(logFeed.lastChild);
    }
  });

  // ─── With / Without Mesh Toggle ────────────────────────────────────────────
  const btnWith    = document.getElementById('btn-with-mesh');
  const btnWithout = document.getElementById('btn-without-mesh');

  function setMeshMode(withMesh) {
    if (btnWith && btnWithout) {
      btnWith.classList.toggle('active', withMesh);
      btnWithout.classList.toggle('active', !withMesh);
    }
    engine.setWithMesh(withMesh);
  }

  if (btnWith && btnWithout) {
    btnWith.addEventListener('click', () => setMeshMode(true));
    btnWithout.addEventListener('click', () => setMeshMode(false));
  }

  // ─── Mode Switcher: Scripted Incident Replay vs Tactical Sandbox ──────────
  let activeMode = 'replay'; // 'replay' | 'sandbox'
  const btnReplay   = document.getElementById('btn-mode-replay');
  const btnSandbox  = document.getElementById('btn-mode-sandbox');
  const sourceBadge = document.getElementById('source-badge');

  function setMode(mode) {
    activeMode = mode;
    const timelineBar = document.getElementById('timeline-bar');
    const sandboxBar  = document.getElementById('sandbox-bar');

    if (mode === 'replay') {
      if (btnReplay)  btnReplay.classList.add('active');
      if (btnSandbox) btnSandbox.classList.remove('active');
      if (timelineBar) timelineBar.classList.remove('hidden');
      if (sandboxBar)  sandboxBar.classList.add('hidden');
      if (sourceBadge) sourceBadge.textContent = 'Scenario';
      setSpawnMode(false);
    } else {
      if (btnReplay)  btnReplay.classList.remove('active');
      if (btnSandbox) btnSandbox.classList.add('active');
      if (timelineBar) timelineBar.classList.add('hidden');
      if (sandboxBar)  sandboxBar.classList.remove('hidden');
      if (sourceBadge) sourceBadge.textContent = 'Sandbox';
      // In sandbox mode, pause scripted playback so timeline doesn't advance unattended
      if (engine.isPlaying) {
        engine.pause();
      }
      updatePlayBtn();
    }
  }

  if (btnReplay)  btnReplay.addEventListener('click', () => setMode('replay'));
  if (btnSandbox) btnSandbox.addEventListener('click', () => setMode('sandbox'));

  // ─── Sidebar Action Buttons ────────────────────────────────────────────────
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    engine.restart();
    engine.clearDynamicNodes();
    engine.pause();
    updatePlayBtn();
  });

  // ─── Click-to-Spawn Dynamic Survivor Node ──────────────────────────────────
  let isSpawnMode = false;
  const btnSpawn = document.getElementById('btn-spawn-node');
  const mapElement = document.getElementById('map');

  function setSpawnMode(active) {
    isSpawnMode = active;
    const sbDropBtn = document.getElementById('sb-drop-node');

    if (btnSpawn) {
      btnSpawn.classList.toggle('active', isSpawnMode);
      if (isSpawnMode) {
        btnSpawn.innerHTML = 'Cancel Drop';
        btnSpawn.style.background = 'rgba(255, 59, 59, 0.2)';
        btnSpawn.style.borderColor = '#ff3b3b';
        btnSpawn.style.color = '#ff3b3b';
      } else {
        btnSpawn.innerHTML = 'Drop Survivor Node';
        btnSpawn.style.background = 'rgba(0, 240, 255, 0.12)';
        btnSpawn.style.borderColor = '#00f0ff';
        btnSpawn.style.color = '#00f0ff';
      }
    }

    if (sbDropBtn) {
      sbDropBtn.classList.toggle('active', isSpawnMode);
      sbDropBtn.innerHTML = isSpawnMode ? 'Cancel Drop' : 'Drop Survivor';
    }

    if (mapElement) {
      mapElement.style.cursor = isSpawnMode ? 'crosshair' : '';
    }
  }

  if (btnSpawn) {
    btnSpawn.addEventListener('click', () => setSpawnMode(!isSpawnMode));
  }

  // Handle map click for dynamic node drop
  map.on('click', (e) => {
    if (!isSpawnMode) return;
    const { lng, lat } = e.lngLat;
    const node = engine.spawnDynamicNode(lng, lat, { role: 'dongle' });

    setSpawnMode(false);

    // Log tactical drop
    if (logFeed) {
      const item = document.createElement('div');
      item.className = 'log-item';
      item.innerHTML = `
        <div class="log-meta">
          <span class="log-time">MANUAL</span>
          <span class="log-tag" style="background:#00f0ff22;color:#00f0ff;border:1px solid #00f0ff">DEPLOY</span>
        </div>
        <div class="log-detail" style="color:#00f0ff">[DEPLOY] Dropped ${node.label} at (${lat.toFixed(3)}, ${lng.toFixed(3)})</div>
      `;
      logFeed.prepend(item);
    }

    // Immediately open popup on the newly spawned node
    setTimeout(() => {
      nodeLayer.openNodePopup(node.id, [lng, lat]);
    }, 120);
  });

  // ─── Bottom Timeline & Sandbox Bars DOM Injection ─────────────────────────
  injectBottomBars();

  const timelineSlider = document.getElementById('tl-slider');
  const timeClock      = document.getElementById('tl-clock');
  const playBtn        = document.getElementById('tl-play');
  const headerPlayBtn  = document.getElementById('btn-header-play');
  const speedBtns      = document.querySelectorAll('.tl-speed-btn');
  let isScrubbing = false;

  function updatePlayBtn() {
    const isPlaying = engine.isPlaying;
    if (playBtn) playBtn.textContent = isPlaying ? '⏸' : '▶';
    if (headerPlayBtn) {
      headerPlayBtn.classList.toggle('playing', isPlaying);
      const icon = headerPlayBtn.querySelector('.header-play-icon');
      const label = headerPlayBtn.querySelector('.header-play-label');
      if (icon) icon.textContent = isPlaying ? '⏸' : '▶';
      if (label) label.textContent = isPlaying ? 'Pause Simulation' : 'Start Simulation';
    }
  }

  function updateTimeline(state) {
    if (isScrubbing) return;
    const pct = (state.t || 0) / engine.duration;
    if (timelineSlider) timelineSlider.value = Math.round(pct * 1000);
    if (timeClock) timeClock.textContent = state.simClock || `T+${Math.round(state.t || 0)}s`;
  }

  if (timelineSlider) {
    timelineSlider.addEventListener('mousedown', () => { isScrubbing = true; engine.pause(); updatePlayBtn(); });
    timelineSlider.addEventListener('touchstart', () => { isScrubbing = true; engine.pause(); updatePlayBtn(); });
    timelineSlider.addEventListener('input', () => {
      const t = (timelineSlider.value / 1000) * engine.duration;
      engine.seek(t);
    });
    timelineSlider.addEventListener('mouseup',  () => { isScrubbing = false; });
    timelineSlider.addEventListener('touchend', () => { isScrubbing = false; });
  }

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (engine.isPlaying) { engine.pause(); } else { engine.play(); }
      updatePlayBtn();
    });
  }

  if (headerPlayBtn) {
    headerPlayBtn.addEventListener('click', () => {
      if (activeMode === 'sandbox') {
        setMode('replay');
      }
      if (engine.isPlaying) {
        engine.pause();
      } else {
        engine.play();
      }
      updatePlayBtn();
    });
  }

  speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      speedBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      engine.setSpeed(parseFloat(btn.dataset.speed));
    });
  });

  // ─── Tactical Sandbox Bar Tool Actions ────────────────────────────────────
  document.getElementById('sb-drop-node')?.addEventListener('click', () => {
    setSpawnMode(!isSpawnMode);
  });

  document.getElementById('sb-kill-node')?.addEventListener('click', () => {
    engine.killNextNode();
  });

  document.getElementById('sb-drone')?.addEventListener('click', () => {
    engine.deployAerial('drone');
  });

  document.getElementById('sb-balloon')?.addEventListener('click', () => {
    engine.deployAerial('balloon');
  });

  document.getElementById('sb-reset')?.addEventListener('click', () => {
    engine.restart();
    engine.clearDynamicNodes();
    engine.pause();
    updatePlayBtn();
  });

  // ─── Phase Dots Direct Navigation ──────────────────────────────────────────
  const phaseTimes = { P1: 0, P2: 6, P3: 54, P4: 66, P5: 78 };
  document.querySelectorAll('.tl-phase-dot').forEach(dot => {
    dot.style.cursor = 'pointer';
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = dot.textContent.trim();
      if (phaseTimes[p] !== undefined) {
        engine.seek(phaseTimes[p]);
      }
    });
  });

  // ─── Keyboard Shortcuts (Step 7.4) ────────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (activeMode === 'sandbox') setMode('replay');
      if (engine.isPlaying) engine.pause(); else engine.play();
      updatePlayBtn();
    } else if (e.key === 'k' || e.key === 'K') {
      engine.killNextNode();
    } else if (e.key === 'r' || e.key === 'R') {
      engine.restart();
      engine.pause();
      updatePlayBtn();
    } else if (e.key === 'd' || e.key === 'D') {
      // Jump to Drones launch (t=54s)
      if (activeMode === 'sandbox') {
        engine.deployAerial('drone');
      } else {
        engine.seek(54);
        engine.play();
      }
      updatePlayBtn();
    } else if (e.key === 'b' || e.key === 'B') {
      // Jump to Balloons rise (t=66s)
      if (activeMode === 'sandbox') {
        engine.deployAerial('balloon');
      } else {
        engine.seek(66);
        engine.play();
      }
      updatePlayBtn();
    } else if (e.key === 'm' || e.key === 'M') {
      // Toggle With/Without Mesh
      setMeshMode(!engine.withMesh);
    } else if (e.key === 'f' || e.key === 'F') {
      // Toggle Fullscreen
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    } else if (e.key === 'c' || e.key === 'C' || e.key === 'i' || e.key === 'I') {
      // Toggle Context & Response Plan Modal
      if (modals.contextModal && !modals.contextModal.classList.contains('hidden')) {
        modals.hideContextModal();
      } else {
        modals.showContextModal();
      }
    }
  });

  // ─── Boot ─────────────────────────────────────────────────────────────────
  engine.init(); // seek(0) → emits state_reset
  // Start PAUSED — user or demo-runner presses Play
  updatePlayBtn();

  engine.on('play_state', updatePlayBtn);
});

// ─── Inject Bottom Bars: Incident Timeline & Tactical Sandbox ───────────────
function injectBottomBars() {
  const viewport = document.getElementById('map-viewport');
  if (!viewport) return;

  if (!document.getElementById('timeline-bar')) {
    const bar = document.createElement('div');
    bar.id = 'timeline-bar';
    bar.innerHTML = `
      <div class="tl-left">
        <button id="tl-play" class="tl-play-btn" title="Play / Pause (Space)">▶</button>
        <span id="tl-clock" class="tl-clock">Fri 27 Sep, 22:00</span>
      </div>
      <div class="tl-center">
        <div class="tl-phase-dots">
          <span class="tl-phase-dot" style="left:0%"    title="P1: Rain begins (t=0s)">P1</span>
          <span class="tl-phase-dot" style="left:6%"    title="P2: Cell Towers DOWN (t=6s)">P2</span>
          <span class="tl-phase-dot" style="left:54%"   title="P3: Drones launch (t=54s)">P3</span>
          <span class="tl-phase-dot" style="left:66%"   title="P4: Balloons rise (t=66s)">P4</span>
          <span class="tl-phase-dot" style="left:78%"   title="P5: Handoff complete (t=78s)">P5</span>
        </div>
        <input type="range" id="tl-slider" class="tl-slider" min="0" max="1000" value="0" step="1">
      </div>
      <div class="tl-right">
        <button class="tl-speed-btn" data-speed="0.5">0.5×</button>
        <button class="tl-speed-btn active" data-speed="1" style="opacity:1;font-weight:700">1×</button>
        <button class="tl-speed-btn" data-speed="2">2×</button>
      </div>
    `;
    viewport.appendChild(bar);
  }

  if (!document.getElementById('sandbox-bar')) {
    const sb = document.createElement('div');
    sb.id = 'sandbox-bar';
    sb.className = 'hidden';
    sb.innerHTML = `
      <div class="sandbox-left">
        <span class="sandbox-badge">TACTICAL SANDBOX</span>
        <span class="sandbox-hint">Interactive Mode: Drop survivors or submerge relays to test dynamic routing</span>
      </div>
      <div class="sandbox-tools">
        <button class="sb-tool-btn" id="sb-drop-node" title="Click anywhere on the map to drop a survivor node">
          Drop Survivor
        </button>
        <button class="sb-tool-btn" id="sb-kill-node" title="Submerge next relay under rising water">
          Submerge Relay
        </button>
        <button class="sb-tool-btn" id="sb-drone" title="Dispatch aerial drone relay to link isolated nodes">
          Deploy Drone
        </button>
        <button class="sb-tool-btn" id="sb-balloon" title="Deploy high-altitude balloon aerostat relay">
          Deploy Balloon
        </button>
        <button class="sb-tool-btn" id="sb-reset" title="Clear dynamic nodes & reset network">
          Reset Sandbox
        </button>
      </div>
    `;
    viewport.appendChild(sb);
  }
}