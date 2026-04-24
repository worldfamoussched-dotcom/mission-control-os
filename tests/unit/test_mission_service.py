"""Unit tests for mission service."""

import pytest
from backend.services.mission_service import MissionService
from backend.api.schemas import CreateMissionRequest, MissionMode


@pytest.mark.asyncio
async def test_create_mission():
    """Test creating a new mission."""
    service = MissionService()
    req = CreateMissionRequest(
        objective="Test mission",
        mode=MissionMode.BATMAN,
        approvers=["approver@example.com"]
    )

    mission = await service.create_mission(req)

    assert mission["objective"] == "Test mission"
    assert mission["mode"] == MissionMode.BATMAN
    assert mission["approvers"] == ["approver@example.com"]
    assert "id" in mission
    assert "created_at" in mission


@pytest.mark.asyncio
async def test_get_mission():
    """Test retrieving a mission."""
    service = MissionService()
    req = CreateMissionRequest(objective="Test", mode=MissionMode.BATMAN)
    created = await service.create_mission(req)

    retrieved = await service.get_mission(created["id"])

    assert retrieved is not None
    assert retrieved["id"] == created["id"]
    assert retrieved["objective"] == "Test"


@pytest.mark.asyncio
async def test_list_missions():
    """Test listing missions."""
    service = MissionService()
    req1 = CreateMissionRequest(objective="Mission 1", mode=MissionMode.BATMAN)
    req2 = CreateMissionRequest(objective="Mission 2", mode=MissionMode.JARVIS)

    await service.create_mission(req1)
    await service.create_mission(req2)

    missions = await service.list_missions()

    assert len(missions) == 2
