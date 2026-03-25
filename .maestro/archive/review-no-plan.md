# Enhance /review to Work Without a Plan

## Goal

Add a **planless review mode** to `/review` that performs a structured code review based on git diff when no Maestro plan exists. The command auto-detects whether a plan is available: if yes, run the existing plan-based flow; if no, fall into a git-diff-based code review covering code quality, security, test coverage, regressions, and commit hygiene.

## Objective

Enhance the `/review` skill to auto-detect whether a Maestro plan exists and, when no plan is found, perform a structured git-diff-based code review instead of stopping with an error.

## Architecture Summary

The current `/review` skill (`/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`) is a single-file workflow with 10 steps, all plan-dependent. This enhancement modifies Step 1 to branch into two flows:

- **Plan-based flow** (existing): Steps 2-10 unchanged
- **Planless flow** (new): Steps P1-P7 added after the branch point

The branching happens at Step 1 where plans are discovered. Instead of stopping when no plans are found, the skill falls through to the planless flow.

## Tech Stack

- No new dependencies. Uses existing allowed tools: `Read`, `Bash`, `Glob`, `Grep`, `AskUserQuestion`
- Git commands via `Bash` for diff analysis
- No new files or directories created

## Scope

**In:**
- Modify `.claude/skills/review/SKILL.md` to add planless review flow
- Auto-detect: plan exists = plan flow, no plan = planless flow
- Git-diff based input (current branch vs. main, or recent commits on main)
- Five review dimensions: code quality, security, test coverage, regressions, commit hygiene
- Per-file findings table output with severity levels (INFO/WARN/FAIL)
- Overall verdict (CLEAN/NEEDS WORK/FAILED)
- Regression checks (reuse existing Step 7 logic)
- Update skill description in frontmatter to reflect dual-mode capability

**Out:**
- Changes to `/work`, `/design`, or any other skill
- Adding new agent definitions
- Automated fix/remediation (review only reports)
- New runtime state files or directories
- Changes to plan format or structure
- Interactive review modes or incremental review

## Tasks

- [ ] Task 1: Update Step 1 to branch between plan-based and planless flows
  - **File**: `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
  - **Description**: Modify the existing Step 1 ("Find and Load the Plan") to add a branching condition. When no plans are found in `.maestro/plans/` or `.maestro/archive/`, instead of stopping with an error, proceed to a new "Planless Review Flow" section. The plan-based flow (Steps 2-10) remains unchanged.
  - **Changes**: Replace line 20:
    ```
    - If **no plans exist in either directory**: Report "No plans found in `.maestro/plans/` or `.maestro/archive/`. Run /design first." and stop.
    ```
    With:
    ```
    - If **no plans exist in either directory**: Skip to **Planless Review Flow** below.
    ```
  - **Acceptance criteria**:
    - Line 20 no longer tells the user to stop and run /design
    - Line 20 directs to the Planless Review Flow section
    - The existing plan-based flow (Steps 2-10) is completely unchanged
  - **Agent**: spark
  - **Dependencies**: none

- [ ] Task 2: Update frontmatter description to reflect dual-mode
  - **File**: `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
  - **Description**: Update the frontmatter `description` field to indicate the skill works in two modes.
  - **Changes**: Replace line 3:
    ```
    description: Post-execution review — rigorous plan-vs-implementation comparison with per-criterion verdicts.
    ```
    With:
    ```
    description: Code review — plan-vs-implementation comparison when a plan exists, or structured git-diff review when no plan is available.
    ```
  - **Acceptance criteria**:
    - Frontmatter description mentions both modes
    - No other frontmatter fields are changed
  - **Agent**: spark
  - **Dependencies**: none

