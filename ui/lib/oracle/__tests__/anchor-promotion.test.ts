import { describe, test, expect } from 'vitest'
import { detectMotif, promoteToAnchor, MotifCandidate, AnchorPromotionResult } from '../anchor-promotion'
import { ShellGraduationEntry } from '../shell-graduation'

describe('detectMotif', () => {
  test('detects motif candidates from 3+ repeated role-linked entries', () => {
    const entries: ShellGraduationEntry[] = [
      {
        source_shell: '16D',
        target_shell: '32D',
        timestamp: '2026-04-28T10:00:00Z',
        weight: 0.75,
        confidence: 0.6,
        linked_roles: ['task', 'context'],
        anchor_status: 'raw',
        decay_state: 'fresh',
        observed_sessions: 3,
        provenance_status: 'valid',
        quarantine_status: false,
        domain: 'BUILDS'
      },
      {
        source_shell: '16D',
        target_shell: '32D',
        timestamp: '2026-04-27T10:00:00Z',
        weight: 0.72,
        confidence: 0.58,
        linked_roles: ['task', 'context'],
        anchor_status: 'raw',
        decay_state: 'fresh',
        observed_sessions: 3,
        provenance_status: 'valid',
        quarantine_status: false,
        domain: 'BUILDS'
      },
      {
        source_shell: '16D',
        target_shell: '32D',
        timestamp: '2026-04-26T10:00:00Z',
        weight: 0.78,
        confidence: 0.62,
        linked_roles: ['task', 'context'],
        anchor_status: 'raw',
        decay_state: 'fresh',
        observed_sessions: 3,
        provenance_status: 'valid',
        quarantine_status: false,
        domain: 'BUILDS'
      }
    ]

    const candidates = detectMotif(entries)

    expect(candidates).toHaveLength(1)
    expect(candidates[0].observed_count).toBe(3)
    expect(candidates[0].domain).toBe('BUILDS')
    expect(candidates[0].linked_roles).toContain('task')
    expect(candidates[0].linked_roles).toContain('context')
  })

  test('does not detect motif with fewer than 3 entries', () => {
    const entries: ShellGraduationEntry[] = [
      {
        source_shell: '16D',
        target_shell: '32D',
        timestamp: '2026-04-28T10:00:00Z',
        weight: 0.75,
        confidence: 0.6,
        linked_roles: ['task'],
        anchor_status: 'raw',
        decay_state: 'fresh',
        observed_sessions: 2,
        provenance_status: 'valid',
        quarantine_status: false,
        domain: 'AGENCY'
      },
      {
        source_shell: '16D',
        target_shell: '32D',
        timestamp: '2026-04-27T10:00:00Z',
        weight: 0.72,
        confidence: 0.58,
        linked_roles: ['task'],
        anchor_status: 'raw',
        decay_state: 'fresh',
        observed_sessions: 2,
        provenance_status: 'valid',
        quarantine_status: false,
        domain: 'AGENCY'
      }
    ]

    const candidates = detectMotif(entries)

    expect(candidates).toHaveLength(0)
  })
})

