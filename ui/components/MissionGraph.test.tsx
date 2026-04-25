import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MissionGraph } from "./MissionGraph";

const t = (id: string, name: string, status: string) => ({ id, name, status });

describe("MissionGraph", () => {
  it("shows empty-state copy when there are no tasks", () => {
    render(<MissionGraph missionId="m-1" tasks={[]} />);
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
  });

  it("renders one row per task with index labels", () => {
    render(
      <MissionGraph
        missionId="m-1"
        tasks={[
          t("a", "First", "pending_approval"),
          t("b", "Second", "approved"),
          t("c", "Third", "completed"),
        ]}
      />,
    );
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Step 2")).toBeInTheDocument();
    expect(screen.getByText("Step 3")).toBeInTheDocument();
  });

  it("converts status to upper-case label", () => {
    render(
      <MissionGraph
        missionId="m-1"
        tasks={[t("a", "First", "pending_approval")]}
      />,
    );
    expect(screen.getByText("PENDING APPROVAL")).toBeInTheDocument();
  });

  it("highlights the current task when provided", () => {
    const { container } = render(
      <MissionGraph
        missionId="m-1"
        tasks={[t("a", "First", "executing")]}
        currentTask="a"
      />,
    );
    const card = container.querySelector(".border-blue-500");
    expect(card).not.toBeNull();
  });
});
