"""
API routes for Mission Control OS — Batman Mode MVP.

Spec reference: Phase 1 §3–8 (mission lifecycle, approval queue, execution)

Endpoints:
  POST   /api/missions                              Create mission + decompose via Claude
  GET    /api/missions                              List all missions
  GET    /api/missions/{id}                         Get mission detail
  GET    /api/missions/{id}/tasks                   List tasks (approval queue)
  POST   /api/missions/{id}/tasks/{tid}/approve     Approve or reject a task
  POST   /api/missions/{id}/execute                 Execute all approved tasks
  GET    /api/missions/{id}/results                 Get execution results
  GET    /api/missions/{id}/cost                    Get cost summary
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status

from backend.agents.jarvis_supervisor import JarvisSupervisor
from backend.agents.supervisor import BatmanSupervisor
from backend.api.schemas import (
    ApprovalRequest,
    ApprovalResponse,
    CreateMissionRequest,
    ExecutionResult,
    MissionMode,
    MissionResponse,
    MissionState,
    TaskDefinitionResponse,
    TaskStatus,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# Singleton supervisors — one per mode (Phase 1 Batman, Phase 3 Jarvis).
# They share a tool/cost/memory backplane via a wiring step below so cost
# alerts and audit history are consistent across modes for the same
# mission_id, while ABAC + approval semantics are mode-specific.
# ---------------------------------------------------------------------------
_supervisor = BatmanSupervisor()
_jarvis_supervisor = JarvisSupervisor(
    tool_service=_supervisor.tool_service,
    cost_service=_supervisor.cost_service,
    memory_service=_supervisor.memory_service,
    cost_alert_service=_supervisor.cost_alert_service,
    audit_service=_supervisor.audit_service,
)

# In-memory stores (replaced by Postgres in Phase 2)
_missions: dict[str, dict[str, Any]] = {}
_tasks: dict[str, list[dict[str, Any]]] = {}     # mission_id → [task]
_approvals: dict[str, list[dict[str, Any]]] = {}  # mission_id → [approval]
_results: dict[str, list[dict[str, Any]]] = {}    # mission_id → [result]
_alerts: dict[str, list[dict[str, Any]]] = {}     # mission_id → [cost_alert]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_mission_or_404(mission_id: str) -> dict[str, Any]:
    if mission_id not in _missions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission '{mission_id}' not found",
        )
    return _missions[mission_id]


def _task_to_response(task: dict[str, Any]) -> TaskDefinitionResponse:
    return TaskDefinitionResponse(
        id=task["id"],
        mission_id=task["mission_id"],
        name=task["name"],
        description=task.get("description", ""),
        status=task.get("status", TaskStatus.PENDING_APPROVAL),
        created_at=task.get("created_at", datetime.now(timezone.utc)),
        approved_at=task.get("approved_at"),
        executed_at=task.get("executed_at"),
    )


def _mission_to_response(mission: dict[str, Any]) -> MissionResponse:
    mission_tasks = [
        _task_to_response(t) for t in _tasks.get(mission["id"], [])
    ]
    return MissionResponse(
        id=mission["id"],
        objective=mission["objective"],
        mode=mission["mode"],
        state=mission["state"],
        approvers=mission["approvers"],
        cost_limit_usd=mission.get("cost_limit_usd"),
        total_cost_usd=mission.get("total_cost_usd", 0.0),
        created_at=mission["created_at"],
        completed_at=mission.get("completed_at"),
        tags=mission.get("tags", []),
        tasks=mission_tasks,
        audit_log=[],
    )


# ---------------------------------------------------------------------------
# Missions
# ---------------------------------------------------------------------------

@router.post(
    "/missions",
    response_model=MissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a mission and decompose it into tasks via Claude",
)
async def create_mission(req: CreateMissionRequest) -> MissionResponse:
    """Create a mission. Mode-aware:

    - Batman: decompose immediately, return tasks for the approval queue.
    - Jarvis: store mission only. Decomposition happens inside POST /run.
      No premature Claude call, no orphan unapproved tasks.

    Spec reference: Phase 1 §3 (Batman decompose), Phase 3 §9 (Jarvis single-shot).
    """
    mission_id = f"m_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)

    # Store mission record
    mission: dict[str, Any] = {
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
        "abac_policy": req.abac_policy,
    }
    _missions[mission_id] = mission

    # Jarvis missions skip create-time decomposition — see /run.
    if req.mode == MissionMode.JARVIS:
        mission["state"] = MissionState.PENDING_APPROVAL  # ready-to-run sentinel
        _tasks[mission_id] = []
        return _mission_to_response(mission)

    # --- Batman: Decompose via Claude (spec §3) ---
    try:
        tasks = await _supervisor.decompose_mission(mission_id, req.objective)
        _tasks[mission_id] = tasks
        mission["state"] = MissionState.PENDING_APPROVAL
    except Exception as exc:  # noqa: BLE001
        mission["state"] = MissionState.FAILED
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Decomposition failed: {exc}",
        ) from exc

    return _mission_to_response(mission)


@router.get(
    "/missions",
    response_model=list[MissionResponse],
    summary="List all missions",
)
async def list_missions() -> list[MissionResponse]:
    return [_mission_to_response(m) for m in _missions.values()]


@router.get(
    "/missions/{mission_id}",
    response_model=MissionResponse,
    summary="Get mission by ID",
)
async def get_mission(mission_id: str) -> MissionResponse:
    mission = _get_mission_or_404(mission_id)
    return _mission_to_response(mission)


# ---------------------------------------------------------------------------
# Tasks / Approval Queue
# ---------------------------------------------------------------------------

@router.get(
    "/missions/{mission_id}/tasks",
    response_model=list[TaskDefinitionResponse],
    summary="List tasks for a mission (the approval queue)",
)
async def list_tasks(mission_id: str) -> list[TaskDefinitionResponse]:
    _get_mission_or_404(mission_id)
    return [_task_to_response(t) for t in _tasks.get(mission_id, [])]


@router.post(
    "/missions/{mission_id}/tasks/{task_id}/approve",
    response_model=ApprovalResponse,
    summary="Approve or reject a task (Batman Mode gate)",
)
async def approve_task(
    mission_id: str,
    task_id: str,
    req: ApprovalRequest,
) -> ApprovalResponse:
    """
    Operator approves or rejects a task.

    Approved tasks are queued for execution.
    Rejected tasks are marked rejected — they will NOT execute.
    """
    _get_mission_or_404(mission_id)

    mission_tasks = _tasks.get(mission_id, [])
    task = next((t for t in mission_tasks if t["id"] == task_id), None)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task '{task_id}' not found in mission '{mission_id}'",
        )

    now = datetime.now(timezone.utc)
    if req.approved:
        task["status"] = TaskStatus.APPROVED
        task["approved_at"] = now
        message = "Task approved and queued for execution"
    else:
        task["status"] = TaskStatus.REJECTED
        message = f"Task rejected: {req.reason or 'no reason given'}"

    # Record approval
    approval_record = {
        "id": f"a_{uuid.uuid4().hex[:8]}",
        "task_id": task_id,
        "mission_id": mission_id,
        "approver_id": req.approver_id,
        "approved": req.approved,
        "reason": req.reason,
        "approved_at": now,
    }
    _approvals.setdefault(mission_id, []).append(approval_record)

    return ApprovalResponse(
        success=True,
        approval_id=approval_record["id"],
        task_id=task_id,
        message=message,
    )


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------

@router.post(
    "/missions/{mission_id}/execute",
    summary="Execute all approved tasks for a mission",
)
async def execute_mission(mission_id: str) -> dict[str, Any]:
    """
    Execute all tasks that have been approved by the operator.

    Batman Mode: only approved tasks run — no surprises.
    Returns full execution results with cost summary.
    """
    mission = _get_mission_or_404(mission_id)
    all_tasks = _tasks.get(mission_id, [])

    approved_task_ids = [
        t["id"] for t in all_tasks if t.get("status") == TaskStatus.APPROVED
    ]

    if not approved_task_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No approved tasks to execute. Approve tasks first via the approval queue.",
        )

    mission["state"] = MissionState.EXECUTING

    summary = await _supervisor.execute_approved_tasks(
        mission_id=mission_id,
        objective=mission["objective"],
        all_tasks=all_tasks,
        approved_task_ids=approved_task_ids,
        mode=str(mission["mode"]),
        abac_policy=mission.get("abac_policy"),
    )

    # Update task statuses from results
    for result in summary["results"]:
        task = next((t for t in all_tasks if t["id"] == result["task_id"]), None)
        if task:
            task["status"] = (
                TaskStatus.COMPLETED
                if result["status"] == "completed"
                else TaskStatus.FAILED
            )
            task["executed_at"] = result.get("completed_at")

    # Update mission state + cost
    mission["total_cost_usd"] = (
        mission.get("total_cost_usd", 0.0) + summary["total_cost_usd"]
    )
    mission["state"] = (
        MissionState.COMPLETED
        if summary["status"] == "completed"
        else MissionState.EXECUTING
    )
    if summary["status"] == "completed":
        mission["completed_at"] = datetime.now(timezone.utc)

    _results[mission_id] = summary["results"]
    # Accumulate cost alerts fired during this execution run
    existing_alerts = _alerts.get(mission_id, [])
    _alerts[mission_id] = existing_alerts + summary.get("cost_alerts", [])
    return summary


@router.post(
    "/missions/{mission_id}/run",
    summary="Single-shot execution for Jarvis Mode (no approval gate)",
)
async def run_jarvis_mission(mission_id: str) -> dict[str, Any]:
    """Single-shot Jarvis Mode execution — decompose, review, execute, return.

    Spec reference: Phase 3 §9–11 (Jarvis = command-execute, no approval).
    Mode mapping: Jarvis = Fractal Web Solutions dev agency.

    Rejects if the mission is not in JARVIS mode — Batman missions must
    use the /tasks → /approve → /execute flow.
    """
    mission = _get_mission_or_404(mission_id)

    if mission["mode"] != MissionMode.JARVIS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"/run is for Jarvis Mode missions only. This mission is in "
                f"'{mission['mode']}' mode — use /execute after approving tasks."
            ),
        )

    mission["state"] = MissionState.EXECUTING

    summary = await _jarvis_supervisor.run_mission(
        mission_id=mission_id,
        objective=mission["objective"],
        abac_policy=mission.get("abac_policy"),
    )

    # Update mission state + cost
    mission["total_cost_usd"] = (
        mission.get("total_cost_usd", 0.0) + summary["total_cost_usd"]
    )
    mission["state"] = (
        MissionState.COMPLETED
        if summary["status"] == "completed"
        else MissionState.FAILED
        if summary["status"] == "failed"
        else MissionState.EXECUTING
    )
    if summary["status"] == "completed":
        mission["completed_at"] = datetime.now(timezone.utc)

    # Persist into cockpit-bound stores so /results, /alerts work uniformly
    _results[mission_id] = summary["results"]
    existing_alerts = _alerts.get(mission_id, [])
    _alerts[mission_id] = existing_alerts + summary.get("cost_alerts", [])

    return summary


@router.get(
    "/missions/{mission_id}/results",
    summary="Get execution results for a mission",
)
async def get_results(mission_id: str) -> dict[str, Any]:
    _get_mission_or_404(mission_id)
    return {
        "mission_id": mission_id,
        "results": _results.get(mission_id, []),
        "total_cost_usd": _supervisor.get_mission_cost(mission_id),
    }


@router.get(
    "/missions/{mission_id}/cost",
    summary="Get cost summary for a mission",
)
async def get_cost(mission_id: str) -> dict[str, Any]:
    _get_mission_or_404(mission_id)
    mission = _missions[mission_id]
    total = _supervisor.get_mission_cost(mission_id)
    limit = mission.get("cost_limit_usd")
    return {
        "mission_id": mission_id,
        "total_cost_usd": round(total, 6),
        "cost_limit_usd": limit,
        "within_limit": (total <= limit) if limit else True,
        "percent_used": round((total / limit) * 100, 1) if limit else None,
    }


@router.get(
    "/missions/{mission_id}/alerts",
    summary="Get cost alerts fired during mission execution",
)
async def get_alerts(mission_id: str) -> dict[str, Any]:
    """
    Return the list of cost alerts fired during this mission's execution.

    Each alert includes the cost level ("warning" | "critical"), the cost
    at fire time, the configured threshold, and a human-readable message.
    """
    _get_mission_or_404(mission_id)
    return {
        "mission_id": mission_id,
        "alerts": _alerts.get(mission_id, []),
    }


@router.get(
    "/missions/{mission_id}/memory",
    summary="Get scoped memory entries for a mission (cockpit display)",
)
async def get_memory(mission_id: str) -> dict[str, Any]:
    _get_mission_or_404(mission_id)
    entries = _supervisor.get_mission_memory(mission_id)
    return {"mission_id": mission_id, "memory_entries": entries}
