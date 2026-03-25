# Research Log: plan-maestro

## Initial Research

### Codebase Findings (explore)

**Directory Structure**: Canonical `.agents/skills/{name}/` with `.claude/skills/{name}/` symlinks. Reference prompts go in `reference/` subdirectory. Plugin registered via `.claude-plugin/plugin.json`.

**YAML Frontmatter Schema**: `name` (required), `description` (required), optional `metadata`, `triggers`, `priority`, `allowed-tools`, `disallowedTools`, `disable-model-invocation`.

**Codex Tool Mapping**: Standard section in SKILL.md mapping Claude Code tools to Codex equivalents (Task->spawn_agent, SendMessage->send_input, Read/Write->exec_command/apply_patch, AskUserQuestion->request_user_input, TeamCreate->spawn_agent with team_name).

**Plan Formats**: Maestro plans (.maestro/plans/) have strict required sections (Objective, Tasks with checkboxes, Verification). Native plans (~/.claude/plans/) have random filenames, title-based lookup, loose structure.

**Hooks**: 14 hook scripts in `.claude/scripts/` registered in `.claude/hooks/hooks.json`. Key ones: session-start, subagent-context, plan-protection, error-detector.

**Agent Definitions**: Lean identity files in `.claude/agents/`. Workflows live in SKILL.md, not agent definitions.

**Existing Plan Skills**: /plan-template (scaffold), /status (show state), /reset (cleanup).

### Strategic Analysis (oracle)

**Bottom Line**: /plan:maestro should be a thin conversational wrapper, not a new workflow engine. Platform detection + alias table + delegation to existing /design and /work pipeline.

**Key Recommendations**:
1. Platform detection (claude|codex|amp) via env vars/tool availability
2. Complement existing /design + /work, not replace
3. Write to .maestro/plans/ by default, --native flag for ~/.claude/plans/
4. Sequential execution fallback for Amp (no Agent Teams)
5. --auto flag for non-interactive design-to-execution chain

**Risks**: Agent Teams feature flag dependency, plan format proliferation, Amp invocation differences.

**Task Breakdown**: 6 tasks, estimated 1-4h total effort.

## Follow-up Research
