// Failure memory for learning from previous mistakes.

const failures = [];

export function recordFailure(entry = {}) {
  const item = {
    timestamp: Date.now(),
    ...entry,
  };
  failures.push(item);
  return item;
}

export function findSimilarFailures(keyword = '') {
  return failures.filter(item =>
    JSON.stringify(item).toLowerCase().includes(keyword.toLowerCase())
  );
}

export function listFailures() {
  return failures;
}
