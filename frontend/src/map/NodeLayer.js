import scenarioData from '../data/scenario.json';

const getMapLibre = () => window.maplibregl;

export class NodeLayer {
  constructor(map) {
    this.map = map;
    this.scenario = scenarioData;
    this.towerMarkers = new Map();
    this.nodeMarkers = new Map();
  }

  init() {
    this.renderCellTowers();
    this.renderGroundNodes();
    this.renderAerialNodes();
  }

  /**
   * Step 4.1: Render Cell Towers T1, T2, T3
   */
  renderCellTowers() {
    const ML = getMapLibre();
    if (!ML || !this.map) return;

    this.scenario.cellTowers.forEach(tower => {
      const el = document.createElement('div');
      el.className = 'cell-tower-marker online';
      el.id = `tower-${tower.id}`;

      el.innerHTML = `
        <div class="tower-beacon">
          <div class="tower-wave wave-1"></div>
          <div class="tower-wave wave-2"></div>
          <div class="tower-icon-box">
            <svg class="tower-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v20M4.93 4.93l4.24 4.24M19.07 4.93l-4.24 4.24M2 12h20M4.93 19.07l4.24-4.24M19.07 19.07l-4.24-4.24"/>
            </svg>
            <div class="tower-down-badge">✕</div>
          </div>
        </div>
        <div class="tower-info">
          <div class="tower-name">${tower.name}</div>
          <div class="tower-status online-text">● 4G/LTE Online</div>
        </div>
      `;

      const marker = new ML.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat([tower.lon, tower.lat])
        .addTo(this.map);

      this.towerMarkers.set(tower.id, { marker, element: el, data: tower });
    });
  }

