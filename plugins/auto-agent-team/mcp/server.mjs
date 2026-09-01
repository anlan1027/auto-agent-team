import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const SERVER_NAME = "Auto Agent Team Runtime";
const SERVER_VERSION = "0.3.2";
const TEMPLATE_URI = "ui://auto-agent-team/team-dashboard.html";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, "..");
const UI_PATH = path.join(PLUGIN_ROOT, "ui", "team-dashboard.html");

const MEMBER_STATUSES = new Set(["idle", "working", "blocked", "done", "failed"]);
const TASK_STATUSES = new Set(["pending", "ready", "running", "blocked", "done", "failed"]);
const TASK_CLASSES = new Set(["main", "dynamic"]);
const PHASES = new Set(["planning", "running", "integrating", "verifying", "reviewing", "completed", "blocked"]);
const EXECUTION_MODES = new Set(["NATIVE_SUBAGENTS", "SEQUENTIAL_ROLE_FALLBACK", "UNKNOWN"]);
const NATIVE_AGENT_STATUSES = new Set(["running", "done", "failed", "cancelled"]);
const ACTIVE_NATIVE_AGENT_STATUSES = new Set(["running"]);
const TERMINAL_TASK_STATUSES = new Set(["done", "failed"]);
const JsonRpcError = { METHOD_NOT_FOUND: -32601, INVALID_PARAMS: -32602, INTERNAL: -32603 };

