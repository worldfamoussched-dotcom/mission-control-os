"""
Jarvis Supervisor — Phase 3 §9–11.

Mode mapping: Jarvis = Fractal Web Solutions (dev agency, command-execute).
No human approval gate. Single-shot decompose → review → execute → done.

Contract:
  - run_mission(mission_id, objective, abac_policy=None) -> summary dict
  - ReviewGate runs unchanged (security guardrails are mode-independent)
  - Cost alerts fire from CostAlertService with hysteresis
  - AuditService persists every reviewer verdict + cost alert
  - Mode-aware MemoryReviewer enforces 'jarvis' scope (blocks batman_*/wakanda_*)

Sibling to BatmanSupervisor — shares ReviewGate, ExecutorAgent, ToolService,
CostService, MemoryService, CostAlertService, AuditService. The only
difference is no approval lookup and no second roundtrip — the operator
hits POST /missions/run and gets the full execution summary back.
"""

from __future__ import annotations

from typing import Any

from backend.agents.decomposer import DecomposerAgent
from backend.agents.executor import ExecutorAgent
from backend.agents.reviewers import ReviewGate
from backend.services.audit_service import AuditService
from backend.services.cost_alert_service import CostAlertService
from backend.services.cost_service import CostService
from backend.services.memory_service import MemoryService
from backend.services.tool_service import ToolService


class JarvisSupervisor:
    """Single-shot supervisor for Jarvis Mode (no approval gate)."""

    MODE = "jarvis"

    def __init__(
        self,
        tool_service: ToolService | None = None,
        cost_service: CostService | None = None,
        memory_service: MemoryService | None = None,
        decomposer: DecomposerAgent | None = None,
        cost_alert_service: CostAlertService | None = None,
        audit_service: AuditService | None = None,
    ) -> None:
        self.tool_service = tool_service or ToolService()
        self.cost_service = cost_service or CostService()
        self.memory_service = memory_service or MemoryService()
        self.decomposer = decomposer or DecomposerAgent()
        self.cost_alert_service = cost_alert_service or CostAlertService()
        self.audit_service = audit_service  # None = persistence disabled

        self.executor = ExecutorAgent(
            tool_service=self.tool_service,
            cost_service=self.cost_service,
            memory_service=self.memory_service,
        )

    # ------------------------------------------------------------------
    # Public API — single-shot lifecycle
    # ------------------------------------------------------------------

    async def run_mission(
        self,
        mission_id: str,
        objective: str,
        abac_policy: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Decompose, review, execute every task. Return summary in one call."""
        # 1. Decompose via Claude (or mocked decomposer in tests)
        tasks = await self.decomposer.run(
            mission_id=mission_id, objective=objective
        )

        # 2. Review + execute each task synchronously
        review_gate = ReviewGate()
        results: list[dict[str, Any]] = []
        cost_alerts: list[dict[str, Any]] = []
        total_cost = 0.0

        for task in tasks:
            task_id = task["id"]

            # --- Review gate (Phase 2 §6–8) ---
            review_results = review_gate.run(
                task, mode=self.MODE, abac_policy=abac_policy
            )
            review_dump = [r.model_dump() for r in review_results]

            # Persist verdicts (best-effort)
            if self.audit_service is not None:
                try:
                    self.audit_service.record_review_results(
                        mission_id, task_id, review_dump
                    )
                except Exception:  # noqa: BLE001
                    pass

            if not ReviewGate.all_passed(review_results):
                blocking = [r for r in review_results if not r.passed]
                block_reasons = "; ".join(
                    f"[{r.reviewer}] {r.reason}" for r in blocking
                )
                results.append({
                    "task_id": task_id,
                    "task_name": task.get("name"),
                    "status": "review_blocked",
                    "review_results": review_dump,
                    "error": block_reasons,
                    "cost_usd": 0.0,
                })
                continue

            # --- Execute (Phase 1 §5) ---
            exec_result = await self.executor.execute(
                mission_id=mission_id,
                task=task,
                mode=self.MODE,
                approver_id="jarvis_auto",  # no human approval, system actor
            )
            exec_result["review_results"] = review_dump
            results.append(exec_result)
            total_cost += exec_result.get("cost_usd", 0.0)

            # --- Cost alerting (Phase 2 §15–17) ---
            alert = self.cost_alert_service.check(mission_id, total_cost)
            if alert is not None:
                alert_dump = alert.model_dump()
                cost_alerts.append(alert_dump)
                if self.audit_service is not None:
                    try:
                        self.audit_service.record_cost_alert(alert_dump)
                    except Exception:  # noqa: BLE001
                        pass

        # 3. Compute overall status
        # - "completed": every task ran to completion
        # - "partial":   at least one task completed and at least one was
        #                blocked-by-review or otherwise non-completed
        # - "failed":    no task completed (all blocked or errored)
        # - "completed" also covers the empty-task edge case
        if not results:
            overall_status = "completed"
        elif all(r["status"] == "completed" for r in results):
            overall_status = "completed"
        elif any(r["status"] == "completed" for r in results):
            overall_status = "partial"
        else:
            overall_status = "failed"

        review_blocked_count = sum(
            1 for r in results if r.get("status") == "review_blocked"
        )

        return {
            "mission_id": mission_id,
            "mode": self.MODE,
            "status": overall_status,
            "executed_count": len(results),
            "review_blocked_count": review_blocked_count,
            "results": results,
            "total_cost_usd": round(total_cost, 6),
            "cost_alerts": cost_alerts,
        }

    # ------------------------------------------------------------------
    # Cost + memory helpers (parity with BatmanSupervisor for the cockpit)
    # ------------------------------------------------------------------

    def get_mission_cost(self, mission_id: str) -> float:
        return self.cost_service.get_mission_total_cost(mission_id)

    def get_mission_memory(self, mission_id: str) -> list[dict[str, Any]]:
        return self.memory_service.list_memory(mission_id)
