import { calculateComplexityScore } from './scoring.mjs';

/**
 * Analyze a user task and decide execution complexity.
 * Levels:
 * 1 - single agent
 * 2 - small team
 * 3 - engineering workflow
 * 4 - full agent team
 */
export function analyzeTaskComplexity(task = '') {
  const score = calculateComplexityScore(task);

  let level = 1;
  let agents = ['researcher'];

  if (score >= 3 && score < 6) {
    level = 2;
    agents = ['developer', 'tester'];
  } else if (score >= 6 && score < 9) {
    level = 3;
    agents = ['architect', 'developer', 'reviewer'];
  } else if (score >= 9) {
    level = 4;
    agents = [
      'manager',
      'architect',
      'developer',
      'tester',
      'reviewer',
      'debugger'
    ];
  }

  return {
    level,
    score,
    agents,
    reason: buildReason(task)
  };
}

function buildReason(task) {
  const reasons = [];

  if (/架构|系统|设计|重构|framework|architecture/i.test(task)) {
    reasons.push('requires architecture planning');
  }

  if (/代码|开发|实现|bug|修改|build|debug/i.test(task)) {
    reasons.push('requires engineering execution');
  }

  if (/测试|验证|review|检查/i.test(task)) {
    reasons.push('requires verification');
  }

  return reasons.length ? reasons : ['general task analysis'];
}
