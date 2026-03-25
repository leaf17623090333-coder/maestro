# OMC Phase 5 — Adopt 6 High-Value Features into Maestro

**Goal**: Adopt UltraQA, Security Review, Note/Working Memory, Deep Analysis, Research, and Learner into Maestro as native skills using existing markdown + shell architecture with minimal new surface area.
**Architecture**: Each feature ships as a new skill under `/Users/reinamaccredy/Code/maestro/.claude/skills/<name>/SKILL.md`, with one new read-only Opus agent (`security-reviewer`) for deep security analysis. Existing hooks and agents are reused: `oracle` for diagnosis/synthesis, `build-fixer`/`kraken` for fixes, `explore` for discovery. Runtime state is stored under `.maestro/` (`handoff`, `research`, `notepad`) and surfaced through existing status/session patterns.
**Tech Stack**: Markdown skills, Bash hooks/scripts, jq/json state, Claude Agent Teams

## Objective
Implement six OMC-inspired commands in Maestro with YAGNI scope and clear verification so they are immediately usable in `/design` + `/work` ecosystems.

## Scope
**In**:
- Add six new skills: `/analyze`, `/note`, `/learner`, `/security-review`, `/ultraqa`, `/research`
- Add one new agent: `security-reviewer` (Opus, read-only + Bash)
- Integrate note priority context into session start output
- Integrate new command/agent/state docs in core Maestro docs
- Add/adjust smoke tests for hook behavior impacted by note/session and new agent whitelist

**Out**:
- No new orchestrator framework or new team-lead agent types
- No auto-commit behavior in UltraQA cycles
- No custom UI, TUI, or non-markdown storage systems
- No rewrite of existing `/design` or `/work` core flow
- No external dependencies beyond current shell/jq/git toolchain

## Tasks

- [x] Task 1: Add failing hook test for note priority injection <!-- commit: 4b62f8a -->
  - **Agent**: kraken
  - **Acceptance criteria**: `scripts/test-hooks.sh` contains a new test asserting `session-start.sh` includes `Priority context:` when `/Users/reinamaccredy/Code/maestro/.maestro/notepad.md` has non-empty Priority Context; test currently fails before implementation.
  - **Dependencies**: none
  - **Files**: `/Users/reinamaccredy/Code/maestro/scripts/test-hooks.sh`
  - **Steps**:
    1. Append a test case that creates notepad fixture and expects `Priority context:` in `hookSpecificOutput.additionalContext`.
    2. Command: `bash /Users/reinamaccredy/Code/maestro/scripts/test-hooks.sh` → expected: FAIL on new test.

- [x] Task 2: Implement `/note` skill <!-- commit: 4b62f8a -->
  - **Agent**: kraken
  - **Acceptance criteria**: New skill exists with commands `--priority`, `--manual`, `--show`, `--prune`, `--clear`; storage path is `/Users/reinamaccredy/Code/maestro/.maestro/notepad.md` with sections `## Priority Context`, `## Working Memory`, `## Manual`.
  - **Dependencies**: Task 1
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/skills/note/SKILL.md`
  - **Steps**:
    1. Create file with this header + behavior skeleton:
       ```markdown
       ---
       name: note
       description: Manage persistent working memory in .maestro/notepad.md with priority, working, and manual sections.
       argument-hint: "<content> [--priority|--manual|--show|--prune|--clear]"
       allowed-tools: Read, Write, Edit, Bash, Glob, AskUserQuestion
       disable-model-invocation: true
       ---
       ```
    2. Implement section contract:
       ```markdown
       # Notepad
       ## Priority Context
       <!-- max 500 chars -->
       ## Working Memory
       <!-- timestamped entries; prune >7 days -->
       ## Manual
       <!-- permanent notes -->
       ```

- [x] Task 3: Implement session-start priority context loading <!-- commit: 4b62f8a -->
  - **Agent**: spark
  - **Acceptance criteria**: `/Users/reinamaccredy/Code/maestro/.claude/scripts/session-start.sh` appends a `Priority context: ...` line when notepad priority section has content, truncates to 500 chars, and degrades silently when file missing.
  - **Dependencies**: Task 2
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/scripts/session-start.sh`
  - **Steps**:
    1. Add section after command list parsing notepad:
       ```bash
       notepad_file="$PROJECT_DIR/.maestro/notepad.md"
       if [[ -f "$notepad_file" ]]; then
         priority=$(awk '/^## Priority Context/{flag=1;next}/^## /{flag=0}flag' "$notepad_file" | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g' | sed 's/^ //; s/ $//')
         if [[ -n "$priority" ]]; then
           priority="${priority:0:500}"
           context_parts+=("Priority context: $priority")
         fi
       fi
       ```
    2. Command: `bash -n /Users/reinamaccredy/Code/maestro/.claude/scripts/session-start.sh` → expected: exit 0.

