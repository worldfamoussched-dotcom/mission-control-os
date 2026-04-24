# Phase 1 Skeleton Mapping to 10 Core Pillars

**Commit:** `3fa5735` — Phase 1 skeleton complete

This document maps all Phase 1 files to the 10 core pillars from ARCHITECTURE.md.

---

## 1. Hierarchical Orchestration (LangGraph)

**Pillar:** Mission supervisor + state transitions

**Files:**
- `backend/agents/batman_lead.py` — Lead agent, orchestration entry point
- `backend/agents/batman_graph.py` — LangGraph StateGraph with nodes (decompose, await_approval, execute_task, complete, error)
- `backend/agents/__init__.py` — Agent module init

**Status:** Stubs complete, ready for agent implementation

---

## 2. Mission Object (Source of Truth)

**Pillar:** Mission as central data model + immutable audit trail

**Files:**
- `backend/models/mission.py` — Mission model (from Phase 0, extends for Phase 1)
- `backend/db/models.py` — SQLAlchemy ORM: Mission, Task, Execution, ApprovalRecord, AuditLog
- `backend/api/schemas.py` — Pydantic schemas for API (MissionResponse, TaskDefinitionResponse, ExecutionResult)

**Status:** ORM models complete with all Phase 1 entities

---

## 3. ABAC + Least Privilege

**Pillar:** Tool permission checks, attribute-based access control

**Files:**
- `backend/services/tool_service.py` — Tool registry, permission checks, constraint enforcement
- `backend/agents/tool_wrapper.py` — Safe tool execution wrapper with permission gates
- `backend/db/models.py` — ToolPermission table for storing per-mission tool constraints

**Status:** Foundation complete, ready for policy engine

---

## 4. Agent Cockpit (Real-Time Visibility)

**Pillar:** Operator dashboard with live status + cost tracking

**Files:**
- `ui/pages/dashboard.tsx` — Main cockpit page (mission list, create form, detail view)
- `ui/components/MissionGraph.tsx` — Task flow visualization
- `ui/components/CostTracker.tsx` — Real-time cost display + budget limits
- `ui/lib/api.ts` — API client wrapper for backend communication
- `ui/lib/types.ts` — TypeScript types for frontend

**Status:** Dashboard skeleton complete, ready for WebSocket updates

---

## 5. Approval Queue (Human-in-the-Loop)

**Pillar:** Operator approval interface, blocking execution until approved

**Files:**
- `ui/components/ApprovalQueue.tsx` — Task approval UI (approve/reject buttons, reasons)
- `backend/api/routes.py` — `/missions/{id}/tasks/{id}/approve` endpoint
- `backend/db/models.py` — ApprovalRecord ORM model

**Status:** UI and endpoints complete, ready for state management integration

---

## 6. Scoped Memory (No Cross-Mode Leakage)

**Pillar:** Per-mission memory isolation, visibility levels

**Files:**
- `backend/services/memory_service.py` — Mission-scoped memory store (key-value, visibility levels)
- `backend/db/models.py` — MemoryEntry table for persistent memory

**Status:** Service layer complete, ready for integration into agents

---

## 7. Structured Handoffs (No Chat)

**Pillar:** Explicit task/tool definitions, no agent-to-agent chat

**Files:**
- `backend/api/schemas.py` — TaskDefinitionResponse, ExecuteTaskRequest for explicit handoffs
- `backend/db/models.py` — Task, Execution tables with structured fields

**Status:** Schema complete, ready for agent graph integration

---

## 8. Audit Log + Replay

**Pillar:** Immutable audit trail, replay capability

**Files:**
- `backend/db/models.py` — AuditLog table (event_type, actor, details, timestamp)
- `backend/api/routes.py` — Stub endpoints for audit retrieval
- `backend/services/execution_service.py` — Execution tracking (will feed into audit)

**Status:** ORM model complete, endpoints and replay logic ready for Phase 2

---

## 9. Cost & Token Guardrails

**Pillar:** Token counting, cost limits, loop/duplicate prevention

