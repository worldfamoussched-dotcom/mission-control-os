/** React component for approval queue UI. */

import React, { useState } from 'react';

interface Task {
  id: string;
  name: string;
  description: string;
  status: string;
}

interface ApprovalQueueProps {
  missionId: string;
  tasks: Task[];
  onApprove: (taskId: string, reason?: string) => Promise<void>;
  onReject: (taskId: string, reason: string) => Promise<void>;
  isLoading?: boolean;
}

/**
 * ApprovalQueue component - displays pending tasks for approval.
 */
export function ApprovalQueue({
  missionId,
  tasks,
  onApprove,
  onReject,
  isLoading = false
}: ApprovalQueueProps) {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const pendingTasks = tasks.filter(t => t.status === 'pending_approval');

  if (pendingTasks.length === 0) {
    return (
      <div className="bg-green-50 rounded-lg border border-green-300 p-4">
        <div className="text-green-800 font-semibold">
          All tasks approved! Ready for execution.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <h3 className="text-lg font-semibold mb-4">
        Approval Queue ({pendingTasks.length} tasks)
      </h3>

      <div className="space-y-4">
        {pendingTasks.map(task => (
          <div
            key={task.id}
            className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{task.name}</h4>
                <p className="text-gray-600 mt-1">{task.description}</p>
                <div className="text-xs text-gray-500 mt-2">{task.id}</div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onApprove(task.id)}
                  disabled={isLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 font-medium transition"
                >
                  Approve
                </button>

                <button
                  onClick={() => setSelectedTask(task.id)}
                  disabled={isLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 font-medium transition"
                >
                  Reject
                </button>
              </div>
            </div>

            {selectedTask === task.id && (
              <div className="mt-4 pt-4 border-t bg-white p-3 rounded">
                <label className="block text-sm font-medium mb-2">
                  Reason for rejection:
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  className="w-full border rounded p-2 text-sm mb-3"
                  placeholder="Explain why you're rejecting this task..."
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onReject(task.id, rejectionReason);
                      setSelectedTask(null);
                      setRejectionReason('');
                    }}
                    disabled={isLoading || !rejectionReason.trim()}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirm Rejection
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTask(null);
                      setRejectionReason('');
                    }}
                    className="px-3 py-1 bg-gray-300 text-gray-800 rounded text-sm hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
