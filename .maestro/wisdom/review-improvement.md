# Wisdom: Review Command Improvement

## Conventions Discovered
- Command files are instructions FOR Claude, not documentation for humans
- `allowed-tools` in frontmatter gates what tools the command can use — must explicitly include any tool referenced in the command body
- Plan format uses `**Acceptance criteria**:` with indented bullets under each `- [ ] Task N:` line

## Successful Approaches
- Single-task plan for single-file rewrites avoids unnecessary coordination overhead
- Spark agent is well-suited for single-file command rewrites
- Providing the existing file content + diff table (current vs new behavior) gives workers clear direction

## Failed Approaches to Avoid
- None — clean execution

## Technical Gotchas
- The review command needs `AskUserQuestion` in `allowed-tools` for multi-plan selection — easy to forget since it's not a typical tool for review commands
- Scope compliance checking is heuristic (pattern matching), not definitive — the review command should note this limitation
