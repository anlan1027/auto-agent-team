import { findFailures, saveFailure } from '../memory/failure-memory.mjs';

export function adaptStrategy(context = {}) {
  const failures = findFailures(context.task || '');

  return {
    previousFailures: failures,
    adjustments: failures.length
      ? ['avoid known failure patterns', 'increase verification level']
      : ['use default execution strategy'],
  };
}
