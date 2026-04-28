# Phase 2 Stage G — Eval Matrix Execution Spec

## Purpose

Stage G verifies Phase 2 as a **complete integrated system**, not as isolated modules. It confirms:

1. All governance rules (rule activation, shell graduation, anchor promotion, decay, retrieval gates) work in composition
2. Cross-domain isolation is maintained
3. Provenance handling is correct end-to-end
4. No mutations occur
5. Full pipeline from memory entry → rule application → retrieval decision operates correctly

Stage G does NOT expand functionality — it validates what Stages A–F built.

---

## Modules Under Evaluation

All six modules from Phase 2, plus deferred shell-promoter status:

1. **rule-activation-monitor** — `ui/lib/oracle/rule-activation-monitor.ts` + tests
   - Applies `SURFACE` / `WARN` / `BLOCK` rules to memory entries
   - Preempts other governance rules when BLOCK activates
   - Status: Created Stage B, tested Stage B

2. **shell-graduation** — `ui/lib/oracle/shell-graduation.ts` + tests
   - Promotion law from 16D → 8D/32D/64D
   - Decision enum: promote | hold | quarantine | reject
   - Status: Created Stage B, tested Stage B

3. **anchor-promotion** — `ui/lib/oracle/anchor-promotion.ts` + tests
   - Marks memory as `local_anchor` when promotion succeeds
   - Status: Created Stage C, tested Stage C

4. **hebbian-dynamics** — `ui/lib/oracle/hebrian-dynamics.ts` + tests
   - Tracks co-occurrence weights between domain codes
   - Emits re-ring events when adjacency threshold crosses
   - Status: Created Stage D, tested Stage D

5. **decay-scheduler** — `ui/lib/oracle/decay-scheduler.ts` + tests
   - Schedules quarantine and archive transitions
   - Status: Created Stage E, tested Stage E (31/31 tests)

6. **retrieval-gate-integration** — `ui/lib/oracle/retrieval-gate-integration.ts` + tests
   - Enforces six hard rules in priority order
   - Computes confidence, applies boosts, caps at 1.0
   - Returns RetrievalScope with aggregated decisions
   - Status: Created Stage F, tested Stage F (20/20 tests)

7. **shell-promoter** (deferred)
   - Activates shell-graduation and anchor-promotion on schedule
   - Status: Deferred pending Stage G eval results
   - Will be created Stage G-adjacent if eval matrix passes

---

## Required Eval Categories

Each category verifies a specific aspect of system composition. Tests for each category may be new or may be subsets of existing module tests.

### Category 1: Rule Activation Preemption

**What it verifies:** BLOCK rule activation immediately blocks retrieval, overriding all other checks.

- Rule activation preempts shell graduation decisions
- Rule activation preempts anchor promotion
- Rule activation preempts decay/quarantine lifecycle
- Rule activation preempts retrieval gate confidence boosts
- Confidence drops to 0 when BLOCK activates

**Test location:** `ui/lib/oracle/__tests__/rule-activation-monitor.test.ts` + subset in `retrieval-gate-integration.test.ts`

**Required passing:** All rule-activation-monitor tests pass (existing count confirmed from prior session)

---

### Category 2: Shell Graduation Safety

**What it verifies:** Promotion decisions are made only when justified, and quarantine overrides all other conditions.

- Quarantine status blocks promotion (immediate return)
- Already-promoted entries reject promotion (anchor_status ≠ "raw")
- Missing provenance holds promotion
- Insufficient sessions holds promotion
- Cross-domain without reason holds promotion
- 8D promotion requires stronger evidence than 16D/32D
- Decision always includes decision, reason_codes, confidence, explanation

**Test location:** `ui/lib/oracle/__tests__/shell-graduation.test.ts`

**Required passing:** All 8 shell-graduation tests pass

---

### Category 3: Anchor Promotion Correctness

**What it verifies:** When shell graduation succeeds, anchor status is correctly set to `local_anchor`.

