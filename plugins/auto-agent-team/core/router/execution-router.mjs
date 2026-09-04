import { analyzeTaskComplexity } from '../complexity/analyzer.mjs';
import { getExecutionStrategy } from './strategy.mjs';

/**
 * Adaptive execution router.
 * Converts task complexity into an execution strategy.
 */
export function routeTask(task = '') {
  const complexity = analyzeTaskComplexity(task);
  const strategy = getExecutionStrategy(complexity.level);

  return {
    task,
    complexity,
    strategy,
    agents: strategy.agents,
    parallel: strategy.parallel,
    executionMode: strategy.mode
  };
}
