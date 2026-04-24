"""Memory service - scoped memory isolation per mission."""

from typing import Optional, List, Any
import uuid
from datetime import datetime, timezone


class MemoryService:
    """Service for managing mission-scoped memory."""

    def __init__(self):
        """Initialize memory service."""
        self.memory_store = {}  # mission_id -> [memory_entries]

    def store(
        self,
        mission_id: str,
        key: str,
        value: Any,
        visibility: str = "mission"  # "mission", "task", "internal"
    ) -> str:
        """
        Store a memory entry in mission scope.

        Returns memory entry ID.
        """
        if mission_id not in self.memory_store:
            self.memory_store[mission_id] = []

        entry_id = f"mem_{uuid.uuid4().hex[:8]}"
        entry = {
            "id": entry_id,
            "mission_id": mission_id,
            "key": key,
            "value": value,
            "visibility": visibility,
            "created_at": datetime.now(timezone.utc),
        }

        self.memory_store[mission_id].append(entry)
        return entry_id

    def retrieve(self, mission_id: str, key: str) -> Optional[Any]:
        """
        Retrieve a value from mission scope.

        Returns None if not found.
        """
        entries = self.memory_store.get(mission_id, [])
        for entry in entries:
            if entry["key"] == key:
                return entry["value"]
        return None

    def list_memory(self, mission_id: str, visibility: Optional[str] = None) -> List[dict]:
        """
        List all memory entries for a mission.

        Optionally filter by visibility.
        """
        entries = self.memory_store.get(mission_id, [])
        if visibility:
            entries = [e for e in entries if e["visibility"] == visibility]
        return [e.copy() for e in entries]

    def clear_mission_memory(self, mission_id: str) -> None:
        """Clear all memory for a mission."""
        if mission_id in self.memory_store:
            del self.memory_store[mission_id]

    def is_isolated(self, mission_id1: str, mission_id2: str) -> bool:
        """
        Verify that two missions have isolated memory.

        Returns True if completely isolated.
        """
        entries1 = set(self.memory_store.get(mission_id1, []))
        entries2 = set(self.memory_store.get(mission_id2, []))

        # No shared entries
        return len(entries1 & entries2) == 0
