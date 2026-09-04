import { reflectExecution } from './reflection-engine.mjs';
import { saveTask } from '../memory/task-memory.mjs';
import { saveFailure } from '../memory/failure-memory.mjs';

export function processReflection(context = {}) {
  const reflection = reflectExecution(context);

  if (reflection.evaluation.success) {
    saveTask({
      task: context.task,
      result: reflection,
    });
  } else {
    saveFailure({
      task: context.task,
      reason: reflection.lessons.join(', '),
    });
  }

  return reflection;
}
