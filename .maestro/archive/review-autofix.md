# Review Auto-Fix

**Goal**: Add always-on auto-fix capability to the `/review` skill so it automatically fixes issues it finds in both plan-based and planless review flows, without requiring per-fix user approval.
**Architecture**: After generating the review report (both flows), a new auto-fix step reads the collected FAIL/WARN findings, applies mechanical fixes inline using Write/Edit tools, logs complex unfixable issues as TODOs in the report, then recalculates the verdict based on remaining unfixed issues.
**Tech Stack**: Claude Code skill system (markdown-based SKILL.md), Write/Edit tools, Bash for verification re-runs.

## Objective

Enhance `/review` to automatically fix issues it discovers during both plan-based and planless reviews, applying mechanical fixes inline and logging complex issues as TODOs.

## Scope

**In**:
- Add `Write, Edit` to the review skill's `allowed-tools` frontmatter
- Update the skill description to mention auto-fix capability
- Add "Auto-Fix Results" placeholder to both report templates
- Add auto-fix step to plan-based review flow (new Step 9.5 between report and archival)
- Add auto-fix step to planless review flow (new Step P7.5 after report)
- Recalculate verdict after fixes are applied
- Update CLAUDE.md description for `/review`

**Out**:
- No team spawning or worker delegation -- all fixes are inline
- No `--fix` flag or opt-in mechanism -- auto-fix is always on
- No per-fix user approval -- fixes are applied automatically
- No changes to hooks, agent definitions, or other skills
- No changes to the review flow's discovery/analysis steps (Steps 1-8, P1-P6)

## Tasks

- [ ] Task 1: Update review skill frontmatter
  - **Agent**: spark
  - **Acceptance criteria**:
    - `allowed-tools` line in `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md` reads `allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion`
    - `description` line mentions auto-fix (e.g., "Code review with auto-fix")
  - **Dependencies**: none
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
  - **Steps**:
    1. Read `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
    2. Edit the `allowed-tools` line from `allowed-tools: Read, Bash, Glob, Grep, AskUserQuestion` to `allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion`
    3. Edit the `description` line from `description: Code review — plan-vs-implementation comparison when a plan exists, or structured git-diff review when no plan is available.` to `description: Code review with auto-fix — plan-vs-implementation comparison or structured git-diff review. Automatically fixes issues found during review.`
    4. Verify the frontmatter is valid YAML between `---` markers
    5. Commit

- [ ] Task 2: Add Auto-Fix Results placeholder to both report templates
  - **Agent**: spark
  - **Acceptance criteria**:
    - The plan-based report template in Step 9 includes an `### Auto-Fix Results` placeholder between the `### Remediation` section and `### Verdict` section
    - The planless report template in Step P7 includes an `### Auto-Fix Results` placeholder between the `### Summary` table and `### Verdict` section
    - Both placeholders note they are populated by the auto-fix step
  - **Dependencies**: Task 1
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
  - **Steps**:
    1. Read `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
    2. In the Step 9 report template, locate the `### Remediation` section. After the last line of that section (`- **Verification — {check}**: {How to fix the failing check}`) and before the `---` that precedes `### Verdict`, insert:
       ```
       ---

       ### Auto-Fix Results
       {Populated by Step 9.5 — see below}
       ```
    3. In the Step P7 report template, locate the `### Summary` table. After the closing row of the Summary table (`| **Total** | **{n}** | **{n}** | **{n}** |`) and before the `---` that precedes `### Verdict`, insert:
       ```
       ---

       ### Auto-Fix Results
       {Populated by Step P7.5 — see below}
       ```
    4. Run `grep -c "Auto-Fix Results" /Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md` -- expect `2`
    5. Commit

