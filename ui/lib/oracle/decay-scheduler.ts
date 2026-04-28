import type { RolePair, HebbianGraph } from './hebrian-dynamics'

// ============================================================================
// STAGE E LIFECYCLE CONTRACT — Authoritative Spec
// ============================================================================

// Decay state machine
export type DecayState = 'fresh' | 'stable' | 'stale' | 'archive_candidate'

// Quarantine state machine
export type QuarantineState = 'clear' | 'watch' | 'quarantined'

// Reason codes for decay decisions
export type DecayReasonCode =
  | 'exponential_decay'
  | 'inactive_sessions'
  | 'low_confidence'
  | 'orphaned_anchor'
  | 'stale_threshold_reached'
  | 'archive_threshold_reached'

// Reason codes for quarantine decisions
export type QuarantineReasonCode =
  | 'hard_boundary_breach'
  | 'source_mutation_attempt'
  | 'high_confidence_contamination'
  | 'high_confidence_contradiction'
  | 'unsafe_cross_domain'
  | 'missing_provenance'
  | 'low_confidence'
  | 'none'

// Default constants
const DEFAULT_DECAY_RATE = 0.95
const DEFAULT_MIN_WEIGHT_FLOOR = 0
const DEFAULT_STALE_AFTER_SESSIONS = 5
const DEFAULT_ARCHIVE_AFTER_SESSIONS = 12
const DEFAULT_ANCHOR_PROTECTION_WEIGHT = 0.7
const DEFAULT_QUARANTINE_CONFIDENCE_THRESHOLD = 0.75

// Input/output contracts
export interface DecaySchedulerInput {
  weight: number
  sessions_inactive: number
  observed_sessions: number
  anchor_status?: 'raw' | 'local_anchor' | 'protected_anchor'
  decay_state?: DecayState
  confidence?: number
  reason_codes?: string[]
}

export interface DecaySchedulerResult {
  decay_state: DecayState
  weight_after_decay: number
  sessions_inactive: number
  reason_codes: DecayReasonCode[]
  audit_metadata: {
    original_weight: number
    decay_rate_applied: number
    protection_floor_applied: boolean
    floor_value: number
  }
}

export interface QuarantineSignal {
  signal_type: 'hard_boundary_breach' | 'source_mutation_attempt' | 'contamination' | 'contradiction' | 'missing_provenance'
  confidence: number
  reason: string
}

export interface QuarantineDecision {
  quarantine_state: QuarantineState
  reason_codes: QuarantineReasonCode[]
  confidence: number
  explanation: string
  audit_trail: string[]
}

export interface MemoryLifecycleDecision {
  decay_state: DecayState
  quarantine_state: QuarantineState
  weight_after_decay: number
  is_archive_candidate: boolean
  is_protected: boolean
  reason_codes: Array<DecayReasonCode | QuarantineReasonCode>
  audit_metadata: {
    applied_decay: boolean
    applied_quarantine: boolean
    applied_archive_flag: boolean
    quarantine_overrides_archive: boolean
  }
}

// ============================================================================
// STAGE E LIFECYCLE FUNCTIONS — Authoritative Contract
// ============================================================================

/**
 * Apply exponential decay to memory weight based on session inactivity.
 * Respects protection floor for local anchors.
 *
 * Formula: decayed_weight = max(floor, current_weight * decay_rate ^ sessions_inactive)
 */
export function applyDecayPolicy(input: DecaySchedulerInput): DecaySchedulerResult {
  const {
    weight,
    sessions_inactive,
    observed_sessions,
    anchor_status = 'raw',
    decay_state = 'fresh'
  } = input

  // Determine protection floor
  let protection_floor = DEFAULT_MIN_WEIGHT_FLOOR
  const is_protected = anchor_status === 'local_anchor' || anchor_status === 'protected_anchor'

  if (is_protected) {
    protection_floor = DEFAULT_ANCHOR_PROTECTION_WEIGHT
  }

  // Apply exponential decay
  const decay_multiplier = Math.pow(DEFAULT_DECAY_RATE, sessions_inactive)
  const decayed_weight = Math.max(weight * decay_multiplier, protection_floor)

  // Compute decay reason codes
  const reason_codes: DecayReasonCode[] = []
  if (sessions_inactive > 0) {
    reason_codes.push('exponential_decay')
    reason_codes.push('inactive_sessions')
  }

  if (decayed_weight < weight) {
    reason_codes.push('low_confidence')
  }

  return {
    decay_state,
    weight_after_decay: decayed_weight,
    sessions_inactive,
    reason_codes,
    audit_metadata: {
      original_weight: weight,
      decay_rate_applied: DEFAULT_DECAY_RATE,
      protection_floor_applied: is_protected,
      floor_value: protection_floor
    }
  }
}

