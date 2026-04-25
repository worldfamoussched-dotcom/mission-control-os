# Mission Control OS — Master Build Plan

**Current Phase:** 3 closing → Phase 4 entry pending Nick approval
**Progress:** Phase 0: 100% | Phase 1: 100% | Phase 2: 100% | Phase 3: 100% — Jarvis ✅ Wakanda ✅ Cockpit mode switcher ✅ Cockpit page tests ✅. Remaining bullets (ATS tool registry, multi-approver chain, Resonance OS scoping) are Phase-4-deferred or need Nick input.
**Active Worktrees:** none
**Blockers:** none
**Next Approval Gate:** Phase 4 entry — multi-approver chains, real memory isolation, Resonance OS integration scoping
**Session State:** see `current.md` (16D shell — read on session open)

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

**Total tests at Phase 3 close: 166 backend + 47 UI (was 33) = 213 total passing**

6. ✅ **Cockpit brand-aware mode switcher** (`ui/pages/cockpit.tsx`)
   - Brand picker (VS/LX, Fractal, ATS) replaces mode dropdown — operator thinks in brands
   - Per-brand accent color (violet / emerald / amber) for instant visual identity
   - `handleLaunch` branches per brand: Batman creates+waits, Jarvis fires `/run` immediately, Wakanda fires `/run-wakanda` then renders gated queue
   - `handleApprove`/`handleReject` branch per mode: Batman uses `/tasks/.../approve` + `/execute` (only when queue empties), Wakanda uses `/wakanda/tasks/.../approve`
   - Approval queue shown only for Batman + Wakanda (when gated tasks exist)
   - Operator-friendly status: "Waiting on you — N to review" / "Running…" / "Done"
   - `npx tsc --noEmit` clean
   - Bug fix: previous `handleApprove` called `/missions/{id}/approve` (not a real endpoint) and `/execute` on every approve

### Phase 3 Closure (2026-04-25 night-build)
- [x] Tailwind install in `ui/` — landed in `355350e` (Tailwind v3 + autoprefixer + postcss)
- [x] Component-level Vitest tests — `355350e` (33 tests across 6 components)
- [x] **Cockpit page tests** — `6fd5be1` on `night-build/2026-04-25` (14 new tests; brand picker, Batman/Jarvis/Wakanda launch flows, approval flows including the `/execute`-only-when-queue-empty regression guard, polling)
- [x] JSDOM `scrollIntoView` stub in `vitest.setup.ts` (unblocked any future test rendering ExecutionLog with non-empty tasks)

### Deferred / Needs Nick Input
- [ ] Wakanda-specific tool registry entries — needs concrete ATS workflow examples
- [ ] Multi-approver chain — Phase 4
- [ ] **Resonance OS integration scoping** — see memory at `resonance_os_integration_pending.md`

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

**Last Updated:** 2026-04-25 night-build (cockpit page tests + JSDOM fix landed — Phase 3 100%, awaiting Nick approval to enter Phase 4)
**Maintained By:** Mission Architect Agent
