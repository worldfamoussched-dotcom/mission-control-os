// Phase 2 Stage F — Retrieval Gate Integration
// Pure TypeScript contract for memory access policy enforcement
// No I/O, no mutations, no side effects

export type ShellTarget = "8D" | "16D" | "32D" | "64D"
export type DecayState = "fresh" | "stable" | "stale" | "archive_candidate"
export type QuarantineStatus = "clear" | "watch" | "quarantined"
export type AnchorStatus = "raw" | "local_anchor"
export type ProvenanceStatus = "valid" | "missing" | "unverified"
export type RetrievalStatus = "allowed" | "downgraded" | "blocked"
export type RuleActivationStatus = "SURFACE" | "WARN" | "BLOCK"

export interface RetrievalRequest {
  query: string
  active_domain: string
  active_role?: string
  session_id: string
  timestamp: string
  explicit_cross_domain_reason?: string
}

export interface RuleActivation {
  rule_id: string
  status: RuleActivationStatus
  reason_code: string
  confidence: number
  timestamp: string
}

export interface RetrievalCandidate {
  id: string
  source_shell: ShellTarget
  domain: string
  role?: string
  decay_state: DecayState
  quarantine_status: QuarantineStatus
  anchor_status: AnchorStatus
  provenance_status: ProvenanceStatus
  weight: number
  role_pair_weight?: number
  timestamp: string
  observed_sessions: number
  linked_roles: string[]
  target_domain?: string
  explicit_cross_domain_reason?: string
  rule_activations?: RuleActivation[]
}

export interface RetrievalDecision {
  candidate_id: string
  status: RetrievalStatus
  reason_codes: string[]
  confidence: number
  explanation: string
  applied_rules: string[]
  audit_trail: {
    checks_performed: string[]
    blocking_factors: string[]
    confidence_modifiers: number[]
  }
}

export interface RetrievalScope {
  request_id: string
  total_candidates: number
  allowed_count: number
  downgraded_count: number
  blocked_count: number
  allowed_items: RetrievalCandidate[]
  downgraded_items: RetrievalCandidate[]
  blocked_items: RetrievalCandidate[]
  decisions: RetrievalDecision[]
  reason_code_summary: Record<string, number>
  confidence_distribution: {
    high: number
    medium: number
    low: number
  }
  audit_metadata: {
    evaluated_at: string
    evaluation_duration_ms: number
  }
}

export function evaluateRetrievalCandidate(
  candidate: RetrievalCandidate,
  request: RetrievalRequest
): RetrievalDecision {
  const checks: string[] = []
  const blockingFactors: string[] = []
  const modifiers: number[] = []
  const appliedRules: string[] = []
  let status: RetrievalStatus = "allowed"
  let confidence = 0
  const reasonCodes: string[] = []

  // Rule 1: BLOCK rule activation — check first, blocks everything
  checks.push("rule_activation_check")
  if (candidate.rule_activations && candidate.rule_activations.length > 0) {
    const blockingRule = candidate.rule_activations.find(r => r.status === "BLOCK")
    if (blockingRule) {
      appliedRules.push("rule_1_block_activation")
      status = "blocked"
      confidence = 0
      reasonCodes.push(blockingRule.reason_code)
      blockingFactors.push(`BLOCK rule: ${blockingRule.rule_id}`)
      return {
        candidate_id: candidate.id,
        status,
        reason_codes: reasonCodes,
        confidence,
        explanation: `Blocked by preemptive BLOCK rule: ${blockingRule.reason_code}`,
        applied_rules: appliedRules,
        audit_trail: {
          checks_performed: checks,
          blocking_factors: blockingFactors,
          confidence_modifiers: modifiers
        }
      }
    }
  }

  // Rule 2: Quarantine override — absolute blocker
  checks.push("quarantine_status_check")
  if (candidate.quarantine_status === "quarantined") {
    appliedRules.push("rule_2_quarantine_override")
    status = "blocked"
    confidence = 0
    reasonCodes.push("quarantine_blocks_retrieval")
    blockingFactors.push("quarantine_status=quarantined")
    return {
      candidate_id: candidate.id,
      status,
      reason_codes: reasonCodes,
      confidence,
      explanation: "Blocked: item is quarantined",
      applied_rules: appliedRules,
      audit_trail: {
        checks_performed: checks,
        blocking_factors: blockingFactors,
        confidence_modifiers: modifiers
      }
    }
  }

  // Rule 3: Missing provenance — downgrade
  checks.push("provenance_status_check")
  if (candidate.provenance_status === "missing") {
    appliedRules.push("rule_3_missing_provenance")
    status = "downgraded"
    reasonCodes.push("missing_provenance")
    blockingFactors.push("provenance_status=missing")
  }

  // Rule 4: Cross-domain without reason — downgrade or block
  checks.push("cross_domain_check")
  if (
    candidate.target_domain &&
    candidate.target_domain !== request.active_domain &&
    !candidate.explicit_cross_domain_reason
  ) {
    appliedRules.push("rule_4_cross_domain_no_reason")
    if (status !== "downgraded") {
      status = "downgraded"
    }
    reasonCodes.push("cross_domain_no_reason")
    blockingFactors.push(`cross_domain without reason (${candidate.target_domain})`)
  }

  // Rule 5: Stale/Archive candidates require strong justification
  checks.push("decay_state_check")
  if (
    candidate.decay_state === "stale" ||
    candidate.decay_state === "archive_candidate"
  ) {
    const hasValidProvenance = candidate.provenance_status === "valid"
    const hasHighWeight = candidate.weight >= 0.7
    const hasSufficientSessions = candidate.observed_sessions >= 5
    const isAnchor = candidate.anchor_status === "local_anchor"

    const meetsBar =
      hasValidProvenance &&
      (hasHighWeight || hasSufficientSessions || isAnchor)

    if (!meetsBar) {
      appliedRules.push("rule_5_stale_requires_justification")
      if (status !== "downgraded") {
        status = "downgraded"
      }
      reasonCodes.push("stale_requires_stronger_justification")
      blockingFactors.push(
        `${candidate.decay_state} without sufficient justification`
      )
    }
  }

  // Rule 6: Confidence computation for allowed/downgraded
  checks.push("confidence_computation")
  confidence = candidate.weight * Math.min(candidate.observed_sessions / 5, 1.0)

  // Domain alignment boost
  if (candidate.domain === request.active_domain) {
    const boost = 0.1
    modifiers.push(boost)
    confidence = Math.min(confidence + boost, 1.0)
  }

  // Role alignment boost
  if (
    request.active_role &&
    candidate.linked_roles &&
    candidate.linked_roles.includes(request.active_role)
  ) {
    const boost = 0.05
    modifiers.push(boost)
    confidence = Math.min(confidence + boost, 1.0)
  }

  // Anchor status boost
  if (candidate.anchor_status === "local_anchor") {
    const boost = 0.1
    modifiers.push(boost)
    confidence = Math.min(confidence + boost, 1.0)
  }

  // Hebrian role-pair weight
  if (candidate.role_pair_weight !== undefined) {
    const boost = candidate.role_pair_weight * 0.05
    modifiers.push(boost)
    confidence = Math.min(confidence + boost, 1.0)
  }

  // Cap confidence at 1.0
  confidence = Math.min(confidence, 1.0)

  return {
    candidate_id: candidate.id,
    status,
    reason_codes: reasonCodes.length > 0 ? reasonCodes : ["allowed"],
    confidence,
    explanation: explainRetrievalDecision(
      {
        candidate_id: candidate.id,
        status,
        reason_codes: reasonCodes.length > 0 ? reasonCodes : ["allowed"],
        confidence,
        explanation: "",
        applied_rules: appliedRules,
        audit_trail: {
          checks_performed: checks,
          blocking_factors: blockingFactors,
          confidence_modifiers: modifiers
        }
      },
      candidate
    ),
    applied_rules: appliedRules,
    audit_trail: {
      checks_performed: checks,
      blocking_factors: blockingFactors,
      confidence_modifiers: modifiers
    }
  }
}

