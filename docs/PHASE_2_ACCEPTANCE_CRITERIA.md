# Phase 2 Acceptance Criteria

**Status:** Planning mode (do not implement yet)  
**Created:** 2026-04-28  
**Relates to:** `docs/PHASE_2_FRACTAL_MEMORY_CONSOLIDATION_PLAN.md`

---

## 1. Phase 2 Success Definition

Phase 2 is complete when:

- ✓ Shell graduation contract is defined with Scope Gate validation
- ✓ Local anchor promotion detects and promotes recurring motifs (3+ occurrences)
- ✓ Hebbian dynamics track co-occurrence weights and ring tightening
- ✓ Soft decay marks stale entries without deletion; 8D never decays
- ✓ Quarantine rules flag scope violations without promoting them
- ✓ Retrieval gate integrates into memory recall (defer 32D/64D on trigger)
- ✓ Bootstrap context reflects learned structure (anchors, ring distances)
- ✓ All 8 required evals pass with no contamination, no fake capabilities, no immutable mutations
- ✓ Implementation follows strict staged order (A→H) with test validation at each stage
- ✓ current.md checkpoint entry logs completion with eval results

---

## 2. Acceptance Criteria by Implementation Stage

### Stage A: Inspect Existing Memory Tools

**Objective:** Establish baseline understanding of existing memory infrastructure before building consolidation rules.

**Required Files:**
- `ui/lib/oracle/rule-activation-monitor.ts` (read-only reference)
- `~/.claude/projects/-Users-Malachi/memory/fractal-memory.md` (Phase 1 spec)
- `~/.claude/projects/-Users-Malachi/memory/snapshot_session_01.md` (frozen baseline)

**Input Contract:**
- rule-activation-monitor.ts must export ActivatedRule, RuleActivationResult, RuleMonitorConfig
- fractal-memory.md must describe sub-shell kernel (ring distance, Hebbian, local consolidation, soft decay)
- snapshot_session_01.md must contain frozen 16D state from session 1 close (task, context, blockers, decisions, signals)

**Output Contract:**
- Documented understanding of rule-activation-monitor behavior (6 trigger patterns, confidence scoring, action routing)
- Documented Phase 1 sub-shell kernel rules (what repeats, what is weaker than top-level)
- Identified baseline for diff-based eval (snapshot_session_01.md timestamp, entry count, weight distribution)

**Safety Constraints:**
- No modifications to rule-activation-monitor.ts
- No modifications to fractal-memory.md or snapshot_session_01.md (read-only reference)
- No writing to immutable oracle-memory/sources

**Required Tests:**
- None (inspection only)

**Pass/Fail Criteria:**
- **PASS:** All three files readable, content understood, documented in notes
- **FAIL:** Any file missing, unreadable, or content contradicts Phase 1 spec

**Rollback Condition:**
- N/A (read-only, no code changes)

---

### Stage B: Define Shell Graduation Contract

**Objective:** Define the rules and validation logic for promoting entries from 16D to 32D or 8D.

**Required Files:**
- NEW: `ui/lib/oracle/shell-graduation.contract.ts`
- NEW: `ui/lib/oracle/__tests__/shell-graduation.contract.test.ts`

**Input Contract:**
- Entry object with: timestamp, weight, linked_roles, anchor_status, decay_state, observed_sessions
- Scope Gate validation function (check if entry is "true regardless of project?")
- Target shell enum: 8D (identity), 32D (durable facts)

**Output Contract:**
- `shouldPromote(entry): { decision: boolean, reason: string, target_shell?: 'identity' | 'durable' }`
- Validates: weight ≥ 0.7, anchor_status === 'raw', observed_sessions ≥ 3 (consecutive)
- Applies Scope Gate before promoting to 8D (must pass "true regardless of project" test)
- Rejects if entry already promoted (anchor_status !== 'raw')

**Safety Constraints:**
- Scope Gate is mandatory; no 8D promotion without Scope Gate pass
- 32D promotion allowed without Scope Gate (project-specific facts OK at 32D)
- Decision and reason must be documented (no silent rejections)
- Do not modify current.md or snapshot_session_01.md

