# Workflow Mode

## Purpose

Auto Agent Team v0.3.3 introduces workflow selection as an orchestration layer.

Workflow Mode decides the required process depth. It does **not** replace Native Agent Team execution, native lifecycle tracking, or Runtime truth.

Supported modes:

```text
QUICK
STANDARD
RELEASE
```

Default:

```text
STANDARD
```

---

## QUICK

Use for small scoped work.

Examples:

- small bug fixes
- configuration changes
- single module edits
- small experiments

Flow:

```text
Manager
  ↓
Developer / Execution Agent
  ↓
Basic Verification
  ↓
Complete
```

Avoid unnecessary research, architecture review, or release checks.

---

## STANDARD

Default engineering workflow.

Use for:

- normal feature development
- multi-file changes
- course projects
- formal deliverables

Flow:

```text
Manager
 ↓
Researcher
 ↓
Architect
 ↓
Developer
 ↓
Tester
 ↓
Independent Reviewer
 ↓
Delivery
```

This preserves v0.3.2 Native Agent Team behavior.

---

## RELEASE

Use for public delivery or version release.

Examples:

- GitHub releases
- open source delivery
- production packaging
- security-sensitive changes

Flow:

```text
Manager
 ↓
Architect
 ↓
Developer
 ↓
Tester
 ↓
Debugger
 ↓
Security Review
 ↓
Release Review
 ↓
Release Preparation
```

---

## Compatibility Rules

Workflow Mode must never:

- fake native agents
- replace executionMode
- bypass Runtime lifecycle events
- mark unverified work as complete
- convert ordinary tasks into releases automatically

Native Agent Team remains the execution foundation.
