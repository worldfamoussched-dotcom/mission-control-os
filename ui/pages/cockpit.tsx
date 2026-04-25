import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ExecutionLog } from '../components/ExecutionLog';
import { CostTrackerWidget } from '../components/CostTrackerWidget';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';

// ---------------------------------------------------------------------------
// Brand → Mode mapping
//
// Operators think in brands, not modes. The picker selects a brand and the
// mode is implied. Mapping locked in session memory at:
//   ~/.claude/projects/.../memory/mode_business_mapping.md
// ---------------------------------------------------------------------------

type Mode = 'batman' | 'jarvis' | 'wakanda';

interface Brand {
  id: Mode;
  label: string;
  short: string;            // 1–2 word chip label
  description: string;      // one-line operator hint
  accent: string;           // tailwind color class (chip + button bg)
  accentText: string;       // button text color
  ring: string;             // ring color when selected
  pulse: string;            // header status dot color
}

const BRANDS: readonly Brand[] = [
  {
    id: 'batman',
    label: 'Vampire Sex / London X',
    short: 'VS / LX',
    description: 'Approval-gated. Nothing public-facing runs without your sign-off.',
    accent: 'bg-violet-700 hover:bg-violet-600',
    accentText: 'text-white',
    ring: 'ring-violet-500',
    pulse: 'bg-violet-400 shadow-[0_0_6px_2px_rgba(167,139,250,0.5)]',
  },
  {
    id: 'jarvis',
    label: 'Fractal Web Solutions',
    short: 'Fractal',
    description: 'Command-execute. Tasks run immediately — for agency dev work.',
    accent: 'bg-emerald-700 hover:bg-emerald-600',
    accentText: 'text-white',
    ring: 'ring-emerald-500',
    pulse: 'bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]',
  },
  {
    id: 'wakanda',
    label: 'All the Smoke',
    short: 'ATS',
    description: 'Mixed. Internal stuff runs; releases and public posts wait for your call.',
    accent: 'bg-amber-600 hover:bg-amber-500',
    accentText: 'text-zinc-950',
    ring: 'ring-amber-500',
    pulse: 'bg-amber-400 shadow-[0_0_6px_2px_rgba(251,191,36,0.5)]',
  },
] as const;

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

type MissionState =
  | 'pending'
  | 'pending_decomposition'
  | 'pending_approval'
  | 'decomposed'
  | 'awaiting_approval'
  | 'executing'
  | 'complete'
  | 'completed'
  | 'failed';

interface BackendTask {
  id: string;
  name?: string;
  description?: string;
  suggested_tool?: string;
  tool?: string;
  parameters?: Record<string, unknown>;
  status?: string;
  state?: string;
  cost?: number;
  gated?: boolean;
}

interface CreatedMission {
  id: string;
  mode: Mode;
  state: MissionState;
  tasks?: BackendTask[];
}

interface CostBreakdown {
  total_cost: number;
  total_cost_usd?: number;
  breakdown?: Record<string, number>;
}

interface ReviewResultItem {
  passed: boolean;
  reason: string;
  reviewer: 'code' | 'memory' | 'security';
}

interface TaskResult {
  task_id: string;
  task_name?: string;
  status: 'completed' | 'review_blocked' | 'rejected' | 'error' | string;
  error?: string | null;
  cost_usd?: number;
  review_results?: ReviewResultItem[];
}

interface ResultsPayload {
  mission_id: string;
  results: TaskResult[];
  total_cost_usd: number;
}

interface CostAlertItem {
  mission_id: string;
  current_cost: number;
  threshold: number;
  level: 'warning' | 'critical';
  message: string;
  fired_at: string;
}

interface AlertsPayload {
  mission_id: string;
  alerts: CostAlertItem[];
}

interface WakandaRunSummary {
  mission_id: string;
  mode: 'wakanda';
  tasks: BackendTask[];
  gated_task_ids: string[];
  pass_through_results: TaskResult[];
  total_cost_usd: number;
}

