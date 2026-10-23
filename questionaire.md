# Technical Questionnaire for NotebookLM & Engineering Validation
**Notebook ID:** `ef0a0f39-7694-4fee-a8c8-8419fbc9cf44`  
**Sources:** SX1278 Datasheet, LoRaWAN IoT Manual, Meshtastic Zine, ESP-IDF ESP32-C3 Reference, Computer Networks, Three.js & MapGL Tutorials, Data Visualization Principles, Python Automation.

---

## 1. LoRa Radio & Propagation Physics
*Sources: `sx1276_77_78_79.pdf`, `Book-LoRa-LoRaWAN-and-Internet-of-Things.pdf`*

1. **RSSI-to-Distance Math Calibration:**  
   For an SX1278 transceiver operating at 433 MHz with a 125 kHz bandwidth and SF7–SF10 in an urban/suburban flood basin with wet ground, what are typical calibrated reference RSSI values at 1 meter ($RSSI_{1m}$) and recommended path loss exponents ($n$) for the log-distance path loss model:
   $$d = 10^{\frac{RSSI_{1m} - RSSI}{10 \cdot n}}$$
2. **Elevated Line-of-Sight (Fresnel Zone Clearance):**  
   What is the first Fresnel zone radius at 433 MHz over a 2–3 km link, and how much clearance does elevating an aerial relay to 80m (drone) or 100m (balloon) provide over flooded urban terrain compared to ground-level nodes?
3. **SNR Sensitivity Floor & Demodulation Thresholds:**  
   At SF10 and 125 kHz bandwidth, what is the minimum demodulation SNR limit (e.g., -15 dB) before packets fail CRC check, and how does receiver sensitivity correlate with RSSI between -100 dBm and -120 dBm?
4. **Aerial Ground Plane & Antenna Orientation Effects:**  
   When a dipole or monopole antenna is suspended beneath an aerostat/balloon at 100m or mounted on a drone, what radiation pattern distortions or nulls occur, and what is the optimal tilt/orientation to maximize ground coverage across a 3 km radius?

---

## 2. Mesh Protocol, Store-and-Forward & ESP32 Firmware
*Sources: `Iffy_Books_Meshtastic_Zine_2022_screen.pdf`, `esp-idf-en-v5.3-esp32.pdf`, `computer-networks-a-systems-approach...pdf`*

5. **Store-and-Forward Buffer Management on ESP32-C3:**  
   What is the best pattern to handle persistent message queue storage and deduplication on an ESP32-C3 using internal memory or NVS when a node is disconnected from the mesh, ensuring messages survive power dips or reboots without flash wear degradation?
6. **CRC8 & Framing Protocol Standards:**  
   What standard polynomial is recommended for CRC8 calculation across variable-length text packets (like `MSG|ID|PAYLOAD|CRC`), and what are best practices for packet deduplication across multi-hop paths to prevent broadcast storms?
7. **Store-Before-ACK vs Hop-by-Hop ACK Overhead:**  
   How does the "store-before-ACK" protocol impact channel airtime utilization at 433 MHz compared to standard CSMA/CA, and what timeout/jitter backoff formula best prevents ACK collision when multiple relays overhear a single transmission?
8. **Geographic Routing Loop & Dead-End Recovery:**  
   In greedy geographic forwarding (MFR - Most Forwarding within Radius), when a message reaches a local minimum (e.g., nodes $N_1$, $N_2$, $N_5$ cut off by dead nodes $N_3$ and $N_6$), what is the simplest lightweight fallback rule to trigger store-and-forward holding without infinite bounce loops?

---

## 3. MapLibre GL + Three.js 3D WebGL Integration
*Sources: `threejs_tutorial.pdf`, `mapgl.pdf`*

9. **Custom WebGL Layer Matrix Synchronization:**  
   In MapLibre GL JS CustomLayerInterface, how do you correctly sync the MapLibre projection matrix with a Three.js scene so that 3D objects (vertical tether cylinders, radio cones, and 3D Bezier curves) anchor precisely to geographical coordinates $[lng, lat]$ and altitude $z$ during pitch (50°) and camera rotation?
10. **Volumetric Cones & Performance Optimization:**  
    What is the most performant, low-draw-call approach in Three.js to render semi-translucent volumetric radio coverage cones (inverted cone geometry with custom vertex/fragment shader or transparent double-sided mesh) and traveling photon pulses along 3D curves at 60 FPS without crashing browser WebGL contexts?
11. **Interpolated 3D Splines for Drone Takeoff/Landing:**  
    What is the cleanest way in Three.js to generate smooth 3D Catmull-Rom or cubic Bezier curves connecting a ground coordinate $[lng_0, lat_0, 0]$ to an aerial hovering coordinate $[lng_1, lat_1, 80m]$, allowing smooth progress evaluation ($t \in [0, 1]$) for drone ascent and descent?

---

## 4. Emergency UI & Telemetry Visualization
*Sources: `fundamentals-of-data-visualization...pdf`*

12. **High-Stress Incident Telemetry Design:**  
    What are the proven cognitive principles for representing link degradation, multi-hop latency, and triage urgency (e.g., medical vs rescue vs food) in an emergency operations center dashboard so that incident commanders can make triage decisions in under 3 seconds without color collision or cognitive overload?
13. **Temporal Map Animations & Scrubbing Ergonomics:**  
    When visualizing multi-stage crisis timeline data (rain $\rightarrow$ blackout $\rightarrow$ node failure $\rightarrow$ drone launch $\rightarrow$ balloon handoff), how should map transitions and time scrubbing be eased to maintain the operator's spatial orientation without disorienting cuts or visual noise?
