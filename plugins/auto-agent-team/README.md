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
  ├─ validated task graph
  ├─ automatic dependency scheduler
  ├─ task-derived member state
  ├─ automatic phase transitions
  └─ .agent-team/team.json
  ↓
MCP Apps dashboard v2
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

## Automatic scheduler

The runtime now reconciles task state automatically.

```text
pending
  ↓ dependencies satisfied
ready
  ↓ real work starts
running
  ↓
done / failed
```

Dependency behavior:

```text
T1 done
  ↓
T2 pending → ready

T2 failed
  ↓
T3 / T4 → blocked

T2 retried and done
  ↓
T3 / T4 → ready
```

The scheduler also:

- rejects duplicate task ids;
- rejects missing dependency references;
- rejects dependency cycles;
- records dependency-generated ready/blocked events;
- derives member status from assigned tasks when no active explicit native-agent status takes precedence;
- derives team phase (`planning`, `running`, `verifying`, `reviewing`, `completed`, or `blocked`).

## Dashboard v2

The dashboard now shows:

- friendly Chinese execution-mode labels;
- overall progress bar;
- workflow stage tracker;
- collapsible member cards;
- task status and dependency chips;
- blocked/failed work;
- verification evidence;
- review evidence;
- recent runtime activity;
- automatic refresh plus manual refresh.

Raw runtime values such as `SEQUENTIAL_ROLE_FALLBACK` remain in `team.json`, while the dashboard presents user-friendly labels such as `顺序执行模式`.

## Runtime verification

Run:

```text
node ./scripts/smoke-test.mjs
```

The smoke test starts the MCP server and verifies:

- team creation;
- automatic `pending → ready` transitions;
- task-derived member state;
- dependency failure propagation;
- recovery/unblocking;
- verifying/reviewing/completed phase transitions;
- cycle rejection;
- dashboard v2 resource rendering;
- persisted `.agent-team/team.json` state.

## State

Team state is written only under the selected workspace:

```text
.agent-team/team.json
```

Schema version 2 adds scheduler metadata such as:

```text
blockedReason
blockedBy
startedAt
completedAt
statusChangedAt
statusSource
```

## Native Subagents

Native Codex subagent activity may be surfaced by Codex's own Subagents/background-agent UI. That is valid native delegation and is different from manually creating unrelated top-level chats merely to imitate agents.

The runtime does not create native subagents by itself. It records and visualizes the truthful work performed by Codex and its native delegation mechanisms.
