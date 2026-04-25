import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExecutionLog } from "./ExecutionLog";
import type { Task } from "./TaskApprovalCard";

beforeAll(() => {
  // jsdom doesn't implement scrollIntoView; stub it for the auto-scroll effect.
  Element.prototype.scrollIntoView = vi.fn();
});

const task = (overrides: Partial<Task>): Task => ({
  id: "t-x",
  description: "Default desc",
  tool: "noop",
  parameters: {},
  state: "pending",
  ...overrides,
});

describe("ExecutionLog", () => {
  it("shows empty state when no tasks", () => {
    render(<ExecutionLog tasks={[]} />);
    expect(screen.getByText(/awaiting tasks/i)).toBeInTheDocument();
  });

  it("renders one row per task with description + state badge", () => {
    render(
      <ExecutionLog
        tasks={[
          task({ id: "t-1", description: "Build mix", state: "executing" }),
          task({ id: "t-2", description: "Master", state: "complete" }),
        ]}
      />,
    );
    expect(screen.getByText("Build mix")).toBeInTheDocument();
    expect(screen.getByText("executing")).toBeInTheDocument();
    expect(screen.getByText("Master")).toBeInTheDocument();
    expect(screen.getByText("complete")).toBeInTheDocument();
  });

  it("renders cost with 4 decimals when provided", () => {
    render(
      <ExecutionLog
        tasks={[task({ id: "t-1", description: "x", cost: 0.0042 })]}
      />,
    );
    expect(screen.getByText("$0.0042")).toBeInTheDocument();
  });

  it("renders string results as-is", () => {
    render(
      <ExecutionLog
        tasks={[task({ id: "t-1", description: "x", result: "hello world" })]}
      />,
    );
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("serializes object results as JSON", () => {
    render(
      <ExecutionLog
        tasks={[task({ id: "t-1", description: "x", result: { ok: true } })]}
      />,
    );
    expect(screen.getByText(/"ok": true/)).toBeInTheDocument();
  });
});
