import { calculateComplexityScore, classifyComplexity } from './scoring.mjs';

/**
 * Analyze task complexity and select execution strategy.
 *
 * simple      -> single agent
 * medium      -> small team
 * complex     -> engineering team
 * enterprise  -> full agent organization
 */
export function analyzeTaskComplexity(task = '') {
  const score = calculateComplexityScore(task);
  const complexity = classifyComplexity(score);

  const strategies = {
    simple: {
      mode: 'single-agent',
      agents: ['developer']
    },
    medium: {
      mode: 'small-team',
      agents: ['developer', 'tester']
    },
    complex: {
      mode: 'engineering-team',
      agents: ['architect', 'developer', 'tester', 'reviewer']
    },
    enterprise: {
      mode: 'full-agent-team',
      agents: [
        'manager',
        'architect',
        'researcher',
        'developer',
        'tester',
        'debugger',
        'reviewer'
      ]
    }
  };

  return {
    score,
    complexity,
    ...strategies[complexity],
    reason: buildReason(task)
  };
}

function buildReason(task) {
  const reasons = [];

  if (/架构|设计|重构|architecture/i.test(task)) {
    reasons.push('architecture required');
  }

  if (/代码|开发|实现|bug|修复|code|implement/i.test(task)) {
    reasons.push('engineering work required');
  }

  if (/测试|验证|review|检查/i.test(task)) {
    reasons.push('verification required');
  }

  return reasons.length ? reasons : ['general task'];
}
