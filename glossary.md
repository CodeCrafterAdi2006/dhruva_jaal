# Project Glossary & Core Concepts (Google Maps Emergency Responder Edition)

This document explains the foundational web, mapping, network graph, and UI concepts used in the Disaster Mesh project.

---

## 1. Professional Emergency Dashboard vs. "Sci-Fi Game HUD"

### What is the difference?
- **Sci-Fi / Game HUD:** Uses giant glowing spheres, neon bloom, excessive animations, dark post-apocalyptic rubble backgrounds, and oversized decorative cards. Looks like a movie prop.
- **Incident Command / Emergency Responder Dashboard:** Uses a restrained, map-centric interface modeled after Google Maps dark mode and professional network observability tools (like Datadog, Grafana, or Meraki). It prioritizes **immediate clarity, readability under sunlight or stress, thin precise borders, and high information density**.

---

## 2. What is Leaflet & Map Tile Layers?

### What is Leaflet?
**Leaflet** is the industry-standard, open-source JavaScript library for interactive 2D web maps. It handles:
- Smooth mouse drag-to-pan and scroll-to-zoom.
- Placing markers at geographic coordinates (Latitude / Longitude).
- Projecting pixel coordinates to geographic coordinates.

### What is a Tile Layer?
A digital map is not one giant image; it is divided into millions of small 256x256 pixel square images called **tiles**. 
- As you pan and zoom, Leaflet requests and stitches together the exact tiles needed for your screen.
- **CartoDB Dark Matter:** A widely-used tile layer that renders streets, buildings, water bodies, and borders in muted shades of charcoal, slate, and navy (`#111B2B`), creating the perfect high-contrast backdrop for colored network links.

---

## 3. What is an SVG Overlay on a Map?

**SVG (Scalable Vector Graphics)** defines 2D shapes (lines, circles, paths) using XML math instead of pixels.
- On top of our map tiles, we render an SVG overlay layer.
- When nodes connect, we draw an SVG `<line>` or `<path>` between their screen coordinates.
- When a packet moves, a small SVG `<circle>` smoothly animates along the `<path>`.
- Leaflet synchronizes the SVG coordinate system with the map so when you drag or zoom the map, the lines and markers stick precisely to their geographic locations.

---

## 4. What is a Network Graph & Adjacency List?

In computer science, a network of connected nodes is called a **Graph**:
- **Nodes (Vertices):** The physical LoRa devices (Dongle, Relays 1–6, Helper).
- **Edges (Links):** The wireless LoRa radio links between nodes within range of each other, each carrying a signal strength value (**RSSI in dBm**).

### Adjacency List
In code, we represent the network as a clean JavaScript object where each node lists who it can hear:
```javascript
const MESH_TOPOLOGY = {
  "DONGLE":  ["RELAY_1", "RELAY_2"],
  "RELAY_1": ["DONGLE", "RELAY_2", "RELAY_3"],
  "RELAY_2": ["DONGLE", "RELAY_1", "RELAY_4", "RELAY_5"],
  // ...
};
```

---

## 5. What is BFS (Breadth-First Search) Routing?

### Why BFS?
In a disaster mesh network, when a message needs to get from the trapped victim's **DONGLE** to the rescuer's **HELPER**, what path should it take?
- The simplest, most reliable wireless mesh protocol is **minimum-hop routing** (delivering the packet in the fewest number of radio relays to conserve battery and reduce collisions).

### How BFS Works:
1. Start at `DONGLE`.
2. Inspect all immediate neighbors (Hop 1).
3. If `HELPER` is not reached, inspect all neighbors of those neighbors (Hop 2).
4. Continue expanding like a wave until `HELPER` is reached.
5. **The Disaster Reroute:** If `RELAY_3` fails (`status: "DOWN"`), BFS simply skips `RELAY_3` during its search and finds the next valid shortest path through surviving relays (e.g., via `RELAY_4`).
6. If all paths are cut off, BFS returns `null`, and the UI displays **DELIVERY FAILED**.

---

## 6. Color Semantics in Emergency Systems
Colors must strictly communicate state, not decoration:
- **`#0B1220`:** App background (clean slate-navy)
- **`#111B2B`:** Map canvas background
- **`#101927`:** Sidebar telemetry background
- **`#263449`:** Subtle structural borders
- **`#4285F4` (Google Blue):** Primary actions, system selection, alternate routes
- **`#34C759` (Healthy Green):** Strong connection (-60 to -80 dBm), helper node, packet delivered
- **`#F5B942` (Warning Amber):** Moderate connection (-81 to -100 dBm), elevated latency
- **`#F05252` (Critical Red):** Weak connection (-101 to -120 dBm), trapped dongle, node down
