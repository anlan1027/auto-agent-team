import { spawn } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, '..');
const serverPath = path.join(pluginRoot, 'mcp', 'adaptive-server.mjs');
const child = spawn(process.execPath, [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit'],
});
const lines = readline.createInterface({
  input: child.stdout,
  crlfDelay: Infinity,
});

const pending = new Map();
let nextId = 1;

function request(method, params = {}) {
  const id = nextId++;
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timeout: ${method}`));
    }, 5000);

    pending.set(id, { resolve, reject, timer });
  });
}

lines.on('line', line => {
  if (!line.trim()) return;

  const message = JSON.parse(line);
  const entry = pending.get(message.id);
  if (!entry) return;

  pending.delete(message.id);
  clearTimeout(entry.timer);

  if (message.error) {
    entry.reject(new Error(message.error.message));
  } else {
    entry.resolve(message.result);
  }
});

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

try {
  const init = await request('initialize', {
    protocolVersion: '2025-11-25',
  });
  assert(
    init.serverInfo?.name === 'Auto Agent Team Adaptive Runtime',
    'wrong adaptive MCP server name'
  );
  assert(init.serverInfo?.version === '0.1.0', 'wrong adaptive MCP version');

  const listed = await request('tools/list');
  assert(listed.tools.length === 3, 'adaptive MCP should expose exactly 3 tools');
  assert(
    listed.tools.some(tool => tool.name === 'agent_team_adaptive_plan'),
    'missing adaptive plan tool'
  );
  assert(
    listed.tools.some(tool => tool.name === 'agent_team_adaptive_complete'),
    'missing adaptive complete tool'
  );
  assert(
    listed.tools.some(tool => tool.name === 'agent_team_adaptive_memory'),
    'missing adaptive memory tool'
  );

  const task = '修复 STM32 UART bug 并验证';

  const firstPlanResult = await request('tools/call', {
    name: 'agent_team_adaptive_plan',
    arguments: { task },
  });
  const firstPlan = firstPlanResult.structuredContent?.plan;
  assert(firstPlan, 'adaptive plan should return structured plan data');
  assert(firstPlan.complexity?.level === 1, 'first task should begin at level 1');
  assert(firstPlan.executionMode === 'single-agent', 'first task should begin single-agent');

  const failedResult = await request('tools/call', {
    name: 'agent_team_adaptive_complete',
    arguments: {
      plan: firstPlan,
      result: {
        success: false,
        output: 'UART still times out',
        errors: ['timeout during smoke verification'],
      },
    },
  });
  assert(
    failedResult.structuredContent?.completion?.success === false,
    'failed execution should be recorded as failed'
  );

  const retryPlanResult = await request('tools/call', {
    name: 'agent_team_adaptive_plan',
    arguments: { task },
  });
  const retryPlan = retryPlanResult.structuredContent?.plan;
  assert(retryPlan.adaptation?.failureCount === 1, 'retry should find one previous failure');
  assert(retryPlan.adaptation?.requireTester === true, 'retry should require tester');
  assert(retryPlan.agents.includes('tester'), 'retry team should include tester');
  assert(retryPlan.executionMode === 'small-team', 'retry should escalate to small-team');
  assert(retryPlan.verificationLevel === 'standard', 'retry should raise verification to standard');

  const memoryAfterFailure = await request('tools/call', {
    name: 'agent_team_adaptive_memory',
    arguments: {},
  });
  assert(
    memoryAfterFailure.structuredContent?.failures?.length === 1,
    'adaptive memory should expose one failure'
  );
  assert(
    memoryAfterFailure.structuredContent?.persistence === 'process-local',
    'adaptive memory must truthfully report process-local persistence'
  );

  const successResult = await request('tools/call', {
    name: 'agent_team_adaptive_complete',
    arguments: {
      plan: retryPlan,
      result: {
        success: true,
        output: 'UART smoke verification passed',
        errors: [],
      },
    },
  });
  assert(
    successResult.structuredContent?.completion?.success === true,
    'successful retry should be recorded as successful'
  );

  const finalMemory = await request('tools/call', {
    name: 'agent_team_adaptive_memory',
    arguments: {},
  });
  assert(
    finalMemory.structuredContent?.taskMemory?.length === 1,
    'successful retry should create one task memory record'
  );

  console.log('Adaptive MCP smoke test passed.');
  console.log(JSON.stringify({
    first: {
      level: firstPlan.complexity.level,
      mode: firstPlan.executionMode,
      agents: firstPlan.agents,
    },
    retry: {
      failureCount: retryPlan.adaptation.failureCount,
      mode: retryPlan.executionMode,
      verificationLevel: retryPlan.verificationLevel,
      agents: retryPlan.agents,
    },
    memory: {
      failures: finalMemory.structuredContent.failures.length,
      successes: finalMemory.structuredContent.taskMemory.length,
      persistence: finalMemory.structuredContent.persistence,
    },
  }, null, 2));
} finally {
  child.stdin.end();
  child.kill();
}
