# Wisdom: Manual Skill Injection Test

## Conventions Discovered
- Skills live in `.claude/skills/<name>/SKILL.md` with YAML frontmatter
- Symlinks work for skill discovery (e.g., `.claude/skills/web-design-guidelines` → `.agents/skills/...`)
- `find -L` is required to follow symlinks; `Glob` does not follow them

## Successful Approaches
- Keyword matching (UI, design, component) correctly matched web-design-guidelines skill
- Injecting full SKILL.md content (after frontmatter) into worker prompt works
- Spark agent produced quality output with skill guidance included

## Failed Approaches to Avoid
- Using `Glob` alone for skill discovery misses symlinked skills
- Looking in `~/.claude/plugins/marketplaces` when plugins aren't installed yields empty results

## Technical Gotchas
- `frontend-design` skill referenced in plan notes wasn't actually installed in plugin directories
- SKILL.md files use YAML frontmatter (`---` delimited) for metadata; content follows after
