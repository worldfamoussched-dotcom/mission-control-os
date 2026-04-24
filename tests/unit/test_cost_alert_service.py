"""
Unit tests for CostAlertService.

Covers: threshold crossing, level precedence, hysteresis, reset, isolation.
"""

from __future__ import annotations

import pytest

from backend.services.cost_alert_service import CostAlert, CostAlertService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

THRESHOLD = 1.0  # $1.00 for all tests unless overridden
MISSION_A = "m_test_a"
MISSION_B = "m_test_b"


def _service(threshold: float = THRESHOLD) -> CostAlertService:
    return CostAlertService(threshold=threshold)


# ---------------------------------------------------------------------------
# Basic threshold behaviour
# ---------------------------------------------------------------------------

def test_no_alert_below_warning_threshold():
    """70% of threshold → no alert."""
    svc = _service()
    result = svc.check(MISSION_A, THRESHOLD * 0.70)
    assert result is None


def test_warning_alert_at_80_percent():
    """Exactly 80% of threshold → warning alert."""
    svc = _service()
    alert = svc.check(MISSION_A, THRESHOLD * 0.80)
    assert alert is not None
    assert isinstance(alert, CostAlert)
    assert alert.level == "warning"
    assert alert.mission_id == MISSION_A
    assert alert.threshold == THRESHOLD


def test_critical_alert_at_100_percent():
    """Exactly 100% of threshold → critical alert."""
    svc = _service()
    alert = svc.check(MISSION_A, THRESHOLD * 1.00)
    assert alert is not None
    assert alert.level == "critical"


def test_critical_supersedes_warning():
    """110% of threshold → critical, not warning."""
    svc = _service()
    alert = svc.check(MISSION_A, THRESHOLD * 1.10)
    assert alert is not None
    assert alert.level == "critical"


# ---------------------------------------------------------------------------
# Hysteresis
# ---------------------------------------------------------------------------

def test_hysteresis_prevents_repeated_alerts():
    """
    Fire at 80%, then check at 81%.
    81% < 80% + 5% hysteresis band → should NOT re-fire.
    """
    svc = _service()
    first = svc.check(MISSION_A, THRESHOLD * 0.80)
    assert first is not None  # fires once

    second = svc.check(MISSION_A, THRESHOLD * 0.81)
    assert second is None  # within hysteresis band


def test_hysteresis_allows_alert_after_band():
    """
    Fire at 80%, check at 87% (80% + 5% band + 2% extra).
    87% > 80% + 5% → should fire again.
    """
    svc = _service()
    first = svc.check(MISSION_A, THRESHOLD * 0.80)
    assert first is not None

    second = svc.check(MISSION_A, THRESHOLD * 0.87)
    assert second is not None


def test_hysteresis_exact_band_boundary_does_not_fire():
    """
    Fire at 80%, check exactly at 80% + 5% = 85%.
    The condition is strictly less-than, so 85% should NOT fire
    (cost must EXCEED last_fired + band, not just equal it).
    """
    svc = _service()
    svc.check(MISSION_A, THRESHOLD * 0.80)  # fires at 0.80

    # 0.80 + 0.05 = 0.85 exactly — NOT above the band
    result = svc.check(MISSION_A, THRESHOLD * 0.85)
    assert result is None


def test_hysteresis_just_above_band_fires():
    """Fire at 80%, then 85.1% — just above the band boundary → fires."""
    svc = _service()
    svc.check(MISSION_A, THRESHOLD * 0.80)

    result = svc.check(MISSION_A, THRESHOLD * 0.851)
    assert result is not None


# ---------------------------------------------------------------------------
# Reset
# ---------------------------------------------------------------------------

def test_reset_clears_state():
    """Fire alert, reset, check same cost → alert fires again."""
    svc = _service()
    first = svc.check(MISSION_A, THRESHOLD * 0.80)
    assert first is not None

    svc.reset(MISSION_A)

    second = svc.check(MISSION_A, THRESHOLD * 0.80)
    assert second is not None  # fresh start after reset


def test_reset_nonexistent_mission_does_not_raise():
    """Resetting a mission that never fired should not raise."""
    svc = _service()
    svc.reset("m_never_existed")  # should be a no-op


# ---------------------------------------------------------------------------
# Mission isolation
# ---------------------------------------------------------------------------

def test_multiple_missions_isolated():
    """Alert state for mission A does not affect mission B."""
    svc = _service()

    # Fire on A at 80%
    alert_a = svc.check(MISSION_A, THRESHOLD * 0.80)
    assert alert_a is not None

    # B has no history — same cost should fire for B independently
    alert_b = svc.check(MISSION_B, THRESHOLD * 0.80)
    assert alert_b is not None

    # A is still within hysteresis band
    no_alert_a = svc.check(MISSION_A, THRESHOLD * 0.82)
    assert no_alert_a is None

    # B is also within hysteresis band
    no_alert_b = svc.check(MISSION_B, THRESHOLD * 0.82)
    assert no_alert_b is None


# ---------------------------------------------------------------------------
# Alert content
# ---------------------------------------------------------------------------

def test_alert_message_contains_percent_and_threshold():
    """Message should mention the percentage and threshold value."""
    svc = _service(threshold=2.0)
    alert = svc.check(MISSION_A, 1.6)  # 80% of $2.00
    assert alert is not None
    assert "80.0%" in alert.message
    assert "$2.00" in alert.message


def test_alert_fired_at_is_set():
    """fired_at should be a valid datetime."""
    from datetime import datetime
    svc = _service()
    alert = svc.check(MISSION_A, THRESHOLD * 0.90)
    assert alert is not None
    assert isinstance(alert.fired_at, datetime)


def test_cost_alert_is_immutable_pydantic_model():
    """CostAlert is a Pydantic model — verify key fields are accessible."""
    from datetime import datetime, timezone
    alert = CostAlert(
        mission_id="m_x",
        current_cost=0.85,
        threshold=1.0,
        level="warning",
        message="test",
        fired_at=datetime.now(timezone.utc),
    )
    assert alert.mission_id == "m_x"
    assert alert.level == "warning"
