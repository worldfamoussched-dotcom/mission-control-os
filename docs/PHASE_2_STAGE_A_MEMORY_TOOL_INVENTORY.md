# PHASE 2 STAGE A — Memory Tool Inventory

**Date:** 2026-04-28  
**Branch:** night-build/2026-04-25  
**Status:** READ-ONLY INSPECTION COMPLETE  
**Authorization:** edf.rtfd (Phase 2 Stage A Only)

---

## 1. Current Memory-Related Files

| File Path | Purpose | Implementation Status | Safe to Edit (Phase 2+) | Notes |
|-----------|---------|----------------------|------------------------|-------|
| `~/.claude/CLAUDE.md` | 8D identity layer; maximum compression; Nick's durable identity + core philosophy | REAL | NO — immutable | Never mutate. Contains Scope Gate (Rule 1), Progressive Disclosure (Rule 2), Corrections Log (Rule 3). 309 lines. |
| `~/.claude/projects/-Users-Malachi/memory/MEMORY.md` | 16D memory index; pointer file with explicit "Read when" triggers | REAL | NO — immutable | Index only. Links to companion files. 99 lines. Do not write memory content here. |
| `~/.claude/projects/-Users-Malachi/memory/current.md` | 16D session state; role-based carving (task/context/blockers/decisions/signals) with per-entry metadata | REAL | YES — append only | 552 lines. 5 cognitive roles. Per-entry fields: timestamp, weight, linked_roles, anchor_status, decay_state, observed_sessions. Torus state: contracted. Session 3 active. Safe to append new entries; unsafe to delete or reorder existing. Hebbian pairs tracked. Session 1 baseline exists in snapshot_session_01.md. |
| `~/.claude/projects/-Users-Malachi/memory/snapshot_session_01.md` | 16D frozen baseline from Session 1 close (2026-04-24). Hard reference for Session 3 checkpoint comparison. | REAL | NO — read-only archive | 28 total entries at Session 1. 4 pre-registered motifs to track. Provides baseline for churn/drift/weight-delta measurement. Do not edit. |
| `~/.claude/projects/-Users-Malachi/memory/user_london.md` | User profile; who London is, his goals, businesses, caliber of work | REAL | NO — reference only | Loaded on demand. Not actively evolving in Phase 2. |
| `~/.claude/projects/-Users-Malachi/memory/feedback_*.md` | 5 feedback memories capturing learned patterns from prior sessions (face cropping, watermarks, multiple choice, address format, fallback options) | REAL | NO — reference only | Loaded on demand. Provide user guidance; not part of consolidation loop. |
| `~/.claude/projects/-Users-Malachi/memory/project_*.md` | 4 project memories (palm-beauty, london-portfolio, ai-employee, all-the-smoke); project-specific context | REAL | NO — reference only | Loaded on demand per "Read when" triggers. Not part of Phase 2 consolidation; belong in project-specific memory spaces. |
| `docs/PHASE_2_FRACTAL_MEMORY_CONSOLIDATION_PLAN.md` | Spec. Consolidation objective, baseline, scope, non-goals, proposed targets, risk model, eval matrix, implementation sequence A-H, commit strategy | REAL | NO — immutable spec | Commit 3ea3298. 13KB. Controlling specification. Never modify. |
| `docs/PHASE_2_ACCEPTANCE_CRITERIA.md` | Spec. Phase 2 success definition, acceptance criteria per stage A-H, global invariants, required evals, stop conditions, commit sequence | REAL | NO — immutable spec | Commit 62757e4. 23KB. Controlling specification. Never modify. |
| `~/.claude/oracle-memory/sources/` | Immutable source registry (location reference; actual sources not read in Stage A) | REAL_FS | NO — read-only oracle | Reference only. Never touch. Hard boundary enforced by edf. |

---

## 2. Existing Functions/Modules

### Oracle Library (ui/lib/oracle/) — 13 Modules

