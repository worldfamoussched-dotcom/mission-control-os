"""
Unit tests for DecomposerAgent.

Spec reference: Phase 1 §3 (task decomposition)
All Claude calls are mocked — no real API calls.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from backend.agents.decomposer import DecomposerAgent


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_agent() -> DecomposerAgent:
    """Create agent with dummy API key (no real calls)."""
    return DecomposerAgent(api_key="sk-test-dummy")


def _mock_claude_response(text: str) -> MagicMock:
    """Build a mock that looks like an Anthropic Message response."""
    content_block = MagicMock()
    content_block.text = text
    message = MagicMock()
    message.content = [content_block]
    return message


VALID_TASKS_JSON = json.dumps({
    "tasks": [
        {
            "name": "Read contract PDF",
            "description": "Open and extract text from contract.pdf",
            "suggested_tool": "read_file",
            "risk_level": "low",
            "requires_approval": True,
        },
        {
            "name": "Summarize key clauses",
            "description": "Identify payment terms and deadlines",
            "suggested_tool": None,
            "risk_level": "low",
            "requires_approval": True,
        },
    ]
})


# ---------------------------------------------------------------------------
# Tests: _parse_response
# ---------------------------------------------------------------------------

class TestParseResponse:
    def test_valid_json_returns_tasks(self):
        agent = _make_agent()
        tasks = agent._parse_response(VALID_TASKS_JSON)
        assert len(tasks) == 2
        assert tasks[0]["name"] == "Read contract PDF"

    def test_strips_markdown_fences(self):
        agent = _make_agent()
        wrapped = f"```json\n{VALID_TASKS_JSON}\n```"
        tasks = agent._parse_response(wrapped)
        assert len(tasks) == 2

    def test_raises_on_invalid_json(self):
        agent = _make_agent()
        with pytest.raises(ValueError, match="invalid JSON"):
            agent._parse_response("not json at all")

    def test_raises_when_tasks_key_missing(self):
        agent = _make_agent()
        with pytest.raises(ValueError, match="expected"):
            agent._parse_response(json.dumps({"wrong_key": []}))

    def test_raises_when_tasks_not_list(self):
        agent = _make_agent()
        with pytest.raises(ValueError, match="expected"):
            agent._parse_response(json.dumps({"tasks": "oops"}))


# ---------------------------------------------------------------------------
# Tests: _stamp_tasks
# ---------------------------------------------------------------------------

class TestStampTasks:
    def test_stamps_mission_id_and_id(self):
        agent = _make_agent()
        raw = [{"name": "Task A", "description": "Do A", "risk_level": "low"}]
        stamped = agent._stamp_tasks("m_abc123", raw)
        assert stamped[0]["mission_id"] == "m_abc123"
        assert stamped[0]["id"].startswith("t_")

    def test_status_is_pending_approval(self):
        agent = _make_agent()
        raw = [{"name": "Task A", "description": "Do A"}]
        stamped = agent._stamp_tasks("m_1", raw)
        assert stamped[0]["status"] == "pending_approval"

    def test_executed_at_is_none(self):
        agent = _make_agent()
        raw = [{"name": "Task A", "description": "Do A"}]
        stamped = agent._stamp_tasks("m_1", raw)
        assert stamped[0]["executed_at"] is None

    def test_requires_approval_defaults_true(self):
        agent = _make_agent()
        raw = [{"name": "Task A", "description": "Do A"}]
        stamped = agent._stamp_tasks("m_1", raw)
        assert stamped[0]["requires_approval"] is True

    def test_multiple_tasks_get_unique_ids(self):
        agent = _make_agent()
        raw = [
            {"name": "Task A", "description": "A"},
            {"name": "Task B", "description": "B"},
        ]
        stamped = agent._stamp_tasks("m_1", raw)
        ids = [t["id"] for t in stamped]
        assert len(set(ids)) == 2  # all unique


# ---------------------------------------------------------------------------
# Tests: run() — full integration with mocked Claude
# ---------------------------------------------------------------------------

class TestRun:
    @pytest.mark.asyncio
    async def test_run_returns_stamped_tasks(self):
        agent = _make_agent()
        mock_msg = _mock_claude_response(VALID_TASKS_JSON)

        with patch.object(agent._client.messages, "create", return_value=mock_msg):
            tasks = await agent.run("m_test01", "Summarize contract documents")

        assert len(tasks) == 2
        assert all(t["mission_id"] == "m_test01" for t in tasks)
        assert all(t["status"] == "pending_approval" for t in tasks)

    @pytest.mark.asyncio
    async def test_run_raises_on_bad_claude_output(self):
        agent = _make_agent()
        mock_msg = _mock_claude_response("I am Claude and I cannot do this.")

        with patch.object(agent._client.messages, "create", return_value=mock_msg):
            with pytest.raises(ValueError, match="invalid JSON"):
                await agent.run("m_test02", "Do something")

    @pytest.mark.asyncio
    async def test_run_passes_objective_to_claude(self):
        agent = _make_agent()
        mock_msg = _mock_claude_response(VALID_TASKS_JSON)

        with patch.object(agent._client.messages, "create", return_value=mock_msg) as mock_create:
            await agent.run("m_test03", "Book flights to Miami")

        call_kwargs = mock_create.call_args
        messages = call_kwargs.kwargs.get("messages") or call_kwargs.args[0]
        # Find the user message content
        user_content = next(
            m["content"] for m in (
                call_kwargs.kwargs.get("messages", [])
            ) if m["role"] == "user"
        )
        assert "Book flights to Miami" in user_content
