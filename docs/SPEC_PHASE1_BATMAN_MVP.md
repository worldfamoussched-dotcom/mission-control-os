# Spec: Phase 1 — Batman Mode MVP

## Objective

Build the first executable slice of Mission Control OS: a FastAPI backend + React frontend that implements the **Batman approval workflow** — where an operator manually approves every action before it executes.

**User:** Mission operator (Nick or team member) running agents through the cockpit.

**Success looks like:**
- Operator creates a mission with an objective
- LangGraph agents decompose the objective into sub-tasks
- Each sub-task is presented to the operator for approval
- Operator approves/rejects each task
- Tool executes only after approval
- Full audit trail and cost tracking visible in real-time

**Acceptance:** Operator can create, approve, and execute a 3-step mission end-to-end with full visibility.

---

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Backend** | FastAPI | 0.104+ |
| **Agent Orchestration** | LangGraph | 0.1.0+ |
| **LLM** | Claude (via Anthropic SDK) | Latest |
| **Frontend** | React + Next.js | 14+ |
| **Styling** | Tailwind CSS | 3.4+ |
| **Database** | PostgreSQL | 14+ (from Phase 0) |
| **ORM** | SQLAlchemy | 2.0+ |
| **Testing** | pytest (backend), Jest/Vitest (frontend) | Latest |

---

## Commands

```bash
# Backend
python -m pip install -r requirements.txt
python -m pytest tests/unit tests/integration -v --cov=backend
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Frontend
npm install
npm run dev          # Next.js dev server (localhost:3000)
npm run build        # Production build
npm run test         # Jest/Vitest
npm run lint         # ESLint + Prettier

# Full stack
docker-compose up    # Backend + Frontend + Postgres (future)

# Database
alembic upgrade head # Run migrations
alembic downgrade -1 # Rollback
```

---

## Project Structure

```
backend/
├── main.py                    # FastAPI app setup
├── models/
│   ├── mission.py            # Mission, MissionState, ApprovalRecord (from Phase 0)
│   ├── task.py               # TaskDefinition, TaskExecution
│   └── execution.py          # ExecutionLog, ExecutionResult
├── api/
│   ├── routes.py             # /missions, /tasks, /approvals, /execute
│   └── schemas.py            # Pydantic request/response schemas
├── agents/
│   ├── decomposer.py         # LangGraph: break objective into tasks
│   ├── executor.py           # LangGraph: execute approved tasks
│   └── supervisor.py         # LangGraph: overall orchestration graph
├── db/
│   ├── session.py            # SQLAlchemy session factory
│   ├── models.py             # ORM models (missions, tasks, executions)
│   └── migrations/           # Alembic migrations
├── services/
│   ├── mission_service.py    # Mission CRUD + approval logic
│   ├── tool_service.py       # Tool registry lookup + constraints
│   └── execution_service.py  # Cost tracking + audit logging
└── tests/
    ├── unit/
    │   ├── test_mission_service.py
    │   ├── test_agents.py
    │   └── test_api_routes.py
    └── integration/
        └── test_batman_workflow.py

ui/
├── components/
│   ├── MissionForm.tsx       # Create mission
│   ├── TaskApprovalCard.tsx  # Approve/reject UI
│   ├── ExecutionLog.tsx      # Real-time execution trace
│   └── CostTracker.tsx       # Cost accumulation display
├── pages/
│   ├── dashboard.tsx         # Main cockpit
│   ├── mission/[id].tsx      # Mission detail + approval flow
│   └── api/webhooks.ts       # Backend → Frontend updates (WebSocket)
├── lib/
│   ├── api.ts                # Fetch wrapper for backend
│   ├── hooks.ts              # React hooks (useApproval, useExecution)
│   └── types.ts              # TypeScript interfaces
└── tests/
    ├── components/           # Component tests
    └── integration/          # E2E tests

db/
├── schema.sql                # Updated schema (Phase 0 + tasks/executions)
└── migrations/               # Alembic migration files

docs/
├── SPEC_PHASE1_BATMAN_MVP.md (this file)
├── API_REFERENCE.md          # Endpoint documentation
└── AGENT_ARCHITECTURE.md     # LangGraph graph explanation
```

---

## Code Style

### Python (Backend)

**Immutability & Pydantic:**
```python
# CORRECT: Immutable data models, no mutations
from pydantic import BaseModel, Field

class MissionApproval(BaseModel):
    mission_id: str
    approver_id: str
    approved_at: datetime
    tasks_approved: list[str]

# CORRECT: Service layer returns new objects, never mutates
def approve_task(task_id: str, approver_id: str) -> TaskExecution:
    existing = db.get_task(task_id)
    # Create new object with updated state, don't mutate existing
    updated = existing.model_copy(update={
        'status': 'APPROVED',
        'approved_by': approver_id,
        'approved_at': datetime.now(timezone.utc)
    })
    db.save(updated)
    return updated

# WRONG: In-place mutation
existing.status = 'APPROVED'
existing.approved_by = approver_id
db.save(existing)
```

