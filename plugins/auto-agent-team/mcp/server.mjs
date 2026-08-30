import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const SERVER_NAME = "Auto Agent Team Runtime";
const SERVER_VERSION = "0.2.0";
const TEMPLATE_URI = "ui://auto-agent-team/team-dashboard.html";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, "..");
const UI_PATH = path.join(PLUGIN_ROOT, "ui", "team-dashboard.html");

const MEMBER_STATUSES = new Set(["idle", "working", "blocked", "done", "failed"]);
const TASK_STATUSES = new Set(["pending", "ready", "running", "blocked", "done", "failed"]);
const PHASES = new Set(["planning", "running", "integrating", "verifying", "reviewing", "completed", "blocked"]);
const EXECUTION_MODES = new Set(["NATIVE_SUBAGENTS", "SEQUENTIAL_ROLE_FALLBACK", "UNKNOWN"]);
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
  return requireString(value, "name").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "agent-team";
}
function normalizeMembers(value) {
  if (!Array.isArray(value)) return [];
  return value.map((m, i) => ({
    id: String(m?.id || m?.name || `member-${i + 1}`),
    name: String(m?.name || m?.id || `member-${i + 1}`),
    role: String(m?.role || m?.name || "specialist"),
    agentProfile: m?.agentProfile ? String(m.agentProfile) : undefined,
    status: MEMBER_STATUSES.has(m?.status) ? m.status : "idle",
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
    evidence: Array.isArray(t?.evidence) ? t.evidence.map(String) : []
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
  return { root, state };
}
function updatePhaseFromTasks(state) {
  if (state.tasks.some(t => t.status === "failed" || t.status === "blocked")) state.phase = "blocked";
  else if (state.tasks.length && state.tasks.every(t => t.status === "done")) state.phase = "completed";
  else if (state.tasks.some(t => t.kind === "review" && t.status === "running")) state.phase = "reviewing";
  else if (state.tasks.some(t => t.kind === "verification" && t.status === "running")) state.phase = "verifying";
  else if (state.tasks.some(t => t.status === "running")) state.phase = "running";
}
function appendEvent(state, kind, message, memberId = null, taskId = null) {
  state.events ||= [];
  state.events.push({ at: now(), kind, message, memberId, taskId });
  if (state.events.length > 100) state.events = state.events.slice(-100);
}

const tools = [
  {
    name: "agent_team_create",
    title: "Create Agent Team state",
    description: "Create or replace the DSH-style Agent Team runtime state for a local workspace before substantial orchestrated work. Stores only .agent-team/team.json in the workspace.",
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
    description: "Read the current Agent Team state for a workspace.",
    inputSchema: { type: "object", properties: { workspacePath: { type: "string" } }, required: ["workspacePath"] },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "agent_team_update_member",
    title: "Update Agent Team member",
    description: "Update one member's truthful runtime status, current task, or summary.",
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
    description: "Update one task's status and attach concise result/evidence after real work occurs.",
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
    description: "Render the live Agent Team dashboard. Call agent_team_create first, then use update tools as work progresses.",
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
      schemaVersion: 1,
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
    appendEvent(state, "team_created", `Created Agent Team with ${state.members.length} members and ${state.tasks.length} tasks.`);
    writeState(root, state);
    return textAndStructured(`Created Agent Team "${state.name}".`, { workspacePath: root, team: state });
  }

  if (name === "agent_team_get") {
    const { root, state } = requiredWorkspaceState(args);
    return textAndStructured(`Loaded Agent Team "${state.name}".`, { workspacePath: root, team: state });
  }

  if (name === "agent_team_update_member") {
    const { root, state } = requiredWorkspaceState(args);
    const member = state.members.find(m => m.id === args.memberId || m.name === args.memberId);
    if (!member) throw new Error(`Unknown member: ${args.memberId}`);
    if (args.status !== undefined) {
      if (!MEMBER_STATUSES.has(args.status)) throw new Error(`Invalid member status: ${args.status}`);
      member.status = args.status;
    }
    if (Object.hasOwn(args, "currentTask")) member.currentTask = args.currentTask;
    if (typeof args.summary === "string") member.summary = args.summary;
    appendEvent(state, "member_update", `${member.name} → ${member.status}.`, member.id, member.currentTask);
    writeState(root, state);
    return textAndStructured(`Updated member ${member.name}.`, { workspacePath: root, team: state });
  }

  if (name === "agent_team_update_task") {
    const { root, state } = requiredWorkspaceState(args);
    const task = state.tasks.find(t => t.id === args.taskId);
    if (!task) throw new Error(`Unknown task: ${args.taskId}`);
    if (args.status !== undefined) {
      if (!TASK_STATUSES.has(args.status)) throw new Error(`Invalid task status: ${args.status}`);
      task.status = args.status;
    }
    if (typeof args.result === "string") task.result = args.result;
    if (Array.isArray(args.evidence)) task.evidence = args.evidence.map(String);
    updatePhaseFromTasks(state);
    appendEvent(state, "task_update", `${task.id} → ${task.status}.`, task.assignee, task.id);
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
      instructions: "Maintain truthful DSH-style Agent Team state for the current workspace. Use native Codex subagents for delegation; this runtime records and renders status but does not create fake chats."
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
