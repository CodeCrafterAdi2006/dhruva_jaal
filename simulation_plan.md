PROMPT START
1. Your task

Build a web app that replays a scripted real-world disaster scenario on a clean, Google-Maps-style map, showing how a LoRa mesh network of USB dongles would let SOS messages reach a rescue base camp when the phone network is down, and how a two-tier aerial relay layer (fast drones first, then tethered balloons) restores and then holds the connection without sending rescuers into the flood zone.

A mockup image is attached. It is FINAL. Match its layout, colors, panels, labels and glow style closely. Where this prompt adds things the mockup does not have (timeline bar, drones, balloons, flood zone, base-camp inbox, with/without toggle), extend the same visual language.

This is for a hackathon demo, so priorities are: (1) looks great, (2) never breaks live, (3) tells the story clearly. It does NOT need to be connected to real hardware, but the data layer must be built so real serial data can be plugged in later (see section 7).

2. Project context (so you understand what you are showing)
Disaster-relief communication system. A trapped person plugs a small USB-C LoRa dongle into their phone, types an SOS in a simple app and presses SEND.
The dongle is the mesh node. The phone is only the user interface. The dongle stores the message and keeps retrying until it reaches a nearby mesh node. Nodes forward it hop by hop (ACK, retry, deduplication, geographic forwarding) until it reaches a helper / base camp.
Rescuers add an AERIAL RELAY LAYER with two kinds of relays, each carrying a dongle:
DRONES: fastest to deploy. They launch from safe ground, fly over the gap and relay immediately. Limited flight time.
TETHERED BALLOONS: slower to set up, but once raised (around 100 m) they stay up for long periods and are cheap to keep running. They are anchored on safe, open ground.
Together: drones give the fastest first link, balloons take over as the persistent backbone, and drones are recalled. Neither requires rescuers to enter the flood zone to set up relays.
The SOS arriving at base camp carries: timestamp, GPS coordinates, number of people, type of need, sender phone battery, and delivery status. Rescue teams can be sent to confirmed coordinates instead of searching blind, which is the responder-safety benefit.
Message states (use exactly these): QUEUED, STORED, TRANSMITTING, SENT_TO_MESH, DELIVERED, FAILED.
Node roles and looks: DONGLE (red, the trapped person), RELAY (blue), HELPER / BASE CAMP (green), DRONE (cyan with a small rotor icon and altitude tag), BALLOON (soft white-teal teardrop icon with a thin tether line and altitude tag).
Everything is text-only and tiny. LoRa is low bandwidth.
3. The scenario: Kathmandu Valley floods, 27-29 September 2024

Title shown in the app header: "Kathmandu Valley Floods: What if the mesh was already there?"

Verified background (in our own words; use for the intro cards and info tooltips):

Rain began pounding Kathmandu on the night of Friday 27 Sep 2024. Flooding peaked on Saturday 28 Sep. Nine Kathmandu stations recorded the highest 24-hour rainfall since Nepal's current measurement system began in 1970. The Valley received roughly 240-322 mm in about a day.
Southern Kathmandu was largely inundated. Residents had to move to upper floors. Police reported 1,053 people rescued across Kathmandu by Saturday morning. An army helicopter picked up four people who could not leave their homes. Rescue also used boats.
Most of Kathmandu was without power and internet for a period of time. Nepal Telecom said mobile towers went down for lack of electricity and transmission links were affected. Flood warning SMS messages could not reach places where service was down.
Kathmandu was cut off for the weekend because all three highways out were blocked by landslides.
Army helicopters could only be sent to some affected districts once the weather improved on Saturday afternoon. (This is why aerial relays in our scenario go up only after the weather clears. Do NOT show drones or balloons in the air during the storm.)
Toll reported by AP on 30 Sep: 193 killed nationally, at least 34 in Kathmandu, 31 missing. Later humanitarian reporting (ACAPS) put it around 236 by 4 Oct.
By 1 Oct, restoring road and communication networks was listed as a priority need for rescue and relief.

