// Deterministic 100-Second Scenario Playback Engine (Production Refinement)
// Sourced from scenario.json, simulation_plan.md, and master_execution_plan.md

import { DataSource } from './DataSource.js';
import scenarioData from '../data/scenario.json';

export class ScenarioEngine extends DataSource {
  constructor() {
    super();
    this.scenario = scenarioData;
    this.duration = 100; // 100s full scenario run
    this.currentTime = 0;
    this.speed = 1.0;
    this.isPlaying = false;
    this.withMesh = true; // Toggle for With Mesh vs Without Mesh pitch comparison

    this.rafId = null;
    this.lastTimestamp = null;
    this.processedEvents = new Set();

    // Manual overrides for interactive judge Q&A (Simulate Disaster / Keyboard shortcuts)
    this.manualKilledNodes = new Set();
    this.manualAerialTrigger = null; // 'drones' | 'balloons'

    // Dynamic Survivor & Relay Node Injection (Interactive Sandbox)
    this.dynamicNodes = new Map();
    this.dynamicEdges = [];
    this.dynamicSosList = [];

    // Periodic Survivor Distress Beacon Loop (N1 & Dynamic Survivors)
    this.survivorBeacons = new Map();
    this.beaconTimerId = null;
  }

  init() {
    // Register initial trapped rooftop survivor (N1)
    this.registerSurvivorBeacon('N1', {
      people: 4,
      need: 'RESCUE',
      battery: 18,
      text: 'BALKHU ROOFTOP: Water rising above 2.8m. 4 people trapped on tin roof. Immediate boat rescue needed.'
    });
    this.ensureBeaconLoop();
    this.seek(0);
    this.emit('loaded', this.scenario);
  }

  setWithMesh(enabled) {
    this.withMesh = enabled;
    this.emit('mode_change', { withMesh: this.withMesh });
    this.seek(this.currentTime);
  }

  setSpeed(newSpeed) {
    this.speed = Math.max(0.25, Math.min(newSpeed, 4.0));
    this.emit('speed_change', { speed: this.speed });
  }

  play() {
    if (this.isPlaying) return;
    if (this.currentTime >= this.duration) {
      this.seek(0);
    }
    this.isPlaying = true;
    this.lastTimestamp = performance.now();
    this.emit('play_state', { isPlaying: true });
    this.loop();
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.emit('play_state', { isPlaying: false });
  }

  restart() {
    this.pause();
    this.manualKilledNodes.clear();
    this.manualAerialTrigger = null;
    this.dynamicSosList = [];
    this.seek(0);
    this.play();
  }

  /**
   * Interactive "Simulate Disaster" Button / 'K' Keyboard shortcut
   */
  killNextNode() {
    const candidates = ['N3', 'N6', 'N2', 'N4', 'N7', 'N5'];
    const state = this.reconstructStateAt(this.currentTime);
    const nextTarget = candidates.find(id => {
      const n = state.nodes.find(node => node.id === id);
      return n && n.status === 'online';
    });

    if (nextTarget) {
      this.manualKilledNodes.add(nextTarget);
      this.emit('node_status', { id: nextTarget, status: 'down', reason: 'Manual disaster trigger' });
      const updatedState = this.reconstructStateAt(this.currentTime);
      this.emit('state_update', updatedState);
      return nextTarget;
    }
    return null;
  }

