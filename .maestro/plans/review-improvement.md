# Review Command Improvement

## Objective
Rewrite `/review` to perform a rigorous, structured comparison of `/work` execution results against the original `/design` plan — checking every task's acceptance criteria, verifying scope compliance, and producing an actionable gap analysis.

## Scope

**In**:
- Rewrite `.claude/commands/review.md` with plan-vs-implementation comparison logic
- Per-task acceptance criteria verification (not just file existence, but checking each criterion)
- Scope compliance check: verify nothing outside the plan's `**Out**` scope was built
- Scope completeness check: verify everything in `**In**` scope was addressed
- Structured diff between planned tasks and actual task completion status
- Integration with wisdom files to check if execution lessons were captured
- Improved report format with per-criteria pass/fail and evidence links
- Check that verification commands from the plan actually pass

**Out**:
- Changes to `/work` command or `/design` command
- Adding new agent definitions
- Automated fix/remediation of found issues (review only reports)
- Changes to plan format or structure
- Adding new runtime state files or directories

## Tasks

- [ ] Task 1: Rewrite the review command with plan-aware verification
  - **File**: `.claude/commands/review.md`
  - **Description**: Replace the current review.md with an improved version that performs structured plan-vs-implementation comparison. The new command should:
    1. Find and load the plan (same as current Step 1, but also support plan selection when multiple exist)
    2. Parse ALL plan sections: Objective, Scope (In/Out), Tasks (with acceptance criteria), Verification, Notes
    3. For each task in the plan, check every acceptance criterion individually (not just file existence)
    4. Check scope compliance: grep/glob for files or patterns that suggest work outside the Out scope
    5. Check scope completeness: verify each In-scope item has corresponding implementation evidence
    6. Run all verification commands from the plan's Verification section
    7. Check for regression via project standard checks (package.json scripts, Makefile, CI)
    8. Check wisdom extraction (did /work write a wisdom file?)
    9. Produce an improved structured report
  - **Acceptance criteria**:
    - Command finds the most recent plan in `.maestro/plans/`
    - When multiple plans exist, uses `AskUserQuestion` to let the user select
    - Parses per-task acceptance criteria from the plan (indented bullet points under each task)
    - Each acceptance criterion gets its own PASS/FAIL line in the report
    - Scope In/Out sections are checked for compliance
    - Verification commands from the plan are executed
    - Report includes a clear COMPLETE/NEEDS WORK/FAILED verdict
    - Report includes specific remediation suggestions for each failure
  - **Agent**: spark
  - **Dependencies**: none

## Verification

- [ ] Read `.claude/commands/review.md` and confirm it contains all 9 steps described in Task 1
- [ ] Confirm the command parses per-task acceptance criteria (look for "acceptance criteria" handling)
- [ ] Confirm scope compliance checking is present (look for In/Out scope parsing)
- [ ] Confirm the output format includes per-criterion PASS/FAIL rows
- [ ] Confirm `AskUserQuestion` is used for plan selection when multiple plans exist
- [ ] Confirm the `allowed-tools` frontmatter includes `AskUserQuestion` (needed for plan selection)
- [ ] Run the command mentally against the sample plan `.maestro/plans/skill-interop.md` — all sections should map to review checks
- [ ] Validate with `./scripts/validate-links.sh` — no broken links introduced

## Notes

**Technical Decisions:**

1. **Single task, not multiple** — This is a rewrite of one file (`.claude/commands/review.md`). Splitting into multiple tasks would create unnecessary coordination overhead for a single-file change.

2. **AskUserQuestion for plan selection** — The current review.md just picks the most recently modified plan. When multiple plans exist, the user should choose which to review. This requires adding `AskUserQuestion` to the `allowed-tools` frontmatter.

3. **Per-task acceptance criteria parsing** — Plans use this format:
   ```
   - [ ] Task N: Title
     - **Acceptance criteria**:
       - Criterion 1
       - Criterion 2
   ```
   The review command needs to parse this indented structure to check each criterion individually.

4. **Scope compliance via pattern matching** — The plan's `**Out**` section lists what should NOT have been built. The review command can check for files/patterns that would indicate out-of-scope work. This is heuristic, not definitive.

5. **Wisdom check** — After `/work`, a wisdom file should exist in `.maestro/wisdom/{plan-name}.md`. The review command should check for this and note if it's missing (indicates Step 7 of `/work` was skipped).

6. **Report format upgrade** — The improved report adds:
   - Per-criterion rows (not just per-task)
   - Scope compliance section
   - Remediation suggestions
   - Wisdom extraction status
   - Clear link back to the plan file for reference

**Current review.md analysis (what changes):**

| Current Behavior | New Behavior |
|-----------------|--------------|
| Picks most recent plan only | Offers selection when multiple plans exist |
| Checks file existence per task | Checks each acceptance criterion per task |
| No scope checking | Checks In/Out scope compliance |
| Generic task status (DONE/PARTIAL/MISSING) | Per-criterion PASS/FAIL with evidence |
| No wisdom check | Verifies wisdom file was created |
| No remediation suggestions | Includes specific fix suggestions per failure |
| `allowed-tools: Read, Bash, Glob, Grep` | Adds `AskUserQuestion` for plan selection |

**Rollback Strategy:**

Single file change. Git revert of one commit restores previous behavior.

**Key files:**
- `.claude/commands/review.md` — the file being rewritten
- `.maestro/plans/skill-interop.md` — sample plan to validate against
- `.claude/commands/work.md` — reference for what /work produces
