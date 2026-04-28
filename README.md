# Mission Control OS

AI-powered orchestration system with three execution modes: BATMAN (full approval chain), JARVIS (auto-execute), and WAKANDA (selective approval).

## Quick Start

### Prerequisites
- Python 3.9+
- PostgreSQL 13+

### Setup

```bash
# Clone and navigate
cd "Missipn Control Builder Agent"

# Install dependencies (includes dev/test tools)
python3 -m pip install -e '.[dev]'

# Run tests
python3 -m pytest tests/unit/test_mission.py -v

# Initialize database
psql -U postgres < db/schema.sql
```

## Architecture

### Core Models (spec sections 1–2)

- **Mission Object** — Fundamental unit of work with:
  - Three execution modes (BATMAN/JARVIS/WAKANDA)
  - Immutable audit trail
  - Cost tracking per event
  - Role-based approval chain
  - Memory scoping (isolated/shared/global)

- **Tool Registry** — Centralized tool definitions with:
  - Per-mode availability constraints
  - Cost limits per invocation
  - Approval requirements

- **ABAC Engine** — Attribute-Based Access Control:
  - Role-based policies
  - Resource-scoped permissions
  - Tool access enforcement

### Database (db/schema.sql)

- `missions` — Mission records with state, mode, costs
- `approval_records` — Immutable approval decisions
- `audit_log` — Append-only event trail
- `tool_definitions` — Available tools + constraints
- `abac_policies` — Access control policies

### Tests (tests/unit/test_mission.py)

16 unit tests covering:
- Mission creation + validation
- Approval chain logic (BATMAN/JARVIS/WAKANDA)
- Audit entry immutability
- Cost accumulation
- Tool registry mode checking
- ABAC policy enforcement

All passing with 100% coverage of core logic.

## Execution Modes

| Mode | Approvers | Approval Required | Use Case |
|------|-----------|-------------------|----------|
| **BATMAN** | Explicit list | All must approve | High-stakes decisions requiring full review |
| **JARVIS** | None | No | Autonomous execution, immediate action |
| **WAKANDA** | Explicit list | At least one | Mixed workflows, some pre-approved, some review |

## Build Phases

- **Phase 0** — Foundation (Mission Object, audit, ABAC)
- **Phase 1** — Batman Mode MVP (FastAPI, LangGraph, React UI)
- **Phase 2** — Reviewer Agents + Guardrails
- **Phase 3** — Jarvis & Wakanda Modes
- **Phase 4** — Memory Scoping & Full ABAC
- **Phase 5** — Polish & Launch

## Development

### Project Structure

```
.
├── backend/
│   ├── models/
│   │   └── mission.py          # Core Mission Object
│   ├── agents/                 # LangGraph agents (Phase 1+)
│   └── approval.py             # Approval queue (Phase 1+)
├── db/
│   ├── schema.sql              # Postgres DDL
│   └── migrations/             # Migration scripts
├── ui/                         # React cockpit (Phase 1+)
├── tests/
│   └── unit/
│       └── test_mission.py     # Mission Object tests
├── pyproject.toml              # Python dependencies
└── MASTER-BUILD-PLAN.md        # Phase tracking
```

### Testing

```bash
# Run all tests
python3 -m pytest tests/ -v

# With coverage
python3 -m pytest tests/ --cov=backend --cov-report=term-missing

# Specific test class
python3 -m pytest tests/unit/test_mission.py::TestApprovalChain -v
```

### Code Quality

```bash
# Format
black backend/ tests/

# Lint
ruff check backend/ tests/

# Type check
mypy backend/
```

## Spec Reference

Implementation follows the 17-section spec:
- **Sections 1–2:** Mission Object + tool registry ✅ Phase 0 complete
- **Sections 3–5:** Batman mode flow → Phase 1
- **Sections 6–8:** Approval queue + guardrails → Phase 1
- **Sections 9–11:** Jarvis + Wakanda modes → Phase 3
- **Sections 12–14:** ABAC + memory scoping → Phase 4
- **Sections 15–17:** Launch + monitoring → Phase 5

## Phase 1: Batman Mode MVP

**Starting Phase 1 — Approval-based execution workflow**

### What's New

- **FastAPI backend** with REST API for missions, tasks, approvals
- **LangGraph agents** (stubs) for mission decomposition and execution
- **React + Next.js UI** with components for approval queue and cost tracking
- **SQLAlchemy ORM** models for database persistence
- **Service layer** for mission, tool, cost, memory, and execution logic

### Phase 1 Setup

```bash
# Backend
python -m pip install -e '.[dev]'
python -m pytest tests/unit tests/integration -v --cov=backend
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Frontend
npm install
npm run dev  # Starts on localhost:3000

# Database
createdb mission_control_os
psql mission_control_os < db/schema.sql
alembic upgrade head  # When migrations added
```

### API Endpoints

- `POST /api/missions` — Create mission
- `GET /api/missions` — List missions
- `GET /api/missions/{id}` — Get mission details
- `POST /api/missions/{id}/tasks` — Create task
- `POST /api/missions/{id}/tasks/{id}/approve` — Approve/reject task
- `POST /api/missions/{id}/tasks/{id}/execute` — Execute approved task
- `GET /health` — Health check

### Success Criteria

- [ ] Operator creates mission with objective + approvers
- [ ] System decomposes into 3+ tasks
- [ ] Each task presented to operator for approval
- [ ] Tool executes ONLY after approval
- [ ] Real-time execution log + cost tracking visible
- [ ] All tests passing (80%+ coverage)
- [ ] No console errors in browser

## Status

**Current:** Phase 1 skeleton complete
- ✅ Folder structure (backend/api/services/agents/db, ui/components/pages/lib)
- ✅ FastAPI main.py with CORS, docs, health endpoint
- ✅ API schemas (Pydantic request/response models)
- ✅ API routes (missions, tasks, approvals, execution)
- ✅ Service layer (mission, tool, cost, memory, execution services)
- ✅ Database models (SQLAlchemy ORM)
- ✅ Agent stubs (BatmanLeadAgent, BatmanGraph, ToolWrapper)
- ✅ React components (MissionGraph, ApprovalQueue, CostTracker)
- ✅ Frontend hooks and types
- ✅ .env.example with all vars
- ⏳ Human review + tests execution
# oracle-os