Show these as 4 or 5 short "Context" cards in a collapsible intro panel with a small source line each (sources are listed at the bottom of this prompt). Do not invent any extra statistics.

Also show a separate "Our response plan" card (design rationale, not sourced facts) with three short rows:

Drones: "Fastest to deploy. Scout the gap and relay immediately. Limited flight time."
Balloons: "Tethered on safe ground, rise to about 100 m, stay up for long periods, low running cost. Slower to set up and fixed in place."
Together: "Drones give the first link, balloons take over as the backbone. Relays are set up from safe ground, so rescuers do not have to enter the flood zone."

IMPORTANT honesty rules (also show a small footer in the UI): "Simulation. Scripted scenario based on public reports of the September 2024 Kathmandu floods. Device positions, flood zone and message times are illustrative, not measured."

Do not claim the mesh would have saved a specific number of lives.
Do not claim dongles, drones or balloons were used in the real event.
Do not present hop latency, range, flight time, endurance, gas amounts or costs as measured or numeric facts. Describe them qualitatively ("fastest", "stays up longer", "low running cost").
Mark the flood zone and all coordinates as illustrative.
4. Scenario data (use this exactly; put it in src/data/scenario.json)

Coordinates are approximate and illustrative; keep them in one file so they are easy to nudge. Map libraries use [lon, lat] order, so convert carefully.

