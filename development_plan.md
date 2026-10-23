# Development Plan: Dhruva Jaal (`ध्रुव जाल`) Version 1
## Step-by-Step Implementation Guide for the 3D Digital Twin & Autonomous LoRa Mesh

**Target Completion Window:** Next 18–24 Hours  
**Input Specification:** [`version_1_master_proposal.md`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/version_1_master_proposal.md)  
**Baseline Codebase:** [`version_0.md`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/version_0.md) & [`technical_details.md`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/technical_details.md)  
**Output Document:** `development_plan.md`  

---

## 1. Architectural Guardrails & Tech Stack

To prevent breaking existing working features, eliminate dependency bloat, and guarantee 60 FPS on standard laptops:

* **Pure MapLibre GL JS (No Deck.gl / Threebox):** Avoid WebGL context conflicts and 600MB+ bundle size. All 3D elevation, extruded buildings, volumetric flood depth, and sky arcs will use native MapLibre `raster-dem`, `fill-extrusion`, and custom WebGL/SVG projective layers.
* **Pure Web Audio API (No Howler.js / External MP3s):** Synthesize authentic LoRa chirp spread-spectrum sweeps and radar sonar pings programmatically via oscillator nodes for zero load time and 100% offline reliability.
* **Deterministic Dual-Mode Routing:** Support both pre-scripted demonstration playback and dynamic **Geographic Forwarding Score** routing when judges inject custom SOS messages or sabotage nodes.

---

## 2. Updated Project File Map (`frontend/src/`)

```text
frontend/src/
├── main.js                     # Central coordinator: keyboard shortcuts, UI binding, audio triggers
├── hud.css                     # Tactical styling, phone drawer, sniffer bar, 3D overlays
├── config.js                   # LoRa physics, 433MHz Fresnel math, path loss calibration
├── audio/
│   └── SoundEngine.js          # [NEW] Pure Web Audio synthesizer (LoRa CSS chirp, sonar, sub-drop)
├── data/
│   └── scenario.json           # Kathmandu nodes, edges, timeline, coordinates, elevations
├── engine/
│   ├── DataSource.js           # Event emitter, WebSocket source + [NEW] Web Serial API bridge
│   ├── ScenarioEngine.js       # 100s timeline state machine + [NEW] Geographic Forwarding Router
│   └── RoutingEngine.js        # [NEW] Real-time Geographic Score calculation & topology solver
├── map/
│   ├── MapManager.js           # [UPDATED] AWS Terrarium 3D DEM, 3D buildings, rising 3D flood extrusion
│   ├── NodeLayer.js            # [UPDATED] 3D-aware node tags, Fresnel zone cards, aerial radar cones
│   └── LinkPacketLayer.js      # [UPDATED] 3D Parabolic Bezier Sky-Arcs, coverage dome bloom
└── ui/
    ├── Inbox.js                # [UPDATED] Base Camp Inbox + [NEW] "[🚁 Dispatch Rescue]" vector
    ├── Modals.js               # Context modal, Summary overlay, Honesty footer
    ├── SurvivorPhone.js        # [NEW] Floating interactive Android Survivor Phone + USB-C dongle UI
    └── SnifferBar.js           # [NEW] Collapsible LoRa PHY Frame Sniffer & SX1278 Time-on-Air display
```

---

## 3. Four-Sprint Step-by-Step Implementation Roadmap

```mermaid
gantt
    title Dhruva Jaal V1 24-Hour Execution Schedule
    dateFormat  X
    axisFormat  Hour %X
    section Sprint 1: 3D Spatial
    3D Terrain DEM & Atmospheric Sky      :0, 2
    3D Extruded Buildings & Rising Flood  :2, 4
    3D Parabolic Sky-Arcs & Coverage Dome :4, 6
    section Sprint 2: Interactive Sandbox
    Dynamic Geographic Forwarding Router  :6, 9
    Interactive Survivor Phone Drawer     :9, 11
    Click-to-Sabotage Chaos Mode          :11, 12
    section Sprint 3: RF Physics & Hardware
    433 MHz 1st Fresnel Zone Inspector    :12, 14
    LoRa PHY Frame & ToA Sniffer          :14, 16
    Rescue Dispatch Vector Animation      :16, 17
    Web Serial API USB-C Hardware Bridge  :17, 18
    section Sprint 4: Audio & Polish
    Zero-Asset SoundEngine Synthesizer    :18, 20
    Full UI Polish, Mute & Shortcuts      :20, 22
    Stress Testing & 3-Min Pitch Dry Run  :22, 24
```

---

