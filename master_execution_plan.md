# Master Execution Plan: Dhruva Jaal (`ध्रुव जाल`)
**Subtitle:** Kathmandu Valley Floods: What if the mesh was already there?  
**Scenario:** Kathmandu Valley Floods (27–29 September 2024)  
**Hardware Context:** ESP32-C3 + SX1278 (433 MHz LoRa) + NEO-6M GPS + USB-C Phone Dongle  

---

## 1. Visual & UI Layout Blueprint (Matching Final Mockup)

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [Logo] DHRUVAJAAL  LoRa Mesh Network / Disaster Relief [Scenario]                            │
│        Kathmandu Valley Floods, 27–29 Sep 2024               [ℹ Context] [With mesh|Without] │
├────────────────────────────────────────────────────────────────┬─────────────────────────────┤
│ MAP VIEWPORT (78% Width - Dark Navy Tactical Basemap)          │ RIGHT TELEMETRY COLUMN (22%)│
│                                                                │                             │
│ ┌─────────────────────────┐       ┌──────────────────────────┐ │ ┌─────────────────────────┐ │
│ │ Legend Card             │       │ ⚠ Phone network DOWN     │ │ │ 📄 Message Log   ● Live │ │
│ │ ── Strong (-60 to -80)  │       └──────────────────────────┘ │ │ TIME | ID | STATUS |... │ │
│ │ ── Medium (-81 to -100) │                                    │ └─────────────────────────┘ │
│ │ ── Weak (-101 to -120)  │        [Cell Towers T1, T2, T3]    │ ┌─────────────────────────┐ │
│ │ -- Alternate route      │                                    │ │ 📶 RSSI (Live)          │ │
│ │ ➔ Packet flow           │      [BALLOON 1]     [BALLOON 2]   │ │ Node 1..8 + Aerial bars │ │
│ │ ● Node (active)         │      100m tethered   100m tethered │ └─────────────────────────┘ │
│ │ ⚠ Node (down)           │           │               │        │ ┌─────────────────────────┐ │
│ │ 🎈 Balloon / 🛸 Drone   │    [N1 DONGLE] ─── [RELAYS] ───┐   │ │ ⚙ Network Stats         │ │
│ │ ░░ Flood / Safe zone    │     (Red Pulse)                ▼   │ │ Hops | Success | Nodes  │ │
│ └─────────────────────────┘                          [N8 BASE] │ └─────────────────────────┘ │
│                                                    (Safe Zone) │ ┌─────────────────────────┐ │
│ ┌─────────┐                                                    │ │ ✉ Base Camp Inbox       │ │
│ │ Compass │  [Scale: 0 500 1000 1500m]                         │ │ ID|TIME|GPS|NEED|BAT|.. │ │
│ └─────────┘                                                    │ └─────────────────────────┘ │
├────────────────────────────────────────────────────────────────┴─────────────────────────────┤
│ BOTTOM TIMELINE & CONTROL BAR                                                                │
│ [▶/⏸] ──●──────────────●──────────────●──────────────●──  🕒 Sat 28 Sep, 19:40  [1x ▼]       │
│         P1             P2             P3             P5                                      │
│ [Aerial layer: BALLOONS (persistent) ▼]        [▶ Play Scenario]  [⚠ Simulate Disaster]      │
│                                                       Simulation. Positions are illustrative.│
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Target Project File Structure (`frontend/`)

```text
frontend/
├── index.html                  # App shell, HUD panels, SVG glow filters, top/bottom bars
├── package.json                # Vite + Leaflet (or MapLibre GL JS), zero-key setup
├── README.md                   # Setup instructions, keyboard shortcuts, scenario editing guide
└── src/
    ├── main.js                 # Entry point, keyboard bindings, mode toggles, initialization
    ├── hud.css                 # Dark navy theme (#060d1a), neon glows, glassmorphism cards
    ├── config.js               # RSSI_REF_1M, PATH_LOSS_N, LoRa 433MHz params, color bands
    ├── data/
    │   └── scenario.json       # Complete Kathmandu coordinates, zones, nodes, edges, timeline
    ├── engine/
    │   ├── DataSource.js       # Unified Event Emitter + WebSocketSource (ws://localhost:8765)
    │   └── ScenarioEngine.js   # Deterministic 100s state machine (play, pause, scrub, speed)
    ├── map/
    │   ├── MapManager.js       # Dark basemap, offline CSS grid fallback, Flood & Safe polygons
    │   ├── NodeLayer.js        # Ground nodes (N1-N8), Towers (T1-T3), Drones, Tethered Balloons
    │   └── LinkPacketLayer.js  # 60fps rAF loop: EMA RSSI noise, dBm tags, glowing packet flows
    └── ui/
        ├── RightPanels.js      # Message Log, RSSI Live bars, Network Stats, Base Camp Inbox
        ├── TimelineBar.js      # Scrubber, P1-P5 ticks, Sim Clock, Aerial status chip
        └── Modals.js           # Node popovers (distance est.), Context cards, Summary overlay
```

