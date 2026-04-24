"""
Unit tests for BatmanGraph.

Spec reference: Phase 1 §3–5 (Batman mode flow)
DecomposerAgent is mocked — no real Claude calls.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.agents.batman_graph import BatmanGraph, MAX_ITERATIONS
from backend.services.cost_service import CostService
from backend.services.memory_service import MemoryService
from backend.services.tool_service import ToolService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_graph(decomposer=None) -> BatmanGraph:
    return BatmanGraph(
        tool_service=ToolService(),
        cost_service=CostService(),
        memory_service=MemoryService(),
        decomposer=decomposer,
    )


def _mock_decomposer(tasks: list[dict]) -> MagicMock:
    d = MagicMock()
    d.run = AsyncMock(return_value=tasks)
    return d


SAMPLE_TASKS = [
    {
        "id": "t_aaa",
        "mission_id": "m_g001",
        "name": "Read file",
        "description": "Read the contract",
        "suggested_tool": "read_file",
        "risk_level": "low",
        "requires_approval": True,
        "status": "pending_approval",
    },
    {
        "id": "t_bbb",
        "mission_id": "m_g001",
        "name": "Summarise",
        "description": "Write a summary",
        "suggested_tool": "search_knowledge",
        "risk_level": "low",
        "requires_approval": True,
        "status": "pending_approval",
    },
]


# ---------------------------------------------------------------------------
# Tests: _decompose_node
# ---------------------------------------------------------------------------

class TestDecomposeNode:

    @pytest.mark.asyncio
    async def test_decompose_calls_claude_and_sets_tasks(self):
        decomposer = _mock_decomposer(SAMPLE_TASKS)
        graph = _make_graph(decomposer)

        state = {
            "mission_id": "m_g001",
            "objective": "Review contract",
            "state": "starting",
            "tasks": [],
            "approved_task_ids": [],
            "execution_results": [],
            "mission_error": None,
            "iteration_count": 0,
            "cost_usd": 0.0,
        }

        new_state = await graph._decompose_node(state)

        assert new_state["state"] == "decomposed"
        assert len(new_state["tasks"]) == 2
        decomposer.run.assert_called_once_with(
            mission_id="m_g001", objective="Review contract"
        )

    @pytest.mark.asyncio
    async def test_decompose_failure_sets_failed_state(self):
        decomposer = MagicMock()
        decomposer.run = AsyncMock(side_effect=ValueError("Claude error"))
        graph = _make_graph(decomposer)

        state = {
            "mission_id": "m_fail",
            "objective": "Do something",
            "state": "starting",
            "tasks": [],
            "approved_task_ids": [],
            "execution_results": [],
            "mission_error": None,
            "iteration_count": 0,
            "cost_usd": 0.0,
        }

        new_state = await graph._decompose_node(state)
        assert new_state["state"] == "failed"
        assert "Claude error" in new_state["mission_error"]

    @pytest.mark.asyncio
    async def test_decompose_tracks_cost(self):
        decomposer = _mock_decomposer(SAMPLE_TASKS)
        graph = _make_graph(decomposer)

        state = {
            "mission_id": "m_cost",
            "objective": "Anything",
            "state": "starting",
            "tasks": [],
            "approved_task_ids": [],
            "execution_results": [],
            "mission_error": None,
            "iteration_count": 0,
            "cost_usd": 0.0,
        }
        new_state = await graph._decompose_node(state)
        assert new_state["cost_usd"] > 0.0


# ---------------------------------------------------------------------------
# Tests: post-review execution routing
# ---------------------------------------------------------------------------

class TestShouldExecute:

    def test_routes_to_execute_when_approved_tasks_present(self):
        graph = _make_graph()
        state = {
            "approved_task_ids": ["t_aaa"],
            "mission_error": None,
        }
        assert graph._should_execute_after_review(state) == "execute"

    def test_routes_to_error_when_no_approved_tasks(self):
        graph = _make_graph()
        state = {"approved_task_ids": [], "mission_error": None}
        assert graph._should_execute_after_review(state) == "error"

    def test_routes_to_error_when_error_present(self):
        graph = _make_graph()
        state = {"approved_task_ids": ["t_aaa"], "mission_error": "something broke"}
        assert graph._should_execute_after_review(state) == "error"


# ---------------------------------------------------------------------------
# Tests: _execute_task_node
# ---------------------------------------------------------------------------

class TestExecuteTaskNode:

    @pytest.mark.asyncio
    async def test_executes_first_approved_task(self):
        graph = _make_graph()
        state = {
            "mission_id": "m_exec",
            "objective": "Do thing",
            "state": "awaiting_approval",
            "tasks": SAMPLE_TASKS,
            "approved_task_ids": ["t_aaa", "t_bbb"],
            "execution_results": [],
            "mission_error": None,
            "iteration_count": 0,
            "cost_usd": 0.0,
        }
        new_state = await graph._execute_task_node(state)
        # First task consumed
        assert "t_aaa" not in new_state["approved_task_ids"]
        assert "t_bbb" in new_state["approved_task_ids"]
        assert len(new_state["execution_results"]) == 1
        assert new_state["iteration_count"] == 1

    @pytest.mark.asyncio
    async def test_iteration_count_increments(self):
        graph = _make_graph()
        state = {
            "mission_id": "m_iter",
            "objective": "x",
            "state": "executing",
            "tasks": SAMPLE_TASKS,
            "approved_task_ids": ["t_aaa"],
            "execution_results": [],
            "mission_error": None,
            "iteration_count": 2,
            "cost_usd": 0.0,
        }
        new_state = await graph._execute_task_node(state)
        assert new_state["iteration_count"] == 3

    @pytest.mark.asyncio
    async def test_does_not_mutate_original_state(self):
        graph = _make_graph()
        original_ids = ["t_aaa", "t_bbb"]
        state = {
            "mission_id": "m_immut",
            "objective": "x",
            "state": "executing",
            "tasks": SAMPLE_TASKS,
            "approved_task_ids": original_ids.copy(),
            "execution_results": [],
            "mission_error": None,
            "iteration_count": 0,
            "cost_usd": 0.0,
        }
        await graph._execute_task_node(state)
        # Original list must be untouched
        assert state["approved_task_ids"] == original_ids


# ---------------------------------------------------------------------------
# Tests: _should_continue routing
# ---------------------------------------------------------------------------

class TestShouldContinue:

    def test_continues_when_tasks_remain(self):
        graph = _make_graph()
        state = {"approved_task_ids": ["t_bbb"], "mission_error": None, "iteration_count": 1}
        assert graph._should_continue(state) == "continue"

    def test_completes_when_no_tasks_remain(self):
        graph = _make_graph()
        state = {"approved_task_ids": [], "mission_error": None, "iteration_count": 1}
        assert graph._should_continue(state) == "complete"

    def test_errors_at_max_iterations(self):
        graph = _make_graph()
        state = {
            "approved_task_ids": ["t_x"],
            "mission_error": None,
            "iteration_count": MAX_ITERATIONS,
        }
        assert graph._should_continue(state) == "error"


# ---------------------------------------------------------------------------
# Tests: decompose() public method
# ---------------------------------------------------------------------------

class TestDecomposePublic:

    @pytest.mark.asyncio
    async def test_decompose_returns_task_list(self):
        decomposer = _mock_decomposer(SAMPLE_TASKS)
        graph = _make_graph(decomposer)
        tasks = await graph.decompose("m_pub01", "Review contract")
        assert len(tasks) == 2
        assert tasks[0]["id"] == "t_aaa"