### SPRINT 1: Zero-Bloat 3D Spatial Immersion (Hours 1–6)
*Goal: Turn the flat map into a defense-grade 3D Himalayan Digital Twin within the first 5 seconds.*

#### Step 1.1: AWS Terrarium 3D Himalayan DEM Topography
* **File:** [`frontend/src/map/MapManager.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/map/MapManager.js)
* **Tasks:**
  1. Add native MapLibre `raster-dem` source pointing to open AWS Terrarium elevation tiles (`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`).
  2. Configure `map.setTerrain({ source: 'kathmandu-dem', exaggeration: 1.5 })`.
  3. Add atmospheric `map.setSky({ 'sky-color': '#060d1a', 'fog-color': '#0d1829' })` for depth cueing.
  4. Ensure automatic graceful degradation: if tiles timeout or fail, fall back to the existing 2.5D tactical dark grid without throwing errors.

#### Step 1.2: 3D Extruded Urban Buildings
* **File:** [`frontend/src/map/MapManager.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/map/MapManager.js)
* **Tasks:**
  1. Add an OSM vector `fill-extrusion` layer for urban structures across the central Kathmandu basin.
  2. Style walls with dark slate navy (`#0d1829`), 82% opacity, and cyan roof edges (`#38bdf8`) to preserve the tactical HUD aesthetic without visual clutter.

#### Step 1.3: Rising 3D Volumetric Flood Water Extrusion
* **Files:** [`frontend/src/map/MapManager.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/map/MapManager.js), [`frontend/src/engine/ScenarioEngine.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/engine/ScenarioEngine.js)
* **Tasks:**
  1. Upgrade Flood Zone `FZ1` from a 2D `fill` to a 3D `fill-extrusion` polygon.
  2. Bind extrusion height to simulation time $t$:
     * $t \le 6\text{s}$: Height $= 0\text{ m}$.
     * $t = 6\text{s}$ to $40\text{s}$: Height smoothly animates from $0.5\text{ m}$ to $4.5\text{ m}$.
     * Surface color: semi-translucent glowing deep water (`rgba(14, 116, 244, 0.45)`).
  3. Visual result: Low-lying ground relays `N3` and `N6` physically submerge under water before they turn red/offline, while survivor `N1` remains visibly stranded above water on a $12\text{ m}$ rooftop.

#### Step 1.4: 3D Parabolic Sky-Arcs & Aerostat Coverage Cones
* **File:** [`frontend/src/map/LinkPacketLayer.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/map/LinkPacketLayer.js)
* **Tasks:**
  1. Implement a 3D-projected Quadratic Bezier Curve algorithm for aerial links:
     * Ground-to-Drone links curve upward reaching apex at $80\text{ m}$.
     * Ground-to-Balloon links curve upward reaching apex at $100\text{ m}$.
  2. Render vertical glowing tether lines connecting ground anchor coordinates to `BL1` and `BL2`.
  3. Render a translucent teal conical gradient projecting downward from each aerostat onto the terrain, visually demonstrating line-of-sight coverage.

---

### SPRINT 2: Dynamic Geographic Routing & Interactive Sandbox (Hours 7–12)
*Goal: Give judges an on-screen survivor phone to type custom SOS messages and try to break the network.*

#### Step 2.1: Live Geographic Forwarding Score Router
* **Files:** [`frontend/src/engine/RoutingEngine.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/engine/RoutingEngine.js), [`frontend/src/engine/ScenarioEngine.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/engine/ScenarioEngine.js)
* **Tasks:**
  1. Implement the mathematical routing score from `technical_details.md`:
     $$\text{Score}(A \rightarrow B) = w_1 \cdot \left(\frac{d(A, \text{HQ}) - d(B, \text{HQ})}{d(A, \text{HQ})}\right) + w_2 \cdot \left(\frac{RSSI_{AB} + 120}{60}\right) + w_3 \cdot \text{ElevBonus}(B)$$
  2. Implement local neighbor table caching (`Max Active Neighbors = 4`).
  3. Dynamically re-evaluate candidate next-hops whenever any node state changes.

#### Step 2.2: Interactive Survivor Smartphone Drawer (`SurvivorPhone.js`)
* **Files:** [`frontend/src/ui/SurvivorPhone.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/ui/SurvivorPhone.js), [`frontend/src/hud.css`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/hud.css), [`frontend/index.html`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/index.html)
* **Tasks:**
  1. Build a floating, collapsible Android smartphone mockup docked on the left screen margin (trigger with button or `P` key).
  2. Form controls:
     * Origin node selector (`N1` Balkhu, `N5` Sundarighat, or click-to-pick).
     * Custom text input (`"TRAPPED. WATER ENTERING 2ND FLOOR. 4 PEOPLE."`).
     * Emergency Need chips (`MEDICAL`, `RESCUE`, `FOOD`).
     * Battery slider ($5\%$ to $100\%$).
     * Visual USB-C Dongle graphic at the phone's bottom port with an active TX/RX LED.
  3. Click **`[TRANSMIT VIA DONGLE]`**:
     * Flash dongle LED red (`USB-OTG Serial: TX`).
     * Show instant `ACK · STORED IN DONGLE FLASH` status on phone screen.
     * Inject custom packet into `ScenarioEngine.js`.
     * Watch the custom packet hop across the 3D map live into Base Camp Inbox!

