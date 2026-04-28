import { shouldPromote, ShellGraduationEntry, ShellGraduationDecision, ShellTarget } from './shell-graduation'

export interface MotifCandidate {
  motif_id: string
  motif_name: string
  role: string
  domain: string
  source_entry_ids: string[]
  linked_roles: string[]
  observed_count: number
  avg_weight: number
  avg_confidence: number
  target_shell: ShellTarget
  explicit_cross_domain_reason?: string
}

export interface AnchorPromotionResult {
  decision: 'promote' | 'hold' | 'quarantine' | 'reject'
  anchor_id?: string
  anchor_name?: string
  source_entry_ids: string[]
  target_shell?: ShellTarget
  reason_codes: string[]
  confidence: number
  explanation: string
}

export function detectMotif(entries: ShellGraduationEntry[]): MotifCandidate[] {
  const motifMap = new Map<string, ShellGraduationEntry[]>()

  for (const entry of entries) {
    const rolesKey = entry.linked_roles.sort().join('|')
    const key = `${entry.domain}:${rolesKey}`

    if (!motifMap.has(key)) {
      motifMap.set(key, [])
    }
    motifMap.get(key)!.push(entry)
  }

  const candidates: MotifCandidate[] = []

  for (const [key, group] of motifMap.entries()) {
    if (group.length >= 3) {
      const [domain, rolesStr] = key.split(':')
      const linked_roles = rolesStr.split('|')
      const avg_weight = group.reduce((sum, e) => sum + e.weight, 0) / group.length
      const avg_confidence = group.reduce((sum, e) => sum + (e.confidence || 0), 0) / group.length
      const target_shell = group[0].target_shell

      const motif_id = `motif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      const motif_name = `${domain}_${linked_roles.join('_')}`

      candidates.push({
        motif_id,
        motif_name,
        role: linked_roles[0] || 'unknown',
        domain,
        source_entry_ids: group.map((e, i) => `entry_${i}`),
        linked_roles,
        observed_count: group.length,
        avg_weight,
        avg_confidence,
        target_shell
      })
    }
  }

  return candidates
}

export function promoteToAnchor(candidate: MotifCandidate): AnchorPromotionResult {
  const graduationEntry: ShellGraduationEntry = {
    source_shell: '16D',
    target_shell: candidate.target_shell,
    timestamp: new Date().toISOString(),
    weight: candidate.avg_weight,
    confidence: candidate.avg_confidence,
    linked_roles: candidate.linked_roles,
    anchor_status: 'raw',
    decay_state: 'fresh',
    observed_sessions: candidate.observed_count,
    provenance_status: 'valid',
    quarantine_status: false,
    domain: candidate.domain
  }

  const graduationDecision = shouldPromote(graduationEntry)

  if (graduationDecision.decision !== 'promote') {
    return {
      decision: graduationDecision.decision,
      source_entry_ids: candidate.source_entry_ids,
      target_shell: graduationDecision.target_shell,
      reason_codes: graduationDecision.reason_codes,
      confidence: graduationDecision.confidence,
      explanation: graduationDecision.explanation
    }
  }

  const anchor_id = `anchor_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const anchor_name = candidate.motif_name

  return {
    decision: 'promote',
    anchor_id,
    anchor_name,
    source_entry_ids: candidate.source_entry_ids,
    target_shell: candidate.target_shell,
    reason_codes: ['motif_recurrence_threshold_met', 'shouldPromote_passed'],
    confidence: graduationDecision.confidence,
    explanation: `Local anchor '${anchor_name}' promoted from 16D to ${candidate.target_shell}. Motif recurred ${candidate.observed_count} times across ${candidate.linked_roles.length} linked role(s).`
  }
}
