"""
Batman Mode LangGraph — state machine for the approval-gated execution workflow.

Spec reference: Phase 1 §3–5 (Batman mode flow)

Flow:
  decompose → await_approval → [interrupt: human approves tasks] →
  execute_task (loop) → check_iteration → complete | error
"""

from __future__ import annotations

import copy
from typing import Any, List, Optional, TypedDict

from langgraph.graph import StateGraph, END

from backend.agents.decomposer import DecomposerAgent
from backend.services.cost_service import CostService
from backend.services.memory_service import MemoryService
from backend.services.tool_service import ToolService


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

class BatmanState(TypedDict):
    """Immutable-style state carried through the Batman Mode LangGraph."""
    mission_id: str
    objective: str
    state: str                     # starting | decomposed | awaiting_approval | executing | completed | failed
    tasks: List[dict]              # full task dicts from DecomposerAgent
    approved_task_ids: List[str]   # task IDs approved by operator
    execution_results: List[dict]
    mission_error: Optional[str]   # renamed from 'error' — LangGraph reserves that key
    iteration_count: int
    cost_usd: float


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------

MAX_ITERATIONS = 10   # hard ceiling — prevents runaway loops (spec §10)


class BatmanGraph:
    """
    LangGraph StateGraph for Batman Mode missions.

    Inject services at construction time; call .decompose() to start a mission,
    then .execute_approved() once the operator has approved tasks via the API.
    """

    def __init__(
        self,
        tool_service: ToolService,
        cost_service: CostService,
        memory_service: MemoryService,
        decomposer: Optional[DecomposerAgent] = None,
    ) -> None:
        self.tool_service = tool_service
        self.cost_service = cost_service
        self.memory_service = memory_service
        self.decomposer = decomposer or DecomposerAgent()
        self._graph = self._build_graph()

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    async def decompose(self, mission_id: str, objective: str) -> List[dict]:
        """
        Run the decompose node only.

        Returns the list of tasks (still awaiting approval).
        Used by the API to populate the approval queue.
        """
        initial: BatmanState = {
            "mission_id": mission_id,
            "objective": objective,
            "state": "starting",
            "tasks": [],
            "approved_task_ids": [],
            "execution_results": [],
            "mission_error": None,
            "iteration_count": 0,
            "cost_usd": 0.0,
        }
        # Run only the decompose node — graph pauses at await_approval
        result = await self._run_to_approval(initial)
        return result["tasks"]

    async def execute_approved(
        self, mission_id: str, objective: str, tasks: List[dict], approved_task_ids: List[str]
    ) -> BatmanState:
        """
        Resume execution after human approval.

        Returns final BatmanState with results and cost.
        """
        state: BatmanState = {
            "mission_id": mission_id,
            "objective": objective,
            "state": "awaiting_approval",
            "tasks": tasks,
            "approved_task_ids": list(approved_task_ids),
            "execution_results": [],
            "mission_error": None,
            "iteration_count": 0,
            "cost_usd": 0.0,
        }
        final = await self._graph.ainvoke(state)
        return final  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # Internal: partial run (decompose only)
    # ------------------------------------------------------------------

    async def _run_to_approval(self, state: BatmanState) -> BatmanState:
        """Run decompose node and return; do not proceed to execution."""
        updated = await self._decompose_node(state)
        updated = await self._await_approval_node(updated)
        return updated

    # ------------------------------------------------------------------
    # Graph construction
    # ------------------------------------------------------------------

    def _build_graph(self) -> Any:
        """Build and compile the LangGraph StateGraph."""
        graph: StateGraph = StateGraph(BatmanState)

        graph.add_node("decompose", self._decompose_node)
        graph.add_node("await_approval", self._await_approval_node)
        graph.add_node("execute_task", self._execute_task_node)
        graph.add_node("check_iteration", self._check_iteration_node)
        graph.add_node("complete", self._complete_node)
        graph.add_node("error", self._error_node)

        graph.set_entry_point("decompose")
        graph.add_edge("decompose", "await_approval")
        graph.add_conditional_edges(
            "await_approval",
            self._should_execute,
            {"execute": "execute_task", "error": "error"},
        )
        graph.add_edge("execute_task", "check_iteration")
        graph.add_conditional_edges(
            "check_iteration",
            self._should_continue,
            {"continue": "execute_task", "complete": "complete", "error": "error"},
        )
        # Terminal nodes must connect to END
        graph.add_edge("complete", END)
        graph.add_edge("error", END)

        return graph.compile()

    # ------------------------------------------------------------------
    # Nodes — all return new state dicts (immutable pattern)
    # ------------------------------------------------------------------

    async def _decompose_node(self, state: BatmanState) -> BatmanState:
        """Call DecomposerAgent → real Claude call → structured task list."""
        new_state = copy.copy(state)
        try:
            tasks = await self.decomposer.run(
                mission_id=state["mission_id"],
                objective=state["objective"],
            )
            new_state["tasks"] = tasks
            new_state["state"] = "decomposed"

            # Track decomposition cost (estimated — real token count in Phase 2)
            est_cost = self.cost_service.estimate_message_cost(
                model="claude-opus-4-5",
                input_tokens=400,
                output_tokens=300,
            )
            self.cost_service.track_cost(
                state["mission_id"], est_cost, "decompose: Claude API call"
            )
            new_state["cost_usd"] = state["cost_usd"] + est_cost

        except Exception as exc:  # noqa: BLE001
            new_state["state"] = "failed"
            new_state["mission_error"] = f"Decomposition failed: {exc}"

        return new_state

    async def _await_approval_node(self, state: BatmanState) -> BatmanState:
        """
        Mark mission as awaiting operator approval.

        In Batman Mode the graph pauses here — execution continues only
        after approved_task_ids are injected via execute_approved().
        """
        new_state = copy.copy(state)
        new_state["state"] = "awaiting_approval"
        return new_state

    def _should_execute(self, state: BatmanState) -> str:
        """Route: proceed to execution if approved tasks exist, else error."""
        if state.get("mission_error"):
            return "error"
        if state.get("approved_task_ids"):
            return "execute"
        return "error"

    async def _execute_task_node(self, state: BatmanState) -> BatmanState:
        """
        Execute the next approved task via ToolWrapper.

        Returns new state — never mutates existing state (immutability rule).
        """
        new_state = copy.copy(state)
        new_state["approved_task_ids"] = list(state["approved_task_ids"])
        new_state["execution_results"] = list(state["execution_results"])

        if not new_state["approved_task_ids"]:
            return new_state

        task_id = new_state["approved_task_ids"].pop(0)

        # Find full task definition
        task = next(
            (t for t in state["tasks"] if t["id"] == task_id), None
        )
        if not task:
            new_state["mission_error"] = f"Task {task_id} not found in mission tasks"
            return new_state

        tool_name = task.get("suggested_tool") or "search_knowledge"

        # Permission check (ABAC — spec §6)
        allowed, reason = self.tool_service.can_execute(
            tool_name=tool_name,
            mode="batman",
            mission_id=state["mission_id"],
            approver_id="operator",   # approved tasks carry implicit operator approval
        )

        if not allowed:
            result = {
                "task_id": task_id,
                "task_name": task["name"],
                "status": "blocked",
                "output": None,
                "error": f"Tool blocked: {reason}",
            }
        else:
            # MVP: mock execution — real tool invocation in Phase 2
            tool_cost = self.tool_service.get_cost(tool_name)
            self.cost_service.track_cost(
                state["mission_id"], tool_cost, f"tool: {tool_name}"
            )

            # Store result in mission-scoped memory
            self.memory_service.store(
                state["mission_id"],
                f"task_{task_id}_result",
                {"task": task["name"], "tool": tool_name},
                visibility="task",
            )

            result = {
                "task_id": task_id,
                "task_name": task["name"],
                "status": "completed",
                "output": f"Executed '{task['name']}' via {tool_name}",
                "error": None,
                "cost_usd": tool_cost,
            }
            new_state["cost_usd"] = state["cost_usd"] + tool_cost

        new_state["execution_results"].append(result)
        new_state["iteration_count"] = state["iteration_count"] + 1
        new_state["state"] = "executing"

        return new_state

    def _check_iteration(self, state: BatmanState) -> str:
        """Internal helper — not a node, used by _should_continue."""
        if state.get("mission_error"):
            return "error"
        if state["iteration_count"] >= MAX_ITERATIONS:
            return "error"
        if state.get("approved_task_ids"):
            return "continue"
        return "complete"

    def _should_continue(self, state: BatmanState) -> str:
        """Route after each task execution."""
        return self._check_iteration(state)

    async def _check_iteration_node(self, state: BatmanState) -> BatmanState:
        """No-op node — routing is handled by _should_continue edge."""
        return copy.copy(state)

    async def _complete_node(self, state: BatmanState) -> BatmanState:
        """Mark mission complete."""
        new_state = copy.copy(state)
        new_state["state"] = "completed"
        return new_state

    async def _error_node(self, state: BatmanState) -> BatmanState:
        """Mark mission failed."""
        new_state = copy.copy(state)
        new_state["state"] = "failed"
        if not new_state.get("mission_error"):
            new_state["mission_error"] = "Max iterations reached or unknown error"
        return new_state
