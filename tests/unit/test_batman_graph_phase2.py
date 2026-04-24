"""
Unit tests for BatmanGraph Phase 2 — ReviewGate + CostAlertService integration.

Spec reference: Phase 2 §6-8 (guardrails) and §15-17 (monitoring).

Flow under test:
    decompose -> await_approval -> review_tasks -> execute_task (loop) -> complete | error

The review_tasks node runs ReviewGate.run() on every approved task. If any
reviewer blocks any task, the mission transitions to 'failed' with a
descriptive mission_error.

Cost alerts fire from inside _execute_task_node after each cost track.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.agents.batman_graph import BatmanGraph
from backend.services.cost_alert_service import CostAlertService
from backend.services.cost_service import CostService
from backend.services.memory_service import MemoryService
from backend.services.tool_service import ToolService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# ABAC policy wide enough to cover the Phase 1 mock tool set so the default
# SecurityReviewer allow-list (which is narrower) doesn't block legitimate
# Batman tasks during Phase 2 wiring.
BATMAN_ABAC_POLICY: dict = {
    "allowed_tools": [
        "text_generator",
        "scheduler",
        "search",
        "summarizer",
        "read_file",
        "write_file",
        "search_knowledge",
        "web_search",
        "run_query",
        "send_notification",
    ],
    "forbidden_params": ["api_key", "secret", "password", "token"],
}


def _mock_decomposer(tasks: list[dict]) -> MagicMock:
    d = MagicMock()
    d.run = AsyncMock(return_value=tasks)
    return d


def _make_graph(
    decomposer=None,
    cost_alert_service: CostAlertService | None = None,
    abac_policy: dict | None = None,
) -> BatmanGraph:
    return BatmanGraph(
        tool_service=ToolService(),
        cost_service=CostService(),
        memory_service=MemoryService(),
        decomposer=decomposer,
        cost_alert_service=cost_alert_service,
        abac_policy=abac_policy or BATMAN_ABAC_POLICY,
    )


CLEAN_TASKS = [
    {
        "id": "t_clean1",
        "mission_id": "m_p2a",
        "name": "Read contract",
        "description": "Read the contract file",
        "suggested_tool": "read_file",
        "parameters": {"path": "contract.txt"},
        "risk_level": "low",
        "requires_approval": True,
        "status": "pending_approval",
    },
    {
        "id": "t_clean2",
        "mission_id": "m_p2a",
        "name": "Summarise",
        "description": "Summarise the contract",
        "suggested_tool": "search_knowledge",
        "parameters": {"query": "contract summary"},
        "risk_level": "low",
        "requires_approval": True,
        "status": "pending_approval",
    },
]


INJECTION_TASK = {
    "id": "t_inj",
    "mission_id": "m_p2b",
    "name": "Sneaky",
    "description": "Looks fine",
    "suggested_tool": "read_file",
    "parameters": {"path": "normal.txt; rm -rf /"},
    "risk_level": "low",
    "requires_approval": True,
    "status": "pending_approval",
}


CROSS_MODE_TASK = {
    "id": "t_cross",
    "mission_id": "m_p2c",
    "name": "Leak",
    "description": "Touch Jarvis data",
    "suggested_tool": "read_file",
    "parameters": {"jarvis_secret_key": "x"},
    "risk_level": "low",
    "requires_approval": True,
    "status": "pending_approval",
}


FORBIDDEN_PARAM_TASK = {
    "id": "t_forbid",
    "mission_id": "m_p2d",
    "name": "Leak key",
    "description": "Pass an api key",
    "suggested_tool": "read_file",
    "parameters": {"api_key": "sk-123"},
    "risk_level": "low",
    "requires_approval": True,
    "status": "pending_approval",
}


# ---------------------------------------------------------------------------
# ReviewGate integration
# ---------------------------------------------------------------------------


class TestReviewGateIntegration:
    @pytest.mark.asyncio
    async def test_clean_tasks_pass_review_and_execute(self):
        graph = _make_graph(_mock_decomposer(CLEAN_TASKS))

        final = await graph.execute_approved(
            mission_id="m_p2a",
            objective="Work the contract",
            tasks=CLEAN_TASKS,
            approved_task_ids=["t_clean1", "t_clean2"],
        )

        assert final["state"] == "completed"
        assert final["mission_error"] is None
        # 3 reviewers * 2 tasks
        assert len(final["review_results"]) == 6
        assert all(r["passed"] for r in final["review_results"])

    @pytest.mark.asyncio
    async def test_review_gate_blocks_injection_task(self):
        graph = _make_graph(_mock_decomposer([INJECTION_TASK]))

        final = await graph.execute_approved(
            mission_id="m_p2b",
            objective="Do the thing",
            tasks=[INJECTION_TASK],
            approved_task_ids=["t_inj"],
        )

        assert final["state"] == "failed"
        assert final["mission_error"] is not None
        assert "code" in final["mission_error"].lower() or "injection" in final["mission_error"].lower()
        # No execution should have happened
        assert final["execution_results"] == []

    @pytest.mark.asyncio
    async def test_review_gate_blocks_cross_mode_memory(self):
        graph = _make_graph(_mock_decomposer([CROSS_MODE_TASK]))

        final = await graph.execute_approved(
            mission_id="m_p2c",
            objective="Leak something",
            tasks=[CROSS_MODE_TASK],
            approved_task_ids=["t_cross"],
        )

        assert final["state"] == "failed"
        assert "memory" in final["mission_error"].lower() or "scope" in final["mission_error"].lower()
        assert final["execution_results"] == []

    @pytest.mark.asyncio
    async def test_security_reviewer_blocks_forbidden_param(self):
        graph = _make_graph(_mock_decomposer([FORBIDDEN_PARAM_TASK]))

        final = await graph.execute_approved(
            mission_id="m_p2d",
            objective="Pass a key",
            tasks=[FORBIDDEN_PARAM_TASK],
            approved_task_ids=["t_forbid"],
        )

        assert final["state"] == "failed"
        assert "security" in final["mission_error"].lower() or "forbidden" in final["mission_error"].lower()
        assert final["execution_results"] == []


# ---------------------------------------------------------------------------
# CostAlertService integration
# ---------------------------------------------------------------------------


class TestCostAlertIntegration:
    @pytest.mark.asyncio
    async def test_cost_alert_fires_when_threshold_crossed(self):
        # Very low threshold so the tiny mock tool costs blow past it.
        alerts = CostAlertService(threshold=0.005)
        graph = _make_graph(
            _mock_decomposer(CLEAN_TASKS),
            cost_alert_service=alerts,
        )

        final = await graph.execute_approved(
            mission_id="m_p2cost",
            objective="Burn through budget",
            tasks=CLEAN_TASKS,
            approved_task_ids=["t_clean1", "t_clean2"],
        )

        assert final["state"] == "completed"
        assert len(final["cost_alerts"]) >= 1
        assert final["cost_alerts"][0]["mission_id"] == "m_p2cost"
        assert final["cost_alerts"][0]["level"] in ("warning", "critical")

    @pytest.mark.asyncio
    async def test_no_alert_when_cost_below_threshold(self):
        # Huge threshold — nothing should fire.
        alerts = CostAlertService(threshold=1000.0)
        graph = _make_graph(
            _mock_decomposer(CLEAN_TASKS),
            cost_alert_service=alerts,
        )

        final = await graph.execute_approved(
            mission_id="m_p2quiet",
            objective="Cheap work",
            tasks=CLEAN_TASKS,
            approved_task_ids=["t_clean1", "t_clean2"],
        )

        assert final["state"] == "completed"
        assert final["cost_alerts"] == []
