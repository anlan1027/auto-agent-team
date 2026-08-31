# Changelog

All notable project changes are summarized here.

## v0.3.1 — 2026-08-31

State-truthfulness and dashboard-stability hardening on top of the v0.3.0 stable line.

### Added

- Runtime task classification with schema v5:
  - initial team tasks persist as `taskClass: main`;
  - later follow-up tasks persist as `taskClass: dynamic`.
- Backward-compatible recovery of legacy dynamic tasks from existing `task_added` events.
- Persisted `fallbackReason` for single-Agent backup mode.
- Dashboard display of the concrete backup reason.
- Smoke-test coverage for task classes, backup-reason enforcement, and sticky native execution mode.

### Changed

- `SEQUENTIAL_ROLE_FALLBACK` now requires a non-empty concrete reason before the Runtime accepts the transition.
- Directly setting `NATIVE_SUBAGENTS` without a tracked real native subagent is rejected; a real native start must be recorded with `agent_team_subagent_started`.
- Once any real native subagent has been recorded for a team run, `NATIVE_SUBAGENTS` becomes sticky and cannot be downgraded to `UNKNOWN` or `SEQUENTIAL_ROLE_FALLBACK`, even when the current active-native count is zero.
- `agent_team_add_task` now always creates a persisted dynamic task rather than relying only on event-log inference.
- Dashboard main/dynamic task grouping now prefers persisted `taskClass` and keeps event-based inference only as compatibility fallback.
- Plugin, Runtime, smoke test, and bilingual README documentation are synchronized on `0.3.1`.

### Verification

The bundled smoke test now covers:

```text
schema v5
main task classification
dynamic task classification
fallback reason required
fallback reason persistence
direct false-native mode rejection
native lifecycle tracking
linked-task completion gating
native mode remains sticky after active count returns to zero
native-to-backup downgrade rejection
fixed main-task denominator
Dashboard backup-reason display
```

Expected result:

```text
Auto Agent Team runtime smoke test passed.
```

## v0.3.0 — 2026-08-30

First stable release of the current native-Agent-Team runtime/dashboard line.

### Added

- Implicit project-scale Auto Agent Team triggering.
- Pre-implementation Runtime startup ordering for local Auto-Agent-Team-owned projects.
- Local MCP Runtime state in `.agent-team/team.json`.
- DSH-style Agent Team Dashboard.
- Native Codex subagent lifecycle tracking with:
  - `agent_team_subagent_started`
  - `agent_team_subagent_finished`
- Runtime task dependency scheduling and logical member synchronization.
- Completion gating while linked native subagents are still active.
- Remediation / regression / re-review follow-up task support.
- Dashboard separation between fixed main-task progress and dynamically added follow-up work.

### Changed

- Native Codex subagents are the default execution path for suitable independent work.
- `SEQUENTIAL_ROLE_FALLBACK` is now explicitly an emergency single-Agent backup state, not a normal Agent Team mode.
- Dashboard labels now present execution policy as:
  - `原生多 Agent（默认）`
  - `保底模式（单 Agent）`
  - `等待原生 Agent 确认`
- Ordinary chats, top-level Tasks, `create_thread`, `fork_thread`, `handoff_thread`, and cross-task delegation are explicitly excluded from native-subagent identity.
- Independent review requires a separate real native Reviewer execution context.
- Documentation and plugin/runtime versioning are synchronized on `0.3.0`.

### Runtime tools

v0.3.0 exposes 10 Runtime tools:

```text
agent_team_create
agent_team_get
agent_team_set_execution_mode
agent_team_add_task
agent_team_subagent_started
agent_team_subagent_finished
agent_team_update_member
agent_team_update_task
agent_team_append_event
agent_team_render_dashboard
```

### Verification

The bundled smoke test covers fresh-workspace behavior, tool availability, native-agent lifecycle tracking, execution-mode switching, dependency scheduling, linked-task completion gating, remediation reopening, Dashboard native-agent state, and main/dynamic task separation.

Expected result:

```text
Auto Agent Team runtime smoke test passed.
```

## v0.2.0

Introduced the optional Codex Plugin, local MCP Runtime, and Agent Team Dashboard on top of the standalone Auto Agent Team Skill.