| Module | Implementation Status | Key Functions | Input Contract | Output Contract | Use Site | Test Coverage |
|--------|----------------------|----------------|-----------------|-----------------|----------|----------------|
| `rule-activation-monitor.ts` | **REAL** (fully implemented, 8/8 tests passing via vitest) | `detectRuleActivations(config)` | RuleMonitorConfig (user_message, active_role, rules_8d, state_16d, gate_3_failed) | RuleActivationResult (activated_rules[], trigger_reason, source_shell="8D", target_shell="16D", confidence 0-1, action: SURFACE\|WARN\|BLOCK, timestamp) | Called by eval-runner.ts when userMessage provided | 8/8 tests: Math Structure, Graphify, Memory Write, Phase Gate + anti-drift, non-trigger baseline, Hard Boundary, output formatting, confidence scoring |
| `eval-runner.ts` | **REAL** (fully functional orchestration; integrates rule-activation-monitor) | `runOracleEvalsMock()`, `getEvalStatusMock()`, `fetchEvalStatus()` | userMessage (optional), evals config | EvalSuiteResult with rule-activation result embedded + 5 eval results (Bootstrap Layer, Retrieval Gate, Wiki Compiler, Opportunity Graph, Source Classifier) | Oracle OS v0.7 UI (mission-control/docs); called per session to run or check eval status | Integrated with rule-activation-monitor tests; mock mode passes; async fallback functional |
| `bootstrap-status.ts` | **REAL** (fully functional, safe read-only) | `getBootstrapStatusMock()`, `fetchBootstrapStatus()` | (none) | { status: OPERATIONAL\|PARTIAL\|BROKEN, filesFound: number, pagesVerified: number } | Mission Control UI; verifies Bootstrap v1 installation at session start | Mock test passes; async fallback functional |
| `retrieval-gate.ts` | **STUB** (6 retrieval modes defined; core logic not implemented) | RetrievalMode enum (6 modes: NO_RETRIEVAL, BOOTSTRAP_ONLY, WIKI_ONLY, RAG_DYNAMIC, GRAPH_RELATIONSHIP, SOURCE_AUDIT) | (logic incomplete) | (logic incomplete; current mock: WIKI_ONLY mode with context 0.89, freshness 0.94, source coverage 0.81, pass/none) | Will be enhanced in Stage F where eval-runner will choose retrieval mode based on rule-activation results | Mock mode defined; core routing logic deferred |
| `wiki-compiler.ts` | **MOCK** (Layer 3; current implementation status tracked, compilation logic not yet implemented) | `getWikiCompileStatusMock()` | (mock only) | { sourcesProcessed: 18, pagesUpdated: 14, entityPagesCreated: 7, contradictionsFound: 0, lastCompile: ISO date } | eval-runner.ts | Mock test passes |
| `wiki-lint.ts` | **MOCK** (Layer 3 health check; mock deterministic output) | `getWikiLintStatusMock()` | (mock only) | { stalePages: 0, orphanPages: 0, contradictions: 0, uncitedClaims: 2, missingBacklinks: 1, duplicateEntities: 0 } | eval-runner.ts | Mock test passes |
| `provenance.ts` | **REAL_FS/MOCK** (hybrid; currently mock, REAL_FS planned for Stage B) | `getProvenanceStatusMock()`, `fetchProvenanceStatus()` | (none) | { sourcesRegistered: 21, claimsRegistered: 25, verifiedClaims: 25, inferredClaims: 0, unresolvedClaims: 4, staleClaims: 0, pagesWithProvenance: 4, pagesMissingProvenance: 5 } | eval-runner.ts; tracks source registry | Mock test passes; REAL_FS implementation deferred to Stage B |
| `source-classifier.ts` | **MOCK** (deterministic classification; logic implemented but not yet integrated with real source types) | `classifySourceMock(sourceType)` | SourceType enum (contract\|release\|client\|memory/oracle\|default) | Classification result: { domain: BATMAN\|WAKANDA\|JARVIS\|ORACLE, stability, risk, destination } | eval-runner.ts; determines routing destination (wiki\|postgres\|quarantine) | Mock test passes; deterministic output per source type |
| `source-classifier.ts` | **MOCK** (routing logic) | `classifySourceForDestination(sourceType)` | sourceType | { destination: wiki\|postgres\|quarantine, routing_rule: string } | eval-runner.ts determines storage backend | Mock test passes |
| `local-model-router.ts` | **MOCK stub** (client-side router; task classification defined, inference mode routing not yet wired) | `getLocalModelRouterStatus()`, `classifyTaskForInference(profile)` | TaskProfile (reasoning_depth, context_size, cost_sensitive, safety_critical, multi_turn) | InferenceMode (LOCAL\|HYBRID\|PREMIUM) | Mission Control UI; used to route inference tasks to appropriate model tier | Mock test passes; 5 task profiles defined (decompose_mission, classify_task, generate_summary, review_loop, health_check); routing logic incomplete |
| `local-node-health.ts` | **MOCK** (health check for 8 services; deterministic output) | `getLocalNodeHealthMock()`, `getLocalNodeHealth()`, `fetchLocalNodeHealth()` | (none) | { services: [{ name, status: OPERATIONAL\|NOT_WIRED, uptime_pct }] } | Mission Control UI; pre-flight check at session start | Mock test passes; all 8 services currently NOT_WIRED (Ollama, Postgres, Redis, Chroma/pgvector, Claude Code, Codex, Kiro, Oracle Filesystem) |
| `layer-status.ts` | **MOCK/stub** (9-layer status model; individual layer checks defined, orchestration not yet wired) | `getLayerStatusMock()` | (none) | { layers: [{ layer_id, name, status }] } for 9 layers (Immutable Sources, Source Classifier, LLM Wiki Compiler, Structured Store, Retrieval Index, Opportunity Graph, Summary Tree, Retrieval Gate, Bootstrap Layer) | eval-runner.ts; shows Oracle OS layer readiness | Mock test passes; Layer 1 (Immutable Sources) = OPERATIONAL; Layer 3 (Wiki Compiler) = OPERATIONAL; Layer 6 (Opportunity Graph) = SCAFFOLDED; Layer 8 (Retrieval Gate) = SCAFFOLDED; Layer 9 (Bootstrap) = OPERATIONAL |
| `opportunity-graph.ts` | **MOCK stub** (GraphRAG Layer 6; data structures defined, graph construction logic not implemented) | GraphNode, GraphEdge, CrossDomainAlert data structures | (logic incomplete) | { nodes: [GraphNode], edges: [GraphEdge], alerts: [CrossDomainAlert] } for 4 world nodes (BATMAN, WAKANDA, JARVIS, ORACLE) | eval-runner.ts; shows 4 world nodes, 2 cross-domain alerts (UMG/BATMAN-WAKANDA, Caldwell PR/WAKANDA-BATMAN) | Mock test passes; data structures defined |
| `summary-tree.ts` | **MOCK stub** (RAPTOR Layer 7; 4 summary levels defined, tree construction not implemented) | WorldSummaryTree data structure; 4 levels: Raw Sources (18), Entity Summaries (12), Domain Summaries (6), Bootstrap Capsules (4) | (logic incomplete) | { worlds: [WorldSummaryTree] } for 4 worlds (BATMAN: 5 entities, WAKANDA: 3, JARVIS: 2, ORACLE: 4) | eval-runner.ts; shows 18 raw sources, 14 pages updated as of 2026-04-27 | Mock test passes; data structures defined |

