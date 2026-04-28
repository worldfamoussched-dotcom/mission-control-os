// Oracle OS v0.7 — Executable Eval Runner
// Fetches real evals from API route, falls back to mock if unavailable.
// Shows REAL / MOCK source per result.
// Integrates Rule Activation Monitor v0.1 for Gate 3 validation.

import { retrievalModes } from "./retrieval-gate";
import { getWikiCompilerStatus } from "./wiki-compiler";
import { getOpportunityGraphMock } from "./opportunity-graph";
import { domainOptions, riskOptions, destinationOptions } from "./source-classifier";
import { getOracleLayerStatus } from "./layer-status";
import { detectRuleActivations, formatRuleActivationOutput, type RuleActivationResult } from "./rule-activation-monitor";

export type EvalStatus = "PASS" | "WARN" | "FAIL" | "NOT_WIRED";

export interface EvalResult {
  id: string;
  name: string;
  status: EvalStatus;
  source: "REAL" | "MOCK";
  lastRun: string;
  message: string;
  suggestedRepair: string | null;
}

export interface EvalSuiteResult {
  results: EvalResult[];
  passed: number;
  total: number;
  source: "REAL" | "MOCK";
  timestamp: string;
  ruleActivation?: RuleActivationResult;
}

// Mock version — validates against TypeScript mock modules (structural check)
export function runOracleEvalsMock(userMessage?: string): EvalSuiteResult {
  const now = new Date().toISOString();
  const results: EvalResult[] = [
    runBootstrapEvalMock(now),
    runRetrievalGateEvalMock(now),
    runWikiCompilerEvalMock(now),
    runOpportunityGraphEvalMock(now),
    runSourceClassifierEvalMock(now),
  ];

  const suite: EvalSuiteResult = {
    results,
    passed: results.filter((r) => r.status === "PASS").length,
    total: results.length,
    source: "MOCK",
    timestamp: now,
  };

  // Gate 3 integration: detect rule activations if user message provided
  if (userMessage) {
    const mock_8d_rules = {
      "Mathematical Structure — Always On": "Surface underlying structure in every response",
      "Rule 1 — Scope Gate": "Is this true regardless of what project Nick is working on?",
      "Rule 2 — Progressive Disclosure": "Load companion files only when relevant",
      "Rule 3 — Corrections Log": "Log drift immediately when detected",
      "Hard Boundaries — No Exceptions": "Never make purchases, disclose IP, or take public actions"
    };

    const gate_3_failed = results.some(r => r.status === "FAIL" && r.id.includes("retrieval"));

    suite.ruleActivation = detectRuleActivations({
      user_message: userMessage,
      active_role: "task",
      rules_8d: mock_8d_rules,
      state_16d: { phase: 1, gate_status: "TESTING" },
      gate_3_failed
    });
  }

  return suite;
}

export function getEvalStatusMock(): EvalSuiteResult {
  return runOracleEvalsMock();
}

// Async version — fetches real filesystem evals from API route
export async function fetchEvalStatus(): Promise<EvalSuiteResult> {
  try {
    const res = await fetch("/api/oracle/evals", { cache: "no-store" });
    if (!res.ok) return runOracleEvalsMock();

    const data = await res.json();

    const results: EvalResult[] = (data.results ?? []).map(
      (ev: { id: string; name: string; status: EvalStatus; source: string; lastRun: string; message: string; suggestedRepair: string | null }) => ({
        id: ev.id,
        name: ev.name,
        status: ev.status,
        source: "REAL" as const,
        lastRun: ev.lastRun,
        message: ev.message,
        suggestedRepair: ev.suggestedRepair,
      })
    );

    return {
      results,
      passed: data.passed ?? results.filter((r) => r.status === "PASS").length,
      total: data.total ?? results.length,
      source: "REAL",
      timestamp: data.timestamp ?? new Date().toISOString(),
    };
  } catch {
    return runOracleEvalsMock();
  }
}

// --- Mock individual evals (structural checks against TS modules) ---

