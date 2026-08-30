# Auto Agent Team Plugin

This directory contains the optional Codex Plugin layer for Auto Agent Team.

The standalone root `SKILL.md` remains the top-level orchestration Skill. This plugin provides a local MCP runtime plus a DSH-style dashboard; it does not install a duplicate Skill.

## Architecture

```text
User goal
  ↓
Auto Agent Team Skill / Manager
  ↓
Native Codex subagents
  ↓
Agent Team MCP runtime
  ├─ .agent-team/team.json
  ├─ dependency/state scheduler
  └─ native subagent lifecycle ledger
  ↓
MCP Apps dashboard
```

The host decides where the dashboard is rendered. The plugin cannot force a permanent Codex right-side panel.

## Runtime states

The runtime keeps three compatibility states:

```text
UNKNOWN
NATIVE_SUBAGENTS
SEQUENTIAL_ROLE_FALLBACK
```

Their meaning is intentionally asymmetric:

- `UNKNOWN`: startup; native delegation has not been proven yet. Agent Team is not established yet.
- `NATIVE_SUBAGENTS`: at least one real native Codex subagent was successfully delegated. Agent Team is established. This is the normal successful mode.
- `SEQUENTIAL_ROLE_FALLBACK`: native delegation was genuinely unavailable or failed. Agent Team is **not** established. This is emergency single-context backup only.

The dashboard must never present fallback as another healthy multi-agent mode. It displays fallback as **Agent Team unavailable / not established**.

## Runtime tools

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

The runtime is local and has no npm dependencies beyond Node.js itself.

## Native Codex subagent tracking

A real Codex subagent is tracked separately from the logical team role. For example:

```text
Codex display name: Wegener
Logical role:       Reviewer
Runtime member:     reviewer
Runtime task:       t4
```

When a native delegation succeeds, the Manager records it with `agent_team_subagent_started`. When it returns, fails, or is cancelled, the Manager records the terminal result with `agent_team_subagent_finished`.

Active native subagents are a completion gate. The runtime does not allow a linked task to be marked done while its native subagent is still running, and final native Agent Team completion requires:

```text
executionMode = NATIVE_SUBAGENTS
all current tasks are done
active native subagents = 0
required verification is complete
blocking review findings are resolved
```

A fallback run may still finish the software task, but its final report must say that a real Agent Team was not established.

## Logical team integrity

Runtime task assignees should map to logical members. A state such as:

```text
4 assigned tasks
0 logical members
```

is invalid orchestration even if the tasks themselves can run. The Manager should create the smallest logical team that matches the task graph.

## Review remediation loop

Review is not automatically equivalent to project completion. Blocking findings should append follow-up work such as:

```text
Fix review findings
→ Regression verification
→ Re-review
```

The scheduler can reopen a previously completed workflow when new remediation tasks are added.

## Runtime verification

Run:

```text
node ./scripts/smoke-test.mjs
```

The smoke test verifies fresh-workspace behavior, native-subagent lifecycle tracking, execution-mode switching, linked-task completion gating, dependency scheduling, final member convergence, dashboard Agent Team establishment semantics, and remediation reopening.

## State

Team state is written only under the selected workspace:

```text
.agent-team/team.json
```
