import {
  saveTask,
  saveTaskMemory,
  getTask,
  getTaskMemory,
  listTaskMemory,
} from './task-memory.mjs';
import {
  saveFailure,
  recordFailure,
  findFailures,
  findSimilarFailures,
  listFailures,
} from './failure-memory.mjs';

export const experienceStore = {
  saveTask,
  saveTaskMemory,
  getTask,
  getTaskMemory,
  listTasks: listTaskMemory,
  saveFailure,
  recordFailure,
  findFailures,
  findSimilarFailures,
  listFailures,
};
