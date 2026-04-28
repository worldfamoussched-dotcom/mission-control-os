"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { OracleShell } from "../../components/shell/OracleShell";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { useOracleStore } from "../../store/useOracleStore";
import { getOracleLayerStatus, type LayerState } from "../../lib/oracle/layer-status";
import { getWikiCompilerStatus } from "../../lib/oracle/wiki-compiler";
import { getRetrievalGateStatus, retrievalModes } from "../../lib/oracle/retrieval-gate";
import { getOpportunityGraphMock } from "../../lib/oracle/opportunity-graph";
import { getSummaryTreeMock } from "../../lib/oracle/summary-tree";
import { getWikiHealthMock } from "../../lib/oracle/wiki-lint";
import { getLocalNodeHealthMock, fetchLocalNodeHealth, type ServiceStatus, type NodeHealthResult } from "../../lib/oracle/local-node-health";
import { getEvalStatusMock, fetchEvalStatus, type EvalStatus, type EvalSuiteResult } from "../../lib/oracle/eval-runner";
import { getBootstrapStatusMock, fetchBootstrapStatus, type BootstrapState, type BootstrapStatusResult } from "../../lib/oracle/bootstrap-status";
import { getLocalModelRouterStatus, type InferenceMode, type ModelRouterStatus } from "../../lib/oracle/local-model-router";
import { mockOracleHealth } from "../../lib/mock-data";

const plates = [
  { num: "I", title: "Cognitive Stack", file: "plate-07-cognitive-stack.html", color: "#3cb4dc" },
  { num: "II", title: "Stability Attractor", file: "plate-01-attractor-basin.html", color: "#2ecc71" },
  { num: "III", title: "Byzantine Quorum", file: "plate-03-byzantine-quorum.html", color: "#9b59b6" },
  { num: "IV", title: "Belief Propagation", file: "plate-04-belief-propagation.html", color: "#e74c3c" },
  { num: "V", title: "Memory Surgery", file: "plate-05-memory-surgery.html", color: "#e67e22" },
  { num: "VI", title: "Observatory", file: "plate-02-observatory-cockpit.html", color: "#2ecc71" },
  { num: "VII", title: "Theory Navigator", file: "plate-06-theory-navigator.html", color: "#9b59b6" },
  { num: "VIII", title: "Swarm Consensus", file: "plate-08-swarm-consensus.html", color: "#3cb4dc" },
  { num: "IX", title: "MPC Trajectory", file: "plate-09-mpc-trajectory.html", color: "#C9A227" },
];

const layerStatusColor: Record<LayerState, string> = {
  OPERATIONAL: "#2ecc71",
  SCAFFOLDED: "#e67e22",
  NOT_STARTED: "rgba(200,214,229,0.25)",
};

const serviceStatusColor: Record<ServiceStatus, string> = {
  HEALTHY: "#2ecc71",
  DEGRADED: "#e67e22",
  OFFLINE: "#e74c3c",
  NOT_WIRED: "rgba(200,214,229,0.3)",
};

const routerStatusColor: Record<string, string> = {
  READY: "#2ecc71",
  DEGRADED: "#e67e22",
  OFFLINE: "#e74c3c",
};

const evalStatusColor: Record<EvalStatus, string> = {
  PASS: "#2ecc71",
  WARN: "#e67e22",
  FAIL: "#e74c3c",
  NOT_WIRED: "rgba(200,214,229,0.3)",
};

const bootstrapStatusColor: Record<BootstrapState, string> = {
  AVAILABLE: "#2ecc71",
  PARTIAL: "#e67e22",
  MISSING: "#e74c3c",
  NOT_WIRED: "rgba(200,214,229,0.3)",
};