  /**
   * Helper: calculate spherical distance in meters between two [lon, lat] coordinates
   */
  calculateDistanceMeters(lon1, lat1, lon2, lat2) {
    const R = 6371e3; // Earth radius in meters
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Drop / Spawn Dynamic Survivor or Relay Node anywhere on map
   */
  spawnDynamicNode(lon, lat, options = {}) {
    const count = this.dynamicNodes.size + 1;
    const id = options.id || `DYN-${count}`;
    const role = options.role || 'dongle';
    const label = role === 'dongle' ? `SURVIVOR ${count}` : `RELAY ${count}`;

    const node = {
      id,
      role: 'dongle',
      label: `🔴 SURVIVOR · ${id}`,
      sublabel: 'Live Survivor',
      place: `GPS: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      lat,
      lon,
      alt_m: 6,
      status: 'online',
      visible: true,
      flightProgress: 1,
      isDynamic: true
    };

    this.dynamicNodes.set(id, node);

    // Form physically realistic radio links to all nodes within range
    const allExistingNodes = [
      ...this.scenario.nodes,
      ...Array.from(this.dynamicNodes.values()).filter(n => n.id !== id)
    ];

    allExistingNodes.forEach(neighbor => {
      const dist = this.calculateDistanceMeters(lon, lat, neighbor.lon, neighbor.lat);
      const isAerial = neighbor.role === 'drone' || neighbor.role === 'balloon';
      const maxRange = isAerial ? (neighbor.role === 'balloon' ? 3500 : 2500) : 850;

      if (dist <= maxRange) {
        // Physical log-distance path loss
        const rawRssi = isAerial
          ? -60 - 20 * Math.log10(dist / 100)
          : -68 - 32 * Math.log10(dist / 100);
        const baseRssi = Math.max(-115, Math.min(-62, Math.round(rawRssi)));

        this.dynamicEdges.push({
          a: id,
          b: neighbor.id,
          baseRssi,
          droneLink: neighbor.role === 'drone',
          balloonLink: neighbor.role === 'balloon',
          isDynamic: true
        });
      }
    });

    // Register survivor and trigger first distress beacon
    this.registerSurvivorBeacon(id, {
      people: 2,
      need: 'RESCUE',
      battery: 88,
      text: `EMERGENCY: Stranded survivor at ${id} (${lat.toFixed(4)}, ${lon.toFixed(4)}). Immediate rescue needed.`
    });
    this.fireSurvivorBeacon(id);

    const state = this.reconstructStateAt(this.currentTime);
    this.emit('state_update', state);
    this.emit('node_spawned', { node, state });
    return node;
  }

  /**
   * Register a survivor node for periodic distress beacons until ACK
   */
  registerSurvivorBeacon(nodeId, config = {}) {
    if (this.survivorBeacons.has(nodeId)) {
      const s = this.survivorBeacons.get(nodeId);
      if (config.text) s.text = config.text;
      return s;
    }

    const survivor = {
      id: nodeId,
      isAcknowledged: false,
      lastBeaconTimestamp: 0,
      beaconIntervalSeconds: 16, // Real-world LoRa distress beacon interval
      beaconAttempts: 0,
      people: config.people || 2,
      need: config.need || 'RESCUE',
      battery: config.battery || 85,
      text: config.text || `EMERGENCY: Stranded survivor at ${nodeId}. Immediate rescue required.`,
      storedInFlash: false
    };

    this.survivorBeacons.set(nodeId, survivor);
    this.ensureBeaconLoop();
    return survivor;
  }

  ensureBeaconLoop() {
    if (this.beaconTimerId) return;
    this.beaconTimerId = setInterval(() => {
      this.checkSurvivorBeacons();
    }, 2500);
  }

  checkSurvivorBeacons() {
    const now = performance.now();
    this.survivorBeacons.forEach(survivor => {
      if (survivor.isAcknowledged) return;

      const elapsed = (now - survivor.lastBeaconTimestamp) / 1000;
      if (survivor.lastBeaconTimestamp === 0 || elapsed >= survivor.beaconIntervalSeconds) {
        this.fireSurvivorBeacon(survivor.id);
      }
    });
  }

  fireSurvivorBeacon(nodeId) {
    const survivor = this.survivorBeacons.get(nodeId);
    if (!survivor || survivor.isAcknowledged) return;

    survivor.lastBeaconTimestamp = performance.now();
    survivor.beaconAttempts++;

    const state = this.reconstructStateAt(this.currentTime);

    if (!this.withMesh) {
      this.emit('sos_failed', {
        id: `SOS-${nodeId}-B${survivor.beaconAttempts}`,
        reason: 'Cellular grid DOWN. Zero LoRa mesh coverage in Without-Mesh mode.',
        from: nodeId
      });
      return;
    }

    const path = this.findShortestPath(nodeId, 'N8', state);

    if (!path) {
      // Mesh isolated or bridge drowned — store in flash memory
      survivor.storedInFlash = true;
      const sosItem = {
        id: `SOS-${nodeId}-B${survivor.beaconAttempts}`,
        from: nodeId,
        path: [nodeId],
        people: survivor.people,
        need: survivor.need,
        battery: survivor.battery,
        text: survivor.text,
        state: 'STORED',
        statusText: `STORED IN DONGLE FLASH · Retrying beacon #${survivor.beaconAttempts} every 16s...`,
        isDynamic: true
      };
      this.emit('sos_stored', { survivor, sosItem, reason: 'No active route to Base Camp. Held in flash memory.' });
      this.emit('state_update', this.reconstructStateAt(this.currentTime));
      return;
    }

    // Active path found — transmit packet across mesh!
    survivor.storedInFlash = false;
    const sosItem = {
      id: `SOS-${nodeId}-B${survivor.beaconAttempts}`,
      from: nodeId,
      path,
      people: survivor.people,
      need: survivor.need,
      battery: survivor.battery,
      text: survivor.text,
      state: 'TRANSMITTING',
      isDynamic: true,
      deliveredAt: null,
      simClock: state.simClock || 'LIVE'
    };

    this.dynamicSosList.push(sosItem);

    // Launch real-time packet flight across nodes
    this.emit('live_packet_launch', {
      id: sosItem.id,
      from: nodeId,
      path,
      text: sosItem.text,
      isAck: false,
      onHop: (from, to, hopIdx) => {
        this.emit('packet_hop', { id: sosItem.id, from, to, hopIdx });
      },
      onDelivered: () => {
        // 1. Deliver to Base Camp
        sosItem.state = 'DELIVERED';
        sosItem.deliveredAt = this.currentTime;
        this.emit('sos_delivered', { sosItem, state: this.reconstructStateAt(this.currentTime) });
        this.emit('state_update', this.reconstructStateAt(this.currentTime));

        // 2. Base Camp immediately dispatches return ACK packet
        const reversePath = [...path].reverse();
        const ackId = `ACK-${sosItem.id}`;

        this.emit('live_packet_launch', {
          id: ackId,
          from: 'N8',
          path: reversePath,
          text: `CONFIRMED: Rescue boat dispatched to ${nodeId}. Stay above water line.`,
          isAck: true,
          onHop: (from, to, hopIdx) => {
            this.emit('ack_hop', { id: ackId, from, to, hopIdx });
          },
          onDelivered: () => {
            // 3. Survivor receives two-way ACK
            survivor.isAcknowledged = true;
            this.emit('survivor_ack', {
              nodeId,
              sosId: sosItem.id,
              ackId,
              text: `Rescue confirmation received by ${nodeId}!`
            });
            this.emit('state_update', this.reconstructStateAt(this.currentTime));
          }
        });
      }
    });

    this.emit('sos_beacon_sent', { survivor, sosItem, path });
    this.emit('state_update', this.reconstructStateAt(this.currentTime));
  }

