# Task Packet

## Purpose

A Task Packet is the standard contract used by the Manager when delegating work to another agent.

Every delegated task should be specific enough that the assigned agent can work independently without repeatedly asking what to do.

A Task Packet should define:

```text
what the agent must accomplish
why the task exists
what context matters
what the agent may inspect
what the agent may modify
what the agent must not modify
what dependencies must be respected
what evidence is required
how completion will be validated
what result must be returned
```

The Task Packet exists to reduce ambiguity, prevent conflicting edits, improve parallel execution, and make agent results easier for the Manager to integrate.

---

## Core Principle

Do not delegate with vague instructions such as:

```text
Fix this.
```

```text
Work on the backend.
```

```text
Check the project.
```

```text
Write some tests.
```

Instead, provide a complete engineering contract.

A good Task Packet should allow the assigned agent to answer:

```text
What am I responsible for?
What am I not responsible for?
What can I read?
What can I edit?
What depends on my work?
What does success look like?
How should I verify the result?
What evidence must I return?
```

---

# 1. Standard Task Packet Template

Use the following structure whenever practical:

```text
Task ID:
Unique identifier.

Role:
Assigned role.

Objective:
The concrete result this task must produce.

Context:
Relevant project background and why the task exists.

Dependencies:
Tasks, interfaces, decisions, or outputs that must already exist.

May read:
Files, directories, modules, logs, documentation, or resources the agent may inspect.

May edit:
Files, directories, or modules the agent owns for this task.

Must not edit:
Files, directories, modules, or systems outside the agent's ownership.

Constraints:
Technical, architectural, security, safety, compatibility, or project constraints.

Acceptance criteria:
Observable conditions that define successful completion.

Required validation:
Commands, tests, simulations, inspections, or other evidence required before returning.

Expected output:
The information the agent must return to the Manager.

Blocker behavior:
What the agent should do if the task cannot be completed safely or correctly.
```

---

# 2. Task ID

Every meaningful task should have a stable identifier.

Examples:

```text
T1
T2
T3
BUG-1
API-2
STM32-PWM-1
```

Task IDs help the Manager track:

```text
dependencies
progress
ownership
failures
retries
integration
```

Do not reuse one Task ID for unrelated work.

---

# 3. Role

Specify the role explicitly.

Examples:

```text
Role: Researcher
```

```text
Role: Architect
```

```text
Role: Developer
```

```text
Role: Debugger
```

```text
Role: Tester
```

```text
Role: Reviewer
```

The role determines which reference playbook should guide behavior.

Relevant role files include:

```text
references/researcher.md
references/architect.md
references/developer.md
references/debugger.md
references/tester.md
references/reviewer.md
```

---

# 4. Objective

The Objective should describe one concrete outcome.

Bad:

```text
Objective:
Work on storage.
```

Better:

```text
Objective:
Implement local persistence for aggregate keyboard usage statistics.
```

Better:

```text
Objective:
Determine why TIM1 complementary PWM output is missing and identify the supported root cause.
```

The Objective should be narrow enough to assign ownership and broad enough to produce a useful result.

---

# 5. Context

Provide only the context necessary to perform the task correctly.

Useful context may include:

```text
user goal
existing architecture
relevant prior decisions
important project constraints
known failures
expected interfaces
target platform
hardware model
toolchain
dependency versions
```

Example:

```text
Context:
The application already has a StatisticsService that owns aggregate key counts.
The storage module should persist that state locally.
Typed text must never be stored.
```

Do not dump the entire project history into every Task Packet.

---

# 6. Dependencies

Specify what must exist before the task can begin.

Examples:

```text
Dependencies:
T2 architecture must be complete.
```

```text
Dependencies:
Use the StatisticsSnapshot interface defined by Architect.
```

```text
Dependencies:
Requires the PWM frequency decision from T3.
```

```text
Dependencies:
None.
```

Dependencies help the Manager determine whether tasks can run in parallel.

---

# 7. May Read

Specify what the agent may inspect.

Example:

```text
May read:
src/storage/*
src/models/*
tests/storage/*
README.md
AGENTS.md
PROJECT_LOG.md
```

Read scope may be broader than write scope.

Agents often need to inspect neighboring modules to understand integration contracts.

Do not unnecessarily prevent useful read-only investigation.

---

# 8. May Edit

Define explicit ownership.

Example:

```text
May edit:
src/storage/*
tests/storage/*
```

This is especially important when multiple Developers work in parallel.

The write scope should be narrow enough to reduce conflicts.

---

# 9. Must Not Edit

Specify protected areas when relevant.

Example:

```text
Must not edit:
src/ui/*
src/input/*
build configuration
public API contracts
```

This protects parallel work from accidental interference.

If a required change falls outside the allowed scope, the agent should report it to the Manager instead of editing silently.

---

# 10. Constraints

