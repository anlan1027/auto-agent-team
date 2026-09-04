import { routeTask } from "../router/index.mjs";

/**
 * Unified entry point for adaptive execution.
 * The manager should call this before spawning agents.
 */
export function analyzeAndRouteTask(task = "") {
  const routing = routeTask(task);

  return {
    task,
    complexity: routing.complexity,
    executionMode: routing.executionMode,
    agents: routing.agents,
    parallel: routing.parallel,
    reason: routing.reason,
  };
}
