# Skill Interoperability

## Objective
Enable Maestro to auto-detect installed skills (project + global) and inject their guidance into worker prompts during execution, with graceful degradation when no skills are present.

## Scope

**In**:
- Skill discovery from `.claude/skills/` (project) and `~/.claude/skills/` (global)
- Skill registry with metadata parsing from SKILL.md frontmatter
- Skill matching based on task keywords/patterns
- Prompt injection into kraken/spark worker delegations
- Graceful degradation when no skills found

**Out**:
- Installing skills (users use `npx skills add` separately)
- Creating new skills (use existing `skills init` or `/plan-template`)
- Plugin-level skill scanning (future enhancement)
- Skill-as-agent orchestration (skills remain passive guidance, not active agents)

## Tasks

- [ ] Task 1: Create skill registry module
  - **File**: `.claude/lib/skill-registry.md` (skill definition for internal use)
  - **Description**: Define the skill discovery and registry logic as a non-user-invocable skill
  - **Acceptance criteria**:
    - Creates `.claude/lib/` directory if it doesn't exist
    - Discovers SKILL.md files in project `.claude/skills/` and global `~/.claude/skills/`
    - Parses YAML frontmatter (name, description, triggers, priority)
    - Project skills override global skills with the same name
    - Returns structured list: `[{name, description, triggers[], priority, path, source: "project"|"global"}]`
  - **Agent**: spark
  - **Dependencies**: none
  - **Parallel**: Can run with Task 2

- [ ] Task 2: Add skill matching logic
  - **File**: `.claude/lib/skill-matcher.md`
  - **Description**: Match tasks to relevant skills based on keywords in task description
  - **Acceptance criteria**:
    - Matches task descriptions against skill `triggers` array (if present) or skill name/description words
    - Ranking algorithm: Sort by `priority` field (higher first, default 0), then alphabetically by name if tied
    - Returns ranked list: `[{name, relevance: "trigger"|"keyword", priority}]`
    - Empty list if no matches (enables graceful degradation)
  - **Agent**: spark
  - **Dependencies**: none
  - **Parallel**: Can run with Task 1

- [ ] Task 3: Update orchestrator to inject skills
  - **File**: `.claude/commands/work.md`
  - **Description**: Modify Step 4 (spawn teammates) to include skill context in worker prompts
  - **Acceptance criteria**:
    - Add Step 3.5: Discover available skills via registry (Glob + Read SKILL.md files)
    - For each task delegation, find matching skills via matcher logic
    - Inject skill guidance into Task prompt: `## SKILL GUIDANCE` section placed after `## CONTEXT` and before `## MUST DO`
    - Format: `### {skill-name}\n{SKILL.md content after frontmatter}`
    - If no skills match, omit the section entirely (graceful degradation)
  - **Agent**: spark
  - **Dependencies**: blockedBy Task 1, Task 2
  - **Parallel**: Can run with Task 4 after dependencies complete

- [ ] Task 4: Update design command for skill awareness
  - **File**: `.claude/commands/design.md`
  - **Description**: Prometheus should know about available skills during planning
  - **Acceptance criteria**:
    - Add to Step 3 (before spawning Prometheus): Discover available skills via registry
    - Pass skill summary to Prometheus prompt: `## Available Skills\n{list of skill names and one-line descriptions}`
    - Prometheus can reference skills when suggesting implementation approaches
    - If no skills found, omit the section (graceful degradation)
  - **Agent**: spark
  - **Dependencies**: blockedBy Task 1, Task 2
  - **Parallel**: Can run with Task 3 after dependencies complete

- [ ] Task 5: Add skill-interop documentation
  - **File**: `docs/SKILL-INTEROP.md`
  - **Description**: Document how skill interop works for users
  - **Acceptance criteria**:
    - Explains skill discovery locations (project `.claude/skills/`, global `~/.claude/skills/`)
    - Shows how to install external skills (`npx skills add`)
    - Documents how skills enhance Maestro workflows (injection into worker prompts)
    - Lists recommended skills (frontend-design, web-design-guidelines, react-best-practices)
    - Explains how to create skill-aware custom skills (triggers, priority fields)
  - **Agent**: spark
  - **Dependencies**: blockedBy Task 3, Task 4
  - **Parallel**: Can run with Task 6

