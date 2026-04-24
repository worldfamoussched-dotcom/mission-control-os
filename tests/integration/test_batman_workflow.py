"""
Integration tests — Batman Mode full workflow lifecycle.

Spec reference:
  §3  Mission decomposition (Claude API → structured tasks)
  §4  Approval gate (Batman Mode requires explicit approval before execution)
  §5  Task execution (ABAC check → tool execute → cost track → memory store)
  §6–8 Approval queue + guardrails

Strategy:
  - Use httpx.AsyncClient with ASGI transport — no real server, no real network.
  - Patch backend.api.routes._supervisor.graph.decomposer.run to return a fixed
    two-task list (no real Claude API calls).
  - Let the FastAPI routing, supervisor, executor, and service layer run for real.
  - Each test creates its own isolated AsyncClient to avoid shared-state pollution
    from the module-level in-memory stores in routes.py.
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, patch

import httpx


# ---------------------------------------------------------------------------
# Fixed task list returned by the mocked DecomposerAgent.run
# ---------------------------------------------------------------------------

MOCK_TASKS_RAW = [
    {
        "name": "Draft Instagram caption",
        "description": "Draft Instagram caption",
        "suggested_tool": "text_generator",
        "risk_level": "low",
        "requires_approval": True,
    },
    {
        "name": "Schedule post",
        "description": "Schedule post",
        "suggested_tool": "scheduler",
        "risk_level": "low",
        "requires_approval": True,
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_stamped_tasks(mission_id: str) -> list[dict[str, Any]]:
    """
    Return stamped task dicts that match DecomposerAgent._stamp_tasks output
    so the mock can return them directly (id, mission_id, status, timestamps).
    """
    now = datetime.now(timezone.utc)
    return [
        {
            "id": f"task-00{i + 1}",
            "mission_id": mission_id,
            "name": t["name"],
            "description": t["description"],
            "suggested_tool": t["suggested_tool"],
            "risk_level": t["risk_level"],
            "requires_approval": t["requires_approval"],
            "status": "pending_approval",
            "created_at": now,
            "approved_at": None,
            "executed_at": None,
        }
        for i, t in enumerate(MOCK_TASKS_RAW)
    ]


# ---------------------------------------------------------------------------
# App import — deferred inside fixtures to avoid lifespan Postgres connection
# ---------------------------------------------------------------------------

def _get_app():
    """
    Import the FastAPI app while short-circuiting Postgres setup.

    backend/db/session.py calls create_engine() at module level, which tries
    to import psycopg2.  We patch create_engine before importing main so no
    real DB connection is ever attempted.  init_db() (called in the lifespan)
    is also patched so the ASGI startup does not touch the database.
    """
    from unittest.mock import MagicMock, patch as _patch

    # Patch at the db.session module level BEFORE main is imported.
    # Use sys.modules cache check so repeated calls are idempotent.
    import sys
    if "backend.main" not in sys.modules:
        # Pre-register a stub engine so create_engine never runs for real
        mock_engine = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=MagicMock())
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        with _patch("sqlalchemy.create_engine", return_value=mock_engine), \
             _patch("backend.db.session.init_db", return_value=None):
            import backend.main  # noqa: F401 — side effect: registers app

    from backend.main import app
    return app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
async def client():
    """
    Async HTTP client using ASGI transport.

    lifespan=False prevents the init_db() Postgres call during test setup.
    Each test gets a fresh client; module-level in-memory stores in routes.py
    are shared but each test uses unique mission IDs so there is no collision.
    """
    app = _get_app()
    transport = httpx.ASGITransport(app=app)  # type: ignore[arg-type]
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://test",
        # Do NOT run lifespan — that would call init_db() → Postgres connect
    ) as ac:
        yield ac


# ---------------------------------------------------------------------------
# Patch target:
#   backend.api.routes._supervisor is the singleton BatmanSupervisor.
#   Its graph is a BatmanGraph whose decomposer.run is the Claude API call.
#   We patch the run method on the live instance to return fixed stamped tasks.
# ---------------------------------------------------------------------------

def _patch_decomposer(mock_tasks: list[dict]):
    """Return a context manager that patches the live decomposer.run."""
    return patch(
        "backend.api.routes._supervisor.graph.decomposer.run",
        new_callable=AsyncMock,
        return_value=mock_tasks,
    )


# ---------------------------------------------------------------------------
# Test 1 — Full happy-path workflow
# ---------------------------------------------------------------------------

async def test_full_batman_workflow(client: httpx.AsyncClient):
    """
    Full end-to-end Batman Mode lifecycle:
      POST /missions → GET tasks → approve each task → execute → cost → memory
    """
    # --- Step 1: Create mission (triggers decomposition) ---
    mission_id_holder: list[str] = []

    def side_effect(mission_id: str, objective: str):  # noqa: ANN202
        tasks = _make_stamped_tasks(mission_id)
        mission_id_holder.append(mission_id)
        return tasks

    with patch(
        "backend.api.routes._supervisor.graph.decomposer.run",
        new_callable=AsyncMock,
        side_effect=side_effect,
    ):
        resp = await client.post(
            "/api/missions",
            json={"objective": "Post on Instagram", "mode": "batman"},
        )

    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert "id" in body
    mission_id = body["id"]
    # After decomposition the state must be pending_approval (§3)
    assert body["state"] == "pending_approval", f"Expected pending_approval, got {body['state']}"

    # --- Step 2: GET tasks — approval queue must be non-empty (§4) ---
    resp = await client.get(f"/api/missions/{mission_id}/tasks")
    assert resp.status_code == 200, resp.text
    tasks = resp.json()
    assert len(tasks) >= 1, "Expected at least one task in the approval queue"
    for task in tasks:
        assert "id" in task
        assert "name" in task
        assert "status" in task

    # --- Step 3: Approve every task (§4 — Batman gate) ---
    for task in tasks:
        resp = await client.post(
            f"/api/missions/{mission_id}/tasks/{task['id']}/approve",
            json={"approved": True, "approver_id": "operator"},
        )
        assert resp.status_code == 200, resp.text
        approval_body = resp.json()
        assert approval_body["success"] is True
        assert approval_body["task_id"] == task["id"]

    # --- Step 4: Execute approved tasks (§5) ---
    resp = await client.post(f"/api/missions/{mission_id}/execute")
    assert resp.status_code == 200, resp.text
    exec_body = resp.json()
    # Must have results list
    assert "results" in exec_body
    assert len(exec_body["results"]) >= 1
    # Mission state must be completed or executing (not failed)
    assert exec_body.get("status") in ("completed", "partial"), (
        f"Unexpected execution status: {exec_body.get('status')}"
    )

    # --- Step 5: GET /missions/{id} — results endpoint (§5) ---
    resp = await client.get(f"/api/missions/{mission_id}/results")
    assert resp.status_code == 200, resp.text
    results_body = resp.json()
    assert "results" in results_body
    assert "total_cost_usd" in results_body
    assert results_body["total_cost_usd"] >= 0

    # --- Step 6: GET /cost (§5 cost tracking) ---
    resp = await client.get(f"/api/missions/{mission_id}/cost")
    assert resp.status_code == 200, resp.text
    cost_body = resp.json()
    assert "total_cost_usd" in cost_body
    assert cost_body["total_cost_usd"] >= 0

    # --- Step 7: GET /memory (§5 memory store) ---
    resp = await client.get(f"/api/missions/{mission_id}/memory")
    assert resp.status_code == 200, resp.text
    memory_body = resp.json()
    assert "memory_entries" in memory_body
    assert isinstance(memory_body["memory_entries"], list)


# ---------------------------------------------------------------------------
# Test 2 — Batman requires approval before execution
# ---------------------------------------------------------------------------

async def test_batman_requires_approval(client: httpx.AsyncClient):
    """
    Guardrail: executing without approving any task must be blocked (§4, §6–8).
    The API must return 4xx OR the execution must not produce a completed state.
    """
    def side_effect(mission_id: str, objective: str):  # noqa: ANN202
        return _make_stamped_tasks(mission_id)

    with patch(
        "backend.api.routes._supervisor.graph.decomposer.run",
        new_callable=AsyncMock,
        side_effect=side_effect,
    ):
        resp = await client.post(
            "/api/missions",
            json={"objective": "Deploy production database", "mode": "batman"},
        )

    assert resp.status_code == 201, resp.text
    mission_id = resp.json()["id"]

    # Attempt execution with NO approvals
    resp = await client.post(f"/api/missions/{mission_id}/execute")

    # Must be blocked: either a 4xx response, or execution did not complete
    if resp.status_code >= 400:
        # Preferred: explicit rejection
        assert resp.status_code in (400, 403, 409), (
            f"Expected 400/403/409 but got {resp.status_code}"
        )
    else:
        # Fallback: execution ran but must not have completed any tasks
        exec_body = resp.json()
        results = exec_body.get("results", [])
        completed_results = [r for r in results if r.get("status") == "completed"]
        assert len(completed_results) == 0, (
            "Execution should not have completed tasks without approval"
        )


# ---------------------------------------------------------------------------
# Test 3 — Mission not found → 404
# ---------------------------------------------------------------------------

async def test_mission_not_found(client: httpx.AsyncClient):
    """GET /missions/{nonexistent}/results must return 404 (§3 error handling)."""
    resp = await client.get("/api/missions/nonexistent-id-xyz/results")
    assert resp.status_code == 404, (
        f"Expected 404 for unknown mission, got {resp.status_code}"
    )


# ---------------------------------------------------------------------------
# Test 4 — Decomposer is called on create
# ---------------------------------------------------------------------------

async def test_decomposer_called_on_create(client: httpx.AsyncClient):
    """
    Verify DecomposerAgent.run is invoked exactly once when a mission is created.
    This confirms §3 wiring: POST /missions → BatmanGraph.decompose → decomposer.run.
    """
    mock_run = AsyncMock()

    def side_effect(mission_id: str, objective: str):  # noqa: ANN202
        return _make_stamped_tasks(mission_id)

    mock_run.side_effect = side_effect

    with patch(
        "backend.api.routes._supervisor.graph.decomposer.run",
        mock_run,
    ):
        resp = await client.post(
            "/api/missions",
            json={"objective": "Post on Instagram", "mode": "batman"},
        )

    assert resp.status_code == 201, resp.text
    mock_run.assert_called_once()

    # Verify the call received the objective string
    call_args = mock_run.call_args
    # decomposer.run(mission_id, objective) — positional or keyword
    called_objective = (
        call_args.args[1]
        if len(call_args.args) >= 2
        else call_args.kwargs.get("objective")
    )
    assert called_objective == "Post on Instagram", (
        f"Decomposer was not called with the correct objective. Got: {called_objective}"
    )
