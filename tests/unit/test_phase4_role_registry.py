"""
Phase 4 — Objective 2 + 3: Role Registry + Role-Based Tool Access Tests.

Verifies least-privilege ABAC with role-based extensions and role-based tool access.
"""

import pytest
from backend.services.role_registry import RoleRegistry, ADMIN_ONLY_TOOLS, MODE_BLOCKED_TOOLS


@pytest.fixture
def registry():
    return RoleRegistry()


# ── Admin role ────────────────────────────────────────────────────────────────

def test_admin_can_invoke_any_tool(registry):
    allowed, reason = registry.can_invoke(["admin"], "some_random_tool", "batman")
    assert allowed is True
    assert reason == ""


def test_admin_can_invoke_admin_only_tools(registry):
    for tool in list(ADMIN_ONLY_TOOLS)[:3]:
        allowed, _ = registry.can_invoke(["admin"], tool, "batman")
        assert allowed is True, f"Admin should be allowed: {tool}"


# ── Operator role ─────────────────────────────────────────────────────────────

def test_operator_can_invoke_allowed_tools(registry):
    for tool in ["text_generator", "search", "summarizer", "code_reviewer"]:
        allowed, _ = registry.can_invoke(["operator"], tool, "batman")
        assert allowed is True, f"Operator should be allowed: {tool}"


def test_operator_cannot_invoke_admin_only_tool(registry):
    allowed, reason = registry.can_invoke(["operator"], "send_email", "batman")
    assert allowed is False
    assert "admin" in reason


def test_operator_cannot_invoke_unknown_tool(registry):
    allowed, reason = registry.can_invoke(["operator"], "nuke_database", "batman")
    assert allowed is False


# ── Viewer role ───────────────────────────────────────────────────────────────

def test_viewer_cannot_invoke_any_tool(registry):
    for tool in ["text_generator", "search", "summarizer"]:
        allowed, reason = registry.can_invoke(["viewer"], tool, "batman")
        assert allowed is False, f"Viewer should be blocked: {tool}"


# ── Agent role ────────────────────────────────────────────────────────────────

def test_agent_can_invoke_safe_tools(registry):
    for tool in ["text_generator", "search", "summarizer", "memory_reader", "file_read"]:
        allowed, _ = registry.can_invoke(["agent"], tool, "batman")
        assert allowed is True, f"Agent should be allowed: {tool}"


def test_agent_cannot_invoke_code_reviewer(registry):
    # code_reviewer is operator-level, not agent-level
    allowed, _ = registry.can_invoke(["agent"], "code_reviewer", "batman")
    assert allowed is False


# ── Mode-based blocks ─────────────────────────────────────────────────────────

def test_jarvis_blocks_send_email_regardless_of_role(registry):
    allowed, reason = registry.can_invoke(["operator"], "send_email", "jarvis")
    assert allowed is False
    assert "blocked in mode" in reason


def test_jarvis_blocks_payment_initiate(registry):
    allowed, _ = registry.can_invoke(["admin"], "payment_initiate", "jarvis")
    assert allowed is False


def test_wakanda_blocks_payment_initiate(registry):
    allowed, _ = registry.can_invoke(["admin"], "payment_initiate", "wakanda")
    assert allowed is False


def test_batman_has_no_blanket_blocks(registry):
    # Batman approves everything — no mode-level blocks
    assert len(MODE_BLOCKED_TOOLS.get("batman", set())) == 0


# ── Multiple roles — union of permissions ─────────────────────────────────────

def test_viewer_plus_operator_gets_operator_perms(registry):
    allowed, _ = registry.can_invoke(["viewer", "operator"], "text_generator", "batman")
    assert allowed is True


def test_agent_plus_admin_gets_admin_perms(registry):
    allowed, _ = registry.can_invoke(["agent", "admin"], "send_email", "batman")
    assert allowed is True


# ── Role validation ───────────────────────────────────────────────────────────

def test_validate_known_roles(registry):
    valid, reason = registry.validate_roles(["admin", "operator", "viewer", "agent"])
    assert valid is True


def test_validate_unknown_role(registry):
    valid, reason = registry.validate_roles(["superuser"])
    assert valid is False
    assert "Unknown roles" in reason


# ── get_allowed_tools ─────────────────────────────────────────────────────────

def test_viewer_has_no_allowed_tools(registry):
    tools = registry.get_allowed_tools(["viewer"], "batman")
    assert len(tools) == 0


def test_operator_allowed_tools_excludes_mode_blocks(registry):
    # Jarvis blocks send_email — even if operator has it, should be excluded
    tools = registry.get_allowed_tools(["operator"], "jarvis")
    assert "send_email" not in tools


def test_admin_gets_wildcard(registry):
    tools = registry.get_allowed_tools(["admin"], "batman")
    assert "*" in tools
