"""
Phase 4 — Objective 1: Memory Isolation Tests.

Verifies storage-level isolation enforcement across missions and scopes.
"""

import pytest
from backend.services.memory_service import MemoryService
from backend.services.memory_isolation import MemoryIsolationService, MemoryIsolationError


@pytest.fixture
def memory_svc():
    return MemoryService()


@pytest.fixture
def isolation_svc(memory_svc):
    return MemoryIsolationService(memory_svc)


# ── Write tests ─────────────────────────────────────────────────────────────

def test_write_stores_in_mission_scope(isolation_svc, memory_svc):
    entry_id = isolation_svc.write("mission-A", "key1", "value1")
    assert entry_id is not None
    # Underlying store has data for mission-A
    entries = memory_svc.list_memory("mission-A")
    assert len(entries) == 1


def test_write_different_missions_isolated(isolation_svc, memory_svc):
    isolation_svc.write("mission-A", "key1", "alpha")
    isolation_svc.write("mission-B", "key1", "beta")
    # Each mission only sees its own
    assert len(memory_svc.list_memory("mission-A")) == 1
    assert len(memory_svc.list_memory("mission-B")) == 1


# ── Isolated scope ───────────────────────────────────────────────────────────

def test_isolated_scope_same_mission_allowed(isolation_svc):
    isolation_svc.write("mission-A", "k", "v", memory_scope="isolated")
    result = isolation_svc.read("mission-A", "mission-A", "k", memory_scope="isolated")
    assert result == "v"


def test_isolated_scope_cross_mission_blocked(isolation_svc):
    isolation_svc.write("mission-A", "k", "secret", memory_scope="isolated")
    with pytest.raises(MemoryIsolationError, match="isolated"):
        isolation_svc.read("mission-B", "mission-A", "k", memory_scope="isolated")


def test_can_read_isolated_same_mission(isolation_svc):
    assert isolation_svc.can_read("mission-A", "mission-A", "isolated") is True


def test_can_read_isolated_cross_mission(isolation_svc):
    assert isolation_svc.can_read("mission-B", "mission-A", "isolated") is False


# ── Shared scope ─────────────────────────────────────────────────────────────

def test_shared_scope_same_mode_allowed(isolation_svc):
    isolation_svc.write("mission-A", "k", "shared-val", memory_scope="shared")
    result = isolation_svc.read(
        "mission-B", "mission-A", "k",
        memory_scope="shared",
        requesting_mode="batman",
        owner_mode="batman",
    )
    assert result == "shared-val"


def test_shared_scope_different_mode_blocked(isolation_svc):
    isolation_svc.write("mission-A", "k", "val", memory_scope="shared")
    with pytest.raises(MemoryIsolationError, match="same mode"):
        isolation_svc.read(
            "mission-B", "mission-A", "k",
            memory_scope="shared",
            requesting_mode="jarvis",
            owner_mode="batman",
        )


def test_shared_scope_no_mode_info_allowed(isolation_svc):
    # When modes are unknown, shared scope permits (conservative approach)
    isolation_svc.write("mission-A", "k", "v", memory_scope="shared")
    result = isolation_svc.read("mission-B", "mission-A", "k", memory_scope="shared")
    assert result == "v"


# ── Global scope ─────────────────────────────────────────────────────────────

def test_global_scope_any_mission_allowed(isolation_svc):
    isolation_svc.write("mission-A", "k", "global-val", memory_scope="global")
    result = isolation_svc.read(
        "mission-Z", "mission-A", "k",
        memory_scope="global",
        requesting_mode="jarvis",
        owner_mode="batman",
    )
    assert result == "global-val"


# ── Key namespacing ──────────────────────────────────────────────────────────

def test_same_key_different_missions_no_collision(isolation_svc):
    isolation_svc.write("mission-A", "color", "red", memory_scope="global")
    isolation_svc.write("mission-B", "color", "blue", memory_scope="global")
    result_a = isolation_svc.read("mission-A", "mission-A", "color", memory_scope="global")
    result_b = isolation_svc.read("mission-B", "mission-B", "color", memory_scope="global")
    assert result_a == "red"
    assert result_b == "blue"


# ── Unknown scope ─────────────────────────────────────────────────────────────

def test_unknown_scope_raises(isolation_svc):
    with pytest.raises(MemoryIsolationError, match="Unknown memory_scope"):
        isolation_svc.read("mission-B", "mission-A", "k", memory_scope="superscope")
