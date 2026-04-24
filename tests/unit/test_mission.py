"""
Unit tests for Mission Object.

Spec sections: 1–2
Tests cover: Mission creation, state transitions, approvals, audit logs, ABAC.
"""

import pytest
from datetime import datetime
from uuid import uuid4

from backend.models.mission import (
    Mission, MissionMode, MissionState, ApprovalRecord, AuditLogEntry,
    ToolDefinition, ToolRegistry, ABACEngine, ABACPolicy
)


class TestMissionCreation:
    """Test Mission object instantiation and validation."""

    def test_mission_created_successfully(self):
        """Minimal valid Mission should create."""
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test mission",
            created_by="user1",
            approvers=["user2"]
        )
        assert mission.state == MissionState.CREATED
        assert mission.mode == MissionMode.BATMAN
        assert mission.objective == "Test mission"

    def test_batman_mode_requires_approvers(self):
        """BATMAN mode without approvers should raise validation error."""
        with pytest.raises(ValueError, match="requires at least one approver"):
            Mission(
                mode=MissionMode.BATMAN,
                objective="Test",
                created_by="user1",
                approvers=[]
            )

    def test_jarvis_mode_no_approvers_required(self):
        """JARVIS mode should not require approvers."""
        mission = Mission(
            mode=MissionMode.JARVIS,
            objective="Test",
            created_by="user1"
        )
        assert mission.mode == MissionMode.JARVIS
        assert mission.approvers == []

    def test_invalid_memory_scope(self):
        """Invalid memory_scope should raise validation error."""
        with pytest.raises(ValueError, match="memory_scope must be"):
            Mission(
                mode=MissionMode.JARVIS,
                objective="Test",
                created_by="user1",
                memory_scope="invalid"
            )

    def test_mission_has_unique_id(self):
        """Each Mission should have a unique UUID."""
        m1 = Mission(mode=MissionMode.JARVIS, objective="Test1", created_by="user1")
        m2 = Mission(mode=MissionMode.JARVIS, objective="Test2", created_by="user1")
        assert m1.id != m2.id


class TestAuditLog:
    """Test immutable audit logging."""

    def test_add_audit_entry(self):
        """Audit entry should be added to log."""
        mission = Mission(
            mode=MissionMode.JARVIS,
            objective="Test",
            created_by="user1"
        )
        mission.add_audit_entry(
            event_type="state_change",
            actor="user1",
            details={"from": "created", "to": "executing"}
        )
        assert len(mission.audit_log) == 1
        assert mission.audit_log[0].event_type == "state_change"

    def test_audit_entry_tracks_cost(self):
        """Cost in audit entry should accumulate to actual_cost_usd."""
        mission = Mission(
            mode=MissionMode.JARVIS,
            objective="Test",
            created_by="user1"
        )
        mission.add_audit_entry(
            event_type="tool_invoked",
            actor="system",
            details={"tool": "web_search"},
            cost_usd=0.05
        )
        assert mission.actual_cost_usd == 0.05

    def test_audit_entry_immutable(self):
        """Audit entries should be immutable (frozen)."""
        mission = Mission(
            mode=MissionMode.JARVIS,
            objective="Test",
            created_by="user1"
        )
        mission.add_audit_entry(
            event_type="test",
            actor="user1"
        )
        entry = mission.audit_log[0]

        with pytest.raises(Exception):  # pydantic frozen=True raises
            entry.event_type = "modified"


class TestApprovalChain:
    """Test approval logic for BATMAN mode."""

    def test_batman_can_execute_after_all_approvals(self):
        """BATMAN should be executable only after all approvers approve."""
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test",
            created_by="user1",
            approvers=["user2", "user3"]
        )
        assert not mission.can_execute()

        # One approval
        mission.approvals.append(
            ApprovalRecord(approver_id="user2", decision="approved")
        )
        assert not mission.can_execute()

        # Second approval
        mission.approvals.append(
            ApprovalRecord(approver_id="user3", decision="approved")
        )
        assert mission.can_execute()

    def test_jarvis_always_executable(self):
        """JARVIS mode should always be executable (no approval needed)."""
        mission = Mission(
            mode=MissionMode.JARVIS,
            objective="Test",
            created_by="user1"
        )
        assert mission.can_execute()

    def test_wakanda_executable_with_one_approval(self):
        """WAKANDA mode should be executable with at least one approval."""
        mission = Mission(
            mode=MissionMode.WAKANDA,
            objective="Test",
            created_by="user1",
            approvers=["user2", "user3"]
        )
        assert not mission.can_execute()

        mission.approvals.append(
            ApprovalRecord(approver_id="user2", decision="approved")
        )
        assert mission.can_execute()


class TestToolRegistry:
    """Test tool registry functionality."""

    def test_register_and_retrieve_tool(self):
        """Should register and retrieve tools."""
        registry = ToolRegistry()
        tool = ToolDefinition(
            name="web_search",
            description="Search the web"
        )
        registry.register_tool(tool)
        assert registry.get_tool("web_search") is not None

    def test_can_use_tool_checks_mode(self):
        """can_use_tool should check if mode is allowed."""
        registry = ToolRegistry()
        tool = ToolDefinition(
            name="dangerous_tool",
            description="Risky operation",
            allowed_in_modes=[MissionMode.BATMAN]  # Only BATMAN
        )
        registry.register_tool(tool)

        batman_mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test",
            created_by="user1",
            approvers=["user2"]
        )
        jarvis_mission = Mission(
            mode=MissionMode.JARVIS,
            objective="Test",
            created_by="user1"
        )

        assert registry.can_use_tool("dangerous_tool", batman_mission)
        assert not registry.can_use_tool("dangerous_tool", jarvis_mission)

    def test_can_use_tool_checks_allowed_list(self):
        """Tool in registry but not in mission's allowed_tools should be denied."""
        registry = ToolRegistry()
        tool = ToolDefinition(
            name="web_search",
            description="Search the web"
        )
        registry.register_tool(tool)

        mission = Mission(
            mode=MissionMode.JARVIS,
            objective="Test",
            created_by="user1",
            allowed_tools=["run_code"]  # web_search not in list
        )
        assert not registry.can_use_tool("web_search", mission)


class TestABAC:
    """Test ABAC enforcement."""

    def test_abac_allows_matching_policy(self):
        """Actor with matching role should be allowed by ABAC."""
        engine = ABACEngine()
        mission = Mission(
            mode=MissionMode.JARVIS,
            objective="Test",
            created_by="user1"
        )
        policy = ABACPolicy(
            actor_roles=["admin"],
            tool_name="web_search",
            mission_id=mission.id,
            allowed=True
        )
        engine.add_policy(policy)

        allowed = engine.check_access("user1", ["admin"], "web_search", mission)
        assert allowed

    def test_abac_denies_non_matching_policy(self):
        """Actor without matching role should be denied."""
        engine = ABACEngine()
        mission = Mission(
            mode=MissionMode.JARVIS,
            objective="Test",
            created_by="user1"
        )
        policy = ABACPolicy(
            actor_roles=["admin"],
            tool_name="web_search",
            mission_id=mission.id,
            allowed=True
        )
        engine.add_policy(policy)

        allowed = engine.check_access("user2", ["viewer"], "web_search", mission)
        assert not allowed  # Default deny


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
