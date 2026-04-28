"""
ABACEnforcer service — consolidated ABAC enforcement layer.

Spec reference: Phase 2 §2.2 (Access Control ABAC rules) + §5.3 (Tool Invocation Safety)
Phase 4 extension: role-based access control via RoleRegistry.

The ABACEnforcer validates tool invocation against Mission.abac_policy BEFORE
execution. It returns (is_allowed: bool, reason: str) and enforces allow-list
checks to prevent unauthorized tool use. Every tool invocation is validated before
execution to maintain security posture across the mission lifecycle.

Phase 4 adds role-based enforcement: if actor_roles are supplied, the RoleRegistry
is checked FIRST (mode-level blocks, admin-only gates, role permissions). The
mission-level allow-list is checked second. Both must pass.
"""

from typing import Tuple, Optional, Dict, Any, List
from backend.models.mission import Mission
from backend.services.role_registry import RoleRegistry

_role_registry = RoleRegistry()


class ABACEnforcer:
    """
    Consolidated ABAC enforcement service.

    Validates tool invocation against Mission.abac_policy BEFORE tool_service.invoke_tool().
    Returns (is_allowed: bool, reason: str) for auditability and error reporting.

    Phase 4: also accepts actor_roles for role-based enforcement. Role check
    runs before mission policy check — both must pass.
    """

    def can_invoke_tool(
        self,
        mission: Mission,
        tool_name: str,
        actor_roles: Optional[List[str]] = None,
    ) -> Tuple[bool, str]:
        """
        Check if tool_name is allowed by mission.abac_policy and actor roles.

        Phase 4: actor_roles is optional for backwards compatibility.
        If provided, role-based check runs first.

        Returns:
            (is_allowed, reason) tuple where:
            - is_allowed: True if tool is permitted, False otherwise
            - reason: Empty string if allowed, descriptive error message if blocked
        """
        # Step 0 (Phase 4): Role-based check — runs before mission policy
        if actor_roles is not None:
            mode = mission.mode.value if hasattr(mission.mode, "value") else str(mission.mode)
            role_allowed, role_reason = _role_registry.can_invoke(actor_roles, tool_name, mode)
            if not role_allowed:
                return False, f"Role check blocked: {role_reason}"

        # Step 1: Check if mission has a policy at all
        if mission.abac_policy is None:
            reason = (
                "Tool invocation blocked: Mission has no ABAC policy defined. "
                "Cannot proceed without explicit policy."
            )
            return False, reason

        # Step 2: Extract allowed_tools from policy (graceful error handling)
        policy = mission.abac_policy

        if "allowed_tools" not in policy:
            reason = (
                "Tool invocation blocked: ABAC policy malformed (missing 'allowed_tools' key). "
                "Policy must define allowed_tools list."
            )
            return False, reason

        allowed_tools = policy.get("allowed_tools", [])

        # Step 3: Validate allowed_tools is a list
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

        # Step 5: Check mission allow-list
        if tool_name in allowed_tools:
            return True, ""

        reason = (
            f"Tool invocation blocked: Tool '{tool_name}' is not permitted by mission ABAC policy. "
            f"Allowed tools: {allowed_tools}."
        )
        return False, reason


def enforce_abac_on_tool_invocation(
    mission: Mission,
    tool_name: str,
    enforcer: Optional[ABACEnforcer] = None,
    actor_roles: Optional[List[str]] = None,
) -> Tuple[bool, str]:
    """
    Convenience function to enforce ABAC on a tool invocation.

    Phase 4: accepts actor_roles for role-based enforcement.

    Args:
        mission: The Mission object with its abac_policy
        tool_name: Name of the tool to invoke
        enforcer: ABACEnforcer instance (creates new one if None)
        actor_roles: Optional list of actor roles for Phase 4 role check

    Returns:
        (is_allowed, reason) tuple
    """
    if enforcer is None:
        enforcer = ABACEnforcer()

    return enforcer.can_invoke_tool(mission, tool_name, actor_roles=actor_roles)
