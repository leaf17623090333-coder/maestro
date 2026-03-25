# OMC Phase 6 — Trace, Doctor, PSM, Release

**Goal**: Adopt four remaining high-value features from oh-my-claudecode (Trace, Doctor, PSM, Release) into Maestro, adding observability, self-healing diagnostics, session isolation, and release automation.

**Architecture**: Trace ships as a TypeScript MCP toolbox (like agent-mail) providing `trace_timeline` and `trace_summary` tools, fed by a new PostToolUse hook that logs events to `.maestro/trace.jsonl`. Doctor is a new skill that unifies and extends `/setup-check` with deeper diagnostics and auto-fix. PSM is a new skill providing git worktree + tmux session management for PR reviews and issue fixes. Release is a new skill orchestrating version bump, tag, publish, and GitHub release with confirmation gates.

**Tech Stack**: TypeScript (MCP toolbox via bun), Bash hooks/scripts, Markdown skills, jq, git worktrees, tmux, gh CLI

## Objective

Implement four new Maestro capabilities — execution tracing (MCP-based), plugin diagnostics (doctor), project session management (PSM with tmux), and release automation — completing the adoption of high-value OMC features.

## Scope

**In**:
- Trace MCP toolbox with `trace_timeline` and `trace_summary` tools
- Trace event logging hook (PostToolUse) writing to `.maestro/trace.jsonl`
- `/trace` skill to invoke MCP tools and display results
- `/doctor` skill with health checks, severity ratings, and auto-fix
- `/psm` skill with review/fix/feature/list/attach/kill/cleanup/status subcommands
- `/release` skill with version bump, tag, publish, gh release, confirmation gates
- Documentation updates (CLAUDE.md, maestro SKILL.md, setup-check, status)
- Hook smoke tests for new trace hook

**Out**:
- Autopilot (zero-interview autonomous mode — deferred)
- Deep Init (hierarchical AGENTS.md — deferred)
- HUD/TUI statusline
- Cross-AI bridge (Gemini/OpenAI)
- Rewriting existing `/setup-check` — doctor complements it, doesn't replace it

## Tasks

### Wave 1: Trace (MCP Toolbox + Hook + Skill)

- [ ] Task 1: Create trace event logging hook
  - **Agent**: kraken
  - **Acceptance criteria**: A `PostToolUse` hook matching all tools that runs `.claude/scripts/trace-logger.sh`. The script reads stdin JSON (tool_name, tool_input, tool_result, agent_type), constructs a JSON event with fields: `timestamp` (ISO 8601), `event_type` (tool_use), `tool_name`, `agent_name` (from `CLAUDE_AGENT_NAME` env), `duration_ms` (if available in tool_result), `success` (true/false based on exit code or error fields), `summary` (first 200 chars of tool_input description or command). Appends the event as a single JSON line to `$CLAUDE_PROJECT_DIR/.maestro/trace.jsonl`. Creates the file if it doesn't exist. Silently exits if `$CLAUDE_PROJECT_DIR` is not set. Does NOT block or inject context — pure logging.
  - **Dependencies**: none
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/scripts/trace-logger.sh`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json`
  - **Steps**:
    1. Create `.claude/scripts/trace-logger.sh`:
       ```bash
       #!/bin/bash
       # PostToolUse(*) - logs tool events to .maestro/trace.jsonl
       set -euo pipefail
       input=$(cat)
       PROJECT_DIR="${CLAUDE_PROJECT_DIR:-}"
       [ -z "$PROJECT_DIR" ] && exit 0
       trace_file="$PROJECT_DIR/.maestro/trace.jsonl"
       mkdir -p "$(dirname "$trace_file")"
       tool_name=$(printf '%s' "$input" | jq -r '.tool_name // empty' 2>/dev/null) || tool_name=""
       [ -z "$tool_name" ] && exit 0
       agent_name="${CLAUDE_AGENT_NAME:-unknown}"
       timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
       exit_code=$(printf '%s' "$input" | jq -r '.tool_result.exit_code // "0"' 2>/dev/null) || exit_code="0"
       success="true"
       [ "$exit_code" != "0" ] && success="false"
       summary=$(printf '%s' "$input" | jq -r '(.tool_input.description // .tool_input.command // .tool_input.pattern // .tool_input.file_path // "") | .[0:200]' 2>/dev/null) || summary=""
       printf '{"timestamp":"%s","event_type":"tool_use","tool_name":"%s","agent_name":"%s","success":%s,"summary":"%s"}\n' \
         "$timestamp" "$tool_name" "$agent_name" "$success" "$(printf '%s' "$summary" | sed 's/"/\\"/g' | tr '\n' ' ')" >> "$trace_file"
       ```
    2. Add PostToolUse hook entry to hooks.json with no matcher (matches all tools)
    3. Verify: `bash -n .claude/scripts/trace-logger.sh` — exit 0
    4. Verify: `jq . .claude/hooks/hooks.json` — valid JSON
    5. Commit

