# Plan Cleanup — Automatic Archival of Executed Plans

## Objective
Add archival functionality so that executed plans are moved from `.maestro/plans/` to `.maestro/archive/` after `/work` completes, and `/review` can locate and review plans from the archive.

## Scope
**In**:
- Add archival step to `/work` (after team cleanup, before final report)
- Update `/review` to search both `.maestro/plans/` and `.maestro/archive/` for plans
- Add archival step to `/review` when verdict is COMPLETE
- Create `.maestro/archive/` directory with `.gitkeep`
- Update `.maestro/.gitignore` to ignore archived plans
- Update `/status` to show archived plan count
- Update `/reset` to offer archive cleanup

**Out**:
- Changing plan file format or naming conventions
- Changing wisdom file behavior (wisdom already persists independently)
- Auto-migrating existing plans in `.maestro/plans/` to archive
- Adding archive browsing or restore commands
- Changes to `/design` (it creates plans, not archives)

## Tasks

- [ ] Task 1: Create `.maestro/archive/` directory and update `.gitignore`
  - **File**: `.maestro/archive/.gitkeep`
  - **Description**: Create the archive directory with a `.gitkeep` placeholder. Update `.maestro/.gitignore` to ignore `archive/*.md` (same treatment as `drafts/*.md` and `handoff/*.json`).
  - **Agent**: spark
  - **Acceptance criteria**:
    - `.maestro/archive/.gitkeep` exists
    - `.maestro/.gitignore` contains `archive/*.md` entry
    - `.gitignore` comment explains purpose (archived executed plans)

- [ ] Task 2: Add archival step to `/work` command
  - **File**: `.claude/commands/work.md`
  - **Description**: Add a new Step 8.5 (between current Step 8: Cleanup Team and Step 9: Report) that moves the executed plan from `.maestro/plans/{name}.md` to `.maestro/archive/{name}.md`. The orchestrator must track which plan file was loaded in Step 1 and move it after execution completes. Create the archive directory if it doesn't exist.
  - **Agent**: kraken
  - **Acceptance criteria**:
    - New step between Cleanup Team and Report that moves the plan file
    - Step references the plan file path loaded in Step 1
    - Uses `Bash("mv .maestro/plans/{name}.md .maestro/archive/{name}.md")` (or equivalent)
    - Creates `.maestro/archive/` directory if missing (`mkdir -p`)
    - Step 9 (Report) updated to mention the plan was archived and its new location
    - Report suggests `/review` still works: "The plan has been archived. `/review` can still access it."
    - Only the specific executed plan is moved — other plans in `.maestro/plans/` are untouched

- [ ] Task 3: Update `/review` to search plans and archive directories
  - **File**: `.claude/commands/review.md`
  - **Description**: Update Step 1 (Find and Load the Plan) to search both `.maestro/plans/*.md` and `.maestro/archive/*.md`. Present all found plans to the user with their location indicated (active vs archived). After generating the review report, if the verdict is COMPLETE and the plan is still in `.maestro/plans/` (not already archived), move it to `.maestro/archive/`.
  - **Agent**: kraken
  - **Acceptance criteria**:
    - Step 1 Globs both `.maestro/plans/*.md` and `.maestro/archive/*.md`
    - Plan list shows location context: "(active)" for plans/, "(archived)" for archive/
    - If no plans in either location: existing error message unchanged
    - If exactly one plan total (either location): auto-load it
    - If multiple plans across both locations: present combined list to user
    - New step after report generation: if verdict is COMPLETE and plan is in `.maestro/plans/`, move to `.maestro/archive/`
    - Report header shows actual plan path (whether plans/ or archive/)

- [ ] Task 4: Update `/status` to show archive information
  - **File**: `.claude/commands/status.md`
  - **Description**: Add a new section (Section 1.5 or integrate into Section 1) that shows archived plans from `.maestro/archive/`. Show count and latest archived plan name. Update the "Next Steps" suggestions table to account for archived plans.
  - **Agent**: spark
  - **Acceptance criteria**:
    - Status output includes archived plan count
    - Shows latest archived plan filename
    - If archive is empty, no section shown (or "No archived plans")
    - Next Steps table updated: when archive has items + no active plans, suggest "Previous plans archived. Run `/design` for next iteration."

