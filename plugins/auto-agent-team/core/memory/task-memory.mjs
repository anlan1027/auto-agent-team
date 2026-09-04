// Task memory storage
// Records task execution summaries for future adaptive decisions.

const tasks = new Map();

export function saveTaskMemory(id, data = {}) {
  tasks.set(id, {
    id,
    createdAt: Date.now(),
    ...data,
  });
  return tasks.get(id);
}

export function getTaskMemory(id) {
  return tasks.get(id) || null;
}

export function listTaskMemory() {
  return Array.from(tasks.values());
}