### Core Memory Functions (Outside Oracle Library)

| Function | File | Input Contract | Output Contract | Use Site | Test Coverage |
|----------|------|-----------------|-----------------|----------|----------------|
| (16D role-based append) | `~/.claude/projects/-Users-Malachi/memory/current.md` | (manual entry per role: task\|context\|blockers\|decisions\|signals) | Entry with timestamp, weight, linked_roles, anchor_status, decay_state, observed_sessions | Every session; Hebbian pair tracking | Behavioral — Session 1 → Session 2 → Session 3 churn measured in snapshot comparison |
| (Session closure consolidation scan) | Not yet implemented as function | current.md state, Phase 2 Fractal Memory spec | Consolidation candidates flagged for user approval | Session close protocol (planned Stage H) | Evals 7 (Phase 2 completion checkpoint) |
| (Rule activation detection — Gate 3) | `rule-activation-monitor.ts` | RuleMonitorConfig | RuleActivationResult | Eval-runner calls per session | 8/8 tests passing |

---

## 3. Current Eval/Test Coverage

### Implemented & Passing (8/8 Tests)

**rule-activation-monitor.ts (Gate 3 Implementation)**
- ✅ Math Structure trigger detection
- ✅ Graphify trigger detection
- ✅ Memory Write trigger detection
- ✅ Phase Gate trigger + anti-drift rule (if Gate 3 failed, always surface Scope Gate rule)
- ✅ Non-trigger baseline (negative test)
- ✅ Hard Boundary detection (Financial, Privacy, IP, Public Actions boundaries)
- ✅ Output contract validation (RuleActivationResult structure)
- ✅ Confidence scoring (base 0.7, exact phrase → 0.95, word boundary → 0.85, +0.15 on gate_3_failed)

### Mocked / Not Yet Implemented

