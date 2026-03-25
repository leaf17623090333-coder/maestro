# Wisdom: Test Skill Interop

## Conventions Discovered
- Skill discovery uses `find -L` to follow symlinks (skills installed via `npx skills add` create symlinks)
- Project skills at `.claude/skills/*/SKILL.md` override global skills at `~/.claude/skills/*/SKILL.md`

## Successful Approaches
- Graceful degradation works: when no skills are found, the workflow continues without skill injection
- Task delegation and completion flow works correctly

## Failed Approaches to Avoid
- Cannot test skill injection without actually installing a skill first

## Technical Gotchas
- The `web-design-guidelines` skill referenced in the test plan is not installed
- Must run `npx @anthropic-ai/skills add web-design-guidelines` to actually test skill injection
- Skill discovery returned empty because no SKILL.md files exist in discovery paths
