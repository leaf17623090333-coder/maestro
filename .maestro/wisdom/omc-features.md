# Wisdom: OMC Feature Adoption

## Conventions Discovered
- Maestro hooks are shell scripts; complex logic (JSON parsing, state machines) works but is verbose in bash vs OMC's Node.js approach
- The Stop hook schema uses `agent_type` in stdin and `decision`/`reason` in output — validated by testing but not formally documented
- `.maestro/` is gitignored, so design docs placed there (Tasks 27, 28) won't be tracked — consider moving to `.claude/docs/` for trackable design docs

## Successful Approaches
- **File contention serialization**: Pre-declaring dependency chains for shared files (hooks.json, work SKILL.md, orchestrator.md) prevented all merge conflicts across 3 parallel workers
- **Guidance over enforcement**: Model selection, file ownership, and heartbeats implemented as orchestrator guidance (markdown docs) rather than hard hooks — simpler and more flexible
- **Leviathan review caught real issues**: Circular dependency in task setup, file contention risks, missing code snippets — all caught before execution
- **Worker self-coordination**: Workers claimed tasks autonomously after initial assignment, maintaining high parallelism

## Failed Approaches to Avoid
- **Circular dependencies in task setup**: Task 6 was accidentally blocked by Task 8 which was blocked by Task 6. Always verify dependency graphs are acyclic before execution
- **TaskUpdate can't remove blockers**: Had to recreate Task 6 as Task 32 to fix the circular dependency — TaskUpdate only has `addBlockedBy`, not `removeBlockedBy`

## Technical Gotchas
- `git add` fails silently for gitignored paths (.maestro/) — use `-f` flag or move files outside gitignored directories
- BSD date (macOS) and GNU date (Linux) have different ISO timestamp parsing — session-start.sh uses fallback chain for compatibility
- Multiple PostToolUse hooks on the same matcher (e.g., two Bash hooks: error-detector + bash-history) work fine — both execute
- Phase 4 design docs (SQLite coordination, layered skills) are in .maestro/plans/ which is gitignored — they exist locally only

## Agent Effectiveness
- **hooks-worker (kraken)**: 7 tasks — excellent for hook scripts with inline code from the plan
- **skill-worker (spark)**: 7 tasks — efficient for config changes and standalone lib files
- **agent-worker (kraken)**: 10 tasks — handled the complex multi-file tasks (build-fixer, critic, work SKILL.md modifications)
