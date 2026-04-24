"""Cost alert service — threshold-based alerts for mission spend.

Spec reference: Phase 2 cost alerting.

CostAlertService fires alerts when a mission's accumulated cost approaches
or exceeds a configured threshold. Hysteresis prevents alert spam.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel


class CostAlert(BaseModel):
    """A cost threshold alert for a mission."""

    mission_id: str
    current_cost: float
    threshold: float
    level: str  # "warning" | "critical"
    message: str
    fired_at: datetime


class CostAlertService:
    """
    Synchronous service for threshold-based cost alerts.

    Warning fires at  current_cost >= threshold * WARNING_RATIO  (80%)
    Critical fires at current_cost >= threshold                  (100%)
    Hysteresis: after an alert fires, the next alert only fires once
    current_cost rises at least HYSTERESIS * threshold above the
    cost level at which the last alert was fired.

    Usage:
        service = CostAlertService(threshold=1.0)
        alert = service.check("m_abc", 0.85)   # → CostAlert(level="warning")
        service.reset("m_abc")                  # clear state when mission ends
    """

    WARNING_RATIO: float = 0.8    # fire warning at 80% of threshold
    HYSTERESIS: float = 0.05      # re-fire band: 5% of threshold above last fire

    def __init__(self, threshold: float = 1.0) -> None:
        """
        Args:
            threshold: Cost limit in USD (default $1.00 per mission).
        """
        self.threshold = threshold
        # maps mission_id → cost at which the last alert was fired
        self._last_fired: dict[str, float] = {}

    # ------------------------------------------------------------------
    # Core API
    # ------------------------------------------------------------------

    def check(self, mission_id: str, current_cost: float) -> Optional[CostAlert]:
        """
        Check whether an alert should fire for the given mission cost.

        Returns a CostAlert if a threshold has been crossed (and hysteresis
        allows it), otherwise returns None.

        Critical takes precedence over warning when both are crossed.
        """
        warning_threshold = self.threshold * self.WARNING_RATIO

        # Determine which level (if any) has been crossed
        if current_cost >= self.threshold:
            level = "critical"
        elif current_cost >= warning_threshold:
            level = "warning"
        else:
            # Below warning threshold — no alert
            return None

        # Hysteresis check: don't re-fire until cost rises by another band
        last_fired_cost = self._last_fired.get(mission_id)
        if last_fired_cost is not None:
            hysteresis_band = self.threshold * self.HYSTERESIS
            if current_cost < last_fired_cost + hysteresis_band:
                return None

        # Fire the alert and record the fire point
        self._last_fired[mission_id] = current_cost

        percent = round((current_cost / self.threshold) * 100, 1)
        message = (
            f"Mission cost at {percent}% of ${self.threshold:.2f} threshold"
        )

        return CostAlert(
            mission_id=mission_id,
            current_cost=round(current_cost, 6),
            threshold=self.threshold,
            level=level,
            message=message,
            fired_at=datetime.now(timezone.utc),
        )

    def reset(self, mission_id: str) -> None:
        """Clear alert state for a mission (call when mission completes)."""
        self._last_fired.pop(mission_id, None)