**Required Tests:**
1. Valid 8D candidate: entry with weight=0.9, observed_sessions=3, passes Scope Gate → decision=true, target='identity'
2. Valid 32D candidate: entry with weight=0.8, observed_sessions=3, fails Scope Gate → decision=true, target='durable'
3. Scope Gate fail (8D): entry fails "true regardless of project" → decision=false, reason includes "Scope Gate"
4. Weight too low: entry with weight=0.6, observed_sessions=3 → decision=false, reason includes "weight"
5. Already promoted: entry with anchor_status='local_anchor' → decision=false, reason includes "already promoted"

**Pass/Fail Criteria:**
- **PASS:** All 5 unit tests passing, logic aligns with Phase 1 spec (shell graduation section)
- **FAIL:** Any test failing, Scope Gate not enforced, decision reason incomplete

**Rollback Condition:**
- If Scope Gate validation logic is incomplete or incorrect, delete shell-graduation.contract.ts and .test.ts, proceed to next stage only after requirements clarified

---

### Stage C: Implement Local Anchor Promotion

**Objective:** Detect recurring motifs within a role and promote them to local_anchor consolidation points.

**Required Files:**
- NEW: `ui/lib/oracle/anchor-promotion.ts`
- NEW: `ui/lib/oracle/__tests__/anchor-promotion.test.ts`

**Input Contract:**
- Array of entries within a role sub-section (e.g., task or decisions)
- Each entry has: content, timestamp, weight, observed_sessions, anchor_status
- Motif = recurring pattern (same concept/phrase) in 3+ entries

**Output Contract:**
- `detectMotif(role_entries): Motif[]` returns motifs with observed_count ≥ 3
- `promoteToAnchor(motif): local_anchor_entry` creates entry with anchor_status='local_anchor', timestamp=first_occurrence, observed_count=3
- Leaf entries linked to anchor via anchor_id reference
- Archive flag not set on newly promoted anchors (only on stale leaf entries merged into anchor)

**Safety Constraints:**
- Motif detection is case-insensitive pattern matching (no regex complexity required for MVP)
- Local anchors stay within their role (not promoted to 32D or 8D by this stage)
- Do not delete leaf entries; merge them into anchor_id reference
- No modification of immutable sources

**Required Tests:**
1. 3-occurrence motif: 3 entries with same pattern → detectMotif returns 1 motif with observed_count=3
2. 2-occurrence no-promote: 2 entries with pattern → detectMotif returns empty (threshold not met)
3. Merge existing anchors: 2 anchors with related patterns → merge into single anchor with observed_count=6

**Pass/Fail Criteria:**
- **PASS:** All 3 unit tests passing, motifs detected correctly, anchor entries created with correct metadata
- **FAIL:** Any test failing, motif threshold wrong (< 3), leaf entries deleted instead of merged

**Rollback Condition:**
- If motif detection logic is too aggressive (false positives) or too conservative (false negatives), revise detectMotif algorithm and re-run tests before proceeding

---

### Stage D: Implement Hebbian Update Rules

**Objective:** Track co-occurrence weights between roles; decay inactive weights; tighten ring distance when threshold crossed.

**Required Files:**
- NEW: `ui/lib/oracle/hebbian-dynamics.ts`
- NEW: `ui/lib/oracle/__tests__/hebbian-dynamics.test.ts`

**Input Contract:**
- Hebbian graph structure: role_pairs with co_occurrence_weight (float, 0–10)
- Ring distance map: role → adjacent roles (circular: task → context → blockers → decisions → signals → task)
- Inactive session threshold: float representing session count since last co-occurrence
- Threshold θ=5 for ring tightening

**Output Contract:**
- `updateCoOccurrence(role1, role2, session_id): void` increments weight by 1.0, caps at 10
- `decayInactiveWeights(inactive_since: number): void` applies weight *= 0.95 per inactive session
- `evaluateRingTightening(pair): boolean` returns true if co_occurrence_weight >= 5, triggers ring distance reduction by 1
- Hebbian updates do not modify current.md directly (applied on session close)

