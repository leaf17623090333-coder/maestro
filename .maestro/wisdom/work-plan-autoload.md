# Wisdom: Work Plan Autoload

## Conventions Discovered
- All Maestro commands use `AskUserQuestion` with consistent formatting for multi-choice selections
- Handoff JSON files use a minimal schema (`topic`, `status`, `started`, `completed`, `plan_destination`) — sufficient for cross-referencing without adding new fields
- Command markdown files (`.claude/commands/`) are the sole functional layer — hooks are stubs, CLAUDE.md is read-only

## Successful Approaches
- Parallel spark workers for independent single-file edits — all 3 tasks completed without conflicts
- Providing exact line numbers and surrounding context in delegation prompts led to precise, minimal edits
- Graceful degradation pattern: always preserve existing behavior as fallback when new metadata isn't available

## Failed Approaches to Avoid
- None encountered — the plan was well-scoped with clear file boundaries

## Technical Gotchas
- `claude "/work"` is a real CLI invocation (positional prompt argument) — not a hypothetical feature
- The `completed` field only exists on handoff files with `status: "complete"` — must check status before sorting by timestamp
- Markdown table cells with complex content (conditionals, bold text, backticks) need careful escaping to maintain table formatting