- [ ] Task 3: Add auto-fix step to plan-based review flow
  - **Agent**: spark
  - **Acceptance criteria**:
    - A new `## Step 9.5: Auto-Fix` section exists between Step 9 (Produce Structured Report) and Step 10 (Post-Review Archival) in `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
    - The step instructs the reviewer to iterate over all FAIL findings from the report
    - The step classifies each finding as "fixable" (mechanical/simple) or "complex" (requires design/feature work)
    - Fixable findings are applied using Edit tool with specific file paths and line numbers from the evidence
    - Complex findings are logged as TODO comments in the report's Remediation section
    - After all fixes, verification commands from Step 6 are re-run to confirm fixes work
    - The step updates the report's Auto-Fix Results section to show what was FIXED vs what remains as TODO
  - **Dependencies**: Task 2
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
  - **Steps**:
    1. Read `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
    2. Locate `## Step 10: Post-Review Archival` and insert the following new section immediately before it (after the `Populate every section...` paragraph that closes Step 9):

    ````
    ## Step 9.5: Auto-Fix

    After generating the report, automatically fix issues that can be resolved with mechanical edits.

    ### Classify Findings

    Review every FAIL finding from the report (Task Completion criteria, Scope violations, Verification failures). Classify each as:

    - **Fixable**: Missing exports, wrong function/variable names, missing imports, incorrect config values, missing sections in markdown files, wrong file paths in references, minor logic errors with obvious corrections. The fix is unambiguous and localized to a few lines.
    - **Complex (TODO)**: Missing feature implementations, architectural changes, new test files needed, design decisions required, multi-file refactors with unclear scope. The fix requires judgment or significant new code.

    ### Apply Fixes

    For each **fixable** finding:

    1. Read the target file using the path and line number from the report evidence
    2. Apply the fix using `Edit(file_path, old_string, new_string)` — use the smallest possible edit
    3. Record what was changed: `{file}:{line} — {description of fix}`

    For each **complex** finding:

    1. Do NOT attempt a fix
    2. Record as TODO: `TODO: {Task N, Criterion M} — {what needs to be done}`

    ### Re-Run Verification

    After all fixes are applied, re-run the verification commands from Step 6 and the regression checks from Step 7:

    ```
    # Re-run plan verification commands
    Bash("{each verification command from the plan}")

    # Re-run project validation
    Bash("{test/build/lint commands from Step 7}")
    ```

    Record updated results.

    ### Update Report

    Populate the **Auto-Fix Results** section in the report (the placeholder added in Step 9):

    ```
    ### Auto-Fix Results

    **Fixed ({N} of {total FAIL count}):**
    | # | Finding | File | Fix Applied |
    |---|---------|------|-------------|
    | 1 | {Task N, Criterion M or finding description} | `{file}:{line}` | {what was changed} |

    **Unfixed — TODO ({M} remaining):**
    | # | Finding | Reason |
    |---|---------|--------|
    | 1 | {Task N, Criterion M or finding description} | {why it couldn't be fixed inline} |

    **Re-Verification:**
    | # | Check | Before Fix | After Fix |
    |---|-------|------------|-----------|
    | 1 | {command or check name} | FAIL | PASS/FAIL |
    ```

    If no FAILs were found in the report, populate the section with: `No issues to fix.`

    ### Recalculate Verdict

    After fixes, update the verdict based on **remaining unfixed issues only**:

    - **COMPLETE**: All FAILs were fixed (or none existed), re-verification passes
    - **NEEDS WORK**: Some FAILs were fixed but TODOs remain
    - **FAILED**: Critical FAILs could not be fixed, or re-verification still fails

    Update the Verdict section at the bottom of the report to reflect post-fix state. Append a note:
    `Auto-fix applied: {N} issues fixed, {M} remaining as TODO.`
    ````

    3. Run `grep -c "Step 9.5" /Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md` -- expect `1`
    4. Commit

