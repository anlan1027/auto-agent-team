import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const SERVER_NAME = "Auto Agent Team Runtime";
const SERVER_VERSION = "0.3.0-dev.4";
const TEMPLATE_URI = "ui://auto-agent-team/team-dashboard.html";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_PATH = path.join(path.resolve(__dirname, ".."), "ui", "team-dashboard.html");

const MEMBER_STATUSES = new Set(["idle", "working", "blocked", "done", "failed"]);
const TASK_STATUSES = new Set(["pending", "ready", "running", "blocked", "done", "failed"]);
const PHASES = new Set(["planning", "running", "integrating", "verifying", "reviewing", "completed", "blocked"]);
const EXECUTION_MODES = new Set(["NATIVE_SUBAGENTS", "SEQUENTIAL_ROLE_FALLBACK", "UNKNOWN"]);
const NATIVE_AGENT_STATUSES = new Set(["running", "done", "failed", "cancelled"]);
const ACTIVE_NATIVE_AGENT_STATUSES = new Set(["running"]);
const TERMINAL_TASK_STATUSES = new Set(["done", "failed"]);
const PRE_ESTABLISHMENT_SAFE_KINDS = new Set(["planning", "requirements", "orchestration", "memory"]);
const JsonRpcError = { METHOD_NOT_FOUND: -32601, INVALID_PARAMS: -32602, INTERNAL: -32603 };

const now = () => new Date().toISOString();
const send = message => process.stdout.write(`${JSON.stringify(message)}\n`);
const result = (id, value) => send({ jsonrpc: "2.0", id, result: value });
const error = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

