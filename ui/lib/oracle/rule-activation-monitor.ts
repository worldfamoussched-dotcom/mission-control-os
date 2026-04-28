/**
 * Rule Activation Monitor v0.1
 *
 * Detects when user input triggers relevant 8D rules from CLAUDE.md
 * and surfaces them preemptively to prevent retrieval timing drift.
 *
 * Solves Gate 3 failure: rules exist in 8D but don't surface until user
 * has already flagged drift. This monitor activates them early.
 */

export interface ActivatedRule {
  rule_name: string
  section: string
  matched_text: string
  trigger_pattern: string
  confidence: number
}

export interface RuleActivationResult {
  activated_rules: ActivatedRule[]
  trigger_reason: string
  source_shell: "8D"
  target_shell: "16D"
  confidence: number
  action: "SURFACE" | "WARN" | "BLOCK"
  timestamp: string
}

export interface RuleMonitorConfig {
  user_message: string
  active_role: "task" | "context" | "blockers" | "decisions" | "signals"
  rules_8d: Record<string, string> // rule_name -> rule_text from CLAUDE.md
  state_16d: Record<string, unknown>
  gate_3_failed: boolean
}

/**
 * Pattern definitions for rule triggers
 */
const TRIGGER_PATTERNS = {
  math_structure: {
    patterns: ["mathematical structure", "/graphify", "underlying structure", "formula", "ratio", "feedback loop"],
    rule: "Mathematical Structure — Always On",
    section: "CLAUDE.md — Mathematical Structure"
  },
  memory_write: {
    patterns: ["remember", "save to memory", "store memory", "forget", "delete memory", "write to memory"],
    rule: "Rule 2 — Progressive Disclosure",
    section: "CLAUDE.md — Rule 2"
  },
  phase_gate: {
    patterns: ["unlock phase", "gate evaluation", "phase 2", "checkpoint", "gate 3", "retrieval timing"],
    rule: "Phase Gate Evaluation",
    section: "CLAUDE.md — Drift Prevention"
  },
  scope_gate: {
    patterns: ["scope gate", "project-specific", "belongs in current.md", "write to claude.md", "identity-level"],
    rule: "Rule 1 — Scope Gate",
    section: "CLAUDE.md — Rule 1"
  },
  corrections_log: {
    patterns: ["correction", "drift", "rule violation", "caught by nick", "corrections log"],
    rule: "Rule 3 — Corrections Log",
    section: "CLAUDE.md — Rule 3"
  },
  boundary_breach: {
    patterns: ["financial", "purchase", "payment", "card", "account number", "password", "social security", "public action", "post to social", "send email"],
    rule: "Hard Boundaries — No Exceptions",
    section: "CLAUDE.md — Hard Boundaries"
  }
}

/**
 * Core monitor function
 */
export function detectRuleActivations(config: RuleMonitorConfig): RuleActivationResult {
  const { user_message, active_role, rules_8d, state_16d, gate_3_failed } = config

  const message_lower = user_message.toLowerCase()
  const activated: ActivatedRule[] = []
  let max_confidence = 0
  let primary_trigger = ""
  let action: "SURFACE" | "WARN" | "BLOCK" = "SURFACE"

  // Check each trigger pattern
  for (const [trigger_key, trigger_def] of Object.entries(TRIGGER_PATTERNS)) {
    for (const pattern of trigger_def.patterns) {
      if (message_lower.includes(pattern.toLowerCase())) {
        const confidence = calculateConfidence(pattern, message_lower, trigger_key, gate_3_failed)

        // Find the rule in 8D
        const rule_text = rules_8d[trigger_def.rule] || ""

        activated.push({
          rule_name: trigger_def.rule,
          section: trigger_def.section,
          matched_text: pattern,
          trigger_pattern: trigger_key,
          confidence
        })

        if (confidence > max_confidence) {
          max_confidence = confidence
          primary_trigger = trigger_key
          action = determineAction(trigger_key, confidence)
        }
      }
    }
  }

  // Anti-drift: if Gate 3 failed, always surface Scope Gate rule
  if (gate_3_failed && !activated.some(r => r.rule_name === "Rule 1 — Scope Gate")) {
    activated.push({
      rule_name: "Rule 1 — Scope Gate",
      section: "CLAUDE.md — Rule 1",
      matched_text: "gate-3-failed",
      trigger_pattern: "gate_3_anti_drift",
      confidence: 0.95
    })
    action = "WARN"
    max_confidence = Math.max(max_confidence, 0.95)
  }

  const trigger_reason = activated.length > 0
    ? `Matched patterns: ${activated.map(r => r.matched_text).join(", ")}`
    : "No rule triggers detected"

  return {
    activated_rules: activated,
    trigger_reason,
    source_shell: "8D",
    target_shell: "16D",
    confidence: max_confidence,
    action,
    timestamp: new Date().toISOString()
  }
}

/**
 * Calculate confidence score based on pattern match quality
 */
function calculateConfidence(
  pattern: string,
  message: string,
  trigger_key: string,
  gate_3_failed: boolean
): number {
  let base = 0.7

  // Exact phrase match → higher confidence
  if (message.includes(`"${pattern}"`)) {
    base = 0.95
  }
  // Word boundary match (pattern as standalone word)
  else if (new RegExp(`\\b${pattern}\\b`, "i").test(message)) {
    base = 0.85
  }

  // Boost for anti-drift context
  if (gate_3_failed && trigger_key === "scope_gate") {
    base = Math.min(base + 0.15, 1.0)
  }

  return base
}

/**
 * Determine severity of action
 */
function determineAction(trigger_key: string, confidence: number): "SURFACE" | "WARN" | "BLOCK" {
  // Hard boundary violations → BLOCK
  if (trigger_key === "boundary_breach" && confidence > 0.8) {
    return "BLOCK"
  }
  // Phase gate / scope gate failures → WARN
  if ((trigger_key === "phase_gate" || trigger_key === "scope_gate") && confidence > 0.85) {
    return "WARN"
  }
  // Everything else → SURFACE
  return "SURFACE"
}

/**
 * Format activated rules for display to user
 */
export function formatRuleActivationOutput(result: RuleActivationResult): string {
  if (result.activated_rules.length === 0) {
    return ""
  }

  let output = "\n[RULE ACTIVATION MONITOR]\n"
  output += `Confidence: ${(result.confidence * 100).toFixed(0)}% | Action: ${result.action}\n`
  output += `─────────────────────────\n`

  for (const rule of result.activated_rules) {
    output += `\n📌 ${rule.rule_name}\n`
    output += `   Location: ${rule.section}\n`
    output += `   Trigger: "${rule.matched_text}"\n`
    output += `   Confidence: ${(rule.confidence * 100).toFixed(0)}%\n`
  }

  if (result.action === "WARN") {
    output += `\n⚠️  RETRIEVAL TIMING CHECK: Review the activated rules above before proceeding.\n`
  } else if (result.action === "BLOCK") {
    output += `\n🛑 BOUNDARY VIOLATION DETECTED: Cannot proceed. Review hard boundaries in CLAUDE.md.\n`
  }

  return output
}
