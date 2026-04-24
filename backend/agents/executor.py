"""
Executor Agent — runs approved tasks through the tool wrapper and records results.

Spec reference: Phase 1 §4–5 (task execution + audit logging)

This is a stateless helper used by BatmanGraph._execute_task_node and
directly by the API route when executing a single task on demand.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from backend.services.cost_service import CostService
from backend.services.memory_service import MemoryService
from backend.services.tool_service import ToolService


class ExecutorAgent:
    """
    Executes a single approved task.

    Responsibilities:
    - ABAC permission check via ToolService
    - Cost tracking via CostService
    - Result storage via MemoryService
    - Returns an immutable ExecutionResult dict

    MVP: tool invocation is simulated (real tool calls in Phase 2).
    """

    def __init__(
        self,
        tool_service: ToolService,
        cost_service: CostService,
        memory_service: MemoryService,
    ) -> None:
        self.tool_service = tool_service
        self.cost_service = cost_service
        self.memory_service = memory_service

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    async def execute(
        self,
        mission_id: str,
        task: dict[str, Any],
        mode: str = "batman",
        approver_id: str = "operator",
    ) -> dict[str, Any]:
        """
        Execute a single approved task.

        Args:
            mission_id: Parent mission ID
            task: Full task dict (from DecomposerAgent._stamp_tasks output)
            mode: Execution mode (batman | jarvis | wakanda)
            approver_id: ID of approving operator

        Returns:
            Immutable execution result dict.
        """
        task_id = task["id"]
        task_name = task.get("name", "Unnamed task")
        tool_name = task.get("suggested_tool") or "search_knowledge"
        started_at = datetime.now(timezone.utc)

        # --- ABAC permission check (spec §6) ---
        allowed, reason = self.tool_service.can_execute(
            tool_name=tool_name,
            mode=mode,
            mission_id=mission_id,
            approver_id=approver_id,
        )

        if not allowed:
            return self._build_result(
                task_id=task_id,
                task_name=task_name,
                tool_name=tool_name,
                mission_id=mission_id,
                started_at=started_at,
                status="blocked",
                output=None,
                error=f"Tool '{tool_name}' blocked: {reason}",
                cost_usd=0.0,
            )

        # --- Tool execution (MVP: simulated) ---
        try:
            output = await self._invoke_tool(tool_name, task)
            tool_cost = self.tool_service.get_cost(tool_name)

            # Track cost
            self.cost_service.track_cost(
                mission_id, tool_cost, f"tool:{tool_name} task:{task_id}"
            )

            # Store result in mission-scoped memory
            self.memory_service.store(
                mission_id,
                f"task_{task_id}_result",
                {"task_name": task_name, "tool": tool_name, "output": output},
                visibility="task",
            )

            return self._build_result(
                task_id=task_id,
                task_name=task_name,
                tool_name=tool_name,
                mission_id=mission_id,
                started_at=started_at,
                status="completed",
                output=output,
                error=None,
                cost_usd=tool_cost,
            )

        except Exception as exc:  # noqa: BLE001
            return self._build_result(
                task_id=task_id,
                task_name=task_name,
                tool_name=tool_name,
                mission_id=mission_id,
                started_at=started_at,
                status="failed",
                output=None,
                error=str(exc),
                cost_usd=0.0,
            )

    # ------------------------------------------------------------------
    # Private
    # ------------------------------------------------------------------

    async def _invoke_tool(self, tool_name: str, task: dict[str, Any]) -> str:
        """
        Invoke a tool.

        MVP: returns a structured mock result.
        Phase 2: replace with real tool dispatch via ToolWrapper.
        """
        return (
            f"[MVP] Tool '{tool_name}' executed for task '{task.get('name')}'.\n"
            f"Description: {task.get('description', 'No description')}"
        )

    @staticmethod
    def _build_result(
        *,
        task_id: str,
        task_name: str,
        tool_name: str,
        mission_id: str,
        started_at: datetime,
        status: str,
        output: str | None,
        error: str | None,
        cost_usd: float,
    ) -> dict[str, Any]:
        """Build an immutable execution result dict."""
        completed_at = datetime.now(timezone.utc)
        duration = (completed_at - started_at).total_seconds()

        return {
            "id": f"exec_{uuid.uuid4().hex[:8]}",
            "task_id": task_id,
            "task_name": task_name,
            "tool_name": tool_name,
            "mission_id": mission_id,
            "status": status,       # completed | failed | blocked
            "output": output,
            "error": error,
            "cost_usd": cost_usd,
            "duration_seconds": round(duration, 3),
            "started_at": started_at,
            "completed_at": completed_at,
        }
