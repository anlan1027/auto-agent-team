import {
  prepareExecutionPlan,
  completeExecution,
} from '../core/manager/index.mjs';
import {
  clearFailures,
  listFailures,
} from '../core/memory/failure-memory.mjs';
import {
  clearTaskMemory,
  listTaskMemory,
} from '../core/memory/task-memory.mjs';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

clearFailures();
clearTaskMemory();

// 1. Simple work should stay on the fast single-agent path.
const simple = prepareExecutionPlan('把 README 中的版本号改一下');
assert(simple.complexity.level === 1, 'simple task should be level 1');
assert(simple.executionMode === 'single-agent', 'simple task should use single-agent mode');
assert(simple.agents.length === 1, 'simple task should keep the smallest useful team');
assert(simple.workflow.workflow === 'fast-path', 'simple task should use fast-path workflow');

// 2. A cross-module project should expand to the full lifecycle.
const enterprise = prepareExecutionPlan(
  '设计并实现一个 full stack web 系统，包含前端、后端、数据库、测试和 review，需要多个模块协作'
);
assert(enterprise.complexity.score >= 80, 'large cross-module task should score at least 80');
assert(enterprise.complexity.level === 4, 'large cross-module task should be level 4');
assert(enterprise.executionMode === 'full-agent-team', 'enterprise task should use full-agent-team');
assert(enterprise.workflow.workflow === 'full-lifecycle', 'enterprise task should use full lifecycle');
assert(enterprise.agents.includes('architect'), 'enterprise team should include architect');
assert(enterprise.agents.includes('tester'), 'enterprise team should include tester');
assert(enterprise.agents.some(role => role.includes('frontend')), 'web task should include a frontend specialist');

// 3. Record a real failure and verify that the next identical run adapts.
const retryTask = '修复 STM32 UART bug 并验证';
const firstAttempt = prepareExecutionPlan(retryTask);
const failure = completeExecution({
  plan: firstAttempt,
  result: {
    success: false,
    output: 'UART still times out',
    errors: ['timeout during smoke verification'],
  },
});

assert(failure.success === false, 'failed execution should reflect failure');
assert(failure.reflection.evaluation.quality === 'failed', 'failed execution quality must be failed');
assert(listFailures().length === 1, 'failure should be persisted in memory');

const secondAttempt = prepareExecutionPlan(retryTask);
assert(secondAttempt.adaptation.failureCount === 1, 'retry should discover the previous failure');
assert(secondAttempt.adaptation.requireTester === true, 'retry should require a tester');
assert(secondAttempt.agents.includes('tester'), 'adapted team should include tester');
assert(secondAttempt.executionMode === 'small-team', 'failed simple task should escalate to a small team');
assert(secondAttempt.verificationLevel === 'standard', 'retry should raise verification level');

// 4. A successful retry should be stored as reusable task experience.
const success = completeExecution({
  plan: secondAttempt,
  result: {
    success: true,
    output: 'UART smoke verification passed',
    errors: [],
  },
});

assert(success.success === true, 'successful retry should reflect success');
assert(listTaskMemory().length === 1, 'successful execution should be saved to task memory');

// 5. Intent precedes vocabulary: paraphrases and negated work must route by
// the requested deliverable, not by a count of engineering nouns.
clearFailures();
clearTaskMemory();
const projectRequests = [
  '创建完整网站，然后编写一个测试函数',
  'Build a complete app, then write a test function',
  '帮我创建一个完整的本地待办事项桌面软件',
  '从零搭建一个网站',
  '完成整个已有项目',
  '开发一个桌面应用',
  '我想要一个完整的桌面应用',
  'I need a complete desktop application',
  'Build a complete desktop todo application',
  'Create a website from scratch',
  'Finish this project',
  'Implement a feature across multiple modules',
  '先解释思路，然后创建一个完整应用',
  'Explain the plan, then build a complete application',
  '解释方案并实现一个完整应用',
  '不要解释，直接创建完整应用',
  'Build a complete application and explain the architecture',
  '创建完整应用并解释架构',
  '创建一个不需要数据库的完整网站',
  'Build a complete app without a database',
  '创建一个不需要数据库的完整网站并解释架构',
  '解释怎么创建完整应用，然后实现它',
  'Explain how to build a complete app, then implement it',
];
for (const task of projectRequests) {
  const plan = prepareExecutionPlan(task);
  assert(plan.complexity.intent === 'project', `expected project intent: ${task}`);
  assert(plan.complexity.level >= 3, `project must enter orchestration: ${task}`);
  assert(plan.agents.includes('architect') && plan.agents.includes('tester'), `project needs architecture and verification: ${task}`);
}

