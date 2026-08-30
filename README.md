# Auto Agent Team

<p align="center">
  中文 | <a href="README_EN.md">English</a>
</p>

一个面向 OpenAI Codex 的自动多 Agent 工程编排项目。

用户只需要描述目标，Auto Agent Team 负责分析需求、拆分任务、选择角色、调用 Codex 原生 Subagent、协调并行工作、整合代码、测试、调试和独立审查。

从 v0.2.0 开始，项目同时提供一个可选的 **Codex Plugin + MCP Runtime + Agent Team Dashboard**，用于显示类似 DSH AgentTeams 的团队成员、任务、依赖、进度、验证和审查状态。

---

## 你可以得到什么

```text
自然语言需求
↓
Auto Agent Team Skill
↓
Manager
↓
任务图 / 依赖关系
↓
Codex 原生 Subagents
├─ Researcher
├─ Architect
├─ Developer
├─ Tester
├─ Debugger
└─ Reviewer
↓
整合 / 验证 / 审查
↓
最终交付
```

如果安装可选 Plugin：

```text
Manager / Subagents
↓
Agent Team MCP Runtime
↓
.agent-team/team.json
↓
DSH 风格 Agent Team Dashboard
```

---

## 核心原则

用户不需要自己：

- 拆分任务
- 判断需要几个 Agent
- 记住 Agent 名字
- 安排执行顺序
- 手动协调并行工作
- 自己安排测试、调试和审查

用户只需要说：

> 我想做什么。

Auto Agent Team 负责：

```text
理解需求
→ 检查项目
→ 推断合理需求
→ 设计任务图
→ 选择最小有效团队
→ 调用 Codex 原生 Subagent
→ 并行独立任务
→ 整合结果
→ 测试
→ Debug
→ 独立 Review
→ 最终交付
```

---

## 什么才算真实 Subagent

Auto Agent Team 优先使用 **Codex 原生 Subagent / delegation 工作流**。

有效：

```text
Manager
├─ 原生 Architect Subagent
├─ 原生 Developer Subagent
├─ 原生 Tester Subagent
└─ 原生 Reviewer Subagent
```

不算真实 Agent：

```text
读取 reviewer.md
加载另一个 Skill
主 Agent 切换角色
self-review
把阶段命名为 Developer Agent
为了伪装 Agent 而手动创建无关的新聊天
```

Codex 自己在 Subagents / background-agent 活动区域显示原生 Agent 线程是正常的；这和人为创建一堆独立顶层聊天来模拟 Agent 不一样。

如果当前环境真的无法调用原生 Subagent，Auto Agent Team 会使用：

```text
SEQUENTIAL_ROLE_FALLBACK
```

并明确说明没有发生真实多 Agent 委派。

---

## 内置角色

| 角色 | 职责 |
|---|---|
| Manager | 理解需求、拆任务、委派、依赖管理、整合、最终交付 |
| Researcher | 调研代码库、文档、依赖和技术方案 |
| Architect | 架构、模块边界、接口、数据流、状态生命周期 |
| Developer | 实现和修改代码 |
| Debugger | 复现问题、定位根因、修复、回归验证 |
| Tester | 构建和执行验证、测试边界与异常路径 |
| Reviewer | 独立审查正确性、安全性、维护性和测试缺口 |

不会每次调用全部角色。

原则是：

> 使用能够可靠完成任务的最小有效团队，同时保留真正需要的独立性。

---

# 安装

项目分为两层：

1. **Auto Agent Team Skill**：核心编排规则，推荐安装。
2. **Auto Agent Team Plugin**：可选，提供 MCP Runtime 和 Dashboard。

## 1. 安装 Skill

Windows 默认路径：

```text
C:\Users\你的用户名\.agents\skills\auto-agent-team
```

PowerShell：

```powershell
cd "$env:USERPROFILE\.agents\skills"
git clone https://github.com/anlan1027/auto-agent-team.git auto-agent-team
```

已有安装更新：

```powershell
git -C "$env:USERPROFILE\.agents\skills\auto-agent-team" pull
```

如果 GitHub 需要 Clash 代理，例如端口 `7897`：

