import React, { useEffect, useRef } from 'react';
import type { Task } from './TaskApprovalCard';

interface ExecutionLogProps {
  tasks: Task[];
}

const STATE_ICON: Record<Task['state'], string> = {
  pending: '○',
  approved: '◎',
  rejected: '✗',
  executing: '⟳',
  complete: '✓',
  failed: '✗',
};

const STATE_COLORS: Record<Task['state'], string> = {
  pending: 'text-zinc-500',
  approved: 'text-cyan-400',
  rejected: 'text-red-400',
  executing: 'text-amber-400 animate-pulse',
  complete: 'text-emerald-400',
  failed: 'text-red-500',
};

const BADGE_COLORS: Record<Task['state'], string> = {
  pending: 'bg-zinc-800 text-zinc-400',
  approved: 'bg-cyan-950 text-cyan-300 border border-cyan-800',
  rejected: 'bg-red-950 text-red-400 border border-red-800',
  executing: 'bg-amber-950 text-amber-300 border border-amber-700',
  complete: 'bg-emerald-950 text-emerald-300 border border-emerald-800',
  failed: 'bg-red-950 text-red-400 border border-red-900',
};

export function ExecutionLog({ tasks }: ExecutionLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-600 font-mono text-sm">
        — awaiting tasks —
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto font-mono text-sm space-y-1 pr-1">
      {tasks.map(task => (
        <div
          key={task.id}
          className="flex items-start gap-3 p-2 rounded hover:bg-zinc-800/50 transition-colors"
        >
          <span className={`text-base leading-5 shrink-0 ${STATE_COLORS[task.state]}`}>
            {STATE_ICON[task.state]}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-zinc-200 truncate">{task.description}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${BADGE_COLORS[task.state]}`}>
                {task.state}
              </span>
            </div>

            {task.result !== undefined && (
              <pre className="mt-1 text-xs text-zinc-500 whitespace-pre-wrap break-all line-clamp-3">
                {typeof task.result === 'string'
                  ? task.result
                  : JSON.stringify(task.result, null, 2)}
              </pre>
            )}
          </div>

          {task.cost !== undefined && (
            <span className="text-xs text-zinc-500 shrink-0">${task.cost.toFixed(4)}</span>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
