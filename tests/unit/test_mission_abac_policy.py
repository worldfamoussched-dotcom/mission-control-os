"""
Unit tests for per-mission ABAC policy.

Spec reference: Phase 2 §12–14 — ABAC policy scoped per Mission.

The Mission object carries an optional `abac_policy` dict. When present,
the Supervisor forwards it into the ReviewGate so SecurityReviewer runs
against the mission's specific allow-list instead of the service default.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.agents.supervisor import BatmanSupervisor
from backend.models.mission import Mission, MissionMode


# ---------------------------------------------------------------------------
# Mission model field
# ---------------------------------------------------------------------------


class TestMissionAbacPolicyField:
    def test_mission_defaults_to_none(self):
        m = Mission(
            mode=MissionMode.BATMAN,
            objective="Do the thing",
            approvers=["op@x.com"],
            created_by="tester",
        )
        assert m.abac_policy is None

    def test_mission_accepts_abac_policy(self):
        policy = {
            "allowed_tools": ["read_file", "search_knowledge"],
            "forbidden_params": ["api_key"],
        }
        m = Mission(
            mode=MissionMode.BATMAN,
            objective="Scoped mission",
            approvers=["op@x.com"],
            created_by="tester",
            abac_policy=policy,
        )
        assert m.abac_policy == policy
        assert m.abac_policy["allowed_tools"] == ["read_file", "search_knowledge"]


# ---------------------------------------------------------------------------
# Supervisor honors per-mission policy
# ---------------------------------------------------------------------------


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


NARROW_POLICY = {
    # read_file NOT in the list — the mission restricts itself
    "allowed_tools": ["text_generator"],
    "forbidden_params": ["api_key"],
}


CLEAN_TASK = {
    "id": "t_p3a",
    "mission_id": "m_p3a",
    "name": "Read contract",
    "description": "Read the contract file",
    "suggested_tool": "read_file",
    "tool": "read_file",
    "parameters": {"path": "contract.txt"},
    "risk_level": "low",
    "requires_approval": True,
    "status": "approved",
}


def _make_supervisor() -> BatmanSupervisor:
    # Decomposer is not used in execute_approved_tasks path
    decomposer = MagicMock()
    decomposer.run = AsyncMock(return_value=[CLEAN_TASK])
    return BatmanSupervisor(decomposer=decomposer)


class TestSupervisorHonorsPolicy:
    @pytest.mark.asyncio
    async def test_wide_policy_allows_read_file(self):
        sup = _make_supervisor()
        summary = await sup.execute_approved_tasks(
            mission_id="m_p3a",
            objective="Read contract",
            all_tasks=[CLEAN_TASK],
            approved_task_ids=["t_p3a"],
            abac_policy=WIDE_POLICY,
        )
        assert summary["status"] == "completed"
        assert summary["review_blocked_count"] == 0
        assert summary["results"][0]["status"] == "completed"

    @pytest.mark.asyncio
    async def test_narrow_policy_blocks_read_file(self):
        sup = _make_supervisor()
        summary = await sup.execute_approved_tasks(
            mission_id="m_p3b",
            objective="Read contract",
            all_tasks=[CLEAN_TASK],
            approved_task_ids=["t_p3a"],
            abac_policy=NARROW_POLICY,
        )
        # SecurityReviewer blocks because read_file isn't in narrow policy
        assert summary["review_blocked_count"] == 1
        assert summary["results"][0]["status"] == "review_blocked"
        assert "security" in summary["results"][0]["error"].lower() or \
               "not permitted" in summary["results"][0]["error"].lower()

    @pytest.mark.asyncio
    async def test_none_policy_falls_back_to_default(self):
        # The SecurityReviewer's built-in default allow-list does NOT include
        # read_file, so a task using read_file with no abac_policy provided
        # should be blocked. This proves the default is in force when none
        # is supplied.
        sup = _make_supervisor()
        summary = await sup.execute_approved_tasks(
            mission_id="m_p3c",
            objective="Read contract",
            all_tasks=[CLEAN_TASK],
            approved_task_ids=["t_p3a"],
            # abac_policy intentionally omitted
        )
        assert summary["review_blocked_count"] == 1
