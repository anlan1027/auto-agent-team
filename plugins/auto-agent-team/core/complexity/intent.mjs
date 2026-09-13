// Intent is evaluated before keyword complexity. These are deliberately
// transparent heuristics, not a claim of general natural-language understanding.
const DISCUSSION = /解释|讲解|介绍|阐述|说明|讨论|是什么|什么意思|原理|如何|怎么|怎样|\b(?:explain|describe|discuss|tell\s+me\s+about|walk\s+me\s+through|what\s+(?:is|are)|how\s+(?:to|do|does|would|can))\b/i;
const ACTION = /创建|搭建|开发|实现|编写|修复|修改|改名|重构|完成|构建|设计|\b(?:build|create|develop|implement|write|fix|repair|modify|rename|refactor|finish|complete|design)\b/i;
const NEGATION = /不要|不需要|无需|不用|暂不|先不|别|仅讨论|只解释|\b(?:do\s+not|don't|dont|no\s+need\s+to|without|not\s+yet)\b/i;
const PRODUCT = /软件|应用|网站|服务|系统|项目|\b(?:app|application|website|service|system|project|software|tool)\b/i;
const PRODUCT_ACTION = /创建|搭建|开发|构建|\b(?:build|create|develop)\b/i;
const WHOLE_SCOPE = /完整|整个|从零|端到端|\b(?:complete|entire|whole|from\s+scratch|end.to.end)\b/i;
const MULTI_MODULE = /多个模块|多个文件|多模块|跨模块|前端.*后端|\b(?:multi[- ]module|multiple\s+(?:modules|files)|across\s+(?:modules|files)|full[- ]stack)\b/i;
const LOCAL_SCOPE = /函数|变量|一行|局部|\b(?:function|variable|single\s+line|typo)\b/i;
const PRODUCT_REQUEST = /^(?:我想要|我需要|我要|帮我做|\s*i\s+(?:want|need)\b)/i;
const DIRECT_ACTION = /^(?:(?:请|帮我|给我|直接|先|再|现在|你来|我要|我想要|我想|麻烦)|\s|(?:please|help\s+me|now|first|just|i\s+want\s+you\s+to)\s+)*(?:创建|搭建|开发|实现|编写|修复|修改|改名|重构|完成|构建|设计|(?:build|create|develop|implement|write|fix|repair|modify|rename|refactor|finish|complete|design)\s+)\S/i;

function negatesAction(clause) {
  const negationAt = clause.search(NEGATION);
  if (negationAt < 0) return false;
  const actionAt = PRODUCT_REQUEST.test(clause.trim()) ? 0 : clause.search(ACTION);
  // "Do not build" negates work; "build without a database" constrains
  // the product. A constraint after the requested action must not erase it.
  return actionAt < 0 || negationAt < actionAt;
}

function hasProjectScope(clause) {
  return MULTI_MODULE.test(clause) || (PRODUCT.test(clause) && !LOCAL_SCOPE.test(clause) &&
    (PRODUCT_ACTION.test(clause) || PRODUCT_REQUEST.test(clause) || WHOLE_SCOPE.test(clause) || /完成|\b(?:finish|complete)\b/i.test(clause)));
}

export function classifyTaskIntent(task = '') {
  // Quoted examples are data, not additional requests. Leave apostrophes in
  // contractions intact while masking paired quotation forms and code spans.
  const text = String(task || '').trim().replace(/“[^”]*”|「[^」]*」|‘[^’]*’|"[^"]*"|`[^`]*`|(?<!\w)'[^']*'(?!\w)/g, ' ');
  const clauses = text.split(/[，,。.!?！？;；\n]+|然后|接着|再帮我|并且|\b(?:and\s+then|then|but)\b/i);
  const executable = [];
  const general = [];
  let discussion = false;
  let executionContext = false;
  let discussedProject = false;
  for (const clause of clauses) {
    if (!clause.trim()) continue;
    if (DISCUSSION.test(clause)) {
      discussedProject ||= hasProjectScope(clause);
      const discussionAt = clause.search(DISCUSSION);
      const actionAt = clause.search(ACTION);
      // "Build the app and explain its design" still requests implementation.
      // Conversely, "explain how to build" keeps the action under discussion.
      if (actionAt >= 0 && actionAt < discussionAt && !negatesAction(clause.slice(0, discussionAt))) {
        executable.push(clause.slice(0, discussionAt).trim());
      }
      discussion = true;
      executionContext = false;
      continue;
    }
    if (negatesAction(clause)) {
      executionContext = false;
      continue;
    }
    general.push(clause.trim());
    if ((!discussion && (ACTION.test(clause) || (PRODUCT_REQUEST.test(clause.trim()) && PRODUCT.test(clause)))) || DIRECT_ACTION.test(clause.trim()) || executionContext) {
      executable.push(clause.trim());
      executionContext = true;
    }
  }

  // Split an explicit second request even when it shares a clause with an
  // explanation ("解释思路并实现它" / "explain the plan and implement it").
  for (const clause of clauses.filter(part => DISCUSSION.test(part))) {
    if (/如何|怎么|怎样|\bhow\b/i.test(clause)) continue;
    const tail = clause.split(/并(?:帮我)?|再|\band\s+/i).slice(1).join(' ');
    if (tail && !negatesAction(tail) && ACTION.test(tail)) executable.push(tail.trim());
  }

  const executionText = executable.join(' ');
  if (!executionText && discussion) return { kind: 'explanation', executionText: '', reason: 'explanation or discussion only' };

  // Carry discussed scope only for an explicit request to implement that
  // product. An unrelated later typo/function edit remains bounded work.
  const implementsDiscussedProject = discussedProject && executable.some(clause =>
    /创建|实现|开发|构建|完成|\b(?:build|create|develop|implement|finish|complete)\b/i.test(clause) &&
    /它|上述(?:应用|软件|项目)|这个(?:应用|软件|项目)|\b(?:it|that\s+(?:app|application|project)|this\s+(?:app|application|project))\b/i.test(clause) && !LOCAL_SCOPE.test(clause)
  );
  const project = executable.some(hasProjectScope) || MULTI_MODULE.test(executionText) || implementsDiscussedProject;
  return {
    kind: project ? 'project' : executable.length ? 'implementation' : 'general',
    executionText: executionText || general.join(' '),
    reason: project ? 'project scope requires engineering orchestration' : executable.length ? 'bounded engineering work' : 'general task',
  };
}
