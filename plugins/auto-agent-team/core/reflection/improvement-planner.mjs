export function createImprovementPlan(reflection = {}) {
  const actions = [];

  if (!reflection.evaluation?.success) {
    actions.push('store failure pattern');
    actions.push('adjust future agent strategy');
  } else {
    actions.push('store successful workflow');
  }

  return {
    actions,
    priority: actions.length > 1 ? 'high' : 'normal'
  };
}