- [ ] Task 3: Add Planless Review Flow - Step P1 (Determine Diff Scope)
  - **File**: `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
  - **Description**: Add the first step of the planless flow after Step 10 (Post-Review Archival). This step determines what code to review by examining the git state. Insert the following section at the end of the file:

    ```markdown
    ---

    ## Planless Review Flow

    When no plan is found, perform a structured code review based on git changes.

    ### Step P1: Determine Diff Scope

    Identify what changes to review by checking the git state:

    1. **Check if on a feature branch** (not `main` or `master`):
       ```
       Bash("git rev-parse --abbrev-ref HEAD")
       ```
       - If on a feature branch: diff against the base branch (`main` or `master`)
         ```
         Bash("git diff main...HEAD --name-only")
         ```
       - If on `main`/`master`: diff the most recent commit(s) with uncommitted changes
         ```
         Bash("git diff HEAD --name-only")
         ```
         If no uncommitted changes, diff the last commit:
         ```
         Bash("git diff HEAD~1 --name-only")
         ```

    2. **If no changes are found at all**: Report "No changes detected. Nothing to review." and stop.

    3. **Collect the full diff** for the determined scope:
       ```
       Bash("git diff main...HEAD")  # or the appropriate diff command from above
       ```

    4. **List changed files** with their change type (added/modified/deleted):
       ```
       Bash("git diff main...HEAD --name-status")
       ```

    Record the diff scope (branch name, commit range, or "uncommitted") for the report header.
    ```
  - **Acceptance criteria**:
    - Section titled "Planless Review Flow" exists after Step 10
    - Step P1 checks whether on a feature branch or main
    - Feature branch diffs against main
    - Main branch diffs HEAD or HEAD~1
    - Stops if no changes found
    - Collects both the full diff and the file list with change types
  - **Agent**: spark
  - **Dependencies**: Task 1

- [ ] Task 4: Add Step P2 (Code Quality Review)
  - **File**: `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
  - **Description**: Add Step P2 after Step P1. This step reviews each changed file for code quality issues. Append after Step P1:

    ```markdown
    ### Step P2: Code Quality Review

    For each changed file (skip deleted files), read the file and the relevant diff hunks. Check for:

    1. **Naming** — Are variables, functions, classes named clearly and consistently with the project's conventions?
    2. **Structure** — Is the code well-organized? Are functions/methods a reasonable size? Is there unnecessary nesting?
    3. **Readability** — Would another developer understand this code without excessive comments? Are complex sections documented?
    4. **Duplication** — Is there copy-pasted code that should be extracted? Use Grep to check for similar patterns in the codebase.
    5. **Dead code** — Are there unused imports, variables, or functions introduced in the diff?

    For each file, read it:
    ```
    Read("{file_path}")
    ```

    Record findings as a list of `{file, line, dimension, severity, description}` tuples. Severity levels:
    - **FAIL** — Must fix: bugs, broken logic, clear violations
    - **WARN** — Should fix: poor naming, unnecessary complexity, mild duplication
    - **INFO** — Consider: style suggestions, minor improvements
    ```
  - **Acceptance criteria**:
    - Step P2 exists after Step P1
    - Checks all 5 quality dimensions (naming, structure, readability, duplication, dead code)
    - Uses Read to examine each changed file
    - Findings use the three-level severity system (FAIL/WARN/INFO)
  - **Agent**: spark
  - **Dependencies**: Task 3

