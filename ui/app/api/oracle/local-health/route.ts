// Oracle OS v0.7 — Real Local Health Checks API Route
// Safe read-only checks only. No writes. No credentials. No external APIs.
// Short timeouts. Graceful fallback on missing commands.

import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";

type ServiceStatus = "HEALTHY" | "DEGRADED" | "OFFLINE" | "NOT_WIRED";

interface ServiceCheck {
  name: string;
  status: ServiceStatus;
  source: "REAL" | "NOT_WIRED";
  detail: string;
}

function safeExec(cmd: string, timeoutMs = 3000): string | null {
  try {
    return execSync(cmd, { timeout: timeoutMs, encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

function checkCommand(name: string): boolean {
  return safeExec(`which ${name}`, 2000) !== null;
}

function checkDir(path: string): boolean {
  return existsSync(path);
}

export async function GET() {
  const home = homedir();
  const claudeDir = `${home}/.claude`;
  const services: ServiceCheck[] = [];

  // 1. Filesystem checks (always real)
  const fsDirs = [
    { name: "oracle-memory/", path: `${claudeDir}/oracle-memory` },
    { name: "oracle-memory/schema/", path: `${claudeDir}/oracle-memory/schema` },
    { name: "oracle-memory/summary_tree/", path: `${claudeDir}/oracle-memory/summary_tree` },
    { name: "oracle-memory/opportunity_graph/", path: `${claudeDir}/oracle-memory/opportunity_graph` },
    { name: "oracle-memory/evals/", path: `${claudeDir}/oracle-memory/evals` },
    { name: "sources/", path: `${claudeDir}/sources` },
  ];

  let fsHealthy = 0;
  for (const dir of fsDirs) {
    const exists = checkDir(dir.path);
    if (exists) fsHealthy++;
  }

  services.push({
    name: "Oracle Filesystem",
    status: fsHealthy === fsDirs.length ? "HEALTHY" : fsHealthy > 0 ? "DEGRADED" : "OFFLINE",
    source: "REAL",
    detail: `${fsHealthy}/${fsDirs.length} directories found`,
  });

  // 2. Command availability checks
  const commands: Array<{ name: string; cmd: string; serviceCheck?: string }> = [
    { name: "Ollama", cmd: "ollama", serviceCheck: "ollama list" },
    { name: "Postgres", cmd: "psql", serviceCheck: "pg_isready" },
    { name: "Redis", cmd: "redis-cli", serviceCheck: "redis-cli ping" },
    { name: "Chroma / pgvector", cmd: "chroma" },
    { name: "Claude Code", cmd: "claude" },
    { name: "Codex", cmd: "codex" },
    { name: "Kiro", cmd: "kiro" },
  ];

  for (const svc of commands) {
    const installed = checkCommand(svc.cmd);

    if (!installed) {
      services.push({
        name: svc.name,
        status: "NOT_WIRED",
        source: "REAL",
        detail: `${svc.cmd} not found in PATH`,
      });
      continue;
    }

    // Command exists — try optional service check
    if (svc.serviceCheck) {
      const result = safeExec(svc.serviceCheck, 3000);
      if (result !== null) {
        // Sanitize output — don't expose full paths or sensitive info
        const sanitized = result.slice(0, 80).replace(home, "~");
        services.push({
          name: svc.name,
          status: "HEALTHY",
          source: "REAL",
          detail: `Running: ${sanitized}`,
        });
      } else {
        services.push({
          name: svc.name,
          status: "OFFLINE",
          source: "REAL",
          detail: `${svc.cmd} installed but service not responding`,
        });
      }
    } else {
      services.push({
        name: svc.name,
        status: "HEALTHY",
        source: "REAL",
        detail: `${svc.cmd} found`,
      });
    }
  }

  // Derive overall
  const statuses = services.map((s) => s.status);
  let overall: ServiceStatus = "HEALTHY";
  if (statuses.some((s) => s === "OFFLINE")) overall = "DEGRADED";
  else if (statuses.every((s) => s === "NOT_WIRED")) overall = "NOT_WIRED";
  else if (!statuses.every((s) => s === "HEALTHY")) overall = "DEGRADED";

  // FS summary
  const fsConnected = fsHealthy === fsDirs.length;
  const servicesFound = services.filter((s) => s.status === "HEALTHY").length;

  return NextResponse.json({
    services,
    overall,
    fsStatus: fsConnected ? "CONNECTED" : fsHealthy > 0 ? "PARTIAL" : "MISSING",
    servicesFound: `${servicesFound}/${services.length}`,
    timestamp: new Date().toISOString(),
  });
}