- Entry marked `local_anchor` after successful promotion
- `local_anchor` entries pass stale/archive decay checks without other justification
- `local_anchor` adds confidence boost (+0.1) in retrieval gate
- `local_anchor` boost is capped at 1.0 total confidence

**Test location:** `ui/lib/oracle/__tests__/anchor-promotion.test.ts`

**Required passing:** All anchor-promotion tests pass

---

### Category 4: Hebbian Stability

**What it verifies:** Co-occurrence weights accumulate correctly and don't cause oscillation.

- Domain code pairs increment weight on co-activation
- Weight increments are idempotent (same pair, same session = single increment)
- Re-ring events fire when adjacency threshold (θ=5) crosses
- Ring distance contracts smoothly without churn
- Weights decay over time (soft dampening, not deletion)

**Test location:** `ui/lib/oracle/__tests__/hebbian-dynamics.test.ts`

**Required passing:** All hebbian-dynamics tests pass

---

### Category 5: Decay and Quarantine Lifecycle

**What it verifies:** Decay state transitions and quarantine are scheduled and applied correctly.

- Fresh entries stay fresh with sufficient observations
- Stable entries transition to stale after inactivity threshold
- Stale entries transition to archive_candidate after extended inactivity
- Archive_candidate entries remain until explicit cleanup
- Quarantine status is set by rules and persists through retrieval
- Quarantine immediately blocks retrieval regardless of other state

**Test location:** `ui/lib/oracle/__tests__/decay-scheduler.test.ts`

**Required passing:** All 31 decay-scheduler tests pass

---

### Category 6: Retrieval Gate Policy Enforcement

**What it verifies:** The retrieval gate applies all six hard rules in correct priority order and computes confidence accurately.

- Rule 1: BLOCK rule activation blocks immediately (confidence=0)
- Rule 2: Quarantine status blocks (confidence=0)
- Rule 3: Missing provenance downgrades
- Rule 4: Cross-domain without reason downgrades
- Rule 5: Stale/archive without justification downgrades (unless anchor or high weight/sessions)
- Rule 6: Confidence = weight × min(sessions/5, 1.0) + boosts, capped at 1.0
- Boosts: domain alignment +0.1, role alignment +0.05, anchor status +0.1, role-pair +0.05×weight
- RetrievalScope aggregates decisions with reason_code_summary and confidence_distribution

**Test location:** `ui/lib/oracle/__tests__/retrieval-gate-integration.test.ts`

**Required passing:** All 20 retrieval-gate-integration tests pass

---

### Category 7: Cross-Domain Isolation

**What it verifies:** Requests in one domain don't unintentionally retrieve from another without explicit reason.

- Cross-domain candidates without explicit_cross_domain_reason are downgraded
- Cross-domain candidates WITH explicit_cross_domain_reason are allowed
- Domain alignment boost only applies when domains match
- Request active_domain is used for cross-domain checks, not inferred

**Test location:** Subset of `retrieval-gate-integration.test.ts` (Tests 5–6)

**Required passing:** Cross-domain tests pass

---

### Category 8: Provenance Handling

**What it verifies:** Missing or unverified provenance is caught and affects decisions consistently.

- Missing provenance immediately downgrades candidates
- Unverified provenance does not block but may affect confidence
- Stale/archive entries with missing provenance are held
- Valid provenance + other conditions can allow promotion

**Test location:** Subset of `shell-graduation.test.ts` + `retrieval-gate-integration.test.ts`

**Required passing:** Provenance-related tests pass

---

### Category 9: Immutability and No Mutation

**What it verifies:** Input objects are never modified in place; all operations return new objects.

- `evaluateRetrievalCandidate` does not mutate candidate or request
- `shouldPromote` does not mutate input entry
- All decision objects are newly constructed
- JSON.stringify before and after equals for input fixtures

**Test location:** `ui/lib/oracle/__tests__/retrieval-gate-integration.test.ts` (Test 17)

**Required passing:** Immutability test passes

---

