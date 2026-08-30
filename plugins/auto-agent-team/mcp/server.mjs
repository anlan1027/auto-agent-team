import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const SERVER_NAME = "Auto Agent Team Runtime";
const SERVER_VERSION = "0.3.0-dev.3";
const TEMPLATE_URI = "ui://auto-agent-team/team-dashboard.html";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, "..");
const UI_PATH = path.join(PLUGIN_ROOT, "ui", "team-dashboard.html");

const MEMBER_STATUSES = new Set(["idle", "working", "blocked", "done", "failed"]);
const TASK_STATUSES = new Set(["pending", "ready", "running", "blocked", "done", "failed"]);
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
function normalizeState(state) {
  state.schemaVersion = Math.max(Number(state.schemaVersion) || 0, 4);
  state.members = normalizeMembers(state.members);
  state.tasks = normalizeTasks(state.tasks);
  state.nativeAgents = normalizeNativeAgents(state.nativeAgents);
  state.events = Array.isArray(state.events) ? state.events : [];
  state.executionMode = EXECUTION_MODES.has(state.executionMode) ? state.executionMode : "UNKNOWN";
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
    schemaVersion: 4,
    id: "uninitialized-agent-team",
    name: "Auto Agent Team",
    description: "尚未初始化团队状态。Manager 应先创建本项目的 Agent Team。",
    executionMode: "UNKNOWN",
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
function phaseForNativeAgent(state, agent) {
  const task = agent.taskId ? state.tasks.find(item => item.id === agent.taskId) : null;
  const kind = String(task?.kind || "").toLowerCase();
  const role = String(agent.role || "").toLowerCase();
  if (["review", "code_review", "re_review"].includes(kind) || role.includes("review")) return "reviewing";
  if (["verification", "test", "testing", "regression"].includes(kind) || role.includes("test") || role.includes("verif")) return "verifying";
  if (["integration", "integrating"].includes(kind)) return "integrating";
  return "running";
}
function derivePhase(state) {
  const tasks = state.tasks;
  const active = activeNativeAgents(state);
  if (active.length) {
    if (active.some(agent => phaseForNativeAgent(state, agent) === "reviewing")) return "reviewing";
    if (active.some(agent => phaseForNativeAgent(state, agent) === "verifying")) return "verifying";
    if (active.some(agent => phaseForNativeAgent(state, agent) === "integrating")) return "integrating";
    return "running";
  }
  if (!tasks.length) return "planning";
  if (tasks.every(task => task.status === "done")) return "completed";
  const running = tasks.filter(task => task.status === "running");
  if (running.some(task => ["review", "code_review", "re_review"].includes(task.kind))) return "reviewing";
  if (running.some(task => ["verification", "test", "testing", "regression"].includes(task.kind))) return "verifying";
  if (running.some(task => ["integration", "integrating"].includes(task.kind))) return "integrating";
  if (running.length) return "running";
  const hasProgress = tasks.some(task => ["done", "ready"].includes(task.status));
  const hasBlocked = tasks.some(task => ["failed", "blocked"].includes(task.status));
  if (hasBlocked && !tasks.some(task => task.status === "ready")) return "blocked";
  if (hasProgress) return "running";
  return "planning";
}
function reconcileState(state) {
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
    description: "Create or replace Agent Team state. Start executionMode UNKNOWN unless native delegation or fallback has already been proven.",
    inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, name: { type: "string" }, description: { type: "string" }, executionMode: { type: "string", enum: [...EXECUTION_MODES] }, phase: { type: "string", enum: [...PHASES] }, members: { type: "array", items: { type: "object", additionalProperties: true } }, tasks: { type: "array", items: { type: "object", additionalProperties: true } } }, required: ["workspacePath", "name"] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "agent_team_get", title: "Get Agent Team state", description: "Read and reconcile current Agent Team state. Returns initialized=false when no state exists yet.", inputSchema: { type: "object", properties: { workspacePath: { type: "string" } }, required: ["workspacePath"] }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_set_execution_mode", title: "Set Agent Team execution mode", description: "Update execution mode after evidence changes. Native subagent start also switches mode to NATIVE_SUBAGENTS automatically.", inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, executionMode: { type: "string", enum: [...EXECUTION_MODES] }, reason: { type: "string" } }, required: ["workspacePath", "executionMode"] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_add_task", title: "Add Agent Team task", description: "Append a remediation, regression, re-review, or other newly discovered task.", inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, task: { type: "object", additionalProperties: true } }, required: ["workspacePath", "task"] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "agent_team_subagent_started", title: "Record native Codex subagent start", description: "Record a real native Codex subagent after delegation succeeds. This automatically sets executionMode=NATIVE_SUBAGENTS, tracks its display name/role/task, keeps the linked member working, and prevents premature team completion while the subagent is active.", inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, nativeAgentId: { type: "string" }, name: { type: "string" }, role: { type: "string" }, memberId: { type: ["string", "null"] }, taskId: { type: ["string", "null"] }, summary: { type: "string" } }, required: ["workspacePath", "name", "role"] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_subagent_finished", title: "Record native Codex subagent finish", description: "Record the result of a tracked native Codex subagent. Updates the linked task/member, stores concise result/evidence, and only allows completion after no native subagent remains active.", inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, nativeAgentId: { type: "string" }, name: { type: "string" }, status: { type: "string", enum: ["done", "failed", "cancelled"] }, result: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["workspacePath", "status"] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_update_member", title: "Update Agent Team member", description: "Record a truthful logical member status when no more specific native-subagent lifecycle event applies.", inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, memberId: { type: "string" }, status: { type: "string", enum: [...MEMBER_STATUSES] }, currentTask: { type: ["string", "null"] }, summary: { type: "string" } }, required: ["workspacePath", "memberId"] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_update_task", title: "Update Agent Team task", description: "Update one logical task after real work occurs. Do not mark a task done while its linked native subagent is still running.", inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, taskId: { type: "string" }, status: { type: "string", enum: [...TASK_STATUSES] }, result: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["workspacePath", "taskId"] }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
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
    const state = { schemaVersion: 4, id: slug(args.name), name: requireString(args.name, "name"), description: typeof args.description === "string" ? args.description : "", executionMode: EXECUTION_MODES.has(args.executionMode) ? args.executionMode : "UNKNOWN", phase: PHASES.has(args.phase) ? args.phase : "planning", planReviewState: "not_required", createdAt: now(), updatedAt: now(), members: normalizeMembers(args.members), tasks: normalizeTasks(args.tasks), nativeAgents: [], events: [] };
    validateTaskGraph(state);
    appendEvent(state, "team_created", `Created Agent Team with ${state.members.length} members and ${state.tasks.length} tasks.`);
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
    const previous = state.executionMode; state.executionMode = args.executionMode;
    const reason = typeof args.reason === "string" && args.reason.trim() ? ` ${args.reason.trim()}` : "";
    if (previous !== state.executionMode) appendEvent(state, "execution_mode_changed", `Execution mode ${previous} → ${state.executionMode}.${reason}`);
    writeState(root, state);
    return textAndStructured(`Execution mode is now ${state.executionMode}.`, { workspacePath: root, statePath: statePath(root), initialized: true, team: state });
  }
  if (name === "agent_team_add_task") {
    const { root, state } = requiredWorkspaceState(args);
    if (!args.task || typeof args.task !== "object" || Array.isArray(args.task)) throw new Error("task must be an object.");
    const task = normalizeTasks([args.task])[0]; state.tasks.push(task);
    try { validateTaskGraph(state); } catch (e) { state.tasks.pop(); throw e; }
    appendEvent(state, "task_added", `Added ${task.id}: ${task.subject}.`, task.assignee, task.id);
    reconcileState(state); writeState(root, state);
    return textAndStructured(`Added task ${task.id}.`, { workspacePath: root, statePath: statePath(root), initialized: true, team: state });
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
    if (typeof args.result === "string") task.result = args.result; if (Array.isArray(args.evidence)) task.evidence = args.evidence.map(String); reconcileState(state); writeState(root, state);
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
    result(id, { protocolVersion: params?.protocolVersion ?? "2025-11-25", capabilities: { tools: {}, resources: {} }, serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }, instructions: "Maintain truthful Agent Team state. On every successful native Codex delegation, call agent_team_subagent_started immediately with the Codex display name, role, member/task mapping when known. When that subagent returns or fails, call agent_team_subagent_finished before marking its task complete. Active native subagents prevent phase=completed. Native subagent start automatically switches execution mode to NATIVE_SUBAGENTS." });
    return;
  }
  if (method === "ping") return result(id, {});
  if (method === "tools/list") return result(id, { tools });
  if (method === "tools/call") { try { result(id, callTool(params?.name, params?.arguments ?? {})); } catch (e) { error(id, JsonRpcError.INVALID_PARAMS, e instanceof Error ? e.message : String(e)); } return; }
  if (method === "resources/list") return result(id, { resources: [{ uri: TEMPLATE_URI, name: "Agent Team Dashboard", mimeType: "text/html;profile=mcp-app" }] });
  if (method === "resources/read") {
    if (params?.uri !== TEMPLATE_URI) return error(id, JsonRpcError.INVALID_PARAMS, `Unknown resource: ${params?.uri ?? ""}`);
    try { const html = fs.readFileSync(UI_PATH, "utf8"); result(id, { contents: [{ uri: TEMPLATE_URI, mimeType: "text/html;profile=mcp-app", text: html, _meta: { ui: { prefersBorder: true } } }] }); }
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
