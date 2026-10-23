# Version 0: Dhruva Jaal (`ध्रुव जाल`) — Comprehensive System Documentation

**Project Title:** Dhruva Jaal (`ध्रुव जाल`)  
**Subtitle:** Kathmandu Valley Floods: What if the mesh was already there?  
**Disaster Context:** Kathmandu Valley Floods (27–29 September 2024)  
**Hardware Profile:** ESP32-C3 + SX1278 (433 MHz LoRa) + NEO-6M GPS + USB-C Phone Dongle  
**Document Classification:** Version 0 Baseline Architecture & Implementation Specification  
**Repository State:** Branch `main` (Commit `8dcde22`)  

---

## 1. Executive Summary

**Dhruva Jaal (`ध्रुव जाल`)** is an emergency ad-hoc telecommunications system designed for severe natural disasters when municipal power grids and cellular infrastructure collapse. 

During the September 2024 Kathmandu Valley floods, cellular towers lost electrical power, terrestrial fiber backhauls were severed by landslides, and emergency SMS alerts failed to reach stranded citizens. 

Dhruva Jaal addresses this crisis by combining:
1. **Low-power, low-cost LoRa USB-C dongles** that turn ordinary civilian smartphones into offline, decentralized mesh radio communicators without requiring cellular towers or internet.
2. **A deterministic Store-and-Forward packet protocol** that caches emergency SOS messages in hardware flash memory during radio link breaks and automatically hops packets across surviving ground relays.
3. **A two-tier aerial relay architecture (Drones + Tethered Balloons)** launched exclusively from safe, unflooded ground, restoring communication across flood zones without risking rescuer lives in contaminated currents.
4. **An interactive, high-precision tactical digital twin visualizer** that models real-world RF path loss, hop latencies, dynamic alternate rerouting, and Base Camp dispatch intake.

---

## 2. Real-World Disaster Ground Truth (September 2024 Floods)

The project’s scenario is strictly anchored to public, verified reports from the 27–29 September 2024 disaster:

* **Record-Breaking Precipitation:** Nine meteorological stations in the Kathmandu Valley recorded the highest 24-hour rainfall totals since modern measurement began in 1970 (240 mm to 322 mm in ~24 hours). *(Source: Nepal Department of Hydrology & Meteorology / Reuters)*
* **Catastrophic Urban Inundation:** Southern Kathmandu and the Bagmati river basin were severely flooded. Ground floors were fully submerged; 1,053 residents were rescued by Saturday morning using inflatable rafts and an army helicopter. *(Source: Nepal Police / Associated Press)*
* **Grid and Cellular Tower Collapse:** Municipal electricity was cut. Nepal Telecom reported macro cellular towers failed due to battery depletion and severed fiber backhaul cables. Crucial evacuation SMS alerts failed to deliver to residents in blackout sectors. *(Source: Nepal Telecom / Kantipur Daily)*
* **Valley Land Isolation:** Landslides blocked all three arterial highway corridors leading into Kathmandu Valley, preventing ground military reinforcements from entering for over 48 hours. *(Source: AP News / Nepal Police)*
* **Humanitarian Toll:** Over 236 confirmed fatalities nationwide (34+ inside Kathmandu Valley). International humanitarian agencies identified communication network restoration as the primary operational priority. *(Source: ACAPS Humanitarian Analysis / AP)*

---

## 3. Hardware Architecture & Radio Design

### 3.1 Hardware Components
* **Microcontroller:** Espressif ESP32-C3 (RISC-V single-core @ 160 MHz, ultra-low idle sleep current, hardware USB-CDC / OTG support).
* **RF Transceiver:** Semtech SX1278 operating on the **433 MHz ISM band**. 433 MHz was chosen over 868/915 MHz due to superior diffraction around dense urban concrete masonry and foliage in heavy monsoon conditions.
* **Modulation Parameters:**
  * Bandwidth: $125\text{ kHz}$
  * Spreading Factor: $\text{SF7}$ to $\text{SF10}$ (dynamic adaptation)
  * Coding Rate: $4/5$
  * Transmission Power: $+20\text{ dBm}$ ($100\text{ mW}$)
* **GPS Module:** u-blox NEO-6M for zero-network geographic coordinate stamping ($Lat, Lon \pm 2.5\text{ m}$).
* **Form Factor:** Compact USB-C dongle that plugs into the charging port of any Android or iOS device, powered directly via USB-OTG (~$35\text{ mA}$ average listening current).

### 3.2 Two-Tier Aerial Strategy: Zero Responder Risk
A core design tenet of Dhruva Jaal is **never sending human rescue personnel into flood currents** simply to set up intermediate repeater stations:

1. **Tier 1 — Drones (`DR1`, `DR2`):**
   * *Profile:* Quadcopter/hexacopter platforms carrying an airborne ESP32-C3 relay payload.
   * *Role:* Fastest first deployment. Launch within 5 minutes from safe ground HQ (`N8`), fly directly over the urban gap at an altitude of $80\text{ m}$, and bridge broken ground links immediately.
   * *Limitation:* Limited flight endurance (20–30 minutes battery life).
2. **Tier 2 — Tethered Aerostat Balloons (`BL1`, `BL2`):**
   * *Profile:* Helium-filled tethered aerostats anchored on safe, unflooded ground.
   * *Role:* Persistent high-altitude backbone. Rise vertically to $100\text{ m}$, establishing an unobstructed line-of-sight (LOS) umbrella across the entire valley. They operate for days continuously with negligible operational cost.
   * *Limitation:* Slower deployment time (~10–15 minutes setup).
3. **The Make-Before-Break Handoff:**
   * Drones establish the instant emergency link.
   * Balloons inflate and elevate to altitude.
   * Once balloon links are verified online ($t=74\text{s}$), the radio network executes a seamless make-before-break handoff.
   * Drones register a low-battery state and autonomously return to Base Camp HQ for recharging.

---

## 4. Software & System Architecture

### 4.1 Technology Stack
* **Build System & Dev Server:** Vite 5.x (ES Modules, Hot Module Replacement).
* **Map & Spatial Engine:** MapLibre GL JS 4.7.1 (WebGL vector rendering, 3D camera pitch/bearing controls, raster tile rendering, custom canvas layers).
* **Styling & Theme:** Vanilla CSS design system (`hud.css`) implementing a tactical dark navy interface (`#060d1a`), neon telemetry accents (`#2ee66b`, `#38bdf8`, `#ef4444`, `#ffb020`), and glassmorphism cards.
* **Zero External Cloud Dependencies:** Completely offline-capable; includes an automatic offline tactical SVG/CSS grid fallback if map tile servers fail during a field demo.

### 4.2 Repository File Tree (`frontend/`)
```text
frontend/
├── index.html                  # Tactical HUD shell, viewport, panels, and modals
├── package.json                # Dependencies: vite, maplibre-gl, leaflet
├── vite.config.js              # Vite server configuration
├── .gitignore                  # Git ignore rules
├── public/
│   ├── favicon.svg             # Neon antenna icon
│   └── icons.svg               # Tactical vector symbols
└── src/
    ├── main.js                 # App entry point, event wiring, keyboard shortcuts
    ├── hud.css                 # 1500+ lines of tactical UI styles and animations
    ├── config.js               # LoRa physics, path loss calibration, color bands
    ├── data/
    │   └── scenario.json       # Kathmandu coordinates, polygons, nodes, timeline
    ├── engine/
    │   ├── DataSource.js       # Event emitter & live hardware serial WebSocket bridge
    │   └── ScenarioEngine.js   # Deterministic 100s timeline state machine
    ├── map/
    │   ├── MapManager.js       # MapLibre init, offline fallback, FZ1 & SZ1 polygons
    │   ├── NodeLayer.js        # Ground nodes, towers, animated drones, balloons
    │   └── LinkPacketLayer.js  # 60fps rAF loop: dynamic RSSI links, glowing SOS orbs
    └── ui/
        ├── Inbox.js            # Base Camp Inbox dispatch table with click-to-pan
        └── Modals.js           # Context & Response Plan modal, Summary overlay, Honesty footer
```

---

## 5. Mathematical & Algorithmic Models

### 5.1 Calibrated Log-Distance Path Loss Model
In [`src/config.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/config.js), distance estimation between nodes is calibrated using the standard log-distance path loss formulation:

$$RSSI = RSSI_{\text{ref, 1m}} - 10 \cdot n \cdot \log_{10}(d) + X_\sigma$$

Inverting for distance estimation:
$$d = 10^{\frac{RSSI_{\text{ref, 1m}} - RSSI}{10 \cdot n}}$$

* **Calibrated Constants:**
  * $RSSI_{\text{ref, 1m}} = -32\text{ dBm}$ (measured 1-meter reference RSSI for 433 MHz +20 dBm transmitter).
  * $n = 1.65$ (path loss exponent calibrated for suburban Kathmandu rooftop-to-rooftop line-of-sight).
* **Exponential Moving Average (EMA) RSSI Smoothing:**
  To model natural radio channel fading without visual jitter:
  $$\overline{RSSI}_t = \alpha \cdot RSSI_{\text{raw}} + (1 - \alpha) \cdot \overline{RSSI}_{t-1} \quad (\alpha = 0.15)$$

### 5.2 6-State Message Machine
Every emergency message in [`src/engine/ScenarioEngine.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/engine/ScenarioEngine.js) transitions through 6 deterministic states:
1. `QUEUED`: Generated in phone app; waiting for USB-C serial transfer to dongle.
2. `STORED`: Acknowledged by dongle and saved into non-volatile hardware flash memory.
3. `TRANSMITTING`: RF preamble initiated; transmitting over physical 433 MHz air interface.
4. `SENT_TO_MESH`: Hopping node-to-node across intermediate repeaters (hop delay $1.2\text{s}$ per link).
5. `DELIVERED`: Acknowledged by Base Camp (`N8`); telemetry parsed into inbox.
6. `FAILED`: Terminal state if no route exists (e.g., when tested in *Without Mesh* mode).

