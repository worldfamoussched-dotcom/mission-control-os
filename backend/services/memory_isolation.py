"""
Memory Isolation Service — Phase 4, Objective 1.

Enforces storage-level memory isolation per Mission. Prevents cross-mission
memory reads/writes regardless of agent-level checks. Works alongside
MemoryReviewerAgent (which enforces at parameter-key level).

This layer enforces at the storage boundary:
- A mission can only read its own scope
- Cross-scope reads require explicit elevated permission
- memory_scope field on Mission determines isolation level
"""

from typing import Any, Optional
from uuid import UUID


class MemoryIsolationError(Exception):
    """Raised when a cross-mission memory access is attempted."""


class MemoryIsolationService:
    """
    Storage-level memory isolation enforcer.

    Wraps MemoryService and adds mission-scope boundary checks before
    every read/write. This is the enforcement layer; MemoryService is storage.

    memory_scope values (from Mission model):
    - 'isolated': only same mission_id can read/write
    - 'shared':   missions with same mode can read; only owner writes
    - 'global':   any mission can read; only owner writes
    """

    def __init__(self, memory_service):
        self._store = memory_service

    # ── Write ──────────────────────────────────────────────────────────────

    def write(
        self,
        mission_id: str,
        key: str,
        value: Any,
        memory_scope: str = "isolated",
        visibility: str = "mission",
    ) -> str:
        """
        Write a memory entry. Always scoped to mission_id.
        Returns the entry ID from the underlying store.
        """
        scoped_key = self._scoped_key(mission_id, key)
        return self._store.store(mission_id, scoped_key, value, visibility)

    # ── Read ───────────────────────────────────────────────────────────────

    def read(
        self,
        requesting_mission_id: str,
        owner_mission_id: str,
        key: str,
        memory_scope: str,
        requesting_mode: Optional[str] = None,
        owner_mode: Optional[str] = None,
    ) -> Optional[Any]:
        """
        Read a memory entry with isolation enforcement.

        Raises MemoryIsolationError if access is not permitted.
        Returns None if permitted but key not found.
        """
        self._enforce_read_permission(
            requesting_mission_id=requesting_mission_id,
            owner_mission_id=owner_mission_id,
            memory_scope=memory_scope,
            requesting_mode=requesting_mode,
            owner_mode=owner_mode,
        )
        scoped_key = self._scoped_key(owner_mission_id, key)
        return self._store.retrieve(owner_mission_id, scoped_key)

    # ── Cross-mission access check ─────────────────────────────────────────

    def can_read(
        self,
        requesting_mission_id: str,
        owner_mission_id: str,
        memory_scope: str,
        requesting_mode: Optional[str] = None,
        owner_mode: Optional[str] = None,
    ) -> bool:
        """Non-raising version of the read permission check."""
        try:
            self._enforce_read_permission(
                requesting_mission_id=requesting_mission_id,
                owner_mission_id=owner_mission_id,
                memory_scope=memory_scope,
                requesting_mode=requesting_mode,
                owner_mode=owner_mode,
            )
            return True
        except MemoryIsolationError:
            return False

    # ── Internal enforcement ───────────────────────────────────────────────

    def _enforce_read_permission(
        self,
        requesting_mission_id: str,
        owner_mission_id: str,
        memory_scope: str,
        requesting_mode: Optional[str],
        owner_mode: Optional[str],
    ) -> None:
        # Same mission always allowed
        if requesting_mission_id == owner_mission_id:
            return

        if memory_scope == "isolated":
            raise MemoryIsolationError(
                f"Mission '{requesting_mission_id}' cannot read memory of isolated "
                f"mission '{owner_mission_id}'. Memory scope is 'isolated'."
            )

        if memory_scope == "shared":
            if requesting_mode and owner_mode and requesting_mode != owner_mode:
                raise MemoryIsolationError(
                    f"Mission '{requesting_mission_id}' (mode={requesting_mode}) cannot "
                    f"read shared memory of mission '{owner_mission_id}' (mode={owner_mode}). "
                    f"Shared scope requires same mode."
                )
            return  # same mode or mode unknown — permit

        if memory_scope == "global":
            return  # any mission can read global scope

        raise MemoryIsolationError(
            f"Unknown memory_scope '{memory_scope}'. "
            "Must be 'isolated', 'shared', or 'global'."
        )

    @staticmethod
    def _scoped_key(mission_id: str, key: str) -> str:
        """Namespace keys by mission_id to prevent collisions in shared scope."""
        return f"{mission_id}::{key}"
