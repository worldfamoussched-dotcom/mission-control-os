import { ShellGraduationEntry, ShellGraduationDecision, ShellTarget } from './shell-graduation'

export interface PromotionRecord {
  source_shell: ShellTarget
  target_shell: ShellTarget
  timestamp: string
  entry_id: string
  anchor_status_before: string
  anchor_status_after: string
  provenance_hash: string
  decision_confidence: number
  promotion_reason_codes: string[]
}

export interface PromotionError {
  type: 'invalid_decision' | 'invalid_transition' | 'anchor_status_mismatch' | 'provenance_missing'
  message: string
  entry_id?: string
  attempted_target?: ShellTarget
}

export interface PromotionResult {
  success: boolean
  record?: PromotionRecord
  error?: PromotionError
}

function isValidShellTransition(source: ShellTarget, target: ShellTarget): boolean {
  const hierarchy: Record<ShellTarget, ShellTarget[]> = {
    '16D': ['32D'],
    '32D': ['64D'],
    '8D': [],
    '64D': []
  }

  return hierarchy[source]?.includes(target) ?? false
}

function computeProvenanceHash(entry: ShellGraduationEntry): string {
  const components = [
    entry.domain,
    entry.provenance_status,
    entry.observed_sessions.toString(),
    entry.weight.toFixed(2),
    entry.timestamp
  ]
  const combined = components.join('|')
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return `pvh_${Math.abs(hash).toString(16)}`
}

export function promote(
  entry: ShellGraduationEntry,
  decision: ShellGraduationDecision
): PromotionResult {
  // Validate decision is promote
  if (decision.decision !== 'promote') {
    return {
      success: false,
      error: {
        type: 'invalid_decision',
        message: `Decision must be 'promote', got '${decision.decision}'`,
        entry_id: `${entry.source_shell}_${entry.domain}_${entry.timestamp}`
      }
    }
  }

  // Validate target_shell is set
  if (!decision.target_shell) {
    return {
      success: false,
      error: {
        type: 'invalid_decision',
        message: 'Decision.target_shell is required for promotion',
        entry_id: `${entry.source_shell}_${entry.domain}_${entry.timestamp}`
      }
    }
  }

  // Validate shell transition is legal
  if (!isValidShellTransition(entry.source_shell, decision.target_shell)) {
    return {
      success: false,
      error: {
        type: 'invalid_transition',
        message: `Invalid transition: ${entry.source_shell} → ${decision.target_shell}`,
        attempted_target: decision.target_shell,
        entry_id: `${entry.source_shell}_${entry.domain}_${entry.timestamp}`
      }
    }
  }

  // Validate anchor_status is raw (not already promoted)
  if (entry.anchor_status !== 'raw') {
    return {
      success: false,
      error: {
        type: 'anchor_status_mismatch',
        message: `Cannot promote: anchor_status is '${entry.anchor_status}', not 'raw'`,
        entry_id: `${entry.source_shell}_${entry.domain}_${entry.timestamp}`
      }
    }
  }

  // Validate provenance is present
  if (entry.provenance_status === 'missing') {
    return {
      success: false,
      error: {
        type: 'provenance_missing',
        message: 'Cannot promote: provenance_status is missing',
        entry_id: `${entry.source_shell}_${entry.domain}_${entry.timestamp}`
      }
    }
  }

  // Compute provenance hash for audit trail
  const provenanceHash = computeProvenanceHash(entry)

  // Build promotion record
  const record: PromotionRecord = {
    source_shell: entry.source_shell,
    target_shell: decision.target_shell,
    timestamp: new Date().toISOString(),
    entry_id: `${entry.source_shell}_${entry.domain}_${entry.timestamp}`,
    anchor_status_before: 'raw',
    anchor_status_after: 'local_anchor',
    provenance_hash: provenanceHash,
    decision_confidence: decision.confidence,
    promotion_reason_codes: decision.reason_codes
  }

  return {
    success: true,
    record
  }
}

export function validatePromotionPrerequisites(
  entry: ShellGraduationEntry,
  decision: ShellGraduationDecision
): PromotionError | null {
  // Pre-promotion validation without executing the move

  // Check 1: Decision must be promote
  if (decision.decision !== 'promote') {
    return {
      type: 'invalid_decision',
      message: `Expected decision 'promote', got '${decision.decision}'`
    }
  }

  // Check 2: Target shell must be set
  if (!decision.target_shell) {
    return {
      type: 'invalid_decision',
      message: 'Target shell not specified in decision'
    }
  }

  // Check 3: Transition must be valid in hierarchy
  if (!isValidShellTransition(entry.source_shell, decision.target_shell)) {
    return {
      type: 'invalid_transition',
      message: `${entry.source_shell} cannot transition to ${decision.target_shell}`
    }
  }

  // Check 4: Anchor status must allow promotion
  if (entry.anchor_status !== 'raw') {
    return {
      type: 'anchor_status_mismatch',
      message: `Entry has anchor_status '${entry.anchor_status}', not 'raw'`
    }
  }

  // Check 5: Provenance must exist
  if (entry.provenance_status === 'missing') {
    return {
      type: 'provenance_missing',
      message: 'Provenance status is missing'
    }
  }

  return null
}

export function extractPromotionAuditTrail(record: PromotionRecord): string[] {
  const trail: string[] = []

  trail.push(`[PROMOTION] ${record.timestamp}`)
  trail.push(`Entry: ${record.entry_id}`)
  trail.push(`Transition: ${record.source_shell} → ${record.target_shell}`)
  trail.push(`Anchor: ${record.anchor_status_before} → ${record.anchor_status_after}`)
  trail.push(`Provenance: ${record.provenance_hash}`)
  trail.push(`Confidence: ${record.decision_confidence.toFixed(3)}`)
  trail.push(`Reason codes: ${record.promotion_reason_codes.join(', ')}`)

  return trail
}
