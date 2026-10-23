import scenarioData from '../data/scenario.json';
import { soundFx } from '../engine/AudioSynthesizer.js';

export class LinkPacketLayer {
  constructor(map) {
    this.map = map;
    this.scenario = scenarioData;
    this.linksSourceId = 'mesh-links-source';
    this.packetsSourceId = 'mesh-packets-source';
    this.emaJitter = new Map();
    this.lastState = null;

    // Real-time interactive packets (animate independent of timeline pause/scrub)
    this.livePackets = [];
    this.isLiveAnimating = false;
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

      // --- Packets Source (Both timeline SOS & real-time live packets / ACK) ---
      this.map.addSource(this.packetsSourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Outer halo with dynamic color (Cyan for SOS, Emerald Green for ACK)
      this.map.addLayer({
        id: 'mesh-packets-glow',
        type: 'circle',
        source: this.packetsSourceId,
        paint: {
          'circle-radius': ['coalesce', ['get', 'glowRadius'], 14],
          'circle-color': ['coalesce', ['get', 'glowColor'], '#00E5FF'],
          'circle-opacity': 0.65,
          'circle-blur': 0.8
        }
      });

      // Inner bright core dot
      this.map.addLayer({
        id: 'mesh-packets-core',
        type: 'circle',
        source: this.packetsSourceId,
        paint: {
          'circle-radius': ['coalesce', ['get', 'coreRadius'], 5.5],
          'circle-color': '#FFFFFF',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': ['coalesce', ['get', 'strokeColor'], '#00E5FF']
        }
      });

      console.log('[LinkPacketLayer] Layers mounted with real-time packet transport.');

      // Draw initial state
      const state = this.lastState
        || (window.engine ? window.engine.reconstructStateAt(0) : null);
      if (state) this.update(state);

    } catch (err) {
      // MapLibre style not ready yet — retry in 150ms
      setTimeout(() => this.init(), 150);
    }
  }