- [ ] Task 2: Create trace MCP toolbox
  - **Agent**: kraken
  - **Acceptance criteria**: A new MCP toolbox at `toolboxes/trace/` following the dual-file pattern of `toolboxes/agent-mail/` (`.ts` source + compiled `.js`). Provides two MCP tools: (1) `trace_timeline` — reads `.maestro/trace.jsonl`, accepts optional `filter` (by tool_name, agent_name, event_type) and `last` (limit to N most recent events) parameters, returns formatted chronological timeline. (2) `trace_summary` — reads `.maestro/trace.jsonl`, returns aggregate statistics: total events, events by tool_name, events by agent_name, success/failure counts, most frequent tools. Uses MCP protocol over stdio. Built via `bun build`. Final artifacts: `toolboxes/trace/trace.ts` (source) and `toolboxes/trace/trace.js` (compiled, committed to repo). Entry point for runtime: `toolboxes/trace/trace.js`.
  - **Dependencies**: none
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/toolboxes/trace/trace.ts`
    - Create: `/Users/reinamaccredy/Code/maestro/toolboxes/trace/trace.js` (compiled output, committed)
  - **Steps**:
    1. Create `toolboxes/trace/trace.ts` implementing the two MCP tools (trace_timeline, trace_summary)
    2. Compile: `cd toolboxes/trace && bun build trace.ts --outfile trace.js --target node` — expect exit 0
    3. Verify: `node toolboxes/trace/trace.js --help` — expect exit 0 with tool listing or usage output
    4. Commit both `.ts` and `.js` files

- [ ] Task 3: Create /trace skill
  - **Agent**: spark
  - **Acceptance criteria**: New skill at `.claude/skills/trace/SKILL.md` with frontmatter: `name: trace`, `description: Show agent execution timeline and performance summary`, `argument-hint: "[--filter <tool|agent>] [--last N] [--summary]"`. The skill instructs the agent to: (1) call `trace_timeline` MCP tool with optional filter/last params, (2) call `trace_summary` MCP tool, (3) display the timeline first, then summary, (4) highlight bottlenecks (tools with >5s average), mode transitions, and failure clusters. MCP server is configured in `mcp_template.json` (repo root) and runs via `node toolboxes/trace/trace.js`.
  - **Dependencies**: Task 2
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/skills/trace/SKILL.md`
  - **Steps**:
    1. Create the trace skill SKILL.md with full workflow
    2. Verify markdown structure
    3. Commit

- [ ] Task 4: Add trace MCP to mcp_template.json
  - **Agent**: spark
  - **Acceptance criteria**: The `mcp_template.json` (at repo root) includes the trace MCP server configuration alongside existing entries. Entry: `"trace": {"command": "bun", "args": ["run", "toolboxes/trace/src/index.ts"], "cwd": "{project_dir}"}`.
  - **Dependencies**: Task 2
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/mcp_template.json`
  - **Steps**:
    1. Read current mcp_template.json (at repo root, NOT in toolboxes/)
    2. Add trace server entry
    3. Verify: `jq . mcp_template.json` — valid JSON
    4. Commit

- [ ] Task 5: Add trace hook smoke test
  - **Agent**: spark
  - **Acceptance criteria**: `scripts/test-hooks.sh` includes a test case that: (1) creates a temp directory with `.maestro/`, (2) pipes mock PostToolUse JSON to `trace-logger.sh` with `CLAUDE_PROJECT_DIR` set, (3) verifies `.maestro/trace.jsonl` was created and contains valid JSON line with expected fields.
  - **Dependencies**: Task 1
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/scripts/test-hooks.sh`
  - **Steps**:
    1. Add test case for trace-logger.sh
    2. Run: `bash scripts/test-hooks.sh` — all tests PASS
    3. Commit

### Wave 2: Doctor (Diagnostics + Auto-Fix)

