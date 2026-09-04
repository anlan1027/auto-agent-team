export function evaluateResult({ success = false, output = '', errors = [] } = {}) {
  const score = success ? 1 : Math.max(0, 1 - errors.length * 0.2);

  return {
    success,
    score,
    output,
    errors,
    quality: score >= 0.8 ? 'good' : score >= 0.5 ? 'needs-improvement' : 'poor'
  };
}