**Safety Constraints:**
- Decay never goes below 0; stale pairs stay in graph with weight ≈ 0
- Ring tightening is one-way (distance can shrink, not grow)
- Threshold θ=5 is enforced; no ad-hoc threshold changes
- Hebbian updates are read-only on current.md (no mutations until consolidation scan)

**Required Tests:**
1. Weight increment: pair (task, context) co-occurs in session 1 → weight=1.0; co-occurs again in session 2 → weight=2.0
2. Decay: pair with weight=3.0, inactive 10 sessions → weight ≈ 2.32 (3.0 * 0.95^3 ≈ 2.59)
3. Ring tightening: pair with weight=5.0 → evaluateRingTightening returns true, ring distance reduced by 1
4. Multiple updates: 3 pairs co-occur, weights update correctly, no cross-talk

**Pass/Fail Criteria:**
- **PASS:** All 4 unit tests passing, weight math correct, ring tightening triggered at θ=5, no mutations to immutable sources
- **FAIL:** Any test failing, threshold logic wrong, decay formula incorrect, ring distance modified unexpectedly

**Rollback Condition:**
- If Hebbian dynamics cause oscillation (weights fluctuate erratically) or cross-domain leakage (unrelated roles linked), pause, review graph structure, and re-run tests

---

### Stage E: Implement Decay + Quarantine

**Objective:** Mark stale entries (30+ days inactive) without deletion; flag scope violations (quarantine); enforce 8D immutability.

**Required Files:**
- NEW: `ui/lib/oracle/decay-quarantine.ts`
- NEW: `ui/lib/oracle/__tests__/decay-quarantine.test.ts`

**Input Contract:**
- Entry with timestamp, observed_sessions, anchor_status, decay_state
- Days inactive (computed from timestamp vs. current date)
- Scope Gate validation function (to detect quarantine violations)
- Shell level indicator (8D, 16D, 32D, 64D)

**Output Contract:**
- `markStale(entry, days_inactive): Entry` sets decay_state='stale' if days_inactive >= 30; returns updated entry
- `archiveFlag(entry, days_inactive): Entry` sets decay_state='archived' if days_inactive >= 90; returns updated entry
- `detectQuarantine(entry): boolean` runs Scope Gate check; returns true if entry fails "true regardless of project?"
- 8D entries never set decay_state (immutable, always fresh)

**Safety Constraints:**
- Stale entries are not deleted; merge into local_anchors or flag for manual review
- Archived entries remain in graph; retrieval deprioritizes them
- Quarantine violations are logged for audit, not auto-deleted
- 8D entries cannot be marked stale, archived, or quarantined

**Required Tests:**
1. Mark stale: entry with observed_sessions=1, last_seen=35 days ago → decay_state='stale'
2. Archive: entry with observed_sessions=1, last_seen=91 days ago → decay_state='archived'
3. Quarantine flag: entry fails Scope Gate → flagged quarantine_violation, not promoted
4. Merge into anchor: stale entry merged into related local_anchor, old entry archived
5. 8D never decays: 8D entry with observed_sessions=1, last_seen=100 days ago → decay_state unchanged (remains fresh)

**Pass/Fail Criteria:**
- **PASS:** All 5 unit tests passing, stale/archived entries not deleted, quarantine violations logged, 8D immutable
- **FAIL:** Any test failing, entries deleted instead of archived, 8D decay_state modified, quarantine violations auto-promoted

**Rollback Condition:**
- If decay thresholds (30/90 days) prove incorrect or retrieval ranking penalizes archived entries too aggressively, adjust thresholds and re-run evals before proceeding

---

### Stage F: Integrate Retrieval Gate

**Objective:** Connect rule activation monitor output to memory retrieval; defer 32D/64D when gate trigger detected.

**Required Files:**
- MODIFY: `ui/lib/oracle/rule-activation-monitor.ts` (add export for retrieval scope decision)
- NEW: `ui/lib/oracle/memory-retrieval.ts`
- NEW: `ui/lib/oracle/__tests__/memory-retrieval.integration.test.ts`

