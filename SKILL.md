---
name: auto-agent-team
description: Top-level multi-agent orchestrator for end-to-end software engineering. Prefer this skill for complete projects, project-building requests, substantial features, complex repairs, project completion, self-directed requirement analysis, automatic task decomposition, implementation plus verification, debugging, or independent review. Use native Codex subagents for real delegation when suitable. For any Auto-Agent-Team-owned local project, if Auto Agent Team Runtime tools are available or selectable, Runtime startup is a PRE-IMPLEMENTATION HARD GATE: get/create team state and render the dashboard before lower-level execution skills begin implementation. Do not silently skip Runtime because tool handles are not yet in view. Do not simulate subagents with unrelated top-level chats. Do not use this skill for trivial explanations, isolated snippets, tiny edits, or single-step questions where orchestration adds no value.
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
agent selection and delegation
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
Native Codex Subagents / Lower-Level Skills
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

# 2. PRE-IMPLEMENTATION HARD GATE

This is the most important ordering rule.

When all of the following are true:

```text
1. Auto Agent Team owns the request.
2. A local workspace/project directory exists.
3. Auto Agent Team Runtime is installed, available, selectable, or its agent_team_* tools are exposed.
```

then Runtime startup MUST happen before substantial implementation.

## Allowed before the gate

```text
inspect/list/read workspace files
read global/workspace/project instructions
initialize or read AGENTS.md / PROJECT_LOG.md when required
infer requirements
make a compact architecture/task plan
check/select Runtime tools or source
```

## Forbidden before the gate passes

Do not start substantive project execution, including:

```text
creating or editing application source files
creating project scaffolding that commits the implementation
installing project dependencies for implementation
running long builds or implementation commands
letting Implement/Test/Review/Debug skills begin execution
claiming development has started
```

A lower-level Skill may be read for guidance, but it may not begin modifying or executing the project before this gate passes.

## Required Runtime startup sequence

```text
inspect workspace
↓
read/init project memory when required
↓
build compact team + task graph
↓
agent_team_get
↓
if state is missing or stale for a different project:
    agent_team_create
↓
agent_team_render_dashboard
↓
GATE PASSED
↓
only now begin implementation / delegation
```

Start `executionMode` as `UNKNOWN` unless the real mode is already proven.

Do not skip `agent_team_render_dashboard` because the user did not ask for it.

## Runtime availability rule

Do not infer that Runtime is unavailable merely because no `agent_team_*` call has been made yet, because the source panel is not visible, or because a tool is not literally named `background_agent`.

Before declaring Runtime unavailable:

1. inspect the tools/sources available to the current Codex task when possible;
2. select/use Auto Agent Team Runtime when the host exposes it as an available source/plugin;
3. attempt the normal Runtime startup call when `agent_team_*` tools are exposed.

Only after Runtime is actually unavailable, disabled, or a real invocation fails may execution continue without Runtime. State that truthfully as:

```text
Runtime gate: unavailable
Reason: <actual evidence>
```

Do not silently bypass the gate.

## Missed-gate recovery

If substantial implementation has already started and you realize the Runtime gate was skipped:

```text
STOP new implementation work
↓
initialize/recover Runtime immediately
↓
represent already-completed and remaining work truthfully
↓
render Dashboard
↓
resume execution
```

Do not wait until the final answer to backfill everything cosmetically.

---

# 3. Real Native Codex Subagents

For meaningful independent work, use the native Codex subagent workflow exposed by the host when available.

Suitable delegated work includes:

```text
repository exploration / research
architecture analysis
bounded implementation modules
verification / test analysis
root-cause investigation
independent final review
```

A native Codex subagent remains valid if Codex surfaces it in its own Subagents/background-agent UI.

These do NOT count as subagents:

```text
loading a role markdown file
loading another Skill
renaming a phase "Reviewer"
self-review
one context role-playing several agents
manually creating unrelated top-level chats/tasks
```

Do not use generic `create_thread`, `fork_thread`, `handoff_thread`, new-chat/new-task creation merely to imitate internal team members.

If native delegation is actually unavailable or fails, use `SEQUENTIAL_ROLE_FALLBACK` and say so truthfully.

---

# 4. Execution Mode and Native-Agent Lifecycle

There are exactly three execution modes:

```text
UNKNOWN
NATIVE_SUBAGENTS
SEQUENTIAL_ROLE_FALLBACK
```

Use them as evidence states.

- `UNKNOWN`: capability not yet proven.
- `NATIVE_SUBAGENTS`: at least one real native Codex subagent successfully delegated.
- `SEQUENTIAL_ROLE_FALLBACK`: native delegation genuinely unavailable/failed and one context must execute role phases sequentially.

When Runtime exposes lifecycle tools, record every real native subagent at real boundaries.

On successful delegation:

```text
agent_team_subagent_started
  name = Codex display name when known, e.g. Wegener
  role = logical role, e.g. Reviewer
  memberId = mapped Runtime member when known
  taskId = mapped Runtime task when known
```

This proves `NATIVE_SUBAGENTS`.

When the subagent returns, fails, or is cancelled:

```text
agent_team_subagent_finished
  status = done / failed / cancelled
  result = concise actual outcome
  evidence = concise actual evidence when useful
```