- [ ] Task 5: Add Step P3 (Security Review)
  - **File**: `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
  - **Description**: Add Step P3 after Step P2. This step reviews changed files for security issues. Append after Step P2:

    ```markdown
    ### Step P3: Security Review

    For each changed file, check the diff for security concerns:

    1. **Secrets/Credentials** — Hardcoded API keys, tokens, passwords, connection strings. Grep for common patterns:
       ```
       Grep("(api[_-]?key|secret|password|token|credential)\\s*[:=]", "{file_path}")
       ```
    2. **Injection risks** — SQL concatenation, shell command construction, unescaped HTML output, eval usage
    3. **Input validation** — User input used without validation or sanitization, especially at system boundaries
    4. **Dependency concerns** — New dependencies added (check package.json, requirements.txt, go.mod diffs). Flag unfamiliar or unnecessary additions
    5. **Sensitive data exposure** — Logging sensitive information, error messages leaking internals

    Record security findings with severity:
    - **FAIL** — Confirmed vulnerability or secret exposure
    - **WARN** — Potential risk that needs manual verification
    - **INFO** — Security-adjacent observation (e.g., new dependency added)
    ```
  - **Acceptance criteria**:
    - Step P3 exists after Step P2
    - Checks for secrets, injection, input validation, dependencies, data exposure
    - Uses Grep for pattern-based secret detection
    - Security findings use the same FAIL/WARN/INFO severity
  - **Agent**: spark
  - **Dependencies**: Task 4

- [ ] Task 6: Add Step P4 (Test Coverage Review)
  - **File**: `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
  - **Description**: Add Step P4 after Step P3. This step checks whether changed code has corresponding test coverage. Append after Step P3:

    ```markdown
    ### Step P4: Test Coverage Review

    For each changed file that contains implementation code (not test files, configs, or docs):

    1. **Identify the expected test file** — Based on project conventions, determine where tests should live:
       ```
       Glob("**/*test*{file_basename}*")
       Glob("**/*{file_basename}*test*")
       Glob("**/__tests__/{file_basename}*")
       Glob("**/test_*{file_basename_no_ext}*")
       ```

    2. **Check test existence** — Does a corresponding test file exist?
       - If yes: Read it and check if the changed/new functions are covered
       - If no: Flag as WARN ("No test file found for {file}")

    3. **Check for test changes in the diff** — Were test files modified as part of this change?
       - New functions/methods added without corresponding test additions = WARN
       - Bug fixes without regression tests = WARN
       - Pure refactors with passing existing tests = INFO (acceptable)

    Record findings:
    - **FAIL** — New public API or critical logic with zero test coverage
    - **WARN** — Changed logic without updated tests, or missing test file
    - **INFO** — Test coverage exists but could be more thorough
    ```
  - **Acceptance criteria**:
    - Step P4 exists after Step P3
    - Uses Glob to find test files matching changed implementation files
    - Checks whether new/changed functions have test coverage
    - Distinguishes between no tests, partial tests, and adequate tests
  - **Agent**: spark
  - **Dependencies**: Task 5

- [ ] Task 7: Add Step P5 (Regression Check)
  - **File**: `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
  - **Description**: Add Step P5 after Step P4. This step reuses the same regression logic as the plan-based Step 7. Append after Step P4:

    ```markdown
    ### Step P5: Regression Check

    Run the project's standard validation checks (same as plan-based Step 7):

    1. Check `package.json` for `test`, `build`, `lint`, `typecheck` scripts — run them if they exist
    2. Check for `Makefile` — run relevant targets if present
    3. Check for CI config (`.github/workflows/`, `.gitlab-ci.yml`) — note what CI would run
    4. Check for validation scripts (e.g., `scripts/validate-*.sh`) — run them

    Record each result as **PASS**, **FAIL**, or **SKIP** (with reason).
    ```
  - **Acceptance criteria**:
    - Step P5 exists after Step P4
    - Contains the same 4 regression checks as plan-based Step 7
    - Results use PASS/FAIL/SKIP
  - **Agent**: spark
  - **Dependencies**: Task 6

- [ ] Task 8: Add Step P6 (Commit Hygiene Review)
  - **File**: `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
  - **Description**: Add Step P6 after Step P5. This step reviews commit quality. Append after Step P5:

    ```markdown
    ### Step P6: Commit Hygiene Review

    If reviewing a branch with multiple commits, examine commit quality:

    ```
    Bash("git log main..HEAD --oneline")
    ```

    Check for:

    1. **Atomic commits** — Does each commit represent a single logical change? Flag commits that mix unrelated changes (e.g., feature + formatting)
    2. **Commit messages** — Are messages descriptive? Flag generic messages like "fix", "update", "wip", "asdf"
    3. **Debug artifacts** — Check the diff for leftover `console.log`, `debugger`, `print()`, `TODO/FIXME` that appear to be temporary:
       ```
       Grep("(console\\.log|debugger|print\\(|TODO|FIXME|HACK|XXX)", changed_files)
       ```
    4. **Large files** — Flag any single file change exceeding 500 lines (may need splitting)
    5. **Sensitive files** — Flag changes to `.env`, credentials, or config files that might contain secrets

    Record findings:
    - **FAIL** — Debug artifacts in production code, secrets committed
    - **WARN** — Poor commit messages, non-atomic commits, large changes
    - **INFO** — Minor style observations
    ```
  - **Acceptance criteria**:
    - Step P6 exists after Step P5
    - Reviews commit atomicity, messages, debug artifacts, large files, sensitive files
    - Uses git log to examine commit history
    - Uses Grep to find debug artifacts
  - **Agent**: spark
  - **Dependencies**: Task 7

