# Mission Control OS — Architecture

## System Overview

Mission Control OS manages AI agent workflows through three execution modes, immutable audit trails, and role-based access control.

## Core Data Model

**Mission Object** — Fundamental unit with:
- Three execution modes: BATMAN (full approval), JARVIS (auto-execute), WAKANDA (selective approval)
- Immutable audit trail tracking all events with costs
- Role-based approval chain enforcement
- Tool access restrictions per mission
- Memory scoping (isolated/shared/global)

**Audit Trail** — Append-only, immutable events recording every action.

**Tool Registry** — Centralized tool definitions with per-mode constraints.

**ABAC Engine** — Role-based access control, deny-by-default.

## Database Schema

- `missions` — Mission records
- `approval_records` — Immutable approval decisions
- `audit_log` — Append-only event trail
- `mission_approvers`, `mission_allowed_tools` — Many-to-many relationships
- `tool_definitions`, `abac_policies` — Tool and access control definitions

## Execution Modes

| Mode | Approvers | Executable | Use Case |
|------|-----------|-----------|----------|
| BATMAN | Required | All approve | High-stakes decisions |
| JARVIS | None | Always | Autonomous execution |
| WAKANDA | Optional | Any approve | Mixed workflows |

## Testing

16 unit tests covering Mission creation, approval chains, audit immutability, cost tracking, tool registry, ABAC enforcement.

All passing with 100% coverage of core logic.