- [ ] Task 6: Create /doctor skill
  - **Agent**: kraken
  - **Acceptance criteria**: New skill at `.claude/skills/doctor/SKILL.md` with frontmatter: `name: doctor`, `description: Diagnose and fix Maestro installation issues`, `argument-hint: "[--fix] [--check <name>]"`. The skill performs these health checks: (1) **Agent Teams**: env var `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set to "1" in `~/.claude/settings.json`. (2) **Hooks integrity**: `.claude/hooks/hooks.json` parses as valid JSON, all referenced scripts exist and pass `bash -n`. (3) **State directories**: `.maestro/plans/`, `.maestro/archive/`, `.maestro/wisdom/`, `.maestro/drafts/`, `.maestro/handoff/`, `.maestro/research/` exist. (4) **Stale state**: handoff files older than 24 hours, draft files older than 48 hours. (5) **Plugin manifest**: `.claude-plugin/plugin.json` parses as valid JSON. (6) **CLAUDE.md freshness**: project CLAUDE.md contains expected Maestro markers (`## Commands`, `## Architecture`). (7) **Script permissions**: all `.claude/scripts/*.sh` are executable. (8) **Orphaned teams**: `~/.claude/teams/` directories without active Claude processes. Each check outputs OK/WARN/CRITICAL with details. With `--fix` flag, the skill auto-fixes: creates missing directories, removes stale handoff/drafts, fixes script permissions. Report format matches OMC's doctor output.
  - **Dependencies**: none
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/skills/doctor/SKILL.md`
  - **Steps**:
    1. Create the doctor skill SKILL.md with all 8 checks and auto-fix logic
    2. Verify markdown structure
    3. Commit

### Wave 3: PSM (Project Session Manager)

- [ ] Task 7: Create /psm skill
  - **Agent**: kraken
  - **Acceptance criteria**: New skill at `.claude/skills/psm/SKILL.md` with frontmatter: `name: psm`, `description: Project Session Manager — isolated dev environments with git worktrees and tmux`, `argument-hint: "review <ref> | fix <ref> | feature <name> | list | attach <session> | kill <session> | cleanup | status"`, `aliases: [session, worktree-session]`. The skill implements: (1) **review \<ref\>** — parse GitHub reference (owner/repo#num, #num, URL), fetch PR info via `gh pr view`, create worktree from PR branch, create tmux session, report details. (2) **fix \<ref\>** — parse issue reference, fetch issue info via `gh issue view`, create fix branch + worktree, create tmux session. (3) **feature \<name\>** — create feature branch + worktree from main, create tmux session. (4) **list** — list active sessions from `~/.maestro-psm/sessions.json` + tmux, show table. (5) **attach \<session\>** — tell user `tmux attach -t maestro:<session>`. (6) **kill \<session\>** — kill tmux session, remove worktree, update sessions.json. (7) **cleanup** — check merged PRs / closed issues, clean up completed sessions. (8) **status** — show current session info. State stored in `~/.maestro-psm/sessions.json`. Worktrees created in `~/.maestro-psm/worktrees/`. Uses `gh` CLI for all GitHub operations.
  - **Dependencies**: none
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/skills/psm/SKILL.md`
  - **Steps**:
    1. Create the PSM skill SKILL.md with all 8 subcommands
    2. Verify markdown structure
    3. Commit

### Wave 4: Release (Automation Pipeline)

- [ ] Task 8: Create /release skill
  - **Agent**: kraken
  - **Acceptance criteria**: New skill at `.claude/skills/release/SKILL.md` with frontmatter: `name: release`, `description: Automated release workflow with version bump, tag, publish, and GitHub release`, `argument-hint: "<version|patch|minor|major> [--dry-run]"`. The skill implements: (1) **Preflight**: detect project type (package.json → npm/bun, setup.py/pyproject.toml → Python, Cargo.toml → Rust, plugin.json → Claude plugin). Find all files containing current version. Run tests. (2) **Version bump**: update version in all detected files. Show diff for confirmation. (3) **Commit**: `git add` changed files, commit with `chore(release): vX.Y.Z`. (4) **Tag**: `git tag vX.Y.Z`. (5) **Push**: `git push origin <branch> && git push origin vX.Y.Z` — requires explicit user confirmation. (6) **Publish**: based on project type — `npm publish` / `bun publish` / `uv publish` / `cargo publish`. Requires explicit user confirmation. (7) **GitHub Release**: `gh release create vX.Y.Z --title "vX.Y.Z" --generate-notes`. Requires explicit user confirmation. With `--dry-run`, performs preflight and shows what would happen without making changes. Each destructive step (push, publish, release) requires explicit AskUserQuestion confirmation.
  - **Dependencies**: none
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/skills/release/SKILL.md`
  - **Steps**:
    1. Create the release skill SKILL.md with full pipeline
    2. Verify markdown structure
    3. Commit

### Wave 5: Documentation & Integration

- [ ] Task 9: Update CLAUDE.md with new commands and state
  - **Agent**: spark
  - **Acceptance criteria**: CLAUDE.md Commands section includes `/trace`, `/doctor`, `/psm`, `/release` with descriptions. Runtime State tree includes `.maestro/trace.jsonl`. Agents table unchanged (no new agents in this phase).
  - **Dependencies**: Tasks 3, 6, 7, 8
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/CLAUDE.md`
  - **Steps**:
    1. Add four new commands to Commands section
    2. Add `trace.jsonl` to Runtime State tree
    3. Commit

