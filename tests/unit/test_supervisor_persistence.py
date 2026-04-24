"""Integration test: BatmanSupervisor + AuditService.

Spec reference: Phase 2 §6–8 + §15–17 — review verdicts and cost alerts
must reach the audit store on every execution.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.agents.supervisor import BatmanSupervisor
from backend.db.models import Base, Mission, MissionMode, MissionState
from backend.services.audit_service import AuditService
from backend.services.cost_alert_service import CostAlertService


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

CLEAN_TASK = {
    "id": "t_per1",
    "mission_id": "m_persist",
    "name": "Read contract",
    "description": "Read the contract file",
    "suggested_tool": "read_file",
    "tool": "read_file",
    "parameters": {"path": "contract.txt"},
    "risk_level": "low",
    "requires_approval": True,
    "status": "approved",
}

INJECTION_TASK = {
    "id": "t_per2",
    "mission_id": "m_persist",
    "name": "Sneaky",
    "description": "Looks fine",
    "suggested_tool": "read_file",
    "tool": "read_file",
    "parameters": {"path": "ok.txt; rm -rf /"},
    "risk_level": "low",
    "requires_approval": True,
    "status": "approved",
}


@pytest.fixture
def session_factory():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    s = TestSession()
    s.add(
        Mission(
            id="m_persist",
            objective="Persistence test mission",
            mode=MissionMode.BATMAN,
            state=MissionState.EXECUTING,
            approvers=["op@x.com"],
        )
    )
    s.commit()
    s.close()
    return TestSession


@pytest.fixture
def supervisor(session_factory):
    decomposer = MagicMock()
    decomposer.run = AsyncMock(return_value=[])
    return BatmanSupervisor(
        decomposer=decomposer,
        cost_alert_service=CostAlertService(threshold=0.005),  # tiny so alerts fire
        audit_service=AuditService(session_factory=session_factory),
    )


class TestSupervisorPersistence:
    @pytest.mark.asyncio
    async def test_passing_review_persists_three_rows(self, supervisor):
        await supervisor.execute_approved_tasks(
            mission_id="m_persist",
            objective="x",
            all_tasks=[CLEAN_TASK],
            approved_task_ids=["t_per1"],
            abac_policy=WIDE_POLICY,
        )

        rows = supervisor.audit_service.list_review_results("m_persist")
        # 3 reviewers ran on the one task
        assert len(rows) == 3
        assert {r["reviewer"] for r in rows} == {"code", "memory", "security"}
        assert all(r["passed"] for r in rows)

    @pytest.mark.asyncio
    async def test_blocked_task_persists_blocked_verdict(self, supervisor):
        await supervisor.execute_approved_tasks(
            mission_id="m_persist",
            objective="x",
            all_tasks=[INJECTION_TASK],
            approved_task_ids=["t_per2"],
            abac_policy=WIDE_POLICY,
        )

        rows = supervisor.audit_service.list_review_results("m_persist")
        assert len(rows) == 3
        blocked = [r for r in rows if not r["passed"]]
        assert len(blocked) == 1
        assert blocked[0]["reviewer"] == "code"
        assert "injection" in blocked[0]["reason"].lower()

    @pytest.mark.asyncio
    async def test_cost_alert_persisted(self, supervisor):
        # Tiny threshold (set in fixture) makes any tool execution trip the alert
        await supervisor.execute_approved_tasks(
            mission_id="m_persist",
            objective="x",
            all_tasks=[CLEAN_TASK],
            approved_task_ids=["t_per1"],
            abac_policy=WIDE_POLICY,
        )

        alerts = supervisor.audit_service.list_cost_alerts("m_persist")
        assert len(alerts) >= 1
        assert alerts[0]["mission_id"] == "m_persist"
        assert alerts[0]["level"] in ("warning", "critical")
