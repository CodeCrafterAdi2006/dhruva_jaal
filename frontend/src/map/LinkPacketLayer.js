import scenarioData from '../data/scenario.json';

export class LinkPacketLayer {
  constructor(map) {
    this.map = map;
    this.scenario = scenarioData;
    this.linksSourceId = 'mesh-links-source';
    this.packetsSourceId = 'mesh-packets-source';
    this.emaJitter = new Map();
    this.lastState = null;
  }

  init() {
    if (!this.map) return;

    try {
      if (this.map.getSource(this.linksSourceId)) return;

      // --- Links Source ---
      this.map.addSource(this.linksSourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Bloom glow behind active links
      this.map.addLayer({
        id: 'mesh-links-glow',
        type: 'line',
        source: this.linksSourceId,
        filter: ['==', ['get', 'active'], true],
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'glowWidth'],
          'line-opacity': ['get', 'glowOpacity'],
          'line-blur': 4
        }
      });

      // Solid active link
      this.map.addLayer({
        id: 'mesh-links-core',
        type: 'line',
        source: this.linksSourceId,
        filter: ['==', ['get', 'active'], true],
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'coreWidth'],
          'line-opacity': ['get', 'opacity']
        }
      });

      // Dashed inactive / down links
      this.map.addLayer({
        id: 'mesh-links-inactive',
        type: 'line',
        source: this.linksSourceId,
        filter: ['==', ['get', 'active'], false],
        paint: {
          'line-color': '#475569',
          'line-width': 1.2,
          'line-opacity': 0.35,
          'line-dasharray': [3, 3]
        }
      });

      // --- Packets Source (ONLY real SOS orbs — no ambient noise) ---
      this.map.addSource(this.packetsSourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Outer halo
      this.map.addLayer({
        id: 'mesh-packets-glow',
        type: 'circle',
        source: this.packetsSourceId,
        paint: {
          'circle-radius': ['get', 'glowRadius'],
          'circle-color': '#00E5FF',
          'circle-opacity': 0.55,
          'circle-blur': 0.9
        }
      });

      // Inner bright dot
      this.map.addLayer({
        id: 'mesh-packets-core',
        type: 'circle',
        source: this.packetsSourceId,
        paint: {
          'circle-radius': ['get', 'coreRadius'],
          'circle-color': '#FFFFFF',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#00E5FF'
        }
      });

      console.log('[LinkPacketLayer] Layers mounted.');

      // Draw initial state
      const state = this.lastState
        || (window.engine ? window.engine.reconstructStateAt(0) : null);
      if (state) this.update(state);

    } catch (err) {
      // MapLibre style not ready yet — retry in 150ms
      setTimeout(() => this.init(), 150);
    }
  }

  /** Resolve live [lon, lat] for any node, including moving drones */
  getNodeCoordinates(nodeId, state) {
    const nodeData = this.scenario.nodes.find(n => n.id === nodeId);
    if (!nodeData) return null;

    if (nodeData.role === 'drone' && state?.nodes) {
      const droneState = state.nodes.find(n => n.id === nodeId);
      if (droneState && droneState.visible && droneState.flightProgress > 0) {
        const base = this.scenario.nodes.find(n => n.id === 'N8');
        const p = droneState.flightProgress;
        return [
          base.lon + p * (nodeData.lon - base.lon),
          base.lat + p * (nodeData.lat - base.lat)
        ];
      }
    }

    return [nodeData.lon, nodeData.lat];
  }

  update(state) {
    if (!state) return;
    this.lastState = state;
    if (!this.map) return;

    const linksSource = this.map.getSource(this.linksSourceId);
    const packetsSource = this.map.getSource(this.packetsSourceId);
    if (!linksSource || !packetsSource) {
      this.init();
      return;
    }

    const withMesh = state.withMesh !== false;
    const t = state.t || 0;
    const linkFeatures = [];
    const packetFeatures = [];

    // ── 1. LINK LINES ──────────────────────────────────────────────────────────
    this.scenario.edges.forEach((edge, index) => {
      const coordA = this.getNodeCoordinates(edge.a, state);
      const coordB = this.getNodeCoordinates(edge.b, state);
      if (!coordA || !coordB) return;

      const nodeAState = state.nodes?.find(n => n.id === edge.a);
      const nodeBState = state.nodes?.find(n => n.id === edge.b);

      // Skip edges whose endpoints are not yet deployed (drones/balloons before launch)
      if (nodeAState?.visible === false || nodeBState?.visible === false) return;

      const aOnline = nodeAState
        ? nodeAState.status === 'online' && (nodeAState.flightProgress === undefined || nodeAState.flightProgress >= 1)
        : true;
      const bOnline = nodeBState
        ? nodeBState.status === 'online' && (nodeBState.flightProgress === undefined || nodeBState.flightProgress >= 1)
        : true;

      const isActive = withMesh && aOnline && bOnline;

      // EMA RSSI breathing (±1.5 dB)
      const edgeKey = `${edge.a}-${edge.b}`;
      const seed = index * 1.37;
      const raw = Math.sin(t * 3.2 + seed) * 1.5;
      const prev = this.emaJitter.get(edgeKey) || 0;
      const jitter = prev * 0.88 + raw * 0.12;
      this.emaJitter.set(edgeKey, jitter);

      const liveRssi = (edge.baseRssi || -75) + jitter;

      let color = '#2EE66B';                      // strong ≥ −80
      if (liveRssi < -100) color = '#FF3B3B';    // weak
      else if (liveRssi < -80) color = '#FFB020'; // medium
      if (!isActive) color = '#475569';

      linkFeatures.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [coordA, coordB] },
        properties: {
          id: edgeKey,
          active: isActive,
          color,
          opacity:      isActive ? 0.90 : 0.30,
          glowOpacity:  isActive ? 0.40 : 0.00,
          coreWidth:    isActive ? 2.4  : 1.2,
          glowWidth:    isActive ? 7.0  : 0.0,
          rssi: Math.round(liveRssi)
        }
      });
    });

    linksSource.setData({ type: 'FeatureCollection', features: linkFeatures });

    // ── 2. SOS PACKET ORBS (only real in-flight messages) ─────────────────────
    if (withMesh && state.sosStates) {
      state.sosStates.forEach(sos => {
        if (
          (sos.state === 'SENT_TO_MESH' || sos.state === 'TRANSMITTING')
          && sos.fromNode && sos.toNode
        ) {
          const from = this.getNodeCoordinates(sos.fromNode, state);
          const to   = this.getNodeCoordinates(sos.toNode,   state);
          if (!from || !to) return;

          const p   = Math.max(0, Math.min(1, sos.hopProgress || 0));
          const lon = from[0] + p * (to[0] - from[0]);
          const lat = from[1] + p * (to[1] - from[1]);

          packetFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lon, lat] },
            properties: {
              id: sos.id,
              coreRadius: 5.5,
              glowRadius: 13
            }
          });
        }
      });
    }

    packetsSource.setData({ type: 'FeatureCollection', features: packetFeatures });
  }
}