#### Step 2.3: "Chaos Monkey" Click-to-Sabotage Mode
* **Files:** [`frontend/src/main.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/main.js), [`frontend/src/map/NodeLayer.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/map/NodeLayer.js)
* **Tasks:**
  1. Add a **`[⚡ Sabotage Mode]`** button on the top HUD.
  2. When active, clicking *any* ground relay instantly floods/kills it (`status: 'down'`).
  3. If a packet is in transit, the sender triggers an **Exponential Backoff Retry**, detects neighbor failure, reroutes through the next-best geographic neighbor, and highlights the new path in dashed amber.

---

### SPRINT 3: RF Physics, Telemetry Sniffer & Dispatch Loop (Hours 13–18)
*Goal: Prove real radio physics, inspect raw PHY frames, and complete the rescue dispatch loop.*

#### Step 3.1: 433 MHz 1st Fresnel Zone & Line-of-Sight Inspector
* **Files:** [`frontend/src/config.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/config.js), [`frontend/src/map/NodeLayer.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/map/NodeLayer.js)
* **Tasks:**
  1. Implement exact Fresnel Zone radius formula for $f = 0.433\text{ GHz}$:
     $$F_1 = 8.656 \sqrt{\frac{d_{\text{km}}}{0.433}}\text{ meters}$$
  2. In the node inspection popover and link cards, display:
     * Link distance ($d_{\text{km}}$).
     * 1st Fresnel clearance radius ($F_1$).
     * Terrain status: Ground links show `⚠ Blocked by Urban Masonry/Water`, whereas Aerostat links show `✔ 96% Clear Line-of-Sight`.

#### Step 3.2: Physical Layer SX1278 Time-on-Air (ToA) & CRC Sniffer Bar
* **Files:** [`frontend/src/ui/SnifferBar.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/ui/SnifferBar.js), [`frontend/src/hud.css`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/hud.css)
* **Tasks:**
  1. Add a collapsible tactical footer sniffer bar displaying real-time serialized byte frames:
     ```text
     [433.00 MHz | SF10 | BW 125kHz | CR 4/5 | ToA: 370.7ms]
     0x04 0x01 N1-0042 27.6840 85.2970 0x09 0x01 MED 0x17 0xA7 [CRC-8 OK]
     ```
  2. Frame updates dynamically as packets hop from node to node.

#### Step 3.3: Base Camp Rescue Dispatch Vector
* **Files:** [`frontend/src/ui/Inbox.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/ui/Inbox.js), [`frontend/src/map/LinkPacketLayer.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/map/LinkPacketLayer.js)
* **Tasks:**
  1. Add a **`[🚁 Dispatch Rescue]`** button to each delivered card in Base Camp Inbox.
  2. Clicking it animates a dashed neon green vector from Base Camp (`N8`) straight to the survivor rooftop, accompanied by an ETA badge: `"Rescue Team En Route · Confirmed GPS · Zero Blind Search"`.

#### Step 3.4: Plug-and-Play Web Serial API Bridge
* **File:** [`frontend/src/engine/DataSource.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/engine/DataSource.js)
* **Tasks:**
  1. Implement `connectSerial()` using Chrome's native `navigator.serial` API.
  2. Add `[🔌 Connect USB Dongle]` button in header.
  3. When an ESP32-C3 is plugged into USB and prints `SEND|SOS...` over serial, immediately ingest and dispatch across the 3D map.

---

### SPRINT 4: Procedural Web Audio, Shortcuts & Demo Polish (Hours 19–24)
*Goal: Sensory immersion, zero-regression testing, and rehearsing the winning 3-minute pitch.*

