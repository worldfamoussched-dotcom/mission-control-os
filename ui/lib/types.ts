/**
 * TypeScript types for Mission Control OS frontend.
 */

export enum MissionMode {
  BATMAN = 'batman',
  JARVIS = 'jarvis',
  WAKANDA = 'wakanda'
}

export enum MissionState {
  PENDING_DECOMPOSITION = 'pending_decomposition',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  FROZEN = 'frozen'
}

export enum TaskStatus {
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REJECTED = 'rejected'
}

export enum ExecutionStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  TIMEOUT = 'timeout'
}

export interface Mission {
  id: string;
  objective: string;
  mode: MissionMode;
  state: MissionState;
  approvers: string[];
  cost_limit_usd?: number;
  total_cost_usd: number;
  tags: string[];
  tasks: TaskDefinition[];
  created_at: string;
  completed_at?: string;
}

export interface TaskDefinition {
  id: string;
  mission_id: string;
  name: string;
  description: string;
  status: TaskStatus;
  created_at: string;
  approved_at?: string;
  executed_at?: string;
}

export interface ApprovalRecord {
  id: string;
  task_id: string;
  approver_id: string;
  approved: boolean;
  reason?: string;
  approved_at: string;
}

export interface ExecutionResult {
  id: string;
  task_id: string;
  status: ExecutionStatus;
  output?: string;
  error?: string;
  cost_usd: number;
  duration_seconds: number;
  completed_at: string;
}

export interface AbacPolicy {
  allowed_tools: string[];
  forbidden_params: string[];
}

export interface CreateMissionRequest {
  objective: string;
  mode: MissionMode;
  approvers: string[];
  cost_limit_usd?: number;
  tags?: string[];
  abac_policy?: AbacPolicy;
}

export interface ApprovalRequest {
  approved: boolean;
  reason?: string;
  approver_id: string;
}