  /** Resolve live [lon, lat] for any node, including moving drones and dynamic nodes */
  getNodeCoordinates(nodeId, state) {
    const nodeData = this.scenario.nodes.find(n => n.id === nodeId);
    if (!nodeData) {
      const dynNode = state?.nodes?.find(n => n.id === nodeId)
        || window.engine?.dynamicNodes?.get(nodeId);
      if (dynNode) return [dynNode.lon, dynNode.lat];
      return null;
    }

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

  /**
   * Launch a real-time live packet across an array of node hops.
   * Runs at 60fps via performance.now() regardless of timeline play/pause state.
   */
  launchLivePacket(config) {
    const { id, from, path, text, isAck = false, onDelivered, onHop } = config;
    if (!path || path.length < 2) return;

    const packet = {
      id: id || `live-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      from: from || path[0],
      to: path[path.length - 1],
      path,
      text: text || '',
      isAck: Boolean(isAck),
      startTime: performance.now(),
      hopSeconds: 0.95, // 950ms per hop for fluid, readable tactical flight
      glowColor: isAck ? '#10B981' : '#00E5FF',
      strokeColor: isAck ? '#10B981' : '#00E5FF',
      glowRadius: isAck ? 16 : 14,
      coreRadius: isAck ? 6.5 : 5.5,
      lastHopReported: -1,
      onDelivered,
      onHop
    };

    this.livePackets.push(packet);

    // Initial hop sound
    soundFx.playHop();

    if (!this.isLiveAnimating) {
      this.startLiveAnimation();
    }
  }

  startLiveAnimation() {
    this.isLiveAnimating = true;

    const animate = (timestamp) => {
      if (!this.map) {
        this.isLiveAnimating = false;
        return;
      }

      this.tickLivePackets(timestamp);

      if (this.livePackets.length > 0) {
        requestAnimationFrame(animate);
      } else {
        this.isLiveAnimating = false;
        // Clean refresh with last state timeline packets
        if (this.lastState) this.refreshTimelinePackets(this.lastState);
      }
    };

    requestAnimationFrame(animate);
  }

  tickLivePackets(now) {
    const packetsSource = this.map?.getSource(this.packetsSourceId);
    if (!packetsSource) return;

    const activeLive = [];
    const liveFeatures = [];

    for (const packet of this.livePackets) {
      const totalHops = packet.path.length - 1;
      const elapsed = (now - packet.startTime) / 1000;
      const hopFloat = elapsed / packet.hopSeconds;

      if (hopFloat >= totalHops) {
        // Destination reached!
        if (packet.isAck) {
          soundFx.playAck();
        } else {
          soundFx.playDelivered();
        }

        try {
          packet.onDelivered?.();
        } catch (e) {
          console.error('[LinkPacketLayer] onDelivered error:', e);
        }
      } else {
        activeLive.push(packet);
        const hopIdx = Math.min(totalHops - 1, Math.floor(hopFloat));
        const p = hopFloat - hopIdx;

        if (hopIdx !== packet.lastHopReported) {
          packet.lastHopReported = hopIdx;
          soundFx.playHop();
          try {
            packet.onHop?.(packet.path[hopIdx], packet.path[hopIdx + 1], hopIdx);
          } catch (e) {}
        }

        const coordA = this.getNodeCoordinates(packet.path[hopIdx], this.lastState);
        const coordB = this.getNodeCoordinates(packet.path[hopIdx + 1], this.lastState);

        if (coordA && coordB) {
          const lon = coordA[0] + p * (coordB[0] - coordA[0]);
          const lat = coordA[1] + p * (coordB[1] - coordA[1]);

          liveFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lon, lat] },
            properties: {
              id: packet.id,
              coreRadius: packet.coreRadius,
              glowRadius: packet.glowRadius,
              glowColor: packet.glowColor,
              strokeColor: packet.strokeColor
            }
          });
        }
      }
    }

    this.livePackets = activeLive;

    // Combine with timeline packets
    const timelineFeatures = this.getTimelinePacketFeatures(this.lastState);
    packetsSource.setData({
      type: 'FeatureCollection',
      features: [...timelineFeatures, ...liveFeatures]
    });
  }

  getTimelinePacketFeatures(state) {
    const packetFeatures = [];
    if (state?.withMesh !== false && state?.sosStates) {
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
              glowRadius: 13,
              glowColor: '#00E5FF',
              strokeColor: '#00E5FF'
            }
          });
        }
      });
    }
    return packetFeatures;
  }

  refreshTimelinePackets(state) {
    const packetsSource = this.map?.getSource(this.packetsSourceId);
    if (!packetsSource) return;
    packetsSource.setData({
      type: 'FeatureCollection',
      features: this.getTimelinePacketFeatures(state)
    });
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

    // ── 1. LINK LINES (Scenario edges + Dynamic user edges) ───────────────────
    const allEdges = state.edges || this.scenario.edges;
    allEdges.forEach((edge, index) => {
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

      // STRICT USER CONSTRAINT: When a node is down, all its lines MUST completely vanish!
      if (!isActive) return;

      // EMA RSSI breathing (±1.5 dB)
      const edgeKey = `${edge.a}-${edge.b}`;
      const seed = index * 1.37;
      const raw = Math.sin(t * 3.2 + seed) * 1.5;
      const prev = this.emaJitter.get(edgeKey) || 0;
      const jitter = prev * 0.88 + raw * 0.12;
      this.emaJitter.set(edgeKey, jitter);

      const liveRssi = (edge.baseRssi || -75) + jitter;

      // Differentiate Ground vs Drone vs Balloon links
      let color = '#2EE66B'; // Strong ground link ≥ −80
      let coreWidth = 2.4;
      let glowWidth = 6.5;
      let glowOpacity = 0.40;

      if (edge.droneLink) {
        color = '#00F0FF'; // Agile Drone aerial link (tactical cyan)
        coreWidth = 2.6;
        glowWidth = 8.5;
        glowOpacity = 0.65;
      } else if (edge.balloonLink) {
        color = '#A78BFA'; // Tethered Balloon stratospheric link (tactical violet)
        coreWidth = 2.8;
        glowWidth = 9.0;
        glowOpacity = 0.70;
      } else {
        if (liveRssi < -100) color = '#FF3B3B'; // Weak
        else if (liveRssi < -80) color = '#FFB020'; // Medium
      }

      linkFeatures.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [coordA, coordB] },
        properties: {
          id: edgeKey,
          active: true,
          color,
          opacity: 0.95,
          glowOpacity,
          coreWidth,
          glowWidth,
          rssi: Math.round(liveRssi)
        }
      });
    });

    linksSource.setData({ type: 'FeatureCollection', features: linkFeatures });

    // ── 2. SOS PACKET ORBS ───────────────────────────────────────────────────
    // If live animation loop is idle, refresh timeline packets directly
    if (!this.isLiveAnimating) {
      this.refreshTimelinePackets(state);
    }
  }
}
