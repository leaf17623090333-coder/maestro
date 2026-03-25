# Hooks Improvement

## Objective

Implement a complete hooks system for Maestro: SessionStart and SubagentStart context injection (superpowers pattern), migrate and consolidate existing hook scripts from `scripts/` to `.claude/scripts/`, update JSON output formats to match Claude Code API, and clean up dead legacy scripts.

## Scope

**In scope:**
- New SessionStart hook that injects Maestro awareness (commands, active plans, wisdom, skills) as `additionalContext`
- New SubagentStart hook that injects plan context, wisdom, and conventions into spawned workers
- Migrate 5 working hook scripts from `scripts/` to `.claude/scripts/`, replacing the stubs
- Update JSON output formats to use `hookSpecificOutput` with `permissionDecision` (Claude Code's current API) instead of deprecated top-level `decision`/`reason`
- Update `.claude/hooks/hooks.json` to add SessionStart and SubagentStart entries
- New test script for all hooks
- Remove dead legacy scripts (`scripts/test-hooks.sh`, `scripts/install-global-hooks.sh`, `scripts/beads-metrics-summary.sh`)
- Delete original `scripts/` copies after migration to `.claude/scripts/`

**Out of scope:**
- Changes to agent definitions (`.claude/agents/`)
- Changes to skill definitions (`.claude/skills/`)
- Changes to command definitions (`.claude/commands/`)
- New skills or new agents
- Global hooks installation (user-level `~/.claude/settings.json`)
- Prompt-based or agent-based hooks (all hooks are `type: "command"`)

## Tasks

- [ ] Task 1: Create SessionStart hook script
  - **Agent**: kraken
  - **Acceptance criteria**: `.claude/scripts/session-start.sh` reads skill manifests from `"$CLAUDE_PROJECT_DIR"/.claude/skills/*/SKILL.md`, reads active plans from `"$CLAUDE_PROJECT_DIR"/.maestro/plans/*.md` (excluding `.gitkeep`), reads wisdom titles from `"$CLAUDE_PROJECT_DIR"/.maestro/wisdom/*.md` (excluding `.gitkeep`), and outputs JSON with `hookSpecificOutput.hookEventName` set to `"SessionStart"` and `hookSpecificOutput.additionalContext` containing a structured summary. Context includes: available Maestro commands (/design, /work, /status, /review, /reset), plan names and first-line titles, wisdom file names and titles, skill names and descriptions (from YAML frontmatter). Handles missing directories gracefully (exits 0 with no output if nothing found). Total injected context stays under ~500 tokens.
  - **Dependencies**: none
  - **Files**: `.claude/scripts/session-start.sh` (new)

- [ ] Task 2: Create SubagentStart hook script
  - **Agent**: kraken
  - **Acceptance criteria**: `.claude/scripts/subagent-context.sh` reads hook input from stdin, extracts `agent_type` via jq. For Maestro worker agents (kraken, spark, explore, oracle, leviathan, wisdom-synthesizer, progress-reporter), injects via `hookSpecificOutput.additionalContext`: active plan summary (title + task list from first active plan), and wisdom file titles. For non-Maestro agents or unrecognized agent types, exits 0 with no output. Uses `"$CLAUDE_PROJECT_DIR"` for paths.
  - **Dependencies**: none
  - **Files**: `.claude/scripts/subagent-context.sh` (new)

- [ ] Task 3: Migrate and update orchestrator-guard.sh
  - **Agent**: spark
  - **Acceptance criteria**: Copy working logic from `scripts/orchestrator-guard.sh` (89 lines) into `.claude/scripts/orchestrator-guard.sh`, replacing the stub. Update JSON output format from deprecated `{"decision":"block","reason":"..."}` to `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"..."}}`. Update approve from `{"decision":"approve"}` to plain `exit 0` (no output needed for allow). Keep all existing agent-detection logic (stdin fields, transcript fallback). Script remains executable.
  - **Dependencies**: none
  - **Files**: `.claude/scripts/orchestrator-guard.sh` (modify)

- [ ] Task 4: Migrate and update plan-protection.sh
  - **Agent**: spark
  - **Acceptance criteria**: Copy working logic from `scripts/plan-protection.sh` (103 lines) into `.claude/scripts/plan-protection.sh`, replacing the stub. Existing behavior: blocks kraken/spark from editing `.maestro/plans/` files (allows prometheus/orchestrator). Update JSON output format from deprecated `{"decision":"block","reason":"..."}` to `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"..."}}`. Update approve to plain `exit 0`. Keep all existing agent-detection logic.
  - **Dependencies**: none
  - **Files**: `.claude/scripts/plan-protection.sh` (modify)

- [ ] Task 5: Migrate verification-injector.sh
  - **Agent**: spark
  - **Acceptance criteria**: Copy working logic from `scripts/verification-injector.sh` (13 lines) into `.claude/scripts/verification-injector.sh`, replacing the stub. Existing code already uses correct `hookSpecificOutput` format — no format changes needed. Verify the output JSON is valid.
  - **Dependencies**: none
  - **Files**: `.claude/scripts/verification-injector.sh` (modify)

- [ ] Task 6: Migrate plan-validator.sh
  - **Agent**: spark
  - **Acceptance criteria**: Copy working logic from `scripts/plan-validator.sh` (43 lines) into `.claude/scripts/plan-validator.sh`, replacing the stub. Existing code already uses correct `hookSpecificOutput` format — no format changes needed. Verify the output JSON is valid.
  - **Dependencies**: none
  - **Files**: `.claude/scripts/plan-validator.sh` (modify)

- [ ] Task 7: Migrate and update wisdom-injector.sh
  - **Agent**: spark
  - **Acceptance criteria**: Copy working logic from `scripts/wisdom-injector.sh` (44 lines) into `.claude/scripts/wisdom-injector.sh`, replacing the stub. Current behavior: only fires when reading `.maestro/plans/` files, lists all wisdom file titles. Keep this scoped behavior (plan-file reads only). Update `wisdom_dir` path to use `"$CLAUDE_PROJECT_DIR"/.maestro/wisdom`. Verify JSON output is valid.
  - **Dependencies**: none
  - **Files**: `.claude/scripts/wisdom-injector.sh` (modify)

- [ ] Task 8: Update hooks.json with SessionStart, SubagentStart, and portable paths
  - **Agent**: spark
  - **Acceptance criteria**: `.claude/hooks/hooks.json` adds: (1) `SessionStart` entry with matcher `"startup|resume|clear|compact"` pointing to `"$CLAUDE_PROJECT_DIR"/.claude/scripts/session-start.sh`, (2) `SubagentStart` entry with no matcher, pointing to `"$CLAUDE_PROJECT_DIR"/.claude/scripts/subagent-context.sh`. Also update all existing hook command paths from `./.claude/scripts/...` to `"$CLAUDE_PROJECT_DIR"/.claude/scripts/...` for portability. Result validates with `jq .`.
  - **Dependencies**: Tasks 1-7
  - **Files**: `.claude/hooks/hooks.json` (modify)

- [ ] Task 9: Remove dead legacy scripts
  - **Agent**: spark
  - **Acceptance criteria**: Delete these files: `scripts/test-hooks.sh` (references deleted `hooks/continuity/` directory), `scripts/install-global-hooks.sh` (references deleted `hooks/continuity/` directory), `scripts/beads-metrics-summary.sh` (references non-existent `.conductor/metrics.jsonl`). Also delete the migrated originals: `scripts/orchestrator-guard.sh`, `scripts/plan-protection.sh`, `scripts/plan-validator.sh`, `scripts/verification-injector.sh`, `scripts/wisdom-injector.sh` (now consolidated in `.claude/scripts/`).
  - **Dependencies**: Tasks 3-7 (migration must complete before deleting originals)
  - **Files**: 8 files deleted from `scripts/`

- [ ] Task 10: Create new test script for hooks
  - **Agent**: kraken
  - **Acceptance criteria**: `scripts/test-hooks.sh` (new) contains smoke tests for all implemented hooks. Tests use temp directories for isolation and simulate stdin JSON input. Tests: (1) session-start.sh outputs valid JSON with `hookSpecificOutput.additionalContext` when skills/plans/wisdom exist, (2) session-start.sh exits 0 with no output when `.maestro/` is empty, (3) subagent-context.sh outputs context when `agent_type` is "kraken", (4) subagent-context.sh exits 0 silently for unknown agent types, (5) orchestrator-guard.sh denies Write for orchestrator agent (valid `hookSpecificOutput` format), (6) orchestrator-guard.sh allows Write for non-orchestrator (exit 0, no output), (7) plan-protection.sh denies kraken editing `.maestro/plans/`, (8) plan-protection.sh allows edits to files outside `.maestro/plans/`, (9) plan-validator.sh warns on plan missing `## Objective`, (10) plan-validator.sh exits silently for non-plan writes, (11) wisdom-injector.sh lists wisdom when reading a plan file, (12) verification-injector.sh outputs reminder JSON. All tests validate JSON output with `jq`.
  - **Dependencies**: Tasks 1-7 (needs hooks to exist, but can test individually as they're ready)
  - **Files**: `scripts/test-hooks.sh` (new)

- [ ] Task 11: Verify all hooks end-to-end
  - **Agent**: kraken
  - **Acceptance criteria**: Run `bash scripts/test-hooks.sh` and confirm all 12 tests pass. Run `cat .claude/hooks/hooks.json | jq .` to validate JSON. Verify all `.claude/scripts/*.sh` are executable. Verify no files remain in `scripts/` that reference deleted infrastructure. Confirm `scripts/` only contains: `test-hooks.sh`, `validate-anchors.sh`, `validate-links.sh`, `amp-session.sh`.
  - **Dependencies**: Tasks 8-10
  - **Files**: none (verification only)

## Verification

- [ ] `bash scripts/test-hooks.sh` — all 12 smoke tests pass
- [ ] `cat .claude/hooks/hooks.json | jq .` — valid JSON, no syntax errors
- [ ] `ls -la .claude/scripts/*.sh` — 7 scripts exist and are executable (session-start, subagent-context, orchestrator-guard, plan-protection, verification-injector, plan-validator, wisdom-injector)
- [ ] `ls scripts/install-global-hooks.sh 2>/dev/null; echo $?` — returns 1 (deleted)
- [ ] `ls scripts/beads-metrics-summary.sh 2>/dev/null; echo $?` — returns 1 (deleted)
- [ ] `ls scripts/orchestrator-guard.sh 2>/dev/null; echo $?` — returns 1 (migrated, original deleted)
- [ ] `grep -c '"decision"' .claude/scripts/*.sh` — returns 0 for all files (no deprecated format)
- [ ] Start a new Claude Code session in the repo — SessionStart hook fires and injects Maestro context (verify with `--debug` or `Ctrl+O`)

## Notes

### Technical Decisions

1. **All hooks are bash scripts** (`type: "command"`). No prompt-based or agent-based hooks — keeps execution fast and deterministic.

2. **SessionStart hook is NOT async** — it must inject context before the agent starts working.

3. **SubagentStart hook fires for ALL agents** (no matcher). The script itself filters by `agent_type` to decide what context to inject. This is more maintainable than separate matcher entries per agent.

4. **Portable paths** — all hook commands in `hooks.json` use `"$CLAUDE_PROJECT_DIR"/.claude/scripts/...` so they work regardless of working directory.

5. **Graceful degradation** — every hook handles missing files/directories by exiting 0 silently. No hook should ever cause a session to fail.

6. **Context budget** — SessionStart injects a structured but concise summary (not full file contents). Plan titles + status, wisdom titles, skill names + descriptions. Stays under ~500 tokens.

7. **JSON output format migration** — Existing scripts in `scripts/` use deprecated top-level `{"decision":"block","reason":"..."}` format. The Claude Code API now uses `hookSpecificOutput` with `permissionDecision` for PreToolUse events. All migrated scripts must use the current format. PostToolUse scripts (plan-validator, verification-injector, wisdom-injector) already use the correct `hookSpecificOutput` format.

8. **Consolidation to `.claude/scripts/`** — The canonical location for hook scripts is `.claude/scripts/`. The `scripts/` directory retains only non-hook utilities (validate-anchors.sh, validate-links.sh, amp-session.sh) and the new test script.

### JSON Output Patterns

**PreToolUse deny** (orchestrator-guard, plan-protection):
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Reason for blocking"
  }
}
```

**PreToolUse allow**: plain `exit 0` with no stdout output.

**PostToolUse context injection** (plan-validator, verification-injector, wisdom-injector):
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Context string"
  }
}
```

