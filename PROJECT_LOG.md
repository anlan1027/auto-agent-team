# Project Log

## Initial State
- Existing Auto Agent Team skill repository with runtime plugin, dashboard, and smoke-test scripts.
- User requested advice on next project optimizations.
- AGENTS.md and PROJECT_LOG.md were absent and initialized for this assessment.

## Pending Decisions
- Candidate priority: intent-aware routing and Runtime state-transition invariants; then installation reliability, memory persistence/isolation, and adaptive/runtime integration.
- Storage format and module refactor design remain undecided.

## Assessment Verification
- Ran `node plugins/auto-agent-team/scripts/verify-all.mjs`: Adaptive Core, Adaptive MCP, and Existing Runtime smoke tests all passed.
- Direct planning probe: `帮我创建一个完整的本地待办事项桌面软件` scored 0 and selected single-agent; `解释架构设计、代码实现、测试验证和数据库这几个术语` scored 65 and selected engineering-team.
- Direct failure-memory probe: a stored `修复登录超时` matched the identical query once but `解决登录超时问题` matched zero times.
- Source inspection: task/failure memory is process-local; adaptive tool inputs do not scope memory by workspace. Runtime overwrites team.json directly. Installer validates only the existing Runtime smoke suite, then removes the previous installation before copying the new one. CI currently runs Ubuntu/Node 24 only.
- Source inspection: Runtime task updates accept running/done without explicit unfinished-dependency rejection; reconcileDependencies skips done/failed tasks. This is a candidate regression to reproduce through MCP before changing implementation.
- No Codex plugin loading, dashboard browser behavior, concurrent persistence, or installer execution was verified.

## Problem / Root Cause / Failed Attempts / Solution / Lesson
- Problem: keyword-based complexity does not reliably distinguish explanation requests from complete software requests.
- Root Cause: scoring adds weights for matching terms without a separate intent/scope decision, as demonstrated by the two direct probes above.
- Failed Attempts: no corrective implementation attempted; current smoke tests pass despite these counterexamples.
- Solution: proposed intent/scope classification plus a bilingual regression corpus; not implemented.
- Lesson: validate routing with paraphrases and negative examples, not only examples that contain the expected keywords.

## Assessment Follow-up (Historical)
- Turn routing counterexamples into regression cases and implement intent-aware classification in a subsequent implementation phase.
- Reproduce dependency-transition gaps through MCP and add invariant enforcement.
- Evaluate atomic state persistence, safe installer replacement/rollback, project-scoped adaptive memory, and an explicit adaptive-plan-to-Runtime bridge.
- This phase delivered assessment only; application source was not changed.

## Implementation Phase — 2026-09-13
- User authorized implementation of intent-aware routing and Runtime dependency constraints only.
- Runtime/Dashboard initialized before implementation; real native agents `/root/routing` (Developer) and `/root/review` (independent Reviewer) used. Manager owns integration and project records.
- Added intent-first classification with explicit explanation, bounded implementation, and project scope. Project scope has a minimum complexity score of 60; explanations score 0 and do not escalate from failure history.
- Centralized execution-state validation before reconciliation and persistence. Creation, insertion, manual task updates and native lifecycle writes cannot persist running/done tasks with unfinished dependencies.
- Completed prerequisites cannot be reopened while downstream tasks are running/done or have active linked agents; downstream reset is explicit. Reopening clears stale completion metadata.
- Shared native task completion waits for all linked agents; peer failure survives a later successful finish, while explicit retries can succeed.
- Added bilingual intent corpus and a new MCP state-constraint regression suite wired into verify-all.
- Final verification: all four verify-all suites passed; Runtime syntax check and git diff --check passed. Independent re-review passed with no remaining blockers in this scope.

### Failure Review
- Problem: new MCP regression expected rejection when B depended on unfinished A, but the old Runtime accepted B running.
- Root Cause: update accepted status directly; reconciliation only moved ready/pending/blocked states and skipped completed tasks. No persistence invariant checked dependencies.
- Failed Attempts: existing smoke tests passed because they exercised the intended execution order, not attempted bypasses. Initial new regression failed as expected before implementation.
- Solution: shared state invariant and transition checks plus rejected-write byte-for-byte checks; new MCP regression passes after implementation.
- Lesson: test invalid transitions across all write entry points, including implicit native lifecycle updates, not only happy-path scheduling.
- Routing development also exposed loss of comma-separated scope details in an initial classifier. Preserving execution-context continuation restored the existing enterprise case to score 80; the original test remains passing.
- Independent review reproduced full-product requests being discarded by a product constraint such as `without a database`, explanation synonyms being treated as implementation, and lost scope in `explain the complete app, then implement it`. Root causes were whole-clause negation filtering, incomplete discussion signals, and lack of explicit antecedent handling. These were fixed with action-relative negation, common bilingual explanation signals, and narrowly scoped carryover for explicit implementation requests; counterexamples were added as regressions.
- Independent review confirmed stale native terminal notification replay could re-complete a reopened task. Same-terminal repeats now return without writing, conflicting terminal outcomes are rejected, and failed tasks cannot reset while linked peers are active. Runtime regressions cover these cases and pass.
- Re-review found combined clause classification let a later test-function request shrink an earlier complete-project request. Project scope is now evaluated per executable clause (with cross-clause multi-module detection preserved). Both Chinese and English counterexamples were added; full tests and independent targeted re-review pass.

### Final State and Next Steps
- Both requested source changes are implemented, tested, and independently reviewed. Execution mode was NATIVE_SUBAGENTS, using real Developer and Reviewer contexts with follow-up repair/re-review turns.
- Runtime tasks are resolved and tracked native agents are finished.
- No known blockers remain within this implementation scope. The intent classifier remains heuristic; retain new ambiguous expressions as future regression cases.
- Codex plugin reinstall/reload and browser Dashboard verification are outside this source-change phase and have not been performed.
- Future optional work remains memory persistence/project isolation and safer installation/state persistence; no decisions or implementation were made for these items.
