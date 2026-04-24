"""Execution service - task execution and monitoring."""

from typing import Optional, List
import uuid
from datetime import datetime, timezone


class ExecutionService:
    """Service for executing tasks and tracking results."""

    def __init__(self):
        """Initialize execution service."""
        self.executions = {}
        self.execution_history = {}

    async def execute_task(
        self,
        mission_id: str,
        task_id: str,
        task_name: str,
        tool_name: str,
        tool_input: dict
    ) -> dict:
        """
        Execute a single task.

        Returns execution result.
        """
        execution_id = f"exec_{uuid.uuid4().hex[:8]}"
        start_time = datetime.now(timezone.utc)

        try:
            # TODO: Actually invoke the tool via tool_wrapper
            output = f"Executed {task_name} with {tool_name}"
            error = None
            status = "success"

        except Exception as e:
            output = None
            error = str(e)
            status = "failure"

        end_time = datetime.now(timezone.utc)
        duration = (end_time - start_time).total_seconds()

        result = {
            "id": execution_id,
            "mission_id": mission_id,
            "task_id": task_id,
            "tool_name": tool_name,
            "status": status,
            "output": output,
            "error": error,
            "duration_seconds": duration,
            "started_at": start_time,
            "completed_at": end_time,
        }

        self.executions[execution_id] = result

        # Track in history for duplicate detection
        history_key = f"{mission_id}:{task_id}:{tool_name}"
        if history_key not in self.execution_history:
            self.execution_history[history_key] = []
        self.execution_history[history_key].append(execution_id)

        return result.copy()

    def get_execution(self, execution_id: str) -> Optional[dict]:
        """Get execution by ID."""
        execution = self.executions.get(execution_id)
        return execution.copy() if execution else None

    def list_executions(self, mission_id: str) -> List[dict]:
        """List all executions for a mission."""
        return [
            e.copy()
            for e in self.executions.values()
            if e["mission_id"] == mission_id
        ]

    def detect_duplicate_execution(self, mission_id: str, task_id: str, tool_name: str) -> bool:
        """
        Detect if a task has been executed before (loop prevention).

        Returns True if already executed.
        """
        history_key = f"{mission_id}:{task_id}:{tool_name}"
        return len(self.execution_history.get(history_key, [])) > 0

    def get_execution_count(self, mission_id: str, task_id: str) -> int:
        """Get number of times a task has been executed."""
        count = 0
        for exec_id, exec_data in self.executions.items():
            if exec_data["mission_id"] == mission_id and exec_data["task_id"] == task_id:
                count += 1
        return count

    def check_max_iterations(self, mission_id: str, task_id: str, max_iters: int = 3) -> bool:
        """
        Check if task has exceeded max iteration limit.

        Returns True if exceeded.
        """
        count = self.get_execution_count(mission_id, task_id)
        return count >= max_iters
