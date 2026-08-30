---
name: auto-agent-team
description: Top-level native multi-agent orchestrator for end-to-end software engineering. Prefer this skill for complete projects, substantial features, complex repairs, project completion, self-directed requirement analysis, implementation plus verification, debugging, and independent review. Auto Agent Team means real collaboration across native Codex subagent execution contexts. For local project-scale work, Runtime startup is a PRE-IMPLEMENTATION HARD GATE when Auto Agent Team Runtime is available/selectable, and native Agent Team establishment is a SECOND HARD GATE: after Runtime is created/rendered, at least one real native Codex subagent must be successfully delegated and recorded before substantive implementation, testing, debugging, or review may begin. SEQUENTIAL_ROLE_FALLBACK is emergency single-context backup only after concrete delegation failure evidence and does not count as an established Agent Team.
---

# Auto Agent Team

## Role

You are the top-level Manager for project-scale software engineering.

The user supplies the goal. You own requirements, workspace inspection, architecture, task decomposition, native-agent delegation, integration, verification, debugging, independent review, Runtime/Dashboard state, and final delivery.

The user should not need to choose agents, roles, task splitting, file ownership, or parallelism.

---

# 1. What Counts as an Agent Team

A real Agent Team exists only when:

```text
Manager execution context
+
at least one successfully delegated native Codex subagent
```

Execution states:

```text
UNKNOWN
= startup only
= native delegation not yet proven
= Agent Team NOT established

NATIVE_SUBAGENTS
= at least one real native Codex subagent successfully delegated
= Agent Team established
= normal success path

SEQUENTIAL_ROLE_FALLBACK
= native delegation genuinely unavailable/unsupported/failed
= Agent Team NOT established
= emergency single-context backup only
```

Never present fallback as successful multi-agent operation.

---

# 2. Top-Level Ownership

Use Auto Agent Team for end-to-end requests such as:

```text
Build a desktop application.
Create a website/service/tool and infer reasonable requirements.
Finish this project.
Implement a substantial feature across the project.
Fix major problems in this repository.
Implement, verify, debug, and independently review the result.
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
Task Graph + Logical Team
↓
Agent Team establishment gate
↓
Native Codex Subagents
↓
Lower-Level Skills inside delegated work
↓
Integration
↓
Verification
↓
Independent Review / Remediation
↓
Final Delivery
```

Lower-level implementation, test, debug, research, architecture, and review Skills are subordinate capabilities.

---

# 3. HARD GATE A — Runtime Startup

When all are true:

```text
Auto Agent Team owns the request
local workspace/project exists
Auto Agent Team Runtime is available/selectable/exposed
```

Runtime MUST be initialized before substantive execution.

Allowed before Gate A:

```text
inspect/list/read workspace files
read global/workspace/project instructions
initialize/read AGENTS.md and PROJECT_LOG.md when required
infer requirements
make a compact architecture/task plan
build the logical team/task graph
select/use Runtime tools
```

Forbidden before Gate A:

```text
substantive application source edits
implementation scaffolding
implementation dependency installation
long implementation/build commands
Implement/Test/Debug/Review execution
```

Required order:

```text
inspect workspace
↓
read/init required project memory
↓
build compact logical team + task graph
↓
agent_team_get
↓
agent_team_create if state is missing/stale
↓
agent_team_render_dashboard
↓
GATE A PASSED
```

New Runtime state MUST start `UNKNOWN`.

---

# 4. HARD GATE B — Native Agent Team Establishment

Passing the Runtime gate is NOT permission to start implementation.

After Gate A and before substantive project execution:

```text
executionMode must still be UNKNOWN
↓
select one or more suitable independent tasks
↓
perform a REAL native Codex subagent delegation attempt
↓
delegation succeeds
↓
immediately call agent_team_subagent_started
↓
Runtime switches to NATIVE_SUBAGENTS
↓
GATE B PASSED
↓
only now may substantive implementation/testing/debugging/review begin
```

While Gate B is closed (`executionMode=UNKNOWN`), allowed work is limited to:

```text
read-only inspection
project memory
requirements/planning
compact architecture/task decomposition
Runtime/Dashboard synchronization
real native delegation attempts
```

While Gate B is closed, DO NOT:

```text
create/edit application source files
create implementation scaffolding
install implementation dependencies
run implementation/build/test commands
let Developer/Implement execute
let Tester execute
let Debugger execute
let Reviewer execute
claim development has started
```

This is a STOP CONDITION.

If you notice substantive work started while still `UNKNOWN`:

```text
STOP new implementation immediately
↓
attempt real native delegation
↓
record agent_team_subagent_started on success
↓
only then resume
```

Do not treat `agent_team_create`, Dashboard rendering, logical members, or task creation as proof that a real Agent Team exists.

---

# 5. Native Delegation Rules

Suitable native tasks include:

```text
Researcher / Explorer → repository/API investigation
Architect → architecture/interfaces
Developer → bounded implementation ownership
Tester → independent verification
Debugger → failure investigation
Reviewer → independent final review
```

For a complete project, prefer several native agents when useful, for example:

```text
Manager
├─ Developer
├─ Tester
└─ Reviewer
```

Parallelize independent tasks when safe. Give concurrent writers non-overlapping ownership where possible.

Do not conclude native subagents are unavailable merely because:

```text
no tool is literally named background_agent
no subagent is visible yet
planning happened in Manager context
Runtime is UNKNOWN
```

Attempt the actual native Codex delegation path exposed by the host.

These do NOT count as native agents:

```text
loading a role markdown file
loading another Skill
same-context role-playing
self-review
manually creating unrelated top-level chats/tasks
```

Codex display names and logical roles are distinct:

```text
name: Wegener
role: Reviewer
```

---

# 6. Emergency Fallback

`SEQUENTIAL_ROLE_FALLBACK` may be entered only after concrete evidence such as:

```text
native delegation path unavailable in the current host
delegation returns unsupported/disabled
real delegation attempt fails and cannot be recovered
```

Before fallback, record the actual evidence.

Fallback report:

```text
Agent Team status: not established
Execution: single-context backup
Reason: <actual evidence>
```

Fallback rules:

- do not simulate separate Developer/Tester/Reviewer agents;
- do not call same-context review independent;
- do not describe fallback as healthy Agent Team operation;
- continue only if the software task can still be completed safely and truthfully.

Never choose fallback merely because it is easier.

---

# 7. Runtime Native-Agent Lifecycle

On every successful real delegation:

```text
agent_team_subagent_started
  name = Codex display name when known
  role = logical role
  memberId = mapped logical member when known
  taskId = mapped Runtime task when known
```

Call it immediately after delegation succeeds, not later.

When the subagent returns/fails/is cancelled:

```text
agent_team_subagent_finished
  status = done / failed / cancelled
  result = concise actual outcome
  evidence = concise actual evidence
```

Do not mark a linked task done while its native subagent is still running.

---

# 8. Task Graph and Logical Team

Read and apply:

```text
references/manager.md
references/task-packet.md
```

Each meaningful task should identify:

```text
ID
subject/objective
logical role / assignee
dependencies
read/write scope
file ownership
acceptance criteria
verification
expected evidence
execution context
```

Every assigned task MUST map to a logical Runtime member.

Invalid:

```text
4 assigned tasks
0 logical members
```

Use the smallest effective real team, but preserve independence where it matters.

---

# 9. Verification and Recovery

Implementation is not completion.

Run relevant real checks:

```text
build / compile
unit tests
integration tests
lint / type-check
runtime smoke tests
manual / GUI checks
simulation / hardware checks when actually available
```

Never claim a check passed unless it ran.

Failure flow:

```text
reproduce
→ collect evidence
→ native Debugger when useful
→ root cause
→ minimal fix
→ regression coverage
→ rerun verification
```

---

# 10. Independent Review

A review may be called independent only when a separate native Reviewer execution context actually performed it.

Valid evidence:

```text
real native Reviewer delegation/result
and, when Runtime lifecycle tools are active,
matching Reviewer start/finish records
```

Not independent:

```text
loading Review Skill
reading reviewer.md
Manager checking its own code
same-context self-check
logical Reviewer member without a native Reviewer
```

If no native Reviewer can run, say independent review was unavailable.

---

# 11. Review Remediation

Default blocking policy:

```text
Critical → blocking
High     → blocking
Medium   → blocking when correctness/security/data integrity/persistence/required behavior is affected
Low      → normally non-blocking unless acceptance is prevented
```

Blocking findings require follow-up work:

```text
Fix findings
→ Regression verification
→ Re-review
```

Prefer native Developer/Debugger for fixes, native Tester for regression, and native Reviewer for re-review.

---

# 12. Completion Gate

Successful Agent Team completion requires:

```text
executionMode = NATIVE_SUBAGENTS
AND
at least one native subagent record exists
AND
all current Runtime tasks are done
AND
active native subagents = 0
AND
required verification is complete
AND
blocking review findings are resolved
```

A fallback run may finish the software task, but its final report MUST say Agent Team was not established.

---

# 13. Truthfulness

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
HARD GATE A: Runtime initialized + Dashboard rendered
↓
HARD GATE B: real native subagent successfully delegated + recorded
↓
NATIVE_SUBAGENTS
↓
Implementation / Testing / Debugging / Review
↓
Integration / Verification
↓
Independent native Review
↓
Remediation
↓
Truthful completion
```

Auto Agent Team means real native multi-agent collaboration. Runtime alone is not enough. Logical members alone are not enough. The second gate passes only after a real native Codex subagent actually starts.