**Error Handling:**
```python
# CORRECT: Explicit error handling with context
from fastapi import HTTPException

@app.post('/missions/{mission_id}/approve')
async def approve_mission(mission_id: str, approval: ApprovalRequest):
    try:
        mission = db.get_mission(mission_id)
        if not mission:
            raise HTTPException(status_code=404, detail='Mission not found')
        if mission.mode != MissionMode.BATMAN:
            raise HTTPException(status_code=400, detail='Only BATMAN mode supports approval')

        # Perform approval...
        result = mission_service.approve(mission_id, approval)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
```

**FastAPI Routes:**
```python
# CORRECT: Clear, RESTful endpoints with type hints
@router.post('/missions', response_model=MissionResponse)
async def create_mission(req: CreateMissionRequest) -> MissionResponse:
    """Create a new mission in BATMAN mode."""
    mission = await mission_service.create(req)
    return MissionResponse.from_orm(mission)

@router.post('/missions/{mission_id}/tasks/{task_id}/approve', response_model=ApprovalResponse)
async def approve_task(mission_id: str, task_id: str, approval: ApprovalRequest) -> ApprovalResponse:
    """Approve a task within a mission."""
    result = await mission_service.approve_task(mission_id, task_id, approval)
    return ApprovalResponse.from_orm(result)
```

### TypeScript / React (Frontend)

**Component Structure:**
```tsx
// CORRECT: Small, focused components with clear props
interface TaskApprovalCardProps {
  task: TaskDefinition;
  onApprove: (taskId: string) => Promise<void>;
  onReject: (taskId: string, reason: string) => Promise<void>;
  isLoading: boolean;
}

export function TaskApprovalCard({
  task,
  onApprove,
  onReject,
  isLoading
}: TaskApprovalCardProps) {
  const [rejectionReason, setRejectionReason] = useState('');

  return (
    <div className="border rounded p-4 bg-white">
      <h3 className="text-lg font-semibold">{task.name}</h3>
      <p className="text-gray-600 mt-2">{task.description}</p>
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => onApprove(task.id)}
          disabled={isLoading}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Approve
        </button>
        <button
          onClick={() => onReject(task.id, rejectionReason)}
          disabled={isLoading}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
```

**Hooks (API calls):**
```tsx
// CORRECT: Custom hooks encapsulate API logic
export function useApproval() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = useCallback(async (missionId: string, taskId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/missions/${missionId}/tasks/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true })
      });
      if (!response.ok) throw new Error(response.statusText);
      return await response.json();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { approve, isLoading, error };
}
```

---

## Testing Strategy

### Backend (pytest)

**Test Levels:**
1. **Unit Tests** — Individual functions, services, models in isolation
2. **Integration Tests** — Full workflow (mission creation → approval → execution)
3. **Agent Tests** — LangGraph graph structure and state transitions

**Coverage Target:** 80%+ (enforced by CI)

**Test Organization:**
```
tests/
├── unit/
│   ├── test_mission_model.py          # Pydantic model validation
│   ├── test_mission_service.py        # Service logic (approval, cost tracking)
│   ├── test_tool_service.py           # Tool registry constraints
│   ├── test_agents.py                 # Agent decomposer/executor logic
│   └── test_api_routes.py             # FastAPI endpoint behavior
└── integration/
    ├── test_batman_workflow.py        # Full mission lifecycle
    └── test_agent_execution.py        # End-to-end agent run
```

**Example Unit Test:**
```python
def test_batman_mode_requires_approval():
    """Batman mode tasks should not execute until approved."""
    mission = Mission(
        id='m1',
        mode=MissionMode.BATMAN,
        objective='Deploy service',
        approvers=['ops@example.com'],
        state=MissionState.PENDING_APPROVAL,
    )

    task = TaskDefinition(
        id='t1',
        mission_id='m1',
        name='Deploy',
        status=TaskStatus.PENDING_APPROVAL
    )

    # Task should NOT execute without approval
    with pytest.raises(PermissionError):
        execution_service.execute_task(task, no_approval=True)

    # Task SHOULD execute after approval
    approval = ApprovalRecord(
        task_id='t1',
        approver_id='ops@example.com',
        approved_at=datetime.now(timezone.utc)
    )
    mission_service.approve_task('m1', 't1', approval)

    result = execution_service.execute_task(task)
    assert result.status == ExecutionStatus.SUCCESS
```

