# Wisdom: Review Auto-Fix

## Conventions Discovered
- Auto-fix steps follow the "diagnostic first, treatment second" pattern — the full report is generated before any fixes are attempted
- Planless flow uses `###` heading level (Step P7.5), plan-based flow uses `##` heading level (Step 9.5) — matches existing conventions
- Report template placeholders should be inserted before the auto-fix step content that populates them, to avoid stale line references during sequential edits

## Successful Approaches
- Ordering tasks so template placeholders are inserted before bulk content — avoids line number drift
- Using section-name anchors ("after `### Remediation`") instead of line numbers for Edit targets
- All tasks as spark (not kraken) for single-file markdown insertions — TDD framing is artificial for non-code edits
- Worker combined Tasks 3+4 autonomously since they were similar — reduced overhead

## Failed Approaches to Avoid
- Assigning markdown insertion tasks to kraken with contrived "failing tests" — wastes time on artificial TDD ceremony
- Hardcoding line numbers in task instructions — they shift as earlier tasks insert content

## Technical Gotchas
- The `allowed-tools` field needs `Write, Edit` added (not just `Write`) for the auto-fix to work with Edit tool
- Four-backtick fences are needed in SKILL.md when content contains triple-backtick code blocks (e.g., the auto-fix step has code block examples inside the step definition)
- Plan-based verdict uses COMPLETE/NEEDS WORK/FAILED; planless uses CLEAN/NEEDS WORK/FAILED — different first option
- Planless auto-fix handles WARNs in addition to FAILs; plan-based only handles FAILs
