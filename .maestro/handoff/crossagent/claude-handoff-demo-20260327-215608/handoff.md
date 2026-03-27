# Cross-Agent Handoff: claude-handoff-demo-20260327-215608

| Field | Value |
|-------|-------|
| From | codex |
| To | claude |
| Created | 2026-03-27T14:56:21.531Z |
| maestro | 0.2.0 |

## Plan
## Discovery
This demo feature exists only to exercise Maestro's cross-agent handoff workflow with Claude in a clean, deterministic way. The repository already has older handoff artifacts and an active handed-off feature, so this plan uses a fresh temporary feature to avoid inheriting prior pickup state. The goal is not to change product code, but to prove that a minimal valid plan can be written, approved, converted into tasks, and exported as a Claude-targeted handoff.

### 1. Create demo task state
Create the minimum valid task structure for the demo so Maestro can generate real tasks from the plan instead of a placeholder document.

### 2. Export the Claude handoff
Advance the feature through approval and task sync, then export the resulting handoff specifically to `claude` so another agent can pick it up.


## Tasks

| # | ID | Name | Status | Depends On |
|---|-----|------|--------|------------|
| 1 | maestro-jld-export-the-claude-handoff | maestro-jld-export-the-claude-handoff | pending | - |
| 2 | maestro-3ow-create-demo-task-state | maestro-3ow-create-demo-task-state | pending | - |

## Doctrine

- **prefer-markdown-storage**: Use markdown files with sidecar indexes instead of databases for agent state that needs to be human-readable and git-tracked.
- **embed-at-build-time**: When code uses Bun-only APIs (import.meta.dir, import.meta.file) that will run under Node.js in the MCP bundle, embed the data at build time via a generator script instead of runtime filesystem scanning.

## Modified Files

- `.beads/issues.jsonl`
- `.claude/pending-merges.md`
- `.maestro/handoff/crossagent/handoff-pipeline-test/state.json`
- `src/__tests__/e2e/crossagent-handoff.test.ts`
- `src/__tests__/unit/host-detect.test.ts`
- `src/app/handoff/crossagent.ts`
- `src/infra/utils/host-detect.ts`
- `src/surfaces/cli/handlers/handoff/pickup.ts`
- `src/version.ts`

## Quickstart

This project uses `maestro` for agent coordination. Always pass `--json` to all commands.

### 1. Find the next runnable task
```
maestro task-next --feature claude-handoff-demo-20260327-215608 --json
```
This returns the next task whose dependencies are satisfied.

### 2. Claim and implement
```
maestro task-claim --feature claude-handoff-demo-20260327-215608 --task maestro-jld-export-the-claude-handoff --agent-id <your-id> --json
```

### 3. Mark done
```
maestro task-done --feature claude-handoff-demo-20260327-215608 --task maestro-jld-export-the-claude-handoff --content "summary of work" --json
```

### 4. Repeat until all tasks done
```
maestro task-next --feature claude-handoff-demo-20260327-215608 --json
```
When task-next returns no runnable tasks, all work is done.

### 5. Report completion
```
maestro handoff-report --feature claude-handoff-demo-20260327-215608 --content "Summary of all work done" --json
```

### Tips
- Run `maestro status --feature claude-handoff-demo-20260327-215608 --json` anytime to orient
- If a task is blocked: `maestro task-block --feature claude-handoff-demo-20260327-215608 --task <id> --reason "..." --json`
- Always use task-next to find runnable tasks -- it respects dependency order