export function selectWorkflow(routeResult = {}) {
  const mode = routeResult.executionMode;

  switch (mode) {
    case "single-agent":
      return {
        workflow: "fast-path",
        checkpoints: ["execute", "verify"],
      };

    case "small-team":
      return {
        workflow: "collaborative",
        checkpoints: ["plan", "execute", "test"],
      };

    case "engineering-team":
      return {
        workflow: "engineering-review",
        checkpoints: ["architecture", "implementation", "review", "verify"],
      };

    case "full-agent-team":
      return {
        workflow: "full-lifecycle",
        checkpoints: ["planning", "architecture", "implementation", "testing", "review", "verification"],
      };

    default:
      return {
        workflow: "fast-path",
        checkpoints: ["execute", "verify"],
      };
  }
}
