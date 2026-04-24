"""
Unit tests for Phase 2 Reviewer Agents.

Spec reference: Phase 2 (review gate)

Covers:
- CodeReviewerAgent: valid task, injection block, empty description block
- MemoryReviewerAgent: clean batman task, cross-mode key block
- SecurityReviewerAgent: allowed tool, unknown tool block, forbidden param block
- ReviewGate: all-pass scenario, single-block scenario
"""

from __future__ import annotations

import pytest

from backend.agents.reviewers import (
    CodeReviewerAgent,
    MemoryReviewerAgent,
    ReviewGate,
    ReviewResult,
    SecurityReviewerAgent,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _task(
    tool: str = "search",
    description: str = "Find relevant documents",
    parameters: dict | None = None,
) -> dict:
    """Return a minimal task dict for reviewer testing."""
    return {
        "id": "t_test0001",
        "description": description,
        "tool": tool,
        "parameters": parameters or {},
    }


# ---------------------------------------------------------------------------
# CodeReviewerAgent
# ---------------------------------------------------------------------------

class TestCodeReviewerAgent:

    def setup_method(self) -> None:
        self.reviewer = CodeReviewerAgent()

    def test_code_reviewer_passes_valid_task(self) -> None:
        task = _task(
            tool="search",
            description="Find relevant documents",
            parameters={"query": "quarterly report"},
        )
        result = self.reviewer.review(task)
        assert isinstance(result, ReviewResult)
        assert result.passed is True
        assert result.reviewer == "code"

    def test_code_reviewer_blocks_injection(self) -> None:
        task = _task(
            tool="search",
            description="Find docs",
            parameters={"query": "report; rm -rf /"},
        )
        result = self.reviewer.review(task)
        assert result.passed is False
        assert result.reviewer == "code"
        assert "injection" in result.reason.lower() or "pattern" in result.reason.lower()

    def test_code_reviewer_blocks_empty_description(self) -> None:
        task = _task(tool="search", description="", parameters={})
        result = self.reviewer.review(task)
        assert result.passed is False
        assert result.reviewer == "code"
        assert "description" in result.reason.lower()

    def test_code_reviewer_blocks_whitespace_only_description(self) -> None:
        task = _task(tool="search", description="   ", parameters={})
        result = self.reviewer.review(task)
        assert result.passed is False
        assert result.reviewer == "code"

    def test_code_reviewer_blocks_unknown_tool(self) -> None:
        task = _task(tool="rm_all_files", description="Delete stuff", parameters={})
        result = self.reviewer.review(task)
        assert result.passed is False
        assert result.reviewer == "code"
        assert "allowed" in result.reason.lower()

    def test_code_reviewer_blocks_double_ampersand_injection(self) -> None:
        task = _task(
            tool="search",
            description="Find docs",
            parameters={"path": "/data && cat /etc/passwd"},
        )
        result = self.reviewer.review(task)
        assert result.passed is False

    def test_code_reviewer_blocks_command_substitution(self) -> None:
        task = _task(
            tool="search",
            description="Find docs",
            parameters={"input": "$(whoami)"},
        )
        result = self.reviewer.review(task)
        assert result.passed is False


# ---------------------------------------------------------------------------
# MemoryReviewerAgent
# ---------------------------------------------------------------------------

class TestMemoryReviewerAgent:

    def setup_method(self) -> None:
        self.reviewer = MemoryReviewerAgent()

    def test_memory_reviewer_passes_batman_task(self) -> None:
        task = _task(
            tool="search",
            description="Retrieve mission notes",
            parameters={"batman_context": "approved", "limit": 10},
        )
        result = self.reviewer.review(task, mode="batman")
        assert result.passed is True
        assert result.reviewer == "memory"

    def test_memory_reviewer_blocks_cross_mode_key(self) -> None:
        task = _task(
            tool="search",
            description="Retrieve session data",
            parameters={"jarvis_session_id": "sess_abc123"},
        )
        result = self.reviewer.review(task, mode="batman")
        assert result.passed is False
        assert result.reviewer == "memory"
        assert "jarvis_session_id" in result.reason

    def test_memory_reviewer_blocks_wakanda_key_in_batman_mode(self) -> None:
        task = _task(
            tool="search",
            description="Retrieve data",
            parameters={"wakanda_scope": "global"},
        )
        result = self.reviewer.review(task, mode="batman")
        assert result.passed is False
        assert result.reviewer == "memory"

    def test_memory_reviewer_passes_clean_jarvis_task(self) -> None:
        task = _task(
            tool="search",
            description="Auto-execute search",
            parameters={"query": "latest reports"},
        )
        result = self.reviewer.review(task, mode="jarvis")
        assert result.passed is True

    def test_memory_reviewer_blocks_batman_key_in_jarvis_mode(self) -> None:
        task = _task(
            tool="search",
            description="Sneaky task",
            parameters={"batman_approval_id": "a_001"},
        )
        result = self.reviewer.review(task, mode="jarvis")
        assert result.passed is False

    def test_memory_reviewer_passes_empty_parameters(self) -> None:
        task = _task(tool="search", description="Simple task", parameters={})
        result = self.reviewer.review(task, mode="batman")
        assert result.passed is True


# ---------------------------------------------------------------------------
# SecurityReviewerAgent
# ---------------------------------------------------------------------------

class TestSecurityReviewerAgent:

    def setup_method(self) -> None:
        self.reviewer = SecurityReviewerAgent()

    def test_security_reviewer_passes_allowed_tool(self) -> None:
        task = _task(tool="search", description="Search docs", parameters={"query": "annual report"})
        result = self.reviewer.review(task)
        assert result.passed is True
        assert result.reviewer == "security"

    def test_security_reviewer_blocks_unknown_tool(self) -> None:
        task = _task(tool="deploy_to_prod", description="Deploy app", parameters={})
        result = self.reviewer.review(task)
        assert result.passed is False
        assert result.reviewer == "security"
        assert "not permitted" in result.reason.lower() or "abac" in result.reason.lower()

    def test_security_reviewer_blocks_forbidden_param(self) -> None:
        task = _task(
            tool="search",
            description="Search with key",
            parameters={"api_key": "sk-12345"},
        )
        result = self.reviewer.review(task)
        assert result.passed is False
        assert result.reviewer == "security"
        assert "api_key" in result.reason

    def test_security_reviewer_blocks_password_param(self) -> None:
        task = _task(
            tool="summarizer",
            description="Summarize",
            parameters={"password": "hunter2"},
        )
        result = self.reviewer.review(task)
        assert result.passed is False

    def test_security_reviewer_blocks_token_param(self) -> None:
        task = _task(
            tool="text_generator",
            description="Generate text",
            parameters={"token": "tok_abc"},
        )
        result = self.reviewer.review(task)
        assert result.passed is False

    def test_security_reviewer_respects_custom_policy(self) -> None:
        custom_policy = {
            "allowed_tools": ["custom_tool"],
            "forbidden_params": ["internal_id"],
        }
        task = _task(tool="custom_tool", description="Custom work", parameters={"safe_key": "val"})
        result = self.reviewer.review(task, abac_policy=custom_policy)
        assert result.passed is True

    def test_security_reviewer_blocks_with_custom_policy(self) -> None:
        custom_policy = {
            "allowed_tools": ["custom_tool"],
            "forbidden_params": ["internal_id"],
        }
        task = _task(
            tool="custom_tool",
            description="Custom work",
            parameters={"internal_id": "x"},
        )
        result = self.reviewer.review(task, abac_policy=custom_policy)
        assert result.passed is False
        assert "internal_id" in result.reason


# ---------------------------------------------------------------------------
# ReviewGate
# ---------------------------------------------------------------------------

class TestReviewGate:

    def setup_method(self) -> None:
        self.gate = ReviewGate()

    def test_review_gate_passes_all_clean(self) -> None:
        task = _task(
            tool="search",
            description="Find documents",
            parameters={"query": "quarterly financials"},
        )
        results = self.gate.run(task, mode="batman")
        assert len(results) == 3
        assert all(r.passed for r in results)
        assert ReviewGate.all_passed(results) is True

    def test_review_gate_fails_on_one_block(self) -> None:
        # Security will block: tool is allowed in code review but NOT in
        # the default ABAC policy (default policy has a narrower allowed_tools set).
        # Use a tool that passes CodeReviewer's broader list but not SecurityReviewer's
        # default ABAC list. "read_file" is in CodeReviewer's list but NOT in the
        # default ABAC allowed_tools.
        task = _task(
            tool="read_file",
            description="Read the config file",
            parameters={"path": "/data/config.json"},
        )
        results = self.gate.run(task, mode="batman")
        assert len(results) == 3
        # At least one reviewer must have blocked
        assert ReviewGate.all_passed(results) is False
        # The security reviewer should be the one that blocked
        security_result = next(r for r in results if r.reviewer == "security")
        assert security_result.passed is False

    def test_review_gate_returns_three_results(self) -> None:
        task = _task(tool="summarizer", description="Summarize doc", parameters={})
        results = self.gate.run(task, mode="batman")
        assert len(results) == 3
        reviewers = {r.reviewer for r in results}
        assert reviewers == {"code", "memory", "security"}

    def test_review_gate_all_passed_helper_false_on_partial(self) -> None:
        results = [
            ReviewResult(passed=True, reason="ok", reviewer="code"),
            ReviewResult(passed=False, reason="blocked", reviewer="memory"),
            ReviewResult(passed=True, reason="ok", reviewer="security"),
        ]
        assert ReviewGate.all_passed(results) is False

    def test_review_gate_all_passed_helper_true_on_all_pass(self) -> None:
        results = [
            ReviewResult(passed=True, reason="ok", reviewer="code"),
            ReviewResult(passed=True, reason="ok", reviewer="memory"),
            ReviewResult(passed=True, reason="ok", reviewer="security"),
        ]
        assert ReviewGate.all_passed(results) is True