- [ ] Task 10: Update maestro skill index
  - **Agent**: spark
  - **Acceptance criteria**: `.claude/skills/maestro/SKILL.md` quick reference and triggers include `/trace`, `/doctor`, `/psm`, `/release`.
  - **Dependencies**: Tasks 3, 6, 7, 8
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/maestro/SKILL.md`
  - **Steps**:
    1. Add trigger rows and quick reference entries for four new commands
    2. Commit

- [ ] Task 11: Update status skill to report trace and PSM state
  - **Agent**: spark
  - **Acceptance criteria**: `/status` SKILL.md includes: (1) trace.jsonl presence and event count, (2) active PSM sessions from `~/.maestro-psm/sessions.json`.
  - **Dependencies**: Tasks 1, 7
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/status/SKILL.md`
  - **Steps**:
    1. Add trace and PSM state sections
    2. Commit

- [ ] Task 12: Update setup-check to verify trace MCP and PSM prerequisites
  - **Agent**: spark
  - **Acceptance criteria**: `/setup-check` SKILL.md includes: (1) trace MCP toolbox presence check (`toolboxes/trace/`), (2) tmux availability check for PSM (`which tmux`), (3) gh CLI availability check for PSM (`which gh`).
  - **Dependencies**: Tasks 2, 7
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/setup-check/SKILL.md`
  - **Steps**:
    1. Add prerequisite checks for trace MCP and PSM tools
    2. Commit

### Wave 6: Verification

- [ ] Task 13: Final verification and regression
  - **Agent**: spark
  - **Acceptance criteria**: All new scripts pass `bash -n`. hooks.json validates with `jq .`. All new skills have valid YAML frontmatter. Plugin manifest still valid. Hook smoke tests pass. Documentation links validate.
  - **Dependencies**: Tasks 1-12
  - **Files**: (verification only)
  - **Steps**:
    1. `bash -n .claude/scripts/trace-logger.sh` — exit 0
    2. `jq . .claude/hooks/hooks.json` — valid JSON
    3. `jq . toolboxes/mcp_template.json` — valid JSON
    4. `jq . .claude-plugin/plugin.json` — valid JSON
    5. Verify all 4 new SKILL.md files have `---` frontmatter with `name:` and `description:`
    6. `bash scripts/test-hooks.sh` — all tests PASS
    7. `./scripts/validate-links.sh` — link validation passes
    8. Commit any fixes
    9. Final commit: `feat(omc): Phase 6 — trace, doctor, PSM, release`

## Dependency Chain
> T1: Create trace event logging hook [`kraken`]
> T2: Create trace MCP toolbox [`kraken`]
> T3: Create /trace skill [`spark`] — blocked by T2
> T4: Add trace MCP to mcp_template [`spark`] — blocked by T2
> T5: Add trace hook smoke test [`spark`] — blocked by T1
> T6: Create /doctor skill [`kraken`]
> T7: Create /psm skill [`kraken`]
> T8: Create /release skill [`kraken`]
> T9: Update CLAUDE.md [`spark`] — blocked by T3, T6, T7, T8
> T10: Update maestro skill index [`spark`] — blocked by T3, T6, T7, T8
> T11: Update status skill [`spark`] — blocked by T1, T7
> T12: Update setup-check [`spark`] — blocked by T2, T7
> T13: Final verification [`spark`] — blocked by T1-T12

## Execution Phases
> **Phase 1** — T1: Trace hook [`kraken`], T2: Trace MCP [`kraken`], T6: Doctor skill [`kraken`], T7: PSM skill [`kraken`], T8: Release skill [`kraken`] *(all parallel — no file overlap)*
> **Phase 2** — T3: Trace skill [`spark`], T4: MCP template [`spark`], T5: Hook test [`spark`], T11: Status update [`spark`]
> **Phase 3** — T9: CLAUDE.md [`spark`], T10: Maestro index [`spark`], T12: Setup-check [`spark`]
> **Phase 4** — T13: Final verification [`spark`]

## Verification
- [ ] `bash -n .claude/scripts/trace-logger.sh` — exit 0, no syntax errors
- [ ] `jq . .claude/hooks/hooks.json` — valid JSON with new PostToolUse entry
- [ ] `jq . toolboxes/trace/trace.js > /dev/null 2>&1 || node -e "require('./toolboxes/trace/trace.js')" 2>&1 | head -1` — compiled JS loads without syntax error
- [ ] `test -f toolboxes/trace/trace.ts && test -f toolboxes/trace/trace.js` — both source and compiled artifacts exist (exit 0)
- [ ] `jq . mcp_template.json` — valid JSON with trace entry
- [ ] `jq . .claude-plugin/plugin.json` — valid plugin manifest
- [ ] `bash scripts/test-hooks.sh` — all tests PASS including trace hook test
- [ ] `./scripts/validate-links.sh` — documentation links valid
- [ ] `grep -c 'trace\|doctor\|psm\|release' CLAUDE.md` — all 4 new commands referenced (count >= 4)
- [ ] `ls .claude/skills/trace/SKILL.md .claude/skills/doctor/SKILL.md .claude/skills/psm/SKILL.md .claude/skills/release/SKILL.md` — all 4 skill files exist (exit 0)

## Notes

### Design Decisions

1. **MCP for Trace, not file-based**: User explicitly chose MCP-based tracing over file-based logging. The trace MCP toolbox follows the same pattern as the existing `agent-mail` toolbox in `toolboxes/`. TypeScript + bun for the MCP server, shell script for the event collection hook.

2. **Doctor complements, doesn't replace setup-check**: `/setup-check` remains for quick prerequisite verification. `/doctor` adds deeper diagnostics (hook integrity, stale state, script permissions, orphaned teams) plus auto-fix capability. They serve different purposes.

3. **PSM uses ~/.maestro-psm/ not .maestro/**: PSM state (sessions.json, worktree paths) is user-global, not project-scoped. Unlike plans and wisdom which are project-specific, PSM sessions span multiple repos. Using `~/.maestro-psm/` avoids polluting project state.

4. **Release requires explicit confirmation for destructive actions**: Every action that affects remote state (push, publish, release) requires a separate AskUserQuestion confirmation. This matches Maestro's "measure twice, cut once" philosophy.

5. **No new agents**: All features are implemented as skills (workflow definitions), not agents. The existing agent roster (kraken, spark, etc.) handles implementation. This keeps the agent surface area stable.

### Parallelization Guide

**Phase 1** can run 5 kraken workers simultaneously — Tasks 1, 2, 6, 7, 8 have zero file overlap:
- T1: creates `.claude/scripts/trace-logger.sh` + modifies `hooks.json`
- T2: creates `toolboxes/trace/*` (new directory)
- T6: creates `.claude/skills/doctor/SKILL.md` (new directory)
- T7: creates `.claude/skills/psm/SKILL.md` (new directory)
- T8: creates `.claude/skills/release/SKILL.md` (new directory)

**Phase 2** can run 4 spark workers — Tasks 3, 4, 5, 11 have no overlap:
- T3: creates `.claude/skills/trace/SKILL.md` (new)
- T4: modifies `toolboxes/mcp_template.json`
- T5: modifies `scripts/test-hooks.sh`
- T11: modifies `.claude/skills/status/SKILL.md`

**Phase 3** has mild contention on CLAUDE.md and maestro SKILL.md but different sections:
- T9: modifies `CLAUDE.md`
- T10: modifies `.claude/skills/maestro/SKILL.md`
- T12: modifies `.claude/skills/setup-check/SKILL.md`

### OMC Reference Files
- Trace: `tmp/oh-my-claudecode/commands/trace.md`
- Doctor: `tmp/oh-my-claudecode/commands/doctor.md`
- PSM: `tmp/oh-my-claudecode/commands/psm.md`, `tmp/oh-my-claudecode/skills/project-session-manager/SKILL.md`
- Release: `tmp/oh-my-claudecode/commands/release.md`

## Prior Wisdom
Wisdom topics from past cycles: docs-update, skill-interop, review-improvement, hooks-improvement, omc-features, omc-phase5, conductor-integration, context7-integration, session-plan-injection, plan-visual-summary, review-autofix, code-styleguides, and 10 others.

## Key Context
- **Research log**: `.maestro/drafts/omc-phase6-research.md`
- OMC source files: `tmp/oh-my-claudecode/commands/` and `tmp/oh-my-claudecode/skills/`
- Existing toolbox pattern: `toolboxes/agent-mail/` (TypeScript MCP server via bun)
- Existing worktree skill: `.claude/skills/git-worktrees/SKILL.md`
