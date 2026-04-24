# Mission Control OS — Master Build Plan

**Current Phase:** 3 (Jarvis & Wakanda Modes)
**Progress:** Phase 0: 100% | Phase 1: 100% | Phase 2: 100% | Phase 3 ~80% (Jarvis ✅, Wakanda code ✅ with conservative defaults)
**Active Worktrees:** none
**Blockers:** none — Wakanda shipped with locked-in defaults; revisit spec questions when ATS workflow surfaces concrete needs
**Next Approval Gate:** Cockpit mode switcher (UI work)

### Mode → Business Mapping (CONFIRMED 2026-04-24)
- **Batman** = Vampire Sex / London X — artist work, approval-gated
- **Jarvis** = Fractal Web Solutions — dev agency, command-execute (single-shot)
- **Wakanda** = ATS / All the Smoke — label, mixed/selective approval

---

## Phase 0 — Foundation (Week 1) ✅ COMPLETE
- Mission Object Pydantic model
- Folder structure, pyproject.toml, package.json
- Git init, DB schema, pytest fixtures
- TypeScript/Next.js config (full scaffold landed in Phase 2)

---

## Phase 1 — Batman Mode MVP (Weeks 2–5) ✅ COMPLETE
- DecomposerAgent + BatmanGraph + ExecutorAgent + BatmanSupervisor
- Approval queue, full FastAPI route surface
- React cockpit (cockpit.tsx + components)
- 56/56 tests at Phase 1 close

---

## Phase 2 — Reviewer Agents + Guardrails (Weeks 6–7) ✅ COMPLETE

### Objectives — ALL MET
- [x] Reviewer Agents (code, memory, security)
- [x] Cost alert service with hysteresis
- [x] ReviewGate wired into BatmanGraph between approval and execution
- [x] CostAlertService.check wired into `_execute_task_node` after each cost track
- [x] Per-mission ABAC policy (`Mission.abac_policy`)
- [x] AuditService persistence (SQLite tests, Postgres prod via `DATABASE_URL`)
- [x] Cockpit ReviewPanel + AlertsPanel
- [x] End-to-end cockpit smoke test through ASGI transport
- [x] Next.js scaffold + typed api client (`npx tsc --noEmit` clean)
- [x] **ABAC enforcement consolidation** — `ABACEnforcer` service is the single tool-invocation gate; integrated into `BatmanGraph._execute_task_node` before tool execute (Spec §2.2 + §5.3)

### Phase 2 close
- **Total tests at close: 147/147 passing**
- ABAC consolidation landed in commit `c51a22d` (+20 tests for ABACEnforcer)

---

## Phase 3 — Jarvis & Wakanda Modes (Weeks 8–10) — ACTIVE ~33%

### Phase 3 Task Log

1. ✅ **JarvisSupervisor** (`backend/agents/jarvis_supervisor.py`) — commit `8deab03`
   - Spec §9–11: single-shot decompose → review → execute → done
   - Shares ToolService / CostService / MemoryService / CostAlertService / AuditService with Batman supervisor
   - 6 unit tests + 2 integration tests
   - Mode mapping: **Jarvis = Fractal Web Solutions** (dev agency)

2. ✅ **POST /missions/{id}/run route** — commit `8deab03`
   - Jarvis-only single-shot execution
   - Rejects Batman missions with 400
   - Mode-aware `create_mission` (Jarvis skips create-time decomposition)

3. ✅ **Wakanda spec + conservative defaults** — `docs/SPEC_PHASE3_WAKANDA.md`
   - Selective approval rule: gate iff public-facing / contractual / irreversible / cross-artist / manually flagged
   - 6 spec questions answered with conservative defaults (gate-when-unsure, single operator, no cascade on reject)
   - Mode mapping: **Wakanda = ATS / All the Smoke** (label)

4. ✅ **WakandaSupervisor + GateClassifier** (`backend/agents/wakanda_supervisor.py`)
   - GateClassifier: 7-rule priority lattice (safety floor → ABAC overrides → manual flag → registry flag → unknown-default-gate → pass)
   - run_mission(): classify each task, run pass-through immediately, queue gated for operator
   - approve_gated_task(): on approve runs review→execute, on reject marks rejected (no cascade)
   - Shares ToolService / CostService / MemoryService / CostAlertService / AuditService with Batman + Jarvis supervisors
   - 16 unit tests (`tests/unit/test_wakanda_supervisor.py`) — classifier rules + lifecycle

5. ✅ **Wakanda routes** (`backend/api/routes.py`)
   - `POST /missions/{id}/run-wakanda` — kicks off classify + auto-run pass-through
   - `POST /missions/{id}/wakanda/tasks/{tid}/approve` — operator decision on gated tasks
   - Both reject non-Wakanda missions with 400
   - `create_mission` now skips create-time decomposition for both Jarvis AND Wakanda
   - 3 integration tests (`tests/integration/test_wakanda_route.py`)

**Total tests at Phase 3 close: 166/166 passing**

### Phase 3 Remaining
- [ ] Cockpit mode switcher — currently Batman-only UI; needs to handle Jarvis single-shot + Wakanda mixed-queue
- [ ] Wakanda-specific tool registry entries (deferred — adds when ATS workflow surfaces concrete needs)
- [ ] Multi-approver chain (deferred to Phase 4)

---

## Phase 4 — Memory Scoping & ABAC (Weeks 11–12)
- [ ] Full memory isolation per Mission (in progress — MemoryReviewer enforces; storage isolation TBD)
- [ ] Least-privilege ABAC system (foundation in `ABACEnforcer`; needs role-based extensions)
- [ ] Role-based tool access

---

## Phase 5 — Polish & Launch (Week 13)
- [ ] Documentation + guides
- [ ] Performance optimization
- [ ] Deployment + monitoring

---

## Risks & What to Avoid
- **Swarm behavior** — Agents spinning up without coordination
- **Free-form agent chat** — Approval queue must be explicit
- **Cross-mode memory leakage** — Batman / Jarvis / Wakanda isolated (enforced by MemoryReviewer)
- **Mode-mapping drift** — Jarvis = FWS, Wakanda = ATS. This has drifted before; persisted to memory at `~/.claude/projects/-Users-Malachi-Missipn-Control-Builder-Agent/memory/mode_business_mapping.md`
- **Missing audit trail** — every decision logged
- **Scope creep** — stick to the 17-section spec

---

## Spec Reference
- **Phase 1:** `docs/SPEC_PHASE1_BATMAN_MVP.md`
- **Phase 3 Wakanda:** `docs/SPEC_PHASE3_WAKANDA.md` (draft, awaiting Nick review)
- **Architecture:** `docs/ARCHITECTURE.md`

---

**Last Updated:** 2026-04-24 (Wakanda Mode shipped with conservative defaults — 166/166 tests)
**Maintained By:** Mission Architect Agent
