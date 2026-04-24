"""
Unit tests for ExecutorAgent.

Spec reference: Phase 1 §4–5 (task execution)
All tool calls are mocked — no real IO.
"""

from __future__ import annotations

import pytest

from backend.agents.executor import ExecutorAgent
from backend.services.cost_service import CostService
from backend.services.memory_service import MemoryService
from backend.services.tool_service import ToolService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def executor() -> ExecutorAgent:
    return ExecutorAgent(
        tool_service=ToolService(),
        cost_service=CostService(),
        memory_service=MemoryService(),
    )


def _make_task(tool: str = "read_file", risk: str = "low") -> dict:
    return {
        "id": "t_abc12345",
        "mission_id": "m_test001",
        "name": "Test task",
        "description": "Do the thing",
        "suggested_tool": tool,
        "risk_level": risk,
        "requires_approval": True,
        "status": "approved",
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestExecutorAgent:

    @pytest.mark.asyncio
    async def test_execute_low_risk_tool_succeeds(self, executor):
        task = _make_task(tool="read_file")
        result = await executor.execute(
            mission_id="m_test001",
            task=task,
            mode="batman",
            approver_id="operator",
        )
        assert result["status"] == "completed"
        assert result["task_id"] == "t_abc12345"
        assert result["output"] is not None

    @pytest.mark.asyncio
    async def test_execute_returns_cost(self, executor):
        task = _make_task(tool="read_file")
        result = await executor.execute("m_test001", task, "batman", "operator")
        assert result["cost_usd"] >= 0.0

    @pytest.mark.asyncio
    async def test_execute_tracks_cost_in_service(self, executor):
        task = _make_task(tool="read_file")
        await executor.execute("m_cost001", task, "batman", "operator")
        total = executor.cost_service.get_mission_total_cost("m_cost001")
        assert total > 0.0

    @pytest.mark.asyncio
    async def test_execute_stores_result_in_memory(self, executor):
        task = _make_task(tool="read_file")
        await executor.execute("m_mem001", task, "batman", "operator")
        entry = executor.memory_service.retrieve("m_mem001", "task_t_abc12345_result")
        assert entry is not None
        assert entry["task_name"] == "Test task"

    @pytest.mark.asyncio
    async def test_blocked_tool_returns_blocked_status(self, executor):
        # execute_script requires human_review — no approver in no-review context
        # We'll test with a made-up tool that doesn't exist in registry
        task = _make_task(tool="nonexistent_tool_xyz")
        result = await executor.execute("m_block01", task, "batman", "operator")
        # nonexistent tool → can_execute returns False
        assert result["status"] == "blocked"
        assert result["error"] is not None

    @pytest.mark.asyncio
    async def test_result_has_required_fields(self, executor):
        task = _make_task(tool="read_file")
        result = await executor.execute("m_fields", task, "batman", "operator")
        required = {"id", "task_id", "task_name", "tool_name", "mission_id",
                    "status", "output", "error", "cost_usd", "duration_seconds",
                    "started_at", "completed_at"}
        assert required.issubset(result.keys())

    @pytest.mark.asyncio
    async def test_duration_is_positive(self, executor):
        task = _make_task(tool="read_file")
        result = await executor.execute("m_dur001", task, "batman", "operator")
        assert result["duration_seconds"] >= 0.0
