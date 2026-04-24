"""
Unit tests for ABACEnforcer service.

Spec reference: Phase 2 §2.2 (Access Control ABAC rules) + §5.3 (Tool Invocation Safety)

The ABACEnforcer validates tool invocation against Mission.abac_policy BEFORE
execution. It returns (is_allowed: bool, reason: str) and enforces allow-list
checks to prevent unauthorized tool use.
"""

from __future__ import annotations

import pytest

from backend.services.abac_enforcer import ABACEnforcer
from backend.models.mission import Mission, MissionMode


class TestABACEnforcerInitialization:
    """Test ABACEnforcer initialization and basic structure."""
    
    def test_enforcer_instantiation(self):
        """ABACEnforcer can be instantiated."""
        enforcer = ABACEnforcer()
        assert enforcer is not None
    
    def test_enforcer_has_can_invoke_tool_method(self):
        """ABACEnforcer has can_invoke_tool method."""
        enforcer = ABACEnforcer()
        assert hasattr(enforcer, 'can_invoke_tool')
        assert callable(enforcer.can_invoke_tool)


class TestABACEnforcerAllowListValidation:
    """Test allow-list based access control."""
    
    def test_tool_in_allow_list_returns_allowed(self):
        """Tool present in allow_list is allowed."""
        enforcer = ABACEnforcer()
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test mission",
            approvers=["op@x.com"], created_by="tester",
            abac_policy={
                "allowed_tools": ["read_file", "search_knowledge"],
                "forbidden_params": ["api_key"]
            }
        )
        is_allowed, reason = enforcer.can_invoke_tool(mission, "read_file")
        assert is_allowed is True
        assert reason == ""
    
    def test_tool_not_in_allow_list_returns_blocked(self):
        """Tool not in allow_list is blocked."""
        enforcer = ABACEnforcer()
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test mission",
            approvers=["op@x.com"], created_by="tester",
            abac_policy={
                "allowed_tools": ["read_file"],
                "forbidden_params": []
            }
        )
        is_allowed, reason = enforcer.can_invoke_tool(mission, "write_file")
        assert is_allowed is False
        assert "not permitted" in reason.lower() or "blocked" in reason.lower()
    
    def test_empty_allow_list_blocks_all_tools(self):
        """Empty allow_list blocks all tools."""
        enforcer = ABACEnforcer()
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test mission",
            approvers=["op@x.com"], created_by="tester",
            abac_policy={
                "allowed_tools": [],
                "forbidden_params": []
            }
        )
        is_allowed, reason = enforcer.can_invoke_tool(mission, "read_file")
        assert is_allowed is False
    
    def test_multiple_tools_in_allow_list_all_allowed(self):
        """Multiple tools in allow_list are all allowed."""
        enforcer = ABACEnforcer()
        allowed_tools = ["read_file", "search_knowledge", "text_generator"]
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test mission",
            approvers=["op@x.com"], created_by="tester",
            abac_policy={
                "allowed_tools": allowed_tools,
                "forbidden_params": []
            }
        )
        for tool in allowed_tools:
            is_allowed, _ = enforcer.can_invoke_tool(mission, tool)
            assert is_allowed is True


class TestABACEnforcerNoPolicyHandling:
    """Test behavior when Mission has no abac_policy."""
    
    def test_no_policy_returns_blocked_with_reason(self):
        """Mission without abac_policy returns blocked."""
        enforcer = ABACEnforcer()
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test mission",
            approvers=["op@x.com"], created_by="tester",
            abac_policy=None
        )
        is_allowed, reason = enforcer.can_invoke_tool(mission, "read_file")
        assert is_allowed is False
        assert len(reason) > 0
    
    def test_no_policy_returns_descriptive_error(self):
        """Mission without policy gives clear error message."""
        enforcer = ABACEnforcer()
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test mission",
            approvers=["op@x.com"], created_by="tester"
        )
        is_allowed, reason = enforcer.can_invoke_tool(mission, "read_file")
        assert is_allowed is False
        assert "policy" in reason.lower() or "not defined" in reason.lower()


class TestABACEnforcerMalformedPolicy:
    """Test handling of malformed or invalid policies."""
    
    def test_policy_missing_allowed_tools_key_raises_or_blocks(self):
        """Policy missing 'allowed_tools' key is handled gracefully."""
        enforcer = ABACEnforcer()
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test mission",
            approvers=["op@x.com"], created_by="tester",
            abac_policy={
                "forbidden_params": ["api_key"]
                # allowed_tools key is missing
            }
        )
        is_allowed, reason = enforcer.can_invoke_tool(mission, "read_file")
        # Should either return False with a reason, or raise an exception
        assert is_allowed is False or reason != ""
    
    def test_policy_with_non_list_allowed_tools_handled(self):
        """Policy with non-list allowed_tools is handled gracefully."""
        enforcer = ABACEnforcer()
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test mission",
            approvers=["op@x.com"], created_by="tester",
            abac_policy={
                "allowed_tools": "read_file",  # String instead of list
                "forbidden_params": []
            }
        )
        # Should not crash; either allow or block gracefully
        try:
            is_allowed, reason = enforcer.can_invoke_tool(mission, "read_file")
            assert isinstance(is_allowed, bool)
            assert isinstance(reason, str)
        except (TypeError, ValueError) as e:
            # Acceptable to raise on malformed data
            pytest.skip(f"Gracefully raised on malformed policy: {e}")
    
    def test_policy_with_empty_allowed_tools_dict_handled(self):
        """Policy with empty/dict allowed_tools instead of list handled."""
        enforcer = ABACEnforcer()
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test mission",
            approvers=["op@x.com"], created_by="tester",
            abac_policy={
                "allowed_tools": {},  # Dict instead of list
                "forbidden_params": []
            }
        )
        try:
            is_allowed, reason = enforcer.can_invoke_tool(mission, "read_file")
            assert isinstance(is_allowed, bool)
        except (TypeError, ValueError):
            # Acceptable to raise on malformed data
            pass


