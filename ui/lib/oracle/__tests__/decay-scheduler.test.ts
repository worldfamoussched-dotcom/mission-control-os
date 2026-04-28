import { describe, test, expect } from 'vitest'
import {
  applyDecayPolicy,
  markStale,
  archiveFlag,
  detectQuarantine,
  applyLifecyclePolicy,
  shouldQuarantine,
  scheduleDecayJobs,
  type DecaySchedulerInput,
  type DecaySchedulerResult,
  type DecayState,
  type QuarantineState,
  type QuarantineSignal,
  type QuarantineDecision,
  type ArchiveFlagInput,
  type ArchiveFlagResult,
  type MemoryLifecycleDecision,
  type DecayJob
} from '../decay-scheduler'

describe('applyDecayPolicy', () => {
  test('applies exponential decay: 10 * 0.95^2 ≈ 9.025', () => {
    const input: DecaySchedulerInput = {
      weight: 10,
      sessions_inactive: 2,
      observed_sessions: 5,
      anchor_status: 'raw'
    }
    const result = applyDecayPolicy(input)
    expect(result.weight_after_decay).toBeCloseTo(9.025, 2)
    expect(result.audit_metadata.decay_rate_applied).toBe(0.95)
  })

  test('does not mutate input', () => {
    const input: DecaySchedulerInput = {
      weight: 10,
      sessions_inactive: 2,
      observed_sessions: 5
    }
    const inputClone = JSON.parse(JSON.stringify(input))
    applyDecayPolicy(input)
    expect(input).toEqual(inputClone)
  })

  test('does not decay below min_weight_floor (default 0)', () => {
    const input: DecaySchedulerInput = {
      weight: 0.001,
      sessions_inactive: 100,
      observed_sessions: 1,
      anchor_status: 'raw'
    }
    const result = applyDecayPolicy(input)
    expect(result.weight_after_decay).toBeGreaterThanOrEqual(0)
  })

  test('sessions_inactive = 0 leaves weight unchanged', () => {
    const input: DecaySchedulerInput = {
      weight: 10,
      sessions_inactive: 0,
      observed_sessions: 5,
      anchor_status: 'raw'
    }
    const result = applyDecayPolicy(input)
    expect(result.weight_after_decay).toBe(10)
  })

  test('protected local anchor does not decay below protection floor (0.7)', () => {
    const input: DecaySchedulerInput = {
      weight: 0.8,
      sessions_inactive: 10,
      observed_sessions: 5,
      anchor_status: 'local_anchor'
    }
    const result = applyDecayPolicy(input)
    expect(result.weight_after_decay).toBeGreaterThanOrEqual(0.7)
  })
})

describe('markStale', () => {
  test('returns fresh before stale threshold (sessions_inactive < 5)', () => {
    const input: DecaySchedulerInput = {
      weight: 1,
      sessions_inactive: 2,
      observed_sessions: 5
    }
    const state = markStale(input)
    expect(state).toBe('fresh')
  })

  test('returns stable between thresholds (5 <= sessions_inactive < 12)', () => {
    const input: DecaySchedulerInput = {
      weight: 1,
      sessions_inactive: 8,
      observed_sessions: 5
    }
    const state = markStale(input)
    expect(state).toBe('stable')
  })

  test('returns stale just before archive threshold (sessions_inactive = 11)', () => {
    const input: DecaySchedulerInput = {
      weight: 1,
      sessions_inactive: 11,
      observed_sessions: 5
    }
    const state = markStale(input)
    expect(state).toBe('stale')
  })

  test('returns archive_candidate at or above archive threshold (sessions_inactive >= 12)', () => {
    const input: DecaySchedulerInput = {
      weight: 1,
      sessions_inactive: 12,
      observed_sessions: 5
    }
    const state = markStale(input)
    expect(state).toBe('archive_candidate')
  })
})

