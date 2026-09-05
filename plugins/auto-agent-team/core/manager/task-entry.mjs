import { routeTask } from '../router/index.mjs';
import { adaptStrategy } from '../adaptation/index.mjs';
import { selectWorkflow } from './workflow-selector.mjs';
import { buildAdaptiveTeam } from './team-builder.mjs';

/**
 * Full adaptive preflight used before any agent spawning.
 *
 * task -> complexity -> routing -> historical adaptation -> team composition
 *      -> workflow/checkpoints
 */
export function prepareExecutionPlan(task = '') {
  const normalizedTask = String(task || '').trim();
  const routing = routeTask(normalizedTask);
  const adaptation = adaptStrategy({
    task: normalizedTask,
    verificationLevel: routing.verificationLevel,
  });

  const team = buildAdaptiveTeam({
    task: normalizedTask,
    routing,
    adaptation,
  });

  const effectiveRouting = {
    ...routing,
    agents: team.agents,
    parallel: team.parallel,
    executionMode: team.executionMode,
    verificationLevel: adaptation.verificationLevel,
  };

  const workflow = selectWorkflow(effectiveRouting);

  return {
    task: normalizedTask,
    complexity: routing.complexity,
    executionMode: effectiveRouting.executionMode,
    agents: [...team.agents],
    parallel: team.parallel,
    verificationLevel: effectiveRouting.verificationLevel,
    workflow,
    routing: effectiveRouting,
    adaptation,
    team,
    reason: [
      ...(Array.isArray(routing.reason) ? routing.reason : []),
      ...adaptation.adjustments,
    ],
  };
}

/**
 * Backward-compatible entry point.
 */
export function analyzeAndRouteTask(task = '') {
  return prepareExecutionPlan(task);
}
