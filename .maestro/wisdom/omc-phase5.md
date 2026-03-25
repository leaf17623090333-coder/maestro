# Wisdom: OMC Phase 5 — Adopt 6 High-Value Features

## Conventions Discovered
- Skill frontmatter requires `disable-model-invocation: true` for all skill-type SKILL.md files — this tells Claude Code the file is instructions, not a model to invoke
- Agent definitions use `disallowedTools` (camelCase) to explicitly prevent tool usage, while skills use `allowed-tools` (kebab-case) to whitelist
- Read-only agents (critic, oracle, security-reviewer) all share the same tool set: Read, Grep, Glob, Bash, TaskList, TaskGet, TaskUpdate, SendMessage — with Write/Edit/NotebookEdit/Task/TeamCreate/TeamDelete disallowed

## Successful Approaches
- **4-worker parallel execution**: Spawning 4 kraken workers for Phase 1 (7 independent tasks) maximized parallelism without file contention — all tasks completed without conflicts
- **Wave-based commits**: Committing after each verified wave (Wave 1: implementation, Wave 2: docs) keeps the history clean and allows `git bisect` to isolate issues
- **Pre-declaring file ownership in tasks**: Including `**Owned files**:` in task descriptions prevented workers from stepping on each other
- **Workers self-coordinating**: After initial assignment, workers autonomously claimed unblocked tasks via TaskList — reduced orchestrator overhead significantly
- **Rich delegation prompts**: Providing full file content in worker prompts (not just descriptions) led to higher first-attempt success rate

## Failed Approaches to Avoid
- **Workers losing context on re-message**: When sending follow-up task assignments to idle workers, they sometimes re-reported already-completed tasks instead of acting on the new assignment. Solution: be very explicit ("Task N is yours, do it NOW") rather than suggestive
- **TaskList parameter format**: Workers consistently hit errors calling TaskList with parameters — the tool apparently doesn't accept the `reason` parameter despite the schema suggesting it. Orchestrator had to use TaskGet for individual checks instead

## Technical Gotchas
- Pre-existing test failures (Test 12: verification-injector "VERIFY" vs "VERIFICATION REQUIRED", Test 15: session-start "ACTIVE PLAN" vs "ACTIVE EXECUTION") indicate prior refactors changed output strings without updating tests — worth fixing in a follow-up
- `.maestro/research/` and `.claude/skills/learned/` need `.gitkeep` files since git doesn't track empty directories
- Skill discovery in session-start.sh only looks at `.claude/skills/*/SKILL.md` — learned skills at `.claude/skills/learned/*.md` won't appear unless they follow the `*/SKILL.md` convention

## Agent Effectiveness
- **impl-1 (kraken)**: 4 tasks (T1, T5, T3, T4) — good for sequential chain (test→implement→verify), self-claimed T3+T4 after T1+T5
- **impl-2 (kraken)**: 4 tasks (T6, T7, T9, T19) — fast on agent/skill creation, handled security-review skill well
- **impl-3 (kraken)**: 4 tasks (T10, T11, T12, T14) — efficient for large skill files (194-231 lines each)
- **impl-4 (kraken)**: 4 tasks (T16, T8, T13, T15) — quick on config edits (whitelist, index updates)

## Patterns Captured
- Skill YAML frontmatter pattern: name, description, argument-hint, allowed-tools, disable-model-invocation
- Agent YAML frontmatter pattern: name, description, phase, tools, disallowedTools, model
- Hook test pattern: setup_project → create fixtures → run script with CLAUDE_PROJECT_DIR → parse jq output → assert content

## Technology Notes
- Maestro's skill registry discovers skills by walking `.claude/skills/*/SKILL.md` — any new skill just needs to exist in this path to be auto-discovered
- The subagent-context.sh whitelist is a simple bash case statement — adding new agent types is a one-line edit
