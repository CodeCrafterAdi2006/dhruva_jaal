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
  }

  init() {
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

    // Apply manual user overrides (Simulate Disaster / 'K' key)
    this.manualKilledNodes.forEach(id => {
      if (activeNodes.has(id)) {
        activeNodes.get(id).status = 'down';
        activeNodes.get(id).reason = 'Manual disaster trigger';
      }
    });

    // Compute active edges for Map and Sidebar
    const activeEdges = this.scenario.edges.map(edge => {
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

    // Evaluate all SOS messages up to t
    const sosStates = [];
    const deliveredSos = [];
    this.scenario.timeline
      .filter(item => item.type === 'sos')
      .forEach(sosItem => {
        const s = this.getSosStateAt(sosItem, t);
        if (s) {
          sosStates.push(s);
          if (s.state === 'DELIVERED') deliveredSos.push(s);
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
