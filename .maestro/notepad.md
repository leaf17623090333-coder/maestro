## Working Memory

- [2026-02-23] [plan-maestro:plan-maestro] Files go directly in .claude/skills/ (not .agents/skills/) -- .agents/ is for external plugins only
- [2026-02-23] [plan-maestro:plan-maestro] Subagent-only pattern (Task tool) is the cross-platform common denominator -- no Agent Teams
- [2026-02-23] [plan-maestro:plan-maestro] Planner subagent uses AskUserQuestion directly (general-purpose type, not Plan type)
- [2026-02-23] [plan-maestro:plan-maestro] Plan handoff via draft file (.maestro/drafts/) avoids Task return value truncation
- [2026-02-23] [work:plan-maestro] Completed: 4/4 tasks. Files: 4 modified. Learned: 1 skill extracted. Security: skipped (no sensitive changes).
- [2026-02-23] [workflow.md] workflow.md uses only abstract capability names (agent.spawn, task.create, DECIDE, fs.read, etc.). Native plans must not be moved/deleted -- mark checkboxes in place. Destructive DECIDE gates must never auto-proceed regardless of tier.
