MODULAR LoRa DISASTER-RELIEF MESH
V1 MVP PLAN

GOAL
----
Build battery-powered LoRa nodes that can reliably deliver an
emergency message to a Helper through a multi-hop network.

The network should:
- Discover nearby nodes automatically
- Know the approximate position of neighbors
- Know the approximate position of the Helper
- Prefer forwarding toward the Helper geographically
- Retry failed transmissions
- Store and send messages before acknowledging them
- Prevent duplicate messages
- Survive individual node failures
- Prefer reliability over latency

V1 IS NOT ABOUT MAXIMUM RANGE.
The primary goal is RELIABILITY.


============================================================
1. V1 HARDWARE
============================================================

Each node:

    ESP32 
          |
          | SPI
          v
       SX1278
          |
          v
       Antenna

    ESP32
      |
      +-- GPS
      |
      +-- Battery

Initial prototype should use development boards.

Minimum:
- ESP32 - c3
- SX1278 LoRa module
- External antenna
- Battery
-GPS (neo 6m)

============================================================
2. LoRa CONFIGURATION
============================================================

Initial target: (test setup)

    Frequency:       433 MHz
    Bandwidth:       125 kHz
    Coding Rate:     4/5
    Spreading Factor: Test SF7–SF10

Do not implement dynamic SF selection initially.

Priority:

    RELIABILITY
        >
    LINK STABILITY
        >
    NETWORK CAPACITY
        >
    LATENCY


============================================================
3. NODE IDENTITY
============================================================

Every node has a permanent ID.

Example:

    NODE_001
    NODE_002
    NODE_003
    NODE_004
    NODE_005

Each node initially stores:

    NODE_ID
    NODE_POSITION
    HELPER_ID
    HELPER_POSITION

Example:

    NODE_ID         = NODE_003
    POSITION        = (x, y)
    HELPER_ID       = NODE_005
    HELPER_POSITION = (x, y)

Dynamic Helper updates are NOT part of initial V1.


============================================================
4. NEIGHBOR DISCOVERY
============================================================

Every node periodically broadcasts:

    HELLO

Example:

    HELLO {
        node_id
        position
        position_accuracy
        sequence_number
        signal strength
    }

When a node receives HELLO:

    RECEIVE HELLO
          |
          v
    CHECK CRC
          |
          v
    UPDATE NEIGHBOR TABLE
          |
          v
    RECORD RSSI / SNR
          |
          v
    CONTINUE LISTENING


Neighbor information:

    Neighbor {
        node_id
        position
        position_accuracy

        rssi
        snr

        last_seen
        hello_count
        missed_hellos

        packets_sent
        packets_acked
        packets_failed

        reliability
    }


A node should distinguish:

    HEARD
       |
       v
    CANDIDATE
       |
       | repeated successful communication
       v
    ACTIVE NEIGHBOR
       |
       | repeated failures
       v
    STALE


Maximum active forwarding neighbors:    4

The node may know about more than 4 nodes, but normally only
4 strongest are considered active forwarding neighbors.


============================================================
5. HELLO BEHAVIOR
============================================================

Neighbor discovery must NOT be a blocking startup phase.

Do NOT do:

    BOOT
      |
      v
    DISCOVER FOR 30 SECONDS
      |
      v
    START NETWORK

Instead:

    BOOT
      |
      v
    START RECEIVING
      |
      v
    START NETWORK OPERATION
      |
      +---- HELLO
      |
      +---- DATA
      |
      +---- ACK
      |
      +---- HELLO
      |
      +---- DATA
      |
      +---- ...


HELLO transmissions should use randomized timing/jitter so that
all nodes do not transmit simultaneously.


============================================================
6. GEOGRAPHIC FORWARDING
============================================================

A node does NOT initially run full A*.

Instead, use local geographic forwarding.

Each node knows:

    MY POSITION
    HELPER POSITION
    NEIGHBOR POSITIONS

Example:

             HELPER
                ^
                |
        B       |
       /        |
      /         |
     A          C