- [ ] Task 5: Update `/reset` to offer archive cleanup
  - **File**: `.claude/commands/reset.md`
  - **Description**: Add a new cleanup section (Section 5) for archived plans. When running reset, list archived plans and offer to delete them. This is the ONLY way archived plans get deleted — it requires explicit user confirmation. Update the safety rules to clarify that archive deletion is allowed (unlike plans/ and wisdom/ which are never deleted by reset).
  - **Agent**: spark
  - **Acceptance criteria**:
    - New section "5. Archived Plans" that lists `.maestro/archive/*.md`
    - Shows file name and first line for each archived plan
    - Asks user which to remove (or all, or none)
    - Safety rules updated: "Plans in `.maestro/plans/` are NEVER deleted. Archived plans in `.maestro/archive/` may be deleted with user confirmation."
    - Output summary updated to include archived plans removed count

- [ ] Task 6: Verify all changes work together
  - **Description**: Run validation scripts and verify the commands are internally consistent. Check that all file references are correct, no broken cross-references between commands, and the archival flow is coherent end-to-end.
  - **Agent**: spark
  - **Acceptance criteria**:
    - `./scripts/validate-links.sh` passes
    - `./scripts/validate-anchors.sh` passes
    - Manual read-through of modified files confirms consistent terminology
    - The plan lifecycle is coherent: design -> plans/ -> work (archive) -> archive/ -> review (can read from archive/) -> reset (can clean archive/)

## Verification

1. Run `./scripts/validate-links.sh` — should pass with no broken links
2. Run `./scripts/validate-anchors.sh` — should pass with no broken anchors
3. Read `.claude/commands/work.md` — verify new archival step exists between cleanup and report
4. Read `.claude/commands/review.md` — verify it searches both `plans/` and `archive/`
5. Read `.claude/commands/status.md` — verify archive section exists
6. Read `.claude/commands/reset.md` — verify archive cleanup section exists
7. Read `.maestro/.gitignore` — verify `archive/*.md` is ignored
8. Verify `.maestro/archive/.gitkeep` exists

## Notes

### Design Decisions
- **Archive preserves original filename**: `docs-update.md` in `plans/` becomes `docs-update.md` in `archive/`. No timestamp prefix needed — the filename is the topic slug and uniquely identifies the plan.
- **Name collision in archive**: If the same topic is re-planned and re-executed, the new archive overwrites the old one. This is acceptable because wisdom files capture the durable learnings from each execution.
- **Only executed plan is archived**: When `/work` runs with multiple plans, only the specific plan selected and executed gets archived. Other plans remain in `plans/` for future execution.
- **`/review` dual search**: Review checks both directories so it works regardless of whether the plan was archived (by `/work`) or not (interrupted session, manual plan). This makes the system resilient to partial execution.
- **`/review` archives on COMPLETE**: When `/review` confirms all criteria pass (COMPLETE verdict) and the plan is still in `plans/`, it archives it. This handles the case where `/work` was interrupted before archival.
- **Git treatment matches drafts/handoffs**: Archived plans are transient local state, not source of truth. Wisdom files are the durable output. This keeps the git history clean.
- **No auto-migration**: Existing plans in `.maestro/plans/` are left as-is. They'll be archived naturally when next executed via `/work` or reviewed as COMPLETE via `/review`.

### Rollback Strategy
All changes are to markdown command files — revert the specific commits if issues arise. The `.maestro/archive/` directory is inert if the commands don't reference it.

### Multi-Plan Behavior
- `/work` selects one plan (Step 1), executes it, archives only that plan
- `/review` shows all plans from both directories, user selects one to review
- `/reset` lists archived plans separately from active plans, confirms before deletion
- `/status` shows counts for both active and archived plans

### Parallelization
- Task 1 runs first (creates archive directory)
- Tasks 2, 3, 4, 5 run in parallel (each modifies a different file)
- Task 6 runs last (verification)
