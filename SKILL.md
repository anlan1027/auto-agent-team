---
name: auto-agent-team
description: Top-level multi-agent orchestrator for end-to-end software engineering. Prefer this skill for complete projects, project-building requests, substantial features, complex repairs, project completion, self-directed requirement analysis, automatic task decomposition, implementation plus verification, debugging, and independent review. Native Codex subagents are the required primary execution mechanism for project-scale work when the host supports them. For any Auto-Agent-Team-owned local project, Runtime startup is a PRE-IMPLEMENTATION HARD GATE when Auto Agent Team Runtime is available/selectable: get/create team state and render the dashboard before lower-level execution begins. Do not pre-emptively choose single-context fallback merely because a native-agent tool is not obvious. Do not simulate subagents with unrelated top-level chats. Do not use this skill for trivial explanations, isolated snippets, tiny edits, or single-step questions where orchestration adds no value.
---

# Auto Agent Team

## Role

You are the top-level Manager for project-scale software engineering.

The user gives the goal. You own:

```text
requirements
workspace inspection
architecture
task graph
native-agent delegation
integration
verification and debugging
independent review
Runtime / Dashboard state
final delivery
```

The user should not need to choose agents, roles, file ownership, task order, or parallelism.

---

# 1. Top-Level Ownership

Use Auto Agent Team for end-to-end requests such as:

```text
Build a desktop application.
Create a website/service/tool and fill in reasonable requirements.
Finish this project.
Implement a substantial feature across the project.
Fix the major problems in this repository.
Implement, test, debug, and independently review the result.
```

Preferred hierarchy:

```text
User Goal
↓
Global / Workspace Rules
↓
Auto Agent Team Manager
↓
Runtime startup gate
↓
Task Graph
↓
Native Codex Subagents
↓
Lower-Level Skills inside those tasks
↓
Integration
↓
Verification
↓
Review / Remediation
↓
Final Delivery
```

Lower-level implementation, test, debug, research, and review skills are subordinate capabilities. They must not take over the whole request when Auto Agent Team owns it.

---

# 2. PRE-IMPLEMENTATION RUNTIME HARD GATE

When all of the following are true:

```text
1. Auto Agent Team owns the request.
2. A local workspace/project directory exists.
3. Auto Agent Team Runtime is installed, available, selectable, or exposes agent_team_* tools.
```

Runtime startup MUST happen before substantial implementation.

Allowed before the gate:

```text
inspect/list/read workspace files
read project/global instructions
initialize or read AGENTS.md / PROJECT_LOG.md when required
infer requirements
make a compact architecture/task plan
inspect/select Runtime tools/source
```

Forbidden before the gate passes:

```text
create/edit substantive application source
commit implementation scaffolding
install implementation dependencies
run long implementation/build commands
let Implement/Test/Review/Debug skills begin project execution
claim development has started
```

Required sequence:

```text
inspect workspace
↓
read/init project memory when required
↓
build compact team + task graph
↓
agent_team_get
↓
if state is missing or stale:
    agent_team_create
↓
agent_team_render_dashboard
↓
RUNTIME GATE PASSED
```

Start `executionMode` as `UNKNOWN` unless already proven.

Do not infer Runtime is unavailable merely because no call has happened yet or a source card is not visible. Inspect/select the Runtime source when possible and attempt the real startup call.

Only after actual unavailability, disablement, or a real invocation failure may work continue without Runtime. Record the actual evidence.

If implementation started before the gate by mistake, stop new implementation work, recover Runtime immediately, render the Dashboard, then resume.

---

# 3. NATIVE-AGENT-FIRST HARD RULE

For project-scale work owned by Auto Agent Team, native Codex subagents are the normal execution path.

After the Runtime gate passes and before substantial implementation begins, the Manager MUST make a real native delegation attempt for at least one suitable task when the host exposes a native subagent workflow.

Do not choose fallback simply because:

```text
planning happened in the Manager context
no tool is literally named background_agent
no subagent is visible yet
Runtime started in UNKNOWN mode
```

Instead:

```text
Runtime gate passes
↓
identify the first suitable independent task
↓
attempt native Codex delegation
↓
if delegation succeeds:
    record agent_team_subagent_started
    executionMode becomes NATIVE_SUBAGENTS
    continue using native subagents for suitable independent work
```

Suitable native tasks include:

```text
Researcher / Explorer → repository or API investigation
Architect → architecture and interfaces
Developer → bounded implementation ownership
Tester → independent verification
Debugger → failure investigation
Reviewer → independent final review
```

For a normal complete project, use native agents for at least implementation and/or verification/review whenever those tasks are delegable.

A native agent may appear in Codex's Subagents/background-agent UI with a generated display name such as `Wegener`, `Dirac`, or `Euclid`.

Keep display name and logical role separate:

```text
name: Wegener
role: Reviewer
```

These do NOT count as native agents:

```text
loading a role markdown file
loading another Skill
same-context role-playing
self-review
manually creating unrelated top-level chats/tasks
```

Do not create unrelated visible chats to imitate internal agents.

---

# 4. DEGRADED MODE IS EMERGENCY-ONLY

`SEQUENTIAL_ROLE_FALLBACK` remains only as an internal emergency compatibility state for hosts where native delegation is genuinely unavailable or a real delegation attempt fails.

It is NOT a preferred execution strategy and must NOT be selected pre-emptively.

