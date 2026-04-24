"""
Reviewer Agents — Phase 2 review gate before task execution.

Spec reference: Phase 2 (CodeReviewer + MemoryReviewer + SecurityReviewer)

Three lightweight synchronous reviewers that run in sequence before any
approved task is handed to ExecutorAgent. All reviewers must pass for
a task to proceed. Any reviewer can block.

ReviewGate orchestrates all three and returns the full list of results.
No I/O, no external calls — all checks are pure logic.
"""

from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Result model
# ---------------------------------------------------------------------------

class ReviewResult(BaseModel):
    """Immutable result from a single reviewer."""

    passed: bool
    reason: str
    reviewer: str  # "code" | "memory" | "security"


# ---------------------------------------------------------------------------
# Shell injection patterns checked by CodeReviewer
# ---------------------------------------------------------------------------

_INJECTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r";"),           # command separator
    re.compile(r"&&"),          # AND-chain
    re.compile(r"\|\|"),        # OR-chain
    re.compile(r"\$\("),        # command substitution $( )
    re.compile(r"`"),           # backtick substitution
    re.compile(r"\|\s*\w"),     # pipe to another command
]


def _contains_injection(value: str) -> bool:
    """Return True if *value* contains any shell-injection pattern."""
    return any(pat.search(value) for pat in _INJECTION_PATTERNS)


# ---------------------------------------------------------------------------
# CodeReviewerAgent
# ---------------------------------------------------------------------------

_ALLOWED_TOOLS: frozenset[str] = frozenset(
    [
        "text_generator",
        "scheduler",
        "search",
        "summarizer",
        "read_file",
        "write_file",
        "search_knowledge",
        "web_search",
        "run_query",
        "send_notification",
    ]
)


class CodeReviewerAgent:
    """
    Reviews the structural safety of a task before execution.

    Checks:
    - Tool name is in the allowed list
    - Parameter values don't contain shell injection patterns
    - Description is non-empty
    """

    def review(self, task: dict[str, Any]) -> ReviewResult:
        tool = task.get("tool", "")
        description = task.get("description", "")
        parameters: dict[str, Any] = task.get("parameters", {}) or {}

        # 1. Tool allow-list
        if tool not in _ALLOWED_TOOLS:
            return ReviewResult(
                passed=False,
                reason=f"Tool '{tool}' is not in the allowed tool list.",
                reviewer="code",
            )

        # 2. Injection check on all string parameter values
        for key, val in parameters.items():
            if isinstance(val, str) and _contains_injection(val):
                return ReviewResult(
                    passed=False,
                    reason=(
                        f"Parameter '{key}' contains a potential shell-injection pattern."
                    ),
                    reviewer="code",
                )

        # 3. Non-empty description
        if not description or not description.strip():
            return ReviewResult(
                passed=False,
                reason="Task description must not be empty.",
                reviewer="code",
            )

        return ReviewResult(passed=True, reason="Code review passed.", reviewer="code")


# ---------------------------------------------------------------------------
# MemoryReviewerAgent
# ---------------------------------------------------------------------------

_MODE_FORBIDDEN_KEY_PREFIXES: dict[str, list[str]] = {
    "batman": ["jarvis_", "wakanda_"],
    "jarvis": ["batman_", "wakanda_"],
    "wakanda": ["batman_", "jarvis_"],
}


class MemoryReviewerAgent:
    """
    Checks that a task does not attempt to access memory scopes
    outside its execution mode.

    Batman tasks must not touch jarvis_* or wakanda_* parameter keys,
    and vice-versa for the other modes.
    """

    def review(self, task: dict[str, Any], mode: str) -> ReviewResult:
        parameters: dict[str, Any] = task.get("parameters", {}) or {}
        forbidden_prefixes = _MODE_FORBIDDEN_KEY_PREFIXES.get(mode, [])

        for key in parameters:
            for prefix in forbidden_prefixes:
                if key.startswith(prefix):
                    return ReviewResult(
                        passed=False,
                        reason=(
                            f"Parameter key '{key}' crosses memory scope boundary "
                            f"(forbidden for '{mode}' mode)."
                        ),
                        reviewer="memory",
                    )

        return ReviewResult(
            passed=True,
            reason="Memory scope review passed.",
            reviewer="memory",
        )


# ---------------------------------------------------------------------------
# SecurityReviewerAgent
# ---------------------------------------------------------------------------

_DEFAULT_ABAC_POLICY: dict[str, Any] = {
    "allowed_tools": [
        "text_generator",
        "scheduler",
        "search",
        "summarizer",
    ],
    "forbidden_params": [
        "api_key",
        "secret",
        "password",
        "token",
    ],
}


class SecurityReviewerAgent:
    """
    ABAC-aware security review.

    Checks:
    - Task tool is in the ABAC policy's allowed_tools list
    - Task parameters do not contain any forbidden parameter keys
    """

    def review(
        self,
        task: dict[str, Any],
        abac_policy: dict[str, Any] | None = None,
    ) -> ReviewResult:
        policy = abac_policy if abac_policy is not None else _DEFAULT_ABAC_POLICY
        tool = task.get("tool", "")
        parameters: dict[str, Any] = task.get("parameters", {}) or {}

        allowed_tools: list[str] = policy.get("allowed_tools", [])
        forbidden_params: list[str] = policy.get("forbidden_params", [])

        # 1. Tool must be in allowed list
        if tool not in allowed_tools:
            return ReviewResult(
                passed=False,
                reason=(
                    f"Tool '{tool}' is not permitted by the ABAC policy "
                    f"for this mission mode."
                ),
                reviewer="security",
            )

        # 2. Parameters must not contain forbidden keys
        for key in parameters:
            if key in forbidden_params:
                return ReviewResult(
                    passed=False,
                    reason=(
                        f"Parameter key '{key}' is forbidden by the ABAC security policy."
                    ),
                    reviewer="security",
                )

        return ReviewResult(
            passed=True,
            reason="Security review passed.",
            reviewer="security",
        )


# ---------------------------------------------------------------------------
# ReviewGate — orchestrates all three reviewers
# ---------------------------------------------------------------------------

class ReviewGate:
    """
    Runs all three reviewers and returns the full list of ReviewResult objects.

    A task passes the gate only if every result has passed=True.
    Call .all_passed(results) to check the aggregate outcome.
    """

    def __init__(self) -> None:
        self._code = CodeReviewerAgent()
        self._memory = MemoryReviewerAgent()
        self._security = SecurityReviewerAgent()

    def run(
        self,
        task: dict[str, Any],
        mode: str,
        abac_policy: dict[str, Any] | None = None,
    ) -> list[ReviewResult]:
        """
        Run all three reviewers against *task*.

        Returns a list of all three ReviewResult objects (always length 3).
        The task passes only if all results have passed=True.
        """
        results: list[ReviewResult] = [
            self._code.review(task),
            self._memory.review(task, mode),
            self._security.review(task, abac_policy),
        ]
        return results

    @staticmethod
    def all_passed(results: list[ReviewResult]) -> bool:
        """Return True if every result in *results* has passed=True."""
        return all(r.passed for r in results)
