# Disaster Mesh: 3D Live Visualizer (Idea)

## Project in one line
A trapped person plugs a USB-C LoRa dongle into their phone, types an emergency message, and presses SEND. The dongle stores it and pushes it into a LoRa mesh, which forwards it hop by hop (ACK, retry, geographic forwarding) until a helper receives it.

## My role
Take live serial data and turn it into a live 3D representation of the mesh, using signal strength (dB / RSSI) to show position and distance.

## Goal for the hackathon
Not a perfect simulation. The visualizer must **convey how the system works** and **look great**. A dummy data source is fine as long as the demo is convincing. Build on fake data first, then plug in real serial if time allows.

---

## Architecture

```
Serial port / Simulator  ->  Python backend  ->  WebSocket  ->  3D web page (Three.js)
```

- **Data source:** `pyserial` reader OR a fake-data generator (same output format, so they are swappable).
- **Backend:** Python + `websockets` (or Flask-SocketIO). Parses each line into JSON and broadcasts it.
- **Frontend:** Three.js (Vite project). Listens on the WebSocket and updates the scene.

Why this split: the demo never depends on hardware working on the day.

---

## RSSI to position (the technical catch)

RSSI gives **distance, not direction**. One reading cannot place a node in 3D.

1. **Distance** (log-distance path loss):
   `d = 10 ^ ((TxPower - RSSI) / (10 * n))`
   - `TxPower` = RSSI measured at 1 m (calibrate)
   - `n` = path-loss exponent, about 2.7 to 3.5 outdoors / around buildings
2. **Position** = trilateration from 3+ nodes at known positions (least squares with numpy / `scipy.optimize`).
3. **Hackathon shortcut:** hard-code fixed node positions; estimate only the dongle's position, or lay nodes out at radius proportional to distance. Say honestly in the pitch that positions are estimated.
4. **Smooth the noise:** moving average or a simple Kalman filter, so dots do not jitter.

---

## What to show

- **Nodes:** glowing spheres, colored by role (dongle = red, relay = blue, helper = green).
- **Links:** lines whose color and thickness follow RSSI (strong = bright green, weak = dim red).
- **Range rings:** translucent expanding rings around nodes.
- **Message packets:** bright dots with trails travelling hop by hop along the path.
- **Message states:** QUEUED, STORED, TRANSMITTING, SENT_TO_MESH, DELIVERED, FAILED.
- **Node failure + reroute:** a node turns gray and the packet takes another path.
- **"Simulate disaster" button:** kills a node live. Best demo moment.
- **HUD panel:** per-link RSSI, message log, hop count.
- **Scene:** dark grid floor or low-poly collapsed-building area for disaster context, with orbit camera controls.

---

## Event format (agree on this with the firmware teammate on day one)

Raw serial line (example):
```
RSSI|NODE_A|NODE_B|-87
MSG|MSG001|SENT_TO_MESH|D>A>C>H
NODE|C|DOWN
```

JSON sent to the browser:
```json
{"type":"link","from":"A","to":"B","rssi":-87}
{"type":"msg","id":"MSG001","path":["D","A","C","H"],"state":"SENT_TO_MESH"}
{"type":"node","id":"C","status":"down"}
```

---

## Build order (prompts for Antigravity)

1. Three.js scene with orbit controls, dark grid floor, bloom glow (Vite).
2. Add 6 node spheres with labels at fixed positions.
3. Draw lines between nodes, color by RSSI value.
4. Animate a packet along a path of nodes.
5. Python WebSocket server emitting fake JSON events every 500 ms.
6. Connect the page to the WebSocket and update the scene from events.
7. Add HUD, node-failure and reroute animation, "Simulate disaster" button.
8. Swap the fake generator for a `pyserial` reader.
9. Polish, then record a backup demo video.

---

## What to learn (YouTube search terms)

- Three.js beginner crash course (plus "Three.js in 100 seconds")
- Three.js UnrealBloomPass glow effect
- Three.js move object along CatmullRomCurve3
- react-three-fiber + drei (only if you know React)
- Python WebSocket server tutorial
- pyserial tutorial (reading serial data)
- RSSI distance estimation / log-distance path loss
- Trilateration explained
- Moving average / Kalman filter for RSSI (optional polish)

---

## Timeline

| Time | Task |
|------|------|
| Hour 1-2 | Scene, nodes, camera controls |
| Hour 3-4 | Fake data server, live updates |
| Hour 5-6 | Packets, link colors, failure + reroute, HUD |
| Last stretch | Real serial hookup, polish, backup demo video |

---

## Pitch notes

- Lead with the story: trapped person, no network, dongle + phone, SEND.
- Show the packet travelling, then kill a node and show the reroute.
- Be upfront that positions are estimated from RSSI.
- Open question: sections 1-22 of the project doc (packet format, routing) would let me match the event format exactly.