A compares its neighbors.

Example:

    A -> Helper = 5 km

    B -> Helper = 3 km
    C -> Helper = 4 km

B provides more geographic progress.

Therefore:

    A -> B


Initially use simple rules:

    1. Prefer neighbors that make progress toward Helper.
    2. Prefer reliable radio links.
    3. Prefer historically reliable neighbors.
    4. Keep more than one useful forwarding option when possible.

============================================================
7. ROUTING SCORE
============================================================

Eventually the forwarding decision can use:

    forwarding_score =
        geographic_progress
        +
        link_quality
        +
        historical_reliability

For the first implementation, keep it simple.

Example:

    Is neighbor closer to Helper?
        |
        +-- YES
        |
        v
    Is link reliable?
        |
        +-- YES
        |
        v
    Candidate for forwarding


Do not spend time tuning mathematical weights before collecting
real measurements.


============================================================
8. MESSAGE and PACKET FORMAT
============================================================
PACKET format:
Packet{
packet_type,
packet_data,
packet_crc
}

example Types: ACK, INI (setup), SYNC (resync), Req (actual msg)

example-DATA packet:

    DATA {
        message_id (node id + local id)
        source_id (node id),
	geolocation (lati, longi and altitude)
        destination_id 
        ttl
        hop_count
        payload,
	timestamp
    }

Payload : 
medical?, no of people?,

Example:

    MESSAGE_ID  = NODE_001-00042
    SOURCE      = NODE_001
    DESTINATION = NODE_005
    GEO 	       = 31.525,561.1655 , altitude)
    TTL         = 10
    HOP_COUNT   = 2
    PAYLOAD:yes, 2
TIMESTAMP = 09


Every transmitted packet must also have a CRC-->CRC8.


============================================================
9. MESSAGE CREATION
============================================================

When a node creates a message:

    CREATE MESSAGE
          |
          v
    GENERATE MESSAGE_ID
          |
          v
    STORE LOCALLY
          |
          v
    FIND USEFUL NEIGHBOR
          |
          v
    FORWARD


A message is stored locally before transmission.


============================================================
10. MESSAGE RECEIVING
============================================================

When a node receives DATA:

    RECEIVE
       |
       v
    CHECK CRC
       |
       v
    CHECK MESSAGE_ID
       |
       +---- OLD MESSAGE ----> Ignore duplicate
       |
       v
    NEW MESSAGE
       |
       v
    STORE
       |
       v
    ACK
       |
       v
    EVENTUALLY FORWARD


IMPORTANT:

    STORE BEFORE ACK


The receiver must not acknowledge a message until it has been
successfully stored.


============================================================
11. DUPLICATE PREVENTION
============================================================

Messages will naturally travel through multiple paths.

Example:

    A -> B -> D
    A -> C -> D

D may receive the same message twice.

D checks:

    Have I already seen MESSAGE_ID?

If YES:

    Do not create another copy.
    Do not forward another copy.

The node may still respond appropriately to retransmissions.


============================================================
12. ACKNOWLEDGEMENT
============================================================

Basic exchange:

    NODE A                       NODE B

       DATA ---------------------->

                                  CHECK CRC
                                  STORE

          <----------------------- ACK


ACK means:

    "I successfully received and stored this message."


ACK does NOT mean:

    "The message reached the Helper."


_Those are different concepts.
-ALSO we will send a final ACK from the helper node back the path taken to tell "yes i have received the msg"

============================================================
13. RETRY
============================================================

If ACK is not received:  --> the node to node ack (store and pass )

    DATA
      |
      v
    TIMEOUT
      |
      v
    RANDOM BACKOFF
      |
      v
    RETRY
      |
      v
    TIMEOUT
      |
      v
    LONGER BACKOFF
      |
      v
    RETRY


Initial V1:

    Maximum retries = 5

Use randomized/exponential backoff to reduce collisions.


============================================================
14. TTL
============================================================

Every message starts with a TTL.

Example:

    TTL = 10

