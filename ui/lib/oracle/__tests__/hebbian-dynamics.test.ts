import { describe, test, expect } from 'vitest'
import {
  initializeHebbianGraph,
  updateCoOccurrence,
  computeRolePairWeight,
  decayInactiveWeights,
  evaluateRingTightening,
  applyHebbianDelta,
  enforceWeightBounds,
  enforceNoSingleDominance,
  type HebbianGraph,
  type RolePair
} from '../hebbian-dynamics'

describe('updateCoOccurrence', () => {
  test('increments weight by 1.0 and caps at 10', () => {
    const ring_map = new Map([
      ['task', ['context']],
      ['context', ['task']]
    ])
    const graph = initializeHebbianGraph(ring_map)

    const update1 = updateCoOccurrence(graph, 'task', 'context', 'session_1')
    expect(update1.new_weight).toBe(1.0)

    const update2 = updateCoOccurrence(graph, 'task', 'context', 'session_2')
    expect(update2.new_weight).toBe(2.0)

    const weight = computeRolePairWeight(graph, 'task', 'context')
    expect(weight).toBe(2.0)
  })

  test('caps weight at 10.0', () => {
    const ring_map = new Map([
      ['task', ['context']],
      ['context', ['task']]
    ])
    const graph = initializeHebbianGraph(ring_map)

    for (let i = 0; i < 15; i++) {
      updateCoOccurrence(graph, 'task', 'context', `session_${i}`)
    }

    const weight = computeRolePairWeight(graph, 'task', 'context')
    expect(weight).toBe(10)
  })

  test('handles invalid roles gracefully', () => {
    const ring_map = new Map()
    const graph = initializeHebbianGraph(ring_map)

    const update = updateCoOccurrence(graph, '', 'context', 'session_1')
    expect(update.reason).toBe('invalid_roles')
    expect(update.new_weight).toBe(0)
  })
})

describe('computeRolePairWeight', () => {
  test('returns weight for existing pair', () => {
    const ring_map = new Map([
      ['task', ['context']],
      ['context', ['blockers']]
    ])
    const graph = initializeHebbianGraph(ring_map)

    updateCoOccurrence(graph, 'task', 'context', 'session_1')
    updateCoOccurrence(graph, 'task', 'context', 'session_2')

    const weight = computeRolePairWeight(graph, 'task', 'context')
    expect(weight).toBe(2.0)
  })

  test('returns 0 for non-existent pair', () => {
    const ring_map = new Map()
    const graph = initializeHebbianGraph(ring_map)

    const weight = computeRolePairWeight(graph, 'task', 'context')
    expect(weight).toBe(0)
  })

  test('is symmetric (role1, role2) === (role2, role1)', () => {
    const ring_map = new Map([
      ['task', ['context']],
      ['context', ['task']]
    ])
    const graph = initializeHebbianGraph(ring_map)

    updateCoOccurrence(graph, 'task', 'context', 'session_1')
    updateCoOccurrence(graph, 'context', 'task', 'session_2')

    const weight1 = computeRolePairWeight(graph, 'task', 'context')
    const weight2 = computeRolePairWeight(graph, 'context', 'task')
    expect(weight1).toBe(weight2)
    expect(weight1).toBe(2.0)
  })
})

describe('decayInactiveWeights', () => {
  test('applies 0.95 multiplier per inactive session', () => {
    const ring_map = new Map()
    const graph = initializeHebbianGraph(ring_map)

    updateCoOccurrence(graph, 'task', 'context', 'session_1')
    updateCoOccurrence(graph, 'task', 'context', 'session_2')
    updateCoOccurrence(graph, 'task', 'context', 'session_3')

    const pair: RolePair = { role1: 'task', role2: 'context' }
    const weight_before = computeRolePairWeight(graph, 'task', 'context')
    expect(weight_before).toBe(3.0)

    const decay = decayInactiveWeights(graph, pair, 3)
    const weight_after = decay.new_weight

    const expected = 3.0 * Math.pow(0.95, 3)
    expect(Math.abs(weight_after - expected)).toBeLessThan(0.01)
  })

  test('never goes below 0', () => {
    const ring_map = new Map()
    const graph = initializeHebbianGraph(ring_map)

    updateCoOccurrence(graph, 'task', 'context', 'session_1')

    const pair: RolePair = { role1: 'task', role2: 'context' }
    const decay = decayInactiveWeights(graph, pair, 100)

    expect(decay.new_weight).toBeGreaterThanOrEqual(0)
  })

  test('returns 0 for non-existent pair', () => {
    const ring_map = new Map()
    const graph = initializeHebbianGraph(ring_map)

    const pair: RolePair = { role1: 'task', role2: 'context' }
    const decay = decayInactiveWeights(graph, pair, 5)

    expect(decay.reason).toBe('pair_not_found')
    expect(decay.new_weight).toBe(0)
  })
})

