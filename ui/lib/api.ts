/**
 * API client for Mission Control OS backend.
 *
 * Wraps fetch with error handling and response types.
 */

import type { Mission, TaskDefinition } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// The /health endpoint is mounted at the app root (main.py), not under /api.
const API_ROOT = API_BASE.replace(/\/api\/?$/, '');

interface ApiError {
  error: string;
  detail?: string;
  request_id?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/**
 * Make API request with error handling.
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  base: string = API_BASE
): Promise<T> {
  const url = `${base}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || error.error || 'API request failed');
  }

  return response.json();
}

/**
 * Mission API methods.
 */
export const missions = {
  create: (
    objective: string,
    mode: string = 'batman',
    approvers: string[] = [],
    abacPolicy?: { allowed_tools: string[]; forbidden_params: string[] }
  ): Promise<Mission> =>
    apiRequest<Mission>('/missions', {
      method: 'POST',
      body: JSON.stringify({ objective, mode, approvers, abac_policy: abacPolicy })
    }),

  get: (missionId: string): Promise<Mission> =>
    apiRequest<Mission>(`/missions/${missionId}`),

  list: (): Promise<Mission[]> =>
    apiRequest<Mission[]>('/missions'),

  getTasks: (missionId: string): Promise<TaskDefinition[]> =>
    apiRequest<TaskDefinition[]>(`/missions/${missionId}/tasks`),

  getApprovals: (missionId: string): Promise<unknown> =>
    apiRequest(`/missions/${missionId}/approvals`),

  getExecutions: (missionId: string): Promise<unknown> =>
    apiRequest(`/missions/${missionId}/executions`),

  approve: (
    missionId: string,
    taskId: string,
    approved: boolean,
    reason?: string
  ): Promise<unknown> =>
    apiRequest(`/missions/${missionId}/tasks/${taskId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approved, reason, approver_id: 'operator' })
    }),

  execute: (missionId: string): Promise<unknown> =>
    apiRequest(`/missions/${missionId}/execute`, {
      method: 'POST'
    }),

  results: (missionId: string): Promise<unknown> =>
    apiRequest(`/missions/${missionId}/results`),

  cost: (missionId: string): Promise<{ total_cost: number; breakdown?: Record<string, number> }> =>
    apiRequest(`/missions/${missionId}/cost`),

  alerts: (missionId: string): Promise<unknown[]> =>
    apiRequest(`/missions/${missionId}/alerts`),

  memory: (missionId: string): Promise<unknown[]> =>
    apiRequest(`/missions/${missionId}/memory`)
};

/**
 * Health check.
 */
export const health = () => apiRequest('/health', { method: 'GET' }, API_ROOT);