export function explainRetrievalDecision(
  decision: RetrievalDecision,
  candidate: RetrievalCandidate
): string {
  const parts: string[] = []

  if (decision.status === "blocked") {
    parts.push(`Blocked: ${candidate.id}`)
  } else if (decision.status === "downgraded") {
    parts.push(`Downgraded: ${candidate.id}`)
  } else {
    parts.push(`Allowed: ${candidate.id}`)
  }

  if (decision.reason_codes.length > 0) {
    parts.push(`Reason: ${decision.reason_codes.join(", ")}`)
  }

  parts.push(`Confidence: ${(decision.confidence * 100).toFixed(0)}%`)

  if (decision.audit_trail.blocking_factors.length > 0) {
    parts.push(`Blocking: ${decision.audit_trail.blocking_factors.join("; ")}`)
  }

  return parts.join(" | ")
}

export function buildRetrievalScope(
  request: RetrievalRequest,
  candidates: RetrievalCandidate[],
  decisions: RetrievalDecision[]
): RetrievalScope {
  const allowed: RetrievalCandidate[] = []
  const downgraded: RetrievalCandidate[] = []
  const blocked: RetrievalCandidate[] = []

  const reasonCodeCounts: Record<string, number> = {}

  for (const decision of decisions) {
    const candidate = candidates.find(c => c.id === decision.candidate_id)
    if (!candidate) continue

    if (decision.status === "allowed") {
      allowed.push(candidate)
    } else if (decision.status === "downgraded") {
      downgraded.push(candidate)
    } else {
      blocked.push(candidate)
    }

    for (const code of decision.reason_codes) {
      reasonCodeCounts[code] = (reasonCodeCounts[code] || 0) + 1
    }
  }

  // Confidence distribution
  let high = 0
  let medium = 0
  let low = 0
  for (const decision of decisions) {
    if (decision.confidence >= 0.8) {
      high += 1
    } else if (decision.confidence >= 0.5) {
      medium += 1
    } else {
      low += 1
    }
  }

  return {
    request_id: request.session_id,
    total_candidates: candidates.length,
    allowed_count: allowed.length,
    downgraded_count: downgraded.length,
    blocked_count: blocked.length,
    allowed_items: allowed,
    downgraded_items: downgraded,
    blocked_items: blocked,
    decisions,
    reason_code_summary: reasonCodeCounts,
    confidence_distribution: {
      high,
      medium,
      low
    },
    audit_metadata: {
      evaluated_at: new Date().toISOString(),
      evaluation_duration_ms: 0
    }
  }
}

export function applyRetrievalGate(
  request: RetrievalRequest,
  candidates: RetrievalCandidate[]
): RetrievalScope {
  const startTime = Date.now()

  const decisions = candidates.map(candidate =>
    evaluateRetrievalCandidate(candidate, request)
  )

  const scope = buildRetrievalScope(request, candidates, decisions)

  // Calculate duration
  const endTime = Date.now()
  scope.audit_metadata.evaluation_duration_ms = endTime - startTime

  return scope
}
