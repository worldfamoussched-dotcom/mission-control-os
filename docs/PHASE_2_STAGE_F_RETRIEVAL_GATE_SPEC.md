# Phase 2 Stage F — Retrieval Gate Integration Specification

**Status:** DEFINITION MODE — No implementation yet  
**Date:** 2026-04-28  
**Scope:** Policy layer that decides which memory candidates can enter active context  

---

## 1. Purpose

The Retrieval Gate is a gating function that filters memory candidates before they enter the active reasoning context. Its job is to enforce memory access policies based on provenance, decay state, quarantine status, domain alignment, and rule activation state.

**Not:** Vector search, ranking, semantic similarity, UI, database operations, shell promotion.  
**Yes:** Policy enforcement, candidate filtering, context protection, audit trail.

---

## 2. Relationship to Prior Stages

### Dependency Chain

```
Stage B (Shell Graduation)
  ↓
Stage C (Local Anchor Promotion)
  ↓
Stage D (Hebrian Role-Pair Weighting)
  ↓
Stage E (Decay/Quarantine Lifecycle)
  ↓
Stage F (Retrieval Gate Integration) ← YOU ARE HERE
```

### Inputs from Prior Stages

- **Stage B:** `ShellGraduationDecision` — whether an entry was promoted (decision enum: promote | hold | quarantine | reject)
- **Stage C:** `anchor_status` — raw | local_anchor
- **Stage D:** `Hebbian role-pair weights` — co-occurrence frequency from domain ring (controls domain adjacency biases)
- **Stage E:** `decay_state` — fresh | stable | stale | archive_candidate; `quarantine_status` — clear | watch | quarantined
- **Rule Activation Monitor:** `activations` array — preemptive SURFACE | WARN | BLOCK rules that fire before retrieval

### Non-dependency (Separate)

- **0448d69 (Shell Promoter Execution):** Deferred, not part of Stage F. Shell-promoter activation is separate and out-of-sequence.

---

## 3. Inputs

The retrieval gate receives a **retrieval request** and a **candidate pool**.

### Retrieval Request Context

```typescript
interface RetrievalRequest {
  query: string                    // User's actual question/prompt
  active_domain: string            // Primary domain (e.g., "VS", "LX", "AGENCY")
  active_role?: string             // Optional context role (e.g., "decisions", "task")
  session_id: string               // Session identifier
  timestamp: string                // Request timestamp (ISO 8601)
  explicit_cross_domain_reason?: string  // If asking outside active_domain
}
```

### Candidate Memory Items

Each candidate is a memory entry from any shell (8D, 16D, 32D, 64D) that could be relevant:

```typescript
interface RetrievalCandidate {
  id: string
  source_shell: ShellTarget        // Where it lives (8D | 16D | 32D | 64D)
  domain: string
  role?: string
  
  // Lifecycle state from Stage E
  decay_state: "fresh" | "stable" | "stale" | "archive_candidate"
  quarantine_status: "clear" | "watch" | "quarantined"
  
  // Promotion state from Stage C
  anchor_status: "raw" | "local_anchor"
  
  // Provenance from Stage B
  provenance_status: "valid" | "missing" | "unverified"
  
  // Hebbian co-occurrence from Stage D
  weight: number                   // 0–1, strength of signal
  role_pair_weight?: number        // If cross-role, the Hebrian weight
  
  // Observability
  timestamp: string
  observed_sessions: number
  linked_roles: string[]
  
  // Cross-domain metadata
  target_domain?: string
  explicit_cross_domain_reason?: string
  
  // Rule state
  rule_activations?: RuleActivation[]
}
```

### Rule Activations

Preemptive rules from rule-activation-monitor that fire before retrieval:

```typescript
interface RuleActivation {
  rule_id: string
  status: "SURFACE" | "WARN" | "BLOCK"
  reason_code: string
  confidence: number
  timestamp: string
}
```

---

## 4. Outputs

The retrieval gate returns a **retrieval decision** for each candidate and a **retrieval scope** summary.

### Per-Candidate Decision

```typescript
interface RetrievalDecision {
  candidate_id: string
  status: "allowed" | "downgraded" | "blocked"
  reason_codes: string[]
  confidence: number
  explanation: string
  
  // Metadata
  applied_rules: string[]
  audit_trail: {
    checks_performed: string[]
    blocking_factors: string[]
    confidence_modifiers: number[]
  }
}
```

### Retrieval Scope Summary

