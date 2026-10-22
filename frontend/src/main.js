import './hud.css';
import { MapManager } from './map/MapManager.js';
import { ScenarioEngine } from './engine/ScenarioEngine.js';

// 1. Initialize MapManager (Kathmandu 3D tilted map with flood & safe zones)
const mapManager = new MapManager('map');
const engine = new ScenarioEngine();

mapManager.init().then(map => {
  console.log('Dhruva Jaal: Map viewport ready.');
  
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

  engine.on('state_update', updateAlert);
  engine.on('state_reset', updateAlert);

  engine.init();
});

// Expose on window for easy browser console inspection
window.mapManager = mapManager;
window.engine = engine;