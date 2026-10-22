import scenarioData from '../data/scenario.json';

export class LinkPacketLayer {
  constructor(map) {
    this.map = map;
    this.scenario = scenarioData;
    this.linksSourceId = 'mesh-links-source';
    this.packetsSourceId = 'mesh-packets-source';
    this.emaJitter = new Map();
  }

  init() {
    if (!this.map) return;

    // Safely try adding sources; if style isn't ready yet, retry on 100ms timer
    try {
      if (this.map.getSource(this.linksSourceId)) return;

      // 1. GeoJSON Source for Network Links
      this.map.addSource(this.linksSourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Outer link glow layer
      this.map.addLayer({
        id: 'mesh-links-glow',
        type: 'line',
        source: this.linksSourceId,
        filter: ['==', ['get', 'active'], true],
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'glowWidth'],
          'line-opacity': ['get', 'glowOpacity'],
          'line-blur': 3
        }
      });

      // Active link core line
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

      // Inactive / downed route link line (dashed)
      this.map.addLayer({
        id: 'mesh-links-inactive',
        type: 'line',
        source: this.linksSourceId,
        filter: ['==', ['get', 'active'], false],
        paint: {
          'line-color': '#64748B',
          'line-width': 1.5,
          'line-opacity': 0.45,
          'line-dasharray': [2, 2]
        }
      });

      // 2. GeoJSON Source for Active SOS & Heartbeat Packet Pulses
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
          'circle-radius': ['get', 'glowRadius'],
          'circle-color': '#00E5FF',
          'circle-opacity': 0.75,
          'circle-blur': 0.7
        }
      });

      // Inner bright packet core
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

      console.log('[LinkPacketLayer] Neon links & packet layers added to map.');

      const state =
        this.lastState ||
        (window.engine ? window.engine.reconstructStateAt(window.engine.currentTime || 0) : null);
      if (state) {
        this.update(state);
      }
    } catch (err) {
      // Style still initializing; retry in 100ms
      setTimeout(() => this.init(), 100);
    }
  }

  getNodeCoordinates(nodeId, state) {
    const nodeData = this.scenario.nodes.find(n => n.id === nodeId);
    if (!nodeData) return null;

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

    const linkFeatures = [];
    const packetFeatures = [];
    const withMesh = state.withMesh !== false;
    const t = state.t || 0;

    this.scenario.edges.forEach((edge, index) => {
      const coordA = this.getNodeCoordinates(edge.a, state);
      const coordB = this.getNodeCoordinates(edge.b, state);
      if (!coordA || !coordB) return;

      const nodeAState = state.nodes?.find(n => n.id === edge.a);
      const nodeBState = state.nodes?.find(n => n.id === edge.b);

      const aVisible = nodeAState ? nodeAState.visible !== false : true;
      const bVisible = nodeBState ? nodeBState.visible !== false : true;
      if (!aVisible || !bVisible) return;

      const aOnline = nodeAState
        ? nodeAState.status === 'online' && (nodeAState.flightProgress === undefined || nodeAState.flightProgress >= 1)
        : true;
      const bOnline = nodeBState
        ? nodeBState.status === 'online' && (nodeBState.flightProgress === undefined || nodeBState.flightProgress >= 1)
        : true;

      const isActive = withMesh && aOnline && bOnline;

      const edgeKey = `${edge.a}-${edge.b}`;
      const seed = index * 1.37;
      const currentJitter = Math.sin(t * 3.2 + seed) * 1.5;
      const prevJitter = this.emaJitter.get(edgeKey) || 0;
      const smoothedJitter = prevJitter * 0.88 + currentJitter * 0.12;
      this.emaJitter.set(edgeKey, smoothedJitter);

      const liveRssi = (edge.baseRssi || -75) + smoothedJitter;

      let linkColor = '#2EE66B'; // Strong (>= -80 dBm)
      if (liveRssi < -100) {
        linkColor = '#FF3B3B'; // Weak
      } else if (liveRssi < -80) {
        linkColor = '#FFB020'; // Medium
      }

      if (!isActive) {
        linkColor = '#64748B';
      }

      linkFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [coordA, coordB]
        },
        properties: {
          id: edgeKey,
          active: isActive,
          color: linkColor,
          opacity: isActive ? 0.92 : 0.35,
          glowOpacity: isActive ? 0.45 : 0.0,
          coreWidth: isActive ? 2.6 : 1.4,
          glowWidth: isActive ? 7.0 : 0.0,
          rssi: Math.round(liveRssi)
        }
      });

      // Ambient HELLO discovery pulses along active links so the mesh looks alive immediately at t=0
      if (isActive) {
        const pulseProg = ((t * 0.65) + index * 0.23) % 1;
        const pLon = coordA[0] + pulseProg * (coordB[0] - coordA[0]);
        const pLat = coordA[1] + pulseProg * (coordB[1] - coordA[1]);
        packetFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [pLon, pLat] },
          properties: {
            id: `hello-${edgeKey}`,
            coreRadius: 3.2,
            glowRadius: 7.5
          }
        });
      }
    });

    linksSource.setData({
      type: 'FeatureCollection',
      features: linkFeatures
    });

    // High-visibility SOS Packet Orbs when SOS1-SOS4 are in transit
    if (withMesh && state.sosStates) {
      state.sosStates.forEach(sos => {
        if ((sos.state === 'SENT_TO_MESH' || sos.state === 'TRANSMITTING') && sos.fromNode && sos.toNode) {
          const fromCoord = this.getNodeCoordinates(sos.fromNode, state);
          const toCoord = this.getNodeCoordinates(sos.toNode, state);

          if (fromCoord && toCoord) {
            const p = Math.max(0, Math.min(1, sos.hopProgress || 0));
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
                coreRadius: 6.5,
                glowRadius: 14
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
