# Wisdom: Plan Cleanup — Automatic Archival of Executed Plans

## Conventions Discovered
- Maestro command files follow a consistent step-numbered structure; new steps use "Step N.5" for insertions between existing steps
- `.maestro/.gitignore` uses a pattern of `category/*.md` or `category/*.json` entries with descriptive comments, plus `!category/` preserve entries
- Command files use YAML frontmatter with `name`, `description`, and `allowed-tools`

## Successful Approaches
- Running Task 1 (directory/gitignore setup) as a prerequisite before spawning parallel workers for the 4 command file edits prevented merge conflicts and ordering issues
- Giving workers the full current file content as context in the delegation prompt reduced mistakes
- Verifying each file against acceptance criteria immediately after worker completion caught the missing output lines in reset.md quickly

## Failed Approaches to Avoid
- First pass on reset.md missed the Output section updates (archived plans removed count + preserved count) — worker completed the main sections but skipped the summary template at the end. Always include the output/summary template in acceptance criteria checks.

## Technical Gotchas
- The `.maestro/.gitignore` needs both `archive/*.md` (to ignore the contents) and `!archive/` (to preserve the directory itself) — same pattern as plans/ and wisdom/
- When adding dual-directory search to `/review`, the "exactly one plan" logic needs to consider plans from BOTH directories combined, not each directory individually
- `/review` archives on COMPLETE verdict — this is a safety net for interrupted `/work` sessions that didn't reach the archival step
