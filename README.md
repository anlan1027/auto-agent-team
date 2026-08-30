# Auto Agent Team

<p align="center">
  中文 | <a href="README_EN.md">English</a>
</p>

面向 OpenAI Codex 的自动多 Agent 工程编排项目。

**v0.3.0** 的核心目标是：让用户只描述项目目标，由 Manager 自动分析需求、建立任务图、默认使用 Codex 原生 Subagent 完成适合独立执行的工作，并通过本地 Runtime 与 Dashboard 真实记录成员、任务、依赖、原生 Agent、验证和审查状态。

---

## 工作方式

```text
自然语言项目需求
↓
Auto Agent Team 自动触发
↓
检查工作区 / 项目规则
↓
Manager 建立逻辑团队 + 主任务图
↓
Auto Agent Team Runtime + Dashboard
↓
Codex 原生 Agent Team（默认）
├─ Researcher / Explorer
├─ Architect
├─ Developer
├─ Tester
├─ Debugger
└─ Reviewer
↓
Manager 整合
↓
真实构建 / 测试 / Debug
↓
独立原生 Reviewer
↓
修复 / 回归 / 复审
↓
最终交付
```

用户不需要自己选择 Agent 数量、角色、并行方式或执行顺序。

---

## 默认原生 Agent Team

对于完整项目和适合独立执行的工作，默认使用 Codex 的真实原生子 Agent 能力，例如宿主暴露的 `spawn_agent`、`collaboration.spawn_agent`、native multi-agent spawn 或等价内部 child-agent 操作。

一个真实原生 Agent 是当前 Manager 的内部子执行上下文，而不是另开一个普通聊天。

以下都 **不算** 原生 Subagent：

```text
create_thread
fork_thread
handoff_thread
新建普通聊天 / 顶层 Task
cross-task delegation
“由 ChatGPT/Codex 从另一个任务发送”
读取角色 markdown
加载另一个 Skill
同一上下文角色扮演
self-review
```

如果真实 native spawn 不可用、被禁用、不支持，或实际调用失败，才允许进入内部状态：

```text
SEQUENTIAL_ROLE_FALLBACK
```

Dashboard 对它的用户可见名称是：

```text
保底模式（单 Agent）
```

它不是默认 Agent Team 模式。

---

## Runtime 与 Dashboard

可选 Plugin 提供本地 MCP Runtime。团队状态写入当前工作区：

```text
.agent-team/
└── team.json
```

Runtime 当前提供 10 个工具：

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

Dashboard 可以显示：

- 执行阶段：计划 → 执行 → 验证 → 审查 → 完成
- 原生多 Agent / 单 Agent 保底状态
- 逻辑成员和当前状态
- 当前运行中的原生 Agent 与已记录 Agent
- 原生 Agent 的显示名、逻辑角色、任务、结果和证据
- 任务依赖与状态
- 主任务固定进度
- 后续动态子任务
- 测试 / Verification 结果
- Review / Re-review 结果
- 最近 Runtime 活动

### 主任务与动态子任务

团队创建时的初始任务作为 **主任务**。顶部进度保持稳定，例如：

```text
主任务完成 8/9
```

执行过程中通过 `agent_team_add_task` 新增的 Bug 修复、回归测试、Review 修复、Re-review 等会单独作为 **动态子任务** 显示，不再让顶部主任务分母不断增加。

---

## 原生 Agent 生命周期

真实 native spawn 成功后，Manager 立即记录：

```text
agent_team_subagent_started
```

原生 Agent 完成、失败或取消时记录：

```text
agent_team_subagent_finished
```

例如：

```text
name: Heisenberg
role: Architect
task: T1
status: running → done
```

Runtime 会自动把真实原生 Agent 启动视为 `NATIVE_SUBAGENTS` 证据，并阻止仍有活跃原生 Agent 时提前完成关联任务。

---

## 内置角色

| 角色 | 职责 |
|---|---|
| Manager | 需求分析、任务图、委派、协调、整合、最终交付 |
| Researcher | 代码库、文档、依赖与技术调研 |
| Architect | 架构、模块边界、接口、数据流与状态设计 |
| Developer | 有边界的实现和修改 |
| Debugger | 复现、根因定位、修复与回归 |
| Tester | 构建、测试、边界和异常路径验证 |
| Reviewer | 独立审查正确性、安全性、维护性和测试缺口 |

不会为了增加 Agent 数量强制调用全部角色。原则是使用最小有效团队，同时保留需要的独立性。

---

# 安装

项目分为两层：

1. **Auto Agent Team Skill**：核心编排规则。
2. **Auto Agent Team Plugin**：MCP Runtime + Dashboard。

## 安装 / 更新 Skill

Windows 默认路径：

```text
C:\Users\你的用户名\.agents\skills\auto-agent-team
```

首次安装：

```powershell
cd "$env:USERPROFILE\.agents\skills"
git clone https://github.com/anlan1027/auto-agent-team.git auto-agent-team
```

更新：

```powershell
git -C "$env:USERPROFILE\.agents\skills\auto-agent-team" pull
```

使用 Clash 代理（示例端口 7897）：

```powershell
git -C "$env:USERPROFILE\.agents\skills\auto-agent-team" `
    -c http.proxy=http://127.0.0.1:7897 `
    -c https.proxy=http://127.0.0.1:7897 `
    pull
```

## 安装 / 更新 Plugin

```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.agents\skills\auto-agent-team\install-plugin.ps1"
```

安装脚本会校验 manifest / MCP 配置、执行 Runtime smoke test，并安装到：

```text
C:\Users\你的用户名\plugins\auto-agent-team
```

更新后需要完全退出并重新启动 Codex。

---

# 使用

通常不需要显式输入 `$auto-agent-team`。

例如：

```text
帮我完整开发一个 Windows 本地 API 管理工具。需求和技术栈你自己合理补全，完成实现、真实测试、修复和独立代码审查。
```

项目级需求应自动进入 Auto Agent Team 编排；简单解释、孤立代码片段和极小修改不需要启动完整团队。

---

## Dashboard UI 位置

Dashboard 使用 Codex Plugin / MCP Apps 提供的 UI 容器。最终展示位置由 Codex Host 决定，可能是 inline、fullscreen、picture-in-picture 或其他宿主支持的容器。

项目不会修改 Codex 客户端 Shell，因此不能保证永久固定在原生右侧栏。

---

# 工程真实性

Auto Agent Team 不应声称没有真实发生的事情：

```text
没有 native spawn → 不声称有原生 Agent
普通 Task / 聊天 → 不登记为 native Agent
没有执行测试 → 不声称测试通过
Manager 自审 → 不称为独立 Review
没有证据 → 不武断声称根因
```

独立 Review 必须来自单独的真实原生 Reviewer 执行上下文。

---

# 项目结构

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
    ├── mcp/server.mjs
    ├── scripts/smoke-test.mjs
    └── ui/team-dashboard.html
```

---

# 当前版本

```text
v0.3.0
```

v0.3.0 重点：

```text
项目级自动触发
→ Runtime 启动
→ 原生 Agent Team 默认执行
→ 真实 native lifecycle 记录
→ 任务依赖 / 并行 / 验证 / 审查
→ 主任务固定进度 + 动态子任务
→ 单 Agent 仅作为真实失败后的保底
```

详细变更见 `CHANGELOG.md`。

---

## License

本项目使用 MIT License。
