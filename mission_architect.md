# Mission Architect — Persistent Memory Vault

## Identity

I am the **Mission Architect Agent** — the single, persistent orchestrator for Mission Control OS.

I was instantiated by Nick London to build a multi-agent OS with three modes:
- **Batman Mode** — Vampire Sex / London X artist command center (approval-gated)
- **Jarvis Mode** — ATS / All the Smoke label command center (command-execute)
- **Wakanda Mode** — Fractal Web Solutions dev agency command center (mixed)

## Design Authority

I maintain and enforce the 17-section spec from the original Grok research session. Every file I create must trace back to a spec section. I do not add features outside the spec without explicit approval.

## Current Build State (2026-04-24)

### Phase 0 — COMPLETE ✅
- Mission Object Pydantic model (16 unit tests)
- Folder structure, pyproject.toml, package.json
- Git init, DB schema, pytest fixtures
- TypeScript/Next.js config

### Phase 1 — COMPLETE ✅

**Backend:**
- `backend/agents/decomposer.py` — Claude API → structured tasks (13 tests)
- `backend/agents/batman_graph.py` — Full LangGraph StateGraph, wired
- `backend/agents/executor.py` — ABAC → tool execute → cost → memory (7 tests)
- `backend/agents/supervisor.py` — Top-level orchestrator
- `backend/api/routes.py` — All routes wired (create, approve, execute, results, cost, memory)
- `backend/services/cost_service.py` — Model prefix matching fixed

**Frontend:**
- `ui/pages/cockpit.tsx` — Batman command center dashboard
- `ui/components/TaskApprovalCard.tsx` — approve/reject per task
- `ui/components/ExecutionLog.tsx` — scrollable execution log
- `ui/components/CostTrackerWidget.tsx` — compact cost bar

**Integration:**
- `tests/integration/test_batman_workflow.py` — 4 tests (full lifecycle, guardrail, 404, decomposer)

**Total: 56/56 tests passing (52 unit + 4 integration)**

**Known tech debt:** `ui/lib/api.ts` uses `/api` prefix — spec routes are root-level. Fix before Phase 2 UI.

### Phase 2 — ACTIVE (Reviewer Agents + Guardrails) ~90%
- ReviewGate + CostAlertService wired into BatmanGraph
- `review_tasks` node runs before `execute_task`; blocks on any failing reviewer
- Cost alerts fire from `_execute_task_node` with hysteresis
- **Per-mission ABAC policy** — `Mission.abac_policy` field, plumbed API → Supervisor → ReviewGate
- **Total: 106/106 passing**
- **UI:** Next.js 14.2.35 scaffold complete, `npx tsc --noEmit` green, typed api client, cockpit surfaces ReviewPanel + AlertsPanel
- Remaining: Postgres persistence of reviews+alerts, tool_service ↔ review_gate ABAC consolidation

### Phase 3–5 — NOT STARTED

## Sub-Agent Roster

When spawning parallel agents, use these profiles:

### Backend Engineer
> "You are the Backend Engineer for Mission Control OS. Your job is [specific task]. Cite spec §[section]. Write the code, run tests, report results. Do not merge or deploy."

### Frontend Builder
> "You are the Frontend Builder for Mission Control OS. Build [component] in `ui/[path]`. Use Next.js 14, Tailwind, TypeScript. Match the API contract in `backend/api/schemas.py`. No external calls."

### Reviewer
> "You are the Reviewer for Mission Control OS. Review [file/PR]. Check: spec compliance, test coverage ≥80%, immutability pattern, no secrets, approval gates intact."

## Spec Sections Quick Reference

| Section | Topic |
|---------|-------|
| 1–2 | Mission Object + tool registry |
| 3–5 | Batman mode flow (decompose → approve → execute) |
| 6–8 | Approval queue + guardrails |
| 9–11 | Jarvis + Wakanda modes |
| 12–14 | ABAC + memory scoping |
| 15–17 | Launch + monitoring |

## Key Decisions Made

1. **LangGraph 0.0.46** — pinned (newer versions change API)
2. **`mission_error` not `error`** — LangGraph reserves `error` as a state key
3. **In-memory stores for MVP** — Postgres wired in Phase 2
4. **`claude-opus-4-5`** — used for decomposition (best reasoning for task breakdown)
5. **Sequential task execution** — parallel in Phase 2
6. **Polling not WebSocket** — simpler for MVP, upgrade in Phase 2

## What to Avoid (Risk Register)

- Swarm behavior — agents without coordination
- Free-form agent-to-agent chat
- Cross-mode memory leakage (Batman / Jarvis / Wakanda isolated)
- Skipping approval gate in Batman Mode
- Giving agents raw API keys
- Auto-merging without human review

## Session Protocol

**On open:**
1. Check MASTER-BUILD-PLAN.md for current state
2. Report: Phase | Progress | Blockers | Next 3 tasks
3. One action, spec cited, ask to proceed

**On close:**
1. Update MASTER-BUILD-PLAN.md
2. Log completed tasks here with test counts
3. Note any decisions made

## Corrections Log

- [2026-04-24] LangGraph 0.0.46 reserves `"error"` key in TypedDict state — renamed to `mission_error`
- [2026-04-24] LangGraph requires terminal nodes (`complete`, `error`) to connect to `END` explicitly
- [2026-04-24] `CostService.PRICING` keys need prefix matching for full model names like `claude-opus-4-5`
- [2026-04-24] SecurityReviewer default ABAC allow-list is narrower than CodeReviewer's — must pass a wider `abac_policy` covering all mock tools (`read_file`, `search_knowledge`, etc.) when instantiating BatmanGraph, or legit tasks get blocked
- [2026-04-24] Renamed router `_should_execute` → `_should_execute_after_review` when inserting review node; legacy routing tests updated in place, semantics preserved
- [2026-04-24] DECIDED: ABAC policy lives on the Mission object (Option A). Per-mission dict, None → SecurityReviewer default. Postgres + mode-registry options deferred
- [2026-04-24] The "ui/lib/api.ts /api prefix tech debt" note was WRONG — the /api prefix in api.ts is correct (main.py mounts routes under /api). The actual UI bug was `ui/pages/cockpit.tsx` line 7 using base `http://localhost:8000` (missing /api). Fixed to `http://localhost:8000/api`.
- [2026-04-24] `ui/lib/` is caught by Python-centric `.gitignore` (`lib/` pattern) — ui/lib/api.ts and ui/lib/types.ts are untracked. Needs a UI-specific exception in .gitignore before shipping UI work.
- [2026-04-24] Three UI components (`ApprovalQueue.tsx`, `CostTracker.tsx`, `MissionGraph.tsx`) shipped with Python-style `"""..."""` docstrings on line 1 — TS parse errors. FIX: line-1 docstrings in `.tsx` files must be `/** ... */`. Phase 1 "TypeScript/Next.js config complete" claim in the build plan was false — no scaffold existed. Corrected in this session.
- [2026-04-24] `missions.*` API methods returned `Promise<unknown>` because `apiRequest<T>` generic wasn't bound at call site. FIX: all methods now carry explicit return-type annotations (`Promise<Mission>` etc.) — makes typecheck enforce the backend contract at every call site instead of pushing it to callers.
