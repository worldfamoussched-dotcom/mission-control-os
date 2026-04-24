import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TaskApprovalCard } from '../components/TaskApprovalCard';
import { ExecutionLog } from '../components/ExecutionLog';
import { CostTrackerWidget } from '../components/CostTrackerWidget';
import type { Task } from '../components/TaskApprovalCard';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';

type MissionState =
  | 'pending'
  | 'decomposed'
  | 'awaiting_approval'
  | 'executing'
  | 'complete'
  | 'failed';

interface Mission {
  mission_id: string;
  mode: 'batman' | 'jarvis' | 'wakanda';
  state: MissionState;
  tasks?: Task[];
  total_cost?: number;
  error?: string;
}

interface CostBreakdown {
  total_cost: number;
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
  status: 'completed' | 'review_blocked' | 'error' | string;
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

export default function Cockpit() {
  const [objective, setObjective] = useState('');
  const [missionId, setMissionId] = useState<string | null>(null);
  const [mission, setMission] = useState<Mission | null>(null);
  const [costData, setCostData] = useState<CostBreakdown>({ total_cost: 0 });
  const [results, setResults] = useState<TaskResult[]>([]);
  const [alerts, setAlerts] = useState<CostAlertItem[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMission = useCallback(async (id: string) => {
    try {
      const data = await apiFetch<Mission>(`/missions/${id}/results`);
      setMission(data);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to fetch mission');
    }
  }, []);

  const fetchCost = useCallback(async (id: string) => {
    try {
      const data = await apiFetch<CostBreakdown>(`/missions/${id}/cost`);
      setCostData(data);
    } catch {
      // Cost fetch is non-critical — silent failure is acceptable here
    }
  }, []);

  const fetchResults = useCallback(async (id: string) => {
    try {
      const data = await apiFetch<ResultsPayload>(`/missions/${id}/results`);
      setResults(data.results ?? []);
    } catch {
      // Review/results fetch is non-critical
    }
  }, []);

  const fetchAlerts = useCallback(async (id: string) => {
    try {
      const data = await apiFetch<AlertsPayload>(`/missions/${id}/alerts`);
      setAlerts(data.alerts ?? []);
    } catch {
      // Alert fetch is non-critical
    }
  }, []);

  useEffect(() => {
    if (!missionId) return;

    fetchMission(missionId);
    fetchCost(missionId);
    fetchResults(missionId);
    fetchAlerts(missionId);

    pollIntervalRef.current = setInterval(() => {
      fetchMission(missionId);
      fetchCost(missionId);
      fetchResults(missionId);
      fetchAlerts(missionId);
    }, 3000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [missionId, fetchMission, fetchCost, fetchResults, fetchAlerts]);

  // Stop polling once mission reaches a terminal state
  useEffect(() => {
    const terminalStates: MissionState[] = ['complete', 'failed'];
    if (mission && terminalStates.includes(mission.state)) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
  }, [mission]);

  const handleSubmit = async () => {
    if (!objective.trim()) return;

    setSubmitting(true);
    setSubmitError(null);
    setActionError(null);
    setMission(null);
    setCostData({ total_cost: 0 });
    setResults([]);
    setAlerts([]);
    setMissionId(null);

    try {
      const data = await apiFetch<Mission>('/missions', {
        method: 'POST',
        body: JSON.stringify({ objective: objective.trim(), mode: 'batman' }),
      });

      setMissionId(data.mission_id);
      setMission(data);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create mission');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = useCallback(async (taskId: string) => {
    if (!missionId) return;
    setActionError(null);

    try {
      await apiFetch(`/missions/${missionId}/approve`, { method: 'POST' });
      await apiFetch(`/missions/${missionId}/execute`, { method: 'POST' });
      await fetchMission(missionId);
      await fetchCost(missionId);
      await fetchResults(missionId);
      await fetchAlerts(missionId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Approval failed');
    }
  }, [missionId, fetchMission, fetchCost, fetchResults, fetchAlerts]);

  const handleReject = useCallback(async (taskId: string) => {
    if (!missionId) return;
    setActionError(null);

    setMission(prev => {
      if (!prev || !prev.tasks) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === taskId ? { ...t, state: 'rejected' as const } : t
        ),
      };
    });
  }, [missionId]);

  const pendingTasks = mission?.tasks?.filter(t => t.state === 'pending') ?? [];
  const allTasks = mission?.tasks ?? [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]" />
          <span className="font-mono text-sm tracking-widest text-zinc-300 uppercase">
            Mission Control — Batman Mode
          </span>
        </div>

        {mission && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600 font-mono">{mission.mission_id}</span>
            <MissionStateBadge state={mission.state} />
          </div>
        )}
      </header>

      {/* Mission Input */}
      <section className="px-6 py-4 border-b border-zinc-800 shrink-0">
        <div className="max-w-3xl flex gap-3">
          <textarea
            value={objective}
            onChange={e => setObjective(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
            placeholder="Enter mission objective… (⌘↵ to launch)"
            rows={2}
            disabled={submitting}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 font-mono resize-none focus:outline-none focus:border-cyan-600 disabled:opacity-50 transition-colors"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !objective.trim()}
            className="px-5 py-2 rounded font-mono font-semibold text-sm bg-cyan-700 hover:bg-cyan-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-start"
          >
            {submitting ? 'Launching…' : 'Launch'}
          </button>
        </div>

        {submitError && (
          <p className="mt-2 text-sm text-red-400 font-mono">{submitError}</p>
        )}
      </section>

      {/* Main Panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left — Approval Queue */}
        <aside className="w-80 shrink-0 border-r border-zinc-800 flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-800">
            <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500">
              Approval Queue
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

            {!mission && !submitting && (
              <p className="text-zinc-600 text-sm font-mono text-center pt-8">
                No active mission
              </p>
            )}

            {mission?.state === 'awaiting_approval' && pendingTasks.length === 0 && (
              <p className="text-zinc-500 text-sm font-mono text-center pt-8">
                All tasks reviewed
              </p>
            )}

            {pendingTasks.map(task => (
              <TaskApprovalCard
                key={task.id}
                task={task}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        </aside>

        {/* Right — Execution Log + Phase 2 panels */}
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
              <ExecutionLog tasks={allTasks} />
            </div>

            <ReviewPanel results={results} />
            <AlertsPanel alerts={alerts} />
          </div>
        </main>
      </div>

      {/* Bottom Bar — Cost */}
      <CostTrackerWidget
        totalCost={costData.total_cost}
        breakdown={costData.breakdown}
      />
    </div>
  );
}

function ReviewPanel({ results }: { results: TaskResult[] }) {
  const reviewed = results.filter(r => r.review_results && r.review_results.length > 0);

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

function MissionStateBadge({ state }: { state: MissionState }) {
  const styles: Record<MissionState, string> = {
    pending: 'bg-zinc-800 text-zinc-400',
    decomposed: 'bg-blue-950 text-blue-300 border border-blue-800',
    awaiting_approval: 'bg-amber-950 text-amber-300 border border-amber-700',
    executing: 'bg-purple-950 text-purple-300 border border-purple-800',
    complete: 'bg-emerald-950 text-emerald-300 border border-emerald-800',
    failed: 'bg-red-950 text-red-400 border border-red-900',
  };

  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded ${styles[state]}`}>
      {state.replace(/_/g, ' ')}
    </span>
  );
}
