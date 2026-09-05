// Failure memory for learning from previous mistakes.
// In-memory by design for the first runtime version. Persistence can be added
// later without changing the public API below.

const failures = [];

export function recordFailure(entry = {}) {
  const item = {
    id: entry.id || `failure-${Date.now()}-${failures.length + 1}`,
    timestamp: Date.now(),
    ...entry,
  };

  failures.push(item);
  return item;
}

// Public semantic alias used by reflection/adaptation code.
export function saveFailure(entry = {}) {
  return recordFailure(entry);
}

export function findSimilarFailures(keyword = '') {
  const normalized = String(keyword || '').trim().toLowerCase();
  if (!normalized) return [];

  return failures.filter(item =>
    JSON.stringify(item).toLowerCase().includes(normalized)
  );
}

// Public semantic alias used by the adaptation engine.
export function findFailures(keyword = '') {
  return findSimilarFailures(keyword);
}

export function listFailures() {
  return [...failures];
}

export function clearFailures() {
  failures.length = 0;
}
