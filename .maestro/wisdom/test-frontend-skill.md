# Wisdom: Test Frontend-Design Skill Injection

## Conventions Discovered
- Symlinked skills (`.claude/skills/web-design-guidelines -> .agents/skills/...`) require `-L` flag with `find` to follow symlinks
- Plugin skills are located at `~/.claude/plugins/marketplaces/.../skills/*/SKILL.md`

## Successful Approaches
- Running all `find` commands in a single Bash call is efficient for skill discovery
- Injecting full SKILL.md content (after frontmatter) into worker prompts ensures workers receive complete guidance
- Matching skills by keywords in task description works well for UI/frontend tasks

## Failed Approaches to Avoid
- Glob tool doesn't follow symlinks — use `find -L` for skill discovery
- Don't rely on Glob for plugin paths on macOS (compatibility issues with `-type f`)

## Technical Gotchas
- Skills in `.agents/skills/` symlinked to `.claude/skills/` need the symlink followed
- Plugin skill paths are deeply nested: `~/.claude/plugins/marketplaces/{marketplace}/{plugin}/skills/{skill}/SKILL.md`