Keep Codex display name and logical role separate:

```text
name: Wegener
role: Reviewer
```

Do not mark a linked Runtime task done while its native subagent is still running.

---

# 5. Runtime Task Synchronization

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

Synchronize real state transitions, not cosmetic chatter.

Typical lifecycle:

```text
pending → ready → running → done
```

Failure lifecycle:

```text
running
→ failed / blocked
→ diagnose / fix
→ regression verification
→ re-review when needed
```

Examples:

```text
implementation starts → implementation task running
implementation finishes → task done + evidence
verification starts → verification task running
verification passes → task done + evidence
verification fails → failed/blocked + evidence + recovery
native Reviewer starts → agent_team_subagent_started
native Reviewer finishes → agent_team_subagent_finished
```

The Runtime is a status ledger, not proof by itself. Real files, commands, tests, simulations, and native subagent results remain the source of truth.

---

# 6. Task Graph and Team Selection

Read and apply:

```text
references/manager.md
references/task-packet.md
```

Each meaningful task should identify:

```text
ID
objective / subject
role / assignee
dependencies
read/write scope
file ownership
acceptance criteria
verification
expected evidence
execution context
```

Use the smallest effective team that preserves useful independence.

Available role playbooks:

```text
Manager
Researcher
Architect
Developer
Debugger
Tester
Reviewer
```

Independent work may run in parallel; dependent work must remain ordered. Give concurrent writers non-overlapping ownership when possible.

When Runtime is active, reflect the same graph in Runtime instead of maintaining a contradictory second plan.

---

# 7. Verification and Failure Recovery

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

Never claim a check passed unless it ran.

When a check fails:

```text
reproduce
→ collect evidence
→ diagnose root cause
→ minimal fix
→ regression coverage
→ rerun verification
```

Reflect the real failure/recovery state in Runtime when active.

---

# 8. Independent Review Evidence Gate

Independent review is a quality gate, not wording.

A review may be called **independent** only when there is evidence that a separate native Reviewer execution context actually reviewed the work.

Valid evidence includes:

```text
a real native Reviewer subagent delegation/result
and, when Runtime lifecycle tools are active,
a matching Reviewer agent_team_subagent_started / agent_team_subagent_finished record
```

The following are NOT independent review evidence:

```text
loading a Review Skill
reading references/reviewer.md
Manager reviewing its own code
same-context self-check
calling a logical dashboard member "Reviewer"
```

If no separate Reviewer subagent actually ran, report exactly the truth:

```text
Review mode: self-review fallback
```

Do not write "independent review", "independently reviewed", or equivalent language without real separate-context evidence.

If Runtime is active and a real Reviewer ran, record its display name, logical Reviewer role, linked review task, result, and evidence.

---

# 9. Review Findings Must Drive Remediation

After a real Reviewer returns findings:

1. record the review result/evidence;
2. classify severity and blocking status;
3. continue work when blocking findings exist.

Default blocking policy:

```text
Critical → blocking
High     → blocking
Medium   → blocking when it affects correctness, security, data integrity, persistence, or required behavior
Low      → normally non-blocking unless it prevents acceptance
```

When blocking findings exist, do not finish merely because the original review task is `done`.

Use `agent_team_add_task` to append follow-up work such as:

```text
Fix review findings
→ Regression verification
→ Re-review
```

Use real next task IDs. Preserve completed history.

---

# 10. Completion Gate

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

Before the final answer:

```text
finish/record native subagent lifecycle events
↓
synchronize final task results
↓
record verification evidence
↓
record actual review mode/result
↓
confirm active native subagents = 0
↓
confirm Runtime state
↓
deliver
```

Do not leave a member `working` after true completion.

---

# 11. Respect Global and Project Rules

Higher-priority user, global, workspace, and project instructions remain authoritative.

When applicable:

```text
identify project root
read/init AGENTS.md
read/init PROJECT_LOG.md
respect existing constraints
perform required environment checks
```

For a new empty workspace, do not write temporary technology guesses into long-term memory as confirmed decisions before architecture is actually selected.

---

# 12. User Interaction and Truthfulness

Do not ask the user to choose agent count, roles, task split, parallelism, reviewer identity, or file ownership unless they explicitly want manual control.

Ask only when a missing decision materially affects product direction, safety, privacy, cost, credentials, hardware, destructive behavior, or an irreversible choice.

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

---

# 13. Final Delivery

For an orchestrated project, summarize concisely:

```text
what was completed
execution mode
native subagents actually used
verification performed
review type/result
blocking findings and remediation
remaining issues
Runtime/Dashboard final state when active
```

Do not expose raw subagent transcripts unless requested.

---

# Final Principle

```text
Workspace / rules
↓
Auto Agent Team
↓
PRE-IMPLEMENTATION RUNTIME GATE
↓
Manager + task graph
↓
Native subagents / lower-level skills
↓
Verify
↓
Review
↓
Remediate
↓
Truthful completion
```

Auto Agent Team is the orchestration layer. Native Codex subagents are the real delegation mechanism. Runtime is the truthful project-team ledger and dashboard data source when available. The Manager owns the path from the user's goal to verified delivery.