### Category 10: Full Pipeline Composition

**What it verifies:** All six modules work together as a cohesive system.

- Rule activation decision flows into shell graduation decision
- Shell graduation decision flows into anchor promotion
- Anchor promotion state flows into retrieval gate confidence
- Decay scheduler state is respected in retrieval gate decisions
- Hebbian weights accumulate without breaking other modules
- No module assumes state it didn't compute itself

**Test location:** New composition tests or integration snapshots

**Required passing:** Composition tests pass (TBD based on available tests)

---

## Required Commands

Execute all module tests in strict order. Do not skip any.

### Individual Module Tests (executed in order)

```bash
# 1. Rule Activation Monitor
npm --prefix ui test -- rule-activation-monitor

# 2. Shell Graduation
npm --prefix ui test -- shell-graduation

# 3. Anchor Promotion
npm --prefix ui test -- anchor-promotion

# 4. Hebbian Dynamics
npm --prefix ui test -- hebbian-dynamics

# 5. Decay Scheduler
npm --prefix ui test -- decay-scheduler

# 6. Retrieval Gate Integration
npm --prefix ui test -- retrieval-gate-integration
```

### Full Suite

```bash
# All Phase 2 oracle tests
npm --prefix ui test -- oracle

# Or equivalently, all tests in ui/lib/oracle/__tests__/
npm --prefix ui test
```

### Build Verification

```bash
npm --prefix ui run build
```

### Git Status Verification (no dirty generated files)

```bash
git status --short
# Expected: only docs/PHASE_2_STAGE_G_EVAL_MATRIX_SPEC.md as untracked or staged
```

---

## Pass/Fail Criteria

### Must Pass: All Individual Module Tests

| Module | Required Count | Status |
|--------|---|---|
| rule-activation-monitor | All existing tests | TBD (run eval) |
| shell-graduation | 8 tests | TBD (run eval) |
| anchor-promotion | All existing tests | TBD (run eval) |
| hebbian-dynamics | All existing tests | TBD (run eval) |
| decay-scheduler | 31 tests | TBD (run eval) |
| retrieval-gate-integration | 20 tests | ✅ PASS (committed Stage F) |

**Failure criteria:** Any test fails → Stage G eval fails. Do not continue to build until all tests pass.

### Must Pass: Build

```bash
npm --prefix ui run build
```

**Failure criteria:** Build fails → Stage G eval fails. Do not continue until build passes.

### Must Remain Unchanged (no regression)

- retrieval-gate-integration: 20/20 tests remain passing
- decay-scheduler: 31/31 tests remain passing

**Failure criteria:** Regression in any committed module → Stage G eval fails.

### Must Not Commit Dirty Generated Files

- `ui/next-env.d.ts` must not be staged (if it changes, run `git restore ui/next-env.d.ts`)
- No `.next/` cache
- No `node_modules/`
- No build artifacts outside of expected output directories

**Failure criteria:** Dirty generated files in staging area → Stage G eval fails. Restore and re-run.

### Must Not Mutate Sources

- `~/.claude/oracle-memory/sources/` — read-only, not touched
- No entries added, modified, or deleted

**Failure criteria:** Any source mutation detected → Stage G eval fails.

### Shell-Promoter Must Not Activate

- `ui/lib/oracle/shell-promoter.ts` does not exist yet (deferred)
- If created prematurely → Stage G eval fails

**Failure criteria:** Premature shell-promoter activation → Stage G eval fails. Delete file and rerun.

---

## Stage G Non-Goals

**Do not:**

- Expand UI routes or components
- Add or modify database schema
- Integrate Postgres or vector DB
- Call external APIs
- Update `current.md` (reserve for Stage H)
- Begin Stage H completion claim
- Create shell-promoter (reserve for Stage G-adjacent pending results)
- Implement production logging or observability beyond existing test output
- Refactor code orthogonal to eval categories

**These are explicitly out of scope.** Stage G is validation only.

---

## Recommended Output Report

