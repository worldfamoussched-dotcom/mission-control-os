/**
 * Dashboard page - main Mission Control OS cockpit.
 *
 * Displays:
 * - List of active missions
 * - Create new mission form
 * - Real-time execution status
 */

import React, { useState, useEffect } from 'react';
import { MissionGraph } from '../components/MissionGraph';
import { ApprovalQueue } from '../components/ApprovalQueue';
import { CostTracker } from '../components/CostTracker';
import { missions } from '../lib/api';
import { Mission, MissionMode } from '../lib/types';

export default function Dashboard() {
  const [missionList, setMissionList] = useState<Mission[]>([]);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(false);
  const [newObjective, setNewObjective] = useState('');

  useEffect(() => {
    loadMissions();
  }, []);

  const loadMissions = async () => {
    setLoading(true);
    try {
      const response = await missions.list();
      setMissionList(response);
    } catch (err) {
      console.error('Failed to load missions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMission = async () => {
    if (!newObjective.trim()) return;

    setLoading(true);
    try {
      const newMission = await missions.create(newObjective, MissionMode.BATMAN, [
        'operator@example.com'
      ]);
      setMissionList([newMission, ...missionList]);
      setSelectedMission(newMission);
      setNewObjective('');
    } catch (err) {
      console.error('Failed to create mission:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveTask = async (taskId: string, reason?: string) => {
    if (!selectedMission) return;

    setLoading(true);
    try {
      await missions.approve(selectedMission.id, taskId, true, reason);
      // Refresh mission
      const updated = await missions.get(selectedMission.id);
      setSelectedMission(updated);
      setMissionList(
        missionList.map(m => (m.id === updated.id ? updated : m))
      );
    } catch (err) {
      console.error('Failed to approve task:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectTask = async (taskId: string, reason: string) => {
    if (!selectedMission) return;

    setLoading(true);
    try {
      await missions.approve(selectedMission.id, taskId, false, reason);
      // Refresh mission
      const updated = await missions.get(selectedMission.id);
      setSelectedMission(updated);
      setMissionList(
        missionList.map(m => (m.id === updated.id ? updated : m))
      );
    } catch (err) {
      console.error('Failed to reject task:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Mission Control OS
          </h1>
          <p className="text-gray-600">
            Phase 1: Batman Mode MVP — Approval-based execution
          </p>
        </div>

        {/* Create Mission */}
        <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Create New Mission</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newObjective}
              onChange={e => setNewObjective(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateMission();
              }}
              placeholder="Enter mission objective..."
              className="flex-1 border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              onClick={handleCreateMission}
              disabled={loading || !newObjective.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Mission List */}
          <div className="col-span-1">
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <h2 className="font-semibold mb-4">Missions</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {missionList.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMission(m)}
                    className={`w-full text-left p-3 rounded border transition ${
                      selectedMission?.id === m.id
                        ? 'bg-blue-50 border-blue-500 border-2'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-sm">{m.objective}</div>
                    <div className="text-xs text-gray-500 mt-1">{m.id}</div>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 bg-gray-200 rounded">
                        {m.mode.toUpperCase()}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          m.state === 'completed'
                            ? 'bg-green-200 text-green-800'
                            : m.state === 'executing'
                              ? 'bg-blue-200 text-blue-800'
                              : 'bg-yellow-200 text-yellow-800'
                        }`}
                      >
                        {m.state.replace('_', ' ')}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mission Details */}
          <div className="col-span-2 space-y-6">
            {selectedMission ? (
              <>
                {/* Graph */}
                <MissionGraph
                  missionId={selectedMission.id}
                  tasks={selectedMission.tasks}
                />

                {/* Cost Tracker */}
                <CostTracker
                  missionId={selectedMission.id}
                  totalCostUsd={selectedMission.total_cost_usd}
                  costLimitUsd={selectedMission.cost_limit_usd}
                />

                {/* Approval Queue */}
                <ApprovalQueue
                  missionId={selectedMission.id}
                  tasks={selectedMission.tasks}
                  onApprove={handleApproveTask}
                  onReject={handleRejectTask}
                  isLoading={loading}
                />
              </>
            ) : (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-600">
                  Select a mission or create a new one to begin
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