json
{
  "meta": {
    "title": "Kathmandu Valley Floods: What if the mesh was already there?",
    "event": "Kathmandu Valley floods, 27-29 Sep 2024",
    "disclaimer": "Simulation. Scripted scenario based on public reports of the September 2024 Kathmandu floods. Device positions, flood zone and message times are illustrative, not measured.",
    "map": { "center": { "lat": 27.6945, "lon": 85.3100 }, "zoom": 14.3, "pitch": 0, "bearing": 0 },
    "rssiBands": [
      { "name": "strong", "minDbm": -80, "maxDbm": -60, "color": "#2ee66b" },
      { "name": "medium", "minDbm": -100, "maxDbm": -81, "color": "#ffb020" },
      { "name": "weak", "minDbm": -120, "maxDbm": -101, "color": "#ff3b3b" }
    ],
    "hopSeconds": 1.2
  },
  "zones": [
    {
      "id": "FZ1", "type": "flood", "label": "Flood zone (illustrative)",
      "polygon": [
        { "lat": 27.6840, "lon": 85.2930 },
        { "lat": 27.6830, "lon": 85.3040 },
        { "lat": 27.6880, "lon": 85.3180 },
        { "lat": 27.6945, "lon": 85.3200 },
        { "lat": 27.6960, "lon": 85.3120 },
        { "lat": 27.6975, "lon": 85.3060 },
        { "lat": 27.6935, "lon": 85.3000 },
        { "lat": 27.6890, "lon": 85.2940 }
      ]
    },
    { "id": "SZ1", "type": "safe", "label": "Safe ground: relays are launched from here", "center": { "lat": 27.7020, "lon": 85.3160 }, "radius_m": 350 }
  ],
  "nodes": [
    { "id": "N1", "role": "dongle", "label": "DONGLE", "sublabel": "(trapped person)", "place": "Balkhu, rooftop", "lat": 27.6862, "lon": 85.2975 },
    { "id": "N2", "role": "relay", "label": "RELAY", "place": "Balkhu market household", "lat": 27.6905, "lon": 85.3015 },
    { "id": "N3", "role": "relay", "label": "RELAY", "place": "Teku ward volunteer", "lat": 27.6950, "lon": 85.3060 },
    { "id": "N4", "role": "relay", "label": "RELAY", "place": "Kalimati volunteer", "lat": 27.7000, "lon": 85.3105 },
    { "id": "N5", "role": "relay", "label": "RELAY", "place": "Sundarighat household", "lat": 27.6880, "lon": 85.3080 },
    { "id": "N6", "role": "relay", "label": "RELAY", "place": "Thapathali school", "lat": 27.6925, "lon": 85.3150 },
    { "id": "N7", "role": "relay", "label": "RELAY", "place": "Maitighar ward office", "lat": 27.6975, "lon": 85.3190 },
    { "id": "N8", "role": "helper", "label": "BASE CAMP", "sublabel": "(rescue HQ)", "place": "Central Kathmandu, safe ground", "lat": 27.7020, "lon": 85.3160 },
    { "id": "DR1", "role": "drone", "label": "DRONE 1", "alt_m": 80, "hidden": true, "lat": 27.6955, "lon": 85.3065 },
    { "id": "DR2", "role": "drone", "label": "DRONE 2", "alt_m": 80, "hidden": true, "lat": 27.6990, "lon": 85.3130 },
    { "id": "BL1", "role": "balloon", "label": "BALLOON 1", "alt_m": 100, "tethered": true, "hidden": true, "place": "Open high ground just north of the flood zone (illustrative)", "lat": 27.6978, "lon": 85.3035 },
    { "id": "BL2", "role": "balloon", "label": "BALLOON 2", "alt_m": 100, "tethered": true, "hidden": true, "place": "Open ground near base camp (illustrative)", "lat": 27.7000, "lon": 85.3150 }
  ],
  "cellTowers": [
    { "id": "T1", "lat": 27.7040, "lon": 85.3000 },
    { "id": "T2", "lat": 27.6900, "lon": 85.3250 },
    { "id": "T3", "lat": 27.7080, "lon": 85.3200 }
  ],
  "edges": [
    { "a": "N1", "b": "N2", "baseRssi": -72 },
    { "a": "N1", "b": "N5", "baseRssi": -88 },
    { "a": "N2", "b": "N3", "baseRssi": -78 },
    { "a": "N2", "b": "N5", "baseRssi": -83 },
    { "a": "N3", "b": "N4", "baseRssi": -76 },
    { "a": "N4", "b": "N8", "baseRssi": -70 },
    { "a": "N5", "b": "N6", "baseRssi": -81 },
    { "a": "N6", "b": "N7", "baseRssi": -79 },
    { "a": "N7", "b": "N8", "baseRssi": -74 },
    { "a": "N2", "b": "DR1", "baseRssi": -74, "droneLink": true },
    { "a": "N5", "b": "DR1", "baseRssi": -79, "droneLink": true },
    { "a": "DR1", "b": "DR2", "baseRssi": -72, "droneLink": true },
    { "a": "DR2", "b": "N4", "baseRssi": -70, "droneLink": true },
    { "a": "DR2", "b": "N8", "baseRssi": -66, "droneLink": true },
    { "a": "N1", "b": "BL1", "baseRssi": -97, "balloonLink": true },
    { "a": "N2", "b": "BL1", "baseRssi": -80, "balloonLink": true },
    { "a": "N5", "b": "BL1", "baseRssi": -86, "balloonLink": true },
    { "a": "BL1", "b": "N4", "baseRssi": -75, "balloonLink": true },
    { "a": "BL1", "b": "BL2", "baseRssi": -78, "balloonLink": true },
    { "a": "BL2", "b": "N4", "baseRssi": -68, "balloonLink": true },
    { "a": "BL2", "b": "N7", "baseRssi": -76, "balloonLink": true },
    { "a": "BL2", "b": "N8", "baseRssi": -64, "balloonLink": true }
  ],
  "timeline": [
    { "t": 0,  "type": "phase", "id": "P1", "label": "Heavy rain begins", "simClock": "Fri 27 Sep, 22:00" },
    { "t": 6,  "type": "phase", "id": "P2", "label": "Power and phone network fail", "simClock": "Sat 28 Sep, 03:30" },
    { "t": 6,  "type": "towers", "status": "offline" },
    { "t": 10, "type": "sos", "id": "SOS1", "from": "N1", "path": ["N1", "N2", "N3", "N4", "N8"], "people": 3, "need": "MEDICAL", "battery": 23, "simClock": "Sat 28 Sep, 04:05", "text": "TRAPPED. 3 PEOPLE. NEED MEDICAL ASSISTANCE." },
    { "t": 22, "type": "node_status", "id": "N3", "status": "down", "reason": "Flooded, power lost", "simClock": "Sat 28 Sep, 05:40" },
    { "t": 26, "type": "sos", "id": "SOS2", "from": "N1", "path": ["N1", "N2", "N5", "N6", "N7", "N8"], "people": 5, "need": "RESCUE", "battery": 17, "simClock": "Sat 28 Sep, 06:10", "text": "WATER ABOVE FIRST FLOOR. 5 PEOPLE ON ROOF. NEED BOAT." },
    { "t": 40, "type": "node_status", "id": "N6", "status": "down", "reason": "Flooded, power lost", "simClock": "Sat 28 Sep, 07:10" },
    { "t": 44, "type": "sos", "id": "SOS3", "from": "N5", "path": ["N5", "DR1", "DR2", "N8"], "people": 4, "need": "RESCUE", "battery": 12, "simClock": "Sat 28 Sep, 07:30", "text": "STUCK ON 2ND FLOOR. 4 PEOPLE INCLUDING CHILDREN. NEED BOAT.", "holdUntil": 62 },
    { "t": 54, "type": "phase", "id": "P3", "label": "Weather clears. Drones launch from safe ground (fastest first link)", "simClock": "Sat 28 Sep, ~15:00" },
    { "t": 54, "type": "drones_launch", "ids": ["DR1", "DR2"], "from": "N8", "flightSeconds": 6 },
    { "t": 60, "type": "drones_online", "ids": ["DR1", "DR2"] },
    { "t": 66, "type": "phase", "id": "P4", "label": "Tethered balloons rise from safe ground (persistent backbone)", "simClock": "Sat 28 Sep, ~16:30" },
    { "t": 66, "type": "balloons_launch", "ids": ["BL1", "BL2"], "riseSeconds": 8 },
    { "t": 74, "type": "balloons_online", "ids": ["BL1", "BL2"] },
    { "t": 78, "type": "phase", "id": "P5", "label": "Balloons hold the link. Drones hand off and return to base", "simClock": "Sat 28 Sep, ~17:30" },
    { "t": 78, "type": "drones_recall", "ids": ["DR1", "DR2"], "to": "N8", "flightSeconds": 5, "reason": "Handoff complete, return to base" },
    { "t": 86, "type": "sos", "id": "SOS4", "from": "N1", "path": ["N1", "BL1", "BL2", "N8"], "people": 5, "need": "FOOD", "battery": 8, "simClock": "Sat 28 Sep, 19:40", "text": "STILL ON ROOF. 5 PEOPLE. NEED FOOD AND WATER." },
    { "t": 96, "type": "summary", "delivered": 4, "nodeFailures": 2, "dronesDeployed": 2, "balloonsDeployed": 2, "withoutMesh": { "delivered": 0 } }
  ]
}

