# Auto Agent Team Plugin

<p align="center">
  <a href="README.md">中文</a> | English
</p>

Current stable version: **v0.3.0**.

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

Dashboard labels:

```text
原生多 Agent（默认）
保底模式（单 Agent）
等待原生 Agent 确认
```

## Runtime tools

The v0.3.0 Runtime exposes 10 tools:

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

Tasks already present when `agent_team_create` creates the team are treated by the Dashboard as **main tasks**.

Tasks later appended through `agent_team_add_task` are displayed separately as **dynamic follow-up tasks**. Typical examples include:

```text
bug fixes
review remediation
regression verification
re-review
other follow-up work discovered during execution
```

This keeps the top-level main-task denominator stable instead of showing progress such as `8/9 → 9/11 → 12/14` as follow-up work is discovered.

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
- native-subagent lifecycle tracking;
- execution-mode switching;
- linked-task completion gating;
- dependency scheduling;
- final member convergence;
- remediation reopening;
- Dashboard native-agent state;
- Dashboard main-task / dynamic-task separation.

Expected output:

```text
Auto Agent Team runtime smoke test passed.
```

## State file

Team state is written only under the selected workspace:

```text
.agent-team/team.json
```
