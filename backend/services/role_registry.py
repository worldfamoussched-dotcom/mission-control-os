"""
Role Registry — Phase 4, Objective 2.

Defines roles, their permissions, and the least-privilege enforcement layer.
Extends ABACEnforcer with role-based access control.

Roles are additive — an actor with multiple roles gets the union of permissions.
Default: deny. A role must explicitly grant access.

Built-in roles:
- 'admin'     — full access to all tools in all modes
- 'operator'  — can invoke non-destructive tools; cannot invoke financial/external tools
- 'viewer'    — read-only; cannot invoke any tools
- 'agent'     — system agents; mode-scoped tool access only

Modes further restrict roles:
- BATMAN mode enforces approval regardless of role
- JARVIS mode allows operator + agent to auto-execute
- WAKANDA mode allows selective execution based on role
"""

from typing import Dict, List, Optional, Set, Tuple


# ── Role definitions ────────────────────────────────────────────────────────

ROLE_TOOL_PERMISSIONS: Dict[str, Set[str]] = {
    "admin": {"*"},  # wildcard — all tools
    "operator": {
        "text_generator",
        "scheduler",
        "search",
        "summarizer",
        "code_reviewer",
        "memory_reader",
        "web_search",
        "run_code",
        "file_read",
    },
    "viewer": set(),  # no tool invocations
    "agent": {
        "text_generator",
        "search",
        "summarizer",
        "memory_reader",
        "file_read",
    },
}

# Tools that require admin role regardless of other permissions
ADMIN_ONLY_TOOLS: Set[str] = {
    "file_write",
    "database_write",
    "send_email",
    "send_message",
    "payment_initiate",
    "contract_sign",
    "api_key_rotate",
}

# Mode-based tool restrictions (tools blocked per mode)
MODE_BLOCKED_TOOLS: Dict[str, Set[str]] = {
    "batman": set(),  # batman approves everything — no blanket blocks
    "jarvis": {
        "payment_initiate",
        "contract_sign",
        "send_email",
    },
    "wakanda": {
        "payment_initiate",
        "contract_sign",
    },
}


class RoleRegistry:
    """
    Central role registry. Evaluates whether an actor with given roles
    can invoke a tool in a given mode.

    Enforcement order:
    1. Mode blocks — hard blocks regardless of role
    2. Admin-only — only admin can use these tools
    3. Role permissions — actor must have a role that grants the tool
    """

    def can_invoke(
        self,
        actor_roles: List[str],
        tool_name: str,
        mode: str,
    ) -> Tuple[bool, str]:
        """
        Check if actor can invoke tool in mode.
        Returns (allowed, reason).
        """
        # Step 1: mode-level block
        blocked = MODE_BLOCKED_TOOLS.get(mode, set())
        if tool_name in blocked:
            return False, (
                f"Tool '{tool_name}' is blocked in mode '{mode}' regardless of role."
            )

        # Step 2: admin-only check
        if tool_name in ADMIN_ONLY_TOOLS and "admin" not in actor_roles:
            return False, (
                f"Tool '{tool_name}' requires 'admin' role. "
                f"Actor has roles: {actor_roles}."
            )

        # Step 3: role permission check
        for role in actor_roles:
            perms = ROLE_TOOL_PERMISSIONS.get(role, set())
            if "*" in perms or tool_name in perms:
                return True, ""

        return False, (
            f"No role in {actor_roles} grants access to tool '{tool_name}'. "
            f"Mode: '{mode}'."
        )

    def get_allowed_tools(self, actor_roles: List[str], mode: str) -> Set[str]:
        """
        Return the set of tools this actor can invoke in this mode.
        '*' roles return a sentinel — caller must handle wildcard.
        """
        blocked = MODE_BLOCKED_TOOLS.get(mode, set())
        allowed: Set[str] = set()

        for role in actor_roles:
            perms = ROLE_TOOL_PERMISSIONS.get(role, set())
            if "*" in perms:
                allowed.add("*")  # wildcard — admin gets everything not blocked
            else:
                allowed |= perms

        # Remove mode-blocked tools
        allowed -= blocked
        return allowed

    def validate_roles(self, actor_roles: List[str]) -> Tuple[bool, str]:
        """Validate that all roles are known."""
        known = set(ROLE_TOOL_PERMISSIONS.keys())
        unknown = [r for r in actor_roles if r not in known]
        if unknown:
            return False, f"Unknown roles: {unknown}. Known roles: {sorted(known)}."
        return True, ""
