"""
ABACEnforcer service — consolidated ABAC enforcement layer.

Spec reference: Phase 2 §2.2 (Access Control ABAC rules) + §5.3 (Tool Invocation Safety)

The ABACEnforcer validates tool invocation against Mission.abac_policy BEFORE
execution. It returns (is_allowed: bool, reason: str) and enforces allow-list
checks to prevent unauthorized tool use. Every tool invocation is validated before
execution to maintain security posture across the mission lifecycle.
"""

from typing import Tuple, Optional, Dict, Any
from backend.models.mission import Mission


class ABACEnforcer:
    """
    Consolidated ABAC enforcement service.
    
    Validates tool invocation against Mission.abac_policy BEFORE tool_service.invoke_tool().
    Returns (is_allowed: bool, reason: str) for auditability and error reporting.
    """
    
    def can_invoke_tool(
        self,
        mission: Mission,
        tool_name: str
    ) -> Tuple[bool, str]:
        """
        Check if tool_name is allowed by mission.abac_policy.
        
        Returns:
            (is_allowed, reason) tuple where:
            - is_allowed: True if tool is in allow-list, False otherwise
            - reason: Empty string if allowed, descriptive error message if blocked
        
        Spec citation: Phase 2 §5.3 (Tool Invocation Safety)
        """
        
        # Step 1: Check if mission has a policy at all
        if mission.abac_policy is None:
            reason = (
                "Tool invocation blocked: Mission has no ABAC policy defined. "
                "Cannot proceed without explicit policy."
            )
            return False, reason
        
        # Step 2: Extract allowed_tools from policy (graceful error handling)
        policy = mission.abac_policy
        
        # Handle missing allowed_tools key
        if "allowed_tools" not in policy:
            reason = (
                "Tool invocation blocked: ABAC policy malformed (missing 'allowed_tools' key). "
                "Policy must define allowed_tools list."
            )
            return False, reason
        
        allowed_tools = policy.get("allowed_tools", [])
        
        # Step 3: Validate allowed_tools is a list (graceful handling)
        if not isinstance(allowed_tools, list):
            reason = (
                "Tool invocation blocked: ABAC policy malformed (allowed_tools is not a list). "
                f"Got type: {type(allowed_tools).__name__}"
            )
            return False, reason
        
        # Step 4: Handle empty tool_name
        if not tool_name or tool_name is None:
            reason = (
                "Tool invocation blocked: Tool name is empty or None. "
                "Cannot evaluate access without a tool name."
            )
            return False, reason
        
        # Step 5: Check if tool_name is in allow-list (case-sensitive match)
        if tool_name in allowed_tools:
            return True, ""
        
        # Tool is not in allow-list
        reason = (
            f"Tool invocation blocked: Tool '{tool_name}' is not permitted by mission ABAC policy. "
            f"Allowed tools: {allowed_tools}."
        )
        return False, reason


def enforce_abac_on_tool_invocation(
    mission: Mission,
    tool_name: str,
    enforcer: Optional[ABACEnforcer] = None
) -> Tuple[bool, str]:
    """
    Convenience function to enforce ABAC on a tool invocation.
    
    Use this when you need to check before calling tool_service.invoke_tool().
    
    Args:
        mission: The Mission object with its abac_policy
        tool_name: Name of the tool to invoke
        enforcer: ABACEnforcer instance (creates new one if None)
    
    Returns:
        (is_allowed, reason) tuple
    """
    if enforcer is None:
        enforcer = ABACEnforcer()
    
    return enforcer.can_invoke_tool(mission, tool_name)