function requireString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}
function workspaceRoot(value) {
  return path.resolve(requireString(value, "workspacePath"));
}
function confined(root, ...parts) {
  const target = path.resolve(root, ...parts);
  const rel = path.relative(root, target);
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error("Path escapes workspace.");
  return target;
}
function statePath(root) { return confined(root, ".agent-team", "team.json"); }
function ensureDir(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function slug(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "agent";
}
function readState(root) {
  const file = statePath(root);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function writeState(root, state) {
  ensureDir(statePath(root));
  state.updatedAt = now();
  fs.writeFileSync(statePath(root), `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state;
}

function normalizeMembers(value) {
  if (!Array.isArray(value)) return [];
  return value.map((m, i) => ({
    id: String(m?.id || m?.name || `member-${i + 1}`),
    name: String(m?.name || m?.id || `member-${i + 1}`),
    role: String(m?.role || m?.name || "specialist"),
    agentProfile: m?.agentProfile ? String(m.agentProfile) : undefined,
    status: MEMBER_STATUSES.has(m?.status) ? m.status : "idle",
    statusSource: ["manual", "native"].includes(m?.statusSource) ? m.statusSource : "scheduler",
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
    kind: String(t?.kind || "task").toLowerCase(),
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
  state.schemaVersion = Math.max(Number(state.schemaVersion) || 0, 5);
  state.members = normalizeMembers(state.members);
  state.tasks = normalizeTasks(state.tasks);
  state.nativeAgents = normalizeNativeAgents(state.nativeAgents);
  state.events = Array.isArray(state.events) ? state.events : [];
  state.executionMode = EXECUTION_MODES.has(state.executionMode) ? state.executionMode : "UNKNOWN";
  state.fallbackReason = state.fallbackReason ? String(state.fallbackReason) : null;
  state.phase = PHASES.has(state.phase) ? state.phase : "planning";
  return state;
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
function textAndStructured(text, structuredContent, meta) {
  const out = { content: [{ type: "text", text }], structuredContent };
  if (meta) out._meta = meta;
  return out;
}
function appendEvent(state, kind, message, memberId = null, taskId = null) {
  state.events.push({ at: now(), kind, message, memberId, taskId });
  if (state.events.length > 200) state.events = state.events.slice(-200);
}
function activeNativeAgents(state) {
  return state.nativeAgents.filter(agent => ACTIVE_NATIVE_AGENT_STATUSES.has(agent.status));
}
function teamEstablished(state) {
  return state.executionMode === "NATIVE_SUBAGENTS" && state.nativeAgents.length > 0;
}
function executionGateOpen(state) {
  return teamEstablished(state) || state.executionMode === "SEQUENTIAL_ROLE_FALLBACK";
}
function taskRequiresExecutionGate(task) {
  return !PRE_ESTABLISHMENT_SAFE_KINDS.has(String(task?.kind || "task").toLowerCase());
}
function requireExecutionGate(state, task, requestedStatus) {
  if (!["running", "done"].includes(requestedStatus)) return;
  if (!taskRequiresExecutionGate(task) || executionGateOpen(state)) return;
  throw new Error(
    `Agent Team establishment gate is closed for task ${task.id}. ` +
    `While executionMode=UNKNOWN, only planning/requirements/orchestration/memory work may run. ` +
    `Delegate a real native Codex subagent and call agent_team_subagent_started first, ` +
    `or enter SEQUENTIAL_ROLE_FALLBACK with concrete failure evidence.`
  );
}

function validateTaskGraph(state) {
  const taskIds = new Set();
  for (const task of state.tasks) {
    if (taskIds.has(task.id)) throw new Error(`Duplicate task id: ${task.id}`);
    taskIds.add(task.id);
  }
  const memberIds = new Set();
  for (const member of state.members) {
    memberIds.add(member.id);
    memberIds.add(member.name);
  }
  for (const task of state.tasks) {
    if (task.assignee && !memberIds.has(task.assignee)) {
      throw new Error(`Task ${task.id} references unknown assignee: ${task.assignee}. Every assigned task must map to a logical member.`);
    }
    for (const dep of task.dependencies) {
      if (dep === task.id) throw new Error(`Task ${task.id} cannot depend on itself.`);
      if (!taskIds.has(dep)) throw new Error(`Task ${task.id} references unknown dependency: ${dep}`);
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
      } else if (task.status === "blocked" && task.blockedReason !== "dependency") {
        continue;
      } else if (allDone && ["pending", "blocked"].includes(task.status)) {
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
      const summary = native.summary || `${native.name} · ${native.role}`;
      if (member.status !== "working" || member.currentTask !== (native.taskId || null) || member.summary !== summary || member.statusSource !== "native") {
        member.status = "working";
        member.currentTask = native.taskId || null;
        member.summary = summary;
        member.statusSource = "native";
        changed = true;
      }
      continue;
    }
    if (allTasksDone && active.length === 0) {
      if (member.status !== "failed" && (member.status !== "done" || member.currentTask !== null)) {
        member.status = "done";
        member.currentTask = null;
        member.summary = "Assigned tasks completed";
        member.statusSource = "scheduler";
        changed = true;
      }
      continue;
    }
    const assigned = state.tasks.filter(task => task.assignee === member.id || task.assignee === member.name);
    if (!assigned.length) continue;
    const running = assigned.find(task => task.status === "running");
    const failed = assigned.find(task => task.status === "failed");
    const blocked = assigned.find(task => task.status === "blocked");
    const ready = assigned.find(task => task.status === "ready");
    const pending = assigned.find(task => task.status === "pending");
    let status = "idle", currentTask = null, summary = member.summary;
    if (running) { status = "working"; currentTask = running.id; summary = `Running ${running.subject}`; }
    else if (failed) { status = "failed"; currentTask = failed.id; summary = failed.result || `${failed.subject} failed`; }
    else if (blocked) { status = "blocked"; currentTask = blocked.id; summary = blocked.blockedBy.length ? `Blocked by ${blocked.blockedBy.join(", ")}` : `${blocked.subject} blocked`; }
    else if (ready) { currentTask = ready.id; summary = `Ready for ${ready.subject}`; }
    else if (pending) { currentTask = pending.id; summary = `Waiting for ${pending.subject}`; }
    else if (assigned.every(task => task.status === "done")) { status = "done"; summary = "Assigned tasks completed"; }
    if (member.status !== status || member.currentTask !== currentTask || member.summary !== summary || member.statusSource === "native") {
      member.status = status;
      member.currentTask = currentTask;
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
  const active = activeNativeAgents(state);
  if (active.length) {
    const phases = active.map(agent => phaseForNativeAgent(state, agent));
    if (phases.includes("reviewing")) return "reviewing";
    if (phases.includes("verifying")) return "verifying";
    if (phases.includes("integrating")) return "integrating";
    return "running";
  }
  if (!state.tasks.length) return "planning";
  if (state.tasks.every(task => task.status === "done")) {
    return state.executionMode === "UNKNOWN" ? "planning" : "completed";
  }
  const running = state.tasks.filter(task => task.status === "running");
  if (running.some(task => ["review", "code_review", "re_review"].includes(task.kind))) return "reviewing";
  if (running.some(task => ["verification", "test", "testing", "regression"].includes(task.kind))) return "verifying";
  if (running.some(task => ["integration", "integrating"].includes(task.kind))) return "integrating";
  if (running.length) return "running";
  if (state.tasks.some(task => ["failed", "blocked"].includes(task.status)) && !state.tasks.some(task => task.status === "ready")) return "blocked";
  return state.tasks.some(task => ["done", "ready"].includes(task.status)) ? "running" : "planning";
}
function reconcileState(state) {
  validateTaskGraph(state);
  let changed = reconcileDependencies(state);
  changed = reconcileMembers(state) || changed;
  const phase = derivePhase(state);
  if (state.phase !== phase) {
    const previous = state.phase;
    state.phase = phase;
    appendEvent(state, "phase_changed", `Phase ${previous || "unknown"} → ${phase}.`);
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
  if (id) return state.nativeAgents.find(agent => agent.id === id);
  const matches = state.nativeAgents.filter(agent => agent.name === name);
  return [...matches].reverse().find(agent => agent.status === "running") || matches.at(-1);
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
    createdAt: null,
    updatedAt: now(),
    members: [],
    tasks: [],
    nativeAgents: [],
    events: [{ at: now(), kind: "runtime_uninitialized", message: `No Agent Team state exists yet at ${statePath(root)}.`, memberId: null, taskId: null }]
  };
}

const tools = [
  {
    name: "agent_team_create", title: "Create Agent Team state",
    description: "Create or replace Agent Team state. New teams MUST start UNKNOWN. Every assigned task must map to a logical member.",
    inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, name: { type: "string" }, description: { type: "string" }, executionMode: { type: "string", enum: [...EXECUTION_MODES] }, phase: { type: "string", enum: [...PHASES] }, members: { type: "array", items: { type: "object", additionalProperties: true } }, tasks: { type: "array", items: { type: "object", additionalProperties: true } } }, required: ["workspacePath", "name"] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "agent_team_get", title: "Get Agent Team state",
    description: "Read and reconcile current Agent Team state.",
    inputSchema: { type: "object", properties: { workspacePath: { type: "string" } }, required: ["workspacePath"] },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_set_execution_mode", title: "Set Agent Team execution mode",
    description: "Set emergency fallback only with concrete failure evidence. NATIVE_SUBAGENTS can only be established by agent_team_subagent_started.",
    inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, executionMode: { type: "string", enum: [...EXECUTION_MODES] }, reason: { type: "string" } }, required: ["workspacePath", "executionMode"] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_add_task", title: "Add Agent Team task",
    description: "Append a newly discovered task.",
    inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, task: { type: "object", additionalProperties: true } }, required: ["workspacePath", "task"] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "agent_team_subagent_started", title: "Record native Codex subagent start",
    description: "Record a real native Codex subagent immediately after successful delegation. This is the ONLY normal transition that establishes Agent Team and switches mode to NATIVE_SUBAGENTS.",
    inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, nativeAgentId: { type: "string" }, name: { type: "string" }, role: { type: "string" }, memberId: { type: ["string", "null"] }, taskId: { type: ["string", "null"] }, summary: { type: "string" } }, required: ["workspacePath", "name", "role"] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_subagent_finished", title: "Record native Codex subagent finish",
    description: "Record a tracked native Codex subagent terminal result.",
    inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, nativeAgentId: { type: "string" }, name: { type: "string" }, status: { type: "string", enum: ["done", "failed", "cancelled"] }, result: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["workspacePath", "status"] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_update_member", title: "Update Agent Team member",
    description: "Record a truthful logical member status. UNKNOWN mode cannot start a member on substantive execution work.",
    inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, memberId: { type: "string" }, status: { type: "string", enum: [...MEMBER_STATUSES] }, currentTask: { type: ["string", "null"] }, summary: { type: "string" } }, required: ["workspacePath", "memberId"] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_update_task", title: "Update Agent Team task",
    description: "Update a logical task. While UNKNOWN, substantive tasks cannot enter running/done; establish native Agent Team first or explicitly enter evidence-backed fallback.",
    inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, taskId: { type: "string" }, status: { type: "string", enum: [...TASK_STATUSES] }, result: { type: "string" }, evidence: { type: "array", items: { type: "string" } } }, required: ["workspacePath", "taskId"] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_append_event", title: "Append Agent Team event",
    description: "Record an important orchestration event.",
    inputSchema: { type: "object", properties: { workspacePath: { type: "string" }, kind: { type: "string" }, message: { type: "string" }, memberId: { type: ["string", "null"] }, taskId: { type: ["string", "null"] } }, required: ["workspacePath", "kind", "message"] },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "agent_team_render_dashboard", title: "Render Agent Team dashboard",
    description: "Render the live Agent Team dashboard.",
    inputSchema: { type: "object", properties: { workspacePath: { type: "string" } }, required: ["workspacePath"] },
    _meta: { ui: { resourceUri: TEMPLATE_URI }, "openai/outputTemplate": TEMPLATE_URI, "openai/toolInvocation/invoking": "Opening Agent Team dashboard…", "openai/toolInvocation/invoked": "Agent Team dashboard ready." },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }
];

function callTool(name, args = {}) {
  if (name === "agent_team_create") {
    const root = workspaceRoot(args.workspacePath);
    if (args.executionMode && args.executionMode !== "UNKNOWN") {
      throw new Error("New Agent Team state must start with executionMode=UNKNOWN. Establish native mode with agent_team_subagent_started, or fallback later with evidence.");
    }
    const state = normalizeState({
      schemaVersion: 5,
      id: slug(args.name),
      name: requireString(args.name, "name"),
      description: typeof args.description === "string" ? args.description : "",
      executionMode: "UNKNOWN",
      fallbackReason: null,
      phase: PHASES.has(args.phase) ? args.phase : "planning",
      createdAt: now(),
      updatedAt: now(),
      members: args.members,
      tasks: args.tasks,
      nativeAgents: [],
      events: []
    });
    validateTaskGraph(state);
    appendEvent(state, "team_state_created", `Created pre-establishment team state with ${state.members.length} members and ${state.tasks.length} tasks. Native delegation is still required.`);
    reconcileState(state);
    writeState(root, state);
    return textAndStructured(`Created Agent Team state "${state.name}" in UNKNOWN mode. Native Agent Team is not established yet.`, { workspacePath: root, statePath: statePath(root), initialized: true, team: state });
  }

  if (name === "agent_team_get") {
    const { root, state } = optionalWorkspaceState(args);
    if (!state) return textAndStructured("No Agent Team state exists yet.", { workspacePath: root, statePath: statePath(root), initialized: false, team: null });
    reconcileAndPersist(root, state);
    return textAndStructured(`Loaded Agent Team state "${state.name}".`, { workspacePath: root, statePath: statePath(root), initialized: true, team: state });
  }

  if (name === "agent_team_set_execution_mode") {
    const { root, state } = requiredWorkspaceState(args);
    if (!EXECUTION_MODES.has(args.executionMode)) throw new Error(`Invalid executionMode: ${args.executionMode}`);
    if (args.executionMode === "NATIVE_SUBAGENTS") {
      throw new Error("Do not set NATIVE_SUBAGENTS manually. A real native delegation must succeed, then call agent_team_subagent_started.");
    }
    if (args.executionMode === "SEQUENTIAL_ROLE_FALLBACK") {
      const reason = requireString(args.reason, "reason");
      if (reason.length < 12) throw new Error("Fallback reason is too vague. Record concrete evidence that native delegation is unavailable/unsupported/failed.");
      const previous = state.executionMode;
      state.executionMode = "SEQUENTIAL_ROLE_FALLBACK";
      state.fallbackReason = reason;
      appendEvent(state, "agent_team_not_established", `Native Agent Team not established; single-context fallback enabled. Reason: ${reason}`);
      if (previous !== state.executionMode) appendEvent(state, "execution_mode_changed", `Execution mode ${previous} → SEQUENTIAL_ROLE_FALLBACK.`);
      reconcileState(state);
      writeState(root, state);
      return textAndStructured("Native Agent Team was not established. Emergency single-context fallback is now enabled.", { workspacePath: root, statePath: statePath(root), initialized: true, team: state });
    }
    if (state.executionMode !== "UNKNOWN") throw new Error(`Cannot reset execution mode from ${state.executionMode} to UNKNOWN in the same run.`);
    return textAndStructured("Execution mode remains UNKNOWN.", { workspacePath: root, statePath: statePath(root), initialized: true, team: state });
  }

  if (name === "agent_team_add_task") {
    const { root, state } = requiredWorkspaceState(args);
    if (!args.task || typeof args.task !== "object" || Array.isArray(args.task)) throw new Error("task must be an object.");
    const task = normalizeTasks([args.task])[0];
    state.tasks.push(task);
    try { validateTaskGraph(state); } catch (e) { state.tasks.pop(); throw e; }
    appendEvent(state, "task_added", `Added ${task.id}: ${task.subject}.`, task.assignee, task.id);
    reconcileState(state);
    writeState(root, state);
    return textAndStructured(`Added task ${task.id}.`, { workspacePath: root, statePath: statePath(root), initialized: true, team: state });
  }

  if (name === "agent_team_subagent_started") {
    const { root, state } = requiredWorkspaceState(args);
    if (state.executionMode === "SEQUENTIAL_ROLE_FALLBACK") {
      throw new Error("Cannot record a native subagent after fallback was declared for this run. Start a new run/team state if native delegation becomes available.");
    }
    const displayName = requireString(args.name, "name");
    const role = requireString(args.role, "role");
    const memberId = args.memberId ?? null;
    const taskId = args.taskId ?? null;
    if (memberId !== null && !state.members.some(m => m.id === memberId || m.name === memberId)) throw new Error(`Unknown member: ${memberId}`);
    if (taskId !== null && !state.tasks.some(t => t.id === taskId)) throw new Error(`Unknown task: ${taskId}`);

    const requestedId = args.nativeAgentId ? String(args.nativeAgentId) : null;
    let agent = state.nativeAgents.find(a => (requestedId && a.id === requestedId) || (!requestedId && a.name === displayName && a.status === "running"));
    if (!agent) {
      let id = requestedId || `native-${slug(displayName)}`;
      if (state.nativeAgents.some(a => a.id === id)) id = `${id}-${Date.now()}`;
      agent = { id, name: displayName, role, memberId, taskId, status: "running", summary: args.summary ? String(args.summary) : "", result: "", evidence: [], startedAt: now(), finishedAt: null };
      state.nativeAgents.push(agent);
    } else {
      Object.assign(agent, { name: displayName, role, memberId: memberId ?? agent.memberId, taskId: taskId ?? agent.taskId, status: "running", summary: args.summary ? String(args.summary) : agent.summary, finishedAt: null });
    }

    if (agent.taskId) {
      reconcileDependencies(state);
      const task = state.tasks.find(t => t.id === agent.taskId);
      if (!["ready", "running"].includes(task.status)) throw new Error(`Cannot start native subagent for task ${task.id} while task status is ${task.status}.`);
      if (task.status !== "running") appendEvent(state, "task_update", `${task.id} ${task.status} → running.`, task.assignee, task.id);
      task.status = "running";
      task.statusChangedAt = now();
      if (!task.startedAt) task.startedAt = task.statusChangedAt;
    }

    const previous = state.executionMode;
    state.executionMode = "NATIVE_SUBAGENTS";
    state.fallbackReason = null;
    if (previous !== "NATIVE_SUBAGENTS") appendEvent(state, "agent_team_established", `Agent Team established because native subagent ${agent.name} started as ${agent.role}.`, agent.memberId, agent.taskId);
    appendEvent(state, "subagent_started", `${agent.name} started as ${agent.role}${agent.taskId ? ` on ${agent.taskId}` : ""}.`, agent.memberId, agent.taskId);
    reconcileState(state);
    writeState(root, state);
    return textAndStructured(`Recorded native subagent ${agent.name}; Agent Team is established.`, { workspacePath: root, statePath: statePath(root), initialized: true, nativeAgent: agent, team: state });
  }

  if (name === "agent_team_subagent_finished") {
    const { root, state } = requiredWorkspaceState(args);
    const agent = findNativeAgent(state, args);
    if (!agent) throw new Error("Tracked native subagent not found.");
    if (!NATIVE_AGENT_STATUSES.has(args.status) || args.status === "running") throw new Error(`Invalid terminal subagent status: ${args.status}`);
    agent.status = args.status;
    agent.finishedAt = now();
    if (typeof args.result === "string") agent.result = args.result;
    if (Array.isArray(args.evidence)) agent.evidence = args.evidence.map(String);
    if (agent.taskId) {
      const task = state.tasks.find(t => t.id === agent.taskId);
      if (task) {
        const previous = task.status;
        task.status = args.status === "done" ? "done" : "failed";
        task.statusChangedAt = now();
        if (task.status === "done") task.completedAt = task.statusChangedAt;
        if (agent.result) task.result = agent.result;
        if (agent.evidence.length) task.evidence = agent.evidence.slice();
        if (previous !== task.status) appendEvent(state, "task_update", `${task.id} ${previous} → ${task.status}.`, task.assignee, task.id);
      }
    }
    appendEvent(state, "subagent_finished", `${agent.name} ${agent.status}${agent.taskId ? ` on ${agent.taskId}` : ""}.`, agent.memberId, agent.taskId);
    reconcileState(state);
    writeState(root, state);
    return textAndStructured(`Recorded native subagent ${agent.name} as ${agent.status}.`, { workspacePath: root, statePath: statePath(root), initialized: true, nativeAgent: agent, team: state });
  }

  if (name === "agent_team_update_member") {
    const { root, state } = requiredWorkspaceState(args);
    const member = state.members.find(m => m.id === args.memberId || m.name === args.memberId);
    if (!member) throw new Error(`Unknown member: ${args.memberId}`);
    const requestedTask = Object.hasOwn(args, "currentTask") ? args.currentTask : member.currentTask;
    if (requestedTask !== null && requestedTask !== undefined) {
      const task = state.tasks.find(item => item.id === requestedTask);
      if (!task) throw new Error(`Unknown currentTask: ${requestedTask}`);
      if (args.status === "working") requireExecutionGate(state, task, "running");
    }
    if (args.status !== undefined) {
      if (!MEMBER_STATUSES.has(args.status)) throw new Error(`Invalid member status: ${args.status}`);
      member.status = args.status;
      member.statusSource = "manual";
    }
    if (Object.hasOwn(args, "currentTask")) member.currentTask = args.currentTask;
    if (typeof args.summary === "string") member.summary = args.summary;
    appendEvent(state, "member_update", `${member.name} → ${member.status}.`, member.id, member.currentTask);
    reconcileState(state);
    writeState(root, state);
    return textAndStructured(`Updated member ${member.name}.`, { workspacePath: root, statePath: statePath(root), initialized: true, team: state });
  }

  if (name === "agent_team_update_task") {
    const { root, state } = requiredWorkspaceState(args);
    validateTaskGraph(state);
    const task = state.tasks.find(t => t.id === args.taskId);
    if (!task) throw new Error(`Unknown task: ${args.taskId}`);
    if (args.status !== undefined) {
      if (!TASK_STATUSES.has(args.status)) throw new Error(`Invalid task status: ${args.status}`);
      requireExecutionGate(state, task, args.status);
      if (args.status === "done" && activeNativeAgents(state).some(agent => agent.taskId === task.id)) {
        throw new Error(`Task ${task.id} cannot be marked done while a linked native subagent is still running.`);
      }
      const previous = task.status;
      task.status = args.status;
      task.statusChangedAt = now();
      task.blockedReason = args.status === "blocked" ? "manual" : null;
      task.blockedBy = [];
      if (args.status === "running" && !task.startedAt) task.startedAt = task.statusChangedAt;
      if (args.status === "done") task.completedAt = task.statusChangedAt;
      if (previous !== task.status) appendEvent(state, "task_update", `${task.id} ${previous} → ${task.status}.`, task.assignee, task.id);
    }
    if (typeof args.result === "string") task.result = args.result;
    if (Array.isArray(args.evidence)) task.evidence = args.evidence.map(String);
    reconcileState(state);
    writeState(root, state);
    return textAndStructured(`Updated task ${task.id}.`, { workspacePath: root, statePath: statePath(root), initialized: true, team: state });
  }

  if (name === "agent_team_append_event") {
    const { root, state } = requiredWorkspaceState(args);
    appendEvent(state, requireString(args.kind, "kind"), requireString(args.message, "message"), args.memberId ?? null, args.taskId ?? null);
    writeState(root, state);
    return textAndStructured("Recorded Agent Team event.", { workspacePath: root, statePath: statePath(root), initialized: true, team: state });
  }

  if (name === "agent_team_render_dashboard") {
    const { root, state } = optionalWorkspaceState(args);
    const dashboardState = state || uninitializedDashboardState(root);
    if (state) reconcileAndPersist(root, dashboardState);
    return textAndStructured(
      state ? `Showing Agent Team dashboard for "${dashboardState.name}".` : "Showing an uninitialized Agent Team dashboard.",
      { workspacePath: root, statePath: statePath(root), initialized: Boolean(state), team: dashboardState },
      { ui: { resourceUri: TEMPLATE_URI }, "openai/outputTemplate": TEMPLATE_URI }
    );
  }

  throw new Error(`Unknown tool: ${name}`);
}

function handle(id, method, params) {
  if (method === "initialize") {
    result(id, {
      protocolVersion: params?.protocolVersion ?? "2025-11-25",
      capabilities: { tools: {}, resources: {} },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      instructions:
        "Auto Agent Team has two hard gates. First create/read Runtime state and render the dashboard. " +
        "Second, before substantive implementation/testing/debugging/review, establish a real native Agent Team: " +
        "successfully delegate a native Codex subagent and immediately call agent_team_subagent_started. " +
        "While executionMode=UNKNOWN, substantive Runtime tasks cannot enter running/done. " +
        "SEQUENTIAL_ROLE_FALLBACK is emergency-only and requires concrete failure evidence. " +
        "A native subagent start is the only normal way to establish NATIVE_SUBAGENTS."
    });
    return;
  }
  if (method === "ping") return result(id, {});
  if (method === "tools/list") return result(id, { tools });
  if (method === "tools/call") {
    try { result(id, callTool(params?.name, params?.arguments ?? {})); }
    catch (e) { error(id, JsonRpcError.INVALID_PARAMS, e instanceof Error ? e.message : String(e)); }
    return;
  }
  if (method === "resources/list") return result(id, { resources: [{ uri: TEMPLATE_URI, name: "Agent Team Dashboard", mimeType: "text/html;profile=mcp-app" }] });
  if (method === "resources/read") {
    if (params?.uri !== TEMPLATE_URI) return error(id, JsonRpcError.INVALID_PARAMS, `Unknown resource: ${params?.uri ?? ""}`);
    try {
      const html = fs.readFileSync(UI_PATH, "utf8");
      result(id, { contents: [{ uri: TEMPLATE_URI, mimeType: "text/html;profile=mcp-app", text: html, _meta: { ui: { prefersBorder: true } } }] });
    } catch (e) {
      error(id, JsonRpcError.INTERNAL, e instanceof Error ? e.message : String(e));
    }
    return;
  }
  if (id !== undefined) error(id, JsonRpcError.METHOD_NOT_FOUND, `Method not found: ${method}`);
}

const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on("line", line => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    if (msg.method !== undefined) handle(msg.id, msg.method, msg.params ?? {});
  } catch {
    // Ignore malformed input.
  }
});
