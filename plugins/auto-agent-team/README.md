# Auto Agent Team Plugin

This directory contains the optional Codex Plugin layer for Auto Agent Team.

The root `SKILL.md` is the orchestration policy. This plugin provides the local MCP Runtime and Dashboard.

## Core model

Auto Agent Team has two startup gates:

```text
Gate A — Runtime
agent_team_get / create / render_dashboard

Gate B — real native Agent Team establishment
successful native Codex delegation
→ agent_team_subagent_started
→ NATIVE_SUBAGENTS
```

Runtime readiness alone is not permission to start substantive implementation.

While `executionMode=UNKNOWN`, the Runtime rejects substantive task transitions to `running` or `done`. Only planning/requirements/orchestration/memory tasks may progress before the native team is established.

## Execution states

```text
UNKNOWN
= startup
= Agent Team not established yet

NATIVE_SUBAGENTS
= at least one real native Codex subagent was successfully delegated and recorded
= Agent Team established
= normal successful path

SEQUENTIAL_ROLE_FALLBACK
= native delegation unavailable/unsupported/failed
= Agent Team not established
= emergency single-context backup
```

`NATIVE_SUBAGENTS` cannot be set manually. It is established by `agent_team_subagent_started`.

Fallback requires a concrete `reason`; the Runtime stores it as `fallbackReason`.

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

## Runtime enforcement

The Runtime enforces:

- new team state starts `UNKNOWN`;
- assigned tasks must map to logical members;
- substantive tasks cannot enter `running`/`done` while `UNKNOWN`;
- `NATIVE_SUBAGENTS` cannot be manually asserted;
- fallback requires concrete failure evidence;
- linked tasks cannot be completed while a native subagent is still running;
- active native subagents prevent final convergence;
- duplicate native display names prefer the latest active record when finishing by name.

This does not intercept arbitrary filesystem edits made outside Runtime tools, so the Skill/Manager instructions also enforce the same establishment gate at the orchestration layer.

## Native lifecycle

After successful delegation:

```text
agent_team_subagent_started
  name = Codex display name
  role = logical role
  memberId = logical member when mapped
  taskId = Runtime task when mapped
```

On return/failure/cancellation:

```text
agent_team_subagent_finished
```

Example:

```text
name: Wegener
role: Reviewer
```

## Dashboard semantics

The Dashboard distinguishes:

```text
⚪ 正在建立 Agent Team
🟢 Agent Team 已建立
🔴 Agent Team 未建立
```

`UNKNOWN` explicitly warns that substantive implementation/testing/debugging/review must not begin before a native subagent starts.

Fallback displays the recorded failure evidence.

## Verification

Run:

```text
node ./scripts/smoke-test.mjs
```

The smoke test verifies:

- schema/version;
- fresh workspace behavior;
- logical-member validation;
- the second establishment gate;
- rejection of manual native-mode claims;
- real native lifecycle switching;
- concurrent Tester/Reviewer tracking;
- linked-task completion protection;
- evidence-backed fallback;
- Dashboard establishment/fallback messaging.

## State

Runtime state is written only under the selected workspace:

```text
.agent-team/team.json
```

The Codex host decides where the MCP App Dashboard is rendered.