- [ ] Task 4: Add auto-fix step to planless review flow
  - **Agent**: spark
  - **Acceptance criteria**:
    - A new `### Step P7.5: Auto-Fix` section exists after Step P7 (Produce Planless Review Report) in `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
    - The step iterates over FAIL and WARN findings from the planless report
    - Fixable findings (dead code removal, debug artifact removal, naming fixes, missing validation) are applied using Edit
    - Complex findings are logged as TODOs
    - Regression checks from Step P5 are re-run after fixes
    - The report's Auto-Fix Results placeholder is populated with fix results
  - **Dependencies**: Task 3
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
  - **Steps**:
    1. Read `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
    2. Locate the end of the Step P7 report section (after the closing `````` of the planless report template and the `Populate every section...` paragraph). Append the following new section at the end of the file:

    ````
    ### Step P7.5: Auto-Fix

    After generating the planless report, automatically fix FAIL and WARN findings that can be resolved with mechanical edits.

    #### Classify Findings

    Review every FAIL and WARN finding from the report. Classify each as:

    - **Fixable**: Debug artifacts (`console.log`, `debugger`, `print()` that are clearly temporary), unused imports/variables, obvious naming violations matching project conventions, missing input validation at system boundaries with clear patterns nearby, hardcoded secrets (replace with environment variable references).
    - **Complex (TODO)**: Architectural restructuring, missing test files, large-scale duplication extraction, commit message rewrites (requires interactive rebase), large file splitting.

    #### Apply Fixes

    For each **fixable** finding:

    1. Read the target file at the line indicated in the report
    2. Apply the fix:
       - **Debug artifacts**: Remove the line(s) containing `console.log`, `debugger`, `print()`, etc.
       - **Unused imports**: Remove the import line
       - **Unused variables**: Remove the declaration
       - **Naming**: Rename to match project conventions (check surrounding code for patterns)
       - **Secrets**: Replace hardcoded value with `process.env.{KEY_NAME}` or equivalent
    3. Use `Edit(file_path, old_string, new_string)` for each fix
    4. Record: `{file}:{line} — {description of fix}`

    For each **complex** finding:

    1. Do NOT attempt a fix
    2. Record as TODO: `TODO: {finding description} — {why it can't be fixed inline}`

    #### Re-Run Regression Checks

    After all fixes are applied, re-run the regression checks from Step P5:

    ```
    # Re-run project validation (same as Step P5)
    Bash("{test/build/lint commands}")
    ```

    If any re-run fails that previously passed, **revert the last fix** using `Edit` to restore the original code and record it as a failed fix attempt.

    #### Update Report

    Populate the **Auto-Fix Results** section in the report (the placeholder added in Step P7):

    ```
    ### Auto-Fix Results

    **Fixed ({N} of {total FAIL + WARN count}):**
    | # | Finding | File | Fix Applied |
    |---|---------|------|-------------|
    | 1 | {finding description} | `{file}:{line}` | {what was changed} |

    **Unfixed — TODO ({M} remaining):**
    | # | Finding | Reason |
    |---|---------|--------|
    | 1 | {finding description} | {why it couldn't be fixed inline} |

    **Re-Verification:**
    | Check | Before Fix | After Fix |
    |-------|------------|-----------|
    | {check name} | FAIL/PASS | PASS/FAIL |
    ```

    If no FAIL/WARN findings were found in the report, populate the section with: `No issues to fix.`

    #### Recalculate Verdict

    After fixes, update the verdict based on **remaining unfixed issues only**:

    - **CLEAN**: All FAILs/WARNs were fixed (or none existed), regressions pass
    - **NEEDS WORK**: Some issues fixed but TODOs remain
    - **FAILED**: Critical FAILs could not be fixed, or regressions broke after fix attempts

    Update the Verdict section to reflect post-fix state. Append:
    `Auto-fix applied: {N} issues fixed, {M} remaining as TODO.`
    ````

    3. Run `grep -c "Step P7.5" /Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md` -- expect `1`
    4. Commit