---

## 6. Detailed Scenario Timeline (`scenario.json`)

| Time ($t$) | Event Type | Description / Tactical Action |
|:---:|:---:|---|
| **$t = 0\text{s}$** | `phase: P1` | Simulation starts. Rain intensifies. Standard 4G/LTE mobile grid is active. |
| **$t = 6\text{s}$** | `phase: P2` | **Cellular Grid Collapses.** Towers `T1`, `T2`, `T3` lose power. Top alert banner flashes `⚠ Phone network DOWN`. |
| **$t = 10\text{s}$** | `sos: SOS1` | Survivor at `N1` (Balkhu) sends SOS. Normal ground route: `N1 -> N2 -> N3 -> N4 -> N8` (Base Camp). Delivered at $t=15\text{s}$. |
| **$t = 22\text{s}$** | `node_status` | **Node Failure 1:** `N3` (Teku) gets flooded and submerged. Marker switches to red warning badge `⚠`. |
| **$t = 26\text{s}$** | `sos: SOS2` | Survivor at `N1` sends SOS2. Route discovers alternate path: `N1 -> N2 -> N5 -> N6 -> N7 -> N8`. Delivered at $t=32\text{s}$. |
| **$t = 40\text{s}$** | `node_status` | **Node Failure 2:** `N6` (Thapathali bridge) drowns in flood waters. |
| **$t = 44\text{s}$** | `sos: SOS3` | Survivor at `N5` sends SOS3. All ground paths to Base Camp are now severed. |
| **$t = 44\text{s}$–$62\text{s}$** | `store_forward` | **Store-and-Forward Demonstration:** `N5` holds `SOS3` in flash memory. Amber pulsing halo displays: *"STORED IN DONGLE · Waiting for aerial mesh..."*. |
| **$t = 54\text{s}$** | `phase: P3` | Storm breaks. Drones `DR1` and `DR2` launch from safe ground HQ (`N8`) over a 6-second flight path. |
| **$t = 60\text{s}$** | `drones_online`| Drones achieve hover altitude ($80\text{ m}$). Drone links illuminate. |
| **$t = 62\text{s}$** | `sos_release` | `N5` detects active aerial link and transmits stored `SOS3`: `N5 -> DR1 -> DR2 -> N8`. Delivered at $t=66\text{s}$. |
| **$t = 66\text{s}$** | `phase: P4` | Tethered Aerostat Balloons `BL1` and `BL2` inflate and elevate from safe ground to $100\text{ m}$. |
| **$t = 74\text{s}$** | `balloons_online` | High-altitude balloon backbone goes live. |
| **$t = 78\text{s}$** | `phase: P5` | **Seamless Handoff:** Balloons assume network load. Drones signal low battery and return to base camp. |
| **$t = 86\text{s}$** | `sos: SOS4` | High-altitude direct link test. `N1` transmits directly to balloon backbone: `N1 -> BL1 -> BL2 -> N8`. Delivered at $t=90\text{s}$. |
| **$t = 96\text{s}$** | `summary` | **Simulation Complete:** Operational comparison modal displays final mission metrics. |

---

## 7. User Interface & Feature Breakdown

