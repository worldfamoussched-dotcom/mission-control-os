# Mission Control OS — Master Build Plan

**Current Phase:** 1 (Batman Mode MVP)
**Progress:** 0% of Phase 1 (Phase 0 complete: 100%)
**Active Worktrees:** none
**Blockers:** none
**Next Approval Gate:** FastAPI backend + LangGraph agents (Phase 1 Step 1)

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
- [ ] FastAPI + LangGraph backend
- [ ] Postgres checkpointer + audit logs
- [ ] React cockpit UI
- [ ] Basic approval queue

### Key Files (TBD after Phase 0 approval)
- `backend/agents/batman.py` — Lead agent
- `db/schema.sql` — Mission, Task, AuditLog tables
- `ui/pages/cockpit.tsx` — Main dashboard

---

## Phase 2 — Reviewer Agents + Guardrails (Weeks 6–7)

### Objectives
- [ ] Implement Reviewer Agents (code, memory, security)
- [ ] ABAC enforcement at all decision points
- [ ] Cost tracking + alerts

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

**Last Updated:** 2026-04-24
**Maintained By:** Mission Architect Agent
