"""SQLAlchemy ORM models for Mission Control OS."""

from sqlalchemy import Column, String, Text, Float, DateTime, Boolean, JSON, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum

Base = declarative_base()


class MissionMode(str, enum.Enum):
    """Mission execution mode."""
    BATMAN = "batman"
    JARVIS = "jarvis"
    WAKANDA = "wakanda"


class MissionState(str, enum.Enum):
    """Mission lifecycle state."""
    PENDING_DECOMPOSITION = "pending_decomposition"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    FROZEN = "frozen"


class TaskStatus(str, enum.Enum):
    """Task execution status."""
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    REJECTED = "rejected"


class Mission(Base):
    """Mission record."""
    __tablename__ = "missions"

    id = Column(String(64), primary_key=True, index=True)
    objective = Column(Text, nullable=False)
    mode = Column(Enum(MissionMode), default=MissionMode.BATMAN, nullable=False)
    state = Column(Enum(MissionState), default=MissionState.PENDING_DECOMPOSITION, nullable=False)
    approvers = Column(JSON, default=list)
    cost_limit_usd = Column(Float, nullable=True)
    total_cost_usd = Column(Float, default=0.0)
    tags = Column(JSON, default=list)
    abac_policy = Column(JSON, nullable=True)  # Per-mission ABAC policy (Spec §2.2)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    tasks = relationship("Task", back_populates="mission", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="mission", cascade="all, delete-orphan")
    memory_entries = relationship("MemoryEntry", back_populates="mission", cascade="all, delete-orphan")


class Task(Base):
    """Task record."""
    __tablename__ = "tasks"

    id = Column(String(64), primary_key=True, index=True)
    mission_id = Column(String(64), ForeignKey("missions.id"), nullable=False, index=True)
    name = Column(String(256), nullable=False)
    description = Column(Text)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING_APPROVAL, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    approved_at = Column(DateTime, nullable=True)
    executed_at = Column(DateTime, nullable=True)

    # Relationships
    mission = relationship("Mission", back_populates="tasks")
    executions = relationship("Execution", back_populates="task", cascade="all, delete-orphan")


class Execution(Base):
    """Task execution record."""
    __tablename__ = "executions"

    id = Column(String(64), primary_key=True, index=True)
    task_id = Column(String(64), ForeignKey("tasks.id"), nullable=False, index=True)
    tool_name = Column(String(256), nullable=False)
    status = Column(String(50), default="pending")  # pending, executing, success, failure
    output = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    duration_seconds = Column(Float, default=0.0)
    cost_usd = Column(Float, default=0.0)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    task = relationship("Task", back_populates="executions")


class ApprovalRecord(Base):
    """Approval record for tasks."""
    __tablename__ = "approvals"

    id = Column(String(64), primary_key=True, index=True)
    task_id = Column(String(64), ForeignKey("tasks.id"), nullable=False, index=True)
    approver_id = Column(String(256), nullable=False)
    approved = Column(Boolean, nullable=False)
    reason = Column(Text, nullable=True)
    approved_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class AuditLog(Base):
    """Immutable audit log for mission events."""
    __tablename__ = "audit_logs"

    id = Column(String(64), primary_key=True, index=True)
    mission_id = Column(String(64), ForeignKey("missions.id"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)  # created, approved, executed, failed, etc.
    actor = Column(String(256), nullable=False)
    details = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    mission = relationship("Mission", back_populates="audit_logs")


class MemoryEntry(Base):
    """Mission-scoped memory entry."""
    __tablename__ = "memory_entries"

    id = Column(String(64), primary_key=True, index=True)
    mission_id = Column(String(64), ForeignKey("missions.id"), nullable=False, index=True)
    key = Column(String(256), nullable=False)
    value = Column(JSON, nullable=False)
    visibility = Column(String(50), default="mission")  # mission, task, internal
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    mission = relationship("Mission", back_populates="memory_entries")


class ReviewResultRecord(Base):
    """
    Persisted ReviewGate result — one row per (task, reviewer).

    Spec reference: Phase 2 §6–8 (audit trail for the review gate).
    """
    __tablename__ = "review_results"

    id = Column(String(64), primary_key=True, index=True)
    mission_id = Column(String(64), ForeignKey("missions.id"), nullable=False, index=True)
    task_id = Column(String(64), nullable=False, index=True)
    reviewer = Column(String(50), nullable=False)  # code | memory | security
    passed = Column(Boolean, nullable=False)
    reason = Column(Text, nullable=False)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )


class CostAlertRecord(Base):
    """
    Persisted CostAlertService firing — one row per alert.

    Spec reference: Phase 2 §15–17 (cost monitoring + audit).
    """
    __tablename__ = "cost_alerts"

    id = Column(String(64), primary_key=True, index=True)
    mission_id = Column(String(64), ForeignKey("missions.id"), nullable=False, index=True)
    level = Column(String(20), nullable=False)  # warning | critical
    current_cost = Column(Float, nullable=False)
    threshold = Column(Float, nullable=False)
    message = Column(Text, nullable=False)
    fired_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )


class ToolPermission(Base):
    """Tool usage permissions and constraints."""
    __tablename__ = "tool_permissions"

    id = Column(String(64), primary_key=True, index=True)
    mission_id = Column(String(64), ForeignKey("missions.id"), nullable=False, index=True)
    tool_name = Column(String(256), nullable=False)
    allowed = Column(Boolean, default=True)
    max_uses = Column(String(50), nullable=True)  # "unlimited", "3", "10", etc.
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
