# Phase 2 Fractal Memory Consolidation Plan

**Status:** Planning mode (do not implement yet)  
**Created:** 2026-04-28  
**Checkpoint:** Rule activation monitor verified, all gates PASS, Phase 2 unlock confirmed

---

## 1. Phase 2 Objective

**Consolidation** means upgrading Fractal Memory from isolated per-session state tracking (Phase 1) to a persistent, cross-session learning system that:

- **Learns from repetition:** Promotes motifs that appear 3+ times across sessions into local anchors
- **Manages decay:** Soft-dampens low-weight entries instead of hard-deleting, preserving context
- **Routes retrieval:** Uses rule activation monitor (Gate 3) to prevent timing-based contamination
- **Maintains shell boundaries:** Enforces Scope Gate (8D vs. 16D vs. 32D) so context doesn't bleed across domains

**Why Phase 2 before Phase 4 UI expansion:**  
Phase 4 adds vector DB, UI panels, and external integrations — all of which depend on stable, governable memory. Phase 2 builds the governance engine (consolidation rules, shell graduation, Hebbian dynamics, decay). Without Phase 2 in place, Phase 4 memory operations would be brittle and contamination-prone.

**The sequence is:** memory consolidation rules → tests → checkpoint → then UI expansion.

---

## 2. Current Verified Baseline

- **Gate 1:** PASS (role boundaries intact, no cross-contamination during Session 3)
- **Gate 2:** PASS (Hebbian dynamics stable, no oscillation detected)
- **Gate 3:** PASS (retrieval timing verified, rule activation monitor routing correct)
- **Rule activation monitor:** Installed in `ui/lib/oracle/rule-activation-monitor.ts`, 8/8 tests passing
- **Build:** Verified passing from `ui/` directory using `npm --prefix ui run build`
- **current.md checkpoint:** Logged outside repo at `~/.claude/projects/-Users-Malachi/memory/current.md` with timestamp, gates, and Phase 2 unlock flag

---

## 3. Consolidation Scope

Phase 2 implements the sub-shell kernel (Fractal Memory spec, Phase 1 only):

### 3.1 Shell Graduation Rules
- **Trigger:** Entry appears in 3+ consecutive sessions AND weight ≥ 0.7 AND anchor_status remains raw
- **Action:** Promote from 16D task/context/blockers/decisions/signals → 32D (durable facts) or 8D (identity-level rules)
- **Validation:** Scope Gate test — entry must pass "true regardless of project?" check before 8D promotion
- **Implementation:** `promote_entry(entry, target_shell)` with Scope Gate validation

### 3.2 Local Anchor Promotion
- **Trigger:** Motif (recurring pattern in entries) appears 3+ times within a role's sub-section
- **Action:** Create local_anchor (lightweight consolidation point) within the role, reduce leaf entries
- **Metadata:** Mark anchor_status = `local_anchor`, keep timestamp of first occurrence, track observed_count
- **Example:** "Phase N unlock" appears 3 times → create a `_phase_unlocks` anchor in task section

### 3.3 Hebbian Weight Updates
- **Trigger:** Two roles co-appear in the same session
- **Action:** Increment their co-occurrence weight (rule: "task ↔ context" strengthens when both active)
- **Decay:** Exponential dampening when pairs don't co-occur (weight *= 0.95 per inactive session)
- **Ring distance:** When co-occurrence weight crosses θ=5, tighten ring distance (move pair closer in retrieval)
- **Implementation:** Hebbian graph update on session close, before consolidation scan

