"""Integration test — POST /missions/{id}/run for Jarvis Mode.

Spec reference: Phase 3 §9–11 (Jarvis = command-execute, no approval gate).
Mode mapping: Jarvis = Fractal Web Solutions dev agency.

ASGI transport, decomposer mocked. Same pattern as
test_batman_workflow.py + test_phase2_cockpit_smoke.py — no live keys, no
Postgres.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest


CLEAN_TASK_RAW = {
    "name": "Search docs",
    "description": "Search internal docs",
    "suggested_tool": "search_knowledge",
    "tool": "search_knowledge",
    "parameters": {"query": "phase 3 spec"},
    "risk_level": "low",
    "requires_approval": False,
}


def _stamp(mission_id: str, raw: list[dict]) -> list[dict]:
    now = datetime.now(timezone.utc)
    return [
        {
            "id": f"jt-{i + 1}",
            "mission_id": mission_id,
            **t,
            # "pending_approval" is the canonical value for the API response
            # model. Jarvis never reads this field, but Batman missions do.
            "status": "pending_approval",
            "created_at": now,
            "approved_at": None,
            "executed_at": None,
        }
        for i, t in enumerate(raw)
    ]


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


WIDE_POLICY = {
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


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_jarvis_run_route_full_lifecycle(client: httpx.AsyncClient):
    """Create a Jarvis mission and run it single-shot via POST /run."""

    def side_effect(mission_id: str, objective: str):
        return _stamp(mission_id, [CLEAN_TASK_RAW])

    # Patch must remain active for both the mission-create AND the /run call,
    # since the Jarvis supervisor calls the decomposer at the start of run_mission.
    with patch(
        "backend.api.routes._jarvis_supervisor.decomposer.run",
        new_callable=AsyncMock,
        side_effect=side_effect,
    ):
        resp = await client.post(
            "/api/missions",
            json={
                "objective": "Run a Jarvis dev-agency task single-shot",
                "mode": "jarvis",
                "approvers": [],
                "abac_policy": WIDE_POLICY,
            },
        )
        assert resp.status_code == 201, resp.text
        mission_id = resp.json()["id"]

        resp = await client.post(f"/api/missions/{mission_id}/run")

    assert resp.status_code == 200, resp.text
    summary = resp.json()
    assert summary["mode"] == "jarvis"
    assert summary["status"] == "completed"
    assert len(summary["results"]) == 1
    assert summary["results"][0]["status"] == "completed"

    # Cockpit-bound endpoints should now show the run
    resp = await client.get(f"/api/missions/{mission_id}/results")
    assert resp.status_code == 200
    assert len(resp.json()["results"]) == 1


async def test_run_route_rejects_batman_missions(client: httpx.AsyncClient):
    """Batman missions must NOT be runnable via /run — they need approval."""

    def side_effect(mission_id: str, objective: str):
        return _stamp(mission_id, [CLEAN_TASK_RAW])

    with patch(
        "backend.api.routes._supervisor.graph.decomposer.run",
        new_callable=AsyncMock,
        side_effect=side_effect,
    ):
        resp = await client.post(
            "/api/missions",
            json={
                "objective": "Should not run via /run",
                "mode": "batman",
                "approvers": ["operator"],
            },
        )
    mission_id = resp.json()["id"]

    resp = await client.post(f"/api/missions/{mission_id}/run")
    assert resp.status_code == 400
    detail = resp.json()["detail"].lower()
    assert "jarvis" in detail
