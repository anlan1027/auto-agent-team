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