Every forwarding operation:

    TTL = TTL - 1
    HOP_COUNT = HOP_COUNT + 1

When:

    TTL == 0

The node stops forwarding the message.

This prevents messages from circulating forever.


============================================================
15. ROUTING FAILURE / RECOVERY
============================================================

Geographic routing can get stuck.

Example:

                  HELPER
                     ^
                     |
                 B   |
                /
               /
              A

A chooses B because B is closer.

But B may be a dead end.

For V1:

    NORMAL ROUTING
          |
          v
    No useful geographic neighbor
          |
          v
    RECOVERY MODE
          |
          v
    Try another active neighbor


Do not implement sophisticated geographic-routing recovery yet.


============================================================
16. V1 PACKET TYPES
============================================================

Only use:

    ACK
    INI (setup) (initial HELLO)
    HELLO
    DATA (actual msg)
    HELLO

HELLO:
    Announces node presence.

DATA:
    Carries an actual message.

ACK:
    Confirms successful reception and storage.

DELIVERY:
    Indicates that the Helper received the message.

DELIVERY will trace back the path taken and tell each node along the way that the msg has received by the HELPER node.


============================================================
17. MESSAGE INVENTORY
============================================================

DO NOT implement inventory exchange in the first MVP.

Future feature:

    NODE A:
        I HAVE:
        A001
        A002
        B004

    NODE B:
        I NEED:
        A001
        B004

This will eventually reduce unnecessary LoRa airtime.

Implement it after basic routing works.


============================================================
18. SOFTWARE ARCHITECTURE
============================================================

Keep the firmware simple:

    main
      |
      +-- lora
      |
      +-- packet
      |
      +-- neighbor
      |
      +-- message_store (not rn)
      |
      +-- routing
      |
      +-- ack_retry
      |
      +-- config


Responsibilities:

    lora
        SX1278 communication

    packet
        Packet encoding/decoding
        CRC (CRC-8)

    neighbor
        HELLO
        Neighbor table
        RSSI/SNR
        Link statistics

    message_store
        Persistent messages
        Message IDs
        Deduplication

    routing
        Geographic forwarding
        Neighbor selection
        Recovery

    ack_retry
        ACK handling
        Timeouts
        Retries
        Backoff

    config
        NODE_ID
        Position
        Helper ID
        Network configuration


============================================================
19. DEVELOPMENT MILESTONES
============================================================

MILESTONE 1 — BASIC RADIO
-------------------------

Build:

    NODE A <--------> NODE B

Implement:

    LoRa transmission
    LoRa reception
    Packet format
    CRC

DONE WHEN:

    A and B can reliably exchange packets.


------------------------------------------------------------

MILESTONE 2 — ACK + RETRY
-------------------------

Implement:

    DATA
    ACK
    Timeout
    Retry
    Random backoff

Test:

    Intentionally lose packets.

DONE WHEN:

    A automatically retransmits when B does not ACK.


------------------------------------------------------------

MILESTONE 3 — PERSISTENT STORAGE
---------------------------------

Implement:

    MESSAGE_ID
    Message storage
    Deduplication

Test:

    A -> B
    Reboot B
    Inspect B

DONE WHEN:

    The message survives B's reboot.


------------------------------------------------------------

MILESTONE 4 — NEIGHBOR DISCOVERY
---------------------------------

Build:

    NODE A
    NODE B
    NODE C

Implement:

    HELLO
    Neighbor table
    RSSI
    SNR
    Position

DONE WHEN:

    Every node can identify nearby nodes and estimate
    the quality of their links.


------------------------------------------------------------

MILESTONE 5 — GEOGRAPHIC FORWARDING
------------------------------------

Build:

    A -> B -> C

Configure:

    A = SOURCE
    C = HELPER

A should not have a manually configured route.

A should choose B because B provides geographic progress.

DONE WHEN:

    A creates a message
      |
      v
    A chooses B
      |
      v
    B stores message
      |
      v
    B chooses C
      |
      v
    C receives message


------------------------------------------------------------

MILESTONE 6 — REDUNDANCY
------------------------

