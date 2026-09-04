/**
 * Map complexity level to execution strategy.
 */
export function getExecutionStrategy(level = 1) {
  switch (level) {
    case 1:
      return {
        mode: 'single-agent',
        agents: ['developer'],
        parallel: false
      };

    case 2:
      return {
        mode: 'small-team',
        agents: ['developer', 'tester'],
        parallel: false
      };

    case 3:
      return {
        mode: 'engineering-team',
        agents: ['architect', 'developer', 'reviewer'],
        parallel: true
      };

    case 4:
      return {
        mode: 'full-agent-team',
        agents: [
          'manager',
          'architect',
          'developer',
          'tester',
          'reviewer',
          'debugger'
        ],
        parallel: true
      };

    default:
      return {
        mode: 'single-agent',
        agents: ['developer'],
        parallel: false
      };
  }
}