- [ ] Task 9: Add Step P7 (Planless Review Report)
  - **File**: `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
  - **Description**: Add Step P7 after Step P6. This step produces the structured report for planless reviews. Append after Step P6:

    ```markdown
    ### Step P7: Produce Planless Review Report

    Generate the report in this exact format:

    ```
    ## Code Review: {branch name or "uncommitted changes"}

    **Scope**: `{diff description, e.g., "feature-branch vs. main (12 commits, 8 files)"}`
    **Reviewed**: {current date}

    ---

    ### Changed Files

    | # | File | Status | Findings |
    |---|------|--------|----------|
    | 1 | `{path}` | Added/Modified/Deleted | {count} FAIL, {count} WARN, {count} INFO |

    ---

    ### Findings by File

    #### `{file_path}`

    | # | Line | Dimension | Severity | Finding |
    |---|------|-----------|----------|---------|
    | 1 | {line} | Quality/Security/Tests/Hygiene | FAIL/WARN/INFO | {description} |

    {Repeat for each file with findings}

    ---

    ### Regression Check

    | Check | Result | Output |
    |-------|--------|--------|
    | {check name} | PASS/FAIL/SKIP | {summary} |

    ---

    ### Summary

    | Dimension | FAIL | WARN | INFO |
    |-----------|------|------|------|
    | Code Quality | {n} | {n} | {n} |
    | Security | {n} | {n} | {n} |
    | Test Coverage | {n} | {n} | {n} |
    | Commit Hygiene | {n} | {n} | {n} |
    | **Total** | **{n}** | **{n}** | **{n}** |

    ---

    ### Verdict: CLEAN / NEEDS WORK / FAILED

    **Summary**: {1-2 sentence summary}

    - **CLEAN**: No FAILs, few or no WARNs, regressions pass
    - **NEEDS WORK**: No FAILs but multiple WARNs that should be addressed
    - **FAILED**: One or more FAILs that must be fixed before merging

    {If NEEDS WORK or FAILED, list the specific items that need attention}
    ```

    Populate every section. If a file has no findings, omit it from "Findings by File" but keep it in the "Changed Files" table with "0 findings". Be precise with line numbers.
    ```
  - **Acceptance criteria**:
    - Step P7 exists after Step P6
    - Report includes Changed Files overview table
    - Report includes per-file findings table with line, dimension, severity, description
    - Report includes regression check table
    - Report includes summary table counting FAIL/WARN/INFO per dimension
    - Report includes CLEAN/NEEDS WORK/FAILED verdict
    - Verdict criteria are clearly defined
  - **Agent**: spark
  - **Dependencies**: Task 8

- [ ] Task 10: Verify the complete SKILL.md
  - **File**: `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
  - **Description**: Read the complete file and verify all sections are present and consistent. Run validation scripts.
  - **Verification commands**:
    ```
    # Check the file exists and has both flows
    Grep("Planless Review Flow", ".claude/skills/review/SKILL.md")
    Grep("Step P1", ".claude/skills/review/SKILL.md")
    Grep("Step P7", ".claude/skills/review/SKILL.md")
    Grep("Skip to.*Planless", ".claude/skills/review/SKILL.md")

    # Validate no broken links
    Bash("cd /Users/reinamaccredy/Code/maestro && ./scripts/validate-links.sh")
    ```
  - **Acceptance criteria**:
    - File contains "Planless Review Flow" section header
    - File contains Steps P1 through P7
    - Step 1 references the Planless Review Flow for the no-plan case
    - Plan-based Steps 2-10 are completely unchanged
    - Frontmatter description reflects dual-mode
    - validate-links.sh passes
  - **Agent**: spark
  - **Dependencies**: Task 9

