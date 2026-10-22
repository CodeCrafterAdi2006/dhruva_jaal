import './hud.css';
import { MapManager }      from './map/MapManager.js';
import { ScenarioEngine }  from './engine/ScenarioEngine.js';
import { NodeLayer }       from './map/NodeLayer.js';
import { LinkPacketLayer } from './map/LinkPacketLayer.js';

// ─── Engine & Map ──────────────────────────────────────────────────────────────
const mapManager = new MapManager('map');
const engine     = new ScenarioEngine();

window.mapManager = mapManager;
window.engine     = engine;

mapManager.init().then(map => {
  console.log('[Dhruva Jaal] Map ready.');

  // Phase 4: markers
  const nodeLayer = new NodeLayer(map);
  nodeLayer.init();

  // Phase 5: links & packets
  const linkPacketLayer = new LinkPacketLayer(map);
  linkPacketLayer.init();

  window.nodeLayer       = nodeLayer;
  window.linkPacketLayer = linkPacketLayer;

  // ─── Compass ────────────────────────────────────────────────────────────────
  const compassDial   = document.getElementById('compass-dial');
  const compassWidget = document.getElementById('compass-widget');
  if (compassDial) {
    const updateCompass = () => {
      compassDial.style.transform = `rotate(${-map.getBearing()}deg)`;
    };
    map.on('rotate', updateCompass);
    updateCompass();
  }
  if (compassWidget) {
    compassWidget.addEventListener('click', () =>
      map.easeTo({ bearing: -15, pitch: 52, duration: 800 })
    );
  }

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
    const pct = Math.max(5, Math.min(100, Math.round(((dbm + 120) / 60) * 100)));
    return pct;
  };
  const rssiToClass = (dbm) => dbm >= -80 ? 'strong' : dbm >= -100 ? 'medium' : 'weak';

  function updateSidebar(state) {
    // ── Message Log
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
        // Keep max 8 rows
        while (logFeed.children.length > 8) logFeed.removeChild(logFeed.lastChild);
      });
    }

    // ── RSSI Node Bars
    if (nodesList && state.nodes) {
      nodesList.innerHTML = '';
      const groundNodes = state.nodes.filter(n =>
        ['dongle','relay','helper'].includes(n.role) &&
        !['DR1','DR2','BL1','BL2'].includes(n.id)
      );
      // also add any deployed aerials
      const aerials = state.nodes.filter(n =>
        (n.role === 'drone' || n.role === 'balloon') && n.visible
      );

      [...groundNodes, ...aerials].forEach(n => {
        const raw  = defaultRssi[n.id] || -78;
        const jitter = (Math.sin(Date.now() * 0.0005 + n.id.charCodeAt(0)) * 1.5);
        const dbm  = n.status === 'online' ? Math.round(raw + jitter) : null;
        const cls  = dbm !== null ? rssiToClass(dbm) : 'offline';
        const w    = dbm !== null ? rssiToWidth(dbm) : 5;
        const label = n.role === 'dongle' ? 'Node 1 (DONGLE)'
                    : n.role === 'helper' ? 'Node 8 (HELPER)'
                    : n.role === 'drone'  ? `${n.id} (DRONE)`
                    : n.role === 'balloon'? `${n.id} (BALLOON)`
                    : `${n.id} (RELAY)`;
        const valStr = dbm !== null ? `${dbm} dBm` : '— OFFLINE';
        nodesList.innerHTML += `
          <div class="node-row ${n.status !== 'online' ? 'node-row-down' : ''}">
            <span class="node-name ${n.role}">${label}</span>
            <div class="meter-track"><div class="meter-fill ${cls}" style="width:${w}%"></div></div>
            <span class="node-val">${valStr}</span>
          </div>`;
      });
    }

    // ── Network Stats
    const onlineCount  = state.nodes?.filter(n => n.status === 'online' && n.visible !== false).length ?? 0;
    const totalCount   = state.nodes?.filter(n => n.visible !== false).length ?? 0;
    const deliveredCnt = state.deliveredSos?.length ?? 0;
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
    updateSidebar(state);
    updateTimeline(state);
  });

  engine.on('state_reset', (state) => {
    updateAlert(state);
    nodeLayer.update(state);
    linkPacketLayer.update(state);
    seenSos.clear();
    if (logFeed) logFeed.innerHTML = '';
    updateSidebar(state);
    updateTimeline(state);
  });

  // ─── With / Without Mesh Toggle ────────────────────────────────────────────
  const btnWith    = document.getElementById('btn-with-mesh');
  const btnWithout = document.getElementById('btn-without-mesh');
  if (btnWith && btnWithout) {
    btnWith.addEventListener('click', () => {
      btnWith.classList.add('active');
      btnWithout.classList.remove('active');
      engine.setWithMesh(true);
    });
    btnWithout.addEventListener('click', () => {
      btnWithout.classList.add('active');
      btnWith.classList.remove('active');
      engine.setWithMesh(false);
    });
  }

  // ─── Sidebar Action Buttons ────────────────────────────────────────────────
  document.getElementById('btn-simulate')?.addEventListener('click', () => engine.killNextNode());
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    engine.restart();
    // After restart, keep paused so user can control
    engine.pause();
    updatePlayBtn();
  });

  // ─── Bottom Timeline Bar ───────────────────────────────────────────────────
  injectTimelineBar();

  const timelineSlider = document.getElementById('tl-slider');
  const timeClock      = document.getElementById('tl-clock');
  const playBtn        = document.getElementById('tl-play');
  const speedBtns      = document.querySelectorAll('.tl-speed-btn');
  let isScrubbing = false;

  function updatePlayBtn() {
    if (playBtn) playBtn.textContent = engine.isPlaying ? '⏸' : '▶';
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

  speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      speedBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      engine.setSpeed(parseFloat(btn.dataset.speed));
    });
  });

  // ─── Keyboard Shortcuts ────────────────────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (engine.isPlaying) engine.pause(); else engine.play();
      updatePlayBtn();
    } else if (e.key === 'k' || e.key === 'K') {
      engine.killNextNode();
    } else if (e.key === 'r' || e.key === 'R') {
      engine.restart(); engine.pause(); updatePlayBtn();
    }
  });

  // ─── Boot ─────────────────────────────────────────────────────────────────
  engine.init();   // seek(0) → emits state_reset
  // Start PAUSED — user or demo-runner presses Play
  updatePlayBtn();

  engine.on('play_state', updatePlayBtn);
});

