import { describe, test, expect } from 'vitest'
import { shouldPromote, ShellGraduationEntry, ShellGraduationDecision } from '../shell-graduation'

describe('Shell Graduation Contract', () => {
  const validBase: ShellGraduationEntry = {
    source_shell: '16D',
    target_shell: '32D',
    timestamp: '2026-04-28T00:00:00Z',
    weight: 0.7,
    confidence: 0.7,
    linked_roles: ['task', 'context'],
    anchor_status: 'raw',
    decay_state: 'fresh',
    observed_sessions: 3,
    provenance_status: 'valid',
    quarantine_status: false,
    domain: 'TASK',
    target_domain: 'TASK'
  }

  test('Test 1: Valid 16D to 32D candidate with all thresholds passing promotes', () => {
    const entry = { ...validBase }
    const result = shouldPromote(entry)

    expect(result.decision).toBe('promote')
    expect(result.target_shell).toBe('32D')
    expect(result.reason_codes).toContain('eligibility_confirmed')
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(result.explanation).toBeTruthy()
  })

  test('Test 2: Hold when observed_sessions below threshold', () => {
    const entry = { ...validBase, observed_sessions: 2 }
    const result = shouldPromote(entry)

    expect(result.decision).toBe('hold')
    expect(result.reason_codes).toContain('insufficient_sessions')
    expect(result.explanation).toContain('threshold')
  })

  test('Test 3: Hold when provenance is missing', () => {
    const entry = { ...validBase, provenance_status: 'missing' }
    const result = shouldPromote(entry)

    expect(result.decision).toBe('hold')
    expect(result.reason_codes).toContain('missing_provenance')
    expect(result.explanation).toContain('provenance')
  })

  test('Test 4: Quarantine beats all other passing conditions', () => {
    const entry = { ...validBase, quarantine_status: true }
    const result = shouldPromote(entry)

    expect(result.decision).toBe('quarantine')
    expect(result.reason_codes).toContain('quarantined')
    expect(result.confidence).toBe(0)
  })

  test('Test 5: Cross-domain promotion held without explicit reason', () => {
    const entry = {
      ...validBase,
      target_domain: 'CONTEXT',
      explicit_cross_domain_reason: undefined
    }
    const result = shouldPromote(entry)

    expect(result.decision).toBe('hold')
    expect(result.reason_codes).toContain('cross_domain_no_reason')
    expect(result.explanation).toContain('Cross-domain')
  })

  test('Test 6: 8D promotion requires stronger evidence (higher observed_sessions and weight)', () => {
    const entry = {
      ...validBase,
      target_shell: '8D' as const,
      observed_sessions: 3,
      weight: 0.7
    }
    const result = shouldPromote(entry)

    expect(result.decision).toBe('hold')
    expect(result.reason_codes).toContain('8d_requires_stronger_evidence')
    expect(result.explanation).toContain('8D')
  })

  test('Test 7: Output always includes decision, reason_codes, confidence, and explanation', () => {
    const entry = { ...validBase }
    const result = shouldPromote(entry)

    expect(result).toHaveProperty('decision')
    expect(result).toHaveProperty('reason_codes')
    expect(result).toHaveProperty('confidence')
    expect(result).toHaveProperty('explanation')

    expect(typeof result.decision).toBe('string')
    expect(Array.isArray(result.reason_codes)).toBe(true)
    expect(typeof result.confidence).toBe('number')
    expect(typeof result.explanation).toBe('string')

    expect(result.reason_codes.length).toBeGreaterThan(0)
    expect(result.explanation.length).toBeGreaterThan(0)
  })

  test('Test 8: Already promoted entry is rejected', () => {
    const entry = { ...validBase, anchor_status: 'local_anchor' }
    const result = shouldPromote(entry)

    expect(result.decision).toBe('reject')
    expect(result.reason_codes).toContain('already_promoted')
    expect(result.confidence).toBe(0)
    expect(result.explanation).toContain('already promoted')
  })
})
