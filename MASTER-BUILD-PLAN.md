# Mission Control OS — Master Build Plan

**Current Phase:** 2 (Reviewer Agents + Guardrails)
**Progress:** Phase 0: 100% | Phase 1: 100% | Phase 2 ~98% (smoke tested end-to-end through FastAPI; only ABAC consolidation cleanup left)
**Active Worktrees:** none
**Blockers:** none
**Next Approval Gate:** ABAC policy source-of-truth — decide where mission-specific policy lives (Mission object? mode registry? Postgres)

---

## Phase 0 — Foundation (Week 1)

### Objectives
- [x] Define Mission Object schema + tool registry + ABAC engine
- [x] Create folder structure + pyproject.toml + package.json
- [x] Initialize git repo + .gitignore
- [x] Set up dev environment + testing framework
- [x] TypeScript/Next.js config for UI
- [x] Database schema (Postgres DDL)
- [x] pytest fixtures + conftest

### Tasks
1. **Define Mission Object Pydantic model** ✅ COMPLETE
   - Spec section: 17-section spec (section 1-2)
   - Fields: id, mode, parent_id, state, approvers, memory_scope, cost_tracked, audit_log
   - Implementation: backend/models/mission.py with all fields + validators + methods
   - Tests: 16 unit tests in tests/unit/test_mission.py (all passing)
   - Database: db/schema.sql with missions, approval_records, audit_log tables

2. **Create folder structure**
   - `backend/` (FastAPI, LangGraph, agents)
   - `db/` (Postgres schema, migrations)
   - `ui/` (React cockpit, approval queues)
   - `tools/` (tool registry, validators)
   - `tests/` (unit, integration, e2e)
   - `docs/` (architecture, guides)

3. **Initialize pyproject.toml + package.json**
   - Python deps: FastAPI, LangGraph, Postgres, Pydantic, SQLAlchemy
   - Node deps: React, TypeScript, Tailwind, Next.js
   - Pre-commit: black, isort, ruff, mypy

4. **Git setup + first commit**
   - Initialize repo, create main branch
   - Add .gitignore, README.md
   - First commit: "feat: project scaffold"

---

## Phase 1 — Batman Mode MVP (Weeks 2–5)

### Objectives
- [x] FastAPI app + routes scaffolded
- [x] LangGraph BatmanGraph + BatmanLeadAgent built
- [x] DecomposerAgent — Claude API call, JSON parsing, task stamping (13 tests ✅)
- [x] Wire decomposer into batman_graph._decompose_node
- [x] Executor agent (backend/agents/executor.py)
- [x] React cockpit UI (cockpit.tsx + 3 components)
- [x] Approval queue (TaskApprovalCard + routes)
- [x] Integration test — full Batman workflow lifecycle (4 tests)

### Phase 1 Task Log
1. ✅ **DecomposerAgent** (`backend/agents/decomposer.py`) — 2026-04-24
   - Spec §3: mission objective → structured sub-tasks via Claude
   - 13 unit tests passing, all Claude calls mocked
   - Added: anthropic>=0.25.0, pytest-asyncio to pyproject.toml

2. ✅ **BatmanGraph wired** (`backend/agents/batman_graph.py`) — 2026-04-24
   - Spec §3–5: real LangGraph StateGraph with decompose → approve → execute → complete
   - DecomposerAgent injected into _decompose_node (no more hardcoded tasks)
   - Immutable state pattern (copy.copy on every node)
   - MAX_ITERATIONS=10 loop guard
   - 13 unit tests passing

3. ✅ **ExecutorAgent** (`backend/agents/executor.py`) — 2026-04-24
   - Spec §4–5: ABAC permission check → tool execute → cost track → memory store
   - 7 unit tests passing

4. ✅ **BatmanSupervisor** (`backend/agents/supervisor.py`) — 2026-04-24
   - Spec §3–5: orchestrates decompose + execute lifecycle
   - Wires all services together; used by FastAPI routes

5. ✅ **Routes rewired** (`backend/api/routes.py`) — 2026-04-24
   - Spec §6–8: all routes now go through BatmanSupervisor
   - New endpoints: /execute, /results, /cost, /memory
   - Full Batman approval gate enforced

