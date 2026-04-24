"""
Unit tests for JarvisSupervisor — Phase 3 §9–11.

Jarvis Mode contract:
  - No human approval gate (single-shot decompose → review → execute → done)
  - ReviewGate still runs (security guardrails always on, mode-independent)
  - Cost alerts still fire
  - AuditService persists everything (same as Batman)
  - Cross-mode memory isolation (mode='jarvis' enforced through reviewers)

The supervisor takes an objective, returns the full execution summary in
one call. No /tasks listing, no /approve endpoint, no second roundtrip.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.agents.jarvis_supervisor import JarvisSupervisor
from backend.db.models import Base, Mission, MissionMode, MissionState
from backend.services.audit_service import AuditService
from backend.services.cost_alert_service import CostAlertService


# ---------------------------------------------------------------------------
# Fixtures
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


def _stamped_clean_tasks(mission_id: str) -> list[dict]:
    # Use only tools that exist in BOTH the ToolService registry AND the
    # SecurityReviewer ABAC policy. Phase 2 has a known gap where the two
    # sources disagree; tracked as cleanup. read_file + search_knowledge
    # are in both.
    return [
        {
            "id": "tj_1",
            "mission_id": mission_id,
            "name": "Search docs",
            "description": "Search internal docs",
            "suggested_tool": "search_knowledge",
            "tool": "search_knowledge",
            "parameters": {"query": "phase 3 spec"},
            "risk_level": "low",
            "requires_approval": False,
            "status": "pending",
        },
        {
            "id": "tj_2",
            "mission_id": mission_id,
            "name": "Read brief",
            "description": "Read the brief file",
            "suggested_tool": "read_file",
            "tool": "read_file",
            "parameters": {"path": "brief.txt"},
            "risk_level": "low",
            "requires_approval": False,
            "status": "pending",
        },
    ]


def _stamped_injection_task(mission_id: str) -> list[dict]:
    return [
        {
            "id": "tj_inj",
            "mission_id": mission_id,
            "name": "Sneaky search",
            "description": "Looks safe",
            "suggested_tool": "search_knowledge",
            "tool": "search_knowledge",
            "parameters": {"query": "ok; rm -rf /"},
            "risk_level": "low",
            "requires_approval": False,
            "status": "pending",
        }
    ]


def _stamped_cross_mode_task(mission_id: str) -> list[dict]:
    return [
        {
            "id": "tj_cross",
            "mission_id": mission_id,
            "name": "Reach for batman memory",
            "description": "Read a batman-scoped key from jarvis",
            "suggested_tool": "search_knowledge",
            "tool": "search_knowledge",
            "parameters": {"batman_secret": "x"},
            "risk_level": "low",
            "requires_approval": False,
            "status": "pending",
        }
    ]


@pytest.fixture
def session_factory():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    s = TestSession()
    s.add(
        Mission(
            id="m_jarvis",
            objective="Jarvis test mission",
            mode=MissionMode.JARVIS,
            state=MissionState.EXECUTING,
            approvers=[],  # Jarvis has none
        )
    )
    s.commit()
    s.close()
    return TestSession


def _mock_decomposer(tasks_factory):
    d = MagicMock()
    d.run = AsyncMock(side_effect=lambda mission_id, objective: tasks_factory(mission_id))
    return d


@pytest.fixture
def supervisor_factory(session_factory):
    def _build(decomposer):
        return JarvisSupervisor(
            decomposer=decomposer,
            cost_alert_service=CostAlertService(threshold=0.005),
            audit_service=AuditService(session_factory=session_factory),
        )
    return _build


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestJarvisLifecycle:
    @pytest.mark.asyncio
    async def test_run_mission_executes_all_tasks_no_approval(self, supervisor_factory):
        sup = supervisor_factory(_mock_decomposer(_stamped_clean_tasks))

        summary = await sup.run_mission(
            mission_id="m_jarvis",
            objective="Look up and summarize",
            abac_policy=WIDE_POLICY,
        )

        assert summary["mission_id"] == "m_jarvis"
        assert summary["status"] == "completed"
        # Both tasks ran end-to-end
        assert len(summary["results"]) == 2
        assert all(r["status"] == "completed" for r in summary["results"])
        assert summary["total_cost_usd"] > 0
        # Decomposer called exactly once (single-shot)
        sup.decomposer.run.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_run_mission_blocks_injection_task(self, supervisor_factory):
        sup = supervisor_factory(_mock_decomposer(_stamped_injection_task))

        summary = await sup.run_mission(
            mission_id="m_jarvis",
            objective="Slip an injection past review",
            abac_policy=WIDE_POLICY,
        )

        # Single-task mission, the only task was blocked at the review gate.
        # No tasks completed, so the mission status is "failed" (no successful
        # work product), but the supervisor itself did not crash.
        assert summary["status"] == "failed"
        assert summary["review_blocked_count"] == 1
        assert summary["results"][0]["status"] == "review_blocked"
        # Reviewers still all 3 ran, one failed
        rr = summary["results"][0]["review_results"]
        assert len(rr) == 3
        failing = [r for r in rr if not r["passed"]]
        assert len(failing) == 1
        assert failing[0]["reviewer"] == "code"

    @pytest.mark.asyncio
    async def test_memory_reviewer_blocks_batman_key_in_jarvis_mode(self, supervisor_factory):
        sup = supervisor_factory(_mock_decomposer(_stamped_cross_mode_task))

        summary = await sup.run_mission(
            mission_id="m_jarvis",
            objective="Cross-mode leak attempt",
            abac_policy=WIDE_POLICY,
        )

        assert summary["review_blocked_count"] == 1
        rr = summary["results"][0]["review_results"]
        failing = [r for r in rr if not r["passed"]]
        assert any(r["reviewer"] == "memory" for r in failing)

    @pytest.mark.asyncio
    async def test_audit_persistence_works_for_jarvis(self, supervisor_factory):
        sup = supervisor_factory(_mock_decomposer(_stamped_clean_tasks))

        await sup.run_mission(
            mission_id="m_jarvis",
            objective="Persist me",
            abac_policy=WIDE_POLICY,
        )

        rows = sup.audit_service.list_review_results("m_jarvis")
        # 2 tasks * 3 reviewers = 6 rows
        assert len(rows) == 6
        assert all(r["mission_id"] == "m_jarvis" for r in rows)
        assert all(r["passed"] for r in rows)

    @pytest.mark.asyncio
    async def test_cost_alert_fires_under_jarvis(self, supervisor_factory):
        sup = supervisor_factory(_mock_decomposer(_stamped_clean_tasks))

        summary = await sup.run_mission(
            mission_id="m_jarvis",
            objective="Spend a tiny bit",
            abac_policy=WIDE_POLICY,
        )

        # threshold is 0.005, every executed task accrues cost
        assert len(summary["cost_alerts"]) >= 1
        assert summary["cost_alerts"][0]["mission_id"] == "m_jarvis"

    @pytest.mark.asyncio
    async def test_no_approval_methods_exposed(self, supervisor_factory):
        """Jarvis supervisor must not have an approve_task or execute_approved_tasks."""
        sup = supervisor_factory(_mock_decomposer(_stamped_clean_tasks))
        assert not hasattr(sup, "approve_task")
        assert not hasattr(sup, "execute_approved_tasks")
        assert hasattr(sup, "run_mission")