- [x] Task 4: Re-run hook smoke tests after note integration <!-- commit: 4b62f8a -->
  - **Agent**: spark
  - **Acceptance criteria**: `scripts/test-hooks.sh` passes, including new note-priority test.
  - **Dependencies**: Task 3
  - **Files**: `/Users/reinamaccredy/Code/maestro/scripts/test-hooks.sh`
  - **Steps**:
    1. Command: `bash /Users/reinamaccredy/Code/maestro/scripts/test-hooks.sh` → expected: all PASS.

- [x] Task 5: Implement `/analyze` skill <!-- commit: 4b62f8a -->
  - **Agent**: kraken
  - **Acceptance criteria**: New skill is investigation-only, delegates context gathering to `explore`, synthesis to `oracle`, outputs sections: Summary, Key Findings, Analysis, Recommendations.
  - **Dependencies**: none
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/skills/analyze/SKILL.md`
  - **Steps**:
    1. Create SKILL with frontmatter:
       ```markdown
       ---
       name: analyze
       description: Deep investigation mode. Gather context, analyze, synthesize recommendations without making code changes.
       argument-hint: "<problem or topic>"
       allowed-tools: Read, Grep, Glob, Bash, Task, TeamCreate, TeamDelete, SendMessage, AskUserQuestion
       disable-model-invocation: true
       ---
       ```
    2. Include explicit non-editing rule: no `Write/Edit` actions in workflow text.

- [x] Task 6: Implement `/learner` skill <!-- commit: 4b62f8a -->
  - **Agent**: kraken
  - **Acceptance criteria**: New skill extracts hard-won principles (not snippets), enforces quality gates (non-Googleable, context-specific, actionable, hard-won), saves to `/Users/reinamaccredy/Code/maestro/.claude/skills/learned/*.md` with YAML frontmatter + triggers.
  - **Dependencies**: none
  - **Files**:
    - `/Users/reinamaccredy/Code/maestro/.claude/skills/learner/SKILL.md`
    - `/Users/reinamaccredy/Code/maestro/.claude/skills/learned/.gitkeep`
  - **Steps**:
    1. Create learner skill with required rubric and save destination.
    2. Ensure directory exists and tracked via `.gitkeep`.

- [x] Task 7: Implement `security-reviewer` agent definition <!-- commit: 4b62f8a -->
  - **Agent**: kraken
  - **Acceptance criteria**: New read-only Opus agent exists with tools: `Read, Grep, Glob, Bash, TaskList, TaskGet, TaskUpdate, SendMessage`; disallows file edits.
  - **Dependencies**: none
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/agents/security-reviewer.md`
  - **Steps**:
    1. Create full agent file modeled after `critic`/`oracle`.
    2. Include report format with severities Critical/High/Medium/Low and file:line evidence.

- [x] Task 8: Add security-reviewer to SubagentStart whitelist <!-- commit: 4b62f8a -->
  - **Agent**: spark
  - **Acceptance criteria**: `/Users/reinamaccredy/Code/maestro/.claude/scripts/subagent-context.sh` includes `security-reviewer` in allowed `agent_type` case statement.
  - **Dependencies**: Task 7
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/scripts/subagent-context.sh`
  - **Steps**:
    1. Edit case arm from:
       ```bash
       kraken|spark|build-fixer|critic|explore|oracle|leviathan|wisdom-synthesizer|progress-reporter)
       ```
       to:
       ```bash
       kraken|spark|build-fixer|critic|explore|oracle|leviathan|wisdom-synthesizer|progress-reporter|security-reviewer)
       ```
    2. Command: `bash -n /Users/reinamaccredy/Code/maestro/.claude/scripts/subagent-context.sh` → expected: exit 0.

- [x] Task 9: Implement `/security-review` skill <!-- commit: 4b62f8a -->
  - **Agent**: kraken
  - **Acceptance criteria**: Skill delegates deep analysis to `security-reviewer`; checks auth/authz, input validation, secrets, injection, XSS, dependency security; runs dependency audit command when ecosystem supports it.
  - **Dependencies**: Task 7
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/skills/security-review/SKILL.md`
  - **Steps**:
    1. Create SKILL with explicit delegation and severity report template.
    2. Include audit decision block:
       ```bash
       # JS projects
       bun audit || npm audit
       # Non-JS projects: report SKIP with reason
       ```

- [x] Task 10: Implement `/ultraqa` skill with no auto-commit <!-- commit: 4b62f8a -->
  - **Agent**: kraken
  - **Acceptance criteria**: Skill supports goals `--tests`, `--build`, `--lint`, `--typecheck`, `--custom`; max 5 cycles; stop on same failure 3x; stores state at `/Users/reinamaccredy/Code/maestro/.maestro/handoff/ultraqa-state.json`; explicitly does not commit.
  - **Dependencies**: none
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/skills/ultraqa/SKILL.md`
  - **Steps**:
    1. Create SKILL with loop contract and observability output.
    2. Use `oracle` for diagnosis and `build-fixer`/`kraken` for fixes.
    3. Include hard rule: “Never run git commit in UltraQA.”

- [x] Task 11: Implement `/research` skill with full-power AUTO limits <!-- commit: 4b62f8a -->
  - **Agent**: kraken
  - **Acceptance criteria**: Skill supports staged research (3-7 stages), AUTO mode with max 10 iterations, max 5 concurrent agents, session state persisted in `/Users/reinamaccredy/Code/maestro/.maestro/research/`.
  - **Dependencies**: none
  - **Files**:
    - `/Users/reinamaccredy/Code/maestro/.claude/skills/research/SKILL.md`
    - `/Users/reinamaccredy/Code/maestro/.maestro/research/.gitkeep`
  - **Steps**:
    1. Create SKILL with stage decomposition, parallel execution, verification, synthesis.
    2. Add AUTO guardrails block:
       ```markdown
       - max_stages: 7
       - max_iterations: 10
       - max_concurrency: 5
       ```
    3. Add session JSON schema for stages/findings/report pointers.

- [x] Task 12: Update Maestro command documentation in root CLAUDE.md <!-- commit: 0eadd66 -->
  - **Agent**: spark
  - **Acceptance criteria**: Commands list includes `/analyze`, `/note`, `/learner`, `/security-review`, `/ultraqa`, `/research`; Agents table includes `security-reviewer`; Runtime state includes `.maestro/research/` and `.maestro/notepad.md` mention.
  - **Dependencies**: Task 5, Task 6, Task 7, Task 9, Task 10, Task 11
  - **Files**: `/Users/reinamaccredy/Code/maestro/CLAUDE.md`
  - **Steps**:
    1. Update command bullets and agents table.
    2. Extend runtime tree with `research/` and add text note for `notepad.md`.

- [x] Task 13: Update Maestro skill index documentation <!-- commit: 0eadd66 -->
  - **Agent**: spark
  - **Acceptance criteria**: `/Users/reinamaccredy/Code/maestro/.claude/skills/maestro/SKILL.md` Triggers and Quick Reference include six new commands; Agents section includes `security-reviewer`.
  - **Dependencies**: Task 5, Task 6, Task 7, Task 9, Task 10, Task 11
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/skills/maestro/SKILL.md`
  - **Steps**:
    1. Add trigger rows for each command and update references.

- [x] Task 14: Add setup-check coverage for new state directory <!-- commit: 0eadd66 -->
  - **Agent**: spark
  - **Acceptance criteria**: `/Users/reinamaccredy/Code/maestro/.claude/skills/setup-check/SKILL.md` checks `.maestro/research/` alongside existing required directories.
  - **Dependencies**: Task 11
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/skills/setup-check/SKILL.md`
  - **Steps**:
    1. Update directory checklist and fix command example to include `.maestro/research`.

- [x] Task 15: Add status reporting for research sessions and notepad <!-- commit: 0eadd66 -->
  - **Agent**: spark
  - **Acceptance criteria**: `/Users/reinamaccredy/Code/maestro/.claude/skills/status/SKILL.md` includes sections for `.maestro/research/` and `.maestro/notepad.md` presence.
  - **Dependencies**: Task 2, Task 11
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/skills/status/SKILL.md`
  - **Steps**:
    1. Add explicit listing rules and next-step suggestions for missing notepad/research state.

- [x] Task 16: Add failing smoke test for security-reviewer subagent context eligibility <!-- commit: 4b62f8a -->
  - **Agent**: kraken
  - **Acceptance criteria**: `scripts/test-hooks.sh` includes test where `agent_type=security-reviewer` gets context JSON (not silent exit) and fails before Task 8 if run standalone.
  - **Dependencies**: none
  - **Files**: `/Users/reinamaccredy/Code/maestro/scripts/test-hooks.sh`
  - **Steps**:
    1. Add dedicated test case for `security-reviewer` in subagent-context script.

- [x] Task 17: Run hook smoke tests after whitelist + note work <!-- commit: verified -->
  - **Agent**: spark
  - **Acceptance criteria**: hook smoke tests pass including new note and security-reviewer tests.
  - **Dependencies**: Task 4, Task 8, Task 16
  - **Files**: `/Users/reinamaccredy/Code/maestro/scripts/test-hooks.sh`
  - **Steps**:
    1. Command: `bash /Users/reinamaccredy/Code/maestro/scripts/test-hooks.sh` → expected: all PASS.

- [x] Task 18: Validate manifests and docs formatting <!-- commit: verified -->
  - **Agent**: spark
  - **Acceptance criteria**: Plugin and hooks JSON parse; links/anchors validations pass or are explicitly reported if pre-existing failures.
  - **Dependencies**: Task 12, Task 13, Task 14, Task 15
  - **Files**:
    - `/Users/reinamaccredy/Code/maestro/.claude-plugin/plugin.json`
    - `/Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json`
    - `/Users/reinamaccredy/Code/maestro/scripts/validate-links.sh`
    - `/Users/reinamaccredy/Code/maestro/scripts/validate-anchors.sh`
  - **Steps**:
    1. Run:
       ```bash
       cat /Users/reinamaccredy/Code/maestro/.claude-plugin/plugin.json | jq .
       cat /Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json | jq .
       /Users/reinamaccredy/Code/maestro/scripts/validate-links.sh
       /Users/reinamaccredy/Code/maestro/scripts/validate-anchors.sh
       ```

- [x] Task 19: Verify new skills are discoverable by session-start parser <!-- commit: verified -->
  - **Agent**: spark
  - **Acceptance criteria**: Running session-start hook in repo context includes new skill names in `Skills:` context output.
  - **Dependencies**: Task 2, Task 5, Task 6, Task 9, Task 10, Task 11
  - **Files**: `/Users/reinamaccredy/Code/maestro/.claude/scripts/session-start.sh`
  - **Steps**:
    1. Command: `CLAUDE_PROJECT_DIR=/Users/reinamaccredy/Code/maestro bash /Users/reinamaccredy/Code/maestro/.claude/scripts/session-start.sh`.
    2. Expected output contains `note`, `analyze`, `learner`, `security-review`, `ultraqa`, `research`.

- [x] Task 20: Final regression run and commit batching by wave <!-- commit: 0eadd66 -->
  - **Agent**: spark
  - **Acceptance criteria**: All checks pass; commits are created after each verified working increment (Wave 1, Wave 2, Wave 3).
  - **Dependencies**: Task 17, Task 18, Task 19
  - **Files**: all modified files above
  - **Steps**:
    1. Run verification suite (see Verification section).
    2. Create 3 commits minimum (one per wave), each with scoped message and Co-Authored-By trailer.

## Dependency Chain
> T1: Add failing hook test for note priority injection [`kraken`]
> T2: Implement `/note` skill [`kraken`] — blocked by T1
> T3: Implement session-start priority context loading [`spark`] — blocked by T2
> T4: Re-run hook smoke tests after note integration [`spark`] — blocked by T3
> T5: Implement `/analyze` skill [`kraken`]
> T6: Implement `/learner` skill [`kraken`]
> T7: Implement `security-reviewer` agent definition [`kraken`]
> T8: Add security-reviewer to SubagentStart whitelist [`spark`] — blocked by T7
> T9: Implement `/security-review` skill [`kraken`] — blocked by T7
> T10: Implement `/ultraqa` skill with no auto-commit [`kraken`]
> T11: Implement `/research` skill with full-power AUTO limits [`kraken`]
> T12: Update Maestro command documentation in root CLAUDE.md [`spark`] — blocked by T5, T6, T7, T9, T10, T11
> T13: Update Maestro skill index documentation [`spark`] — blocked by T5, T6, T7, T9, T10, T11
> T14: Add setup-check coverage for new state directory [`spark`] — blocked by T11
> T15: Add status reporting for research sessions and notepad [`spark`] — blocked by T2, T11
> T16: Add failing smoke test for security-reviewer subagent context eligibility [`kraken`]
> T17: Run hook smoke tests after whitelist + note work [`spark`] — blocked by T4, T8, T16
> T18: Validate manifests and docs formatting [`spark`] — blocked by T12, T13, T14, T15
> T19: Verify new skills are discoverable by session-start parser [`spark`] — blocked by T2, T5, T6, T9, T10, T11
> T20: Final regression run and commit batching by wave [`spark`] — blocked by T17, T18, T19

## Execution Phases
> **Phase 1** — T1 [`kraken`], T5 [`kraken`], T6 [`kraken`], T7 [`kraken`], T10 [`kraken`], T11 [`kraken`], T16 [`kraken`] *(all parallel where files do not overlap)*
> **Phase 2** — T2 [`kraken`], T8 [`spark`], T9 [`kraken`], T14 [`spark`]
> **Phase 3** — T3 [`spark`], T12 [`spark`], T13 [`spark`], T15 [`spark`]
> **Phase 4** — T4 [`spark`], T17 [`spark`], T18 [`spark`], T19 [`spark`]
> **Phase 5** — T20 [`spark`]

## Verification
- [ ] `bash /Users/reinamaccredy/Code/maestro/scripts/test-hooks.sh` — all smoke tests PASS (includes note + security-reviewer coverage)
- [ ] `bash -n /Users/reinamaccredy/Code/maestro/.claude/scripts/session-start.sh` — script syntax valid
- [ ] `bash -n /Users/reinamaccredy/Code/maestro/.claude/scripts/subagent-context.sh` — script syntax valid
- [ ] `cat /Users/reinamaccredy/Code/maestro/.claude-plugin/plugin.json | jq .` — valid plugin manifest JSON
- [ ] `cat /Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json | jq .` — valid hooks JSON
- [ ] `/Users/reinamaccredy/Code/maestro/scripts/validate-links.sh` — docs links check passes
- [ ] `/Users/reinamaccredy/Code/maestro/scripts/validate-anchors.sh` — docs anchor check passes
- [ ] `grep -R "name: \(analyze\|note\|learner\|security-review\|ultraqa\|research\)" /Users/reinamaccredy/Code/maestro/.claude/skills/*/SKILL.md` — six new skills discoverable
- [ ] `grep -q "name: security-reviewer" /Users/reinamaccredy/Code/maestro/.claude/agents/security-reviewer.md` — new agent present

## Notes
- **Rollout choice locked**: 3-wave implementation chosen by user.
  - Wave 1: analyze, note, learner
  - Wave 2: security-review, ultraqa
  - Wave 3: research
- **Decisions locked**:
  - `/note` storage = single markdown file with strict sections
  - `/ultraqa` = no auto-commit
  - `/research AUTO` = max 7 stages, max 10 iterations, max 5 concurrent agents
- **YAGNI defaults**:
  - Reuse existing agents (`explore`, `oracle`, `build-fixer`, `kraken`) except one targeted addition (`security-reviewer`)
  - Keep feature state under existing `.maestro/` conventions
  - Avoid new hooks unless absolutely required (none required for MVP)

## Prior Wisdom
Past cycle topics considered: docs-update, skill-interop, review-improvement, hooks-improvement, omc-features, conductor-integration.

## Key Context
- **Research log**: `/Users/reinamaccredy/Code/maestro/.maestro/drafts/omc-phase5-research.md`
- OMC source files: `/Users/reinamaccredy/Code/maestro/tmp/oh-my-claudecode/commands/`
- Core reference files used:
  - `/Users/reinamaccredy/Code/maestro/CLAUDE.md`
  - `/Users/reinamaccredy/Code/maestro/.claude/skills/maestro/SKILL.md`
  - `/Users/reinamaccredy/Code/maestro/.claude/scripts/session-start.sh`
  - `/Users/reinamaccredy/Code/maestro/.claude/scripts/subagent-context.sh`
  - `/Users/reinamaccredy/Code/maestro/scripts/test-hooks.sh`
