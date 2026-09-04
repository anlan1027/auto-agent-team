/**
 * Adaptive task complexity scoring engine.
 * Runs before agent selection to decide execution strategy.
 */

const RULES = [
  { name: 'architecture', pattern: /架构|系统设计|设计方案|重构|architecture|design/i, value: 20 },
  { name: 'implementation', pattern: /代码|开发|实现|编写|功能|code|implement|feature/i, value: 15 },
  { name: 'debugging', pattern: /bug|调试|错误|修复|debug|fix/i, value: 15 },
  { name: 'verification', pattern: /测试|验证|review|检查|test|verify/i, value: 10 },
  { name: 'multi_module', pattern: /多个文件|多个模块|前端.*后端|数据库|multi|full stack/i, value: 20 },
  { name: 'team_request', pattern: /团队|协作|agent team|multi-agent/i, value: 15 }
];

export function calculateComplexityScore(task = '') {
  let score = 0;
  const matched = [];

  for (const rule of RULES) {
    if (rule.pattern.test(task)) {
      score += rule.value;
      matched.push(rule.name);
    }
  }

  if (task.length > 200) score += 5;
  if (task.length > 500) score += 10;

  return Math.min(score, 100);
}

export function classifyComplexity(score) {
  if (score < 30) return 'simple';
  if (score < 60) return 'medium';
  if (score < 80) return 'complex';
  return 'enterprise';
}
