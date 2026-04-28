// Oracle OS v0.7 — Real Filesystem Evals API Route
// Read-only structural checks against ~/.claude/oracle-memory/
// No writes. No credentials. No external APIs.

import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";

type EvalStatus = "PASS" | "WARN" | "FAIL";

interface EvalResult {
  id: string;
  name: string;
  status: EvalStatus;
  source: "REAL";
  lastRun: string;
  message: string;
  suggestedRepair: string | null;
}

interface EvalSuiteResult {
  results: EvalResult[];
  passed: number;
  warned: number;
  failed: number;
  total: number;
  timestamp: string;
}

function fileExists(path: string): boolean {
  return existsSync(path);
}

function fileContains(path: string, text: string): boolean {
  try {
    const content = readFileSync(path, "utf-8");
    return content.includes(text);
  } catch {
    return false;
  }
}

function dirHasFiles(path: string): boolean {
  try {
    const { readdirSync } = require("fs");
    const files = readdirSync(path);
    return files.length > 0;
  } catch {
    return false;
  }
}

export async function GET() {
  const home = homedir();
  const om = `${home}/.claude/oracle-memory`;
  const now = new Date().toISOString();

  const results: EvalResult[] = [
    runBootstrapEval(home, om, now),
    runRetrievalGateEval(om, now),
    runWikiCompilerEval(home, om, now),
    runOpportunityGraphEval(om, now),
    runSourceClassifierEval(om, now),
  ];

  const passed = results.filter((r) => r.status === "PASS").length;
  const warned = results.filter((r) => r.status === "WARN").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  return NextResponse.json({
    results,
    passed,
    warned,
    failed,
    total: results.length,
    timestamp: now,
  } satisfies EvalSuiteResult);
}

// --- Individual evals (real filesystem checks) ---

function runBootstrapEval(home: string, om: string, now: string): EvalResult {
  // Check: bootstrap.eval.md exists + bootstrap layer file exists
  const evalFile = `${om}/evals/bootstrap.eval.md`;
  const bootstrapFile = `${home}/.claude/oracle-memory/bootstrap`;
  const fractalBootstrap = `${home}/.claude/docs/fractal-memory-bootstrap.md`;
  // Also check projects path
  const projectsBootstrap = `${home}/.claude/projects/-Users-Malachi/memory`;

  const evalExists = fileExists(evalFile);
  const bootstrapDirExists = fileExists(bootstrapFile);
  const fractalExists = fileExists(fractalBootstrap);
  const projectsMemoryExists = fileExists(projectsBootstrap);

  // PASS if eval spec + at least one bootstrap location exists
  const hasBootstrap = bootstrapDirExists || fractalExists || projectsMemoryExists;

  if (evalExists && hasBootstrap) {
    return {
      id: "bootstrap",
      name: "Bootstrap Layer",
      status: "PASS",
      source: "REAL",
      lastRun: now,
      message: `Eval spec exists. Bootstrap layer found${fractalExists ? " (fractal-memory-bootstrap.md)" : ""}${projectsMemoryExists ? " (projects memory)" : ""}`,
      suggestedRepair: null,
    };
  }

  const missing: string[] = [];
  if (!evalExists) missing.push("evals/bootstrap.eval.md");
  if (!hasBootstrap) missing.push("bootstrap layer (no bootstrap dir, no fractal-memory-bootstrap.md, no projects memory)");

  return {
    id: "bootstrap",
    name: "Bootstrap Layer",
    status: evalExists ? "WARN" : "FAIL",
    source: "REAL",
    lastRun: now,
    message: `Missing: ${missing.join(", ")}`,
    suggestedRepair: "Ensure bootstrap.eval.md and at least one bootstrap source exist",
  };
}

function runRetrievalGateEval(om: string, now: string): EvalResult {
  // Check: retrieval-gate.md exists + contains all 6 modes
  const gateFile = `${om}/schema/retrieval-gate.md`;

  if (!fileExists(gateFile)) {
    return {
      id: "retrieval-gate",
      name: "Retrieval Gate",
      status: "FAIL",
      source: "REAL",
      lastRun: now,
      message: "schema/retrieval-gate.md not found",
      suggestedRepair: "Create retrieval-gate.md with all 6 gate modes defined",
    };
  }

  const expectedModes = [
    "NO_RETRIEVAL",
    "BOOTSTRAP_ONLY",
    "WIKI_ONLY",
    "RAG_DYNAMIC",
    "GRAPH_RELATIONSHIP",
    "SOURCE_AUDIT",
  ];

  const missing = expectedModes.filter((mode) => !fileContains(gateFile, mode));

  if (missing.length === 0) {
    return {
      id: "retrieval-gate",
      name: "Retrieval Gate",
      status: "PASS",
      source: "REAL",
      lastRun: now,
      message: `All ${expectedModes.length} retrieval modes defined in schema`,
      suggestedRepair: null,
    };
  }

  return {
    id: "retrieval-gate",
    name: "Retrieval Gate",
    status: "WARN",
    source: "REAL",
    lastRun: now,
    message: `Missing modes: ${missing.join(", ")}`,
    suggestedRepair: "Add missing modes to schema/retrieval-gate.md",
  };
}

