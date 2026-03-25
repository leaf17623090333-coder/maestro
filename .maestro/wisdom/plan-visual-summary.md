# Wisdom: Plan Visual Summary

## Conventions Discovered
- Step 8 of the design SKILL.md is executed by the orchestrator directly (not embedded in a Task() prompt string), making it safe to add complex formatting instructions
- The plan format's existing `**Dependencies**:`, `**Agent**:`, and `- [ ] Task N:` patterns are sufficient for parsing — no format changes needed

## Successful Approaches
- Worker (spark) completed both sequential tasks in a single execution, editing Step 8 twice
- Kept the existing AskUserQuestion block and On Approve/Revise/Cancel handlers completely unchanged — surgical edit to only items 2-3

## Failed Approaches to Avoid
- Initial verification read occurred before the worker's filesystem writes propagated — read the file AFTER confirming git diff shows changes (or wait for teammate message before reading)

## Technical Gotchas
- Worker edits may not be immediately visible via `git diff` if the file was read before the worker finished writing — always re-read the file fresh after receiving the teammate completion message
- Box-drawing characters (┌─┐│└─┘) render correctly in Claude Code's monospace terminal output
