import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, "..");
const serverPath = path.join(pluginRoot, "mcp", "server.mjs");
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "aat-smoke-"));
const emptyWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "aat-empty-"));
const badWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "aat-bad-"));
const child = spawn(process.execPath, [serverPath], { stdio: ["pipe", "pipe", "inherit"] });
const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
const pending = new Map();
let nextId = 1;

function request(method, params = {}) {
  const id = nextId++;
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`timeout: ${method}`)); }, 5000);
    pending.set(id, { resolve, reject, timer });
  });
}
lines.on("line", line => {
  if (!line.trim()) return;
  const msg = JSON.parse(line);
  if (!pending.has(msg.id)) return;
  const p = pending.get(msg.id);
  pending.delete(msg.id);
  clearTimeout(p.timer);
  msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
});
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const team = result => result?.structuredContent?.team;
const task = (state, id) => state.tasks.find(item => item.id === id);
const member = (state, id) => state.members.find(item => item.id === id);
const native = (state, name) => [...state.nativeAgents].reverse().find(item => item.name === name);

async function call(name, args) {
  return request("tools/call", { name, arguments: args });
}

try {
  const init = await request("initialize", { protocolVersion: "2025-11-25" });
  assert(init.serverInfo.version === "0.3.0-dev.4", "wrong runtime version");
  assert(/two hard gates/i.test(init.instructions), "initialize should advertise both hard gates");

  const list = await request("tools/list");
  assert(list.tools.length === 10, "expected 10 tools");

  const emptyGet = await call("agent_team_get", { workspacePath: emptyWorkspace });
  assert(emptyGet.structuredContent.initialized === false, "fresh get should not fail");
  const emptyRender = await call("agent_team_render_dashboard", { workspacePath: emptyWorkspace });
  assert(team(emptyRender).schemaVersion === 5, "uninitialized dashboard should use schema 5");

  let badRejected = false;
  try {
    await call("agent_team_create", {
      workspacePath: badWorkspace,
      name: "bad",
      members: [],
      tasks: [{ id: "t1", subject: "Implement", assignee: "developer", kind: "implementation" }]
    });
  } catch (e) {
    badRejected = /logical member|unknown assignee/i.test(e.message);
  }
  assert(badRejected, "assigned tasks without members must be rejected");

  let s = team(await call("agent_team_create", {
    workspacePath: workspace,
    name: "todo",
    executionMode: "UNKNOWN",
    members: [
      { id: "manager", name: "Manager", role: "Manager" },
      { id: "developer", name: "Developer", role: "Developer" },
      { id: "tester", name: "Tester", role: "Tester" },
      { id: "reviewer", name: "Reviewer", role: "Reviewer" }
    ],
    tasks: [
      { id: "t1", subject: "Plan", assignee: "manager", kind: "planning" },
      { id: "t2", subject: "Implement", assignee: "developer", kind: "implementation", dependencies: ["t1"] },
      { id: "t3", subject: "Verify", assignee: "tester", kind: "verification", dependencies: ["t2"] },
      { id: "t4", subject: "Review", assignee: "reviewer", kind: "review", dependencies: ["t2"] }
    ]
  }));
  assert(s.schemaVersion === 5, "expected schema 5");
  assert(s.executionMode === "UNKNOWN", "new team should start UNKNOWN");
  assert(task(s, "t1").status === "ready", "planning task should be ready");

  s = team(await call("agent_team_update_task", { workspacePath: workspace, taskId: "t1", status: "done" }));
  assert(task(s, "t2").status === "ready", "implementation should become ready after planning");

  let gateRejected = false;
  try {
    await call("agent_team_update_task", { workspacePath: workspace, taskId: "t2", status: "running" });
  } catch (e) {
    gateRejected = /establishment gate is closed/i.test(e.message);
  }
  assert(gateRejected, "substantive task must be blocked while UNKNOWN");

  let manualNativeRejected = false;
  try {
    await call("agent_team_set_execution_mode", { workspacePath: workspace, executionMode: "NATIVE_SUBAGENTS", reason: "pretend" });
  } catch (e) {
    manualNativeRejected = /do not set NATIVE_SUBAGENTS manually/i.test(e.message);
  }
  assert(manualNativeRejected, "manual native mode must be rejected");

  s = team(await call("agent_team_subagent_started", {
    workspacePath: workspace,
    nativeAgentId: "dirac-1",
    name: "Dirac",
    role: "Developer",
    memberId: "developer",
    taskId: "t2",
    summary: "Implement bounded application module"
  }));
  assert(s.executionMode === "NATIVE_SUBAGENTS", "real native start should establish native mode");
  assert(task(s, "t2").status === "running", "linked implementation task should run");
  assert(member(s, "developer").status === "working", "developer member should be working");

  s = team(await call("agent_team_subagent_finished", {
    workspacePath: workspace,
    nativeAgentId: "dirac-1",
    status: "done",
    result: "Implementation complete",
    evidence: ["src/app.ts"]
  }));
  assert(task(s, "t2").status === "done", "implementation task should complete with subagent");
  assert(task(s, "t3").status === "ready" && task(s, "t4").status === "ready", "verification and review should be ready");

  s = team(await call("agent_team_subagent_started", {
    workspacePath: workspace,
    nativeAgentId: "euclid-1",
    name: "Euclid",
    role: "Tester",
    memberId: "tester",
    taskId: "t3",
    summary: "Independent verification"
  }));
  s = team(await call("agent_team_subagent_started", {
    workspacePath: workspace,
    nativeAgentId: "wegener-1",
    name: "Wegener",
    role: "Reviewer",
    memberId: "reviewer",
    taskId: "t4",
    summary: "Independent code review"
  }));
  assert(s.nativeAgents.filter(a => a.status === "running").length === 2, "tester and reviewer should run concurrently");
  assert(s.phase === "reviewing", "active Reviewer should drive reviewing phase");

  let prematureRejected = false;
  try {
    await call("agent_team_update_task", { workspacePath: workspace, taskId: "t4", status: "done" });
  } catch (e) {
    prematureRejected = /native subagent is still running/i.test(e.message);
  }
  assert(prematureRejected, "linked task cannot finish before native agent");

  s = team(await call("agent_team_subagent_finished", {
    workspacePath: workspace,
    nativeAgentId: "euclid-1",
    status: "done",
    result: "All tests passed",
    evidence: ["npm test"]
  }));
  s = team(await call("agent_team_subagent_finished", {
    workspacePath: workspace,
    nativeAgentId: "wegener-1",
    status: "done",
    result: "No blocking findings",
    evidence: ["review report"]
  }));
  assert(s.phase === "completed", "native team should complete after all work and no active agents");
  assert(native(s, "Wegener")?.status === "done", "Reviewer should be done");

  const fallbackWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "aat-fallback-"));
  let f = team(await call("agent_team_create", {
    workspacePath: fallbackWorkspace,
    name: "fallback",
    members: [{ id: "developer", name: "Developer", role: "Developer" }],
    tasks: [{ id: "t1", subject: "Implement", assignee: "developer", kind: "implementation" }]
  }));
  let vagueRejected = false;
  try {
    await call("agent_team_set_execution_mode", { workspacePath: fallbackWorkspace, executionMode: "SEQUENTIAL_ROLE_FALLBACK", reason: "failed" });
  } catch (e) {
    vagueRejected = /too vague/i.test(e.message);
  }
  assert(vagueRejected, "fallback must require concrete evidence");
  f = team(await call("agent_team_set_execution_mode", {
    workspacePath: fallbackWorkspace,
    executionMode: "SEQUENTIAL_ROLE_FALLBACK",
    reason: "Native delegation returned unsupported in the current Codex host."
  }));
  assert(f.fallbackReason.includes("unsupported"), "fallback reason should be persisted");
  f = team(await call("agent_team_update_task", { workspacePath: fallbackWorkspace, taskId: "t1", status: "running" }));
  assert(task(f, "t1").status === "running", "evidence-backed fallback may execute single-context work");
  fs.rmSync(fallbackWorkspace, { recursive: true, force: true });

  const resource = await request("resources/read", { uri: "ui://auto-agent-team/team-dashboard.html" });
  const html = resource?.contents?.[0]?.text || "";
  assert(html.includes("第二道门禁尚未通过"), "dashboard should explain establishment hard gate");
  assert(html.includes("Agent Team 已建立"), "dashboard should show established state");
  assert(html.includes("Agent Team 未建立"), "dashboard should distinguish fallback");
  assert(html.includes("失败证据"), "dashboard should show fallback evidence");

  console.log("Auto Agent Team runtime smoke test passed.");
} finally {
  child.stdin.end();
  child.kill();
  fs.rmSync(workspace, { recursive: true, force: true });
  fs.rmSync(emptyWorkspace, { recursive: true, force: true });
  fs.rmSync(badWorkspace, { recursive: true, force: true });
}