Scenario logic the engine must produce:

t=0-6: all 8 ground nodes online, 3 cell towers shown online (small tower icons, green). The flood zone polygon (translucent blue, dashed outline) and the safe-ground circle around base camp (translucent green, dashed outline) are visible from the start, labeled.
t=6: towers turn gray/offline; banner "Phone network DOWN". In the "Without mesh" view this is the end of the story: SOS attempts show "NO ROUTE" and the base camp inbox stays empty.
t=10: SOS1 is created on N1. State progression: QUEUED -> STORED (dongle ACK) -> TRANSMITTING -> SENT_TO_MESH (first hop ACK) -> a glowing packet travels hop by hop along path, each link flashing -> DELIVERED at N8. Base camp inbox gets a new row.
t=22: N3 goes down (turns gray, "NODE DOWN" tag with warning icon, as in the mockup). Links to N3 become dashed/gray.
t=26: SOS2 is sent. The scripted path avoids N3. Show a brief "rerouting" highlight (dashed alternate route, as in the mockup), then delivery.
t=40: N6 goes down. Nodes N1, N2, N5 are now cut off from the rest of the ground mesh.
t=44: SOS3 is created on N5. It reaches STORED and stays there. Show the dongle retrying (pulsing ring, "waiting for mesh" text). It must NOT show TRANSMITTING success until the drones are online. This demonstrates store-and-forward.
t=54: phase P3. Drones DR1 and DR2 take off from base camp (N8, inside the safe-ground circle), fly to their positions over flightSeconds, with a small altitude tag and a faint dashed trail from N8. Show a chip "Aerial layer: DRONES (fast response)".
t=60: drones online. Drone links appear with RSSI colors. Mesh reconnects.
t=62: SOS3 is released, flows N5 -> DR1 -> DR2 -> N8, DELIVERED.
t=66: phase P4. Balloons BL1 and BL2 inflate and rise vertically from their anchor points over riseSeconds: the icon grows slightly as it rises, a thin tether line stays connected to a small anchor marker on the ground, altitude tag counts up to "100 m, tethered", gentle sway afterwards. Their anchors must sit outside the flood zone (they do in the data). Chip changes to "Aerial layer: DRONES + BALLOONS".
t=74: balloons online. Balloon links appear with RSSI colors. Show a "Link handoff: no coverage gap" tag (balloon links come up BEFORE drone links are removed: make-before-break).
t=78: phase P5. Drones are recalled: they fly back to N8 over flightSeconds and disappear on landing, their links fade out, and traffic stays on the balloon links. Chip changes to "Aerial layer: BALLOONS (persistent)". Drone popovers show "battery low (illustrative)" starting a few seconds before recall.
t=86: SOS4 is sent from N1 and travels N1 -> BL1 -> BL2 -> N8 (elevated relays hear the trapped dongle directly, which ground nodes could not). DELIVERED, inbox row added.
t=96: summary card (see section 5).

