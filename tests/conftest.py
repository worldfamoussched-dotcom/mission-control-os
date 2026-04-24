"""Pytest configuration and shared fixtures."""

import pytest
from backend.models.mission import Mission, MissionMode, ToolRegistry, ABACEngine


@pytest.fixture
def batman_mission():
    """Create a BATMAN mode Mission for testing."""
    return Mission(
        mode=MissionMode.BATMAN,
        objective="Test Batman mission",
        created_by="test_user",
        approvers=["approver1", "approver2"]
    )


@pytest.fixture
def jarvis_mission():
    """Create a JARVIS mode Mission for testing."""
    return Mission(
        mode=MissionMode.JARVIS,
        objective="Test Jarvis mission",
        created_by="test_user"
    )


@pytest.fixture
def wakanda_mission():
    """Create a WAKANDA mode Mission for testing."""
    return Mission(
        mode=MissionMode.WAKANDA,
        objective="Test Wakanda mission",
        created_by="test_user",
        approvers=["approver1", "approver2"]
    )


@pytest.fixture
def tool_registry():
    """Create a ToolRegistry for testing."""
    return ToolRegistry()


@pytest.fixture
def abac_engine():
    """Create an ABACEngine for testing."""
    return ABACEngine()