**SessionStart context injection**:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Context string"
  }
}
```

**SubagentStart context injection**:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "SubagentStart",
    "additionalContext": "Context string"
  }
}
```

### Existing Script Analysis

| Script | Location | Lines | Format | Migration Action |
|--------|----------|-------|--------|-----------------|
| orchestrator-guard.sh | `scripts/` | 89 | Deprecated `decision`/`approve` | Migrate + update format |
| plan-protection.sh | `scripts/` | 103 | Deprecated `decision`/`approve` | Migrate + update format |
| plan-validator.sh | `scripts/` | 43 | Correct `hookSpecificOutput` | Migrate as-is |
| verification-injector.sh | `scripts/` | 13 | Correct `hookSpecificOutput` | Migrate as-is |
| wisdom-injector.sh | `scripts/` | 44 | Correct `hookSpecificOutput` | Migrate + update paths |

### Risk Mitigation

- **Hook failures don't break sessions** — all hooks exit 0 on error paths
- **No destructive operations** — hooks only read and inject context, never modify files
- **Backward compatible** — existing stub behavior (exit 0) is the fallback for all error paths
- **Test isolation** — smoke tests use temp directories, never touch real `.maestro/` state

## Prior Wisdom

- **Skill Interoperability**: Skills follow YAML frontmatter + markdown body pattern. Discovery locations: `.claude/skills/` (project) and `~/.claude/skills/` (global). Graceful degradation when no skills found.
- **Prometheus Skills**: Parallel workers effective for independent file edits. Conditional/smart activation over mandatory flags.
- **Plan Cleanup**: Plans live in `.maestro/plans/`, executed plans can be archived to `.maestro/archive/`.
- **Work Plan Autoload**: The `/work` command auto-discovers plans from `.maestro/plans/`.
