# Mission Control OS — Architecture & Design Principles

**Status:** Phase 0 Complete → Phase 1 (Batman Mode MVP) Ready

**Purpose:** Bridge Grok research (17-section design) with Phase 1 spec (implementation roadmap).

---

## 10 Core Pillars → Phase 1 Files

### 1. Hierarchical Orchestration (LangGraph)
- `backend/agents/batman_lead.py` — Mission supervisor
- `backend/agents/batman_graph.py` — LangGraph StateGraph

### 2. Mission Object (Source of Truth)  
- `backend/models/mission.py` — Mission class + AuditLogEntry
- `backend/db/models.py` — ORM + missions table

### 3. ABAC + Least Privilege
- `backend/models/mission.py` — ToolRegistry, ABACEngine (Phase 0)
- `backend/services/tool_service.py` — Permission checks
- `backend/agents/tool_wrapper.py` — Safe execution

### 4. Agent Cockpit (Real-Time Visibility)
- `ui/pages/dashboard.tsx` — Main cockpit
- `ui/components/MissionGraph.tsx` — Graph visualization
- `ui/components/CostTracker.tsx` — Real-time cost
- `ui/pages/api/webhooks.ts` — WebSocket updates

### 5. Approval Queue (Human-in-the-Loop)
- `backend/agents/batman_graph.py` — interrupt_before nodes
- `backend/api/routes.py` — Approval endpoints
- `ui/components/ApprovalQueue.tsx` — Queue UI

### 6. Scoped Memory (No Cross-Mode Leakage)
- `backend/services/memory_service.py` — Scoped queries
- `backend/db/models.py` — memory_entries table

### 7. Structured Handoffs (No Chat)
- `backend/models/mission.py` — HandoffPacket, TaskDefinition
- `backend/services/lock_service.py` — Resource locks
- `backend/agents/batman_graph.py` — Edge conditions

### 8. Audit Log + Replay
- `backend/db/schema.sql` — immutable audit_logs
- `backend/api/routes.py` — Replay endpoint
- `backend/services/replay_service.py` — Load + execute

### 9. Cost & Token Guardrails
- `backend/services/execution_service.py` — Loop/duplicate detection
- `backend/services/cost_service.py` — USD conversion + mission caps

### 10. Failure Handling & Escalation
- `backend/agents/batman_graph.py` — max_iterations per node
- `backend/agents/batman_lead.py` — Escalation logic
- `backend/services/mission_service.py` — freeze_mission()

---

## Tech Stack

- **Orchestration:** LangGraph + FastAPI
- **Database:** Postgres + PGVector + Redis
- **Frontend:** React + Next.js + Tailwind
- **Meta-Orchestrator:** Mission Architect Agent (Cursor 3)

---

## Build Next

Mission Architect Agent (Cursor 3) orchestrates Phase 1:
1. System prompt enforces this architecture
2. Skill: `orchestrate-build` — reusable workflows
3. Obsidian: MASTER-BUILD-PLAN.md — live tasks
4. Automation: Daily kickoff

**First command to Agent:**
> Start Phase 1. Create folder structure, pyproject.toml, FastAPI skeleton, LangGraph Batman Lead agent. Align with ARCHITECTURE.md + SPEC_PHASE1_BATMAN_MVP.md.
