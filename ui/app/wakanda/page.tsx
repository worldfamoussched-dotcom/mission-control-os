"use client";

import { useEffect } from "react";
import { OracleShell } from "../../components/shell/OracleShell";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { WakandaReleaseLattice } from "../../components/worlds/WakandaReleaseLattice";
import { useOracleStore } from "../../store/useOracleStore";
import { mockWakandaReleases } from "../../lib/mock-data";

const statusColors: Record<string, string> = {
  review: "#e67e22",
  approved: "#2ecc71",
  scheduled: "#8b5cf6",
  released: "#3cb4dc",
};

export default function WakandaPage() {
  const setWorld = useOracleStore((s) => s.setWorld);
  useEffect(() => { setWorld("wakanda"); }, [setWorld]);

  return (
    <OracleShell>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="font-[family-name:var(--font-display)] text-[20px] font-semibold tracking-[3px] uppercase" style={{ color: "#8b5cf6" }}>
            Wakanda
          </h1>
          <p className="text-[10px] tracking-[1px] uppercase mt-1" style={{ color: "rgba(196,184,232,0.5)" }}>
            Label Command HQ — All The Smoke
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Release Pipeline */}
          <GlassPanel title="Release Pipeline" badge={{ label: `${mockWakandaReleases.length}`, color: "#8b5cf6" }} className="col-span-2" delay={0.1}>
            <div className="space-y-2">
              {mockWakandaReleases.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b" style={{ borderColor: "rgba(139,92,246,0.06)" }}>
                  <div>
                    <p className="text-[11px] font-medium" style={{ color: "#c4b8e8" }}>{r.title}</p>
                    <p className="text-[8px] tracking-[1px] uppercase mt-0.5" style={{ color: "rgba(196,184,232,0.4)" }}>{r.artist}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {"releaseDate" in r && (
                      <span className="text-[8px] tabular-nums" style={{ color: "rgba(196,184,232,0.4)" }}>{r.releaseDate}</span>
                    )}
                    <span className="text-[8px] tracking-[1px] uppercase px-2 py-0.5 rounded" style={{ background: statusColors[r.status] + "15", color: statusColors[r.status] }}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* Demo Queue */}
          <GlassPanel title="Demo Queue" badge={{ label: "2", color: "#e67e22" }} delay={0.2}>
            <div className="space-y-2">
              <DemoItem title="Night Frequency" status="Under Review" color="#e67e22" />
              <DemoItem title="Basement Ritual" status="Approved" color="#2ecc71" />
            </div>
          </GlassPanel>

          {/* Roster */}
          <GlassPanel title="Roster / Artists" delay={0.3}>
            <div className="space-y-2">
              {["Hotboxx", "nSJ", "Damelo", "London X"].map((name) => (
                <div key={name} className="flex items-center gap-3 py-1">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-[9px]" style={{ background: "rgba(139,92,246,0.08)", color: "#8b5cf6" }}>
                    {name[0]}
                  </div>
                  <span className="text-[10px]" style={{ color: "#c4b8e8" }}>{name}</span>
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* A&R Intelligence */}
          <GlassPanel title="A&R Intelligence" delay={0.35}>
            <div className="space-y-2">
              <IntelItem text="nSJ demo shows strong minimal tech signature — fits ATS sound" />
              <IntelItem text="Damelo collabs trending on Traxsource — schedule next release window" />
            </div>
          </GlassPanel>

          {/* Campaigns */}
          <GlassPanel title="Campaigns" delay={0.4}>
            <div className="space-y-2">
              <CampaignItem title="Instagram Giveaway" status="Live" reach="2.4K" />
              <CampaignItem title="SoundCloud Repost Chain" status="Planning" reach="—" />
            </div>
          </GlassPanel>
        </div>

        {/* Centerpiece — Release Lattice */}
        <GlassPanel title="Release Lattice" badge={{ label: "LIVE", color: "#8b5cf6" }} delay={0.5}>
          <WakandaReleaseLattice />
        </GlassPanel>
      </div>
    </OracleShell>
  );
}

function DemoItem({ title, status, color }: { title: string; status: string; color: string }) {
  return (
    <div className="py-1.5 border-b" style={{ borderColor: "rgba(139,92,246,0.04)" }}>
      <p className="text-[10px]" style={{ color: "#c4b8e8" }}>{title}</p>
      <p className="text-[8px] tracking-[1px] uppercase" style={{ color }}>{status}</p>
    </div>
  );
}

function IntelItem({ text }: { text: string }) {
  return (
    <div className="py-1.5 border-b" style={{ borderColor: "rgba(139,92,246,0.04)" }}>
      <p className="text-[9px] leading-relaxed" style={{ color: "rgba(196,184,232,0.6)" }}>{text}</p>
    </div>
  );
}

function CampaignItem({ title, status, reach }: { title: string; status: string; reach: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b" style={{ borderColor: "rgba(139,92,246,0.04)" }}>
      <div>
        <p className="text-[10px]" style={{ color: "#c4b8e8" }}>{title}</p>
        <p className="text-[8px]" style={{ color: "rgba(196,184,232,0.4)" }}>{status}</p>
      </div>
      <span className="text-[10px] tabular-nums" style={{ color: "#8b5cf6" }}>{reach}</span>
    </div>
  );
}
