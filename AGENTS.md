# Oracle OS / Fractal Memory Project Instructions

These instructions apply to `/Users/Malachi/Missipn Control Builder Agent`.

## Project Purpose

Mission Control OS is an orchestration system with Batman, Jarvis, and Wakanda execution modes, plus Fractal Memory as the long-term memory architecture.
This file is the repo constitution only. Keep detailed phase plans, session memory, and implementation notes in `docs/`, `current.md`, and other project memory files.

## Known Paths

- `ui/` — Next.js cockpit UI
- `backend/` — FastAPI, supervisors, services, API routes
- `tests/` — backend and integration test coverage
- `db/` — schema and database assets
- `docs/` — architecture, specs, phase plans, acceptance criteria
- `MASTER-BUILD-PLAN.md` — phase tracking and approval gates
- `current.md` — current session state and carry-forward context
- `CLAUDE.md` — legacy/session-specific orchestration instructions to mine selectively, not copy wholesale
- `ui/next-env.d.ts` may appear as a pre-existing generated dirty file. Do not treat it as part of an instruction-file task unless explicitly asked.

## Required Session-Open Checks

Before implementation:
1. `pwd`
2. `git status --short`
3. `git branch --show-current`
4. Inspect relevant files before editing
5. Read `MASTER-BUILD-PLAN.md` and `current.md`
6. Read only the specific docs needed for the task
7. Confirm whether the task belongs to the current phase before building

## Build And Test Commands

Prefer the narrowest command that proves the change.

- Backend tests: `python3 -m pytest tests/ -v`
- Backend targeted tests: `python3 -m pytest tests/unit -v` or `python3 -m pytest tests/integration -v`
- UI type check: `npm --prefix ui run typecheck`
- UI tests: `npm --prefix ui test`
- UI build: `npm --prefix ui run build`

If a change spans backend and UI contracts, run the relevant backend tests plus UI typecheck and UI build before claiming success.

## Phase-Gate Rules

- Respect phase gates in `MASTER-BUILD-PLAN.md`.
- Complete one phase or stage at a time.
- Do not start the next phase just because code could be written.
- Treat Phase 4 entry and any major scope expansion as approval-gated.
- Keep large phase plans, acceptance criteria, and implementation sequencing in `docs/`, not in this file.

## Working Rules

- Do not expand the UI beyond the current approved scope unless explicitly authorized.
- Prefer pure TypeScript contracts and tests before wiring new UI or backend behavior.
- Keep architecture, memory, retrieval, UI, and integrations clearly separated.
- Favor small, reversible changes over broad rewrites.
- Read first, then edit. Merge carefully if docs or code changed in parallel.

## Safety Constraints

- Do not edit source code unless explicitly asked.
- Do not mutate immutable source directories or frozen source materials.
- Do not touch `.env*`, `.next/`, `node_modules/`, caches, logs, or build artifacts.
- Do not add real external integrations, production secrets, database migrations, or vector DB implementation unless explicitly authorized.
- Do not overwrite instruction files without a timestamped backup first.
- Do not edit `current.md` unless explicitly instructed; read it for context only.
- Stop and report the exact failure if a build, test, or verification step fails.

## Done Criteria

A task is done only when:
- the requested scope is complete
- the relevant tests have been run
- the relevant UI typecheck/build commands have been run when applicable
- phase-gate constraints were respected
- only intended files were changed
- git status was checked after the work
- risks, blockers, or unresolved issues were reported clearly
