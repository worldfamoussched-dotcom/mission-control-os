"""
Mission Object — Core data model for Mission Control OS.

Spec sections: 1–2 (Mission Object definition)
The Mission Object is the fundamental unit in Mission Control OS. Every operation,
decision, and state change is captured as a Mission with immutable audit logs.

Modes:
- BATMAN: Full approval chain (all decisions reviewed)
- JARVIS: Auto-execute (no approval, immediate execution)
- WAKANDA: Selective approval (some decisions pre-approved, others require review)
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator, ConfigDict


class MissionMode(str, Enum):
    """Execution mode for a Mission."""
    BATMAN = "batman"      # Full approval chain
    JARVIS = "jarvis"      # Auto-execute, no approval
    WAKANDA = "wakanda"    # Mixed: some auto, some approval


class MissionState(str, Enum):
    """Lifecycle state of a Mission."""
    CREATED = "created"              # Just initialized
    PENDING_APPROVAL = "pending"     # Waiting for human approval
    APPROVED = "approved"            # Approved, ready to execute
    EXECUTING = "executing"          # Currently running
    COMPLETED = "completed"          # Finished successfully
    FAILED = "failed"                # Execution failed
    CANCELLED = "cancelled"          # User cancelled


class ApprovalRecord(BaseModel):
    """Record of a single approval decision."""
    approver_id: str = Field(..., description="User who approved")
    approved_at: datetime = Field(default_factory=datetime.utcnow)
    decision: str = Field(..., description="'approved' or 'rejected'")
    reason: Optional[str] = Field(None, description="Explanation for decision")


class AuditLogEntry(BaseModel):
    """Immutable record of a single event in Mission lifecycle."""
    model_config = ConfigDict(frozen=True)

    timestamp: datetime = Field(default_factory=datetime.utcnow)
    event_type: str = Field(..., description="e.g. 'state_change', 'approval', 'tool_invoked'")
    actor: str = Field(..., description="User or agent who triggered the event")
    details: Dict[str, Any] = Field(default_factory=dict, description="Event-specific data")
    cost_usd: float = Field(0.0, description="Cost incurred by this event")


class Mission(BaseModel):
    """
    Core Mission Object — represents a unit of work in Mission Control OS.

    Immutable after creation. State changes are recorded in audit_log only.
    """

    # Identity
    id: UUID = Field(default_factory=uuid4, description="Unique mission ID")
    parent_id: Optional[UUID] = Field(None, description="Parent mission (for sub-missions)")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str = Field(..., description="User who created the mission")

    # Execution context
    mode: MissionMode = Field(..., description="BATMAN, JARVIS, or WAKANDA")
    state: MissionState = Field(default=MissionState.CREATED)
    objective: str = Field(..., description="High-level description of what to accomplish")

    # Approval chain (for BATMAN mode)
    approvers: List[str] = Field(
        default_factory=list,
        description="User IDs who must approve before execution"
    )
    approvals: List[ApprovalRecord] = Field(
        default_factory=list,
        description="Completed approval records"
    )

    # Memory + cost tracking
    memory_scope: str = Field(
        default="isolated",
        description="'isolated' (private), 'shared' (team), 'global' (org)"
    )
    cost_tracking_enabled: bool = Field(
        default=True,
        description="If True, track and report token/compute costs"
    )
    estimated_cost_usd: float = Field(
        default=0.0,
        description="Estimated cost before execution"
    )
    actual_cost_usd: float = Field(
        default=0.0,
        description="Actual cost after completion"
    )

    # Audit trail (immutable)
    audit_log: List[AuditLogEntry] = Field(
        default_factory=list,
        description="Immutable history of all events"
    )

    # Tools + constraints
    allowed_tools: List[str] = Field(
        default_factory=list,
        description="List of tool names this mission can invoke (ABAC enforcement)"
    )
    abac_policy: Optional[Dict[str, Any]] = Field(
        default=None,
        description=(
            "Mission-scoped ABAC policy for the Phase 2 ReviewGate. "
            "Shape: {'allowed_tools': [str], 'forbidden_params': [str]}. "
            "When None, SecurityReviewer falls back to its service default."
        ),
    )
    max_iterations: int = Field(
        default=10,
        description="Prevent infinite loops — max decision iterations"
    )

    # Metadata
    tags: List[str] = Field(default_factory=list, description="Arbitrary tags for filtering")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Custom metadata")

    @field_validator("approvers")
    @classmethod
    def validate_approvers_for_batman(cls, v: List[str], info) -> List[str]:
        """BATMAN mode requires at least one approver."""
        if info.data.get("mode") == MissionMode.BATMAN and not v:
            raise ValueError("BATMAN mode requires at least one approver")
        return v

    @field_validator("memory_scope")
    @classmethod
    def validate_memory_scope(cls, v: str) -> str:
        """Memory scope must be one of: isolated, shared, global."""
        if v not in ("isolated", "shared", "global"):
            raise ValueError("memory_scope must be 'isolated', 'shared', or 'global'")
        return v

    def add_audit_entry(
        self,
        event_type: str,
        actor: str,
        details: Optional[Dict[str, Any]] = None,
        cost_usd: float = 0.0
    ) -> None:
        """
        Add an immutable entry to the audit log.
        This is the ONLY way to record events in a Mission.
        """
        entry = AuditLogEntry(
            event_type=event_type,
            actor=actor,
            details=details or {},
            cost_usd=cost_usd
        )
        self.audit_log.append(entry)
        if cost_usd > 0:
            self.actual_cost_usd += cost_usd

    def can_execute(self) -> bool:
        """
        Check if Mission can execute.
        - BATMAN: Requires all approvers to approve
        - JARVIS: Always True (no approval needed)
        - WAKANDA: Requires at least one approver
        """
        if self.mode == MissionMode.JARVIS:
            return True

        if self.mode == MissionMode.BATMAN:
            return len(self.approvals) == len(self.approvers)

        if self.mode == MissionMode.WAKANDA:
            return len(self.approvals) > 0

        return False

    model_config = ConfigDict(
        use_enum_values=False,
        ser_json_encoders={
            UUID: str,
            datetime: lambda v: v.isoformat(),
        }
    )


# ============================================================================
# Tool Registry — defines what tools are available and their constraints
# ============================================================================

class ToolDefinition(BaseModel):
    """Definition of a single tool available in the system."""
    name: str = Field(..., description="Tool name (e.g. 'web_search', 'run_code')")
    description: str = Field(...)
    requires_approval: bool = Field(
        default=True,
        description="If True, tool invocation requires Mission approval"
    )
    requires_cost_tracking: bool = Field(
        default=True,
        description="If True, tool usage is cost-tracked"
    )
    allowed_in_modes: List[MissionMode] = Field(
        default_factory=lambda: [MissionMode.BATMAN, MissionMode.JARVIS, MissionMode.WAKANDA],
        description="Which modes are allowed to use this tool"
    )
    max_cost_per_invocation_usd: float = Field(
        default=10.0,
        description="Cost ceiling to prevent runaway costs"
    )

    @field_validator("allowed_in_modes", mode="before")
    @classmethod
    def default_allowed_modes(cls, v: Optional[List[MissionMode]]) -> List[MissionMode]:
        """If not specified, all modes can use the tool."""
        return v or [MissionMode.BATMAN, MissionMode.JARVIS, MissionMode.WAKANDA]


class ToolRegistry(BaseModel):
    """Central registry of all available tools."""
    tools: Dict[str, ToolDefinition] = Field(default_factory=dict)

    def register_tool(self, tool_def: ToolDefinition) -> None:
        """Register a tool in the registry."""
        self.tools[tool_def.name] = tool_def

    def get_tool(self, tool_name: str) -> Optional[ToolDefinition]:
        """Retrieve a tool definition by name."""
        return self.tools.get(tool_name)

    def can_use_tool(self, tool_name: str, mission: Mission) -> bool:
        """
        Check if a Mission can use a tool based on:
        - Tool exists
        - Tool is allowed in Mission's mode
        - Tool is in Mission's allowed_tools list
        """
        tool = self.get_tool(tool_name)
        if not tool:
            return False

        if mission.mode not in tool.allowed_in_modes:
            return False

        if mission.allowed_tools and tool_name not in mission.allowed_tools:
            return False

        return True


# ============================================================================
# ABAC Engine (core enforcement)
# ============================================================================

class ABACPolicy(BaseModel):
    """
    Attribute-Based Access Control policy.

    Determines: Can actor A use tool T on resource R given Mission M's attributes?
    """
    actor_roles: List[str] = Field(..., description="Roles the actor has (e.g. 'admin', 'viewer')")
    tool_name: str = Field(..., description="Tool being accessed")
    mission_id: Optional[UUID] = Field(None, description="Mission being accessed")
    allowed: bool = Field(..., description="Is access allowed?")


class ABACEngine(BaseModel):
    """ABAC enforcement layer."""
    policies: List[ABACPolicy] = Field(default_factory=list)

    def check_access(
        self,
        actor_id: str,
        actor_roles: List[str],
        tool_name: str,
        mission: Mission
    ) -> bool:
        """
        Check if actor can use tool in mission context.
        Simplistic implementation — expand as needed.
        """
        for policy in self.policies:
            if policy.tool_name == tool_name and policy.mission_id == mission.id:
                # Check if actor's roles satisfy the policy
                if any(role in policy.actor_roles for role in actor_roles):
                    return policy.allowed

        # Default: deny unless explicitly allowed
        return False

    def add_policy(self, policy: ABACPolicy) -> None:
        """Add an ABAC policy."""
        self.policies.append(policy)
