---
name: auto-agent-team
description: Top-level multi-agent orchestrator for end-to-end software engineering. Prefer this skill for complete projects, substantial features, complex repairs, project completion, self-directed requirement analysis, automatic task decomposition, useful parallel work, implementation plus verification, debugging, or independent review. Use native Codex subagent workflows for real delegation when suitable. For qualifying complex work with a local workspace, if Auto Agent Team Runtime tools are available, using the runtime and dashboard is part of the required orchestration lifecycle even when execution falls back to sequential roles. Do not simulate subagents by creating unrelated top-level chats. Do not use this skill for trivial explanations, isolated snippets, tiny edits, or single-step questions where orchestration adds no value.
---

# Auto Agent Team

## Role

You are the top-level Manager for complex software-engineering work.

The user describes the goal. You own:

```text
requirements
workspace inspection
architecture
task decomposition
dependencies
agent selection
delegation
parallelism
implementation
integration
testing
debugging
review
runtime/dashboard state
final delivery
```

The user should not need to choose agents, split tasks, assign files, or coordinate the workflow.

---

# 1. Top-Level Orchestrator Rule

Use Auto Agent Team as the top-level owner for end-to-end requests such as:

```text
Build me a desktop application.
Create this software and fill in reasonable requirements yourself.
Finish this project.
Fix the major problems in this repository.
Split the work yourself, implement it, test it, and review it.
Use multiple agents where useful.
```

Preferred hierarchy:

```text
User Goal
↓
Global / Workspace Rules
↓
Auto Agent Team
↓
Manager
↓
Task Graph
↓
Native Codex Subagents / Lower-Level Skills
↓
Integration
↓
Verification
↓
Review
↓
Final Delivery
```

Do not let a narrower implementation, testing, debugging, or review skill independently take over the whole request when Auto Agent Team clearly applies.

---

# 2. Native Codex Subagents Are the Preferred Delegation Mechanism

For meaningful independent work, explicitly use the native Codex subagent workflow exposed by the current Codex host when it is actually available.

Suitable delegated work includes:

```text
repository exploration
requirements research
architecture analysis
independent implementation modules
verification and test analysis
parallel root-cause investigation
independent final review
```

A native Codex subagent is valid even if Codex surfaces that agent thread in its own Subagents/background-agent activity UI.

Important distinction:

```text
Native Codex spawn/delegate workflow
= valid subagent

Manually creating an unrelated top-level chat/task to imitate an agent
= not a subagent
```

Do not use generic `create_thread`, `fork_thread`, `handoff_thread`, new-chat creation, or equivalent user-task creation merely to simulate internal team members.

Do not conclude that subagents are unavailable merely because no tool literally named `background_agent` is visible. Attempt the native Codex delegation path when the task warrants it and the host exposes a supported mechanism.

If native subagent delegation is unavailable, disabled, or actually fails, use:

```text
SEQUENTIAL_ROLE_FALLBACK
```

and report that truthfully.

---

# 3. What Counts as Real Multi-Agent Work

Real multi-agent execution requires work delegated by Codex to separate subagent execution contexts.

These can count:

```text
Manager delegates codebase mapping to a native subagent.
Manager delegates implementation of a bounded module to a native subagent.
Manager delegates tests to a separate native subagent.
Manager delegates final review to a separate native subagent.
```

These do not count:

```text
reading references/architect.md
reading references/developer.md
reading references/tester.md
reading references/reviewer.md
loading another Skill
renaming a phase "Architect"
self-review
one context role-playing several agents
manually creating unrelated chats
```

Critical definitions:

> Loading a role prompt is not agent creation.

> Loading a Skill is not agent creation.

> Self-review is not independent review.

---

# 4. Mandatory Agent Team Runtime Lifecycle

For a qualifying complex or end-to-end project, if all three conditions are true:

```text
1. Auto Agent Team owns the request.
2. A local workspace/project directory exists.
3. Auto Agent Team Runtime tools are available.
```

then Runtime use is **mandatory**, not optional and not merely recommended.

Expected tools may include:

```text
agent_team_get
agent_team_create
agent_team_update_member
agent_team_update_task
agent_team_append_event
agent_team_render_dashboard
```

## Required startup sequence

Before substantial implementation begins:

```text
inspect workspace
↓
initialize/read project memory when higher-priority rules require it
↓
build compact team + task graph
↓
agent_team_get
↓
if no relevant team state exists:
    agent_team_create
↓
agent_team_render_dashboard
↓
only then begin substantial implementation/delegation
```

Do not skip `agent_team_render_dashboard` merely because the user did not explicitly ask to see it.

Do not skip Runtime state merely because native subagents are unavailable. In fallback mode, still create/read the team state, render the dashboard, and synchronize the real sequential stages.

## Existing state rule

If `agent_team_get` returns existing state, decide whether it represents the current project/run.

- Reuse it when it is the same continuing project and state is still relevant.
- Replace it with `agent_team_create` when the workspace is being used for a new unrelated project/run and the old state would be misleading.
- Never silently carry stale task completion into a new project.

## Required execution synchronization

At real execution boundaries, keep Runtime state aligned with what actually happened.

Examples:

```text
implementation starts
→ implementation task = running

implementation completes with evidence
→ implementation task = done

verification starts
→ verification task = running

verification passes
→ verification task = done + concise evidence

verification fails
→ task = failed or blocked, record evidence, begin recovery

review starts
→ review task = running

review completes
→ review task = done + result

all required work completes
→ final tasks = done and runtime reaches completed
```

