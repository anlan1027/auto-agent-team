import {
  processReflection,
  createImprovementPlan,
} from '../reflection/index.mjs';

/**
 * Complete one adaptive execution cycle.
 * This does not execute agents itself; it records the real outcome after the
 * host/runtime finishes execution and feeds that outcome into memory.
 */
export function completeExecution({ plan = {}, result = {} } = {}) {
  const reflection = processReflection({
    task: plan.task,
    plan,
    result,
  });

  const improvement = createImprovementPlan(reflection);

  return {
    task: plan.task,
    success: reflection.evaluation.success,
    reflection,
    improvement,
    nextRunHint: reflection.evaluation.success
      ? 'reuse successful execution pattern when relevant'
      : 're-plan the task so historical failure adaptation can take effect',
  };
}