---

## 3. Step-by-Step Build Checklist

### Phase 1: Foundation, Config & Scenario Data
- [x] **Step 1.1: Create `src/data/scenario.json`**
  - Populate `meta` (Kathmandu center `27.6945, 85.3100`, zoom `14.3`, `hopSeconds: 1.2`, RSSI bands: Strong `-60` to `-80 dBm` `#2ee66b`, Medium `-81` to `-100 dBm` `#ffb020`, Weak `-101` to `-120 dBm` `#ff3b3b`).
  - Populate `zones`: Flood Zone polygon `FZ1` (8 coordinates across southern Kathmandu/Bagmati) and Safe Ground circle `SZ1` (`radius_m: 350` around `N8`).
  - Populate `nodes`:
    - `N1` (`dongle`, Balkhu rooftop)
    - `N2`–`N7` (`relay`, Balkhu market, Teku, Kalimati, Sundarighat, Thapathali, Maitighar)
    - `N8` (`helper`, Base Camp HQ, Central Kathmandu safe ground)
    - `DR1`, `DR2` (`drone`, `alt_m: 80`, initially `hidden: true`)
    - `BL1`, `BL2` (`balloon`, `alt_m: 100`, `tethered: true`, initially `hidden: true`)
  - Populate `cellTowers` (`T1`–`T3`), `edges` (22 ground, drone, and balloon links), and `timeline` (`t=0` to `t=96`).
- [x] **Step 1.2: Create `src/config.js` (LoRa & Path Loss Calibration)**
  - Define log-distance path loss constants:
    $$d = 10^{\frac{\text{RSSI}_{\text{ref, 1m}} - \text{RSSI}}{10 \cdot n}}$$
  - Calibrate `RSSI_REF_1M = -32` and `PATH_LOSS_N = 1.65` so estimated link distances match real Haversine ground/3D distances on the Kathmandu map.
  - Include hardware metadata (`ESP32-C3`, `SX1278 433MHz`, `SF7-SF10`, `CRC-8`, `TTL=10`, `Max Neighbors=4`) for node inspection popovers.

---

### Phase 2: Event-Driven Data Layer (`src/engine/`)
- [x] **Step 2.1: Build `DataSource.js` Interface & `WebSocketSource` Stub**
  - Standardize emitted event types: `node_status`, `link`, `sos`, `msg`, `aerial`, `towers`, `phase`, `clock`, `summary`.
  - Implement `WebSocketSource` (`ws://localhost:8765`) activated via `?source=ws` URL parameter so hardware teammates can stream live ESP32 serial JSON packets directly into the UI.
- [x] **Step 2.2: Build Deterministic `ScenarioEngine.js`**
  - Implement a 100-second timeline loop driven by `requestAnimationFrame` with `play()`, `pause()`, `restart()`, `seek(t)`, and `setSpeed(0.5 | 1 | 2)`.
  - Ensure scrubbing (`seek(t)`) cleanly recomputes the exact state of all nodes, towers, aerial relays, and messages at any second `t` without glitches.
  - Model the 6 exact message states from `technical_details.md`:
    `QUEUED` $\rightarrow$ `STORED` $\rightarrow$ `TRANSMITTING` $\rightarrow$ `SENT_TO_MESH` $\rightarrow$ `DELIVERED` (or `FAILED` / `NO ROUTE` in Without-Mesh mode).

---

### Phase 3: Map Viewport, Offline Resilience & Geographic Zones (`src/map/MapManager.js`)
- [x] **Step 3.1: Initialize Dark Basemap & Offline Fallback**
  - Render dark-navy map tiles centered on `[27.6945, 85.3100]` at zoom `14.3` with attribution.
  - Listen for `tileerror`: if venue Wi-Fi drops, automatically switch the map background to a tactical dark navy radial-grid CSS canvas and display a subtle `"Basemap offline — tactical grid active"` pill.
- [x] **Step 3.2: Draw Flood Zone (`FZ1`) & Safe Ground (`SZ1`)**
  - Draw `FZ1` as a soft translucent blue polygon (`rgba(30, 110, 220, 0.18)`) with a glowing dashed cyan-blue border and tilted label `"Flood zone (illustrative)"`.
  - Draw `SZ1` around `N8` as a translucent green circle (`rgba(46, 230, 107, 0.14)`) with a dashed green ring and label `"Safe ground"`.
