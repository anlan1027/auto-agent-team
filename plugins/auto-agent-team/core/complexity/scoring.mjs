/**
 * Lightweight heuristic complexity scoring.
 * This is intentionally model-independent so the router can run before LLM calls.
 */
export function calculateComplexityScore(task = '') {
  let score = 0;

  const rules = [
    { pattern: /架构|系统|设计|重构|architecture/i, value: 3 },
    { pattern: /代码|开发|实现|编程|code|implement/i, value: 2 },
    { pattern: /bug|调试|debug|错误|修复/i, value: 2 },
    { pattern: /测试|验证|review|检查/i, value: 1 },
    { pattern: /多个|团队|协作|multi-agent|agent team/i, value: 2 }
  ];

  for (const rule of rules) {
    if (rule.pattern.test(task)) {
      score += rule.value;
    }
  }

  if (task.length > 200) score += 2;
  if (task.length > 500) score += 2;

  return score;
}
