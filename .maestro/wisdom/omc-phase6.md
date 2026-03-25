# Wisdom: OMC Phase 6 — Trace, Doctor, PSM, Release

## Conventions Discovered
- MCP toolboxes follow dual-file pattern: `.ts` source + compiled `.js` committed to repo (matching `toolboxes/agent-mail/`). Only .ts and .js are tracked — node_modules, package.json, bun.lock stay untracked.
- Skill YAML frontmatter pattern: `name`, `description`, `argument-hint`, `disable-model-invocation: true`. Optional: `aliases`, `allowed-tools`.
- PostToolUse hooks can use wildcard matcher (`"*"`) to match all tools. Pure logging hooks must produce NO stdout output.
- `mcp_template.json` lives at repo root (not in `toolboxes/`). Each MCP server entry has `command`, `args`, and optionally `cwd`.

## Successful Approaches
- **5-worker parallel Phase 1**: Spawning 5 kraken workers for independent tasks (trace hook, trace MCP, doctor, PSM, release) with zero file overlap — all completed without conflicts.
- **Explicit nudging for idle workers**: Workers that went idle without producing output needed explicit "DO THIS NOW" messages with full context re-stated. Be very direct.
- **Orchestrator commits for workers**: When workers create files but forget to commit, the orchestrator can commit on their behalf to keep momentum. Don't wait for workers to self-correct.
- **Self-claiming workers**: After initial assignment, workers like impl-1 autonomously completed T1→T5→T3→T9→T10 by checking TaskList for unblocked work.

## Failed Approaches to Avoid
- **Workers going idle without acting**: 3 of 5 Phase 1 workers (impl-2, impl-4, impl-5) went idle on first spawn without creating files. Always follow up idle notifications with explicit re-assignment messages.
- **Task contention**: When T4 became unblocked, both impl-3 and impl-5 tried to claim it. The orchestrator needs to track assignments and redirect immediately.

## Technical Gotchas
- `bun build` for MCP toolbox creates node_modules and bun.lock — these should NOT be committed (agent-mail only tracks .ts and .js)
- `TaskList` does not accept a `reason` parameter despite schema suggesting it
- Workers sometimes report task completion but don't actually commit — always verify with `git log` before marking complete

## Agent Effectiveness
- **impl-1 (kraken)**: Most productive — 5 tasks (T1, T5, T3, T9, T10). Self-claimed and completed autonomously after initial assignment.
- **impl-2 (kraken)**: Created trace MCP toolbox (T2, T4) but needed nudging to start.
- **impl-3 (kraken)**: Created doctor skill (T6) and status update (T11). Forgot to commit initially.
- **impl-4 (kraken)**: Created PSM skill (T7) and setup-check update (T12). Needed nudging to start.
- **impl-5 (kraken)**: Created release skill (T8) and mcp_template update (T4). Needed nudging to start.

## Patterns Captured
- Hook smoke test pattern: `setup_project → set env vars → pipe JSON to script → assert no stdout → assert file creation → assert JSON content with jq`
- MCP toolbox pattern: TypeScript with @modelcontextprotocol/sdk, StdioServerTransport, ListToolsRequestSchema/CallToolRequestSchema handlers
- Skill with confirmation gates: Use AskUserQuestion for each destructive action (push, publish, release)
- PSM state: Global at ~/.maestro-psm/ (not project-scoped) with sessions.json tracking worktree sessions

## Technology Notes
- MCP SDK: `@modelcontextprotocol/sdk` provides Server, StdioServerTransport, and schema types for building MCP servers
- Trace JSONL format: `{"timestamp","event_type","tool_name","agent_name","success","summary"}` — one event per line
- tmux session naming: `maestro:<alias>:<ref>` pattern for PSM sessions
