# Wisdom: Enhance /review to Work Without a Plan

## Conventions Discovered
- Planless flow sections are appended after all plan-based steps, separated by a horizontal rule — keeps existing flow untouched
- The `description` field in SKILL.md frontmatter should reflect all modes the skill supports
- Four-backtick fences (``````) are needed when skill content contains triple-backtick code blocks

## Successful Approaches
- Sequential task chain for single-file edits: each task appends one section, easy to verify incrementally
- Two parallel workers: one for the small independent edit (frontmatter), one for the long chain (branch logic + all P-steps)
- Verification as a separate orchestrator-owned task rather than delegated — ensures ground truth

## Failed Approaches to Avoid
- None — clean execution

## Technical Gotchas
- The planless flow reuses the same regression check logic as plan-based Step 7 — if Step 7 changes, Step P5 should be updated too
- Git diff scope detection must handle both feature branches (`git diff main...HEAD`) and main branch (`git diff HEAD` / `git diff HEAD~1`) — three different commands for three scenarios
