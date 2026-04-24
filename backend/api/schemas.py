"""Pydantic schemas for API requests/responses."""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum

# ============================================================================
# Enums
# ============================================================================

class MissionMode(str, Enum):
    """Mission execution mode."""
    BATMAN = "batman"      # Manual approval required
    JARVIS = "jarvis"      # Command execute, no approval
    WAKANDA = "wakanda"    # Mixed, selective approval


class MissionState(str, Enum):
    """Mission lifecycle state."""
    PENDING_DECOMPOSITION = "pending_decomposition"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    FROZEN = "frozen"


class TaskStatus(str, Enum):
    """Task execution status."""
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    REJECTED = "rejected"


class ExecutionStatus(str, Enum):
    """Execution result status."""
    SUCCESS = "success"
    FAILURE = "failure"
    TIMEOUT = "timeout"


# ============================================================================
# Request Schemas
# ============================================================================

class CreateMissionRequest(BaseModel):
    """Request to create a new mission."""
    objective: str = Field(..., min_length=1, max_length=1000)
    mode: MissionMode = MissionMode.BATMAN
    approvers: List[str] = Field(default_factory=list)
    cost_limit_usd: Optional[float] = Field(None, gt=0)
    tags: Optional[List[str]] = Field(default_factory=list)
    abac_policy: Optional[dict] = Field(
        None,
        description=(
            "Mission-scoped ABAC policy for Phase 2 ReviewGate. "
            "Shape: {'allowed_tools': [str], 'forbidden_params': [str]}."
        ),
    )

    class Config:
        json_schema_extra = {
            "example": {
                "objective": "Summarize three documents and compile findings",
                "mode": "batman",
                "approvers": ["operator@example.com"],
                "cost_limit_usd": 10.0,
                "tags": ["urgent", "research"]
            }
        }


class ApprovalRequest(BaseModel):
    """Request to approve a task."""
    approved: bool
    reason: Optional[str] = None
    approver_id: str = Field(..., min_length=1)

    class Config:
        json_schema_extra = {
            "example": {
                "approved": True,
                "reason": "Looks good, approved for execution",
                "approver_id": "operator@example.com"
            }
        }


class ExecuteTaskRequest(BaseModel):
    """Request to execute a task."""
    mission_id: str
    task_id: str


# ============================================================================
# Response Schemas
# ============================================================================

class ApprovalRecord(BaseModel):
    """A record of task approval."""
    id: str
    task_id: str
    approver_id: str
    approved: bool
    reason: Optional[str] = None
    approved_at: datetime

    class Config:
        from_attributes = True


class TaskDefinitionResponse(BaseModel):
    """Task definition for API response."""
    id: str
    mission_id: str
    name: str
    description: str
    status: TaskStatus
    created_at: datetime
    approved_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExecutionLogEntry(BaseModel):
    """Single execution log entry."""
    timestamp: datetime
    level: str  # INFO, WARNING, ERROR
    message: str
    details: Optional[dict] = None

    class Config:
        from_attributes = True


class MissionResponse(BaseModel):
    """Complete mission response."""
    id: str
    objective: str
    mode: MissionMode
    state: MissionState
    approvers: List[str]
    cost_limit_usd: Optional[float] = None
    total_cost_usd: float = 0.0
    created_at: datetime
    completed_at: Optional[datetime] = None
    tags: List[str] = []
    tasks: List[TaskDefinitionResponse] = []
    audit_log: List[ExecutionLogEntry] = []

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "m1",
                "objective": "Summarize three documents",
                "mode": "batman",
                "state": "executing",
                "approvers": ["operator@example.com"],
                "cost_limit_usd": 10.0,
                "total_cost_usd": 2.5,
                "created_at": "2025-04-24T10:00:00Z",
                "completed_at": None,
                "tags": ["urgent"],
                "tasks": [],
                "audit_log": []
            }
        }


class ApprovalResponse(BaseModel):
    """Response from approval action."""
    success: bool
    approval_id: str
    task_id: str
    message: str

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "approval_id": "a1",
                "task_id": "t1",
                "message": "Task approved and ready for execution"
            }
        }


class ExecutionResult(BaseModel):
    """Result of task execution."""
    execution_id: str
    task_id: str
    status: ExecutionStatus
    output: Optional[str] = None
    error: Optional[str] = None
    cost_usd: float = 0.0
    duration_seconds: float
    completed_at: datetime

    class Config:
        from_attributes = True


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str
    detail: Optional[str] = None
    request_id: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "error": "Mission not found",
                "detail": "Mission with id 'm1' does not exist",
                "request_id": "req_abc123"
            }
        }
