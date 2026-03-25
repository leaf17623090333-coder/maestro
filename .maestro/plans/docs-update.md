# Documentation Update Plan

## Objective
Review and fix outdated documentation across the Maestro project to ensure accuracy and consistency.

## Scope
**In**: Core documentation files (README, REFERENCE, docs/, AGENTS.md, CLAUDE.md, skill files)
**Out**: Template files (templates/), toolbox docs (toolboxes/), runtime state files (.maestro/plans/, .maestro/wisdom/)

## Research Findings

### Documentation Files Identified
- `/Users/reinamaccredy/Code/maestro/README.md` - Main project readme
- `/Users/reinamaccredy/Code/maestro/REFERENCE.md` - Quick reference
- `/Users/reinamaccredy/Code/maestro/AGENTS.md` - Agent overview (root)
- `/Users/reinamaccredy/Code/maestro/CLAUDE.md` - Project instructions
- `/Users/reinamaccredy/Code/maestro/docs/ARCHITECTURE.md` - System architecture
- `/Users/reinamaccredy/Code/maestro/docs/AGENTS.md` - Agent redirect
- `/Users/reinamaccredy/Code/maestro/docs/AGENT-TEAMS.md` - Teams guide
- `/Users/reinamaccredy/Code/maestro/docs/CUSTOMIZATION.md` - Customization guide
- `/Users/reinamaccredy/Code/maestro/docs/TROUBLESHOOTING.md` - Troubleshooting
- `/Users/reinamaccredy/Code/maestro/.claude/skills/maestro/SKILL.md` - Skill definition

### Current State
- **9 agents** in `.claude/agents/`: explore, kraken, leviathan, oracle, orchestrator, progress-reporter, prometheus, spark, wisdom-synthesizer
- **6 commands** in `.claude/commands/`: design, reset, review, setup-check, status, work
- Latest version: v0.14.1 (Feb 6, 2026)

### Issues Found
1. **README.md Agents table (line 65-74)**: Shows 8 agents, missing `leviathan` (deep plan reviewer, opus)
2. **docs/AGENTS.md**: Just a 6-line redirect to ARCHITECTURE.md - low value, consider removing or expanding

### Validation Results
- `./scripts/validate-links.sh` - PASSED (no broken links)
- `./scripts/validate-anchors.sh` - PASSED (no broken anchors)

## Tasks
- [ ] Task 1: Add leviathan to README.md Agents table (line 65-74)
- [ ] Task 2: Remove docs/AGENTS.md (redundant redirect) OR expand with agent details

## Verification
- Run `./scripts/validate-links.sh` after changes
- Verify agent count = 9 in README Agents table

## Notes
- Most docs are current (v0.14.0 included documentation rewrite)
- REFERENCE.md and docs/ARCHITECTURE.md already list all 9 agents correctly
- Main fix is just the README table
