import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CostTrackerWidget } from "./CostTrackerWidget";

describe("CostTrackerWidget", () => {
  it("renders the total cost formatted to 4 decimals", () => {
    render(<CostTrackerWidget totalCost={0.1234} />);
    expect(screen.getByText("$0.1234")).toBeInTheDocument();
  });

  it("shows the COST label", () => {
    render(<CostTrackerWidget totalCost={0} />);
    expect(screen.getByText(/cost/i)).toBeInTheDocument();
  });

  it("does not render breakdown when not provided", () => {
    const { container } = render(<CostTrackerWidget totalCost={0.5} />);
    expect(container.querySelectorAll("[class*='shrink-0']").length).toBe(0);
  });

  it("renders each breakdown entry when provided", () => {
    render(
      <CostTrackerWidget
        totalCost={0.05}
        breakdown={{ "claude-opus-4-5": 0.0421, "tool:search": 0.0079 }}
      />,
    );
    expect(screen.getByText("claude-opus-4-5")).toBeInTheDocument();
    expect(screen.getByText("$0.0421")).toBeInTheDocument();
    expect(screen.getByText("tool:search")).toBeInTheDocument();
    expect(screen.getByText("$0.0079")).toBeInTheDocument();
  });

  it("renders zero cost without crashing", () => {
    render(<CostTrackerWidget totalCost={0} />);
    expect(screen.getByText("$0.0000")).toBeInTheDocument();
  });
});