**Input Contract:**
- RuleActivationResult from rule-activation-monitor.ts with triggered rules
- Current memory shell state (16D, 32D, 64D loaded?)
- User request context (explicit request for all shells vs. default behavior)

**Output Contract:**
- `retrievalScope(rule_result): { shells_to_load: string[], defer_shells: string[] }` 
- Normal (no trigger): load 8D + 16D; pull 32D/64D freely
- Gate 3 trigger detected: load 8D + 16D only; defer 32D/64D until explicit request
- Explicit request: load all (8D + 16D + 32D + 64D)

**Safety Constraints:**
- Gate 3 timeout or false-positive must not leak 32D/64D into wrong context
- Retrieval order: 8D always first (identity), 16D always second (session state), 32D/64D only if scope allows
- Do not modify rule-activation-monitor logic; only export retrieval scope decision
- Immutable sources untouched

**Required Tests:**
1. Normal retrieval (no trigger): rule_result.triggered=[], shells_to_load=['8D', '16D'], defer_shells=['32D', '64D']
2. Gate 3 trigger: rule_result.triggered includes Gate 3, shells_to_load=['8D', '16D'], defer_shells=['32D', '64D']
3. Explicit request: user passes explicit_request=true, shells_to_load=['8D', '16D', '32D', '64D']

**Pass/Fail Criteria:**
- **PASS:** All 3 integration tests passing, retrieval scope logic correct, no shell contamination, Gate 3 enforced
- **FAIL:** Any test failing, scope decision not enforced, 32D/64D loaded when deferred, Gate 3 not detected

**Rollback Condition:**
- If retrieval gate causes over-deferral (legitimate requests blocked) or under-deferral (32D leaks into wrong context), adjust gate trigger sensitivity and re-run integration test

---

### Stage G: Run Evals

**Objective:** Execute the 8 required evals from the Phase 2 plan; validate no contamination, no mock confusion, no mutations.

**Required Files:**
- Reference: `docs/PHASE_2_FRACTAL_MEMORY_CONSOLIDATION_PLAN.md` (Section 7 eval matrix)
- Test infrastructure: all unit + integration tests from stages A–F
- Baseline: `~/.claude/projects/-Users-Malachi/memory/snapshot_session_01.md` (frozen session 1 state)

**Required Evals:**

1. **Session consistency eval**
   - Input: Same prompt in sessions N and N+1
   - Expected: Retrieved 16D entries + weights unchanged
   - Test type: Integration
   - Pass: Weights differ < 0.05 (rounding tolerance)
   - Fail: Weights diverge, entries removed unexpectedly

2. **Promotion correctness eval**
   - Input: Entry with observed_sessions=3, weight=0.9, passes Scope Gate
   - Expected: Promoted to 32D or flagged as candidate
   - Test type: Unit
   - Pass: Promotion executed, metadata updated
   - Fail: Entry not promoted, reason not documented

3. **Decay visibility eval**
   - Input: Entry with observed_sessions=1, last_seen=40 days ago
   - Expected: decay_state='stale', deprioritized in ranking
   - Test type: Unit
   - Pass: decay_state set, retrieval ranking reflects deprioritization
   - Fail: Entry still prioritized, decay_state not set

4. **Quarantine detection eval**
   - Input: Entry fails Scope Gate (project-specific detail)
   - Expected: Flagged quarantine_violation, not promoted
   - Test type: Unit
   - Pass: Entry flagged, audit log created
   - Fail: Entry silently promoted, quarantine not detected

5. **Hebbian ring accuracy eval**
   - Input: Two roles co-occur 5+ times
   - Expected: Ring distance tightens, retrieval callback count ↓
   - Test type: Integration
   - Pass: Ring distance reduced, retrieval latency improves
   - Fail: Ring distance unchanged, co-occurrences not counted

6. **Bootstrap reflects state eval**
   - Input: bootstrap_context() called after consolidation run
   - Expected: Includes local_anchor promotions, shell graduation candidates, Hebbian ring distances
   - Test type: Integration
   - Pass: bootstrap output contains all three elements, token count ~1000–2000
   - Fail: bootstrap output same as pre-consolidation, changes not reflected

