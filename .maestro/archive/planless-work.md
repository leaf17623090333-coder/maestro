# Planless Work Mode

**Goal**: Allow `/work <description>` to execute directly without a pre-existing plan from `/design`, by having the orchestrator generate a lightweight inline plan on the fly.
**Architecture**: The work SKILL.md gets a new planless flow (appended after a horizontal rule, following the `/review` pattern). When invoked with a description instead of a plan name, the orchestrator generates a minimal plan in-memory, creates tasks, and executes them using the same team workflow.
**Tech Stack**: Claude Code skills (SKILL.md markdown), Agent Teams

## Objective

Enable `/work` to accept an inline task description and execute it without requiring a pre-existing plan file from `.maestro/plans/`.

## Scope

**In**:
- Update the work SKILL.md frontmatter (`description`, `argument-hint`) to reflect the new mode
- Add planless detection logic to Step 1 (when no plan matches and arguments look like a description)
- Add a new "Planless Work Flow" section after the existing plan-based workflow
- The planless flow generates a lightweight inline plan, creates tasks, and reuses Steps 2-9

**Out**:
- Modifying the orchestrator agent definition (`.claude/agents/orchestrator.md`)
- Modifying the design skill or any other skill
- Adding new hook scripts
- Changing the plan-template skill
- Persisting the generated plan to `.maestro/plans/` (it stays ephemeral -- no archival step needed)

## Tasks

- [ ] Task 1: Update work SKILL.md frontmatter
  - **Agent**: spark
  - **Acceptance criteria**:
    - `description` field reflects both modes: plan execution and planless direct execution
    - `argument-hint` includes the new `<description>` syntax alongside existing `[<plan-name>] [--resume]`
  - **Dependencies**: none
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md`
  - **Steps**:
    1. Change `description` to: `Execute a plan using Agent Teams, or work directly from a description. Spawns specialized teammates to implement tasks in parallel.`
    2. Change `argument-hint` to: `"[<plan-name>] [--resume] | <description of what to do>"`
    3. Commit

- [ ] Task 2: Add planless detection logic to Step 1
  - **Agent**: spark
  - **Acceptance criteria**:
    - Step 1 gains a new decision branch: when `$ARGUMENTS` is provided but does not match any plan filename in `.maestro/plans/` AND is not `--resume`, treat it as a planless work description
    - The existing "plan not found" error becomes a fallthrough to planless mode instead of a hard stop
    - When no arguments are provided AND no plans exist, the error message mentions the planless option: `No plans found. Run /design to create a plan, or /work <description> to work directly.`
  - **Dependencies**: Task 1
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md`
  - **Steps**:
    1. In Step 1, after the plan name lookup fails to match a file, add a check: if the argument contains spaces or is longer than a typical filename slug (heuristic: contains spaces OR length > 40 OR contains common verbs like "add", "fix", "create", "update", "implement", "refactor"), treat it as a planless description and skip to the Planless Work Flow
    2. Update the "0 plans found" error message to mention `/work <description>`
    3. Commit

- [ ] Task 3: Add Planless Work Flow section to SKILL.md
  - **Agent**: kraken
  - **Acceptance criteria**:
    - A new `## Planless Work Flow` section is appended after the existing workflow (after the Anti-Patterns table), separated by a horizontal rule
    - The section includes steps for: analyzing the description, generating a lightweight task breakdown, confirming with user, then joining the main workflow at Step 2 (Create Team)
    - The generated plan is NOT persisted to `.maestro/plans/` -- it exists only as tasks
    - Steps 2-9 from the main workflow are reused (the planless flow explicitly says "proceed to Step 2" after task creation)
    - Worktree isolation (Step 1.7) is skipped in planless mode (too heavyweight for ad-hoc work)
    - The archival step (Step 8.5) is skipped in planless mode (no plan file to archive)
    - Wisdom extraction (Step 7) still happens, using a slug derived from the description
  - **Dependencies**: Task 2
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md`
  - **Steps**:
    1. Draft the planless flow section with these sub-steps:
       - **Step P1: Analyze Description** -- Parse the user's description to understand intent
       - **Step P2: Generate Task Breakdown** -- Create 1-5 atomic tasks from the description (use the same format as plan tasks: subject, acceptance criteria, agent type)
       - **Step P3: Confirm with User** -- Show the generated task breakdown via `AskUserQuestion` and let the user approve, modify the description, or cancel
       - **Step P4: Join Main Workflow** -- Create tasks (Step 3), discover skills (Step 3.5), then proceed to Step 2 (team creation) and continue through the normal flow
    2. Add notes about what steps are skipped: Step 1.5 (validate plan sections -- no plan file), Step 1.7 (worktree -- skipped), Step 8.5 (archive -- skipped)
    3. Add guidance on wisdom file naming: use a slug derived from the first 5 words of the description
    4. Commit

## Verification

- [ ] `cat .claude/skills/work/SKILL.md | head -7` -- frontmatter shows updated description and argument-hint
- [ ] `grep -c "Planless Work Flow" .claude/skills/work/SKILL.md` -- returns 1 (section exists)
- [ ] `grep "planless" .claude/skills/work/SKILL.md | head -5` -- shows planless detection logic in Step 1
- [ ] `./scripts/validate-links.sh` -- no broken documentation links
- [ ] `./scripts/validate-anchors.sh` -- no broken markdown anchors

## Notes

- **Pattern reference**: The `/review` skill (`.claude/skills/review/SKILL.md`) already implements a planless mode. It appends a "Planless Review Flow" section after a horizontal rule, with its own step numbering (P1, P2, etc.). We follow the same convention.
- **Heuristic for detection**: We use a simple heuristic (contains spaces, length, or common verbs) rather than trying to parse intent. This avoids false positives where someone has a plan file named with spaces. The plan file lookup happens first -- only on miss do we consider planless mode.
- **No plan persistence**: The inline plan is ephemeral. If the user wants a persistent plan, they should use `/design`. This keeps the two commands distinct: `/design` = durable plans, `/work` = execution (with or without plan).
- **Wisdom still captured**: Even though no plan file exists, we still extract wisdom. The wisdom file is named from a slug of the description (e.g., `/work add retry logic to api client` -> `.maestro/wisdom/add-retry-logic-to-api.md`).
- **Step reuse**: The planless flow does NOT duplicate Steps 2-9. It explicitly says "proceed to Step 2" after generating tasks, so the orchestrator follows the same execution path.
