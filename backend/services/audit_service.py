"""Audit Service — durable persistence for ReviewGate results and CostAlerts.

Spec reference: Phase 2 §6–8 (review-gate audit trail) and §15–17 (cost
monitoring + audit).

Wraps the SQLAlchemy session with a tight, mission-scoped API. Writes are
synchronous; the in-memory `_results` / `_alerts` dicts in routes.py remain
the read path for now (they're populated from these durable rows on first
read after a fresh boot — wiring in Phase 3 / Postgres activation).

This service does not own the session — it accepts a `session_factory`
callable so unit tests can inject a SQLite-in-memory factory and prod can
inject `SessionLocal` from `backend.db.session`.
"""

from __future__ import annotations

import uuid
from typing import Any, Callable, List

from sqlalchemy.orm import Session

from backend.db.models import CostAlertRecord, ReviewResultRecord


SessionFactory = Callable[[], Session]


class AuditService:
    """Persistence for review results and cost alerts.

    Instantiate with a session factory:

        service = AuditService(session_factory=SessionLocal)

    or for tests:

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        TestSession = sessionmaker(bind=engine)
        service = AuditService(session_factory=TestSession)
    """

    def __init__(self, session_factory: SessionFactory) -> None:
        self._session_factory = session_factory

    # ------------------------------------------------------------------
    # Review results
    # ------------------------------------------------------------------

    def record_review_results(
        self,
        mission_id: str,
        task_id: str,
        review_results: List[dict[str, Any]],
    ) -> List[str]:
        """Persist all reviewer verdicts for a single task.

        Each entry in *review_results* must have keys: passed, reason, reviewer.
        Returns the list of generated row IDs.
        """
        ids: List[str] = []
        session: Session = self._session_factory()
        try:
            for rr in review_results:
                row_id = f"rr_{uuid.uuid4().hex[:12]}"
                row = ReviewResultRecord(
                    id=row_id,
                    mission_id=mission_id,
                    task_id=task_id,
                    reviewer=rr["reviewer"],
                    passed=bool(rr["passed"]),
                    reason=rr["reason"],
                )
                session.add(row)
                ids.append(row_id)
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
        return ids

    def list_review_results(self, mission_id: str) -> List[dict[str, Any]]:
        """Read all review results for a mission, ordered by creation time."""
        session: Session = self._session_factory()
        try:
            rows = (
                session.query(ReviewResultRecord)
                .filter(ReviewResultRecord.mission_id == mission_id)
                .order_by(ReviewResultRecord.created_at)
                .all()
            )
            return [
                {
                    "id": r.id,
                    "mission_id": r.mission_id,
                    "task_id": r.task_id,
                    "reviewer": r.reviewer,
                    "passed": r.passed,
                    "reason": r.reason,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ]
        finally:
            session.close()

    # ------------------------------------------------------------------
    # Cost alerts
    # ------------------------------------------------------------------

    def record_cost_alert(self, alert: dict[str, Any]) -> str:
        """Persist a single CostAlert (passed in as a dict from CostAlert.model_dump()).

        Required keys: mission_id, current_cost, threshold, level, message.
        Returns the generated row ID.
        """
        row_id = f"ca_{uuid.uuid4().hex[:12]}"
        session: Session = self._session_factory()
        try:
            row = CostAlertRecord(
                id=row_id,
                mission_id=alert["mission_id"],
                level=alert["level"],
                current_cost=float(alert["current_cost"]),
                threshold=float(alert["threshold"]),
                message=alert["message"],
            )
            session.add(row)
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
        return row_id

    def list_cost_alerts(self, mission_id: str) -> List[dict[str, Any]]:
        """Read all cost alerts for a mission, ordered by fire time."""
        session: Session = self._session_factory()
        try:
            rows = (
                session.query(CostAlertRecord)
                .filter(CostAlertRecord.mission_id == mission_id)
                .order_by(CostAlertRecord.fired_at)
                .all()
            )
            return [
                {
                    "id": r.id,
                    "mission_id": r.mission_id,
                    "level": r.level,
                    "current_cost": r.current_cost,
                    "threshold": r.threshold,
                    "message": r.message,
                    "fired_at": r.fired_at.isoformat() if r.fired_at else None,
                }
                for r in rows
            ]
        finally:
            session.close()
