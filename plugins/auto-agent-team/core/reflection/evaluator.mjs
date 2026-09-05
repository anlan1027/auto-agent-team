export function evaluateResult({ success = false, output = '', errors = [] } = {}) {
  const normalizedErrors = Array.isArray(errors) ? errors : [String(errors)];
  const score = success
    ? Math.max(0, 1 - normalizedErrors.length * 0.1)
    : 0;

  return {
    success: Boolean(success),
    score,
    output,
    errors: normalizedErrors,
    quality: !success
      ? 'failed'
      : score >= 0.8
        ? 'good'
        : score >= 0.5
          ? 'needs-improvement'
          : 'poor',
  };
}
