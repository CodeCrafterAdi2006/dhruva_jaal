# Development Diary: Dhruva Jaal (`ध्रुव जाल`)
**Project:** Disaster Relief LoRa Mesh Network 3D/2D Visualizer  
**Scenario:** Kathmandu Valley Floods (27–29 September 2024)  
**GitHub Repository:** [https://github.com/CodeCrafterAdi2006/dhruva_jaal](https://github.com/CodeCrafterAdi2006/dhruva_jaal)  
**Date:** October 2024 (Last Updated: 22 Oct 2024)

---

## 1. Project Inception & Problem Statement
- **The Core Idea:** When a major disaster strikes (earthquakes, flash floods), cellular base towers lose electricity and fiber backhauls snap within hours. Survivors are trapped with no mobile network.
- **The Solution:** A trapped survivor plugs a small, battery-backed USB-C LoRa dongle (ESP32-C3 + Semtech SX1278 @ 433 MHz) into their smartphone. The phone serves only as a text UI; the dongle stores the SOS packet and hops it across autonomous ground relays, elevated drones, and tethered balloons until reaching a rescue Base Camp on safe high ground.
- **The Visualization Mission:** Build a professional, incident-command dashboard (Google Maps dark mode style) that replays this real disaster scenario with 100% deterministic fidelity, interactive disaster triggers, and hardware connectivity stubs.

---

## 2. Evolution of Architecture & Decisions

### Decision 1: Moving from "Sci-Fi Video Game HUD" to "Emergency Incident Commander"
- **Initial Concept:** Giant glowing 3D spheres, post-apocalyptic rubble ground, neon bloom.
- **Strategic Pivot:** Switched to a restrained, production-grade interface (78% tactical map + 22% telemetry sidebar) modeled after Google Maps dark mode and professional observability tools (Datadog/Grafana). Clean lines, subtle halos, zero visual clutter.

### Decision 2: Grounding in a Real Historic Event (Kathmandu Floods 2024)
- Anchored the entire simulation in the real-world September 2024 Kathmandu Valley Floods (300+ mm rainfall, Bagmati river basin inundation, 3 key cell towers down).
- Formulated the **Two-Tier Aerial Relay Innovation:**
  - **Tier 1 (Drones):** Fast deployment from safe ground ($t=54\text{s}$) to bridge the immediate coverage gap.
  - **Tier 2 (Tethered Balloons):** High-altitude persistent backbone ($100\text{m}$ tethered aerostats) rising at $t=66\text{s}$.
  - **Make-Before-Break Handoff:** Balloons hold the link before low-battery drones are recalled at $t=78\text{s}$.

### Decision 3: NotebookLM Technical Integration
- Successfully linked our IDE to Google NotebookLM via Model Context Protocol (MCP) using Notebook ID: `ef0a0f39-7694-4fee-a8c8-8419fbc9cf44`.
- Queried the Semtech SX1278 datasheet and LoRaWAN literature for exact LF port offsets ($-164\text{ dBm}$), register mappings (`RegPktRssiValue` $0x1A$, `RegPktSnrValue` $0x19$), sensitivity floors ($-134\text{ dBm}$ at SF10/125kHz), and calibrated log-distance path loss exponents ($n=2.35$ ground, $n=1.95$ air).

---

## 3. What Has Been Built So Far (Step-by-Step Chronology)

### Milestone 1: Environment & Project Scaffolding
- Checked Node.js (v25), npm (11.6), and Python (3.12.6).
- Scaffolded `frontend/` directory using Vite + vanilla JavaScript.
- Installed `leaflet`, `three`, and `maplibre-gl`.
- Configured Google Fonts (`Inter` for UI typography, `JetBrains Mono` for telemetry and dBm readings).
- Initialized local Git repository, set up `.gitignore`, and synced with remote GitHub repo: `https://github.com/CodeCrafterAdi2006/dhruva_jaal`.

### Milestone 2: Design Tokens & 80/20 Dashboard Shell
- Created `frontend/src/hud.css` establishing custom CSS properties:
  - Deep App Navy (`#0B1220`), Map Canvas (`#111B2B`), Sidebar (`#101927`), Subtle Borders (`#263449`).
  - Semantics: Healthy Green (`#34C759`), Warning Amber (`#F5B942`), Alert Red (`#F05252`), Google Accent Blue (`#4285F4`).
- Implemented `frontend/index.html` with:
  - 78% Map Viewport with floating tactical header, mission banner, and signal legend bar.
  - 22% Telemetry Sidebar containing:
    1. **Message Log** (with green `● Live` status badge).
    2. **Live RSSI Meter Bars** for all 8 nodes.
    3. **Network Stats Grid** (Hop count, packet success rate, average RSSI, nodes online).
    4. **Simulate Disaster** & **Reset Network** action buttons.

### Milestone 3: Scenario Dataset & Calibrated RF Models
- Created `frontend/src/data/scenario.json`:
  - Map center over Kathmandu Valley (`27.6945° N, 85.3100° E`, pitch 52°).
  - Flood Zone polygon `FZ1` (8 GPS vertices along the flooded Bagmati river basin).
  - Safe Ground zone `SZ1` (350m radius around Base Camp `N8`).
  - 8 ground nodes (`N1` Balkhu rooftop dongle, `N2`–`N7` relays, `N8` Base Camp HQ).
  - 2 aerial drones (`DR1`, `DR2` @ 80m altitude) and 2 tethered balloons (`BL1`, `BL2` @ 100m altitude).
  - 3 cell towers (`T1`–`T3`) going down at $t=6\text{s}$.
  - 22 edge links with calibrated baseline RSSI values.
  - Complete 100-second timeline ($t=0$ to $t=96$).
- Created `frontend/src/config.js`:
  - Calibrated log-distance path loss formulas ($d = 10^{\frac{\text{RSSI}_{1m} - \text{RSSI}}{10 \cdot n}}$).
  - Hardware specifications for ESP32-C3, SX1278 433 MHz, SF10, CRC-8, and TTL=10.

### Milestone 4: Event-Driven Engine Architecture
- Created `frontend/src/engine/DataSource.js`:
  - Pure, robust `EventEmitter` with listener error protection.
  - `WebSocketSource` stub (`ws://localhost:8765`) activated via `?source=ws` for future live serial ESP32 integration.
- Created `frontend/src/engine/ScenarioEngine.js` (Production Grade):
  - 100-second deterministic playback engine using `requestAnimationFrame`.
  - Full 6-state SOS packet progression (`QUEUED` $\rightarrow$ `STORED` $\rightarrow$ `TRANSMITTING` $\rightarrow$ `SENT_TO_MESH` $\rightarrow$ `DELIVERED`).
  - Strict Store-and-Forward handling: `SOS3` held at `N5` from $t=44\text{s}$ to $t=62\text{s}$ (`Waiting for aerial mesh...`) until drones connect.
  - In-flight fractional progress math (`flightProgress` 0.0 to 1.0) for smooth 3D drone takeoff/landing and balloon rising.
  - Drone low-battery warning active from $t=74\text{s}$ to $t=83\text{s}$ before recall.
  - Persistent manual disaster trigger (`killNextNode()` / `this.manualKilledNodes`) so interactive button clicks never get wiped on the next animation frame.
  - Dynamic `activeEdges` computation exported in every state snapshot.

---

### Milestone 5: 3D Map Viewport, Geographic Zones & Tactical HUD (Phase 3 Complete)
- Created `frontend/src/map/MapManager.js`:
  - 3D tilted camera ($52^\circ$ pitch, $-15^\circ$ bearing) centered on Kathmandu Valley using MapLibre GL.
  - High-contrast ESRI Dark Canvas basemap tiles with zero external API key requirements.
  - Automatic `tileerror` listener that switches to an offline tactical gradient canvas if venue Wi-Fi fails.
  - Rendered Flood Zone (`FZ1`) along the Bagmati River basin with soft translucent blue water fill (`#1a4a8a`, 0.22 opacity) and a cyan-blue dashed boundary.
  - Rendered Safe Ground Circle (`SZ1`) around Base Camp `N8` with soft translucent green fill (`#34C759`, 0.12 opacity) and a dashed green perimeter.
- Designed & Styled Tactical Overlays in `frontend/src/hud.css` & `frontend/src/main.js`:
  - Full 11-row tactical legend card matching the mockup (Signal tiers, Alternate route, Packet flow, Active/Down nodes, Balloon/Drone icons, Flood/Safe zone swatches).
  - Top-center Alert Banner (`⚠ Phone network DOWN`) in red glassmorphic pill that automatically slides into view at $t=6\text{s}$ when cell towers go offline.
  - Bottom-left Tactical Compass Rose (`#compass-widget`) with live needle alignment tied to `map.on('rotate')` and click-to-reset camera orientation.
  - Dark-themed metric scale bar positioned alongside the compass rose.

---

## 4. Current Status & Next Objectives
- **Current Milestone:** Phase 3 is 100% Complete. Ready to execute Phase 4 (`frontend/src/map/NodeLayer.js`).
- **Immediate Next Step:** Build `NodeLayer.js` to render Cell Towers (`T1`–`T3`), Ground Nodes (`N1`–`N8`), Drone animations (`DR1`, `DR2`), and Tethered Balloons (`BL1`, `BL2`).

