# Wisdom: Planless Work Mode

## Conventions Discovered
- Planless flow sections are appended after all plan-based steps, separated by a horizontal rule — consistent with /review pattern
- Description detection uses a heuristic (spaces, length, common verbs) with plan file lookup happening first to avoid false positives
- Planless mode reuses Steps 2-9 from the main workflow via "join" semantics, avoiding duplication
- Wisdom file naming in planless mode uses first 5 words of description as slug

## Successful Approaches
- Two workers for sequential tasks: spark handles quick frontmatter edit, kraken handles the larger section additions
- Tasks 1→2→3 dependency chain ensures the file isn't edited by two workers simultaneously
- Using /review's planless mode as an exact pattern reference — reduces design decisions

## Failed Approaches to Avoid
- None — clean execution

## Technical Gotchas
- The AskUserQuestion code block inside the Planless Work Flow uses triple backticks, but since the SKILL.md itself doesn't contain quadruple-backtick fences at that level, triple backticks worked fine here (unlike /review which needed four-backtick fences)
- The planless detection heuristic in Step 1 should be kept in sync if new plan naming conventions are introduced (e.g., plans with spaces in filenames would trigger false positives)
