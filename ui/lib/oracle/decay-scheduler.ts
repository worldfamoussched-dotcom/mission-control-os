import type { RolePair, HebbianGraph } from './hebbian-dynamics'

export type DecayTrigger = 'inactive_session' | 'manual_trigger' | 'consolidation_event'
export type QuarantineReason = 'low_confidence' | 'orphaned_anchor' | 'cross_domain_anomaly'
export type DecayRecommendation = 'hold' | 'decay' | 'consolidate'

export interface DecayJob {
  pair: RolePair
  trigger: DecayTrigger
  sessions_since_activity: number
  confidence_before: number
  confidence_after: number
}

export interface QuarantineDecision {
  pair: RolePair
  quarantined: boolean
  reason: QuarantineReason | null
  recommendation: DecayRecommendation
  confidence: number
  explanation: string
}

const CONFIDENCE_QUARANTINE_THRESHOLD = 0.3
const ORPHANED_ANCHOR_MIN_WEIGHT = 0.1

function computeConfidenceAfterDecay(
  weight: number,
  sessions_inactive: number,
  observed_sessions: number
): number {
  const decay_multiplier = Math.pow(0.95, sessions_inactive)
  const decayed_weight = weight * decay_multiplier
  const confidence = decayed_weight * Math.min(observed_sessions / 5, 1.0)
  return Math.max(confidence, 0)
}

function isOrphanedAnchor(graph: HebbianGraph, pair: RolePair): boolean {
  const weight = computeRolePairWeight(graph, pair.role1, pair.role2)
  if (weight < ORPHANED_ANCHOR_MIN_WEIGHT) {
    return false
  }
  const incomingCount = countIncomingEdges(graph, pair)
  return incomingCount === 0 && weight > 0
}

function computeRolePairWeight(graph: HebbianGraph, role1: string, role2: string): number {
  const sorted = [role1, role2].sort()
  const key = `${sorted[0]}|${sorted[1]}`
  return graph.edges.get(key)?.co_occurrence_weight ?? 0
}

function countIncomingEdges(graph: HebbianGraph, pair: RolePair): number {
  let count = 0
  for (const edge of graph.edges.values()) {
    if (edge.pair.role1 === pair.role1 || edge.pair.role2 === pair.role1) {
      count++
    }
    if (edge.pair.role1 === pair.role2 || edge.pair.role2 === pair.role2) {
      count++
    }
  }
  return count
}

function isCrossDomainAnomaly(
  domain: string,
  target_domain: string | undefined,
  explicit_reason: string | undefined
): boolean {
  if (!target_domain || target_domain === domain) {
    return false
  }
  return !explicit_reason || explicit_reason.trim().length === 0
}

export function shouldQuarantine(
  graph: HebbianGraph,
  pair: RolePair,
  sessions_inactive: number,
  confidence_before: number,
  domain: string = 'default',
  target_domain?: string,
  explicit_cross_domain_reason?: string
): QuarantineDecision {
  const weight = computeRolePairWeight(graph, pair.role1, pair.role2)
  const observed_sessions = graph.edges.get(`${[pair.role1, pair.role2].sort().join('|')}`)?.session_count ?? 0
  const confidence_after = computeConfidenceAfterDecay(weight, sessions_inactive, observed_sessions)

  if (confidence_after < CONFIDENCE_QUARANTINE_THRESHOLD) {
    return {
      pair,
      quarantined: true,
      reason: 'low_confidence',
      recommendation: 'decay',
      confidence: confidence_after,
      explanation: `Confidence fell below threshold (${confidence_after.toFixed(2)} < ${CONFIDENCE_QUARANTINE_THRESHOLD})`
    }
  }

  if (isOrphanedAnchor(graph, pair)) {
    return {
      pair,
      quarantined: true,
      reason: 'orphaned_anchor',
      recommendation: 'decay',
      confidence: confidence_after,
      explanation: `Anchor has no incoming edges and should be consolidated`
    }
  }

  if (isCrossDomainAnomaly(domain, target_domain, explicit_cross_domain_reason)) {
    return {
      pair,
      quarantined: true,
      reason: 'cross_domain_anomaly',
      recommendation: 'hold',
      confidence: confidence_after,
      explanation: `Cross-domain pair without explicit reason — hold for manual review`
    }
  }

  const recommendation = getRecommendation(sessions_inactive, confidence_after, weight)

  return {
    pair,
    quarantined: false,
    reason: null,
    recommendation,
    confidence: confidence_after,
    explanation: `Pair is healthy. Recommendation: ${recommendation}`
  }
}

function getRecommendation(
  sessions_inactive: number,
  confidence: number,
  weight: number
): DecayRecommendation {
  if (weight >= 5.0 && confidence >= 0.7) {
    return 'consolidate'
  }

  if (sessions_inactive === 0) {
    return 'hold'
  }

  return 'decay'
}

export function scheduleDecayJobs(
  graph: HebbianGraph,
  sessions_inactive_threshold: number = 3
): DecayJob[] {
  const jobs: DecayJob[] = []

  for (const edge of graph.edges.values()) {
    const session_count = edge.session_count
    const days_since_activity = sessions_inactive_threshold - session_count

    if (days_since_activity > 0) {
      const confidence_before = edge.co_occurrence_weight * Math.min(session_count / 5, 1.0)
      const confidence_after = computeConfidenceAfterDecay(
        edge.co_occurrence_weight,
        days_since_activity,
        session_count
      )

      jobs.push({
        pair: edge.pair,
        trigger: 'inactive_session',
        sessions_since_activity: days_since_activity,
        confidence_before,
        confidence_after
      })
    }
  }

  return jobs
}
