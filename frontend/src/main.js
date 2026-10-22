import './hud.css';
import { MapManager } from './map/MapManager.js';
import { ScenarioEngine } from './engine/ScenarioEngine.js';
import { NodeLayer } from './map/NodeLayer.js';
import { LinkPacketLayer } from './map/LinkPacketLayer.js';

// 1. Initialize MapManager (Kathmandu 3D tilted map with flood & safe zones)
const mapManager = new MapManager('map');
const engine = new ScenarioEngine();

mapManager.init().then(map => {
  console.log('Dhruva Jaal: Map viewport ready.');
  
  // Phase 4: NodeLayer (Cell Towers, Ground Nodes, Aerial Relays)
  const nodeLayer = new NodeLayer(map);
  nodeLayer.init();

  // Phase 5: LinkPacketLayer (Dynamic Links & 60fps Packet Pulses)
  const linkPacketLayer = new LinkPacketLayer(map);
  linkPacketLayer.init();

  // Step 3.3: Tactical Compass hook (rotates dial so 'N' points true North)
  const compassDial = document.getElementById('compass-dial');
  const compassWidget = document.getElementById('compass-widget');
  if (compassDial) {
    const updateCompass = () => {
      const bearing = map.getBearing();
      compassDial.style.transform = `rotate(${-bearing}deg)`;
    };
    map.on('rotate', updateCompass);
    updateCompass(); // Initial alignment
  }

  // Click compass to smoothly reset back to initial incident overview perspective
  if (compassWidget) {
    compassWidget.addEventListener('click', () => {
      map.easeTo({ bearing: -15, pitch: 52, duration: 800 });
    });
  }

  // Step 3.3: Network Alert Banner hook (triggers at t=6s when towersOnline === false)
  const alertBanner = document.getElementById('network-alert-banner');
  const updateAlert = (state) => {
    if (alertBanner) {
      alertBanner.classList.toggle('visible', !state.towersOnline);
    }
  };

  engine.on('state_update', (state) => {
    updateAlert(state);
    nodeLayer.update(state);
    linkPacketLayer.update(state);
  });

  engine.on('state_reset', (state) => {
    updateAlert(state);
    nodeLayer.update(state);
    linkPacketLayer.update(state);
  });

  // Step 7.2: With Mesh / Without Mesh header toggles
  const btnWithMesh = document.getElementById('btn-with-mesh');
  const btnWithoutMesh = document.getElementById('btn-without-mesh');
  if (btnWithMesh && btnWithoutMesh) {
    btnWithMesh.addEventListener('click', () => {
      btnWithMesh.classList.add('active');
      btnWithoutMesh.classList.remove('active');
      engine.setWithMesh(true);
    });
    btnWithoutMesh.addEventListener('click', () => {
      btnWithoutMesh.classList.add('active');
      btnWithMesh.classList.remove('active');
      engine.setWithMesh(false);
    });
  }

  // Step 7.1: Simulate Disaster & Reset Network buttons
  const btnSimulate = document.getElementById('btn-simulate');
  if (btnSimulate) {
    btnSimulate.addEventListener('click', () => {
      const killed = engine.killNextNode();
      console.log('Simulate Disaster: manual kill ->', killed);
    });
  }

  const btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      engine.restart();
    });
  }

  // Step 7.4: Keyboard shortcuts (Space = Play/Pause, K = Kill node, R = Restart)
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (engine.isPlaying) engine.pause();
      else engine.play();
    } else if (e.key === 'k' || e.key === 'K') {
      engine.killNextNode();
    } else if (e.key === 'r' || e.key === 'R') {
      engine.restart();
    }
  });

  engine.init();

  // Auto-play the scenario after 1.5 seconds so judges immediately see live packet flow
  setTimeout(() => {
    if (!engine.isPlaying) {
      engine.play();
      console.log('Dhruva Jaal: Scenario playback auto-started.');
    }
  }, 1500);

  window.nodeLayer = nodeLayer;
  window.linkPacketLayer = linkPacketLayer;
});

// Expose on window for easy browser console inspection
window.mapManager = mapManager;
window.engine = engine;