After running all evals and confirming all tests pass, generate:

**File:** `docs/PHASE_2_STAGE_G_EVAL_REPORT.md`

**Format (7 sections):**

```markdown
# Phase 2 Stage G — Eval Matrix Report

## Date & Commit Hash
[Date executed] | Commit: [hash from Stage F, 792c527]

## Pass/Fail Summary
- Rule Activation Preemption: ✅ PASS (N/N tests)
- Shell Graduation Safety: ✅ PASS (8/8 tests)
- Anchor Promotion Correctness: ✅ PASS (N/N tests)
- Hebbian Stability: ✅ PASS (N/N tests)
- Decay/Quarantine Lifecycle: ✅ PASS (31/31 tests)
- Retrieval Gate Policy: ✅ PASS (20/20 tests)
- Cross-Domain Isolation: ✅ PASS (2/2 tests)
- Provenance Handling: ✅ PASS (N/N tests)
- Immutability: ✅ PASS (1/1 test)
- Full Pipeline Composition: ✅ PASS (N/N tests)

**Overall:** ✅ PASS — All categories pass, all tests pass, build passes, no regressions.

## Test Counts by Module
- rule-activation-monitor: N tests
- shell-graduation: 8/8 ✅
- anchor-promotion: N tests
- hebbian-dynamics: N tests
- decay-scheduler: 31/31 ✅
- retrieval-gate-integration: 20/20 ✅

## Build Output
npm --prefix ui run build → [status]

## Git Status
[Confirm clean working tree or only expected files staged]

## Commit Hash
[New commit hash for spec doc, if committed]

## Blockers & Notes
[Any issues, workarounds, deferred items]

## Recommended Next Step
- If all pass: Proceed to Stage H final checkpoint
- If any fail: Return to failing module, fix, rerun Stage G
```

---

## Execution Protocol

1. **This document is the spec only — do not execute yet.**
2. **After spec is reviewed and approved:**
   - Commit the spec: `git add docs/PHASE_2_STAGE_G_EVAL_MATRIX_SPEC.md && git commit -m "docs(phase2): add stage g eval matrix spec"`
3. **Then run evals in order:**
   - Run individual module tests (1–6 above)
   - Confirm all pass
   - Run build
   - Confirm build passes
   - Generate Stage G eval report
4. **If any eval fails:**
   - Diagnose the failure
   - Modify only the failing module (do not touch spec)
   - Re-run that module test
   - Re-run full build
   - Update eval report
5. **If all pass:**
   - Proceed to Stage H (final checkpoint)

---

## Appendix: Eval Matrix at a Glance

| Category | Focus | Required Tests | Expected Count | Status |
|----------|-------|---|---|---|
| 1. Rule Activation Preemption | BLOCK overrides everything | rule-activation-monitor | TBD | TBD |
| 2. Shell Graduation Safety | Promotion justified | shell-graduation | 8 | TBD |
| 3. Anchor Promotion | Marking local_anchor | anchor-promotion | TBD | TBD |
| 4. Hebbian Stability | Co-occurrence weights | hebbian-dynamics | TBD | TBD |
| 5. Decay/Quarantine | Lifecycle transitions | decay-scheduler | 31 | TBD |
| 6. Retrieval Gate | Policy enforcement | retrieval-gate-integration | 20 | ✅ PASS |
| 7. Cross-Domain | Domain isolation | retrieval-gate (subset) | 2 | TBD |
| 8. Provenance | Missing/valid handling | retrieval-gate + graduation | TBD | TBD |
| 9. Immutability | No mutations | retrieval-gate-integration | 1 | TBD |
| 10. Composition | Full pipeline | (integration snapshots) | TBD | TBD |

---

## References

- Stage F commitment: `792c527` (retrieval-gate-integration complete)
- Phase 2 spec: `docs/SPEC_PHASE1_BATMAN_MVP.md` (sections F–H)
- Build plan: `MASTER-BUILD-PLAN.md` (Phase 2 progress tracking)
