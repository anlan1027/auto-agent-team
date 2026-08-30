# Auto Agent Team

一个为 OpenAI Codex 设计的多 Agent 协作 Skill。

用户只需要用自然语言描述目标，Auto Agent Team 会自动判断任务复杂度、拆分任务，并根据需要调用不同角色完成开发、测试、调试和代码审查。

---

## 使用示例

你只需要告诉 Codex：

```text
$auto-agent-team 帮我创建一个键盘按键次数统计软件，需求你自己合理补全，完成后测试并审查。
```

Auto Agent Team 会自动进行任务拆分和协作。

---

## 工作流程

```text
用户需求
   ↓
Manager
   ↓
任务分析与拆分
   ↓
┌────────────┬────────────┬────────────┐
↓            ↓            ↓
Architect   Developer   Researcher
架构设计       代码实现       调研分析
                ↓
             Tester
               ↓
            Debugger
               ↓
            Reviewer
               ↓
             Manager
               ↓
             最终交付
```

---

## 核心理念

用户不需要自己：

- 拆分任务
- 判断需要几个 Agent
- 记住不同 Agent 的名字
- 安排 Agent 的执行顺序
- 手动协调多个 Agent
- 自己组织测试和代码审查

用户只需要描述：

> 我想做什么。

Auto Agent Team 负责：

```text
理解需求
→ 判断任务复杂度
→ 自动拆分任务
→ 选择需要的专业 Agent
→ 并行执行独立任务
→ 整合结果
→ 测试
→ Debug
→ Code Review
→ 最终交付
```

---

## 内置角色

| 角色 | 职责 |
|---|---|
| Manager | 理解需求、拆分任务、分配任务、协调 Agent、最终整合 |
| Researcher | 调研代码库、文档、依赖和技术方案 |
| Architect | 负责软件架构、模块划分、接口和数据流设计 |
| Developer | 编写和修改代码 |
| Debugger | 定位错误根因并完成修复 |
| Tester | 构建测试、运行测试、验证功能 |
| Reviewer | 独立进行代码审查并发现潜在问题 |

Manager 不会每次都调用全部角色。

它会根据任务复杂度动态选择最合适的团队。

例如：

```text
简单任务
→ 单 Agent 完成

中等任务
→ Developer + Tester + Reviewer

复杂项目
→ Manager
   ├─ Researcher
   ├─ Architect
   ├─ Developer
   ├─ Debugger
   ├─ Tester
   └─ Reviewer
```

---

## 安装

将本仓库放到 Codex 用户 Skill 目录：

```text
C:\Users\你的用户名\.agents\skills\auto-agent-team
```

Windows PowerShell 可以使用：

```powershell
cd "$env:USERPROFILE\.agents\skills"
git clone https://github.com/anlan1027/auto-agent-team.git
```

安装完成后的目录应该类似：

```text
C:\Users\你的用户名\.agents\skills\auto-agent-team
```

然后重新启动 Codex。

---

## 使用方法

### 方法一：显式调用

在 Codex 中输入：

```text
$auto-agent-team 你的需求
```

例如：

```text
$auto-agent-team 帮我创建一个键盘按键次数统计软件。
```

也可以：

```text
$auto-agent-team 帮我完成这个项目，需求你自己分析，任务你自己拆分，完成后测试并审查。
```

---

### 方法二：用于已有项目

例如：

```text
$auto-agent-team 检查这个仓库，自己拆任务并行查找问题，修复后完成测试和代码审查。
```

或者：

```text
$auto-agent-team 帮我把这个 STM32 项目做完，自己分析当前进度，拆分任务并完成验证。
```

---

## Auto Agent Team 如何处理模糊需求

普通用户通常不会这样说：

```text
请创建一个 Architect Agent，
再创建两个 Developer Agent，
最后创建 Tester 和 Reviewer。
```

用户通常只会说：

```text
帮我做一个键盘使用次数统计软件。
```

Auto Agent Team 的目标就是把这种自然语言需求自动转换成：

```text
用户目标
   ↓
需求推断
   ↓
任务拆分
   ↓
依赖关系分析
   ↓
Agent 分工
   ↓
并行执行
   ↓
代码整合
   ↓
测试验证
   ↓
独立审查
   ↓
最终交付
```

