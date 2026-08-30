# Auto Agent Team

一个为 OpenAI Codex 设计的多 Agent 协作 Skill。

用户只需要用自然语言描述目标，Auto Agent Team 会自动判断任务复杂度、拆分任务，并根据需要调用不同角色完成开发、测试、调试和代码审查。

## 使用示例

```text
$auto-agent-team 帮我创建一个键盘按键次数统计软件，需求你自己合理补全，完成后测试并审查。
用户需求
   ↓
Manager
   ↓
任务分析与拆分
   ↓
┌──────────┬──────────┬──────────┐
↓          ↓          ↓
Architect  Developer  Researcher
架构设计     代码实现      调研分析
              ↓
            Tester
              ↓
           Reviewer
              ↓
            Manager
              ↓
            最终交付