- [ ] Task 11: Commit the changes
  - **File**: `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`
  - **Description**: Commit the modified SKILL.md with a descriptive commit message.
  - **Command**:
    ```
    Bash("cd /Users/reinamaccredy/Code/maestro && git add .claude/skills/review/SKILL.md && git commit -m 'feat: add planless git-diff review mode to /review skill'")
    ```
  - **Acceptance criteria**:
    - Commit is created with only SKILL.md changed
    - Commit message is descriptive
  - **Agent**: spark
  - **Dependencies**: Task 10

## Verification

- [ ] Read `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md` and confirm it contains both plan-based and planless flows
- [ ] Confirm Step 1 branches to planless flow when no plans exist (grep for "Skip to")
- [ ] Confirm Steps P1-P7 exist in order
- [ ] Confirm plan-based Steps 2-10 are unchanged from the current version
- [ ] Confirm frontmatter description mentions both modes
- [ ] Run `./scripts/validate-links.sh` -- no broken links
- [ ] Run `./scripts/validate-anchors.sh` -- no broken anchors

## Notes

**Technical Decisions:**

1. **Single file modification** -- The entire change is to `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md`. No new files, no new agents, no new directories. Tasks are split per-section for clean incremental verification.

2. **Auto-detect, not flag-based** -- The planless flow activates automatically when no plan is found. No command-line flags or user prompts needed. If a plan exists, the existing flow runs unchanged. This follows YAGNI -- the simplest branching that works.

3. **Git diff as primary input** -- The planless flow uses `git diff main...HEAD` for feature branches and `git diff HEAD` or `git diff HEAD~1` for main. This covers the most common review scenarios without requiring user input.

4. **Severity levels instead of PASS/FAIL** -- Plan-based reviews use binary PASS/FAIL because acceptance criteria are binary. Planless reviews use three-level severity (FAIL/WARN/INFO) because code review findings have nuance -- not everything is a blocker.

5. **Per-file organization** -- Findings are grouped by file in the report. This makes the report actionable: developers work file-by-file, so findings should be organized the same way.

6. **Reused regression logic** -- Step P5 (Regression Check) is identical to plan-based Step 7. This keeps behavior consistent across both modes.

7. **Planless flow at end of file** -- The new sections are appended after Step 10, not interleaved. This minimizes risk to the existing plan-based flow and makes the diff clean.

**Current vs. New Behavior:**

| Scenario | Current Behavior | New Behavior |
|----------|-----------------|-------------|
| Plan exists | Plan-based review (Steps 2-10) | Unchanged |
| No plan, on feature branch | Stops with error | Git-diff review vs. main |
| No plan, on main with changes | Stops with error | Reviews uncommitted/last commit |
| No plan, no changes | Stops with error | Reports "nothing to review" |

**Rollback Strategy:**

Single file change. `git revert` of one commit restores previous behavior. The plan-based flow is never modified (only line 20 of Step 1 changes), so existing functionality is not at risk.

**Key files:**
- `/Users/reinamaccredy/Code/maestro/.claude/skills/review/SKILL.md` -- the only file being modified