Build:

             B
            / \
           /   \
          A     D
           \   /
            \ /
             C

C = Helper

A should have multiple possible paths:

    A -> B -> C

or:

    A -> D -> C

DONE WHEN:

    The message can still reach C after B is turned off.


------------------------------------------------------------

MILESTONE 7 — FAILURE TESTING
------------------------------

Intentionally introduce:

    Node failures
    Packet loss
    Node reboot
    Temporary disconnection
    Moving nodes
    Multiple simultaneous messages
    Simultaneous transmissions

Measure:

    Delivery rate
    Retry count
    Number of hops
    Duplicate count
    Delivery time
    Lost messages


============================================================
20. V1 SUCCESS CRITERIA
============================================================

V1 is complete when:

    [ ] 3–5 nodes operate independently.

    [ ] Nodes discover nearby nodes automatically.

    [ ] Nodes maintain neighbor information.

    [ ] Nodes know approximate positions.

    [ ] Nodes know approximate Helper position.

    [ ] Geographic forwarding works.

    [ ] Messages are stored before ACK.

    [ ] Messages survive node reboot.

    [ ] Duplicate messages are suppressed.

    [ ] Failed transmissions are retried.

    [ ] TTL prevents infinite propagation.

    [ ] Multiple forwarding paths can exist.

    [ ] A message can survive at least one forwarding-node failure.

    [ ] A message eventually reaches the Helper.

    [ ] Delivery and retry statistics can be measured.


============================================================
21. EXPLICITLY OUT OF SCOPE FOR V1
============================================================

Do NOT build:

    Custom PCB
    Solar power
    Drone integration
    LTE/4G
    Sensors
    OLED/e-paper
    Dynamic Helper
    Authentication
    Encryption
    Full A*
    Dynamic spreading-factor selection
    Message inventory exchange
    Advanced congestion control
    Advanced sleep/power optimization
    Sophisticated routing recovery


These are V2+ features.


============================================================
22. FINAL V1 ARCHITECTURE
============================================================

                         HELPER
                            ^
                            |
                   Geographic forwarding
                            |
                 +----------+----------+
                 |                     |
              NODE B                NODE D
                 ^                     ^
                 |                     |
                 +---------+-----------+
                           |
                         NODE A
                          SOURCE


Each node:

    ESP32
       |
       +-- SX1278
       |     |
       |     +-- 433 MHz
       |     +-- Fixed BW
       |     +-- Tested SF
       |
       +-- GPS
       |
       +-- Battery


Protocol:

    HELLO
      |
      v
    Discover neighbors
      |
      v
    Maintain neighbor table
      |
      v
    Select geographically useful neighbor
      |
      v
    DATA
      |
      v
    Verify CRC
      |
      v
    STORE
      |
      v
    ACK
      |
      v
    FORWARD
      |
      v
    HELPER
      |
      v
    DELIVERY


CORE PHILOSOPHY

    STORE before FORWARD

    VERIFY before STORE

    ACK after STORE

    RETRY when ACK is missing

    DEDUPLICATE using MESSAGE_ID

    LIMIT propagation using TTL

    USE geographic information to reduce unnecessary flooding

    KEEP multiple forwarding possibilities for resilience

    PREFER reliability over latency


V1 END GOAL:

    "A small network of independent LoRa nodes can discover
     each other, use rough geographic information to select
     useful forwarding nodes, reliably store and retransmit
     messages, survive node failures, and eventually deliver
     an emergency message to the Helper."

============================================================
23. PHONE USB LoRa DONGLE
============================================================

PURPOSE
-------

The USB LoRa dongle allows a person with only a phone and the
dongle to communicate with the disaster-relief LoRa mesh.

The dongle acts as a bridge between:

    PHONE <-> USB <-> LoRa MESH


The phone does NOT need a LoRa radio.

The dongle contains the LoRa radio and the firmware required to
communicate with the mesh.


============================================================
24. DONGLE ARCHITECTURE
============================================================

Physical form:

    USB DONGLE