interface JarvisRunSummary {
  mission_id: string;
  mode: 'jarvis';
  status: 'completed' | 'partial' | 'failed';
  results: TaskResult[];
  total_cost_usd: number;
  cost_alerts: CostAlertItem[];
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Cockpit
// ---------------------------------------------------------------------------

export default function Cockpit() {
  const [brand, setBrand] = useState<Brand>(BRANDS[0]);
  const [objective, setObjective] = useState('');

  const [missionId, setMissionId] = useState<string | null>(null);
  const [missionMode, setMissionMode] = useState<Mode | null>(null);
  const [missionState, setMissionState] = useState<MissionState | null>(null);

  const [pendingTasks, setPendingTasks] = useState<BackendTask[]>([]);
  const [results, setResults] = useState<TaskResult[]>([]);
  const [alerts, setAlerts] = useState<CostAlertItem[]>([]);
  const [costData, setCostData] = useState<CostBreakdown>({ total_cost: 0 });

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetMissionState = useCallback(() => {
    setMissionId(null);
    setMissionMode(null);
    setMissionState(null);
    setPendingTasks([]);
    setResults([]);
    setAlerts([]);
    setCostData({ total_cost: 0 });
    setSubmitError(null);
    setActionError(null);
  }, []);

  const fetchCost = useCallback(async (id: string) => {
    try {
      const data = await apiFetch<CostBreakdown>(`/missions/${id}/cost`);
      setCostData({
        total_cost: data.total_cost_usd ?? data.total_cost ?? 0,
        breakdown: data.breakdown,
      });
    } catch {
      // non-critical
    }
  }, []);

  const fetchResults = useCallback(async (id: string) => {
    try {
      const data = await apiFetch<ResultsPayload>(`/missions/${id}/results`);
      setResults(data.results ?? []);
    } catch {
      // non-critical
    }
  }, []);

  const fetchAlerts = useCallback(async (id: string) => {
    try {
      const data = await apiFetch<AlertsPayload>(`/missions/${id}/alerts`);
      setAlerts(data.alerts ?? []);
    } catch {
      // non-critical
    }
  }, []);

  // Polling — only meaningful while there is in-flight work
  useEffect(() => {
    if (!missionId) return;

    fetchCost(missionId);
    fetchResults(missionId);
    fetchAlerts(missionId);

    pollIntervalRef.current = setInterval(() => {
      fetchCost(missionId);
      fetchResults(missionId);
      fetchAlerts(missionId);
    }, 3000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [missionId, fetchCost, fetchResults, fetchAlerts]);

  useEffect(() => {
    if (!missionState) return;
    const terminal: MissionState[] = ['complete', 'completed', 'failed'];
    if (terminal.includes(missionState) && pendingTasks.length === 0) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
  }, [missionState, pendingTasks.length]);

  // -------------------------------------------------------------------------
  // Launch
  // -------------------------------------------------------------------------

  const handleLaunch = async () => {
    if (!objective.trim()) return;

    setSubmitting(true);
    resetMissionState();

    try {
      const created = await apiFetch<CreatedMission>('/missions', {
        method: 'POST',
        body: JSON.stringify({
          objective: objective.trim(),
          mode: brand.id,
          // Single operator default for all modes — multi-approver is Phase 4
          approvers: brand.id === 'jarvis' ? [] : ['operator'],
        }),
      });

      setMissionId(created.id);
      setMissionMode(brand.id);
      setMissionState(created.state);

      if (brand.id === 'batman') {
        // Decomposed at create time; tasks come back in the response
        setPendingTasks(created.tasks ?? []);
      } else if (brand.id === 'jarvis') {
        // Single-shot: fire /run immediately, no approval queue
        const run = await apiFetch<JarvisRunSummary>(`/missions/${created.id}/run`, {
          method: 'POST',
        });
        setResults(run.results);
        setMissionState(run.status === 'completed' ? 'completed' : run.status === 'failed' ? 'failed' : 'executing');
      } else {
        // Wakanda: classify + auto-run pass-through, return gated queue
        const run = await apiFetch<WakandaRunSummary>(
          `/missions/${created.id}/run-wakanda`,
          { method: 'POST' },
        );
        setResults(run.pass_through_results);
        // Surface gated tasks in the approval queue
        const gatedQueue = run.tasks.filter(t => run.gated_task_ids.includes(t.id));
        setPendingTasks(gatedQueue);
        setMissionState(gatedQueue.length === 0 ? 'completed' : 'awaiting_approval');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to launch mission');
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Approval — branches by mode
  // -------------------------------------------------------------------------

  const handleApprove = useCallback(
    async (taskId: string) => {
      if (!missionId || !missionMode) return;
      setActionError(null);

      try {
        if (missionMode === 'batman') {
          await apiFetch(`/missions/${missionId}/tasks/${taskId}/approve`, {
            method: 'POST',
            body: JSON.stringify({ approved: true, approver_id: 'operator' }),
          });
        } else if (missionMode === 'wakanda') {
          await apiFetch(
            `/missions/${missionId}/wakanda/tasks/${taskId}/approve`,
            {
              method: 'POST',
              body: JSON.stringify({ approved: true, approver_id: 'operator' }),
            },
          );
        }

        // Drop the approved task from the queue
        setPendingTasks(prev => prev.filter(t => t.id !== taskId));

        // Batman: only run /execute when the queue is empty
        if (missionMode === 'batman') {
          const stillPending = pendingTasks.filter(t => t.id !== taskId);
          if (stillPending.length === 0) {
            await apiFetch(`/missions/${missionId}/execute`, { method: 'POST' });
            setMissionState('executing');
          }
        }

        await fetchCost(missionId);
        await fetchResults(missionId);
        await fetchAlerts(missionId);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Approval failed');
      }
    },
    [missionId, missionMode, pendingTasks, fetchCost, fetchResults, fetchAlerts],
  );

  const handleReject = useCallback(
    async (taskId: string) => {
      if (!missionId || !missionMode) return;
      setActionError(null);

      try {
        if (missionMode === 'batman') {
          await apiFetch(`/missions/${missionId}/tasks/${taskId}/approve`, {
            method: 'POST',
            body: JSON.stringify({
              approved: false,
              approver_id: 'operator',
              reason: 'Operator rejected',
            }),
          });
        } else if (missionMode === 'wakanda') {
          await apiFetch(
            `/missions/${missionId}/wakanda/tasks/${taskId}/approve`,
            {
              method: 'POST',
              body: JSON.stringify({
                approved: false,
                approver_id: 'operator',
                reason: 'Operator rejected',
              }),
            },
          );
        }

        setPendingTasks(prev => prev.filter(t => t.id !== taskId));
        await fetchResults(missionId);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Reject failed');
      }
    },
    [missionId, missionMode, fetchResults],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const showApprovalQueue =
    missionMode === 'batman' || (missionMode === 'wakanda' && pendingTasks.length > 0);

  const operatorStatus = (() => {
    if (!missionId) return 'No active mission';
    if (pendingTasks.length > 0) return `Waiting on you — ${pendingTasks.length} to review`;
    if (missionState === 'executing') return 'Running…';
    if (missionState === 'completed' || missionState === 'complete') return 'Done';
    if (missionState === 'failed') return 'Failed';
    return missionState ?? '—';
  })();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className={`w-2 h-2 rounded-full ${brand.pulse}`} />
          <span className="font-mono text-sm tracking-widest text-zinc-300 uppercase">
            Mission Control
          </span>
          <span className="text-zinc-700 font-mono text-sm">/</span>
          <span className="font-mono text-sm text-zinc-400">{brand.label}</span>
        </div>

        {missionId && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-600 font-mono">{missionId}</span>
            <span className="text-xs font-mono text-zinc-300">{operatorStatus}</span>
          </div>
        )}
      </header>

      {/* Brand Picker */}
      <section className="px-6 py-3 border-b border-zinc-800 shrink-0 flex gap-2">
        {BRANDS.map(b => {
          const selected = b.id === brand.id;
          return (
            <button
              key={b.id}
              onClick={() => {
                setBrand(b);
                resetMissionState();
              }}
              disabled={submitting}
              className={`px-3 py-1.5 rounded font-mono text-xs uppercase tracking-wider transition-all ${
                selected
                  ? `${b.accent} ${b.accentText} ring-2 ${b.ring}`
                  : 'bg-zinc-900 border border-zinc-700 text-zinc-500 hover:text-zinc-200 hover:border-zinc-600'
              } disabled:opacity-50`}
              title={b.description}
            >
              {b.short}
            </button>
          );
        })}
      </section>

      {/* Mission Input */}
      <section className="px-6 py-4 border-b border-zinc-800 shrink-0">
        <div className="max-w-3xl flex gap-3">
          <textarea
            value={objective}
            onChange={e => setObjective(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleLaunch();
            }}
            placeholder="Enter mission objective… (⌘↵ to launch)"
            rows={2}
            disabled={submitting}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 font-mono resize-none focus:outline-none focus:border-zinc-500 disabled:opacity-50 transition-colors"
          />
          <button
            onClick={handleLaunch}
            disabled={submitting || !objective.trim()}
            className={`px-5 py-2 rounded font-mono font-semibold text-sm ${brand.accent} ${brand.accentText} disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-start`}
          >
            {submitting ? 'Launching…' : 'Launch'}
          </button>
        </div>

        <p className="mt-2 text-xs text-zinc-500 font-mono">{brand.description}</p>

        {submitError && (
          <p className="mt-2 text-sm text-red-400 font-mono">{submitError}</p>
        )}
      </section>

      {/* Main panels */}
      <div className="flex-1 flex overflow-hidden">
        {showApprovalQueue && (
          <aside className="w-80 shrink-0 border-r border-zinc-800 flex flex-col">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500">
                {missionMode === 'wakanda' ? 'Gated Queue' : 'Approval Queue'}
                {pendingTasks.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-amber-900 text-amber-300 rounded text-xs">
                    {pendingTasks.length}
                  </span>
                )}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {actionError && (
                <div className="p-3 bg-red-950 border border-red-800 rounded text-sm text-red-300 font-mono">
                  {actionError}
                </div>
              )}

              {!missionId && !submitting && (
                <p className="text-zinc-600 text-sm font-mono text-center pt-8">
                  No active mission
                </p>
              )}

              {missionId && pendingTasks.length === 0 && (
                <p className="text-zinc-500 text-sm font-mono text-center pt-8">
                  All tasks reviewed
                </p>
              )}

              {pendingTasks.map(task => (
                <PendingTaskCard
                  key={task.id}
                  task={task}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </div>
          </aside>
        )}

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-4">
            <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500">
              Execution Log
            </h2>
            {alerts.length > 0 && (
              <span className="text-xs font-mono text-amber-400">
                {alerts.length} cost alert{alerts.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-zinc-800">
              <ExecutionLog tasks={resultsToTaskList(results)} />
            </div>

            <ReviewPanel results={results} />
            <AlertsPanel alerts={alerts} />
          </div>
        </main>
      </div>

      <CostTrackerWidget
        totalCost={costData.total_cost}
        breakdown={costData.breakdown}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import type { Task as ExecutionLogTask } from '../components/TaskApprovalCard';

function resultsToTaskList(results: TaskResult[]): ExecutionLogTask[] {
  return results.map(r => ({
    id: r.task_id,
    description: r.task_name ?? r.task_id,
    tool: '',                  // execution log uses these for display only
    parameters: {},
    state:
      r.status === 'completed'
        ? 'complete'
        : r.status === 'review_blocked' || r.status === 'rejected'
        ? 'rejected'
        : r.status === 'error'
        ? 'failed'
        : 'pending',
    result: r.error ?? undefined,
    cost: r.cost_usd,
  }));
}

// ---------------------------------------------------------------------------
// Approval card — local to cockpit, uses the BackendTask shape
// ---------------------------------------------------------------------------

interface PendingTaskCardProps {
  task: BackendTask;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function PendingTaskCard({ task, onApprove, onReject }: PendingTaskCardProps) {
  const [paramsExpanded, setParamsExpanded] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const handleApprove = async () => {
    setApproving(true);
    try {
      await onApprove(task.id);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      await onReject(task.id);
    } finally {
      setRejecting(false);
    }
  };

  const tool = task.tool ?? task.suggested_tool ?? 'unknown';
  const description = task.description ?? task.name ?? task.id;
  const params = task.parameters ?? {};
  const isInFlight = approving || rejecting;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium leading-snug">{description}</p>
          <span className="inline-block mt-1 text-xs font-mono text-cyan-400 bg-cyan-950 border border-cyan-800 rounded px-2 py-0.5">
            {tool}
          </span>
        </div>

        {task.cost !== undefined && (
          <div className="text-right shrink-0">
            <span className="text-xs text-zinc-400">est. cost</span>
            <div className="text-amber-400 font-mono text-sm font-semibold">
              ${task.cost.toFixed(4)}
            </div>
          </div>
        )}
      </div>

      {Object.keys(params).length > 0 && (
        <div>
          <button
            onClick={() => setParamsExpanded(prev => !prev)}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
          >
            <span>{paramsExpanded ? '▾' : '▸'}</span>
            <span>parameters</span>
          </button>

          {paramsExpanded && (
            <pre className="mt-2 p-3 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(params, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleApprove}
          disabled={isInFlight}
          className="flex-1 py-2 rounded font-semibold text-sm transition-colors bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {approving ? 'Approving…' : 'Approve'}
        </button>

        <button
          onClick={handleReject}
          disabled={isInFlight}
          className="flex-1 py-2 rounded font-semibold text-sm transition-colors bg-red-800 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {rejecting ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review + Alerts panels (unchanged behavior, kept local)
// ---------------------------------------------------------------------------

function ReviewPanel({ results }: { results: TaskResult[] }) {
  const reviewed = results.filter(
    r => r.review_results && r.review_results.length > 0,
  );

  return (
    <section className="p-4 border-b border-zinc-800">
      <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-3">
        Review Gate
      </h3>

      {reviewed.length === 0 && (
        <p className="text-zinc-600 text-sm font-mono">No reviewed tasks yet.</p>
      )}

      <ul className="space-y-2">
        {reviewed.map(task => {
          const blocked = task.status === 'review_blocked';
          const reviewers = task.review_results ?? [];

          return (
            <li
              key={task.task_id}
              className={`p-3 rounded border font-mono text-xs ${
                blocked
                  ? 'bg-red-950/40 border-red-900 text-red-200'
                  : 'bg-emerald-950/30 border-emerald-900/60 text-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-300">
                  {task.task_name ?? task.task_id}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                    blocked
                      ? 'bg-red-900 text-red-200'
                      : 'bg-emerald-900 text-emerald-200'
                  }`}
                >
                  {blocked ? 'blocked' : 'passed'}
                </span>
              </div>

              <ul className="space-y-1">
                {reviewers.map((rr, idx) => (
                  <li
                    key={`${task.task_id}-${rr.reviewer}-${idx}`}
                    className="flex items-start gap-2"
                  >
                    <span
                      className={`w-1.5 h-1.5 mt-1.5 rounded-full shrink-0 ${
                        rr.passed ? 'bg-emerald-400' : 'bg-red-400'
                      }`}
                    />
                    <span className="text-zinc-400">
                      [{rr.reviewer}]{' '}
                      <span className={rr.passed ? 'text-zinc-300' : 'text-red-300'}>
                        {rr.reason}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AlertsPanel({ alerts }: { alerts: CostAlertItem[] }) {
  return (
    <section className="p-4">
      <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-3">
        Cost Alerts
      </h3>

      {alerts.length === 0 && (
        <p className="text-zinc-600 text-sm font-mono">No alerts fired.</p>
      )}

      <ul className="space-y-2">
        {alerts.map((a, idx) => {
          const critical = a.level === 'critical';
          return (
            <li
              key={`${a.fired_at}-${idx}`}
              className={`p-3 rounded border font-mono text-xs flex items-start justify-between gap-3 ${
                critical
                  ? 'bg-red-950/40 border-red-900 text-red-200'
                  : 'bg-amber-950/40 border-amber-900/70 text-amber-200'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                      critical
                        ? 'bg-red-900 text-red-200'
                        : 'bg-amber-900 text-amber-200'
                    }`}
                  >
                    {a.level}
                  </span>
                  <span className="text-zinc-400">{a.message}</span>
                </div>
                <div className="text-zinc-500 text-[11px]">
                  ${a.current_cost.toFixed(4)} / ${a.threshold.toFixed(4)}
                </div>
              </div>
              <time className="text-zinc-600 text-[10px] shrink-0">
                {new Date(a.fired_at).toLocaleTimeString()}
              </time>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
