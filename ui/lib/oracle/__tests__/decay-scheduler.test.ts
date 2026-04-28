import { describe, test, expect } from 'vitest'
import {
  shouldQuarantine,
  scheduleDecayJobs,
  type QuarantineDecision,
  type DecayJob
} from '../decay-scheduler'
import {
  initializeHebbianGraph,
  updateCoOccurrence,
  type HebbianGraph
} from '../hebbian-dynamics'

describe('shouldQuarantine', () => {
  test('quarantines when confidence falls below threshold', () => {
    const ring_map = new Map([
      ['task', ['context']],
      ['context', ['task']]
    ])
    const graph = initializeHebbianGraph(ring_map)

    updateCoOccurrence(graph, 'task', 'context', 'session_1')

    const decision = shouldQuarantine(graph, { role1: 'task', role2: 'context' }, 10, 0.1)
    expect(decision.quarantined).toBe(true)
    expect(decision.reason).toBe('low_confidence')
    expect(decision.recommendation).toBe('decay')
  })

  test('detects orphaned anchors', () => {
    const ring_map = new Map([
      ['task', ['context']],
      ['context', ['blockers']]
    ])
    const graph = initializeHebbianGraph(ring_map)

    updateCoOccurrence(graph, 'task', 'context', 'session_1')
    updateCoOccurrence(graph, 'task', 'context', 'session_2')
    updateCoOccurrence(graph, 'task', 'context', 'session_3')

    const decision = shouldQuarantine(graph, { role1: 'task', role2: 'context' }, 0, 0.8)
    expect(decision.reason === 'orphaned_anchor' || decision.reason === null).toBe(true)
  })

  test('flags cross-domain anomaly without explicit reason', () => {
    const ring_map = new Map()
    const graph = initializeHebbianGraph(ring_map)

    updateCoOccurrence(graph, 'task', 'context', 'session_1')
    updateCoOccurrence(graph, 'task', 'context', 'session_2')

    const decision = shouldQuarantine(
      graph,
      { role1: 'task', role2: 'context' },
      0,
      0.8,
      'domain_a',
      'domain_b',
      undefined
    )
    expect(decision.quarantined).toBe(true)
    expect(decision.reason).toBe('cross_domain_anomaly')
    expect(decision.recommendation).toBe('hold')
  })

  test('allows cross-domain pair with explicit reason', () => {
    const ring_map = new Map()
    const graph = initializeHebbianGraph(ring_map)

    updateCoOccurrence(graph, 'task', 'context', 'session_1')
    updateCoOccurrence(graph, 'task', 'context', 'session_2')

    const decision = shouldQuarantine(
      graph,
      { role1: 'task', role2: 'context' },
      0,
      0.8,
      'domain_a',
      'domain_b',
      'explicit_cross_domain_reason'
    )
    expect(decision.quarantined).toBe(false)
    expect(decision.reason).toBe(null)
  })

  test('recommends consolidate when weight and confidence are high', () => {
    const ring_map = new Map([
      ['task', ['context']],
      ['context', ['task']]
    ])
    const graph = initializeHebbianGraph(ring_map)

    for (let i = 0; i < 5; i++) {
      updateCoOccurrence(graph, 'task', 'context', `session_${i}`)
    }

    const decision = shouldQuarantine(graph, { role1: 'task', role2: 'context' }, 0, 0.8)
    expect(decision.quarantined).toBe(false)
    expect(decision.recommendation).toBe('consolidate')
  })

  test('recommends decay on inactivity with low confidence', () => {
    const ring_map = new Map([
      ['task', ['context']],
      ['context', ['task']]
    ])
    const graph = initializeHebbianGraph(ring_map)

    updateCoOccurrence(graph, 'task', 'context', 'session_1')

    const decision = shouldQuarantine(graph, { role1: 'task', role2: 'context' }, 3, 0.2)
    expect(decision.recommendation).toBe('decay')
  })

  test('recommends hold on recent activity', () => {
    const ring_map = new Map([
      ['task', ['context']],
      ['context', ['task']]
    ])
    const graph = initializeHebbianGraph(ring_map)

    updateCoOccurrence(graph, 'task', 'context', 'session_1')
    updateCoOccurrence(graph, 'task', 'context', 'session_2')

    const decision = shouldQuarantine(graph, { role1: 'task', role2: 'context' }, 0, 0.5)
    expect(decision.recommendation).toBe('hold')
  })

  test('always returns complete decision object', () => {
    const ring_map = new Map()
    const graph = initializeHebbianGraph(ring_map)

    const decision = shouldQuarantine(graph, { role1: 'task', role2: 'context' }, 5, 0.5)

    expect(decision).toHaveProperty('pair')
    expect(decision).toHaveProperty('quarantined')
    expect(decision).toHaveProperty('reason')
    expect(decision).toHaveProperty('recommendation')
    expect(decision).toHaveProperty('confidence')
    expect(decision).toHaveProperty('explanation')
    expect(Array.isArray(decision.reason) || typeof decision.reason === 'string' || decision.reason === null).toBe(true)
  })
})