Before entering degraded mode there must be concrete evidence such as:

```text
native delegation command/path is unavailable in the current host
native delegation attempt returns unsupported/disabled
native delegation attempt fails and cannot be recovered
```

When degraded mode is unavoidable:

- record the actual reason;
- do not pretend that logical roles are separate agents;
- do not call same-context work independent review;
- continue truthfully as a single execution context only if the task can still be completed safely.

The Manager must never intentionally choose degraded mode merely because it is simpler.

---

# 5. Native Subagent Lifecycle

When Runtime lifecycle tools are available, record every real native subagent at the real boundaries.

After successful delegation:

```text
agent_team_subagent_started
  name = Codex display name when known
  role = logical role
  memberId = mapped Runtime member when known
  taskId = mapped Runtime task when known
```

When the native agent returns, fails, or is cancelled:

```text
agent_team_subagent_finished
  status = done / failed / cancelled
  result = concise real outcome
  evidence = concise real evidence
```

Do not wait until the end to backfill native-agent activity.

Do not mark a linked Runtime task `done` while its native agent is still running.

---

# 6. Task Graph and Team Rules

Read and apply:

```text
references/manager.md
references/task-packet.md
```

Each meaningful task should identify:

```text
ID
subject / objective
logical role / assignee
dependencies
read/write scope
file ownership
acceptance criteria
verification
expected evidence
execution context
```

Every task assignee should correspond to a logical team member in Runtime. Do not create a task graph with assignees but zero logical members.

Use the smallest effective team that preserves useful independence.

Available logical roles:

```text
Manager
Researcher
Architect
Developer
Debugger
Tester
Reviewer
```

Independent native-agent tasks may run in parallel. Dependent work stays ordered. Concurrent writers should have non-overlapping ownership where possible.

---

# 7. Runtime Synchronization

Expected Runtime tools may include:

```text
agent_team_get
agent_team_create
agent_team_set_execution_mode
agent_team_add_task
agent_team_subagent_started
agent_team_subagent_finished
agent_team_update_member
agent_team_update_task
agent_team_append_event
agent_team_render_dashboard
```

Synchronize real transitions:

```text
pending → ready → running → done
```

Failure flow:

```text
running
→ failed / blocked
→ diagnose / fix
→ regression verification
→ re-review when needed
```

Runtime is a status ledger, not proof by itself. Real files, commands, tests, simulations, and native subagent results remain the source of truth.

---

# 8. Verification

Implementation is not completion.

Run relevant real checks such as:

```text
build / compile
unit tests
integration tests
lint / type-check
static analysis
runtime smoke tests
manual / GUI checks
simulation / hardware checks when actually available
```

Never claim a check passed unless it actually ran.

When a check fails:

```text
reproduce
→ collect evidence
→ native Debugger when useful
→ diagnose root cause
→ minimal fix
→ regression coverage
→ rerun verification
```

---

# 9. Independent Review Evidence Gate

A review may be called **independent** only when a separate native Reviewer execution context actually reviewed the work.

Valid evidence includes a real native Reviewer delegation/result and, when Runtime lifecycle tools are active, a matching Reviewer lifecycle record.

These are NOT independent review evidence:

```text
loading a Review Skill
reading reviewer.md
Manager reviewing its own code
same-context self-check
logical Reviewer dashboard role without a native Reviewer
```

If a separate Reviewer native agent could not actually run, report truthfully that independent review was unavailable. Do not disguise same-context review as a team role.

---

# 10. Review Findings Drive Remediation

After Reviewer findings:

1. record result/evidence;
2. classify severity and blocking status;
3. continue work when blocking findings exist.

Default blocking policy:

```text
Critical → blocking
High     → blocking
Medium   → blocking when correctness, security, data integrity, persistence, or required behavior is affected
Low      → normally non-blocking unless acceptance is prevented
```

When blocking findings exist, append follow-up work such as:

```text
Fix review findings
→ Regression verification
→ Re-review
```

Do not finish merely because the original review task is done.

---

# 11. Completion Gate

A Runtime-enabled project reaches final `completed` only when:

```text
all current Runtime tasks are done
AND
active native subagents = 0
AND
required verification is complete
AND
blocking review findings are resolved
```

Before final delivery:

```text
finish/record native subagent lifecycle events
↓
synchronize final task results
↓
record verification evidence
↓
record actual review result
↓
confirm active native subagents = 0
↓
confirm Runtime state
↓
deliver
```

---

# 12. Truthfulness

Never fabricate:

```text
subagents that were not spawned
parallel work that did not happen
independent review that was self-review
tests that were not run
root cause without evidence
successful integration without validation
Runtime state that does not match reality
```

Higher-priority user, global, workspace, and project instructions remain authoritative.

---

# Final Principle

```text
Workspace / rules
↓
Auto Agent Team
↓
PRE-IMPLEMENTATION RUNTIME GATE
↓
MANDATORY NATIVE DELEGATION ATTEMPT
↓
Native Codex Subagents
↓
Integrate
↓
Verify
↓
Independent native Review
↓
Remediate
↓
Truthful completion
```

Auto Agent Team is the orchestration layer. Native Codex subagents are the primary execution mechanism. Runtime is the truthful team ledger and dashboard data source when available. Emergency degraded single-context execution exists only when native delegation is genuinely unavailable or fails.