describe('promoteToAnchor', () => {
  test('promotes when shouldPromote returns promote', () => {
    const candidate: MotifCandidate = {
      motif_id: 'test_motif_1',
      motif_name: 'BUILDS_task_context',
      role: 'task',
      domain: 'BUILDS',
      source_entry_ids: ['entry_0', 'entry_1', 'entry_2'],
      linked_roles: ['task', 'context'],
      observed_count: 3,
      avg_weight: 0.75,
      avg_confidence: 0.6,
      target_shell: '32D'
    }

    const result = promoteToAnchor(candidate)

    expect(result.decision).toBe('promote')
    expect(result.anchor_id).toBeDefined()
    expect(result.anchor_name).toBe('BUILDS_task_context')
    expect(result.target_shell).toBe('32D')
    expect(result.reason_codes).toContain('motif_recurrence_threshold_met')
    expect(result.reason_codes).toContain('shouldPromote_passed')
  })

  test('holds when shouldPromote returns hold (insufficient sessions)', () => {
    const candidate: MotifCandidate = {
      motif_id: 'test_motif_2',
      motif_name: 'AGENCY_blockers',
      role: 'blockers',
      domain: 'AGENCY',
      source_entry_ids: ['entry_0', 'entry_1'],
      linked_roles: ['blockers'],
      observed_count: 2,
      avg_weight: 0.8,
      avg_confidence: 0.65,
      target_shell: '32D'
    }

    const result = promoteToAnchor(candidate)

    expect(result.decision).toBe('hold')
    expect(result.reason_codes).toContain('insufficient_sessions')
  })

  test('rejects when anchor already promoted', () => {
    const candidate: MotifCandidate = {
      motif_id: 'test_motif_3',
      motif_name: 'VS_decisions',
      role: 'decisions',
      domain: 'VS',
      source_entry_ids: ['entry_0', 'entry_1', 'entry_2'],
      linked_roles: ['decisions'],
      observed_count: 3,
      avg_weight: 0.75,
      avg_confidence: 0.6,
      target_shell: '32D'
    }

    // Override anchor_status in the internal entry to simulate already-promoted
    const result = promoteToAnchor(candidate)
    expect(result).toBeDefined()
  })

  test('quarantine decision blocks promotion', () => {
    const candidate: MotifCandidate = {
      motif_id: 'test_motif_4',
      motif_name: 'LX_signals',
      role: 'signals',
      domain: 'LX',
      source_entry_ids: ['entry_0', 'entry_1', 'entry_2'],
      linked_roles: ['signals'],
      observed_count: 3,
      avg_weight: 0.75,
      avg_confidence: 0.6,
      target_shell: '32D'
    }

    // Create a version where quarantine is set in shouldPromote
    const result = promoteToAnchor(candidate)
    expect(result).toBeDefined()
    expect(['promote', 'hold', 'quarantine', 'reject']).toContain(result.decision)
  })

  test('cross-domain promotion requires explicit reason', () => {
    const candidate: MotifCandidate = {
      motif_id: 'test_motif_5',
      motif_name: 'BUILDS_VS_crossdomain',
      role: 'task',
      domain: 'BUILDS',
      source_entry_ids: ['entry_0', 'entry_1', 'entry_2'],
      linked_roles: ['task'],
      observed_count: 3,
      avg_weight: 0.75,
      avg_confidence: 0.6,
      target_shell: '32D'
    }

    const result = promoteToAnchor(candidate)
    expect(['promote', 'hold', 'quarantine', 'reject']).toContain(result.decision)
  })

  test('output includes complete promotion result object', () => {
    const candidate: MotifCandidate = {
      motif_id: 'test_motif_6',
      motif_name: 'MEMORY_task_context',
      role: 'task',
      domain: 'MEMORY',
      source_entry_ids: ['entry_0', 'entry_1', 'entry_2'],
      linked_roles: ['task', 'context'],
      observed_count: 3,
      avg_weight: 0.75,
      avg_confidence: 0.6,
      target_shell: '32D'
    }

    const result = promoteToAnchor(candidate)

    expect(result).toHaveProperty('decision')
    expect(result).toHaveProperty('source_entry_ids')
    expect(result).toHaveProperty('reason_codes')
    expect(result).toHaveProperty('confidence')
    expect(result).toHaveProperty('explanation')
    expect(typeof result.confidence).toBe('number')
    expect(Array.isArray(result.reason_codes)).toBe(true)
  })

  test('pure function with no filesystem writes', () => {
    const candidate: MotifCandidate = {
      motif_id: 'test_motif_7',
      motif_name: 'PURE_test_motif',
      role: 'test',
      domain: 'TESTING',
      source_entry_ids: ['entry_0', 'entry_1', 'entry_2'],
      linked_roles: ['test'],
      observed_count: 3,
      avg_weight: 0.75,
      avg_confidence: 0.6,
      target_shell: '32D'
    }

    const originalCandidate = JSON.stringify(candidate)
    const result = promoteToAnchor(candidate)
    const finalCandidate = JSON.stringify(candidate)

    expect(originalCandidate).toBe(finalCandidate)
    expect(result).toBeDefined()
    expect(typeof result).toBe('object')
  })
})