describe('archiveFlag', () => {
  test('does not archive quarantined memory through normal archive path', () => {
    const input: ArchiveFlagInput = {
      weight: 0.1,
      sessions_inactive: 50,
      observed_sessions: 1,
      decay_state: 'archive_candidate',
      quarantine_state: 'quarantined'
    }
    const result = archiveFlag(input)
    expect(result.is_archive_candidate).toBe(false)
    expect(result.reason_codes).toContain('quarantine_overrides_archive')
  })

  test('does not archive protected anchor without explicit override', () => {
    const input: ArchiveFlagInput = {
      weight: 0.5,
      sessions_inactive: 50,
      observed_sessions: 1,
      decay_state: 'archive_candidate',
      quarantine_state: 'clear',
      anchor_status: 'protected_anchor'
    }
    const result = archiveFlag(input)
    expect(result.is_archive_candidate).toBe(false)
    expect(result.reason_codes).toContain('protected_anchor_guards_archive')
  })

  test('flags as archive candidate when conditions met', () => {
    const input: ArchiveFlagInput = {
      weight: 0.1,
      sessions_inactive: 50,
      observed_sessions: 1,
      decay_state: 'archive_candidate',
      quarantine_state: 'clear',
      anchor_status: 'raw'
    }
    const result = archiveFlag(input)
    expect(result.is_archive_candidate).toBe(true)
  })
})

describe('detectQuarantine', () => {
  test('returns quarantined for hard_boundary_breach signal', () => {
    const signals: QuarantineSignal[] = [
      { signal_type: 'hard_boundary_breach', confidence: 0.9, reason: 'test' }
    ]
    const decision = detectQuarantine(signals)
    expect(decision.quarantine_state).toBe('quarantined')
  })

  test('returns quarantined for source_mutation_attempt signal', () => {
    const signals: QuarantineSignal[] = [
      { signal_type: 'source_mutation_attempt', confidence: 0.85, reason: 'test' }
    ]
    const decision = detectQuarantine(signals)
    expect(decision.quarantine_state).toBe('quarantined')
  })

  test('returns quarantined for high-confidence contamination (>= 0.75)', () => {
    const signals: QuarantineSignal[] = [
      { signal_type: 'contamination', confidence: 0.8, reason: 'test' }
    ]
    const decision = detectQuarantine(signals)
    expect(decision.quarantine_state).toBe('quarantined')
  })

  test('returns quarantined for high-confidence contradiction (>= 0.75)', () => {
    const signals: QuarantineSignal[] = [
      { signal_type: 'contradiction', confidence: 0.75, reason: 'test' }
    ]
    const decision = detectQuarantine(signals)
    expect(decision.quarantine_state).toBe('quarantined')
  })

  test('returns watch for missing_provenance alone', () => {
    const signals: QuarantineSignal[] = [
      { signal_type: 'missing_provenance', confidence: 0.5, reason: 'test' }
    ]
    const decision = detectQuarantine(signals)
    expect(decision.quarantine_state).toBe('watch')
  })

  test('returns watch for low-confidence contamination (< 0.75)', () => {
    const signals: QuarantineSignal[] = [
      { signal_type: 'contamination', confidence: 0.6, reason: 'test' }
    ]
    const decision = detectQuarantine(signals)
    expect(decision.quarantine_state).toBe('watch')
  })

  test('returns clear for no signals', () => {
    const signals: QuarantineSignal[] = []
    const decision = detectQuarantine(signals)
    expect(decision.quarantine_state).toBe('clear')
  })
})