### 7.1 Left Viewport (78% Width)
* **MapLibre 3D Canvas:** Tilted perspective ($38^\circ$ pitch, $-12^\circ$ bearing) centered on Kathmandu Valley.
* **Top Header:** Brand title, scenario badge, Kathmandu event date, `[ℹ Context & Plan]` drawer trigger, and `[With mesh | Without mesh]` mode toggle.
* **Alert Banner:** Top-center flashing glassmorphic pill triggered whenever cellular towers fail.
* **Tactical Legend:** High-contrast guide for signal strengths (Strong `#2ee66b`, Medium `#ffb020`, Weak `#ff3b3b`), alternate routes, nodes, balloons, drones, flood zone, and safe ground.
* **3D Tactical Compass Rose:** Dynamic compass widget that rotates in real-time with camera bearing and snaps back to north on click.
* **Flood & Safe Polygons:** Translucent blue animated polygon for Bagmati Flood Zone (`FZ1`) and glowing green dashed perimeter for Safe Ground HQ (`SZ1`).
* **Node Inspection Popovers:** Clicking any tower, node, drone, or balloon opens a tactical telemetry popover showing coordinates, battery, role, connection states, and log-distance estimated neighbor ranges.
* **Bottom Timeline Bar:** Draggable 0–100s scrub slider, clickable **P1–P5** phase milestone ticks, play/pause controls, $0.5\times / 1\times / 2\times$ speed buttons, and simulated clock.
* **Honesty Disclaimer Footer:** Fixed tactical banner: *"Simulation. Scripted scenario based on public reports of the Sep 2024 Kathmandu floods. Device positions, flood zone & times are illustrative, not measured."*

### 7.2 Right Telemetry Sidebar (22% Width)
* **Section 1: Message Log (`● LIVE`):** Reverse-chronological feed showing message IDs, timestamps, origin/destination hops, and color-coded status pills (`STORED`, `TRANSMIT`, `DELIVERED`, `FAILED`).
* **Section 2: Live Network RSSI:** Real-time horizontal bar meters for all 8 ground nodes plus deployed aerial relays (`DR1`, `DR2`, `BL1`, `BL2`) with smoothed dBm readouts.
* **Section 3: Network Stats Grid:** Live 4-box HUD displaying Hop Count, Packet Success Rate, Average RSSI, and Online Nodes Ratio.
* **Section 4: Base Camp Inbox:** Live emergency dispatch queue. When an SOS delivers to Base Camp, a card slides in with survivor need badge (`MEDICAL`, `RESCUE`, `FOOD`), people count, sender battery percentage, and GPS. **Clicking any row flies the 3D map directly to that survivor's rooftop.**
* **Section 5: Tactical Action Controls:** `[▶ Simulate Disaster]` button (kills the next active ground node to test live dynamic rerouting during judging) and `[↺ Reset Network]` button.

### 7.3 Modal Dialogs
* **Context & Response Plan Modal (`Modals.js`):** 5 verified ground truth cards with formal citations + 3-row aerial response strategy table + transparency notice.
* **Mission Summary Modal:** End-of-run comparative table showing **With Mesh (4/4 delivered, 2 node drownings survived, zero responder risk)** versus **Without Mesh (0/4 delivered, total cellular blackout at $t=6\text{s}$)**.

### 7.4 Comprehensive Keyboard Control Mapping
* `Space` — Toggle Play / Pause
* `R` — Reset timeline to $t=0\text{s}$
* `K` — Kill next ground node (*Simulate Disaster*)
* `D` — Fast-forward / jump to **Drones launch** ($t=54\text{s}$)
* `B` — Fast-forward / jump to **Balloons rise** ($t=66\text{s}$)
* `M` — Toggle **With Mesh / Without Mesh** mode
* `F` — Toggle Fullscreen mode
* `C` or `I` — Open / close the **Context & Response Plan** modal
* `Esc` — Close any open modal dialog

---

## 8. Current Limitations of Version 0

While Version 0 is fully stable, deterministic, and feature-complete against the initial master plan, it possesses specific limitations that differentiate it from defense-grade / tier-1 hackathon visualizers:
1. **Flat Elevation (2.5D):** While the camera is tilted, the ground tiles are flat 2D raster tiles. It does not yet render true 3D digital elevation models (DEM) of the surrounding Himalayan mountains.
2. **Static Flood Representation:** The flood zone is a flat SVG/GeoJSON polygon rather than a real-time, depth-tinted, rising water shader.
3. **Marker Aesthetics:** Drones and balloons use 2D HTML/SVG markers with CSS animations rather than true 3D GLTF models with rotating propellers and physics-based tether cables.
4. **Passive Operator Input:** The scenario is primarily pre-scripted; judges cannot yet type an arbitrary custom SOS on an interactive on-screen smartphone mockup to watch their own custom message propagate live.
5. **RF Physics Visualization:** Signal lines are drawn as direct line segments between nodes rather than true RF propagation heatmaps or Fresnel Line-of-Sight blockage cones.

---
*End of Version 0 Documentation. Ready to serve as the baseline for Version 1 enhancement upgrades.*
