"""API routes for Mission Control OS."""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
import uuid
from datetime import datetime, timezone

from backend.api.schemas import (
    CreateMissionRequest,
    MissionResponse,
    ApprovalRequest,
    ApprovalResponse,
    ExecuteTaskRequest,
    ExecutionResult,
    TaskDefinitionResponse,
    TaskStatus,
    MissionState,
    ExecutionStatus,
)

router = APIRouter()

# In-memory storage for MVP (will be replaced with database in service layer)
missions_db = {}
tasks_db = {}
approvals_db = {}
executions_db = {}

# ============================================================================
# Missions
# ============================================================================

@router.post("/missions", response_model=MissionResponse, status_code=status.HTTP_201_CREATED)
async def create_mission(req: CreateMissionRequest) -> MissionResponse:
    """Create a new mission in BATMAN mode."""
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

    missions_db[mission_id] = mission

    return MissionResponse(
        **mission,
        tasks=[],
        audit_log=[]
    )


@router.get("/missions/{mission_id}", response_model=MissionResponse)
async def get_mission(mission_id: str) -> MissionResponse:
    """Get mission by ID."""
    if mission_id not in missions_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission {mission_id} not found"
        )

    mission = missions_db[mission_id]
    mission_tasks = [
        TaskDefinitionResponse(**t)
        for t in tasks_db.values()
        if t.get("mission_id") == mission_id
    ]

    return MissionResponse(
        **mission,
        tasks=mission_tasks,
        audit_log=[]
    )


@router.get("/missions", response_model=List[MissionResponse])
async def list_missions() -> List[MissionResponse]:
    """List all missions."""
    result = []
    for mission in missions_db.values():
        mission_tasks = [
            TaskDefinitionResponse(**t)
            for t in tasks_db.values()
            if t.get("mission_id") == mission["id"]
        ]
        result.append(MissionResponse(
            **mission,
            tasks=mission_tasks,
            audit_log=[]
        ))
    return result


# ============================================================================
# Tasks
# ============================================================================

@router.post("/missions/{mission_id}/tasks", response_model=TaskDefinitionResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    mission_id: str,
    name: str,
    description: str
) -> TaskDefinitionResponse:
    """Create a task for a mission."""
    if mission_id not in missions_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission {mission_id} not found"
        )

    task_id = f"t_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)

    task = {
        "id": task_id,
        "mission_id": mission_id,
        "name": name,
        "description": description,
        "status": TaskStatus.PENDING_APPROVAL,
        "created_at": now,
        "approved_at": None,
        "executed_at": None,
    }

    tasks_db[task_id] = task

    return TaskDefinitionResponse(**task)


@router.get("/missions/{mission_id}/tasks", response_model=List[TaskDefinitionResponse])
async def list_mission_tasks(mission_id: str) -> List[TaskDefinitionResponse]:
    """List all tasks for a mission."""
    if mission_id not in missions_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission {mission_id} not found"
        )

    return [
        TaskDefinitionResponse(**t)
        for t in tasks_db.values()
        if t.get("mission_id") == mission_id
    ]


# ============================================================================
# Approvals
# ============================================================================

@router.post("/missions/{mission_id}/tasks/{task_id}/approve", response_model=ApprovalResponse)
async def approve_task(
    mission_id: str,
    task_id: str,
    req: ApprovalRequest
) -> ApprovalResponse:
    """Approve a task within a mission."""
    if mission_id not in missions_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission {mission_id} not found"
        )

    if task_id not in tasks_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )

    task = tasks_db[task_id]
    if task["mission_id"] != mission_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task does not belong to mission"
        )

    approval_id = f"a_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)

    approval = {
        "id": approval_id,
        "task_id": task_id,
        "approver_id": req.approver_id,
        "approved": req.approved,
        "reason": req.reason,
        "approved_at": now,
    }

    approvals_db[approval_id] = approval

    # Update task status
    if req.approved:
        task["status"] = TaskStatus.APPROVED
        task["approved_at"] = now
    else:
        task["status"] = TaskStatus.REJECTED

    return ApprovalResponse(
        success=True,
        approval_id=approval_id,
        task_id=task_id,
        message="Task approved and ready for execution" if req.approved else "Task rejected"
    )


@router.get("/missions/{mission_id}/approvals")
async def list_approvals(mission_id: str):
    """List all approvals for a mission."""
    if mission_id not in missions_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission {mission_id} not found"
        )

    mission_task_ids = {t["id"] for t in tasks_db.values() if t["mission_id"] == mission_id}

    return [
        a for a in approvals_db.values()
        if a["task_id"] in mission_task_ids
    ]


# ============================================================================
# Execution
# ============================================================================

@router.post("/missions/{mission_id}/tasks/{task_id}/execute", response_model=ExecutionResult)
async def execute_task(
    mission_id: str,
    task_id: str
) -> ExecutionResult:
    """Execute an approved task."""
    if mission_id not in missions_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission {mission_id} not found"
        )

    if task_id not in tasks_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )

    task = tasks_db[task_id]

    # Verify task is approved (BATMAN mode requirement)
    if task["status"] != TaskStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Task must be approved before execution. Current status: {task['status']}"
        )

    execution_id = f"exec_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)

    # Simulate execution
    execution = {
        "id": execution_id,
        "task_id": task_id,
        "status": ExecutionStatus.SUCCESS,
        "output": f"Executed: {task['name']}",
        "error": None,
        "cost_usd": 0.5,
        "duration_seconds": 1.2,
        "completed_at": now,
    }

    executions_db[execution_id] = execution

    # Update task status
    task["status"] = TaskStatus.COMPLETED
    task["executed_at"] = now

    # Update mission cost
    mission = missions_db[mission_id]
    mission["total_cost_usd"] += execution["cost_usd"]

    return ExecutionResult(**execution)


@router.get("/missions/{mission_id}/executions")
async def list_executions(mission_id: str):
    """List all executions for a mission."""
    if mission_id not in missions_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission {mission_id} not found"
        )

    mission_task_ids = {t["id"] for t in tasks_db.values() if t["mission_id"] == mission_id}

    return [
        e for e in executions_db.values()
        if e["task_id"] in mission_task_ids
    ]