6. ✅ **CostService model name prefix matching** — 2026-04-24
   - claude-opus-4-5 now resolves correctly to opus pricing tier

7. ✅ **React Cockpit UI** — 2026-04-24
   - Spec §6–8: Batman command center dashboard
   - `ui/pages/cockpit.tsx` — mission input, approval queue, execution log, cost bar
   - `ui/components/TaskApprovalCard.tsx` — per-task approve/reject
   - `ui/components/ExecutionLog.tsx` — scrollable task result log
   - `ui/components/CostTrackerWidget.tsx` — compact cost display

8. ✅ **Integration Test** — 2026-04-24
   - Spec §3–8: full Batman workflow lifecycle
   - `tests/integration/test_batman_workflow.py` — 4 tests (happy path, guardrail, 404, decomposer called)
   - SQLAlchemy upgraded 2.0.23 → 2.0.49 (Python 3.13 compatibility)

**Total tests: 56/56 passing (52 unit + 4 integration)**

### Known Tech Debt
- `ui/lib/api.ts` uses `/api` prefix — spec routes are root-level. Fix before Phase 2 UI work.

### Key Files
- `backend/agents/decomposer.py` ✅
- `backend/agents/batman_graph.py` ✅
- `backend/agents/executor.py` ✅
- `backend/agents/supervisor.py` ✅
- `backend/api/routes.py` ✅
- `db/schema.sql` ✅
- `ui/pages/cockpit.tsx` ✅
- `tests/integration/test_batman_workflow.py` ✅

---

## Phase 2 — Reviewer Agents + Guardrails (Weeks 6–7)

### Objectives
- [x] Implement Reviewer Agents (code, memory, security) — commit `166b6c6`
- [x] Cost alert service with hysteresis — commit `8c90f3c`
- [x] Wire ReviewGate into BatmanGraph between approval and execution
- [x] Wire CostAlertService.check into `_execute_task_node` after each cost track
- [x] ABAC policy source-of-truth decided (Option A: Mission-object-native)
- [x] `Mission.abac_policy` field + CreateMissionRequest plumb-through + Supervisor honors it
- [ ] ABAC enforcement at all decision points (tool_service → review_gate consolidation)
- [x] Persist review_results + cost_alerts to durable store (AuditService — SQLite in tests, Postgres in prod via DATABASE_URL)
- [x] Surface review_results + cost_alerts in the cockpit UI (ReviewPanel + AlertsPanel)

### Phase 2 Task Log
1. ✅ **Reviewer Agents** (`backend/agents/reviewers.py`) — commit `166b6c6`
   - Spec §6–8: CodeReviewer (injection + allow-list), MemoryReviewer (cross-mode prefix ban), SecurityReviewer (ABAC)
   - 21 unit tests (`tests/unit/test_reviewers.py`)

2. ✅ **CostAlertService** (`backend/services/cost_alert_service.py`) — commit `8c90f3c`
   - Spec §15–17: warning at 80% threshold, critical at 100%, 5% hysteresis band
   - Tested in isolation

3. ✅ **BatmanGraph Phase 2 wiring** — 2026-04-24
   - New node `_review_tasks_node` inserted between `await_approval` and `execute_task`
   - Routers renamed: `_should_execute` → `_should_execute_after_review` + new `_should_review`
   - State extended: `review_results`, `cost_alerts`
   - Constructor now accepts `review_gate`, `cost_alert_service`, `abac_policy`
   - Cost alerts fired from inside `_execute_task_node` after every successful tool track
   - 6 new integration tests (`tests/unit/test_batman_graph_phase2.py`)

4. ✅ **Mission-scoped ABAC policy** — 2026-04-24
   - Spec §12–14: ABAC policy scoped per Mission
   - `Mission.abac_policy: Optional[Dict]` added (shape: `{allowed_tools, forbidden_params}`)
   - `CreateMissionRequest.abac_policy` → stored on mission dict → passed to `Supervisor.execute_approved_tasks(abac_policy=...)`
   - When None, SecurityReviewer falls back to its service default
   - 5 new unit tests (`tests/unit/test_mission_abac_policy.py`)

