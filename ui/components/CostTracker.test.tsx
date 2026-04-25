import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CostTracker } from "./CostTracker";

describe("CostTracker", () => {
  it("renders total cost with 2 decimals", () => {
    render(<CostTracker missionId="m-1" totalCostUsd={1.234} />);
    expect(screen.getByText("$1.23")).toBeInTheDocument();
  });

  it("does not render budget meter without a costLimit", () => {
    render(<CostTracker missionId="m-1" totalCostUsd={1} />);
    expect(screen.queryByText(/budget remaining/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/of budget used/i)).not.toBeInTheDocument();
  });

  it("renders budget meter and percentage when costLimit is provided", () => {
    render(
      <CostTracker missionId="m-1" totalCostUsd={2.5} costLimitUsd={10} />,
    );
    expect(screen.getByText(/budget remaining/i)).toBeInTheDocument();
    expect(screen.getByText("25% of budget used")).toBeInTheDocument();
  });

  it("flags over-budget state when total > limit", () => {
    render(
      <CostTracker missionId="m-1" totalCostUsd={12} costLimitUsd={10} />,
    );
    expect(screen.getByText(/budget exceeded/i)).toBeInTheDocument();
    expect(screen.getByText("$2.00", { exact: false })).toBeInTheDocument();
  });

  it("renders breakdown rows when provided", () => {
    render(
      <CostTracker
        missionId="m-1"
        totalCostUsd={5}
        breakdownByTool={{ search_knowledge: 1.5, read_file: 3.5 }}
      />,
    );
    expect(screen.getByText("Cost Breakdown")).toBeInTheDocument();
    expect(screen.getByText("search_knowledge")).toBeInTheDocument();
    expect(screen.getByText("read_file")).toBeInTheDocument();
    expect(screen.getByText("$1.50")).toBeInTheDocument();
    expect(screen.getByText("$3.50")).toBeInTheDocument();
  });

  it("hides breakdown section when no entries provided", () => {
    render(<CostTracker missionId="m-1" totalCostUsd={1} />);
    expect(screen.queryByText("Cost Breakdown")).not.toBeInTheDocument();
  });
});
