# Project Rules

## Project Goal
- Maintain the Auto Agent Team skill and its companion runtime plugin.

## Workspace Rules
- Read this file and PROJECT_LOG.md before project work.
- Keep confirmed decisions separate from candidates and assumptions.
- Report only checks and native agent activity that actually occurred.
- Update PROJECT_LOG.md with reusable findings and remaining work at phase completion.

## Validation and Behavioral Contracts
- Run `node plugins/auto-agent-team/scripts/verify-all.mjs` for routing or Runtime changes.
- Classify task intent before keyword complexity: complete-project requests enter engineering orchestration; explanation-only requests stay lightweight.
- Running or completed tasks require all dependencies to be done. Validate every state-writing entry point and leave persisted state unchanged on rejection.
- Reopening a completed prerequisite requires explicit reset of running/completed downstream tasks first.
- Do not complete a task while any linked native agent is still active.
