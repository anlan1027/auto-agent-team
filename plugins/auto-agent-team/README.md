# Auto Agent Team Plugin

This directory contains the optional Codex Plugin layer for Auto Agent Team.

The project intentionally separates responsibilities:

- the standalone root `SKILL.md` is the top-level orchestration Skill;
- this plugin provides a local MCP runtime for DSH-style team state;
- this plugin provides an MCP Apps dashboard for members, tasks, dependencies, progress, verification, and review.

The plugin does **not** bundle a second Skill named `auto-agent-team`, which avoids duplicate Skill entries when the standalone Skill is already installed.

## Architecture

```text
User goal
  ↓
Standalone Auto Agent Team Skill / Manager
  ↓
Native Codex subagents (when suitable)
  ↓
Agent Team MCP runtime
  ├─ .agent-team/team.json
  └─ tools for state updates
  ↓
MCP Apps dashboard
```

The dashboard is host-rendered UI. The plugin does not modify the Codex shell and therefore cannot force a permanent right-side panel. Compatible Codex hosts may render the dashboard inline or in another supported MCP Apps presentation.

## Runtime tools

- `agent_team_create`
- `agent_team_get`
- `agent_team_update_member`
- `agent_team_update_task`
- `agent_team_append_event`
- `agent_team_render_dashboard`

The runtime is local and has no npm dependencies beyond Node.js itself.

## Runtime verification

Run:

```text
node ./scripts/smoke-test.mjs
```

The smoke test starts the MCP server, creates temporary team state, updates a task, renders the dashboard resource, and verifies the generated state file.

## State

Team state is written only under the selected workspace:

```text
.agent-team/team.json
```

## Native Subagents

Native Codex subagent activity may be surfaced by Codex's own Subagents/background-agent UI. That is valid native delegation and is different from manually creating unrelated top-level chats merely to imitate agents.
