import React from 'react';

interface CostTrackerWidgetProps {
  totalCost: number;
  breakdown?: Record<string, number>;
}

export function CostTrackerWidget({ totalCost, breakdown }: CostTrackerWidgetProps) {
  const hasBreakdown = breakdown && Object.keys(breakdown).length > 0;

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-zinc-900 border-t border-zinc-800">
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs text-zinc-500 uppercase tracking-widest">Cost</span>
        <span className="font-mono text-amber-400 font-semibold text-sm">
          ${totalCost.toFixed(4)}
        </span>
      </div>

      {hasBreakdown && (
        <div className="flex items-center gap-3 overflow-x-auto">
          {Object.entries(breakdown!).map(([key, value]) => (
            <div key={key} className="flex items-baseline gap-1 shrink-0">
              <span className="text-xs text-zinc-600 font-mono">{key}</span>
              <span className="text-xs text-zinc-400 font-mono">${value.toFixed(4)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
