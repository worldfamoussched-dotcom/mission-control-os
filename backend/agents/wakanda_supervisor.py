"""Wakanda Supervisor — Phase 3 §9–11.

Mode mapping: Wakanda = ATS / All the Smoke (label, mixed/selective approval).

Wakanda generalizes both Batman and Jarvis: each task is classified as
gated (Batman-style) or pass-through (Jarvis-style) by the GateClassifier.
Pass-through tasks run immediately; gated tasks queue for operator approval.

Conservative defaults locked 2026-04-24 (see docs/SPEC_PHASE3_WAKANDA.md):
  - Default-when-unsure → GATE
  - Reject one task → other pass-through tasks keep running
  - Single operator string, multi-approver deferred
  - High-risk tasks always gate (safety floor cannot be downgraded)

The supervisor reuses BatmanSupervisor's services (ToolService, CostService,
MemoryService, CostAlertService, AuditService) so cost totals and audit
history are consistent across modes for the same mission_id.
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


# ---------------------------------------------------------------------------
# GateClassifier — decides gated vs pass-through per task
# ---------------------------------------------------------------------------


class GateClassifier:
    """Classifies a Wakanda task as gated (needs approval) or pass-through.

    Decision priority (high to low):
      1. SAFETY FLOOR: high risk_level → ALWAYS gate (cannot be overridden)
      2. ABAC always_gate override → gate
      3. ABAC always_pass override → pass (but loses to safety floor at 1)
      4. Manual `requires_approval=True` on the task → gate
      5. Tool's registry `requires_approval=True` → gate
      6. Missing risk_level or unknown tool → gate (conservative default)
      7. Otherwise → pass

    Note: a manual `requires_approval=False` does NOT downgrade the safety
    floor. It is honored only when the task would otherwise be gated by
    the conservative-unknown rule (rule 6).
    """

    def __init__(self, tool_service: ToolService | None = None) -> None:
        self.tool_service = tool_service or ToolService()

    def is_gated(
        self,
        task: dict[str, Any],
        abac_policy: dict[str, Any] | None,
    ) -> bool:
        risk_level = task.get("risk_level")
        tool_name = task.get("suggested_tool") or task.get("tool")
        manual_flag = task.get("requires_approval")

        # Rule 1 — safety floor: high risk always gates
        if risk_level == "high":
            return True

        # Rules 2 + 3 — ABAC overrides
        overrides = (abac_policy or {}).get("wakanda_gate_overrides", {})
        always_gate = overrides.get("always_gate") or []
        always_pass = overrides.get("always_pass") or []

        if tool_name and tool_name in always_gate:
            return True
        if tool_name and tool_name in always_pass:
            return False  # operator explicitly whitelisted this tool

        # Rule 4 — manual override on the task itself
        if manual_flag is True:
            return True

        # Rule 5 — tool registry's requires_approval flag
        tool_def = self.tool_service.get_tool(tool_name) if tool_name else None
        if tool_def and tool_def.requires_approval:
            return True

        # Rule 6 — conservative defaults (unknown tool / missing risk → gate)
        if not tool_def:
            return True
        if risk_level is None:
            return True

        # Rule 7 — pass-through
        return False


# ---------------------------------------------------------------------------
# WakandaSupervisor
# ---------------------------------------------------------------------------


class WakandaSupervisor:
    """Mixed-approval supervisor for Wakanda Mode (ATS / All the Smoke).

    Lifecycle:
      1. run_mission(): decompose → classify → execute pass-through →
         return summary with gated_task_ids list
      2. approve_gated_task(): per-task; on approve runs review→execute,
         on reject marks the task rejected
    """

    MODE = "wakanda"

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
        self.audit_service = audit_service

        self.classifier = GateClassifier(tool_service=self.tool_service)
        self.review_gate = ReviewGate()
        self.executor = ExecutorAgent(
            tool_service=self.tool_service,
            cost_service=self.cost_service,
            memory_service=self.memory_service,
        )

        # Per-mission state. In-memory for MVP; durable persistence is the
        # AuditService for verdicts+alerts. Pending gated tasks live here
        # until approve_gated_task() is called.
        self._gated_tasks: dict[str, dict[str, dict[str, Any]]] = {}
        # mission_id -> {task_id -> task_dict}
        self._abac_policies: dict[str, dict[str, Any] | None] = {}
        self._mission_results: dict[str, list[dict[str, Any]]] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def run_mission(
        self,
        mission_id: str,
        objective: str,
        abac_policy: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Decompose, classify, run pass-through tasks, queue gated tasks.

        Returns a dict with:
          tasks: full task list (with `gated: bool` annotation)
          gated_task_ids: list of task IDs awaiting operator decision
          pass_through_results: list of execution results from auto-run tasks
        """
        tasks = await self.decomposer.run(mission_id=mission_id, objective=objective)

        gated: dict[str, dict[str, Any]] = {}
        pass_through_results: list[dict[str, Any]] = []
        annotated_tasks: list[dict[str, Any]] = []

        for task in tasks:
            gate = self.classifier.is_gated(task, abac_policy=abac_policy)
            annotated = {**task, "gated": gate}
            annotated_tasks.append(annotated)

            if gate:
                gated[task["id"]] = task
            else:
                result = await self._review_and_execute(
                    mission_id, task, abac_policy
                )
                pass_through_results.append(result)

        # Stash for later approve_gated_task calls
        self._gated_tasks[mission_id] = gated
        self._abac_policies[mission_id] = abac_policy
        self._mission_results[mission_id] = list(pass_through_results)

        return {
            "mission_id": mission_id,
            "mode": self.MODE,
            "tasks": annotated_tasks,
            "gated_task_ids": list(gated.keys()),
            "pass_through_results": pass_through_results,
            "total_cost_usd": round(
                sum(r.get("cost_usd", 0.0) for r in pass_through_results), 6
            ),
        }

    async def approve_gated_task(
        self,
        mission_id: str,
        task_id: str,
        approved: bool,
        approver_id: str = "operator",
        reason: str | None = None,
    ) -> dict[str, Any]:
        """Approve or reject a single gated task.

        On approve: runs the same review→execute path as pass-through tasks.
        On reject: returns a rejected status without executing. Other
        pending tasks (gated or pass-through) are unaffected — Wakanda
        does NOT cascade a rejection.
        """
        mission_gated = self._gated_tasks.get(mission_id, {})
        task = mission_gated.get(task_id)
        if task is None:
            return {
                "task_id": task_id,
                "status": "error",
                "error": f"Task {task_id} is not in the gated queue for mission {mission_id}",
                "cost_usd": 0.0,
            }

        # Remove from queue regardless of decision
        mission_gated.pop(task_id, None)

        if not approved:
            rejected_result = {
                "task_id": task_id,
                "task_name": task.get("name"),
                "status": "rejected",
                "error": reason or "Operator rejected task",
                "cost_usd": 0.0,
                "rejected_by": approver_id,
            }
            self._mission_results.setdefault(mission_id, []).append(rejected_result)
            return rejected_result

        # Approved → run review + execute (same path as pass-through)
        result = await self._review_and_execute(
            mission_id, task, self._abac_policies.get(mission_id)
        )
        self._mission_results.setdefault(mission_id, []).append(result)
        return result

    # ------------------------------------------------------------------
    # Cockpit-facing helpers (parity with Batman/Jarvis supervisors)
    # ------------------------------------------------------------------

    def get_mission_cost(self, mission_id: str) -> float:
        return self.cost_service.get_mission_total_cost(mission_id)

    def get_mission_memory(self, mission_id: str) -> list[dict[str, Any]]:
        return self.memory_service.list_memory(mission_id)

    def get_mission_results(self, mission_id: str) -> list[dict[str, Any]]:
        return list(self._mission_results.get(mission_id, []))

    def get_pending_gated_task_ids(self, mission_id: str) -> list[str]:
        return list(self._gated_tasks.get(mission_id, {}).keys())

    # ------------------------------------------------------------------
    # Private — single review + execute loop reused by pass-through and
    # post-approval paths
    # ------------------------------------------------------------------

    async def _review_and_execute(
        self,
        mission_id: str,
        task: dict[str, Any],
        abac_policy: dict[str, Any] | None,
    ) -> dict[str, Any]:
        task_id = task["id"]

        # Normalize suggested_tool -> tool so reviewers (which read `tool`)
        # see it. Same shape used by BatmanGraph._review_tasks_node.
        review_task = {
            "tool": task.get("suggested_tool") or task.get("tool", ""),
            "description": task.get("description", ""),
            "parameters": task.get("parameters", {}) or {},
        }

        # ReviewGate (Phase 2 §6–8)
        review_results = self.review_gate.run(
            review_task, mode=self.MODE, abac_policy=abac_policy
        )
        review_dump = [r.model_dump() for r in review_results]

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
            return {
                "task_id": task_id,
                "task_name": task.get("name"),
                "status": "review_blocked",
                "review_results": review_dump,
                "error": block_reasons,
                "cost_usd": 0.0,
            }

        exec_result = await self.executor.execute(
            mission_id=mission_id,
            task=task,
            mode=self.MODE,
            approver_id="operator",
        )
        exec_result["review_results"] = review_dump

        # Cost alert (Phase 2 §15–17)
        running_total = self.cost_service.get_mission_total_cost(mission_id)
        alert = self.cost_alert_service.check(mission_id, running_total)
        if alert is not None:
            alert_dump = alert.model_dump()
            exec_result.setdefault("cost_alerts", []).append(alert_dump)
            if self.audit_service is not None:
                try:
                    self.audit_service.record_cost_alert(alert_dump)
                except Exception:  # noqa: BLE001
                    pass

        return exec_result
