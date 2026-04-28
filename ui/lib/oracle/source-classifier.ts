// Oracle Memory Layer 2 — Source Classifier
// Mock/stub module. Exports typed mock data and functions only.
// No real filesystem mutation. No external service calls.

export type SourceType =
  | "contact" | "email" | "track_stack" | "client_project"
  | "label_release" | "contract" | "transcript" | "research" | "system_log";

export type Domain = "BATMAN" | "WAKANDA" | "JARVIS" | "ORACLE";

export type Stability = "stable" | "dynamic" | "temporary" | "expired";

export type Risk = "low" | "medium" | "high" | "sensitive";

export type Destination = "wiki" | "postgres" | "retrieval" | "opportunity_graph" | "quarantine" | "reject";

export interface SourceClassification {
  sourceType: SourceType;
  domain: Domain;
  stability: Stability;
  risk: Risk;
  freshness: string; // ISO date
  destination: Destination;
}

export const sourceTypeOptions: SourceType[] = [
  "contact", "email", "track_stack", "client_project",
  "label_release", "contract", "transcript", "research", "system_log",
];

export const domainOptions: Domain[] = ["BATMAN", "WAKANDA", "JARVIS", "ORACLE"];

export const riskOptions: Risk[] = ["low", "medium", "high", "sensitive"];

export const destinationOptions: Destination[] = [
  "wiki", "postgres", "retrieval", "opportunity_graph", "quarantine", "reject",
];

export function classifySourceMock(input: string): SourceClassification {
  // Mock classification — returns deterministic result based on input content
  const lower = input.toLowerCase();

  if (lower.includes("contract") || lower.includes("w9")) {
    return { sourceType: "contract", domain: "BATMAN", stability: "stable", risk: "high", freshness: new Date().toISOString(), destination: "wiki" };
  }
  if (lower.includes("demo") || lower.includes("release")) {
    return { sourceType: "label_release", domain: "WAKANDA", stability: "dynamic", risk: "low", freshness: new Date().toISOString(), destination: "postgres" };
  }
  if (lower.includes("client") || lower.includes("proposal")) {
    return { sourceType: "client_project", domain: "JARVIS", stability: "dynamic", risk: "medium", freshness: new Date().toISOString(), destination: "postgres" };
  }
  if (lower.includes("memory") || lower.includes("oracle")) {
    return { sourceType: "research", domain: "ORACLE", stability: "stable", risk: "low", freshness: new Date().toISOString(), destination: "wiki" };
  }

  return { sourceType: "system_log", domain: "ORACLE", stability: "temporary", risk: "low", freshness: new Date().toISOString(), destination: "quarantine" };
}
