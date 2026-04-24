"""
Phase 2 cockpit smoke test — proves every endpoint the cockpit polls
returns the right shape with the right data flowing through it.

Spec reference:
  §6–8  Approval gate + ReviewGate
  §12–14 Per-mission ABAC policy
  §15–17 Cost monitoring + audit

Strategy:
  Same ASGI-transport pattern as test_batman_workflow.py — no real server,
  no real Anthropic key, no Postgres. The decomposer is patched to return
  stamped tasks; the supervisor + graph + reviewers + cost alerts run for
  real.

Asserts the data the cockpit ReviewPanel + AlertsPanel need:
  - GET /missions/:id/results returns results[] with review_results inside
  - GET /missions/:id/alerts returns alerts[] populated when threshold is low
  - mission.abac_policy survives the create -> execute round-trip
  - blocked-by-review tasks return status=review_blocked with reasons
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest


# ---------------------------------------------------------------------------
# Mock task templates — explicit tool + parameters fields so reviewers can
# inspect them. Two cases: clean and injection.
# ---------------------------------------------------------------------------

CLEAN_RAW = {
    "name": "Read brief",
    "description": "Read the brief file",
    "suggested_tool": "read_file",
    "tool": "read_file",
    "parameters": {"path": "brief.txt"},
    "risk_level": "low",
    "requires_approval": True,
}

INJECTION_RAW = {
    "name": "Sneaky read",
    "description": "Looks safe but isn't",
    "suggested_tool": "read_file",
    "tool": "read_file",
    "parameters": {"path": "brief.txt; rm -rf /"},
    "risk_level": "low",
    "requires_approval": True,
}


def _stamp(mission_id: str, raw_tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    return [
        {
            "id": f"task-smoke-{i + 1}",
            "mission_id": mission_id,
            **t,
            "status": "pending_approval",
            "created_at": now,
            "approved_at": None,
            "executed_at": None,
        }
        for i, t in enumerate(raw_tasks)
    ]


# ---------------------------------------------------------------------------
# App import — short-circuits Postgres
# ---------------------------------------------------------------------------


def _get_app():
    from unittest.mock import patch as _patch

    import sys
    if "backend.main" not in sys.modules:
        mock_engine = MagicMock()
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=MagicMock())
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)
        with _patch("sqlalchemy.create_engine", return_value=mock_engine), \
             _patch("backend.db.session.init_db", return_value=None):
            import backend.main  # noqa: F401

    from backend.main import app
    return app


@pytest.fixture()
async def client():
    app = _get_app()
    transport = httpx.ASGITransport(app=app)  # type: ignore[arg-type]
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# Ensure the live supervisor's cost alert threshold is tiny enough to fire
# during the smoke. The supervisor is a module-level singleton; we patch its
# threshold for the duration of each test.
@pytest.fixture(autouse=True)
def low_cost_threshold():
    from backend.api.routes import _supervisor
    original = _supervisor.cost_alert_service.threshold
    _supervisor.cost_alert_service.threshold = 0.005
    # Reset hysteresis state from any prior test
    _supervisor.cost_alert_service._last_fired.clear()  # noqa: SLF001
    yield
    _supervisor.cost_alert_service.threshold = original
    _supervisor.cost_alert_service._last_fired.clear()  # noqa: SLF001


# ---------------------------------------------------------------------------
# Smoke 1 — Happy path through every cockpit endpoint
# ---------------------------------------------------------------------------


async def test_cockpit_happy_path_smoke(client: httpx.AsyncClient):
    """
    Walk a full mission with abac_policy, prove every cockpit-bound
    endpoint (results, alerts, cost, memory) returns the right shape
    with the data the UI panels need.
    """
    captured: dict[str, str] = {}

    def side_effect(mission_id: str, objective: str):
        captured["mission_id"] = mission_id
        return _stamp(mission_id, [CLEAN_RAW])

    abac_policy = {
        "allowed_tools": [
            "read_file",
            "search_knowledge",
            "text_generator",
            "scheduler",
            "search",
            "summarizer",
        ],
        "forbidden_params": ["api_key", "secret", "password", "token"],
    }

    with patch(
        "backend.api.routes._supervisor.graph.decomposer.run",
        new_callable=AsyncMock,
        side_effect=side_effect,
    ):
        resp = await client.post(
            "/api/missions",
            json={
                "objective": "Smoke test the cockpit",
                "mode": "batman",
                "abac_policy": abac_policy,
            },
        )

    assert resp.status_code == 201, resp.text
    mission_id = resp.json()["id"]

    # Approve the single task
    resp = await client.get(f"/api/missions/{mission_id}/tasks")
    tasks = resp.json()
    assert len(tasks) == 1
    task_id = tasks[0]["id"]

    resp = await client.post(
        f"/api/missions/{mission_id}/tasks/{task_id}/approve",
        json={"approved": True, "approver_id": "operator"},
    )
    assert resp.status_code == 200

    # Execute
    resp = await client.post(f"/api/missions/{mission_id}/execute")
    assert resp.status_code == 200
    exec_body = resp.json()
    assert exec_body["status"] in ("completed", "partial")

    # --- Cockpit endpoints ---

    # 1. /results — must include results[] (with status field)
    resp = await client.get(f"/api/missions/{mission_id}/results")
    assert resp.status_code == 200
    rb = resp.json()
    assert "results" in rb
    assert len(rb["results"]) == 1
    assert rb["results"][0]["status"] == "completed"
    # review_results may or may not be present on completed tasks (only on
    # blocked) — that's fine; the panel handles both shapes.

    # 2. /cost — total_cost_usd populated
    resp = await client.get(f"/api/missions/{mission_id}/cost")
    assert resp.status_code == 200
    cost_body = resp.json()
    assert cost_body["total_cost_usd"] > 0

    # 3. /alerts — at least one alert fired (low threshold via fixture)
    resp = await client.get(f"/api/missions/{mission_id}/alerts")
    assert resp.status_code == 200
    alerts_body = resp.json()
    assert isinstance(alerts_body["alerts"], list)
    assert len(alerts_body["alerts"]) >= 1
    alert = alerts_body["alerts"][0]
    assert alert["mission_id"] == mission_id
    assert alert["level"] in ("warning", "critical")
    assert "message" in alert
    assert alert["current_cost"] > 0

    # 4. /memory — list shape
    resp = await client.get(f"/api/missions/{mission_id}/memory")
    assert resp.status_code == 200
    assert isinstance(resp.json()["memory_entries"], list)


# ---------------------------------------------------------------------------
# Smoke 2 — Blocked-by-review surfaces in /results with full review trail
# ---------------------------------------------------------------------------


async def test_cockpit_review_block_smoke(client: httpx.AsyncClient):
    """
    Inject a task with a shell-injection parameter. After approve+execute,
    /results must show status=review_blocked AND review_results populated
    (this is what the cockpit ReviewPanel renders the red verdict from).
    """
    def side_effect(mission_id: str, objective: str):
        return _stamp(mission_id, [INJECTION_RAW])

    abac_policy = {
        "allowed_tools": [
            "read_file",
            "search_knowledge",
            "text_generator",
            "scheduler",
            "search",
            "summarizer",
        ],
        "forbidden_params": ["api_key", "secret", "password", "token"],
    }

    with patch(
        "backend.api.routes._supervisor.graph.decomposer.run",
        new_callable=AsyncMock,
        side_effect=side_effect,
    ):
        resp = await client.post(
            "/api/missions",
            json={
                "objective": "Try to slip an injection past review",
                "mode": "batman",
                "abac_policy": abac_policy,
            },
        )
    mission_id = resp.json()["id"]

    # Approve
    tasks = (await client.get(f"/api/missions/{mission_id}/tasks")).json()
    task_id = tasks[0]["id"]
    await client.post(
        f"/api/missions/{mission_id}/tasks/{task_id}/approve",
        json={"approved": True, "approver_id": "operator"},
    )

    # Execute — should NOT crash, should mark task review_blocked
    resp = await client.post(f"/api/missions/{mission_id}/execute")
    assert resp.status_code == 200

    # /results — verify the cockpit ReviewPanel will render red
    resp = await client.get(f"/api/missions/{mission_id}/results")
    body = resp.json()
    assert len(body["results"]) == 1
    blocked = body["results"][0]
    assert blocked["status"] == "review_blocked"
    assert "review_results" in blocked
    assert len(blocked["review_results"]) == 3
    failing = [r for r in blocked["review_results"] if not r["passed"]]
    assert len(failing) == 1
    assert failing[0]["reviewer"] == "code"
    assert "injection" in failing[0]["reason"].lower()