7. **Shell boundary enforcement eval**
   - Input: Phase 4 component data in 16D entry
   - Expected: Scope Gate blocks promotion to 8D
   - Test type: Unit
   - Pass: Entry stays at 16D, quarantine flag set
   - Fail: Entry promoted to 8D, boundary violated

8. **Immutability hold eval**
   - Input: Consolidation runs 1000 times
   - Expected: oracle-memory/sources unchanged
   - Test type: Integration
   - Pass: No mutations to immutable sources after 1000 runs
   - Fail: Any immutable source modified

**Safety Constraints:**
- All evals must pass before proceeding to Stage H
- Any eval failure requires root cause analysis and code fix before re-running
- No hand-waving or "close enough" passes
- If an eval reveals contamination, stop and audit all consolidation logic

**Pass/Fail Criteria:**
- **PASS:** All 8 evals passing, no contamination, no fake capabilities, immutable sources untouched
- **FAIL:** Any eval failing; fix code and re-run eval before proceeding

**Rollback Condition:**
- If eval reveals fundamental logic error (e.g., shell graduation promoting wrong entries consistently), pause implementation, revise relevant stage (B–E), and re-run eval

---

### Stage H: Checkpoint current.md

**Objective:** Log Phase 2 implementation completion in the Fractal Memory system with eval results and next phase guidance.

**Required Files:**
- MODIFY: `~/.claude/projects/-Users-Malachi/memory/current.md` (append Phase 2 completion entry)

**Input Contract:**
- All 8 evals passing
- No immutable source mutations
- Working tree clean (all code committed)
- Commit hash of final Phase 2 implementation commit

**Output Contract:**
- New entry in current.md (task section) documenting Phase 2 completion:
  - timestamp: 2026-04-28 (or actual completion date)
  - weight: 1.0 (consolidated fact)
  - linked_roles: [context, decisions, signals]
  - anchor_status: raw (candidate for future promotion)
  - decay_state: fresh
  - observed_sessions: 1
  - content: "Phase 2 Fractal Memory consolidation complete. Shell graduation, anchor promotion, Hebbian dynamics, soft decay, quarantine, retrieval gate all implemented. 8/8 evals passing. No contamination, no fake capabilities, immutable sources intact."
  - phase_2_summary: { shell_graduation: PASS, anchor_promotion: PASS, hebbian_dynamics: PASS, decay_quarantine: PASS, retrieval_gate: PASS, evals: 8/8 PASS }
  - next_phase: "Phase 3 (shell graduation of this entry to north-star.md if recurs 3+ sessions) → Phase 4 UI expansion (vector DB, panels, external integrations)"

**Safety Constraints:**
- Do not modify any other memory sections (CLAUDE.md, fractal-memory.md, snapshot_session_01.md)
- Do not commit to git (current.md is outside repo)
- Do not create new memory files beyond current.md update

**Required Tests:**
- None (documentation only)

**Pass/Fail Criteria:**
- **PASS:** Entry added to current.md, content coherent, next phase guidance clear
- **FAIL:** Entry missing metadata, content incomplete, next phase unclear

**Rollback Condition:**
- If Phase 2 evals revealed issues not caught earlier, do not checkpoint until evals re-pass

---

## 3. Global Invariants

These invariants apply across all stages:

| Invariant | Rule | Enforcement |
|-----------|------|-------------|
| No immutable source mutation | oracle-memory/sources is read-only | Every commit verified with `git diff` check |
| Claims require provenance | Every promotion decision must have reason + threshold evidence | `shouldPromote()` returns { decision, reason } |
| Promotion requires threshold evidence | 3+ consecutive sessions, weight ≥ 0.7, for 8D also Scope Gate pass | Unit tests verify thresholds |
| Quarantine beats promotion | If entry fails Scope Gate, quarantine flag prevents 8D promotion | detectQuarantine() checked before promotion |
| Domain isolation by default | Entries stay in their shell unless explicit promotion rules apply | Scope Gate enforced, no cross-contamination tests |
| Cross-domain links require explicit reason | Hebbian pairs only created for documented co-occurrences | Trace linked_roles back to session activity |
| Retrieval gate must run before context injection | Rule activation monitor output drives shell scope decision | retrievalScope() called before bootstrap_context() |
| Mock/stub state must be labeled | Any test using fake/stub memory marked with anchor_status='mock' | Test cleanup removes mock entries before measuring state |