export default function OraclePage() {
  const setWorld = useOracleStore((s) => s.setWorld);
  useEffect(() => { setWorld("oracle"); }, [setWorld]);

  const layers = getOracleLayerStatus();
  const compiler = getWikiCompilerStatus();
  const gate = getRetrievalGateStatus();
  const graph = getOpportunityGraphMock();
  const tree = getSummaryTreeMock();
  const lint = getWikiHealthMock();

  // v0.7: Real data with mock fallback
  const [nodeHealth, setNodeHealth] = useState<NodeHealthResult>(getLocalNodeHealthMock());
  const [evalSuite, setEvalSuite] = useState<EvalSuiteResult>(getEvalStatusMock());
  const [bootstrap, setBootstrap] = useState<BootstrapStatusResult>(getBootstrapStatusMock());
  const [localRouter, setLocalRouter] = useState<ModelRouterStatus | null>(null);

  useEffect(() => {
    fetchLocalNodeHealth().then(setNodeHealth);
    fetchEvalStatus().then(setEvalSuite);
    fetchBootstrapStatus().then(setBootstrap);
    getLocalModelRouterStatus().then(setLocalRouter);
  }, []);

  return (
    <OracleShell>
      <div className="p-6">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <h1 className="font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-[3px] uppercase" style={{ color: "#3cb4dc" }}>
            Oracle
          </h1>
          <p className="text-[12px] font-[family-name:var(--font-display)] font-light tracking-[2px] mt-1" style={{ color: "rgba(200,214,229,0.5)" }}>
            Atlas of Governed Cognition
          </p>
          <p className="text-[10px] italic mt-2 max-w-lg mx-auto" style={{ color: "rgba(60,180,220,0.35)" }}>
            &ldquo;An oracle is not an all-knowing system. It is a civilization that maintains truth while discovering novelty.&rdquo;
          </p>
        </motion.div>

        {/* Health bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex justify-center gap-6 mb-6">
          <HealthStat label="Status" value={mockOracleHealth.status} color="#2ecc71" />
          <HealthStat label="Integrity" value={`${mockOracleHealth.integrity.matched}/${mockOracleHealth.integrity.total}`} color="#2ecc71" />
          <HealthStat label="V(x)" value={mockOracleHealth.stability.vx.toFixed(3)} color="#2ecc71" />
          <HealthStat label="Coherence" value={mockOracleHealth.memory.coherence.toFixed(2)} color="#3cb4dc" />
        </motion.div>

        {/* Memory Architecture Panels — 3 columns */}
        <div className="grid grid-cols-3 gap-3 mb-6">

          {/* 1. Layer Status */}
          <GlassPanel title="Memory Layer Status" badge={{ label: "9 LAYERS", color: "#3cb4dc" }} className="col-span-1" delay={0.1}>
            <div className="space-y-1.5">
              {layers.map((l) => (
                <div key={l.number} className="flex items-center justify-between py-1 border-b" style={{ borderColor: "rgba(60,180,220,0.04)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] tabular-nums w-3 text-right" style={{ color: "rgba(200,214,229,0.3)" }}>{l.number}</span>
                    <span className="text-[10px]" style={{ color: "rgba(200,214,229,0.7)" }}>{l.name}</span>
                  </div>
                  <span className="text-[7px] tracking-[1px] uppercase px-1.5 py-0.5 rounded font-medium" style={{ background: layerStatusColor[l.status] + "18", color: layerStatusColor[l.status] }}>
                    {l.status}
                  </span>
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* 2. Memory Compiler */}
          <GlassPanel title="Memory Compiler" badge={{ label: "L3", color: "#2ecc71" }} delay={0.15}>
            <div className="space-y-2">
              <CompilerRow label="Sources Processed" value={compiler.sourcesProcessed} />
              <CompilerRow label="Wiki Pages Updated" value={compiler.pagesUpdated} />
              <CompilerRow label="Entity Pages Created" value={compiler.entityPagesCreated} />
              <CompilerRow label="Contradictions Found" value={compiler.contradictionsFound} color={compiler.contradictionsFound > 0 ? "#e74c3c" : "#2ecc71"} />
              <div className="pt-2 border-t" style={{ borderColor: "rgba(60,180,220,0.06)" }}>
                <span className="text-[8px]" style={{ color: "rgba(200,214,229,0.3)" }}>
                  Last compile: {new Date(compiler.lastCompile).toLocaleString()}
                </span>
              </div>
            </div>
          </GlassPanel>

          {/* 3. Retrieval Gate */}
          <GlassPanel title="Retrieval Gate" badge={{ label: gate.currentMode, color: "#3cb4dc" }} delay={0.2}>
            <div className="space-y-2">
              <GateRow label="Confidence" value={gate.contextConfidence} />
              <GateRow label="Freshness" value={gate.freshness} />
              <GateRow label="Source Coverage" value={gate.sourceCoverage} />
              <div className="flex justify-between py-1">
                <span className="text-[9px]" style={{ color: "rgba(200,214,229,0.45)" }}>Critique</span>
                <span className="text-[10px] font-medium" style={{ color: gate.critiqueResult === "pass" ? "#2ecc71" : gate.critiqueResult === "warn" ? "#e67e22" : "#e74c3c" }}>
                  {gate.critiqueResult.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[9px]" style={{ color: "rgba(200,214,229,0.45)" }}>Escalation</span>
                <span className="text-[10px]" style={{ color: "rgba(200,214,229,0.5)" }}>{gate.escalationStatus}</span>
              </div>
              <div className="pt-2 border-t flex flex-wrap gap-1" style={{ borderColor: "rgba(60,180,220,0.06)" }}>
                {retrievalModes.map((m) => (
                  <span key={m} className="text-[6px] tracking-[0.5px] uppercase px-1 py-0.5 rounded" style={{
                    background: m === gate.currentMode ? "rgba(60,180,220,0.15)" : "rgba(255,255,255,0.02)",
                    color: m === gate.currentMode ? "#3cb4dc" : "rgba(200,214,229,0.25)",
                  }}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </GlassPanel>

          {/* 4. Opportunity Graph */}
          <GlassPanel title="Opportunity Graph" badge={{ label: `${graph.alerts.length} ALERTS`, color: "#e67e22" }} delay={0.25}>
            <div className="relative h-[120px] mb-2">
              <OpportunityGraphMini nodes={graph.nodes} edges={graph.edges} />
            </div>
            <div className="space-y-1.5">
              {graph.alerts.map((a) => (
                <div key={a.id} className="py-1.5 border-b" style={{ borderColor: "rgba(60,180,220,0.04)" }}>
                  <div className="flex gap-1 mb-0.5">
                    {a.worlds.map((w) => (
                      <span key={w} className="text-[6px] tracking-[0.5px] uppercase px-1 rounded" style={{ background: "rgba(230,126,34,0.1)", color: "#e67e22" }}>{w}</span>
                    ))}
                    <span className="text-[6px] tabular-nums ml-auto" style={{ color: "rgba(200,214,229,0.25)" }}>{(a.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-[8px] leading-relaxed" style={{ color: "rgba(200,214,229,0.5)" }}>{a.message}</p>
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* 5. Summary Tree */}
          <GlassPanel title="Summary Tree" badge={{ label: "RAPTOR", color: "#9b59b6" }} delay={0.3}>
            <div className="space-y-1">
              {tree.levels.map((level, i) => (
                <div key={level.name} className="flex items-center gap-2 py-1">
                  <span className="text-[8px] w-3 text-center" style={{ color: "rgba(155,89,182,0.4)" }}>{i === 0 ? "\u25BC" : i === tree.levels.length - 1 ? "\u25B2" : "\u2502"}</span>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="text-[9px]" style={{ color: "rgba(200,214,229,0.6)" }}>{level.name}</span>
                      <span className="text-[9px] tabular-nums" style={{ color: "#9b59b6" }}>{level.count}</span>
                    </div>
                    <span className="text-[7px]" style={{ color: "rgba(200,214,229,0.25)" }}>{level.description}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2 mt-2 border-t space-y-1" style={{ borderColor: "rgba(60,180,220,0.06)" }}>
              {tree.worldTrees.map((wt) => (
                <div key={wt.world} className="flex justify-between py-0.5">
                  <span className="text-[8px]" style={{ color: "rgba(200,214,229,0.4)" }}>{wt.world}</span>
                  <span className="text-[8px] tabular-nums" style={{ color: "rgba(155,89,182,0.5)" }}>{wt.entities} entities</span>
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* 6. Wiki Health / Lint */}
          <GlassPanel title="Wiki Health" badge={{ label: lint.contradictions === 0 ? "CLEAN" : "ISSUES", color: lint.contradictions === 0 ? "#2ecc71" : "#e74c3c" }} delay={0.35}>
            <div className="space-y-1.5">
              <LintRow label="Stale Pages" value={lint.stalePages} good={lint.stalePages === 0} />
              <LintRow label="Orphan Pages" value={lint.orphanPages} good={lint.orphanPages === 0} />
              <LintRow label="Contradictions" value={lint.contradictions} good={lint.contradictions === 0} />
              <LintRow label="Uncited Claims" value={lint.uncitedClaims} good={lint.uncitedClaims === 0} />
              <LintRow label="Missing Backlinks" value={lint.missingBacklinks} good={lint.missingBacklinks === 0} />
              <LintRow label="Duplicate Entities" value={lint.duplicateEntities} good={lint.duplicateEntities === 0} />
            </div>
          </GlassPanel>
        </div>

        {/* 7. Inference Router */}
        <div className="mb-6">
          <GlassPanel title="Inference Router" badge={{ label: "HYBRID", color: "#C9A227" }} delay={0.4}>
            <div className="flex gap-6">
              <InferenceMode name="LOCAL" active={false} tasks="classification, tagging, summarization, contact extraction, health checks" />
              <InferenceMode name="HYBRID" active={true} tasks="current mode — wiki reads + model reasoning, no external API calls" />
              <InferenceMode name="PREMIUM" active={false} tasks="contracts, brand-sensitive emails, client proposals, architecture decisions" />
            </div>
          </GlassPanel>
        </div>

        {/* 8. Local Model Router Status */}
        <div className="mb-6">
          <GlassPanel title="Local Model Router Status" badge={{ label: localRouter?.status || "LOADING", color: localRouter ? routerStatusColor[localRouter.status] : "rgba(200,214,229,0.3)" }} delay={0.45}>
            {localRouter ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                <LocalRouterRow label="Ollama Available" value={localRouter.ollama_available ? "YES" : "NO"} color={localRouter.ollama_available ? "#2ecc71" : "#e74c3c"} />
                <LocalRouterRow label="Default Model" value={localRouter.default_local_model || "N/A"} color="#C9A227" />
                <LocalRouterRow label="Models Loaded" value={String(localRouter.ollama_models.length)} color={localRouter.ollama_models.length > 0 ? "#3cb4dc" : "rgba(200,214,229,0.3)"} />
                <LocalRouterRow label="Router Status" value={localRouter.status} color={routerStatusColor[localRouter.status]} />
              </div>
            ) : (
              <div className="text-[9px]" style={{ color: "rgba(200,214,229,0.4)" }}>Initializing...</div>
            )}
          </GlassPanel>
        </div>

        {/* Fractal Bootstrap Status Panel */}
        <div className="mb-6">
          <GlassPanel title="Fractal Bootstrap Status" badge={{ label: `${bootstrap.status} [${bootstrap.source}]`, color: bootstrapStatusColor[bootstrap.status] }} delay={0.4}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              <BootstrapRow label="Bootstrap Context" value={bootstrap.status} color={bootstrapStatusColor[bootstrap.status]} />
              <BootstrapRow label="MCP Tool" value={bootstrap.tool} color="rgba(200,214,229,0.6)" />
              <BootstrapRow label="Tools Registered" value={String(bootstrap.toolsRegistered)} color="#3cb4dc" />
              <BootstrapRow label="Resource" value={bootstrap.resource.replace("memory://", "")} color="rgba(200,214,229,0.6)" />
              <BootstrapRow label="Wiki Pages" value={`${bootstrap.wikiPagesFound}/${bootstrap.wikiPagesExpected}`} color={bootstrap.wikiPagesFound === bootstrap.wikiPagesExpected ? "#2ecc71" : "#e67e22"} />
              <BootstrapRow label="CLAUDE Rule" value={bootstrap.claudeRuleInstalled ? "INSTALLED" : "MISSING"} color={bootstrap.claudeRuleInstalled ? "#2ecc71" : "#e74c3c"} />
              <BootstrapRow label="Last Test" value={bootstrap.lastBootstrapTest} color={bootstrap.lastBootstrapTest === "PASS" ? "#2ecc71" : bootstrap.lastBootstrapTest === "WARN" ? "#e67e22" : "rgba(200,214,229,0.3)"} />
              <BootstrapRow label="Capsule Source" value={bootstrap.capsuleSource} color="rgba(200,214,229,0.45)" />
            </div>
            <div className="pt-2 mt-2 border-t" style={{ borderColor: "rgba(60,180,220,0.06)" }}>
              <p className="text-[8px]" style={{ color: "rgba(200,214,229,0.3)" }}>{bootstrap.message}</p>
            </div>
          </GlassPanel>
        </div>

        {/* Health Summary Strip */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.42 }} className="flex justify-center gap-5 mb-6 py-3 rounded-lg" style={{ background: "rgba(8,12,24,0.5)", border: "1px solid rgba(60,180,220,0.06)" }}>
          <HealthStripItem label="Boot" value={bootstrap.status === "AVAILABLE" ? "READY" : bootstrap.status} color={bootstrapStatusColor[bootstrap.status]} />
          <HealthStripItem label="Node" value={nodeHealth.overall} color={serviceStatusColor[nodeHealth.overall]} />
          <HealthStripItem label="Evals" value={evalSuite.source === "REAL" ? `${evalSuite.passed}/${evalSuite.total} REAL_FS` : `${evalSuite.passed}/${evalSuite.total} STRUCTURAL`} color={evalSuite.passed === evalSuite.total ? "#2ecc71" : "#e67e22"} />
          <HealthStripItem label="Memory" value="OPERATIONAL" color="#2ecc71" />
          <HealthStripItem label="Retrieval" value="SCAFFOLDED" color="#e67e22" />
          <HealthStripItem label="Graph" value="SCAFFOLDED" color="#e67e22" />
        </motion.div>

        {/* Node Health + Eval Panels */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Local Node Health */}
          <GlassPanel title="Local Node Health" badge={{ label: `${nodeHealth.overall} [${nodeHealth.source}]`, color: serviceStatusColor[nodeHealth.overall] }} delay={0.45}>
            <div className="space-y-1.5">
              {nodeHealth.services.map((svc) => (
                <div key={svc.name} className="flex items-center justify-between py-1 border-b" style={{ borderColor: "rgba(60,180,220,0.04)" }}>
                  <span className="text-[10px]" style={{ color: "rgba(200,214,229,0.6)" }}>{svc.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px]" style={{ color: "rgba(200,214,229,0.25)" }}>{svc.detail}</span>
                    <span className="text-[7px] tracking-[1px] uppercase px-1.5 py-0.5 rounded font-medium" style={{ background: serviceStatusColor[svc.status] + "18", color: serviceStatusColor[svc.status] }}>
                      {svc.status}
                    </span>
                    <span className="text-[6px] tracking-[0.5px] uppercase px-1 py-0.5 rounded" style={{ background: svc.source === "REAL" ? "rgba(46,204,113,0.08)" : "rgba(230,126,34,0.08)", color: svc.source === "REAL" ? "#2ecc71" : "#e67e22" }}>
                      {svc.source}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* Executable Evals */}
          <GlassPanel title="Executable Evals" badge={{ label: `${evalSuite.passed}/${evalSuite.total} [${evalSuite.source}]`, color: evalSuite.passed === evalSuite.total ? "#2ecc71" : "#e67e22" }} delay={0.48}>
            <div className="space-y-1.5">
              {evalSuite.results.map((ev) => (
                <div key={ev.id} className="py-1.5 border-b" style={{ borderColor: "rgba(60,180,220,0.04)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px]" style={{ color: "rgba(200,214,229,0.6)" }}>{ev.name}</span>
                      <span className="text-[6px] tracking-[0.5px] uppercase px-1 py-0.5 rounded" style={{ background: ev.source === "REAL" ? "rgba(46,204,113,0.08)" : "rgba(230,126,34,0.08)", color: ev.source === "REAL" ? "#2ecc71" : "#e67e22" }}>
                        {ev.source}
                      </span>
                    </div>
                    <span className="text-[7px] tracking-[1px] uppercase px-1.5 py-0.5 rounded font-medium" style={{ background: evalStatusColor[ev.status] + "18", color: evalStatusColor[ev.status] }}>
                      {ev.status}
                    </span>
                  </div>
                  <p className="text-[8px] mt-0.5" style={{ color: "rgba(200,214,229,0.3)" }}>{ev.message}</p>
                  {ev.suggestedRepair && (
                    <p className="text-[7px] mt-0.5 italic" style={{ color: "rgba(230,126,34,0.4)" }}>Repair: {ev.suggestedRepair}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="pt-2 mt-2 border-t" style={{ borderColor: "rgba(60,180,220,0.06)" }}>
              <span className="text-[8px]" style={{ color: "rgba(200,214,229,0.25)" }}>Last run: {new Date(evalSuite.timestamp).toLocaleString()}</span>
            </div>
          </GlassPanel>
        </div>

        {/* Atlas Grid */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <div className="mb-3">
            <span className="font-[family-name:var(--font-display)] text-[11px] tracking-[2px] uppercase" style={{ color: "#3cb4dc" }}>
              Atlas of Governed Cognition
            </span>
          </div>
          <div className="grid grid-cols-3 gap-[1px]" style={{ background: "rgba(60,180,220,0.04)" }}>
            {plates.map((plate, i) => (
              <motion.div
                key={plate.num}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.55 + i * 0.04 }}
                className="relative p-5 group cursor-pointer transition-all"
                style={{ background: "#030308" }}
                onClick={() => window.open(`/atlas/${plate.file}`, "_blank")}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `radial-gradient(ellipse at 50% 50%, ${plate.color}08 0%, transparent 70%)` }} />
                <span className="absolute top-2 right-3 font-[family-name:var(--font-display)] text-[28px] font-extralight" style={{ color: plate.color + "0A" }}>{plate.num}</span>
                <div className="relative z-10">
                  <span className="text-[7px] tracking-[1px] uppercase px-1.5 py-0.5 rounded" style={{ background: plate.color + "15", color: plate.color }}>{plate.num}</span>
                  <h3 className="font-[family-name:var(--font-display)] text-[12px] font-medium tracking-[1px] mt-1.5 group-hover:text-current transition-colors" style={{ color: "rgba(200,214,229,0.6)" }}>{plate.title}</h3>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: plate.color }} />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Equation */}
        <div className="text-center mt-4">
          <p className="text-[9px]" style={{ color: "rgba(60,180,220,0.2)" }}>
            M<sub>t</sub> = (V, E, W, B) &nbsp;|&nbsp; &Delta;V &lt; 0 &nbsp;|&nbsp; M<sub>t</sub> &rarr; M*
          </p>
        </div>
      </div>
    </OracleShell>
  );
}

function HealthStripItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center px-3">
      <p className="text-[7px] tracking-[1.5px] uppercase mb-0.5" style={{ color: "rgba(200,214,229,0.25)" }}>{label}</p>
      <p className="text-[10px] font-medium tracking-[0.5px]" style={{ color }}>{value}</p>
    </div>
  );
}

function HealthStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <p className="text-[8px] tracking-[1.5px] uppercase mb-0.5" style={{ color: "rgba(200,214,229,0.3)" }}>{label}</p>
      <p className="text-[12px] font-medium tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}

function CompilerRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-[9px]" style={{ color: "rgba(200,214,229,0.45)" }}>{label}</span>
      <span className="text-[11px] font-medium tabular-nums" style={{ color: color || "#3cb4dc" }}>{value}</span>
    </div>
  );
}

function GateRow({ label, value }: { label: string; value: number }) {
  const color = value > 0.8 ? "#2ecc71" : value > 0.6 ? "#e67e22" : "#e74c3c";
  return (
    <div className="py-1">
      <div className="flex justify-between mb-0.5">
        <span className="text-[9px]" style={{ color: "rgba(200,214,229,0.45)" }}>{label}</span>
        <span className="text-[10px] tabular-nums" style={{ color }}>{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="w-full h-[2px] rounded" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div className="h-full rounded" style={{ width: `${value * 100}%`, background: color }} />
      </div>
    </div>
  );
}

function LintRow({ label, value, good }: { label: string; value: number; good: boolean }) {
  return (
    <div className="flex justify-between py-1 border-b" style={{ borderColor: "rgba(60,180,220,0.03)" }}>
      <span className="text-[9px]" style={{ color: "rgba(200,214,229,0.45)" }}>{label}</span>
      <span className="text-[10px] tabular-nums font-medium" style={{ color: good ? "#2ecc71" : "#e67e22" }}>{value}</span>
    </div>
  );
}

function InferenceMode({ name, active, tasks }: { name: string; active: boolean; tasks: string }) {
  return (
    <div className={`flex-1 p-3 rounded-md border transition-all ${active ? "" : ""}`} style={{
      border: `1px solid ${active ? "rgba(201,162,39,0.25)" : "rgba(60,180,220,0.06)"}`,
      background: active ? "rgba(201,162,39,0.04)" : "transparent",
    }}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-2 h-2 rounded-full" style={{ background: active ? "#C9A227" : "rgba(200,214,229,0.15)" }} />
        <span className="text-[10px] tracking-[1.5px] uppercase font-medium" style={{ color: active ? "#C9A227" : "rgba(200,214,229,0.35)" }}>{name}</span>
      </div>
      <p className="text-[8px] leading-relaxed" style={{ color: "rgba(200,214,229,0.35)" }}>{tasks}</p>
    </div>
  );
}

function BootstrapRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between py-1 border-b" style={{ borderColor: "rgba(60,180,220,0.03)" }}>
      <span className="text-[9px]" style={{ color: "rgba(200,214,229,0.45)" }}>{label}</span>
      <span className="text-[10px] font-medium" style={{ color }}>{value}</span>
    </div>
  );
}

function LocalRouterRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between py-1 border-b" style={{ borderColor: "rgba(60,180,220,0.03)" }}>
      <span className="text-[9px]" style={{ color: "rgba(200,214,229,0.45)" }}>{label}</span>
      <span className="text-[10px] font-medium" style={{ color }}>{value}</span>
    </div>
  );
}

// Mini opportunity graph visualization
function OpportunityGraphMini({ nodes, edges }: { nodes: Array<{ id: string; label: string; world: string }>; edges: Array<{ from: string; to: string; strength: number }> }) {
  const positions: Record<string, { x: number; y: number }> = {
    oracle: { x: 50, y: 50 },
    batman: { x: 15, y: 25 },
    wakanda: { x: 85, y: 25 },
    jarvis: { x: 50, y: 90 },
    umg: { x: 25, y: 55 },
    "umg-thread": { x: 75, y: 55 },
    caldwell: { x: 75, y: 75 },
    "festival-booking": { x: 25, y: 75 },
  };

  const worldColors: Record<string, string> = {
    ORACLE: "#3cb4dc", BATMAN: "#4a90d9", WAKANDA: "#8b5cf6", JARVIS: "#06d6a0",
  };

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {edges.map((e, i) => {
        const from = positions[e.from];
        const to = positions[e.to];
        if (!from || !to) return null;
        return (
          <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke="rgba(60,180,220,0.12)" strokeWidth="0.3"
            strokeDasharray={e.strength < 0.8 ? "1,1" : undefined}
          />
        );
      })}
      {nodes.map((n) => {
        const pos = positions[n.id];
        if (!pos) return null;
        const isWorld = n.type === "world";
        const color = worldColors[n.world] || "#3cb4dc";
        return (
          <g key={n.id}>
            <circle cx={pos.x} cy={pos.y} r={isWorld ? 3 : 1.8} fill={color} opacity={isWorld ? 0.6 : 0.35} />
            <text x={pos.x} y={pos.y + (isWorld ? 6 : 5)} textAnchor="middle" fontSize="3" fill={color} opacity={0.5}>{n.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
