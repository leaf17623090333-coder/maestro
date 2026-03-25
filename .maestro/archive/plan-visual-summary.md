# Plan Visual Summary

**Goal**: Enhance the /design workflow's Step 8 to show a concise plan summary and ASCII task dependency flowchart before asking the user for approval, so the user can quickly grasp the plan's structure at a glance.
**Architecture**: The design orchestrator (SKILL.md Step 8) already reads the plan content. We add instructions for it to (1) parse task metadata and dependencies from the plan markdown, (2) render a structured summary block, and (3) generate an ASCII box-and-arrow dependency graph — all output before the existing AskUserQuestion prompt.
**Tech Stack**: Pure markdown instruction changes in the design SKILL.md. No external libraries, no code files, no runtime dependencies.

## Objective
Add a visual plan summary (objective, scope, task count, key decisions) and an ASCII task dependency flowchart to Step 8 of the design SKILL.md, displayed before the user approval prompt.

## Scope
**In**:
- Modify Step 8 of `.claude/skills/design/SKILL.md` to include plan summary rendering instructions
- Add ASCII dependency graph generation instructions to Step 8
- Define the parsing rules for extracting task names, agents, and dependencies from the plan format
- Define the ASCII flowchart rendering format (box-and-arrow style)
- Ensure the flowchart shows parallel vs sequential task execution paths

**Out**:
- Changes to Prometheus agent definition or prompt strings
- Changes to the plan format itself (we parse what already exists)
- Changes to the `/work` SKILL.md
- External dependencies or libraries
- Mermaid or other rich diagram formats (ASCII only — must work in terminal)
- Changes to any other steps in the design SKILL.md (only Step 8)

## Tasks

- [ ] Task 1: Add plan summary rendering to Step 8
  - **Agent**: spark
  - **Acceptance criteria**:
    - Step 8 in `.claude/skills/design/SKILL.md` includes instructions to parse and display a summary block before the AskUserQuestion
    - Summary block includes: plan title, objective (first sentence), scope summary (In/Out bullet counts), task count with agent breakdown (e.g., "3 kraken, 1 spark"), and key decisions from Notes section (first 3 bullet points)
    - Summary is formatted as a clearly delineated text block using markdown headers/rules
    - The existing AskUserQuestion prompt and its options remain unchanged
    - Leviathan concerns (if any) are shown after the summary but before the flowchart
  - **Dependencies**: none
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/design/SKILL.md` (Step 8 section, lines 191-229)
  - **Steps**:
    1. Read `.claude/skills/design/SKILL.md`
    2. Locate Step 8 (line 191)
    3. Replace the existing Step 8 content with the enhanced version that includes summary rendering instructions
    4. Verify the edit preserved surrounding steps (Step 7 and Step 9) intact
    5. Commit

- [ ] Task 2: Add ASCII dependency flowchart generation to Step 8
  - **Agent**: spark
  - **Acceptance criteria**:
    - Step 8 includes instructions for the orchestrator to parse `**Dependencies**:` lines from each task in the plan
    - Step 8 includes a clear algorithm for rendering an ASCII box-and-arrow dependency graph
    - Tasks with no dependencies are shown at the top (entry points)
    - Tasks that can run in parallel are shown side-by-side on the same row
    - Dependency arrows (`|`, `v`, `-->`) connect tasks vertically
    - Each task box shows: task number, short title (truncated to 30 chars), and agent type
    - The flowchart includes a legend explaining the symbols
    - An example flowchart is included in the instructions so the orchestrator has a reference
    - The flowchart appears after the summary block but before the AskUserQuestion prompt
  - **Dependencies**: Task 1
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/design/SKILL.md` (Step 8 section)
  - **Steps**:
    1. Read `.claude/skills/design/SKILL.md` (re-read after Task 1's edit)
    2. Add the flowchart generation instructions after the summary block within Step 8
    3. Include parsing rules, rendering algorithm, and example output
    4. Verify the full Step 8 reads coherently with both summary and flowchart
    5. Commit

## Verification
- [ ] `grep -c "flowchart\|dependency graph\|ASCII" .claude/skills/design/SKILL.md` -- should return 3+ matches confirming flowchart instructions were added
- [ ] `grep -c "summary\|Summary" .claude/skills/design/SKILL.md` -- should return matches in Step 8 area confirming summary instructions were added
- [ ] `grep "AskUserQuestion" .claude/skills/design/SKILL.md` -- the original AskUserQuestion block in Step 8 should still be present and unchanged
- [ ] Read Step 7 and Step 9 in the file -- they should be completely unchanged from the original
- [ ] The Step 8 instructions include a concrete example of the ASCII flowchart output
- [ ] The Step 8 instructions specify parsing `**Dependencies**:` lines from plan tasks
- [ ] `./scripts/validate-links.sh` -- no broken links introduced
- [ ] `./scripts/validate-anchors.sh` -- no broken anchors introduced

## Notes

**Technical Decisions:**

1. **Two tasks, sequential dependency** -- Task 1 adds the summary block, Task 2 adds the flowchart. Both edit the same section of the same file, so Task 2 must wait for Task 1 to avoid merge conflicts. This matches the wisdom file's recommendation: "Sequential dependency chain (Task 1 -> Task 2) for same-file edits prevented conflicts."

2. **ASCII box-and-arrow format** -- Chosen over Mermaid because: (a) renders correctly in any terminal without a markdown renderer, (b) no external dependencies, (c) the user explicitly asked for ASCII, (d) Claude Code's output is a monospace terminal. Example format:
   ```
   ┌─────────────────────────┐  ┌─────────────────────────┐
   │ T1: Create skill reg.   │  │ T2: Add matching logic   │
   │ [spark]                 │  │ [spark]                  │
   └────────────┬────────────┘  └────────────┬─────────────┘
                │                             │
                └──────────┬──────────────────┘
                           │
                           v
              ┌────────────────────────────┐
              │ T3: Update orchestrator     │
              │ [spark]                     │
              └────────────┬───────────────┘
                           │
                           v
              ┌────────────────────────────┐
              │ T4: Update prometheus       │
              │ [kraken]                    │
              └────────────────────────────┘
   ```

3. **Parsing from existing plan format** -- Plans already use a consistent format: `- [ ] Task N: Title` with `**Dependencies**: none | Task N` and `**Agent**: kraken | spark`. No format changes needed. The orchestrator reads the plan content in Step 8 anyway, so parsing adds no extra file reads.

4. **Summary content** -- Extracted from existing plan sections that are already required (`## Objective`, `## Scope`, `## Tasks`, `## Notes`). No new data needed.

5. **Placement** -- Summary and flowchart appear AFTER reading the plan content (Step 8 item 1-2) but BEFORE the AskUserQuestion (Step 8 item 4). Leviathan concerns (item 3) appear between summary and flowchart for visibility.

6. **Wisdom-informed caution** -- Per the "improve-design-workflow" wisdom: "Plan format strings in design.md are single-line escaped strings embedded in Task() prompts — hard to edit reliably." This change is safe because Step 8 is executed by the orchestrator directly (not embedded in a Task() prompt string). The Prometheus prompt strings in Steps 4 are NOT modified.

## Prior Wisdom
- Plan format strings in design SKILL.md are single-line escaped strings embedded in Task() prompts — hard to edit reliably (we avoid touching these)
- Sequential dependency chain for same-file edits prevents conflicts
- Direct verification of each completed task is essential — workers sometimes report completion without saving
- Spark agents can struggle with Edit tool when old_string spans markdown code fence boundaries
