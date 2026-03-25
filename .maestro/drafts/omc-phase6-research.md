# Research Log: omc-phase6

## Initial Research

### Codebase Findings (explore)

**Maestro Current Architecture**:
- 20 skills in `.claude/skills/*/SKILL.md` with YAML frontmatter
- 12 agents in `.claude/agents/*.md`
- 14 hooks in `.claude/hooks/hooks.json`
- State in `.maestro/` (plans/, archive/, drafts/, context/, handoff/, wisdom/, research/, notepad.md)

**Key Overlap Analysis**:
1. Git Worktrees: `.claude/skills/git-worktrees/SKILL.md` already exists for parallel plan execution isolation
2. Setup/Doctor: `/setup-check` verifies prerequisites, `/setup` scaffolds context, `/status` shows state, `/reset` cleans stale state
3. No release automation exists
4. No autopilot/autonomous mode — `/design` is interview-driven, `/work` requires a plan
5. No trace/observability — bash-history.sh logs commands but no execution timeline
6. No deep-init/AGENTS.md hierarchy — `/setup` creates centralized context only

### Strategic Analysis (oracle)

**ROI Ranking**:
1. Trace (Highest) — faster root-cause analysis, trust in Maestro behavior
2. Doctor (Highest) — converts hidden config drift into actionable diagnostics
3. PSM adapted (High if scoped) — productivity for multi-issue/PR workflows
4. Release (Medium) — useful for maintainers, less central
5. Deep Init (Low-Medium) — high maintenance cost, drift risk
6. Autopilot (Lowest current ROI) — highest mismatch with plan-centric philosophy

**Recommended Scoping**:
- Adopt fully: Trace, Doctor
- Adopt with adaptation: PSM-lite (build on git-worktrees), Release (dry-run first)
- Skip/defer: Autopilot, Deep Init

**Suggested Phasing**:
- Phase 6A: Trace MVP + Doctor core checks
- Phase 6B: PSM-lite with existing git-worktrees
- Phase 6C: Release dry-run + gated publish
- Phase 6D: Controlled experiments (autopilot/deep-init, deferred)

## Follow-up Research
