import { describe, test, expect } from 'vitest'
import { promote, validatePromotionPrerequisites, extractPromotionAuditTrail, PromotionRecord } from '../shell-promoter'
import { ShellGraduationEntry, ShellGraduationDecision } from '../shell-graduation'

describe('Shell Promoter Engine', () => {
  const validEntry: ShellGraduationEntry = {
    source_shell: '16D',
    target_shell: '32D',
    timestamp: '2026-04-28T00:00:00Z',
    weight: 0.8,
    linked_roles: ['task', 'context'],
    anchor_status: 'raw',
    decay_state: 'fresh',
    observed_sessions: 4,
    provenance_status: 'valid',
    quarantine_status: false,
    domain: 'TASK'
  }

  const validDecision: ShellGraduationDecision = {
    decision: 'promote',
    target_shell: '32D',
    reason_codes: ['eligibility_confirmed'],
    confidence: 0.85,
    explanation: 'Entry qualifies for promotion to 32D.'
  }

  test('Test 1: Valid 16D to 32D promotion succeeds', () => {
    const result = promote(validEntry, validDecision)

    expect(result.success).toBe(true)
    expect(result.record).toBeDefined()
    expect(result.error).toBeUndefined()

    const record = result.record as PromotionRecord
    expect(record.source_shell).toBe('16D')
    expect(record.target_shell).toBe('32D')
    expect(record.anchor_status_before).toBe('raw')
    expect(record.anchor_status_after).toBe('local_anchor')
  })

  test('Test 2: Valid 32D to 64D promotion succeeds', () => {
    const entry = { ...validEntry, source_shell: '32D' as const, target_shell: '64D' as const }
    const decision = { ...validDecision, target_shell: '64D' as const }

    const result = promote(entry, decision)

    expect(result.success).toBe(true)
    expect(result.record?.source_shell).toBe('32D')
    expect(result.record?.target_shell).toBe('64D')
  })

  test('Test 3: Rejects non-promote decision', () => {
    const badDecision: ShellGraduationDecision = {
      decision: 'hold',
      reason_codes: ['insufficient_sessions'],
      confidence: 0.4,
      explanation: 'Hold'
    }

    const result = promote(validEntry, badDecision)

    expect(result.success).toBe(false)
    expect(result.error?.type).toBe('invalid_decision')
    expect(result.error?.message).toContain('hold')
  })

  test('Test 4: Rejects missing target_shell in decision', () => {
    const badDecision: ShellGraduationDecision = {
      decision: 'promote',
      reason_codes: ['eligibility_confirmed'],
      confidence: 0.85,
      explanation: 'No target'
    }

    const result = promote(validEntry, badDecision)

    expect(result.success).toBe(false)
    expect(result.error?.type).toBe('invalid_decision')
    expect(result.error?.message).toContain('target_shell')
  })

  test('Test 5: Rejects invalid shell transition (16D to 64D)', () => {
    const badDecision = { ...validDecision, target_shell: '64D' as const }

    const result = promote(validEntry, badDecision)

    expect(result.success).toBe(false)
    expect(result.error?.type).toBe('invalid_transition')
    expect(result.error?.message).toContain('16D')
    expect(result.error?.message).toContain('64D')
  })

  test('Test 6: Rejects promotion when anchor_status is not raw', () => {
    const promotedEntry = { ...validEntry, anchor_status: 'local_anchor' as const }

    const result = promote(promotedEntry, validDecision)

    expect(result.success).toBe(false)
    expect(result.error?.type).toBe('anchor_status_mismatch')
    expect(result.error?.message).toContain('local_anchor')
  })

  test('Test 7: Rejects promotion when provenance is missing', () => {
    const noProvenanceEntry = { ...validEntry, provenance_status: 'missing' as const }

    const result = promote(noProvenanceEntry, validDecision)

    expect(result.success).toBe(false)
    expect(result.error?.type).toBe('provenance_missing')
  })

  test('Test 8: Promotion record includes provenance hash', () => {
    const result = promote(validEntry, validDecision)

    expect(result.success).toBe(true)
    const record = result.record as PromotionRecord
    expect(record.provenance_hash).toBeTruthy()
    expect(record.provenance_hash).toMatch(/^pvh_/)
  })

  test('Test 9: Promotion record includes decision confidence', () => {
    const result = promote(validEntry, validDecision)

    expect(result.success).toBe(true)
    const record = result.record as PromotionRecord
    expect(record.decision_confidence).toBe(0.85)
    expect(typeof record.decision_confidence).toBe('number')
    expect(record.decision_confidence).toBeGreaterThanOrEqual(0)
    expect(record.decision_confidence).toBeLessThanOrEqual(1)
  })

  test('Test 10: validatePromotionPrerequisites detects issues without executing', () => {
    const badDecision = { ...validDecision, decision: 'hold' as const }

    const error = validatePromotionPrerequisites(validEntry, badDecision)

    expect(error).toBeDefined()
    expect(error?.type).toBe('invalid_decision')
  })

  test('Test 11: extractPromotionAuditTrail generates complete trail', () => {
    const record: PromotionRecord = {
      source_shell: '16D',
      target_shell: '32D',
      timestamp: '2026-04-28T12:00:00Z',
      entry_id: '16D_TASK_2026-04-28T00:00:00Z',
      anchor_status_before: 'raw',
      anchor_status_after: 'local_anchor',
      provenance_hash: 'pvh_abc123',
      decision_confidence: 0.85,
      promotion_reason_codes: ['eligibility_confirmed']
    }

    const trail = extractPromotionAuditTrail(record)

    expect(Array.isArray(trail)).toBe(true)
    expect(trail.length).toBeGreaterThan(0)
    expect(trail.some(line => line.includes('PROMOTION'))).toBe(true)
    expect(trail.some(line => line.includes('16D'))).toBe(true)
    expect(trail.some(line => line.includes('32D'))).toBe(true)
    expect(trail.some(line => line.includes('0.850'))).toBe(true)
  })

  test('Test 12: Promotion record has all required fields', () => {
    const result = promote(validEntry, validDecision)

    expect(result.success).toBe(true)
    const record = result.record as PromotionRecord
    expect(record).toHaveProperty('source_shell')
    expect(record).toHaveProperty('target_shell')
    expect(record).toHaveProperty('timestamp')
    expect(record).toHaveProperty('entry_id')
    expect(record).toHaveProperty('anchor_status_before')
    expect(record).toHaveProperty('anchor_status_after')
    expect(record).toHaveProperty('provenance_hash')
    expect(record).toHaveProperty('decision_confidence')
    expect(record).toHaveProperty('promotion_reason_codes')
  })
})
