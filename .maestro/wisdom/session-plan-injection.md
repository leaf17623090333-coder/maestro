# Wisdom: Session Plan Injection

## Conventions Discovered
- PreCompact hooks use plain text stdout (NOT JSON with hookSpecificOutput) — stdout is appended directly to the compact system prompt
- SessionStart hooks use JSON with `hookSpecificOutput.additionalContext` — different output format from PreCompact
- PreCompact fires with `CONVERSATION_CONTEXT` env var containing full conversation text
- Handoff files serve dual purpose: session recovery (design→work handoff) AND hook-based context injection
- PreCompact matcher uses `"*"` since it fires globally (not per-tool like PreToolUse/PostToolUse)

## Successful Approaches
- Three-pronged approach: PreCompact hook (survives /compact), enhanced SessionStart (covers /clear and new sessions), handoff status lifecycle ("executing"/"archived")
- Keeping handoff schema minimal — only adding new status values, no new fields
- Workers self-claiming dependent tasks (worker-2 completed Tasks 2, 4, 5, 6 sequentially after first task unblocked the rest)
- Committing verified work immediately while waiting for other workers

## Failed Approaches to Avoid
- Worker modified design/SKILL.md out of scope — always verify diff includes only planned files before committing
- Worker-2 attempted all dependent tasks itself rather than letting idle workers claim them — not a failure but suboptimal parallelization

## Technical Gotchas
- No "PreClear" or "PostClear" hook exists — /clear wipes everything with no hook. Only SessionStart fires afterward
- SessionStart may or may not fire after /clear (depends on whether /clear starts a new session or just clears in-session)
- Fallback for /clear: handoff files persist on disk, so `/work --resume` can still find the executing plan even without hook injection
- `context_parts` array in session-start.sh must be initialized before appending — insertion point matters
