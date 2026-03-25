# Wisdom: Project Context Scaffolding (/setup Command)

## Conventions Discovered
- Maestro's `.maestro/` namespace is the standard location for all runtime state (plans, wisdom, drafts, archive, context)
- Hook scripts follow a numbered section pattern (1, 1.5, 2, 3...) that makes insertion points clear
- SKILL.md files use YAML frontmatter with `allowed-tools` to control what tools the skill can use
- `disable-model-invocation: true` in frontmatter means the skill content IS the prompt (no separate model call)

## Successful Approaches
- **Hook-based injection** over explicit skill modification: Extending `subagent-context.sh` gives all agents project context awareness with zero changes to skill files
- **Parallel worker execution**: 4 spark workers handling 8 tasks completed in one wave. Tasks 3→4 sequenced correctly (same file dependency)
- **Brownfield/greenfield detection pattern**: Checking for config files (package.json, pyproject.toml, etc.) is a reliable way to classify project maturity
- **Idempotent design**: No state file needed — running `/setup` again offers update/view/cancel, simpler than Conductor's `setup_state.json` approach

## Failed Approaches to Avoid
- Don't port features 1:1 from other tools — adapt to Maestro's architecture (e.g., Conductor's 5+ files → Maestro's 3 files)
- Don't modify `/design` and `/work` SKILL.md when hooks can handle the injection

## Technical Gotchas
- `session-start.sh` commands line and context availability section must be in the right order (commands first, then context check, then skills scan)
- When multiple workers edit documentation files, ensure they don't target the same file to avoid merge conflicts
- The `subagent-context.sh` title extraction pattern `${line#\# }` strips the markdown `# ` prefix from headings