- [ ] Task 5: Update intro text and CLAUDE.md description
  - **Agent**: spark
  - **Acceptance criteria**:
    - The intro paragraph of the review skill mentions auto-fix capability
    - `/Users/reinamaccredy/Code/maestro/CLAUDE.md` description for `/review` mentions auto-fix
  - **Dependencies**: Task 4
  - **Files**:
    - `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
    - `/Users/reinamaccredy/Code/maestro/CLAUDE.md`
  - **Steps**:
    1. Read both files
    2. In `SKILL.md`, edit the intro paragraph from:
       `Perform a rigorous, structured comparison of the plan against the actual implementation. Every acceptance criterion gets a verdict. Scope compliance is checked. Remediation is suggested for failures.`
       to:
       `Perform a rigorous, structured comparison of the plan against the actual implementation. Every acceptance criterion gets a verdict. Scope compliance is checked. Issues found during review are automatically fixed when possible; complex issues are logged as TODOs.`
    3. In `CLAUDE.md`, edit the `/review` description from:
       `- `/review` — Post-execution review (also supports planless git-diff mode)`
       to:
       `- `/review` — Post-execution review with auto-fix (also supports planless git-diff mode)`
    4. Verify with grep
    5. Commit

- [ ] Task 6: Run validation scripts
  - **Agent**: spark
  - **Acceptance criteria**:
    - `./scripts/validate-links.sh` passes (exit 0)
    - `./scripts/validate-anchors.sh` passes (exit 0)
    - The review skill file is valid (frontmatter parseable, no broken markdown)
  - **Dependencies**: Task 5
  - **Files**:
    - `/Users/reinamaccredy/Code/maestro/scripts/validate-links.sh`
    - `/Users/reinamaccredy/Code/maestro/scripts/validate-anchors.sh`
  - **Steps**:
    1. Run `bash /Users/reinamaccredy/Code/maestro/scripts/validate-links.sh`
    2. Run `bash /Users/reinamaccredy/Code/maestro/scripts/validate-anchors.sh`
    3. Read the final `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md` and verify the frontmatter YAML is valid
    4. If any validation fails, fix the issue and re-run
    5. Commit any fixes

## Verification

- [ ] `grep "Write, Edit" /Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md` -- should match the allowed-tools line
- [ ] `grep -c "Step 9.5: Auto-Fix" /Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md` -- should output `1`
- [ ] `grep -c "Step P7.5: Auto-Fix" /Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md` -- should output `1`
- [ ] `grep -c "Auto-Fix Results" /Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md` -- should output at least `4` (two in report templates, two in auto-fix steps)
- [ ] `grep "auto-fix" /Users/reinamaccredy/Code/maestro/CLAUDE.md` -- should match the updated /review description
- [ ] `bash /Users/reinamaccredy/Code/maestro/scripts/validate-links.sh` -- exit 0
- [ ] `bash /Users/reinamaccredy/Code/maestro/scripts/validate-anchors.sh` -- exit 0

## Notes

### Design Decisions

1. **Always-on, no flag**: Auto-fix runs every time `/review` runs. No `--fix` flag or opt-in. The user explicitly requested this. The review report is still generated first (diagnostic before treatment), then fixes are applied.

2. **Best-effort classification**: The skill classifies findings as "fixable" vs "complex" using heuristics. Fixable = unambiguous, localized, mechanical edits. Complex = requires judgment, new code, or multi-file changes. When in doubt, classify as complex (TODO) to avoid bad fixes.

3. **Revert on regression**: If a fix causes a previously-passing check to fail, the fix is reverted. This prevents auto-fix from making things worse.

4. **Report-first, fix-second**: The diagnostic report is generated in full before any fixes are attempted. This ensures the reviewer has complete context. Fixes are then applied as a separate pass, and the report is updated with results.

5. **Inline execution**: No team spawning. The review skill runs inline with Write/Edit tools. This keeps the workflow fast and simple. Complex issues that need real implementation work are logged as TODOs for the user to handle via `/work`.

6. **Verdict recalculation**: After fixes, the verdict is recalculated based on remaining unfixed issues only. A review that was NEEDS WORK might become COMPLETE after auto-fix resolves all failures.

### Task Execution Order

Tasks are ordered to avoid stale line references: placeholders go into report templates (Task 2) before the bulk auto-fix steps are inserted (Tasks 3-4). This ensures the template edits target stable content before new sections shift line numbers.

### Fixable vs Complex Examples

| Category | Fixable (auto-fix) | Complex (TODO) |
|----------|-------------------|----------------|
| Code Quality | Remove unused import, fix variable name | Extract duplicated code into shared function |
| Security | Replace hardcoded secret with env var | Add input validation middleware |
| Debug | Remove `console.log` | N/A |
| Tests | N/A | Write missing test file |
| Plan criteria | Fix wrong export name, add missing field | Implement missing API endpoint |

## Prior Wisdom
- Review command needs `AskUserQuestion` in `allowed-tools` for multi-plan selection
- Scope compliance checking is heuristic (pattern matching), not definitive
- Planless flow sections are appended after all plan-based steps, separated by a horizontal rule
- Git diff scope detection must handle feature branches, main branch with different commands
- Four-backtick fences needed when skill content contains triple-backtick code blocks
