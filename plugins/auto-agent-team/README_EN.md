# Auto Agent Team Plugin

<p align="center">
  <a href="README.md">中文</a> | English
</p>

Current stable version: **v0.3.1**.

This directory contains the optional Codex Plugin layer for Auto Agent Team.

The root `SKILL.md` remains the top-level orchestration Skill. The Plugin provides a local MCP Runtime and a DSH-style Dashboard; it does not install a duplicate Skill.

## Architecture

```text
User goal
  ↓
Auto Agent Team Skill / Manager
  ↓
Native Codex subagents by default for suitable independent work
  ↓
Agent Team MCP Runtime
  ├─ .agent-team/team.json
  ├─ task / dependency state
  └─ native-subagent lifecycle ledger
  ↓
MCP Apps Dashboard
```

The Codex Host decides where the Dashboard is rendered. The Plugin cannot force a permanent native right-side panel.

## Execution modes

```text
UNKNOWN
NATIVE_SUBAGENTS
SEQUENTIAL_ROLE_FALLBACK
```

- `UNKNOWN`: startup state until real execution capability is confirmed.
- `NATIVE_SUBAGENTS`: the default successful path after at least one real native Codex subagent is recorded.
- `SEQUENTIAL_ROLE_FALLBACK`: emergency single-Agent backup only after concrete native-spawn unavailability, disablement, lack of support, or an actual spawn failure.

Entering `SEQUENTIAL_ROLE_FALLBACK` now requires a concrete reason. The Runtime stores it as `fallbackReason`, and the Dashboard displays it directly.

Once a real native subagent has been recorded, `NATIVE_SUBAGENTS` is sticky for the current team run. Even when the active native-agent count temporarily returns to zero, the run cannot be downgraded to `UNKNOWN` or backup mode.

Dashboard labels:

```text
原生多 Agent（默认）
保底模式（单 Agent）
等待原生 Agent 确认
```

## Runtime tools

The v0.3.1 Runtime exposes 10 tools:

- `agent_team_create`
- `agent_team_get`
- `agent_team_set_execution_mode`
- `agent_team_add_task`
- `agent_team_subagent_started`
- `agent_team_subagent_finished`
- `agent_team_update_member`
- `agent_team_update_task`
- `agent_team_append_event`
- `agent_team_render_dashboard`

The Runtime runs locally and has no npm dependencies beyond Node.js itself.

## Native Codex subagent tracking

A real Codex subagent is tracked separately from the logical team member:

```text
Codex display name: Heisenberg
Logical role:       Architect
Runtime member:     architect
Runtime task:       T1
```

After a real native delegation succeeds, the Manager records it with `agent_team_subagent_started`. When the native agent completes, fails, or is cancelled, the Manager records the terminal result with `agent_team_subagent_finished`.

Ordinary chats, top-level Tasks, `create_thread`, `fork_thread`, `handoff_thread`, or cross-task delegation do not count as native subagents.

Active native subagents participate in completion gating. A linked task cannot be marked done while its native subagent is still running.

## Main tasks and dynamic follow-up tasks

v0.3.1 uses schema v5 and persists task classification directly in Runtime state:

```text
taskClass: main
taskClass: dynamic
```

Initial tasks created by `agent_team_create` are forced to `main`. Tasks later appended through `agent_team_add_task` are forced to `dynamic`.

Typical dynamic tasks include:

```text
bug fixes
review remediation
regression verification
re-review
other follow-up work discovered during execution
```

This keeps the top-level main-task denominator stable instead of showing progress such as `8/9 → 9/11 → 12/14`. Existing schema v4 state remains compatible: the Runtime derives legacy dynamic-task semantics from recorded `task_added` events.

## Review remediation loop

Blocking review findings should append follow-up work instead of rewriting completed history:

```text
Fix review findings
→ Regression verification
→ Re-review
```

Adding follow-up work can reopen a previously completed team.

## Runtime verification

Run:

```text
node ./scripts/smoke-test.mjs
```

The smoke test verifies:

- fresh workspace behavior;
- the 10-tool Runtime surface;
- schema v5 and `taskClass`;
- native-subagent lifecycle tracking;
- execution-mode switching;
- backup mode requires a reason;
- native mode cannot be downgraded after a real native agent is recorded;
- linked-task completion gating;
- dependency scheduling;
- final member convergence;
- remediation reopening;
- Dashboard native-agent state;
- Dashboard main-task / dynamic-task separation;
- Dashboard backup-reason display.

Expected output:

```text
Auto Agent Team runtime smoke test passed.
```

## State file

Team state is written only under the selected workspace:

```text
.agent-team/team.json
```
