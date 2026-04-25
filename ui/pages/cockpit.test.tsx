import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Cockpit from "./cockpit";

// ---------------------------------------------------------------------------
// fetch mocking helpers
// ---------------------------------------------------------------------------

type Handler = (url: string, init: RequestInit | undefined) => unknown;

interface Route {
  method: string;
  match: RegExp;
  handler: Handler;
}

let routes: Route[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fetchSpy: any;

function route(method: string, match: RegExp, handler: Handler) {
  routes.push({ method, match, handler });
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function errorResponse(detail: string, status = 400): Response {
  return {
    ok: false,
    status,
    json: async () => ({ detail }),
  } as unknown as Response;
}

function isMockResponse(x: unknown): x is Response {
  return (
    typeof x === "object" &&
    x !== null &&
    "ok" in x &&
    "json" in x &&
    typeof (x as { json: unknown }).json === "function"
  );
}

beforeEach(() => {
  routes = [];
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    const method = (init?.method ?? "GET").toUpperCase();
    for (const r of routes) {
      if (r.method === method && r.match.test(url)) {
        const body = r.handler(url, init);
        if (isMockResponse(body)) return body;
        return jsonResponse(body);
      }
    }
    // Default: empty 200 for any cost/results/alerts polling endpoint
    if (/\/(cost|results|alerts)$/.test(url)) {
      return jsonResponse({ total_cost: 0, results: [], alerts: [] });
    }
    return jsonResponse({});
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Tests — header + brand picker
// ---------------------------------------------------------------------------

describe("Cockpit — brand picker", () => {
  it("defaults to Batman (VS / LX) on first render", () => {
    render(<Cockpit />);
    expect(
      screen.getByText(/vampire sex \/ london x/i),
    ).toBeInTheDocument();
  });

  it("renders all three brand chips", () => {
    render(<Cockpit />);
    expect(screen.getByRole("button", { name: /vs \/ lx/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^fractal$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^ats$/i })).toBeInTheDocument();
  });

  it("switches brand when a different chip is clicked", async () => {
    const user = userEvent.setup();
    render(<Cockpit />);

    await user.click(screen.getByRole("button", { name: /^fractal$/i }));

    expect(screen.getByText(/fractal web solutions/i)).toBeInTheDocument();
    expect(
      screen.getByText(/command-execute\. tasks run immediately/i),
    ).toBeInTheDocument();
  });

  it("does not render the approval queue before any mission has launched", () => {
    render(<Cockpit />);
    // Approval/Gated queue headings only appear once a Batman or Wakanda mission is active
    expect(screen.queryByText(/^approval queue$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^gated queue$/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — Launch flows per mode
// ---------------------------------------------------------------------------

describe("Cockpit — launch (Batman)", () => {
  it("creates a mission and surfaces decomposed tasks in the approval queue", async () => {
    const user = userEvent.setup();

    route("POST", /\/missions$/, () => ({
      id: "m-bat-1",
      mode: "batman",
      state: "awaiting_approval",
      tasks: [
        {
          id: "t-1",
          description: "Post the new track to IG",
          tool: "social.post",
          parameters: { caption: "out now" },
          cost: 0.0123,
        },
      ],
    }));

    render(<Cockpit />);

    const textarea = screen.getByPlaceholderText(/enter mission objective/i);
    await user.type(textarea, "Promote new release");
    await user.click(screen.getByRole("button", { name: /^launch$/i }));

    await waitFor(() => {
      expect(screen.getByText(/post the new track to ig/i)).toBeInTheDocument();
    });
    expect(screen.getByText("social.post")).toBeInTheDocument();
    expect(screen.getByText("Approval Queue")).toBeInTheDocument();
    expect(screen.getByText(/waiting on you — 1 to review/i)).toBeInTheDocument();
  });

  it("disables the launch button when objective is empty", () => {
    render(<Cockpit />);
    const launchBtn = screen.getByRole("button", { name: /^launch$/i });
    expect(launchBtn).toBeDisabled();
  });

  it("surfaces submit error when /missions returns an error", async () => {
    const user = userEvent.setup();

    route("POST", /\/missions$/, () =>
      errorResponse("Decomposition failed", 500),
    );

    render(<Cockpit />);
    await user.type(
      screen.getByPlaceholderText(/enter mission objective/i),
      "Anything",
    );
    await user.click(screen.getByRole("button", { name: /^launch$/i }));

    await waitFor(() => {
      expect(screen.getByText(/decomposition failed/i)).toBeInTheDocument();
    });
  });
});

describe("Cockpit — launch (Jarvis)", () => {
  it("fires /run immediately and shows results without an approval queue", async () => {
    const user = userEvent.setup();

    route("POST", /\/missions$/, () => ({
      id: "m-jarv-1",
      mode: "jarvis",
      state: "executing",
    }));

    const jarvisResults = [
      {
        task_id: "t-1",
        task_name: "Deploy landing page",
        status: "completed",
        cost_usd: 0.045,
      },
    ];

    route("POST", /\/missions\/m-jarv-1\/run$/, () => ({
      mission_id: "m-jarv-1",
      mode: "jarvis",
      status: "completed",
      results: jarvisResults,
      total_cost_usd: 0.045,
      cost_alerts: [],
    }));

    // Polling endpoint must echo the same results so the assertion is stable
    route("GET", /\/missions\/m-jarv-1\/results$/, () => ({
      mission_id: "m-jarv-1",
      results: jarvisResults,
      total_cost_usd: 0.045,
    }));

    render(<Cockpit />);

    await user.click(screen.getByRole("button", { name: /^fractal$/i }));
    await user.type(
      screen.getByPlaceholderText(/enter mission objective/i),
      "Build client site",
    );
    await user.click(screen.getByRole("button", { name: /^launch$/i }));

    await waitFor(() => {
      expect(screen.getByText(/deploy landing page/i)).toBeInTheDocument();
    });

    // Approval queue must NOT be rendered for Jarvis
    expect(screen.queryByText("Approval Queue")).not.toBeInTheDocument();
    expect(screen.queryByText("Gated Queue")).not.toBeInTheDocument();
  });
});

describe("Cockpit — launch (Wakanda)", () => {
  it("renders gated queue and pass-through results separately", async () => {
    const user = userEvent.setup();

    route("POST", /\/missions$/, () => ({
      id: "m-wak-1",
      mode: "wakanda",
      state: "executing",
    }));

    const wakandaPassThrough = [
      {
        task_id: "t-internal",
        task_name: "Internal A&R notes",
        status: "completed",
        cost_usd: 0.01,
      },
    ];

    route("POST", /\/missions\/m-wak-1\/run-wakanda$/, () => ({
      mission_id: "m-wak-1",
      mode: "wakanda",
      tasks: [
        { id: "t-internal", description: "Internal A&R notes" },
        { id: "t-public", description: "Announce release on IG" },
      ],
      gated_task_ids: ["t-public"],
      pass_through_results: wakandaPassThrough,
      total_cost_usd: 0.01,
    }));

    route("GET", /\/missions\/m-wak-1\/results$/, () => ({
      mission_id: "m-wak-1",
      results: wakandaPassThrough,
      total_cost_usd: 0.01,
    }));

    render(<Cockpit />);

    await user.click(screen.getByRole("button", { name: /^ats$/i }));
    await user.type(
      screen.getByPlaceholderText(/enter mission objective/i),
      "ATS release week",
    );
    await user.click(screen.getByRole("button", { name: /^launch$/i }));

    await waitFor(() => {
      expect(screen.getByText("Gated Queue")).toBeInTheDocument();
    });

    // Gated task in queue
    expect(screen.getByText(/announce release on ig/i)).toBeInTheDocument();
    // Pass-through completed task in execution log area
    expect(screen.getByText(/internal a&r notes/i)).toBeInTheDocument();
  });

  it("hides the gated queue when no tasks are gated (all pass-through)", async () => {
    const user = userEvent.setup();

    route("POST", /\/missions$/, () => ({
      id: "m-wak-2",
      mode: "wakanda",
      state: "executing",
    }));

    route("POST", /\/missions\/m-wak-2\/run-wakanda$/, () => ({
      mission_id: "m-wak-2",
      mode: "wakanda",
      tasks: [{ id: "t-1", description: "Internal task" }],
      gated_task_ids: [],
      pass_through_results: [
        { task_id: "t-1", task_name: "Internal task", status: "completed" },
      ],
      total_cost_usd: 0,
    }));

    render(<Cockpit />);

    await user.click(screen.getByRole("button", { name: /^ats$/i }));
    await user.type(
      screen.getByPlaceholderText(/enter mission objective/i),
      "Internal-only run",
    );
    await user.click(screen.getByRole("button", { name: /^launch$/i }));

    await waitFor(() => {
      // Status text shows Done when nothing gated and results came back
      expect(screen.getByText(/^done$/i)).toBeInTheDocument();
    });

    expect(screen.queryByText("Gated Queue")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — Approval flows
// ---------------------------------------------------------------------------

describe("Cockpit — Batman approval flow", () => {
  it("calls /tasks/{id}/approve and /execute only when queue is empty", async () => {
    const user = userEvent.setup();

    route("POST", /\/missions$/, () => ({
      id: "m-1",
      mode: "batman",
      state: "awaiting_approval",
      tasks: [
        { id: "t-1", description: "First" },
        { id: "t-2", description: "Second" },
      ],
    }));

    const approveCalls: string[] = [];
    let executeCalled = 0;
    route("POST", /\/missions\/m-1\/tasks\/.+\/approve$/, (url) => {
      approveCalls.push(url);
      return {};
    });
    route("POST", /\/missions\/m-1\/execute$/, () => {
      executeCalled += 1;
      return {};
    });

    render(<Cockpit />);
    await user.type(
      screen.getByPlaceholderText(/enter mission objective/i),
      "go",
    );
    await user.click(screen.getByRole("button", { name: /^launch$/i }));

    await waitFor(() =>
      expect(screen.getByText(/first/i)).toBeInTheDocument(),
    );

    // Approve first — queue still has one task → /execute NOT called yet
    const approveButtons = screen.getAllByRole("button", { name: /^approve$/i });
    await user.click(approveButtons[0]);

    await waitFor(() =>
      expect(approveCalls.length).toBeGreaterThanOrEqual(1),
    );
    expect(executeCalled).toBe(0);

    // Approve second — queue empties → /execute IS called
    const remainingApprove = await screen.findByRole("button", {
      name: /^approve$/i,
    });
    await user.click(remainingApprove);

    await waitFor(() => expect(executeCalled).toBe(1));
  });

  it("calls /tasks/{id}/approve with approved=false when rejecting", async () => {
    const user = userEvent.setup();

    route("POST", /\/missions$/, () => ({
      id: "m-r",
      mode: "batman",
      state: "awaiting_approval",
      tasks: [{ id: "t-1", description: "Risky" }],
    }));

    let captured: { approved?: boolean; reason?: string } | null = null;
    route("POST", /\/missions\/m-r\/tasks\/t-1\/approve$/, (_, init) => {
      captured = JSON.parse((init?.body as string) ?? "{}");
      return {};
    });

    render(<Cockpit />);
    await user.type(
      screen.getByPlaceholderText(/enter mission objective/i),
      "go",
    );
    await user.click(screen.getByRole("button", { name: /^launch$/i }));

    await waitFor(() =>
      expect(screen.getByText(/risky/i)).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /^reject$/i }));

    await waitFor(() => expect(captured).not.toBeNull());
    expect(captured!.approved).toBe(false);
    expect(captured!.reason).toMatch(/operator rejected/i);
  });
});

describe("Cockpit — Wakanda approval flow", () => {
  it("uses the /wakanda/tasks/{id}/approve endpoint and never calls /execute", async () => {
    const user = userEvent.setup();

    route("POST", /\/missions$/, () => ({
      id: "m-w",
      mode: "wakanda",
      state: "executing",
    }));

    route("POST", /\/missions\/m-w\/run-wakanda$/, () => ({
      mission_id: "m-w",
      mode: "wakanda",
      tasks: [{ id: "t-gate", description: "Gated post" }],
      gated_task_ids: ["t-gate"],
      pass_through_results: [],
      total_cost_usd: 0,
    }));

    let wakandaApprove = 0;
    let executeCalled = 0;
    route("POST", /\/missions\/m-w\/wakanda\/tasks\/t-gate\/approve$/, () => {
      wakandaApprove += 1;
      return {};
    });
    route("POST", /\/missions\/m-w\/execute$/, () => {
      executeCalled += 1;
      return {};
    });

    render(<Cockpit />);
    await user.click(screen.getByRole("button", { name: /^ats$/i }));
    await user.type(
      screen.getByPlaceholderText(/enter mission objective/i),
      "wakanda go",
    );
    await user.click(screen.getByRole("button", { name: /^launch$/i }));

    await waitFor(() =>
      expect(screen.getByText(/gated post/i)).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() => expect(wakandaApprove).toBe(1));
    expect(executeCalled).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — Polling cadence
// ---------------------------------------------------------------------------

describe("Cockpit — polling", () => {
  it("does an initial cost/results/alerts fetch when a mission becomes active", async () => {
    const user = userEvent.setup();

    route("POST", /\/missions$/, () => ({
      id: "m-poll",
      mode: "batman",
      state: "awaiting_approval",
      tasks: [{ id: "t-1", description: "x" }],
    }));

    let costCalls = 0;
    let resultsCalls = 0;
    let alertsCalls = 0;
    route("GET", /\/missions\/m-poll\/cost$/, () => {
      costCalls += 1;
      return { total_cost_usd: 0 };
    });
    route("GET", /\/missions\/m-poll\/results$/, () => {
      resultsCalls += 1;
      return { mission_id: "m-poll", results: [], total_cost_usd: 0 };
    });
    route("GET", /\/missions\/m-poll\/alerts$/, () => {
      alertsCalls += 1;
      return { mission_id: "m-poll", alerts: [] };
    });

    render(<Cockpit />);
    await user.type(
      screen.getByPlaceholderText(/enter mission objective/i),
      "poll",
    );
    await user.click(screen.getByRole("button", { name: /^launch$/i }));

    await waitFor(() => {
      expect(costCalls).toBeGreaterThanOrEqual(1);
      expect(resultsCalls).toBeGreaterThanOrEqual(1);
      expect(alertsCalls).toBeGreaterThanOrEqual(1);
    });
  });
});
