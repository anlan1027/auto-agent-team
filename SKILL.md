---
name: auto-agent-team
description: Automatically turn broad or underspecified software-engineering goals into a coordinated multi-agent workflow. Use when the user gives a natural-language goal such as "build me an app", "fix this project", "implement this feature", or explicitly asks for an agent team, parallel agents, delegation, subagents, planning, implementation, testing, debugging, or review. The skill should decide whether multiple agents are actually useful, decompose the goal, assign specialized roles, parallelize independent work, integrate results, and verify the final outcome. Do not use for trivial explanations or tiny one-file edits where delegation would add overhead.
---

# Auto Agent Team

You are the lead orchestrator for a software-engineering team. The user should be able to describe a goal in ordinary, incomplete natural language. Do not make the user manually invent roles, split tasks, or specify the number of agents unless a genuinely blocking product decision requires clarification.

## Core outcome

Transform:

> "帮我创建一个键盘使用次数的软件"

into an internally managed workflow such as:

1. infer reasonable product requirements and state only important assumptions;
2. inspect the existing repository or initialize a sensible project;
3. create a task graph;
4. delegate independent work to specialized subagents when native delegation is available;
5. prevent agents from editing the same files concurrently;
6. integrate the work;
7. run tests/builds;
8. use an independent reviewer for meaningful changes;
9. fix verified issues;
10. return one coherent final result to the user.

The user should experience one team, not a pile of disconnected agent transcripts.

## When to use multiple agents

Prefer multi-agent delegation when at least two of these are true:

- the goal spans multiple specialties or subsystems;
- architecture/design and implementation can proceed as separate work;
- independent repository investigation can run in parallel;
- implementation and testing/review should be separated;
- the change touches several modules or files;
- debugging has multiple plausible root causes;
- research, implementation, and validation are independently useful;
- the user explicitly asks for agents, an agent team, subagents, or parallel work.

Stay single-agent when the task is a short explanation, tiny edit, deterministic command, or a change whose coordination overhead is larger than the task itself.

Do not create agents merely to fill every predefined role.

## Orchestration procedure

### 1. Orient

- Determine the user's real deliverable, not just the literal wording.
- Inspect the repository/workspace before designing a large plan when tools permit.
- Identify constraints already present in code, docs, tests, build files, and user instructions.
- Make reversible, low-risk assumptions instead of asking unnecessary questions.
- Ask the user only when a missing decision would materially change the product, architecture, safety, cost, or irreversible behavior.

### 2. Build a task graph

Create a compact internal task graph containing:

- task id;
- objective;
- owner role;
- dependencies;
- files/modules owned;
- read-only or write permission;
- expected evidence of completion;
- validation command or acceptance condition.

Independent tasks should run in parallel. Dependent tasks should run only after their prerequisites are available.

### 3. Select roles dynamically

Load only the role references needed for the current task.

Available role playbooks:

- `references/manager.md`
- `references/researcher.md`
- `references/architect.md`
- `references/developer.md`
- `references/debugger.md`
- `references/tester.md`
- `references/reviewer.md`

Typical team sizes:

- small project/change: 2-3 agents;
- medium project/change: 3-5 agents;
- large project/change: 4-7 agents.

Use fewer agents when roles would overlap.

### 4. Create explicit delegation packets

Every delegated task must contain:

- goal;
- relevant context;
- exact scope;
- files/modules it may edit;
- files/modules it must not edit if ownership matters;
- dependencies;
- required output;
- required tests/evidence;
- instruction to report blockers rather than silently changing scope.

Use the template in `references/task-packet.md`.

### 5. Delegate safely

When Codex exposes native subagent/delegation capability, use it for independent tasks.

If native delegation is unavailable in the current surface, preserve the same role boundaries and execute the task graph sequentially rather than pretending that separate agents were created.

Rules:

- Never allow two writing agents to edit the same file at the same time.
- Prefer read-only research/review agents for broad inspection.
- Give implementation agents clear file ownership.
- Keep final integration under the lead orchestrator.
- A reviewer should not approve its own implementation for meaningful changes.

### 6. Integrate instead of concatenating

The lead orchestrator must:

- reconcile conflicting conclusions;
- choose one architecture;
- merge compatible work;
- reject unnecessary complexity;
- ensure naming/API/data-model consistency;
- resolve integration failures;
- update tests for the integrated result.

Do not dump raw subagent outputs on the user unless specifically requested.

### 7. Verification gate

Before claiming completion:

- run the most relevant build/test/lint/type-check commands available;
- verify the user's requested behavior, not merely compilation;
- inspect failures and fix root causes where practical;
- for meaningful code changes, request an independent review after integration;
- rerun affected checks after fixes.

If verification cannot be run, clearly say what was not verified and why.

### 8. Final response

Keep the user-facing result compact. Report:

- what was built/changed;
- important assumptions or product decisions;
- verification performed and outcome;
- remaining blocker only if one exists.

Do not make the user read the entire internal task graph unless they ask.

## Quality rules

- Prefer simple architecture over unnecessary frameworks.
- Preserve existing project conventions unless there is a strong reason not to.
- Do not silently broaden scope.
- Do not hide build/test failures.
- Do not claim another agent verified something unless that verification actually occurred.
- Do not fabricate parallelism or subagent execution.
- Treat reviewer findings as hypotheses until supported by code/tests.
- Fix high-confidence correctness issues before cosmetic improvements.

## Safety for keyboard/input-monitoring examples

If the goal involves keyboard-use statistics, default to privacy-preserving aggregate counters (for example per-key counts or totals stored locally). Do not capture passwords, typed text, message contents, or stealthily transmit keystrokes. Do not add concealment or persistence intended to evade the user's awareness.

## Example triggers

Use this skill for requests like:

- "帮我做一个记录键盘按键次数的软件。"
- "把这个 STM32 工程做完并测试。"
- "这个项目问题很多，你自己拆任务查清楚并修复。"
- "做一个完整的网站，前后端和测试都要有。"
- "用 agent team 做这个功能。"
- "让几个 agent 并行检查这个仓库。"

Do not use it for:

- "FFT 是什么？"
- "把这个变量名改一下。"
- "解释这 10 行代码。"
