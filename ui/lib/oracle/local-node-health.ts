// Oracle OS v0.7 — Local Node Health
// Fetches real health from API route, falls back to mock if unavailable.
// UI should show source field to distinguish REAL vs MOCK.

export type ServiceStatus = "HEALTHY" | "DEGRADED" | "OFFLINE" | "NOT_WIRED";

export interface ServiceCheck {
  name: string;
  status: ServiceStatus;
  source: "REAL" | "MOCK";
  detail: string;
}

export interface NodeHealthResult {
  services: ServiceCheck[];
  overall: ServiceStatus;
  source: "REAL" | "MOCK";
  timestamp: string;
}

// Mock version — used when API route is unavailable
export function getLocalNodeHealthMock(): NodeHealthResult {
  const services: ServiceCheck[] = [
    { name: "Ollama", status: "NOT_WIRED", source: "MOCK", detail: "API route not available" },
    { name: "Postgres", status: "NOT_WIRED", source: "MOCK", detail: "API route not available" },
    { name: "Redis", status: "NOT_WIRED", source: "MOCK", detail: "API route not available" },
    { name: "Chroma / pgvector", status: "NOT_WIRED", source: "MOCK", detail: "API route not available" },
    { name: "Claude Code", status: "NOT_WIRED", source: "MOCK", detail: "API route not available" },
    { name: "Codex", status: "NOT_WIRED", source: "MOCK", detail: "API route not available" },
    { name: "Kiro", status: "NOT_WIRED", source: "MOCK", detail: "API route not available" },
    { name: "Oracle Filesystem", status: "NOT_WIRED", source: "MOCK", detail: "API route not available" },
  ];

  return {
    services,
    overall: "NOT_WIRED",
    source: "MOCK",
    timestamp: new Date().toISOString(),
  };
}

// Sync version for SSR / initial render (returns mock)
export function getLocalNodeHealth(): NodeHealthResult {
  return getLocalNodeHealthMock();
}

// Async version — fetches from real API route with mock fallback
export async function fetchLocalNodeHealth(): Promise<NodeHealthResult> {
  try {
    const res = await fetch("/api/oracle/local-health", { cache: "no-store" });
    if (!res.ok) return getLocalNodeHealthMock();

    const data = await res.json();

    // Map API response to our interface
    const services: ServiceCheck[] = (data.services ?? []).map(
      (svc: { name: string; status: ServiceStatus; source: string; detail: string }) => ({
        name: svc.name,
        status: svc.status,
        source: (svc.source === "REAL" ? "REAL" : "MOCK") as "REAL" | "MOCK",
        detail: svc.detail,
      })
    );

    return {
      services,
      overall: data.overall ?? "NOT_WIRED",
      source: "REAL",
      timestamp: data.timestamp ?? new Date().toISOString(),
    };
  } catch {
    return getLocalNodeHealthMock();
  }
}
