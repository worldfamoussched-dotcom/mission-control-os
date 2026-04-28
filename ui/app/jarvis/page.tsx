"use client";

import { useEffect } from "react";
import { OracleShell } from "../../components/shell/OracleShell";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { MetricBar } from "../../components/ui/MetricBar";
import { JarvisBuildMatrix } from "../../components/worlds/JarvisBuildMatrix";
import { useOracleStore } from "../../store/useOracleStore";
import { mockJarvisClients } from "../../lib/mock-data";

const statusColors: Record<string, string> = {
  in_progress: "#06d6a0",
  proposal: "#e67e22",
  not_started: "rgba(184,232,216,0.3)",
  deployed: "#3cb4dc",
};

export default function JarvisPage() {
  const setWorld = useOracleStore((s) => s.setWorld);
  useEffect(() => { setWorld("jarvis"); }, [setWorld]);

  return (
    <OracleShell>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="font-[family-name:var(--font-display)] text-[20px] font-semibold tracking-[3px] uppercase" style={{ color: "#06d6a0" }}>
            Jarvis
          </h1>
          <p className="text-[10px] tracking-[1px] uppercase mt-1" style={{ color: "rgba(184,232,216,0.5)" }}>
            Engineering Intelligence Lab — Fractal Web Solutions
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Client Pipeline */}
          <GlassPanel title="Client Pipeline" badge={{ label: `${mockJarvisClients.length}`, color: "#06d6a0" }} className="col-span-2" delay={0.1}>
            <div className="space-y-2">
              {mockJarvisClients.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b" style={{ borderColor: "rgba(6,214,160,0.06)" }}>
                  <div>
                    <p className="text-[11px] font-medium" style={{ color: "#b8e8d8" }}>{c.project}</p>
                    <p className="text-[8px] tracking-[1px] uppercase mt-0.5" style={{ color: "rgba(184,232,216,0.4)" }}>{c.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {c.health > 0 && (
                      <span className="text-[10px] tabular-nums" style={{ color: "#06d6a0" }}>{c.health}%</span>
                    )}
                    <span className="text-[8px] tracking-[1px] uppercase px-2 py-0.5 rounded" style={{ background: statusColors[c.status] + "15", color: statusColors[c.status] }}>
                      {c.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* Deployment Status */}
          <GlassPanel title="Deployment Status" delay={0.2}>
            <MetricBar label="Artist Portfolio" value={92} color="#06d6a0" />
            <MetricBar label="Booking MVP" value={0} color="rgba(184,232,216,0.2)" />
            <MetricBar label="VS Website" value={0} color="rgba(184,232,216,0.2)" />
            <div className="mt-3 text-[8px]" style={{ color: "rgba(184,232,216,0.3)" }}>
              {/* TODO: wire to real deployment API */}
              API/webhook connection point
            </div>
          </GlassPanel>

          {/* Active Builds */}
          <GlassPanel title="Active Builds" delay={0.3}>
            <BuildRow name="Artist Portfolio" branch="main" commits={12} ci="passing" />
            <BuildRow name="Oracle OS UI" branch="feature/v0.1" commits={3} ci="building" />
          </GlassPanel>

          {/* Proposals */}
          <GlassPanel title="Proposals" delay={0.35}>
            <div className="space-y-2">
              <ProposalRow title="Booking Platform MVP" value="$4,800" status="sent" />
              <ProposalRow title="Artist Merch Store" value="$2,200" status="draft" />
            </div>
          </GlassPanel>

          {/* Internal Build Agents */}
          <GlassPanel title="Internal Agents" delay={0.4}>
            <div className="space-y-1.5">
              <AgentRow name="Mission Architect" status="idle" />
              <AgentRow name="Frontend Builder" status="ready" />
              <AgentRow name="Backend Engineer" status="ready" />
              <AgentRow name="Reviewer" status="standby" />
            </div>
            <div className="mt-3 text-[8px]" style={{ color: "rgba(184,232,216,0.3)" }}>
              {/* TODO: wire to agent bridge websocket */}
              Agent bridge connection point
            </div>
          </GlassPanel>
        </div>

        {/* Centerpiece — Build Matrix */}
        <GlassPanel title="Build Matrix" badge={{ label: "LIVE", color: "#06d6a0" }} delay={0.5}>
          <JarvisBuildMatrix />
        </GlassPanel>
      </div>
    </OracleShell>
  );
}

function BuildRow({ name, branch, commits, ci }: { name: string; branch: string; commits: number; ci: string }) {
  const ciColor = ci === "passing" ? "#06d6a0" : ci === "building" ? "#e67e22" : "#e74c3c";
  return (
    <div className="py-1.5 border-b" style={{ borderColor: "rgba(6,214,160,0.04)" }}>
      <div className="flex justify-between">
        <span className="text-[10px]" style={{ color: "#b8e8d8" }}>{name}</span>
        <span className="text-[8px] tracking-[1px] uppercase" style={{ color: ciColor }}>{ci}</span>
      </div>
      <p className="text-[8px]" style={{ color: "rgba(184,232,216,0.4)" }}>{branch} — {commits} commits</p>
    </div>
  );
}

function ProposalRow({ title, value, status }: { title: string; value: string; status: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b" style={{ borderColor: "rgba(6,214,160,0.04)" }}>
      <div>
        <p className="text-[10px]" style={{ color: "#b8e8d8" }}>{title}</p>
        <p className="text-[8px]" style={{ color: "rgba(184,232,216,0.4)" }}>{status}</p>
      </div>
      <span className="text-[10px] font-medium tabular-nums" style={{ color: "#06d6a0" }}>{value}</span>
    </div>
  );
}

function AgentRow({ name, status }: { name: string; status: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-[9px]" style={{ color: "rgba(184,232,216,0.6)" }}>{name}</span>
      <span className="text-[8px] tracking-[1px] uppercase" style={{ color: "rgba(6,214,160,0.5)" }}>{status}</span>
    </div>
  );
}
