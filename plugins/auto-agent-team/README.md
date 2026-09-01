# Auto Agent Team Plugin

<p align="center">
  中文 | <a href="README_EN.md">English</a>
</p>

当前稳定版本：**v0.3.2**。

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

进入 `SEQUENTIAL_ROLE_FALLBACK` 必须提供具体原因，Runtime 会保存为 `fallbackReason`，Dashboard 会直接显示“保底原因”。

一旦真实原生子 Agent 已经成功记录，`NATIVE_SUBAGENTS` 对本次团队运行保持锁定；即使当前活跃原生 Agent 暂时为 0，也不能再降级到 `UNKNOWN` 或保底模式。

Dashboard 对应显示：

```text
原生多 Agent（默认）
保底模式（单 Agent）
等待原生 Agent 确认
```

## Runtime 工具

v0.3.2 Runtime 提供 10 个工具：

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

v0.3.2 进一步要求生命周期写入紧贴真实 spawn：宿主返回 native Agent handle / display name 后，`agent_team_subagent_started` 应成为第一条 Runtime 动作，再等待该 Agent、创建下一个 Agent 或继续其他工作，以缩短 Host 与 Dashboard 的短暂计数不同步窗口。

普通聊天、顶层 Task、`create_thread`、`fork_thread`、`handoff_thread` 或 cross-task delegation 都不算原生子 Agent。

正在运行的原生子 Agent 会参与完成门禁：只要与任务关联的原生子 Agent 仍在运行，该任务就不能被标记为完成。

## 任务语义与项目阶段

v0.3.2 会在 `kind` 缺失或为通用 `task` 时，根据逻辑成员角色推断更准确的任务类型：

```text
Researcher / Explorer → research
Architect → architecture
Developer → implementation
Tester / QA → verification
Debugger → debug
Reviewer → review
```

通用的 `Task 1` / `Task 2` 标题也会在可能时被归一化为有意义的任务标题。Manager 仍应优先直接提供真实、具体的 subject，尤其是 Review 修复和动态任务。

全局阶段现在由正式 Runtime 任务状态驱动，运行中的主任务优先。仅有 sidecar Tester/Researcher 在做准备工作，不会再提前把整个项目推进到“验证/审查”。例如：

```text
T2 implementation running + sidecar Tester planning
→ 执行

T3 verification running
→ 验证

T4 review running
→ 审查
```

Dashboard 的“测试 / Verification”和“Review / Re-review”区域同时带有角色兜底分类；即使旧任务错误保存为 `kind: task`，Tester/Reviewer 的真实结果也不会再显示成“暂无结果”。

## 主任务与动态后续任务

schema v5 把任务类别直接写入 Runtime 状态：

```text
taskClass: main
taskClass: dynamic
```

`agent_team_create` 创建的初始任务强制保存为 `main`；之后通过 `agent_team_add_task` 新增的任务强制保存为 `dynamic`。

典型动态任务包括：

```text
Bug 修复
Review 修复
回归验证
Re-review
执行过程中发现的其他后续工作
```

这样顶部主任务总数保持稳定，不会随着后续工作不断出现 `8/9 → 9/11 → 12/14` 这类分母持续增长。旧 schema v4 状态仍可兼容：Runtime 会根据已有 `task_added` 事件恢复动态任务语义。

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
- schema v5 与 `taskClass`；
- 原生子 Agent 生命周期记录；
- 执行模式切换；
- 保底模式必须提供原因；
- 原生模式成功后禁止降级；
- 关联任务完成门禁；
- 角色驱动的 task kind 推断；
- 通用任务标题归一化；
- sidecar Tester 不会提前推进全局阶段；
- 正式验证任务进入 `verifying`；
- 正式 Reviewer 任务进入 `reviewing`；
- Dashboard 主任务 / 动态任务分离；
- Dashboard 对验证 / Review 的角色兜底分类；
- Dashboard 保底原因显示。

期望输出：

```text
Auto Agent Team runtime smoke test passed.
```

## 状态文件

团队状态只写入当前选中的工作区：

```text
.agent-team/team.json
```
