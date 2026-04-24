# Mission Control OS Build Skills

## orchestrate-build
**Description:** Master workflow for advancing the Mission Control OS project through phases 0–5.

**When to use:** Every time we need to advance the build plan, create files, spawn sub-agents, or move to the next approval gate.

**Workflow:**
1. Check MASTER-BUILD-PLAN.md for current phase, progress %, and blockers
2. If parallel work is needed, create a git worktree for the sub-agent
3. Generate exact files/code with line citations to the spec
4. Run tests/linting only after human review (never auto-merge)
5. Update MASTER-BUILD-PLAN.md with progress
6. Output ONE next action with spec citation
7. Ask for explicit approval before any risky action (merge, deploy, external API)

**Example:** "Start Phase 0. Create Pydantic Mission Object model exactly as defined in spec section 2."

---

## create-mission-object
**Description:** Generate the foundational Pydantic Mission Object model + DB schema + validation rules.

**When to use:** Phase 0, after approval of spec section 1–2.

**What it produces:**
- `backend/models/mission.py` — Mission dataclass with fields: id, mode, parent_id, state, approvers, memory_scope, cost_tracked, created_at, audit_log
- `db/schema.sql` — Mission table with proper indices and constraints
- `backend/validators.py` — Validation rules (mode enum, ABAC checks)
- Tests in `tests/test_mission.py`

**Citations:** Spec section 1–2 (Mission Object definition)

---

## setup-langgraph
**Description:** Create the initial LangGraph StateGraph for Batman Mode Lead Agent.

**When to use:** Phase 1, after Mission Object is approved.

**What it produces:**
- `backend/agents/batman.py` — StateGraph definition with nodes: analyze, decide, execute, review
- `backend/agents/state.py` — AgentState Pydantic model
- `backend/agents/tools.py` — Tool invocations from the tool registry

**Citations:** Spec section 3–5 (Batman mode flow)

---

## setup-approval-queue
**Description:** Create the approval queue + audit log infrastructure.

**When to use:** Phase 1, after LangGraph is set up.

**What it produces:**
- `db/migrations/002_approval_queue.sql` — ApprovalRequest + AuditLog tables
- `backend/approval.py` — ApprovalQueue class with store/retrieve/mark_approved logic
- `backend/audit.py` — AuditLog class with immutable logging

**Citations:** Spec section 6–8 (Approval queue + guardrails)

---

## build-cockpit-ui
**Description:** Generate React cockpit UI (dashboard, mission list, approval queue view).

**When to use:** Phase 1, in parallel with backend work.

**What it produces:**
- `ui/pages/cockpit.tsx` — Main dashboard with mission list + live approvals
- `ui/components/MissionCard.tsx` — Individual mission display
- `ui/components/ApprovalQueue.tsx` — Pending approvals
- Tailwind styling + TypeScript types

**Citations:** Spec section 5–6 (Cockpit UI)

---

## implement-abac
**Description:** Build the full ABAC engine (role-based tool access, resource scoping).

**When to use:** Phase 4, after Batman/Jarvis/Wakanda modes are complete.

**What it produces:**
- `backend/abac/engine.py` — ABAC enforcement
- `backend/abac/rules.py` — Role + resource definitions
- `backend/abac/middleware.py` — FastAPI middleware for access control
- Tests in `tests/test_abac.py`

**Citations:** Spec section 12–14 (ABAC + memory scoping)

---

## Notes
- Each skill is independently testable
- All skills must cite the spec section they implement
- No skill should auto-merge or deploy — always ask for approval first
- Worktrees are automatically cleaned up after sub-agent finishes
