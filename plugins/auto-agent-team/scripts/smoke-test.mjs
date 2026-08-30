import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, "..");
const serverPath = path.join(pluginRoot, "mcp", "server.mjs");
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "auto-agent-team-smoke-"));
const cycleWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "auto-agent-team-cycle-"));
const child = spawn(process.execPath, [serverPath], { stdio: ["pipe", "pipe", "inherit"] });
const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
const pending = new Map();
let nextId = 1;

function request(method, params = {}) {
  const id = nextId++;
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for ${method}`));
    }, 5000);
    pending.set(id, { resolve, reject, timer });
  });
}

lines.on("line", line => {
  if (!line.trim()) return;
  const msg = JSON.parse(line);
  if (msg.id === undefined || !pending.has(msg.id)) return;
  const p = pending.get(msg.id);
  pending.delete(msg.id);
  clearTimeout(p.timer);
  if (msg.error) p.reject(new Error(msg.error.message || "MCP error"));
  else p.resolve(msg.result);
});

function team(result) { return result?.structuredContent?.team; }
function task(state, id) { return state.tasks.find(item => item.id === id); }
function member(state, id) { return state.members.find(item => item.id === id); }
function assert(condition, message) { if (!condition) throw new Error(message); }

try {
  const init = await request("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "smoke-test", version: "1.0.0" } });
  assert(init?.serverInfo?.name === "Auto Agent Team Runtime", "Unexpected serverInfo.name");

  const list = await request("tools/list");
  assert(Array.isArray(list?.tools) && list.tools.length === 6, "Expected six Agent Team tools");

  const create = await request("tools/call", {
    name: "agent_team_create",
    arguments: {
      workspacePath: workspace,
      name: "smoke-team",
      executionMode: "NATIVE_SUBAGENTS",
      members: [
        { id: "researcher", name: "Researcher", role: "Researcher" },
        { id: "developer", name: "Developer", role: "Developer" },
        { id: "tester", name: "Tester", role: "Tester" },
        { id: "reviewer", name: "Reviewer", role: "Reviewer" }
      ],
      tasks: [
        { id: "t1", subject: "Research", assignee: "researcher", kind: "research" },
        { id: "t2", subject: "Implement", assignee: "developer", kind: "implementation", dependencies: ["t1"] },
        { id: "t3", subject: "Verify", assignee: "tester", kind: "verification", dependencies: ["t2"] },
        { id: "t4", subject: "Review", assignee: "reviewer", kind: "review", dependencies: ["t2"] }
      ]
    }
  });
  let state = team(create);
  assert(state?.name === "smoke-team", "Team creation failed");
  assert(state.schemaVersion === 2, "Expected schemaVersion 2");
  assert(task(state, "t1").status === "ready", "Dependency-free t1 should auto-ready");
  assert(task(state, "t2").status === "pending", "t2 should wait for t1");
  assert(member(state, "researcher").currentTask === "t1", "Researcher should be pointed at ready t1");

  state = team(await request("tools/call", { name: "agent_team_update_task", arguments: { workspacePath: workspace, taskId: "t1", status: "running" } }));
  assert(state.phase === "running", "Running work should set phase running");
  assert(member(state, "researcher").status === "working", "Researcher should derive working from t1");

  state = team(await request("tools/call", { name: "agent_team_update_task", arguments: { workspacePath: workspace, taskId: "t1", status: "done", result: "research complete" } }));
  assert(task(state, "t2").status === "ready", "Completing t1 should unlock t2");
  assert(member(state, "researcher").status === "done", "Researcher should complete when assigned work is done");

  state = team(await request("tools/call", { name: "agent_team_update_task", arguments: { workspacePath: workspace, taskId: "t2", status: "failed", result: "simulated failure" } }));
  assert(task(state, "t3").status === "blocked" && task(state, "t4").status === "blocked", "Failure should block downstream tasks");
  assert(state.phase === "blocked", "No runnable recovery work should set phase blocked");

  state = team(await request("tools/call", { name: "agent_team_update_task", arguments: { workspacePath: workspace, taskId: "t2", status: "running" } }));
  assert(state.phase === "running", "Retrying t2 should return phase to running");
  state = team(await request("tools/call", { name: "agent_team_update_task", arguments: { workspacePath: workspace, taskId: "t2", status: "done", result: "implementation complete", evidence: ["smoke evidence"] } }));
  assert(task(state, "t3").status === "ready" && task(state, "t4").status === "ready", "Recovering t2 should unblock downstream tasks");

  state = team(await request("tools/call", { name: "agent_team_update_task", arguments: { workspacePath: workspace, taskId: "t3", status: "running" } }));
  assert(state.phase === "verifying", "Verification task should set verifying phase");
  state = team(await request("tools/call", { name: "agent_team_update_task", arguments: { workspacePath: workspace, taskId: "t3", status: "done", result: "tests passed", evidence: ["12/12"] } }));
  state = team(await request("tools/call", { name: "agent_team_update_task", arguments: { workspacePath: workspace, taskId: "t4", status: "running" } }));
  assert(state.phase === "reviewing", "Review task should set reviewing phase");
  state = team(await request("tools/call", { name: "agent_team_update_task", arguments: { workspacePath: workspace, taskId: "t4", status: "done", result: "review passed" } }));
  assert(state.phase === "completed", "All tasks done should complete team");
  assert(state.members.every(item => item.status === "done"), "All task-assigned members should be done");

  const render = await request("tools/call", { name: "agent_team_render_dashboard", arguments: { workspacePath: workspace } });
  assert(render?._meta?.ui?.resourceUri === "ui://auto-agent-team/team-dashboard.html", "Dashboard resource metadata missing");

  const resource = await request("resources/read", { uri: "ui://auto-agent-team/team-dashboard.html" });
  const html = resource?.contents?.[0]?.text;
  assert(typeof html === "string" && html.includes("总体进度") && html.includes("验证与审查"), "Dashboard v2 HTML resource missing");

  const stateFile = path.join(workspace, ".agent-team", "team.json");
  assert(fs.existsSync(stateFile), "team.json was not written");
  const diskState = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  assert(diskState.phase === "completed", "Persisted state should be completed");

  let cycleRejected = false;
  try {
    await request("tools/call", {
      name: "agent_team_create",
      arguments: {
        workspacePath: cycleWorkspace,
        name: "cycle-team",
        tasks: [
          { id: "a", dependencies: ["b"] },
          { id: "b", dependencies: ["a"] }
        ]
      }
    });
  } catch (e) {
    cycleRejected = /cycle/i.test(e.message);
  }
  assert(cycleRejected, "Dependency cycles should be rejected");

  console.log("Auto Agent Team runtime smoke test passed.");
} finally {
  child.stdin.end();
  child.kill();
  fs.rmSync(workspace, { recursive: true, force: true });
  fs.rmSync(cycleWorkspace, { recursive: true, force: true });
}