Record important non-negotiable constraints.

Examples:

```text
Do not add new dependencies.
```

```text
Preserve backward-compatible file format.
```

```text
Do not record complete typed text.
```

```text
Maintain 20 kHz PWM.
```

```text
Maintain 50 Hz modulation.
```

```text
Do not disable hardware break protection.
```

```text
Use the existing test framework.
```

Constraints should prevent locally convenient but globally harmful decisions.

---

# 11. Acceptance Criteria

Acceptance criteria define observable success.

Bad:

```text
Acceptance:
Storage works.
```

Better:

```text
Acceptance criteria:
- Aggregate key counts can be saved.
- Counts can be loaded after restart.
- Missing storage file produces an empty state.
- Typed text is never persisted.
```

For embedded systems:

```text
Acceptance criteria:
- TIM1 produces complementary PWM on the configured channels.
- PWM frequency remains 20 kHz.
- Break input disables outputs.
- Fault state does not automatically re-enable PWM.
```

Acceptance criteria should be testable when practical.

---

# 12. Required Validation

Specify how completion should be proven.

Examples:

```text
Required validation:
pytest tests/storage
```

```text
Required validation:
npm run build
npm test
```

```text
Required validation:
Keil target rebuild
```

```text
Required validation:
Run the Simulink model and confirm no simulation errors.
```

```text
Required validation:
Inspect TIM1 configuration and verify ARR/PSC calculations.
```

Do not require validation that the environment cannot realistically perform.

If required validation cannot be executed, the agent must report that limitation.

---

# 13. Required Evidence

The agent should return evidence rather than confidence.

Useful evidence includes:

```text
files inspected
files changed
commands executed
test results
compiler output
error logs
measured values
configuration values
review findings
remaining uncertainty
```

Bad:

```text
Everything looks good.
```

Better:

```text
pytest tests/storage
Result: 8 passed
```

---

# 14. Expected Output

Each role may require a different return format.

## Researcher

```text
Findings
Evidence
Locations
Implications
Unknowns
Recommendation
```

## Architect

```text
Proposed structure
Interfaces
Data flow
State ownership
Lifecycle
Dependencies
Parallelizable work
Risks
Validation strategy
```

## Developer

```text
Files changed
Implementation summary
Validation performed
Results
Assumptions
Blockers
Integration notes
```

## Debugger

```text
Problem
Reproduction
Evidence
Hypotheses
Root Cause
Failed Attempts
Fix
Verification
Lesson
```

## Tester

```text
Verification performed
Results
Failures
Regression status
Limitations
Conclusion
```

## Reviewer

```text
Review scope
Findings
Severity
Evidence
Recommended fixes
Remaining uncertainty
Recommendation
```

---

# 15. Blocker Behavior

Every Task Packet should define what happens if the task cannot proceed.

Default blocker behavior:

```text
Do not guess.
Do not silently expand scope.
Do not edit protected files.
Do not fabricate completion.

Return:
- blocker
- evidence
- affected dependency
- recommended next action
```

Example:

```text
Blocker:
The required interface does not exist.

Evidence:
src/models/statistics.py contains no StatisticsSnapshot type.

Impact:
Storage implementation cannot preserve the agreed contract.

Recommended next action:
Manager should return the task to Architect or update the interface decision.
```

---

# 16. File Ownership

When multiple writing agents work concurrently, Task Packets should create non-overlapping ownership.

Preferred:

```text
T3 Developer A
May edit:
src/input/*

T4 Developer B
May edit:
src/storage/*

T5 Developer C
May edit:
src/ui/*
```

Avoid:

```text
T3 Developer A
May edit:
src/app.py

T4 Developer B
May edit:
src/app.py
```

unless the Manager intentionally provides a conflict-safe integration strategy.

---

# 17. Parallel Execution

Task Packets should make parallelism explicit when appropriate.

Example:

```text
T3
Dependencies: T2
May run in parallel with: T4, T5

T4
Dependencies: T2
May run in parallel with: T3, T5

T5
Dependencies: T2
May run in parallel with: T3, T4
```

Do not mark tasks parallel if they depend on unfinished shared decisions.

---

# 18. Shared Interfaces

When parallel tasks depend on a shared contract, include the contract in each relevant Task Packet.

Example:

```text
Shared interface:

StatisticsService.increment(key: KeyId) -> None

StatisticsService.snapshot() -> StatisticsSnapshot

StatisticsStore.load() -> StatisticsSnapshot

StatisticsStore.save(snapshot: StatisticsSnapshot) -> None
```

This reduces integration mismatch.

---

# 19. Research Task Packet Example

