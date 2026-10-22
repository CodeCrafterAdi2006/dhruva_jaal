import scenarioData from '../data/scenario.json';

export class LinkPacketLayer {
  constructor(map) {
    this.map = map;
    this.scenario = scenarioData;
    this.linksSourceId = 'mesh-links-source';
    this.packetsSourceId = 'mesh-packets-source';
    this.activePathSourceId = 'mesh-active-path-source';
    this.emaJitter = new Map();
  }

  init() {
    if (!this.map) return;

    if (!this.map.isStyleLoaded()) {
      this.map.once('styledata', () => this.init());
      return;
    }

    if (this.map.getSource(this.linksSourceId)) return; // Already initialized

    // 1. GeoJSON Source for Network Links
    this.map.addSource(this.linksSourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    // Outer link glow layer (translucent bloom)
    this.map.addLayer({
      id: 'mesh-links-glow',
      type: 'line',
      source: this.linksSourceId,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'glowWidth'],
        'line-opacity': ['get', 'glowOpacity'],
        'line-blur': 2.5
      }
    });

    // Inner core link line
    this.map.addLayer({
      id: 'mesh-links-core',
      type: 'line',
      source: this.linksSourceId,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'coreWidth'],
        'line-opacity': ['get', 'opacity'],
        'line-dasharray': ['case', ['get', 'active'], ['literal', [1, 0]], ['literal', [2, 2]]]
      }
    });

    // 2. GeoJSON Source for Active SOS Packet Pulses
    this.map.addSource(this.packetsSourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    // Outer packet halo glow
    this.map.addLayer({
      id: 'mesh-packets-glow',
      type: 'circle',
      source: this.packetsSourceId,
      paint: {
        'circle-radius': 11,
        'circle-color': '#00E5FF',
        'circle-opacity': 0.65,
        'circle-blur': 0.8
      }
    });

    // Inner bright packet core
    this.map.addLayer({
      id: 'mesh-packets-core',
      type: 'circle',
      source: this.packetsSourceId,
      paint: {
        'circle-radius': 5,
        'circle-color': '#FFFFFF',
        'circle-stroke-width': 1.8,
        'circle-stroke-color': '#00E5FF'
      }
    });
  }

  /**
   * Resolve live coordinates for a node ID (handles moving drones and ground nodes)
   */
  getNodeCoordinates(nodeId, state) {
    const nodeData = this.scenario.nodes.find(n => n.id === nodeId);
    if (!nodeData) return null;

    // If it is a drone, interpolate its position based on live flightProgress
    if (nodeData.role === 'drone' && state?.nodes) {
      const droneState = state.nodes.find(n => n.id === nodeId);
      if (droneState && droneState.visible && droneState.flightProgress !== undefined) {
        const baseCamp = this.scenario.nodes.find(n => n.id === 'N8');
        const p = droneState.flightProgress;
        const lon = baseCamp.lon + p * (nodeData.lon - baseCamp.lon);
        const lat = baseCamp.lat + p * (nodeData.lat - baseCamp.lat);
        return [lon, lat];
      }
    }

    return [nodeData.lon, nodeData.lat];
  }

  /**
   * Update link lines and packet positions on every animation frame
   */
  update(state) {
    if (!this.map || !state) return;

    const linksSource = this.map.getSource(this.linksSourceId);
    const packetsSource = this.map.getSource(this.packetsSourceId);
    if (!linksSource || !packetsSource) return;

    // 1. Build Links GeoJSON
    const linkFeatures = [];
    const withMesh = state.withMesh !== false;

    this.scenario.edges.forEach((edge, index) => {
      const coordA = this.getNodeCoordinates(edge.a, state);
      const coordB = this.getNodeCoordinates(edge.b, state);
      if (!coordA || !coordB) return;

      const nodeAState = state.nodes?.find(n => n.id === edge.a);
      const nodeBState = state.nodes?.find(n => n.id === edge.b);

      const aOnline = nodeAState ? (nodeAState.status === 'online' && nodeAState.visible !== false && (nodeAState.flightProgress === undefined || nodeAState.flightProgress >= 1)) : true;
      const bOnline = nodeBState ? (nodeBState.status === 'online' && nodeBState.visible !== false && (nodeBState.flightProgress === undefined || nodeBState.flightProgress >= 1)) : true;

      // Link is active only if withMesh is ON and both endpoints are operational and stationed
      const isActive = withMesh && aOnline && bOnline;

      // Calculate subtle EMA breathing (+-1.5 dB)
      const t = state.t || 0;
      const seed = index * 1.37;
      const currentJitter = Math.sin(t * 3.2 + seed) * 1.5;
      const prevJitter = this.emaJitter.get(edge.id) || 0;
      const smoothedJitter = prevJitter * 0.88 + currentJitter * 0.12;
      this.emaJitter.set(edge.id, smoothedJitter);

      const liveRssi = (edge.baseRssi || -75) + smoothedJitter;

      // Determine link color tier
      let linkColor = '#2EE66B'; // Strong (>= -80 dBm)
      if (liveRssi < -100) {
        linkColor = '#FF3B3B'; // Weak
      } else if (liveRssi < -80) {
        linkColor = '#FFB020'; // Medium
      }

      if (!isActive) {
        linkColor = '#475569'; // Muted dark slate when down/inactive
      }

      linkFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [coordA, coordB]
        },
        properties: {
          id: `${edge.a}-${edge.b}`,
          active: isActive,
          color: linkColor,
          opacity: isActive ? 0.85 : 0.22,
          glowOpacity: isActive ? 0.35 : 0.0,
          coreWidth: isActive ? 2.2 : 1.2,
          glowWidth: isActive ? 5.5 : 0.0,
          rssi: Math.round(liveRssi)
        }
      });
    });

    linksSource.setData({
      type: 'FeatureCollection',
      features: linkFeatures
    });

    // 2. Build Packets GeoJSON (Moving orbs for SOS messages in transit)
    const packetFeatures = [];

    if (withMesh && state.sosStates) {
      state.sosStates.forEach(sos => {
        // Only render orbs when actively transmitting across mesh
        if ((sos.state === 'SENT_TO_MESH' || sos.state === 'TRANSMITTING') && sos.fromNode && sos.toNode) {
          const fromCoord = this.getNodeCoordinates(sos.fromNode, state);
          const toCoord = this.getNodeCoordinates(sos.toNode, state);

          if (fromCoord && toCoord) {
            const p = Math.max(0, Math.min(1, sos.hopProgress || 0));
            // Linear geodesic interpolation along the hop segment
            const curLon = fromCoord[0] + p * (toCoord[0] - fromCoord[0]);
            const curLat = fromCoord[1] + p * (toCoord[1] - fromCoord[1]);

            packetFeatures.push({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [curLon, curLat]
              },
              properties: {
                id: sos.id,
                hopProgress: p,
                from: sos.fromNode,
                to: sos.toNode
              }
            });
          }
        }
      });
    }

    packetsSource.setData({
      type: 'FeatureCollection',
      features: packetFeatures
    });
  }
}