```typescript
interface RetrievalScope {
  request_id: string
  total_candidates: number
  allowed_count: number
  downgraded_count: number
  blocked_count: number
  
  allowed_items: RetrievalCandidate[]
  downgraded_items: RetrievalCandidate[]
  blocked_items: RetrievalCandidate[]
  
  decisions: RetrievalDecision[]
  reason_code_summary: Record<string, number>
  
  confidence_distribution: {
    high: number      // ≥0.8
    medium: number    // 0.5–0.8
    low: number       // <0.5
  }
  
  audit_metadata: {
    evaluated_at: string
    evaluation_duration_ms: number
    cache_hits?: number
    cache_misses?: number
  }
}
```

---

## 5. Required Contract

Pure TypeScript functions. No I/O, no mutations, no side effects.

### Primary Entry Point

```typescript
export function applyRetrievalGate(
  request: RetrievalRequest,
  candidates: RetrievalCandidate[]
): RetrievalScope
```

### Helper Functions (All exported)

```typescript
// Evaluate a single candidate against retrieval policy
export function evaluateRetrievalCandidate(
  candidate: RetrievalCandidate,
  request: RetrievalRequest
): RetrievalDecision

// Explain why a candidate was allowed/blocked
export function explainRetrievalDecision(
  decision: RetrievalDecision,
  candidate: RetrievalCandidate
): string

// Build the final retrieval scope
export function buildRetrievalScope(
  request: RetrievalRequest,
  candidates: RetrievalCandidate[],
  decisions: RetrievalDecision[]
): RetrievalScope

// Type exports
export type RetrievalRequest = ...
export type RetrievalCandidate = ...
export type RetrievalDecision = ...
export type RetrievalScope = ...
```

---

## 6. Hard Rules

These rules are non-negotiable. Violations = blocked.

### Rule 1: Quarantine Override
**If** `quarantine_status === "quarantined"`  
**Then** `status = "blocked"`, `reason_codes = ["quarantine_blocks_retrieval"]`, exit immediately.

### Rule 2: Missing Provenance
**If** `provenance_status === "missing"`  
**Then** `status = "downgraded"`, `reason_codes = ["missing_provenance"]`.

(Exception: explicit allow-list in request context can override.)

### Rule 3: Cross-Domain Without Reason
**If** `target_domain && target_domain !== request.active_domain && !explicit_cross_domain_reason`  
**Then** `status = "blocked"` OR `status = "downgraded"` (TBD based on policy).  
**Reason code:** `"cross_domain_no_reason"`.

### Rule 4: Rule Activation Override
**If** `rule_activations` contains `{ status: "BLOCK" }`  
**Then** `status = "blocked"`, `reason_codes = [matching_rule_codes]`, exit immediately.

(BLOCK overrides all other logic.)

### Rule 5: Stale/Archive Candidates
**If** `decay_state === "stale"` OR `decay_state === "archive_candidate"`  
**Then** higher bar for retrieval. Require:
- `provenance_status === "valid"` AND
- `weight ≥ 0.7` OR `observed_sessions ≥ 5` OR `anchor_status === "local_anchor"`

(If not met: `status = "downgraded"`, `reason_codes = ["stale_requires_stronger_justification"]`.)

### Rule 6: Immutability
All inputs are treated as immutable. Return new objects, never mutate candidates or requests.

### Rule 7: No External Side Effects
- No source file writes
- No current.md edits
- No database writes
- No filesystem operations
- No HTTP calls
- No shell-promoter activation

---

## 7. Tests Required

Minimum test coverage for retrieval gate:

| Test | Scenario | Expected | Pass/Fail |
|------|----------|----------|-----------|
| 1 | Quarantine blocks | quarantine_status="quarantined" → blocked | Mandatory |
| 2 | Valid provenance allows | provenance="valid", all checks pass → allowed | Mandatory |
| 3 | Missing provenance downgrades | provenance="missing" → downgraded | Mandatory |
| 4 | Cross-domain without reason blocks/downgrades | target_domain ≠ active_domain, no reason → blocked/downgraded | Mandatory |
| 5 | Cross-domain with reason can pass | explicit_cross_domain_reason set → allowed if other checks pass | Mandatory |
| 6 | Stale requires justification | decay_state="stale", weight < 0.7, sessions < 5 → downgraded | Mandatory |
| 7 | Archive candidate requires justification | decay_state="archive_candidate" → downgraded unless anchor or high weight | Mandatory |
| 8 | BLOCK rule overrides | rule_activation BLOCK present → blocked regardless of other checks | Mandatory |
| 9 | Active domain/role ranking | items in active domain ranked higher in confidence | Mandatory |
| 10 | Pure function / no mutation | inputs unchanged after call | Mandatory |
| 11 | Explanation output complete | every decision includes reason_codes array + explanation string | Mandatory |
| 12 | Empty candidate pool | candidates = [] → scope with all counts = 0 | Mandatory |
| 13 | Multiple candidates mixed states | candidates with allowed/downgraded/blocked → scope reflects all three | Mandatory |
| 14 | Hebrian role-pair weights applied | cross-role candidates ranked by role_pair_weight | Suggested |
| 15 | Confidence computation | confidence = weight × (observed_sessions/5) capped at 1.0 | Suggested |

