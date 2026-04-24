"""
Supervisor — top-level orchestration for Batman Mode.

Spec reference: Phase 1 §3–5 (Batman mode orchestration)

The Supervisor owns the full mission lifecycle:
  1. Create mission → decompose (Claude)
  2. Present tasks to operator via API (approval queue)
  3. Resume execution after approval
  4. Return final results with audit trail

This is the object the FastAPI routes talk to.
It wires together BatmanGraph + ExecutorAgent + all services.
"""

from __future__ import annotations

from typing import Any

from backend.agents.batman_graph import BatmanGraph
from backend.agents.decomposer import DecomposerAgent
from backend.agents.executor import ExecutorAgent
from backend.agents.reviewers import ReviewGate
from backend.services.cost_service import CostService
from backend.services.memory_service import MemoryService
from backend.services.tool_service import ToolService


class BatmanSupervisor:
    """
    Batman Mode Supervisor.

    Instantiate once per application; call methods per mission.
    All service dependencies are injected — easy to mock in tests.
    """

    def __init__(
        self,
        tool_service: ToolService | None = None,
        cost_service: CostService | None = None,
        memory_service: MemoryService | None = None,
        decomposer: DecomposerAgent | None = None,
    ) -> None:
        self.tool_service = tool_service or ToolService()
        self.cost_service = cost_service or CostService()
        self.memory_service = memory_service or MemoryService()
        self.decomposer = decomposer or DecomposerAgent()

        self.graph = BatmanGraph(
            tool_service=self.tool_service,
            cost_service=self.cost_service,
            memory_service=self.memory_service,
            decomposer=self.decomposer,
        )
        self.executor = ExecutorAgent(
            tool_service=self.tool_service,
            cost_service=self.cost_service,
            memory_service=self.memory_service,
        )

    # ------------------------------------------------------------------
    # Phase 1: Decompose
    # ------------------------------------------------------------------

    async def decompose_mission(
        self, mission_id: str, objective: str
    ) -> list[dict[str, Any]]:
        """
        Call Claude to decompose the mission objective into tasks.

        Returns list of task dicts (status=pending_approval).
        These are presented to the operator in the approval queue.
        """
        tasks = await self.graph.decompose(mission_id, objective)
        return tasks

    # ------------------------------------------------------------------
    # Phase 2: Execute (after operator approval)
    # ------------------------------------------------------------------

    async def execute_approved_tasks(
        self,
        mission_id: str,
        objective: str,
        all_tasks: list[dict[str, Any]],
        approved_task_ids: list[str],
        mode: str = "batman",
        abac_policy: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Execute tasks that the operator has approved.

        Phase 2: Each task passes through ReviewGate (CodeReviewer +
        MemoryReviewer + SecurityReviewer) before execution. Any blocked
        task is recorded with state="review_blocked" and skipped.

        Returns summary dict with results, total cost, and final status.
        """
        review_gate = ReviewGate()
        results = []
        total_cost = 0.0

        for task_id in approved_task_ids:
            task = next((t for t in all_tasks if t["id"] == task_id), None)
            if not task:
                results.append({
                    "task_id": task_id,
                    "status": "error",
                    "error": "Task not found",
                })
                continue

            # --- Phase 2: review gate (spec Phase 2 §1) ---
            review_results = review_gate.run(task, mode=mode, abac_policy=abac_policy)
            if not ReviewGate.all_passed(review_results):
                blocking = [r for r in review_results if not r.passed]
                block_reasons = "; ".join(
                    f"[{r.reviewer}] {r.reason}" for r in blocking
                )
                results.append({
                    "task_id": task_id,
                    "status": "review_blocked",
                    "review_results": [r.model_dump() for r in review_results],
                    "error": block_reasons,
                    "cost_usd": 0.0,
                })
                continue

            result = await self.executor.execute(
                mission_id=mission_id,
                task=task,
                mode=mode,
                approver_id="operator",
            )
            results.append(result)
            total_cost += result.get("cost_usd", 0.0)

        overall_status = (
            "completed"
            if all(r["status"] == "completed" for r in results)
            else "partial"
        )
        review_blocked_count = sum(
            1 for r in results if r.get("status") == "review_blocked"
        )

        return {
            "mission_id": mission_id,
            "status": overall_status,
            "executed_count": len(results),
            "review_blocked_count": review_blocked_count,
            "results": results,
            "total_cost_usd": round(total_cost, 6),
        }

    # ------------------------------------------------------------------
    # Cost + memory helpers (for cockpit display)
    # ------------------------------------------------------------------

    def get_mission_cost(self, mission_id: str) -> float:
        """Return current total cost for a mission."""
        return self.cost_service.get_mission_total_cost(mission_id)

    def get_mission_memory(self, mission_id: str) -> list[dict[str, Any]]:
        """Return scoped memory entries for a mission."""
        return self.memory_service.list_memory(mission_id)