### 3.4 Soft Decay
- **Hard rule:** 8D never decays
- **Rule:** 16D items with observed_sessions < 2 get decay_state = `stale` after 30 days inactive
- **Action:** Merge stale entries into related local_anchors (don't delete), or archive flag for review
- **Threshold:** 90 days inactive → archive flag (still exists, retrievable, but deprioritized)

### 3.5 Quarantine Rules
- **Trigger:** Entry contains project-specific detail (fails Scope Gate) detected during consolidation scan
- **Action:** Flag entry as `quarantine_violation`, link to appropriate companion file (vampiresex.md, londonx.md, current.md, etc.)
- **Review:** Logged for manual audit, not auto-deleted
- **Purpose:** Catch drift before it becomes permanent durable memory

### 3.6 Retrieval Gate Integration
- **Input:** User prompt arrives, triggers rule activation monitor
- **Action:** If Gate 3 detected (timing-based trigger), load only 8D + 16D, defer 32D/64D until explicit request
- **Output:** RuleActivationResult routes retrieval scope based on detected triggers
- **Implementation:** Integrate gate result into memory recall, confirm no cross-contamination

### 3.7 Bootstrap Context Updates
- **Current:** `bootstrap_context()` returns frozen 16D view
- **Phase 2 addition:** Include local_anchor promotions, shell graduation candidates, Hebbian ring distances
- **Output:** Still ~1000–2000 tokens (compact), but now reflects learned structure

### 3.8 Eval Requirements
- **Session consistency:** Same prompt in two consecutive sessions → retrieve same 16D entries with same weights
- **Promotion correctness:** Entry that appears 3+ times is eventually promoted without manual intervention
- **Decay visibility:** Entry marked stale is deprioritized in retrieval ranking, still accessible
- **Quarantine detection:** Scope Gate violations are flagged, not silently promoted to durable memory
- **Ring distance accuracy:** Hebbian pairs with co-occurrence > θ increase retrieval speed (measured by callbacks)

---

## 4. Non-Goals (Explicitly Out of Scope)

- **Phase 4 UI expansion:** No new pages, panels, or frontend components
- **Postgres implementation:** No database schema, migrations, or SQL
- **Vector DB implementation:** No embedding, similarity search, or vector operations
- **Real external integrations:** No API calls, email, social posting, or third-party services
- **Autonomous actions:** No email scheduling, social automation, or fire-and-forget webhooks
- **Mutation of immutable sources:** oracle-memory/sources remains read-only
- **New test frameworks:** Use existing vitest setup, no new test dependencies

---

## 5. Proposed File Targets

Files likely to be inspected or edited during Phase 2 implementation:

- `~/.claude/projects/-Users-Malachi/memory/current.md` — Main shell to consolidate (read-only reference here, edits in-session)
- `~/.claude/projects/-Users-Malachi/memory/fractal-memory.md` — Phase 1 spec, reference for kernel behavior
- `~/.claude/projects/-Users-Malachi/memory/snapshot_session_01.md` — Frozen baseline, reference for diff-based evaluation
- `~/.claude/CLAUDE.md` — Shell graduation candidates (Rule 3 Corrections Log, recurring patterns)
- `ui/lib/oracle/rule-activation-monitor.ts` — Gate 3 integration point (already exists, may refine)
- `ui/lib/oracle/fractal-consolidator.ts` — NEW: Consolidation engine (shell graduation, anchor promotion, Hebbian update)
- `ui/lib/oracle/__tests__/fractal-consolidator.test.ts` — NEW: Consolidation tests
- `docs/PHASE_2_FRACTAL_MEMORY_CONSOLIDATION_PLAN.md` — THIS FILE

---

## 6. Risk Model

### 6.1 Memory Drift
**Risk:** Consolidation logic promotes wrong entries, causing 16D to diverge from actual session behavior  
**Mitigation:** Snapshot session_01 baseline + diff-based evaluation before promotion; Scope Gate validation; local_anchor review threshold

### 6.2 Over-Promotion
**Risk:** Entry that appeared 3 times in one domain gets promoted to 32D, contaminating sibling domains  
**Mitigation:** Scope Gate test (mandatory on all 8D/32D candidates); audit log of every promotion

### 6.3 Retrieval Contamination
**Risk:** Gate 3 timeout or rule monitor false-positive loads wrong shell layers, mixing contexts  
**Mitigation:** Rule activation monitor already has 8/8 passing tests; retrieval gate validation in eval matrix

### 6.4 Source Mutation
**Risk:** Consolidation logic accidentally edits oracle-memory/sources (immutable)  
**Mitigation:** Hard rule in implementation — no write access to oracle-memory/sources; read-only contract

### 6.5 Cross-Domain Leakage
**Risk:** Hebbian update incorrectly links unrelated domains (e.g., music strategy ↔ code architecture)  
**Mitigation:** Domain code ring distance verification; co-occurrence weight threshold (θ=5) prevents premature tightening

### 6.6 Fake Capability / Mock Confusion
**Risk:** Consolidation shows "promoted to 32D" but shell graduation logic isn't actually working  
**Mitigation:** Eval requires: shell graduation actually moves entries, bootstrap reflects promoted state, retrieval ranking changes

---

## 7. Eval Matrix

**Evals required before Phase 2 implementation is accepted:**

| Eval | Input | Expected Output | Test Type |
|------|-------|-----------------|-----------|
| Session consistency | Same prompt in sessions N, N+1 | Retrieved 16D entries + weights unchanged | Integration |
| Promotion correctness | Entry with observed_sessions=3, weight=0.9 | Promoted to 32D or flagged as candidate | Unit |
| Decay visibility | Entry observed_sessions=1, last seen 40 days ago | decay_state=stale, deprioritized in ranking | Unit |
| Quarantine detection | Entry fails Scope Gate | Flagged quarantine_violation, not promoted | Unit |
| Hebbian ring accuracy | Two roles co-occur 5+ times | Ring distance tightens, retrieval callback count ↓ | Integration |
| Bootstrap reflects state | bootstrap_context() after consolidation run | Includes local_anchor promotions + ring distances | Integration |
| Shell boundary enforcement | Phase 4 component data in 16D entry | Scope Gate blocks promotion to 8D | Unit |
| Immutability hold | Consolidation runs 1000 times | oracle-memory/sources unchanged | Integration |

---

## 8. Implementation Sequence

**Do not implement yet. This is the proposed order:**

**A. Inspect Existing Memory Tools**
- Read `ui/lib/oracle/rule-activation-monitor.ts` (already done, 8/8 tests passing)
- Read `~/.claude/projects/-Users-Malachi/memory/fractal-memory.md` (Phase 1 spec reference)
- Understand snapshot_session_01.md frozen baseline (for diff-based evaluation)

**B. Define Shell Graduation Contract**
- Create `ui/lib/oracle/shell-graduation.contract.ts` (types, rules, validation)
- Implement `shouldPromote(entry): { decision, reason, target_shell }` with Scope Gate validation
- Write unit tests (5 cases: valid 8D candidate, valid 32D candidate, Scope Gate fail, weight too low, already promoted)

**C. Implement Anchor Promotion**
- Create `ui/lib/oracle/anchor-promotion.ts` (local_anchor detection and promotion)
- Implement `detectMotif(role_entries): Motif[]` (find recurring patterns)
- Implement `promoteToAnchor(motif): local_anchor_entry`
- Write unit tests (3 cases: 3-occurrence motif, 2-occurrence no-promote, merge existing anchors)

**D. Implement Hebbian Update Rules**
- Create `ui/lib/oracle/hebbian-dynamics.ts` (Hebbian graph + weight decay)
- Implement `updateCoOccurrence(role1, role2, session_id)` (increment weight)
- Implement `decayInactiveWeights(inactive_since)` (exponential dampening)
- Implement `evaluateRingTightening(pair): boolean` (θ=5 threshold check)
- Write unit tests (4 cases: weight increment, decay, ring tightening, multiple updates)

**E. Implement Decay + Quarantine**
- Create `ui/lib/oracle/decay-quarantine.ts` (soft decay, quarantine violations)
- Implement `markStale(entry, days_inactive)` (30-day threshold)
- Implement `archiveFlag(entry, days_inactive)` (90-day threshold)
- Implement `detectQuarantine(entry): boolean` (Scope Gate check)
- Write unit tests (5 cases: mark stale, archive, quarantine flag, merge into anchor, 8D never decays)

**F. Integrate Retrieval Gate**
- Modify `ui/lib/oracle/rule-activation-monitor.ts` to export retrieval scope decision
- Create `ui/lib/oracle/memory-retrieval.ts` (load only requested shells based on gate result)
- Write integration test (3 cases: normal retrieval, gate trigger→defer 32D/64D, explicit request→load all)

**G. Run Evals**
- Execute eval matrix (8 evals across unit + integration tests)
- Validate session consistency, promotion correctness, decay, quarantine, Hebbian, bootstrap, boundaries, immutability
- Fix failures before proceeding

**H. Checkpoint current.md**
- Add Phase 2 implementation completion entry to current.md
- Include eval results, identified risks, next phase guidance

---

## 9. Commit Strategy

Suggested separate commits for code review clarity:

1. **docs(phase2): create Phase 2 consolidation plan**
   - Files: `docs/PHASE_2_FRACTAL_MEMORY_CONSOLIDATION_PLAN.md`

2. **feat(oracle): implement shell graduation contract**
   - Files: `ui/lib/oracle/shell-graduation.contract.ts`, `.test.ts`

3. **feat(oracle): implement anchor promotion**
   - Files: `ui/lib/oracle/anchor-promotion.ts`, `.test.ts`

4. **feat(oracle): implement Hebbian dynamics**
   - Files: `ui/lib/oracle/hebbian-dynamics.ts`, `.test.ts`

5. **feat(oracle): implement decay and quarantine**
   - Files: `ui/lib/oracle/decay-quarantine.ts`, `.test.ts`

6. **feat(oracle): integrate retrieval gate into memory**
   - Files: `ui/lib/oracle/memory-retrieval.ts`, `.test.ts`, update `rule-activation-monitor.ts`

7. **test(oracle): run Phase 2 eval matrix**
   - All tests passing, results logged

8. **docs(memory): checkpoint Phase 2 consolidation complete**
   - Update `~/.claude/projects/-Users-Malachi/memory/current.md` with Phase 2 completion entry

---

## Next Steps

1. Create this planning document ✓
2. Review plan with Nick (wait for feedback)
3. Begin implementation sequence A-H only after approval
4. No UI expansion, no database, no external integrations until Phase 2 evals pass

---

**Phase 2 is the governance engine. Phase 4 is the UI. Keep them separate.**
