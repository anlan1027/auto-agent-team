import readline from 'node:readline';
import {
  prepareExecutionPlan,
  completeExecution,
} from '../core/manager/index.mjs';
import { listFailures } from '../core/memory/failure-memory.mjs';
import { listTaskMemory } from '../core/memory/task-memory.mjs';

const SERVER_NAME = 'Auto Agent Team Adaptive Runtime';
const SERVER_VERSION = '0.1.0';
const PROTOCOL_VERSION = '2025-11-25';

const tools = [
  {
    name: 'agent_team_adaptive_plan',
    title: 'Plan adaptive Agent Team execution',
    description:
      'Analyze task complexity, historical failures, dynamic specialist roles, verification level, and workflow before Runtime team creation or native delegation.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string' },
      },
      required: ['task'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'agent_team_adaptive_complete',
    title: 'Complete adaptive Agent Team execution',
    description:
      'Record a real execution outcome after verification/review so later planning in this MCP process can adapt to previous success or failure.',
    inputSchema: {
      type: 'object',
      properties: {
        plan: { type: 'object', additionalProperties: true },
        result: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            output: { type: 'string' },
            errors: { type: 'array', items: { type: 'string' } },
          },
          required: ['success'],
          additionalProperties: true,
        },
      },
      required: ['plan', 'result'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: 'agent_team_adaptive_memory',
    title: 'Inspect adaptive session memory',
    description:
      'Inspect successful task memories and failure memories held by the current Adaptive MCP process. Memory is session-local and is not yet persisted across process restarts.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

const lines = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

lines.on('line', line => {
  if (!line.trim()) return;

  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    sendError(null, -32700, `Invalid JSON: ${error.message}`);
    return;
  }

  try {
    handle(message);
  } catch (error) {
    if (message?.id !== undefined) {
      sendError(message.id, -32603, error?.message || String(error));
    }
  }
});

function handle(message) {
  const { id, method, params = {} } = message || {};

  // MCP notifications do not receive responses.
  if (method === 'notifications/initialized') return;

  if (method === 'initialize') {
    sendResult(id, {
      protocolVersion: params.protocolVersion || PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      instructions:
        'Use agent_team_adaptive_plan before logical team creation/native delegation when adaptive planning is useful. Use agent_team_adaptive_complete only after real execution plus verification/review. Adaptive memory is session-local until persistent storage is implemented.',
    });
    return;
  }

  if (method === 'tools/list') {
    sendResult(id, { tools });
    return;
  }

  if (method === 'tools/call') {
    const name = String(params?.name || '');
    const args = params?.arguments || {};
    const value = callTool(name, args);
    sendResult(id, value);
    return;
  }

  sendError(id, -32601, `Unknown method: ${method}`);
}

function callTool(name, args) {
  if (name === 'agent_team_adaptive_plan') {
    const task = requireNonEmptyString(args.task, 'task');
    const plan = prepareExecutionPlan(task);
    return toolResult(
      `Adaptive plan ready: level ${plan.complexity?.level ?? '?'} / ${plan.executionMode}.`,
      { plan }
    );
  }

  if (name === 'agent_team_adaptive_complete') {
    if (!args.plan || typeof args.plan !== 'object' || Array.isArray(args.plan)) {
      throw new Error('plan must be an object.');
    }
    if (!args.result || typeof args.result !== 'object' || Array.isArray(args.result)) {
      throw new Error('result must be an object.');
    }
    if (typeof args.result.success !== 'boolean') {
      throw new Error('result.success must be a boolean.');
    }

    const completion = completeExecution({
      plan: args.plan,
      result: {
        ...args.result,
        errors: Array.isArray(args.result.errors)
          ? args.result.errors.map(String)
          : [],
      },
    });

    return toolResult(
      completion.success
        ? 'Adaptive execution recorded as successful.'
        : 'Adaptive execution recorded as failed; the next matching plan may escalate.',
      { completion }
    );
  }

  if (name === 'agent_team_adaptive_memory') {
    const taskMemory = listTaskMemory();
    const failures = listFailures();
    return toolResult(
      `Adaptive session memory: ${taskMemory.length} successful task record(s), ${failures.length} failure record(s).`,
      {
        persistence: 'process-local',
        taskMemory,
        failures,
      }
    );
  }

  throw new Error(`Unknown tool: ${name}`);
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function toolResult(text, structuredContent) {
  return {
    content: [{ type: 'text', text }],
    structuredContent,
  };
}

function sendResult(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}

function sendError(id, code, message) {
  process.stdout.write(
    `${JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: { code, message },
    })}\n`
  );
}