**Total tests: 119/119 passing (113 unit + 6 integration)**
**UI: scaffold complete, `npx tsc --noEmit` clean**

5. ✅ **Next.js scaffold** — 2026-04-24
   - `ui/package.json` (Next 14.2.35, React 18.3.1, TS 5.4.5)
   - `ui/tsconfig.json` (strict, bundler resolution)
   - `ui/next.config.js`
   - Fixed 3 `.tsx` files that had Python triple-quote docstrings (ApprovalQueue, CostTracker, MissionGraph)
   - Updated `dashboard.tsx` to use new `missions.approve()` (dropped stale `tasks.*` import)
   - Typed all `missions.*` API methods with explicit return generics
   - `*.tsbuildinfo` added to gitignore

6. ✅ **Cockpit review + alerts surfacing** — 2026-04-24
   - `ReviewPanel` — per-task reviewer verdicts (code / memory / security), passed vs blocked with reasons
   - `AlertsPanel` — cost alerts with level badge (warning / critical), current/threshold, fired timestamp
   - Polls `/missions/:id/results` + `/missions/:id/alerts` every 3s alongside existing mission + cost polling
   - `npx tsc --noEmit` clean

7. ✅ **Audit persistence layer** — 2026-04-24
   - Spec §6–8 + §15–17: durable record of every review verdict and cost alert
   - New ORM tables: `ReviewResultRecord`, `CostAlertRecord` in `backend/db/models.py`
   - `backend/services/audit_service.py` — session-factory based, swappable between SQLite (tests) and Postgres (prod via `DATABASE_URL`)
   - Wired into `BatmanSupervisor.execute_approved_tasks` — best-effort writes (live workflow never breaks on persistence failure)
   - 11 new tests (8 unit on AuditService, 3 integration on Supervisor + AuditService end-to-end)

8. ✅ **Phase 2 cockpit smoke test** — 2026-04-24
   - `tests/integration/test_phase2_cockpit_smoke.py` — 2 tests
   - Walks every endpoint the cockpit polls (`/missions/:id/results`, `/cost`, `/alerts`, `/memory`) through ASGI transport — no real Anthropic key, no Postgres
   - Asserts `abac_policy` survives create→execute round-trip, alerts fire with low threshold, blocked tasks expose `review_results[]` for ReviewPanel

---

## Phase 3 — Jarvis & Wakanda Modes (Weeks 8–10)

### Objectives
- [ ] Jarvis mode (command-execute, no approval)
- [ ] Wakanda mode (mixed, selective approval)
- [ ] Mode switching + validation

---

## Phase 4 — Memory Scoping & ABAC (Weeks 11–12)

### Objectives
- [ ] Full memory isolation per Mission
- [ ] Least-privilege ABAC system
- [ ] Role-based tool access

---

## Phase 5 — Polish & Launch (Week 13)

### Objectives
- [ ] Documentation + guides
- [ ] Performance optimization
- [ ] Deployment + monitoring

---

## Risks & What to Avoid

- [ ] **Swarm behavior** — Agents spinning up without coordination
- [ ] **Free-form agent chat** — Approval queue must be explicit
- [ ] **Cross-mode memory leakage** — Batman mode data isolated from Jarvis
- [ ] **Missing audit trail** — Every decision logged
- [ ] **Scope creep** — Stick to the 17-section spec

---

## Spec Reference

- **Full spec:** 17 sections, covers Batman/Jarvis/Wakanda modes, ABAC, memory, cost tracking
- **Key sections:**
  - 1–2: Mission Object + tool registry
  - 3–5: Batman mode flow
  - 6–8: Approval queue + guardrails
  - 9–11: Jarvis + Wakanda modes
  - 12–14: ABAC + memory scoping
  - 15–17: Launch + monitoring

---

## Next Human Approval Needed

**Before Phase 0 implementation:**
1. Confirm Pydantic Mission Object schema (spec section 1–2)
2. Approve folder structure
3. Approve tech stack (FastAPI, LangGraph, React, Postgres)

---

**Last Updated:** 2026-04-24 (Phase 2 cockpit smoke green)
**Maintained By:** Mission Architect Agent