  /**
   * Step 4.2: Render Ground Mesh Nodes (N1 - N8)
   */
  renderGroundNodes() {
    const ML = getMapLibre();
    if (!ML || !this.map) return;

    const defaultRssi = {
      N1: -68, N2: -72, N3: -78, N4: -87,
      N5: -82, N6: -76, N7: -70, N8: -69
    };

    const groundNodes = this.scenario.nodes.filter(n => !n.hidden);

    groundNodes.forEach(node => {
      const el = document.createElement('div');
      el.className = `mesh-node-marker role-${node.role} online`;
      el.id = `node-marker-${node.id}`;

      let iconHtml = '';
      if (node.role === 'dongle') {
        iconHtml = `<svg class="node-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      } else if (node.role === 'helper') {
        iconHtml = `<svg class="node-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h6M9 14h6M9 18h6"/></svg>`;
      } else {
        iconHtml = `<svg class="node-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4"/></svg>`;
      }

      const rssiVal = defaultRssi[node.id] || -75;
      const displayLabel = node.role === 'dongle' ? 'DONGLE' : (node.role === 'helper' ? 'BASE CAMP' : node.id);
      const displaySub = node.role === 'helper' ? 'Safe ground' : `${rssiVal} dBm`;

      el.title = `${node.id} (${node.label}) · ${node.place}`;

      el.innerHTML = `
        <div class="node-beacon">
          <div class="node-wave wave-1"></div>
          <div class="node-wave wave-2"></div>
          <div class="node-core">
            ${iconHtml}
            <div class="node-down-badge">⚠</div>
          </div>
        </div>
        <div class="node-tag">
          <div class="node-label">${displayLabel}</div>
          <div class="node-sub">${displaySub}</div>
        </div>
      `;

      const marker = new ML.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat([node.lon, node.lat])
        .addTo(this.map);

      this.nodeMarkers.set(node.id, { marker, element: el, data: node });
    });
  }

  /**
   * Step 4.3: Render Aerial Relays (Drones DR1, DR2 & Tethered Balloons BL1, BL2)
   */
  renderAerialNodes() {
    const ML = getMapLibre();
    if (!ML || !this.map) return;

    this.aerialMarkers = new Map();
    const baseCamp = this.scenario.nodes.find(n => n.id === 'N8');
    const baseCampPos = [baseCamp.lon, baseCamp.lat];

    const aerialNodes = this.scenario.nodes.filter(n => n.role === 'drone' || n.role === 'balloon');

    aerialNodes.forEach(node => {
      const el = document.createElement('div');
      el.className = `aerial-marker role-${node.role}`;
      el.id = `aerial-marker-${node.id}`;
      el.style.display = 'none'; // Hidden until launched

      if (node.role === 'drone') {
        el.innerHTML = `
          <div class="drone-marker-inner">
            <div class="drone-rotor rotor-tl"></div>
            <div class="drone-rotor rotor-tr"></div>
            <div class="drone-rotor rotor-bl"></div>
            <div class="drone-rotor rotor-br"></div>
            <svg class="drone-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v20M2 12h20M7 7l10 10M17 7L7 17"/>
              <circle cx="12" cy="12" r="3.5" fill="#ffb020"/>
            </svg>
          </div>
          <div class="drone-shadow"></div>
          <div class="node-tag drone-tag">
            <div class="node-label drone-name">${node.label} · 80m</div>
            <div class="node-sub drone-sub">Agile aerial relay</div>
          </div>
        `;
      } else {
        // Tethered Balloon
        el.innerHTML = `
          <div class="balloon-container">
            <div class="balloon-aerostat">
              <svg class="balloon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M12 2a7 7 0 0 0-7 7c0 4.5 5 10 7 11 2-1 7-6.5 7-11a7 7 0 0 0-7-7z" fill="rgba(0, 229, 255, 0.25)"/>
                <circle cx="12" cy="9" r="2.5" fill="#00e5ff"/>
              </svg>
            </div>
            <div class="balloon-tether"></div>
            <div class="balloon-ground-anchor"></div>
          </div>
          <div class="node-tag balloon-tag">
            <div class="node-label balloon-name">${node.label} · 100m</div>
            <div class="node-sub balloon-sub">Tethered aerostat</div>
          </div>
        `;
      }

      const marker = new ML.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat([node.lon, node.lat])
        .addTo(this.map);

      this.aerialMarkers.set(node.id, {
        marker,
        element: el,
        data: node,
        basePos: baseCampPos,
        targetPos: [node.lon, node.lat]
      });
    });
  }

  /**
   * Synchronize tower and node visual states with ScenarioEngine tick snapshot
   */
  update(state) {
    if (!state) return;

    // 1. Update Cell Towers (Online at t < 6s, Down at t >= 6s)
    const towersOnline = state.towersOnline;
    this.towerMarkers.forEach(({ element }) => {
      if (towersOnline) {
        if (!element.classList.contains('online')) {
          element.classList.remove('offline');
          element.classList.add('online');
          const statusText = element.querySelector('.tower-status');
          if (statusText) {
            statusText.textContent = '● 4G/LTE Online';
            statusText.className = 'tower-status online-text';
          }
        }
      } else {
        if (!element.classList.contains('offline')) {
          element.classList.remove('online');
          element.classList.add('offline');
          const statusText = element.querySelector('.tower-status');
          if (statusText) {
            statusText.textContent = '✕ OFFLINE (Power cut)';
            statusText.className = 'tower-status offline-text';
          }
        }
      }
    });

    // 2. Update Ground Nodes (N1 - N8) & Store-and-Forward on N5
    if (state.nodes) {
      state.nodes.forEach(nodeState => {
        const markerObj = this.nodeMarkers.get(nodeState.id);
        if (!markerObj) return;

        const { element, data } = markerObj;
        const isOnline = nodeState.status === 'online';

        // Check if this node is currently holding an SOS packet in Store-and-Forward
        const isHoldingSos = state.sosStates?.some(
          s => s.from === nodeState.id && s.state === 'STORED'
        );

        const labelEl = element.querySelector('.node-label');
        const subEl = element.querySelector('.node-sub');

        if (isHoldingSos) {
          element.classList.remove('down');
          element.classList.add('online', 'waiting-for-mesh');
          if (labelEl) labelEl.textContent = `${nodeState.id} · STORED`;
          if (subEl) subEl.innerHTML = `<span class="stored-text">Waiting for mesh...</span>`;
        } else if (isOnline) {
          element.classList.remove('down', 'waiting-for-mesh');
          element.classList.add('online');
          if (labelEl) {
            labelEl.textContent = data.role === 'dongle' ? 'DONGLE' : (data.role === 'helper' ? 'BASE CAMP' : data.id);
          }
          if (subEl) {
            const defaultRssi = { N1: -68, N2: -72, N3: -78, N4: -87, N5: -82, N6: -76, N7: -70, N8: -69 };
            const rssi = defaultRssi[data.id] || -75;
            subEl.textContent = data.role === 'helper' ? 'Safe ground' : `${rssi} dBm`;
          }
        } else {
          // Node Down State (N3 at t=22s, N6 at t=40s, or manual kill)
          element.classList.remove('online', 'waiting-for-mesh');
          element.classList.add('down');
          if (labelEl) labelEl.textContent = 'NODE DOWN';
          if (subEl) subEl.innerHTML = `<span class="down-text">⚠ Flooded</span>`;
        }
      });
    }

    // 3. Update Aerial Relays (DR1, DR2 Drones & BL1, BL2 Balloons)
    if (this.aerialMarkers && state.nodes) {
      this.aerialMarkers.forEach((markerObj, id) => {
        const nodeState = state.nodes.find(n => n.id === id);
        if (!nodeState) return;

        const { marker, element, data, basePos, targetPos } = markerObj;
        const isVisible = nodeState.visible && nodeState.flightProgress > 0;

        if (isVisible) {
          element.style.display = 'flex';
          const p = nodeState.flightProgress;

          if (data.role === 'drone') {
            // Smooth geographic arc from Base Camp N8 to target station
            const curLon = basePos[0] + p * (targetPos[0] - basePos[0]);
            const curLat = basePos[1] + p * (targetPos[1] - basePos[1]);
            marker.setLngLat([curLon, curLat]);

            const subEl = element.querySelector('.drone-sub');
            if (nodeState.batteryStatus && nodeState.batteryStatus.includes('LOW')) {
              element.classList.add('battery-low');
              if (subEl) subEl.textContent = '⚠ Low battery · Returning';
            } else {
              element.classList.remove('battery-low');
              if (subEl) subEl.textContent = p < 1 ? 'Deploying to station...' : 'Agile aerial relay';
            }
          } else if (data.role === 'balloon') {
            // Tethered balloon rises vertically over target anchor
            marker.setLngLat(targetPos);
            const aerostatEl = element.querySelector('.balloon-aerostat');
            const tetherEl = element.querySelector('.balloon-tether');
            const liftPx = Math.round(p * 46); // 0 to 46px lift
            if (aerostatEl) aerostatEl.style.transform = `translateY(-${liftPx}px)`;
            if (tetherEl) tetherEl.style.height = `${liftPx}px`;

            const subEl = element.querySelector('.balloon-sub');
            if (subEl) subEl.textContent = p < 1 ? `Ascending (${Math.round(p * 100)}m)...` : '100m tethered aerostat';
          }
        } else {
          element.style.display = 'none';
        }
      });
    }
  }
}


