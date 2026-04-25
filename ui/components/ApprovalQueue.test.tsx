import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApprovalQueue } from "./ApprovalQueue";

const pending = (id: string, name = `Task ${id}`) => ({
  id,
  name,
  description: `${name} description`,
  status: "pending_approval",
});

describe("ApprovalQueue", () => {
  it("shows the empty-state message when no pending tasks", () => {
    render(
      <ApprovalQueue
        missionId="m-1"
        tasks={[]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText(/all tasks approved/i)).toBeInTheDocument();
  });

  it("filters out non-pending tasks from the queue", () => {
    render(
      <ApprovalQueue
        missionId="m-1"
        tasks={[
          pending("t-1"),
          { id: "t-2", name: "Done", description: "d", status: "completed" },
        ]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText(/approval queue \(1 tasks\)/i)).toBeInTheDocument();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
  });

  it("renders one card per pending task", () => {
    render(
      <ApprovalQueue
        missionId="m-1"
        tasks={[pending("t-1", "First"), pending("t-2", "Second")]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("calls onApprove with the task id when Approve is clicked", async () => {
    const onApprove = vi.fn();
    const user = userEvent.setup();
    render(
      <ApprovalQueue
        missionId="m-1"
        tasks={[pending("t-1")]}
        onApprove={onApprove}
        onReject={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^approve$/i }));
    expect(onApprove).toHaveBeenCalledWith("t-1");
  });

  it("requires a rejection reason before confirming", async () => {
    const onReject = vi.fn();
    const user = userEvent.setup();
    render(
      <ApprovalQueue
        missionId="m-1"
        tasks={[pending("t-1")]}
        onApprove={vi.fn()}
        onReject={onReject}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^reject$/i }));
    const confirm = screen.getByRole("button", { name: /confirm rejection/i });
    expect(confirm).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText(/explain why/i),
      "Not aligned with brand",
    );
    expect(confirm).not.toBeDisabled();
    await user.click(confirm);
    expect(onReject).toHaveBeenCalledWith("t-1", "Not aligned with brand");
  });

  it("disables action buttons when isLoading is true", () => {
    render(
      <ApprovalQueue
        missionId="m-1"
        tasks={[pending("t-1")]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        isLoading
      />,
    );
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^reject$/i })).toBeDisabled();
  });
});
