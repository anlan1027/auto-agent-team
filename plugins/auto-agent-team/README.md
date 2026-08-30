# Auto Agent Team Plugin

This directory contains the optional Codex Plugin layer for Auto Agent Team.

The standalone root `SKILL.md` remains the top-level orchestration Skill. This plugin provides a local MCP runtime plus a DSH-style dashboard; it does not install a duplicate Skill.

## Architecture

```text
User goal
  ↓
Auto Agent Team Skill / Manager
  ↓
Native Codex subagents when available
  ↓
Agent Team MCP runtime
  ├─ .agent-team/team.json
  └─ dependency/state scheduler
  ↓
MCP Apps dashboard
```

The host decides where the dashboard is rendered. The plugin cannot force a permanent Codex right-side panel.

## Execution modes

There are three runtime execution modes:

```text
UNKNOWN
NATIVE_SUBAGENTS
SEQUENTIAL_ROLE_FALLBACK
```

`UNKNOWN` is the correct initial state until delegation capability is proven. A successful native Codex subagent must switch the runtime to `NATIVE_SUBAGENTS`. Fallback is used only when native delegation is actually unavailable or fails.

## Runtime tools

- `agent_team_create`
- `agent_team_get`
- `agent_team_set_execution_mode`
- `agent_team_add_task`
- `agent_team_update_member`
- `agent_team_update_task`
- `agent_team_append_event`
- `agent_team_render_dashboard`

The runtime is local and has no npm dependencies beyond Node.js itself.

## Review remediation loop

Review is not automatically equivalent to project completion. Blocking findings should append follow-up work such as:

```text
Fix review findings
→ Regression verification
→ Re-review
```

The scheduler can reopen a previously completed team when new remediation tasks are added.

## Runtime verification

Run:

```text
node ./scripts/smoke-test.mjs
```

The smoke test verifies fresh-workspace behavior, execution-mode switching, dependency scheduling, final member convergence, remediation reopening, and follow-up dependencies.

## State

Team state is written only under the selected workspace:

```text
.agent-team/team.json
```