```text
Task ID:
T1

Role:
Researcher

Objective:
Determine how keyboard events currently enter the application and whether any complete typed text is stored.

Context:
The project is being converted into a privacy-preserving keyboard usage statistics application.

Dependencies:
None.

May read:
src/*
tests/*
README.md
AGENTS.md
PROJECT_LOG.md

May edit:
None.

Must not edit:
All production files.

Constraints:
Read-only investigation.
Do not expose sensitive local data.

Acceptance criteria:
- Identify keyboard event entry points.
- Identify state ownership.
- Identify persistence behavior.
- Confirm whether full typed sequences are stored.

Required validation:
Repository search and code-path tracing.

Expected output:
Findings
Evidence
Locations
Privacy risks
Unknowns
Recommendation

Blocker behavior:
Report inaccessible or missing files to Manager.
```

---

# 20. Architect Task Packet Example

```text
Task ID:
T2

Role:
Architect

Objective:
Design the module structure for the keyboard usage statistics application.

Context:
Researcher confirmed that the current application has no clean separation between input capture and persistence.

Dependencies:
T1 Researcher findings.

May read:
src/*
tests/*
T1 output

May edit:
Design documentation only if explicitly authorized.

Must not edit:
Production implementation files.

Constraints:
- Keep the application local-first.
- Do not store typed sequences.
- Avoid unnecessary new dependencies.

Acceptance criteria:
- Define input, statistics, storage, UI, and application coordination responsibilities.
- Define shared interfaces.
- Define state ownership.
- Identify parallelizable implementation tasks.

Required validation:
Architecture consistency review.

Expected output:
Proposed structure
Interfaces
Data flow
Lifecycle
State ownership
Parallelizable tasks
Risks
Validation strategy
```

---

# 21. Developer Task Packet Example

```text
Task ID:
T4

Role:
Developer

Objective:
Implement persistent local storage for aggregate keyboard statistics.

Context:
StatisticsService owns in-memory aggregate counts.
Storage should persist only aggregate statistics.

Dependencies:
T2 architecture complete.

May read:
src/storage/*
src/statistics/*
tests/storage/*
references defined by T2

May edit:
src/storage/*
tests/storage/*

Must not edit:
src/input/*
src/ui/*
shared interfaces without Manager approval

Constraints:
- No complete typed text may be stored.
- Use existing project dependencies.
- Preserve existing project style.

Acceptance criteria:
- Aggregate statistics can be saved.
- Statistics can be loaded after restart.
- Missing file returns an empty state.
- Corrupt data is handled explicitly.

Required validation:
Run storage unit tests.

Expected output:
Files changed
Implementation summary
Tests run
Results
Assumptions
Blockers
Integration notes

Blocker behavior:
Report required interface changes to Manager.
```

---

# 22. Debugger Task Packet Example

```text
Task ID:
BUG-1

Role:
Debugger

Objective:
Identify why application startup fails on a clean installation.

Context:
Tester reports FileNotFoundError during first launch.

Dependencies:
Tester reproduction evidence.

May read:
src/*
tests/*
runtime logs
build configuration

May edit:
Only files explicitly authorized by Manager.

Must not edit:
Unrelated modules.

Constraints:
Find root cause before broad changes.

Acceptance criteria:
- Failure reproduced when possible.
- Root cause supported by evidence.
- Minimal fix identified or implemented.
- Original failure condition re-tested.

Required validation:
Re-run first-launch scenario and affected tests.

Expected output:
Problem
Reproduction
Evidence
Hypotheses
Root Cause
Failed Attempts
Fix
Verification
Lesson
```

---

# 23. Tester Task Packet Example

```text
Task ID:
T7

Role:
Tester

Objective:
Verify integrated keyboard statistics behavior.

Context:
Input, statistics, storage, and UI implementations have been integrated.

Dependencies:
T3
T4
T5
T6

May read:
src/*
tests/*
build configuration

May edit:
tests/* only if explicitly authorized

Must not edit:
Production implementation files.

Constraints:
Do not approve behavior that was not executed.

Acceptance criteria:
- Application starts.
- Key counts increase.
- UI reflects statistics.
- Counts survive restart.
- Reset works.
- Typed sequences are not stored.

Required validation:
- Build
- Unit tests
- Integration tests
- Manual smoke test when environment allows

Expected output:
Verification performed
Results
Failures
Regression status
Limitations
Conclusion
```

---

# 24. Reviewer Task Packet Example

```text
Task ID:
T8

Role:
Reviewer

Objective:
Perform an independent review of the integrated keyboard statistics implementation.

Context:
Implementation and testing are complete.

Dependencies:
T7 verification report.

May read:
changed files
related interfaces
tests
verification evidence
architecture output

May edit:
None by default.

Must not edit:
Production code unless Manager explicitly reassigns the task.

Constraints:
Focus on real defects rather than style preferences.

Acceptance criteria:
- Review requirement alignment.
- Review correctness.
- Review privacy.
- Review lifecycle.
- Review persistence.
- Review test completeness.
- Identify blocking findings if present.

Required validation:
Static review plus inspection of Tester evidence.

Expected output:
Review scope
Findings
Severity
Evidence
Recommended fixes
Remaining uncertainty
Recommendation
```

