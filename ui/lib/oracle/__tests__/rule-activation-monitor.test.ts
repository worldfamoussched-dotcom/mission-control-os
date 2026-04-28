/**
 * Tests for Rule Activation Monitor v0.1
 *
 * Gate 3 validation: ≥80% of preemptive rule activations must be correct
 */

import { detectRuleActivations, RuleMonitorConfig, formatRuleActivationOutput } from "../rule-activation-monitor"

describe("Rule Activation Monitor", () => {
  const mock_8d_rules = {
    "Mathematical Structure — Always On": "Surface underlying structure in every response",
    "Rule 1 — Scope Gate": "Is this true regardless of what project Nick is working on?",
    "Rule 2 — Progressive Disclosure": "Load companion files only when relevant",
    "Rule 3 — Corrections Log": "Log drift immediately when detected",
    "Hard Boundaries — No Exceptions": "Never make purchases, disclose IP, or take public actions without approval"
  }

  const mock_16d_state = {
    current_role: "task",
    session_phase: 1,
    gate_3_status: "TESTING"
  }

  // Test 1: Math Structure Trigger
  test("should activate Mathematical Structure rule when user mentions math patterns", () => {
    const config: RuleMonitorConfig = {
      user_message: "What's the underlying structure of the retrieval system?",
      active_role: "context",
      rules_8d: mock_8d_rules,
      state_16d: mock_16d_state,
      gate_3_failed: false
    }

    const result = detectRuleActivations(config)

    expect(result.activated_rules.length).toBeGreaterThan(0)
    expect(result.activated_rules.some(r => r.rule_name === "Mathematical Structure — Always On")).toBe(true)
    expect(result.action).toBe("SURFACE")
    expect(result.confidence).toBeGreaterThan(0.7)
  })

  // Test 2: Graphify Trigger
  test("should activate Math Structure rule when user types /graphify", () => {
    const config: RuleMonitorConfig = {
      user_message: "/graphify detect rule patterns in codebase",
      active_role: "task",
      rules_8d: mock_8d_rules,
      state_16d: mock_16d_state,
      gate_3_failed: false
    }

    const result = detectRuleActivations(config)

    expect(result.activated_rules.some(r => r.rule_name === "Mathematical Structure — Always On")).toBe(true)
    expect(result.trigger_reason).toContain("graphify")
  })

  // Test 3: Memory Write Trigger
  test("should activate Progressive Disclosure rule when user says remember/save to memory", () => {
    const config: RuleMonitorConfig = {
      user_message: "Please remember this insight about phase transitions and save to memory",
      active_role: "decisions",
      rules_8d: mock_8d_rules,
      state_16d: mock_16d_state,
      gate_3_failed: false
    }

    const result = detectRuleActivations(config)

    expect(result.activated_rules.length).toBeGreaterThan(0)
    expect(result.activated_rules.some(r => r.rule_name === "Rule 2 — Progressive Disclosure")).toBe(true)
    expect(result.action).toBe("SURFACE")
  })

  // Test 4: Phase Gate Trigger (Gate 3 Anti-Drift)
  test("should activate Scope Gate rule when Gate 3 failed and user asks about phase unlock", () => {
    const config: RuleMonitorConfig = {
      user_message: "Can we unlock phase 2 now?",
      active_role: "decisions",
      rules_8d: mock_8d_rules,
      state_16d: mock_16d_state,
      gate_3_failed: true // Gate 3 failed
    }

    const result = detectRuleActivations(config)

    expect(result.activated_rules.some(r => r.rule_name === "Rule 1 — Scope Gate")).toBe(true)
    expect(result.activated_rules.some(r => r.trigger_pattern === "gate_3_anti_drift")).toBe(true)
    expect(result.action).toBe("WARN")
    expect(result.confidence).toBeGreaterThanOrEqual(0.85)
  })

  // Test 5: Non-Trigger Baseline
  test("should not activate rules for generic question", () => {
    const config: RuleMonitorConfig = {
      user_message: "What time is it?",
      active_role: "context",
      rules_8d: mock_8d_rules,
      state_16d: mock_16d_state,
      gate_3_failed: false
    }

    const result = detectRuleActivations(config)

    expect(result.activated_rules.length).toBe(0)
    expect(result.action).toBe("SURFACE")
    expect(result.confidence).toBe(0)
  })

  // Bonus Test: Hard Boundary Detection
  test("should BLOCK and activate Hard Boundaries rule when user mentions payment/post action", () => {
    const config: RuleMonitorConfig = {
      user_message: "I want to make a purchase of $500 for the project",
      active_role: "decisions",
      rules_8d: mock_8d_rules,
      state_16d: mock_16d_state,
      gate_3_failed: false
    }

    const result = detectRuleActivations(config)

    expect(result.activated_rules.some(r => r.rule_name === "Hard Boundaries — No Exceptions")).toBe(true)
    expect(result.action).toBe("BLOCK")
    expect(result.confidence).toBeGreaterThan(0.8)
  })

  // Test: Formatting Output
  test("should format rule activation output correctly", () => {
    const config: RuleMonitorConfig = {
      user_message: "What's the underlying structure here?",
      active_role: "signals",
      rules_8d: mock_8d_rules,
      state_16d: mock_16d_state,
      gate_3_failed: false
    }

    const result = detectRuleActivations(config)
    const formatted = formatRuleActivationOutput(result)

    expect(formatted).toContain("[RULE ACTIVATION MONITOR]")
    if (result.activated_rules.length > 0) {
      expect(formatted).toContain("Mathematical Structure — Always On")
    }
  })

  // Test: Confidence Scoring
  test("should score confidence higher for exact phrase matches", () => {
    const config1: RuleMonitorConfig = {
      user_message: `Please surface "underlying structure" in the next response`,
      active_role: "task",
      rules_8d: mock_8d_rules,
      state_16d: mock_16d_state,
      gate_3_failed: false
    }

    const config2: RuleMonitorConfig = {
      user_message: "I want to see how the system structures things",
      active_role: "task",
      rules_8d: mock_8d_rules,
      state_16d: mock_16d_state,
      gate_3_failed: false
    }

    const result1 = detectRuleActivations(config1)
    const result2 = detectRuleActivations(config2)

    if (result1.activated_rules.length > 0 && result2.activated_rules.length > 0) {
      const conf1 = result1.activated_rules[0]?.confidence || 0
      const conf2 = result2.activated_rules[0]?.confidence || 0
      // Exact match should score >= fuzzy match
      expect(conf1).toBeGreaterThanOrEqual(conf2)
    }
  })
})
