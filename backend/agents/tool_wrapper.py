"""Tool wrapper - safe tool execution with permission checks."""

from typing import Any, Optional, Tuple
import uuid


class ToolWrapper:
    """Wrapper for safe tool execution."""

    def __init__(self, tool_service, cost_service, memory_service):
        """Initialize tool wrapper."""
        self.tool_service = tool_service
        self.cost_service = cost_service
        self.memory_service = memory_service

    async def execute(
        self,
        mission_id: str,
        tool_name: str,
        tool_input: dict,
        mode: str,
        approver_id: Optional[str] = None,
        task_id: Optional[str] = None,
    ) -> Tuple[bool, Any]:
        """
        Execute a tool with permission checks.

        Returns (success, result).
        """
        # Check permissions
        allowed, reason = self.tool_service.can_execute(
            tool_name,
            mode,
            mission_id,
            approver_id
        )

        if not allowed:
            return False, {"error": reason}

        try:
            # TODO: Invoke actual tool (Phase 2)
            result = await self._mock_execute(tool_name, tool_input)

            # Track cost
            cost = self.tool_service.get_cost(tool_name)
            self.cost_service.track_cost(mission_id, cost, f"Tool: {tool_name}")

            # Store result in memory
            if task_id:
                self.memory_service.store(
                    mission_id,
                    f"task_{task_id}_result",
                    result,
                    visibility="task"
                )

            return True, result

        except Exception as e:
            return False, {"error": str(e)}

    async def _mock_execute(self, tool_name: str, tool_input: dict) -> dict:
        """Mock tool execution (Phase 1 MVP)."""
        return {
            "id": f"result_{uuid.uuid4().hex[:8]}",
            "tool": tool_name,
            "output": f"Executed {tool_name}",
            "input_echo": tool_input,
        }

    def can_execute_without_approval(self, tool_name: str) -> bool:
        """Check if tool can execute without explicit approval."""
        tool = self.tool_service.get_tool(tool_name)
        return tool and not tool.requires_approval