#### Step 4.1: Zero-Dependency Web Audio API Synthesizer (`SoundEngine.js`)
* **File:** [`frontend/src/audio/SoundEngine.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/audio/SoundEngine.js)
* **Tasks:**
  1. Initialize singleton `AudioContext` on first user interaction.
  2. Implement 4 procedural sound algorithms:
     * **LoRa CSS Chirp Sweep:** Oscillator sweeping linearly from $800\text{ Hz} \to 2400\text{ Hz}$ over $180\text{ ms}$ on transmission.
     * **Cell Grid Failure Sub-Drop:** Sub-bass frequency drop from $120\text{ Hz} \to 40\text{ Hz}$ at $t=6\text{s}$.
     * **Relay Hop Tick:** Crisp $1800\text{ Hz}$ ($25\text{ ms}$) mechanical click upon intermediate relay ACK.
     * **Base Camp Sonar Chime:** Dual harmonic chime ($880\text{ Hz} + 1320\text{ Hz}$) on delivery.
  3. Header toggle: `[🔊 AUDIO ON / MUTE]` (muted by default with pulse animation).

#### Step 4.2: Full UI Integration & Keyboard Mapping
* **File:** [`frontend/src/main.js`](file:///c:/AI%20Native%20founder/Hackathon_projects/octo_gdg_hackathon/frontend/src/main.js)
* **Tasks:**
  1. Bind all shortcuts:
     * `Space` — Play / Pause
     * `R` — Reset to $t=0\text{s}$
     * `K` — Kill next ground node (*Simulate Disaster*)
     * `P` — Open / close Interactive Survivor Phone
     * `S` — Toggle Chaos Sabotage mode
     * `D` / `B` — Fast forward to Drones ($t=54\text{s}$) / Balloons ($t=66\text{s}$)
     * `M` — Toggle With / Without Mesh mode
     * `A` — Toggle Audio Mute / Unmute
     * `F` — Toggle Fullscreen mode
     * `C` / `I` — Context & Plan modal

#### Step 4.3: Stress Testing, Offline Resilience & Rehearsal
* Verify offline grid fallback works if Wi-Fi is cut.
* Run 60 FPS performance profiling across all layers.
* Practice the **3-Minute Judge Demo Choreography** (detailed in Section 5).

---

## 4. Verification & Testing Checklist

| Test Item | Pass Criteria | Validation Method |
|---|---|---|
| **3D Terrain Elevation** | Mountain ridges visible around Kathmandu bowl; camera pitch reaches $60^\circ$ smoothly. | Visual inspection; DevTools WebGL inspector |
| **Rising 3D Flood Extrusion** | Water volume rises smoothly from $0\text{ m} \to 4.5\text{ m}$; submerged nodes turn offline. | Advance timeline $t=0 \to 40\text{s}$ |
| **Parabolic 3D Sky-Arcs** | Links to drones ($80\text{ m}$) and balloons ($100\text{ m}$) curve into the air. | Rotate camera bearing $360^\circ$ |
| **Interactive Survivor Phone** | Custom user text generates a packet, hops through mesh, and lands in Base Camp Inbox. | Input test string, click Send |
| **Dynamic Geographic Router** | Killing any intermediate node dynamically recalculates alternate path in $<10\text{ ms}$. | Click Sabotage on `N2` or `N5` |
| **Fresnel Zone Inspector** | Ground link shows blocked percentage; balloon link shows $>90\%$ clearance. | Click link popovers |
| **Web Audio Synthesizer** | Authentic chirp sweeps and sonar pings play without external audio file requests. | Unmute and verify in DevTools Network tab |
| **Web Serial Hardware Bridge** | ESP32-C3 USB connection requests port and receives serial JSON. | Test with mock/real serial device |

---

## 5. The Winning 3-Minute Judge Pitch Script

* **[0:00 - 0:45] The 3D Crisis Hook:**
  * *"In September 2024, 300mm of rain submerged Kathmandu. Cell towers died, and 1,000+ people were stranded. Watch what happens in standard infrastructure: at t=6s, cellular collapses, and no survivor messages ever get out."*
* **[0:45 - 1:30] The Dhruva Jaal Solution:**
  * *"Now we switch on Dhruva Jaal with mesh. The floodwaters rise in 3D. When ground nodes drown, survivor dongles store messages in flash. Drones launch from safe ground as fast relays, and 100m tethered balloons take over as a permanent line-of-sight backbone—zero responders in flood currents."*
* **[1:30 - 2:30] Hand the Controls to the Judge (The Decisive Moment):**
  * *"Judge, please open the Survivor Phone on the left. Type your own emergency message. Now click any node on the map to flood it. Watch our Geographic Forwarding Router dynamically score neighbors, curve your packet through the 3D sky-arcs, chime into Base Camp HQ, and dispatch a rescue boat with confirmed coordinates."*
* **[2:30 - 3:00] Physics & Hardware Proof:**
  * *"This isn't an animation—open our Fresnel Zone Inspector and LoRa PHY sniffer to see the real 433 MHz radio math, or plug our ESP32-C3 dongle directly into this laptop's USB port."*
