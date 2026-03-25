# Improve Design Workflow

## Objective

Enhance the Maestro `/design` workflow by incorporating brainstorming patterns (one question at a time, multiple-choice, incremental validation) into Prometheus's interview behavior, and writing-plans patterns (task granularity, complete code, exact commands) into the plan output format.

## Scope

**In**:
- Update Prometheus agent (`.claude/agents/prometheus.md`) with improved interview and plan-writing guidelines
- Update design command (`.claude/commands/design.md`) plan format template passed to Prometheus
- Update plan template skill (`.claude/skills/plan-template/SKILL.md`) to match new plan format
- Update Leviathan agent (`.claude/agents/leviathan.md`) validation checklist to enforce new plan quality standards

**Out**:
- Changes to the `/work` command or orchestrator agent (they consume plans -- the new format is backward-compatible with `- [ ]` task parsing)
- Changes to kraken/spark/explore/oracle agents
- New dependencies or files
- Changes to the skill discovery or interop system

## Tasks

- [ ] Task 1: Add brainstorming interview rules to Prometheus agent
  - **Agent**: spark
  - **Acceptance criteria**:
    - Prometheus agent file contains a new `## Interview Rules` section after `## Constraints`
    - Rules include: (1) one question at a time, (2) multiple-choice preferred with recommended option, (3) present 2-3 approaches with tradeoffs before settling, (4) present design in 200-300 word chunks with validation after each section, (5) review codebase research before asking questions, (6) YAGNI ruthlessly
    - Existing constraints and workflow sections remain intact
  - **Dependencies**: none
  - **Files**: `.claude/agents/prometheus.md`

- [ ] Task 2: Add plan output quality rules to Prometheus agent
  - **Agent**: spark
  - **Acceptance criteria**:
    - Prometheus agent file contains a new `## Plan Output Standards` section after `## Interview Rules`
    - Standards include: (1) plans assume zero codebase context -- document every file path, code snippet, and test approach, (2) each task is a single action (write failing test, run test, implement, run test, commit), (3) structured header with Goal, Architecture, Tech Stack, (4) each task has Files section listing exact paths, (5) include complete code/diffs -- never vague instructions, (6) exact commands with expected output, (7) TDD by default, frequent commits
    - Existing clearance checklist section remains intact
  - **Dependencies**: Task 1 (same file, sequential edits)
  - **Files**: `.claude/agents/prometheus.md`

- [ ] Task 3: Update design command plan format template
  - **Agent**: spark
  - **Acceptance criteria**:
    - The plan format string in both full-mode and quick-mode Task() prompts in `design.md` is updated
    - New format includes: structured header (Feature name H1, Goal one-liner, Architecture 2-3 sentences, Tech Stack), tasks with Files subsection and Step 1-5 pattern (test, run, implement, run, commit), verification section with exact commands and expected output
    - The format remains compatible with `/work` command parsing (still uses `- [ ]` checkboxes, `## Objective`, `## Tasks`, `## Verification` sections)
  - **Dependencies**: none
  - **Files**: `.claude/commands/design.md`

- [ ] Task 4: Update plan template skill to match new format
  - **Agent**: spark
  - **Acceptance criteria**:
    - Plan template includes structured header (Goal, Architecture, Tech Stack)
    - Task template includes Files subsection (paths to create/modify/test) and Step 1-5 pattern
    - Template includes example verification commands with expected output format
    - Backward compatible: still uses `## Objective`, `## Tasks`, `## Verification`, `## Scope` section names
  - **Dependencies**: Task 3 (format must be consistent)
  - **Files**: `.claude/skills/plan-template/SKILL.md`

