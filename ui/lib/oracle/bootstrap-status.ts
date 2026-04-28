// Oracle OS v0.7b — Fractal Bootstrap Status
// Structural filesystem checks to verify Bootstrap v1 is installed.
// No live MCP calls — safe read-only checks only.

export type BootstrapState = "AVAILABLE" | "PARTIAL" | "MISSING" | "NOT_WIRED";

export interface BootstrapStatusResult {
  status: BootstrapState;
  source: "REAL_FS" | "MOCK" | "NOT_WIRED";
  tool: string;
  toolsRegistered: number;
  resource: string;
  wikiPagesFound: number;
  wikiPagesExpected: number;
  claudeRuleInstalled: boolean;
  lastBootstrapTest: "PASS" | "WARN" | "UNKNOWN";
  capsuleSource: string;
  message: string;
  timestamp: string;
}

// Mock version — used when API route is unavailable
export function getBootstrapStatusMock(): BootstrapStatusResult {
  return {
    status: "NOT_WIRED",
    source: "MOCK",
    tool: "bootstrap_context",
    toolsRegistered: 0,
    resource: "memory://bootstrap/fractal",
    wikiPagesFound: 0,
    wikiPagesExpected: 9,
    claudeRuleInstalled: false,
    lastBootstrapTest: "UNKNOWN",
    capsuleSource: "not checked",
    message: "API route not available — showing mock data",
    timestamp: new Date().toISOString(),
  };
}

// Async version — fetches from real API route with mock fallback
export async function fetchBootstrapStatus(): Promise<BootstrapStatusResult> {
  try {
    const res = await fetch("/api/oracle/bootstrap-status", { cache: "no-store" });
    if (!res.ok) return getBootstrapStatusMock();

    const data = await res.json();

    return {
      status: data.status ?? "NOT_WIRED",
      source: (data.source === "REAL_FS" ? "REAL_FS" : "MOCK") as "REAL_FS" | "MOCK",
      tool: data.tool ?? "bootstrap_context",
      toolsRegistered: data.toolsRegistered ?? 0,
      resource: data.resource ?? "memory://bootstrap/fractal",
      wikiPagesFound: data.wikiPagesFound ?? 0,
      wikiPagesExpected: data.wikiPagesExpected ?? 9,
      claudeRuleInstalled: data.claudeRuleInstalled ?? false,
      lastBootstrapTest: data.lastBootstrapTest ?? "UNKNOWN",
      capsuleSource: data.capsuleSource ?? "unknown",
      message: data.message ?? "",
      timestamp: data.timestamp ?? new Date().toISOString(),
    };
  } catch {
    return getBootstrapStatusMock();
  }
}