function runBootstrapEvalMock(now: string): EvalResult {
  const layers = getOracleLayerStatus();
  const bootstrapLayer = layers.find((l) => l.number === 9);
  const pass = bootstrapLayer?.status === "OPERATIONAL";

  return {
    id: "bootstrap",
    name: "Bootstrap Layer",
    status: pass ? "PASS" : "FAIL",
    source: "MOCK",
    lastRun: now,
    message: pass
      ? "Bootstrap layer is OPERATIONAL (structural check)"
      : "Bootstrap layer not operational",
    suggestedRepair: pass ? null : "Check docs/fractal-memory-bootstrap.md exists and is valid",
  };
}

function runRetrievalGateEvalMock(now: string): EvalResult {
  const expected = ["NO_RETRIEVAL", "BOOTSTRAP_ONLY", "WIKI_ONLY", "RAG_DYNAMIC", "GRAPH_RELATIONSHIP", "SOURCE_AUDIT"];
  const allPresent = expected.every((mode) => retrievalModes.includes(mode as typeof retrievalModes[number]));

  return {
    id: "retrieval-gate",
    name: "Retrieval Gate",
    status: allPresent ? "PASS" : "FAIL",
    source: "MOCK",
    lastRun: now,
    message: allPresent
      ? `All ${expected.length} retrieval modes defined (structural check)`
      : `Missing modes: ${expected.filter((m) => !retrievalModes.includes(m as typeof retrievalModes[number])).join(", ")}`,
    suggestedRepair: allPresent ? null : "Add missing modes to retrieval-gate.ts",
  };
}

function runWikiCompilerEvalMock(now: string): EvalResult {
  const status = getWikiCompilerStatus();
  const requiredFields = ["sourcesProcessed", "pagesUpdated", "entityPagesCreated", "contradictionsFound", "lastCompile"];
  const hasAll = requiredFields.every((f) => f in status);

  return {
    id: "wiki-compiler",
    name: "Wiki Compiler",
    status: hasAll ? "PASS" : "FAIL",
    source: "MOCK",
    lastRun: now,
    message: hasAll
      ? `Compiler status has all ${requiredFields.length} required fields (structural check)`
      : `Missing fields in compiler status`,
    suggestedRepair: hasAll ? null : "Update wiki-compiler.ts to include all required fields",
  };
}

function runOpportunityGraphEvalMock(now: string): EvalResult {
  const graph = getOpportunityGraphMock();
  const worldNodes = ["ORACLE", "BATMAN", "WAKANDA", "JARVIS"];
  const hasWorlds = worldNodes.every((w) => graph.nodes.some((n) => n.label === w));
  const hasAlert = graph.alerts.some((a) => a.message.toLowerCase().includes("universal"));
  const pass = hasWorlds && hasAlert;

  return {
    id: "opportunity-graph",
    name: "Opportunity Graph",
    status: pass ? "PASS" : "WARN",
    source: "MOCK",
    lastRun: now,
    message: pass
      ? "All world nodes present, Universal cross-domain alert exists (structural check)"
      : `Missing: ${!hasWorlds ? "world nodes" : ""} ${!hasAlert ? "Universal alert" : ""}`.trim(),
    suggestedRepair: pass ? null : "Ensure all 4 world nodes and at least 1 cross-domain alert exist",
  };
}

function runSourceClassifierEvalMock(now: string): EvalResult {
  const expectedDomains = ["BATMAN", "WAKANDA", "JARVIS", "ORACLE"];
  const hasDomains = expectedDomains.every((d) => domainOptions.includes(d as typeof domainOptions[number]));
  const hasRisks = riskOptions.length >= 4;
  const hasDestinations = destinationOptions.length >= 4;
  const pass = hasDomains && hasRisks && hasDestinations;

  return {
    id: "source-classifier",
    name: "Source Classifier",
    status: pass ? "PASS" : "FAIL",
    source: "MOCK",
    lastRun: now,
    message: pass
      ? "Domain options include all 4 worlds, risk and destination options valid (structural check)"
      : "Missing classifier options",
    suggestedRepair: pass ? null : "Update source-classifier.ts with complete option sets",
  };
}