Example:

    +--------------------------------+
    |                                |
    |       ESP32 / MCU              |
    |             |                  |
    |             | SPI              |
    |             v                  |
    |          SX1278                |
    |             |                  |
    |             v                  |
    |          ANTENNA               |
    |                                |
    +--------------------------------+
             |
          USB-C
             |
             v
           PHONE


The dongle contains:

    MCU
    SX1278 LoRa radio
    USB interface
    Antenna
    battery/power management

--> THE DONGLE IS THE MAIN THING, PHONE IS JUST A USER INTERFACE, DONGLE SHOULD ACT AS A RELAY AS WELL

============================================================
25. PHONE <-> DONGLE COMMUNICATION
============================================================

Communication:

    PHONE
      |
     USB
      |
      v
    DONGLE


The phone app sends commands to the dongle.

Example:

    APP -> USB -> DONGLE

    SEND_MESSAGE {
        message_id
        message_type
        payload
    }


The dongle responds:

    DONGLE -> USB -> APP

    STATUS {
        message_id
        state
    }


Possible states:

    QUEUED
    STORED
    TRANSMITTING
    SENT_TO_MESH
    DELIVERED
    FAILED


============================================================
26. DONGLE USB PROTOCOL
============================================================

The USB connection should expose a simple interface.

Possible V1 approach:

    USB CDC / Serial

The phone app communicates with the dongle using a simple
framed protocol.

Example:

    APP -> DONGLE

    SEND|MSG001|SOS|I am trapped in building A


    DONGLE -> APP

    ACK|MSG001|STORED


Later, this can become a proper binary protocol.

Do NOT make the phone understand LoRa packets directly.


============================================================
27. PHONE APP
============================================================

The app should be extremely simple.

Main screen:

    +--------------------------------+
    |       DISASTER MESH            |
    |                                |
    |  DONGLE: CONNECTED             |
    |  MESH: CONNECTED               |
    |                                |
    |  Emergency message:            |
    |                                |
    |  [__________________________]  |
    |                                |
    |    [medical ASSISTANCE?]       |
    |       [no.of people]           |
    |                                |
    |                                |
    |       [ SEND ]                 |
    |                                |
    |  Status: MESSAGE STORED        |
    +--------------------------------+


The app should handle:

    USB connection
    Message composition
    Message submission
    Message status
    Dongle battery/status if available


The app should NOT handle:

    Neighbor discovery
    Routing
    Geographic forwarding
    ACK/retry between mesh nodes
    TTL
    LoRa configuration


Those belong to the dongle/mesh firmware.


============================================================
28. DONGLE AS A MESH EDGE NODE
============================================================

The dongle should behave like a normal mesh node from the
network's perspective.

It can:

    CREATE messages
    RECEIVE messages
    STORE messages
    FORWARD messages
    ACK messages
    RETRY messages


Therefore:

    PHONE
      |
      v
    DONGLE
      |
      v
    MESH


Once a message enters the dongle, it becomes a normal DATA message.


============================================================
29. PHONE MESSAGE FLOW
============================================================

Example:

A person is trapped and has no cellular/Wi-Fi connectivity.

    1. Connect dongle to phone.

    2. Open app.

    3. Enter:

       "TRAPPED.
        3 PEOPLE.
        NEED MEDICAL ASSISTANCE."

    4. Press SEND.

    5. App sends message over USB.

    6. Dongle stores message locally.

    7. Dongle searches for/uses a nearby mesh node.

    8. Dongle transmits DATA.

    9. Mesh node stores the message.

   10. Mesh node ACKs the dongle.

   11. Mesh forwards the message through the network.

   12. Helper eventually receives the message.

   13. Delivery status can propagate back through the mesh.


============================================================
30. DONGLE MESSAGE STORAGE
============================================================

The dongle should have its own small persistent message queue (if possible with the internal esp32 c3 memory).

Example:

    +-------------------------+
    | DONGLE MESSAGE STORE    |
    +-------------------------+
    | MSG001                  |
    | MSG002                  |
    | MSG003                  |
    +-------------------------+


