import { reflectExecution } from './reflection-engine.mjs';
import { saveTask } from '../memory/task-memory.mjs';
import { saveFailure } from '../memory/failure-memory.mjs';

export function processReflection(context = {}) {
  const reflection = reflectExecution(context);
  const baseRecord = {
    task: context.task,
    executionMode: context.plan?.executionMode,
    agents: context.plan?.agents,
    workflow: context.plan?.workflow?.workflow,
    verificationLevel: context.plan?.verificationLevel,
    evaluation: reflection.evaluation,
  };

  if (reflection.evaluation.success) {
    saveTask({
      ...baseRecord,
      result: context.result,
      lessons: reflection.lessons,
    });
  } else {
    saveFailure({
      ...baseRecord,
      reason: reflection.lessons.join(', '),
      errors: reflection.evaluation.errors,
      output: reflection.evaluation.output,
    });
  }

  return reflection;
}
