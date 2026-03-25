# Research Log: omc-phase5

## Initial Research

### Codebase Findings (explore)

**Current Maestro State (already implemented from Phase 1-4):**
- Scripts: worker-persistence.sh, error-detector.sh, bash-history.sh, keyword-detector.sh, skill-injector.sh, remember-extractor.sh, session-start.sh, verification-injector.sh, orchestrator-guard.sh, plan-protection.sh, plan-validator.sh, wisdom-injector.sh, subagent-context.sh, plan-context-injector.sh
- Agents: build-fixer, critic, kraken, leviathan, oracle, orchestrator, progress-reporter, spark, wisdom-synthesizer
- Libraries: background-agent-guide, complexity-scoring, rate-limit-handling, remember-tags, skill-matcher, skill-registry, verification-checklist
- Skills: context7, design, git-worktrees, maestro, pipeline, plan-template, project-conventions, reset, review, setup, setup-check, status, styleguide, web-design-guidelines, work

**6 Features to Adopt (Tier 1):**

#### 1. UltraQA (`/ultraqa`)
- Source: `tmp/oh-my-claudecode/commands/ultraqa.md`
- Autonomous QA cycling: Test → Diagnose → Fix → Repeat (max 5 cycles)
- Goal types: --tests, --build, --lint, --typecheck, --custom
- Exit conditions: goal met, cycle 5 reached, same failure 3x
- State tracking in JSON
- Maestro adaptation: Create `/ultraqa` skill, reuse existing agents (oracle for diagnosis, build-fixer/kraken for fixes)

#### 2. Security Review (`/security-review`)
- Source: `tmp/oh-my-claudecode/commands/security-review.md`
- OWASP Top 10 scan, hardcoded secrets detection, npm audit
- Severity-rated report: Critical, High, Medium, Low
- Needs: security-reviewer agent (opus, read-only + Bash for audit commands)
- Maestro adaptation: Create `/security-review` skill + security-reviewer agent

#### 3. Note / Working Memory (`/note`)
- Source: `tmp/oh-my-claudecode/commands/note.md`
- Manual context injection into notepad file
- Three sections: Priority Context (always loaded, 500 char), Working Memory (timestamped, auto-pruned), Manual (permanent)
- Commands: --priority, --manual, --show, --prune, --clear
- Integration with session-start hook for auto-loading
- Maestro adaptation: Create `/note` skill, store in `.maestro/notepad.md`, modify session-start.sh to load priority context

#### 4. Deep Analysis (`/analyze`)
- Source: `tmp/oh-my-claudecode/commands/analyze.md`
- Investigation-only mode: no code changes, just reports
- Output: Summary, Key Findings, Analysis, Recommendations
- Uses explore agent for research + oracle for synthesis
- Maestro adaptation: Create `/analyze` skill, lightweight, uses existing agents

#### 5. Research (`/research`)
- Source: `tmp/oh-my-claudecode/commands/research.md`
- Parallel scientist agents for comprehensive research
- Stage decomposition → Parallel execution → Verification → Synthesis
- AUTO mode for fully autonomous execution
- Session management with resume/status/report
- Smart model routing: haiku for data gathering, sonnet for analysis, opus for complex reasoning
- Maestro adaptation: Create `/research` skill, use explore (haiku), oracle (opus), and new researcher agent (sonnet)

#### 6. Learner (`/learner`)
- Source: `tmp/oh-my-claudecode/commands/learner.md`
- Extract reusable skills from debugging sessions
- Quality gates: non-Googleable, context-specific, actionable, hard-won
- Saves to `.maestro/skills/learned/` as markdown with YAML frontmatter
- Triggers for future re-injection
- Maestro adaptation: Create `/learner` skill, store learned skills in `.maestro/learned/` (or `.claude/skills/learned/`), auto-discovered by skill-registry

### Strategic Analysis (oracle)

**Architecture fit:** All 6 features are independent skills — no cross-dependencies. Each creates a new skill SKILL.md + optional agent .md + optional hook integration. This matches Maestro's existing pattern perfectly.

**Risk areas:**
1. Session-start.sh is getting crowded — notepad loading adds more logic
2. Hooks.json is already large — new hooks for note extraction could conflict
3. The research skill overlaps with the existing explore agent — need clear differentiation

**Recommended approach:**
- Phase A (simple skills): Analyze + Note + Learner — minimal new infrastructure
- Phase B (agent skills): Security Review + UltraQA — need new agent definitions
- Phase C (complex skill): Research — needs team management within a skill

## Follow-up Research
