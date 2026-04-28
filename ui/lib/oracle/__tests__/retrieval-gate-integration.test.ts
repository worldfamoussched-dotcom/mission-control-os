import { describe, test, expect } from 'vitest'
import {
  applyRetrievalGate,
  evaluateRetrievalCandidate,
  explainRetrievalDecision,
  buildRetrievalScope,
  type RetrievalRequest,
  type RetrievalCandidate,
  type RetrievalDecision,
  type RuleActivation
} from '../retrieval-gate-integration'

describe('retrievalGateIntegration', () => {
  const baseRequest: RetrievalRequest = {
    query: 'test query',
    active_domain: 'VS',
    session_id: 'test-session-' + Date.now(),
    timestamp: new Date().toISOString()
  }

  const baseCandidate: RetrievalCandidate = {
    id: 'test-candidate',
    source_shell: '16D',
    domain: 'VS',
    decay_state: 'fresh',
    quarantine_status: 'clear',
    anchor_status: 'raw',
    provenance_status: 'valid',
    weight: 0.8,
    timestamp: new Date().toISOString(),
    observed_sessions: 5,
    linked_roles: []
  }

  // Test 1: Valid candidate with sufficient sessions, weight, and provenance
  test('allows valid candidate with sufficient sessions, weight, and provenance', () => {
    const decision = evaluateRetrievalCandidate(baseCandidate, baseRequest)
    expect(decision.status).toBe('allowed')
    expect(decision.confidence).toBeGreaterThan(0)
    expect(decision.confidence).toBeLessThanOrEqual(1.0)
    expect(decision.reason_codes).toContain('allowed')
  })

  // Test 2: Low sessions with stale decay downgraded
  test('downgrades stale candidate with low observed sessions', () => {
    const candidate = { ...baseCandidate, decay_state: 'stale' as const, weight: 0.5, observed_sessions: 2, provenance_status: 'valid' as const }
    const decision = evaluateRetrievalCandidate(candidate, baseRequest)
    expect(decision.status).toBe('downgraded')
    expect(decision.reason_codes).toContain('stale_requires_stronger_justification')
  })

  // Test 3: Missing provenance downgraded
  test('downgrades candidate with missing provenance', () => {
    const candidate = { ...baseCandidate, provenance_status: 'missing' as const }
    const decision = evaluateRetrievalCandidate(candidate, baseRequest)
    expect(decision.status).toBe('downgraded')
    expect(decision.reason_codes).toContain('missing_provenance')
  })

  // Test 4: Quarantine blocks
  test('blocks quarantined candidate immediately', () => {
    const candidate = { ...baseCandidate, quarantine_status: 'quarantined' as const }
    const decision = evaluateRetrievalCandidate(candidate, baseRequest)
    expect(decision.status).toBe('blocked')
    expect(decision.confidence).toBe(0)
    expect(decision.reason_codes).toContain('quarantine_blocks_retrieval')
  })

  // Test 5: Cross-domain without reason downgraded
  test('downgrades cross-domain candidate without explicit reason', () => {
    const candidate = {
      ...baseCandidate,
      target_domain: 'LX',
      explicit_cross_domain_reason: undefined
    }
    const decision = evaluateRetrievalCandidate(candidate, baseRequest)
    expect(decision.status).toBe('downgraded')
    expect(decision.reason_codes).toContain('cross_domain_no_reason')
  })

  // Test 6: Cross-domain with explicit reason allowed
  test('allows cross-domain candidate with explicit reason', () => {
    const candidate = {
      ...baseCandidate,
      target_domain: 'LX',
      explicit_cross_domain_reason: 'domain_adjacency_hebrian'
    }
    const decision = evaluateRetrievalCandidate(candidate, baseRequest)
    expect(decision.status).toBe('allowed')
    expect(decision.reason_codes).toContain('allowed')
  })

  // Test 7: Stale without justification downgraded
  test('downgrades stale candidate without sufficient justification', () => {
    const candidate = {
      ...baseCandidate,
      decay_state: 'stale' as const,
      weight: 0.6,
      observed_sessions: 3
    }
    const decision = evaluateRetrievalCandidate(candidate, baseRequest)
    expect(decision.status).toBe('downgraded')
    expect(decision.reason_codes).toContain('stale_requires_stronger_justification')
  })

  // Test 8: Archive candidate without justification downgraded
  test('downgrades archive candidate without sufficient justification', () => {
    const candidate = {
      ...baseCandidate,
      decay_state: 'archive_candidate' as const,
      weight: 0.5,
      observed_sessions: 2
    }
    const decision = evaluateRetrievalCandidate(candidate, baseRequest)
    expect(decision.status).toBe('downgraded')
    expect(decision.reason_codes).toContain('stale_requires_stronger_justification')
  })

  // Test 9: Stale with local anchor allowed
  test('allows stale candidate with local anchor status', () => {
    const candidate = {
      ...baseCandidate,
      decay_state: 'stale' as const,
      anchor_status: 'local_anchor' as const,
      weight: 0.6,
      observed_sessions: 3
    }
    const decision = evaluateRetrievalCandidate(candidate, baseRequest)
    expect(decision.status).toBe('allowed')
  })

  // Test 10: BLOCK rule activation blocks immediately
  test('blocks candidate with BLOCK rule activation', () => {
    const candidate: RetrievalCandidate = {
      ...baseCandidate,
      rule_activations: [
        {
          rule_id: 'test_block_rule',
          status: 'BLOCK',
          reason_code: 'explicit_block_test',
          confidence: 1.0,
          timestamp: new Date().toISOString()
        }
      ]
    }
    const decision = evaluateRetrievalCandidate(candidate, baseRequest)
    expect(decision.status).toBe('blocked')
    expect(decision.confidence).toBe(0)
    expect(decision.reason_codes).toContain('explicit_block_test')
  })

  // Test 11: WARN rule does not change status
  test('does not block candidate with WARN rule activation', () => {
    const candidate: RetrievalCandidate = {
      ...baseCandidate,
      rule_activations: [
        {
          rule_id: 'test_warn_rule',
          status: 'WARN',
          reason_code: 'warning_only',
          confidence: 0.8,
          timestamp: new Date().toISOString()
        }
      ]
    }
    const decision = evaluateRetrievalCandidate(candidate, baseRequest)
    expect(decision.status).toBe('allowed')
  })

  // Test 12: Base confidence computation
  test('computes confidence as weight × min(sessions/5, 1.0)', () => {
    const candidate = { ...baseCandidate, weight: 0.6, observed_sessions: 3, domain: 'DOMAIN_A' }
    const request = { ...baseRequest, active_domain: 'DOMAIN_B' }
    const decision = evaluateRetrievalCandidate(candidate, request)
    const expected = 0.6 * Math.min(3 / 5, 1.0)
    expect(Math.abs(decision.confidence - expected)).toBeLessThan(0.01)
  })

  // Test 13: Confidence capped at 1.0
  test('caps confidence at 1.0 after all boosts', () => {
    const candidate: RetrievalCandidate = {
      ...baseCandidate,
      weight: 1.0,
      observed_sessions: 10,
      anchor_status: 'local_anchor',
      role_pair_weight: 0.8,
      linked_roles: ['decisions']
    }
    const request = { ...baseRequest, active_role: 'decisions' }
    const decision = evaluateRetrievalCandidate(candidate, request)
    expect(decision.confidence).toBeLessThanOrEqual(1.0)
  })

  // Test 14: Domain alignment boost
  test('applies domain alignment boost when domain matches active_domain', () => {
    const candidate = { ...baseCandidate, domain: 'VS', weight: 0.8 }
    const request = { ...baseRequest, active_domain: 'VS' }
    const decision = evaluateRetrievalCandidate(candidate, request)
    expect(decision.confidence).toBeGreaterThan(0.8 * Math.min(5 / 5, 1.0))
  })

  // Test 15: Empty candidate pool
  test('handles empty candidate pool gracefully', () => {
    const scope = applyRetrievalGate(baseRequest, [])
    expect(scope.total_candidates).toBe(0)
    expect(scope.allowed_count).toBe(0)
    expect(scope.downgraded_count).toBe(0)
    expect(scope.blocked_count).toBe(0)
    expect(scope.decisions).toHaveLength(0)
  })

  // Test 16: Multiple candidates with mixed states
  test('evaluates multiple candidates with mixed allowed/downgraded/blocked states', () => {
    const candidates: RetrievalCandidate[] = [
      baseCandidate,
      { ...baseCandidate, id: 'candidate-2', decay_state: 'stale' as const, weight: 0.6, observed_sessions: 2 },
      { ...baseCandidate, id: 'candidate-3', quarantine_status: 'quarantined' as const }
    ]
    const scope = applyRetrievalGate(baseRequest, candidates)
    expect(scope.total_candidates).toBe(3)
    expect(scope.allowed_count).toBe(1)
    expect(scope.downgraded_count).toBe(1)
    expect(scope.blocked_count).toBe(1)
    expect(scope.decisions).toHaveLength(3)
  })

  // Test 17: Immutability of inputs
  test('does not mutate input candidate or request', () => {
    const candidateBeforeString = JSON.stringify(baseCandidate)
    const requestBeforeString = JSON.stringify(baseRequest)
    evaluateRetrievalCandidate(baseCandidate, baseRequest)
    expect(JSON.stringify(baseCandidate)).toBe(candidateBeforeString)
    expect(JSON.stringify(baseRequest)).toBe(requestBeforeString)
  })

  // Test 18: Explanation always present
  test('returns non-empty explanation string for every decision', () => {
    const candidates: RetrievalCandidate[] = [
      baseCandidate,
      { ...baseCandidate, id: 'candidate-2', observed_sessions: 1 },
      { ...baseCandidate, id: 'candidate-3', quarantine_status: 'quarantined' as const }
    ]
    const scope = applyRetrievalGate(baseRequest, candidates)
    for (const decision of scope.decisions) {
      expect(decision.explanation).toBeTruthy()
      expect(typeof decision.explanation).toBe('string')
      expect(decision.explanation.length).toBeGreaterThan(0)
    }
  })

  // Test 19: explainRetrievalDecision formatting
  test('formats explanation correctly with status, reason, and confidence', () => {
    const candidate = baseCandidate
    const decision = evaluateRetrievalCandidate(candidate, baseRequest)
    const explanation = explainRetrievalDecision(decision, candidate)
    expect(explanation).toContain('Allowed')
    expect(explanation).toContain('Confidence')
    expect(explanation).toMatch(/\d+%/)
  })

  // Test 20: buildRetrievalScope aggregation
  test('aggregates decisions correctly with proper counts and summaries', () => {
    const candidates: RetrievalCandidate[] = [
      baseCandidate,
      { ...baseCandidate, id: 'candidate-2', provenance_status: 'missing' as const },
      { ...baseCandidate, id: 'candidate-3', quarantine_status: 'quarantined' as const },
      { ...baseCandidate, id: 'candidate-4', provenance_status: 'missing' as const }
    ]
    const decisions = candidates.map(c => evaluateRetrievalCandidate(c, baseRequest))
    const scope = buildRetrievalScope(baseRequest, candidates, decisions)

    expect(scope.total_candidates).toBe(4)
    expect(scope.allowed_count).toBe(1)
    expect(scope.downgraded_count).toBe(2)
    expect(scope.blocked_count).toBe(1)
    expect(scope.allowed_items).toHaveLength(1)
    expect(scope.downgraded_items).toHaveLength(2)
    expect(scope.blocked_items).toHaveLength(1)
    expect(scope.reason_code_summary['missing_provenance']).toBe(2)
    expect(scope.reason_code_summary['quarantine_blocks_retrieval']).toBe(1)
    expect(scope.confidence_distribution.high + scope.confidence_distribution.medium + scope.confidence_distribution.low).toBe(4)
  })
})
