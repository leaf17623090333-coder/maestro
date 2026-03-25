# Wisdom: Hooks Improvement

## Conventions Discovered
- Hook scripts live in `.claude/scripts/`, non-hook utilities stay in `scripts/`
- All hook commands in `hooks.json` use `"$CLAUDE_PROJECT_DIR"/.claude/scripts/...` for portability
- PreToolUse deny uses `hookSpecificOutput.permissionDecision: "deny"` + `permissionDecisionReason`
- PreToolUse allow is simply `exit 0` with no stdout output
- PostToolUse/SessionStart/SubagentStart context injection uses `hookSpecificOutput.additionalContext`
- Agent detection uses a broad set of jq fallback paths plus transcript fallback for PreToolUse hooks

## Successful Approaches
- Parallel worker spawning for independent tasks (3 workers on 7 tasks simultaneously)
- YAML frontmatter parsing with bash `read` loop and regex matching (no external YAML parser needed)
- Using `jq -Rs` to safely escape multiline context strings into JSON
- Temp directory isolation for hook testing with `CLAUDE_PROJECT_DIR` override
- Graceful degradation: all hooks exit 0 on error paths so sessions never fail

## Failed Approaches to Avoid
- Workers sometimes report task completion without actually writing files — always verify by reading the output files
- `set -euo pipefail` in hooks must be used carefully with jq — use `|| true` after jq commands that might fail on missing fields

## Technical Gotchas
- The `hooks.json` uses plugin format: `{"description": "...", "hooks": {...}}` wrapper — not the flat settings format
- SessionStart hook must NOT be async — context must be injected before the agent starts
- SubagentStart hook fires for ALL agents (no matcher filtering) — the script itself filters by `agent_type`
- `$CLAUDE_PROJECT_DIR` defaults to `.` when unset — always use `${CLAUDE_PROJECT_DIR:-.}` pattern
- Deprecated format: `{"decision":"block"}` → New: `{"hookSpecificOutput":{"permissionDecision":"deny"}}`
