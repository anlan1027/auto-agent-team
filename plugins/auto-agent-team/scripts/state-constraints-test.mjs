import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'aat-constraints-'));
const stateFile = path.join(workspace, '.agent-team', 'team.json');
const child = spawn(process.execPath, [fileURLToPath(new URL('../mcp/server.mjs', import.meta.url))], { stdio: ['pipe', 'pipe', 'inherit'] });
const closed = once(child, 'close');
const lines = readline.createInterface({ input: child.stdout });
let nextId = 0;
const pending = new Map();
lines.on('line', line => {
  const message = JSON.parse(line);
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  clearTimeout(entry.timer);
  message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result.structuredContent?.team);
});
function call(name, args = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${name}`)); }, 5000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: { workspacePath: workspace, ...args } } }) + '\n');
  });
}
const create = tasks => call('agent_team_create', { name: 'dependency regression', tasks });
const update = (taskId, status) => call('agent_team_update_task', { taskId, status });
const start = (nativeAgentId, taskId) => call('agent_team_subagent_started', { nativeAgentId, name: nativeAgentId, role: 'Developer', taskId });
const finish = (nativeAgentId, status = 'done') => call('agent_team_subagent_finished', { nativeAgentId, status });
const task = (state, id) => state.tasks.find(item => item.id === id);
async function rejectedUnchanged(action, pattern) {
  const before = fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf8') : null;
  await assert.rejects(action, pattern);
  assert.equal(fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf8') : null, before, 'rejected operation must not persist changes');
}

try {
  const graph = [{ id: 'A' }, { id: 'B', dependencies: ['A'] }, { id: 'C', dependencies: ['B'] }, { id: 'D' }];
  await create(graph);
  for (const status of ['running', 'done']) {
    await rejectedUnchanged(() => update('B', status), /B.*A/);
    await rejectedUnchanged(() => create([{ id: 'A' }, { id: 'B', dependencies: ['A'], status }]), /B.*A/);
    await rejectedUnchanged(() => call('agent_team_add_task', { task: { id: 'E', dependencies: ['A'], status } }), /E.*A/);
  }
  await rejectedUnchanged(() => start('blocked-agent', 'B'), /B/);
  await update('D', 'running'); // independent work can proceed
  await update('A', 'running');
  await rejectedUnchanged(() => update('B', 'done'), /B.*A/);
  await update('A', 'failed');
  await rejectedUnchanged(() => update('B', 'running'), /B.*A/);
  await update('A', 'done');
  assert.equal(task(await update('B', 'running'), 'B').status, 'running');
  await rejectedUnchanged(() => update('A', 'pending'), /A.*B/);
  await update('B', 'done');
  await update('C', 'done');
  await rejectedUnchanged(() => update('A', 'failed'), /A.*B/);
  await rejectedUnchanged(() => update('B', 'pending'), /B.*C/);
  await update('C', 'pending');
  const reset = await update('B', 'pending');
  assert.equal(task(reset, 'B').completedAt, null);
  await update('A', 'pending'); // explicit downstream reset permits upstream reopening

  await create([{ id: 'A', status: 'done' }, { id: 'B', dependencies: ['A'], status: 'done' }]);
  await create(graph);
  await update('A', 'done');
  await start('first', 'B');
  await start('second', 'B');
  await rejectedUnchanged(() => update('B', 'done'), /linked native subagent/);
  const partial = await finish('first');
  assert.equal(task(partial, 'B').status, 'running', 'one agent finishing cannot complete shared task');
  assert.equal(task(partial, 'C').status, 'pending');
  await rejectedUnchanged(() => update('A', 'pending'), /A.*B/);
  const complete = await finish('second');
  assert.equal(task(complete, 'B').status, 'done');
  assert.equal(task(complete, 'C').status, 'ready');
  await update('C', 'done');
  await rejectedUnchanged(() => finish('second', 'failed'), /terminal status/);
  await update('C', 'pending');
  await update('B', 'pending');
  const beforeReplay = fs.readFileSync(stateFile, 'utf8');
  assert.equal(task(await finish('second'), 'B').status, 'ready', 'old completion replay must not complete reopened task');
  assert.equal(fs.readFileSync(stateFile, 'utf8'), beforeReplay);

  await create(graph);
  await update('A', 'done');
  await start('failed-peer', 'B');
  await start('successful-peer', 'B');
  await finish('failed-peer', 'failed');
  await rejectedUnchanged(() => update('B', 'pending'), /B.*linked native subagent/);
  assert.equal(task(await finish('successful-peer'), 'B').status, 'failed', 'a successful peer cannot erase failure');
  await update('B', 'pending');
  await start('retry', 'B');
  assert.equal(task(await finish('retry'), 'B').status, 'done', 'past failures cannot poison an explicit retry');

  console.log('Runtime state constraint regression tests passed.');
} finally {
  for (const entry of pending.values()) clearTimeout(entry.timer);
  lines.close();
  child.stdin.end();
  child.kill();
  await closed;
  fs.rmSync(workspace, { recursive: true, force: true });
}
