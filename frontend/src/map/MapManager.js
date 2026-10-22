import scenarioData from '../data/scenario.json';

// Use global maplibregl from window (loaded cleanly with pre-packaged worker)
const getMapLibre = () => window.maplibregl;

export class MapManager {
  constructor(containerId = 'map') {
    this.containerId = containerId;
    this.map = null;
    this.scenario = scenarioData;
    this.isOfflineMode = false;
  }

  init() {
    const { center, zoom, pitch, bearing } = this.scenario.meta.map;

    // Free, high-contrast Dark Raster Style (ESRI Dark Gray Canvas - zero API key, zero watermarks)
    const darkStyle = {
      version: 8,
      sources: {
        'esri-dark': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: '&copy; Esri, DeLorme, NAVTEQ'
        }
      },
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: { 'background-color': '#0B1220' }
        },
        {
          id: 'dark-tiles',
          type: 'raster',
          source: 'esri-dark',
          minzoom: 0,
          maxzoom: 16
        }
      ]
    };

    const ML = getMapLibre();
    this.map = new ML.Map({
      container: this.containerId,
      style: darkStyle,
      center: [center.lon, center.lat], // MapLibre takes [longitude, latitude]
      zoom: zoom || 14.3,
      pitch: pitch || 52,               // 52-degree 3D tilted camera angle
      bearing: bearing || -15,          // Oriented toward Bagmati basin
      attributionControl: false
    });

    // Add minimal scale bar & navigation
    this.map.addControl(new ML.AttributionControl({ compact: true }), 'bottom-right');
    this.map.addControl(new ML.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');

    this.map.on('error', (e) => {
      // Ignore routine raster tile edge misses
      if (e.sourceId === 'esri-basemap') return;
      if (e.error) {
        console.debug('[MapManager] MapLibre event:', e.error.message || e.error);
      }
    });

    this.renderZones();
    return Promise.resolve(this.map);
  }

  /**
   * Render Flood Zone Polygon (FZ1) and Safe Ground Circle (SZ1)
   */
  renderZones() {
    if (!this.map) return;
    try {
      if (this.map.getSource('flood-zone-source')) return; // Already rendered

    // 1. Flood Zone Polygon (FZ1 along Bagmati River Basin)
    const floodZone = this.scenario.zones.find(z => z.type === 'flood');
    if (floodZone) {
      const coordinates = floodZone.polygon.map(p => [p.lon, p.lat]);
      // Close polygon loop
      coordinates.push([floodZone.polygon[0].lon, floodZone.polygon[0].lat]);

      this.map.addSource('flood-zone-source', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { label: floodZone.label },
          geometry: {
            type: 'Polygon',
            coordinates: [coordinates]
          }
        }
      });

      // Translucent deep water fill
      this.map.addLayer({
        id: 'flood-zone-fill',
        type: 'fill',
        source: 'flood-zone-source',
        paint: {
          'fill-color': '#1a4a8a',
          'fill-opacity': 0.22
        }
      });

      // Glowing dashed boundary line
      this.map.addLayer({
        id: 'flood-zone-line',
        type: 'line',
        source: 'flood-zone-source',
        paint: {
          'line-color': '#2a8af6',
          'line-width': 1.8,
          'line-dasharray': [3, 3],
          'line-opacity': 0.85
        }
      });
    }

    // 2. Safe Ground Circle (SZ1 around Base Camp N8)
    const safeZone = this.scenario.zones.find(z => z.type === 'safe');
    if (safeZone) {
      const circleGeoJSON = this.createGeoJSONCircle(
        [safeZone.center.lon, safeZone.center.lat],
        safeZone.radius_m || 350
      );

      this.map.addSource('safe-zone-source', {
        type: 'geojson',
        data: circleGeoJSON
      });

      this.map.addLayer({
        id: 'safe-zone-fill',
        type: 'fill',
        source: 'safe-zone-source',
        paint: {
          'fill-color': '#34C759',
          'fill-opacity': 0.12
        }
      });

      this.map.addLayer({
        id: 'safe-zone-line',
        type: 'line',
        source: 'safe-zone-source',
        paint: {
          'line-color': '#34C759',
          'line-width': 1.5,
          'line-dasharray': [4, 4],
        }
      });
    }
  } catch (e) {
    setTimeout(() => this.renderZones(), 100);
  }
}

  /**
   * Helper to generate a smooth GeoJSON polygon circle from center and radius in meters
   */
  createGeoJSONCircle(center, radiusInMeters, points = 64) {
    const coords = {
      latitude: center[1],
      longitude: center[0]
    };

    const km = radiusInMeters / 1000;
    const ret = [];
    const distanceX = km / (111.320 * Math.cos((coords.latitude * Math.PI) / 180));
    const distanceY = km / 110.574;

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);
      ret.push([coords.longitude + x, coords.latitude + y]);
    }
    ret.push(ret[0]);

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [ret]
      }
    };
  }

  /**
   * Resilient offline fallback: Switches to tactical dark canvas grid if map tiles fail
   */
  enableOfflineFallback() {
    if (this.isOfflineMode) return;
    this.isOfflineMode = true;
    console.warn('[MapManager] Basemap network failure detected. Enabling tactical offline grid.');

    const mapContainer = document.getElementById(this.containerId);
    if (mapContainer) {
      mapContainer.style.background = 'radial-gradient(circle at center, #0e1c33 0%, #060d1a 100%)';
    }

    // Add subtle UI indicator
    let badge = document.getElementById('offline-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'offline-badge';
      badge.innerText = '● Tactical Grid Active (Offline Mode)';
      badge.style.cssText = `
        position: absolute;
        bottom: 16px;
        left: 120px;
        background: rgba(245, 185, 66, 0.15);
        color: #F5B942;
        border: 1px solid rgba(245, 185, 66, 0.4);
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 11px;
        font-family: var(--font-mono);
        z-index: 1000;
      `;
      document.getElementById('map-viewport')?.appendChild(badge);
    }
  }

  getMap() {
    return this.map;
  }
}
