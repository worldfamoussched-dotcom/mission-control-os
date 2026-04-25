"""
Decomposer Agent — LangGraph node that calls Claude to break a mission
objective into concrete, approvable sub-tasks.

Spec reference: Phase 1 §3 (Batman mode flow — task decomposition)
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import anthropic


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

DECOMPOSE_SYSTEM_PROMPT = """You are the Batman Mode Decomposer for Mission Control OS.

Your only job is to break a mission objective into a short list of concrete,
executable sub-tasks that a human operator can review and approve one-by-one.

Rules:
- Return ONLY valid JSON — no prose, no markdown, no code fences.
- Each task must be specific and completable in one tool call.
- Maximum 5 tasks per mission. Fewer is better.
- Never include risky tasks (send money, deploy, publish) without flagging them.
- Risk levels: "low" | "medium" | "high"

Output schema (strict):
{
  "tasks": [
    {
      "name": "Short action title (≤60 chars)",
      "description": "What the agent will do and why",
      "suggested_tool": "tool name from registry or null",
      "risk_level": "low | medium | high",
      "requires_approval": true
    }
  ]
}"""


# ---------------------------------------------------------------------------
# DecomposerAgent
# ---------------------------------------------------------------------------

class DecomposerAgent:
    """
    Calls Claude to decompose a mission objective into structured sub-tasks.

    Used as a node inside the Batman Mode LangGraph.
    Instantiate once; call .run() per mission.
    """

    def __init__(
        self,
        model: str = "claude-opus-4-5",
        max_tokens: int = 1024,
        api_key: str | None = None,
    ) -> None:
        # Eager when a key is available (preserves existing test patterns that
        # patch agent._client directly), lazy when not (lets backend boot in
        # demo/no-key environments — health/docs/missions endpoints work
        # without spending real $; only .run() will fail if invoked).
        self._explicit_api_key = api_key
        self._model = model
        self._max_tokens = max_tokens

        resolved = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self._client: anthropic.Anthropic | None = (
            anthropic.Anthropic(api_key=resolved) if resolved else None
        )

    def _get_client(self) -> anthropic.Anthropic:
        if self._client is not None:
            return self._client
        # Re-check env in case it became available after init.
        key = self._explicit_api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set. DecomposerAgent.run() requires a "
                "real key to call Claude; set it in the env or pass api_key= "
                "explicitly."
            )
        self._client = anthropic.Anthropic(api_key=key)
        return self._client

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    async def run(self, mission_id: str, objective: str) -> list[dict[str, Any]]:
        """
        Decompose *objective* into a list of task dicts.

        Returns a list ready to be stored as TaskDefinition records.
        Raises ValueError if Claude returns malformed JSON.
        """
        raw = self._call_claude(objective)
        tasks = self._parse_response(raw)
        return self._stamp_tasks(mission_id, tasks)

    # ------------------------------------------------------------------
    # Private
    # ------------------------------------------------------------------

    def _call_claude(self, objective: str) -> str:
        """Synchronous Anthropic SDK call — wraps in thread for async compat."""
        message = self._get_client().messages.create(
            model=self._model,
            max_tokens=self._max_tokens,
            system=DECOMPOSE_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Mission objective:\n{objective}\n\n"
                        "Decompose this into sub-tasks. Return JSON only."
                    ),
                }
            ],
        )
        return message.content[0].text

    def _parse_response(self, raw: str) -> list[dict[str, Any]]:
        """
        Parse Claude's JSON response.

        Strips stray markdown fences if Claude wraps the JSON anyway.
        Raises ValueError on bad structure.
        """
        # Strip accidental code fences
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(
                line for line in lines
                if not line.startswith("```")
            ).strip()

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"DecomposerAgent: Claude returned invalid JSON.\n"
                f"Raw response:\n{raw}\n\nError: {exc}"
            ) from exc

        if "tasks" not in data or not isinstance(data["tasks"], list):
            raise ValueError(
                f"DecomposerAgent: expected {{'tasks': [...]}} but got: {data}"
            )

        return data["tasks"]

    def _stamp_tasks(
        self, mission_id: str, tasks: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """
        Attach mission_id, unique id, timestamps, and status to each task.

        Returns immutable task dicts ready for service layer storage.
        """
        now = datetime.now(timezone.utc)
        stamped = []
        for task in tasks:
            stamped.append(
                {
                    "id": f"t_{uuid.uuid4().hex[:8]}",
                    "mission_id": mission_id,
                    "name": task.get("name", "Unnamed task"),
                    "description": task.get("description", ""),
                    "suggested_tool": task.get("suggested_tool"),
                    "risk_level": task.get("risk_level", "medium"),
                    "requires_approval": task.get("requires_approval", True),
                    "status": "pending_approval",
                    "created_at": now,
                    "approved_at": None,
                    "executed_at": None,
                }
            )
        return stamped