/**
 * Determine the decay state based on session inactivity.
 * Fresh → Stable → Stale → Archive Candidate
 */
export function markStale(input: DecaySchedulerInput): DecayState {
  const { sessions_inactive } = input

  if (sessions_inactive < DEFAULT_STALE_AFTER_SESSIONS) {
    return 'fresh'
  }

  if (sessions_inactive < 11) {
    return 'stable'
  }

  if (sessions_inactive < DEFAULT_ARCHIVE_AFTER_SESSIONS) {
    return 'stale'
  }

  return 'archive_candidate'
}

/**
 * Flag memory as archive candidate.
 * Respects quarantine override and protection floors.
 * Does not delete — only marks for archival.
 */
export interface ArchiveFlagInput {
  weight: number
  sessions_inactive: number
  observed_sessions: number
  decay_state: DecayState
  quarantine_state?: QuarantineState
  anchor_status?: 'raw' | 'local_anchor' | 'protected_anchor'
  explicit_override?: boolean
}

export interface ArchiveFlagResult {
  is_archive_candidate: boolean
  reason_codes: string[]
}

export function archiveFlag(input: ArchiveFlagInput): ArchiveFlagResult {
  const { decay_state, quarantine_state = 'clear', anchor_status = 'raw', explicit_override = false } = input
  const reason_codes: string[] = []

  // Quarantine blocks archive
  if (quarantine_state === 'quarantined') {
    return {
      is_archive_candidate: false,
      reason_codes: ['quarantine_overrides_archive']
    }
  }

  // Protected anchors don't archive without explicit override
  const is_protected = anchor_status === 'local_anchor' || anchor_status === 'protected_anchor'
  if (is_protected && !explicit_override) {
    return {
      is_archive_candidate: false,
      reason_codes: ['protected_anchor_guards_archive']
    }
  }

  // Only archive_candidate decay_state triggers archival
  const is_archive_candidate = decay_state === 'archive_candidate'

  if (is_archive_candidate) {
    reason_codes.push('decay_state_is_archive_candidate')
  } else {
    reason_codes.push('decay_state_does_not_support_archival')
  }

  return {
    is_archive_candidate,
    reason_codes
  }
}

/**
 * Detect quarantine signals and return quarantine decision.
 * Multiple signal types drive different confidence/recommendation paths.
 */
