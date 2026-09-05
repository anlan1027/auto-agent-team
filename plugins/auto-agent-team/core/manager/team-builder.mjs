import { selectAgentRoles } from '../agents/index.mjs';

const SPECIALIST_LIMIT_BY_LEVEL = {
  1: 1,
  2: 2,
  3: 4,
  4: 6,
};

/**
 * Compose the smallest useful team from the base routing strategy,
 * task-specific capabilities, and historical adaptation signals.
 */
export function buildAdaptiveTeam({ task = '', routing = {}, adaptation = {} } = {}) {
  const level = routing.complexity?.level || 1;
  const baseAgents = Array.isArray(routing.agents) ? routing.agents : ['developer'];
  const specialists = selectAgentRoles(task);
  const specialistLimit = SPECIALIST_LIMIT_BY_LEVEL[level] || 1;

  // A simple task stays single-agent unless history proves extra verification is needed.
  if (level === 1 && !adaptation.requireTester && !adaptation.requireReviewer) {
    return {
      agents: [pickPrimarySpecialist(specialists, baseAgents)],
      specialistRoles: specialists.slice(0, 1),
      executionMode: 'single-agent',
      parallel: false,
      escalated: false,
    };
  }

  const agents = new Set(baseAgents);
  for (const role of specialists.slice(0, specialistLimit)) {
    agents.add(role);
  }

  if (adaptation.requireTester) agents.add('tester');
  if (adaptation.requireReviewer) agents.add('reviewer');

  const finalAgents = [...agents];
  const executionMode = deriveExecutionMode(
    routing.executionMode,
    finalAgents,
    adaptation
  );

  return {
    agents: finalAgents,
    specialistRoles: specialists.slice(0, specialistLimit),
    executionMode,
    parallel: routing.parallel && finalAgents.length > 2,
    escalated: executionMode !== routing.executionMode,
  };
}

function pickPrimarySpecialist(specialists, baseAgents) {
  const preferred = specialists.find(role => !/review|test|debug/i.test(role));
  return preferred || specialists[0] || baseAgents[0] || 'developer';
}

function deriveExecutionMode(baseMode, agents, adaptation) {
  if (adaptation.requireReviewer && baseMode === 'small-team') {
    return 'engineering-team';
  }

  if (adaptation.requireTester && baseMode === 'single-agent') {
    return 'small-team';
  }

  if (agents.length >= 6 && baseMode !== 'full-agent-team') {
    return 'full-agent-team';
  }

  return baseMode || 'single-agent';
}
