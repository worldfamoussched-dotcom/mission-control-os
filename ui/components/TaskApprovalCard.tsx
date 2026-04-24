import React, { useState } from 'react';

export interface Task {
  id: string;
  description: string;
  tool: string;
  parameters: Record<string, unknown>;
  state: 'pending' | 'approved' | 'rejected' | 'executing' | 'complete' | 'failed';
  result?: unknown;
  cost?: number;
}

interface TaskApprovalCardProps {
  task: Task;
  onApprove: (taskId: string) => void;
  onReject: (taskId: string) => void;
}

export function TaskApprovalCard({ task, onApprove, onReject }: TaskApprovalCardProps) {
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

  const isInFlight = approving || rejecting;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium leading-snug">{task.description}</p>
          <span className="inline-block mt-1 text-xs font-mono text-cyan-400 bg-cyan-950 border border-cyan-800 rounded px-2 py-0.5">
            {task.tool}
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
            {JSON.stringify(task.parameters, null, 2)}
          </pre>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleApprove}
          disabled={isInFlight}
          className="flex-1 py-2 rounded font-semibold text-sm transition-colors bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {approving ? <Spinner /> : null}
          {approving ? 'Approving…' : 'Approve'}
        </button>

        <button
          onClick={handleReject}
          disabled={isInFlight}
          className="flex-1 py-2 rounded font-semibold text-sm transition-colors bg-red-800 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {rejecting ? <Spinner /> : null}
          {rejecting ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8z"
      />
    </svg>
  );
}