export function detectQuarantine(signals: QuarantineSignal[]): QuarantineDecision {
  const audit_trail: string[] = []
  const reason_codes: QuarantineReasonCode[] = []
  let quarantine_state: QuarantineState = 'clear'
  let max_confidence = 0

  // No signals → clear
  if (!signals || signals.length === 0) {
    return {
      quarantine_state: 'clear',
      reason_codes: ['none'],
      confidence: 1.0,
      explanation: 'No quarantine signals detected',
      audit_trail: ['clear: no signals']
    }
  }

  // Process each signal
  for (const sig of signals) {
    audit_trail.push(`signal: ${sig.signal_type}, confidence: ${sig.confidence.toFixed(3)}`)
    max_confidence = Math.max(max_confidence, sig.confidence)

    // Hard boundaries always quarantine
    if (sig.signal_type === 'hard_boundary_breach') {
      quarantine_state = 'quarantined'
      reason_codes.push('hard_boundary_breach')
      audit_trail.push('quarantine: hard_boundary_breach detected')
    }

    // Source mutation always quarantines
    if (sig.signal_type === 'source_mutation_attempt') {
      quarantine_state = 'quarantined'
      reason_codes.push('source_mutation_attempt')
      audit_trail.push('quarantine: source_mutation_attempt detected')
    }

    // High-confidence contamination quarantines
    if (sig.signal_type === 'contamination' && sig.confidence >= DEFAULT_QUARANTINE_CONFIDENCE_THRESHOLD) {
      quarantine_state = 'quarantined'
      reason_codes.push('high_confidence_contamination')
      audit_trail.push('quarantine: high-confidence contamination detected')
    }

    // Low-confidence contamination → watch
    if (sig.signal_type === 'contamination' && sig.confidence < DEFAULT_QUARANTINE_CONFIDENCE_THRESHOLD) {
      if (quarantine_state !== 'quarantined') {
        quarantine_state = 'watch'
      }
      reason_codes.push('high_confidence_contamination')
      audit_trail.push('watch: contamination at low confidence')
    }

    // High-confidence contradiction quarantines
    if (sig.signal_type === 'contradiction' && sig.confidence >= DEFAULT_QUARANTINE_CONFIDENCE_THRESHOLD) {
      quarantine_state = 'quarantined'
      reason_codes.push('high_confidence_contradiction')
      audit_trail.push('quarantine: high-confidence contradiction detected')
    }

    // Unsafe cross-domain without reason → watch or quarantine
    if (sig.signal_type === 'unsafe_cross_domain') {
      if (sig.confidence >= DEFAULT_QUARANTINE_CONFIDENCE_THRESHOLD) {
        quarantine_state = 'quarantined'
        reason_codes.push('unsafe_cross_domain')
        audit_trail.push('quarantine: unsafe cross-domain high confidence')
      } else {
        if (quarantine_state !== 'quarantined') {
          quarantine_state = 'watch'
        }
        reason_codes.push('unsafe_cross_domain')
        audit_trail.push('watch: unsafe cross-domain low confidence')
      }
    }

    // Missing provenance alone → watch, not quarantine
    if (sig.signal_type === 'missing_provenance') {
      if (quarantine_state !== 'quarantined') {
        quarantine_state = 'watch'
      }
      reason_codes.push('missing_provenance')
      audit_trail.push('watch: missing_provenance alone does not quarantine')
    }

    // Low confidence alone → watch, not quarantine
    if (sig.signal_type === 'low_confidence') {
      if (quarantine_state !== 'quarantined') {
        quarantine_state = 'watch'
      }
      reason_codes.push('low_confidence')
      audit_trail.push('watch: low_confidence detected')
    }
  }

  // Deduplicate reason codes
  const unique_reasons = Array.from(new Set(reason_codes))

  return {
    quarantine_state,
    reason_codes: unique_reasons,
    confidence: max_confidence,
    explanation: `Quarantine state: ${quarantine_state}. Signals processed: ${signals.length}. Max confidence: ${max_confidence.toFixed(3)}.`,
    audit_trail
  }
}

/**
 * Apply the full lifecycle policy to memory.
 * Combines decay, staleness, archival, and quarantine into a single decision.
 * Quarantine overrides archive. Archive candidate does not mean delete.
 */
export function applyLifecyclePolicy(input: DecaySchedulerInput & {
  quarantine_signals?: QuarantineSignal[]
  explicit_archive_override?: boolean
}): MemoryLifecycleDecision {
  // Step 1: Apply decay
  const decay_result = applyDecayPolicy(input)

  // Step 2: Mark decay state based on staleness
  const decay_state = markStale({
    ...input,
    weight: decay_result.decayed_weight
  })

  // Step 3: Detect quarantine
  const quarantine_signals = input.quarantine_signals || []
  const quarantine_result = detectQuarantine(quarantine_signals)

  // Step 4: Check archive flag (without quarantine) to see if it would be archived
  const archive_flag_without_quarantine = archiveFlag({
    weight: input.weight,
    sessions_inactive: input.sessions_inactive,
    observed_sessions: input.observed_sessions,
    decay_state,
    quarantine_state: 'clear',
    anchor_status: input.anchor_status,
    explicit_override: input.explicit_archive_override
  })

  // Step 4b: Check archive flag (with quarantine) for final decision
  const archive_flag = archiveFlag({
    weight: input.weight,
    sessions_inactive: input.sessions_inactive,
    observed_sessions: input.observed_sessions,
    decay_state,
    quarantine_state: quarantine_result.quarantine_state,
    anchor_status: input.anchor_status,
    explicit_override: input.explicit_archive_override
  })

  // Step 5: Combine all reason codes
  const combined_reason_codes: Array<DecayReasonCode | QuarantineReasonCode> = [
    ...decay_result.reason_codes,
    ...quarantine_result.reason_codes
  ]

  // Step 6: Determine if quarantine overrides archive
  const quarantine_overrides_archive = quarantine_result.quarantine_state === 'quarantined' && archive_flag_without_quarantine.is_archive_candidate

  return {
    decay_state,
    quarantine_state: quarantine_result.quarantine_state,
    weight_after_decay: decay_result.weight_after_decay,
    is_archive_candidate: archive_flag.is_archive_candidate && !quarantine_overrides_archive,
    is_protected: input.anchor_status === 'local_anchor' || input.anchor_status === 'protected_anchor',
    reason_codes: combined_reason_codes,
    audit_metadata: {
      applied_decay: decay_result.reason_codes.length > 0,
      applied_quarantine: quarantine_result.reason_codes.length > 0 && quarantine_result.reason_codes[0] !== 'none',
      applied_archive_flag: archive_flag.is_archive_candidate,
      quarantine_overrides_archive
    }
  }
}