  /**
   * Remove a dynamic node and its attached edges
   */
  removeDynamicNode(nodeId) {
    this.dynamicNodes.delete(nodeId);
    this.survivorBeacons.delete(nodeId);
    this.dynamicEdges = this.dynamicEdges.filter(e => e.a !== nodeId && e.b !== nodeId);
    this.dynamicSosList = this.dynamicSosList.filter(s => s.from !== nodeId);
    const state = this.reconstructStateAt(this.currentTime);
    this.emit('state_update', state);
  }

  /**
   * Clear all dynamic nodes
   */
  clearDynamicNodes() {
    this.dynamicNodes.clear();
    this.dynamicEdges = [];
    this.dynamicSosList = [];
    const state = this.reconstructStateAt(this.currentTime);
    this.emit('state_update', state);
  }

  /**
   * Dijkstra / BFS Shortest Path through living mesh edges to Base Camp N8
   */
  findShortestPath(fromId, toId = 'N8', state) {
    if (!state) state = this.reconstructStateAt(this.currentTime);

    const activeEdges = state.edges.filter(e => e.active);
    const adj = new Map();

    activeEdges.forEach(e => {
      if (!adj.has(e.a)) adj.set(e.a, []);
      if (!adj.has(e.b)) adj.set(e.b, []);
      adj.get(e.a).push(e.b);
      adj.get(e.b).push(e.a);
    });

    const queue = [[fromId]];
    const visited = new Set([fromId]);

    while (queue.length > 0) {
      const path = queue.shift();
      const curr = path[path.length - 1];

      if (curr === toId) return path;

      const neighbors = adj.get(curr) || [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push([...path, next]);
        }
      }
    }

