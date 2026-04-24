"""React component for visualizing mission graph."""

import React from 'react';

interface Task {
  id: string;
  name: string;
  status: string;
}

interface MissionGraphProps {
  missionId: string;
  tasks: Task[];
  currentTask?: string;
}

/**
 * MissionGraph component - displays mission tasks and execution flow.
 *
 * Phase 1: Simple list view
 * Phase 2: Interactive graph visualization
 */
export function MissionGraph({
  missionId,
  tasks,
  currentTask
}: MissionGraphProps) {
  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Mission Flow</h3>

      <div className="space-y-3">
        {tasks.map((task, index) => (
          <div
            key={task.id}
            className={`p-3 rounded border ${
              currentTask === task.id
                ? 'border-blue-500 bg-blue-50'
                : task.status === 'completed'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="text-sm font-mono text-gray-500">
                Step {index + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium">{task.name}</div>
                <div className="text-sm text-gray-600">{task.id}</div>
              </div>
              <div className="text-sm font-semibold">
                <span
                  className={`px-2 py-1 rounded ${
                    task.status === 'pending_approval'
                      ? 'bg-yellow-100 text-yellow-800'
                      : task.status === 'approved'
                        ? 'bg-blue-100 text-blue-800'
                        : task.status === 'executing'
                          ? 'bg-purple-100 text-purple-800'
                          : task.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                  }`}
                >
                  {task.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No tasks yet. Mission is decomposing...
        </div>
      )}
    </div>
  );
}