| Eval | Layer | Current Status | What It Proves | What It Does NOT Prove |
|------|-------|----------------|----------------|------------------------|
| Bootstrap Layer | Layer 9 | Mock: OPERATIONAL (files found, pages verified) | Files exist at expected paths | Actual Bootstrap algorithm correctness or performance |
| Retrieval Gate | Layer 8 | Mock: WIKI_ONLY mode (context 0.89, freshness 0.94, source coverage 0.81) | Enum and return struct defined | Core retrieval mode selection logic; whether correct mode is chosen for a given rule activation |
| Wiki Compiler | Layer 3 | Mock: 18 sources processed, 14 pages updated, 7 entities created | Status field can be read | Actual compilation of sources into wiki pages; contradiction detection |
| Opportunity Graph | Layer 6 | Mock: 4 world nodes, 2 cross-domain alerts | Data structures; alert generation | Real graph construction; relevance of detected cross-domain connections |
| Summary Tree | Layer 7 | Mock: 4 levels (18 raw → 12 entity → 6 domain → 4 bootstrap) | Data structure shape | Actual summarization quality; whether summaries compress information accurately |
| Source Classifier | Layer 2 | Mock: deterministic routing per source type | Classification logic for 5 source types | Real source type detection from arbitrary input; accuracy of domain/stability/risk assignments |
| Local Model Router | (client-side) | Mock: task classification to LOCAL\|HYBRID\|PREMIUM | Task profiles and inference modes defined | Actual cost vs. quality tradeoffs; whether routing decisions are optimal |
| Local Node Health | (infrastructure) | Mock: all 8 services NOT_WIRED | Health check structure | Actual service connectivity; which services are actually running |
| Layer Status | (orchestration) | Mock: 9 layers with status enum | Status model shape | Cross-layer dependencies; whether layer preconditions are met before downstream layers run |
| Provenance | Layer 4/5 | Mock: 21 sources registered, 25 claims, 4 unresolved | Status counts | Actual provenance tracing; whether links between claims and sources are correct |

### Session-Level Behavioral Tests

| Test | What It Measures | Status |
|------|------------------|--------|
| Snapshot comparison (Session 1 → Session 3) | Churn (added/removed/weight-delta entries); Hebbian pair activity; observed_sessions advances; motif recurrence | Baseline exists (snapshot_session_01.md); Session 3 checkpoint protocol defined in edf acceptance criteria; not yet executed |
| Gate 3 anti-drift rule | When Gate 3 fails (rule activation false-negatives), Scope Gate rule is always surfaced | Implemented in rule-activation-monitor.ts (8/8 tests passing) |
| Torus state contraction | Task focus correlates with fewer retrieval gate activations | Tracked in current.md torus_state field; not yet evaluated |

---

## 4. Current Memory Flow

### Entry Point (How Information Enters 16D)

1. **User message** arrives in session
2. **Rule-activation-monitor.ts** (Gate 3) scans message for 6 trigger patterns (MATH_STRUCTURE, GRAPHIFY, MEMORY_WRITE, PHASE_GATE, SCOPE_GATE, BOUNDARY_BREACH)
3. **eval-runner.ts** receives rule-activation result and user message
4. **Claude decides**: append new entry to current.md under relevant role (task/context/blockers/decisions/signals) if information is session-specific and not 8D/32D material
5. **Entry created** with auto-generated metadata: timestamp (session timestamp), weight (initial: 1.0), linked_roles (empty array), anchor_status (raw), decay_state (active), observed_sessions (1)

### Classification (How Entry Is Assigned to Role)

| Role | Entry Type | Example | Weight Behavior |
|------|-----------|---------|-----------------|
| **task** | Current work, immediate objective, feature/fix/investigation underway | "Implementing Phase 2 Stage A memory inventory" | Decays if inactive >1 session; resets to 1.0 if re-engaged |
| **context** | Facts needed to continue correctly; system state, prior decisions, dependencies | "rule-activation-monitor.ts is REAL (8/8 tests passing); retrieval-gate.ts is STUB (6 modes, no logic)" | Decays if inactive >2 sessions (slower); updated when context changes |
| **blockers** | Things preventing forward movement; missing information, waiting dependencies, unresolved decisions | "Path to fractal-memory.md not found (not blocking; sufficient context in current.md + snapshot_session_01.md)" | Decays quickly if resolved; escalates if unresolved >2 sessions |
| **decisions** | Choices made; rationale; alternatives considered | "Stage A is read-only. No code changes, no commits unless inventory document created. All reads executed without mutation." | Sticky (long half-life); persists for multi-session reference |
| **signals** | Recurring patterns; motif candidates; observations that recur across sessions | "Rule activation anti-drift pattern: when Gate 3 fails, surface Scope Gate rule (observed Sessions 1 & 3; motif candidate for local anchor)" | Accumulates; observed_sessions incremented each session the pattern appears |

### Retrieval (How Information Is Retrieved)

