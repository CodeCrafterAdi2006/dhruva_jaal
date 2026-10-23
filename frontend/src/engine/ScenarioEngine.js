// Deterministic 100-Second Scenario Playback Engine (Production Refinement)
// Sourced from scenario.json, simulation_plan.md, and master_execution_plan.md

import { DataSource } from './DataSource.js';
import scenarioData from '../data/scenario.json';
import { MeshOptimizer } from './MeshOptimizer.js';

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
    this.manualAerialDeployed = new Set();
    this.manualAerialTrigger = null; // 'drones' | 'balloons'

    // Algorithmic Gap Optimizer
    this.meshOptimizer = new MeshOptimizer(this.scenario.nodes);

    // Dynamic Survivor & Relay Node Injection (Interactive Sandbox)
    this.dynamicNodes = new Map();
    this.dynamicDrones = new Map();
    this.dynamicBalloons = new Map();
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
    this.manualAerialDeployed.clear();
    this.manualAerialTrigger = null;
    this.dynamicDrones.clear();
    this.dynamicBalloons.clear();
    this.dynamicEdges = [];
    this.dynamicSosList = [];
    this.seek(0);
    this.play();
  }

  /**
   * Tactical Sandbox: Submerge Relay Node on Click (User clicks Submerge Relay tool, then clicks relay)
   */
  submergeRelay(nodeId) {
    if (!nodeId) return null;
    this.manualKilledNodes.add(nodeId);
    this.emit('node_status', {
      id: nodeId,
      status: 'down',
      reason: 'Submerged by rising floodwaters'
    });

    // Re-check all active survivor beacons to see if routes are broken or need re-routing
    const state = this.reconstructStateAt(this.currentTime);
    this.survivorBeacons.forEach(survivor => {
      if (survivor.id !== 'N1' && !survivor.isAcknowledged) {
        const path = this.findShortestPath(survivor.id, 'N8', state);
        if (!path) {
          survivor.storedInFlash = true;
        }
      }
    });

    const updatedState = this.reconstructStateAt(this.currentTime);
    this.emit('state_update', updatedState);
    return nodeId;
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
      return this.submergeRelay(nextTarget);
    }
    return null;
  }

  /**
   * Tactical Sandbox: Deploy Airborne Drone to precise clicked [lon, lat] coordinates
   */
  dispatchDroneTo(lon, lat, options = {}) {
    const count = this.dynamicDrones.size + 1;
    const id = options.id || `DR-${count}`;
    const baseCamp = this.scenario.nodes.find(n => n.id === 'N8') || { lon: 85.3160, lat: 27.7020 };

    const drone = {
      id,
      role: 'drone',
      label: options.label || `DRONE ${count}`,
      sublabel: options.targetZone || 'Airborne Relay',
      place: `Airborne (80m) at ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      lat,
      lon,
      alt_m: 80,
      status: 'online',
      visible: true,
      flightProgress: 0,
      isDynamic: true,
      takeoffTime: performance.now(),
      basePos: [baseCamp.lon, baseCamp.lat],
      targetPos: [lon, lat]
    };

    this.dynamicDrones.set(id, drone);

    // Form aerial links (2500m LoRa line-of-sight range)
    const allLivingNodes = [
      ...this.scenario.nodes.filter(n => n.role !== 'drone' && n.role !== 'balloon'),
      ...Array.from(this.dynamicNodes.values()),
      baseCamp
    ];

    allLivingNodes.forEach(neighbor => {
      const dist = this.calculateDistanceMeters(lon, lat, neighbor.lon, neighbor.lat);
      if (dist <= 2500) {
        const rawRssi = -60 - 20 * Math.log10(Math.max(1, dist) / 100);
        const baseRssi = Math.max(-110, Math.min(-62, Math.round(rawRssi)));
        this.dynamicEdges.push({
          a: id,
          b: neighbor.id,
          baseRssi,
          droneLink: true,
          isDynamic: true
        });
      }
    });

    this.emit('aerial', {
      type: 'drones_launch',
      ids: [id],
      simClock: 'SANDBOX DISPATCH'
    });

    // Animate flight progress from Base Camp to target
    const startTime = performance.now();
    const duration = 1200; // 1.2s smooth tactical flight
    const animateFlight = (now) => {
      const p = Math.min(1, (now - startTime) / duration);
      drone.flightProgress = p;
      if (p < 1) {
        requestAnimationFrame(animateFlight);
      } else {
        drone.flightProgress = 1;
        this.emit('aerial', {
          type: 'drones_online',
          ids: [id],
          simClock: 'SANDBOX ACTIVE'
        });
        this.checkSurvivorBeacons();
      }
      this.emit('state_update', this.reconstructStateAt(this.currentTime));
    };
    requestAnimationFrame(animateFlight);

    return drone;
  }

  /**
   * Tactical Sandbox: Deploy Tethered Aerostat Balloon to precise clicked [lon, lat] coordinates
   * If a drone is stationed at/near this spot, recall that drone to Base Camp!
   */
  dispatchBalloonTo(lon, lat, options = {}) {
    const count = this.dynamicBalloons.size + 1;
    const id = options.id || `BL-${count}`;

    // Check if any drone is within 600m of this spot -> Handover & Recall drone!
    this.dynamicDrones.forEach((drone, droneId) => {
      const d = this.calculateDistanceMeters(lon, lat, drone.lon, drone.lat);
      if (d <= 600 && drone.status === 'online') {
        drone.status = 'recalling';
        this.emit('aerial', {
          type: 'drones_recall',
          ids: [droneId],
          simClock: 'HANDOVER COMPLETE'
        });
        setTimeout(() => {
          this.dynamicDrones.delete(droneId);
          this.dynamicEdges = this.dynamicEdges.filter(e => e.a !== droneId && e.b !== droneId);
          this.emit('state_update', this.reconstructStateAt(this.currentTime));
        }, 1500);
      }
    });

    const balloon = {
      id,
      role: 'balloon',
      label: options.label || `BALLOON ${count}`,
      sublabel: '100m Aerostat',
      place: `Tethered Aerostat (100m) at ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      lat,
      lon,
      alt_m: 100,
      tethered: true,
      status: 'online',
      visible: true,
      flightProgress: 0,
      isDynamic: true
    };

    this.dynamicBalloons.set(id, balloon);

    // Form high-altitude balloon links (3500m LoRa line-of-sight range)
    const baseCamp = this.scenario.nodes.find(n => n.id === 'N8') || { lon: 85.3160, lat: 27.7020 };
    const allLivingNodes = [
      ...this.scenario.nodes.filter(n => n.role !== 'drone' && n.role !== 'balloon'),
      ...Array.from(this.dynamicNodes.values()),
      baseCamp
    ];

    allLivingNodes.forEach(neighbor => {
      const dist = this.calculateDistanceMeters(lon, lat, neighbor.lon, neighbor.lat);
      if (dist <= 3500) {
        const rawRssi = -58 - 20 * Math.log10(Math.max(1, dist) / 100);
        const baseRssi = Math.max(-110, Math.min(-60, Math.round(rawRssi)));
        this.dynamicEdges.push({
          a: id,
          b: neighbor.id,
          baseRssi,
          balloonLink: true,
          isDynamic: true
        });
      }
    });

    this.emit('aerial', {
      type: 'balloons_launch',
      ids: [id],
      simClock: 'SANDBOX ASCENT'
    });

    // Animate balloon vertical rise
    const startTime = performance.now();
    const duration = 1500;
    const animateRise = (now) => {
      const p = Math.min(1, (now - startTime) / duration);
      balloon.flightProgress = p;
      if (p < 1) {
        requestAnimationFrame(animateRise);
      } else {
        balloon.flightProgress = 1;
        this.emit('aerial', {
          type: 'balloons_online',
          ids: [id],
          simClock: 'AEROSTAT ONLINE'
        });
        this.checkSurvivorBeacons();
      }
      this.emit('state_update', this.reconstructStateAt(this.currentTime));
    };
    requestAnimationFrame(animateRise);

    return balloon;
  }

  /**
   * Tactical Sandbox: Algorithmic Gap Detection & Automatic Aerial Dispatch
   * Uses MeshOptimizer to compute disconnect gaps and dispatch needed drones
   */
  autoBridgeGaps() {
    const state = this.reconstructStateAt(this.currentTime);
    const gaps = this.meshOptimizer.detectCoverageGaps(state.nodes, state.edges, 'N8');
    if (!gaps || gaps.length === 0) {
      return { needed: 0, drones: [] };
    }

    const dispatched = [];
    gaps.forEach((gap) => {
      const drone = this.dispatchDroneTo(gap.lon, gap.lat, {
        label: `DRONE ${this.dynamicDrones.size + 1}`,
        targetZone: gap.targetZone
      });
      dispatched.push({ drone, gap });

      // After 7 seconds, automatically launch balloon to relieve the drone!
      setTimeout(() => {
        if (this.dynamicDrones.has(drone.id)) {
          this.dispatchBalloonTo(gap.lon, gap.lat, {
            label: `BALLOON ${this.dynamicBalloons.size + 1}`
          });
        }
      }, 7000);
    });

    return { needed: gaps.length, drones: dispatched };
  }

  /**
   * Tactical Sandbox: Legacy deploy helper
   */
  deployAerial(type = 'drone') {
    if (type === 'drone') {
      const targetLon = 85.3060;
      const targetLat = 27.6950;
      return [this.dispatchDroneTo(targetLon, targetLat)];
    } else {
      const targetLon = 85.3060;
      const targetLat = 27.6950;
      return [this.dispatchBalloonTo(targetLon, targetLat)];
    }
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
      // N1 is controlled deterministically by scenario timeline; skip in background loop
      if (survivor.id === 'N1' || survivor.isAcknowledged) return;

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
   * With two-way ACK flight tracking: isAckInFlight, ackFromNode, ackToNode, ackHopProgress, ackDeliveredAt
   */
  getSosStateAt(sosItem, t) {
    if (t < sosItem.t) return null;

    if (!this.withMesh) {
      return {
        ...sosItem,
        state: 'FAILED',
        hopsCompleted: 0,
        deliveredAt: null,
        isAckInFlight: false,
        isAckDelivered: false,
        reason: 'Cellular grid DOWN. Zero LoRa mesh coverage in Without-Mesh mode.'
      };
    }

    const hopSeconds = this.scenario.meta.hopSeconds || 1.2;

    // ── SPECIFIC NARRATIVE TIMELINE: SOS1 (Part 1: Baseline Health) ─────────────
    if (sosItem.id === 'SOS1') {
      const qEnd = 2.0 + 0.35; // 2.35
      const sEnd = 2.0 + 1.05; // 3.05
      const fwdTotalHops = 4; // N1->N2->N3->N4->N8
      const fwdDeliveredAt = sEnd + fwdTotalHops * hopSeconds; // 3.05 + 4.8 = 7.85
      const ackPath = sosItem.ackPath || ['N8', 'N4', 'N3', 'N2', 'N1'];
      const ackTotalHops = ackPath.length - 1; // 4
      const ackDeliveredAt = fwdDeliveredAt + ackTotalHops * hopSeconds; // 7.85 + 4.8 = 12.65

      if (t < qEnd) {
        return {
          ...sosItem,
          state: 'QUEUED',
          hopsCompleted: 0,
          progress: 0,
          isAckInFlight: false,
          isAckDelivered: false,
          statusText: 'QUEUED IN APP · Preparing packet'
        };
      }
      if (t < sEnd) {
        return {
          ...sosItem,
          state: 'STORED',
          hopsCompleted: 0,
          progress: 0,
          isAckInFlight: false,
          isAckDelivered: false,
          statusText: 'STORED IN DONGLE FLASH · Preamble broadcast'
        };
      }
      if (t < fwdDeliveredAt) {
        const elapsed = t - sEnd;
        const hopFloat = elapsed / hopSeconds;
        const hopIdx = Math.min(fwdTotalHops - 1, Math.floor(hopFloat));
        return {
          ...sosItem,
          state: 'SENT_TO_MESH',
          hopsCompleted: hopIdx,
          currentHopIndex: hopIdx,
          fromNode: sosItem.path[hopIdx],
          toNode: sosItem.path[hopIdx + 1],
          hopProgress: hopFloat % 1,
          deliveredAt: fwdDeliveredAt,
          isAckInFlight: false,
          isAckDelivered: false,
          statusText: `SENT_TO_MESH · Via ${sosItem.path[hopIdx]} → ${sosItem.path[hopIdx + 1]}`
        };
      }
      if (t < ackDeliveredAt) {
        const ackElapsed = t - fwdDeliveredAt;
        const ackHopFloat = ackElapsed / hopSeconds;
        const ackHopIdx = Math.min(ackTotalHops - 1, Math.floor(ackHopFloat));
        return {
          ...sosItem,
          state: 'DELIVERED',
          hopsCompleted: fwdTotalHops,
          progress: 1,
          deliveredAt: fwdDeliveredAt,
          ackDeliveredAt,
          isAckInFlight: true,
          isAckDelivered: false,
          ackFromNode: ackPath[ackHopIdx],
          ackToNode: ackPath[ackHopIdx + 1],
          ackHopProgress: ackHopFloat % 1,
          statusText: `DELIVERED TO HQ · ACK returning via relay (${ackPath[ackHopIdx]} → ${ackPath[ackHopIdx + 1]})`
        };
      }
      return {
        ...sosItem,
        state: 'DELIVERED',
        hopsCompleted: fwdTotalHops,
        progress: 1,
        deliveredAt: fwdDeliveredAt,
        ackDeliveredAt,
        isAckInFlight: false,
        isAckDelivered: true,
        statusText: 'DELIVERED & ACKNOWLEDGED · Two-way rescue confirmed'
      };
    }

    // ── SPECIFIC NARRATIVE TIMELINE: SOS2 (Parts 2-4: Flood, Drone, Balloon ACK) ─
    if (sosItem.id === 'SOS2') {
      const qEnd = 24.0 + 0.35; // 24.35
      const sEnd = 24.0 + 1.05; // 25.05
      const hop0End = sEnd + 1 * hopSeconds; // 25.05 + 1.2 = 26.25 (N1 -> N2)
      const droneBridgeStart = 38.0; // Drone online, releases stored message from N2
      const bridgeHops = 3; // N2->DR1->N4->N8
      const fwdDeliveredAt = droneBridgeStart + bridgeHops * hopSeconds; // 38.0 + 3.6 = 41.6
      const balloonAckStart = 54.0; // After Balloon BL1 ascends to 100m (t=52) and DR1 returns
      const ackPath = sosItem.ackPath || ['N8', 'N4', 'BL1', 'N2', 'N1'];
      const ackTotalHops = ackPath.length - 1; // 4
      const ackDeliveredAt = balloonAckStart + ackTotalHops * hopSeconds; // 54.0 + 4.8 = 58.8

      if (t < qEnd) {
        return {
          ...sosItem,
          state: 'QUEUED',
          hopsCompleted: 0,
          isAckInFlight: false,
          isAckDelivered: false,
          statusText: 'QUEUED IN APP · Periodic beacon #2'
        };
      }
      if (t < sEnd) {
        return {
          ...sosItem,
          state: 'STORED',
          hopsCompleted: 0,
          isAckInFlight: false,
          isAckDelivered: false,
          statusText: 'STORED IN DONGLE FLASH · Transmitting to N2'
        };
      }
      if (t < hop0End) {
        const p = (t - sEnd) / hopSeconds;
        return {
          ...sosItem,
          state: 'SENT_TO_MESH',
          hopsCompleted: 0,
          fromNode: 'N1',
          toNode: 'N2',
          hopProgress: p,
          isAckInFlight: false,
          isAckDelivered: false,
          statusText: 'SENT_TO_MESH · N1 → N2 (Balkhu Market)'
        };
      }
      if (t < droneBridgeStart) {
        // HELD AT N2 BECAUSE N3 IS SUBMERGED!
        return {
          ...sosItem,
          state: 'STORED',
          hopsCompleted: 1,
          storedAtNode: 'N2',
          isAckInFlight: false,
          isAckDelivered: false,
          statusText: 'STORED IN RELAY N2 FLASH · Bridge submerged, awaiting aerial drone'
        };
      }
      if (t < fwdDeliveredAt) {
        const elapsed = t - droneBridgeStart;
        const hopFloat = elapsed / hopSeconds;
        const hopOffset = Math.min(bridgeHops - 1, Math.floor(hopFloat));
        const currentHopIdx = 1 + hopOffset; // 1: N2->DR1, 2: DR1->N4, 3: N4->N8
        return {
          ...sosItem,
          state: 'SENT_TO_MESH',
          hopsCompleted: currentHopIdx,
          currentHopIndex: currentHopIdx,
          fromNode: sosItem.path[currentHopIdx],
          toNode: sosItem.path[currentHopIdx + 1],
          hopProgress: hopFloat % 1,
          deliveredAt: fwdDeliveredAt,
          isAckInFlight: false,
          isAckDelivered: false,
          statusText: `SENT_TO_MESH · Aerial bridge (${sosItem.path[currentHopIdx]} → ${sosItem.path[currentHopIdx + 1]})`
        };
      }
      if (t < balloonAckStart) {
        // DELIVERED TO HQ, AWAITING BALLOON HANDOVER BEFORE TRANSMITTING ACK!
        return {
          ...sosItem,
          state: 'DELIVERED',
          hopsCompleted: 4,
          progress: 1,
          deliveredAt: fwdDeliveredAt,
          isAckInFlight: false,
          isAckDelivered: false,
          statusText: 'DELIVERED TO HQ · Awaiting aerostat balloon handover before ACK'
        };
      }
      if (t < ackDeliveredAt) {
        // ACK TRANSMITTED THROUGH BALLOON BACKBONE!
        const ackElapsed = t - balloonAckStart;
        const ackHopFloat = ackElapsed / hopSeconds;
        const ackHopIdx = Math.min(ackTotalHops - 1, Math.floor(ackHopFloat));
        return {
          ...sosItem,
          state: 'DELIVERED',
          hopsCompleted: 4,
          progress: 1,
          deliveredAt: fwdDeliveredAt,
          ackDeliveredAt,
          isAckInFlight: true,
          isAckDelivered: false,
          ackFromNode: ackPath[ackHopIdx],
          ackToNode: ackPath[ackHopIdx + 1],
          ackHopProgress: ackHopFloat % 1,
          statusText: `HQ DELIVERED · ACK returning via balloon backbone (${ackPath[ackHopIdx]} → ${ackPath[ackHopIdx + 1]})`
        };
      }
      return {
        ...sosItem,
        state: 'DELIVERED',
        hopsCompleted: 4,
        progress: 1,
        deliveredAt: fwdDeliveredAt,
        ackDeliveredAt,
        isAckInFlight: false,
        isAckDelivered: true,
        statusText: 'DELIVERED & ACKNOWLEDGED · Two-way rescue confirmed via balloon'
      };
    }

    // ── FALLBACK FOR GENERIC / DYNAMIC SOS ────────────────────────────────────
    const qEnd = sosItem.t + 0.35;
    const sEnd = sosItem.t + 0.70;
    const totalHops = sosItem.path.length - 1;
    const transitStart = sEnd;
    const deliveredAt = transitStart + totalHops * hopSeconds;
    const ackPath = sosItem.ackPath || [...sosItem.path].reverse();
    const ackHops = ackPath.length - 1;
    const ackDeliveredAt = deliveredAt + ackHops * hopSeconds;

    if (t < qEnd) {
      return { ...sosItem, state: 'QUEUED', hopsCompleted: 0, isAckInFlight: false, isAckDelivered: false };
    }
    if (t < sEnd) {
      return { ...sosItem, state: 'STORED', hopsCompleted: 0, isAckInFlight: false, isAckDelivered: false };
    }
    if (t < deliveredAt) {
      const elapsed = t - transitStart;
      const hopFloat = elapsed / hopSeconds;
      const hopIdx = Math.min(totalHops - 1, Math.floor(hopFloat));
      return {
        ...sosItem,
        state: 'SENT_TO_MESH',
        hopsCompleted: hopIdx,
        fromNode: sosItem.path[hopIdx],
        toNode: sosItem.path[hopIdx + 1],
        hopProgress: hopFloat % 1,
        deliveredAt,
        isAckInFlight: false,
        isAckDelivered: false
      };
    }
    if (t < ackDeliveredAt) {
      const ackElapsed = t - deliveredAt;
      const ackHopFloat = ackElapsed / hopSeconds;
      const ackHopIdx = Math.min(ackHops - 1, Math.floor(ackHopFloat));
      return {
        ...sosItem,
        state: 'DELIVERED',
        hopsCompleted: totalHops,
        deliveredAt,
        ackDeliveredAt,
        isAckInFlight: true,
        isAckDelivered: false,
        ackFromNode: ackPath[ackHopIdx],
        ackToNode: ackPath[ackHopIdx + 1],
        ackHopProgress: ackHopFloat % 1
      };
    }
    return {
      ...sosItem,
      state: 'DELIVERED',
      hopsCompleted: totalHops,
      deliveredAt,
      ackDeliveredAt,
      isAckInFlight: false,
      isAckDelivered: true
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
      ['DR1', 'DR2', 'DR3', 'DR4'].forEach(id => {
        if (activeNodes.has(id) && t >= 74 && t <= 83) {
          activeNodes.get(id).batteryStatus = 'LOW (illustrative — returning to base)';
        }
      });
    }

    // Apply dynamic geographic flood inundation rule (from scenario)
    if (activeNodes.has('N3') && t >= 21.0) {
      activeNodes.get('N3').status = 'down';
      activeNodes.get('N3').reason = 'Submerged by Bagmati flash surge (3.2m water)';
    }

    // Apply manual user overrides (Simulate Disaster / 'K' key / Submerge Relay Tool)
    this.manualKilledNodes.forEach(id => {
      if (activeNodes.has(id)) {
        activeNodes.get(id).status = 'down';
        activeNodes.get(id).reason = 'Manual disaster trigger';
      }
    });

    // Apply manual aerial deployments (Tactical Sandbox)
    this.manualAerialDeployed.forEach(id => {
      if (activeNodes.has(id)) {
        activeNodes.get(id).visible = true;
        activeNodes.get(id).status = 'online';
        activeNodes.get(id).flightProgress = 1;
      }
    });

    // Merge dynamically injected nodes (Tactical Sandbox)
    this.dynamicNodes.forEach((dynNode, id) => {
      const beacon = this.survivorBeacons.get(id);
      activeNodes.set(id, {
        ...dynNode,
        isAcknowledged: Boolean(beacon?.isAcknowledged),
        storedInFlash: Boolean(beacon?.storedInFlash),
        beaconAttempts: beacon?.beaconAttempts || 0
      });
    });

    // Merge dynamically injected drones and balloons (Tactical Sandbox)
    this.dynamicDrones.forEach((drone, id) => {
      activeNodes.set(id, { ...drone });
    });
    this.dynamicBalloons.forEach((balloon, id) => {
      activeNodes.set(id, { ...balloon });
    });

    // N1 survivor distress cycles across timeline parts:
    // - t < 12.65: Active distress before SOS1 ACK arrives (RED)
    // - 12.65 <= t < 18.0: SOS1 confirmed by ACK arrival at N1 (GREEN)
    // - 18.0 <= t < 58.8: Reset to RED for Part 2! Message gets stuck at N2, drone bridges, balloon takes over
    // - t >= 58.8: Balloon ACK arrives at N1! Confirmed (GREEN)
    if (activeNodes.has('N1')) {
      let isN1Ack = false;
      if (this.withMesh) {
        if (t >= 12.65 && t < 18.0) {
          isN1Ack = true;
        } else if (t >= 58.8) {
          isN1Ack = true;
        }
      }
      activeNodes.get('N1').isAcknowledged = isN1Ack;
      const n1Beacon = this.survivorBeacons.get('N1');
      activeNodes.get('N1').storedInFlash = Boolean(n1Beacon?.storedInFlash);
      activeNodes.get('N1').beaconAttempts = n1Beacon?.beaconAttempts || 0;
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
