/**
 * Map complexity level/classification to execution strategy.
 */
export function getExecutionStrategy(level = 1) {
  const normalized = normalizeLevel(level);

  switch (normalized) {
    case 1:
      return {
        mode: 'single-agent',
        agents: ['developer'],
        parallel: false,
        verificationLevel: 'basic',
      };

    case 2:
      return {
        mode: 'small-team',
        agents: ['developer', 'tester'],
        parallel: false,
        verificationLevel: 'standard',
      };

    case 3:
      return {
        mode: 'engineering-team',
        agents: ['architect', 'developer', 'tester', 'reviewer'],
        parallel: true,
        verificationLevel: 'strong',
      };

    case 4:
      return {
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
        parallel: true,
        verificationLevel: 'maximum',
      };

    default:
      return {
        mode: 'single-agent',
        agents: ['developer'],
        parallel: false,
        verificationLevel: 'basic',
      };
  }
}

function normalizeLevel(level) {
  if (Number.isInteger(level)) return level;

  return {
    simple: 1,
    medium: 2,
    complex: 3,
    enterprise: 4,
  }[String(level || '').toLowerCase()] || 1;
}