**Files:**
- `backend/services/cost_service.py` — Cost estimation (Anthropic pricing), tracking, limit checks
- `backend/services/execution_service.py` — Execution history, duplicate detection, max iteration checks
- `backend/api/schemas.py` — ExecutionResult with cost_usd field
- `ui/components/CostTracker.tsx` — Cost display with budget alerts

**Status:** Cost service + detection complete, ready for LLM token counting

---

## 10. Failure Handling & Escalation

**Pillar:** Max iterations, escalation, mission freeze

**Files:**
- `backend/agents/batman_graph.py` — Error node, max iterations check, escalation routing
- `backend/services/mission_service.py` — freeze_mission() method
- `backend/db/models.py` — Mission state includes FROZEN status
- `backend/agents/batman_lead.py` — escalate() method for human escalation

**Status:** Stubs complete, ready for integration into agent graph

---

## File Tree (Phase 1 Complete)

```
backend/
├── main.py                              # FastAPI entry point
├── agents/
│   ├── batman_lead.py                   # Pillar 1: Lead agent
│   ├── batman_graph.py                  # Pillar 1: State graph
│   ├── tool_wrapper.py                  # Pillar 3: Safe execution
│   └── __init__.py
├── api/
│   ├── routes.py                        # Pillar 2, 5, 8: Endpoints
│   ├── schemas.py                       # Pillar 2, 5, 7, 9: Data models
│   └── __init__.py
├── services/
│   ├── mission_service.py               # Pillar 2, 10: Mission logic
│   ├── tool_service.py                  # Pillar 3: Permissions
│   ├── cost_service.py                  # Pillar 9: Cost tracking
│   ├── memory_service.py                # Pillar 6: Scoped memory
│   ├── execution_service.py             # Pillar 8, 9, 10: Execution
│   └── __init__.py
├── db/
│   ├── models.py                        # Pillar 2, 3, 5, 6, 8, 10: ORM
│   ├── session.py                       # Database session factory
│   └── __init__.py
├── models/
│   └── mission.py                       # Pillar 2: Mission (Phase 0)
├── approval.py                          # Phase 0 approval logic
└── __init__.py

ui/
├── pages/
│   └── dashboard.tsx                    # Pillar 4: Cockpit
├── components/
│   ├── MissionGraph.tsx                 # Pillar 4: Flow viz
│   ├── ApprovalQueue.tsx                # Pillar 5: Approval UI
│   └── CostTracker.tsx                  # Pillar 9: Cost display
├── lib/
│   ├── api.ts                           # Pillar 4: API client
│   └── types.ts                         # Pillar 4: TS types
└── __init__.py

tests/
├── unit/
│   ├── test_mission_service.py          # Service tests
│   └── __init__.py
├── integration/
│   ├── test_batman_workflow.py          # End-to-end tests
│   └── __init__.py
└── __init__.py

docs/
├── PHASE1_SKELETON_MAPPING.md           # This file
├── SPEC_PHASE1_BATMAN_MVP.md            # Phase 1 spec
└── ARCHITECTURE.md                      # 10 pillars

.env.example                             # Environment vars
README.md                                # Setup instructions (updated)
pyproject.toml                           # Python deps (updated)
package.json                             # Node deps (from Phase 0)
```

---

## Next Steps

### Phase 1 (Batman Mode MVP)

1. **Implement agents:** Connect BatmanLeadAgent → LangGraph → Claude API
2. **Database setup:** Create Postgres tables, run migrations
3. **API testing:** Unit + integration tests (80%+ coverage)
4. **Frontend integration:** Connect dashboard to API, real-time updates (polling/WebSocket)
5. **Full workflow test:** Create mission → approve → execute → verify audit trail
6. **Deployment:** Docker + docker-compose

### Phase 2 (Reviewer Agents)

- Implement specialized agents (code review, memory check, security)
- Add ABAC policy engine
- Cost tracking with real token counts

### Phase 3 (Jarvis & Wakanda)

- Implement Jarvis mode (no approval)
- Implement Wakanda mode (selective approval)
- Mode switching logic

---

**Skeleton Status:** ✅ Complete (25 files + docs)
**Commit:** `3fa5735`
**Ready for:** Human review + test execution
