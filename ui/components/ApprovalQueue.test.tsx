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

// Helpers that match the typed Promise<void> contract — prevents
// "update not wrapped in act(...)" warnings caused by sync vi.fn() returns.
const asyncFn = () => vi.fn().mockResolvedValue(undefined);

describe("ApprovalQueue", () => {
  it("shows the empty-state message when no pending tasks", () => {
    render(
      <ApprovalQueue
        missionId="m-1"
        tasks={[]}
        onApprove={asyncFn()}
        onReject={asyncFn()}
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
        onApprove={asyncFn()}
        onReject={asyncFn()}
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
        onApprove={asyncFn()}
        onReject={asyncFn()}
      />,
    );
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("calls onApprove with the task id when Approve is clicked", async () => {
    const onApprove = asyncFn();
    const user = userEvent.setup();
    render(
      <ApprovalQueue
        missionId="m-1"
        tasks={[pending("t-1")]}
        onApprove={onApprove}
        onReject={asyncFn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^approve$/i }));
    expect(onApprove).toHaveBeenCalledWith("t-1");
  });

  it("requires a rejection reason before confirming", async () => {
    const onReject = asyncFn();
    const user = userEvent.setup();
    render(
      <ApprovalQueue
        missionId="m-1"
        tasks={[pending("t-1")]}
        onApprove={asyncFn()}
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
        onApprove={asyncFn()}
        onReject={asyncFn()}
        isLoading
      />,
    );
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^reject$/i })).toBeDisabled();
  });
});
