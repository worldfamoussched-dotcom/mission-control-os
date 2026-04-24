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

## Status

**Current:** Phase 0 Step 1 complete (25%)
- ✅ Mission Object schema
- ✅ Unit tests (16 passing)
- ✅ Database schema
- ⏳ Phase 0 Step 2 — folder structure
