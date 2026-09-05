import { analyzeTaskComplexity } from '../complexity/analyzer.mjs';
import { getExecutionStrategy } from './strategy.mjs';

/**
 * Adaptive execution router.
 * Converts task complexity into a stable execution strategy.
 */
export function routeTask(task = '') {
  const complexity = analyzeTaskComplexity(task);
  const strategy = getExecutionStrategy(
    complexity.level ?? complexity.complexity
  );

  return {
    task,
    complexity,
    strategy,
    agents: [...strategy.agents],
    parallel: strategy.parallel,
    verificationLevel: strategy.verificationLevel,
    executionMode: strategy.mode,
    reason: complexity.reason,
  };
}
