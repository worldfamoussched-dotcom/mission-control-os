import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskApprovalCard, type Task } from "./TaskApprovalCard";

const baseTask: Task = {
  id: "t-1",
  description: "Fetch artist analytics",
  tool: "search_knowledge",
  parameters: { artist: "vampire-sex", range: "30d" },
  state: "pending",
  cost: 0.0123,
};

describe("TaskApprovalCard", () => {
  it("renders the task description and tool badge", () => {
    render(
      <TaskApprovalCard task={baseTask} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.getByText("Fetch artist analytics")).toBeInTheDocument();
    expect(screen.getByText("search_knowledge")).toBeInTheDocument();
  });

  it("renders the estimated cost when provided", () => {
    render(
      <TaskApprovalCard task={baseTask} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.getByText("$0.0123")).toBeInTheDocument();
    expect(screen.getByText(/est\. cost/i)).toBeInTheDocument();
  });

  it("hides cost when not provided", () => {
    const noCost: Task = { ...baseTask, cost: undefined };
    render(
      <TaskApprovalCard task={noCost} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.queryByText(/est\. cost/i)).not.toBeInTheDocument();
  });

  it("toggles parameters block when clicked", async () => {
    const user = userEvent.setup();
    render(
      <TaskApprovalCard task={baseTask} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.queryByText(/vampire-sex/)).not.toBeInTheDocument();
    await user.click(screen.getByText(/parameters/i));
    expect(screen.getByText(/vampire-sex/)).toBeInTheDocument();
  });

  it("calls onApprove with task id when Approve is clicked", async () => {
    const onApprove = vi.fn();
    const user = userEvent.setup();
    render(
      <TaskApprovalCard task={baseTask} onApprove={onApprove} onReject={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => expect(onApprove).toHaveBeenCalledWith("t-1"));
  });

  it("calls onReject with task id when Reject is clicked", async () => {
    const onReject = vi.fn();
    const user = userEvent.setup();
    render(
      <TaskApprovalCard task={baseTask} onApprove={vi.fn()} onReject={onReject} />,
    );
    await user.click(screen.getByRole("button", { name: /reject/i }));
    await waitFor(() => expect(onReject).toHaveBeenCalledWith("t-1"));
  });

  it("disables both buttons while approval is in flight", async () => {
    const slowApprove = vi.fn(() => new Promise<void>(() => {})); // never resolves
    render(
      <TaskApprovalCard task={baseTask} onApprove={slowApprove} onReject={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /approving/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /reject/i })).toBeDisabled();
    });
  });
});
