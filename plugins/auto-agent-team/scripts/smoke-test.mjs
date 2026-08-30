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

try {
  const init = await request("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "smoke-test", version: "1.0.0" } });
  if (init?.serverInfo?.name !== "Auto Agent Team Runtime") throw new Error("Unexpected serverInfo.name");

  const list = await request("tools/list");
  if (!Array.isArray(list?.tools) || list.tools.length !== 6) throw new Error("Expected six Agent Team tools");

  const create = await request("tools/call", {
    name: "agent_team_create",
    arguments: {
      workspacePath: workspace,
      name: "smoke-team",
      executionMode: "NATIVE_SUBAGENTS",
      members: [
        { id: "developer", name: "developer", role: "Developer" },
        { id: "reviewer", name: "reviewer", role: "Reviewer" }
      ],
      tasks: [
        { id: "t1", subject: "Implement", assignee: "developer", status: "running" },
        { id: "t2", subject: "Review", assignee: "reviewer", dependencies: ["t1"] }
      ]
    }
  });
  if (create?.structuredContent?.team?.name !== "smoke-team") throw new Error("Team creation failed");

  await request("tools/call", {
    name: "agent_team_update_task",
    arguments: { workspacePath: workspace, taskId: "t1", status: "done", result: "smoke ok", evidence: ["runtime smoke test"] }
  });

  const render = await request("tools/call", { name: "agent_team_render_dashboard", arguments: { workspacePath: workspace } });
  if (render?._meta?.ui?.resourceUri !== "ui://auto-agent-team/team-dashboard.html") throw new Error("Dashboard resource metadata missing");

  const resource = await request("resources/read", { uri: "ui://auto-agent-team/team-dashboard.html" });
  const html = resource?.contents?.[0]?.text;
  if (typeof html !== "string" || !html.includes("Agent Team")) throw new Error("Dashboard HTML resource missing");

  const stateFile = path.join(workspace, ".agent-team", "team.json");
  if (!fs.existsSync(stateFile)) throw new Error("team.json was not written");

  console.log("Auto Agent Team runtime smoke test passed.");
} finally {
  child.stdin.end();
  child.kill();
  fs.rmSync(workspace, { recursive: true, force: true });
}
