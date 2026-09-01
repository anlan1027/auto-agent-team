# Auto Agent Team

<p align="center">
  <a href="README.md">中文</a> | English
</p>

An automatic multi-agent engineering orchestrator for OpenAI Codex.

**v0.3.2** focuses on a simple model: the user describes a project goal, the Manager analyzes requirements, builds the task graph, uses real native Codex subagents by default for suitable independent work, and keeps members, tasks, dependencies, native-agent lifecycle, verification, and review visible through the local Runtime and Dashboard.

---

## Workflow

```text
Natural-language project request
↓
Auto Agent Team implicit trigger
↓
Workspace / project rules
↓
Manager builds logical team + main task graph
↓
Auto Agent Team Runtime + Dashboard
↓
Native Codex Agent Team by default
├─ Researcher / Explorer
├─ Architect
├─ Developer
├─ Tester
├─ Debugger
└─ Reviewer
↓
Manager integration
↓
Real build / test / debug
↓
Independent native Reviewer
↓
Fix / regression / re-review
↓
Final delivery
```

The user should not need to choose the agent count, roles, execution order, or parallelism manually.

---

## Native Agent Team by Default

For complete projects and suitable independent work, Auto Agent Team defaults to the host's real native Codex subagent capability, such as `spawn_agent`, `collaboration.spawn_agent`, native multi-agent spawn, or an equivalent internal child-agent operation.

A real native subagent is an internal child execution context of the current Manager, not a normal top-level conversation.

These do **not** count as native subagents:

```text
create_thread
fork_thread
handoff_thread
new normal chat / top-level task
cross-task delegation
“Sent by ChatGPT/Codex from another task”
loading a role markdown file
loading another Skill
same-context role playing
self-review
```

Only when real native spawning is unavailable, disabled, unsupported, or an actual spawn attempt fails may the runtime use:

```text
SEQUENTIAL_ROLE_FALLBACK
```

The Dashboard presents that state as:

```text
Single-Agent Backup
```

Entering backup requires a concrete reason, and the Dashboard displays that reason explicitly.

Once at least one real native subagent has been successfully recorded for the current team run, execution mode is locked to:

```text
NATIVE_SUBAGENTS
```

Even if there are temporarily `0` active native agents between phases, the run cannot be downgraded back to `UNKNOWN` or single-Agent backup.

---

## Runtime and Dashboard

The optional Plugin provides a local MCP Runtime. Team state is stored in the current workspace:

```text
.agent-team/
└── team.json
```

The Runtime currently exposes 10 tools:

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

The Dashboard can show:

- phase: Plan → Execute → Verify → Review → Complete;
- native multi-agent vs single-agent backup execution;
- the concrete reason for backup mode;
- logical members and current status;
- active and recorded native agents;
- native display name, logical role, task, result, and evidence;
- task dependencies and status;
- fixed main-task progress;
- dynamic follow-up tasks;
- test / verification results;
- review / re-review results;
- recent Runtime activity.

### Main Tasks and Dynamic Follow-up Tasks

Tasks created with the initial team are persisted as **main tasks**:

```text
taskClass: main
```

Bug fixes, regression tests, review fixes, re-review work, and other items later added with `agent_team_add_task` are persisted as **dynamic follow-up tasks**:

```text
taskClass: dynamic
```

The top-level progress remains stable, for example:

```text
Main tasks 8/9
```

Dynamic tasks are displayed separately, so the main-task denominator does not keep growing. Existing schema v4 state remains compatible by deriving legacy dynamic tasks from recorded `task_added` events under schema v5 semantics.

---

## v0.3.2: Task Semantics and Phase Truthfulness

v0.3.2 addresses two Dashboard truthfulness issues found during a complete real project run.

### 1. Role-aware task-kind inference

When a task has no explicit `kind`, or is incorrectly stored as generic `task`, the Runtime can infer a better kind from the logical member role:

```text
Researcher / Explorer → research
Architect → architecture
Developer → implementation
Tester / QA → verification
Debugger → debug
Reviewer / Security Reviewer → review
```

So even if legacy tasks were stored like:

```text
T3 · tester · kind=task
T4 · reviewer · kind=task
```

the Dashboard's `Test / Verification` and `Review / Re-review` panels still show the real results instead of incorrectly reporting `No results`.

### 2. Project phase follows formal task state

Global phase is no longer inferred mainly from the role of whichever native Agent happens to be active. Running formal Runtime main tasks take precedence.

```text
T2 implementation running
+ sidecar Tester preparing verification
→ global phase remains Execute

T3 verification actually starts running
→ global phase becomes Verify

T4 review actually starts running
→ global phase becomes Review
```

A sidecar Tester / Researcher preparing future work can no longer advance the entire project phase early.

### 3. Generic task-title normalization

When titles are generic `Task 1`, `Task 2`, and so on, the Runtime uses role, task kind, objective, and available result context to normalize them into more meaningful labels when possible.

The Manager is still instructed to provide concrete subjects directly, especially for dynamic work, for example:

```text
Fix API-key exposure found by security review
Add generic usage/balance Provider Adapter
Run regression verification
Re-review concurrency fixes
```

---

## Native Agent Lifecycle

After a real native spawn succeeds, the Manager records:

```text
agent_team_subagent_started
```

When that native agent completes, fails, or is cancelled, the Manager records:

```text
agent_team_subagent_finished
```

v0.3.2 further requires that **after the host returns a native Agent handle/display name, `agent_team_subagent_started` should be the first Runtime action** before waiting on that Agent, spawning another one, or doing unrelated work.

This does not turn the MCP Runtime into a native host event stream, but it substantially reduces the short synchronization window where Codex's visible subagent count and the Dashboard's recorded count can temporarily differ.

Example:

```text
name: Heisenberg
role: Architect
task: T1
status: running → done
```

The Runtime treats real native-agent start as evidence for `NATIVE_SUBAGENTS` and prevents linked tasks from being completed while a native agent is still active.

---

## Built-in Roles

| Role | Responsibility |
|---|---|
| Manager | Requirements, task graph, delegation, coordination, integration, final delivery |
| Researcher | Repository, documentation, dependency, and technical research |
| Architect | Architecture, boundaries, interfaces, data flow, state design |
| Developer | Bounded implementation work |
| Debugger | Reproduction, root-cause investigation, fixes, regression |
| Tester | Build, test, edge-case, and failure-path verification |
| Reviewer | Independent correctness, security, maintainability, and test-gap review |

Not every role is forced into every project. The goal is the smallest effective team that preserves useful independence.

---

# Installation

The project has two layers:

1. **Auto Agent Team Skill** — core orchestration rules.
2. **Auto Agent Team Plugin** — MCP Runtime + Dashboard.

## Install / Update the Skill

Default Windows path:

```text
C:\Users\YourName\.agents\skills\auto-agent-team
```

First install:

```powershell
cd "$env:USERPROFILE\.agents\skills"
git clone https://github.com/anlan1027/auto-agent-team.git auto-agent-team
```

Update:

```powershell
git -C "$env:USERPROFILE\.agents\skills\auto-agent-team" pull
```

With a Clash proxy, for example port 7897:

```powershell
git -C "$env:USERPROFILE\.agents\skills\auto-agent-team" `
    -c http.proxy=http://127.0.0.1:7897 `
    -c https.proxy=http://127.0.0.1:7897 `
    pull
```

## Install / Update the Plugin

```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.agents\skills\auto-agent-team\install-plugin.ps1"
```

The installer validates the manifest and MCP configuration, runs the Runtime smoke test, and installs the plugin to:

```text
C:\Users\YourName\plugins\auto-agent-team
```

Fully restart Codex after updating.

---

# Usage

You normally do not need to type `$auto-agent-team` explicitly.

Example:

```text
Build a complete Windows local API management tool. Fill in reasonable requirements and technology choices yourself, then implement it, run real tests, fix problems, and perform an independent code review.
```

Project-scale requests should enter Auto Agent Team orchestration automatically. Small explanations, isolated snippets, and tiny edits do not need a full team.

---

## Dashboard Placement

The Dashboard uses UI containers supplied by Codex Plugin / MCP Apps. Final placement is controlled by the Codex Host and may be inline, fullscreen, picture-in-picture, or another supported container.

The project does not modify the Codex client shell, so it cannot guarantee a permanently pinned native right-side panel.

---

# Engineering Truthfulness

Auto Agent Team must not claim work that did not actually happen:

```text
No native spawn → do not claim a native Agent
Normal Task / chat → do not record as a native Agent
Tests not run → do not claim they passed
Manager self-review → do not call it independent review
No evidence → do not state a root cause as fact
```

Independent review requires a separate real native Reviewer execution context.

---

# Project Structure

```text
auto-agent-team/
├── README.md
├── README_EN.md
├── CHANGELOG.md
├── LICENSE
├── SKILL.md
├── install-plugin.ps1
├── agents/
│   └── openai.yaml
├── references/
│   ├── manager.md
│   ├── researcher.md
│   ├── architect.md
│   ├── developer.md
│   ├── debugger.md
│   ├── tester.md
│   ├── reviewer.md
│   └── task-packet.md
├── .agents/plugins/marketplace.json
└── plugins/auto-agent-team/
    ├── .codex-plugin/plugin.json
    ├── .mcp.json
    ├── README.md
    ├── README_EN.md
    ├── mcp/server.mjs
    ├── scripts/smoke-test.mjs
    └── ui/team-dashboard.html
```

---

# Current Version

```text
v0.3.2
```

v0.3.2 hardens the v0.3.1 stable line with:

```text
role-aware task-kind inference
→ Tester / Reviewer results appear in the correct evidence panels
→ project phase follows formal task state
→ sidecar Agents no longer advance phase early
→ generic Task N titles are normalized
→ native lifecycle is recorded immediately after spawn success
→ smoke tests cover the full regression path
```

See `CHANGELOG.md` for release notes.

---

## License

This project is licensed under the MIT License.