**Test framework:** Vitest (same as other Oracle tests)  
**Mocking:** No mocks — all pure data fixtures  
**Coverage target:** 80%+

---

## 8. Non-Goals (Explicitly Excluded)

❌ **Vector database:** No semantic similarity, no embedding lookups, no ANN queries.  
❌ **Postgres integration:** No DB reads, no migrations, no schema changes.  
❌ **UI panels:** No React components, no dashboards, no visual rendering.  
❌ **Source indexing:** No file system scans, no source inventory changes.  
❌ **Email/social/external integrations:** No outbound messaging.  
❌ **Shell-promoter activation:** That is 0448d69, deferred, not Stage F.  
❌ **Stage G eval execution:** G is "end-to-end retrieval validation" — not yet defined.  

---

## 9. Recommended Implementation Files

### Code

```
ui/lib/oracle/retrieval-gate-integration.ts
```

- Exports: `applyRetrievalGate`, `evaluateRetrievalCandidate`, `explainRetrievalDecision`, `buildRetrievalScope`
- Exports: All type definitions (RetrievalRequest, RetrievalCandidate, RetrievalDecision, RetrievalScope)
- No external dependencies (pure TS)
- ~300–400 lines (same scale as shell-graduation.ts)

### Tests

```
ui/lib/oracle/__tests__/retrieval-gate-integration.test.ts
```

- 15 test cases (mandatory + suggested above)
- Fixtures: sample RetrievalRequest, sample candidate pools (quarantined, valid, missing provenance, cross-domain, stale, etc.)
- All synchronous, no mocks
- Target: 80%+ coverage

---

## 10. Stage F Acceptance Criteria

Stage F is complete when ALL of these are true:

- [ ] Spec document created and committed (`PHASE_2_STAGE_F_RETRIEVAL_GATE_SPEC.md`)
- [ ] `ui/lib/oracle/retrieval-gate-integration.ts` implemented with all 4 exported functions
- [ ] `ui/lib/oracle/__tests__/retrieval-gate-integration.test.ts` with 15+ tests, all passing
- [ ] `npm --prefix ui run build` succeeds (no TS errors)
- [ ] `npm --prefix ui test -- retrieval-gate-integration` shows ≥80% coverage
- [ ] No mutations of inputs (immutability verified in tests)
- [ ] No external side effects (verified by code review)
- [ ] All hard rules (Section 6) implemented and tested
- [ ] Every decision includes reason_codes array + explanation string
- [ ] Spec compliance document created (maps implementation to spec sections)
- [ ] Commit message: `feat(memory): add retrieval gate integration contract`
- [ ] No merge to main until operator authorization (same as Stage B/C/D/E)

---

## 11. Sequencing Note

After Stage F is implemented and tested:

- Stage F closes the Phase 2 definition sequence (A → B → C → D → E → F)
- 0448d69 (shell-promoter) remains deferred — can be merged after Stage F closure if operator authorizes a Stage G, or kept as a reserved branch
- Next phase planning happens after Stage F acceptance and operator review

---

## 12. Implementation Entry Point

After this spec is approved:

**Authorization required before proceeding to implementation.**

Once approved, the implementation task will be:

```
PHASE 2 STAGE F IMPLEMENTATION MODE

Create:
1. ui/lib/oracle/retrieval-gate-integration.ts
2. ui/lib/oracle/__tests__/retrieval-gate-integration.test.ts

Requirements:
- Implement all 4 functions per Section 5
- Pass all 15 tests per Section 7
- 80%+ coverage
- No mutations
- No side effects
- Match spec exactly

Do not:
- Modify existing code
- Change DB
- Change UI
- Change sources
- Call external APIs
- Merge to main
```

---

**End of Stage F Specification**
