export type ShellTarget = '8D' | '16D' | '32D' | '64D'
export type DecisionState = 'promote' | 'hold' | 'quarantine' | 'reject'
export type AnchorStatus = 'raw' | 'local_anchor'
export type ProvenanceStatus = 'valid' | 'missing' | 'unverified'

export interface ShellGraduationEntry {
  source_shell: ShellTarget
  target_shell: ShellTarget
  timestamp: string
  weight: number
  confidence?: number
  linked_roles: string[]
  anchor_status: AnchorStatus
  decay_state: string
  observed_sessions: number
  provenance_status: ProvenanceStatus
  quarantine_status: boolean
  domain: string
  target_domain?: string
  explicit_cross_domain_reason?: string
  evidence_count?: number
  supporting_reasons?: string[]
}

export interface ShellGraduationDecision {
  decision: DecisionState
  target_shell?: ShellTarget
  reason_codes: string[]
  confidence: number
  explanation: string
}

function computeConfidence(weight: number, observed_sessions: number, evidence_count: number = 0): number {
  const base = weight * Math.min(observed_sessions / 5, 1.0)
  const boosted = evidence_count > 0 ? Math.min(base + 0.05, 1.0) : base
  return boosted
}

export function shouldPromote(input: ShellGraduationEntry): ShellGraduationDecision {
  const reasons: string[] = []

  // Rule 1: Quarantine always overrides
  if (input.quarantine_status === true) {
    return {
      decision: 'quarantine',
      reason_codes: ['quarantined'],
      confidence: 0,
      explanation: 'Entry is quarantined. Promotion blocked.'
    }
  }

  // Rule 2: Already promoted
  if (input.anchor_status !== 'raw') {
    reasons.push('already_promoted')
    return {
      decision: 'reject',
      reason_codes: reasons,
      confidence: 0,
      explanation: `Entry already promoted (anchor_status: ${input.anchor_status})`
    }
  }

  // Rule 3: Missing provenance
  if (input.provenance_status === 'missing') {
    reasons.push('missing_provenance')
    return {
      decision: 'hold',
      reason_codes: reasons,
      confidence: 0,
      explanation: 'Entry provenance is missing. Hold until provenance is established.'
    }
  }

  // Rule 4: Insufficient sessions
  if (input.observed_sessions < 3) {
    reasons.push('insufficient_sessions')
    return {
      decision: 'hold',
      reason_codes: reasons,
      confidence: input.weight,
      explanation: `Observed sessions ${input.observed_sessions} < threshold 3. Hold.`
    }
  }

  // Rule 5: Weight below threshold
  if (input.weight < 0.7) {
    reasons.push('weight_below_threshold')
    return {
      decision: 'hold',
      reason_codes: reasons,
      confidence: input.weight,
      explanation: `Weight ${input.weight} < threshold 0.7. Hold.`
    }
  }

  // Rule 6: Cross-domain without reason
  if (input.target_domain && input.target_domain !== input.domain && !input.explicit_cross_domain_reason) {
    reasons.push('cross_domain_no_reason')
    return {
      decision: 'hold',
      reason_codes: reasons,
      confidence: input.weight,
      explanation: `Cross-domain promotion (${input.domain} → ${input.target_domain}) requires explicit reason.`
    }
  }

  // Rule 7: 8D requires stronger evidence
  if (input.target_shell === '8D') {
    if (input.observed_sessions < 5 || input.weight < 0.85) {
      reasons.push('8d_requires_stronger_evidence')
      return {
        decision: 'hold',
        reason_codes: reasons,
        confidence: input.weight,
        explanation: `8D promotion requires observed_sessions >= 5 and weight >= 0.85. Current: sessions=${input.observed_sessions}, weight=${input.weight}`
      }
    }
  }

  // Rule 8: All checks pass → promote
  const confidence = computeConfidence(input.weight, input.observed_sessions, input.evidence_count)
  reasons.push('eligibility_confirmed')

  return {
    decision: 'promote',
    target_shell: input.target_shell,
    reason_codes: reasons,
    confidence,
    explanation: `Entry qualifies for promotion to ${input.target_shell}. Sessions: ${input.observed_sessions}, Weight: ${input.weight}, Provenance: ${input.provenance_status}.`
  }
}
