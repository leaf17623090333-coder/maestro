# Wisdom: Code Styleguides — CLAUDE.md Injection

## Conventions Discovered
- Style guide templates stored in `.claude/lib/styleguides/` as internal library files (not as a skill's guide subdirectory)
- CLAUDE.md injection uses HTML comment markers (`<!-- maestro:code-styleguides:start/end -->`) for idempotency
- The `/styleguide` skill is user-invocable and handles language detection + injection as a single command

## Successful Approaches
- Cloning conductor content verbatim with attribution — avoids maintenance burden of custom guides
- Sequential task chain (T1→T2→T3→T4→T5) worked well for this feature since each task built on the previous
- Workers self-committed after each task, keeping the commit history clean and atomic
- Non-blocking tip in `/work` Step 1.5 — suggests `/styleguide` without blocking execution

## Failed Approaches to Avoid
- Prometheus struggled with plan mode (couldn't call ExitPlanMode or AskUserQuestion) — had to draft the plan manually as design orchestrator
- Initial skill-based injection approach was rejected by user in favor of CLAUDE.md injection — ask about injection strategy early

## Technical Gotchas
- `find -L -type f` may return empty on some macOS setups even when files exist — use `ls` as fallback verification
- The `/styleguide` skill needs to locate guide templates via both project path and global plugin path (fallback chain)
- `disable-model-invocation: true` in SKILL.md frontmatter means the skill content IS the prompt — no model invocation needed