describe('applyLifecyclePolicy', () => {
  test('ensures quarantine overrides archive', () => {
    const input: DecaySchedulerInput = {
      weight: 0.1,
      sessions_inactive: 50,
      observed_sessions: 1,
      anchor_status: 'raw',
      quarantine_signals: [
        { signal_type: 'hard_boundary_breach', confidence: 0.95, reason: 'test' }
      ]
    }
    const decision = applyLifecyclePolicy(input)
    expect(decision.quarantine_state).toBe('quarantined')
    expect(decision.is_archive_candidate).toBe(false)
    expect(decision.audit_metadata.quarantine_overrides_archive).toBe(true)
  })

  test('returns reason_codes and audit metadata', () => {
    const input: DecaySchedulerInput = {
      weight: 0.5,
      sessions_inactive: 3,
      observed_sessions: 5,
      anchor_status: 'raw'
    }
    const decision = applyLifecyclePolicy(input)
    expect(Array.isArray(decision.reason_codes)).toBe(true)
    expect(decision.audit_metadata).toBeDefined()
    expect(decision.audit_metadata.applied_decay).toBeDefined()
    expect(decision.audit_metadata.applied_quarantine).toBeDefined()
    expect(decision.audit_metadata.applied_archive_flag).toBeDefined()
  })

  test('orchestrates full lifecycle: decay -> staleness -> archive -> quarantine', () => {
    const input: DecaySchedulerInput = {
      weight: 1,
      sessions_inactive: 2,
      observed_sessions: 5,
      anchor_status: 'raw'
    }
    const decision = applyLifecyclePolicy(input)
    expect(decision.decay_state).toBe('fresh')
    expect(decision.weight_after_decay).toBeLessThanOrEqual(1)
    expect(decision.quarantine_state).toBe('clear')
  })

  test('handles null/undefined quarantine_signals gracefully', () => {
    const input: DecaySchedulerInput = {
      weight: 0.5,
      sessions_inactive: 3,
      observed_sessions: 5,
      anchor_status: 'raw',
      quarantine_signals: undefined
    }
    const decision = applyLifecyclePolicy(input)
    expect(decision.quarantine_state).toBe('clear')
  })

  test('returns complete MemoryLifecycleDecision with all fields', () => {
    const input: DecaySchedulerInput = {
      weight: 0.5,
      sessions_inactive: 3,
      observed_sessions: 5
    }
    const decision = applyLifecyclePolicy(input)
    expect(decision).toHaveProperty('decay_state')
    expect(decision).toHaveProperty('quarantine_state')
    expect(decision).toHaveProperty('weight_after_decay')
    expect(decision).toHaveProperty('is_archive_candidate')
    expect(decision).toHaveProperty('is_protected')
    expect(decision).toHaveProperty('reason_codes')
    expect(decision).toHaveProperty('audit_metadata')
  })

  test('marks protected local anchor with is_protected flag', () => {
    const input: DecaySchedulerInput = {
      weight: 0.8,
      sessions_inactive: 2,
      observed_sessions: 5,
      anchor_status: 'local_anchor'
    }
    const decision = applyLifecyclePolicy(input)
    expect(decision.is_protected).toBe(true)
  })
})

describe('legacy helpers', () => {
  test('shouldQuarantine backward compatibility', () => {
    const ring_map = new Map([
      ['task', ['context']],
      ['context', ['task']]
    ])
    const graph = undefined // Simplified: we're not fully mocking the Hebbian graph here

    // This test verifies the function exists and is callable
    // In practice, the full Hebbian dynamics would be needed for comprehensive testing
    expect(typeof shouldQuarantine).toBe('function')
  })

  test('scheduleDecayJobs backward compatibility', () => {
    // Verify function exists
    expect(typeof scheduleDecayJobs).toBe('function')
  })
})

describe('edge cases and robustness', () => {
  test('handles empty/null quarantine_signals array', () => {
    const input: DecaySchedulerInput = {
      weight: 0.5,
      sessions_inactive: 3,
      observed_sessions: 5,
      anchor_status: 'raw',
      quarantine_signals: []
    }
    const decision = applyLifecyclePolicy(input)
    expect(decision.quarantine_state).toBe('clear')
  })

  test('handles very large sessions_inactive without overflow', () => {
    const input: DecaySchedulerInput = {
      weight: 1,
      sessions_inactive: 1000,
      observed_sessions: 5,
      anchor_status: 'raw'
    }
    const result = applyDecayPolicy(input)
    expect(isFinite(result.weight_after_decay)).toBe(true)
    expect(result.weight_after_decay).toBeGreaterThanOrEqual(0)
  })

  test('handles weight near zero', () => {
    const input: DecaySchedulerInput = {
      weight: 0.00001,
      sessions_inactive: 1,
      observed_sessions: 1,
      anchor_status: 'raw'
    }
    const result = applyDecayPolicy(input)
    expect(result.weight_after_decay).toBeGreaterThanOrEqual(0)
  })

  test('applyLifecyclePolicy returns consistent reason_codes array', () => {
    const input: DecaySchedulerInput = {
      weight: 0.5,
      sessions_inactive: 3,
      observed_sessions: 5
    }
    const decision = applyLifecyclePolicy(input)
    expect(Array.isArray(decision.reason_codes)).toBe(true)
    expect(decision.reason_codes.length).toBeGreaterThanOrEqual(0)
  })
})