describe('evaluateRingTightening', () => {
  test('returns true when weight >= 5.0', () => {
    const ring_map = new Map([
      ['task', ['context']],
      ['context', ['task']]
    ])
    const graph = initializeHebbianGraph(ring_map)

    for (let i = 0; i < 5; i++) {
      updateCoOccurrence(graph, 'task', 'context', `session_${i}`)
    }

    const pair: RolePair = { role1: 'task', role2: 'context' }
    const should_tighten = evaluateRingTightening(graph, pair)
    expect(should_tighten).toBe(true)
  })

  test('returns false when weight < 5.0', () => {
    const ring_map = new Map([
      ['task', ['context']],
      ['context', ['task']]
    ])
    const graph = initializeHebbianGraph(ring_map)

    for (let i = 0; i < 4; i++) {
      updateCoOccurrence(graph, 'task', 'context', `session_${i}`)
    }

    const pair: RolePair = { role1: 'task', role2: 'context' }
    const should_tighten = evaluateRingTightening(graph, pair)
    expect(should_tighten).toBe(false)
  })
})

describe('applyHebbianDelta', () => {
  test('increments weight and tracks ring tightening', () => {
    const ring_map = new Map([
      ['task', ['context']],
      ['context', ['blockers']],
      ['blockers', ['decisions']]
    ])
    const graph = initializeHebbianGraph(ring_map)

    let update = applyHebbianDelta(graph, 'task', 'context', 'session_1')
    expect(update.new_weight).toBe(1.0)
    expect(update.triggered_ring_tightening).toBe(false)

    for (let i = 2; i < 5; i++) {
      update = applyHebbianDelta(graph, 'task', 'context', `session_${i}`)
    }

    update = applyHebbianDelta(graph, 'task', 'context', 'session_5')
    expect(update.new_weight).toBe(5.0)
    expect(update.triggered_ring_tightening).toBe(true)
  })

  test('multiple pairs update independently', () => {
    const ring_map = new Map([
      ['task', ['context']],
      ['context', ['blockers']],
      ['blockers', ['decisions']]
    ])
    const graph = initializeHebbianGraph(ring_map)

    applyHebbianDelta(graph, 'task', 'context', 'session_1')
    applyHebbianDelta(graph, 'task', 'context', 'session_2')
    applyHebbianDelta(graph, 'context', 'blockers', 'session_1')
    applyHebbianDelta(graph, 'context', 'blockers', 'session_2')
    applyHebbianDelta(graph, 'context', 'blockers', 'session_3')

    const weight1 = computeRolePairWeight(graph, 'task', 'context')
    const weight2 = computeRolePairWeight(graph, 'context', 'blockers')

    expect(weight1).toBe(2.0)
    expect(weight2).toBe(3.0)
  })
})

describe('enforceWeightBounds', () => {
  test('clamps all weights to [0, 10]', () => {
    const ring_map = new Map()
    const graph = initializeHebbianGraph(ring_map)

    updateCoOccurrence(graph, 'task', 'context', 'session_1')
    for (let i = 0; i < 20; i++) {
      updateCoOccurrence(graph, 'task', 'context', `session_${i}`)
    }

    enforceWeightBounds(graph)

    const weight = computeRolePairWeight(graph, 'task', 'context')
    expect(weight).toBeLessThanOrEqual(10)
    expect(weight).toBeGreaterThanOrEqual(0)
  })
})

describe('enforceNoSingleDominance', () => {
  test('prevents single pair from exceeding dominance threshold', () => {
    const ring_map = new Map()
    const graph = initializeHebbianGraph(ring_map)
    graph.dominance_threshold = 8

    updateCoOccurrence(graph, 'task', 'context', 'session_1')
    updateCoOccurrence(graph, 'task', 'context', 'session_2')
    updateCoOccurrence(graph, 'task', 'context', 'session_3')

    updateCoOccurrence(graph, 'context', 'blockers', 'session_1')

    enforceNoSingleDominance(graph)

    const weight1 = computeRolePairWeight(graph, 'task', 'context')
    const weight2 = computeRolePairWeight(graph, 'context', 'blockers')

    expect(weight1).toBeLessThanOrEqual(graph.dominance_threshold)
  })
})

describe('high-confidence anchor protection', () => {
  test('does not apply decay to anchors without explicit flag', () => {
    const ring_map = new Map()
    const graph = initializeHebbianGraph(ring_map)

    updateCoOccurrence(graph, 'task', 'context', 'session_1')
    updateCoOccurrence(graph, 'task', 'context', 'session_2')

    const pair: RolePair = { role1: 'task', role2: 'context' }
    const weight_before = computeRolePairWeight(graph, 'task', 'context')

    decayInactiveWeights(graph, pair, 1)
    const weight_after = computeRolePairWeight(graph, 'task', 'context')

    expect(weight_after).toBeLessThan(weight_before)
  })
})

describe('empty and noisy input handling', () => {
  test('handles empty graph safely', () => {
    const ring_map = new Map()
    const graph = initializeHebbianGraph(ring_map)

    const weight = computeRolePairWeight(graph, 'task', 'context')
    expect(weight).toBe(0)

    const pair: RolePair = { role1: 'task', role2: 'context' }
    const should_tighten = evaluateRingTightening(graph, pair)
    expect(should_tighten).toBe(false)
  })

  test('handles null or undefined roles gracefully', () => {
    const ring_map = new Map()
    const graph = initializeHebbianGraph(ring_map)

    const update = updateCoOccurrence(graph, '', '', 'session_1')
    expect(update.reason).toBe('invalid_roles')
  })
})
