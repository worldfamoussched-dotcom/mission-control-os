export interface RolePair {
  role1: string
  role2: string
}

export interface CoOccurrenceEdge {
  pair: RolePair
  co_occurrence_weight: number
  last_session_id: string
  session_count: number
}

export interface HebbianGraph {
  edges: Map<string, CoOccurrenceEdge>
  ring_distance_map: Map<string, string[]>
  inactive_session_threshold: number
  dominance_threshold: number
}

export interface HebbianUpdate {
  pair: RolePair
  old_weight: number
  new_weight: number
  triggered_ring_tightening: boolean
  reason: string
}

const WEIGHT_CAP = 10
const WEIGHT_FLOOR = 0
const DECAY_MULTIPLIER = 0.95
const RING_TIGHTENING_THRESHOLD = 5
const DEFAULT_DOMINANCE_THRESHOLD = 8

function pairKey(role1: string, role2: string): string {
  const sorted = [role1, role2].sort()
  return `${sorted[0]}|${sorted[1]}`
}

export function initializeHebbianGraph(ring_distance_map: Map<string, string[]>, inactive_threshold: number = 10): HebbianGraph {
  return {
    edges: new Map(),
    ring_distance_map,
    inactive_session_threshold: inactive_threshold,
    dominance_threshold: DEFAULT_DOMINANCE_THRESHOLD
  }
}

export function updateCoOccurrence(graph: HebbianGraph, role1: string, role2: string, session_id: string): HebbianUpdate {
  if (!role1 || !role2) {
    return {
      pair: { role1, role2 },
      old_weight: 0,
      new_weight: 0,
      triggered_ring_tightening: false,
      reason: 'invalid_roles'
    }
  }

  const key = pairKey(role1, role2)
  const existing = graph.edges.get(key)
  const old_weight = existing?.co_occurrence_weight ?? 0
  const new_weight = Math.min(old_weight + 1.0, WEIGHT_CAP)

  const edge: CoOccurrenceEdge = {
    pair: { role1, role2 },
    co_occurrence_weight: new_weight,
    last_session_id: session_id,
    session_count: (existing?.session_count ?? 0) + 1
  }

  graph.edges.set(key, edge)

  const triggered_ring_tightening = new_weight >= RING_TIGHTENING_THRESHOLD && (existing?.co_occurrence_weight ?? 0) < RING_TIGHTENING_THRESHOLD

  return {
    pair: { role1, role2 },
    old_weight,
    new_weight,
    triggered_ring_tightening,
    reason: 'co_occurrence_recorded'
  }
}

export function computeRolePairWeight(graph: HebbianGraph, role1: string, role2: string): number {
  const key = pairKey(role1, role2)
  return graph.edges.get(key)?.co_occurrence_weight ?? 0
}

export function decayInactiveWeights(graph: HebbianGraph, role_pair: RolePair, sessions_inactive: number): HebbianUpdate {
  const key = pairKey(role_pair.role1, role_pair.role2)
  const existing = graph.edges.get(key)

  if (!existing) {
    return {
      pair: role_pair,
      old_weight: 0,
      new_weight: 0,
      triggered_ring_tightening: false,
      reason: 'pair_not_found'
    }
  }

  const old_weight = existing.co_occurrence_weight
  const decay_steps = Math.floor(sessions_inactive / 1)
  let decayed_weight = old_weight * Math.pow(DECAY_MULTIPLIER, decay_steps)
  decayed_weight = Math.max(decayed_weight, WEIGHT_FLOOR)

  const updated_edge: CoOccurrenceEdge = {
    ...existing,
    co_occurrence_weight: decayed_weight
  }

  graph.edges.set(key, updated_edge)

  return {
    pair: role_pair,
    old_weight,
    new_weight: decayed_weight,
    triggered_ring_tightening: false,
    reason: 'decay_applied'
  }
}

export function evaluateRingTightening(graph: HebbianGraph, role_pair: RolePair): boolean {
  const weight = computeRolePairWeight(graph, role_pair.role1, role_pair.role2)
  return weight >= RING_TIGHTENING_THRESHOLD
}

export function applyHebbianDelta(graph: HebbianGraph, role1: string, role2: string, session_id: string): HebbianUpdate {
  const update = updateCoOccurrence(graph, role1, role2, session_id)

  if (update.triggered_ring_tightening) {
    const current_distance = computeRingDistance(graph, role1, role2)
    if (current_distance > 1) {
      tightenRingDistance(graph, role1, role2)
    }
  }

  return update
}

function computeRingDistance(graph: HebbianGraph, role1: string, role2: string): number {
  const ring_map = graph.ring_distance_map
  if (!ring_map.has(role1) || !ring_map.has(role2)) {
    return 999
  }

  const neighbors1 = ring_map.get(role1) || []
  if (neighbors1.includes(role2)) {
    return 1
  }

  const visited = new Set<string>([role1])
  const queue: [string, number][] = [[role1, 0]]

  while (queue.length > 0) {
    const [current, distance] = queue.shift()!

    if (current === role2) {
      return distance
    }

    const next_neighbors = ring_map.get(current) || []
    for (const neighbor of next_neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push([neighbor, distance + 1])
      }
    }
  }

  return 999
}

function tightenRingDistance(graph: HebbianGraph, role1: string, role2: string): void {
  const ring_map = graph.ring_distance_map
  if (!ring_map.has(role1) || !ring_map.has(role2)) {
    return
  }

  const neighbors1 = ring_map.get(role1) || []
  const neighbors2 = ring_map.get(role2) || []

  if (!neighbors1.includes(role2) && neighbors1.length > 0 && neighbors2.length > 0) {
    const closest_to_role2 = neighbors1[0]
    const closest_neighbors = ring_map.get(closest_to_role2) || []

    if (!closest_neighbors.includes(role2)) {
      const updated_neighbors = [...closest_neighbors, role2]
      ring_map.set(closest_to_role2, updated_neighbors)
    }
  }
}

export function enforceWeightBounds(graph: HebbianGraph): void {
  for (const edge of graph.edges.values()) {
    edge.co_occurrence_weight = Math.max(WEIGHT_FLOOR, Math.min(edge.co_occurrence_weight, WEIGHT_CAP))
  }
}

export function enforceNoSingleDominance(graph: HebbianGraph): void {
  const weights = Array.from(graph.edges.values()).map(e => e.co_occurrence_weight)
  if (weights.length === 0) {
    return
  }

  const max_weight = Math.max(...weights)
  if (max_weight > graph.dominance_threshold) {
    for (const edge of graph.edges.values()) {
      if (edge.co_occurrence_weight === max_weight) {
        edge.co_occurrence_weight = Math.min(edge.co_occurrence_weight, graph.dominance_threshold)
      }
    }
  }
}