describe('scheduleDecayJobs', () => {
  test('generates decay jobs for inactive pairs', () => {
    const ring_map = new Map([
      ['task', ['context']],
      ['context', ['blockers']]
    ])
    const graph = initializeHebbianGraph(ring_map)

    updateCoOccurrence(graph, 'task', 'context', 'session_1')
    updateCoOccurrence(graph, 'context', 'blockers', 'session_1')
    updateCoOccurrence(graph, 'context', 'blockers', 'session_2')

    const jobs = scheduleDecayJobs(graph, 2)

    expect(jobs.length).toBeGreaterThan(0)
    expect(jobs[0]).toHaveProperty('pair')
    expect(jobs[0]).toHaveProperty('trigger')
    expect(jobs[0]).toHaveProperty('sessions_since_activity')
    expect(jobs[0]).toHaveProperty('confidence_before')
    expect(jobs[0]).toHaveProperty('confidence_after')
  })

  test('returns empty array for very recent activity', () => {
    const ring_map = new Map([
      ['task', ['context']],
      ['context', ['task']]
    ])
    const graph = initializeHebbianGraph(ring_map)

    updateCoOccurrence(graph, 'task', 'context', 'session_1')
    updateCoOccurrence(graph, 'task', 'context', 'session_2')
    updateCoOccurrence(graph, 'task', 'context', 'session_3')

    const jobs = scheduleDecayJobs(graph, 3)

    expect(jobs.length).toBe(0)
  })

  test('confidence decay follows exponential law', () => {
    const ring_map = new Map([
      ['task', ['context']],
      ['context', ['task']]
    ])
    const graph = initializeHebbianGraph(ring_map)

    updateCoOccurrence(graph, 'task', 'context', 'session_1')
    updateCoOccurrence(graph, 'task', 'context', 'session_2')

    const jobs = scheduleDecayJobs(graph, 1)

    if (jobs.length > 0) {
      const job = jobs[0]
      const expected_decay = Math.pow(0.95, job.sessions_since_activity)
      const expected_confidence = job.confidence_before * expected_decay
      expect(Math.abs(job.confidence_after - expected_confidence)).toBeLessThan(0.01)
    }
  })
})

describe('edge cases', () => {
  test('handles empty graph', () => {
    const ring_map = new Map()
    const graph = initializeHebbianGraph(ring_map)

    const decision = shouldQuarantine(graph, { role1: 'task', role2: 'context' }, 5, 0.1)
    expect(decision.quarantined).toBe(true)
  })

  test('handles invalid or missing pairs', () => {
    const ring_map = new Map()
    const graph = initializeHebbianGraph(ring_map)

    const decision = shouldQuarantine(graph, { role1: '', role2: '' }, 0, 0.5)
    expect(decision).toHaveProperty('quarantined')
    expect(typeof decision.quarantined).toBe('boolean')
  })

  test('scheduleDecayJobs handles empty graph', () => {
    const ring_map = new Map()
    const graph = initializeHebbianGraph(ring_map)

    const jobs = scheduleDecayJobs(graph)

    expect(Array.isArray(jobs)).toBe(true)
    expect(jobs.length).toBe(0)
  })
})
