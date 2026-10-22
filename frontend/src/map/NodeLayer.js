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
   * Synchronize tower and node visual states with ScenarioEngine tick snapshot
   */
  update(state) {
    if (!state) return;

    // Update Cell Towers (Online at t < 6s, Down at t >= 6s)
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
  }
}
