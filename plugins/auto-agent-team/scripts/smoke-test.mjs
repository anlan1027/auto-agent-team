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
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`timeout: ${method}`)); }, 5000);
    pending.set(id, { resolve, reject, timer });
  });
}
lines.on("line", line => {
  if (!line.trim()) return;
  const msg = JSON.parse(line);
  if (!pending.has(msg.id)) return;
  const p = pending.get(msg.id); pending.delete(msg.id); clearTimeout(p.timer);
  msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
});
const assert = (c, m) => { if (!c) throw new Error(m); };
const team = r => r?.structuredContent?.team;
const task = (s, id) => s.tasks.find(t => t.id === id);
const member = (s, id) => s.members.find(m => m.id === id);
const native = (s, name) => s.nativeAgents.find(a => a.name === name);

try {
  const init = await request("initialize", { protocolVersion: "2025-11-25" });
  assert(init.serverInfo.version === "0.3.2", "wrong runtime version");
  assert(/first Runtime action/i.test(init.instructions), "runtime should instruct immediate post-spawn lifecycle recording");
  const list = await request("tools/list");
  assert(list.tools.length === 10, "expected 10 tools");
  assert(list.tools.some(t => t.name === "agent_team_subagent_started"), "missing subagent started tool");
  assert(list.tools.some(t => t.name === "agent_team_subagent_finished"), "missing subagent finished tool");

  const emptyGet = await request("tools/call", { name: "agent_team_get", arguments: { workspacePath: emptyWorkspace } });
  assert(emptyGet.structuredContent.initialized === false, "fresh get should not fail");
  const emptyRender = await request("tools/call", { name: "agent_team_render_dashboard", arguments: { workspacePath: emptyWorkspace } });
  assert(team(emptyRender).id === "uninitialized-agent-team", "fresh render should be uninitialized");
  assert(team(emptyRender).schemaVersion === 5, "uninitialized dashboard should use schema 5");
  assert(Array.isArray(team(emptyRender).nativeAgents), "uninitialized dashboard should include nativeAgents");

  let s = team(await request("tools/call", { name: "agent_team_create", arguments: {
    workspacePath: workspace, name: "todo", executionMode: "UNKNOWN",
    members: [
      { id: "manager", name: "Manager", role: "Manager" },
      { id: "developer", name: "Developer", role: "Developer" },
      { id: "tester", name: "Tester", role: "Tester" },
      { id: "reviewer", name: "Reviewer", role: "Reviewer" }
    ],
    tasks: [
      { id: "t1", subject: "Task 1", assignee: "manager" },
      { id: "t2", subject: "Task 2", assignee: "developer", dependencies: ["t1"] },
      { id: "t3", subject: "Task 3", assignee: "tester", dependencies: ["t2"] },
      { id: "t4", subject: "Task 4", assignee: "reviewer", dependencies: ["t3"] }
    ]
  } }));
  assert(s.schemaVersion === 5, "expected schema 5");
  assert(s.executionMode === "UNKNOWN", "mode should start UNKNOWN");
  assert(s.tasks.every(t => t.taskClass === "main"), "creation tasks should all be main tasks");
  assert(task(s,"t2").kind === "implementation", "developer task kind should be inferred as implementation");
  assert(task(s,"t3").kind === "verification", "tester task kind should be inferred as verification");
  assert(task(s,"t4").kind === "review", "reviewer task kind should be inferred as review");
  assert(task(s,"t2").subject !== "Task 2" && task(s,"t3").subject !== "Task 3" && task(s,"t4").subject !== "Task 4", "generic task titles should be normalized");
  assert(task(s,"t1").status === "ready", "t1 should be ready");

  let fallbackWithoutReasonRejected = false;
  try {
    await request("tools/call", { name: "agent_team_set_execution_mode", arguments: { workspacePath: workspace, executionMode: "SEQUENTIAL_ROLE_FALLBACK" } });
  } catch (e) {
    fallbackWithoutReasonRejected = /requires a concrete reason/i.test(e.message);
  }
  assert(fallbackWithoutReasonRejected, "fallback should require a concrete reason");

  let directNativeRejected = false;
  try {
    await request("tools/call", { name: "agent_team_set_execution_mode", arguments: { workspacePath: workspace, executionMode: "NATIVE_SUBAGENTS" } });
  } catch (e) {
    directNativeRejected = /tracked native subagent/i.test(e.message);
  }
  assert(directNativeRejected, "native mode should require a tracked real native subagent");

  s = team(await request("tools/call", { name: "agent_team_set_execution_mode", arguments: {
    workspacePath: workspace, executionMode: "SEQUENTIAL_ROLE_FALLBACK", reason: "Host reports native spawn unsupported"
  } }));
  assert(s.executionMode === "SEQUENTIAL_ROLE_FALLBACK", "fallback should be allowed with reason before native delegation");
  assert(s.fallbackReason === "Host reports native spawn unsupported", "fallback reason should persist");

  s = team(await request("tools/call", { name: "agent_team_set_execution_mode", arguments: { workspacePath: workspace, executionMode: "UNKNOWN" } }));
  assert(s.executionMode === "UNKNOWN", "pre-native fallback may return to UNKNOWN for reassessment");
  assert(s.fallbackReason === null, "leaving fallback should clear fallback reason");

  s = team(await request("tools/call", { name: "agent_team_update_task", arguments: { workspacePath: workspace, taskId: "t1", status: "done" } }));
  assert(task(s,"t2").status === "ready", "implementation should become ready");
  s = team(await request("tools/call", { name: "agent_team_update_task", arguments: { workspacePath: workspace, taskId: "t2", status: "running" } }));
  assert(s.phase === "running", "implementation task should drive execution phase");

  s = team(await request("tools/call", { name: "agent_team_subagent_started", arguments: {
    workspacePath: workspace, nativeAgentId: "hubble-sidecar", name: "Hubble", role: "Tester", memberId: "tester", summary: "Sidecar verification planning before formal verification unlocks"
  } }));
  assert(s.executionMode === "NATIVE_SUBAGENTS", "native start should switch execution mode");
  assert(native(s,"Hubble")?.status === "running", "Hubble should be running");
  assert(member(s,"tester").status === "working", "tester member should reflect active sidecar");
  assert(s.phase === "running", "sidecar Tester must not advance phase while main implementation is running");

  s = team(await request("tools/call", { name: "agent_team_subagent_finished", arguments: {
    workspacePath: workspace, nativeAgentId: "hubble-sidecar", status: "done", result: "Prepared verification plan", evidence: ["QA plan"]
  } }));
  assert(native(s,"Hubble")?.status === "done", "Hubble should be done");
  assert(s.executionMode === "NATIVE_SUBAGENTS", "native mode should remain after sidecar finishes");
  assert(s.phase === "running", "implementation phase should remain running after sidecar finishes");

  let nativeDowngradeRejected = false;
  try {
    await request("tools/call", { name: "agent_team_set_execution_mode", arguments: {
      workspacePath: workspace, executionMode: "SEQUENTIAL_ROLE_FALLBACK", reason: "Trying to downgrade after native success"
    } });
  } catch (e) {
    nativeDowngradeRejected = /sticky/i.test(e.message);
  }
  assert(nativeDowngradeRejected, "native mode should be sticky once a real native subagent has been recorded");

  s = team(await request("tools/call", { name: "agent_team_update_task", arguments: { workspacePath: workspace, taskId: "t2", status: "done" } }));
  assert(task(s,"t3").status === "ready", "verification should become ready");
  s = team(await request("tools/call", { name: "agent_team_subagent_started", arguments: {
    workspacePath: workspace, nativeAgentId: "curie-test", name: "Curie", role: "Tester", memberId: "tester", taskId: "t3", summary: "Formal verification"
  } }));
  assert(task(s,"t3").status === "running", "linked verification task should become running");
  assert(s.phase === "verifying", "formal verification task should drive verifying phase");
  s = team(await request("tools/call", { name: "agent_team_subagent_finished", arguments: {
    workspacePath: workspace, nativeAgentId: "curie-test", status: "done", result: "Verification passed", evidence: ["npm test", "npm run build", "npm run smoke"]
  } }));
  assert(task(s,"t3").status === "done", "verification task should complete with native Tester");
  assert(task(s,"t4").status === "ready", "review should become ready after verification");

  s = team(await request("tools/call", { name: "agent_team_subagent_started", arguments: {
    workspacePath: workspace, nativeAgentId: "wegener-review", name: "Wegener", role: "Reviewer", memberId: "reviewer", taskId: "t4", summary: "Independent code review"
  } }));
  assert(native(s,"Wegener")?.status === "running", "Wegener should be running");
  assert(task(s,"t4").status === "running", "linked review task should become running");
  assert(s.phase === "reviewing", "formal Reviewer task should drive reviewing phase");

  let prematureRejected = false;
  try {
    await request("tools/call", { name: "agent_team_update_task", arguments: { workspacePath: workspace, taskId: "t4", status: "done" } });
  } catch (e) {
    prematureRejected = /native subagent is still running/i.test(e.message);
  }
  assert(prematureRejected, "runtime should reject task done while linked native subagent is active");

  s = team(await request("tools/call", { name: "agent_team_subagent_finished", arguments: {
    workspacePath: workspace, nativeAgentId: "wegener-review", status: "done", result: "2 High findings", evidence: ["main.py:42", "storage.py:10"]
  } }));
  assert(native(s,"Wegener")?.status === "done", "Wegener should be done");
  assert(task(s,"t4").status === "done", "review task should complete with subagent");
  assert(task(s,"t4").result === "2 High findings", "review result should propagate to task");
  assert(s.phase === "completed", "team may complete once all current tasks are done and no native agent is active");
  assert(s.members.every(m => m.status === "done" && m.currentTask === null), "completed team should converge members");

  s = team(await request("tools/call", { name: "agent_team_add_task", arguments: { workspacePath: workspace, task: {
    id: "d1", assignee: "developer", dependencies: ["t4"]
  } } }));
  assert(s.phase !== "completed", "adding remediation should reopen team");
  assert(task(s,"d1").status === "ready", "remediation should be ready");
  assert(task(s,"d1").taskClass === "dynamic", "added remediation should be a dynamic task");
  assert(task(s,"d1").kind === "implementation", "dynamic developer task should infer implementation kind");
  assert(task(s,"d1").subject !== "Task 1", "generic dynamic task title should be normalized");
  assert(s.tasks.filter(t => t.taskClass === "main").length === 4, "main task denominator should remain fixed");

  const resource = await request("resources/read", { uri: "ui://auto-agent-team/team-dashboard.html" });
  const html = resource?.contents?.[0]?.text || "";
  assert(html.includes("原生子智能体") && html.includes("仍有 ${activeNative.length} 个原生子智能体运行中"), "dashboard should expose native subagent state");
  assert(html.includes("主任务完成") && html.includes("动态子任务"), "dashboard should separate main and dynamic tasks");
  assert(html.includes('t.taskClass==="dynamic"'), "dashboard should prefer persisted runtime taskClass");
  assert(html.includes("保底原因"), "dashboard should display fallback reason when fallback is active");
  assert(html.includes("effectiveTaskKind") && html.includes("verification") && html.includes("review"), "dashboard should classify verification/review with role fallback");

  console.log("Auto Agent Team runtime smoke test passed.");
} finally {
  child.stdin.end(); child.kill();
  fs.rmSync(workspace,{recursive:true,force:true}); fs.rmSync(emptyWorkspace,{recursive:true,force:true});
}
