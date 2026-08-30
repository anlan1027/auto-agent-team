# Auto Agent Team Plugin

This directory packages Auto Agent Team as a Codex plugin.

It combines:

- a top-level orchestration Skill;
- a local MCP runtime that stores DSH-style team state in `.agent-team/team.json`;
- an MCP Apps dashboard for members, tasks, dependencies, progress, verification, and review;

## Architecture

```text
User goal
  ↓
Auto Agent Team Skill / Manager
  ↓
Native Codex subagents (when suitable)
  ↓
Agent Team MCP runtime
  ├─ .agent-team/team.json
  └─ tools for state updates
  ↓
MCP Apps dashboard
```

The dashboard is host-rendered UI. The plugin does not modify the Codex shell and therefore cannot force a permanent right-side panel. Compatible hosts may render it inline or in another supported presentation.

## Runtime tools

- `agent_team_create`
- `agent_team_get`
- `agent_team_update_member`
- `agent_team_update_task`
- `agent_team_append_event`
- `agent_team_render_dashboard`

The runtime is local and zero-dependency beyond Node.js.

## State

Team state is written only under the selected workspace:

```text
.agent-team/team.json
```

## Notes

Native Codex subagent activity may be surfaced by Codex's own Subagents/background-agent UI. That is different from manually creating unrelated top-level chats to simulate agents.
