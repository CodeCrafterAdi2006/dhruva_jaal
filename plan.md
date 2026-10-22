# Master Implementation Plan: Clean Google Maps LoRa Mesh Dashboard

## Objective
Build a polished, professional web dashboard for visualizing a disaster-relief LoRa mesh network. 
The interface mirrors **Google Maps dark mode + modern network observability tools**: minimal, precise, information-dense, and immediately understandable to emergency response engineers.

---

## Architectural Principles
1. **Map-Centric Interface:** The network map dominates 75–80% of the screen width, with a compact 20–25% telemetry sidebar on the right.
2. **Restrained Color Palette:**
   - App Root: `#0B1220`
   - Map Area: `#111B2B`
   - Sidebar: `#101927`
   - Subtle Borders: `#263449`
   - Text: Primary `#E5EAF2`, Muted `#8B9BB0`
   - Semantics: Green `#34C759` (Healthy), Amber `#F5B942` (Warning), Red `#F05252` (Alert/Dongle/Down), Accent Blue `#4285F4`.
3. **No Sci-Fi Clutter:** No oversized 3D spheres, no heavy neon bloom, no giant glassmorphic cards. Crisp markers, clean vector lines, and precise telemetry meters.
4. **Deterministic Graph Routing:** Real graph data structure and BFS routing algorithm that physically reroutes packets when a node goes down.

---

## Step-by-Step Execution Checklist

### Phase 1: Environment & Project Setup
- [x] **Step 1.1: Project Directory & File Structure**
  - Scaffold `frontend/` directory with Vite vanilla JavaScript template.
- [x] **Step 1.2: Dependencies & Fonts Setup**
  - Install `leaflet` mapping library.
  - Import Google Fonts: `Inter` (UI elements) and `JetBrains Mono` (telemetry, RSSI, timestamps).
  - Prepare clean inline SVG icons (signal bars, message status, location recenter, play/reset).

---

### Phase 2: Design System & Core Layout (HTML & CSS)
- [x] **Step 2.1: CSS Design Tokens & Reset**
  - Configure CSS custom properties for palette (`--bg-app`, `--bg-map`, `--bg-sidebar`, `--border-subtle`, status colors).
  - Configure typography scale (`font-family: 'Inter'`, monospace font for data).
- [x] **Step 2.2: Main Responsive Grid (80/20 Layout)**
  - Split viewport into two primary columns:
    - Left (75–80%): Map container (`#map-container`) with floating overlay controls (recenter, zoom, compact legend).
    - Right (20–25%): Sidebar container (`#sidebar`) with subtle vertical divider border (`#263449`).
  - Mobile responsiveness: stack sidebar below map on screens < 900px.

---

### Phase 3: Interactive Dark Map & Mesh Graph
- [x] **Step 3.1: Leaflet Dark Map Initialization**
  - Initialize Leaflet centered over a disaster scenario location (e.g., an urban district with muted building footprints).
  - Load dark tile layer (CartoDB DarkMatter or Stadia Alidade Smooth Dark).
  - Add compact zoom and recenter controls.
- [ ] **Step 3.2: Graph Data Structure & 8 Mesh Nodes**
  - Define node models in code:
    - 1 Red DONGLE marker (`#F05252` — trapped person).
    - 6 Blue RELAY markers (`#4285F4` — intermediate hops).
    - 1 Green HELPER marker (`#34C759` — rescue team).
  - Render crisp circular markers with subtle halos and non-overlapping labels showing Node ID and RSSI.
  - Add subtle, translucent range rings around nodes upon selection.
- [ ] **Step 3.3: Link Visualization (SVG / Polyline Layer)**
  - Draw connection lines between neighbors based on link strength:
    - Green (`#34C759`) for -60 to -80 dBm.
    - Amber (`#F5B942`) for -81 to -100 dBm.
    - Red (`#F05252`) for -101 to -120 dBm.
    - Dashed line for alternate routes.
  - Render small, legible dBm tag badges along links.

---

### Phase 4: Deterministic BFS Routing & Packet Animation
- [ ] **Step 4.1: Routing Engine (BFS Shortest Path)**
  - Implement minimum-hop search from `DONGLE` to `HELPER` traversing only active nodes.
  - Calculate hop count and path array (`["DONGLE", "RELAY_1", "RELAY_3", "HELPER"]`).
- [ ] **Step 4.2: Smooth Packet Flow Animation**
  - Animate a small white packet indicator (`●`) gliding smoothly along the active route line from hop to hop.
  - Loop packet dispatch at controlled intervals.

---

### Phase 5: Telemetry Sidebar Construction
- [ ] **Step 5.1: Message Log Section**
  - Live log table showing Message ID, timestamp, delivery status pill (`STORED`, `SENT_TO_MESH`, `DELIVERED`), and route path.
- [ ] **Step 5.2: Live Network Node Table**
  - List of 8 nodes with node role, numeric dBm readout, compact horizontal signal-strength bar, and online/offline status pill.
- [ ] **Step 5.3: Network Statistics Cards**
  - 4-grid key metrics:
    - Active Nodes (`7 / 8`)
    - Hop Count (`4`)
    - Average RSSI (`-78 dBm`)
    - Packet Delivery Success Rate (`98.4%`)

---

### Phase 6: Disaster Simulation & Alternate Routing
- [ ] **Step 6.1: "Simulate Disaster" Trigger & State Transition**
  - Implement primary button: `▶ Simulate Disaster`.
  - On click:
    - A designated relay node (e.g., `RELAY_3`) transitions to `offline` / `NODE DOWN` (marker turns muted gray).
    - Sever failed connections.
    - Rerun BFS routing engine to discover the surviving alternate route.
    - Render alternate route as a dashed blue/neutral line.
    - Reroute animated packet along new path.
    - Update sidebar statistics (hop count increases, delivery status logs new route).
- [ ] **Step 6.2: Reset Network State Control**
  - Implement `↺ Reset Network` button to restore the failed node and revert back to default state.

---

### Phase 7: Verification & Polish
- [ ] **Step 7.1: Visual Hierarchy & Label Collision Check**
  - Ensure all 8 node labels and dBm tags are crisp, non-overlapping, and legible.
- [ ] **Step 7.2: Desktop & Mobile Responsive Verification**
  - Test browser resizing, sidebar collapsing, and map interaction.
