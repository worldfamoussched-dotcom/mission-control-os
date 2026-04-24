-- Mission Control OS — Postgres Schema
-- Spec sections 1-2: Mission Object, Audit Logs, Approval Records

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Missions table — core unit of work
-- ============================================================================
CREATE TABLE missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL,

    mode TEXT NOT NULL CHECK (mode IN ('batman', 'jarvis', 'wakanda')),
    state TEXT NOT NULL DEFAULT 'created' CHECK (
        state IN ('created', 'pending', 'approved', 'executing', 'completed', 'failed', 'cancelled')
    ),
    objective TEXT NOT NULL,

    memory_scope TEXT NOT NULL DEFAULT 'isolated' CHECK (
        memory_scope IN ('isolated', 'shared', 'global')
    ),
    cost_tracking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    estimated_cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0.0,
    actual_cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0.0,

    max_iterations INT NOT NULL DEFAULT 10,

    tags TEXT[] NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT positive_estimated_cost CHECK (estimated_cost_usd >= 0),
    CONSTRAINT positive_actual_cost CHECK (actual_cost_usd >= 0)
);

CREATE INDEX idx_missions_created_by ON missions(created_by);
CREATE INDEX idx_missions_mode_state ON missions(mode, state);
CREATE INDEX idx_missions_parent_id ON missions(parent_id);

-- ============================================================================
-- Mission Approvers — list of users who can approve a mission
-- ============================================================================
CREATE TABLE mission_approvers (
    id SERIAL PRIMARY KEY,
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    approver_id TEXT NOT NULL,

    UNIQUE(mission_id, approver_id)
);

CREATE INDEX idx_mission_approvers_mission_id ON mission_approvers(mission_id);

-- ============================================================================
-- Mission Allowed Tools — list of tools a mission can invoke
-- ============================================================================
CREATE TABLE mission_allowed_tools (
    id SERIAL PRIMARY KEY,
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,

    UNIQUE(mission_id, tool_name)
);

CREATE INDEX idx_mission_allowed_tools_mission_id ON mission_allowed_tools(mission_id);

-- ============================================================================
-- Approval Records — immutable approval decisions
-- ============================================================================
CREATE TABLE approval_records (
    id SERIAL PRIMARY KEY,
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    approver_id TEXT NOT NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
    reason TEXT,

    CONSTRAINT unique_mission_approver UNIQUE(mission_id, approver_id)
);

CREATE INDEX idx_approval_records_mission_id ON approval_records(mission_id);
CREATE INDEX idx_approval_records_approver_id ON approval_records(approver_id);

-- ============================================================================
-- Audit Log — immutable, append-only event trail
-- ============================================================================
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type TEXT NOT NULL,
    actor TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0.0,

    CONSTRAINT positive_cost CHECK (cost_usd >= 0)
);

-- Immutability enforced at application layer; this table is append-only
CREATE INDEX idx_audit_log_mission_id ON audit_log(mission_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_event_type ON audit_log(event_type);

-- ============================================================================
-- Tool Definitions — what tools are available
-- ============================================================================
CREATE TABLE tool_definitions (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    requires_cost_tracking BOOLEAN NOT NULL DEFAULT TRUE,
    max_cost_per_invocation_usd DECIMAL(10, 4) NOT NULL DEFAULT 10.0,
    allowed_modes TEXT[] NOT NULL DEFAULT ARRAY['batman', 'jarvis', 'wakanda']
);

CREATE INDEX idx_tool_definitions_name ON tool_definitions(name);

-- ============================================================================
-- ABAC Policies — role-based access control
-- ============================================================================
CREATE TABLE abac_policies (
    id SERIAL PRIMARY KEY,
    actor_roles TEXT[] NOT NULL,
    tool_name TEXT NOT NULL REFERENCES tool_definitions(name) ON DELETE CASCADE,
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    allowed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_abac_policies_tool_name ON abac_policies(tool_name);
CREATE INDEX idx_abac_policies_mission_id ON abac_policies(mission_id);