**Example Integration Test:**
```python
@pytest.mark.asyncio
async def test_full_batman_workflow():
    """Create mission → decompose → approve all → execute."""
    # 1. Create mission
    mission = await mission_service.create(CreateMissionRequest(
        objective='Summarize three documents',
        mode=MissionMode.BATMAN,
        approvers=['operator@example.com']
    ))
    assert mission.state == MissionState.PENDING_APPROVAL

    # 2. Decompose into tasks (via agent)
    tasks = await decomposer_agent.run(mission)
    assert len(tasks) == 3

    # 3. Approve each task
    for task in tasks:
        approval = ApprovalRecord(
            task_id=task.id,
            approver_id='operator@example.com',
            approved_at=datetime.now(timezone.utc)
        )
        await mission_service.approve_task(mission.id, task.id, approval)

    # 4. Execute all tasks
    results = await executor_agent.run(mission)
    assert all(r.status == ExecutionStatus.SUCCESS for r in results)

    # 5. Verify cost tracking
    final_mission = await mission_service.get(mission.id)
    assert final_mission.total_cost > 0
    assert len(final_mission.audit_log) >= 6  # Create + 3 approvals + 3 executions
```

### Frontend (Jest/Vitest)

**Test Levels:**
1. **Component Tests** — UI behavior in isolation
2. **Hook Tests** — Custom React hooks
3. **Integration Tests** — Full user flow in the browser

**Coverage Target:** 75%+ for UI components

**Example Component Test:**
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskApprovalCard } from '@/components/TaskApprovalCard';

describe('TaskApprovalCard', () => {
  it('calls onApprove when Approve button is clicked', async () => {
    const mockApprove = jest.fn();
    const task = {
      id: 't1',
      name: 'Deploy Service',
      description: 'Deploy to production',
      status: 'PENDING_APPROVAL'
    };

    render(
      <TaskApprovalCard
        task={task}
        onApprove={mockApprove}
        onReject={jest.fn()}
        isLoading={false}
      />
    );

    const approveButton = screen.getByRole('button', { name: /Approve/i });
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(mockApprove).toHaveBeenCalledWith('t1');
    });
  });
});
```

---

## Boundaries

### Always Do:
- Run full test suite before committing
- Follow naming conventions (snake_case Python, camelCase TS/JS)
- Validate all user input at API boundaries
- Log errors with full context (mission_id, task_id, user_id)
- Update audit trail on every state change
- Track costs accurately (accumulate at mission level)

### Ask First:
- Database schema changes (adds new tables/columns)
- Adding new dependencies (pip install, npm install)
- Changing API contract (adding/removing endpoints)
- Switching to a different LLM provider
- Modifying LangGraph agent structure

### Never:
- Commit secrets, API keys, or credentials
- Edit database records directly without going through service layer
- Skip approval gates in BATMAN mode (even for testing)
- Remove or bypass audit logging
- Hardcode cost values (always fetch from config/tool registry)

---

## Success Criteria

### Functional

- [ ] Operator creates a mission with objective + approvers
- [ ] System decomposes mission into 3+ sub-tasks via LangGraph agent
- [ ] Each sub-task is presented to operator with full details
- [ ] Operator can approve or reject each task (with optional reason)
- [ ] Tool executes ONLY after explicit approval
- [ ] Real-time execution log visible to operator (stdout, tool results, cost)
- [ ] Final mission state shows COMPLETED with full audit trail
- [ ] Cost accumulation visible and correct

### Non-Functional

- [ ] All 16+ unit tests passing
- [ ] Integration tests cover full Batman workflow
- [ ] Code coverage ≥80% for backend, ≥75% for UI
- [ ] API response time <500ms for approval endpoints
- [ ] Frontend loads in <2.5s on 4G
- [ ] No console errors or warnings in browser
- [ ] All linting passes (Python: pylint/black, TS: ESLint/Prettier)

### Deployment

- [ ] Migrations run cleanly on fresh Postgres
- [ ] Environment variables documented (.env.example)
- [ ] Docker setup works (docker-compose up)
- [ ] README with setup instructions

---

## Open Questions

1. **WebSocket vs Polling for real-time updates?**
   - Option A: WebSocket (lower latency, more complex)
   - Option B: Polling every 2s (simpler, slightly higher latency)
   → **Recommendation:** Start with polling; upgrade to WebSocket in Phase 2 if needed.

2. **Single approver or multiple?**
   - Batman MVP supports multiple approvers in the mission config, but does approval require ALL to approve, or ANY?
   → **Recommendation:** ANY approver can approve (simpler logic for MVP).

3. **LLM cost tracking — real or estimated?**
   - Do we call the Anthropic API to get actual usage, or estimate based on model + token count?
   → **Recommendation:** Estimate based on tool registry (simpler); real tracking in Phase 2.

4. **Agent concurrency — sequential or parallel task execution?**
   - Can multiple tasks execute in parallel, or must they be sequential?
   → **Recommendation:** Sequential for MVP (simpler state management); parallel in Phase 2.

---

## Reference

- **Phase 0 Spec:** `/docs/SPEC_PHASE0_FOUNDATION.md` (Mission model, Tool Registry, ABAC)
- **API Design Skill:** `agent-skills:api-and-interface-design`
- **Frontend Patterns:** `vercel:nextjs` + `vercel:react-best-practices`
- **Agent Orchestration:** LangGraph documentation (langgraph.com)

