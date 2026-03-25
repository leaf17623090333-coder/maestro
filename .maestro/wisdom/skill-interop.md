# Wisdom: Skill Interoperability

## Conventions Discovered
- Skills use YAML frontmatter with `name`, `description`, optional `triggers`, `priority`
- Internal/non-user-invocable skills go in `.claude/lib/` directory
- Project skills override global skills with the same name

## Successful Approaches
- Wave-based parallelization: Tasks 1&2 concurrent, then 3&4, then 5&6
- Defining registry and matcher as markdown instruction files (not executable code) keeps Maestro pure prompt-based
- Simple keyword matching is sufficient for skill-task relevance; semantic matching can be a future enhancement

## Failed Approaches to Avoid
- None encountered in this execution

## Technical Gotchas
- Skills are discovered once at workflow start (Step 3.5), not per-task — avoids repeated filesystem scans
- `## SKILL GUIDANCE` section placement is critical: after `## CONTEXT`, before `## MUST DO`
- Graceful degradation means omitting sections entirely, not including empty sections