- [ ] Task 6: Update SKILL.md reference
  - **File**: `.claude/skills/maestro/SKILL.md`
  - **Description**: Document skill interop in the main Maestro skill reference
  - **Acceptance criteria**:
    - Add "Skill Interoperability" section after "Agent Teams Setup"
    - Explain: "Maestro auto-detects installed skills and injects their guidance into worker prompts"
    - List discovery locations and graceful degradation behavior
  - **Agent**: spark
  - **Dependencies**: blockedBy Task 3, Task 4
  - **Parallel**: Can run with Task 5

## Verification

- [ ] `ls .claude/lib/` — Verify skill-registry.md and skill-matcher.md exist
- [ ] `grep "SKILL GUIDANCE" .claude/commands/work.md` — Verify injection section added with correct placement
- [ ] `grep "Available Skills" .claude/commands/design.md` — Verify skill awareness added to Prometheus prompt
- [ ] `grep "Skill Interoperability" .claude/skills/maestro/SKILL.md` — Verify reference updated
- [ ] Install a test skill (`npx skills add anthropics/skills --skill frontend-design`) and run `/work` on a UI task — verify skill content appears in worker prompt under `## SKILL GUIDANCE`
- [ ] Run `/work` without any external skills installed — verify no errors, no SKILL GUIDANCE section (graceful degradation)

## Notes

**Technical Decisions:**

1. **Skills as markdown files, not code** — The registry and matcher are defined as internal skills (SKILL.md format) rather than executable code. This keeps Maestro as a pure prompt-based plugin without runtime dependencies.

2. **Keyword matching over semantic** — Initial implementation uses simple keyword matching (task contains "frontend" → match frontend-design skill). Semantic matching could be a future enhancement.

3. **Injection format and placement** — Skills are injected as a `## SKILL GUIDANCE` section in worker prompts, placed after `## CONTEXT` and before `## MUST DO`:
   ```
   ## CONTEXT
   [Background, constraints, related files]

   ## SKILL GUIDANCE
   The following skill applies to this task:

   ### frontend-design
   [Content from SKILL.md after frontmatter]

   ## MUST DO
   [Explicit requirements]
   ```

4. **Discovery priority** — Project skills override global skills with the same name (local customization).

5. **Registry caching** — Skills are discovered once at workflow start (Step 3.5), not per-task. This avoids repeated filesystem scans.

6. **New directory** — `.claude/lib/` is a new directory for internal modules. Task 1 creates it.

**Rollback Strategy:**

All changes are additive. Rollback is automatic:
- No skills installed → No SKILL GUIDANCE section → Existing behavior preserved
- Delete `.claude/lib/` → Registry fails gracefully → No injection → Existing behavior
- Remove skill discovery steps from commands → Back to original workflow

**Research Findings:**

- Anthropic's `frontend-design` skill focuses on aesthetic guidelines and design thinking
- Vercel's `web-design-guidelines` fetches live rules from a URL
- Vercel's `react-best-practices` contains 57 performance rules across 8 categories
- Skills use YAML frontmatter with `name`, `description`, optional `metadata`, `license`
- The `vercel-labs/skills` CLI installs to `.claude/skills/` by default

**Extensibility:**

The registry system allows any skill to participate. Skills can optionally declare:
- `triggers`: Keywords that activate the skill (e.g., `["frontend", "ui", "design"]`)
- `priority`: Numeric weight for ranking when multiple skills match (higher = more priority, default 0)

This makes the system extensible without Maestro needing to know about specific skills in advance.

**Parallelization:**

```
[Task 1: registry] ──┬──→ [Task 3: work.md] ──┬──→ [Task 5: docs]
                     │                        │
[Task 2: matcher]  ──┘──→ [Task 4: design.md] ┴──→ [Task 6: SKILL.md]
```

- Wave 1: Tasks 1 & 2 (concurrent)
- Wave 2: Tasks 3 & 4 (concurrent, after wave 1)
- Wave 3: Tasks 5 & 6 (concurrent, after wave 2)