---

## 任务拆分原则

Auto Agent Team 会尽量遵循以下原则：

1. 简单任务不滥用多 Agent。
2. 复杂任务自动拆成多个子任务。
3. 没有依赖关系的任务尽量并行执行。
4. 有依赖关系的任务按顺序执行。
5. 不让多个写代码 Agent 同时修改同一个文件。
6. Developer 和 Reviewer 尽量保持独立。
7. Manager 负责最终整合。
8. 不直接把多个 Agent 的答案简单拼接。
9. 完成代码后必须尽可能执行测试。
10. 测试失败时继续定位根因，而不是直接宣称完成。

---

## 项目结构

```text
auto-agent-team/
├── SKILL.md
├── agents/
│   └── openai.yaml
└── references/
    ├── manager.md
    ├── researcher.md
    ├── architect.md
    ├── developer.md
    ├── debugger.md
    ├── tester.md
    ├── reviewer.md
    └── task-packet.md
```

---

## 文件说明

### `SKILL.md`

Auto Agent Team 的核心规则。

负责：

- 判断什么时候需要 Agent Team
- 自动拆分任务
- 选择 Agent
- 安排依赖关系
- 管理并行任务
- 整合结果
- 要求测试和审查

### `references/manager.md`

Manager 的角色规则。

负责整体项目管理和最终交付。

### `references/researcher.md`

Researcher 的角色规则。

负责：

- 阅读项目
- 搜索资料
- 分析依赖
- 技术调研

### `references/architect.md`

Architect 的角色规则。

负责：

- 架构设计
- 模块划分
- 接口设计
- 数据流设计

### `references/developer.md`

Developer 的角色规则。

负责实际代码实现。

### `references/debugger.md`

Debugger 的角色规则。

负责：

```text
复现问题
→ 收集证据
→ 分析根因
→ 修复
→ 验证
```

### `references/tester.md`

Tester 的角色规则。

负责：

- 功能测试
- 边界测试
- 异常测试
- 回归测试

### `references/reviewer.md`

Reviewer 的角色规则。

负责独立检查：

- 逻辑错误
- 边界问题
- 安全问题
- 测试遗漏
- 潜在 Bug

### `references/task-packet.md`

用于规范 Manager 给不同 Agent 分配任务时需要包含的信息。

---

## 设计原则

Auto Agent Team 的目标不是：

> Agent 越多越好。

而是：

> 使用完成当前任务所需要的最小有效团队。

例如一个简单问题：

```text
FFT 是什么？
```

不会启动 Agent Team。

但是：

```text
帮我创建一个完整的桌面软件。
```

可能会自动使用：

```text
Manager
├─ Architect
├─ Developer
├─ Tester
└─ Reviewer
```

复杂项目则可能加入：

```text
Researcher
Debugger
```

---

## 示例：键盘使用次数统计软件

用户输入：

```text
$auto-agent-team 帮我创建一个键盘按键次数统计软件，需求你自己合理补全。
```

Auto Agent Team 可能自动拆分成：

```text
Task 1
需求分析与隐私边界

Task 2
应用架构设计

Task 3
键盘事件统计模块

Task 4
数据存储模块

Task 5
桌面 UI

Task 6
测试

Task 7
代码审查
```

然后由不同角色处理。

默认情况下，键盘统计类项目只应该记录：

```text
按键次数
统计数据
使用频率
```

不应该记录：

```text
密码
聊天内容
完整输入文本
敏感信息
```

---

## 后续计划

未来可以继续增加更多专业 Agent，例如：

```text
STM32 / Embedded Agent

MATLAB / Simulink Agent

Frontend Agent

Backend Agent

Database Agent

Security Agent

Performance Agent

DevOps Agent

Documentation Agent
```

让 Manager 根据不同项目动态选择专业团队。

---

## 当前版本

```text
v0.1.0
```

当前仍处于早期版本。

主要目标是验证：

```text
自然语言需求
→ 自动拆任务
→ Agent 分工
→ 并行执行
→ 测试
→ Review
→ 最终整合
```

---

## License

后续添加。