- [x] **Step 3.3: Add Map HUD Overlays**
  - Top-left Legend Card matching the mockup (Strong/Medium/Weak dBm bars, Alternate route, Packet flow, Node active, Node down, Balloon, Drone, Flood zone, Safe ground).
  - Bottom-left Compass Rose (`N/S/E/W`) and metric Scale Bar (`0, 500, 1,000, 1,500 m`).
  - Top-center Alert Banner (`⚠ Phone network DOWN` in red glassmorphic pill, triggered at `t=6s`).


---

### Phase 4: Ground Nodes, Cell Towers & Aerial Relays (`src/map/NodeLayer.js`)
- [x] **Step 4.1: Render Cell Towers (`T1`–`T3`)**
  - Show 3 cell tower icons with green signal arcs from `t=0` to `t=6s`.
  - At `t=6s`, switch icons to gray with a red `✕` badge and label `"Cell Tower (Kathmandu)"`.
- [ ] **Step 4.2: Render Ground Nodes (`N1`–`N8`)**
  - `N1` (`DONGLE`): Glowing red core with concentric pulsing range rings, person icon inside, label `"DONGLE (trapped person)"`.
  - `N2`–`N7` (`RELAY`): Glowing blue core with concentric translucent radar rings, label `"RELAY"` and live `-XX dBm` readout underneath.
  - `N8` (`BASE CAMP`): Glowing neon green core with tent/HQ icon, label `"BASE CAMP"` and `"Safe ground"`.
  - **Node Down State (`N3` at `t=22s`, `N6` at `t=40s`):** Transition node to muted slate-gray with a warning triangle `⚠`, label `"NODE DOWN"`, and gray out connected links.
- [ ] **Step 4.3: Render Drones (`DR1`, `DR2`) & Tethered Balloons (`BL1`, `BL2`)**
  - **Drones (`t=54s`):** Launch from `N8` (Safe Ground), animate along smooth flight paths to `DR1`/`DR2` coordinates over `6s` with a faint dashed flight trail, spinning quadcopter SVG, ground shadow dot, and `"DRONE 1 · 80 m"` tag.
  - **Balloons (`t=66s`):** Inflate and rise vertically from safe-ground anchor points (`BL1`, `BL2`) over `8s`. Draw a vertical tether line connecting the ground anchor dot to the glowing cyan-white teardrop aerostat icon, with gentle horizontal sway and label `"BALLOON 1 · 100 m tethered"`.
  - **Make-Before-Break Handoff & Recall (`t=74s`–`t=83s`):** Bring balloon links online at `t=74s`, display `"Link handoff: no coverage gap"`, show `"battery low (illustrative)"` on drones, and fly `DR1`/`DR2` back to `N8` at `t=78s`.
- [ ] **Step 4.4: Node Inspection Popovers**
  - Clicking any node opens a tactical popover displaying: Role, Place name, Status, Connected Neighbors with live RSSI + Log-Distance Estimated Distance (`"~420 m (estimated)"`), Dongle Queue size, or Aerial Altitude/Tether status.

---

### Phase 5: Dynamic Links & 60fps Packet Animation (`src/map/LinkPacketLayer.js`)
- [ ] **Step 5.1: RSSI-Colored Links with EMA Breathing**
  - Draw links between active nodes colored dynamically by RSSI band (`#2ee66b` green, `#ffb020` amber, `#ff3b3b` red).
  - Apply $\pm 2\text{ dB}$ jitter smoothed via an Exponential Moving Average (EMA) each frame so dBm labels on links and sidebar bars breathe naturally.
  - Style backup/reroute paths and inactive links with dashed lines.
- [ ] **Step 5.2: Hop-by-Hop Glowing Packet Pulses (`SOS1`–`SOS4`)**
  - Render bright white/cyan glowing orbs with comet trails moving along geodesic link segments over `hopSeconds` (`1.2s` per hop), flashing each link and intermediate relay node upon arrival (modeling Store-before-ACK).
  - **SOS 1 (`t=10s`):** `N1 -> N2 -> N3 -> N4 -> N8` (normal ground delivery).
  - **SOS 2 (`t=26s`):** After `N3` fails at `t=22s`, briefly highlight the dashed alternate route and flow `N1 -> N2 -> N5 -> N6 -> N7 -> N8`.
  - **SOS 3 (`t=44s` — Store-and-Forward Showcase):** After `N6` fails at `t=40s`, `N5` creates `SOS3`. Transition to `STORED` and display a pulsing amber ring on `N5` with badge `"STORED IN DONGLE · Waiting for mesh..."`. Hold until `t=62s` (when `DR1`/`DR2` links come online), then automatically transmit `N5 -> DR1 -> DR2 -> N8`.
  - **SOS 4 (`t=86s` — High-Altitude Direct Link):** `N1` transmits directly upward to the 100m balloon backbone: `N1 -> BL1 -> BL2 -> N8`.

