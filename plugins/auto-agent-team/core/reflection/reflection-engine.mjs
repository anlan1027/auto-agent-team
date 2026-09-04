import { evaluateResult } from './evaluators.mjs';

export function reflectExecution(context = {}) {
  const evaluation = evaluateResult(context.result || {});

  return {
    evaluation,
    lessons: evaluation.success
      ? ['record successful strategy']
      : ['analyze failure cause', 'update execution strategy']
  };
}