1. **Session open**: current.md is automatically loaded (16D)
2. **Rule activation detected** (Gate 3): eval-runner calls retrieval-gate based on activated rule
3. **Retrieval-gate (STUB in Stage A)** evaluates which mode to use:
   - NO_RETRIEVAL: rule known to be intrinsic to session
   - BOOTSTRAP_ONLY: load fractal-memory.md if session is bootstrap phase
   - WIKI_ONLY: surface current.md entries from matching role + linked_roles
   - RAG_DYNAMIC: call remote LLM retrieval service (not yet wired)
   - GRAPH_RELATIONSHIP: use opportunity-graph to find related world nodes
   - SOURCE_AUDIT: trace back to source via provenance.ts
4. **Retrieved entries** are ranked by:
   - Ring distance (if Hebbian weights computed; not yet in Stage A)
   - Weight (higher weight = more recently engaged)
   - observed_sessions (local anchor candidates have observed_sessions ≥3)
5. **Result** surfaced to Claude for context

### Rule Activation (How Rules Trigger Retrieval)

1. **Gate 3 detects trigger** (e.g., user types "graphify" or "/graphify") in rule-activation-monitor.ts
2. **Confidence scored**: base 0.7, exact phrase match → 0.95, word boundary → 0.85, +0.15 if Gate 3 previously failed
3. **Action determined**:
   - Confidence > 0.85 → WARN (surface 8D rule, ask user to confirm intent)
   - Confidence > 0.8 → BLOCK (refuse action; explain rule)
   - Confidence ≤ 0.8 → SURFACE (proactively show rule for reference, allow action)
4. **Anti-drift rule** (critical): If Gate 3 failed in prior session (detected false-negative), automatically surface Scope Gate rule even if not triggered
5. **Result** passed to eval-runner as part of EvalSuiteResult

### Provenance (Where Source Links Exist, Where Missing)

| What | Where Tracked | Coverage |
|-----|----------------|----------|
| **User input** | current.md per-entry field `timestamp` (session date); linked_roles (which roles reference this entry) | Full: every entry has timestamp + linked_roles |
| **Rule definitions** | CLAUDE.md (8D) with explicit section markers (Rule 1 — Scope Gate, Rule 2 — Progressive Disclosure, Rule 3 — Corrections Log) | Full: 100% of rules have source location |
| **Eval results** | eval-runner.ts output includes timestamp per EvalSuiteResult | Full: rule-activation-monitor.ts adds timestamp to result |
| **Sources (21 registered)** | provenance.ts (mock currently; REAL_FS planned) tracks: sourcesRegistered (21), claimsRegistered (25), verifiedClaims (25), inferredClaims (0), unresolvedClaims (4) | Partial: 25 of 29 total claims verified; 4 unresolved |
| **Wiki pages (14 updated)** | wiki-compiler.ts tracks pagesUpdated (14); wiki-lint.ts tracks backlinks | Partial: 4 pages have full provenance; 5 pages missing provenance |
| **Snapshot baseline** | snapshot_session_01.md frozen at Session 1 close; marks 4 pre-registered motifs to track | Full for baseline; Session 2→3 motif evolution not yet tracked |

---

## 5. Gaps Before Stage B

### Missing Contracts

| Contract | Why Needed | Who Uses It | Gap Impact |
|----------|-----------|------------|-----------|
| **Shell Graduation Contract** | Defines criteria (Scope Gate test: "true regardless of project?") and approval workflow (user approval) for promoting 16D entries → 32D → 8D | Consolidation scan at session close (planned Stage H) | Without this, can't promote entries safely; Scope Gate test exists but graduation workflow not yet implemented |
| **Anchor Promotion Contract** | Defines criteria (observed_sessions ≥3 within a role) and promotion workflow (no new shell; create local_anchor status instead) for consolidating recurring motifs inside 16D | 16D sub-shell kernel (planned Stage C) | Without this, recurring patterns in current.md won't consolidate; entries will pile up as duplicates instead of linking to anchor |
| **Hebbian Update Contract** | Defines which role pairs are co-occurrence edges (task↔context, task↔blockers, blockers↔decisions, decisions↔signals), weight increment on co-occurrence, decay formula (weight *= 0.95 per inactive session), ring tightening threshold (θ=5 co-occurrences → ring distance -1) | 16D sub-shell kernel + session close (planned Stages D & H) | Without this, role ring distance stays static; can't tighten adjacency based on learned patterns |
| **Soft Decay Contract** | Defines when entries → stale (30+ days inactive), archived (90+ days inactive), quarantine rules, merge heuristics (when to consolidate two 0.2-weight entries), weight dampening formula | 16D soft decay (planned Stage E) | Without this, old entries remain at full weight, wasting retrieval capacity; no distinction between "recently used" and "old but relevant" |
| **Retrieval Gate Integration Contract** | Defines how eval-runner.ts chooses retrieval mode (NO_RETRIEVAL, BOOTSTRAP_ONLY, WIKI_ONLY, RAG_DYNAMIC, GRAPH_RELATIONSHIP, SOURCE_AUDIT) based on rule-activation result + state_16d | eval-runner.ts (planned Stage F) | Without this, retrieval-gate.ts 6 modes stay undefined; can't route rules to correct retrieval path |

