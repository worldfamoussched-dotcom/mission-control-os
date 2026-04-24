# Fractal Memory Integration — Phase 1

**Purpose:** Retrofit the basic `memory_service.py` with the Fractal Memory architecture from CLAUDE.md without blocking Phase 1 MVP.

---

## Architecture — Toroidal Contraction Model

Memory is organized in **dimensional shells** that follow TopoCN (torus contraction) + HEMA (two-level hierarchy):

| Shell | Scope | Phase 1 Role |
|-------|-------|--------------|
| **8D (Identity)** | Never changes. Who Nick is. Mission Control OS principles. | Loaded as constants — read-only |
| **16D (Current)** | Active session state. What's being worked now. | Live cache per mission_id |
| **32D (Long-term)** | Persistent goals, project state. | Postgres + embeddings |
| **64D (Patterns)** | Recurring reasoning structures. | Promoted from 32D on recurrence |

**Rule:** Shells never age out. Torus contracts — does not prune. Only 16D follows age-weighted pruning.

---

## Fractal Memory Core Components

### 1. Shell-Based Storage

```python
class ShellMemory:
    """Base class for dimensional shell memory."""
    shell_dim: int  # 8, 16, 32, or 64
    torus_state: Literal["expanded", "contracted"]
```

### 2. Ring Adjacency Map

Domain codes have ring-distance relationships:
- **Ring 1 (always co-loaded):** `[MISSION] ↔ [AGENT]`, `[TOOL] ↔ [EXECUTION]`
- **Ring 2 (load on cross-domain signal):** `[MISSION]/[AGENT] ↔ [MEMORY]`, `[AUDIT] ↔ [COST]`
- **Ring 3 (explicit only):** `[APPROVAL] ↔ [ABAC]`, `[VISION] ↔ all`

### 3. Hebbian Weight Updates

Each memory pair tracks `co_occurrence_count`. When it crosses threshold (θ=5), ring distance tightens by 1.

### 4. Sub-Shell Kernel (Recursion Inside Shells)

Inside each shell: `(ring_distance, Hebbian_update, local_consolidation, soft_decay)`

- **Local consolidation:** motif recurs ≥3 sessions → promote to local anchor
- **Soft decay:** weight dampening, not deletion

### 5. Consolidation (Shell Graduation)

At session close: scan for items appearing 3+ sessions → propose graduation to higher shell.

---

## Phase 1 Retrofit Plan

### Step 1: Keep Existing Basic Memory (Done ✅)

`memory_service.py` handles mission-scoped key-value store for MVP.

### Step 2: Add FractalMemoryShell Class

New file: `backend/services/fractal_memory.py`

```python
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

@dataclass(frozen=True)
class MemoryEntry:
    """Immutable memory entry with shell metadata."""
    id: str
    shell_dim: int
    mode: str  # batman, jarvis, wakanda
    mission_id: str | None
    role: Literal["task", "context", "blockers", "decisions", "signals"]
    content: str
    timestamp: datetime
    weight: float = 1.0
    observed_sessions: int = 1
    anchor_status: Literal["raw", "local_anchor"] = "raw"
    linked_roles: tuple[str, ...] = field(default_factory=tuple)


class FractalMemoryShell:
    """
    Dimensional shell with torus contraction + Hebbian updates.
    Wraps existing MemoryService as storage backend.
    """
    def __init__(self, shell_dim: int, storage: MemoryService):
        self.shell_dim = shell_dim
        self.storage = storage
        self.hebbian_weights: dict[tuple[str, str], int] = {}

    def store_with_role(self, mission_id: str, role: str, content: str) -> str:
        """Store memory entry with cognitive role (task/context/blockers/decisions/signals)."""
        # Delegates to basic MemoryService, adds shell metadata

    def retrieve_by_ring(self, mission_id: str, primary_role: str, max_ring: int = 1) -> list:
        """Retrieve entries at ring distance ≤ max_ring from primary_role."""
        # Role ring: task → context → blockers → decisions → signals → task

    def update_hebbian(self, role_a: str, role_b: str) -> None:
        """Increment co-occurrence. Tighten ring if crosses θ=5."""
```

### Step 3: Route Agent Memory Through Shells

In `batman_lead.py` and specialists:
- Mission start → store to 16D shell, role=`task`
- Tool failures → store to 16D shell, role=`blockers`
- Approval records → store to 16D shell, role=`decisions`
- Recurring motifs → flagged as 16D local_anchor candidates

### Step 4: Consolidation at Mission Close

On `MissionState.COMPLETED` or `FROZEN`:
- Scan 16D entries with `observed_sessions >= 3`
- Promote to 32D as graduation candidates
- Log promotion for human approval (Phase 2)

---

## Phase 1 Minimum Fractal Features

To keep MVP shippable, only these Fractal features are required in Phase 1:

- [x] **Basic memory service** (already built)
- [ ] **FractalMemoryShell wrapper** (thin layer over basic memory)
- [ ] **Role tagging** (task/context/blockers/decisions/signals on every memory entry)
- [ ] **Ring adjacency retrieval** (get related entries within ring distance)
- [ ] **Hebbian counter** (track co-occurrence, no promotion logic yet)

### Deferred to Phase 2

- Shell graduation (16D → 32D promotion)
- Local anchor consolidation
- Soft decay weight dampening
- Cross-shell retrieval kernel
- Age-weighted pruning in 16D

---

## Why This Alignment Matters

**Without Fractal Memory:** Phase 1 agents will have flat, per-mission memory silos. Cross-mission pattern learning impossible. Signals never consolidate. Scaling to Jarvis/Wakanda modes creates 3x storage overhead without learning benefit.

**With Fractal Memory:** Every memory write carries shell + role + ring metadata. Phase 2+ can enable full consolidation. Agents learn from recurring missions without manual retraining. Mode isolation preserved at ring level.

---

## Mapping to 10 Pillars

**Pillar 6 (Scoped Memory)** is reframed:

| Before | After |
|--------|-------|
| Mission-scoped key-value | 16D shell + role + ring adjacency + Hebbian updates |
| No cross-mission learning | Consolidation to 32D for recurring motifs |
| Flat retrieval | Ring-distance retrieval (role-aware) |
| No decay model | Soft decay + local anchor promotion |

---

## Files to Add in Phase 1

1. `backend/services/fractal_memory.py` — FractalMemoryShell class + MemoryEntry dataclass
2. `backend/services/consolidation_service.py` — Stub (Phase 2 logic)
3. `tests/unit/test_fractal_memory.py` — Unit tests for shell + role + ring logic
4. `docs/FRACTAL_MEMORY_INTEGRATION.md` — This document

---

## Verification

- [ ] Every agent memory write includes `shell_dim`, `role`, `timestamp`, `weight`
- [ ] Ring adjacency retrieval returns correct subset of entries
- [ ] Hebbian counter increments on co-occurring role pairs
- [ ] Basic MemoryService tests still pass (backward compatible)
- [ ] No breaking changes to existing API contracts

---

**Status:** Design complete. Implementation queued after Phase 1 skeleton review.

**Underlying Structure:** Shell recursion ⊂ Torus contraction. Role ring = cycle graph C₅ (task→context→blockers→decisions→signals). Hebbian rule: Δw = η·x_i·x_j with threshold θ=5. Local consolidation = motif frequency ≥3 sessions → weight promotion. This is the same fractal the top-level memory system uses, applied one level deeper.
