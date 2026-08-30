# Auto Agent Team

<p align="center">
  <a href="README.md">中文</a> | English
</p>

An automatic multi-agent engineering orchestrator for OpenAI Codex.

The user only needs to describe the goal. Auto Agent Team analyzes requirements, decomposes the work, selects roles, uses native Codex subagents when appropriate, coordinates parallel work, integrates code, runs verification, debugs failures, and performs independent review.

Starting with v0.2.0, the project also provides an optional **Codex Plugin + MCP Runtime + Agent Team Dashboard** for displaying DSH AgentTeams-style members, tasks, dependencies, progress, verification, and review state.

---

## What You Get

```text
Natural-language goal
↓
Auto Agent Team Skill
↓
Manager
↓
Task graph / dependencies
↓
Native Codex Subagents
├─ Researcher
├─ Architect
├─ Developer
├─ Tester
├─ Debugger
└─ Reviewer
↓
Integration / verification / review
↓
Final delivery
```

With the optional Plugin installed:

```text
Manager / Subagents
↓
Agent Team MCP Runtime
↓
.agent-team/team.json
↓
DSH-style Agent Team Dashboard
```

---

## Core Idea

The user should not need to manually:

- split the project into tasks;
- decide how many agents are required;
- remember agent names;
- arrange execution order;
- coordinate parallel work;
- organize testing, debugging, and review.

The user should only need to say:

> What I want to build.

Auto Agent Team handles:

```text
Understand the goal
→ Inspect the project
→ Infer reasonable requirements
→ Build a task graph
→ Select the smallest effective team
→ Use native Codex subagents
→ Parallelize independent work
→ Integrate results
→ Test
→ Debug
→ Independent review
→ Final delivery
```

---

## What Counts as a Real Subagent

Auto Agent Team prefers the **native Codex subagent / delegation workflow**.

Valid:

```text
Manager
├─ Native Architect Subagent
├─ Native Developer Subagent
├─ Native Tester Subagent
└─ Native Reviewer Subagent
```

The following do not count as real agents:

```text
Reading reviewer.md
Loading another Skill
Switching the main agent's role
Self-review
Naming a phase "Developer Agent"
Manually creating unrelated top-level chats to imitate agents
```

If Codex surfaces native agent threads in its own Subagents/background-agent activity area, that is normal. It is different from manually creating unrelated top-level conversations to simulate agents.

If the current environment truly cannot invoke native subagents, Auto Agent Team uses:

```text
SEQUENTIAL_ROLE_FALLBACK
```

and explicitly states that no real multi-agent delegation occurred.

---

## Built-in Roles

| Role | Responsibility |
|---|---|
| Manager | Understand goals, decompose work, delegate, manage dependencies, integrate, deliver |
| Researcher | Investigate repositories, documentation, dependencies, and technical options |
| Architect | Architecture, module boundaries, interfaces, data flow, state lifecycle |
| Developer | Implement and modify code |
| Debugger | Reproduce problems, find root causes, fix, and verify regressions |
| Tester | Design and execute verification, edge cases, and error-path testing |
| Reviewer | Independently review correctness, security, maintainability, and test gaps |

Not every role is activated for every task.

The governing principle is:

> Use the smallest effective team that can reliably complete the work while preserving independence where it matters.

---

# Installation

The project has two layers:

1. **Auto Agent Team Skill** — core orchestration rules; recommended.
2. **Auto Agent Team Plugin** — optional MCP Runtime and Dashboard.

## 1. Install the Skill

Default Windows path:

```text
C:\Users\YourName\.agents\skills\auto-agent-team
```

PowerShell:

```powershell
cd "$env:USERPROFILE\.agents\skills"
git clone https://github.com/anlan1027/auto-agent-team.git auto-agent-team
```

Update an existing installation:

```powershell
git -C "$env:USERPROFILE\.agents\skills\auto-agent-team" pull
```

If GitHub access requires a Clash proxy, for example port `7897`:

```powershell
git -C "$env:USERPROFILE\.agents\skills\auto-agent-team" `
    -c http.proxy=http://127.0.0.1:7897 `
    -c https.proxy=http://127.0.0.1:7897 `
    pull
```

Fully restart Codex after updating.

---

## 2. Install the Optional Agent Team Plugin

The repository includes:

```text
install-plugin.ps1
```

It will:

- validate the Plugin manifest and MCP configuration;
- run an MCP Server syntax check when Node.js is available;
- install the Plugin to `~/plugins/auto-agent-team`;
- create or merge `~/.agents/plugins/marketplace.json`;
- preserve existing plugins;
- avoid installing a duplicate Auto Agent Team Skill.

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.agents\skills\auto-agent-team\install-plugin.ps1"
```