---

# 25. Embedded Developer Example

```text
Task ID:
STM32-PWM-1

Role:
Developer

Objective:
Implement TIM1 complementary PWM configuration with configurable dead time and fault-safe break handling.

Context:
The inverter firmware requires complementary PWM output.
The existing project must retain the current PWM frequency and modulation behavior.

Dependencies:
Architect-approved timer and safety design.

May read:
Core/*
Drivers/*
project configuration
CubeMX-generated timer files
AGENTS.md
PROJECT_LOG.md

May edit:
TIM1 configuration module
PWM control module
relevant tests or validation scripts

Must not edit:
unrelated communication modules
unrelated ADC processing
control algorithm interfaces unless approved

Constraints:
- Preserve target PWM frequency.
- Preserve modulation frequency.
- Do not disable break protection.
- Fault state must produce safe outputs.
- Avoid blocking operations in high-frequency interrupt paths.

Acceptance criteria:
- Complementary outputs configured.
- Dead time is configurable.
- Break input disables outputs safely.
- Fault state is observable.
- Existing modulation behavior remains compatible.

Required validation:
- Project build
- Timer calculation verification
- Static inspection of BDTR/break configuration
- Hardware waveform verification only if hardware access exists

Expected output:
Files changed
Configuration values
Implementation summary
Build result
Validation evidence
Hardware limitations
Integration notes
```

---

# 26. Keep Task Packets Compact

A Task Packet should contain enough information to remove ambiguity, but it should not become a full project specification.

Prefer:

```text
specific
relevant
actionable
bounded
verifiable
```

Avoid:

```text
entire repository history
unrelated discussions
long duplicated documentation
irrelevant implementation suggestions
```

---

# 27. Do Not Over-Constrain Agents

The Manager should define the required outcome and boundaries without dictating every implementation detail unnecessarily.

Bad:

```text
Use exactly three functions with these exact internal variable names.
```

unless those details are required by an interface.

Better:

```text
Preserve the public interface.
Stay within src/storage/*.
Pass the storage tests.
```

Allow specialized agents to apply judgment inside their assigned scope.

---

# 28. Do Not Under-Specify Agents

At the same time, avoid delegating tasks with no boundaries.

Bad:

```text
Make the app better.
```

A useful Task Packet should identify:

```text
scope
ownership
dependencies
success conditions
validation
```

---

# 29. Update Task Packets When Plans Change

If architecture or dependencies change during execution, the Manager should update affected Task Packets.

Example:

```text
Architect changes StatisticsSnapshot interface
↓
Manager identifies affected tasks
↓
T3/T4/T5 packets updated
↓
Developers continue using the new contract
```

Do not let agents continue working against obsolete assumptions.

---

# 30. Completion Evidence

A task is not complete merely because an agent says:

```text
Done.
```

A task should normally return:

```text
result
evidence
validation
remaining limitations
```

The Manager decides whether the evidence satisfies the acceptance criteria.

---

# 31. Task Status

The Manager may internally track status as:

```text
Pending
Ready
Running
Blocked
Failed
Needs Rework
Completed
```

A task should become `Completed` only when its acceptance criteria and required validation are sufficiently satisfied.

---

# 32. Blocked Tasks

When a task is blocked, record:

```text
Task ID
Blocker
Evidence
Dependency
Impact
Recommended next action
```

Do not let blocked agents continue making unrelated changes merely to stay busy.

---

# 33. Failed Tasks

A failed task should preserve diagnostic value.

Record:

```text
what was attempted
what failed
evidence
failed approaches
remaining hypotheses
recommended next action
```

The Manager may then assign the failure to a Debugger.

---

# 34. Integration Readiness

Before integrating an implementation task, the Manager should be able to answer:

```text
Did the agent stay within ownership?
Did required validation run?
Did interfaces remain compatible?
Are blockers resolved?
Are integration notes clear?
```

If not, the task may require rework before integration.

---

# 35. Final Task Packet Template

Copy and fill this template when delegating:

```text
Task ID:

Role:

Objective:

Context:

Dependencies:

May read:

May edit:

Must not edit:

Constraints:

Acceptance criteria:

Required validation:

Expected output:

Blocker behavior:
If blocked, stop unsafe or speculative work and return:
- blocker
- evidence
- impact
- affected dependency
- recommended next action
```

---

## Final Principle

A delegated agent should never have to guess:

```text
what it owns
what it may change
what success means
how to prove completion
```

Clear Task Packets create better parallelism, fewer conflicts, more reliable verification, and easier integration.

The Manager defines the contract.

The assigned agent executes within that contract.

Evidence determines completion.