function runWikiCompilerEval(home: string, om: string, now: string): EvalResult {
  // Check: wiki directory exists (in oracle-memory or at ~/.claude/wiki/)
  const omWiki = `${om}/wiki`;
  const globalWiki = `${home}/.claude/wiki`;

  const omWikiExists = fileExists(omWiki);
  const globalWikiExists = fileExists(globalWiki);
  const hasWiki = omWikiExists || globalWikiExists;

  if (!hasWiki) {
    return {
      id: "wiki-compiler",
      name: "Wiki Compiler",
      status: "WARN",
      source: "REAL",
      lastRun: now,
      message: "No wiki directory found (checked oracle-memory/wiki/ and ~/.claude/wiki/)",
      suggestedRepair: "Create wiki directory and populate with compiled pages",
    };
  }

  // Check if wiki has content
  const activeWikiPath = omWikiExists ? omWiki : globalWiki;
  const hasContent = dirHasFiles(activeWikiPath);

  // Check if it's a symlink (WARN condition from spec)
  let isSymlink = false;
  try {
    const { lstatSync } = require("fs");
    isSymlink = lstatSync(activeWikiPath).isSymbolicLink();
  } catch {
    // ignore
  }

  if (hasContent && !isSymlink) {
    return {
      id: "wiki-compiler",
      name: "Wiki Compiler",
      status: "PASS",
      source: "REAL",
      lastRun: now,
      message: `Wiki directory found at ${omWikiExists ? "oracle-memory/wiki/" : "~/.claude/wiki/"} with content`,
      suggestedRepair: null,
    };
  }

  if (isSymlink) {
    return {
      id: "wiki-compiler",
      name: "Wiki Compiler",
      status: "WARN",
      source: "REAL",
      lastRun: now,
      message: "Wiki location is a symlink — may not be locally controlled",
      suggestedRepair: "Consider using a local wiki directory instead of symlink",
    };
  }

  return {
    id: "wiki-compiler",
    name: "Wiki Compiler",
    status: "WARN",
    source: "REAL",
    lastRun: now,
    message: "Wiki directory exists but is empty",
    suggestedRepair: "Run wiki compilation to populate pages",
  };
}

function runOpportunityGraphEval(om: string, now: string): EvalResult {
  // Check: opportunity_graph/README.md exists
  const readme = `${om}/opportunity_graph/README.md`;

  if (!fileExists(readme)) {
    return {
      id: "opportunity-graph",
      name: "Opportunity Graph",
      status: "FAIL",
      source: "REAL",
      lastRun: now,
      message: "opportunity_graph/README.md not found",
      suggestedRepair: "Create opportunity_graph/README.md with entity types and scaffold",
    };
  }

  // Check for entity type definitions
  const hasEntityTypes = fileContains(readme, "Entity types") || fileContains(readme, "entity");

  return {
    id: "opportunity-graph",
    name: "Opportunity Graph",
    status: hasEntityTypes ? "PASS" : "WARN",
    source: "REAL",
    lastRun: now,
    message: hasEntityTypes
      ? "Opportunity graph scaffold exists with entity type definitions"
      : "README exists but no entity type definitions found",
    suggestedRepair: hasEntityTypes ? null : "Add entity type definitions to opportunity_graph/README.md",
  };
}

function runSourceClassifierEval(om: string, now: string): EvalResult {
  // Check: source-classification.md exists + has all 4 domains + risk levels
  const classFile = `${om}/schema/source-classification.md`;

  if (!fileExists(classFile)) {
    return {
      id: "source-classifier",
      name: "Source Classifier",
      status: "FAIL",
      source: "REAL",
      lastRun: now,
      message: "schema/source-classification.md not found",
      suggestedRepair: "Create source-classification.md with domain, risk, and routing rules",
    };
  }

  const expectedDomains = ["BATMAN", "WAKANDA", "JARVIS", "ORACLE"];
  const expectedRisks = ["low", "medium", "high", "sensitive"];

  const missingDomains = expectedDomains.filter((d) => !fileContains(classFile, d));
  const missingRisks = expectedRisks.filter((r) => !fileContains(classFile, r));

  if (missingDomains.length === 0 && missingRisks.length === 0) {
    return {
      id: "source-classifier",
      name: "Source Classifier",
      status: "PASS",
      source: "REAL",
      lastRun: now,
      message: "All 4 domains and 4 risk levels defined in classification schema",
      suggestedRepair: null,
    };
  }

  const issues: string[] = [];
  if (missingDomains.length > 0) issues.push(`missing domains: ${missingDomains.join(", ")}`);
  if (missingRisks.length > 0) issues.push(`missing risks: ${missingRisks.join(", ")}`);

  return {
    id: "source-classifier",
    name: "Source Classifier",
    status: "WARN",
    source: "REAL",
    lastRun: now,
    message: issues.join("; "),
    suggestedRepair: "Update source-classification.md with complete domain and risk definitions",
  };
}
