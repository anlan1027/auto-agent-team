# Workflow Mode

## Purpose

Auto Agent Team should select the smallest effective workflow for the user's goal.

Workflow decides which roles are required. It does not replace native Agent Team execution.

## Modes

### QUICK (default)

For:

- homework
- small experiments
- small code changes
- temporary documents

Flow:

```text
Manager
  ↓
Execution Agent(s)
  ↓
Basic verification
  ↓
Complete
```

Do not start audit or release roles unless requested.

### STANDARD

For:

- course projects
- reports
- formal PPT
- multi-file engineering tasks

Flow:

```text
Round 1: Production
  Builder / Writer / Tester

Round 2: Audit
  Source Auditor
  Evidence Reviewer
```

### RELEASE

For:

- GitHub projects
- open source delivery
- version releases

Flow:

```text
Production
  ↓
Audit
  ↓
Release
```

## Selection hints

Use QUICK when the user only wants an answer or artifact.

Use STANDARD when correctness, evidence, or formal delivery matters.

Use RELEASE only when versioning, packaging, or public delivery is explicitly involved.

Never create GitHub releases by default for normal tasks.
