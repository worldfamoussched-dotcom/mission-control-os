# SPEC — Phase 3 — Wakanda Mode

**Status:** Draft (Mission Architect, 2026-04-24)
**For:** ATS / All the Smoke label workflows
**Mode contract:** Selective approval — some tasks gate, some pass through

---

## Why Wakanda exists

Batman is too slow for label work — you can't approve every metadata edit. Jarvis is too loose — you can't auto-publish a release without sign-off. Wakanda is the middle: **gate the irreversible, pass through the reversible.**

ATS workflows split cleanly along that axis. Releases, contracts, payments, public posts — gate. Tagging, scheduling drafts, internal coordination, search — pass through.

---

## The selective-approval rule

A Wakanda task fires the approval gate **iff** at least one of these is true:

1. **Public-facing** — the action is visible to the audience (post, release, announcement, ad)
2. **Contractual / financial** — money moves, rights change, agreement signs
3. **Irreversible at the artist level** — the artist or label can't easily undo it (publishing a track, sending a press email, taking down a release)
4. **Cross-artist or cross-label** — the action touches another artist's catalog or another label's work
5. **Tagged `gate=true`** in the task definition (manual override, operator can force gate)

If none of those are true → pass-through (run like Jarvis).

This is a **task-level decision**, not a mission-level one. A single Wakanda mission can have 5 pass-through tasks and 1 gated task. Gated tasks pause; pass-through tasks run immediately. The mission completes when all tasks are either done or rejected.

---

## How the gate gets decided

Three decision sources, in priority order:

### 1. Manual override on the task
DecomposerAgent (or operator) can stamp a task with `requires_approval: true` (or `false`) and that's final. No further check.

### 2. Tool category + risk level
The tool registry already has a `requires_approval` flag per tool. Combined with `risk_level` from the decomposer:

| Tool category | risk_level | Default gate |
|---|---|---|
| `publish_*` (release_track, post_social, send_email) | any | **gate** |
| `payment_*` / `contract_*` | any | **gate** |
| `read_*` / `search_*` / `summarize_*` | low | pass |
| `write_internal_*` / `tag_*` / `schedule_draft_*` | low | pass |
| anything | high | **gate** |
| anything | medium | depends on tool category (gate by default for safety) |

### 3. Mission-level ABAC override
The mission's `abac_policy` can include a `wakanda_gate_overrides` list:
```json
{
  "wakanda_gate_overrides": {
    "always_gate": ["release_track", "send_email"],
    "always_pass": ["search_knowledge", "read_file"]
  }
}
```
This wins over (2) but loses to (1).

---

## Lifecycle

```
POST /missions { mode: "wakanda", ... }
  → decompose
  → for each task: classify gated vs pass-through
  → return mission with task list + per-task gate flag
operator sees:
  - gated tasks in approval queue (TaskApprovalCard, like Batman)
  - pass-through tasks already executing (ExecutionLog, like Jarvis)
operator approves/rejects gated tasks one by one
  → on approve: task runs (review → execute → audit)
  → on reject: task marked rejected, mission continues
when all tasks resolved (completed | review_blocked | rejected):
  mission goes to `completed` (if any task succeeded) or `failed` (if none did)
```

---

## API shape

```
POST /missions/{id}/run-wakanda
  Single endpoint that:
  1. Decomposes
  2. Classifies each task
  3. Executes pass-through tasks immediately
  4. Returns { tasks: [...], gated_task_ids: [...], pass_through_results: [...] }

POST /missions/{id}/tasks/{tid}/approve
  Reuses Batman's existing endpoint. Approving a gated Wakanda task
  triggers its individual review→execute path.
```

This means Wakanda reuses:
- Batman's `/approve` endpoint (no new approval API)
- Jarvis's review/execute machinery (no new executor)
- The cockpit's existing ReviewPanel + AlertsPanel
- Audit + cost services

The only new thing is the **classifier**.

---

## What I need from Nick before coding

Six questions. Skim them and answer in any form (numbers, prose, "use my judgment"):

1. **What tools does ATS need that don't exist yet?** Right now the registry has `read_file`, `write_file`, `search_knowledge`, `call_api`, `execute_script`. For label work we probably need things like `publish_release`, `update_metadata`, `schedule_post`, `send_press_email`. What's the actual day-to-day list?

2. **Who's the operator for ATS missions?** You? Hotboxx? Both? (Affects whether `approver_id` defaults need to handle multiple people.)

3. **What's the strictest possible default if I get it wrong?** Erring toward "gate everything" is safe but slow. Erring toward "pass everything" is fast but risky. For ATS in particular, which side do you want me to err toward when I'm unsure?

4. **Should rejected tasks pause the rest of the mission?** Two options: (a) reject one task → other pass-through tasks keep running (current draft); (b) reject one task → halt mission. ATS workflow probably wants (a) but I want to check.

5. **Cross-artist tasks** — if a Wakanda mission touches a track that has a featured artist (e.g., London X on a Hotboxx release), do *both* of you need to approve, or just the operator?

6. **Anything I'm completely missing?** Domain details about how ATS actually runs that would change the design.

---

## Conservative defaults locked in (2026-04-24)

Nick chose to ship Wakanda with conservative defaults rather than block on Q&A. **All six are revisitable** — these are defaults, not contracts.

| Q | Default | Tighten when |
|---|---|---|
| 1. ATS-specific tools | None added — use existing registry. Unknown tool → gate. | Real ATS workflow surfaces concrete tool needs |
| 2. Operator identity | Single string `"operator"`, same as Batman | Multi-approver work in Phase 4 |
| 3. Default-when-unsure | **GATE** (unknown category, unknown risk, missing fields → require approval) | Stays as-is; this is the right safety posture for label work |
| 4. Reject behavior | Other pass-through tasks keep running; rejected task marked rejected; mission = `partial` | Stays as-is unless ATS workflow proves otherwise |
| 5. Cross-artist tasks | Treated as gated. Single operator approval is sufficient. | Multi-approver chain in Phase 4 |
| 6. Coverage gaps | Real ATS tool registry, multi-approver chain, cancellation/rollback — all deferred | Each becomes its own follow-up |

---

## Out of scope for this spec

- **Wakanda cockpit UI** — separate task. Probably a unified cockpit that shows both gated queue + executing log, with a mode header.
- **Mode-switching** between Batman/Jarvis/Wakanda missions in the same UI session — separate task.
- **Wakanda-specific tool registry entries** — depends on Q1 above.

---

## Underlying Structure

Wakanda gate predicate `G(task) = manual_override(task) ∨ (¬manual_pass ∧ (tool_category(task) ∈ HIGH ∨ risk_level(task) = high ∨ abac_override_gate(task)))`. This is a Boolean combination of three independent inputs (manual flag, tool taxonomy, ABAC policy) ranked by priority. Equivalent to a 3-level decision tree where higher levels short-circuit lower ones — the same structure used by HTTP middleware chains and ACL evaluation in Postgres. Mode partition: Batman = `∀ task. G(task) = true`, Jarvis = `∀ task. G(task) = false`, Wakanda = mixed. The mode → predicate mapping makes Wakanda a strict generalization of the other two: setting all overrides to `always_gate` reduces to Batman, setting all to `always_pass` reduces to Jarvis.