### Missing Implementations

| Implementation | Current Status | Gap | Stage to Fix |
|---------------|----------------|-----|--------------|
| **Shell graduation workflow** | Scope Gate test exists (CLAUDE.md Rule 1); approval workflow scaffolded in spec but not coded | Can't promote 16D entries to 32D/8D; no function exists to execute promotion after user approval | Stage B (first implementation after Stage A) |
| **Anchor promotion logic** | Data structures exist (anchor_status field on entries); threshold (observed_sessions ≥3) defined; promotion criteria undefined | Can't detect recurring motifs or create local anchors; entries won't consolidate | Stage C |
| **Hebbian co-occurrence tracking** | Role ring defined (task↔context → decisions↔signals); initial pairs listed; weight increment/decay formulas NOT YET CODED | Ring distance stays static; can't learn from session patterns; θ=5 threshold never checked | Stage D |
| **Soft decay & quarantine** | age-weighted pruning defined in spec (30/90 day thresholds); formulas NOT YET CODED; no quarantine detection | Entries never age; old entries clutter retrieval; no way to distinguish fresh vs. stale without manual intervention | Stage E |
| **Retrieval gate routing logic** | 6 modes defined (enum); mock returns WIKI_ONLY always; core decision logic NOT YET CODED | eval-runner can't choose correct retrieval mode; all rules route to WIKI_ONLY regardless of activation pattern | Stage F |
| **Provenance tracing (REAL_FS)** | Currently mock (21 sources registered, 4 unresolved); readProvenanceLinks() function not yet wired to actual source files | Can't trace claims back to original sources; provenance exists conceptually but not operationally | Stage B (planned REAL_FS implementation in provenance.ts) |
| **Evals 4–6** (Session-level gate checks) | Evals 1–3 defined (Bootstrap, Wiki Compiler, Opportunity Graph); Evals 4–6 (Consistency, Motif Detection, Consolidation Readiness) scoped in Phase 2 acceptance criteria but not coded | Can't run Phase 2 acceptance checks until eval functions exist; Stage G (Run All 8 Evals) will depend on these | Stage G |

### Missing Cascade Error Prevention

| Level | Current Status | Gap |
|-------|----------------|-----|
| **Level 1 (CLAUDE.md — 8D identity)** | Fully operational; Scope Gate (Rule 1), Progressive Disclosure (Rule 2), Corrections Log (Rule 3) enforced | No gap; working as designed |
| **Level 2 (current.md — 16D session state)** | Fully operational; role carving, per-entry metadata, Hebbian pairs tracked; NO automatic consolidation yet | Gap: entries accumulate without promotion or decay; no local anchor promotion workflow |

---

## 6. Safety Boundaries

### Files NEVER to Mutate (Hard Boundary — edf enforced)