Playback must be deterministic from this JSON (same run every time), with play / pause / restart / scrub and a speed selector (0.5x, 1x, 2x). Default is 1x, and the full run lasts about 100 seconds.

5. UI requirements

Layout (match the mockup):

Top-left: logo + "LoRa Mesh Network / Disaster Relief" with a "Live" pill. In scenario mode the pill reads "Scenario" until the live source is connected.
Left: legend card exactly like the mockup (strong/medium/weak with dBm ranges, alternate route, packet flow, node active, node down). Add entries for: drone icon, balloon icon (with tether), flood zone (illustrative), safe ground.
Center: the map with nodes, links, RSSI labels on links, range rings, packets with trails, a compass, scale bar, and +/- / locate buttons. Draw the flood zone and safe-ground zone as soft translucent shapes beneath nodes.
Right column (keep the mockup cards):
"Message Log": entries with timestamp, message id, state color, from, size, via-path, hop count.
"RSSI (Live)": per-node bar list with the color bands. Down nodes show "OFFLINE". Aerial relays appear in the list when active.
"Network Stats": hop count (of last delivered message), packet success rate, average RSSI, total nodes (active / down), plus "Aerial relays: drones / balloons" counts that update live.
Button: "Simulate Disaster" (kills a node on demand, as a manual trigger) next to a "Play Scenario" button.
NEW, bottom: timeline bar with play/pause, scrubber, speed selector, phase markers (P1 to P5), and the simulated clock ("Sat 28 Sep, 04:05"). Marker ticks for node failures and SOS events.
NEW, base camp inbox (collapsible card, bottom-right or right column): a table of received SOS with columns: ID, received time (sim clock), GPS (lat, lon), people, need (colored chip: MEDICAL / RESCUE / FOOD / SHELTER), phone battery %, hops, status. New rows slide in with a highlight. Clicking a row flies the map to that sender and pulses their marker.
NEW, "With mesh / Without mesh" toggle in the header. Without mesh: cell towers go gray at t=6, mesh and aerial links hidden, aerial relays never appear, SOS attempts end in "NO ROUTE" and the inbox stays empty, with a counter "SOS received: 0". With mesh: the full story.
NEW, "Aerial layer" status chip near the timeline (see logic steps 8, 11, 13).
NEW, summary card at the end: "4 SOS delivered, 2 node failures survived, 2 drones and 2 balloons deployed from safe ground" vs "Without mesh: 0 delivered". Add a "Responder safety" line: "Relays were set up from safe ground. Rescue teams can go straight to confirmed coordinates." and the note "Scripted simulation".
NEW, collapsible intro panel with the 4-5 context cards from section 3, the "Our response plan" card, and the honesty footer.
Clicking a node opens a small popover: role, place, status, RSSI of its links, estimated distance to neighbors, queue size (for dongles). For drones: altitude and battery (illustrative). For balloons: altitude and "tethered, anchored on open ground".