// ============================================================================
// LEGACY HELPERS (kept for backward compat, secondary to lifecycle contract)
// ============================================================================

// Maintained for backward compatibility — not part of Stage E contract
export type DecayTrigger = 'inactive_session' | 'manual_trigger' | 'consolidation_event'
export type DecayRecommendation = 'hold' | 'decay' | 'consolidate'

export interface DecayJob {
  pair: RolePair
  trigger: DecayTrigger
  sessions_since_activity: number
  confidence_before: number
  confidence_after: number
}

function computeConfidenceAfterDecay(weight: number, sessions_inactive: number, observed_sessions: number): number {
  const decay_multiplier = Math.pow(0.95, sessions_inactive)
  const decayed_weight = weight * decay_multiplier
  const confidence = decayed_weight * Math.min(observed_sessions / 5, 1.0)
  return Math.max(confidence, 0)
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

function isOrphanedAnchor(graph: HebbianGraph, pair: RolePair): boolean {
  const weight = computeRolePairWeight(graph, pair.role1, pair.role2)
  if (weight < 0.1) {
    return false
  }
  const incomingCount = countIncomingEdges(graph, pair)
  return incomingCount === 0 && weight > 0
}

function isCrossDomainAnomaly(domain: string, target_domain: string | undefined, explicit_reason: string | undefined): boolean {
  if (!target_domain || target_domain === domain) {
    return false
  }
  return !explicit_reason || explicit_reason.trim().length === 0
}

export interface LegacyQuarantineDecision {
  pair: RolePair
  quarantined: boolean
  reason: string | string[] | null
  recommendation: DecayRecommendation
  confidence: number
  explanation: string
}

export function shouldQuarantine(
  graph: HebbianGraph,
  pair: RolePair,
  sessions_inactive: number,
  confidence_before: number,
  domain: string = 'default',
  target_domain?: string,
  explicit_cross_domain_reason?: string
): LegacyQuarantineDecision {
  const weight = computeRolePairWeight(graph, pair.role1, pair.role2)
  const observed_sessions = graph.edges.get(`${[pair.role1, pair.role2].sort().join('|')}`)?.session_count ?? 0
  const confidence_after = computeConfidenceAfterDecay(weight, sessions_inactive, observed_sessions)

  if (confidence_after < 0.3) {
    return {
      pair,
      quarantined: true,
      reason: 'low_confidence',
      recommendation: 'decay',
      confidence: confidence_after,
      explanation: `Confidence fell below threshold (${confidence_after.toFixed(2)} < 0.3)`
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

function getRecommendation(sessions_inactive: number, confidence: number, weight: number): DecayRecommendation {
  if (weight >= 5.0 && confidence >= 0.7) {
    return 'consolidate'
  }

  if (sessions_inactive === 0) {
    return 'hold'
  }

  return 'decay'
}

export function scheduleDecayJobs(graph: HebbianGraph, sessions_inactive_threshold: number = 3): DecayJob[] {
  const jobs: DecayJob[] = []

  for (const edge of graph.edges.values()) {
    const session_count = edge.session_count
    const days_since_activity = sessions_inactive_threshold - session_count

    if (days_since_activity > 0) {
      const confidence_before = edge.co_occurrence_weight * Math.min(session_count / 5, 1.0)
      const confidence_after = computeConfidenceAfterDecay(edge.co_occurrence_weight, days_since_activity, session_count)

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
