import { saveTaskMemory, getTaskMemory } from './task-memory.mjs';
import { recordFailure, findSimilarFailures } from './failure-memory.mjs';

export const experienceStore = {
  saveTask: saveTaskMemory,
  getTask: getTaskMemory,
  recordFailure,
  findFailures: findSimilarFailures,
};