- [ ] Task 5: Update Leviathan validation checklist for new plan quality standards
  - **Agent**: spark
  - **Acceptance criteria**:
    - Leviathan's "No Vague Language" check (section 5) is expanded to also flag: tasks without file paths, tasks without concrete code or diffs, verification commands without expected output
    - A new check "Task Granularity" is added: flag tasks that combine multiple actions (e.g., "implement feature and write tests" should be separate steps)
    - A new check "Zero Context Assumption" is added: flag plans that reference code patterns or conventions without documenting them inline
    - Existing checks remain intact
  - **Dependencies**: none
  - **Files**: `.claude/agents/leviathan.md`

- [ ] Task 6: Update maestro SKILL.md to reflect improved planning flow
  - **Agent**: spark
  - **Acceptance criteria**:
    - Planning Flow section mentions interview improvements (one question at a time, multiple-choice, incremental validation)
    - No structural changes to the SKILL.md -- just update the Planning Flow description
  - **Dependencies**: Tasks 1-5
  - **Files**: `.claude/skills/maestro/SKILL.md`

## Verification

- [ ] `grep -c "Interview Rules" .claude/agents/prometheus.md` -- should return 1
- [ ] `grep -c "Plan Output Standards" .claude/agents/prometheus.md` -- should return 1
- [ ] `grep "one question at a time" .claude/agents/prometheus.md` -- interview rule present
- [ ] `grep "zero codebase context" .claude/agents/prometheus.md` -- plan quality rule present
- [ ] `grep "Architecture" .claude/commands/design.md` -- structured header in plan format
- [ ] `grep "Step 1" .claude/commands/design.md` -- task step pattern in plan format
- [ ] `grep "Architecture" .claude/skills/plan-template/SKILL.md` -- template has structured header
- [ ] `grep "Task Granularity" .claude/agents/leviathan.md` -- new validation check exists
- [ ] `grep "Zero Context" .claude/agents/leviathan.md` -- new validation check exists
- [ ] Verify `/work` parsing compatibility: work.md still uses `- [ ]` checkbox format (no changes needed)
- [ ] `./scripts/validate-links.sh` -- all documentation links still valid (if script exists)

## Notes

### Design Decisions

1. **Backward compatibility with /work**: The new plan format keeps `## Objective`, `## Tasks` (with `- [ ]` checkboxes), `## Verification`, and `## Scope` as section headers. The `/work` command parses these sections, so they must remain. New structure is additive (sub-sections within tasks, structured header fields).

2. **Prometheus over design.md for behavioral rules**: Interview rules and plan output standards go in the Prometheus agent file, not in the design command. Rationale: the design command is the orchestrator's instructions -- it spawns Prometheus and should only pass the plan *format template*. Behavioral guidance belongs in the agent definition where it persists across all invocations.

3. **Leviathan enforcement**: Adding validation checks to Leviathan ensures plan quality is enforced even if Prometheus doesn't perfectly follow the output standards. This creates a feedback loop: Leviathan flags issues -> plan gets revised -> quality improves.

4. **No orchestrator changes**: The orchestrator (`orchestrator.md`) and work command (`work.md`) consume plans but don't need changes. The new plan format is a superset of the existing format -- more detail per task, but same structure.

5. **All spark agents**: Every task is a single-file edit to a markdown agent/command/skill definition. No code, no tests, no multi-file coordination needed. Spark is the right agent type.

### Key Patterns from Source Skills

**From brainstorming skill (interview improvements):**
- One question at a time -- never multiple questions in one message
- Multiple-choice preferred -- easier to answer
- Lead with recommended option and explain reasoning
- Present 2-3 approaches with tradeoffs before settling
- Present design in 200-300 word chunks with validation after each section
- YAGNI ruthlessly -- strip unnecessary features
- Review current project state before asking questions

**From writing-plans skill (plan output improvements):**
- Plans assume zero codebase context -- document everything
- Each step = single action (2-5 min): write failing test -> run to confirm -> implement -> run tests -> commit
- Structured header: Feature name H1, Goal, Architecture, Tech Stack
- Each task has Files section (paths to create/modify/test)
- Complete code in plans -- never vague instructions
- Exact commands with expected output
- DRY, YAGNI, TDD, frequent commits
