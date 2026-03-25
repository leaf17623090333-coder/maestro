# Wisdom: Git Worktree Multi-Plan Support

## Conventions Discovered
- Step numbering uses `.5` and `.7` convention for insertions between existing steps (established pattern)
- SKILL.md files follow YAML frontmatter pattern with `name`, `description`, `triggers` fields
- Command files are the sole functional layer — changes to commands = changes to behavior
- Summary tables in status/reset commands need updating when new sections are added
- Process section counts ("five areas" -> "six areas") must be updated when adding cleanup targets

## Successful Approaches
- Wave-based parallel execution: independent tasks (skill creation, gitignore, manifest) run in Wave 1, dependent tasks (work.md updates, status, reset) in Wave 2, sequential tasks (work.md completion step) in Wave 3
- Spawning fresh workers when reassigned tasks don't get picked up by idle agents — spark agents that completed their original task didn't reliably process reassignment messages
- Giving workers the full file content context (line numbers, surrounding structure) produces accurately placed edits
- Reading and verifying every file after worker reports completion catches issues early

## Failed Approaches to Avoid
- Reassigning tasks to already-spawned spark agents via SendMessage — they completed their original task and went idle, but didn't reliably process new task assignments. Spawn fresh workers instead.
- Relying on TaskList `reason` parameter — it's not accepted by the tool schema

## Technical Gotchas
- The `.worktrees/` directory lives at project root (sibling of `.maestro/`, `.claude/`), NOT inside `.maestro/`
- `git branch -d` (lowercase) for safe delete vs `git branch -D` (uppercase) for force delete — always try `-d` first
- Worktree branches use `maestro/` prefix namespace to distinguish from user branches
- `git check-ignore -q` exit code 0 = ignored, exit code 1 = not ignored (inverted from typical boolean expectation)
- Validation scripts (`validate-links.sh`, `validate-anchors.sh`) should be run after all edits to catch broken references
