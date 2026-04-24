# Mission Control OS — Mission Architect Skills

## How This Works

These skills are loaded by Claude Code at session start via CLAUDE.md.
Each skill is a reusable workflow. Cite the skill + spec section in every action.
Claude Code is the Mission Architect — not Cursor, not a custom framework.

---

## orchestrate-build
**Description:** Master workflow for advancing Mission Control OS through phases 0–5.
**Spec:** All sections.

**Workflow:**
1. Read MASTER-BUILD-PLAN.md — get phase, progress %, blockers
2. Read mission_architect.md — restore context and decisions
3. Report: Phase | Progress | Blockers | Next 3 tasks
4. Output ONE next action with spec citation
5. If work is parallelizable → spawn sub-agents via Agent tool
6. Run tests after every code change
7. Update MASTER-BUILD-PLAN.md on completion
8. Ask for approval before risky actions

**Never:** Auto-merge, deploy, call external APIs, or skip tests.

---

## build-cockpit-ui
**Description:** Build the React cockpit UI — dashboard, approval queue, execution log.
**Spec:** §5–6 (Cockpit + Approval Queue)
**Status:** NOT STARTED

**What to build:**
- `ui/pages/cockpit.tsx` — Mission list + create form + detail view
- `ui/components/TaskApprovalCard.tsx` — Approve/reject per task
- `ui/components/ExecutionLog.tsx` — Real-time execution output
- `ui/components/CostTracker.tsx` — Live cost vs. budget
- `ui/lib/api.ts` — Typed fetch wrapper for backend
- `ui/lib/types.ts` — TypeScript interfaces matching `backend/api/schemas.py`

**Tech:** Next.js 14, Tailwind, TypeScript, shadcn/ui
**API contract:** `backend/api/schemas.py` (MissionResponse, TaskDefinitionResponse, etc.)
**Polling:** Every 2s (WebSocket in Phase 2)
**Test target:** 75%+ component coverage

**Sub-agent pattern:**
> "You are the Frontend Builder. Build `ui/components/TaskApprovalCard.tsx`. It takes a `TaskDefinitionResponse` prop and renders approve/reject buttons. Calls `POST /api/missions/{id}/tasks/{tid}/approve`. Use Tailwind. TypeScript. Write Jest tests."

---

## build-integration-test
**Description:** Write and run the full Batman workflow integration test.
**Spec:** §3–8 (full lifecycle)
**Status:** NOT STARTED

**What to build:**
- `tests/integration/test_batman_workflow.py` — Full lifecycle test
- Create mission → verify tasks decomposed → approve all → execute → verify results + cost

**Mock:** DecomposerAgent (no real Claude calls in tests)
**Coverage target:** Full path through batman_graph, routes, supervisor, executor

---

## setup-postgres
**Description:** Replace in-memory stores with real Postgres via SQLAlchemy + Alembic.
**Spec:** §2 (Mission Object persistence), §8 (Audit log)
**Status:** Phase 2

**What to build:**
- `db/migrations/` — Alembic migration files
- Wire `backend/api/routes.py` to use `MissionService` with real DB
- Wire `backend/services/memory_service.py` to use `MemoryEntry` ORM model
- Wire `backend/services/cost_service.py` to persist cost records

---

## implement-reviewer-agents
**Description:** Add QA, Rights, Booking, and Promo reviewer agents.
**Spec:** §11 (Reviewer agents)
**Status:** Phase 2

**What to build:**
- `backend/agents/reviewers/code_reviewer.py`
- `backend/agents/reviewers/rights_reviewer.py`
- `backend/agents/reviewers/booking_reviewer.py`
- `backend/agents/reviewers/promo_reviewer.py`
- Each reviews task output before it's marked complete
- Reviewer agents call Claude with domain-specific prompts

---

## setup-jarvis-mode
**Description:** Implement Jarvis Mode — command-execute, no approval required.
**Spec:** §9 (Jarvis mode)
**Status:** Phase 3

**Key difference from Batman:** No approval gate. Tasks execute immediately after decomposition.
**Reuse:** ~80% of Batman code. Only `_await_approval_node` and routing changes.
**Safety:** Still has cost limits, loop detection, and audit logging.

---

## setup-wakanda-mode
**Description:** Implement Wakanda Mode — mixed approval (selective per risk level).
**Spec:** §10 (Wakanda mode)
**Status:** Phase 3

**Logic:** risk_level=low → auto-execute. risk_level=medium|high → require approval.
**Reuse:** Batman + Jarvis patterns merged with conditional routing.

---

## implement-abac-full
**Description:** Full ABAC policy engine — role-based tool access, resource scoping.
**Spec:** §12–14 (ABAC + memory scoping)
**Status:** Phase 4

**What to build:**
- `backend/abac/engine.py` — Policy evaluation
- `backend/abac/rules.py` — Role + resource definitions per mode
- `backend/abac/middleware.py` — FastAPI middleware
- Enforce at tool call level, not just route level

---

## Notes

- Every skill must cite the spec section it implements
- No skill auto-merges or deploys — always ask for approval first
- Sub-agents run via the Claude Code Agent tool, not external frameworks
- Tests must pass before any task is marked complete
- Update MASTER-BUILD-PLAN.md after every task
