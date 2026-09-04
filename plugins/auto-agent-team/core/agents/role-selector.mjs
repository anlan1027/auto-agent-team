import { capabilityMap } from "./capability-map.mjs";

export function selectAgentRoles(task = "") {
  const text = task.toLowerCase();
  const roles = new Set();

  if (/stm32|mcu|firmware|embedded|gpio|uart|can/.test(text)) {
    capabilityMap.embedded.forEach(r => roles.add(r));
  }

  if (/pid|motor|control|svm|svpwm|spwm/.test(text)) {
    capabilityMap.control.forEach(r => roles.add(r));
  }

  if (/web|website|frontend|backend|api|database/.test(text)) {
    capabilityMap.web.forEach(r => roles.add(r));
  }

  if (/test|bug|error|debug/.test(text)) {
    capabilityMap.testing.forEach(r => roles.add(r));
  }

  if (roles.size === 0) {
    capabilityMap.general.forEach(r => roles.add(r));
  }

  return [...roles];
}