Visual style:

Match the mockup: dark navy map, neon green / orange / red links, glowing blue relay nodes with translucent range rings, red pulsing dongle, green helper icon, soft bloom.
Drone: cyan icon with a subtle rotor spin. Balloon: soft white-teal teardrop with a thin tether line, slow sway. Both get a small altitude tag and a faint ground shadow dot so altitude reads in a top-down map.
The basemap must look like a clean, modern web map (water, roads, parks, street names) and be muted so overlays pop. Default to the dark style used in the mockup, and add a light "Google-Maps-like" toggle if time allows.
No Google Maps API key. Use MapLibre GL JS with a free no-key basemap (for example OpenFreeMap vector tiles, or CARTO raster basemap tiles with OpenStreetMap attribution). Always show map attribution.
Smooth 60 fps animation. Use requestAnimationFrame. Packets move along straight geodesic segments between nodes with a fading trail.
Must look good at 1920x1080 on a projector and still work on a laptop screen. Large readable text.
6. RSSI and distance
Link colors, thickness and bar fill come from RSSI using the bands in meta.rssiBands.
Each frame, add small noise (plus or minus 2 dB, smoothed with an exponential moving average) around baseRssi so values breathe slightly but stay stable. Down links show no RSSI.
Show an estimated distance next to each link in popovers using the log-distance path loss model: d = 10 ^ ((RSSI_REF_1M - RSSI) / (10 * n)) Put RSSI_REF_1M and PATH_LOSS_N in a config file. Tune them so estimated distances are roughly consistent with the real map distance between nodes (compute real distance with the haversine formula; for aerial nodes combine ground distance and altitude with the Pythagorean formula) and add a comment explaining the calibration. Label it "estimated".
Do not implement trilateration. Node positions come from the scenario file. (A later version may estimate positions from RSSI.)
7. Architecture (important)

Stack: Vite + TypeScript (or JavaScript if faster), plain DOM or React, MapLibre GL JS. Keep dependencies small. npm install && npm run dev must be all that is needed. No backend is required for scenario mode.

Data layer:

Define one DataSource interface that emits typed events: node, node_status, link, sos / msg (with state changes), aerial (launch, rising, online, recall, landed), clock, phase.
Implement ScenarioSource (plays scenario.json, the default).
Implement a stub WebSocketSource (reads JSON events from ws://localhost:8765, same event shapes) so teammates can later feed real serial data through a small Python bridge. Select the source with a URL param, e.g. ?source=ws.
The UI must only depend on the event stream, never on the scenario file directly.

Example live-event shapes the WebSocket source must accept:

json
{"type":"link","from":"N1","to":"N2","rssi":-72}
{"type":"msg","id":"SOS1","state":"SENT_TO_MESH","path":["N1","N2","N3","N4","N8"]}
{"type":"node_status","id":"N3","status":"down"}
{"type":"sos","id":"SOS1","from":"N1","lat":27.6862,"lon":85.2975,"people":3,"need":"MEDICAL","battery":23,"ts":"2024-09-28T04:05:00+05:45"}
{"type":"aerial","id":"BL1","kind":"balloon","status":"online","alt_m":100}

Resilience:

If the map tiles fail to load (venue Wi-Fi), the app must still render nodes, links, zones and panels on a plain dark background with a faint grid and show a small "basemap offline" notice. The demo must never show a blank screen.
No external calls other than map tiles.

Keyboard shortcuts: Space = play/pause, R = restart, K = kill next node, D = launch drones, B = raise balloons, M = toggle with/without mesh, F = fullscreen.

8. Suggested build order (commit after each step; check each in the browser before moving on)
Vite project, full-screen MapLibre map centered on meta.map, dark basemap, attribution.
Load scenario.json; draw zones, nodes (role colors, labels, glow, range rings) and links (RSSI colors, dBm labels).
Build the right-hand panels and left legend to match the mockup.
Implement the scenario engine (timeline clock, play/pause/scrub/speed) emitting events.
Animate packets along paths, message states, message log and base camp inbox.
Node failure + reroute visuals, store-and-forward waiting state.
Drones: launch, flight, links, release of SOS3.
Balloons: rise, tether, sway, links, make-before-break handoff, drone recall, SOS4.
With/without mesh toggle, aerial layer chip, summary card, intro and response-plan cards, footer disclaimer.
Polish: bloom/glow, easing, popovers, keyboard shortcuts, offline basemap fallback.
WebSocketSource stub and README with run instructions and how to edit scenario.json.
9. Acceptance checklist
 Looks like the attached mockup (layout, colors, panels, labels).
 Full scenario runs unattended in about 100 s at 1x with no errors in the console.
 All 4 SOS behave as described, including reroute, store-and-forward and the balloon-carried SOS4.
 Drones and balloons appear only after the "weather clears" phase. Drones launch first; balloons rise after; drones are recalled only after balloon links are up (no coverage gap).
 Flood zone and safe-ground circle are visible and labeled "illustrative"; all aerial launches start from safe ground and balloon anchors are outside the flood zone.
 Without-mesh view shows 0 delivered and no aerial relays; with-mesh view shows 4 delivered.
 Base camp inbox shows timestamp, GPS, people, need, battery, hops, status for each SOS.
 Disclaimer footer is visible. No invented statistics, costs or endurance numbers.
 Works with no internet except map tiles; graceful fallback if tiles fail.
 npm install && npm run dev works on a clean machine. README included.

Work step by step. Before writing code, reply with a short plan and the file tree you intend to create. Ask me nothing unless something is truly blocking; make sensible choices and note them in the README.

PROMPT END
Appendix: sources for the facts in section 3 (for the pitch teammate too)

The drone + balloon plan is our own design rationale, not something from these sources. The sources below cover only the 2024 flood facts.

AP, "Flooding in Nepal's capital kills at least 32 people" (28 Sep 2024), e.g. via The Himalayan Times: https://thehimalayantimes.com/ampArticle/1029048
AP, "Flooding deaths in Nepal reach 193 as recovery work is stepped up" (30 Sep 2024): https://www.clickondetroit.com/news/world/2024/09/30/flooding-toll-in-nepal-reaches-193-as-recovery-work-is-stepped-up/
Reuters via The Globe and Mail (28 Sep 2024): https://www.theglobeandmail.com/world/article-nepal-floods-and-landslides-kill-at-least-66-people-69-missing
ACAPS briefing note on Nepal floods, via ReliefWeb (7 Oct 2024): https://reliefweb.int/report/nepal/acaps-briefing-note-nepal-floods-central-and-eastern-districts-07-october-2024
Kantipur, "Communication services are interrupted during the crisis" (29 Sep 2024): https://ekantipur.com/business/2024/09/29/en/communication-services-are-interrupted-during-the-crisis-00-58.html
Nepal Telecom restoration note (29 Sep 2024): https://www.nepalitelecom.com/2024/09/nepal-telecom-restoring-services-impacted-by-floods-landslides.html
Kantipur, "Army helicopters were sent to three districts for rescue" (28 Sep 2024): https://ekantipur.com/news/2024/09/28/en/army-helicopters-were-sent-to-three-districts-for-rescue-47-36.html
Wikipedia overview (for cross-checking only): https://en.wikipedia.org/wiki/2024_Nepal_floods

Before the pitch, re-open these links and confirm any number you say out loud. Death tolls changed over time depending on the date and source.

Likely judge questions on the aerial layer (prepare answers): airspace permission, wind and rain limits, lifting gas supply and safety (helium vs hydrogen), who operates and trains the teams, and why balloons stay fixed while drones can reposition.