// ─── Inject the bottom Timeline Bar DOM ────────────────────────────────────────
function injectTimelineBar() {
  if (document.getElementById('timeline-bar')) return;

  const bar = document.createElement('div');
  bar.id = 'timeline-bar';
  bar.innerHTML = `
    <div class="tl-left">
      <button id="tl-play" class="tl-play-btn" title="Play / Pause (Space)">▶</button>
      <span id="tl-clock" class="tl-clock">Fri 27 Sep, 22:00</span>
    </div>
    <div class="tl-center">
      <div class="tl-phase-dots">
        <span class="tl-phase-dot" style="left:0%"    title="P1: Rain begins">P1</span>
        <span class="tl-phase-dot" style="left:6%"    title="P2: Towers DOWN">P2</span>
        <span class="tl-phase-dot" style="left:54%"   title="P3: Drones launch">P3</span>
        <span class="tl-phase-dot" style="left:66%"   title="P4: Balloons rise">P4</span>
        <span class="tl-phase-dot" style="left:78%"   title="P5: Handoff complete">P5</span>
      </div>
      <input type="range" id="tl-slider" class="tl-slider" min="0" max="1000" value="0" step="1">
    </div>
    <div class="tl-right">
      <button class="tl-speed-btn active" data-speed="0.5">0.5×</button>
      <button class="tl-speed-btn active" data-speed="1" style="opacity:1;font-weight:700">1×</button>
      <button class="tl-speed-btn" data-speed="2">2×</button>
    </div>
  `;

  // Mount inside map-viewport so it stays in the 78% column
  const viewport = document.getElementById('map-viewport');
  if (viewport) viewport.appendChild(bar);

  // Set 1× as default active
  bar.querySelectorAll('.tl-speed-btn').forEach(b => b.classList.remove('active'));
  bar.querySelector('[data-speed="1"]').classList.add('active');
}