function send(message) { process.stdout.write(`${JSON.stringify(message)}\n`); }
function result(id, value) { send({ jsonrpc: "2.0", id, result: value }); }
function error(id, code, message) { send({ jsonrpc: "2.0", id, error: { code, message } }); }
function now() { return new Date().toISOString(); }
function requireString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}
function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function workspaceRoot(value) {
  const root = path.resolve(requireString(value, "workspacePath"));
  if (!path.isAbsolute(root)) throw new Error("workspacePath must be absolute.");
  return root;
}
function confined(root, ...parts) {
  const target = path.resolve(root, ...parts);
  const rel = path.relative(root, target);
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error("Path escapes workspace.");
  return target;
}
function statePath(root) { return confined(root, ".agent-team", "team.json"); }
function ensureDir(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function readState(root) {
  const file = statePath(root);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function writeState(root, state) {
  const file = statePath(root);
  ensureDir(file);
  state.updatedAt = now();
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state;
}
function slug(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "agent";
}
function isGenericTaskText(value) {
  const text = String(value ?? "").trim();
  return !text || /^(?:task|任务)(?:[\s#:_-]*\d+)?$/i.test(text);
}

function normalizeMembers(value) {
  if (!Array.isArray(value)) return [];
  return value.map((m, i) => ({
    id: String(m?.id || m?.name || `member-${i + 1}`),
    name: String(m?.name || m?.id || `member-${i + 1}`),
    role: String(m?.role || m?.name || "specialist"),
    agentProfile: m?.agentProfile ? String(m.agentProfile) : undefined,
    status: MEMBER_STATUSES.has(m?.status) ? m.status : "idle",
    statusSource: m?.statusSource === "manual" ? "manual" : "scheduler",
    currentTask: m?.currentTask ? String(m.currentTask) : null,
    summary: m?.summary ? String(m.summary) : ""
  }));
}
function normalizeTasks(value) {
  if (!Array.isArray(value)) return [];
  return value.map((t, i) => ({
    id: String(t?.id || `t${i + 1}`),
    subject: String(t?.subject || t?.objective || `Task ${i + 1}`),
    status: TASK_STATUSES.has(t?.status) ? t.status : "pending",
    taskClass: TASK_CLASSES.has(t?.taskClass) ? t.taskClass : null,
    assignee: t?.assignee ? String(t.assignee) : null,
    dependencies: Array.isArray(t?.dependencies) ? t.dependencies.map(String) : [],
    kind: String(t?.kind || "task"),
    objective: String(t?.objective || t?.subject || ""),
    acceptance: Array.isArray(t?.acceptance) ? t.acceptance.map(String) : [],
    verify: Array.isArray(t?.verify) ? t.verify.map(String) : [],
    deliverables: Array.isArray(t?.deliverables) ? t.deliverables.map(String) : [],
    result: t?.result ? String(t.result) : "",
    evidence: Array.isArray(t?.evidence) ? t.evidence.map(String) : [],
    blockedReason: t?.blockedReason ? String(t.blockedReason) : null,
    blockedBy: Array.isArray(t?.blockedBy) ? t.blockedBy.map(String) : [],
    startedAt: t?.startedAt ? String(t.startedAt) : null,
    completedAt: t?.completedAt ? String(t.completedAt) : null,
    statusChangedAt: t?.statusChangedAt ? String(t.statusChangedAt) : null
  }));
}
function normalizeNativeAgents(value) {
  if (!Array.isArray(value)) return [];
  return value.map((a, i) => ({
    id: String(a?.id || `native-agent-${i + 1}`),
    name: String(a?.name || a?.id || `Subagent ${i + 1}`),
    role: String(a?.role || "Subagent"),
    memberId: a?.memberId ? String(a.memberId) : null,
    taskId: a?.taskId ? String(a.taskId) : null,
    status: NATIVE_AGENT_STATUSES.has(a?.status) ? a.status : "running",
    summary: a?.summary ? String(a.summary) : "",
    result: a?.result ? String(a.result) : "",
    evidence: Array.isArray(a?.evidence) ? a.evidence.map(String) : [],
    startedAt: a?.startedAt ? String(a.startedAt) : now(),
    finishedAt: a?.finishedAt ? String(a.finishedAt) : null
  }));
}
function memberForAssignee(state, assignee) {
  if (!assignee) return null;
  return state.members.find(member => member.id === assignee || member.name === assignee) || null;
}
function inferTaskKind(state, task) {
  const explicit = String(task.kind || "").toLowerCase();
  if (explicit && explicit !== "task") return explicit;
  const member = memberForAssignee(state, task.assignee);
  const role = String(member?.role || member?.name || "").toLowerCase();
  if (/review|审查/.test(role)) return "review";
  if (/test|qa|verif|验证|测试/.test(role)) return "verification";
  if (/architect|架构/.test(role)) return "architecture";
  if (/research|explor|调研|研究/.test(role)) return "research";
  if (/debug|troubleshoot|调试/.test(role)) return "debug";
  if (/develop|implement|engineer|开发|实现/.test(role)) return "implementation";
  const text = `${task.subject || ""} ${task.objective || ""}`.toLowerCase();
  if (/re-review|code review|review|审查/.test(text)) return "review";
  if (/regression|verification|verify|test|qa|smoke|回归|验证|测试/.test(text)) return "verification";
  if (/integrat|delivery|deliver|整合|交付/.test(text)) return "integration";
  if (/architect|design|架构|设计/.test(text)) return "architecture";
  if (/research|investigat|调研|研究/.test(text)) return "research";
  if (/debug|root cause|bug|调试|根因/.test(text)) return "debug";
  if (/implement|build|develop|实现|开发/.test(text)) return "implementation";
  if (/requirement|plan|需求|计划/.test(text)) return "requirements";
  return "task";
}
function inferredSubject(state, task) {
  if (!isGenericTaskText(task.subject)) return task.subject;
  if (!isGenericTaskText(task.objective)) return task.objective;
  const result = String(task.result || "").toLowerCase();
  if (result.includes("security")) return "Fix security review findings";
  if (result.includes("provider") && result.includes("review")) return "Fix provider review findings";
  if (result.includes("review")) return "Fix review findings";
  if (result.includes("regression")) return "Regression verification";
  const kind = inferTaskKind(state, task);
  const dynamic = task.taskClass === "dynamic";
  const labels = {
    requirements: "Requirements and project plan",
    research: "Technical research",
    architecture: "Architecture and technical plan",
    implementation: dynamic ? "Fix follow-up implementation issues" : "Implement core application",
    integration: "Integrate and deliver",
    verification: dynamic ? "Regression verification" : "Verify build and behavior",
    review: dynamic ? "Re-review findings" : "Independent code review",
    debug: dynamic ? "Debug discovered issue" : "Debug and remediation",
    task: dynamic ? "Follow-up work" : "Project coordination"
  };
  return labels[kind] || labels.task;
}
function enrichTaskSemantics(state) {
  for (const task of state.tasks) {
    if (!task.kind || task.kind === "task") task.kind = inferTaskKind(state, task);
    if (isGenericTaskText(task.subject)) task.subject = inferredSubject(state, task);
    if (!task.objective) task.objective = task.subject;
  }
}
function normalizeState(state) {
  state.schemaVersion = Math.max(Number(state.schemaVersion) || 0, 5);
  state.members = normalizeMembers(state.members);
  state.tasks = normalizeTasks(state.tasks);
  state.nativeAgents = normalizeNativeAgents(state.nativeAgents);
  state.events = Array.isArray(state.events) ? state.events : [];
  const legacyDynamicIds = new Set(state.events.filter(event => event?.kind === "task_added" && event?.taskId).map(event => String(event.taskId)));
  for (const task of state.tasks) {
    if (!TASK_CLASSES.has(task.taskClass)) task.taskClass = legacyDynamicIds.has(task.id) ? "dynamic" : "main";
  }
  enrichTaskSemantics(state);
  state.executionMode = EXECUTION_MODES.has(state.executionMode) ? state.executionMode : "UNKNOWN";
  state.fallbackReason = optionalString(state.fallbackReason);
  if (state.nativeAgents.length > 0 && state.executionMode !== "NATIVE_SUBAGENTS") {
    state.executionMode = "NATIVE_SUBAGENTS";
    state.fallbackReason = null;
  }
  state.phase = PHASES.has(state.phase) ? state.phase : "planning";
  return state;
}
function textAndStructured(text, structuredContent, meta) {
  const out = { content: [{ type: "text", text }], structuredContent };
  if (meta) out._meta = meta;
  return out;
}
function optionalWorkspaceState(args) {
  const root = workspaceRoot(args?.workspacePath);
  const state = readState(root);
  return { root, state: state ? normalizeState(state) : null };
}
function requiredWorkspaceState(args) {
  const { root, state } = optionalWorkspaceState(args);
  if (!state) throw new Error(`No Agent Team state exists at ${statePath(root)}. Call agent_team_create first.`);
  return { root, state };
}
function uninitializedDashboardState(root) {
  return {
    schemaVersion: 5,
    id: "uninitialized-agent-team",
    name: "Auto Agent Team",
    description: "尚未初始化团队状态。Manager 应先创建本项目的 Agent Team。",
    executionMode: "UNKNOWN",
    fallbackReason: null,
    phase: "planning",
    planReviewState: "not_required",
    createdAt: null,
    updatedAt: now(),
    members: [],
    tasks: [],
    nativeAgents: [],
    events: [{ at: now(), kind: "runtime_uninitialized", message: `No Agent Team state exists yet at ${statePath(root)}.`, memberId: null, taskId: null }]
  };
}
function appendEvent(state, kind, message, memberId = null, taskId = null) {
  state.events ||= [];
  state.events.push({ at: now(), kind, message, memberId, taskId });
  if (state.events.length > 200) state.events = state.events.slice(-200);
}
function activeNativeAgents(state) {
  return state.nativeAgents.filter(agent => ACTIVE_NATIVE_AGENT_STATUSES.has(agent.status));
}

function validateTaskGraph(state) {
  const ids = new Set();
  for (const task of state.tasks) {
    if (ids.has(task.id)) throw new Error(`Duplicate task id: ${task.id}`);
    if (!TASK_CLASSES.has(task.taskClass)) throw new Error(`Task ${task.id} has invalid taskClass: ${task.taskClass}`);
    ids.add(task.id);
  }
  const memberIds = new Set();
  for (const member of state.members) { memberIds.add(member.id); memberIds.add(member.name); }
  for (const task of state.tasks) {
    if (task.assignee && state.members.length && !memberIds.has(task.assignee)) throw new Error(`Task ${task.id} references unknown assignee: ${task.assignee}`);
    for (const dep of task.dependencies) {
      if (dep === task.id) throw new Error(`Task ${task.id} cannot depend on itself.`);
      if (!ids.has(dep)) throw new Error(`Task ${task.id} references unknown dependency: ${dep}`);
    }
  }
  const byId = new Map(state.tasks.map(task => [task.id, task]));
  const visiting = new Set();
  const visited = new Set();
  function visit(id, stack) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Task dependency cycle detected: ${[...stack, id].join(" -> ")}`);
    visiting.add(id);
    for (const dep of byId.get(id).dependencies) visit(dep, [...stack, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const task of state.tasks) visit(task.id, []);
}
function reconcileDependencies(state) {
  const byId = new Map(state.tasks.map(task => [task.id, task]));
  let changed = false;
  for (let pass = 0; pass < Math.max(1, state.tasks.length); pass += 1) {
    let passChanged = false;
    for (const task of state.tasks) {
      if (TERMINAL_TASK_STATUSES.has(task.status)) continue;
      const deps = task.dependencies.map(id => byId.get(id)).filter(Boolean);
      const blockedBy = deps.filter(dep => dep.status === "failed" || dep.status === "blocked").map(dep => dep.id);
      const allDone = deps.length === 0 || deps.every(dep => dep.status === "done");
      if (blockedBy.length) {
        if (task.status !== "blocked" || task.blockedReason !== "dependency" || JSON.stringify(task.blockedBy) !== JSON.stringify(blockedBy)) {
          task.status = "blocked";
          task.blockedReason = "dependency";
          task.blockedBy = blockedBy;
          task.statusChangedAt = now();
          appendEvent(state, "task_blocked", `${task.id} blocked by ${blockedBy.join(", ")}.`, task.assignee, task.id);
          passChanged = true;
        }
        continue;
      }
      if (task.status === "blocked" && task.blockedReason !== "dependency") continue;
      if (allDone && (task.status === "pending" || (task.status === "blocked" && task.blockedReason === "dependency"))) {
        task.status = "ready";
        task.blockedReason = null;
        task.blockedBy = [];
        task.statusChangedAt = now();
        appendEvent(state, "task_ready", `${task.id} is ready; all dependencies are satisfied.`, task.assignee, task.id);
        passChanged = true;
      } else if (!allDone && task.status === "ready") {
        task.status = "pending";
        task.statusChangedAt = now();
        appendEvent(state, "task_waiting", `${task.id} is waiting for dependencies.`, task.assignee, task.id);
        passChanged = true;
      }
    }
    changed ||= passChanged;
    if (!passChanged) break;
  }
  return changed;
}
function reconcileMembers(state) {
  let changed = false;
  const active = activeNativeAgents(state);
  const allTasksDone = state.tasks.length > 0 && state.tasks.every(task => task.status === "done");
  for (const member of state.members) {
    const native = active.find(agent => agent.memberId === member.id || agent.memberId === member.name);
    if (native) {
      const nextTask = native.taskId || member.currentTask || null;
      const nextSummary = native.summary || `${native.name} · ${native.role}`;
      if (member.status !== "working" || member.currentTask !== nextTask || member.summary !== nextSummary || member.statusSource !== "native") {
        member.status = "working";
        member.currentTask = nextTask;
        member.summary = nextSummary;
        member.statusSource = "native";
        changed = true;
      }
      continue;
    }
    if (allTasksDone && active.length === 0) {
      if (member.status !== "failed" && (member.status !== "done" || member.currentTask !== null || member.summary !== "Team completed")) {
        member.status = "done";
        member.currentTask = null;
        member.summary = "Team completed";
        member.statusSource = "scheduler";
        changed = true;
      }
      continue;
    }
    const assigned = state.tasks.filter(task => task.assignee === member.id || task.assignee === member.name);
    if (!assigned.length) continue;
    const current = member.currentTask ? state.tasks.find(task => task.id === member.currentTask) : null;
    const manualActive = member.statusSource === "manual" && current && ["pending", "ready", "running", "blocked"].includes(current.status) && ["working", "blocked", "failed"].includes(member.status);
    if (manualActive) continue;
    let nextStatus = member.status;
    let nextTask = null;
    let summary = member.summary;
    const running = assigned.find(task => task.status === "running");
    const failed = assigned.find(task => task.status === "failed");
    const blocked = assigned.find(task => task.status === "blocked");
    const ready = assigned.find(task => task.status === "ready");
    const pending = assigned.find(task => task.status === "pending");
    if (running) { nextStatus = "working"; nextTask = running.id; summary = `Running ${running.subject}`; }
    else if (failed) { nextStatus = "failed"; nextTask = failed.id; summary = failed.result || `${failed.subject} failed`; }
    else if (blocked) { nextStatus = "blocked"; nextTask = blocked.id; summary = blocked.blockedBy?.length ? `Blocked by ${blocked.blockedBy.join(", ")}` : `${blocked.subject} blocked`; }
    else if (ready) { nextStatus = "idle"; nextTask = ready.id; summary = `Ready for ${ready.subject}`; }
    else if (pending) { nextStatus = "idle"; nextTask = pending.id; summary = `Waiting for ${pending.subject}`; }
    else if (assigned.every(task => task.status === "done")) { nextStatus = "done"; nextTask = null; summary = "Assigned tasks completed"; }
    if (member.status !== nextStatus || member.currentTask !== nextTask || member.summary !== summary || member.statusSource === "native") {
      member.status = nextStatus;
      member.currentTask = nextTask;
      member.summary = summary;
      member.statusSource = "scheduler";
      changed = true;
    }
  }
  return changed;
}
function phaseFromRunningTasks(tasks) {
  const kinds = new Set(tasks.map(task => inferTaskKind({ members: [] }, task)));
  if ([...kinds].some(kind => ["requirements", "research", "architecture", "implementation", "debug", "task"].includes(kind))) return "running";
  if (kinds.has("integration")) return "integrating";
  if ([...kinds].some(kind => ["verification", "test", "testing", "regression"].includes(kind))) return "verifying";
  if ([...kinds].some(kind => ["review", "code_review", "re_review"].includes(kind))) return "reviewing";
  return "running";
}
function derivePhase(state) {
  const tasks = state.tasks;
  const active = activeNativeAgents(state);
  if (!tasks.length) return "planning";
  if (tasks.every(task => task.status === "done") && active.length === 0) return "completed";
  const mainRunning = tasks.filter(task => task.taskClass === "main" && task.status === "running");
  const running = mainRunning.length ? mainRunning : tasks.filter(task => task.status === "running");
  if (running.length) return phaseFromRunningTasks(running);
  if (active.length) return "running";
  const hasBlocked = tasks.some(task => ["failed", "blocked"].includes(task.status));
  if (hasBlocked && !tasks.some(task => task.status === "ready")) return "blocked";
  const hasProgress = tasks.some(task => ["done", "ready"].includes(task.status));
  if (hasProgress) return "running";
  return "planning";
}
function reconcileState(state) {
  enrichTaskSemantics(state);
  validateTaskGraph(state);
  let changed = false;
  changed = reconcileDependencies(state) || changed;
  changed = reconcileMembers(state) || changed;
  const nextPhase = derivePhase(state);
  if (state.phase !== nextPhase) {
    const previous = state.phase;
    state.phase = nextPhase;
    appendEvent(state, "phase_changed", `Phase ${previous || "unknown"} → ${nextPhase}.`);
    changed = true;
  }
  return changed;
}
function reconcileAndPersist(root, state) {
  const changed = reconcileState(state);
  if (changed) writeState(root, state);
  return changed;
}
function findNativeAgent(state, args) {
  const id = args.nativeAgentId ? String(args.nativeAgentId) : null;
  const name = args.name ? String(args.name) : null;
  if (!id && !name) throw new Error("nativeAgentId or name is required.");
  return state.nativeAgents.find(agent => (id && agent.id === id) || (name && agent.name === name));
}

const tools = [
  {
    name: "agent_team_create", title: "Create Agent Team state",
    description: "Create or replace Agent Team state. New teams should start UNKNOWN. Direct NATIVE_SUBAGENTS creation is rejected; fallback creation requires a concrete reason. Generic task kinds/titles are normalized from logical member roles when possible.",
    inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, name: { type: "string" }, description: { type: "string" }, executionMode: { type: "string", enum: [...EXECUTION_MODES] }, reason: { type: "string" }, phase: { type: "string", enum: [...PHASES] }, members: { type: "array", items: { type: "object", additionalProperties: true } }, tasks: { type: "array", items: { type: "object", additionalProperties: true } } }, required: ["workspacePath", "name"] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "agent_team_get", title: "Get Agent Team state", description: "Read, migrate, normalize task semantics, and reconcile current Agent Team state. Returns initialized=false when no state exists yet.", inputSchema: { type: "object", properties: { workspacePath: { type: "string" } }, required: ["workspacePath"] }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_set_execution_mode", title: "Set Agent Team execution mode", description: "Update execution mode after evidence changes. Fallback requires a concrete reason. Once any real native subagent has been recorded, NATIVE_SUBAGENTS is sticky for that team run and cannot be downgraded.", inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, executionMode: { type: "string", enum: [...EXECUTION_MODES] }, reason: { type: "string" } }, required: ["workspacePath", "executionMode"] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_add_task", title: "Add Agent Team task", description: "Append a newly discovered dynamic task such as remediation, regression, re-review, or other follow-up work. Provide a meaningful subject/objective and the most accurate kind when known; generic Task N titles are normalized. Added tasks are persisted with taskClass=dynamic.", inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, task: { type: "object", additionalProperties: true } }, required: ["workspacePath", "task"] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "agent_team_subagent_started", title: "Record native Codex subagent start", description: "Record a real native Codex subagent immediately after delegation succeeds. This should be the first Runtime action after the host returns the native agent handle/name, before waiting on it, spawning another agent, or doing unrelated work. It sets and locks executionMode=NATIVE_SUBAGENTS, tracks display name/role/task, keeps the linked member working, and prevents premature completion while active.", inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, nativeAgentId: { type: "string" }, name: { type: "string" }, role: { type: "string" }, memberId: { type: ["string", "null"] }, taskId: { type: ["string", "null"] }, summary: { type: "string" } }, required: ["workspacePath", "name", "role"] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_subagent_finished", title: "Record native Codex subagent finish", description: "Record the result of a tracked native Codex subagent. Updates the linked task/member, stores concise result/evidence, and only allows completion after no native subagent remains active.", inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, nativeAgentId: { type: "string" }, name: { type: "string" }, status: { type: "string", enum: ["done", "failed", "cancelled"] }, result: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["workspacePath", "status"] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_update_member", title: "Update Agent Team member", description: "Record a truthful logical member status when no more specific native-subagent lifecycle event applies.", inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, memberId: { type: "string" }, status: { type: "string", enum: [...MEMBER_STATUSES] }, currentTask: { type: ["string", "null"] }, summary: { type: "string" } }, required: ["workspacePath", "memberId"] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_update_task", title: "Update Agent Team task", description: "Update one logical task after real work occurs. taskClass is immutable here. Do not mark a task done while its linked native subagent is still running.", inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, taskId: { type: "string" }, status: { type: "string", enum: [...TASK_STATUSES] }, result: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["workspacePath", "taskId"] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_append_event", title: "Append Agent Team event", description: "Record an important orchestration event.", inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, kind: { type: "string" }, message: { type: "string" }, memberId: { type: ["string", "null"] }, taskId: { type: ["string", "null"] } }, required: ["workspacePath", "kind", "message"] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "agent_team_render_dashboard", title: "Render Agent Team dashboard", description: "Render the live Agent Team dashboard. If no team exists, render an uninitialized dashboard instead of failing.", inputSchema: { type: "object", properties: { workspacePath: { type: "string" } }, required: ["workspacePath"] }, _meta: { ui: { resourceUri: TEMPLATE_URI }, "openai/outputTemplate": TEMPLATE_URI, "openai/toolInvocation/invoking": "Opening Agent Team dashboard…", "openai/toolInvocation/invoked": "Agent Team dashboard ready." }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }
];

function callTool(name, args = {}) {
  if (name === "agent_team_create") {
    const root = workspaceRoot(args.workspacePath);
    const requestedMode = EXECUTION_MODES.has(args.executionMode) ? args.executionMode : "UNKNOWN";
    const reason = optionalString(args.reason);
    if (requestedMode === "NATIVE_SUBAGENTS") throw new Error("Cannot create a team directly in NATIVE_SUBAGENTS. Create it as UNKNOWN, then record the successful native spawn with agent_team_subagent_started.");
    if (requestedMode === "SEQUENTIAL_ROLE_FALLBACK" && !reason) throw new Error("SEQUENTIAL_ROLE_FALLBACK requires a concrete reason describing native-spawn unavailability or failure.");
    const tasks = normalizeTasks(args.tasks).map(task => ({ ...task, taskClass: "main" }));
    const state = { schemaVersion: 5, id: slug(args.name), name: requireString(args.name, "name"), description: typeof args.description === "string" ? args.description : "", executionMode: requestedMode, fallbackReason: requestedMode === "SEQUENTIAL_ROLE_FALLBACK" ? reason : null, phase: PHASES.has(args.phase) ? args.phase : "planning", planReviewState: "not_required", createdAt: now(), updatedAt: now(), members: normalizeMembers(args.members), tasks, nativeAgents: [], events: [] };
    enrichTaskSemantics(state);
    validateTaskGraph(state);
    appendEvent(state, "team_created", `Created Agent Team with ${state.members.length} members and ${state.tasks.length} main tasks.`);
    if (state.executionMode === "SEQUENTIAL_ROLE_FALLBACK") appendEvent(state, "fallback_mode_selected", `Fallback selected at team creation. Reason: ${state.fallbackReason}`);
    reconcileState(state); writeState(root, state);
    return textAndStructured(`Created Agent Team "${state.name}".`, { workspacePath: root, statePath: statePath(root), initialized: true, team: state });
  }
  if (name === "agent_team_get") {
    const { root, state } = optionalWorkspaceState(args);
    if (!state) return textAndStructured("No Agent Team state exists yet.", { workspacePath: root, statePath: statePath(root), initialized: false, team: null });
    reconcileAndPersist(root, state);
    return textAndStructured(`Loaded Agent Team "${state.name}".`, { workspacePath: root, statePath: statePath(root), initialized: true, team: state });
  }
  if (name === "agent_team_set_execution_mode") {
    const { root, state } = requiredWorkspaceState(args);
    if (!EXECUTION_MODES.has(args.executionMode)) throw new Error(`Invalid executionMode: ${args.executionMode}`);
    const target = args.executionMode;
    const reason = optionalString(args.reason);
    if (state.nativeAgents.length > 0 && target !== "NATIVE_SUBAGENTS") throw new Error("NATIVE_SUBAGENTS is sticky for this team run because a real native subagent has already been recorded; execution mode cannot be downgraded.");
    if (target === "NATIVE_SUBAGENTS" && state.nativeAgents.length === 0) throw new Error("Cannot set NATIVE_SUBAGENTS without a tracked native subagent. Record the real native spawn with agent_team_subagent_started instead.");
    if (target === "SEQUENTIAL_ROLE_FALLBACK" && !reason) throw new Error("SEQUENTIAL_ROLE_FALLBACK requires a concrete reason describing native-spawn unavailability or failure.");
    const previous = state.executionMode;
    state.executionMode = target;
    state.fallbackReason = target === "SEQUENTIAL_ROLE_FALLBACK" ? reason : null;
    if (previous !== target) appendEvent(state, "execution_mode_changed", `Execution mode ${previous} → ${target}.${reason ? ` Reason: ${reason}` : ""}`);
    else if (target === "SEQUENTIAL_ROLE_FALLBACK" && reason) appendEvent(state, "fallback_reason_updated", `Fallback reason: ${reason}`);
    writeState(root, state);
    return textAndStructured(`Execution mode is now ${state.executionMode}.`, { workspacePath: root, statePath: statePath(root), initialized: true, team: state });
  }
  if (name === "agent_team_add_task") {
    const { root, state } = requiredWorkspaceState(args);
    if (!args.task || typeof args.task !== "object" || Array.isArray(args.task)) throw new Error("task must be an object.");
    const task = normalizeTasks([args.task])[0];
    task.taskClass = "dynamic";
    const originalSubject = task.subject;
    state.tasks.push(task);
    enrichTaskSemantics(state);
    try { validateTaskGraph(state); } catch (e) { state.tasks.pop(); throw e; }
    if (isGenericTaskText(originalSubject) && task.subject !== originalSubject) appendEvent(state, "task_subject_normalized", `Normalized generic dynamic task title ${task.id} → ${task.subject}.`, task.assignee, task.id);
    appendEvent(state, "task_added", `Added dynamic task ${task.id}: ${task.subject}.`, task.assignee, task.id);
    reconcileState(state); writeState(root, state);
    return textAndStructured(`Added dynamic task ${task.id}: ${task.subject}.`, { workspacePath: root, statePath: statePath(root), initialized: true, team: state });
  }
  if (name === "agent_team_subagent_started") {
    const { root, state } = requiredWorkspaceState(args);
    const displayName = requireString(args.name, "name"); const role = requireString(args.role, "role");
    if (args.memberId !== undefined && args.memberId !== null && !state.members.some(m => m.id === args.memberId || m.name === args.memberId)) throw new Error(`Unknown member: ${args.memberId}`);
    if (args.taskId !== undefined && args.taskId !== null && !state.tasks.some(t => t.id === args.taskId)) throw new Error(`Unknown task: ${args.taskId}`);
    const requestedId = args.nativeAgentId ? String(args.nativeAgentId) : null;
    let agent = state.nativeAgents.find(a => (requestedId && a.id === requestedId) || (!requestedId && a.name === displayName && a.status === "running"));
    if (!agent) {
      let id = requestedId || `native-${slug(displayName)}`; if (state.nativeAgents.some(a => a.id === id)) id = `${id}-${Date.now()}`;
      agent = { id, name: displayName, role, memberId: args.memberId ?? null, taskId: args.taskId ?? null, status: "running", summary: args.summary ? String(args.summary) : "", result: "", evidence: [], startedAt: now(), finishedAt: null };
      state.nativeAgents.push(agent);
    } else {
      agent.name = displayName; agent.role = role; agent.memberId = args.memberId ?? agent.memberId; agent.taskId = args.taskId ?? agent.taskId; agent.status = "running"; agent.summary = args.summary ? String(args.summary) : agent.summary; agent.finishedAt = null;
    }
    if (agent.taskId) {
      const task = state.tasks.find(t => t.id === agent.taskId); reconcileDependencies(state);
      if (["ready", "running"].includes(task.status)) {
        if (task.status !== "running") appendEvent(state, "task_update", `${task.id} ${task.status} → running.`, task.assignee, task.id);
        task.status = "running"; task.statusChangedAt = now(); if (!task.startedAt) task.startedAt = task.statusChangedAt;
      } else if (["pending", "blocked"].includes(task.status)) throw new Error(`Cannot start native subagent for task ${task.id} while task status is ${task.status}.`);
    }
    if (state.executionMode !== "NATIVE_SUBAGENTS") {
      const previous = state.executionMode; state.executionMode = "NATIVE_SUBAGENTS";
      appendEvent(state, "execution_mode_changed", `Execution mode ${previous} → NATIVE_SUBAGENTS because native subagent ${agent.name} started.`);
    }
    state.fallbackReason = null;
    appendEvent(state, "subagent_started", `${agent.name} started as ${agent.role}${agent.taskId ? ` on ${agent.taskId}` : ""}.`, agent.memberId, agent.taskId);
    reconcileState(state); writeState(root, state);
    return textAndStructured(`Recorded native subagent ${agent.name} as running.`, { workspacePath: root, statePath: statePath(root), initialized: true, nativeAgent: agent, team: state });
  }
  if (name === "agent_team_subagent_finished") {
    const { root, state } = requiredWorkspaceState(args); const agent = findNativeAgent(state, args);
    if (!agent) throw new Error("Tracked native subagent not found.");
    if (!NATIVE_AGENT_STATUSES.has(args.status) || args.status === "running") throw new Error(`Invalid terminal subagent status: ${args.status}`);
    agent.status = args.status; agent.finishedAt = now(); if (typeof args.result === "string") agent.result = args.result; if (Array.isArray(args.evidence)) agent.evidence = args.evidence.map(String);
    if (agent.taskId) {
      const task = state.tasks.find(t => t.id === agent.taskId);
      if (task) {
        const previous = task.status; task.status = args.status === "done" ? "done" : "failed"; task.statusChangedAt = now(); if (task.status === "done") task.completedAt = task.statusChangedAt; if (agent.result) task.result = agent.result; if (agent.evidence.length) task.evidence = agent.evidence.slice();
        if (previous !== task.status) appendEvent(state, "task_update", `${task.id} ${previous} → ${task.status}.`, task.assignee, task.id);
      }
    }
    appendEvent(state, "subagent_finished", `${agent.name} ${agent.status}${agent.taskId ? ` on ${agent.taskId}` : ""}.`, agent.memberId, agent.taskId);
    reconcileState(state); writeState(root, state);
    return textAndStructured(`Recorded native subagent ${agent.name} as ${agent.status}.`, { workspacePath: root, statePath: statePath(root), initialized: true, nativeAgent: agent, team: state });
  }
  if (name === "agent_team_update_member") {
    const { root, state } = requiredWorkspaceState(args); const member = state.members.find(m => m.id === args.memberId || m.name === args.memberId); if (!member) throw new Error(`Unknown member: ${args.memberId}`);
    if (args.status !== undefined) { if (!MEMBER_STATUSES.has(args.status)) throw new Error(`Invalid member status: ${args.status}`); member.status = args.status; member.statusSource = "manual"; }
    if (Object.hasOwn(args, "currentTask")) { if (args.currentTask !== null && !state.tasks.some(task => task.id === args.currentTask)) throw new Error(`Unknown currentTask: ${args.currentTask}`); member.currentTask = args.currentTask; }
    if (typeof args.summary === "string") member.summary = args.summary; appendEvent(state, "member_update", `${member.name} → ${member.status}.`, member.id, member.currentTask); reconcileState(state); writeState(root, state);
    return textAndStructured(`Updated member ${member.name}.`, { workspacePath: root, statePath: statePath(root), initialized: true, team: state });
  }
  if (name === "agent_team_update_task") {
    const { root, state } = requiredWorkspaceState(args); validateTaskGraph(state); const task = state.tasks.find(t => t.id === args.taskId); if (!task) throw new Error(`Unknown task: ${args.taskId}`);
    if (args.status === "done" && activeNativeAgents(state).some(agent => agent.taskId === task.id)) throw new Error(`Task ${task.id} cannot be marked done while a linked native subagent is still running.`);
    if (args.status !== undefined) {
      if (!TASK_STATUSES.has(args.status)) throw new Error(`Invalid task status: ${args.status}`);
      const previous = task.status; task.status = args.status; task.statusChangedAt = now(); task.blockedReason = args.status === "blocked" ? "manual" : null; task.blockedBy = [];
      if (args.status === "running" && !task.startedAt) task.startedAt = task.statusChangedAt; if (args.status === "done") task.completedAt = task.statusChangedAt; if (previous !== task.status) appendEvent(state, "task_update", `${task.id} ${previous} → ${task.status}.`, task.assignee, task.id);
    }
    if (typeof args.result === "string") task.result = args.result; if (Array.isArray(args.evidence)) task.evidence = args.evidence.map(String); enrichTaskSemantics(state); reconcileState(state); writeState(root, state);
    return textAndStructured(`Updated task ${task.id}.`, { workspacePath: root, statePath: statePath(root), initialized: true, team: state });
  }
  if (name === "agent_team_append_event") {
    const { root, state } = requiredWorkspaceState(args); appendEvent(state, requireString(args.kind, "kind"), requireString(args.message, "message"), args.memberId ?? null, args.taskId ?? null); writeState(root, state);
    return textAndStructured("Recorded Agent Team event.", { workspacePath: root, statePath: statePath(root), initialized: true, team: state });
  }
  if (name === "agent_team_render_dashboard") {
    const { root, state } = optionalWorkspaceState(args); const dashboardState = state || uninitializedDashboardState(root); if (state) reconcileAndPersist(root, dashboardState);
    return textAndStructured(state ? `Showing Agent Team dashboard for "${dashboardState.name}".` : "Showing an uninitialized Agent Team dashboard.", { workspacePath: root, statePath: statePath(root), initialized: Boolean(state), team: dashboardState }, { ui: { resourceUri: TEMPLATE_URI }, "openai/outputTemplate": TEMPLATE_URI });
  }
  throw new Error(`Unknown tool: ${name}`);
}

function handle(id, method, params) {
  if (method === "initialize") {
    result(id, { protocolVersion: params?.protocolVersion ?? "2025-11-25", capabilities: { tools: {}, resources: {} }, serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }, instructions: "Maintain truthful Agent Team state. Main tasks are created with taskClass=main; newly discovered follow-up work added through agent_team_add_task is taskClass=dynamic. Give tasks meaningful subjects and accurate kinds; the Runtime infers missing task kinds from logical member roles and normalizes generic Task N titles when possible. Project phase is driven by formal running task state, with main running tasks taking precedence; sidecar Tester/Researcher agents without a running formal task must not advance the global phase. After every successful native Codex delegation, agent_team_subagent_started MUST be the first Runtime action after the host returns the native agent handle/name, before waiting on it, spawning another agent, or doing unrelated work. When that subagent returns or fails, call agent_team_subagent_finished before marking its task complete. Active native subagents prevent phase=completed. Native subagent start automatically switches execution mode to NATIVE_SUBAGENTS, and that native mode is sticky for the rest of the team run. SEQUENTIAL_ROLE_FALLBACK requires a concrete native-spawn failure/unavailability reason." });
    return;
  }
  if (method === "ping") return result(id, {});
  if (method === "tools/list") return result(id, { tools });
  if (method === "tools/call") { try { result(id, callTool(params?.name, params?.arguments ?? {})); } catch (e) { error(id, JsonRpcError.INVALID_PARAMS, e instanceof Error ? e.message : String(e)); } return; }
  if (method === "resources/list") return result(id, { resources: [{ uri: TEMPLATE_URI, name: "Agent Team Dashboard", mimeType: "text/html;profile=mcp-app" }] });
  if (method === "resources/read") {
    if (params?.uri !== TEMPLATE_URI) return error(id, JsonRpcError.INVALID_PARAMS, `Unknown resource: ${params?.uri ?? ""}`);
    try { const html = fs.readFileSync(UI_PATH, "utf8"); result(id, { contents: [{ uri: TEMPLATE_URI, mimeType: "text/html;profile=mcp-app", text: html, _meta: { ui: { prefersBorder: true } } }] });
    catch (e) { error(id, JsonRpcError.INTERNAL, e instanceof Error ? e.message : String(e)); }
    return;
  }
  if (id !== undefined) error(id, JsonRpcError.METHOD_NOT_FOUND, `Method not found: ${method}`);
}

const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on("line", line => {
  if (!line.trim()) return;
  try { const msg = JSON.parse(line); if (msg.method !== undefined) handle(msg.id, msg.method, msg.params ?? {}); }
  catch { /* ignore malformed input */ }
});