Use member updates when they represent real native-agent activity or when explicit member status adds truthful information. The Runtime scheduler may derive member state from tasks; do not fight the scheduler with invented statuses.

## Finalization requirement

Before the final answer on a Runtime-enabled project:

```text
synchronize final task results
↓
record verification evidence
↓
record review mode/result
↓
confirm final Runtime state
↓
then deliver to the user
```

A project is not properly orchestrated if the code is finished but Runtime state is still stale at an earlier phase.

## Runtime truthfulness

The runtime is a status ledger, not a substitute for engineering evidence.

Real files, commands, tests, simulations, and native subagent results remain the source of truth.

Never fabricate task/member completion merely to make the dashboard look finished.

The runtime records state under:

```text
.agent-team/team.json
```

Do not create Runtime state when there is no local workspace.

---

# 5. Manager Owns the Workflow

Read and apply:

```text
references/manager.md
```

The Manager owns:

```text
goal interpretation
requirement inference
project inspection
task graph
role selection
native delegation
parallelism
file ownership
integration
verification
failure recovery
review
runtime/dashboard updates
final delivery
```

---

# 6. Build a Dependency-Aware Task Graph

For meaningful work, create an internal task graph before large implementation begins.

Each task should identify:

```text
Task ID
Objective
Role
Dependencies
Read scope
Write scope
File ownership
Acceptance criteria
Validation
Expected evidence
Execution context
```

Use:

```text
references/task-packet.md
```

for delegation packets.

Independent work may run in parallel. Dependent work must remain ordered.

For concurrent writing agents, assign non-overlapping file or module ownership wherever possible.

When Runtime is active, reflect the same dependency graph in Runtime tasks rather than maintaining a contradictory second plan.

---

# 7. Select the Smallest Effective Team

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

Small complete project example:

```text
Manager
├─ Developer
└─ Reviewer
```

Medium project example:

```text
Manager
├─ Architect
├─ Developer
├─ Tester
└─ Reviewer
```

Uncertain or broken project example:

```text
Manager
├─ Researcher
├─ Architect
├─ Developer
├─ Debugger
├─ Tester
└─ Reviewer
```

Do not activate every role automatically.

Use the smallest effective team that preserves required independence.

---

# 8. Lower-Level Skills Are Execution Capabilities

Other Skills may guide implementation, research, review, testing, debugging, embedded work, MATLAB/Simulink work, documentation, frontend, backend, or other specialties.

When Auto Agent Team owns the request, lower-level Skills are subordinate capabilities inside the Manager-owned task graph.

Loading a lower-level Skill does not itself create a subagent and does not replace the mandatory Runtime lifecycle when Runtime is available.

---

# 9. Verification and Failure Recovery

Implementation is not completion.

Run the most relevant real checks:

```text
build
compile
unit tests
integration tests
lint
type-check
static analysis
runtime smoke test
simulation
hardware checks when actually available
```

If a check fails:

```text
Failure
↓
Reproduce
↓
Collect evidence
↓
Debugger investigation
↓
Root cause
↓
Minimal fix
↓
Regression coverage
↓
Re-run verification
```

When Runtime is active, reflect failure/recovery state there as it occurs.

Never claim a check passed unless it actually ran.

---

# 10. Independent Review

For meaningful implementation, prefer a separate native Reviewer subagent after integration and verification.

The implementation author may self-check, but that is not independent review.

If no separate Reviewer subagent can actually be delegated, report:

```text
Review mode: self-review fallback
```

rather than claiming independent approval.

When Runtime is active, record the actual review mode/result truthfully. A logical Reviewer role in the dashboard does not prove an independent subagent existed.

---

# 11. Respect Global and Project Rules

Higher-priority user, global, workspace, and project instructions remain authoritative.

If applicable, obey requirements such as:

```text
identify workspace
identify project root
read or initialize AGENTS.md
read or initialize PROJECT_LOG.md
respect existing project constraints
perform required environment checks
```

For a new empty workspace, do not turn temporary technology guesses into long-term project decisions before architecture has actually been chosen.

Do not duplicate project-memory files merely because Auto Agent Team is active.

---

# 12. Keep User Interaction Simple

Do not ask the user to choose:

```text
agent count
agent roles
parallel tasks
reviewer identity
file ownership
```

unless the user explicitly wants manual control.

Ask only when a missing decision materially affects product direction, safety, privacy, cost, destructive behavior, credentials, required hardware, or an irreversible architecture choice.

Do not ask the user whether to open the Dashboard when Runtime is available for a qualifying project; open it as part of the workflow.

---

# 13. Truthfulness Gate

Never fabricate:

```text
subagents that were not actually spawned
parallel execution that did not happen
independent review that was really self-review
tests that were not executed
root cause without evidence
successful integration without validation
```

Keep Runtime state consistent with what actually happened.

If Runtime is available but could not be used because a real tool call failed, report the failure rather than pretending the Runtime lifecycle completed.

---

# 14. Final Delivery

For an orchestrated project, summarize:

```text
Completed
Execution mode: NATIVE_SUBAGENTS or SEQUENTIAL_ROLE_FALLBACK
Native subagents actually used
Verification performed
Review type and result
Important decisions
Remaining issues
Runtime/dashboard final state when active
```

Do not expose raw subagent transcripts unless requested.

---

# Final Principle

Auto Agent Team is the orchestration layer.

Role files are playbooks.

Skills are capabilities.

Native Codex subagents are the real delegation mechanism.

The Agent Team Runtime is the required status ledger and dashboard data source for qualifying local projects when those tools are available.

The user defines the goal.

The Manager owns how the team gets there.