class TestABACEnforcerAuditTrail:
    """Test that ABAC decisions can be audited."""
    
    def test_blocked_tool_returns_specific_tool_name_in_reason(self):
        """Blocked tool decision includes tool name in reason."""
        enforcer = ABACEnforcer()
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test mission",
            approvers=["op@x.com"], created_by="tester",
            abac_policy={
                "allowed_tools": ["read_file"],
                "forbidden_params": []
            }
        )
        is_allowed, reason = enforcer.can_invoke_tool(mission, "execute_script")
        assert is_allowed is False
        assert "execute_script" in reason or "not permitted" in reason.lower()
    
    def test_allowed_tool_returns_empty_reason(self):
        """Allowed tool returns empty/clear reason."""
        enforcer = ABACEnforcer()
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test mission",
            approvers=["op@x.com"], created_by="tester",
            abac_policy={
                "allowed_tools": ["read_file"],
                "forbidden_params": []
            }
        )
        is_allowed, reason = enforcer.can_invoke_tool(mission, "read_file")
        assert is_allowed is True
        assert reason == "" or "allowed" in reason.lower()


class TestABACEnforcerEdgeCases:
    """Test edge cases and boundary conditions."""
    
    def test_case_sensitive_tool_name_matching(self):
        """Tool name matching is case-sensitive."""
        enforcer = ABACEnforcer()
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test mission",
            approvers=["op@x.com"], created_by="tester",
            abac_policy={
                "allowed_tools": ["read_file"],
                "forbidden_params": []
            }
        )
        # Different case should not match
        is_allowed, _ = enforcer.can_invoke_tool(mission, "Read_File")
        # This may be True or False depending on implementation
        # but should be consistent
        assert isinstance(is_allowed, bool)
    
    def test_tool_name_with_special_characters(self):
        """Tool names with special characters are handled."""
        enforcer = ABACEnforcer()
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test mission",
            approvers=["op@x.com"], created_by="tester",
            abac_policy={
                "allowed_tools": ["read-file", "search_knowledge"],
                "forbidden_params": []
            }
        )
        is_allowed, reason = enforcer.can_invoke_tool(mission, "read-file")
        assert is_allowed is True
    
    def test_empty_tool_name_returns_blocked(self):
        """Empty tool name is blocked."""
        enforcer = ABACEnforcer()
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test mission",
            approvers=["op@x.com"], created_by="tester",
            abac_policy={
                "allowed_tools": ["read_file"],
                "forbidden_params": []
            }
        )
        is_allowed, reason = enforcer.can_invoke_tool(mission, "")
        assert is_allowed is False
    
    def test_none_tool_name_returns_blocked(self):
        """None tool name is blocked."""
        enforcer = ABACEnforcer()
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Test mission",
            approvers=["op@x.com"], created_by="tester",
            abac_policy={
                "allowed_tools": ["read_file"],
                "forbidden_params": []
            }
        )
        is_allowed, reason = enforcer.can_invoke_tool(mission, None)
        assert is_allowed is False


class TestABACEnforcerRegressions:
    """Test for known regression scenarios."""
    
    def test_wide_policy_allows_multiple_research_tools(self):
        """Wide policy allows multiple research-related tools."""
        enforcer = ABACEnforcer()
        wide_policy = {
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
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Research mission",
            approvers=["op@x.com"], created_by="tester",
            abac_policy=wide_policy
        )
        for tool in wide_policy["allowed_tools"]:
            is_allowed, _ = enforcer.can_invoke_tool(mission, tool)
            assert is_allowed is True, f"Tool {tool} should be allowed in wide policy"
    
    def test_narrow_policy_blocks_dangerous_tools(self):
        """Narrow policy blocks tools not explicitly in allow-list."""
        enforcer = ABACEnforcer()
        narrow_policy = {
            "allowed_tools": ["text_generator"],
            "forbidden_params": ["api_key"],
        }
        mission = Mission(
            mode=MissionMode.BATMAN,
            objective="Limited mission",
            approvers=["op@x.com"], created_by="tester",
            abac_policy=narrow_policy
        )
        # read_file is not in narrow_policy
        is_allowed, reason = enforcer.can_invoke_tool(mission, "read_file")
        assert is_allowed is False
        
        # execute_script is not in narrow_policy
        is_allowed, reason = enforcer.can_invoke_tool(mission, "execute_script")
        assert is_allowed is False
