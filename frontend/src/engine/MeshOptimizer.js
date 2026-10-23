// Algorithmic RF Mesh Optimizer & Dynamic Aerial Dispatcher
// Analyzes live network topology, detects signal voids caused by submerged nodes,
// and computes optimal 3D coordinates for Aerial Drones and Tethered Balloons.

export class MeshOptimizer {
  constructor(scenarioNodes) {
    this.scenarioNodes = scenarioNodes || [];
  }

  /**
   * Spherical distance in meters between two [lon, lat] coordinates
   */
  distanceMeters(lon1, lat1, lon2, lat2) {
    const R = 6371e3;
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(dl / 2) * Math.sin(dl / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Determine disconnected clusters and compute optimal drone dispatch coordinates
   * @param {Array} activeNodes - Current nodes with online/down status
   * @param {Array} activeEdges - Current active links
   * @param {string} baseCampId - ID of Base Camp HQ (default 'N8')
   */
  detectCoverageGaps(activeNodes, activeEdges, baseCampId = 'N8') {
    const onlineNodes = activeNodes.filter(n => n.status === 'online' && n.visible !== false);
    const nodeMap = new Map(onlineNodes.map(n => [n.id, n]));

    if (!nodeMap.has(baseCampId)) return [];

    // 1. Build adjacency graph
    const adj = new Map();
    onlineNodes.forEach(n => adj.set(n.id, []));
    activeEdges.forEach(e => {
      if (e.active && nodeMap.has(e.a) && nodeMap.has(e.b)) {
        adj.get(e.a).push(e.b);
        adj.get(e.b).push(e.a);
      }
    });

    // 2. Find all nodes reachable from Base Camp (BFS)
    const reachable = new Set();
    const queue = [baseCampId];
    reachable.add(baseCampId);

    while (queue.length > 0) {
      const curr = queue.shift();
      const neighbors = adj.get(curr) || [];
      for (const next of neighbors) {
        if (!reachable.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }

    // 3. Identify isolated online nodes (survivors or relays cut off from Base Camp)
    const isolatedNodes = onlineNodes.filter(n => !reachable.has(n.id));
    if (isolatedNodes.length === 0) return []; // Full network healthy

    // 4. Find the closest pair (isolatedNode, reachableNode) to find the gap
    let minGapDist = Infinity;
    let bestPair = null;

    isolatedNodes.forEach(iso => {
      reachable.forEach(reachId => {
        const reachNode = nodeMap.get(reachId);
        if (!reachNode) return;
        const dist = this.distanceMeters(iso.lon, iso.lat, reachNode.lon, reachNode.lat);
        if (dist < minGapDist) {
          minGapDist = dist;
          bestPair = { isolated: iso, reachable: reachNode, dist };
        }
      });
    });

    if (!bestPair) return [];

    // 5. Calculate drone bridge requirements
    // Drone reliable radio horizon: ~1200m
    const maxHopDistance = 1200;
    const numDronesNeeded = Math.max(1, Math.min(4, Math.ceil(bestPair.dist / maxHopDistance)));

    const recommendedDrones = [];
    for (let i = 1; i <= numDronesNeeded; i++) {
      const fraction = i / (numDronesNeeded + 1);
      const lon = bestPair.isolated.lon + fraction * (bestPair.reachable.lon - bestPair.isolated.lon);
      const lat = bestPair.isolated.lat + fraction * (bestPair.reachable.lat - bestPair.isolated.lat);
      recommendedDrones.push({
        index: i,
        lon,
        lat,
        alt_m: 80,
        targetZone: `Between ${bestPair.isolated.id} and ${bestPair.reachable.id}`,
        gapDistanceMeters: Math.round(bestPair.dist)
      });
    }

    return recommendedDrones;
  }
}
