# Mission Architect — Persistent Memory Vault

## Identity

I am the **Mission Architect Agent** — the single, persistent orchestrator for Mission Control OS.

I was instantiated by Nick London to build a multi-agent OS with three modes:
- **Batman Mode** — Vampire Sex / London X artist command center (approval-gated)
- **Jarvis Mode** — Fractal Web Solutions dev agency command center (command-execute, no approval)
- **Wakanda Mode** — ATS / All the Smoke label command center (mixed / selective approval)

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

### Phase 2 — Reviewer Agents + Guardrails — 98% (ABAC consolidation cleanup deferred)
### Phase 3 — ACTIVE (Jarvis & Wakanda Modes) ~95%
- ReviewGate + CostAlertService wired into BatmanGraph
- `review_tasks` node runs before `execute_task`; blocks on any failing reviewer
- Cost alerts fire from `_execute_task_node` with hysteresis
- **Per-mission ABAC policy** — `Mission.abac_policy` field, plumbed API → Supervisor → ReviewGate
- **Total: 127/127 passing**
- **UI:** Next.js 14.2.35 scaffold complete, `npx tsc --noEmit` green, typed api client, cockpit surfaces ReviewPanel + AlertsPanel (Batman cockpit only — Jarvis/Wakanda UI not yet built)
- **Persistence:** `AuditService` writes review verdicts + cost alerts. SQLite-in-memory for tests, Postgres in prod (DATABASE_URL). Best-effort writes — workflow continues if persistence fails.
- **End-to-end smoke:** Phase 2 cockpit-bound endpoints all verified through ASGI transport (no live keys, no Postgres). Happy path + injection block both green.

### Phase 3 — All three modes shipped
- **Jarvis** (commit `8deab03`) — single-shot run_mission, no approval gate. Fractal Web Solutions.
- **Wakanda** (this commit) — `GateClassifier` + `WakandaSupervisor` + 2 new routes. ATS / All the Smoke. Conservative defaults locked: gate-when-unsure, single operator, no cascade on reject. High-risk safety floor cannot be downgraded by `always_pass` overrides.

### Cockpit brand-aware mode switcher — Just Landed
- Brand picker replaces mode dropdown (VS/LX, Fractal, ATS)
- Per-brand color theme + per-brand operator hint
- `handleLaunch` + `handleApprove`/`handleReject` branch per mode
- Approval queue conditional (Batman + Wakanda when gated tasks exist)
- Single contextual status: "Waiting on you — N to review" / "Running…" / "Done"
- TS clean

### Remaining
- Tailwind install in ui/ (cockpit classes won't render styled without it)
- UI unit tests (Vitest scaffold)
- Wakanda-specific tool registry entries (when ATS workflow surfaces concrete needs)
- Multi-approver chain (Phase 4)
- **Resonance OS integration** — Nick raised at session close, not yet specced. Memory: `resonance_os_integration_pending.md`

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
- [2026-04-24] DECIDED: AuditService takes a `session_factory` callable instead of holding a session directly. Lets tests inject SQLite in-memory and prod inject `SessionLocal` without subclassing. Persistence writes are best-effort (try/except, log nothing) so a transient DB hiccup never breaks a live mission — separate observability concern.
- [2026-04-24] Phase 2 demo strategy: do NOT run a live smoke against the real Anthropic API or a real Postgres instance. Two reasons: (1) hard-boundary on financial actions — calling Anthropic costs money + sends mission objectives to a third party, requires per-call approval; (2) Postgres isn't running locally. SOLUTION: ASGI-transport smoke test inside pytest that uses the mocked decomposer pattern from `test_batman_workflow.py`. Same fidelity as a live curl loop, none of the side effects.
- [2026-04-24] CORRECTED mode-to-business mapping at Phase 3 entry. Prior identity section had **Jarvis = ATS / All the Smoke** (wrong) and **Wakanda = Fractal Web Solutions** (wrong). Confirmed by Nick: **Jarvis = Fractal Web Solutions** (dev agency, command-execute fits the dev shop workflow), **Wakanda = ATS / All the Smoke** (label, mixed approval fits release vs. metadata distinction). Identity section updated. Persisted to memory as `mode_business_mapping.md` so future sessions can't re-drift on this.
- [2026-04-24] Found pre-existing tool registry inconsistency: `summarizer`, `text_generator`, `scheduler`, `search` are in CodeReviewer's allow-list AND in the SecurityReviewer ABAC defaults, but NOT in the ToolService tool registry. So a task using any of those passes review but gets blocked at the executor's `can_execute` check. Worked around in tests by using only `read_file` + `search_knowledge` (which are in both). PROPER FIX: tool_service ↔ review_gate consolidation (Phase 2 cleanup, deferred).
- [2026-04-24] Found bug: `create_mission` was unconditionally calling Batman's decomposer for ALL modes, including Jarvis. For Jarvis missions this wasted a Claude call at create time, stored orphan unapproved tasks, and put the mission in PENDING_APPROVAL state inappropriately. FIX: branched create_mission on mode — Jarvis skips create-time decomposition; decompose happens inside `/run`.
- [2026-04-24] Same fix extended to Wakanda — `create_mission` now skips create-time decomposition for BOTH Jarvis AND Wakanda. Decomposition happens inside `/run-wakanda` so the GateClassifier can process tasks fresh.
- [2026-04-24] Reviewer normalization: in `WakandaSupervisor._review_and_execute`, `suggested_tool` is normalized to `tool` before passing to ReviewGate. Without this, reviewers reading `task.get("tool", "")` see empty string and the SecurityReviewer blocks every task. Same shape used in `BatmanGraph._review_tasks_node`. Should probably be lifted to the ReviewGate itself in a future cleanup so every supervisor doesn't have to remember.
