"""Unit tests for AuditService — review results + cost alerts persistence.

Spec reference: Phase 2 §6–8 (review-gate audit) and §15–17 (cost monitoring).

Uses SQLite in-memory to keep tests hermetic — no Postgres dependency.
"""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db.models import Base, Mission, MissionMode, MissionState
from backend.services.audit_service import AuditService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def session_factory():
    """SQLite in-memory session factory with all tables created."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)

    # Seed a Mission row so FK constraints are satisfied
    s = TestSession()
    s.add(
        Mission(
            id="m_audit1",
            objective="Audit test mission",
            mode=MissionMode.BATMAN,
            state=MissionState.EXECUTING,
            approvers=["op@x.com"],
        )
    )
    s.add(
        Mission(
            id="m_audit2",
            objective="Second mission for isolation test",
            mode=MissionMode.BATMAN,
            state=MissionState.EXECUTING,
            approvers=["op@x.com"],
        )
    )
    s.commit()
    s.close()

    return TestSession


@pytest.fixture
def service(session_factory):
    return AuditService(session_factory=session_factory)


# ---------------------------------------------------------------------------
# Review results
# ---------------------------------------------------------------------------


SAMPLE_PASSED_REVIEW = [
    {"passed": True, "reason": "Code review passed.", "reviewer": "code"},
    {"passed": True, "reason": "Memory scope review passed.", "reviewer": "memory"},
    {"passed": True, "reason": "Security review passed.", "reviewer": "security"},
]

SAMPLE_BLOCKED_REVIEW = [
    {"passed": True, "reason": "Code review passed.", "reviewer": "code"},
    {"passed": True, "reason": "Memory scope review passed.", "reviewer": "memory"},
    {
        "passed": False,
        "reason": "Tool 'read_file' is not permitted by the ABAC policy for this mission mode.",
        "reviewer": "security",
    },
]


class TestReviewResults:
    def test_record_returns_one_id_per_reviewer(self, service):
        ids = service.record_review_results("m_audit1", "t_abc", SAMPLE_PASSED_REVIEW)
        assert len(ids) == 3
        assert all(i.startswith("rr_") for i in ids)
        assert len(set(ids)) == 3  # unique

    def test_list_returns_all_recorded_for_mission(self, service):
        service.record_review_results("m_audit1", "t_abc", SAMPLE_PASSED_REVIEW)
        service.record_review_results("m_audit1", "t_def", SAMPLE_BLOCKED_REVIEW)

        rows = service.list_review_results("m_audit1")
        assert len(rows) == 6
        # one is blocked
        blocked = [r for r in rows if not r["passed"]]
        assert len(blocked) == 1
        assert blocked[0]["reviewer"] == "security"
        assert "ABAC" in blocked[0]["reason"]

    def test_review_results_are_mission_scoped(self, service):
        """Reviewers from one mission must not leak into another."""
        service.record_review_results("m_audit1", "t_abc", SAMPLE_PASSED_REVIEW)
        service.record_review_results("m_audit2", "t_xyz", SAMPLE_BLOCKED_REVIEW)

        m1 = service.list_review_results("m_audit1")
        m2 = service.list_review_results("m_audit2")
        assert len(m1) == 3
        assert len(m2) == 3
        assert all(r["mission_id"] == "m_audit1" for r in m1)
        assert all(r["mission_id"] == "m_audit2" for r in m2)

    def test_empty_list_for_unknown_mission(self, service):
        assert service.list_review_results("m_does_not_exist") == []


# ---------------------------------------------------------------------------
# Cost alerts
# ---------------------------------------------------------------------------


WARNING_ALERT = {
    "mission_id": "m_audit1",
    "current_cost": 0.85,
    "threshold": 1.00,
    "level": "warning",
    "message": "Mission cost at 85.0% of $1.00 threshold",
}

CRITICAL_ALERT = {
    "mission_id": "m_audit1",
    "current_cost": 1.05,
    "threshold": 1.00,
    "level": "critical",
    "message": "Mission cost at 105.0% of $1.00 threshold",
}


class TestCostAlerts:
    def test_record_returns_id(self, service):
        row_id = service.record_cost_alert(WARNING_ALERT)
        assert row_id.startswith("ca_")

    def test_list_returns_recorded_alerts_in_fire_order(self, service):
        service.record_cost_alert(WARNING_ALERT)
        service.record_cost_alert(CRITICAL_ALERT)

        rows = service.list_cost_alerts("m_audit1")
        assert len(rows) == 2
        levels = [r["level"] for r in rows]
        assert levels == ["warning", "critical"]
        assert rows[0]["current_cost"] == pytest.approx(0.85)
        assert rows[1]["current_cost"] == pytest.approx(1.05)

    def test_alerts_are_mission_scoped(self, service):
        service.record_cost_alert(WARNING_ALERT)  # m_audit1
        service.record_cost_alert({**CRITICAL_ALERT, "mission_id": "m_audit2"})

        m1 = service.list_cost_alerts("m_audit1")
        m2 = service.list_cost_alerts("m_audit2")
        assert len(m1) == 1
        assert len(m2) == 1
        assert m1[0]["level"] == "warning"
        assert m2[0]["level"] == "critical"

    def test_empty_list_for_unknown_mission(self, service):
        assert service.list_cost_alerts("m_does_not_exist") == []
