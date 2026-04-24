"""Mission service - business logic for mission operations."""

from typing import Optional, List
from datetime import datetime, timezone
import uuid

from backend.api.schemas import (
    CreateMissionRequest,
    MissionMode,
    MissionState,
    TaskStatus,
)


class MissionService:
    """Service for managing missions."""

    def __init__(self):
        """Initialize mission service."""
        self.missions = {}
        self.tasks = {}
        self.approvals = {}

    async def create_mission(self, req: CreateMissionRequest) -> dict:
        """
        Create a new mission.

        Returns immutable mission object.
        """
        mission_id = f"m_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)

        mission = {
            "id": mission_id,
            "objective": req.objective,
            "mode": req.mode,
            "state": MissionState.PENDING_DECOMPOSITION,
            "approvers": req.approvers,
            "cost_limit_usd": req.cost_limit_usd,
            "total_cost_usd": 0.0,
            "created_at": now,
            "completed_at": None,
            "tags": req.tags or [],
        }

        self.missions[mission_id] = mission
        return mission.copy()

    async def get_mission(self, mission_id: str) -> Optional[dict]:
        """Get mission by ID."""
        mission = self.missions.get(mission_id)
        return mission.copy() if mission else None

    async def list_missions(self) -> List[dict]:
        """List all missions."""
        return [m.copy() for m in self.missions.values()]

    async def approve_task(
        self,
        mission_id: str,
        task_id: str,
        approver_id: str,
        approved: bool,
        reason: Optional[str] = None
    ) -> dict:
        """
        Approve or reject a task.

        Returns new approval record.
        """
        if mission_id not in self.missions:
            raise ValueError(f"Mission {mission_id} not found")

        if task_id not in self.tasks:
            raise ValueError(f"Task {task_id} not found")

        task = self.tasks[task_id]
        if task["mission_id"] != mission_id:
            raise ValueError("Task does not belong to mission")

        approval_id = f"a_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)

        approval = {
            "id": approval_id,
            "task_id": task_id,
            "approver_id": approver_id,
            "approved": approved,
            "reason": reason,
            "approved_at": now,
        }

        self.approvals[approval_id] = approval

        # Update task status (immutable pattern)
        if approved:
            self.tasks[task_id] = task.copy()
            self.tasks[task_id]["status"] = TaskStatus.APPROVED
            self.tasks[task_id]["approved_at"] = now
        else:
            self.tasks[task_id] = task.copy()
            self.tasks[task_id]["status"] = TaskStatus.REJECTED

        return approval.copy()

    async def freeze_mission(self, mission_id: str, reason: str) -> dict:
        """
        Freeze a mission (halt execution, preserve state).

        Returns updated mission.
        """
        if mission_id not in self.missions:
            raise ValueError(f"Mission {mission_id} not found")

        mission = self.missions[mission_id]
        updated = mission.copy()
        updated["state"] = MissionState.FROZEN
        updated["freeze_reason"] = reason
        updated["frozen_at"] = datetime.now(timezone.utc)

        self.missions[mission_id] = updated
        return updated.copy()

    async def complete_mission(self, mission_id: str) -> dict:
        """
        Mark mission as completed.

        Returns updated mission.
        """
        if mission_id not in self.missions:
            raise ValueError(f"Mission {mission_id} not found")

        mission = self.missions[mission_id]
        updated = mission.copy()
        updated["state"] = MissionState.COMPLETED
        updated["completed_at"] = datetime.now(timezone.utc)

        self.missions[mission_id] = updated
        return updated.copy()
