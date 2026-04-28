"""
Phase 4 — ABACEnforcer role integration tests.

Verifies that the Phase 2 ABACEnforcer is backwards-compatible
AND that Phase 4 role-based checks layer on top correctly.
"""

import pytest
from backend.models.mission import Mission, MissionMode
from backend.services.abac_enforcer import ABACEnforcer, enforce_abac_on_tool_invocation


@pytest.fixture
def batman_mission():
    return Mission(
        created_by="nick",
        mode=MissionMode.BATMAN,
        objective="test",
        approvers=["nick"],
        abac_policy={"allowed_tools": ["text_generator", "search", "summarizer"]},
    )


@pytest.fixture
def jarvis_mission():
    return Mission(
        created_by="nick",
        mode=MissionMode.JARVIS,
        objective="test",
        abac_policy={"allowed_tools": ["text_generator", "search", "code_reviewer"]},
    )


@pytest.fixture
def enforcer():
    return ABACEnforcer()


# ── Backwards compatibility (Phase 2 behavior unchanged) ──────────────────────

def test_no_roles_uses_policy_only_allowed(enforcer, batman_mission):
    allowed, reason = enforcer.can_invoke_tool(batman_mission, "text_generator")
    assert allowed is True
    assert reason == ""


def test_no_roles_uses_policy_only_blocked(enforcer, batman_mission):
    allowed, reason = enforcer.can_invoke_tool(batman_mission, "run_code")
    assert allowed is False
    assert "not permitted" in reason


def test_no_policy_blocked(enforcer):
    mission = Mission(
        created_by="nick",
        mode=MissionMode.JARVIS,
        objective="test",
        abac_policy=None,
    )
    allowed, reason = enforcer.can_invoke_tool(mission, "search")
    assert allowed is False
    assert "no ABAC policy" in reason


# ── Phase 4: role check + policy check both required ─────────────────────────

def test_operator_role_and_policy_allows(enforcer, batman_mission):
    allowed, reason = enforcer.can_invoke_tool(
        batman_mission, "text_generator", actor_roles=["operator"]
    )
    assert allowed is True


def test_viewer_role_blocked_even_if_in_policy(enforcer, batman_mission):
    # viewer has no tool permissions — blocked at role check
    allowed, reason = enforcer.can_invoke_tool(
        batman_mission, "text_generator", actor_roles=["viewer"]
    )
    assert allowed is False
    assert "Role check blocked" in reason


def test_operator_role_blocked_by_mode(enforcer, jarvis_mission):
    # Jarvis mode blocks send_email at mode level
    # First add send_email to policy so we isolate the mode block
    jarvis_mission.abac_policy["allowed_tools"].append("send_email")
    allowed, reason = enforcer.can_invoke_tool(
        jarvis_mission, "send_email", actor_roles=["operator"]
    )
    assert allowed is False
    assert "Role check blocked" in reason


def test_admin_role_still_needs_policy(enforcer, batman_mission):
    # admin role grants access to all tools via role check
    # but mission policy doesn't list 'run_code'
    # Phase 4 behavior: role check passes (admin), policy check fails
    allowed, reason = enforcer.can_invoke_tool(
        batman_mission, "run_code", actor_roles=["admin"]
    )
    assert allowed is False
    assert "not permitted" in reason


def test_enforce_function_with_roles(batman_mission):
    allowed, reason = enforce_abac_on_tool_invocation(
        batman_mission, "text_generator", actor_roles=["operator"]
    )
    assert allowed is True


def test_enforce_function_backwards_compatible(batman_mission):
    # No roles — Phase 2 behavior
    allowed, reason = enforce_abac_on_tool_invocation(batman_mission, "search")
    assert allowed is True
