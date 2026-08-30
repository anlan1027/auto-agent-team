import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const SERVER_NAME = "Auto Agent Team Runtime";
const SERVER_VERSION = "0.3.0-dev";
const TEMPLATE_URI = "ui://auto-agent-team/team-dashboard.html";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, "..");
const UI_PATH = path.join(PLUGIN_ROOT, "ui", "team-dashboard.html");

const MEMBER_STATUSES = new Set(["idle", "working", "blocked", "done", "failed"]);
const TASK_STATUSES = new Set(["pending", "ready", "running", "blocked", "done", "failed"]);
const PHASES = new Set(["planning", "running", "integrating", "verifying", "reviewing", "completed", "blocked"]);
const EXECUTION_MODES = new Set(["NATIVE_SUBAGENTS", "SEQUENTIAL_ROLE_FALLBACK", "UNKNOWN"]);
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
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error("Path escapes workspace.");
  }
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
  return requireString(value, "name")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "agent-team";
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

function textAndStructured(text, structuredContent, meta) {
  const out = { content: [{ type: "text", text }], structuredContent };
  if (meta) out._meta = meta;
  return out;
}

function requiredWorkspaceState(args) {
  const root = workspaceRoot(args?.workspacePath);
  const state = readState(root);
  if (!state) throw new Error(`No Agent Team state exists at ${statePath(root)}. Call agent_team_create first.`);
  state.schemaVersion ||= 1;
  state.members = normalizeMembers(state.members);
  state.tasks = normalizeTasks(state.tasks);
  state.events = Array.isArray(state.events) ? state.events : [];
  return { root, state };
}

function appendEvent(state, kind, message, memberId = null, taskId = null) {
  state.events ||= [];
  state.events.push({ at: now(), kind, message, memberId, taskId });
  if (state.events.length > 120) state.events = state.events.slice(-120);
}

