import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const checks = [
  {
    name: 'Adaptive Core',
    script: 'adaptive-core-smoke-test.mjs',
  },
  {
    name: 'Adaptive MCP',
    script: 'adaptive-mcp-smoke-test.mjs',
  },
  {
    name: 'Existing Runtime',
    script: 'smoke-test.mjs',
  },
];

for (const check of checks) {
  console.log(`\n=== ${check.name} ===`);

  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, check.script)],
    {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
    }
  );

  if (result.error) {
    console.error(`${check.name} failed to start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`${check.name} failed with exit code ${result.status}.`);
    process.exit(result.status || 1);
  }
}

console.log('\nAll Auto Agent Team verification checks passed.');
console.log('Next validation step: load the plugin in Codex and confirm both MCP servers start and adaptive tools are visible.');
