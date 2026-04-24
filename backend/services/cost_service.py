"""Cost service - token counting and cost estimation."""

from typing import Optional


class CostService:
    """Service for cost estimation and tracking."""

    # Anthropic pricing (as of Phase 1)
    PRICING = {
        "claude-opus": {
            "input_tokens": 0.015 / 1000,      # $0.015 per 1K tokens
            "output_tokens": 0.075 / 1000,     # $0.075 per 1K tokens
        },
        "claude-sonnet": {
            "input_tokens": 0.003 / 1000,      # $0.003 per 1K tokens
            "output_tokens": 0.015 / 1000,     # $0.015 per 1K tokens
        },
        "claude-haiku": {
            "input_tokens": 0.00025 / 1000,    # $0.00025 per 1K tokens
            "output_tokens": 0.00125 / 1000,   # $0.00125 per 1K tokens
        },
    }

    def __init__(self):
        """Initialize cost service."""
        self.model = "claude-haiku"  # Default for MVP
        self.tracked_costs = {}

    def estimate_message_cost(
        self,
        model: Optional[str] = None,
        input_tokens: int = 0,
        output_tokens: int = 0
    ) -> float:
        """
        Estimate cost of LLM message.

        Args:
            model: Model name (claude-opus, claude-sonnet, claude-haiku)
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens

        Returns:
            Cost in USD
        """
        model = model or self.model
        pricing = self.PRICING.get(model)

        if not pricing:
            return 0.0

        input_cost = input_tokens * pricing["input_tokens"]
        output_cost = output_tokens * pricing["output_tokens"]

        return input_cost + output_cost

    def track_cost(self, mission_id: str, cost_usd: float, description: str = "") -> None:
        """Track a cost for a mission."""
        if mission_id not in self.tracked_costs:
            self.tracked_costs[mission_id] = []

        self.tracked_costs[mission_id].append({
            "cost": cost_usd,
            "description": description,
        })

    def get_mission_total_cost(self, mission_id: str) -> float:
        """Get total cost for a mission."""
        costs = self.tracked_costs.get(mission_id, [])
        return sum(c["cost"] for c in costs)

    def check_cost_limit(self, mission_id: str, limit_usd: float) -> tuple[bool, float]:
        """
        Check if mission is within cost limit.

        Returns (within_limit, current_cost).
        """
        current = self.get_mission_total_cost(mission_id)
        return current <= limit_usd, current

    def estimate_task_cost(self, task_name: str, complexity: str = "medium") -> float:
        """
        Rough estimate of task cost based on complexity.

        Args:
            task_name: Task description
            complexity: "simple", "medium", "complex"

        Returns:
            Estimated cost in USD
        """
        # Rough estimates (refined in Phase 2)
        estimates = {
            "simple": 0.05,      # ~200 input + 100 output tokens
            "medium": 0.10,      # ~500 input + 200 output tokens
            "complex": 0.50,     # ~2000 input + 1000 output tokens
        }

        return estimates.get(complexity, 0.10)
