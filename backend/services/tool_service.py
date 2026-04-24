"""Tool service - tool registry and permission checks."""

from typing import List, Optional
from dataclasses import dataclass, field


@dataclass
class ToolDefinition:
    """Definition of a single tool."""
    name: str
    description: str
    category: str  # e.g., "research", "execution", "admin"
    cost_per_use_usd: float = 0.1
    requires_approval: bool = True
    max_concurrent_uses: int = 1
    tags: List[str] = field(default_factory=list)


@dataclass
class ToolConstraint:
    """Constraint on tool usage."""
    tool_name: str
    max_daily_uses: Optional[int] = None
    max_cost_daily_usd: Optional[float] = None
    allowed_modes: List[str] = field(default_factory=lambda: ["batman", "jarvis", "wakanda"])
    requires_human_review: bool = False


class ToolService:
    """Service for managing tools and their constraints."""

    def __init__(self):
        """Initialize tool service with registry."""
        self.tools = self._init_tools()
        self.constraints = self._init_constraints()
        self.usage_tracking = {}

    def _init_tools(self) -> dict:
        """Initialize tool registry (Phase 1 stubs)."""
        return {
            "read_file": ToolDefinition(
                name="read_file",
                description="Read contents of a file",
                category="research",
                cost_per_use_usd=0.01,
                requires_approval=False,
                tags=["io", "research"]
            ),
            "write_file": ToolDefinition(
                name="write_file",
                description="Write to a file",
                category="execution",
                cost_per_use_usd=0.05,
                requires_approval=True,
                tags=["io", "execution"]
            ),
            "execute_script": ToolDefinition(
                name="execute_script",
                description="Execute a script or command",
                category="execution",
                cost_per_use_usd=0.10,
                requires_approval=True,
                max_concurrent_uses=1,
                tags=["execution", "dangerous"]
            ),
            "call_api": ToolDefinition(
                name="call_api",
                description="Make HTTP request to external API",
                category="execution",
                cost_per_use_usd=0.05,
                requires_approval=False,
                tags=["io", "external"]
            ),
            "search_knowledge": ToolDefinition(
                name="search_knowledge",
                description="Search internal knowledge base",
                category="research",
                cost_per_use_usd=0.02,
                requires_approval=False,
                tags=["research", "internal"]
            ),
        }

    def _init_constraints(self) -> dict:
        """Initialize tool constraints."""
        return {
            "execute_script": ToolConstraint(
                tool_name="execute_script",
                max_daily_uses=10,
                max_cost_daily_usd=1.0,
                requires_human_review=True
            ),
            "write_file": ToolConstraint(
                tool_name="write_file",
                max_daily_uses=50,
                max_cost_daily_usd=2.5,
            ),
        }

    def get_tool(self, name: str) -> Optional[ToolDefinition]:
        """Get tool by name."""
        return self.tools.get(name)

    def list_tools(self) -> List[ToolDefinition]:
        """List all available tools."""
        return list(self.tools.values())

    def get_constraint(self, tool_name: str) -> Optional[ToolConstraint]:
        """Get constraints for a tool."""
        return self.constraints.get(tool_name)

    def check_permission(self, tool_name: str, mode: str, approver_id: Optional[str] = None) -> bool:
        """
        Check if tool can be used in given mode.

        Returns True if allowed, False otherwise.
        """
        tool = self.get_tool(tool_name)
        if not tool:
            return False

        constraint = self.get_constraint(tool_name)
        if constraint:
            if mode not in constraint.allowed_modes:
                return False

            if constraint.requires_human_review and not approver_id:
                return False

        # In BATMAN mode, approval is required
        if mode == "batman" and tool.requires_approval:
            return bool(approver_id)

        return True

    def get_cost(self, tool_name: str) -> float:
        """Get cost for using a tool."""
        tool = self.get_tool(tool_name)
        return tool.cost_per_use_usd if tool else 0.0

    def can_execute(
        self,
        tool_name: str,
        mode: str,
        mission_id: str,
        approver_id: Optional[str] = None
    ) -> tuple[bool, str]:
        """
        Check if tool can be executed (permission + constraint checks).

        Returns (allowed, reason).
        """
        if not self.check_permission(tool_name, mode, approver_id):
            reason = f"Tool '{tool_name}' not permitted in mode '{mode}'"
            return False, reason

        constraint = self.get_constraint(tool_name)
        if constraint:
            if constraint.max_daily_uses:
                # TODO: Track usage and check against limit
                pass

            if constraint.max_cost_daily_usd:
                # TODO: Track cost and check against limit
                pass

        return True, "OK"
