// Task memory storage.
// Records task execution summaries for future adaptive decisions.

const tasks = new Map();

export function saveTaskMemory(id, data = {}) {
  const resolvedId = id || `task-${Date.now()}-${tasks.size + 1}`;
  const item = {
    id: resolvedId,
    createdAt: Date.now(),
    ...data,
  };

  tasks.set(resolvedId, item);
  return item;
}

// Convenience API for callers that naturally pass one execution object.
export function saveTask(entry = {}) {
  const id = entry.id || entry.taskId || null;
  return saveTaskMemory(id, entry);
}

export function getTaskMemory(id) {
  return tasks.get(id) || null;
}

export function getTask(id) {
  return getTaskMemory(id);
}

export function listTaskMemory() {
  return Array.from(tasks.values());
}

export function clearTaskMemory() {
  tasks.clear();
}