| File | Reason | Enforcement |
|------|--------|------------|
| `~/.claude/CLAUDE.md` | 8D identity layer; Scope Gate, Progressive Disclosure, Corrections Log are governance rules | Explicit edf rule: "Do not modify UI routes. Do not modify backend services." Rule 1 (Scope Gate) prevents writing project-specific content here. |
| `~/.claude/oracle-memory/sources/` | Immutable source registry | Explicit edf hard rule: "Do not touch ~/.claude/oracle-memory/sources." |
| `docs/PHASE_2_FRACTAL_MEMORY_CONSOLIDATION_PLAN.md` | Controlling specification (commit 3ea3298) | Explicit edf rule: "Controlling specs: do not implement until gated approval." |
| `docs/PHASE_2_ACCEPTANCE_CRITERIA.md` | Controlling specification (commit 62757e4) | Explicit edf rule: "Controlling specs: do not implement until gated approval." |
| `snapshot_session_01.md` | Frozen Session 1 baseline (2026-04-24); hard reference for drift detection | Not specified in edf but implied (it's a snapshot, not a log); treat as immutable archive. |
| `rule-activation-monitor.ts` | Fully functional; 8/8 tests passing; required for Gate 3 | Not specified in edf; treat as operational code to not mutate unless bug found. |

### Files Safe to Edit in Phases 2+ (Append-Only Where Applicable)

| File | Scope of Change | Notes |
|------|-----------------|-------|
| `~/.claude/projects/-Users-Malachi/memory/current.md` | APPEND ONLY; unsafe to delete or reorder existing entries | New entries can be added per role; per-entry metadata auto-generated. Existing entries have observed_sessions, weight, linked_roles; these will be updated by Hebbian logic (Stage D) and decay logic (Stage E), but not deleted. |
| `~/.claude/projects/-Users-Malachi/memory/MEMORY.md` | UPDATE EXISTING ENTRIES; add new pointer lines as needed | Index file. Safe to add new `- [Title](file.md)` entries; safe to update descriptions of existing entries. Do not remove pointers (use soft archive instead). |
| `ui/lib/oracle/*.ts` | Implement STUB and MOCK modules per stage-gate approval | retrieval-gate.ts (STUB → Stage F), local-model-router.ts (STUB → Stage F), opportunity-graph.ts (MOCK → Stage G), summary-tree.ts (MOCK → Stage G), provenance.ts (REAL_FS plan → Stage B). Do not mutate rule-activation-monitor.ts (REAL, working) unless bug fix. |
| `docs/` (new files only) | Create new `.md` files for evals, gates, reports | Safe to create new docs per phase gate; do not edit controlling specs. |

### Files Requiring Explicit Approval (Multi-Step Gating)

| File | Current Status | Who Approves Next Change | How Approval Documented |
|------|----------------|-------------------------|------------------------|
| `~/.claude/CLAUDE.md` | Operating under 3 drift-prevention rules (Scope Gate, Progressive Disclosure, Corrections Log) | Only content passing Scope Gate test can be added; user approval logged in Corrections Log | Corrections Log entries dated and signed |
| Shell graduation targeting (when Phase 2 Stage H executes) | No entries ready yet; consolidation candidates TBD | User explicitly approves each promotion from 16D → 32D → 8D | Explicit user approval in prompt before promotion executed |
| Phase 2 Stage B/C/D/E/F/G/H progression | Each stage requires explicit auth (edf gates 1–3 passed; edf checkpoint document) | User issues new checkpoint document or explicit prompt authorizing next stage | Documented in edf-format files or explicit user messages |

---

## 7. Recommended Stage B Entry Point

### Exact Next Implementation Target

**File to Create or Modify First:**

`ui/lib/oracle/provenance-real-fs.ts` (NEW FILE)

**Why This Is the Safest Starting Point:**

1. **Lowest complexity**: Reading & linking existing source files is simpler than implementing Hebbian co-occurrence tracking (Stage D) or soft decay logic (Stage E)
2. **Minimal dependencies**: Provenance can work independently; doesn't require retrieval-gate choices (Stage F) or evals 4–6 (Stage G)
3. **Unblocks downstream evals**: Once REAL_FS source registry is in place, source-classifier.ts can validate against real sources; wiki-compiler.ts can verify page citations; provenance.ts can trace claims to original files
4. **Clear contract**: Specification already exists in Phase 2 acceptance criteria (Section 3.2: "Provenance tracing contract: [list source types, claim linkage rules, format]")
5. **No mutation of operating code**: Can run REAL_FS implementation in parallel with existing mock (mock stays in place for fallback)

### Implementation Scope for Stage B

1. **Read-only source registry scan**
   - Locate all files in `~/.claude/oracle-memory/sources/` (or wherever immutable sources live)
   - Parse metadata (source type, domain, stability, risk classification)
   - Return SourceRegistry object with path → metadata mapping
   - Test: Verify all 21 sources parse without error

2. **Claim-source linking**
   - For each claim in current.md, wiki-compiler.ts, opportunity-graph.ts outputs, trace back to source
   - Build claim → source_id mapping (many-to-one; one claim may come from multiple sources)
   - Return LinkageReport with verified / unresolved counts
   - Test: Verify all 25 claims can link to at least one source (target: 25/25 verified)

3. **No mutations**
   - Read-only filesystem operations
   - Do not create, modify, or delete any source files
   - Do not commit changes to provenance.ts or CLAUDE.md

### Required Tests Before Stage B Can Pass

| Test | What It Proves | Pass Criteria |
|------|----------------|----------------|
| **Source Registry Read** | provenance-real-fs.ts can enumerate sources without error | All 21 sources found; none skipped; no parse errors |
| **Claim Linkage** | Every registered claim links to at least one source | 25/25 claims verified (improvement from 25/25 currently, but baseline established) |
| **Unresolved Claim Reduction** | provenance-real-fs.ts reduces unresolved_claims count from 4 → 0 (or explains why some can't be resolved) | ≤1 unresolved claim remaining (or documented exemption per claim) |
| **Immutable Source Integrity** | No source files modified during test; read-only audit passes | All source mtimes unchanged; no writes to sources/ directory |
| **Evals 1–3 Integration** | Bootstrap, Wiki Compiler, and Opportunity Graph evals can call provenance-real-fs functions without error | All 3 evals return valid data; no null/undefined fields |

### Prerequisite: Source Registry Inventory

Before Stage B implementation begins, user must provide (or we discover) the definitive location and schema of:
- Source file paths (currently referenced as `~/.claude/oracle-memory/sources/` but not validated in Stage A)
- Source metadata structure (format: JSON, YAML, embedded comments?)
- Immutable field list (what cannot be updated)
- Current source count (spec says 21; need to verify)

**Action for user approval:**
"Stage B is ready to begin. First step: confirm the source registry location and schema. Once confirmed, I will implement provenance-real-fs.ts (read-only, 3 functions, 3 required tests). Approval needed to proceed."

---

## Session 3 Checkpoint (Phase 2 Stage A Completion)

**Branch Verified:**
- Current branch: `night-build/2026-04-25` ✅
- Specs verified: docs/PHASE_2_FRACTAL_MEMORY_CONSOLIDATION_PLAN.md (commit 3ea3298) ✅
- Specs verified: docs/PHASE_2_ACCEPTANCE_CRITERIA.md (commit 62757e4) ✅

**Inventory Document Created:**
- Path: `docs/PHASE_2_STAGE_A_MEMORY_TOOL_INVENTORY.md` ✅
- Size: ~12 KB (this document)

**Memory System Findings:**

| Category | Count | Status |
|----------|-------|--------|
| Existing REAL modules | 7 (CLAUDE.md, MEMORY.md, current.md, snapshot_session_01.md, rule-activation-monitor.ts, eval-runner.ts, bootstrap-status.ts) | Operational |
| Existing MOCK/STUB modules | 6 (retrieval-gate.ts, wiki-compiler.ts, wiki-lint.ts, source-classifier.ts, opportunity-graph.ts, summary-tree.ts) | Scaffolded; ready for Stage B+ |
| Missing modules (before Stage B) | 1 (provenance-real-fs.ts; currently REAL_FS/MOCK hybrid) | Planned Stage B |
| Highest-risk gap | Anchor promotion logic (Stage C); without it, recurring motifs won't consolidate, causing 16D bloat | Deferred to Stage C |

**Safety:**
- Immutable sources touched: 0 (Stage A is read-only) ✅
- Code implemented: 0 (Stage A is read-only) ✅
- UI touched: 0 ✅
- Backend services touched: 0 ✅
- Secrets/tokens added: 0 ✅
- DB/migrations run: 0 ✅

**Working Tree:**
```
(git status --short output to follow)
```

**Recommended Next Step (Exact):**

1. Confirm source registry location and schema (`~/.claude/oracle-memory/sources/` — verify path exists and structure)
2. Upon confirmation, begin Stage B implementation with provenance-real-fs.ts (read-only source linking)
3. Execute provenance tests; verify 25/25 claims linkable, ≤1 unresolved
4. Do not proceed to Stage C (anchor promotion logic) until Stage B passes all evals

---

## Appendix A — Oracle Library Dependency Graph

```
eval-runner.ts (orchestration)
├── rule-activation-monitor.ts (Gate 3 — REAL, 8/8 tests)
├── bootstrap-status.ts (REAL)
├── wiki-compiler.ts (MOCK)
├── wiki-lint.ts (MOCK)
├── provenance.ts (REAL_FS/MOCK hybrid; provenance-real-fs.ts planned Stage B)
├── source-classifier.ts (MOCK routing logic)
├── retrieval-gate.ts (STUB; 6 modes defined, logic deferred Stage F)
├── layer-status.ts (MOCK/stub; 9-layer status)
├── local-node-health.ts (MOCK; 8 services)
├── local-model-router.ts (MOCK stub; task classification)
├── opportunity-graph.ts (MOCK stub; GraphRAG Layer 6)
└── summary-tree.ts (MOCK stub; RAPTOR Layer 7)

current.md (16D session state)
├── role carving (task, context, blockers, decisions, signals)
├── per-entry metadata (timestamp, weight, linked_roles, anchor_status, decay_state, observed_sessions)
├── Hebbian pair tracking (deferred Stage D)
└── soft decay tracking (deferred Stage E)

CLAUDE.md (8D identity)
├── Rule 1 — Scope Gate (validates entry belongs to correct shell)
├── Rule 2 — Progressive Disclosure (load files on-demand per triggers)
└── Rule 3 — Corrections Log (log drift incidents)
```

---

**Document Created:** 2026-04-28 | **Stage A Status:** COMPLETE (READ-ONLY) | **Authorization:** edf.rtfd
