# Auto Agent Team Plugin

<p align="center">
  中文 | <a href="README_EN.md">English</a>
</p>

当前稳定版本：**v0.3.0**。

这个目录包含 Auto Agent Team 的可选 Codex Plugin 层。

根目录的 `SKILL.md` 仍然负责顶层编排；Plugin 提供本地 MCP Runtime 与 DSH 风格 Dashboard，不会重复安装第二份 Skill。

## 架构

```text
用户目标
  ↓
Auto Agent Team Skill / Manager
  ↓
默认优先使用原生 Codex 子 Agent 执行适合的独立任务
  ↓
Agent Team MCP Runtime
  ├─ .agent-team/team.json
  ├─ 任务 / 依赖状态
  └─ 原生子 Agent 生命周期账本
  ↓
MCP Apps Dashboard
```

Dashboard 最终显示位置由 Codex Host 决定。Plugin 无法强制把它永久固定在 Codex 原生右侧栏。

## 执行模式

```text
UNKNOWN
NATIVE_SUBAGENTS
SEQUENTIAL_ROLE_FALLBACK
```

- `UNKNOWN`：启动状态，等待真实执行能力得到确认。
- `NATIVE_SUBAGENTS`：默认成功路径；至少一个真实原生 Codex 子 Agent 被记录后进入该状态。
- `SEQUENTIAL_ROLE_FALLBACK`：仅在原生 spawn 明确不可用、被禁用、不受支持或真实 spawn 失败后使用的单 Agent 保底状态。

Dashboard 对应显示：

```text
原生多 Agent（默认）
保底模式（单 Agent）
等待原生 Agent 确认
```

## Runtime 工具

v0.3.0 Runtime 提供 10 个工具：

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

Runtime 完全在本地运行，除 Node.js 本身外不依赖额外 npm 包。

## 原生 Codex 子 Agent 跟踪

真实 Codex 子 Agent 与逻辑成员分开记录：

```text
Codex 显示名： Heisenberg
逻辑角色：      Architect
Runtime 成员：  architect
Runtime 任务：  T1
```

真实原生委派成功后，Manager 调用 `agent_team_subagent_started` 记录启动；子 Agent 完成、失败或取消后，再调用 `agent_team_subagent_finished` 记录终态。

普通聊天、顶层 Task、`create_thread`、`fork_thread`、`handoff_thread` 或 cross-task delegation 都不算原生子 Agent。

正在运行的原生子 Agent 会参与完成门禁：只要与任务关联的原生子 Agent 仍在运行，该任务就不能被标记为完成。

## 主任务与动态后续任务

`agent_team_create` 创建团队时已经存在的任务，在 Dashboard 中视为 **主任务**。

之后通过 `agent_team_add_task` 新增的任务会单独显示为 **动态后续任务**，典型包括：

```text
Bug 修复
Review 修复
回归验证
Re-review
执行过程中发现的其他后续工作
```

这样顶部主任务总数会保持稳定，不会随着后续工作不断出现 `8/9 → 9/11 → 12/14` 这类分母持续增长的情况。

## Review 修复闭环

阻塞性的 Review 问题应新增后续任务，而不是改写已经完成的历史任务：

```text
修复 Review 问题
→ 回归验证
→ Re-review
```

新增后续工作可以让已经进入 completed 的团队重新打开并继续执行。

## Runtime 验证

运行：

```text
node ./scripts/smoke-test.mjs
```

Smoke test 会验证：

- 新工作区行为；
- 10 个 Runtime 工具；
- 原生子 Agent 生命周期记录；
- 执行模式切换；
- 关联任务完成门禁；
- 依赖调度；
- 最终成员状态收敛；
- 修复任务重新打开团队；
- Dashboard 原生 Agent 状态；
- Dashboard 主任务 / 动态任务分离。

期望输出：

```text
Auto Agent Team runtime smoke test passed.
```

## 状态文件

团队状态只写入当前选中的工作区：

```text
.agent-team/team.json
```