Then fully restart Codex.

If Codex shows the plugin as available rather than enabled, open the **Plugins** page, find `Auto Agent Team`, and install/enable it once.

---

# Agent Team Dashboard

The Plugin runtime exposes these tools:

```text
agent_team_create
agent_team_get
agent_team_update_member
agent_team_update_task
agent_team_append_event
agent_team_render_dashboard
```

Team state is stored in the current workspace:

```text
.agent-team/
└── team.json
```

The schema is inspired by DSH AgentTeams:

```text
team
├─ id
├─ name
├─ description
├─ executionMode
├─ phase
├─ members[]
│  ├─ id
│  ├─ name
│  ├─ role
│  ├─ agentProfile
│  ├─ status
│  ├─ currentTask
│  └─ summary
├─ tasks[]
│  ├─ id
│  ├─ subject
│  ├─ assignee
│  ├─ status
│  ├─ dependencies
│  ├─ objective
│  ├─ acceptance
│  ├─ verify
│  ├─ deliverables
│  ├─ result
│  └─ evidence
└─ events[]
```

The Dashboard currently shows:

- team name and phase;
- execution mode;
- members and statuses;
- current task;
- task dependencies;
- completion progress;
- task results;
- recent activity;
- automatic/manual refresh.

---

## About a DSH-style Fixed Right-side Panel

Auto Agent Team Dashboard uses UI containers provided by Codex Plugin / MCP Apps.

It can provide a DSH-style interface, but **the final placement is controlled by the Codex Host**.

The project does not modify the Codex client shell and cannot guarantee a permanently pinned native right-side panel.

Possible host presentation modes include:

```text
inline
fullscreen
picture-in-picture
other App UI containers supported by Codex
```

The goal is to approximate the DSH team-status experience without relying on brittle UI injection into the Codex client itself.

---

# Usage

You normally do not need to explicitly type the Skill name.

Example:

```text
Build me a local desktop todo application. Fill in reasonable requirements yourself, split the work, implement it, test it, and perform an independent code review.
```

You can also invoke it explicitly:

```text
$auto-agent-team Finish this project. Analyze it yourself, split the tasks, use suitable agents, then verify and review the result.
```

When the Plugin Runtime is enabled, the Manager can keep team state synchronized and render the Dashboard when useful.

---

# Task Decomposition Rules

1. Do not overuse Agent Team for trivial atomic tasks.
2. Build dependency graphs for complete projects and complex work.
3. Parallelize tasks that have no dependencies.
4. Preserve correct order for dependent tasks.
5. Prefer non-overlapping file ownership for parallel writing agents.
6. Keep Reviewer independent from the implementation context when possible.
7. The Manager owns final integration.
8. Do not merely concatenate agent outputs into the final solution.
9. Run real verification after implementation.
10. When verification fails, identify the root cause before fixing and regression testing.
11. Never claim agent, test, review, or debug activity that did not actually happen.

---

# Project Structure

```text
auto-agent-team/
├── README.md
├── README_EN.md
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
├── .agents/
│   └── plugins/
│       └── marketplace.json
└── plugins/
    └── auto-agent-team/
        ├── .codex-plugin/
        │   └── plugin.json
        ├── .mcp.json
        ├── README.md
        ├── mcp/
        │   └── server.mjs
        └── ui/
            └── team-dashboard.html
```

---

# Privacy and Truthfulness

For input-monitoring projects such as keyboard statistics, default to aggregate statistics and do not record by default:

```text
passwords
chat contents
complete typed text
sensitive information
```

Auto Agent Team must also remain truthful about engineering activity:

```text
No real Subagent → do not claim one existed
Tests not executed → do not claim they passed
Self-review → do not call it independent review
No evidence → do not state a root cause as fact
```

---

# Current Version

```text
v0.2.0
```

Current focus:

```text
Natural-language goal
→ Manager orchestration
→ Native Codex Subagents
→ Task dependencies and parallelism
→ Implementation / Testing / Debug / Review
→ Agent Team Runtime
→ DSH-style Dashboard
→ Final delivery
```

The Plugin Dashboard is still experimental, and its exact UI presentation depends on the MCP Apps / Plugin UI capabilities supported by the current Codex Host.

---

## License

This project is licensed under the MIT License.