function validateTaskGraph(state) {
  const ids = new Set();
  for (const task of state.tasks) {
    if (ids.has(task.id)) throw new Error(`Duplicate task id: ${task.id}`);
    ids.add(task.id);
  }

  const memberIds = new Set();
  for (const member of state.members) {
    memberIds.add(member.id);
    memberIds.add(member.name);
  }

  for (const task of state.tasks) {
    if (task.assignee && state.members.length && !memberIds.has(task.assignee)) {
      throw new Error(`Task ${task.id} references unknown assignee: ${task.assignee}`);
    }
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
    const task = byId.get(id);
    for (const dep of task.dependencies) visit(dep, [...stack, id]);
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
        continue;
      }

      if (!allDone && task.status === "ready") {
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
  for (const member of state.members) {
    const assigned = state.tasks.filter(task => task.assignee === member.id || task.assignee === member.name);
    if (!assigned.length) continue;

    const current = member.currentTask ? state.tasks.find(task => task.id === member.currentTask) : null;
    const manualActive = member.statusSource === "manual"
      && current
      && ["pending", "ready", "running", "blocked"].includes(current.status)
      && ["working", "blocked", "failed"].includes(member.status);
    if (manualActive) continue;

    let nextStatus = member.status;
    let nextTask = null;
    let summary = member.summary;
    const running = assigned.find(task => task.status === "running");
    const failed = assigned.find(task => task.status === "failed");
    const blocked = assigned.find(task => task.status === "blocked");
    const ready = assigned.find(task => task.status === "ready");
    const pending = assigned.find(task => task.status === "pending");

    if (running) {
      nextStatus = "working";
      nextTask = running.id;
      summary = `Running ${running.subject}`;
    } else if (failed) {
      nextStatus = "failed";
      nextTask = failed.id;
      summary = failed.result || `${failed.subject} failed`;
    } else if (blocked) {
      nextStatus = "blocked";
      nextTask = blocked.id;
      summary = blocked.blockedBy?.length ? `Blocked by ${blocked.blockedBy.join(", ")}` : `${blocked.subject} blocked`;
    } else if (ready) {
      nextStatus = "idle";
      nextTask = ready.id;
      summary = `Ready for ${ready.subject}`;
    } else if (pending) {
      nextStatus = "idle";
      nextTask = pending.id;
      summary = `Waiting for ${pending.subject}`;
    } else if (assigned.every(task => task.status === "done")) {
      nextStatus = "done";
      nextTask = null;
      summary = "Assigned tasks completed";
    }

    if (member.status !== nextStatus || member.currentTask !== nextTask || member.summary !== summary || member.statusSource !== "scheduler") {
      member.status = nextStatus;
      member.currentTask = nextTask;
      member.summary = summary;
      member.statusSource = "scheduler";
      changed = true;
    }
  }
  return changed;
}

function derivePhase(state) {
  const tasks = state.tasks;
  if (!tasks.length) return "planning";
  if (tasks.every(task => task.status === "done")) return "completed";

  const running = tasks.filter(task => task.status === "running");
  if (running.some(task => ["review", "code_review"].includes(task.kind))) return "reviewing";
  if (running.some(task => ["verification", "test", "testing"].includes(task.kind))) return "verifying";
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

const tools = [
  {
    name: "agent_team_create",
    title: "Create Agent Team state",
    description: "Create or replace DSH-style Agent Team state for a local workspace. The runtime validates dependencies, automatically marks dependency-free tasks ready, and stores only .agent-team/team.json.",
    inputSchema: {
      type: "object",
      properties: {
        workspacePath: { type: "string", description: "Absolute local workspace root." },
        name: { type: "string" },
        description: { type: "string" },
        executionMode: { type: "string", enum: ["NATIVE_SUBAGENTS", "SEQUENTIAL_ROLE_FALLBACK", "UNKNOWN"] },
        phase: { type: "string", enum: ["planning", "running", "integrating", "verifying", "reviewing", "completed", "blocked"] },
        members: { type: "array", items: { type: "object", additionalProperties: true } },
        tasks: { type: "array", items: { type: "object", additionalProperties: true } }
      },
      required: ["workspacePath", "name"]
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "agent_team_get",
    title: "Get Agent Team state",
    description: "Read and reconcile current Agent Team state. Ready/blocked task transitions and task-derived member status are synchronized automatically.",
    inputSchema: { type: "object", properties: { workspacePath: { type: "string" } }, required: ["workspacePath"] },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_update_member",
    title: "Update Agent Team member",
    description: "Record a truthful native-agent/member status, current task, or summary. Explicit active native-agent status temporarily takes precedence over task-derived status until that task reaches a terminal state.",
    inputSchema: {
      type: "object",
      properties: {
        workspacePath: { type: "string" },
        memberId: { type: "string" },
        status: { type: "string", enum: ["idle", "working", "blocked", "done", "failed"] },
        currentTask: { type: ["string", "null"] },
        summary: { type: "string" }
      },
      required: ["workspacePath", "memberId"]
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_update_task",
    title: "Update Agent Team task",
    description: "Update one task after real work occurs. The scheduler automatically unlocks dependents, propagates dependency blocks, derives team phase, and synchronizes member state.",
    inputSchema: {
      type: "object",
      properties: {
        workspacePath: { type: "string" },
        taskId: { type: "string" },
        status: { type: "string", enum: ["pending", "ready", "running", "blocked", "done", "failed"] },
        result: { type: "string" },
        evidence: { type: "array", items: { type: "string" } }
      },
      required: ["workspacePath", "taskId"]
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_append_event",
    title: "Append Agent Team event",
    description: "Record an important orchestration event such as delegation, integration, verification, review, blocker, or fallback.",
    inputSchema: {
      type: "object",
      properties: {
        workspacePath: { type: "string" },
        kind: { type: "string" },
        message: { type: "string" },
        memberId: { type: ["string", "null"] },
        taskId: { type: ["string", "null"] }
      },
      required: ["workspacePath", "kind", "message"]
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "agent_team_render_dashboard",
    title: "Render Agent Team dashboard",
    description: "Reconcile state and render the live DSH-style Agent Team dashboard.",
    inputSchema: {
      type: "object",
      properties: { workspacePath: { type: "string" } },
      required: ["workspacePath"]
    },
    _meta: {
      ui: { resourceUri: TEMPLATE_URI },
      "openai/outputTemplate": TEMPLATE_URI,
      "openai/toolInvocation/invoking": "Opening Agent Team dashboard…",
      "openai/toolInvocation/invoked": "Agent Team dashboard ready."
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }
];

function callTool(name, args = {}) {
  if (name === "agent_team_create") {
    const root = workspaceRoot(args.workspacePath);
    const state = {
      schemaVersion: 2,
      id: slug(args.name),
      name: requireString(args.name, "name"),
      description: typeof args.description === "string" ? args.description : "",
      executionMode: EXECUTION_MODES.has(args.executionMode) ? args.executionMode : "UNKNOWN",
      phase: PHASES.has(args.phase) ? args.phase : "planning",
      planReviewState: "not_required",
      createdAt: now(),
      updatedAt: now(),
      members: normalizeMembers(args.members),
      tasks: normalizeTasks(args.tasks),
      events: []
    };
    validateTaskGraph(state);
    appendEvent(state, "team_created", `Created Agent Team with ${state.members.length} members and ${state.tasks.length} tasks.`);
    reconcileState(state);
    writeState(root, state);
    return textAndStructured(`Created Agent Team "${state.name}".`, { workspacePath: root, team: state });
  }

  if (name === "agent_team_get") {
    const { root, state } = requiredWorkspaceState(args);
    reconcileAndPersist(root, state);
    return textAndStructured(`Loaded Agent Team "${state.name}".`, { workspacePath: root, team: state });
  }

  if (name === "agent_team_update_member") {
    const { root, state } = requiredWorkspaceState(args);
    const member = state.members.find(m => m.id === args.memberId || m.name === args.memberId);
    if (!member) throw new Error(`Unknown member: ${args.memberId}`);
    if (args.status !== undefined) {
      if (!MEMBER_STATUSES.has(args.status)) throw new Error(`Invalid member status: ${args.status}`);
      member.status = args.status;
      member.statusSource = "manual";
    }
    if (Object.hasOwn(args, "currentTask")) {
      if (args.currentTask !== null && !state.tasks.some(task => task.id === args.currentTask)) {
        throw new Error(`Unknown currentTask: ${args.currentTask}`);
      }
      member.currentTask = args.currentTask;
    }
    if (typeof args.summary === "string") member.summary = args.summary;
    appendEvent(state, "member_update", `${member.name} → ${member.status}.`, member.id, member.currentTask);
    writeState(root, state);
    return textAndStructured(`Updated member ${member.name}.`, { workspacePath: root, team: state });
  }

  if (name === "agent_team_update_task") {
    const { root, state } = requiredWorkspaceState(args);
    validateTaskGraph(state);
    const task = state.tasks.find(t => t.id === args.taskId);
    if (!task) throw new Error(`Unknown task: ${args.taskId}`);

    if (args.status !== undefined) {
      if (!TASK_STATUSES.has(args.status)) throw new Error(`Invalid task status: ${args.status}`);
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
    return textAndStructured(`Updated task ${task.id}.`, { workspacePath: root, team: state });
  }

  if (name === "agent_team_append_event") {
    const { root, state } = requiredWorkspaceState(args);
    appendEvent(
      state,
      requireString(args.kind, "kind"),
      requireString(args.message, "message"),
      args.memberId ?? null,
      args.taskId ?? null
    );
    writeState(root, state);
    return textAndStructured("Recorded Agent Team event.", { workspacePath: root, team: state });
  }

  if (name === "agent_team_render_dashboard") {
    const { root, state } = requiredWorkspaceState(args);
    reconcileAndPersist(root, state);
    return textAndStructured(
      `Showing Agent Team dashboard for "${state.name}".`,
      { workspacePath: root, team: state },
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
      instructions: "Maintain truthful DSH-style Agent Team state for the current workspace. The runtime automatically reconciles task dependencies, task-derived member state, and workflow phase. Native Codex subagents remain the real execution mechanism; this runtime records and renders status only."
    });
    return;
  }
  if (method === "ping") {
    result(id, {});
    return;
  }
  if (method === "tools/list") {
    result(id, { tools });
    return;
  }
  if (method === "tools/call") {
    try {
      result(id, callTool(params?.name, params?.arguments ?? {}));
    } catch (e) {
      error(id, JsonRpcError.INVALID_PARAMS, e instanceof Error ? e.message : String(e));
    }
    return;
  }
  if (method === "resources/list") {
    result(id, {
      resources: [
        {
          uri: TEMPLATE_URI,
          name: "Agent Team Dashboard",
          mimeType: "text/html;profile=mcp-app"
        }
      ]
    });
    return;
  }
  if (method === "resources/read") {
    if (params?.uri !== TEMPLATE_URI) {
      error(id, JsonRpcError.INVALID_PARAMS, `Unknown resource: ${params?.uri ?? ""}`);
      return;
    }
    try {
      const html = fs.readFileSync(UI_PATH, "utf8");
      result(id, {
        contents: [
          {
            uri: TEMPLATE_URI,
            mimeType: "text/html;profile=mcp-app",
            text: html,
            _meta: { ui: { prefersBorder: true } }
          }
        ]
      });
    } catch (e) {
      error(id, JsonRpcError.INTERNAL, e instanceof Error ? e.message : String(e));
    }
    return;
  }
  if (id !== undefined) {
    error(id, JsonRpcError.METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on("line", line => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg.method !== undefined) handle(msg.id, msg.method, msg.params ?? {});
});