If the dongle temporarily cannot reach the mesh:

    PHONE
      |
      v
    DONGLE
      |
      v
    STORE MESSAGE
      |
      v
    WAIT
      |
      v
    FIND MESH
      |
      v
    TRANSMIT


The trapped person should NOT need to keep retransmitting
the message manually.


============================================================
31. DONGLE POWER
============================================================

Initial V1:
Dongle have its own battery

============================================================
32. DONGLE PHYSICAL DESIGN
============================================================

Target form:

    Small USB-C dongle

Example:

              ANTENNA
                 |
                 |
        +--------+--------+
        |                 |
        |    LoRa USB     |
        |     DONGLE      |
        |                 |
        +-----------------+
                 |
              USB-C
                 |
                 v
               PHONE


The antenna should ideally be positioned so that it is not
completely blocked by the phone.


============================================================
33. DONGLE V1
============================================================

V1 hardware:

    ESP32 / suitable USB-capable MCU
    SX1278
    Antenna
    USB-C
    Battery

V1 software:

    USB communication
    LoRa communication
    Mesh protocol
    Message storage
    ACK/retry
    Basic status reporting


V1 phone app:

    USB connection
    Send text
    Display connection status
    Display message status
    Receive messages


============================================================
34. UPDATED SYSTEM ARCHITECTURE
============================================================


                     HELPER
                        ^
                        |
                  LoRa MESH
              /       |       \
             /        |        \
          NODE       NODE      NODE
           ^                    ^
           |                    |
          LoRa                 LoRa
           |                    |
       USB DONGLE             NODE
           ^
           |
          USB
           |
         PHONE
           ^
           |
      TRAPPED PERSON


There are therefore two types of message origin:

    NORMAL NODE
        |
        v
      DATA


    PHONE
        |
       USB
        |
     DONGLE
        |
        v
      DATA


After entering the mesh, both are handled identically.


============================================================
35. IMPORTANT ARCHITECTURAL RULE
============================================================

The phone should NOT become part of the mesh.

The dongle is the mesh participant.

Therefore:

    PHONE
        =
    USER INTERFACE


    USB DONGLE
        =
    LoRa EDGE NODE


    MESH
        =
    RELIABLE MESSAGE TRANSPORT


    HELPER
        =
    DESTINATION


This keeps the system modular and means the same mesh can later
support other edge devices without changing its core protocol.


============================================================
36. UPDATED DEVELOPMENT ORDER
============================================================

PHASE 1
    LoRa node <-> LoRa node

PHASE 2
    ACK + retry

PHASE 3
    Persistent storage + deduplication

PHASE 4
    Neighbor discovery

PHASE 5
    Geographic forwarding

PHASE 6
    Multi-path + failure testing

PHASE 7
    USB LoRa dongle

    PHONE
      |
     USB
      |
    DONGLE
      |
     LoRa
      |
    NODE

PHASE 8
    Phone app

PHASE 9
    Full integration

    PHONE
      |
     USB
      |
    DONGLE
      |
    MESH
      |
    MESH
      |
    HELPER


FINAL CONCEPT:

    A trapped person only needs:

        PHONE + USB LoRa DONGLE

    They type an emergency message and press SEND.

    Everything after that is handled by the mesh.

---that was the original markdown---

important stuff again
we are using gps ( neo 6m)
esp32 c3
lora sx1278

-max passing : 10 nodes
-max neighbour: 4 nodes
-each packet will keep the node id it went through
-rough packet design [type-packet-crc]
types: ack,res,ini,sync
packet: longitude,latitude, msg
crc- crc8

-add ons-
in the live simulation, we need to show a per msg log, that contains:
    Path taken ( node ids)
    Time stamp
    Status
    route

Then RSSI of the nodes
network status {avg hop count, msg success rate, avg rssi, avg total node hop, total nodes, active nodes, down nodes,}
we are also using ballons (industrial) instead of drones, drones are still used but only for the area that is inaccessable.