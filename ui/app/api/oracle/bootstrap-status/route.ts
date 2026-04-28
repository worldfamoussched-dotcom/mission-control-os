// Oracle OS v0.7b — Fractal Bootstrap Status API Route
// Structural filesystem checks only. No live MCP calls. No writes. No credentials.

import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";

const EXPECTED_WIKI_PAGES = [
  "00-index.md",
  "01-current-state.md",
  "02-architecture.md",
  "03-tools.md",
  "04-ring-topology.md",
  "05-bootstrap-protocol.md",
  "06-drift-control.md",
  "07-open-questions.md",
  "08-build-log.md",
];

function fileContains(path: string, needle: string): boolean {
  try {
    const content = readFileSync(path, "utf-8");
    return content.includes(needle);
  } catch {
    return false;
  }
}

export async function GET() {
  const home = homedir();
  const claudeDir = `${home}/.claude`;

  // 1. Check wiki pages
  const wikiDir = `${claudeDir}/oracle-memory/wiki`;
  let wikiPagesFound = 0;
  for (const page of EXPECTED_WIKI_PAGES) {
    if (existsSync(`${wikiDir}/${page}`)) wikiPagesFound++;
  }

  // 2. Check bootstrap doc
  const bootstrapDocPath = `${claudeDir}/docs/fractal-memory-bootstrap.md`;
  const bootstrapDocExists = existsSync(bootstrapDocPath);

  // 3. Check MCP server has bootstrap_context
  const mcpServerPath = `${claudeDir}/memory-mcp/server.js`;
  const mcpServerExists = existsSync(mcpServerPath);
  const hasBootstrapTool = mcpServerExists && fileContains(mcpServerPath, "bootstrap_context");
  const hasBootstrapResource = mcpServerExists && fileContains(mcpServerPath, "memory://bootstrap/fractal");

  // 4. Count tools registered in server.js
  let toolsRegistered = 0;
  if (mcpServerExists) {
    try {
      const content = readFileSync(mcpServerPath, "utf-8");
      const toolMatches = content.match(/server\.tool\(/g);
      toolsRegistered = toolMatches ? toolMatches.length : 0;
    } catch {
      toolsRegistered = 0;
    }
  }

  // 5. Check CLAUDE.md has bootstrap rule
  const claudeMdPath = `${claudeDir}/CLAUDE.md`;
  const claudeRuleInstalled = existsSync(claudeMdPath) && fileContains(claudeMdPath, "bootstrap_context");

  // 6. Derive overall status
  const checks = [
    bootstrapDocExists,
    wikiPagesFound >= 7,
    hasBootstrapTool,
    hasBootstrapResource,
    claudeRuleInstalled,
  ];
  const passedChecks = checks.filter(Boolean).length;

  let status: "AVAILABLE" | "PARTIAL" | "MISSING";
  let lastBootstrapTest: "PASS" | "WARN" | "UNKNOWN";
  let message: string;

  if (passedChecks === checks.length) {
    status = "AVAILABLE";
    lastBootstrapTest = "PASS";
    message = `All checks passed. ${wikiPagesFound}/9 wiki pages, ${toolsRegistered} MCP tools, bootstrap rule installed.`;
  } else if (passedChecks > 0) {
    status = "PARTIAL";
    lastBootstrapTest = "WARN";
    const missing: string[] = [];
    if (!bootstrapDocExists) missing.push("bootstrap doc");
    if (wikiPagesFound < 7) missing.push(`wiki pages (${wikiPagesFound}/9)`);
    if (!hasBootstrapTool) missing.push("bootstrap_context tool");
    if (!hasBootstrapResource) missing.push("bootstrap resource");
    if (!claudeRuleInstalled) missing.push("CLAUDE.md rule");
    message = `Partial: missing ${missing.join(", ")}`;
  } else {
    status = "MISSING";
    lastBootstrapTest = "UNKNOWN";
    message = "Bootstrap v1 not detected.";
  }

  const capsuleSource = [
    bootstrapDocExists ? "docs/fractal-memory-bootstrap.md" : null,
    wikiPagesFound > 0 ? "oracle-memory/wiki/" : null,
  ]
    .filter(Boolean)
    .join(" + ") || "none";

  return NextResponse.json({
    status,
    source: "REAL_FS",
    tool: "bootstrap_context",
    toolsRegistered,
    resource: "memory://bootstrap/fractal",
    resourceRegistered: hasBootstrapResource,
    wikiPagesFound,
    wikiPagesExpected: 9,
    claudeRuleInstalled,
    lastBootstrapTest,
    capsuleSource,
    message,
    timestamp: new Date().toISOString(),
  });
}