    return null; // Partitioned / No route
  }

  /**
   * Live SOS Transmission from any dynamic or ground node
   */
  sendDynamicSos(fromId, customText) {
    let survivor = this.survivorBeacons.get(fromId);
    if (!survivor) {
      survivor = this.registerSurvivorBeacon(fromId, { text: customText });
    } else {
      survivor.isAcknowledged = false;
      if (customText) survivor.text = customText;
    }
    survivor.lastBeaconTimestamp = 0; // Force immediate broadcast
    this.fireSurvivorBeacon(fromId);
    return { success: true, survivor };
  }

  loop() {
    if (!this.isPlaying) return;

    const now = performance.now();
    const deltaSeconds = ((now - this.lastTimestamp) / 1000) * this.speed;
    this.lastTimestamp = now;

    const nextTime = Math.min(this.duration, this.currentTime + deltaSeconds);
    this.advanceTo(nextTime);

    if (this.currentTime >= this.duration) {
      this.pause();
      this.emit('completed', { currentTime: this.duration });
      return;
    }

    this.rafId = requestAnimationFrame(() => this.loop());
  }

  /**
   * Advance playback forward and trigger newly crossed timeline events
   */
  advanceTo(newTime) {
    const prevTime = this.currentTime;
    this.currentTime = newTime;

    // Check timeline items that trigger in the window
    this.scenario.timeline.forEach((item, index) => {
      const eventKey = `${index}-${item.t}`;
      const isInitialZero = prevTime === 0 && item.t === 0;
      if (((item.t > prevTime && item.t <= newTime) || isInitialZero) && !this.processedEvents.has(eventKey)) {
        this.processedEvents.add(eventKey);
        this.dispatchEvent(item);
      }
    });

    const state = this.reconstructStateAt(this.currentTime);
    this.emit('state_update', state);
    this.emit('tick', {
      time: this.currentTime,
      duration: this.duration,
      progress: this.currentTime / this.duration,
      simClock: state.simClock,
      state
    });
  }

  /**
   * Scrub directly to any point in time t, reconstructing the exact world state
   */
  seek(targetTime) {
    this.currentTime = Math.max(0, Math.min(targetTime, this.duration));
    this.processedEvents.clear();

    const stateAtTime = this.reconstructStateAt(this.currentTime);

    // Mark passed events (strictly less than currentTime)
    this.scenario.timeline.forEach((item, index) => {
      if (item.t < this.currentTime) {
        this.processedEvents.add(`${index}-${item.t}`);
      }
    });

    this.emit('state_reset', stateAtTime);
    this.emit('tick', {
      time: this.currentTime,
      duration: this.duration,
      progress: this.currentTime / this.duration,
      simClock: stateAtTime.simClock,
      state: stateAtTime
    });
  }

  /**
   * Compute exact SOS lifecycle state at any timestamp t
   * States: QUEUED -> STORED -> TRANSMITTING -> SENT_TO_MESH -> DELIVERED (or FAILED)
   */
  getSosStateAt(sosItem, t) {
    if (t < sosItem.t) return null;

    if (!this.withMesh) {
      return {
        ...sosItem,
        state: 'FAILED',
        hopsCompleted: 0,
        deliveredAt: null,
        reason: 'Phone network DOWN. No cellular or internet route available.'
      };
    }

    const queueWindow = 0.35;
    const storeWindow = 0.70;
    const txWindow = 0.35;
    const hopSeconds = this.scenario.meta.hopSeconds || 1.2;
    const totalHops = sosItem.path.length - 1;

    // 1. Initial QUEUED state
    if (t < sosItem.t + queueWindow) {
      return {
        ...sosItem,
        state: 'QUEUED',
        hopsCompleted: 0,
        progress: 0,
        statusText: 'QUEUED IN APP · Preparing packet'
      };
    }

    const releaseTime = sosItem.holdUntil || (sosItem.t + storeWindow);

    // 2. STORED in Dongle memory (including Store-and-Forward hold)
    if (t < releaseTime) {
      return {
        ...sosItem,
        state: 'STORED',
        hopsCompleted: 0,
        progress: 0,
        statusText: sosItem.holdUntil
          ? 'STORED IN DONGLE · Waiting for aerial mesh...'
          : 'STORED IN DONGLE · ACK received from phone'
      };
    }

    // 3. TRANSMITTING (RF preamble and transmission beginning)
    if (t < releaseTime + txWindow) {
      return {
        ...sosItem,
        state: 'TRANSMITTING',
        hopsCompleted: 0,
        currentHopIndex: 0,
        fromNode: sosItem.path[0],
        toNode: sosItem.path[1],
        hopProgress: (t - releaseTime) / hopSeconds,
        statusText: `TRANSMITTING · Air link to ${sosItem.path[1]}`
      };
    }

    const transitStart = releaseTime + txWindow;
    const totalTransitTime = totalHops * hopSeconds;
    const deliveredAt = transitStart + totalTransitTime;

    // 4. SENT_TO_MESH (Hopping across relays)
    if (t < deliveredAt) {
      const elapsed = t - transitStart;
      const currentHopFloat = elapsed / hopSeconds;
      const hopIdx = Math.min(totalHops - 1, Math.floor(currentHopFloat));
      return {
        ...sosItem,
        state: 'SENT_TO_MESH',
        hopsCompleted: hopIdx,
        currentHopIndex: hopIdx,
        fromNode: sosItem.path[hopIdx],
        toNode: sosItem.path[hopIdx + 1],
        hopProgress: currentHopFloat % 1, // 0..1 along current link
        deliveredAt,
        statusText: `SENT_TO_MESH · Via ${sosItem.path[hopIdx]} → ${sosItem.path[hopIdx + 1]}`
      };
    }

    // 5. DELIVERED at Base Camp
    return {
      ...sosItem,
      state: 'DELIVERED',
      hopsCompleted: totalHops,
      progress: 1,
      deliveredAt,
      statusText: `DELIVERED · Base Camp reached in ${totalHops} hops`
    };
  }

  /**
   * Reconstruct clean snapshot of all nodes, towers, aerials, edges, and SOS at time t
   */
  reconstructStateAt(t) {
    const activeNodes = new Map();
    this.scenario.nodes.forEach(n => {
      activeNodes.set(n.id, {
        ...n,
        status: 'online',
        visible: !n.hidden,
        flightProgress: n.hidden ? 0 : 1,
        batteryStatus: 'Nominal (illustrative)'
      });
    });

    let towersOnline = true;
    let currentPhase = this.scenario.timeline[0];
    let simClock = this.scenario.timeline[0].simClock;
    const activeAerials = { drones: 'idle', balloons: 'idle' };

    this.scenario.timeline.forEach(item => {
      if (item.t <= t) {
        if (item.simClock) simClock = item.simClock;
        if (item.type === 'phase') currentPhase = item;
        if (item.type === 'towers' && item.status === 'offline') towersOnline = false;

        if (item.type === 'node_status' && activeNodes.has(item.id)) {
          activeNodes.get(item.id).status = item.status;
          activeNodes.get(item.id).reason = item.reason;
        }

        // Aerial lifecycle handling in With-Mesh mode
        if (this.withMesh) {
          if (item.type === 'drones_launch') {
            const p = Math.min(1, Math.max(0, (t - item.t) / (item.flightSeconds || 6)));
            activeAerials.drones = p < 1 ? 'launching' : 'online';
            item.ids.forEach(id => {
              if (activeNodes.has(id)) {
                activeNodes.get(id).visible = true;
                activeNodes.get(id).flightProgress = p;
              }
            });
          }

          if (item.type === 'drones_online') {
            activeAerials.drones = 'online';
            item.ids.forEach(id => {
              if (activeNodes.has(id)) {
                activeNodes.get(id).visible = true;
                activeNodes.get(id).flightProgress = 1;
              }
            });
          }

          if (item.type === 'balloons_launch') {
            const p = Math.min(1, Math.max(0, (t - item.t) / (item.riseSeconds || 8)));
            activeAerials.balloons = p < 1 ? 'rising' : 'online';
            item.ids.forEach(id => {
              if (activeNodes.has(id)) {
                activeNodes.get(id).visible = true;
                activeNodes.get(id).flightProgress = p;
              }
            });
          }

          if (item.type === 'balloons_online') {
            activeAerials.balloons = 'online';
            item.ids.forEach(id => {
              if (activeNodes.has(id)) {
                activeNodes.get(id).visible = true;
                activeNodes.get(id).flightProgress = 1;
              }
            });
          }

          if (item.type === 'drones_recall') {
            const p = Math.min(1, Math.max(0, (t - item.t) / (item.flightSeconds || 5)));
            activeAerials.drones = p < 1 ? 'recalling' : 'landed';
            item.ids.forEach(id => {
              if (activeNodes.has(id)) {
                activeNodes.get(id).visible = p < 1;
                activeNodes.get(id).flightProgress = 1 - p;
              }
            });
          }
        }
      }
    });

    // Drone Low-Battery Warning (t=74s to t=83s) before recall
    if (this.withMesh) {
      ['DR1', 'DR2'].forEach(id => {
        if (activeNodes.has(id) && t >= 74 && t <= 83) {
          activeNodes.get(id).batteryStatus = 'LOW (illustrative — returning to base)';
        }
      });
    }

    // Apply dynamic geographic flood inundation rule
    if (activeNodes.has('N3') && t >= 21.5) {
      activeNodes.get('N3').status = 'down';
      activeNodes.get('N3').reason = 'Submerged by Bagmati flash surge (2.8m water)';
    }
    if (activeNodes.has('N6') && t >= 39.5) {
      activeNodes.get('N6').status = 'down';
      activeNodes.get('N6').reason = 'Submerged by downstream flood surge (4.1m water)';
    }

    // Apply manual user overrides (Simulate Disaster / 'K' key)
    this.manualKilledNodes.forEach(id => {
      if (activeNodes.has(id)) {
        activeNodes.get(id).status = 'down';
        activeNodes.get(id).reason = 'Manual disaster trigger';
      }
    });

    // Merge dynamically injected nodes
    this.dynamicNodes.forEach((dynNode, id) => {
      const beacon = this.survivorBeacons.get(id);
      activeNodes.set(id, {
        ...dynNode,
        isAcknowledged: Boolean(beacon?.isAcknowledged),
        storedInFlash: Boolean(beacon?.storedInFlash),
        beaconAttempts: beacon?.beaconAttempts || 0
      });
    });

    // Also update N1 with its survivor beacon status
    const n1Beacon = this.survivorBeacons.get('N1');
    if (activeNodes.has('N1') && n1Beacon) {
      activeNodes.get('N1').isAcknowledged = Boolean(n1Beacon.isAcknowledged);
      activeNodes.get('N1').storedInFlash = Boolean(n1Beacon.storedInFlash);
      activeNodes.get('N1').beaconAttempts = n1Beacon.beaconAttempts || 0;
    }

    // Compute active edges for Map and Sidebar (static edges + dynamic edges)
    const allEdges = [...this.scenario.edges, ...this.dynamicEdges];
    const activeEdges = allEdges.map(edge => {
      const nodeA = activeNodes.get(edge.a);
      const nodeB = activeNodes.get(edge.b);
      const endpointsOnline =
        nodeA && nodeB &&
        nodeA.visible && nodeB.visible &&
        nodeA.status === 'online' && nodeB.status === 'online' &&
        nodeA.flightProgress >= 1 && nodeB.flightProgress >= 1;

      return {
        ...edge,
        active: this.withMesh && Boolean(endpointsOnline)
      };
    });

    // Evaluate all SOS messages up to t (scenario timeline + dynamic user SOS)
    const sosStates = [];
    const deliveredSos = [];
    const allSos = [
      ...this.scenario.timeline.filter(item => item.type === 'sos'),
      ...this.dynamicSosList
    ];
    allSos.forEach(sosItem => {
      if (sosItem.isDynamic) {
        sosStates.push(sosItem);
        if (sosItem.state === 'DELIVERED') deliveredSos.push(sosItem);
      } else {
        const s = this.getSosStateAt(sosItem, t);
        if (s) {
          sosStates.push(s);
          if (s.state === 'DELIVERED') deliveredSos.push(s);
        }
      }
    });

    return {
      t,
      simClock,
      phase: currentPhase,
      towersOnline,
      nodes: Array.from(activeNodes.values()),
      edges: activeEdges,
      aerials: activeAerials,
      sosStates,
      deliveredSos,
      withMesh: this.withMesh
    };
  }

  /**
   * Dispatch single timeline event to listeners
   */
  dispatchEvent(item) {
    if (!this.withMesh) {
      if (item.type === 'sos') {
        this.emit('sos_failed', {
          id: item.id,
          reason: 'Phone network DOWN. No cellular or internet route available.',
          simClock: item.simClock
        });
        return;
      }
      if (item.type === 'drones_launch' || item.type === 'balloons_launch') {
        return;
      }
    }

    switch (item.type) {
      case 'phase':
        this.emit('phase', item);
        break;
      case 'towers':
        this.emit('towers', item);
        break;
      case 'node_status':
        this.emit('node_status', item);
        break;
      case 'sos':
        this.emit('sos', item);
        break;
      case 'drones_launch':
      case 'drones_online':
      case 'drones_recall':
      case 'balloons_launch':
      case 'balloons_online':
        this.emit('aerial', item);
        break;
      case 'summary':
        this.emit('summary', item);
        break;
      default:
        this.emit(item.type, item);
    }
  }
}
