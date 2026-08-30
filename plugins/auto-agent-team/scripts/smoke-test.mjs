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
const child = spawn(process.execPath, [serverPath], { stdio: ["pipe", "pipe", "inherit"] });
const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
const pending = new Map();
let nextId = 1;
function request(method, params = {}) {
  const id = nextId++;
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${method}`)), 5000);
    pending.set(id, { resolve, reject, timer });
  });
}
lines.on("line", line => {
  const msg = JSON.parse(line);
  if (!pending.has(msg.id)) return;
  const p = pending.get(msg.id); pending.delete(msg.id); clearTimeout(p.timer);
  msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
});
const assert = (c, m) => { if (!c) throw new Error(m); };
const team = r => r?.structuredContent?.team;
const task = (s, id) => s.tasks.find(t => t.id === id);
const member = (s, id) => s.members.find(m => m.id === id);
try {
  const init = await request("initialize", { protocolVersion: "2025-11-25" });
  assert(init.serverInfo.version === "0.3.0-dev.2", "wrong version");
  const list = await request("tools/list");
  assert(list.tools.length === 8, "expected 8 tools");

  const emptyGet = await request("tools/call", { name: "agent_team_get", arguments: { workspacePath: emptyWorkspace } });
  assert(emptyGet.structuredContent.initialized === false, "fresh get should not fail");
  const emptyRender = await request("tools/call", { name: "agent_team_render_dashboard", arguments: { workspacePath: emptyWorkspace } });
  assert(team(emptyRender).id === "uninitialized-agent-team", "fresh render should be uninitialized");

  let s = team(await request("tools/call", { name: "agent_team_create", arguments: {
    workspacePath: workspace, name: "todo", executionMode: "UNKNOWN",
    members: [
      { id: "manager", name: "Manager", role: "Manager" },
      { id: "developer", name: "Developer", role: "Developer" },
      { id: "tester", name: "Tester", role: "Tester" },
      { id: "reviewer", name: "Reviewer", role: "Reviewer" }
    ],
    tasks: [
      { id: "t1", subject: "Plan", assignee: "manager" },
      { id: "t2", subject: "Implement", assignee: "developer", kind: "implementation", dependencies: ["t1"] },
      { id: "t3", subject: "Verify", assignee: "tester", kind: "verification", dependencies: ["t2"] },
      { id: "t4", subject: "Review", assignee: "reviewer", kind: "review", dependencies: ["t2"] }
    ]
  } }));
  assert(s.executionMode === "UNKNOWN", "mode should start UNKNOWN");
  assert(task(s,"t1").status === "ready", "t1 should be ready");

  s = team(await request("tools/call", { name: "agent_team_set_execution_mode", arguments: { workspacePath: workspace, executionMode: "NATIVE_SUBAGENTS", reason: "Reviewer delegated" } }));
  assert(s.executionMode === "NATIVE_SUBAGENTS", "mode should switch to native");

  for (const [id, status] of [["t1","done"],["t2","done"],["t3","done"],["t4","done"]]) {
    s = team(await request("tools/call", { name: "agent_team_update_task", arguments: { workspacePath: workspace, taskId: id, status } }));
  }
  assert(s.phase === "completed", "team should complete");
  assert(s.members.every(m => m.status === "done" && m.currentTask === null), "completed team should converge all members");

  s = team(await request("tools/call", { name: "agent_team_add_task", arguments: { workspacePath: workspace, task: {
    id: "t5", subject: "Fix review findings", assignee: "developer", kind: "implementation", dependencies: ["t4"]
  } } }));
  assert(s.phase !== "completed", "adding remediation should reopen team");
  assert(task(s,"t5").status === "ready", "remediation should become ready");
  assert(member(s,"developer").status === "idle", "developer should reopen from done");

  s = team(await request("tools/call", { name: "agent_team_add_task", arguments: { workspacePath: workspace, task: {
    id: "t6", subject: "Regression", assignee: "tester", kind: "regression", dependencies: ["t5"]
  } } }));
  s = team(await request("tools/call", { name: "agent_team_add_task", arguments: { workspacePath: workspace, task: {
    id: "t7", subject: "Re-review", assignee: "reviewer", kind: "re_review", dependencies: ["t6"]
  } } }));
  assert(task(s,"t6").status === "pending" && task(s,"t7").status === "pending", "follow-up dependencies wrong");

  console.log("Auto Agent Team runtime smoke test passed.");
} finally {
  child.stdin.end(); child.kill();
  fs.rmSync(workspace,{recursive:true,force:true}); fs.rmSync(emptyWorkspace,{recursive:true,force:true});
}
