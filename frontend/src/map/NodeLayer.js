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

    // Default baseline RSSI map for labels
    const defaultRssi = {
      N1: -68, N2: -72, N3: -78, N4: -87,
      N5: -82, N6: -76, N7: -70, N8: -69
    };

    const groundNodes = this.scenario.nodes.filter(n => !n.hidden);

    groundNodes.forEach(node => {
      const el = document.createElement('div');
      el.className = `mesh-node-marker role-${node.role} online`;
      el.id = `node-marker-${node.id}`;

      // Choose icon symbol based on role
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

    // 2. Update Ground Nodes (N1 - N8)
    if (state.nodes) {
      state.nodes.forEach(nodeState => {
        const markerObj = this.nodeMarkers.get(nodeState.id);
        if (!markerObj) return;

        const { element, data } = markerObj;
        const isOnline = nodeState.status === 'online';

        if (isOnline) {
          if (!element.classList.contains('online')) {
            element.classList.remove('down');
            element.classList.add('online');
            const sub = element.querySelector('.node-sub');
            if (sub) {
              const defaultRssi = { N1: -68, N2: -72, N3: -78, N4: -87, N5: -82, N6: -76, N7: -70, N8: -69 };
              const rssi = defaultRssi[data.id] || -75;
              sub.textContent = data.role === 'helper' ? 'Safe ground' : `${rssi} dBm`;
            }
          }
        } else {
          if (!element.classList.contains('down')) {
            element.classList.remove('online');
            element.classList.add('down');
            const sub = element.querySelector('.node-sub');
            if (sub) {
              sub.innerHTML = `<span class="down-text">⚠ DOWN</span>`;
            }
          }
        }
      });
    }
  }
}

