# Wisdom: plan-maestro Skill Creation

## What Worked
- Subagent-only pattern (Task tool) as cross-platform common denominator -- no Agent Teams dependency
- Planner subagent uses AskUserQuestion directly (general-purpose type, not Plan type) for user interviews
- Plan handoff via draft file (.maestro/drafts/) avoids Task return value truncation for large plans
- Tilde fences (~~~) for nested code blocks inside markdown skill files

## Gotchas
- `.venv/` directories from Python packages (like mcp_agent_mail) can break validate-links.sh and validate-anchors.sh -- must be excluded in EXCLUDE_DIRS
- When sending file content to workers via SendMessage, the content may not arrive if it's in the first message batch -- re-send if worker reports missing content
- Files go in `.claude/skills/` (first-party), NOT `.agents/skills/` (external plugins only)

## Patterns
- Skill structure: `SKILL.md` with YAML frontmatter (name, description, triggers) + `reference/` subdirectory for prompt templates
- Cross-platform tool mapping table in SKILL.md header (Claude Code / Codex / Amp equivalents)
- Background research subagents (explore + oracle) write to `.maestro/drafts/` for the planner to consume