```powershell
git -C "$env:USERPROFILE\.agents\skills\auto-agent-team" `
    -c http.proxy=http://127.0.0.1:7897 `
    -c https.proxy=http://127.0.0.1:7897 `
    pull
```

更新后完全重启 Codex。

---

## 2. 安装可选 Agent Team Plugin

仓库提供：

```text
install-plugin.ps1
```

它会：

- 校验 Plugin manifest 和 MCP 配置；
- 在 Node.js 可用时执行 MCP Server 语法检查；
- 把 Plugin 安装到用户级 `~/plugins/auto-agent-team`；
- 创建或合并 `~/.agents/plugins/marketplace.json`；
- 保留你现有的其他 Plugin；
- 不重复安装第二份 Auto Agent Team Skill。

执行：

```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.agents\skills\auto-agent-team\install-plugin.ps1"
```

安装后完全重启 Codex。

如果 Codex 把它显示为“可用”而不是“已启用”，在 Codex 的 **插件** 页面找到 `Auto Agent Team` 并安装/启用一次。

---

# Agent Team Dashboard

Plugin 运行时提供以下工具：

```text
agent_team_create
agent_team_get
agent_team_update_member
agent_team_update_task
agent_team_append_event
agent_team_render_dashboard
```

团队状态写入当前工作区：

```text
.agent-team/
└── team.json
```

结构参考 DSH AgentTeams：

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

Dashboard 当前可以显示：

- 团队名称和阶段
- 执行模式
- 成员与状态
- 当前任务
- 任务依赖
- 完成进度
- 任务结果
- 最近活动
- 自动刷新 / 手动刷新

---

## 关于 DSH 那种右侧固定浮窗

Auto Agent Team Dashboard 使用 Codex Plugin / MCP Apps 提供的 UI 容器。

因此可以做 DSH 风格界面，但 **最终显示位置由 Codex Host 决定**。

当前项目不会修改 Codex 客户端 Shell，也不能保证强制固定在原生右侧栏。

可能的宿主呈现形式包括：

```text
inline
fullscreen
picture-in-picture
其他 Codex 支持的 App UI 容器
```

目标是尽量接近 DSH 的团队状态体验，同时不通过修改 Codex 客户端本体实现脆弱的 UI 注入。

---

# 使用方法

通常不需要显式写 Skill 名。

例如：

```text
帮我创建一个本地待办事项桌面软件。需求你自己合理补全，自己拆分任务，完成实现、测试和独立代码审查。
```

也可以显式调用：

```text
$auto-agent-team 帮我完成这个项目，自己分析、拆任务、调用合适的 Agent，完成后验证并审查。
```

如果 Plugin Runtime 已启用，Manager 会在适合时维护团队状态并调用 Dashboard。

---

# 任务拆分原则

1. 简单原子任务不滥用 Agent Team。
2. 完整项目和复杂任务自动建立依赖图。
3. 没有依赖的任务尽量并行。
4. 有依赖的任务保持正确顺序。
5. 并行写代码时尽量分配不重叠文件所有权。
6. Reviewer 尽量与实现上下文独立。
7. Manager 负责最终整合。
8. 不把 Agent 输出简单拼接成最终方案。
9. 完成实现后执行真实验证。
10. 验证失败时先找根因，再修复和回归测试。
11. 不声称没有发生过的 Agent、测试、Review 或 Debug 活动。

---

# 项目结构

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

# 隐私与真实性

对于键盘统计等输入监测项目，默认只做聚合统计，不默认记录：

```text
密码
聊天内容
完整输入文本
敏感信息
```

Auto Agent Team 还必须保持工程真实性：

```text
没有真实 Subagent → 不声称有
没有执行测试 → 不声称通过
self-review → 不声称独立审查
没有证据 → 不武断声称根因
```

---

# 当前版本

```text
v0.2.0
```

当前重点：

```text
自然语言需求
→ Manager 自动编排
→ Codex 原生 Subagent
→ 任务依赖与并行
→ 实现 / 测试 / Debug / Review
→ Agent Team Runtime
→ DSH 风格 Dashboard
→ 最终交付
```

Plugin Dashboard 仍属于实验性能力，具体 UI 呈现取决于 Codex Host 当前支持的 MCP Apps/Plugin UI 能力。

---

## License

本项目使用 MIT License。
