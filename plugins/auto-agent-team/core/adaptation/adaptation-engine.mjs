import { findFailures } from '../memory/failure-memory.mjs';

const VERIFICATION_RANK = {
  basic: 1,
  standard: 2,
  strong: 3,
  maximum: 4,
};

export function adaptStrategy(context = {}) {
  const task = String(context.task || '');
  const failures = findFailures(task);
  const failureCount = failures.length;

  const requestedVerification = context.verificationLevel || 'basic';
  const verificationLevel = failureCount > 0
    ? raiseVerification(requestedVerification)
    : requestedVerification;

  return {
    previousFailures: failures,
    failureCount,
    risk: failureCount === 0 ? 'normal' : failureCount === 1 ? 'elevated' : 'high',
    verificationLevel,
    requireTester: failureCount > 0,
    requireReviewer: failureCount > 1,
    adjustments: failureCount
      ? [
          'avoid known failure patterns',
          'increase verification level',
          ...(failureCount > 1 ? ['require independent review'] : []),
        ]
      : ['use default execution strategy'],
  };
}

function raiseVerification(level) {
  const current = VERIFICATION_RANK[level] || 1;
  const next = Math.min(current + 1, 4);
  return Object.keys(VERIFICATION_RANK).find(
    key => VERIFICATION_RANK[key] === next
  ) || 'maximum';
}