---

### Phase 6: Right-Hand Telemetry Sidebar & Base Camp Inbox (`src/ui/RightPanels.js`)
- [ ] **Step 6.1: Card 1 — `Message Log`**
  - Columns: `TIME (IST)`, `ID`, `STATUS`, `FROM -> TO`, `ROUTE`.
  - Color-coded status badges (`QUEUED`, `STORED`, `TRANSMITTING`, `SENT_TO_MESH`, `DELIVERED`, `FAILED`).
- [ ] **Step 6.2: Card 2 — `RSSI (Live)`**
  - Per-node horizontal signal bars (`Node 1 (DONGLE)` through `Node 8`, plus active `DR1`/`DR2`/`BL1`/`BL2`) with live dBm number, colored progress bar, and `● Online` / `⚠ Offline` indicator.
- [ ] **Step 6.3: Card 3 — `Network Stats`**
  - 2-column tactical grid matching the mockup:
    - Left: `Hop Count` (of last message), `Packet Success Rate` (`%`), `Avg. RSSI` (`-XX dBm`).
    - Right: `Total Nodes`, `Active Nodes`, `Down Nodes`, `Aerial Relays` (live count of active drones + balloons).
- [ ] **Step 6.4: Card 4 — `Base Camp Inbox`**
  - Columns: `ID`, `TIME (IST)`, `GPS (LAT, LON)`, `PEOPLE`, `NEED` (colored pill: Red `MEDICAL`, Amber `RESCUE`, Blue `FOOD`), `BATTERY` (red/orange `%`), `HOPS`, `STATUS`.
  - New SOS deliveries slide in with a neon highlight. Clicking any row smoothly pans/zooms the map to that survivor's coordinates and pulses their marker.

---

### Phase 7: Timeline Bar, Mode Toggles, Context Modal & Polish (`src/ui/`)
- [ ] **Step 7.1: Bottom Timeline & Controls (`TimelineBar.js`)**
  - Play/Pause circular neon button, draggable timeline slider (`0s`–`100s`) with labeled phase dots (`P1` to `P5`), simulated clock (`🕒 Sat 28 Sep, 04:05`), speed selector (`0.5x`, `1x`, `2x`), and `Aerial layer: ...` status dropdown/chip.
  - Action buttons on bottom-right: `[▶ Play Scenario]` and `[⚠ Simulate Disaster]` (manual node-kill trigger for live judge Q&A).
- [ ] **Step 7.2: `With mesh | Without mesh` Header Toggle**
  - **With mesh:** Full scenario plays; 4 SOS messages delivered; aerial relays deploy.
  - **Without mesh:** At `t=6s` cell towers go offline; mesh links and aerial relays remain hidden; SOS attempts at `t=10, 26, 44, 86` immediately fail with `"NO ROUTE — Phone network down"`; Base Camp Inbox remains empty (`0 delivered`).
- [ ] **Step 7.3: Context Modal, End-of-Run Summary Card & Honesty Footer (`Modals.js`)**
  - Collapsible `"Context & Response Plan"` drawer containing the 5 verified September 2024 Kathmandu flood fact cards (with AP, Reuters, ACAPS, Kantipur, and Nepal Telecom citations) + the 3-row `"Our Response Plan"` card (Drones vs. Balloons vs. Together).
  - At `t=96s`, display the comparison Summary Modal: `"With Mesh: 4 SOS Delivered, 2 Node Failures Survived, 2 Drones & 2 Balloons Deployed from Safe Ground"` vs. `"Without Mesh: 0 Delivered"`.
  - Permanent footer disclaimer: *"Simulation. Scripted scenario based on public reports of the September 2024 Kathmandu floods. Device positions, flood zone and message times are illustrative, not measured."*
- [ ] **Step 7.4: Keyboard Shortcuts (`main.js`)**
  - `Space` = Play/Pause, `R` = Restart, `K` = Kill next ground node (`Simulate Disaster`), `D` = Launch drones now, `B` = Raise balloons now, `M` = Toggle With/Without Mesh, `F` = Toggle Fullscreen.