---

## 4. Required Evals (Summary)

| Eval | Input | Expected | Pass Criteria |
|------|-------|----------|---------------|
| Session consistency | Same prompt, sessions N+1 | 16D entries + weights unchanged | Weights differ < 0.05 |
| Promotion correctness | Entry: 3 sessions, 0.9 weight, Scope Gate pass | Promoted to 32D or flagged | Metadata updated correctly |
| Decay visibility | Entry: 1 session, 40 days inactive | decay_state='stale', deprioritized | Ranking reflects decay |
| Quarantine detection | Entry: fails Scope Gate | Flagged, not promoted | Audit log created |
| Hebbian ring accuracy | 2 roles co-occur 5+ times | Ring distance tightens | Retrieval latency ↓ |
| Bootstrap reflects state | bootstrap_context() post-consolidation | Includes anchors, candidates, ring distances | Token count ~1000–2000, all 3 elements present |
| Shell boundary enforcement | Phase 4 data in 16D | Scope Gate blocks 8D promotion | Entry stays 16D, flagged |
| Immutability hold | Consolidation runs 1000x | oracle-memory/sources unchanged | No mutations detected |

---

## 5. Implementation Stop Conditions

Claude must **STOP and ask** before proceeding in these cases:

1. **Scope Gate contradiction:** If an entry appears to satisfy promotion criteria but fails Scope Gate, stop and ask: "This entry meets weight + sessions thresholds but fails Scope Gate. Keep it at 16D or promote to 32D?"

2. **Quarantine judgment call:** If quarantine flags multiple related entries (e.g., 5+ Phase 4 references), stop and ask: "Should these entries be merged into a single 'Phase 4 components' local anchor, or quarantined separately?"

3. **Hebbian ring tightening at scale:** If ring tightening would reduce a domain's ring distance to < 1 (minimum), stop and ask: "This domain is tightly coupled. Proceed with ring tightening or cap at distance=1?"

4. **Eval failure with ambiguous root cause:** If an eval fails and the root cause is unclear (e.g., "weight decay formula off by 2%" or "Hebbian update timing unclear"), stop and ask: "Which threshold/formula is correct?" before proceeding.

5. **Immutable source access:** If any consolidation logic attempts to read from oracle-memory/sources (even read-only inspection), stop and ask: "Why do we need to inspect immutable sources? Can this be done without touching them?"

---

## 6. Commit Sequence

Suggested separate commits for code review clarity (from Section 9 of plan):

1. `git commit -m "docs(phase2): create Phase 2 consolidation plan"` ✓ (already done, 3ea3298)

2. `git commit -m "docs(phase2): add Phase 2 acceptance criteria"` — (this doc)

3. `git commit -m "feat(oracle): implement shell graduation contract"` — stages B unit tests

4. `git commit -m "feat(oracle): implement anchor promotion"` — stages C unit tests

5. `git commit -m "feat(oracle): implement Hebbian dynamics"` — stages D unit tests

6. `git commit -m "feat(oracle): implement decay and quarantine"` — stages E unit tests

7. `git commit -m "feat(oracle): integrate retrieval gate into memory"` — stages F integration tests, update rule-activation-monitor.ts export

8. `git commit -m "test(oracle): run Phase 2 eval matrix"` — all 8 evals passing

9. `git commit -m "docs(memory): checkpoint Phase 2 consolidation complete"` — update current.md (outside repo, no git commit needed)

---

## Next Action

Once this acceptance criteria doc is committed, the next checkpoint is:

```
docs(phase2): add Phase 2 acceptance criteria
```

After that, implementation begins with **Stage A** (inspect existing memory tools) followed by **Stage B** (define shell graduation contract).

Do not implement any stages until this acceptance criteria doc is reviewed and approved.