const explanationRequests = [
  '解释架构设计、代码实现、测试验证和数据库这几个术语',
  '解释架构设计，代码实现，测试验证和数据库',
  '完整桌面软件的架构是什么？',
  '讨论如何创建完整应用并实现多个模块',
  '不要创建完整软件，只解释设计和测试',
  'Explain architecture, implementation, database testing and code review',
  'How do I build a complete application?',
  'Explain how to design and implement a full stack application',
  "Do not build a complete app; explain architecture and testing only",
  'Explain a complete app architecture. Do not implement it.',
  '解释“创建一个完整应用”这句话是什么意思',
  'Explain the phrase "Build a complete application"',
  '解释“创建完整应用并实现登录”这句话',
  "Explain 'build a complete application and implement login'",
  '讲解软件架构、数据库设计、代码实现、测试验证和安全这几个概念',
  '介绍数据库设计、代码实现和测试验证',
  '阐述如何构建完整应用',
  'Tell me about architecture, database design, implementation, testing and security',
  'Walk me through how to build a complete application',
];
for (const task of explanationRequests) {
  const plan = prepareExecutionPlan(task);
  assert(plan.complexity.intent === 'explanation', `expected explanation intent: ${task}`);
  assert(plan.complexity.score === 0, `engineering vocabulary must not inflate explanations: ${task}`);
  assert(plan.executionMode === 'single-agent' && plan.agents.length === 1, `explanation should stay lightweight: ${task}`);
  assert(!plan.reason.includes('engineering work required'), `explanation must not claim implementation is required: ${task}`);
}

for (const task of [
  '修改一个变量名',
  '修复这个函数',
  'Fix a function in this application',
  'Explain the function, then fix the typo',
  '不要重构整个项目，只修改一个变量名',
  'Explain how to build a complete app, then fix a typo',
  '解释怎么创建完整应用，然后实现一个短函数',
]) {
  const plan = prepareExecutionPlan(task);
  assert(plan.complexity.intent === 'implementation', `expected bounded implementation: ${task}`);
  assert(plan.executionMode === 'single-agent', `bounded edit should stay lightweight: ${task}`);
}

// Even repeated failures explaining terminology do not authorize an engineering
// team. Keep history visible while suppressing tester/reviewer escalation.
const explanationTask = explanationRequests[0];
for (let attempt = 0; attempt < 2; attempt += 1) {
  completeExecution({ plan: prepareExecutionPlan(explanationTask), result: { success: false, errors: ['unclear explanation'] } });
}
const explanationRetry = prepareExecutionPlan(explanationTask);
assert(explanationRetry.adaptation.failureCount >= 1, 'explanation history should remain visible');
assert(!explanationRetry.adaptation.requireTester && !explanationRetry.adaptation.requireReviewer, 'explanation history must not demand engineering agents');
assert(explanationRetry.executionMode === 'single-agent' && explanationRetry.agents.length === 1, 'failed explanations must remain single-agent');
assert(explanationRetry.verificationLevel === 'basic', 'explanation verification should remain lightweight');
clearFailures();
clearTaskMemory();

console.log('Adaptive core smoke test passed.');
console.log(JSON.stringify({
  simple: {
    level: simple.complexity.level,
    mode: simple.executionMode,
    agents: simple.agents,
  },
  enterprise: {
    score: enterprise.complexity.score,
    level: enterprise.complexity.level,
    mode: enterprise.executionMode,
    agents: enterprise.agents,
  },
  retry: {
    failureCount: secondAttempt.adaptation.failureCount,
    mode: secondAttempt.executionMode,
    verificationLevel: secondAttempt.verificationLevel,
    agents: secondAttempt.agents,
  },
}, null, 2));
