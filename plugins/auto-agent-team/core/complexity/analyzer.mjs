import { calculateComplexityScore, classifyComplexity } from './scoring.mjs';

const LEVEL_BY_COMPLEXITY = {
  simple: 1,
  medium: 2,
  complex: 3,
  enterprise: 4,
};

/**
 * Analyze task complexity.
 *
 * The analyzer owns classification; the router owns the final execution
 * strategy. mode/agents are retained here for backward compatibility.
 */
export function analyzeTaskComplexity(task = '') {
  const score = calculateComplexityScore(task);
  const complexity = classifyComplexity(score);
  const level = LEVEL_BY_COMPLEXITY[complexity];

  const compatibilityStrategies = {
    simple: {
      mode: 'single-agent',
      agents: ['developer'],
    },
    medium: {
      mode: 'small-team',
      agents: ['developer', 'tester'],
    },
    complex: {
      mode: 'engineering-team',
      agents: ['architect', 'developer', 'tester', 'reviewer'],
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
        'reviewer',
      ],
    },
  };

  return {
    score,
    level,
    complexity,
    ...compatibilityStrategies[complexity],
    reason: buildReason(task),
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

  if (/测试|验证|review|检查|test|verify/i.test(task)) {
    reasons.push('verification required');
  }

  if (/多个文件|多个模块|前端.*后端|数据库|full stack|multi-agent/i.test(task)) {
    reasons.push('cross-module coordination required');
  }

  return reasons.length ? reasons : ['general task'];
}
