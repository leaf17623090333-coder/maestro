# Wisdom: Context7 Deep Integration

## Conventions Discovered
- Prometheus agent workflow sections follow a logical order: Constraints → Interview Rules → Plan Output Standards → Teammates → [new sections] → Web Research → Outputs → Workflow Summary → Clearance Checklist
- Design skill prompt strings are single-line escaped markdown — `\n` for newlines, all on one line. The Edit tool handles these correctly if you match the exact content including escape sequences
- Context7 MCP tools (`resolve-library-id`, `query-docs`) are session-level — available to all agents without modifying individual agent tool lists

## Successful Approaches
- Direct execution (no team) for simple 2-task plans with independent, well-specified edits — avoids team overhead and stale member cleanup issues
- Editing both prompt strings (full-mode and quick-mode) in separate Edit calls rather than trying `replace_all` — the surrounding context differs so each needs a unique match
- Adding a new workflow section between existing sections rather than modifying inline — cleaner diff, easier to review

## Failed Approaches to Avoid
- Trying to match escaped prompt strings with double-escaped backslashes (`\\\\n`) in Edit tool — the file contains literal `\n`, not `\\n`
- Team cleanup with orphaned members — `TeamDelete` blocks on stale member references even when the config file shows no members. Run `/reset` to clear these

## Technical Gotchas
- The `Grep` pattern for `resolve-library-id(query, libraryName)` doesn't match because the actual content in SKILL.md is on a long single line with `\n` escapes — use a simpler pattern like `resolve-library-id` without parentheses
- Plan verification command `grep 'Library Detection & Documentation workflow'` matches 2 times in SKILL.md because both full-mode and quick-mode prompts contain it — this is correct and expected
