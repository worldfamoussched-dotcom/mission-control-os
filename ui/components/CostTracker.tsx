"""React component for cost tracking display."""

import React from 'react';

interface CostTrackerProps {
  missionId: string;
  totalCostUsd: number;
  costLimitUsd?: number;
  breakdownByTool?: Record<string, number>;
}

/**
 * CostTracker component - displays mission cost accumulation and limits.
 */
export function CostTracker({
  missionId,
  totalCostUsd,
  costLimitUsd,
  breakdownByTool = {}
}: CostTrackerProps) {
  const percentageUsed = costLimitUsd
    ? Math.round((totalCostUsd / costLimitUsd) * 100)
    : 0;

  const isOverBudget = costLimitUsd && totalCostUsd > costLimitUsd;

  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <h3 className="text-lg font-semibold mb-4">Cost Tracking</h3>

      {/* Total Cost */}
      <div className={`p-4 rounded-lg ${isOverBudget ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} border mb-4`}>
        <div className="flex justify-between items-baseline">
          <div className="text-gray-700 font-medium">Total Cost</div>
          <div className={`text-3xl font-bold ${isOverBudget ? 'text-red-600' : 'text-blue-600'}`}>
            ${totalCostUsd.toFixed(2)}
          </div>
        </div>

        {costLimitUsd && (
          <div className="mt-3">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Budget Remaining</span>
              <span className="font-medium">
                ${(costLimitUsd - totalCostUsd).toFixed(2)} of ${costLimitUsd.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  isOverBudget ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(percentageUsed, 100)}%` }}
              />
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {percentageUsed}% of budget used
            </div>
          </div>
        )}

        {isOverBudget && (
          <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-red-800 text-sm font-semibold">
            ⚠️ Budget exceeded by ${(totalCostUsd - costLimitUsd!).toFixed(2)}
          </div>
        )}
      </div>

      {/* Breakdown */}
      {Object.keys(breakdownByTool).length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-700 mb-3">Cost Breakdown</h4>
          <div className="space-y-2">
            {Object.entries(breakdownByTool).map(([tool, cost]) => (
              <div key={tool} className="flex justify-between text-sm">
                <span className="text-gray-600">{tool}</span>
                <span className="font-medium">${cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
