"use client";

import { useEffect } from "react";
import { OracleShell } from "../../components/shell/OracleShell";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { MetricBar } from "../../components/ui/MetricBar";
import { BatmanSignalMap } from "../../components/worlds/BatmanSignalMap";
import { useOracleStore } from "../../store/useOracleStore";
import { mockBatmanMissions, mockBatmanContacts } from "../../lib/mock-data";

const statusColors: Record<string, string> = {
  active: "#4a90d9",
  pending: "#e67e22",
  queued: "rgba(184,197,214,0.4)",
  critical: "#e74c3c",
};

const priorityColors: Record<string, string> = {
  high: "#e67e22",
  medium: "#4a90d9",
  critical: "#e74c3c",
  low: "rgba(184,197,214,0.4)",
};

export default function BatmanPage() {
  const setWorld = useOracleStore((s) => s.setWorld);
  useEffect(() => { setWorld("batman"); }, [setWorld]);

  return (
    <OracleShell>
      <div className="p-6">
        {/* World Header */}
        <div className="mb-6">
          <h1 className="font-[family-name:var(--font-display)] text-[20px] font-semibold tracking-[3px] uppercase" style={{ color: "#4a90d9" }}>
            Batman
          </h1>
          <p className="text-[10px] tracking-[1px] uppercase mt-1" style={{ color: "rgba(184,197,214,0.5)" }}>
            Artist Command Center — Nick London / London X / Vampire Sex
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Active Missions */}
          <GlassPanel title="Active Missions" badge={{ label: `${mockBatmanMissions.length}`, color: "#4a90d9" }} className="col-span-2" delay={0.1}>
            <div className="space-y-2">
              {mockBatmanMissions.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b" style={{ borderColor: "rgba(74,144,217,0.06)" }}>
                  <div>
                    <p className="text-[11px] font-medium" style={{ color: "#b8c5d6" }}>{m.title}</p>
                    <p className="text-[8px] tracking-[1px] uppercase mt-0.5" style={{ color: "rgba(184,197,214,0.4)" }}>{m.entity}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[8px] tracking-[1px] uppercase px-2 py-0.5 rounded" style={{ background: priorityColors[m.priority] + "15", color: priorityColors[m.priority] }}>
                      {m.priority}
                    </span>
                    <span className="text-[8px] tracking-[1px] uppercase px-2 py-0.5 rounded" style={{ background: statusColors[m.status] + "15", color: statusColors[m.status] }}>
                      {m.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* Artist Entities */}
          <GlassPanel title="Artist Entities" delay={0.2}>
            <div className="space-y-3">
              {["Nick London", "London X", "Vampire Sex"].map((name) => (
                <div key={name} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md flex items-center justify-center text-[10px]" style={{ background: "rgba(74,144,217,0.08)", color: "#4a90d9" }}>
                    {name[0]}
                  </div>
                  <span className="text-[10px]" style={{ color: "#b8c5d6" }}>{name}</span>
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* Key Contacts */}
          <GlassPanel title="Key Contacts" badge={{ label: `${mockBatmanContacts.length}`, color: "#4a90d9" }} delay={0.3}>
            <div className="space-y-2">
              {mockBatmanContacts.map((c, i) => (
                <div key={i} className="py-1.5 border-b" style={{ borderColor: "rgba(74,144,217,0.04)" }}>
                  <p className="text-[10px]" style={{ color: "#b8c5d6" }}>{c.name}</p>
                  <p className="text-[8px]" style={{ color: "rgba(184,197,214,0.4)" }}>{c.role} — {c.entity}</p>
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* Track Stack */}
          <GlassPanel title="Track Stack" delay={0.35}>
            <MetricBar label="Soul Stew EP" value={85} color="#4a90d9" />
            <MetricBar label="Space X" value={60} color="#4a90d9" />
            <MetricBar label="Bob Marley Prod" value={40} color="#e67e22" />
          </GlassPanel>

          {/* Opportunity Alerts */}
          <GlassPanel title="Recent Signals" delay={0.4}>
            <div className="space-y-2">
              <Signal text="Witty Tunes playlisted Soul Stew on All New Dance (567K)" time="Apr 25" />
              <Signal text="Space X live on Beatport HYPE" time="Apr 3" />
              <Signal text="Hotboxx confirmed 3 collabs for ATS" time="Apr 24" />
            </div>
          </GlassPanel>
        </div>

        {/* Centerpiece — Signal Map */}
        <GlassPanel title="Signal Map" badge={{ label: "LIVE", color: "#4a90d9" }} delay={0.5}>
          <BatmanSignalMap />
        </GlassPanel>
      </div>
    </OracleShell>
  );
}

function Signal({ text, time }: { text: string; time: string }) {
  return (
    <div className="py-1.5 border-b" style={{ borderColor: "rgba(74,144,217,0.04)" }}>
      <p className="text-[9px] leading-relaxed" style={{ color: "rgba(184,197,214,0.7)" }}>{text}</p>
      <p className="text-[8px] mt-0.5" style={{ color: "rgba(184,197,214,0.3)" }}>{time}</p>
    </div>
  );
}
