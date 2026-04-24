"""
Unit tests for WakandaSupervisor — Phase 3 §9–11.

Mode mapping: Wakanda = ATS / All the Smoke (label, mixed/selective approval).

Wakanda contract:
  - GateClassifier marks each task as gated or pass-through after decompose
  - Pass-through tasks run immediately (review → execute → audit), like Jarvis
  - Gated tasks pause in the approval queue, like Batman
  - Operator approves/rejects gated tasks one by one
  - On approve: task runs review → execute path
  - On reject: task marked rejected, mission continues
  - Mission status = "completed" if all completed, "partial" if mixed, "failed" if none completed

Conservative defaults locked 2026-04-24 (per docs/SPEC_PHASE3_WAKANDA.md):
  - Default-when-unsure → GATE
  - Reject one task → other pass-through tasks keep running
  - Single operator string, multi-approver deferred to Phase 4
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.agents.wakanda_supervisor import GateClassifier, WakandaSupervisor
from backend.db.models import Base, Mission, MissionMode, MissionState
from backend.services.audit_service import AuditService
from backend.services.cost_alert_service import CostAlertService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

WIDE_POLICY = {
    "allowed_tools": [
        "read_file",
        "write_file",
        "execute_script",
        "search_knowledge",
        "call_api",
        "text_generator",
        "scheduler",
        "search",
        "summarizer",
    ],
    "forbidden_params": ["api_key", "secret", "password", "token"],
}


def _stamp(mission_id: str, raw_tasks: list[dict]) -> list[dict]:
    return [
        {
            "id": f"tw_{i + 1}",
            "mission_id": mission_id,
            "status": "pending",
            **t,
        }
        for i, t in enumerate(raw_tasks)
    ]


@pytest.fixture
def session_factory():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    s = TestSession()
    s.add(
        Mission(
            id="m_wakanda",
            objective="Wakanda test mission",
            mode=MissionMode.WAKANDA,
            state=MissionState.EXECUTING,
            approvers=["operator"],
        )
    )
    s.commit()
    s.close()
    return TestSession


def _mock_decomposer(tasks_factory):
    d = MagicMock()
    d.run = AsyncMock(side_effect=lambda mission_id, objective: tasks_factory(mission_id))
    return d


# ---------------------------------------------------------------------------
# GateClassifier tests
# ---------------------------------------------------------------------------


class TestGateClassifier:
    def setup_method(self):
        self.classifier = GateClassifier()

    def test_manual_override_true_forces_gate(self):
        task = {
            "suggested_tool": "search_knowledge",  # would normally pass through
            "risk_level": "low",
            "requires_approval": True,  # manual override
        }
        assert self.classifier.is_gated(task, abac_policy=None) is True

    def test_manual_override_false_forces_pass(self):
        task = {
            "suggested_tool": "execute_script",  # would normally gate
            "risk_level": "high",
            "requires_approval": False,  # manual override
        }
        # Manual override TRUE has priority, but FALSE does NOT downgrade
        # safety-critical defaults — high risk still gates per conservative
        # default. Manual-pass is honored only when the task is otherwise
        # ambiguous, not when it would be gated for safety reasons.
        assert self.classifier.is_gated(task, abac_policy=None) is True

    def test_high_risk_always_gates(self):
        task = {
            "suggested_tool": "search_knowledge",
            "risk_level": "high",
        }
        assert self.classifier.is_gated(task, abac_policy=None) is True

    def test_tool_requires_approval_gates(self):
        # write_file has requires_approval=True in the registry
        task = {
            "suggested_tool": "write_file",
            "risk_level": "low",
        }
        assert self.classifier.is_gated(task, abac_policy=None) is True

    def test_low_risk_safe_tool_passes_through(self):
        # search_knowledge: requires_approval=False, low risk
        task = {
            "suggested_tool": "search_knowledge",
            "risk_level": "low",
        }
        assert self.classifier.is_gated(task, abac_policy=None) is False

    def test_unknown_tool_gates_by_default(self):
        # Conservative default: unknown tool → gate
        task = {
            "suggested_tool": "publish_release_to_spotify",  # not in registry
            "risk_level": "low",
        }
        assert self.classifier.is_gated(task, abac_policy=None) is True

    def test_missing_risk_level_gates(self):
        # Missing field → conservative gate
        task = {"suggested_tool": "search_knowledge"}
        assert self.classifier.is_gated(task, abac_policy=None) is True

    def test_abac_always_gate_overrides_safe_tool(self):
        task = {
            "suggested_tool": "search_knowledge",  # would pass
            "risk_level": "low",
        }
        policy = {
            "allowed_tools": ["search_knowledge"],
            "wakanda_gate_overrides": {
                "always_gate": ["search_knowledge"],
                "always_pass": [],
            },
        }
        assert self.classifier.is_gated(task, abac_policy=policy) is True

    def test_abac_always_pass_overrides_default_gate(self):
        # write_file would gate (requires_approval=True), but operator
        # whitelisted it for this mission via always_pass
        task = {
            "suggested_tool": "write_file",
            "risk_level": "low",
        }
        policy = {
            "allowed_tools": ["write_file"],
            "wakanda_gate_overrides": {
                "always_gate": [],
                "always_pass": ["write_file"],
            },
        }
        assert self.classifier.is_gated(task, abac_policy=policy) is False

    def test_high_risk_beats_always_pass(self):
        # Safety floor: high risk cannot be downgraded by always_pass
        task = {
            "suggested_tool": "execute_script",
            "risk_level": "high",
        }
        policy = {
            "wakanda_gate_overrides": {
                "always_gate": [],
                "always_pass": ["execute_script"],
            },
        }
        assert self.classifier.is_gated(task, abac_policy=policy) is True


# ---------------------------------------------------------------------------
# WakandaSupervisor lifecycle tests
# ---------------------------------------------------------------------------


@pytest.fixture
def supervisor_factory(session_factory):
    def _build(decomposer):
        return WakandaSupervisor(
            decomposer=decomposer,
            cost_alert_service=CostAlertService(threshold=10.0),  # high so no alerts in basic tests
            audit_service=AuditService(session_factory=session_factory),
        )
    return _build


class TestWakandaLifecycle:
    @pytest.mark.asyncio
    async def test_run_classifies_and_executes_pass_through_immediately(self, supervisor_factory):
        # Two tasks: one pass-through (search_knowledge, low risk), one gated (write_file)
        def factory(mission_id):
            return _stamp(mission_id, [
                {
                    "name": "Search docs",
                    "description": "Read internal docs",
                    "suggested_tool": "search_knowledge",
                    "risk_level": "low",
                    "parameters": {"query": "ats roster"},
                },
                {
                    "name": "Update metadata",
                    "description": "Write metadata changes",
                    "suggested_tool": "write_file",
                    "risk_level": "low",
                    "parameters": {"path": "metadata.json"},
                },
            ])

        sup = supervisor_factory(_mock_decomposer(factory))

        result = await sup.run_mission(
            mission_id="m_wakanda",
            objective="Roster work",
            abac_policy=WIDE_POLICY,
        )

        # Pass-through task ran; gated task is queued
        assert len(result["pass_through_results"]) == 1
        assert result["pass_through_results"][0]["status"] == "completed"
        assert len(result["gated_task_ids"]) == 1
        # Tasks list is full so cockpit can render both queues
        assert len(result["tasks"]) == 2

    @pytest.mark.asyncio
    async def test_approve_gated_task_executes_it(self, supervisor_factory):
        def factory(mission_id):
            return _stamp(mission_id, [
                {
                    "name": "Update metadata",
                    "description": "Edit a file",
                    "suggested_tool": "write_file",
                    "risk_level": "low",
                    "parameters": {"path": "metadata.json"},
                },
            ])

        sup = supervisor_factory(_mock_decomposer(factory))
        run = await sup.run_mission(
            mission_id="m_wakanda",
            objective="Edit metadata",
            abac_policy=WIDE_POLICY,
        )
        gated_id = run["gated_task_ids"][0]

        # Operator approves the gated task
        approve_result = await sup.approve_gated_task(
            mission_id="m_wakanda",
            task_id=gated_id,
            approved=True,
            approver_id="operator",
        )
        assert approve_result["status"] == "completed"

    @pytest.mark.asyncio
    async def test_reject_gated_task_marks_it_rejected_no_cascade(self, supervisor_factory):
        def factory(mission_id):
            return _stamp(mission_id, [
                # one pass-through, one gated
                {
                    "name": "Search",
                    "description": "Search docs",
                    "suggested_tool": "search_knowledge",
                    "risk_level": "low",
                    "parameters": {"query": "x"},
                },
                {
                    "name": "Edit",
                    "description": "Edit a file",
                    "suggested_tool": "write_file",
                    "risk_level": "low",
                    "parameters": {"path": "x.json"},
                },
            ])

        sup = supervisor_factory(_mock_decomposer(factory))
        run = await sup.run_mission(
            mission_id="m_wakanda",
            objective="x",
            abac_policy=WIDE_POLICY,
        )
        gated_id = run["gated_task_ids"][0]
        # The pass-through already completed
        assert run["pass_through_results"][0]["status"] == "completed"

        # Reject the gated one — should NOT undo the pass-through
        reject_result = await sup.approve_gated_task(
            mission_id="m_wakanda",
            task_id=gated_id,
            approved=False,
            approver_id="operator",
            reason="Don't ship this yet",
        )
        assert reject_result["status"] == "rejected"

    @pytest.mark.asyncio
    async def test_unknown_tool_gates_so_supervisor_doesnt_run_it(self, supervisor_factory):
        def factory(mission_id):
            return _stamp(mission_id, [
                {
                    "name": "Publish",
                    "description": "Publish to platform",
                    "suggested_tool": "publish_release_to_spotify",  # unknown
                    "risk_level": "low",
                    "parameters": {},
                },
            ])

        sup = supervisor_factory(_mock_decomposer(factory))
        run = await sup.run_mission(
            mission_id="m_wakanda",
            objective="Try unknown tool",
            abac_policy=WIDE_POLICY,
        )
        assert len(run["pass_through_results"]) == 0
        assert len(run["gated_task_ids"]) == 1

    @pytest.mark.asyncio
    async def test_audit_persistence_for_pass_through_tasks(self, supervisor_factory):
        def factory(mission_id):
            return _stamp(mission_id, [
                {
                    "name": "Search",
                    "description": "Read docs",
                    "suggested_tool": "search_knowledge",
                    "risk_level": "low",
                    "parameters": {"query": "x"},
                },
            ])

        sup = supervisor_factory(_mock_decomposer(factory))
        await sup.run_mission(
            mission_id="m_wakanda",
            objective="Persist",
            abac_policy=WIDE_POLICY,
        )

        # 3 reviewers ran on the pass-through task
        rows = sup.audit_service.list_review_results("m_wakanda")
        assert len(rows) == 3
        assert all(r["mission_id"] == "m_wakanda" for r in rows)

    @pytest.mark.asyncio
    async def test_review_block_on_pass_through_does_not_block_other_pass_through(self, supervisor_factory):
        def factory(mission_id):
            return _stamp(mission_id, [
                {
                    "name": "Clean search",
                    "description": "Search docs",
                    "suggested_tool": "search_knowledge",
                    "risk_level": "low",
                    "parameters": {"query": "x"},
                },
                {
                    "name": "Sneaky search",
                    "description": "Slip through",
                    "suggested_tool": "search_knowledge",
                    "risk_level": "low",
                    "parameters": {"query": "ok; rm -rf /"},  # injection
                },
            ])

        sup = supervisor_factory(_mock_decomposer(factory))
        run = await sup.run_mission(
            mission_id="m_wakanda",
            objective="Mixed safety",
            abac_policy=WIDE_POLICY,
        )

        # Both classified as pass-through, but the injection one gets review-blocked
        statuses = sorted(r["status"] for r in run["pass_through_results"])
        assert statuses == ["completed", "review_blocked"]
