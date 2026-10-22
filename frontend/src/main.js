import './hud.css';
import L from 'leaflet';

// 1. Initialize Leaflet Map centered over a sample disaster relief grid
// 1. Initialize Leaflet Map centered over Central India (Nagpur/Bhopal region: 21.1458° N, 79.0882° E)
const map = L.map('map', {
  center: [21.1458, 79.0882],
  zoom: 11,
  minZoom: 6,
  maxZoom: 16,
  zoomControl: false
});

// Minimal, clean top-right zoom control
L.control.zoom({ position: 'topright' }).addTo(map);

// 2. Load ESRI World Dark Gray Base (Clean, professional dark map with streets & borders, 100% keyless)
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
  attribution: '&copy; Esri, DeLorme, NAVTEQ',
  maxZoom: 16
}).addTo(map);

// Metric scale bar in bottom-left
L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 150 }).addTo(map);

// ---------------------------------------------------------------------------
// 3. TACTICAL GRID LAYER (Smooth, Non-Glitchy Canvas Grid @ 5 km)
// ---------------------------------------------------------------------------
// 1 degree latitude ≈ 111 km. Therefore, 5 km ≈ (5 / 111) ≈ 0.045045 degrees.
export const GRID_CONFIG = {
  enabled: true,
  cellSizeKm: 5,                       // Exactly 5 km point-to-point
  spacingDeg: 5 / 111.0,               // ~0.04505 degrees
  lineColor: 'rgba(160, 175, 200, 0.12)', // Subtle tone-matched dark slate-gray
  lineWidth: 1
};

// Custom Leaflet GridLayer using native HTML5 Canvas (Eliminates all zoom/scroll glitches)
const TacticalGridLayer = L.GridLayer.extend({
  createTile: function (coords) {
    const tile = document.createElement('canvas');
    const tileSize = this.getTileSize();
    tile.width = tileSize.x;
    tile.height = tileSize.y;
    const ctx = tile.getContext('2d');

    if (!GRID_CONFIG.enabled) return tile;

    // Get real geographic bounds of this tile
    const nwPoint = coords.scaleBy(tileSize);
    const sePoint = nwPoint.add(tileSize);
    const nw = map.unproject(nwPoint, coords.z);
    const se = map.unproject(sePoint, coords.z);

    const step = GRID_CONFIG.spacingDeg;
    const startLat = Math.floor(se.lat / step) * step;
    const endLat = Math.ceil(nw.lat / step) * step;
    const startLng = Math.floor(nw.lng / step) * step;
    const endLng = Math.ceil(se.lng / step) * step;

    ctx.strokeStyle = GRID_CONFIG.lineColor;
    ctx.lineWidth = GRID_CONFIG.lineWidth;
    ctx.setLineDash([3, 4]); // Crisp tactical dash

    // Draw horizontal grid lines (Latitude)
    for (let lat = startLat; lat <= endLat; lat += step) {
      const p = map.project([lat, nw.lng], coords.z).subtract(nwPoint);
      ctx.beginPath();
      ctx.moveTo(0, p.y);
      ctx.lineTo(tileSize.x, p.y);
      ctx.stroke();
    }

    // Draw vertical grid lines (Longitude)
    for (let lng = startLng; lng <= endLng; lng += step) {
      const p = map.project([nw.lat, lng], coords.z).subtract(nwPoint);
      ctx.beginPath();
      ctx.moveTo(p.x, 0);
      ctx.lineTo(p.x, tileSize.y);
      ctx.stroke();
    }

    return tile;
  }
});

new TacticalGridLayer({ pane: 'overlayPane', opacity: 1 }).addTo(map);

console.log('LoRa Mesh Dashboard centered over India with 5 km smooth tactical grid.');