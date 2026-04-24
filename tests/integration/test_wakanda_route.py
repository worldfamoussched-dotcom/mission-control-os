"""Integration test — POST /missions/{id}/run-wakanda + approve route.

Spec reference: Phase 3 §9–11 + docs/SPEC_PHASE3_WAKANDA.md.
Mode mapping: Wakanda = ATS / All the Smoke (label).

ASGI transport, decomposer mocked. Same pattern as test_jarvis_route.py.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest


def _stamp(mission_id: str, raw: list[dict]) -> list[dict]:
    return [
        {
            "id": f"wt-{i + 1}",
            "mission_id": mission_id,
            "status": "pending_approval",
            **t,
        }
        for i, t in enumerate(raw)
    ]


WIDE_POLICY = {
    "allowed_tools": [
        "read_file",
        "write_file",
        "search_knowledge",
        "execute_script",
        "text_generator",
        "scheduler",
        "search",
        "summarizer",
    ],
    "forbidden_params": ["api_key", "secret", "password", "token"],
}


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


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_wakanda_run_classifies_and_runs_pass_through(client: httpx.AsyncClient):
    """Wakanda mission with one pass-through + one gated task."""

    def side_effect(mission_id: str, objective: str):
        return _stamp(mission_id, [
            {
                "name": "Search ATS catalog",
                "description": "Search internal docs",
                "suggested_tool": "search_knowledge",
                "risk_level": "low",
                "parameters": {"query": "ats roster"},
            },
            {
                "name": "Update metadata",
                "description": "Edit a file",
                "suggested_tool": "write_file",
                "risk_level": "low",
                "parameters": {"path": "metadata.json"},
            },
        ])

    with patch(
        "backend.api.routes._wakanda_supervisor.decomposer.run",
        new_callable=AsyncMock,
        side_effect=side_effect,
    ):
        resp = await client.post(
            "/api/missions",
            json={
                "objective": "ATS roster maintenance",
                "mode": "wakanda",
                "approvers": ["operator"],
                "abac_policy": WIDE_POLICY,
            },
        )
        assert resp.status_code == 201, resp.text
        mission_id = resp.json()["id"]

        resp = await client.post(f"/api/missions/{mission_id}/run-wakanda")

    assert resp.status_code == 200, resp.text
    summary = resp.json()
    assert summary["mode"] == "wakanda"
    assert len(summary["pass_through_results"]) == 1
    assert summary["pass_through_results"][0]["status"] == "completed"
    assert len(summary["gated_task_ids"]) == 1


async def test_wakanda_approve_gated_task(client: httpx.AsyncClient):
    """Operator approves a gated task; it runs and shows in /results."""

    def side_effect(mission_id: str, objective: str):
        return _stamp(mission_id, [
            {
                "name": "Edit",
                "description": "Edit metadata",
                "suggested_tool": "write_file",
                "risk_level": "low",
                "parameters": {"path": "x.json"},
            },
        ])

    with patch(
        "backend.api.routes._wakanda_supervisor.decomposer.run",
        new_callable=AsyncMock,
        side_effect=side_effect,
    ):
        resp = await client.post(
            "/api/missions",
            json={
                "objective": "Approve me",
                "mode": "wakanda",
                "approvers": ["operator"],
                "abac_policy": WIDE_POLICY,
            },
        )
        mission_id = resp.json()["id"]

        run_resp = await client.post(f"/api/missions/{mission_id}/run-wakanda")
        gated_id = run_resp.json()["gated_task_ids"][0]

        approve_resp = await client.post(
            f"/api/missions/{mission_id}/wakanda/tasks/{gated_id}/approve",
            json={"approved": True, "approver_id": "operator"},
        )

    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "completed"


async def test_wakanda_route_rejects_batman_missions(client: httpx.AsyncClient):
    """Wakanda routes must reject Batman missions with 400."""

    def side_effect(mission_id: str, objective: str):
        return _stamp(mission_id, [
            {
                "name": "x",
                "description": "x",
                "suggested_tool": "search_knowledge",
                "risk_level": "low",
                "parameters": {"query": "x"},
            },
        ])

    with patch(
        "backend.api.routes._supervisor.graph.decomposer.run",
        new_callable=AsyncMock,
        side_effect=side_effect,
    ):
        resp = await client.post(
            "/api/missions",
            json={"objective": "x", "mode": "batman", "approvers": ["operator"]},
        )
    mission_id = resp.json()["id"]

    resp = await client.post(f"/api/missions/{mission_id}/run-wakanda")
    assert resp.status_code == 400
    assert "wakanda" in resp.json()["detail"].lower()
